/**
 * useGeoAFazer.ts — Persistência do "A Fazer" no Supabase.
 *
 * 1) salvarImportComoAFazer: grava a rede importada (nodes/segments do Mapa
 *    Interativo) nas tabelas reais `pv`, `trecho` e `ns`, com projeto_id.
 *    Cada cadeia contínua de trechos vira UMA Nota de Serviço (NS).
 * 2) salvarAFazerManual: grava quantidades digitadas (LA/LE/caixas/redes/
 *    elevatória/booster) em `planejamento_itens`, sob um planejamento-pai
 *    dedicado por projeto (origem='a_fazer_manual').
 *
 * Honestidade: nada é estimado — só entra o que veio do arquivo/formulário.
 */
import { supabase } from '@/lib/supabase'
import { haversineM } from '@/utils/geoImport'
import type { MapNode, MapSegment } from '@/types'

// ─── Import geográfico → pv/trecho/ns ───────────────────────────────────────

export interface SalvarImportParams {
  nodes: MapNode[]
  segments: MapSegment[]
  projetoId: string
  nucleo: string
  isAgua: boolean
}

export interface SalvarImportResult {
  pvs: number
  trechos: number
  ns: number
  avisos: string[]
}

/** Agrupa segments em cadeias contínuas (cada cadeia = candidata a 1 NS). */
function agruparCadeias(segments: MapSegment[]): MapSegment[][] {
  const restantes = new Set(segments.map((s) => s.id))
  const byId = new Map(segments.map((s) => [s.id, s]))
  // adjacência nó → segmentos
  const porNo = new Map<string, string[]>()
  for (const s of segments) {
    for (const n of [s.fromNodeId, s.toNodeId]) {
      const arr = porNo.get(n) ?? []
      arr.push(s.id)
      porNo.set(n, arr)
    }
  }
  const cadeias: MapSegment[][] = []
  while (restantes.size > 0) {
    const seedId = restantes.values().next().value as string
    const fila = [seedId]
    restantes.delete(seedId)
    const grupo: MapSegment[] = []
    while (fila.length > 0) {
      const id = fila.pop()!
      const seg = byId.get(id)!
      grupo.push(seg)
      for (const n of [seg.fromNodeId, seg.toNodeId]) {
        for (const vizinho of porNo.get(n) ?? []) {
          if (restantes.has(vizinho)) {
            restantes.delete(vizinho)
            fila.push(vizinho)
          }
        }
      }
    }
    cadeias.push(grupo)
  }
  return cadeias
}

export async function salvarImportComoAFazer(p: SalvarImportParams): Promise<SalvarImportResult> {
  if (!supabase) throw new Error('Supabase não configurado (VITE_SUPABASE_URL ausente).')
  if (p.nodes.length === 0) throw new Error('Nenhum nó para salvar.')
  const avisos: string[] = []

  // 1) PVs — insere todos os nós; nome = label ou PV-N sequencial
  const nodeById = new Map(p.nodes.map((n) => [n.id, n]))
  const pvRows = p.nodes.map((n, i) => ({
    nome: n.label?.slice(0, 60) || `PV-${String(i + 1).padStart(3, '0')}`,
    lat: n.lat,
    lon: n.lng,
    tipo: n.nodeType,
    is_agua: p.isAgua,
    projeto_id: p.projetoId,
  }))
  const { data: pvsInseridos, error: ePv } = await supabase.from('pv').insert(pvRows).select('id, nome, lat, lon')
  if (ePv) throw new Error(`Erro ao inserir PVs: ${ePv.message}`)
  // Mapear node.id → nome do PV inserido (mesma ordem do insert)
  const pvNomePorNode = new Map<string, string>()
  p.nodes.forEach((n, i) => pvNomePorNode.set(n.id, (pvsInseridos ?? [])[i]?.nome ?? pvRows[i].nome))

  // 2) NS: uma por cadeia contínua; seq sequencial por núcleo a partir do max existente
  const { data: seqRow } = await supabase.from('ns').select('seq').eq('nucleo', p.nucleo).order('seq', { ascending: false }).limit(1)
  let seq = (seqRow?.[0]?.seq ?? 0) + 1

  const cadeias = p.segments.length > 0 ? agruparCadeias(p.segments) : []
  let totalTrechos = 0
  let totalNs = 0

  for (const cadeia of cadeias) {
    const extM = cadeia.reduce((acc, s) => {
      const a = nodeById.get(s.fromNodeId)
      const b = nodeById.get(s.toNodeId)
      return a && b ? acc + haversineM(a.lat, a.lng, b.lat, b.lng) : acc
    }, 0)
    const primeiro = cadeia[0]
    const ultimo = cadeia[cadeia.length - 1]
    const dnPrimeiro = cadeia.find((s) => s.diameter != null)?.diameter ?? null
    const matPrimeiro = cadeia.find((s) => s.material)?.material ?? null

    const { data: nsIns, error: eNs } = await supabase
      .from('ns')
      .insert({
        seq: seq++,
        nucleo: p.nucleo,
        pv_ini: pvNomePorNode.get(primeiro.fromNodeId) ?? '?',
        pv_fim: pvNomePorNode.get(ultimo.toNodeId) ?? '?',
        ext_m: Math.round(extM * 100) / 100,
        dn_mm: dnPrimeiro ? Math.round(dnPrimeiro) : null,
        material: matPrimeiro,
        rua: primeiro.label ?? null,
        status: 'PLANEJADA',
        cadastro_ok: false,
        projeto_id: p.projetoId,
        origem_dados: 'import_geo_browser',
      })
      .select('id')
      .single()
    if (eNs) throw new Error(`Erro ao inserir NS: ${eNs.message}`)
    totalNs++

    const trechoRows = cadeia.map((s) => {
      const a = nodeById.get(s.fromNodeId)
      const b = nodeById.get(s.toNodeId)
      return {
        ns_id: nsIns!.id,
        pv_ini: pvNomePorNode.get(s.fromNodeId) ?? '?',
        pv_fim: pvNomePorNode.get(s.toNodeId) ?? '?',
        ext_m: a && b ? Math.round(haversineM(a.lat, a.lng, b.lat, b.lng) * 100) / 100 : null,
        dn_mm: s.diameter ? Math.round(s.diameter) : null,
        material: s.material ?? null,
        projeto_id: p.projetoId,
      }
    })
    const { error: eTr } = await supabase.from('trecho').insert(trechoRows)
    if (eTr) throw new Error(`Erro ao inserir trechos: ${eTr.message}`)
    totalTrechos += trechoRows.length
  }

  if (cadeias.length === 0) avisos.push('Import só de pontos (sem linhas) — PVs salvos, nenhuma NS/trecho gerada.')
  return { pvs: pvRows.length, trechos: totalTrechos, ns: totalNs, avisos }
}

