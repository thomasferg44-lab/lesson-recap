# API Keys Setup Guide

Both API keys are required before the app can process any recaps. This guide walks through getting each key, setting spending caps, and securing them properly.

---

## Anthropic API Key (for Claude — recap structuring)

### Step 1 — Create an Anthropic account
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Click **Sign up** and create an account with your email
3. Verify your email address

### Step 2 — Add a payment method
1. Go to **Settings** → **Billing**
2. Click **Add payment method** and enter a credit or debit card
3. You are only charged for what you use — there is no monthly fee

### Step 3 — Set a spending cap ⚠️
1. In **Billing**, find **Usage limits**
2. Set a **Monthly spend limit** of **$20**
3. Click Save

> **Why $20?** Each recap call costs approximately $0.002–$0.004 (Claude Opus, ~1,024 output tokens). At $20, you can generate 5,000–10,000 recaps before hitting the cap. The app also has a built-in rate limiter (10 requests per IP per 10 minutes).

### Step 4 — Create an API key
1. Go to **Settings** → **API Keys**
2. Click **Create key**
3. Give it a name like `lesson-recap-prod`
4. **Copy the key immediately** — it is only shown once
5. It looks like: `sk-ant-api03-xxxxxxxxxxxxxxxxxx`

### Step 5 — Add the key to Netlify
- In Netlify dashboard → **Site configuration** → **Environment variables**
- Key: `ANTHROPIC_API_KEY`
- Value: paste your key

---

## OpenAI API Key (for Whisper — audio transcription)

### Step 1 — Create an OpenAI account
1. Go to [platform.openai.com](https://platform.openai.com)
2. Click **Sign up** and create an account
3. Verify your email address

### Step 2 — Add a payment method
1. Go to **Settings** → **Billing** → **Payment methods**
2. Add a credit or debit card

### Step 3 — Set a spending cap ⚠️
1. Go to **Settings** → **Limits**
2. Under **Usage limits**, set a **Monthly budget** of **$10**
3. Optionally set an email alert at $5

> **Why $10?** Whisper costs $0.006 per minute of audio. A typical lesson recap voice note is 1–3 minutes. At $10, you get approximately 1,600 minutes (around 800–1,600 recap recordings). This is more than enough for a single coaching business for months.

> **Cost breakdown example:** A coach does 30 lessons/week, each with a 2-minute voice note = 60 minutes/week × $0.006 = **$0.36/week** or about **$1.50/month** for Whisper.

### Step 4 — Create an API key
1. Go to **Dashboard** → **API Keys** (or [platform.openai.com/api-keys](https://platform.openai.com/api-keys))
2. Click **Create new secret key**
3. Give it a name like `lesson-recap-prod`
4. **Copy the key immediately** — it is only shown once
5. It looks like: `sk-proj-xxxxxxxxxxxxxxxxxx`

### Step 5 — Add the key to Netlify
- In Netlify dashboard → **Site configuration** → **Environment variables**
- Key: `OPENAI_API_KEY`
- Value: paste your key

---

## Security Rules — Read Before Sharing Keys

**Never do any of the following:**

- ❌ Put an API key in `src/` or any frontend file
- ❌ Put an API key in `companyConfig.js` or any file committed to git
- ❌ Share an API key in a Slack message, email, or chat
- ❌ Commit `.env` to git (it is already in `.gitignore`)
- ❌ Use the same key for multiple clients (use one key per client so you can revoke independently)

**Always do:**

- ✅ Store keys only in Netlify's **Environment variables** (for production) and `.env` (for local dev only, never committed)
- ✅ Set spending caps before going live
- ✅ Rotate a key immediately if you suspect it was exposed (revoke the old key and create a new one)
- ✅ Name keys descriptively so you know which app is using them

---

## Verifying Keys Work

After setting keys in Netlify and redeploying, open the app and do a quick test recap. If you get a "Server configuration error", the keys are not set or the deployment didn't pick them up — trigger a new deploy from the Netlify dashboard.

For local testing, put both keys in `.env`:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
```

Then run `netlify dev` (not `npm run dev`) so the function picks up the environment variables.
