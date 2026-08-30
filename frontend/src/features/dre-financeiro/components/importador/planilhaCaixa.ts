/**
 * planilhaCaixa.ts — o modelo de lançamento e o parser, no MESMO arquivo.
 *
 * As colunas são definidas UMA vez (COLUNAS_LANCAMENTO / COLUNAS_HE) e usadas
 * tanto para GERAR o modelo que o usuário baixa quanto para LER a planilha que
 * ele devolve. É o que garante que a planilha preenchida seja sempre a que o
 * parser espera — se as duas listas fossem separadas, elas divergiriam na
 * primeira mudança.
 */
import * as XLSX from 'xlsx'
import { paraNumero, paraPeriodo, separarNomes, norm, type Problema } from './diff'

// ─── definição das colunas (fonte única) ────────────────────────────────────

export interface ColunaModelo {
  chave: string
  titulo: string
  largura: number
  obrigatoria: boolean
  exemplo: string | number
  ajuda: string
  /** aceita estes títulos alternativos ao ler (planilha antiga, abreviação) */
  sinonimos?: string[]
}

export const COLUNAS_LANCAMENTO: ColunaModelo[] = [
  { chave: 'tipo', titulo: 'TIPO', largura: 11, obrigatoria: true, exemplo: 'DESPESA',
    ajuda: 'RECEITA ou DESPESA', sinonimos: ['RECEITA/DESPESA', 'R/D'] },
  { chave: 'data', titulo: 'DATA', largura: 16, obrigatoria: true, exemplo: '05/08/2026',
    ajuda: 'dd/mm/aaaa. Período também vale: "01 A 10/08/2026"', sinonimos: ['DATA/PERÍODO', 'PERIODO'] },
  { chave: 'descricao', titulo: 'DESCRIÇÃO', largura: 44, obrigatoria: true, exemplo: 'Diesel S10 — caminhão munck',
    ajuda: 'O que foi pago ou recebido', sinonimos: ['DESCRICAO', 'HISTÓRICO', 'HISTORICO'] },
  { chave: 'valor', titulo: 'VALOR', largura: 14, obrigatoria: true, exemplo: 1250.5,
    ajuda: 'Só o número. 1.234,56 também é aceito', sinonimos: ['R$', 'VALOR (R$)'] },
  { chave: 'categoria', titulo: 'CATEGORIA', largura: 22, obrigatoria: true, exemplo: 'Combustível',
    ajuda: 'Precisa existir no catálogo — a tela avisa se for nova' },
  { chave: 'obra', titulo: 'OBRA', largura: 22, obrigatoria: true, exemplo: 'BOI MALHADO',
    ajuda: 'Centro de custo. Obrigatório', sinonimos: ['NÚCLEO', 'NUCLEO', 'CENTRO DE CUSTO'] },
  { chave: 'solicitante', titulo: 'SOLICITANTE', largura: 26, obrigatoria: false, exemplo: 'DAMIÃO/WELLINGTON',
    ajuda: 'Mais de um: separe por / ou vírgula. Casa com o cadastro de Recursos Humanos',
    sinonimos: ['SOLICITANTES', 'QUEM PEDIU'] },
  { chave: 'forma_pagamento', titulo: 'FORMA DE PAGAMENTO', largura: 20, obrigatoria: false, exemplo: 'PIX',
    ajuda: 'PIX, dinheiro, cartão, boleto…', sinonimos: ['PAGAMENTO', 'FORMA'] },
  { chave: 'status', titulo: 'STATUS', largura: 13, obrigatoria: false, exemplo: 'pendente',
    ajuda: 'pendente, conferido ou pago. Vazio = pendente' },
  { chave: 'anexo', titulo: 'COMPROVANTE (LINK)', largura: 34, obrigatoria: false, exemplo: '',
    ajuda: 'Link da nota, recibo ou print do PIX', sinonimos: ['ANEXO', 'COMPROVANTE'] },
  { chave: 'observacao', titulo: 'OBSERVAÇÃO', largura: 34, obrigatoria: false, exemplo: '',
    ajuda: 'Livre', sinonimos: ['OBS', 'OBSERVACAO'] },
]

