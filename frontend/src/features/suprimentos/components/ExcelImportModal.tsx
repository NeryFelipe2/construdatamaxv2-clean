/**
 * ExcelImportModal — Multi-step Excel import for Materiais & Estoque.
 * Step 1: Drag-and-drop file upload
 * Step 2: Column mapping (auto-suggested)
 * Step 3: Preview first 5 rows
 * Step 4: Confirm import → addItemEstoque
 */
import { useState, useRef } from 'react'
import { Upload, X, ChevronRight, CheckCircle2, FileSpreadsheet, AlertTriangle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { previewExcel, autoSuggestField, applyColumnMapping } from '../utils/parseExcelEstoque'
import type { ExcelPreview } from '../utils/parseExcelEstoque'
import { cn } from '@/lib/utils'

const KNOWN_FIELDS: { value: string; label: string }[] = [
  { value: 'ignorar',           label: '— Ignorar —'           },
  { value: 'descricao',         label: 'Descrição'             },
  { value: 'unidade',           label: 'Unidade'               },
  { value: 'qtdDisponivel',     label: 'Qtd. Disponível'       },
  { value: 'estoqueMinimo',     label: 'Estoque Mínimo'        },
  { value: 'custoUnitario',     label: 'Custo Unitário (R$)'   },
  { value: 'categoria',         label: 'Categoria'             },
  { value: 'fornecedorPrincipal', label: 'Fornecedor Principal' },
]

interface Props {
  onClose: () => void
}

type Step = 'upload' | 'mapping' | 'preview' | 'done'

export function ExcelImportModal({ onClose }: Props) {
  const { depositos, selectedDepositoId, addItemEstoque } = useSuprimentosStore(
    useShallow((s) => ({
      depositos:          s.depositos,
      selectedDepositoId: s.selectedDepositoId,
      addItemEstoque:     s.addItemEstoque,
    }))
  )

  const [step, setStep]           = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview]     = useState<ExcelPreview | null>(null)
  const [filename, setFilename]   = useState('')
  const [mapping, setMapping]     = useState<Record<string, string>>({})
  const [targetDeposito, setTargetDeposito] = useState(selectedDepositoId ?? depositos[0]?.id ?? '')
  const [error, setError]         = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    try {
      const p = await previewExcel(file)
      if (p.headers.length === 0) {
        setError('Arquivo vazio ou sem dados reconhecíveis.')
        return
      }
      setFilename(file.name)
      setPreview(p)
      // Auto-suggest mapping
      const suggested: Record<string, string> = {}
      for (const h of p.headers) {
        suggested[h] = autoSuggestField(h)
      }
      setMapping(suggested)
      setStep('mapping')
    } catch {
      setError('Não foi possível ler o arquivo. Certifique-se que é um Excel (.xlsx/.xls) ou CSV válido.')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleImport() {
    if (!preview) return
    setImporting(true)
    const items = applyColumnMapping(preview.rows, mapping)
    for (const item of items) {
      addItemEstoque({
        ...item,
        depositoId:   targetDeposito,
        qtdReservada: 0,
        qtdTransito:  0,
      })
    }
    setStep('done')
    setImporting(false)
  }

  const previewItems = preview ? applyColumnMapping(preview.rows.slice(0, 5), mapping) : []
  const totalItems   = preview ? applyColumnMapping(preview.rows, mapping).length : 0
  const deposito     = depositos.find((d) => d.id === targetDeposito)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={18} className="text-[#f97316]" />
            <div>
              <h2 className="text-sm font-bold text-[#f5f5f5]">Importar Planilha Excel</h2>
              <p className="text-[10px] text-[#6b6b6b]">
                {step === 'upload'  && 'Passo 1: Selecionar arquivo'}
                {step === 'mapping' && 'Passo 2: Mapear colunas'}
                {step === 'preview' && 'Passo 3: Confirmar importação'}
                {step === 'done'    && 'Importação concluída'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-0 px-5 py-3 border-b border-[#525252]">
          {(['upload', 'mapping', 'preview', 'done'] as Step[]).map((s, i, arr) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors',
                step === s ? 'bg-[#f97316] text-white'
                  : (arr.indexOf(step) > i) ? 'bg-[#22c55e] text-white'
                  : 'bg-[#525252] text-[#6b6b6b]',
              )}>
                {arr.indexOf(step) > i ? <CheckCircle2 size={12} /> : i + 1}
              </div>
              {i < arr.length - 1 && (
                <div className={cn('h-px w-10', arr.indexOf(step) > i ? 'bg-[#22c55e]' : 'bg-[#525252]')} />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors',
                  isDragging
                    ? 'border-[#f97316] bg-[#f97316]/10'
                    : 'border-[#525252] hover:border-[#f97316]/50 hover:bg-[#f97316]/5',
                )}
              >
                <Upload size={32} className={cn('transition-colors', isDragging ? 'text-[#f97316]' : 'text-[#6b6b6b]')} />
                <div className="text-center">
                  <p className="text-sm font-medium text-[#f5f5f5]">Arraste um arquivo aqui</p>
                  <p className="text-xs text-[#6b6b6b] mt-1">ou clique para selecionar</p>
                  <p className="text-[10px] text-[#3f3f3f] mt-2">.xlsx · .xls · .csv</p>
                </div>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleInputChange}
              />
              {error && (
                <div className="flex items-start gap-2 bg-[#dc2626]/10 border border-[#dc2626]/30 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={13} className="text-[#ef4444] mt-0.5 shrink-0" />
                  <p className="text-xs text-[#f87171]">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Column mapping */}
          {step === 'mapping' && preview && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#6b6b6b]">
                  <span className="text-[#f97316] font-medium">{filename}</span> — {preview.rows.length} linhas detectadas
                </p>
              </div>

              {/* Deposito target */}
              <div>
                <label className="text-[10px] text-[#6b6b6b] mb-1 block">Importar para a frente:</label>
                <select
                  value={targetDeposito}
                  onChange={(e) => setTargetDeposito(e.target.value)}
                  className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
                >
                  {depositos.filter((d) => d.ativo).map((d) => (
                    <option key={d.id} value={d.id}>{d.frente}</option>
                  ))}
                </select>
              </div>

              <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
                <div className="grid grid-cols-2 px-3 py-2 text-[10px] text-[#6b6b6b] font-medium uppercase tracking-wide border-b border-[#525252]">
                  <span>Coluna no Excel</span>
                  <span>Campo do sistema</span>
                </div>
                <div className="divide-y divide-[#525252]">
                  {preview.headers.map((h) => (
                    <div key={h} className="grid grid-cols-2 px-3 py-2 items-center gap-3">
                      <span className="text-xs text-[#f5f5f5] font-medium truncate" title={h}>{h}</span>
                      <select
                        value={mapping[h] ?? 'ignorar'}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [h]: e.target.value }))}
                        className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
                      >
                        {KNOWN_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && preview && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-[#6b6b6b]">
                Serão importados <span className="text-[#f5f5f5] font-semibold">{totalItems} itens</span> para a frente{' '}
                <span className="text-[#f97316] font-medium">{deposito?.frente}</span>. Primeiras 5 linhas:
              </p>
              <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-[#3d3d3d]">
                      {['Descrição', 'Un.', 'Qtd.', 'Mín.', 'Custo', 'Categoria', 'Fornecedor'].map((h) => (
                        <th key={h} className="px-2.5 py-2 text-left text-[#6b6b6b] font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((item, i) => (
                      <tr key={i} className="border-t border-[#525252]">
                        <td className="px-2.5 py-1.5 text-[#f5f5f5] max-w-[140px] truncate" title={item.descricao}>{item.descricao}</td>
                        <td className="px-2.5 py-1.5 text-[#6b6b6b]">{item.unidade}</td>
                        <td className="px-2.5 py-1.5 text-[#f5f5f5] font-mono">{item.qtdDisponivel}</td>
                        <td className="px-2.5 py-1.5 text-[#f5f5f5] font-mono">{item.estoqueMinimo}</td>
                        <td className="px-2.5 py-1.5 text-[#6b6b6b] font-mono">{item.custoUnitario ? `R$ ${item.custoUnitario}` : '—'}</td>
                        <td className="px-2.5 py-1.5 text-[#6b6b6b] max-w-[100px] truncate">{item.categoria ?? '—'}</td>
                        <td className="px-2.5 py-1.5 text-[#6b6b6b] max-w-[100px] truncate">{item.fornecedorPrincipal ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 size={48} className="text-[#22c55e]" />
              <div className="text-center">
                <p className="text-sm font-bold text-[#f5f5f5]">Importação concluída!</p>
                <p className="text-xs text-[#6b6b6b] mt-1">
                  {totalItems} ite{totalItems !== 1 ? 'ns foram adicionados' : 'm foi adicionado'} a{' '}
                  <span className="text-[#f97316]">{deposito?.frente}</span>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#525252]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors"
          >
            {step === 'done' ? 'Fechar' : 'Cancelar'}
          </button>
          <div className="flex gap-2">
            {step === 'mapping' && (
              <button
                onClick={() => setStep('preview')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#f97316] text-white hover:bg-[#f97316]/80 transition-colors"
              >
                Pré-visualizar <ChevronRight size={12} />
              </button>
            )}
            {step === 'preview' && (
              <>
                <button
                  onClick={() => setStep('mapping')}
                  className="px-4 py-2 text-xs text-[#6b6b6b] border border-[#525252] rounded-lg hover:text-[#f5f5f5] transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || totalItems === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#22c55e] text-white hover:bg-[#22c55e]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {importing ? 'Importando...' : `Importar ${totalItems} ite${totalItems !== 1 ? 'ns' : 'm'}`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
