/**
 * useFcp.ts — camada de dados do Fluxo de Caixa Projetado.
 *
 * REGRA DESTE HOOK: ele NÃO calcula nada. Produção prevista, medição, imposto,
 * saldo, capital e viabilidade vêm das funções SQL (fcp_semanas, fcp_capital,
 * fcp_viabilidade, fcp_custo_obra). É o que garante que o formulário da tela,
 * a planilha importada e o webhook do n8n produzam o mesmo número — se o
 * cálculo estivesse aqui, cada porta de entrada teria a sua versão da verdade.
 *
 * Degrada com elegância: se as tabelas do FCP ainda não existirem no banco
 * (migration pendente), `tabelasAusentes` fica true e a tela mostra o aviso em
 * vez de quebrar. Mesmo padrão do usePessoas.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── tipos (espelham o schema da migration 026) ─────────────────────────────

export type FcpStatus = 'rascunho' | 'enviado' | 'aprovado' | 'devolvido'
export type FcpCategoria = 'folha' | 'engenheiro' | 'estrutura' | 'indiretos'
export type Cenario = 'MÍNIMA' | 'MÉDIA' | 'BOA' | 'ÓTIMA'
export type QuemPaga = 'CONSÓRCIO' | 'WCR'

export interface Fcp {
  id: string
  nome: string
  semana_ref: string
  status: FcpStatus
  observacao: string | null
  versao: number
  aprovado_em: string | null
  enviado_em: string | null
  devolvido_em: string | null
  created_at: string | null
}

export interface FcpPremissas {
  fcp_id: string
  inicio_obra: string
  fim_operacao: string
  dias_mes: number
  defasagem_dias: number
  imposto_aliquota: number
  cenario: Cenario
  margem_minima: number
  margem_media: number
  margem_boa: number
  margem_otima: number
  contingencia: number
  fator_primeiro_mes: number
  paga_folha: QuemPaga
  paga_engenheiro: QuemPaga
  paga_estrutura: QuemPaga
  paga_indiretos: QuemPaga
  paga_mobilizacao: QuemPaga
  desconta_medicao: boolean
  base_imposto: 'MEDIÇÃO CHEIA' | 'LÍQUIDA DO DESCONTO'
}

export interface FcpObra {
  id: string
  fcp_id: string
  projeto_id: string | null
  nome: string
  ordem: number
  ticket_unico: number | null
  ticket_agua: number | null
  ticket_esgoto: number | null
  pct_esgoto: number | null
  mobilizacao: number
}

export interface FcpCustoPessoa {
  id: string
  fcp_obra_id: string
  pessoa_id: string | null
  equipe: string | null
  nome: string
  cargo: string | null
  salario: number
  encargos: number
  beneficios: number
  ordem: number
}

export interface FcpCustoGeral {
  id: string
  fcp_obra_id: string
  item: string
  categoria: FcpCategoria
  quantidade: number
  valor_unitario: number
  observacao: string | null
  ordem: number
}

export interface FcpRealizado {
  id: string
  fcp_obra_id: string
  n_semana: number
  producao: number
  observacao: string | null
}

export interface FcpPreco {
  id: string
  fcp_obra_id: string
  item_codigo: string | null
  descricao: string
  numero_preco: string | null
  unidade: string | null
  valor_unitario: number | null
  observacao: string | null
  requer_conferencia: boolean
  ordem: number
}

/** Linha da grade semanal — vem calculada de fcp_semanas(). */
export interface FcpSemana {
  obra_id: string
  obra: string
  n_semana: number
  data_ini: string
  data_fim: string
  producao_prevista: number
  producao_realizada: number | null
  pct_planejado: number | null
  medicao: number
  recebimento: number
  imposto: number
  desconto_consorcio: number
  custo_wcr: number
  mobilizacao: number
  despesas: number
  saldo_periodo: number
  saldo_acumulado: number
}

export interface FcpCapital {
  pior_saldo: number
  necessidade: number
  contingencia: number
  capital_recomendado: number
}

export interface FcpViabilidade {
  obra: string
  cenario: Cenario
  margem: number
  receita_liquida_mes: number
  medicao_bruta_mes: number
  servicos_mes: number
  servicos_semana: number
  servicos_dia: number
  agua_dia: number | null
  esgoto_dia: number | null
}

export interface FcpCustoObra {
  total: number
  folha: number
  engenheiro: number
  estrutura: number
  indiretos: number
}

/** tabela/função ainda não existe no banco (migration pendente) */
function ausente(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  const code = e.code ?? ''
  const msg = (e.message ?? '').toLowerCase()
  return (
    code === '42P01' || code === 'PGRST205' || code === 'PGRST202' ||
    (msg.includes('does not exist') && (msg.includes('relation') || msg.includes('function'))) ||
    msg.includes('could not find the table') ||
    msg.includes('could not find the function')
  )
}

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v))
const numN = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

