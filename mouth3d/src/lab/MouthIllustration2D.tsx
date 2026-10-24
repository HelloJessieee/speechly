import { useId } from 'react'
import { buildMouth, type MouthParams } from '../model/shapes'

interface MouthIllustrationProps {
  params: MouthParams
  label: string
}

/**
 * Copy of the original app's 2D MouthIllustration (without the correction
 * overlay), kept here to compare against the 3D model.
 *
 * Simplified front view of the lower face. All parts are plain SVG paths
 * computed from `params`, so new shapes only need new numbers. The interior is
 * drawn as a plain dark area: the illustration never shows tongue position.
 */
export function MouthIllustration2D({ params, label }: MouthIllustrationProps) {
  const id = useId()
  const g = buildMouth(params)
  const interiorClip = `${id}-interior`
  const teethClip = `${id}-teeth`

  return (
    <svg viewBox="0 0 400 300" role="img" aria-label={label} className="block h-auto w-full">
      <defs>
        <clipPath id={interiorClip}>
          <path d={g.interior} />
        </clipPath>
        <clipPath id={teethClip}>
          <path d={g.upperTeethClip} />
        </clipPath>
        <radialGradient id={`${id}-skin`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#f4dfcc" />
          <stop offset="100%" stopColor="#e9c9b0" />
        </radialGradient>
        <linearGradient id={`${id}-upper`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b25f67" />
          <stop offset="100%" stopColor="#a4525b" />
        </linearGradient>
        <linearGradient id={`${id}-lower`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c06c74" />
          <stop offset="100%" stopColor="#cf8189" />
        </linearGradient>
      </defs>

      {/* Lower face */}
      <ellipse cx="200" cy="96" rx="178" ry="214" fill={`url(#${id}-skin)`} />
      {/* Nose base */}
      <path d="M166 58 Q182 78 200 76 Q218 78 234 58" fill="none" stroke="#d4a98c" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="185" cy="66" rx="7" ry="3.5" fill="#cf9f83" opacity="0.6" />
      <ellipse cx="215" cy="66" rx="7" ry="3.5" fill="#cf9f83" opacity="0.6" />
      {/* Philtrum */}
      <path d={`M192 82 L190 ${g.outerTopY - 2}`} stroke="#dcb398" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <path d={`M208 82 L210 ${g.outerTopY - 2}`} stroke="#dcb398" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* Chin */}
      <path d="M150 268 Q200 290 250 268" fill="none" stroke="#d4a98c" strokeWidth="3" strokeLinecap="round" opacity="0.6" />

      {/* Mouth interior and teeth */}
      <path d={g.interior} fill="#4a1f27" />
      <g clipPath={`url(#${interiorClip})`}>
        <rect {...g.lowerTeeth} rx="3" fill="#f6efe4" />
      </g>

      <path d={g.lowerLip} fill={`url(#${id}-lower)`} />
      <path d={g.upperLip} fill={`url(#${id}-upper)`} />
      {/* Upper teeth are drawn over the lower lip so the /f/ contact is visible. */}
      <g clipPath={`url(#${teethClip})`}>
        <rect {...g.upperTeeth} rx="3" fill="#fffbf4" />
        <line x1="200" x2="200" y1={g.upperTeeth.y} y2={g.upperTeeth.y + g.upperTeeth.height} stroke="#e6ddcf" strokeWidth="1.5" />
      </g>
      <path d={g.lipLine} fill="none" stroke="#7d3a42" strokeWidth="1.6" strokeLinecap="round" opacity={params.open < 2 ? 0.9 : 0} />
      {/* Soft highlight on the lower lip */}
      <ellipse cx="200" cy={g.innerBottomY + params.lowerThickness * 0.45} rx={params.halfWidth * 0.35} ry="3" fill="#fff" opacity="0.18" />
    </svg>
  )
}