// ─── A Fazer manual → planejamento_itens ─────────────────────────────────────

export interface AFazerManualParams {
  projetoId: string
  nucleo: string
  rua?: string
  observacao?: string
  redeAguaM?: number
  redeEsgotoM?: number
  ligacoesAgua?: number
  ligacoesEsgoto?: number
  caixasUma?: number
  caixasEsgoto?: number
  casasALigar?: number
  elevatorias?: number
  boosters?: number
}

/** Garante um planejamento-pai "A Fazer (manual)" por projeto e retorna seu id. */
async function obterPlanejamentoAFazer(projetoId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data: existente } = await supabase
    .from('planejamentos_semanais')
    .select('id')
    .eq('projeto_id', projetoId)
    .eq('origem', 'a_fazer_manual')
    .limit(1)
  if (existente && existente.length > 0) return existente[0].id
  const hoje = new Date().toISOString().slice(0, 10)
  const { data: novo, error } = await supabase
    .from('planejamentos_semanais')
    .insert({
      projeto_id: projetoId,
      semana_inicio: hoje,
      semana_fim: hoje,
      status: 'ativo',
      origem: 'a_fazer_manual',
      versao: 1,
      payload: { descricao: 'Container de itens A Fazer digitados manualmente' },
    })
    .select('id')
    .single()
  if (error) throw new Error(`Erro ao criar planejamento A Fazer: ${error.message}`)
  return novo!.id
}

export async function salvarAFazerManual(p: AFazerManualParams): Promise<{ itens: number }> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const planejamentoId = await obterPlanejamentoAFazer(p.projetoId)
  const local = p.rua ? ` — ${p.rua}` : ''

  const candidatos: Array<{ atividade: string; unidade: string; quantidade: number | undefined; sistema: string }> = [
    { atividade: `Rede de água${local}`, unidade: 'm', quantidade: p.redeAguaM, sistema: 'AGUA' },
    { atividade: `Rede de esgoto${local}`, unidade: 'm', quantidade: p.redeEsgotoM, sistema: 'ESGOTO' },
    { atividade: `Ligações de água (LA)${local}`, unidade: 'un', quantidade: p.ligacoesAgua, sistema: 'AGUA' },
    { atividade: `Ligações de esgoto (LE)${local}`, unidade: 'un', quantidade: p.ligacoesEsgoto, sistema: 'ESGOTO' },
    { atividade: `Caixa U.M.A${local}`, unidade: 'un', quantidade: p.caixasUma, sistema: 'AGUA' },
    { atividade: `Caixa de esgoto${local}`, unidade: 'un', quantidade: p.caixasEsgoto, sistema: 'ESGOTO' },
    { atividade: `Casas a ligar${local}`, unidade: 'un', quantidade: p.casasALigar, sistema: 'GERAL' },
    { atividade: `Elevatória${local}`, unidade: 'un', quantidade: p.elevatorias, sistema: 'ESGOTO' },
    { atividade: `Booster${local}`, unidade: 'un', quantidade: p.boosters, sistema: 'AGUA' },
  ]
  const rows = candidatos
    .filter((c) => c.quantidade != null && c.quantidade > 0)
    .map((c) => ({
      planejamento_id: planejamentoId,
      projeto_id: p.projetoId,
      atividade: c.atividade,
      descricao: p.observacao ?? null,
      unidade: c.unidade,
      quantidade_planejada: c.quantidade,
      equipe_planejada: 0,
      custo_previsto: 0,
      restricoes: [],
      status: 'pendente',
      payload: { sistema: c.sistema, nucleo: p.nucleo, rua: p.rua ?? null, fonte: 'a_fazer_manual' },
    }))

  if (rows.length === 0) throw new Error('Preencha ao menos uma quantidade maior que zero.')
  const { error } = await supabase.from('planejamento_itens').insert(rows)
  if (error) throw new Error(`Erro ao gravar itens: ${error.message}`)
  return { itens: rows.length }
}
