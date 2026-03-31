import { z } from 'zod'
import { parseISO } from 'date-fns'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const projectInfoSchema = z
  .object({
    code:           z.string().min(2, 'Código deve ter ao menos 2 caracteres').max(20),
    name:           z.string().min(2, 'Nome obrigatório').max(100),
    owner:          z.string().min(1, 'Dono obrigatório').max(100),
    manager:        z.string().min(1, 'Gerente obrigatório').max(100),
    description:    z.string().max(500).optional(),
    status:         z.enum(['active', 'planning', 'completed', 'on_hold'] as const),
    startDate:      z.string().regex(DATE_REGEX, 'Data inválida (yyyy-mm-dd)'),
    endDate:        z.string().regex(DATE_REGEX, 'Data inválida (yyyy-mm-dd)'),
    contractNumber: z.string().max(50).optional(),
    clientName:     z.string().max(100).optional(),
    projectManager: z.string().max(100).optional(),
    riskLevel:      z.enum(['low', 'medium', 'high', 'critical'] as const).optional(),
    priority:       z.enum(['low', 'medium', 'high'] as const).optional(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'Data de término deve ser após data de início',
    path: ['endDate'],
  })

export type ProjectInfoFormValues = z.infer<typeof projectInfoSchema>

export const phaseSchema = z
  .object({
    status:    z.enum(['not_started', 'in_progress', 'completed', 'delayed'] as const),
    progress:  z.number().int().min(0, 'Mínimo 0').max(100, 'Máximo 100'),
    startDate: z.string().regex(DATE_REGEX, 'Data inválida (yyyy-mm-dd)'),
    endDate:   z.string().regex(DATE_REGEX, 'Data inválida (yyyy-mm-dd)'),
    notes:     z.string().max(500).optional(),
  })
  .refine(
    (d) => {
      try { return parseISO(d.endDate) >= parseISO(d.startDate) }
      catch { return true }
    },
    { message: 'Data de término deve ser após data de início', path: ['endDate'] }
  )

export type PhaseFormValues = z.infer<typeof phaseSchema>

export const budgetLineSchema = z.object({
  type:        z.enum(['labor', 'equipment', 'materials', 'subcontract', 'overhead', 'other'] as const),
  description: z.string().min(1, 'Descrição obrigatória').max(100),
  budgeted:    z.number().min(0, 'Deve ser positivo'),
  projected:   z.number().min(0, 'Deve ser positivo'),
  spent:       z.number().min(0, 'Deve ser positivo'),
})

export type BudgetLineFormValues = z.infer<typeof budgetLineSchema>
