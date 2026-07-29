import { format, startOfWeek, subWeeks } from 'date-fns'
import type { AgendaTask, AgendaResource } from '@/types'

/**
 * Janela inicial do Gantt da Agenda.
 *
 * Era uma data fixa de mock ('2025-03-17'): quem abria a Agenda caía em março
 * de 2025 e não via NENHUMA tarefa da obra — elas ficavam fora da tela, e a
 * impressão era de agenda vazia. Agora a janela abre na semana atual, uma
 * semana atrás, que é onde o trabalho está: a segunda-feira anterior à de hoje
 * (dá contexto do que acabou de passar sem esconder o que vem).
 *
 * `startOfWeek` com weekStartsOn: 1 garante segunda-feira, que é o que o resto
 * do Gantt assume (viewStart é sempre uma segunda).
 */
export const INITIAL_VIEW_START = format(
  subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1),
  'yyyy-MM-dd',
)
export const INITIAL_VISIBLE_WEEKS = 0

export const mockResources: AgendaResource[] = []

export const mockTasks: AgendaTask[] = []
