/**
 * Parser de CSV para "Ligações & OS" (missão E5) — dois formatos:
 *   matriz:      nucleo,mes,la,le,cadastradas
 *   pendências:  nucleo,endereco,la,le,tipo,motivo
 * Sem dependência externa — parser próprio (mesmo estilo de parseCsvLancamentos.ts):
 * lida com campos entre aspas, delimitador vírgula OU ponto-e-vírgula (auto-detectado).
 *
 * BLINDAGEM PII (LGPD) — OBRIGATÓRIA E INEGOCIÁVEL:
 * A planilha de origem ("Levantamento de Ligações - OS SISTEMA") tem uma aba (Sheet0)
 * com nome/CPF/RG de morador que está PERMANENTEMENTE EXCLUÍDA deste sistema. Se o
 * cabeçalho do CSV enviado aqui contiver qualquer coluna que bata (case-insensitive,
 * sem acento) com cpf|rg|nascimento|nasc|documento|rghg|titular|morador, a importação
 * INTEIRA é recusada antes de qualquer parsing de linha — nunca entra no banco.
 */

export type TipoLigacao = 'agua' | 'esgoto'

const PII_MARKERS = ['cpf', 'rg', 'nascimento', 'nasc', 'documento', 'rghg', 'titular', 'morador'] as const

const COMBINING_MARKS_RE = new RegExp('[\\u0300-\\u036f]', 'g')

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(COMBINING_MARKS_RE, '')
}

function normalizeHeader(h: string): string {
  return stripAccents(h.trim().toLowerCase())
}

/** Retorna os nomes de coluna (originais) que batem com algum marcador de PII. */
export function detectarColunasPii(headers: string[]): string[] {
  const achadas: string[] = []
  for (const raw of headers) {
    const norm = normalizeHeader(raw)
    if (!norm) continue
    if (PII_MARKERS.some((marker) => norm.includes(marker))) achadas.push(raw)
  }
  return achadas
}

export function mensagemBlindagemPii(colunas: string[]): string {
  return `Arquivo contém dados pessoais (LGPD) — remova as colunas ${colunas.join(', ')} antes de importar.`
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
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = false }
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
  return lines.map((l) => splitCsvLine(l, delimiter)).filter((cells) => cells.some((c) => c.trim().length > 0))
}

function parseIntFlexivel(raw: string): number | null {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/** Aceita "YYYY-MM" ou "YYYY-MM-DD". Normaliza sempre pro dia 01 do mês (ISO). */
function parseMesFlexivel(raw: string): { valid: boolean; iso: string | null; error?: string } {
  const s = raw.trim()
  if (!s) return { valid: false, iso: null, error: 'mês vazio' }
  const m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/)
  if (m) {
    const [, y, mo] = m
    const moN = +mo
    if (moN >= 1 && moN <= 12) return { valid: true, iso: `${y}-${String(moN).padStart(2, '0')}-01` }
  }
  return { valid: false, iso: null, error: 'mês em formato não reconhecido (use AAAA-MM)' }
}

// ── Matriz núcleo × mês ──

export interface ParsedMatrizRow {
  lineNumber: number
  raw: { nucleo: string; mes: string; la: string; le: string; cadastradas: string }
  nucleo: string
  mes: string | null
  la?: number
  le?: number
  cadastradas?: number
  valid: boolean
  errors: string[]
}

export interface ParsedCsvResult<T> {
  headerOk: boolean
  piiBlocked: boolean
  piiColumns: string[]
  headers: string[]
  rows: T[]
}

const MATRIZ_COLS = ['nucleo', 'mes', 'la', 'le', 'cadastradas'] as const

export function parseCsvMatrizLigacoes(text: string): ParsedCsvResult<ParsedMatrizRow> {
  const table = tokenizeCsv(text)
  if (table.length === 0) return { headerOk: false, piiBlocked: false, piiColumns: [], headers: [], rows: [] }

  const header = table[0]
  const piiColumns = detectarColunasPii(header)
  if (piiColumns.length > 0) {
    return { headerOk: true, piiBlocked: true, piiColumns, headers: header, rows: [] }
  }

  const dataRows = table.slice(1)
  const normalizedHeaders = header.map(normalizeHeader)
  const byName: Partial<Record<(typeof MATRIZ_COLS)[number], number>> = {}
  for (const col of MATRIZ_COLS) {
    const idx = normalizedHeaders.findIndex((h) => h === col)
    if (idx >= 0) byName[col] = idx
  }
  const useNamed = byName.nucleo !== undefined && byName.mes !== undefined && byName.la !== undefined
  const colIndex: Record<(typeof MATRIZ_COLS)[number], number> = useNamed
    ? { nucleo: byName.nucleo ?? -1, mes: byName.mes ?? -1, la: byName.la ?? -1, le: byName.le ?? -1, cadastradas: byName.cadastradas ?? -1 }
    : { nucleo: 0, mes: 1, la: 2, le: 3, cadastradas: 4 }

  const rows: ParsedMatrizRow[] = dataRows.map((cells, i) => {
    const get = (key: (typeof MATRIZ_COLS)[number]) => {
      const idx = colIndex[key]
      return idx >= 0 && idx < cells.length ? cells[idx] : ''
    }
    const nucleo = get('nucleo').trim()
    const mesRaw = get('mes')
    const laRaw = get('la')
    const leRaw = get('le')
    const cadastradasRaw = get('cadastradas')

    const errors: string[] = []
    if (!nucleo) errors.push('núcleo vazio')

    const mesParsed = parseMesFlexivel(mesRaw)
    if (!mesParsed.valid) errors.push(mesParsed.error || 'mês inválido')

    const la = parseIntFlexivel(laRaw)
    if (la === null || la < 0) errors.push(`LA inválido ("${laRaw || '—'}")`)

    const le = parseIntFlexivel(leRaw)
    if (le === null || le < 0) errors.push(`LE inválido ("${leRaw || '—'}")`)

    const cadastradas = parseIntFlexivel(cadastradasRaw)
    if (cadastradas === null || cadastradas < 0) errors.push(`cadastradas inválido ("${cadastradasRaw || '—'}")`)

    return {
      lineNumber: i + 2,
      raw: { nucleo, mes: mesRaw, la: laRaw, le: leRaw, cadastradas: cadastradasRaw },
      nucleo,
      mes: mesParsed.iso,
      la: la ?? undefined,
      le: le ?? undefined,
      cadastradas: cadastradas ?? undefined,
      valid: errors.length === 0,
      errors,
    }
  })

  return { headerOk: true, piiBlocked: false, piiColumns: [], headers: header, rows }
}

