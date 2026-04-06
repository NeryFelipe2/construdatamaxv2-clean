/**
 * AlertasPanel — Active alerts for restrictions, messaging system.
 */
import { useState } from 'react'
import { Bell, Send, Check, AlertTriangle, Clock } from 'lucide-react'
import { useLpsStore } from '@/store/lpsStore'
import { useShallow } from 'zustand/react/shallow'

export function AlertasPanel() {
  const { restrictions, alerts, addAlert, acknowledgeAlert } = useLpsStore(
    useShallow((s) => ({
      restrictions:     s.restrictions,
      alerts:           s.alerts,
      addAlert:         s.addAlert,
      acknowledgeAlert: s.acknowledgeAlert,
    }))
  )

  const [recipientDraft, setRecipientDraft] = useState('')
  const [messageDraft, setMessageDraft]     = useState('')

  const today = new Date().toISOString().slice(0, 10)

  // Restrictions approaching or past deadline
  const urgentRestrictions = restrictions.filter((r) => {
    if (r.status === 'resolvida') return false
    if (!r.prazoRemocao) return false
    const daysUntil = Math.round((new Date(r.prazoRemocao).getTime() - new Date(today).getTime()) / 86_400_000)
    return daysUntil <= 7
  }).sort((a, b) => (a.prazoRemocao ?? '').localeCompare(b.prazoRemocao ?? ''))

  function handleSendAlert(restrictionId: string) {
    const restriction = restrictions.find((r) => r.id === restrictionId)
    if (!restriction) return
    addAlert({
      restrictionId,
      recipientRole: recipientDraft || restriction.responsavel || 'Responsável',
      message: messageDraft || `Restrição "${restriction.tema}" está próxima/vencida do prazo.`,
      sentAt: new Date().toISOString(),
      acknowledged: false,
    })
    setRecipientDraft('')
    setMessageDraft('')
  }

  const unacknowledged = alerts.filter((a) => !a.acknowledged).length

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#ef4444]">{urgentRestrictions.length}</p>
          <p className="text-[#6b6b6b] text-xs">Restrições urgentes</p>
        </div>
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#eab308]">{unacknowledged}</p>
          <p className="text-[#6b6b6b] text-xs">Alertas não lidos</p>
        </div>
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#22c55e]">{alerts.filter((a) => a.acknowledged).length}</p>
          <p className="text-[#6b6b6b] text-xs">Alertas confirmados</p>
        </div>
      </div>

      {/* Urgent restrictions */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#525252] flex items-center gap-2">
          <AlertTriangle size={14} className="text-[#ef4444]" />
          <h3 className="text-[#f5f5f5] text-sm font-semibold">Restrições Próximas do Prazo</h3>
        </div>

        {urgentRestrictions.length === 0 ? (
          <p className="text-[#6b6b6b] text-xs text-center py-6">Nenhuma restrição urgente no momento.</p>
        ) : (
          <div className="divide-y divide-[#525252]">
            {urgentRestrictions.map((r) => {
              const daysUntil = Math.round((new Date(r.prazoRemocao!).getTime() - new Date(today).getTime()) / 86_400_000)
              const isOverdue = daysUntil < 0
              const alreadySent = alerts.some((a) => a.restrictionId === r.id)

              return (
                <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isOverdue ? 'bg-[#ef4444]' : 'bg-[#eab308]'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[#f5f5f5] text-xs font-medium truncate">{r.tema}</p>
                    <p className="text-[#6b6b6b] text-[10px] mt-0.5">
                      {r.responsavel ?? '—'} · Prazo: {r.prazoRemocao}
                      {isOverdue && <span className="ml-2 text-[#ef4444] font-bold">Vencido ({Math.abs(daysUntil)}d)</span>}
                      {!isOverdue && <span className="ml-2 text-[#eab308]">{daysUntil}d restantes</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSendAlert(r.id)}
                    disabled={alreadySent}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#f97316]/20 hover:bg-[#f97316]/30 text-[#f97316] text-xs font-semibold transition-colors disabled:opacity-40 shrink-0"
                  >
                    <Send size={11} />{alreadySent ? 'Enviado' : 'Alertar'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Alert history */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#525252] flex items-center gap-2">
          <Bell size={14} className="text-[#f97316]" />
          <h3 className="text-[#f5f5f5] text-sm font-semibold">Histórico de Alertas ({alerts.length})</h3>
        </div>

        {alerts.length === 0 ? (
          <p className="text-[#6b6b6b] text-xs text-center py-6">Nenhum alerta enviado.</p>
        ) : (
          <div className="divide-y divide-[#525252]">
            {[...alerts].reverse().map((alert) => {
              const restriction = restrictions.find((r) => r.id === alert.restrictionId)
              return (
                <div key={alert.id} className="px-4 py-3 flex items-center gap-3">
                  {alert.acknowledged
                    ? <Check size={14} className="text-[#22c55e] shrink-0" />
                    : <Clock size={14} className="text-[#eab308] shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-[#f5f5f5] text-xs truncate">{alert.message}</p>
                    <p className="text-[#6b6b6b] text-[10px] mt-0.5">
                      Para: {alert.recipientRole} · {restriction?.tema ?? '—'} · {new Date(alert.sentAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="px-2.5 py-1 rounded-lg bg-[#22c55e]/15 text-[#22c55e] text-[10px] font-semibold hover:bg-[#22c55e]/25 shrink-0"
                    >
                      Confirmar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
