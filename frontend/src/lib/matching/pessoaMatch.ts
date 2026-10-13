/**
 * pessoaMatch.ts
 *
 * Casamento de nomes de PESSOA entre as fontes reais do sistema:
 *  - planilha de funcionários ("APARECIDO RODRIGUES CIRIACO")
 *  - equipe_membros / kanban ("Almir", "Cristian (Coveiro)")
 *  - RDO / WhatsApp (nomes curtos digitados no campo)
 *
 * Molde: equipeMatch.ts — funções PURAS, sem import de React, Supabase ou
 * estado externo. A variação entre fontes é ESTRUTURAL (nome curto ⊂ nome
 * completo, apelido entre parênteses), então a base é normalização + tokens;
 * a similaridade fuzzy (dice de bigramas) entra só como último recurso (R4)
 * com corte alto (≥ 0.8) pra não casar "Ana" com "Ian".
 *
 * Regras de match (espelham a clusterização da migration 021):
 *  R1 — N1 idêntico                                          → score 1.0
 *  R2 — tokens subconjunto próprio com superconjunto ÚNICO   → score 0.9
 *  R4 — dice de bigramas ≥ 0.8                               → score 0.7
 * (R3 foi reservada para match por apelido confirmado no banco — resolvida
 *  fora daqui, direto em pessoa_apelidos.)
 */

/** Stopwords de nome PT-BR — mesmas da migration 021 (_nomes.tokens). */
const STOPWORDS = new Set(['da', 'de', 'do', 'dos', 'das', 'e'])

/** Corte mínimo de similaridade dice para a regra R4. */
const DICE_MIN = 0.8

export interface PessoaNormalizada {
  /** N0 — texto bruto normalizado (minúsculas, sem acento, espaços colapsados). */
  n0: string
  /** N1 — N0 sem o conteúdo entre parênteses (equivale ao norm_txt da migration). */
  n1: string
  /** Tokens de N1 sem stopwords (da/de/do/dos/das/e). */
  tokens: string[]
  /** Apelido capturado entre parênteses no texto original ("Cristian (Coveiro)" → "Coveiro"). */
  apelidoEntreParenteses: string | null
}

/** minúsculas + sem acentos + espaços colapsados (espelho JS do norm_txt do banco). */
function norm(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizePessoa(raw: string): PessoaNormalizada {
  const bruto = raw ?? ''
  const n0 = norm(bruto)
  const par = bruto.match(/\(([^)]*)\)/)
  const apelidoEntreParenteses = par && par[1].trim() ? par[1].trim() : null
  const semParenteses = bruto.replace(/\(.*?\)/g, ' ')
  const n1 = norm(semParenteses)
  const tokens = n1.split(' ').filter((t) => t.length > 0 && !STOPWORDS.has(t))
  return { n0, n1, tokens, apelidoEntreParenteses }
}

// ─── Dice coefficient de bigramas ────────────────────────────────────────────

function bigramas(s: string): Map<string, number> {
  const m = new Map<string, number>()
  const limpo = s.replace(/\s+/g, ' ')
  for (let i = 0; i < limpo.length - 1; i++) {
    const bg = limpo.slice(i, i + 2)
    m.set(bg, (m.get(bg) ?? 0) + 1)
  }
  return m
}

/** Similaridade Sørensen–Dice de bigramas entre duas strings já normalizadas (0..1). */
export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const ba = bigramas(a)
  const bb = bigramas(b)
  let inter = 0
  let totalA = 0
  let totalB = 0
  for (const [, n] of ba) totalA += n
  for (const [, n] of bb) totalB += n
  for (const [bg, n] of ba) {
    const nb = bb.get(bg)
    if (nb) inter += Math.min(n, nb)
  }
  return (2 * inter) / (totalA + totalB)
}

// ─── matchPessoa ─────────────────────────────────────────────────────────────

export interface PessoaCandidata {
  /** id da pessoa (pessoas.id). Pode repetir entre candidatos (um por alias). */
  pessoaId: string
  /** nome/alias original do candidato. */
  nome: string
}

export type PessoaMatchRegra = 'R1' | 'R2' | 'R4'

export interface PessoaMatchResult {
  pessoaId: string
  score: number
  regra: PessoaMatchRegra
}

/** a ⊊ b (subconjunto próprio) sobre arrays de tokens. */
function subconjuntoProprio(a: string[], b: string[]): boolean {
  if (a.length === 0 || a.length >= b.length) return false
  const sb = new Set(b)
  return a.every((t) => sb.has(t))
}

/**
 * Casa um nome livre contra a lista de candidatos.
 *  R1: N1 idêntico → {score: 1.0}. Se mais de UMA pessoa distinta tem o mesmo
 *      N1 (homônimos reais), o match é AMBÍGUO → null (decisão humana).
 *  R2: os tokens de um lado são subconjunto próprio do outro e o superconjunto
 *      resolve pra UMA pessoa só → {score: 0.9}.
 *  R4: dice de bigramas ≥ 0.8 (melhor candidato) → {score: 0.7}.
 */
