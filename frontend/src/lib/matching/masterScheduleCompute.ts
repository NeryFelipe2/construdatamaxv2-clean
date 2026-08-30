/**
 * masterScheduleCompute.ts
 *
 * Motor puro que calcula o cronograma MACRO (por núcleo × sistema) a partir
 * dos dados MICRO reais já buscados do Supabase (planejamento_itens + rdos/
 * rdo_equipes/rdo_atividades). Não faz fetch — recebe tudo já carregado e
 * devolve estruturas agregadas prontas para alimentar o Gantt do
 * Planejamento Mestre.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SIMPLIFICAÇÕES CONHECIDAS (documentadas conforme plano da Missão 2):
 *
 * 1. Rateio de metros por item é APROXIMADO. Usamos
 *    `min(metrosExecutados_da_equipe_casada, quantidade_planejada_do_item)`
 *    como proxy do quanto daquele item específico já foi executado. Isso
 *    NÃO é um rateio fino por rua/trecho — uma equipe pode ter executado
 *    metros em ruas/trechos diferentes do item que foi casado com ela, e o
 *    resultado ainda assim "conta" como executado para aquele item. É uma
 *    aproximação razoável para o MVP, não uma medição exata.
 *
 * 2. [ATUALIZADO — ver item 6] Antes desta missão, não havia baseline
 *    oficial de data-fim planejada: `plannedEnd` e `trendEnd` usavam a MESMA
 *    data projetada (hoje + metros restantes / velocidade média). Isso ainda
 *    é o comportamento de fallback quando NÃO há baseline (nem por núcleo,
 *    nem por equipe) — ver item 6 para o caso em que ela existe.
 *
 * 3. Granularidade é núcleo × sistema (água/esgoto) — NÃO desce a nível de
 *    rua/trecho/PV. Descer a esse nível é melhoria futura (fora do escopo
 *    desta missão).
 *
 * 4. O matching item↔equipe usa `matchEquipe` (src/lib/matching/equipeMatch.ts),
 *    que casa `payload.equipe_original` do item contra `rdo_equipes.lider_nome`.
 *    Itens sem match (`matchQuality.semMatch`) não contribuem com metros
 *    executados no agregado (contam só como planejado) — mas CONTINUAM
 *    entrando na agregação do seu grupo núcleo×sistema (ex.: esgoto com
 *    `equipe_original` numérico "1"/"2", que não casa com nome de líder
 *    nenhum). Isso garante que o grupo apareça no Gantt com seus metros
 *    planejados corretos mesmo com 0% executado.
 *
 * 5. O núcleo (Boi Malhado / Sakura / Comunidade do Retorno) idealmente vem
 *    de `nucleoPadrao` (o projeto ativo já É o núcleo — 1 projeto = 1
 *    núcleo). `inferNucleoFromText` (busca por palavra-chave no texto do
 *    item) é só fallback para quando `nucleoPadrao` não é informado, pois os
 *    itens reais (ex. "NS ÁGUA JESSE 18") não têm o nome do núcleo no texto
 *    e cairiam em "Não identificado".
 *
 * 6. BASELINE (dataFimPlanejada) — duas fontes, níveis diferentes de certeza:
 *    - Por NÚCLEO (nível 0 / MasterActivity pai): vem de `baselinePorNucleo`,
 *      parseado de `planilhas_modelo` (CRONOGRAMA_MACRO) via
 *      `parseBaselineCronogramaMacro` (./baselineCronograma.ts). É a baseline
 *      OFICIAL de contrato/cronograma aprovado por núcleo — quando existe,
 *      substitui a projeção como `plannedStart`/`plannedEnd` do grupo.
 *    - Por EQUIPE (nível 1 / MasterActivity filha): APROXIMAÇÃO. Calculada
 *      como `data_inicio` do item + N dias corridos, onde N vem de
 *      `payload.dias_vca` (preferencial) ou `payload.dias_mnd` (fallback) do
 *      item de planejamento — não é uma baseline de contrato por equipe, é
 *      uma estimativa derivada do prazo VCA/MND informado no item. Quando
 *      nenhum item da equipe tem dias_vca/dias_mnd válidos, a equipe fica
 *      sem `dataFimPlanejada` (null) — não inventamos número.
 *    Quando NÃO há baseline (nem núcleo nem equipe), o comportamento é o
 *    mesmo do item 2 acima: `plannedEnd` cai de volta na projeção atual.
 */

