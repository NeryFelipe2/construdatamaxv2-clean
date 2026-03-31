import { create } from 'zustand'

type Theme = 'dark' | 'light'

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
}

// Apply persisted theme immediately on module load (before React renders)
const saved = (localStorage.getItem('cdata-theme') ?? 'dark') as Theme
applyTheme(saved)

export const useThemeStore = create<ThemeState>((set) => ({
  theme: saved,
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('cdata-theme', next)
      applyTheme(next)
      return { theme: next }
    }),
}))
