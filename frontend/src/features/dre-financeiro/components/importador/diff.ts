/**
 * diff.ts — o motor de RECONCILIAÇÃO da importação de planilha.
 *
 * O pedido não é "importar": é "receber a planilha e ENTENDER o que mudou".
 * Toda importação aqui é comparada contra o que já está no sistema e devolve
 * quatro veredictos por linha:
 *
 *   NOVO       — não existe no sistema; será criado
 *   IGUAL      — existe e bate; será ignorado (não gera escrita nem log)
 *   DIFERENTE  — existe mas com outro valor; mostra ANTES → DEPOIS campo a campo
 *   ERRO       — não pode entrar (falta obrigatório, tipo inválido, fora de faixa)
 *
 * Nada é gravado antes de o usuário ver esse quadro e confirmar. É o que evita
 * a importação silenciosa que sobrescreve o mês inteiro por causa de uma
 * célula trocada.
 */

export type Veredicto = 'NOVO' | 'IGUAL' | 'DIFERENTE' | 'ERRO'

export interface CampoAlterado {
  campo: string
  antes: unknown
  depois: unknown
}

export interface Problema {
  campo: string
  mensagem: string
  /** bloqueia a gravação da linha; false = só aviso */
  bloqueia: boolean
}

export interface LinhaDiff<T> {
  /** linha na planilha (1-based, como o Excel mostra) */
  linha: number
  veredicto: Veredicto
  dados: T
  /** id do registro existente, quando DIFERENTE ou IGUAL */
  idExistente?: string
  alteracoes: CampoAlterado[]
  problemas: Problema[]
  /** o usuário pode desmarcar linhas antes de confirmar */
  selecionada: boolean
}

export interface ResultadoDiff<T> {
  linhas: LinhaDiff<T>[]
  resumo: Record<Veredicto, number>
  /** valores que a planilha traz e o catálogo do sistema não conhece */
  novidades: { tipo: string; valor: string; linhas: number[] }[]
}

/** Compara dois valores tolerando os ruídos típicos de planilha. */
export function mesmoValor(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || a === undefined) return b === null || b === undefined || b === ''
  if (b === null || b === undefined) return a === ''
  if (typeof a === 'number' || typeof b === 'number') {
    const na = Number(a), nb = Number(b)
    if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) < 0.005 // centavo
  }
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
}

/** normaliza texto para casar chave (sem acento, minúsculo, espaço colapsado) */
export function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

export interface ConfigDiff<T> {
  /** chave que identifica a MESMA entidade entre planilha e banco */
  chave: (item: T) => string
  /** campos comparados no ANTES → DEPOIS */
  campos: (keyof T & string)[]
  /** validação da linha; devolve os problemas encontrados */
  validar: (item: T) => Problema[]
  /** rótulo amigável de cada campo, para a tela */
  rotulos?: Partial<Record<keyof T & string, string>>
}

/**
 * Compara a planilha (novos) com o que está no banco (existentes).
 * Não escreve nada — só classifica.
 */
export function calcularDiff<T extends Record<string, unknown>>(
  daPlanilha: { linha: number; dados: T }[],
  doBanco: (T & { id: string })[],
  cfg: ConfigDiff<T>,
): ResultadoDiff<T> {
  const porChave = new Map<string, T & { id: string }>()
  for (const b of doBanco) porChave.set(cfg.chave(b), b)

  const linhas: LinhaDiff<T>[] = daPlanilha.map(({ linha, dados }) => {
    const problemas = cfg.validar(dados)
    const bloqueado = problemas.some((p) => p.bloqueia)
    if (bloqueado) {
      return { linha, veredicto: 'ERRO', dados, alteracoes: [], problemas, selecionada: false }
    }

    const existente = porChave.get(cfg.chave(dados))
    if (!existente) {
      return { linha, veredicto: 'NOVO', dados, alteracoes: [], problemas, selecionada: true }
    }

    const alteracoes: CampoAlterado[] = []
    for (const campo of cfg.campos) {
      if (!mesmoValor(existente[campo], dados[campo])) {
        alteracoes.push({ campo, antes: existente[campo], depois: dados[campo] })
      }
    }
    return {
      linha,
      veredicto: alteracoes.length === 0 ? 'IGUAL' : 'DIFERENTE',
      dados,
      idExistente: existente.id,
      alteracoes,
      problemas,
      // IGUAL não precisa ser gravado — desmarcado por padrão
      selecionada: alteracoes.length > 0,
    }
  })

  const resumo: Record<Veredicto, number> = { NOVO: 0, IGUAL: 0, DIFERENTE: 0, ERRO: 0 }
  for (const l of linhas) resumo[l.veredicto]++

  return { linhas, resumo, novidades: [] }
}

