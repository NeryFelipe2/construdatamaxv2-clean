/**
 * useMetaCorredor — CRUD do "corredor de meta" (banda mín↔ideal) da Curva S da
 * campanha de meta, tabela `meta_corredor`. Uma linha por semana (seg-sáb) ×
 * campanha, guardando a unidade acumulada mínima aceitável e ideal ao fim da semana.
 *
 * Desde a Campanha de Meta genérica, o corredor é POR CAMPANHA (`campanha_id`):
 * o select filtra por ele e o upsert grava junto. Sem campanha → lista vazia.
 *
 * Padrão de hook: mesmo de useFluxoProjecao.ts — update otimista + upsert por
 * (projeto_id, semana_inicio); reverte via reload em erro. Nada é inventado: o que
 * a tela desenha como banda vem do que estiver salvo aqui (semeado com um padrão
 * editável). Ver [[useMetaLigacoes]] para o realizado que é comparado contra a banda.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface SemanaCorredor {
  id: string
  projeto_id: string
  /** ISO yyyy-mm-dd — segunda-feira da semana. */
  semana_inicio: string
  /** Acumulado MÍNIMO aceitável ao fim da semana. */
  acum_min: number
  /** Acumulado IDEAL ao fim da semana. */
  acum_ideal: number
  updated_at: string
}

interface DbRow {
  id: string
  projeto_id: string
  semana_inicio: string
  acum_min: number | null
  acum_ideal: number | null
  updated_at: string
}

export function useMetaCorredor(projetoId: string | null, campanhaId: string | null) {
  const [semanas, setSemanas] = useState<SemanaCorredor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId || !campanhaId) { setSemanas([]); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('meta_corredor')
        .select('id, projeto_id, semana_inicio, acum_min, acum_ideal, updated_at')
        .eq('projeto_id', projetoId)
        .eq('campanha_id', campanhaId)
        .order('semana_inicio', { ascending: true })
      if (e1) throw e1
      setSemanas(
        ((data ?? []) as DbRow[]).map((r) => ({
          id: r.id,
          projeto_id: r.projeto_id,
          semana_inicio: String(r.semana_inicio).slice(0, 10),
          acum_min: Number(r.acum_min) || 0,
          acum_ideal: Number(r.acum_ideal) || 0,
          updated_at: r.updated_at,
        })),
      )
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar o corredor da meta')
    } finally {
      setLoading(false)
    }
  }, [projetoId, campanhaId])

  useEffect(() => { load() }, [load])

  /** Atualiza min/ideal de uma semana (upsert por projeto_id+semana_inicio, gravando campanha_id). */
  const salvarSemana = useCallback(async (
    semanaInicio: string,
    patch: Partial<{ acum_min: number; acum_ideal: number }>,
  ) => {
    if (!supabase || !projetoId || !campanhaId) return
    const existente = semanas.find((s) => s.semana_inicio === semanaInicio)
    const otimista: SemanaCorredor = existente
      ? { ...existente, ...patch }
      : {
          id: crypto.randomUUID(),
          projeto_id: projetoId,
          semana_inicio: semanaInicio,
          acum_min: patch.acum_min ?? 0,
          acum_ideal: patch.acum_ideal ?? 0,
          updated_at: new Date().toISOString(),
        }

    setSemanas((prev) => {
      if (existente) return prev.map((s) => (s.id === existente.id ? otimista : s))
      return [...prev, otimista].sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio))
    })

    try {
      const { error: e1 } = await supabase
        .from('meta_corredor')
        .upsert(
          {
            id: otimista.id,
            projeto_id: projetoId,
            campanha_id: campanhaId,
            semana_inicio: semanaInicio,
            acum_min: otimista.acum_min,
            acum_ideal: otimista.acum_ideal,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'projeto_id,semana_inicio' },
        )
      if (e1) throw e1
      load()
    } catch {
      load() // reverte via reload em caso de erro
    }
  }, [projetoId, campanhaId, semanas, load])

  const temCorredor = useMemo(() => semanas.length > 0, [semanas])

  return { semanas, temCorredor, loading, error, reload: load, salvarSemana }
}
