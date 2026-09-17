/**
 * fcpDoBanco.ts — as tabelas do FCP (migration 026) viram as premissas do motor, e vice-versa.
 *
 * Desde 16/09/2026 o cálculo do Fluxo de Caixa Projetado é o motor TS (motor.ts), e não mais as
 * funções SQL fcp_semanas/fcp_capital/fcp_viabilidade — elas descartavam a defasagem (as semanas
 * iniciais simplesmente não recebiam) e ignoravam obra sem ticket, e com isso o capital
 * recomendado saía subestimado. As funções ficam no banco como legado, sem ninguém que dependa do
 * número delas.
 *
 * ⚠️ Puro de propósito (só `import type` de useFcp), para rodar em node:test.
 */
import type {
  FcpCustoGeral, FcpCustoPessoa, FcpObra, FcpPremissas, FcpRealizado,
} from '@/hooks/useFcp'
import type { ProducaoRealizada } from './motor'
import type { BlocoDeCusto, Cenario, CidadeFcp, PremissasFcp, QuemPaga } from './tipos'

export interface LinhasDoFcp {
  premissas: FcpPremissas | null
  obras: FcpObra[]
  pessoas: FcpCustoPessoa[]
  gerais: FcpCustoGeral[]
  realizados: FcpRealizado[]
}

export interface PendenciaFcp {
  obraId?: string
  mensagem: string
}

const CENARIO_DO_BANCO: Record<FcpPremissas['cenario'], Cenario> = {
  'MÍNIMA': 'MINIMA', 'MÉDIA': 'MEDIA', 'BOA': 'BOA', 'ÓTIMA': 'OTIMA',
}
const CENARIO_PARA_BANCO: Record<Cenario, FcpPremissas['cenario']> = {
  MINIMA: 'MÍNIMA', MEDIA: 'MÉDIA', BOA: 'BOA', OTIMA: 'ÓTIMA',
}

const quemPaga = (v: 'CONSÓRCIO' | 'WCR'): QuemPaga => (v === 'WCR' ? 'EMPRESA' : 'CONSORCIO')
const pagaParaBanco = (v: QuemPaga): 'CONSÓRCIO' | 'WCR' => (v === 'EMPRESA' ? 'WCR' : 'CONSÓRCIO')

const n = (v: unknown): number => Number(v)
const nOuNulo = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))

/** Rótulos do mix no banco: B é sempre o esgoto (`pct_esgoto`), A a água. */
export const ROTULO_MIX = { A: 'Água', B: 'Esgoto' } as const

export function fcpDoBanco(l: LinhasDoFcp): {
  premissas: PremissasFcp | null
  realizado: ProducaoRealizada
  pendencias: PendenciaFcp[]
} {
  const pendencias: PendenciaFcp[] = []
  const realizado: ProducaoRealizada = {}
  if (!l.premissas) {
    return { premissas: null, realizado, pendencias: [{ mensagem: 'Este FCP não tem premissas gravadas.' }] }
  }
  const pr = l.premissas
  const vivas = <T extends { deleted_at?: string | null }>(xs: T[]) => xs.filter((x) => !x.deleted_at)

  const cidades: CidadeFcp[] = vivas(l.obras as Array<FcpObra & { deleted_at?: string | null }>)
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((o) => {
      const unico = nOuNulo(o.ticket_unico)
      const agua = nOuNulo(o.ticket_agua)
      const esgoto = nOuNulo(o.ticket_esgoto)
      const pctEsgoto = nOuNulo(o.pct_esgoto)
      const mixCompleto = agua !== null && esgoto !== null && pctEsgoto !== null
      const mixParcial = !mixCompleto && (agua !== null || esgoto !== null || pctEsgoto !== null)

      if (mixParcial) {
        pendencias.push({ obraId: o.id, mensagem: `${o.nome}: ticket de água/esgoto incompleto — preencha os dois tickets e o % de esgoto.` })
      }
      if (mixCompleto && unico !== null && unico > 0) {
        pendencias.push({ obraId: o.id, mensagem: `${o.nome}: tem ticket único E mix água/esgoto — o cálculo usa o mix. Apague o que não vale.` })
      }
      if (!mixCompleto && (unico === null || unico <= 0)) {
        pendencias.push({
          obraId: o.id,
          mensagem: `${o.nome}: sem ticket — a medição projetada fica zerada, mas os custos continuam saindo do caixa.`,
        })
      }

      const pessoas = vivas(l.pessoas as Array<FcpCustoPessoa & { deleted_at?: string | null }>).filter((p) => p.fcp_obra_id === o.id)
      const gerais = vivas(l.gerais as Array<FcpCustoGeral & { deleted_at?: string | null }>).filter((g) => g.fcp_obra_id === o.id)
      if (pessoas.length === 0 && gerais.length === 0) {
        pendencias.push({ obraId: o.id, mensagem: `${o.nome}: sem custos cadastrados — o fluxo de caixa sai sem despesa nenhuma.` })
      }

      for (const r of vivas(l.realizados as Array<FcpRealizado & { deleted_at?: string | null }>)) {
        if (r.fcp_obra_id !== o.id) continue
        // Um 0 gravado é zero de verdade; semana sem linha fica undefined (usa o previsto).
        ;(realizado[o.id] ??= {})[r.n_semana] = n(r.producao)
      }

      return {
        id: o.id,
        nome: o.nome,
        ticket: unico ?? 0,
        ...(mixCompleto
          ? { mix: { rotuloA: ROTULO_MIX.A, ticketA: agua!, rotuloB: ROTULO_MIX.B, ticketB: esgoto!, fracaoB: pctEsgoto! } }
          : {}),
        mobilizacao: n(o.mobilizacao ?? 0),
        custos: {
          quadro: pessoas
            .slice().sort((a, b) => a.ordem - b.ordem)
            .map((p) => ({
              ...(p.equipe ? { equipe: p.equipe } : {}), nome: p.nome, cargo: p.cargo ?? '',
              salario: n(p.salario), encargos: n(p.encargos), beneficios: n(p.beneficios),
            })),
          gerais: gerais
            .slice().sort((a, b) => a.ordem - b.ordem)
            .map((g) => ({
              item: g.item, quantidade: n(g.quantidade), valorUnitario: n(g.valor_unitario),
              bloco: g.categoria as BlocoDeCusto,
            })),
        },
      }
    })

  if (cidades.length === 0) pendencias.push({ mensagem: 'Este FCP não tem nenhuma obra.' })

  const premissas: PremissasFcp = {
    inicioObra: pr.inicio_obra.slice(0, 10),
    fimOperacao: pr.fim_operacao.slice(0, 10),
    diasPorMes: n(pr.dias_mes),
    defasagemDias: n(pr.defasagem_dias),
    imposto: n(pr.imposto_aliquota),
    cenario: CENARIO_DO_BANCO[pr.cenario] ?? 'OTIMA',
    margens: {
      MINIMA: n(pr.margem_minima), MEDIA: n(pr.margem_media),
      BOA: n(pr.margem_boa), OTIMA: n(pr.margem_otima),
    },
    contingencia: n(pr.contingencia),
    fatorPrimeiroMes: n(pr.fator_primeiro_mes),
    regime: {
      folha: quemPaga(pr.paga_folha),
      engenheiro: quemPaga(pr.paga_engenheiro),
      estrutura: quemPaga(pr.paga_estrutura),
      indiretos: quemPaga(pr.paga_indiretos),
      mobilizacao: quemPaga(pr.paga_mobilizacao),
    },
    consorcioDescontaDaMedicao: !!pr.desconta_medicao,
    baseDoImposto: pr.base_imposto === 'LÍQUIDA DO DESCONTO' ? 'LIQUIDA_DO_DESCONTO' : 'CHEIA',
    cidades,
  }
  return { premissas, realizado, pendencias }
}

