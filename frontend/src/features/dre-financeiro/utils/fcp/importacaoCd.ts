/**
 * importacaoCd.ts — a prévia da importação da planilha de FCP, antes de gravar.
 *
 * O leitor que GRAVA continua sendo o do ConstruData (components/importador/planilhaFcp.ts), que
 * conhece as variações de planilha que já passaram por aqui (quadro sem nome, contrato por EAP,
 * preço sem valor). O que vem do pacote é o que faltava: a planilha é uma CALCULADORA, e as abas
 * calculadas (FCP MENSAL, ECONÔMICO) são CONFERIDAS contra o motor; e a produção realizada da aba
 * FCP SEMANAL entra — sem nunca passar por cima do que já foi lançado no sistema.
 *
 * Tudo aqui é puro (só `import type` de fora), para rodar em node:test.
 */
import type { FcpPremissas, FcpStatus } from '@/hooks/useFcp'
import type { LeituraFcp } from '../../components/importador/planilhaFcp'
import { fcpDoBanco, type LinhasDoFcp, type PendenciaFcp } from './fcpDoBanco'
import {
  conferirContraAPlanilha, explicarDivergencias, lerRealizado,
  type Abas, type ConferenciaFeita, type Divergencia,
} from './importarFcp'
import { capitalNecessario, fluxoMensal, type ProducaoRealizada } from './motor'
import { conferirPlano, mesclarRealizado, type MudancaDePremissa, type PlanoFcp } from './reimportarPlano'
import type { PremissasFcp } from './tipos'

/** Os defaults da migration 026 — o que o banco grava quando a planilha não traz o campo. */
export const PADRAO_DO_BANCO: Omit<FcpPremissas, 'fcp_id' | 'inicio_obra' | 'fim_operacao'> = {
  dias_mes: 30, defasagem_dias: 20, imposto_aliquota: 0.22, cenario: 'ÓTIMA',
  margem_minima: 0, margem_media: 0.1, margem_boa: 0.15, margem_otima: 0.2,
  contingencia: 0.15, fator_primeiro_mes: 0.5,
  paga_folha: 'CONSÓRCIO', paga_engenheiro: 'CONSÓRCIO', paga_estrutura: 'CONSÓRCIO',
  paga_indiretos: 'WCR', paga_mobilizacao: 'CONSÓRCIO',
  desconta_medicao: true, base_imposto: 'MEDIÇÃO CHEIA',
}

const ROTULO_CAMPO: Record<keyof typeof PADRAO_DO_BANCO, string> = {
  dias_mes: 'Dias por mês', defasagem_dias: 'Defasagem de recebimento', imposto_aliquota: 'Imposto da nota',
  cenario: 'Cenário adotado', margem_minima: 'Margem MÍNIMA', margem_media: 'Margem MÉDIA',
  margem_boa: 'Margem BOA', margem_otima: 'Margem ÓTIMA', contingencia: 'Contingência',
  fator_primeiro_mes: 'Fator do 1º mês', paga_folha: 'Quem paga a folha', paga_engenheiro: 'Quem paga o engenheiro',
  paga_estrutura: 'Quem paga a estrutura', paga_indiretos: 'Quem paga os indiretos',
  paga_mobilizacao: 'Quem paga a mobilização', desconta_medicao: 'Consórcio desconta da medição',
  base_imposto: 'Base do imposto',
}

export interface FcpExistente {
  id: string
  nome: string
  status: FcpStatus
  linhas: LinhasDoFcp
}

