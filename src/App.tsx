import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  Square,
  Settings as SettingsIcon,
  Plus,
  Trash2,
  Building2,
  FileSpreadsheet,
  ChevronDown,
  Sparkles,
  Loader2,
  AlertTriangle,
  Check,
  X,
  Calendar,
} from 'lucide-react'
import type { AppState, Company, Conference } from './types'
import {
  loadState,
  saveState,
  loadApiKey,
  saveApiKey,
  loadModel,
  saveModel,
  loadLang,
  saveLang,
} from './lib/storage'
import { uid } from './lib/id'
import { useSpeech } from './lib/speech'
import { makeClient, generateCompanyInsight, generateOverview } from './lib/ai'
import { exportConference } from './lib/excel'
import SettingsModal from './components/SettingsModal'
import InsightCard from './components/InsightCard'

interface ExportState {
  active: boolean
  done: number
  total: number
  step: string
  error?: string
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [apiKey, setApiKeyState] = useState(() => loadApiKey())
  const [model, setModelState] = useState(() => loadModel())
  const [lang, setLangState] = useState(() => loadLang())

  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [confMenuOpen, setConfMenuOpen] = useState(false)
  const [addingCompany, setAddingCompany] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newConfName, setNewConfName] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [exp, setExp] = useState<ExportState>({ active: false, done: 0, total: 0, step: '' })

  const speech = useSpeech()
  const activeCompanyIdRef = useRef<string | null>(null)
  const notesEndRef = useRef<HTMLDivElement | null>(null)

  // Persist
  useEffect(() => saveState(state), [state])
  useEffect(() => {
    activeCompanyIdRef.current = activeCompanyId
  }, [activeCompanyId])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const activeConf = useMemo(
    () => state.conferences.find((c) => c.id === state.activeConferenceId) ?? null,
    [state],
  )
  const activeCompany = useMemo(
    () => activeConf?.companies.find((c) => c.id === activeCompanyId) ?? null,
    [activeConf, activeCompanyId],
  )

  // Keep an active company selected
  useEffect(() => {
    if (!activeConf) {
      setActiveCompanyId(null)
      return
    }
    if (!activeConf.companies.some((c) => c.id === activeCompanyId)) {
      setActiveCompanyId(activeConf.companies[0]?.id ?? null)
    }
  }, [activeConf, activeCompanyId])

  // Auto-scroll notes
  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeCompany?.notes.length, speech.interim])

  // ---- mutators ----
  function updateConf(confId: string, fn: (c: Conference) => Conference) {
    setState((prev) => ({
      ...prev,
      conferences: prev.conferences.map((c) => (c.id === confId ? fn(c) : c)),
    }))
  }

  function createConference(name: string) {
    const conf: Conference = {
      id: uid(),
      name: name.trim() || 'Untitled conference',
      createdAt: Date.now(),
      companies: [],
    }
    setState((prev) => ({
      conferences: [conf, ...prev.conferences],
      activeConferenceId: conf.id,
    }))
    setNewConfName('')
    setConfMenuOpen(false)
  }

  function addCompany(name: string) {
    if (!activeConf) return
    const company: Company = { id: uid(), name: name.trim() || `Company ${activeConf.companies.length + 1}`, notes: [] }
    updateConf(activeConf.id, (c) => ({ ...c, companies: [...c.companies, company] }))
    setActiveCompanyId(company.id)
    setNewCompanyName('')
    setAddingCompany(false)
  }

  function deleteCompany(id: string) {
    if (!activeConf) return
    updateConf(activeConf.id, (c) => ({ ...c, companies: c.companies.filter((x) => x.id !== id) }))
  }

  function renameCompany(id: string, name: string) {
    if (!activeConf) return
    updateConf(activeConf.id, (c) => ({
      ...c,
      companies: c.companies.map((x) => (x.id === id ? { ...x, name } : x)),
    }))
  }

  const appendNoteToActive = useCallback((text: string) => {
    const cid = activeCompanyIdRef.current
    setState((prev) => {
      if (!prev.activeConferenceId) return prev
      return {
        ...prev,
        conferences: prev.conferences.map((conf) => {
          if (conf.id !== prev.activeConferenceId) return conf
          return {
            ...conf,
            companies: conf.companies.map((co) =>
              co.id === cid
                ? { ...co, notes: [...co.notes, { id: uid(), text, createdAt: Date.now() }] }
                : co,
            ),
          }
        }),
      }
    })
  }, [])

  function deleteNote(noteId: string) {
    if (!activeConf || !activeCompany) return
    updateConf(activeConf.id, (c) => ({
      ...c,
      companies: c.companies.map((co) =>
        co.id === activeCompany.id ? { ...co, notes: co.notes.filter((n) => n.id !== noteId) } : co,
      ),
    }))
  }

  // ---- recording ----
  function toggleRecord() {
    if (speech.listening) {
      speech.stop()
    } else {
      if (!activeCompany) {
        setToast('Add a company first')
        return
      }
      speech.start(lang, appendNoteToActive)
    }
  }

  // ---- settings ----
  function saveSettings(v: { apiKey: string; model: string; lang: string }) {
    setApiKeyState(v.apiKey)
    saveApiKey(v.apiKey)
    setModelState(v.model)
    saveModel(v.model)
    setLangState(v.lang)
    saveLang(v.lang)
  }

  // ---- export ----
  async function endAndExport() {
    if (!activeConf) return
    if (speech.listening) speech.stop()
    if (!apiKey) {
      setToast('Add your Claude API key in Settings first')
      setShowSettings(true)
      return
    }
    const withNotes = activeConf.companies.filter((c) => c.notes.length > 0)
    if (withNotes.length === 0) {
      setToast('Capture some notes first')
      return
    }

    const client = makeClient(apiKey)
    const total = withNotes.length + 1
    setExp({ active: true, done: 0, total, step: 'Starting analysis…' })
    try {
      const updated: Company[] = [...activeConf.companies]
      for (let i = 0; i < withNotes.length; i++) {
        const c = withNotes[i]
        setExp({ active: true, done: i, total, step: `Analyzing ${c.name}…` })
        const insight = await generateCompanyInsight(client, model, c)
        const idx = updated.findIndex((x) => x.id === c.id)
        updated[idx] = { ...updated[idx], insight }
      }
      setExp({ active: true, done: withNotes.length, total, step: 'Synthesizing conference overview…' })
      const overview = await generateOverview(client, model, activeConf.name, updated.filter((c) => c.notes.length > 0))
      const finalConf: Conference = { ...activeConf, companies: updated, overview }
      updateConf(activeConf.id, () => finalConf)
      setExp({ active: true, done: total, total, step: 'Building spreadsheet…' })
      exportConference(finalConf)
      setExp({ active: false, done: total, total, step: 'Done' })
      setToast('Report downloaded ✓')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      setExp((s) => ({ ...s, error: msg, step: 'Failed' }))
    }
  }

  const totalNotes = activeConf?.companies.reduce((n, c) => n + c.notes.length, 0) ?? 0

  return (
    <div className="relative min-h-full">
      <div className="aurora" />

      <div className="safe-top pb-bar relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-4 sm:px-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-900/40">
              <Mic size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight">Confer</h1>
              <p className="text-[11px] text-white/40">Voice intelligence for conferences</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className={`-mr-1.5 rounded-full p-2.5 transition hover:bg-white/10 ${
              apiKey ? 'text-white/60' : 'text-amber-400'
            }`}
            title="Settings"
            aria-label="Settings"
          >
            <SettingsIcon size={20} />
          </button>
        </header>

        {!activeConf ? (
          /* ---- Empty state: create conference ---- */
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass w-full max-w-md rounded-3xl p-8"
            >
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-400/20">
                <Calendar className="text-violet-300" />
              </div>
              <h2 className="text-xl font-semibold">Start a new conference</h2>
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-white/50">
                Name the event you're attending. Then capture a voice note at every booth.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  createConference(newConfName)
                }}
                className="mt-6 flex flex-col gap-3"
              >
                <input
                  autoFocus
                  value={newConfName}
                  onChange={(e) => setNewConfName(e.target.value)}
                  placeholder="e.g. CES 2026, Las Vegas"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-3 font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 active:scale-[0.99]"
                >
                  Create conference
                </button>
              </form>
            </motion.div>
          </div>
        ) : (
          <>
            {/* Conference switcher */}
            <div className="relative mt-5">
              <button
                onClick={() => setConfMenuOpen((o) => !o)}
                className="glass flex w-full items-center justify-between rounded-2xl px-4 py-3 transition hover:border-white/15"
              >
                <div className="flex items-center gap-3 text-left">
                  <Calendar size={18} className="text-violet-300" />
                  <div>
                    <div className="font-semibold leading-tight">{activeConf.name}</div>
                    <div className="text-[11px] text-white/40">
                      {activeConf.companies.length} companies · {totalNotes} notes
                    </div>
                  </div>
                </div>
                <ChevronDown size={18} className={`text-white/40 transition ${confMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {confMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="glass absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl p-2"
                  >
                    {state.conferences.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setState((prev) => ({ ...prev, activeConferenceId: c.id }))
                          setConfMenuOpen(false)
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-white/10 ${
                          c.id === activeConf.id ? 'text-violet-200' : 'text-white/70'
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        {c.id === activeConf.id && <Check size={15} className="text-violet-300" />}
                      </button>
                    ))}
                    <div className="my-1.5 h-px bg-white/10" />
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (newConfName.trim()) createConference(newConfName)
                      }}
                      className="flex items-center gap-2 px-1"
                    >
                      <input
                        value={newConfName}
                        onChange={(e) => setNewConfName(e.target.value)}
                        placeholder="New conference name…"
                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-violet-400/60"
                      />
                      <button
                        type="submit"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-600 text-white transition hover:brightness-110"
                      >
                        <Plus size={16} />
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Company rail */}
            <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1.5 sm:mx-0 sm:px-0">
              {activeConf.companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCompanyId(c.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition ${
                    c.id === activeCompanyId
                      ? 'border-violet-400/50 bg-violet-500/15 text-white'
                      : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.07]'
                  }`}
                >
                  <Building2 size={14} className={c.id === activeCompanyId ? 'text-violet-300' : 'text-white/40'} />
                  <span className="max-w-[140px] truncate">{c.name}</span>
                  {c.notes.length > 0 && (
                    <span className="rounded-full bg-white/10 px-1.5 text-[11px] text-white/60">{c.notes.length}</span>
                  )}
                  {c.insight && <Sparkles size={12} className="text-cyan-300" />}
                </button>
              ))}

              {addingCompany ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    addCompany(newCompanyName)
                  }}
                  className="flex shrink-0 items-center gap-1.5"
                >
                  <input
                    autoFocus
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    onBlur={() => !newCompanyName && setAddingCompany(false)}
                    placeholder="Company name…"
                    className="w-40 rounded-full border border-violet-400/40 bg-black/30 px-3.5 py-2 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    className="grid h-9 w-9 place-items-center rounded-full bg-violet-600 text-white transition hover:brightness-110"
                  >
                    <Check size={16} />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setAddingCompany(true)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-white/20 px-3.5 py-2 text-sm text-white/50 transition hover:border-white/40 hover:text-white/80"
                >
                  <Plus size={15} /> Company
                </button>
              )}
            </div>

            {/* Main panel */}
            {!activeCompany ? (
              <div className="mt-16 text-center text-white/40">
                <Building2 className="mx-auto mb-3 opacity-40" size={40} />
                <p className="text-sm">Add the first company you visit to start capturing notes.</p>
              </div>
            ) : (
              <main className="mt-5">
                {/* Company header */}
                <div className="flex items-center justify-between gap-3">
                  <input
                    value={activeCompany.name}
                    onChange={(e) => renameCompany(activeCompany.id, e.target.value)}
                    className="min-w-0 flex-1 truncate bg-transparent text-2xl font-bold outline-none focus:text-violet-200"
                  />
                  <button
                    onClick={() => deleteCompany(activeCompany.id)}
                    className="rounded-full p-2 text-white/30 transition hover:bg-rose-500/10 hover:text-rose-400"
                    title="Delete company"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                {/* Recorder */}
                <div className="glass mt-4 flex flex-col items-center rounded-3xl px-5 py-7">
                  <div className="relative grid place-items-center">
                    {speech.listening && (
                      <>
                        <span className="pulse-ring absolute h-20 w-20 rounded-full bg-rose-500/30" />
                        <span
                          className="pulse-ring absolute h-20 w-20 rounded-full bg-rose-500/20"
                          style={{ animationDelay: '1s' }}
                        />
                      </>
                    )}
                    <button
                      onClick={toggleRecord}
                      className={`relative grid h-20 w-20 place-items-center rounded-full text-white shadow-xl transition active:scale-95 ${
                        speech.listening
                          ? 'bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-900/40'
                          : 'bg-gradient-to-br from-violet-600 to-cyan-500 shadow-violet-900/40 hover:brightness-110'
                      }`}
                    >
                      {speech.listening ? <Square size={26} fill="currentColor" /> : <Mic size={30} />}
                    </button>
                  </div>

                  {speech.listening ? (
                    <div className="mt-5 flex items-end gap-1" aria-hidden>
                      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                        <span
                          key={i}
                          className="eq-bar w-1 rounded-full bg-gradient-to-t from-violet-500 to-cyan-400"
                          style={{ height: 22, animationDelay: `${i * 0.12}s` }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-white/50">
                      Tap to {activeCompany.notes.length ? 'add more notes' : 'start dictating'}
                    </p>
                  )}

                  {/* Live interim transcript */}
                  <AnimatePresence>
                    {(speech.listening || speech.interim) && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-4 min-h-[1.25rem] text-center text-sm italic text-white/45"
                      >
                        {speech.interim || 'Listening…'}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {speech.error && (
                    <p className="mt-3 max-w-sm text-center text-xs text-amber-400">{speech.error}</p>
                  )}
                  {!speech.supported && (
                    <p className="mt-3 max-w-sm text-center text-xs text-amber-400">
                      Voice capture needs Chrome or Edge. Please open Confer in one of those browsers.
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="mt-5 space-y-2">
                  {activeCompany.notes.length === 0 ? (
                    <p className="py-6 text-center text-sm text-white/30">
                      Notes you dictate will appear here, timestamped.
                    </p>
                  ) : (
                    activeCompany.notes.map((n) => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
                      >
                        <span className="mt-0.5 shrink-0 text-[11px] tabular-nums text-white/30">
                          {new Date(n.createdAt).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <p className="flex-1 text-sm leading-relaxed text-white/85">{n.text}</p>
                        <button
                          onClick={() => deleteNote(n.id)}
                          aria-label="Delete note"
                          className="-m-1.5 shrink-0 p-1.5 text-white/30 transition hover:text-rose-400 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                        >
                          <Trash2 size={15} />
                        </button>
                      </motion.div>
                    ))
                  )}
                  <div ref={notesEndRef} />
                </div>

                {/* Existing insight */}
                {activeCompany.insight && <InsightCard insight={activeCompany.insight} />}
              </main>
            )}
          </>
        )}
      </div>

      {/* Floating export bar */}
      {activeConf && totalNotes > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed inset-x-0 bottom-0 z-20"
        >
          <div className="safe-bottom mx-auto max-w-3xl px-4 sm:px-6">
            <button
              onClick={endAndExport}
              disabled={exp.active}
              className="glass flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-violet-600/90 to-cyan-500/90 px-5 py-3.5 font-semibold text-white shadow-2xl shadow-violet-950/50 backdrop-blur-xl transition hover:brightness-110 active:scale-[0.99] disabled:opacity-70"
            >
              {exp.active ? <Loader2 className="animate-spin" size={19} /> : <FileSpreadsheet size={19} />}
              {exp.active ? 'Generating report…' : 'End conference & export report'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Export progress / error overlay */}
      <AnimatePresence>
        {(exp.active || exp.error) && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass relative w-full max-w-sm rounded-3xl p-7 text-center"
            >
              {exp.error ? (
                <>
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-rose-500/15">
                    <AlertTriangle className="text-rose-400" />
                  </div>
                  <h3 className="font-semibold">Couldn't generate the report</h3>
                  <p className="mt-2 break-words text-sm text-white/50">{exp.error}</p>
                  <button
                    onClick={() => setExp({ active: false, done: 0, total: 0, step: '' })}
                    className="mt-5 w-full rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium transition hover:bg-white/10"
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-400/20">
                    <Sparkles className="animate-pulse text-violet-300" />
                  </div>
                  <h3 className="font-semibold">{exp.step}</h3>
                  <p className="mt-1 text-sm text-white/40">
                    {exp.done} / {exp.total} steps
                  </p>
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                      animate={{ width: `${exp.total ? (exp.done / exp.total) * 100 : 0}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="glass flex items-center gap-2 rounded-full px-4 py-2.5 text-sm shadow-xl">
              <span>{toast}</span>
              <button onClick={() => setToast(null)} className="text-white/40 hover:text-white">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsModal
        open={showSettings}
        apiKey={apiKey}
        model={model}
        lang={lang}
        onClose={() => setShowSettings(false)}
        onSave={saveSettings}
      />
    </div>
  )
}
