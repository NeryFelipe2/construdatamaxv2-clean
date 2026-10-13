/**
 * useFolhaAgregada.ts — soma e contagem dos salários dos membros ATIVOS da obra.
 *
 * Chama a RPC op_folha_agregada (migration 035, SECURITY DEFINER): quem é membro da
 * empresa vê o CUSTO da folha sem nunca receber o salário de uma pessoa.
 * Indisponível (migration não aplicada, sem acesso) → `folha = null` e o motivo em
 * `indisponivel`; o cálculo de custo mostra "não calculável", nunca inventa zero.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FolhaAgregada } from '@/features/controle-operacional/dominio/tipos'

export interface UseFolhaAgregada {
  folha: FolhaAgregada | null
  indisponivel: string | null
  loading: boolean
  recarregar: () => Promise<void>
}

export function useFolhaAgregada(projetoId: string | null): UseFolhaAgregada {
  const [folha, setFolha] = useState<FolhaAgregada | null>(null)
  const [indisponivel, setIndisponivel] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const recarregar = useCallback(async () => {
    setFolha(null)
    if (!projetoId) return
    if (!supabase) { setIndisponivel('Supabase não configurado'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('op_folha_agregada', { p_projeto: projetoId })
      if (error) {
        const c = error.code ?? ''
        setIndisponivel(
          c === 'PGRST202' || c === '42883' ? 'função op_folha_agregada não existe — migration 035 não aplicada'
            : c === '42501' ? 'sem acesso à folha desta obra'
              : error.message,
        )
        return
      }
      const linha = (Array.isArray(data) ? data[0] : data) as { n_com_salario?: unknown; soma_salario?: unknown } | undefined
      setFolha({ n_com_salario: Number(linha?.n_com_salario ?? 0), soma_salario: Number(linha?.soma_salario ?? 0) })
      setIndisponivel(null)
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { void recarregar() }, [recarregar])

  return { folha, indisponivel, loading, recarregar }
}
