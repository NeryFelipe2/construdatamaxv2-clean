import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useMasterScheduleEngine } from './useMasterScheduleEngine'
import {
  computeEvmReal,
  computeEvmRealPorSegmento,
  type BaselineSegmentInput,
  type ComputeEvmRealResult,
  type SegmentoBaselineInput,
  type EvmRealSegmento,
  type ProducaoRealInput,
} from '@/features/evm/utils/computeEvmReal'

const EMPTY_RESULT: ComputeEvmRealResult = {
  serie: [],
  metrics: {
    BAC: 0, PV: 0, EV: 0, AC: 0, CPI: 0, SPI: 0, CV: 0, SV: 0, EAC: 0, ETC: 0, VAC: 0, TCPI: 0,
    eacScenarios: { optimistic: 0, trend: 0, pessimistic: 0 },
  },
}

const SISTEMA_LABEL: Record<string, string> = { agua: 'Água', esgoto: 'Esgoto', civil: 'Civil', geral: 'Geral' }

/**
 * useEvmReal — plugadas as fontes reais (E7) no motor puro `computeEvmReal`,
 * SEM tocar em `evmStore` (mock, intacto no Modo Demo). Só leitura:
 *
 *  - PV: `useMasterScheduleEngine` (nível 0 = grupos núcleo×sistema com
 *    plannedStart/plannedEnd + peso por metragem).
 *  - EV: `producao_diaria` (pra_m + pre_m por lançamento).
 *  - AC: `lancamentos_financeiros` tipo DESPESA.
 *  - BAC: `projetos.orcamento_total`.
 */
export function useEvmReal(projetoId: string | null) {
  const { activities, loading: loadingBaseline, error: baselineError } = useMasterScheduleEngine(projetoId)

  const [bac, setBac] = useState(0)
  const [producaoMetros, setProducaoMetros] = useState<{ data: string; metros: number }[]>([])
  const [producaoPorSegmento, setProducaoPorSegmento] = useState<Map<string, ProducaoRealInput[]>>(new Map())
  const [despesas, setDespesas] = useState<{ data: string; valor: number }[]>([])
  const [temProducaoReal, setTemProducaoReal] = useState(false)
  const [temDespesaReal, setTemDespesaReal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) {
      setBac(0)
      setProducaoMetros([])
      setProducaoPorSegmento(new Map())
      setDespesas([])
      setTemProducaoReal(false)
      setTemDespesaReal(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [projRes, prodRes, finRes] = await Promise.all([
        supabase.from('projetos').select('orcamento_total').eq('id', projetoId).maybeSingle(),
        supabase.from('producao_diaria').select('data, nucleo, pra_m, pre_m').eq('projeto_id', projetoId),
        supabase.from('lancamentos_financeiros').select('data, valor, tipo').eq('project_id', projetoId).eq('tipo', 'DESPESA'),
      ])

      if (projRes.error) throw projRes.error
      if (prodRes.error) throw prodRes.error
      if (finRes.error) throw finRes.error

      setBac(Number(projRes.data?.orcamento_total) || 0)

      const producao = (prodRes.data ?? []).map((r: any) => ({
        data: String(r.data),
        metros: (Number(r.pra_m) || 0) + (Number(r.pre_m) || 0),
      }))
      setProducaoMetros(producao)
      setTemProducaoReal(producao.length > 0)

      // Bucketiza por núcleo × sistema (água = pra_m, esgoto = pre_m) — mesma
      // granularidade dos segmentos nível-0 do baseline (useMasterScheduleEngine),
      // usado pela aba Índices real (CPI/SPI por segmento em vez de agregado).
      const porSegmentoMap = new Map<string, ProducaoRealInput[]>()
      for (const r of prodRes.data ?? []) {
        const nucleo = String((r as any).nucleo ?? '').trim() || 'Sem núcleo'
        const data = String((r as any).data)
        const agua = Number((r as any).pra_m) || 0
        const esgoto = Number((r as any).pre_m) || 0
        if (agua > 0) {
          const k = `${nucleo}|agua`
          const arr = porSegmentoMap.get(k) ?? []
          arr.push({ data, metros: agua })
          porSegmentoMap.set(k, arr)
        }
        if (esgoto > 0) {
          const k = `${nucleo}|esgoto`
          const arr = porSegmentoMap.get(k) ?? []
          arr.push({ data, metros: esgoto })
          porSegmentoMap.set(k, arr)
        }
      }
      setProducaoPorSegmento(porSegmentoMap)

      const desp = (finRes.data ?? []).map((r: any) => ({ data: String(r.data), valor: Number(r.valor) || 0 }))
      setDespesas(desp)
      setTemDespesaReal(desp.length > 0)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar dados reais do EVM')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    load()
  }, [load])

  const baseline: BaselineSegmentInput[] = activities
    .filter((a) => a.level === 0)
    .map((a) => ({
      plannedStart: a.plannedStart,
      plannedEnd: a.plannedEnd,
      weight: (a as any).weight ?? 1,
    }))

  const temDadosReais = temProducaoReal || temDespesaReal
  const result: ComputeEvmRealResult = temDadosReais && bac > 0 && baseline.length > 0
    ? computeEvmReal(baseline, producaoMetros, despesas, bac)
    : EMPTY_RESULT

  // ── Segmentação núcleo × sistema (aba Índices real) ──────────────────────
  // Agrupa as atividades nível-0 (já são grupos núcleo×sistema, ver
  // useMasterScheduleEngine) por chave "núcleo|sistema" e roda o motor puro
  // por segmento — reaproveita o mesmo `computeEvmReal`, sem duplicar lógica.
  const segmentGroups = new Map<string, { nucleo: string; sistema: string; weight: number; starts: string[]; ends: string[] }>()
  for (const a of activities) {
    if (a.level !== 0) continue
    const nucleo = (a.nucleo ?? '').trim() || 'Sem núcleo'
    const sistema = a.networkType ?? 'geral'
    const key = `${nucleo}|${sistema}`
    const g = segmentGroups.get(key) ?? { nucleo, sistema, weight: 0, starts: [], ends: [] }
    g.weight += (a as any).weight ?? 1
    if (a.plannedStart) g.starts.push(a.plannedStart)
    if (a.plannedEnd) g.ends.push(a.plannedEnd)
    segmentGroups.set(key, g)
  }
  const segmentos: SegmentoBaselineInput[] = [...segmentGroups.entries()].map(([key, g]) => ({
    key,
    label: `${g.nucleo} — ${SISTEMA_LABEL[g.sistema] ?? g.sistema}`,
    plannedStart: g.starts.length ? g.starts.reduce((a, b) => (a < b ? a : b)) : '',
    plannedEnd: g.ends.length ? g.ends.reduce((a, b) => (a > b ? a : b)) : '',
    weight: g.weight,
  }))

  const porSegmento: EvmRealSegmento[] = bac > 0 && segmentos.length > 0
    ? computeEvmRealPorSegmento(segmentos, producaoPorSegmento, despesas, bac)
    : []

  return {
    serie: result.serie,
    metrics: result.metrics,
    bac,
    baselineCount: baseline.length,
    temProducaoReal,
    temDespesaReal,
    temDadosReais,
    porSegmento,
    loading: loading || loadingBaseline,
    error: error ?? baselineError,
    reload: load,
  }
}
