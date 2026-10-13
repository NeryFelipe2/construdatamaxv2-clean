import { useEffect, useState } from 'react'
import { Truck, AlertTriangle, TrendingDown, RotateCcw, GripVertical, Plus } from 'lucide-react'
import { useFrotaKanbanStore } from '@/store/frotaKanbanStore'
import { useFrota } from '@/hooks/useFrota'
import { VeiculoModal } from './VeiculoModal'
import { STATUS_ORDER, STATUS_LABEL, type FrotaStatus, type FrotaItem } from '@/data/wcrFrota'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const COL_ACCENT: Record<FrotaStatus, string> = {
  operacao: '#22c55e',
  manutencao: '#f59e0b',
  pedir_saida: '#ef4444',
  devolvido: '#737373',
}

function CardFrota({ item, onDragStart, onClick }: { item: FrotaItem; onDragStart: (id: string) => void; onClick: () => void }) {
  const isSaida = item.status === 'pedir_saida'
  const isDevolvido = item.status === 'devolvido'
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(item.id) }}
      onClick={onClick}
      className={[
        'group rounded-lg border p-3 cursor-grab active:cursor-grabbing transition-colors',
        isSaida ? 'bg-[#3a2523] border-[#ef4444]/50' : 'bg-[#3f3f3f] border-[#525252] hover:border-[#f97316]/60',
        isDevolvido ? 'opacity-70' : '',
      ].join(' ')}
      title="Arraste para outra coluna · clique para editar"
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-[#6b6b6b] mt-0.5 shrink-0 group-hover:text-[#a3a3a3]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-bold text-[#f5f5f5] tracking-wide">{item.placa}</span>
            {item.custoMensal > 0 ? (
              <span className="font-mono text-xs font-bold text-[#f97316] tabular-nums">{brl.format(item.custoMensal)}</span>
            ) : isDevolvido && item.custoOriginal ? (
              <span className="font-mono text-[10px] text-[#22c55e] tabular-nums line-through">{brl.format(item.custoOriginal)}</span>
            ) : (
              <span className="font-mono text-[10px] text-[#6b6b6b]">na medição</span>
            )}
          </div>
          <div className="text-xs text-[#d4d4d4] leading-snug mt-1">{item.tipo}</div>
          <div className="text-[10px] text-[#8a8a8a] mt-1 flex flex-wrap gap-x-2">
            <span>🏢 {item.locador}</span>
            {item.motorista !== '—' && <span>👷 {item.motorista}</span>}
          </div>
          {item.obs && <div className="text-[10px] text-[#7a7a7a] mt-1 italic leading-tight">{item.obs}</div>}
          {isSaida && item.custoMensal > 0 && (
            <div className="mt-2 text-[10px] font-semibold text-[#ef4444] flex items-center gap-1">
              <TrendingDown size={11} /> corta {brl.format(item.custoMensal)}/mês
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function FrotaKanbanPanel() {
  const items = useFrotaKanbanStore((s) => s.items)
  const moveItem = useFrotaKanbanStore((s) => s.moveItem)
  const reset = useFrotaKanbanStore((s) => s.reset)
  const setDefinicoes = useFrotaKanbanStore((s) => s.setDefinicoes)

  const { frota, loading: frotaLoading, atualizarVeiculo, criarVeiculo, removerVeiculo } = useFrota()

  // Quando o useFrota() (Supabase) resolve, troca a base do Kanban pela
  // definição canônica do banco — mesmo padrão do Kanban de Equipes.
  useEffect(() => {
    if (!frotaLoading) setDefinicoes(frota)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frota, frotaLoading])

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<FrotaStatus | null>(null)
  const [modalItem, setModalItem] = useState<FrotaItem | null>(null)
  const [showNovo, setShowNovo] = useState(false)

  const sum = (list: FrotaItem[]) => list.reduce((acc, i) => acc + i.custoMensal, 0)
  const ativoMensal = sum(items.filter((i) => i.status === 'operacao' || i.status === 'manutencao'))
  const ociosoMensal = sum(items.filter((i) => i.status === 'manutencao' || i.status === 'pedir_saida'))
  const cortado = items.filter((i) => i.status === 'devolvido').reduce((acc, i) => acc + (i.custoOriginal ?? 0), 0)

  const handleDrop = (status: FrotaStatus) => {
    if (draggingId) {
      moveItem(draggingId, status)
      void atualizarVeiculo(draggingId, { status })
    }
    setDraggingId(null)
    setOverCol(null)
  }

  return (
    <div className="h-full flex flex-col bg-[#2a2a2a]">
      {/* Resumo */}
      <div className="px-6 pt-5 pb-4 flex flex-wrap items-stretch gap-3 border-b border-[#3f3f3f]">
        <Kpi icon={<Truck size={15} />} label="Frota ativa" value={brl.format(ativoMensal)} sub={`${items.filter(i => i.status !== 'devolvido').length} veículos · /mês`} accent="#f97316" />
        <Kpi icon={<AlertTriangle size={15} />} label="Parado / a cortar" value={brl.format(ociosoMensal)} sub="dinheiro ocioso /mês" accent="#ef4444" highlight={ociosoMensal > 0} />
        <Kpi icon={<TrendingDown size={15} />} label="Já cortado" value={brl.format(cortado)} sub="devoluções /mês" accent="#22c55e" />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowNovo(true)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1a1a1a] bg-[#f97316] hover:bg-[#fb923c] px-3 py-2 rounded-md transition-colors"
          >
            <Plus size={12} /> Adicionar veículo
          </button>
          <button
            onClick={() => { if (confirm('Restaurar o quadro ao estado original da planilha?')) reset() }}
            className="flex items-center gap-1.5 text-[11px] text-[#8a8a8a] hover:text-[#f5f5f5] px-3 py-2 rounded-md border border-[#3f3f3f] hover:border-[#525252] transition-colors"
          >
            <RotateCcw size={12} /> Restaurar
          </button>
        </div>
      </div>

      <div className="px-6 pt-3 pb-1">
        <p className="text-[11px] text-[#7a7a7a]">
          Arraste cada equipamento entre as colunas. Mande o que está ocioso para <span className="text-[#ef4444] font-semibold">Pedir saída</span> para cortar a locação.
        </p>
      </div>

      {/* Colunas */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4">
        <div className="flex gap-4 h-full min-h-0">
          {STATUS_ORDER.map((status) => {
            const colItems = items.filter((i) => i.status === status)
            const colTotal = sum(colItems)
            const accent = COL_ACCENT[status]
            const isOver = overCol === status
            return (
              <div
                key={status}
                onDragOver={(e) => { e.preventDefault(); setOverCol(status) }}
                onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
                onDrop={(e) => { e.preventDefault(); handleDrop(status) }}
                className={[
                  'flex-shrink-0 w-[270px] flex flex-col rounded-xl border bg-[#333333] transition-colors',
                  isOver ? 'border-[#f97316] bg-[#3a3632]' : 'border-[#3f3f3f]',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 px-3 py-3 border-b border-[#3f3f3f]">
                  <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>{STATUS_LABEL[status]}</span>
                  <span className="ml-auto text-[10px] text-[#8a8a8a] bg-[#2a2a2a] border border-[#3f3f3f] rounded-full px-2 py-0.5">{colItems.length}</span>
                </div>
                {colTotal > 0 && (
                  <div className="px-3 py-1.5 text-[10px] font-mono tabular-nums text-[#a3a3a3] border-b border-[#3f3f3f]/60">
                    {brl.format(colTotal)}/mês
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5 min-h-[120px]">
                  {colItems.length === 0 ? (
                    <div className="text-[11px] text-[#6b6b6b] text-center py-6 border border-dashed border-[#3f3f3f] rounded-lg">
                      {isOver ? 'Solte aqui' : 'vazio'}
                    </div>
                  ) : (
                    colItems.map((item) => (
                      <CardFrota key={item.id} item={item} onDragStart={setDraggingId} onClick={() => setModalItem(item)} />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {modalItem && (
        <VeiculoModal
          veiculo={modalItem}
          onClose={() => setModalItem(null)}
          onSave={(input) => atualizarVeiculo(modalItem.id, input)}
          onDelete={() => removerVeiculo(modalItem.id)}
        />
      )}
      {showNovo && (
        <VeiculoModal
          onClose={() => setShowNovo(false)}
          onSave={(input) => criarVeiculo(input)}
        />
      )}
    </div>
  )
}

function Kpi({ icon, label, value, sub, accent, highlight }: { icon: React.ReactNode; label: string; value: string; sub: string; accent: string; highlight?: boolean }) {
  return (
    <div className={['rounded-lg border px-4 py-2.5 min-w-[160px]', highlight ? 'border-[#ef4444]/40 bg-[#ef4444]/5' : 'border-[#3f3f3f] bg-[#333333]'].join(' ')}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#8a8a8a]">
        <span style={{ color: accent }}>{icon}</span>{label}
      </div>
      <div className="font-mono tabular-nums text-lg font-bold mt-0.5" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] text-[#7a7a7a]">{sub}</div>
    </div>
  )
}
