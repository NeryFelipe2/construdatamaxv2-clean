/**
 * NotesPanel — Service notes CRUD with filter bar and NoteDialog modal.
 * Uses Zod validation via serviceNoteSchema.
 */
import { useState, useMemo } from 'react'
import { Plus, Trash2, Edit2, X, AlertTriangle, Info, Package, Search, ClipboardCheck, CheckCircle2 } from 'lucide-react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import type { ServiceNote } from '@/types'
import { serviceNoteSchema } from '../schemas'

// ─── Types ────────────────────────────────────────────────────────────────────

type NoteType = ServiceNote['type']
type NotePriority = NonNullable<ServiceNote['priority']>
type NoteStatus = NonNullable<ServiceNote['status']>

const PRIORITY_META: Record<NotePriority, { label: string; color: string }> = {
  alta:  { label: 'Alta',  color: 'bg-red-900/40 text-red-300 border border-red-700/50' },
  media: { label: 'Média', color: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50' },
  baixa: { label: 'Baixa', color: 'bg-green-900/40 text-green-300 border border-green-700/50' },
}

const NOTE_STATUS_META: Record<NoteStatus, { label: string; color: string }> = {
  pendente:     { label: 'Pendente',     color: 'bg-[#484848]/60 text-[#a3a3a3]' },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-900/40 text-blue-300' },
  concluida:    { label: 'Concluída',    color: 'bg-green-900/40 text-green-300' },
}

const TYPE_META: Record<NoteType, { label: string; color: string; Icon: React.ElementType }> = {
  instruction:  { label: 'Instrução',   color: 'bg-blue-900/40 text-blue-300 border-blue-700/50',   Icon: Info },
  safety:       { label: 'Segurança',   color: 'bg-red-900/40 text-red-300 border-red-700/50',     Icon: AlertTriangle },
  material:     { label: 'Material',    color: 'bg-purple-900/40 text-purple-300 border-purple-700/50', Icon: Package },
  inspection:   { label: 'Vistoria',    color: 'bg-green-900/40 text-green-300 border-green-700/50',  Icon: ClipboardCheck },
  other:        { label: 'Outro',       color: 'bg-[#484848]/60 text-[#f5f5f5] border-[#5e5e5e]/50',   Icon: Info },
}

// ─── Note Dialog ──────────────────────────────────────────────────────────────

interface NoteDialogProps {
  initial?: ServiceNote
  trechos: Array<{ id: string; code: string; description: string }>
  teams:   Array<{ id: string; name: string }>
  onClose: () => void
  onSave:  (data: Omit<ServiceNote, 'id' | 'createdAt'>) => void
}

function NoteDialog({ initial, trechos, teams, onClose, onSave }: NoteDialogProps) {
  const [form, setForm] = useState<Omit<ServiceNote, 'id' | 'createdAt'>>({
    date:        initial?.date        ?? new Date().toISOString().slice(0, 10),
    trechoId:    initial?.trechoId    ?? (trechos[0]?.id ?? ''),
    teamId:      initial?.teamId      ?? (teams[0]?.id   ?? ''),
    type:        initial?.type        ?? 'instruction',
    title:       initial?.title       ?? '',
    body:        initial?.body        ?? '',
    createdBy:   initial?.createdBy   ?? '',
    priority:    initial?.priority    ?? 'media',
    status:      initial?.status      ?? 'pendente',
    responsavel: initial?.responsavel ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSave() {
    const result = serviceNoteSchema.safeParse(form)
    if (!result.success) {
      const errs: Record<string, string> = {}
      for (const issue of result.error.issues) {
        if (issue.path[0]) errs[String(issue.path[0])] = issue.message
      }
      setErrors(errs)
      return
    }
    setErrors({})
    onSave(form)
    onClose()
  }

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => { const next = { ...e }; delete next[field]; return next })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#3d3d3d] rounded-2xl border border-[#5e5e5e] w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-[#525252]">
          <h3 className="text-white font-semibold">{initial ? 'Editar Nota' : 'Nova Nota de Serviço'}</h3>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-white"><X size={18} /></button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Data" error={errors.date}>
              <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)}
                className="w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
            </Field>
            <Field label="Tipo" error={errors.type}>
              <select value={form.type} onChange={(e) => update('type', e.target.value as NoteType)}
                className="w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
                {Object.entries(TYPE_META).map(([k, v]) => (
                  <option key={k} value={k} className="bg-[#3d3d3d]">{v.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Trecho" error={errors.trechoId}>
              <select value={form.trechoId} onChange={(e) => update('trechoId', e.target.value)}
                className="w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
                {trechos.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#3d3d3d]">{t.code} — {t.description.slice(0, 30)}</option>
                ))}
              </select>
            </Field>
            <Field label="Equipe" error={errors.teamId}>
              <select value={form.teamId} onChange={(e) => update('teamId', e.target.value)}
                className="w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
                {teams.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#3d3d3d]">{t.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Título" error={errors.title}>
            <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)}
              maxLength={150} placeholder="Título da nota"
              className="w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white placeholder-[#6b6b6b] focus:outline-none focus:border-orange-500" />
          </Field>

          <Field label="Conteúdo" error={errors.body}>
            <textarea value={form.body} onChange={(e) => update('body', e.target.value)}
              maxLength={2000} rows={4} placeholder="Descreva a nota de serviço…"
              className="w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white placeholder-[#6b6b6b] focus:outline-none focus:border-orange-500 resize-none" />
          </Field>

          <Field label="Autor / Criado por" error={errors.createdBy}>
            <input type="text" value={form.createdBy} onChange={(e) => update('createdBy', e.target.value)}
              maxLength={100} placeholder="Nome do responsável pela criação"
              className="w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white placeholder-[#6b6b6b] focus:outline-none focus:border-orange-500" />
          </Field>

          <Field label="Responsável pela Execução">
            <input type="text" value={form.responsavel ?? ''} onChange={(e) => update('responsavel', e.target.value)}
              maxLength={100} placeholder="Quem irá executar"
              className="w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white placeholder-[#6b6b6b] focus:outline-none focus:border-orange-500" />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Prioridade">
              <select value={form.priority ?? 'media'} onChange={(e) => update('priority', e.target.value)}
                className="w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
                {Object.entries(PRIORITY_META).map(([k, v]) => (
                  <option key={k} value={k} className="bg-[#3d3d3d]">{v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status ?? 'pendente'} onChange={(e) => update('status', e.target.value)}
                className="w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
                {Object.entries(NOTE_STATUS_META).map(([k, v]) => (
                  <option key={k} value={k} className="bg-[#3d3d3d]">{v.label}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-[#525252]">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#f97316' }}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[#a3a3a3]">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ─── NotesPanel ───────────────────────────────────────────────────────────────

export function NotesPanel() {
  const { notes, trechos, teams, addNote, updateNote, removeNote } = usePlanejamentoStore()

  const [showDialog, setShowDialog] = useState(false)
  const [editNote, setEditNote]     = useState<ServiceNote | undefined>()
  const [filterType, setFilterType]         = useState('')
  const [filterTrecho, setFilterTrecho]     = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterStatus, setFilterStatus]     = useState('')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (filterType     && n.type !== filterType) return false
      if (filterTrecho   && n.trechoId !== filterTrecho) return false
      if (filterPriority && (n.priority ?? 'media') !== filterPriority) return false
      if (filterStatus   && (n.status ?? 'pendente') !== filterStatus) return false
      if (search) {
        const q = search.toLowerCase()
        if (!n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) return false
      }
      return true
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [notes, filterType, filterTrecho, filterPriority, filterStatus, search])

  function handleSave(data: Omit<ServiceNote, 'id' | 'createdAt'>) {
    if (editNote) {
      updateNote(editNote.id, data)
    } else {
      addNote(data)
    }
    setEditNote(undefined)
  }

  function openEdit(note: ServiceNote) { setEditNote(note); setShowDialog(true) }
  function openNew() { setEditNote(undefined); setShowDialog(true) }

  return (
    <div className="p-6">
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2">
          <Search size={14} className="text-[#a3a3a3]" />
          <input type="text" placeholder="Buscar nas notas…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent flex-1 text-sm text-white placeholder-[#6b6b6b] focus:outline-none" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k} className="bg-[#3d3d3d]">{v.label}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          className="bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
          <option value="">Todas as prioridades</option>
          {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k} className="bg-[#3d3d3d]">{v.label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
          <option value="">Todos os status</option>
          {Object.entries(NOTE_STATUS_META).map(([k, v]) => <option key={k} value={k} className="bg-[#3d3d3d]">{v.label}</option>)}
        </select>
        <select value={filterTrecho} onChange={(e) => setFilterTrecho(e.target.value)}
          className="bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500">
          <option value="">Todos os trechos</option>
          {trechos.map((t) => <option key={t.id} value={t.id} className="bg-[#3d3d3d]">{t.code}</option>)}
        </select>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 transition-colors ml-auto">
          <Plus size={14} /> Nova Nota
        </button>
      </div>

      <p className="text-xs text-[#6b6b6b] mb-4">{filtered.length} nota(s)</p>

      {/* Cards */}
      {filtered.length === 0 && (
        <div className="text-center text-[#6b6b6b] py-12 text-sm">
          Nenhuma nota encontrada. Clique em "Nova Nota" para adicionar.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((note) => {
          const meta = TYPE_META[note.type]
          const trecho = trechos.find((t) => t.id === note.trechoId)
          const team = teams.find((t) => t.id === note.teamId)
          return (
            <div key={note.id} className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${meta.color}`}>
                    <meta.Icon size={11} /> {meta.label}
                  </span>
                  {note.priority && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_META[note.priority].color}`}>
                      {PRIORITY_META[note.priority].label}
                    </span>
                  )}
                  {note.status && (
                    <span className={`px-2 py-0.5 rounded text-xs ${NOTE_STATUS_META[note.status].color}`}>
                      {NOTE_STATUS_META[note.status].label}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(note)} className="text-[#a3a3a3] hover:text-white p-1 rounded transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => {
                    if (confirm('Remover esta nota?')) removeNote(note.id)
                  }} className="text-red-400 hover:text-red-300 p-1 rounded transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div>
                <div className="text-white font-medium text-sm">{note.title}</div>
                <div className="text-[#a3a3a3] text-xs mt-1 line-clamp-3">{note.body}</div>
              </div>
              {note.responsavel && (
                <div className="text-xs text-[#6b6b6b]">Resp.: <span className="text-[#a3a3a3]">{note.responsavel}</span></div>
              )}
              <div className="flex items-center justify-between text-xs text-[#6b6b6b] mt-auto pt-2 border-t border-[#525252]">
                <span>{trecho?.code ?? '—'} · {team?.name ?? '—'}</span>
                <span>{note.date}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-600">{note.createdBy}</div>
                {note.status !== 'concluida' && (
                  <button
                    onClick={() => updateNote(note.id, { status: 'concluida' })}
                    className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
                  >
                    <CheckCircle2 size={12} /> Concluir
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showDialog && (
        <NoteDialog
          initial={editNote}
          trechos={trechos}
          teams={teams}
          onClose={() => { setShowDialog(false); setEditNote(undefined) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
