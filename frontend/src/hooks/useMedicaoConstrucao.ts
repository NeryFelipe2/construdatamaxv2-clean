/**
 * useMedicaoConstrucao — a MEDIÇÃO sendo CONSTRUÍDA dia a dia pelo apontamento
 * de campo, e o confronto honesto dela com a medição oficial já fechada.
 *
 * Pedido do chefe do Felipe (30/07/2026): "ver os itens que estão sendo
 * apontados num dashboard; a medição sendo construída e acompanhada;
 * acompanhamento e controle — baseado na medição".
 *
 * Origem do dado (tudo Supabase, nada calculado fora do banco):
 *  - `vw_medicao_em_construcao`     → cada apontamento diário (producao_diaria)
 *                                     explodido nos itens de contrato que ele
 *                                     gera, já valorado ao preço 60% (parte WCR).
 *  - `vw_medicao_mes_item`          → resumo mês × item (qtd e valor). É a FONTE
 *                                     do número grande do cabeçalho.
 *  - `vw_medicao_apontado_x_oficial`→ item × mês: qtd/valor oficial vs apontado
 *                                     e o % de captura.
 *  - `medicao_oficial`              → o que foi REALMENTE medido (planilha
 *                                     01-07-2026_MEDIÇÃO_WCR_JUNHO, aba BASE
 *                                     MEDIÇÃO): junho fechado = R$ 3.358.401,00.
 *  - `medicao_receita`              → a "receita": 1 serviço apontado gera N
 *                                     itens de contrato (1 caixa U.M.A = 4 itens).
 *
 * ACHADO QUE A TELA TEM DE EXPOR (não esconder): o apontamento captura só ~34%
 * do valor efetivamente medido em junho (R$ 1,15 mi apontado-valorado contra
 * R$ 3,36 mi medidos). Isso NÃO é erro de cálculo — é SUBNOTIFICAÇÃO de
 * apontamento. Nenhum número aqui é inflado para "fechar" a conta.
 *
 * Honestidade: nada é inventado. Sem linha no banco → array vazio e a tela
 * mostra "—" com o motivo. `pctCaptura` é null quando não existe item oficial
 * correspondente (não é 0%: é ausência de comparação possível).
 *
 * Padrão de hook do projeto (useLpsTasks / usePenteFinoCronograma):
 * useState/useCallback/useEffect + try-catch que NUNCA lança, supabase pode ser
 * null, e a tela declara a fonte de cada bloco.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos ──────────────────────────────────────────────────────────────────

/** Um apontamento de um dia já traduzido em item de medição valorado. */
export interface MedicaoLinha {
  /** ISO YYYY-MM-DD do apontamento. */
  data: string
  nucleo: string | null
  rua: string | null
  equipeNome: string | null
  /** Etapa apontada no campo (caixa_uma, lig_agua, rede_agua_m, pv…). */
  servicoApontado: string
  /** Item da planilha de medição que esse apontamento gera. */
  itemMedicao: string
  unidade: string | null
  quantidade: number
  /** Preço unitário 60% (parte WCR). */
  preco60: number
  valor: number
  /** YYYY-MM. */
  mes: string
}

/** Resumo mês × item (vw_medicao_mes_item). */
export interface MedicaoMesItem {
  mes: string
  itemMedicao: string
  unidade: string | null
  qtd: number
  valor: number
}

/** Confronto item × mês entre o que foi medido e o que foi apontado. */
export interface MedicaoCaptura {
  itemMedicao: string
  mes: string
  unidade: string | null
  qtdOficial: number
  valorOficial: number
  qtdApontada: number
  valorApontado: number
  /** % de captura do apontamento. null = não existe item oficial pra comparar. */
  pctCaptura: number | null
}

/** Linha da medição oficial fechada (planilha BASE MEDIÇÃO). */
export interface MedicaoOficialItem {
  id: string
  mes: string
  itemMedicao: string
  unidade: string | null
  precoContrato: number
  preco60: number
  qtdSakura: number
  qtdBoi: number
  qtdSaoCleto: number
  valor: number
  fonte: string | null
}

