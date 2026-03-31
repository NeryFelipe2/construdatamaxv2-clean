import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const workOrderSchema = z.object({
  equipmentId:   z.string().min(1, 'Selecione um equipamento'),
  type:          z.enum(['preventive', 'corrective', 'predictive'] as const),
  description:   z.string().min(5, 'Mínimo 5 caracteres').max(300, 'Máximo 300 caracteres'),
  scheduledDate: z.string().regex(DATE_REGEX, 'Data inválida (yyyy-mm-dd)'),
  responsible:   z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
  estimatedCost: z.number().min(0, 'Deve ser ≥ 0'),
  notes:         z.string().max(500, 'Máximo 500 caracteres').optional(),
})

export type WorkOrderFormValues = z.infer<typeof workOrderSchema>
