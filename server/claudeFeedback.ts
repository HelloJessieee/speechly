import Anthropic from '@anthropic-ai/sdk'
import { lessonsById } from '../src/data/lessons'
import type { FeedbackApiRequest } from '../src/feedback/api'
import type { ActionId, FeedbackStatus, Lesson, MouthAnalysis, PracticeFeedback } from '../src/types'

// Server-side only: this module holds the API key and must never be imported
// by browser code. It is framework-agnostic so it can move from the Vite dev
// server to any Node backend unchanged.

export interface ClaudeConfig {
  apiKey: string
  model: string
}

export class FeedbackError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const STATUSES: FeedbackStatus[] = ['on_track', 'suggestion', 'acknowledged', 'insufficient_data']
const ACTION_IDS: ActionId[] = ['replay_reference', 'practice_lip_closure', 'practice_rounded_shape', 'practice_lip_teeth_position', 'record_again']
const MAX_SNAPSHOTS = 4
const MAX_SNAPSHOT_CHARS = 400_000
const JPEG_PREFIX = 'data:image/jpeg;base64,'

// Models that accept the server-side refusal fallback ("default" form).
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'])

const SYSTEM_PROMPT = `You give feedback in MouthCoach, a pronunciation practice aid for learners of American English. It is a training aid, not a medical or speech-therapy tool.

A learner recorded one attempt at a short word or phrase. You receive:
- the lesson: the target text, the visible mouth movement it practices, and the steps of the reference animation;
- lip measurements computed in the browser from MediaPipe face landmarks, relative to the learner's own resting mouth (width 1.0 = their rest width; opening is the inner-lip gap in face widths, where about 0.012 or less means the lips are together);
- local checks for the lesson's movements, with a detected / unclear / not_detected result;
- up to four mouth-only snapshots from the attempt (unmirrored), each labeled with its moment;
- sometimes the measurements from their previous attempt at the same lesson.

You do not receive audio, so you cannot judge sound, voicing or accent. Landmarks and still images are approximate, and the local checks can be wrong; look at the snapshots yourself and say what they show.

Write feedback that helps the learner practice the lesson's visible movement:
- observation: what the snapshots and measurements show about that movement, in one or two plain sentences, hedged ("appears", "looked"). Use only the evidence given. Never describe tongue position, which is not visible. If the face was not tracked well or the snapshots don't show the mouth clearly, set observation to null and status to insufficient_data.
- status: on_track when the target movement is clearly visible; suggestion when it is missing, partial or unclear; acknowledged when previous measurements are given and this attempt visibly moved closer to the target; insufficient_data as above.
- tip: one or two short, gentle sentences on what to try next. Ask only for comfortable, relaxed movements — never force, tension or exaggeration.
- evidence: up to three short references to what you relied on, such as "Snapshot 2: lips together" or "Width narrowed to 0.84 of rest".
- comparedToPrevious: one sentence comparing with the previous measurements when they are given, otherwise null.
- practiceFocus: two to four words naming the movement.
- actionId: the next step. Use the practice_* action that matches the lesson's movement to show the correction animation, replay_reference to watch the reference again, or record_again when the learner is on track.

Speak to the learner directly, in warm, plain American English. No scores, percentages, grades, clinical terms or claims about speech conditions. For "pea" and "bee", lip shape alone cannot tell /p/ from /b/, so don't claim which sound was made.`

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'practiceFocus', 'observation', 'evidence', 'tip', 'actionId', 'comparedToPrevious'],
  properties: {
    status: { type: 'string', enum: STATUSES },
    practiceFocus: { type: 'string' },
    observation: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    evidence: { type: 'array', items: { type: 'string' } },
    tip: { type: 'string' },
    actionId: { type: 'string', enum: ACTION_IDS },
    comparedToPrevious: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
} as const

interface ClaudeOutput {
  status: FeedbackStatus
  practiceFocus: string
  observation: string | null
  evidence: string[]
  tip: string
  actionId: ActionId
  comparedToPrevious: string | null
}

