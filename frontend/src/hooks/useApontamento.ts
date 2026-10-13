/**
 * useApontamento.ts — persistência do apontamento por tags (WhatsApp → RDO →
 * Medição). Grava DIRETO no Supabase (padrão SIGA-OS, sem API Render):
 * rdos (status='fechado') → rdo_equipes → rdo_atividades. O TRIGGER do banco
 * (sync_rdo_to_medicao) gera os medicao_itens sozinho — NUNCA gravamos
 * medicao_itens aqui.
 *
 * Preço: quando rdo_atividades.medicao_codigo está preenchido o item de
 * medição sai com unidade do contrato e preço = valor_unitario × fator_wcr
 * (60%). Sem código → item sem preço (status pendente, decisão do dono).
 */
import { supabase } from '@/lib/supabase'
import type { ApontamentoParse } from '@/utils/parseApontamento'

export interface CatalogoPreco {
  codigo: string
  unidade: string | null
  valor_unitario: number
  fator_wcr: number
}

/** regiao_codigo do projeto ('2' Boi Malhado, '3' Sakura/Retorno) — ou null. */
export async function carregarRegiaoProjeto(projetoId: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('projetos')
    .select('regiao_codigo')
    .eq('id', projetoId)
    .maybeSingle()
  if (error || !data) return null
  return (data as { regiao_codigo: string | null }).regiao_codigo ?? null
}

/**
 * Catálogo de preços do contrato da região/ano: Map<descricao, preço>.
 * O Supabase js não tem ltrim(codigo,'0') — buscamos o ano inteiro (paginado)
 * e filtramos no cliente pelo prefixo da região (código sem zeros à esquerda).
 */
export async function carregarCatalogoPrecos(
  regiaoCodigo: string,
  ano: string,
): Promise<Map<string, CatalogoPreco>> {
  const map = new Map<string, CatalogoPreco>()
  if (!supabase) return map
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('precos_contrato')
      .select('codigo, descricao, unidade, valor_unitario, fator_wcr')
      .eq('ano', ano)
      .order('codigo', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error || !data || data.length === 0) break
    for (const r of data as {
      codigo: string
      descricao: string
      unidade: string | null
      valor_unitario: number
      fator_wcr: number | null
    }[]) {
      const cod = String(r.codigo ?? '')
      if (!cod.replace(/^0+/, '').startsWith(regiaoCodigo)) continue
      map.set(r.descricao, {
        codigo: cod,
        unidade: r.unidade,
        valor_unitario: Number(r.valor_unitario),
        fator_wcr: Number(r.fator_wcr ?? 0.6),
      })
    }
    if (data.length < pageSize) break
  }
  return map
}

export interface SalvarApontamentoParams {
  projetoId: string | null
  isDemoMode: boolean
  parse: ApontamentoParse
  textoOriginal: string
  catalogo: Map<string, CatalogoPreco>
}

export interface SalvarApontamentoResult {
  rdoId: string
  totalAtividades: number
}

/**
 * Cria rdos → rdo_equipes → rdo_atividades, nesta ordem, com rollback manual
 * em erro (deleta o que criou). Guard: NUNCA grava em demo/sem projeto.
 */
export async function salvarApontamento(p: SalvarApontamentoParams): Promise<SalvarApontamentoResult> {
  if (p.isDemoMode) throw new Error('Modo Demonstração ativo — desative para gravar apontamentos reais.')
  if (!p.projetoId) throw new Error('Nenhum projeto ativo selecionado.')
  if (!supabase) throw new Error('Supabase não configurado.')
  if (!p.parse.data) throw new Error('Apontamento sem data única — informe a data (um dia só) antes de salvar.')
  if (p.parse.itens.length === 0) throw new Error('Nenhum item interpretado — nada a salvar.')

  // 1. rdos (status fechado → o trigger de medição atua nas atividades)
  const { data: rdo, error: e1 } = await supabase
    .from('rdos')
    .insert({
      projeto_id: p.projetoId,
      data: p.parse.data,
      status: 'fechado',
      origem: 'apontamento_tags',
      apontador: p.parse.equipe,
      clima: null,
      payload: { apontamento_texto: p.textoOriginal, avisos: p.parse.avisos },
      ocorrencias: p.parse.observacoes.join('\n') || null,
    })
    .select('id')
    .single()
  if (e1 || !rdo) throw new Error(`Erro ao criar RDO: ${e1?.message ?? 'sem retorno'}`)
  const rdoId = (rdo as { id: string }).id

  // 2. rdo_equipes
  const { data: eq, error: e2 } = await supabase
    .from('rdo_equipes')
    .insert({
      rdo_id: rdoId,
      // rdo_equipes.tipo é NOT NULL no banco — apontamento sem núcleo não pode quebrar o insert
      tipo: p.parse.nucleo || 'apontamento',
      lider_nome: p.parse.equipe ?? 'apontamento',
      membros: [],
    })
    .select('id')
    .single()
  if (e2 || !eq) {
    await supabase.from('rdos').delete().eq('id', rdoId)
    throw new Error(`Erro ao criar equipe do RDO: ${e2?.message ?? 'sem retorno'}`)
  }
  const equipeId = (eq as { id: string }).id

  // 3. rdo_atividades (uma por item; HM já vem como dois itens do parser)
  const rows = p.parse.itens.map((it) => {
    const cat = it.descricaoContrato ? p.catalogo.get(it.descricaoContrato) : undefined
    return {
      equipe_id: equipeId,
      servico: it.descricaoContrato ?? `${it.tag} — REVISAR: ${it.motivoRevisar ?? 'confirmar na medição'}`,
      metragem: it.qtd ?? 0,
      medicao_codigo: cat?.codigo ?? null,
      medicao_unidade: cat?.unidade ?? null,
      observacao: it.linhaOriginal,
    }
  })
  const { error: e3 } = await supabase.from('rdo_atividades').insert(rows)
  if (e3) {
    // rollback manual, na ordem inversa
    await supabase.from('rdo_atividades').delete().eq('equipe_id', equipeId)
    await supabase.from('rdo_equipes').delete().eq('id', equipeId)
    await supabase.from('rdos').delete().eq('id', rdoId)
    throw new Error(`Erro ao gravar atividades: ${e3.message}`)
  }

  return { rdoId, totalAtividades: rows.length }
}
