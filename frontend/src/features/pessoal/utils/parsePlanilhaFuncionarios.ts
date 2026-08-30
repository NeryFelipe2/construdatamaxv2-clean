/**
 * parsePlanilhaFuncionarios — parser PURO (sem React) da planilha de RH da WCR
 * no formato de "FUNCIONÁRIOS ATIVOS_ABR_2026.xlsx":
 *
 *   aba FUNCIONÁRIOS EFETIVOS   → status ativo
 *   aba FUNCIONÁRIOS DESLIGADOS → status desligado (DATA DA DEMISSÃO é MISTA:
 *                                 Date | 'PREVISÃO DE DEMISSÃO - dd/mm/aaaa' |
 *                                 'JUSTA CAUSA' | 'APÓS DISSÍDIO' | 'PEDIDO DE DEMISSÃO')
 *   aba EM PROCESSO DE CONTRATAÇÃO → status em_contratacao (NÚMERO→telefone,
 *                                 EMPREITEIRO→vinculo, EPI calça/camisa/botina)
 *
 * Decisões validadas contra o arquivo real:
 *  - Leitura com XLSX.read(arrayBuffer, {type:'array', cellDates:true}) e
 *    sheet_to_json(ws, {header:1, raw:true, defval:null, blankrows:false}) —
 *    o parser do suprimentos NÃO serve (só 1ª aba, header fixo, perde datas).
 *  - Header por VARREDURA: primeira das 10 primeiras linhas cujo conteúdo
 *    normalizado contém 'NOME COMPLETO' (fallback: linhas 5/1/4, 1-based).
 *  - venc_experiencia_1/2 = admissão+44d/+89d RECALCULADOS (a planilha tem 4+
 *    literais errados na coluna 1-EXPERIÊNCIA e fórmulas podem vir null).
 *  - SALÁRIO null fica null (nunca 0). VALE null → 31.80*22 SÓ se houver salário.
 *  - ENCARREGADO com .trim() (a planilha tem ' JESSÉ' com espaço à esquerda).
 *  - CARGO 'ENCANADOR ESGOTO III' → 'ENCANADOR DE ESGOTO III'.
 */
import * as XLSX from 'xlsx'

export type AbaTipo = 'efetivos' | 'desligados' | 'em_processo'

export interface DadosFuncionario {
  nomeCompleto: string
  cargo: string | null
  status: 'ativo' | 'desligado' | 'em_contratacao'
  dataAdmissao: string | null // yyyy-mm-dd
  vencExperiencia1: string | null // recalculado: admissão + 44d
  vencExperiencia2: string | null // recalculado: admissão + 89d
  encarregado: string | null // com trim
  vinculo: string | null // MÃO DE OBRA (WCR/JWL) ou EMPREITEIRO
  salarioBruto: number | null
  valeRefeicao: number | null
  valeRefeicaoFormula: string | null // ex.: '=31.8*22'
  dataDesligamento: string | null
  desligamentoPrevisto: boolean
  motivoDesligamento: string | null
  telefone: string | null // string PRESERVADA ('(11) 99493-4384')
  epiCalca: string | null
  epiCamisa: string | null
  epiBotina: string | null // vem int na planilha → String()
}

export interface LinhaImportacao {
  valid: boolean
  errors: string[]
  warnings: string[]
  /** posição 1-based dentro das linhas lidas da aba (blankrows removidas). */
  lineNumber: number
  aba: AbaTipo
  dados: DadosFuncionario
}

