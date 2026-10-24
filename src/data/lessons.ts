import type { Lesson, LessonId } from '../types'

// Manually authored teaching timelines. These are instructional illustrations
// of visible lip movement, not anatomical simulations, and they never depict
// tongue position.

export const lessons: Lesson[] = [
  {
    id: 'me',
    text: 'me',
    pronunciation: { respelling: 'MEE', ipa: '/mi/' },
    explanation:
      'Start with your lips gently together for /m/. Let the sound hum through your nose, then open softly into a relaxed “ee.”',
    target: { label: 'Lip closure for /m/', description: 'Both lips meet lightly, then part.' },
    timeline: [
      { at: 0, shape: 'rest', caption: 'Start from a relaxed mouth.' },
      { at: 500, shape: 'closed', caption: 'Lips meet gently for /m/.', sound: '/m/' },
      { at: 1300, shape: 'closed', caption: 'Hum softly with lips together.', sound: '/m/' },
      { at: 1750, shape: 'spread', caption: 'Open into “ee” with lips slightly spread.', sound: '/i/' },
      { at: 2600, shape: 'spread', caption: 'Hold the “ee” comfortably.', sound: '/i/' },
      { at: 3200, shape: 'rest', caption: 'Return to rest.' },
    ],
    tip: 'Keep the lip contact light — a soft touch is enough for /m/.',
    visualChecks: ['closure', 'spread'],
    correction: {
      actionId: 'practice_lip_closure',
      instruction: 'Let your lips meet softly for /m/, then open into “ee.”',
      targetShape: 'closed',
      highlight: 'bothLips',
      arrows: ['close'],
      timeline: [
        { at: 0, shape: 'rest', caption: 'Relax your face.' },
        { at: 900, shape: 'closed', caption: 'Bring the lips together gently.', sound: '/m/' },
        { at: 2400, shape: 'closed', caption: 'Hold lightly — no pressing needed.', sound: '/m/' },
        { at: 3200, shape: 'spread', caption: 'Open into “ee.”', sound: '/i/' },
        { at: 4200, shape: 'spread', caption: 'Now say “me.”', sound: '/i/' },
      ],
    },
    demoFeedback: {
      suggestion: {
        practiceFocus: 'Lip closure',
        tip: 'Try letting your lips meet fully but gently before the vowel, then repeat “me.”',
      },
      acknowledgement: {
        practiceFocus: 'Lip closure',
        tip: 'You tried again — this is where MouthCoach would acknowledge a change. Replay your attempt and check for yourself: do your lips meet softly before “ee”?',
      },
    },
  },
  {
    id: 'moon',
    text: 'moon',
    pronunciation: { respelling: 'MOON', ipa: '/mun/' },
    explanation:
      'Close your lips for /m/, then move into a rounded “oo.” The lips form a small, relaxed circle and come slightly forward.',
    target: { label: 'Rounded vowel /u/', description: 'Lips form a small, relaxed circle.' },
    timeline: [
      { at: 0, shape: 'rest', caption: 'Start from a relaxed mouth.' },
      { at: 450, shape: 'closed', caption: 'Lips meet gently for /m/.', sound: '/m/' },
      { at: 1100, shape: 'closed', caption: 'Hum briefly.', sound: '/m/' },
      { at: 1600, shape: 'rounded', caption: 'Round the lips for “oo.”', sound: '/u/' },
      { at: 2600, shape: 'rounded', caption: 'Keep the rounded shape.', sound: '/u/' },
      { at: 3050, shape: 'open', caption: 'Relax the lips slightly for /n/.', sound: '/n/' },
      { at: 3600, shape: 'rest', caption: 'Return to rest.' },
    ],
    tip: 'Think of a gentle, small circle — comfortable, not tight.',
    visualChecks: ['closure', 'rounding'],
    correction: {
      actionId: 'practice_rounded_shape',
      instruction: 'Try gently rounding your lips while practicing /u/.',
      targetShape: 'rounded',
      highlight: 'corners',
      arrows: ['inward'],
      timeline: [
        { at: 0, shape: 'rest', caption: 'Relax your face.' },
        { at: 900, shape: 'closed', caption: 'Lips together for /m/.', sound: '/m/' },
        { at: 1800, shape: 'rounded', caption: 'Let the corners move gently inward.', sound: '/u/' },
        { at: 3600, shape: 'rounded', caption: 'Hold a soft, round shape.', sound: '/u/' },
        { at: 4400, shape: 'rest', caption: 'Now say “moon.”' },
      ],
    },
    demoFeedback: {
      suggestion: {
        practiceFocus: 'Rounded vowel',
        tip: 'Try gently rounding your lips, then repeat “moon.”',
      },
      acknowledgement: {
        practiceFocus: 'Rounded vowel',
        tip: 'You tried again — this is where MouthCoach would acknowledge a change. Replay your attempt and check for yourself: does “oo” use a soft, rounded lip shape?',
      },
    },
  },
  {
    id: 'fish',
    text: 'fish',
    pronunciation: { respelling: 'FISH', ipa: '/fɪʃ/' },
    explanation:
      'For /f/, your upper teeth rest lightly on your lower lip while air flows out. Then open into a short “i” and finish with a soft “sh.”',
    target: { label: 'Lip–teeth contact for /f/', description: 'Upper teeth touch the lower lip lightly.' },
    timeline: [
      { at: 0, shape: 'rest', caption: 'Start from a relaxed mouth.' },
      { at: 500, shape: 'lipTeeth', caption: 'Upper teeth rest on the lower lip for /f/.', sound: '/f/' },
      { at: 1400, shape: 'lipTeeth', caption: 'Let air flow gently.', sound: '/f/' },
      { at: 1850, shape: 'open', caption: 'Open slightly for the short “i.”', sound: '/ɪ/' },
      { at: 2350, shape: 'open', caption: 'Keep it short.', sound: '/ɪ/' },
      { at: 2800, shape: 'rounded', caption: 'Lips come forward a little for “sh.”', sound: '/ʃ/' },
      { at: 3500, shape: 'rounded', caption: 'Let the “sh” fade out.', sound: '/ʃ/' },
      { at: 4000, shape: 'rest', caption: 'Return to rest.' },
    ],
    tip: 'The contact is light. Your lower lip simply meets the edge of your upper teeth.',
    visualChecks: ['lipTeeth'],
    correction: {
      actionId: 'practice_lip_teeth_position',
      instruction: 'Try resting your upper teeth lightly on your lower lip for /f/.',
      targetShape: 'lipTeeth',
      highlight: 'lowerLip',
      arrows: ['lowerLipUp'],
      timeline: [
        { at: 0, shape: 'rest', caption: 'Relax your face.' },
        { at: 1000, shape: 'lipTeeth', caption: 'Lower lip rises to meet the upper teeth.', sound: '/f/' },
        { at: 3000, shape: 'lipTeeth', caption: 'Blow air softly between lip and teeth.', sound: '/f/' },
        { at: 3700, shape: 'open', caption: 'Open into “i.”', sound: '/ɪ/' },
        { at: 4500, shape: 'rest', caption: 'Now say “fish.”' },
      ],
    },
    demoFeedback: {
      suggestion: {
        practiceFocus: 'Lip–teeth position',
        tip: 'Try placing your upper teeth lightly on your lower lip at the start, then repeat “fish.”',
      },
      acknowledgement: {
        practiceFocus: 'Lip–teeth position',
        tip: 'You tried again — this is where MouthCoach would acknowledge a change. Replay your attempt and check for yourself: is there a light lip–teeth touch at the start of “fish”?',
      },
    },
  },
  {
    id: 'pea',
    text: 'pea',
    pronunciation: { respelling: 'PEE', ipa: '/pi/' },
    explanation:
      'Close your lips, then release them with a small puff of air for /p/, opening into “ee.”',
    target: { label: 'Lip closure and release', description: 'Lips close, then part with a light puff of air.' },
    note: '“Pea” and “bee” look almost the same on the lips. The difference is voicing: /p/ is voiceless with a light puff of air, while /b/ uses your voice from the start. Lip shape alone cannot show which one you said.',
    timeline: [
      { at: 0, shape: 'rest', caption: 'Start from a relaxed mouth.' },
      { at: 450, shape: 'closed', caption: 'Lips close for /p/.', sound: '/p/' },
      { at: 1050, shape: 'closed', caption: 'Hold briefly, then release with a light puff.', sound: '/p/' },
      { at: 1350, shape: 'spread', caption: 'Open into “ee.”', sound: '/i/' },
      { at: 2300, shape: 'spread', caption: 'Hold the “ee” comfortably.', sound: '/i/' },
      { at: 2800, shape: 'rest', caption: 'Return to rest.' },
    ],
    tip: 'Hold a tissue or your hand near your mouth — you may feel a small puff of air on /p/.',
    visualChecks: ['closure', 'spread'],
    correction: {
      actionId: 'practice_lip_closure',
      instruction: 'Close your lips gently, then release them with a light puff of air for /p/.',
      targetShape: 'closed',
      highlight: 'bothLips',
      arrows: ['close'],
      timeline: [
        { at: 0, shape: 'rest', caption: 'Relax your face.' },
        { at: 900, shape: 'closed', caption: 'Lips come together.', sound: '/p/' },
        { at: 2200, shape: 'closed', caption: 'Release with a light puff of air.', sound: '/p/' },
        { at: 2600, shape: 'spread', caption: 'Open into “ee.”', sound: '/i/' },
        { at: 3800, shape: 'rest', caption: 'Now say “pea.”' },
      ],
    },
    demoFeedback: {
      suggestion: {
        practiceFocus: 'Lip closure and release',
        tip: 'Try a full, gentle lip closure before releasing into “ee,” then repeat “pea.” Remember that the /p/–/b/ difference comes from voicing, not lip shape.',
      },
      acknowledgement: {
        practiceFocus: 'Lip closure and release',
        tip: 'You tried again — this is where MouthCoach would acknowledge a change. Check in a mirror: do your lips close fully before “ee”? Feel for the light puff of air on /p/.',
      },
    },
  },
  {
    id: 'bee',
    text: 'bee',
    pronunciation: { respelling: 'BEE', ipa: '/bi/' },
    explanation:
      'Close your lips and start using your voice right away for /b/, then open into “ee.”',
    target: { label: 'Lip closure with voice', description: 'Lips close and part while your voice is already on.' },
    note: '“Bee” and “pea” look almost the same on the lips. The difference is voicing: /b/ uses your voice from the start, while /p/ is voiceless with a light puff of air. Lip shape alone cannot show which one you said.',
    timeline: [
      { at: 0, shape: 'rest', caption: 'Start from a relaxed mouth.' },
      { at: 450, shape: 'closed', caption: 'Lips close for /b/.', sound: '/b/' },
      { at: 1050, shape: 'closed', caption: 'Turn your voice on as the lips part.', sound: '/b/' },
      { at: 1350, shape: 'spread', caption: 'Open into “ee.”', sound: '/i/' },
      { at: 2300, shape: 'spread', caption: 'Hold the “ee” comfortably.', sound: '/i/' },
      { at: 2800, shape: 'rest', caption: 'Return to rest.' },
    ],
    tip: 'Place your fingers lightly on your throat — you may feel a gentle buzz on /b/ that you will not feel on /p/.',
    visualChecks: ['closure', 'spread'],
    correction: {
      actionId: 'practice_lip_closure',
      instruction: 'Close your lips gently and let your voice start as they part for /b/.',
      targetShape: 'closed',
      highlight: 'bothLips',
      arrows: ['close'],
      timeline: [
        { at: 0, shape: 'rest', caption: 'Relax your face.' },
        { at: 900, shape: 'closed', caption: 'Lips come together.', sound: '/b/' },
        { at: 2200, shape: 'closed', caption: 'Voice on as the lips part.', sound: '/b/' },
        { at: 2600, shape: 'spread', caption: 'Open into “ee.”', sound: '/i/' },
        { at: 3800, shape: 'rest', caption: 'Now say “bee.”' },
      ],
    },
    demoFeedback: {
      suggestion: {
        practiceFocus: 'Lip closure with voice',
        tip: 'Try closing your lips gently and starting your voice right away, then repeat “bee.” Lip shape looks the same as in “pea.”',
      },
      acknowledgement: {
        practiceFocus: 'Lip closure with voice',
        tip: 'You tried again — this is where MouthCoach would acknowledge a change. Check in a mirror: do your lips close fully before “ee”? Feel for the gentle buzz of voice on /b/.',
      },
    },
  },
  {
    id: 'see-me',
    text: 'See me.',
    pronunciation: { respelling: 'SEE mee', ipa: '/si mi/' },
    explanation:
      'A short phrase with a sequence of shapes: teeth close together with slightly spread lips for /s/, “ee,” lips together for /m/, then “ee” again.',
    target: { label: 'Movement sequence', description: 'Spread → closed → spread, with a smooth transition.' },
    timeline: [
      { at: 0, shape: 'rest', caption: 'Start from a relaxed mouth.' },
      { at: 450, shape: 'teethTogether', caption: 'Teeth close together, lips slightly spread for /s/.', sound: '/s/' },
      { at: 1150, shape: 'teethTogether', caption: 'Let the /s/ hiss softly.', sound: '/s/' },
      { at: 1500, shape: 'spread', caption: 'Open into “ee.”', sound: '/i/' },
      { at: 2100, shape: 'spread', caption: '“See…”', sound: '/i/' },
      { at: 2450, shape: 'closed', caption: 'Lips meet gently for /m/.', sound: '/m/' },
      { at: 2950, shape: 'closed', caption: 'Hum briefly.', sound: '/m/' },
      { at: 3300, shape: 'spread', caption: 'Open into “ee” again.', sound: '/i/' },
      { at: 4000, shape: 'spread', caption: '“…me.”', sound: '/i/' },
      { at: 4500, shape: 'rest', caption: 'Return to rest.' },
    ],
    tip: 'Say it as one smooth phrase. The lips only need to close once, for /m/.',
    visualChecks: ['closure', 'spread'],
    correction: {
      actionId: 'replay_reference',
      instruction: 'Watch the sequence slowly: notice the lips close once, for /m/, between the two “ee” sounds.',
      targetShape: 'closed',
      highlight: 'bothLips',
      arrows: ['close'],
      timeline: [
        { at: 0, shape: 'rest', caption: 'Relax your face.' },
        { at: 800, shape: 'teethTogether', caption: '/s/ — teeth close, lips slightly spread.', sound: '/s/' },
        { at: 1800, shape: 'spread', caption: '“ee.”', sound: '/i/' },
        { at: 2700, shape: 'closed', caption: '/m/ — lips meet gently.', sound: '/m/' },
        { at: 3900, shape: 'closed', caption: 'Hold lightly.', sound: '/m/' },
        { at: 4600, shape: 'spread', caption: '“ee.”', sound: '/i/' },
        { at: 5400, shape: 'rest', caption: 'Now say “See me.”' },
      ],
    },
    demoFeedback: {
      suggestion: {
        practiceFocus: 'Movement sequence',
        tip: 'Try watching the slow sequence, then repeat “See me” as one smooth phrase with a gentle lip closure for /m/.',
      },
      acknowledgement: {
        practiceFocus: 'Movement sequence',
        tip: 'You tried again — this is where MouthCoach would acknowledge a change. Replay your attempt and check for yourself: does “See me” flow as one phrase, with one gentle lip closure?',
      },
    },
  },
]

export const lessonsById: Record<LessonId, Lesson> = Object.fromEntries(
  lessons.map((lesson) => [lesson.id, lesson]),
) as Record<LessonId, Lesson>

export function timelineDuration(timeline: { at: number }[]): number {
  return timeline[timeline.length - 1]?.at ?? 0
}
