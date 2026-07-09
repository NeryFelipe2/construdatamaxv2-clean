import { useMemo, useState } from 'react'
import { Calculator, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useProjectContext } from '@/store/projectContext'
import { useSupabaseMedicao, type MedicaoItem, type MedicaoRdoGrupo } from '@/hooks/useSupabaseMedicao'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_META: Record<string, { label: string; cor: string; bg: string; border: string }> = {
  pendente: { label: 'PENDENTE', cor: '#a3a3a3', bg: 'rgba(163,163,163,0.10)', border: 'rgba(163,163,163,0.3)' },
  sem_preco: { label: 'SEM PREÇO', cor: '#f97316', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.3)' },
  aprovado: { label: 'APROVADO', cor: '#22c55e', bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.3)' },
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.pendente
  return (
    <span
      className="text-[9px] font-bold uppercase rounded px-1.5 py-0.5 border shrink-0"
      style={{ color: meta.cor, background: meta.bg, borderColor: meta.border }}
    >
      {meta.label}
    </span>
  )
}

function MedicaoRow({
  item,
  onAtualizarPreco,
  onAprovar,
}: {
  item: MedicaoItem
  onAtualizarPreco: (itemId: string, preco: number | null) => void
  onAprovar: (itemId: string) => void
}) {
  const [precoInput, setPrecoInput] = useState<string>(item.preco_unitario !== null ? String(item.preco_unitario) : '')
  const aprovado = item.status === 'aprovado'

  function handleBlur() {
    const trimmed = precoInput.trim()
    if (trimmed === '') {
      if (item.preco_unitario !== null) onAtualizarPreco(item.id, null)
      return
    }
    const parsed = Number(trimmed.replace(',', '.'))
    if (!Number.isNaN(parsed) && parsed !== item.preco_unitario) {
      onAtualizarPreco(item.id, parsed)
    }
  }

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors flex-wrap',
        aprovado ? 'bg-[#1f2e24] border-[#22c55e]/30' : 'bg-[#333333] border-[#3f3f3f]',
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-bold text-[#f5f5f5]">{item.servico || '(serviço não informado)'}</span>
          <StatusBadge status={item.status} />
        </div>
        <div className="text-[11px] text-[#a3a3a3] mt-0.5">
          {item.tubo ? `${item.tubo} · ` : ''}{item.nucleo ? `núcleo ${item.nucleo} · ` : ''}{num(item.quantidade)} {item.unidade}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-[#7a7a7a]">R$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          disabled={aprovado}
          value={precoInput}
          onChange={(e) => setPrecoInput(e.target.value)}
          onBlur={handleBlur}
          placeholder="0,00"
          className="w-24 bg-[#2a2a2a] border border-[#3f3f3f] rounded-md px-2 py-1 text-[12px] text-[#f5f5f5] text-right disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-[#38bdf8]"
        />
        <span className="text-[10px] text-[#7a7a7a]">/{item.unidade}</span>
      </div>

      <div className="w-28 text-right shrink-0">
        <div className="text-[13px] font-bold text-[#f5f5f5]">{item.valor !== null ? brl(item.valor) : '—'}</div>
      </div>

      <div className="shrink-0">
        {aprovado ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#22c55e] px-2.5 py-1.5">
            <CheckCircle2 size={12} /> Aprovado
          </span>
        ) : (
          <button
            onClick={() => onAprovar(item.id)}
            disabled={item.preco_unitario === null}
            title={item.preco_unitario === null ? 'Defina o preço unitário antes de aprovar' : 'Aprovar este item'}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#22c55e] border border-[#22c55e]/40 hover:bg-[#22c55e]/10 rounded-md px-2.5 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <CheckCircle2 size={12} /> Aprovar
          </button>
        )}
      </div>
    </div>
  )
}

function GrupoRdo({
  grupo,
  onAtualizarPreco,
  onAprovar,
}: {
  grupo: MedicaoRdoGrupo
  onAtualizarPreco: (itemId: string, preco: number | null) => void
  onAprovar: (itemId: string) => void
}) {
  const dataFormatada = grupo.data ? grupo.data.split('-').reverse().join('/') : 'sem data'
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] font-bold uppercase tracking-wide text-[#8a8a8a] px-1">
        RDO {dataFormatada} · {grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'}
      </div>
      {grupo.itens.map((item) => (
        <MedicaoRow key={item.id} item={item} onAtualizarPreco={onAtualizarPreco} onAprovar={onAprovar} />
      ))}
    </div>
  )
}

export function MedicaoPage() {
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const { grupos, loading, error, reload, atualizarPreco, aprovarItem } = useSupabaseMedicao(activeProjectId)

  const todosItens = useMemo(() => grupos.flatMap((g) => g.itens), [grupos])
  const totalMedido = useMemo(
    () => todosItens.reduce((acc, i) => acc + (i.valor ?? 0), 0),
    [todosItens],
  )
  const semPrecoCount = useMemo(
    () => todosItens.filter((i) => i.preco_unitario === null && i.status !== 'aprovado').length,
    [todosItens],
  )

  return (
    <div className="h-full flex flex-col bg-[#2a2a2a] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252] bg-[#333333] shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#38bdf8]/15">
            <Calculator size={18} className="text-[#38bdf8]" />
          </div>
          <div>
            <h1 className="text-[#f5f5f5] font-bold text-base leading-tight">Medição (RDO)</h1>
            <p className="text-[#6b6b6b] text-xs">Itens gerados automaticamente a partir dos serviços registrados em RDOs fechados</p>
          </div>
        </div>
        <button onClick={reload} className="flex items-center gap-1.5 text-[11px] text-[#8a8a8a] hover:text-[#f5f5f5] px-3 py-2 rounded-md border border-[#3f3f3f] hover:border-[#525252]">
          <RotateCcw size={12} /> Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="px-6 pt-5 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#3f3f3f] bg-[#333333] p-4">
          <div className="flex items-center gap-2">
            <Calculator size={15} className="text-[#22c55e]" />
            <span className="text-xs font-bold uppercase tracking-wide text-[#22c55e]">Total medido</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#f5f5f5]">{brl(totalMedido)}</div>
          <div className="text-[10px] text-[#8a8a8a] mt-1.5">Soma dos itens com preço unitário definido</div>
        </div>
        <div className="rounded-xl border border-[#3f3f3f] bg-[#333333] p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-[#f97316]" />
            <span className="text-xs font-bold uppercase tracking-wide text-[#f97316]">Sem preço</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#f5f5f5]">{semPrecoCount}</div>
          <div className="text-[10px] text-[#8a8a8a] mt-1.5">Itens aguardando preço unitário</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-5">
        {loading && <div className="text-[12px] text-[#8a8a8a] text-center py-8">Carregando…</div>}
        {error && <div className="text-[12px] text-[#ef4444] text-center py-8">Erro: {error}</div>}
        {!loading && !error && grupos.length === 0 && (
          <div className="text-[12px] text-[#6b6b6b] text-center py-8 border border-dashed border-[#3f3f3f] rounded-lg">
            Nenhum item de medição ainda. Itens aparecem automaticamente quando um RDO é fechado com serviços lançados.
          </div>
        )}
        {grupos.map((grupo) => (
          <GrupoRdo key={grupo.rdo_id} grupo={grupo} onAtualizarPreco={atualizarPreco} onAprovar={aprovarItem} />
        ))}
      </div>
    </div>
  )
}
