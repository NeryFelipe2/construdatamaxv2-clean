/**
 * O apontamento diário da WCR — colado do WhatsApp, lido aqui.
 *
 * ─── POR QUE ESTE ARQUIVO É PURO ──────────────────────────────────────────────
 * Recebe `string`, devolve dado. Sem navegador, sem store, sem React. É o mesmo desenho de
 * `notaFiscalCupom.ts`, e pelo mesmo motivo: o que decide se "LA - " é zero ou "não informado"
 * precisa caber num teste de mesa, porque errar isso contamina RUP, produção e faturamento sem
 * dar erro nenhum na tela.
 *
 * ─── A REGRA QUE ATRAVESSA O ARQUIVO ──────────────────────────────────────────
 * ⚠️ **Campo vazio é AUSENTE, nunca zero.** No apontamento real a maioria das siglas vem sem
 * número — a equipe só escreve o que fez. Se `PRA - ` virasse `0`, o sistema afirmaria "não
 * produziu nada de rede de água hoje", que é uma afirmação que ninguém fez. `quantidade` é
 * opcional de propósito, e há teste provando que nenhuma linha vazia vira 0.
 *
 * ─── O QUE ESTE ARQUIVO NÃO DECIDE ────────────────────────────────────────────
 * Ele não sabe preço, não sabe obra e não escolhe item de contrato. A sigla `PV` casa com cinco
 * itens diferentes (aduela mecânica, aduela manual, plástico em três profundidades) e o texto
 * colado não diz a profundidade. Quem resolve isso é o de-para, na tela, uma vez por obra.
 */

/** Metro linear ou unidade. É a única coisa que o parser precisa saber de cada sigla. */
export type UnidadeWcr = 'M' | 'UN'

export interface SiglaWcr {
  /** Como aparece no apontamento. */
  sigla: string
  bloco: 'agua' | 'esgoto'
  unidade: UnidadeWcr
  /**
   * Nome por extenso para a tela.
   *
   * ⚠️ A expansão de `PRA`/`PRE` é leitura minha do contexto — o que está CONFERIDO contra o
   * catálogo de serviços é a **unidade** (rede é metro, o resto é unidade), e é só a unidade que
   * o sistema usa para contar. Se o nome estiver errado, conserta-se o rótulo sem mexer em conta.
   */
  rotulo: string
}

/**
 * As 13 siglas do apontamento.
 *
 * ⚠️ `PRA` e `PRE` são METRO; todo o resto é UNIDADE. Essa distinção não é decorativa: somar
 * metro com unidade num total só é exatamente o erro que `somarMetragem` existe para impedir.
 */
export const SIGLAS_WCR: SiglaWcr[] = [
  { sigla: 'PRA',       bloco: 'agua',   unidade: 'M',  rotulo: 'Rede de água' },
  { sigla: 'LA',        bloco: 'agua',   unidade: 'UN', rotulo: 'Ligação de água' },
  { sigla: 'LIA',       bloco: 'agua',   unidade: 'UN', rotulo: 'Ligação intradomiciliar de água' },
  { sigla: 'Caixa UMA', bloco: 'agua',   unidade: 'UN', rotulo: 'Instalação de caixa UMA' },
  { sigla: 'HM',        bloco: 'agua',   unidade: 'UN', rotulo: 'Substituição de hidrômetro' },
  { sigla: 'Interligação', bloco: 'agua', unidade: 'UN', rotulo: 'Interligação' },
  { sigla: 'Válvula',   bloco: 'agua',   unidade: 'UN', rotulo: 'Instalação de válvula' },
  { sigla: 'PRE',       bloco: 'esgoto', unidade: 'M',  rotulo: 'Rede de esgoto' },
  { sigla: 'LE',        bloco: 'esgoto', unidade: 'UN', rotulo: 'Ligação de esgoto' },
  { sigla: 'LIE',       bloco: 'esgoto', unidade: 'UN', rotulo: 'Ligação intradomiciliar de esgoto' },
  { sigla: 'PV',        bloco: 'esgoto', unidade: 'UN', rotulo: 'Poço de visita' },
  { sigla: 'PI',        bloco: 'esgoto', unidade: 'UN', rotulo: 'Poço de inspeção' },
  { sigla: 'CI',        bloco: 'esgoto', unidade: 'UN', rotulo: 'Caixa de inspeção' },
]

export interface LinhaWcrLida {
  /** A sigla canônica (como está em `SIGLAS_WCR`), não como a pessoa digitou. */
  sigla: string
  bloco: 'agua' | 'esgoto'
  unidade: UnidadeWcr
  rotulo: string
  /** ⚠️ AUSENTE quando o campo veio vazio. Nunca 0. */
  quantidade?: number
  /** O que estava escrito depois do traço, cru. A tela mostra isto ao lado do número. */
  bruto: string
}

