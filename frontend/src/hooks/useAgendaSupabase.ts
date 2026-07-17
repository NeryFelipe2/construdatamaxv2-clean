/**
 * useAgendaSupabase.ts — persistência real do módulo Agenda/Gantt em
 * `agenda_tasks`, mesmo padrão fire-and-forget de usePlanTrechosTeams.ts
 * (carregar* nunca lança, salvar* / remover* não são aguardados pelo
 * chamador — o store faz update otimista e chama essas funções depois).
 *
 * Recursos (`AgendaResource`) são reaproveitados de `wcr_equipes` (crew) e
 * `wcr_veiculos` (equipment) — não existe tabela própria de recurso, como
 * recomendado na investigação do módulo. Duas "frentes agregadas" também
 * entram como recurso tipo 'other': elas existem porque o único ritmo real
 * mensurável hoje (metros/dia) é agregado de TODAS as equipes de rede de um
 * sistema — nenhuma equipe individual tem produção atribuível por nome no
 * apontamento (ver observacao das tarefas 'calculado' em agenda_tasks). Sem
 * essas duas linhas, as 2 únicas tarefas com projeção de prazo real não
 * apareceriam em nenhuma linha do Gantt.
 */
import { supabase } from '@/lib/supabase'
import type { AgendaTask, AgendaResource, TaskColor, AgendaPriority } from '@/types'

interface DbAgendaTask {
  id: string
  projeto_id: string | null
  equipe_id: string | null
  resource_type: 'crew' | 'equipment' | 'other'
  sistema: 'AGUA' | 'ESGOTO' | null
  titulo: string
  descricao: string | null
  data_inicio: string
  data_fim: string | null
  status: 'scheduled' | 'unscheduled' | 'completed'
  prioridade: AgendaPriority
  cor: TaskColor
  origem: 'calculado' | 'manual'
  metros_alvo: number | null
  ritmo_diario_m: number | null
  responsavel: string | null
  encarregado: string | null
  observacao: string | null
}

const TASK_COLUMNS =
  'id, projeto_id, equipe_id, resource_type, sistema, titulo, descricao, data_inicio, data_fim, ' +
  'status, prioridade, cor, origem, metros_alvo, ritmo_diario_m, responsavel, encarregado, observacao'

/**
 * Duas frentes agregadas (não são equipes de `wcr_equipes`) — ver comentário
 * de topo. `code` curto só pro badge do Gantt; `id` bate com o `equipe_id`
 * sintético usado nas 2 tarefas de projeção calculada em `agenda_tasks`.
 */
const FRENTES_AGREGADAS: AgendaResource[] = [
  { id: 'frente-agua-boi-malhado', code: 'ÁGUA', name: 'Frente Água — Boi Malhado (agregado)', type: 'other', status: 'active' },
  { id: 'frente-esgoto-boi-malhado', code: 'ESGOTO', name: 'Frente Esgoto — Boi Malhado (agregado)', type: 'other', status: 'active' },
]

function dbTaskToAgendaTask(row: DbAgendaTask): AgendaTask {
  const endDateUnknown = row.data_fim === null
  const notes = [row.descricao, row.observacao].filter((v): v is string => !!v && v.trim().length > 0).join('\n\n')

  return {
    id: row.id,
    title: row.titulo,
    resourceId: row.equipe_id ?? '',
    startDate: row.data_inicio,
    // GanttBar/getBarStyle exigem endDate real pra desenhar a barra (parseISO
    // sem null-check) — quando data_fim é NULL, usamos data_inicio como
    // placeholder de largura mínima (1 dia, via Math.max em getBarStyle) e
    // marcamos endDateUnknown pra quem quiser diferenciar. NÃO é uma
    // projeção de prazo, só um requisito técnico de renderização.
    endDate: row.data_fim ?? row.data_inicio,
    endDateUnknown,
    color: row.cor,
    status: row.status,
    priority: row.prioridade,
    assignedTo: row.responsavel ?? undefined,
    teamLeadName: row.encarregado ?? undefined,
    location: row.sistema === 'AGUA' ? 'Água' : row.sistema === 'ESGOTO' ? 'Esgoto' : undefined,
    linkedProjectId: row.projeto_id ?? undefined,
    notes: notes.length > 0 ? notes : undefined,
  }
}

