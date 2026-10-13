/**
 * useLpsRestricoes.ts — persistência das RESTRIÇÕES do LPS (Análise de
 * Restrições / IRR) em `lps_restricoes` no Supabase. Mesmo padrão
 * fire-and-forget de useLpsTasks.ts: escrita otimista sem bloquear a UI,
 * leitura na carga do projeto (o lpsStore chama e mantém fallback pra API
 * Render quando o Supabase está indisponível).
 *
 * A tabela foi criada e POPULADA em 27/07 (74 linhas seed de ocorrencias_obra)
 * com estas colunas REAIS (verificadas via REST):
 *   id uuid · projeto_id · frente_id (→wcr_equipes) · tarefa_id · rdo_id ·
 *   descricao · responsavel · prazo date · status · tipo · impacto · origem ·
 *   created_at · updated_at
 *
 * Mapeamento LpsRestriction ↔ lps_restricoes:
 *   tema+descricao ↔ descricao — a tabela tem UM campo de texto; o seed já usa
 *     o padrão "rótulo — texto" (ex.: "vazamento — Rua 4: …"), então o tema da
 *     UI vira o prefixo antes de " — " e o round-trip é sem perda.
 *   categoria ↔ tipo — a UI usa LpsRestrictionCategory (6 valores) e o banco a
 *     taxonomia CNC oficial (10 valores). O valor cru do banco é preservado em
 *     `tipoDb`: só convertemos categoria→tipo quando o usuário troca a
 *     categoria (senão 'seguranca' viraria 'outro' num simples editar-salvar).
 *   prazoRemocao ↔ prazo · impacto ↔ impacto · responsavel ↔ responsavel
 *   status ↔ status — padronizado nos 3 status que o store já usa:
 *     'identificada' (aberta) · 'em_resolucao' (tratativa) · 'resolvida'
 *     (removida). O banco aceita os três (verificado por insert/update reais).
 *   resolvedAt ← updated_at quando status='resolvida' — a tabela NÃO tem
 *     resolved_at; o updated_at da linha resolvida é o melhor proxy honesto.
 *   origem ↔ origem · frenteId ↔ frente_id
 *   tags/acoesNecessarias/observacoes — SEM coluna correspondente: não são
 *     persistidos (o RestricoesPanel não os exibe mais no formulário).
 */
import { supabase } from '@/lib/supabase'
import type { LpsRestriction, LpsRestrictionCategory, LpsRestrictionStatus } from '@/types'

/** Linha crua de lps_restricoes (colunas verificadas em 27/07). */
export interface DbLpsRestricao {
  id: string
  projeto_id: string | null
  frente_id: string | null
  tarefa_id: string | null
  rdo_id: string | null
  descricao: string
  responsavel: string | null
  prazo: string | null
  status: string
  tipo: string | null
  impacto: string | null
  origem: string | null
  created_at: string | null
  updated_at: string | null
}

/** Taxonomia CNC oficial usada em lps_restricoes.tipo (+ 'seguranca'/'outro' presentes no seed). */
export type TipoRestricaoDb =
  | 'mao de obra'
  | 'material'
  | 'equipamento'
  | 'clima'
  | 'projeto/sabesp'
  | 'interferencia/moradores'
  | 'retrabalho'
  | 'planejamento'
  | 'seguranca'
  | 'outro'

/** tipo do banco → categoria da UI (agrupamento com perda controlada; o cru fica em `tipoDb`). */
export function tipoParaCategoria(tipo: string | null): LpsRestrictionCategory {
  const raw = String(tipo ?? '').toLowerCase().trim()
  if (raw === 'material' || raw === 'materiais') return 'materiais'
  if (raw === 'equipamento' || raw === 'equipamentos') return 'equipamentos'
  if (raw === 'mao de obra' || raw === 'mao_de_obra') return 'mao_de_obra'
  if (raw === 'projeto/sabesp' || raw === 'planejamento' || raw === 'projeto_engenharia') return 'projeto_engenharia'
  if (raw === 'interferencia/moradores' || raw === 'clima' || raw === 'externo') return 'externo'
  // 'seguranca' | 'retrabalho' | 'outro' | vazio
  return 'outros'
}

/** categoria da UI → tipo default do banco (usado só quando a categoria MUDOU em relação ao tipoDb preservado). */
export function categoriaParaTipo(categoria: LpsRestrictionCategory): TipoRestricaoDb {
  switch (categoria) {
    case 'materiais': return 'material'
    case 'equipamentos': return 'equipamento'
    case 'mao_de_obra': return 'mao de obra'
    case 'projeto_engenharia': return 'projeto/sabesp'
    case 'externo': return 'interferencia/moradores'
    default: return 'outro'
  }
}

