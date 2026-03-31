import type { SinapiEntry } from '@/types'

// SEINFRA-CE reference prices adapted for SP region (2025)
export const mockSeinfra: SinapiEntry[] = [
  // ─── Pavimentação Viária ──────────────────────────────────────────────────────
  { code: 'SF-01001', description: 'CBUQ — Concreto Betuminoso Usinado a Quente — Camada de Rolamento 4cm', unit: 'm²', unitCost: 48.00, category: 'Pavimentação Viária', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-01002', description: 'Base de Brita Graduada Simples (BGS) — 15cm', unit: 'm²', unitCost: 25.00, category: 'Pavimentação Viária', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-01003', description: 'Sub-base de Solo Melhorado com Brita — 15cm', unit: 'm²', unitCost: 18.00, category: 'Pavimentação Viária', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-01004', description: 'Imprimação com CM-30 — Pavimento Betuminoso', unit: 'm²', unitCost: 5.50, category: 'Pavimentação Viária', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-01005', description: 'Pintura de Ligação com RR-1C — Usinagem', unit: 'm²', unitCost: 3.80, category: 'Pavimentação Viária', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-01006', description: 'Fresagem de Pavimento Betuminoso — Profundidade 5cm', unit: 'm²', unitCost: 18.50, category: 'Pavimentação Viária', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-01007', description: 'Concreto de Cimento Portland para Pavimento Rígido 18cm', unit: 'm²', unitCost: 95.00, category: 'Pavimentação Viária', state: 'SP', referenceDate: '2025-01' },

  // ─── Drenagem Pluvial ─────────────────────────────────────────────────────────
  { code: 'SF-02001', description: 'Bueiro Tubular Simples — BSTC Ø60cm — Concreto', unit: 'm', unitCost: 285.00, category: 'Drenagem', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-02002', description: 'Bueiro Tubular Simples — BSTC Ø80cm — Concreto', unit: 'm', unitCost: 380.00, category: 'Drenagem', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-02003', description: 'Bueiro Tubular Simples — BSTC Ø100cm — Concreto', unit: 'm', unitCost: 520.00, category: 'Drenagem', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-02004', description: 'Boca de Lobo Simples — Concreto Armado', unit: 'un', unitCost: 2800.00, category: 'Drenagem', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-02005', description: 'Caixa de Captação com Grelha — 60x60cm', unit: 'un', unitCost: 850.00, category: 'Drenagem', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-02006', description: 'Vala de Drenagem — Escavação, Assentamento e Reaterro', unit: 'm', unitCost: 145.00, category: 'Drenagem', state: 'SP', referenceDate: '2025-01' },

  // ─── Contenção e Estruturas de Terra ─────────────────────────────────────────
  { code: 'SF-03001', description: 'Muro de Gabião — Caixa 2x1x1m Preenchida com Pedra', unit: 'm³', unitCost: 320.00, category: 'Contenção', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-03002', description: 'Cortina de Estacas Justapostas Ø40cm — Execução', unit: 'm²', unitCost: 650.00, category: 'Contenção', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-03003', description: 'Solo Pregado — Instalação de Pregos L=12m Ø25mm', unit: 'un', unitCost: 480.00, category: 'Contenção', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-03004', description: 'Projeção de Concreto (Shotcrete) — e=10cm', unit: 'm²', unitCost: 125.00, category: 'Contenção', state: 'SP', referenceDate: '2025-01' },

  // ─── Sinalização Viária ───────────────────────────────────────────────────────
  { code: 'SF-04001', description: 'Sinalização Horizontal — Faixa de Pedestre (Termoplástico)', unit: 'm²', unitCost: 55.00, category: 'Sinalização', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-04002', description: 'Sinalização Horizontal — Linha Contínua Branca (Tinta)', unit: 'm', unitCost: 4.50, category: 'Sinalização', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-04003', description: 'Placa de Sinalização Vertical Regulamentação (R) — 60x80cm', unit: 'un', unitCost: 380.00, category: 'Sinalização', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-04004', description: 'Tachão Bidirecional Refletivo — Instalação', unit: 'un', unitCost: 28.00, category: 'Sinalização', state: 'SP', referenceDate: '2025-01' },

  // ─── Iluminação Pública ───────────────────────────────────────────────────────
  { code: 'SF-05001', description: 'Poste de Concreto Duplo T 9m — Fornecimento e Montagem', unit: 'un', unitCost: 1850.00, category: 'Iluminação Pública', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-05002', description: 'Luminária LED 100W — Fornecimento e Instalação', unit: 'un', unitCost: 950.00, category: 'Iluminação Pública', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-05003', description: 'Cabo Cobre 35mm² XLPE 0,6/1kV — Rede Subterrânea', unit: 'm', unitCost: 42.00, category: 'Iluminação Pública', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-05004', description: 'Duto PEAD 110mm para Rede Elétrica Subterrânea', unit: 'm', unitCost: 28.00, category: 'Iluminação Pública', state: 'SP', referenceDate: '2025-01' },

  // ─── Obras de Arte Correntes ──────────────────────────────────────────────────
  { code: 'SF-06001', description: 'Ponte em Concreto Armado Vão 12m — Superestrutura', unit: 'm²', unitCost: 4500.00, category: 'Obras de Arte', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-06002', description: 'Muro de Arrimo em Concreto Armado h=3m', unit: 'm²', unitCost: 850.00, category: 'Obras de Arte', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-06003', description: 'Passarela Metálica Vão 20m — Fornecimento e Montagem', unit: 'm', unitCost: 6800.00, category: 'Obras de Arte', state: 'SP', referenceDate: '2025-01' },

  // ─── Meio-Fio e Calçadas ──────────────────────────────────────────────────────
  { code: 'SF-07001', description: 'Meio-Fio de Concreto 12x15x30cm — Assentamento', unit: 'm', unitCost: 32.00, category: 'Meio-Fio', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-07002', description: 'Calçada Piso Intertravado de Concreto 6cm — Acessibilidade', unit: 'm²', unitCost: 68.00, category: 'Meio-Fio', state: 'SP', referenceDate: '2025-01' },
  { code: 'SF-07003', description: 'Rebaixamento de Meio-Fio para Acessibilidade — Rampas', unit: 'un', unitCost: 380.00, category: 'Meio-Fio', state: 'SP', referenceDate: '2025-01' },
]
