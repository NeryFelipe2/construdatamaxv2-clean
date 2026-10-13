/**
 * useFcp.ts — camada de dados do Fluxo de Caixa Projetado.
 *
 * O CÁLCULO É O MOTOR TS (features/dre-financeiro/utils/fcp/motor.ts), desde
 * 16/09/2026. Este hook carrega as tabelas, converte com fcpDoBanco() e deriva
 * tudo em memória: grade semanal, FCP mensal, econômico, capital, viabilidade e
 * sensibilidade. As funções SQL antigas (fcp_semanas, fcp_capital…) ficaram no
 * banco como legado: descartavam a medição das semanas dentro da defasagem e
 * ignoravam obra sem ticket, e com isso o capital recomendado saía subestimado.
 * Por uma versão, o capital antigo aparece ao lado do novo, com a causa da
 * diferença — para ninguém ver o número mudar sem saber por quê.
 *
 * Degrada com elegância: se as tabelas do FCP ainda não existirem no banco
 * (migration pendente), `tabelasAusentes` fica true e a tela mostra o aviso em
 * vez de quebrar. Mesmo padrão do usePessoas.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  capitalNecessario, custoMensalDaCidade, fluxoEconomico, fluxoMensal, fluxoSemanal,
  sensibilidade as sensibilidadeDoMotor, ticketDaCidade, totalDoBloco, viabilidadeDaCidade,
} from '@/features/dre-financeiro/utils/fcp/motor'
import { fcpDoBanco, type PendenciaFcp } from '@/features/dre-financeiro/utils/fcp/fcpDoBanco'
import type { ColunaMensal, LinhaEconomica, PremissasFcp } from '@/features/dre-financeiro/utils/fcp/tipos'

// ─── tipos (espelham o schema da migration 026) ─────────────────────────────

export type FcpStatus = 'rascunho' | 'enviado' | 'aprovado' | 'devolvido'
export type FcpCategoria = 'folha' | 'engenheiro' | 'estrutura' | 'indiretos'
export type Cenario = 'MÍNIMA' | 'MÉDIA' | 'BOA' | 'ÓTIMA'
export type QuemPaga = 'CONSÓRCIO' | 'WCR'

export interface Fcp {
  id: string
  nome: string
  semana_ref: string
  status: FcpStatus
  observacao: string | null
  versao: number
  aprovado_em: string | null
  enviado_em: string | null
  devolvido_em: string | null
  created_at: string | null
}

export interface FcpPremissas {
  fcp_id: string
  inicio_obra: string
  fim_operacao: string
  dias_mes: number
  defasagem_dias: number
  imposto_aliquota: number
  cenario: Cenario
  margem_minima: number
  margem_media: number
  margem_boa: number
  margem_otima: number
  contingencia: number
  fator_primeiro_mes: number
  paga_folha: QuemPaga
  paga_engenheiro: QuemPaga
  paga_estrutura: QuemPaga
  paga_indiretos: QuemPaga
  paga_mobilizacao: QuemPaga
  desconta_medicao: boolean
  base_imposto: 'MEDIÇÃO CHEIA' | 'LÍQUIDA DO DESCONTO'
}

export interface FcpObra {
  id: string
  fcp_id: string
  projeto_id: string | null
  nome: string
  ordem: number
  ticket_unico: number | null
  ticket_agua: number | null
  ticket_esgoto: number | null
  pct_esgoto: number | null
  mobilizacao: number
}

export interface FcpCustoPessoa {
  id: string
  fcp_obra_id: string
  pessoa_id: string | null
  equipe: string | null
  nome: string
  cargo: string | null
  salario: number
  encargos: number
  beneficios: number
  ordem: number
}

export interface FcpCustoGeral {
  id: string
  fcp_obra_id: string
  item: string
  categoria: FcpCategoria
  quantidade: number
  valor_unitario: number
  observacao: string | null
  ordem: number
}

export interface FcpRealizado {
  id: string
  fcp_obra_id: string
  n_semana: number
  producao: number
  observacao: string | null
}

export interface FcpPreco {
  id: string
  fcp_obra_id: string
  item_codigo: string | null
  descricao: string
  numero_preco: string | null
  unidade: string | null
  valor_unitario: number | null
  observacao: string | null
  requer_conferencia: boolean
  ordem: number
}

/** Linha da grade semanal — vem calculada de fcp_semanas(). */
export interface FcpSemana {
  obra_id: string
  obra: string
  n_semana: number
  data_ini: string
  data_fim: string
  producao_prevista: number
  producao_realizada: number | null
  pct_planejado: number | null
  medicao: number
  recebimento: number
  imposto: number
  desconto_consorcio: number
  custo_wcr: number
  mobilizacao: number
  despesas: number
  saldo_periodo: number
  saldo_acumulado: number
}

