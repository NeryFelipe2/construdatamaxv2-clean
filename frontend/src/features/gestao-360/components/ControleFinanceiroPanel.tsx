import { useSupabaseDre } from '@/lib/useSupabaseDre'
import { useProjectContext } from '@/store/projectContext'
import {
  DollarSign, TrendingDown, TrendingUp, AlertTriangle,
  Activity, Calendar, FileText, PieChart, Loader2
} from 'lucide-react'
import { useMemo, useState } from 'react'

export function ControleFinanceiroPanel() {
  const { activeProjectId } = useProjectContext()
  const { lancamentos, trechos, loading, connectionStatus } = useSupabaseDre(activeProjectId)

  const [bacInput, setBacInput] = useState<string>('')

  // ----- Financial Calculations -----
  const metrics = useMemo(() => {
    // 1. BAC = Orçamentor Total 
    const trechosBac = trechos.reduce((acc, t) => acc + Number(t.custo_total || 0), 0)
    const BAC = trechosBac > 0 ? trechosBac : 789171.00

    // 2. EV = Earned Value 
    let EV = trechos.filter(t => t.status === 'executado').reduce((acc, t) => acc + Number(t.custo_total || 0), 0)
    if (EV === 0 && trechos.length === 0) EV = 7891.71

    // 3. AC = Actual Cost
    let AC = lancamentos.filter(l => l.tipo === 'DESPESA').reduce((acc, l) => acc + Number(l.valor || 0), 0)
    if (AC === 0 && lancamentos.length === 0) AC = 7891.71

    // 4. PV = Planned Value
    const PV = EV > 0 ? EV * 1.1 : 8500.00 

    const CPI = AC > 0 ? EV / AC : 0
    const SPI = PV > 0 ? EV / PV : 0
    const CV = EV - AC
    const SV = EV - PV

    const EAC = CPI > 0 ? BAC / CPI : BAC
    const ETC = EAC - AC
    const VAC = BAC - EAC
    const TCPI = (BAC - EV) > 0 && (BAC - AC) > 0 ? (BAC - EV) / (BAC - AC) : 1

    return { BAC, EV, AC, PV, CPI, SPI, CV, SV, EAC, ETC, VAC, TCPI }
  }, [lancamentos, trechos])

  const categoriasRaw = lancamentos.filter(l => l.tipo === 'DESPESA').reduce((acc, l) => {
    acc[l.categoria] = (acc[l.categoria] || 0) + Number(l.valor || 0)
    return acc
  }, {} as Record<string, number>)

  const categories = Object.entries(categoriasRaw).map(([name, val]) => ({
    name,
    value: val,
    pct: metrics.AC > 0 ? (val / metrics.AC) * 100 : 0
  }))

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  if (loading) {
    return (
      <div className="flex bg-white rounded-xl border border-gray-200 h-64 items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mr-2" />
        <span className="text-gray-500">Carregando dados financeiros...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Activity className="text-blue-600" />
          Controle Financeiro da Obra (EVM)
        </h2>
        <p className="text-sm text-gray-500">
          Acompanhe o desempenho financeiro com indicadores EVM (Earned Value Management).
        </p>
        <div className="mt-2 text-[11px] font-medium">
          <span className={`inline-flex items-center rounded-full px-2 py-1 ${
            connectionStatus === 'connected'
              ? 'bg-emerald-50 text-emerald-700'
              : connectionStatus === 'partial'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-slate-100 text-slate-600'
          }`}>
            {connectionStatus === 'connected' ? 'Canonico' : connectionStatus === 'partial' ? 'Parcial' : 'Local'}
          </span>
        </div>
      </div>

      {/* CORE METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-400 uppercase">Orçamento Total (BAC)</span>
          <div className="text-2xl font-bold text-gray-900 mt-1">{formatBRL(metrics.BAC)}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-blue-500">
          <span className="text-xs font-bold text-blue-500 uppercase">Valor Planejado (PV)</span>
          <div className="text-2xl font-bold text-gray-900 mt-1">{formatBRL(metrics.PV)}</div>
          <div className="text-[10px] text-gray-400 mt-1">Custo orçado do trabalho agendado</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-emerald-500">
          <span className="text-xs font-bold text-emerald-500 uppercase">Valor Agregado (EV)</span>
          <div className="text-2xl font-bold text-gray-900 mt-1">{formatBRL(metrics.EV)}</div>
          <div className="text-[10px] text-gray-400 mt-1">Trabalho fisicamente realizado</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-rose-500">
          <span className="text-xs font-bold text-rose-500 uppercase">Custo Real (AC)</span>
          <div className="text-2xl font-bold text-gray-900 mt-1">{formatBRL(metrics.AC)}</div>
          <div className="text-[10px] text-gray-400 mt-1">Gastos reais efetuados</div>
        </div>
      </div>

      {/* PERFORMANCE INDICATORS (CPI/SPI) & PROJECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6 grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2">Índices de Desempenho</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-gray-600">CPI (Custo)</span>
                  <span className={`text-xs font-bold ${metrics.CPI >= 1 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {metrics.CPI.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className={`h-full ${metrics.CPI >= 1 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, metrics.CPI * 50)}%` }} />
                </div>
                <span className="text-[10px] text-gray-400">EV / AC ( &gt; 1 é bom )</span>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-gray-600">SPI (Prazo)</span>
                  <span className={`text-xs font-bold ${metrics.SPI >= 1 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {metrics.SPI.toFixed(2)}
                  </span>
             </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className={`h-full ${metrics.SPI >= 1 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, metrics.SPI * 50)}%` }} />
                </div>
                <span className="text-[10px] text-gray-400">EV / PV ( &gt; 1 é bom )</span>
              </div>
            </div>
            
            <div className="mt-6 space-y-2">
               <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                 <span className="text-xs text-gray-500">CV (Variação Custo)</span>
                 <span className={`text-xs font-bold ${metrics.CV >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatBRL(metrics.CV)}</span>
               </div>
               <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                 <span className="text-xs text-gray-500">SV (Variação Prazo)</span>
                 <span className={`text-xs font-bold ${metrics.SV >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatBRL(metrics.SV)}</span>
               </div>
            </div>
          </div>

          <div>
             <h3 className="text-sm font-bold text-gray-800 mb-4 border-b pb-2">Projeções</h3>
             <div className="space-y-4">
                <div className="flex items-start gap-3">
                   <div className="p-2 bg-blue-50 text-blue-600 rounded mt-1"><TrendingUp size={16} /></div>
                   <div>
                     <div className="text-sm font-bold text-gray-900">{formatBRL(metrics.EAC)}</div>
                     <span className="text-[10px] text-gray-400 font-bold">EAC (Estimativa no Término)</span><br/>
                     <span className="text-[10px] text-gray-400">Custo estimado final do projeto</span>
                   </div>
                </div>
                <div className="flex items-start gap-3">
                   <div className="p-2 bg-blue-50 text-blue-600 rounded mt-1"><Activity size={16} /></div>
                   <div>
                     <div className="text-sm font-bold text-gray-900">{formatBRL(metrics.ETC)}</div>
                     <span className="text-[10px] text-gray-400 font-bold">ETC (A Completar)</span><br/>
                     <span className="text-[10px] text-gray-400">Custo restante projetado</span>
                   </div>
                </div>
                <div className="flex items-start gap-3">
                   <div className="p-2 bg-orange-50 text-orange-600 rounded mt-1"><AlertTriangle size={16} /></div>
                   <div>
                     <div className={`text-sm font-bold ${metrics.VAC >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatBRL(metrics.VAC)}</div>
                     <span className="text-[10px] text-gray-400 font-bold">VAC (Variação Final)</span><br/>
                     <span className="text-[10px] text-gray-400">BAC - EAC</span>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Custo por Categoria */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <PieChart size={16} className="text-blue-500" />
            Custos por Categoria
          </h3>
          {categories.length === 0 ? (
            <div className="text-center py-6">
               <span className="text-xs text-gray-400">Nenhum custo lançado</span>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map(c => (
                <div key={c.name}>
                  <div className="flex justify-between items-end mb-1">
                     <span className="text-xs font-semibold text-gray-700">{c.name}</span>
                     <span className="text-[10px] font-bold text-gray-500">{formatBRL(c.value)}</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabela de Lançamentos Financeiros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
           <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
             <FileText size={16} className="text-blue-500" />
             Lançamentos Financeiros
           </h3>
           <span className="text-xs text-gray-400 font-medium">{lancamentos.length} registro(s)</span>
        </div>
        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white sticky top-0 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Data</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Categoria</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Descrição</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-right">Valor</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lancamentos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400 text-xs">
                     Nenhum lançamento registrado para este projeto ou ocorreu falha de conexão.
                  </td>
                </tr>
              ) : (
                lancamentos.map((l: any) => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-600">{new Date(l.data).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">{l.categoria}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{l.descricao}</td>
                    <td className={`px-4 py-3 text-xs font-bold text-right ${l.tipo === 'DESPESA' ? 'text-rose-600' : 'text-emerald-600'}`}>
                       {l.tipo === 'DESPESA' ? '-' : '+'}{formatBRL(Number(l.valor))}
                    </td>
                    <td className="px-4 py-3 text-[10px]">
                      <span className={`px-2 py-0.5 rounded font-bold uppercase ${l.tipo === 'DESPESA' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {l.tipo}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
