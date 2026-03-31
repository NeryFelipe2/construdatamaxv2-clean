/**
 * exportEngine.ts — CSV and print export utilities for the Planejamento module.
 *
 * Security:
 *  - escapeCell() strips control characters and prevents CSV formula injection
 *  - UTF-8 BOM ensures correct encoding in Excel/LibreOffice
 *  - No dangerouslySetInnerHTML, no eval
 */
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { GanttRow, SCurvePoint, AbcItem, HistogramPoint } from '@/types'

// ─── CSV Sanitization ────────────────────────────────────────────────────────

/**
 * Sanitize a single CSV cell value.
 * - Strips ASCII control characters (0x00–0x1F, 0x7F)
 * - Prefixes dangerous formula starters with a single-quote to neutralize them
 * - Wraps in double quotes; escapes internal double quotes by doubling them
 */
export function escapeCell(value: string | number | boolean | null | undefined): string {
  const str = String(value ?? '')
  // Strip control characters
  const cleaned = str.replace(/[\x00-\x1F\x7F]/g, '')
  // Neutralize formula injection
  const neutralized = /^[=+\-@\t\r]/.test(cleaned) ? `'${cleaned}` : cleaned
  // Quote and escape internal quotes
  return `"${neutralized.replace(/"/g, '""')}"`
}

function row(...cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(escapeCell).join(',')
}

function download(csv: string, filename: string): void {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// ─── Gantt / Schedule CSV ────────────────────────────────────────────────────

export function exportGanttCsv(ganttRows: GanttRow[], teamNames: string[]): void {
  const today = format(new Date(), 'yyyy-MM-dd')
  const lines: string[] = [
    row('Código', 'Descrição', 'Equipe', 'Início', 'Término', 'Teste Hidrostático',
        'Duração (dias)', 'Custo Diário (R$)', 'Custo Total (R$)', 'Metros'),
  ]

  for (const r of ganttRows) {
    const teamName = teamNames[r.teamIndex] ?? `Equipe ${r.teamIndex + 1}`
    lines.push(row(
      r.trecho.code,
      r.trecho.description,
      teamName,
      r.startDate,
      r.endDate,
      r.hydroTestDate,
      r.durationDays,
      r.dailyCostBRL.toFixed(2),
      r.totalCostBRL.toFixed(2),
      r.trecho.lengthM,
    ))
  }

  const total = ganttRows.reduce((s, r) => s + r.totalCostBRL, 0)
  lines.push(row('TOTAL', '', '', '', '', '', '', '', total.toFixed(2), ''))

  download(lines.join('\r\n'), `planejamento-cronograma-${today}.csv`)
}

// ─── S-Curve CSV ─────────────────────────────────────────────────────────────

export function exportSCurveCsv(points: SCurvePoint[]): void {
  const today = format(new Date(), 'yyyy-MM-dd')
  const lines: string[] = [
    row('Dia', 'Data', '% Físico Acumulado', '% Financeiro Acumulado',
        'Metros Acumulados', 'Custo Acumulado (R$)'),
  ]
  for (const p of points) {
    lines.push(row(
      p.dayIndex + 1,
      p.date,
      p.cumulativePhysicalPct.toFixed(2),
      p.cumulativeFinancialPct.toFixed(2),
      p.cumulativeMeters.toFixed(2),
      p.cumulativeCostBRL.toFixed(2),
    ))
  }
  download(lines.join('\r\n'), `planejamento-curva-s-${today}.csv`)
}

// ─── ABC CSV ─────────────────────────────────────────────────────────────────

export function exportAbcCsv(items: AbcItem[]): void {
  const today = format(new Date(), 'yyyy-MM-dd')
  const lines: string[] = [
    row('Código', 'Descrição', 'Metros', 'Custo Total (R$)', '% do Total', '% Acumulado', 'Zona'),
  ]
  for (const item of items) {
    lines.push(row(
      item.trecho.code,
      item.trecho.description,
      item.trecho.lengthM,
      item.totalCostBRL.toFixed(2),
      item.sharePct.toFixed(2),
      item.cumulativePct.toFixed(2),
      item.zone,
    ))
  }
  download(lines.join('\r\n'), `planejamento-curva-abc-${today}.csv`)
}

// ─── Histogram CSV ───────────────────────────────────────────────────────────

export function exportHistogramCsv(points: HistogramPoint[]): void {
  const today = format(new Date(), 'yyyy-MM-dd')
  const lines: string[] = [
    row('Dia', 'Data', 'Mão de Obra (pessoas)', 'Equipamentos (unid.)', 'Custo do Dia (R$)'),
  ]
  for (const p of points) {
    lines.push(row(
      p.dayIndex + 1,
      p.date,
      p.headcount,
      p.equipmentUnits,
      p.dailyCostBRL.toFixed(2),
    ))
  }
  download(lines.join('\r\n'), `planejamento-histograma-${today}.csv`)
}

// ─── Full Project CSV (combined) ─────────────────────────────────────────────

export function exportFullProjectCsv(
  ganttRows: GanttRow[],
  teamNames: string[],
  abcItems: AbcItem[],
  projectEndDate: string | null,
): void {
  const today = format(new Date(), 'yyyy-MM-dd')
  const lines: string[] = []

  // Header info
  lines.push(row('PLANEJAMENTO DE OBRAS', '', '', '', '', '', ''))
  lines.push(row('Exportado em:', today, '', '', '', '', ''))
  lines.push(row('Término Previsto:', projectEndDate ?? 'N/A', '', '', '', '', ''))
  lines.push(row('', '', '', '', '', '', ''))

  // Cronograma section
  lines.push(row('=== CRONOGRAMA DE EXECUÇÃO ===', '', '', '', '', '', ''))
  lines.push(row('Código', 'Descrição', 'Equipe', 'Início', 'Término', 'Duração (dias)', 'Custo Total (R$)'))
  for (const r of ganttRows) {
    const teamName = teamNames[r.teamIndex] ?? `Equipe ${r.teamIndex + 1}`
    lines.push(row(
      r.trecho.code,
      r.trecho.description,
      teamName,
      r.startDate,
      r.endDate,
      r.durationDays,
      r.totalCostBRL.toFixed(2),
    ))
  }
  lines.push(row('', '', '', '', '', '', ''))

  // ABC section
  lines.push(row('=== CURVA ABC — ANÁLISE DE CUSTOS ===', '', '', '', '', '', ''))
  lines.push(row('Código', 'Descrição', 'Custo Total (R$)', '% do Total', '% Acumulado', 'Zona', ''))
  for (const item of abcItems) {
    lines.push(row(
      item.trecho.code,
      item.trecho.description,
      item.totalCostBRL.toFixed(2),
      item.sharePct.toFixed(2),
      item.cumulativePct.toFixed(2),
      item.zone,
      '',
    ))
  }

  download(lines.join('\r\n'), `planejamento-completo-${today}.csv`)
}

// ─── Formatted date helper ───────────────────────────────────────────────────

export function fmtDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return dateStr
  }
}
