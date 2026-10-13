/**
 * useCampoWhatsapp — leitura + check das 3 tabelas extraídas do WhatsApp de campo:
 *  - ocorrencias_obra: ocorrências (vazamento, embargo, falta de material/EPI...).
 *  - cadastro_ligacoes: cadastro casa-a-casa (morador, status, hidrômetros).
 *  - bota_fora_viagens: viagens de bota-fora (quantidade, valor, fornecedor).
 * Padrão de hook: useState/useCallback/useEffect, update otimista + revert
 * em caso de erro (mesmo padrão de useLigacoesOs.ts).
 *
 * IMPORTANTE: NÃO filtra por projeto_id — existem linhas com projeto_id null
 * (ex.: núcleo São Cleto). Carrega tudo e a página filtra em memória.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface OcorrenciaObra {
  id: string
  projeto_id: string | null
  nucleo: string | null
  rua: string | null
  /** ISO YYYY-MM-DD */
  data: string | null
  tipo: string | null
  descricao: string | null
  reportado_por: string | null
  resolvida: boolean
  resolvido_em: string | null
  origem: string | null
  origem_fonte: string | null
  updated_at: string
}

export interface CadastroLigacao {
  id: string
  projeto_id: string | null
  nucleo: string | null
  rua: string | null
  numero_casa: string | null
  nome_morador: string | null
  status: string | null
  tipo: string | null
  hidrometros_qtd: number | null
  /** ISO YYYY-MM-DD */
  data: string | null
  resolvida: boolean
  resolvido_em: string | null
  origem: string | null
  origem_fonte: string | null
  obs: string | null
  updated_at: string
}

export interface BotaForaViagem {
  id: string
  projeto_id: string | null
  /** ISO YYYY-MM-DD */
  data: string | null
  quantidade_viagens: number | null
  valor: number | null
  fornecedor: string | null
  descricao: string | null
  origem: string | null
  origem_fonte: string | null
  obs: string | null
  updated_at: string
}

export function useCampoWhatsapp() {
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaObra[]>([])
  const [cadastros, setCadastros] = useState<CadastroLigacao[]>([])
  const [viagens, setViagens] = useState<BotaForaViagem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) { setOcorrencias([]); setCadastros([]); setViagens([]); return }
    setLoading(true)
    setError(null)
    try {
      const [ocorRes, cadRes, botaRes] = await Promise.all([
        supabase
          .from('ocorrencias_obra')
          .select('id, projeto_id, nucleo, rua, data, tipo, descricao, reportado_por, resolvida, resolvido_em, origem, origem_fonte, updated_at')
          .order('data', { ascending: false, nullsFirst: false }),
        supabase
          .from('cadastro_ligacoes')
          .select('id, projeto_id, nucleo, rua, numero_casa, nome_morador, status, tipo, hidrometros_qtd, data, resolvida, resolvido_em, origem, origem_fonte, obs, updated_at')
          .order('data', { ascending: false, nullsFirst: false }),
        supabase
          .from('bota_fora_viagens')
          .select('id, projeto_id, data, quantidade_viagens, valor, fornecedor, descricao, origem, origem_fonte, obs, updated_at')
          .order('data', { ascending: false, nullsFirst: false }),
      ])
      if (ocorRes.error) throw ocorRes.error
      if (cadRes.error) throw cadRes.error
      if (botaRes.error) throw botaRes.error
      setOcorrencias((ocorRes.data ?? []) as OcorrenciaObra[])
      setCadastros((cadRes.data ?? []) as CadastroLigacao[])
      setViagens((botaRes.data ?? []) as BotaForaViagem[])
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar dados do Campo WhatsApp')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /** Cria uma ocorrência manualmente (ex.: lançada pela tela Punch List) — otimista + revert. */
  const criarOcorrencia = useCallback(async (input: {
    descricao: string
    tipo: string
    nucleo: string | null
    rua: string | null
    reportado_por: string | null
    projeto_id: string | null
  }): Promise<boolean> => {
    const hoje = new Date().toISOString().slice(0, 10)
    const nova: OcorrenciaObra = {
      id: crypto.randomUUID(),
      projeto_id: input.projeto_id,
      nucleo: input.nucleo,
      rua: input.rua,
      data: hoje,
      tipo: input.tipo,
      descricao: input.descricao,
      reportado_por: input.reportado_por,
      resolvida: false,
      resolvido_em: null,
      origem: 'manual',
      origem_fonte: 'Lançada manualmente (Punch List)',
      updated_at: new Date().toISOString(),
    }
    setOcorrencias((prev) => [nova, ...prev])
    if (!supabase) return true
    try {
      const { error: e1 } = await supabase.from('ocorrencias_obra').insert({
        id: nova.id,
        projeto_id: nova.projeto_id,
        nucleo: nova.nucleo,
        rua: nova.rua,
        data: nova.data,
        tipo: nova.tipo,
        descricao: nova.descricao,
        reportado_por: nova.reportado_por,
        resolvida: false,
        origem: nova.origem,
        origem_fonte: nova.origem_fonte,
      })
      if (e1) throw e1
      return true
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao criar ocorrência')
      load() // reverte via reload
      return false
    }
  }, [load])

  /** Marca/desmarca uma ocorrência como resolvida (update otimista + revert). */
  const marcarOcorrencia = useCallback(async (id: string, resolvida: boolean) => {
    if (!supabase) return
    const resolvidoEm = resolvida ? new Date().toISOString() : null
    const prevState = ocorrencias
    setOcorrencias((prev) => prev.map((o) => (o.id === id ? { ...o, resolvida, resolvido_em: resolvidoEm } : o)))
    try {
      const { error: e1 } = await supabase
        .from('ocorrencias_obra')
        .update({ resolvida, resolvido_em: resolvidoEm, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (e1) throw e1
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao atualizar ocorrência')
      setOcorrencias(prevState) // reverte
    }
  }, [ocorrencias])

  /** Marca/desmarca uma casa do cadastro como resolvida (update otimista + revert). */
  const marcarCadastro = useCallback(async (id: string, resolvida: boolean) => {
    if (!supabase) return
    const resolvidoEm = resolvida ? new Date().toISOString() : null
    const prevState = cadastros
    setCadastros((prev) => prev.map((c) => (c.id === id ? { ...c, resolvida, resolvido_em: resolvidoEm } : c)))
    try {
      const { error: e1 } = await supabase
        .from('cadastro_ligacoes')
        .update({ resolvida, resolvido_em: resolvidoEm, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (e1) throw e1
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao atualizar cadastro de ligação')
      setCadastros(prevState) // reverte
    }
  }, [cadastros])

  return {
    ocorrencias,
    cadastros,
    viagens,
    loading,
    error,
    reload: load,
    marcarOcorrencia,
    marcarCadastro,
    criarOcorrencia,
  }
}
