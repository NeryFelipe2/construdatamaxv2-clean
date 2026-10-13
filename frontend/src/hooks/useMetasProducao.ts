/**
 * useMetasProducao — CRUD das metas de produção 30 dias (Execução_Relatórios,
 * aba META 30 DIAS → Relatório 360). Tabela `metas_producao`: o "prometido
 * SABESP" por período (ex.: 1.044 ligações + 6.737 m em 30 dias corridos).
 *
 * Padrão seguido de `useProducaoDiaria.ts` / `useSupabaseNsPlanejamento.ts`:
 * useState/useCallback/useEffect, optimistic update + revert via reload em caso de erro.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface MetaProducaoRow {
  id: string
  projetoId: string
  nome: string
  periodoIni: string // ISO yyyy-mm-dd
  periodoFim: string // ISO yyyy-mm-dd
  ligAgua: number
  ligEsgoto: number
  redeAguaM: number
  redeEsgotoM: number
  createdAt: string
}

export interface MetaProducaoInput {
  nome: string
  periodoIni: string
  periodoFim: string
  ligAgua?: number
  ligEsgoto?: number
  redeAguaM?: number
  redeEsgotoM?: number
}

interface DbRow {
  id: string
  projeto_id: string
  nome: string
  periodo_ini: string
  periodo_fim: string
  lig_agua: number
  lig_esgoto: number
  rede_agua_m: number
  rede_esgoto_m: number
  created_at: string
}

function fromDb(row: DbRow): MetaProducaoRow {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    nome: row.nome,
    periodoIni: row.periodo_ini,
    periodoFim: row.periodo_fim,
    ligAgua: Number(row.lig_agua) || 0,
    ligEsgoto: Number(row.lig_esgoto) || 0,
    redeAguaM: Number(row.rede_agua_m) || 0,
    redeEsgotoM: Number(row.rede_esgoto_m) || 0,
    createdAt: row.created_at,
  }
}

function toDbInsert(id: string, projetoId: string, input: MetaProducaoInput): Record<string, unknown> {
  return {
    id,
    projeto_id: projetoId,
    nome: input.nome.trim(),
    periodo_ini: input.periodoIni,
    periodo_fim: input.periodoFim,
    lig_agua: input.ligAgua ?? 0,
    lig_esgoto: input.ligEsgoto ?? 0,
    rede_agua_m: input.redeAguaM ?? 0,
    rede_esgoto_m: input.redeEsgotoM ?? 0,
  }
}

export function useMetasProducao(projetoId: string | null) {
  const [metas, setMetas] = useState<MetaProducaoRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) {
      setMetas([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('metas_producao')
        .select('*')
        .eq('projeto_id', projetoId)
        .order('periodo_ini', { ascending: false })
      if (e1) throw e1
      setMetas(((data ?? []) as DbRow[]).map(fromDb))
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar metas de produção')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    load()
  }, [load])

  const adicionarMeta = useCallback(
    async (input: MetaProducaoInput): Promise<boolean> => {
      if (!projetoId) return false
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const otimista: MetaProducaoRow = {
        id,
        projetoId,
        nome: input.nome.trim(),
        periodoIni: input.periodoIni,
        periodoFim: input.periodoFim,
        ligAgua: input.ligAgua ?? 0,
        ligEsgoto: input.ligEsgoto ?? 0,
        redeAguaM: input.redeAguaM ?? 0,
        redeEsgotoM: input.redeEsgotoM ?? 0,
        createdAt: now,
      }
      setMetas((prev) => [otimista, ...prev])
      if (!supabase) return true
      try {
        const { error: e1 } = await supabase.from('metas_producao').insert(toDbInsert(id, projetoId, input))
        if (e1) throw e1
        return true
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao adicionar meta de produção')
        setMetas((prev) => prev.filter((m) => m.id !== id)) // revert otimista
        return false
      }
    },
    [projetoId],
  )

  const removerMeta = useCallback(
    async (id: string) => {
      setMetas((prev) => prev.filter((m) => m.id !== id))
      if (!supabase) return
      try {
        const { error: e1 } = await supabase.from('metas_producao').delete().eq('id', id)
        if (e1) throw e1
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao remover meta de produção')
        await load() // revert via reload
      }
    },
    [load],
  )

  return {
    metas,
    loading,
    error,
    reload: load,
    adicionarMeta,
    removerMeta,
  }
}
