import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Shape do "diário rico" (fonte: DIARIOS_DE_OBRA/diarios_data.json) ──────
export interface DiarioEquipe {
  nome: string
  lider: string
  composicao: string
  servicos: string[]
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
  atividadesRows: { equipe_id: string; rua: string | null; servico: string | null; tubo: string | null; metragem: number | null; pecas: string[] | null; casas: string | null; observacao: string | null }[],
): DiarioEquipe[] {
  return equipesRows.map((eq) => {
    const atividades = atividadesRows.filter((a) => a.equipe_id === eq.id)
    const servicos = atividades.map((a) => {
      const partes = [a.servico, a.rua ? `(${a.rua})` : null, a.metragem ? `${a.metragem}m` : null].filter(Boolean)
      return partes.join(' ') || a.observacao || 'Serviço sem descrição'
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
      servicos: servicos.length > 0 ? servicos : ['Sem atividades registradas'],
      frota: '',
      equip: '',
    }
  })
}

export function useSupabaseDiarioObra(projetoId: string | null) {
  const [dias, setDias] = useState<DiarioObraDia[]>([])
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
      let atividadesPorEquipe: { equipe_id: string; rua: string | null; servico: string | null; tubo: string | null; metragem: number | null; pecas: string[] | null; casas: string | null; observacao: string | null }[] = []

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
            .select('equipe_id, rua, servico, tubo, metragem, pecas, casas, observacao')
            .in('equipe_id', equipeIds)
          atividadesPorEquipe = atividadesData ?? []
        }
      }

      const mapeado: DiarioObraDia[] = rdos.map((r) => {
        const payload = (r.payload as Record<string, unknown> | null) ?? {}
        const diarioRicoRaw = payload.diario_rico
        const diarios: DiarioRico[] = Array.isArray(diarioRicoRaw)
          ? (diarioRicoRaw as DiarioRico[])
          : diarioRicoRaw && typeof diarioRicoRaw === 'object'
          ? [diarioRicoRaw as DiarioRico]
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
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar diário de obra')
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    load()
  }, [load])

  return { dias, loading, error, reload: load }
}
