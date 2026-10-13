/**
 * normalizar.ts — as normalizações de texto do módulo, num lugar só.
 *
 * Duas famílias, com usos diferentes:
 *   - normCabecalho: casar nome de coluna/aba (MAIÚSCULO, sem acento) — igual ao
 *     `_norm` do importer.py, para "Nº" e "Nº" digitados de jeitos diferentes baterem.
 *   - normChave: compor chave de identidade (minúsculo, sem acento, espaço colapsado),
 *     compatível com `norm()` do motor de diff e com `norm_txt()` do Postgres.
 */

function semAcento(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
}

export function normCabecalho(v: unknown): string {
  if (v === null || v === undefined) return ''
  return semAcento(String(v)).replace(/\s+/g, ' ').trim().toUpperCase()
}

export function normChave(v: unknown): string {
  if (v === null || v === undefined) return ''
  return semAcento(String(v)).toLowerCase().replace(/\s+/g, ' ').trim()
}

/** texto vazio vira null; o resto é aparado */
export function textoOuNulo(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/**
 * Menu SIM/NÃO da planilha (LST_SN / LST_SNP). "nao", "Não", "N" viram "NÃO";
 * o que não é reconhecido volta como veio (e o importador avisa).
 */
export function normSimNao(v: unknown): string | null {
  const s = textoOuNulo(v)
  if (s === null) return null
  const n = normCabecalho(s)
  if (n === 'SIM' || n === 'S') return 'SIM'
  if (n === 'NAO' || n === 'N') return 'NÃO'
  if (n === 'N/A' || n === 'NA') return 'N/A'
  return s
}

export function ehSim(v: unknown): boolean {
  return normSimNao(v) === 'SIM'
}

export function ehNao(v: unknown): boolean {
  return normSimNao(v) === 'NÃO'
}

/** "BERTIOGA", "Bertioga" → "BERTIOGA" (a aba 06 escreve "Bertioga", a 01 "BERTIOGA") */
export function normContrato(v: unknown): string | null {
  const s = textoOuNulo(v)
  return s === null ? null : s.toUpperCase()
}

/** "1.234,56" · "R$ 1234.56" · 1234.56 → número; lixo → null (nunca 0) */
export function paraNumero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).trim().replace(/R\$/gi, '').replace(/\s/g, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** ROUND(x; 2) do Excel (meio para longe do zero) */
export function arred2(x: number): number {
  const s = Math.sign(x) || 1
  return (s * Math.round(Math.abs(x) * 100 + 1e-9)) / 100
}
