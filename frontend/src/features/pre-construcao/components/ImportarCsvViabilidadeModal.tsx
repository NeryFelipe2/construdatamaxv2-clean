/**
 * ImportarCsvViabilidadeModal — importação em lote de linhas de custo (grupo,descricao,valor)
 * pro Estudo de Viabilidade do Contrato. Mesmo fluxo de ImportarCsvModal.tsx da DRE:
 * upload -> prévia (válidas/inválidas) -> confirmar -> adiciona linhas aos grupos existentes.
 */
import { useRef, useState } from 'react'
import { Upload, X, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseCsvViabilidade, type ParsedViabilidadeRow } from '../utils/parseCsvViabilidade'
import type { ViabilidadeGrupoCusto } from '../utils/computeViabilidade'

interface Props {
  onClose: () => void
  onImport: (rows: { grupo: ViabilidadeGrupoCusto['grupo']; descricao: string; valor: number }[]) => void
}

type Step = 'upload' | 'preview' | 'done'

function fmtValor(v?: number) {
  if (v === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function ImportarCsvViabilidadeModal({ onClose, onImport }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [filename, setFilename] = useState('')
  const [rows, setRows] = useState<ParsedViabilidadeRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setParseError(null)
    try {
      const text = await file.text()
      const parsed = parseCsvViabilidade(text)
      if (!parsed.headerOk || parsed.rows.length === 0) {
        setParseError('Arquivo vazio ou sem linhas de dados reconhecíveis.')
        return
      }
      setFilename(file.name)
      setRows(parsed.rows)
      setStep('preview')
    } catch {
      setParseError('Não foi possível ler o arquivo. Certifique-se que é um .csv válido.')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  const validRows = rows.filter((r) => r.valid)
  const invalidRows = rows.filter((r) => !r.valid)

  function handleImport() {
    if (validRows.length === 0) return
    onImport(validRows.map((r) => ({ grupo: r.grupo!, descricao: r.descricao, valor: r.valor! })))
    setImportedCount(validRows.length)
    setStep('done')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-[#525252] bg-[#1a1a1a] flex flex-col shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252] shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={17} className="text-[#f97316]" />
            <div>
              <h2 className="text-sm font-bold text-[#f5f5f5]">Importar Linhas de Custo (CSV)</h2>
              <p className="text-[10px] text-[#6b6b6b]">
                {step === 'upload' && 'Selecione um arquivo .csv'}
                {step === 'preview' && `${filename} — ${rows.length} linha(s) detectada(s)`}
                {step === 'done' && 'Importação concluída'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors',
                  isDragging ? 'border-[#f97316] bg-[#f97316]/10' : 'border-[#525252] hover:border-[#f97316]/50 hover:bg-[#f97316]/5',
                )}
              >
                <Upload size={32} className={cn('transition-colors', isDragging ? 'text-[#f97316]' : 'text-[#6b6b6b]')} />
                <div className="text-center">
                  <p className="text-sm font-medium text-[#f5f5f5]">Arraste um arquivo aqui</p>
                  <p className="text-xs text-[#6b6b6b] mt-1">ou clique para selecionar</p>
                  <p className="text-[10px] text-[#6b6b6b]/70 mt-2">.csv — colunas: grupo, descricao, valor</p>
                </div>
              </div>
              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleInputChange} />
              <div className="bg-[#111] border border-[#525252] rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-[#6b6b6b] font-mono leading-relaxed whitespace-pre-wrap">
{`grupo,descricao,valor
Materiais,Tubo PEAD DN63,22500
Mão de Obra,Equipe rede água,45000
Equipamentos,Retroescavadeira 15 dias,18000`}
                </p>
              </div>
              {parseError && (
                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={13} className="text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-rose-300">{parseError}</p>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 size={13} /> {validRows.length} válida(s)
                </span>
                {invalidRows.length > 0 && (
                  <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                    <AlertTriangle size={13} /> {invalidRows.length} inválida(s) — serão ignoradas
                  </span>
                )}
              </div>
              <div className="bg-[#111] border border-[#525252] rounded-xl overflow-auto max-h-96">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-[#111]">
                    <tr className="border-b border-[#525252]">
                      {['#', 'Grupo', 'Descrição', 'Valor', 'Motivo'].map((h) => (
                        <th key={h} className="px-2.5 py-2 text-left text-[#6b6b6b] font-medium whitespace-nowrap uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={cn('border-t border-[#525252]/50', r.valid ? 'text-[#f5f5f5]' : 'bg-rose-500/10 text-rose-300')}>
                        <td className="px-2.5 py-1.5 text-[#6b6b6b]">{r.lineNumber}</td>
                        <td className="px-2.5 py-1.5 font-mono">{r.grupo ?? (r.raw.grupo || '—')}</td>
                        <td className="px-2.5 py-1.5 max-w-[220px] truncate" title={r.descricao}>{r.descricao || '—'}</td>
                        <td className="px-2.5 py-1.5 font-mono">{r.valor !== undefined ? fmtValor(r.valor) : (r.raw.valor || '—')}</td>
                        <td className="px-2.5 py-1.5">{!r.valid && <span className="text-rose-400">{r.errors.join('; ')}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 size={48} className="text-emerald-400" />
              <div className="text-center">
                <p className="text-sm font-bold text-[#f5f5f5]">Importação concluída!</p>
                <p className="text-xs text-[#6b6b6b] mt-1">{importedCount} linha{importedCount !== 1 ? 's' : ''} adicionada{importedCount !== 1 ? 's' : ''} ao estudo (lembre de salvar).</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-[#525252] shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            {step === 'done' ? 'Fechar' : 'Cancelar'}
          </button>
          <div className="flex gap-2">
            {step === 'preview' && (
              <>
                <button
                  onClick={() => { setStep('upload'); setRows([]); setFilename('') }}
                  className="px-4 py-2 text-xs text-[#6b6b6b] border border-[#525252] rounded-lg hover:text-[#f5f5f5] transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleImport}
                  disabled={validRows.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-[#0a1628] hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Confirmar importação ({validRows.length} linha{validRows.length !== 1 ? 's' : ''} válida{validRows.length !== 1 ? 's' : ''})
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
