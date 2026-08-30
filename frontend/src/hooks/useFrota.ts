/**
 * Fonte canônica da frota WCR (veículos/equipamentos alugados), agora editável
 * no Supabase (`wcr_veiculos`), com cache gracioso em localStorage e fallback
 * final na constante estática `WCR_FROTA` (nunca fica vazio).
 *
 * O estado do Kanban (coluna arrastada) NÃO vive aqui — continua em
 * `frotaKanbanStore` (que agora chama `setDefinicoes` quando este hook
 * resolve, igual ao padrão já usado em `useEquipes`/`equipesKanbanStore`).
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WCR_FROTA, type FrotaItem, type FrotaStatus } from '@/data/wcrFrota'

const CACHE_KEY = 'wcr-frota-cache'

function slugId(tipo: string): string {
  const base = tipo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base || 'veiculo'}-${suffix}`
}

function readCache(): FrotaItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

function writeCache(itens: FrotaItem[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(itens))
  } catch {
    // cache é só um bônus
  }
}

interface DbWcrVeiculo {
  id: string
  placa: string | null
  tipo: string
  locador: string
  motorista: string | null
  custo_mensal: number
  custo_original: number | null
  status: FrotaStatus
  equipe_id: string | null
  obs: string | null
  ordem: number
  ativo: boolean
}

function montarFrota(veiculosDb: DbWcrVeiculo[]): FrotaItem[] {
  return veiculosDb
    .filter((v) => v.ativo)
    .sort((a, b) => a.ordem - b.ordem)
    .map((v) => ({
      id: v.id,
      placa: v.placa ?? '—',
      tipo: v.tipo,
      locador: v.locador,
      motorista: v.motorista ?? '—',
      custoMensal: Number(v.custo_mensal),
      custoOriginal: v.custo_original !== null ? Number(v.custo_original) : undefined,
      status: v.status,
      equipe: v.equipe_id ?? '—',
      obs: v.obs ?? '',
    }))
}

export interface NovoVeiculoInput {
  placa?: string
  tipo: string
  locador: string
  motorista?: string
  custoMensal?: number
  obs?: string
}

export function useFrota() {
  const [frota, setFrota] = useState<FrotaItem[]>(() => readCache() ?? WCR_FROTA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('wcr_veiculos')
        .select('id, placa, tipo, locador, motorista, custo_mensal, custo_original, status, equipe_id, obs, ordem, ativo')
        .order('ordem')
      if (e1) throw e1

      if (!data || data.length === 0) {
        // banco vazio: mantém o que já está (cache ou fallback estático) — nunca esvazia a tela
        return
      }

      const montado = montarFrota(data as DbWcrVeiculo[])
      setFrota(montado)
      writeCache(montado)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar frota do Supabase')
      // cai no cache/fallback já carregado no estado inicial — fallback gracioso
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const criarVeiculo = useCallback(
    async (input: NovoVeiculoInput): Promise<string> => {
      const id = slugId(input.tipo)
      const novoItem: FrotaItem = {
        id,
        placa: input.placa ?? '—',
        tipo: input.tipo,
        locador: input.locador,
        motorista: input.motorista ?? '—',
        custoMensal: input.custoMensal ?? 0,
        status: 'operacao',
        equipe: '—',
        obs: input.obs ?? '',
      }
      setFrota((prev) => {
        const next = [...prev, novoItem]
        writeCache(next)
        return next
      })
      if (!supabase) return id
      try {
        const ordem = frota.length
        const { error: e1 } = await supabase.from('wcr_veiculos').insert({
          id,
          placa: input.placa ?? null,
          tipo: input.tipo,
          locador: input.locador,
          motorista: input.motorista ?? null,
          custo_mensal: input.custoMensal ?? 0,
          status: 'operacao',
          obs: input.obs ?? null,
          ordem,
          ativo: true,
        })
        if (e1) throw e1
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao criar veículo')
        await load()
      }
      return id
    },
    [frota.length, load],
  )

  const atualizarVeiculo = useCallback(
    async (
      id: string,
      patch: Partial<Pick<FrotaItem, 'placa' | 'tipo' | 'locador' | 'motorista' | 'custoMensal' | 'status' | 'obs'>>,
    ) => {
      setFrota((prev) => {
        const next = prev.map((v) => (v.id === id ? { ...v, ...patch } : v))
        writeCache(next)
        return next
      })
      if (!supabase) return
      try {
        const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (patch.placa !== undefined) dbPatch.placa = patch.placa === '—' ? null : patch.placa
        if (patch.tipo !== undefined) dbPatch.tipo = patch.tipo
        if (patch.locador !== undefined) dbPatch.locador = patch.locador
        if (patch.motorista !== undefined) dbPatch.motorista = patch.motorista === '—' ? null : patch.motorista
        if (patch.custoMensal !== undefined) dbPatch.custo_mensal = patch.custoMensal
        if (patch.status !== undefined) dbPatch.status = patch.status
        if (patch.obs !== undefined) dbPatch.obs = patch.obs
        const { error: e1 } = await supabase.from('wcr_veiculos').update(dbPatch).eq('id', id)
        if (e1) throw e1
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao atualizar veículo')
        await load()
      }
    },
    [load],
  )

  const removerVeiculo = useCallback(
    async (id: string) => {
      setFrota((prev) => {
        const next = prev.filter((v) => v.id !== id)
        writeCache(next)
        return next
      })
      if (!supabase) return
      try {
        const { error: e1 } = await supabase.from('wcr_veiculos').update({ ativo: false }).eq('id', id)
        if (e1) throw e1
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao remover veículo')
        await load()
      }
    },
    [load],
  )

  const moverParaEquipe = useCallback(
    async (id: string, equipeId: string | null) => {
      setFrota((prev) => {
        const next = prev.map((v) => (v.id === id ? { ...v, equipe: equipeId ?? '—' } : v))
        writeCache(next)
        return next
      })
      if (!supabase) return
      try {
        const { error: e1 } = await supabase.from('wcr_veiculos').update({ equipe_id: equipeId }).eq('id', id)
        if (e1) throw e1
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao mover veículo')
        await load()
      }
    },
    [load],
  )

  return {
    frota,
    loading,
    error,
    reload: load,
    criarVeiculo,
    atualizarVeiculo,
    removerVeiculo,
    moverParaEquipe,
  }
}
