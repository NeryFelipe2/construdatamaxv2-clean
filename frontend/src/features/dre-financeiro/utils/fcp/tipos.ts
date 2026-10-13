/**
 * Fluxo de Caixa Projetado — o modelo.
 *
 * Tirado célula a célula de `docs/FLUXO_CAIXA_PROJETADO_BERTIOGA_SANTOS_v2.xlsx`, lendo as
 * FÓRMULAS e não só os valores. Cada campo aqui existe porque uma fórmula da planilha o consulta;
 * o comentário diz qual.
 *
 * ⚠️ Duas palavras que a planilha usa e que o sistema tem de manter separadas:
 *  - **ECONÔMICO** é competência: a margem real do contrato, mês a mês, independente de quando o
 *    dinheiro entra.
 *  - **FINANCEIRO** (FCP Semanal e Mensal) é caixa: quando o dinheiro entra e sai de fato.
 * Misturar os dois é o erro que faz a empresa achar que tem margem e quebrar de caixa.
 */

export type Cenario = 'MINIMA' | 'MEDIA' | 'BOA' | 'OTIMA'

export const CENARIOS: readonly Cenario[] = ['MINIMA', 'MEDIA', 'BOA', 'OTIMA']

export const ROTULO_CENARIO: Record<Cenario, string> = {
  MINIMA: 'Mínima', MEDIA: 'Média', BOA: 'Boa', OTIMA: 'Ótima',
}

/** Quem banca cada bloco de custo. Obra sem consórcio marca tudo como EMPRESA. */
export type QuemPaga = 'CONSORCIO' | 'EMPRESA'

export type BlocoDeCusto = 'folha' | 'engenheiro' | 'estrutura' | 'indiretos' | 'mobilizacao'

/**
 * Sobre o que incide o imposto da nota.
 *
 * ⚠️ Premissa crítica, e a própria planilha manda confirmar com o contador (LEIA-ME): `CHEIA` é
 * conservador (22% sobre a medição toda); `LIQUIDA_DO_DESCONTO` faz entrar bem mais caixa.
 */
export type BaseDoImposto = 'CHEIA' | 'LIQUIDA_DO_DESCONTO'

/** Uma linha do quadro nominal. Vem da Mão de Obra quando a obra já tem quadro cadastrado. */
export interface PessoaDoQuadro {
  equipe?: string
  nome: string
  cargo: string
  salario: number
  encargos: number
  beneficios: number
}

/** Uma linha de "custos gerais da obra". */
export interface CustoGeral {
  item: string
  quantidade: number
  valorUnitario: number
  /** A qual bloco do regime este item pertence — é o que decide quem paga. */
  bloco: BlocoDeCusto
}

export interface CustosDaCidade {
  quadro: PessoaDoQuadro[]
  gerais: CustoGeral[]
}

/**
 * Uma cidade (ou frente) do fluxo.
 *
 * O ticket pode ser um só ou uma mistura de dois serviços — em Santos são água e esgoto, com
 * preços muito diferentes (R$ 821,25 e R$ 1.856,40), e o mix muda o ticket ponderado.
 */
export interface CidadeFcp {
  id: string
  nome: string
  /** Ticket único. Ignorado quando há `mix`. */
  ticket: number
  mix?: {
    rotuloA: string
    ticketA: number
    rotuloB: string
    ticketB: number
    /** Fração da carteira que é o serviço B. */
    fracaoB: number
  }
  /** Desembolso inicial da cidade (coluna "Anterior" do FCP Semanal). */
  mobilizacao: number
  custos: CustosDaCidade
}

export interface PremissasFcp {
  // ── 1. Calendário e contrato ────────────────────────────────────────────────
  /** Segunda-feira da S1. `PREMISSAS!C6`. */
  inicioObra: string
  /** Último dia de obra. `PREMISSAS!C7`. */
  fimOperacao: string
  /** Convenção de rateio: diário = mensal ÷ isto. `PREMISSAS!C8`. */
  diasPorMes: number
  /** A medição fecha no último dia do mês e é paga tantos dias depois. `PREMISSAS!C9`. */
  defasagemDias: number
  /** Retenções + tributos sobre a medição bruta. `PREMISSAS!C10`. */
  imposto: number

