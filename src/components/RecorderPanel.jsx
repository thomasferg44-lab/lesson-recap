import { useState, useRef, useEffect } from 'react'
import { Mic, Square, CheckCircle, Settings } from 'lucide-react'

function formatTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function RecorderPanel({ onAudioReady, appState, onStateChange, pulsing = false }) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [hasRecording, setHasRecording] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [audioBlobUrl, setAudioBlobUrl] = useState(null)
  const [recordedDuration, setRecordedDuration] = useState('')

  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const recordingTimeRef = useRef(0)
  const audioRef = useRef(null)

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      clearInterval(timerRef.current)
    }
  }, [])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setPermissionDenied(false)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        setAudioBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
        setRecordedDuration(formatTime(recordingTimeRef.current))
        setHasRecording(true)
        onAudioReady(blob)
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      mediaRecorder.start()
      recordingTimeRef.current = 0
      setRecordingTime(0)
      setIsRecording(true)
      onStateChange('recording')

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1
          recordingTimeRef.current = next
          return next
        })
      }, 1000)
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true)
      }
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    onStateChange('idle')
  }

  function handleReRecord() {
    setAudioBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setHasRecording(false)
    setRecordingTime(0)
    setRecordedDuration('')
    recordingTimeRef.current = 0
    onAudioReady(null)
  }

  function handlePlayback() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      el.play()
    } else {
      el.pause()
      el.currentTime = 0
    }
  }

  const isDisabled = appState === 'processing' || appState === 'done'

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
        Voice Recap
      </h2>

      <div
        className={`flex flex-col items-center gap-4 py-6 transition-opacity ${
          isDisabled ? 'opacity-40 pointer-events-none' : ''
        }`}
      >
        {/* Permission denied */}
        {permissionDenied && (
          <div className="text-center px-4">
            <Settings className="mx-auto mb-2 text-gray-400" size={32} />
            <p className="text-sm text-red-600">
              Microphone access required. Please allow microphone access in your browser settings.
            </p>
          </div>
        )}

        {/* Idle — no recording yet */}
        {!permissionDenied && !isRecording && !hasRecording && (
          <>
            <div className="relative flex items-center justify-center">
              {/* Validation pulse — red ring when user tries to generate without a recording */}
              {pulsing && (
                <span className="absolute inline-flex w-24 h-24 rounded-full bg-red-400 animate-pulse-ring" />
              )}
              <button
                onClick={startRecording}
                className="relative w-20 h-20 rounded-full flex items-center justify-center text-white shadow-md hover:opacity-90 active:scale-95 transition-all"
                style={{ backgroundColor: 'var(--color-primary)' }}
                aria-label="Start recording"
              >
                <Mic size={32} />
              </button>
            </div>
            <p className="text-sm font-medium text-gray-700 text-center">
              Tap to start recording your lesson recap
            </p>
            <p className="text-xs text-gray-400 text-center">
              Speak naturally — describe what was covered today
            </p>
          </>
        )}

        {/* Recording in progress */}
        {!permissionDenied && isRecording && (
          <>
            <div className="relative flex items-center justify-center">
              {/* Pulsing ring */}
              <span className="absolute inline-flex w-20 h-20 rounded-full bg-red-400 animate-pulse-ring" />
              <button
                onClick={stopRecording}
                className="relative w-20 h-20 rounded-full bg-red-500 flex items-center justify-center text-white shadow-md hover:bg-red-600 active:scale-95 transition-all"
                aria-label="Stop recording"
              >
                <Square size={28} fill="white" strokeWidth={0} />
              </button>
            </div>
            <div className="text-2xl font-mono font-semibold text-gray-700 tabular-nums">
              {formatTime(recordingTime)}
            </div>
            <p className="text-sm text-gray-500">Recording… tap to stop</p>
          </>
        )}

        {/* Recording ready */}
        {!permissionDenied && !isRecording && hasRecording && (
          <>
            <CheckCircle size={56} style={{ color: 'var(--color-accent)' }} />
            <p className="text-sm font-medium text-gray-700">
              Recording ready ({recordedDuration})
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleReRecord}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Re-record
              </button>
              <button
                onClick={handlePlayback}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Play back
              </button>
            </div>
            <audio ref={audioRef} src={audioBlobUrl} className="hidden" />
          </>
        )}
      </div>
    </div>
  )
}
