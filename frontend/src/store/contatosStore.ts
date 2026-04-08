/**
 * contatosStore.ts — CRUD for contacts with WhatsApp phone numbers.
 */
import { create } from 'zustand'
import { supabase, type DbContato } from '@/lib/supabase'

const DEMO_CONTATOS: DbContato[] = [
  // ─── Santos / SABESP ───
  { id: 'c-1', nome: 'Bruno', cargo: 'Encarregado', telefone_whatsapp: '5513999001001', projeto_id: 'demo-1', frente_id: 'f-1', ativo: true, foto_url: null },
  { id: 'c-2', nome: 'Guajeru', cargo: 'Encarregado', telefone_whatsapp: '5513999002002', projeto_id: 'demo-1', frente_id: 'f-1', ativo: true, foto_url: null },
  { id: 'c-3', nome: 'Alexandro', cargo: 'Encarregado', telefone_whatsapp: '5513999003003', projeto_id: 'demo-1', frente_id: 'f-2', ativo: true, foto_url: null },
  { id: 'c-4', nome: 'Joao', cargo: 'Mestre', telefone_whatsapp: '5513999004004', projeto_id: 'demo-1', frente_id: 'f-2', ativo: true, foto_url: null },
  { id: 'c-5', nome: 'Felipe Nery', cargo: 'Engenheiro / Diretor', telefone_whatsapp: '5561981846325', projeto_id: 'demo-1', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-6', nome: 'João', cargo: 'Diretor', telefone_whatsapp: '5561999996252', projeto_id: 'demo-1', frente_id: null, ativo: true, foto_url: null },
  // ─── Pardinho / Consórcio Itapetininga ───
  { id: 'c-pard-1', nome: 'Luiz Fernando', cargo: 'Diretor', telefone_whatsapp: '5537999425397', projeto_id: 'pardinho-1', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-pard-2', nome: 'Ícaro', cargo: 'Engenheiro', telefone_whatsapp: '5537998268576', projeto_id: 'pardinho-1', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-pard-3', nome: 'Fábio', cargo: 'Gerente', telefone_whatsapp: '5537999000001', projeto_id: 'pardinho-1', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-pard-4', nome: 'André', cargo: 'Engenheiro', telefone_whatsapp: '5537999000002', projeto_id: 'pardinho-1', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-pard-5', nome: 'Encarregado Pardinho', cargo: 'Encarregado', telefone_whatsapp: '5537999000003', projeto_id: 'pardinho-1', frente_id: 'f-pard-1', ativo: true, foto_url: null },
  // ─── Osasco / Consórcio CLU Osasco ───
  { id: 'c-osc-1', nome: 'Fábio', cargo: 'Gerente', telefone_whatsapp: '5511999999999', projeto_id: 'demo-2', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-osc-2', nome: 'Cláudia', cargo: 'Engenheira', telefone_whatsapp: '5511999999998', projeto_id: 'demo-2', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-osc-3', nome: 'Diego', cargo: 'Eng. Produção', telefone_whatsapp: '5511999999997', projeto_id: 'demo-2', frente_id: 'f-osc-1', ativo: true, foto_url: null },
  { id: 'c-osc-4', nome: 'Carol', cargo: 'Sala Técnica', telefone_whatsapp: '5511999999996', projeto_id: 'demo-2', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-osc-5', nome: 'Mateus Santos', cargo: 'Engenheiro Campo', telefone_whatsapp: '5561991015639', projeto_id: 'demo-2', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-osc-6', nome: 'Luiz Fernando', cargo: 'Diretor', telefone_whatsapp: '5537999425397', projeto_id: 'demo-2', frente_id: null, ativo: true, foto_url: null },
]

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
      if (data && data.length > 0) {
        set(s => ({
          contatos: [
            ...s.contatos.filter(c => c.projeto_id !== projetoId),
            ...(data as DbContato[]),
          ]
        }))
      }
    } catch { /* keep demo */ }
    set({ loading: false })
  },

  addContato: async (c) => {
    const novo: DbContato = { ...c, id: `ct-${Date.now()}` }
    if (supabase) {
      const { data } = await supabase.from('contatos').insert(c).select().single()
      if (data) { set(s => ({ contatos: [...s.contatos, data as DbContato] })); return }
    }
    set(s => ({ contatos: [...s.contatos, novo] }))
  },

  updateContato: async (id, patch) => {
    if (supabase) await supabase.from('contatos').update(patch).eq('id', id)
    set(s => ({ contatos: s.contatos.map(c => c.id === id ? { ...c, ...patch } : c) }))
  },

  removeContato: async (id) => {
    if (supabase) await supabase.from('contatos').delete().eq('id', id)
    set(s => ({ contatos: s.contatos.filter(c => c.id !== id) }))
  },

  contatosDoProjeto: (projetoId) => get().contatos.filter(c => c.projeto_id === projetoId),
  lideres: (projetoId) => get().contatos.filter(c => c.projeto_id === projetoId && ['Encarregado', 'Mestre', 'Engenheiro'].includes(c.cargo)),
}))
