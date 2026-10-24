import type { DeviceStatus } from '../media/useMediaCapture'

const LABELS: Record<DeviceStatus, string> = {
  'not-requested': 'Off',
  requesting: 'Waiting for permission…',
  ready: 'On',
  denied: 'Permission denied',
  'not-found': 'Not found',
  unsupported: 'Not supported',
  error: 'Error',
}

const TONES: Record<DeviceStatus, string> = {
  'not-requested': 'bg-white/60 text-ink-soft',
  requesting: 'bg-sky-soft text-sky',
  ready: 'bg-sage-soft text-sage-dark',
  denied: 'bg-amber-soft text-amber-ink',
  'not-found': 'bg-amber-soft text-amber-ink',
  unsupported: 'bg-amber-soft text-amber-ink',
  error: 'bg-amber-soft text-amber-ink',
}

export function StatusPill({ device, status }: { device: string; status: DeviceStatus }) {
  const text = LABELS[status]
  const tone = TONES[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${tone}`}>
      <span aria-hidden="true" className={`size-2 rounded-full ${status === 'ready' ? 'bg-sage' : 'bg-current opacity-60'}`} />
      {device}: {text}
    </span>
  )
}
