import type {
  BudgetLine,
  ConstructionBudgetLine,
  ConstructionMilestone,
  ConstructionRisk,
  ConstructionSite,
  MilestoneStatus,
  ObraStatus,
  Project,
  ProjectPhase,
  ProjectPhaseStatus,
  ProjectStatus,
  RiskLevel,
  RiskStatus,
} from '@/types'
import { supabase, type DbProjeto } from '@/lib/supabase'
import type { ApiProjetoDashboardPayload, ApiProjetoTorrePayload } from '@/lib/api'

/**
 * Custo REAL do projeto até hoje: soma de `medicao_itens.valor` (medição a
 * 60%, já precificada — Fase 5). Usada como override de `dashboard.kpis.
 * custo_total_dia` quando a API externa (FastAPI, dashboard) não responde —
 * substitui o "gasto" fictício por dado que já existe no banco, nunca
 * inventa nada: se a query falhar ou não houver itens, devolve null e o
 * chamador mantém o valor da API (ou fica vazio, honestamente).
 */
export async function custoRealMedicao(projetoId: string): Promise<number | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('medicao_itens')
    .select('valor')
    .eq('projeto_id', projetoId)
    .is('deleted_at', null)
  if (error || !data) return null
  const total = data.reduce((sum, row) => sum + Number((row as { valor: number | null }).valor || 0), 0)
  return total > 0 ? total : null
}

const CITY_COORDINATES: Record<string, { lat: number; lng: number; state: string }> = {
  tatui: { lat: -23.3506, lng: -47.8569, state: 'SP' },
  osasco: { lat: -23.5329, lng: -46.7918, state: 'SP' },
  santos: { lat: -23.9608, lng: -46.3336, state: 'SP' },
  pardinho: { lat: -23.0828, lng: -48.3694, state: 'SP' },
  brasilia: { lat: -15.7939, lng: -47.8828, state: 'DF' },
}

// Coordenadas reais extraidas dos levantamentos GPS (GPKG/shapefile georreferenciados
// SIRGAS 2000 / UTM 23S, EPSG:31983) de cada contrato WCR.
const PROJECT_COORDINATES: Record<string, { lat: number; lng: number; state: string }> = {
  '99e34e64-ff72-592f-9f15-24a81fe6cd91': { lat: -23.48016, lng: -46.669912, state: 'SP' }, // WCR - Boi Malhado (mapa.json, rede real)
  '1c318114-c465-526f-a967-a1f02e34a7c7': { lat: -23.413887, lng: -46.581969, state: 'SP' }, // WCR - Comunidade do Retorno (centroide de 193 pontos, ACAD-PROJETO COMUNIDADE DO RETORNOrev0agua.gpkg)
  'bf33d1fb-4716-5a9c-adce-97f1273615b2': { lat: -23.434092, lng: -46.590644, state: 'SP' }, // WCR - Sakura (centroide das areas, LRP SAKURA M2.gpkg)
}

