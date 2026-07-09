import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useMasterScheduleEngine } from './useMasterScheduleEngine'
import {
  computeEvmReal,
  type BaselineSegmentInput,
  type ComputeEvmRealResult,
} from '@/features/evm/utils/computeEvmReal'

const EMPTY_RESULT: ComputeEvmRealResult = {
  serie: [],
  metrics: { BAC: 0, PV: 0, EV: 0, AC: 0, CPI: 0, SPI: 0, CV: 0, SV: 0, EAC: 0, ETC: 0, VAC: 0, TCPI: 0 },
}

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
  const [despesas, setDespesas] = useState<{ data: string; valor: number }[]>([])
  const [temProducaoReal, setTemProducaoReal] = useState(false)
  const [temDespesaReal, setTemDespesaReal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) {
      setBac(0)
      setProducaoMetros([])
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
        supabase.from('producao_diaria').select('data, pra_m, pre_m').eq('projeto_id', projetoId),
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

  return {
    serie: result.serie,
    metrics: result.metrics,
    bac,
    baselineCount: baseline.length,
    temProducaoReal,
    temDespesaReal,
    temDadosReais,
    loading: loading || loadingBaseline,
    error: error ?? baselineError,
    reload: load,
  }
}
