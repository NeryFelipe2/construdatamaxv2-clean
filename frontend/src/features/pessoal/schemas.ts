/**
 * schemas.ts — validação zod do módulo Pessoal.
 */
import { z } from 'zod'

const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (aaaa-mm-dd)')

export const pessoaFormSchema = z.object({
  nomeCompleto: z.string().trim().min(3, 'Nome completo obrigatório (mín. 3 letras)').max(120),
  apelido: z.string().max(60).optional(),
  cargoId: z.string().optional(),
  vinculo: z.string().max(20).optional(),
  equipeId: z.string().optional(),
  funcaoNaEquipe: z.string().max(60).optional(),
  dataAdmissao: dataIso.optional().or(z.literal('')),
  vencExperiencia1: dataIso.optional().or(z.literal('')),
  vencExperiencia2: dataIso.optional().or(z.literal('')),
  telefone: z.string().max(30).optional(),
  epiCalca: z.string().max(10).optional(),
  epiCamisa: z.string().max(10).optional(),
  epiBotina: z.string().max(10).optional(),
  observacoes: z.string().max(2000).optional(),
  status: z.enum(['ativo', 'desligado', 'em_contratacao', 'afastado', 'desconhecido']),
})

export type PessoaFormData = z.infer<typeof pessoaFormSchema>

export const cargoFormSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do cargo obrigatório').max(80),
  categoriaRdo: z.enum(['encarregado', 'oficial', 'ajudante', 'operador', 'indireto']),
})

export type CargoFormData = z.infer<typeof cargoFormSchema>

/** Regra do contrato de experiência: admissão + 44 dias / + 89 dias. */
export function calcularExperiencias(dataAdmissaoIso: string): { exp1: string; exp2: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAdmissaoIso)) return null
  const [y, m, d] = dataAdmissaoIso.split('-').map(Number)
  const soma = (dias: number) => {
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + dias)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }
  return { exp1: soma(44), exp2: soma(89) }
}