function cityKey(cidade?: string | null): string {
  return String(cidade || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function inferLocation(cidade?: string | null, projetoId?: string | null) {
  if (projetoId && PROJECT_COORDINATES[projetoId]) return PROJECT_COORDINATES[projetoId]
  const key = cityKey(cidade)
  return CITY_COORDINATES[key]
}

function mapProjectStatus(status?: string | null): ProjectStatus {
  switch (String(status || '').toLowerCase()) {
    case 'concluido':
    case 'completed':
      return 'completed'
    case 'pausado':
    case 'paused':
    case 'on_hold':
      return 'on_hold'
    case 'planejamento':
    case 'planning':
      return 'planning'
    default:
      return 'active'
  }
}

function mapSiteStatus(status?: string | null): ObraStatus {
  switch (String(status || '').toLowerCase()) {
    case 'concluido':
    case 'completed':
      return 'completed'
    case 'pausado':
    case 'paused':
    case 'on_hold':
      return 'paused'
    case 'planejamento':
    case 'planning':
      return 'planning'
    default:
      return 'active'
  }
}

function phaseStatus(progress: number): ProjectPhaseStatus {
  if (progress >= 100) return 'completed'
  if (progress <= 0) return 'not_started'
  return 'in_progress'
}

function buildPhase(
  id: string,
  name: string,
  startDate: string,
  endDate: string,
  progress: number,
  responsible?: string,
): ProjectPhase {
  return {
    id,
    name,
    status: phaseStatus(progress),
    progress,
    startDate,
    endDate,
    responsible,
  }
}

function buildPlanningPhases(projeto: DbProjeto, existing?: ProjectPhase[]): ProjectPhase[] {
  if (existing?.length) return existing
  const start = projeto.data_inicio || new Date().toISOString().slice(0, 10)
  const end = projeto.data_fim || start
  return [
    buildPhase(`${projeto.id}-plan-1`, 'Engenharia e Design', start, end, 40, projeto.responsavel_nome),
    buildPhase(`${projeto.id}-plan-2`, 'Pre-construcao', start, end, 20, projeto.responsavel_nome),
    buildPhase(`${projeto.id}-plan-3`, 'Aquisicoes', start, end, 10, projeto.responsavel_nome),
  ]
}

function buildExecutionPhases(projeto: DbProjeto, existing?: ProjectPhase[]): ProjectPhase[] {
  if (existing?.length) return existing
  const start = projeto.data_inicio || new Date().toISOString().slice(0, 10)
  const end = projeto.data_fim || start
  const status = mapProjectStatus(projeto.status)
  const executionProgress = status === 'completed' ? 100 : status === 'planning' ? 0 : 25
  return [
    buildPhase(`${projeto.id}-exec-1`, 'Construcao', start, end, executionProgress, projeto.responsavel_nome),
    buildPhase(`${projeto.id}-exec-2`, 'Controle do Projeto', start, end, Math.max(10, executionProgress - 5), projeto.responsavel_nome),
    buildPhase(`${projeto.id}-exec-3`, 'Encerramento', start, end, status === 'completed' ? 100 : 0, projeto.responsavel_nome),
  ]
}

function buildBudgetLines(
  projeto: DbProjeto,
  existing?: BudgetLine[],
  dashboard?: ApiProjetoDashboardPayload | null,
): BudgetLine[] {
  if (existing?.length) return existing

  const orcamentoTotal = Number(projeto.orcamento_total || 0)
  const custoRdo = Number(dashboard?.kpis?.custo_total_dia || 0)
  if (orcamentoTotal <= 0 && custoRdo <= 0) return []

  const labor = Math.round(orcamentoTotal * 0.35)
  const equipment = Math.round(orcamentoTotal * 0.2)
  const materials = Math.round(orcamentoTotal * 0.3)
  const overhead = Math.max(0, orcamentoTotal - labor - equipment - materials)

  return [
    {
      id: `${projeto.id}-budget-labor`,
      type: 'labor',
      description: 'Mao de obra operacional',
      budgeted: labor,
      projected: labor,
      spent: Math.min(labor, Math.round(custoRdo * 0.35)),
    },
    {
      id: `${projeto.id}-budget-equipment`,
      type: 'equipment',
      description: 'Equipamentos e frota',
      budgeted: equipment,
      projected: equipment,
      spent: Math.min(equipment, Math.round(custoRdo * 0.25)),
    },
    {
      id: `${projeto.id}-budget-materials`,
      type: 'materials',
      description: 'Materiais e locacoes',
      budgeted: materials,
      projected: materials,
      spent: Math.min(materials, Math.round(custoRdo * 0.3)),
    },
    {
      id: `${projeto.id}-budget-overhead`,
      type: 'overhead',
      description: 'Custos indiretos',
      budgeted: overhead,
      projected: overhead,
      spent: Math.min(overhead, Math.round(custoRdo * 0.1)),
    },
  ]
}

export function mapDbProjetoToProject(
  projeto: DbProjeto,
  options?: {
    existing?: Project | null
    dashboard?: ApiProjetoDashboardPayload | null
  },
): Project {
  const existing = options?.existing ?? null
  const location = inferLocation(projeto.cidade, projeto.id)

  return {
    id: projeto.id,
    code: projeto.contrato || projeto.id.slice(0, 8).toUpperCase(),
    name: projeto.nome,
    owner: projeto.cliente || 'ConstruData',
    manager: projeto.responsavel_nome || 'Responsavel',
    description: existing?.description || `${projeto.tipo || 'obra'} - ${projeto.cidade || ''}`.trim(),
    status: mapProjectStatus(projeto.status),
    startDate: projeto.data_inicio || new Date().toISOString().slice(0, 10),
    endDate: projeto.data_fim || projeto.data_inicio || new Date().toISOString().slice(0, 10),
    planningPhases: buildPlanningPhases(projeto, existing?.planningPhases),
    executionPhases: buildExecutionPhases(projeto, existing?.executionPhases),
    budgetLines: buildBudgetLines(projeto, existing?.budgetLines, options?.dashboard),
    demands: existing?.demands || [],
    documents: existing?.documents || [],
    lat: existing?.lat ?? location?.lat,
    lng: existing?.lng ?? location?.lng,
    address: existing?.address || `${projeto.cidade || ''} / ${location?.state || 'SP'}`.trim(),
    contractNumber: projeto.contrato,
    clientName: projeto.cliente,
    projectManager: projeto.responsavel_nome,
    riskLevel: existing?.riskLevel,
    priority: existing?.priority || 'medium',
  }
}

function mapRiskLevel(value?: string | null): RiskLevel {
  const raw = String(value || '').toLowerCase()
  if (raw.includes('crit')) return 'critical'
  if (raw.includes('alt') || raw.includes('high')) return 'high'
  if (raw.includes('baix') || raw.includes('low')) return 'low'
  return 'medium'
}

function mapRiskStatus(value?: string | null): RiskStatus {
  const raw = String(value || '').toLowerCase()
  if (raw.includes('resol')) return 'resolved'
  if (raw.includes('mitig')) return 'mitigated'
  if (raw.includes('ativ') || raw.includes('aberto')) return 'active'
  return 'identified'
}

function mapMilestoneStatus(value: number): MilestoneStatus {
  if (value >= 100) return 'done'
  if (value > 0) return 'active'
  return 'pending'
}

export function mapRowsToConstructionRisks(rows: Array<Record<string, unknown>>, prefix: string): ConstructionRisk[] {
  return rows.map((row, index) => ({
    id: String(row.id || `${prefix}-${index}`),
    title: String(row.titulo || row.tema || row.descricao || `Risco ${index + 1}`),
    description: String(row.descricao || row.observacao || row.localizacao || 'Sem descricao'),
    level: mapRiskLevel(String(row.prioridade || row.level || row.criticidade || row.status || 'medium')),
    status: mapRiskStatus(String(row.status || row.situacao || 'identified')),
    identifiedAt: String(row.created_at || row.prazo || new Date().toISOString().slice(0, 10)),
    notes: String(row.observacoes || row.impacto || row.responsavel || ''),
  }))
}

function buildMilestones(
  projeto: DbProjeto,
  phaseList: ProjectPhase[],
  prefix: string,
): ConstructionMilestone[] {
  return phaseList.map((phase, index) => ({
    name: phase.name,
    date: index === phaseList.length - 1 ? (projeto.data_fim || phase.endDate) : phase.startDate,
    status: mapMilestoneStatus(phase.progress),
  }))
}

function buildConstructionBudgetLines(
  projeto: DbProjeto,
  existing?: ConstructionBudgetLine[],
  dashboard?: ApiProjetoDashboardPayload | null,
): ConstructionBudgetLine[] {
  if (existing?.length) return existing
  const orcamento = Number(projeto.orcamento_total || 0)
  const diario = Number(dashboard?.kpis?.custo_total_dia || 0)
  if (orcamento <= 0 && diario <= 0) return []
  return [
    {
      label: 'Orcamento total',
      amount: orcamento,
      projected: Math.max(diario, orcamento),
    },
    {
      label: 'Custo operacional',
      amount: Math.max(diario, 0),
      projected: Math.max(diario, 0),
    },
  ]
}

export function mapDbProjetoToConstructionSite(
  projeto: DbProjeto,
  options?: {
    existing?: ConstructionSite | null
    dashboard?: ApiProjetoDashboardPayload | null
    torre?: ApiProjetoTorrePayload | null
  },
): ConstructionSite {
  const existing = options?.existing ?? null
  const location = inferLocation(projeto.cidade, projeto.id)
  const projectView = mapDbProjetoToProject(projeto, { existing: null, dashboard: options?.dashboard || null })
  const torre = options?.torre ?? null
  const riscos = mapRowsToConstructionRisks(
    [
      ...(torre?.restricoes || []),
      ...(torre?.riscos || []),
    ] as Array<Record<string, unknown>>,
    `${projeto.id}-risk`,
  )

  return {
    id: projeto.id,
    code: projeto.contrato || projeto.id.slice(0, 8).toUpperCase(),
    name: projeto.nome,
    company: projeto.cliente || 'ConstruData',
    owner: projeto.cliente || 'ConstruData',
    manager: projeto.responsavel_nome || 'Responsavel',
    description: existing?.description || `${projeto.tipo || 'obra'} - ${projeto.cidade || ''}`.trim(),
    status: mapSiteStatus(projeto.status),
    street: existing?.street || '',
    number: existing?.number || '',
    district: existing?.district || '',
    city: projeto.cidade || '',
    state: location?.state || existing?.state || 'SP',
    cep: existing?.cep || '',
    buildingType: projeto.tipo || 'saneamento',
    totalArea: Number(projeto.orcamento_total || 0),
    floors: existing?.floors || 1,
    startDate: projeto.data_inicio || new Date().toISOString().slice(0, 10),
    expectedEnd: projeto.data_fim || projeto.data_inicio || new Date().toISOString().slice(0, 10),
    lat: existing?.lat ?? location?.lat ?? null,
    lng: existing?.lng ?? location?.lng ?? null,
    risks: riscos.length > 0 ? riscos : existing?.risks || [],
    budgetLines: buildConstructionBudgetLines(projeto, existing?.budgetLines, options?.dashboard || null),
    planningMilestones: existing?.planningMilestones || buildMilestones(projeto, projectView.planningPhases, 'planning'),
    executionMilestones: existing?.executionMilestones || buildMilestones(projeto, projectView.executionPhases, 'execution'),
  }
}
