/**
 * useAuditoria.ts — leitura da trilha de auditoria.
 *
 * O log é gravado por TRIGGER no Postgres (fn_auditoria), então ele pega tudo:
 * a tela, a planilha importada, o bot do WhatsApp, os scripts Python e até
 * alteração feita à mão no SQL Editor. Aqui só se LÊ — a tabela é somente
 * leitura pela API, de propósito: log que a aplicação consegue editar não é log.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type AcaoAudit = 'INSERT' | 'UPDATE' | 'DELETE'

export interface RegistroAudit {
  id: number
  tabela: string
  registro_id: string | null
  acao: AcaoAudit
  usuario_id: string | null
  usuario_nome: string | null
  origem: string | null
  ip: string | null
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  campos: string[] | null
  criado_em: string
}

export interface FiltroAudit {
  usuario?: string
  tabela?: string
  acao?: AcaoAudit | ''
  desde?: string
  ate?: string
  busca?: string
}

/** Rótulo humano da tabela — ninguém precisa saber que existe `caixa_lancamento`. */
export const ROTULO_TABELA: Record<string, string> = {
  caixa_lancamento: 'Lançamento de caixa',
  caixa_categoria: 'Categoria de caixa',
  horas_extras: 'Hora extra',
  he_valor_cargo: 'Valor de HE por cargo',
  fcp: 'Fluxo de Caixa Projetado',
  fcp_premissas: 'Premissas do FCP',
  fcp_obra: 'Obra do FCP',
  fcp_custo_pessoa: 'Custo de pessoa (FCP)',
  fcp_custo_geral: 'Custo geral (FCP)',
  fcp_realizado: 'Produção realizada (FCP)',
  fcp_preco: 'Preço de contrato (FCP)',
  pessoas: 'Funcionário',
  pessoa_equipe: 'Vínculo com equipe',
  pessoa_remuneracao: 'Remuneração',
  pessoa_apelidos: 'Apelido de funcionário',
  wcr_equipes: 'Equipe',
  equipe_membros: 'Membro de equipe',
  rdos: 'RDO',
  rdo_presenca: 'Presença no RDO',
  rdo_atividades: 'Atividade do RDO',
  lps_tasks: 'Tarefa do LPS',
  organization_members: 'Acesso de usuário',
  convites_acesso: 'Convite de acesso',
  profiles: 'Perfil de usuário',
  producao_diaria: 'Produção diária',
  medicao_itens: 'Item de medição',
  wcr_kanban_dia: 'Quadro do dia (Kanban)',
}

export const rotuloTabela = (t: string) =>
  ROTULO_TABELA[t] ?? t.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

/** Campos que não interessam a ninguém no "o que mudou". */
const CAMPOS_TECNICOS = new Set([
  'updated_at', 'updated_by', 'created_at', 'created_by', 'id', 'org_id',
  'deleted_at', 'deleted_by', 'import_lote', 'nome_norm',
])

export const ROTULO_CAMPO: Record<string, string> = {
  valor: 'valor', descricao: 'descrição', status: 'situação', data_inicio: 'data',
  data_fim: 'fim do período', categoria_id: 'categoria', obra_texto: 'obra',
  producao: 'produção', cargo_texto: 'cargo', nome_completo: 'nome',
  role: 'papel', ativo: 'ativo', semana_ref: 'semana', cenario: 'cenário',
  metros_executados: 'realizado', metros_planejados: 'planejado',
}

export interface UseAuditoriaReturn {
  registros: RegistroAudit[]
  loading: boolean
  erro: string | null
  tabelaAusente: boolean
  semPermissao: boolean
  filtro: FiltroAudit
  setFiltro: (f: FiltroAudit) => void
  usuarios: string[]
  tabelas: string[]
  porUsuario: { nome: string; total: number; inserts: number; updates: number; deletes: number }[]
  recarregar: () => Promise<void>
  temMais: boolean
  carregarMais: () => void
}

const LIMITE = 200