export interface UseFcpReturn {
  fcps: Fcp[]
  fcpId: string | null
  setFcpId: (id: string | null) => void
  fcp: Fcp | null
  premissas: FcpPremissas | null
  obras: FcpObra[]
  pessoas: FcpCustoPessoa[]
  gerais: FcpCustoGeral[]
  realizados: FcpRealizado[]
  precos: FcpPreco[]
  semanas: FcpSemana[]
  capital: FcpCapital | null
  viabilidade: FcpViabilidade[]
  custoPorObra: Record<string, FcpCustoObra>
  loading: boolean
  erro: string | null
  tabelasAusentes: boolean
  travado: boolean
  recarregar: () => Promise<void>
  /** Cria um FCP em branco para a obra ativa (documento + premissas padrão + a obra). */
  criarFcp: (nome: string, semanaRef: string) => Promise<boolean>
  salvarPremissas: (p: Partial<FcpPremissas>) => Promise<boolean>
  salvarObra: (id: string, p: Partial<FcpObra>) => Promise<boolean>
  lancarRealizado: (obraId: string, semana: number, producao: number | null) => Promise<boolean>
  mudarStatus: (novo: FcpStatus, observacao?: string) => Promise<boolean>
  horizonteSemanas: number
  setHorizonteSemanas: (n: number) => void
}

