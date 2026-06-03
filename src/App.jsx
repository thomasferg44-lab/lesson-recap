import { useState, useRef } from 'react'
import { ClipboardList } from 'lucide-react'
import config from './data/companyConfig'
import StudentForm from './components/StudentForm'
import RecorderPanel from './components/RecorderPanel'
import RecapPreview from './components/RecapPreview'
import LogView from './components/LogView'
import WeeklyBanner from './components/WeeklyBanner'
import { generateAndDownloadPDF } from './utils/pdfGenerator'

// ── Processing view ───────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Transcribing voice note…', delay: '0.5s' },
  { label: 'Structuring recap…',       delay: '1.5s' },
  { label: 'Generating PDF preview…',  delay: '2.5s' },
]

function ProcessingView() {
  return (
    <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-6 shadow-sm border border-gray-100">
      {/* Spinner */}
      <div
        className="w-12 h-12 rounded-full border-4 border-gray-100 animate-spin"
        style={{ borderTopColor: config.branding.primaryColor }}
      />
      <h3 className="text-base font-semibold text-gray-700">
        Processing your lesson recap…
      </h3>

      {/* Animated steps */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {STEPS.map((step, i) => (
          <div
            key={i}
            className="flex items-center gap-3"
            style={{ opacity: 0, animation: 'step-appear 0.4s ease forwards', animationDelay: step.delay }}
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: config.branding.primaryColor }}
            >
              <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="white" strokeWidth="2.5">
                <polyline points="1.5,6 4.5,9 10.5,3" />
              </svg>
            </div>
            <span className="text-sm text-gray-600">{step.label}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400">This usually takes 10–15 seconds</p>
    </div>
  )
}

// ── Error card ────────────────────────────────────────────────────────────────
function ErrorCard({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-sm text-red-700 leading-relaxed">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="self-start px-4 py-2 rounded-lg border border-red-300 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
      >
        Try Again
      </button>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [appState, setAppState]     = useState('idle')
  const [recapData, setRecapData]   = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [audioBlob, setAudioBlob]   = useState(null)
  const [recorderPulse, setRecorderPulse] = useState(false)
  const [pdfStatus, setPdfStatus]   = useState('idle') // 'idle'|'generating'|'done'|'error'
  const [showLog,   setShowLog]     = useState(false)

  const [studentInfo, setStudentInfo] = useState({
    studentName: '',
    coachName:   config.coaches[0],
    lessonType:  config.lessonTypes[0],
    duration:    '30 min',
    date: new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    }),
  })

  const studentFormRef = useRef(null)

  function triggerRecorderPulse() {
    setRecorderPulse(true)
    setTimeout(() => setRecorderPulse(false), 1500)
  }

  // ── Validation + generate ─────────────────────────────────────────────────
  async function handleGenerate() {
    if (appState !== 'idle') return

    let hasError = false

    if (studentInfo.studentName.trim().length < 2) {
      setErrorMessage('Please enter the student name (at least 2 characters).')
      studentFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      hasError = true
    } else {
      setErrorMessage('')
    }

    if (!audioBlob) {
      triggerRecorderPulse()
      hasError = true
    }

    if (hasError) return

    setAppState('processing')
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('studentInfo', JSON.stringify({
        ...studentInfo,
        categories:   config.categories,
        deploymentId: config.deploymentId,
        companyName:  config.company.name,
      }))

      const res = await fetch('/api/process-recap', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Server error ${res.status}`)
      }
      const data = await res.json()
      setRecapData(data)
      setAppState('done')
      setPdfStatus('idle')
    } catch (err) {
      setErrorMessage(err.message || 'Something went wrong. Please try again.')
      setAppState('error')
    }
  }

  function handleRetry() {
    setAppState('idle')
    setRecapData(null)
    setAudioBlob(null)
    setErrorMessage('')
    setPdfStatus('idle')
  }

  async function handleDownloadPDF() {
    setPdfStatus('generating')
    const result = await generateAndDownloadPDF(studentInfo, config)
    setPdfStatus(result.success ? 'done' : 'error')
  }

  // ── Left panel content ────────────────────────────────────────────────────
  const leftPanel = (() => {
    if (appState === 'processing') return <ProcessingView />
    if (appState === 'error') {
      return <ErrorCard message={errorMessage} onRetry={handleRetry} />
    }
    return (
      <>
        <div ref={studentFormRef}>
          <StudentForm
            studentInfo={studentInfo}
            onUpdate={(field, value) =>
              setStudentInfo((prev) => ({ ...prev, [field]: value }))
            }
            config={config}
            error={errorMessage}
          />
        </div>
        <RecorderPanel
          onAudioReady={setAudioBlob}
          appState={appState}
          onStateChange={setAppState}
          pulsing={recorderPulse}
        />
      </>
    )
  })()

  // ── Bottom bar content ────────────────────────────────────────────────────
  const bottomBar = (() => {
    if (appState === 'done') {
      return (
        <div className="max-w-6xl mx-auto flex items-center gap-3 w-full">
          <button
            onClick={handleRetry}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            New Recap
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfStatus === 'generating'}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: config.branding.accentColor }}
          >
            {pdfStatus === 'idle' && 'Download PDF'}
            {pdfStatus === 'generating' && (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generating…
              </>
            )}
            {pdfStatus === 'done' && (
              <>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Downloaded!
              </>
            )}
            {pdfStatus === 'error' && 'Download failed — retry'}
          </button>
        </div>
      )
    }

    return (
      <div className="max-w-6xl mx-auto flex items-center gap-3 w-full">
        <span className="flex-1 text-sm text-gray-400">
          {appState === 'processing' && 'This usually takes 10–15 seconds…'}
          {appState === 'idle' && !audioBlob && 'Record a voice note to get started'}
          {appState === 'idle' && audioBlob && studentInfo.studentName.trim().length < 2 && 'Enter student name to generate'}
          {appState === 'idle' && audioBlob && studentInfo.studentName.trim().length >= 2 && 'Ready to generate'}
        </span>
        <button
          onClick={handleGenerate}
          disabled={appState === 'processing' || appState === 'recording'}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: config.branding.primaryColor }}
        >
          {appState === 'processing' ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Processing…
            </span>
          ) : (
            'Generate Recap'
          )}
        </button>
      </div>
    )
  })()

  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      style={{
        '--color-primary': config.branding.primaryColor,
        '--color-accent':  config.branding.accentColor,
        '--color-text':    config.branding.textColor,
      }}
    >
      {/* ── Navbar ── */}
      <nav className="bg-white border-b border-gray-200 px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={config.branding.logoPath}
            alt={config.company.name}
            className="h-9 w-auto object-contain"
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <div>
            <p
              className="text-sm font-semibold leading-tight"
              style={{ color: config.branding.primaryColor }}
            >
              {config.company.name}
            </p>
            <p className="text-xs text-gray-400">{config.company.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-400 hidden sm:block">{studentInfo.date}</p>
          <button
            onClick={() => setShowLog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
            title="Session Log"
          >
            <ClipboardList size={15} />
            <span className="hidden sm:inline">Session Log</span>
          </button>
        </div>
      </nav>

      {/* ── Weekly summary banner — self-hides when not Monday or already sent ── */}
      <WeeklyBanner config={config} />

      {/* ── Main content ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 lg:px-8 py-6 pb-24">
        <div className="flex flex-col lg:flex-row gap-5">

          {/* Left panel — 60% */}
          <div
            className="flex flex-col gap-4 lg:w-3/5 rounded-xl p-4"
            style={{ backgroundColor: '#F8F9FA' }}
          >
            {leftPanel}
          </div>

          {/* Right panel — 40% */}
          <div
            className="lg:w-2/5 rounded-xl overflow-hidden"
            style={{ minWidth: 0, backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
          >
            <RecapPreview
              recapData={recapData}
              config={config}
              studentInfo={studentInfo}
              mode="preview"
            />
          </div>

        </div>
      </main>

      {/* ── Bottom action bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 lg:px-8 py-3">
        {bottomBar}
      </div>

      {/* ── Session Log overlay ── */}
      {showLog && (
        <LogView config={config} onClose={() => setShowLog(false)} />
      )}

      {/* ── Hidden PDF render target (off-screen, captured by html2canvas) ── */}
      <div
        id="pdf-render-target"
        style={{ position: 'absolute', left: '-9999px', top: 0, zIndex: -1 }}
      >
        {recapData && (
          <RecapPreview
            recapData={recapData}
            config={config}
            mode="pdf"
            studentInfo={studentInfo}
          />
        )}
      </div>
    </div>
  )
}
