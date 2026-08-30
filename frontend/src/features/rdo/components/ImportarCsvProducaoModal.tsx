/**
 * ImportarCsvProducaoModal — importação em lote de produção diária via CSV.
 * Fluxo: selecionar arquivo → parsear e mostrar prévia (válidas em verde / inválidas
 * em vermelho com motivo) → confirmar → grava só as linhas válidas → onImported().
 */
import { useRef, useState } from 'react'
import { Upload, X, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { parseCsvProducao, type ParsedProducaoRow } from '../utils/parseCsvProducao'
import type { ProducaoDiariaInput } from '@/hooks/useProducaoDiaria'

interface Props {
  onClose: () => void
  onImport: (inputs: ProducaoDiariaInput[]) => Promise<{ ok: boolean; gravadas: number }>
}

type Step = 'upload' | 'preview' | 'done'

function rowToInput(r: ParsedProducaoRow): ProducaoDiariaInput {
  return {
    data: r.data as string,
    nucleo: r.nucleo,
    equipeNome: r.equipe,
    rua: r.rua,
    la: r.la ?? 0,
    le: r.le ?? 0,
    praM: r.praM ?? 0,
    cUma: r.cUma ?? 0,
    preM: r.preM ?? 0,
    cInsp: r.cInsp ?? 0,
    pv: r.pv ?? 0,
    pi: r.pi ?? 0,
    lie: r.lie ?? 0,
    lia: r.lia ?? 0,
    ihm: r.ihm ?? 0,
    intercept: r.intercept ?? 0,
    obs: r.obs,
  }
}

export function ImportarCsvProducaoModal({ onClose, onImport }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [filename, setFilename] = useState('')
  const [rows, setRows] = useState<ParsedProducaoRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ importados: number; ignorados: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setParseError(null)
    try {
      const text = await file.text()
      const parsed = parseCsvProducao(text)
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
    if (validRows.length === 0) return
    setImporting(true)
    setSaveError(null)
    try {
      const res = await onImport(validRows.map(rowToInput))
      if (!res.ok) {
        setSaveError('Erro ao gravar linhas de produção.')
        return
      }
      setResult({ importados: res.gravadas, ignorados: invalidRows.length })
      setStep('done')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao gravar linhas de produção.')
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
        className="w-full max-w-4xl rounded-2xl border border-[#525252] bg-[#2c2c2c] flex flex-col shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252] shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={17} className="text-[#f97316]" />
            <div>
              <h2 className="text-sm font-bold text-[#f5f5f5]">Importar Produção Diária (CSV)</h2>
              <p className="text-[10px] text-[#a3a3a3]">
                {step === 'upload' && 'Selecione um arquivo .csv'}
                {step === 'preview' && `${filename} — ${rows.length} linha(s) detectada(s)`}
                {step === 'done' && 'Importação concluída'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
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
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                  isDragging ? 'border-[#f97316] bg-[#f97316]/10' : 'border-[#525252] hover:border-[#f97316]/50 hover:bg-[#f97316]/5'
                }`}
              >
                <Upload size={32} className={isDragging ? 'text-[#f97316]' : 'text-[#a3a3a3]'} />
                <div className="text-center">
                  <p className="text-sm font-medium text-[#f5f5f5]">Arraste um arquivo aqui</p>
                  <p className="text-xs text-[#a3a3a3] mt-1">ou clique para selecionar</p>
                  <p className="text-[10px] text-[#6b6b6b] mt-2">.csv — colunas: data, nucleo, equipe, rua, la, le, pra_m, c_uma, pre_m, c_insp, pv, pi, lie, lia, ihm, int, obs</p>
                </div>
              </div>
              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleInputChange} />
              <div className="bg-[#1f1f1f] border border-[#525252] rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-[#a3a3a3] font-mono leading-relaxed whitespace-pre-wrap">
{`data,nucleo,equipe,rua,la,le,pra_m,c_uma,pre_m,c_insp,pv,pi,lie,lia,ihm,int,obs
2026-07-06,Boi Malhado,Equipe João Batista,Rua das Flores,2,1,45.5,1,0,0,1,0,2,1,0,0,Chuva a tarde
2026-07-06,Boi Malhado,Equipe Wellington,Rua Ipê,1,0,,0,32,1,0,1,0,1,0,0,`}
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

              <div className="bg-[#1f1f1f] border border-[#525252] rounded-xl overflow-auto max-h-96">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-[#1f1f1f]">
                    <tr className="border-b border-[#525252]">
                      {['#', 'Data', 'Núcleo', 'Equipe', 'Rua', 'LA', 'LE', 'PRA m', 'C.UMA', 'PRE m', 'C.INSP', 'PV', 'PI', 'LIE', 'LIA', 'IHM', 'INT', 'Motivo'].map((h) => (
                        <th key={h} className="px-2 py-2 text-left text-[#a3a3a3] font-medium whitespace-nowrap uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={i}
                        className={`border-t border-[#525252]/50 ${r.valid ? 'text-[#f5f5f5]' : 'bg-rose-500/10 text-rose-300'}`}
                      >
                        <td className="px-2 py-1.5 text-[#a3a3a3]">{r.lineNumber}</td>
                        <td className="px-2 py-1.5 font-mono">{r.data ?? (r.raw.data || '—')}</td>
                        <td className="px-2 py-1.5">{r.nucleo || '—'}</td>
                        <td className="px-2 py-1.5 max-w-[140px] truncate" title={r.equipe}>{r.equipe || '—'}</td>
                        <td className="px-2 py-1.5 max-w-[140px] truncate" title={r.rua}>{r.rua || '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{r.la ?? '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{r.le ?? '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{r.praM ?? '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{r.cUma ?? '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{r.preM ?? '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{r.cInsp ?? '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{r.pv ?? '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{r.pi ?? '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{r.lie ?? '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{r.lia ?? '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{r.ihm ?? '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{r.intercept ?? '—'}</td>
                        <td className="px-2 py-1.5">{!r.valid && <span className="text-rose-400">{r.errors.join('; ')}</span>}</td>
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
                <p className="text-xs text-[#a3a3a3] mt-1">
                  {result.importados} linha{result.importados !== 1 ? 's' : ''} importada{result.importados !== 1 ? 's' : ''}, {result.ignorados} ignorada{result.ignorados !== 1 ? 's' : ''}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#525252] shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
            {step === 'done' ? 'Fechar' : 'Cancelar'}
          </button>
          <div className="flex gap-2">
            {step === 'preview' && (
              <>
                <button
                  onClick={() => { setStep('upload'); setRows([]); setFilename('') }}
                  className="px-4 py-2 text-xs text-[#a3a3a3] border border-[#525252] rounded-lg hover:text-[#f5f5f5] transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || validRows.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-[#0a1628] hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
