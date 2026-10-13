/**
 * useCronogramaEquipe.ts
 *
 * Hook Supabase (Missão 4 do design "Cronograma por Equipe") que expõe:
 *  - o cronograma calculado por equipe (via `computeVariasEquipes`, motor
 *    puro da Missão 3), casando a produtividade REAL de cada equipe (RDO,
 *    `useMasterScheduleEngine`/`teamVelocities`) com o líder canônico
 *    (`wcr_equipes`) através de `matchEquipe`;
 *  - CRUD otimista de `equipe_cronograma_itens` (a única tabela em que este
 *    hook escreve).
 *
 * Não toca em `rdos`/`rdo_equipes`/`rdo_atividades`/`planejamento_itens`
 * (apenas leitura indireta via `useMasterScheduleEngine`, que já é
 * somente-leitura nelas).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useMasterScheduleEngine } from '@/hooks/useMasterScheduleEngine'
import { matchEquipe, type MatchCandidate } from '@/lib/matching/equipeMatch'
import {
  computeVariasEquipes,
  type EquipeCalcInput,
  type EquipeCronograma,
  type ItemTrabalho,
  type ProdutividadePadrao,
} from '@/lib/matching/cronogramaEquipeCompute'

// ─── Tipos de linha crua (Supabase) ──────────────────────────────────────────

interface EquipeCronogramaItemRow {
  id: string
  projeto_id: string
  equipe_id: string
  ordem: number
  fonte: 'rua' | 'ns' | 'livre'
  ref: string | null
  descricao: string
  sistema: 'AGUA' | 'ESGOTO'
  metragem: number
  produtividade_override: number | null
  data_inicio_manual: string | null
  updated_at: string
}

interface WcrEquipeLider {
  id: string
  lider: string
}

// ─── Tipos de entrada do CRUD (o que o consumidor do hook passa) ────────────

export interface NovoItemCronograma {
  equipeId: string
  /** Se omitido, entra no fim da lista da equipe (última ordem + 1). */
  ordem?: number
  fonte: 'rua' | 'ns' | 'livre'
  /** id da rua/trecho ou da NS de origem. null/omitido quando fonte = 'livre'. */
  ref?: string | null
  descricao: string
  sistema: 'AGUA' | 'ESGOTO'
  metragem: number
  produtividadeOverride?: number | null
  dataInicioManual?: string | null
}

export interface PatchItemCronograma {
  ordem?: number
  fonte?: 'rua' | 'ns' | 'livre'
  ref?: string | null
  descricao?: string
  sistema?: 'AGUA' | 'ESGOTO'
  metragem?: number
  produtividadeOverride?: number | null
  dataInicioManual?: string | null
}

// ─── Conversões linha crua ⇄ tipos do motor puro ────────────────────────────

function rowToItemTrabalho(row: EquipeCronogramaItemRow): ItemTrabalho {
  return {
    id: row.id,
    equipeId: row.equipe_id,
    ordem: row.ordem,
    fonte: row.fonte,
    descricao: row.descricao,
    sistema: row.sistema,
    metragem: Number(row.metragem),
    produtividadeOverride: row.produtividade_override != null ? Number(row.produtividade_override) : null,
    dataInicioManual: row.data_inicio_manual,
  }
}

function patchParaColunas(patch: PatchItemCronograma): Record<string, unknown> {
  const colunas: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.ordem !== undefined) colunas.ordem = patch.ordem
  if (patch.fonte !== undefined) colunas.fonte = patch.fonte
  if (patch.ref !== undefined) colunas.ref = patch.ref
  if (patch.descricao !== undefined) colunas.descricao = patch.descricao
  if (patch.sistema !== undefined) colunas.sistema = patch.sistema
  if (patch.metragem !== undefined) colunas.metragem = patch.metragem
  if (patch.produtividadeOverride !== undefined) colunas.produtividade_override = patch.produtividadeOverride
  if (patch.dataInicioManual !== undefined) colunas.data_inicio_manual = patch.dataInicioManual
  return colunas
}

