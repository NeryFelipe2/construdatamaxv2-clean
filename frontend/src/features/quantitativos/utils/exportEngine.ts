/**
 * exportEngine.ts — Excel (.xlsx), CSV, and print-PDF export for Quantitativos.
 * Uses SheetJS (xlsx) for Excel; custom escapeCell for CSV.
 * Security: no eval, no external requests; formula injection prevention in CSV.
 */
import * as XLSX from 'xlsx'
import type { OrcamentoItem, CustomBaseEntry } from '@/types'

// ─── CSV helper ───────────────────────────────────────────────────────────────

function escapeCell(value: string | number | null | undefined): string {
  const str = String(value ?? '').replace(/[\x00-\x1F\x7F]/g, '')
  const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
  return `"${neutralized.replace(/"/g, '""')}"`
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Group by category ────────────────────────────────────────────────────────

function groupByCategory(items: OrcamentoItem[]): Record<string, OrcamentoItem[]> {
  const groups: Record<string, OrcamentoItem[]> = {}
  items.forEach((i) => {
    if (!groups[i.category]) groups[i.category] = []
    groups[i.category].push(i)
  })
  return groups
}

// ─── Excel (.xlsx) export ─────────────────────────────────────────────────────

export function exportToXlsx(items: OrcamentoItem[], bdiGlobal: number, name = 'Orçamento') {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Composição ──────────────────────────────────────────────────────

  const headers1 = ['Código', 'Descrição', 'Unidade', 'Quantidade', 'Custo Unitário (R$)', 'BDI (%)', 'Total com BDI (R$)', 'Categoria', 'Fonte', 'Observações']
  const rows1 = items.map((i) => [
    i.code,
    i.description,
    i.unit,
    i.quantity,
    i.unitCost,
    i.bdi,
    i.totalCost,
    i.category,
    i.source.toUpperCase(),
    i.notes ?? '',
  ])

  const total = items.reduce((s, i) => s + i.totalCost, 0)
  rows1.push(['', 'TOTAL GERAL', '', '', '', '', total, '', '', ''])

  const ws1 = XLSX.utils.aoa_to_sheet([headers1, ...rows1])

  // Column widths
  ws1['!cols'] = [
    { wch: 14 },  // Código
    { wch: 55 },  // Descrição
    { wch: 10 },  // Unidade
    { wch: 12 },  // Quantidade
    { wch: 20 },  // Custo Unitário
    { wch: 10 },  // BDI
    { wch: 22 },  // Total
    { wch: 18 },  // Categoria
    { wch: 12 },  // Fonte
    { wch: 30 },  // Observações
  ]

  XLSX.utils.book_append_sheet(wb, ws1, 'Composição')

  // ── Sheet 2: Resumo por Categoria ────────────────────────────────────────────

  const groups = groupByCategory(items)
  const headers2 = ['Categoria', 'Qtd. de Itens', 'Subtotal s/ BDI (R$)', 'BDI Médio (%)', 'Total c/ BDI (R$)', '% do Total']

  const totalGlobal = items.reduce((s, i) => s + i.totalCost, 0)
  const rows2 = Object.entries(groups).map(([cat, catItems]) => {
    const subtotal = catItems.reduce((s, i) => s + i.quantity * i.unitCost, 0)
    const totalBDI = catItems.reduce((s, i) => s + i.totalCost, 0)
    const avgBdi = catItems.reduce((s, i) => s + i.bdi, 0) / catItems.length
    const pct = totalGlobal > 0 ? (totalBDI / totalGlobal) * 100 : 0
    return [cat, catItems.length, subtotal, avgBdi.toFixed(1), totalBDI, pct.toFixed(2) + '%']
  })
  rows2.push(['TOTAL', items.length, '', bdiGlobal.toFixed(1), totalGlobal, '100.00%'])

  const ws2 = XLSX.utils.aoa_to_sheet([headers2, ...rows2])
  ws2['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 12 }]

  XLSX.utils.book_append_sheet(wb, ws2, 'Resumo por Categoria')

  // ── Write and download ───────────────────────────────────────────────────────

  const filename = `${name.replace(/[^a-zA-Z0-9\-_À-ÿ ]/g, '_').trim()}_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
}

// ─── Custom base Excel export ─────────────────────────────────────────────────

export function exportCustomBaseToXlsx(entries: CustomBaseEntry[]) {
  const wb = XLSX.utils.book_new()
  const headers = ['Código', 'Descrição', 'Unidade', 'Custo Unitário (R$)', 'Categoria', 'Origem']
  const rows = entries.map((e) => [e.code, e.description, e.unit, e.unitCost, e.category, e.source])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [{ wch: 14 }, { wch: 55 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Base de Custos')
  XLSX.writeFile(wb, `base-custos-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ─── CSV export ───────────────────────────────────────────────────────────────

export function exportToCsv(items: OrcamentoItem[]) {
  const BOM = '\uFEFF'
  const header = [
    'Código', 'Descrição', 'Unidade', 'Quantidade', 'Custo Unitário (R$)',
    'BDI (%)', 'Total com BDI (R$)', 'Categoria', 'Fonte', 'Observações',
  ].map(escapeCell).join(',')

  const rows = items.map((i) =>
    [i.code, i.description, i.unit, i.quantity, fmtBRL(i.unitCost), i.bdi, fmtBRL(i.totalCost), i.category, i.source, i.notes ?? '']
      .map(escapeCell).join(',')
  )
  const total = items.reduce((s, i) => s + i.totalCost, 0)
  rows.push(['', 'TOTAL GERAL', '', '', '', '', fmtBRL(total), '', '', ''].map(escapeCell).join(','))

  const csv = BOM + [header, ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `orcamento-${new Date().toISOString().slice(0, 10)}.csv`
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function exportCustomBaseToCsv(entries: CustomBaseEntry[]) {
  const BOM = '\uFEFF'
  const header = ['Código', 'Descrição', 'Unidade', 'Custo Unitário (R$)', 'Categoria', 'Origem'].map(escapeCell).join(',')
  const rows = entries.map((e) => [e.code, e.description, e.unit, fmtBRL(e.unitCost), e.category, e.source].map(escapeCell).join(','))
  const csv = BOM + [header, ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `base-custos-${new Date().toISOString().slice(0, 10)}.csv`
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// ─── Parse Excel/CSV file → CustomBaseEntry[] ─────────────────────────────────

export function parseExcelToCustomBase(file: File): Promise<Omit<CustomBaseEntry, 'id'>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

        // Try to map common column names
        const entries: Omit<CustomBaseEntry, 'id'>[] = rows
          .filter((row) => row['Código'] || row['codigo'] || row['CODIGO'] || row['code'])
          .map((row) => {
            const code        = String(row['Código'] ?? row['codigo'] ?? row['CODIGO'] ?? row['code'] ?? '')
            const description = String(row['Descrição'] ?? row['descricao'] ?? row['DESCRICAO'] ?? row['description'] ?? '')
            const unit        = String(row['Unidade'] ?? row['unidade'] ?? row['UNIDADE'] ?? row['unit'] ?? 'un')
            const unitCost    = parseFloat(String(row['Custo Unitário (R$)'] ?? row['Custo Unitario'] ?? row['unitCost'] ?? row['preco'] ?? '0').replace(',', '.')) || 0
            const category    = String(row['Categoria'] ?? row['categoria'] ?? row['category'] ?? 'Geral')
            return { code, description, unit, unitCost, category, source: 'Importado Excel' }
          })

        resolve(entries)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsBinaryString(file)
  })
}
