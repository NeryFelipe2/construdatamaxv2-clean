import { create } from 'zustand'
import {
  apiProjetoAtualizarContato,
  apiProjetoContatos,
  apiProjetoCriarContato,
  apiProjetoRemoverContato,
  type CanonicalIntegrationStatus,
} from '@/lib/api'
import { supabase, type DbContato } from '@/lib/supabase'

const ALLOW_DEMO_DATA = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'

const UUID_TATUI = 'c2bf8fda-b2e0-4bc1-9535-4891d596ea10'
const UUID_OSASCO = 'f3c6645b-347f-4382-b9c5-d103c27ec511'
const UUID_CONSORCIO = 'abe7f66c-004b-4bb5-a245-6be67debd9f7'
const UUID_PARDINHO = 'ec112c9a-1669-4287-8079-526d6940ce82'
const UUID_BRASILIA = '2a28beec-b1f8-4b0c-8416-d0710bb35d9d'

const DEMO_CONTATOS: DbContato[] = [
  { id: 'ct-felipe', nome: 'Felipe Nery', cargo: 'Diretor', telefone_whatsapp: '5561981846325', projeto_id: UUID_TATUI, frente_id: null, ativo: true, foto_url: null },
  { id: 'ct-luiz', nome: 'Luiz Fernando', cargo: 'Diretor', telefone_whatsapp: '5537999425397', projeto_id: UUID_TATUI, frente_id: null, ativo: true, foto_url: null },
  { id: 'ct-renato', nome: 'Renato', cargo: 'Diretor', telefone_whatsapp: '5528999154319', projeto_id: UUID_TATUI, frente_id: null, ativo: true, foto_url: null },
  { id: 'ct-mateus', nome: 'Mateus Santos', cargo: 'Engenheiro', telefone_whatsapp: '5561991015639', projeto_id: UUID_OSASCO, frente_id: 'f-osc-1', ativo: true, foto_url: null },
  { id: 'ct-igor', nome: 'Igor Max', cargo: 'Engenheiro', telefone_whatsapp: '5531985898482', projeto_id: UUID_OSASCO, frente_id: 'f-osc-1', ativo: true, foto_url: null },
  { id: 'ct-icaro', nome: 'Icaro', cargo: 'Engenheiro', telefone_whatsapp: '5537998268576', projeto_id: UUID_PARDINHO, frente_id: 'f-pard-1', ativo: true, foto_url: null },
  { id: 'ct-fabrizzio', nome: 'Fabrizzio', cargo: 'Gerente/Diretor', telefone_whatsapp: '5574999076534', projeto_id: UUID_CONSORCIO, frente_id: null, ativo: true, foto_url: null },
  { id: 'ct-gabriel', nome: 'Gabriel', cargo: 'Sala Tecnica', telefone_whatsapp: '5513991995918', projeto_id: UUID_CONSORCIO, frente_id: 'f-cons-1', ativo: true, foto_url: null },
  { id: 'ct-vinicius', nome: 'Vinicius', cargo: 'Sala Tecnica', telefone_whatsapp: '5513978216285', projeto_id: UUID_CONSORCIO, frente_id: 'f-cons-1', ativo: true, foto_url: null },
  { id: 'ct-junior', nome: 'Junior', cargo: 'Planejamento', telefone_whatsapp: '5511999000001', projeto_id: UUID_CONSORCIO, frente_id: 'f-cons-2', ativo: true, foto_url: null },
  { id: 'ct-valdeans', nome: 'Valdeans', cargo: 'Planejamento', telefone_whatsapp: '5511999000002', projeto_id: UUID_CONSORCIO, frente_id: 'f-cons-2', ativo: true, foto_url: null },
  { id: 'ct-veronica', nome: 'Veronica', cargo: 'Planejamento', telefone_whatsapp: '5511999000003', projeto_id: UUID_CONSORCIO, frente_id: 'f-cons-2', ativo: true, foto_url: null },
  { id: 'ct-josemarcio', nome: 'Jose Marcio', cargo: 'Gerente Producao', telefone_whatsapp: '5511999000004', projeto_id: UUID_CONSORCIO, frente_id: 'f-cons-3', ativo: true, foto_url: null },
  { id: 'ct-joao', nome: 'Joao', cargo: 'Diretor', telefone_whatsapp: '5561999996252', projeto_id: UUID_BRASILIA, frente_id: 'f-bsb-1', ativo: true, foto_url: null },
]

