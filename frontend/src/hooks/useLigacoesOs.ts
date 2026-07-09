/**
 * useLigacoesOs — CRUD das duas tabelas da missão E5 (Levantamento de Ligações - OS SISTEMA):
 *  - ligacoes_os_mes: matriz núcleo × mês de OS baixadas (LA/LE) vs ligações cadastradas.
 *  - ligacoes_pendencias: lista de pendências por endereço com motivo.
 * Padrão de hook: useState/useCallback/useEffect, update otimista + revert via reload
 * em caso de erro (mesmo padrão de useSupabaseNsPlanejamento.ts / useFluxoProjecao.ts).
 *
 * IMPORTANTE (LGPD): estas tabelas NUNCA guardam nome/CPF/RG de morador — só contagens
 * (LA/LE/cadastradas) e pendências por endereço com motivo. A blindagem de importação
 * fica em utils/parseCsvLigacoes.ts.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface LigacaoOsMes {
  id: string
  projeto_id: string
  nucleo: string | null
  /** ISO YYYY-MM-DD, sempre dia 01 do mês. */
  mes: string
  la: number
  le: number
  cadastradas: number
  updated_at: string
}

export interface LigacaoPendencia {
  id: string
  projeto_id: string
  nucleo: string | null
  endereco: string
  la: number
  le: number
  tipo: string | null
  motivo: string | null
  resolvida: boolean
  updated_at: string
}

export interface NovaLinhaMatriz {
  nucleo: string
  mes: string // 'YYYY-MM' ou 'YYYY-MM-DD'
  la: number
  le: number
  cadastradas: number
}

export interface NovaPendencia {
  nucleo: string
  endereco: string
  la: number
  le: number
  tipo: string
  motivo: string
}

function normalizaMes(raw: string): string {
  const m = String(raw ?? '').match(/^(\d{4})-(\d{1,2})/)
  if (!m) return raw
  return `${m[1]}-${String(+m[2]).padStart(2, '0')}-01`
}

