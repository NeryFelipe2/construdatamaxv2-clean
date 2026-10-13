// ═══════════════════════════════════════════════════════════════════════
// Dados extraídos dos grupos WhatsApp da obra WCR (período 11-28/06/2026)
// Fonte: 9 chats descompactados de C:\tmp\wcr_chats\d2 = v2 com frota corrigida
//   • Frota própria: 7 máquinas + 3 caminhões (10 itens)
//   • Fornecedores externos: 7 veículos (separados da frota própria)
//   • 6 motoristas da casa
// Atualizado em: 02/07/2026
// ═══════════════════════════════════════════════════════════════════════

import dadosWhatsApp from './apontamentos.json'

export interface EquipeMembro {
  nome: string
  funcao: string
}

export interface Equipe {
  nome: string
  lider: string
  tipo: 'esgoto' | 'agua' | 'geral' | 'misto'
  membros: string[]
  funcoes: Record<string, string>
  maquina: string | null
  motoristas?: string[]
  equipamentos?: string[]
}

export interface Apontamento {
  data: string
  nucleo: string
  equipe: string
  lider?: string
  rua?: string
  servico: string
  materiais?: Record<string, string | number>
  metragem_m?: number
  profundidade_m?: number
  maquina?: string
  casas?: string[]
  viagens_bota_fora?: number
  reparos_agua?: number
  observacoes?: string
  equipamentos?: string[]
  casas_hm?: Record<string, number>
}

export interface PedidoCompra {
  data: string
  material: string
  fornecedor?: string
  valor_total?: number
  valor?: number | string
  quem_pediu: string
  contato?: string
  cnpj?: string
  notas?: number
  observacao?: string
  status?: string
  urgencia?: string
  pix?: string
  descricao?: string
}

export interface FrotaMaquina {
  tipo: string
  modelo: string | null
  operador: string | null
  placa: string | null
  equipes_usam: string[]
  observacao?: string
}

export interface FrotaCaminhao {
  tipo: string
  modelo: string | null
  placa: string | null
  motoristas: string[]
  km_inicial?: number
  km_inicial_2?: number
  km?: number
  equipes_usam: string[]
  observacao?: string
}

export interface VeiculoFornecedor {
  placa: string
  tipo: string
  motorista?: string
  km?: number
}

export interface FornecedorExterno {
  fornecedor: string
  veiculos: VeiculoFornecedor[]
  servico: string
}

export interface Ferramenta {
  nome: string
  observacao?: string
}

export interface FrotaPropria {
  maquinas: FrotaMaquina[]
  caminhoes: FrotaCaminhao[]
}

export interface EquipamentoFrota {
  tipo: string
  modelo?: string
  placa?: string | null
  operador?: string | null
  motoristas?: string[]
  km_inicial?: number
  km_inicial_2?: number
  km?: number
  horimetro?: string
  observacao?: string
  nome?: string
  lista?: string[]
  quem_solicitou?: string
}

export interface Motorista {
  nome: string
  funcao: string
  veiculo?: string | null
  observacao?: string
}

export interface TotaisPeriodo {
  hidrometros_baixados_app_zn: number
  hidrometros_instalados_periodo: number
  adesoes_boi_malhado: number
  hidrometros_sakura: number
  ligacoes_esgoto_baixadas: number
}

export const EQUIPES_WCR: Equipe[] = dadosWhatsApp.equipes as Equipe[]

export const APONTAMENTOS_WCR: Apontamento[] = dadosWhatsApp.apontamentos as Apontamento[]

export const PEDIDOS_COMPRA_WCR: PedidoCompra[] = dadosWhatsApp.pedidos_compra as PedidoCompra[]

// Nova estrutura de frota (v2) — separada por categoria
export const FROTA_PROPRIA_WCR: FrotaPropria = dadosWhatsApp.frota_propria as FrotaPropria
export const FORNECEDORES_EXTERNOS_WCR: FornecedorExterno[] = dadosWhatsApp.fornecedores_externos as FornecedorExterno[]
export const FERRAMENTAS_WCR: Ferramenta[] = dadosWhatsApp.ferramentas as Ferramenta[]
export const MOTORISTAS_WCR: Motorista[] = dadosWhatsApp.motoristas as Motorista[]

// Resumo numérico
export const FROTA_RESUMO_WCR = dadosWhatsApp.frota_resumo as {
  total_maquinas_proprias: number
  total_caminhoes_proprios: number
  total_fornecedores_externos: number
  total_motoristas: number
  total_ferramentas: number
  observacao: string
}

export const TOTAIS_PERIODO_WCR: TotaisPeriodo = dadosWhatsApp.totais_periodo as TotaisPeriodo

export const LOCALIZACOES_WCR = dadosWhatsApp.localizacoes as {
  canteiro_principal: string
  sakura: string
}

export const OBSERVACOES_WCR: string[] = dadosWhatsApp.observacoes_gerais as string[]

export function equipesPorTipo(tipo: Equipe['tipo']): Equipe[] {
  return EQUIPES_WCR.filter((e) => e.tipo === tipo)
}

export function apontamentosPorEquipe(equipeNome: string): Apontamento[] {
  return APONTAMENTOS_WCR.filter((a) =>
    a.equipe.toLowerCase().includes(equipeNome.toLowerCase()),
  )
}

export function apontamentosPorData(data: string): Apontamento[] {
  return APONTAMENTOS_WCR.filter((a) => a.data === data)
}

export function datasUnicas(): string[] {
  return Array.from(new Set(APONTAMENTOS_WCR.map((a) => a.data))).sort()
}

export function totalMateriais(materialKey: string): number {
  let total = 0
  for (const ap of APONTAMENTOS_WCR) {
    const mat = ap.materiais?.[materialKey]
    if (typeof mat === 'number') total += mat
    else if (typeof mat === 'string') {
      const num = parseFloat(mat)
      if (!isNaN(num)) total += num
    }
  }
  return total
}

export const RESUMO_EXTRACAO = {
  periodo: dadosWhatsApp.periodo,
  obra: dadosWhatsApp.obra,
  totalApontamentos: APONTAMENTOS_WCR.length,
  totalEquipes: EQUIPES_WCR.length,
  totalMaquinasProprias: FROTA_RESUMO_WCR.total_maquinas_proprias,
  totalCaminhoesProprios: FROTA_RESUMO_WCR.total_caminhoes_proprios,
  totalFornecedoresExternos: FROTA_RESUMO_WCR.total_fornecedores_externos,
  totalMotoristas: FROTA_RESUMO_WCR.total_motoristas,
  totalFerramentas: FROTA_RESUMO_WCR.total_ferramentas,
  totalPedidos: PEDIDOS_COMPRA_WCR.length,
}