export const COLUNAS_HE: ColunaModelo[] = [
  { chave: 'funcionario', titulo: 'FUNCIONÁRIO', largura: 34, obrigatoria: true, exemplo: 'José da Silva',
    ajuda: 'Nome como está no cadastro de Recursos Humanos', sinonimos: ['NOME', 'FUNCIONARIO'] },
  { chave: 'data', titulo: 'DATA', largura: 14, obrigatoria: true, exemplo: '09/08/2026',
    ajuda: 'O dia trabalhado (sábado, domingo, feriado)' },
  { chave: 'valor', titulo: 'VALOR', largura: 12, obrigatoria: false, exemplo: 300,
    ajuda: 'Vazio = puxa o valor do cargo automaticamente' },
  { chave: 'obra', titulo: 'OBRA', largura: 22, obrigatoria: true, exemplo: 'BOI MALHADO', ajuda: 'Centro de custo' },
  { chave: 'status', titulo: 'STATUS', largura: 12, obrigatoria: false, exemplo: 'pendente',
    ajuda: 'PG ou pendente. Marcar PG gera a despesa automaticamente' },
  { chave: 'observacao', titulo: 'OBSERVAÇÃO', largura: 30, obrigatoria: false, exemplo: '', ajuda: 'Livre' },
]

export const CATEGORIAS_PADRAO = [
  'Combustível', 'Transporte/Uber', 'Materiais', 'Manutenção de veículo', 'Manutenção de máquina',
  'Alimentação/VR', 'Vale-transporte', 'Alojamento', 'Ferramentas', 'Hora extra',
  'Diárias/terceiros', 'Sinistro', 'Escritório', 'Outros', 'Medição', 'Adiantamento',
]

// ─── gerar o modelo para download ───────────────────────────────────────────

function abaDeColunas(cols: ColunaModelo[], exemplos: number): XLSX.WorkSheet {
  // linha 1 = título da coluna · linha 2 = ajuda (cinza) · linha 3+ = exemplo
  const cab = cols.map((c) => c.titulo + (c.obrigatoria ? ' *' : ''))
  const ajuda = cols.map((c) => c.ajuda)
  const linhas: unknown[][] = [cab, ajuda]
  for (let i = 0; i < exemplos; i++) linhas.push(cols.map((c) => (i === 0 ? c.exemplo : '')))
  const ws = XLSX.utils.aoa_to_sheet(linhas)
  ws['!cols'] = cols.map((c) => ({ wch: c.largura }))
  ws['!freeze'] = { xSplit: 0, ySplit: 2 }
  return ws
}

/** Gera e baixa o modelo. É a via principal de lançamento, por decisão do produto. */
export function baixarModeloCaixa(categorias: string[] = CATEGORIAS_PADRAO, obras: string[] = []): void {
  const wb = XLSX.utils.book_new()

  const leiaMe = [
    ['CONTROLE DE CAIXA — MODELO DE LANÇAMENTO'],
    [''],
    ['Como usar:'],
    ['1. Preencha a aba LANÇAMENTOS. Uma linha por lançamento, receita ou despesa.'],
    ['2. Preencha a aba HORAS EXTRAS com os dias trabalhados (sábado, domingo, feriado).'],
    ['3. Suba o arquivo em DRE & Resultado → Controle de Caixa → Importar planilha.'],
    ['4. O sistema mostra o que é NOVO, o que MUDOU e o que está com ERRO — antes de gravar.'],
    [''],
    ['Regras:'],
    ['· Coluna com * é obrigatória.'],
    ['· NÃO apague, renomeie nem reordene as colunas — o leitor se baseia nelas.'],
    ['· A linha 2 de cada aba é ajuda; pode deixar como está, o leitor ignora.'],
    ['· Data aceita 05/08/2026 e também período: 01 A 10/08/2026.'],
    ['· Mais de um solicitante: separe por barra — DAMIÃO/WELLINGTON.'],
    ['· Categoria fora da lista não é recusada: o sistema pergunta se deve cadastrar.'],
    [''],
    ['Categorias disponíveis hoje:'],
    ...categorias.map((c) => ['· ' + c]),
    ...(obras.length ? [[''], ['Obras cadastradas:'], ...obras.map((o) => ['· ' + o])] : []),
  ]
  const wsLeia = XLSX.utils.aoa_to_sheet(leiaMe)
  wsLeia['!cols'] = [{ wch: 92 }]
  XLSX.utils.book_append_sheet(wb, wsLeia, 'LEIA-ME')
  XLSX.utils.book_append_sheet(wb, abaDeColunas(COLUNAS_LANCAMENTO, 12), 'LANÇAMENTOS')
  XLSX.utils.book_append_sheet(wb, abaDeColunas(COLUNAS_HE, 12), 'HORAS EXTRAS')

  const hoje = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `CONTROLE_DE_CAIXA_MODELO_${hoje}.xlsx`)
}

