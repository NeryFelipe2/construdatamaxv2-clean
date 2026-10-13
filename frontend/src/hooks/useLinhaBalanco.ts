/**
 * useLinhaBalanco — dado REAL da Linha de Balanço (LOB) da aba Takt do LPS.
 *
 * Fontes (todas Supabase, nada inventado):
 *  - `logradouros`         → dimensão de ruas (94 cadastradas em 27/07): eixo Y.
 *                            `origem` diz de onde a rua veio: 'meta_ruas'
 *                            (campanha), 'cadastro_ligacoes' ou 'producao_diaria'.
 *  - `meta_ruas`           → só pra ORDENAR as ruas de origem meta_ruas pela
 *                            coluna `ordem` (a sequência de ataque da campanha).
 *  - `vw_producao_longa`   → producao_diaria despivotada em (data, rua_id,
 *                            etapa, qtd): cada linha é produção de UMA etapa
 *                            numa rua num dia. Agrego aqui por rua×data×etapa
 *                            (a view pode ter 2+ linhas quando duas equipes
 *                            apontaram a mesma etapa na mesma rua no mesmo dia).
 *  - `metas_producao`      → prazo da campanha (07/08) pro takt necessário
 *                            (ruas restantes ÷ dias até o fim). Pego a meta com
 *                            `periodo_fim` mais distante = a campanha 1500.
 *
 * DECISÃO: não filtro por projeto_id — o banco é WCR-only desde a limpeza de
 * 07/07 e existe FK legada projects×projetos que faria o filtro esconder tudo
 * dependendo do projeto ativo (mesma decisão documentada em
 * usePenteFinoCronograma.ts / useCommandCenter.ts). A tela declara as fontes.
 *
 * Padrão de hook do repo: useState/useCallback/useEffect + try/catch, supabase
 * de '@/lib/supabase' PODE SER NULL (checado antes de toda consulta). Painel é
 * somente leitura — não há escrita, logo não há update otimista aqui.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface LbRua {
  id: string
  nome: string
  nucleo: string | null
  /** 'meta_ruas' | 'cadastro_ligacoes' | 'producao_diaria' (coluna origem de logradouros). */
  origem: string
  /** ordem de ataque em meta_ruas (só ruas de origem meta_ruas; null nas demais). */
  ordemMeta: number | null
}

/** Produção agregada de UMA etapa numa rua num dia (rua_id null = sem match na dimensão). */
export interface LbPonto {
  ruaId: string | null
  /** ISO yyyy-mm-dd. */
  data: string
  etapa: string
  qtd: number
  /** equipes que apontaram (nomes crus de producao_diaria, deduplicados). */
  equipes: string[]
}

export interface LbCampanha {
  nome: string
  periodoIni: string
  periodoFim: string
}

export interface LinhaBalancoData {
  ruas: LbRua[]
  pontos: LbPonto[]
  campanha: LbCampanha | null
  /** janela real da produção (min→max de producao_diaria.data) — null sem dado. */
  janela: { de: string; ate: string } | null
  /** nº de dias DISTINTOS com produção apontada (o "36 dias de obra"). */
  diasComProducao: number
}

const VAZIO: LinhaBalancoData = {
  ruas: [],
  pontos: [],
  campanha: null,
  janela: null,
  diasComProducao: 0,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function iso(v: unknown): string {
  return String(v ?? '').slice(0, 10)
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useLinhaBalanco() {
  const [data, setData] = useState<LinhaBalancoData>(VAZIO)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase não configurado — sem dado real, a linha de balanço não é desenhada.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [ruasQ, ordemQ, prodQ, metaQ] = await Promise.all([
        supabase
          .from('logradouros')
          .select('id, nome_oficial, nucleo, origem')
          .order('nome_oficial', { ascending: true }),
        supabase
          .from('meta_ruas')
          .select('rua_id, ordem'),
        supabase
          .from('vw_producao_longa')
          .select('data, rua_id, etapa, qtd, equipe_nome')
          .order('data', { ascending: true }),
        supabase
          .from('metas_producao')
          .select('nome, periodo_ini, periodo_fim')
          .order('periodo_fim', { ascending: false })
          .limit(1),
      ])
      for (const q of [ruasQ, ordemQ, prodQ, metaQ]) {
        if (q.error) throw q.error
      }

      // ordem de ataque por rua_id (meta_ruas) — menor ordem vence se houver duplicata
      const ordemPorRua = new Map<string, number>()
      for (const r of (ordemQ.data ?? []) as Record<string, unknown>[]) {
        const ruaId = r.rua_id == null ? '' : String(r.rua_id)
        if (!ruaId) continue
        const ordem = num(r.ordem)
        const atual = ordemPorRua.get(ruaId)
        if (atual === undefined || ordem < atual) ordemPorRua.set(ruaId, ordem)
      }

      const ruas: LbRua[] = ((ruasQ.data ?? []) as Record<string, unknown>[]).map((r) => {
        const id = String(r.id)
        return {
          id,
          nome: String(r.nome_oficial ?? ''),
          nucleo: r.nucleo == null ? null : String(r.nucleo),
          origem: String(r.origem ?? ''),
          ordemMeta: ordemPorRua.has(id) ? (ordemPorRua.get(id) as number) : null,
        }
      })

      // agrega a view por rua×data×etapa (2+ equipes na mesma célula somam qtd)
      const porCelula = new Map<string, LbPonto>()
      for (const r of (prodQ.data ?? []) as Record<string, unknown>[]) {
        const qtd = num(r.qtd)
        if (qtd <= 0) continue // linha sem produção não vira ponto
        const ruaId = r.rua_id == null ? null : String(r.rua_id)
        const dataDia = iso(r.data)
        const etapa = String(r.etapa ?? '')
        const chave = `${ruaId ?? 'null'}|${dataDia}|${etapa}`
        const equipe = r.equipe_nome == null ? '' : String(r.equipe_nome).trim()
        const acc = porCelula.get(chave)
        if (acc) {
          acc.qtd += qtd
          if (equipe && !acc.equipes.includes(equipe)) acc.equipes.push(equipe)
        } else {
          porCelula.set(chave, { ruaId, data: dataDia, etapa, qtd, equipes: equipe ? [equipe] : [] })
        }
      }
      const pontos = [...porCelula.values()].sort((a, b) => a.data.localeCompare(b.data))

      const diasDistintos = new Set(pontos.map((p) => p.data))
      const janela = pontos.length > 0
        ? { de: pontos[0].data, ate: pontos[pontos.length - 1].data }
        : null

      const metaRow = (metaQ.data ?? [])[0] as Record<string, unknown> | undefined
      const campanha: LbCampanha | null = metaRow
        ? {
            nome: String(metaRow.nome ?? ''),
            periodoIni: iso(metaRow.periodo_ini),
            periodoFim: iso(metaRow.periodo_fim),
          }
        : null

      setData({ ruas, pontos, campanha, janela, diasComProducao: diasDistintos.size })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar a linha de balanço do banco')
      setData(VAZIO)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { ...data, loading, error, reload: load }
}
