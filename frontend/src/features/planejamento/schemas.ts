/**
 * schemas.ts — Zod validation schemas for the Planejamento module.
 * All user-facing form inputs are validated here before entering store state.
 */
import { z } from 'zod'

// ─── Primitives ───────────────────────────────────────────────────────────────

const positiveNumber = z.number().positive('Deve ser positivo')
const nonNegativeNumber = z.number().min(0, 'Não pode ser negativo')
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (yyyy-MM-dd)')

// ─── Trecho Schema ────────────────────────────────────────────────────────────

export const planTrechoSchema = z.object({
  code: z.string().min(1, 'Código obrigatório').max(20, 'Máx. 20 caracteres'),
  description: z.string().min(1, 'Descrição obrigatória').max(200, 'Máx. 200 caracteres'),
  lengthM: positiveNumber.max(99999, 'Comprimento muito grande'),
  depthM: positiveNumber.max(50, 'Profundidade máxima 50m'),
  diameterMm: positiveNumber.max(5000, 'Diâmetro máximo 5000mm'),
  soilType: z.enum(['normal', 'rocky', 'mixed']),
  requiresShoring: z.boolean(),
  unitCostBRL: nonNegativeNumber.optional(),
  notes: z.string().max(500, 'Máx. 500 caracteres').optional(),
})

export type PlanTrechoFormData = z.infer<typeof planTrechoSchema>

// ─── Team Schema ─────────────────────────────────────────────────────────────

export const planTeamSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(60, 'Máx. 60 caracteres'),
  foremanCount:      nonNegativeNumber.int('Deve ser inteiro').max(20),
  workerCount:       nonNegativeNumber.int('Deve ser inteiro').max(100),
  helperCount:       nonNegativeNumber.int('Deve ser inteiro').max(100),
  operatorCount:     nonNegativeNumber.int('Deve ser inteiro').max(20),
  retroescavadeira:  nonNegativeNumber.int('Deve ser inteiro').max(20),
  compactador:       nonNegativeNumber.int('Deve ser inteiro').max(20),
  caminhaoBasculante: nonNegativeNumber.int('Deve ser inteiro').max(20),
  laborHourlyRateBRL:    positiveNumber.max(9999),
  equipmentDailyRateBRL: nonNegativeNumber.max(99999),
})

export type PlanTeamFormData = z.infer<typeof planTeamSchema>

// ─── Productivity Schema ──────────────────────────────────────────────────────

export const planProductivitySchema = z.object({
  escavacao:    positiveNumber.max(500),
  assentamento: positiveNumber.max(500),
  reaterro:     positiveNumber.max(500),
  escoramento:  positiveNumber.max(500),
  pavimentacao: positiveNumber.max(500),
})

export type PlanProductivityFormData = z.infer<typeof planProductivitySchema>

// ─── Schedule Config Schema ───────────────────────────────────────────────────

export const planScheduleConfigSchema = z.object({
  startDate:       dateString,
  workHoursPerDay: z.number().int().min(1).max(24),
  workWeekMode:    z.enum(['mon_fri', 'mon_sat']),
})

export type PlanScheduleConfigFormData = z.infer<typeof planScheduleConfigSchema>

// ─── Holiday Schema ───────────────────────────────────────────────────────────

export const planHolidaySchema = z.object({
  date:        dateString,
  description: z.string().min(1, 'Descrição obrigatória').max(100, 'Máx. 100 caracteres'),
})

export type PlanHolidayFormData = z.infer<typeof planHolidaySchema>

// ─── Service Note Schema ──────────────────────────────────────────────────────

export const serviceNoteSchema = z.object({
  date:     dateString,
  trechoId: z.string().min(1, 'Trecho obrigatório'),
  teamId:   z.string().min(1, 'Equipe obrigatória'),
  type:     z.enum(['instruction', 'safety', 'material', 'inspection', 'other']),
  title:    z.string().min(1, 'Título obrigatório').max(150, 'Máx. 150 caracteres'),
  body:     z.string().min(1, 'Conteúdo obrigatório').max(2000, 'Máx. 2000 caracteres'),
  createdBy: z.string().min(1, 'Autor obrigatório').max(100),
})

export type ServiceNoteFormData = z.infer<typeof serviceNoteSchema>

// ─── Scenario Schema ──────────────────────────────────────────────────────────

export const planScenarioSchema = z.object({
  name:        z.string().min(1, 'Nome obrigatório').max(100, 'Máx. 100 caracteres'),
  description: z.string().max(500, 'Máx. 500 caracteres').optional(),
})

export type PlanScenarioFormData = z.infer<typeof planScenarioSchema>
