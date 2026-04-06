import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AipMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface AipState {
  isOpen: boolean
  messages: AipMessage[]
  isLoading: boolean
  togglePanel: () => void
  addMessage: (role: AipMessage['role'], content: string) => void
  setLoading: (v: boolean) => void
  clearHistory: () => void
}

export const useAipStore = create<AipState>()(
  persist(
    (set) => ({
      isOpen: false,
      messages: [],
      isLoading: false,

      togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),

      addMessage: (role, content) =>
        set((s) => ({
          messages: [
            ...s.messages,
            {
              id: crypto.randomUUID(),
              role,
              content,
              timestamp: new Date().toISOString(),
            },
          ],
        })),

      setLoading: (v) => set({ isLoading: v }),

      clearHistory: () => set({ messages: [] }),
    }),
    {
      name: 'cdata-aip-history',
      partialize: (s) => ({ messages: s.messages }),
    }
  )
)