/** Receita: 1 serviço apontado → N itens de contrato. */
export interface MedicaoReceitaItem {
  servicoApontado: string
  itemMedicao: string
  unidade: string | null
  preco60: number
  /** Multiplicador sobre a quantidade apontada (ex.: escavação 1,268 m3 por m). */
  fator: number
  fonte: string | null
}

/** Serviço apontado agrupado: quanto R$ vale 1 unidade e por quais itens. */
export interface MedicaoReceitaServico {
  servicoApontado: string
  itens: MedicaoReceitaItem[]
  /** R$ que 1 unidade apontada desse serviço gera na medição (Σ preço60 × fator). */
  valorUnitario: number
}

/** Ponto da curva de construção da medição no mês. */
export interface MedicaoCurvaPonto {
  /** ISO YYYY-MM-DD. */
  data: string
  /** Valor apontado NAQUELE dia (0 = dia sem apontamento). */
  valor: number
  /** Acumulado do mês até aquele dia. */
  acumulado: number
  /** false quando o dia não tem nenhum apontamento no banco. */
  temApontamento: boolean
}

/** Item apontado no mês, com a receita de origem. */
export interface MedicaoItemMes {
  itemMedicao: string
  unidade: string | null
  qtd: number
  valor: number
  /** Preço 60% observado nas linhas do mês (null se não houver linha detalhada). */
  preco60: number | null
  /** Serviços apontados que geraram esse item (a receita). */
  servicos: string[]
}

/** Quebra de valor por núcleo ou por equipe. */
export interface MedicaoQuebra {
  nome: string
  valor: number
  itens: number
  /** Fração do total do mês (0..1). */
  fracao: number
}

