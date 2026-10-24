/** Live microphone signal level. Loudness only — not a pronunciation measure. */
export function LevelMeter({ level, active }: { level: number; active: boolean }) {
  const bars = 16
  const lit = Math.round(level * bars)
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-sm font-semibold text-ink-soft">Microphone level</span>
      <div
        role="meter"
        aria-label="Microphone signal level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        className="flex h-5 flex-1 items-end gap-[3px]"
      >
        {Array.from({ length: bars }, (_, index) => (
          <span
            key={index}
            className={`flex-1 rounded-sm transition-[height] duration-75 ${
              active && index < lit ? (index > bars * 0.8 ? 'bg-amber-ink' : 'bg-sage') : 'bg-line'
            }`}
            style={{ height: `${35 + (index / bars) * 65}%` }}
          />
        ))}
      </div>
    </div>
  )
}
