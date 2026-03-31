// ─── Activity / Kanban ────────────────────────────────────────────────────────

export type ActivityStatus = 'planned' | 'in_progress' | 'completed'

export interface Activity {
  id: string
  name: string
  plannedQty: number
  actualQty: number
  unit: string
  crewId: string
  status: ActivityStatus
}

// ─── Crews ────────────────────────────────────────────────────────────────────

export interface Timecard {
  id: string
  workerName: string
  role: string
  hoursWorked: number
  hourlyRate: number
}

export interface Crew {
  id: string
  foremanName: string
  crewType: string
  timecards: Timecard[]
  activityIds: string[]
}

// ─── Equipment ────────────────────────────────────────────────────────────────

export interface EquipmentLog {
  id: string
  equipmentId: string
  type: string
  activityId: string
  utilizationHours: number
  hourlyRate: number
}

// ─── Materials ────────────────────────────────────────────────────────────────

export interface MaterialLog {
  id: string
  materialId: string
  projectName: string
  activityId: string
  quantity: number
  unit: string
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export interface ReportPhoto {
  id: string
  base64: string
  label: string
  uploadedAt: string
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface DailyReport {
  id: string
  date: string
  projectName: string
  activities: Activity[]
  crews: Crew[]
  equipmentLogs: EquipmentLog[]
  materialLogs: MaterialLog[]
  photos: ReportPhoto[]
}

// ─── Equipment Profile Module ─────────────────────────────────────────────────

export type EquipmentStatus = 'active' | 'idle' | 'maintenance' | 'alert' | 'offline'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface EquipmentAlert {
  id: string
  equipmentId: string
  severity: AlertSeverity
  type: string
  message: string
  timestamp: string        // ISO string
  acknowledged: boolean
}

export interface EquipmentProfile {
  id: string
  code: string             // e.g. 'EQ-017'
  name: string
  type: string             // e.g. 'Plataforma Elevatória'
  brand: string
  model: string
  year: number
  serialNumber: string
  status: EquipmentStatus
  lat: number | null
  lng: number | null
  siteName: string | null
  description: string
  maxLoad: string
  lastMaintenance: string  // yyyy-MM-dd
  nextMaintenance: string  // yyyy-MM-dd
  operator: string | null
  engineHours: number
  alerts: EquipmentAlert[]
}

// ─── Projetos ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'planning' | 'completed' | 'on_hold'
export type ProjectPhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed'
export type BudgetLineType = 'labor' | 'equipment' | 'materials' | 'subcontract' | 'overhead' | 'other'
export type DesignViewType = '3D' | '4D' | '5D'
export type DocumentCategory = 'contract' | 'drawing' | 'specification' | 'report' | 'other'

export interface ProjectPhase {
  id: string
  name: string
  status: ProjectPhaseStatus
  progress: number       // 0–100
  startDate: string      // yyyy-MM-dd
  endDate: string        // yyyy-MM-dd
  notes?: string
  responsible?: string   // nome do responsável pela fase
}

export interface BudgetLine {
  id: string
  type: BudgetLineType
  description: string
  budgeted: number       // R$
  projected: number      // R$
  spent: number          // R$
}

export interface DesignDemand {
  id: string
  label: string
  quantity: number
  unit: string
  estimatedCost: number  // R$
}

export interface ProjectDocument {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  base64: string
  uploadedAt: string     // ISO
  uploadedBy: string
  category: DocumentCategory
}

export interface Project {
  id: string
  code: string           // e.g. 'PRJ-001'
  name: string
  owner: string          // dono
  manager: string        // gerente
  description: string
  status: ProjectStatus
  startDate: string      // yyyy-MM-dd
  endDate: string        // yyyy-MM-dd
  planningPhases: ProjectPhase[]   // 3 items: Engenharia e Design, Pré-construção, Aquisições
  executionPhases: ProjectPhase[]  // 3 items: Construção, Controle do Projeto, Encerramento
  budgetLines: BudgetLine[]
  demands: DesignDemand[]
  documents: ProjectDocument[]
  lat?: number        // latitude WGS84
  lng?: number        // longitude WGS84
  address?: string    // endereço textual da obra
  contractNumber?: string   // Nº do contrato
  clientName?: string       // cliente / contratante
  projectManager?: string   // gerente de projeto
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  priority?: 'low' | 'medium' | 'high'
}

// ─── Torre de Controle ────────────────────────────────────────────────────────

export type ObraStatus = 'active' | 'planning' | 'paused' | 'completed'
export type RiskLevel  = 'critical' | 'high' | 'medium' | 'low'
export type RiskStatus = 'identified' | 'active' | 'mitigated' | 'resolved'

export interface ConstructionRisk {
  id: string
  title: string
  description: string
  level: RiskLevel
  status: RiskStatus
  identifiedAt: string  // ISO date string
  notes?: string
}

export interface ConstructionSite {
  id: string
  code: string          // e.g. 'OBR-001'
  name: string          // nome da obra
  company: string       // empresa responsável
  owner: string         // dono da obra
  manager: string       // gerente da construção
  description: string
  status: ObraStatus
  street: string        // rua
  number: string        // número
  district: string      // bairro
  city: string          // cidade
  state: string         // estado (e.g. 'SP')
  cep: string           // CEP
  buildingType: string  // tipo: 'Residencial', 'Comercial', 'Industrial', etc.
  totalArea: number     // m²
  floors: number        // andares / pavimentos
  startDate: string     // yyyy-MM-dd
  expectedEnd: string   // yyyy-MM-dd
  lat: number | null
  lng: number | null
  risks: ConstructionRisk[]
  budgetLines?: ConstructionBudgetLine[]
  planningMilestones?: ConstructionMilestone[]
  executionMilestones?: ConstructionMilestone[]
}

export interface ConstructionBudgetLine {
  label: string
  amount: number      // valor contratado/orçado
  projected: number   // projeção atualizada
}

export type MilestoneStatus = 'done' | 'active' | 'pending'

export interface ConstructionMilestone {
  name: string
  date: string        // yyyy-MM-dd
  status: MilestoneStatus
}

// ─── Agenda / Gantt ───────────────────────────────────────────────────────────

export type TaskColor    = 'blue' | 'orange' | 'green' | 'red' | 'purple'
export type AgendaPriority = 'low' | 'medium' | 'high' | 'critical'
export type AgendaViewMode = 'day' | 'week' | 'month' | 'quarter' | 'semester' | 'year'
export type AgendaDisplayView = 'gantt' | 'calendar'

export interface AgendaTask {
  id: string
  title: string
  resourceId: string
  startDate: string   // 'yyyy-MM-dd'
  endDate: string     // 'yyyy-MM-dd'
  color: TaskColor
  status: 'scheduled' | 'unscheduled' | 'completed'
  priority: AgendaPriority   // obrigatório
  assignedTo?: string        // responsável (nome)
  teamLeadName?: string      // encarregado
  location?: string
  estimatedHours?: number
  completionPct?: number     // 0-100
  linkedProjectId?: string
  notes?: string
}

export interface AgendaResource {
  id: string
  code: string
  name: string
  type: 'equipment' | 'crew' | 'other'
  status: 'active' | 'inactive'
}

// ─── Gestão de Equipamentos ───────────────────────────────────────────────────

export type WorkOrderStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type MaintenanceType = 'preventive' | 'corrective' | 'predictive'

export interface MaintenanceOrder {
  id: string
  equipmentId: string
  type: MaintenanceType
  description: string
  scheduledDate: string      // yyyy-MM-dd
  completedDate?: string
  responsible: string
  estimatedCost: number
  actualCost?: number
  status: WorkOrderStatus
  notes?: string
}

// ─── Pré-Construção ───────────────────────────────────────────────────────────

export type PipelineStep   = 'upload' | 'extraction' | 'normalization' | 'matching' | 'proposal'
export type ClauseSeverity = 'critical' | 'warning' | 'info'
export type CostSource     = 'sinapi' | 'seinfra' | 'custom'

export interface TakeoffItem {
  id: string
  description: string
  quantity: number
  unit: string
  confidence: number          // 0–100
  source: string              // filename
  normalized?: boolean
  normalizedDescription?: string
  normalizedQuantity?: number
  normalizedUnit?: string
}

export interface CostMatch {
  takeoffItemId: string
  source: CostSource
  code: string
  description: string
  unit: string
  unitCost: number
  score: number               // 0–100
  selected: boolean
  overrideUnitCost?: number
}

export interface ContractClause {
  id: string
  severity: ClauseSeverity
  type: string
  excerpt: string
  explanation: string
  recommendation: string
}

export interface BDIConfig {
  adminCentral: number
  iss: number
  pisCofins: number
  seguro: number
  lucro: number
}

export interface AnalysisSession {
  id: string
  createdAt: string
  fileNames: string[]
  totalItems: number
  totalCost: number
  status: PipelineStep
}

export interface SinapiEntry {
  code: string
  description: string
  unit: string
  unitCost: number
  category: string
  state: string
  referenceDate: string
}

// ─── Suprimentos / Three-Way Match ────────────────────────────────────────────

export type MatchStatus     = 'matched' | 'partial' | 'discrepancy' | 'pending'
export type ExceptionStatus = 'open' | 'in_review' | 'resolved' | 'escalated'
export type ExceptionType   = 'quantity_diff' | 'price_diff' | 'item_missing' | 'duplicate'
export type POStatus        = 'open' | 'partial' | 'closed' | 'cancelled'
export type InvoiceStatus   = 'pending' | 'pre_approved' | 'approved' | 'rejected'

export interface POItem {
  id: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
}

export interface PurchaseOrder {
  id: string
  code: string
  supplier: string
  responsible: string
  issuedDate: string
  expectedDelivery: string
  items: POItem[]
  status: POStatus
  projectRef?: string
}

export interface GoodsReceiptItem {
  poItemId: string
  receivedQty: number
  unit: string
  notes?: string
}

export interface GoodsReceipt {
  id: string
  poId: string
  code: string
  receivedDate: string
  receivedBy: string
  items: GoodsReceiptItem[]
}

export interface InvoiceItem {
  poItemId: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
}

export interface Invoice {
  id: string
  poId: string
  number: string
  supplier: string
  issueDate: string
  dueDate: string
  items: InvoiceItem[]
  totalAmount: number
  status: InvoiceStatus
}

export interface Discrepancy {
  itemId: string
  field: 'quantity' | 'price' | 'missing'
  poValue: number
  receivedValue?: number
  invoicedValue?: number
  delta: number
  deltaPercent: number
}

export interface ThreeWayMatch {
  id: string
  poId: string
  receiptId?: string
  invoiceId?: string
  status: MatchStatus
  matchedAt?: string
  discrepancies: Discrepancy[]
}

export interface MatchException {
  id: string
  matchId: string
  poId: string
  type: ExceptionType
  description: string
  status: ExceptionStatus
  assignedTo: string[]
  suggestedAction: string
  createdAt: string
  resolvedAt?: string
  notes?: string
}

export interface DemandForecast {
  id: string
  weekLabel: string
  materialCategory: string
  estimatedQty: number
  unit: string
  suggestedOrderDate: string
  relatedPhase: string
  estimatedValue: number
  status: 'suggested' | 'ordered' | 'dismissed'
}

// ─── Suprimentos: Requisitions & Framework Agreements ────────────────────────

export type RequisitionStatus = 'submitted' | 'parsing' | 'ontology_matched' | 'proposals' | 'ordered'

export interface Requisition {
  id: string
  code: string              // REQ-001
  material: string          // "Cimento CP-II 50kg"
  category: string          // "Cimento / Argamassa"
  quantity: number
  unit: string
  requestedBy: string
  projectRef: string
  requestedAt: string       // ISO date
  status: RequisitionStatus
  ontologyMatch?: string    // matched ontology category code
  suggestedSuppliers?: string[]
  linkedPoId?: string
  notes?: string
}

export interface FrameworkAgreement {
  id: string
  code: string              // FA-001
  supplier: string
  category: string
  validFrom: string         // yyyy-MM-dd
  validTo: string
  agreedUnitPrice: number
  maxQuantity: number
  unit: string
  leadTimeDays: number
  confidenceScore: number   // 1.0 – 5.0 based on past performance
  status: 'active' | 'expiring' | 'expired'
  terms: string             // short summary of key contract terms
  paymentSchedule?: { dueDate: string; amount: number; status: 'pending' | 'paid' | 'overdue' }[]
  deliverySchedule?: { phase: string; dueDate: string; quantity: number; status: 'on_time' | 'delayed' | 'delivered' }[]
  terminationClause?: string
  priceAdjustmentIndex?: 'IGP-M' | 'INCC' | 'IPCA' | 'Fixo'
  priceAdjustmentPct?: number
}

// ─── Mão de Obra ──────────────────────────────────────────────────────────────

export type WorkerStatus   = 'active' | 'inactive' | 'suspended' | 'pending_approval'
export type CertStatus     = 'valid' | 'expiring' | 'expired'
export type OccurrenceType = 'weather' | 'material_delay' | 'equipment_failure' | 'holiday' | 'accident' | 'other'

export interface WorkerCertification {
  id: string
  type: string           // 'NR18', 'NR35', 'NR10', 'NR12', 'CIPA', 'ASO', etc.
  issuedDate: string     // yyyy-MM-dd
  expiryDate: string     // yyyy-MM-dd
  status: CertStatus
}

export type ContractType = 'clt' | 'pj' | 'freelancer' | 'apprentice'
export type ScheduleType = 'standard' | '6x1' | '5x2' | '12x36' | 'daily' | 'custom'

export interface Worker {
  id: string
  name: string
  role: string
  cpfMasked: string      // "***.***.***-XX" — last 2 digits only
  crewId: string
  status: WorkerStatus
  certifications: WorkerCertification[]
  hourlyRate: number
  biometricToken?: string  // opaque hash reference — raw biometric never stored
  // Extended HR fields (all optional for backward compatibility)
  registrationNumber?: string   // matrícula
  department?: string
  email?: string
  phone?: string
  admissionDate?: string        // yyyy-MM-dd
  contractType?: ContractType
  scheduleType?: ScheduleType
  workFront?: string            // frente de trabalho
}

export interface TimecardEntry {
  id: string
  workerId: string
  date: string           // yyyy-MM-dd
  hoursWorked: number
  projectRef: string
  phaseRef: string
  activityDescription: string
  reportedQty: number
  unit: string           // 'm²', 'ml', 'un', etc.
  notes?: string
}

export interface PhysicalProgress {
  id: string
  date: string           // yyyy-MM-dd
  phaseId: string
  activityName: string
  plannedQty: number
  reportedQty: number
  unit: string
}

export interface LaborCrew {
  id: string
  name: string
  foreman: string
  specialty: string
  workerIds: string[]
  projectRef: string
}

export interface LaborOccurrence {
  id: string
  date: string           // yyyy-MM-dd
  type: OccurrenceType
  description: string
  impactHours: number
  affectedCrewIds: string[]
}

export interface RiskArea {
  id: string
  name: string
  requiredCertTypes: string[]
}

export interface ReallocationSuggestion {
  id: string
  delayedTaskId: string
  delayedTaskName: string
  delayDays: number
  sourceCrew: string
  sourceTaskId: string
  sourceTaskName: string
  sourceTaskFloat: number
  reason: string
  accepted?: boolean
}

// ─── Otimização de Frota e Equipamentos ───────────────────────────────────────

export type RoutingPriority = 'critical' | 'high' | 'medium' | 'low'
export type HealthRisk      = 'critical' | 'high' | 'medium' | 'low'
export type BuyLeaseRec     = 'buy' | 'lease' | 'neutral'

export interface RoutingRecommendation {
  id: string
  equipmentId: string
  equipmentCode: string
  equipmentName: string
  equipmentType: string
  fromSiteId: string
  fromSiteName: string
  fromLat: number | null
  fromLng: number | null
  toSiteId: string
  toSiteName: string
  toLat: number | null
  toLng: number | null
  reason: string
  utilizationGainPct: number     // e.g. 42 = +42% projected utilisation
  estimatedDistanceKm: number
  suggestedDate: string          // yyyy-MM-dd
  priority: RoutingPriority
  bimPhaseRef?: string           // 4D BIM phase name triggering the need
  accepted?: boolean
}

export interface PredictiveHealth {
  equipmentId: string
  equipmentCode: string
  equipmentName: string
  healthScore: number            // 0-100
  riskLevel: HealthRisk
  predictedFailureWindow: string // e.g. "próximos 15 dias"
  mainFactors: string[]
  recommendedAction: string
  estimatedDowntimeDays: number
  estimatedRepairCostBRL: number
}

export interface BuyLeaseAnalysis {
  id: string
  equipmentType: string
  currentStatus: 'owned' | 'rented' | 'none'
  monthlyRentalCostBRL: number
  purchasePriceBRL: number
  annualMaintenanceCostBRL: number
  residualValueBRL: number
  projectedUsageDays: number     // derived from project portfolio
  annualRentalCostBRL: number
  annualOwnershipCostBRL: number
  breakEvenMonths: number
  recommendation: BuyLeaseRec
  reasoning: string
  bimPhases: string[]            // 4D/5D BIM phase names needing this equipment
  relatedProjects: string[]
}

// ─── Gestão de Projeto 360 / Change Orders ────────────────────────────────────

export type ChangeOrderStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type ChangeOrderType   = 'scope' | 'cost' | 'schedule' | 'safety'

export interface ChangeOrderPhoto {
  id: string
  base64: string
  label: string
  capturedAt: string
}

export interface ChangeOrder {
  id: string
  projectId: string
  projectCode: string
  title: string
  type: ChangeOrderType
  status: ChangeOrderStatus
  description: string
  impactCostBRL: number      // positive = cost increase; negative = savings
  impactDays: number         // positive = delay; negative = acceleration
  photos: ChangeOrderPhoto[]
  submittedBy: string
  submittedAt: string        // ISO datetime
  reviewedBy?: string
  reviewedAt?: string
  reviewNotes?: string
  linkedModule?: string      // which module surfaced this issue
  linkedEntityId?: string    // e.g. riskId, equipmentId
}

// ─── Mão de Obra — HR Expansion ───────────────────────────────────────────────

export type ShiftType         = 'regular' | 'overtime' | 'night' | 'holiday' | 'day_off'
export type ShiftStatus       = 'scheduled' | 'confirmed' | 'absent' | 'cancelled'
export type AbsenceType       = 'sick_leave' | 'justified' | 'unjustified' | 'vacation' | 'accident' | 'other'
export type CLTViolationLevel = 'blocking' | 'warning' | 'info'
export type CLTViolationType  = 'max_daily_hours' | 'max_weekly_hours' | 'min_rest' | 'max_overtime' | 'missing_dsr' | 'break_required'

export interface Shift {
  id: string
  workerId: string
  date: string          // yyyy-MM-dd
  startTime: string     // "HH:mm"
  endTime: string       // "HH:mm"
  breakMinutes: number
  type: ShiftType
  workFront?: string
  status: ShiftStatus
  overtimeReason?: string
}

export interface CLTViolation {
  id: string
  workerId: string
  workerName: string
  type: CLTViolationType
  severity: CLTViolationLevel
  description: string
  date: string
}

export interface WorkPost {
  id: string
  name: string           // e.g. "Pedreiro — Fundações"
  workFront: string
  role: string
  minWorkers: number
  shift: 'morning' | 'afternoon' | 'night' | 'all'
}

export interface WorkerAbsence {
  id: string
  workerId: string
  date: string
  type: AbsenceType
  description?: string
  substituteWorkerId?: string
  status: 'open' | 'covered' | 'uncovered'
  registeredAt: string
}

export interface CLTSettings {
  maxDailyHours: number      // default 8
  maxOvertimeHours: number   // default 2
  maxWeeklyHours: number     // default 44
  minRestMinutes: number     // default 660 (11h)
  nightStart: number         // hour, default 22
  nightEnd: number           // hour, default 5
  nightDifferential: number  // %, default 20
  overtimeRate: number       // %, default 50
}

export interface CMORoleItem {
  role: string
  workerCount: number
  regularHours: number
  overtimeHours: number
  nightHours: number
  baseCost: number
  overtimeCost: number
  nightCost: number
  dsrCost: number
  totalCost: number
}

export interface CMOSummary {
  month: string              // "YYYY-MM"
  regularHours: number
  overtimeHours: number
  nightHours: number
  baseCost: number
  overtimeCost: number
  nightCost: number
  dsrCost: number
  totalCost: number
  roleBreakdown: CMORoleItem[]
}

// ─── Folha de Pagamento ────────────────────────────────────────────────────────

export type DeductionType = 'inss' | 'fgts' | 'irrf' | 'vt' | 'va' | 'health' | 'other'
export type AllowanceType = 'overtime' | 'night_diff' | 'dsr' | 'hazard' | 'transport' | 'meal' | 'other'

export interface PayslipDeduction {
  type: DeductionType
  description: string
  amount: number
  /** false = employer-only cost (e.g. FGTS), not deducted from worker's net */
  workerPays: boolean
}

export interface PayslipAllowance {
  type: AllowanceType
  description: string
  amount: number
}

export interface WorkerPayslip {
  id: string
  workerId: string
  month: string              // "YYYY-MM"
  baseSalary: number         // hourlyRate × regular hours
  allowances: PayslipAllowance[]
  deductions: PayslipDeduction[]
  grossTotal: number         // baseSalary + Σ allowances
  netTotal: number           // grossTotal − Σ deductions where workerPays
  employerCost: number       // grossTotal + FGTS + employer-side INSS
  hoursWorked: number
  overtimeHours: number
  nightHours: number
  workingDays: number
  generatedAt: string
}

export interface PayrollMonth {
  month: string
  payslips: WorkerPayslip[]
  totalGross: number
  totalNet: number
  totalEmployerCost: number
  headcount: number
}

// ─── Gestão de Frotas Veicular ────────────────────────────────────────────────

export type VehicleType    = 'car' | 'truck' | 'van' | 'motorcycle' | 'heavy' | 'pickup'
export type VehicleStatus  = 'active' | 'maintenance' | 'inactive' | 'unavailable'
export type FuelType       = 'gasoline' | 'diesel' | 'ethanol' | 'flex' | 'electric' | 'gnv'
export type VehicleMaintenanceType   = 'preventive' | 'corrective'
export type VehicleMaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type ServiceOrderStatus       = 'open' | 'in_progress' | 'awaiting_parts' | 'completed' | 'cancelled'
export type FineStatus               = 'pending' | 'paid' | 'contested'
export type FleetAlertSeverity       = 'critical' | 'high' | 'medium' | 'low'
export type FleetCostType            = 'fuel' | 'maintenance' | 'fine' | 'insurance' | 'tax' | 'other'
export type RouteStatus              = 'planned' | 'in_progress' | 'completed' | 'cancelled'

export interface Vehicle {
  id: string
  plate: string              // "ABC-1234" or "ABC1D234" (Mercosul)
  make: string               // "Volkswagen"
  model: string              // "Constellation 17.280"
  year: number
  type: VehicleType
  fuelType: FuelType
  currentKm: number
  status: VehicleStatus
  assignedDriverId?: string
  department?: string
  acquisitionDate: string
  acquisitionValue: number
  notes?: string
}

export interface FuelRecord {
  id: string
  vehicleId: string
  driverId?: string
  date: string
  liters: number
  pricePerLiter: number
  totalCost: number
  kmAtFill: number           // odometer reading at time of fill
  fullTank: boolean
  station?: string
  notes?: string
}

export interface VehicleMaintenanceRecord {
  id: string
  vehicleId: string
  type: VehicleMaintenanceType
  description: string
  serviceDate: string
  nextServiceDate?: string
  nextServiceKm?: number
  kmAtService: number
  cost: number
  provider?: string
  status: VehicleMaintenanceStatus
  notes?: string
}

export interface VehicleDriver {
  id: string
  name: string
  cpfMasked: string          // "***.***.**-XX"
  licenseNumber: string      // CNH number (display only — never logged raw)
  licenseCategory: string    // "B", "C", "D", "E", "AB", etc.
  licenseExpiry: string
  phone: string
  email?: string
  status: 'active' | 'inactive' | 'suspended'
  workerId?: string          // optional link to Worker
}

export interface VehicleRoute {
  id: string
  vehicleId: string
  driverId?: string
  date: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime?: string
  startKm: number
  endKm?: number
  purpose: string
  status: RouteStatus
  notes?: string
}

export interface VehicleServiceOrder {
  id: string
  vehicleId: string
  code: string               // "OS-0001"
  type: VehicleMaintenanceType
  description: string
  requestedBy: string
  requestedAt: string
  scheduledDate?: string
  completedDate?: string
  estimatedCost?: number
  finalCost?: number
  provider?: string
  status: ServiceOrderStatus
  priority: 'urgent' | 'high' | 'normal' | 'low'
  notes?: string
}

export interface VehicleFine {
  id: string
  vehicleId: string
  driverId?: string
  date: string
  description: string
  infraction: string
  points?: number
  amount: number
  dueDate: string
  status: FineStatus
  autoNumber?: string
  notes?: string
}

export interface FleetMaintenanceAlert {
  id: string
  vehicleId: string
  title: string
  description: string
  severity: FleetAlertSeverity
  triggerType: 'km' | 'date' | 'both'
  triggerKm?: number
  triggerDate?: string
  isActive: boolean
  createdAt: string
}

export interface FleetScheduleEntry {
  id: string
  vehicleId: string
  type: 'maintenance' | 'inspection' | 'route'
  title: string
  scheduledDate: string
  driverId?: string
  notes?: string
  status: 'scheduled' | 'completed' | 'cancelled'
}

// ─── Planejamento ─────────────────────────────────────────────────────────────

export type WorkWeekMode = 'mon_fri' | 'mon_sat'
export type AbcZone      = 'A' | 'B' | 'C'
export type PlanSoilType = 'normal' | 'rocky' | 'mixed'

export interface PlanTrecho {
  id: string
  code: string              // 'T01', 'T02' — user-editable
  description: string
  lengthM: number           // meters
  depthM: number            // avg excavation depth (m)
  diameterMm: number        // pipe diameter in mm
  soilType: PlanSoilType
  requiresShoring: boolean
  unitCostBRL?: number      // from SINAPI / custom
  notes?: string
  // Derived — set by schedule engine, stored for display
  assignedTeamIndex?: number
  plannedStartDate?: string // yyyy-MM-dd
  plannedEndDate?: string   // yyyy-MM-dd
  abcZone?: AbcZone
  // Execution tracking — synced from RDO
  executedMeters?: number
  executionStatus?: 'not_started' | 'in_progress' | 'completed'
  lastRdoDate?: string      // date of last RDO entry for this trecho
}

export interface PlanTeam {
  id: string
  name: string
  foremanCount: number
  workerCount: number
  helperCount: number
  operatorCount: number
  retroescavadeira: number
  compactador: number
  caminhaoBasculante: number
  laborHourlyRateBRL: number
  equipmentDailyRateBRL: number
  maxManualExcavDepthM: number   // depth above which excavation is mechanical-only (default 1.5m)
}

export interface PlanProductivityTable {
  escavacao: number    // m/day
  assentamento: number // m/day
  reaterro: number     // m³/day (converted to m/day via depth × 0.8)
  escoramento: number  // m²/day (converted to m/day via depth)
  pavimentacao: number // m²/day
}

export interface PlanScheduleConfig {
  startDate: string        // yyyy-MM-dd
  workHoursPerDay: number
  workWeekMode: WorkWeekMode
  targetEndDate?: string   // yyyy-MM-dd — optional target for forecast comparison
  ganttGroupingMode?: 'daily_segment' | 'by_trecho' | 'trecho_activity'  // default 'daily_segment'
  groupByProximity?: boolean  // group nearby trechos for sequential execution
}

export interface TechnicalRule {
  id: string
  name: string                     // e.g. "Solo Rochoso — penalidade"
  condition: string                // display label, e.g. "soilType === 'rocky'"
  productivityMultiplier: number   // e.g. 0.6
  costMultiplier: number           // e.g. 1.4
}

export interface PlanHoliday {
  date: string             // yyyy-MM-dd
  description: string
}

export interface GanttCell {
  date: string
  trechoId: string
  teamIndex: number
  metersPlanned: number
  isHydroTest: boolean
}

export interface GanttRow {
  trecho: PlanTrecho
  cells: GanttCell[]
  startDate: string
  endDate: string
  hydroTestDate: string
  durationDays: number     // execution days only (excl. hydro test)
  dailyCostBRL: number
  totalCostBRL: number
  teamIndex: number
}

export interface SCurvePoint {
  dayIndex: number
  date: string
  cumulativePhysicalPct: number
  cumulativeFinancialPct: number
  cumulativeMeters: number
  cumulativeCostBRL: number
}

export interface HistogramPoint {
  dayIndex: number
  date: string
  headcount: number
  equipmentUnits: number
  dailyCostBRL: number
}

export interface AbcItem {
  trecho: PlanTrecho
  totalCostBRL: number
  sharePct: number
  cumulativePct: number
  zone: AbcZone
}

export interface ServiceNote {
  id: string
  date: string
  trechoId: string
  teamId: string
  type: 'instruction' | 'safety' | 'material' | 'inspection' | 'other'
  title: string
  body: string             // plain text — no HTML
  createdAt: string
  createdBy: string
  priority?: 'alta' | 'media' | 'baixa'
  status?: 'pendente' | 'em_andamento' | 'concluida'
  responsavel?: string
}

export interface PlanScenario {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  trechos: PlanTrecho[]
  teams: PlanTeam[]
  productivityTable: PlanProductivityTable
  scheduleConfig: PlanScheduleConfig
  holidays: PlanHoliday[]
}

// ─── RDO (Relatório Diário de Obras) ─────────────────────────────────────────

export type RdoWeatherCondition = 'good' | 'rain' | 'cloudy' | 'storm'
export type RdoTrechoStatus     = 'not_started' | 'in_progress' | 'completed'
export type RdoTab = 'dashboard' | 'novo' | 'historico' | 'integracao' | 'financeiro'

export interface RdoWeather {
  morning:      RdoWeatherCondition
  afternoon:    RdoWeatherCondition
  night:        RdoWeatherCondition
  temperatureC: number
}

export interface RdoManpower {
  foremanCount:  number   // Encarregado
  officialCount: number   // Oficial
  helperCount:   number   // Ajudante
  operatorCount: number   // Operador
  employeeNames?: string[] // lista de nomes dos funcionários presentes
}

export interface RdoEquipmentEntry {
  id:       string
  name:     string
  quantity: number
  hours:    number
}

export interface RdoServiceEntry {
  id:          string
  description: string
  quantity:    number
  unit:        string
}

export interface RdoTrechoEntry {
  id:                string
  trechoCode:        string
  trechoDescription: string
  plannedMeters:     number
  executedMeters:    number
  status:            RdoTrechoStatus
  source:            'rdo' | 'manual'
  system?:           'agua' | 'esgoto' | 'drenagem' | 'estrutura' | 'pavimentacao' | 'outro'
}

export interface RdoPhoto {
  id:         string
  base64:     string    // data:image/...;base64,...
  label:      string
  uploadedAt: string
}

export interface RdoFinancialEntry {
  id:          string
  date:        string   // yyyy-MM-dd
  category:    string
  description: string
  valueBRL:    number
  type:        'expense' | 'revenue'
}

export interface RDO {
  id:           string
  number:       number   // sequential, auto-assigned
  date:         string   // yyyy-MM-dd
  responsible:  string
  weather:      RdoWeather
  manpower:     RdoManpower
  equipment:    RdoEquipmentEntry[]
  services:     RdoServiceEntry[]
  trechos:      RdoTrechoEntry[]
  geolocation:  { lat: string; lng: string } | null
  observations: string
  incidents:    string
  photos:       RdoPhoto[]
  createdAt:    string
  updatedAt:    string
}

// ─── Quantitativos e Orçamento ────────────────────────────────────────────────

export type CostBaseSource = 'sinapi' | 'seinfra' | 'custom' | 'manual'
export type QuantTab = 'composicao' | 'resumo' | 'banco' | 'historico'

export interface OrcamentoItem {
  id:          string
  code:        string          // SINAPI/SEINFRA code or user-defined
  description: string
  unit:        string
  quantity:    number
  unitCost:    number          // from base or overridden
  bdi:         number          // BDI % applied to this item
  totalCost:   number          // quantity × unitCost × (1 + bdi/100)
  category:    string
  source:      CostBaseSource
  notes?:      string
}

export interface OrcamentoBudget {
  id:            string
  name:          string
  description?:  string
  costBase:      CostBaseSource
  items:         OrcamentoItem[]
  bdiGlobal:     number        // global BDI fallback
  totalBRL:      number
  referenceDate: string        // yyyy-MM-dd
  createdAt:     string
  updatedAt:     string
}

export interface CustomBaseEntry {
  id:          string
  code:        string
  description: string
  unit:        string
  unitCost:    number
  category:    string
  source:      string          // "Importado PDF" | "Importado Excel" | "Manual"
}

// ─── BIM 3D/4D/5D ─────────────────────────────────────────────────────────────

export interface BimSegment {
  id:               string
  vertices:         [number, number, number][]  // [x, y, z]
  attributes:       Record<string, string | number>
  trechoCode?:      string
  itemId?:          string
  lengthM:          number
  avgDepthM:        number
  diameter:         number    // mm
  material:         string
  unitCostBRL:      number
  totalCostBRL:     number
  constructionDate?: string   // yyyy-MM-dd (from 4D match)
  phase?:           string
  elementType?:     'pipe' | 'slab' | 'column' | 'wall' | 'beam'
}

export interface BimLayer {
  id:         string
  name:       string
  visible:    boolean
  color:      string
  attribute?: string
}

export interface BimProject {
  id:                  string
  name:                string
  type?:               'sanitation' | 'building' | 'generic'
  segments:            BimSegment[]
  layers:              BimLayer[]
  uploadedAt:          string
  shapefileSourceName: string
}

export type BimColorMode = 'default' | 'depth' | 'date' | 'cost' | 'diameter' | 'pressure'
export type BimTab = 'viewer' | '4d' | '5d'

// ─── LPS / Lean Construction ──────────────────────────────────────────────────

export type LpsCncCategory = 'weather' | 'equipment' | 'labor' | 'material' | 'design' | 'other'
export type LpsReadyStatus = 'green' | 'yellow' | 'red'
export type LpsTab = 'semaforo' | 'lookahead' | 'ppc' | 'takt' | 'restricoes' | 'analytics'

export type LpsRestrictionCategory =
  | 'projeto_engenharia'
  | 'materiais'
  | 'equipamentos'
  | 'mao_de_obra'
  | 'externo'
  | 'outros'

export type LpsRestrictionStatus = 'identificada' | 'em_resolucao' | 'resolvida'

export interface LpsRestriction {
  id: string
  tema: string
  categoria: LpsRestrictionCategory
  descricao: string
  impacto?: string
  responsavel?: string
  prazoRemocao?: string       // 'YYYY-MM-DD'
  acoesNecessarias?: string
  tags: string[]
  observacoes?: string
  status: LpsRestrictionStatus
  createdAt: string
  resolvedAt?: string
}

export interface LpsActivity {
  id: string
  week: string              // ISO week e.g. '2025-W12'
  trechoCode: string
  description: string
  planned: boolean
  completed: boolean
  readyStatus: LpsReadyStatus
  cncCategory?: LpsCncCategory
  cncDescription?: string
  responsibleTeam?: string
  plannedMeters?: number
  executedMeters?: number
}

export interface LpsWeeklyPPC {
  week: string
  planned: number
  completed: number
  ppc: number               // completed / planned * 100
}

export interface TaktZone {
  id: string
  code: string
  lengthM: number
  taktDays: number
  actualDays?: number
  startDate?: string
}

// ─── Mapa Interativo ──────────────────────────────────────────────────────────

export type MapNodeType    = 'junction' | 'endpoint' | 'structure'
export type MapNetworkType = 'sewer' | 'water' | 'drainage' | 'civil' | 'generic'
export type MapTool        = 'idle' | 'addNode' | 'connect' | 'deleteNode' | 'deleteSegment' | 'measure' | 'structure'

export interface MapNode {
  id: string
  lat: number
  lng: number
  label?: string
  nodeType: MapNodeType
  elevation?: number
}

export interface MapSegment {
  id: string
  fromNodeId: string
  toNodeId: string
  networkType: MapNetworkType
  diameter?: number
  material?: string
  depth?: number
  label?: string
  color?: string
}

export interface MapLayer {
  id: MapNetworkType
  name: string
  color: string
  visible: boolean
}

// ─── Simulação de Atrasos (Gestão 360) ───────────────────────────────────────

export interface TrechoDelay {
  trechoCode: string    // identifies the trecho by its code
  delayDays: number     // extra days to delay the trecho start
}

// ─── Rede 360 ─────────────────────────────────────────────────────────────────

export type Rede360Tab = 'home' | 'outages' | 'planning' | 'risk'
export type NetworkAssetType = 'circuit' | 'pipe' | 'pv' | 'structure' | 'device' | 'vegetation' | 'hardening'
export type NetworkAssetStatus = 'operational' | 'degraded' | 'critical' | 'offline' | 'maintenance'
export type Rede360ServiceOrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type ServiceOrderPriority = 'low' | 'medium' | 'high' | 'emergency'
export type OutageStatus = 'active' | 'monitoring' | 'resolved'

export interface NetworkAsset {
  id: string
  type: NetworkAssetType
  networkType: MapNetworkType
  name: string
  code: string
  lat: number
  lng: number
  status: NetworkAssetStatus
  riskLevel: RiskLevel
  installationDate?: string
  lastInspection?: string
  nextInspectionDue?: string
  customerCount?: number
  lengthM?: number
  diameter?: number
  material?: string
  sensorReadings?: { parameter: string; value: number; unit: string; timestamp: string }[]
  flowLMin?: number
  pressureBar?: number
  lossPercent?: number
  waterQuality?: 'good' | 'warning' | 'critical'
  notes?: string
}

export interface Rede360ServiceOrder {
  id: string
  code: string
  assetId: string | null
  type: string
  priority: ServiceOrderPriority
  status: Rede360ServiceOrderStatus
  description: string
  assignedTo?: string
  scheduledDate?: string
  completedDate?: string
  estimatedHours?: number
  createdAt: string
}

export interface Outage {
  id: string
  affectedAssetIds: string[]
  type: string
  status: OutageStatus
  startTime: string
  estimatedRestoreTime?: string
  resolvedTime?: string
  affectedCustomers?: number
  cause?: string
  notes?: string
}

export type GridAssetTab = 'circuit' | 'device' | 'weather' | 'customer' | 'structure' | 'vegetation' | 'hardening'

export interface CircuitAsset {
  id: string
  circuitId: string
  circuitName: string
  circuitClass: 'Distribution' | 'Transmission' | 'Subtransmission'
  riskClassification: string
  riskLevel: RiskLevel
  customerCount: number
  protectedDeviceCount: number
  installedStructureCount: number
  lineSegmentCount: number
  districtName: string
  isInAreaOfInterest: boolean
  networkType: MapNetworkType
  lat: number
  lng: number
  polyline?: [number, number][]
}

export interface DeviceAsset {
  id: string
  deviceId: string
  deviceType: string
  manufacturer?: string
  model?: string
  status: NetworkAssetStatus
  riskLevel: RiskLevel
  lat: number
  lng: number
  circuitId?: string
  installedDate?: string
  lastReading?: string
}

export interface NWSWeatherStation {
  id: string
  stationId: string
  stationName: string
  lat: number
  lng: number
  currentTempC?: number
  windKmh?: number
  precipitationMm?: number
  alerts?: string[]
  lastUpdated: string
}

export interface CustomerRecord {
  id: string
  customerId: string
  address: string
  serviceType: 'residential' | 'commercial' | 'industrial'
  circuitId?: string
  status: 'active' | 'inactive'
}

export interface StructureAsset {
  id: string
  structureId: string
  structureType: string
  condition: 'good' | 'fair' | 'poor' | 'critical'
  inspectionDate?: string
  circuitId?: string
  lat: number
  lng: number
  riskLevel: RiskLevel
}

export interface VegetationPoint {
  id: string
  pointId: string
  address?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'scheduled' | 'completed'
  lastTrimDate?: string
  circuitId?: string
  lat: number
  lng: number
}

export interface HardeningPoint {
  id: string
  pointId: string
  hardeningType: string
  status: 'planned' | 'in_progress' | 'completed'
  completionDate?: string
  circuitId?: string
  lat: number
  lng: number
  riskLevel: RiskLevel
}