export function useLigacoesOs(projetoId: string | null) {
  const [matriz, setMatriz] = useState<LigacaoOsMes[]>([])
  const [pendencias, setPendencias] = useState<LigacaoPendencia[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) { setMatriz([]); setPendencias([]); return }
    setLoading(true)
    setError(null)
    try {
      const [matrizRes, pendRes] = await Promise.all([
        supabase
          .from('ligacoes_os_mes')
          .select('id, projeto_id, nucleo, mes, la, le, cadastradas, updated_at')
          .eq('projeto_id', projetoId)
          .order('mes', { ascending: true }),
        supabase
          .from('ligacoes_pendencias')
          .select('id, projeto_id, nucleo, endereco, la, le, tipo, motivo, resolvida, updated_at')
          .eq('projeto_id', projetoId)
          .order('updated_at', { ascending: false }),
      ])
      if (matrizRes.error) throw matrizRes.error
      if (pendRes.error) throw pendRes.error
      setMatriz((matrizRes.data ?? []) as LigacaoOsMes[])
      setPendencias((pendRes.data ?? []) as LigacaoPendencia[])
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar Ligações & OS')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { load() }, [load])

  // ── Matriz núcleo × mês ──

  const salvarLinhaMatriz = useCallback(async (linha: NovaLinhaMatriz) => {
    if (!supabase || !projetoId) return
    const mesIso = normalizaMes(linha.mes)
    const otimista: LigacaoOsMes = {
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      nucleo: linha.nucleo || null,
      mes: mesIso,
      la: linha.la,
      le: linha.le,
      cadastradas: linha.cadastradas,
      updated_at: new Date().toISOString(),
    }
    setMatriz((prev) => [...prev, otimista].sort((a, b) => a.mes.localeCompare(b.mes)))
    try {
      const { error: e1 } = await supabase.from('ligacoes_os_mes').insert({
        id: otimista.id,
        projeto_id: projetoId,
        nucleo: otimista.nucleo,
        mes: mesIso,
        la: otimista.la,
        le: otimista.le,
        cadastradas: otimista.cadastradas,
      })
      if (e1) throw e1
      load()
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao salvar linha da matriz')
      load() // reverte via reload em caso de erro
    }
  }, [projetoId, load])

  const atualizarLinhaMatriz = useCallback(async (id: string, patch: Partial<Pick<LigacaoOsMes, 'nucleo' | 'mes' | 'la' | 'le' | 'cadastradas'>>) => {
    if (!supabase) return
    const prevState = matriz
    setMatriz((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch, mes: patch.mes ? normalizaMes(patch.mes) : m.mes } : m)))
    try {
      const dbPatch: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() }
      if (patch.mes) dbPatch.mes = normalizaMes(patch.mes)
      const { error: e1 } = await supabase.from('ligacoes_os_mes').update(dbPatch).eq('id', id)
      if (e1) throw e1
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao atualizar linha da matriz')
      setMatriz(prevState) // reverte
    }
  }, [matriz])

  const excluirLinhaMatriz = useCallback(async (id: string) => {
    if (!supabase) return
    const prevState = matriz
    setMatriz((prev) => prev.filter((m) => m.id !== id))
    try {
      const { error: e1 } = await supabase.from('ligacoes_os_mes').delete().eq('id', id)
      if (e1) throw e1
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao excluir linha da matriz')
      setMatriz(prevState) // reverte
    }
  }, [matriz])

  const importarMatrizCsv = useCallback(async (linhas: NovaLinhaMatriz[]) => {
    if (!supabase || !projetoId || linhas.length === 0) return 0
    const payload = linhas.map((l) => ({
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      nucleo: l.nucleo || null,
      mes: normalizaMes(l.mes),
      la: l.la,
      le: l.le,
      cadastradas: l.cadastradas,
    }))
    const { error: e1 } = await supabase.from('ligacoes_os_mes').insert(payload)
    if (e1) { setError(e1.message); return 0 }
    await load()
    return payload.length
  }, [projetoId, load])

  // ── Pendências ──

  const adicionarPendencia = useCallback(async (p: NovaPendencia) => {
    if (!supabase || !projetoId) return
    const otimista: LigacaoPendencia = {
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      nucleo: p.nucleo || null,
      endereco: p.endereco,
      la: p.la,
      le: p.le,
      tipo: p.tipo || null,
      motivo: p.motivo || null,
      resolvida: false,
      updated_at: new Date().toISOString(),
    }
    setPendencias((prev) => [otimista, ...prev])
    try {
      const { error: e1 } = await supabase.from('ligacoes_pendencias').insert({
        id: otimista.id,
        projeto_id: projetoId,
        nucleo: otimista.nucleo,
        endereco: otimista.endereco,
        la: otimista.la,
        le: otimista.le,
        tipo: otimista.tipo,
        motivo: otimista.motivo,
        resolvida: false,
      })
      if (e1) throw e1
      load()
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao salvar pendência')
      load() // reverte via reload em caso de erro
    }
  }, [projetoId, load])

  const toggleResolvida = useCallback(async (id: string) => {
    if (!supabase) return
    const alvo = pendencias.find((p) => p.id === id)
    if (!alvo) return
    const novoValor = !alvo.resolvida
    setPendencias((prev) => prev.map((p) => (p.id === id ? { ...p, resolvida: novoValor } : p)))
    try {
      const { error: e1 } = await supabase
        .from('ligacoes_pendencias')
        .update({ resolvida: novoValor, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (e1) throw e1
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao atualizar pendência')
      setPendencias((prev) => prev.map((p) => (p.id === id ? { ...p, resolvida: alvo.resolvida } : p))) // reverte
    }
  }, [pendencias])

  const excluirPendencia = useCallback(async (id: string) => {
    if (!supabase) return
    const prevState = pendencias
    setPendencias((prev) => prev.filter((p) => p.id !== id))
    try {
      const { error: e1 } = await supabase.from('ligacoes_pendencias').delete().eq('id', id)
      if (e1) throw e1
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao excluir pendência')
      setPendencias(prevState) // reverte
    }
  }, [pendencias])

  const importarPendenciasCsv = useCallback(async (linhas: NovaPendencia[]) => {
    if (!supabase || !projetoId || linhas.length === 0) return 0
    const payload = linhas.map((p) => ({
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      nucleo: p.nucleo || null,
      endereco: p.endereco,
      la: p.la,
      le: p.le,
      tipo: p.tipo || null,
      motivo: p.motivo || null,
      resolvida: false,
    }))
    const { error: e1 } = await supabase.from('ligacoes_pendencias').insert(payload)
    if (e1) { setError(e1.message); return 0 }
    await load()
    return payload.length
  }, [projetoId, load])

  return {
    matriz,
    pendencias,
    loading,
    error,
    reload: load,
    salvarLinhaMatriz,
    atualizarLinhaMatriz,
    excluirLinhaMatriz,
    importarMatrizCsv,
    adicionarPendencia,
    toggleResolvida,
    excluirPendencia,
    importarPendenciasCsv,
  }
}