export interface ApontamentoWcr {
  /** `yyyy-MM-dd`, quando deu para montar. */
  data?: string
  /** O que estava escrito ('31/08'), para a tela poder mostrar os dois. */
  dataBruta?: string
  /** `true` quando o ano não veio no texto e foi deduzido. A tela precisa dizer isso. */
  anoInferido: boolean
  equipe?: string
  nucleo?: string
  /** ⚠️ Lista: "Imóvel" aparece uma vez por endereço e todas contam. */
  imoveis: string[]
  linhas: LinhaWcrLida[]
  observacoes?: string
  /**
   * Toda linha que sobrou.
   *
   * ⚠️ Existe para a tela poder mostrar "não entendi isto". Um parser que descarta em silêncio o
   * que não reconhece ensina a equipe a confiar num resultado incompleto.
   */
  naoEntendidas: string[]
}

/** Sem acento, sem caixa, sem espaço dobrado. */
export function normalizarChave(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const POR_CHAVE = new Map(SIGLAS_WCR.map((s) => [normalizarChave(s.sigla), s]))

/**
 * O título do próprio modelo ("📋 APONTAMENTO DIÁRIO — MODELO").
 *
 * ⚠️ Precisa ser reconhecido e descartado, não ignorado por acaso: o travessão do título casa com
 * o separador de campo, então sem esta regra ele viraria "chave APONTAMENTO DIÁRIO, valor MODELO"
 * e apareceria na tela como linha não entendida — assustando quem colou um texto perfeitamente
 * correto.
 */
function ehTitulo(chaveNormalizada: string): boolean {
  return chaveNormalizada.includes('apontamento diario') || chaveNormalizada.startsWith('apontamento')
}

/** Linhas que são só enfeite (traços, emoji solto) e não devem virar "não entendi". */
function ehDecoracao(linha: string): boolean {
  const semEnfeite = linha.replace(/[\s\u2500-\u257f\u2014\u2013\u00b7\-=_.*]/g, '')
  return semEnfeite.length === 0
}

/**
 * Número em português. `undefined` quando não há número — que é diferente de zero.
 *
 * Aceita "100", "1.234", "12,5". Recusa texto.
 */
export function quantidadeDeTexto(bruto: string): number | undefined {
  const limpo = bruto.trim()
  if (!limpo) return undefined
  if (!/\d/.test(limpo)) return undefined
  // pt-BR: ponto é milhar, vírgula é decimal.
  const normalizado = limpo.replace(/\./g, '').replace(',', '.')
  const soNumero = normalizado.match(/-?\d+(?:\.\d+)?/)
  if (!soNumero) return undefined
  const n = Number(soNumero[0])
  return Number.isFinite(n) ? n : undefined
}

/**
 * A data do apontamento, que vem sem ano ("31/08").
 *
 * ⚠️ A regra: assume o ano corrente; se isso jogar a data mais de 3 meses no FUTURO, usa o ano
 * anterior. É o caso de virada de ano — um apontamento de 28/12 lançado em 03/01 é do ano passado,
 * e assumir o corrente o mandaria para daqui a quase um ano.
 *
 * O que a regra NÃO resolve: apontamento antigo, de mais de um ano. Por isso `anoInferido` viaja
 * junto e a tela mostra a data cheia para conferência.
 */
export function completarAno(diaMes: string, hojeISO: string): { data?: string; inferido: boolean } {
  const m = diaMes.trim().match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/)
  if (!m) return { inferido: false }
  const dia = Number(m[1])
  const mes = Number(m[2])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return { inferido: false }

  const montar = (ano: number) =>
    `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

  if (m[3]) {
    const bruto = Number(m[3])
    const ano = m[3].length === 2 ? 2000 + bruto : bruto
    return { data: montar(ano), inferido: false }
  }

  const anoDeHoje = Number(hojeISO.slice(0, 4))
  const candidata = montar(anoDeHoje)
  // 3 meses à frente em dias corridos; não precisa de precisão de calendário para este corte.
  const limite = new Date(`${hojeISO}T00:00:00Z`)
  limite.setUTCDate(limite.getUTCDate() + 92)
  const limiteISO = limite.toISOString().slice(0, 10)
  if (candidata > limiteISO) return { data: montar(anoDeHoje - 1), inferido: true }
  return { data: candidata, inferido: true }
}

const CHAVE_DATA   = new Set(['producao', 'produção', 'data', 'dia'].map(normalizarChave))
const CHAVE_EQUIPE = new Set(['equipe', 'time'].map(normalizarChave))
const CHAVE_NUCLEO = new Set(['nucleo', 'núcleo', 'setor'].map(normalizarChave))
const CHAVE_IMOVEL = new Set(['imovel', 'imóvel', 'endereco', 'endereço', 'rua'].map(normalizarChave))
const CHAVE_OBS    = new Set(['obs', 'observacao', 'observação', 'observacoes', 'observações'].map(normalizarChave))

/**
 * Separa "chave - valor" e "chave: valor".
 *
 * ⚠️ O apontamento da WCR usa " - ", e TODOS os parsers que já existiam no projeto exigiam ":".
 * Era por isso que nenhum deles servia. O corte é no PRIMEIRO separador, para um endereço com
 * traço no meio ("Rua X - Fundos") não perder o resto.
 */
function separar(linha: string): { chave: string; valor: string } | null {
  const m = linha.match(/^\s*([^:\-–—]+?)\s*[:\-–—]\s*(.*)$/)
  if (!m) return null
  return { chave: m[1].trim(), valor: m[2].trim() }
}

export interface OpcoesDoApontamento {
  /** `yyyy-MM-dd`. Injetado para o teste não depender do relógio. */
  hoje?: string
}

/**
 * Lê o apontamento colado.
 *
 * O reconhecimento é por LISTA BRANCA: só vira dado o que casa com uma chave conhecida ou com uma
 * das 13 siglas. Todo o resto cai em `naoEntendidas` e aparece na tela. Assim o título com emoji,
 * a linha de traços e qualquer coisa nova não viram campo fantasma.
 */
export function parseApontamentoWcr(texto: string, opcoes: OpcoesDoApontamento = {}): ApontamentoWcr {
  const hoje = opcoes.hoje ?? new Date().toISOString().slice(0, 10)
  const out: ApontamentoWcr = { anoInferido: false, imoveis: [], linhas: [], naoEntendidas: [] }
  if (!texto) return out

  let bloco: 'agua' | 'esgoto' | null = null
  let coletandoObs = false
  const obs: string[] = []

  for (const cru of texto.split(/\r?\n/)) {
    const linha = cru.trim()
    if (!linha || ehDecoracao(linha)) continue

    const chaveNorm = normalizarChave(linha)
    if (ehTitulo(chaveNorm)) continue

    // Cabeçalhos de bloco trocam o contexto das siglas seguintes.
    if (/^servico agua|^servicos agua/.test(chaveNorm)) { bloco = 'agua';   coletandoObs = false; continue }
    if (/^servico esgoto|^servicos esgoto/.test(chaveNorm)) { bloco = 'esgoto'; coletandoObs = false; continue }

    const par = separar(linha)

    if (par) {
      const k = normalizarChave(par.chave)

      if (CHAVE_OBS.has(k)) { coletandoObs = true; if (par.valor) obs.push(par.valor); continue }
      coletandoObs = false

      if (CHAVE_DATA.has(k)) {
        out.dataBruta = par.valor
        const r = completarAno(par.valor, hoje)
        if (r.data) { out.data = r.data; out.anoInferido = r.inferido }
        else if (par.valor) out.naoEntendidas.push(linha)
        continue
      }
      if (CHAVE_EQUIPE.has(k)) { if (par.valor) out.equipe = par.valor; continue }
      if (CHAVE_NUCLEO.has(k)) { if (par.valor) out.nucleo = par.valor; continue }
      // ⚠️ acumula: "Imóvel" repete uma vez por endereço.
      if (CHAVE_IMOVEL.has(k)) { if (par.valor) out.imoveis.push(par.valor); continue }

      const def = POR_CHAVE.get(k)
      if (def) {
        out.linhas.push({
          sigla: def.sigla,
          // A sigla manda no bloco: uma seção escrita errado não muda o que "LE" é.
          bloco: def.bloco,
          unidade: def.unidade,
          rotulo: def.rotulo,
          quantidade: quantidadeDeTexto(par.valor),
          bruto: par.valor,
        })
        continue
      }

      out.naoEntendidas.push(linha)
      continue
    }

    if (coletandoObs) { obs.push(linha); continue }
    out.naoEntendidas.push(linha)
  }

  // `bloco` guia a leitura mas não é gravado: a sigla já carrega o seu.
  void bloco
  if (obs.length) out.observacoes = obs.join('\n')
  return out
}

/**
 * O que dá para contar, separado por unidade.
 *
 * ⚠️ Metro e unidade voltam em campos DIFERENTES, de propósito. Somar os dois num total só é o
 * erro que este projeto já documentou em `somarMetragem`: "nunca some unidades de tipos
 * diferentes". `semMedida` conta as siglas que apareceram sem número — que não são zero.
 */
/**
 * Corta o texto colado antes de ele virar campo do RDO.
 *
 * ⚠️ O apontamento real tem ~500 bytes, mas nada impede alguém de colar um documento inteiro. O
 * `payload` do RDO viaja para o servidor a cada gravação E volta em cada `pull()` — um texto de
 * 100 KB por RDO multiplicado por meses de obra deixa de ser detalhe. Guardar só o começo preserva
 * o que a prova serve para provar (o que a máquina leu) sem carregar o resto para sempre.
 */
export const LIMITE_TEXTO_ORIGINAL = 4000

export function limitarTextoOriginal(texto: string): string {
  if (texto.length <= LIMITE_TEXTO_ORIGINAL) return texto
  return `${texto.slice(0, LIMITE_TEXTO_ORIGINAL)}\n[...] texto cortado em ${LIMITE_TEXTO_ORIGINAL} caracteres`
}

export interface ResumoWcr { unidades: number; metros: number; semMedida: number }

export function resumirApontamento(a: Pick<ApontamentoWcr, 'linhas'>): ResumoWcr {
  let unidades = 0
  let metros = 0
  let semMedida = 0
  for (const l of a.linhas) {
    if (l.quantidade === undefined) { semMedida += 1; continue }
    if (l.unidade === 'M') metros += l.quantidade
    else unidades += l.quantidade
  }
  return { unidades, metros, semMedida }
}
