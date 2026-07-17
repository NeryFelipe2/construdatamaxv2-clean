import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Shape do "diário rico" (fonte: DIARIOS_DE_OBRA/diarios_data.json) ──────
export interface DiarioServico {
  label: string
  /** Só existe quando o serviço veio de uma linha real de rdo_atividades
   *  (fonte 'rdo_equipes') — permite ligar a uma NS real. Serviços vindos do
   *  diario_rico (texto livre extraído do WhatsApp) não têm linha endereçável. */
  atividadeId?: string
  nsId?: number | null
}

export interface DiarioEquipe {
  nome: string
  lider: string
  composicao: string
  servicos: DiarioServico[]
  frota: string
  equip: string
}

export interface DiarioRico {
  data: string
  nucleo: string
  apontador: string
  contrato: string
  equipes: DiarioEquipe[]
  ocorrencias?: string[]
}

// Shape bruto do JSON original (DIARIOS_DE_OBRA/diarios_data.json) — servicos
// como texto livre, sem linha endereçável de rdo_atividades.
interface DiarioEquipeRaw {
  nome: string
  lider: string
  composicao: string
  servicos: string[]
  frota: string
  equip: string
}
interface DiarioRicoRaw {
  data: string
  nucleo: string
  apontador: string
  contrato: string
  equipes: DiarioEquipeRaw[]
  ocorrencias?: string[]
}

function mapDiarioRicoRaw(raw: DiarioRicoRaw): DiarioRico {
  return {
    ...raw,
    equipes: (raw.equipes ?? []).map((eq) => ({
      ...eq,
      servicos: (eq.servicos ?? []).map((label) => ({ label })),
    })),
  }
}

// ─── Item final consumido pela tela (um por dia de RDO) ─────────────────────
export interface DiarioObraDia {
  rdoId: string
  data: string
  apontador: string
  nucleo: string
  clima: string | null
  status: string | null
  // pode haver mais de um "diário" no mesmo RDO (ex.: núcleos diferentes no mesmo dia)
  diarios: DiarioRico[]
  totalEquipes: number
  fonte: 'diario_rico' | 'rdo_equipes'
}

function montarEquipesFallback(
  equipesRows: { id: string; tipo: string | null; lider_nome: string | null; membros: unknown }[],
  atividadesRows: { id: string; equipe_id: string; rua: string | null; servico: string | null; tubo: string | null; metragem: number | null; pecas: string[] | null; casas: string | null; observacao: string | null; ns_id: number | null }[],
): DiarioEquipe[] {
  return equipesRows.map((eq) => {
    const atividades = atividadesRows.filter((a) => a.equipe_id === eq.id)
    const servicos: DiarioServico[] = atividades.map((a) => {
      const partes = [a.servico, a.rua ? `(${a.rua})` : null, a.metragem ? `${a.metragem}m` : null].filter(Boolean)
      const label = partes.join(' ') || a.observacao || 'Serviço sem descrição'
      return { label, atividadeId: a.id, nsId: a.ns_id }
    })
    const membros = Array.isArray(eq.membros) ? (eq.membros as unknown[]) : []
    const composicao = membros
      .map((m) => (typeof m === 'string' ? m : (m as { nome?: string; funcao?: string })?.nome ?? ''))
      .filter(Boolean)
      .join(', ')
    return {
      nome: eq.tipo ? `Equipe ${eq.tipo}` : 'Equipe',
      lider: eq.lider_nome ?? '—',
      composicao: composicao || '—',
      servicos: servicos.length > 0 ? servicos : [{ label: 'Sem atividades registradas' }],
      frota: '',
      equip: '',
    }
  })
}

export interface NsOption {
  id: number
  label: string
}

