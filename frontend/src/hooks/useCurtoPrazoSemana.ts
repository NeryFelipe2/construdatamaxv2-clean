/**
 * useCurtoPrazoSemana — dado REAL da aba "Curto Prazo" do Planejamento Mestre.
 * Substitui o operacaoCampoStore (mock) que alimentava o CurtoPrazoPanel.
 *
 * Fontes (todas Supabase — nada é inventado):
 *  - programacao_semana     → compromissos da semana corrente
 *                             (semana_ini <= hoje <= semana_fim; inclui a semana
 *                             do pente fino 27/07–01/08: Equipe PV + Equipe
 *                             Esgoto, 24 PVs cada);
 *  - vw_producao_longa      → produção apontada na janela da semana, uma linha
 *                             por (dia × equipe × etapa), já com rua_id/equipe_id
 *                             resolvidos pelas tabelas de alias (27/07);
 *  - vw_ppc_semana_equipe   → PPC formal do LPS por semana ISO (a view já
 *                             filtra semanas sem evidência de produção, matando
 *                             o falso-alto da carga histórica de 14/07).
 *
 * Cruzamento meta × produção (honesto, nunca forçado):
 *  - o serviço/unidade da meta é traduzido pra etapas de vw_producao_longa
 *    (ex.: "PV" → etapa 'pv'); serviço sem etapa correspondente → realizado
 *    null (a tela mostra "—" e explica, em vez de fingir zero);
 *  - a equipe da meta (texto livre, ex.: "Equipe PV (Michael Douglas)") casa
 *    com equipe_id/equipe_nome da produção por comparação normalizada (mesmo
 *    espírito da norm_txt do banco). Sem casamento → realizado 0 com o número
 *    de linhas casadas = 0 declarado.
 *
 * NÃO filtra por projeto: o banco é WCR-only desde 07/07 e as telas irmãs
 * (useCommandCenter, useProgramacaoSemana) tomaram a mesma decisão — filtrar
 * por um projeto ativo divergente esconderia a semana inteira.
 *
 * Padrão de hook canônico (useMetaCorredor/usePenteFinoCronograma):
 * useState/useCallback/useEffect + load com try/catch; supabase PODE SER NULL.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface CpMetaSemana {
  id: string
  frente: string
  equipe: string
  servico: string
  metaQtd: number | null
  metaUnidade: string | null
  obs: string | null
  semanaIni: string
  semanaFim: string
}

export interface CpProducaoLinha {
  id: string
  data: string
  equipeNome: string | null
  equipeId: string | null
  etapa: string
  qtd: number
  rua: string | null
}

export interface CpCompromisso extends CpMetaSemana {
  /** Soma da produção casada (equipe + etapa) na semana; null = serviço sem etapa mensurável em producao_diaria. */
  realizado: number | null
  /** Etapas de vw_producao_longa usadas no cruzamento (vazio = sem tradução). */
  etapas: string[]
  /** Quantas linhas de produção casaram (0 = sem apontamento vinculado). */
  linhasCasadas: number
}

export interface CpPpcSemana {
  semanaIso: string
  responsavel: string | null
  planejadas: number
  concluidas: number
  ppc: number
}

export interface CpProducaoEquipe {
  equipe: string
  /** por etapa → quantidade somada na semana */
  porEtapa: { etapa: string; qtd: number }[]
  totalLinhas: number
}

// ─── Datas / semana ISO ─────────────────────────────────────────────────────

function hojeIso(): string {
  const d = new Date()
  const p = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Segunda-feira da semana de `iso` (YYYY-MM-DD). */
function segundaDaSemana(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  const dow = d.getDay() === 0 ? 7 : d.getDay() // dom=7
  d.setDate(d.getDate() - (dow - 1))
  return d.toISOString().slice(0, 10)
}

function somaDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Semana ISO no formato do banco ('IYYY-"W"IW', ex.: '2026-W31'). */
export function semanaIsoDe(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  // algoritmo ISO-8601: quinta-feira da semana determina o ano
  const alvo = new Date(d.getTime())
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  alvo.setDate(alvo.getDate() + 4 - dow)
  const ano = alvo.getFullYear()
  const primeiro = new Date(ano, 0, 1)
  const semana = Math.ceil(((alvo.getTime() - primeiro.getTime()) / 86_400_000 + 1) / 7)
  return `${ano}-W${String(semana).padStart(2, '0')}`
}

// ─── Normalização (espelho de norm_txt do banco) ────────────────────────────

function norm(s: string): string {
  // NFD separa a letra do acento; descartamos os combinantes (U+0300–U+036F)
  // por code point pra não depender de classe de caracteres unicode no regex.
  let semAcento = ''
  for (const ch of s.toLowerCase().normalize('NFD')) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp >= 0x0300 && cp <= 0x036f) continue
    semAcento += ch
  }
  return semAcento.replace(/\s+/g, ' ').trim()
}

