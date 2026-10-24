import type { ActionId } from '../types'

/**
 * Maps feedback `actionId` values to predefined frontend behaviors. Any
 * provider can request one of these; the interface decides how to perform it.
 */
export type ActionBehavior = 'replay-reference' | 'show-correction' | 'reset-practice'

export interface ActionDefinition {
  behavior: ActionBehavior
  /** Button label for the next action. */
  label: string
  /** Short description of what the button does. */
  description: string
}

export const ACTIONS: Record<ActionId, ActionDefinition> = {
  replay_reference: {
    behavior: 'replay-reference',
    label: 'Watch the guidance',
    description: 'Replays the reference slowly with step-by-step highlights.',
  },
  practice_lip_closure: {
    behavior: 'show-correction',
    label: 'Watch the guidance',
    description: 'Shows a correction animation focused on gentle lip closure.',
  },
  practice_rounded_shape: {
    behavior: 'show-correction',
    label: 'Watch the guidance',
    description: 'Shows a correction animation focused on a rounded lip shape.',
  },
  practice_lip_teeth_position: {
    behavior: 'show-correction',
    label: 'Watch the guidance',
    description: 'Shows a correction animation focused on the lower lip and upper teeth.',
  },
  record_again: {
    behavior: 'reset-practice',
    label: 'Try again',
    description: 'Clears this attempt so you can record a new one.',
  },
}