/** Campos mapeáveis por aba (chave interna → rótulo p/ UI de remapeamento). */
export const CAMPOS_POR_ABA: Record<AbaTipo, { campo: CampoImportacao; label: string }[]> = {
  efetivos: [
    { campo: 'nomeCompleto', label: 'Nome completo' },
    { campo: 'cargo', label: 'Cargo' },
    { campo: 'dataAdmissao', label: 'Data de admissão' },
    { campo: 'exp1', label: '1ª experiência (recalculada)' },
    { campo: 'exp2', label: '2ª experiência (recalculada)' },
    { campo: 'encarregado', label: 'Encarregado' },
    { campo: 'vinculo', label: 'Mão de obra (WCR/JWL)' },
    { campo: 'salario', label: 'Salário bruto' },
    { campo: 'vale', label: 'Vale-refeição' },
  ],
  desligados: [
    { campo: 'nomeCompleto', label: 'Nome completo' },
    { campo: 'cargo', label: 'Cargo' },
    { campo: 'dataAdmissao', label: 'Data de admissão' },
    { campo: 'exp1', label: '1ª experiência (recalculada)' },
    { campo: 'exp2', label: '2ª experiência (recalculada)' },
    { campo: 'encarregado', label: 'Encarregado' },
    { campo: 'vinculo', label: 'Mão de obra (WCR/JWL)' },
    { campo: 'demissao', label: 'Data da demissão' },
  ],
  em_processo: [
    { campo: 'nomeCompleto', label: 'Nome completo' },
    { campo: 'cargo', label: 'Cargo' },
    { campo: 'telefone', label: 'Número (telefone)' },
    { campo: 'vinculo', label: 'Empreiteiro' },
    { campo: 'epiCalca', label: 'EPI — Calça' },
    { campo: 'epiCamisa', label: 'EPI — Camisa' },
    { campo: 'epiBotina', label: 'EPI — Botina' },
  ],
}

export type CampoImportacao =
  | 'nomeCompleto'
  | 'cargo'
  | 'dataAdmissao'
  | 'exp1'
  | 'exp2'
  | 'encarregado'
  | 'vinculo'
  | 'salario'
  | 'vale'
  | 'demissao'
  | 'telefone'
  | 'epiCalca'
  | 'epiCamisa'
  | 'epiBotina'

/** coluna → campo (null = coluna ignorada / sem header). */
export type MapeamentoColunas = Partial<Record<CampoImportacao, number>>

export interface AbaLida {
  nomeAba: string
  /** tipo detectado pelo nome da aba (EFETIVO/DESLIGAD/CONTRATA) — null se não reconhecida. */
  tipo: AbaTipo | null
  /** índice 0-based da linha de header dentro de `rows`. */
  headerRow: number
  /** headers não vazios: índice da coluna + texto. Colunas sem header são descartadas. */
  headers: { col: number; texto: string }[]
  /** todas as linhas cruas da aba (arrays por linha, defval null, blankrows fora). */
  rows: (unknown[] | undefined)[]
  /** fórmulas por célula (ex.: vale '=31.8*22'), indexadas por `${row}:${col}` de rows. */
  formulas: Record<string, string>
}

export interface PlanilhaLida {
  abas: AbaLida[]
  avisos: string[]
}

// ─── util ────────────────────────────────────────────────────────────────────

function normTexto(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Date | serial Excel | string dd/mm/aaaa → 'yyyy-mm-dd' (componentes LOCAIS) | null. */
function paraDataIso(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return isoLocal(v)
  if (typeof v === 'number' && isFinite(v) && v > 20000 && v < 80000) {
    const p = XLSX.SSF.parse_date_code(v)
    if (p) return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
  }
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    const iso = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  }
  return null
}

function somarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + dias)
  return isoLocal(dt)
}

/** Normalização de grafias sujas de cargo conhecidas. */
function normalizarCargo(raw: string | null): string | null {
  if (!raw) return null
  const t = raw.replace(/\s+/g, ' ').trim()
  if (normTexto(t) === 'ENCANADOR ESGOTO III') return 'ENCANADOR DE ESGOTO III'
  return t
}

function textoOuNull(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function numeroOuNull(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'))
    return isFinite(n) ? n : null
  }
  return null
}

const VALE_PADRAO = 31.8 * 22 // 699.60 — regra da planilha ('=31.8*22')

// ─── Leitura ─────────────────────────────────────────────────────────────────

/** Detecta o tipo da aba pelo nome normalizado. */
export function detectarTipoAba(nomeAba: string): AbaTipo | null {
  const n = normTexto(nomeAba)
  if (n.includes('EFETIVO')) return 'efetivos'
  if (n.includes('DESLIGAD')) return 'desligados'
  if (n.includes('CONTRATA')) return 'em_processo'
  return null
}

