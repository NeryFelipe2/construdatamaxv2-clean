/**
 * usePessoas — fonte canônica do CADASTRO ÚNICO de pessoas (módulo Pessoal).
 *
 * Molde: useEquipes.ts — load + cache localStorage + update otimista com
 * rollback por releitura. Lê `pessoas` (join cargos + pessoa_equipe vigente),
 * `cargos`, `cargo_apelidos` e `pessoa_apelidos`.
 *
 * IMPORTANTE: as migrations 020/021/022 podem ainda NÃO estar aplicadas no
 * banco (o dono cola manualmente). TODO acesso degrada com elegância:
 * tabela inexistente (42P01 / PGRST205) → estado VAZIO + `tabelasAusentes:
 * true` para a UI avisar "migrations de pessoal ainda não aplicadas".
 *
 * `pessoa_remuneracao` NUNCA é lida aqui — é fechada por RLS (salário/CPF só
 * via Edge Function service_role).
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { normalizePessoa } from '@/lib/matching/pessoaMatch'

const CACHE_KEY = 'wcr-pessoas-cache'

export type CategoriaRdo = 'encarregado' | 'oficial' | 'ajudante' | 'operador' | 'indireto'
export type PessoaStatus = 'ativo' | 'desligado' | 'em_contratacao' | 'afastado' | 'desconhecido'

export interface Cargo {
  id: string
  nome: string
  categoria_rdo: CategoriaRdo
  familia: string | null
  nivel: string | null
  ativo: boolean
}

export interface CargoApelido {
  id: string
  cargo_id: string
  alias_raw: string
  alias_norm: string
}

export interface PessoaApelido {
  id: string
  pessoa_id: string
  alias_raw: string
  alias_norm: string
  fonte: string | null
  confianca: number
  revisado: boolean
}

export interface EquipeAtual {
  vinculoId: string
  equipeId: string
  funcao: string | null
  papel: string
  desde: string
}

export interface Pessoa {
  id: string
  nome_completo: string
  nome_norm: string
  apelido: string | null
  cargo_id: string | null
  cargo_texto: string | null
  cargo: { id: string; nome: string; categoria_rdo: CategoriaRdo } | null
  status: PessoaStatus
  vinculo: string | null
  encarregado_id: string | null
  encarregado_texto: string | null
  telefone: string | null
  data_admissao: string | null
  venc_experiencia_1: string | null
  venc_experiencia_2: string | null
  data_desligamento: string | null
  desligamento_previsto: boolean
  motivo_desligamento: string | null
  epi_calca: string | null
  epi_camisa: string | null
  epi_botina: string | null
  observacoes: string | null
  origem: string
  revisar: boolean
  equipeAtual: EquipeAtual | null
}

interface CacheShape {
  pessoas: Pessoa[]
  cargos: Cargo[]
  cargoApelidos: CargoApelido[]
  apelidos: PessoaApelido[]
}

function readCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && Array.isArray(parsed.pessoas) ? (parsed as CacheShape) : null
  } catch {
    return null
  }
}

function writeCache(c: CacheShape) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    // cache é bônus — segue em memória
  }
}

/** Erro de "tabela/relacão não existe" (migrations de pessoal não aplicadas). */
function ehTabelaAusente(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null
  if (!e) return false
  if (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST200') return true
  const msg = (e.message ?? '').toLowerCase()
  return (
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  )
}

export interface NovaPessoaInput {
  nomeCompleto: string
  apelido?: string | null
  cargoId?: string | null
  cargoTexto?: string | null
  status?: PessoaStatus
  vinculo?: string | null
  telefone?: string | null
  dataAdmissao?: string | null
  vencExperiencia1?: string | null
  vencExperiencia2?: string | null
  encarregadoTexto?: string | null
  epiCalca?: string | null
  epiCamisa?: string | null
  epiBotina?: string | null
  observacoes?: string | null
  /** vínculo inicial em pessoa_equipe (opcional) */
  equipeId?: string | null
  funcaoNaEquipe?: string | null
}

export type AtualizarPessoaPatch = Partial<
  Pick<
    Pessoa,
    | 'nome_completo'
    | 'apelido'
    | 'cargo_id'
    | 'cargo_texto'
    | 'status'
    | 'vinculo'
    | 'telefone'
    | 'data_admissao'
    | 'venc_experiencia_1'
    | 'venc_experiencia_2'
    | 'data_desligamento'
    | 'desligamento_previsto'
    | 'motivo_desligamento'
    | 'encarregado_texto'
    | 'epi_calca'
    | 'epi_camisa'
    | 'epi_botina'
    | 'observacoes'
    | 'revisar'
  >
>

export function usePessoas() {
  const cached = readCache()
  const [pessoas, setPessoas] = useState<Pessoa[]>(cached?.pessoas ?? [])
  const [cargos, setCargos] = useState<Cargo[]>(cached?.cargos ?? [])
  const [cargoApelidos, setCargoApelidos] = useState<CargoApelido[]>(cached?.cargoApelidos ?? [])
  const [apelidos, setApelidos] = useState<PessoaApelido[]>(cached?.apelidos ?? [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabelasAusentes, setTabelasAusentes] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: pessoasData, error: e1 } = await supabase
        .from('pessoas')
        .select(
          'id, nome_completo, nome_norm, apelido, cargo_id, cargo_texto, status, vinculo, ' +
            'encarregado_id, encarregado_texto, telefone, data_admissao, venc_experiencia_1, ' +
            'venc_experiencia_2, data_desligamento, desligamento_previsto, motivo_desligamento, ' +
            'epi_calca, epi_camisa, epi_botina, observacoes, origem, revisar, ' +
            'cargos(id, nome, categoria_rdo), pessoa_equipe(id, equipe_id, funcao, papel, desde, ate)',
        )
        .order('nome_completo')
      if (e1) throw e1

      const { data: cargosData, error: e2 } = await supabase
        .from('cargos')
        .select('id, nome, categoria_rdo, familia, nivel, ativo')
        .order('nome')
      if (e2) throw e2

      const { data: cargoAliasData, error: e3 } = await supabase
        .from('cargo_apelidos')
        .select('id, cargo_id, alias_raw, alias_norm')
      if (e3) throw e3

      const { data: apelidosData, error: e4 } = await supabase
        .from('pessoa_apelidos')
        .select('id, pessoa_id, alias_raw, alias_norm, fonte, confianca, revisado')
      if (e4) throw e4

      type RawPessoa = Record<string, unknown> & {
        cargos?: { id: string; nome: string; categoria_rdo: CategoriaRdo } | null
        pessoa_equipe?: Array<{
          id: string
          equipe_id: string
          funcao: string | null
          papel: string
          desde: string
          ate: string | null
        }> | null
      }

      const montadas: Pessoa[] = ((pessoasData ?? []) as RawPessoa[]).map((r) => {
        const vinculoVigente = (r.pessoa_equipe ?? []).find((v) => v.ate === null) ?? null
        return {
          id: String(r.id),
          nome_completo: String(r.nome_completo ?? ''),
          nome_norm: String(r.nome_norm ?? ''),
          apelido: (r.apelido as string | null) ?? null,
          cargo_id: (r.cargo_id as string | null) ?? null,
          cargo_texto: (r.cargo_texto as string | null) ?? null,
          cargo: r.cargos
            ? { id: r.cargos.id, nome: r.cargos.nome, categoria_rdo: r.cargos.categoria_rdo }
            : null,
          status: (r.status as PessoaStatus) ?? 'desconhecido',
          vinculo: (r.vinculo as string | null) ?? null,
          encarregado_id: (r.encarregado_id as string | null) ?? null,
          encarregado_texto: (r.encarregado_texto as string | null) ?? null,
          telefone: (r.telefone as string | null) ?? null,
          data_admissao: (r.data_admissao as string | null) ?? null,
          venc_experiencia_1: (r.venc_experiencia_1 as string | null) ?? null,
          venc_experiencia_2: (r.venc_experiencia_2 as string | null) ?? null,
          data_desligamento: (r.data_desligamento as string | null) ?? null,
          desligamento_previsto: Boolean(r.desligamento_previsto),
          motivo_desligamento: (r.motivo_desligamento as string | null) ?? null,
          epi_calca: (r.epi_calca as string | null) ?? null,
          epi_camisa: (r.epi_camisa as string | null) ?? null,
          epi_botina: (r.epi_botina as string | null) ?? null,
          observacoes: (r.observacoes as string | null) ?? null,
          origem: String(r.origem ?? 'manual'),
          revisar: Boolean(r.revisar),
          equipeAtual: vinculoVigente
            ? {
                vinculoId: vinculoVigente.id,
                equipeId: vinculoVigente.equipe_id,
                funcao: vinculoVigente.funcao,
                papel: vinculoVigente.papel,
                desde: vinculoVigente.desde,
              }
            : null,
        }
      })

      setPessoas(montadas)
      setCargos((cargosData ?? []) as Cargo[])
      setCargoApelidos((cargoAliasData ?? []) as CargoApelido[])
      setApelidos((apelidosData ?? []) as PessoaApelido[])
      setTabelasAusentes(false)
      writeCache({
        pessoas: montadas,
        cargos: (cargosData ?? []) as Cargo[],
        cargoApelidos: (cargoAliasData ?? []) as CargoApelido[],
        apelidos: (apelidosData ?? []) as PessoaApelido[],
      })
    } catch (err: unknown) {
      if (ehTabelaAusente(err)) {
        // migrations de pessoal ainda não aplicadas → estado vazio + aviso
        setTabelasAusentes(true)
        setPessoas([])
        setCargos([])
        setCargoApelidos([])
        setApelidos([])
      } else {
        const e = err as { message?: string }
        setError(e?.message ?? 'Erro ao carregar pessoas do Supabase')
        // mantém cache/estado atual — fallback gracioso
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ── CRUD pessoas ───────────────────────────────────────────────────────────

  const criarPessoa = useCallback(
    async (input: NovaPessoaInput): Promise<Pessoa | null> => {
      const nrm = normalizePessoa(input.nomeCompleto)
      const cargoEscolhido = input.cargoId ? cargos.find((c) => c.id === input.cargoId) ?? null : null
      if (!supabase) {
        setError('Supabase não configurado — cadastro indisponível')
        return null
      }
      try {
        const { data, error: e1 } = await supabase
          .from('pessoas')
          .insert({
            nome_completo: input.nomeCompleto.trim(),
            apelido: input.apelido ?? null,
            cargo_id: input.cargoId ?? null,
            cargo_texto: input.cargoTexto ?? cargoEscolhido?.nome ?? null,
            status: input.status ?? 'ativo',
            vinculo: input.vinculo ?? null,
            telefone: input.telefone ?? null,
            data_admissao: input.dataAdmissao ?? null,
            venc_experiencia_1: input.vencExperiencia1 ?? null,
            venc_experiencia_2: input.vencExperiencia2 ?? null,
            encarregado_texto: input.encarregadoTexto?.trim() || null,
            epi_calca: input.epiCalca ?? null,
            epi_camisa: input.epiCamisa ?? null,
            epi_botina: input.epiBotina ?? null,
            observacoes: input.observacoes ?? null,
            origem: 'manual',
          })
          .select('id')
          .single()
        if (e1) throw e1
        const pessoaId = (data as { id: string }).id

        // nome completo vira alias confirmado (nunca falha o cadastro)
        await supabase
          .from('pessoa_apelidos')
          .upsert(
            { pessoa_id: pessoaId, alias_raw: input.nomeCompleto.trim(), alias_norm: nrm.n1, fonte: 'manual', revisado: true },
            { onConflict: 'pessoa_id,alias_norm', ignoreDuplicates: true },
          )

        if (input.equipeId) {
          await supabase.from('pessoa_equipe').insert({
            pessoa_id: pessoaId,
            equipe_id: input.equipeId,
            funcao: input.funcaoNaEquipe ?? null,
          })
        }

        await load()
        return (
          readCache()?.pessoas.find((p) => p.id === pessoaId) ?? {
            id: pessoaId,
            nome_completo: input.nomeCompleto.trim(),
            nome_norm: nrm.n1,
            apelido: input.apelido ?? null,
            cargo_id: input.cargoId ?? null,
            cargo_texto: input.cargoTexto ?? null,
            cargo: cargoEscolhido
              ? { id: cargoEscolhido.id, nome: cargoEscolhido.nome, categoria_rdo: cargoEscolhido.categoria_rdo }
              : null,
            status: input.status ?? 'ativo',
            vinculo: input.vinculo ?? null,
            encarregado_id: null,
            encarregado_texto: input.encarregadoTexto ?? null,
            telefone: input.telefone ?? null,
            data_admissao: input.dataAdmissao ?? null,
            venc_experiencia_1: input.vencExperiencia1 ?? null,
            venc_experiencia_2: input.vencExperiencia2 ?? null,
            data_desligamento: null,
            desligamento_previsto: false,
            motivo_desligamento: null,
            epi_calca: input.epiCalca ?? null,
            epi_camisa: input.epiCamisa ?? null,
            epi_botina: input.epiBotina ?? null,
            observacoes: input.observacoes ?? null,
            origem: 'manual',
            revisar: false,
            equipeAtual: null,
          }
        )
      } catch (err: unknown) {
        if (ehTabelaAusente(err)) {
          setTabelasAusentes(true)
        } else {
          setError((err as { message?: string })?.message ?? 'Erro ao criar pessoa')
        }
        return null
      }
    },
    [cargos, load],
  )

  const atualizarPessoa = useCallback(
    async (id: string, patch: AtualizarPessoaPatch) => {
      // otimista
      setPessoas((prev) => {
        const next = prev.map((p) => {
          if (p.id !== id) return p
          const atualizado: Pessoa = { ...p, ...patch }
          if (patch.cargo_id !== undefined) {
            const c = cargos.find((x) => x.id === patch.cargo_id)
            atualizado.cargo = c ? { id: c.id, nome: c.nome, categoria_rdo: c.categoria_rdo } : null
          }
          return atualizado
        })
        return next
      })
      if (!supabase) return
      try {
        const dbPatch: Record<string, unknown> = { ...patch, atualizado_em: new Date().toISOString() }
        const { error: e1 } = await supabase.from('pessoas').update(dbPatch).eq('id', id)
        if (e1) throw e1
      } catch (err: unknown) {
        if (ehTabelaAusente(err)) setTabelasAusentes(true)
        else setError((err as { message?: string })?.message ?? 'Erro ao atualizar pessoa')
        await load()
      }
    },
    [cargos, load],
  )

  /** "Excluir" = status desligado + fecha TODOS os vínculos vigentes de equipe. */
  const desligarPessoa = useCallback(
    async (id: string, motivo?: string) => {
      const hoje = new Date().toISOString().slice(0, 10)
      setPessoas((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status: 'desligado', data_desligamento: hoje, motivo_desligamento: motivo ?? p.motivo_desligamento, equipeAtual: null }
            : p,
        ),
      )
      if (!supabase) return
      try {
        const { error: e1 } = await supabase
          .from('pessoas')
          .update({
            status: 'desligado',
            data_desligamento: hoje,
            motivo_desligamento: motivo ?? null,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', id)
        if (e1) throw e1
        const { error: e2 } = await supabase
          .from('pessoa_equipe')
          .update({ ate: hoje })
          .eq('pessoa_id', id)
          .is('ate', null)
        if (e2) throw e2
      } catch (err: unknown) {
        if (ehTabelaAusente(err)) setTabelasAusentes(true)
        else setError((err as { message?: string })?.message ?? 'Erro ao desligar pessoa')
        await load()
      }
    },
    [load],
  )

  /** Move/abre vínculo de equipe: fecha o vigente (se houver) e abre o novo. */
  const vincularEquipe = useCallback(
    async (pessoaId: string, equipeId: string | null, funcao?: string | null) => {
      const hoje = new Date().toISOString().slice(0, 10)
      setPessoas((prev) =>
        prev.map((p) =>
          p.id === pessoaId
            ? {
                ...p,
                equipeAtual: equipeId
                  ? { vinculoId: 'pendente', equipeId, funcao: funcao ?? null, papel: 'membro', desde: hoje }
                  : null,
              }
            : p,
        ),
      )
      if (!supabase) return
      try {
        const { error: e1 } = await supabase
          .from('pessoa_equipe')
          .update({ ate: hoje })
          .eq('pessoa_id', pessoaId)
          .is('ate', null)
        if (e1) throw e1
        if (equipeId) {
          const { error: e2 } = await supabase
            .from('pessoa_equipe')
            .insert({ pessoa_id: pessoaId, equipe_id: equipeId, funcao: funcao ?? null })
          if (e2) throw e2
        }
        await load()
      } catch (err: unknown) {
        if (ehTabelaAusente(err)) setTabelasAusentes(true)
        else setError((err as { message?: string })?.message ?? 'Erro ao vincular equipe')
        await load()
      }
    },
    [load],
  )

  // ── Cargos ─────────────────────────────────────────────────────────────────

  const criarCargo = useCallback(
    async (nome: string, categoria: CategoriaRdo): Promise<string | null> => {
      if (!supabase) return null
      try {
        const { data, error: e1 } = await supabase
          .from('cargos')
          .insert({ nome: nome.trim(), categoria_rdo: categoria })
          .select('id')
          .single()
        if (e1) throw e1
        await load()
        return (data as { id: string }).id
      } catch (err: unknown) {
        if (ehTabelaAusente(err)) setTabelasAusentes(true)
        else setError((err as { message?: string })?.message ?? 'Erro ao criar cargo')
        return null
      }
    },
    [load],
  )

  const atualizarCargo = useCallback(
    async (id: string, patch: Partial<Pick<Cargo, 'nome' | 'categoria_rdo' | 'ativo'>>) => {
      setCargos((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      if (!supabase) return
      try {
        const { error: e1 } = await supabase.from('cargos').update(patch).eq('id', id)
        if (e1) throw e1
      } catch (err: unknown) {
        if (ehTabelaAusente(err)) setTabelasAusentes(true)
        else setError((err as { message?: string })?.message ?? 'Erro ao atualizar cargo')
        await load()
      }
    },
    [load],
  )

  // ── Fila de duplicatas / apelidos ──────────────────────────────────────────

  /** Confirma que `aliasNorm` resolve para `pessoaId`; remove o alias das demais. */
  const confirmarAliasParaPessoa = useCallback(
    async (aliasNorm: string, pessoaId: string) => {
      if (!supabase) return
      try {
        // remove o alias NÃO revisado das outras pessoas (invariante: 1 alias confirmado = 1 pessoa)
        const { error: e0 } = await supabase
          .from('pessoa_apelidos')
          .delete()
          .eq('alias_norm', aliasNorm)
          .eq('revisado', false)
          .neq('pessoa_id', pessoaId)
        if (e0) throw e0
        const { error: e1 } = await supabase
          .from('pessoa_apelidos')
          .update({ revisado: true, confianca: 1.0 })
          .eq('alias_norm', aliasNorm)
          .eq('pessoa_id', pessoaId)
        if (e1) throw e1
        const { error: e2 } = await supabase.from('pessoas').update({ revisar: false }).eq('id', pessoaId)
        if (e2) throw e2
        await load()
      } catch (err: unknown) {
        if (ehTabelaAusente(err)) setTabelasAusentes(true)
        else setError((err as { message?: string })?.message ?? 'Erro ao confirmar apelido')
        await load()
      }
    },
    [load],
  )

  /** Cria/move o alias para outra pessoa escolhida manualmente ("buscar outra"). */
  const vincularAliasAPessoa = useCallback(
    async (aliasRaw: string, aliasNorm: string, pessoaId: string) => {
      if (!supabase) return
      try {
        const { error: e0 } = await supabase
          .from('pessoa_apelidos')
          .delete()
          .eq('alias_norm', aliasNorm)
          .eq('revisado', false)
        if (e0) throw e0
        const { error: e1 } = await supabase
          .from('pessoa_apelidos')
          .upsert(
            { pessoa_id: pessoaId, alias_raw: aliasRaw, alias_norm: aliasNorm, fonte: 'manual', revisado: true, confianca: 1.0 },
            { onConflict: 'pessoa_id,alias_norm' },
          )
        if (e1) throw e1
        await load()
      } catch (err: unknown) {
        if (ehTabelaAusente(err)) setTabelasAusentes(true)
        else setError((err as { message?: string })?.message ?? 'Erro ao vincular apelido')
        await load()
      }
    },
    [load],
  )

  /** "São pessoas diferentes": limpa o alias ambíguo e tira as pessoas da fila. */
  const saoPessoasDiferentes = useCallback(
    async (aliasNorm: string, pessoaIds: string[]) => {
      if (!supabase) return
      try {
        // apaga só o alias AMBÍGUO não revisado que não é o próprio nome da pessoa
        for (const pid of pessoaIds) {
          const pessoa = pessoas.find((p) => p.id === pid)
          if (pessoa && pessoa.nome_norm === aliasNorm) {
            await supabase
              .from('pessoa_apelidos')
              .update({ revisado: true, confianca: 1.0 })
              .eq('alias_norm', aliasNorm)
              .eq('pessoa_id', pid)
          } else {
            await supabase
              .from('pessoa_apelidos')
              .delete()
              .eq('alias_norm', aliasNorm)
              .eq('pessoa_id', pid)
              .eq('revisado', false)
          }
        }
        const { error: e2 } = await supabase.from('pessoas').update({ revisar: false }).in('id', pessoaIds)
        if (e2) throw e2
        await load()
      } catch (err: unknown) {
        if (ehTabelaAusente(err)) setTabelasAusentes(true)
        else setError((err as { message?: string })?.message ?? 'Erro ao resolver duplicata')
        await load()
      }
    },
    [pessoas, load],
  )

  /** Descarta os aliases não revisados de um grupo (não mexe nas pessoas). */
  const descartarAlias = useCallback(
    async (aliasNorm: string) => {
      if (!supabase) return
      try {
        const { error: e1 } = await supabase
          .from('pessoa_apelidos')
          .delete()
          .eq('alias_norm', aliasNorm)
          .eq('revisado', false)
        if (e1) throw e1
        await load()
      } catch (err: unknown) {
        if (ehTabelaAusente(err)) setTabelasAusentes(true)
        else setError((err as { message?: string })?.message ?? 'Erro ao descartar apelido')
        await load()
      }
    },
    [load],
  )

  const marcarPessoaRevisada = useCallback(
    async (pessoaId: string) => {
      setPessoas((prev) => prev.map((p) => (p.id === pessoaId ? { ...p, revisar: false } : p)))
      if (!supabase) return
      try {
        const { error: e1 } = await supabase.from('pessoas').update({ revisar: false }).eq('id', pessoaId)
        if (e1) throw e1
      } catch (err: unknown) {
        if (ehTabelaAusente(err)) setTabelasAusentes(true)
        else setError((err as { message?: string })?.message ?? 'Erro ao marcar como revisada')
        await load()
      }
    },
    [load],
  )

  return {
    pessoas,
    cargos,
    cargoApelidos,
    apelidos,
    loading,
    error,
    tabelasAusentes,
    reload: load,
    criarPessoa,
    atualizarPessoa,
    desligarPessoa,
    vincularEquipe,
    criarCargo,
    atualizarCargo,
    confirmarAliasParaPessoa,
    vincularAliasAPessoa,
    saoPessoasDiferentes,
    descartarAlias,
    marcarPessoaRevisada,
  }
}
