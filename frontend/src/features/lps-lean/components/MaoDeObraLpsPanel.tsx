/**
 * MaoDeObraLpsPanel — efetivo REAL das equipes dentro do módulo LPS.
 *
 * 27/07/2026 (Fase 2 LPS-real): o staffing "inventado" a partir das atividades
 * (computeStaffingFromActivities) morreu. Agora cada linha é uma equipe ATIVA
 * de `wcr_equipes` com o efetivo contado em `equipe_membros` (lpsStore →
 * carregarStaffingReal). Não existe dimensionamento-alvo cadastrado no banco,
 * então o gap numérico é 0 por honestidade — o sinal de déficit é qualitativo
 * (equipe `a_contratar` ou ativa sem nenhum membro cadastrado).
 */
import { useEffect } from 'react'
import { Users, RefreshCw } from 'lucide-react'
import { useLpsStore } from '@/store/lpsStore'
import { useShallow } from 'zustand/react/shallow'

const STATUS_COLOR: Record<string, string> = {
  ok:      '#22c55e',
  deficit: '#ef4444',
  surplus: '#3b82f6',
}

const STATUS_LABEL: Record<string, string> = {
  ok:      'Adequado',
  deficit: 'Déficit',
  surplus: 'Excedente',
}

export function MaoDeObraLpsPanel() {
  const { staffingDimensions, computeStaffingDimensions } = useLpsStore(
    useShallow((s) => ({
      staffingDimensions: s.staffingDimensions,
      computeStaffingDimensions: s.computeStaffingDimensions,
    }))
  )

  useEffect(() => {
    if (staffingDimensions.length === 0) computeStaffingDimensions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const totalRequired  = staffingDimensions.reduce((s, d) => s + d.requiredWorkers, 0)
  const totalAvailable = staffingDimensions.reduce((s, d) => s + d.availableFromMaoDeObra, 0)
  const totalGap       = totalRequired - totalAvailable
  const gapPct         = totalRequired > 0 ? Math.round((totalGap / totalRequired) * 100) : 0

  return (
    <div className="flex flex-col gap-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#f5f5f5] font-mono [font-variant-numeric:tabular-nums]">{totalRequired}</p>
          <p className="text-[#6b6b6b] text-xs">Necessários</p>
        </div>
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#f97316] font-mono [font-variant-numeric:tabular-nums]">{totalAvailable}</p>
          <p className="text-[#6b6b6b] text-xs">Disponíveis</p>
        </div>
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: totalGap > 0 ? '#ef4444' : '#22c55e' }}>
            {totalGap > 0 ? `−${totalGap}` : totalGap === 0 ? '0' : `+${Math.abs(totalGap)}`}
          </p>
          <p className="text-[#6b6b6b] text-xs">Gap</p>
        </div>
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: gapPct > 0 ? '#ef4444' : '#22c55e' }}>
            {gapPct}%
          </p>
          <p className="text-[#6b6b6b] text-xs">Gap %</p>
        </div>
      </div>

      {/* Refresh button */}
      <div className="flex items-center gap-2">
        <button
          onClick={computeStaffingDimensions}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c] transition-colors"
        >
          <RefreshCw size={12} />Recarregar
        </button>
        <span className="text-[#6b6b6b] text-[9px] font-mono uppercase tracking-wider">TABELAS wcr_equipes (ativas) + equipe_membros</span>
      </div>

      {/* Table */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#525252] flex items-center gap-2">
          <Users size={14} className="text-[#f97316]" />
          <h3 className="text-[#f5f5f5] text-sm font-semibold">Efetivo Real por Equipe</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#525252]">
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Equipe</th>
                <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Frentes</th>
                <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Efetivo</th>
                <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Membros cadastrados</th>
                <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Gap</th>
                <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {staffingDimensions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#6b6b6b]">
                    0 equipes ativas encontradas em wcr_equipes (ou Supabase indisponível) — cadastre as equipes no Organograma.
                  </td>
                </tr>
              ) : (
                staffingDimensions.map((dim) => {
                  const color = STATUS_COLOR[dim.status]
                  return (
                    <tr key={dim.id} className="border-b border-[#525252] hover:bg-[#484848]">
                      <td className="px-3 py-2 text-[#f5f5f5]">{dim.activityName}</td>
                      <td className="px-3 py-2 text-center text-[#a3a3a3] font-mono">{dim.requiredTeams}</td>
                      <td className="px-3 py-2 text-center text-[#a3a3a3] font-mono">{dim.requiredWorkers}</td>
                      <td className="px-3 py-2 text-center text-[#f97316] font-mono">{dim.availableFromMaoDeObra}</td>
                      <td className="px-3 py-2 text-center font-mono font-bold" style={{ color }}>
                        {dim.gap > 0 ? `−${dim.gap}` : dim.gap === 0 ? '0' : `+${Math.abs(dim.gap)}`}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: color + '18', color }}>
                          {STATUS_LABEL[dim.status]}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
