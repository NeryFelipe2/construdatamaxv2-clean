/**
 * companySettingsStore — Manages company logos and branding for PDF exports.
 * Persisted in localStorage.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CompanyLogo {
  id: string
  name: string
  base64: string
  createdAt: string
}

interface CompanySettingsState {
  companyName: string
  logos: CompanyLogo[]
  setCompanyName: (name: string) => void
  addLogo: (name: string, base64: string) => void
  removeLogo: (id: string) => void
}

export const useCompanySettingsStore = create<CompanySettingsState>()(
  persist(
    (set) => ({
      companyName: 'ConstruData Engenharia',
      logos: [],

      setCompanyName: (name) => set({ companyName: name }),

      addLogo: (name, base64) =>
        set((state) => ({
          logos: [
            ...state.logos,
            {
              id: crypto.randomUUID(),
              name,
              base64,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      removeLogo: (id) =>
        set((state) => ({
          logos: state.logos.filter((l) => l.id !== id),
        })),
    }),
    {
      name: 'cdata-company-settings',
    },
  ),
)
