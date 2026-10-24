import { useId } from 'react'
import { buildMouth, SHAPES, type MouthGeometry } from '../animation/shapes'
import type { ArrowDirection, CorrectionGuide } from '../types'

interface CorrectionOverlayProps {
  guide: CorrectionGuide
  /** Geometry of the mouth as currently drawn, so highlights follow the lips. */
  current: MouthGeometry
}

const ARROW = '#2f6690'
const TARGET = '#2f6447'

/**
 * Visual guidance layered over the reference mouth in correction mode: a
 * dashed target outline, highlighted lip regions and directional arrows.
 * It illustrates the lesson's general suggestion; it does not describe the
 * learner's own mouth.
 */
export function CorrectionOverlay({ guide, current }: CorrectionOverlayProps) {
  const id = useId()
  const target = buildMouth(SHAPES[guide.targetShape])
  const marker = `${id}-head`

  const arrowLines = (direction: ArrowDirection): [number, number, number, number][] => {
    const cx = 200
    const cy = target.left.y
    switch (direction) {
      case 'close':
        return [
          [cx, target.outerTopY - 40, cx, target.outerTopY - 10],
          [cx, target.outerBottomY + 40, cx, target.outerBottomY + 10],
        ]
      case 'inward':
        return [
          [target.left.x - 52, cy, target.left.x - 12, cy],
          [target.right.x + 52, cy, target.right.x + 12, cy],
        ]
      case 'spread':
        return [
          [target.left.x - 8, cy, target.left.x - 46, cy],
          [target.right.x + 8, cy, target.right.x + 46, cy],
        ]
      case 'lowerLipUp':
        return [[cx, target.outerBottomY + 46, cx, target.outerBottomY + 12]]
    }
  }

  return (
    <g aria-hidden="true">
      <defs>
        <marker id={marker} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={ARROW} />
        </marker>
      </defs>

      {/* Highlighted lip regions */}
      <g className="mc-pulse">
        {(guide.highlight === 'upperLip' || guide.highlight === 'bothLips') && (
          <path d={current.upperLip} fill="rgba(47,102,144,0.18)" stroke={ARROW} strokeWidth="2.5" />
        )}
        {(guide.highlight === 'lowerLip' || guide.highlight === 'bothLips') && (
          <path d={current.lowerLip} fill="rgba(47,102,144,0.18)" stroke={ARROW} strokeWidth="2.5" />
        )}
        {guide.highlight === 'corners' && (
          <>
            <circle cx={current.left.x} cy={current.left.y} r="11" fill="rgba(47,102,144,0.2)" stroke={ARROW} strokeWidth="2.5" />
            <circle cx={current.right.x} cy={current.right.y} r="11" fill="rgba(47,102,144,0.2)" stroke={ARROW} strokeWidth="2.5" />
          </>
        )}
      </g>

      {/* Dashed target outline */}
      <path d={target.outline} fill="none" stroke={TARGET} strokeWidth="2.5" strokeDasharray="7 6" strokeLinejoin="round" />

      {/* Directional arrows */}
      {guide.arrows?.flatMap(arrowLines).map(([x1, y1, x2, y2], index) => (
        <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ARROW} strokeWidth="4" strokeLinecap="round" markerEnd={`url(#${marker})`} />
      ))}
    </g>
  )
}
