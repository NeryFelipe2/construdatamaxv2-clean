/**
 * datas.ts — calendário SEM fuso horário.
 *
 * Toda data do módulo é a string `YYYY-MM-DD`. Nada de `new Date(iso)` +
 * `toISOString()`: em Brasília (UTC−3) isso devolve o dia anterior para
 * qualquer hora depois das 21h, e a planilha trabalha com dia civil.
 *
 * As contas são feitas em "dias desde 1970-01-01" com aritmética inteira
 * (algoritmo days-from-civil de Howard Hinnant). O serial do Excel é o mesmo
 * contador deslocado: serial 25569 = 1970-01-01.
 */

const EXCEL_EPOCH_1970 = 25569

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0')
}

/** dias desde 1970-01-01 → { ano, mes, dia } */
export function civilDeDias(z0: number): { ano: number; mes: number; dia: number } {
  const z = z0 + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  return { ano: m <= 2 ? y + 1 : y, mes: m, dia: d }
}

/** { ano, mes, dia } → dias desde 1970-01-01 */
export function diasDeCivil(ano: number, mes: number, dia: number): number {
  const y = mes <= 2 ? ano - 1 : ano
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const mp = mes > 2 ? mes - 3 : mes + 9
  const doy = Math.floor((153 * mp + 2) / 5) + dia - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

export function ehISO(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

/** valida de verdade: 2026-02-31 é recusado (não rola para março) */
export function isoValido(ano: number, mes: number, dia: number): boolean {
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia)) return false
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 1900 || ano > 2200) return false
  const c = civilDeDias(diasDeCivil(ano, mes, dia))
  return c.ano === ano && c.mes === mes && c.dia === dia
}

export function montarISO(ano: number, mes: number, dia: number): string | null {
  return isoValido(ano, mes, dia) ? `${pad(ano, 4)}-${pad(mes)}-${pad(dia)}` : null
}

export function isoParaDias(iso: string): number {
  return diasDeCivil(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10)))
}

export function diasParaISO(dias: number): string {
  const c = civilDeDias(dias)
  return `${pad(c.ano, 4)}-${pad(c.mes)}-${pad(c.dia)}`
}

/** serial do Excel (sistema 1900) → ISO. A fração (hora) é descartada. */
export function serialParaISO(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null
  return diasParaISO(Math.floor(serial) - EXCEL_EPOCH_1970)
}

export function isoParaSerial(iso: string): number {
  return isoParaDias(iso) + EXCEL_EPOCH_1970
}

/** fração do dia do Excel (0,375) → "09:00" */
export function fracaoParaHora(fracao: number): string | null {
  if (!Number.isFinite(fracao) || fracao < 0) return null
  const minutos = Math.round((fracao - Math.floor(fracao)) * 24 * 60)
  const h = Math.floor(minutos / 60) % 24
  return `${pad(h)}:${pad(minutos % 60)}`
}

export function addDias(iso: string, n: number): string {
  return diasParaISO(isoParaDias(iso) + n)
}

/** a − b em dias */
export function diffDias(a: string, b: string): number {
  return isoParaDias(a) - isoParaDias(b)
}

export function inicioDoMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

/** EOMONTH(data, 0) */
export function fimDoMes(iso: string): string {
  const ano = Number(iso.slice(0, 4)), mes = Number(iso.slice(5, 7))
  const prox = mes === 12 ? diasDeCivil(ano + 1, 1, 1) : diasDeCivil(ano, mes + 1, 1)
  return diasParaISO(prox - 1)
}

/** 1º dia do mês seguinte (EDATE(1º dia, 1)) */
export function proximoMes(iso: string): string {
  return addDias(fimDoMes(iso), 1)
}

/** 0 = domingo … 6 = sábado (WEEKDAY(x,1) − 1) */
export function diaDaSemana(iso: string): number {
  // 1970-01-01 foi quinta-feira (4)
  return (((isoParaDias(iso) + 4) % 7) + 7) % 7
}

/** segunda-feira da semana da data */
export function segundaDaSemana(iso: string): string {
  const dow = diaDaSemana(iso)
  return addDias(iso, dow === 0 ? -6 : 1 - dow)
}

/** semana ISO no formato de lps_tasks.semana_iso: "2026-W38" */
export function semanaIso(iso: string): string {
  const dias = isoParaDias(iso)
  const dow = diaDaSemana(iso) || 7           // 1..7 (seg..dom)
  const quinta = dias - dow + 4                 // a quinta da mesma semana decide o ano ISO
  const anoIso = civilDeDias(quinta).ano
  const semana = Math.floor((quinta - diasDeCivil(anoIso, 1, 1)) / 7) + 1
  return `${anoIso}-W${pad(semana)}`
}

/** "2026-W38" → segunda-feira ISO */
export function segundaDaSemanaIso(semana: string): string | null {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(semana)
  if (!m) return null
  const ano = Number(m[1]), n = Number(m[2])
  const jan4 = diasDeCivil(ano, 1, 4)
  const dowJan4 = diaDaSemana(diasParaISO(jan4)) || 7
  return diasParaISO(jan4 - (dowJan4 - 1) + (n - 1) * 7)
}

/** hoje no relógio LOCAL (não UTC) */
export function hojeLocal(agora: Date = new Date()): string {
  return `${pad(agora.getFullYear(), 4)}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`
}

/** `2026-08-31` → `31/08/2026` */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return ''
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

/** "31/08/2026" · "31/8/26" · "2026-08-31" → ISO; data impossível → null */
export function textoParaISO(s: string): string | null {
  const t = s.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t)
  if (m) return montarISO(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t)
  if (m) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    return montarISO(ano, Number(m[2]), Number(m[1]))
  }
  return null
}

/** menor e maior data de uma lista (ignora vazios) */
export function faixaDeDatas(datas: (string | null | undefined)[]): { min: string; max: string } | null {
  let min: string | null = null, max: string | null = null
  for (const d of datas) {
    if (!ehISO(d)) continue
    if (min === null || d < min) min = d
    if (max === null || d > max) max = d
  }
  return min && max ? { min, max } : null
}