import { matchEquipe, normalizeNomeEquipe, type MatchCandidate } from './equipeMatch'

// ─── Tipos de entrada (dados já buscados do Supabase, sem fetch aqui) ───────

export interface RawItem {
  id: string
  atividade: string
  descricao: string | null
  quantidade_planejada: number
  data_inicio: string | null
  status: string
  payload: any // { sistema: 'AGUA'|'ESGOTO', equipe_original: string, ligacoes_ou_ramais, ... }
}

export interface RawRdo {
  id: string
  data: string
}

export interface RawRdoEquipe {
  id: string
  rdo_id: string
  lider_nome: string | null
}

export interface RawRdoAtividade {
  equipe_id: string
  metragem: number | null
  rua: string | null
  servico: string | null
}

export interface ComputeInput {
  itens: RawItem[]
  rdos: RawRdo[]
  rdoEquipes: RawRdoEquipe[]
  rdoAtividades: RawRdoAtividade[]
  /**
   * Núcleo do projeto ativo (ex.: "Boi Malhado"), já derivado do nome do
   * projeto (1 projeto = 1 núcleo). Quando informado, TODOS os grupos usam
   * este núcleo em vez de `inferNucleoFromText`. Opcional para não quebrar
   * quem ainda não passa esse dado — nesse caso cai no fallback antigo.
   */
  nucleoPadrao?: string
  /**
   * Baseline oficial por núcleo (chave = núcleo normalizado via
   * `normalizeNomeEquipe`, ex.: "boi malhado"), vinda do CRONOGRAMA_MACRO
   * (ver `./baselineCronograma.ts`). Opcional — quando ausente/vazio, o
   * cálculo degrada graciosamente para o comportamento antigo (plannedEnd
   * = projeção).
   */
  baselinePorNucleo?: Map<string, { inicio: string; fim: string }>
}

// ─── Tipos de saída ──────────────────────────────────────────────────────────

export type Sistema = 'AGUA' | 'ESGOTO'
/**
 * Nome do núcleo. Union conhecido (`Boi Malhado`/`Sakura`/`Comunidade do
 * Retorno`/`Não identificado`) preservado para os casos que passam por
 * `inferNucleoFromText`, mas alargado para `string` pois `nucleoPadrao`
 * (derivado do nome do projeto ativo) pode trazer qualquer texto.
 */
export type Nucleo = 'Boi Malhado' | 'Sakura' | 'Comunidade do Retorno' | 'Não identificado' | (string & {})

export interface TeamVelocity {
  key: string // rdo_equipes.id
  liderNome: string | null
  metrosExecutados: number
  diasComRegistro: number
  metrosPorDia: number
}

export interface MasterAggregate {
  nucleo: Nucleo
  sistema: Sistema
  metrosPlanejados: number
  metrosExecutados: number
  ligacoesPlanejadas: number
  velocidadeMediaMDia: number
  dataInicioPlanejada: string | null
  metrosRestantes: number
  dataFimProjetada: string | null
  /**
   * Baseline oficial de fim (contrato/cronograma aprovado), vinda de
   * `baselinePorNucleo` (CRONOGRAMA_MACRO) quando o núcleo deste grupo tem
   * match. `null` quando não há baseline para o núcleo (fallback gracioso —
   * ver item 6 da documentação no topo do arquivo).
   */
  dataFimPlanejada: string | null
  percentComplete: number
  status: 'not_started' | 'in_progress' | 'completed'
  itensCount: number
}

export interface MatchQuality {
  totalItens: number
  comMatch: number
  semMatch: number
}

export interface MasterActivityLike {
  id: string
  wbsCode: string
  name: string
  parentId: string | null
  level: number
  plannedStart: string
  plannedEnd: string
  trendStart: string
  trendEnd: string
  durationDays: number
  percentComplete: number
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed'
  isMilestone: boolean
  responsibleTeam?: string
  networkType?: 'agua' | 'esgoto' | 'civil' | 'geral'
  nucleo?: string
  weight?: number
}

export interface ComputeResult {
  activities: MasterActivityLike[]
  aggregates: MasterAggregate[]
  teamVelocities: TeamVelocity[]
  matchQuality: MatchQuality
}

// ─── Inferência de núcleo a partir de texto ─────────────────────────────────

