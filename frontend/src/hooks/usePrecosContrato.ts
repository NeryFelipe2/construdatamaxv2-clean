/**
 * usePrecosContrato.ts — busca na tabela oficial de preços do contrato
 * (`precos_contrato`, fonte: PREÇOS DO NOSSO CONTRATO-60% DESSE.xlsx).
 *
 * Regra de negócio (do próprio nome do arquivo-fonte): a WCR fatura
 * `fator_wcr` (60%) do valor unitário cheio do contrato. O valor aplicado
 * na medição é sempre o dos 60% — o cheio fica visível só como referência.
 */
import { supabase } from '@/lib/supabase'

export interface PrecoContrato {
  id: string
  ano: string
  codigo: string
  descricao: string
  unidade: string | null
  valor_unitario: number
  fator_wcr: number
  /** valor_unitario × fator_wcr, arredondado a 2 casas — o que a WCR recebe. */
  valor_wcr: number
}

export async function buscarPrecosContrato(termo: string, ano?: string): Promise<PrecoContrato[]> {
  if (!supabase) return []
  const anoBusca = ano ?? String(new Date().getFullYear())
  const t = termo.trim()
  if (t.length < 2) return []

  let query = supabase
    .from('precos_contrato')
    .select('id, ano, codigo, descricao, unidade, valor_unitario, fator_wcr')
    .eq('ano', anoBusca)
    .limit(20)

  // busca por código exato quando o termo é numérico; senão por trecho da descrição
  if (/^\d+$/.test(t)) {
    query = query.like('codigo', `${t}%`)
  } else {
    query = query.ilike('descricao', `%${t}%`)
  }

  const { data, error } = await query
  if (error || !data) return []
  return data.map((r) => ({
    ...r,
    valor_unitario: Number(r.valor_unitario),
    fator_wcr: Number(r.fator_wcr),
    valor_wcr: Math.round(Number(r.valor_unitario) * Number(r.fator_wcr) * 100) / 100,
  }))
}