/**
 * Escolhe o `tipo` a gravar: preserva o valor cru do banco quando ele ainda é
 * coerente com a categoria escolhida na UI (evita achatar 'seguranca'→'outro'
 * num editar-salvar sem troca de categoria).
 */
export function resolverTipoDb(categoria: LpsRestrictionCategory, tipoDbAnterior?: string): string {
  if (tipoDbAnterior && tipoParaCategoria(tipoDbAnterior) === categoria) return tipoDbAnterior
  return categoriaParaTipo(categoria)
}

const SEPARADOR_TEMA = ' — '

/** Divide o `descricao` do banco em tema (prefixo curto antes de " — ") + descrição. */
function dividirDescricao(descricao: string): { tema: string; descricao: string } {
  const idx = descricao.indexOf(SEPARADOR_TEMA)
  // Prefixo até 80 chars = padrão "rótulo — texto" do seed; sem separador, o texto inteiro vira tema e descrição.
  if (idx > 0 && idx <= 80) {
    return { tema: descricao.slice(0, idx).trim(), descricao: descricao.slice(idx + SEPARADOR_TEMA.length).trim() }
  }
  return { tema: descricao, descricao }
}

/** Junta tema+descrição da UI de volta no campo único do banco (round-trip com dividirDescricao). */
function juntarDescricao(tema: string, descricao: string): string {
  const t = tema.trim()
  const d = descricao.trim()
  if (!t || t === d) return d || t
  if (!d) return t
  return `${t}${SEPARADOR_TEMA}${d}`
}

function normalizarStatus(status: string | null): LpsRestrictionStatus {
  const raw = String(status ?? '').toLowerCase().trim()
  if (raw === 'resolvida' || raw === 'removida' || raw === 'resolvido') return 'resolvida'
  if (raw === 'em_resolucao' || raw === 'em_tratativa' || raw === 'em resolucao') return 'em_resolucao'
  return 'identificada'
}

function dbParaRestricao(r: DbLpsRestricao): LpsRestriction {
  const { tema, descricao } = dividirDescricao(r.descricao ?? '')
  const status = normalizarStatus(r.status)
  return {
    id: r.id,
    tema,
    categoria: tipoParaCategoria(r.tipo),
    descricao,
    impacto: r.impacto ?? '',
    responsavel: r.responsavel ?? '',
    prazoRemocao: r.prazo ? String(r.prazo).slice(0, 10) : '',
    acoesNecessarias: '',
    tags: [],
    observacoes: '',
    status,
    createdAt: r.created_at ? String(r.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
    // Sem coluna resolved_at no banco — updated_at da linha resolvida é o proxy honesto.
    resolvedAt: status === 'resolvida' && r.updated_at ? String(r.updated_at).slice(0, 10) : undefined,
    origem: r.origem ?? undefined,
    frenteId: r.frente_id ?? undefined,
    tipoDb: r.tipo ?? undefined,
  }
}

function restricaoParaDb(projectId: string, r: LpsRestriction): Record<string, unknown> {
  return {
    id: r.id,
    projeto_id: projectId,
    frente_id: r.frenteId ?? null,
    descricao: juntarDescricao(r.tema, r.descricao),
    responsavel: r.responsavel?.trim() ? r.responsavel.trim() : null,
    prazo: r.prazoRemocao || null,
    status: r.status,
    tipo: resolverTipoDb(r.categoria, r.tipoDb),
    impacto: r.impacto?.trim() ? r.impacto.trim() : null,
    origem: r.origem ?? null,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Carrega as restrições do projeto. Retorna `null` quando a leitura FALHA
 * (Supabase indisponível/erro — o chamador cai no fallback da API Render) e
 * `[]` quando o banco está genuinamente vazio (mostrar vazio honesto, sem
 * deixar mock/projeto anterior vazar).
 */
export async function carregarLpsRestricoes(projectId: string): Promise<LpsRestriction[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('lps_restricoes')
    .select('id, projeto_id, frente_id, tarefa_id, rdo_id, descricao, responsavel, prazo, status, tipo, impacto, origem, created_at, updated_at')
    .eq('projeto_id', projectId)
    .order('created_at', { ascending: false })
  if (error || !data) return null
  return (data as DbLpsRestricao[]).map(dbParaRestricao)
}

/** Grava (upsert) uma restrição — fire-and-forget, sem await no chamador (padrão useLpsTasks). */
export function salvarLpsRestricao(projectId: string, r: LpsRestriction): void {
  if (!supabase) return
  supabase
    .from('lps_restricoes')
    .upsert(restricaoParaDb(projectId, r))
    .then(({ error }) => {
      if (error) console.error('Erro ao salvar restrição LPS:', error.message)
    })
}

/** Remove uma restrição por id — fire-and-forget. */
export function removerLpsRestricao(id: string): void {
  if (!supabase) return
  supabase
    .from('lps_restricoes')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) console.error('Erro ao remover restrição LPS:', error.message)
    })
}
