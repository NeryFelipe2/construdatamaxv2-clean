import { useCallback, useEffect, useState } from 'react'
import { apiProjetoGestao360, type ApiProjetoGestao360Payload, type CanonicalIntegrationStatus } from '@/lib/api'
import { supabase, type DbContato, type DbFrente, type DbProjeto } from '@/lib/supabase'
import { useAppModeStore } from '@/store/appModeStore'

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
  connectionStatus: CanonicalIntegrationStatus
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

interface DbRdoFallback {
  id: string
  projeto_id?: string | null
  project_id?: string | null
  data: string
  clima?: string | null
  turno?: string | null
  status?: string | null
  created_at?: string | null
  apontador?: string | null
  producao_m?: number | null
}

const TODAY = new Date().toISOString().slice(0, 10)

function buildAvatarLabel(cargo: string): string {
  const normalized = cargo.toLowerCase()
  if (normalized.includes('diretor') || normalized.includes('engen')) return '👷'
  if (normalized.includes('planejamento')) return '📋'
  if (normalized.includes('sala') || normalized.includes('tecnica')) return '🧠'
  return '🧰'
}

function defaultKpi(): GestaoKpi {
  return {
    frentesAtivas: 0,
    frentesPausadas: 0,
    totalFrentes: 0,
    extensaoTotal: 0,
    extensaoExecutada: 0,
    pvsTotal: 0,
    pvsCadastrados: 0,
    equipeCampo: 0,
    rdosHoje: 0,
    rdosPendentes: 0,
    rdosFechados: 0,
    totalRdos: 0,
    contatosAtivos: 0,
  }
}

function buildNotifications(args: {
  frentes: FrenteResumo[]
  rdos: RdoResumo[]
  contatos: ContatoResumo[]
  restricoes: Array<Record<string, unknown>>
}): NotificacaoItem[] {
  const items: NotificacaoItem[] = []

  args.frentes
    .filter((frente) => String(frente.status).toLowerCase() === 'pausada')
    .forEach((frente) => {
      items.push({
        tipo: 'alerta',
        texto: `Frente "${frente.nome}" esta pausada`,
        hora: 'Status atual',
      })
    })

  if (args.restricoes.length > 0) {
    items.push({
      tipo: 'alerta',
      texto: `${args.restricoes.length} restricao(oes) aberta(s) no projeto`,
      hora: 'LPS / Torre',
    })
  }

  const rdosHoje = args.rdos.filter((rdo) => rdo.data === TODAY)
  if (rdosHoje.length > 0) {
    items.push({
      tipo: 'ok',
      texto: `${rdosHoje.length} RDO(s) registrados hoje`,
      hora: 'Hoje',
    })
  } else {
    items.push({
      tipo: 'alerta',
      texto: 'Nenhum RDO registrado ainda. Aguardando dados do WhatsApp.',
      hora: 'Acao necessaria',
    })
  }

  if (args.contatos.length > 0) {
    items.push({
      tipo: 'info',
      texto: `${args.contatos.length} membros da equipe ativos no projeto`,
      hora: 'Status atual',
    })
  }

  return items
}

