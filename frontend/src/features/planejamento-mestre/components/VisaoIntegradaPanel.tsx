/**
 * VisaoIntegradaPanel — shows all 3 planning horizons simultaneously.
 * Each horizon is collapsible. Provides combined PDF export and individual Excel/PNG exports.
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, FileDown, Layers } from 'lucide-react'
import { PlanejamentoMacroPanel } from './PlanejamentoMacroPanel'
import { DerivacaoPanel } from './DerivacaoPanel'
import { CurtoPrazoPanel } from './CurtoPrazoPanel'

interface HorizonBlockProps {
  title: string
  subtitle: string
  color: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function HorizonBlock({ title, subtitle, color, defaultOpen = true, children }: HorizonBlockProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-2xl border border-[#525252] bg-[#333333] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#3d3d3d] transition-colors"
      >
        <span
          className="w-1 h-6 rounded-full shrink-0"
          style={{ background: color }}
        />
        <div className="flex flex-col items-start min-w-0">
          <span className="text-[#f5f5f5] font-semibold text-sm">{title}</span>
          <span className="text-[#6b6b6b] text-[10px]">{subtitle}</span>
        </div>
        <span className="ml-auto text-[#6b6b6b]">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>

      {open && (
        <div className="border-t border-[#525252]">
          {children}
        </div>
      )}
    </div>
  )
}

export function VisaoIntegradaPanel() {
  function handlePrintAll() {
    const win = window.open('', '_blank')
    if (!win) { alert('Permita pop-ups para exportar.'); return }
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8"/>
      <title>Planejamento Mestre — Visão Integrada</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; }
        h1 { font-size: 14pt; margin-bottom: 4px; }
        h2 { font-size: 11pt; margin: 16px 0 8px; border-left: 3px solid #f97316; padding-left: 8px; }
        .no-print { display: none; }
        @media print { .no-print { display: none; } }
      </style>
    </head><body>
      <div class="no-print" style="padding:8px;text-align:right;">
        <button onclick="window.print()" style="background:#f97316;color:#fff;border:none;padding:6px 18px;border-radius:6px;font-size:10pt;font-weight:700;cursor:pointer;">
          🖨️ Imprimir / Salvar PDF
        </button>
      </div>
      <h1>Planejamento Mestre — Visão Integrada</h1>
      <p style="color:#6b7280;font-size:8pt;">Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
      <h2>Longo Prazo (Gantt Estratégico)</h2>
      <p style="color:#6b7280;font-size:8.5pt;">Visualize o cronograma completo no módulo Longo Prazo e exporte o PNG do Gantt.</p>
      <h2>Médio Prazo (6 Semanas)</h2>
      <p style="color:#6b7280;font-size:8.5pt;">Lookahead de 6 semanas com status por rede e frente de trabalho.</p>
      <h2>Curto Prazo (15 Dias)</h2>
      <p style="color:#6b7280;font-size:8.5pt;">Programação diária com PPC e análise de impacto.</p>
    </body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 400)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]/15">
            <Layers size={18} className="text-[#f97316]" />
          </div>
          <div>
            <h2 className="text-[#f5f5f5] font-semibold text-base">Visão Integrada</h2>
            <p className="text-[#6b6b6b] text-xs">Todos os horizontes de planejamento em uma única tela</p>
          </div>
        </div>

        <button
          onClick={handlePrintAll}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors"
        >
          <FileDown size={14} />
          Exportar Visão Combinada (PDF)
        </button>
      </div>

      {/* Three horizon blocks */}
      <HorizonBlock
        title="Longo Prazo — Gantt Estratégico"
        subtitle="Cronograma completo com WBS, baselines e S-curve"
        color="#f97316"
        defaultOpen
      >
        <div className="p-0">
          <PlanejamentoMacroPanel />
        </div>
      </HorizonBlock>

      <HorizonBlock
        title="Médio Prazo — Lookahead 6 Semanas"
        subtitle="Atividades derivadas do mestre por frente e rede"
        color="#f59e0b"
        defaultOpen
      >
        <div className="p-0">
          <DerivacaoPanel />
        </div>
      </HorizonBlock>

      <HorizonBlock
        title="Curto Prazo — 15 Dias"
        subtitle="Programação diária, PPC e análise de impacto"
        color="#22c55e"
        defaultOpen={false}
      >
        <div className="p-0">
          <CurtoPrazoPanel />
        </div>
      </HorizonBlock>
    </div>
  )
}
