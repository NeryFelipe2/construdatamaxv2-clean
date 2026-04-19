import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Tipo mínimo para lançamento financeiro (camada DRE)
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

export function useSupabaseDre(projectId: string) {
  const [lancamentos, setLancamentos] = useState<DreLancamento[]>([])
  const [trechos, setTrechos] = useState<DreTrechoCusto[]>([])
  const [loading, setLoading] = useState(false)

  const carregarDados = async () => {
    if (!projectId || !supabase) return
    setLoading(true)
    try {
      const [resLanc, resTrechos] = await Promise.all([
        supabase
          .from('lancamentos_financeiros')
          .select('*')
          .eq('project_id', projectId)
          .order('data', { ascending: false }),
        supabase.from('trechos_custo').select('*').eq('project_id', projectId),
      ])
      if (resLanc.data) setLancamentos(resLanc.data as DreLancamento[])
      if (resTrechos.data) setTrechos(resTrechos.data as DreTrechoCusto[])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
    // auto-refresh a cada 30s para pegar novos custos vindos do WhatsApp
    const t = setInterval(carregarDados, 30000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  return { lancamentos, trechos, loading, refresh: carregarDados }
}