/** Varredura de header: 1ª das 10 primeiras linhas contendo 'NOME COMPLETO'. */
function acharHeaderRow(rows: (unknown[] | undefined)[]): number {
  const limite = Math.min(rows.length, 10)
  for (let i = 0; i < limite; i++) {
    const conteudo = (rows[i] ?? []).map(normTexto).join(' | ')
    if (conteudo.includes('NOME COMPLETO')) return i
  }
  // fallback documentado: linhas 5/1/4 (1-based) → índices 4/0/3
  for (const idx of [4, 0, 3]) {
    if (rows[idx] && (rows[idx] as unknown[]).some((c) => textoOuNull(c) !== null)) return idx
  }
  return 0
}

/**
 * Lê o workbook inteiro (ArrayBuffer) e devolve as abas com header detectado.
 * Não interpreta as linhas ainda — isso é o `parseLinhasAba` (permite remapear).
 */
export function lerPlanilha(buffer: ArrayBuffer): PlanilhaLida {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const avisos: string[] = []
  const abas: AbaLida[] = []

  for (const nomeAba of wb.SheetNames) {
    const ws = wb.Sheets[nomeAba]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    })
    const tipo = detectarTipoAba(nomeAba)
    if (!tipo) {
      avisos.push(`Aba "${nomeAba}" não reconhecida (esperado EFETIVO/DESLIGAD/CONTRATA) — ignorada.`)
    }
    const headerRow = acharHeaderRow(rows)
    const headers = (rows[headerRow] ?? [])
      .map((h, col) => ({ col, texto: textoOuNull(h) ?? '' }))
      .filter((h) => h.texto !== '') // descarta colunas sem header

    // captura fórmulas das células (pra vale_refeicao_formula '=31.8*22')
    const formulas: Record<string, string> = {}
    try {
      const ref = ws['!ref']
      if (ref) {
        const range = XLSX.utils.decode_range(ref)
        // sheet_to_json com blankrows:false remove linhas vazias — mapeia r físico → índice em rows
        let idx = 0
        for (let r = range.s.r; r <= range.e.r; r++) {
          let temAlgo = false
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })]
            if (cell && cell.v !== null && cell.v !== undefined && cell.v !== '') temAlgo = true
          }
          if (!temAlgo) continue
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })] as { f?: string } | undefined
            if (cell?.f) formulas[`${idx}:${c}`] = `=${cell.f}`
          }
          idx++
        }
      }
    } catch {
      // fórmulas são bônus — nunca quebram a leitura
    }

    abas.push({ nomeAba, tipo, headerRow, headers, rows, formulas })
  }

  return { abas, avisos }
}

// ─── Mapeamento ──────────────────────────────────────────────────────────────

const HINTS: Record<CampoImportacao, string[]> = {
  nomeCompleto: ['NOME COMPLETO', 'NOME'],
  cargo: ['CARGO', 'FUNCAO'],
  dataAdmissao: ['DATA DE ADMISSAO', 'ADMISSAO'],
  exp1: ['1 - EXPERIENCIA', '1 EXPERIENCIA', '1ª EXPERIENCIA'],
  exp2: ['2 - EXPERIENCIA', '2 EXPERIENCIA', '2ª EXPERIENCIA'],
  encarregado: ['ENCARREGADO'],
  vinculo: ['MAO DE OBRA', 'EMPREITEIRO', 'VINCULO'],
  salario: ['SALARIO BRUTO', 'SALARIO'],
  vale: ['VALE-REFEICAO', 'VALE REFEICAO', 'VALE'],
  demissao: ['DATA DA DEMISSAO', 'DEMISSAO'],
  telefone: ['NUMERO', 'TELEFONE', 'CELULAR'],
  epiCalca: ['EPI - CALCA', 'CALCA'],
  epiCamisa: ['EPI - CAMISA', 'CAMISA'],
  epiBotina: ['EPI - BOTINA', 'BOTINA'],
}

/** Sugere o mapeamento coluna→campo pelos headers detectados. */
export function sugerirMapeamento(tipo: AbaTipo, headers: { col: number; texto: string }[]): MapeamentoColunas {
  const map: MapeamentoColunas = {}
  const campos = CAMPOS_POR_ABA[tipo].map((c) => c.campo)
  for (const campo of campos) {
    const hints = HINTS[campo]
    // 1ª passada: match exato; 2ª: contém — sempre a primeira coluna livre que casa
    let achado: number | undefined
    for (const h of headers) {
      const nh = normTexto(h.texto)
      if (hints.some((hint) => nh === hint)) {
        achado = h.col
        break
      }
    }
    if (achado === undefined) {
      for (const h of headers) {
        const nh = normTexto(h.texto)
        if (hints.some((hint) => nh.includes(hint))) {
          achado = h.col
          break
        }
      }
    }
    if (achado !== undefined && !Object.values(map).includes(achado)) map[campo] = achado
  }
  return map
}

