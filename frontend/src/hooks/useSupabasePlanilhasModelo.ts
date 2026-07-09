import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type CategoriaPlanilha = 'planejamento' | 'diario' | 'controle-producao' | 'orcamento' | 'estrutura'

export interface AbaModelo {
  aba: string
  headers: string[]
  linhas: unknown[][]
  ordem: number
}

export interface PlanilhaModelo {
  planilha: string
  categoria: CategoriaPlanilha
  fonteArquivo: string | null
  abas: AbaModelo[]
}

export type PlanilhasPorCategoria = Partial<Record<CategoriaPlanilha, PlanilhaModelo[]>>

interface RawRow {
  planilha: string
  aba: string
  categoria: string
  headers: unknown
  linhas: unknown
  ordem: number | null
  fonte_arquivo: string | null
}

function agrupar(rows: RawRow[]): PlanilhasPorCategoria {
  const porCategoria: PlanilhasPorCategoria = {}
  // planilha -> índice dentro do array da categoria, para acumular abas
  const indice = new Map<string, PlanilhaModelo>()

  for (const row of rows) {
    const categoria = (row.categoria ?? 'planejamento') as CategoriaPlanilha
    const chave = `${categoria}::${row.planilha}`
    let planilhaModelo = indice.get(chave)
    if (!planilhaModelo) {
      planilhaModelo = {
        planilha: row.planilha,
        categoria,
        fonteArquivo: row.fonte_arquivo ?? null,
        abas: [],
      }
      indice.set(chave, planilhaModelo)
      if (!porCategoria[categoria]) porCategoria[categoria] = []
      porCategoria[categoria]!.push(planilhaModelo)
    }
    planilhaModelo.abas.push({
      aba: row.aba,
      headers: Array.isArray(row.headers) ? (row.headers as string[]) : [],
      linhas: Array.isArray(row.linhas) ? (row.linhas as unknown[][]) : [],
      ordem: row.ordem ?? 0,
    })
  }

  // ordena abas por `ordem` dentro de cada planilha, e planilhas por nome
  for (const categoria of Object.keys(porCategoria) as CategoriaPlanilha[]) {
    porCategoria[categoria]!.sort((a, b) => a.planilha.localeCompare(b.planilha))
    for (const p of porCategoria[categoria]!) {
      p.abas.sort((a, b) => a.ordem - b.ordem)
    }
  }

  return porCategoria
}

export function useSupabasePlanilhasModelo() {
  const [porCategoria, setPorCategoria] = useState<PlanilhasPorCategoria>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase não configurado')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('planilhas_modelo')
        .select('planilha, aba, categoria, headers, linhas, ordem, fonte_arquivo')
        .order('categoria', { ascending: true })
        .order('planilha', { ascending: true })
        .order('ordem', { ascending: true })
      if (err) throw err
      setPorCategoria(agrupar((data ?? []) as RawRow[]))
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar planilhas-modelo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { porCategoria, loading, error, reload: load }
}
