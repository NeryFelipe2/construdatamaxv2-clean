/**
 * useProgramacaoSemana.ts
 *
 * Hook Supabase da PROGRAMAÇÃO DA SEMANA gravada em `programacao_semana`
 * (o "previsto" montado com a gestão: por frente → equipe → serviço + meta).
 * Pega sempre a semana MAIS RECENTE (maior semana_ini) e agrupa por frente e
 * equipe pro Kanban da tela. Nunca inventa dados: se o supabase não estiver
 * disponível (demo) ou a tabela estiver vazia, devolve lista vazia sem quebrar.
 *
 * FASE 3 (27/07) — a tela virou EDITÁVEL e ganhou REALIZADO ao vivo:
 *
 *  - Escrita: criarLinha / atualizarLinha / excluirLinha direto em
 *    `programacao_semana` (id gen_random_uuid no banco, mas geramos client-side
 *    pro update otimista; a tabela NÃO tem updated_at). Padrão otimista+revert
 *    de usePenteFinoCronograma.
 *
 *  - REALIZADO: soma de `producao_diaria` na janela semana_ini→semana_fim,
 *    lida pela view `vw_producao_equipe` (produção + rateio de equipe:
 *    equipe_id_resolvida/peso vindos de equipe_aliases+equipe_alias_membros).
 *    O texto livre da coluna `equipe` casa por normalização idêntica à
 *    norm_txt do banco (lower + sem acento + espaços colapsados):
 *      1) alias_norm exato em equipe_aliases (com e sem o parêntese do líder);
 *      2) nome exato em wcr_equipes (idem);
 *      3) equipe_nome da produção com a MESMA norm.
 *    Linha casada por equipe_id_resolvida entra com o PESO do rateio (ex.:
 *    "Cristian e Renan" → 0,5 pra cada); casada pelo nome inteiro entra com a
 *    soma dos pesos (=1 por linha física) — nunca conta dobrado.
 *
 *  - Serviço → colunas de producao_diaria (sem correspondência → realizado
 *    null; a tela mostra "—" e explica, em vez de fingir zero):
 *      caixa/uma           → c_uma      caixa de inspeção → c_insp
 *      hm/hidrômetro       → ihm        pv/pi             → pv + pi
 *      ligação + água      → la         ligação + esgoto  → le
 *      rede + água         → pra_m      rede + esgoto     → pre_m
 *      interligação        → lia/lie (conforme água/esgoto)
 *
 *  - Badge COMPROMISSO: existe lps_tasks comprometida na MESMA semana ISO cujo
 *    responsavel casa (norm) com a equipe da linha ou com o líder da equipe
 *    resolvida em wcr_equipes. Leitura combinada, SEM segundo caminho de
 *    escrita — o compromisso canônico é lps_tasks, gravado no Semáforo.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { semanaIsoDe } from '@/hooks/useCurtoPrazoSemana'

// ─── Tipos base (contrato antigo, mantido pros consumidores existentes) ─────

interface ProgramacaoRow {
  id: string
  semana_ini: string
  semana_fim: string
  frente: string
  equipe: string
  servico: string
  meta_qtd: number | null
  meta_unidade: string | null
  obs: string | null
}

export interface ServicoProgramado {
  servico: string
  metaQtd: number | null
  metaUnidade: string | null
  obs: string | null
}
export interface EquipeProgramada {
  equipe: string
  servicos: ServicoProgramado[]
}
export interface FrenteProgramada {
  frente: string
  equipes: EquipeProgramada[]
}

// ─── Tipos novos (edição + realizado ao vivo) ───────────────────────────────

export interface ProgramacaoLinhaInput {
  semanaIni: string
  semanaFim: string
  frente: string
  equipe: string
  servico: string
  metaQtd: number
  metaUnidade: string | null
  obs: string | null
}

export interface ProgramacaoLinha {
  id: string
  semanaIni: string
  semanaFim: string
  frente: string
  equipe: string
  servico: string
  metaQtd: number | null
  metaUnidade: string | null
  obs: string | null
  /** Soma casada na janela; null = serviço sem coluna mensurável em producao_diaria. */
  realizado: number | null
  /** Colunas de producao_diaria usadas no cruzamento (vazio = sem tradução). */
  colunas: string[]
  /** Linhas físicas de producao_diaria que casaram (0 = nenhum apontamento vinculado). */
  linhasCasadas: number
  /** true = existe lps_tasks comprometida na mesma semana ISO casando com a equipe/líder. */
  temCompromissoLps: boolean
}

