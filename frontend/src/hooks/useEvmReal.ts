import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useMasterScheduleEngine } from './useMasterScheduleEngine'
import {
  computeEvmReal,
  computeEvmRealPorSegmento,
  type BaselineSegmentInput,
  type ComputeEvmRealResult,
  type SegmentoBaselineInput,
  type EvmRealSegmento,
  type ProducaoRealInput,
} from '@/features/evm/utils/computeEvmReal'

const EMPTY_RESULT: ComputeEvmRealResult = {
  serie: [],
  metrics: {
    BAC: 0, PV: 0, EV: 0, AC: 0, CPI: 0, SPI: 0, CV: 0, SV: 0, EAC: 0, ETC: 0, VAC: 0, TCPI: 0,
    eacScenarios: { optimistic: 0, trend: 0, pessimistic: 0 },
  },
}

const SISTEMA_LABEL: Record<string, string> = { agua: 'Água', esgoto: 'Esgoto', civil: 'Civil', geral: 'Geral' }

// ─────────────────────────────────────────────────────────────────────────
// FASE 5 — CUSTO NO CIRCUITO (27/07/2026)
//
// Mapa etapa (vw_producao_longa.etapa) → serviço do de-para `servico_codigo_map`.
// O de-para foi semeado no banco APENAS com matches inequívocos
// (descrição idêntica normalizada entre serviço apontado e `precos_contrato`,
// preço único no ano corrente). Hoje só existe UM match inequívoco:
//
//   caixa_uma → 'INSTALAÇÃO CAIXA P/UNID MEDIÇÃO ÁGUA'
//     (UMA = Unidade de Medição de Água — expansão literal da sigla;
//      R$ 290,60 cheio × fator_wcr 0,6 = R$ 174,36/un. Os itens de contrato
//      "ADICIONAL P/INSTAL CAIXA UMA..." são complementos, NÃO entram —
//      sem como saber se se aplicam a cada caixa. Valor é piso, não teto.)
//
// Etapas SEM serviço mapeável (ficam sem preço — honesto, zero invenção):
//   hm, lig_agua, lig_esgoto — o contrato tem dezenas de códigos de ligação
//     (leito/passeio, DN, com/sem reposição) com preços diferentes; o
//     apontamento não diz qual se aplica.
//   rede_agua_m, rede_esgoto_m — idem (VCA×MND, profundidade, pavimento).
//   caixa_inspecao, pv, pi, interceptor, interligacao_* — sem descrição
//     idêntica em `precos_contrato` (só variantes ambíguas).
// Quando o de-para ganhar novas linhas revisadas (ex.: aliases aprovados),
// basta acrescentar a etapa aqui — o preço é lido do banco, nunca hardcoded.
// ─────────────────────────────────────────────────────────────────────────
const ETAPA_SERVICO: Record<string, string> = {
  caixa_uma: 'INSTALAÇÃO CAIXA P/UNID MEDIÇÃO ÁGUA',
}

