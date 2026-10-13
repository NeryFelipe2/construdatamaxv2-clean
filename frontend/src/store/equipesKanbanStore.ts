/**
 * Kanban de Equipes WCR v3 — quadro de montagem diária da operação.
 * - Equipes movem entre status (planejado/em campo/concluído/desvio)
 * - PESSOAS movem entre equipes (e pro Banco), com função e tarefa editáveis
 * - EQUIPAMENTOS (frota ativa) movem entre equipes (e pro Pátio)
 * Composição persiste entre dias; status/tarefas resetam no "Novo dia".
 *
 * Fase 2 (09/07/2026): status diário passou a persistir também em
 * `wcr_kanban_dia` (Supabase), não só localStorage — mesmo formato, só que
 * agora sobrevive a F5 em qualquer navegador/dispositivo. localStorage
 * continua como cache instantâneo (evita tela vazia antes do fetch resolver).
 */
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { WCR_EQUIPES, type EquipeCard, type EquipeStatus, type FrenteId } from '@/data/wcrEquipes'
import { WCR_FROTA, type FrotaItem } from '@/data/wcrFrota'

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
// O id da pessoa carrega a EQUIPE DE ORIGEM (definição), não só o nome: a obra
// tem homônimos em equipes diferentes (Leonardo na Equipe 4 e na 7 em 28/07) e,
// com id só pelo nome, os dois colidiam — o merge jogava ambos na mesma equipe e
// uma das pontas perdia a pessoa do card. `equipeId` continua sendo ONDE ela
// está hoje (muda ao arrastar); o id é de onde ela veio, e por isso é estável.
function basePessoas(equipesData: EquipeCard[] = WCR_EQUIPES): PessoaState[] {
  return equipesData.flatMap((eq) =>
    eq.membros.map((m) => ({ id: `${eq.id}--${slug(m.nome)}`, nome: m.nome, funcao: m.funcao, equipeId: eq.id })),
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

// O remanejamento do dia (equipeId salvo) manda sobre a definição — MENOS quando
// a equipe salva não existe mais. Numa reorganização (equipe desativada ou
// dissolvida) a pessoa ficava órfã apontando pra um id morto e SUMIA da tela:
// não aparecia no card de nenhuma equipe nem no banco/pátio. Aconteceu de
// verdade em 28/07 — 4 pessoas do pool "Jesse — a alocar" evaporaram do Kanban
// depois que o pool foi dissolvido. Agora, id morto cai de volta pra definição
// nova do banco. `null` continua válido: é a pessoa parada no banco/pátio.
function mergePessoasState(
  fresh: PessoaState[],
  saved: Map<string, Partial<PessoaState>>,
  sameDay: boolean,
  equipesVivas?: Set<string>,
): PessoaState[] {
  return fresh.map((p) => {
    const s = saved.get(p.id)
    if (!s) return p
    const salvoValido =
      s.equipeId !== undefined &&
      (s.equipeId === null || !equipesVivas || equipesVivas.has(s.equipeId))
    return {
      ...p,
      funcao: s.funcao ?? p.funcao,
      equipeId: salvoValido ? (s.equipeId as string | null) : p.equipeId,
      tarefa: sameDay ? s.tarefa : undefined,
    }
  })
}

// Base vem, por padrão, da constante estática WCR_FROTA (garante que o
// Kanban nunca abre vazio). Quando `useFrota()` (Supabase) resolve, a página
// chama `setEquipamentosDef(frota)` pra trocar a base pela frota real do
// banco (`wcr_veiculos`) — mesmo padrão já usado pra equipes (setDefinicoes).
function baseEquipamentos(frotaData: FrotaItem[] = WCR_FROTA): EquipamentoState[] {
  return frotaData.filter((f) => f.status !== 'devolvido').map((f) => ({
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

function snapshot(state: { date: string; equipes: EquipeState[]; pessoas: PessoaState[]; equipamentos: EquipamentoState[] }) {
  return {
    equipes: state.equipes.map((e) => ({ id: e.id, status: e.status, motivoDesvio: e.motivoDesvio, local: e.local })),
    pessoas: state.pessoas.map((p) => ({ id: p.id, funcao: p.funcao, equipeId: p.equipeId, tarefa: p.tarefa })),
    equipamentos: state.equipamentos.map((e) => ({ id: e.id, equipeId: e.equipeId })),
  }
}

function persist(state: { date: string; equipes: EquipeState[]; pessoas: PessoaState[]; equipamentos: EquipamentoState[] }) {
  const snap = snapshot(state)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: state.date, ...snap }))
  } catch {
    // segue em memória
  }
  if (!supabase) return
  supabase
    .from('wcr_kanban_dia')
    .upsert({ data: state.date, ...snap, updated_at: new Date().toISOString() }, { onConflict: 'data' })
    .then(({ error }) => {
      if (error) console.error('Erro ao salvar status do Kanban no banco:', error.message)
    })
}

interface EquipesKanbanState {
  date: string
  equipes: EquipeState[]
  pessoas: PessoaState[]
  equipamentos: EquipamentoState[]
  // última definição canônica conhecida (do useEquipes/Supabase, ou WCR_EQUIPES
  // como fallback) — usada por setDefinicoes/resetOrganograma.
  equipesDef: EquipeCard[]
  // última frota canônica conhecida (do useFrota/Supabase, ou WCR_FROTA como
  // fallback) — usada por setEquipamentosDef/resetOrganograma.
  frotaDef: FrotaItem[]

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
  // troca a lista base de equipamentos/frota (nome/placa/status ativo↔devolvido)
  // sem perder a alocação por equipe já feita no dia — chamado pela página
  // quando `useFrota()` (Supabase) resolve/atualiza.
  setEquipamentosDef: (frotaData: FrotaItem[]) => void
  // busca o status de hoje em `wcr_kanban_dia` (Supabase) e faz merge por cima
  // do estado atual (mesma regra de sempre: local/composição sempre repõe,
  // status/tarefa do dia repõe porque já é o dia de hoje) — chamado uma vez
  // no mount da página, pra sobreviver a F5 em qualquer navegador.
  carregarStatusDoDia: () => Promise<void>
}

const initial = hydrate()

export const useEquipesKanbanStore = create<EquipesKanbanState>((set) => {
  return {
    date: initial.date,
    equipes: initial.equipes,
    pessoas: initial.pessoas,
    equipamentos: initial.equipamentos,
    equipesDef: WCR_EQUIPES,
    frotaDef: WCR_FROTA,

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
          equipamentos: baseEquipamentos(s.frotaDef),
        }
        persist(fresh)
        return { ...fresh, equipesDef: s.equipesDef, frotaDef: s.frotaDef }
      }),

    setDefinicoes: (equipesData) =>
      set((s) => {
        const fresh = { equipes: baseEquipes(equipesData), pessoas: basePessoas(equipesData) }
        const eqById = new Map(s.equipes.map((e) => [e.id, e]))
        const pById = new Map(s.pessoas.map((p) => [p.id, p]))
        const vivas = new Set(fresh.equipes.map((e) => e.id))
        const equipes = mergeEquipesState(fresh.equipes, eqById, true)
        const pessoas = mergePessoasState(fresh.pessoas, pById, true, vivas)
        const next = { date: s.date, equipes, pessoas, equipamentos: s.equipamentos, equipesDef: equipesData }
        persist(next)
        return next
      }),

    setEquipamentosDef: (frotaData) =>
      set((s) => {
        const fresh = baseEquipamentos(frotaData)
        const eqpById = new Map(s.equipamentos.map((e) => [e.id, e]))
        // preserva a alocação (equipeId) já feita no dia pra equipamentos que
        // continuam existindo; equipamentos novos entram sem equipe (Pátio).
        const equipamentos = fresh.map((e) => {
          const s2 = eqpById.get(e.id)
          return s2 ? { ...e, equipeId: s2.equipeId } : e
        })
        const next = { date: s.date, equipes: s.equipes, pessoas: s.pessoas, equipamentos, frotaDef: frotaData }
        persist(next)
        return next
      }),

    carregarStatusDoDia: async () => {
      if (!supabase) return
      try {
        const { data: row, error } = await supabase
          .from('wcr_kanban_dia')
          .select('data, equipes, pessoas, equipamentos')
          .eq('data', today())
          .maybeSingle()
        if (error || !row) return
        set((s) => {
          const eqById = new Map((row.equipes as Partial<EquipeState>[]).map((e) => [e.id, e]))
          const pById = new Map((row.pessoas as Partial<PessoaState>[]).map((p) => [p.id, p]))
          const eqpById = new Map((row.equipamentos as Partial<EquipamentoState>[]).map((e) => [e.id, e]))
          const vivas = new Set(s.equipes.map((e) => e.id))
          const equipes = mergeEquipesState(s.equipes, eqById, true)
          const pessoas = mergePessoasState(s.pessoas, pById, true, vivas)
          const equipamentos = s.equipamentos.map((e) => {
            const saved = eqpById.get(e.id)
            return saved ? { ...e, equipeId: saved.equipeId !== undefined ? saved.equipeId : e.equipeId } : e
          })
          return { equipes, pessoas, equipamentos }
        })
      } catch {
        // mantém o que já tem localmente (cache/fallback) — não quebra a tela
      }
    },
  }
})
