/**
 * useIfcModels — lista real dos modelos IFC cadastrados na tabela `ifc_models`.
 * Somente leitura: o parser que faz o insert (upload + extração de `parsed_data`)
 * é outro fluxo, fora deste hook — ver frente do secret APS/Forge. Este hook só
 * confirma e expõe o que já está no banco pro painel do BIM listar de verdade
 * (antes disso a tela nunca consultava `ifc_models` — ficava sempre vazia/mock).
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface IfcModelRow {
  id: string
  fileName: string
  lod: string | null
  elementosCount: number
  tiposCount: Record<string, number>
  createdAt: string | null
  projetoId: string | null
}

interface DbIfcModel {
  id: string
  project_id: string | null
  file_name: string
  lod: string | null
  elementos_count: number | null
  parsed_data: { types?: Record<string, number> } | null
  created_at: string | null
}

function montarModelos(rows: DbIfcModel[]): IfcModelRow[] {
  return rows.map((r) => ({
    id: r.id,
    fileName: r.file_name,
    lod: r.lod,
    elementosCount: r.elementos_count ?? 0,
    tiposCount: r.parsed_data?.types ?? {},
    createdAt: r.created_at,
    projetoId: r.project_id,
  }))
}

export function useIfcModels() {
  const [modelos, setModelos] = useState<IfcModelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('ifc_models')
        .select('id, project_id, file_name, lod, elementos_count, parsed_data, created_at')
        .order('created_at', { ascending: false })
      if (e1) throw e1
      setModelos(montarModelos((data ?? []) as DbIfcModel[]))
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar modelos IFC do Supabase')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { modelos, loading, error, reload: load }
}
