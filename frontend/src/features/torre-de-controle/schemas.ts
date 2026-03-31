import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const CEP_REGEX  = /^\d{5}-?\d{3}$/

export const siteSchema = z.object({
  code:        z.string().min(2, 'Código deve ter ao menos 2 caracteres').max(20),
  name:        z.string().min(2, 'Nome obrigatório').max(100),
  company:     z.string().min(1, 'Empresa obrigatória').max(100),
  owner:       z.string().min(1, 'Dono obrigatório').max(100),
  manager:     z.string().min(1, 'Gerente obrigatório').max(100),
  description: z.string().max(1000).optional(),
  status:      z.enum(['active', 'planning', 'paused', 'completed'] as const),
  street:      z.string().min(1, 'Rua obrigatória').max(200),
  number:      z.string().min(1, 'Número obrigatório').max(20),
  district:    z.string().min(1, 'Bairro obrigatório').max(100),
  city:        z.string().min(1, 'Cidade obrigatória').max(100),
  state:       z.string().length(2, 'Use a sigla do estado (ex: SP)'),
  cep:         z.string().regex(CEP_REGEX, 'CEP inválido (ex: 01310-200)'),
  buildingType: z.string().min(1, 'Tipo obrigatório').max(50),
  totalArea:   z.number().min(1, 'Área deve ser maior que 0'),
  floors:      z.number().int().min(1, 'Mínimo 1 andar'),
  startDate:   z.string().regex(DATE_REGEX, 'Data inválida (yyyy-mm-dd)'),
  expectedEnd: z.string().regex(DATE_REGEX, 'Data inválida (yyyy-mm-dd)'),
  lat: z.string().optional().refine(
    (v) => !v || (!isNaN(Number(v)) && Number(v) >= -90  && Number(v) <= 90),
    'Latitude inválida (entre -90 e 90)'
  ),
  lng: z.string().optional().refine(
    (v) => !v || (!isNaN(Number(v)) && Number(v) >= -180 && Number(v) <= 180),
    'Longitude inválida (entre -180 e 180)'
  ),
})

export type SiteFormValues = z.infer<typeof siteSchema>

export const riskSchema = z.object({
  title:       z.string().min(2, 'Título deve ter ao menos 2 caracteres').max(100),
  description: z.string().min(1, 'Descrição obrigatória').max(500),
  level:       z.enum(['critical', 'high', 'medium', 'low'] as const),
  status:      z.enum(['identified', 'active', 'mitigated', 'resolved'] as const),
  notes:       z.string().max(500).optional(),
})

export type RiskFormValues = z.infer<typeof riskSchema>