/**
 * Valores que a planilha traz e o catálogo do sistema não conhece — categoria
 * nova, obra nova, cargo novo. Não é erro: é decisão. A tela pergunta se deve
 * cadastrar junto, em vez de recusar a linha ou inventar o cadastro sozinha.
 */
export function detectarNovidades<T>(
  daPlanilha: { linha: number; dados: T }[],
  extratores: { tipo: string; valor: (item: T) => string | null | undefined; conhecidos: string[] }[],
): ResultadoDiff<T>['novidades'] {
  const out: ResultadoDiff<T>['novidades'] = []
  for (const ex of extratores) {
    const conhecidos = new Set(ex.conhecidos.map(norm))
    const achados = new Map<string, number[]>()
    for (const { linha, dados } of daPlanilha) {
      const bruto = ex.valor(dados)
      if (!bruto) continue
      const chave = norm(bruto)
      if (!chave || conhecidos.has(chave)) continue
      const lista = achados.get(String(bruto).trim()) ?? []
      lista.push(linha)
      achados.set(String(bruto).trim(), lista)
    }
    for (const [valor, linhasQueUsam] of achados) {
      out.push({ tipo: ex.tipo, valor, linhas: linhasQueUsam })
    }
  }
  return out
}

// ─── conversores tolerantes ao que vem de planilha de verdade ──────────────

/** "1.234,56" · "R$ 1234.56" · 1234.56 → 1234.56 ; lixo → null */
export function paraNumero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).trim().replace(/[R$\s]/gi, '')
  if (!s) return null
  // 1.234,56 (pt-BR) vs 1,234.56 (en)
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export interface Periodo { inicio: string; fim: string | null; textoOriginal?: string }

/**
 * Data da planilha vira PERÍODO — a planilha real tem células como
 * "01 A 10/07/2026", que não são uma data só. Aceita Date, serial do Excel,
 * "dd/mm/aaaa" e a forma "dd A dd/mm/aaaa".
 */
export function paraPeriodo(v: unknown): Periodo | null {
  if (v === null || v === undefined || v === '') return null

  const iso = (d: Date) => d.toISOString().slice(0, 10)

  if (v instanceof Date && !isNaN(v.getTime())) return { inicio: iso(v), fim: null }

  // serial do Excel (dias desde 30/12/1899)
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000)
    return { inicio: iso(d), fim: null }
  }

  const s = String(v).trim()
  if (!s) return null

  // "01 A 10/07/2026" → 01/07/2026 a 10/07/2026
  const periodo = s.match(/^(\d{1,2})\s*(?:A|ATÉ|ATE|-|–)\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/i)
  if (periodo) {
    const [, d1, d2, m, aRaw] = periodo
    const a = aRaw.length === 2 ? `20${aRaw}` : aRaw
    const p = (d: string) => `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    return { inicio: p(d1), fim: p(d2), textoOriginal: s }
  }

  // "dd/mm/aaaa" ou "dd-mm-aaaa"
  const simples = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/)
  if (simples) {
    const [, d, m, aRaw] = simples
    const a = aRaw.length === 2 ? `20${aRaw}` : aRaw
    return { inicio: `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`, fim: null }
  }

  // "aaaa-mm-dd"
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return { inicio: s.slice(0, 10), fim: null }

  return null
}

/** "DAMIÃO/WELLINGTON" · "Felipe, João" → ["DAMIÃO","WELLINGTON"] */
export function separarNomes(v: unknown): string[] {
  const s = String(v ?? '').trim()
  if (!s) return []
  return s.split(/[/,;+&]|\se\s/i).map((x) => x.trim()).filter(Boolean)
}
