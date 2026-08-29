/**
 * dreStore.ts — Zustand store do módulo DRE & Resultado.
 * Guarda só a aba ativa (padrão do evmStore) para o DreHeader e o corpo
 * lerem/escreverem a mesma navegação (InsightsPanel troca de aba daqui).
 */
import { create } from 'zustand'

export type DreTab = 'dre' | 'fluxo' | 'fcp' | 'custos' | 'eficiencia'

interface DreState {
  activeTab: DreTab
  setActiveTab: (tab: DreTab) => void
}

export const useDreStore = create<DreState>((set) => ({
  activeTab: 'dre',
  setActiveTab: (activeTab) => set({ activeTab }),
}))
