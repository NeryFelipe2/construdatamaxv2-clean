import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import type { FrotaItem } from '@/data/wcrFrota'

interface Props {
  veiculo?: FrotaItem
  onClose: () => void
  onSave: (input: { placa?: string; tipo: string; locador: string; motorista?: string; custoMensal?: number; obs?: string }) => void
  onDelete?: () => void
}

const inputCls = 'w-full rounded-md px-2.5 py-2 text-sm bg-[#1f1f1f] border border-[#3f3f3f] text-[#f5f5f5] placeholder-[#6b6b6b] outline-none focus:border-[#f97316]/60'
const labelCls = 'text-[10px] font-semibold uppercase tracking-wider text-[#8a8a8a] mb-1 block'

export function VeiculoModal({ veiculo, onClose, onSave, onDelete }: Props) {
  const [tipo, setTipo] = useState(veiculo?.tipo ?? '')
  const [placa, setPlaca] = useState(veiculo && veiculo.placa !== '—' ? veiculo.placa : '')
  const [locador, setLocador] = useState(veiculo?.locador ?? '')
  const [motorista, setMotorista] = useState(veiculo && veiculo.motorista !== '—' ? veiculo.motorista : '')
  const [custoMensal, setCustoMensal] = useState(veiculo ? String(veiculo.custoMensal) : '')
  const [obs, setObs] = useState(veiculo?.obs ?? '')
  const [erro, setErro] = useState('')

  const isEdit = !!veiculo

  function handleSalvar() {
    if (!tipo.trim() || !locador.trim()) {
      setErro('Tipo e Locador são obrigatórios.')
      return
    }
    const custo = custoMensal.trim() === '' ? 0 : Number(custoMensal.replace(',', '.'))
    if (Number.isNaN(custo)) {
      setErro('Custo mensal inválido.')
      return
    }
    onSave({
      tipo: tipo.trim(),
      placa: placa.trim() || undefined,
      locador: locador.trim(),
      motorista: motorista.trim() || undefined,
      custoMensal: custo,
      obs: obs.trim() || undefined,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[#525252] bg-[#2c2c2c] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#3f3f3f]">
          <h2 className="text-sm font-bold text-[#f5f5f5]">{isEdit ? 'Editar veículo' : 'Adicionar veículo'}</h2>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-5">
          <div>
            <label className={labelCls}>Tipo / Descrição *</label>
            <input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="ex. Retroescavadeira New Holland" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Placa</label>
              <input value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC-1234" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Custo mensal (R$)</label>
              <input value={custoMensal} onChange={(e) => setCustoMensal(e.target.value)} placeholder="0,00" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Locador *</label>
            <input value={locador} onChange={(e) => setLocador(e.target.value)} placeholder="ex. FAS — Luis" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Motorista/Operador</label>
            <input value={motorista} onChange={(e) => setMotorista(e.target.value)} placeholder="ex. Juan (op.)" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Observações</label>
            <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="observações" className={inputCls} />
          </div>
          {erro && <p className="text-xs text-rose-400">{erro}</p>}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-[#3f3f3f]">
          {isEdit && onDelete ? (
            <button
              onClick={() => { if (confirm('Remover este veículo da frota?')) { onDelete(); onClose() } }}
              className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors"
            >
              <Trash2 size={13} /> Remover
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs text-[#8a8a8a] hover:text-[#f5f5f5] transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#f97316] text-[#1a1a1a] hover:bg-[#fb923c] transition-colors"
            >
              {isEdit ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
