/**
 * useMetaLigacoes — leitura da `producao_diaria` para a tela Metas (campanha).
 * Lê c_uma (caixa U.M.A), ihm (cavalete/hidrômetro) e la (ligação de água)
 * do projeto ativo, agregadas por dia + totais acumulados.
 *
 * IMPORTANTE — janela da meta: a contagem obedece a JANELA DA CAMPANHA
 * (`campanha.data_inicio` → `campanha.data_fim`, tabela `metas_campanha`), NÃO
 * o início da obra. Produção fora da janela é excluída. Sem campanha ativa →
 * dias/semanas/totais vazios (nenhum número inventado). Controle é SEMANAL
 * (semana seg-sáb, padrão da obra), então além dos dias exponho `semanas`.
 *
 * As antigas constantes hardcoded (META_ALVO, META_JANELA_x, META_RITMO_x) foram
 * REMOVIDAS — alvo, janela e ritmo agora vêm da campanha (useMetaCampanha).
 *
 * Padrão de hook seguido de useFluxoProjecao.ts / useProducaoDiaria.ts:
 * useState/useCallback/useEffect, load() com try/catch e reload exposto.
 * Nenhum número é inventado: tudo vem das linhas reais do banco.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CampanhaMeta } from './useMetaCampanha'

export interface DiaMetaLigacoes {
  /** ISO yyyy-mm-dd */
  data: string
  /** Caixas U.M.A instaladas no dia (coluna c_uma) */
  cUma: number
  /** Cavaletes/hidrômetros instalados no dia (coluna ihm) */
  hm: number
  /** Ligações de água executadas no dia (coluna la) */
  la: number
  /** Resumo dos serviços secundários do dia (LE, CI, PV, PI) — o "que mais foi feito". */
  outros: string
}

export interface SemanaMetaLigacoes {
  /** ISO yyyy-mm-dd da segunda-feira da semana */
  inicio: string
  /** ISO yyyy-mm-dd do sábado da semana */
  fim: string
  /** Rótulo curto dd/MM–dd/MM */
  label: string
  cUma: number
  hm: number
  la: number
}

export interface TotaisMetaLigacoes {
  cUma: number
  hm: number
  la: number
}

/** Segunda-feira (yyyy-mm-dd) da semana que contém `iso`. */
function segundaDaSemana(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  const dow = (d.getDay() + 6) % 7 // 0 = segunda
  d.setDate(d.getDate() - dow)
  return d.toISOString().slice(0, 10)
}

function fmtDdMM(iso: string): string {
  const [, m, dd] = iso.split('-')
  return `${dd}/${m}`
}

interface DbRow {
  data: string
  c_uma: number | null
  ihm: number | null
  la: number | null
  le: number | null
  c_insp: number | null
  pv: number | null
  pi: number | null
}

/** Monta o resumo textual dos serviços secundários do dia (só os > 0). */
function resumoOutros(o: { le: number; ci: number; pv: number; pi: number }): string {
  const partes: string[] = []
  if (o.le > 0) partes.push(`${o.le} lig. esgoto`)
  if (o.ci > 0) partes.push(`${o.ci} cx. inspeção`)
  if (o.pv > 0) partes.push(`${o.pv} PV`)
  if (o.pi > 0) partes.push(`${o.pi} PI`)
  return partes.join(' · ')
}

export function useMetaLigacoes(projetoId: string | null, campanha: CampanhaMeta | null) {
  const [dias, setDias] = useState<DiaMetaLigacoes[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const janelaInicio = campanha?.data_inicio ?? null
  const janelaFim = campanha?.data_fim ?? null

  const load = useCallback(async () => {
    if (!supabase || !projetoId || !janelaInicio || !janelaFim) {
      setDias([]) // sem campanha → vazio honesto, nunca número inventado
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('producao_diaria')
        .select('data, c_uma, ihm, la, le, c_insp, pv, pi')
        .eq('projeto_id', projetoId)
        .gte('data', janelaInicio) // só a janela da campanha
        .lte('data', janelaFim)
        .order('data', { ascending: true })
      if (e1) throw e1

      // Agrega por dia (a tabela tem 1 linha por dia×equipe×rua). Os secundários
      // (LE/CI/PV/PI) somam num acumulador à parte e viram o texto `outros`.
      const porDia = new Map<string, DiaMetaLigacoes>()
      const secPorDia = new Map<string, { le: number; ci: number; pv: number; pi: number }>()
      for (const row of (data ?? []) as DbRow[]) {
        const key = String(row.data).slice(0, 10)
        const acc = porDia.get(key) ?? { data: key, cUma: 0, hm: 0, la: 0, outros: '' }
        acc.cUma += Number(row.c_uma) || 0
        acc.hm += Number(row.ihm) || 0
        acc.la += Number(row.la) || 0
        porDia.set(key, acc)
        const sec = secPorDia.get(key) ?? { le: 0, ci: 0, pv: 0, pi: 0 }
        sec.le += Number(row.le) || 0
        sec.ci += Number(row.c_insp) || 0
        sec.pv += Number(row.pv) || 0
        sec.pi += Number(row.pi) || 0
        secPorDia.set(key, sec)
      }
      for (const [key, acc] of porDia) acc.outros = resumoOutros(secPorDia.get(key)!)
      setDias(Array.from(porDia.values()).sort((a, b) => a.data.localeCompare(b.data)))
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar produção diária da meta de ligações')
    } finally {
      setLoading(false)
    }
  }, [projetoId, janelaInicio, janelaFim])

  useEffect(() => { load() }, [load])

  const totais = useMemo<TotaisMetaLigacoes>(
    () =>
      dias.reduce(
        (acc, d) => ({ cUma: acc.cUma + d.cUma, hm: acc.hm + d.hm, la: acc.la + d.la }),
        { cUma: 0, hm: 0, la: 0 },
      ),
    [dias],
  )

  // Agrupa por semana (seg-sáb) — a forma de controle pedida pela obra.
  const semanas = useMemo<SemanaMetaLigacoes[]>(() => {
    const porSemana = new Map<string, SemanaMetaLigacoes>()
    for (const d of dias) {
      const inicio = segundaDaSemana(d.data)
      const fimDate = new Date(`${inicio}T00:00:00`)
      fimDate.setDate(fimDate.getDate() + 5) // sábado
      const fim = fimDate.toISOString().slice(0, 10)
      const acc = porSemana.get(inicio) ?? {
        inicio,
        fim,
        label: `${fmtDdMM(inicio)}–${fmtDdMM(fim)}`,
        cUma: 0,
        hm: 0,
        la: 0,
      }
      acc.cUma += d.cUma
      acc.hm += d.hm
      acc.la += d.la
      porSemana.set(inicio, acc)
    }
    return Array.from(porSemana.values()).sort((a, b) => a.inicio.localeCompare(b.inicio))
  }, [dias])

  return { dias, semanas, totais, loading, error, reload: load }
}
