import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ResumoSistema {
  feito_m: number
  a_fazer_m: number
  total_m: number
  pct_feito: number
}

export interface ResumoPlano {
  agua: ResumoSistema
  esgoto: ResumoSistema
  esgoto_baixas: { registros: number; ids_distintos: number; periodo_fonte: string; ramais_pendentes_gis: number; estimativa_pct: number }
  agua_baixas: { informado_felipe: number; ligacoes_pendentes_gis: number; estimativa_pct: number }
  atualizado_em: string
  por_rua?: Array<{ rua: string; esgoto_exec_m: number; esgoto_afazer_m: number; agua_exec_m: number; agua_afazer_m: number }> | undefined
}

export interface NsItem {
  id: string
  atividade: string
  descricao: string
  quantidade_planejada: number
  data_inicio: string | null
  status: string
  sistema: 'AGUA' | 'ESGOTO'
  equipe_original: string
  ligacoes_ou_ramais: number
  desvio: {
    id: string
    severidade: string
    dias_atraso: number
    acao_recomendada: string
  } | null
  materiais?: {
    brita_m3: number
    areia_m3?: number
    lastro_m3?: number
    reaterro_m3?: number
    bgs_m3?: number
    escavacao_m3?: number
    dias_vca?: number
    dias_mnd?: number
    prof_med_m?: number
    material?: string
  } | null
}

export function useSupabaseNsPlanejamento(projetoId: string | null) {
  const [resumo, setResumo] = useState<ResumoPlano | null>(null)
  const [itens, setItens] = useState<NsItem[]>([])
  const [planoId, setPlanoId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) return
    setLoading(true)
    setError(null)
    try {
      const { data: plano, error: e1 } = await supabase
        .from('planejamentos_semanais')
        .select('id, payload')
        .eq('projeto_id', projetoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (e1) throw e1
      if (!plano) { setItens([]); setResumo(null); setPlanoId(null); return }

      setPlanoId(plano.id)
      const resumoBase = (plano.payload as any)?.resumo_feito_afazer ?? null
      setResumo(resumoBase ? { ...resumoBase, por_rua: (plano.payload as any)?.por_rua } : null)

      const { data: itensData, error: e2 } = await supabase
        .from('planejamento_itens')
        .select('id, atividade, descricao, quantidade_planejada, data_inicio, status, payload')
        .eq('planejamento_id', plano.id)
        .order('atividade')
      if (e2) throw e2

      const { data: desviosData, error: e3 } = await supabase
        .from('desvios_planejamento')
        .select('id, planejamento_item_id, severidade, acao_recomendada, payload')
        .eq('planejamento_id', plano.id)
      if (e3) throw e3

      const desviosPorItem = new Map((desviosData ?? []).map((d) => [d.planejamento_item_id, d]))

      const mapeado: NsItem[] = (itensData ?? []).map((it) => {
        const pl = (it.payload as any) ?? {}
        const dv = desviosPorItem.get(it.id)
        return {
          id: it.id,
          atividade: it.atividade,
          descricao: it.descricao ?? '',
          quantidade_planejada: Number(it.quantidade_planejada),
          data_inicio: it.data_inicio,
          status: it.status,
          sistema: pl.sistema === 'ESGOTO' ? 'ESGOTO' : 'AGUA',
          equipe_original: pl.equipe_original ?? '',
          ligacoes_ou_ramais: pl.ligacoes_ou_ramais ?? 0,
          desvio: dv
            ? { id: dv.id, severidade: dv.severidade, dias_atraso: (dv.payload as any)?.dias_atraso ?? 0, acao_recomendada: dv.acao_recomendada ?? '' }
            : null,
          materiais: pl.brita_m3 !== undefined
            ? {
                brita_m3: pl.brita_m3 ?? 0,
                areia_m3: pl.areia_m3,
                lastro_m3: pl.lastro_m3,
                reaterro_m3: pl.reaterro_m3,
                bgs_m3: pl.bgs_m3,
                escavacao_m3: pl.escavacao_m3,
                dias_vca: pl.dias_vca,
                dias_mnd: pl.dias_mnd,
                prof_med_m: pl.prof_med_m,
                material: pl.material,
              }
            : null,
        }
      })
      setItens(mapeado)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar planejamento NS')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { load() }, [load])

  const marcarConcluido = useCallback(async (item: NsItem) => {
    if (!supabase) return
    setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'concluida', desvio: null } : i)))
    try {
      await supabase.from('planejamento_itens').update({ status: 'concluida', updated_at: new Date().toISOString() }).eq('id', item.id)
      if (item.desvio) {
        await supabase.from('desvios_planejamento').delete().eq('id', item.desvio.id)
      }
    } catch {
      load() // reverte via reload em caso de erro
    }
  }, [load])

  return { resumo, itens, planoId, loading, error, reload: load, marcarConcluido }
}
