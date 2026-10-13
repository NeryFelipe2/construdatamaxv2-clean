/**
 * A planilha de Controle de Caixa, lida pelo sistema.
 *
 * ⚠️ REGRA DO CLIENTE, e é ela que decide todo o desenho: **a via principal de lançamento é a
 * planilha.** A equipe mexe no arquivo o mês inteiro e joga no sistema várias vezes; a tela existe
 * para corrigir ponto fora da curva, não para digitar. Logo o problema central não é "importar" —
 * é **reimportar sem duplicar**.
 *
 * Este arquivo é a parte pura: recebe linhas já extraídas do Excel (matriz de células) e devolve
 * lançamentos com identidade estável. Quem abre o arquivo é o adaptador, para que tudo aqui possa
 * ser testado sem navegador.
 *
 * A planilha real (docs/CONTROLE DE CAIXA-MODELO.xlsx) tem duas abas e nenhuma coluna de
 * identificador — foi ela que ditou cada decisão abaixo.
 */

// ─── Normalização ─────────────────────────────────────────────────────────────

/** Maiúsculas, sem acento, sem espaço dobrado. É a base de toda comparação. */
export function normalizarTexto(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Datas ────────────────────────────────────────────────────────────────────

const MS_DIA = 86400000
/** O dia 0 do Excel é 30/12/1899 — o "bug do ano bissexto de 1900" já embutido. */
const EPOCA_EXCEL = Date.UTC(1899, 11, 30)

function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export interface PeriodoLido {
  /** Sempre preenchida: o começo. Um dia só tem `data` e `dataFim` iguais a ela. */
  data: string
  /** Só existe quando a célula descrevia um intervalo. */
  dataFim?: string
}

/**
 * Lê a data em todas as formas que a planilha do cliente realmente usa.
 *
 * ⚠️ `01 A 10/07/2026` é um caso REAL (linha 12 da planilha) — uma despesa que cobre dez dias.
 * Recusar a linha perderia o lançamento; achatar para um dia só mentiria sobre o período. Vira
 * intervalo, com começo e fim.
 */
export function lerData(v: unknown): PeriodoLido | null {
  if (v === null || v === undefined || v === '') return null

  // Objeto Date — é o que a biblioteca de xlsx devolve para célula formatada como data.
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return { data: iso(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()))) }
  }

  // Número — o serial do Excel. Só aceita a faixa plausível (1990–2100); fora dela é valor solto
  // numa coluna de data, e chutar uma data a partir dele seria inventar dado.
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v < 32874 || v > 73415) return null
    return { data: iso(new Date(EPOCA_EXCEL + Math.floor(v) * MS_DIA)) }
  }

  const s = normalizarTexto(v)
  if (!s) return null

  // Intervalo: "01 A 10/07/2026" — o mês e o ano valem para as duas pontas.
  const intervalo = /^(\d{1,2})\s*(?:A|ATE|-|ATÉ)\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})$/.exec(s)
  if (intervalo) {
    const [, d1, d2, m, a] = intervalo
    const ini = montar(d1, m, a)
    const fim = montar(d2, m, a)
    if (!ini || !fim) return null
    // Intervalo que vira ao contrário (ex.: "28 A 03/07") atravessa o mês. Sem o mês da outra ponta
    // escrito na célula, adivinhar seria inventar — devolve só o começo.
    if (fim < ini) return { data: ini }
    return { data: ini, dataFim: fim }
  }

  // Dia único: "06/07/2026" ou "6/7/26".
  const dia = /^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})$/.exec(s)
  if (dia) {
    const d = montar(dia[1], dia[2], dia[3])
    return d ? { data: d } : null
  }

  // ISO, que é o que o próprio sistema escreve ao exportar o modelo de volta.
  const isoDireto = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (isoDireto) {
    const d = montar(isoDireto[3], isoDireto[2], isoDireto[1])
    return d ? { data: d } : null
  }

  return null
}

