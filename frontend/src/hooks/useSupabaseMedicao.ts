import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type MedicaoStatus = 'pendente' | 'sem_preco' | 'aprovado'

export interface MedicaoItem {
  id: string
  rdo_id: string | null
  atividade_id: string | null
  projeto_id: string | null
  nucleo: string | null
  servico: string
  tubo: string | null
  unidade: string
  quantidade: number
  preco_unitario: number | null
  valor: number | null
  status: MedicaoStatus
  origem: string
  created_at: string
}

export interface MedicaoRdoGrupo {
  rdo_id: string
  data: string | null
  itens: MedicaoItem[]
}

function computeStatus(precoUnitario: number | null, statusAtual: MedicaoStatus): MedicaoStatus {
  if (statusAtual === 'aprovado') return 'aprovado'
  return precoUnitario === null || precoUnitario === undefined ? 'sem_preco' : 'pendente'
}

export function useSupabaseMedicao(projetoId: string | null) {
  const [grupos, setGrupos] = useState<MedicaoRdoGrupo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) { setGrupos([]); return }
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('medicao_itens')
        .select('id, rdo_id, atividade_id, projeto_id, nucleo, servico, tubo, unidade, quantidade, preco_unitario, valor, status, origem, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (projetoId) query = query.eq('projeto_id', projetoId)

      const { data, error: e1 } = await query
      if (e1) throw e1

      const itens = (data ?? []) as MedicaoItem[]
      const rdoIds = Array.from(new Set(itens.map((i) => i.rdo_id).filter((v): v is string => !!v)))

      let datasPorRdo = new Map<string, string | null>()
      if (rdoIds.length > 0) {
        const { data: rdosData, error: e2 } = await supabase
          .from('rdos')
          .select('id, data')
          .in('id', rdoIds)
        if (e2) throw e2
        datasPorRdo = new Map((rdosData ?? []).map((r: any) => [r.id, r.data]))
      }

      const porRdo = new Map<string, MedicaoItem[]>()
      for (const item of itens) {
        const key = item.rdo_id ?? '__sem_rdo__'
        if (!porRdo.has(key)) porRdo.set(key, [])
        porRdo.get(key)!.push(item)
      }

      const gruposMapeados: MedicaoRdoGrupo[] = Array.from(porRdo.entries())
        .map(([rdoId, itensDoGrupo]) => ({
          rdo_id: rdoId,
          data: datasPorRdo.get(rdoId) ?? null,
          itens: itensDoGrupo,
        }))
        .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))

      setGrupos(gruposMapeados)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar itens de medição')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { load() }, [load])

  const atualizarPreco = useCallback(async (itemId: string, precoUnitario: number | null) => {
    if (!supabase) return

    setGrupos((prev) => prev.map((g) => ({
      ...g,
      itens: g.itens.map((i) => {
        if (i.id !== itemId) return i
        const valor = precoUnitario !== null ? precoUnitario * i.quantidade : null
        return { ...i, preco_unitario: precoUnitario, valor, status: computeStatus(precoUnitario, i.status) }
      }),
    })))

    try {
      const itemAtual = grupos.flatMap((g) => g.itens).find((i) => i.id === itemId)
      const quantidade = itemAtual?.quantidade ?? 0
      const valor = precoUnitario !== null ? precoUnitario * quantidade : null
      const novoStatus = computeStatus(precoUnitario, itemAtual?.status ?? 'pendente')

      const { error: e1 } = await supabase
        .from('medicao_itens')
        .update({ preco_unitario: precoUnitario, valor, status: novoStatus, updated_at: new Date().toISOString() })
        .eq('id', itemId)
      if (e1) throw e1
      load()
    } catch {
      load() // reverte via reload em caso de erro
    }
  }, [grupos, load])

  const aprovarItem = useCallback(async (itemId: string) => {
    if (!supabase) return

    setGrupos((prev) => prev.map((g) => ({
      ...g,
      itens: g.itens.map((i) => (i.id === itemId ? { ...i, status: 'aprovado' as MedicaoStatus } : i)),
    })))

    try {
      const { error: e1 } = await supabase
        .from('medicao_itens')
        .update({ status: 'aprovado', updated_at: new Date().toISOString() })
        .eq('id', itemId)
      if (e1) throw e1
    } catch {
      load() // reverte via reload em caso de erro
    }
  }, [load])

  return { grupos, loading, error, reload: load, atualizarPreco, aprovarItem }
}
