/**
 * RestricoesPanel — CRUD table + modal for LPS Restrictions (Análise de Restrições).
 */
import { useState } from 'react'
import { Plus, Trash2, AlertTriangle, X } from 'lucide-react'
import { useLpsStore } from '@/store/lpsStore'
import type { LpsRestriction, LpsRestrictionCategory, LpsRestrictionStatus } from '@/types'
import { ConfirmDialog } from './ConfirmDialog'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<LpsRestrictionCategory, string> = {
  projeto_engenharia: 'Projeto/Engenharia',
  materiais:          'Materiais',
  equipamentos:       'Equipamentos',
  mao_de_obra:        'Mão de Obra',
  externo:            'Externo',
  outros:             'Outros',
}

const CATEGORY_COLORS: Record<LpsRestrictionCategory, string> = {
  projeto_engenharia: '#6366f1',
  materiais:          '#2abfdc',
  equipamentos:       '#eab308',
  mao_de_obra:        '#a78bfa',
  externo:            '#38bdf8',
  outros:             '#94a3b8',
}

const STATUS_LABELS: Record<LpsRestrictionStatus, string> = {
  identificada:  'Identificada',
  em_resolucao:  'Em Resolução',
  resolvida:     'Resolvida',
}

const STATUS_COLORS: Record<LpsRestrictionStatus, string> = {
  identificada:  'text-red-400',
  em_resolucao:  'text-yellow-400',
  resolvida:     'text-green-400',
}

type FilterStatus = 'all' | LpsRestrictionStatus

// ─── Blank form factory ───────────────────────────────────────────────────────

