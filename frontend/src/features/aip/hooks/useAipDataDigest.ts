/**
 * useAipDataDigest
 * Reads the current state of ALL major Zustand stores and returns a
 * structured text summary to be injected as AI system context.
 *
 * The AIP only reads what is already populated — no API calls.
 */
import { useRdoStore } from '@/store/rdoStore'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useProjetosStore } from '@/store/projetosStore'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useEquipamentosStore } from '@/store/equipamentosStore'
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import { useLpsStore } from '@/store/lpsStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useGestao360Store } from '@/store/gestao360Store'
import { useEvmStore } from '@/store/evmStore'

export function useAipDataDigest(): string {
  const rdos        = useRdoStore((s) => s.rdos)
  const reports     = useRelatorio360Store((s) => s.reports)
  const projects    = useProjetosStore((s) => s.projects)
  const masterActs  = usePlanejamentoMestreStore((s) => s.activities)
  const baselines   = usePlanejamentoMestreStore((s) => s.baselines)
  const trechos     = usePlanejamentoStore((s) => s.trechos)
  const teams       = usePlanejamentoStore((s) => s.teams)
  const workers     = useMaoDeObraStore((s) => s.workers)
  const laborCrews  = useMaoDeObraStore((s) => s.crews)
  const timecards   = useMaoDeObraStore((s) => s.timecards)
  const equipamentos = useEquipamentosStore((s) => s.equipamentos)
  const maintOrders = useGestaoEquipamentosStore((s) => s.orders)
  const purchaseOrders = useSuprimentosStore((s) => s.purchaseOrders)
  const estoqueItens   = useSuprimentosStore((s) => s.estoqueItens)
  const orcItems    = useQuantitativosStore((s) => s.currentItems)
  const bdiGlobal   = useQuantitativosStore((s) => s.bdiGlobal)
  const lpsActs     = useLpsStore((s) => s.activities)
  const restrictions = useLpsStore((s) => s.restrictions)
  const sites       = useTorreStore((s) => s.sites)
  const changeOrders = useGestao360Store((s) => s.changeOrders)
  const evmMetrics  = useEvmStore((s) => s.evmMetrics)
  const workPackages = useEvmStore((s) => s.workPackages)

  const lines: string[] = []

  // ── RDO summary ──────────────────────────────────────────────────────────────
  lines.push(`## RDOs (Relatórios Diários de Obra)`)
  lines.push(`Total registrado: ${rdos.length}`)
  if (rdos.length > 0) {
    const latest = [...rdos].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
    lines.push(`Últimos 3 RDOs:`)
    latest.forEach((r) => {
      lines.push(
        `  - RDO #${r.number} | ${r.date} | Responsável: ${r.responsible || '—'} ` +
        `| Local: ${r.local ?? '—'} | OS: ${r.numeroOS ?? '—'} ` +
        `| Serviços: ${r.services.length} | Equipamentos: ${r.equipment.length} ` +
        `| Func. Diretos: ${r.funcionariosDiretos ?? 0} | Indiretos: ${r.funcionariosIndiretos ?? 0} ` +
        `| Clima M/T/N: ${r.climaManha ?? '—'}/${r.climaTarde ?? '—'}/${r.climaNoite ?? '—'}`
      )
    })
  }
  lines.push('')

  // ── Relatório 360 ────────────────────────────────────────────────────────────
  const reportDates = Object.keys(reports)
  lines.push(`## Relatório 360`)
  lines.push(`Dias registrados: ${reportDates.length}`)
  if (reportDates.length > 0) {
    const latestDate = [...reportDates].sort().reverse()[0]
    const latestReport = reports[latestDate]
    if (latestReport) {
      const activities = latestReport.activities ?? []
      const done  = activities.filter((a) => a.status === 'completed').length
      const total = activities.length
      lines.push(`Último relatório: ${latestDate} | Atividades: ${done}/${total} concluídas`)
    }
  }
  lines.push('')

  // ── Projetos ─────────────────────────────────────────────────────────────────
  lines.push(`## Projetos`)
  lines.push(`Total de projetos: ${projects.length}`)
  if (projects.length > 0) {
    projects.slice(0, 5).forEach((p) => {
      lines.push(
        `  - [${p.code}] ${p.name} | Status: ${p.status} ` +
        `| Início: ${p.startDate} | Fim previsto: ${p.endDate} ` +
        `| Gerente: ${p.manager}`
      )
    })
    if (projects.length > 5) lines.push(`  ... e mais ${projects.length - 5} projetos`)
  }
  lines.push('')

  // ── Planejamento Mestre (WBS) ────────────────────────────────────────────────
  lines.push(`## Planejamento Mestre (WBS)`)
  lines.push(`Total de atividades: ${masterActs.length} | Baselines salvas: ${baselines.length}`)
  if (masterActs.length > 0) {
    const communities = masterActs.filter((a) => a.level === 1)
    communities.forEach((c) => {
      const children = masterActs.filter((a) => a.parentId === c.id)
      const avgPct = children.length > 0
        ? Math.round(children.reduce((s, a) => s + a.percentComplete, 0) / children.length)
        : c.percentComplete
      lines.push(`  - ${c.wbsCode} ${c.name} | %Avanço: ${avgPct}% | Status: ${c.status} | Tendência fim: ${c.trendEnd}`)
    })
    const delayed = masterActs.filter((a) => a.status === 'delayed')
    if (delayed.length > 0) lines.push(`  ⚠️ ${delayed.length} atividade(s) atrasada(s)`)
    const totalPct = masterActs.find((a) => a.level === 0)?.percentComplete ?? 0
    lines.push(`  Avanço geral do consórcio: ${totalPct}%`)
  }
  lines.push('')

  // ── Planejamento de Trechos ──────────────────────────────────────────────────
  lines.push(`## Planejamento de Trechos`)
  lines.push(`Trechos cadastrados: ${trechos.length} | Equipes: ${teams.length}`)
  if (trechos.length > 0) {
    const executed = trechos.filter((t) => t.executionStatus === 'completed').length
    const inProg = trechos.filter((t) => t.executionStatus === 'in_progress').length
    lines.push(`  Concluídos: ${executed} | Em andamento: ${inProg} | Pendentes: ${trechos.length - executed - inProg}`)
  }
  lines.push('')

  // ── Mão de Obra ──────────────────────────────────────────────────────────────
  lines.push(`## Mão de Obra`)
  lines.push(`Funcionários: ${workers.length} | Equipes: ${laborCrews.length} | Apontamentos: ${timecards.length}`)
  if (workers.length > 0) {
    const active = workers.filter((w) => w.status === 'active').length
    lines.push(`  Ativos: ${active} | Inativos/Férias: ${workers.length - active}`)
  }
  if (timecards.length > 0) {
    const totalHH = timecards.reduce((s, t) => s + t.hoursWorked, 0)
    lines.push(`  Total HH registrado: ${totalHH.toFixed(1)}h`)
  }
  lines.push('')

  // ── Equipamentos ─────────────────────────────────────────────────────────────
  lines.push(`## Equipamentos`)
  lines.push(`Total cadastrado: ${equipamentos.length}`)
  if (equipamentos.length > 0) {
    const byStatus: Record<string, number> = {}
    equipamentos.forEach((e) => { byStatus[e.status] = (byStatus[e.status] ?? 0) + 1 })
    lines.push(`  Status: ${Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(', ')}`)
    const alertCount = equipamentos.reduce((s, e) => s + e.alerts.filter((a) => !a.acknowledged).length, 0)
    if (alertCount > 0) lines.push(`  ⚠️ ${alertCount} alerta(s) não reconhecido(s)`)
  }
  lines.push('')

  // ── Manutenção (Gestão de Equipamentos) ──────────────────────────────────────
  lines.push(`## Ordens de Manutenção`)
  lines.push(`Total: ${maintOrders.length}`)
  if (maintOrders.length > 0) {
    const open = maintOrders.filter((o) => o.status === 'scheduled' || o.status === 'in_progress').length
    lines.push(`  Abertas/Em andamento: ${open} | Fechadas: ${maintOrders.length - open}`)
  }
  lines.push('')

  // ── Suprimentos ──────────────────────────────────────────────────────────────
  lines.push(`## Suprimentos`)
  lines.push(`Pedidos de compra: ${purchaseOrders.length} | Itens em estoque: ${estoqueItens.length}`)
  if (purchaseOrders.length > 0) {
    const pending = purchaseOrders.filter((po) => po.status === 'open' || po.status === 'partial').length
    lines.push(`  POs pendentes/aprovados: ${pending}`)
  }
  if (estoqueItens.length > 0) {
    const lowStock = estoqueItens.filter((i) => i.qtdDisponivel <= i.estoqueMinimo).length
    if (lowStock > 0) lines.push(`  ⚠️ ${lowStock} item(ns) abaixo do estoque mínimo`)
  }
  lines.push('')

  // ── Orçamento / Quantitativos ────────────────────────────────────────────────
  lines.push(`## Orçamento (Quantitativos)`)
  lines.push(`Itens orçamentários: ${orcItems.length} | BDI global: ${(bdiGlobal * 100).toFixed(1)}%`)
  if (orcItems.length > 0) {
    const totalBRL = orcItems.reduce((s, i) => s + (i.totalCost ?? 0), 0)
    lines.push(`  Custo total orçado: R$ ${totalBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
  }
  lines.push('')

  // ── LPS / Lean ───────────────────────────────────────────────────────────────
  lines.push(`## LPS / Lean`)
  lines.push(`Atividades LPS: ${lpsActs.length} | Restrições: ${restrictions.length}`)
  if (restrictions.length > 0) {
    const open = restrictions.filter((r) => r.status === 'identificada' || r.status === 'em_resolucao').length
    lines.push(`  Restrições abertas: ${open} | Resolvidas: ${restrictions.length - open}`)
  }
  if (lpsActs.length > 0) {
    const completed = lpsActs.filter((a) => a.completed).length
    const ppc = lpsActs.length > 0 ? Math.round((completed / lpsActs.length) * 100) : 0
    lines.push(`  PPC geral: ${ppc}%`)
  }
  lines.push('')

  // ── Torre de Controle ────────────────────────────────────────────────────────
  lines.push(`## Torre de Controle`)
  lines.push(`Obras monitoradas: ${sites.length}`)
  if (sites.length > 0) {
    const totalRisks = sites.reduce((s, site) => s + (site.risks?.length ?? 0), 0)
    const highRisks = sites.reduce((s, site) => s + (site.risks?.filter((r) => r.level === 'high' || r.level === 'critical').length ?? 0), 0)
    lines.push(`  Riscos totais: ${totalRisks} | Alto/Crítico: ${highRisks}`)
  }
  lines.push('')

  // ── Gestão 360 — Change Orders ───────────────────────────────────────────────
  lines.push(`## Change Orders (Gestão 360)`)
  lines.push(`Total: ${changeOrders.length}`)
  if (changeOrders.length > 0) {
    const pending = changeOrders.filter((co) => co.status === 'draft' || co.status === 'submitted').length
    const totalImpact = changeOrders.reduce((s, co) => s + co.impactCostBRL, 0)
    lines.push(`  Pendentes: ${pending} | Impacto financeiro total: R$ ${totalImpact.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
  }
  lines.push('')

  // ── EVM (Earned Value Management) ────────────────────────────────────────────
  lines.push(`## EVM (Gerenciamento de Valor — Análise Preditiva)`)
  lines.push(`Work Packages: ${workPackages.length}`)
  if (evmMetrics.BAC > 0) {
    const statusLabel = evmMetrics.healthStatus === 'blue' ? '🔵 Obra Eficiente' : evmMetrics.healthStatus === 'yellow' ? '🟡 Atenção — Atrasado no prazo' : '🔴 Risco Crítico'
    lines.push(`  Semáforo: ${statusLabel}`)
    lines.push(`  BAC (Orçamento): R$ ${evmMetrics.BAC.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
    lines.push(`  CPI (Índice de Custo): ${evmMetrics.CPI.toFixed(2)} ${evmMetrics.CPI < 1 ? '⚠️ Acima do orçamento' : '✅ Dentro do orçamento'}`)
    lines.push(`  SPI (Índice de Prazo): ${evmMetrics.SPI.toFixed(2)} ${evmMetrics.SPI < 1 ? '⚠️ Atrasado' : '✅ No prazo'}`)
    lines.push(`  EAC Cenários: Otimista=R$ ${evmMetrics.eacScenarios.optimistic.toLocaleString('pt-BR')} | Tendência=R$ ${evmMetrics.eacScenarios.trend.toLocaleString('pt-BR')} | Pessimista=R$ ${evmMetrics.eacScenarios.pessimistic.toLocaleString('pt-BR')}`)
    if (evmMetrics.CPI < 1 && evmMetrics.pillarDeviations.length > 0) {
      const top = evmMetrics.pillarDeviations[0]
      lines.push(`  ⚠️ Causa Raiz do Desvio: ${top.label} (${top.deviationPct}% do desvio total, R$ ${top.deviation.toLocaleString('pt-BR')} acima)`)
    }
    if (evmMetrics.costBreakdown) {
      const cb = evmMetrics.costBreakdown
      lines.push(`  AC por Pillar: Material=R$ ${cb.material.toLocaleString('pt-BR')} | Equip=R$ ${cb.equipamento.toLocaleString('pt-BR')} | MO=R$ ${cb.mao_de_obra.toLocaleString('pt-BR')} | Impostos=R$ ${cb.impostos_indiretos.toLocaleString('pt-BR')}`)
    }
    if (evmMetrics.stockAlerts.length > 0) {
      const totalImob = evmMetrics.stockAlerts.reduce((s, a) => s + a.custoImobilizado, 0)
      lines.push(`  ⚠️ Estoque Imobilizado: ${evmMetrics.stockAlerts.length} item(ns), R$ ${totalImob.toLocaleString('pt-BR')} parado(s) em estoque`)
    }
    const estouroPct = evmMetrics.BAC > 0 ? ((evmMetrics.eacScenarios.trend - evmMetrics.BAC) / evmMetrics.BAC * 100).toFixed(1) : '0'
    if (Number(estouroPct) > 0) {
      lines.push(`  Projeção: Se manter ritmo atual, obra terminará com ${estouroPct}% de estouro orçamentário`)
    }
  }
  lines.push('')

  lines.push(`---`)
  lines.push(`Data/hora da consulta: ${new Date().toLocaleString('pt-BR')}`)

  return lines.join('\n')
}
