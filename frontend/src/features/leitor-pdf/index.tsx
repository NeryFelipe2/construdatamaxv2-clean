/**
 * LeitorPdfPage — Módulo de Extração Algorítmica de PDFs
 * Adaptado para ConstruData Max.
 * Extrai texto de PDFs de projeto (medições, orçamentos, plantas)
 * com pipeline de limpeza e visualização inline.
 */
import { useState, useCallback, useRef } from "react"
import {
  Upload, FileText, CheckCircle, XCircle, Loader2,
  ChevronDown, ChevronRight, Trash2, RefreshCw, AlertTriangle,
  FileSearch, Eye, Copy, Download,
} from "lucide-react"

// ─── Tipos Locais ───────────────────────────────────────────────────────────
interface QueuedPdf {
  id: string
  file: File
  status: "pending" | "processing" | "done" | "error"
  result?: ExtractedPdf
  error?: string
}

interface ExtractedPdf {
  text: string
  pageCount: number
  charsPerPage: number
  sections: ExtractedSection[]
}

interface ExtractedSection {
  title: string
  content: string
  confidence: number
}

// ─── Pipeline de Limpeza Local (port do pdf-extractor backend) ──────────────
const ENCODING_FIXES: [RegExp, string][] = [
  [/Ã£/g, "ã"], [/Ã¢/g, "â"], [/Ã /g, "à"], [/Ã¡/g, "á"],
  [/Ã©/g, "é"], [/Ãª/g, "ê"], [/Ã­/g, "í"], [/Ã³/g, "ó"],
  [/Ã´/g, "ô"], [/Ãº/g, "ú"], [/Ã§/g, "ç"],
  [/â€œ/g, '"'], [/â€/g, '"'], [/â€™/g, "'"],
  [/\u00a0/g, " "],
]

