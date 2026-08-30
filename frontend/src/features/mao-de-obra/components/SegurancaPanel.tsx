import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ShieldCheck, ShieldAlert, ShieldX, Plus, CheckCircle, XCircle } from 'lucide-react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { WorkerDialog } from './dialogs/WorkerDialog'
import { getCertExpiringSoon } from '@/store/maoDeObraStore'
import type { Worker, RiskArea } from '@/types'
import { cn } from '@/lib/utils'

// ─── Cert status badge ────────────────────────────────────────────────────────

function CertBadge({ status, type }: { status: import('@/types').CertStatus; type: string }) {
  const styles: Record<import('@/types').CertStatus, string> = {
    valid:    'bg-[#22c55e]/15 text-[#22c55e]',
    expiring: 'bg-[#f59e0b]/15 text-[#f59e0b]',
    expired:  'bg-[#ef4444]/15 text-[#ef4444]',
  }
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-xs font-mono font-semibold', styles[status])}>
      {type}
    </span>
  )
}

// ─── Worker status icon ───────────────────────────────────────────────────────

function WorkerStatusIcon({ status }: { status: import('@/types').WorkerStatus }) {
  if (status === 'active')    return <ShieldCheck size={14} className="text-[#22c55e]" />
  if (status === 'suspended') return <ShieldX size={14} className="text-[#ef4444]" />
  return <ShieldAlert size={14} className="text-[#6b6b6b]" />
}

// ─── Access Check Modal ───────────────────────────────────────────────────────