/** Carrega todas as tarefas reais da Agenda. Nunca lança — retorna [] se o Supabase não estiver configurado ou a query falhar. */
export async function carregarAgendaTasks(): Promise<AgendaTask[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('agenda_tasks')
      .select(TASK_COLUMNS)
      .order('data_inicio', { ascending: true })
    if (error || !data) return []
    return (data as DbAgendaTask[]).map(dbTaskToAgendaTask)
  } catch {
    return []
  }
}

interface DbWcrEquipeLite { id: string; nome: string; ativo: boolean }
interface DbWcrVeiculoLite { id: string; placa: string | null; tipo: string | null; ativo: boolean }

/** Carrega recursos reais (equipes + frota + frentes agregadas). Nunca lança — cai pras frentes agregadas se o Supabase falhar. */
export async function carregarAgendaResources(): Promise<AgendaResource[]> {
  if (!supabase) return [...FRENTES_AGREGADAS]
  try {
    const [equipesRes, veiculosRes] = await Promise.all([
      supabase.from('wcr_equipes').select('id, nome, ativo').eq('ativo', true).order('ordem'),
      supabase.from('wcr_veiculos').select('id, placa, tipo, ativo').eq('ativo', true).order('ordem'),
    ])

    const equipes: AgendaResource[] = ((equipesRes.data ?? []) as DbWcrEquipeLite[]).map((e) => ({
      id: e.id,
      code: e.id,
      name: e.nome,
      type: 'crew',
      status: e.ativo ? 'active' : 'inactive',
    }))

    const veiculos: AgendaResource[] = ((veiculosRes.data ?? []) as DbWcrVeiculoLite[]).map((v) => ({
      id: v.id,
      code: v.placa ?? v.id,
      name: v.tipo ? `${v.tipo} — ${v.placa ?? v.id}` : (v.placa ?? v.id),
      type: 'equipment',
      status: v.ativo ? 'active' : 'inactive',
    }))

    return [...FRENTES_AGREGADAS, ...equipes, ...veiculos]
  } catch {
    return [...FRENTES_AGREGADAS]
  }
}

/**
 * Grava (upsert) uma tarefa — fire-and-forget, sem await no chamador.
 * Qualquer save vindo do front (dialog, drag, resize) é por definição uma
 * ação humana, então `origem` sempre vira 'manual' — a projeção 'calculado'
 * original só existe até a primeira edição. `metros_alvo`/`ritmo_diario_m`/
 * `sistema`/`descricao` ficam de fora do payload de propósito: como o
 * AgendaTask do front não carrega esses campos, omiti-los preserva o valor
 * anterior no UPDATE (não zera a base de cálculo original) e cai no default
 * da coluna no INSERT.
 */
export function salvarAgendaTask(task: AgendaTask): void {
  if (!supabase) return
  supabase
    .from('agenda_tasks')
    .upsert(
      {
        id: task.id,
        equipe_id: task.resourceId || null,
        projeto_id: task.linkedProjectId || null,
        titulo: task.title,
        data_inicio: task.startDate,
        data_fim: task.endDate,
        status: task.status,
        prioridade: task.priority,
        cor: task.color,
        origem: 'manual',
        responsavel: task.assignedTo ?? null,
        encarregado: task.teamLeadName ?? null,
        observacao: task.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .then(({ error }) => {
      if (error) console.error('Erro ao salvar tarefa da agenda:', error.message)
    })
}

/** Remove uma tarefa por id — fire-and-forget. */
export function removerAgendaTask(id: string): void {
  if (!supabase) return
  supabase
    .from('agenda_tasks')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) console.error('Erro ao remover tarefa da agenda:', error.message)
    })
}
