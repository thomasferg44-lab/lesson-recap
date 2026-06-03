import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 33, g: 183, b: 181 }
}

export async function generateAndDownloadPDF(studentInfo, config) {
  try {
    const wrapper = document.getElementById('pdf-render-target')
    if (!wrapper) throw new Error('PDF render target not found')

    const target = wrapper.firstElementChild
    if (!target) throw new Error('No recap content to export')

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pdfWidth = pdf.internal.pageSize.getWidth()   // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight() // 297mm

    const imgData = canvas.toDataURL('image/png')
    const imgWidth = pdfWidth
    const imgHeight = (canvas.height / canvas.width) * imgWidth

    // Multi-page support for recaps that exceed one A4 sheet
    let yOffset = 0
    while (yOffset < imgHeight) {
      if (yOffset > 0) pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, -yOffset, imgWidth, imgHeight)
      yOffset += pdfHeight
    }

    // Sanitize filename: spaces and special chars → hyphens
    const safeName = (studentInfo.studentName || 'Student')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')

    const safeDate = (studentInfo.date || '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')

    pdf.save(`Recap-${safeName}-${safeDate}.pdf`)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export function generateProgressReport(studentName, sessions, config) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const margin = 20
  const contentW = pageW - margin * 2
  const accent = config.branding?.primaryColor || config.brandColors?.primary || '#21B7B5'
  const accentRGB = hexToRgb(accent)

  // ── Header bar ──────────────────────────────────────────────────────────
  doc.setFillColor(accentRGB.r, accentRGB.g, accentRGB.b)
  doc.rect(0, 0, pageW, 22, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('PROGRESS REPORT', margin, 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(config.company?.name || config.schoolName || 'Swimming Academy', margin, 16)

  // ── Student name + meta ─────────────────────────────────────────────────
  let y = 32
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(studentName, margin, y)

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  const totalSessions = sessions.length
  const dateGenerated = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  doc.text(
    `${totalSessions} session${totalSessions !== 1 ? 's' : ''} on record  ·  Generated ${dateGenerated}`,
    margin, y
  )

  // ── Divider ─────────────────────────────────────────────────────────────
  y += 5
  doc.setDrawColor(accentRGB.r, accentRGB.g, accentRGB.b)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  // ── Sessions ─────────────────────────────────────────────────────────────
  const sorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date))

  sorted.forEach((session, idx) => {
    if (y > pageH - 50) {
      doc.addPage()
      y = 20
    }

    // Session number pill + date
    doc.setFillColor(accentRGB.r, accentRGB.g, accentRGB.b)
    doc.roundedRect(margin, y - 4, 20, 6, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text(`#${idx + 1}`, margin + 3, y)

    doc.setTextColor(60, 60, 60)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    const sessionLabel = session.lesson_type
      ? `${session.lesson_type}  ·  ${session.date}`
      : session.date
    doc.text(sessionLabel, margin + 24, y)

    y += 6

    if (session.summary) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(60, 60, 60)
      const lines = doc.splitTextToSize(session.summary, contentW)
      lines.forEach((line) => {
        if (y > pageH - 25) { doc.addPage(); y = 20 }
        doc.text(line, margin, y)
        y += 5
      })
    }

    if (session.categories && Array.isArray(session.categories)) {
      session.categories.forEach((cat) => {
        if (!cat.points || cat.points.length === 0) return
        if (y > pageH - 25) { doc.addPage(); y = 20 }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(accentRGB.r, accentRGB.g, accentRGB.b)
        doc.text(cat.label?.toUpperCase() || '', margin + 2, y)
        y += 4

        cat.points.forEach((pt) => {
          if (y > pageH - 20) { doc.addPage(); y = 20 }
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(70, 70, 70)
          const ptLines = doc.splitTextToSize(`• ${pt}`, contentW - 4)
          ptLines.forEach((ln) => {
            if (y > pageH - 20) { doc.addPage(); y = 20 }
            doc.text(ln, margin + 4, y)
            y += 4
          })
        })
      })
    }

    y += 3
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.2)
    doc.line(margin, y, pageW - margin, y)
    y += 6
  })

  // ── Footer on every page ──────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(160, 160, 160)
    doc.text(
      `${config.company?.name || config.schoolName || 'Academy'} · Progress Report · ${dateGenerated}`,
      margin,
      pageH - 8
    )
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin - 20, pageH - 8)
  }

  doc.save(`progress-report-${studentName.replace(/\s+/g, '-').toLowerCase()}.pdf`)
}
