import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const resend    = new Resend(process.env.RESEND_API_KEY)

// ─── Rate limiter — 5 requests per IP per hour (weekly summary is expensive)
const rateLimitMap   = new Map()
const RATE_LIMIT     = 5
const RATE_WINDOW_MS = 60 * 60 * 1000

function checkRateLimit(ip) {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (entry.resetAt <= now) rateLimitMap.delete(key)
  }
  const entry = rateLimitMap.get(ip)
  if (!entry) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count += 1
  return true
}

// ─── Sanitization
const sanitize = (str, max = 500) =>
  String(str).replace(/<[^>]*>/g, '').trim().slice(0, max)

// ─── HTML escaping — used before inserting dynamic content into email HTML
const esc = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// ─── Validate hex color — prevents CSS injection in email HTML
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/
const safeColor = (val, fallback) => (HEX_COLOR_RE.test(val) ? val : fallback)

// ─── Response helpers
const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

// ─── Claude response validation
function validateSummary(obj) {
  return (
    obj &&
    typeof obj.weekOverview   === 'string' && obj.weekOverview.trim().length > 0 &&
    Array.isArray(obj.students) && obj.students.length > 0 &&
    Array.isArray(obj.skillsSpotlight) && obj.skillsSpotlight.length > 0 &&
    typeof obj.lookingAhead   === 'string' && obj.lookingAhead.trim().length > 0
  )
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  // 1. Rate limit
  const rawIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown'
  const ip    = rawIp.split(',')[0].trim()
  if (!checkRateLimit(ip)) {
    return json(429, { error: 'Too many requests. Please wait before requesting another summary.' })
  }

  // 2. Env vars
  if (
    !process.env.ANTHROPIC_API_KEY ||
    !process.env.SUPABASE_URL       ||
    !process.env.SUPABASE_SERVICE_KEY ||
    !process.env.RESEND_API_KEY
  ) {
    console.error('weekly-summary: missing environment variables')
    return json(500, { error: 'Server configuration error' })
  }

  // 3. Parse body
  let body
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body
    body = JSON.parse(raw)
  } catch {
    return json(400, { error: 'Invalid request body' })
  }

  // 4. Validate + sanitize inputs
  const { deploymentId, coachEmail, schoolName, weekOf, primaryColor, accentColor } = body

  if (!deploymentId || !coachEmail || !schoolName || !weekOf) {
    return json(400, { error: 'deploymentId, coachEmail, schoolName, and weekOf are required' })
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const safeEmail = sanitize(coachEmail, 200)
  if (!EMAIL_RE.test(safeEmail)) {
    return json(400, { error: 'Invalid email address' })
  }

  const safeDepId     = sanitize(deploymentId, 100)
  const safeSchool    = sanitize(schoolName, 200)
  const safeWeekOf    = sanitize(weekOf, 50)
  const safePrimary   = safeColor(primaryColor, '#21B7B5')
  const safeAccent    = safeColor(accentColor,  '#E7A034')

  try {
    // 5. Query last 7 days of sessions
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: sessions, error: queryError } = await supabase
      .from('sessions')
      .select('*')
      .eq('deployment_id', safeDepId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: true })

    if (queryError) {
      console.error('weekly-summary: DB query error:', queryError.message)
      return json(500, { error: 'Failed to load sessions' })
    }

    if (!sessions || sessions.length === 0) {
      return json(200, { message: 'No sessions this week to summarize' })
    }

    const uniqueStudents = [...new Set(sessions.map((s) => s.student_name))]
    const sessionCount   = sessions.length
    const studentCount   = uniqueStudents.length

    // 6. Build Claude prompt
    const sessionSummaries = sessions
      .map((s) => `${s.date} — ${s.student_name} (${s.lesson_type}, ${s.duration}): ${s.summary}`)
      .join('\n')

    const message = await anthropic.messages.create({
      model:      'claude-opus-4-8',
      max_tokens: 2048,
      messages: [{
        role:    'user',
        content: `You are writing a professional weekly coaching summary for ${safeSchool}.

This week's sessions (${sessionCount} total, ${studentCount} students):
${sessionSummaries}

Write a structured weekly summary with these sections:
1. WEEK OVERVIEW — 2-3 sentences on the week overall
2. STUDENTS THIS WEEK — for each student, one bullet with their main focus/progress
3. SKILLS SPOTLIGHT — the 2-3 most-worked skills across all sessions this week
4. LOOKING AHEAD — 2-3 sentences on suggested focus areas for next week based on patterns

Keep it professional, warm, and specific. Parents and coaches should love reading this.

Return ONLY valid JSON:
{
  "weekOverview": "string",
  "students": [{ "name": "string", "highlight": "string" }],
  "skillsSpotlight": ["string", "string", "string"],
  "lookingAhead": "string",
  "sessionCount": ${sessionCount},
  "studentCount": ${studentCount}
}`,
      }],
    })

    // 7. Parse Claude response
    const rawText = message.content[0].text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()

    let summary
    try {
      summary = JSON.parse(rawText)
    } catch {
      console.error('weekly-summary: Claude returned non-JSON:', rawText.slice(0, 200))
      return json(500, { error: 'Failed to generate summary. Please try again.' })
    }

    if (!validateSummary(summary)) {
      console.error('weekly-summary: invalid summary shape:', JSON.stringify(summary).slice(0, 200))
      return json(500, { error: 'Summary generation failed. Please try again.' })
    }

    // 8. Build HTML email
    const emailHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: ${safePrimary}; padding: 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 22px;">${esc(safeSchool)}</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0;">Weekly Coaching Summary — ${esc(safeWeekOf)}</p>
  </div>
  <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 14px; line-height: 1.6;">${esc(summary.weekOverview)}</p>

    <h2 style="color: ${safePrimary}; font-size: 16px; margin-top: 24px;">Students This Week (${studentCount})</h2>
    ${summary.students.map((s) => `
      <div style="border-left: 3px solid ${safeAccent}; padding-left: 12px; margin-bottom: 12px;">
        <strong style="color: #1a1a1a;">${esc(s.name)}</strong>
        <p style="color: #374151; margin: 4px 0 0; font-size: 13px;">${esc(s.highlight)}</p>
      </div>
    `).join('')}

    <h2 style="color: ${safePrimary}; font-size: 16px; margin-top: 24px;">Skills Spotlight</h2>
    ${summary.skillsSpotlight.map((s) => `<p style="color: #374151; font-size: 13px;">• ${esc(s)}</p>`).join('')}

    <h2 style="color: ${safePrimary}; font-size: 16px; margin-top: 24px;">Looking Ahead</h2>
    <p style="color: #374151; font-size: 14px; line-height: 1.6;">${esc(summary.lookingAhead)}</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      ${sessionCount} sessions · ${studentCount} students · Generated by LessonRecap
    </p>
  </div>
</div>
`

    // 9. Send via Resend
    await resend.emails.send({
      from:    'onboarding@resend.dev',
      to:      safeEmail,
      subject: `Weekly Summary — ${safeSchool} — ${safeWeekOf}`,
      html:    emailHtml,
    })

    return json(200, { success: true, sessionCount, studentCount })

  } catch (err) {
    console.error('weekly-summary error:', err.message)
    return json(err.status || 500, { error: 'Failed to generate weekly summary. Please try again.' })
  }
}
