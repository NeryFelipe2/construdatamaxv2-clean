/**
 * fcpSupabaseIO.ts — ler um FCP inteiro do banco (as 5 tabelas de entrada), no formato que o
 * motor entende via fcpDoBanco(). Usado pela prévia da importação.
 */
import { supabase } from '@/lib/supabase'
import type { FcpStatus } from '@/hooks/useFcp'
import type { LinhasDoFcp } from './fcpDoBanco'
import type { FcpExistente } from './importacaoCd'

export async function carregarLinhasDoFcp(fcpId: string): Promise<LinhasDoFcp> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const [oPrem, oObras] = await Promise.all([
    supabase.from('fcp_premissas').select('*').eq('fcp_id', fcpId).maybeSingle(),
    supabase.from('fcp_obra').select('*').eq('fcp_id', fcpId).is('deleted_at', null).order('ordem'),
  ])
  if (oPrem.error) throw new Error(oPrem.error.message)
  if (oObras.error) throw new Error(oObras.error.message)
  const obras = (oObras.data ?? []) as LinhasDoFcp['obras']
  const ids = obras.map((o) => o.id)
  if (ids.length === 0) return { premissas: oPrem.data as LinhasDoFcp['premissas'], obras, pessoas: [], gerais: [], realizados: [] }

  const [oPes, oGer, oRz] = await Promise.all([
    supabase.from('fcp_custo_pessoa').select('*').in('fcp_obra_id', ids).is('deleted_at', null),
    supabase.from('fcp_custo_geral').select('*').in('fcp_obra_id', ids).is('deleted_at', null),
    supabase.from('fcp_realizado').select('*').in('fcp_obra_id', ids).is('deleted_at', null),
  ])
  for (const o of [oPes, oGer, oRz]) if (o.error) throw new Error(o.error.message)
  return {
    premissas: oPrem.data as LinhasDoFcp['premissas'],
    obras,
    pessoas: (oPes.data ?? []) as LinhasDoFcp['pessoas'],
    gerais: (oGer.data ?? []) as LinhasDoFcp['gerais'],
    realizados: (oRz.data ?? []) as LinhasDoFcp['realizados'],
  }
}

/** O FCP da semana (um por semana na organização), com as linhas — ou null. */
export async function carregarFcpDaSemana(semanaRef: string): Promise<FcpExistente | null> {
  if (!supabase || !semanaRef) return null
  const { data, error } = await supabase.from('fcp').select('id, nome, status')
    .eq('semana_ref', semanaRef).is('deleted_at', null).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const doc = data as { id: string; nome: string; status: FcpStatus }
  return { id: doc.id, nome: doc.nome, status: doc.status, linhas: await carregarLinhasDoFcp(doc.id) }
}
