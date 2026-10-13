/**
 * guiaStore.ts — TRILHO GUIADO da semana (Fase 3 do plano "LPS de verdade").
 *
 * O trilho é uma CAMADA por cima das telas existentes, nunca uma gaiola:
 * nenhuma rota é bloqueada — ele só mostra, em 5 passos (P1..P5), o ciclo
 * semanal do Last Planner na linguagem da obra, com checagens REAIS no banco.
 *
 * Origem do status de cada passo (readiness checks — SEMPRE contagem real,
 * nunca número inventado; sem Supabase → erro declarado no card):
 *   P1 metas_producao  — existe meta cobrindo a semana corrente
 *   P2 lps_restricoes  — nenhuma 'identificada' com prazo estourando em ≤7 dias
 *      (inclui as sem projeto_id — a carga de 27/07 tem 12 restrições globais)
 *   P3 lps_tasks       — existe comprometida na semana com responsável E meta
 *   P4 producao_diaria — existe apontamento hoje (domingo → olha o sábado)
 *   P5 lps_tasks       — semana anterior 100% respondida (concluída sim/não)
 *
 * 'concluido' é sempre COMPUTADO pelas checagens; o único status manual é
 * 'pulado' (só gerente, exige nota de 1 linha), persistido em `guia_progresso`
 * via upsert por (projeto_id, semana_iso, passo) — padrão otimista com revert.
 *
 * persist (zustand/middleware): só { papel, trilhoVisivel } — status de passo
 * NUNCA é persistido no browser (seria número velho fingindo ser atual).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

export type GuiaPapel = 'estagiario' | 'gerente'
export type GuiaPassoId = 'p1' | 'p2' | 'p3' | 'p4' | 'p5'
export type GuiaPassoStatus = 'pendente' | 'em_andamento' | 'concluido' | 'pulado'

/** Uma linha do checklist do gate — contagem real lida do banco. */
export interface GuiaCheckItem {
  label: string
  valor: number
  ok: boolean
}

export interface GuiaPassoEstado {
  status: GuiaPassoStatus
  checks: GuiaCheckItem[]
  /** Nota de 1 linha exigida quando o gerente pula o passo. */
  notaPulo: string | null
  /** Falha de leitura (Supabase fora/id demo) — declarada, nunca escondida. */
  erro: string | null
}

export interface GuiaPassoDef {
  id: GuiaPassoId
  ordem: number
  titulo: string
  /** Instrução de 3 linhas, em linguagem de obra. */
  instrucao: [string, string, string]
  /** Versão de 1 linha usada no ribbon de contexto (?guia=pN). */
  instrucaoCurta: string
  /** Deep-link pra tela onde o passo é executado (com ?guia=pN). */
  deepLink: string
  /** Rótulo do botão de deep-link. */
  botao: string
  /** Tabela-fonte declarada no card (9px, padrão Palantir do repo). */
  fonte: string
  /** Termos do glossário LPS relevantes pro passo (tooltip TermoLps). */
  termos: string[]
}

/** Cor do quadrado de status (linguagem visual oficial dark/mono/caps). */
export const COR_STATUS: Record<GuiaPassoStatus, string> = {
  concluido: '#22c55e',
  em_andamento: '#f59e0b',
  pendente: '#ef4444',
  pulado: '#64748b',
}

export const LABEL_STATUS: Record<GuiaPassoStatus, string> = {
  concluido: 'CONCLUÍDO',
  em_andamento: 'EM ANDAMENTO',
  pendente: 'PENDENTE',
  pulado: 'PULADO',
}

