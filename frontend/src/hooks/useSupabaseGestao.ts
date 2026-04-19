/**
 * useSupabaseGestao.ts — Fetches REAL operational data from Supabase
 * for the Gestão 360 dashboard. Replaces all hardcoded mock data.
 *
 * Tables queried: projetos, frentes, contatos, rdos, tarefas
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { DbProjeto, DbFrente, DbContato } from '@/lib/supabase'

interface DbRdoReal {
  id: string
  project_id: string | null
  data: string
  clima: string
  equipe_number: number
  producao_m: number
  ligacoes_dia: number
  observacoes: string
  spi: number
  latitude: number | null
  longitude: number | null
  fotos: string[]
  apontador: string | null
  turno: string | null
  status: string | null
  created_at: string
}

export interface TarefaResumo {
  id: string
  delegadoPor: string
  delegadoPara: string
  descricao: string
  status: string
  prioridade: string
  prazo: string | null
  createdAt: string
}

// ─── Derived KPI shape ───────────────────────────────────────────────────────
export interface GestaoKpi {
  frentesAtivas: number
  frentesPausadas: number
  totalFrentes: number
  extensaoTotal: number
  extensaoExecutada: number
  pvsTotal: number
  pvsCadastrados: number
  equipeCampo: number
  rdosHoje: number
  rdosPendentes: number
  rdosFechados: number
  totalRdos: number
  contatosAtivos: number
}

export interface FrenteResumo {
  id: string
  nome: string
  setor: string
  extensaoTotal: number
  extensaoExecutada: number
  pvs: number
  status: string
  progresso: number
}

export interface ContatoResumo {
  id: string
  nome: string
  cargo: string
  telefone: string
  projetoId: string
  avatar: string
  rdosHoje: number
  rdosPendentes: number
}

export interface RdoResumo {
  id: string
  data: string
  clima: string
  turno: string
  status: string
  frenteNome: string
  createdAt: string
}

export interface NotificacaoItem {
  tipo: 'alerta' | 'ok' | 'info'
  texto: string
  hora: string
}

interface SupabaseGestaoData {
  loading: boolean
  error: string | null
  kpi: GestaoKpi
  frentes: FrenteResumo[]
  contatos: ContatoResumo[]
  rdos: RdoResumo[]
  tarefas: TarefaResumo[]
  notificacoes: NotificacaoItem[]
  projetoNome: string
  isConnected: boolean
  refresh: () => Promise<void>
}

const today = new Date().toISOString().slice(0, 10)

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useSupabaseGestao(projetoId: string | null): SupabaseGestaoData {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projeto, setProjeto] = useState<DbProjeto | null>(null)
  const [frentes, setFrentes] = useState<DbFrente[]>([])
  const [contatos, setContatos] = useState<DbContato[]>([])
  const [rdos, setRdos] = useState<DbRdoReal[]>([])
  const [tarefasRaw, setTarefasRaw] = useState<any[]>([])

  const isConnected = !!supabase

  const fetchData = useCallback(async () => {
    if (!supabase || !projetoId) {
      setLoading(false)
      return
    }

    // Skip if projetoId is a demo ID (not a valid UUID)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projetoId)
    if (!isUuid) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Parallel fetch — rdos uses project_id (English column name in DB)
      const [projRes, frentesRes, contatosRes, rdosRes, tarefasRes] = await Promise.all([
        supabase.from('projetos').select('*').eq('id', projetoId).single(),
        supabase.from('frentes').select('*').eq('projeto_id', projetoId),
        supabase.from('contatos').select('*').eq('projeto_id', projetoId).eq('ativo', true),
        supabase.from('rdos').select('*').eq('project_id', projetoId).order('data', { ascending: false }).limit(50),
        supabase.from('tarefas').select('*').eq('project_id', projetoId).order('created_at', { ascending: false }).limit(50).then(r => r).catch(() => ({ data: [], error: null })),
      ])

      if (projRes.data) setProjeto(projRes.data as DbProjeto)
      if (frentesRes.data) setFrentes(frentesRes.data as DbFrente[])
      if (contatosRes.data) setContatos(contatosRes.data as DbContato[])
      if (rdosRes.data) setRdos(rdosRes.data as DbRdoReal[])
      if (tarefasRes.data) setTarefasRaw(tarefasRes.data as any[])

      if (projRes.error) setError(projRes.error.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Compute KPIs ─────────────────────────────────────────────────────────
  const frentesAtivas = frentes.filter(f => f.status === 'ativa')
  const rdosHoje = rdos.filter(r => r.data === today)
  const rdosPendentes = rdos.filter(r => r.status === 'aberto')
  const rdosFechados = rdos.filter(r => r.status === 'fechado')

  const kpi: GestaoKpi = {
    frentesAtivas: frentesAtivas.length,
    frentesPausadas: frentes.filter(f => f.status === 'pausada').length,
    totalFrentes: frentes.length,
    extensaoTotal: frentes.reduce((s, f) => s + (f.extensao_total || 0), 0),
    extensaoExecutada: rdos.reduce((s, r) => s + (r.producao_m || 0), 0),
    pvsTotal: frentes.reduce((s, f) => s + (f.pvs_total || 0), 0),
    pvsCadastrados: 0,
    equipeCampo: contatos.filter(c => c.cargo.includes('Campo') || c.cargo.includes('Tecnico')).length,
    rdosHoje: rdosHoje.length,
    rdosPendentes: rdosPendentes.length,
    rdosFechados: rdosFechados.length,
    totalRdos: rdos.length,
    contatosAtivos: contatos.length,
  }

  // ── Frentes with progress ────────────────────────────────────────────────
  const frentesResumo: FrenteResumo[] = frentes.map(f => ({
    id: f.id,
    nome: f.nome,
    setor: f.setor,
    extensaoTotal: f.extensao_total,
    extensaoExecutada: 0,
    pvs: f.pvs_total,
    status: f.status,
    progresso: 0, // Will be filled from rdo_atividades aggregation
  }))

  // ── Contatos with RDO info ───────────────────────────────────────────────
  const contatosResumo: ContatoResumo[] = contatos.map(c => ({
    id: c.id,
    nome: c.nome,
    cargo: c.cargo,
    telefone: c.telefone_whatsapp,
    projetoId: c.projeto_id,
    avatar: c.cargo.includes('Eng') || c.cargo.includes('Diretor') ? '👷‍♂️' :
            c.cargo.includes('Gestor') ? '👩‍💼' : '🧑‍🔧',
    rdosHoje: 0,
    rdosPendentes: 0,
  }))

  // ── RDOs formatted ───────────────────────────────────────────────────────
  const rdosResumo: RdoResumo[] = rdos.map(r => ({
    id: r.id,
    data: r.data,
    clima: r.clima,
    turno: r.turno || 'Diurno',
    status: r.status || 'aberto',
    frenteNome: r.apontador || 'WhatsApp',
    createdAt: r.created_at,
  }))

  // ── Tarefas formatted ────────────────────────────────────────────────────
  const tarefasResumo: TarefaResumo[] = tarefasRaw.map(t => ({
    id: t.id,
    delegadoPor: t.delegado_por || '',
    delegadoPara: t.delegado_para || '',
    descricao: t.descricao || '',
    status: t.status || 'pendente',
    prioridade: t.prioridade || 'normal',
    prazo: t.prazo,
    createdAt: t.created_at,
  }))

  // ── Auto-generate notifications from real data ───────────────────────────
  const notificacoes: NotificacaoItem[] = []

  // Frentes pausadas = alertas
  frentes.filter(f => f.status === 'pausada').forEach(f => {
    notificacoes.push({
      tipo: 'alerta',
      texto: `Frente "${f.nome}" está pausada`,
      hora: 'Status atual',
    })
  })

  // RDOs pendentes
  if (rdosPendentes.length > 0) {
    notificacoes.push({
      tipo: 'alerta',
      texto: `${rdosPendentes.length} RDO(s) pendentes de fechamento`,
      hora: 'Hoje',
    })
  }

  // RDOs preenchidos hoje
  if (rdosHoje.length > 0) {
    notificacoes.push({
      tipo: 'ok',
      texto: `${rdosHoje.length} RDO(s) registrados hoje`,
      hora: 'Hoje',
    })
  }

  // Contatos ativos
  if (contatos.length > 0) {
    notificacoes.push({
      tipo: 'info',
      texto: `${contatos.length} membros da equipe ativos no projeto`,
      hora: 'Status atual',
    })
  }

  // If no rdos at all
  if (rdos.length === 0) {
    notificacoes.push({
      tipo: 'alerta',
      texto: 'Nenhum RDO registrado ainda. Aguardando dados do WhatsApp.',
      hora: 'Ação necessária',
    })
  }

  // Fill at least 3 notifications
  if (notificacoes.length === 0) {
    notificacoes.push({
      tipo: 'info',
      texto: 'Sistema operacional. Aguardando atividade.',
      hora: 'Agora',
    })
  }

  return {
    loading,
    error,
    kpi,
    frentes: frentesResumo,
    contatos: contatosResumo,
    rdos: rdosResumo,
    tarefas: tarefasResumo,
    notificacoes,
    projetoNome: projeto?.nome || 'Carregando...',
    isConnected,
    refresh: fetchData,
  }
}

