/**
 * A planilha do cliente, como dado.
 *
 * ⚠️ Isto NÃO é dado de demonstração e não entra em tela nenhuma: é a fonte dos testes do motor.
 * Cada número veio de `docs/FLUXO_CAIXA_PROJETADO_BERTIOGA_SANTOS_v2.xlsx`, conferido célula a
 * célula. É o que permite dizer "o motor reproduz a planilha" com prova, em vez de com fé.
 */
import type { PremissasFcp, PessoaDoQuadro } from './tipos'

const p = (equipe: string, nome: string, cargo: string, salario: number, encargos: number, beneficios = 1679): PessoaDoQuadro =>
  ({ equipe, nome, cargo, salario, encargos, beneficios })

/** `CUSTOS BERTIOGA!B7:H21` — 15 pessoas, R$ 106.692,84/mês. */
const QUADRO_BERTIOGA: PessoaDoQuadro[] = [
  p('A', 'Funcionário 01', 'Ajudante Geral', 2951, 1712),
  p('A', 'Funcionário 02', 'Encanador Motorista', 3932, 2281),
  p('A', 'Funcionário 03', 'Ajudante Geral', 2951, 1712),
  p('B', 'Funcionário 04', 'Líder de Equipe', 3908, 2267),
  p('B', 'Funcionário 05', 'Ajudante Geral', 2951, 1712),
  p('B', 'Funcionário 06', 'Encanador', 3633, 2107),
  p('C', 'Funcionário 07', 'Ajudante Geral', 2951, 1712),
  p('C', 'Funcionário 08', 'Encanador', 3633, 2107),
  p('C', 'Funcionário 09', 'Ajudante Geral', 2951, 1712),
  p('C', 'Funcionário 10', 'Operador de Retro', 3947, 2289),
  p('D', 'Funcionário 11', 'Ajudante Geral', 2951, 1712),
  p('D', 'Funcionário 12', 'Encanador Motorista', 3932, 2281),
  p('D', 'Funcionário 13', 'Encanador', 3633, 2107),
  p('—', 'Funcionário 14', 'Programador', 2548, 1477.84),
  p('—', 'Funcionário 15', 'Encarregado de Obra', 4713, 2734),
]

/** `CUSTOS BERTIOGA!B26:F34`. O kit ferramenta segue como custo MENSAL, como na planilha. */
const GERAIS_BERTIOGA = [
  { item: 'Salário engenheiro',     quantidade: 1, valorUnitario: 13000, bloco: 'engenheiro' as const },
  { item: 'Kit ferramenta equipes', quantidade: 4, valorUnitario: 7200,  bloco: 'estrutura' as const },
  { item: 'Carro engenheiro',       quantidade: 1, valorUnitario: 3400,  bloco: 'estrutura' as const },
  { item: 'Carro encarregado',      quantidade: 1, valorUnitario: 3500,  bloco: 'estrutura' as const },
  { item: 'Caminhão 3/4 + munck',   quantidade: 1, valorUnitario: 25000, bloco: 'estrutura' as const },
  { item: 'HR caminhão tipo HR',    quantidade: 3, valorUnitario: 3500,  bloco: 'estrutura' as const },
  { item: 'Alojamento',             quantidade: 1, valorUnitario: 13500, bloco: 'estrutura' as const },
  { item: 'Equipamentos leves',     quantidade: 1, valorUnitario: 12900, bloco: 'estrutura' as const },
  { item: 'Custos indiretos',       quantidade: 1, valorUnitario: 20000, bloco: 'indiretos' as const },
]

/**
 * Santos: a folha é R$ 120.061,48 e o custo mensal R$ 269.561,48 (`PREMISSAS!C29`).
 *
 * ⚠️ O quadro nominal de Santos não está aberto na planilha — só o total. Represento como UMA
 * linha com o total, e a tela diz isso: fingir 16 pessoas seria inventar gente.
 */
const QUADRO_SANTOS: PessoaDoQuadro[] = [
  { nome: 'Equipe de Santos (total da folha)', cargo: 'quadro não detalhado na planilha', salario: 120061.48, encargos: 0, beneficios: 0 },
]

const GERAIS_SANTOS = [
  { item: 'Salário engenheiro',     quantidade: 1, valorUnitario: 13000, bloco: 'engenheiro' as const },
  { item: 'Estrutura e locações',   quantidade: 1, valorUnitario: 116500, bloco: 'estrutura' as const },
  { item: 'Custos indiretos',       quantidade: 1, valorUnitario: 20000, bloco: 'indiretos' as const },
]

export const BERTIOGA_SANTOS: PremissasFcp = {
  inicioObra: '2026-08-24',
  fimOperacao: '2027-07-31',
  diasPorMes: 30,
  defasagemDias: 20,
  imposto: 0.22,

  cenario: 'OTIMA',
  margens: { MINIMA: 0, MEDIA: 0.10, BOA: 0.15, OTIMA: 0.20 },

  contingencia: 0.15,
  fatorPrimeiroMes: 0.5,

  regime: {
    folha: 'CONSORCIO',
    engenheiro: 'CONSORCIO',
    estrutura: 'CONSORCIO',
    indiretos: 'EMPRESA',
    mobilizacao: 'CONSORCIO',
  },
  consorcioDescontaDaMedicao: true,
  baseDoImposto: 'CHEIA',

  cidades: [
    {
      id: 'bertioga', nome: 'Bertioga',
      ticket: 881.20,
      mobilizacao: 13360,
      custos: { quadro: QUADRO_BERTIOGA, gerais: GERAIS_BERTIOGA },
    },
    {
      id: 'santos', nome: 'Santos',
      ticket: 0,
      mix: { rotuloA: 'Água', ticketA: 821.25, rotuloB: 'Esgoto', ticketB: 1856.40, fracaoB: 0.5 },
      mobilizacao: 13360,
      custos: { quadro: QUADRO_SANTOS, gerais: GERAIS_SANTOS },
    },
  ],
}