export interface EquipeAtivaOption {
  id: string
  nome: string
  lider: string
}

// ─── Semana corrente seg–sáb (pré-preenchimento do form) ────────────────────

function isoLocal(d: Date): string {
  const p = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Segunda e sábado da semana corrente (padrão de trabalho da obra: seg–sáb). */
export function segSabCorrente(): { ini: string; fim: string } {
  const d = new Date()
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  const seg = new Date(d)
  seg.setDate(d.getDate() - (dow - 1))
  const sab = new Date(seg)
  sab.setDate(seg.getDate() + 5)
  return { ini: isoLocal(seg), fim: isoLocal(sab) }
}

// ─── Normalização (espelho JS da norm_txt do banco) ─────────────────────────

/** lower + sem acento + espaços colapsados — idêntico à norm_txt(text) do banco. */
export function normTxt(s: string): string {
  let semAcento = ''
  for (const ch of s.toLowerCase().normalize('NFD')) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp >= 0x0300 && cp <= 0x036f) continue
    semAcento += ch
  }
  return semAcento.replace(/\s+/g, ' ').trim()
}

/**
 * Candidatos de casamento do texto livre da equipe: a norm inteira e a norm
 * sem o parêntese do líder (ex.: "Equipe PV (Michael Douglas)" → "equipe pv").
 */
function candidatosDaEquipe(equipe: string): string[] {
  const cheio = normTxt(equipe)
  const semParenteses = normTxt(equipe.replace(/\([^)]*\)/g, ' '))
  return Array.from(new Set([cheio, semParenteses].filter((c) => c.length > 0)))
}

// ─── Serviço → colunas de producao_diaria ───────────────────────────────────

/**
 * Traduz serviço+unidade da meta pras colunas de producao_diaria (via
 * vw_producao_equipe). Vazio = sem coluna correspondente → a tela mostra "—"
 * honesto com tooltip, nunca zero fabricado. Ordem importa (inspeção antes de
 * caixa; interligação antes de ligação; rede antes de ligação).
 */
export function colunasDaMeta(servico: string, unidade: string | null): string[] {
  const s = normTxt(`${servico} ${unidade ?? ''}`)
  if (/\bpvs?\b|\bpis?\b/.test(s)) return ['pv', 'pi']
  if (/hidrometro|hidr|\bhm\b/.test(s)) return ['ihm']
  if (/interlig/.test(s)) {
    if (/esgoto/.test(s)) return ['lie']
    if (/agua/.test(s)) return ['lia']
    return ['lia', 'lie']
  }
  if (/caixa.*(inspecao|insp)|c\.? ?insp/.test(s)) return ['c_insp']
  if (/caixa|\buma\b/.test(s)) return ['c_uma']
  if (/rede.*esgoto|\bpre\b/.test(s)) return ['pre_m']
  if (/rede.*agua|\bpra\b/.test(s)) return ['pra_m']
  if (/liga\w*.*esgoto|\ble\b|\blie\b/.test(s)) return ['le']
  if (/liga\w*.*agua|\bla\b|\blia\b|liga\w*/.test(s)) return ['la']
  return []
}

// ─── Linhas auxiliares do banco ─────────────────────────────────────────────