export const GUIA_PASSOS: GuiaPassoDef[] = [
  {
    id: 'p1',
    ordem: 1,
    titulo: 'PLANEJAR A SEMANA',
    instrucao: [
      'Toda segunda, antes da obra abrir: confira se a meta da semana existe e cobre até domingo.',
      'Sem meta cadastrada ninguém sabe quanto tem que produzir — o painel fica cego.',
      'Se a campanha venceu, cadastre a próxima no Planejamento Mestre antes de comprometer qualquer equipe.',
    ],
    instrucaoCurta: 'Confira se existe meta cadastrada cobrindo esta semana.',
    deepLink: '/app/planejamento-mestre?guia=p1',
    botao: 'ABRIR PLANEJAMENTO MESTRE',
    fonte: 'metas_producao',
    termos: ['baseline', 'lookahead'],
  },
  {
    id: 'p2',
    ordem: 2,
    titulo: 'REMOVER RESTRIÇÕES',
    instrucao: [
      'Olhe as restrições (material, máquina, morador, Sabesp) com prazo estourando nos próximos 7 dias.',
      'Restrição com prazo vencendo = frente parada na quinta-feira, equipe olhando pro buraco.',
      'Resolva, reatribua ou reagende cada uma ANTES de comprometer a semana no semáforo.',
    ],
    instrucaoCurta: 'Zere as restrições com prazo estourando em até 7 dias.',
    deepLink: '/app/lps-lean?tab=restricoes&guia=p2',
    botao: 'ABRIR RESTRIÇÕES',
    fonte: 'lps_restricoes',
    termos: ['restrição', 'IRR'],
  },
  {
    id: 'p3',
    ordem: 3,
    titulo: 'COMPROMETER A SEMANA',
    instrucao: [
      'Monte o semáforo da semana: cada tarefa comprometida precisa de um dono (encarregado) e um número (metros ou unidades).',
      'Compromisso sem dono ou sem número não é compromisso — é desejo.',
      'Prometeu, vai ser medido no fechamento: só comprometa o que está com a frente liberada.',
    ],
    instrucaoCurta: 'Comprometa tarefas da semana com responsável e meta.',
    deepLink: '/app/lps-lean?tab=semaforo&guia=p3',
    botao: 'ABRIR SEMÁFORO',
    fonte: 'lps_tasks',
    termos: ['compromisso', 'takt'],
  },
  {
    id: 'p4',
    ordem: 4,
    titulo: 'APONTAR O DIA',
    instrucao: [
      'Todo dia até as 17h o apontamento do dia tem que estar no RDO (WhatsApp ou digitado).',
      'Sem o apontamento de hoje, o painel de amanhã mente — e a medição atrasa junto.',
      'Domingo a obra não abre: a checagem olha o sábado.',
    ],
    instrucaoCurta: 'Garanta o apontamento de produção de hoje no RDO.',
    deepLink: '/app/rdo?guia=p4',
    botao: 'ABRIR RDO',
    fonte: 'producao_diaria',
    termos: ['NS', 'esteira'],
  },
  {
    id: 'p5',
    ordem: 5,
    titulo: 'FECHAR O PPC',
    instrucao: [
      'Sábado ou segunda cedo: marque o que foi concluído e o que NÃO foi — e o porquê (CNC).',
      'O PPC só vale se toda tarefa comprometida da semana passada tiver resposta sim/não.',
      'Tarefa sem resposta é indicador furado: ninguém aprende com pergunta em branco.',
    ],
    instrucaoCurta: 'Responda sim/não em toda comprometida da semana passada.',
    deepLink: '/app/lps-lean?tab=ppc&guia=p5',
    botao: 'ABRIR PPC',
    fonte: 'lps_tasks',
    termos: ['PPC', 'CNC'],
  },
]

// ─── Helpers de calendário (mesma matemática ISO do lpsStore, duplicada de
// propósito: importar o lpsStore aqui puxaria lib/api + hooks pro bundle do
// layout, onde a GuiaTrilhoBar mora) ─────────────────────────────────────────

function fmtIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** Semana ISO no formato '2026-W31' — igual ao usado em lps_tasks.semana_iso. */
export function isoSemanaGuia(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function segundaDaSemana(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay() || 7
  d.setDate(d.getDate() - (dow - 1))
  return d
}

// ─── Readiness checks (uma função por passo, todas com try/catch honesto) ────

function estadoSemSupabase(): GuiaPassoEstado {
  return {
    status: 'pendente',
    checks: [],
    notaPulo: null,
    erro: 'Supabase não configurado — checagem indisponível (0 leituras feitas)',
  }
}

function estadoErro(e: unknown): GuiaPassoEstado {
  return {
    status: 'pendente',
    checks: [],
    notaPulo: null,
    erro: e instanceof Error ? e.message : 'Falha na leitura do banco',
  }
}

/** P1 — existe meta em metas_producao cobrindo a semana corrente (seg→dom). */
async function checkP1(pid: string, iniSemana: string, fimSemana: string): Promise<GuiaPassoEstado> {
  if (!supabase) return estadoSemSupabase()
  try {
    const { data, error } = await supabase
      .from('metas_producao')
      .select('id')
      .eq('projeto_id', pid)
      .lte('periodo_ini', fimSemana)
      .gte('periodo_fim', iniSemana)
    if (error) throw error
    const n = (data ?? []).length
    return {
      status: n > 0 ? 'concluido' : 'pendente',
      checks: [{ label: 'metas cobrindo esta semana', valor: n, ok: n > 0 }],
      notaPulo: null,
      erro: null,
    }
  } catch (e) {
    return estadoErro(e)
  }
}

/** P2 — nenhuma lps_restricoes 'identificada' com prazo em ≤ 7 dias. */
async function checkP2(pid: string): Promise<GuiaPassoEstado> {
  if (!supabase) return estadoSemSupabase()
  try {
    const limite = new Date()
    limite.setDate(limite.getDate() + 7)
    const limiteIso = fmtIso(limite)
    const { data, error } = await supabase
      .from('lps_restricoes')
      .select('id, prazo')
      .eq('status', 'identificada')
      .or(`projeto_id.eq.${pid},projeto_id.is.null`)
    if (error) throw error
    const rows = (data ?? []) as Array<{ id: string; prazo: string | null }>
    // Estourando = prazo até hoje+7 (inclui as já vencidas, que são as piores).
    const estourando = rows.filter((r) => r.prazo && String(r.prazo).slice(0, 10) <= limiteIso).length
    return {
      status: estourando === 0 ? 'concluido' : 'pendente',
      checks: [
        { label: 'restrições estourando em ≤ 7 dias', valor: estourando, ok: estourando === 0 },
        { label: 'identificadas em aberto (contexto)', valor: rows.length, ok: true },
      ],
      notaPulo: null,
      erro: null,
    }
  } catch (e) {
    return estadoErro(e)
  }
}

/** P3 — existe lps_tasks comprometida na semana corrente com responsável e meta. */
async function checkP3(pid: string, semanaIso: string): Promise<GuiaPassoEstado> {
  if (!supabase) return estadoSemSupabase()
  try {
    const { data, error } = await supabase
      .from('lps_tasks')
      .select('id, responsavel, metros_planejados')
      .eq('project_id', pid)
      .eq('semana_iso', semanaIso)
      .eq('comprometida', true)
    if (error) throw error
    const rows = (data ?? []) as Array<{ id: string; responsavel: string | null; metros_planejados: number | null }>
    const comprometidas = rows.length
    const completas = rows.filter(
      (r) => (r.responsavel ?? '').trim() !== '' && r.metros_planejados != null,
    ).length
    return {
      status: completas > 0 ? 'concluido' : comprometidas > 0 ? 'em_andamento' : 'pendente',
      checks: [
        { label: `comprometidas na ${semanaIso}`, valor: comprometidas, ok: comprometidas > 0 },
        { label: 'com responsável E meta', valor: completas, ok: completas > 0 },
      ],
      notaPulo: null,
      erro: null,
    }
  } catch (e) {
    return estadoErro(e)
  }
}

/** P4 — existe producao_diaria hoje (domingo → sábado, a obra trabalha seg-sáb). */
async function checkP4(pid: string): Promise<GuiaPassoEstado> {
  if (!supabase) return estadoSemSupabase()
  try {
    const alvo = new Date()
    if (alvo.getDay() === 0) alvo.setDate(alvo.getDate() - 1)
    const alvoIso = fmtIso(alvo)
    const { data, error } = await supabase
      .from('producao_diaria')
      .select('id')
      .eq('projeto_id', pid)
      .eq('data', alvoIso)
    if (error) throw error
    const n = (data ?? []).length
    const [, m, d] = alvoIso.split('-')
    return {
      status: n > 0 ? 'concluido' : 'pendente',
      checks: [{ label: `apontamentos em ${d}/${m}`, valor: n, ok: n > 0 }],
      notaPulo: null,
      erro: null,
    }
  } catch (e) {
    return estadoErro(e)
  }
}

/** P5 — semana anterior: toda comprometida com concluída definida (sim/não). */
async function checkP5(pid: string, semanaAnterior: string): Promise<GuiaPassoEstado> {
  if (!supabase) return estadoSemSupabase()
  try {
    const { data, error } = await supabase
      .from('lps_tasks')
      .select('id, concluida')
      .eq('project_id', pid)
      .eq('semana_iso', semanaAnterior)
      .eq('comprometida', true)
    if (error) throw error
    const rows = (data ?? []) as Array<{ id: string; concluida: boolean | null }>
    const comprometidas = rows.length
    const respondidas = rows.filter((r) => r.concluida !== null).length
    // 0 comprometidas ≠ fechado: sem compromisso na semana passada não há PPC
    // pra fechar — fica pendente com contagem zero declarada (honesto).
    const status: GuiaPassoStatus =
      comprometidas === 0
        ? 'pendente'
        : respondidas === comprometidas
          ? 'concluido'
          : respondidas > 0
            ? 'em_andamento'
            : 'pendente'
    return {
      status,
      checks: [
        { label: `comprometidas na ${semanaAnterior}`, valor: comprometidas, ok: comprometidas > 0 },
        { label: 'respondidas (concluída sim/não)', valor: respondidas, ok: comprometidas > 0 && respondidas === comprometidas },
      ],
      notaPulo: null,
      erro: null,
    }
  } catch (e) {
    return estadoErro(e)
  }
}

/** Overrides manuais gravados em guia_progresso (só 'pulado' interessa). */
async function lerOverrides(
  pid: string,
  semanaIso: string,
): Promise<Partial<Record<GuiaPassoId, { nota: string | null }>>> {
  if (!supabase) return {}
  try {
    const { data, error } = await supabase
      .from('guia_progresso')
      .select('passo, status, nota')
      .eq('projeto_id', pid)
      .eq('semana_iso', semanaIso)
    if (error) throw error
    const out: Partial<Record<GuiaPassoId, { nota: string | null }>> = {}
    for (const r of (data ?? []) as Array<{ passo: string; status: string; nota: string | null }>) {
      if (r.status === 'pulado' && ['p1', 'p2', 'p3', 'p4', 'p5'].includes(r.passo)) {
        out[r.passo as GuiaPassoId] = { nota: r.nota }
      }
    }
    return out
  } catch {
    return {}
  }
}

// ─── Store ───────────────────────────────────────────────────────────────────

function passoInicial(): GuiaPassoEstado {
  return { status: 'pendente', checks: [], notaPulo: null, erro: null }
}

interface GuiaState {
  papel: GuiaPapel
  /** Barra fina no header (GuiaTrilhoBar) visível? Persistido. */
  trilhoVisivel: boolean
  semanaIso: string
  projetoId: string | null
  passos: Record<GuiaPassoId, GuiaPassoEstado>
  verificando: boolean
  ultimaVerificacao: string | null

  setPapel: (p: GuiaPapel) => void
  setTrilhoVisivel: (v: boolean) => void
  /** Roda as 5 checagens reais + lê os pulos gravados em guia_progresso. */
  verificar: (projetoId: string) => Promise<void>
  /** Gerente pula um passo com nota de 1 linha (upsert em guia_progresso). */
  pularPasso: (passo: GuiaPassoId, nota: string) => Promise<boolean>
  /** Desfaz um pulo (volta a valer a checagem computada). */
  despularPasso: (passo: GuiaPassoId) => Promise<boolean>
}

// Token de corrida: se o projeto trocar no meio de uma verificação, a antiga
// é descartada em vez de sobrescrever a nova (padrão staleness-guard do repo).
let runToken = 0

export const useGuiaStore = create<GuiaState>()(
  persist(
    (set, get) => ({
      papel: 'estagiario',
      trilhoVisivel: true,
      semanaIso: isoSemanaGuia(new Date()),
      projetoId: null,
      passos: { p1: passoInicial(), p2: passoInicial(), p3: passoInicial(), p4: passoInicial(), p5: passoInicial() },
      verificando: false,
      ultimaVerificacao: null,

      setPapel: (p) => set({ papel: p }),
      setTrilhoVisivel: (v) => set({ trilhoVisivel: v }),

      verificar: async (projetoId) => {
        if (!projetoId) return
        const token = ++runToken
        const agora = new Date()
        const semana = isoSemanaGuia(agora)
        const anterior = isoSemanaGuia(new Date(agora.getTime() - 7 * 86400000))
        const seg = segundaDaSemana(agora)
        const dom = new Date(seg)
        dom.setDate(dom.getDate() + 6)
        set({ verificando: true, projetoId, semanaIso: semana })
        const [p1, p2, p3, p4, p5] = await Promise.all([
          checkP1(projetoId, fmtIso(seg), fmtIso(dom)),
          checkP2(projetoId),
          checkP3(projetoId, semana),
          checkP4(projetoId),
          checkP5(projetoId, anterior),
        ])
        const overrides = await lerOverrides(projetoId, semana)
        if (token !== runToken) return // verificação mais nova em curso — descarta
        const passos: Record<GuiaPassoId, GuiaPassoEstado> = { p1, p2, p3, p4, p5 }
        for (const id of Object.keys(overrides) as GuiaPassoId[]) {
          passos[id] = { ...passos[id], status: 'pulado', notaPulo: overrides[id]?.nota ?? null }
        }
        set({ passos, verificando: false, ultimaVerificacao: new Date().toISOString() })
      },

      pularPasso: async (passo, nota) => {
        const { papel, projetoId, semanaIso, passos } = get()
        const notaLimpa = nota.trim()
        if (papel !== 'gerente' || !notaLimpa || !projetoId || !supabase) return false
        const anterior = passos[passo]
        // Otimista: pinta na hora, reverte se o banco recusar.
        set({ passos: { ...passos, [passo]: { ...anterior, status: 'pulado', notaPulo: notaLimpa } } })
        const { error } = await supabase.from('guia_progresso').upsert(
          {
            projeto_id: projetoId,
            semana_iso: semanaIso,
            passo,
            status: 'pulado',
            nota: notaLimpa,
            concluido_por: 'gerente',
            concluido_em: new Date().toISOString(),
          },
          { onConflict: 'projeto_id,semana_iso,passo' },
        )
        if (error) {
          set((s) => ({ passos: { ...s.passos, [passo]: anterior } }))
          return false
        }
        return true
      },

      despularPasso: async (passo) => {
        const { papel, projetoId, semanaIso } = get()
        if (papel !== 'gerente' || !projetoId || !supabase) return false
        const { error } = await supabase.from('guia_progresso').upsert(
          {
            projeto_id: projetoId,
            semana_iso: semanaIso,
            passo,
            status: 'pendente',
            nota: null,
            concluido_por: 'gerente',
            concluido_em: new Date().toISOString(),
          },
          { onConflict: 'projeto_id,semana_iso,passo' },
        )
        if (error) return false
        await get().verificar(projetoId)
        return true
      },
    }),
    {
      name: 'cdata-guia-trilho',
      // Só preferências: status é sempre recomputado do banco a cada visita.
      partialize: (s) => ({ papel: s.papel, trilhoVisivel: s.trilhoVisivel }),
    },
  ),
)