/**
 * Infere o núcleo (Boi Malhado / Sakura / Comunidade do Retorno) a partir de
 * texto livre (atividade + descrição). Simples busca por palavra-chave —
 * na prática, quando os dados já vêm filtrados por projeto (1 projeto = 1
 * núcleo), isso tende a cair em 'Não identificado' e o núcleo real já é
 * conhecido pelo chamador (via activeProjectId). Mantido pois é parte do
 * contrato desta função pura e serve de fallback quando o texto contém a
 * pista (ex.: relatórios consolidados multi-núcleo).
 */
export function inferNucleoFromText(...textos: (string | null | undefined)[]): Nucleo {
  const texto = textos.filter(Boolean).join(' ').toLowerCase()
  if (texto.includes('boi malhado') || texto.includes('boi')) return 'Boi Malhado'
  if (texto.includes('sakura')) return 'Sakura'
  if (texto.includes('retorno')) return 'Comunidade do Retorno'
  return 'Não identificado'
}

/**
 * Canonicaliza um `rdo_equipes.lider_nome` (ex.: "Equipe Robert (Sul)",
 * "Equipe Ediel", "Equipe José Claudino") para um rótulo curto de exibição
 * no cronograma MICRO (ex.: "Robert", "Ediel", "José Claudino"):
 *  - remove prefixo "Equipe "
 *  - remove conteúdo entre parênteses (ex.: "(Sul)", "(lider Renan)")
 *  - colapsa espaços e faz trim
 * Se o resultado ficar vazio, devolve o nome original sem alterações.
 */
export function canonicalizeLiderNome(raw: string): string {
  if (!raw) return raw
  let s = raw.replace(/^\s*equipe\s+/i, '')
  s = s.replace(/\(.*?\)/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s || raw
}

// ─── Cálculo de velocidade por equipe (a partir de rdo_atividades/rdos) ─────

function computeTeamVelocities(input: ComputeInput): TeamVelocity[] {
  const dataPorRdoId = new Map(input.rdos.map((r) => [r.id, r.data]))

  const metrosPorEquipe = new Map<string, number>()
  for (const at of input.rdoAtividades) {
    if (at.metragem == null) continue
    metrosPorEquipe.set(at.equipe_id, (metrosPorEquipe.get(at.equipe_id) ?? 0) + Number(at.metragem))
  }

  // dias distintos com registro por equipe: precisamos saber, para cada
  // rdo_atividade, a qual rdo_equipe ela pertence, e daí a data do rdo.
  const equipesById = new Map(input.rdoEquipes.map((eq) => [eq.id, eq]))
  const diasPorEquipe = new Map<string, Set<string>>()
  for (const at of input.rdoAtividades) {
    const equipe = equipesById.get(at.equipe_id)
    if (!equipe) continue
    const data = dataPorRdoId.get(equipe.rdo_id)
    if (!data) continue
    const set = diasPorEquipe.get(at.equipe_id) ?? new Set<string>()
    set.add(data)
    diasPorEquipe.set(at.equipe_id, set)
  }

  return input.rdoEquipes.map((eq) => {
    const metrosExecutados = metrosPorEquipe.get(eq.id) ?? 0
    const diasComRegistro = diasPorEquipe.get(eq.id)?.size ?? 0
    const metrosPorDia = diasComRegistro > 0 ? metrosExecutados / diasComRegistro : 0
    return {
      key: eq.id,
      liderNome: eq.lider_nome,
      metrosExecutados,
      diasComRegistro,
      metrosPorDia,
    }
  })
}

// ─── Função principal ───────────────────────────────────────────────────────

function sistemaFromPayload(payload: any): Sistema {
  return payload?.sistema === 'ESGOTO' ? 'ESGOTO' : 'AGUA'
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + Math.ceil(days))
  return d.toISOString().slice(0, 10)
}

/**
 * Baseline por EQUIPE (aproximação — item 6 da doc. no topo do arquivo):
 * `data_inicio` do item + N dias corridos, onde N = `payload.dias_vca`
 * (preferencial) ou `payload.dias_mnd` (fallback) quando numérico válido.
 * Retorna null se faltar `data_inicio` ou nenhum dos dois campos for um
 * número válido — não inventamos prazo sem dado de origem.
 */
