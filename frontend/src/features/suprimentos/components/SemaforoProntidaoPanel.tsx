/**
 * SemaforoProntidaoPanel — LPS material readiness traffic light grid.
 * Rows = LPS activities (from reservas), Columns = weeks 1–8.
 * Cells = green/yellow/red based on stock vs reservation.
 */
import { useState } from 'react'
import { Info, AlertTriangle, ShoppingCart } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { cn } from '@/lib/utils'

const SEMANAS = [11, 12, 13, 14, 15, 16, 17, 18]

const SEMAFORO_COLOR = {
  verde:    { dot: 'bg-[#22c55e]', text: 'text-[#22c55e]', border: 'border-[#22c55e]/30', bg: 'bg-[#16a34a]/10' },
  amarelo:  { dot: 'bg-[#eab308]', text: 'text-[#eab308]', border: 'border-[#ca8a04]/30', bg: 'bg-[#ca8a04]/10' },
  vermelho: { dot: 'bg-[#ef4444]', text: 'text-[#ef4444]', border: 'border-[#dc2626]/30', bg: 'bg-[#dc2626]/10' },
}

interface DetailModal {
  lpsActivityId: string
  semana: number
  depositoId: string
}

export function SemaforoProntidaoPanel() {
  const {
    depositos, estoqueItens, reservas, leadTimeRecords,
    selectedDepositoId, setSelectedDeposito, calcSemaforo, updateReserva,
  } = useSuprimentosStore(
    useShallow((s) => ({
      depositos:           s.depositos,
      estoqueItens:        s.estoqueItens,
      reservas:            s.reservas,
      leadTimeRecords:     s.leadTimeRecords,
      selectedDepositoId:  s.selectedDepositoId,
      setSelectedDeposito: s.setSelectedDeposito,
      calcSemaforo:        s.calcSemaforo,
      updateReserva:       s.updateReserva,
    }))
  )

  const [detail, setDetail] = useState<DetailModal | null>(null)

  const depId = selectedDepositoId ?? depositos[0]?.id ?? ''

  // Unique LPS activity IDs in this deposito
  const activityIds = [...new Set(
    reservas.filter((r) => r.depositoId === depId).map((r) => r.lpsActivityId)
  )]

  const depReservas = detail
    ? reservas.filter(
        (r) => r.depositoId === detail.depositoId &&
               r.lpsActivityId === detail.lpsActivityId &&
               r.semana === detail.semana
      )
    : []

  function handleAlertaGerado(reservaId: string) {
    updateReserva(reservaId, { alertaGerado: true })
    setDetail(null)
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
      {/* Deposito selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-[#6b6b6b]">Frente:</span>
        <div className="flex gap-1 flex-wrap">
          {depositos.filter((d) => d.ativo).map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDeposito(d.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                d.id === depId
                  ? 'bg-[#f97316]/15 text-[#f97316] border-[#f97316]/40'
                  : 'border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3]',
              )}
            >
              {d.frente}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px]">
        {(['verde', 'amarelo', 'vermelho'] as const).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={cn('w-2.5 h-2.5 rounded-full inline-block', SEMAFORO_COLOR[s].dot)} />
            <span className="text-[#6b6b6b]">
              {s === 'verde' ? 'Estoque OK' : s === 'amarelo' ? 'NF em Trânsito' : 'Ruptura'}
            </span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse" style={{ minWidth: `${160 + SEMANAS.length * 80}px` }}>
            <thead>
              <tr className="bg-[#2c2c2c]">
                <th className="sticky left-0 z-10 bg-[#2c2c2c] px-4 py-2.5 text-left text-[#6b6b6b] font-medium min-w-[150px]">Atividade LPS</th>
                {SEMANAS.map((s) => (
                  <th key={s} className="px-2 py-2.5 text-center text-[#6b6b6b] font-medium min-w-[72px]">Sem {s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activityIds.length === 0 && (
                <tr>
                  <td colSpan={SEMANAS.length + 1} className="px-4 py-8 text-center text-[#6b6b6b] text-xs">
                    Nenhuma reserva cadastrada para esta frente.
                  </td>
                </tr>
              )}
              {activityIds.map((actId) => (
                <tr key={actId} className="border-t border-[#525252]">
                  <td className="sticky left-0 z-10 bg-[#3d3d3d] px-4 py-2 text-[#f5f5f5] font-medium border-r border-[#525252]">
                    {actId}
                  </td>
                  {SEMANAS.map((semana) => {
                    const hasReserva = reservas.some(
                      (r) => r.depositoId === depId && r.lpsActivityId === actId && r.semana === semana
                    )
                    if (!hasReserva) {
                      return <td key={semana} className="px-2 py-2 text-center text-[#3f3f3f]">—</td>
                    }
                    const status = calcSemaforo(depId, actId, semana)
                    const col    = SEMAFORO_COLOR[status]
                    return (
                      <td key={semana} className="px-2 py-2 text-center">
                        <button
                          onClick={() => setDetail({ lpsActivityId: actId, semana, depositoId: depId })}
                          className={cn(
                            'w-7 h-7 rounded-full border flex items-center justify-center mx-auto transition-all hover:scale-110',
                            col.dot, col.border,
                          )}
                          title={`${actId} — Sem ${semana}: ${status}`}
                        >
                          {status === 'vermelho' && <AlertTriangle size={10} className="text-white" />}
                          {status === 'amarelo'  && <Info size={10} className="text-white" />}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead time line */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#525252]">
          <span className="text-xs font-semibold text-[#f5f5f5]">Lead Time por Fornecedor</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[#2c2c2c]">
                {['Fornecedor', 'Lead Time Médio', 'Última NF', 'Data Compra', 'Data Entrega', 'Para Sem 14 — Pedido até'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[#6b6b6b] font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leadTimeRecords.map((lt) => {
                const prazo = new Date('2025-04-07') // Week 14 Monday
                prazo.setDate(prazo.getDate() - lt.leadTimeDias)
                const prazoStr = prazo.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                return (
                  <tr key={lt.id} className="border-t border-[#525252] hover:bg-[#484848]/30">
                    <td className="px-3 py-2 text-[#f5f5f5] font-medium">{lt.fornecedor}</td>
                    <td className="px-3 py-2 font-mono">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-bold',
                        lt.leadTimeDias <= 4 ? 'bg-[#16a34a]/20 text-[#4ade80]'
                        : lt.leadTimeDias <= 7 ? 'bg-[#ca8a04]/20 text-[#fbbf24]'
                        : 'bg-[#dc2626]/20 text-[#f87171]',
                      )}>
                        {lt.leadTimeDias}d
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[#6b6b6b]">{lt.nf}</td>
                    <td className="px-3 py-2 text-[#6b6b6b]">{lt.dataCompra}</td>
                    <td className="px-3 py-2 text-[#6b6b6b]">{lt.dataMovimento}</td>
                    <td className="px-3 py-2 text-[#f97316] font-medium">{prazoStr}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="bg-[#3d3d3d] border border-[#525252] rounded-2xl p-5 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#f5f5f5] mb-1">{detail.lpsActivityId}</h3>
            <p className="text-[11px] text-[#6b6b6b] mb-4">Semana {detail.semana}</p>
            <div className="flex flex-col gap-2 mb-4">
              {depReservas.map((r) => {
                const item   = estoqueItens.find((i) => i.id === r.itemId)
                const deficit = Math.max(0, r.qtdNecessaria - (item?.qtdDisponivel ?? 0))
                const lt     = leadTimeRecords.find((l) => l.fornecedor === item?.fornecedorPrincipal)
                const col    = SEMAFORO_COLOR[r.status]
                return (
                  <div key={r.id} className={cn('border rounded-lg p-3 flex flex-col gap-1', col.bg, col.border)}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#f5f5f5] font-medium">{item?.descricao ?? r.itemId}</span>
                      <span className={cn('text-[10px] font-bold uppercase', col.text)}>{r.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-[#6b6b6b]">
                      <div>Necessário<br /><span className="text-[#f5f5f5] font-mono">{r.qtdNecessaria} {item?.unidade}</span></div>
                      <div>Disponível<br /><span className="text-[#f5f5f5] font-mono">{item?.qtdDisponivel ?? 0} {item?.unidade}</span></div>
                      <div>Déficit<br /><span className={deficit > 0 ? 'text-[#ef4444] font-mono' : 'text-[#4ade80] font-mono'}>{deficit > 0 ? `-${deficit}` : 'OK'}</span></div>
                    </div>
                    {deficit > 0 && (
                      <div className="text-[10px] text-[#6b6b6b] mt-1">
                        Fornecedor: <span className="text-[#f97316]">{item?.fornecedorPrincipal ?? '—'}</span>
                        {lt && <> · Lead time: <span className="text-[#fbbf24]">{lt.leadTimeDias}d</span></>}
                      </div>
                    )}
                    {deficit > 0 && !r.alertaGerado && (
                      <button
                        onClick={() => handleAlertaGerado(r.id)}
                        className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-[#dc2626]/20 text-[#f87171] border border-[#dc2626]/30 hover:bg-[#dc2626]/30 transition-colors self-start"
                      >
                        <ShoppingCart size={10} /> Gerar Alerta de Compra
                      </button>
                    )}
                    {r.alertaGerado && (
                      <span className="text-[10px] text-[#4ade80] mt-1">Alerta gerado</span>
                    )}
                  </div>
                )
              })}
            </div>
            <button onClick={() => setDetail(null)} className="w-full py-2 rounded-lg text-xs text-[#6b6b6b] border border-[#525252] hover:text-[#a3a3a3] transition-colors">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
