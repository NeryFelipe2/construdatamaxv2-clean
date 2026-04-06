/**
 * ConfigPanel — Configuração tab for the Planejamento module.
 * 5 sections: Dados, Equipes, Produtividade, Período, Calculadora Inversa.
 */
import { useState, useMemo } from 'react'
import {
  ChevronDown, ChevronRight, Plus, Trash2, Users,
  BarChart3, Calendar, Calculator, Database, ShieldAlert, Settings2,
} from 'lucide-react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import type { PlanTeam, PlanProductivityTable, PlanScheduleConfig } from '@/types'
import { buildWorkDays } from '../utils/scheduleEngine'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon size={16} className="text-orange-400" />
          <span className="text-white font-medium text-sm">{title}</span>
        </div>
        {open ? <ChevronDown size={16} className="text-[#a3a3a3]" /> : <ChevronRight size={16} className="text-[#a3a3a3]" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

function NumInput({ label, value, onChange, min = 0, max, step = 1, unit }: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[#a3a3a3]">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
        />
        {unit && <span className="text-xs text-[#a3a3a3] shrink-0">{unit}</span>}
      </div>
    </div>
  )
}

// ─── DadosSection ─────────────────────────────────────────────────────────────

function DadosSection() {
  const { trechos, importTrechosFromPlatform, projectBudget, setProjectBudget } = usePlanejamentoStore()
  const totalMeters = trechos.reduce((s, t) => s + t.lengthM, 0)
  const [budgetInput, setBudgetInput] = useState(String(projectBudget || ''))
  const [editingBudget, setEditingBudget] = useState(false)

  function saveBudget() {
    const v = parseFloat(budgetInput.replace(',', '.'))
    if (!isNaN(v)) setProjectBudget(v)
    setEditingBudget(false)
  }

  return (
    <Section title="Dados do Projeto" icon={Database}>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 bg-[#484848]/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{trechos.length}</div>
          <div className="text-xs text-[#a3a3a3]">Trechos</div>
        </div>
        <div className="flex-1 bg-[#484848]/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-400">{totalMeters.toFixed(0)}</div>
          <div className="text-xs text-[#a3a3a3]">Metros totais</div>
        </div>
        <div className="flex-1 bg-[#484848]/50 rounded-lg p-3 text-center">
          {editingBudget ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                autoFocus
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveBudget(); if (e.key === 'Escape') setEditingBudget(false) }}
                className="w-full bg-[#525252] border border-gray-500 rounded px-2 py-1 text-sm text-white text-center focus:outline-none"
              />
              <button onClick={saveBudget} className="text-orange-400 text-xs font-bold shrink-0">OK</button>
            </div>
          ) : (
            <button onClick={() => { setBudgetInput(String(projectBudget)); setEditingBudget(true) }} className="w-full text-center hover:opacity-80 transition-opacity">
              <div className="text-lg font-bold text-white">
                {projectBudget > 0
                  ? projectBudget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
                  : '—'}
              </div>
              <div className="text-xs text-[#a3a3a3]">Orçamento total</div>
            </button>
          )}
        </div>
      </div>
      <button
        onClick={importTrechosFromPlatform}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-orange-600 hover:bg-orange-500 text-white transition-colors"
      >
        <Database size={14} />
        Carregar Trechos da Plataforma
      </button>
      <p className="text-xs text-[#6b6b6b] mt-2">
        Importa itens da Pré-Construção com unidade ml/m como trechos de execução. Clique no orçamento para editar.
      </p>
    </Section>
  )
}

// ─── EquipesSection ───────────────────────────────────────────────────────────

const DEFAULT_TEAM: Omit<PlanTeam, 'id'> = {
  name: 'Nova Equipe',
  foremanCount: 1, workerCount: 4, helperCount: 2, operatorCount: 1,
  retroescavadeira: 1, compactador: 1, caminhaoBasculante: 0,
  laborHourlyRateBRL: 45, equipmentDailyRateBRL: 800,
  maxManualExcavDepthM: 1.5,
}

