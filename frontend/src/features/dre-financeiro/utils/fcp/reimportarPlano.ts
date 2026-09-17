/**
 * Reimportar a planilha do FCP: ATUALIZA o plano, não cria outro.
 *
 * ⚠️ **É o gesto que o cliente repete.** Ele mexe na planilha durante o mês e joga no sistema de
 * novo. Sem identidade estável, cada importação criaria um plano novo — dois, três, quatro — e a
 * tela passaria a perguntar "qual deles vale?". O Controle de Caixa já resolve isso por id
 * determinístico; este arquivo faz o mesmo para o FCP.
 *
 * E como toda importação deste módulo: **mostra o que muda antes de gravar**. Aqui o que está em
 * jogo é o capital que a empresa precisa ter no bolso — trocar isso em silêncio seria pior do que
 * não importar.
 */
import { seededId } from '@/lib/seededId'
import type { PremissasFcp } from './tipos'
import { ROTULO_CENARIO } from './tipos'
import { capitalNecessario, custoMensalDaCidade, custoMensalGlobal, fluxoMensal, ticketDaCidade } from './motor'
import type { PrecoDoContrato } from './importarFcp'

// No pacote original, PlanoFcp vinha de `@/store/fcpStore` (local-first, tabela fcp_planos). O
// ConstruData grava o FCP nas tabelas da migration 026 — o tipo fica aqui, só como formato de
// comparação da reimportação.
export type StatusDoPlano = 'rascunho' | 'enviado' | 'aprovado' | 'devolvido'
export interface PlanoFcp {
  id: string
  nome: string
  obraId?: string
  status: StatusDoPlano
  premissas: PremissasFcp
  /** Produção lançada por cidade e por semana. Semana sem lançamento usa o previsto. */
  realizado: Record<string, Record<number, number | undefined>>
  precos?: Record<string, PrecoDoContrato[]>
  criadoEm: string
  enviadoPor?: string
  enviadoEm?: string
  aprovadoPor?: string
  aprovadoEm?: string
}

/**
 * O id do plano.
 *
 * Derivado de **obra + nome do arquivo**, e não sorteado. Reimportar a mesma planilha chega no
 * mesmo id, e o `addPlano` (que é upsert) atualiza em vez de criar outro.
 *
 * O nome do arquivo entra normalizado: `Fluxo_Bertioga (1).xlsx` baixado duas vezes pelo navegador
 * viraria dois planos se o `(1)` contasse.
 */
export function idDoPlano(orgId: string | null | undefined, obraId: string | undefined, nomeArquivo: string): string {
  const base = nomeArquivo
    .replace(/\.xlsx?$/i, '')
    .replace(/\s*\(\d+\)\s*$/, '')   // o "(1)" que o navegador acrescenta
    .replace(/[\s_-]+/g, ' ')
    .trim()
    .toUpperCase()
  return seededId(orgId, 'fcp-plano', obraId ?? 'sem-obra', base)
}

export interface MudancaDePremissa {
  rotulo: string
  antes: string
  depois: string
}

export interface ConferenciaDoPlano {
  /** O plano que será atualizado, quando já existe um com este id. */
  existente: PlanoFcp | null
  ehNovo: boolean
  mudancas: MudancaDePremissa[]
  /** Quanto o capital recomendado muda, se a planilha nova for adotada. */
  capitalAntes: number | null
  capitalDepois: number
  /** Lançamentos de produção que serão PRESERVADOS. */
  lancamentosPreservados: number
  /** ⚠️ O plano está aprovado — sobrescrever exige reabrir. */
  travadoPorAprovacao: boolean
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const dia = (s: string) => (s ? s.split('-').reverse().join('/') : '—')

/**
 * As premissas em pares rótulo → texto.
 *
 * ⚠️ Exportada porque serve a DOIS usos, e o segundo faltava: comparar duas versões (reimportação)
 * **e** listar o que foi lido quando não há versão anterior (primeira importação). A tela mostrava
 * a tabela só no primeiro caso — então quem importava um plano novo via quatro números e um botão,
 * e tinha de confiar sem conferir nada. A planilha tem 11 abas.
 */
export function premissasComoTexto(p: PremissasFcp): Array<{ rotulo: string; valor: string }> {
  return comoTexto(p).map(([rotulo, valor]) => ({ rotulo, valor }))
}

/** As premissas em pares rótulo → texto, para comparar duas versões campo a campo. */
function comoTexto(p: PremissasFcp): Array<[string, string]> {
  const pares: Array<[string, string]> = [
    ['Início da obra', dia(p.inicioObra)],
    ['Fim da operação', dia(p.fimOperacao)],
    ['Dias por mês', String(p.diasPorMes)],
    ['Defasagem de recebimento', `${p.defasagemDias} dias`],
    ['Imposto da nota', pct(p.imposto)],
    ['Cenário adotado', ROTULO_CENARIO[p.cenario]],
    ['Contingência', pct(p.contingencia)],
    ['Fator do 1º mês', pct(p.fatorPrimeiroMes)],
    ['Consórcio desconta da medição', p.consorcioDescontaDaMedicao ? 'Sim' : 'Não'],
    ['Base do imposto', p.baseDoImposto === 'CHEIA' ? 'Medição cheia' : 'Líquida do desconto'],
    ['Custo mensal GLOBAL', brl(custoMensalGlobal(p))],
  ]
  for (const c of ['MINIMA', 'MEDIA', 'BOA', 'OTIMA'] as const) {
    pares.push([`Margem ${ROTULO_CENARIO[c]}`, pct(p.margens[c])])
  }
  for (const bloco of ['folha', 'engenheiro', 'estrutura', 'indiretos', 'mobilizacao'] as const) {
    pares.push([`Quem paga — ${bloco}`, p.regime[bloco] === 'CONSORCIO' ? 'Consórcio' : 'Empresa'])
  }
  // Cidade que sai ou entra é mudança grande, e o nome dela precisa aparecer.
  pares.push(['Cidades', p.cidades.map((c) => c.nome).sort().join(' · ') || '—'])
  for (const c of [...p.cidades].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))) {
    pares.push([`Custo mensal — ${c.nome}`, brl(custoMensalDaCidade(c))])
    pares.push([`Ticket — ${c.nome}`, brl(ticketDaCidade(c))])
    pares.push([`Mobilização — ${c.nome}`, brl(c.mobilizacao)])
  }
  return pares
}

