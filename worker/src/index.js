// Confer API proxy — a tiny Cloudflare Worker with two jobs:
//   POST /transcribe   -> transcribes uploaded audio with Whisper (Workers AI, free)
//   POST /v1/messages  -> forwards to Anthropic with the server-side key injected
//
// Your Anthropic key is set via `wrangler secret put ANTHROPIC_API_KEY` and never
// reaches the browser. Transcription uses the bound `AI` (Workers AI) — no key.

const UPSTREAM = 'https://api.anthropic.com'
const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo'

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || '*'
    const reqOrigin = request.headers.get('origin') || ''

    const cors = {
      'Access-Control-Allow-Origin': allowed === '*' ? '*' : allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'content-type, x-api-key, anthropic-version, anthropic-beta, anthropic-dangerous-direct-browser-access',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    }

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors)

    // Lightweight abuse guard: browsers always send Origin on cross-origin calls.
    if (allowed !== '*' && reqOrigin && reqOrigin !== allowed) {
      return json({ error: 'Origin not allowed' }, 403, cors)
    }

    const url = new URL(request.url)

    // --- Transcription (Whisper via Workers AI) ---
    if (url.pathname === '/transcribe') {
      if (!env.AI) {
        return json({ error: 'Workers AI is not bound. Add [ai] binding = "AI" to wrangler.toml and redeploy.' }, 500, cors)
      }
      try {
        const buf = await request.arrayBuffer()
        if (!buf || buf.byteLength === 0) return json({ error: 'No audio received' }, 400, cors)
        const audio = arrayBufferToBase64(buf)
        const out = await env.AI.run(WHISPER_MODEL, { audio })
        return json({ text: (out && out.text ? out.text : '').trim() }, 200, cors)
      } catch (e) {
        return json({ error: 'Transcription failed', detail: String(e) }, 502, cors)
      }
    }

    // --- Anthropic proxy (everything else) ---
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'Server is missing ANTHROPIC_API_KEY. Run: wrangler secret put ANTHROPIC_API_KEY' }, 500, cors)
    }
    const target = UPSTREAM + url.pathname + url.search // e.g. /v1/messages
    const body = await request.text()
    let upstreamResp
    try {
      upstreamResp = await fetch(target, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01',
        },
        body,
      })
    } catch (e) {
      return json({ error: 'Upstream request failed', detail: String(e) }, 502, cors)
    }
    const headers = new Headers()
    headers.set('content-type', upstreamResp.headers.get('content-type') || 'application/json')
    for (const [k, v] of Object.entries(cors)) headers.set(k, v)
    return new Response(upstreamResp.body, { status: upstreamResp.status, headers })
  },
}

function arrayBufferToBase64(buf) {
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  })
}
