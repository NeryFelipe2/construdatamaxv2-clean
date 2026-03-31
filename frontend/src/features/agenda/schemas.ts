import { z } from 'zod'
import { parseISO } from 'date-fns'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const taskSchema = z
  .object({
    title:          z.string().min(2, 'Título precisa ter ao menos 2 caracteres').max(100, 'Título muito longo'),
    resourceId:     z.string().min(1, 'Selecione um recurso'),
    startDate:      z.string().regex(DATE_REGEX, 'Data inválida'),
    endDate:        z.string().regex(DATE_REGEX, 'Data inválida'),
    color:          z.enum(['blue', 'orange', 'green', 'red', 'purple'] as const),
    status:         z.enum(['scheduled', 'unscheduled', 'completed'] as const),
    priority:       z.enum(['low', 'medium', 'high', 'critical'] as const),
    assignedTo:     z.string().max(100).optional(),
    teamLeadName:   z.string().max(100).optional(),
    location:       z.string().max(200).optional(),
    estimatedHours: z.number().min(0).max(10000).optional(),
    completionPct:  z.number().min(0).max(100).optional(),
    linkedProjectId: z.string().optional(),
    notes:          z.string().max(500, 'Máximo 500 caracteres').optional(),
  })
  .refine(
    (data) => parseISO(data.endDate) >= parseISO(data.startDate),
    {
      message: 'Data de fim deve ser igual ou após a data de início',
      path: ['endDate'],
    }
  )

export type TaskFormValues = z.infer<typeof taskSchema>
