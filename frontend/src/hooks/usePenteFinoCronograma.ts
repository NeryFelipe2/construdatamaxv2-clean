/**
 * usePenteFinoCronograma — cronograma REAL de reparo dos PVs do pente fino
 * (tabela `pente_fino_cronograma`, núcleo Boi Malhado / esgoto).
 *
 * Origem do dado: BOI_MALHADO_ESGOTO.gpkg atualizado em 25/07 — o campo passou a
 * preencher duas colunas novas no GPKG ("Arrumado" e "data de execução"), que
 * viraram `arrumado` e `data_execucao` aqui. 16 PVs têm data marcada PELO CAMPO;
 * em 27/07 os outros 74 ganharam data PROPOSTA (`proposta=true`, 2 frentes ×
 * 4 PVs/dia agrupadas por rua, prazo 09/08) — proposta é rotulada como proposta,
 * o campo confirma pelo mesmo fluxo do GPKG. Cada PV também carrega as frentes
 * (`equipe_principal`/`equipe_apoio`: eq-pv Michael Douglas / eq-esgoto Juan
 * Carlos — o pedido "reparo dos PVs com o pessoal de esgoto").
 *
 * Honestidade do status (`arrumado`):
 *  - 'feito'    → o campo confirmou o reparo;
 *  - 'a fazer'  → o campo confirmou que ainda está pendente;
 *  - null       → NÃO existe confirmação de campo. Isso NÃO é "pendente": é
 *                 ausência de informação, e a tela mostra exatamente isso.
 *
 * NÃO filtra por projeto_id: a tabela é pequena (16 linhas, um único núcleo) e
 * existem telas rodando com outro projeto ativo — filtrar esconderia o cronograma
 * inteiro. Mesma decisão de useCampoWhatsapp.ts. A tela declara a fonte.
 *
 * Padrão de hook: useState/useCallback/useEffect + try-catch, update otimista com
 * revert em erro e reload ao final (igual useMetaCorredor.ts / useCampoWhatsapp.ts).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** Estado de reparo confirmado pelo campo. `null` = sem confirmação (não é "pendente"). */
export type PenteFinoArrumado = 'feito' | 'a fazer' | null

export interface PenteFinoPv {
  id: string
  projeto_id: string | null
  /** Identificador do PV/PI no cadastro do pente fino (ex.: "PI-18", "PV-EX (Vanessa 108)"). */
  pv: string
  /** "PV" (poço de visita) ou "PI" (poço de inspeção). */
  tipo: string | null
  /** "Executado" / "Existente" — situação cadastral do poço. */
  situacao: string | null
  profundidade_m: number | null
  rua: string | null
  casa_frente: string | null
  folhas: string | null
  arrumado: PenteFinoArrumado
  /** ISO YYYY-MM-DD — data programada de execução do reparo. */
  data_execucao: string
  /** Frente principal do reparo (id de wcr_equipes, ex.: 'eq-pv', 'eq-esgoto'). */
  equipe_principal: string | null
  /** Frente de apoio (pedido do Felipe: pessoal de esgoto junto nos PVs). */
  equipe_apoio: string | null
  /** true = data PROPOSTA (27/07, 2 frentes × 4/dia por rua) — o campo confirma; false = data marcada pelo campo no GPKG. */
  proposta: boolean
  fonte: string | null
  updated_at: string | null
}

export interface PenteFinoDia {
  /** ISO YYYY-MM-DD. */
  data: string
  itens: PenteFinoPv[]
}

export interface PenteFinoKpis {
  /** PVs com data programada na tabela. */
  programados: number
  /** PVs cuja data foi marcada PELO CAMPO no GPKG (proposta=false). */
  doCampo: number
  /** PVs com data PROPOSTA (proposta=true) aguardando confirmação do campo. */
  propostos: number
  feitos: number
  aFazer: number
  /** `arrumado` null — sem confirmação de campo. */
  semConfirmacao: number
  /** Total de PVs do cadastro do pente fino (constante documentada, ver CADASTRO_PVS_TOTAL). */
  cadastroTotal: number
  /** cadastroTotal − programados: PVs do cadastro ainda SEM data no cronograma. */
  semDataProgramada: number
}

/**
 * Total de PVs levantados no pente fino do esgoto do Boi Malhado.
 * Fonte: caderno GUIA_PVS_A4_1-200.pdf (90 PVs, 43 pranchas 1:200 + índice),
 * gerado do cadastro de campo. NÃO é derivado da tabela `pv` do banco — aquela
 * mistura PVs de projeto e junctions de outros núcleos (157 linhas no Boi esgoto)
 * e responderia outra pergunta. Constante explícita para não inventar número.
 */
