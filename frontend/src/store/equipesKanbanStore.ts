/**
 * Kanban de Equipes WCR v3 — quadro de montagem diária da operação.
 * - Equipes movem entre status (planejado/em campo/concluído/desvio)
 * - PESSOAS movem entre equipes (e pro Banco), com função e tarefa editáveis
 * - EQUIPAMENTOS (frota ativa) movem entre equipes (e pro Pátio)
 * Composição persiste entre dias; status/tarefas resetam no "Novo dia".
 */
import { create } from 'zustand'
import { WCR_EQUIPES, type EquipeCard, type EquipeStatus, type FrenteId } from '@/data/wcrEquipes'
import { WCR_FROTA } from '@/data/wcrFrota'

const STORAGE_KEY = 'wcr-equipes-kanban-v3'

export interface PessoaState {
  id: string
  nome: string
  funcao: string
  equipeId: string | null   // null = Banco (sem equipe / faltou)
  tarefa?: string           // o que vai fazer hoje
}

export interface EquipamentoState {
  id: string
  nome: string
  equipeId: string | null   // null = Pátio
}

export interface EquipeState {
  id: string
  nome: string
  lider: string
  encarregado: string
  frente: FrenteId
  foco: string
  local: string
  aContratar?: boolean
  status: EquipeStatus
  motivoDesvio?: string
}

function slug(nome: string): string {
  return nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Base vem, por padrão, da constante estática WCR_EQUIPES (garante que o
// Kanban nunca abre vazio). Quando `useEquipes()` (Supabase) resolve, a
// página chama `setDefinicoes(equipes)` para trocar a base pela definição
// canônica do banco — preservando status/composição do dia via merge.
function basePessoas(equipesData: EquipeCard[] = WCR_EQUIPES): PessoaState[] {
  return equipesData.flatMap((eq) =>
    eq.membros.map((m) => ({ id: slug(m.nome), nome: m.nome, funcao: m.funcao, equipeId: eq.id })),
  )
}

function baseEquipes(equipesData: EquipeCard[] = WCR_EQUIPES): EquipeState[] {
  return equipesData.map((eq) => ({
    id: eq.id, nome: eq.equipe, lider: eq.lider, encarregado: eq.encarregado,
    frente: eq.frente, foco: eq.foco, local: eq.local, aContratar: eq.aContratar, status: 'planejado' as EquipeStatus,
  }))
}

// ─── Merge genérico: aplica um "fresh" (nova definição/organograma) sobre um
// estado já existente (localStorage do dia OU estado atual em memória),
// preservando status/posição do dia conforme as mesmas regras de sempre.
// IMPORTANTE: `foco` agora é campo de DEFINIÇÃO (vem do useEquipes/Supabase,
// editável via modal) — sempre usa o valor fresh, nunca o salvo localmente,
// senão uma edição no banco fica "presa" atrás do localStorage do dia. Só
// `local` (rua/trecho do dia) continua sendo estado diário de verdade. ──
function mergeEquipesState(fresh: EquipeState[], saved: Map<string, Partial<EquipeState>>, sameDay: boolean): EquipeState[] {
  return fresh.map((e) => {
    const s = saved.get(e.id)
    if (!s) return e
    return {
      ...e,
      local: s.local ?? e.local,
      status: sameDay ? ((s.status as EquipeStatus) ?? 'planejado') : 'planejado',
      motivoDesvio: sameDay ? s.motivoDesvio : undefined,
    }
  })
}

function mergePessoasState(fresh: PessoaState[], saved: Map<string, Partial<PessoaState>>, sameDay: boolean): PessoaState[] {
  return fresh.map((p) => {
    const s = saved.get(p.id)
    if (!s) return p
    return {
      ...p,
      funcao: s.funcao ?? p.funcao,
      equipeId: s.equipeId !== undefined ? s.equipeId : p.equipeId,
      tarefa: sameDay ? s.tarefa : undefined,
    }
  })
}

function baseEquipamentos(): EquipamentoState[] {
  return WCR_FROTA.filter((f) => f.status !== 'devolvido').map((f) => ({
    id: f.id,
    nome: f.placa !== '—' ? `${f.tipo.split(' ').slice(0, 2).join(' ')} ${f.placa}` : f.tipo,
    equipeId: null,
  }))
}

interface Persisted {
  date: string
  equipes: Partial<EquipeState>[]
  pessoas: Partial<PessoaState>[]
  equipamentos: Partial<EquipamentoState>[]
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function hydrate(): { date: string; equipes: EquipeState[]; pessoas: PessoaState[]; equipamentos: EquipamentoState[] } {
  const fresh = { date: today(), equipes: baseEquipes(), pessoas: basePessoas(), equipamentos: baseEquipamentos() }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fresh
    const saved = JSON.parse(raw) as Persisted
    const sameDay = saved.date === today()
    const eqById = new Map(saved.equipes?.map((e) => [e.id, e]))
    const pById = new Map(saved.pessoas?.map((p) => [p.id, p]))
    const eqpById = new Map(saved.equipamentos?.map((e) => [e.id, e]))
    return {
      date: today(),
      // status/motivo só valem no mesmo dia; local (rua/trecho) persiste sempre
      equipes: mergeEquipesState(fresh.equipes, eqById, sameDay),
      // alocação de pessoas/função persiste sempre; tarefa do dia só no mesmo dia
      pessoas: mergePessoasState(fresh.pessoas, pById, sameDay),
      equipamentos: fresh.equipamentos.map((e) => {
        const s = eqpById.get(e.id)
        return s ? { ...e, equipeId: s.equipeId !== undefined ? s.equipeId : e.equipeId } : e
      }),
    }
  } catch {
    return fresh
  }
}

function persist(state: { date: string; equipes: EquipeState[]; pessoas: PessoaState[]; equipamentos: EquipamentoState[] }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: state.date,
      equipes: state.equipes.map((e) => ({ id: e.id, status: e.status, motivoDesvio: e.motivoDesvio, local: e.local })),
      pessoas: state.pessoas.map((p) => ({ id: p.id, funcao: p.funcao, equipeId: p.equipeId, tarefa: p.tarefa })),
      equipamentos: state.equipamentos.map((e) => ({ id: e.id, equipeId: e.equipeId })),
    }))
  } catch {
    // segue em memória
  }
}

