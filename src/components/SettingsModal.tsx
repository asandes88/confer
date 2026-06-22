import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Key, Eye, EyeOff, Cpu, Globe, ExternalLink, ShieldCheck } from 'lucide-react'

const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — balanced (recommended)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — fastest & cheapest' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 — highest quality' },
]

const LANGS = [
  { id: 'en-US', label: 'English (US)' },
  { id: 'en-GB', label: 'English (UK)' },
  { id: 'es-ES', label: 'Spanish (Spain)' },
  { id: 'es-419', label: 'Spanish (Latin America)' },
  { id: 'pt-BR', label: 'Portuguese (Brazil)' },
  { id: 'fr-FR', label: 'French' },
  { id: 'de-DE', label: 'German' },
  { id: 'it-IT', label: 'Italian' },
  { id: 'nl-NL', label: 'Dutch' },
  { id: 'zh-CN', label: 'Chinese (Mandarin)' },
  { id: 'ja-JP', label: 'Japanese' },
]

interface Props {
  open: boolean
  apiKey: string
  model: string
  lang: string
  onClose: () => void
  onSave: (v: { apiKey: string; model: string; lang: string }) => void
}

export default function SettingsModal({ open, apiKey, model, lang, onClose, onSave }: Props) {
  const [key, setKey] = useState(apiKey)
  const [m, setM] = useState(model)
  const [l, setL] = useState(lang)
  const [reveal, setReveal] = useState(false)

  function handleSave() {
    onSave({ apiKey: key, model: m, lang: l })
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="glass relative w-full max-w-lg rounded-3xl p-6 shadow-2xl"
            initial={{ scale: 0.94, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 10, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Settings</h2>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-white/80">
              <Key size={15} className="text-violet-400" /> Claude API key
            </label>
            <div className="relative">
              <input
                type={reveal ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-ant-..."
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 pr-10 font-mono text-sm outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80"
              >
                {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-cyan-300/80 hover:text-cyan-200"
            >
              Get a key from the Anthropic Console <ExternalLink size={12} />
            </a>

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/55">
              <ShieldCheck size={26} className="shrink-0 text-emerald-400/80" />
              <span>
                Your key is stored only in this browser (localStorage) and is sent directly to Anthropic. It never
                touches any other server.
              </span>
            </div>

            <label className="mb-1.5 mt-5 flex items-center gap-2 text-sm font-medium text-white/80">
              <Cpu size={15} className="text-violet-400" /> Insight model
            </label>
            <select
              value={m}
              onChange={(e) => setM(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-400/60"
            >
              {MODELS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-[#12121a]">
                  {opt.label}
                </option>
              ))}
            </select>

            <label className="mb-1.5 mt-5 flex items-center gap-2 text-sm font-medium text-white/80">
              <Globe size={15} className="text-violet-400" /> Transcription language
            </label>
            <select
              value={l}
              onChange={(e) => setL(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-400/60"
            >
              {LANGS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-[#12121a]">
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              onClick={handleSave}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 active:scale-[0.99]"
            >
              Save settings
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
