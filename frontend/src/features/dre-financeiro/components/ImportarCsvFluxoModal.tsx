/**
 * ImportarCsvFluxoModal — importação em lote de projeções de Fluxo de Caixa via CSV.
 * Fluxo: selecionar arquivo → parsear e mostrar prévia (válidas/inválidas) →
 * confirmar → upsert por mês em `fluxo_projecao` (mês já existente → atualiza) → onSaved().
 */
import { useRef, useState } from 'react'
import { Upload, X, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { parseCsvFluxo, type ParsedFluxoRow } from '../utils/parseCsvFluxo'

interface Props {
  projectId: string
  onClose: () => void
  onSaved: () => void
}

type Step = 'upload' | 'preview' | 'done'

function fmtValor(v?: number) {
  if (v === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtMes(iso: string | null) {
  if (!iso) return '—'
  const [y, m] = iso.split('-')
  return `${m}/${y}`
}

export function ImportarCsvFluxoModal({ projectId, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [filename, setFilename] = useState('')
  const [rows, setRows] = useState<ParsedFluxoRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ importados: number; ignorados: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setParseError(null)
    try {
      const text = await file.text()
      const parsed = parseCsvFluxo(text)
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

  async function handleImport() {
    if (!supabase || validRows.length === 0) return
    setImporting(true)
    setSaveError(null)
    try {
      // Uma linha por mês (se o CSV repetir o mesmo mês, a última vence antes do upsert).
      const porMes = new Map<string, ParsedFluxoRow>()
      for (const r of validRows) {
        if (r.mes) porMes.set(r.mes, r)
      }
      const payload = Array.from(porMes.values()).map((r) => ({
        id: crypto.randomUUID(),
        projeto_id: projectId,
        mes: r.mes,
        recebimento_prev: r.recebimento_prev ?? 0,
        // CSV não distingue categoria — cai em "Outros"; refine manualmente na tela depois se quiser detalhar.
        despesa_prev: r.despesa_prev ?? 0,
        despesa_outros: r.despesa_prev ?? 0,
        obs: r.obs || null,
        updated_at: new Date().toISOString(),
      }))
      const { error } = await supabase
        .from('fluxo_projecao')
        .upsert(payload, { onConflict: 'projeto_id,mes' })
      if (error) throw error
      setResult({ importados: payload.length, ignorados: rows.length - payload.length })
      setStep('done')
      onSaved()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao gravar projeções.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-3xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252] shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={17} className="text-[#f97316]" />
            <div>
              <h2 className="text-sm font-bold text-[#f5f5f5]">Importar Projeções de Fluxo (CSV)</h2>
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

        {/* Body */}
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
                  isDragging
                    ? 'border-[#f97316] bg-[#f97316]/10'
                    : 'border-[#525252] hover:border-[#f97316]/50 hover:bg-[#f97316]/5',
                )}
              >
                <Upload size={32} className={cn('transition-colors', isDragging ? 'text-[#f97316]' : 'text-[#6b6b6b]')} />
                <div className="text-center">
                  <p className="text-sm font-medium text-[#f5f5f5]">Arraste um arquivo aqui</p>
                  <p className="text-xs text-[#6b6b6b] mt-1">ou clique para selecionar</p>
                  <p className="text-[10px] text-[#6b6b6b]/60 mt-2">.csv — colunas: mes, recebimento_prev, despesa_prev, obs</p>
                </div>
              </div>
              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleInputChange} />
              <div className="bg-[#333333] border border-[#525252] rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-[#6b6b6b] font-mono leading-relaxed whitespace-pre-wrap">
{`mes,recebimento_prev,despesa_prev,obs
2026-08,180000,95000,Medição prevista trecho 4
09/2026,210000,110000,`}
                </p>
              </div>
              <p className="text-[10px] text-[#6b6b6b]/80">
                Mês existente é atualizado (upsert) — não duplica linha por mês.
              </p>
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

              <div className="bg-[#333333] border border-[#525252] rounded-xl overflow-auto max-h-96">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-[#333333]">
                    <tr className="border-b border-[#525252]">
                      {['#', 'Mês', 'Recebimento Prev.', 'Despesa Prev.', 'Obs', 'Motivo'].map((h) => (
                        <th key={h} className="px-2.5 py-2 text-left text-[#6b6b6b] font-medium whitespace-nowrap uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={i}
                        className={cn(
                          'border-t border-[#525252]/50',
                          r.valid ? 'text-[#f5f5f5]' : 'bg-rose-500/10 text-rose-300',
                        )}
                      >
                        <td className="px-2.5 py-1.5 text-[#6b6b6b]">{r.lineNumber}</td>
                        <td className="px-2.5 py-1.5 font-mono">{fmtMes(r.mes) !== '—' ? fmtMes(r.mes) : (r.raw.mes || '—')}</td>
                        <td className="px-2.5 py-1.5 font-mono">{r.recebimento_prev !== undefined ? fmtValor(r.recebimento_prev) : (r.raw.recebimento_prev || '—')}</td>
                        <td className="px-2.5 py-1.5 font-mono">{r.despesa_prev !== undefined ? fmtValor(r.despesa_prev) : (r.raw.despesa_prev || '—')}</td>
                        <td className="px-2.5 py-1.5 max-w-[200px] truncate" title={r.obs}>{r.obs || '—'}</td>
                        <td className="px-2.5 py-1.5">
                          {!r.valid && <span className="text-rose-400">{r.errors.join('; ')}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {saveError && (
                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={13} className="text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-rose-300">{saveError}</p>
                </div>
              )}
            </div>
          )}

          {step === 'done' && result && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 size={48} className="text-emerald-400" />
              <div className="text-center">
                <p className="text-sm font-bold text-[#f5f5f5]">Importação concluída!</p>
                <p className="text-xs text-[#6b6b6b] mt-1">
                  {result.importados} mês{result.importados !== 1 ? 'es' : ''} gravado{result.importados !== 1 ? 's' : ''} (criado ou atualizado), {result.ignorados} ignorado{result.ignorados !== 1 ? 's' : ''}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#525252] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors"
          >
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
                  disabled={importing || validRows.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-[#2c2c2c] hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {importing ? 'Importando...' : `Confirmar importação (${validRows.length} linha${validRows.length !== 1 ? 's' : ''} válida${validRows.length !== 1 ? 's' : ''})`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
