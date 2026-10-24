// Build log for the 3D mouth, shown on the lab page. Update as work lands.

export type MilestoneStatus = 'done' | 'in-progress' | 'next'

export interface Milestone {
  title: string
  status: MilestoneStatus
  detail: string
}

export const MILESTONES: Milestone[] = [
  {
    title: 'Static 3D model of every mouth shape',
    status: 'done',
    detail: 'Procedural lips, skin, teeth and a dark interior, built from the same MouthParams as the 2D drawing.',
  },
  {
    title: 'Drag to turn, scroll to zoom',
    status: 'done',
    detail: 'Turning is limited to about ±80° sideways and ±40° up/down. Arrow keys also turn it; Home returns to the front.',
  },
  {
    title: 'Plays the lesson timelines',
    status: 'done',
    detail: 'Plays the lesson timelines copied from the original app, at normal or slow speed.',
  },
  {
    title: 'Lip protrusion (pushing the lips forward)',
    status: 'in-progress',
    detail: 'For now it is worked out from roundness. Next: give each shape its own value in SHAPES and tune the rounded lessons.',
  },
  {
    title: 'Cartoon look from the reference sheet',
    status: 'done',
    detail: 'Peach skin with rosy cheeks, plump glossy coral lips with a clear cupid’s bow, smooth white teeth, a small button nose, and a face that fades softly at the edges.',
  },
  {
    title: 'Fuller side view',
    status: 'done',
    detail: 'Each lip is now a closed, rounded volume, so it looks solid in profile instead of like a thin flap.',
  },
  {
    title: 'Port to the SwiftUI app',
    status: 'next',
    detail: 'surface.ts is plain math with no web code, so it can be rewritten in Swift and drawn with SceneKit or RealityKit.',
  },
]
