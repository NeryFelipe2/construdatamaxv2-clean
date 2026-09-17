/**
 * gravacoesCompostas.ts — as telas que gravam em DUAS tabelas (a base reusada + a extensão op_*).
 *
 *   11 Ocorrências  → ocorrencias_obra (as mesmas do Campo WhatsApp / Punch List) + op_ocorrencia_ext
 *   17 Plano semanal → lps_tasks (aparece no quadro do Last Planner) + op_plano_item
 *   16 Lookahead     → "virar restrição" grava em lps_restricoes
 *   08 Vencimentos   → pessoa_vencimento
 *
 * Excluir é sempre soft delete (deleted_at), nas duas tabelas.
 */
import { supabase } from '@/lib/supabase'
import type { OpLookahead, TipoVencimento } from '../dominio/tipos'
import { normCabecalho } from '../dominio/normalizar'
import { semanaIso } from '../dominio/datas'
import { lookaheadCalc } from '../dominio/calculos'
import { ocorrenciaResolvida } from '../importador/gravarImportacao'

type Valores = Record<string, unknown>
const agoraTs = () => new Date().toISOString()   // timestamptz (instante), não data civil

function semSupabase(): string | null {
  return supabase ? null : 'Supabase não configurado'
}

// ─── 11 · ocorrências ───────────────────────────────────────────────────────

export async function salvarOcorrencia(projetoId: string, orgId: string | null, v: Valores, existenteId: string | null): Promise<string | null> {
  const falta = semSupabase(); if (falta) return falta
  const id = existenteId ?? globalThis.crypto.randomUUID()
  const base: Valores = {
    projeto_id: projetoId, data: v.data, tipo: v.tipo, descricao: v.descricao,
    resolvida: ocorrenciaResolvida(v.status, v.data_encerramento),
    resolvido_em: v.data_encerramento ? `${v.data_encerramento}T12:00:00-03:00` : null,
  }
  if (orgId) base.org_id = orgId
  const r1 = existenteId
    ? await supabase!.from('ocorrencias_obra').update(base).eq('id', id)
    : await supabase!.from('ocorrencias_obra').insert({ id, ...base, origem: 'controle_operacional', origem_fonte: 'Controle Operacional (tela)' })
  if (r1.error) return r1.error.message
  const ext = {
    ocorrencia_id: id, projeto_id: projetoId,
    servico_id: v.servico_id ?? null, equipe: v.equipe ?? null, gravidade: v.gravidade ?? null, impacto_h: v.impacto_h ?? null,
    custo_estimado: v.custo_estimado ?? null, acao: v.acao ?? null, responsavel: v.responsavel ?? null, prazo: v.prazo ?? null,
    status: v.status ?? null, data_encerramento: v.data_encerramento ?? null, gera_pleito: v.gera_pleito ?? null,
  }
  const r2 = await supabase!.from('op_ocorrencia_ext').upsert(ext, { onConflict: 'ocorrencia_id' })
  return r2.error ? r2.error.message : null
}

export async function excluirOcorrencia(id: string): Promise<string | null> {
  const falta = semSupabase(); if (falta) return falta
  const t = agoraTs()
  const r1 = await supabase!.from('ocorrencias_obra').update({ deleted_at: t }).eq('id', id)
  if (r1.error) return r1.error.message
  const r2 = await supabase!.from('op_ocorrencia_ext').update({ deleted_at: t }).eq('ocorrencia_id', id)
  return r2.error ? r2.error.message : null
}

// ─── 17 · plano semanal (lps_tasks) ─────────────────────────────────────────