function mapApiPayload(payload: ApiProjetoGestao360Payload): Omit<SupabaseGestaoData, 'loading' | 'error' | 'refresh'> {
  const frentesResumo: FrenteResumo[] = (payload.frentes || []).map((frente) => ({
    id: String(frente.id || crypto.randomUUID()),
    nome: String(frente.nome || 'Frente'),
    setor: String(frente.setor || 'Projeto'),
    extensaoTotal: Number(frente.extensao_total || 0),
    extensaoExecutada: Number(frente.extensao_executada || 0),
    pvs: Number(frente.pvs_total || 0),
    status: String(frente.status || 'ativa'),
    progresso: Number(frente.progresso || 0),
  }))

  const contatos = (payload.contatos || []).map((contato) => ({
    id: String(contato.id || crypto.randomUUID()),
    nome: String(contato.nome || 'Contato'),
    cargo: String(contato.cargo || contato.alcada || 'Responsavel'),
    telefone: String(contato.telefone_whatsapp || contato.telefone || ''),
    projetoId: String(contato.projeto_id || payload.projeto.id),
    avatar: buildAvatarLabel(String(contato.cargo || contato.alcada || '')),
    rdosHoje: 0,
    rdosPendentes: 0,
  }))

  const rdosResumo: RdoResumo[] = (payload.rdos || []).map((rdo) => ({
    id: String(rdo.id || crypto.randomUUID()),
    data: String(rdo.data || '').slice(0, 10),
    clima: String(rdo.clima || 'Sem clima'),
    turno: String(rdo.turno || 'Diurno'),
    status: String(rdo.status || 'recebido'),
    frenteNome: String(rdo.apontador || rdo.responsavel || 'WhatsApp'),
    createdAt: String(rdo.created_at || new Date().toISOString()),
  }))

  const tarefasResumo: TarefaResumo[] = (payload.tarefas || []).map((tarefa) => ({
    id: String(tarefa.id || crypto.randomUUID()),
    delegadoPor: String(tarefa.delegante || tarefa.delegante_nome || 'ConstruData'),
    delegadoPara: String(tarefa.responsavel || tarefa.responsavel_nome || 'Responsavel'),
    descricao: String(tarefa.descricao || tarefa.titulo || 'Tarefa'),
    status: String(tarefa.status || 'pendente'),
    prioridade: String(tarefa.prioridade || 'normal'),
    prazo: tarefa.prazo ? String(tarefa.prazo) : null,
    createdAt: String(tarefa.created_at || new Date().toISOString()),
  }))

  const restricoes = payload.restricoes || []
  const kpis = payload.kpis || {
    frentes: frentesResumo.length,
    rdos_total: rdosResumo.length,
    rdos_hoje: rdosResumo.filter((rdo) => rdo.data === TODAY).length,
    tarefas_pendentes: tarefasResumo.filter((tarefa) => !['concluida', 'concluido', 'done'].includes(tarefa.status.toLowerCase())).length,
    contatos: contatos.length,
    restricoes_abertas: restricoes.length,
    custo_total_dia: 0,
  }

  const pausadas = frentesResumo.filter((frente) => frente.status.toLowerCase() === 'pausada').length
  const fechados = rdosResumo.filter((rdo) => rdo.status.toLowerCase().includes('fech')).length
  const pendentes = rdosResumo.filter((rdo) => !rdo.status.toLowerCase().includes('fech')).length

  return {
    connectionStatus: payload.status || 'partial',
    kpi: {
      frentesAtivas: Math.max(0, Number(kpis.frentes || 0) - pausadas),
      frentesPausadas: pausadas,
      totalFrentes: Number(kpis.frentes || frentesResumo.length),
      extensaoTotal: frentesResumo.reduce((sum, frente) => sum + frente.extensaoTotal, 0),
      extensaoExecutada: frentesResumo.reduce((sum, frente) => sum + frente.extensaoExecutada, 0),
      pvsTotal: frentesResumo.reduce((sum, frente) => sum + frente.pvs, 0),
      pvsCadastrados: 0,
      equipeCampo: contatos.filter((contato) => /(diretor|engen|campo|tecnic|planejamento|sala)/i.test(contato.cargo)).length,
      rdosHoje: Number(kpis.rdos_hoje || 0),
      rdosPendentes: pendentes,
      rdosFechados: fechados,
      totalRdos: Number(kpis.rdos_total || rdosResumo.length),
      contatosAtivos: Number(kpis.contatos || contatos.length),
    },
    frentes: frentesResumo,
    contatos,
    rdos: rdosResumo,
    tarefas: tarefasResumo,
    notificacoes: buildNotifications({
      frentes: frentesResumo,
      rdos: rdosResumo,
      contatos,
      restricoes,
    }),
    projetoNome: String(payload.projeto?.nome || 'Projeto'),
    isConnected: (payload.status || 'partial') !== 'local',
  }
}

// ─── Fallback local (wcr_db.json) — mesma base estática usada no modo demo ────

interface LocalWcrDb {
  projetos?: DbProjeto[]
  frentes?: DbFrente[]
  contatos?: DbContato[]
  rdos?: DbRdoFallback[]
  rdo_equipes?: Array<{ id: string; rdo_id: string }>
  rdo_atividades?: Array<{ equipe_id: string; metragem?: number | null }>
}

let localDbPromise: Promise<LocalWcrDb | null> | null = null

function fetchLocalWcrDb(): Promise<LocalWcrDb | null> {
  if (!localDbPromise) {
    localDbPromise = fetch('/wcr_db.json')
      .then((res) => (res.ok ? (res.json() as Promise<LocalWcrDb>) : null))
      .catch(() => null)
  }
  return localDbPromise
}

