/**
 * Parser de CSV para importação de projeções de Fluxo de Caixa (`fluxo_projecao`).
 * Mesmo estilo/robustez do parseCsvLancamentos.ts (reaproveita parseValorBR de lá):
 * sem dependência externa, delimitador vírgula OU ponto-e-vírgula (auto-detectado),
 * valores em formato brasileiro (vírgula decimal / ponto de milhar).
 *
 * Formato esperado (cabeçalho obrigatório, colunas por nome OU por ordem):
 *   mes,recebimento_prev,despesa_prev,obs
 *   2026-08,180000,95000,Medição prevista trecho 4
 *   08/2026,180000,95000,
 *
 * `mes` aceita "YYYY-MM" ou "MM/YYYY" — sempre normalizado pro dia 01 (YYYY-MM-01).
 */
import { parseValorBR } from './parseCsvLancamentos'

export interface ParsedFluxoRow {
  lineNumber: number // linha no arquivo original (1 = cabeçalho)
  raw: { mes: string; recebimento_prev: string; despesa_prev: string; obs: string }
  mes: string | null // ISO yyyy-mm-01 ou null se inválido
  recebimento_prev?: number
  despesa_prev?: number
  obs: string
  valid: boolean
  errors: string[]
}

export interface ParsedCsvFluxoResult {
  headerOk: boolean
  headers: string[]
  rows: ParsedFluxoRow[]
}

const KNOWN_COLS = ['mes', 'recebimento_prev', 'despesa_prev', 'obs'] as const

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

/** Aceita "YYYY-MM" ou "MM/YYYY". Retorna ISO "YYYY-MM-01" ou inválido. */
export function parseMesFlexivel(raw: string): { valid: boolean; iso: string | null; error?: string } {
  const s = raw.trim()
  if (!s) return { valid: false, iso: null, error: 'mês obrigatório' }

  let m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/)
  if (m) {
    const [, y, mo] = m
    const moNum = Number(mo)
    if (moNum >= 1 && moNum <= 12) {
      return { valid: true, iso: `${y}-${String(moNum).padStart(2, '0')}-01` }
    }
    return { valid: false, iso: null, error: 'mês inválido (1-12)' }
  }

  m = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (m) {
    const [, mo, y] = m
    const moNum = Number(mo)
    if (moNum >= 1 && moNum <= 12) {
      return { valid: true, iso: `${y}-${String(moNum).padStart(2, '0')}-01` }
    }
    return { valid: false, iso: null, error: 'mês inválido (1-12)' }
  }

  return { valid: false, iso: null, error: 'formato não reconhecido (use AAAA-MM ou MM/AAAA)' }
}

export function parseCsvFluxo(text: string): ParsedCsvFluxoResult {
  const table = tokenizeCsv(text)
  if (table.length === 0) return { headerOk: false, headers: [], rows: [] }

  const header = table[0]
  const dataRows = table.slice(1)
  const normalizedHeaders = header.map(normalizeHeader)

  const byName: Partial<Record<(typeof KNOWN_COLS)[number], number>> = {}
  for (const col of KNOWN_COLS) {
    const idx = normalizedHeaders.findIndex((h) => h === col)
    if (idx >= 0) byName[col] = idx
  }
  const useNamed = byName.mes !== undefined && byName.recebimento_prev !== undefined
  const colIndex: Record<(typeof KNOWN_COLS)[number], number> = useNamed
    ? {
        mes: byName.mes ?? -1,
        recebimento_prev: byName.recebimento_prev ?? -1,
        despesa_prev: byName.despesa_prev ?? -1,
        obs: byName.obs ?? -1,
      }
    : { mes: 0, recebimento_prev: 1, despesa_prev: 2, obs: 3 }

  const rows: ParsedFluxoRow[] = dataRows.map((cells, i) => {
    const get = (key: (typeof KNOWN_COLS)[number]) => {
      const idx = colIndex[key]
      return idx >= 0 && idx < cells.length ? cells[idx] : ''
    }

    const mesRaw = get('mes')
    const recebRaw = get('recebimento_prev')
    const despRaw = get('despesa_prev')
    const obs = get('obs').trim()

    const errors: string[] = []

    const mesParsed = parseMesFlexivel(mesRaw)
    if (!mesParsed.valid) errors.push(mesParsed.error || 'mês inválido')

    const recebimento_prev = recebRaw.trim() === '' ? 0 : parseValorBR(recebRaw)
    if (recebimento_prev === null || recebimento_prev < 0) {
      errors.push(`recebimento_prev inválido ("${recebRaw || '—'}")`)
    }

    const despesa_prev = despRaw.trim() === '' ? 0 : parseValorBR(despRaw)
    if (despesa_prev === null || despesa_prev < 0) {
      errors.push(`despesa_prev inválido ("${despRaw || '—'}")`)
    }

    return {
      lineNumber: i + 2,
      raw: { mes: mesRaw, recebimento_prev: recebRaw, despesa_prev: despRaw, obs },
      mes: mesParsed.iso,
      recebimento_prev: recebimento_prev ?? undefined,
      despesa_prev: despesa_prev ?? undefined,
      obs,
      valid: errors.length === 0,
      errors,
    }
  })

  return { headerOk: true, headers: header, rows }
}
