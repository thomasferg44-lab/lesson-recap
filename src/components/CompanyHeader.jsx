import { useState } from 'react'

export default function CompanyHeader({ config, mode }) {
  const { company, branding } = config
  const [logoFailed, setLogoFailed] = useState(false)

  const initials = company.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <div
      style={{
        backgroundColor: branding.primaryColor,
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      {/* Logo or initials fallback */}
      <div style={{ flexShrink: 0 }}>
        {!logoFailed ? (
          <img
            src={branding.logoPath}
            alt={company.name}
            style={{ height: 52, width: 'auto', objectFit: 'contain', display: 'block' }}
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: 1,
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
          >
            {initials}
          </div>
        )}
      </div>

      {/* Company info */}
      <div style={{ textAlign: 'right', color: 'white', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3, letterSpacing: 0.4 }}>
          {company.name}
        </div>
        <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>
          {company.tagline}
        </div>
        <div style={{ fontSize: 10, opacity: 0.72 }}>
          {company.phone} &nbsp;·&nbsp; {company.email}
        </div>
      </div>
    </div>
  )
}
