import { useCallback, useEffect, useState } from 'react'

export interface ReferenceAudio {
  available: boolean
  speaking: boolean
  voiceName: string | null
  speak: (text: string, slow: boolean) => void
  cancel: () => void
}

function findVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  const enUS = voices.filter((voice) => voice.lang.replace('_', '-').toLowerCase() === 'en-us')
  // Prefer voices that run on the device so no audio leaves the browser.
  return enUS.find((voice) => voice.localService) ?? null
}

/**
 * Optional reference audio using a local en-US browser voice. When no such
 * voice exists, `available` is false and the UI falls back to text and
 * animation only.
 */
export function useReferenceAudio(): ReferenceAudio {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(() => (supported ? findVoice() : null))
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (!supported) return
    const update = () => setVoice(findVoice())
    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', update)
      window.speechSynthesis.cancel()
    }
  }, [supported])

  const cancel = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text: string, slow: boolean) => {
      if (!supported || !voice) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.voice = voice
      utterance.lang = 'en-US'
      utterance.rate = slow ? 0.6 : 0.9
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utterance)
    },
    [supported, voice],
  )

  return { available: supported && voice !== null, speaking, voiceName: voice?.name ?? null, speak, cancel }
}