function EquipesSection() {
  const { teams, addTeam, updateTeam, removeTeam } = usePlanejamentoStore()

  return (
    <Section title="Equipes" icon={Users}>
      <div className="space-y-4">
        {teams.map((team) => (
          <div key={team.id} className="bg-[#484848]/40 rounded-lg p-4 border border-[#5e5e5e]">
            <div className="flex items-center justify-between mb-3">
              <input
                type="text"
                value={team.name}
                onChange={(e) => updateTeam(team.id, { name: e.target.value })}
                className="bg-transparent text-white font-medium text-sm focus:outline-none border-b border-transparent focus:border-orange-500 transition-colors"
              />
              <button onClick={() => removeTeam(team.id)} className="text-red-400 hover:text-red-300 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>

            <div className="text-xs text-[#a3a3a3] mb-2 font-medium uppercase tracking-wide">Composição da Equipe</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <NumInput label="Encarregados" value={team.foremanCount} min={0} max={10}
                onChange={(v) => updateTeam(team.id, { foremanCount: v })} />
              <NumInput label="Trabalhadores" value={team.workerCount} min={0} max={50}
                onChange={(v) => updateTeam(team.id, { workerCount: v })} />
              <NumInput label="Auxiliares" value={team.helperCount} min={0} max={20}
                onChange={(v) => updateTeam(team.id, { helperCount: v })} />
              <NumInput label="Operadores" value={team.operatorCount} min={0} max={10}
                onChange={(v) => updateTeam(team.id, { operatorCount: v })} />
            </div>

            <div className="text-xs text-[#a3a3a3] mb-2 font-medium uppercase tracking-wide">Equipamentos</div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <NumInput label="Retroescavadeira" value={team.retroescavadeira} min={0}
                onChange={(v) => updateTeam(team.id, { retroescavadeira: v })} />
              <NumInput label="Compactador" value={team.compactador} min={0}
                onChange={(v) => updateTeam(team.id, { compactador: v })} />
              <NumInput label="Cam. Basculante" value={team.caminhaoBasculante} min={0}
                onChange={(v) => updateTeam(team.id, { caminhaoBasculante: v })} />
            </div>

            <div className="text-xs text-[#a3a3a3] mb-2 font-medium uppercase tracking-wide">Custos</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumInput label="Mão de Obra (R$/h)" value={team.laborHourlyRateBRL} min={1} step={0.5}
                onChange={(v) => updateTeam(team.id, { laborHourlyRateBRL: v })} />
              <NumInput label="Equipamento (R$/dia)" value={team.equipmentDailyRateBRL} min={0} step={50}
                onChange={(v) => updateTeam(team.id, { equipmentDailyRateBRL: v })} />
            </div>

            <div className="text-xs text-[#a3a3a3] mt-3 mb-2 font-medium uppercase tracking-wide">Restrições de Escavação</div>
            <NumInput
              label="Prof. Máx. Escavação Manual (m)"
              value={team.maxManualExcavDepthM ?? 1.5}
              min={0.5} max={4.0} step={0.1} unit="m"
              onChange={(v) => updateTeam(team.id, { maxManualExcavDepthM: v })}
            />
            <p className="text-[11px] text-gray-600 mt-1">
              Trechos mais profundos recebem penalidade de 30% na taxa de escavação.
            </p>
          </div>
        ))}
      </div>
      <button
        onClick={() => addTeam(DEFAULT_TEAM)}
        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] transition-colors"
      >
        <Plus size={14} />
        Nova Equipe
      </button>
    </Section>
  )
}

// ─── ProdutividadeSection ─────────────────────────────────────────────────────

const PROD_ROWS: { key: keyof PlanProductivityTable; label: string; unit: string }[] = [
  { key: 'escavacao',    label: 'Escavação',    unit: 'm/dia' },
  { key: 'assentamento', label: 'Assentamento', unit: 'm/dia' },
  { key: 'reaterro',     label: 'Reaterro',     unit: 'm³/dia' },
  { key: 'escoramento',  label: 'Escoramento',  unit: 'm²/dia' },
  { key: 'pavimentacao', label: 'Pavimentação', unit: 'm²/dia' },
]

