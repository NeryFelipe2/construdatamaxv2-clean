/**
 * rdoPdfExport.ts
 * Opens a styled A4 HTML print window for a given RDO.
 * Uses window.print() — no external PDF library needed.
 */
import type { RDO } from '@/types'
import { useCompanySettingsStore } from '@/store/companySettingsStore'

const WEATHER_ICON: Record<string, string> = {
  good:   '☀️',
  cloudy: '⛅',
  rain:   '🌧️',
  storm:  '⛈️',
}

const WEATHER_LABEL: Record<string, string> = {
  good:   'Bom',
  cloudy: 'Nublado',
  rain:   'Chuva',
  storm:  'Tempestade',
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Não iniciado',
  in_progress: 'Em andamento',
  completed:   'Concluído',
}

const STATUS_COLOR: Record<string, string> = {
  not_started: '#6b7280',
  in_progress: '#f59e0b',
  completed:   '#22c55e',
}

function fmtDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export function printRdoPDF(rdo: RDO) {
  const win = window.open('', '_blank')
  if (!win) { alert('Permita pop-ups para exportar o PDF.'); return }

  const { logos, companyName } = useCompanySettingsStore.getState()
  const selectedLogo = rdo.logoId
    ? logos.find((l) => l.id === rdo.logoId)
    : logos[0]
  const companyLogo = selectedLogo?.base64 ?? null

  const totalManpower =
    rdo.manpower.foremanCount +
    rdo.manpower.officialCount +
    rdo.manpower.helperCount +
    rdo.manpower.operatorCount

  const manpowerRows = [
    ['Encarregado', rdo.manpower.foremanCount],
    ['Oficial',     rdo.manpower.officialCount],
    ['Ajudante',    rdo.manpower.helperCount],
    ['Operador',    rdo.manpower.operatorCount],
  ].filter(([, v]) => (v as number) > 0)

  const employeeNamesHtml = rdo.manpower.employeeNames?.length
    ? rdo.manpower.employeeNames.map((n) => `<span class="chip">${n}</span>`).join(' ')
    : '<span style="color:#6b7280;font-style:italic">Não informados</span>'

  const equipHtml = rdo.equipment.length
    ? rdo.equipment.map((e) => `
        <tr>
          <td>${e.name}</td>
          <td style="text-align:center">${e.quantity}</td>
          <td style="text-align:center">${e.hours}h</td>
        </tr>`).join('')
    : '<tr><td colspan="3" style="color:#6b7280;font-style:italic">Nenhum equipamento</td></tr>'

  const servicesHtml = rdo.services.length
    ? rdo.services.map((s) => `
        <tr>
          <td>${s.description}</td>
          <td style="text-align:center">${s.quantity}</td>
          <td style="text-align:center">${s.unit}</td>
        </tr>`).join('')
    : '<tr><td colspan="3" style="color:#6b7280;font-style:italic">Nenhum serviço</td></tr>'

  const trechosHtml = rdo.trechos.length
    ? rdo.trechos.map((t) => `
        <tr>
          <td><code>${t.trechoCode}</code></td>
          <td>${t.trechoDescription}</td>
          <td style="text-align:center">${t.plannedMeters}m</td>
          <td style="text-align:center">${t.executedMeters}m</td>
          <td style="text-align:center">
            <span style="color:${STATUS_COLOR[t.status]};font-weight:600">
              ${STATUS_LABEL[t.status] ?? t.status}
            </span>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="5" style="color:#6b7280;font-style:italic">Nenhum trecho</td></tr>'

  const photosHtml = rdo.photos.length
    ? `<div class="photo-grid">
        ${rdo.photos.map((p) => `
          <figure class="photo-item">
            <img src="${p.base64}" alt="${p.label}" />
            <figcaption>${p.label}</figcaption>
          </figure>`).join('')}
       </div>`
    : '<p style="color:#6b7280;font-style:italic">Sem registros fotográficos</p>'

  const geoHtml = rdo.geolocation
    ? `<p>📍 Lat: <code>${rdo.geolocation.lat}</code> &nbsp; Lng: <code>${rdo.geolocation.lng}</code></p>`
    : ''

  // Helper: return value or "Não informado" if absent/falsy
  function ni(v: string | number | undefined | null, isNum = false): string {
    if (isNum) return (v !== undefined && v !== null && (v as number) > 0) ? String(v) : 'Não informado'
    return (v && String(v).trim()) ? String(v) : 'Não informado'
  }

  const infoTableHtml = `
  <table class="info-table" style="margin-bottom:10px;">
    <tbody>
      <tr>
        <th>Local / Obra</th>
        <td colspan="3">${ni(rdo.local)}</td>
      </tr>
      <tr>
        <th>Empreiteira</th>
        <td>${ni(rdo.nomeEmpreiteira)}</td>
        <th>Nº OS</th>
        <td>${ni(rdo.numeroOS)}</td>
      </tr>
      <tr>
        <th>N° Contrato</th>
        <td>${ni(rdo.numeroContrato)}</td>
        <th>Serviço a Executar</th>
        <td>${ni(rdo.servicoExecutar)}</td>
      </tr>
      <tr>
        <th>Gerente de Contrato</th>
        <td>${ni(rdo.gerenteContrato)}</td>
        <th>Técnico de Segurança</th>
        <td>${ni(rdo.tecnicoSeguranca)}</td>
      </tr>
      <tr>
        <th>Func. Diretos</th>
        <td>${ni(rdo.funcionariosDiretos, true)}</td>
        <th>Func. Indiretos</th>
        <td>${ni(rdo.funcionariosIndiretos, true)}</td>
      </tr>
      <tr>
        <th>Qtd. Equip./Ferramentas</th>
        <td>${ni(rdo.qtdEquipamentosFerramentas, true)}</td>
        <th>Clima Manhã / Tarde / Noite</th>
        <td>${ni(rdo.climaManha)} · ${ni(rdo.climaTarde)} · ${ni(rdo.climaNoite)}</td>
      </tr>
    </tbody>
  </table>`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>RDO #${rdo.number} — ${fmtDate(rdo.date)}</title>
  <style>
    @page { size: A4; margin: 14mm 14mm 18mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 9.5pt; color: #111; background: #fff; }

    /* ── Cover ─────────────────────────── */
    .cover {
      display: flex; align-items: center; gap: 14px;
      padding: 18px 0 12px; border-bottom: 3px solid #f97316; margin-bottom: 12px;
    }
    .cover-logo {
      width: 44px; height: 44px; background: #f97316; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; color: #fff; font-weight: 900; flex-shrink: 0;
    }
    .cover-logo-img {
      max-width: 140px; max-height: 52px; object-fit: contain; flex-shrink: 0;
    }
    .cover-title { font-size: 18pt; font-weight: 800; color: #111; letter-spacing: -0.5px; }
    .cover-sub   { font-size: 9pt; color: #6b7280; margin-top: 2px; }
    .cover-badges { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; justify-content: flex-end; }
    .badge {
      font-size: 8pt; font-weight: 700; padding: 3px 10px; border-radius: 20px;
      background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb;
    }
    .badge-orange { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }

    /* ── Info table (identification fields) ── */
    .info-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 10px; }
    .info-table th {
      background: #f3f4f6; font-weight: 700; padding: 4px 8px; text-align: left;
      border: 1px solid #e5e7eb; color: #374151; white-space: nowrap; width: 22%;
    }
    .info-table td {
      background: #fff; padding: 4px 8px; border: 1px solid #e5e7eb;
      color: #111; width: 28%;
    }

    /* ── Section ────────────────────────── */
    .section { margin-bottom: 14px; break-inside: avoid; }
    .section-header {
      display: flex; align-items: center; gap: 7px;
      background: #f9fafb; border-left: 3px solid #f97316;
      padding: 5px 10px; border-radius: 0 6px 6px 0;
      font-size: 9pt; font-weight: 700; color: #111; text-transform: uppercase;
      letter-spacing: 0.04em; margin-bottom: 8px;
    }
    .section-icon { font-size: 11pt; }

    /* ── Table ──────────────────────────── */
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th { background: #f3f4f6; font-weight: 700; padding: 5px 8px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 4px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; color: #374151; }
    tr:last-child td { border-bottom: none; }
    code { font-family: 'Courier New', monospace; font-size: 8.5pt; background: #f3f4f6; padding: 1px 4px; border-radius: 3px; }

    /* ── Weather grid ───────────────────── */
    .weather-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .weather-cell { text-align: center; background: #f9fafb; border-radius: 8px; padding: 8px 4px; border: 1px solid #e5e7eb; }
    .weather-icon { font-size: 18pt; display: block; }
    .weather-label { font-size: 7.5pt; color: #6b7280; margin-top: 2px; }
    .weather-value { font-size: 8.5pt; font-weight: 700; color: #111; }

    /* ── Chips ──────────────────────────── */
    .chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .chip {
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 20px;
      padding: 2px 9px; font-size: 8pt; color: #1d4ed8; font-weight: 500;
    }

    /* ── Photos ─────────────────────────── */
    .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .photo-item { break-inside: avoid; }
    .photo-item img { width: 100%; height: 130px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; }
    .photo-item figcaption { font-size: 7.5pt; color: #6b7280; text-align: center; margin-top: 3px; }

    /* ── Observations ───────────────────── */
    .obs-box { background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 9pt; color: #374151; white-space: pre-wrap; min-height: 40px; }

    /* ── Signature ──────────────────────── */
    .signature { display: flex; gap: 40px; margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
    .sig-block { flex: 1; }
    .sig-line { border-bottom: 1px solid #374151; height: 32px; margin-bottom: 4px; }
    .sig-label { font-size: 8pt; color: #6b7280; text-align: center; }

    /* ── Footer ─────────────────────────── */
    .footer {
      position: fixed; bottom: 6mm; left: 14mm; right: 14mm;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 7.5pt; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 3px;
    }

    @media print {
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <!-- Print button (hidden on print) -->
  <div class="no-print" style="text-align:right;padding:8px 0;margin-bottom:4px;">
    <button onclick="window.print()" style="background:#f97316;color:#fff;border:none;padding:6px 18px;border-radius:6px;font-size:10pt;font-weight:700;cursor:pointer;">
      🖨️ Imprimir / Salvar PDF
    </button>
  </div>

  <!-- Cover -->
  <div class="cover">
    ${companyLogo
      ? `<img src="${companyLogo}" alt="Logo" class="cover-logo-img" />`
      : `<div class="cover-logo">R</div>`
    }
    <div>
      <div class="cover-title">Relatório Diário de Obra</div>
      <div class="cover-sub">${companyName} · Módulo RDO</div>
    </div>
    <div class="cover-badges">
      <span class="badge badge-orange">RDO #${rdo.number}</span>
      <span class="badge">${fmtDate(rdo.date)}</span>
      <span class="badge">${rdo.responsible || '—'}</span>
    </div>
  </div>

  <!-- Identification info table -->
  ${infoTableHtml}

  ${rdo.ocorrencias && rdo.ocorrencias !== 'Não informado' ? `
  <div class="section" style="margin-bottom:10px;">
    <div class="section-header"><span class="section-icon">⚠️</span> Ocorrências</div>
    <div class="obs-box" style="border-color:#fca5a5;color:#dc2626;">${rdo.ocorrencias}</div>
  </div>` : ''}

  <!-- 1. Condições Climáticas -->
  <div class="section">
    <div class="section-header"><span class="section-icon">🌤️</span> Condições Climáticas</div>
    <div class="weather-grid">
      <div class="weather-cell">
        <span class="weather-icon">${WEATHER_ICON[rdo.weather.morning] ?? '—'}</span>
        <div class="weather-label">Manhã</div>
        <div class="weather-value">${WEATHER_LABEL[rdo.weather.morning] ?? rdo.weather.morning}</div>
      </div>
      <div class="weather-cell">
        <span class="weather-icon">${WEATHER_ICON[rdo.weather.afternoon] ?? '—'}</span>
        <div class="weather-label">Tarde</div>
        <div class="weather-value">${WEATHER_LABEL[rdo.weather.afternoon] ?? rdo.weather.afternoon}</div>
      </div>
      <div class="weather-cell">
        <span class="weather-icon">${WEATHER_ICON[rdo.weather.night] ?? '—'}</span>
        <div class="weather-label">Noite</div>
        <div class="weather-value">${WEATHER_LABEL[rdo.weather.night] ?? rdo.weather.night}</div>
      </div>
      <div class="weather-cell">
        <span class="weather-icon">🌡️</span>
        <div class="weather-label">Temperatura</div>
        <div class="weather-value">${rdo.weather.temperatureC}°C</div>
      </div>
    </div>
  </div>

  <!-- 2. Mão de Obra -->
  <div class="section">
    <div class="section-header"><span class="section-icon">👷</span> Mão de Obra — Total: ${totalManpower} pessoas</div>
    <table>
      <thead><tr><th>Cargo</th><th style="text-align:center">Quantidade</th></tr></thead>
      <tbody>
        ${manpowerRows.map(([c, v]) => `<tr><td>${c}</td><td style="text-align:center;font-weight:700">${v}</td></tr>`).join('')}
      </tbody>
    </table>
    ${(rdo.manpower.employeeNames?.length ?? 0) > 0 ? `
    <div style="margin-top:8px">
      <div style="font-size:8pt;color:#6b7280;margin-bottom:4px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Funcionários Presentes</div>
      <div class="chips">${employeeNamesHtml}</div>
    </div>` : ''}
  </div>

  <!-- 3. Equipamentos -->
  <div class="section">
    <div class="section-header"><span class="section-icon">🚜</span> Equipamentos</div>
    <table>
      <thead><tr><th>Equipamento</th><th style="text-align:center">Qtd.</th><th style="text-align:center">Horas</th></tr></thead>
      <tbody>${equipHtml}</tbody>
    </table>
  </div>

  <!-- 4. Serviços Executados -->
  <div class="section">
    <div class="section-header"><span class="section-icon">🔧</span> Serviços Executados</div>
    <table>
      <thead><tr><th>Descrição</th><th style="text-align:center">Qtd.</th><th style="text-align:center">Unidade</th></tr></thead>
      <tbody>${servicesHtml}</tbody>
    </table>
  </div>

  <!-- 5. Avanço por Trecho -->
  <div class="section">
    <div class="section-header"><span class="section-icon">📏</span> Avanço por Trecho</div>
    <table>
      <thead>
        <tr>
          <th>Código</th><th>Descrição</th>
          <th style="text-align:center">Plan.</th><th style="text-align:center">Exec.</th>
          <th style="text-align:center">Status</th>
        </tr>
      </thead>
      <tbody>${trechosHtml}</tbody>
    </table>
  </div>

  <!-- 6. Observações e Ocorrências -->
  <div class="section">
    <div class="section-header"><span class="section-icon">📋</span> Observações e Ocorrências</div>
    <div style="margin-bottom:6px">
      <div style="font-size:8pt;color:#6b7280;margin-bottom:3px;font-weight:600;">Observações Gerais</div>
      <div class="obs-box">${rdo.observations || '—'}</div>
    </div>
    ${rdo.incidents ? `
    <div>
      <div style="font-size:8pt;color:#ef4444;margin-bottom:3px;font-weight:600;">⚠️ Ocorrências / Acidentes</div>
      <div class="obs-box" style="border-color:#fca5a5;">${rdo.incidents}</div>
    </div>` : ''}
    ${geoHtml}
  </div>

  <!-- 7. Registro Fotográfico -->
  <div class="section">
    <div class="section-header"><span class="section-icon">📷</span> Registro Fotográfico (${rdo.photos.length} foto${rdo.photos.length !== 1 ? 's' : ''})</div>
    ${photosHtml}
  </div>

  <!-- 8. Assinatura -->
  <div class="signature">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">${rdo.responsible || 'Responsável pela Obra'}</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Fiscal / Gerente de Obra</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Aprovação / Diretoria</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>RDO #${rdo.number} · Data: ${fmtDate(rdo.date)}</span>
    <span>Gerado em ${new Date().toLocaleString('pt-BR')} · Construdata Palantir</span>
  </div>

  <script>
    // Auto-print when images are loaded (for photos)
    window.addEventListener('load', () => {
      const imgs = document.querySelectorAll('img')
      if (imgs.length === 0) return
      let loaded = 0
      imgs.forEach((img) => {
        if (img.complete) { loaded++; if (loaded === imgs.length) {} }
        else img.onload = () => { loaded++; }
      })
    })
  </script>
</body>
</html>`

  win.document.write(html)
  win.document.close()
}

// ─── Batch PDF helper ─────────────────────────────────────────────────────────

function generateRdoHTML(rdo: RDO, addPageBreak: boolean): string {
  const totalManpower =
    rdo.manpower.foremanCount +
    rdo.manpower.officialCount +
    rdo.manpower.helperCount +
    rdo.manpower.operatorCount

  const manpowerRows = [
    ['Encarregado', rdo.manpower.foremanCount],
    ['Oficial',     rdo.manpower.officialCount],
    ['Ajudante',    rdo.manpower.helperCount],
    ['Operador',    rdo.manpower.operatorCount],
  ].filter(([, v]) => (v as number) > 0)

  const equipHtml = rdo.equipment.length
    ? rdo.equipment.map((e) => `<tr><td>${e.name}</td><td style="text-align:center">${e.quantity}</td><td style="text-align:center">${e.hours}h</td></tr>`).join('')
    : '<tr><td colspan="3" style="color:#6b7280;font-style:italic">Nenhum equipamento</td></tr>'

  const servicesHtml = rdo.services.length
    ? rdo.services.map((s) => `<tr><td>${s.description}</td><td style="text-align:center">${s.quantity}</td><td style="text-align:center">${s.unit}</td></tr>`).join('')
    : '<tr><td colspan="3" style="color:#6b7280;font-style:italic">Nenhum serviço</td></tr>'

  const trechosHtml = rdo.trechos.length
    ? rdo.trechos.map((t) => `<tr><td><code>${t.trechoCode}</code></td><td>${t.trechoDescription}</td><td style="text-align:center">${t.plannedMeters}m</td><td style="text-align:center">${t.executedMeters}m</td><td style="text-align:center"><span style="color:${STATUS_COLOR[t.status]};font-weight:600">${STATUS_LABEL[t.status] ?? t.status}</span></td></tr>`).join('')
    : '<tr><td colspan="5" style="color:#6b7280;font-style:italic">Nenhum trecho</td></tr>'

  const pageBreakStyle = addPageBreak ? 'page-break-after: always;' : ''

  return `
  <div style="${pageBreakStyle} padding: 0 0 24px 0;">
    <!-- Cover -->
    <div class="cover">
      <div class="cover-logo">R</div>
      <div>
        <div class="cover-title">Relatório Diário de Obra</div>
        <div class="cover-sub">Construdata · Módulo RDO</div>
      </div>
      <div class="cover-badges">
        <span class="badge badge-orange">RDO #${rdo.number}</span>
        <span class="badge">${fmtDate(rdo.date)}</span>
        <span class="badge">${rdo.responsible || '—'}</span>
      </div>
    </div>

    <!-- Clima -->
    <div class="section">
      <div class="section-header"><span class="section-icon">🌤️</span> Condições Climáticas</div>
      <div class="weather-grid">
        <div class="weather-cell"><span class="weather-icon">${WEATHER_ICON[rdo.weather.morning] ?? '—'}</span><div class="weather-label">Manhã</div><div class="weather-value">${WEATHER_LABEL[rdo.weather.morning] ?? rdo.weather.morning}</div></div>
        <div class="weather-cell"><span class="weather-icon">${WEATHER_ICON[rdo.weather.afternoon] ?? '—'}</span><div class="weather-label">Tarde</div><div class="weather-value">${WEATHER_LABEL[rdo.weather.afternoon] ?? rdo.weather.afternoon}</div></div>
        <div class="weather-cell"><span class="weather-icon">${WEATHER_ICON[rdo.weather.night] ?? '—'}</span><div class="weather-label">Noite</div><div class="weather-value">${WEATHER_LABEL[rdo.weather.night] ?? rdo.weather.night}</div></div>
        <div class="weather-cell"><span class="weather-icon">🌡️</span><div class="weather-label">Temperatura</div><div class="weather-value">${rdo.weather.temperatureC}°C</div></div>
      </div>
    </div>

    <!-- Mão de Obra -->
    <div class="section">
      <div class="section-header"><span class="section-icon">👷</span> Mão de Obra — Total: ${totalManpower} pessoas</div>
      <table><thead><tr><th>Cargo</th><th style="text-align:center">Quantidade</th></tr></thead>
      <tbody>${manpowerRows.map(([c, v]) => `<tr><td>${c}</td><td style="text-align:center;font-weight:700">${v}</td></tr>`).join('')}</tbody></table>
    </div>

    <!-- Equipamentos -->
    <div class="section">
      <div class="section-header"><span class="section-icon">🚜</span> Equipamentos</div>
      <table><thead><tr><th>Equipamento</th><th style="text-align:center">Qtd.</th><th style="text-align:center">Horas</th></tr></thead>
      <tbody>${equipHtml}</tbody></table>
    </div>

    <!-- Serviços -->
    <div class="section">
      <div class="section-header"><span class="section-icon">🔧</span> Serviços Executados</div>
      <table><thead><tr><th>Descrição</th><th style="text-align:center">Qtd.</th><th style="text-align:center">Unidade</th></tr></thead>
      <tbody>${servicesHtml}</tbody></table>
    </div>

    <!-- Trechos -->
    <div class="section">
      <div class="section-header"><span class="section-icon">📏</span> Avanço por Trecho</div>
      <table><thead><tr><th>Código</th><th>Descrição</th><th style="text-align:center">Plan.</th><th style="text-align:center">Exec.</th><th style="text-align:center">Status</th></tr></thead>
      <tbody>${trechosHtml}</tbody></table>
    </div>

    <!-- Observações -->
    <div class="section">
      <div class="section-header"><span class="section-icon">📋</span> Observações e Ocorrências</div>
      <div style="margin-bottom:6px"><div style="font-size:8pt;color:#6b7280;margin-bottom:3px;font-weight:600;">Observações Gerais</div>
      <div class="obs-box">${rdo.observations || '—'}</div></div>
      ${rdo.incidents ? `<div><div style="font-size:8pt;color:#ef4444;margin-bottom:3px;font-weight:600;">⚠️ Ocorrências</div><div class="obs-box" style="border-color:#fca5a5;">${rdo.incidents}</div></div>` : ''}
    </div>
  </div>`
}

export function printRdosBatchPDF(rdos: RDO[], label: string): void {
  const totalMeters = rdos.reduce((acc, r) => acc + r.trechos.reduce((a, t) => a + t.executedMeters, 0), 0)
  const totalWorkerDays = rdos.reduce((acc, r) => {
    const { foremanCount, officialCount, helperCount, operatorCount } = r.manpower
    return acc + foremanCount + officialCount + helperCount + operatorCount
  }, 0)

  const css = `
    @page { size: A4; margin: 14mm 14mm 18mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 9.5pt; color: #0e1f38; background: #fff; }
    .cover { display: flex; align-items: center; gap: 14px; padding: 18px 0 12px; border-bottom: 3px solid #f97316; margin-bottom: 16px; }
    .cover-logo { width: 44px; height: 44px; background: #f97316; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; color: #fff; font-weight: 900; flex-shrink: 0; }
    .cover-title { font-size: 18pt; font-weight: 800; color: #111; letter-spacing: -0.5px; }
    .cover-sub { font-size: 9pt; color: #6b7280; margin-top: 2px; }
    .cover-badges { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; justify-content: flex-end; }
    .badge { font-size: 8pt; font-weight: 700; padding: 3px 10px; border-radius: 20px; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
    .badge-orange { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }
    .section { margin-bottom: 14px; break-inside: avoid; }
    .section-header { display: flex; align-items: center; gap: 7px; background: #f9fafb; border-left: 3px solid #f97316; padding: 5px 10px; border-radius: 0 6px 6px 0; font-size: 9pt; font-weight: 700; color: #111; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
    .section-icon { font-size: 11pt; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th { background: #f3f4f6; font-weight: 700; padding: 5px 8px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 8pt; text-transform: uppercase; }
    td { padding: 4px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; color: #374151; }
    tr:last-child td { border-bottom: none; }
    code { font-family: 'Courier New', monospace; font-size: 8.5pt; background: #f3f4f6; padding: 1px 4px; border-radius: 3px; }
    .weather-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .weather-cell { text-align: center; background: #f9fafb; border-radius: 8px; padding: 8px 4px; border: 1px solid #e5e7eb; }
    .weather-icon { font-size: 18pt; display: block; }
    .weather-label { font-size: 7.5pt; color: #6b7280; margin-top: 2px; }
    .weather-value { font-size: 8.5pt; font-weight: 700; color: #111; }
    .obs-box { background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 9pt; color: #374151; white-space: pre-wrap; min-height: 40px; }
    @media print { .no-print { display: none; } }
  `

  const cover = `
    <div style="page-break-after: always; padding: 40px;">
      <h1 style="color: #1a3a6b; font-size: 24px; margin-bottom: 4px;">Relatório Consolidado de RDOs</h1>
      <h2 style="color: #333; font-size: 18px; margin-top: 8px;">${label}</h2>
      <div style="margin-top: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
        <div style="background: #f0f4f8; padding: 16px; border-radius: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: #1a3a6b;">${rdos.length}</div>
          <div style="font-size: 12px; color: #666;">Total de RDOs</div>
        </div>
        <div style="background: #f0f4f8; padding: 16px; border-radius: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: #1a3a6b;">${totalMeters.toFixed(0)}m</div>
          <div style="font-size: 12px; color: #666;">Metros Executados</div>
        </div>
        <div style="background: #f0f4f8; padding: 16px; border-radius: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: #1a3a6b;">${totalWorkerDays}</div>
          <div style="font-size: 12px; color: #666;">Total Trabalhadores-Dia</div>
        </div>
      </div>
    </div>
  `

  const rdoSections = rdos.map((rdo, i) => generateRdoHTML(rdo, i < rdos.length - 1)).join('\n')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Relatório Consolidado — ${label}</title>
    <style>${css}</style>
  </head><body>
    <div class="no-print" style="text-align:right;padding:8px 0;margin-bottom:4px;">
      <button onclick="window.print()" style="background:#f97316;color:#fff;border:none;padding:6px 18px;border-radius:6px;font-size:10pt;font-weight:700;cursor:pointer;">🖨️ Imprimir / Salvar PDF</button>
    </div>
    ${cover}${rdoSections}
  </body></html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print() }
}
