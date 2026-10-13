/**
 * schemas.ts — Zod validation schemas for the RDO module.
 */
import { z } from 'zod'

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (yyyy-MM-dd)')
const nonNeg     = z.number().min(0, 'Não pode ser negativo')
const pos        = z.number().positive('Deve ser positivo')

export const rdoEquipmentSchema = z.object({
  name:     z.string().min(1, 'Nome obrigatório').max(100),
  quantity: nonNeg.int('Deve ser inteiro').max(99),
  hours:    nonNeg.max(24, 'Máx. 24h por dia'),
})

export const rdoServiceSchema = z.object({
  description: z.string().min(1, 'Descrição obrigatória').max(200),
  quantity:    pos.max(99999),
  unit:        z.string().min(1, 'Unidade obrigatória').max(20),
})

export const rdoTrechoSchema = z.object({
  trechoCode:        z.string().min(1, 'Código obrigatório').max(20),
  trechoDescription: z.string().max(200),
  plannedMeters:     nonNeg.max(99999),
  executedMeters:    nonNeg.max(99999),
  system:            z.enum(['agua', 'esgoto', 'drenagem', 'estrutura', 'pavimentacao', 'outro']).optional(),
})

/**
 * Presença NOMINAL no RDO (linha da lista da seção Mão de Obra).
 * Espelha rdo_presenca (migration 020): pessoaId null = avulso sem cadastro;
 * desmarcado (presente=false) exige motivoAusencia — validado no refine.
 */
export const rdoPresencaSchema = z.object({
  pessoaId:      z.string().nullable(),
  nome:          z.string().min(1),
  equipeId:      z.string().nullable(),
  funcao:        z.string().nullable(),
  presente:      z.boolean(),
  motivoAusencia: z.string().nullable(),
  horasNormais:  z.number().min(0).max(24),
  horasExtras:   z.number().min(0).max(12),
})

export const rdoSchema = z.object({
  date:        dateString,
  responsible: z.string().min(1, 'Responsável obrigatório').max(100),
  weather: z.object({
    morning:      z.enum(['good', 'rain', 'cloudy', 'storm']),
    afternoon:    z.enum(['good', 'rain', 'cloudy', 'storm']),
    night:        z.enum(['good', 'rain', 'cloudy', 'storm']),
    temperatureC: z.number().min(-20).max(60),
  }),
  manpower: z.object({
    foremanCount:  nonNeg.int().max(50),
    officialCount: nonNeg.int().max(200),
    helperCount:   nonNeg.int().max(200),
    operatorCount: nonNeg.int().max(50),
  }),
  observations: z.string().max(2000),
  incidents:    z.string().max(2000),
  // aditivo: lista nominal de presença (opcional — RDO antigo continua válido)
  presencas: z.array(rdoPresencaSchema).optional(),
})

export const rdoFinancialEntrySchema = z.object({
  date:        dateString,
  category:    z.string().min(1, 'Categoria obrigatória').max(80),
  description: z.string().min(1, 'Descrição obrigatória').max(200),
  valueBRL:    pos.max(999999999),
  type:        z.enum(['expense', 'revenue']),
})

export type RdoFormData            = z.infer<typeof rdoSchema>
export type RdoFinancialEntryData  = z.infer<typeof rdoFinancialEntrySchema>
export type RdoPresencaData        = z.infer<typeof rdoPresencaSchema>
