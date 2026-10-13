/**
 * computeViabilidade — motor puro do estudo de viabilidade de contrato
 * (planilha "Viabilidade CT9618" + "RESULTADO" do Botelhos).
 *
 * receita contratual − (custo direto + BDI/impostos) = margem projetada.
 * BDI reaproveita a mesma composição de `calcBDI` em preConstrucaoStore.ts:
 * soma simples de percentuais (adminCentral + iss + pisCofins + seguro + lucro).
 */

export interface ViabilidadeLinhaCusto {
  descricao: string
  valor: number
}

export interface ViabilidadeGrupoCusto {
  grupo: 'Materiais' | 'Mão de Obra' | 'Equipamentos' | 'CI' | 'Subempreiteiros'
  /** % de encargos aplicado só ao grupo Mão de Obra (0 para os demais). */
  percEncargos?: number
  linhas: ViabilidadeLinhaCusto[]
}

export interface ViabilidadeBDI {
  adminCentral: number
  iss: number
  pisCofins: number
  seguro: number
  lucro: number
}

export interface ViabilidadeEstudo {
  nome: string
  receitaContratual: number
  grupos: ViabilidadeGrupoCusto[]
  bdi: ViabilidadeBDI
}

export interface ViabilidadeResultado {
  custoDiretoTotal: number
  percBDI: number
  custoComBDI: number
  margemProjetadaValor: number
  margemProjetadaPct: number
  porGrupo: Array<{ grupo: string; total: number }>
}

/** Soma simples dos percentuais do BDI (mesma fórmula de calcBDI). */
export function calcBDIPercentual(bdi: ViabilidadeBDI): number {
  const sum = (bdi.adminCentral || 0) + (bdi.iss || 0) + (bdi.pisCofins || 0) + (bdi.seguro || 0) + (bdi.lucro || 0)
  return parseFloat(sum.toFixed(2))
}

/** Total de um grupo de custo, aplicando encargos (%) quando informado (ex: Mão de Obra). */
export function totalGrupo(grupo: ViabilidadeGrupoCusto): number {
  const base = grupo.linhas.reduce((acc, l) => acc + (Number(l.valor) || 0), 0)
  const encargos = grupo.percEncargos ? base * (grupo.percEncargos / 100) : 0
  return base + encargos
}

export function computeViabilidade(estudo: ViabilidadeEstudo): ViabilidadeResultado {
  const porGrupo = estudo.grupos.map((g) => ({ grupo: g.grupo, total: totalGrupo(g) }))
  const custoDiretoTotal = porGrupo.reduce((acc, g) => acc + g.total, 0)
  const percBDI = calcBDIPercentual(estudo.bdi)
  const custoComBDI = custoDiretoTotal * (1 + percBDI / 100)
  const margemProjetadaValor = estudo.receitaContratual - custoComBDI
  const margemProjetadaPct = estudo.receitaContratual > 0
    ? (margemProjetadaValor / estudo.receitaContratual) * 100
    : 0

  return { custoDiretoTotal, percBDI, custoComBDI, margemProjetadaValor, margemProjetadaPct, porGrupo }
}
