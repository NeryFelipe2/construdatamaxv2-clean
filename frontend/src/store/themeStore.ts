import { create } from 'zustand'

export type LayoutTheme = 'ekyte' | 'dark' | 'light'

interface ThemeState {
  theme: LayoutTheme
  setTheme: (t: LayoutTheme) => void
  cycleTheme: () => void
}

const THEME_KEY = 'cdata-theme'
const VALID: LayoutTheme[] = ['ekyte', 'dark', 'light']

function applyTheme(t: LayoutTheme) {
  document.documentElement.setAttribute('data-theme', t)
}

// Read persisted theme (default to ekyte for the new layout)
const raw = localStorage.getItem(THEME_KEY) ?? 'dark'
const saved: LayoutTheme = VALID.includes(raw as LayoutTheme) ? (raw as LayoutTheme) : 'dark'
applyTheme(saved)

export const useThemeStore = create<ThemeState>((set) => ({
  theme: saved,
  setTheme: (t) => {
    localStorage.setItem(THEME_KEY, t)
    applyTheme(t)
    set({ theme: t })
  },
  cycleTheme: () =>
    set((s) => {
      const idx = VALID.indexOf(s.theme)
      const next = VALID[(idx + 1) % VALID.length]
      localStorage.setItem(THEME_KEY, next)
      applyTheme(next)
      return { theme: next }
    }),
}))
