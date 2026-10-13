/**
 * mockDre.ts — dados de demonstração do módulo DRE & Resultado.
 * Movidos de features/dre-financeiro/index.tsx SEM alterar nenhum valor.
 * Usados apenas no Modo Demonstração (usarFallback) — fora dele o módulo
 * mostra zerado + aviso honesto.
 */

// Fallbacks enquanto tabelas não têm dados reais
export const DRE_FALLBACK = {
  receitas: [
    { desc: 'Medição Rede Coletora (Jan-Mar)', valor: 2_845_000 },
    { desc: 'Medição Ligações Prediais', valor: 892_000 },
    { desc: 'Medição Poços de Visita', valor: 1_234_000 },
    { desc: 'Reajustamento Contratual', valor: 187_500 },
    { desc: 'Serviços Extras Aprovados (CO)', valor: 345_000 },
  ],
  custosDiretos: [
    { desc: 'Mão de Obra Direta (120 colaboradores)', valor: 1_890_000 },
    { desc: 'Materiais (Tubos PVC, PEAD, CAP)', valor: 1_245_000 },
    { desc: 'Equipamentos e Maquinário', valor: 678_000 },
    { desc: 'Transporte e Logística', valor: 234_000 },
    { desc: 'Subempreiteiros (Pavimentação, etc.)', valor: 567_000 },
  ],
  custosIndiretos: [
    { desc: 'Administração Local (Staff técnico)', valor: 345_000 },
    { desc: 'Canteiro e Instalações', valor: 89_000 },
    { desc: 'Seguros e Garantias', valor: 56_000 },
    { desc: 'Mobilização/Desmobilização', valor: 123_000 },
  ],
  impostos: [
    { desc: 'ISS (5%)', valor: 267_400 },
    { desc: 'PIS/COFINS (3.65%)', valor: 195_000 },
    { desc: 'IR/CSLL estimado', valor: 312_000 },
  ],
}

export const FLUXO_CAIXA = [
  { mes: 'Out/25', recebido: 450_000, gasto: 1_200_000, saldo: -750_000 },
  { mes: 'Nov/25', recebido: 1_100_000, gasto: 1_450_000, saldo: -1_100_000 },
  { mes: 'Dez/25', recebido: 1_800_000, gasto: 1_380_000, saldo: -680_000 },
  { mes: 'Jan/26', recebido: 2_100_000, gasto: 1_520_000, saldo: -100_000 },
  { mes: 'Fev/26', recebido: 2_400_000, gasto: 1_480_000, saldo: 820_000 },
  { mes: 'Mar/26', recebido: 2_650_000, gasto: 1_560_000, saldo: 1_910_000 },
]

export const TRECHOS_FALLBACK = [
  { trecho: 'PV-001 → PV-008', extensao: 245, dn: 200, profundidade: 2.8, custo_unitario: 485.30, custo_total: 118_898, status: 'executado', variacao: -3.2 },
  { trecho: 'PV-008 → PV-015', extensao: 312, dn: 250, profundidade: 3.2, custo_unitario: 612.45, custo_total: 191_084, status: 'executado', variacao: 1.8 },
  { trecho: 'PV-015 → PV-022', extensao: 189, dn: 200, profundidade: 2.5, custo_unitario: 445.20, custo_total: 84_142, status: 'executado', variacao: -5.1 },
  { trecho: 'PV-022 → PV-030', extensao: 278, dn: 300, profundidade: 3.8, custo_unitario: 789.90, custo_total: 219_592, status: 'em execução', variacao: 2.3 },
  { trecho: 'PV-030 → PV-038', extensao: 356, dn: 300, profundidade: 4.1, custo_unitario: 845.00, custo_total: 300_820, status: 'planejado', variacao: 0.0 },
]

export const EFICIENCIA = {
  economia: [
    { item: 'Redução de retrabalho em cadastro', semPlataforma: 180, comPlataforma: 24, unidade: 'horas/mês', economia: 86.7 },
    { item: 'Tempo de geração de NS', semPlataforma: 4, comPlataforma: 0.08, unidade: 'horas/NS', economia: 98.0 },
    { item: 'Conferência de medição', semPlataforma: 40, comPlataforma: 2, unidade: 'horas/medição', economia: 95.0 },
    { item: 'Geração de RDO em campo', semPlataforma: 2.5, comPlataforma: 0.3, unidade: 'horas/RDO', economia: 88.0 },
    { item: 'Planejamento semanal (LPS)', semPlataforma: 16, comPlataforma: 1.5, unidade: 'horas/semana', economia: 90.6 },
    { item: 'Relatório para fiscalização', semPlataforma: 24, comPlataforma: 0.5, unidade: 'horas/relatório', economia: 97.9 },
  ],
  impactoFinanceiro: { custoEquipeTradicional: 47_500, custoComPlataforma: 8_200, economiaMensal: 39_300, economiaAnual: 471_600, roi: 1250, paybackDias: 15 },
}
