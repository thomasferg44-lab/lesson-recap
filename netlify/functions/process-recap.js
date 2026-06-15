import Anthropic from '@anthropic-ai/sdk'
import OpenAI, { toFile } from 'openai'
import busboy from 'busboy'
import { Readable } from 'stream'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─── Rate limiter (in-memory; resets on cold start — acceptable for this scale)
const rateLimitMap = new Map()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 10 * 60 * 1000 // 10 minutes

function checkRateLimit(ip) {
  const now = Date.now()

  // Sweep expired entries on every request to prevent unbounded growth
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

// ─── Input sanitization — strip HTML tags, hard-cap length
const sanitize = (str) => String(str).replace(/<[^>]*>/g, '').trim().slice(0, 5000)

// ─── Multipart parser (wraps busboy into a Promise for use in async handler)
function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const contentType =
      event.headers['content-type'] || event.headers['Content-Type'] || ''

    if (!contentType) {
      return reject(new Error('Missing Content-Type header'))
    }

    const bb = busboy({ headers: { 'content-type': contentType } })
    const result = { fields: {}, files: {} }

    bb.on('file', (name, stream, info) => {
      const chunks = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => {
        result.files[name] = {
          buffer: Buffer.concat(chunks),
          mimeType: info.mimeType,
          filename: info.filename,
        }
      })
      stream.on('error', reject)
    })

    bb.on('field', (name, value) => {
      result.fields[name] = value
    })

    bb.on('close', () => resolve(result))
    bb.on('error', reject)

    // Netlify sends binary bodies as base64; decode to raw bytes before piping
    const bodyBuffer = Buffer.from(
      event.body,
      event.isBase64Encoded ? 'base64' : 'utf8'
    )

    const readable = new Readable({ read() {} })
    readable.push(bodyBuffer)
    readable.push(null)
    readable.pipe(bb)
  })
}

// ─── Response shape validator
function validateRecap(obj) {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.summary === 'string' &&
    obj.summary.trim().length > 0 &&
    Array.isArray(obj.categories) &&
    obj.categories.length > 0
  )
}

// ─── Minimal response helper — always sets Content-Type
const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