  // ── 2. Cenário de produção ──────────────────────────────────────────────────
  cenario: Cenario
  /** Margem de cada cenário. MÍNIMA = 0 é o empate. `PREMISSAS!C14:C17`. */
  margens: Record<Cenario, number>

  // ── 5/6. Capital e risco ────────────────────────────────────────────────────
  /** Sobre a necessidade máxima. Atraso de medição, chuva, quebra. `PREMISSAS!C38`. */
  contingencia: number
  /** Fração do custo mensal no 1º mês (obra parcial). `PREMISSAS!C39`. */
  fatorPrimeiroMes: number

  // ── 7. Quem paga o quê ──────────────────────────────────────────────────────
  regime: Record<BlocoDeCusto, QuemPaga>
  /** SIM = o que o consórcio banca é abatido do que a empresa recebe. `PREMISSAS!C47`. */
  consorcioDescontaDaMedicao: boolean
  baseDoImposto: BaseDoImposto

  cidades: CidadeFcp[]
}

// ─── Saídas do motor ──────────────────────────────────────────────────────────

export interface LinhaViabilidade {
  cenario: Cenario
  margem: number
  receitaLiquida: number
  medicaoBruta: number
  servicosMes: number
  servicosSemana: number
  servicosDia: number
  adotado: boolean
  /** Quando a cidade tem mix, a quebra por serviço. */
  porServico?: Array<{ rotulo: string; porDia: number }>
}

export interface Semana {
  numero: number
  inicio: string
  fim: string
}

export interface LinhaSemanalDaCidade {
  cidadeId: string
  producaoPrevista: number
  /** O que foi lançado na semana. `undefined` = a semana usa o previsto. */
  producaoRealizada?: number
  medicao: number
  recebimento: number
  imposto: number
  descontoConsorcio: number
  custosDaEmpresa: number
  mobilizacao: number
  outrosDesembolsos: number
  totalDespesas: number
  saldoPeriodo: number
  saldoAcumulado: number
  /** % do planejado, só quando houve lançamento. */
  aderencia?: number
}

export interface ColunaSemanal {
  semana: Semana
  porCidade: LinhaSemanalDaCidade[]
  recebimento: number
  totalDespesas: number
  saldoPeriodo: number
  saldoAcumulado: number
  aderencia?: number
}

export interface MesDoFluxo {
  /** Primeiro dia do mês, ISO. */
  mes: string
  /** Dias de obra dentro do mês — o 1º e o último entram proporcionais. */
  diasDeObra: number
  /**
   * Dias equivalentes para RATEIO DE CUSTO. No 1º mês é `fatorPrimeiroMes × diasPorMes`, não os
   * dias de obra — é o que a planilha faz em `AUX!C9`, e a diferença entre os dois é justamente
   * a fonte da divergência entre o número em destaque e a grade de sensibilidade.
   */
  diasEquivalentes: number
  /** Quando a medição deste mês é paga: último dia do mês + defasagem. */
  dataPagamento: string
}

export interface LinhaMensalDaCidade {
  cidadeId: string
  medicaoDoMes: number
  recebimento: number
  descontoConsorcio: number
  imposto: number
  entraNoCaixa: number
  saiDoCaixa: number
  saldoDoMes: number
  /** Caixa acumulado ANTES do recebimento do mês — é dele que sai o capital necessário. */
  acumuladoAntesDoRecebimento: number
  acumuladoDepois: number
}

export interface ColunaMensal {
  mes: MesDoFluxo
  porCidade: LinhaMensalDaCidade[]
  medicaoBruta: number
  recebimento: number
  descontoConsorcio: number
  imposto: number
  entraNoCaixa: number
  saiDoCaixa: number
  saldoDoMes: number
  acumuladoAntesDoRecebimento: number
  acumuladoDepois: number
}

export interface LinhaEconomica {
  mes: MesDoFluxo
  medicaoBruta: number
  imposto: number
  medicaoLiquida: number
  folha: number
  engenheiro: number
  estrutura: number
  indiretos: number
  mobilizacao: number
  resultado: number
  resultadoAcumulado: number
  margem: number
}

export interface CapitalNecessario {
  /** O pior ponto do caixa antes de entrar dinheiro. */
  necessidadeMaxima: number
  contingencia: number
  capitalRecomendado: number
  /** Em que mês o pior ponto acontece — é o que a diretoria precisa saber. */
  mesDoPiorPonto: string | null
}