// ─── ler a planilha preenchida ──────────────────────────────────────────────

export interface LancamentoPlanilha {
  tipo: 'RECEITA' | 'DESPESA'
  data_inicio: string
  data_fim: string | null
  data_texto?: string
  descricao: string
  valor: number
  categoria: string
  obra: string
  solicitantes: string[]
  forma_pagamento: string | null
  status: 'pendente' | 'conferido' | 'pago'
  anexo: string | null
  observacao: string | null
  [k: string]: unknown
}

export interface HePlanilha {
  funcionario: string
  data: string
  valor: number | null
  obra: string
  status: 'pendente' | 'PG'
  observacao: string | null
  [k: string]: unknown
}

/** Casa o cabeçalho da planilha com as colunas esperadas, tolerando sinônimo e acento. */
function mapearColunas(cabecalho: unknown[], cols: ColunaModelo[]): Record<string, number> {
  const mapa: Record<string, number> = {}
  const limpo = cabecalho.map((h) => norm(String(h ?? '').replace(/\*/g, '')))
  for (const c of cols) {
    const alvos = [c.titulo, ...(c.sinonimos ?? [])].map(norm)
    const i = limpo.findIndex((h) => h && alvos.includes(h))
    if (i >= 0) mapa[c.chave] = i
  }
  return mapa
}

/** Detecta a linha de cabeçalho: a que casa mais colunas nas 8 primeiras. */
function acharCabecalho(linhas: unknown[][], cols: ColunaModelo[]): number {
  let melhor = 0, melhorQtd = -1
  for (let i = 0; i < Math.min(8, linhas.length); i++) {
    const qtd = Object.keys(mapearColunas(linhas[i] ?? [], cols)).length
    if (qtd > melhorQtd) { melhorQtd = qtd; melhor = i }
  }
  return melhor
}

const vazia = (linha: unknown[]) => linha.every((c) => c === null || c === undefined || String(c).trim() === '')

export interface LeituraCaixa {
  lancamentos: { linha: number; dados: LancamentoPlanilha }[]
  horasExtras: { linha: number; dados: HePlanilha }[]
  avisos: string[]
}

export function lerPlanilhaCaixa(buffer: ArrayBuffer): LeituraCaixa {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const avisos: string[] = []

  const acharAba = (...nomes: string[]) => {
    const alvo = nomes.map(norm)
    return wb.SheetNames.find((n) => alvo.includes(norm(n)))
  }

  const lancamentos: LeituraCaixa['lancamentos'] = []
  const abaL = acharAba('LANÇAMENTOS', 'LANCAMENTOS', 'CAIXA')
  if (!abaL) {
    avisos.push('A aba LANÇAMENTOS não foi encontrada — baixe o modelo e use as abas dele.')
  } else {
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[abaL], { header: 1, raw: false, defval: '' })
    const iCab = acharCabecalho(linhas, COLUNAS_LANCAMENTO)
    const mapa = mapearColunas(linhas[iCab] ?? [], COLUNAS_LANCAMENTO)
    const faltando = COLUNAS_LANCAMENTO.filter((c) => c.obrigatoria && mapa[c.chave] === undefined)
    if (faltando.length) {
      avisos.push(`Colunas obrigatórias ausentes em LANÇAMENTOS: ${faltando.map((c) => c.titulo).join(', ')}.`)
    }
    const val = (l: unknown[], k: string) => (mapa[k] === undefined ? '' : l[mapa[k]])

    for (let i = iCab + 1; i < linhas.length; i++) {
      const l = linhas[i] ?? []
      if (vazia(l)) continue
      // a linha logo abaixo do cabeçalho é a de ajuda do modelo — pula
      if (i === iCab + 1 && COLUNAS_LANCAMENTO.some((c) => norm(val(l, c.chave)) === norm(c.ajuda))) continue

      const periodo = paraPeriodo(val(l, 'data'))
      const tipoBruto = norm(val(l, 'tipo'))
      lancamentos.push({
        linha: i + 1,
        dados: {
          tipo: tipoBruto.startsWith('r') ? 'RECEITA' : 'DESPESA',
          data_inicio: periodo?.inicio ?? '',
          data_fim: periodo?.fim ?? null,
          data_texto: periodo?.textoOriginal,
          descricao: String(val(l, 'descricao') ?? '').trim(),
          valor: paraNumero(val(l, 'valor')) ?? NaN,
          categoria: String(val(l, 'categoria') ?? '').trim(),
          obra: String(val(l, 'obra') ?? '').trim(),
          solicitantes: separarNomes(val(l, 'solicitante')),
          forma_pagamento: String(val(l, 'forma_pagamento') ?? '').trim() || null,
          status: (['pendente', 'conferido', 'pago'].includes(norm(val(l, 'status')))
            ? norm(val(l, 'status')) : 'pendente') as LancamentoPlanilha['status'],
          anexo: String(val(l, 'anexo') ?? '').trim() || null,
          observacao: String(val(l, 'observacao') ?? '').trim() || null,
        },
      })
    }
  }

  const horasExtras: LeituraCaixa['horasExtras'] = []
  const abaH = wb.SheetNames.find((n) => norm(n).startsWith('horas extras'))
  if (abaH) {
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[abaH], { header: 1, raw: false, defval: '' })
    const iCab = acharCabecalho(linhas, COLUNAS_HE)
    const mapa = mapearColunas(linhas[iCab] ?? [], COLUNAS_HE)
    const val = (l: unknown[], k: string) => (mapa[k] === undefined ? '' : l[mapa[k]])
    for (let i = iCab + 1; i < linhas.length; i++) {
      const l = linhas[i] ?? []
      if (vazia(l)) continue
      if (i === iCab + 1 && COLUNAS_HE.some((c) => norm(val(l, c.chave)) === norm(c.ajuda))) continue
      const periodo = paraPeriodo(val(l, 'data'))
      horasExtras.push({
        linha: i + 1,
        dados: {
          funcionario: String(val(l, 'funcionario') ?? '').trim(),
          data: periodo?.inicio ?? '',
          valor: paraNumero(val(l, 'valor')),
          obra: String(val(l, 'obra') ?? '').trim(),
          status: norm(val(l, 'status')) === 'pg' ? 'PG' : 'pendente',
          observacao: String(val(l, 'observacao') ?? '').trim() || null,
        },
      })
    }
  }

  return { lancamentos, horasExtras, avisos }
}