export function useFcp(projetoId: string | null): UseFcpReturn {
  const [fcps, setFcps] = useState<Fcp[]>([])
  const [fcpId, setFcpId] = useState<string | null>(null)
  const [premissas, setPremissas] = useState<FcpPremissas | null>(null)
  const [obras, setObras] = useState<FcpObra[]>([])
  const [pessoas, setPessoas] = useState<FcpCustoPessoa[]>([])
  const [gerais, setGerais] = useState<FcpCustoGeral[]>([])
  const [realizados, setRealizados] = useState<FcpRealizado[]>([])
  const [precos, setPrecos] = useState<FcpPreco[]>([])
  const [semanas, setSemanas] = useState<FcpSemana[]>([])
  const [capital, setCapital] = useState<FcpCapital | null>(null)
  const [viabilidade, setViabilidade] = useState<FcpViabilidade[]>([])
  const [custoPorObra, setCustoPorObra] = useState<Record<string, FcpCustoObra>>({})
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [tabelasAusentes, setTabelasAusentes] = useState(false)
  const [horizonteSemanas, setHorizonteSemanas] = useState(12)

  // lista de FCPs (o seletor de semana no topo)
  const carregarLista = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    // O FCP é POR OBRA: sem obra selecionada não há o que listar. Foi a falta
    // deste filtro que fez o FCP de Bertioga+Santos aparecer "dentro" do
    // Sakura — o documento estava pendurado direto na organização.
    if (!projetoId) { setFcps([]); setFcpId(null); setLoading(false); return }
    const { data, error } = await supabase
      .from('fcp')
      .select('id, nome, semana_ref, status, observacao, versao, aprovado_em, enviado_em, devolvido_em, created_at, fcp_obra!inner(projeto_id)')
      .eq('fcp_obra.projeto_id', projetoId)
      .is('deleted_at', null)
      .order('semana_ref', { ascending: false })
    if (error) {
      if (ausente(error)) { setTabelasAusentes(true); setLoading(false); return }
      setErro(error.message); setLoading(false); return
    }
    const lista = (data ?? []) as Fcp[]
    setFcps(lista)
    // troca de obra: se o FCP selecionado não pertence à nova obra, solta
    setFcpId((atual) => (atual && lista.some((f) => f.id === atual) ? atual : lista[0]?.id ?? null))
    setLoading(false)
  }, [projetoId])

  // conteúdo do FCP selecionado (entradas + resultados calculados no banco)
  const carregarDetalhe = useCallback(async (id: string) => {
    if (!supabase) return
    setLoading(true); setErro(null)
    try {
      const [oPrem, oObras, oReal] = await Promise.all([
        supabase.from('fcp_premissas').select('*').eq('fcp_id', id).maybeSingle(),
        supabase.from('fcp_obra').select('*').eq('fcp_id', id).is('deleted_at', null).order('ordem'),
        supabase.rpc('fcp_semanas', { p_fcp_id: id, p_semanas: horizonteSemanas }),
      ])
      if (oPrem.error && ausente(oPrem.error)) { setTabelasAusentes(true); return }

      const prem = oPrem.data as FcpPremissas | null
      setPremissas(prem ? {
        ...prem,
        imposto_aliquota: num(prem.imposto_aliquota),
        contingencia: num(prem.contingencia),
        fator_primeiro_mes: num(prem.fator_primeiro_mes),
        margem_minima: num(prem.margem_minima), margem_media: num(prem.margem_media),
        margem_boa: num(prem.margem_boa), margem_otima: num(prem.margem_otima),
      } : null)

      const listaObras = ((oObras.data ?? []) as FcpObra[]).map((o) => ({
        ...o,
        ticket_unico: numN(o.ticket_unico), ticket_agua: numN(o.ticket_agua),
        ticket_esgoto: numN(o.ticket_esgoto), pct_esgoto: numN(o.pct_esgoto),
        mobilizacao: num(o.mobilizacao),
      }))
      setObras(listaObras)
      setSemanas(((oReal.data ?? []) as FcpSemana[]).map((s) => ({
        ...s,
        producao_prevista: num(s.producao_prevista),
        producao_realizada: numN(s.producao_realizada),
        pct_planejado: numN(s.pct_planejado),
        medicao: num(s.medicao), recebimento: num(s.recebimento), imposto: num(s.imposto),
        desconto_consorcio: num(s.desconto_consorcio), custo_wcr: num(s.custo_wcr),
        mobilizacao: num(s.mobilizacao), despesas: num(s.despesas),
        saldo_periodo: num(s.saldo_periodo), saldo_acumulado: num(s.saldo_acumulado),
      })))

      const ids = listaObras.map((o) => o.id)
      if (ids.length) {
        const [oPes, oGer, oPre, oRz] = await Promise.all([
          supabase.from('fcp_custo_pessoa').select('*').in('fcp_obra_id', ids).is('deleted_at', null).order('ordem'),
          supabase.from('fcp_custo_geral').select('*').in('fcp_obra_id', ids).is('deleted_at', null).order('ordem'),
          supabase.from('fcp_preco').select('*').in('fcp_obra_id', ids).is('deleted_at', null).order('ordem').limit(2000),
          supabase.from('fcp_realizado').select('*').in('fcp_obra_id', ids).is('deleted_at', null).order('n_semana'),
        ])
        setPessoas(((oPes.data ?? []) as FcpCustoPessoa[]).map((p) => ({
          ...p, salario: num(p.salario), encargos: num(p.encargos), beneficios: num(p.beneficios),
        })))
        setGerais(((oGer.data ?? []) as FcpCustoGeral[]).map((g) => ({
          ...g, quantidade: num(g.quantidade), valor_unitario: num(g.valor_unitario),
        })))
        setPrecos(((oPre.data ?? []) as FcpPreco[]).map((p) => ({ ...p, valor_unitario: numN(p.valor_unitario) })))
        setRealizados(((oRz.data ?? []) as FcpRealizado[]).map((r) => ({ ...r, producao: num(r.producao) })))

        // custo por obra: também vem do banco (mesma função que o cálculo usa)
        const custos: Record<string, FcpCustoObra> = {}
        await Promise.all(listaObras.map(async (o) => {
          const { data } = await supabase!.rpc('fcp_custo_obra', { p_obra_id: o.id })
          const r = (Array.isArray(data) ? data[0] : data) as FcpCustoObra | undefined
          if (r) custos[o.id] = {
            total: num(r.total), folha: num(r.folha), engenheiro: num(r.engenheiro),
            estrutura: num(r.estrutura), indiretos: num(r.indiretos),
          }
        }))
        setCustoPorObra(custos)
      } else {
        setPessoas([]); setGerais([]); setPrecos([]); setRealizados([]); setCustoPorObra({})
      }

      const [oCap, oVia] = await Promise.all([
        supabase.rpc('fcp_capital', { p_fcp_id: id, p_semanas: horizonteSemanas }),
        supabase.rpc('fcp_viabilidade', { p_fcp_id: id }),
      ])
      const cap = (Array.isArray(oCap.data) ? oCap.data[0] : oCap.data) as FcpCapital | undefined
      setCapital(cap ? {
        pior_saldo: num(cap.pior_saldo), necessidade: num(cap.necessidade),
        contingencia: num(cap.contingencia), capital_recomendado: num(cap.capital_recomendado),
      } : null)
      setViabilidade(((oVia.data ?? []) as FcpViabilidade[]).map((v) => ({
        ...v, margem: num(v.margem), receita_liquida_mes: num(v.receita_liquida_mes),
        medicao_bruta_mes: num(v.medicao_bruta_mes), servicos_mes: num(v.servicos_mes),
        servicos_semana: num(v.servicos_semana), servicos_dia: num(v.servicos_dia),
        agua_dia: numN(v.agua_dia), esgoto_dia: numN(v.esgoto_dia),
      })))
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [horizonteSemanas])

  useEffect(() => { void carregarLista() }, [carregarLista])
  useEffect(() => { if (fcpId) void carregarDetalhe(fcpId) }, [fcpId, carregarDetalhe])

  const fcp = useMemo(() => fcps.find((f) => f.id === fcpId) ?? null, [fcps, fcpId])
  // aprovado trava a edição — o trigger fcp_trava_aprovado barra no banco de
  // qualquer jeito; aqui é só para a tela desabilitar os campos antes do erro.
  const travado = fcp?.status === 'aprovado'

  const recarregar = useCallback(async () => {
    await carregarLista()
    if (fcpId) await carregarDetalhe(fcpId)
  }, [carregarLista, carregarDetalhe, fcpId])

  const criarFcp = useCallback(async (nome: string, semanaRef: string) => {
    if (!supabase || !projetoId) return false
    setErro(null)
    // 1. o documento
    const { data: doc, error: e1 } = await supabase.from('fcp')
      .insert({ nome, semana_ref: semanaRef }).select('id').single()
    if (e1) {
      setErro(e1.code === '23505'
        ? 'Já existe um FCP para essa semana nesta empresa — selecione-o na lista.'
        : e1.message)
      return false
    }
    const novoId = (doc as { id: string }).id
    // 2. premissas padrão (mesmos defaults da migration 026); o engenheiro
    //    ajusta tudo na aba Premissas
    const fim = new Date(semanaRef + 'T12:00:00'); fim.setDate(fim.getDate() + 364)
    const { error: e2 } = await supabase.from('fcp_premissas')
      .insert({ fcp_id: novoId, inicio_obra: semanaRef, fim_operacao: fim.toISOString().slice(0, 10) })
    if (e2) { setErro(e2.message); return false }
    // 3. a obra do documento = a obra ativa do seletor. O CHECK do banco exige
    //    um modo de ticket, então entra com ticket_unico = 0 — a grade não
    //    projeta nada até o engenheiro preencher o ticket real em Custos.
    const nomeCurto = nome.replace(/^WCR\s*—\s*/i, '').toUpperCase()
    const { error: e3 } = await supabase.from('fcp_obra')
      .insert({ fcp_id: novoId, nome: nomeCurto, ordem: 1, projeto_id: projetoId, ticket_unico: 0 })
    if (e3) { setErro(e3.message); return false }
    await carregarLista()
    setFcpId(novoId)
    return true
  }, [projetoId, carregarLista])

  const salvarPremissas = useCallback(async (p: Partial<FcpPremissas>) => {
    if (!supabase || !fcpId || travado) return false
    const { error } = await supabase.from('fcp_premissas').update(p).eq('fcp_id', fcpId)
    if (error) { setErro(error.message); return false }
    await carregarDetalhe(fcpId)
    return true
  }, [fcpId, travado, carregarDetalhe])

  const salvarObra = useCallback(async (id: string, p: Partial<FcpObra>) => {
    if (!supabase || !fcpId || travado) return false
    const { error } = await supabase.from('fcp_obra').update(p).eq('id', id)
    if (error) { setErro(error.message); return false }
    await carregarDetalhe(fcpId)
    return true
  }, [fcpId, travado, carregarDetalhe])

  /** producao = null apaga o lançamento (a semana volta a usar o planejado). */
  const lancarRealizado = useCallback(async (obraId: string, semana: number, producao: number | null) => {
    if (!supabase || !fcpId || travado) return false
    const q = producao === null
      ? supabase.from('fcp_realizado').delete().eq('fcp_obra_id', obraId).eq('n_semana', semana)
      : supabase.from('fcp_realizado').upsert(
          { fcp_obra_id: obraId, n_semana: semana, producao },
          { onConflict: 'fcp_obra_id,n_semana' },
        )
    const { error } = await q
    if (error) { setErro(error.message); return false }
    await carregarDetalhe(fcpId)
    return true
  }, [fcpId, travado, carregarDetalhe])

  const mudarStatus = useCallback(async (novo: FcpStatus, observacao?: string) => {
    if (!supabase || !fcpId) return false
    const agora = new Date().toISOString()
    const patch: Record<string, unknown> = { status: novo }
    if (novo === 'enviado') patch.enviado_em = agora
    if (novo === 'aprovado') patch.aprovado_em = agora
    if (novo === 'devolvido') { patch.devolvido_em = agora; patch.observacao = observacao ?? null }
    const { error } = await supabase.from('fcp').update(patch).eq('id', fcpId)
    if (error) { setErro(error.message); return false }
    await recarregar()
    return true
  }, [fcpId, recarregar])

  return {
    fcps, fcpId, setFcpId, fcp, premissas, obras, pessoas, gerais, realizados, precos,
    semanas, capital, viabilidade, custoPorObra,
    loading, erro, tabelasAusentes, travado,
    recarregar, criarFcp, salvarPremissas, salvarObra, lancarRealizado, mudarStatus,
    horizonteSemanas, setHorizonteSemanas,
  }
}
