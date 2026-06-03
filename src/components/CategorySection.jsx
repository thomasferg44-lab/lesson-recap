export default function CategorySection({ category, primaryColor, accentColor }) {
  // Split pipe-delimited bullet points written by Claude into the content field.
  const bullets = (category.content || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <div
      style={{
        border: `0.5px solid ${accentColor}`,
        marginBottom: 8,
        fontFamily: 'Arial, Helvetica, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          backgroundColor: primaryColor,
          padding: '6px 10px',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'white',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {category.label}
        </span>
      </div>

      {/* Body — bullet points */}
      <div style={{ backgroundColor: 'white', padding: '8px 10px' }}>
        {bullets.map((sentence, i) => (
          <div
            key={i}
            style={{
              fontSize: 10.5,
              color: '#1A1A1A',
              lineHeight: 1.5,
              marginBottom: i < bullets.length - 1 ? 4 : 0,
            }}
          >
            {'• '}{sentence}
          </div>
        ))}
      </div>
    </div>
  )
}