interface AliasDb { id: string; alias_norm: string }
interface AliasMembroDb { alias_id: string; equipe_id: string }
interface WcrEquipeDb { id: string; nome: string; lider: string | null; ativo: boolean }
interface ProducaoDb {
  id: string
  data: string
  equipe_nome: string | null
  equipe_id_resolvida: string | null
  peso: number | string | null
  c_uma: number | null
  c_insp: number | null
  ihm: number | null
  la: number | null
  le: number | null
  lia: number | null
  lie: number | null
  pra_m: number | string | null
  pre_m: number | string | null
  pv: number | null
  pi: number | null
}
interface LpsCompromissoDb { responsavel: string | null }

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Ordem canônica das frentes (as demais, se surgirem, vão pro fim em ordem alfabética).
const ORDEM_FRENTE = ['Boi Malhado', 'Ilha Bela', 'Sakura', 'Retorno']

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useProgramacaoSemana() {
  const [rows, setRows] = useState<ProgramacaoRow[]>([])
  const [semanaIni, setSemanaIni] = useState<string | null>(null)
  const [semanaFim, setSemanaFim] = useState<string | null>(null)
  const [producao, setProducao] = useState<ProducaoDb[]>([])
  const [aliases, setAliases] = useState<AliasDb[]>([])
  const [aliasMembros, setAliasMembros] = useState<AliasMembroDb[]>([])
  const [wcrEquipes, setWcrEquipes] = useState<WcrEquipeDb[]>([])
  const [lpsResponsaveis, setLpsResponsaveis] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setRows([])
      setSemanaIni(null)
      setSemanaFim(null)
      setProducao([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      // 1) descobre a semana mais recente
      const { data: ult, error: e0 } = await supabase
        .from('programacao_semana')
        .select('semana_ini, semana_fim')
        .order('semana_ini', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (e0) throw e0
      if (!ult) {
        setRows([])
        setSemanaIni(null)
        setSemanaFim(null)
        setProducao([])
        return
      }
      const ini = String(ult.semana_ini).slice(0, 10)
      const fim = String(ult.semana_fim).slice(0, 10)
      setSemanaIni(ini)
      setSemanaFim(fim)

      // 2) itens da semana + produção da janela + dimensões de equipe + LPS
      //    (tudo em paralelo — as tabelas de alias são pequenas, ~54 linhas)
      const [linhasQ, prodQ, aliasQ, membroQ, equipesQ, lpsQ] = await Promise.all([
        supabase
          .from('programacao_semana')
          .select('id, semana_ini, semana_fim, frente, equipe, servico, meta_qtd, meta_unidade, obs')
          .eq('semana_ini', ini),
        supabase
          .from('vw_producao_equipe')
          .select('id, data, equipe_nome, equipe_id_resolvida, peso, c_uma, c_insp, ihm, la, le, lia, lie, pra_m, pre_m, pv, pi')
          .gte('data', ini)
          .lte('data', fim),
        supabase.from('equipe_aliases').select('id, alias_norm'),
        supabase.from('equipe_alias_membros').select('alias_id, equipe_id'),
        supabase.from('wcr_equipes').select('id, nome, lider, ativo'),
        supabase
          .from('lps_tasks')
          .select('responsavel')
          .eq('semana_iso', semanaIsoDe(ini))
          .eq('comprometida', true)
          .not('responsavel', 'is', null),
      ])
      if (linhasQ.error) throw linhasQ.error
      if (prodQ.error) throw prodQ.error
      if (aliasQ.error) throw aliasQ.error
      if (membroQ.error) throw membroQ.error
      if (equipesQ.error) throw equipesQ.error
      if (lpsQ.error) throw lpsQ.error

      setRows((linhasQ.data ?? []) as ProgramacaoRow[])
      setProducao((prodQ.data ?? []) as ProducaoDb[])
      setAliases((aliasQ.data ?? []) as AliasDb[])
      setAliasMembros((membroQ.data ?? []) as AliasMembroDb[])
      setWcrEquipes((equipesQ.data ?? []) as WcrEquipeDb[])
      setLpsResponsaveis(
        ((lpsQ.data ?? []) as LpsCompromissoDb[])
          .map((r) => (r.responsavel ? normTxt(r.responsavel) : ''))
          .filter((r) => r.length > 0),
      )
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar a programação da semana')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ─── Escrita (otimista + revert, padrão usePenteFinoCronograma) ───────────

  const criarLinha = useCallback(
    async (input: ProgramacaoLinhaInput): Promise<boolean> => {
      if (!supabase) return false
      const id = crypto.randomUUID()
      const anterior = rows
      // otimista só quando a linha pertence à semana carregada (senão o load
      // resolve — a tela sempre mostra a semana mais recente)
      if (semanaIni === null || input.semanaIni === semanaIni) {
        setRows((prev) => [
          ...prev,
          {
            id,
            semana_ini: input.semanaIni,
            semana_fim: input.semanaFim,
            frente: input.frente,
            equipe: input.equipe,
            servico: input.servico,
            meta_qtd: input.metaQtd,
            meta_unidade: input.metaUnidade,
            obs: input.obs,
          },
        ])
      }
      try {
        const { error: e1 } = await supabase.from('programacao_semana').insert({
          id,
          semana_ini: input.semanaIni,
          semana_fim: input.semanaFim,
          frente: input.frente,
          equipe: input.equipe,
          servico: input.servico,
          meta_qtd: input.metaQtd,
          meta_unidade: input.metaUnidade,
          obs: input.obs,
        })
        if (e1) throw e1
        await load() // resincroniza (semana pode ter mudado)
        return true
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao criar linha da programação')
        setRows(anterior) // reverte
        return false
      }
    },
    [rows, semanaIni, load],
  )

  const atualizarLinha = useCallback(
    async (id: string, patch: Partial<ProgramacaoLinhaInput>): Promise<boolean> => {
      if (!supabase) return false
      const anterior = rows
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                ...(patch.semanaIni !== undefined ? { semana_ini: patch.semanaIni } : {}),
                ...(patch.semanaFim !== undefined ? { semana_fim: patch.semanaFim } : {}),
                ...(patch.frente !== undefined ? { frente: patch.frente } : {}),
                ...(patch.equipe !== undefined ? { equipe: patch.equipe } : {}),
                ...(patch.servico !== undefined ? { servico: patch.servico } : {}),
                ...(patch.metaQtd !== undefined ? { meta_qtd: patch.metaQtd } : {}),
                ...(patch.metaUnidade !== undefined ? { meta_unidade: patch.metaUnidade } : {}),
                ...(patch.obs !== undefined ? { obs: patch.obs } : {}),
              }
            : r,
        ),
      )
      try {
        // a tabela NÃO tem updated_at — só as colunas de negócio
        const dbPatch: Record<string, unknown> = {}
        if (patch.semanaIni !== undefined) dbPatch.semana_ini = patch.semanaIni
        if (patch.semanaFim !== undefined) dbPatch.semana_fim = patch.semanaFim
        if (patch.frente !== undefined) dbPatch.frente = patch.frente
        if (patch.equipe !== undefined) dbPatch.equipe = patch.equipe
        if (patch.servico !== undefined) dbPatch.servico = patch.servico
        if (patch.metaQtd !== undefined) dbPatch.meta_qtd = patch.metaQtd
        if (patch.metaUnidade !== undefined) dbPatch.meta_unidade = patch.metaUnidade
        if (patch.obs !== undefined) dbPatch.obs = patch.obs
        const { error: e1 } = await supabase.from('programacao_semana').update(dbPatch).eq('id', id)
        if (e1) throw e1
        return true
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao atualizar linha da programação')
        setRows(anterior) // reverte
        return false
      }
    },
    [rows],
  )

  const excluirLinha = useCallback(
    async (id: string): Promise<boolean> => {
      if (!supabase) return false
      const anterior = rows
      setRows((prev) => prev.filter((r) => r.id !== id))
      try {
        const { error: e1 } = await supabase.from('programacao_semana').delete().eq('id', id)
        if (e1) throw e1
        return true
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao excluir linha da programação')
        setRows(anterior) // reverte
        return false
      }
    },
    [rows],
  )

  // ─── Cruzamento realizado × meta (nunca inventa: sem casamento → 0/—) ─────

  const linhas = useMemo<ProgramacaoLinha[]>(() => {
    // índices das dimensões (alias_norm → equipe_ids; nome/lider norm → equipe)
    const membrosPorAlias = new Map<string, string[]>()
    for (const m of aliasMembros) {
      const list = membrosPorAlias.get(m.alias_id) ?? []
      list.push(m.equipe_id)
      membrosPorAlias.set(m.alias_id, list)
    }
    const equipeIdsPorAliasNorm = new Map<string, string[]>()
    for (const a of aliases) {
      const ids = membrosPorAlias.get(a.id) ?? []
      if (ids.length > 0) equipeIdsPorAliasNorm.set(a.alias_norm, ids)
    }
    const wcrPorNomeNorm = new Map<string, WcrEquipeDb>()
    const wcrPorId = new Map<string, WcrEquipeDb>()
    for (const e of wcrEquipes) {
      wcrPorNomeNorm.set(normTxt(e.nome), e)
      wcrPorId.set(e.id, e)
    }

    return rows.map((r) => {
      const candidatos = candidatosDaEquipe(r.equipe)

      // equipes-alvo resolvidas pelo texto livre (alias exato + wcr_equipes exato)
      const alvoIds = new Set<string>()
      for (const c of candidatos) {
        for (const id of equipeIdsPorAliasNorm.get(c) ?? []) alvoIds.add(id)
        const eq = wcrPorNomeNorm.get(c)
        if (eq) alvoIds.add(eq.id)
      }

      // badge COMPROMISSO: responsavel do lps_tasks × equipe/líder da linha
      const nomesCompromisso = new Set<string>(candidatos)
      for (const id of alvoIds) {
        const eq = wcrPorId.get(id)
        if (eq?.lider) {
          const liderNorm = normTxt(eq.lider.replace(/\([^)]*\)/g, ' '))
          if (liderNorm) nomesCompromisso.add(liderNorm)
        }
        if (eq) nomesCompromisso.add(normTxt(eq.nome))
      }
      const temCompromissoLps = lpsResponsaveis.some((resp) => nomesCompromisso.has(resp))

      const colunas = colunasDaMeta(r.servico, r.meta_unidade)
      if (colunas.length === 0) {
        return {
          id: r.id,
          semanaIni: r.semana_ini,
          semanaFim: r.semana_fim,
          frente: r.frente,
          equipe: r.equipe,
          servico: r.servico,
          metaQtd: r.meta_qtd != null ? Number(r.meta_qtd) : null,
          metaUnidade: r.meta_unidade,
          obs: r.obs && r.obs.trim() ? r.obs.trim() : null,
          realizado: null,
          colunas,
          linhasCasadas: 0,
          temCompromissoLps,
        }
      }

      // soma casada: por equipe_id_resolvida entra com o peso do rateio; por
      // nome inteiro os pesos da mesma linha física somam 1 — sem dupla contagem
      let soma = 0
      const idsCasados = new Set<string>()
      for (const p of producao) {
        const casaPorId = p.equipe_id_resolvida !== null && alvoIds.has(p.equipe_id_resolvida)
        const casaPorNome = p.equipe_nome !== null && candidatos.includes(normTxt(p.equipe_nome))
        if (!casaPorId && !casaPorNome) continue
        const peso = p.peso == null ? 1 : num(p.peso)
        const qtd = colunas.reduce((s, col) => s + num((p as unknown as Record<string, unknown>)[col]), 0)
        soma += qtd * peso
        idsCasados.add(p.id)
      }

      return {
        id: r.id,
        semanaIni: r.semana_ini,
        semanaFim: r.semana_fim,
        frente: r.frente,
        equipe: r.equipe,
        servico: r.servico,
        metaQtd: r.meta_qtd != null ? Number(r.meta_qtd) : null,
        metaUnidade: r.meta_unidade,
        obs: r.obs && r.obs.trim() ? r.obs.trim() : null,
        realizado: Math.round(soma * 10) / 10,
        colunas,
        linhasCasadas: idsCasados.size,
        temCompromissoLps,
      }
    })
  }, [rows, producao, aliases, aliasMembros, wcrEquipes, lpsResponsaveis])

  // ─── Opções do select de equipe (wcr_equipes ativas) ─────────────────────

  const equipesAtivas = useMemo<EquipeAtivaOption[]>(
    () =>
      wcrEquipes
        .filter((e) => e.ativo)
        .map((e) => ({ id: e.id, nome: e.nome, lider: e.lider ?? '' }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [wcrEquipes],
  )

  // ─── Agrupamento por frente (contrato antigo do Kanban, mantido) ─────────

  const frentes = useMemo((): FrenteProgramada[] => {
    const porFrente = new Map<string, Map<string, ServicoProgramado[]>>()
    for (const r of rows) {
      if (!porFrente.has(r.frente)) porFrente.set(r.frente, new Map())
      const eqMap = porFrente.get(r.frente)!
      if (!eqMap.has(r.equipe)) eqMap.set(r.equipe, [])
      eqMap.get(r.equipe)!.push({
        servico: r.servico,
        metaQtd: r.meta_qtd != null ? Number(r.meta_qtd) : null,
        metaUnidade: r.meta_unidade,
        obs: r.obs && r.obs.trim() ? r.obs.trim() : null,
      })
    }
    const lista: FrenteProgramada[] = Array.from(porFrente.entries()).map(([frente, eqMap]) => ({
      frente,
      equipes: Array.from(eqMap.entries()).map(([equipe, servicos]) => ({ equipe, servicos })),
    }))
    lista.sort((a, b) => {
      const ia = ORDEM_FRENTE.indexOf(a.frente)
      const ib = ORDEM_FRENTE.indexOf(b.frente)
      if (ia === -1 && ib === -1) return a.frente.localeCompare(b.frente)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    return lista
  }, [rows])

  return {
    frentes,
    linhas,
    equipesAtivas,
    semanaIni,
    semanaFim,
    loading,
    error,
    reload: load,
    criarLinha,
    atualizarLinha,
    excluirLinha,
  }
}
