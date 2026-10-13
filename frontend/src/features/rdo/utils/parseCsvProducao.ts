/**
 * Parser de CSV para importação de produção diária (aba Produção do RDO).
 * Estilo espelhado em `src/features/dre-financeiro/utils/parseCsvLancamentos.ts`
 * (mesmo padrão de robustez), porém escrito de forma independente aqui para não
 * acoplar o módulo RDO ao módulo DRE.
 *
 * Sem dependência externa — parser simples que lida com campos entre aspas,
 * delimitador vírgula OU ponto-e-vírgula (auto-detectado) e valores em formato
 * brasileiro (vírgula decimal / ponto de milhar).
 *
 * Cabeçalho esperado:
 *   data,nucleo,equipe,rua,la,le,pra_m,c_uma,pre_m,c_insp,pv,pi,lie,lia,ihm,int,obs
 *   2026-07-06,Boi Malhado,Equipe João Batista,Rua das Flores,2,1,45.5,1,0,0,1,0,2,1,0,0,Chuva à tarde
 */

export interface ParsedProducaoRow {
  lineNumber: number // linha no arquivo original (1 = cabeçalho)
  raw: Record<string, string>
  data: string | null // ISO yyyy-mm-dd ou null se inválida
  nucleo: string
  equipe: string
  rua: string
  la?: number
  le?: number
  praM?: number
  cUma?: number
  preM?: number
  cInsp?: number
  pv?: number
  pi?: number
  lie?: number
  lia?: number
  ihm?: number
  intercept?: number
  obs: string
  valid: boolean
  errors: string[]
}

export interface ParsedCsvProducaoResult {
  headerOk: boolean
  headers: string[]
  rows: ParsedProducaoRow[]
}

// Ordem exata do cabeçalho esperado (usada também como fallback posicional).
const KNOWN_COLS = [
  'data', 'nucleo', 'equipe', 'rua',
  'la', 'le', 'pra_m', 'c_uma', 'pre_m', 'c_insp',
  'pv', 'pi', 'lie', 'lia', 'ihm', 'int', 'obs',
] as const

type KnownCol = (typeof KNOWN_COLS)[number]

const INT_COLS: KnownCol[] = ['la', 'le', 'c_uma', 'c_insp', 'pv', 'pi', 'lie', 'lia', 'ihm', 'int']
const DECIMAL_COLS: KnownCol[] = ['pra_m', 'pre_m']

const COMBINING_MARKS_RE = new RegExp('[\\u0300-\\u036f]', 'g')

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(COMBINING_MARKS_RE, '')
}

function normalizeHeader(h: string): string {
  return stripAccents(h.trim().toLowerCase()).replace(/\s+/g, '_')
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
export function parseNumeroBR(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma && !hasDot) {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function isValidCalendarDate(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, mo - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d
}

/** Aceita "yyyy-mm-dd" ou "dd/mm/yyyy". Converte sempre para ISO yyyy-mm-dd. */
export function parseDataFlexivel(raw: string): { valid: boolean; iso: string | null; error?: string } {
  const s = raw.trim()
  if (!s) return { valid: false, iso: null, error: 'data obrigatória' }

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    const [, y, mo, d] = m
    if (isValidCalendarDate(+y, +mo, +d)) {
      return { valid: true, iso: `${y}-${String(+mo).padStart(2, '0')}-${String(+d).padStart(2, '0')}` }
    }
    return { valid: false, iso: null, error: 'data inválida' }
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    if (isValidCalendarDate(+y, +mo, +d)) {
      return { valid: true, iso: `${y}-${String(+mo).padStart(2, '0')}-${String(+d).padStart(2, '0')}` }
    }
    return { valid: false, iso: null, error: 'data inválida' }
  }

  return { valid: false, iso: null, error: 'data em formato não reconhecido (use AAAA-MM-DD ou DD/MM/AAAA)' }
}

export function parseCsvProducao(text: string): ParsedCsvProducaoResult {
  const table = tokenizeCsv(text)
  if (table.length === 0) return { headerOk: false, headers: [], rows: [] }

  const header = table[0]
  const dataRows = table.slice(1)
  const normalizedHeaders = header.map(normalizeHeader)

  const byName: Partial<Record<KnownCol, number>> = {}
  for (const col of KNOWN_COLS) {
    const idx = normalizedHeaders.findIndex((h) => h === col)
    if (idx >= 0) byName[col] = idx
  }
  // Cabeçalho nomeado só é confiável se pelo menos "data" e algumas colunas numéricas baterem.
  const useNamed = byName.data !== undefined && byName.la !== undefined && byName.le !== undefined
  const colIndex: Record<KnownCol, number> = useNamed
    ? (Object.fromEntries(KNOWN_COLS.map((c) => [c, byName[c] ?? -1])) as Record<KnownCol, number>)
    : (Object.fromEntries(KNOWN_COLS.map((c, i) => [c, i])) as Record<KnownCol, number>)

  const rows: ParsedProducaoRow[] = dataRows.map((cells, i) => {
    const get = (key: KnownCol) => {
      const idx = colIndex[key]
      return idx >= 0 && idx < cells.length ? cells[idx] : ''
    }

    const raw: Record<string, string> = {}
    for (const col of KNOWN_COLS) raw[col] = get(col)

    const errors: string[] = []

    const dataParsed = parseDataFlexivel(get('data'))
    if (!dataParsed.valid) errors.push(dataParsed.error || 'data inválida')

    const parsedInt: Partial<Record<KnownCol, number>> = {}
    for (const col of INT_COLS) {
      const rawVal = get(col)
      if (!rawVal.trim()) {
        parsedInt[col] = 0
        continue
      }
      const n = parseNumeroBR(rawVal)
      if (n === null || !Number.isFinite(n)) {
        errors.push(`${col} inválido ("${rawVal}")`)
      } else {
        parsedInt[col] = Math.round(n)
      }
    }

    const parsedDec: Partial<Record<KnownCol, number>> = {}
    for (const col of DECIMAL_COLS) {
      const rawVal = get(col)
      if (!rawVal.trim()) {
        parsedDec[col] = 0
        continue
      }
      const n = parseNumeroBR(rawVal)
      if (n === null || !Number.isFinite(n)) {
        errors.push(`${col} inválido ("${rawVal}")`)
      } else {
        parsedDec[col] = n
      }
    }

    return {
      lineNumber: i + 2,
      raw,
      data: dataParsed.iso,
      nucleo: get('nucleo'),
      equipe: get('equipe'),
      rua: get('rua'),
      la: parsedInt.la,
      le: parsedInt.le,
      praM: parsedDec.pra_m,
      cUma: parsedInt.c_uma,
      preM: parsedDec.pre_m,
      cInsp: parsedInt.c_insp,
      pv: parsedInt.pv,
      pi: parsedInt.pi,
      lie: parsedInt.lie,
      lia: parsedInt.lia,
      ihm: parsedInt.ihm,
      intercept: parsedInt.int,
      obs: get('obs'),
      valid: errors.length === 0,
      errors,
    }
  })

  return { headerOk: true, headers: header, rows }
}
