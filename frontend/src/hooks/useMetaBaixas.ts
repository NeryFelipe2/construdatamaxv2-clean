/**
 * useMetaBaixas — série OFICIAL de baixas da campanha (`meta_baixas`).
 * "Baixa" = acumulado registrado no app ZN da Sabesp (fonte oficial de faturamento),
 * informado manualmente na tela — 1 linha por dia (unique campanha_id+data).
 *
 * É a série que o dono quer ver LADO A LADO com o apontamento de campo: o funil
 * (etapa final) e a Curva S mostram as DUAS — divergência visível, nunca escondida.
 *
 * Padrão de hook: useMetaCorredor.ts — load try/catch, update otimista,
 * upsert onConflict, revert via reload.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface BaixaZn {
  id: string
  /** ISO yyyy-mm-dd do registro. */
  data: string
  /** Acumulado OFICIAL de baixas no app ZN até essa data. */
  acumulado: number
  fonte: string | null
  obs: string | null
}

interface DbRow {
  id: string
  data: string
  acumulado: number | null
  fonte: string | null
  obs: string | null
}

export function useMetaBaixas(campanhaId: string | null) {
  const [baixas, setBaixas] = useState<BaixaZn[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !campanhaId) { setBaixas([]); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('meta_baixas')
        .select('id, data, acumulado, fonte, obs')
        .eq('campanha_id', campanhaId)
        .order('data', { ascending: true })
      if (e1) throw e1
      setBaixas(
        ((data ?? []) as DbRow[]).map((r) => ({
          id: r.id,
          data: String(r.data).slice(0, 10),
          acumulado: Number(r.acumulado) || 0,
          fonte: r.fonte,
          obs: r.obs,
        })),
      )
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar as baixas ZN da campanha')
    } finally {
      setLoading(false)
    }
  }, [campanhaId])

  useEffect(() => { load() }, [load])

  /** Última baixa registrada (maior data) — o número OFICIAL mais recente. */
  const ultima = useMemo(
    () => (baixas.length ? baixas[baixas.length - 1] : null),
    [baixas],
  )

  /** Grava/atualiza a baixa do dia (upsert por campanha_id+data). */
  const salvarBaixa = useCallback(async (data: string, acumulado: number, fonte?: string) => {
    if (!supabase || !campanhaId) return
    const dia = data.slice(0, 10)
    const existente = baixas.find((b) => b.data === dia)
    const otimista: BaixaZn = existente
      ? { ...existente, acumulado, fonte: fonte?.trim() || existente.fonte }
      : { id: crypto.randomUUID(), data: dia, acumulado, fonte: fonte?.trim() || null, obs: null }

    setBaixas((prev) => {
      const semODia = prev.filter((b) => b.data !== dia)
      return [...semODia, otimista].sort((a, b) => a.data.localeCompare(b.data))
    })
    try {
      const { error: e1 } = await supabase
        .from('meta_baixas')
        .upsert(
          {
            id: otimista.id,
            campanha_id: campanhaId,
            data: dia,
            acumulado: otimista.acumulado,
            fonte: otimista.fonte,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'campanha_id,data' },
        )
      if (e1) throw e1
      load()
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao salvar a baixa ZN')
      load() // reverte via reload
    }
  }, [campanhaId, baixas, load])

  /** Remove uma baixa registrada errada. */
  const removerBaixa = useCallback(async (id: string) => {
    setBaixas((prev) => prev.filter((b) => b.id !== id))
    if (!supabase) return
    try {
      const { error: e1 } = await supabase.from('meta_baixas').delete().eq('id', id)
      if (e1) throw e1
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao remover a baixa')
      load()
    }
  }, [load])

  return { baixas, ultima, loading, error, reload: load, salvarBaixa, removerBaixa }
}
