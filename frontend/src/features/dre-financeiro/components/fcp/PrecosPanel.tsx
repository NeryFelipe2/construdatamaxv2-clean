/**
 * PrecosPanel — tabela de preços unitários do contrato, por obra.
 * São centenas de itens (222 em Bertioga, 305 em Santos na planilha), então a
 * tela é de consulta: busca + filtro de "requer conferência", que é a flag que
 * o importador levanta em valor ausente, zero, negativo ou fora de escala.
 */
import { useMemo, useState } from 'react'
import { Search, AlertTriangle } from 'lucide-react'
import type { UseFcpReturn } from '@/hooks/useFcp'
import { cardCls, inputCls, thCls, trCls, vazioCls, brl } from './ui'

export function PrecosPanel({ fcp }: { fcp: UseFcpReturn }) {
  const { obras, precos } = fcp
  const [busca, setBusca] = useState('')
  const [obraId, setObraId] = useState<string>('')
  const [soConferir, setSoConferir] = useState(false)

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return precos.filter((p) => {
      if (obraId && p.fcp_obra_id !== obraId) return false
      if (soConferir && !p.requer_conferencia) return false
      if (!q) return true
      return (
        p.descricao.toLowerCase().includes(q) ||
        (p.numero_preco ?? '').toLowerCase().includes(q) ||
        (p.item_codigo ?? '').toLowerCase().includes(q)
      )
    })
  }, [precos, busca, obraId, soConferir])

  const aConferir = precos.filter((p) => p.requer_conferencia).length
  const nomeObra = (id: string) => obras.find((o) => o.id === id)?.nome ?? '—'

  if (precos.length === 0) {
    return <div className={vazioCls}>Nenhum preço de contrato importado neste FCP.</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por descrição ou nº do preço…"
            className={`${inputCls} pl-9 w-72`} />
        </div>
        <select value={obraId} onChange={(e) => setObraId(e.target.value)} className={inputCls}>
          <option value="">Todas as obras</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <button onClick={() => setSoConferir((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
            ${soConferir ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                         : 'bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]'}`}>
          <AlertTriangle size={14} />
          Requer conferência {aConferir > 0 && `(${aConferir})`}
        </button>
        <span className="text-xs text-[#6b6b6b] ml-auto">
          {filtrados.length} de {precos.length} {precos.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#3d3d3d] z-10">
              <tr className={trCls}>
                <th className={thCls}>Obra</th>
                <th className={thCls}>Item</th>
                <th className={thCls}>Descrição</th>
                <th className={thCls}>Nº preço</th>
                <th className={thCls}>Un.</th>
                <th className={`${thCls} text-right`}>R$ unitário</th>
                <th className={thCls}>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={7} className={vazioCls}>Nenhum item encontrado com esse filtro.</td></tr>
              ) : filtrados.map((p) => (
                <tr key={p.id} className={`${trCls} hover:bg-[#484848]/40 ${p.requer_conferencia ? 'bg-amber-500/5' : ''}`}>
                  <td className="px-4 py-1.5 text-xs text-[#a3a3a3] whitespace-nowrap">{nomeObra(p.fcp_obra_id)}</td>
                  <td className="px-4 py-1.5 text-xs font-mono text-[#6b6b6b]">{p.item_codigo ?? '—'}</td>
                  <td className="px-4 py-1.5 text-[#f5f5f5]">
                    {p.requer_conferencia && (
                      <AlertTriangle size={12} className="inline mr-1.5 text-amber-400" />
                    )}
                    {p.descricao}
                  </td>
                  <td className="px-4 py-1.5 text-xs font-mono text-[#a3a3a3]">{p.numero_preco ?? '—'}</td>
                  <td className="px-4 py-1.5 text-xs text-[#a3a3a3]">{p.unidade ?? '—'}</td>
                  <td className="px-4 py-1.5 text-right font-mono text-[#f5f5f5] whitespace-nowrap">
                    {p.valor_unitario === null
                      ? <span className="text-amber-400">sem valor</span>
                      : brl(p.valor_unitario)}
                  </td>
                  <td className="px-4 py-1.5 text-xs text-[#6b6b6b]">{p.observacao ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
