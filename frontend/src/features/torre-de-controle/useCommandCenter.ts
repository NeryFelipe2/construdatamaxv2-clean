/**
 * useCommandCenter — telemetria REAL da sala de comando (Torre de Controle).
 *
 * Fonte única: Supabase. NADA aqui é inventado — cada bloco da tela declara a
 * tabela de origem e, quando o dado não existe, a tela mostra aviso âmbar
 * honesto em vez de número fabricado.
 *
 * Tabelas lidas:
 *  - metas_campanha        → campanha ativa (1500 ligações até 07/08)
 *  - meta_baixas           → série acumulada de baixas no app (export uMov)
 *  - wcr_equipes           → 8 equipes ativas + a contratar (reorg 22/07)
 *  - programacao_semana    → metas da semana corrente (inclui missão 535)
 *  - producao_diaria       → janela da campanha (caixas UMA, HM, interligações)
 *                            + feed de apontamentos (últimos lançamentos)
 *  - agenda_tasks          → fases F1–F4 do pente fino de PVs
 *  - ocorrencias_obra      → punch list do pente fino (origem='pente_fino')
 *  - meta_ruas             → ruas da campanha com equipe atribuída
 *
 * Padrão de hook canônico do projeto (ver useMetaCorredor.ts):
 * useState/useCallback/useEffect + load com try/catch.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface CcCampanha {
  id: string
  projetoId: string
  nome: string
  alvo: number
  unidade: string
  dataInicio: string
  dataFim: string
  ritmoDia: number
}

export interface CcBaixaPonto {
  data: string
  acumulado: number
  fonte: string
}

export interface CcEquipe {
  id: string
  frente: string
  nome: string
  lider: string
  encarregado: string
  foco: string
  aContratar: boolean
  ordem: number
}

export interface CcProgLinha {
  equipe: string
  servico: string
  metaQtd: number | null
  metaUnidade: string | null
  obs: string
  semanaIni: string
  semanaFim: string
}

export interface CcProdDia {
  data: string
  cUma: number
  ihm: number
  intercept: number
  la: number
  le: number
  cInsp: number
  pv: number
  pi: number
  praM: number
  preM: number
}

export interface CcFeedItem {
  data: string
  equipe: string
  rua: string
  /** métricas não-zero já formatadas, ex.: "19 CX.UMA", "24m PRE" */
  itens: string[]
}

export interface CcPenteFase {
  titulo: string
  dataInicio: string
  dataFim: string
  status: string
}

export interface CcPenteResumo {
  total: number
  resolvidas: number
  clandestina: { rua: string; descricao: string } | null
}

export interface CcRuasResumo {
  total: number
  comEquipe: number
}

export interface CommandCenterData {
  campanha: CcCampanha | null
  baixas: CcBaixaPonto[]
  equipes: CcEquipe[]
  prog: CcProgLinha[]
  /** produção agregada por dia dentro da janela da campanha */
  prodDias: CcProdDia[]
  feed: CcFeedItem[]
  penteFases: CcPenteFase[]
  penteResumo: CcPenteResumo | null
  ruas: CcRuasResumo | null
}