/**
 * Compara a planilha que chegou com o plano que já existe.
 *
 * ⚠️ O `realizado` NÃO entra na comparação e NÃO é sobrescrito: a planilha traz premissas; a
 * produção lançada é trabalho que a equipe registrou semana a semana. Uma importação que apagasse
 * isso destruiria dado que não está em lugar nenhum além do sistema.
 */
export function conferirPlano(
  novo: { premissas: PremissasFcp; nome: string },
  existente: PlanoFcp | null,
): ConferenciaDoPlano {
  const capitalDepois = capitalNecessario(novo.premissas, fluxoMensal(novo.premissas, existente?.realizado ?? {})).capitalRecomendado

  if (!existente) {
    return {
      existente: null, ehNovo: true, mudancas: [],
      capitalAntes: null, capitalDepois,
      lancamentosPreservados: 0, travadoPorAprovacao: false,
    }
  }

  const antes = new Map(comoTexto(existente.premissas))
  const depois = new Map(comoTexto(novo.premissas))
  const mudancas: MudancaDePremissa[] = []
  for (const [rotulo, valorDepois] of depois) {
    const valorAntes = antes.get(rotulo)
    if (valorAntes !== valorDepois) {
      mudancas.push({ rotulo, antes: valorAntes ?? '—', depois: valorDepois })
    }
  }
  // Premissa que existia e sumiu (cidade removida, por exemplo) também é mudança.
  for (const [rotulo, valorAntes] of antes) {
    if (!depois.has(rotulo)) mudancas.push({ rotulo, antes: valorAntes, depois: '—' })
  }

  const lancamentosPreservados = Object.values(existente.realizado ?? {})
    .reduce((s, porSemana) => s + Object.values(porSemana ?? {}).filter((v) => v !== undefined).length, 0)

  return {
    existente,
    ehNovo: false,
    mudancas,
    capitalAntes: capitalNecessario(existente.premissas, fluxoMensal(existente.premissas, existente.realizado)).capitalRecomendado,
    capitalDepois,
    lancamentosPreservados,
    travadoPorAprovacao: existente.status === 'aprovado',
  }
}

/**
 * O plano que será gravado.
 *
 * Preserva do existente tudo que NÃO vem da planilha: a produção realizada, o status e o rastro de
 * quem enviou e aprovou. A planilha manda nas premissas e nos preços, e em mais nada.
 */
export function planoParaGravar(
  novo: { premissas: PremissasFcp; nome: string; precos: Record<string, PrecoDoContrato[]>; realizadoDaPlanilha: PlanoFcp['realizado'] },
  existente: PlanoFcp | null,
  id: string,
  obraId: string | undefined,
): PlanoFcp {
  return {
    id,
    nome: novo.nome,
    obraId: existente?.obraId ?? obraId,
    // Plano já aprovado que recebe premissa nova volta para rascunho: o número que a diretoria
    // aprovou deixou de ser o número da tela, e fingir que continua aprovado seria mentira.
    status: existente && !mudou(existente, novo.premissas) ? existente.status : 'rascunho',
    premissas: novo.premissas,
    // ⚠️ O realizado do plano existente VENCE o da planilha: ele pode ter sido lançado na tela ou
    // vindo do Last Planner depois da última exportação. O da planilha só entra onde não há nada.
    realizado: mesclarRealizado(novo.realizadoDaPlanilha, existente?.realizado),
    precos: novo.precos,
    criadoEm: existente?.criadoEm ?? new Date().toISOString(),
    enviadoPor: existente?.enviadoPor,
    enviadoEm: existente?.enviadoEm,
    aprovadoPor: existente?.aprovadoPor,
    aprovadoEm: existente?.aprovadoEm,
  }
}

function mudou(existente: PlanoFcp, premissas: PremissasFcp): boolean {
  return conferirPlano({ premissas, nome: existente.nome }, existente).mudancas.length > 0
}

/** O lançado no sistema vence; o da planilha preenche o que estiver vazio. */
export function mesclarRealizado(
  daPlanilha: PlanoFcp['realizado'],
  doSistema: PlanoFcp['realizado'] | undefined,
): PlanoFcp['realizado'] {
  const saida: PlanoFcp['realizado'] = {}
  for (const [cidade, porSemana] of Object.entries(daPlanilha ?? {})) {
    saida[cidade] = { ...porSemana }
  }
  for (const [cidade, porSemana] of Object.entries(doSistema ?? {})) {
    const alvo = saida[cidade] ?? (saida[cidade] = {})
    for (const [semana, valor] of Object.entries(porSemana ?? {})) {
      if (valor !== undefined) alvo[Number(semana)] = valor
    }
  }
  return saida
}
