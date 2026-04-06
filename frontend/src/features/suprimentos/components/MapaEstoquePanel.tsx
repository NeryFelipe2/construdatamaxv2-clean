/**
 * MapaEstoquePanel — Inventory map per frente de obra (virtual warehouse).
 * Shows stock status, movement registration, and purchase alerts.
 */
import { useState } from 'react'
import { Plus, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Package } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import type { ItemEstoque } from '@/types'
import { cn } from '@/lib/utils'

function StatusBar({ disponivel, minimo }: { disponivel: number; minimo: number }) {
  if (minimo === 0) return <span className="text-[#6b6b6b] text-[10px]">—</span>
  if (disponivel === 0) return (
    <div className="flex items-center gap-1">
      <div className="h-1.5 w-16 rounded-full bg-[#ef4444]/30"><div className="h-full w-0 rounded-full bg-[#ef4444]" /></div>
      <span className="text-[10px] text-[#ef4444] font-bold">RUPTURA</span>
    </div>
  )
  const pct = Math.min(100, (disponivel / (minimo * 2)) * 100)
  const color = disponivel >= minimo ? '#22c55e' : disponivel > 0 ? '#eab308' : '#ef4444'
  return (
    <div className="flex items-center gap-1">
      <div className="h-1.5 w-16 rounded-full bg-[#525252]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px]" style={{ color }}>{disponivel >= minimo ? 'OK' : 'BAIXO'}</span>
    </div>
  )
}

interface NovoItemForm {
  descricao: string; unidade: string; qtdDisponivel: string
  estoqueMinimo: string; custoUnitario: string; categoria: string
}

interface MovForm {
  itemId: string; tipo: 'entrada' | 'saida'; quantidade: string
  fornecedor: string; nf: string; dataCompra: string; dataMovimento: string
}

