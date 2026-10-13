/**
 * Global application mode store.
 * Controls whether the app shows rich mock/demo data or an empty "live" state.
 *
 * Security note: persists only a boolean flag (no sensitive data) to localStorage.
 */
import { create } from 'zustand'

interface AppModeState {
  isDemoMode: boolean
  toggleDemoMode: () => void
}

const STORAGE_KEY = 'cdata-demo'

// WCR é operação real, não vitrine de demo — o app abre sempre em modo AO VIVO
// por padrão (só liga demo se alguém ligar manualmente, e mesmo assim fica
// salvo só naquele navegador).
const savedRaw = localStorage.getItem(STORAGE_KEY)
const initialDemo: boolean = savedRaw === 'true'

export const useAppModeStore = create<AppModeState>((set) => ({
  isDemoMode: initialDemo,

  toggleDemoMode: () =>
    set((s) => {
      const next = !s.isDemoMode
      localStorage.setItem(STORAGE_KEY, String(next))

      // Cascade to all feature stores — import lazily to avoid circular deps
      if (next) {
        // Load demo data in each store
        import('./projetosStore').then(({ useProjetosStore }) => useProjetosStore.getState().loadDemoData())
        import('./agendaStore').then(({ useAgendaStore }) => useAgendaStore.getState().loadDemoData())
        import('./relatorio360Store').then(({ useRelatorio360Store }) => useRelatorio360Store.getState().loadDemoData())
        import('./equipamentosStore').then(({ useEquipamentosStore }) => useEquipamentosStore.getState().loadDemoData())
        import('./gestaoEquipamentosStore').then(({ useGestaoEquipamentosStore }) => useGestaoEquipamentosStore.getState().loadDemoData())
        import('./torreDeControleStore').then(({ useTorreStore }) => useTorreStore.getState().loadDemoData())
        import('./suprimentosStore').then(({ useSuprimentosStore }) => useSuprimentosStore.getState().loadDemoData())
        import('./preConstrucaoStore').then(({ usePreConstrucaoStore }) => usePreConstrucaoStore.getState().loadDemoData())
        import('./maoDeObraStore').then(({ useMaoDeObraStore }) => useMaoDeObraStore.getState().loadDemoData())
        import('./otimizacaoFrotaStore').then(({ useOtimizacaoFrotaStore }) => useOtimizacaoFrotaStore.getState().loadDemoData())
        import('./gestao360Store').then(({ useGestao360Store }) => useGestao360Store.getState().loadDemoData())
        import('./planejamentoStore').then(({ usePlanejamentoStore }) => usePlanejamentoStore.getState().loadDemoData())
        import('./rdoStore').then(({ useRdoStore }) => useRdoStore.getState().loadDemoData())
        import('./quantitativosStore').then(({ useQuantitativosStore }) => useQuantitativosStore.getState().loadDemoData())
        import('./bimStore').then(({ useBimStore }) => useBimStore.getState().loadDemoData())
        import('./lpsStore').then(({ useLpsStore }) => useLpsStore.getState().loadDemoData())
        import('./mapaInterativoStore').then(({ useMapaInterativoStore }) => useMapaInterativoStore.getState().loadDemoData())
        import('./evmStore').then(({ useEvmStore }) => useEvmStore.getState().loadDemoData())
      } else {
        // Clear all stores to empty state
        import('./projetosStore').then(({ useProjetosStore }) => useProjetosStore.getState().clearData())
        import('./agendaStore').then(({ useAgendaStore }) => useAgendaStore.getState().clearData())
        import('./relatorio360Store').then(({ useRelatorio360Store }) => useRelatorio360Store.getState().clearData())
        import('./equipamentosStore').then(({ useEquipamentosStore }) => useEquipamentosStore.getState().clearData())
        import('./gestaoEquipamentosStore').then(({ useGestaoEquipamentosStore }) => useGestaoEquipamentosStore.getState().clearData())
        import('./torreDeControleStore').then(({ useTorreStore }) => useTorreStore.getState().clearData())
        import('./suprimentosStore').then(({ useSuprimentosStore }) => useSuprimentosStore.getState().clearData())
        import('./preConstrucaoStore').then(({ usePreConstrucaoStore }) => usePreConstrucaoStore.getState().clearData())
        import('./maoDeObraStore').then(({ useMaoDeObraStore }) => useMaoDeObraStore.getState().clearData())
        import('./otimizacaoFrotaStore').then(({ useOtimizacaoFrotaStore }) => useOtimizacaoFrotaStore.getState().clearData())
        import('./gestao360Store').then(({ useGestao360Store }) => useGestao360Store.getState().clearData())
        import('./planejamentoStore').then(({ usePlanejamentoStore }) => usePlanejamentoStore.getState().clearData())
        import('./rdoStore').then(({ useRdoStore }) => useRdoStore.getState().clearData())
        import('./quantitativosStore').then(({ useQuantitativosStore }) => useQuantitativosStore.getState().clearData())
        import('./bimStore').then(({ useBimStore }) => useBimStore.getState().clearData())
        import('./lpsStore').then(({ useLpsStore }) => useLpsStore.getState().clearData())
        import('./mapaInterativoStore').then(({ useMapaInterativoStore }) => useMapaInterativoStore.getState().clearData())
        import('./evmStore').then(({ useEvmStore }) => useEvmStore.getState().clearData())
      }

      return { isDemoMode: next }
    }),
}))
