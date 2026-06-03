import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, ChevronRight, Search } from 'lucide-react'
import { generateProgressReport } from '../utils/pdfGenerator'

function Spinner({ color }) {
  return (
    <div
      className="w-10 h-10 rounded-full border-4 border-gray-100 animate-spin"
      style={{ borderTopColor: color }}
    />
  )
}

export default function LogView({ config, onClose }) {
  const { branding } = config

  // allSessions: full result from initial (unfiltered) fetch — used for sidebar counts
  const [allSessions,      setAllSessions]      = useState([])
  // sessions: the currently active result set (re-fetched when student filter changes)
  const [sessions,         setSessions]         = useState([])
  const [students,         setStudents]         = useState([])
  const [selectedStudent,  setSelectedStudent]  = useState(null)  // null = "All Sessions"
  const [searchQuery,      setSearchQuery]      = useState('')
  const [expandedId,       setExpandedId]       = useState(null)
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const loadSessions = useCallback(async (studentName) => {
    setLoading(true)
    setError(null)
    try {
      let url = `/api/get-sessions?deploymentId=${encodeURIComponent(config.deploymentId)}`
      if (studentName) url += `&studentName=${encodeURIComponent(studentName)}`

      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      console.log('sessions response:', data)

      setSessions(data.sessions || [])

      // Cache the full list + student names only on the initial (unfiltered) fetch
      if (!studentName) {
        setAllSessions(data.sessions || [])
        setStudents(data.students    || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [config.deploymentId])

  useEffect(() => {
    loadSessions(null)
  }, [loadSessions])

  // ── Sidebar student selection ─────────────────────────────────────────────
  function handleSelectStudent(name) {
    setSelectedStudent(name)
    setSearchQuery('')
    setExpandedId(null)
    loadSessions(name || undefined)
  }

  // ── Sidebar counts (always computed from the full unfiltered set) ──────────
  const sessionCounts = allSessions.reduce((acc, s) => {
    acc[s.student_name] = (acc[s.student_name] || 0) + 1
    return acc
  }, {})

  // ── Search: client-side filter over the currently loaded sessions ──────────
  const displayedSessions = searchQuery.trim()
    ? sessions.filter((s) =>
        s.student_name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : sessions

  // ── Close on Escape ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Session Log"
    >
      {/* ── Header ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 py-3 border-b border-gray-200"
        style={{ borderTop: `3px solid ${branding.primaryColor}` }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="Close session log"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <span className="text-gray-300 select-none">|</span>
          <h1 className="text-base font-semibold text-gray-800">Session Log</h1>
        </div>

        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold leading-tight" style={{ color: branding.primaryColor }}>
            {config.company.name}
          </p>
          <p className="text-xs text-gray-400">{config.company.tagline}</p>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="flex-shrink-0 px-4 lg:px-8 py-2 border-b border-gray-100 bg-gray-50">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search by student name…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setExpandedId(null) }}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': branding.primaryColor }}
          />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Sidebar (25%) ── */}
        <aside className="w-44 lg:w-56 flex-shrink-0 border-r border-gray-100 overflow-y-auto bg-gray-50 hidden sm:flex flex-col">
          <div className="p-3 space-y-1">
            {/* All Sessions */}
            <button
              onClick={() => handleSelectStudent(null)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: selectedStudent === null ? branding.accentColor : 'transparent',
                color:           selectedStudent === null ? '#fff' : '#374151',
              }}
            >
              All Sessions
              {allSessions.length > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({allSessions.length})</span>
              )}
            </button>

            {/* Individual students */}
            {students.map((name) => (
              <button
                key={name}
                onClick={() => handleSelectStudent(name)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors leading-snug"
                style={{
                  backgroundColor: selectedStudent === name ? branding.primaryColor : 'transparent',
                  color:           selectedStudent === name ? '#fff' : '#374151',
                }}
              >
                {name}
                {sessionCounts[name] != null && (
                  <span className="ml-1 text-xs opacity-60">({sessionCounts[name]})</span>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Right panel ── */}
        <main className="flex-1 overflow-y-auto px-4 lg:px-8 py-5">

          {loading && (
            <div className="flex justify-center items-center h-48">
              <Spinner color={branding.primaryColor} />
            </div>
          )}

          {!loading && error && (
            <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-xl p-5 flex flex-col gap-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={() => loadSessions(selectedStudent || undefined)}
                className="self-start px-4 py-1.5 rounded-lg border border-red-300 text-sm text-red-700 hover:bg-red-100 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && displayedSessions.length === 0 && (
            searchQuery ? (
              <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
                <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
                  No sessions found for &ldquo;{searchQuery}&rdquo;
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="text-4xl">🎙️</div>
                <p className="text-gray-500 text-sm text-center">
                  No sessions yet.<br />Record your first recap to get started.
                </p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  Record a Recap
                </button>
              </div>
            )
          )}

          {!loading && !error && displayedSessions.length > 0 && (
            <div className="space-y-3 max-w-3xl">
              {/* Student header + Progress Report button */}
              {selectedStudent && (
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-semibold text-gray-800">{selectedStudent}</h2>
                  <button
                    onClick={() => generateProgressReport(selectedStudent, displayedSessions, config)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ backgroundColor: branding.primaryColor }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Progress Report
                  </button>
                </div>
              )}

              {displayedSessions.map((s, index) => {
                const isExpanded = expandedId === s.id
                const coveredCats = Array.isArray(s.categories)
                  ? s.categories.filter((c) => c.covered)
                  : []

                return (
                  <div
                    key={s.id}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm transition-shadow hover:shadow-md"
                  >
                    {/* Card header — always visible, click to expand */}
                    <button
                      className="w-full text-left px-4 py-4"
                      onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Student name */}
                          <p
                            className="font-semibold text-sm leading-tight"
                            style={{ color: branding.primaryColor }}
                          >
                            {s.student_name}
                          </p>

                          {/* Meta pills */}
                          <p className="text-xs text-gray-400 mt-1">
                            {[s.date, s.lesson_type, s.duration, s.coach_name]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>

                          {/* Summary */}
                          {s.summary && (
                            <p className="text-sm text-gray-600 italic mt-2 leading-relaxed line-clamp-2">
                              {s.summary}
                            </p>
                          )}

                          {/* Coach note */}
                          {s.coach_note && (
                            <p
                              className="text-xs mt-1.5 leading-relaxed"
                              style={{ color: branding.accentColor }}
                            >
                              ✦ {s.coach_note}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-xs text-gray-400 font-normal">#{index + 1}</span>
                          <ChevronRight
                            size={18}
                            className="text-gray-400 transition-transform"
                            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                          />
                        </div>
                      </div>
                    </button>

                    {/* Expanded: categories — max-height transition */}
                    {coveredCats.length > 0 && (
                      <div
                        style={{
                          maxHeight: isExpanded ? '600px' : '0px',
                          overflow: 'hidden',
                          transition: 'max-height 0.3s ease',
                        }}
                      >
                        <div className="border-t border-gray-100 px-4 pt-3 pb-4 bg-gray-50 space-y-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            What we covered
                          </p>
                          {coveredCats.map((cat) => {
                            const bullets = (cat.content || '')
                              .split('|')
                              .map((b) => b.trim())
                              .filter(Boolean)
                            return (
                              <div key={cat.id}>
                                <p
                                  className="text-xs font-semibold mb-1"
                                  style={{ color: branding.primaryColor }}
                                >
                                  {cat.label}
                                </p>
                                <ul className="space-y-0.5">
                                  {bullets.map((b, i) => (
                                    <li key={i} className="text-xs text-gray-600 flex gap-2 leading-relaxed">
                                      <span className="text-gray-300 flex-shrink-0">•</span>
                                      <span>{b}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