export interface ConferenciaDaImportacao {
  /** Premissas que valerão depois de gravar (planilha > o que já estava > padrão do banco). */
  premissas: PremissasFcp | null
  /** Campos que a planilha não trouxe e não existiam: vão com o padrão do banco. Regra 1: dizer. */
  padroesUsados: Array<{ campo: string; valor: string }>
  pendencias: PendenciaFcp[]
  /** As conferências da planilha contra o motor — as que bateram também. */
  conferencias: ConferenciaFeita[]
  divergencias: Divergencia[]
  /** Premissas que mudam em relação ao FCP que já existe. */
  mudancas: MudancaDePremissa[]
  capitalAntes: number | null
  capitalDepois: number | null
  /** Realizado da planilha que entra (só onde o sistema não tem nada). */
  realizadoNovo: Array<{ obra: string; semana: number; producao: number }>
  /** Semanas em que a planilha e o sistema discordam — vale o sistema. */
  realizadoConflitante: Array<{ obra: string; semana: number; planilha: number; sistema: number }>
  /** Obras que estão no FCP e não vieram na planilha — apontadas, NÃO apagadas. */
  obrasAusentes: string[]
  /** FCP enviado/devolvido que recebe premissa nova volta para rascunho. Aprovado não é tocado. */
  voltaParaRascunho: boolean
}

const texto = (v: unknown) => (typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v))

/** Leitura do ConstruData + (se houver) o FCP existente → as linhas como ficarão no banco. */
export function linhasDaLeitura(
  leitura: LeituraFcp,
  existente: FcpExistente | null,
  fcpId = 'novo',
): { linhas: LinhasDoFcp; padroesUsados: ConferenciaDaImportacao['padroesUsados'] } {
  const padroesUsados: ConferenciaDaImportacao['padroesUsados'] = []
  const antes = existente?.linhas.premissas ?? null
  const lp = leitura.premissas

  const campo = <K extends keyof typeof PADRAO_DO_BANCO>(k: K): (typeof PADRAO_DO_BANCO)[K] => {
    const daPlanilha = (lp as unknown as Record<string, unknown>)[k]
    if (daPlanilha !== null && daPlanilha !== undefined) return daPlanilha as (typeof PADRAO_DO_BANCO)[K]
    if (antes) return antes[k] as (typeof PADRAO_DO_BANCO)[K]
    padroesUsados.push({ campo: ROTULO_CAMPO[k], valor: texto(PADRAO_DO_BANCO[k]) })
    return PADRAO_DO_BANCO[k]
  }

  const premissas: FcpPremissas | null = lp.inicio_obra && lp.fim_operacao
    ? {
      fcp_id: fcpId,
      inicio_obra: lp.inicio_obra, fim_operacao: lp.fim_operacao,
      dias_mes: campo('dias_mes'), defasagem_dias: campo('defasagem_dias'), imposto_aliquota: campo('imposto_aliquota'),
      cenario: campo('cenario'), margem_minima: campo('margem_minima'), margem_media: campo('margem_media'),
      margem_boa: campo('margem_boa'), margem_otima: campo('margem_otima'), contingencia: campo('contingencia'),
      fator_primeiro_mes: campo('fator_primeiro_mes'), paga_folha: campo('paga_folha'),
      paga_engenheiro: campo('paga_engenheiro'), paga_estrutura: campo('paga_estrutura'),
      paga_indiretos: campo('paga_indiretos'), paga_mobilizacao: campo('paga_mobilizacao'),
      desconta_medicao: campo('desconta_medicao'), base_imposto: campo('base_imposto'),
    }
    : null

  // O id da obra é o do banco quando ela já existe (casada pelo nome, como o gravador faz).
  const idDaObra = (nome: string) =>
    existente?.linhas.obras.find((o) => o.nome === nome)?.id ?? `nova:${nome}`

  const linhas: LinhasDoFcp = { premissas, obras: [], pessoas: [], gerais: [], realizados: [] }
  leitura.obras.forEach((o, i) => {
    const id = idDaObra(o.nome)
    linhas.obras.push({
      id, fcp_id: fcpId, projeto_id: null, nome: o.nome, ordem: i + 1,
      ticket_unico: o.ticket_unico, ticket_agua: o.ticket_agua, ticket_esgoto: o.ticket_esgoto,
      pct_esgoto: o.pct_esgoto, mobilizacao: o.mobilizacao,
    })
    o.pessoas.forEach((p, j) => linhas.pessoas.push({ id: `${id}:p${j}`, fcp_obra_id: id, pessoa_id: null, ...p, ordem: j }))
    o.gerais.forEach((g, j) => linhas.gerais.push({ id: `${id}:g${j}`, fcp_obra_id: id, observacao: null, ...g, ordem: j }))
  })
  // O realizado que já está no sistema segue junto (as obras com o mesmo id).
  if (existente) linhas.realizados = existente.linhas.realizados.filter((r) => linhas.obras.some((o) => o.id === r.fcp_obra_id))
  return { linhas, padroesUsados }
}

