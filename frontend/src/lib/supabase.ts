import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'cdata-auth',
      },
    })
  : null

// ─── Types matching Supabase tables ─────────────────────────────────────────

export interface DbProjeto {
  id: string
  nome: string
  contrato: string
  cidade: string
  cliente: string
  tipo: 'agua' | 'esgoto' | 'misto'
  data_inicio: string
  data_fim: string | null
  orcamento_total: number
  status: 'ativo' | 'pausado' | 'concluido'
  responsavel_nome: string
  responsavel_telefone: string
  created_at: string
}

export interface DbFrente {
  id: string
  projeto_id: string
  nome: string
  setor: string
  tipo_rede: string
  extensao_total: number
  pvs_total: number
  status: 'ativa' | 'pausada' | 'concluida'
}

export interface DbContato {
  id: string
  nome: string
  cargo: string
  telefone_whatsapp: string
  projeto_id: string
  frente_id: string | null
  ativo: boolean
  foto_url: string | null
}

export interface DbRdo {
  id: string
  projeto_id: string
  frente_id: string | null
  data: string
  clima: string
  turno: string
  status: 'aberto' | 'fechado'
  fotos: string[]
  created_at: string
}

export interface DbRdoEquipe {
  id: string
  rdo_id: string
  tipo: string
  lider_id: string | null
  lider_nome: string
}

export interface DbRdoAtividade {
  id: string
  equipe_id: string
  rua: string
  servico: string
  tubo: string
  metragem: number
  pecas: string[]
  casas: string
  observacao: string
}

export interface DbRdoMaterial {
  id: string
  rdo_id: string
  descricao: string
  quantidade: number
  unidade: string
}

export interface DbRdoEquipamento {
  id: string
  rdo_id: string
  tipo: string
  quantidade: number
}

export interface DbRdoMaoObra {
  id: string
  rdo_id: string
  cargo: string
  quantidade: number
}

export interface DbRdoOcorrencia {
  id: string
  rdo_id: string
  tipo: string
  descricao: string
}

export interface DbPunchListItem {
  id: string
  projeto_id: string
  frente_id: string | null
  descricao: string
  localizacao: string
  responsavel: string
  prazo: string
  status: 'aberto' | 'em_correcao' | 'resolvido'
  foto_antes: string | null
  foto_depois: string | null
  created_at: string
}

export interface DbAutomacaoRegra {
  id: string
  projeto_id: string
  tipo: string
  horario: string
  destinatarios_cargo: string[]
  mensagem_template: string
  ativa: boolean
}
