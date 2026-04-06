/**
 * ComposicaoPanel — editable item table with SINAPI/SEINFRA search dialog.
 * Inline editing: click any editable cell to edit in-place.
 */
import { useState, useMemo } from 'react'
import { Plus, Trash2, Search, RefreshCw, Download, Printer, ChevronDown, ChevronUp, Check, X, Network } from 'lucide-react'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import { exportToCsv, exportToXlsx } from '../utils/exportEngine'
import type { OrcamentoItem, CostBaseSource } from '@/types'
// Import SINAPI/SEINFRA mock data
import { mockSinapi } from '@/data/mockSinapi'
import { NETWORK_TEMPLATES } from '@/data/mockNetworks'

const SOURCE_BADGE: Record<CostBaseSource, string> = {
  sinapi:  'bg-blue-900/50 text-blue-300',
  seinfra: 'bg-teal-900/50 text-teal-300',
  custom:  'bg-violet-900/50 text-violet-300',
  manual:  'bg-[#484848] text-[#a3a3a3]',
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

// Inline editable cell
function EditCell({ value, onSave, type = 'text' }: {
  value: string | number
  onSave: (v: string | number) => void
  type?: 'text' | 'number'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  function commit() {
    const v = type === 'number' ? parseFloat(draft) || 0 : draft
    onSave(v)
    setEditing(false)
  }

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(String(value)); setEditing(true) }}
        className="cursor-pointer hover:text-violet-400 transition-colors"
        title="Clique para editar"
      >
        {type === 'number' && typeof value === 'number' && value > 1000 ? fmtBRL(value) : value}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="w-full bg-[#484848] border border-violet-500 rounded px-2 py-0.5 text-xs text-[#f5f5f5] focus:outline-none"
      />
      <button onClick={commit} className="text-emerald-400 hover:text-emerald-300 p-0.5"><Check size={12} /></button>
      <button onClick={() => setEditing(false)} className="text-[#6b6b6b] hover:text-[#a3a3a3] p-0.5"><X size={12} /></button>
    </div>
  )
}

