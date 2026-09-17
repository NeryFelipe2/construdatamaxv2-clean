/**
 * useControleOperacional.ts — carrega TUDO do Controle Operacional de uma obra.
 *
 * - Pagina de 1000 em 1000 (limite do PostgREST): a tabela de preços sozinha passa de 500
 *   linhas e a medição cresce todo mês.
 * - Degrada com elegância: sem as tabelas (migration 035 não aplicada) `tabelasAusentes`
 *   fica true e a tela mostra o aviso em vez de quebrar.
 * - Os números calculados NÃO são gravados: saem de dominio/calculos.ts na hora.
 * - `carregarDadosOp` é exportada para o importador, que precisa também das linhas
 *   excluídas (para não ressuscitar) e, para admin, dos salários.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  dadosVazios, type DadosOp, type OpEquipeMembro, type OpImportacao, type OpOcorrencia, type OpPlanoItem,
  type OpServico, type PessoaVencimento,
} from '@/features/controle-operacional/dominio/tipos'

type ErroPg = { code?: string; message?: string } | null

export function tabelaAusente(e: ErroPg): boolean {
  if (!e) return false
  const c = e.code ?? ''
  const m = (e.message ?? '').toLowerCase()
  return c === '42P01' || c === 'PGRST205' ||
    (m.includes('does not exist') && m.includes('relation')) || m.includes('could not find the table')
}

const PAGINA = 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Consulta = (de: number, ate: number) => PromiseLike<{ data: any[] | null; error: ErroPg }>

async function paginar<T>(consulta: Consulta): Promise<{ data: T[]; error: ErroPg }> {
  const out: T[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1)
    if (error) return { data: out, error }
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGINA) break
  }
  return { data: out, error: null }
}

function emPedacos<T>(xs: T[], n = 150): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))

export interface OpcoesCarga {
  /** inclui linhas com deleted_at (o importador precisa para não ressuscitar) */
  incluirExcluidos?: boolean
  /** lê pessoa_remuneracao (a RLS só devolve para admin global) */
  comSalario?: boolean
}

export interface CargaOp {
  dados: DadosOp
  tabelasAusentes: boolean
  erro: string | null
}

