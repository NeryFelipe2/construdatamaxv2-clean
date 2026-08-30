/**
 * useProducaoHoje — leitura (somente-leitura) da produção apontada HOJE em
 * `producao_diaria` (data = hoje, projeto ativo). Alimenta a barra de progresso
 * real dos cards do Kanban de Equipes (produção do dia × meta diária da
 * programação da semana).
 *
 * Nada é inventado: sem supabase / sem projeto / sem linha hoje → lista vazia
 * (o card mostra o aviso honesto "sem apontamento hoje").
 *
 * Padrão de hook: useMetaCorredor.ts — useState/useCallback/useEffect,
 * load com try/catch. Aqui não há escrita (o apontamento entra pelo RDO/bot).
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ProducaoHojeRow {
  id: string
  /** id de wcr_equipes quando o apontamento veio vinculado (raro — quase sempre null). */
  equipeId: string | null
  /** Nome livre da equipe como foi apontado (ex.: "Mazinho", "Cristian e Renan"). */
  equipeNome: string | null
  rua: string | null
  la: number
  le: number
  praM: number
  cUma: number
  preM: number
  cInsp: number
  pv: number
  pi: number
  lie: number
  lia: number
  ihm: number
}

interface DbRow {
  id: string
  equipe_id: string | null
  equipe_nome: string | null
  rua: string | null
  la: number | null
  le: number | null
  pra_m: number | null
  c_uma: number | null
  pre_m: number | null
  c_insp: number | null
  pv: number | null
  pi: number | null
  lie: number | null
  lia: number | null
  ihm: number | null
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function useProducaoHoje(projetoId: string | null) {
  const [rows, setRows] = useState<ProducaoHojeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hoje = hojeIso()

  const load = useCallback(async () => {
    if (!supabase || !projetoId) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('producao_diaria')
        .select('id, equipe_id, equipe_nome, rua, la, le, pra_m, c_uma, pre_m, c_insp, pv, pi, lie, lia, ihm')
        .eq('projeto_id', projetoId)
        .eq('data', hoje)
      if (e1) throw e1
      setRows(
        ((data ?? []) as DbRow[]).map((r) => ({
          id: r.id,
          equipeId: r.equipe_id,
          equipeNome: r.equipe_nome,
          rua: r.rua,
          la: Number(r.la) || 0,
          le: Number(r.le) || 0,
          praM: Number(r.pra_m) || 0,
          cUma: Number(r.c_uma) || 0,
          preM: Number(r.pre_m) || 0,
          cInsp: Number(r.c_insp) || 0,
          pv: Number(r.pv) || 0,
          pi: Number(r.pi) || 0,
          lie: Number(r.lie) || 0,
          lia: Number(r.lia) || 0,
          ihm: Number(r.ihm) || 0,
        })),
      )
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar a produção de hoje')
    } finally {
      setLoading(false)
    }
  }, [projetoId, hoje])

  useEffect(() => { load() }, [load])

  return { rows, hoje, loading, error, reload: load }
}
