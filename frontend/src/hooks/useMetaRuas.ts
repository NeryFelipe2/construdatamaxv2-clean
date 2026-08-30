/**
 * useMetaRuas — CRUD da matriz rua × etapa da campanha de meta (`meta_ruas`).
 * Cada rua guarda `status_etapa` (jsonb) com o estado de CADA etapa da campanha
 * ({ [key]: { status, prazo } }) — estilo Construcode: a etapa seguinte fica com
 * CADEADO enquanto a anterior não estiver 'concluido'.
 *
 * Também agrega o realizado REAL de `producao_diaria` por rua dentro da janela
 * da campanha (match de nome case/acento-insensitive e por inclusão parcial —
 * as grafias variam entre apontamento e cadastro). A divergência entre o status
 * marcado na matriz e o apontado de campo fica VISÍVEL, nunca escondida.
 *
 * Padrão de hook: useMetaCorredor.ts — load try/catch, update otimista,
 * revert via reload. Nada é inventado.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CampanhaMeta, EtapaCampanha } from './useMetaCampanha'

export type StatusEtapaRua = 'pendente' | 'em_execucao' | 'concluido' | 'problema'

export interface EstadoEtapaRua {
  status: StatusEtapaRua
  /** ISO yyyy-mm-dd ou null — prazo prometido pra etapa nesta rua. */
  prazo: string | null
}

export interface RuaMeta {
  id: string
  rua: string
  nucleo: string | null
  equipeId: string | null
  /** Casas cadastradas na rua — null = sem cadastro (aviso honesto, não zero). */
  casasAlvo: number | null
  ordem: number
  /** Estado por etapa da campanha, chaveado pela `key` da etapa. */
  statusEtapa: Record<string, EstadoEtapaRua>
  obs: string | null
}

/**
 * Cadeado Construcode (função pura): a etapa `etapaKey` está BLOQUEADA se a
 * etapa anterior na cadeia da campanha ainda não estiver 'concluido'.
 * A primeira etapa nunca bloqueia.
 */
export function etapaBloqueada(rua: RuaMeta, etapaKey: string, etapas: EtapaCampanha[]): boolean {
  const idx = etapas.findIndex((e) => e.key === etapaKey)
  if (idx <= 0) return false
  const anterior = etapas[idx - 1]
  return (rua.statusEtapa[anterior.key]?.status ?? 'pendente') !== 'concluido'
}

/** Normaliza nome de rua p/ match: minúsculas, sem acento, espaços colapsados.
 *  Exportada — o heatmap rua × dia da tela Metas reusa a MESMA normalização. */
export function normalizarRua(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const STATUS_VALIDOS: StatusEtapaRua[] = ['pendente', 'em_execucao', 'concluido', 'problema']

function mapStatusEtapa(raw: unknown): Record<string, EstadoEtapaRua> {
  const out: Record<string, EstadoEtapaRua> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue
    const v = val as Record<string, unknown>
    const status = STATUS_VALIDOS.includes(v.status as StatusEtapaRua)
      ? (v.status as StatusEtapaRua)
      : 'pendente'
    const prazo = typeof v.prazo === 'string' && v.prazo ? v.prazo.slice(0, 10) : null
    out[key] = { status, prazo }
  }
  return out
}

interface DbRuaRow {
  id: string
  rua: string
  nucleo: string | null
  equipe_id: string | null
  casas_alvo: number | null
  ordem: number | null
  status_etapa: unknown
  obs: string | null
}

