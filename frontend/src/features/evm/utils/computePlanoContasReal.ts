/**
 * computePlanoContasReal — motor puro (sem Supabase) que agrega despesas reais
 * (`lancamentos_financeiros` tipo DESPESA) por pilar de custo (material /
 * equipamento / mão de obra / impostos-indiretos), a partir do campo
 * `categoria` (texto livre, sem enum no banco — ver `LancamentoManualModal`).
 *
 * NÃO existe hoje uma tabela de orçamento detalhado por pilar (`projetos` só
 * tem `orcamento_total`, um número único) — por isso este motor só calcula o
 * lado REAL. O lado ORÇADO por pilar fica de fora (não inventa número).
 *
 * Categorias que não batem com o dicionário caem em `naoCategorizado`
 * (nunca são descartadas silenciosamente) e são listadas em
 * `categoriasNaoMapeadas` para o usuário revisar/corrigir o lançamento.
 */

export type PilarKey = 'material' | 'equipamento' | 'mao_de_obra' | 'impostos_indiretos'

export interface LancamentoDespesaInput {
  categoria: string
  valor: number
}

export interface PlanoContasRealResult {
  porPilar: Record<PilarKey, number>
  naoCategorizado: number
  categoriasNaoMapeadas: string[]
  total: number
}

// Dicionário categoria (normalizada: trim + lowercase) → pilar. Baseado nas
// sugestões do próprio `LancamentoManualModal` (CATEGORIA_SUGESTOES).
// "Medição", "Transporte", "Subempreiteiro", "Administração" e "Outro" não
// têm pilar óbvio entre os 4 — caem em não-categorizado, com aviso na UI.
const MAPA_CATEGORIA_PILAR: Record<string, PilarKey> = {
  'mao de obra': 'mao_de_obra',
  'mão de obra': 'mao_de_obra',
  'material': 'material',
  'materiais': 'material',
  'equipamento': 'equipamento',
  'equipamentos': 'equipamento',
  'imposto': 'impostos_indiretos',
  'impostos': 'impostos_indiretos',
}

export function computePlanoContasReal(lancamentos: LancamentoDespesaInput[]): PlanoContasRealResult {
  const porPilar: Record<PilarKey, number> = {
    material: 0, equipamento: 0, mao_de_obra: 0, impostos_indiretos: 0,
  }
  let naoCategorizado = 0
  let total = 0
  const naoMapeadasSet = new Set<string>()

  for (const l of lancamentos ?? []) {
    const valor = Number(l.valor) || 0
    total += valor
    const chave = (l.categoria ?? '').trim().toLowerCase()
    const pilar = MAPA_CATEGORIA_PILAR[chave]
    if (pilar) {
      porPilar[pilar] += valor
    } else {
      naoCategorizado += valor
      const original = (l.categoria ?? '').trim()
      if (original) naoMapeadasSet.add(original)
    }
  }

  return {
    porPilar,
    naoCategorizado,
    categoriasNaoMapeadas: [...naoMapeadasSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    total,
  }
}
