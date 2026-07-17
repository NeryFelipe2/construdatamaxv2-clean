/**
 * useProgramacaoSemana.ts
 *
 * Hook Supabase (somente-leitura) que expõe a PROGRAMAÇÃO DA SEMANA gravada em
 * `programacao_semana` (o "previsto" montado com a gestão: por frente → equipe →
 * serviço + meta/dia). Pega sempre a semana MAIS RECENTE (maior semana_ini) e
 * agrupa por frente e equipe pro Kanban da tela. Nunca inventa dados: se o
 * supabase não estiver disponível (demo) ou a tabela estiver vazia, devolve
 * lista vazia sem quebrar.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ProgramacaoRow {
  id: string
  semana_ini: string
  semana_fim: string
  frente: string
  equipe: string
  servico: string
  meta_qtd: number | null
  meta_unidade: string | null
  obs: string | null
}

export interface ServicoProgramado {
  servico: string
  metaQtd: number | null
  metaUnidade: string | null
  obs: string | null
}
export interface EquipeProgramada {
  equipe: string
  servicos: ServicoProgramado[]
}
export interface FrenteProgramada {
  frente: string
  equipes: EquipeProgramada[]
}

// Ordem canônica das frentes (as demais, se surgirem, vão pro fim em ordem alfabética).
const ORDEM_FRENTE = ['Boi Malhado', 'Ilha Bela', 'Retorno']

export function useProgramacaoSemana() {
  const [rows, setRows] = useState<ProgramacaoRow[]>([])
  const [semanaIni, setSemanaIni] = useState<string | null>(null)
  const [semanaFim, setSemanaFim] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setRows([])
      setSemanaIni(null)
      setSemanaFim(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      // 1) descobre a semana mais recente
      const { data: ult, error: e0 } = await supabase
        .from('programacao_semana')
        .select('semana_ini, semana_fim')
        .order('semana_ini', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (e0) throw e0
      if (!ult) {
        setRows([])
        setSemanaIni(null)
        setSemanaFim(null)
        return
      }
      setSemanaIni(ult.semana_ini)
      setSemanaFim(ult.semana_fim)

      // 2) lê os itens dessa semana
      const { data, error: e1 } = await supabase
        .from('programacao_semana')
        .select('id, semana_ini, semana_fim, frente, equipe, servico, meta_qtd, meta_unidade, obs')
        .eq('semana_ini', ult.semana_ini)
      if (e1) throw e1
      setRows((data ?? []) as ProgramacaoRow[])
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar a programação da semana')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const frentes = useMemo((): FrenteProgramada[] => {
    const porFrente = new Map<string, Map<string, ServicoProgramado[]>>()
    for (const r of rows) {
      if (!porFrente.has(r.frente)) porFrente.set(r.frente, new Map())
      const eqMap = porFrente.get(r.frente)!
      if (!eqMap.has(r.equipe)) eqMap.set(r.equipe, [])
      eqMap.get(r.equipe)!.push({
        servico: r.servico,
        metaQtd: r.meta_qtd != null ? Number(r.meta_qtd) : null,
        metaUnidade: r.meta_unidade,
        obs: r.obs && r.obs.trim() ? r.obs.trim() : null,
      })
    }
    const lista: FrenteProgramada[] = Array.from(porFrente.entries()).map(([frente, eqMap]) => ({
      frente,
      equipes: Array.from(eqMap.entries()).map(([equipe, servicos]) => ({ equipe, servicos })),
    }))
    lista.sort((a, b) => {
      const ia = ORDEM_FRENTE.indexOf(a.frente)
      const ib = ORDEM_FRENTE.indexOf(b.frente)
      if (ia === -1 && ib === -1) return a.frente.localeCompare(b.frente)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    return lista
  }, [rows])

  return { frentes, semanaIni, semanaFim, loading, error, reload: load }
}
