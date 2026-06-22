import type { AppState } from '../types'

const STATE_KEY = 'confer.state.v1'
const KEY_KEY = 'confer.apiKey.v1'
const MODEL_KEY = 'confer.model.v1'
const LANG_KEY = 'confer.lang.v1'

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (raw) return JSON.parse(raw) as AppState
  } catch {
    /* ignore */
  }
  return { conferences: [], activeConferenceId: null }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}

export function loadApiKey(): string {
  return localStorage.getItem(KEY_KEY) ?? ''
}

export function saveApiKey(key: string): void {
  localStorage.setItem(KEY_KEY, key.trim())
}

export function loadModel(): string {
  return localStorage.getItem(MODEL_KEY) ?? 'claude-sonnet-4-6'
}

export function saveModel(model: string): void {
  localStorage.setItem(MODEL_KEY, model)
}

export function loadLang(): string {
  return localStorage.getItem(LANG_KEY) ?? 'en-US'
}

export function saveLang(lang: string): void {
  localStorage.setItem(LANG_KEY, lang)
}
