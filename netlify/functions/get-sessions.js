import { createClient } from '@supabase/supabase-js'

// ─── Supabase client — keys come from process.env only, never from code
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─── Rate limiter (in-memory; same pattern as process-recap.js)
const rateLimitMap = new Map()
const RATE_LIMIT    = 10
const RATE_WINDOW_MS = 10 * 60 * 1000

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

// ─── Input sanitization — strip HTML tags, cap length
const sanitize = (str) => String(str).replace(/<[^>]*>/g, '').trim().slice(0, 500)

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

// ─── Handler ──────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' })
  }

  // Rate limit
  const rawIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown'
  const ip    = rawIp.split(',')[0].trim()
  if (!checkRateLimit(ip)) {
    return json(429, { error: 'Too many requests. Please wait a few minutes.' })
  }

  // Supabase env check
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('get-sessions: Supabase environment variables are not configured')
    return json(500, { error: 'Server configuration error' })
  }

  const params       = event.queryStringParameters || {}
  const deploymentId = params.deploymentId ? sanitize(params.deploymentId) : null
  const studentName  = params.studentName  ? sanitize(params.studentName)  : null
  const rawLimit     = parseInt(params.limit, 10)
  const limit        = isNaN(rawLimit) ? 50 : Math.min(rawLimit, 100)

  if (!deploymentId) {
    return json(400, { error: 'deploymentId required' })
  }

  try {
    // 1. Fetch sessions (optionally filtered by student name)
    let query = supabase
      .from('sessions')
      .select('id, student_name, coach_name, lesson_type, duration, date, summary, coach_note, categories, created_at')
      .eq('deployment_id', deploymentId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (studentName) {
      query = query.ilike('student_name', `%${studentName}%`)
    }

    const { data: sessions, error: sessionsError } = await query

    if (sessionsError) {
      console.error('get-sessions: sessions query error:', sessionsError.message)
      return json(500, { error: sessionsError.message })
    }

    // 2. Fetch unique student names for the sidebar (always unfiltered)
    const { data: studentRows, error: studentsError } = await supabase
      .from('sessions')
      .select('student_name')
      .eq('deployment_id', deploymentId)
      .order('student_name')

    if (studentsError) {
      console.error('get-sessions: students query error:', studentsError.message)
      // Non-fatal — return sessions without the student list
    }

    const uniqueStudents = [
      ...new Set((studentRows || []).map((s) => s.student_name)),
    ]

    return json(200, {
      sessions:  sessions || [],
      students:  uniqueStudents,
    })
  } catch (err) {
    console.error('get-sessions error:', err.message)
    return json(500, { error: 'Failed to load sessions. Please try again.' })
  }
}
