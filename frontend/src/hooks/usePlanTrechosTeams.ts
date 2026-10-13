/**
 * usePlanTrechosTeams.ts — persistência do Planejamento (trechos/equipes) em
 * `plan_trechos` / `plan_teams`, mesmo padrão fire-and-forget de
 * useMasterActivities.ts (salvarProgramacaoDiaria) e useFrota.ts.
 *
 * `dados` (jsonb) guarda todos os campos do objeto exceto id/code (trecho) ou
 * id/name (team) — serialização fiel, nada sintetizado. Ao ler, reconstrói-se
 * `{ id, code, ...dados }` / `{ id, name, ...dados }`.
 */
import { supabase } from '@/lib/supabase'
import type { PlanTrecho, PlanTeam } from '@/types'

interface DbPlanTrecho {
  id: string
  code: string
  dados: Record<string, unknown>
}

interface DbPlanTeam {
  id: string
  name: string
  dados: Record<string, unknown>
}

/**
 * Carrega trechos + equipes reais do projeto. Nunca lança — se o Supabase
 * não estiver configurado ou a query falhar, retorna listas vazias (o
 * chamador decide o que fazer, ex.: manter o mock atual na tela).
 */
export async function carregarPlanTrechosTeams(
  projetoId: string,
): Promise<{ trechos: PlanTrecho[]; teams: PlanTeam[] }> {
  if (!supabase) return { trechos: [], teams: [] }
  try {
    const [trechosRes, teamsRes] = await Promise.all([
      supabase.from('plan_trechos').select('id, code, dados').eq('projeto_id', projetoId)
        .order('created_at', { ascending: true }),
      supabase.from('plan_teams').select('id, name, dados').eq('projeto_id', projetoId)
        .order('created_at', { ascending: true }),
    ])

    const trechos: PlanTrecho[] =
      trechosRes.error || !trechosRes.data
        ? []
        : (trechosRes.data as DbPlanTrecho[]).map(
            (row) => ({ ...(row.dados as object), id: row.id, code: row.code }) as PlanTrecho,
          )

    const teams: PlanTeam[] =
      teamsRes.error || !teamsRes.data
        ? []
        : (teamsRes.data as DbPlanTeam[]).map(
            (row) => ({ ...(row.dados as object), id: row.id, name: row.name }) as PlanTeam,
          )

    return { trechos, teams }
  } catch {
    return { trechos: [], teams: [] }
  }
}

/** Grava (upsert) um trecho — fire-and-forget, sem await no chamador. */
export function salvarPlanTrecho(projetoId: string, trecho: PlanTrecho): void {
  if (!supabase) return
  const { id, code, ...dados } = trecho
  supabase
    .from('plan_trechos')
    .upsert({ id, projeto_id: projetoId, code, dados, updated_at: new Date().toISOString() })
    .then(({ error }) => {
      if (error) console.error('Erro ao salvar trecho de planejamento:', error.message)
    })
}

/** Remove um trecho por id — fire-and-forget. */
export function removerPlanTrecho(id: string): void {
  if (!supabase) return
  supabase
    .from('plan_trechos')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) console.error('Erro ao remover trecho de planejamento:', error.message)
    })
}

/** Grava (upsert) uma equipe — fire-and-forget, sem await no chamador. */
export function salvarPlanTeam(projetoId: string, team: PlanTeam): void {
  if (!supabase) return
  const { id, name, ...dados } = team
  supabase
    .from('plan_teams')
    .upsert({ id, projeto_id: projetoId, name, dados, updated_at: new Date().toISOString() })
    .then(({ error }) => {
      if (error) console.error('Erro ao salvar equipe de planejamento:', error.message)
    })
}

/** Remove uma equipe por id — fire-and-forget. */
export function removerPlanTeam(id: string): void {
  if (!supabase) return
  supabase
    .from('plan_teams')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) console.error('Erro ao remover equipe de planejamento:', error.message)
    })
}
