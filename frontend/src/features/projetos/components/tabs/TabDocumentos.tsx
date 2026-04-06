import { useRef, useState } from 'react'
import { UploadCloud, FileText, FileImage, File, Trash2, Download, AlertTriangle, Eye, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjetosStore } from '@/store/projetosStore'
import type { Project, DocumentCategory, ProjectDocument } from '@/types'

const MAX_FILE_SIZE = 10 * 1024 * 1024  // 10 MB

const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  contract:      'Contrato',
  drawing:       'Planta',
  specification: 'Especificação',
  report:        'Relatório',
  other:         'Outro',
}

const CATEGORY_COLOR: Record<DocumentCategory, string> = {
  contract:      'text-[#f97316] bg-[#f97316]/10',
  drawing:       'text-[#3b82f6] bg-[#3b82f6]/10',
  specification: 'text-[#a855f7] bg-[#a855f7]/10',
  report:        'text-[#22c55e] bg-[#22c55e]/10',
  other:         'text-[#6b6b6b] bg-[#6b6b6b]/10',
}

const FILTER_OPTIONS: Array<{ label: string; value: DocumentCategory | 'all' }> = [
  { label: 'Todos',         value: 'all' },
  { label: 'Contratos',     value: 'contract' },
  { label: 'Plantas',       value: 'drawing' },
  { label: 'Especificações',value: 'specification' },
  { label: 'Relatórios',    value: 'report' },
  { label: 'Outros',        value: 'other' },
]

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function detectCategory(name: string): DocumentCategory {
  const lower = name.toLowerCase()
  if (lower.includes('contrato') || lower.includes('contract')) return 'contract'
  if (lower.includes('planta') || lower.includes('plant') || lower.includes('draw')) return 'drawing'
  if (lower.includes('spec') || lower.includes('especif')) return 'specification'
  if (lower.includes('relat') || lower.includes('report')) return 'report'
  return 'other'
}

function FileIcon({ mimeType, size }: { mimeType: string; size: number }) {
  if (mimeType.startsWith('image/')) return <FileImage size={size} />
  if (mimeType === 'application/pdf' || mimeType.includes('document')) return <FileText size={size} />
  return <File size={size} />
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return iso }
}

export function TabDocumentos({ project }: { project: Project }) {
  const addDocument    = useProjetosStore((s) => s.addDocument)
  const deleteDocument = useProjetosStore((s) => s.deleteDocument)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState<DocumentCategory | 'all'>('all')
  const [sizeError, setSizeError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null)

  function processFiles(files: FileList | null) {
    if (!files) return
    setSizeError(null)
    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        setSizeError(`"${file.name}" excede 10 MB e não foi adicionado.`)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const doc: ProjectDocument = {
          id:          `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name:        file.name,
          mimeType:    file.type || 'application/octet-stream',
          sizeBytes:   file.size,
          base64:      reader.result as string,
          uploadedAt:  new Date().toISOString(),
          uploadedBy:  'Usuário',
          category:    detectCategory(file.name),
        }
        addDocument(project.id, doc)
      }
      reader.readAsDataURL(file)
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    processFiles(e.dataTransfer.files)
  }

  function handleDelete(docId: string) {
    if (confirmDeleteId !== docId) { setConfirmDeleteId(docId); return }
    deleteDocument(project.id, docId)
    setConfirmDeleteId(null)
  }

  const filtered = filter === 'all'
    ? project.documents
    : project.documents.filter((d) => d.category === filter)

  return (
    <div className="flex flex-col gap-4 p-5 overflow-y-auto h-full">
      {/* Upload zone */}
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors',
          isDragging
            ? 'border-[#f97316] bg-[#f97316]/5'
            : 'border-[#525252] hover:border-[#1f3c5e] bg-[#333333]'
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <UploadCloud size={28} className={isDragging ? 'text-[#f97316]' : 'text-[#3f3f3f]'} />
        <div className="text-center">
          <p className="text-sm text-[#a3a3a3]">Arraste arquivos ou <span className="text-[#f97316]">clique para selecionar</span></p>
          <p className="text-[10px] text-[#3f3f3f] mt-0.5">Máximo 10 MB por arquivo</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => processFiles(e.target.files)}
        />
      </div>

      {sizeError && (
        <div className="flex items-center gap-2 text-xs text-[#ef4444] bg-[#ef4444]/10 rounded-lg px-3 py-2">
          <AlertTriangle size={13} />
          {sizeError}
        </div>
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              'text-[10px] px-2.5 py-1 rounded-full font-semibold transition-colors border',
              filter === opt.value
                ? 'bg-[#f97316]/15 text-[#f97316] border-[#f97316]/30'
                : 'text-[#6b6b6b] border-[#525252] hover:border-[#1f3c5e] hover:text-[#a3a3a3]'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Document list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <File size={28} className="text-[#3f3f3f]" />
          <p className="text-xs text-[#3f3f3f]">Nenhum documento encontrado</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-[#525252] bg-[#3d3d3d] px-4 py-3 hover:bg-[#484848] transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-[#484848] flex items-center justify-center text-[#6b6b6b] shrink-0">
                <FileIcon mimeType={doc.mimeType} size={16} />
              </div>

              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="text-sm text-[#f5f5f5] font-medium truncate">{doc.name}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase', CATEGORY_COLOR[doc.category])}>
                    {CATEGORY_LABEL[doc.category]}
                  </span>
                  <span className="text-[10px] text-[#6b6b6b]">{formatSize(doc.sizeBytes)}</span>
                  <span className="text-[10px] text-[#6b6b6b]">{doc.uploadedBy}</span>
                  <span className="text-[10px] text-[#3f3f3f]">{formatDate(doc.uploadedAt)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {doc.base64 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewDoc(doc) }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
                      title="Visualizar"
                    >
                      <Eye size={13} />
                    </button>
                    <a
                      href={doc.base64}
                      download={doc.name}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download size={13} />
                    </a>
                  </>
                )}

                {confirmDeleteId === doc.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444] font-semibold hover:bg-[#ef4444]/30"
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-[#484848] text-[#a3a3a3]"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-[1001] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)' }}
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl border border-[#525252] bg-[#333333] flex flex-col shadow-2xl overflow-hidden"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#525252] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon mimeType={previewDoc.mimeType} size={14} />
                <span className="text-sm text-[#f5f5f5] font-medium truncate">{previewDoc.name}</span>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#484848] transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {previewDoc.mimeType.startsWith('image/') ? (
                <img
                  src={previewDoc.base64}
                  alt={previewDoc.name}
                  className="max-w-full max-h-[70vh] mx-auto rounded-lg object-contain"
                />
              ) : previewDoc.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewDoc.base64}
                  title={previewDoc.name}
                  width="100%"
                  height="600px"
                  className="rounded-lg border border-[#525252]"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <File size={36} className="text-[#3f3f3f]" />
                  <p className="text-sm text-[#6b6b6b]">Preview não disponível — faça o download</p>
                  <a
                    href={previewDoc.base64}
                    download={previewDoc.name}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#f97316]/15 border border-[#f97316]/30 text-[#f97316] hover:bg-[#f97316]/25 transition-colors"
                  >
                    <Download size={12} />
                    Download
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
