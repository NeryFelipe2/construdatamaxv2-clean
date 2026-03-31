import { z } from 'zod'

// ─── Worker schema ─────────────────────────────────────────────────────────────

export const certStatusSchema = z.enum(['valid', 'expiring', 'expired'])

export const workerCertificationSchema = z.object({
  id:          z.string().min(1),
  type:        z.string().min(1).max(20),
  issuedDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido (AAAA-MM-DD)'),
  expiryDate:  z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido (AAAA-MM-DD)'), z.literal('')]).default(''),
  status:      certStatusSchema,
})

export const workerSchema = z.object({
  name:           z.string().min(2, 'Nome obrigatório').max(100),
  role:           z.string().min(2, 'Função obrigatória').max(100),
  cpfMasked:      z.string().max(20).optional().default('***.***.***-**'),
  crewId:         z.string().optional().default(''),
  status:         z.enum(['active', 'inactive', 'suspended', 'pending_approval']),
  hourlyRate:     z.number().min(0).max(9999.99),
  certifications: z.array(workerCertificationSchema).max(20),
  biometricToken: z.string().max(128).optional(),
})

export type WorkerFormData = z.infer<typeof workerSchema>

// ─── Timecard schema ──────────────────────────────────────────────────────────

export const timecardSchema = z.object({
  workerId:            z.string().min(1, 'Funcionário obrigatório'),
  date:                z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido (AAAA-MM-DD)'),
  hoursWorked:         z.number().min(0).max(24),
  projectRef:          z.string().min(1, 'Projeto obrigatório').max(50),
  phaseRef:            z.string().min(1, 'Fase obrigatória').max(100),
  activityDescription: z.string().min(2, 'Atividade obrigatória').max(200),
  reportedQty:         z.number().min(0),
  unit:                z.string().min(1).max(20),
  notes:               z.string().max(500).optional().default(''),
})

export type TimecardFormData = z.infer<typeof timecardSchema>

// ─── Occurrence schema ────────────────────────────────────────────────────────

export const occurrenceSchema = z.object({
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido (AAAA-MM-DD)'),
  type:            z.enum(['weather', 'material_delay', 'equipment_failure', 'holiday', 'accident', 'other']),
  description:     z.string().min(5, 'Descrição obrigatória').max(500),
  impactHours:     z.number().min(0).max(999),
  affectedCrewIds: z.array(z.string()).min(1, 'Selecione ao menos uma equipe'),
})

export type OccurrenceFormData = z.infer<typeof occurrenceSchema>
