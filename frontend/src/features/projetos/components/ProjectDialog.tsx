import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Trash2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjetosStore } from '@/store/projetosStore'
import { projectInfoSchema, type ProjectInfoFormValues } from '../schemas'
import type { ProjectStatus } from '@/types'

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'active',    label: 'Ativo' },
  { value: 'planning',  label: 'Planejamento' },
  { value: 'completed', label: 'Concluído' },
  { value: 'on_hold',   label: 'Em Espera' },
]

function blankDefaults(): ProjectInfoFormValues {
  return {
    code: '', name: '', owner: '', manager: '',
    description: '', status: 'active',
    startDate: '', endDate: '',
    contractNumber: '', clientName: '', projectManager: '',
    riskLevel: undefined, priority: undefined,
  }
}

export function ProjectDialog() {
  const projects          = useProjetosStore((s) => s.projects)
  const editingProjectId  = useProjetosStore((s) => s.editingProjectId)
  const setEditingProject = useProjetosStore((s) => s.setEditingProject)
  const addProject        = useProjetosStore((s) => s.addProject)
  const updateProject     = useProjetosStore((s) => s.updateProject)
  const deleteProject     = useProjetosStore((s) => s.deleteProject)

  const [confirmDelete, setConfirmDelete] = useState(false)

  const isNew    = editingProjectId === 'new'
  const existing = isNew ? null : projects.find((p) => p.id === editingProjectId) ?? null

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectInfoFormValues>({
    resolver: zodResolver(projectInfoSchema),
    defaultValues: blankDefaults(),
  })

  useEffect(() => {
    if (existing) {
      reset({
        code:           existing.code,
        name:           existing.name,
        owner:          existing.owner,
        manager:        existing.manager,
        description:    existing.description ?? '',
        status:         existing.status,
        startDate:      existing.startDate,
        endDate:        existing.endDate,
        contractNumber: existing.contractNumber ?? '',
        clientName:     existing.clientName     ?? '',
        projectManager: existing.projectManager ?? '',
        riskLevel:      existing.riskLevel,
        priority:       existing.priority,
      })
    } else if (isNew) {
      reset(blankDefaults())
    }
    setConfirmDelete(false)
  }, [editingProjectId, existing, isNew, reset])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function close() {
    setEditingProject(null)
    setConfirmDelete(false)
  }

  function onSubmit(values: ProjectInfoFormValues) {
    if (isNew) {
      addProject({
        ...values,
        description:    values.description    ?? '',
        contractNumber: values.contractNumber || undefined,
        clientName:     values.clientName     || undefined,
        projectManager: values.projectManager || undefined,
        planningPhases: [
          { id: `pp-new-1-${Date.now()}`, name: 'Engenharia e Design', status: 'not_started', progress: 0, startDate: values.startDate, endDate: values.endDate },
          { id: `pp-new-2-${Date.now()}`, name: 'Pré-construção',       status: 'not_started', progress: 0, startDate: values.startDate, endDate: values.endDate },
          { id: `pp-new-3-${Date.now()}`, name: 'Aquisições',           status: 'not_started', progress: 0, startDate: values.startDate, endDate: values.endDate },
        ],
        executionPhases: [
          { id: `ep-new-1-${Date.now()}`, name: 'Construção',         status: 'not_started', progress: 0, startDate: values.startDate, endDate: values.endDate },
          { id: `ep-new-2-${Date.now()}`, name: 'Controle do Projeto', status: 'not_started', progress: 0, startDate: values.startDate, endDate: values.endDate },
          { id: `ep-new-3-${Date.now()}`, name: 'Encerramento',       status: 'not_started', progress: 0, startDate: values.startDate, endDate: values.endDate },
        ],
        budgetLines: [],
        demands: [],
        documents: [],
      })
    } else if (existing) {
      updateProject(existing.id, {
        ...values,
        description:    values.description    ?? '',
        contractNumber: values.contractNumber || undefined,
        clientName:     values.clientName     || undefined,
        projectManager: values.projectManager || undefined,
      })
    }
    close()
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    if (existing) deleteProject(existing.id)
    close()
  }

  if (!editingProjectId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.76)' }}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-[#20406a] bg-[#112645] flex flex-col shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#20406a] shrink-0">
          <h2 className="text-[#f5f5f5] font-bold text-base">
            {isNew ? 'Novo Projeto' : `Editar — ${existing?.name ?? ''}`}
          </h2>
          <button
            onClick={close}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#1a3662] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5" style={{ maxHeight: '68vh' }}>
            {/* Identificação */}
            <Section title="Identificação">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Código *" error={errors.code?.message}>
                  <input {...register('code')} placeholder="PRJ-001" className={inp(!!errors.code)} />
                </Field>
                <Field label="Status *" error={errors.status?.message}>
                  <select {...register('status')} className={inp(!!errors.status)}>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Nome do Projeto *" error={errors.name?.message}>
                <input {...register('name')} placeholder="Torre Residencial Premium" className={inp(!!errors.name)} />
              </Field>
            </Section>

            {/* Responsáveis */}
            <Section title="Responsáveis">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dono (Owner) *" error={errors.owner?.message}>
                  <input {...register('owner')} placeholder="Empresa ou pessoa" className={inp(!!errors.owner)} />
                </Field>
                <Field label="Gerente *" error={errors.manager?.message}>
                  <input {...register('manager')} placeholder="Nome do gerente" className={inp(!!errors.manager)} />
                </Field>
              </div>
            </Section>

            {/* Datas */}
            <Section title="Cronograma">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data de Início *" error={errors.startDate?.message}>
                  <input type="date" {...register('startDate')} className={inp(!!errors.startDate)} />
                </Field>
                <Field label="Data de Término *" error={errors.endDate?.message}>
                  <input type="date" {...register('endDate')} className={inp(!!errors.endDate)} />
                </Field>
              </div>
            </Section>

            {/* Descrição */}
            <Section title="Descrição">
              <Field label="Descrição do Projeto" error={errors.description?.message}>
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Descreva o projeto, objetivos e escopo"
                  className={cn(inp(!!errors.description), 'resize-none')}
                />
              </Field>
            </Section>

            {/* Informações Adicionais */}
            <Section title="Informações Adicionais">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nº do Contrato" error={errors.contractNumber?.message}>
                  <input {...register('contractNumber')} placeholder="CT-2025-001" className={inp(!!errors.contractNumber)} />
                </Field>
                <Field label="Cliente / Contratante" error={errors.clientName?.message}>
                  <input {...register('clientName')} placeholder="Nome do cliente" className={inp(!!errors.clientName)} />
                </Field>
              </div>
              <Field label="Gerente de Projeto" error={errors.projectManager?.message}>
                <input {...register('projectManager')} placeholder="Nome do gerente de projeto" className={inp(!!errors.projectManager)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nível de Risco" error={errors.riskLevel?.message}>
                  <select {...register('riskLevel')} className={inp(!!errors.riskLevel)}>
                    <option value="">— Selecione —</option>
                    <option value="low">Baixo</option>
                    <option value="medium">Médio</option>
                    <option value="high">Alto</option>
                    <option value="critical">Crítico</option>
                  </select>
                </Field>
                <Field label="Prioridade" error={errors.priority?.message}>
                  <select {...register('priority')} className={inp(!!errors.priority)}>
                    <option value="">— Selecione —</option>
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </Field>
              </div>
            </Section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#20406a] shrink-0">
            {!isNew ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-[#ef4444]" />
                  <span className="text-xs text-[#ef4444]">Confirmar exclusão?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="text-xs px-2 py-1 rounded bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30 font-semibold"
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs px-2 py-1 rounded bg-[#1a3662] text-[#a3a3a3] hover:bg-[#20406a]"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 text-xs text-[#6b6b6b] hover:text-[#ef4444] transition-colors"
                >
                  <Trash2 size={13} />
                  Excluir Projeto
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-lg border border-[#20406a] text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#1f3c5e] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#2abfdc] text-white text-xs font-semibold hover:bg-[#1a9ab8] transition-colors"
              >
                {isNew ? 'Criar Projeto' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inp(hasError: boolean) {
  return cn(
    'w-full bg-[#0d2040] border rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#3f3f3f] transition-colors',
    hasError
      ? 'border-[#ef4444] focus:border-[#ef4444]'
      : 'border-[#20406a] focus:border-[#2abfdc]'
  )
}

function Field({ label, error, children }: { label: React.ReactNode; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-widest text-[#a3a3a3] font-semibold">{label}</label>
      {children}
      {error && <span className="text-[11px] text-[#ef4444]">{error}</span>}
    </div>
  )
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold mb-0.5 w-full pb-1 border-b border-[#20406a]">
        {title}
      </legend>
      {children}
    </fieldset>
  )
}
