/**
 * WhatIfLogisticoPanel — Simulate activity rescheduling and check stock sufficiency.
 * Non-persistent: results stored in local component state only.
 */
import { useState } from 'react'
import { Play, CheckCircle, AlertTriangle, XCircle, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import type { WhatIfResult } from '@/store/suprimentosStore'
import { cn } from '@/lib/utils'

interface Simulation {
  id: string
  activityId: string
  depositoId: string
  semanaOriginal: number
  semanaSimulada: number
  resultado: WhatIfResult
  rodadoEm: string
}

const SEMANAS = Array.from({ length: 20 }, (_, i) => i + 1)

export function WhatIfLogisticoPanel() {
  const {
    depositos, reservas,
    selectedDepositoId, setSelectedDeposito, runWhatIf,
  } = useSuprimentosStore(
    useShallow((s) => ({
      depositos:           s.depositos,
      reservas:            s.reservas,
      selectedDepositoId:  s.selectedDepositoId,
      setSelectedDeposito: s.setSelectedDeposito,
      runWhatIf:           s.runWhatIf,
    }))
  )

  const [depId, setDepId] = useState(selectedDepositoId ?? depositos[0]?.id ?? '')
  const [activityId, setActivityId]           = useState('')
  const [semanaOriginal, setSemanaOriginal]   = useState(12)
  const [semanaSimulada, setSemanaSimulada]   = useState(14)
  const [simulations, setSimulations]         = useState<Simulation[]>([])

  const activityIds = [...new Set(
    reservas.filter((r) => r.depositoId === depId).map((r) => r.lpsActivityId)
  )]

  function handleSimular() {
    if (!activityId) return
    const resultado = runWhatIf({ activityId, semanaOriginal, semanaSimulada, depositoId: depId })
    const sim: Simulation = {
      id: crypto.randomUUID(),
      activityId,
      depositoId: depId,
      semanaOriginal,
      semanaSimulada,
      resultado,
      rodadoEm: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }
    setSimulations((prev) => [sim, ...prev])
  }

  function handleChangeDeposito(id: string) {
    setDepId(id)
    setSelectedDeposito(id)
    setActivityId('')
  }

  const resultIcon = (r: WhatIfResult['resultado']) => {
    if (r === 'viavel')   return <CheckCircle  size={16} className="text-[#4ade80] shrink-0" />
    if (r === 'alerta')   return <AlertTriangle size={16} className="text-[#fbbf24] shrink-0" />
    return                       <XCircle      size={16} className="text-[#ef4444] shrink-0" />
  }

  const resultBg = (r: WhatIfResult['resultado']) => {
    if (r === 'viavel')  return 'bg-[#16a34a]/10 border-[#16a34a]/30'
    if (r === 'alerta')  return 'bg-[#ca8a04]/10 border-[#ca8a04]/30'
    return 'bg-[#dc2626]/10 border-[#dc2626]/30'
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
      {/* Form card */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
        <h2 className="text-sm font-bold text-[#f5f5f5] mb-4">Simulador de Cenário Logístico</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {/* Frente */}
          <div>
            <label className="text-[10px] text-[#6b6b6b] mb-1 block">Frente de Obra</label>
            <select
              value={depId}
              onChange={(e) => handleChangeDeposito(e.target.value)}
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
            >
              {depositos.filter((d) => d.ativo).map((d) => (
                <option key={d.id} value={d.id}>{d.frente}</option>
              ))}
            </select>
          </div>

          {/* Atividade */}
          <div>
            <label className="text-[10px] text-[#6b6b6b] mb-1 block">Atividade LPS</label>
            <select
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
            >
              <option value="">Selecionar...</option>
              {activityIds.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Semana Original */}
          <div>
            <label className="text-[10px] text-[#6b6b6b] mb-1 block">Semana Original</label>
            <select
              value={semanaOriginal}
              onChange={(e) => setSemanaOriginal(Number(e.target.value))}
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
            >
              {SEMANAS.map((s) => <option key={s} value={s}>Semana {s}</option>)}
            </select>
          </div>

          {/* Semana Simulada */}
          <div>
            <label className="text-[10px] text-[#6b6b6b] mb-1 block">Semana Simulada</label>
            <select
              value={semanaSimulada}
              onChange={(e) => setSemanaSimulada(Number(e.target.value))}
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
            >
              {SEMANAS.map((s) => <option key={s} value={s}>Semana {s}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSimular}
            disabled={!activityId}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-[#f97316] text-white hover:bg-[#f97316]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Play size={14} /> Simular
          </button>
          <p className="text-[11px] text-[#6b6b6b]">Os resultados não são persistidos — apenas para análise.</p>
        </div>
      </div>

      {/* Results */}
      {simulations.length === 0 && (
        <div className="flex items-center justify-center flex-1 min-h-[200px]">
          <div className="text-center">
            <Play size={32} className="text-[#525252] mx-auto mb-2" />
            <p className="text-[#6b6b6b] text-sm">Configure os parâmetros e clique em Simular.</p>
          </div>
        </div>
      )}

      {simulations.map((sim) => (
        <div key={sim.id} className={cn('border rounded-xl p-4', resultBg(sim.resultado.resultado))}>
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {resultIcon(sim.resultado.resultado)}
              <div>
                <p className="text-sm font-semibold text-[#f5f5f5]">{sim.resultado.mensagem}</p>
                <p className="text-[10px] text-[#6b6b6b] mt-0.5">
                  {sim.activityId} · Sem {sim.semanaOriginal} → Sem {sim.semanaSimulada} · {sim.rodadoEm}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSimulations((prev) => prev.filter((s) => s.id !== sim.id))}
              className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors p-1"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {/* Insufficient items */}
          {sim.resultado.itensInsuficientes.length > 0 && (
            <div className="bg-[#2c2c2c]/50 rounded-lg overflow-x-auto">
              <table className="w-full min-w-[560px] text-[11px]">
                <thead>
                  <tr className="bg-[#2c2c2c]">
                    {['Material', 'Disponível', 'Necessário', 'Déficit', 'Fornecedor', 'Lead Time'].map((h) => (
                      <th key={h} className="px-3 py-1.5 text-left text-[#6b6b6b] font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sim.resultado.itensInsuficientes.map((it) => (
                    <tr key={it.itemId} className="border-t border-[#525252]">
                      <td className="px-3 py-2 text-[#f5f5f5] font-medium max-w-[180px] truncate" title={it.descricao}>{it.descricao}</td>
                      <td className="px-3 py-2 font-mono text-[#f5f5f5]">{it.qtdDisponivel}</td>
                      <td className="px-3 py-2 font-mono text-[#f5f5f5]">{it.qtdNecessaria}</td>
                      <td className="px-3 py-2 font-mono text-[#ef4444] font-bold">-{it.deficit}</td>
                      <td className="px-3 py-2 text-[#6b6b6b]">{it.fornecedor ?? '—'}</td>
                      <td className="px-3 py-2">
                        {it.leadTimeDias != null ? (
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-bold',
                            it.leadTimeDias <= 4 ? 'bg-[#16a34a]/20 text-[#4ade80]'
                            : it.leadTimeDias <= 7 ? 'bg-[#ca8a04]/20 text-[#fbbf24]'
                            : 'bg-[#dc2626]/20 text-[#f87171]',
                          )}>
                            {it.leadTimeDias}d
                          </span>
                        ) : <span className="text-[#3f3f3f]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {simulations.length > 0 && (
        <button
          onClick={() => setSimulations([])}
          className="text-xs text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors self-start flex items-center gap-1"
        >
          <Trash2 size={11} /> Limpar histórico
        </button>
      )}
    </div>
  )
}