interface EquipesKanbanState {
  date: string
  equipes: EquipeState[]
  pessoas: PessoaState[]
  equipamentos: EquipamentoState[]
  // última definição canônica conhecida (do useEquipes/Supabase, ou WCR_EQUIPES
  // como fallback) — usada por setDefinicoes/resetOrganograma.
  equipesDef: EquipeCard[]

  moveEquipe: (id: string, status: EquipeStatus, motivoDesvio?: string) => void
  // só `local` (rua/trecho do dia) — `foco` virou campo de definição (ver
  // useEquipes/wcr_equipes), editado via EquipeModal, não mais por aqui.
  updateEquipe: (id: string, patch: Partial<Pick<EquipeState, 'local'>>) => void

  movePessoa: (pessoaId: string, equipeId: string | null) => void
  updatePessoa: (pessoaId: string, patch: Partial<Pick<PessoaState, 'funcao' | 'tarefa'>>) => void

  moveEquipamento: (equipamentoId: string, equipeId: string | null) => void

  novoDia: () => void
  resetOrganograma: () => void
  // troca a DEFINIÇÃO base das equipes (nome/líder/frente/foco/membros) sem
  // perder status/posição do dia nem remanejamentos — chamado pela página
  // quando `useEquipes()` (Supabase) resolve/atualiza.
  setDefinicoes: (equipesData: EquipeCard[]) => void
}

const initial = hydrate()

export const useEquipesKanbanStore = create<EquipesKanbanState>((set) => {
  return {
    date: initial.date,
    equipes: initial.equipes,
    pessoas: initial.pessoas,
    equipamentos: initial.equipamentos,
    equipesDef: WCR_EQUIPES,

    moveEquipe: (id, status, motivoDesvio) =>
      set((s) => {
        const equipes = s.equipes.map((e) =>
          e.id === id ? { ...e, status, motivoDesvio: status === 'desvio' ? (motivoDesvio ?? e.motivoDesvio ?? '') : undefined } : e,
        )
        persist({ ...s, equipes })
        return { equipes }
      }),

    updateEquipe: (id, patch) =>
      set((s) => {
        const equipes = s.equipes.map((e) => (e.id === id ? { ...e, ...patch } : e))
        persist({ ...s, equipes })
        return { equipes }
      }),

    movePessoa: (pessoaId, equipeId) =>
      set((s) => {
        const pessoas = s.pessoas.map((p) => (p.id === pessoaId ? { ...p, equipeId } : p))
        persist({ ...s, pessoas })
        return { pessoas }
      }),

    updatePessoa: (pessoaId, patch) =>
      set((s) => {
        const pessoas = s.pessoas.map((p) => (p.id === pessoaId ? { ...p, ...patch } : p))
        persist({ ...s, pessoas })
        return { pessoas }
      }),

    moveEquipamento: (equipamentoId, equipeId) =>
      set((s) => {
        const equipamentos = s.equipamentos.map((e) => (e.id === equipamentoId ? { ...e, equipeId } : e))
        persist({ ...s, equipamentos })
        return { equipamentos }
      }),

    novoDia: () =>
      set((s) => {
        const next = {
          date: today(),
          equipes: s.equipes.map((e) => ({ ...e, status: 'planejado' as EquipeStatus, motivoDesvio: undefined })),
          pessoas: s.pessoas.map((p) => ({ ...p, tarefa: undefined })),
          equipamentos: s.equipamentos,
        }
        persist(next)
        return next
      }),

    resetOrganograma: () =>
      set((s) => {
        // usa a última definição canônica conhecida (banco, se já sincronizado
        // via setDefinicoes; senão WCR_EQUIPES) — não volta pro snapshot estático
        // se o Felipe já editou equipes no banco.
        const fresh = {
          date: today(),
          equipes: baseEquipes(s.equipesDef),
          pessoas: basePessoas(s.equipesDef),
          equipamentos: baseEquipamentos(),
        }
        persist(fresh)
        return { ...fresh, equipesDef: s.equipesDef }
      }),

    setDefinicoes: (equipesData) =>
      set((s) => {
        const fresh = { equipes: baseEquipes(equipesData), pessoas: basePessoas(equipesData) }
        const eqById = new Map(s.equipes.map((e) => [e.id, e]))
        const pById = new Map(s.pessoas.map((p) => [p.id, p]))
        const equipes = mergeEquipesState(fresh.equipes, eqById, true)
        const pessoas = mergePessoasState(fresh.pessoas, pById, true)
        const next = { date: s.date, equipes, pessoas, equipamentos: s.equipamentos, equipesDef: equipesData }
        persist(next)
        return next
      }),
  }
})
