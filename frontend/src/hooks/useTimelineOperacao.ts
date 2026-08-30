/**
 * useTimelineOperacao — LINHA DO TEMPO DA OPERAÇÃO (Gestão 360).
 * Une 4 fontes REAIS do Supabase em uma lista cronológica descendente (janela
 * de 14 dias, limit 200 por fonte — lazy, nada de carregar a tabela inteira):
 *
 *  1. producao_diaria  → eventos PRODUÇÃO (equipe + rua + quantidades apontadas)
 *  2. meta_baixas      → eventos BAIXA (marcos acumulados do export do app, com delta)
 *  3. ocorrencias_obra → eventos OCORRÊNCIA (abertura na `data`; resolução em
 *     `resolvido_em` vira um segundo evento). Destaques: origem='pente_fino' e
 *     descrições GRAVE/clandestina → severidade crítica.
 *  4. agenda_tasks     → eventos CRONOGRAMA (INÍCIO em data_inicio, FIM em data_fim,
 *     só tarefas agendadas — prancha oficial + pente fino F1-F4 etc.)
 *
 * Nada é inventado: fonte que falhar ou vier vazia entra em `fontesSemDado`
 * para a tela mostrar aviso âmbar honesto. Padrão de hook: useMetaCorredor.ts
 * (useState/useCallback/useEffect, load com try/catch).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type TimelineTipo = 'producao' | 'baixa' | 'ocorrencia' | 'cronograma'

export type TimelineSeveridade = 'ok' | 'atencao' | 'critico' | null

export interface TimelineNumero {
  label: string
  valor: string
}

export interface TimelineEvento {
  id: string
  tipo: TimelineTipo
  /** ISO yyyy-mm-dd — dia operacional do evento. */
  data: string
  /** 'HH:mm' quando existe hora real de registro no MESMO dia; senão null. */
  hora: string | null
  titulo: string
  detalhe: string | null
  /** Quantidades reais (chips monoespaçados). */
  numeros: TimelineNumero[]
  severidade: TimelineSeveridade
  /** Tag extra: 'PENTE FINO' | 'RESOLVIDA' | 'INÍCIO' | 'FIM' | fonte da baixa. */
  marcador: string | null
}

export interface TimelineResumo {
  /** Último acumulado real de meta_baixas dentro da janela (null = sem dado). */
  baixasAcumulado: number | null
  /** Alvo da campanha ativa (null = sem campanha). */
  campanhaAlvo: number | null
  campanhaNome: string | null
}

const JANELA_DIAS = 14
const LIMIT_POR_FONTE = 200

interface ProducaoRow {
  id: string
  data: string
  equipe_nome: string | null
  rua: string | null
  nucleo: string | null
  la: number | null
  le: number | null
  pra_m: number | string | null
  pre_m: number | string | null
  c_uma: number | null
  c_insp: number | null
  pv: number | null
  pi: number | null
  lia: number | null
  lie: number | null
  ihm: number | null
  intercept: number | null
  obs: string | null
  created_at: string
}

interface BaixaRow {
  id: string
  data: string
  acumulado: number | null
  fonte: string | null
  obs: string | null
}

interface OcorrenciaRow {
  id: string
  data: string
  tipo: string | null
  rua: string | null
  nucleo: string | null
  descricao: string | null
  resolvida: boolean | null
  resolvido_em: string | null
  origem: string | null
  reportado_por: string | null
  created_at: string
}

interface AgendaRow {
  id: string
  titulo: string
  data_inicio: string | null
  data_fim: string | null
  status: string | null
  encarregado: string | null
  equipe_id: string | null
  origem: string | null
}

