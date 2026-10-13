/**
 * useMasterActivities.ts — grava itens novos do Planejamento Mestre (modo
 * dado real) em `planejamento_itens`, sob um planejamento-pai dedicado por
 * projeto (origem='planejamento_mestre'), mesmo padrão do container
 * 'a_fazer_manual' em `useGeoAFazer.ts`.
 *
 * Importante: `useMasterScheduleEngine`/`computeMasterScheduleFromRaw` NÃO
 * criam uma atividade por item — eles AGREGAM todos os itens do projeto por
 * núcleo×sistema (e por equipe dentro disso). Por isso "criar uma atividade"
 * aqui significa "lançar uma quantidade real" (sistema + metros + equipe),
 * que entra na soma do grupo certo na Visão Geral — não um WBS solto.
 */
import { supabase } from '@/lib/supabase'

export interface NovoItemMestreParams {
  projetoId: string
  nucleo: string
  sistema: 'AGUA' | 'ESGOTO'
  quantidadeM: number
  descricao: string
  equipeOriginal?: string
  rua?: string
  dataInicio?: string
}

/** Garante um planejamento-pai "Planejamento Mestre" por projeto e retorna seu id. */
async function obterPlanejamentoMestre(projetoId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data: existente } = await supabase
    .from('planejamentos_semanais')
    .select('id')
    .eq('projeto_id', projetoId)
    .eq('origem', 'planejamento_mestre')
    .limit(1)
  if (existente && existente.length > 0) return existente[0].id
  const hoje = new Date().toISOString().slice(0, 10)
  const { data: novo, error } = await supabase
    .from('planejamentos_semanais')
    .insert({
      projeto_id: projetoId,
      semana_inicio: hoje,
      semana_fim: hoje,
      status: 'ativo',
      origem: 'planejamento_mestre',
      versao: 1,
      payload: { descricao: 'Container de itens lançados na tela Planejamento Mestre' },
    })
    .select('id')
    .single()
  if (error) throw new Error(`Erro ao criar planejamento mestre: ${error.message}`)
  return novo!.id
}

// ─── Programação Semanal (Previsto/Realizado diário) ────────────────────────

export interface ProgramacaoDiariaRow {
  activity_id: string
  data: string
  previsto: number
  realizado: number
}

/** Carrega toda a grade Previsto/Realizado já lançada pro projeto. */
export async function carregarProgramacaoSemanal(projetoId: string): Promise<ProgramacaoDiariaRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('planejamento_mestre_programacao')
    .select('activity_id, data, previsto, realizado')
    .eq('projeto_id', projetoId)
  if (error) return []
  return (data ?? []) as ProgramacaoDiariaRow[]
}

/** Grava (upsert) um dia de um activity_id — fire-and-forget, mesmo padrão do Kanban. */
export function salvarProgramacaoDiaria(
  projetoId: string,
  activityId: string,
  data: string,
  previsto: number,
  realizado: number,
): void {
  if (!supabase) return
  supabase
    .from('planejamento_mestre_programacao')
    .upsert(
      { projeto_id: projetoId, activity_id: activityId, data, previsto, realizado, updated_at: new Date().toISOString() },
      { onConflict: 'projeto_id,activity_id,data' },
    )
    .then(({ error }) => {
      if (error) console.error('Erro ao salvar programação diária:', error.message)
    })
}

export async function criarItemPlanejamentoMestre(p: NovoItemMestreParams): Promise<{ id: string }> {
  if (!supabase) throw new Error('Supabase não configurado.')
  if (p.quantidadeM <= 0) throw new Error('Quantidade precisa ser maior que zero.')
  const planejamentoId = await obterPlanejamentoMestre(p.projetoId)

  const { data, error } = await supabase
    .from('planejamento_itens')
    .insert({
      planejamento_id: planejamentoId,
      projeto_id: p.projetoId,
      atividade: p.descricao,
      unidade: 'm',
      quantidade_planejada: p.quantidadeM,
      data_inicio: p.dataInicio || null,
      status: 'planejado',
      restricoes: [],
      payload: {
        sistema: p.sistema,
        nucleo: p.nucleo,
        equipe_original: p.equipeOriginal || null,
        rua: p.rua || null,
        fonte: 'planejamento_mestre_ui',
      },
    })
    .select('id')
    .single()
  if (error) throw new Error(`Erro ao gravar item: ${error.message}`)
  return { id: data!.id }
}
