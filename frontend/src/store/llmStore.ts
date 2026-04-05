/**
 * llmStore.ts — Gerencia API keys dos 4 LLMs gratuitos e chamadas.
 * Keys salvos no localStorage (nunca vao pro Supabase por seguranca).
 */
import { create } from 'zustand'

const STORAGE_KEY = 'cdata-llm-keys'

export interface LlmProvider {
  id: string
  name: string
  envKey: string
  models: Record<string, string>
  freeLimit: string
  urlKey: string
  capabilities: string[]
}

export const LLM_PROVIDERS: LlmProvider[] = [
  {
    id: 'gemini', name: 'Gemini Flash', envKey: 'GEMINI_API_KEY',
    models: { flash: 'gemini-2.5-flash', pro: 'gemini-2.5-pro' },
    freeLimit: '500 req/dia', urlKey: 'https://aistudio.google.com/app/apikey',
    capabilities: ['visao', 'pdf', 'texto', 'codigo'],
  },
  {
    id: 'groq', name: 'Groq (Llama 3.3)', envKey: 'GROQ_API_KEY',
    models: { llama: 'llama-3.3-70b-versatile', mixtral: 'mixtral-8x7b-32768' },
    freeLimit: '30 req/min', urlKey: 'https://console.groq.com/keys',
    capabilities: ['texto', 'codigo', 'rapido'],
  },
  {
    id: 'mistral', name: 'Mistral Large', envKey: 'MISTRAL_API_KEY',
    models: { large: 'mistral-large-latest', small: 'mistral-small-latest' },
    freeLimit: '1M tokens/mes', urlKey: 'https://console.mistral.ai/api-keys',
    capabilities: ['texto', 'escrita', 'raciocinio'],
  },
  {
    id: 'cohere', name: 'Cohere Command-R', envKey: 'COHERE_API_KEY',
    models: { command: 'command', light: 'command-r-08-2024' },
    freeLimit: '1000 req/mes', urlKey: 'https://dashboard.cohere.com/api-keys',
    capabilities: ['texto', 'rag', 'dados'],
  },
]

// Roteamento: modulo → provider preferido
export const LLM_ROUTING: Record<string, string[]> = {
  foto: ['gemini'],
  pdf: ['gemini'],
  consulta: ['groq', 'mistral', 'cohere'],
  resumo: ['mistral', 'groq', 'cohere'],
  lps: ['groq', 'mistral'],
  perdas: ['cohere', 'groq', 'mistral'],
  hidraulica: ['groq', 'mistral'],
  ml_explicacao: ['mistral', 'groq'],
  chat: ['groq', 'mistral', 'cohere'],
}

interface LlmState {
  keys: Record<string, string>  // provider_id → api_key
  loading: boolean
  lastResponse: string | null
  lastError: string | null

  setKey: (provider: string, key: string) => void
  removeKey: (provider: string) => void
  getKey: (provider: string) => string | null
  isConfigured: (provider: string) => boolean
  configuredProviders: () => string[]
  callLlm: (module: string, prompt: string) => Promise<string>
}

function loadKeys(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveKeys(keys: Record<string, string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(keys)) } catch { /* noop */ }
}

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export const useLlmStore = create<LlmState>((set, get) => ({
  keys: loadKeys(),
  loading: false,
  lastResponse: null,
  lastError: null,

  setKey: (provider, key) => {
    const keys = { ...get().keys, [provider]: key }
    saveKeys(keys)
    set({ keys })
  },

  removeKey: (provider) => {
    const keys = { ...get().keys }
    delete keys[provider]
    saveKeys(keys)
    set({ keys })
  },

  getKey: (provider) => get().keys[provider] ?? null,
  isConfigured: (provider) => !!get().keys[provider],
  configuredProviders: () => Object.keys(get().keys).filter(k => !!get().keys[k]),

  callLlm: async (module, prompt) => {
    set({ loading: true, lastError: null, lastResponse: null })

    const routing = LLM_ROUTING[module] ?? LLM_ROUTING.chat
    const keys = get().keys
    const provider = routing.find(p => !!keys[p])

    if (!provider) {
      const err = 'Nenhuma API key configurada. Va em IA & Analytics > Configurar API Keys.'
      set({ loading: false, lastError: err })
      return err
    }

    try {
      // Call backend endpoint
      const url = API_BASE ? `${API_BASE}/api/llm/query` : '/api/llm/query'
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key: keys[provider], prompt, module }),
      })

      if (!r.ok) {
        // Fallback: call provider API directly from frontend
        const result = await callProviderDirect(provider, keys[provider], prompt)
        set({ loading: false, lastResponse: result })
        return result
      }

      const data = await r.json()
      const result = data.response ?? data.text ?? JSON.stringify(data)
      set({ loading: false, lastResponse: result })
      return result
    } catch {
      // Fallback: direct API call
      try {
        const result = await callProviderDirect(provider, keys[provider], prompt)
        set({ loading: false, lastResponse: result })
        return result
      } catch (e) {
        const err = e instanceof Error ? e.message : 'Erro ao chamar LLM'
        set({ loading: false, lastError: err })
        return err
      }
    }
  },
}))

// Direct API calls (frontend-only fallback when backend unavailable)
async function callProviderDirect(provider: string, apiKey: string, prompt: string): Promise<string> {
  switch (provider) {
    case 'groq': {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.2 }),
      })
      const d = await r.json()
      return d.choices?.[0]?.message?.content ?? d.error?.message ?? 'Sem resposta'
    }
    case 'mistral': {
      const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'mistral-large-latest', messages: [{ role: 'user', content: prompt }], temperature: 0.2 }),
      })
      const d = await r.json()
      return d.choices?.[0]?.message?.content ?? d.error?.message ?? 'Sem resposta'
    }
    case 'gemini': {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      })
      const d = await r.json()
      return d.candidates?.[0]?.content?.parts?.[0]?.text ?? d.error?.message ?? 'Sem resposta'
    }
    case 'cohere': {
      const r = await fetch('https://api.cohere.ai/v1/chat', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, model: 'command-r-08-2024' }),
      })
      const d = await r.json()
      return d.text ?? d.message ?? 'Sem resposta'
    }
    default:
      return 'Provider nao suportado'
  }
}
