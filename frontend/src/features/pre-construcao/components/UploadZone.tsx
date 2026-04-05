import { useRef, useState } from 'react'
import { UploadCloud, FileText, Box, Table2, X, Loader2, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { usePreConstrucaoStore } from '@/store/preConstrucaoStore'
import { useAppModeStore } from '@/store/appModeStore'
import type { UploadedFile } from '@/store/preConstrucaoStore'
import { extractFromPdf, mockBimExtraction } from '../hooks/usePdfExtraction'
import { detectClauses } from '../hooks/useClauseDetection'

const ACCEPTED_EXTS = ['.pdf', '.ifc', '.rvt', '.dwg', '.xlsx', '.docx']
const ACCEPT_ATTR   = ACCEPTED_EXTS.join(',')
const MAX_FILES     = 10

function getExt(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

function FileIcon({ ext }: { ext: string }) {
  if (ext === 'pdf') {
    return <FileText size={16} style={{ color: '#ef4444' }} />
  }
  if (['ifc', 'rvt', 'dwg'].includes(ext)) {
    return <Box size={16} style={{ color: '#3b82f6' }} />
  }
  if (ext === 'xlsx') {
    return <Table2 size={16} style={{ color: '#22c55e' }} />
  }
  return <FileText size={16} style={{ color: '#a3a3a3' }} />
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)
  const loadDemoData = usePreConstrucaoStore((s) => s.loadDemoData)

  const { uploadedFiles, addFiles, removeFile, setTakeoffItems, setClauses, setStep } =
    usePreConstrucaoStore(useShallow((s) => ({
      uploadedFiles:   s.uploadedFiles,
      addFiles:        s.addFiles,
      removeFile:      s.removeFile,
      setTakeoffItems: s.setTakeoffItems,
      setClauses:      s.setClauses,
      setStep:         s.setStep,
    })))

  function processFileList(fileList: FileList | null) {
    if (!fileList) return
    const existing = uploadedFiles.length
    const toAdd: UploadedFile[] = []
    for (let i = 0; i < fileList.length && existing + toAdd.length < MAX_FILES; i++) {
      const file = fileList[i]
      const ext = getExt(file.name)
      if (!ACCEPTED_EXTS.includes(`.${ext}`)) continue
      toAdd.push({
        name:    file.name,
        size:    file.size,
        type:    file.type,
        ext,
        fileRef: file,
      })
    }
    if (toAdd.length > 0) addFiles(toAdd)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    processFileList(e.dataTransfer.files)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    processFileList(e.target.files)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function initAnalysis() {
    if (uploadedFiles.length === 0) return
    setIsLoading(true)
    setStep('extraction')

    try {
      const allItems: ReturnType<typeof mockBimExtraction> = []
      let fullText = ''

      for (const uf of uploadedFiles) {
        if (uf.ext === 'pdf') {
          const result = await extractFromPdf(uf.fileRef)
          allItems.push(...result.items)
          fullText += '\n' + result.text
        } else {
          const items = mockBimExtraction(uf.name)
          allItems.push(...items)
        }
      }

      setTakeoffItems(allItems)
      const clauses = detectClauses(fullText)
      setClauses(clauses)
    } catch (err) {
      console.error('Extraction error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto w-full">
      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors',
          isDragging
            ? 'border-[#f97316] bg-[#f97316]/5'
            : 'border-[#1f3c5e] bg-[#3d3d3d] hover:border-[#555]',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud
          size={40}
          className={cn(isDragging ? 'text-[#f97316]' : 'text-[#6b6b6b]')}
        />
        <p className="text-[#f5f5f5] text-sm font-medium">
          Arraste arquivos aqui ou clique para selecionar
        </p>
        <p className="text-[#6b6b6b] text-xs">
          Aceito: PDF, IFC, RVT, DWG, XLSX, DOCX — máx. {MAX_FILES} arquivos
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {/* File list */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[#6b6b6b] text-xs font-medium uppercase tracking-wide">
            Arquivos selecionados ({uploadedFiles.length})
          </p>
          {uploadedFiles.map((uf) => (
            <div
              key={uf.name}
              className="flex items-center gap-3 bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2"
            >
              <FileIcon ext={uf.ext} />
              <span className="flex-1 text-[#f5f5f5] text-sm truncate">{uf.name}</span>
              <span className="text-[#6b6b6b] text-xs shrink-0">{formatSize(uf.size)}</span>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(uf.name) }}
                className="text-[#6b6b6b] hover:text-[#ef4444] transition-colors"
                aria-label="Remover arquivo"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Demo shortcut — only shown when demo mode is ON and no files uploaded yet */}
      {isDemoMode && uploadedFiles.length === 0 && (
        <button
          onClick={() => loadDemoData()}
          className="w-full py-2.5 rounded-lg text-sm font-semibold border-2 border-dashed border-[#f97316]/50 text-[#f97316] hover:bg-[#f97316]/5 transition-colors flex items-center justify-center gap-2"
        >
          <FlaskConical size={15} />
          Carregar Dados de Demonstração
        </button>
      )}

      {/* Action button */}
      <button
        onClick={initAnalysis}
        disabled={uploadedFiles.length === 0 || isLoading}
        className={cn(
          'w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors',
          uploadedFiles.length > 0 && !isLoading
            ? 'bg-[#f97316] hover:bg-[#ea6c0a] text-white'
            : 'bg-[#525252] text-[#6b6b6b] cursor-not-allowed',
        )}
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Analisando arquivos...
          </>
        ) : (
          'Iniciar Análise'
        )}
      </button>
    </div>
  )
}
