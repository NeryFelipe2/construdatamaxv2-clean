/**
 * Fonte canônica das equipes WCR (organograma), agora editável no Supabase
 * (`wcr_equipes` + `equipe_membros`), com cache gracioso em localStorage e
 * fallback final na constante estática `WCR_EQUIPES` (nunca fica vazio).
 *
 * ATENÇÃO: a tabela é `wcr_equipes` (não `equipes` — essa é de outro sistema).
 *
 * O estado diário do Kanban (status/posição/drag) NÃO vive aqui — continua em
 * `equipesKanbanStore` (localStorage por dia). Este hook só cuida da
 * DEFINIÇÃO da equipe (nome, líder, encarregado, frente, foco, membros).
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WCR_EQUIPES, type EquipeCard, type Membro, type FrenteId } from '@/data/wcrEquipes'

const CACHE_KEY = 'wcr-equipes-cache'

function slugId(nome: string): string {
  const base = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base || 'equipe'}-${suffix}`
}

function readCache(): EquipeCard[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

function writeCache(equipes: EquipeCard[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(equipes))
  } catch {
    // segue em memória — cache é só um bônus
  }
}

interface DbWcrEquipe {
  id: string
  frente: string
  nome: string
  lider: string
  encarregado: string | null
  foco: string | null
  a_contratar: boolean
  ordem: number
  ativo: boolean
}

interface DbEquipeMembro {
  id: string
  equipe_id: string
  nome: string
  funcao: string | null
  ordem: number
}

function montarEquipes(equipesDb: DbWcrEquipe[], membrosDb: DbEquipeMembro[]): EquipeCard[] {
  const membrosPorEquipe = new Map<string, Membro[]>()
  for (const m of [...membrosDb].sort((a, b) => a.ordem - b.ordem)) {
    const list = membrosPorEquipe.get(m.equipe_id) ?? []
    list.push({ id: m.id, nome: m.nome, funcao: m.funcao ?? '' })
    membrosPorEquipe.set(m.equipe_id, list)
  }
  return equipesDb
    .filter((e) => e.ativo)
    .sort((a, b) => a.ordem - b.ordem)
    .map((e) => ({
      id: e.id,
      equipe: e.nome,
      lider: e.lider,
      encarregado: e.encarregado ?? '',
      frente: e.frente as FrenteId,
      foco: e.foco ?? '',
      local: '—',
      membros: membrosPorEquipe.get(e.id) ?? [],
      aContratar: e.a_contratar,
      status: 'planejado' as const,
    }))
}

export interface NovaEquipeInput {
  equipe: string
  lider: string
  encarregado?: string
  frente: FrenteId
  foco?: string
  aContratar?: boolean
}

export function useEquipes() {
  const [equipes, setEquipes] = useState<EquipeCard[]>(() => readCache() ?? WCR_EQUIPES)
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
      const { data: equipesData, error: e1 } = await supabase
        .from('wcr_equipes')
        .select('id, frente, nome, lider, encarregado, foco, a_contratar, ordem, ativo')
        .order('ordem')
      if (e1) throw e1

      const { data: membrosData, error: e2 } = await supabase
        .from('equipe_membros')
        .select('id, equipe_id, nome, funcao, ordem')
        .order('ordem')
      if (e2) throw e2

      if (!equipesData || equipesData.length === 0) {
        // banco vazio: mantém o que já está (cache ou fallback estático) — nunca esvazia a tela
        return
      }

      const montado = montarEquipes(equipesData, membrosData ?? [])
      setEquipes(montado)
      writeCache(montado)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar equipes do Supabase')
      // cai no cache/fallback já carregado no estado inicial — fallback gracioso
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const criarEquipe = useCallback(
    async (input: NovaEquipeInput): Promise<string> => {
      const id = slugId(input.equipe)
      const novaCard: EquipeCard = {
        id,
        equipe: input.equipe,
        lider: input.lider,
        encarregado: input.encarregado ?? '',
        frente: input.frente,
        foco: input.foco ?? '',
        local: '—',
        membros: [],
        aContratar: input.aContratar ?? false,
        status: 'planejado',
      }
      setEquipes((prev) => {
        const next = [...prev, novaCard]
        writeCache(next)
        return next
      })
      if (!supabase) return id
      try {
        const ordem = equipes.length
        const { error: e1 } = await supabase.from('wcr_equipes').insert({
          id,
          frente: input.frente,
          nome: input.equipe,
          lider: input.lider,
          encarregado: input.encarregado ?? null,
          foco: input.foco ?? null,
          a_contratar: input.aContratar ?? false,
          ordem,
          ativo: true,
        })
        if (e1) throw e1
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao criar equipe')
        await load()
      }
      return id
    },
    [equipes.length, load],
  )

  const atualizarEquipe = useCallback(
    async (
      id: string,
      patch: Partial<Pick<EquipeCard, 'equipe' | 'lider' | 'encarregado' | 'foco' | 'frente' | 'aContratar'>>,
    ) => {
      setEquipes((prev) => {
        const next = prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
        writeCache(next)
        return next
      })
      if (!supabase) return
      try {
        const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (patch.equipe !== undefined) dbPatch.nome = patch.equipe
        if (patch.lider !== undefined) dbPatch.lider = patch.lider
        if (patch.encarregado !== undefined) dbPatch.encarregado = patch.encarregado
        if (patch.foco !== undefined) dbPatch.foco = patch.foco
        if (patch.frente !== undefined) dbPatch.frente = patch.frente
        if (patch.aContratar !== undefined) dbPatch.a_contratar = patch.aContratar
        const { error: e1 } = await supabase.from('wcr_equipes').update(dbPatch).eq('id', id)
        if (e1) throw e1
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao atualizar equipe')
        await load()
      }
    },
    [load],
  )

  const removerEquipe = useCallback(
    async (id: string) => {
      setEquipes((prev) => {
        const next = prev.filter((e) => e.id !== id)
        writeCache(next)
        return next
      })
      if (!supabase) return
      try {
        const { error: e1 } = await supabase.from('wcr_equipes').delete().eq('id', id)
        if (e1) throw e1
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao remover equipe')
        await load()
      }
    },
    [load],
  )

  const adicionarMembro = useCallback(
    async (equipeId: string, membro: { nome: string; funcao: string }) => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : slugId(membro.nome)
      let ordem = 0
      setEquipes((prev) => {
        const next = prev.map((e) => {
          if (e.id !== equipeId) return e
          ordem = e.membros.length
          return { ...e, membros: [...e.membros, { id, nome: membro.nome, funcao: membro.funcao }] }
        })
        writeCache(next)
        return next
      })
      if (!supabase) return
      try {
        const { error: e1 } = await supabase
          .from('equipe_membros')
          .insert({ id, equipe_id: equipeId, nome: membro.nome, funcao: membro.funcao, ordem })
        if (e1) throw e1
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao adicionar membro')
        await load()
      }
    },
    [load],
  )

  const removerMembro = useCallback(
    async (membroId: string) => {
      setEquipes((prev) => {
        const next = prev.map((e) => ({ ...e, membros: e.membros.filter((m) => m.id !== membroId) }))
        writeCache(next)
        return next
      })
      if (!supabase) return
      try {
        const { error: e1 } = await supabase.from('equipe_membros').delete().eq('id', membroId)
        if (e1) throw e1
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao remover membro')
        await load()
      }
    },
    [load],
  )

  const moverMembro = useCallback(
    async (membroId: string, novaEquipeId: string) => {
      setEquipes((prev) => {
        let movido: Membro | null = null
        const semMembro = prev.map((e) => {
          const achou = e.membros.find((m) => m.id === membroId)
          if (!achou) return e
          movido = achou
          return { ...e, membros: e.membros.filter((m) => m.id !== membroId) }
        })
        if (!movido) return prev
        const next = semMembro.map((e) => (e.id === novaEquipeId ? { ...e, membros: [...e.membros, movido as Membro] } : e))
        writeCache(next)
        return next
      })
      if (!supabase) return
      try {
        const { error: e1 } = await supabase.from('equipe_membros').update({ equipe_id: novaEquipeId }).eq('id', membroId)
        if (e1) throw e1
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao mover membro')
        await load()
      }
    },
    [load],
  )

  return {
    equipes,
    loading,
    error,
    reload: load,
    criarEquipe,
    atualizarEquipe,
    removerEquipe,
    adicionarMembro,
    removerMembro,
    moverMembro,
  }
}
