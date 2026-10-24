import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { FEEDBACK_ENDPOINT, type FeedbackApiResponse, type FeedbackApiStatus } from '../src/feedback/api'
import { createClaudeFeedback, FeedbackError, parseFeedbackRequest, type ClaudeConfig } from './claudeFeedback'

const MAX_BODY_BYTES = 3 * 1024 * 1024

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new FeedbackError(413, 'Request too large.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new FeedbackError(400, 'Invalid JSON.'))
      }
    })
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: FeedbackApiResponse | FeedbackApiStatus) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

/**
 * Serves the feedback API from the Vite dev and preview servers so the Claude
 * API key stays on the server. GET /api/feedback/status reports availability;
 * POST /api/feedback returns feedback for one attempt.
 */
export function feedbackApi(config: { apiKey: string | undefined; model: string }): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const path = (req.url ?? '/').split('?')[0]
    if (req.method === 'GET' && path === '/status') {
      send(res, 200, { available: Boolean(config.apiKey), model: config.apiKey ? config.model : null })
      return
    }
    if (req.method !== 'POST' || path !== '/') {
      next()
      return
    }
    if (!config.apiKey) {
      send(res, 503, { ok: false, error: 'Claude feedback is not set up. Add ANTHROPIC_API_KEY to .env and restart the server.' })
      return
    }
    const claude: ClaudeConfig = { apiKey: config.apiKey, model: config.model }
    readJson(req)
      .then((body) => createClaudeFeedback(claude, parseFeedbackRequest(body)))
      .then((feedback) => send(res, 200, { ok: true, feedback }))
      .catch((error: unknown) => {
        const status = error instanceof FeedbackError ? error.status : 500
        const message = error instanceof FeedbackError ? error.message : 'Something went wrong while preparing feedback.'
        if (!(error instanceof FeedbackError)) console.error('[feedback]', error)
        send(res, status, { ok: false, error: message })
      })
  }

  return {
    name: 'mouthcoach-feedback-api',
    configureServer(server) {
      server.middlewares.use(FEEDBACK_ENDPOINT, handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(FEEDBACK_ENDPOINT, handler)
    },
  }
}