async function loadFromLocalDb(projetoId: string): Promise<Omit<SupabaseGestaoData, 'loading' | 'error' | 'refresh'> | null> {
  const db = await fetchLocalWcrDb()
  if (!db || !Array.isArray(db.projetos)) return null

  // wcr_db.json usa os UUIDs reais do Supabase; o app usa slugs (ex: 'wcr-boi-malhado')
  // como activeProjectId. Casa por id direto e, se não achar, por fragmento do nome.
  let projeto = db.projetos.find((p) => p.id === projetoId) ?? null
  if (!projeto) {
    const nomeFragmento = projetoId.replace(/^wcr-/, '').replace(/-/g, ' ').toLowerCase()
    projeto = db.projetos.find((p) => (p.nome || '').toLowerCase().includes(nomeFragmento)) ?? null
  }
  if (!projeto) return null

  const dbProjetoId = projeto.id
  const frentes = (db.frentes ?? []).filter((f) => f.projeto_id === dbProjetoId)
  const contatos = (db.contatos ?? []).filter((c) => c.projeto_id === dbProjetoId && c.ativo !== false)
  const rdos = (db.rdos ?? []).filter((r) => (r.projeto_id ?? r.project_id) === dbProjetoId)

  const rdoIds = new Set(rdos.map((r) => r.id))
  const equipeIds = new Set((db.rdo_equipes ?? []).filter((e) => rdoIds.has(e.rdo_id)).map((e) => e.id))
  const extensaoExecutada = (db.rdo_atividades ?? [])
    .filter((a) => equipeIds.has(a.equipe_id))
    .reduce((sum, a) => sum + Number(a.metragem || 0), 0)

  return buildFallbackData({ projeto, frentes, contatos, rdos, tarefas: [], extensaoExecutada })
}

async function loadFromSupabaseFallback(projetoId: string): Promise<Omit<SupabaseGestaoData, 'loading' | 'error' | 'refresh'> | null> {
  if (!supabase) return null

  const [projRes, frentesRes, contatosRes, rdosRes, tarefasRes] = await Promise.all([
    supabase.from('projetos').select('*').eq('id', projetoId).single(),
    supabase.from('frentes').select('*').eq('projeto_id', projetoId),
    supabase.from('contatos').select('*').eq('projeto_id', projetoId).eq('ativo', true),
    supabase.from('rdos').select('*').or(`projeto_id.eq.${projetoId},project_id.eq.${projetoId}`).order('data', { ascending: false }).limit(50),
    supabase.from('tarefas').select('*').or(`projeto_id.eq.${projetoId},project_id.eq.${projetoId}`).order('created_at', { ascending: false }).limit(50),
  ])

  const projeto = (projRes.data || null) as DbProjeto | null
  const frentes = (frentesRes.data || []) as DbFrente[]
  const contatos = (contatosRes.data || []) as DbContato[]
  const rdos = (rdosRes.data || []) as DbRdoFallback[]
  const tarefas = (tarefasRes.data || []) as Array<Record<string, unknown>>

  return buildFallbackData({
    projeto,
    frentes,
    contatos,
    rdos,
    tarefas,
    extensaoExecutada: rdos.reduce((sum, rdo) => sum + Number(rdo.producao_m || 0), 0),
  })
}

function buildFallbackData(args: {
  projeto: DbProjeto | null
  frentes: DbFrente[]
  contatos: DbContato[]
  rdos: DbRdoFallback[]
  tarefas: Array<Record<string, unknown>>
  extensaoExecutada: number
}): Omit<SupabaseGestaoData, 'loading' | 'error' | 'refresh'> {
  const { projeto, frentes, contatos, rdos, tarefas, extensaoExecutada } = args

  const frentesResumo: FrenteResumo[] = frentes.map((frente) => ({
    id: frente.id,
    nome: frente.nome,
    setor: frente.setor,
    extensaoTotal: Number(frente.extensao_total || 0),
    extensaoExecutada: 0,
    pvs: Number(frente.pvs_total || 0),
    status: String(frente.status || 'ativa'),
    progresso: 0,
  }))

  const contatosResumo: ContatoResumo[] = contatos.map((contato) => ({
    id: contato.id,
    nome: contato.nome,
    cargo: contato.cargo,
    telefone: contato.telefone_whatsapp,
    projetoId: contato.projeto_id,
    avatar: buildAvatarLabel(contato.cargo),
    rdosHoje: 0,
    rdosPendentes: 0,
  }))

  const rdosResumo: RdoResumo[] = rdos.map((rdo) => ({
    id: rdo.id,
    data: String(rdo.data || '').slice(0, 10),
    clima: String(rdo.clima || 'Sem clima'),
    turno: String(rdo.turno || 'Diurno'),
    status: String(rdo.status || 'recebido'),
    frenteNome: String(rdo.apontador || 'WhatsApp'),
    createdAt: String(rdo.created_at || new Date().toISOString()),
  }))

  const tarefasResumo: TarefaResumo[] = tarefas.map((tarefa) => ({
    id: String(tarefa.id || crypto.randomUUID()),
    delegadoPor: String(tarefa.delegante || tarefa.delegante_nome || 'ConstruData'),
    delegadoPara: String(tarefa.responsavel || tarefa.responsavel_nome || 'Responsavel'),
    descricao: String(tarefa.descricao || tarefa.titulo || 'Tarefa'),
    status: String(tarefa.status || 'pendente'),
    prioridade: String(tarefa.prioridade || 'normal'),
    prazo: tarefa.prazo ? String(tarefa.prazo) : null,
    createdAt: String(tarefa.created_at || new Date().toISOString()),
  }))

  const rdosHoje = rdosResumo.filter((rdo) => rdo.data === TODAY)
  const rdosFechados = rdosResumo.filter((rdo) => rdo.status.toLowerCase().includes('fech'))
  const rdosPendentes = rdosResumo.filter((rdo) => !rdo.status.toLowerCase().includes('fech'))

  return {
    connectionStatus: 'partial',
    kpi: {
      frentesAtivas: frentesResumo.filter((frente) => frente.status.toLowerCase() === 'ativa').length,
      frentesPausadas: frentesResumo.filter((frente) => frente.status.toLowerCase() === 'pausada').length,
      totalFrentes: frentesResumo.length,
      extensaoTotal: frentesResumo.reduce((sum, frente) => sum + frente.extensaoTotal, 0),
      extensaoExecutada,
      pvsTotal: frentesResumo.reduce((sum, frente) => sum + frente.pvs, 0),
      pvsCadastrados: 0,
      equipeCampo: contatosResumo.length,
      rdosHoje: rdosHoje.length,
      rdosPendentes: rdosPendentes.length,
      rdosFechados: rdosFechados.length,
      totalRdos: rdosResumo.length,
      contatosAtivos: contatosResumo.length,
    },
    frentes: frentesResumo,
    contatos: contatosResumo,
    rdos: rdosResumo,
    tarefas: tarefasResumo,
    notificacoes: buildNotifications({
      frentes: frentesResumo,
      rdos: rdosResumo,
      contatos: contatosResumo,
      restricoes: [],
    }),
    projetoNome: projeto?.nome || 'Projeto',
    isConnected: true,
  }
}

