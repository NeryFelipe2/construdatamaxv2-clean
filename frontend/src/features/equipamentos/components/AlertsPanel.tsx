import { useState } from 'react'
import { Bell, ChevronDown, ChevronUp, AlertTriangle, Info, Check, CheckCheck, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEquipamentosStore } from '@/store/equipamentosStore'
import type { AlertSeverity } from '@/types'
import { ALERT_CONFIG } from '../constants'

const SEVERITY_ORDER: AlertSeverity[] = ['critical', 'warning', 'info']

export function AlertsPanel() {
  const [open, setOpen]         = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [newEquipId, setNewEquipId] = useState('')
  const [newSeverity, setNewSeverity] = useState<AlertSeverity>('warning')
  const [newMessage, setNewMessage]   = useState('')

  const equipamentos      = useEquipamentosStore((s) => s.equipamentos)
  const acknowledgeAlert  = useEquipamentosStore((s) => s.acknowledgeAlert)
  const addAlert          = useEquipamentosStore((s) => s.addAlert)
  const selectEquipamento = useEquipamentosStore((s) => s.selectEquipamento)

  const allAlerts = equipamentos
    .flatMap((eq) =>
      eq.alerts
        .filter((a) => !a.acknowledged)
        .map((a) => ({
          ...a,
          equipmentName: eq.name,
          equipmentCode: eq.code,
        }))
    )
    .sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
    )

  function handleAdd() {
    if (!newEquipId || !newMessage.trim()) return
    addAlert(newEquipId, { severity: newSeverity, type: 'manual', message: newMessage.trim() })
    setNewEquipId('')
    setNewSeverity('warning')
    setNewMessage('')
    setShowAdd(false)
  }

  if (allAlerts.length === 0 && !showAdd) {
    return (
      <div className="border-t border-[#20406a] bg-[#112645] shrink-0">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2 text-xs text-[#3f3f3f]">
            <CheckCheck size={13} className="text-[#22c55e]" />
            Nenhum alerta ativo — todos os equipamentos estão dentro dos parâmetros
          </div>
          <button
            onClick={() => { setShowAdd(true); setOpen(true) }}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[#20406a] text-[#6b6b6b] hover:text-[#2abfdc] hover:border-[#2abfdc]/40 transition-colors"
          >
            <Plus size={10} />
            Adicionar Alerta
          </button>
        </div>
        {showAdd && <AddAlertForm />}
      </div>
    )
  }

  function AddAlertForm() {
    return (
      <div className="px-4 pb-3 border-t border-[#20406a] pt-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={newEquipId}
            onChange={(e) => setNewEquipId(e.target.value)}
            className="bg-[#0d2040] border border-[#20406a] rounded px-2 py-1 text-xs text-[#f5f5f5] outline-none focus:border-[#2abfdc]"
          >
            <option value="">Equipamento</option>
            {equipamentos.map((eq) => (
              <option key={eq.id} value={eq.id}>{eq.code} — {eq.name}</option>
            ))}
          </select>
          <select
            value={newSeverity}
            onChange={(e) => setNewSeverity(e.target.value as AlertSeverity)}
            className="bg-[#0d2040] border border-[#20406a] rounded px-2 py-1 text-xs text-[#f5f5f5] outline-none focus:border-[#2abfdc]"
          >
            <option value="critical">Crítico</option>
            <option value="warning">Atenção</option>
            <option value="info">Info</option>
          </select>
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Mensagem do alerta..."
            maxLength={200}
            className="flex-1 min-w-[160px] bg-[#0d2040] border border-[#20406a] rounded px-2 py-1 text-xs text-[#f5f5f5] outline-none focus:border-[#2abfdc] placeholder:text-[#3f3f3f]"
          />
          <button
            onClick={handleAdd}
            disabled={!newEquipId || !newMessage.trim()}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[#2abfdc]/15 border border-[#2abfdc]/30 text-[#2abfdc] hover:bg-[#2abfdc]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={9} />
            Adicionar
          </button>
          <button
            onClick={() => setShowAdd(false)}
            className="flex items-center justify-center w-6 h-6 rounded text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors"
          >
            <X size={11} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="border-t border-[#20406a] bg-[#112645] shrink-0"
      style={{ overflow: 'hidden', maxHeight: open ? (showAdd ? 300 : 220) : 44, transition: 'max-height 0.2s ease' }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 h-11 hover:bg-[#14294e] transition-colors shrink-0"
      >
        <div className="flex items-center gap-2">
          <Bell size={13} className="text-[#ef4444]" />
          <span className="text-xs font-semibold text-[#f5f5f5]">Alertas Ativos</span>
          <span className="text-[10px] font-bold text-white bg-[#ef4444] rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center">
            {allAlerts.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowAdd((v) => !v); if (!open) setOpen(true) }}
            className={cn(
              'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors',
              showAdd
                ? 'border-[#2abfdc]/50 bg-[#2abfdc]/15 text-[#2abfdc]'
                : 'border-[#20406a] text-[#6b6b6b] hover:text-[#2abfdc] hover:border-[#2abfdc]/40'
            )}
          >
            <Plus size={9} />
            Adicionar
          </button>
          {open
            ? <ChevronDown size={14} className="text-[#6b6b6b]" />
            : <ChevronUp   size={14} className="text-[#6b6b6b]" />}
        </div>
      </button>

      {/* Add form */}
      {showAdd && <AddAlertForm />}

      {/* Alert rows */}
      <div className="overflow-y-auto" style={{ maxHeight: 176 }}>
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          {allAlerts.map((alert) => {
            const cfg = ALERT_CONFIG[alert.severity]
            const Icon = alert.severity === 'info' ? Info : AlertTriangle
            return (
              <div
                key={alert.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{ background: cfg.colorMuted }}
              >
                <Icon size={13} style={{ color: cfg.color }} className="shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    <button
                      className="text-[10px] text-[#2abfdc] hover:underline font-semibold"
                      onClick={() => selectEquipamento(alert.equipmentId)}
                    >
                      {alert.equipmentCode} — {alert.equipmentName}
                    </button>
                  </div>
                  <p className="text-xs text-[#a3a3a3] truncate">{alert.message}</p>
                </div>

                <button
                  onClick={() => acknowledgeAlert(alert.equipmentId, alert.id)}
                  title="Reconhecer alerta"
                  className={cn(
                    'shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors',
                    'border-[#20406a] text-[#6b6b6b] hover:border-[#22c55e] hover:text-[#22c55e]'
                  )}
                >
                  <Check size={9} />
                  OK
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