export async function carregarDadosOp(projetoId: string, o: OpcoesCarga = {}): Promise<CargaOp> {
  const dados = dadosVazios(projetoId)
  if (!supabase) return { dados, tabelasAusentes: false, erro: 'Supabase não configurado' }
  const sb = supabase

  const tabela = <T>(nome: string, ordem = 'id', colunas = '*') => paginar<T>((de, ate) => {
    let q = sb.from(nome).select(colunas).eq('projeto_id', projetoId)
    if (!o.incluirExcluidos) q = q.is('deleted_at', null)
    return q.order(ordem).range(de, ate)
  })

  // op_parametros primeiro: se ela não existe, a migration não foi aplicada
  const par = await sb.from('op_parametros').select('*').eq('projeto_id', projetoId).maybeSingle()
  if (par.error) {
    if (tabelaAusente(par.error)) return { dados, tabelasAusentes: true, erro: null }
    return { dados, tabelasAusentes: false, erro: par.error.message ?? 'erro ao ler op_parametros' }
  }
  if (par.data && (o.incluirExcluidos || !par.data.deleted_at)) dados.parametros = { ...par.data, id: par.data.projeto_id }

  const [listas, custos, tributos, precos, servicos, programacoes, ordens, apontamentos, medicoes, faturamentos,
    atas, lookaheads, membros, pendentes, planoExt, ocorrExt] = await Promise.all([
    tabela<DadosOp['listas'][0]>('op_lista'),
    tabela<DadosOp['custos'][0]>('op_custo_item'),
    tabela<DadosOp['tributos'][0]>('op_tributo'),
    tabela<DadosOp['precos'][0]>('op_preco'),
    tabela<OpServico>('op_servico'),
    tabela<DadosOp['programacoes'][0]>('op_programacao'),
    tabela<DadosOp['ordens'][0]>('op_ordem_servico'),
    tabela<DadosOp['apontamentos'][0]>('op_apontamento'),
    tabela<DadosOp['medicoes'][0]>('op_medicao_item'),
    tabela<DadosOp['faturamentos'][0]>('op_faturamento'),
    tabela<DadosOp['atas'][0]>('op_ata'),
    tabela<DadosOp['lookaheads'][0]>('op_lookahead'),
    tabela<OpEquipeMembro>('op_equipe_membro'),
    tabela<DadosOp['pendentes'][0]>('op_importacao_pendente'),
    tabela<Record<string, unknown>>('op_plano_item', 'lps_task_id'),
    tabela<Record<string, unknown>>('op_ocorrencia_ext', 'ocorrencia_id'),
  ])
  const erros = [listas, custos, tributos, precos, servicos, programacoes, ordens, apontamentos, medicoes, faturamentos,
    atas, lookaheads, membros, pendentes, planoExt, ocorrExt].map((x) => x.error).filter(Boolean) as { message?: string }[]
  if (erros.some((e) => tabelaAusente(e))) return { dados, tabelasAusentes: true, erro: null }
  if (erros.length) return { dados, tabelasAusentes: false, erro: erros[0].message ?? 'erro de leitura' }

  // numeric chega como número; normaliza por garantia (numeric grande pode vir como texto)
  dados.listas = listas.data
  dados.custos = custos.data.map((c) => ({ ...c, qtd: num(c.qtd), valor_unit: num(c.valor_unit) }))
  dados.tributos = tributos.data.map((t) => ({ ...t, aliquota: num(t.aliquota) }))
  dados.precos = precos.data.map((p) => ({ ...p, preco: num(p.preco) }))
  dados.servicos = servicos.data.map((s) => ({ ...s, prazo_dias: num(s.prazo_dias) }))
  dados.programacoes = programacoes.data.map((p) => ({ ...p, h_previstas: num(p.h_previstas) }))
  dados.ordens = ordens.data.map((x) => ({ ...x, profundidade_m: num(x.profundidade_m), extensao_m: num(x.extensao_m) }))
  dados.apontamentos = apontamentos.data.map((a) => ({
    ...a, n_pessoas: num(a.n_pessoas), h_normais: num(a.h_normais), h_extras: num(a.h_extras), retro_h: num(a.retro_h),
    cam34_munck_h: num(a.cam34_munck_h), caminhao_hr_h: num(a.caminhao_hr_h), compressor_h: num(a.compressor_h),
    rompedor_h: num(a.rompedor_h), bomba_h: num(a.bomba_h), km_rodado: num(a.km_rodado),
  }))
  dados.medicoes = medicoes.data.map((m) => ({ ...m, qtd: num(m.qtd), valor_glosado: num(m.valor_glosado) }))
  dados.faturamentos = faturamentos.data.map((f) => ({ ...f, valor_recebido: num(f.valor_recebido) }))
  dados.atas = atas.data.map((a) => ({ ...a, quanto: num(a.quanto) }))
  dados.lookaheads = lookaheads.data
  dados.pendentes = pendentes.data

  // 08 — nomes em pessoas; vencimentos por pessoa; salário só para admin
  const idsPessoa = [...new Set(membros.data.map((m) => m.pessoa_id))]
  const nomes = new Map<string, string>()
  const salarios = new Map<string, number | null>()
  const vencimentos: PessoaVencimento[] = []
  for (const pedaco of emPedacos(idsPessoa)) {
    const [ps, vs, rs] = await Promise.all([
      sb.from('pessoas').select('id, nome_completo').in('id', pedaco),
      (() => {
        let q = sb.from('pessoa_vencimento').select('*').in('pessoa_id', pedaco)
        if (!o.incluirExcluidos) q = q.is('deleted_at', null)
        return q
      })(),
      o.comSalario ? sb.from('pessoa_remuneracao').select('pessoa_id, salario_bruto').in('pessoa_id', pedaco) : Promise.resolve({ data: [], error: null }),
    ])
    for (const p of (ps.data ?? []) as { id: string; nome_completo: string }[]) nomes.set(p.id, p.nome_completo)
    vencimentos.push(...((vs.data ?? []) as PessoaVencimento[]))
    for (const r of (rs.data ?? []) as { pessoa_id: string; salario_bruto: unknown }[]) salarios.set(r.pessoa_id, num(r.salario_bruto))
  }
  dados.membros = membros.data.map((m) => ({
    ...m, pessoa_nome: nomes.get(m.pessoa_id) ?? null,
    ...(o.comSalario ? { salario: salarios.has(m.pessoa_id) ? salarios.get(m.pessoa_id)! : null } : {}),
  }))
  dados.vencimentos = vencimentos

  // 11 — ocorrencias_obra (base) + op_ocorrencia_ext
  const base = await paginar<Record<string, unknown>>((de, ate) => {
    let q = sb.from('ocorrencias_obra').select('id, projeto_id, data, tipo, descricao, resolvida, resolvido_em, origem, deleted_at').eq('projeto_id', projetoId)
    if (!o.incluirExcluidos) q = q.is('deleted_at', null)
    return q.order('id').range(de, ate)
  })
  const extPorId = new Map(ocorrExt.data.map((e) => [e.ocorrencia_id as string, e]))
  dados.ocorrencias = base.data.map((b): OpOcorrencia => {
    const e = extPorId.get(b.id as string)
    return {
      id: b.id as string, projeto_id: projetoId, data: (b.data as string) ?? null, tipo: (b.tipo as string) ?? null,
      descricao: (b.descricao as string) ?? null, resolvida: (b.resolvida as boolean) ?? null, resolvido_em: (b.resolvido_em as string) ?? null,
      tem_ext: !!e,
      origem: (e?.origem as string) ?? (b.origem as string) ?? null,
      chave_import: (e?.chave_import as string) ?? null,
      ausente_na_planilha_em: (e?.ausente_na_planilha_em as string) ?? null,
      deleted_at: ((b.deleted_at ?? e?.deleted_at) as string) ?? null,
      servico_id: (e?.servico_id as string) ?? null, equipe: (e?.equipe as string) ?? null, gravidade: (e?.gravidade as string) ?? null,
      impacto_h: num(e?.impacto_h), custo_estimado: num(e?.custo_estimado), acao: (e?.acao as string) ?? null,
      responsavel: (e?.responsavel as string) ?? null, prazo: (e?.prazo as string) ?? null, status: (e?.status as string) ?? null,
      data_encerramento: (e?.data_encerramento as string) ?? null, gera_pleito: (e?.gera_pleito as string) ?? null,
    }
  })

  // 17 — lps_tasks (base) + op_plano_item
  const tarefas = new Map<string, Record<string, unknown>>()
  for (const pedaco of emPedacos(planoExt.data.map((p) => p.lps_task_id as string))) {
    const { data } = await sb.from('lps_tasks').select('id, semana_iso, task_name, responsavel, concluida, motivo_nao_conclusao, deleted_at').in('id', pedaco)
    for (const t of (data ?? []) as Record<string, unknown>[]) tarefas.set(t.id as string, t)
  }
  dados.plano = planoExt.data.map((p): OpPlanoItem => {
    const t = tarefas.get(p.lps_task_id as string)
    return {
      id: p.lps_task_id as string, projeto_id: projetoId, op_servico_id: p.op_servico_id as string, semana: p.semana as string,
      semana_iso: (t?.semana_iso as string) ?? null, equipe: (t?.responsavel as string) ?? null, compromisso: (t?.task_name as string) ?? null,
      concluido: t?.concluida === true ? 'SIM' : t?.concluida === false ? 'NÃO' : null,
      data_conclusao: (p.data_conclusao as string) ?? null, causa_nc: (t?.motivo_nao_conclusao as string) ?? null,
      reprogramado_para: (p.reprogramado_para as string) ?? null, observacao: (p.observacao as string) ?? null,
      origem: (p.origem as string) ?? null, chave_import: (p.chave_import as string) ?? null,
      ausente_na_planilha_em: (p.ausente_na_planilha_em as string) ?? null,
      // tarefa apagada no quadro do LPS também conta como excluída aqui
      deleted_at: ((p.deleted_at ?? t?.deleted_at ?? (t ? null : 'tarefa-lps-removida')) as string) ?? null,
    }
  })

  const imps = await sb.from('op_importacao').select('*').eq('projeto_id', projetoId).order('created_at', { ascending: false }).limit(10)
  dados.importacoes = (imps.data ?? []) as OpImportacao[]

  return { dados, tabelasAusentes: false, erro: null }
}

export interface UseControleOperacional {
  dados: DadosOp | null
  loading: boolean
  erro: string | null
  tabelasAusentes: boolean
  semSupabase: boolean
  recarregar: () => Promise<void>
}

export function useControleOperacional(projetoId: string | null): UseControleOperacional {
  const [dados, setDados] = useState<DadosOp | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tabelasAusentes, setTabelasAusentes] = useState(false)

  const recarregar = useCallback(async () => {
    if (!projetoId) { setDados(null); return }
    if (!supabase) { setDados(dadosVazios(projetoId)); return }
    setLoading(true); setErro(null)
    try {
      const r = await carregarDadosOp(projetoId)
      setTabelasAusentes(r.tabelasAusentes)
      setErro(r.erro)
      setDados(r.dados)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { void recarregar() }, [recarregar])

  return { dados, loading, erro, tabelasAusentes, semSupabase: !supabase, recarregar }
}