// ─── validação por linha ────────────────────────────────────────────────────

export function validarLancamento(l: LancamentoPlanilha): Problema[] {
  const p: Problema[] = []
  if (!l.data_inicio) p.push({ campo: 'data', mensagem: 'Data não reconhecida. Use dd/mm/aaaa ou "01 A 10/08/2026".', bloqueia: true })
  if (!l.descricao) p.push({ campo: 'descricao', mensagem: 'Descrição vazia.', bloqueia: true })
  if (!Number.isFinite(l.valor)) p.push({ campo: 'valor', mensagem: 'Valor não é um número.', bloqueia: true })
  else if (l.valor < 0) p.push({ campo: 'valor', mensagem: 'Valor negativo — use o TIPO para indicar receita ou despesa.', bloqueia: true })
  else if (l.valor === 0) p.push({ campo: 'valor', mensagem: 'Valor zerado — confira.', bloqueia: false })
  if (!l.categoria) p.push({ campo: 'categoria', mensagem: 'Categoria é obrigatória.', bloqueia: true })
  if (!l.obra) p.push({ campo: 'obra', mensagem: 'Obra é obrigatória (centro de custo).', bloqueia: true })
  if (l.data_fim && l.data_fim < l.data_inicio) p.push({ campo: 'data', mensagem: 'Fim do período antes do início.', bloqueia: true })
  if (l.valor > 100000) p.push({ campo: 'valor', mensagem: 'Valor acima de R$ 100 mil — confira antes de confirmar.', bloqueia: false })
  return p
}

export function validarHe(h: HePlanilha): Problema[] {
  const p: Problema[] = []
  if (!h.funcionario) p.push({ campo: 'funcionario', mensagem: 'Funcionário vazio.', bloqueia: true })
  if (!h.data) p.push({ campo: 'data', mensagem: 'Data não reconhecida.', bloqueia: true })
  if (!h.obra) p.push({ campo: 'obra', mensagem: 'Obra é obrigatória.', bloqueia: true })
  if (h.valor !== null && h.valor <= 0) p.push({ campo: 'valor', mensagem: 'Valor precisa ser maior que zero (ou vazio, para puxar do cargo).', bloqueia: true })
  if (h.data) {
    const dia = new Date(h.data + 'T12:00:00').getDay()
    if (dia >= 1 && dia <= 5) {
      p.push({ campo: 'data', mensagem: 'Dia útil — hora extra costuma ser sábado, domingo ou feriado. Confira.', bloqueia: false })
    }
  }
  return p
}
