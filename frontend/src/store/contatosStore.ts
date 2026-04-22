import { create } from 'zustand'
import { supabase, type DbContato } from '@/lib/supabase'

const UUID_TATUI = 'c2bf8fda-1111-4444-8888-aaaaaaaaaaaa'
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
  fetchContatos: (projetoId: string) => Promise<void>
  addContato: (c: Omit<DbContato, 'id'>) => Promise<void>
  updateContato: (id: string, patch: Partial<DbContato>) => Promise<void>
  removeContato: (id: string) => Promise<void>
  contatosDoProjeto: (projetoId: string) => DbContato[]
  lideres: (projetoId: string) => DbContato[]
}

export const useContatosStore = create<ContatosState>((set, get) => ({
  contatos: DEMO_CONTATOS,
  loading: false,

  fetchContatos: async (projetoId) => {
    if (!supabase) return
    set({ loading: true })
    try {
      const { data } = await supabase.from('contatos').select('*').eq('projeto_id', projetoId)
      if (data) {
        set((s) => ({
          contatos: [...s.contatos.filter((c) => c.projeto_id !== projetoId), ...(data as DbContato[])],
        }))
      }
    } catch {
      // keep demo
    }
    set({ loading: false })
  },

  addContato: async (c) => {
    const cNorm = { ...c, telefone_whatsapp: normalizeWhatsapp(c.telefone_whatsapp) }
    const novo: DbContato = { ...cNorm, id: `ct-${Date.now()}` }
    if (supabase) {
      const { data } = await supabase.from('contatos').insert(cNorm).select().single()
      if (data) {
        set((s) => ({ contatos: [...s.contatos, data as DbContato] }))
        return
      }
    }
    set((s) => ({ contatos: [...s.contatos, novo] }))
  },

  updateContato: async (id, patch) => {
    const patchNorm = patch.telefone_whatsapp ? { ...patch, telefone_whatsapp: normalizeWhatsapp(patch.telefone_whatsapp) } : patch
    if (supabase) await supabase.from('contatos').update(patchNorm).eq('id', id)
    set((s) => ({ contatos: s.contatos.map((c) => (c.id === id ? { ...c, ...patchNorm } : c)) }))
  },

  removeContato: async (id) => {
    if (supabase) await supabase.from('contatos').delete().eq('id', id)
    set((s) => ({ contatos: s.contatos.filter((c) => c.id !== id) }))
  },

  contatosDoProjeto: (projetoId) => get().contatos.filter((c) => c.projeto_id === projetoId),
  lideres: (projetoId) => get().contatos.filter((c) => c.projeto_id === projetoId && ['Encarregado', 'Mestre', 'Engenheiro', 'Diretor'].includes(c.cargo)),
}))
