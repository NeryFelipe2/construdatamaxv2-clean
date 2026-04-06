import { useState } from 'react'
import { X, Package } from 'lucide-react'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'

interface Props {
  onClose: () => void
}

const UNIDADE_OPTIONS = ['un', 'sc', 'm³', 'br', 'm²', 'm', 'kg', 't', 'l', 'cx', 'pç', 'rlo']
const CATEGORIA_OPTIONS = [
  'Cimento e Argamassa',
  'Aço / Vergalhão',
  'Concreto Usinado',
  'Tubulação e Saneamento',
  'Impermeabilização',
  'Elétrico',
  'Hidráulico',
  'Outros',
]

const inp = (err?: boolean) =>
  cn(
    'w-full rounded-lg px-3 py-2 text-xs bg-[#484848] border text-[#f5f5f5] placeholder-[#6b6b6b] outline-none focus:ring-1 focus:ring-[#f97316]/40 transition-all',
    err ? 'border-[#ef4444]' : 'border-[#525252] focus:border-[#f97316]/60',
  )

export function NovoMaterialModal({ onClose }: Props) {
  const { depositos, addItemEstoque } = useSuprimentosStore(
    useShallow((s) => ({ depositos: s.depositos, addItemEstoque: s.addItemEstoque })),
  )

  const [form, setForm] = useState({
    descricao: '',
    unidade: 'un',
    depositoId: depositos[0]?.id ?? '',
    qtdDisponivel: '',
    estoqueMinimo: '',
    custoUnitario: '',
    categoria: '',
    fornecedorPrincipal: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.descricao.trim()) errs.descricao = 'Obrigatório'
    if (!form.unidade.trim())   errs.unidade   = 'Obrigatório'
    if (!form.depositoId)       errs.depositoId = 'Selecione um depósito'
    return errs
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    addItemEstoque({
      depositoId:           form.depositoId,
      descricao:            form.descricao.trim(),
      unidade:              form.unidade,
      qtdDisponivel:        parseFloat(form.qtdDisponivel) || 0,
      qtdReservada:         0,
      qtdTransito:          0,
      estoqueMinimo:        parseFloat(form.estoqueMinimo) || 0,
      custoUnitario:        form.custoUnitario ? parseFloat(form.custoUnitario) : undefined,
      categoria:            form.categoria || undefined,
      fornecedorPrincipal:  form.fornecedorPrincipal || undefined,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.76)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#525252] bg-[#333333] flex flex-col shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252] shrink-0">
          <div className="flex items-center gap-2">
            <Package size={15} className="text-[#f97316]" />
            <h2 className="text-[#f5f5f5] font-bold text-sm">Adicionar Material</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#484848] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {/* Depósito */}
          <div>
            <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
              Frente / Depósito *
            </label>
            <select
              value={form.depositoId}
              onChange={(e) => set('depositoId', e.target.value)}
              className={inp(!!errors.depositoId)}
            >
              <option value="">— Selecione —</option>
              {depositos.map((d) => (
                <option key={d.id} value={d.id}>{d.frente}</option>
              ))}
            </select>
            {errors.depositoId && <p className="text-[10px] text-[#ef4444] mt-0.5">{errors.depositoId}</p>}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
              Descrição *
            </label>
            <input
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
              placeholder="Ex: Tubo PVC 100mm JE 6m"
              className={inp(!!errors.descricao)}
            />
            {errors.descricao && <p className="text-[10px] text-[#ef4444] mt-0.5">{errors.descricao}</p>}
          </div>

          {/* Unidade + Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
                Unidade *
              </label>
              <select
                value={form.unidade}
                onChange={(e) => set('unidade', e.target.value)}
                className={inp(!!errors.unidade)}
              >
                {UNIDADE_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
                Categoria
              </label>
              <select
                value={form.categoria}
                onChange={(e) => set('categoria', e.target.value)}
                className={inp()}
              >
                <option value="">— Selecione —</option>
                {CATEGORIA_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Qtd Disponível + Estoque Mínimo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
                Qtd. Disponível
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.qtdDisponivel}
                onChange={(e) => set('qtdDisponivel', e.target.value)}
                placeholder="0"
                className={inp()}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
                Estoque Mínimo
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.estoqueMinimo}
                onChange={(e) => set('estoqueMinimo', e.target.value)}
                placeholder="0"
                className={inp()}
              />
            </div>
          </div>

          {/* Custo Unitário + Fornecedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
                Custo Unit. (R$)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.custoUnitario}
                onChange={(e) => set('custoUnitario', e.target.value)}
                placeholder="0,00"
                className={inp()}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-1">
                Fornecedor Principal
              </label>
              <input
                value={form.fornecedorPrincipal}
                onChange={(e) => set('fornecedorPrincipal', e.target.value)}
                placeholder="Ex: TIGRE"
                className={inp()}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#525252] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#484848] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors"
          >
            Adicionar Material
          </button>
        </div>
      </div>
    </div>
  )
}
