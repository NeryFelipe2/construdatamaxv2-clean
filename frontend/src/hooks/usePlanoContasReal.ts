/**
 * usePlanoContasReal — busca `lancamentos_financeiros` (tipo DESPESA) do
 * projeto ativo e agrega por pilar via `computePlanoContasReal` (motor puro,
 * sem Supabase). Só leitura (SELECT).
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { computePlanoContasReal, type PlanoContasRealResult } from '@/features/evm/utils/computePlanoContasReal'

const EMPTY_RESULT: PlanoContasRealResult = {
  porPilar: { material: 0, equipamento: 0, mao_de_obra: 0, impostos_indiretos: 0 },
  naoCategorizado: 0,
  categoriasNaoMapeadas: [],
  total: 0,
}

export function usePlanoContasReal(projetoId: string | null) {
  const [result, setResult] = useState<PlanoContasRealResult>(EMPTY_RESULT)
  const [temDados, setTemDados] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) {
      setResult(EMPTY_RESULT)
      setTemDados(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('lancamentos_financeiros')
        .select('categoria, valor, tipo')
        .eq('project_id', projetoId)
        .eq('tipo', 'DESPESA')
      if (err) throw err

      const lancamentos = (data ?? []).map((r: any) => ({
        categoria: String(r.categoria ?? ''),
        valor: Number(r.valor) || 0,
      }))
      setResult(computePlanoContasReal(lancamentos))
      setTemDados(lancamentos.length > 0)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar plano de contas real')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    load()
  }, [load])

  return {
    porPilar: result.porPilar,
    naoCategorizado: result.naoCategorizado,
    categoriasNaoMapeadas: result.categoriasNaoMapeadas,
    total: result.total,
    temDados,
    loading,
    error,
    reload: load,
  }
}