function montar(d: string, m: string, a: string): string | null {
  const dia = Number(d)
  const mes = Number(m)
  let ano = Number(a)
  if (!Number.isInteger(dia) || !Number.isInteger(mes) || !Number.isInteger(ano)) return null
  if (ano < 100) ano += ano < 70 ? 2000 : 1900
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  // Pega 31/02: o Date rola para março e o dia deixa de bater.
  if (data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null
  return iso(data)
}

// ─── Valores ──────────────────────────────────────────────────────────────────

/**
 * Lê valor em real. Aceita número puro e as duas escritas que aparecem quando alguém digita:
 * `1.234,56` (brasileira) e `1234.56`.
 */
export function lerValor(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (v === null || v === undefined) return null

  let s = String(v).replace(/\s/g, '').replace(/R\$/gi, '')
  if (!s) return null

  const negativoPorParenteses = /^\((.*)\)$/.exec(s)
  if (negativoPorParenteses) s = `-${negativoPorParenteses[1]}`

  const temVirgula = s.includes(',')
  const temPonto = s.includes('.')
  if (temVirgula && temPonto) {
    // O separador decimal é o ÚLTIMO que aparece; o outro é milhar.
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (temVirgula) {
    s = s.replace(',', '.')
  }
  // Ponto sozinho fica como está: "1.234" é ambíguo, mas em planilha de caixa quem digita ponto
  // como milhar quase sempre digita a vírgula decimal junto — e esse caso já foi tratado acima.

  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// ─── Solicitantes ─────────────────────────────────────────────────────────────

/**
 * Um lançamento pode ter mais de um solicitante.
 *
 * ⚠️ Caso REAL da planilha: `PESSOA F/PESSOA A`, `PESSOA I/PESSOA A`, `PESSOA F/PESSOA E` e
 * `PESSOA I / PESSOA R` — este último com espaço dos dois lados da barra. Guardar como texto único
 * faria o relatório por solicitante criar uma pessoa chamada "Damião/Wellington".
 */
export function separarSolicitantes(v: unknown): string[] {
  const bruto = String(v ?? '').trim()
  if (!bruto) return []
  return bruto
    .split(/\s*[/;]\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
}

// ─── O que se lê de cada linha ────────────────────────────────────────────────

export type TipoLancamento = 'receita' | 'despesa'

export interface LinhaLida {
  /** Vem preenchido quando a planilha é a que o sistema gerou (coluna ID). */
  idExterno?: string
  tipo: TipoLancamento
  descricao: string
  valor: number
  data: string
  dataFim?: string
  solicitantes: string[]
  categoria?: string
  obra?: string
  conferido: boolean
  /** Linha do arquivo, 1-based. Só para a conferência apontar onde está o problema. */
  linha: number
  /** Identidade por conteúdo, já com o desempate por ocorrência. */
  chave: string
}

export interface ProblemaNaLinha {
  linha: number
  coluna?: string
  motivo: string
  /** O que estava escrito, para a pessoa achar na planilha dela. */
  conteudo?: string
}

export interface LeituraDeCaixa {
  lancamentos: LinhaLida[]
  problemas: ProblemaNaLinha[]
  /** Totais que a própria planilha declara, quando ela traz linha de TOTAIS/SALDO. */
  totaisDeclarados: { receitas?: number; despesas?: number; saldo?: number } | null
}

/**
 * A identidade de um lançamento sem coluna de ID.
 *
 * ⚠️ **O valor e o solicitante NÃO entram na chave, e isso é o ponto.** Eles são justamente os
 * campos que a pessoa corrige durante o mês. Se entrassem, corrigir R$ 1.000 para R$ 1.500 não
 * seria "valor alterado": seria uma linha nova mais uma linha "sumiu" — o oposto do que a
 * conferência precisa mostrar. O que identifica é o que a pessoa NÃO costuma mexer: tipo, data e
 * descrição.
 *
 * ⚠️ E o desempate por **ordem de aparição** é obrigatório: duas linhas da planilha real são
 * idênticas em tudo (`UBER EQUIPE PESSOA B - MORRO DOCE PARA CANTEIRO`, 17/07/2026, mesmo valor,
 * mesmo solicitante). São dois Ubers de verdade. Sem a ordem, a segunda viraria cópia da primeira
 * e o gasto sumiria da conta.
 *
 * O preço disso é conhecido: mudar a DESCRIÇÃO ou a DATA de uma linha existente cria uma linha
 * nova e aponta a antiga como sumida. É por isso que o modelo que o sistema gera leva coluna de
 * ID — com ela o casamento é exato e nem a descrição nem a ordem importam mais.
 */
export function chaveDeConteudo(
  l: { tipo: TipoLancamento; data: string; descricao: string },
  ocorrencia: number,
): string {
  return `${l.tipo}|${l.data}|${normalizarTexto(l.descricao)}#${ocorrencia}`
}

// ─── Leitura da aba de lançamentos ────────────────────────────────────────────

export type Celula = string | number | Date | null | undefined
export type Matriz = Celula[][]

/**
 * Nomes de coluna que reconhecemos, por campo. A comparação é normalizada, então acento e caixa
 * não importam — e o modelo que o sistema gera usa exatamente o primeiro nome de cada lista.
 */
const CABECALHOS: Record<string, string[]> = {
  id:          ['ID', 'IDENTIFICADOR', 'CODIGO'],
  entrada:     ['ENTRADA', 'RECEITA', 'VALOR RECEITA', 'VALOR DA ENTRADA'],
  dataEntrada: ['DATA', 'DATA DA ENTRADA', 'DATA RECEITA'],
  descricao:   ['DESCRICAO', 'HISTORICO', 'DESCRICAO DA DESPESA'],
  valor:       ['VALOR', 'VALOR DA DESPESA', 'DESPESA'],
  dataDespesa: ['DATA DA DESPESA', 'DATA DESPESA', 'DATA DO PAGAMENTO'],
  solicitante: ['SOLICITANTE', 'SOLICITANTES', 'RESPONSAVEL'],
  conferido:   ['CONFERIDO', 'STATUS', 'SITUACAO'],
  categoria:   ['CATEGORIA', 'CLASSIFICACAO'],
  obra:        ['OBRA', 'CENTRO DE CUSTO'],
}

export interface MapaDeColunas { [campo: string]: number }

/**
 * Acha a linha de cabeçalho e mapeia campo → índice de coluna.
 *
 * ⚠️ Não assume que o cabeçalho é a primeira linha: na planilha do cliente a linha 1 traz só os
 * rótulos de bloco ("RECEITAS", "DESPESAS") e o cabeçalho de verdade está na **linha 2**.
 */
export function acharCabecalho(matriz: Matriz, limite = 10): { linha: number; mapa: MapaDeColunas } | null {
  let melhor: { linha: number; mapa: MapaDeColunas; pontos: number } | null = null

  for (let i = 0; i < Math.min(matriz.length, limite); i++) {
    const mapa: MapaDeColunas = {}
    const celulas = matriz[i] ?? []
    for (let c = 0; c < celulas.length; c++) {
      const texto = normalizarTexto(celulas[c])
      if (!texto) continue
      for (const [campo, nomes] of Object.entries(CABECALHOS)) {
        if (mapa[campo] !== undefined) continue
        if (nomes.includes(texto)) { mapa[campo] = c; break }
      }
    }
    // Só vale como cabeçalho se der para montar um lançamento: descrição + valor, ou entrada.
    const pontos = Object.keys(mapa).length
    const serve = (mapa.descricao !== undefined && mapa.valor !== undefined) || mapa.entrada !== undefined
    if (serve && (!melhor || pontos > melhor.pontos)) melhor = { linha: i, mapa, pontos }
  }
  if (!melhor) return null

  // ⚠️ Na planilha do cliente a coluna de "Conferido" NÃO TEM CABEÇALHO: os 106 status estão na
  // coluna G e a célula G2 está vazia. Sem esta busca por conteúdo, a primeira importação jogaria
  // fora a conferência inteira — que é trabalho que alguém já fez, linha por linha.
  if (melhor.mapa.conferido === undefined) {
    const achada = acharColunaDeStatusSemCabecalho(matriz, melhor.linha, melhor.mapa)
    if (achada !== null) melhor.mapa.conferido = achada
  }
  return { linha: melhor.linha, mapa: melhor.mapa }
}

/** O vocabulário que conta como "esta linha já foi conferida". */
const MARCAS_DE_CONFERIDO = new Set(['CONFERIDO', 'OK', 'SIM', 'X', 'PG', 'PAGO', 'CONFERIDA'])

/**
 * Procura uma coluna sem cabeçalho cujo conteúdo seja, na maioria, marca de conferência.
 *
 * Exige 80% para não sequestrar uma coluna de observações que por acaso tenha um "OK" solto, e
 * ignora colunas já mapeadas para não roubar a de outro campo.
 */
function acharColunaDeStatusSemCabecalho(matriz: Matriz, linhaCabecalho: number, mapa: MapaDeColunas): number | null {
  const ocupadas = new Set(Object.values(mapa))
  const largura = Math.max(...matriz.slice(0, linhaCabecalho + 30).map((l) => l?.length ?? 0), 0)

  for (let c = 0; c < largura; c++) {
    if (ocupadas.has(c)) continue
    if (normalizarTexto(matriz[linhaCabecalho]?.[c])) continue // tem cabeçalho, e não é de status

    let marcas = 0
    let preenchidas = 0
    for (let i = linhaCabecalho + 1; i < matriz.length; i++) {
      const texto = normalizarTexto(matriz[i]?.[c])
      if (!texto) continue
      preenchidas++
      if (MARCAS_DE_CONFERIDO.has(texto)) marcas++
    }
    if (preenchidas >= 3 && marcas / preenchidas >= 0.8) return c
  }
  return null
}

/** Reconhece a linha de fechamento, que não é lançamento nenhum. */
function ehLinhaDeTotais(celulas: Celula[]): boolean {
  return celulas.some((c) => /^(SALDO|TOTAIS?|TOTAL)\b/.test(normalizarTexto(c).replace(/[=>]+$/, '').trim()))
}

/**
 * O saldo é o primeiro número DEPOIS da célula que diz "SALDO".
 *
 * ⚠️ Não é "o número negativo da linha". Era assim, e estava errado: funcionava só porque o saldo
 * do arquivo do cliente é −88.000. Uma empresa com saldo positivo teria o fechamento descartado em
 * silêncio, e a conferência contra o rodapé nunca acusaria nada.
 *
 * A posição também não é fixa: na planilha real o rótulo cai na coluna DATA DA DESPESA e o valor
 * na de SOLICITANTE, porque a pessoa escreveu onde tinha espaço.
 */
function saldoDaLinhaDeTotais(celulas: Celula[]): number | undefined {
  const rotulo = celulas.findIndex((c) => /^SALDO\b/.test(normalizarTexto(c).replace(/[=>]+$/, '').trim()))
  if (rotulo < 0) return undefined
  for (let i = rotulo + 1; i < celulas.length; i++) {
    const v = lerValor(celulas[i])
    if (v !== null) return v
  }
  return undefined
}

/**
 * Lê a aba de lançamentos.
 *
 * A planilha do cliente tem **dois blocos lado a lado na mesma linha**: receitas em A–B e despesas
 * em C–G. Uma linha pode ter os dois, um, ou nenhum — e é por isso que cada bloco é lido de forma
 * independente em vez de "uma linha, um lançamento".
 */
export function lerLancamentos(matriz: Matriz): LeituraDeCaixa {
  const problemas: ProblemaNaLinha[] = []
  const lancamentos: LinhaLida[] = []
  let totaisDeclarados: LeituraDeCaixa['totaisDeclarados'] = null

  const cabecalho = acharCabecalho(matriz)
  if (!cabecalho) {
    return {
      lancamentos: [],
      problemas: [{
        linha: 1,
        motivo: 'Não encontrei o cabeçalho. A planilha precisa ter as colunas DESCRIÇÃO e VALOR, ou ENTRADA.',
      }],
      totaisDeclarados: null,
    }
  }

  const { mapa } = cabecalho
  const ocorrencias = new Map<string, number>()
  /** Última data vista no bloco de despesas, para a linha que herda a data de cima. */
  let ultimaDataDespesa: PeriodoLido | null = null

  const celula = (linha: Celula[], campo: string): Celula =>
    mapa[campo] === undefined ? null : linha[mapa[campo]]

  for (let i = cabecalho.linha + 1; i < matriz.length; i++) {
    const linha = matriz[i] ?? []
    const numeroDaLinha = i + 1
    if (linha.every((c) => c === null || c === undefined || c === '')) continue

    if (ehLinhaDeTotais(linha)) {
      // ⚠️ Na planilha real o SALDO cai na coluna do SOLICITANTE. Ler essa linha como lançamento
      // criaria um solicitante chamado "-88000". Ela é lida como fechamento e conferida depois.
      totaisDeclarados = {
        receitas: lerValor(celula(linha, 'entrada')) ?? undefined,
        despesas: lerValor(celula(linha, 'valor')) ?? undefined,
        saldo: saldoDaLinhaDeTotais(linha),
      }
      continue
    }

    const idExterno = String(celula(linha, 'id') ?? '').trim() || undefined
    const conferido = MARCAS_DE_CONFERIDO.has(normalizarTexto(celula(linha, 'conferido')))
    const categoria = String(celula(linha, 'categoria') ?? '').trim() || undefined
    const obra = String(celula(linha, 'obra') ?? '').trim() || undefined

    /**
     * ⚠️ A LINHA COM OS DOIS BLOCOS — e a regra que o resto desta função depende.
     *
     * As colunas DESCRIÇÃO, ID, CATEGORIA, OBRA e CONFERIDO são **compartilhadas** pelos dois
     * blocos: existe uma só de cada por linha. No modelo que o sistema gera isso é inofensivo,
     * porque lá cada linha tem UM lançamento — a descrição na coluna D é dele, seja receita ou
     * despesa, e é isso que faz a ida-e-volta fechar.
     *
     * No arquivo que a equipe monta à mão, não. Ali receita e despesa coincidem na mesma linha
     * por acaso — só porque alguém digitou assim. Medido no arquivo real: as 9 receitas dividem
     * linha com uma despesa, e ZERO estão sozinhas. Lendo a coluna D para as duas, a receita de
     * R$ 2.000 virava "CONSERTO DE 2 PNEUS DA RETRO", que é a despesa da vizinha.
     *
     * A regra: **com os dois blocos, o que é compartilhado é da DESPESA.** Ela é quem tem
     * descrição obrigatória; a receita naquele layout não tem nenhuma.
     *
     * ⚠️ E o `idExterno` importa mais do que parece: `addEntry` é upsert por id, então dar o
     * mesmo id aos dois faria **um apagar o outro** — em silêncio. Hoje é latente (o arquivo do
     * cliente não tem coluna ID), mas basta preencher o modelo com os dois na mesma linha.
     */
    const temReceita = (() => { const v = lerValor(celula(linha, 'entrada')); return v !== null && v !== 0 })()
    const temDespesa = (() => { const v = lerValor(celula(linha, 'valor')); return v !== null && v !== 0 })()
    const compartilhadoEhDaDespesa = temReceita && temDespesa

    // ── bloco de RECEITA ──
    const valorEntrada = lerValor(celula(linha, 'entrada'))
    if (valorEntrada !== null && valorEntrada !== 0) {
      const p = lerData(celula(linha, 'dataEntrada'))
      if (!p) {
        problemas.push({
          linha: numeroDaLinha, coluna: 'DATA',
          motivo: 'Receita sem data legível — a entrada não entra no fluxo de caixa sem saber quando foi.',
          conteudo: String(celula(linha, 'dataEntrada') ?? ''),
        })
      } else {
        const descricaoDaReceita = compartilhadoEhDaDespesa
          ? ''
          : String(celula(linha, 'descricao') ?? '').trim()

        if (!descricaoDaReceita) {
          // Não inventa e não cala: a tela pede a descrição em vez de fabricar uma.
          problemas.push({
            linha: numeroDaLinha, coluna: 'DESCRIÇÃO',
            motivo: compartilhadoEhDaDespesa
              ? 'Receita sem descrição própria — nesta linha a coluna DESCRIÇÃO é da despesa. Escreva a receita numa linha só dela, ou preencha a descrição.'
              : 'Receita sem descrição — não dá para conferir depois de onde veio o dinheiro.',
          })
        }

        lancamentos.push(montarLinha({
          idExterno: compartilhadoEhDaDespesa ? undefined : idExterno,
          tipo: 'receita',
          descricao: descricaoDaReceita || 'Entrada',
          valor: valorEntrada, periodo: p, solicitantes: [],
          categoria: compartilhadoEhDaDespesa ? undefined : categoria,
          obra: compartilhadoEhDaDespesa ? undefined : obra,
          conferido: compartilhadoEhDaDespesa ? false : conferido,
          linha: numeroDaLinha, ocorrencias,
        }))
      }
    }

    // ── bloco de DESPESA ──
    const valorDespesa = lerValor(celula(linha, 'valor'))
    const descricao = String(celula(linha, 'descricao') ?? '').trim()
    if (valorDespesa !== null && valorDespesa !== 0) {
      if (!descricao) {
        problemas.push({
          linha: numeroDaLinha, coluna: 'DESCRIÇÃO',
          motivo: 'Despesa sem descrição — não dá para conferir depois o que foi pago.',
        })
      } else {
        let p = lerData(celula(linha, 'dataDespesa'))
        if (!p) {
          const bruto = String(celula(linha, 'dataDespesa') ?? '').trim()
          if (bruto) {
            problemas.push({
              linha: numeroDaLinha, coluna: 'DATA DA DESPESA',
              motivo: 'Data não reconhecida.', conteudo: bruto,
            })
          } else if (ultimaDataDespesa) {
            // Célula vazia herda a data da linha de cima — é como a planilha é preenchida quando
            // várias despesas caem no mesmo dia.
            p = ultimaDataDespesa
          } else {
            problemas.push({
              linha: numeroDaLinha, coluna: 'DATA DA DESPESA',
              motivo: 'Despesa sem data e sem linha anterior de onde herdar.',
            })
          }
        }
        if (p) {
          ultimaDataDespesa = p
          lancamentos.push(montarLinha({
            idExterno, tipo: 'despesa', descricao, valor: Math.abs(valorDespesa), periodo: p,
            solicitantes: separarSolicitantes(celula(linha, 'solicitante')),
            categoria, obra, conferido, linha: numeroDaLinha, ocorrencias,
          }))
        }
      }
    } else if (descricao && valorDespesa === null && String(celula(linha, 'valor') ?? '').trim()) {
      problemas.push({
        linha: numeroDaLinha, coluna: 'VALOR',
        motivo: 'Valor não numérico.', conteudo: String(celula(linha, 'valor') ?? ''),
      })
    }
  }

  return { lancamentos, problemas, totaisDeclarados }
}

function montarLinha(a: {
  idExterno?: string
  tipo: TipoLancamento
  descricao: string
  valor: number
  periodo: PeriodoLido
  solicitantes: string[]
  categoria?: string
  obra?: string
  conferido: boolean
  linha: number
  ocorrencias: Map<string, number>
}): LinhaLida {
  const base = { tipo: a.tipo, data: a.periodo.data, descricao: a.descricao }
  const semOrdem = chaveDeConteudo(base, 0).replace(/#0$/, '')
  const n = (a.ocorrencias.get(semOrdem) ?? 0) + 1
  a.ocorrencias.set(semOrdem, n)

  return {
    idExterno: a.idExterno,
    tipo: a.tipo,
    descricao: a.descricao,
    valor: a.valor,
    data: a.periodo.data,
    dataFim: a.periodo.dataFim,
    solicitantes: a.solicitantes,
    categoria: a.categoria,
    obra: a.obra,
    conferido: a.conferido,
    linha: a.linha,
    chave: chaveDeConteudo(base, n),
  }
}

// ─── A aba de horas extras ────────────────────────────────────────────────────

export interface HoraExtraLida {
  nome: string
  cargo?: string
  /** Dia do mês, como está no cabeçalho da coluna. */
  dia: number
  /** ISO, montado com o mês e o ano informados na importação. */
  data: string
  valor: number
  pago: boolean
  linha: number
  chave: string
}

export interface LeituraHorasExtras {
  registros: HoraExtraLida[]
  problemas: ProblemaNaLinha[]
  /** Os dias que a planilha traz como coluna — na do cliente, os fins de semana do mês. */
  dias: number[]
  /** A linha TOTAIS, por dia, para conferir contra a soma que o sistema calcula. */
  totaisDeclarados: Record<number, number> | null
  /** O mês que o nome da aba declara ("HORAS EXTRAS 08" → 8), quando dá para ler. */
  mesDaAba?: number
}

/** "HORAS EXTRAS 08" → 8. É de onde vem o mês, já que a planilha não escreve a data inteira. */
/**
 * Quais abas do arquivo são grades de horas extras.
 *
 * ⚠️ Devolve TODAS. Aqui havia um `find` — e o cliente tem uma aba por mês ("HORAS EXTRAS 08",
 * "09"…). Da segunda em diante, hora extra paga não entrava no caixa e a tela não dizia nada.
 * Está como função pura, e não dentro do componente, exatamente para isto poder ter teste.
 */
export function abasDeHorasExtras(nomes: string[]): string[] {
  return nomes.filter((n) => /HORAS?\s*EXTRAS?/i.test(n))
}

/**
 * Qual aba tem os lançamentos.
 *
 * O gerador chama de LANÇAMENTOS; a planilha do cliente chama de DESPESAS. Não achando nenhuma,
 * cai na primeira — recusar por causa do nome seria recusar o arquivo de quem montou a planilha
 * sozinho. Mas devolve `porPosicao: true` para a tela poder AVISAR: num arquivo com muitas abas,
 * a primeira pode ser um LEIA-ME, e ler a aba errada em silêncio é pior que reclamar.
 */
export function abaDeLancamentos(nomes: string[]): { aba: string; porPosicao: boolean } | null {
  const porNome = nomes.find((n) => /LAN[ÇC]AMENTOS|DESPESAS|CAIXA/i.test(n))
  if (porNome) return { aba: porNome, porPosicao: false }
  if (nomes.length) return { aba: nomes[0], porPosicao: true }
  return null
}

export function mesDoNomeDaAba(nome: string): number | undefined {
  const m = /(\d{1,2})\s*$/.exec(normalizarTexto(nome))
  if (!m) return undefined
  const n = Number(m[1])
  return n >= 1 && n <= 12 ? n : undefined
}

/**
 * "OBS. DIAS 01 E 02" → [1, 2].
 *
 * ⚠️ O cabeçalho da coluna de observação **diz a que dias o "PG" se refere**. Sem ler isso, o "PG"
 * ou não valeria para dia nenhum, ou valeria para o mês inteiro — e no arquivo do cliente ele
 * cobre exatamente os dois primeiros dias, que são os únicos com lançamento.
 */
export function diasDaObservacao(cabecalho: unknown): number[] {
  const t = normalizarTexto(cabecalho)
  if (!t.startsWith('OBS')) return []
  return [...t.matchAll(/\b(\d{1,2})\b/g)]
    .map((m) => Number(m[1]))
    .filter((d) => d >= 1 && d <= 31)
}

/**
 * Lê a grade de horas extras: uma linha por pessoa, uma coluna por dia.
 *
 * ⚠️ **O valor NÃO é determinado pelo cargo.** No arquivo do cliente `AJUDANTE GERAL I` aparece com
 * 250, 300 **e** 350, e `PEDREIRO I` com 300 e 350. A tabela por cargo serve como sugestão na tela;
 * a verdade é o valor de cada célula. Derivar do cargo mudaria a folha de gente de verdade.
 */
export function lerHorasExtras(
  matriz: Matriz,
  opcoes: { mes: number; ano: number; nomeDaAba?: string },
): LeituraHorasExtras {
  const problemas: ProblemaNaLinha[] = []
  const registros: HoraExtraLida[] = []
  const cabecalho = matriz[0] ?? []

  // Mapeia as colunas: quais são dias, qual é a de observação e a que dias ela se refere.
  const colunasDeDia = new Map<number, number>()   // índice da coluna → dia do mês
  let colunaObs: number | null = null
  let diasDaObs: number[] = []

  for (let c = 0; c < cabecalho.length; c++) {
    const bruto = cabecalho[c]
    const texto = normalizarTexto(bruto)
    if (!texto || texto === 'NOME' || texto === 'CARGO') continue

    const obs = diasDaObservacao(bruto)
    if (obs.length > 0) { colunaObs = c; diasDaObs = obs; continue }

    const dia = typeof bruto === 'number' ? bruto : Number(texto)
    if (Number.isInteger(dia) && dia >= 1 && dia <= 31) colunasDeDia.set(c, dia)
  }

  if (colunasDeDia.size === 0) {
    return {
      registros: [],
      problemas: [{ linha: 1, motivo: 'Não encontrei nenhuma coluna de dia. O cabeçalho precisa ter os dias do mês (01, 02, 08…).' }],
      dias: [],
      totaisDeclarados: null,
      mesDaAba: opcoes.nomeDaAba ? mesDoNomeDaAba(opcoes.nomeDaAba) : undefined,
    }
  }

  let totaisDeclarados: Record<number, number> | null = null
  const ocorrencias = new Map<string, number>()

  for (let i = 1; i < matriz.length; i++) {
    const linha = matriz[i] ?? []
    const numeroDaLinha = i + 1
    const nome = String(linha[0] ?? '').trim()
    if (!nome) continue

    // A linha TOTAIS fecha a grade e não é pessoa nenhuma.
    if (/^TOTAIS?$|^TOTAL$/.test(normalizarTexto(nome))) {
      totaisDeclarados = {}
      for (const [c, dia] of colunasDeDia) {
        const v = lerValor(linha[c])
        if (v !== null) totaisDeclarados[dia] = v
      }
      continue
    }

    // ⚠️ Cargo vazio é aceito: no arquivo real, ÉVERTON SABINO tem R$ 350 e R$ 300 lançados e
    // NENHUM cargo. Recusar a linha perderia dinheiro que a empresa pagou.
    const cargo = String(linha[1] ?? '').trim() || undefined
    const pago = colunaObs !== null && normalizarTexto(linha[colunaObs]) === 'PG'

    for (const [c, dia] of colunasDeDia) {
      const bruto = linha[c]
      if (bruto === null || bruto === undefined || bruto === '') continue

      const valor = lerValor(bruto)
      if (valor === null) {
        problemas.push({
          linha: numeroDaLinha, coluna: `dia ${String(dia).padStart(2, '0')}`,
          motivo: 'Valor de hora extra não numérico.', conteudo: String(bruto),
        })
        continue
      }
      if (valor === 0) continue

      const data = montar(String(dia), String(opcoes.mes), String(opcoes.ano))
      if (!data) {
        problemas.push({
          linha: numeroDaLinha, coluna: `dia ${String(dia).padStart(2, '0')}`,
          motivo: `O dia ${dia} não existe em ${String(opcoes.mes).padStart(2, '0')}/${opcoes.ano}.`,
        })
        continue
      }

      // O "PG" vale para os dias que o próprio cabeçalho da observação nomeia; para os demais
      // dias a planilha não diz nada, e "não disse" não é "pago".
      const estePago = pago && (diasDaObs.length === 0 || diasDaObs.includes(dia))

      const base = `${normalizarTexto(nome)}|${data}|${valor.toFixed(2)}`
      const n = (ocorrencias.get(base) ?? 0) + 1
      ocorrencias.set(base, n)

      registros.push({
        nome, cargo, dia, data, valor, pago: estePago,
        linha: numeroDaLinha, chave: `he|${base}#${n}`,
      })
    }
  }

  return {
    registros,
    problemas,
    dias: [...colunasDeDia.values()].sort((a, b) => a - b),
    totaisDeclarados,
    mesDaAba: opcoes.nomeDaAba ? mesDoNomeDaAba(opcoes.nomeDaAba) : undefined,
  }
}

/**
 * Confere a soma por dia contra a linha TOTAIS da própria planilha.
 *
 * É a checagem que o cliente pediu — "o sistema identificar valores errados". Se alguém mexeu numa
 * célula sem atualizar a fórmula do rodapé, ou o contrário, aparece aqui em vez de na reunião.
 */
export function conferirTotaisDeHorasExtras(
  leitura: LeituraHorasExtras,
): Array<{ dia: number; calculado: number; declarado: number; diferenca: number }> {
  if (!leitura.totaisDeclarados) return []
  const divergencias: Array<{ dia: number; calculado: number; declarado: number; diferenca: number }> = []
  for (const [diaTexto, declarado] of Object.entries(leitura.totaisDeclarados)) {
    const dia = Number(diaTexto)
    const calculado = leitura.registros.filter((r) => r.dia === dia).reduce((a, r) => a + r.valor, 0)
    // Um centavo de folga: a planilha soma em ponto flutuante como todo mundo.
    if (Math.abs(calculado - declarado) > 0.01) {
      divergencias.push({ dia, calculado, declarado, diferenca: calculado - declarado })
    }
  }
  return divergencias.sort((a, b) => a.dia - b.dia)
}
