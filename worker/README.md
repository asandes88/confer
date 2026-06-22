# Confer API proxy (Cloudflare Worker)

This tiny Worker keeps your Anthropic API key **server-side** so end users never
enter a key. The browser app calls the Worker; the Worker attaches the secret key
and forwards the request to Anthropic.

**Your key is saved as an encrypted Cloudflare secret — never in a file, never in the app bundle, never in git.**

## One-time setup

All commands are run from this `worker/` folder. You need a free Cloudflare
account (sign up at https://dash.cloudflare.com/sign-up).

```bash
cd worker

# 1. Log in to Cloudflare (opens your browser once)
npx wrangler login

# 2. Save your Anthropic key as an encrypted secret.
#    It prompts you to paste the key — paste sk-ant-... and press Enter.
#    THIS is where the key lives. Nowhere else.
npx wrangler secret put ANTHROPIC_API_KEY

# 3. Deploy the Worker
npx wrangler deploy
```

Step 3 prints your Worker URL, e.g.:

```
https://confer-proxy.your-subdomain.workers.dev
```

Copy that URL.

## Point the app at the proxy

From the project root (the folder above this one):

```bash
cd ..
# Create .env.local with your Worker URL (no trailing slash):
echo "VITE_PROXY_URL=https://confer-proxy.your-subdomain.workers.dev" > .env.local

# Rebuild and redeploy the site
npm run deploy
```

Done. The live app now uses the proxy — visitors get full AI insights without
ever entering a key, and your key stays private.

## Notes

- **Rotate / change the key:** re-run `npx wrangler secret put ANTHROPIC_API_KEY`.
- **Lock-down:** `wrangler.toml` sets `ALLOWED_ORIGIN` to your site so other
  websites can't use your proxy from a browser. Update it if you move to a custom
  domain. As a belt-and-braces measure, set a monthly spend limit in the
  Anthropic Console (Billing → Limits).
- **Cost:** Cloudflare Workers' free tier covers 100,000 requests/day — far more
  than a conference will ever use. You still pay Anthropic per use, as normal.
- **Local test:** `npx wrangler dev` runs the Worker locally; create a `.dev.vars`
  file with `ANTHROPIC_API_KEY=sk-ant-...` for local runs (it's git-ignored).
