import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Sunrise, HardHat, CheckCircle2, AlertTriangle, RotateCcw, GripVertical,
  ClipboardCopy, ChevronDown, ChevronUp, Truck, UserX, Pencil, Plus, Trash2, X,
  CalendarClock, ArrowRight,
} from 'lucide-react'
import {
  useEquipesKanbanStore, type EquipeState, type PessoaState, type EquipamentoState,
} from '@/store/equipesKanbanStore'
import {
  EQUIPE_STATUS_ORDER, EQUIPE_STATUS_LABEL, FRENTE_META, FRENTE_TO_NUCLEO,
  type EquipeStatus, type EquipeCard as EquipeDef, type FrenteId,
} from '@/data/wcrEquipes'
import { useProjectContext } from '@/store/projectContext'
import { useMasterScheduleEngine } from '@/hooks/useMasterScheduleEngine'
import { useCronogramaEquipe } from '@/hooks/useCronogramaEquipe'
import { useEquipes, type NovaEquipeInput } from '@/hooks/useEquipes'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import type { MasterAggregate } from '@/lib/matching/masterScheduleCompute'
import type { EquipeCronograma } from '@/lib/matching/cronogramaEquipeCompute'

// ─── Badge de prazo por equipe ("tudo conversa" com o cronograma por equipe) ─
//
// M6: antes, o badge casava `lider` (string solta) contra `teamVelocities` do
// motor macro — frágil, a maioria caía em "sem dado". Agora as equipes têm id
// canônico e o cronograma nasce delas (`useCronogramaEquipe`/M4), então o
// badge lê a data-fim REAL calculada para a equipe (por `equipeId`) e só usa
// o motor macro (`useMasterScheduleEngine`) para a baseline planejada do
// núcleo (`aggregates[].dataFimPlanejada`).

type PrazoBadgeInfo = { label: string; color: string; bg: string; border: string }

const PRAZO_SEM_CRONOGRAMA: PrazoBadgeInfo = { label: 'sem cronograma', color: '#8a8a8a', bg: '#8a8a8a1a', border: '#8a8a8a4d' }
const PRAZO_NO_PRAZO: PrazoBadgeInfo = { label: 'no prazo', color: '#22c55e', bg: '#22c55e1a', border: '#22c55e4d' }

function diffDias(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime()
  const db = new Date(b + 'T00:00:00').getTime()
  return Math.round((da - db) / 86_400_000)
}