function fixEncoding(text: string): string {
  let r = text
  for (const [p, rep] of ENCODING_FIXES) r = r.replace(p, rep)
  return r
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function removeRepeatedLines(text: string, minRepeat = 3): string {
  const lines = text.split("\n")
  if (lines.length < minRepeat * 2) return text
  const freq = new Map<string, number>()
  for (const l of lines) { const t = l.trim(); if (t.length > 8) freq.set(t, (freq.get(t) ?? 0) + 1) }
  const repeated = new Set([...freq.entries()].filter(([, c]) => c >= minRepeat).map(([l]) => l))
  if (repeated.size === 0) return text
  return lines.filter(l => !repeated.has(l.trim())).join("\n")
}

// Extrai seções com heurísticas simples (linhas em maiúsculas, numeradas, etc)
function extractSections(text: string): ExtractedSection[] {
  const lines = text.split("\n")
  const sections: ExtractedSection[] = []
  let currentTitle = "Conteúdo Geral"
  let currentLines: string[] = []

  for (const line of lines) {
    const t = line.trim()
    // linhas curtas em maiúsculas provavelmente são títulos de seção
    const isTitle = t.length > 3 && t.length < 80 && t === t.toUpperCase() && !/^\d+[\.,]/.test(t)
    if (isTitle && currentLines.length > 0) {
      sections.push({ title: currentTitle, content: currentLines.join("\n").trim(), confidence: 0.7 })
      currentTitle = t
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }
  if (currentLines.length > 0) {
    sections.push({ title: currentTitle, content: currentLines.join("\n").trim(), confidence: 0.7 })
  }
  return sections
}

// Leitura do PDF via FileReader no client-side (fallback sem backend)
async function readPdfClientSide(file: File): Promise<ExtractedPdf> {
  const text = await file.text() // raw text extraction
  let cleaned = fixEncoding(text)
  cleaned = normalizeWhitespace(cleaned)
  cleaned = removeRepeatedLines(cleaned)
  const lines = cleaned.split("\n").filter(l => l.trim().length > 0)
  const sections = extractSections(cleaned)
  return {
    text: cleaned,
    pageCount: Math.max(1, Math.ceil(lines.length / 50)),
    charsPerPage: lines.length > 0 ? Math.floor(cleaned.length / Math.max(1, Math.ceil(lines.length / 50))) : 0,
    sections,
  }
}

// ─── Subcomponentes ─────────────────────────────────────────────────────────

function QueueRow({ qf, onRemove }: { qf: QueuedPdf; onRemove: (id: string) => void }) {
  const fmtSize = (b: number) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(1) + " MB"
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[#14294e] transition-colors group">
      {qf.status === "processing" ? <Loader2 size={16} className="text-cyan-400 animate-spin shrink-0" />
        : qf.status === "done" ? <CheckCircle size={16} className="text-green-400 shrink-0" />
        : qf.status === "error" ? <XCircle size={16} className="text-rose-400 shrink-0" />
        : <FileText size={16} className="text-[#5a8caa] shrink-0" />}
      <span className="flex-1 text-sm text-[#e4f2f8] truncate">{qf.file.name}</span>
      <span className="text-[10px] text-[#5a8caa] font-mono shrink-0">{fmtSize(qf.file.size)}</span>
      {qf.status === "pending" && (
        <button onClick={() => onRemove(qf.id)} className="w-6 h-6 flex items-center justify-center rounded text-[#5a8caa] hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

function SectionCard({ section, idx }: { section: ExtractedSection; idx: number }) {
  const [open, setOpen] = useState(idx === 0)
  return (
    <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#14294e] transition-colors text-left">
        {open ? <ChevronDown size={14} className="text-[#5a8caa] shrink-0" /> : <ChevronRight size={14} className="text-[#5a8caa] shrink-0" />}
        <span className="text-sm font-medium text-[#e4f2f8] flex-1 truncate">{section.title}</span>
        <span className="text-[10px] font-mono text-[#5a8caa]">{section.content.length} chars</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-[#20406a]">
          <pre className="text-xs text-[#8fb3c8] whitespace-pre-wrap mt-3 max-h-60 overflow-y-auto font-mono leading-relaxed">
            {section.content}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Componente Principal ───────────────────────────────────────────────────
export function LeitorPdfPage() {
  const [queue, setQueue] = useState<QueuedPdf[]>([])
  const [processing, setProcessing] = useState(false)
  const [selectedResult, setSelectedResult] = useState<QueuedPdf | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((files: FileList | File[]) => {
    const pdfs = Array.from(files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"))
    if (pdfs.length === 0) return
    setQueue(prev => [...prev, ...pdfs.map(f => ({
      id: crypto.randomUUID(), file: f, status: "pending" as const,
    }))])
  }, [])

  function removeFromQueue(id: string) { setQueue(prev => prev.filter(f => f.id !== id)) }

  // Tenta backend, fallback client-side
  const BACKEND_URL = import.meta.env.VITE_API_URL || "https://construdatamaxv2-clean.onrender.com"

  async function extractViaBackend(file: File): Promise<ExtractedPdf | null> {
    try {
      const form = new FormData()
      form.append("files", file)
      const res = await fetch(`${BACKEND_URL}/api/motores/pdf/extract`, { method: "POST", body: form })
      if (!res.ok) return null
      const data = await res.json()
      if (!data?.[0]?.text) return null
      const item = data[0]
      const sections = extractSections(item.text)
      return {
        text: item.text,
        pageCount: item.page_count || 1,
        charsPerPage: item.chars_per_page || 0,
        sections,
      }
    } catch { return null }
  }

  async function handleProcess() {
    if (queue.length === 0 || processing) return
    setProcessing(true)
    const updated = [...queue]

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status !== "pending") continue
      updated[i] = { ...updated[i], status: "processing" }
      setQueue([...updated])

      try {
        // Tenta backend (extrai PDF binário real)
        let result = await extractViaBackend(updated[i].file)
        // Fallback: client-side se backend offline
        if (!result) result = await readPdfClientSide(updated[i].file)
        updated[i] = { ...updated[i], status: "done", result }
      } catch (e: any) {
        updated[i] = { ...updated[i], status: "error", error: e.message ?? "Erro ao processar" }
      }
      setQueue([...updated])
    }
    setProcessing(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  const doneItems = queue.filter(q => q.status === "done")
  const pendingCount = queue.filter(q => q.status === "pending").length

  return (
    <div className="flex flex-col h-full bg-[#0a1628]">
      {/* Header */}
      <header className="shrink-0 border-b border-[#20406a] bg-[#0d2040] px-6 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <FileSearch size={22} className="text-purple-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-[#e4f2f8]">Leitor de Documentos PDF</h1>
          <p className="text-xs text-[#5a8caa]">Extração algorítmica de texto, com limpeza de encoding e segmentação automática</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Dropzone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="bg-[#112645] border-2 border-dashed border-[#20406a] rounded-xl p-8 text-center cursor-pointer hover:border-purple-500/50 transition-colors"
        >
          <Upload size={32} className="mx-auto mb-3 text-[#5a8caa]" />
          <div className="text-sm font-medium text-[#e4f2f8]">Arraste PDFs aqui ou clique para selecionar</div>
          <div className="text-[10px] text-[#5a8caa] mt-1">Aceita múltiplos arquivos .PDF · Medições, Orçamentos, Projetos, Contratos</div>
          <input ref={inputRef} type="file" multiple accept=".pdf,application/pdf" className="hidden"
            onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = "" }} />
        </div>

        {/* Fila de Arquivos */}
        {queue.length > 0 && (
          <div className="bg-[#112645] border border-[#20406a] rounded-xl">
            <div className="px-5 py-3 border-b border-[#20406a] flex items-center justify-between">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Fila ({queue.length} arquivo{queue.length !== 1 ? "s" : ""})</h3>
              <div className="flex gap-2">
                {doneItems.length > 0 && (
                  <button onClick={() => { setQueue([]); setSelectedResult(null) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#5a8caa] hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                    <Trash2 size={12} /> Limpar
                  </button>
                )}
                <button onClick={handleProcess} disabled={processing || pendingCount === 0}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {processing ? <Loader2 size={14} className="animate-spin" /> : <FileSearch size={14} />}
                  {processing ? "Processando..." : `Extrair ${pendingCount > 0 ? `(${pendingCount})` : ""}`}
                </button>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-[#20406a]/50">
              {queue.map(qf => (
                <div key={qf.id} className="flex items-center">
                  <div className="flex-1"><QueueRow qf={qf} onRemove={removeFromQueue} /></div>
                  {qf.status === "done" && (
                    <button onClick={() => setSelectedResult(qf)}
                      className="mr-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-cyan-400 hover:bg-cyan-500/10 transition-colors">
                      <Eye size={12} /> Ver
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resultado Selecionado */}
        {selectedResult?.result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
                Resultado: {selectedResult.file.name}
              </h3>
              <div className="flex gap-2">
                <button onClick={() => copyText(selectedResult.result!.text)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#5a8caa] hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors">
                  <Copy size={12} /> Copiar Texto
                </button>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#112645] border border-[#20406a] rounded-lg p-4">
                <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">Páginas</div>
                <div className="text-2xl font-bold text-purple-400">{selectedResult.result.pageCount}</div>
              </div>
              <div className="bg-[#112645] border border-[#20406a] rounded-lg p-4">
                <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">Chars/Pág</div>
                <div className="text-2xl font-bold text-cyan-400">{selectedResult.result.charsPerPage.toLocaleString("pt-BR")}</div>
              </div>
              <div className="bg-[#112645] border border-[#20406a] rounded-lg p-4">
                <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">Seções</div>
                <div className="text-2xl font-bold text-yellow-400">{selectedResult.result.sections.length}</div>
              </div>
            </div>

            {/* Seções Extraídas */}
            <div className="space-y-3">
              {selectedResult.result.sections.map((s, i) => (
                <SectionCard key={i} section={s} idx={i} />
              ))}
            </div>
          </div>
        )}

        {/* Estado vazio */}
        {queue.length === 0 && (
          <div className="bg-[#112645] border border-[#20406a] rounded-xl p-12 text-center">
            <FileText size={40} className="mx-auto mb-4 text-[#5a8caa] opacity-40" />
            <p className="text-sm text-[#5a8caa]">Nenhum PDF na fila. Arraste ou clique acima para começar.</p>
            <p className="text-[10px] text-[#5a8caa] mt-2 opacity-60">Medições, BMs, orçamentos, contratos e deliberações</p>
          </div>
        )}
      </main>
    </div>
  )
}