export interface FcpCapital {
  /** Pior acumulado ANTES do recebimento (negativo = dinheiro que falta). */
  pior_saldo: number
  necessidade: number
  /** Percentual de contingência (premissa), ex.: 0,15. */
  contingencia: number
  /** Contingência em R$. */
  contingencia_valor: number
  capital_recomendado: number
  /** Mês (1º dia) do pior ponto do caixa. */
  mes_pior_ponto: string | null
}

/** O capital que o cálculo SQL antigo daria — só para explicar a mudança por uma versão. */
export interface FcpCapitalLegado {
  capital_recomendado: number
  causas: string[]
}

export type FcpSensibilidade = ReturnType<typeof sensibilidadeDoMotor>

export interface FcpViabilidade {
  obra: string
  cenario: Cenario
  margem: number
  receita_liquida_mes: number
  medicao_bruta_mes: number
  servicos_mes: number
  servicos_semana: number
  servicos_dia: number
  agua_dia: number | null
  esgoto_dia: number | null
  /** Obra sem ticket: serviços/dia não é calculável (não é zero). */
  sem_ticket: boolean
}

export interface FcpCustoObra {
  total: number
  folha: number
  engenheiro: number
  estrutura: number
  indiretos: number
}

/** tabela/função ainda não existe no banco (migration pendente) */
function ausente(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  const code = e.code ?? ''
  const msg = (e.message ?? '').toLowerCase()
  return (
    code === '42P01' || code === 'PGRST205' || code === 'PGRST202' ||
    (msg.includes('does not exist') && (msg.includes('relation') || msg.includes('function'))) ||
    msg.includes('could not find the table') ||
    msg.includes('could not find the function')
  )
}

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v))
const numN = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

export interface UseFcpReturn {
  fcps: Fcp[]
  fcpId: string | null
  setFcpId: (id: string | null) => void
  fcp: Fcp | null
  premissas: FcpPremissas | null
  obras: FcpObra[]
  pessoas: FcpCustoPessoa[]
  gerais: FcpCustoGeral[]
  realizados: FcpRealizado[]
  precos: FcpPreco[]
  semanas: FcpSemana[]
  capital: FcpCapital | null
  viabilidade: FcpViabilidade[]
  custoPorObra: Record<string, FcpCustoObra>
  /** FCP mensal do motor — o capital sai daqui. */
  mensal: ColunaMensal[]
  /** Resultado por competência. */
  economico: LinhaEconomica[]
  sensibilidade: FcpSensibilidade
  /** O que o motor não consegue calcular direito com os dados atuais (ticket, custos…). */
  pendencias: PendenciaFcp[]
  capitalLegado: FcpCapitalLegado | null
  /** As premissas no formato do motor (para o importador e a ponte com o RDO). */
  premissasMotor: PremissasFcp | null
  loading: boolean
  erro: string | null
  tabelasAusentes: boolean
  travado: boolean
  recarregar: () => Promise<void>
  /** Cria um FCP em branco para a obra ativa (documento + premissas padrão + a obra). */
  criarFcp: (nome: string, semanaRef: string) => Promise<boolean>
  salvarPremissas: (p: Partial<FcpPremissas>) => Promise<boolean>
  salvarObra: (id: string, p: Partial<FcpObra>) => Promise<boolean>
  lancarRealizado: (obraId: string, semana: number, producao: number | null) => Promise<boolean>
  mudarStatus: (novo: FcpStatus, observacao?: string) => Promise<boolean>
  horizonteSemanas: number
  setHorizonteSemanas: (n: number) => void
}