export function matchPessoa(nome: string, candidatos: PessoaCandidata[]): PessoaMatchResult | null {
  const alvo = normalizePessoa(nome)
  if (!alvo.n1) return null

  const normCand = candidatos
    .map((c) => ({ ...c, nrm: normalizePessoa(c.nome) }))
    .filter((c) => c.nrm.n1.length > 0)

  // R1 — N1 idêntico
  const exatos = new Set(normCand.filter((c) => c.nrm.n1 === alvo.n1).map((c) => c.pessoaId))
  if (exatos.size === 1) return { pessoaId: [...exatos][0], score: 1.0, regra: 'R1' }
  if (exatos.size > 1) return null // homônimos: nunca decidir sozinho

  // R2 — subconjunto próprio de tokens com superconjunto ÚNICO
  const supersets = new Set(
    normCand
      .filter(
        (c) =>
          subconjuntoProprio(alvo.tokens, c.nrm.tokens) ||
          subconjuntoProprio(c.nrm.tokens, alvo.tokens),
      )
      .map((c) => c.pessoaId),
  )
  if (supersets.size === 1) return { pessoaId: [...supersets][0], score: 0.9, regra: 'R2' }

  // R4 — similaridade dice ≥ 0.8 (melhor candidato; empate → primeiro)
  let melhor: { pessoaId: string; dice: number } | null = null
  for (const c of normCand) {
    const d = diceCoefficient(alvo.n1, c.nrm.n1)
    if (d >= DICE_MIN && (!melhor || d > melhor.dice)) {
      melhor = { pessoaId: c.pessoaId, dice: d }
    }
  }
  if (melhor) return { pessoaId: melhor.pessoaId, score: 0.7, regra: 'R4' }

  return null
}

// ─── clusterizarNomes ────────────────────────────────────────────────────────

export interface ClusterNomes {
  /** N1 do nome-raiz (o mais completo do cluster). */
  raiz: string
  /** Nome cru canônico (a variante mais longa em caracteres). */
  nomeCanonico: string
  /** Todas as variantes cruas que caíram neste cluster. */
  variantes: string[]
  /** Apelido entre parênteses de alguma variante, se houver. */
  apelido: string | null
  /** true quando o nome cabia em ≥2 raízes — precisa de decisão humana. */
  ambiguo: boolean
}

/**
 * Clusteriza uma lista de nomes crus, espelhando a migration 021:
 * 'Almir' ⊂ 'Almir Junior' ⊂ 'Almir Gomes dos Santos Junior' → 1 cluster.
 * Nome que cabe em ≥2 raízes vira cluster próprio com ambiguo=true.
 */
export function clusterizarNomes(nomes: string[]): ClusterNomes[] {
  // agrupa variantes cruas por n1
  const porN1 = new Map<string, { cruas: string[]; nrm: PessoaNormalizada }>()
  for (const cru of nomes) {
    const nrm = normalizePessoa(cru)
    if (!nrm.n1) continue
    const g = porN1.get(nrm.n1)
    if (g) g.cruas.push(cru)
    else porN1.set(nrm.n1, { cruas: [cru], nrm })
  }
  const entradas = [...porN1.entries()].map(([n1, g]) => ({ n1, ...g }))

  // raízes = n1 cujos tokens não são subconjunto próprio de nenhum outro
  const roots = entradas.filter(
    (e) => !entradas.some((o) => o.n1 !== e.n1 && subconjuntoProprio(e.nrm.tokens, o.nrm.tokens)),
  )
  const rootSet = new Set(roots.map((r) => r.n1))

  const clusters = new Map<string, ClusterNomes>()
  const criarCluster = (raizN1: string, base: (typeof entradas)[number], ambiguo: boolean) => {
    const nomeCanonico = [...base.cruas].sort((a, b) => b.length - a.length)[0]
    clusters.set(raizN1, {
      raiz: raizN1,
      nomeCanonico,
      variantes: [...base.cruas],
      apelido: base.nrm.apelidoEntreParenteses,
      ambiguo,
    })
  }
  for (const r of roots) criarCluster(r.n1, r, false)

  for (const e of entradas) {
    if (rootSet.has(e.n1)) continue
    const raizes = roots.filter((r) => subconjuntoProprio(e.nrm.tokens, r.nrm.tokens))
    if (raizes.length === 1) {
      const c = clusters.get(raizes[0].n1)
      if (c) {
        c.variantes.push(...e.cruas)
        if (!c.apelido && e.nrm.apelidoEntreParenteses) c.apelido = e.nrm.apelidoEntreParenteses
      }
    } else {
      // 0 raízes não acontece (seria raiz); ≥2 → ambíguo, cluster próprio
      criarCluster(e.n1, e, true)
    }
  }

  return [...clusters.values()]
}
