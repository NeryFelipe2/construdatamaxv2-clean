/**
 * useNsPorEquipe — conta quantas NS (não concluídas) estão atribuídas a cada
 * equipe, pro badge do Kanban ("NS atribuídas" — Fase 3, liga NS ao Kanban).
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useNsPorEquipe(projetoId: string | null) {
  const [porEquipe, setPorEquipe] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) { setPorEquipe(new Map()); return }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('ns')
        .select('equipe_id, status')
        .eq('projeto_id', projetoId)
        .not('equipe_id', 'is', null)
      if (error) throw error
      const map = new Map<string, number>()
      for (const row of data ?? []) {
        if (!row.equipe_id || row.status === 'CONCLUIDA' || row.status === 'MEDIDA') continue
        map.set(row.equipe_id, (map.get(row.equipe_id) ?? 0) + 1)
      }
      setPorEquipe(map)
    } catch {
      // fica com o que já tinha — não quebra o quadro
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { load() }, [load])

  return { porEquipe, loading, reload: load }
}
