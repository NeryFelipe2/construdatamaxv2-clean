/**
 * useFluxoProjecao — CRUD das projeções de fluxo de caixa (`fluxo_projecao`) de um projeto.
 * Padrão de hook: useState/useCallback/useEffect, update otimista + revert via reload
 * em caso de erro (mesmo padrão de useSupabaseNsPlanejamento.ts / useSupabaseMedicao.ts).
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ProjecaoMes {
  id: string
  projeto_id: string
  /** ISO YYYY-MM-DD, sempre dia 01 do mês. */
  mes: string
  recebimento_prev: number
  despesa_prev: number
  obs: string | null
  updated_at: string
}

function monthKeyFromIso(iso: string): string | null {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}` : null
}

function firstDayOfMonth(key: string): string {
  return `${key}-01`
}

function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function useFluxoProjecao(projetoId: string | null) {
  const [projecoes, setProjecoes] = useState<ProjecaoMes[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) { setProjecoes([]); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('fluxo_projecao')
        .select('id, projeto_id, mes, recebimento_prev, despesa_prev, obs, updated_at')
        .eq('projeto_id', projetoId)
        .order('mes', { ascending: true })
      if (e1) throw e1
      setProjecoes((data ?? []) as ProjecaoMes[])
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar projeções de fluxo de caixa')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { load() }, [load])

  /**
   * Cria ou atualiza (upsert por mês) a projeção de um mês. `mes` aceita
   * 'YYYY-MM' ou 'YYYY-MM-DD' — sempre normalizado pro dia 01.
   */
  const salvarProjecao = useCallback(async (
    mes: string,
    patch: Partial<{ recebimento_prev: number; despesa_prev: number; obs: string | null }>,
  ) => {
    if (!supabase || !projetoId) return
    const key = monthKeyFromIso(mes)
    if (!key) return
    const mesIso = firstDayOfMonth(key)

    const existente = projecoes.find((p) => monthKeyFromIso(p.mes) === key)
    const otimista: ProjecaoMes = existente
      ? { ...existente, ...patch }
      : {
          id: crypto.randomUUID(),
          projeto_id: projetoId,
          mes: mesIso,
          recebimento_prev: patch.recebimento_prev ?? 0,
          despesa_prev: patch.despesa_prev ?? 0,
          obs: patch.obs ?? null,
          updated_at: new Date().toISOString(),
        }

    setProjecoes((prev) => {
      if (existente) return prev.map((p) => (p.id === existente.id ? otimista : p))
      return [...prev, otimista].sort((a, b) => a.mes.localeCompare(b.mes))
    })

    try {
      const { error: e1 } = await supabase
        .from('fluxo_projecao')
        .upsert(
          {
            id: otimista.id,
            projeto_id: projetoId,
            mes: mesIso,
            recebimento_prev: otimista.recebimento_prev,
            despesa_prev: otimista.despesa_prev,
            obs: otimista.obs,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'projeto_id,mes' },
        )
      if (e1) throw e1
      load()
    } catch {
      load() // reverte via reload em caso de erro
    }
  }, [projetoId, projecoes, load])

  const excluirProjecao = useCallback(async (id: string) => {
    if (!supabase) return
    setProjecoes((prev) => prev.filter((p) => p.id !== id))
    try {
      const { error: e1 } = await supabase.from('fluxo_projecao').delete().eq('id', id)
      if (e1) throw e1
    } catch {
      load() // reverte via reload em caso de erro
    }
  }, [load])

  /**
   * Gera linhas zeradas (recebimento_prev=despesa_prev=0) para os meses
   * FUTUROS que faltam entre hoje (exclusive, mês seguinte) e `dataFim`
   * (inclusive). Idempotente: nunca duplica um mês que já existe na tabela
   * (checa contra o estado atual antes de inserir). Meses passados/correntes
   * não são gerados aqui porque a série usa o realizado pra eles (ver
   * computeFluxoCaixa.ts).
   */
  const gerarMesesAteFim = useCallback(async (dataFim: string): Promise<number> => {
    if (!supabase || !projetoId) return 0
    const fimKey = monthKeyFromIso(dataFim)
    if (!fimKey) return 0

    const hojeKey = monthKeyFromDate(new Date())
    const existentesKeys = new Set(projecoes.map((p) => monthKeyFromIso(p.mes)))

    const faltantes: string[] = []
    let cursor = addMonths(hojeKey, 1) // primeiro mês futuro
    let guard = 0
    while (cursor <= fimKey && guard < 500) {
      if (!existentesKeys.has(cursor)) faltantes.push(cursor)
      cursor = addMonths(cursor, 1)
      guard++
    }

    if (faltantes.length === 0) return 0

    const novasLinhas: ProjecaoMes[] = faltantes.map((key) => ({
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      mes: firstDayOfMonth(key),
      recebimento_prev: 0,
      despesa_prev: 0,
      obs: null,
      updated_at: new Date().toISOString(),
    }))

    setProjecoes((prev) => [...prev, ...novasLinhas].sort((a, b) => a.mes.localeCompare(b.mes)))

    try {
      const { error: e1 } = await supabase.from('fluxo_projecao').insert(
        novasLinhas.map((l) => ({
          id: l.id,
          projeto_id: l.projeto_id,
          mes: l.mes,
          recebimento_prev: 0,
          despesa_prev: 0,
          obs: null,
        })),
      )
      if (e1) throw e1
      load()
      return novasLinhas.length
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao gerar meses de projeção')
      load() // reverte via reload em caso de erro
      return 0
    }
  }, [projetoId, projecoes, load])

  return { projecoes, loading, error, reload: load, salvarProjecao, excluirProjecao, gerarMesesAteFim }
}
