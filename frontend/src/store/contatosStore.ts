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
  { id: 'c-pard-6', nome: 'Renato', cargo: 'Diretoria', telefone_whatsapp: '5528999154319', projeto_id: 'pardinho-1', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-pard-7', nome: 'Buruca', cargo: 'Encarregado Geral', telefone_whatsapp: '5528999220853', projeto_id: 'pardinho-1', frente_id: null, ativo: true, foto_url: null },
  // ─── Osasco / Consórcio CLU Osasco ───
  { id: 'c-osc-1', nome: 'Fábio', cargo: 'Gerente', telefone_whatsapp: '5511999999999', projeto_id: 'demo-2', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-osc-2', nome: 'Cláudia', cargo: 'Engenheira', telefone_whatsapp: '5511999999998', projeto_id: 'demo-2', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-osc-3', nome: 'Diego', cargo: 'Eng. Produção', telefone_whatsapp: '5511999999997', projeto_id: 'demo-2', frente_id: 'f-osc-1', ativo: true, foto_url: null },
  { id: 'c-osc-4', nome: 'Carol', cargo: 'Sala Técnica', telefone_whatsapp: '5511999999996', projeto_id: 'demo-2', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-osc-5', nome: 'Mateus Santos', cargo: 'Engenheiro Campo', telefone_whatsapp: '5561991015639', projeto_id: 'demo-2', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-osc-6', nome: 'Luiz Fernando', cargo: 'Diretor', telefone_whatsapp: '5537999425397', projeto_id: 'demo-2', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-osc-7', nome: 'Renato', cargo: 'Diretoria', telefone_whatsapp: '5528999154319', projeto_id: 'demo-2', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-osc-8', nome: 'Buruca', cargo: 'Encarregado Geral', telefone_whatsapp: '5528999220853', projeto_id: 'demo-2', frente_id: null, ativo: true, foto_url: null },
  // ─── Sala Técnica / SLNR Santos ───
  { id: 'c-st-1', nome: 'Vinicius', cargo: 'Técnico Sala Técnica', telefone_whatsapp: '5513978216285', projeto_id: 'sala-tecnica-1', frente_id: 'f-st-1', ativo: true, foto_url: null },
  { id: 'c-st-2', nome: 'Gabriel', cargo: 'Técnico Sala Técnica', telefone_whatsapp: '5513991995918', projeto_id: 'sala-tecnica-1', frente_id: 'f-st-2', ativo: true, foto_url: null },
  { id: 'c-st-3', nome: 'Felipe Nery', cargo: 'Coordenador', telefone_whatsapp: '5561981846325', projeto_id: 'sala-tecnica-1', frente_id: null, ativo: true, foto_url: null },
  { id: 'c-st-4', nome: 'Thalita', cargo: 'Survey / Planejamento', telefone_whatsapp: '5511919803270', projeto_id: 'sala-tecnica-1', frente_id: 'f-st-2', ativo: true, foto_url: null },
  { id: 'c-st-5', nome: 'Fabrizzio', cargo: 'Gerente (Consórcio)', telefone_whatsapp: '5574999076534', projeto_id: 'sala-tecnica-1', frente_id: null, ativo: true, foto_url: null },
]

/**
 * Normaliza e valida telefone WhatsApp BR.
 * Aceita qualquer entrada com DDD + 9 + 8 dígitos (celular BR).
 * Retorna formato E.164 sem '+': 55 + DDD(2) + 9 + 8 dígitos = 13 dígitos.
 * Lança Error se inválido — força usuário a usar +55 DD 9XXXX-XXXX.
 */
export function normalizeWhatsapp(input: string): string {
  const digits = (input || '').replace(/\D/g, '')
  // remove zero internacional / 0800-style
  let n = digits
  if (n.startsWith('00')) n = n.slice(2)
  if (!n.startsWith('55')) n = '55' + n
  // n agora deve ser 55 + DDD(2) + numero
  // celular BR: 13 dígitos (55 DD 9XXXXXXXX). Insere o 9 se vier antigo (12 dígitos).
  if (n.length === 12) {
    const ddd = n.slice(2, 4)
    const rest = n.slice(4)
    n = '55' + ddd + '9' + rest
  }
  if (n.length !== 13) {
    throw new Error(`Telefone inválido: "${input}". Use o formato +55 DD 9XXXX-XXXX (13 dígitos com 55).`)
  }
  if (n[4] !== '9') {
    throw new Error(`Telefone inválido: "${input}". O número de celular deve começar com 9 após o DDD (+55 DD 9XXXX-XXXX).`)
  }
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
    const telefoneOk = normalizeWhatsapp(c.telefone_whatsapp)
    const cNorm = { ...c, telefone_whatsapp: telefoneOk }
    const novo: DbContato = { ...cNorm, id: `ct-${Date.now()}` }
    if (supabase) {
      const { data } = await supabase.from('contatos').insert(cNorm).select().single()
      if (data) { set(s => ({ contatos: [...s.contatos, data as DbContato] })); return }
    }
    set(s => ({ contatos: [...s.contatos, novo] }))
  },

  updateContato: async (id, patch) => {
    const patchNorm = patch.telefone_whatsapp
      ? { ...patch, telefone_whatsapp: normalizeWhatsapp(patch.telefone_whatsapp) }
      : patch
    if (supabase) await supabase.from('contatos').update(patchNorm).eq('id', id)
    set(s => ({ contatos: s.contatos.map(c => c.id === id ? { ...c, ...patchNorm } : c) }))
  },

  removeContato: async (id) => {
    if (supabase) await supabase.from('contatos').delete().eq('id', id)
    set(s => ({ contatos: s.contatos.filter(c => c.id !== id) }))
  },

  contatosDoProjeto: (projetoId) => get().contatos.filter(c => c.projeto_id === projetoId),
  lideres: (projetoId) => get().contatos.filter(c => c.projeto_id === projetoId && ['Encarregado', 'Mestre', 'Engenheiro'].includes(c.cargo)),
}))