// ─── Tradução serviço/unidade → etapas de vw_producao_longa ─────────────────

/**
 * Traduz o serviço/unidade da meta pras etapas de vw_producao_longa.
 * Vazio = serviço sem contraparte mensurável em producao_diaria (a tela
 * mostra "—" honesto em vez de zero fabricado).
 */
export function etapasDaMeta(servico: string, unidade: string | null): string[] {
  const s = norm(`${servico} ${unidade ?? ''}`)
  if (/\bpvs?\b/.test(s)) return ['pv']
  if (/\bpis?\b/.test(s)) return ['pi']
  if (/hidrometro|\bhm\b|baixa/.test(s)) return ['hm']
  if (/interlig/.test(s)) return ['interligacao_agua', 'interligacao_esgoto']
  if (/caixa.*(inspecao|insp)|c\.? ?insp/.test(s)) return ['caixa_inspecao']
  if (/caixa|uma\b/.test(s)) return ['caixa_uma']
  if (/interceptor/.test(s)) return ['interceptor']
  if (/liga\w*.*esgoto|\ble\b|\blie\b/.test(s)) return ['lig_esgoto']
  if (/liga\w*.*agua|\bla\b|\blia\b|liga\w*/.test(s)) return ['lig_agua']
  if (/rede.*esgoto|\bpre\b/.test(s)) return ['rede_esgoto_m']
  if (/rede.*agua|\bpra\b/.test(s)) return ['rede_agua_m']
  return []
}

// ─── Casamento equipe da meta × equipe da produção ──────────────────────────

/**
 * Casa o texto livre da meta (ex.: "Equipe PV (Michael Douglas)") com a linha
 * de produção (equipe_id 'eq-pv' / equipe_nome livre). Comparação normalizada
 * por inclusão nos dois sentidos — melhor errar pra "não casou" (mostra 0
 * linhas casadas) do que atribuir produção de outra equipe.
 */
export function equipeCasa(metaEquipe: string, linha: CpProducaoLinha): boolean {
  const m = norm(metaEquipe)
  const parenteses = /\(([^)]*)\)/.exec(m)?.[1] ?? ''
  const base = m.replace(/\([^)]*\)/g, '').replace(/\bequipe\b/g, '').trim()
  const candidatosMeta = [base, ...parenteses.split(/\s+/)].filter((t) => t.length >= 3 || t === 'pv' || t === 'pi' || t === 'hm')

  const nome = norm(linha.equipeNome ?? '')
  const id = norm((linha.equipeId ?? '').replace(/^eq-/, '')).replace(/-/g, ' ')
  const candidatosProd = [nome, id].filter((t) => t.length >= 2)

  return candidatosMeta.some((cm) =>
    candidatosProd.some((cp) => cp === cm || cp.includes(cm) || cm.includes(cp)),
  )
}

// ─── Labels das etapas (siglas do contrato) ─────────────────────────────────

export const ETAPA_LABEL: Record<string, string> = {
  caixa_uma: 'CX.UMA',
  caixa_inspecao: 'CX.INSP',
  hm: 'HM',
  lig_agua: 'LA',
  lig_esgoto: 'LE',
  interligacao_agua: 'LIA',
  interligacao_esgoto: 'LIE',
  rede_agua_m: 'PRA (m)',
  rede_esgoto_m: 'PRE (m)',
  pv: 'PV',
  pi: 'PI',
  interceptor: 'INTERCEPT',
}