function isoDia(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** 'HH:mm' de um timestamp SE ele cair no mesmo dia operacional; senão null (honesto). */
function horaSeMesmoDia(timestamp: string | null, diaOperacional: string): string | null {
  if (!timestamp) return null
  const t = new Date(timestamp)
  if (Number.isNaN(t.getTime())) return null
  if (isoDia(t) !== diaOperacional) return null
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
}

const CAMPOS_PRODUCAO: Array<{ key: keyof ProducaoRow; label: string; metros?: boolean }> = [
  { key: 'la', label: 'LA' },
  { key: 'le', label: 'LE' },
  { key: 'pra_m', label: 'PRA', metros: true },
  { key: 'pre_m', label: 'PRE', metros: true },
  { key: 'c_uma', label: 'C.UMA' },
  { key: 'c_insp', label: 'C.INSP' },
  { key: 'pv', label: 'PV' },
  { key: 'pi', label: 'PI' },
  { key: 'lia', label: 'LIA' },
  { key: 'lie', label: 'LIE' },
  { key: 'ihm', label: 'HM' },
  { key: 'intercept', label: 'INTERL' },
]

function numerosProducao(r: ProducaoRow): TimelineNumero[] {
  const out: TimelineNumero[] = []
  for (const campo of CAMPOS_PRODUCAO) {
    const bruto = r[campo.key]
    const n = Number(bruto)
    if (!Number.isFinite(n) || n === 0) continue
    out.push({ label: campo.label, valor: campo.metros ? `${n}m` : String(n) })
  }
  return out
}

function severidadeOcorrencia(r: OcorrenciaRow): TimelineSeveridade {
  const texto = `${r.descricao ?? ''} ${r.tipo ?? ''}`
  if (/clandestin|grave/i.test(texto) || r.tipo === 'seguranca') return 'critico'
  return 'atencao'
}

const ORDEM_TIPO: Record<TimelineTipo, number> = {
  ocorrencia: 0,
  baixa: 1,
  producao: 2,
  cronograma: 3,
}

export function useTimelineOperacao(projetoId: string | null) {
  const [eventos, setEventos] = useState<TimelineEvento[]>([])
  const [resumo, setResumo] = useState<TimelineResumo>({ baixasAcumulado: null, campanhaAlvo: null, campanhaNome: null })
  const [fontesSemDado, setFontesSemDado] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) {
      setEventos([])
      setFontesSemDado(supabase ? [] : ['Supabase não configurado'])
      return
    }
    setLoading(true)
    setError(null)

    const hoje = new Date()
    const desdeDate = new Date(hoje)
    desdeDate.setDate(desdeDate.getDate() - JANELA_DIAS)
    const desde = isoDia(desdeDate)
    const ate = isoDia(hoje)

    const semDado: string[] = []
    const todos: TimelineEvento[] = []
    let baixasAcumulado: number | null = null
    let campanhaAlvo: number | null = null
    let campanhaNome: string | null = null

    try {
      // ── 1. PRODUÇÃO — apontamentos da janela ────────────────────────────
      const qProducao = supabase
        .from('producao_diaria')
        .select('id, data, equipe_nome, rua, nucleo, la, le, pra_m, pre_m, c_uma, c_insp, pv, pi, lia, lie, ihm, intercept, obs, created_at')
        .eq('projeto_id', projetoId)
        .gte('data', desde)
        .order('data', { ascending: false })
        .limit(LIMIT_POR_FONTE)

      // ── 2. BAIXAS — campanha ativa → série meta_baixas ──────────────────
      const qCampanha = supabase
        .from('metas_campanha')
        .select('id, nome, alvo')
        .eq('projeto_id', projetoId)
        .eq('status', 'ativa')
        .order('data_inicio', { ascending: false })
        .limit(1)

      // ── 3. OCORRÊNCIAS — abertas na janela OU resolvidas na janela ──────
      // (inclui linhas legadas sem projeto_id — banco é WCR-only)
      const qOcorrencias = supabase
        .from('ocorrencias_obra')
        .select('id, data, tipo, rua, nucleo, descricao, resolvida, resolvido_em, origem, reportado_por, created_at')
        .or(`projeto_id.eq.${projetoId},projeto_id.is.null`)
        .or(`data.gte.${desde},resolvido_em.gte.${desde}`)
        .order('data', { ascending: false })
        .limit(LIMIT_POR_FONTE)

      // ── 4. CRONOGRAMA — tarefas agendadas começando/terminando na janela ─
      const qAgenda = supabase
        .from('agenda_tasks')
        .select('id, titulo, data_inicio, data_fim, status, encarregado, equipe_id, origem')
        .eq('projeto_id', projetoId)
        .neq('status', 'unscheduled')
        .or(`and(data_inicio.gte.${desde},data_inicio.lte.${ate}),and(data_fim.gte.${desde},data_fim.lte.${ate})`)
        .limit(LIMIT_POR_FONTE)

      const [rProducao, rCampanha, rOcorrencias, rAgenda] = await Promise.all([
        qProducao, qCampanha, qOcorrencias, qAgenda,
      ])

      // PRODUÇÃO
      if (rProducao.error) {
        semDado.push(`producao_diaria: ${rProducao.error.message}`)
      } else {
        const rows = (rProducao.data ?? []) as ProducaoRow[]
        if (rows.length === 0) semDado.push('producao_diaria: sem apontamentos na janela de 14 dias')
        for (const r of rows) {
          const dia = String(r.data).slice(0, 10)
          const numeros = numerosProducao(r)
          todos.push({
            id: `prod-${r.id}`,
            tipo: 'producao',
            data: dia,
            hora: horaSeMesmoDia(r.created_at, dia),
            titulo: r.equipe_nome?.trim() || 'Equipe não informada',
            detalhe: [r.rua, r.nucleo].filter(Boolean).join(' · ') || null,
            numeros: numeros.length > 0 ? numeros : [],
            severidade: numeros.length > 0 ? 'ok' : null,
            marcador: numeros.length === 0 ? 'SEM QUANTIDADE' : null,
          })
        }
      }

      // BAIXAS (série inteira p/ delta correto; só a janela vira evento)
      if (rCampanha.error) {
        semDado.push(`metas_campanha: ${rCampanha.error.message}`)
      } else {
        const campanha = (rCampanha.data ?? [])[0] as { id: string; nome: string; alvo: number | null } | undefined
        if (!campanha) {
          semDado.push('metas_campanha: nenhuma campanha ativa — sem marcos de baixa')
        } else {
          campanhaAlvo = Number(campanha.alvo) || null
          campanhaNome = campanha.nome
          const rBaixas = await supabase
            .from('meta_baixas')
            .select('id, data, acumulado, fonte, obs')
            .eq('campanha_id', campanha.id)
            .order('data', { ascending: true })
            .limit(LIMIT_POR_FONTE)
          if (rBaixas.error) {
            semDado.push(`meta_baixas: ${rBaixas.error.message}`)
          } else {
            const serie = (rBaixas.data ?? []) as BaixaRow[]
            if (serie.length === 0) semDado.push('meta_baixas: série vazia — sem marcos de baixa')
            let anterior = 0
            for (const p of serie) {
              const dia = String(p.data).slice(0, 10)
              const acum = Number(p.acumulado) || 0
              const delta = acum - anterior
              anterior = acum
              if (dia < desde) continue
              baixasAcumulado = acum
              todos.push({
                id: `baixa-${p.id}`,
                tipo: 'baixa',
                data: dia,
                hora: null,
                titulo: `Baixas de ligação — acumulado ${acum}`,
                detalhe: p.obs?.trim() || p.fonte?.trim() || null,
                numeros: [
                  { label: 'DIA', valor: `${delta >= 0 ? '+' : ''}${delta}` },
                  { label: 'ACUM', valor: String(acum) },
                ],
                severidade: 'ok',
                marcador: null,
              })
            }
          }
        }
      }

      // OCORRÊNCIAS
      if (rOcorrencias.error) {
        semDado.push(`ocorrencias_obra: ${rOcorrencias.error.message}`)
      } else {
        const rows = (rOcorrencias.data ?? []) as OcorrenciaRow[]
        if (rows.length === 0) semDado.push('ocorrencias_obra: nenhuma ocorrência na janela de 14 dias')
        for (const r of rows) {
          const diaAbertura = String(r.data).slice(0, 10)
          const penteFino = r.origem === 'pente_fino'
          const severidade = severidadeOcorrencia(r)
          const detalhe = [r.rua, r.nucleo].filter(Boolean).join(' · ') || null
          if (diaAbertura >= desde) {
            todos.push({
              id: `oco-${r.id}`,
              tipo: 'ocorrencia',
              data: diaAbertura,
              hora: null,
              titulo: r.descricao?.trim() || `Ocorrência (${r.tipo ?? 'sem tipo'})`,
              detalhe,
              numeros: [],
              severidade,
              marcador: penteFino ? 'PENTE FINO' : null,
            })
          }
          const diaResolucao = r.resolvido_em ? String(r.resolvido_em).slice(0, 10) : null
          if (diaResolucao && diaResolucao >= desde) {
            todos.push({
              id: `oco-res-${r.id}`,
              tipo: 'ocorrencia',
              data: diaResolucao,
              hora: horaSeMesmoDia(r.resolvido_em, diaResolucao),
              titulo: r.descricao?.trim() || `Ocorrência (${r.tipo ?? 'sem tipo'})`,
              detalhe,
              numeros: [],
              severidade: 'ok',
              marcador: 'RESOLVIDA',
            })
          }
        }
      }

      // CRONOGRAMA
      if (rAgenda.error) {
        semDado.push(`agenda_tasks: ${rAgenda.error.message}`)
      } else {
        const rows = (rAgenda.data ?? []) as AgendaRow[]
        if (rows.length === 0) semDado.push('agenda_tasks: nenhuma tarefa agendada começando/terminando na janela')
        for (const r of rows) {
          const responsavel = r.encarregado?.trim() || r.equipe_id?.trim() || null
          const ini = r.data_inicio ? String(r.data_inicio).slice(0, 10) : null
          const fim = r.data_fim ? String(r.data_fim).slice(0, 10) : null
          if (ini && ini >= desde && ini <= ate) {
            todos.push({
              id: `ag-ini-${r.id}`,
              tipo: 'cronograma',
              data: ini,
              hora: null,
              titulo: r.titulo,
              detalhe: [responsavel, fim ? `até ${fim.slice(8, 10)}/${fim.slice(5, 7)}` : null].filter(Boolean).join(' · ') || null,
              numeros: [],
              severidade: null,
              marcador: 'INÍCIO',
            })
          }
          if (fim && fim >= desde && fim <= ate) {
            todos.push({
              id: `ag-fim-${r.id}`,
              tipo: 'cronograma',
              data: fim,
              hora: null,
              titulo: r.titulo,
              detalhe: responsavel,
              numeros: [],
              severidade: null,
              marcador: 'FIM',
            })
          }
        }
      }

      // ordena: dia desc → hora desc (sem hora por último) → tipo (ocorrência primeiro)
      todos.sort((a, b) => {
        if (a.data !== b.data) return b.data.localeCompare(a.data)
        if (a.hora !== b.hora) {
          if (a.hora === null) return 1
          if (b.hora === null) return -1
          return b.hora.localeCompare(a.hora)
        }
        return ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo]
      })

      setEventos(todos)
      setResumo({ baixasAcumulado, campanhaAlvo, campanhaNome })
      setFontesSemDado(semDado)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar a linha do tempo da operação')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { load() }, [load])

  const contagens = useMemo(() => {
    const c: Record<TimelineTipo, number> = { producao: 0, baixa: 0, ocorrencia: 0, cronograma: 0 }
    for (const e of eventos) c[e.tipo] += 1
    return c
  }, [eventos])

  return { eventos, contagens, resumo, fontesSemDado, loading, error, reload: load }
}
