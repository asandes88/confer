# Confer — Voice intelligence for conferences

**Live:** https://asandes88.github.io/confer/ (open in Chrome or Edge)

Capture a voice note at every booth, get it transcribed live in your browser, then press one button to turn the whole conference into a downloadable Excel report — complete with AI-generated summaries, sentiment, priority, next steps, and ready-to-send follow-up emails for each company.

Built to be **free to run and free to host**:

- **Transcription** uses the browser's built-in Web Speech API — no service, no key, real-time. (Works in Chrome & Edge.)
- **AI insights** use the Claude API with **your own key**, called directly from the browser. The key is stored only in your browser's `localStorage` and is sent only to Anthropic.
- **Everything else** is a static site — no backend, no database — so it hosts for $0 on any static host.

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL in **Chrome or Edge**, click the gear icon, and paste your Claude API key (get one at https://console.anthropic.com/settings/keys).

## How to use

1. **Create a conference** (e.g. "CES 2026").
2. At each booth, tap **+ Company**, name it, then tap the **mic** and talk. Your speech is transcribed into timestamped notes. Tap the mic again to stop. Add as many companies as you like.
3. At the end, tap **End conference & export report**. Confer asks Claude to analyze every company and downloads a polished `.xlsx`:
   - **Overview** sheet — headline, top opportunities, cross-cutting themes, recommended actions.
   - **Companies** sheet — one row per company with summary, sentiment, priority, key topics, products, people, next steps, a follow-up email draft, and your raw notes.

Everything is saved locally, so you can close the tab and come back.

## Deploy for free

This repo is already live on **GitHub Pages** at https://asandes88.github.io/confer/.

To redeploy after changes:

```bash
npm run deploy
```

That builds the app and force-pushes `dist/` to the `gh-pages` branch (which Pages serves). No environment variables are needed — each user supplies their own Claude key in the app's Settings.

Other free hosts work too (the build is a plain static `dist/`): `npx vercel --prod`, `npx netlify deploy --prod`, or Cloudflare Pages pointed at this repo with build `npm run build` and output `dist`.

## Tech

Vite · React · TypeScript · Tailwind CSS v4 · Framer Motion · SheetJS · Web Speech API · Anthropic SDK.
