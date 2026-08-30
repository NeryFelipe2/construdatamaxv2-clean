/**
 * usePrecosContratoBase.ts — catálogo completo (paginado) da tabela oficial
 * `precos_contrato` para um ano, usado como Base de Custos real no módulo
 * Quantitativos e Orçamento (ao lado das bases mock SINAPI/SEINFRA).
 *
 * Preço aplicado é sempre `valor_unitario × fator_wcr` (60% — regra do
 * contrato, mesma de usePrecosContrato.ts/Medição). `category` usa o campo
 * real `item_contrato` (grupo de itens do contrato) — nunca inventamos uma
 * categoria de negócio que não existe na tabela.
 */
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface PrecoContratoBaseEntry {
  code: string
  description: string
  unit: string
  unitCost: number
  category: string
}

export const ANOS_PRECOS_CONTRATO = ['2025', '2026', '2027']

interface DbRow {
  codigo: string
  descricao: string
  unidade: string | null
  valor_unitario: number
  fator_wcr: number | null
  item_contrato: string | null
}

export function usePrecosContratoBase(anoInicial?: string) {
  const [ano, setAno] = useState(anoInicial ?? String(new Date().getFullYear()))
  const [entries, setEntries] = useState<PrecoContratoBaseEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setEntries([])
      setError('Supabase não configurado — sem dado real disponível.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const pageSize = 1000
      const all: PrecoContratoBaseEntry[] = []
      for (let from = 0; ; from += pageSize) {
        const { data, error: e1 } = await supabase
          .from('precos_contrato')
          .select('codigo, descricao, unidade, valor_unitario, fator_wcr, item_contrato')
          .eq('ano', ano)
          .order('codigo', { ascending: true })
          .range(from, from + pageSize - 1)
        if (e1) throw e1
        if (!data || data.length === 0) break
        for (const r of data as DbRow[]) {
          const fator = Number(r.fator_wcr ?? 0.6)
          all.push({
            code: r.codigo,
            description: r.descricao,
            unit: r.unidade ?? 'un',
            unitCost: Math.round(Number(r.valor_unitario) * fator * 100) / 100,
            category: r.item_contrato ? `Item ${r.item_contrato}` : 'Contrato',
          })
        }
        if (data.length < pageSize) break
      }
      setEntries(all)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar o catálogo do contrato')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [ano])

  useEffect(() => { load() }, [load])

  return { entries, loading, error, ano, setAno, anosDisponiveis: ANOS_PRECOS_CONTRATO, reload: load }
}
