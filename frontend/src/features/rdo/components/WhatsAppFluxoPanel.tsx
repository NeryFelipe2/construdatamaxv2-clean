/**
 * WhatsAppFluxoPanel.tsx — Controle de Fluxo de mensagens WhatsApp recorrentes.
 * Permite configurar templates, agendar envios e ver histórico.
 */
import { useState, useMemo } from 'react'
import {
  Send, Plus, Trash2, Clock, Calendar, Users, CheckCircle2,
  MessageSquare, Bell, Repeat, Edit3, Eye,
} from 'lucide-react'
import { useContatosStore } from '@/store/contatosStore'
import { useProjectContext } from '@/store/projectContext'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FluxoTemplate {
  id: string
  nome: string
  tipo: 'lembrete_rdo' | 'cobranca_medicao' | 'aviso_reuniao' | 'alerta_seguranca' | 'custom'
  mensagem: string
  emoji: string
}

interface FluxoAgendamento {
  id: string
  templateId: string
  frequencia: 'diario' | 'semanal' | 'mensal' | 'unico'
  horario: string
  diasSemana?: number[]
  destinatarios: string[]
  projetoId?: string
  ativo: boolean
  ultimoEnvio?: string
  totalEnviados: number
}

interface HistoricoEnvio {
  id: string
  agendamentoId: string
  templateNome: string
  destinatario: string
  telefone: string
  dataEnvio: string
  status: 'enviado' | 'entregue' | 'lido' | 'erro'
}

// ─── Templates padrão ─────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: FluxoTemplate[] = [
  {
    id: 'tpl-rdo',
    nome: 'Lembrete de RDO',
    tipo: 'lembrete_rdo',
    emoji: '📋',
    mensagem: `🚧 *LEMBRETE — RDO DIÁRIO*\n\nBom dia! 👋\nPor favor, preencha o RDO de hoje.\n\n📲 Envie *"RDO"* neste chat para iniciar.\n\n_Prazo: até 18h de hoje._\n_ConstruDataMax — Plataforma de Obras_`,
  },
  {
    id: 'tpl-medicao',
    nome: 'Cobrança de Medição',
    tipo: 'cobranca_medicao',
    emoji: '📐',
    mensagem: `📐 *MEDIÇÃO MENSAL*\n\nOlá! A medição do mês precisa ser fechada.\n\n📊 Verifique os trechos pendentes na plataforma.\n⏰ Prazo: até o dia 25.\n\n_ConstruDataMax — Controle de Obras_`,
  },
  {
    id: 'tpl-reuniao',
    nome: 'Aviso de Reunião',
    tipo: 'aviso_reuniao',
    emoji: '📅',
    mensagem: `📅 *REUNIÃO DE OBRAS*\n\nLembrete: reunião semanal amanhã às 8h.\n\n📍 Local: Sala de Engenharia\n📋 Pauta: Avanço físico + pendências\n\n_ConstruDataMax_`,
  },
  {
    id: 'tpl-seguranca',
    nome: 'Alerta de Segurança',
    tipo: 'alerta_seguranca',
    emoji: '⚠️',
    mensagem: `⚠️ *ALERTA DE SEGURANÇA*\n\nAtenção equipes de campo!\n🦺 Uso de EPIs é OBRIGATÓRIO.\n🚧 Verifiquem sinalização antes de iniciar.\n\n_DDS — Diálogo Diário de Segurança_`,
  },
]

const FREQUENCIA_LABELS: Record<string, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  mensal: 'Mensal',
  unico: 'Único',
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ─── Mock inicial ─────────────────────────────────────────────────────────

const MOCK_AGENDAMENTOS: FluxoAgendamento[] = [
  {
    id: 'ag-1',
    templateId: 'tpl-rdo',
    frequencia: 'diario',
    horario: '07:00',
    destinatarios: ['Bruno Silva', 'Carlos Lima', 'José Santos'],
    ativo: true,
    ultimoEnvio: '2026-04-07T07:00:00',
    totalEnviados: 45,
  },
  {
    id: 'ag-2',
    templateId: 'tpl-medicao',
    frequencia: 'mensal',
    horario: '09:00',
    destinatarios: ['Eng. Felipe Nery'],
    ativo: true,
    ultimoEnvio: '2026-03-25T09:00:00',
    totalEnviados: 3,
  },
]

