/**
 * useOpCrud.ts — criar / editar / excluir genérico das tabelas op_*.
 *
 * Excluir é SOFT DELETE (deleted_at): o registro some da tela, fica no banco e no
 * audit_log, e a reimportação da planilha não o traz de volta.
 * org_id nunca é enviado: o trigger op_org_do_projeto preenche pelo projeto.
 */
import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface UseOpCrud {
  salvando: boolean
  erro: string | null
  limparErro: () => void
  criar: (tabela: string, linha: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  atualizar: (tabela: string, pk: string, id: string, patch: Record<string, unknown>) => Promise<boolean>
  excluir: (tabela: string, pk: string, id: string) => Promise<boolean>
}

function mensagem(e: { message?: string; code?: string } | null): string {
  if (!e) return 'erro desconhecido'
  if (e.code === '23505') return 'já existe um registro com essa identidade (código, data ou chave repetidos)'
  if (e.code === '42501') return 'sem permissão para gravar nesta obra'
  return e.message ?? 'erro ao gravar'
}

export function useOpCrud(): UseOpCrud {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const criar = useCallback(async (tabela: string, linha: Record<string, unknown>) => {
    if (!supabase) { setErro('Supabase não configurado'); return null }
    setSalvando(true); setErro(null)
    try {
      const { data, error } = await supabase.from(tabela).insert({ origem: 'manual', ...linha }).select().single()
      if (error) { setErro(mensagem(error)); return null }
      return data as Record<string, unknown>
    } finally { setSalvando(false) }
  }, [])

  const atualizar = useCallback(async (tabela: string, pk: string, id: string, patch: Record<string, unknown>) => {
    if (!supabase) { setErro('Supabase não configurado'); return false }
    setSalvando(true); setErro(null)
    try {
      const { error } = await supabase.from(tabela).update(patch).eq(pk, id)
      if (error) { setErro(mensagem(error)); return false }
      return true
    } finally { setSalvando(false) }
  }, [])

  const excluir = useCallback(async (tabela: string, pk: string, id: string) => {
    if (!supabase) { setErro('Supabase não configurado'); return false }
    setSalvando(true); setErro(null)
    try {
      // timestamptz = instante; toISOString é correto aqui (não é data civil)
      const { error } = await supabase.from(tabela).update({ deleted_at: new Date().toISOString() }).eq(pk, id)
      if (error) { setErro(mensagem(error)); return false }
      return true
    } finally { setSalvando(false) }
  }, [])

  return { salvando, erro, limparErro: () => setErro(null), criar, atualizar, excluir }
}