/** Validates the browser's request. Throws FeedbackError(400) when malformed. */
export function parseFeedbackRequest(body: unknown): FeedbackApiRequest & { lesson: Lesson } {
  const fail = (message: string): never => {
    throw new FeedbackError(400, message)
  }
  if (!body || typeof body !== 'object') fail('Expected a JSON object.')
  const request = body as Partial<FeedbackApiRequest>
  const lesson = typeof request.lessonId === 'string' ? lessonsById[request.lessonId] : undefined
  if (!lesson) fail('Unknown lesson.')
  const analysis = request.analysis as MouthAnalysis | undefined
  if (!analysis || typeof analysis !== 'object' || !Array.isArray(analysis.checks) || !Array.isArray(analysis.timeline)) {
    fail('Missing mouth analysis.')
  }
  const snapshots = Array.isArray(analysis!.snapshots) ? analysis!.snapshots : []
  if (snapshots.length > MAX_SNAPSHOTS) fail('Too many snapshots.')
  for (const snapshot of snapshots) {
    if (typeof snapshot?.dataUrl !== 'string' || !snapshot.dataUrl.startsWith(JPEG_PREFIX) || snapshot.dataUrl.length > MAX_SNAPSHOT_CHARS) {
      fail('Snapshots must be small JPEG images.')
    }
  }
  return {
    lesson: lesson!,
    lessonId: lesson!.id,
    attemptId: String(request.attemptId ?? ''),
    attemptNumber: Number(request.attemptNumber ?? 1),
    analysis: { ...analysis!, snapshots },
    previous: request.previous ?? null,
  }
}

function describeLesson(lesson: Lesson) {
  return {
    text: lesson.text,
    pronunciation: `${lesson.pronunciation.respelling} ${lesson.pronunciation.ipa}`,
    visibleMovement: `${lesson.target.label}: ${lesson.target.description}`,
    explanation: lesson.explanation,
    referenceSteps: lesson.timeline.map((k) => (k.sound ? `${k.sound} ${k.caption}` : k.caption)),
    correctionAction: lesson.correction.actionId,
    note: lesson.note ?? null,
  }
}

const withoutSnapshots = ({ snapshots: _snapshots, ...rest }: MouthAnalysis) => rest

/** Asks Claude for feedback on one attempt and maps the reply to PracticeFeedback. */
export async function createClaudeFeedback(config: ClaudeConfig, input: ReturnType<typeof parseFeedbackRequest>): Promise<PracticeFeedback> {
  const { lesson, analysis } = input
  const client = new Anthropic({ apiKey: config.apiKey, timeout: 60_000 })

  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  analysis.snapshots.forEach((snapshot, index) => {
    content.push({ type: 'text', text: `Snapshot ${index + 1}: ${snapshot.label}, at ${snapshot.t.toFixed(2)} s` })
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: snapshot.dataUrl.slice(JPEG_PREFIX.length) } })
  })
  content.push({
    type: 'text',
    text: JSON.stringify(
      {
        lesson: describeLesson(lesson),
        attemptNumber: input.attemptNumber,
        measurements: withoutSnapshots(analysis),
        previousAttemptMeasurements: input.previous,
      },
      null,
      1,
    ),
  })

  const useFallback = FALLBACK_MODELS.has(config.model)
  let response: Anthropic.Beta.BetaMessage
  try {
    response = await client.beta.messages.create({
      model: config.model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      ...(useFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new FeedbackError(502, 'The Claude API key was rejected. Check ANTHROPIC_API_KEY in .env.')
    if (error instanceof Anthropic.PermissionDeniedError) throw new FeedbackError(502, 'This API key cannot use the configured model.')
    if (error instanceof Anthropic.RateLimitError) throw new FeedbackError(429, 'Claude is busy right now. Please try again in a moment.')
    if (error instanceof Anthropic.BadRequestError) {
      // Billing problems arrive as a plain 400; give them a clear message.
      if (/credit balance/i.test(error.message)) {
        throw new FeedbackError(402, 'The Claude API account has no credits left. Add credits in the Anthropic Console (Plans & Billing), then try again.')
      }
      throw new FeedbackError(502, 'Claude could not process this request.')
    }
    if (error instanceof Anthropic.APIConnectionError) throw new FeedbackError(502, 'Could not reach the Claude API. Check your internet connection.')
    if (error instanceof Anthropic.APIError) throw new FeedbackError(502, `Claude API error (${error.status ?? 'unknown'}).`)
    throw error
  }

  if (response.stop_reason === 'refusal') throw new FeedbackError(502, 'Claude declined to give feedback on this attempt.')
  const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('')
  let output: ClaudeOutput
  try {
    output = JSON.parse(text) as ClaudeOutput
  } catch {
    throw new FeedbackError(502, 'Claude returned an unreadable reply.')
  }
  if (!STATUSES.includes(output.status) || !ACTION_IDS.includes(output.actionId)) {
    throw new FeedbackError(502, 'Claude returned an unexpected reply.')
  }

  return {
    source: 'claude',
    lessonId: lesson.id,
    status: output.status,
    practiceFocus: output.practiceFocus,
    observation: output.observation,
    evidence: output.evidence.slice(0, 3),
    tip: output.tip,
    actionId: output.actionId,
    comparedToPrevious: output.comparedToPrevious,
    isIllustrative: false,
    model: response.model,
    attemptId: input.attemptId,
  }
}