export function useSupabaseGestao(projetoId: string | null): SupabaseGestaoData {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<CanonicalIntegrationStatus>('local')
  const [kpi, setKpi] = useState<GestaoKpi>(defaultKpi())
  const [frentes, setFrentes] = useState<FrenteResumo[]>([])
  const [contatos, setContatos] = useState<ContatoResumo[]>([])
  const [rdos, setRdos] = useState<RdoResumo[]>([])
  const [tarefas, setTarefas] = useState<TarefaResumo[]>([])
  const [notificacoes, setNotificacoes] = useState<NotificacaoItem[]>([])
  const [projetoNome, setProjetoNome] = useState('Carregando...')

  const refresh = useCallback(async () => {
    if (!projetoId) {
      setLoading(false)
      setConnectionStatus('local')
      setKpi(defaultKpi())
      setFrentes([])
      setContatos([])
      setRdos([])
      setTarefas([])
      setNotificacoes([])
      setProjetoNome('Sem projeto')
      return
    }

    setLoading(true)
    setError(null)

    const applyData = (data: Omit<SupabaseGestaoData, 'loading' | 'error' | 'refresh'>) => {
      setConnectionStatus(data.connectionStatus)
      setKpi(data.kpi)
      setFrentes(data.frentes)
      setContatos(data.contatos)
      setRdos(data.rdos)
      setTarefas(data.tarefas)
      setNotificacoes(data.notificacoes)
      setProjetoNome(data.projetoNome)
      setLoading(false)
    }

    // Modo demo: prioriza o Supabase (dados WCR ao vivo) quando configurado;
    // se não houver Supabase, usa a base local (wcr_db.json).
    if (useAppModeStore.getState().isDemoMode) {
      if (supabase) {
        const live = await loadFromSupabaseFallback(projetoId).catch(() => null)
        if (live) {
          applyData(live)
          return
        }
      }
      const local = await loadFromLocalDb(projetoId).catch(() => null)
      if (local) {
        applyData(local)
        return
      }
    }

    try {
      const payload = await apiProjetoGestao360(projetoId)
      applyData(mapApiPayload(payload))
      return
    } catch (apiError) {
      try {
        const fallback = await loadFromSupabaseFallback(projetoId)
        if (fallback) {
          applyData(fallback)
          return
        }
      } catch {
        // segue para o fallback local
      }

      const local = await loadFromLocalDb(projetoId).catch(() => null)
      if (local) {
        applyData(local)
        return
      }

      setConnectionStatus('local')
      setKpi(defaultKpi())
      setFrentes([])
      setContatos([])
      setRdos([])
      setTarefas([])
      setNotificacoes([
        {
          tipo: 'alerta',
          texto: 'Falha ao carregar a visao canonica do projeto.',
          hora: 'API / local',
        },
      ])
      setProjetoNome('Projeto')
      setError(apiError instanceof Error ? apiError.message : String(apiError))
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    loading,
    error,
    connectionStatus,
    kpi,
    frentes,
    contatos,
    rdos,
    tarefas,
    notificacoes,
    projetoNome,
    isConnected: connectionStatus !== 'local',
    refresh,
  }
}
