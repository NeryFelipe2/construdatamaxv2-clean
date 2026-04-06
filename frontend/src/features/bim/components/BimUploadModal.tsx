import { useRef, useState, type DragEvent } from 'react'
import { X, Upload, FileCheck, FileText, Layers } from 'lucide-react'
import { useBimStore } from '@/store/bimStore'
import { cn } from '@/lib/utils'

type ModalTab = 'dxf' | 'shapefile' | 'levantamento'

interface PickedFiles {
  shp: File | null
  dbf: File | null
  shx: File | null
}

export function BimUploadModal({ onClose }: { onClose: () => void }) {
  const loadShapefile  = useBimStore((s) => s.loadShapefile)
  const loadSurveyFile = useBimStore((s) => s.loadSurveyFile)
  const loadDxfFile    = useBimStore((s) => s.loadDxfFile)
  const isLoading      = useBimStore((s) => s.isLoading)
  const loadError      = useBimStore((s) => s.loadError)

  const [tab, setTab]         = useState<ModalTab>('dxf')
  const [files, setFiles]     = useState<PickedFiles>({ shp: null, dbf: null, shx: null })
  const [dragging, setDragging] = useState(false)
  const [dxfFile, setDxfFile]   = useState<File | null>(null)
  const [dxfDragging, setDxfDragging] = useState(false)
  const [dxfWrongFormat, setDxfWrongFormat] = useState(false)
  const [surveyFile, setSurveyFile] = useState<File | null>(null)
  const [surveyPreview, setSurveyPreview] = useState<string[]>([])

  const shpInputRef    = useRef<HTMLInputElement>(null)
  const surveyInputRef = useRef<HTMLInputElement>(null)
  const dxfInputRef    = useRef<HTMLInputElement>(null)

  // ── DXF helpers ────────────────────────────────────────────────────────────
  async function handleLoadDxf() {
    if (!dxfFile) return
    const buf = await dxfFile.arrayBuffer()
    loadDxfFile(buf, dxfFile.name)
    onClose()
  }

  // ── Shapefile helpers ─────────────────────────────────────────────────────
  function assignShpFiles(fileList: FileList | File[]) {
    const arr = Array.from(fileList)
    const next: PickedFiles = { ...files }
    arr.forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase()
      if (ext === 'shp') next.shp = f
      else if (ext === 'dbf') next.dbf = f
      else if (ext === 'shx') next.shx = f
    })
    setFiles(next)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setDragging(false); assignShpFiles(e.dataTransfer.files)
  }

  async function handleLoadShapefile() {
    if (!files.shp || !files.dbf) return
    const [shpBuf, dbfBuf] = await Promise.all([files.shp.arrayBuffer(), files.dbf.arrayBuffer()])
    await loadShapefile(shpBuf, dbfBuf)
    if (!loadError) onClose()
  }

  // ── Survey file helpers ───────────────────────────────────────────────────
  function onSurveyPick(f: File) {
    setSurveyFile(f)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string ?? ''
      const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5)
      setSurveyPreview(lines)
    }
    reader.readAsText(f, 'utf-8')
  }

  function handleLoadSurvey() {
    if (!surveyFile) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string ?? ''
      loadSurveyFile(text, surveyFile.name)
      onClose()
    }
    reader.readAsText(surveyFile, 'utf-8')
  }

  const TABS: { key: ModalTab; label: string; icon: React.ReactNode }[] = [
    { key: 'dxf',         label: 'DXF / CAD',          icon: <Layers size={12} /> },
    { key: 'shapefile',   label: 'Shapefile (.shp)',    icon: <Upload size={12} /> },
    { key: 'levantamento', label: 'Levantamento (.txt)', icon: <FileText size={12} /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-lg p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-gray-100 font-semibold text-sm">Importar Dados BIM / Espaciais</h2>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-[#3d3d3d] rounded-lg p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 flex-1 justify-center px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                tab === t.key ? 'bg-indigo-600 text-white' : 'text-[#a3a3a3] hover:text-[#f5f5f5]',
              )}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── DXF tab ── */}
        {tab === 'dxf' && (
          <>
            <div className="bg-[#3d3d3d]/50 border border-[#525252] rounded-lg p-3 mb-3 space-y-1.5">
              <p className="text-[#f5f5f5] text-xs font-semibold">Como exportar do AutoCAD:</p>
              <p className="text-[#a3a3a3] text-[11px]">
                No AutoCAD: <span className="font-mono text-[#f5f5f5]">Arquivo → Salvar Como → AutoCAD DXF (*.dxf)</span>
              </p>
              <p className="text-[#6b6b6b] text-[10px]">Suporte: DXF R12 a 2024 · LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, SPLINE, 3DFACE</p>
              <p className="text-[#6b6b6b] text-[10px]">Layers são mapeados automaticamente → tubo, laje, pilar, parede, viga</p>
              <p className="text-[10px] text-amber-400">⚠ Arquivos .DWG (binário proprietário) não são suportados — exporte como .DXF</p>
            </div>
            {dxfWrongFormat && (
              <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-2.5 mb-3">
                <p className="text-amber-300 text-xs font-semibold">Formato não suportado</p>
                <p className="text-amber-400 text-[11px] mt-0.5">
                  Arquivos .DWG não podem ser lidos diretamente. No AutoCAD, use <span className="font-mono">Arquivo → Salvar Como → DXF</span> e envie o arquivo .dxf gerado.
                </p>
              </div>
            )}

            <div
              onDragOver={(e) => { e.preventDefault(); setDxfDragging(true) }}
              onDragLeave={() => setDxfDragging(false)}
              onDrop={(e) => {
                e.preventDefault(); setDxfDragging(false)
                const f = e.dataTransfer.files[0]
                if (!f) return
                const ext = f.name.split('.').pop()?.toLowerCase()
                if (ext === 'dxf') { setDxfFile(f); setDxfWrongFormat(false) }
                else { setDxfWrongFormat(true) }
              }}
              onClick={() => dxfInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                dxfDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#525252] hover:border-gray-500',
              )}
            >
              <Layers size={28} className="mx-auto text-[#6b6b6b] mb-2" />
              {dxfFile ? (
                <>
                  <p className="text-green-400 text-sm font-medium">{dxfFile.name}</p>
                  <p className="text-gray-600 text-xs mt-0.5">{(dxfFile.size / 1024).toFixed(0)} KB</p>
                </>
              ) : (
                <>
                  <p className="text-[#f5f5f5] text-sm font-medium">Arraste o arquivo .DXF aqui</p>
                  <p className="text-gray-600 text-xs mt-1">ou clique para selecionar</p>
                </>
              )}
              <input
                ref={dxfInputRef}
                type="file"
                accept=".dxf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setDxfFile(f); setDxfWrongFormat(false) } }}
              />
            </div>

            {loadError && (
              <p className="mt-2 text-red-400 text-xs bg-red-900/20 border border-red-800 rounded p-2">{loadError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-[#a3a3a3] hover:text-[#f5f5f5] text-sm">Cancelar</button>
              <button
                onClick={handleLoadDxf}
                disabled={!dxfFile || isLoading}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-40"
              >
                {isLoading ? 'Processando…' : 'Importar DXF'}
              </button>
            </div>
          </>
        )}

        {/* ── Shapefile tab ── */}
        {tab === 'shapefile' && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => shpInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                dragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#525252] hover:border-gray-500',
              )}
            >
              <Upload size={28} className="mx-auto text-[#6b6b6b] mb-2" />
              <p className="text-[#f5f5f5] text-sm font-medium">Arraste os arquivos aqui</p>
              <p className="text-gray-600 text-xs mt-1">.shp + .dbf (obrigatórios) + .shx (opcional)</p>
              <input
                ref={shpInputRef}
                type="file"
                accept=".shp,.dbf,.shx"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && assignShpFiles(e.target.files)}
              />
            </div>
            <div className="mt-3 space-y-1.5">
              {(['shp', 'dbf', 'shx'] as const).map((ext) => (
                <div key={ext} className="flex items-center gap-2 text-xs">
                  <FileCheck size={13} className={files[ext] ? 'text-green-400' : 'text-gray-700'} />
                  <span className={files[ext] ? 'text-[#f5f5f5]' : 'text-gray-600'}>
                    .{ext.toUpperCase()} — {files[ext] ? files[ext]!.name : 'não selecionado'}
                    {ext === 'shx' && ' (opcional)'}
                  </span>
                </div>
              ))}
            </div>
            {loadError && (
              <p className="mt-2 text-red-400 text-xs bg-red-900/20 border border-red-800 rounded p-2">{loadError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-[#a3a3a3] hover:text-[#f5f5f5] text-sm">Cancelar</button>
              <button
                onClick={handleLoadShapefile}
                disabled={!files.shp || !files.dbf || isLoading}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-40"
              >
                {isLoading ? 'Carregando…' : 'Carregar Rede'}
              </button>
            </div>
          </>
        )}

        {/* ── Levantamento tab ── */}
        {tab === 'levantamento' && (
          <>
            <div className="bg-[#3d3d3d]/50 border border-[#525252] rounded-lg p-3 mb-3">
              <p className="text-[#a3a3a3] text-xs font-semibold mb-1">Formato esperado (CSV/TXT):</p>
              <p className="text-[#6b6b6b] text-[11px] font-mono">número, nome, northing, easting, profundidade</p>
              <p className="text-gray-600 text-[10px] mt-1 font-mono">ex: 40, beco 1D, 7352789.362, 359284.909, 1.65</p>
            </div>

            <button
              onClick={() => surveyInputRef.current?.click()}
              className="flex items-center gap-2 w-full justify-center px-3 py-3 border-2 border-dashed border-[#525252] hover:border-indigo-500 rounded-lg text-[#a3a3a3] hover:text-indigo-300 text-sm transition-colors"
            >
              <FileText size={16} />
              {surveyFile ? surveyFile.name : 'Selecionar arquivo .txt / .csv'}
            </button>
            <input
              ref={surveyInputRef}
              type="file"
              accept=".txt,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onSurveyPick(e.target.files[0])}
            />

            {surveyPreview.length > 0 && (
              <div className="mt-3 bg-[#3d3d3d] rounded-lg p-2">
                <p className="text-[#6b6b6b] text-[10px] font-semibold uppercase tracking-wider mb-1">Prévia (5 primeiras linhas)</p>
                <div className="space-y-0.5">
                  {surveyPreview.map((line, i) => (
                    <p key={i} className="text-[#a3a3a3] text-[11px] font-mono truncate">{line}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-[#a3a3a3] hover:text-[#f5f5f5] text-sm">Cancelar</button>
              <button
                onClick={handleLoadSurvey}
                disabled={!surveyFile}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-40"
              >
                Importar Levantamento
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
