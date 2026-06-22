import Anthropic from '@anthropic-ai/sdk'
import type { Company, CompanyInsight, OverviewInsight } from '../types'

// If a proxy URL is baked in at build time (VITE_PROXY_URL), all requests go
// through it and the user's own key is not needed — the key lives server-side
// in the proxy. Otherwise we fall back to the user pasting their own key.
const PROXY_URL = (import.meta.env.VITE_PROXY_URL ?? '').trim().replace(/\/+$/, '')

/** True when a secure proxy is configured, so end users don't need a key. */
export const usingProxy = PROXY_URL.length > 0

export function makeClient(apiKey: string): Anthropic {
  if (usingProxy) {
    // Key is injected by the proxy; the placeholder is never used upstream.
    return new Anthropic({ apiKey: 'via-proxy', baseURL: PROXY_URL, dangerouslyAllowBrowser: true })
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

function extractJson(text: string): string {
  // Strip ```json fences and grab the outermost {...}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start !== -1 && end !== -1) return body.slice(start, end + 1)
  return body
}

async function complete(client: Anthropic, model: string, system: string, user: string): Promise<string> {
  const res = await client.messages.create({
    model,
    max_tokens: 1800,
    temperature: 0.3,
    system,
    messages: [{ role: 'user', content: user }],
  })
  const block = res.content.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

const COMPANY_SYSTEM = `You are an elite business-development analyst. A salesperson dictated rough voice notes after meeting a company at a conference or trade show. The notes are raw speech-to-text and may contain transcription errors, filler words, and fragments — infer intent intelligently.

Produce a crisp, actionable intelligence record. Respond with ONLY a JSON object, no prose, matching exactly:
{
  "summary": "2-3 sentence executive summary of the conversation and what this company does / wants",
  "keyTopics": ["short topic", "..."],
  "sentiment": "Hot" | "Warm" | "Cool" | "Unknown",
  "priority": "High" | "Medium" | "Low",
  "nextSteps": ["concrete action starting with a verb", "..."],
  "productsDiscussed": ["..."],
  "peopleMentioned": ["Name — role if known", "..."],
  "followUpEmailDraft": "a warm, concise, ready-to-send follow-up email (greeting, 2-3 short paragraphs, sign-off as [Your Name])"
}

Rules: sentiment reflects buying intent / warmth. priority reflects how valuable this opportunity looks. Keep arrays to the most important 3-6 items. If a field is unknown, use an empty array or "Unknown". Never invent specific facts not implied by the notes.`

const OVERVIEW_SYSTEM = `You are a strategic sales lead reviewing all company conversations from a single conference. Synthesize across companies. Respond with ONLY a JSON object:
{
  "headline": "one punchy sentence summarizing how the conference went",
  "topOpportunities": ["Company — why it's a top opportunity", "..."],
  "themes": ["cross-cutting market/theme observation", "..."],
  "recommendedActions": ["prioritized action for the week after", "..."]
}
Keep each array to 3-6 items.`

export async function generateCompanyInsight(
  client: Anthropic,
  model: string,
  company: Company,
): Promise<CompanyInsight> {
  const notes = company.notes.map((n, i) => `${i + 1}. ${n.text}`).join('\n')
  const user = `Company: ${company.name}\n\nVoice notes:\n${notes || '(no notes captured)'}`
  const raw = await complete(client, model, COMPANY_SYSTEM, user)
  const parsed = JSON.parse(extractJson(raw)) as Partial<CompanyInsight>
  return {
    summary: parsed.summary ?? '',
    keyTopics: parsed.keyTopics ?? [],
    sentiment: parsed.sentiment ?? 'Unknown',
    priority: parsed.priority ?? 'Medium',
    nextSteps: parsed.nextSteps ?? [],
    productsDiscussed: parsed.productsDiscussed ?? [],
    peopleMentioned: parsed.peopleMentioned ?? [],
    followUpEmailDraft: parsed.followUpEmailDraft ?? '',
  }
}

export async function generateOverview(
  client: Anthropic,
  model: string,
  conferenceName: string,
  companies: Company[],
): Promise<OverviewInsight> {
  const digest = companies
    .map(
      (c) =>
        `### ${c.name}\nSentiment: ${c.insight?.sentiment ?? 'Unknown'} | Priority: ${
          c.insight?.priority ?? '—'
        }\nSummary: ${c.insight?.summary ?? '(none)'}\nNext steps: ${(c.insight?.nextSteps ?? []).join('; ')}`,
    )
    .join('\n\n')
  const user = `Conference: ${conferenceName}\nCompanies met: ${companies.length}\n\n${digest}`
  const raw = await complete(client, model, OVERVIEW_SYSTEM, user)
  const parsed = JSON.parse(extractJson(raw)) as Partial<OverviewInsight>
  return {
    headline: parsed.headline ?? '',
    topOpportunities: parsed.topOpportunities ?? [],
    themes: parsed.themes ?? [],
    recommendedActions: parsed.recommendedActions ?? [],
  }
}
