/**
 * useMetaCampanha — CRUD das campanhas de meta (`metas_campanha`).
 * Uma "campanha" é uma meta com nome, alvo, janela (início/fim), ritmo diário e
 * etapas encadeadas (cada etapa aponta pra uma coluna de `producao_diaria`).
 * É assim que a próxima meta nasce SEM código: o dono cria a campanha na tela.
 *
 * A campanha ATIVA do projeto = status 'ativa' mais recente por data_inicio.
 * Padrão de hook: useMetaCorredor.ts — useState/useCallback/useEffect, load com
 * try/catch, update otimista, revert via reload. Nada é inventado: tudo vem do banco.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface EtapaCampanha {
  /** Chave estável da etapa (ex.: 'c_uma', 'hm', 'ligacao') — usada no status_etapa das ruas. */
  key: string
  /** Rótulo humano da etapa (ex.: 'Caixa U.M.A'). */
  label: string
  /** Coluna de `producao_diaria` que alimenta o realizado da etapa (c_uma | ihm | la). */
  col: string
}

export type StatusCampanha = 'ativa' | 'encerrada' | 'arquivada'

export interface CampanhaMeta {
  id: string
  projeto_id: string
  nome: string
  alvo: number
  unidade: string
  /** ISO yyyy-mm-dd — início da janela (contagem começa aqui). */
  data_inicio: string
  /** ISO yyyy-mm-dd — prazo final da campanha. */
  data_fim: string
  ritmo_dia: number
  etapas: EtapaCampanha[]
  status: StatusCampanha
}

/**
 * Etapas padrão (cadeia da ligação de água) usadas ao criar campanha nova sem
 * etapas explícitas — mesmo desenho da campanha "1500 Ligações" seedada.
 */
export const ETAPAS_PADRAO: EtapaCampanha[] = [
  { key: 'c_uma', label: 'Caixa U.M.A', col: 'c_uma' },
  { key: 'hm', label: 'Cavalete / Hidrômetro', col: 'ihm' },
  { key: 'ligacao', label: 'Ligação de Água', col: 'la' },
]

export interface NovaCampanhaInput {
  nome: string
  alvo: number
  unidade?: string
  data_inicio: string
  data_fim: string
  ritmo_dia: number
  etapas?: EtapaCampanha[]
}

interface DbRow {
  id: string
  projeto_id: string
  nome: string
  alvo: number | null
  unidade: string | null
  data_inicio: string
  data_fim: string
  ritmo_dia: number | null
  etapas: unknown
  status: string
}

function mapEtapas(raw: unknown): EtapaCampanha[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({ key: String(e.key ?? ''), label: String(e.label ?? ''), col: String(e.col ?? '') }))
    .filter((e) => e.key && e.col)
}

function mapRow(r: DbRow): CampanhaMeta {
  return {
    id: r.id,
    projeto_id: r.projeto_id,
    nome: r.nome,
    alvo: Number(r.alvo) || 0,
    unidade: r.unidade ?? 'unid.',
    data_inicio: String(r.data_inicio).slice(0, 10),
    data_fim: String(r.data_fim).slice(0, 10),
    ritmo_dia: Number(r.ritmo_dia) || 0,
    etapas: mapEtapas(r.etapas),
    status: (r.status as StatusCampanha) ?? 'ativa',
  }
}

export function useMetaCampanha(projetoId: string | null) {
  const [campanhas, setCampanhas] = useState<CampanhaMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) { setCampanhas([]); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('metas_campanha')
        .select('id, projeto_id, nome, alvo, unidade, data_inicio, data_fim, ritmo_dia, etapas, status')
        .eq('projeto_id', projetoId)
        .order('data_inicio', { ascending: false })
      if (e1) throw e1
      setCampanhas(((data ?? []) as DbRow[]).map(mapRow))
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar campanhas de meta')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { load() }, [load])

  /** Campanha ATIVA do projeto — status 'ativa' mais recente por data_inicio (lista já vem desc). */
  const ativa = useMemo(() => campanhas.find((c) => c.status === 'ativa') ?? null, [campanhas])

  /** Histórico = campanhas encerradas/arquivadas (mais recente primeiro). */
  const historico = useMemo(() => campanhas.filter((c) => c.status !== 'ativa'), [campanhas])

  const criarCampanha = useCallback(async (input: NovaCampanhaInput): Promise<string | null> => {
    if (!supabase || !projetoId) return null
    const nova: CampanhaMeta = {
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      nome: input.nome,
      alvo: input.alvo,
      unidade: input.unidade ?? 'ligações',
      data_inicio: input.data_inicio,
      data_fim: input.data_fim,
      ritmo_dia: input.ritmo_dia,
      etapas: input.etapas ?? ETAPAS_PADRAO,
      status: 'ativa',
    }
    // otimista — entra no topo (data_inicio mais recente tende a ser a nova)
    setCampanhas((prev) => [nova, ...prev])
    try {
      const { error: e1 } = await supabase.from('metas_campanha').insert({
        id: nova.id,
        projeto_id: nova.projeto_id,
        nome: nova.nome,
        alvo: nova.alvo,
        unidade: nova.unidade,
        data_inicio: nova.data_inicio,
        data_fim: nova.data_fim,
        ritmo_dia: nova.ritmo_dia,
        etapas: nova.etapas,
        status: nova.status,
        updated_at: new Date().toISOString(),
      })
      if (e1) throw e1
      load()
      return nova.id
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao criar campanha')
      load() // reverte via reload
      return null
    }
  }, [projetoId, load])

  const salvarCampanha = useCallback(async (
    id: string,
    patch: Partial<Omit<CampanhaMeta, 'id' | 'projeto_id'>>,
  ) => {
    // otimista
    setCampanhas((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    if (!supabase) return
    try {
      const { error: e1 } = await supabase
        .from('metas_campanha')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (e1) throw e1
      load()
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao salvar campanha')
      load() // reverte via reload
    }
  }, [load])

  /** Encerra a campanha (status → 'encerrada'). Ela sai do "ativa" e vai pro histórico. */
  const encerrarCampanha = useCallback(
    async (id: string) => salvarCampanha(id, { status: 'encerrada' }),
    [salvarCampanha],
  )

  return { campanhas, ativa, historico, loading, error, reload: load, criarCampanha, salvarCampanha, encerrarCampanha }
}
