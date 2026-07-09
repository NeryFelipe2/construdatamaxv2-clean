/**
 * useProducaoDiaria — CRUD da produção diária tipada (Execução_Geral → RDO).
 * Tabela `producao_diaria`: 1 linha por dia×equipe×rua×núcleo.
 *
 * Padrão seguido de `useSupabaseNsPlanejamento.ts` / `useEquipes.ts`:
 * useState/useCallback/useEffect, optimistic update + revert via reload em caso de erro.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ProducaoDiariaRow {
  id: string
  projetoId: string
  data: string // ISO yyyy-mm-dd
  nucleo: string | null
  equipeId: string | null // id de wcr_equipes (opcional)
  equipeNome: string | null // fallback texto livre / display
  rua: string | null
  la: number // ligações de água (un)
  le: number // ligações de esgoto (un)
  praM: number // prolongamento rede água (m)
  dnAgua: string | null
  cUma: number // caixas U.M.A (un)
  preM: number // prolongamento rede esgoto (m)
  dnEsgoto: string | null
  cInsp: number // caixas de inspeção (un)
  pv: number
  pi: number
  lie: number
  lia: number
  ihm: number
  intercept: number
  dn3: string | null
  obs: string | null
  criadoPor: string | null
  createdAt: string
  updatedAt: string
}

export interface ProducaoDiariaInput {
  data: string
  nucleo?: string | null
  equipeId?: string | null
  equipeNome?: string | null
  rua?: string | null
  la?: number
  le?: number
  praM?: number
  dnAgua?: string | null
  cUma?: number
  preM?: number
  dnEsgoto?: string | null
  cInsp?: number
  pv?: number
  pi?: number
  lie?: number
  lia?: number
  ihm?: number
  intercept?: number
  dn3?: string | null
  obs?: string | null
}

interface DbRow {
  id: string
  projeto_id: string
  data: string
  nucleo: string | null
  equipe_id: string | null
  equipe_nome: string | null
  rua: string | null
  la: number
  le: number
  pra_m: number
  dn_agua: string | null
  c_uma: number
  pre_m: number
  dn_esgoto: string | null
  c_insp: number
  pv: number
  pi: number
  lie: number
  lia: number
  ihm: number
  intercept: number
  dn3: string | null
  obs: string | null
  criado_por: string | null
  created_at: string
  updated_at: string
}

function fromDb(row: DbRow): ProducaoDiariaRow {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    data: row.data,
    nucleo: row.nucleo,
    equipeId: row.equipe_id,
    equipeNome: row.equipe_nome,
    rua: row.rua,
    la: Number(row.la) || 0,
    le: Number(row.le) || 0,
    praM: Number(row.pra_m) || 0,
    dnAgua: row.dn_agua,
    cUma: Number(row.c_uma) || 0,
    preM: Number(row.pre_m) || 0,
    dnEsgoto: row.dn_esgoto,
    cInsp: Number(row.c_insp) || 0,
    pv: Number(row.pv) || 0,
    pi: Number(row.pi) || 0,
    lie: Number(row.lie) || 0,
    lia: Number(row.lia) || 0,
    ihm: Number(row.ihm) || 0,
    intercept: Number(row.intercept) || 0,
    dn3: row.dn3,
    obs: row.obs,
    criadoPor: row.criado_por,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function textOrNull(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : null
}

function toDbInsert(id: string, projetoId: string, input: ProducaoDiariaInput, criadoPor: string): Record<string, unknown> {
  return {
    id,
    projeto_id: projetoId,
    data: input.data,
    nucleo: textOrNull(input.nucleo),
    equipe_id: textOrNull(input.equipeId),
    equipe_nome: textOrNull(input.equipeNome),
    rua: textOrNull(input.rua),
    la: input.la ?? 0,
    le: input.le ?? 0,
    pra_m: input.praM ?? 0,
    dn_agua: textOrNull(input.dnAgua),
    c_uma: input.cUma ?? 0,
    pre_m: input.preM ?? 0,
    dn_esgoto: textOrNull(input.dnEsgoto),
    c_insp: input.cInsp ?? 0,
    pv: input.pv ?? 0,
    pi: input.pi ?? 0,
    lie: input.lie ?? 0,
    lia: input.lia ?? 0,
    ihm: input.ihm ?? 0,
    intercept: input.intercept ?? 0,
    dn3: textOrNull(input.dn3),
    obs: textOrNull(input.obs),
    criado_por: criadoPor,
  }
}

// Converte um patch parcial (camelCase) para as colunas do banco (snake_case).
function toDbPatch(patch: Partial<ProducaoDiariaInput>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if ('data' in patch) out.data = patch.data
  if ('nucleo' in patch) out.nucleo = textOrNull(patch.nucleo)
  if ('equipeId' in patch) out.equipe_id = textOrNull(patch.equipeId)
  if ('equipeNome' in patch) out.equipe_nome = textOrNull(patch.equipeNome)
  if ('rua' in patch) out.rua = textOrNull(patch.rua)
  if ('la' in patch) out.la = patch.la ?? 0
  if ('le' in patch) out.le = patch.le ?? 0
  if ('praM' in patch) out.pra_m = patch.praM ?? 0
  if ('dnAgua' in patch) out.dn_agua = textOrNull(patch.dnAgua)
  if ('cUma' in patch) out.c_uma = patch.cUma ?? 0
  if ('preM' in patch) out.pre_m = patch.preM ?? 0
  if ('dnEsgoto' in patch) out.dn_esgoto = textOrNull(patch.dnEsgoto)
  if ('cInsp' in patch) out.c_insp = patch.cInsp ?? 0
  if ('pv' in patch) out.pv = patch.pv ?? 0
  if ('pi' in patch) out.pi = patch.pi ?? 0
  if ('lie' in patch) out.lie = patch.lie ?? 0
  if ('lia' in patch) out.lia = patch.lia ?? 0
  if ('ihm' in patch) out.ihm = patch.ihm ?? 0
  if ('intercept' in patch) out.intercept = patch.intercept ?? 0
  if ('dn3' in patch) out.dn3 = textOrNull(patch.dn3)
  if ('obs' in patch) out.obs = textOrNull(patch.obs)
  return out
}

export function useProducaoDiaria(projetoId: string | null) {
  const [linhas, setLinhas] = useState<ProducaoDiariaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) {
      setLinhas([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('producao_diaria')
        .select('*')
        .eq('projeto_id', projetoId)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
      if (e1) throw e1
      setLinhas(((data ?? []) as DbRow[]).map(fromDb))
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar produção diária')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    load()
  }, [load])

  const adicionarLinha = useCallback(
    async (input: ProducaoDiariaInput): Promise<boolean> => {
      if (!projetoId) return false
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const otimista: ProducaoDiariaRow = {
        id,
        projetoId,
        data: input.data,
        nucleo: textOrNull(input.nucleo),
        equipeId: textOrNull(input.equipeId),
        equipeNome: textOrNull(input.equipeNome),
        rua: textOrNull(input.rua),
        la: input.la ?? 0,
        le: input.le ?? 0,
        praM: input.praM ?? 0,
        dnAgua: textOrNull(input.dnAgua),
        cUma: input.cUma ?? 0,
        preM: input.preM ?? 0,
        dnEsgoto: textOrNull(input.dnEsgoto),
        cInsp: input.cInsp ?? 0,
        pv: input.pv ?? 0,
        pi: input.pi ?? 0,
        lie: input.lie ?? 0,
        lia: input.lia ?? 0,
        ihm: input.ihm ?? 0,
        intercept: input.intercept ?? 0,
        dn3: textOrNull(input.dn3),
        obs: textOrNull(input.obs),
        criadoPor: 'site',
        createdAt: now,
        updatedAt: now,
      }
      setLinhas((prev) => [otimista, ...prev])
      if (!supabase) return true
      try {
        const { error: e1 } = await supabase.from('producao_diaria').insert(toDbInsert(id, projetoId, input, 'site'))
        if (e1) throw e1
        return true
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao adicionar linha de produção')
        setLinhas((prev) => prev.filter((l) => l.id !== id)) // revert otimista
        return false
      }
    },
    [projetoId],
  )

  // Inserção em lote (Importar CSV) — grava tudo, depois recarrega do banco.
  const adicionarLinhasEmLote = useCallback(
    async (inputs: ProducaoDiariaInput[]): Promise<{ ok: boolean; gravadas: number }> => {
      if (!supabase || !projetoId || inputs.length === 0) return { ok: false, gravadas: 0 }
      try {
        const payload = inputs.map((input) => toDbInsert(crypto.randomUUID(), projetoId, input, 'csv'))
        const { error: e1 } = await supabase.from('producao_diaria').insert(payload)
        if (e1) throw e1
        await load()
        return { ok: true, gravadas: inputs.length }
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao importar linhas de produção')
        return { ok: false, gravadas: 0 }
      }
    },
    [projetoId, load],
  )

  const atualizarLinha = useCallback(
    async (id: string, patch: Partial<ProducaoDiariaInput>) => {
      setLinhas((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                ...('data' in patch ? { data: patch.data as string } : {}),
                ...('nucleo' in patch ? { nucleo: textOrNull(patch.nucleo) } : {}),
                ...('equipeId' in patch ? { equipeId: textOrNull(patch.equipeId) } : {}),
                ...('equipeNome' in patch ? { equipeNome: textOrNull(patch.equipeNome) } : {}),
                ...('rua' in patch ? { rua: textOrNull(patch.rua) } : {}),
                ...('la' in patch ? { la: patch.la ?? 0 } : {}),
                ...('le' in patch ? { le: patch.le ?? 0 } : {}),
                ...('praM' in patch ? { praM: patch.praM ?? 0 } : {}),
                ...('dnAgua' in patch ? { dnAgua: textOrNull(patch.dnAgua) } : {}),
                ...('cUma' in patch ? { cUma: patch.cUma ?? 0 } : {}),
                ...('preM' in patch ? { preM: patch.preM ?? 0 } : {}),
                ...('dnEsgoto' in patch ? { dnEsgoto: textOrNull(patch.dnEsgoto) } : {}),
                ...('cInsp' in patch ? { cInsp: patch.cInsp ?? 0 } : {}),
                ...('pv' in patch ? { pv: patch.pv ?? 0 } : {}),
                ...('pi' in patch ? { pi: patch.pi ?? 0 } : {}),
                ...('lie' in patch ? { lie: patch.lie ?? 0 } : {}),
                ...('lia' in patch ? { lia: patch.lia ?? 0 } : {}),
                ...('ihm' in patch ? { ihm: patch.ihm ?? 0 } : {}),
                ...('intercept' in patch ? { intercept: patch.intercept ?? 0 } : {}),
                ...('dn3' in patch ? { dn3: textOrNull(patch.dn3) } : {}),
                ...('obs' in patch ? { obs: textOrNull(patch.obs) } : {}),
                updatedAt: new Date().toISOString(),
              }
            : l,
        ),
      )
      if (!supabase) return
      try {
        const dbPatch = toDbPatch(patch)
        dbPatch.updated_at = new Date().toISOString()
        const { error: e1 } = await supabase.from('producao_diaria').update(dbPatch).eq('id', id)
        if (e1) throw e1
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao atualizar linha de produção')
        await load() // revert via reload
      }
    },
    [load],
  )

  const removerLinha = useCallback(
    async (id: string) => {
      setLinhas((prev) => prev.filter((l) => l.id !== id))
      if (!supabase) return
      try {
        const { error: e1 } = await supabase.from('producao_diaria').delete().eq('id', id)
        if (e1) throw e1
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao remover linha de produção')
        await load() // revert via reload
      }
    },
    [load],
  )

  return {
    linhas,
    loading,
    error,
    reload: load,
    adicionarLinha,
    adicionarLinhasEmLote,
    atualizarLinha,
    removerLinha,
  }
}