// ── Pendências ──

export interface ParsedPendenciaRow {
  lineNumber: number
  raw: { nucleo: string; endereco: string; la: string; le: string; tipo: string; motivo: string }
  nucleo: string
  endereco: string
  la?: number
  le?: number
  tipo?: TipoLigacao
  motivo: string
  valid: boolean
  errors: string[]
}

const PENDENCIA_COLS = ['nucleo', 'endereco', 'la', 'le', 'tipo', 'motivo'] as const

export function parseCsvPendenciasLigacoes(text: string): ParsedCsvResult<ParsedPendenciaRow> {
  const table = tokenizeCsv(text)
  if (table.length === 0) return { headerOk: false, piiBlocked: false, piiColumns: [], headers: [], rows: [] }

  const header = table[0]
  const piiColumns = detectarColunasPii(header)
  if (piiColumns.length > 0) {
    return { headerOk: true, piiBlocked: true, piiColumns, headers: header, rows: [] }
  }

  const dataRows = table.slice(1)
  const normalizedHeaders = header.map(normalizeHeader)
  const byName: Partial<Record<(typeof PENDENCIA_COLS)[number], number>> = {}
  for (const col of PENDENCIA_COLS) {
    const idx = normalizedHeaders.findIndex((h) => h === col)
    if (idx >= 0) byName[col] = idx
  }
  const useNamed = byName.nucleo !== undefined && byName.endereco !== undefined
  const colIndex: Record<(typeof PENDENCIA_COLS)[number], number> = useNamed
    ? {
        nucleo: byName.nucleo ?? -1,
        endereco: byName.endereco ?? -1,
        la: byName.la ?? -1,
        le: byName.le ?? -1,
        tipo: byName.tipo ?? -1,
        motivo: byName.motivo ?? -1,
      }
    : { nucleo: 0, endereco: 1, la: 2, le: 3, tipo: 4, motivo: 5 }

  const rows: ParsedPendenciaRow[] = dataRows.map((cells, i) => {
    const get = (key: (typeof PENDENCIA_COLS)[number]) => {
      const idx = colIndex[key]
      return idx >= 0 && idx < cells.length ? cells[idx] : ''
    }
    const nucleo = get('nucleo').trim()
    const endereco = get('endereco').trim()
    const laRaw = get('la')
    const leRaw = get('le')
    const tipoRaw = get('tipo')
    const motivo = get('motivo').trim()

    const errors: string[] = []
    if (!nucleo) errors.push('núcleo vazio')
    if (!endereco) errors.push('endereço vazio')

    const la = laRaw.trim() ? parseIntFlexivel(laRaw) : 0
    if (la === null || la < 0) errors.push(`LA inválido ("${laRaw || '—'}")`)

    const le = leRaw.trim() ? parseIntFlexivel(leRaw) : 0
    if (le === null || le < 0) errors.push(`LE inválido ("${leRaw || '—'}")`)

    const tipoNorm = stripAccents(tipoRaw.trim().toLowerCase())
    let tipo: TipoLigacao | undefined
    if (tipoNorm === 'agua') tipo = 'agua'
    else if (tipoNorm === 'esgoto') tipo = 'esgoto'
    else errors.push(`tipo inválido ("${tipoRaw || '—'}") — use agua ou esgoto`)

    if (!motivo) errors.push('motivo vazio')

    return {
      lineNumber: i + 2,
      raw: { nucleo, endereco, la: laRaw, le: leRaw, tipo: tipoRaw, motivo },
      nucleo,
      endereco,
      la: la ?? undefined,
      le: le ?? undefined,
      tipo,
      motivo,
      valid: errors.length === 0,
      errors,
    }
  })

  return { headerOk: true, piiBlocked: false, piiColumns: [], headers: header, rows }
}