function AccessCheckModal({
  workers,
  riskAreas,
  checkAccess,
  onClose,
}: {
  workers:    Worker[]
  riskAreas:  RiskArea[]
  checkAccess: (workerId: string, riskAreaId: string) => import('@/store/maoDeObraStore').AccessCheckResult | null
  onClose:    () => void
}) {
  const [workerId,   setWorkerId]   = useState('')
  const [riskAreaId, setRiskAreaId] = useState('')
  const result = workerId && riskAreaId ? checkAccess(workerId, riskAreaId) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
        <h2 className="text-[#f5f5f5] text-base font-semibold">Verificar Acesso à Área de Risco</h2>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[#6b6b6b] text-xs font-medium">Funcionário</span>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            >
              <option value="">Selecionar...</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.name} — {w.role}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[#6b6b6b] text-xs font-medium">Área de Risco</span>
            <select
              value={riskAreaId}
              onChange={(e) => setRiskAreaId(e.target.value)}
              className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            >
              <option value="">Selecionar...</option>
              {riskAreas.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
        </div>

        {result && (
          <div
            className={cn(
              'rounded-xl p-4 border',
              result.allowed ? 'bg-[#22c55e]/10 border-[#22c55e]/30' : 'bg-[#ef4444]/10 border-[#ef4444]/30',
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              {result.allowed
                ? <CheckCircle size={18} className="text-[#22c55e]" />
                : <XCircle size={18} className="text-[#ef4444]" />}
              <span className={cn('font-semibold text-sm', result.allowed ? 'text-[#22c55e]' : 'text-[#ef4444]')}>
                {result.allowed ? 'Acesso Permitido' : 'Acesso Bloqueado'}
              </span>
            </div>

            {!result.allowed && (
              <div className="flex flex-col gap-1">
                {result.worker.status !== 'active' && (
                  <p className="text-[#ef4444] text-xs">
                    Funcionário com status: <strong>{result.worker.status}</strong>
                  </p>
                )}
                {result.missingCerts.length > 0 && (
                  <p className="text-[#ef4444] text-xs">
                    Certificações ausentes: <strong>{result.missingCerts.join(', ')}</strong>
                  </p>
                )}
                {result.expiredCerts.length > 0 && (
                  <p className="text-[#ef4444] text-xs">
                    Certificações vencidas: <strong>{result.expiredCerts.join(', ')}</strong>
                  </p>
                )}
              </div>
            )}

            <p className="text-[#6b6b6b] text-xs mt-2">
              Área: <span className="text-[#f5f5f5]">{result.riskArea.name}</span>
              {' '}· Requer: <span className="text-[#f5f5f5]">{result.riskArea.requiredCertTypes.join(', ')}</span>
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          className="self-end px-4 py-2 rounded-lg border border-[#525252] text-[#f5f5f5] text-sm hover:bg-[#484848] transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}

// ─── Training Calendar ────────────────────────────────────────────────────────

function TrainingCalendar({ workers }: { workers: Worker[] }) {
  const bands = [
    { days: 30, label: '≤ 30 dias', color: '#ef4444' },
    { days: 60, label: '31–60 dias', color: '#f59e0b' },
    { days: 90, label: '61–90 dias', color: '#22c55e' },
  ]

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
      <p className="text-[#f5f5f5] text-sm font-semibold mb-3">Calendário de Renovação de Treinamentos</p>
      <div className="flex flex-col gap-4">
        {bands.map((band) => {
          const items = getCertExpiringSoon(workers, band.days)
            .filter((item) => item.daysLeft <= band.days && item.daysLeft > (band.days === 30 ? 0 : band.days === 60 ? 30 : 60))
          return (
            <div key={band.label}>
              <p className="text-xs font-semibold mb-1.5" style={{ color: band.color }}>{band.label}</p>
              {items.length === 0 ? (
                <p className="text-[#6b6b6b] text-xs pl-2">Nenhuma renovação neste período.</p>
              ) : (
                <div className="flex flex-col gap-1 pl-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="px-1.5 py-0.5 rounded font-mono text-[10px]"
                        style={{ backgroundColor: `${band.color}22`, color: band.color }}>
                        {item.certType}
                      </span>
                      <span className="text-[#f5f5f5]">{item.worker.name}</span>
                      <span className="text-[#6b6b6b] ml-auto">
                        {new Date(item.expiryDate).toLocaleDateString('pt-BR')} ({item.daysLeft}d)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function SegurancaPanel() {
  const [isWorkerDialogOpen, setIsWorkerDialogOpen] = useState(false)
  const [isAccessCheckOpen,  setIsAccessCheckOpen]  = useState(false)

  const { workers, riskAreas, checkAccess } = useMaoDeObraStore(
    useShallow((s) => ({ workers: s.workers, riskAreas: s.riskAreas, checkAccess: s.checkAccess }))
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Action bar */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsWorkerDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea6c0a] text-[#ffffff] text-sm font-semibold transition-colors"
        >
          <Plus size={15} />
          Novo Funcionário
        </button>
        <button
          onClick={() => setIsAccessCheckOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#525252] text-[#f5f5f5] text-sm font-medium hover:bg-[#484848] transition-colors"
        >
          <ShieldCheck size={15} />
          Verificar Acesso
        </button>
      </div>

      {/* Worker list */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
        <p className="text-[#f5f5f5] text-sm font-semibold mb-3">
          Funcionários ({workers.length})
        </p>
        {workers.length === 0 ? (
          <p className="text-[#6b6b6b] text-sm">Nenhum funcionário cadastrado.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {workers.map((w) => {
              const worst = w.certifications.reduce<import('@/types').CertStatus | 'none'>(
                (acc, c) => {
                  if (c.status === 'expired') return 'expired'
                  if (acc !== 'expired' && c.status === 'expiring') return 'expiring'
                  return acc
                },
                'none'
              )

              return (
                <div
                  key={w.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[#3d3d3d] border border-[#525252]"
                >
                  <WorkerStatusIcon status={w.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[#f5f5f5] text-sm font-medium">{w.name}</span>
                      <span className="text-[#6b6b6b] text-xs">{w.role}</span>
                      {w.status === 'suspended' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#ef4444]/15 text-[#ef4444]">
                          Suspenso
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {w.certifications.map((c) => (
                        <CertBadge key={c.id} status={c.status} type={c.type} />
                      ))}
                      {w.certifications.length === 0 && (
                        <span className="text-[#ef4444] text-xs">Sem certificações</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[#6b6b6b] text-xs">{w.cpfMasked}</p>
                    {worst === 'expired' && (
                      <span className="text-[10px] font-semibold text-[#ef4444]">Cert. vencida</span>
                    )}
                    {worst === 'expiring' && (
                      <span className="text-[10px] font-semibold text-[#f59e0b]">Cert. vencendo</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Risk areas summary */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
        <p className="text-[#f5f5f5] text-sm font-semibold mb-3">Áreas de Risco Cadastradas</p>
        <div className="flex flex-col gap-2">
          {riskAreas.map((area) => (
            <div key={area.id} className="flex items-center justify-between p-2 rounded-lg bg-[#3d3d3d]">
              <span className="text-[#f5f5f5] text-sm">{area.name}</span>
              <div className="flex gap-1">
                {area.requiredCertTypes.map((ct) => (
                  <span key={ct} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#525252] text-[#6b6b6b]">
                    {ct}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <TrainingCalendar workers={workers} />

      {isWorkerDialogOpen && <WorkerDialog onClose={() => setIsWorkerDialogOpen(false)} />}
      {isAccessCheckOpen && (
        <AccessCheckModal
          workers={workers}
          riskAreas={riskAreas}
          checkAccess={checkAccess}
          onClose={() => setIsAccessCheckOpen(false)}
        />
      )}
    </div>
  )
}