export interface MedicaoResumoMes {
  mes: string
  valor: number
  /** Itens de contrato distintos apontados no mês. */
  itens: number
  /** Dias com apontamento no mês. */
  diasComApontamento: number
  /** Último dia com apontamento (ISO) — null se nenhum. */
  ultimoDia: string | null
  /** Dias decorridos do mês (até hoje, se o mês é o corrente; senão o mês todo). */
  diasDecorridos: number
  /** Dias no mês (calendário). */
  diasNoMes: number
  /** Média por dia decorrido (R$). null quando não há dia decorrido. */
  mediaDia: number | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** '2026-07' → 'jul/2026'. Devolve o próprio valor se não reconhecer. */
export function mesLabel(mes: string): string {
  const [a, m] = (mes ?? '').split('-')
  const i = Number(m) - 1
  if (!a || Number.isNaN(i) || i < 0 || i > 11) return mes || '—'
  return `${MESES_PT[i]}/${a}`
}

/** Rótulo legível da etapa apontada (chaves da vw_producao_longa). */
export const SERVICO_LABEL: Record<string, string> = {
  caixa_uma: 'Caixa U.M.A',
  lig_agua: 'Ligação de água',
  lig_esgoto: 'Ligação de esgoto',
  rede_agua_m: 'Rede de água (m)',
  rede_esgoto_m: 'Rede de esgoto (m)',
  pv: 'Poço de visita (PV)',
  pi: 'Poço de inspeção (PI)',
  caixa_inspecao: 'Caixa de inspeção',
  interligacao_agua: 'Interligação de água',
  interligacao_esgoto: 'Interligação de esgoto',
}

export function servicoLabel(s: string): string {
  return SERVICO_LABEL[s] ?? s
}

function num(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function iso(v: unknown): string {
  return String(v ?? '').slice(0, 10)
}

function mesDeHoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function diasNoMes(mes: string): number {
  const [a, m] = mes.split('-').map(Number)
  if (!a || !m) return 30
  return new Date(a, m, 0).getDate()
}

// ─── Linhas cruas do banco ──────────────────────────────────────────────────

interface RowConstrucao {
  data: string | null
  nucleo: string | null
  rua: string | null
  equipe_nome: string | null
  servico_apontado: string | null
  item_medicao: string | null
  unidade: string | null
  quantidade: number | string | null
  preco_60: number | string | null
  valor: number | string | null
  mes: string | null
}

interface RowMesItem {
  mes: string | null
  item_medicao: string | null
  unidade: string | null
  qtd: number | string | null
  valor: number | string | null
}

interface RowCaptura {
  item_medicao: string | null
  mes: string | null
  unidade: string | null
  qtd_oficial: number | string | null
  valor_oficial: number | string | null
  qtd_apontada: number | string | null
  valor_apontado: number | string | null
  pct_captura: number | string | null
}

interface RowOficial {
  id: string
  mes: string | null
  item_medicao: string | null
  unidade: string | null
  preco_contrato: number | string | null
  preco_60: number | string | null
  qtd_sakura: number | string | null
  qtd_boi: number | string | null
  qtd_sao_cleto: number | string | null
  valor: number | string | null
  fonte: string | null
}

interface RowReceita {
  servico_apontado: string | null
  item_medicao: string | null
  unidade: string | null
  preco_60: number | string | null
  fator: number | string | null
  fonte: string | null
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useMedicaoConstrucao() {
  const [linhas, setLinhas] = useState<MedicaoLinha[]>([])
  const [mesItens, setMesItens] = useState<MedicaoMesItem[]>([])
  const [captura, setCaptura] = useState<MedicaoCaptura[]>([])
  const [oficial, setOficial] = useState<MedicaoOficialItem[]>([])
  const [receita, setReceita] = useState<MedicaoReceitaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Mês selecionado pela tela. null = usa o padrão (mês corrente, se houver dado). */
  const [mesSel, setMesSel] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setLinhas([]); setMesItens([]); setCaptura([]); setOficial([]); setReceita([])
      setError('Supabase não configurado neste ambiente (VITE_SUPABASE_URL / ANON_KEY).')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [rc, rm, rx, ro, rr] = await Promise.all([
        supabase
          .from('vw_medicao_em_construcao')
          .select('data, nucleo, rua, equipe_nome, servico_apontado, item_medicao, unidade, quantidade, preco_60, valor, mes')
          .order('data', { ascending: true })
          .limit(20000),
        supabase
          .from('vw_medicao_mes_item')
          .select('mes, item_medicao, unidade, qtd, valor')
          .limit(5000),
        supabase
          .from('vw_medicao_apontado_x_oficial')
          .select('item_medicao, mes, unidade, qtd_oficial, valor_oficial, qtd_apontada, valor_apontado, pct_captura')
          .limit(5000),
        supabase
          .from('medicao_oficial')
          .select('id, mes, item_medicao, unidade, preco_contrato, preco_60, qtd_sakura, qtd_boi, qtd_sao_cleto, valor, fonte')
          .limit(5000),
        supabase
          .from('medicao_receita')
          .select('servico_apontado, item_medicao, unidade, preco_60, fator, fonte')
          .limit(2000),
      ])

      if (rc.error) throw rc.error
      if (rm.error) throw rm.error
      if (rx.error) throw rx.error
      if (ro.error) throw ro.error
      if (rr.error) throw rr.error

      setLinhas(
        ((rc.data ?? []) as RowConstrucao[]).map((r) => ({
          data: iso(r.data),
          nucleo: r.nucleo,
          rua: r.rua,
          equipeNome: r.equipe_nome,
          servicoApontado: r.servico_apontado ?? '—',
          itemMedicao: r.item_medicao ?? '—',
          unidade: r.unidade,
          quantidade: num(r.quantidade),
          preco60: num(r.preco_60),
          valor: num(r.valor),
          mes: r.mes ?? iso(r.data).slice(0, 7),
        })),
      )

      setMesItens(
        ((rm.data ?? []) as RowMesItem[]).map((r) => ({
          mes: r.mes ?? '',
          itemMedicao: r.item_medicao ?? '—',
          unidade: r.unidade,
          qtd: num(r.qtd),
          valor: num(r.valor),
        })),
      )

      setCaptura(
        ((rx.data ?? []) as RowCaptura[]).map((r) => ({
          itemMedicao: r.item_medicao ?? '—',
          mes: r.mes ?? '',
          unidade: r.unidade,
          qtdOficial: num(r.qtd_oficial),
          valorOficial: num(r.valor_oficial),
          qtdApontada: num(r.qtd_apontada),
          valorApontado: num(r.valor_apontado),
          pctCaptura: r.pct_captura === null || r.pct_captura === undefined ? null : num(r.pct_captura),
        })),
      )

      setOficial(
        ((ro.data ?? []) as RowOficial[]).map((r) => ({
          id: r.id,
          mes: r.mes ?? '',
          itemMedicao: r.item_medicao ?? '—',
          unidade: r.unidade,
          precoContrato: num(r.preco_contrato),
          preco60: num(r.preco_60),
          qtdSakura: num(r.qtd_sakura),
          qtdBoi: num(r.qtd_boi),
          qtdSaoCleto: num(r.qtd_sao_cleto),
          valor: num(r.valor),
          fonte: r.fonte,
        })),
      )

      setReceita(
        ((rr.data ?? []) as RowReceita[]).map((r) => ({
          servicoApontado: r.servico_apontado ?? '—',
          itemMedicao: r.item_medicao ?? '—',
          unidade: r.unidade,
          preco60: num(r.preco_60),
          fator: r.fator === null || r.fator === undefined ? 1 : num(r.fator),
          fonte: r.fonte,
        })),
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar a medição em construção'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /** Meses com apontamento valorado, do mais recente para o mais antigo. */
  const meses = useMemo<string[]>(() => {
    const set = new Set<string>()
    for (const l of linhas) if (l.mes) set.add(l.mes)
    for (const m of mesItens) if (m.mes) set.add(m.mes)
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [linhas, mesItens])

  /** Mês corrente se ele tiver dado; senão o mês mais recente com dado. */
  const mesPadrao = useMemo<string>(() => {
    const hoje = mesDeHoje()
    if (meses.includes(hoje)) return hoje
    return meses[0] ?? hoje
  }, [meses])

  const mes = mesSel && meses.includes(mesSel) ? mesSel : mesPadrao
  const ehMesCorrente = mes === mesDeHoje()

  /** Linhas do mês selecionado. */
  const linhasMes = useMemo(() => linhas.filter((l) => l.mes === mes), [linhas, mes])

  /**
   * Itens apontados no mês. Quantidade e valor vêm de `vw_medicao_mes_item`
   * (fonte oficial do total); preço e receita de origem vêm das linhas diárias.
   */
  const itensMes = useMemo<MedicaoItemMes[]>(() => {
    const porItem = new Map<string, { preco: number | null; servicos: Set<string> }>()
    for (const l of linhasMes) {
      const e = porItem.get(l.itemMedicao) ?? { preco: null, servicos: new Set<string>() }
      if (e.preco === null && l.preco60 > 0) e.preco = l.preco60
      e.servicos.add(l.servicoApontado)
      porItem.set(l.itemMedicao, e)
    }
    return mesItens
      .filter((m) => m.mes === mes)
      .map((m) => {
        const extra = porItem.get(m.itemMedicao)
        return {
          itemMedicao: m.itemMedicao,
          unidade: m.unidade,
          qtd: m.qtd,
          valor: m.valor,
          preco60: extra?.preco ?? null,
          servicos: extra ? [...extra.servicos].sort() : [],
        }
      })
      .sort((a, b) => b.valor - a.valor)
  }, [mesItens, linhasMes, mes])

  /** Curva de construção da medição: acumulado dia a dia dentro do mês. */
  const curva = useMemo<MedicaoCurvaPonto[]>(() => {
    if (!mes) return []
    const porDia = new Map<string, number>()
    for (const l of linhasMes) porDia.set(l.data, (porDia.get(l.data) ?? 0) + l.valor)
    const total = diasNoMes(mes)
    const hoje = new Date()
    const ultimoDia = ehMesCorrente ? Math.min(total, hoje.getDate()) : total
    const out: MedicaoCurvaPonto[] = []
    let acc = 0
    for (let d = 1; d <= ultimoDia; d++) {
      const data = `${mes}-${String(d).padStart(2, '0')}`
      const v = porDia.get(data) ?? 0
      acc += v
      out.push({ data, valor: v, acumulado: acc, temApontamento: porDia.has(data) })
    }
    return out
  }, [linhasMes, mes, ehMesCorrente])

  const resumo = useMemo<MedicaoResumoMes>(() => {
    const doMes = mesItens.filter((m) => m.mes === mes)
    const valor = doMes.reduce((s, m) => s + m.valor, 0)
    const dias = new Set(linhasMes.map((l) => l.data))
    const ultimo = [...dias].sort().pop() ?? null
    const total = diasNoMes(mes)
    const decorridos = ehMesCorrente ? Math.min(total, new Date().getDate()) : total
    return {
      mes,
      valor,
      itens: doMes.length,
      diasComApontamento: dias.size,
      ultimoDia: ultimo,
      diasDecorridos: decorridos,
      diasNoMes: total,
      mediaDia: decorridos > 0 ? valor / decorridos : null,
    }
  }, [mesItens, linhasMes, mes, ehMesCorrente])

  /** Quebra do valor do mês por núcleo (das linhas diárias). */
  const porNucleo = useMemo<MedicaoQuebra[]>(() => {
    const m = new Map<string, { valor: number; itens: number }>()
    for (const l of linhasMes) {
      const k = l.nucleo?.trim() || 'sem núcleo declarado'
      const e = m.get(k) ?? { valor: 0, itens: 0 }
      e.valor += l.valor
      e.itens += 1
      m.set(k, e)
    }
    const total = [...m.values()].reduce((s, e) => s + e.valor, 0)
    return [...m.entries()]
      .map(([nome, e]) => ({ nome, valor: e.valor, itens: e.itens, fracao: total > 0 ? e.valor / total : 0 }))
      .sort((a, b) => b.valor - a.valor)
  }, [linhasMes])

  /** Quebra do valor do mês por equipe (quem está gerando medição). */
  const porEquipe = useMemo<MedicaoQuebra[]>(() => {
    const m = new Map<string, { valor: number; itens: number }>()
    for (const l of linhasMes) {
      const k = l.equipeNome?.trim() || 'sem equipe declarada'
      const e = m.get(k) ?? { valor: 0, itens: 0 }
      e.valor += l.valor
      e.itens += 1
      m.set(k, e)
    }
    const total = [...m.values()].reduce((s, e) => s + e.valor, 0)
    return [...m.entries()]
      .map(([nome, e]) => ({ nome, valor: e.valor, itens: e.itens, fracao: total > 0 ? e.valor / total : 0 }))
      .sort((a, b) => b.valor - a.valor)
  }, [linhasMes])

  /** Quebra do valor do mês por serviço apontado (etapa de campo). */
  const porServico = useMemo<MedicaoQuebra[]>(() => {
    const m = new Map<string, { valor: number; itens: number }>()
    for (const l of linhasMes) {
      const e = m.get(l.servicoApontado) ?? { valor: 0, itens: 0 }
      e.valor += l.valor
      e.itens += 1
      m.set(l.servicoApontado, e)
    }
    const total = [...m.values()].reduce((s, e) => s + e.valor, 0)
    return [...m.entries()]
      .map(([nome, e]) => ({ nome, valor: e.valor, itens: e.itens, fracao: total > 0 ? e.valor / total : 0 }))
      .sort((a, b) => b.valor - a.valor)
  }, [linhasMes])

  /** Meses com medição OFICIAL fechada, do mais recente para o mais antigo. */
  const mesesOficiais = useMemo<string[]>(
    () => [...new Set(oficial.map((o) => o.mes).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
    [oficial],
  )

  /** Mês de referência do confronto: o mês oficial mais recente. */
  const mesOficialRef = mesesOficiais[0] ?? null

  /** Total da medição oficial fechada no mês de referência. null se não houver. */
  const totalOficialRef = useMemo<number | null>(() => {
    if (!mesOficialRef) return null
    return oficial.filter((o) => o.mes === mesOficialRef).reduce((s, o) => s + o.valor, 0)
  }, [oficial, mesOficialRef])

  /** Fonte declarada da medição oficial (nome da planilha importada). */
  const fonteOficial = useMemo<string | null>(
    () => oficial.find((o) => o.fonte)?.fonte ?? null,
    [oficial],
  )

  /**
   * Confronto APONTADO × MEDIDO no mês oficial de referência.
   *  - `comparaveis`: itens que existem na medição oficial (têm % de captura).
   *  - `semOficial`: apontado que NÃO casou com item oficial — em junho isso
   *    acontece por divergência de grafia do item na planilha (ex.:
   *    "LPB - LEITO - ASSENT REDE COLETORA" × "LPB- LEITO-ASSENT REDE COLETORA").
   *    Fica exposto em vez de somado no bolo.
   */
  const confronto = useMemo(() => {
    const doMes = captura.filter((c) => c.mes === mesOficialRef)
    const comparaveis = doMes
      .filter((c) => c.qtdOficial > 0 || c.valorOficial > 0)
      .sort((a, b) => b.valorOficial - a.valorOficial)
    const semOficial = doMes
      .filter((c) => c.qtdOficial <= 0 && c.valorOficial <= 0 && c.valorApontado > 0)
      .sort((a, b) => b.valorApontado - a.valorApontado)
    const totalOficial = comparaveis.reduce((s, c) => s + c.valorOficial, 0)
    const totalApontado = doMes.reduce((s, c) => s + c.valorApontado, 0)
    return {
      mes: mesOficialRef,
      comparaveis,
      semOficial,
      totalOficial,
      totalApontado,
      /** % de captura em VALOR (0..100+). null quando não há medição oficial. */
      pctValor: totalOficial > 0 ? (totalApontado / totalOficial) * 100 : null,
    }
  }, [captura, mesOficialRef])

  /** Receita agrupada por serviço apontado: quanto R$ vale apontar 1 unidade. */
  const receitaPorServico = useMemo<MedicaoReceitaServico[]>(() => {
    const m = new Map<string, MedicaoReceitaItem[]>()
    for (const r of receita) {
      const arr = m.get(r.servicoApontado) ?? []
      arr.push(r)
      m.set(r.servicoApontado, arr)
    }
    return [...m.entries()]
      .map(([servicoApontado, itens]) => ({
        servicoApontado,
        itens: [...itens].sort((a, b) => b.preco60 * b.fator - a.preco60 * a.fator),
        valorUnitario: itens.reduce((s, i) => s + i.preco60 * i.fator, 0),
      }))
      .sort((a, b) => b.valorUnitario - a.valorUnitario)
  }, [receita])

  return {
    // cruas
    linhas,
    linhasMes,
    mesItens,
    captura,
    oficial,
    receita,
    // seleção de mês
    meses,
    mes,
    ehMesCorrente,
    setMes: setMesSel,
    // derivados do mês
    resumo,
    itensMes,
    curva,
    porNucleo,
    porEquipe,
    porServico,
    // referência oficial
    mesesOficiais,
    mesOficialRef,
    totalOficialRef,
    fonteOficial,
    confronto,
    // receita
    receitaPorServico,
    // estado
    loading,
    error,
    reload: load,
  }
}
