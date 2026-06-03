# Deployment Guide — LessonRecap

## Overview

This app is a static React frontend + one Netlify Function. Deployment takes about 5 minutes. The free Netlify tier handles everything at zero cost.

---

## 1. Deploy to Netlify (Drag & Drop — Fastest)

1. Run the production build locally:
   ```bash
   npm run build
   ```

2. Go to [app.netlify.com](https://app.netlify.com) and log in (or create a free account).

3. On the dashboard, find the **"Add new site"** → **"Deploy manually"** option.

4. Drag the `dist/` folder onto the upload area.

5. Netlify gives you a random URL like `https://jolly-curie-abc123.netlify.app` — rename it under **Site settings → General → Site name**.

> ⚠️ **Drag & drop only deploys the frontend.** The Netlify Function (`process-recap.js`) is NOT included in a manual drag-and-drop deploy. You must connect a Git repository for the function to work. See **Git Deploy** below.

---

## 2. Deploy via Git (Required for Functions to Work)

1. Push this project to a GitHub repository.

2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project** → **GitHub**.

3. Select the repository. Netlify auto-detects the build settings from `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`

4. Click **Deploy site**.

5. After the deploy completes, set environment variables (see below) — then trigger a redeploy.

---

## 3. Set Environment Variables (Critical — App Won't Work Without These)

In the Netlify dashboard:

1. Go to your site → **Site configuration** → **Environment variables**
2. Click **Add a variable** for each key below:

| Key | Value | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `OPENAI_API_KEY` | `sk-proj-...` | [platform.openai.com](https://platform.openai.com) → API Keys |

3. After adding both variables, go to **Deploys** → **Trigger deploy** → **Deploy site**.

> The function reads these variables via `process.env.ANTHROPIC_API_KEY` and `process.env.OPENAI_API_KEY`. They are never exposed to the browser. Never put them in `.env.example` or any file that is committed to git.

---

## 4. Set Spending Caps (Do This Before Going Live)

**This is the most important step before giving the app to a client.**

### Anthropic (Claude)
1. Go to [console.anthropic.com/settings/billing](https://console.anthropic.com/settings/billing)
2. Under **Usage limits**, set a **Monthly spend limit** of **$20**
3. This covers roughly 5,000–8,000 recap generations per month

### OpenAI (Whisper)
1. Go to [platform.openai.com/account/limits](https://platform.openai.com/account/limits)
2. Set a **Monthly budget** of **$10**
3. Whisper costs ~$0.006 per minute of audio → $10 ≈ 1,600 minutes of recordings

> Without spending caps, a misconfigured client or abuse of the rate limiter could run up unexpected costs.

---

## 5. Custom Domain Setup

1. In Netlify dashboard → **Domain management** → **Add a domain**
2. Enter the client's domain (e.g., `recap.caymanaqualifeacademy.com`)
3. Add the CNAME record to their DNS provider pointing to the Netlify subdomain
4. Netlify automatically provisions an SSL certificate (Let's Encrypt) within a few minutes

---

## 6. Per-Client Deployment Process

This app is designed as a white-label template. Each new client gets their own deployment.

### Steps for a new client:

1. **Duplicate the repo** (fork or copy to a new GitHub repo)

2. **Edit the one config file:**
   ```
   src/data/companyConfig.js
   ```
   Change: company name, tagline, address, contact info, branding colours, coaches, lesson types, categories, footer message.

3. **Replace the logo:**
   ```
   public/logo.png
   ```
   PNG, transparent background, max 300×100px.

4. **Create a new Netlify site** for this client (their own account or yours)

5. **Set their own API keys** in that site's environment variables

6. **Set spending caps** on their API accounts

7. **Configure custom domain** if needed

8. **Hand off the URL** to the client

### Estimated time per client: 15–20 minutes once you have the assets.

---

## Local Development

```bash
# Install dependencies (once)
npm install

# Run locally with function support (reads .env for API keys)
netlify dev

# App available at: http://localhost:8888
# Functions available at: http://localhost:8888/api/process-recap
```

The `.env` file (never committed) contains:
```
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
```
