import { useEffect, useMemo, useState } from 'react'
import { Calendar, Clock, Eye, MessageSquare, Pause, Play, Plus, Repeat, Trash2 } from 'lucide-react'
import {
  apiProjetoAtualizarWhatsappAgendamento,
  apiProjetoCriarWhatsappAgendamento,
  apiProjetoRemoverWhatsappAgendamento,
  apiProjetoWhatsappAgendamentos,
  apiProjetoWhatsappLogs,
  type ApiProjetoWhatsappAgendamentoRecord,
  type ApiProjetoWhatsappLogRecord,
  type CanonicalIntegrationStatus,
} from '@/lib/api'
import { useContatosStore } from '@/store/contatosStore'
import { useProjectContext } from '@/store/projectContext'

interface FluxoTemplate {
  id: string
  nome: string
  tipo: 'lembrete_rdo' | 'cobranca_medicao' | 'aviso_reuniao' | 'alerta_seguranca' | 'custom'
  mensagem: string
}

type SubTab = 'agendamentos' | 'templates' | 'historico'
type Frequencia = 'diario' | 'semanal' | 'mensal' | 'unico'

const DEFAULT_TEMPLATES: FluxoTemplate[] = [
  {
    id: 'tpl-rdo',
    nome: 'Lembrete de RDO',
    tipo: 'lembrete_rdo',
    mensagem:
      '*LEMBRETE - RDO DIARIO*\n\nBom dia.\nPor favor, preencha o RDO de hoje.\n\nUse "menu" ou "@rdo" para iniciar.\n\nConstruDataMax',
  },
  {
    id: 'tpl-medicao',
    nome: 'Cobranca de Medicao',
    tipo: 'cobranca_medicao',
    mensagem:
      '*MEDICAO MENSAL*\n\nVerifique os trechos pendentes e finalize a medicao do periodo.\n\nConstruDataMax',
  },
  {
    id: 'tpl-reuniao',
    nome: 'Aviso de Reuniao',
    tipo: 'aviso_reuniao',
    mensagem:
      '*REUNIAO DE OBRAS*\n\nLembrete de reuniao com pauta de avancos, restricoes e proximos marcos.\n\nConstruDataMax',
  },
  {
    id: 'tpl-seguranca',
    nome: 'Alerta de Seguranca',
    tipo: 'alerta_seguranca',
    mensagem:
      '*ALERTA DE SEGURANCA*\n\nConfirme EPIs, sinalizacao e liberacao da frente antes do inicio das atividades.\n\nConstruDataMax',
  },
]

function integrationBadge(status: CanonicalIntegrationStatus) {
  if (status === 'connected') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
  if (status === 'partial') return 'bg-amber-500/10 text-amber-300 border-amber-500/20'
  return 'bg-slate-500/10 text-slate-300 border-slate-500/20'
}

function integrationLabel(status: CanonicalIntegrationStatus) {
  if (status === 'connected') return 'Canonico'
  if (status === 'partial') return 'Parcial'
  return 'Local'
}

function statusChip(status: string) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'entregue' || normalized === 'ativo' || normalized === 'ok') {
    return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
  }
  if (normalized === 'lido' || normalized === 'recebido' || normalized === 'pausado') {
    return 'bg-blue-500/10 text-blue-300 border-blue-500/20'
  }
  if (normalized === 'erro' || normalized === 'cancelado') {
    return 'bg-rose-500/10 text-rose-300 border-rose-500/20'
  }
  return 'bg-slate-500/10 text-slate-300 border-slate-500/20'
}

