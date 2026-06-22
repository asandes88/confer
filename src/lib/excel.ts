import * as XLSX from 'xlsx'
import type { Conference } from '../types'

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function safeSheetName(name: string): string {
  return (name || 'Conference').replace(/[\\/?*[\]:]/g, ' ').slice(0, 28)
}

export function exportConference(conf: Conference): void {
  const wb = XLSX.utils.book_new()

  // --- Sheet 1: Conference Overview ---
  const ov = conf.overview
  const overviewRows: (string | number)[][] = [
    ['CONFERENCE REPORT'],
    [conf.name],
    ['Generated', fmtDate(Date.now())],
    ['Companies met', conf.companies.length],
    [],
    ['Headline', ov?.headline ?? '—'],
    [],
    ['Top Opportunities'],
    ...(ov?.topOpportunities ?? ['—']).map((t) => ['', t]),
    [],
    ['Cross-cutting Themes'],
    ...(ov?.themes ?? ['—']).map((t) => ['', t]),
    [],
    ['Recommended Actions (next week)'],
    ...(ov?.recommendedActions ?? ['—']).map((t) => ['', t]),
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(overviewRows)
  ws1['!cols'] = [{ wch: 28 }, { wch: 90 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Overview')

  // --- Sheet 2: Companies (one row each) ---
  const header = [
    'Company',
    'Sentiment',
    'Priority',
    'Summary',
    'Key Topics',
    'Products Discussed',
    'People Mentioned',
    'Next Steps',
    'Follow-up Email Draft',
    '# Notes',
    'Raw Notes',
  ]
  const rows = conf.companies.map((c) => {
    const i = c.insight
    return [
      c.name,
      i?.sentiment ?? 'Unknown',
      i?.priority ?? '',
      i?.summary ?? '',
      (i?.keyTopics ?? []).join('\n'),
      (i?.productsDiscussed ?? []).join('\n'),
      (i?.peopleMentioned ?? []).join('\n'),
      (i?.nextSteps ?? []).map((s, idx) => `${idx + 1}. ${s}`).join('\n'),
      i?.followUpEmailDraft ?? '',
      c.notes.length,
      c.notes.map((n) => `• ${n.text}`).join('\n'),
    ]
  })
  const ws2 = XLSX.utils.aoa_to_sheet([header, ...rows])
  ws2['!cols'] = [
    { wch: 22 },
    { wch: 10 },
    { wch: 9 },
    { wch: 48 },
    { wch: 28 },
    { wch: 24 },
    { wch: 24 },
    { wch: 50 },
    { wch: 60 },
    { wch: 8 },
    { wch: 60 },
  ]
  ws2['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) }
  XLSX.utils.book_append_sheet(wb, ws2, 'Companies')

  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${safeSheetName(conf.name)} — ${stamp}.xlsx`, { compression: true })
}
