// Confer API proxy — a tiny Cloudflare Worker that keeps your Anthropic API key
// server-side. The browser app calls this Worker; the Worker injects the secret
// key (set via `wrangler secret put ANTHROPIC_API_KEY`) and forwards to Anthropic.
//
// The key is NEVER shipped to the browser, so end users never enter anything.

const UPSTREAM = 'https://api.anthropic.com'

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

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, cors)
    }

    // Lightweight abuse guard: browsers always send Origin on cross-origin calls.
    // (Set ALLOWED_ORIGIN in wrangler.toml to your site to lock this down.)
    if (allowed !== '*' && reqOrigin && reqOrigin !== allowed) {
      return json({ error: 'Origin not allowed' }, 403, cors)
    }

    if (!env.ANTHROPIC_API_KEY) {
      return json(
        { error: 'Server is missing ANTHROPIC_API_KEY. Run: wrangler secret put ANTHROPIC_API_KEY' },
        500,
        cors,
      )
    }

    const url = new URL(request.url)
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

    // Pass the Anthropic response straight back, with CORS headers added.
    const headers = new Headers()
    headers.set('content-type', upstreamResp.headers.get('content-type') || 'application/json')
    for (const [k, v] of Object.entries(cors)) headers.set(k, v)
    return new Response(upstreamResp.body, { status: upstreamResp.status, headers })
  },
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  })
}
