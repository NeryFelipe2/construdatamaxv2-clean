/**
 * O mesmo apontamento, vindo de uma planilha em vez do WhatsApp.
 *
 * ─── A DECISÃO QUE GOVERNA ESTE ARQUIVO ───────────────────────────────────────
 * Ele **não interpreta nada**. Monta as mesmas linhas de texto que a pessoa colaria e entrega a
 * `parseApontamentoWcr`. Parece um rodeio, e é de propósito: se a planilha tivesse o seu próprio
 * interpretador, "célula vazia" e "campo vazio no texto" acabariam decididos por códigos
 * diferentes — e um dia um deles viraria zero. Havendo uma função só, os dois caminhos **não
 * conseguem** divergir, e o teste prova isso comparando os dois resultados.
 *
 * ─── A FORMA DA PLANILHA ──────────────────────────────────────────────────────
 * Uma linha por apontamento. Colunas: DATA · EQUIPE · NÚCLEO · IMÓVEIS · OBS · e uma por sigla.
 * O cabeçalho não precisa estar na primeira linha — `acharCabecalhoWcr` varre as primeiras, como
 * o leitor do Controle de Caixa já faz, porque planilha de cliente costuma ter banner em cima.
 */
import { parseApontamentoWcr, normalizarChave, SIGLAS_WCR, type ApontamentoWcr } from './apontamentoWcr'

export type CelulaWcr = string | number | Date | null | undefined
export type MatrizWcr = CelulaWcr[][]

/** Os rótulos de coluna aceitos, além das 13 siglas. */
const COLUNAS_FIXAS: Record<string, string[]> = {
  data:        ['data', 'producao', 'produção', 'dia'],
  equipe:      ['equipe', 'time'],
  nucleo:      ['nucleo', 'núcleo', 'setor'],
  imoveis:     ['imoveis', 'imóveis', 'imovel', 'imóvel', 'enderecos', 'endereços'],
  observacoes: ['obs', 'observacao', 'observação', 'observacoes', 'observações'],
}

export interface CabecalhoWcr {
  /** Índice da linha do cabeçalho na matriz. */
  linha: number
  /** rótulo canônico ou sigla → índice da coluna. */
  mapa: Record<string, number>
}

/**
 * Acha a linha de cabeçalho, pontuando quantas colunas conhecidas ela tem.
 *
 * ⚠️ Varre as primeiras linhas em vez de assumir a primeira porque a planilha do cliente pode ter
 * um banner mesclado em cima — foi exatamente o caso do Controle de Caixa, cujo cabeçalho está na
 * linha 2. Assumir a linha 1 devolveria um mapa vazio e a importação diria "nenhuma coluna
 * reconhecida" num arquivo perfeitamente válido.
 */
export function acharCabecalhoWcr(matriz: MatrizWcr, limite = 10): CabecalhoWcr | null {
  let melhor: CabecalhoWcr | null = null
  let melhorPontos = 0

  for (let i = 0; i < Math.min(limite, matriz.length); i++) {
    const linha = matriz[i]
    if (!Array.isArray(linha)) continue
    const mapa: Record<string, number> = {}

    linha.forEach((celula, col) => {
      if (typeof celula !== 'string') return
      const k = normalizarChave(celula)
      if (!k) return
      for (const [canonico, aliases] of Object.entries(COLUNAS_FIXAS)) {
        if (aliases.some((a) => normalizarChave(a) === k) && mapa[canonico] === undefined) {
          mapa[canonico] = col
          return
        }
      }
      const sigla = SIGLAS_WCR.find((s) => normalizarChave(s.sigla) === k)
      if (sigla && mapa[sigla.sigla] === undefined) mapa[sigla.sigla] = col
    })

    const pontos = Object.keys(mapa).length
    if (pontos > melhorPontos) { melhorPontos = pontos; melhor = { linha: i, mapa } }
  }

  // Menos de duas colunas conhecidas não é cabeçalho — é coincidência.
  return melhorPontos >= 2 ? melhor : null
}

/** Célula → texto, sem inventar. Data do Excel vira dd/MM/yyyy. */
export function textoDaCelula(c: CelulaWcr): string {
  if (c === null || c === undefined) return ''
  if (c instanceof Date) {
    const d = String(c.getUTCDate()).padStart(2, '0')
    const m = String(c.getUTCMonth() + 1).padStart(2, '0')
    return `${d}/${m}/${c.getUTCFullYear()}`
  }
  return String(c).trim()
}

