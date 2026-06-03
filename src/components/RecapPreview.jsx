import CompanyHeader from './CompanyHeader'
import CategorySection from './CategorySection'

// Convert a 6-digit hex color to rgba — used to derive the soft tint from branding.primaryColor
function hexToRgba(hex, alpha) {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const PILL_STYLE = {
  backgroundColor: '#F3F4F6',
  color: '#6B7280',
  fontSize: 10,
  padding: '2px 8px',
  borderRadius: 10,
  fontWeight: 500,
  fontFamily: 'Arial, Helvetica, sans-serif',
  display: 'inline-block',
}

const SECTION_LABEL_STYLE = {
  fontSize: 9,
  color: '#9CA3AF',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  marginBottom: 5,
  fontFamily: 'Arial, Helvetica, sans-serif',
}

export default function RecapPreview({ recapData, config, mode, studentInfo }) {
  const { branding, company, recapSettings } = config
  const isPdf = mode === 'pdf'

  // Soft background: very light tint of primaryColor at 8% opacity
  const SOFT = hexToRgba(branding.primaryColor, 0.08)

  // ── Placeholder (preview only, no recap yet) ──────────────────────────────
  if (!recapData) {
    return (
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 8,
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
          minHeight: 360,
        }}
      >
        <img
          src={branding.logoPath}
          alt={company.name}
          style={{ height: 56, width: 'auto', objectFit: 'contain', marginBottom: 24, opacity: 0.45 }}
          onError={(e) => { e.target.style.display = 'none' }}
        />
        <p
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: branding.primaryColor,
            marginBottom: 8,
            fontFamily: 'Arial, Helvetica, sans-serif',
          }}
        >
          Your lesson recap will appear here
        </p>
        <p
          style={{
            fontSize: 13,
            color: '#9CA3AF',
            maxWidth: 260,
            lineHeight: 1.6,
            fontFamily: 'Arial, Helvetica, sans-serif',
          }}
        >
          Fill in the student details and record your voice note to get started
        </p>
      </div>
    )
  }

  // ── Full document ─────────────────────────────────────────────────────────
  const coveredCategories = recapData.categories.filter((c) => c.covered)

  const pills = [
    recapSettings.showDate && studentInfo.date,
    recapSettings.showCoach && studentInfo.coachName,
    studentInfo.lessonType,
    recapSettings.showDuration && studentInfo.duration,
  ].filter(Boolean)

  const document = (
    <div
      style={{
        width: 794,
        minHeight: 1123,
        backgroundColor: 'white',
        fontFamily: 'Arial, Helvetica, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        ...(isPdf ? {} : { zoom: 0.67 }),
      }}
    >
      {/* 1. Header bar */}
      <CompanyHeader config={config} mode={mode} />

      {/* 2. Title block — LESSON RECAP + student name large + detail pills */}
      <div
        style={{
          backgroundColor: 'white',
          padding: '18px 24px 14px',
          borderBottom: `2px solid ${branding.accentColor}`,
        }}
      >
        {/* Document title */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: branding.primaryColor,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            marginBottom: 6,
            fontFamily: 'Arial, Helvetica, sans-serif',
          }}
        >
          Lesson Recap
        </div>

        {/* Student name — prominent */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: branding.primaryColor,
            marginBottom: 10,
            fontFamily: 'Arial, Helvetica, sans-serif',
          }}
        >
          {studentInfo.studentName || '—'}
        </div>

        {/* Detail pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pills.map((pill, i) => (
            <span key={i} style={PILL_STYLE}>{pill}</span>
          ))}
        </div>
      </div>

      {/* 3. Session Overview — left border + soft primary tint background */}
      {recapData.summary && (
        <div
          style={{
            margin: '14px 20px 0',
            borderLeft: `3px solid ${branding.primaryColor}`,
            backgroundColor: SOFT,
            padding: '10px 14px',
          }}
        >
          <div style={SECTION_LABEL_STYLE}>Session Overview</div>
          <div
            style={{
              fontSize: 11,
              color: '#4B5563',
              fontStyle: 'italic',
              lineHeight: 1.6,
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
          >
            {recapData.summary}
          </div>
        </div>
      )}

      {/* 4. Categories */}
      <div style={{ padding: '14px 20px', flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: 10,
            fontFamily: 'Arial, Helvetica, sans-serif',
          }}
        >
          What We Covered Today
        </div>

        {coveredCategories.map((cat) => (
          <CategorySection
            key={cat.id}
            category={cat}
            primaryColor={branding.primaryColor}
            accentColor={branding.accentColor}
            mode={mode}
          />
        ))}

        {/* Coach's Note — optional, only when Claude returns it */}
        {recapData.coachNote && (
          <div
            style={{
              marginTop: 14,
              borderLeft: `2.5px solid ${branding.primaryColor}`,
              backgroundColor: '#F8F9FF',
              padding: '10px 14px',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#374151',
                fontFamily: 'Arial, Helvetica, sans-serif',
              }}
            >
              Coach's Note —
            </span>
            {' '}
            <span
              style={{
                fontSize: 11,
                color: '#374151',
                fontFamily: 'Arial, Helvetica, sans-serif',
              }}
            >
              {recapData.coachNote}
            </span>
          </div>
        )}
      </div>

      {/* 5. Footer */}
      <div
        style={{
          padding: '12px 24px 16px',
          textAlign: 'center',
        }}
      >
        {/* Accent HR — 40% width, centered */}
        <div
          style={{
            width: '40%',
            height: 1,
            backgroundColor: branding.accentColor,
            margin: '0 auto 12px',
          }}
        />
        <div
          style={{
            fontSize: 11,
            fontStyle: 'italic',
            color: '#6B7280',
            marginBottom: 4,
            fontFamily: 'Arial, Helvetica, sans-serif',
          }}
        >
          {recapSettings.footerMessage}
        </div>
        <div
          style={{
            fontSize: 10,
            color: '#9CA3AF',
            fontFamily: 'Arial, Helvetica, sans-serif',
          }}
        >
          {company.website}
        </div>
      </div>
    </div>
  )

  // PDF mode: bare document (captured by html2canvas off-screen)
  if (isPdf) return document

  // Preview mode: zoomed with drop shadow
  return (
    <div
      style={{
        overflow: 'hidden',
        borderRadius: 8,
        boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
      }}
    >
      {document}
    </div>
  )
}