export function WhatsAppFluxoPanel() {
  const [activeTab, setActiveTab] = useState<SubTab>('agendamentos')
  const [previewTemplate, setPreviewTemplate] = useState<FluxoTemplate | null>(null)
  const [showNewSchedule, setShowNewSchedule] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agendamentos, setAgendamentos] = useState<ApiProjetoWhatsappAgendamentoRecord[]>([])
  const [historico, setHistorico] = useState<ApiProjetoWhatsappLogRecord[]>([])
  const contatos = useContatosStore((s) => s.contatos)
  const contatosStatus = useContatosStore((s) => s.integrationStatus)
  const fetchContatos = useContatosStore((s) => s.fetchContatos)
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const [draft, setDraft] = useState<{
    templateId: string
    frequencia: Frequencia
    horario: string
    destinatarios: string[]
  }>({
    templateId: DEFAULT_TEMPLATES[0].id,
    frequencia: 'diario',
    horario: '07:00',
    destinatarios: [],
  })

  const panelStatus: CanonicalIntegrationStatus = useMemo(() => {
    if (!activeProjectId) return 'local'
    if (error) return 'partial'
    return contatosStatus
  }, [activeProjectId, contatosStatus, error])

  const selectedTemplate = useMemo(
    () => DEFAULT_TEMPLATES.find((template) => template.id === draft.templateId) ?? DEFAULT_TEMPLATES[0],
    [draft.templateId]
  )

  async function loadData() {
    if (!activeProjectId) {
      setAgendamentos([])
      setHistorico([])
      return
    }
    setLoading(true)
    try {
      await fetchContatos(activeProjectId)
      const [agendamentosRes, logsRes] = await Promise.all([
        apiProjetoWhatsappAgendamentos(activeProjectId),
        apiProjetoWhatsappLogs(activeProjectId),
      ])
      setAgendamentos(agendamentosRes.items ?? [])
      setHistorico(logsRes.items ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar o fluxo do WhatsApp.')
      setAgendamentos([])
      setHistorico([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [activeProjectId, fetchContatos])

  async function handleCreateSchedule() {
    if (!activeProjectId) {
      setError('Selecione um projeto para criar agendamentos.')
      return
    }
    const recipients = contatos
      .filter((contato) => draft.destinatarios.includes(contato.id))
      .map((contato) => ({
        contato_id: contato.id,
        nome: contato.nome,
        telefone: contato.telefone_whatsapp,
      }))
    if (recipients.length === 0) {
      setError('Selecione pelo menos um contato do projeto.')
      return
    }
    setSaving(true)
    try {
      await apiProjetoCriarWhatsappAgendamento(activeProjectId, {
        templateId: selectedTemplate.id,
        templateNome: selectedTemplate.nome,
        mensagem: selectedTemplate.mensagem,
        frequencia: draft.frequencia,
        horario: draft.horario,
        destinatarios: recipients,
        ativo: true,
        origem: 'frontend',
      })
      setShowNewSchedule(false)
      setDraft((current) => ({ ...current, destinatarios: [] }))
      setError(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel criar o agendamento.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleSchedule(item: ApiProjetoWhatsappAgendamentoRecord) {
    if (!activeProjectId) return
    try {
      await apiProjetoAtualizarWhatsappAgendamento(activeProjectId, item.id, { ativo: !item.ativo })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel atualizar o agendamento.')
    }
  }

  async function handleRemoveSchedule(item: ApiProjetoWhatsappAgendamentoRecord) {
    if (!activeProjectId) return
    try {
      await apiProjetoRemoverWhatsappAgendamento(activeProjectId, item.id)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel remover o agendamento.')
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-600/20 flex items-center justify-center">
            <Repeat size={20} className="text-green-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Controle de Fluxo</h2>
            <p className="text-[#6b6b6b] text-xs">Mensagens recorrentes, logs e rastreio real do WhatsApp</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${integrationBadge(panelStatus)}`}>
            {integrationLabel(panelStatus)}
          </span>
          <button
            onClick={() => setShowNewSchedule((value) => !value)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <Plus size={13} /> Novo Agendamento
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#3d3d3d] rounded-xl p-4 border border-[#525252]">
          <p className="text-[#a3a3a3] text-xs mb-1">Contatos do Projeto</p>
          <p className="text-2xl font-bold text-green-400">{contatos.length}</p>
        </div>
        <div className="bg-[#3d3d3d] rounded-xl p-4 border border-[#525252]">
          <p className="text-[#a3a3a3] text-xs mb-1">Agendamentos Reais</p>
          <p className="text-2xl font-bold text-blue-400">{agendamentos.length}</p>
        </div>
        <div className="bg-[#3d3d3d] rounded-xl p-4 border border-[#525252]">
          <p className="text-[#a3a3a3] text-xs mb-1">Templates</p>
          <p className="text-2xl font-bold text-purple-400">{DEFAULT_TEMPLATES.length}</p>
        </div>
        <div className="bg-[#3d3d3d] rounded-xl p-4 border border-[#525252]">
          <p className="text-[#a3a3a3] text-xs mb-1">Logs Carregados</p>
          <p className="text-2xl font-bold text-yellow-400">{historico.length}</p>
        </div>
      </div>

      {showNewSchedule && (
        <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-[#a3a3a3]">Template</span>
              <select
                value={draft.templateId}
                onChange={(event) => setDraft((current) => ({ ...current, templateId: event.target.value }))}
                className="w-full bg-[#0b141a] border border-[#525252] rounded-lg px-3 py-2 text-sm text-white"
              >
                {DEFAULT_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[#a3a3a3]">Frequencia</span>
              <select
                value={draft.frequencia}
                onChange={(event) => setDraft((current) => ({ ...current, frequencia: event.target.value as Frequencia }))}
                className="w-full bg-[#0b141a] border border-[#525252] rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
                <option value="unico">Unico</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[#a3a3a3]">Horario</span>
              <input
                value={draft.horario}
                onChange={(event) => setDraft((current) => ({ ...current, horario: event.target.value }))}
                type="time"
                className="w-full bg-[#0b141a] border border-[#525252] rounded-lg px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-[#a3a3a3]">Destinatarios</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {contatos.map((contato) => {
                const checked = draft.destinatarios.includes(contato.id)
                return (
                  <label
                    key={contato.id}
                    className="flex items-center gap-2 bg-[#0b141a] border border-[#525252] rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          destinatarios: checked
                            ? current.destinatarios.filter((id) => id !== contato.id)
                            : [...current.destinatarios, contato.id],
                        }))
                      }
                    />
                    <span className="truncate">{contato.nome}</span>
                    <span className="ml-auto text-xs text-[#a3a3a3]">{contato.telefone_whatsapp}</span>
                  </label>
                )
              })}
              {contatos.length === 0 && (
                <div className="text-sm text-[#a3a3a3]">Nenhum contato do projeto foi carregado ainda.</div>
              )}
            </div>
          </div>

          <div className="bg-[#0b141a] rounded-lg p-3 border border-[#525252]">
            <p className="text-xs text-[#a3a3a3] mb-2">Preview</p>
            <div className="text-sm text-white whitespace-pre-wrap">{selectedTemplate.mensagem}</div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setShowNewSchedule(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#a3a3a3] hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleCreateSchedule()}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar agendamento'}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 bg-[#3d3d3d] rounded-lg p-1 border border-[#525252] w-fit">
        {([
          { key: 'agendamentos' as SubTab, label: 'Agendamentos', icon: <Calendar size={12} /> },
          { key: 'templates' as SubTab, label: 'Templates', icon: <MessageSquare size={12} /> },
          { key: 'historico' as SubTab, label: 'Historico', icon: <Clock size={12} /> },
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

      {activeTab === 'agendamentos' && (
        <div className="space-y-3">
          {loading && <div className="text-sm text-[#a3a3a3]">Carregando agendamentos reais...</div>}
          {!loading && agendamentos.length === 0 && (
            <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-5 text-sm text-[#a3a3a3]">
              Nenhum agendamento real encontrado para o projeto ativo.
            </div>
          )}
          {agendamentos.map((item) => (
            <div key={item.id} className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-medium text-sm">{item.templateNome}</p>
                  <p className="text-[#a3a3a3] text-xs">
                    {item.frequencia} as {item.horario}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[11px] border ${statusChip(item.ativo ? 'ativo' : item.updated_status || 'pausado')}`}>
                  {item.ativo ? 'Ativo' : item.updated_status || 'Pausado'}
                </span>
              </div>

              <div className="text-sm text-[#d4d4d4] whitespace-pre-wrap">{item.mensagem}</div>

              <div className="flex flex-wrap gap-2 text-xs text-[#a3a3a3]">
                <span className="inline-flex items-center gap-1"><MessageSquare size={12} /> {item.destinatarios.length} destinatarios</span>
                <span className="inline-flex items-center gap-1"><Repeat size={12} /> {item.totalEnviados} envios</span>
                <span className="inline-flex items-center gap-1"><Clock size={12} /> {item.ultimaExecucao || 'Sem execucao'}</span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => void handleToggleSchedule(item)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0b141a] text-white border border-[#525252] hover:border-green-500/30 transition-colors"
                >
                  {item.ativo ? <Pause size={12} /> : <Play size={12} />}
                  {item.ativo ? 'Pausar' : 'Retomar'}
                </button>
                <button
                  onClick={() => void handleRemoveSchedule(item)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-200 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                >
                  <Trash2 size={12} /> Cancelar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DEFAULT_TEMPLATES.map((template) => (
            <div key={template.id} className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4 hover:border-green-600/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[#f5f5f5] text-sm font-medium">{template.nome}</p>
                  <p className="text-[#a3a3a3] text-xs">{template.tipo}</p>
                </div>
                <button
                  onClick={() => setPreviewTemplate(template)}
                  className="p-1.5 rounded hover:bg-[#484848] text-[#6b6b6b] hover:text-green-400 transition-colors"
                >
                  <Eye size={14} />
                </button>
              </div>
              <div className="bg-[#0b141a] rounded-lg p-3 text-xs text-[#e9edef] whitespace-pre-wrap max-h-32 overflow-y-auto border border-[#1f3340]">
                {template.mensagem}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'historico' && (
        <div className="space-y-3">
          {loading && <div className="text-sm text-[#a3a3a3]">Carregando logs reais...</div>}
          {!loading && historico.length === 0 && (
            <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-5 text-sm text-[#a3a3a3]">
              Nenhum log de WhatsApp foi encontrado para o projeto ativo.
            </div>
          )}
          {historico.map((item) => (
            <div key={item.id} className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-white text-sm font-medium">{item.nome || item.telefone}</p>
                  <p className="text-[#a3a3a3] text-xs">{item.telefone}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[11px] border ${statusChip(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <p className="text-sm text-[#d4d4d4] whitespace-pre-wrap">{item.mensagem || '(sem mensagem textual)'}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#a3a3a3]">
                <span>{item.direction}</span>
                <span>{item.tipo}</span>
                <span>{item.created_at || 'sem data'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setPreviewTemplate(null)}
        >
          <div
            className="w-full max-w-sm bg-[#0b141a] rounded-2xl border border-[#1f3340] overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-[#1f2c34] px-4 py-3 flex items-center gap-3 border-b border-[#2a3942]">
              <div className="w-8 h-8 rounded-full bg-green-600/30 flex items-center justify-center text-sm">
                <MessageSquare size={15} className="text-green-300" />
              </div>
              <div className="flex-1">
                <p className="text-[#e9edef] text-sm font-medium">{previewTemplate.nome}</p>
                <p className="text-[#8696a0] text-[10px]">Preview da mensagem</p>
              </div>
              <button onClick={() => setPreviewTemplate(null)} className="text-[#8696a0] hover:text-white">
                x
              </button>
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