function mapContato(row: Record<string, unknown>, projetoIdFallback?: string): DbContato {
  return {
    id: String(row.id ?? `ct-${Date.now()}`),
    nome: String(row.nome ?? row.responsavel ?? 'Contato'),
    cargo: String(row.cargo ?? row.papel ?? 'Responsavel'),
    telefone_whatsapp: String(row.telefone_whatsapp ?? row.telefone ?? ''),
    projeto_id: String(row.projeto_id ?? row.project_id ?? projetoIdFallback ?? ''),
    frente_id: row.frente_id ? String(row.frente_id) : null,
    ativo: row.ativo === false ? false : true,
    foto_url: row.foto_url ? String(row.foto_url) : null,
  }
}

export function normalizeWhatsapp(input: string): string {
  const digits = (input || '').replace(/\D/g, '')
  let n = digits
  if (n.startsWith('00')) n = n.slice(2)
  if (!n.startsWith('55')) n = '55' + n
  if (n.length === 12) {
    const ddd = n.slice(2, 4)
    const rest = n.slice(4)
    n = '55' + ddd + '9' + rest
  }
  if (n.length !== 13) throw new Error(`Telefone invalido: "${input}". Use +55 DD 9XXXX-XXXX.`)
  if (n[4] !== '9') throw new Error(`Telefone invalido: "${input}". O celular deve iniciar com 9.`)
  return n
}

interface ContatosState {
  contatos: DbContato[]
  loading: boolean
  integrationStatus: CanonicalIntegrationStatus
  currentProjectId: string | null
  fetchContatos: (projetoId: string) => Promise<void>
  addContato: (c: Omit<DbContato, 'id'>) => Promise<void>
  updateContato: (id: string, patch: Partial<DbContato>) => Promise<void>
  removeContato: (id: string) => Promise<void>
  contatosDoProjeto: (projetoId: string) => DbContato[]
  lideres: (projetoId: string) => DbContato[]
}