/** Espelho do `norm_txt` do banco: minúsculas, sem acento, espaços colapsados. */
function normTxt(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** De onde veio o BAC — declarado na UI, nunca implícito. */
export type BacFonte = 'orcamento_total' | 'planejamento_custo_previsto' | 'campanha_x_mapa' | null

export interface EvContratoItem {
  etapa: string
  servico: string
  qtd: number
  /** Preço WCR (valor_unitario × fator_wcr) lido do banco — nunca hardcoded. */
  precoUnit: number
  valor: number
}

export interface EtapaSemPreco {
  etapa: string
  qtd: number
}

export interface CustoCircuito {
  /** BAC resolvido (null = nenhum dos 3 caminhos tem valor > 0). */
  bacValor: number | null
  bacFonte: BacFonte
  /** EV valorado pelo contrato (null = nenhuma etapa produzida tem preço no de-para). */
  evContratoTotal: number | null
  evContratoItens: EvContratoItem[]
  /** Produção real SEM preço inequívoco no de-para — mostrada sem valor (honesto). */
  etapasSemPreco: EtapaSemPreco[]
  /** Custo real lançado (null = 0 lançamentos DESPESA em lancamentos_financeiros). */
  acReal: number | null
  /** EV contrato / AC real — só quando os DOIS insumos existem. */
  cpiContrato: number | null
  /** Linhas em servico_codigo_map (transparência do de-para). */
  mapaServicos: number
  /** Serviços do mapa com preço único resolvido em precos_contrato (ano corrente). */
  precosResolvidos: number
}

const EMPTY_CUSTO: CustoCircuito = {
  bacValor: null,
  bacFonte: null,
  evContratoTotal: null,
  evContratoItens: [],
  etapasSemPreco: [],
  acReal: null,
  cpiContrato: null,
  mapaServicos: 0,
  precosResolvidos: 0,
}

/**
 * useEvmReal — plugadas as fontes reais (E7) no motor puro `computeEvmReal`,
 * SEM tocar em `evmStore` (mock, intacto no Modo Demo). Só leitura:
 *
 *  - PV: `useMasterScheduleEngine` (nível 0 = grupos núcleo×sistema com
 *    plannedStart/plannedEnd + peso por metragem).
 *  - EV (curva): `producao_diaria` (pra_m + pre_m por lançamento).
 *  - EV (contrato, Fase 5): `vw_producao_longa` valorada pelos preços do
 *    de-para `servico_codigo_map` → `precos_contrato` (ver ETAPA_SERVICO).
 *  - AC: `lancamentos_financeiros` tipo DESPESA. Sem lançamento → AC = null
 *    (a tela mostra "sem custo real lançado", nunca inventa zero-custo).
 *  - BAC (Fase 5, em ordem de prioridade — fonte declarada em `bacFonte`):
 *      1. `projetos.orcamento_total` (quando o contrato for cadastrado);
 *      2. Σ `planejamento_itens.custo_previsto` (valorado via de-para no banco);
 *      3. quantidades da campanha (`metas_producao`, linha de maior período
 *         para não somar campanha+semana em dobro) × preços do de-para.
 *    Nenhum caminho com valor > 0 → BAC = null e o EVM fica honesto-vazio.
 */
export function useEvmReal(projetoId: string | null) {
  const { activities, loading: loadingBaseline, error: baselineError } = useMasterScheduleEngine(projetoId)

  const [bacResolvido, setBacResolvido] = useState(0)
  const [bacFonte, setBacFonte] = useState<BacFonte>(null)
  const [custoCircuito, setCustoCircuito] = useState<CustoCircuito>(EMPTY_CUSTO)
  const [producaoMetros, setProducaoMetros] = useState<{ data: string; metros: number }[]>([])
  const [producaoPorSegmento, setProducaoPorSegmento] = useState<Map<string, ProducaoRealInput[]>>(new Map())
  const [despesas, setDespesas] = useState<{ data: string; valor: number }[]>([])
  const [temProducaoReal, setTemProducaoReal] = useState(false)
  const [temDespesaReal, setTemDespesaReal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) {
      setBacResolvido(0)
      setBacFonte(null)
      setCustoCircuito(EMPTY_CUSTO)
      setProducaoMetros([])
      setProducaoPorSegmento(new Map())
      setDespesas([])
      setTemProducaoReal(false)
      setTemDespesaReal(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const anoAtual = String(new Date().getFullYear())
      const [projRes, prodRes, finRes, planRes, metasRes, mapaRes, prodLongaRes] = await Promise.all([
        supabase.from('projetos').select('orcamento_total').eq('id', projetoId).maybeSingle(),
        supabase.from('producao_diaria').select('data, nucleo, pra_m, pre_m').eq('projeto_id', projetoId),
        supabase.from('lancamentos_financeiros').select('data, valor, tipo').eq('project_id', projetoId).eq('tipo', 'DESPESA'),
        supabase.from('planejamento_itens').select('custo_previsto').eq('projeto_id', projetoId),
        supabase.from('metas_producao').select('nome, periodo_ini, periodo_fim, lig_agua, lig_esgoto, rede_agua_m, rede_esgoto_m').eq('projeto_id', projetoId),
        supabase.from('servico_codigo_map').select('servico, codigo, descricao'),
        supabase.from('vw_producao_longa').select('etapa, qtd').eq('projeto_id', projetoId),
      ])

      if (projRes.error) throw projRes.error
      if (prodRes.error) throw prodRes.error
      if (finRes.error) throw finRes.error
      if (planRes.error) throw planRes.error
      if (metasRes.error) throw metasRes.error
      if (mapaRes.error) throw mapaRes.error
      if (prodLongaRes.error) throw prodLongaRes.error

      // ── Preços do de-para: servico_codigo_map → precos_contrato (ano atual).
      // Preço aplicado = valor_unitario × fator_wcr (60%), MESMA convenção do
      // trigger sync_rdo_to_medicao e de usePrecosContrato. Se a mesma
      // descrição resolver pra mais de um preço distinto → descartada
      // (ambígua, não inventamos escolha).
      const mapaRows = (mapaRes.data ?? []) as { servico: string; codigo: string | null; descricao: string | null }[]
      const precoPorServico = new Map<string, number>()
      if (mapaRows.length > 0) {
        const descricoes = [...new Set(mapaRows.map((m) => m.descricao).filter((d): d is string => !!d))]
        if (descricoes.length > 0) {
          const precosRes = await supabase
            .from('precos_contrato')
            .select('descricao, valor_unitario, fator_wcr')
            .eq('ano', anoAtual)
            .in('descricao', descricoes)
          if (precosRes.error) throw precosRes.error
          const precosPorDescricao = new Map<string, Set<number>>()
          for (const p of precosRes.data ?? []) {
            const key = normTxt(String((p as any).descricao))
            const precoWcr = Math.round(Number((p as any).valor_unitario) * Number((p as any).fator_wcr) * 100) / 100
            if (!Number.isFinite(precoWcr) || precoWcr <= 0) continue
            const set = precosPorDescricao.get(key) ?? new Set<number>()
            set.add(precoWcr)
            precosPorDescricao.set(key, set)
          }
          for (const m of mapaRows) {
            const set = precosPorDescricao.get(normTxt(String(m.descricao ?? '')))
            if (set && set.size === 1) precoPorServico.set(normTxt(m.servico), [...set][0])
          }
        }
      }

      // ── EV contrato: produção real (vw_producao_longa) × preço do de-para,
      // etapa a etapa via ETAPA_SERVICO. Etapa sem preço → listada sem valor.
      const qtdPorEtapa = new Map<string, number>()
      for (const r of prodLongaRes.data ?? []) {
        const etapa = String((r as any).etapa ?? '')
        const qtd = Number((r as any).qtd) || 0
        if (!etapa || qtd <= 0) continue
        qtdPorEtapa.set(etapa, (qtdPorEtapa.get(etapa) ?? 0) + qtd)
      }
      const evContratoItens: EvContratoItem[] = []
      const etapasSemPreco: EtapaSemPreco[] = []
      for (const [etapa, qtd] of [...qtdPorEtapa.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const servico = ETAPA_SERVICO[etapa]
        const precoUnit = servico ? precoPorServico.get(normTxt(servico)) : undefined
        if (servico && precoUnit != null) {
          evContratoItens.push({ etapa, servico, qtd, precoUnit, valor: Math.round(precoUnit * qtd * 100) / 100 })
        } else {
          etapasSemPreco.push({ etapa, qtd })
        }
      }
      const evContratoTotal = evContratoItens.length > 0
        ? evContratoItens.reduce((s, i) => s + i.valor, 0)
        : null

      // ── BAC — 3 caminhos, fonte declarada (ver doc do hook). ─────────────
      const bacOrcamento = Number(projRes.data?.orcamento_total) || 0
      const bacPlanejamento = (planRes.data ?? []).reduce(
        (s: number, r: any) => s + (Number(r.custo_previsto) || 0), 0)

      // Campanha: usa SÓ a linha de maior período de metas_producao (a linha
      // "semana" é subconjunto da campanha — somar as duas dobraria a meta).
      let bacCampanha = 0
      const metas = (metasRes.data ?? []) as any[]
      if (metas.length > 0) {
        const spanDias = (m: any) => {
          const ini = Date.parse(String(m.periodo_ini ?? ''))
          const fim = Date.parse(String(m.periodo_fim ?? ''))
          return Number.isFinite(ini) && Number.isFinite(fim) ? fim - ini : -1
        }
        const campanha = metas.reduce((a, b) => (spanDias(b) > spanDias(a) ? b : a))
        // Campos da meta → etapa do circuito → serviço do de-para → preço.
        // Campo sem preço inequívoco NÃO contribui (fica de fora, não é zero inventado).
        const campoEtapa: Record<string, string> = {
          lig_agua: 'lig_agua',
          lig_esgoto: 'lig_esgoto',
          rede_agua_m: 'rede_agua_m',
          rede_esgoto_m: 'rede_esgoto_m',
        }
        for (const [campo, etapa] of Object.entries(campoEtapa)) {
          const qtd = Number(campanha?.[campo]) || 0
          const servico = ETAPA_SERVICO[etapa]
          const preco = servico ? precoPorServico.get(normTxt(servico)) : undefined
          if (qtd > 0 && preco != null) bacCampanha += qtd * preco
        }
        bacCampanha = Math.round(bacCampanha * 100) / 100
      }

      let bac = 0
      let fonte: BacFonte = null
      if (bacOrcamento > 0) {
        bac = bacOrcamento
        fonte = 'orcamento_total'
      } else if (bacPlanejamento > 0) {
        bac = bacPlanejamento
        fonte = 'planejamento_custo_previsto'
      } else if (bacCampanha > 0) {
        bac = bacCampanha
        fonte = 'campanha_x_mapa'
      }
      setBacResolvido(bac)
      setBacFonte(fonte)

      const producao = (prodRes.data ?? []).map((r: any) => ({
        data: String(r.data),
        metros: (Number(r.pra_m) || 0) + (Number(r.pre_m) || 0),
      }))
      setProducaoMetros(producao)
      setTemProducaoReal(producao.length > 0)

      // Bucketiza por núcleo × sistema (água = pra_m, esgoto = pre_m) — mesma
      // granularidade dos segmentos nível-0 do baseline (useMasterScheduleEngine),
      // usado pela aba Índices real (CPI/SPI por segmento em vez de agregado).
      const porSegmentoMap = new Map<string, ProducaoRealInput[]>()
      for (const r of prodRes.data ?? []) {
        const nucleo = String((r as any).nucleo ?? '').trim() || 'Sem núcleo'
        const data = String((r as any).data)
        const agua = Number((r as any).pra_m) || 0
        const esgoto = Number((r as any).pre_m) || 0
        if (agua > 0) {
          const k = `${nucleo}|agua`
          const arr = porSegmentoMap.get(k) ?? []
          arr.push({ data, metros: agua })
          porSegmentoMap.set(k, arr)
        }
        if (esgoto > 0) {
          const k = `${nucleo}|esgoto`
          const arr = porSegmentoMap.get(k) ?? []
          arr.push({ data, metros: esgoto })
          porSegmentoMap.set(k, arr)
        }
      }
      setProducaoPorSegmento(porSegmentoMap)

      const desp = (finRes.data ?? []).map((r: any) => ({ data: String(r.data), valor: Number(r.valor) || 0 }))
      setDespesas(desp)
      setTemDespesaReal(desp.length > 0)

      // ── AC honesto: sem lançamento DESPESA → null ("sem custo real lançado"),
      // nunca 0 fingindo custo-zero. CPI contrato só com os dois insumos. ────
      const acReal = desp.length > 0 ? Math.round(desp.reduce((s, d) => s + d.valor, 0) * 100) / 100 : null
      const cpiContrato = acReal != null && acReal > 0 && evContratoTotal != null
        ? evContratoTotal / acReal
        : null

      setCustoCircuito({
        bacValor: bac > 0 ? bac : null,
        bacFonte: fonte,
        evContratoTotal,
        evContratoItens,
        etapasSemPreco,
        acReal,
        cpiContrato,
        mapaServicos: mapaRows.length,
        precosResolvidos: precoPorServico.size,
      })
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar dados reais do EVM')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    load()
  }, [load])

  const baseline: BaselineSegmentInput[] = activities
    .filter((a) => a.level === 0)
    .map((a) => ({
      plannedStart: a.plannedStart,
      plannedEnd: a.plannedEnd,
      weight: (a as any).weight ?? 1,
    }))

  const temDadosReais = temProducaoReal || temDespesaReal
  const result: ComputeEvmRealResult = temDadosReais && bacResolvido > 0 && baseline.length > 0
    ? computeEvmReal(baseline, producaoMetros, despesas, bacResolvido)
    : EMPTY_RESULT

  // ── Segmentação núcleo × sistema (aba Índices real) ──────────────────────
  // Agrupa as atividades nível-0 (já são grupos núcleo×sistema, ver
  // useMasterScheduleEngine) por chave "núcleo|sistema" e roda o motor puro
  // por segmento — reaproveita o mesmo `computeEvmReal`, sem duplicar lógica.
  const segmentGroups = new Map<string, { nucleo: string; sistema: string; weight: number; starts: string[]; ends: string[] }>()
  for (const a of activities) {
    if (a.level !== 0) continue
    const nucleo = (a.nucleo ?? '').trim() || 'Sem núcleo'
    const sistema = a.networkType ?? 'geral'
    const key = `${nucleo}|${sistema}`
    const g = segmentGroups.get(key) ?? { nucleo, sistema, weight: 0, starts: [], ends: [] }
    g.weight += (a as any).weight ?? 1
    if (a.plannedStart) g.starts.push(a.plannedStart)
    if (a.plannedEnd) g.ends.push(a.plannedEnd)
    segmentGroups.set(key, g)
  }
  const segmentos: SegmentoBaselineInput[] = [...segmentGroups.entries()].map(([key, g]) => ({
    key,
    label: `${g.nucleo} — ${SISTEMA_LABEL[g.sistema] ?? g.sistema}`,
    plannedStart: g.starts.length ? g.starts.reduce((a, b) => (a < b ? a : b)) : '',
    plannedEnd: g.ends.length ? g.ends.reduce((a, b) => (a > b ? a : b)) : '',
    weight: g.weight,
  }))

  const porSegmento: EvmRealSegmento[] = bacResolvido > 0 && segmentos.length > 0
    ? computeEvmRealPorSegmento(segmentos, producaoPorSegmento, despesas, bacResolvido)
    : []

  return {
    serie: result.serie,
    metrics: result.metrics,
    bac: bacResolvido,
    bacFonte,
    custoCircuito,
    baselineCount: baseline.length,
    temProducaoReal,
    temDespesaReal,
    temDadosReais,
    porSegmento,
    loading: loading || loadingBaseline,
    error: error ?? baselineError,
    reload: load,
  }
}