function computeDataFimPlanejadaItem(item: RawItem): string | null {
  if (!item.data_inicio) return null
  const payload = item.payload ?? {}
  const diasVca = Number(payload.dias_vca)
  const diasMnd = Number(payload.dias_mnd)
  const dias = Number.isFinite(diasVca) && payload.dias_vca !== null && payload.dias_vca !== undefined && payload.dias_vca !== ''
    ? diasVca
    : Number.isFinite(diasMnd) && payload.dias_mnd !== null && payload.dias_mnd !== undefined && payload.dias_mnd !== ''
      ? diasMnd
      : null
  if (dias === null || !Number.isFinite(dias)) return null
  return addDays(item.data_inicio, dias)
}

export function computeMasterScheduleFromRaw(input: ComputeInput): ComputeResult {
  const teamVelocities = computeTeamVelocities(input)
  const velocityByKey = new Map(teamVelocities.map((t) => [t.key, t]))

  const candidates: MatchCandidate[] = teamVelocities.map((t) => ({
    key: t.key,
    liderNome: t.liderNome ?? '',
  }))

  let comMatch = 0
  let semMatch = 0

  type GroupKey = string // `${nucleo}::${sistema}`
  /** Chave do sub-grupo por equipe DENTRO de um grupo núcleo×sistema. */
  type TeamGroupKey = string // match.key, ou `semmatch::${equipe_original}` quando não casou

  interface TeamGroupAcc {
    /** rótulo de exibição: nome canonicalizado do líder, ou "Equipe <equipe_original>" */
    label: string
    metrosPlanejados: number
    metrosExecutados: number
    ligacoesPlanejadas: number
    velocidades: number[]
    datasInicio: string[]
    itensCount: number
    /**
     * Candidatos de dataFimPlanejada da equipe (aproximação — ver item 6 da
     * doc. no topo do arquivo): `data_inicio` do item + dias_vca/dias_mnd.
     * O maior valor entre os itens da equipe vira `dataFimPlanejada` dela.
     */
    dataFimPlanejadaCandidatos: string[]
  }

  interface GroupAcc {
    nucleo: Nucleo
    sistema: Sistema
    metrosPlanejados: number
    metrosExecutados: number
    ligacoesPlanejadas: number
    velocidades: number[]
    datasInicio: string[]
    itensCount: number
    /** Nível 1 (MICRO por equipe): sub-agregação por equipe casada/dentro deste grupo. */
    porEquipe: Map<TeamGroupKey, TeamGroupAcc>
  }
  const groups = new Map<GroupKey, GroupAcc>()

  for (const item of input.itens) {
    const payload = item.payload ?? {}
    const sistema = sistemaFromPayload(payload)
    // Problema 1 (correção): o núcleo vem do PROJETO ATIVO (nucleoPadrao),
    // não do texto do item — os itens reais (ex. "NS ÁGUA JESSE 18") não
    // trazem o nome do núcleo no texto. `inferNucleoFromText` é só fallback.
    const nucleo = input.nucleoPadrao || inferNucleoFromText(item.atividade, item.descricao)
    const key: GroupKey = `${nucleo}::${sistema}`

    let acc = groups.get(key)
    if (!acc) {
      acc = {
        nucleo,
        sistema,
        metrosPlanejados: 0,
        metrosExecutados: 0,
        ligacoesPlanejadas: 0,
        velocidades: [],
        datasInicio: [],
        itensCount: 0,
        porEquipe: new Map(),
      }
      groups.set(key, acc)
    }

    const quantidadePlanejada = Number(item.quantidade_planejada) || 0
    const ligacoesItem = Number(payload.ligacoes_ou_ramais) || 0
    acc.metrosPlanejados += quantidadePlanejada
    acc.ligacoesPlanejadas += ligacoesItem
    acc.itensCount += 1
    if (item.data_inicio) acc.datasInicio.push(item.data_inicio)

    const equipeOriginal: string = payload.equipe_original ?? ''
    const match = equipeOriginal ? matchEquipe(equipeOriginal, candidates) : null

    // Problema 2 (correção/confirmação): item SEM match ainda entra na
    // agregação (metros planejados/ligações já somados acima) — só não
    // contribui com metros executados/velocidade. Aqui montamos também o
    // sub-grupo por equipe (nível 1 / MICRO) usando a mesma regra: sem
    // match, agrupa numa filha genérica rotulada com o próprio
    // equipe_original (ex. "Equipe 1", "Equipe 2"), sem sumir do pai.
    const teamKey: TeamGroupKey = match ? match.key : `semmatch::${equipeOriginal || 'sem-equipe'}`
    let teamAcc = acc.porEquipe.get(teamKey)
    if (!teamAcc) {
      const liderCanonico = match ? (velocityByKey.get(match.key)?.liderNome ?? equipeOriginal) : null
      const label = liderCanonico
        ? canonicalizeLiderNome(liderCanonico)
        : `Equipe ${equipeOriginal || 'sem identificação'}`
      teamAcc = {
        label,
        metrosPlanejados: 0,
        metrosExecutados: 0,
        ligacoesPlanejadas: 0,
        velocidades: [],
        datasInicio: [],
        itensCount: 0,
        dataFimPlanejadaCandidatos: [],
      }
      acc.porEquipe.set(teamKey, teamAcc)
    }
    teamAcc.metrosPlanejados += quantidadePlanejada
    teamAcc.ligacoesPlanejadas += ligacoesItem
    teamAcc.itensCount += 1
    if (item.data_inicio) teamAcc.datasInicio.push(item.data_inicio)
    const dataFimPlanejadaItem = computeDataFimPlanejadaItem(item)
    if (dataFimPlanejadaItem) teamAcc.dataFimPlanejadaCandidatos.push(dataFimPlanejadaItem)

    if (match) {
      comMatch += 1
      const equipe = velocityByKey.get(match.key)
      if (equipe) {
        // Simplificação documentada no topo do arquivo: rateio aproximado.
        const executadoRateado = Math.min(equipe.metrosExecutados, quantidadePlanejada)
        acc.metrosExecutados += executadoRateado
        teamAcc.metrosExecutados += executadoRateado
        if (equipe.metrosPorDia > 0) {
          acc.velocidades.push(equipe.metrosPorDia)
          teamAcc.velocidades.push(equipe.metrosPorDia)
        }
      }
    } else {
      semMatch += 1
    }
  }

  const hojeIso = new Date().toISOString().slice(0, 10)

  const aggregates: MasterAggregate[] = []
  const activities: MasterActivityLike[] = []

  let idx = 0
  for (const acc of groups.values()) {
    const velocidadeMediaMDia =
      acc.velocidades.length > 0 ? acc.velocidades.reduce((s, v) => s + v, 0) / acc.velocidades.length : 0
    const metrosRestantes = Math.max(0, acc.metrosPlanejados - acc.metrosExecutados)
    const dataFimProjetada =
      velocidadeMediaMDia > 0 ? addDays(hojeIso, metrosRestantes / velocidadeMediaMDia) : null
    const percentComplete = acc.metrosPlanejados > 0 ? (acc.metrosExecutados / acc.metrosPlanejados) * 100 : 0
    const status: MasterAggregate['status'] =
      percentComplete >= 100 ? 'completed' : percentComplete > 0 ? 'in_progress' : 'not_started'
    const dataInicioPlanejada = acc.datasInicio.length > 0 ? acc.datasInicio.sort()[0] : null

    // Baseline oficial por núcleo (CRONOGRAMA_MACRO) — ver item 6 da doc no
    // topo do arquivo. Quando há match para o núcleo deste grupo, usamos a
    // baseline real; senão degrada graciosamente (null / cai na projeção).
    const baselineNucleo = input.baselinePorNucleo?.get(normalizeNomeEquipe(String(acc.nucleo))) ?? null
    const dataFimPlanejada = baselineNucleo?.fim ?? null

    aggregates.push({
      nucleo: acc.nucleo,
      sistema: acc.sistema,
      metrosPlanejados: acc.metrosPlanejados,
      metrosExecutados: acc.metrosExecutados,
      ligacoesPlanejadas: acc.ligacoesPlanejadas,
      velocidadeMediaMDia,
      dataInicioPlanejada,
      metrosRestantes,
      dataFimProjetada,
      dataFimPlanejada,
      percentComplete,
      status,
      itensCount: acc.itensCount,
    })

    // plannedStart/plannedEnd = baseline oficial do núcleo quando disponível
    // (senão cai na projeção, comportamento antigo). trendStart/trendEnd =
    // SEMPRE a projeção atual (hoje + metros restantes / velocidade) — é
    // isso que permite o Gantt comparar Previsto × Tendência de verdade
    // quando há baseline (antes os dois eram a mesma data).
    const plannedStart = baselineNucleo?.inicio ?? dataInicioPlanejada ?? hojeIso
    const plannedEnd = dataFimPlanejada ?? dataFimProjetada ?? plannedStart
    const trendStart = dataInicioPlanejada ?? plannedStart
    const trendEnd = dataFimProjetada ?? plannedEnd
    const durationDays = Math.max(
      1,
      Math.round((new Date(plannedEnd + 'T00:00:00').getTime() - new Date(plannedStart + 'T00:00:00').getTime()) / 86_400_000),
    )

    const parentId = `macro-${idx}-${acc.nucleo}-${acc.sistema}`.replace(/\s+/g, '-').toLowerCase()

    activities.push({
      id: parentId,
      wbsCode: `${idx + 1}`,
      name: `${acc.nucleo} — ${acc.sistema === 'AGUA' ? 'Água' : 'Esgoto'}`,
      parentId: null,
      level: 0,
      plannedStart,
      plannedEnd,
      trendStart,
      trendEnd,
      durationDays,
      percentComplete,
      status: status === 'completed' ? 'completed' : status === 'in_progress' ? 'in_progress' : 'not_started',
      isMilestone: false,
      networkType: acc.sistema === 'AGUA' ? 'agua' : 'esgoto',
      nucleo: acc.nucleo,
      weight: acc.metrosPlanejados || 1,
    })

    // ── Nível 1 (MICRO por equipe): uma MasterActivity filha por equipe ──
    // casada dentro deste núcleo×sistema (ou filha genérica "Equipe <id>"
    // para itens sem match, ex. esgoto com equipe_original numérico).
    let teamIdx = 0
    for (const teamAcc of acc.porEquipe.values()) {
      const velocidadeMediaEquipe =
        teamAcc.velocidades.length > 0
          ? teamAcc.velocidades.reduce((s, v) => s + v, 0) / teamAcc.velocidades.length
          : 0
      const metrosRestantesEquipe = Math.max(0, teamAcc.metrosPlanejados - teamAcc.metrosExecutados)
      const dataFimProjetadaEquipe =
        velocidadeMediaEquipe > 0 ? addDays(hojeIso, metrosRestantesEquipe / velocidadeMediaEquipe) : null
      const percentCompleteEquipe =
        teamAcc.metrosPlanejados > 0 ? (teamAcc.metrosExecutados / teamAcc.metrosPlanejados) * 100 : 0
      const statusEquipe: MasterActivityLike['status'] =
        percentCompleteEquipe >= 100 ? 'completed' : percentCompleteEquipe > 0 ? 'in_progress' : 'not_started'
      const dataInicioEquipe = teamAcc.datasInicio.length > 0 ? teamAcc.datasInicio.sort()[0] : null
      // Baseline por equipe (aproximação — item 6 da doc no topo do
      // arquivo): maior candidato (data_inicio + dias_vca/dias_mnd) entre os
      // itens da equipe. Null quando nenhum item tinha dias válidos.
      const dataFimPlanejadaEquipe =
        teamAcc.dataFimPlanejadaCandidatos.length > 0
          ? teamAcc.dataFimPlanejadaCandidatos.sort().at(-1)!
          : null

      const childStart = dataInicioEquipe ?? plannedStart
      const childPlannedEnd = dataFimPlanejadaEquipe ?? dataFimProjetadaEquipe ?? childStart
      const childTrendEnd = dataFimProjetadaEquipe ?? childPlannedEnd
      const childDuration = Math.max(
        1,
        Math.round((new Date(childPlannedEnd + 'T00:00:00').getTime() - new Date(childStart + 'T00:00:00').getTime()) / 86_400_000),
      )

      activities.push({
        id: `${parentId}-eq-${teamIdx}`,
        wbsCode: `${idx + 1}.${teamIdx + 1}`,
        name: teamAcc.label,
        parentId,
        level: 1,
        plannedStart: childStart,
        plannedEnd: childPlannedEnd,
        trendStart: childStart,
        trendEnd: childTrendEnd,
        durationDays: childDuration,
        percentComplete: percentCompleteEquipe,
        status: statusEquipe,
        isMilestone: false,
        responsibleTeam: teamAcc.label,
        networkType: acc.sistema === 'AGUA' ? 'agua' : 'esgoto',
        nucleo: acc.nucleo,
        weight: teamAcc.metrosPlanejados || 1,
      })

      teamIdx += 1
    }

    idx += 1
  }

  return {
    activities,
    aggregates,
    teamVelocities,
    matchQuality: { totalItens: input.itens.length, comMatch, semMatch },
  }
}
