/**
 * useRelatorio360Real — Relatório 360 com dado real (Execução_Relatórios → Relatório 360).
 * Fonte: `producao_diaria` (E1), só leitura. Sem número inventado: sem lançamento
 * no período/projeto = tabelas vazias + aviso honesto (tratado pelos componentes).
 *
 * Réplica funcional de duas abas da planilha Execução_Relatórios:
 *  - RESUMO (SUMIFS por intervalo de datas × núcleo × serviço)
 *  - PROD_EQUIPE / PROD_NÚCLEO (produtividade média no período)
 *
 * Regra de produtividade (documentada aqui pois não é óbvia): o denominador é o
 * número de DIAS DISTINTOS COM PELO MENOS 1 REGISTRO de produção para aquela
 * equipe/núcleo dentro do período selecionado — não é contagem de dias úteis
 * corridos do calendário. Ex.: se uma equipe lançou produção em 3 dias dentro
 * de um período de 10, a média é dividida por 3, não por 10.
 */
import { useMemo, useState } from 'react'
import { useProducaoDiaria, type ProducaoDiariaRow } from './useProducaoDiaria'

const SEM_NUCLEO = 'Sem núcleo'
const SEM_EQUIPE = 'Sem equipe'

export interface ResumoServicoRow {
  nucleo: string
  la: number
  le: number
  praM: number
  preM: number
  cUma: number
  cInsp: number
  pv: number
  pi: number
  lie: number
  lia: number
  totalLinha: number // soma de todas as métricas da linha (total "estilo planilha", unidades misturadas)
}

export interface ResumoPeriodo {
  linhas: ResumoServicoRow[] // 1 por núcleo, ordenado alfabeticamente
  totalGeral: ResumoServicoRow // linha TOTAL (soma de todos os núcleos)
}

export interface ProdutividadeRow {
  chave: string // nome da equipe ou do núcleo
  diasDistintos: number
  redeM: number // soma PRA_m + PRE_m no período
  ligacoesUn: number // soma LA + LE no período
  redeMDiaUtil: number // redeM / diasDistintos
  ligacoesUnDiaUtil: number // ligacoesUn / diasDistintos
}

function nucleoOf(row: ProducaoDiariaRow): string {
  return (row.nucleo || '').trim() || SEM_NUCLEO
}

function equipeOf(row: ProducaoDiariaRow): string {
  return (row.equipeNome || '').trim() || SEM_EQUIPE
}

function linhaServicoZero(nucleo: string): ResumoServicoRow {
  return { nucleo, la: 0, le: 0, praM: 0, preM: 0, cUma: 0, cInsp: 0, pv: 0, pi: 0, lie: 0, lia: 0, totalLinha: 0 }
}

function somaLinha(l: ResumoServicoRow): number {
  return l.la + l.le + l.praM + l.preM + l.cUma + l.cInsp + l.pv + l.pi + l.lie + l.lia
}

// ─── Cálculos puros (testáveis / conferíveis à mão contra o SQL) ──────────────

export function computeResumoPeriodo(rows: ProducaoDiariaRow[]): ResumoPeriodo {
  const porNucleo = new Map<string, ResumoServicoRow>()
  for (const r of rows) {
    const key = nucleoOf(r)
    const acc = porNucleo.get(key) ?? linhaServicoZero(key)
    acc.la += r.la
    acc.le += r.le
    acc.praM += r.praM
    acc.preM += r.preM
    acc.cUma += r.cUma
    acc.cInsp += r.cInsp
    acc.pv += r.pv
    acc.pi += r.pi
    acc.lie += r.lie
    acc.lia += r.lia
    porNucleo.set(key, acc)
  }

  const linhas = Array.from(porNucleo.values())
    .map((l) => ({ ...l, totalLinha: somaLinha(l) }))
    .sort((a, b) => a.nucleo.localeCompare(b.nucleo, 'pt-BR'))

  const totalGeral = linhas.reduce((acc, l) => {
    acc.la += l.la
    acc.le += l.le
    acc.praM += l.praM
    acc.preM += l.preM
    acc.cUma += l.cUma
    acc.cInsp += l.cInsp
    acc.pv += l.pv
    acc.pi += l.pi
    acc.lie += l.lie
    acc.lia += l.lia
    return acc
  }, linhaServicoZero('TOTAL'))
  totalGeral.totalLinha = somaLinha(totalGeral)

  return { linhas, totalGeral }
}

export function computeProdutividade(rows: ProducaoDiariaRow[], groupBy: 'equipe' | 'nucleo'): ProdutividadeRow[] {
  const getKey = groupBy === 'equipe' ? equipeOf : nucleoOf
  const grupos = new Map<string, { datas: Set<string>; redeM: number; ligacoesUn: number }>()
  for (const r of rows) {
    const key = getKey(r)
    const g = grupos.get(key) ?? { datas: new Set<string>(), redeM: 0, ligacoesUn: 0 }
    g.datas.add(r.data)
    g.redeM += r.praM + r.preM
    g.ligacoesUn += r.la + r.le
    grupos.set(key, g)
  }

  return Array.from(grupos.entries())
    .map(([chave, g]) => {
      const diasDistintos = g.datas.size
      return {
        chave,
        diasDistintos,
        redeM: g.redeM,
        ligacoesUn: g.ligacoesUn,
        redeMDiaUtil: diasDistintos > 0 ? g.redeM / diasDistintos : 0,
        ligacoesUnDiaUtil: diasDistintos > 0 ? g.ligacoesUn / diasDistintos : 0,
      }
    })
    .sort((a, b) => a.chave.localeCompare(b.chave, 'pt-BR'))
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useRelatorio360Real(projetoId: string | null) {
  const { linhas, loading, error, reload } = useProducaoDiaria(projetoId)

  const datasOrdenadas = useMemo(() => linhas.map((l) => l.data).sort(), [linhas])
  const dataMin = datasOrdenadas[0] ?? null
  const dataMax = datasOrdenadas[datasOrdenadas.length - 1] ?? null

  // Seleção manual do usuário (null = "usar toda a faixa disponível").
  const [periodoInicioSel, setPeriodoInicioSel] = useState<string | null>(null)
  const [periodoFimSel, setPeriodoFimSel] = useState<string | null>(null)

  function setPeriodoInicio(v: string) {
    setPeriodoInicioSel(v || null)
  }
  function setPeriodoFim(v: string) {
    setPeriodoFimSel(v || null)
  }

  const periodoInicio = periodoInicioSel ?? dataMin
  const periodoFim = periodoFimSel ?? dataMax

  const linhasNoPeriodo = useMemo(() => {
    if (!periodoInicio || !periodoFim || periodoInicio > periodoFim) return []
    return linhas.filter((l) => l.data >= periodoInicio && l.data <= periodoFim)
  }, [linhas, periodoInicio, periodoFim])

  const resumoPeriodo = useMemo(() => computeResumoPeriodo(linhasNoPeriodo), [linhasNoPeriodo])
  const produtividadeEquipe = useMemo(() => computeProdutividade(linhasNoPeriodo, 'equipe'), [linhasNoPeriodo])
  const produtividadeNucleo = useMemo(() => computeProdutividade(linhasNoPeriodo, 'nucleo'), [linhasNoPeriodo])

  return {
    linhas,
    loading,
    error,
    reload,
    temDadoReal: linhas.length > 0,
    dataMin,
    dataMax,
    periodoInicio,
    periodoFim,
    setPeriodoInicio,
    setPeriodoFim,
    linhasNoPeriodo,
    resumoPeriodo,
    produtividadeEquipe,
    produtividadeNucleo,
  }
}