export async function salvarPlanoItem(projetoId: string, orgId: string | null, codigoServico: string | null, v: Valores, existenteId: string | null): Promise<string | null> {
  const falta = semSupabase(); if (falta) return falta
  const id = existenteId ?? globalThis.crypto.randomUUID()
  const semana = String(v.semana)
  const conc = normCabecalho(v.concluido)
  const tarefa: Valores = {
    project_id: projetoId, semana_iso: semanaIso(semana),
    task_name: (v.compromisso as string) || codigoServico || 'compromisso',
    responsavel: v.equipe ?? null, comprometida: true,
    // vazio continua vazio: "ainda não respondido" não é "não concluiu"
    concluida: conc === 'SIM' ? true : conc === 'NAO' ? false : null,
    motivo_nao_conclusao: v.causa_nc ?? null,
  }
  if (orgId) tarefa.org_id = orgId
  const r1 = existenteId
    ? await supabase!.from('lps_tasks').update({ ...tarefa, updated_at: agoraTs() }).eq('id', id)
    : await supabase!.from('lps_tasks').insert({ id, ...tarefa })
  if (r1.error) return r1.error.message
  const r2 = await supabase!.from('op_plano_item').upsert({
    lps_task_id: id, projeto_id: projetoId, op_servico_id: v.op_servico_id, semana,
    data_conclusao: v.data_conclusao ?? null, reprogramado_para: v.reprogramado_para ?? null, observacao: v.observacao ?? null,
  }, { onConflict: 'lps_task_id' })
  return r2.error ? r2.error.message : null
}

export async function excluirPlanoItem(id: string): Promise<string | null> {
  const falta = semSupabase(); if (falta) return falta
  const t = agoraTs()
  const r1 = await supabase!.from('op_plano_item').update({ deleted_at: t }).eq('lps_task_id', id)
  if (r1.error) return r1.error.message
  const r2 = await supabase!.from('lps_tasks').update({ deleted_at: t }).eq('id', id)
  return r2.error ? r2.error.message : null
}

// ─── 16 · lookahead → restrição do LPS ──────────────────────────────────────

const TIPO_RESTRICAO: Record<string, string> = {
  'Material': 'material', 'Equipamento': 'equipamento', 'Mão de obra': 'mao de obra',
  'OS emitida': 'projeto/sabesp', 'Licença / via': 'projeto/sabesp', 'Acesso': 'interferencia/moradores',
}

export async function virarRestricao(lk: OpLookahead, codigoServico: string, orgId: string | null): Promise<string | null> {
  const falta = semSupabase(); if (falta) return falta
  const { pendentes } = lookaheadCalc(lk)
  if (pendentes.length === 0) return 'este serviço está LIVRE PARA PROGRAMAR — não há restrição para levar'
  const restricao: Valores = {
    projeto_id: lk.projeto_id,
    descricao: `${codigoServico} — pendente: ${pendentes.join(', ')} (lookahead da semana ${lk.semana})`,
    responsavel: lk.responsavel ?? null, prazo: lk.prazo ?? null, status: 'identificada',
    tipo: TIPO_RESTRICAO[pendentes[0]] ?? 'outro',
    origem: `controle_operacional lookahead ${lk.id}`,
  }
  if (orgId) restricao.org_id = orgId
  const { data, error } = await supabase!.from('lps_restricoes').insert(restricao).select('id').single()
  if (error) return error.message
  const r2 = await supabase!.from('op_lookahead').update({ lps_restricao_id: data.id }).eq('id', lk.id)
  return r2.error ? r2.error.message : null
}

// ─── 08 · vencimentos ───────────────────────────────────────────────────────

export async function salvarVencimentos(pessoaId: string, datas: Partial<Record<TipoVencimento, string | null>>, existentes: Set<TipoVencimento>): Promise<string | null> {
  const falta = semSupabase(); if (falta) return falta
  const linhas = (Object.entries(datas) as [TipoVencimento, string | null][])
    // só grava tipo com data OU tipo que já existia (para poder limpar); vazio novo não cria linha
    .filter(([tipo, d]) => !!d || existentes.has(tipo))
    .map(([tipo, d]) => ({ pessoa_id: pessoaId, tipo, vence_em: d || null }))
  if (linhas.length === 0) return null
  const { error } = await supabase!.from('pessoa_vencimento').upsert(linhas, { onConflict: 'pessoa_id,tipo' })
  return error ? error.message : null
}