/**
 * O caminho de volta: premissas do motor → linhas das tabelas. Usado pelo importador (o que a
 * prévia mostra é exatamente o que o banco vai recalcular) e pelo teste de ida e volta.
 * Os ids das obras são os da própria premissa; o importador troca pelos do banco ao gravar.
 */
export function bancoDoFcp(p: PremissasFcp, fcpId: string, realizado: ProducaoRealizada = {}): LinhasDoFcp {
  const premissas: FcpPremissas = {
    fcp_id: fcpId,
    inicio_obra: p.inicioObra,
    fim_operacao: p.fimOperacao,
    dias_mes: p.diasPorMes,
    defasagem_dias: p.defasagemDias,
    imposto_aliquota: p.imposto,
    cenario: CENARIO_PARA_BANCO[p.cenario],
    margem_minima: p.margens.MINIMA, margem_media: p.margens.MEDIA,
    margem_boa: p.margens.BOA, margem_otima: p.margens.OTIMA,
    contingencia: p.contingencia,
    fator_primeiro_mes: p.fatorPrimeiroMes,
    paga_folha: pagaParaBanco(p.regime.folha),
    paga_engenheiro: pagaParaBanco(p.regime.engenheiro),
    paga_estrutura: pagaParaBanco(p.regime.estrutura),
    paga_indiretos: pagaParaBanco(p.regime.indiretos),
    paga_mobilizacao: pagaParaBanco(p.regime.mobilizacao),
    desconta_medicao: p.consorcioDescontaDaMedicao,
    base_imposto: p.baseDoImposto === 'LIQUIDA_DO_DESCONTO' ? 'LÍQUIDA DO DESCONTO' : 'MEDIÇÃO CHEIA',
  }
  const obras: FcpObra[] = []
  const pessoas: FcpCustoPessoa[] = []
  const gerais: FcpCustoGeral[] = []
  const realizados: FcpRealizado[] = []

  p.cidades.forEach((c, i) => {
    obras.push({
      id: c.id, fcp_id: fcpId, projeto_id: null, nome: c.nome, ordem: i + 1,
      ticket_unico: c.mix ? null : c.ticket,
      ticket_agua: c.mix ? c.mix.ticketA : null,
      ticket_esgoto: c.mix ? c.mix.ticketB : null,
      pct_esgoto: c.mix ? c.mix.fracaoB : null,
      mobilizacao: c.mobilizacao,
    })
    c.custos.quadro.forEach((q, j) => pessoas.push({
      id: `${c.id}-p${j}`, fcp_obra_id: c.id, pessoa_id: null, equipe: q.equipe ?? null,
      nome: q.nome, cargo: q.cargo || null, salario: q.salario, encargos: q.encargos, beneficios: q.beneficios, ordem: j,
    }))
    c.custos.gerais.forEach((g, j) => gerais.push({
      id: `${c.id}-g${j}`, fcp_obra_id: c.id, item: g.item,
      categoria: g.bloco as FcpCustoGeral['categoria'],
      quantidade: g.quantidade, valor_unitario: g.valorUnitario, observacao: null, ordem: j,
    }))
    for (const [semana, v] of Object.entries(realizado[c.id] ?? {})) {
      if (typeof v !== 'number') continue
      realizados.push({ id: `${c.id}-r${semana}`, fcp_obra_id: c.id, n_semana: Number(semana), producao: v, observacao: null })
    }
  })
  return { premissas, obras, pessoas, gerais, realizados }
}