export function useFcp(projetoId: string | null): UseFcpReturn {
  const [fcps, setFcps] = useState<Fcp[]>([])
  const [fcpId, setFcpId] = useState<string | null>(null)
  const [premissas, setPremissas] = useState<FcpPremissas | null>(null)
  const [obras, setObras] = useState<FcpObra[]>([])
  const [pessoas, setPessoas] = useState<FcpCustoPessoa[]>([])
  const [gerais, setGerais] = useState<FcpCustoGeral[]>([])
  const [realizados, setRealizados] = useState<FcpRealizado[]>([])
  const [precos, setPrecos] = useState<FcpPreco[]>([])
  const [capitalLegadoValor, setCapitalLegadoValor] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [tabelasAusentes, setTabelasAusentes] = useState(false)
  const [horizonteSemanas, setHorizonteSemanas] = useState(12)

  // lista de FCPs (o seletor de semana no topo)
  const carregarLista = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    // O FCP é POR OBRA: sem obra selecionada não há o que listar. Foi a falta
    // deste filtro que fez o FCP de Bertioga+Santos aparecer "dentro" do
    // Sakura — o documento estava pendurado direto na organização.
    if (!projetoId) { setFcps([]); setFcpId(null); setLoading(false); return }
    const { data, error } = await supabase
      .from('fcp')
      .select('id, nome, semana_ref, status, observacao, versao, aprovado_em, enviado_em, devolvido_em, created_at, fcp_obra!inner(projeto_id)')
      .eq('fcp_obra.projeto_id', projetoId)
      .is('deleted_at', null)
      .order('semana_ref', { ascending: false })
    if (error) {
      if (ausente(error)) { setTabelasAusentes(true); setLoading(false); return }
      setErro(error.message); setLoading(false); return
    }
    const lista = (data ?? []) as Fcp[]
    setFcps(lista)
    // troca de obra: se o FCP selecionado não pertence à nova obra, solta
    setFcpId((atual) => (atual && lista.some((f) => f.id === atual) ? atual : lista[0]?.id ?? null))
    setLoading(false)
  }, [projetoId])

  // conteúdo do FCP selecionado (entradas + resultados calculados no banco)
  const carregarDetalhe = useCallback(async (id: string) => {
    if (!supabase) return
    setLoading(true); setErro(null)
    try {
      const [oPrem, oObras] = await Promise.all([
        supabase.from('fcp_premissas').select('*').eq('fcp_id', id).maybeSingle(),
        supabase.from('fcp_obra').select('*').eq('fcp_id', id).is('deleted_at', null).order('ordem'),
      ])
      if (oPrem.error && ausente(oPrem.error)) { setTabelasAusentes(true); return }

      const prem = oPrem.data as FcpPremissas | null
      setPremissas(prem ? {
        ...prem,
        imposto_aliquota: num(prem.imposto_aliquota),
        contingencia: num(prem.contingencia),
        fator_primeiro_mes: num(prem.fator_primeiro_mes),
        margem_minima: num(prem.margem_minima), margem_media: num(prem.margem_media),
        margem_boa: num(prem.margem_boa), margem_otima: num(prem.margem_otima),
      } : null)

      const listaObras = ((oObras.data ?? []) as FcpObra[]).map((o) => ({
        ...o,
        ticket_unico: numN(o.ticket_unico), ticket_agua: numN(o.ticket_agua),
        ticket_esgoto: numN(o.ticket_esgoto), pct_esgoto: numN(o.pct_esgoto),
        mobilizacao: num(o.mobilizacao),
      }))
      setObras(listaObras)

      const ids = listaObras.map((o) => o.id)
      if (ids.length) {
        const [oPes, oGer, oPre, oRz] = await Promise.all([
          supabase.from('fcp_custo_pessoa').select('*').in('fcp_obra_id', ids).is('deleted_at', null).order('ordem'),
          supabase.from('fcp_custo_geral').select('*').in('fcp_obra_id', ids).is('deleted_at', null).order('ordem'),
          supabase.from('fcp_preco').select('*').in('fcp_obra_id', ids).is('deleted_at', null).order('ordem').limit(2000),
          supabase.from('fcp_realizado').select('*').in('fcp_obra_id', ids).is('deleted_at', null).order('n_semana'),
        ])
        setPessoas(((oPes.data ?? []) as FcpCustoPessoa[]).map((p) => ({
          ...p, salario: num(p.salario), encargos: num(p.encargos), beneficios: num(p.beneficios),
        })))
        setGerais(((oGer.data ?? []) as FcpCustoGeral[]).map((g) => ({
          ...g, quantidade: num(g.quantidade), valor_unitario: num(g.valor_unitario),
        })))
        setPrecos(((oPre.data ?? []) as FcpPreco[]).map((p) => ({ ...p, valor_unitario: numN(p.valor_unitario) })))
        setRealizados(((oRz.data ?? []) as FcpRealizado[]).map((r) => ({ ...r, producao: num(r.producao) })))
      } else {
        setPessoas([]); setGerais([]); setPrecos([]); setRealizados([])
      }

      // Legado, por uma versão: o capital que a função SQL antiga daria. Só para a tela explicar a
      // diferença. Se a função não existir ou falhar, some sem barulho — não é número de decisão.
      try {
        const { data: leg, error: eLeg } = await supabase.rpc('fcp_capital', { p_fcp_id: id, p_semanas: 12 })
        const r = (Array.isArray(leg) ? leg[0] : leg) as { capital_recomendado?: unknown } | undefined
        setCapitalLegadoValor(!eLeg && r && r.capital_recomendado !== null && r.capital_recomendado !== undefined
          ? Number(r.capital_recomendado) : null)
      } catch {
        setCapitalLegadoValor(null)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void carregarLista() }, [carregarLista])
  useEffect(() => { if (fcpId) void carregarDetalhe(fcpId) }, [fcpId, carregarDetalhe])

  const fcp = useMemo(() => fcps.find((f) => f.id === fcpId) ?? null, [fcps, fcpId])
  // aprovado trava a edição — o trigger fcp_trava_aprovado barra no banco de
  // qualquer jeito; aqui é só para a tela desabilitar os campos antes do erro.
  const travado = fcp?.status === 'aprovado'

  // ── O CÁLCULO: tabelas → motor ────────────────────────────────────────────
  const convertido = useMemo(
    () => fcpDoBanco({ premissas, obras, pessoas, gerais, realizados }),
    [premissas, obras, pessoas, gerais, realizados],
  )
  const premissasMotor = convertido.premissas

  const calculo = useMemo(() => {
    const P = premissasMotor
    if (!P || P.cidades.length === 0) {
      return {
        semanas: [] as FcpSemana[], capital: null as FcpCapital | null, viabilidade: [] as FcpViabilidade[],
        custoPorObra: {} as Record<string, FcpCustoObra>, mensal: [] as ColunaMensal[],
        economico: [] as LinhaEconomica[], sensibilidade: [] as FcpSensibilidade,
      }
    }
    const R = convertido.realizado
    const nomeDe = new Map(P.cidades.map((c) => [c.id, c.nome]))

    const semanas: FcpSemana[] = fluxoSemanal(P, R, horizonteSemanas).flatMap((col) =>
      col.porCidade.map((l) => ({
        obra_id: l.cidadeId, obra: nomeDe.get(l.cidadeId) ?? '',
        n_semana: col.semana.numero, data_ini: col.semana.inicio, data_fim: col.semana.fim,
        producao_prevista: l.producaoPrevista,
        producao_realizada: l.producaoRealizada ?? null,
        pct_planejado: l.aderencia ?? null,
        medicao: l.medicao, recebimento: l.recebimento, imposto: l.imposto,
        desconto_consorcio: l.descontoConsorcio, custo_wcr: l.custosDaEmpresa,
        mobilizacao: l.mobilizacao, despesas: l.totalDespesas,
        saldo_periodo: l.saldoPeriodo, saldo_acumulado: l.saldoAcumulado,
      })))

    const mensal = fluxoMensal(P, R)
    const cap = capitalNecessario(P, mensal)
    const capital: FcpCapital = {
      pior_saldo: mensal.reduce((m, c) => Math.min(m, c.acumuladoAntesDoRecebimento), 0),
      necessidade: cap.necessidadeMaxima,
      contingencia: P.contingencia,
      contingencia_valor: cap.contingencia,
      capital_recomendado: cap.capitalRecomendado,
      mes_pior_ponto: cap.mesDoPiorPonto,
    }

    const rotuloCenario = { MINIMA: 'MÍNIMA', MEDIA: 'MÉDIA', BOA: 'BOA', OTIMA: 'ÓTIMA' } as const
    const viabilidade: FcpViabilidade[] = P.cidades.flatMap((c) => {
      const semTicket = ticketDaCidade(c) <= 0
      return viabilidadeDaCidade(P, c).map((v) => ({
        obra: c.nome,
        cenario: rotuloCenario[v.cenario],
        margem: v.margem, receita_liquida_mes: v.receitaLiquida, medicao_bruta_mes: v.medicaoBruta,
        servicos_mes: v.servicosMes, servicos_semana: v.servicosSemana, servicos_dia: v.servicosDia,
        agua_dia: v.porServico?.[0]?.porDia ?? null,
        esgoto_dia: v.porServico?.[1]?.porDia ?? null,
        sem_ticket: semTicket,
      }))
    })

    const custoPorObra: Record<string, FcpCustoObra> = Object.fromEntries(P.cidades.map((c) => [c.id, {
      total: custoMensalDaCidade(c),
      folha: totalDoBloco(c.custos, 'folha'),
      engenheiro: totalDoBloco(c.custos, 'engenheiro'),
      estrutura: totalDoBloco(c.custos, 'estrutura'),
      indiretos: totalDoBloco(c.custos, 'indiretos'),
    }]))

    return {
      semanas, capital, viabilidade, custoPorObra, mensal,
      economico: fluxoEconomico(P, R),
      sensibilidade: sensibilidadeDoMotor(P),
    }
  }, [premissasMotor, convertido.realizado, horizonteSemanas])

  // Regra 9 do pacote: número que muda tem de vir com a causa — só as que se aplicam a ESTE FCP.
  const capitalLegado = useMemo((): FcpCapitalLegado | null => {
    if (capitalLegadoValor === null || !calculo.capital || !premissasMotor) return null
    const diferenca = calculo.capital.capital_recomendado - capitalLegadoValor
    if (Math.abs(diferenca) < 1) return null
    const P = premissasMotor
    const causas: string[] = [
      `o antigo olhava o pior saldo SEMANAL nas 12 primeiras semanas; o novo olha o pior acumulado MENSAL antes do recebimento, até o fim da operação (${P.fimOperacao.split('-').reverse().join('/')}).`,
    ]
    if (P.defasagemDias > 0) {
      causas.push(`com defasagem de ${P.defasagemDias} dias, o antigo DESCARTAVA a medição das primeiras semanas em vez de receber depois — mostrava caixa que não existe.`)
    }
    const semTicket = P.cidades.filter((c) => ticketDaCidade(c) <= 0).map((c) => c.nome)
    if (semTicket.length > 0) {
      causas.push(`o antigo ignorava a obra sem ticket, com os custos dela (${semTicket.join(', ')}); o novo mantém os custos saindo do caixa.`)
    }
    if (P.fatorPrimeiroMes !== 1) {
      causas.push(`o antigo não aplicava o fator do 1º mês (${P.fatorPrimeiroMes}); o novo aplica ao custo do mês de início.`)
    }
    return { capital_recomendado: capitalLegadoValor, causas }
  }, [capitalLegadoValor, calculo.capital, premissasMotor])

  const recarregar = useCallback(async () => {
    await carregarLista()
    if (fcpId) await carregarDetalhe(fcpId)
  }, [carregarLista, carregarDetalhe, fcpId])

  const criarFcp = useCallback(async (nome: string, semanaRef: string) => {
    if (!supabase || !projetoId) return false
    setErro(null)
    // 1. o documento
    const { data: doc, error: e1 } = await supabase.from('fcp')
      .insert({ nome, semana_ref: semanaRef }).select('id').single()
    if (e1) {
      setErro(e1.code === '23505'
        ? 'Já existe um FCP para essa semana nesta empresa — selecione-o na lista.'
        : e1.message)
      return false
    }
    const novoId = (doc as { id: string }).id
    // 2. premissas padrão (mesmos defaults da migration 026); o engenheiro
    //    ajusta tudo na aba Premissas
    const fim = new Date(semanaRef + 'T12:00:00'); fim.setDate(fim.getDate() + 364)
    const { error: e2 } = await supabase.from('fcp_premissas')
      .insert({ fcp_id: novoId, inicio_obra: semanaRef, fim_operacao: fim.toISOString().slice(0, 10) })
    if (e2) { setErro(e2.message); return false }
    // 3. a obra do documento = a obra ativa do seletor. O CHECK do banco exige
    //    um modo de ticket, então entra com ticket_unico = 0 — a grade não
    //    projeta nada até o engenheiro preencher o ticket real em Custos.
    const nomeCurto = nome.replace(/^WCR\s*—\s*/i, '').toUpperCase()
    const { error: e3 } = await supabase.from('fcp_obra')
      .insert({ fcp_id: novoId, nome: nomeCurto, ordem: 1, projeto_id: projetoId, ticket_unico: 0 })
    if (e3) { setErro(e3.message); return false }
    await carregarLista()
    setFcpId(novoId)
    return true
  }, [projetoId, carregarLista])

  const salvarPremissas = useCallback(async (p: Partial<FcpPremissas>) => {
    if (!supabase || !fcpId || travado) return false
    const { error } = await supabase.from('fcp_premissas').update(p).eq('fcp_id', fcpId)
    if (error) { setErro(error.message); return false }
    await carregarDetalhe(fcpId)
    return true
  }, [fcpId, travado, carregarDetalhe])

  const salvarObra = useCallback(async (id: string, p: Partial<FcpObra>) => {
    if (!supabase || !fcpId || travado) return false
    const { error } = await supabase.from('fcp_obra').update(p).eq('id', id)
    if (error) { setErro(error.message); return false }
    await carregarDetalhe(fcpId)
    return true
  }, [fcpId, travado, carregarDetalhe])

  /** producao = null apaga o lançamento (a semana volta a usar o planejado). */
  const lancarRealizado = useCallback(async (obraId: string, semana: number, producao: number | null) => {
    if (!supabase || !fcpId || travado) return false
    const q = producao === null
      ? supabase.from('fcp_realizado').delete().eq('fcp_obra_id', obraId).eq('n_semana', semana)
      : supabase.from('fcp_realizado').upsert(
          { fcp_obra_id: obraId, n_semana: semana, producao },
          { onConflict: 'fcp_obra_id,n_semana' },
        )
    const { error } = await q
    if (error) { setErro(error.message); return false }
    await carregarDetalhe(fcpId)
    return true
  }, [fcpId, travado, carregarDetalhe])

  const mudarStatus = useCallback(async (novo: FcpStatus, observacao?: string) => {
    if (!supabase || !fcpId) return false
    const agora = new Date().toISOString()
    const patch: Record<string, unknown> = { status: novo }
    if (novo === 'enviado') patch.enviado_em = agora
    if (novo === 'aprovado') patch.aprovado_em = agora
    if (novo === 'devolvido') { patch.devolvido_em = agora; patch.observacao = observacao ?? null }
    const { error } = await supabase.from('fcp').update(patch).eq('id', fcpId)
    if (error) { setErro(error.message); return false }
    await recarregar()
    return true
  }, [fcpId, recarregar])

  return {
    fcps, fcpId, setFcpId, fcp, premissas, obras, pessoas, gerais, realizados, precos,
    semanas: calculo.semanas, capital: calculo.capital, viabilidade: calculo.viabilidade,
    custoPorObra: calculo.custoPorObra, mensal: calculo.mensal, economico: calculo.economico,
    sensibilidade: calculo.sensibilidade, pendencias: convertido.pendencias, capitalLegado, premissasMotor,
    loading, erro, tabelasAusentes, travado,
    recarregar, criarFcp, salvarPremissas, salvarObra, lancarRealizado, mudarStatus,
    horizonteSemanas, setHorizonteSemanas,
  }
}
