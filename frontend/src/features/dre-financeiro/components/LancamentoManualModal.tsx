/**
 * LancamentoManualModal — lançamento manual de receita/despesa na DRE.
 * Grava direto em `lancamentos_financeiros` (Supabase) e dispara refresh() do hook.
 */
import { useState } from 'react'
import { X, Receipt, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  onClose: () => void
  onSaved: () => void
}

const CATEGORIA_SUGESTOES = [
  'Medição',
  'Mão de obra',
  'Material',
  'Equipamento',
  'Transporte',
  'Subempreiteiro',
  'Administração',
  'Imposto',
  'Outro',
]

const inp = (err?: boolean) =>
  cn(
    'w-full rounded-lg px-3 py-2 text-xs bg-[#0d2040] border text-[#e4f2f8] placeholder-[#5a8caa] outline-none focus:ring-1 focus:ring-cyan-400/40 transition-all',
    err ? 'border-rose-500' : 'border-[#20406a] focus:border-cyan-400/60',
  )

export function LancamentoManualModal({ projectId, onClose, onSaved }: Props) {
  const [tipo, setTipo] = useState<'RECEITA' | 'DESPESA'>('RECEITA')
  const [categoria, setCategoria] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!categoria.trim()) errs.categoria = 'Obrigatório'
    if (!descricao.trim()) errs.descricao = 'Obrigatório'
    const v = Number(valor.replace(',', '.'))
    if (!valor || !Number.isFinite(v) || v <= 0) errs.valor = 'Informe um valor maior que zero'
    return errs
  }

  async function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    if (!supabase) {
      setSaveError('Conexão com o banco indisponível.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const { error } = await supabase.from('lancamentos_financeiros').insert({
        id: crypto.randomUUID(),
        project_id: projectId,
        categoria: categoria.trim(),
        descricao: descricao.trim(),
        valor: Number(valor.replace(',', '.')),
        tipo,
        data: data || null,
        criado_por: 'site',
      })
      if (error) throw error
      onSaved()
      onClose()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao salvar lançamento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#20406a] bg-[#112645] flex flex-col shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#20406a] shrink-0">
          <div className="flex items-center gap-2">
            <Receipt size={15} className="text-emerald-400" />
            <h2 className="text-[#e4f2f8] font-bold text-sm">Novo Lançamento</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5a8caa] hover:text-[#e4f2f8] hover:bg-[#0d2040] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {/* Tipo */}
          <div>
            <label className="block text-[10px] font-semibold text-[#5a8caa] uppercase tracking-wider mb-1">
              Tipo *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipo('RECEITA')}
                className={cn(
                  'py-2 rounded-lg text-xs font-bold border transition-colors',
                  tipo === 'RECEITA'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                    : 'bg-[#0d2040] text-[#5a8caa] border-[#20406a] hover:text-[#e4f2f8]',
                )}
              >
                RECEITA
              </button>
              <button
                type="button"
                onClick={() => setTipo('DESPESA')}
                className={cn(
                  'py-2 rounded-lg text-xs font-bold border transition-colors',
                  tipo === 'DESPESA'
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/40'
                    : 'bg-[#0d2040] text-[#5a8caa] border-[#20406a] hover:text-[#e4f2f8]',
                )}
              >
                DESPESA
              </button>
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-[10px] font-semibold text-[#5a8caa] uppercase tracking-wider mb-1">
              Categoria *
            </label>
            <input
              list="dre-categoria-sugestoes"
              value={categoria}
              onChange={(e) => { setCategoria(e.target.value); setErrors((er) => ({ ...er, categoria: '' })) }}
              placeholder="Ex: Medição"
              className={inp(!!errors.categoria)}
            />
            <datalist id="dre-categoria-sugestoes">
              {CATEGORIA_SUGESTOES.map((c) => <option key={c} value={c} />)}
            </datalist>
            {errors.categoria && <p className="text-[10px] text-rose-400 mt-0.5">{errors.categoria}</p>}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-[10px] font-semibold text-[#5a8caa] uppercase tracking-wider mb-1">
              Descrição *
            </label>
            <input
              value={descricao}
              onChange={(e) => { setDescricao(e.target.value); setErrors((er) => ({ ...er, descricao: '' })) }}
              placeholder="Ex: Medição #1 rede água"
              className={inp(!!errors.descricao)}
            />
            {errors.descricao && <p className="text-[10px] text-rose-400 mt-0.5">{errors.descricao}</p>}
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#5a8caa] uppercase tracking-wider mb-1">
                Valor (R$) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={(e) => { setValor(e.target.value); setErrors((er) => ({ ...er, valor: '' })) }}
                placeholder="0,00"
                className={inp(!!errors.valor)}
              />
              {errors.valor && <p className="text-[10px] text-rose-400 mt-0.5">{errors.valor}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#5a8caa] uppercase tracking-wider mb-1">
                Data (opcional)
              </label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className={inp()}
              />
            </div>
          </div>

          {saveError && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2.5">
              <AlertTriangle size={13} className="text-rose-400 mt-0.5 shrink-0" />
              <p className="text-xs text-rose-300">{saveError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#20406a] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-[#5a8caa] hover:text-[#e4f2f8] hover:bg-[#0d2040] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-[#0a1628] hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar Lançamento'}
          </button>
        </div>
      </div>
    </div>
  )
}