// ─── Interpretação das linhas ────────────────────────────────────────────────

const MOTIVOS_TEXTO = ['JUSTA CAUSA', 'APOS DISSIDIO', 'PEDIDO DE DEMISSAO']

/** Interpreta as linhas de UMA aba com o mapeamento dado (auto ou remapeado). */
export function parseLinhasAba(aba: AbaLida, tipo: AbaTipo, mapeamento: MapeamentoColunas): LinhaImportacao[] {
  const out: LinhaImportacao[] = []
  const get = (row: unknown[] | undefined, campo: CampoImportacao): unknown => {
    const col = mapeamento[campo]
    if (col === undefined || !row) return null
    return row[col] ?? null
  }

  for (let i = aba.headerRow + 1; i < aba.rows.length; i++) {
    const row = aba.rows[i]
    if (!row) continue
    const nome = textoOuNull(get(row, 'nomeCompleto'))
    const temAlgo = row.some((c) => textoOuNull(c) !== null)
    if (!temAlgo) continue

    const errors: string[] = []
    const warnings: string[] = []

    if (!nome) {
      // linha com conteúdo mas sem nome → inválida (não silencia dado real)
      out.push({
        valid: false,
        errors: ['NOME COMPLETO vazio'],
        warnings: [],
        lineNumber: i + 1,
        aba: tipo,
        dados: dadosVazios(tipo),
      })
      continue
    }

    const cargo = normalizarCargo(textoOuNull(get(row, 'cargo')))
    if (!cargo) warnings.push('CARGO vazio')

    const dados: DadosFuncionario = dadosVazios(tipo)
    dados.nomeCompleto = nome.replace(/\s+/g, ' ').trim()
    dados.cargo = cargo

    if (tipo === 'efetivos' || tipo === 'desligados') {
      const adm = paraDataIso(get(row, 'dataAdmissao'))
      dados.dataAdmissao = adm
      if (!adm) {
        warnings.push('DATA DE ADMISSÃO ausente/ilegível — experiências não calculadas')
      } else {
        // RECALCULA (ignora o literal da célula — a planilha tem 4+ errados)
        dados.vencExperiencia1 = somarDias(adm, 44)
        dados.vencExperiencia2 = somarDias(adm, 89)
        const exp1Celula = paraDataIso(get(row, 'exp1'))
        const exp2Celula = paraDataIso(get(row, 'exp2'))
        if (exp1Celula && exp1Celula !== dados.vencExperiencia1) {
          warnings.push(`1ª experiência na planilha (${exp1Celula}) difere do recálculo (${dados.vencExperiencia1}) — usando o recálculo`)
        }
        if (exp2Celula && exp2Celula !== dados.vencExperiencia2) {
          warnings.push(`2ª experiência na planilha (${exp2Celula}) difere do recálculo (${dados.vencExperiencia2}) — usando o recálculo`)
        }
      }
      dados.encarregado = textoOuNull(get(row, 'encarregado'))?.trim() ?? null
      dados.vinculo = textoOuNull(get(row, 'vinculo'))
    }

    if (tipo === 'efetivos') {
      const salario = numeroOuNull(get(row, 'salario'))
      dados.salarioBruto = salario // null fica null — NUNCA 0
      if (salario === null) warnings.push('SALÁRIO BRUTO vazio — remuneração fica pendente')
      const vale = numeroOuNull(get(row, 'vale'))
      if (vale !== null) {
        dados.valeRefeicao = vale
        const colVale = mapeamento.vale
        if (colVale !== undefined) dados.valeRefeicaoFormula = aba.formulas[`${i}:${colVale}`] ?? null
      } else if (salario !== null) {
        // VALE null → 31.80*22 SE houver salário
        dados.valeRefeicao = Math.round(VALE_PADRAO * 100) / 100
        dados.valeRefeicaoFormula = '=31.8*22'
        warnings.push('VALE-REFEIÇÃO vazio — aplicado padrão 31,80 × 22 = 699,60')
      }
    }

    if (tipo === 'desligados') {
      const bruto = get(row, 'demissao')
      const comoData = paraDataIso(bruto)
      if (bruto instanceof Date || typeof bruto === 'number') {
        dados.dataDesligamento = comoData
        if (!comoData) warnings.push('DATA DA DEMISSÃO ilegível')
      } else if (typeof bruto === 'string' && bruto.trim() !== '') {
        const texto = bruto.trim()
        const nTexto = normTexto(texto)
        if (nTexto.startsWith('PREVISAO DE DEMISSAO')) {
          dados.desligamentoPrevisto = true
          dados.motivoDesligamento = 'PREVISÃO DE DEMISSÃO'
          const dm = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
          if (dm) dados.dataDesligamento = `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`
          else warnings.push(`PREVISÃO DE DEMISSÃO sem data extraível: "${texto}"`)
          warnings.push(`DATA DA DEMISSÃO em texto: "${texto}"`)
        } else if (MOTIVOS_TEXTO.includes(nTexto)) {
          dados.motivoDesligamento = texto
          dados.dataDesligamento = null
          warnings.push(`DATA DA DEMISSÃO em texto: "${texto}"`)
        } else if (comoData) {
          dados.dataDesligamento = comoData
        } else {
          dados.motivoDesligamento = texto
          warnings.push(`DATA DA DEMISSÃO não reconhecida — guardada como motivo: "${texto}"`)
        }
      } else {
        warnings.push('DATA DA DEMISSÃO vazia')
      }
    }

    if (tipo === 'em_processo') {
      // NÚMERO → telefone (string PRESERVADA); EPI-BOTINA int → String()
      const tel = get(row, 'telefone')
      dados.telefone = tel === null || tel === undefined ? null : String(tel).trim() || null
      dados.vinculo = textoOuNull(get(row, 'vinculo'))
      dados.epiCalca = textoOuNull(get(row, 'epiCalca'))
      dados.epiCamisa = textoOuNull(get(row, 'epiCamisa'))
      const botina = get(row, 'epiBotina')
      dados.epiBotina = botina === null || botina === undefined ? null : String(botina).trim() || null
    }

    out.push({ valid: errors.length === 0, errors, warnings, lineNumber: i + 1, aba: tipo, dados })
  }

  return out
}

