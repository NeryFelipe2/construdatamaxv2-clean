import { useState } from 'react'
import { X, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { usePreConstrucaoStore, calcBDI } from '@/store/preConstrucaoStore'

interface ProposalLine {
  code:        string
  description: string
  qty:         number
  unit:        string
  unitCost:    number
  directCost:  number
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Print modal ─────────────────────────────────────────────────────────────

interface PrintModalProps {
  lines:        ProposalLine[]
  bdiTotal:     number
  totalDirect:  number
  totalBdi:     number
  totalFinal:   number
  onClose:      () => void
}

function PrintModal({ lines, bdiTotal, totalDirect, totalBdi, totalFinal, onClose }: PrintModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8">
      <div className="bg-white text-gray-900 w-full max-w-4xl rounded-xl shadow-2xl mx-4 print:shadow-none print:rounded-none print:mx-0 print:max-w-none">
        {/* Print toolbar — hidden on print */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 print:hidden">
          <h2 className="font-bold text-lg text-gray-900">Proposta de Orçamento</h2>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <Printer size={14} />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Proposal content */}
        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Proposta de Orçamento</h1>
            <p className="text-gray-500 text-sm mt-1">
              Emitido em {new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}
            </p>
          </div>

          <div className="overflow-x-auto"><table className="w-full text-sm border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left font-semibold text-gray-700 border border-gray-200 px-3 py-2 w-24">Código</th>
                <th className="text-left font-semibold text-gray-700 border border-gray-200 px-3 py-2">Descrição</th>
                <th className="text-right font-semibold text-gray-700 border border-gray-200 px-3 py-2 w-20">Qtd</th>
                <th className="text-left font-semibold text-gray-700 border border-gray-200 px-3 py-2 w-12">Un</th>
                <th className="text-right font-semibold text-gray-700 border border-gray-200 px-3 py-2 w-28">Custo Unit.</th>
                <th className="text-right font-semibold text-gray-700 border border-gray-200 px-3 py-2 w-28">Custo Direto</th>
                <th className="text-right font-semibold text-gray-700 border border-gray-200 px-3 py-2 w-16">BDI%</th>
                <th className="text-right font-semibold text-gray-700 border border-gray-200 px-3 py-2 w-28">Preço Final</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const precoFinal = line.directCost * (1 + bdiTotal / 100)
                return (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-200 px-3 py-1.5 font-mono text-xs text-gray-600">{line.code}</td>
                    <td className="border border-gray-200 px-3 py-1.5">{line.description}</td>
                    <td className="border border-gray-200 px-3 py-1.5 text-right tabular-nums">{line.qty.toLocaleString('pt-BR')}</td>
                    <td className="border border-gray-200 px-3 py-1.5 text-gray-500">{line.unit}</td>
                    <td className="border border-gray-200 px-3 py-1.5 text-right tabular-nums">{formatBRL(line.unitCost)}</td>
                    <td className="border border-gray-200 px-3 py-1.5 text-right tabular-nums">{formatBRL(line.directCost)}</td>
                    <td className="border border-gray-200 px-3 py-1.5 text-right tabular-nums">{bdiTotal.toFixed(2)}%</td>
                    <td className="border border-gray-200 px-3 py-1.5 text-right tabular-nums font-semibold">{formatBRL(precoFinal)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-orange-50 font-bold">
                <td colSpan={5} className="border border-gray-200 px-3 py-2 text-right text-gray-700">Totais</td>
                <td className="border border-gray-200 px-3 py-2 text-right tabular-nums">{formatBRL(totalDirect)}</td>
                <td className="border border-gray-200 px-3 py-2 text-right tabular-nums">{formatBRL(totalBdi)}</td>
                <td className="border border-gray-200 px-3 py-2 text-right tabular-nums text-orange-600">{formatBRL(totalFinal)}</td>
              </tr>
            </tfoot>
          </table></div>

          <div className="mt-4 text-xs text-gray-400">
            BDI aplicado: {bdiTotal.toFixed(2)}% — Documento gerado por CONSTRUDATA PALANTIR
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProposalView() {
  const [showPrint, setShowPrint] = useState(false)

  const { takeoffItems, costMatches, bdiConfig, setBDI, setStep } = usePreConstrucaoStore(useShallow((s) => ({
    takeoffItems: s.takeoffItems,
    costMatches:  s.costMatches,
    bdiConfig:    s.bdiConfig,
    setBDI:       s.setBDI,
    setStep:      s.setStep,
  })))

  const bdiTotal = calcBDI(bdiConfig)

  // Build proposal lines from selected matches
  const lines: ProposalLine[] = []
  const selectedMatches = costMatches.filter((m) => m.selected)

  for (const m of selectedMatches) {
    const item = takeoffItems.find((i) => i.id === m.takeoffItemId)
    if (!item) continue
    const unitCost   = m.overrideUnitCost ?? m.unitCost
    const directCost = item.quantity * unitCost
    lines.push({
      code:        m.code,
      description: m.description,
      qty:         item.quantity,
      unit:        item.unit,
      unitCost,
      directCost,
    })
  }

  const totalDirect = lines.reduce((acc, l) => acc + l.directCost, 0)
  const totalBdi    = totalDirect * (bdiTotal / 100)
  const totalFinal  = totalDirect * (1 + bdiTotal / 100)

  const BDI_FIELDS: { key: keyof typeof bdiConfig; label: string }[] = [
    { key: 'adminCentral', label: 'Administração Central' },
    { key: 'iss',          label: 'ISS' },
    { key: 'pisCofins',    label: 'PIS/COFINS' },
    { key: 'seguro',       label: 'Seguro e Garantia' },
    { key: 'lucro',        label: 'Lucro' },
  ]

  return (
    <div className="flex gap-4 h-full">
      {/* LEFT — Proposal table */}
      <div className="flex flex-col flex-1 min-w-0 gap-4">
        {/* Table */}
        <div className="flex-1 bg-[#0d2040] border border-[#20406a] rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#20406a] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep('matching')}
                className="text-xs px-2.5 py-1 rounded border border-[#1f3c5e] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#555] transition-colors"
              >
                ← Voltar
              </button>
              <h2 className="text-[#f5f5f5] font-semibold text-sm">Proposta Orçamentária</h2>
            </div>
            <span className="text-[#6b6b6b] text-xs">{lines.length} itens</span>
          </div>

          <div className="flex-1 overflow-auto overflow-x-auto">
            {lines.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-[#6b6b6b] text-sm">
                Nenhum item selecionado no Matching
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1a3662]">
                    <th className="text-left text-[#6b6b6b] font-medium px-3 py-2 w-20">Código</th>
                    <th className="text-left text-[#6b6b6b] font-medium px-3 py-2">Descrição</th>
                    <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-20">Qtd</th>
                    <th className="text-left text-[#6b6b6b] font-medium px-3 py-2 w-10">Un</th>
                    <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-24">Custo Unit.</th>
                    <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-24">Custo Direto</th>
                    <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-14">BDI%</th>
                    <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-24">Preço Final</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const precoFinal = line.directCost * (1 + bdiTotal / 100)
                    return (
                      <tr
                        key={idx}
                        className="border-t border-[#20406a] hover:bg-[#1a3662] transition-colors"
                      >
                        <td className="px-3 py-2 font-mono text-[#a3a3a3]">{line.code}</td>
                        <td className="px-3 py-2 text-[#f5f5f5]">{line.description}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5]">
                          {line.qty.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-2 text-[#a3a3a3]">{line.unit}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5]">
                          {formatBRL(line.unitCost)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5]">
                          {formatBRL(line.directCost)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#a3a3a3]">
                          {bdiTotal.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-[#2abfdc]">
                          {formatBRL(precoFinal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {lines.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-[#2abfdc]/30 bg-[#1a3662]">
                      <td colSpan={5} className="px-3 py-2 text-right text-[#a3a3a3] text-xs font-semibold">
                        Totais
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5] font-bold">
                        {formatBRL(totalDirect)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#a3a3a3] font-semibold">
                        {formatBRL(totalBdi)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#2abfdc] font-bold">
                        {formatBRL(totalFinal)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-3 shrink-0">
          {[
            { label: 'Custo Direto Total', value: formatBRL(totalDirect), accent: false },
            { label: 'BDI (R$)',           value: formatBRL(totalBdi),    accent: false },
            { label: 'Preço Final com BDI', value: formatBRL(totalFinal), accent: true },
            { label: 'Número de Itens',    value: String(lines.length),   accent: false },
          ].map(({ label, value, accent }) => (
            <div
              key={label}
              className={cn(
                'bg-[#0d2040] border rounded-xl p-4 flex flex-col gap-1',
                accent ? 'border-[#2abfdc]/40' : 'border-[#20406a]',
              )}
            >
              <p className="text-[#6b6b6b] text-xs">{label}</p>
              <p className={cn('text-base font-bold tabular-nums', accent ? 'text-[#2abfdc]' : 'text-[#f5f5f5]')}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Export button */}
        <button
          onClick={() => setShowPrint(true)}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#2abfdc] hover:bg-[#ea6c0a] text-white transition-colors flex items-center justify-center gap-2 shrink-0"
        >
          <Printer size={14} />
          Exportar Proposta
        </button>
      </div>

      {/* RIGHT — BDI config */}
      <div className="w-72 shrink-0">
        <div className="bg-[#0d2040] border border-[#20406a] rounded-xl p-4 flex flex-col gap-4">
          <h2 className="text-[#f5f5f5] font-semibold text-sm">Configuração BDI</h2>

          <div className="flex flex-col gap-3">
            {BDI_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-[#a3a3a3] text-xs">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={bdiConfig[key]}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      if (!isNaN(v) && v >= 0) setBDI({ [key]: v })
                    }}
                    className="flex-1 bg-[#112645] border border-[#1f3c5e] rounded px-3 py-1.5 text-[#f5f5f5] text-sm focus:outline-none focus:border-[#2abfdc] tabular-nums"
                  />
                  <span className="text-[#6b6b6b] text-xs w-4">%</span>
                </div>
              </div>
            ))}

            {/* BDI Total */}
            <div className="border-t border-[#20406a] pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[#f5f5f5] text-sm font-semibold">BDI Total</span>
                <span className="text-[#2abfdc] text-lg font-bold tabular-nums">
                  {bdiTotal.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print modal */}
      {showPrint && (
        <PrintModal
          lines={lines}
          bdiTotal={bdiTotal}
          totalDirect={totalDirect}
          totalBdi={totalBdi}
          totalFinal={totalFinal}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
