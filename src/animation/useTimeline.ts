import { useCallback, useEffect, useRef, useState } from 'react'
import { timelineDuration } from '../data/lessons'
import type { Keyframe } from '../types'

export type PlaybackSpeed = 1 | 0.5

export interface TimelineControls {
  time: number
  duration: number
  progress: number
  playing: boolean
  finished: boolean
  play: () => void
  pause: () => void
  replay: () => void
  seek: (time: number) => void
}

/**
 * Drives a keyframe timeline with requestAnimationFrame. Resets whenever the
 * timeline object changes (for example, when a different lesson is selected
 * or correction mode is toggled).
 */
export function useTimeline(timeline: Keyframe[], speed: PlaybackSpeed): TimelineControls {
  const duration = timelineDuration(timeline)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timeRef = useRef(0)
  const speedRef = useRef(speed)
  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  // Reset when the timeline changes.
  const [prevTimeline, setPrevTimeline] = useState(timeline)
  if (prevTimeline !== timeline) {
    setPrevTimeline(timeline)
    setTime(0)
    setPlaying(false)
  }
  useEffect(() => {
    timeRef.current = 0
  }, [timeline])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const next = Math.min(duration, timeRef.current + (now - last) * speedRef.current)
      last = now
      timeRef.current = next
      setTime(next)
      if (next >= duration) {
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, duration])

  const play = useCallback(() => {
    if (timeRef.current >= duration) {
      timeRef.current = 0
      setTime(0)
    }
    setPlaying(true)
  }, [duration])

  const pause = useCallback(() => setPlaying(false), [])

  const replay = useCallback(() => {
    timeRef.current = 0
    setTime(0)
    setPlaying(true)
  }, [])

  const seek = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(duration, t))
      timeRef.current = clamped
      setTime(clamped)
    },
    [duration],
  )

  return {
    time,
    duration,
    progress: duration > 0 ? time / duration : 0,
    playing,
    finished: time >= duration && duration > 0,
    play,
    pause,
    replay,
    seek,
  }
}
