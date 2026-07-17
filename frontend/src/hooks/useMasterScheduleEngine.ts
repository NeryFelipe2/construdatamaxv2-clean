import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  computeMasterScheduleFromRaw,
  type MasterActivityLike,
  type MasterAggregate,
  type TeamVelocity,
  type MatchQuality,
  type RawItem,
  type RawRdo,
  type RawRdoEquipe,
  type RawRdoAtividade,
} from '@/lib/matching/masterScheduleCompute'
import { parseBaselineCronogramaMacro, type BaselineNucleo } from '@/lib/matching/baselineCronograma'

/**
 * useMasterScheduleEngine — busca os dados reais (só SELECT, nunca
 * insert/update/delete) do projeto ativo e calcula o cronograma MACRO via
 * `computeMasterScheduleFromRaw` (função pura, sem Supabase).
 *
 * Sequência de leitura:
 *  1. planejamentos_semanais mais recente do projeto
 *  2. planejamento_itens desse plano
 *  3. rdos do projeto
 *  4. rdo_equipes desses rdos
 *  5. rdo_atividades dessas equipes
 */
export function useMasterScheduleEngine(projetoId: string | null) {
  const [activities, setActivities] = useState<MasterActivityLike[]>([])
  const [aggregates, setAggregates] = useState<MasterAggregate[]>([])
  const [teamVelocities, setTeamVelocities] = useState<TeamVelocity[]>([])
  const [matchQuality, setMatchQuality] = useState<MatchQuality>({ totalItens: 0, comMatch: 0, semMatch: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) {
      setActivities([])
      setAggregates([])
      setTeamVelocities([])
      setMatchQuality({ totalItens: 0, comMatch: 0, semMatch: 0 })
      return
    }
    setLoading(true)
    setError(null)
    try {
      // Núcleo do projeto ativo (1 projeto = 1 núcleo). Best-effort: se a
      // query falhar ou não achar o projeto, `nucleoPadrao` fica undefined e
      // o compute cai no fallback antigo (inferNucleoFromText).
      let nucleoPadrao: string | undefined
      try {
        const { data: projeto } = await supabase
          .from('projetos')
          .select('nome')
          .eq('id', projetoId)
          .maybeSingle()
        if (projeto?.nome) {
          nucleoPadrao = projeto.nome.replace(/^\s*WCR\s*[—–-]\s*/i, '').trim() || undefined
        }
      } catch {
        nucleoPadrao = undefined
      }

      // Um projeto pode ter VÁRIOS planejamentos_semanais (import QGIS, "A
      // Fazer" manual, Planejamento Mestre criado na UI, etc.) — soma os itens
      // de todos, em vez de só o mais recente. Pegar só o mais recente escondia
      // os 69/84 itens reais do import assim que qualquer container novo
      // (mesmo vazio) era criado depois — bug real encontrado 09/07/2026.
      const { data: planos, error: e1 } = await supabase
        .from('planejamentos_semanais')
        .select('id')
        .eq('projeto_id', projetoId)
      if (e1) throw e1

      if (!planos || planos.length === 0) {
        setActivities([])
        setAggregates([])
        setTeamVelocities([])
        setMatchQuality({ totalItens: 0, comMatch: 0, semMatch: 0 })
        return
      }

      const { data: itensData, error: e2 } = await supabase
        .from('planejamento_itens')
        .select('id, atividade, descricao, quantidade_planejada, data_inicio, status, payload')
        .in('planejamento_id', planos.map((p) => p.id))
      if (e2) throw e2

      // Baseline oficial por núcleo (CRONOGRAMA_MACRO). Best-effort: falha ou
      // vazio -> undefined, e o compute degrada graciosamente (plannedEnd do
      // núcleo cai de volta na projeção, como já era antes desta baseline).
      let baselinePorNucleo: Map<string, BaselineNucleo> | undefined
      try {
        const { data: cronogramaMacro } = await supabase
          .from('planilhas_modelo')
          .select('linhas')
          .eq('planilha', 'PLANEJAMENTO_WCR_v3')
          .eq('aba', 'CRONOGRAMA_MACRO')
          .maybeSingle()
        if (cronogramaMacro?.linhas) {
          const parsed = parseBaselineCronogramaMacro(cronogramaMacro.linhas as unknown[][])
          baselinePorNucleo = parsed.size > 0 ? parsed : undefined
        }
      } catch {
        baselinePorNucleo = undefined
      }

      const { data: rdosData, error: e3 } = await supabase
        .from('rdos')
        .select('id, data')
        .eq('projeto_id', projetoId)
      if (e3) throw e3

      const rdos = rdosData ?? []
      const rdoIds = rdos.map((r) => r.id)

      let rdoEquipes: RawRdoEquipe[] = []
      if (rdoIds.length > 0) {
        const { data: equipesData, error: e4 } = await supabase
          .from('rdo_equipes')
          .select('id, rdo_id, lider_nome')
          .in('rdo_id', rdoIds)
        if (e4) throw e4
        rdoEquipes = equipesData ?? []
      }

      const equipeIds = rdoEquipes.map((e) => e.id)
      let rdoAtividades: RawRdoAtividade[] = []
      if (equipeIds.length > 0) {
        const { data: atividadesData, error: e5 } = await supabase
          .from('rdo_atividades')
          .select('equipe_id, metragem, rua, servico')
          .in('equipe_id', equipeIds)
        if (e5) throw e5
        rdoAtividades = atividadesData ?? []
      }

      const itens: RawItem[] = (itensData ?? []).map((it) => ({
        id: it.id,
        atividade: it.atividade,
        descricao: it.descricao,
        quantidade_planejada: Number(it.quantidade_planejada),
        data_inicio: it.data_inicio,
        status: it.status,
        payload: it.payload,
      }))

      const result = computeMasterScheduleFromRaw({
        itens,
        rdos: rdos as RawRdo[],
        rdoEquipes,
        rdoAtividades,
        nucleoPadrao,
        baselinePorNucleo,
      })

      setActivities(result.activities)
      setAggregates(result.aggregates)
      setTeamVelocities(result.teamVelocities)
      setMatchQuality(result.matchQuality)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao calcular cronograma mestre')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    load()
  }, [load])

  return { activities, aggregates, teamVelocities, matchQuality, loading, error, reload: load }
}
