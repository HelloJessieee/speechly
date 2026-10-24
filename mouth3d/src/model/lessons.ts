import type { Keyframe } from './types'

// Lesson timelines copied from the original app's src/data/lessons.ts, so the
// 3D model can be checked against real lesson motion.

export interface LessonTimelines {
  id: string
  text: string
  timeline: Keyframe[]
  /** Slower timeline used in correction mode. */
  correction: Keyframe[]
}

export const LESSONS: LessonTimelines[] = 
[
  {
    "id": "me",
    "text": "me",
    "timeline": [
      {
        "at": 0,
        "shape": "rest",
        "caption": "Start from a relaxed mouth."
      },
      {
        "at": 500,
        "shape": "closed",
        "caption": "Lips meet gently for /m/.",
        "sound": "/m/"
      },
      {
        "at": 1300,
        "shape": "closed",
        "caption": "Hum softly with lips together.",
        "sound": "/m/"
      },
      {
        "at": 1750,
        "shape": "spread",
        "caption": "Open into “ee” with lips slightly spread.",
        "sound": "/i/"
      },
      {
        "at": 2600,
        "shape": "spread",
        "caption": "Hold the “ee” comfortably.",
        "sound": "/i/"
      },
      {
        "at": 3200,
        "shape": "rest",
        "caption": "Return to rest."
      }
    ],
    "correction": [
      {
        "at": 0,
        "shape": "rest",
        "caption": "Relax your face."
      },
      {
        "at": 900,
        "shape": "closed",
        "caption": "Bring the lips together gently.",
        "sound": "/m/"
      },
      {
        "at": 2400,
        "shape": "closed",
        "caption": "Hold lightly — no pressing needed.",
        "sound": "/m/"
      },
      {
        "at": 3200,
        "shape": "spread",
        "caption": "Open into “ee.”",
        "sound": "/i/"
      },
      {
        "at": 4200,
        "shape": "spread",
        "caption": "Now say “me.”",
        "sound": "/i/"
      }
    ]
  },
  {
    "id": "moon",
    "text": "moon",
    "timeline": [
      {
        "at": 0,
        "shape": "rest",
        "caption": "Start from a relaxed mouth."
      },
      {
        "at": 450,
        "shape": "closed",
        "caption": "Lips meet gently for /m/.",
        "sound": "/m/"
      },
      {
        "at": 1100,
        "shape": "closed",
        "caption": "Hum briefly.",
        "sound": "/m/"
      },
      {
        "at": 1600,
        "shape": "rounded",
        "caption": "Round the lips for “oo.”",
        "sound": "/u/"
      },
      {
        "at": 2600,
        "shape": "rounded",
        "caption": "Keep the rounded shape.",
        "sound": "/u/"
      },
      {
        "at": 3050,
        "shape": "open",
        "caption": "Relax the lips slightly for /n/.",
        "sound": "/n/"
      },
      {
        "at": 3600,
        "shape": "rest",
        "caption": "Return to rest."
      }
    ],
    "correction": [
      {
        "at": 0,
        "shape": "rest",
        "caption": "Relax your face."
      },
      {
        "at": 900,
        "shape": "closed",
        "caption": "Lips together for /m/.",
        "sound": "/m/"
      },
      {
        "at": 1800,
        "shape": "rounded",
        "caption": "Let the corners move gently inward.",
        "sound": "/u/"
      },
      {
        "at": 3600,
        "shape": "rounded",
        "caption": "Hold a soft, round shape.",
        "sound": "/u/"
      },
      {
        "at": 4400,
        "shape": "rest",
        "caption": "Now say “moon.”"
      }
    ]
  },
  {
    "id": "fish",
    "text": "fish",
    "timeline": [
      {
        "at": 0,
        "shape": "rest",
        "caption": "Start from a relaxed mouth."
      },
      {
        "at": 500,
        "shape": "lipTeeth",
        "caption": "Upper teeth rest on the lower lip for /f/.",
        "sound": "/f/"
      },
      {
        "at": 1400,
        "shape": "lipTeeth",
        "caption": "Let air flow gently.",
        "sound": "/f/"
      },
      {
        "at": 1850,
        "shape": "open",
        "caption": "Open slightly for the short “i.”",
        "sound": "/ɪ/"
      },
      {
        "at": 2350,
        "shape": "open",
        "caption": "Keep it short.",
        "sound": "/ɪ/"
      },
      {
        "at": 2800,
        "shape": "rounded",
        "caption": "Lips come forward a little for “sh.”",
        "sound": "/ʃ/"
      },
      {
        "at": 3500,
        "shape": "rounded",
        "caption": "Let the “sh” fade out.",
        "sound": "/ʃ/"
      },
      {
        "at": 4000,
        "shape": "rest",
        "caption": "Return to rest."
      }
    ],
    "correction": [
      {
        "at": 0,
        "shape": "rest",
        "caption": "Relax your face."
      },
      {
        "at": 1000,
        "shape": "lipTeeth",
        "caption": "Lower lip rises to meet the upper teeth.",
        "sound": "/f/"
      },
      {
        "at": 3000,
        "shape": "lipTeeth",
        "caption": "Blow air softly between lip and teeth.",
        "sound": "/f/"
      },
      {
        "at": 3700,
        "shape": "open",
        "caption": "Open into “i.”",
        "sound": "/ɪ/"
      },
      {
        "at": 4500,
        "shape": "rest",
        "caption": "Now say “fish.”"
      }
    ]
  },
  {
    "id": "pea",
    "text": "pea",
    "timeline": [
      {
        "at": 0,
        "shape": "rest",
        "caption": "Start from a relaxed mouth."
      },
      {
        "at": 450,
        "shape": "closed",
        "caption": "Lips close for /p/.",
        "sound": "/p/"
      },
      {
        "at": 1050,
        "shape": "closed",
        "caption": "Hold briefly, then release with a light puff.",
        "sound": "/p/"
      },
      {
        "at": 1350,
        "shape": "spread",
        "caption": "Open into “ee.”",
        "sound": "/i/"
      },
      {
        "at": 2300,
        "shape": "spread",
        "caption": "Hold the “ee” comfortably.",
        "sound": "/i/"
      },
      {
        "at": 2800,
        "shape": "rest",
        "caption": "Return to rest."
      }
    ],
    "correction": [
      {
        "at": 0,
        "shape": "rest",
        "caption": "Relax your face."
      },
      {
        "at": 900,
        "shape": "closed",
        "caption": "Lips come together.",
        "sound": "/p/"
      },
      {
        "at": 2200,
        "shape": "closed",
        "caption": "Release with a light puff of air.",
        "sound": "/p/"
      },
      {
        "at": 2600,
        "shape": "spread",
        "caption": "Open into “ee.”",
        "sound": "/i/"
      },
      {
        "at": 3800,
        "shape": "rest",
        "caption": "Now say “pea.”"
      }
    ]
  },
  {
    "id": "bee",
    "text": "bee",
    "timeline": [
      {
        "at": 0,
        "shape": "rest",
        "caption": "Start from a relaxed mouth."
      },
      {
        "at": 450,
        "shape": "closed",
        "caption": "Lips close for /b/.",
        "sound": "/b/"
      },
      {
        "at": 1050,
        "shape": "closed",
        "caption": "Turn your voice on as the lips part.",
        "sound": "/b/"
      },
      {
        "at": 1350,
        "shape": "spread",
        "caption": "Open into “ee.”",
        "sound": "/i/"
      },
      {
        "at": 2300,
        "shape": "spread",
        "caption": "Hold the “ee” comfortably.",
        "sound": "/i/"
      },
      {
        "at": 2800,
        "shape": "rest",
        "caption": "Return to rest."
      }
    ],
    "correction": [
      {
        "at": 0,
        "shape": "rest",
        "caption": "Relax your face."
      },
      {
        "at": 900,
        "shape": "closed",
        "caption": "Lips come together.",
        "sound": "/b/"
      },
      {
        "at": 2200,
        "shape": "closed",
        "caption": "Voice on as the lips part.",
        "sound": "/b/"
      },
      {
        "at": 2600,
        "shape": "spread",
        "caption": "Open into “ee.”",
        "sound": "/i/"
      },
      {
        "at": 3800,
        "shape": "rest",
        "caption": "Now say “bee.”"
      }
    ]
  },
  {
    "id": "see-me",
    "text": "See me.",
    "timeline": [
      {
        "at": 0,
        "shape": "rest",
        "caption": "Start from a relaxed mouth."
      },
      {
        "at": 450,
        "shape": "teethTogether",
        "caption": "Teeth close together, lips slightly spread for /s/.",
        "sound": "/s/"
      },
      {
        "at": 1150,
        "shape": "teethTogether",
        "caption": "Let the /s/ hiss softly.",
        "sound": "/s/"
      },
      {
        "at": 1500,
        "shape": "spread",
        "caption": "Open into “ee.”",
        "sound": "/i/"
      },
      {
        "at": 2100,
        "shape": "spread",
        "caption": "“See…”",
        "sound": "/i/"
      },
      {
        "at": 2450,
        "shape": "closed",
        "caption": "Lips meet gently for /m/.",
        "sound": "/m/"
      },
      {
        "at": 2950,
        "shape": "closed",
        "caption": "Hum briefly.",
        "sound": "/m/"
      },
      {
        "at": 3300,
        "shape": "spread",
        "caption": "Open into “ee” again.",
        "sound": "/i/"
      },
      {
        "at": 4000,
        "shape": "spread",
        "caption": "“…me.”",
        "sound": "/i/"
      },
      {
        "at": 4500,
        "shape": "rest",
        "caption": "Return to rest."
      }
    ],
    "correction": [
      {
        "at": 0,
        "shape": "rest",
        "caption": "Relax your face."
      },
      {
        "at": 800,
        "shape": "teethTogether",
        "caption": "/s/ — teeth close, lips slightly spread.",
        "sound": "/s/"
      },
      {
        "at": 1800,
        "shape": "spread",
        "caption": "“ee.”",
        "sound": "/i/"
      },
      {
        "at": 2700,
        "shape": "closed",
        "caption": "/m/ — lips meet gently.",
        "sound": "/m/"
      },
      {
        "at": 3900,
        "shape": "closed",
        "caption": "Hold lightly.",
        "sound": "/m/"
      },
      {
        "at": 4600,
        "shape": "spread",
        "caption": "“ee.”",
        "sound": "/i/"
      },
      {
        "at": 5400,
        "shape": "rest",
        "caption": "Now say “See me.”"
      }
    ]
  }
]

export function timelineDuration(timeline: { at: number }[]): number {
  return timeline.length ? timeline[timeline.length - 1].at : 0
}