export function conferirImportacao(
  leitura: LeituraFcp,
  abas: Abas,
  existente: FcpExistente | null,
): ConferenciaDaImportacao {
  const { linhas, padroesUsados } = linhasDaLeitura(leitura, existente, existente?.id)
  const novo = fcpDoBanco(linhas)
  const P = novo.premissas

  const vazio: ConferenciaDaImportacao = {
    premissas: P, padroesUsados, pendencias: novo.pendencias, conferencias: [], divergencias: [],
    mudancas: [], capitalAntes: null, capitalDepois: null, realizadoNovo: [], realizadoConflitante: [],
    obrasAusentes: [], voltaParaRascunho: false,
  }
  if (!P) return vazio

  // Realizado: o da planilha preenche onde o sistema não tem nada; o do sistema vence.
  const semanal = abas['FCP SEMANAL']
  const daPlanilha: ProducaoRealizada = semanal ? lerRealizado(semanal, P.cidades) : {}
  const doSistema = novo.realizado
  const nomeDe = new Map(P.cidades.map((c) => [c.id, c.nome]))
  const realizadoNovo: ConferenciaDaImportacao['realizadoNovo'] = []
  const realizadoConflitante: ConferenciaDaImportacao['realizadoConflitante'] = []
  for (const [cidade, porSemana] of Object.entries(daPlanilha)) {
    for (const [s, v] of Object.entries(porSemana ?? {})) {
      if (v === undefined) continue
      const sistema = doSistema[cidade]?.[Number(s)]
      if (sistema === undefined) realizadoNovo.push({ obra: nomeDe.get(cidade) ?? cidade, semana: Number(s), producao: v })
      else if (Math.abs(sistema - v) > 1e-9) {
        realizadoConflitante.push({ obra: nomeDe.get(cidade) ?? cidade, semana: Number(s), planilha: v, sistema })
      }
    }
  }
  const realizadoDepois = mesclarRealizado(daPlanilha, doSistema)

  // As 12 conferências do pacote, contra a planilha — só com a premissa da própria planilha.
  const conferencias: ConferenciaFeita[] = []
  const divergencias = explicarDivergencias(P, abas, conferirContraAPlanilha(P, abas, conferencias))

  // Antes × depois.
  let mudancas: MudancaDePremissa[] = []
  let capitalAntes: number | null = null
  let obrasAusentes: string[] = []
  if (existente) {
    const velho = fcpDoBanco(existente.linhas)
    if (velho.premissas) {
      const plano: PlanoFcp = {
        id: existente.id, nome: existente.nome, status: existente.status,
        premissas: velho.premissas, realizado: velho.realizado, criadoEm: '',
      }
      const c = conferirPlano({ premissas: P, nome: existente.nome }, plano)
      mudancas = c.mudancas
      capitalAntes = c.capitalAntes
    }
    const nomesNovos = new Set(leitura.obras.map((o) => o.nome))
    obrasAusentes = existente.linhas.obras.map((o) => o.nome).filter((n) => !nomesNovos.has(n))
  }
  const capitalDepois = capitalNecessario(P, fluxoMensal(P, realizadoDepois)).capitalRecomendado

  return {
    ...vazio,
    conferencias, divergencias, mudancas, capitalAntes, capitalDepois,
    realizadoNovo, realizadoConflitante, obrasAusentes,
    voltaParaRascunho: !!existente && (existente.status === 'enviado' || existente.status === 'devolvido') && mudancas.length > 0,
  }
}