const MOCK_HISTORICO: HistoricoEnvio[] = [
  { id: 'h1', agendamentoId: 'ag-1', templateNome: 'Lembrete de RDO', destinatario: 'Bruno Silva', telefone: '(13) 99999-1234', dataEnvio: '2026-04-07T07:00:00', status: 'lido' },
  { id: 'h2', agendamentoId: 'ag-1', templateNome: 'Lembrete de RDO', destinatario: 'Carlos Lima', telefone: '(13) 99999-5678', dataEnvio: '2026-04-07T07:00:00', status: 'entregue' },
  { id: 'h3', agendamentoId: 'ag-1', templateNome: 'Lembrete de RDO', destinatario: 'José Santos', telefone: '(13) 99999-9012', dataEnvio: '2026-04-07T07:00:00', status: 'enviado' },
  { id: 'h4', agendamentoId: 'ag-2', templateNome: 'Cobrança de Medição', destinatario: 'Eng. Felipe Nery', telefone: '(13) 99999-0000', dataEnvio: '2026-03-25T09:00:00', status: 'lido' },
]

// ─── Component ──────────────────────────────────────────────────────────────

type SubTab = 'agendamentos' | 'templates' | 'historico'

export function WhatsAppFluxoPanel() {
  const [activeTab, setActiveTab] = useState<SubTab>('agendamentos')
  const [templates] = useState(DEFAULT_TEMPLATES)
  const [agendamentos, setAgendamentos] = useState(MOCK_AGENDAMENTOS)
  const [historico] = useState(MOCK_HISTORICO)
  const [previewTemplate, setPreviewTemplate] = useState<FluxoTemplate | null>(null)
  const [showNewSchedule, setShowNewSchedule] = useState(false)
  const contatos = useContatosStore((s) => s.contatos)

  // KPIs
  const totalEnviadosHoje = historico.filter(
    (h) => h.dataEnvio.startsWith(new Date().toISOString().slice(0, 10))
  ).length
  const totalAtivos = agendamentos.filter((a) => a.ativo).length
  const totalEntregues = historico.filter((h) => h.status === 'entregue' || h.status === 'lido').length

  // Status badge
  function StatusBadge({ status }: { status: HistoricoEnvio['status'] }) {
    const cls: Record<string, string> = {
      enviado: 'bg-blue-900/40 text-blue-300',
      entregue: 'bg-yellow-900/40 text-yellow-300',
      lido: 'bg-green-900/40 text-green-300',
      erro: 'bg-red-900/40 text-red-300',
    }
    const labels: Record<string, string> = {
      enviado: '📤 Enviado',
      entregue: '✓✓ Entregue',
      lido: '👁 Lido',
      erro: '❌ Erro',
    }
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cls[status]}`}>{labels[status]}</span>
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-600/20 flex items-center justify-center">
            <Repeat size={20} className="text-green-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Controle de Fluxo</h2>
            <p className="text-[#6b6b6b] text-xs">Mensagens recorrentes via WhatsApp</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewSchedule(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          <Plus size={13} /> Novo Agendamento
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#3d3d3d] rounded-xl p-4 border border-[#525252]">
          <p className="text-[#a3a3a3] text-xs mb-1">Enviados Hoje</p>
          <p className="text-2xl font-bold text-green-400">{totalEnviadosHoje}</p>
        </div>
        <div className="bg-[#3d3d3d] rounded-xl p-4 border border-[#525252]">
          <p className="text-[#a3a3a3] text-xs mb-1">Fluxos Ativos</p>
          <p className="text-2xl font-bold text-blue-400">{totalAtivos}</p>
        </div>
        <div className="bg-[#3d3d3d] rounded-xl p-4 border border-[#525252]">
          <p className="text-[#a3a3a3] text-xs mb-1">Entregues</p>
          <p className="text-2xl font-bold text-yellow-400">{totalEntregues}</p>
        </div>
        <div className="bg-[#3d3d3d] rounded-xl p-4 border border-[#525252]">
          <p className="text-[#a3a3a3] text-xs mb-1">Templates</p>
          <p className="text-2xl font-bold text-purple-400">{templates.length}</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-[#3d3d3d] rounded-lg p-1 border border-[#525252] w-fit">
        {([
          { key: 'agendamentos' as SubTab, label: 'Agendamentos', icon: <Calendar size={12} /> },
          { key: 'templates' as SubTab, label: 'Templates', icon: <MessageSquare size={12} /> },
          { key: 'historico' as SubTab, label: 'Histórico', icon: <Clock size={12} /> },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === tab.key ? 'bg-green-600 text-white' : 'text-[#a3a3a3] hover:text-[#f5f5f5]'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Agendamentos ── */}
      {activeTab === 'agendamentos' && (
        <div className="space-y-3">
          {agendamentos.map((ag) => {
            const tpl = templates.find((t) => t.id === ag.templateId)
            return (
              <div key={ag.id} className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{tpl?.emoji ?? '📋'}</span>
                    <div>
                      <p className="text-[#f5f5f5] text-sm font-medium">{tpl?.nome ?? 'Template'}</p>
                      <p className="text-[#6b6b6b] text-xs">
                        {FREQUENCIA_LABELS[ag.frequencia]} às {ag.horario}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAgendamentos((prev) =>
                        prev.map((a) => a.id === ag.id ? { ...a, ativo: !a.ativo } : a)
                      )}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        ag.ativo
                          ? 'bg-green-900/40 text-green-300 hover:bg-green-900/60'
                          : 'bg-[#484848] text-[#6b6b6b] hover:bg-[#525252]'
                      }`}
                    >
                      {ag.ativo ? '● Ativo' : '○ Pausado'}
                    </button>
                    <button className="p-1.5 rounded hover:bg-[#484848] text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
                      <Edit3 size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#a3a3a3]">
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {ag.destinatarios.length} destinatário{ag.destinatarios.length !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Send size={11} /> {ag.totalEnviados} enviados
                  </span>
                  {ag.ultimoEnvio && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> Último: {new Date(ag.ultimoEnvio).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {ag.destinatarios.map((d) => (
                    <span key={d} className="px-2 py-0.5 rounded-full text-[10px] bg-green-900/20 text-green-400 border border-green-700/20">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Templates ── */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4 hover:border-green-600/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{tpl.emoji}</span>
                  <p className="text-[#f5f5f5] text-sm font-medium">{tpl.nome}</p>
                </div>
                <button
                  onClick={() => setPreviewTemplate(tpl)}
                  className="p-1.5 rounded hover:bg-[#484848] text-[#6b6b6b] hover:text-green-400 transition-colors"
                >
                  <Eye size={14} />
                </button>
              </div>
              <div className="bg-[#0b141a] rounded-lg p-3 text-xs text-[#e9edef] whitespace-pre-wrap max-h-32 overflow-y-auto border border-[#1f3340]">
                {tpl.mensagem}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Histórico ── */}
      {activeTab === 'historico' && (
        <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#6b6b6b] text-xs border-b border-[#525252]">
                  <th className="text-left px-5 py-2.5 font-medium">Template</th>
                  <th className="text-left px-3 py-2.5 font-medium">Destinatário</th>
                  <th className="text-left px-3 py-2.5 font-medium">Telefone</th>
                  <th className="text-center px-3 py-2.5 font-medium">Data/Hora</th>
                  <th className="text-center px-3 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((h) => (
                  <tr key={h.id} className="border-b border-[#525252]/50 hover:bg-[#484848]/30 transition-colors">
                    <td className="px-5 py-3 text-[#f5f5f5]">{h.templateNome}</td>
                    <td className="px-3 py-3 text-[#a3a3a3]">{h.destinatario}</td>
                    <td className="px-3 py-3 text-[#6b6b6b] font-mono text-xs">{h.telefone}</td>
                    <td className="px-3 py-3 text-center text-[#a3a3a3] text-xs">
                      {new Date(h.dataEnvio).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-3 text-center"><StatusBadge status={h.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {previewTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setPreviewTemplate(null)}
        >
          <div
            className="w-full max-w-sm bg-[#0b141a] rounded-2xl border border-[#1f3340] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#1f2c34] px-4 py-3 flex items-center gap-3 border-b border-[#2a3942]">
              <div className="w-8 h-8 rounded-full bg-green-600/30 flex items-center justify-center text-sm">
                {previewTemplate.emoji}
              </div>
              <div className="flex-1">
                <p className="text-[#e9edef] text-sm font-medium">{previewTemplate.nome}</p>
                <p className="text-[#8696a0] text-[10px]">Preview da mensagem</p>
              </div>
              <button onClick={() => setPreviewTemplate(null)} className="text-[#8696a0] hover:text-white">✕</button>
            </div>
            <div className="p-4">
              <div className="bg-[#1f2c34] rounded-xl rounded-tl-sm px-3 py-2 text-[13px] text-[#e9edef] whitespace-pre-wrap">
                {previewTemplate.mensagem}
                <span className="block text-right text-[10px] text-[#8696a0] mt-1">
                  {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