function blankForm(): Omit<LpsRestriction, 'id' | 'createdAt'> {
  return {
    tema: '',
    categoria: 'materiais',
    descricao: '',
    impacto: '',
    responsavel: '',
    prazoRemocao: '',
    acoesNecessarias: '',
    tags: [],
    observacoes: '',
    status: 'identificada',
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RestricoesPanel() {
  const restrictions     = useLpsStore((s) => s.restrictions)
  const addRestriction   = useLpsStore((s) => s.addRestriction)
  const updateRestriction = useLpsStore((s) => s.updateRestriction)
  const removeRestriction = useLpsStore((s) => s.removeRestriction)

  const [filter, setFilter]             = useState<FilterStatus>('all')
  const [modalOpen, setModalOpen]       = useState(false)
  const [editId, setEditId]             = useState<string | null>(null)
  const [form, setForm]                 = useState(blankForm())
  const [tagInput, setTagInput]         = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<{ id: string; status: LpsRestrictionStatus } | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const visible = filter === 'all'
    ? restrictions
    : restrictions.filter((r) => r.status === filter)

  const counts = {
    total:        restrictions.length,
    identificada: restrictions.filter((r) => r.status === 'identificada').length,
    em_resolucao: restrictions.filter((r) => r.status === 'em_resolucao').length,
    resolvida:    restrictions.filter((r) => r.status === 'resolvida').length,
  }

  function openNew() {
    setEditId(null)
    setForm(blankForm())
    setTagInput('')
    setModalOpen(true)
  }

  function openEdit(r: LpsRestriction) {
    setEditId(r.id)
    setForm({
      tema: r.tema,
      categoria: r.categoria,
      descricao: r.descricao,
      impacto: r.impacto ?? '',
      responsavel: r.responsavel ?? '',
      prazoRemocao: r.prazoRemocao ?? '',
      acoesNecessarias: r.acoesNecessarias ?? '',
      tags: [...r.tags],
      observacoes: r.observacoes ?? '',
      status: r.status,
    })
    setTagInput('')
    setModalOpen(true)
  }

  function handleSubmit() {
    if (!form.tema.trim() || !form.descricao.trim()) return
    if (editId) {
      updateRestriction(editId, form)
    } else {
      addRestriction(form)
    }
    setModalOpen(false)
  }

  function addTag() {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) {
      setForm((f) => ({ ...f, tags: [...f.tags, t] }))
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header + KPIs */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-sm font-bold text-white">Análise de Restrições</h2>
          <KpiBadge label="TOTAL"        value={counts.total}        color="bg-gray-700 text-gray-200" />
          <KpiBadge label="IDENTIFICADAS" value={counts.identificada} color="bg-red-900/50 text-red-300" />
          <KpiBadge label="EM RESOLUÇÃO"  value={counts.em_resolucao} color="bg-yellow-900/50 text-yellow-300" />
          <KpiBadge label="RESOLVIDAS"    value={counts.resolvida}    color="bg-green-900/50 text-green-300" />
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors"
        >
          <Plus size={14} /> Nova Restrição
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'identificada', 'em_resolucao', 'resolvida'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              filter === f
                ? 'bg-orange-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f === 'all' ? 'Todas' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 overflow-x-auto overflow-hidden">
        {visible.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-10">Nenhuma restrição encontrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-800/80 border-b border-gray-700">
              <tr>
                <th className="text-left text-gray-400 px-4 py-2.5 text-xs font-semibold">Categoria</th>
                <th className="text-left text-gray-400 px-4 py-2.5 text-xs font-semibold">Tema / Descrição</th>
                <th className="text-left text-gray-400 px-4 py-2.5 text-xs font-semibold">Responsável</th>
                <th className="text-left text-gray-400 px-4 py-2.5 text-xs font-semibold">Prazo</th>
                <th className="text-left text-gray-400 px-4 py-2.5 text-xs font-semibold">Tags</th>
                <th className="text-left text-gray-400 px-4 py-2.5 text-xs font-semibold">Status</th>
                <th className="px-4 py-2.5 text-xs" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {visible.map((r) => {
                const isExpired = r.prazoRemocao && r.prazoRemocao < today && r.status !== 'resolvida'
                return (
                  <tr
                    key={r.id}
                    className="bg-gray-900 hover:bg-gray-800/50 transition-colors cursor-pointer"
                    onClick={() => openEdit(r)}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                        style={{
                          backgroundColor: CATEGORY_COLORS[r.categoria] + '30',
                          color: CATEGORY_COLORS[r.categoria],
                        }}
                      >
                        {CATEGORY_LABELS[r.categoria]}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-white text-xs font-semibold">{r.tema}</p>
                      <p className="text-gray-500 text-[10px] truncate">{r.descricao}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{r.responsavel || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.prazoRemocao ? (
                        <span className={`flex items-center gap-1 ${isExpired ? 'text-red-400' : 'text-gray-300'}`}>
                          {isExpired && <AlertTriangle size={11} />}
                          {r.prazoRemocao}
                        </span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.tags.slice(0, 3).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-[9px]">{t}</span>
                        ))}
                        {r.tags.length > 3 && (
                          <span className="text-gray-600 text-[9px]">+{r.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                      {pendingStatus?.id === r.id ? (
                        <ConfirmDialog
                          message={`Alterar para ${STATUS_LABELS[pendingStatus.status]}?`}
                          confirmLabel="Alterar"
                          onConfirm={() => {
                            updateRestriction(r.id, {
                              status: pendingStatus.status,
                              resolvedAt: pendingStatus.status === 'resolvida' ? today : undefined,
                            })
                            setPendingStatus(null)
                          }}
                          onCancel={() => setPendingStatus(null)}
                          danger={false}
                        />
                      ) : (
                        <select
                          value={r.status}
                          onChange={(e) => setPendingStatus({ id: r.id, status: e.target.value as LpsRestrictionStatus })}
                          className={`bg-transparent text-xs font-semibold border-none outline-none cursor-pointer ${STATUS_COLORS[r.status]}`}
                        >
                          {(Object.keys(STATUS_LABELS) as LpsRestrictionStatus[]).map((s) => (
                            <option key={s} value={s} className="bg-gray-900 text-white">{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[140px]" onClick={(e) => e.stopPropagation()}>
                      {confirmDeleteId === r.id ? (
                        <ConfirmDialog
                          message="Remover restrição?"
                          onConfirm={() => { removeRestriction(r.id); setConfirmDeleteId(null) }}
                          onCancel={() => setConfirmDeleteId(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(r.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h3 className="text-sm font-bold text-white">
                {editId ? 'Editar Restrição' : 'Nova Restrição'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-gray-300">
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Tema */}
              <FieldGroup label="Tema *">
                <input
                  type="text"
                  value={form.tema}
                  onChange={(e) => setForm((f) => ({ ...f, tema: e.target.value }))}
                  placeholder="Ex: Licença ambiental pendente"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </FieldGroup>

              {/* Categoria */}
              <FieldGroup label="Categoria">
                <select
                  value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as LpsRestrictionCategory }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  {(Object.keys(CATEGORY_LABELS) as LpsRestrictionCategory[]).map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </FieldGroup>

              {/* Descrição */}
              <FieldGroup label="Descrição / Restrição *">
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  rows={3}
                  placeholder="Descreva a restrição..."
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 resize-none"
                />
              </FieldGroup>

              {/* Impacto + Responsável row */}
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Impacto">
                  <input
                    type="text"
                    value={form.impacto}
                    onChange={(e) => setForm((f) => ({ ...f, impacto: e.target.value }))}
                    placeholder="Ex: Paralisa equipe B"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </FieldGroup>
                <FieldGroup label="Responsável">
                  <input
                    type="text"
                    value={form.responsavel}
                    onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
                    placeholder="Ex: Eng. Ambiental"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </FieldGroup>
              </div>

              {/* Prazo + Status row */}
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Prazo de Remoção">
                  <input
                    type="date"
                    value={form.prazoRemocao}
                    onChange={(e) => setForm((f) => ({ ...f, prazoRemocao: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </FieldGroup>
                <FieldGroup label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as LpsRestrictionStatus }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  >
                    {(Object.keys(STATUS_LABELS) as LpsRestrictionStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </FieldGroup>
              </div>

              {/* Ações Necessárias */}
              <FieldGroup label="Ações Necessárias">
                <textarea
                  value={form.acoesNecessarias}
                  onChange={(e) => setForm((f) => ({ ...f, acoesNecessarias: e.target.value }))}
                  rows={2}
                  placeholder="Liste as ações para remover esta restrição..."
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 resize-none"
                />
              </FieldGroup>

              {/* Tags */}
              <FieldGroup label="Tags">
                <div className="flex flex-wrap gap-1 mb-2">
                  {form.tags.map((t) => (
                    <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
                      {t}
                      <button onClick={() => removeTag(t)} className="hover:text-red-400"><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                    placeholder="Digite e pressione Enter"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={addTag}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs"
                  >
                    Adicionar
                  </button>
                </div>
              </FieldGroup>

              {/* Observações */}
              <FieldGroup label="Observações">
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  rows={2}
                  placeholder="Informações adicionais (opcional)..."
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 resize-none"
                />
              </FieldGroup>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.tema.trim() || !form.descricao.trim()}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {editId ? 'Salvar' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${color} text-xs`}>
      <span className="font-bold text-lg leading-none">{value}</span>
      <span className="uppercase tracking-wider text-[10px] opacity-80">{label}</span>
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

