/**
 * relatorio360PdfExport.ts
 * Opens a styled A4 print window for Relatório 360.
 * Uses window.print() — no external PDF library needed.
 * Mirrors the pattern from src/features/rdo/utils/rdoPdfExport.ts.
 */
import type { DailyReport } from '@/types'

function fmtDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function fmtCurrency(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

const STATUS_LABEL: Record<string, string> = {
  planned:     'Planejado',
  in_progress: 'Em andamento',
  completed:   'Concluído',
}

const STATUS_COLOR: Record<string, string> = {
  planned:     '#6b7280',
  in_progress: '#f59e0b',
  completed:   '#22c55e',
}

function aggregateReports(reports: DailyReport[]): DailyReport {
  // Merge multiple reports into one aggregate for period export
  const base = reports[0]
  const actMap: Map<string, DailyReport['activities'][number]> = new Map()
  const crewMap: Map<string, DailyReport['crews'][number]> = new Map()
  const equipLogs: DailyReport['equipmentLogs'] = []
  const matLogs: DailyReport['materialLogs'] = []
  const photos: DailyReport['photos'] = []

  for (const r of reports) {
    for (const a of r.activities) actMap.set(a.id, a)
    for (const c of r.crews) crewMap.set(c.id, c)
    equipLogs.push(...r.equipmentLogs)
    matLogs.push(...r.materialLogs)
    photos.push(...r.photos)
  }

  return {
    ...base,
    activities: Array.from(actMap.values()),
    crews: Array.from(crewMap.values()),
    equipmentLogs: equipLogs,
    materialLogs: matLogs,
    photos: photos.slice(0, 18),
  }
}

function buildHtml(report: DailyReport, title: string, subtitle: string): string {
  const totalEquipHours = report.equipmentLogs.reduce((s, l) => s + l.utilizationHours, 0)
  const totalEquipCost  = report.equipmentLogs.reduce((s, l) => s + l.utilizationHours * l.hourlyRate, 0)
  const totalLaborCost  = report.crews.reduce((s, c) => s + c.timecards.reduce((t, tc) => t + tc.hoursWorked * tc.hourlyRate, 0), 0)
  const totalCost       = totalEquipCost + totalLaborCost

  // Activities table
  const activitiesHtml = report.activities.length
    ? report.activities.map((a) => {
        const crew = report.crews.find((c) => c.id === a.crewId)
        const pct  = a.plannedQty > 0 ? Math.round((a.actualQty / a.plannedQty) * 100) : 0
        return `<tr>
          <td>${a.name}</td>
          <td style="text-align:right">${a.plannedQty.toLocaleString('pt-BR')} ${a.unit}</td>
          <td style="text-align:right">${a.actualQty.toLocaleString('pt-BR')} ${a.unit}</td>
          <td style="text-align:center">${a.unit}</td>
          <td>${crew ? crew.foremanName : '—'}</td>
          <td style="text-align:center;color:${STATUS_COLOR[a.status] ?? '#6b7280'};font-weight:600">
            ${STATUS_LABEL[a.status] ?? a.status} (${pct}%)
          </td>
        </tr>`
      }).join('')
    : '<tr><td colspan="6" style="color:#6b7280;font-style:italic">Sem atividades</td></tr>'

  // Crews section
  const crewsHtml = report.crews.map((crew) => {
    const crewCost = crew.timecards.reduce((s, t) => s + t.hoursWorked * t.hourlyRate, 0)
    const rows = crew.timecards.map((tc) => `<tr>
      <td>${tc.workerName}</td>
      <td>${tc.role}</td>
      <td style="text-align:right">${tc.hoursWorked.toFixed(1)}h</td>
      <td style="text-align:right">${fmtCurrency(tc.hourlyRate)}/h</td>
      <td style="text-align:right;font-weight:600">${fmtCurrency(tc.hoursWorked * tc.hourlyRate)}</td>
    </tr>`).join('')

    return `<div class="crew-section">
      <div class="crew-header">
        <strong>${crew.foremanName}</strong>
        <span class="badge">${crew.crewType}</span>
        <span style="margin-left:auto;color:#2abfdc;font-weight:700">${fmtCurrency(crewCost)}</span>
      </div>
      <table>
        <thead><tr>
          <th>Trabalhador</th><th>Função</th>
          <th style="text-align:right">Horas</th>
          <th style="text-align:right">Taxa</th>
          <th style="text-align:right">Custo</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
  }).join('')

  // Equipment table
  const equipHtml = report.equipmentLogs.length
    ? report.equipmentLogs.map((l) => {
        const act = report.activities.find((a) => a.id === l.activityId)
        return `<tr>
          <td><code>${l.equipmentId}</code><br/><small>${l.type}</small></td>
          <td>${act?.name ?? '—'}</td>
          <td style="text-align:right">${l.utilizationHours.toFixed(1)}h</td>
          <td style="text-align:right;font-weight:600">${fmtCurrency(l.utilizationHours * l.hourlyRate)}</td>
        </tr>`
      }).join('')
    : '<tr><td colspan="4" style="color:#6b7280;font-style:italic">Sem registros</td></tr>'

  // Materials table
  const materialsHtml = report.materialLogs.length
    ? report.materialLogs.map((l) => {
        const act = report.activities.find((a) => a.id === l.activityId)
        return `<tr>
          <td><code>${l.materialId}</code></td>
          <td>${act?.name ?? '—'}</td>
          <td style="text-align:right">${l.quantity.toLocaleString('pt-BR')}</td>
          <td style="text-align:center">${l.unit}</td>
        </tr>`
      }).join('')
    : '<tr><td colspan="4" style="color:#6b7280;font-style:italic">Sem registros</td></tr>'

  // Photos grid
  const photosHtml = report.photos.length
    ? `<div class="photo-grid">
        ${report.photos.map((p) => `
          <figure class="photo-item">
            <img src="${p.base64}" alt="${p.label}" />
            <figcaption>${p.label}</figcaption>
          </figure>`).join('')}
       </div>`
    : '<p style="color:#6b7280;font-style:italic">Sem registros fotográficos</p>'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 14mm 14mm 18mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 9.5pt; color: #111827; background: #fff; }

    .cover {
      display: flex; align-items: center; gap: 14px;
      padding: 18px 0 12px; border-bottom: 3px solid #2abfdc; margin-bottom: 16px;
    }
    .cover-logo {
      width: 44px; height: 44px; background: #2abfdc; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18pt; color: #fff; font-weight: 900; flex-shrink: 0;
    }
    .cover-title  { font-size: 17pt; font-weight: 800; color: #111; }
    .cover-sub    { font-size: 9pt; color: #6b7280; margin-top: 2px; }
    .cover-badges { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; justify-content: flex-end; }

    .badge {
      font-size: 8pt; font-weight: 700; padding: 3px 10px; border-radius: 20px;
      background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb;
    }

    .metrics { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 14px; }
    .metric-card {
      border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px;
    }
    .metric-label { font-size: 7.5pt; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
    .metric-value { font-size: 13pt; font-weight: 800; color: #111; }

    .section { margin-bottom: 14px; break-inside: avoid; }
    .section-header {
      font-size: 10pt; font-weight: 700; color: #fff; background: #1e293b;
      padding: 6px 12px; border-radius: 6px 6px 0 0; margin-bottom: 0;
      display: flex; align-items: center; gap: 8px;
    }
    .section-dot { width: 8px; height: 8px; border-radius: 50%; background: #2abfdc; flex-shrink: 0; }

    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    th { background: #f8fafc; padding: 5px 8px; text-align: left; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
    td { padding: 4.5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tr:hover td { background: #f8fafc; }

    .crew-section { margin-bottom: 12px; }
    .crew-header {
      display: flex; align-items: center; gap: 8px;
      background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px;
      padding: 6px 10px; margin-bottom: 4px; font-size: 9pt;
    }

    .photo-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 6px; }
    .photo-item { break-inside: avoid; }
    .photo-item img { width: 100%; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; }
    .photo-item figcaption { font-size: 7pt; color: #6b7280; text-align: center; margin-top: 3px; }

    .footer {
      position: fixed; bottom: 0; left: 0; right: 0;
      display: flex; justify-content: space-between;
      font-size: 7pt; color: #9ca3af;
      padding: 6px 14mm; border-top: 1px solid #e5e7eb; background: #fff;
    }
    @media print { .footer { position: fixed; } }
  </style>
</head>
<body>
  <!-- Cover -->
  <div class="cover">
    <div class="cover-logo">R360</div>
    <div>
      <div class="cover-title">Relatório 360</div>
      <div class="cover-sub">${report.projectName} · ${subtitle}</div>
    </div>
    <div class="cover-badges">
      <span class="badge">${fmtDate(report.date)}</span>
    </div>
  </div>

  <!-- Resumo -->
  <div class="metrics">
    <div class="metric-card">
      <div class="metric-label">Atividades</div>
      <div class="metric-value">${report.activities.length}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Equipes</div>
      <div class="metric-value">${report.crews.length}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Horas Equip.</div>
      <div class="metric-value">${totalEquipHours.toFixed(1)}h</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Custo Total</div>
      <div class="metric-value">${fmtCurrency(totalCost)}</div>
    </div>
  </div>

  <!-- Atividades -->
  <div class="section">
    <div class="section-header"><span class="section-dot"></span> Atividades do Dia</div>
    <table>
      <thead><tr>
        <th>Nome</th><th style="text-align:right">Planejado</th>
        <th style="text-align:right">Realizado</th><th style="text-align:center">Un.</th>
        <th>Equipe</th><th style="text-align:center">Status</th>
      </tr></thead>
      <tbody>${activitiesHtml}</tbody>
    </table>
  </div>

  <!-- Equipes -->
  <div class="section">
    <div class="section-header"><span class="section-dot"></span> Equipes em Campo</div>
    <div style="margin-top:8px">${crewsHtml || '<p style="padding:8px;color:#6b7280;font-style:italic">Sem equipes</p>'}</div>
  </div>

  <!-- Equipamentos -->
  <div class="section">
    <div class="section-header"><span class="section-dot"></span> Equipamentos Utilizados</div>
    <table>
      <thead><tr>
        <th>ID / Tipo</th><th>Atividade</th>
        <th style="text-align:right">Horas</th><th style="text-align:right">Custo</th>
      </tr></thead>
      <tbody>${equipHtml}</tbody>
    </table>
  </div>

  <!-- Materiais -->
  <div class="section">
    <div class="section-header"><span class="section-dot"></span> Materiais Utilizados</div>
    <table>
      <thead><tr>
        <th>ID</th><th>Atividade</th>
        <th style="text-align:right">Quantidade</th><th style="text-align:center">Un.</th>
      </tr></thead>
      <tbody>${materialsHtml}</tbody>
    </table>
  </div>

  <!-- Fotos -->
  <div class="section">
    <div class="section-header"><span class="section-dot"></span> Registros Fotográficos</div>
    <div style="margin-top:8px">${photosHtml}</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>${report.projectName}</span>
    <span>${subtitle}</span>
    <span>Gerado em ${new Date().toLocaleString('pt-BR')}</span>
  </div>
</body>
</html>`
}

export function printRelatorio360PDF(
  opts:
    | { mode: 'single'; report: DailyReport }
    | { mode: 'period'; reports: DailyReport[]; periodStart: string; periodEnd: string }
): void {
  const win = window.open('', '_blank')
  if (!win) { alert('Permita pop-ups para exportar o PDF.'); return }

  let html: string
  if (opts.mode === 'single') {
    html = buildHtml(opts.report, `Relatório 360 — ${fmtDate(opts.report.date)}`, fmtDate(opts.report.date))
  } else {
    const merged = aggregateReports(opts.reports)
    const subtitle = `${fmtDate(opts.periodStart)} – ${fmtDate(opts.periodEnd)}`
    html = buildHtml(merged, `Relatório 360 — ${subtitle}`, subtitle)
  }

  win.document.open()
  win.document.write(html)
  win.document.close()
  win.addEventListener('load', () => {
    setTimeout(() => { win.print() }, 400)
  })
}
