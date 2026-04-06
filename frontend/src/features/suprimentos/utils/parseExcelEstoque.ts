/**
 * parseExcelEstoque.ts — Excel/CSV parsing utilities for Materiais & Estoque import.
 * Reuses the xlsx library already present in package.json.
 */
import * as XLSX from 'xlsx'
import type { ItemEstoque } from '@/types'

export interface ExcelPreview {
  headers: string[]
  rows: Record<string, string>[]   // first 20 rows, raw string values
}

// Known field names for auto-suggest mapping
const FIELD_HINTS: Record<string, string[]> = {
  descricao:           ['descrição', 'descricao', 'description', 'material', 'item', 'nome', 'produto'],
  unidade:             ['unidade', 'un', 'unit', 'und', 'medida'],
  qtdDisponivel:       ['qtd disponivel', 'quantidade disponivel', 'disponivel', 'estoque', 'saldo', 'quantidade', 'qtd', 'qty', 'qtdatual'],
  estoqueMinimo:       ['estoque minimo', 'minimo', 'min', 'estoque_min', 'qtd_minima', 'qtd min'],
  custoUnitario:       ['custo unitario', 'custo', 'preco', 'preço', 'valor', 'price', 'unit cost', 'custounit'],
  categoria:           ['categoria', 'category', 'grupo', 'tipo', 'class'],
  fornecedorPrincipal: ['fornecedor', 'supplier', 'vendor', 'fornecedorprincipal', 'fornec'],
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

/** Auto-suggest a field mapping for a detected Excel header. */
export function autoSuggestField(header: string): string {
  const n = normalize(header)
  for (const [field, hints] of Object.entries(FIELD_HINTS)) {
    if (hints.some((h) => n.includes(h) || h.includes(n))) {
      return field
    }
  }
  return 'ignorar'
}

/** Read an Excel/CSV file and return headers + first 20 rows. */
export function previewExcel(file: File): Promise<ExcelPreview> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb   = XLSX.read(data, { type: 'binary' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const raw  = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })

        if (raw.length === 0) {
          resolve({ headers: [], rows: [] })
          return
        }

        const headers = Object.keys(raw[0])
        const rows    = raw.slice(0, 20).map((r) =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))
        )
        resolve({ headers, rows })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsBinaryString(file)
  })
}

/** Apply a header→field mapping to raw rows and produce ItemEstoque shapes. */
export function applyColumnMapping(
  rows: Record<string, string>[],
  mapping: Record<string, string>,   // excelHeader → fieldName (or 'ignorar')
): Omit<ItemEstoque, 'id' | 'depositoId' | 'qtdReservada' | 'qtdTransito'>[] {
  // Invert mapping: fieldName → excelHeader
  const inv: Record<string, string> = {}
  for (const [header, field] of Object.entries(mapping)) {
    if (field !== 'ignorar') inv[field] = header
  }

  return rows
    .filter((row) => {
      const descCol = inv['descricao']
      return descCol ? row[descCol]?.trim() !== '' : true
    })
    .map((row) => {
      const str  = (field: string) => (inv[field] ? row[inv[field]]?.trim() ?? '' : '')
      const num  = (field: string) => {
        const raw = str(field).replace(',', '.')
        const v   = parseFloat(raw)
        return isNaN(v) ? 0 : v
      }
      return {
        descricao:           str('descricao')           || '—',
        unidade:             str('unidade')             || 'un',
        qtdDisponivel:       num('qtdDisponivel'),
        estoqueMinimo:       num('estoqueMinimo'),
        custoUnitario:       num('custoUnitario') || undefined,
        categoria:           str('categoria')           || undefined,
        fornecedorPrincipal: str('fornecedorPrincipal') || undefined,
      }
    })
}
