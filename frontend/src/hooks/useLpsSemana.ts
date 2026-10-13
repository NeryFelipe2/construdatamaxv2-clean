/**
 * useLpsSemana.ts — PPC/CNC REAIS + comprometer/fechar semana (Frente B1, 27/07).
 *
 * Fontes (todas verificadas via REST em 27/07):
 *   vw_ppc_semana_equipe  — PPC por (project_id, semana_iso, responsavel);
 *     a view JÁ filtra semanas sem evidência de produção, matando o falso-alto
 *     da carga histórica de 14/07 (1.980 lps_tasks W15-W27).
 *   vw_cnc_pareto         — pareto de causas (project_id, cnc_categoria, n).
 *   vw_produtividade_real — ritmos reais por equipe/etapa (62 ritmos, 36 dias
 *     de obra). Usada SÓ como sugestão de meta no wizard — nunca gravada sem
 *     confirmação do usuário.
 *   lps_tasks             — compromissos da semana (comprometida/concluida/cnc).
 *   replanejamentos       — colunas verificadas por insert real em 27/07:
 *     id, projeto_id, planejamento_origem_id, ml_execucao_id, status, motivo,
 *     sugestoes (array json), metricas (jsonb), validado_por, validado_em,
 *     payload (jsonb), created_at, updated_at.
 *   guia_progresso        — criada pela frente B2 (colunas verificadas:
 *     id, projeto_id, passo, status, semana_iso, nota, concluido_em); o insert
 *     daqui é best-effort com try/catch (se o schema da B2 divergir, ignora).
 *
 * REGRA DO REPO: `supabase` PODE SER NULL — toda função retorna null/erro
 * honesto nesse caso, nunca dado inventado.
 */
import { supabase } from '@/lib/supabase'
import { isoWeek } from '@/store/lpsStore'

// ─── Taxonomia CNC oficial (união de tipos do banco) ────────────────────────

export type CncCategoriaOficial =
  | 'mao de obra'
  | 'material'
  | 'equipamento'
  | 'clima'
  | 'projeto/sabesp'
  | 'interferencia/moradores'
  | 'retrabalho'
  | 'planejamento'

export const CNC_CATEGORIAS_OFICIAIS: { value: CncCategoriaOficial; label: string }[] = [
  { value: 'mao de obra',              label: 'Mão de obra' },
  { value: 'material',                 label: 'Material' },
  { value: 'equipamento',              label: 'Equipamento' },
  { value: 'clima',                    label: 'Clima' },
  { value: 'projeto/sabesp',           label: 'Projeto/Sabesp' },
  { value: 'interferencia/moradores',  label: 'Interferência/moradores' },
  { value: 'retrabalho',               label: 'Retrabalho' },
  { value: 'planejamento',             label: 'Planejamento' },
]

export function rotuloCnc(categoria: string | null): string {
  const hit = CNC_CATEGORIAS_OFICIAIS.find((c) => c.value === categoria)
  return hit ? hit.label : (categoria ?? '—')
}

// ─── Semana ISO / dias úteis ────────────────────────────────────────────────

/** Semana ISO corrente no formato do banco (IYYY-"W"IW, ex.: '2026-W31'). */
export function semanaIsoAtual(): string {
  return isoWeek(new Date())
}

/**
 * Dias úteis RESTANTES na semana corrente, incluindo hoje. A obra roda
 * seg–sáb (rotina do bot é seg–sáb), então: seg=6 … sáb=1, dom=0.
 */
export function diasUteisRestantes(hoje: Date = new Date()): number {
  const dow = hoje.getDay() // 0=dom, 1=seg … 6=sáb
  if (dow === 0) return 0
  return 6 - (dow - 1)
}

// ─── Tipos das fontes ───────────────────────────────────────────────────────

export interface PpcSemanaEquipe {
  project_id: string
  semana_iso: string
  responsavel: string | null
  planejadas: number
  concluidas: number
  ppc: number
}

export interface CncParetoRow {
  project_id: string
  cnc_categoria: string
  n: number
}

export interface ProdutividadeRealRow {
  equipe_id: string
  etapa: string
  qtd_total: number
  dias: number
  ritmo_dia: number
  de: string
  ate: string
}

/** Linha de lps_tasks vista pelo fechamento (subset das colunas reais). */
export interface CompromissoSemana {
  id: string
  semana_iso: string
  task_name: string
  responsavel: string | null
  comprometida: boolean | null
  concluida: boolean | null
  cnc_categoria: string | null
  motivo_nao_conclusao: string | null
  metros_planejados: number | null
  metros_executados: number | null
}

// ─── Leituras (null = fonte indisponível; [] = vazio genuíno) ───────────────

