/**
 * IntegracoesPanel — Integration dashboard with Suprimentos, MdO, RDO.
 */
import { RefreshCw, Link2, Unlink, CheckCircle2 } from 'lucide-react'
import { useLpsStore } from '@/store/lpsStore'
import { useShallow } from 'zustand/react/shallow'
import type { IntegrationStatus } from '@/types'

const STATUS_META: Record<IntegrationStatus['status'], { label: string; color: string; icon: typeof Link2 }> = {
  connected:    { label: 'Conectado',   color: '#22c55e', icon: Link2        },
  partial:      { label: 'Parcial',     color: '#eab308', icon: Link2        },
  disconnected: { label: 'Desconectado', color: '#6b6b6b', icon: Unlink      },
}

export function IntegracoesPanel() {
  const { integrationStatuses, refreshIntegrationStatus, autoClearRestrictions, restrictions } = useLpsStore(
    useShallow((s) => ({
      integrationStatuses:      s.integrationStatuses,
      refreshIntegrationStatus: s.refreshIntegrationStatus,
      autoClearRestrictions:    s.autoClearRestrictions,
      restrictions:             s.restrictions,
    }))
  )

  const totalAutoClearable = integrationStatuses.reduce((s, i) => s + i.restrictionsAutoClearable, 0)
  const unresolvedCount = restrictions.filter((r) => r.status !== 'resolvida').length

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={refreshIntegrationStatus}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c] transition-colors"
        >
          <RefreshCw size={12} />Sincronizar Todos
        </button>
        <span className="text-[#6b6b6b] text-xs">{unresolvedCount} restrições não resolvidas</span>
      </div>

      {/* Integration cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {integrationStatuses.map((integration) => {
          const meta = STATUS_META[integration.status]
          const Icon = meta.icon
          return (
            <div key={integration.source} className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={16} style={{ color: meta.color }} />
                  <h3 className="text-[#f5f5f5] text-sm font-semibold">{integration.label}</h3>
                </div>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                  style={{ color: meta.color, borderColor: meta.color + '40', backgroundColor: meta.color + '15' }}
                >
                  {meta.label}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[#6b6b6b] text-[10px]">Última Sincronização</p>
                  <p className="text-[#f5f5f5] font-mono mt-0.5">
                    {integration.lastSyncAt
                      ? new Date(integration.lastSyncAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[#6b6b6b] text-[10px]">Restrições Linkadas</p>
                  <p className="text-[#f5f5f5] font-mono mt-0.5">{integration.itemsLinked}</p>
                </div>
              </div>

              {integration.restrictionsAutoClearable > 0 && (
                <div className="bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-lg px-3 py-2 flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-[#22c55e] shrink-0" />
                  <span className="text-[#22c55e] text-xs">
                    {integration.restrictionsAutoClearable} restrição(ões) podem ser baixadas automaticamente
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Auto-clear section */}
      {totalAutoClearable > 0 && (
        <div className="bg-[#2c2c2c] border border-[#22c55e]/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[#f5f5f5] text-sm font-semibold">Baixa Automática de Restrições</p>
            <p className="text-[#6b6b6b] text-xs mt-0.5">
              {totalAutoClearable} restrição(ões) podem ser resolvidas automaticamente com base nos dados dos sistemas integrados.
            </p>
          </div>
          <button
            onClick={autoClearRestrictions}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#22c55e]/20 hover:bg-[#22c55e]/30 text-[#22c55e] text-xs font-semibold transition-colors shrink-0"
          >
            <CheckCircle2 size={13} />Baixar Automaticamente
          </button>
        </div>
      )}

      {/* Info */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
        <p className="text-[#6b6b6b] text-xs leading-relaxed">
          <strong className="text-[#a3a3a3]">Como funciona:</strong> O sistema cruza dados de Suprimentos (confirmação de entrega de materiais),
          Mão de Obra (disponibilidade de equipes) e RDO (dados de execução) para identificar restrições que já foram
          resolvidas nos sistemas de origem. A baixa automática atualiza o status da restrição para "Resolvida".
        </p>
      </div>
    </div>
  )
}