/**
 * Monta o texto do apontamento a partir de uma linha da planilha.
 *
 * ⚠️ Uma sigla cuja coluna existe mas está VAZIA continua sendo escrita ("LA - "), porque no texto
 * colado ela também aparece vazia. É o que mantém "não informado" igual nos dois caminhos. Já uma
 * sigla cuja COLUNA não existe na planilha simplesmente não é escrita — a planilha não fala dela.
 */
export function textoDaLinha(cab: CabecalhoWcr, linha: CelulaWcr[]): string {
  const em = (chave: string) => {
    const col = cab.mapa[chave]
    return col === undefined ? null : textoDaCelula(linha[col])
  }
  const partes: string[] = []

  const data = em('data')
  if (data) partes.push(`Produção - ${data}`)
  const equipe = em('equipe')
  if (equipe) partes.push(`Equipe - ${equipe}`)
  const nucleo = em('nucleo')
  if (nucleo) partes.push(`Núcleo - ${nucleo}`)

  // Vários endereços numa célula só, separados por ; ou quebra de linha.
  const imoveis = em('imoveis')
  if (imoveis) {
    for (const pedaco of imoveis.split(/[;\n]/)) {
      const t = pedaco.trim()
      if (t) partes.push(`Imóvel - ${t}`)
    }
  }

  for (const s of SIGLAS_WCR) {
    if (cab.mapa[s.sigla] === undefined) continue
    partes.push(`${s.sigla} - ${em(s.sigla) ?? ''}`)
  }

  const obs = em('observacoes')
  if (obs) partes.push(`obs: ${obs}`)

  return partes.join('\n')
}

export interface ApontamentoDaPlanilha extends ApontamentoWcr {
  /** Linha da planilha de onde veio (1-indexada, como o Excel mostra). */
  linhaDaPlanilha: number
}

export interface LeituraDaPlanilhaWcr {
  apontamentos: ApontamentoDaPlanilha[]
  /** Problemas que impedem a leitura, em português, para a tela mostrar. */
  problemas: string[]
}

export interface OpcoesDaPlanilhaWcr { hoje?: string }

/**
 * Lê a planilha inteira.
 *
 * Linha sem data é pulada — é linha em branco de grade, não apontamento. Isso é reportado como
 * contagem, não como erro por linha: uma planilha com 200 linhas de grade vazia produziria 200
 * mensagens iguais, e ninguém leria nenhuma.
 */
export function lerPlanilhaWcr(matriz: MatrizWcr, opcoes: OpcoesDaPlanilhaWcr = {}): LeituraDaPlanilhaWcr {
  const cab = acharCabecalhoWcr(matriz)
  if (!cab) {
    return {
      apontamentos: [],
      problemas: ['Não encontrei o cabeçalho. A planilha precisa de uma linha com DATA, EQUIPE, NÚCLEO e as siglas dos serviços.'],
    }
  }

  const apontamentos: ApontamentoDaPlanilha[] = []
  let vazias = 0

  for (let i = cab.linha + 1; i < matriz.length; i++) {
    const linha = matriz[i]
    if (!Array.isArray(linha)) continue
    const texto = textoDaLinha(cab, linha)
    if (!texto.trim()) { vazias += 1; continue }

    const lido = parseApontamentoWcr(texto, { hoje: opcoes.hoje })
    // Sem data não é apontamento: é sobra de grade.
    if (!lido.data && !lido.equipe && lido.linhas.every((l) => l.quantidade === undefined)) {
      vazias += 1
      continue
    }
    apontamentos.push({ ...lido, linhaDaPlanilha: i + 1 })
  }

  const problemas: string[] = []
  if (!apontamentos.length) {
    problemas.push('Achei o cabeçalho, mas nenhuma linha com dado. Confira se as linhas estão abaixo do cabeçalho.')
  }
  if (vazias > 0) problemas.push(`${vazias} linha${vazias > 1 ? 's' : ''} em branco ignorada${vazias > 1 ? 's' : ''}.`)
  return { apontamentos, problemas }
}