export const CADASTRO_PVS_TOTAL = 90

interface DbRow {
  id: string
  projeto_id: string | null
  pv: string
  tipo: string | null
  situacao: string | null
  profundidade_m: number | string | null
  rua: string | null
  casa_frente: string | null
  folhas: string | null
  arrumado: string | null
  data_execucao: string
  equipe_principal: string | null
  equipe_apoio: string | null
  proposta: boolean | null
  fonte: string | null
  updated_at: string | null
}

function normalizaArrumado(v: string | null): PenteFinoArrumado {
  if (!v) return null
  const s = v.trim().toLowerCase()
  if (s === 'feito') return 'feito'
  if (s === 'a fazer' || s === 'à fazer' || s === 'afazer') return 'a fazer'
  return null
}

export function usePenteFinoCronograma() {
  const [pvs, setPvs] = useState<PenteFinoPv[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) { setPvs([]); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('pente_fino_cronograma')
        .select('id, projeto_id, pv, tipo, situacao, profundidade_m, rua, casa_frente, folhas, arrumado, data_execucao, equipe_principal, equipe_apoio, proposta, fonte, updated_at')
        .order('data_execucao', { ascending: true })
        .order('pv', { ascending: true })
      if (e1) throw e1
      setPvs(
        ((data ?? []) as DbRow[]).map((r) => ({
          id: r.id,
          projeto_id: r.projeto_id,
          pv: r.pv,
          tipo: r.tipo,
          situacao: r.situacao,
          profundidade_m: r.profundidade_m === null ? null : Number(r.profundidade_m),
          rua: r.rua,
          casa_frente: r.casa_frente,
          folhas: r.folhas,
          arrumado: normalizaArrumado(r.arrumado),
          data_execucao: String(r.data_execucao).slice(0, 10),
          equipe_principal: r.equipe_principal,
          equipe_apoio: r.equipe_apoio,
          proposta: r.proposta === true,
          fonte: r.fonte,
          updated_at: r.updated_at,
        })),
      )
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar o cronograma do pente fino')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /**
   * Grava o estado de reparo de um PV (o campo fecha o item pela tela).
   * Otimista: pinta na hora, reverte se o banco recusar, recarrega ao final.
   */
  const marcarArrumado = useCallback(async (id: string, valor: PenteFinoArrumado) => {
    if (!supabase) return
    const anterior = pvs
    setPvs((prev) => prev.map((p) => (p.id === id ? { ...p, arrumado: valor } : p)))
    try {
      const { error: e1 } = await supabase
        .from('pente_fino_cronograma')
        .update({ arrumado: valor, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (e1) throw e1
      load()
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao gravar o status do PV')
      setPvs(anterior) // reverte
    }
  }, [pvs, load])

  /** PVs agrupados por data programada, em ordem crescente. */
  const dias = useMemo<PenteFinoDia[]>(() => {
    const out: PenteFinoDia[] = []
    for (const p of [...pvs].sort((a, b) => (
      a.data_execucao === b.data_execucao
        ? a.pv.localeCompare(b.pv)
        : a.data_execucao.localeCompare(b.data_execucao)
    ))) {
      const ultimo = out[out.length - 1]
      if (ultimo && ultimo.data === p.data_execucao) ultimo.itens.push(p)
      else out.push({ data: p.data_execucao, itens: [p] })
    }
    return out
  }, [pvs])

  const kpis = useMemo<PenteFinoKpis>(() => {
    const programados = pvs.length
    const propostos = pvs.filter((p) => p.proposta).length
    const feitos = pvs.filter((p) => p.arrumado === 'feito').length
    const aFazer = pvs.filter((p) => p.arrumado === 'a fazer').length
    return {
      programados,
      doCampo: programados - propostos,
      propostos,
      feitos,
      aFazer,
      semConfirmacao: programados - feitos - aFazer,
      cadastroTotal: CADASTRO_PVS_TOTAL,
      semDataProgramada: Math.max(0, CADASTRO_PVS_TOTAL - programados),
    }
  }, [pvs])

  /** Janela do cronograma (primeira e última data programada) — null se não houver dado. */
  const janela = useMemo(() => {
    if (dias.length === 0) return null
    return { inicio: dias[0].data, fim: dias[dias.length - 1].data }
  }, [dias])

  /** Rótulo da fonte declarado pelas próprias linhas (ex.: "BOI_MALHADO_ESGOTO.gpkg (25/07)"). */
  const fonte = useMemo(() => pvs.find((p) => p.fonte)?.fonte ?? null, [pvs])

  return { pvs, dias, kpis, janela, fonte, loading, error, reload: load, marcarArrumado }
}
