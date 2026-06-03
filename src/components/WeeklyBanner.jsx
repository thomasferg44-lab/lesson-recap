import { useState } from 'react'

// Returns an ISO week key like "2026-W23" — used to scope localStorage per week
function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function WeeklyBanner({ config }) {
  const today  = new Date()
  const weekKey   = getISOWeekKey(today)
  const depId     = config.deploymentId
  const todayStr  = today.toISOString().slice(0, 10)

  // localStorage keys
  const summaryKey = `weeklySummary_${depId}_${weekKey}`
  const dismissKey = `weeklyBannerDismissed_${depId}_${todayStr}`
  const emailKey   = `coachEmail_${depId}`

  // Compute initial visibility once at mount — avoids calling localStorage on every render
  const [visible, setVisible] = useState(() => {
    if (today.getDay() !== 1) return false                    // not Monday
    if (localStorage.getItem(summaryKey)) return false        // already sent this week
    if (localStorage.getItem(dismissKey)) return false        // dismissed today
    return true
  })

  const [email,    setEmail]    = useState(
    () => config.recapSettings?.coachEmail || localStorage.getItem(emailKey) || ''
  )
  const [status,   setStatus]   = useState('idle') // 'idle' | 'sending' | 'sent' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  if (!visible) return null

  const weekOf = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  function handleDismiss() {
    localStorage.setItem(dismissKey, '1')
    setVisible(false)
  }

  async function handleSend() {
    const trimmedEmail = email.trim()
    if (!EMAIL_RE.test(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address')
      return
    }
    setErrorMsg('')
    setStatus('sending')

    try {
      const res = await fetch('/api/weekly-summary', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deploymentId: config.deploymentId,
          coachEmail:   trimmedEmail,
          schoolName:   config.company.name,
          weekOf,
          primaryColor: config.branding.primaryColor,
          accentColor:  config.branding.accentColor,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `Server error ${res.status}`)
      }

      // API returned 200 but there were no sessions this week
      if (data.message) {
        setErrorMsg(data.message)
        setStatus('idle')
        return
      }

      // Success — persist email + mark week as done
      localStorage.setItem(emailKey, trimmedEmail)
      localStorage.setItem(summaryKey, '1')
      setStatus('sent')
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  const { accentColor, primaryColor } = config.branding

  return (
    <div
      className="w-full px-4 lg:px-8 py-2.5 flex flex-wrap items-center gap-3"
      style={{ backgroundColor: accentColor }}
    >
      {/* Icon + message */}
      <span className="text-white text-sm font-medium flex-1 min-w-0">
        📋 Weekly summary ready — send this week's recap to your inbox
      </span>

      {/* Email input — shown if no email saved yet */}
      {!localStorage.getItem(emailKey) && status !== 'sent' && (
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErrorMsg('') }}
          className="px-3 py-1 text-sm rounded border-0 focus:outline-none focus:ring-2 w-48"
          style={{ '--tw-ring-color': primaryColor }}
        />
      )}

      {/* Error message */}
      {errorMsg && (
        <span className="text-white text-xs opacity-90">{errorMsg}</span>
      )}

      {/* Sent confirmation */}
      {status === 'sent' && (
        <span className="text-white text-sm font-medium">
          Summary sent to {email} ✓
        </span>
      )}

      {/* Send button — hidden after sent */}
      {status !== 'sent' && (
        <button
          onClick={handleSend}
          disabled={status === 'sending'}
          className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-white transition-opacity disabled:opacity-60"
          style={{ color: accentColor }}
        >
          {status === 'sending' ? (
            <span className="flex items-center gap-1.5">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Sending…
            </span>
          ) : (
            'Send Summary'
          )}
        </button>
      )}

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="text-white opacity-70 hover:opacity-100 transition-opacity text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