export function useMetaRuas(campanha: CampanhaMeta | null) {
  const [ruas, setRuas] = useState<RuaMeta[]>([])
  // produção agregada por nome de rua normalizado → { [col de producao_diaria]: soma na janela }
  const [producaoPorRua, setProducaoPorRua] = useState<Map<string, Record<string, number>>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const campanhaId = campanha?.id ?? null
  const projetoId = campanha?.projeto_id ?? null
  const janelaInicio = campanha?.data_inicio ?? null
  const janelaFim = campanha?.data_fim ?? null
  const colsCsv = useMemo(
    () => Array.from(new Set((campanha?.etapas ?? []).map((e) => e.col).filter(Boolean))).join(','),
    [campanha?.etapas],
  )

  const load = useCallback(async () => {
    if (!supabase || !campanhaId || !projetoId || !janelaInicio || !janelaFim) {
      setRuas([])
      setProducaoPorRua(new Map())
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('meta_ruas')
        .select('id, rua, nucleo, equipe_id, casas_alvo, ordem, status_etapa, obs')
        .eq('campanha_id', campanhaId)
        .order('ordem', { ascending: true })
      if (e1) throw e1
      setRuas(
        ((data ?? []) as DbRuaRow[]).map((r) => ({
          id: r.id,
          rua: r.rua,
          nucleo: r.nucleo,
          equipeId: r.equipe_id,
          casasAlvo: r.casas_alvo === null || r.casas_alvo === undefined ? null : Number(r.casas_alvo),
          ordem: Number(r.ordem) || 0,
          statusEtapa: mapStatusEtapa(r.status_etapa),
          obs: r.obs,
        })),
      )

      // 2ª query: realizado REAL por rua na janela da campanha (colunas das etapas).
      const cols = colsCsv ? colsCsv.split(',') : []
      if (cols.length > 0) {
        const { data: prod, error: e2 } = await supabase
          .from('producao_diaria')
          .select(['rua', ...cols].join(', '))
          .eq('projeto_id', projetoId)
          .gte('data', janelaInicio)
          .lte('data', janelaFim)
        if (e2) throw e2
        const agg = new Map<string, Record<string, number>>()
        for (const row of (prod ?? []) as unknown as Array<Record<string, unknown>>) {
          const nome = typeof row.rua === 'string' ? row.rua : ''
          const norm = normalizarRua(nome)
          if (!norm) continue
          const acc = agg.get(norm) ?? {}
          for (const col of cols) acc[col] = (acc[col] ?? 0) + (Number(row[col]) || 0)
          agg.set(norm, acc)
        }
        setProducaoPorRua(agg)
      } else {
        setProducaoPorRua(new Map())
      }
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar as ruas da campanha')
    } finally {
      setLoading(false)
    }
  }, [campanhaId, projetoId, janelaInicio, janelaFim, colsCsv])

  useEffect(() => { load() }, [load])

  /**
   * Realizado REAL por rua (Map rua.id → { [etapa.key]: soma apontada na janela }).
   * Match de nome: exato OU inclusão parcial (grafias variam). Rua sem match
   * NÃO entra no Map — a tela mostra o vazio honesto, não zero inventado.
   */
  const realizadoPorRua = useMemo(() => {
    const out = new Map<string, Record<string, number>>()
    if (!campanha) return out
    for (const r of ruas) {
      const alvoNorm = normalizarRua(r.rua)
      if (!alvoNorm) continue
      let achou = false
      const somas: Record<string, number> = {}
      for (const [prodNorm, porCol] of producaoPorRua) {
        const match = prodNorm === alvoNorm || prodNorm.includes(alvoNorm) || alvoNorm.includes(prodNorm)
        if (!match) continue
        achou = true
        for (const et of campanha.etapas) {
          somas[et.key] = (somas[et.key] ?? 0) + (porCol[et.col] ?? 0)
        }
      }
      if (achou) out.set(r.id, somas)
    }
    return out
  }, [ruas, producaoPorRua, campanha])

  /**
   * Muda status e/ou prazo de uma etapa da rua. VALIDAÇÃO DO CADEADO: recusa
   * avançar (status ≠ 'pendente') se a etapa anterior não estiver 'concluido' —
   * seta um erro honesto e retorna false, sem gravar nada.
   */
  const salvarEtapa = useCallback(async (
    ruaId: string,
    etapaKey: string,
    patch: { status?: StatusEtapaRua; prazo?: string | null },
  ): Promise<boolean> => {
    if (!campanha) return false
    const rua = ruas.find((r) => r.id === ruaId)
    if (!rua) return false

    if (patch.status && patch.status !== 'pendente' && etapaBloqueada(rua, etapaKey, campanha.etapas)) {
      const idx = campanha.etapas.findIndex((e) => e.key === etapaKey)
      const etapa = campanha.etapas[idx]
      const anterior = idx > 0 ? campanha.etapas[idx - 1] : null
      setError(
        `Cadeado da cadeia: não dá pra avançar "${etapa?.label ?? etapaKey}" na rua ${rua.rua} — ` +
        `a etapa anterior "${anterior?.label ?? '?'}" ainda não está concluída.`,
      )
      return false
    }

    const atual: EstadoEtapaRua = rua.statusEtapa[etapaKey] ?? { status: 'pendente', prazo: null }
    const novoEstado: EstadoEtapaRua = {
      status: patch.status ?? atual.status,
      prazo: patch.prazo !== undefined ? patch.prazo : atual.prazo,
    }
    const novoJson = { ...rua.statusEtapa, [etapaKey]: novoEstado }

    // otimista
    setRuas((prev) => prev.map((r) => (r.id === ruaId ? { ...r, statusEtapa: novoJson } : r)))
    if (!supabase) return true
    try {
      const { error: e1 } = await supabase
        .from('meta_ruas')
        .update({ status_etapa: novoJson, updated_at: new Date().toISOString() })
        .eq('id', ruaId)
      if (e1) throw e1
      return true
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao salvar etapa da rua')
      load() // reverte via reload
      return false
    }
  }, [campanha, ruas, load])

  /** Atribui (ou remove, com null) a equipe responsável pela rua. */
  const atribuirEquipe = useCallback(async (ruaId: string, equipeId: string | null) => {
    setRuas((prev) => prev.map((r) => (r.id === ruaId ? { ...r, equipeId } : r)))
    if (!supabase) return
    try {
      const { error: e1 } = await supabase
        .from('meta_ruas')
        .update({ equipe_id: equipeId, updated_at: new Date().toISOString() })
        .eq('id', ruaId)
      if (e1) throw e1
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao atribuir equipe à rua')
      load()
    }
  }, [load])

  /** Cria rua nova no fim da lista (todas as etapas 'pendente', sem prazo). */
  const criarRua = useCallback(async (nome: string, nucleo?: string): Promise<string | null> => {
    if (!campanha) return null
    const nomeLimpo = nome.trim()
    if (!nomeLimpo) return null
    const ordem = ruas.reduce((mx, r) => Math.max(mx, r.ordem), -1) + 1
    const statusEtapa: Record<string, EstadoEtapaRua> = {}
    for (const et of campanha.etapas) statusEtapa[et.key] = { status: 'pendente', prazo: null }
    const nova: RuaMeta = {
      id: crypto.randomUUID(),
      rua: nomeLimpo,
      nucleo: nucleo?.trim() || null,
      equipeId: null,
      casasAlvo: null, // sem cadastro — honesto, não zero
      ordem,
      statusEtapa,
      obs: null,
    }
    setRuas((prev) => [...prev, nova])
    if (!supabase) return nova.id
    try {
      const { error: e1 } = await supabase.from('meta_ruas').insert({
        id: nova.id,
        campanha_id: campanha.id,
        rua: nova.rua,
        nucleo: nova.nucleo,
        equipe_id: null,
        casas_alvo: null,
        ordem: nova.ordem,
        status_etapa: nova.statusEtapa,
        obs: null,
        updated_at: new Date().toISOString(),
      })
      if (e1) throw e1
      return nova.id
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao criar rua')
      load()
      return null
    }
  }, [campanha, ruas, load])

  /** Move a rua uma posição pra cima (-1) ou pra baixo (+1) — swap de `ordem` com a vizinha. */
  const moverOrdem = useCallback(async (ruaId: string, dir: 1 | -1) => {
    const ordenadas = [...ruas].sort((a, b) => a.ordem - b.ordem)
    const idx = ordenadas.findIndex((r) => r.id === ruaId)
    if (idx < 0) return
    const alvoIdx = idx + dir
    if (alvoIdx < 0 || alvoIdx >= ordenadas.length) return
    const a = ordenadas[idx]
    const b = ordenadas[alvoIdx]
    // ordens duplicadas (dado legado) → usa a posição na lista pra desempatar o swap
    let ordemA = a.ordem
    let ordemB = b.ordem
    if (ordemA === ordemB) { ordemA = idx; ordemB = alvoIdx }

    setRuas((prev) => prev.map((r) =>
      r.id === a.id ? { ...r, ordem: ordemB } : r.id === b.id ? { ...r, ordem: ordemA } : r,
    ))
    if (!supabase) return
    try {
      const agora = new Date().toISOString()
      const { error: e1 } = await supabase.from('meta_ruas').update({ ordem: ordemB, updated_at: agora }).eq('id', a.id)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('meta_ruas').update({ ordem: ordemA, updated_at: agora }).eq('id', b.id)
      if (e2) throw e2
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao reordenar ruas')
      load()
    }
  }, [ruas, load])

  const ruasOrdenadas = useMemo(() => [...ruas].sort((a, b) => a.ordem - b.ordem), [ruas])

  return {
    ruas: ruasOrdenadas,
    realizadoPorRua,
    loading,
    error,
    reload: load,
    salvarEtapa,
    atribuirEquipe,
    criarRua,
    moverOrdem,
  }
}