export function MapaEstoquePanel() {
  const {
    depositos, estoqueItens, movimentacoes,
    selectedDepositoId, setSelectedDeposito,
    addItemEstoque, addMovimentacao, consumirMaterial,
  } = useSuprimentosStore(
    useShallow((s) => ({
      depositos:           s.depositos,
      estoqueItens:        s.estoqueItens,
      movimentacoes:       s.movimentacoes,
      selectedDepositoId:  s.selectedDepositoId,
      setSelectedDeposito: s.setSelectedDeposito,
      addItemEstoque:      s.addItemEstoque,
      addMovimentacao:     s.addMovimentacao,
      consumirMaterial:    s.consumirMaterial,
    }))
  )

  const [showNovoItem, setShowNovoItem] = useState(false)
  const [showMovForm, setShowMovForm]   = useState(false)
  const [novoItem, setNovoItem] = useState<NovoItemForm>({
    descricao: '', unidade: '', qtdDisponivel: '', estoqueMinimo: '', custoUnitario: '', categoria: '',
  })
  const [movForm, setMovForm] = useState<MovForm>({
    itemId: '', tipo: 'entrada', quantidade: '', fornecedor: '', nf: '',
    dataCompra: new Date().toISOString().slice(0, 10),
    dataMovimento: new Date().toISOString().slice(0, 10),
  })

  const depId    = selectedDepositoId ?? depositos[0]?.id ?? ''
  const deposito = depositos.find((d) => d.id === depId)
  const itens    = estoqueItens.filter((i) => i.depositoId === depId)
  const movs     = movimentacoes.filter((m) => m.depositoId === depId).slice(-8).reverse()

  const totalItens  = itens.length
  const emRuptura   = itens.filter((i) => i.qtdDisponivel === 0).length
  const emTransito  = itens.filter((i) => i.qtdTransito > 0).length
  const valorTotal  = itens.reduce((s, i) => s + i.qtdDisponivel * (i.custoUnitario ?? 0), 0)

  function handleSaveNovoItem() {
    if (!novoItem.descricao || !novoItem.unidade) return
    addItemEstoque({
      depositoId:     depId,
      descricao:      novoItem.descricao,
      unidade:        novoItem.unidade,
      qtdDisponivel:  Number(novoItem.qtdDisponivel) || 0,
      qtdReservada:   0,
      qtdTransito:    0,
      estoqueMinimo:  Number(novoItem.estoqueMinimo) || 0,
      custoUnitario:  Number(novoItem.custoUnitario) || 0,
      categoria:      novoItem.categoria || undefined,
    })
    setNovoItem({ descricao: '', unidade: '', qtdDisponivel: '', estoqueMinimo: '', custoUnitario: '', categoria: '' })
    setShowNovoItem(false)
  }

  function handleSaveMov() {
    if (!movForm.itemId || !movForm.quantidade) return
    const qty       = Number(movForm.quantidade)
    const leadTime  = movForm.dataCompra && movForm.dataMovimento
      ? Math.max(0, Math.round((new Date(movForm.dataMovimento).getTime() - new Date(movForm.dataCompra).getTime()) / 86400000))
      : undefined
    const item = estoqueItens.find((i) => i.id === movForm.itemId)
    if (!item) return

    if (movForm.tipo === 'saida') {
      consumirMaterial(movForm.itemId, qty, { observacoes: `Saída manual — NF: ${movForm.nf || '—'}` })
    } else {
      addMovimentacao({
        itemId:        movForm.itemId,
        depositoId:    depId,
        tipo:          'entrada',
        quantidade:    qty,
        dataMovimento: movForm.dataMovimento,
        dataCompra:    movForm.dataCompra || undefined,
        fornecedor:    movForm.fornecedor || undefined,
        nf:            movForm.nf || undefined,
        leadTimeDias:  leadTime,
      })
    }
    setMovForm({ itemId: '', tipo: 'entrada', quantidade: '', fornecedor: '', nf: '', dataCompra: new Date().toISOString().slice(0, 10), dataMovimento: new Date().toISOString().slice(0, 10) })
    setShowMovForm(false)
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
      {/* Deposito selector */}
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

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Itens',   value: totalItens,                              color: 'text-[#f5f5f5]',  bg: 'bg-[#3d3d3d] border-[#525252]' },
          { label: 'Em Ruptura',    value: emRuptura,                               color: 'text-[#ef4444]',  bg: 'bg-[#dc2626]/10 border-[#dc2626]/30' },
          { label: 'Em Trânsito',   value: emTransito,                              color: 'text-[#fbbf24]',  bg: 'bg-[#ca8a04]/10 border-[#ca8a04]/30' },
          { label: 'Valor em Estoque', value: `R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`, color: 'text-[#4ade80]', bg: 'bg-[#16a34a]/10 border-[#16a34a]/30' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('border rounded-xl p-3 flex flex-col gap-0.5', bg)}>
            <p className="text-[#6b6b6b] text-[11px]">{label}</p>
            <p className={cn('text-xl font-bold tabular-nums', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowNovoItem((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#f97316]/15 text-[#f97316] border border-[#f97316]/30 hover:bg-[#f97316]/25 transition-colors"
        >
          <Plus size={13} /> Novo Item
        </button>
        <button
          onClick={() => setShowMovForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors"
        >
          <ArrowDownCircle size={13} /> Registrar Movimento
        </button>
      </div>

      {/* Novo Item form */}
      {showNovoItem && (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Descrição*', key: 'descricao' as const, span: true },
            { label: 'Unidade*',   key: 'unidade' as const },
            { label: 'Qtd Inicial', key: 'qtdDisponivel' as const, type: 'number' },
            { label: 'Estoque Mínimo', key: 'estoqueMinimo' as const, type: 'number' },
            { label: 'Custo Unit. (R$)', key: 'custoUnitario' as const, type: 'number' },
            { label: 'Categoria', key: 'categoria' as const },
          ].map(({ label, key, type, span }) => (
            <div key={key} className={span ? 'col-span-2 sm:col-span-3' : ''}>
              <label className="text-[10px] text-[#6b6b6b] mb-1 block">{label}</label>
              <input
                type={type ?? 'text'}
                value={novoItem[key]}
                onChange={(e) => setNovoItem((p) => ({ ...p, [key]: e.target.value }))}
                className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
              />
            </div>
          ))}
          <div className="col-span-2 sm:col-span-3 flex gap-2 justify-end">
            <button onClick={() => setShowNovoItem(false)} className="px-3 py-1.5 text-xs text-[#6b6b6b] hover:text-[#a3a3a3]">Cancelar</button>
            <button onClick={handleSaveNovoItem} className="px-4 py-1.5 text-xs font-medium bg-[#f97316] text-white rounded-lg hover:bg-[#f97316]/80">Salvar</button>
          </div>
        </div>
      )}

      {/* Mov form */}
      {showMovForm && (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-[#6b6b6b] mb-1 block">Item*</label>
            <select
              value={movForm.itemId}
              onChange={(e) => setMovForm((p) => ({ ...p, itemId: e.target.value }))}
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
            >
              <option value="">Selecionar...</option>
              {itens.map((i) => <option key={i.id} value={i.id}>{i.descricao}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#6b6b6b] mb-1 block">Tipo</label>
            <select
              value={movForm.tipo}
              onChange={(e) => setMovForm((p) => ({ ...p, tipo: e.target.value as 'entrada' | 'saida' }))}
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
            >
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#6b6b6b] mb-1 block">Quantidade*</label>
            <input type="number" min={0} value={movForm.quantidade} onChange={(e) => setMovForm((p) => ({ ...p, quantidade: e.target.value }))}
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50" />
          </div>
          <div>
            <label className="text-[10px] text-[#6b6b6b] mb-1 block">Fornecedor</label>
            <input type="text" value={movForm.fornecedor} onChange={(e) => setMovForm((p) => ({ ...p, fornecedor: e.target.value }))}
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50" />
          </div>
          <div>
            <label className="text-[10px] text-[#6b6b6b] mb-1 block">NF</label>
            <input type="text" value={movForm.nf} onChange={(e) => setMovForm((p) => ({ ...p, nf: e.target.value }))}
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50" />
          </div>
          <div>
            <label className="text-[10px] text-[#6b6b6b] mb-1 block">Data da Compra</label>
            <input type="date" value={movForm.dataCompra} onChange={(e) => setMovForm((p) => ({ ...p, dataCompra: e.target.value }))}
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50" />
          </div>
          <div>
            <label className="text-[10px] text-[#6b6b6b] mb-1 block">Data Movimentação</label>
            <input type="date" value={movForm.dataMovimento} onChange={(e) => setMovForm((p) => ({ ...p, dataMovimento: e.target.value }))}
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50" />
          </div>
          <div className="col-span-2 sm:col-span-3 flex gap-2 justify-end">
            <button onClick={() => setShowMovForm(false)} className="px-3 py-1.5 text-xs text-[#6b6b6b] hover:text-[#a3a3a3]">Cancelar</button>
            <button onClick={handleSaveMov} className="px-4 py-1.5 text-xs font-medium bg-[#f97316] text-white rounded-lg hover:bg-[#f97316]/80">Registrar</button>
          </div>
        </div>
      )}

      {/* Ruptura alert */}
      {emRuptura > 0 && (
        <div className="bg-[#dc2626]/10 border border-[#dc2626]/30 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-[#ef4444] mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-[#ef4444] text-xs font-semibold mb-1">Alerta de Compra Imediata</p>
            <div className="flex flex-wrap gap-1.5">
              {itens.filter((i) => i.qtdDisponivel === 0).map((i) => (
                <span key={i.id} className="px-2 py-0.5 rounded-full bg-[#dc2626]/20 text-[#f87171] text-[10px] font-medium">
                  {i.descricao}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#525252] flex items-center gap-2">
          <Package size={14} className="text-[#f97316]" />
          <span className="text-xs font-semibold text-[#f5f5f5]">{deposito?.frente ?? '—'}</span>
          <span className="text-[10px] text-[#6b6b6b]">— {deposito?.descricao}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[#2c2c2c]">
                {['Descrição', 'Un.', 'Disponível', 'Reservado', 'Trânsito', 'Mínimo', 'Status'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[#6b6b6b] font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.map((item: ItemEstoque) => (
                <tr key={item.id} className="border-t border-[#525252] hover:bg-[#484848]/30 transition-colors">
                  <td className="px-3 py-2 text-[#f5f5f5] font-medium max-w-[200px] truncate" title={item.descricao}>{item.descricao}</td>
                  <td className="px-3 py-2 text-[#6b6b6b]">{item.unidade}</td>
                  <td className="px-3 py-2 text-[#f5f5f5] font-mono">{item.qtdDisponivel}</td>
                  <td className="px-3 py-2 text-[#fbbf24] font-mono">{item.qtdReservada}</td>
                  <td className="px-3 py-2 font-mono">
                    {item.qtdTransito > 0
                      ? <span className="text-[#f97316]">{item.qtdTransito}</span>
                      : <span className="text-[#3f3f3f]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-[#6b6b6b] font-mono">{item.estoqueMinimo}</td>
                  <td className="px-3 py-2"><StatusBar disponivel={item.qtdDisponivel} minimo={item.estoqueMinimo} /></td>
                </tr>
              ))}
              {itens.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-[#6b6b6b] text-xs">Nenhum item cadastrado nesta frente.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Últimas movimentações */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#525252]">
          <span className="text-xs font-semibold text-[#f5f5f5]">Últimas Movimentações</span>
        </div>
        <div className="divide-y divide-[#525252]">
          {movs.length === 0 && (
            <p className="px-4 py-4 text-[11px] text-[#6b6b6b]">Nenhuma movimentação registrada.</p>
          )}
          {movs.map((m) => {
            const item = estoqueItens.find((i) => i.id === m.itemId)
            const isOut = m.tipo === 'saida'
            const isBig = item && isOut && item.estoqueMinimo > 0 && m.quantidade > item.estoqueMinimo * 1.15
            return (
              <div key={m.id} className={cn('flex items-center gap-3 px-4 py-2.5', isBig && 'bg-[#ca8a04]/5')}>
                {isOut
                  ? <ArrowUpCircle size={14} className="text-[#ef4444] shrink-0" />
                  : <ArrowDownCircle size={14} className="text-[#4ade80] shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-[#f5f5f5] truncate">{item?.descricao ?? m.itemId}</p>
                  <p className="text-[10px] text-[#6b6b6b]">{m.dataMovimento}{m.nf ? ` · ${m.nf}` : ''}{m.fornecedor ? ` · ${m.fornecedor}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isBig && <span title="Consumo acima do esperado"><AlertTriangle size={12} className="text-[#fbbf24]" /></span>}
                  <span className={cn('text-xs font-mono font-bold', isOut ? 'text-[#ef4444]' : 'text-[#4ade80]')}>
                    {isOut ? '-' : '+'}{m.quantidade} {item?.unidade ?? ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
