/**
 * useLpsTasks.ts — persistência das atividades semanais do LPS (semáforo/PPC,
 * a "meta verdinho") em `lps_tasks` no Supabase. Mesmo padrão fire-and-forget
 * de useMasterActivities/usePlanTrechosTeams: escrita otimista sem bloquear a
 * UI, leitura na carga do projeto.
 *
 * Mapeamento LpsActivity ↔ lps_tasks:
 *   week↔semana_iso · description↔task_name · responsibleTeam↔responsavel
 *   planned↔comprometida · completed↔concluida · cncDescription↔motivo_nao_conclusao
 *   trechoCode↔trecho_code · readyStatus↔ready_status · cncCategory↔cnc_categoria
 *   plannedMeters↔metros_planejados · executedMeters↔metros_executados
 */
import { supabase } from '@/lib/supabase'
import type { LpsActivity, LpsCncCategory, LpsReadyStatus } from '@/types'

interface DbLpsTask {
  id: string
  semana_iso: string
  task_name: string
  responsavel: string | null
  comprometida: boolean | null
  concluida: boolean | null
  motivo_nao_conclusao: string | null
  trecho_code: string | null
  ready_status: string | null
  cnc_categoria: string | null
  metros_planejados: number | null
  metros_executados: number | null
}

/**
 * Carrega as atividades LPS do projeto. Retorna `null` quando a leitura FALHA
 * (Supabase indisponível/erro — o chamador mantém o fallback atual) e `[]`
 * quando o banco está genuinamente vazio (o chamador deve mostrar vazio, sem
 * deixar dado de outro projeto/mocks vazarem).
 */
export async function carregarLpsTasks(projectId: string): Promise<LpsActivity[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('lps_tasks')
    .select('id, semana_iso, task_name, responsavel, comprometida, concluida, motivo_nao_conclusao, trecho_code, ready_status, cnc_categoria, metros_planejados, metros_executados')
    .eq('project_id', projectId)
    .order('semana_iso')
  if (error || !data) return null
  return (data as DbLpsTask[]).map((r) => ({
    id: r.id,
    week: r.semana_iso,
    trechoCode: r.trecho_code ?? '',
    description: r.task_name,
    planned: r.comprometida ?? true,
    completed: r.concluida ?? false,
    readyStatus: (r.ready_status as LpsReadyStatus) ?? 'green',
    cncCategory: (r.cnc_categoria as LpsCncCategory) ?? undefined,
    cncDescription: r.motivo_nao_conclusao ?? undefined,
    responsibleTeam: r.responsavel ?? undefined,
    plannedMeters: r.metros_planejados != null ? Number(r.metros_planejados) : undefined,
    executedMeters: r.metros_executados != null ? Number(r.metros_executados) : undefined,
  }))
}

/** Grava (upsert) uma atividade — fire-and-forget, sem await no chamador. */
export function salvarLpsTask(projectId: string, a: LpsActivity): void {
  if (!supabase) return
  supabase
    .from('lps_tasks')
    .upsert({
      id: a.id,
      project_id: projectId,
      semana_iso: a.week,
      task_name: a.description,
      responsavel: a.responsibleTeam ?? null,
      comprometida: a.planned,
      concluida: a.completed,
      motivo_nao_conclusao: a.cncDescription ?? null,
      trecho_code: a.trechoCode || null,
      ready_status: a.readyStatus,
      cnc_categoria: a.cncCategory ?? null,
      metros_planejados: a.plannedMeters ?? null,
      metros_executados: a.executedMeters ?? null,
      updated_at: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) console.error('Erro ao salvar atividade LPS:', error.message)
    })
}

/** Remove uma atividade por id — fire-and-forget. */
export function removerLpsTask(id: string): void {
  if (!supabase) return
  supabase
    .from('lps_tasks')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) console.error('Erro ao remover atividade LPS:', error.message)
    })
}