// SINAPI Search Dialog
function SinapiSearchDialog({ onAdd, onClose, costBase }: {
  onAdd: (item: Omit<OrcamentoItem, 'id' | 'totalCost'>) => void
  onClose: () => void
  costBase: CostBaseSource
}) {
  const { bdiGlobal } = useQuantitativosStore()
  const [query, setQuery] = useState('')
  const [qty, setQty] = useState(1)

  const filtered = useMemo(() => {
    if (!query.trim()) return mockSinapi.slice(0, 20)
    const q = query.toLowerCase()
    return mockSinapi.filter((e) => e.description.toLowerCase().includes(q) || e.code.includes(q)).slice(0, 30)
  }, [query])

  function handleAdd(entry: typeof mockSinapi[0]) {
    onAdd({
      code: entry.code,
      description: entry.description,
      unit: entry.unit,
      quantity: qty,
      unitCost: entry.unitCost,
      bdi: bdiGlobal,
      category: entry.category,
      source: costBase,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-[#525252] flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Buscar Item — SINAPI</h3>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#f5f5f5]"><X size={18} /></button>
        </div>
        <div className="px-5 py-3 border-b border-[#525252] flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por código ou descrição..."
              className="w-full bg-[#484848] border border-[#5e5e5e] rounded-lg pl-9 pr-4 py-2 text-sm text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[#a3a3a3] text-xs">Qtd:</label>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
              min={0.01}
              className="w-20 bg-[#484848] border border-[#5e5e5e] rounded px-2 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((entry) => (
            <div
              key={entry.code}
              onClick={() => handleAdd(entry)}
              className="px-5 py-3 border-b border-[#525252]/50 hover:bg-gray-750/40 cursor-pointer flex items-start justify-between gap-3 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[#f5f5f5] text-sm group-hover:text-violet-300 transition-colors">{entry.description}</p>
                <p className="text-[#6b6b6b] text-xs mt-0.5">{entry.code} · {entry.unit} · {entry.category}</p>
              </div>
              <span className="text-violet-400 text-sm font-medium whitespace-nowrap shrink-0">
                {fmtBRL(entry.unitCost)}/{entry.unit}
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-[#6b6b6b] py-10">Nenhum item encontrado.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Save Budget Dialog
function SaveDialog({ onSave, onClose }: { onSave: (name: string, desc?: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [err, setErr] = useState('')

  function submit() {
    if (!name.trim()) { setErr('Nome obrigatório'); return }
    onSave(name.trim(), desc.trim() || undefined)
    onClose()
  }

  const inputCls = 'w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-violet-500'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="text-white font-semibold text-sm">Salvar Orçamento</h3>
        <div>
          <label className="block text-[#a3a3a3] text-xs mb-1">Nome *</label>
          <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Rede Pluvial Trecho A" className={inputCls} />
        </div>
        <div>
          <label className="block text-[#a3a3a3] text-xs mb-1">Descrição (opcional)</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
        </div>
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-[#484848] text-[#f5f5f5] text-sm hover:bg-[#525252]">Cancelar</button>
          <button onClick={submit} className="px-4 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: '#8b5cf6' }}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

// ─── File parsers ────────────────────────────────────────────────────────────

type ParsedItem = Omit<OrcamentoItem, 'id' | 'totalCost'>

function parseTxt(text: string, bdi: number): ParsedItem[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'))
  if (lines.length < 2) return []
  const header = lines[0].toLowerCase()
  const sep = header.includes(';') ? ';' : ','
  const cols = header.split(sep).map((c) => c.trim().replace(/"/g, ''))

  const idx = (names: string[]) => names.reduce((found, n) => found >= 0 ? found : cols.indexOf(n), -1)
  const iCode  = idx(['codigo', 'code', 'cod'])
  const iDesc  = idx(['descricao', 'description', 'desc', 'item'])
  const iUnit  = idx(['unidade', 'unit', 'un'])
  const iQty   = idx(['quantidade', 'quantity', 'qtd', 'qty'])
  const iCost  = idx(['custo_unit', 'custo', 'unit_cost', 'unitcost', 'preco'])

  return lines.slice(1).flatMap((line) => {
    const parts = line.split(sep).map((p) => p.trim().replace(/"/g, ''))
    if (parts.length < 2) return []
    return [{
      code:        iCode >= 0  ? parts[iCode]  : `IMP-${Math.random().toString(36).slice(2, 6)}`,
      description: iDesc >= 0  ? parts[iDesc]  : parts[0] ?? 'Item importado',
      unit:        iUnit >= 0  ? parts[iUnit]  : 'un',
      quantity:    iQty  >= 0  ? parseFloat(parts[iQty])  || 0 : 1,
      unitCost:    iCost >= 0  ? parseFloat(parts[iCost]) || 0 : 0,
      bdi,
      category:    'services' as OrcamentoItem['category'],
      source:      'custom' as CostBaseSource,
    }]
  })
}

function parseDxf(text: string, bdi: number): ParsedItem[] {
  const items: ParsedItem[] = []
  const lines = text.split(/\r?\n/)
  let i = 0

  function nextVal(): string { return (lines[++i] ?? '').trim() }

  while (i < lines.length) {
    const code = lines[i]?.trim()
    if (code === '0') {
      const etype = nextVal()
      if (etype === 'LINE') {
        // Read X1 Y1 Z1 X2 Y2 Z2
        let x1 = 0, y1 = 0, z1 = 0, x2 = 0, y2 = 0, z2 = 0
        while (i < lines.length) {
          const c = lines[++i]?.trim()
          if (c === undefined) break
          const v = parseFloat(lines[i + 1]?.trim() ?? '0')
          if (c === '10') x1 = v
          else if (c === '20') y1 = v
          else if (c === '30') z1 = v
          else if (c === '11') x2 = v
          else if (c === '21') y2 = v
          else if (c === '31') z2 = v
          else if (c === '0') { i--; break }
          i++
        }
        const len = Math.sqrt((x2-x1)**2 + (y2-y1)**2 + (z2-z1)**2)
        if (len > 0) {
          items.push({
            code: `DXF-LINE-${items.length + 1}`,
            description: `Segmento LINEAR — DXF Import (${len.toFixed(1)} m)`,
            unit: 'm', quantity: Math.round(len * 100) / 100, unitCost: 0,
            bdi, category: 'services', source: 'custom',
          })
        }
      } else if (etype === 'LWPOLYLINE') {
        // Sum all vertex-to-vertex distances
        const verts: [number, number][] = []
        while (i < lines.length) {
          const c = lines[++i]?.trim()
          if (c === undefined) break
          const v = parseFloat(lines[i + 1]?.trim() ?? '0')
          if (c === '10') verts.push([v, 0])
          else if (c === '20' && verts.length > 0) verts[verts.length - 1][1] = v
          else if (c === '0') { i--; break }
          i++
        }
        let len = 0
        for (let j = 1; j < verts.length; j++) {
          len += Math.sqrt((verts[j][0]-verts[j-1][0])**2 + (verts[j][1]-verts[j-1][1])**2)
        }
        if (len > 0) {
          items.push({
            code: `DXF-PLY-${items.length + 1}`,
            description: `Polilinha — DXF Import (${len.toFixed(1)} m)`,
            unit: 'm', quantity: Math.round(len * 100) / 100, unitCost: 0,
            bdi, category: 'services', source: 'custom',
          })
        }
      }
    }
    i++
  }
  return items
}

function parseShp(buffer: ArrayBuffer, fileName: string, bdi: number): ParsedItem[] {
  // Read SHP header: bytes 32-35 = shape type (little-endian int32)
  const view = new DataView(buffer)
  if (buffer.byteLength < 100) return []
  const shapeType = view.getInt32(32, true)
  if (shapeType !== 3 && shapeType !== 5 && shapeType !== 13 && shapeType !== 15) {
    // Not polyline/polygon — return generic item
    return [{
      code: 'SHP-001',
      description: `Shapefile importado — ${fileName} (Tipo ${shapeType})`,
      unit: 'un', quantity: 1, unitCost: 0,
      bdi, category: 'services', source: 'custom',
    }]
  }
  // For polylines: estimate length from bounding box diagonal (bytes 36-68: Xmin Ymin Xmax Ymax)
  const xMin = view.getFloat64(36, true)
  const yMin = view.getFloat64(44, true)
  const xMax = view.getFloat64(52, true)
  const yMax = view.getFloat64(60, true)
  const diagLen = Math.sqrt((xMax - xMin) ** 2 + (yMax - yMin) ** 2)
  return [{
    code: 'SHP-001',
    description: `Rede importada SHP — ${fileName} (extensão estimada ${diagLen.toFixed(0)} m)`,
    unit: 'm', quantity: Math.round(diagLen), unitCost: 0,
    bdi, category: 'services', source: 'custom',
  }]
}

// ─── File upload tab ──────────────────────────────────────────────────────────

function FileUploadTab({ bdi, onImport, onClose }: {
  bdi: number
  onImport: (items: ParsedItem[]) => void
  onClose: () => void
}) {
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  async function handleFile(file: File) {
    setError('')
    setFileName(file.name)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

    if (ext === 'dwg') {
      setError('Formato DWG não suportado diretamente no browser. Converta para DXF via AutoCAD ou FreeCAD e reimporte.')
      setParsedItems([])
      return
    }

    try {
      if (ext === 'shp') {
        const buf = await file.arrayBuffer()
        setParsedItems(parseShp(buf, file.name, bdi))
      } else {
        const text = await file.text()
        if (ext === 'dxf') {
          setParsedItems(parseDxf(text, bdi))
        } else {
          // .txt or unknown — try CSV parser
          setParsedItems(parseTxt(text, bdi))
        }
      }
    } catch {
      setError('Erro ao processar o arquivo. Verifique o formato.')
      setParsedItems([])
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragging ? 'border-violet-500 bg-violet-900/20' : 'border-[#525252] hover:border-[#5e5e5e]'
        }`}
      >
        <p className="text-[#a3a3a3] text-sm mb-2">Arraste um arquivo aqui ou clique para selecionar</p>
        <p className="text-gray-600 text-xs mb-3">Formatos aceitos: .txt (CSV/TSV) · .dxf · .shp</p>
        <label className="inline-block cursor-pointer px-4 py-1.5 rounded-lg bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] text-sm transition-colors">
          Selecionar arquivo
          <input
            type="file"
            accept=".txt,.dxf,.shp,.dwg"
            className="hidden"
            onChange={onInputChange}
          />
        </label>
        {fileName && <p className="text-violet-400 text-xs mt-2">{fileName}</p>}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Format hints */}
      <div className="rounded-lg bg-[#3d3d3d]/60 border border-[#525252] px-4 py-3">
        <p className="text-xs text-[#a3a3a3] font-semibold mb-1.5">Formato esperado para .txt / .csv:</p>
        <pre className="text-[10px] text-[#6b6b6b] font-mono leading-relaxed">
{`CODIGO;DESCRICAO;UNIDADE;QTD;CUSTO_UNIT
74209/001;Escavacao manual;m3;15;48.50
72942/001;Tubo PVC DN150 PBA;m;100;32.00`}
        </pre>
      </div>

      {/* Preview */}
      {parsedItems.length > 0 && (
        <div>
          <p className="text-xs text-[#a3a3a3] font-semibold mb-2">{parsedItems.length} item(ns) extraído(s):</p>
          <div className="rounded-xl border border-[#525252] overflow-hidden max-h-52 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#3d3d3d] sticky top-0">
                <tr>
                  <th className="text-left text-[#6b6b6b] px-3 py-2">Descrição</th>
                  <th className="text-right text-[#6b6b6b] px-3 py-2">Qtd</th>
                  <th className="text-left text-[#6b6b6b] px-3 py-2">Un.</th>
                  <th className="text-right text-[#6b6b6b] px-3 py-2">C.Unit.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3d3d3d]">
                {parsedItems.map((item, i) => (
                  <tr key={i} className="bg-[#2c2c2c]">
                    <td className="px-3 py-1.5 text-[#f5f5f5] truncate max-w-[200px]">{item.description}</td>
                    <td className="px-3 py-1.5 text-right text-[#a3a3a3] font-mono">{item.quantity}</td>
                    <td className="px-3 py-1.5 text-[#6b6b6b]">{item.unit}</td>
                    <td className="px-3 py-1.5 text-right text-[#a3a3a3] font-mono">
                      {item.unitCost > 0 ? fmtBRL(item.unitCost) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex gap-2 mt-auto pt-2 border-t border-[#525252]">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-[#484848] text-[#f5f5f5] text-sm hover:bg-[#525252]">
          Cancelar
        </button>
        <button
          onClick={() => { onImport(parsedItems); onClose() }}
          disabled={parsedItems.length === 0}
          className="px-4 py-1.5 rounded-lg text-sm text-white disabled:opacity-40 transition-opacity ml-auto"
          style={{ backgroundColor: '#8b5cf6' }}
        >
          Adicionar ao Orçamento ({parsedItems.length})
        </button>
      </div>
    </div>
  )
}

// ─── Network Import Modal (tabbed) ────────────────────────────────────────────

function NetworkImportModal({ onClose, onImport, bdi }: {
  onClose: () => void
  onImport: (items: Omit<OrcamentoItem, 'id' | 'totalCost'>[]) => void
  bdi: number
}) {
  const [tab, setTab] = useState<'templates' | 'file'>('templates')
  const [selected, setSelected] = useState<string | null>(null)
  const [length, setLength] = useState(100)

  const template = NETWORK_TEMPLATES.find((t) => t.id === selected)

  function handleImport() {
    if (!template) return
    const scale = length / template.perMeters
    const items = template.items.map((tItem) => ({
      code:        tItem.code,
      description: tItem.description,
      unit:        tItem.unit,
      quantity:    Math.round(tItem.quantity * scale * 100) / 100,
      unitCost:    tItem.unitCost,
      bdi,
      category:    tItem.category,
      source:      tItem.source as CostBaseSource,
    }))
    onImport(items)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#525252] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network size={16} className="text-violet-400" />
            <h3 className="text-white font-semibold text-sm">Importar Rede</h3>
          </div>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#f5f5f5]"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#525252]">
          {(['templates', 'file'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === t
                  ? 'text-violet-400 border-violet-500'
                  : 'text-[#6b6b6b] border-transparent hover:text-[#f5f5f5]'
              }`}
            >
              {t === 'templates' ? 'Redes Prontas' : 'Importar Arquivo'}
            </button>
          ))}
        </div>

        {/* Templates tab */}
        {tab === 'templates' && (
          <>
            {/* Length input */}
            <div className="px-5 py-3 border-b border-[#525252] flex items-center gap-3">
              <label className="text-[#a3a3a3] text-xs whitespace-nowrap">Comprimento da rede (m):</label>
              <input
                type="number"
                value={length}
                min={10}
                step={10}
                onChange={(e) => setLength(parseFloat(e.target.value) || 100)}
                className="w-28 bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-violet-500"
              />
              <span className="text-[#6b6b6b] text-xs">
                Quantitativos escalados proporcionalmente.
              </span>
            </div>

            {/* Template list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {NETWORK_TEMPLATES.map((tmpl) => {
                const scale = length / tmpl.perMeters
                const total = tmpl.items.reduce((s, i) => s + i.quantity * scale * i.unitCost * (1 + bdi / 100), 0)
                const isSelected = selected === tmpl.id
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setSelected(isSelected ? null : tmpl.id)}
                    className={`rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-violet-500 bg-violet-900/20'
                        : 'border-[#525252] bg-gray-750/30 hover:border-[#5e5e5e]'
                    }`}
                  >
                    <div className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl leading-none">{tmpl.icon}</span>
                        <div>
                          <p className="text-[#f5f5f5] text-sm font-medium">{tmpl.name}</p>
                          <p className="text-[#6b6b6b] text-xs mt-0.5">{tmpl.description}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-violet-400 text-sm font-semibold">{fmtBRL(total)}</p>
                        <p className="text-[#6b6b6b] text-xs">{tmpl.items.length} itens · c/ BDI {bdi}%</p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="border-t border-[#525252]/60 px-4 pb-3">
                        <table className="w-full text-xs mt-2">
                          <thead>
                            <tr className="text-[#6b6b6b]">
                              <th className="text-left py-1 font-medium">Descrição</th>
                              <th className="text-right py-1 font-medium">Qtd</th>
                              <th className="text-left py-1 pl-2 font-medium">Un.</th>
                              <th className="text-right py-1 font-medium">C.Unit.</th>
                              <th className="text-right py-1 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tmpl.items.map((it, idx) => {
                              const scaledQty = Math.round(it.quantity * scale * 100) / 100
                              return (
                                <tr key={idx} className="border-t border-[#525252]/30 text-[#f5f5f5]">
                                  <td className="py-1 pr-2">{it.description}</td>
                                  <td className="py-1 text-right text-[#a3a3a3]">{scaledQty}</td>
                                  <td className="py-1 pl-2 text-[#6b6b6b]">{it.unit}</td>
                                  <td className="py-1 text-right text-[#a3a3a3]">{fmtBRL(it.unitCost)}</td>
                                  <td className="py-1 text-right text-violet-300">{fmtBRL(scaledQty * it.unitCost)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#525252] flex items-center justify-between">
              <p className="text-[#6b6b6b] text-xs">
                {selected ? `"${template?.name}" selecionada · ${length}m` : 'Selecione um template acima'}
              </p>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-[#484848] text-[#f5f5f5] text-sm hover:bg-[#525252]">
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={!selected}
                  className="px-4 py-1.5 rounded-lg text-sm text-white disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: '#8b5cf6' }}
                >
                  Adicionar ao Orçamento
                </button>
              </div>
            </div>
          </>
        )}

        {/* File upload tab */}
        {tab === 'file' && (
          <FileUploadTab bdi={bdi} onImport={onImport} onClose={onClose} />
        )}
      </div>
    </div>
  )
}

export function ComposicaoPanel() {
  const {
    currentItems, bdiGlobal, costBase,
    addItem, addItems, updateItem, removeItem, resetItems,
    importFromPreConstrucao, importFromSuprimentos,
    saveBudget,
  } = useQuantitativosStore()

  const [showSearch, setShowSearch] = useState(false)
  const [showNetworkImport, setShowNetworkImport] = useState(false)
  const [showSave, setShowSave] = useState(false)
  const [importing, setImporting] = useState<'pre' | 'sup' | null>(null)
  const [sortCol, setSortCol] = useState<'code' | 'description' | 'totalCost' | 'category' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const total = currentItems.reduce((s, i) => s + i.totalCost, 0)

  function handleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    if (!sortCol) return currentItems
    return [...currentItems].sort((a, b) => {
      const av = a[sortCol as keyof OrcamentoItem] ?? ''
      const bv = b[sortCol as keyof OrcamentoItem] ?? ''
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [currentItems, sortCol, sortDir])

  async function handleImportPre() {
    setImporting('pre')
    await importFromPreConstrucao()
    setImporting(null)
  }

  async function handleImportSup() {
    setImporting('sup')
    await importFromSuprimentos()
    setImporting(null)
  }

  function handleReset() {
    if (!confirm('Reiniciar a composição? Todos os itens serão removidos.')) return
    resetItems()
  }

  function SortIcon({ col }: { col: typeof sortCol }) {
    if (sortCol !== col) return null
    return sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-0.5" /> : <ChevronDown size={12} className="inline ml-0.5" />
  }

  const thCls = 'text-[#6b6b6b] text-xs font-medium py-2.5 px-3 text-left cursor-pointer hover:text-[#f5f5f5] whitespace-nowrap select-none'

  return (
    <div className="p-6 space-y-4">
      {/* Print header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold text-black">Quantitativos e Orçamento</h1>
        <p className="text-sm text-gray-600">Gerado em: {new Date().toLocaleString('pt-BR')} · Base: {costBase.toUpperCase()} · BDI Global: {bdiGlobal}%</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap print:hidden">
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-white transition-colors"
          style={{ backgroundColor: '#8b5cf6' }}
        >
          <Plus size={14} /> Adicionar Item
        </button>
        <button
          onClick={() => setShowNetworkImport(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-teal-900/50 hover:bg-teal-800/60 text-teal-300 border border-teal-800/50 transition-colors"
        >
          <Network size={14} /> Importar Rede
        </button>
        <button
          onClick={handleImportPre}
          disabled={importing === 'pre'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] transition-colors disabled:opacity-50"
        >
          {importing === 'pre' ? 'Importando...' : '↓ Importar da Pré-Construção'}
        </button>
        <button
          onClick={handleImportSup}
          disabled={importing === 'sup'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] transition-colors disabled:opacity-50"
        >
          {importing === 'sup' ? 'Importando...' : '↓ Importar do Suprimentos'}
        </button>
        <button
          onClick={() => setShowSave(true)}
          disabled={currentItems.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] transition-colors disabled:opacity-50"
        >
          Salvar Orçamento
        </button>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => exportToCsv(currentItems)} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] transition-colors">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => exportToXlsx(currentItems, bdiGlobal)} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] transition-colors">
            <Download size={13} /> Excel
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] transition-colors">
            <Printer size={13} /> PDF
          </button>
          <button onClick={handleReset} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs bg-[#484848] hover:bg-red-900/40 text-[#a3a3a3] hover:text-red-300 transition-colors">
            <RefreshCw size={13} /> Reiniciar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#525252] flex items-center justify-between">
          <p className="text-[#a3a3a3] text-xs">
            {currentItems.length} item{currentItems.length !== 1 ? 's' : ''} · BDI Global: {bdiGlobal}%
          </p>
          <p className="text-violet-400 text-sm font-semibold">Total: {fmtBRL(total)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[#525252]">
              <tr>
                <th className={thCls} onClick={() => handleSort('code')}>Código<SortIcon col="code" /></th>
                <th className={thCls} onClick={() => handleSort('description')}>Descrição<SortIcon col="description" /></th>
                <th className="text-[#6b6b6b] text-xs font-medium py-2.5 px-3 text-left">Un.</th>
                <th className="text-[#6b6b6b] text-xs font-medium py-2.5 px-3 text-right">Quantidade</th>
                <th className="text-[#6b6b6b] text-xs font-medium py-2.5 px-3 text-right">C.Unit. (R$)</th>
                <th className="text-[#6b6b6b] text-xs font-medium py-2.5 px-3 text-right">BDI %</th>
                <th className={`${thCls} text-right`} onClick={() => handleSort('totalCost')}>Total c/ BDI<SortIcon col="totalCost" /></th>
                <th className={thCls} onClick={() => handleSort('category')}>Categoria<SortIcon col="category" /></th>
                <th className="text-[#6b6b6b] text-xs font-medium py-2.5 px-3 text-center">Fonte</th>
                <th className="py-2.5 px-3 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-[#6b6b6b] py-14">
                    Nenhum item. Clique em "+ Adicionar Item" ou importe de outro módulo.
                  </td>
                </tr>
              )}
              {sorted.map((item) => (
                <tr key={item.id} className="border-b border-[#525252]/50 hover:bg-gray-750/20">
                  <td className="px-3 py-2.5 text-[#a3a3a3] font-mono text-xs">
                    <EditCell value={item.code} onSave={(v) => updateItem(item.id, { code: String(v) })} />
                  </td>
                  <td className="px-3 py-2.5 text-[#f5f5f5] max-w-xs">
                    <EditCell value={item.description} onSave={(v) => updateItem(item.id, { description: String(v) })} />
                  </td>
                  <td className="px-3 py-2.5 text-[#a3a3a3]">
                    <EditCell value={item.unit} onSave={(v) => updateItem(item.id, { unit: String(v) })} />
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#f5f5f5]">
                    <EditCell value={item.quantity} onSave={(v) => updateItem(item.id, { quantity: Number(v) })} type="number" />
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#f5f5f5]">
                    <EditCell value={item.unitCost} onSave={(v) => updateItem(item.id, { unitCost: Number(v) })} type="number" />
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#a3a3a3]">
                    <EditCell value={item.bdi} onSave={(v) => updateItem(item.id, { bdi: Number(v) })} type="number" />
                  </td>
                  <td className="px-3 py-2.5 text-right text-violet-300 font-medium">{fmtBRL(item.totalCost)}</td>
                  <td className="px-3 py-2.5 text-[#a3a3a3]">
                    <EditCell value={item.category} onSave={(v) => updateItem(item.id, { category: String(v) })} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_BADGE[item.source]}`}>
                      {item.source.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 print:hidden">
                    <button onClick={() => removeItem(item.id)} className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {currentItems.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#5e5e5e]">
                  <td colSpan={6} className="px-3 py-3 text-[#f5f5f5] font-semibold text-sm">TOTAL GERAL</td>
                  <td className="px-3 py-3 text-right text-violet-400 font-bold text-sm">{fmtBRL(total)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Print footer */}
      <div className="hidden print:block mt-8 border-t border-gray-300 pt-3 text-xs text-[#6b6b6b] flex justify-between">
        <span>Atlântico — Quantitativos e Orçamento</span>
        <span>Gerado em: {new Date().toLocaleString('pt-BR')}</span>
      </div>

      {showSearch && (
        <SinapiSearchDialog onAdd={addItem} onClose={() => setShowSearch(false)} costBase={costBase} />
      )}
      {showNetworkImport && (
        <NetworkImportModal onClose={() => setShowNetworkImport(false)} onImport={addItems} bdi={bdiGlobal} />
      )}
      {showSave && (
        <SaveDialog onSave={saveBudget} onClose={() => setShowSave(false)} />
      )}
    </div>
  )
}
