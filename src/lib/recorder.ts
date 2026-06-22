import { useCallback, useEffect, useRef, useState } from 'react'

// Audio is recorded in the browser (works on iOS/Android/desktop) and sent to the
// Worker's /transcribe endpoint, which runs Whisper via Cloudflare Workers AI.
const PROXY_URL = (import.meta.env.VITE_PROXY_URL ?? '').trim().replace(/\/+$/, '')

/** Transcription requires the Worker; true when a proxy URL is configured. */
export const transcriptionConfigured = PROXY_URL.length > 0

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/mpeg']
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c
    } catch {
      /* ignore */
    }
  }
  return ''
}

export interface UseRecorder {
  recording: boolean
  transcribing: boolean
  seconds: number
  error: string | null
  supported: boolean
  start: (onText: (text: string) => void) => Promise<void>
  stop: () => void
}

export function useRecorder(): UseRecorder {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const onTextRef = useRef<(t: string) => void>(() => {})
  const mimeRef = useRef<string>('')
  const timerRef = useRef<number | undefined>(undefined)

  const supported =
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = undefined
    }
  }

  const start = useCallback(
    async (onText: (text: string) => void) => {
      setError(null)
      if (!transcriptionConfigured) {
        setError('Transcription needs the proxy Worker (VITE_PROXY_URL is not set).')
        return
      }
      if (!supported) {
        setError('Audio recording is not supported in this browser.')
        return
      }
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        setError('Microphone access was blocked. Allow mic permission and try again.')
        return
      }
      streamRef.current = stream
      const mime = pickMime()
      mimeRef.current = mime
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      onTextRef.current = onText

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        const blob = new Blob(chunksRef.current, { type: mimeRef.current || 'audio/webm' })
        if (blob.size === 0) {
          setError('No audio captured. Try again.')
          return
        }
        setTranscribing(true)
        try {
          const res = await fetch(`${PROXY_URL}/transcribe`, {
            method: 'POST',
            headers: { 'content-type': blob.type || 'application/octet-stream' },
            body: blob,
          })
          if (!res.ok) {
            let msg = `Transcription failed (${res.status})`
            try {
              const j = await res.json()
              if (j?.error) msg = j.error
            } catch {
              /* ignore */
            }
            throw new Error(msg)
          }
          const data = (await res.json()) as { text?: string }
          const text = (data.text ?? '').trim()
          if (text) onTextRef.current(text)
          else setError('No speech detected — try speaking a bit longer.')
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Transcription failed')
        } finally {
          setTranscribing(false)
        }
      }

      mr.start()
      mrRef.current = mr
      setRecording(true)
      setSeconds(0)
      clearTimer()
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    },
    [supported],
  )

  const stop = useCallback(() => {
    clearTimer()
    setRecording(false)
    if (mrRef.current && mrRef.current.state !== 'inactive') {
      mrRef.current.stop()
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTimer()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { recording, transcribing, seconds, error, supported, start, stop }
}
