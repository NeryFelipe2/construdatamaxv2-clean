/**
 * Parser de CSV para importação de linhas de custo do Estudo de Viabilidade.
 * Reusa a mesma abordagem de tokenização/parse de valor BR de
 * `dre-financeiro/utils/parseCsvLancamentos.ts` (sem dependência externa).
 *
 * Formato esperado (cabeçalho obrigatório):
 *   grupo,descricao,valor
 *   Materiais,Tubo PEAD DN63,22500
 *   Mão de Obra,Equipe rede água,45000
 */
import { parseValorBR } from '@/features/dre-financeiro/utils/parseCsvLancamentos'
import type { ViabilidadeGrupoCusto } from './computeViabilidade'

const GRUPOS_VALIDOS: ViabilidadeGrupoCusto['grupo'][] = ['Materiais', 'Mão de Obra', 'Equipamentos', 'CI', 'Subempreiteiros']

const COMBINING_MARKS_RE = new RegExp('[\\u0300-\\u036f]', 'g')
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(COMBINING_MARKS_RE, '')
}
function normalize(s: string): string {
  return stripAccents(s.trim().toLowerCase())
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
      } else { cur += ch }
    } else if (ch === '"') { inQuotes = true }
    else if (ch === delimiter) { result.push(cur); cur = '' }
    else { cur += ch }
  }
  result.push(cur)
  return result.map((s) => s.trim())
}

function tokenize(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const delimiter = detectDelimiter(lines[0])
  return lines.map((l) => splitCsvLine(l, delimiter)).filter((cells) => cells.some((c) => c.trim().length > 0))
}

/** Resolve o nome do grupo ignorando acentos/maiúsculas (ex: "mao de obra" -> "Mão de Obra"). */
function resolveGrupo(raw: string): ViabilidadeGrupoCusto['grupo'] | null {
  const n = normalize(raw)
  const found = GRUPOS_VALIDOS.find((g) => normalize(g) === n)
  return found ?? null
}

export interface ParsedViabilidadeRow {
  lineNumber: number
  raw: { grupo: string; descricao: string; valor: string }
  grupo?: ViabilidadeGrupoCusto['grupo']
  descricao: string
  valor?: number
  valid: boolean
  errors: string[]
}

export interface ParsedViabilidadeCsvResult {
  headerOk: boolean
  rows: ParsedViabilidadeRow[]
}

export function parseCsvViabilidade(text: string): ParsedViabilidadeCsvResult {
  const table = tokenize(text)
  if (table.length === 0) return { headerOk: false, rows: [] }

  const header = table[0].map(normalize)
  const dataRows = table.slice(1)
  const idxGrupo = header.findIndex((h) => h === 'grupo')
  const idxDesc = header.findIndex((h) => h === 'descricao')
  const idxValor = header.findIndex((h) => h === 'valor')
  const useNamed = idxGrupo >= 0 && idxDesc >= 0 && idxValor >= 0
  const cols = useNamed ? { grupo: idxGrupo, descricao: idxDesc, valor: idxValor } : { grupo: 0, descricao: 1, valor: 2 }

  const rows: ParsedViabilidadeRow[] = dataRows.map((cells, i) => {
    const get = (idx: number) => (idx >= 0 && idx < cells.length ? cells[idx] : '')
    const grupoRaw = get(cols.grupo)
    const descricao = get(cols.descricao).trim()
    const valorRaw = get(cols.valor)

    const errors: string[] = []
    const grupo = resolveGrupo(grupoRaw) ?? undefined
    if (!grupo) errors.push(`grupo inválido ("${grupoRaw || '—'}") — use um de: ${GRUPOS_VALIDOS.join(', ')}`)
    if (!descricao) errors.push('descrição vazia')
    const valor = parseValorBR(valorRaw)
    if (valor === null || !(valor > 0)) errors.push(`valor inválido ("${valorRaw || '—'}")`)

    return {
      lineNumber: i + 2,
      raw: { grupo: grupoRaw, descricao, valor: valorRaw },
      grupo,
      descricao,
      valor: valor ?? undefined,
      valid: errors.length === 0,
      errors,
    }
  })

  return { headerOk: true, rows }
}
