/**
 * ImportarCsvLigacoesModal — importação em lote (matriz núcleo×mês OU pendências) via CSV.
 * Mesmo fluxo do ImportarCsvModal da DRE: selecionar arquivo → parsear e mostrar prévia
 * (válidos/inválidos) → confirmar → grava só as linhas válidas → onSaved().
 *
 * BLINDAGEM PII: se o parser detectar coluna de dado pessoal no cabeçalho, a importação
 * é recusada de cara (tela dedicada, nem chega na prévia) — ver utils/parseCsvLigacoes.ts.
 */
import { useRef, useState } from 'react'
import { Upload, X, FileSpreadsheet, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  parseCsvMatrizLigacoes,
  parseCsvPendenciasLigacoes,
  mensagemBlindagemPii,
  type ParsedMatrizRow,
  type ParsedPendenciaRow,
} from '../utils/parseCsvLigacoes'
import type { NovaLinhaMatriz, NovaPendencia } from '@/hooks/useLigacoesOs'

type Kind = 'matriz' | 'pendencias'
type Step = 'upload' | 'preview' | 'done'

interface Props {
  kind: Kind
  onClose: () => void
  onImport: (rows: NovaLinhaMatriz[] | NovaPendencia[]) => Promise<number>
}

export function ImportarCsvLigacoesModal({ kind, onClose, onImport }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [filename, setFilename] = useState('')
  const [matrizRows, setMatrizRows] = useState<ParsedMatrizRow[]>([])
  const [pendRows, setPendRows] = useState<ParsedPendenciaRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [piiError, setPiiError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ importados: number; ignorados: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const titulo = kind === 'matriz' ? 'Importar Matriz Núcleo × Mês (CSV)' : 'Importar Pendências (CSV)'
  const exemploCsv = kind === 'matriz'
    ? `nucleo,mes,la,le,cadastradas\nBoi Malhado,2026-06,51,8,100\nSakura,2026-06,30,12,80`
    : `nucleo,endereco,la,le,tipo,motivo\nBoi Malhado,Rua das Flores 120,1,0,agua,Morador ausente\nSakura,Rua B 45,0,1,esgoto,Falta padrão de ligação`

  async function handleFile(file: File) {
    setParseError(null)
    setPiiError(null)
    try {
      const text = await file.text()
      if (kind === 'matriz') {
        const parsed = parseCsvMatrizLigacoes(text)
        if (parsed.piiBlocked) { setPiiError(mensagemBlindagemPii(parsed.piiColumns)); return }
        if (!parsed.headerOk || parsed.rows.length === 0) { setParseError('Arquivo vazio ou sem linhas de dados reconhecíveis.'); return }
        setFilename(file.name)
        setMatrizRows(parsed.rows)
        setStep('preview')
      } else {
        const parsed = parseCsvPendenciasLigacoes(text)
        if (parsed.piiBlocked) { setPiiError(mensagemBlindagemPii(parsed.piiColumns)); return }
        if (!parsed.headerOk || parsed.rows.length === 0) { setParseError('Arquivo vazio ou sem linhas de dados reconhecíveis.'); return }
        setFilename(file.name)
        setPendRows(parsed.rows)
        setStep('preview')
      }
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

  const rows = kind === 'matriz' ? matrizRows : pendRows
  const validRows = rows.filter((r) => r.valid)
  const invalidRows = rows.filter((r) => !r.valid)

  async function handleImport() {
    if (validRows.length === 0) return
    setImporting(true)
    setSaveError(null)
    try {
      let importados = 0
      if (kind === 'matriz') {
        const payload: NovaLinhaMatriz[] = (validRows as ParsedMatrizRow[]).map((r) => ({
          nucleo: r.nucleo, mes: r.mes as string, la: r.la ?? 0, le: r.le ?? 0, cadastradas: r.cadastradas ?? 0,
        }))
        importados = await onImport(payload)
      } else {
        const payload: NovaPendencia[] = (validRows as ParsedPendenciaRow[]).map((r) => ({
          nucleo: r.nucleo, endereco: r.endereco, la: r.la ?? 0, le: r.le ?? 0, tipo: r.tipo as string, motivo: r.motivo,
        }))
        importados = await onImport(payload)
      }
      setResult({ importados, ignorados: invalidRows.length })
      setStep('done')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao gravar importação.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-[#3f3f3f] bg-[#2f2f2f] flex flex-col shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#3f3f3f] shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={17} className="text-[#38bdf8]" />
            <div>
              <h2 className="text-sm font-bold text-[#f5f5f5]">{titulo}</h2>
              <p className="text-[10px] text-[#8a8a8a]">
                {step === 'upload' && 'Selecione um arquivo .csv'}
                {step === 'preview' && `${filename} — ${rows.length} linha(s) detectada(s)`}
                {step === 'done' && 'Importação concluída'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8a8a8a] hover:text-[#f5f5f5] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {piiError && (
            <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/40 rounded-xl px-4 py-3.5 mb-4">
              <ShieldAlert size={18} className="text-rose-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-rose-300">Importação recusada — dados pessoais detectados</p>
                <p className="text-xs text-rose-200/90 mt-1">{piiError}</p>
              </div>
            </div>
          )}

          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors',
                  isDragging ? 'border-[#38bdf8] bg-[#38bdf8]/10' : 'border-[#3f3f3f] hover:border-[#38bdf8]/50 hover:bg-[#38bdf8]/5',
                )}
              >
                <Upload size={32} className={cn('transition-colors', isDragging ? 'text-[#38bdf8]' : 'text-[#8a8a8a]')} />
                <div className="text-center">
                  <p className="text-sm font-medium text-[#f5f5f5]">Arraste um arquivo aqui</p>
                  <p className="text-xs text-[#8a8a8a] mt-1">ou clique para selecionar</p>
                  <p className="text-[10px] text-[#6b6b6b] mt-2">
                    .csv — colunas: {kind === 'matriz' ? 'nucleo, mes, la, le, cadastradas' : 'nucleo, endereco, la, le, tipo, motivo'}
                  </p>
                </div>
              </div>
              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleInputChange} />
              <div className="bg-[#252525] border border-[#3f3f3f] rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-[#8a8a8a] font-mono leading-relaxed whitespace-pre-wrap">{exemploCsv}</p>
              </div>
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5">
                <ShieldAlert size={13} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-200/90">Nunca inclua colunas de nome, CPF, RG ou nascimento de morador — a importação é recusada automaticamente (LGPD).</p>
              </div>
              {parseError && (
                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={13} className="text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-rose-300">{parseError}</p>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && kind === 'matriz' && (
            <PreviewMatriz rows={matrizRows} validCount={validRows.length} invalidCount={invalidRows.length} saveError={saveError} />
          )}
          {step === 'preview' && kind === 'pendencias' && (
            <PreviewPendencias rows={pendRows} validCount={validRows.length} invalidCount={invalidRows.length} saveError={saveError} />
          )}

          {step === 'done' && result && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 size={48} className="text-emerald-400" />
              <div className="text-center">
                <p className="text-sm font-bold text-[#f5f5f5]">Importação concluída!</p>
                <p className="text-xs text-[#8a8a8a] mt-1">
                  {result.importados} linha{result.importados !== 1 ? 's' : ''} importada{result.importados !== 1 ? 's' : ''}, {result.ignorados} ignorada{result.ignorados !== 1 ? 's' : ''}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#3f3f3f] shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#8a8a8a] hover:text-[#f5f5f5] transition-colors">
            {step === 'done' ? 'Fechar' : 'Cancelar'}
          </button>
          <div className="flex gap-2">
            {step === 'preview' && (
              <>
                <button
                  onClick={() => { setStep('upload'); setMatrizRows([]); setPendRows([]); setFilename('') }}
                  className="px-4 py-2 text-xs text-[#8a8a8a] border border-[#3f3f3f] rounded-lg hover:text-[#f5f5f5] transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || validRows.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#38bdf8] text-[#0a1628] hover:bg-[#5fcaf8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

function PreviewMatriz({ rows, validCount, invalidCount, saveError }: { rows: ParsedMatrizRow[]; validCount: number; invalidCount: number; saveError: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold"><CheckCircle2 size={13} /> {validCount} válida(s)</span>
        {invalidCount > 0 && <span className="flex items-center gap-1.5 text-rose-400 font-semibold"><AlertTriangle size={13} /> {invalidCount} inválida(s) — serão ignoradas</span>}
      </div>
      <div className="bg-[#252525] border border-[#3f3f3f] rounded-xl overflow-auto max-h-96">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[#252525]">
            <tr className="border-b border-[#3f3f3f]">
              {['#', 'Núcleo', 'Mês', 'LA', 'LE', 'Cadastradas', 'Motivo'].map((h) => (
                <th key={h} className="px-2.5 py-2 text-left text-[#8a8a8a] font-medium whitespace-nowrap uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={cn('border-t border-[#3f3f3f]/50', r.valid ? 'text-[#f5f5f5]' : 'bg-rose-500/10 text-rose-300')}>
                <td className="px-2.5 py-1.5 text-[#8a8a8a]">{r.lineNumber}</td>
                <td className="px-2.5 py-1.5">{r.nucleo || '—'}</td>
                <td className="px-2.5 py-1.5 font-mono">{r.mes ?? (r.raw.mes || '—')}</td>
                <td className="px-2.5 py-1.5 font-mono">{r.la ?? (r.raw.la || '—')}</td>
                <td className="px-2.5 py-1.5 font-mono">{r.le ?? (r.raw.le || '—')}</td>
                <td className="px-2.5 py-1.5 font-mono">{r.cadastradas ?? (r.raw.cadastradas || '—')}</td>
                <td className="px-2.5 py-1.5">{!r.valid && <span className="text-rose-400">{r.errors.join('; ')}</span>}</td>
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
  )
}

function PreviewPendencias({ rows, validCount, invalidCount, saveError }: { rows: ParsedPendenciaRow[]; validCount: number; invalidCount: number; saveError: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold"><CheckCircle2 size={13} /> {validCount} válida(s)</span>
        {invalidCount > 0 && <span className="flex items-center gap-1.5 text-rose-400 font-semibold"><AlertTriangle size={13} /> {invalidCount} inválida(s) — serão ignoradas</span>}
      </div>
      <div className="bg-[#252525] border border-[#3f3f3f] rounded-xl overflow-auto max-h-96">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[#252525]">
            <tr className="border-b border-[#3f3f3f]">
              {['#', 'Núcleo', 'Endereço', 'LA', 'LE', 'Tipo', 'Motivo', 'Erro'].map((h) => (
                <th key={h} className="px-2.5 py-2 text-left text-[#8a8a8a] font-medium whitespace-nowrap uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={cn('border-t border-[#3f3f3f]/50', r.valid ? 'text-[#f5f5f5]' : 'bg-rose-500/10 text-rose-300')}>
                <td className="px-2.5 py-1.5 text-[#8a8a8a]">{r.lineNumber}</td>
                <td className="px-2.5 py-1.5">{r.nucleo || '—'}</td>
                <td className="px-2.5 py-1.5 max-w-[180px] truncate" title={r.endereco}>{r.endereco || '—'}</td>
                <td className="px-2.5 py-1.5 font-mono">{r.la ?? (r.raw.la || '—')}</td>
                <td className="px-2.5 py-1.5 font-mono">{r.le ?? (r.raw.le || '—')}</td>
                <td className="px-2.5 py-1.5">{r.tipo ?? (r.raw.tipo || '—')}</td>
                <td className="px-2.5 py-1.5 max-w-[160px] truncate" title={r.motivo}>{r.motivo || '—'}</td>
                <td className="px-2.5 py-1.5">{!r.valid && <span className="text-rose-400">{r.errors.join('; ')}</span>}</td>
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
  )
}
