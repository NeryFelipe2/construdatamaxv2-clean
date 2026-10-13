/**
 * useSupabaseNsPlanejamento — Feito × A Fazer.
 *
 * Fase 3 (10/07/2026): reapontado do pipeline antigo (planejamento_itens/
 * planejamentos_semanais/desvios_planejamento, vindo de um ETL QGIS de
 * 06/07) pra ler direto de `ns` (+ `pv` só pra saber água/esgoto) — a fonte
 * real e única de Notas de Serviço por trecho a partir de agora (162 NS
 * importadas dos croquis do Motor NS, Fase 3). Mantém a MESMA forma de
 * retorno (ResumoPlano/NsItem) pra não precisar mexer na tela.
 *
 * 13/07/2026 — o RESUMO (% feito dos cards do topo) passou a vir de
 * `rede_status_campo`: 592 trechos com status FEITO/A_FAZER real, importados
 * do levantamento de campo em QGIS/GPKG do Felipe (não é RDO nem NS —
 * é o "as-built" verificado em campo, mais granular que as 162 NS). A lista
 * de NS abaixo (`itens`, com o botão "marcar concluído") continua vindo de
 * `ns` — é o registro administrativo (Nota de Serviço oficial), um conceito
 * complementar, não a mesma fonte. O GPKG é uma FOTO de campo (não é live):
 * `fonte_data` carrega a data do levantamento pra tela avisar honestamente
 * que não é tempo real.
 *
 * Honestidade: campos sem equivalente na nova fonte (equipe_original,
 * ligacoes_ou_ramais, desvio, materiais, por_rua, as duas *_baixas) voltam
 * zerados/null — nada é estimado ou inventado. `desvio` fica sempre null até
 * existir rastreamento de atraso por NS (fora do escopo desta fase).
 *
 * 20/07/2026 — `desviosHistoricos`: a tabela `desvios_planejamento` (pipeline
 * antigo, ETL QGIS de 06/07, mesmo lote descrito acima) tem 32 registros
 * reais nunca resolvidos (`resolvido_em` null, `planejamento_itens.status`
 * = 'pendente' nos 32) e não aparecia em NENHUMA tela. A nomenclatura das NS
 * desse lote antigo ("NS ÁGUA JESSE 01") não bate com a numeração atual
 * (162 NS dos croquis Motor NS, "NS 25 — PV1 → PV2") — são universos
 * diferentes, sem chave de junção confiável — por isso entram como seção
 * histórica separada (somaria errado se fossem mescladas item a item com
 * `itens`). `sistema` é derivado do texto de `atividade` (100% dos 32 têm
 * ÁGUA/AGUA ou ESGOTO no nome, conferido em produção).
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ResumoSistema {
  feito_m: number
  a_fazer_m: number
  total_m: number
  pct_feito: number
}

export interface ResumoPlano {
  agua: ResumoSistema
  esgoto: ResumoSistema
  esgoto_baixas: { registros: number; ids_distintos: number; periodo_fonte: string; ramais_pendentes_gis: number; estimativa_pct: number }
  agua_baixas: { informado_felipe: number; ligacoes_pendentes_gis: number; estimativa_pct: number }
  atualizado_em: string
  por_rua?: Array<{ rua: string; esgoto_exec_m: number; esgoto_afazer_m: number; agua_exec_m: number; agua_afazer_m: number }> | undefined
  /** data do levantamento de campo (GPKG) que alimenta o % feito — snapshot, não tempo real */
  fonte_data: string | null
}

export interface NsItem {
  id: string
  atividade: string
  descricao: string
  quantidade_planejada: number
  data_inicio: string | null
  status: string
  sistema: 'AGUA' | 'ESGOTO'
  equipe_original: string
  equipe_id: string | null
  ligacoes_ou_ramais: number
  desvio: {
    id: string
    severidade: string
    dias_atraso: number
    acao_recomendada: string
  } | null
  materiais?: {
    brita_m3: number
    areia_m3?: number
    lastro_m3?: number
    reaterro_m3?: number
    bgs_m3?: number
    escavacao_m3?: number
    dias_vca?: number
    dias_mnd?: number
    prof_med_m?: number
    material?: string
  } | null
}

export interface DesvioHistorico {
  id: string
  data: string
  atividade: string
  sistema: 'AGUA' | 'ESGOTO'
  quantidade_planejada: number
  severidade: string
  acao_recomendada: string | null
  dias_sem_confirmacao: number
}

const CONCLUIDOS = new Set(['CONCLUIDA', 'MEDIDA'])

function vazioBaixas() {
  return {
    esgoto_baixas: { registros: 0, ids_distintos: 0, periodo_fonte: '', ramais_pendentes_gis: 0, estimativa_pct: 0 },
    agua_baixas: { informado_felipe: 0, ligacoes_pendentes_gis: 0, estimativa_pct: 0 },
  }
}

