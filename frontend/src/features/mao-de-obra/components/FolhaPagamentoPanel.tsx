import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Printer } from 'lucide-react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import type { WorkerPayslip } from '@/types'
import { payrollToCSV } from '@/features/mao-de-obra/utils/payrollEngine'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function downloadCSV(content: string, filename: string) {
  const bom  = '\uFEFF'
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Payslip expanded view ────────────────────────────────────────────────────

function PayslipExpanded({ payslip }: { payslip: WorkerPayslip }) {
  return (
    <tr className="bg-[var(--color-surface)]">
      <td colSpan={9} className="px-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Allowances */}
          <div>
            <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase mb-2">Proventos</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Salário Base ({payslip.hoursWorked - payslip.overtimeHours}h)</span>
                <span className="text-[var(--color-text-primary)] font-medium">{fmt(payslip.baseSalary)}</span>
              </div>
              {payslip.allowances.map((a, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{a.description}</span>
                  <span className="text-[#22c55e] font-medium">+ {fmt(a.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-[var(--color-border)] pt-1.5 mt-1.5">
                <span className="text-[var(--color-text-primary)]">Total Bruto</span>
                <span className="text-[var(--color-text-primary)]">{fmt(payslip.grossTotal)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase mb-2">Deduções</p>
            <div className="space-y-1.5">
              {payslip.deductions.map((d, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className={`${d.workerPays ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)] italic'}`}>
                    {d.description}{!d.workerPays ? ' (empregador)' : ''}
                  </span>
                  <span className={`font-medium ${d.workerPays ? 'text-[#ef4444]' : 'text-[var(--color-text-muted)]'}`}>
                    {d.workerPays ? '- ' : ''}{fmt(d.amount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-[var(--color-border)] pt-1.5 mt-1.5">
                <span className="text-[var(--color-text-primary)]">Salário Líquido</span>
                <span className="text-[#22c55e]">{fmt(payslip.netTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-[var(--color-border)]">
          {[
            { label: 'Dias Úteis',    value: payslip.workingDays },
            { label: 'H. Regulares', value: `${(payslip.hoursWorked - payslip.overtimeHours).toFixed(1)}h` },
            { label: 'H. Extras',    value: `${payslip.overtimeHours.toFixed(1)}h` },
            { label: 'H. Noturnas',  value: `${payslip.nightHours.toFixed(1)}h` },
            { label: 'Custo Empresa', value: fmt(payslip.employerCost) },
          ].map(item => (
            <div key={item.label} className="flex flex-col">
              <span className="text-xs text-[var(--color-text-muted)]">{item.label}</span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{item.value}</span>
            </div>
          ))}
        </div>
      </td>
    </tr>
  )
}

// ─── FolhaPagamentoPanel ──────────────────────────────────────────────────────

export function FolhaPagamentoPanel() {
  const { workers, payrollHistory, generatePayroll } = useMaoDeObraStore(
    useShallow(s => ({
      workers:         s.workers,
      payrollHistory:  s.payrollHistory,
      generatePayroll: s.generatePayroll,
    }))
  )

  const now = new Date()
  const [yearMonth, setYearMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const currentPayroll = payrollHistory.find(p => p.month === yearMonth)

  const monthLabel = new Date(yearMonth + '-15').toLocaleDateString('pt-BR', {
    month: 'long', year: 'numeric',
  })

  function prevMonth() {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  function nextMonth() {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleExportCSV() {
    if (!currentPayroll) return
    const nameMap: Record<string, string> = {}
    workers.forEach(w => { nameMap[w.id] = w.name })
    const csv = payrollToCSV(currentPayroll, nameMap)
    downloadCSV(csv, `folha-${yearMonth}.csv`)
  }

  // Worker name map for payslip lookup
  const workerNames = useMemo(() => {
    const m: Record<string, string> = {}
    workers.forEach(w => { m[w.id] = w.name })
    return m
  }, [workers])

  const workerRoles = useMemo(() => {
    const m: Record<string, string> = {}
    workers.forEach(w => { m[w.id] = w.role })
    return m
  }, [workers])

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors text-lg">
            ‹
          </button>
          <span className="min-w-[160px] text-center text-sm font-semibold text-[var(--color-text-primary)] capitalize">
            {monthLabel}
          </span>
          <button onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors text-lg">
            ›
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => generatePayroll(yearMonth)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
            Gerar Folha
          </button>
          {currentPayroll && (
            <>
              <button onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors">
                Exportar CSV
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors">
                <Printer size={14} /> PDF
              </button>
            </>
          )}
        </div>
      </div>

      {!currentPayroll ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-[var(--color-border)]">
          <p className="text-[var(--color-text-muted)] text-sm mb-4">
            Nenhuma folha gerada para {monthLabel}
          </p>
          <button onClick={() => generatePayroll(yearMonth)}
            className="px-5 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            Gerar Folha Agora
          </button>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Custo Total Empresa', value: fmt(currentPayroll.totalEmployerCost), color: 'text-[#ef4444]' },
              { label: 'Total Líquido',        value: fmt(currentPayroll.totalNet),          color: 'text-[#22c55e]' },
              { label: 'Total Bruto',          value: fmt(currentPayroll.totalGross),        color: 'text-[var(--color-accent)]' },
              { label: 'Colaboradores',        value: currentPayroll.headcount,              color: 'text-[var(--color-text-primary)]' },
            ].map(card => (
              <div key={card.label}
                className="flex flex-col items-center py-3 px-2 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
                <span className={`text-base font-bold ${card.color}`}>{card.value}</span>
                <span className="text-xs text-[var(--color-text-muted)] text-center mt-0.5">{card.label}</span>
              </div>
            ))}
          </div>

          {/* Payslip table */}
          <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                    {['', 'Colaborador', 'Cargo', 'H. Trab.', 'Base Bruto', 'Descontos', 'Líquido', 'Custo Empresa', ''].map((h, i) => (
                      <th key={i} className="text-left px-3 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentPayroll.payslips.map(payslip => {
                    const name     = workerNames[payslip.workerId] ?? payslip.workerId
                    const role     = workerRoles[payslip.workerId] ?? '—'
                    const expanded = expandedIds.has(payslip.id)
                    const workerDed = payslip.deductions
                      .filter(d => d.workerPays)
                      .reduce((s, d) => s + d.amount, 0)

                    return (
                      <>
                        <tr key={payslip.id}
                          className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
                          onClick={() => toggleExpand(payslip.id)}>
                          <td className="px-3 py-3 text-[var(--color-text-muted)] text-xs">
                            <span className="select-none">{expanded ? '▼' : '▶'}</span>
                          </td>
                          <td className="px-3 py-3 font-medium text-[var(--color-text-primary)] whitespace-nowrap">{name}</td>
                          <td className="px-3 py-3 text-[var(--color-text-secondary)] text-xs max-w-[120px] truncate">{role}</td>
                          <td className="px-3 py-3 text-[var(--color-text-secondary)]">{payslip.hoursWorked.toFixed(1)}h</td>
                          <td className="px-3 py-3 text-[var(--color-text-primary)]">{fmt(payslip.baseSalary)}</td>
                          <td className="px-3 py-3 text-[#ef4444]">- {fmt(workerDed)}</td>
                          <td className="px-3 py-3 font-semibold text-[#22c55e]">{fmt(payslip.netTotal)}</td>
                          <td className="px-3 py-3 font-semibold text-[var(--color-text-primary)]">{fmt(payslip.employerCost)}</td>
                          <td className="px-3 py-3" />
                        </tr>
                        {expanded && <PayslipExpanded payslip={payslip} />}
                      </>
                    )
                  })}
                </tbody>
                <tfoot className="border-t-2 border-[var(--color-border)]">
                  <tr className="bg-[var(--color-surface)]">
                    <td colSpan={4} className="px-3 py-3 font-bold text-[var(--color-text-primary)]">Total</td>
                    <td className="px-3 py-3 font-bold text-[var(--color-text-primary)]">
                      {fmt(currentPayroll.payslips.reduce((s, p) => s + p.baseSalary, 0))}
                    </td>
                    <td className="px-3 py-3 font-bold text-[#ef4444]">
                      - {fmt(currentPayroll.payslips.reduce((s, p) => s + p.deductions.filter(d => d.workerPays).reduce((a, d) => a + d.amount, 0), 0))}
                    </td>
                    <td className="px-3 py-3 font-bold text-[#22c55e]">{fmt(currentPayroll.totalNet)}</td>
                    <td className="px-3 py-3 font-bold text-[var(--color-text-primary)]">{fmt(currentPayroll.totalEmployerCost)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <p className="text-xs text-[var(--color-text-muted)]">
            Gerado em {new Date(currentPayroll.payslips[0]?.generatedAt ?? '').toLocaleString('pt-BR')}.
            Clique em uma linha para expandir o detalhamento. Valores calculados com tabelas INSS/IRRF 2025.
          </p>
        </>
      )}

      {/* Print-only layout */}
      {currentPayroll && (
        <div className="hidden print:block mt-4">
          <h1 className="text-lg font-bold mb-1">Folha de Pagamento — {monthLabel}</h1>
          <p className="text-xs text-gray-500 mb-3">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {['Funcionário', 'Cargo', 'Depto', 'H. Trab.', 'H. Extra', 'Ad. Not.', 'Bruto', 'INSS', 'IRRF', 'FGTS', 'Líquido'].map((h) => (
                  <th key={h} className="border border-gray-400 px-1.5 py-1 text-left bg-gray-100">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentPayroll.payslips.map((p) => {
                const worker = workers.find((w) => w.id === p.workerId)
                const inss = p.deductions.find((d) => d.description?.includes('INSS'))?.amount ?? 0
                const irrf = p.deductions.find((d) => d.description?.includes('IRRF'))?.amount ?? 0
                const fgts = p.deductions.find((d) => !d.workerPays && d.description?.includes('FGTS'))?.amount ?? 0
                return (
                  <tr key={p.workerId}>
                    <td className="border border-gray-300 px-1.5 py-1">{worker?.name ?? p.workerId}</td>
                    <td className="border border-gray-300 px-1.5 py-1">{worker?.role ?? '—'}</td>
                    <td className="border border-gray-300 px-1.5 py-1">{worker?.department ?? '—'}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{p.hoursWorked.toFixed(0)}h</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{p.overtimeHours.toFixed(0)}h</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{p.nightHours.toFixed(0)}h</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{fmt(p.grossTotal)}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{fmt(inss)}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{fmt(irrf)}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{fmt(fgts)}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right font-semibold">{fmt(p.netTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold bg-gray-100">
                <td colSpan={6} className="border border-gray-400 px-1.5 py-1">Total</td>
                <td className="border border-gray-400 px-1.5 py-1 text-right">{fmt(currentPayroll.totalGross)}</td>
                <td colSpan={3} className="border border-gray-400 px-1.5 py-1" />
                <td className="border border-gray-400 px-1.5 py-1 text-right">{fmt(currentPayroll.totalNet)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