export function useAuditoria(filtroInicial: FiltroAudit = {}): UseAuditoriaReturn {
  const [registros, setRegistros] = useState<RegistroAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [tabelaAusente, setTabelaAusente] = useState(false)
  const [semPermissao, setSemPermissao] = useState(false)
  const [filtro, setFiltro] = useState<FiltroAudit>(filtroInicial)
  const [limite, setLimite] = useState(LIMITE)
  const [temMais, setTemMais] = useState(false)

  const carregar = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true); setErro(null)
    let q = supabase.from('audit_log')
      .select('id, tabela, registro_id, acao, usuario_id, usuario_nome, origem, ip, dados_antes, dados_depois, campos, criado_em')
      .order('criado_em', { ascending: false })
      .limit(limite + 1)

    if (filtro.tabela) q = q.eq('tabela', filtro.tabela)
    if (filtro.acao) q = q.eq('acao', filtro.acao)
    if (filtro.usuario) q = q.eq('usuario_nome', filtro.usuario)
    if (filtro.desde) q = q.gte('criado_em', filtro.desde)
    if (filtro.ate) q = q.lte('criado_em', `${filtro.ate}T23:59:59`)

    const { data, error } = await q
    if (error) {
      const m = (error.message ?? '').toLowerCase()
      if (m.includes('does not exist') || m.includes('could not find the table')) setTabelaAusente(true)
      else setErro(error.message)
      setLoading(false); return
    }
    const lista = (data ?? []) as RegistroAudit[]
    // RLS devolve vazio (não erro) para quem não é admin — a tela precisa
    // distinguir "não há registro" de "você não pode ver"
    setSemPermissao(lista.length === 0 && !filtro.tabela && !filtro.usuario && !filtro.acao)
    setTemMais(lista.length > limite)
    setRegistros(lista.slice(0, limite))
    setLoading(false)
  }, [filtro, limite])

  useEffect(() => { void carregar() }, [carregar])

  const usuarios = useMemo(
    () => [...new Set(registros.map((r) => r.usuario_nome ?? '(integração)'))].sort(), [registros])
  const tabelas = useMemo(
    () => [...new Set(registros.map((r) => r.tabela))].sort(), [registros])

  const porUsuario = useMemo(() => {
    const m = new Map<string, { nome: string; total: number; inserts: number; updates: number; deletes: number }>()
    for (const r of registros) {
      const nome = r.usuario_nome ?? '(integração)'
      const a = m.get(nome) ?? { nome, total: 0, inserts: 0, updates: 0, deletes: 0 }
      a.total++
      if (r.acao === 'INSERT') a.inserts++
      else if (r.acao === 'UPDATE') a.updates++
      else a.deletes++
      m.set(nome, a)
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [registros])

  return {
    registros, loading, erro, tabelaAusente, semPermissao,
    filtro, setFiltro: (f) => { setLimite(LIMITE); setFiltro(f) },
    usuarios, tabelas, porUsuario,
    recarregar: carregar, temMais, carregarMais: () => setLimite((l) => l + LIMITE),
  }
}

/** Histórico de UM registro — usado no modal "Histórico" de cada item. */
export function useHistoricoRegistro(tabela: string | null, registroId: string | null) {
  const [registros, setRegistros] = useState<RegistroAudit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase || !tabela || !registroId) { setRegistros([]); return }
    let cancelado = false
    setLoading(true)
    void supabase.from('audit_log')
      .select('id, tabela, registro_id, acao, usuario_id, usuario_nome, origem, ip, dados_antes, dados_depois, campos, criado_em')
      .eq('tabela', tabela).eq('registro_id', registroId)
      .order('criado_em', { ascending: false })
      .then(({ data }) => {
        if (!cancelado) { setRegistros((data ?? []) as RegistroAudit[]); setLoading(false) }
      })
    return () => { cancelado = true }
  }, [tabela, registroId])

  return { registros, loading }
}

/** Lista legível de "o que mudou", já sem os campos técnicos. */
export function mudancasLegiveis(r: RegistroAudit): { campo: string; antes: unknown; depois: unknown }[] {
  if (r.acao === 'INSERT' || r.acao === 'DELETE') return []
  const campos = (r.campos ?? []).filter((c) => !CAMPOS_TECNICOS.has(c))
  return campos.map((c) => ({
    campo: ROTULO_CAMPO[c] ?? c.replace(/_/g, ' '),
    antes: r.dados_antes?.[c] ?? null,
    depois: r.dados_depois?.[c] ?? null,
  }))
}

/** Frase curta: "Felipe Nery criou · há 2 h" */
export function frasear(r: RegistroAudit): string {
  const quem = r.usuario_nome ?? '(integração)'
  const verbo = r.acao === 'INSERT' ? 'criou' : r.acao === 'UPDATE' ? 'alterou' : 'excluiu'
  return `${quem} ${verbo}`
}
