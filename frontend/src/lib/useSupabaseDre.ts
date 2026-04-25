import { useState, useEffect } from 'react'
import { apiProjetoFinanceiro, type CanonicalIntegrationStatus } from './api'
import { supabase } from './supabase'

interface DreLancamento {
  id: string
  project_id: string
  data: string
  categoria: string
  descricao: string
  valor: number
  tipo: string
  criado_por: string | null
}

interface DreTrechoCusto {
  id: string
  project_id: string
  trecho: string
  extensao: number | null
  dn: number | null
  profundidade: number | null
  custo_unitario: number | null
  custo_total: number | null
  status: string | null
  variacao: number | null
}

function mapLancamento(row: Record<string, unknown>, projectId: string): DreLancamento {
  return {
    id: String(row.id ?? `fin-${Date.now()}`),
    project_id: String(row.project_id ?? row.projeto_id ?? projectId),
    data: String(row.data ?? new Date().toISOString().slice(0, 10)),
    categoria: String(row.categoria ?? 'Sem categoria'),
    descricao: String(row.descricao ?? row.titulo ?? 'Lancamento'),
    valor: Number(row.valor ?? 0),
    tipo: String(row.tipo ?? 'DESPESA'),
    criado_por: row.criado_por ? String(row.criado_por) : null,
  }
}

function mapTrecho(row: Record<string, unknown>, projectId: string): DreTrechoCusto {
  return {
    id: String(row.id ?? `trecho-${Date.now()}`),
    project_id: String(row.project_id ?? row.projeto_id ?? projectId),
    trecho: String(row.trecho ?? row.nome ?? 'Trecho'),
    extensao: row.extensao != null ? Number(row.extensao) : null,
    dn: row.dn != null ? Number(row.dn) : null,
    profundidade: row.profundidade != null ? Number(row.profundidade) : null,
    custo_unitario: row.custo_unitario != null ? Number(row.custo_unitario) : null,
    custo_total: row.custo_total != null ? Number(row.custo_total) : row.valor_total != null ? Number(row.valor_total) : null,
    status: row.status ? String(row.status) : null,
    variacao: row.variacao != null ? Number(row.variacao) : null,
  }
}

export function useSupabaseDre(projectId: string | null) {
  const [lancamentos, setLancamentos] = useState<DreLancamento[]>([])
  const [trechos, setTrechos] = useState<DreTrechoCusto[]>([])
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<CanonicalIntegrationStatus>('local')

  const carregarDados = async () => {
    if (!projectId) {
      setLancamentos([])
      setTrechos([])
      setConnectionStatus('local')
      return
    }

    setLoading(true)
    try {
      const payload = await apiProjetoFinanceiro(projectId)
      setLancamentos((payload.lancamentos ?? []).map((row) => mapLancamento(row, projectId)))
      setTrechos((payload.trechos ?? []).map((row) => mapTrecho(row, projectId)))
      setConnectionStatus(payload.status ?? 'connected')
      return
    } catch {
      // fallback below
    }

    if (!supabase) {
      setLancamentos([])
      setTrechos([])
      setConnectionStatus('local')
      setLoading(false)
      return
    }

    try {
      const [resLanc, resTrechos] = await Promise.all([
        supabase
          .from('lancamentos_financeiros')
          .select('*')
          .eq('project_id', projectId)
          .order('data', { ascending: false }),
        supabase.from('trechos_custo').select('*').eq('project_id', projectId),
      ])
      setLancamentos(((resLanc.data || []) as Record<string, unknown>[]).map((row) => mapLancamento(row, projectId)))
      setTrechos(((resTrechos.data || []) as Record<string, unknown>[]).map((row) => mapTrecho(row, projectId)))
      setConnectionStatus('partial')
    } catch (e) {
      console.error(e)
      setConnectionStatus('local')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregarDados()
    const t = window.setInterval(() => {
      void carregarDados()
    }, 30000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  return { lancamentos, trechos, loading, connectionStatus, refresh: carregarDados }
}