function fmtDateBrCurto(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/**
 * Baseline oficial de data-fim planejada do núcleo (CRONOGRAMA_MACRO), pega o
 * maior valor entre os agregados (água/esgoto) do núcleo — não há vínculo
 * direto equipe→sistema neste nível, então usamos o fim mais distante do
 * núcleo como referência honesta. `null` quando o núcleo não tem baseline.
 */
function getDataFimPlanejadaNucleo(nucleoAlvo: string, aggregates: MasterAggregate[]): string | null {
  const datas = aggregates
    .filter((a) => a.nucleo === nucleoAlvo)
    .map((a) => a.dataFimPlanejada)
    .filter((d): d is string => !!d)
  if (datas.length === 0) return null
  return datas.sort().at(-1)!
}

/**
 * Determina o badge de prazo de uma equipe a partir do cronograma REAL dela
 * (`EquipeCronograma.dataFim`, casado por `equipeId` — id canônico, não mais
 * por nome de líder). Nunca lança — qualquer dado faltante cai em fallback
 * honesto (nunca inventa número):
 *  - sem trabalho atribuído ainda            → "sem cronograma" (cinza)
 *  - com dataFim mas núcleo sem baseline      → "fim: dd/mm" (cinza, informativo)
 *  - com dataFim e baseline, dataFim <= base  → "no prazo" (verde)
 *  - com dataFim e baseline, dataFim > base   → "atrasado Xd" (vermelho)
 */
function computePrazoBadgeEquipe(
  equipe: EquipeState,
  cronogramasPorEquipe: EquipeCronograma[],
  aggregates: MasterAggregate[],
): PrazoBadgeInfo {
  const cronograma = cronogramasPorEquipe.find((c) => c.equipeId === equipe.id)
  if (!cronograma || !cronograma.dataFim) return PRAZO_SEM_CRONOGRAMA

  const nucleoAlvo = FRENTE_TO_NUCLEO[equipe.frente]
  const dataFimPlanejada = getDataFimPlanejadaNucleo(nucleoAlvo, aggregates)
  if (!dataFimPlanejada) {
    return { label: `fim: ${fmtDateBrCurto(cronograma.dataFim)}`, color: '#a3a3a3', bg: '#a3a3a31a', border: '#a3a3a34d' }
  }

  const delta = diffDias(cronograma.dataFim, dataFimPlanejada)
  if (delta > 0) return { label: `atrasado ${delta}d`, color: '#ef4444', bg: '#ef44441a', border: '#ef44444d' }
  return PRAZO_NO_PRAZO
}

function PrazoBadge({ info }: { info: PrazoBadgeInfo }) {
  return (
    <span
      className="text-[9px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5"
      style={{ color: info.color, backgroundColor: info.bg, border: `1px solid ${info.border}` }}
      title="Prazo da equipe: data-fim do cronograma atribuído a ela × baseline planejada do núcleo"
    >
      {info.label}
    </span>
  )
}

const COL_META: Record<EquipeStatus, { accent: string; icon: React.ReactNode; hint: string }> = {
  planejado: { accent: '#38bdf8', icon: <Sunrise size={13} />, hint: 'o que você definiu de manhã' },
  em_campo:  { accent: '#f97316', icon: <HardHat size={13} />, hint: 'executando agora' },
  concluido: { accent: '#22c55e', icon: <CheckCircle2 size={13} />, hint: 'fechou o dia' },
  desvio:    { accent: '#ef4444', icon: <AlertTriangle size={13} />, hint: 'mudou sem combinar / deu ruim' },
}

// ─── Pessoa (chip arrastável + editável) ─────────────────────────────────────

function PessoaChip({ p, onEditTarefa, onEditFuncao }: {
  p: PessoaState
  onEditTarefa: (p: PessoaState) => void
  onEditFuncao: (p: PessoaState) => void
}) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData('text/plain', `pessoa:${p.id}`); e.dataTransfer.effectAllowed = 'move' }}
      className="group/p flex flex-col gap-0.5 rounded-md border border-[#525252]/70 bg-[#333333] px-2 py-1.5 cursor-grab active:cursor-grabbing hover:border-[#38bdf8]/60"
      title="Arraste para outra equipe ou para o Banco"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[11px] text-[#e5e5e5] font-medium truncate">{p.nome}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onEditFuncao(p) }}
          className="ml-auto shrink-0 text-[9px] uppercase tracking-wide text-[#8a8a8a] bg-[#2a2a2a] border border-[#3f3f3f] rounded px-1.5 py-0.5 hover:text-[#f5f5f5] hover:border-[#f97316]/60"
          title="Clique para editar a função"
        >
          {p.funcao}
        </button>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onEditTarefa(p) }}
        className="flex items-center gap-1 text-left text-[10px] leading-snug hover:text-[#f5f5f5]"
        title="Clique para definir o que essa pessoa vai fazer hoje"
      >
        <Pencil size={9} className="shrink-0 text-[#6b6b6b] group-hover/p:text-[#f97316]" />
        {p.tarefa
          ? <span className="text-[#facc15] italic">{p.tarefa}</span>
          : <span className="text-[#6b6b6b] italic">definir tarefa de hoje…</span>}
      </button>
    </div>
  )
}

// ─── Equipamento (chip arrastável) ───────────────────────────────────────────

function EquipChip({ eq }: { eq: EquipamentoState }) {
  return (
    <span
      draggable
      onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData('text/plain', `equip:${eq.id}`); e.dataTransfer.effectAllowed = 'move' }}
      className="inline-flex items-center gap-1 text-[10px] text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded px-1.5 py-0.5 cursor-grab active:cursor-grabbing hover:border-[#fbbf24]/70"
      title="Arraste para outra equipe ou para o Pátio"
    >
      🚜 {eq.nome}
    </span>
  )
}

// ─── Card da equipe ──────────────────────────────────────────────────────────