export function useSupabaseDiarioObra(projetoId: string | null) {
  const [dias, setDias] = useState<DiarioObraDia[]>([])
  const [nsOptions, setNsOptions] = useState<NsOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !projetoId) {
      setDias([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: rdosData, error: e1 } = await supabase
        .from('rdos')
        .select('id, data, apontador, clima, status, payload')
        .eq('projeto_id', projetoId)
        .order('data', { ascending: false })
      if (e1) throw e1

      const rdos = rdosData ?? []
      const rdoIds = rdos.map((r) => r.id)

      // Só busca as tabelas de fallback se houver algum RDO sem diario_rico
      const precisaFallback = rdos.some((r) => !(r.payload as Record<string, unknown> | null)?.diario_rico)
      let equipesPorRdo = new Map<string, { id: string; rdo_id: string; tipo: string | null; lider_nome: string | null; membros: unknown }[]>()
      let atividadesPorEquipe: { id: string; equipe_id: string; rua: string | null; servico: string | null; tubo: string | null; metragem: number | null; pecas: string[] | null; casas: string | null; observacao: string | null; ns_id: number | null }[] = []

      if (precisaFallback && rdoIds.length > 0) {
        const { data: equipesData } = await supabase
          .from('rdo_equipes')
          .select('id, rdo_id, tipo, lider_nome, membros')
          .in('rdo_id', rdoIds)
        for (const eq of equipesData ?? []) {
          const list = equipesPorRdo.get(eq.rdo_id) ?? []
          list.push(eq)
          equipesPorRdo.set(eq.rdo_id, list)
        }
        const equipeIds = (equipesData ?? []).map((e) => e.id)
        if (equipeIds.length > 0) {
          const { data: atividadesData } = await supabase
            .from('rdo_atividades')
            .select('id, equipe_id, rua, servico, tubo, metragem, pecas, casas, observacao, ns_id')
            .in('equipe_id', equipeIds)
          atividadesPorEquipe = atividadesData ?? []
        }
      }

      const mapeado: DiarioObraDia[] = rdos.map((r) => {
        const payload = (r.payload as Record<string, unknown> | null) ?? {}
        const diarioRicoRaw = payload.diario_rico
        const diarios: DiarioRico[] = Array.isArray(diarioRicoRaw)
          ? (diarioRicoRaw as DiarioRicoRaw[]).map(mapDiarioRicoRaw)
          : diarioRicoRaw && typeof diarioRicoRaw === 'object'
          ? [mapDiarioRicoRaw(diarioRicoRaw as DiarioRicoRaw)]
          : []

        if (diarios.length > 0) {
          const totalEquipes = diarios.reduce((acc, d) => acc + (d.equipes?.length ?? 0), 0)
          return {
            rdoId: r.id,
            data: r.data,
            apontador: diarios[0]?.apontador ?? r.apontador ?? '—',
            nucleo: diarios.map((d) => d.nucleo).filter(Boolean).join(' + ') || '—',
            clima: r.clima,
            status: r.status,
            diarios,
            totalEquipes,
            fonte: 'diario_rico',
          }
        }

        // Fallback: monta um "diário" sintético a partir de rdo_equipes/rdo_atividades
        const equipesRows = equipesPorRdo.get(r.id) ?? []
        const equipesMontadas = montarEquipesFallback(equipesRows, atividadesPorEquipe)
        const diarioSintetico: DiarioRico = {
          data: r.data,
          nucleo: '—',
          apontador: r.apontador ?? '—',
          contrato: '',
          equipes: equipesMontadas,
        }
        return {
          rdoId: r.id,
          data: r.data,
          apontador: r.apontador ?? '—',
          nucleo: '—',
          clima: r.clima,
          status: r.status,
          diarios: equipesMontadas.length > 0 ? [diarioSintetico] : [],
          totalEquipes: equipesMontadas.length,
          fonte: 'rdo_equipes',
        }
      })

      // Mais recente primeiro (já vem ordenado por data desc, mas garante estabilidade)
      mapeado.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
      setDias(mapeado)

      // Fase 4: NS reais do projeto, pra ligar atividades de RDO a uma NS.
      const { data: nsData } = await supabase
        .from('ns')
        .select('id, seq, pv_ini, pv_fim')
        .eq('projeto_id', projetoId)
        .like('origem_dados', 'croqui_motor_ns_%')
        .order('seq')
      setNsOptions((nsData ?? []).map((n) => ({ id: n.id, label: `NS ${n.seq} — ${n.pv_ini} → ${n.pv_fim}` })))
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar diário de obra')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    load()
  }, [load])

  const atribuirNs = useCallback(async (atividadeId: string, nsId: number | null) => {
    if (!supabase) return
    setDias((prev) => prev.map((dia) => ({
      ...dia,
      diarios: dia.diarios.map((diario) => ({
        ...diario,
        equipes: diario.equipes.map((eq) => ({
          ...eq,
          servicos: eq.servicos.map((s) => (s.atividadeId === atividadeId ? { ...s, nsId } : s)),
        })),
      })),
    })))
    try {
      const { error } = await supabase.from('rdo_atividades').update({ ns_id: nsId }).eq('id', atividadeId)
      if (error) throw error
    } catch {
      load() // reverte via reload em caso de erro
    }
  }, [load])

  return { dias, nsOptions, loading, error, reload: load, atribuirNs }
}
