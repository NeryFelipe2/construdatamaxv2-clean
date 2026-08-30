/**
 * useCaixa.ts — dados do Controle de Caixa (lançamentos, horas extras,
 * conferência e relatórios).
 *
 * O saldo acumulado e os totalizadores são derivados aqui a partir das linhas
 * carregadas — não são gravados. Gravar um saldo significaria mantê-lo
 * sincronizado a cada lançamento editado, e o primeiro descompasso ninguém
 * perceberia.
 *
 * Degrada com elegância: sem as tabelas no banco, `tabelasAusentes` fica true
 * e a tela mostra o aviso em vez de quebrar.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type TipoLanc = 'RECEITA' | 'DESPESA'
export type StatusLanc = 'pendente' | 'conferido' | 'pago'
export type StatusHe = 'pendente' | 'PG'

export interface Categoria {
  id: string; nome: string; tipo: 'RECEITA' | 'DESPESA' | 'AMBOS'; ordem: number; ativo: boolean
}

export interface Lancamento {
  id: string
  tipo: TipoLanc
  data_inicio: string
  data_fim: string | null
  descricao: string
  valor: number
  categoria_id: string
  projeto_id: string | null
  obra_texto: string | null
  forma_pagamento: string | null
  status: StatusLanc
  anexo_url: string | null
  observacao: string | null
  conferido_por: string | null
  conferido_em: string | null
  origem: string
  created_at: string | null
  created_by: string | null
  solicitantes?: { pessoa_id: string; nome: string }[]
}

export interface HoraExtra {
  id: string
  pessoa_id: string
  data: string
  valor: number
  status: StatusHe
  projeto_id: string | null
  obra_texto: string | null
  observacao: string | null
  lancamento_id: string | null
  pessoa_nome?: string
  pessoa_cargo?: string
}

export interface ValorHeCargo {
  id: string; cargo_id: string | null; cargo_texto: string | null; valor: number
}

function ausente(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  const c = e.code ?? ''
  const m = (e.message ?? '').toLowerCase()
  return c === '42P01' || c === 'PGRST205' ||
    (m.includes('does not exist') && m.includes('relation')) || m.includes('could not find the table')
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))

export interface Totalizador { chave: string; rotulo: string; receita: number; despesa: number; saldo: number; qtd: number }

export interface UseCaixaReturn {
  categorias: Categoria[]
  lancamentos: Lancamento[]
  horasExtras: HoraExtra[]
  valoresHe: ValorHeCargo[]
  mes: string
  setMes: (m: string) => void
  loading: boolean
  erro: string | null
  tabelasAusentes: boolean
  // derivados
  totalReceita: number
  totalDespesa: number
  saldo: number
  comSaldoAcumulado: (Lancamento & { acumulado: number })[]
  porCategoria: Totalizador[]
  porObra: Totalizador[]
  porSolicitante: Totalizador[]
  pendentes: Lancamento[]
  // ações
  recarregar: () => Promise<void>
  criarLancamento: (l: Partial<Lancamento> & { solicitantes?: string[] }) => Promise<boolean>
  atualizarLancamento: (id: string, p: Partial<Lancamento>) => Promise<boolean>
  excluirLancamento: (id: string) => Promise<boolean>
  conferirEmLote: (ids: string[]) => Promise<boolean>
  lancarHe: (h: Partial<HoraExtra>) => Promise<boolean>
  mudarStatusHe: (id: string, status: StatusHe) => Promise<boolean>
  excluirHe: (id: string) => Promise<boolean>
  valorSugeridoHe: (cargo: string | null | undefined) => number | null
}

const mesAtual = () => new Date().toISOString().slice(0, 7)

export function useCaixa(): UseCaixaReturn {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [horasExtras, setHorasExtras] = useState<HoraExtra[]>([])
  const [valoresHe, setValoresHe] = useState<ValorHeCargo[]>([])
  const [mes, setMes] = useState(mesAtual())
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [tabelasAusentes, setTabelasAusentes] = useState(false)

  const carregar = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true); setErro(null)
    const ini = `${mes}-01`
    const fim = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).toISOString().slice(0, 10)
    try {
      const [oCat, oLanc, oHe, oVal] = await Promise.all([
        supabase.from('caixa_categoria').select('id, nome, tipo, ordem, ativo').is('deleted_at', null).order('ordem'),
        supabase.from('caixa_lancamento')
          .select('*, caixa_lancamento_solicitante(pessoa_id, pessoas(nome_completo))')
          .is('deleted_at', null).gte('data_inicio', ini).lte('data_inicio', fim)
          .order('data_inicio', { ascending: true }),
        supabase.from('horas_extras')
          .select('*, pessoas(nome_completo, cargo_texto)')
          .is('deleted_at', null).gte('data', ini).lte('data', fim).order('data'),
        supabase.from('he_valor_cargo').select('*').is('deleted_at', null),
      ])
      if (oCat.error && ausente(oCat.error)) { setTabelasAusentes(true); return }
      if (oCat.error) { setErro(oCat.error.message); return }

      setCategorias((oCat.data ?? []) as Categoria[])
      setLancamentos(((oLanc.data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as Lancamento),
        valor: num(r.valor),
        solicitantes: ((r.caixa_lancamento_solicitante ?? []) as { pessoa_id: string; pessoas?: { nome_completo?: string } }[])
          .map((s) => ({ pessoa_id: s.pessoa_id, nome: s.pessoas?.nome_completo ?? '(sem nome)' })),
      })))
      setHorasExtras(((oHe.data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as HoraExtra),
        valor: num(r.valor),
        pessoa_nome: (r.pessoas as { nome_completo?: string } | null)?.nome_completo ?? '(sem nome)',
        pessoa_cargo: (r.pessoas as { cargo_texto?: string } | null)?.cargo_texto ?? null,
      })))
      setValoresHe(((oVal.data ?? []) as ValorHeCargo[]).map((v) => ({ ...v, valor: num(v.valor) })))
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [mes])

  useEffect(() => { void carregar() }, [carregar])

  // ── derivados ────────────────────────────────────────────────────────────
  const totalReceita = useMemo(
    () => lancamentos.filter((l) => l.tipo === 'RECEITA').reduce((a, l) => a + l.valor, 0), [lancamentos])
  const totalDespesa = useMemo(
    () => lancamentos.filter((l) => l.tipo === 'DESPESA').reduce((a, l) => a + l.valor, 0), [lancamentos])
  const saldo = totalReceita - totalDespesa

  const comSaldoAcumulado = useMemo(() => {
    let ac = 0
    return [...lancamentos]
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio) || a.descricao.localeCompare(b.descricao))
      .map((l) => { ac += l.tipo === 'RECEITA' ? l.valor : -l.valor; return { ...l, acumulado: ac } })
  }, [lancamentos])

  const agrupar = useCallback((chave: (l: Lancamento) => { k: string; rotulo: string }[]): Totalizador[] => {
    const mapa = new Map<string, Totalizador>()
    for (const l of lancamentos) {
      for (const { k, rotulo } of chave(l)) {
        const t = mapa.get(k) ?? { chave: k, rotulo, receita: 0, despesa: 0, saldo: 0, qtd: 0 }
        if (l.tipo === 'RECEITA') t.receita += l.valor; else t.despesa += l.valor
        t.saldo = t.receita - t.despesa
        t.qtd++
        mapa.set(k, t)
      }
    }
    return [...mapa.values()].sort((a, b) => b.despesa - a.despesa)
  }, [lancamentos])

  const nomeCat = useCallback((id: string) => categorias.find((c) => c.id === id)?.nome ?? '(sem categoria)', [categorias])

  const porCategoria = useMemo(
    () => agrupar((l) => [{ k: l.categoria_id, rotulo: nomeCat(l.categoria_id) }]), [agrupar, nomeCat])
  const porObra = useMemo(
    () => agrupar((l) => [{ k: l.projeto_id ?? l.obra_texto ?? '—', rotulo: l.obra_texto ?? '(obra por id)' }]), [agrupar])
  const porSolicitante = useMemo(
    () => agrupar((l) => (l.solicitantes?.length
      ? l.solicitantes.map((s) => ({ k: s.pessoa_id, rotulo: s.nome }))
      : [{ k: '—', rotulo: '(sem solicitante)' }])), [agrupar])

  const pendentes = useMemo(() => lancamentos.filter((l) => l.status === 'pendente'), [lancamentos])

  const valorSugeridoHe = useCallback((cargo: string | null | undefined) => {
    if (!cargo) return null
    const alvo = cargo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    const achou = valoresHe.find((v) =>
      (v.cargo_texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim() === alvo)
    return achou?.valor ?? null
  }, [valoresHe])

  // ── ações ────────────────────────────────────────────────────────────────
  const criarLancamento = useCallback(async (l: Partial<Lancamento> & { solicitantes?: string[] }) => {
    if (!supabase) return false
    const { solicitantes, ...campos } = l
    const { data, error } = await supabase.from('caixa_lancamento').insert(campos).select('id').single()
    if (error) { setErro(error.message); return false }
    if (solicitantes?.length) {
      await supabase.from('caixa_lancamento_solicitante')
        .insert(solicitantes.map((p) => ({ lancamento_id: (data as { id: string }).id, pessoa_id: p })))
    }
    await carregar(); return true
  }, [carregar])

  const atualizarLancamento = useCallback(async (id: string, p: Partial<Lancamento>) => {
    if (!supabase) return false
    const { error } = await supabase.from('caixa_lancamento').update(p).eq('id', id)
    if (error) { setErro(error.message); return false }
    await carregar(); return true
  }, [carregar])

  // exclusão é SOFT: o audit_log guarda o antes, e o registro some da tela
  const excluirLancamento = useCallback(async (id: string) => {
    if (!supabase) return false
    const { error } = await supabase.from('caixa_lancamento')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { setErro(error.message); return false }
    await carregar(); return true
  }, [carregar])

  const conferirEmLote = useCallback(async (ids: string[]) => {
    if (!supabase || ids.length === 0) return false
    const { data: sess } = await supabase.auth.getUser()
    const { error } = await supabase.from('caixa_lancamento')
      .update({ status: 'conferido', conferido_em: new Date().toISOString(), conferido_por: sess?.user?.id ?? null })
      .in('id', ids)
    if (error) { setErro(error.message); return false }
    await carregar(); return true
  }, [carregar])

  const lancarHe = useCallback(async (h: Partial<HoraExtra>) => {
    if (!supabase) return false
    const { error } = await supabase.from('horas_extras')
      .upsert(h, { onConflict: 'pessoa_id,data' })
    if (error) { setErro(error.message); return false }
    await carregar(); return true
  }, [carregar])

  const mudarStatusHe = useCallback(async (id: string, status: StatusHe) => {
    if (!supabase) return false
    const { error } = await supabase.from('horas_extras').update({ status }).eq('id', id)
    if (error) { setErro(error.message); return false }
    await carregar(); return true
  }, [carregar])

  const excluirHe = useCallback(async (id: string) => {
    if (!supabase) return false
    const { error } = await supabase.from('horas_extras')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { setErro(error.message); return false }
    await carregar(); return true
  }, [carregar])

  return {
    categorias, lancamentos, horasExtras, valoresHe, mes, setMes,
    loading, erro, tabelasAusentes,
    totalReceita, totalDespesa, saldo, comSaldoAcumulado,
    porCategoria, porObra, porSolicitante, pendentes,
    recarregar: carregar, criarLancamento, atualizarLancamento, excluirLancamento,
    conferirEmLote, lancarHe, mudarStatusHe, excluirHe, valorSugeridoHe,
  }
}
