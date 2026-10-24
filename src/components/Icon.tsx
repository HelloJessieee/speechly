// Small inline icon set (stroke icons, 24×24) so no icon font or network
// request is needed. Icons are decorative; buttons carry their own text.

const PATHS = {
  play: 'M7 5v14l11-7z',
  pause: 'M8 5v14M16 5v14',
  replay: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  prev: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  speaker: 'M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  lightbulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  camera: 'M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  record: 'M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0',
  stop: 'M7 7h10v10H7z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  check: 'M5 12l5 5 9-10',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-5M12 8h.01',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  power: 'M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0',
  lessons: 'M4 5h16M4 12h16M4 19h10',
} as const

export type IconName = keyof typeof PATHS

const FILLED: IconName[] = ['play', 'record', 'stop']

export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  const filled = FILLED.includes(name)
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