function aplicarPatchNaLinha(row: EquipeCronogramaItemRow, colunas: Record<string, unknown>): EquipeCronogramaItemRow {
  return { ...row, ...colunas } as EquipeCronogramaItemRow
}

export function useCronogramaEquipe(projetoId: string | null) {
  const [itensRaw, setItensRaw] = useState<EquipeCronogramaItemRow[]>([])
  const [produtividadePadrao, setProdutividadePadrao] = useState<ProdutividadePadrao[]>([])
  const [wcrEquipesLideres, setWcrEquipesLideres] = useState<WcrEquipeLider[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Produtividade REAL por equipe vem do motor macro existente (RDOs do
  // projeto ativo). Não duplicamos a leitura de rdos/rdo_equipes/rdo_atividades
  // aqui — só reaproveitamos o hook já testado.
  const { teamVelocities } = useMasterScheduleEngine(projetoId)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) {
      setItensRaw([])
      setProdutividadePadrao([])
      setWcrEquipesLideres([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: itensData, error: e1 } = await supabase
        .from('equipe_cronograma_itens')
        .select('id, projeto_id, equipe_id, ordem, fonte, ref, descricao, sistema, metragem, produtividade_override, data_inicio_manual, updated_at')
        .eq('projeto_id', projetoId)
        .order('equipe_id')
        .order('ordem')
      if (e1) throw e1
      setItensRaw((itensData ?? []) as EquipeCronogramaItemRow[])

      const { data: padraoData, error: e2 } = await supabase
        .from('produtividade_padrao')
        .select('sistema, tipo_servico, m_dia')
      if (e2) throw e2
      setProdutividadePadrao(
        (padraoData ?? []).map((p): ProdutividadePadrao => ({
          sistema: p.sistema === 'ESGOTO' ? 'ESGOTO' : 'AGUA',
          tipoServico: p.tipo_servico,
          mDia: Number(p.m_dia),
        })),
      )

      const { data: equipesData, error: e3 } = await supabase
        .from('wcr_equipes')
        .select('id, lider')
      if (e3) throw e3
      setWcrEquipesLideres((equipesData ?? []).map((e) => ({ id: e.id, lider: e.lider })))
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar cronograma por equipe')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    load()
  }, [load])

  // ─── Casamento equipe canônica ↔ produtividade real (RDO) ─────────────────
  const mapaProdutividadeReal = useMemo(() => {
    const mapa = new Map<string, number>()
    if (wcrEquipesLideres.length === 0 || teamVelocities.length === 0) return mapa

    const candidatos: MatchCandidate[] = teamVelocities
      .filter((t) => t.liderNome)
      .map((t) => ({ key: t.key, liderNome: t.liderNome as string }))
    if (candidatos.length === 0) return mapa

    for (const eq of wcrEquipesLideres) {
      const match = matchEquipe(eq.lider, candidatos)
      if (!match) continue
      const velocidade = teamVelocities.find((t) => t.key === match.key)
      if (velocidade && velocidade.metrosPorDia > 0) {
        mapa.set(eq.id, velocidade.metrosPorDia)
      }
    }
    return mapa
  }, [wcrEquipesLideres, teamVelocities])

  // ─── Agrupamento por equipe + cálculo (motor puro da Missão 3) ────────────
  const cronogramasPorEquipe = useMemo((): EquipeCronograma[] => {
    const porEquipe = new Map<string, EquipeCronogramaItemRow[]>()
    for (const row of itensRaw) {
      const lista = porEquipe.get(row.equipe_id) ?? []
      lista.push(row)
      porEquipe.set(row.equipe_id, lista)
    }

    const inputs: EquipeCalcInput[] = Array.from(porEquipe.entries()).map(([equipeId, rows]) => ({
      equipeId,
      produtividadeReal: mapaProdutividadeReal.get(equipeId) ?? null,
      itens: rows.map(rowToItemTrabalho),
    }))

    const hoje = new Date().toISOString().slice(0, 10)
    return computeVariasEquipes(inputs, produtividadePadrao, hoje)
  }, [itensRaw, produtividadePadrao, mapaProdutividadeReal])

  // ─── CRUD (única escrita: equipe_cronograma_itens) ─────────────────────────

  const adicionarItem = useCallback(async (item: NovoItemCronograma) => {
    if (!supabase || !projetoId) return
    const id = crypto.randomUUID()
    const ordem = item.ordem ?? (
      Math.max(-1, ...itensRaw.filter((r) => r.equipe_id === item.equipeId).map((r) => r.ordem)) + 1
    )
    const novaLinha: EquipeCronogramaItemRow = {
      id,
      projeto_id: projetoId,
      equipe_id: item.equipeId,
      ordem,
      fonte: item.fonte,
      ref: item.ref ?? null,
      descricao: item.descricao,
      sistema: item.sistema,
      metragem: item.metragem,
      produtividade_override: item.produtividadeOverride ?? null,
      data_inicio_manual: item.dataInicioManual ?? null,
      updated_at: new Date().toISOString(),
    }

    setItensRaw((prev) => [...prev, novaLinha])
    try {
      const { error: insErr } = await supabase.from('equipe_cronograma_itens').insert(novaLinha)
      if (insErr) throw insErr
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao adicionar item de trabalho')
      setItensRaw((prev) => prev.filter((r) => r.id !== id)) // reverte
    }
  }, [projetoId, itensRaw])

  const atualizarItem = useCallback(async (id: string, patch: PatchItemCronograma) => {
    if (!supabase) return
    const anterior = itensRaw.find((r) => r.id === id)
    if (!anterior) return
    const colunas = patchParaColunas(patch)

    setItensRaw((prev) => prev.map((r) => (r.id === id ? aplicarPatchNaLinha(r, colunas) : r)))
    try {
      const { error: updErr } = await supabase.from('equipe_cronograma_itens').update(colunas).eq('id', id)
      if (updErr) throw updErr
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao atualizar item de trabalho')
      setItensRaw((prev) => prev.map((r) => (r.id === id ? anterior : r))) // reverte
    }
  }, [itensRaw])

  const removerItem = useCallback(async (id: string) => {
    if (!supabase) return
    const anterior = itensRaw.find((r) => r.id === id)
    setItensRaw((prev) => prev.filter((r) => r.id !== id))
    try {
      const { error: delErr } = await supabase.from('equipe_cronograma_itens').delete().eq('id', id)
      if (delErr) throw delErr
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao remover item de trabalho')
      if (anterior) setItensRaw((prev) => [...prev, anterior]) // reverte
    }
  }, [itensRaw])

  const reordenarItens = useCallback(async (equipeId: string, novaOrdemIds: string[]) => {
    if (!supabase) return
    const anterior = itensRaw

    setItensRaw((prev) => prev.map((r) => {
      if (r.equipe_id !== equipeId) return r
      const idx = novaOrdemIds.indexOf(r.id)
      return idx >= 0 ? { ...r, ordem: idx } : r
    }))

    try {
      const resultados = await Promise.all(
        novaOrdemIds.map((id, idx) =>
          supabase.from('equipe_cronograma_itens').update({ ordem: idx, updated_at: new Date().toISOString() }).eq('id', id),
        ),
      )
      const falhou = resultados.find((r) => r.error)
      if (falhou?.error) throw falhou.error
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao reordenar itens')
      setItensRaw(anterior) // reverte
    }
  }, [itensRaw])

  return {
    cronogramasPorEquipe,
    produtividadePadrao,
    loading,
    error,
    adicionarItem,
    atualizarItem,
    removerItem,
    reordenarItens,
    reload: load,
  }
}