// ─── Handler ──────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  // 1. Rate limiting — extract real client IP from proxy header
  const rawIp =
    event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown'
  const ip = rawIp.split(',')[0].trim()

  if (!checkRateLimit(ip)) {
    return json(429, { error: 'Too many requests. Please wait a few minutes.' })
  }

  // 2. Env var check — fail fast before any expensive work;
  //    API keys are read exclusively from environment variables, never from code
  if (!process.env.OPENAI_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    console.error('process-recap: API key environment variables are not configured')
    return json(500, { error: 'Server configuration error' })
  }

  try {
    // 3. Parse multipart form data
    const { fields, files } = await parseMultipart(event)

    if (!files.audio) {
      return json(400, { error: 'No audio file received' })
    }
    if (!fields.studentInfo) {
      return json(400, { error: 'Missing student info' })
    }

    let studentInfo
    try {
      studentInfo = JSON.parse(fields.studentInfo)
    } catch {
      return json(400, { error: 'Invalid student info format' })
    }

    const { buffer: audioBuffer, mimeType } = files.audio
    const categories = Array.isArray(studentInfo.categories)
      ? studentInfo.categories
      : []

    // 4. Transcribe with OpenAI Whisper
    //    Audio buffer is used in-memory only — never written to disk or stored anywhere
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Derive filename extension from MIME type so OpenAI can detect the format correctly.
    // Mismatched filename/type (e.g. audio.webm with type audio/mp4) causes a 400 from Whisper.
    const MIME_TO_EXT = {
      'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/m4a': 'm4a',
      'audio/mpeg': 'mp3',  'audio/ogg':  'ogg', 'audio/flac': 'flac',
      'audio/wav':  'wav',
    }
    const ext = MIME_TO_EXT[mimeType] || 'webm'
    const safeType = mimeType || 'audio/webm'

    const transcription = await openai.audio.transcriptions.create({
      file: await toFile(audioBuffer, `audio.${ext}`, { type: safeType }),
      model: 'whisper-1',
      language: 'en',
    })

    const transcript = sanitize(transcription.text)

    if (!transcript) {
      return json(422, {
        error: 'Could not transcribe audio. Please try recording again.',
      })
    }

    // 5. Structure transcript with Claude
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are an expert swim coach writing a professional lesson recap for parents. Your job is to take a coach's raw voice note transcript and rewrite it into clean, concise, parent-friendly bullet points.

Rules:
- Rewrite everything in professional coaching language — never copy the coach's exact words
- Each bullet point must be SHORT (max 12 words), specific, and actionable
- Use active coaching vocabulary: "developed", "refined", "focused on", "improved", "practised", "corrected"
- Cut all filler words, repetition, and casual speech entirely
- If the coach mentioned a drill, name it properly (e.g. "catch-up drill", "finger-drag drill")
- If the coach mentioned a correction, frame it as a positive focus area, not a problem
- Minimum 2 bullet points per covered category, maximum 4
- The coachNote must be warm, specific to THIS student and THIS lesson, and one sentence max 20 words — no generic phrases like "great job" or "keep it up"

Student: ${sanitize(studentInfo.studentName)}
Lesson Type: ${sanitize(studentInfo.lessonType)}
Duration: ${sanitize(studentInfo.duration)}
Coach: ${sanitize(studentInfo.coachName)}

Voice note transcript:
"${transcript}"

Categories available:
${JSON.stringify(categories)}

Return ONLY valid JSON, no markdown, no explanation:
{
  "summary": "One crisp sentence max 15 words summarising the main focus of today's session",
  "coachNote": "One warm specific encouraging sentence for the parents max 20 words",
  "categories": [
    {
      "id": "category_id",
      "label": "Category Label",
      "content": "bullet 1 text | bullet 2 text | bullet 3 text",
      "covered": true
    }
  ]
}

Use pipe | to separate bullet points in the content field. Only include categories where covered is true.`,
        },
      ],
    })

    // 6. Parse Claude response — strip any accidental markdown fences
    const rawText = message.content[0].text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()

    let parsed
    try {
      parsed = JSON.parse(rawText)
    } catch {
      console.error('process-recap: Claude returned non-JSON:', rawText.slice(0, 200))
      return json(500, { error: 'Failed to structure the recap. Please try again.' })
    }

    if (!validateRecap(parsed)) {
      console.error(
        'process-recap: recap failed shape validation:',
        JSON.stringify(parsed).slice(0, 200)
      )
      return json(500, { error: 'Recap generation failed. Please try again.' })
    }

    // 7. Log session to Supabase — non-blocking: a DB failure never breaks PDF generation
    const depId = sanitize(studentInfo.deploymentId)

    // Auto-register the deployment if it doesn't exist yet.
    // The sessions table has a FK on deployment_id; this upsert satisfies it idempotently.
    if (depId) {
      const { error: depError } = await supabase
        .from('deployments')
        .upsert(
          { id: depId, school_name: sanitize(studentInfo.companyName || depId) },
          { onConflict: 'id' }
        )
      if (depError) {
        console.error('DB deployment upsert error:', depError.message)
      }
    }

    const { error: dbError } = await supabase
      .from('sessions')
      .insert({
        deployment_id: depId,
        student_name:  sanitize(studentInfo.studentName),
        coach_name:    sanitize(studentInfo.coachName),
        lesson_type:   sanitize(studentInfo.lessonType),
        duration:      sanitize(studentInfo.duration),
        date:          sanitize(studentInfo.date),
        summary:       parsed.summary,
        categories:    parsed.categories,
        coach_note:    parsed.coachNote || null,
      })

    if (dbError) {
      console.error('DB insert error:', dbError.message)
      // Do NOT fail the request — PDF generation still works even if logging fails
    }

    // 8. Return only the fields the frontend needs — never echo back raw API data
    // coachNote is optional — if Claude omits it, default to null (never fail validation)
    return json(200, {
      summary: parsed.summary,
      coachNote: typeof parsed.coachNote === 'string' ? parsed.coachNote.trim() : null,
      categories: parsed.categories,
    })
  } catch (err) {
    // Log full error server-side; never expose raw API error details to frontend
    console.error('process-recap error:', err.message)
    return json(err.status || 500, { error: 'Processing failed. Please try again.' })
  }
}