export async function carregarPpcSemanaEquipe(projectId: string): Promise<PpcSemanaEquipe[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('vw_ppc_semana_equipe')
    .select('project_id, semana_iso, responsavel, planejadas, concluidas, ppc')
    .eq('project_id', projectId)
    .order('semana_iso')
  if (error || !data) return null
  return data as PpcSemanaEquipe[]
}

export async function carregarCncPareto(projectId: string): Promise<CncParetoRow[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('vw_cnc_pareto')
    .select('project_id, cnc_categoria, n')
    .eq('project_id', projectId)
    .order('n', { ascending: false })
  if (error || !data) return null
  return data as CncParetoRow[]
}

export async function carregarProdutividadeReal(): Promise<ProdutividadeRealRow[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('vw_produtividade_real')
    .select('equipe_id, etapa, qtd_total, dias, ritmo_dia, de, ate')
  if (error || !data) return null
  return data as ProdutividadeRealRow[]
}

export async function carregarCompromissosSemana(
  projectId: string,
  semanaIso: string,
): Promise<CompromissoSemana[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('lps_tasks')
    .select('id, semana_iso, task_name, responsavel, comprometida, concluida, cnc_categoria, motivo_nao_conclusao, metros_planejados, metros_executados')
    .eq('project_id', projectId)
    .eq('semana_iso', semanaIso)
    .eq('comprometida', true)
    .order('responsavel')
  if (error || !data) return null
  return data as CompromissoSemana[]
}

// ─── Sugestão de meta (vw_produtividade_real) ───────────────────────────────

export interface SugestaoMeta {
  metrosDia: number
  diasUteis: number
  total: number
  /** id efetivamente encontrado na view (pode ser o id "pai" sem sufixo romano). */
  equipeIdUsado: string
  etapas: string[]
}

/**
 * Ritmo de METROS/dia da equipe (rede_agua_m + rede_esgoto_m) na
 * vw_produtividade_real. A view guarda ritmos por ids históricos (ex.:
 * 'eq-damiao'), enquanto a reorganização de 22/07 criou variantes com sufixo
 * romano ('eq-damiao-i'/'eq-damiao-ii') — por isso o fallback tira o sufixo
 * `-i/-ii/-iii` antes de desistir. Sem ritmo de metros → null (o wizard deixa
 * a meta em branco pro usuário preencher; nunca inventamos número).
 */
export function sugerirMetaMetros(
  rows: ProdutividadeRealRow[],
  equipeId: string,
  diasUteis: number,
): SugestaoMeta | null {
  if (diasUteis <= 0) return null
  const candidatos = [equipeId, equipeId.replace(/-i{1,3}$/, '')]
  for (const id of candidatos) {
    const metros = rows.filter(
      (r) => r.equipe_id === id && (r.etapa === 'rede_agua_m' || r.etapa === 'rede_esgoto_m'),
    )
    if (metros.length > 0) {
      const metrosDia = metros.reduce((s, r) => s + Number(r.ritmo_dia || 0), 0)
      if (metrosDia <= 0) continue
      return {
        metrosDia: Math.round(metrosDia * 10) / 10,
        diasUteis,
        total: Math.round(metrosDia * diasUteis),
        equipeIdUsado: id,
        etapas: metros.map((r) => r.etapa),
      }
    }
  }
  return null
}

// ─── COMPROMETER SEMANA (wizard do SemaforoPanel) ───────────────────────────

export interface LinhaCompromisso {
  taskName: string
  responsavel: string
  metrosPlanejados: number
}

/**
 * Cria os compromissos da semana em lps_tasks (comprometida=true,
 * ready_status='pronta'). Validação bloqueante fica no wizard; aqui só
 * defendemos de novo (sem responsável ou meta ≤ 0 → erro, nada gravado).
 */
export async function comprometerSemana(
  projectId: string,
  semanaIso: string,
  linhas: LinhaCompromisso[],
): Promise<{ ok: boolean; erro?: string }> {
  if (!supabase) return { ok: false, erro: 'Supabase não configurado — impossível gravar em lps_tasks.' }
  if (linhas.length === 0) return { ok: false, erro: 'Nenhuma equipe selecionada.' }
  const invalida = linhas.find((l) => !l.responsavel.trim() || !(l.metrosPlanejados > 0))
  if (invalida) {
    return { ok: false, erro: `"${invalida.taskName}": responsável e meta (> 0) são obrigatórios.` }
  }
  const agora = new Date().toISOString()
  const { error } = await supabase.from('lps_tasks').insert(
    linhas.map((l) => ({
      id: crypto.randomUUID(),
      project_id: projectId,
      semana_iso: semanaIso,
      task_name: l.taskName.trim(),
      responsavel: l.responsavel.trim(),
      comprometida: true,
      concluida: false,
      ready_status: 'pronta',
      metros_planejados: l.metrosPlanejados,
      updated_at: agora,
    })),
  )
  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}