export function useSupabaseNsPlanejamento(projetoId: string | null) {
  const [resumo, setResumo] = useState<ResumoPlano | null>(null)
  const [itens, setItens] = useState<NsItem[]>([])
  const [desviosHistoricos, setDesviosHistoricos] = useState<DesvioHistorico[]>([])
  const [planoId, setPlanoId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) return
    setLoading(true)
    setError(null)
    try {
      // Só a fonte confirmada como produção real (162 NS dos croquis do Motor
      // NS, Fase 3) — exclui rascunhos/teste de import (ex.: 'import_geo_browser'
      // da Fase 1, 'PVS_TRECHOS' de teste) pra não inflar o total com dado não
      // confirmado como oficial.
      const { data: nsData, error: e1 } = await supabase
        .from('ns')
        .select('id, seq, pv_ini, pv_fim, ext_m, dn_mm, material, rua, status, data_inicio, equipe_id')
        .eq('projeto_id', projetoId)
        .like('origem_dados', 'croqui_motor_ns_%')
        .order('seq')
      if (e1) throw e1

      const { data: pvData, error: e2 } = await supabase
        .from('pv')
        .select('nome, is_agua')
        .eq('projeto_id', projetoId)
      if (e2) throw e2
      const isAguaPorNome = new Map((pvData ?? []).map((p) => [p.nome, p.is_agua]))

      const mapeado: NsItem[] = (nsData ?? []).map((ns) => {
        const isAgua = isAguaPorNome.get(ns.pv_ini) ?? isAguaPorNome.get(ns.pv_fim) ?? true
        const concluida = CONCLUIDOS.has(ns.status)
        return {
          id: String(ns.id),
          atividade: `NS ${ns.seq} — ${ns.pv_ini} → ${ns.pv_fim}`,
          descricao: [ns.dn_mm ? `DN${ns.dn_mm}mm` : null, ns.material, ns.rua].filter(Boolean).join(' · '),
          quantidade_planejada: Number(ns.ext_m) || 0,
          data_inicio: ns.data_inicio,
          status: concluida ? 'concluida' : ns.status.toLowerCase(),
          sistema: isAgua ? 'AGUA' : 'ESGOTO',
          equipe_original: '',
          equipe_id: ns.equipe_id,
          ligacoes_ou_ramais: 0,
          desvio: null,
          materiais: null,
        }
      })
      setItens(mapeado)
      setPlanoId(projetoId)

      // % feito real: levantamento de campo (rede_status_campo, do GPKG) —
      // mais granular e mais confiável que ns.status (162 NS nunca marcadas
      // manualmente). Se a tabela estiver vazia (projeto sem levantamento
      // ainda), cai pro cálculo antigo por ns.status — nunca fica sem número.
      const { data: campoData, error: e3 } = await supabase
        .from('rede_status_campo')
        .select('sistema, status, ext_m, data_levantamento')
        .eq('projeto_id', projetoId)
      if (e3) throw e3

      const resumoSistemaNs = (sis: 'AGUA' | 'ESGOTO'): ResumoSistema => {
        const doSistema = mapeado.filter((i) => i.sistema === sis)
        const feito_m = doSistema.filter((i) => i.status === 'concluida').reduce((s, i) => s + i.quantidade_planejada, 0)
        const total_m = doSistema.reduce((s, i) => s + i.quantidade_planejada, 0)
        const a_fazer_m = Math.max(0, total_m - feito_m)
        return { feito_m, a_fazer_m, total_m, pct_feito: total_m > 0 ? (feito_m / total_m) * 100 : 0 }
      }

      const resumoSistemaCampo = (sis: 'AGUA' | 'ESGOTO'): ResumoSistema | null => {
        const doSistema = (campoData ?? []).filter((r) => r.sistema === sis)
        if (doSistema.length === 0) return null
        const feito_m = doSistema.filter((r) => r.status === 'FEITO').reduce((s, r) => s + Number(r.ext_m || 0), 0)
        const total_m = doSistema.reduce((s, r) => s + Number(r.ext_m || 0), 0)
        const a_fazer_m = Math.max(0, total_m - feito_m)
        return { feito_m, a_fazer_m, total_m, pct_feito: total_m > 0 ? (feito_m / total_m) * 100 : 0 }
      }

      const fonteData = (campoData ?? [])[0]?.data_levantamento ?? null

      // Histórico de desvios do pipeline antigo (ver comentário no topo do
      // arquivo) — só os nunca resolvidos (resolvido_em null).
      const { data: desviosData, error: e4 } = await supabase
        .from('desvios_planejamento')
        .select('id, data, atividade, quantidade_planejada, severidade, acao_recomendada')
        .eq('projeto_id', projetoId)
        .is('resolvido_em', null)
        .order('data', { ascending: false })
      if (e4) throw e4

      const hojeMs = Date.now()
      setDesviosHistoricos((desviosData ?? []).map((d) => ({
        id: String(d.id),
        data: d.data,
        atividade: d.atividade,
        sistema: /esgoto/i.test(d.atividade) ? 'ESGOTO' : 'AGUA',
        quantidade_planejada: Number(d.quantidade_planejada) || 0,
        severidade: d.severidade,
        acao_recomendada: d.acao_recomendada,
        dias_sem_confirmacao: Math.max(0, Math.floor((hojeMs - new Date(d.data).getTime()) / 86400000)),
      })))

      setResumo({
        agua: resumoSistemaCampo('AGUA') ?? resumoSistemaNs('AGUA'),
        esgoto: resumoSistemaCampo('ESGOTO') ?? resumoSistemaNs('ESGOTO'),
        ...vazioBaixas(),
        atualizado_em: new Date().toISOString().slice(0, 10),
        por_rua: undefined,
        fonte_data: fonteData,
      })
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar Notas de Serviço')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { load() }, [load])

  const marcarConcluido = useCallback(async (item: NsItem) => {
    if (!supabase) return
    setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'concluida', desvio: null } : i)))
    try {
      await supabase.from('ns').update({ status: 'CONCLUIDA' }).eq('id', Number(item.id))
    } catch {
      load() // reverte via reload em caso de erro
    }
  }, [load])

  const atribuirEquipe = useCallback(async (item: NsItem, equipeId: string | null) => {
    if (!supabase) return
    setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, equipe_id: equipeId } : i)))
    try {
      const { error } = await supabase.from('ns').update({ equipe_id: equipeId }).eq('id', Number(item.id))
      if (error) throw error
    } catch {
      load() // reverte via reload em caso de erro
    }
  }, [load])

  return { resumo, itens, desviosHistoricos, planoId, loading, error, reload: load, marcarConcluido, atribuirEquipe }
}
