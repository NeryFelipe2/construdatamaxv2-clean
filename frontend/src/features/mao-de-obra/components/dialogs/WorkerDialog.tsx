import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { workerSchema, type WorkerFormData } from '../../schemas'
import type { WorkerCertification } from '@/types'

interface Props {
  onClose: () => void
}

const CERT_TYPES = ['NR18', 'NR35', 'NR10', 'NR12', 'CIPA', 'ASO', 'Outro']
const STATUS_OPTIONS: Array<{ value: import('@/types').WorkerStatus; label: string }> = [
  { value: 'active',           label: 'Ativo' },
  { value: 'inactive',         label: 'Inativo' },
  { value: 'suspended',        label: 'Suspenso' },
  { value: 'pending_approval', label: 'Aguardando Aprovação' },
]

const emptyForm: WorkerFormData = {
  name:           '',
  role:           '',
  cpfMasked:      '***.***.***-**',
  crewId:         '',
  status:         'active',
  hourlyRate:     0,
  certifications: [],
}

function blankCert(): WorkerCertification {
  return {
    id:          crypto.randomUUID().slice(0, 8),
    type:        'NR18',
    issuedDate:  new Date().toISOString().slice(0, 10),
    expiryDate:  '',
    status:      'valid',
  }
}

export function WorkerDialog({ onClose }: Props) {
  const { crews, addWorker } = useMaoDeObraStore((s) => ({ crews: s.crews, addWorker: s.addWorker }))
  const [form, setForm]     = useState<WorkerFormData>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof WorkerFormData, string>>>({})

  function handleField<K extends keyof WorkerFormData>(key: K, val: WorkerFormData[K]) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function addCert() {
    setForm((f) => ({ ...f, certifications: [...f.certifications, blankCert()] }))
  }

  function removeCert(idx: number) {
    setForm((f) => ({ ...f, certifications: f.certifications.filter((_, i) => i !== idx) }))
  }

  function updateCert(idx: number, patch: Partial<WorkerCertification>) {
    setForm((f) => ({
      ...f,
      certifications: f.certifications.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = workerSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof WorkerFormData, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof WorkerFormData
        if (key) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    addWorker(parsed.data)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#333333] border border-[#525252] rounded-xl w-full max-w-lg p-6 flex flex-col gap-4 my-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-[#f5f5f5] text-base font-semibold">Novo Funcionário</h2>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Name */}
          <label className="flex flex-col gap-1">
            <span className="text-[#6b6b6b] text-xs font-medium">Nome completo *</span>
            <input
              type="text"
              maxLength={100}
              value={form.name}
              onChange={(e) => handleField('name', e.target.value)}
              className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              placeholder="Ex: João da Silva"
            />
            {errors.name && <span className="text-[#ef4444] text-xs">{errors.name}</span>}
          </label>

          {/* Role */}
          <label className="flex flex-col gap-1">
            <span className="text-[#6b6b6b] text-xs font-medium">Função *</span>
            <input
              type="text"
              maxLength={100}
              value={form.role}
              onChange={(e) => handleField('role', e.target.value)}
              className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              placeholder="Ex: Pedreiro Oficial"
            />
            {errors.role && <span className="text-[#ef4444] text-xs">{errors.role}</span>}
          </label>

          {/* Crew + Status row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[#6b6b6b] text-xs font-medium">Equipe</span>
              <select
                value={form.crewId}
                onChange={(e) => handleField('crewId', e.target.value)}
                className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              >
                <option value="">— Sem equipe (definir depois) —</option>
                {crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[#6b6b6b] text-xs font-medium">Status *</span>
              <select
                value={form.status}
                onChange={(e) => handleField('status', e.target.value as import('@/types').WorkerStatus)}
                className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              >
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>

          {/* Hourly rate */}
          <label className="flex flex-col gap-1">
            <span className="text-[#6b6b6b] text-xs font-medium">Valor hora (R$) *</span>
            <input
              type="number"
              min={0}
              max={9999.99}
              step={0.01}
              value={form.hourlyRate}
              onChange={(e) => handleField('hourlyRate', parseFloat(e.target.value) || 0)}
              className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            />
            {errors.hourlyRate && <span className="text-[#ef4444] text-xs">{errors.hourlyRate}</span>}
          </label>

          {/* Certifications */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[#6b6b6b] text-xs font-medium">Certificações</span>
              <button
                type="button"
                onClick={addCert}
                className="flex items-center gap-1 text-xs text-[#f97316] hover:underline"
              >
                <Plus size={11} /> Adicionar
              </button>
            </div>
            {form.certifications.map((cert, idx) => (
              <div key={cert.id} className="flex items-center gap-2 bg-[#3d3d3d] rounded-lg p-2">
                <select
                  value={cert.type}
                  onChange={(e) => updateCert(idx, { type: e.target.value })}
                  className="bg-[#3d3d3d] border border-[#1f3c5e] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none"
                >
                  {CERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  type="date"
                  value={cert.issuedDate}
                  onChange={(e) => updateCert(idx, { issuedDate: e.target.value })}
                  className="bg-[#3d3d3d] border border-[#1f3c5e] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none"
                />
                <input
                  type="date"
                  value={cert.expiryDate}
                  onChange={(e) => updateCert(idx, { expiryDate: e.target.value })}
                  className="bg-[#3d3d3d] border border-[#1f3c5e] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none"
                  placeholder="Vencimento"
                />
                <button
                  type="button"
                  onClick={() => removeCert(idx)}
                  className="text-[#6b6b6b] hover:text-[#ef4444] transition-colors ml-auto shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#1f3c5e] text-[#f5f5f5] text-sm hover:bg-[#484848] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-semibold transition-colors"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