const VAZIO: CommandCenterData = {
  campanha: null,
  baixas: [],
  equipes: [],
  prog: [],
  prodDias: [],
  feed: [],
  penteFases: [],
  penteResumo: null,
  ruas: null,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function iso(v: unknown): string {
  return String(v ?? '').slice(0, 10)
}

/** Formata as métricas não-zero de uma linha de producao_diaria (siglas do contrato). */
function formatItens(r: Record<string, unknown>): string[] {
  const out: string[] = []
  const push = (n: number, label: string) => { if (n > 0) out.push(`${n} ${label}`) }
  push(num(r.c_uma), 'CX.UMA')
  push(num(r.ihm), 'HM')
  push(num(r.la), 'LA')
  push(num(r.le), 'LE')
  push(num(r.lia), 'LIA')
  push(num(r.lie), 'LIE')
  push(num(r.intercept), 'INTERLIG')
  push(num(r.c_insp), 'C.INSP')
  push(num(r.pv), 'PV')
  push(num(r.pi), 'PI')
  const pra = num(r.pra_m)
  const pre = num(r.pre_m)
  if (pra > 0) out.push(`${pra}m PRA`)
  if (pre > 0) out.push(`${pre}m PRE`)
  return out
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCommandCenter() {
  const [data, setData] = useState<CommandCenterData>(VAZIO)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase não configurado — telemetria indisponível (sem dado real, nada é mostrado).')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      // 1) campanha ativa primeiro (as demais consultas dependem do id/janela)
      const { data: campRows, error: e0 } = await supabase
        .from('metas_campanha')
        .select('id, projeto_id, nome, alvo, unidade, data_inicio, data_fim, ritmo_dia')
        .eq('status', 'ativa')
        .order('created_at', { ascending: false })
        .limit(1)
      if (e0) throw e0

      const camp = campRows?.[0]
      const campanha: CcCampanha | null = camp
        ? {
            id: String(camp.id),
            projetoId: String(camp.projeto_id),
            nome: String(camp.nome ?? ''),
            alvo: num(camp.alvo),
            unidade: String(camp.unidade ?? ''),
            dataInicio: iso(camp.data_inicio),
            dataFim: iso(camp.data_fim),
            ritmoDia: num(camp.ritmo_dia),
          }
        : null

      // 2) resto em paralelo
      const [baixasQ, equipesQ, progQ, prodQ, feedQ, fasesQ, ocorrQ, ruasQ] = await Promise.all([
        campanha
          ? supabase
              .from('meta_baixas')
              .select('data, acumulado, fonte')
              .eq('campanha_id', campanha.id)
              .order('data', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('wcr_equipes')
          .select('id, frente, nome, lider, encarregado, foco, a_contratar, ordem')
          .eq('ativo', true)
          .order('ordem', { ascending: true }),
        supabase
          .from('programacao_semana')
          .select('equipe, servico, meta_qtd, meta_unidade, obs, semana_ini, semana_fim')
          .order('semana_ini', { ascending: false })
          .limit(40),
        campanha
          ? supabase
              .from('producao_diaria')
              .select('data, c_uma, ihm, intercept, la, le, c_insp, pv, pi, pra_m, pre_m')
              .gte('data', campanha.dataInicio)
              .order('data', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('producao_diaria')
          .select('data, equipe_nome, rua, c_uma, ihm, la, le, lia, lie, intercept, c_insp, pv, pi, pra_m, pre_m, created_at')
          .order('data', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('agenda_tasks')
          .select('titulo, data_inicio, data_fim, status')
          .ilike('titulo', 'Pente Fino F%')
          .order('data_inicio', { ascending: true }),
        supabase
          .from('ocorrencias_obra')
          .select('rua, descricao, resolvida')
          .eq('origem', 'pente_fino'),
        campanha
          ? supabase
              .from('meta_ruas')
              .select('rua, equipe_id')
              .eq('campanha_id', campanha.id)
          : Promise.resolve({ data: [], error: null }),
      ])

      for (const q of [baixasQ, equipesQ, progQ, prodQ, feedQ, fasesQ, ocorrQ, ruasQ]) {
        if (q.error) throw q.error
      }

      const baixas: CcBaixaPonto[] = ((baixasQ.data ?? []) as Record<string, unknown>[]).map((r) => ({
        data: iso(r.data),
        acumulado: num(r.acumulado),
        fonte: String(r.fonte ?? ''),
      }))

      const equipes: CcEquipe[] = ((equipesQ.data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        frente: String(r.frente ?? ''),
        nome: String(r.nome ?? ''),
        lider: String(r.lider ?? ''),
        encarregado: String(r.encarregado ?? ''),
        foco: String(r.foco ?? ''),
        aContratar: Boolean(r.a_contratar),
        ordem: num(r.ordem),
      }))

      // programação: só a semana mais recente (a corrente)
      const progAll: CcProgLinha[] = ((progQ.data ?? []) as Record<string, unknown>[]).map((r) => ({
        equipe: String(r.equipe ?? ''),
        servico: String(r.servico ?? ''),
        metaQtd: r.meta_qtd == null ? null : num(r.meta_qtd),
        metaUnidade: r.meta_unidade == null ? null : String(r.meta_unidade),
        obs: String(r.obs ?? ''),
        semanaIni: iso(r.semana_ini),
        semanaFim: iso(r.semana_fim),
      }))
      const ultimaSemana = progAll[0]?.semanaIni ?? ''
      const prog = progAll.filter((p) => p.semanaIni === ultimaSemana)

      // produção agregada por dia
      const porDia = new Map<string, CcProdDia>()
      for (const r of (prodQ.data ?? []) as Record<string, unknown>[]) {
        const d = iso(r.data)
        const acc = porDia.get(d) ?? {
          data: d, cUma: 0, ihm: 0, intercept: 0, la: 0, le: 0, cInsp: 0, pv: 0, pi: 0, praM: 0, preM: 0,
        }
        acc.cUma += num(r.c_uma)
        acc.ihm += num(r.ihm)
        acc.intercept += num(r.intercept)
        acc.la += num(r.la)
        acc.le += num(r.le)
        acc.cInsp += num(r.c_insp)
        acc.pv += num(r.pv)
        acc.pi += num(r.pi)
        acc.praM += num(r.pra_m)
        acc.preM += num(r.pre_m)
        porDia.set(d, acc)
      }
      const prodDias = [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data))

      // feed: só linhas com pelo menos uma métrica não-zero
      const feed: CcFeedItem[] = ((feedQ.data ?? []) as Record<string, unknown>[])
        .map((r) => ({
          data: iso(r.data),
          equipe: String(r.equipe_nome ?? ''),
          rua: String(r.rua ?? ''),
          itens: formatItens(r),
        }))
        .filter((f) => f.itens.length > 0)

      const penteFases: CcPenteFase[] = ((fasesQ.data ?? []) as Record<string, unknown>[]).map((r) => ({
        titulo: String(r.titulo ?? ''),
        dataInicio: iso(r.data_inicio),
        dataFim: iso(r.data_fim),
        status: String(r.status ?? ''),
      }))

      const ocorr = (ocorrQ.data ?? []) as Record<string, unknown>[]
      const clandRow = ocorr.find((r) => String(r.descricao ?? '').toLowerCase().includes('clandestin'))
      const penteResumo: CcPenteResumo | null = ocorr.length
        ? {
            total: ocorr.length,
            resolvidas: ocorr.filter((r) => Boolean(r.resolvida)).length,
            clandestina: clandRow
              ? { rua: String(clandRow.rua ?? ''), descricao: String(clandRow.descricao ?? '') }
              : null,
          }
        : null

      const ruasRows = (ruasQ.data ?? []) as Record<string, unknown>[]
      const ruas: CcRuasResumo | null = ruasRows.length
        ? { total: ruasRows.length, comEquipe: ruasRows.filter((r) => r.equipe_id != null).length }
        : null

      setData({ campanha, baixas, equipes, prog, prodDias, feed, penteFases, penteResumo, ruas })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar telemetria do banco')
      setData(VAZIO)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { ...data, loading, error, reload: load }
}
