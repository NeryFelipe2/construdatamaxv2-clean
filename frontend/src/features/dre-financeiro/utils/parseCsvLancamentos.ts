/**
 * Parser de CSV para importação de lançamentos financeiros da DRE.
 * Sem dependência externa (papaparse não está no projeto) — parser simples que
 * lida com campos entre aspas, delimitador vírgula OU ponto-e-vírgula (auto-detectado)
 * e valores em formato brasileiro (vírgula decimal / ponto de milhar).
 *
 * Formato esperado (cabeçalho obrigatório, colunas por nome OU por ordem):
 *   tipo,categoria,descricao,valor,data
 *   RECEITA,Medição,Medição #1 rede água,150000,2026-07-05
 *   DESPESA,Material,Tubo PEAD DN63,22500,2026-06-25
 */

export type TipoLancamento = 'RECEITA' | 'DESPESA'

export interface ParsedLancamentoRow {
  lineNumber: number // linha no arquivo original (1 = cabeçalho)
  raw: { tipo: string; categoria: string; descricao: string; valor: string; data: string }
  tipo?: TipoLancamento
  categoria: string
  descricao: string
  valor?: number
  data: string | null // ISO yyyy-mm-dd ou null
  valid: boolean
  errors: string[]
}

export interface ParsedCsvResult {
  headerOk: boolean
  headers: string[]
  rows: ParsedLancamentoRow[]
}

const KNOWN_COLS = ['tipo', 'categoria', 'descricao', 'valor', 'data'] as const

const COMBINING_MARKS_RE = new RegExp('[\\u0300-\\u036f]', 'g')

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(COMBINING_MARKS_RE, '')
}

function normalizeHeader(h: string): string {
  return stripAccents(h.trim().toLowerCase())
}

function detectDelimiter(firstLine: string): string {
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  return semicolonCount > commaCount ? ';' : ','
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      result.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result.map((s) => s.trim())
}

function tokenizeCsv(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const delimiter = detectDelimiter(lines[0])
  return lines
    .map((l) => splitCsvLine(l, delimiter))
    .filter((cells) => cells.some((c) => c.trim().length > 0))
}

/** Aceita "150000", "150000.50" ou "150.000,50". Retorna null se não for número válido. */
export function parseValorBR(raw: string): number | null {
  let s = raw.trim().replace(/^R\$\s*/i, '').trim()
  if (!s) return null
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // formato BR: ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma && !hasDot) {
    // vírgula como separador decimal
    s = s.replace(',', '.')
  }
  // caso contrário (só ponto ou nenhum separador) já está em formato JS válido
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function isValidCalendarDate(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, mo - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d
}

/** Aceita vazio, "yyyy-mm-dd" ou "dd/mm/yyyy". Converte sempre para ISO yyyy-mm-dd. */
export function parseDataFlexivel(raw: string): { valid: boolean; iso: string | null; error?: string } {
  const s = raw.trim()
  if (!s) return { valid: true, iso: null }

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    const [, y, mo, d] = m
    if (isValidCalendarDate(+y, +mo, +d)) {
      return { valid: true, iso: `${y}-${String(+mo).padStart(2, '0')}-${String(+d).padStart(2, '0')}` }
    }
    return { valid: false, iso: null, error: 'Data inválida' }
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    if (isValidCalendarDate(+y, +mo, +d)) {
      return { valid: true, iso: `${y}-${String(+mo).padStart(2, '0')}-${String(+d).padStart(2, '0')}` }
    }
    return { valid: false, iso: null, error: 'Data inválida' }
  }

  return { valid: false, iso: null, error: 'Data em formato não reconhecido (use AAAA-MM-DD ou DD/MM/AAAA)' }
}

export function parseCsvLancamentos(text: string): ParsedCsvResult {
  const table = tokenizeCsv(text)
  if (table.length === 0) return { headerOk: false, headers: [], rows: [] }

  const header = table[0]
  const dataRows = table.slice(1)
  const normalizedHeaders = header.map(normalizeHeader)

  const byName: Partial<Record<(typeof KNOWN_COLS)[number], number>> = {}
  for (const col of KNOWN_COLS) {
    const idx = normalizedHeaders.findIndex((h) => h === col || (col === 'descricao' && h === 'descricao'))
    if (idx >= 0) byName[col] = idx
  }
  const useNamed = byName.tipo !== undefined && byName.valor !== undefined && byName.descricao !== undefined
  const colIndex: Record<(typeof KNOWN_COLS)[number], number> = useNamed
    ? {
        tipo: byName.tipo ?? -1,
        categoria: byName.categoria ?? -1,
        descricao: byName.descricao ?? -1,
        valor: byName.valor ?? -1,
        data: byName.data ?? -1,
      }
    : { tipo: 0, categoria: 1, descricao: 2, valor: 3, data: 4 }

  const rows: ParsedLancamentoRow[] = dataRows.map((cells, i) => {
    const get = (key: (typeof KNOWN_COLS)[number]) => {
      const idx = colIndex[key]
      return idx >= 0 && idx < cells.length ? cells[idx] : ''
    }

    const tipoRawStr = get('tipo')
    const tipoRaw = stripAccents(tipoRawStr.trim().toUpperCase())
    const categoria = get('categoria').trim() || 'Outro'
    const descricao = get('descricao').trim()
    const valorRaw = get('valor')
    const dataRaw = get('data')

    const errors: string[] = []
    let tipo: TipoLancamento | undefined
    if (tipoRaw === 'RECEITA' || tipoRaw === 'DESPESA') {
      tipo = tipoRaw
    } else {
      errors.push(`tipo inválido ("${tipoRawStr || '—'}") — use RECEITA ou DESPESA`)
    }

    const valor = parseValorBR(valorRaw)
    if (valor === null || !(valor > 0)) {
      errors.push(`valor inválido ("${valorRaw || '—'}")`)
    }

    if (!descricao) {
      errors.push('descrição vazia')
    }

    const dataParsed = parseDataFlexivel(dataRaw)
    if (!dataParsed.valid) {
      errors.push(dataParsed.error || 'data inválida')
    }

    return {
      lineNumber: i + 2,
      raw: { tipo: tipoRawStr, categoria: get('categoria'), descricao, valor: valorRaw, data: dataRaw },
      tipo,
      categoria,
      descricao,
      valor: valor ?? undefined,
      data: dataParsed.iso,
      valid: errors.length === 0,
      errors,
    }
  })

  return { headerOk: true, headers: header, rows }
}