function ProdutividadeSection() {
  const { productivityTable, setProductivityTable } = usePlanejamentoStore()

  function update(key: keyof PlanProductivityTable, value: number) {
    setProductivityTable({ ...productivityTable, [key]: Math.max(0.1, value) })
  }

  return (
    <Section title="Produtividade" icon={BarChart3}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#5e5e5e]">
              <th className="text-left text-[#a3a3a3] py-2 pr-4 font-medium">Serviço</th>
              <th className="text-left text-[#a3a3a3] py-2 pr-4 font-medium">Unidade</th>
              <th className="text-right text-[#a3a3a3] py-2 font-medium">Valor</th>
              <th className="text-left text-[#a3a3a3] py-2 pl-3 font-medium">Fonte</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#525252]">
            {PROD_ROWS.map((row) => (
              <tr key={row.key}>
                <td className="text-[#f5f5f5] py-2.5 pr-4">{row.label}</td>
                <td className="text-[#a3a3a3] py-2.5 pr-4 text-xs">{row.unit}</td>
                <td className="py-2.5 text-right">
                  <input
                    type="number"
                    value={productivityTable[row.key]}
                    min={0.1}
                    step={1}
                    onChange={(e) => update(row.key, Number(e.target.value))}
                    className="w-20 bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-orange-500"
                  />
                </td>
                <td className="py-2.5 pl-3">
                  <span className="px-1.5 py-0.5 rounded text-xs bg-blue-900/40 text-blue-300 border border-blue-700/50">SINAPI</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

// ─── ParametrosProdutividadeSection ───────────────────────────────────────────

function ParametrosProdutividadeSection() {
  const { scheduleConfig, setScheduleConfig, productivityTable } = usePlanejamentoStore()

  const bottleneck = Math.min(productivityTable.escavacao, productivityTable.assentamento)

  function updateConfig(updates: Partial<typeof scheduleConfig>) {
    setScheduleConfig({ ...scheduleConfig, ...updates })
  }

  return (
    <Section title="Parâmetros de Produtividade" icon={Settings2}>
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#a3a3a3]">Modo de Agrupamento do Gantt</label>
          <select
            value={scheduleConfig.ganttGroupingMode ?? 'daily_segment'}
            onChange={(e) => updateConfig({ ganttGroupingMode: e.target.value as 'daily_segment' | 'by_trecho' | 'trecho_activity' })}
            className="bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          >
            <option value="daily_segment">Por segmento diário</option>
            <option value="by_trecho">Por Trecho (completo)</option>
            <option value="trecho_activity">Por Trecho + Atividade (ciclo completo)</option>
          </select>
          <p className="text-[11px] text-gray-600">Define como as linhas do Gantt são agrupadas e rotuladas.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => updateConfig({ groupByProximity: !(scheduleConfig.groupByProximity ?? false) })}
            className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${scheduleConfig.groupByProximity ? 'bg-orange-500' : 'bg-[#525252]'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${scheduleConfig.groupByProximity ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <div>
            <span className="text-sm text-[#f5f5f5]">Agrupar Trechos por Proximidade</span>
            <p className="text-[11px] text-[#6b6b6b]">Agrupa trechos próximos para otimizar a execução sequencial.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#484848]/40 border border-[#5e5e5e]">
          <BarChart3 size={16} className="text-orange-400 shrink-0" />
          <div>
            <div className="text-xs text-[#a3a3a3]">Gargalo atual de produção</div>
            <div className="text-base font-bold text-orange-400">{bottleneck} m/dia</div>
            <div className="text-[11px] text-[#6b6b6b]">min(escavação, assentamento) — ajuste na aba Produtividade</div>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── PeriodoSection ───────────────────────────────────────────────────────────

function PeriodoSection() {
  const { scheduleConfig, setScheduleConfig, holidays, addHoliday, removeHoliday } = usePlanejamentoStore()
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayDesc, setNewHolidayDesc] = useState('')

  function handleAddHoliday() {
    if (!newHolidayDate || !newHolidayDesc.trim()) return
    addHoliday({ date: newHolidayDate, description: newHolidayDesc.trim() })
    setNewHolidayDate('')
    setNewHolidayDesc('')
  }

  function updateConfig(updates: Partial<PlanScheduleConfig>) {
    setScheduleConfig({ ...scheduleConfig, ...updates })
  }

  return (
    <Section title="Período e Calendário" icon={Calendar}>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#a3a3a3]">Data de Início</label>
          <input
            type="date"
            value={scheduleConfig.startDate}
            onChange={(e) => updateConfig({ startDate: e.target.value })}
            className="bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#a3a3a3]">Data Alvo de Conclusão</label>
          <input
            type="date"
            value={scheduleConfig.targetEndDate ?? ''}
            onChange={(e) => updateConfig({ targetEndDate: e.target.value || undefined })}
            className="bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#a3a3a3]">Horas por Dia</label>
          <input
            type="number"
            value={scheduleConfig.workHoursPerDay}
            min={1}
            max={24}
            onChange={(e) => updateConfig({ workHoursPerDay: Number(e.target.value) })}
            className="bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#a3a3a3]">Semana de Trabalho</label>
          <select
            value={scheduleConfig.workWeekMode}
            onChange={(e) => updateConfig({ workWeekMode: e.target.value as 'mon_fri' | 'mon_sat' })}
            className="bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          >
            <option value="mon_fri">Segunda a Sexta</option>
            <option value="mon_sat">Segunda a Sábado</option>
          </select>
        </div>
      </div>

      <div className="border-t border-[#525252] pt-4">
        <div className="text-xs text-[#a3a3a3] font-medium uppercase tracking-wide mb-3">Feriados</div>
        {holidays.length > 0 && (
          <div className="space-y-1 mb-3">
            {holidays.map((h) => (
              <div key={h.date} className="flex items-center justify-between bg-[#484848]/40 rounded-lg px-3 py-2">
                <span className="text-sm text-[#f5f5f5]">{h.date} — {h.description}</span>
                <button onClick={() => removeHoliday(h.date)} className="text-red-400 hover:text-red-300">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            className="bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          />
          <input
            type="text"
            placeholder="Descrição do feriado"
            value={newHolidayDesc}
            onChange={(e) => setNewHolidayDesc(e.target.value)}
            className="flex-1 bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white placeholder-[#6b6b6b] focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={handleAddHoliday}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#525252] hover:bg-gray-500 text-[#f5f5f5] text-sm transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </Section>
  )
}

// ─── Calculadora Inversa ──────────────────────────────────────────────────────

function CalculadoraSection() {
  const [enabled, setEnabled] = useState(false)
  const [targetDate, setTargetDate] = useState('')
  const { trechos, teams, productivityTable, scheduleConfig, holidays } = usePlanejamentoStore()

  const result = useMemo(() => {
    if (!enabled || !targetDate) return null
    try {
      const workDays = buildWorkDays(scheduleConfig.startDate, 1000, scheduleConfig, holidays)
      const targetIdx = workDays.indexOf(targetDate)
      if (targetIdx < 0) return 'Data alvo não é dia útil ou está fora do alcance.'
      const availableDays = targetIdx + 1
      const totalMeters = trechos.reduce((s, t) => s + t.lengthM, 0)
      if (teams.length === 0) return 'Adicione ao menos uma equipe.'
      const avgMPerDay = Math.min(
        productivityTable.escavacao,
        productivityTable.assentamento,
        productivityTable.reaterro,
        productivityTable.escoramento,
      )
      const requiredDays = Math.ceil(totalMeters / avgMPerDay / teams.length)
      if (requiredDays <= availableDays) {
        return `✓ Prazo viável: ${requiredDays} dias úteis necessários, ${availableDays} disponíveis.`
      } else {
        const deficit = requiredDays - availableDays
        const extraTeams = Math.ceil(deficit / availableDays)
        return `✗ Prazo inviável. Faltam ${deficit} dia(s) úteis. Sugestão: adicionar ~${extraTeams} equipe(s).`
      }
    } catch {
      return 'Erro no cálculo.'
    }
  }, [enabled, targetDate, trechos, teams, productivityTable, scheduleConfig, holidays])

  return (
    <Section title="Calculadora Inversa" icon={Calculator}>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-orange-500' : 'bg-[#525252]'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
        <span className="text-sm text-[#f5f5f5]">Habilitar calculadora inversa</span>
      </div>

      {enabled && (
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#a3a3a3]">Data Alvo de Conclusão</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-48 bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          {result && (
            <div className={`px-4 py-3 rounded-lg text-sm ${
              result.startsWith('✓')
                ? 'bg-green-900/30 text-green-300 border border-green-700/50'
                : result.startsWith('✗')
                ? 'bg-red-900/30 text-red-300 border border-red-700/50'
                : 'bg-[#484848] text-[#f5f5f5]'
            }`}>
              {result}
            </div>
          )}
          <p className="text-xs text-[#6b6b6b]">
            Cálculo aproximado com produtividade média. Gere o planejamento completo para resultado exato.
          </p>
        </div>
      )}
    </Section>
  )
}

// ─── TechnicalRulesSection ────────────────────────────────────────────────────

function TechnicalRulesSection() {
  const { technicalRules, addTechnicalRule, updateTechnicalRule, removeTechnicalRule } = usePlanejamentoStore()

  return (
    <Section title="Regras Técnicas" icon={ShieldAlert}>
      <p className="text-xs text-[#6b6b6b] mb-4">
        Regras aplicadas automaticamente a trechos que correspondam à condição. Multiplicam a produtividade e o custo.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#525252]">
              <th className="text-left text-[#a3a3a3] font-medium py-2 pr-3">Nome da Regra</th>
              <th className="text-left text-[#a3a3a3] font-medium py-2 pr-3">Condição</th>
              <th className="text-right text-[#a3a3a3] font-medium py-2 pr-3 w-32">Prod. (×)</th>
              <th className="text-right text-[#a3a3a3] font-medium py-2 pr-3 w-32">Custo (×)</th>
              <th className="py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {technicalRules.map((rule) => (
              <tr key={rule.id} className="border-b border-[#525252]/50 group">
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    value={rule.name}
                    onChange={(e) => updateTechnicalRule(rule.id, { name: e.target.value })}
                    className="w-full bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1 text-[#f5f5f5] focus:outline-none focus:border-orange-500"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    value={rule.condition}
                    onChange={(e) => updateTechnicalRule(rule.id, { condition: e.target.value })}
                    className="w-full bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1 text-[#a3a3a3] font-mono focus:outline-none focus:border-orange-500"
                  />
                </td>
                <td className="py-2 pr-3 text-right">
                  <input
                    type="number"
                    value={rule.productivityMultiplier}
                    min={0.1}
                    max={2}
                    step={0.05}
                    onChange={(e) => updateTechnicalRule(rule.id, { productivityMultiplier: Number(e.target.value) })}
                    className="w-full bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1 text-right text-[#f5f5f5] focus:outline-none focus:border-orange-500"
                  />
                </td>
                <td className="py-2 pr-3 text-right">
                  <input
                    type="number"
                    value={rule.costMultiplier}
                    min={0.1}
                    max={3}
                    step={0.05}
                    onChange={(e) => updateTechnicalRule(rule.id, { costMultiplier: Number(e.target.value) })}
                    className="w-full bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1 text-right text-[#f5f5f5] focus:outline-none focus:border-orange-500"
                  />
                </td>
                <td className="py-2">
                  <button onClick={() => removeTechnicalRule(rule.id)} className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {technicalRules.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-600">Nenhuma regra técnica definida.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button
        onClick={() => addTechnicalRule({
          name: 'Nova Regra',
          condition: 'soilType === ...',
          productivityMultiplier: 0.8,
          costMultiplier: 1.2,
        })}
        className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] transition-colors"
      >
        <Plus size={13} /> Adicionar Regra
      </button>
    </Section>
  )
}

// ─── ConfigPanel ──────────────────────────────────────────────────────────────

export function ConfigPanel() {
  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <DadosSection />
      <EquipesSection />
      <ProdutividadeSection />
      <ParametrosProdutividadeSection />
      <PeriodoSection />
      <TechnicalRulesSection />
      <CalculadoraSection />
    </div>
  )
}
