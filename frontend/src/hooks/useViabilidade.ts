/**
 * useViabilidade — CRUD dos estudos de viabilidade de contrato (`viabilidade_estudos`)
 * de um projeto. Padrão de hook: useState/useCallback/useEffect, optimistic + revert
 * via reload (mesmo padrão de useSupabaseNsPlanejamento.ts / useFluxoProjecao.ts).
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ViabilidadeEstudo } from '@/features/pre-construcao/utils/computeViabilidade'

export interface ViabilidadeEstudoRow {
  id: string
  projeto_id: string
  nome: string
  payload: ViabilidadeEstudo
  updated_at: string
}

export function useViabilidade(projetoId: string | null) {
  const [estudos, setEstudos] = useState<ViabilidadeEstudoRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) { setEstudos([]); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('viabilidade_estudos')
        .select('id, projeto_id, nome, payload, updated_at')
        .eq('projeto_id', projetoId)
        .order('updated_at', { ascending: false })
      if (e1) throw e1
      setEstudos((data ?? []) as ViabilidadeEstudoRow[])
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar estudos de viabilidade')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { load() }, [load])

  const salvarEstudo = useCallback(async (payload: ViabilidadeEstudo, id?: string) => {
    if (!supabase || !projetoId) return
    const estudoId = id ?? crypto.randomUUID()
    const existente = estudos.find((e) => e.id === estudoId)
    const otimista: ViabilidadeEstudoRow = {
      id: estudoId,
      projeto_id: projetoId,
      nome: payload.nome,
      payload,
      updated_at: new Date().toISOString(),
    }
    setEstudos((prev) => existente
      ? prev.map((e) => (e.id === estudoId ? otimista : e))
      : [otimista, ...prev])

    try {
      const { error: e1 } = await supabase
        .from('viabilidade_estudos')
        .upsert({
          id: estudoId,
          projeto_id: projetoId,
          nome: payload.nome,
          payload,
          updated_at: new Date().toISOString(),
        })
      if (e1) throw e1
      load()
      return estudoId
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao salvar estudo de viabilidade')
      load() // reverte via reload em caso de erro
      return null
    }
  }, [projetoId, estudos, load])

  const excluirEstudo = useCallback(async (id: string) => {
    if (!supabase) return
    setEstudos((prev) => prev.filter((e) => e.id !== id))
    try {
      const { error: e1 } = await supabase.from('viabilidade_estudos').delete().eq('id', id)
      if (e1) throw e1
    } catch {
      load() // reverte via reload em caso de erro
    }
  }, [load])

  return { estudos, loading, error, reload: load, salvarEstudo, excluirEstudo }
}