// ─── FECHAR SEMANA (PpcDashboard) ───────────────────────────────────────────

export interface DecisaoFechamento {
  id: string
  taskName: string
  responsavel: string | null
  concluida: boolean
  /** Obrigatória quando NÃO concluída (validação bloqueante na UI). */
  cncCategoria?: CncCategoriaOficial
  /** Obrigatório quando NÃO concluída (validação bloqueante na UI). */
  motivo?: string
}

export interface ResultadoFechamento {
  ok: boolean
  ppc: number
  total: number
  concluidas: number
  replanejamentoCriado: boolean
  erros: string[]
}

/**
 * Fecha a semana: grava concluída/CNC em cada compromisso; se PPC < 80%,
 * insere uma linha PENDENTE em `replanejamentos` (validado_por/validado_em
 * ficam null até alguém validar); por fim tenta registrar o passo em
 * `guia_progresso` (tabela da frente B2 — best-effort).
 */
export async function fecharSemana(
  projectId: string,
  semanaIso: string,
  decisoes: DecisaoFechamento[],
): Promise<ResultadoFechamento> {
  const vazio: ResultadoFechamento = { ok: false, ppc: 0, total: 0, concluidas: 0, replanejamentoCriado: false, erros: [] }
  if (!supabase) return { ...vazio, erros: ['Supabase não configurado — impossível fechar a semana.'] }
  if (decisoes.length === 0) return { ...vazio, erros: ['Nenhum compromisso para fechar.'] }

  // Defesa em profundidade: não-concluída sem CNC + motivo não passa daqui.
  const pendente = decisoes.find((d) => !d.concluida && (!d.cncCategoria || !d.motivo?.trim()))
  if (pendente) {
    return { ...vazio, erros: [`"${pendente.taskName}": CNC e motivo são obrigatórios para não-concluída.`] }
  }

  const agora = new Date().toISOString()
  const erros: string[] = []

  for (const d of decisoes) {
    const { error } = await supabase
      .from('lps_tasks')
      .update({
        concluida: d.concluida,
        // Semântica do semáforo: concluída → verde; não cumprida → vermelho.
        ready_status: d.concluida ? 'green' : 'red',
        cnc_categoria: d.concluida ? null : d.cncCategoria,
        motivo_nao_conclusao: d.concluida ? null : d.motivo?.trim(),
        updated_at: agora,
      })
      .eq('id', d.id)
    if (error) erros.push(`"${d.taskName}": ${error.message}`)
  }

  const total = decisoes.length
  const concluidas = decisoes.filter((d) => d.concluida).length
  const ppc = total > 0 ? Math.round((concluidas / total) * 100) : 0

  let replanejamentoCriado = false
  if (erros.length === 0 && ppc < 80) {
    // Resumo honesto das causas registradas neste fechamento.
    const porCnc = new Map<string, number>()
    for (const d of decisoes) {
      if (!d.concluida && d.cncCategoria) porCnc.set(d.cncCategoria, (porCnc.get(d.cncCategoria) ?? 0) + 1)
    }
    const causas = [...porCnc.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, n]) => `${rotuloCnc(cat)} (${n}×)`)
    const { error } = await supabase.from('replanejamentos').insert({
      projeto_id: projectId,
      status: 'pendente',
      motivo:
        `PPC ${ppc}% na semana ${semanaIso} (meta 80%): ${concluidas} de ${total} compromissos concluídos. ` +
        (causas.length > 0 ? `Causas: ${causas.join(', ')}.` : 'Sem causa registrada.'),
      sugestoes: causas.map((c) => `Tratar causa "${c}" — motivos detalhados nos compromissos da ${semanaIso} (lps_tasks)`),
      metricas: { semana_iso: semanaIso, ppc, planejadas: total, concluidas },
    })
    if (error) erros.push(`replanejamentos: ${error.message}`)
    else replanejamentoCriado = true
  }

  // Registro no trilho guiado (guia_progresso é da frente B2): best-effort —
  // se a tabela/colunas divergirem do verificado em 27/07, apenas ignoramos.
  try {
    await supabase.from('guia_progresso').insert({
      projeto_id: projectId,
      passo: 'fechar-semana',
      status: 'concluido',
      semana_iso: semanaIso,
      nota: `PPC ${ppc}% — ${concluidas}/${total} compromissos concluídos`,
      concluido_em: agora,
    })
  } catch {
    // Tabela pertence à frente B2 — erro aqui não pode travar o fechamento.
  }

  return { ok: erros.length === 0, ppc, total, concluidas, replanejamentoCriado, erros }
}