function EquipeCardBox({ equipe, pessoas, equipamentos, prazoBadge, onDragStartCard, onDropInto, onEditTarefa, onEditFuncao, onEditLocal, onEditFoco, onEditEquipe }: {
  equipe: EquipeState
  pessoas: PessoaState[]
  equipamentos: EquipamentoState[]
  prazoBadge?: PrazoBadgeInfo | null
  onDragStartCard: (id: string) => void
  onDropInto: (equipeId: string, payload: string) => void
  onEditTarefa: (p: PessoaState) => void
  onEditFuncao: (p: PessoaState) => void
  onEditLocal: (e: EquipeState) => void
  onEditFoco: (e: EquipeState) => void
  onEditEquipe: (e: EquipeState) => void
}) {
  const [expandido, setExpandido] = useState(true)
  const [isOver, setIsOver] = useState(false)
  const isDesvio = equipe.status === 'desvio'
  const frente = FRENTE_META[equipe.frente]

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', `card:${equipe.id}`); e.dataTransfer.effectAllowed = 'move'; onDragStartCard(equipe.id) }}
      onDragOver={(e) => {
        // aceita pessoa/equip largados dentro do card
        e.preventDefault(); e.stopPropagation(); setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        const payload = e.dataTransfer.getData('text/plain')
        if (payload.startsWith('pessoa:') || payload.startsWith('equip:')) {
          e.preventDefault(); e.stopPropagation()
          onDropInto(equipe.id, payload)
        }
        setIsOver(false)
      }}
      className={[
        'rounded-lg border p-3 cursor-grab active:cursor-grabbing transition-colors',
        isDesvio ? 'bg-[#3a2523] border-[#ef4444]/50' : 'bg-[#3f3f3f] border-[#525252]',
        isOver ? 'border-[#38bdf8] bg-[#31383d]' : '',
      ].join(' ')}
      style={{ borderLeftWidth: 3, borderLeftColor: frente.cor }}
    >
      {/* header do card */}
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-[#6b6b6b] mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-[#f5f5f5] leading-tight">{equipe.nome}</span>
            {equipe.aContratar && (
              <span className="text-[9px] font-bold uppercase text-[#a78bfa] bg-[#a78bfa]/10 border border-[#a78bfa]/40 rounded px-1.5 py-0.5">a contratar</span>
            )}
            {prazoBadge && <PrazoBadge info={prazoBadge} />}
            <button
              onClick={(e) => { e.stopPropagation(); onEditEquipe(equipe) }}
              className="ml-auto shrink-0 text-[#6b6b6b] hover:text-[#38bdf8]"
              title="Editar equipe (nome, líder, frente, foco, membros)"
            >
              <Pencil size={12} />
            </button>
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: frente.cor }}>{frente.label} · enc. {equipe.encarregado}</div>

          <button onClick={(e) => { e.stopPropagation(); onEditFoco(equipe) }} className="block text-left text-xs text-[#d4d4d4] mt-1.5 leading-snug hover:text-[#f5f5f5]" title="Clique para editar o serviço da equipe">
            🛠️ {equipe.foco}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEditLocal(equipe) }} className="block text-left text-[10px] text-[#8a8a8a] mt-0.5 hover:text-[#f5f5f5]" title="Clique para editar a rua/local do dia">
            📍 {equipe.local === '—' ? 'definir rua/local…' : equipe.local}
          </button>

          {isDesvio && equipe.motivoDesvio && (
            <div className="mt-2 text-[11px] text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/30 rounded px-2 py-1 leading-snug">
              ⚠️ {equipe.motivoDesvio}
            </div>
          )}

          {/* equipamentos da equipe */}
          {equipamentos.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {equipamentos.map((eq) => <EquipChip key={eq.id} eq={eq} />)}
            </div>
          )}

          {/* pessoas */}
          <button
            onClick={(e) => { e.stopPropagation(); setExpandido((v) => !v) }}
            className="mt-2 flex items-center gap-1 text-[10px] text-[#7a7a7a] hover:text-[#d4d4d4] transition-colors"
          >
            {expandido ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            👥 {pessoas.length} pessoa{pessoas.length !== 1 ? 's' : ''}
          </button>
          {expandido && (
            <div className="mt-1.5 flex flex-col gap-1">
              {pessoas.length === 0 ? (
                <div className="text-[10px] text-[#6b6b6b] italic border border-dashed border-[#525252] rounded px-2 py-1.5 text-center">
                  solte pessoas aqui
                </div>
              ) : (
                pessoas.map((p) => (
                  <PessoaChip key={p.id} p={p} onEditTarefa={onEditTarefa} onEditFuncao={onEditFuncao} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modal de criar/editar equipe (definição canônica em wcr_equipes/equipe_membros) ──

interface EquipeModalProps {
  equipeDef: EquipeDef | null // null = criar nova equipe
  todasEquipes: EquipeDef[]
  onClose: () => void
  onCriar: (input: NovaEquipeInput) => Promise<string>
  onAtualizar: (id: string, patch: Partial<Pick<EquipeDef, 'equipe' | 'lider' | 'encarregado' | 'foco' | 'frente' | 'aContratar'>>) => Promise<void>
  onRemover: (id: string) => Promise<void>
  onAdicionarMembro: (equipeId: string, membro: { nome: string; funcao: string }) => Promise<void>
  onRemoverMembro: (membroId: string) => Promise<void>
  onMoverMembro: (membroId: string, novaEquipeId: string) => Promise<void>
}

function EquipeModal({
  equipeDef, todasEquipes, onClose, onCriar, onAtualizar, onRemover, onAdicionarMembro, onRemoverMembro, onMoverMembro,
}: EquipeModalProps) {
  const isEdit = equipeDef !== null
  const [nome, setNome] = useState(equipeDef?.equipe ?? '')
  const [lider, setLider] = useState(equipeDef?.lider ?? '')
  const [encarregado, setEncarregado] = useState(equipeDef?.encarregado ?? '')
  const [frente, setFrente] = useState<FrenteId>(equipeDef?.frente ?? 'sul')
  const [foco, setFoco] = useState(equipeDef?.foco ?? '')
  const [aContratar, setAContratar] = useState(!!equipeDef?.aContratar)
  const [novoMembroNome, setNovoMembroNome] = useState('')
  const [novoMembroFuncao, setNovoMembroFuncao] = useState('')
  const [salvando, setSalvando] = useState(false)

  const inputCls = 'rounded-md bg-[#2a2a2a] border border-[#3f3f3f] px-2 py-1.5 text-[12px] text-[#f5f5f5] focus:outline-none focus:border-[#38bdf8]/60'

  const salvar = async () => {
    if (!nome.trim() || !lider.trim()) return
    setSalvando(true)
    try {
      if (isEdit && equipeDef) {
        await onAtualizar(equipeDef.id, {
          equipe: nome.trim(), lider: lider.trim(), encarregado: encarregado.trim(), foco: foco.trim(), frente, aContratar,
        })
      } else {
        await onCriar({ equipe: nome.trim(), lider: lider.trim(), encarregado: encarregado.trim(), foco: foco.trim(), frente, aContratar })
        onClose()
      }
    } finally {
      setSalvando(false)
    }
  }

  const remover = async () => {
    if (!equipeDef) return
    if (!confirm(`Remover ${equipeDef.equipe}? Isso também remove os membros dela do organograma.`)) return
    await onRemover(equipeDef.id)
    onClose()
  }

  const adicionarMembro = async () => {
    if (!equipeDef || !novoMembroNome.trim()) return
    await onAdicionarMembro(equipeDef.id, { nome: novoMembroNome.trim(), funcao: novoMembroFuncao.trim() || 'ajudante' })
    setNovoMembroNome('')
    setNovoMembroFuncao('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-[#3f3f3f] bg-[#333333] p-5 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#f5f5f5]">{isEdit ? `Editar ${equipeDef?.equipe}` : 'Nova equipe'}</h2>
          <button onClick={onClose} className="text-[#8a8a8a] hover:text-[#f5f5f5]"><X size={16} /></button>
        </div>

        <label className="flex flex-col gap-1 text-[11px] text-[#8a8a8a]">
          Nome da equipe
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} placeholder="Equipe Fulano" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-[#8a8a8a]">
          Líder
          <input value={lider} onChange={(e) => setLider(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-[#8a8a8a]">
          Encarregado
          <input value={encarregado} onChange={(e) => setEncarregado(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-[#8a8a8a]">
          Frente
          <select value={frente} onChange={(e) => setFrente(e.target.value as FrenteId)} className={inputCls}>
            {(Object.keys(FRENTE_META) as FrenteId[]).map((f) => (
              <option key={f} value={f}>{FRENTE_META[f].label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-[#8a8a8a]">
          Foco / serviço
          <input value={foco} onChange={(e) => setFoco(e.target.value)} className={inputCls} />
        </label>
        <label className="flex items-center gap-2 text-[11px] text-[#8a8a8a]">
          <input type="checkbox" checked={aContratar} onChange={(e) => setAContratar(e.target.checked)} />
          a contratar
        </label>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={salvar}
            disabled={salvando || !nome.trim() || !lider.trim()}
            className="flex-1 text-[12px] font-semibold text-[#f5f5f5] bg-[#38bdf8]/20 border border-[#38bdf8]/60 rounded-md px-3 py-2 hover:bg-[#38bdf8]/30 disabled:opacity-50"
          >
            {isEdit ? 'Salvar alterações' : 'Criar equipe'}
          </button>
          {isEdit && (
            <button onClick={remover} className="text-[12px] text-[#ef4444] border border-[#ef4444]/40 rounded-md px-3 py-2 hover:bg-[#ef4444]/10" title="Remover equipe">
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {isEdit && equipeDef && (
          <div className="mt-2 border-t border-[#3f3f3f] pt-3 flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#8a8a8a]">Membros ({equipeDef.membros.length})</span>
            <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
              {equipeDef.membros.map((m) => (
                <div key={m.id ?? m.nome} className="flex items-center gap-1.5 bg-[#2a2a2a] border border-[#3f3f3f] rounded-md px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-[#e5e5e5] truncate">{m.nome}</div>
                    <div className="text-[9px] text-[#6b6b6b]">{m.funcao}</div>
                  </div>
                  {m.id && todasEquipes.length > 1 && (
                    <select
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) onMoverMembro(m.id as string, e.target.value) }}
                      className="text-[9px] bg-[#333333] border border-[#3f3f3f] rounded px-1 py-0.5 text-[#8a8a8a]"
                      title="Mover para outra equipe"
                    >
                      <option value="">mover…</option>
                      {todasEquipes.filter((e) => e.id !== equipeDef.id).map((e) => (
                        <option key={e.id} value={e.id}>{e.equipe}</option>
                      ))}
                    </select>
                  )}
                  {m.id && (
                    <button onClick={() => onRemoverMembro(m.id as string)} className="text-[#8a8a8a] hover:text-[#ef4444]" title="Remover membro">
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input value={novoMembroNome} onChange={(e) => setNovoMembroNome(e.target.value)} placeholder="Nome" className={`flex-1 min-w-0 ${inputCls}`} />
              <input value={novoMembroFuncao} onChange={(e) => setNovoMembroFuncao(e.target.value)} placeholder="Função" className={`w-24 ${inputCls}`} />
              <button onClick={adicionarMembro} disabled={!novoMembroNome.trim()} className="text-[#38bdf8] hover:text-[#7dd3fc] disabled:opacity-40" title="Adicionar membro">
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Compilação do resumo diário (RDO) ───────────────────────────────────────

function compilarResumo(date: string, equipes: EquipeState[], pessoas: PessoaState[], equipamentos: EquipamentoState[]): string {
  const dataBr = date.split('-').reverse().join('/')
  const pessoasDe = (eqId: string) => pessoas.filter((p) => p.equipeId === eqId)
  const equipsDe = (eqId: string) => equipamentos.filter((e) => e.equipeId === eqId)

  const linhaEquipe = (e: EquipeState) => {
    const ps = pessoasDe(e.id)
    const eqs = equipsDe(e.id)
    let out = `- ${e.nome} (${ps.length}p, enc. ${e.encarregado}): ${e.foco}${e.local !== '—' ? ` — ${e.local}` : ''}`
    if (eqs.length) out += `\n  Máquinas: ${eqs.map((x) => x.nome).join(', ')}`
    const comTarefa = ps.filter((p) => p.tarefa)
    if (comTarefa.length) out += comTarefa.map((p) => `\n  · ${p.nome}: ${p.tarefa}`).join('')
    if (e.status === 'desvio' && e.motivoDesvio) out += `\n  MOTIVO DO DESVIO: ${e.motivoDesvio}`
    return out
  }

  const bloco = (status: EquipeStatus, titulo: string) => {
    const list = equipes.filter((e) => e.status === status)
    return list.length ? `${titulo}\n${list.map(linhaEquipe).join('\n')}\n\n` : ''
  }

  const emCampo = pessoas.filter((p) => p.equipeId !== null && !equipes.find((e) => e.id === p.equipeId)?.aContratar).length
  const banco = pessoas.filter((p) => p.equipeId === null)
  const patio = equipamentos.filter((e) => e.equipeId === null)
  const desvios = equipes.filter((e) => e.status === 'desvio').length

  let extra = ''
  if (banco.length) extra += `🪑 BANCO (sem equipe hoje): ${banco.map((p) => p.nome).join(', ')}\n`
  if (patio.length) extra += `🅿️ PÁTIO (máquinas sem alocação): ${patio.map((e) => e.nome).join(', ')}\n`

  return (
    `RESUMO DO DIA — ${dataBr} (WCR · 13.546/25-00)\n` +
    `Efetivo em campo: ${emCampo} pessoas · Desvios: ${desvios}\n\n` +
    bloco('concluido', '✅ CONCLUÍDO') +
    bloco('em_campo', '🚧 EM CAMPO') +
    bloco('desvio', '⚠️ DESVIOS') +
    bloco('planejado', '🌅 NÃO INICIADO / PLANEJADO') +
    extra
  ).trimEnd()
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function EquipesKanbanPage() {
  const { date, equipes, pessoas, equipamentos, moveEquipe, updateEquipe, movePessoa, updatePessoa, moveEquipamento, novoDia, resetOrganograma, setDefinicoes } = useEquipesKanbanStore()
  const [draggingCard, setDraggingCard] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<EquipeStatus | 'banco' | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [modalAberto, setModalAberto] = useState<'nova' | string | null>(null)

  // Definição canônica das equipes (nome/líder/frente/foco/membros) vem do
  // Supabase (wcr_equipes/equipe_membros) via useEquipes — com cache
  // gracioso e fallback em WCR_EQUIPES, então nunca fica vazio. O status
  // diário/drag continua 100% no equipesKanbanStore (localStorage); aqui só
  // sincronizamos a DEFINIÇÃO base sempre que ela mudar (load inicial, CRUD).
  const equipesHook = useEquipes()
  useEffect(() => {
    setDefinicoes(equipesHook.equipes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipesHook.equipes])

  // Motor de cronograma (badge de prazo) — puramente aditivo: se os hooks
  // falharem/carregarem/vierem vazios (Modo Demo, Supabase fora, projeto sem
  // dados), o kanban continua 100% funcional e só deixa de mostrar o badge.
  // `engine` (useMasterScheduleEngine) dá a baseline planejada por núcleo;
  // `cron` (useCronogramaEquipe, M4) dá a data-fim REAL por equipe (id
  // canônico) — é essa a fonte nova do badge (M6).
  const { activeProjectId } = useProjectContext()
  const engine = useMasterScheduleEngine(activeProjectId)
  const cron = useCronogramaEquipe(activeProjectId)
  const navigate = useNavigate()

  const prazoPorEquipe = useMemo(() => {
    const map = new Map<string, PrazoBadgeInfo>()
    if (cron.loading || cron.error) return map
    for (const equipe of equipes) {
      try {
        map.set(equipe.id, computePrazoBadgeEquipe(equipe, cron.cronogramasPorEquipe, engine.aggregates))
      } catch {
        map.set(equipe.id, PRAZO_SEM_CRONOGRAMA)
      }
    }
    return map
  }, [equipes, cron.cronogramasPorEquipe, cron.loading, cron.error, engine.aggregates])

  function irParaCronograma() {
    usePlanejamentoMestreStore.getState().setActiveTab('por-equipe')
    navigate('/app/planejamento-mestre')
  }

  const desvios = equipes.filter((e) => e.status === 'desvio').length
  const concluidas = equipes.filter((e) => e.status === 'concluido').length
  const banco = pessoas.filter((p) => p.equipeId === null)
  const patio = equipamentos.filter((e) => e.equipeId === null)

  const dropIntoEquipe = (equipeId: string, payload: string) => {
    if (payload.startsWith('pessoa:')) movePessoa(payload.slice(7), equipeId)
    else if (payload.startsWith('equip:')) moveEquipamento(payload.slice(6), equipeId)
  }

  const dropIntoColuna = (status: EquipeStatus, payload: string) => {
    if (!payload.startsWith('card:')) return
    const id = payload.slice(5)
    if (status === 'desvio') {
      const motivo = window.prompt('O que o encarregado mudou / o que deu ruim?') ?? ''
      moveEquipe(id, status, motivo)
    } else {
      moveEquipe(id, status)
    }
    setDraggingCard(null)
    setOverCol(null)
  }

  const dropIntoBanco = (payload: string) => {
    if (payload.startsWith('pessoa:')) movePessoa(payload.slice(7), null)
    else if (payload.startsWith('equip:')) moveEquipamento(payload.slice(6), null)
    setOverCol(null)
  }

  const editTarefa = (p: PessoaState) => {
    const t = window.prompt(`O que ${p.nome.split(' ')[0]} vai fazer hoje?`, p.tarefa ?? '')
    if (t !== null) updatePessoa(p.id, { tarefa: t.trim() || undefined })
  }
  const editFuncao = (p: PessoaState) => {
    const f = window.prompt(`Função de ${p.nome.split(' ')[0]}:`, p.funcao)
    if (f !== null && f.trim()) updatePessoa(p.id, { funcao: f.trim() })
  }
  const editLocal = (e: EquipeState) => {
    const l = window.prompt(`Rua/local de hoje da ${e.nome}:`, e.local === '—' ? '' : e.local)
    if (l !== null) updateEquipe(e.id, { local: l.trim() || '—' })
  }
  const editFoco = (e: EquipeState) => {
    // foco agora é campo de definição (wcr_equipes.foco) — grava direto no
    // banco via useEquipes; o resync (setDefinicoes) reflete no card.
    const f = window.prompt(`Serviço da ${e.nome}:`, e.foco)
    if (f !== null && f.trim()) equipesHook.atualizarEquipe(e.id, { foco: f.trim() })
  }
  const editEquipe = (e: EquipeState) => setModalAberto(e.id)

  const copiarResumo = async () => {
    const texto = compilarResumo(date, equipes, pessoas, equipamentos)
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      window.prompt('Copie o resumo abaixo:', texto)
    }
  }

  const dataBr = date.split('-').reverse().join('/')

  return (
    <div className="h-full flex flex-col bg-[#2a2a2a]">
      {/* header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252] bg-[#333333] shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#38bdf8]/15">
            <Users size={18} className="text-[#38bdf8]" />
          </div>
          <div>
            <h1 className="text-[#f5f5f5] font-bold text-base leading-tight">Quadro de Equipes — {dataBr}</h1>
            <p className="text-[#6b6b6b] text-xs">Arraste equipes entre colunas · pessoas e máquinas entre equipes · clique pra editar função, tarefa, serviço e rua</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {desvios > 0 && (
            <span className="text-[11px] font-bold text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-full px-3 py-1">
              ⚠️ {desvios} desvio{desvios > 1 ? 's' : ''} hoje
            </span>
          )}
          <span className="text-[11px] text-[#8a8a8a]">{concluidas}/{equipes.length} concluídas</span>
          <button
            onClick={irParaCronograma}
            className="flex items-center gap-1.5 text-[11px] text-[#a78bfa] hover:text-[#c4b5fd] px-3 py-2 rounded-md border border-[#a78bfa]/40 hover:border-[#a78bfa]/70 bg-[#a78bfa]/5 hover:bg-[#a78bfa]/10 transition-colors"
            title="Ir para a aba 'Por Equipe' do Plan. Mestre e atribuir trabalho a estas equipes"
          >
            <CalendarClock size={12} /> Montar cronograma <ArrowRight size={11} />
          </button>
          <button
            onClick={() => setModalAberto('nova')}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[#f5f5f5] bg-[#38bdf8]/10 border border-[#38bdf8]/50 rounded-md px-3 py-2 hover:bg-[#38bdf8]/20 transition-colors"
          >
            <Plus size={12} /> Nova equipe
          </button>
          <button
            onClick={copiarResumo}
            className={[
              'flex items-center gap-1.5 text-[11px] font-semibold px-3 py-2 rounded-md border transition-colors',
              copiado
                ? 'text-[#22c55e] border-[#22c55e]/50 bg-[#22c55e]/10'
                : 'text-[#f5f5f5] border-[#f97316]/60 bg-[#f97316]/10 hover:bg-[#f97316]/20',
            ].join(' ')}
          >
            <ClipboardCopy size={12} /> {copiado ? 'Copiado!' : 'Copiar resumo do dia (RDO)'}
          </button>
          <button
            onClick={() => { if (confirm('Novo dia? Status e tarefas zeram; a composição das equipes fica.')) novoDia() }}
            className="flex items-center gap-1.5 text-[11px] text-[#8a8a8a] hover:text-[#f5f5f5] px-3 py-2 rounded-md border border-[#3f3f3f] hover:border-[#525252] transition-colors"
          >
            <RotateCcw size={12} /> Novo dia
          </button>
          <button
            onClick={() => { if (confirm('Restaurar TUDO ao organograma original? (desfaz remanejamentos de pessoas e máquinas)')) resetOrganograma() }}
            className="text-[11px] text-[#6b6b6b] hover:text-[#ef4444] px-2 py-2 transition-colors"
            title="Voltar ao organograma oficial"
          >
            restaurar organograma
          </button>
        </div>
      </div>

      {/* corpo: banco/pátio + colunas */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4">
        <div className="flex gap-4 h-full min-h-0">

          {/* Banco & Pátio */}
          <div
            onDragOver={(e) => { e.preventDefault(); setOverCol('banco') }}
            onDragLeave={() => setOverCol((c) => (c === 'banco' ? null : c))}
            onDrop={(e) => { e.preventDefault(); dropIntoBanco(e.dataTransfer.getData('text/plain')) }}
            className={[
              'flex-shrink-0 w-[210px] flex flex-col rounded-xl border bg-[#2f2f2f] transition-colors',
              overCol === 'banco' ? 'border-[#a78bfa]' : 'border-[#3f3f3f] border-dashed',
            ].join(' ')}
          >
            <div className="px-3 py-3 border-b border-[#3f3f3f]">
              <div className="flex items-center gap-2">
                <UserX size={13} className="text-[#a78bfa]" />
                <span className="text-xs font-bold uppercase tracking-wide text-[#a78bfa]">Banco / Pátio</span>
              </div>
              <div className="text-[10px] text-[#6b6b6b] mt-1">faltou, remanejando, máquina parada — solte aqui</div>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
              {patio.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-wide text-[#6b6b6b] flex items-center gap-1"><Truck size={10} /> máquinas ({patio.length})</span>
                  <div className="flex flex-wrap gap-1">{patio.map((eq) => <EquipChip key={eq.id} eq={eq} />)}</div>
                </div>
              )}
              <div className="flex flex-col gap-1 mt-1">
                <span className="text-[9px] uppercase tracking-wide text-[#6b6b6b]">pessoas ({banco.length})</span>
                {banco.length === 0 ? (
                  <div className="text-[10px] text-[#6b6b6b] italic text-center py-3 border border-dashed border-[#3f3f3f] rounded">ninguém no banco</div>
                ) : (
                  banco.map((p) => <PessoaChip key={p.id} p={p} onEditTarefa={editTarefa} onEditFuncao={editFuncao} />)
                )}
              </div>
            </div>
          </div>

          {/* Colunas de status */}
          {EQUIPE_STATUS_ORDER.map((status) => {
            const meta = COL_META[status]
            const colEquipes = equipes.filter((e) => e.status === status)
            const isOver = overCol === status
            return (
              <div
                key={status}
                onDragOver={(e) => { e.preventDefault(); setOverCol(status) }}
                onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
                onDrop={(e) => { e.preventDefault(); dropIntoColuna(status, e.dataTransfer.getData('text/plain')) }}
                className={[
                  'flex-shrink-0 w-[320px] flex flex-col rounded-xl border bg-[#333333] transition-colors',
                  isOver && draggingCard ? 'border-[#f97316] bg-[#3a3632]' : 'border-[#3f3f3f]',
                ].join(' ')}
              >
                <div className="px-3 py-3 border-b border-[#3f3f3f]">
                  <div className="flex items-center gap-2">
                    <span style={{ color: meta.accent }}>{meta.icon}</span>
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.accent }}>{EQUIPE_STATUS_LABEL[status]}</span>
                    <span className="ml-auto text-[10px] text-[#8a8a8a] bg-[#2a2a2a] border border-[#3f3f3f] rounded-full px-2 py-0.5">{colEquipes.length}</span>
                  </div>
                  <div className="text-[10px] text-[#6b6b6b] mt-1">{meta.hint}</div>
                </div>
                <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5 min-h-[120px]">
                  {colEquipes.length === 0 ? (
                    <div className="text-[11px] text-[#6b6b6b] text-center py-6 border border-dashed border-[#3f3f3f] rounded-lg">
                      {isOver ? 'Solte aqui' : 'vazio'}
                    </div>
                  ) : (
                    colEquipes.map((equipe) => (
                      <EquipeCardBox
                        key={equipe.id}
                        equipe={equipe}
                        pessoas={pessoas.filter((p) => p.equipeId === equipe.id)}
                        equipamentos={equipamentos.filter((x) => x.equipeId === equipe.id)}
                        prazoBadge={prazoPorEquipe.get(equipe.id)}
                        onDragStartCard={setDraggingCard}
                        onDropInto={dropIntoEquipe}
                        onEditTarefa={editTarefa}
                        onEditFuncao={editFuncao}
                        onEditLocal={editLocal}
                        onEditFoco={editFoco}
                        onEditEquipe={editEquipe}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {modalAberto !== null && (
        <EquipeModal
          equipeDef={modalAberto === 'nova' ? null : equipesHook.equipes.find((e) => e.id === modalAberto) ?? null}
          todasEquipes={equipesHook.equipes}
          onClose={() => setModalAberto(null)}
          onCriar={equipesHook.criarEquipe}
          onAtualizar={equipesHook.atualizarEquipe}
          onRemover={equipesHook.removerEquipe}
          onAdicionarMembro={equipesHook.adicionarMembro}
          onRemoverMembro={equipesHook.removerMembro}
          onMoverMembro={equipesHook.moverMembro}
        />
      )}
    </div>
  )
}