function dadosVazios(tipo: AbaTipo): DadosFuncionario {
  return {
    nomeCompleto: '',
    cargo: null,
    status: tipo === 'efetivos' ? 'ativo' : tipo === 'desligados' ? 'desligado' : 'em_contratacao',
    dataAdmissao: null,
    vencExperiencia1: null,
    vencExperiencia2: null,
    encarregado: null,
    vinculo: null,
    salarioBruto: null,
    valeRefeicao: null,
    valeRefeicaoFormula: null,
    dataDesligamento: null,
    desligamentoPrevisto: false,
    motivoDesligamento: null,
    telefone: null,
    epiCalca: null,
    epiCamisa: null,
    epiBotina: null,
  }
}

// ─── Conveniência: parse completo com mapeamento automático ──────────────────

export interface ResultadoParse {
  planilha: PlanilhaLida
  mapeamentos: { nomeAba: string; tipo: AbaTipo; mapeamento: MapeamentoColunas }[]
  linhas: LinhaImportacao[]
  avisos: string[]
}

export function parsePlanilhaFuncionarios(buffer: ArrayBuffer): ResultadoParse {
  const planilha = lerPlanilha(buffer)
  const mapeamentos: ResultadoParse['mapeamentos'] = []
  const linhas: LinhaImportacao[] = []
  for (const aba of planilha.abas) {
    if (!aba.tipo) continue
    const mapeamento = sugerirMapeamento(aba.tipo, aba.headers)
    mapeamentos.push({ nomeAba: aba.nomeAba, tipo: aba.tipo, mapeamento })
    linhas.push(...parseLinhasAba(aba, aba.tipo, mapeamento))
  }
  return { planilha, mapeamentos, linhas, avisos: planilha.avisos }
}

/** Açúcar pro browser: File → ResultadoParse. */
export async function parseArquivoFuncionarios(file: File): Promise<ResultadoParse> {
  const buffer = await file.arrayBuffer()
  return parsePlanilhaFuncionarios(buffer)
}
