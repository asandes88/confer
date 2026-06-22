import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal typings for the Web Speech API (not in lib.dom by default everywhere)
interface SpeechRecognitionAlternative {
  transcript: string
}
interface SpeechRecognitionResult {
  isFinal: boolean
  0: SpeechRecognitionAlternative
}
interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const speechSupported = (): boolean => getCtor() !== null

export interface UseSpeech {
  listening: boolean
  interim: string
  supported: boolean
  error: string | null
  /** Start listening. onFinal fires with each finalized utterance. */
  start: (lang: string, onFinal: (text: string) => void) => void
  stop: () => void
}

export function useSpeech(): UseSpeech {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const onFinalRef = useRef<(t: string) => void>(() => {})
  const langRef = useRef('en-US')
  const wantRef = useRef(false) // whether we intend to keep listening

  const stop = useCallback(() => {
    wantRef.current = false
    setListening(false)
    setInterim('')
    recRef.current?.stop()
  }, [])

  const start = useCallback((lang: string, onFinal: (text: string) => void) => {
    const Ctor = getCtor()
    if (!Ctor) {
      setError('Speech recognition is not supported in this browser. Use Chrome or Edge.')
      return
    }
    onFinalRef.current = onFinal
    langRef.current = lang
    wantRef.current = true
    setError(null)

    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const text = res[0].transcript
        if (res.isFinal) {
          const clean = text.trim()
          if (clean) onFinalRef.current(clean)
        } else {
          interimText += text
        }
      }
      setInterim(interimText)
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone access was blocked. Allow mic permission and try again.')
        wantRef.current = false
        setListening(false)
      } else {
        setError(`Speech error: ${e.error}`)
      }
    }

    // Chrome stops automatically after ~60s of silence; restart while we still want to listen.
    rec.onend = () => {
      setInterim('')
      if (wantRef.current) {
        try {
          rec.start()
        } catch {
          /* already started */
        }
      } else {
        setListening(false)
      }
    }

    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      /* start may throw if called twice */
    }
  }, [])

  useEffect(() => {
    return () => {
      wantRef.current = false
      recRef.current?.abort()
    }
  }, [])

  return { listening, interim, supported: speechSupported(), error, start, stop }
}
