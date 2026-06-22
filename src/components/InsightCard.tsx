import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ListChecks, Tags, Package, Users, Mail, Copy, Check } from 'lucide-react'
import type { CompanyInsight } from '../types'

const sentimentStyle: Record<string, string> = {
  Hot: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  Warm: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Cool: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Unknown: 'bg-white/10 text-white/50 border-white/15',
}
const priorityStyle: Record<string, string> = {
  High: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  Medium: 'bg-white/10 text-white/60 border-white/15',
  Low: 'bg-white/5 text-white/40 border-white/10',
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/45">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

export default function InsightCard({ insight }: { insight: CompanyInsight }) {
  const [copied, setCopied] = useState(false)

  function copyEmail() {
    navigator.clipboard.writeText(insight.followUpEmailDraft).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass mt-5 rounded-2xl p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-200">
          <Sparkles size={16} className="text-violet-400" /> AI Insight
        </div>
        <div className="flex gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${sentimentStyle[insight.sentiment]}`}>
            {insight.sentiment}
          </span>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${priorityStyle[insight.priority]}`}>
            {insight.priority} priority
          </span>
        </div>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-white/80">{insight.summary}</p>

      <div className="grid gap-5 sm:grid-cols-2">
        {insight.nextSteps.length > 0 && (
          <Section icon={<ListChecks size={13} />} title="Next steps">
            <ul className="space-y-1.5">
              {insight.nextSteps.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-white/75">
                  <span className="mt-0.5 text-cyan-400">→</span>
                  {s}
                </li>
              ))}
            </ul>
          </Section>
        )}
        {insight.keyTopics.length > 0 && (
          <Section icon={<Tags size={13} />} title="Key topics">
            <div className="flex flex-wrap gap-1.5">
              {insight.keyTopics.map((t, i) => (
                <span key={i} className="rounded-lg bg-white/[0.06] px-2 py-1 text-xs text-white/70">
                  {t}
                </span>
              ))}
            </div>
          </Section>
        )}
        {insight.productsDiscussed.length > 0 && (
          <Section icon={<Package size={13} />} title="Products discussed">
            <ul className="space-y-1 text-sm text-white/75">
              {insight.productsDiscussed.map((p, i) => (
                <li key={i}>• {p}</li>
              ))}
            </ul>
          </Section>
        )}
        {insight.peopleMentioned.length > 0 && (
          <Section icon={<Users size={13} />} title="People">
            <ul className="space-y-1 text-sm text-white/75">
              {insight.peopleMentioned.map((p, i) => (
                <li key={i}>• {p}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {insight.followUpEmailDraft && (
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/45">
              <Mail size={13} /> Follow-up email draft
            </div>
            <button
              onClick={copyEmail}
              className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-xs text-white/70 transition hover:bg-white/10"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3.5 font-sans text-sm leading-relaxed text-white/70">
            {insight.followUpEmailDraft}
          </pre>
        </div>
      )}
    </motion.div>
  )
}