// ─── Helpers numéricos ──────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function iso(v: unknown): string {
  return String(v ?? '').slice(0, 10)
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCurtoPrazoSemana() {
  const [metas, setMetas] = useState<CpMetaSemana[]>([])
  const [producao, setProducao] = useState<CpProducaoLinha[]>([])
  const [ppcTodas, setPpcTodas] = useState<CpPpcSemana[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hoje = hojeIso()
  const semanaIni = segundaDaSemana(hoje)
  const semanaFim = somaDias(semanaIni, 5) // sábado (seg–sáb, padrão da obra)
  const semanaIso = semanaIsoDe(hoje)

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase não configurado — sem dado real, nada é mostrado.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [metasQ, prodQ, ppcQ] = await Promise.all([
        supabase
          .from('programacao_semana')
          .select('id, frente, equipe, servico, meta_qtd, meta_unidade, obs, semana_ini, semana_fim')
          .lte('semana_ini', hoje)
          .gte('semana_fim', hoje)
          .order('frente')
          .order('equipe'),
        supabase
          .from('vw_producao_longa')
          .select('id, data, equipe_nome, equipe_id, etapa, qtd, rua')
          .gte('data', semanaIni)
          .lte('data', semanaFim),
        supabase
          .from('vw_ppc_semana_equipe')
          .select('semana_iso, responsavel, planejadas, concluidas, ppc')
          .order('semana_iso', { ascending: true }),
      ])
      if (metasQ.error) throw metasQ.error
      if (prodQ.error) throw prodQ.error
      if (ppcQ.error) throw ppcQ.error

      setMetas(
        ((metasQ.data ?? []) as Record<string, unknown>[]).map((r) => ({
          id: String(r.id),
          frente: String(r.frente ?? ''),
          equipe: String(r.equipe ?? ''),
          servico: String(r.servico ?? ''),
          metaQtd: r.meta_qtd == null ? null : num(r.meta_qtd),
          metaUnidade: r.meta_unidade == null ? null : String(r.meta_unidade),
          obs: r.obs == null ? null : String(r.obs),
          semanaIni: iso(r.semana_ini),
          semanaFim: iso(r.semana_fim),
        })),
      )
      setProducao(
        ((prodQ.data ?? []) as Record<string, unknown>[]).map((r) => ({
          id: String(r.id),
          data: iso(r.data),
          equipeNome: r.equipe_nome == null ? null : String(r.equipe_nome),
          equipeId: r.equipe_id == null ? null : String(r.equipe_id),
          etapa: String(r.etapa ?? ''),
          qtd: num(r.qtd),
          rua: r.rua == null ? null : String(r.rua),
        })),
      )
      setPpcTodas(
        ((ppcQ.data ?? []) as Record<string, unknown>[]).map((r) => ({
          semanaIso: String(r.semana_iso ?? ''),
          responsavel: r.responsavel == null ? null : String(r.responsavel),
          planejadas: num(r.planejadas),
          concluidas: num(r.concluidas),
          ppc: num(r.ppc),
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar a semana corrente')
      setMetas([])
      setProducao([])
      setPpcTodas([])
    } finally {
      setLoading(false)
    }
  }, [hoje, semanaIni, semanaFim])

  useEffect(() => { load() }, [load])

  /** Compromissos: meta da semana × produção casada por equipe+etapa. */
  const compromissos = useMemo<CpCompromisso[]>(
    () =>
      metas.map((m) => {
        const etapas = etapasDaMeta(m.servico, m.metaUnidade)
        if (etapas.length === 0) return { ...m, realizado: null, etapas, linhasCasadas: 0 }
        const casadas = producao.filter((p) => etapas.includes(p.etapa) && equipeCasa(m.equipe, p))
        return {
          ...m,
          realizado: casadas.reduce((s, p) => s + p.qtd, 0),
          etapas,
          linhasCasadas: casadas.length,
        }
      }),
    [metas, producao],
  )

  /** Produção da semana agrupada por equipe (rótulo = nome apontado ou id resolvido). */
  const producaoPorEquipe = useMemo<CpProducaoEquipe[]>(() => {
    const porEquipe = new Map<string, Map<string, number>>()
    const linhas = new Map<string, number>()
    for (const p of producao) {
      const chave = p.equipeNome || p.equipeId || 'sem equipe apontada'
      if (!porEquipe.has(chave)) porEquipe.set(chave, new Map())
      const etapas = porEquipe.get(chave)!
      etapas.set(p.etapa, (etapas.get(p.etapa) ?? 0) + p.qtd)
      linhas.set(chave, (linhas.get(chave) ?? 0) + 1)
    }
    return Array.from(porEquipe.entries())
      .map(([equipe, etapas]) => ({
        equipe,
        porEtapa: Array.from(etapas.entries())
          .map(([etapa, qtd]) => ({ etapa, qtd }))
          .sort((a, b) => b.qtd - a.qtd),
        totalLinhas: linhas.get(equipe) ?? 0,
      }))
      .sort((a, b) => a.equipe.localeCompare(b.equipe))
  }, [producao])

  /** PPC formal da semana corrente (vazio = ninguém comprometeu no LPS). */
  const ppcAtual = useMemo(
    () => ppcTodas.filter((p) => p.semanaIso === semanaIso),
    [ppcTodas, semanaIso],
  )

  /** Histórico (até 6 semanas anteriores com evidência de produção). */
  const ppcHistorico = useMemo(
    () => ppcTodas.filter((p) => p.semanaIso !== semanaIso).slice(-6),
    [ppcTodas, semanaIso],
  )

  return {
    metas,
    compromissos,
    producao,
    producaoPorEquipe,
    ppcAtual,
    ppcHistorico,
    hoje,
    semanaIni,
    semanaFim,
    semanaIso,
    loading,
    error,
    reload: load,
  }
}