export const useContatosStore = create<ContatosState>((set, get) => ({
  contatos: ALLOW_DEMO_DATA ? DEMO_CONTATOS : [],
  loading: false,
  integrationStatus: ALLOW_DEMO_DATA ? 'local' : 'partial',
  currentProjectId: null,

  fetchContatos: async (projetoId) => {
    if (!projetoId) return
    set({ loading: true, currentProjectId: projetoId })

    try {
      const payload = await apiProjetoContatos(projetoId)
      const contatos = (payload.items ?? []).map((row) => mapContato(row, projetoId))
      set((s) => ({
        contatos: [...s.contatos.filter((c) => c.projeto_id !== projetoId), ...contatos],
        loading: false,
        integrationStatus: 'connected',
      }))
      return
    } catch {
      // fallback below
    }

    if (supabase) {
      try {
        const { data } = await supabase.from('contatos').select('*').eq('projeto_id', projetoId)
        set((s) => ({
          contatos: [...s.contatos.filter((c) => c.projeto_id !== projetoId), ...((data || []) as DbContato[])],
          loading: false,
          integrationStatus: s.integrationStatus === 'connected' ? 'connected' : 'partial',
        }))
        return
      } catch {
        // fallback below
      }
    }

    set((s) => ({
      contatos: ALLOW_DEMO_DATA
        ? [...s.contatos.filter((c) => c.projeto_id !== projetoId), ...DEMO_CONTATOS.filter((c) => c.projeto_id === projetoId)]
        : s.contatos.filter((c) => c.projeto_id !== projetoId),
      loading: false,
      integrationStatus: ALLOW_DEMO_DATA ? 'local' : 'partial',
    }))
  },

  addContato: async (c) => {
    const projetoId = c.projeto_id || get().currentProjectId
    const cNorm = { ...c, projeto_id: projetoId || c.projeto_id, telefone_whatsapp: normalizeWhatsapp(c.telefone_whatsapp) }
    const optimistic: DbContato = { ...cNorm, id: `ct-${Date.now()}` }

    if (projetoId) {
      try {
        const created = await apiProjetoCriarContato(projetoId, cNorm as unknown as Record<string, unknown>)
        set((s) => ({ contatos: [...s.contatos, mapContato(created, projetoId)], integrationStatus: 'connected' }))
        return
      } catch {
        // fallback below
      }
    }

    if (supabase) {
      const { data } = await supabase.from('contatos').insert(cNorm).select().single()
      if (data) {
        set((s) => ({ contatos: [...s.contatos, data as DbContato], integrationStatus: s.integrationStatus === 'connected' ? 'connected' : 'partial' }))
        return
      }
    }

    set((s) => ({ contatos: [...s.contatos, optimistic], integrationStatus: ALLOW_DEMO_DATA ? 'local' : s.integrationStatus }))
  },

  updateContato: async (id, patch) => {
    const existing = get().contatos.find((c) => c.id === id)
    const projetoId = existing?.projeto_id || get().currentProjectId
    const patchNorm = patch.telefone_whatsapp
      ? { ...patch, telefone_whatsapp: normalizeWhatsapp(patch.telefone_whatsapp) }
      : patch

    if (projetoId) {
      try {
        const updated = await apiProjetoAtualizarContato(projetoId, id, patchNorm as unknown as Record<string, unknown>)
        set((s) => ({
          contatos: s.contatos.map((c) => (c.id === id ? mapContato(updated, projetoId) : c)),
          integrationStatus: 'connected',
        }))
        return
      } catch {
        // fallback below
      }
    }

    if (supabase) await supabase.from('contatos').update(patchNorm).eq('id', id)
    set((s) => ({
      contatos: s.contatos.map((c) => (c.id === id ? { ...c, ...patchNorm } : c)),
      integrationStatus: supabase ? (s.integrationStatus === 'connected' ? 'connected' : 'partial') : s.integrationStatus,
    }))
  },

  removeContato: async (id) => {
    const existing = get().contatos.find((c) => c.id === id)
    const projetoId = existing?.projeto_id || get().currentProjectId

    if (projetoId) {
      try {
        await apiProjetoRemoverContato(projetoId, id)
        set((s) => ({
          contatos: s.contatos.filter((c) => c.id !== id),
          integrationStatus: 'connected',
        }))
        return
      } catch {
        // fallback below
      }
    }

    if (supabase) await supabase.from('contatos').delete().eq('id', id)
    set((s) => ({
      contatos: s.contatos.filter((c) => c.id !== id),
      integrationStatus: supabase ? (s.integrationStatus === 'connected' ? 'connected' : 'partial') : s.integrationStatus,
    }))
  },

  contatosDoProjeto: (projetoId) => get().contatos.filter((c) => c.projeto_id === projetoId),
  lideres: (projetoId) => get().contatos.filter((c) => c.projeto_id === projetoId && ['Encarregado', 'Mestre', 'Engenheiro', 'Diretor'].includes(c.cargo)),
}))

if (typeof window !== 'undefined') {
  queueMicrotask(() => {
    import('./projectContext')
      .then(({ useProjectContext }) => {
        const sync = async () => {
          const { activeProjectId } = useProjectContext.getState()
          if (activeProjectId) await useContatosStore.getState().fetchContatos(activeProjectId)
        }
        void sync()
        useProjectContext.subscribe(() => {
          void sync()
        })
      })
      .catch(() => undefined)
  })
}
