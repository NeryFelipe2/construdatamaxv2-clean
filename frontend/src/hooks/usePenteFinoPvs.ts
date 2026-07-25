/**
 * usePenteFinoPvs — cruza o cronograma do PENTE FINO (`pente_fino_cronograma`,
 * extraído do BOI_MALHADO_ESGOTO.gpkg com os campos novos "Arrumado" e
 * "data de execução" que o campo passou a preencher) com a tabela `pv` — a
 * única que tem lat/lon — pra conseguir plotar no Mapa Interativo os PVs que
 * precisam ser arrumados.
 *
 * O cronograma NÃO traz coordenada (utm_e/utm_n vêm nulos no import), então a
 * posição de um PV só existe quando o NOME casa com um PV do cadastro. O
 * casamento é por `projeto_id` + nome normalizado: maiúsculas, sem pontuação,
 * zeros à esquerda do número removidos ("PV-19" == "PV-019"). Prefixo diferente
 * NÃO casa de propósito — "PI-107" não vira "PVE_107", isso seria inventar
 * posição. Nome que casa com mais de uma linha de `pv` também é descartado
 * (ambíguo). Tudo que não casou sai em `semCoordenada` pra tela avisar em
 * âmbar, com o motivo.
 *
 * Padrão de hook: useState/useCallback/useEffect + try/catch, igual
 * useMetaCorredor.ts. Nada é inventado — sem casamento, sem marcador.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type PenteFinoStatus = 'feito' | 'a fazer' | 'sem confirmacao'

/** Linha do cronograma que conseguiu coordenada via `pv`. */
export interface PenteFinoPonto {
  id: string
  pv: string
  tipo: string | null
  situacao: string | null
  profundidadeM: number | null
  rua: string | null
  casaFrente: string | null
  status: PenteFinoStatus
  /** ISO yyyy-mm-dd do dia programado (null = sem data no cronograma). */
  dataExecucao: string | null
  lat: number
  lon: number
  /** nome exato da linha de `pv` que casou — deixa o cruzamento auditável. */
  pvCasado: string
  /** programado pra antes de hoje e ainda sem 'feito' confirmado. */
  atrasado: boolean
}

/** Linha do cronograma que ficou SEM posição — nunca é plotada. */
export interface PenteFinoSemCoord {
  id: string
  pv: string
  rua: string | null
  dataExecucao: string | null
  status: PenteFinoStatus
  motivo: 'sem PV de mesmo nome no cadastro' | 'nome ambiguo no cadastro'
}

interface CronogramaRow {
  id: string
  pv: string | null
  tipo: string | null
  situacao: string | null
  profundidade_m: number | string | null
  rua: string | null
  casa_frente: string | null
  arrumado: string | null
  data_execucao: string | null
  projeto_id: string | null
}

interface PvRow {
  nome: string | null
  lat: number | null
  lon: number | null
  projeto_id: string | null
}

/**
 * Normaliza um nome de PV pra chave de casamento: "PV-19" e "PV_019" viram
 * "PV|19"; "PI-107" vira "PI|107" (que não existe em `pv`, logo não casa).
 * Nome sem o formato letras+número (ex.: "PV-EX (Vanessa 108)") devolve o nome
 * cru normalizado, que também não casa com nada — de propósito.
 */
function chaveNome(nome: string): string {
  const limpo = nome.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const m = limpo.match(/^([A-Z]+)0*(\d+)$/)
  if (!m) return `RAW|${limpo}`
  return `${m[1]}|${Number(m[2])}`
}

function normalizaStatus(arrumado: string | null): PenteFinoStatus {
  const v = (arrumado ?? '').trim().toLowerCase()
  if (v === 'feito') return 'feito'
  if (v === 'a fazer') return 'a fazer'
  return 'sem confirmacao'
}

