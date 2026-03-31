import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const equipamentoSchema = z.object({
  code:            z.string().min(2, 'Código deve ter ao menos 2 caracteres').max(20),
  name:            z.string().min(2, 'Nome obrigatório').max(100),
  type:            z.string().min(1, 'Tipo obrigatório').max(50),
  brand:           z.string().min(1, 'Marca obrigatória').max(50),
  model:           z.string().min(1, 'Modelo obrigatório').max(50),
  year:            z.number().int().min(1990, 'Ano inválido').max(2030, 'Ano inválido'),
  serialNumber:    z.string().min(1, 'Nº de série obrigatório').max(50),
  status:          z.enum(['active', 'idle', 'maintenance', 'alert', 'offline'] as const),
  description:     z.string().max(500).optional(),
  maxLoad:         z.string().max(50).optional(),
  lastMaintenance: z.string().regex(DATE_REGEX, 'Data inválida (yyyy-mm-dd)'),
  nextMaintenance: z.string().regex(DATE_REGEX, 'Data inválida (yyyy-mm-dd)'),
  operator:        z.string().max(100).optional(),
  engineHours:     z.number().min(0, 'Deve ser positivo'),
  // lat/lng stored as strings in the form, validated here, parsed in onSubmit
  lat:  z.string().optional().refine(
    (v) => !v || (!isNaN(Number(v)) && Number(v) >= -90  && Number(v) <= 90),
    'Latitude inválida (entre -90 e 90)'
  ),
  lng:  z.string().optional().refine(
    (v) => !v || (!isNaN(Number(v)) && Number(v) >= -180 && Number(v) <= 180),
    'Longitude inválida (entre -180 e 180)'
  ),
  siteName: z.string().max(100).optional(),
})

export type EquipamentoFormValues = z.infer<typeof equipamentoSchema>
