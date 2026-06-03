# LessonRecap — Claude Code Project Context

## What This Is
A white-label lesson recap PDF generator for coaches and instructors. The coach records a short voice note after a lesson, the app transcribes it (OpenAI Whisper), structures it into a branded PDF recap (Claude API), and the coach downloads it to send to parents via WhatsApp or email.

**This app is a product template. It gets customized per client by editing ONE file: `src/data/companyConfig.js`.**

---

## Security Rules (NON-NEGOTIABLE — enforce on every file you write)
1. **API keys NEVER touch the frontend.** All Anthropic and OpenAI API calls go through `netlify/functions/process-recap.js` only. The React app never imports or uses any API key directly.
2. **Rate limiting on the Netlify Function.** Maximum 10 requests per IP per 10 minutes. Return 429 if exceeded.
3. **Input sanitization.** All text inputs and transcripts are sanitized before being passed to any API.
4. **No sensitive data in localStorage.** Recap data is held in React state only — never persisted to localStorage.
5. **Audio is never stored.** The audio blob is sent to the Netlify Function, transcribed, and immediately discarded. No audio files are saved anywhere.
6. **Environment variables only for secrets.** `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` live in `.env` locally and in Netlify environment variables in production. Never in code.

---

## Architecture
```
Coach's phone (browser)
    ↓ records audio (MediaRecorder API)
    ↓ POST multipart/form-data (audio + student info + coach name)
Netlify Function: /api/process-recap
    ↓ rate limit check
    ↓ sends audio → OpenAI Whisper (transcription)
    ↓ sends transcript + categories → Claude API (structuring)
    ↓ returns structured JSON recap
React app
    ↓ renders RecapPreview with structured data
    ↓ generates PDF locally (jsPDF + html2canvas)
    ↓ coach downloads PDF → sends via WhatsApp
```

---

## Tech Stack
| Layer | Tool | Why |
|---|---|---|
| Framework | React 18 + Vite | Same as quote tool |
| Styling | Tailwind CSS v3 | Same as quote tool |
| PDF generation | jsPDF + html2canvas | Client-side, no cost |
| Audio recording | MediaRecorder API (browser native) | No external library needed |
| Transcription | OpenAI Whisper API (via Netlify Function) | Best accuracy, ~$0.006/min |
| Structuring | Anthropic Claude API (via Netlify Function) | Structured recap from transcript |
| Backend | Netlify Functions | Free tier, serverless, no server to manage |
| Hosting | Netlify (free tier) | Zero cost |

---

## File Structure
```
lesson-recap/
├── CLAUDE.md
├── .claude/
│   └── settings.json
├── public/
│   └── logo.png
├── src/
│   ├── components/
│   │   ├── RecorderPanel.jsx       ← Voice recording UI
│   │   ├── StudentForm.jsx         ← Student name, coach, duration inputs
│   │   ├── RecapPreview.jsx        ← Rendered recap preview (right panel)
│   │   ├── CategorySection.jsx     ← Single category block in preview
│   │   └── CompanyHeader.jsx       ← Logo + school info header (reused in PDF)
│   ├── data/
│   │   └── companyConfig.js        ← THE ONLY FILE THAT CHANGES PER CLIENT
│   ├── utils/
│   │   └── pdfGenerator.js         ← html2canvas + jsPDF logic
│   ├── App.jsx
│   └── main.jsx
├── netlify/
│   └── functions/
│       └── process-recap.js        ← Backend: Whisper + Claude (API keys live here)
├── index.html
├── .env.example
├── .env
├── tailwind.config.js
├── vite.config.js
├── netlify.toml
└── package.json
```

---

## companyConfig.js — Master Reference
```js
export default {
  company: {
    name: "Cayman Aqualife Academy",
    tagline: "Water Polo · Swimming · Jnr Life-Guarding",
    registrationNumber: "109411",
    address: ["George Town", "Grand Cayman", "Cayman Islands"],
    phone: "+345 326 3370",
    email: "coachgrantcayman@gmail.com",
    website: "caymanaqualifeacademy.com",
  },
  branding: {
    primaryColor: "#21B7B5",
    accentColor: "#E7A034",
    textColor: "#1A1A1A",
    logoPath: "/logo.png",
  },
  coaches: [
    "Coach Grant",
    "Coach Thomas",
  ],
  lessonTypes: [
    "Private Lesson",
    "Group Class",
    "Water Polo",
    "Splash Ball",
    "Camp",
  ],
  categories: [
    { id: "freestyle", label: "Freestyle" },
    { id: "backstroke", label: "Backstroke" },
    { id: "breaststroke", label: "Breaststroke" },
    { id: "butterfly", label: "Butterfly" },
    { id: "starts_turns", label: "Starts & Turns" },
    { id: "water_polo", label: "Water Polo Skills" },
    { id: "general", label: "General Notes" },
  ],
  recapSettings: {
    footerMessage: "Thank you for being part of the Aqualife family!",
    showDate: true,
    showDuration: true,
    showCoach: true,
  },
}
```

---

## PDF Output Specification
- **Size:** A4 portrait
- **Sections (top to bottom):**
  1. Header bar — logo left, school name + contact right (same as quote tool)
  2. "LESSON RECAP" title + date + coach name + lesson type + duration
  3. Student name block (large, prominent)
  4. Category sections — one block per category that was covered (omit categories with no content)
  5. Each category: colored left border (primaryColor), category label bold, content below
  6. Footer — footerMessage + school website
- **PDF generation:** same html2canvas + jsPDF approach as quote tool

---

## Netlify Function: process-recap.js
### What it does:
1. Rate limit check (10 requests / IP / 10 min)
2. Parse multipart form data (audio file + metadata)
3. Send audio to OpenAI Whisper → get transcript
4. Build Claude prompt with: transcript + category list + student info
5. Parse Claude's structured JSON response
6. Return JSON to frontend
7. Discard audio — never save it

### Claude prompt structure:
```
You are a structured lesson recap generator for a swim coach. 

The coach has just finished a lesson and recorded a voice note describing what was covered.

Student: {studentName}
Lesson Type: {lessonType}
Duration: {duration}

Voice note transcript:
"{transcript}"

The possible categories for this school are:
{categories}

Return ONLY a valid JSON object with this exact structure:
{
  "summary": "One sentence overview of the lesson",
  "categories": [
    {
      "id": "freestyle",
      "label": "Freestyle", 
      "content": "What was covered in this category. Null if not mentioned.",
      "covered": true
    }
  ]
}

Only include categories where covered is true. Be specific and practical — parents should be able to read this and help their child practice. Do not include categories that were not mentioned in the transcript.
```

---

## App States
```
"idle"        → StudentForm + RecorderPanel visible, no recap yet
"recording"   → actively recording audio, timer showing
"processing"  → audio sent, waiting for API response (spinner)
"done"        → recap structured, RecapPreview visible, Download button active
"error"       → something failed, error message + retry button
```

---

## Do Not
- No API keys in any frontend file
- No audio storage of any kind
- No localStorage usage
- No database
- Do not use `alert()` — use inline UI feedback
- Do not add any AI calls except in the Netlify Function
- Do not use any CSS framework besides Tailwind