/** yyyy-mm-dd de hoje no fuso local (sem UTC shift). */
function hojeIso(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function usePenteFinoPvs(projetoId: string | null) {
  const [pontos, setPontos] = useState<PenteFinoPonto[]>([])
  const [semCoordenada, setSemCoordenada] = useState<PenteFinoSemCoord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) { setPontos([]); setSemCoordenada([]); setTotal(0); return }
    setLoading(true)
    setError(null)
    try {
      let cronoQuery = supabase
        .from('pente_fino_cronograma')
        .select('id, pv, tipo, situacao, profundidade_m, rua, casa_frente, arrumado, data_execucao, projeto_id')
        .order('data_execucao', { ascending: true })
      if (projetoId) cronoQuery = cronoQuery.eq('projeto_id', projetoId)
      const { data: cronoData, error: e1 } = await cronoQuery
      if (e1) throw e1

      const crono = (cronoData ?? []) as CronogramaRow[]
      if (crono.length === 0) {
        setPontos([]); setSemCoordenada([]); setTotal(0)
        return
      }

      let pvQuery = supabase
        .from('pv')
        .select('nome, lat, lon, projeto_id')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
      if (projetoId) pvQuery = pvQuery.eq('projeto_id', projetoId)
      const { data: pvData, error: e2 } = await pvQuery
      if (e2) throw e2

      // índice projeto|chave → linhas de `pv` (mais de uma = ambíguo, não usa)
      const indice = new Map<string, PvRow[]>()
      for (const p of (pvData ?? []) as PvRow[]) {
        if (!p.nome || p.lat == null || p.lon == null) continue
        const k = `${p.projeto_id ?? ''}#${chaveNome(p.nome)}`
        const atual = indice.get(k)
        if (atual) atual.push(p)
        else indice.set(k, [p])
      }

      const hoje = hojeIso()
      const comCoord: PenteFinoPonto[] = []
      const sem: PenteFinoSemCoord[] = []

      for (const c of crono) {
        const nome = (c.pv ?? '').trim()
        if (!nome) continue
        const status = normalizaStatus(c.arrumado)
        const dataExecucao = c.data_execucao ? String(c.data_execucao).slice(0, 10) : null
        const candidatos = indice.get(`${c.projeto_id ?? ''}#${chaveNome(nome)}`) ?? []

        if (candidatos.length !== 1) {
          sem.push({
            id: c.id,
            pv: nome,
            rua: c.rua,
            dataExecucao,
            status,
            motivo: candidatos.length === 0 ? 'sem PV de mesmo nome no cadastro' : 'nome ambiguo no cadastro',
          })
          continue
        }

        const casado = candidatos[0]
        const prof = c.profundidade_m == null ? null : Number(c.profundidade_m)
        comCoord.push({
          id: c.id,
          pv: nome,
          tipo: c.tipo,
          situacao: c.situacao,
          profundidadeM: prof != null && Number.isFinite(prof) ? prof : null,
          rua: c.rua,
          casaFrente: c.casa_frente,
          status,
          dataExecucao,
          lat: casado.lat as number,
          lon: casado.lon as number,
          pvCasado: casado.nome as string,
          atrasado: dataExecucao != null && dataExecucao < hoje && status !== 'feito',
        })
      }

      setPontos(comCoord)
      setSemCoordenada(sem)
      setTotal(crono.length)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar o cronograma do pente fino')
      setPontos([]); setSemCoordenada([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { load() }, [load])

  /** Contagem por status sobre o cronograma INTEIRO (não só o que foi plotado). */
  const resumo = useMemo(() => {
    const todos: PenteFinoStatus[] = [
      ...pontos.map((p) => p.status),
      ...semCoordenada.map((s) => s.status),
    ]
    return {
      feito: todos.filter((s) => s === 'feito').length,
      aFazer: todos.filter((s) => s === 'a fazer').length,
      semConfirmacao: todos.filter((s) => s === 'sem confirmacao').length,
      plotados: pontos.length,
      semCoordenada: semCoordenada.length,
      total,
    }
  }, [pontos, semCoordenada, total])

  return { pontos, semCoordenada, resumo, loading, error, reload: load }
}
