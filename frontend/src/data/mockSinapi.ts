import type { SinapiEntry } from '@/types'

export const mockSinapi: SinapiEntry[] = [
  // ─── Concreto ────────────────────────────────────────────────────────────────
  { code: '94971', description: 'Concreto Usinado Bombeável fck=20 MPa', unit: 'm³', unitCost: 340.00, category: 'Concreto', state: 'SP', referenceDate: '2025-01' },
  { code: '94972', description: 'Concreto Usinado Bombeável fck=25 MPa', unit: 'm³', unitCost: 365.00, category: 'Concreto', state: 'SP', referenceDate: '2025-01' },
  { code: '94973', description: 'Concreto Usinado Bombeável fck=30 MPa', unit: 'm³', unitCost: 390.00, category: 'Concreto', state: 'SP', referenceDate: '2025-01' },
  { code: '94974', description: 'Concreto Usinado Bombeável fck=35 MPa', unit: 'm³', unitCost: 420.00, category: 'Concreto', state: 'SP', referenceDate: '2025-01' },
  { code: '94975', description: 'Concreto Usinado Bombeável fck=40 MPa', unit: 'm³', unitCost: 455.00, category: 'Concreto', state: 'SP', referenceDate: '2025-01' },
  { code: '94976', description: 'Concreto Magro de Regularização fck=15 MPa', unit: 'm³', unitCost: 295.00, category: 'Concreto', state: 'SP', referenceDate: '2025-01' },
  { code: '94977', description: 'Bombeamento de Concreto', unit: 'm³', unitCost: 28.50, category: 'Concreto', state: 'SP', referenceDate: '2025-01' },

  // ─── Aço / Armação ───────────────────────────────────────────────────────────
  { code: '87395', description: 'Aço CA-50 Bitola Ø8mm — Corte, Dobramento e Montagem', unit: 'kg', unitCost: 9.80, category: 'Aço', state: 'SP', referenceDate: '2025-01' },
  { code: '87396', description: 'Aço CA-50 Bitola Ø10mm — Corte, Dobramento e Montagem', unit: 'kg', unitCost: 9.50, category: 'Aço', state: 'SP', referenceDate: '2025-01' },
  { code: '87397', description: 'Aço CA-50 Bitola Ø12.5mm — Corte, Dobramento e Montagem', unit: 'kg', unitCost: 9.20, category: 'Aço', state: 'SP', referenceDate: '2025-01' },
  { code: '87398', description: 'Aço CA-50 Bitola Ø16mm — Corte, Dobramento e Montagem', unit: 'kg', unitCost: 8.90, category: 'Aço', state: 'SP', referenceDate: '2025-01' },
  { code: '87399', description: 'Aço CA-60 Bitola Ø5mm — Corte, Dobramento e Montagem', unit: 'kg', unitCost: 10.20, category: 'Aço', state: 'SP', referenceDate: '2025-01' },
  { code: '96543', description: 'Aço CA-50 Bitola Ø20mm — Corte, Dobramento e Montagem', unit: 'kg', unitCost: 8.60, category: 'Aço', state: 'SP', referenceDate: '2025-01' },
  { code: '96544', description: 'Aço CA-50 Bitola Ø25mm — Corte, Dobramento e Montagem', unit: 'kg', unitCost: 8.40, category: 'Aço', state: 'SP', referenceDate: '2025-01' },

  // ─── Formas ──────────────────────────────────────────────────────────────────
  { code: '88309', description: 'Forma de Madeira Compensada Resinada 12mm — Pilares', unit: 'm²', unitCost: 88.00, category: 'Formas', state: 'SP', referenceDate: '2025-01' },
  { code: '88310', description: 'Forma de Madeira Compensada Resinada 12mm — Vigas', unit: 'm²', unitCost: 92.00, category: 'Formas', state: 'SP', referenceDate: '2025-01' },
  { code: '88311', description: 'Forma de Madeira Compensada Resinada 12mm — Lajes', unit: 'm²', unitCost: 79.00, category: 'Formas', state: 'SP', referenceDate: '2025-01' },
  { code: '88312', description: 'Escoramento Metálico Aluguel — por m² de laje', unit: 'm²/mês', unitCost: 18.50, category: 'Formas', state: 'SP', referenceDate: '2025-01' },
  { code: '94984', description: 'Forma Metálica Reutilizável — Pilares Circulares', unit: 'm²', unitCost: 65.00, category: 'Formas', state: 'SP', referenceDate: '2025-01' },

  // ─── Alvenaria ───────────────────────────────────────────────────────────────
  { code: '87516', description: 'Alvenaria Bloco Cerâmico 9x14x19cm — Parede 14cm', unit: 'm²', unitCost: 85.00, category: 'Alvenaria', state: 'SP', referenceDate: '2025-01' },
  { code: '87517', description: 'Alvenaria Bloco Cerâmico 9x19x19cm — Parede 19cm', unit: 'm²', unitCost: 98.00, category: 'Alvenaria', state: 'SP', referenceDate: '2025-01' },
  { code: '87518', description: 'Alvenaria Bloco de Concreto 14x19x39cm', unit: 'm²', unitCost: 102.00, category: 'Alvenaria', state: 'SP', referenceDate: '2025-01' },
  { code: '87519', description: 'Alvenaria Bloco Estrutural Concreto 14x19x39cm', unit: 'm²', unitCost: 115.00, category: 'Alvenaria', state: 'SP', referenceDate: '2025-01' },
  { code: '92548', description: 'Alvenaria de Vedação Tijolo Maciço 5x10x20cm', unit: 'm²', unitCost: 72.00, category: 'Alvenaria', state: 'SP', referenceDate: '2025-01' },

  // ─── Revestimento / Argamassa ─────────────────────────────────────────────────
  { code: '87529', description: 'Chapisco com Argamassa de Cimento e Areia — Paredes Internas', unit: 'm²', unitCost: 8.50, category: 'Revestimento', state: 'SP', referenceDate: '2025-01' },
  { code: '87530', description: 'Emboço/Reboco de Argamassa Traço 1:2:8 — Paredes Internas', unit: 'm²', unitCost: 35.00, category: 'Revestimento', state: 'SP', referenceDate: '2025-01' },
  { code: '87531', description: 'Emboço/Reboco de Argamassa — Paredes Externas', unit: 'm²', unitCost: 42.00, category: 'Revestimento', state: 'SP', referenceDate: '2025-01' },
  { code: '87532', description: 'Revestimento Cerâmico — Piso 40x40cm', unit: 'm²', unitCost: 65.00, category: 'Revestimento', state: 'SP', referenceDate: '2025-01' },
  { code: '87533', description: 'Revestimento Porcelanato 60x60cm — Assentamento', unit: 'm²', unitCost: 90.00, category: 'Revestimento', state: 'SP', referenceDate: '2025-01' },

  // ─── Impermeabilização ────────────────────────────────────────────────────────
  { code: '96541', description: 'Impermeabilização Manta EPDM 1.5mm — Cobertura', unit: 'm²', unitCost: 128.00, category: 'Impermeabilização', state: 'SP', referenceDate: '2025-01' },
  { code: '96542', description: 'Impermeabilização Manta Asfáltica 3mm APP — Laje', unit: 'm²', unitCost: 75.00, category: 'Impermeabilização', state: 'SP', referenceDate: '2025-01' },
  { code: '96543', description: 'Impermeabilização com Manta Asfáltica 4mm APP', unit: 'm²', unitCost: 88.00, category: 'Impermeabilização', state: 'SP', referenceDate: '2025-01' },
  { code: '96544', description: 'Impermeabilização Cristalizante para Piscinas e Reservatórios', unit: 'm²', unitCost: 55.00, category: 'Impermeabilização', state: 'SP', referenceDate: '2025-01' },
  { code: '96545', description: 'Impermeabilização Argamassas Poliméricas — Banheiros', unit: 'm²', unitCost: 42.00, category: 'Impermeabilização', state: 'SP', referenceDate: '2025-01' },

  // ─── Coberturas ───────────────────────────────────────────────────────────────
  { code: '88489', description: 'Cobertura Telha Fibrocimento 6mm — Incl. Estrutura', unit: 'm²', unitCost: 75.00, category: 'Coberturas', state: 'SP', referenceDate: '2025-01' },
  { code: '88490', description: 'Cobertura Telha Metálica Trapezoidal — Estrutura Metálica', unit: 'm²', unitCost: 92.00, category: 'Coberturas', state: 'SP', referenceDate: '2025-01' },
  { code: '88491', description: 'Cobertura Telha Cerâmica Colonial — Estrutura Madeira', unit: 'm²', unitCost: 110.00, category: 'Coberturas', state: 'SP', referenceDate: '2025-01' },
  { code: '88492', description: 'Estrutura Metálica Treliçada para Cobertura', unit: 'kg', unitCost: 18.50, category: 'Coberturas', state: 'SP', referenceDate: '2025-01' },

  // ─── Instalações Elétricas ────────────────────────────────────────────────────
  { code: '91924', description: 'Eletroduto PVC Flexível 3/4" — Instalação em Parede', unit: 'm', unitCost: 12.50, category: 'Instalações Elétricas', state: 'SP', referenceDate: '2025-01' },
  { code: '91925', description: 'Eletroduto Rígido PVC 1" — Instalação em Parede', unit: 'm', unitCost: 18.00, category: 'Instalações Elétricas', state: 'SP', referenceDate: '2025-01' },
  { code: '91926', description: 'Fiação 1,5mm² — Instalação em Eletroduto', unit: 'm', unitCost: 4.80, category: 'Instalações Elétricas', state: 'SP', referenceDate: '2025-01' },
  { code: '91927', description: 'Fiação 2,5mm² — Instalação em Eletroduto', unit: 'm', unitCost: 6.20, category: 'Instalações Elétricas', state: 'SP', referenceDate: '2025-01' },
  { code: '91928', description: 'Fiação 6mm² — Instalação em Eletroduto', unit: 'm', unitCost: 12.50, category: 'Instalações Elétricas', state: 'SP', referenceDate: '2025-01' },
  { code: '91929', description: 'Quadro de Distribuição 12 Disjuntores Embutir', unit: 'un', unitCost: 380.00, category: 'Instalações Elétricas', state: 'SP', referenceDate: '2025-01' },
  { code: '91930', description: 'Ponto de Tomada 2P+T — Instalação Completa', unit: 'un', unitCost: 95.00, category: 'Instalações Elétricas', state: 'SP', referenceDate: '2025-01' },
  { code: '91931', description: 'Ponto de Iluminação Completo — Instalação', unit: 'un', unitCost: 85.00, category: 'Instalações Elétricas', state: 'SP', referenceDate: '2025-01' },
  { code: '91932', description: 'SPDA — Para-Raios Franklin — Instalação Completa', unit: 'un', unitCost: 2800.00, category: 'Instalações Elétricas', state: 'SP', referenceDate: '2025-01' },

  // ─── Instalações Hidráulicas ──────────────────────────────────────────────────
  { code: '89818', description: 'Tubulação PPR PN 20 Ø25mm — Água Fria', unit: 'm', unitCost: 22.00, category: 'Instalações Hidráulicas', state: 'SP', referenceDate: '2025-01' },
  { code: '89819', description: 'Tubulação PPR PN 20 Ø32mm — Água Fria', unit: 'm', unitCost: 32.00, category: 'Instalações Hidráulicas', state: 'SP', referenceDate: '2025-01' },
  { code: '89820', description: 'Tubulação PVC 50mm — Esgoto Sanitário', unit: 'm', unitCost: 18.50, category: 'Instalações Hidráulicas', state: 'SP', referenceDate: '2025-01' },
  { code: '89821', description: 'Tubulação PVC 100mm — Esgoto Principal', unit: 'm', unitCost: 28.00, category: 'Instalações Hidráulicas', state: 'SP', referenceDate: '2025-01' },
  { code: '89822', description: 'Ponto Hidráulico de Água Fria — Instalação Completa', unit: 'un', unitCost: 145.00, category: 'Instalações Hidráulicas', state: 'SP', referenceDate: '2025-01' },
  { code: '89823', description: 'Ponto de Esgoto — Instalação Completa', unit: 'un', unitCost: 120.00, category: 'Instalações Hidráulicas', state: 'SP', referenceDate: '2025-01' },
  { code: '89824', description: 'Reservatório de Fibra de Vidro 1000L — Instalação', unit: 'un', unitCost: 1850.00, category: 'Instalações Hidráulicas', state: 'SP', referenceDate: '2025-01' },
  { code: '89825', description: 'Caixa de Gordura Pré-Moldada 300x300cm', unit: 'un', unitCost: 185.00, category: 'Instalações Hidráulicas', state: 'SP', referenceDate: '2025-01' },

  // ─── Pavimentação ─────────────────────────────────────────────────────────────
  { code: '95672', description: 'Contrapiso de Concreto Simples 5cm — Argamassa 1:4', unit: 'm²', unitCost: 32.00, category: 'Pavimentação', state: 'SP', referenceDate: '2025-01' },
  { code: '95673', description: 'Contrapiso Desempenado 4cm com Malha de Fibra', unit: 'm²', unitCost: 38.00, category: 'Pavimentação', state: 'SP', referenceDate: '2025-01' },
  { code: '95674', description: 'Piso Intertravado de Concreto 6cm — Calçada', unit: 'm²', unitCost: 65.00, category: 'Pavimentação', state: 'SP', referenceDate: '2025-01' },
  { code: '95675', description: 'Piso Epóxi Industrial 1,5mm — Aplicação', unit: 'm²', unitCost: 55.00, category: 'Pavimentação', state: 'SP', referenceDate: '2025-01' },
  { code: '95676', description: 'Piso Concreto Polido com Endurecedor de Superfície', unit: 'm²', unitCost: 72.00, category: 'Pavimentação', state: 'SP', referenceDate: '2025-01' },

  // ─── Pintura ──────────────────────────────────────────────────────────────────
  { code: '88484', description: 'Pintura Látex PVA — Paredes Internas (2 demãos)', unit: 'm²', unitCost: 14.50, category: 'Pintura', state: 'SP', referenceDate: '2025-01' },
  { code: '88485', description: 'Pintura Acrílica Premium — Paredes Externas (2 demãos)', unit: 'm²', unitCost: 22.00, category: 'Pintura', state: 'SP', referenceDate: '2025-01' },
  { code: '88486', description: 'Pintura Esmalte Sintético — Esquadrias Metálicas', unit: 'm²', unitCost: 28.00, category: 'Pintura', state: 'SP', referenceDate: '2025-01' },
  { code: '88487', description: 'Textura Grafiato — Fachada (inclui primer)', unit: 'm²', unitCost: 38.00, category: 'Pintura', state: 'SP', referenceDate: '2025-01' },
  { code: '88488', description: 'Selador Acrílico + Fundo Preparador — Paredes', unit: 'm²', unitCost: 8.50, category: 'Pintura', state: 'SP', referenceDate: '2025-01' },

  // ─── Esquadrias ───────────────────────────────────────────────────────────────
  { code: '74209', description: 'Janela Alumínio Anodizado 120x120cm — Correr 2 Folhas', unit: 'un', unitCost: 680.00, category: 'Esquadrias', state: 'SP', referenceDate: '2025-01' },
  { code: '74210', description: 'Porta Interna de Madeira Maciça 80x210cm — Instalação', unit: 'un', unitCost: 750.00, category: 'Esquadrias', state: 'SP', referenceDate: '2025-01' },
  { code: '74211', description: 'Porta de Vidro Temperado 8mm 90x210cm — Pivotante', unit: 'un', unitCost: 1850.00, category: 'Esquadrias', state: 'SP', referenceDate: '2025-01' },
  { code: '74212', description: 'Janela Alumínio Anodizado 150x100cm — Maxim-Ar', unit: 'un', unitCost: 580.00, category: 'Esquadrias', state: 'SP', referenceDate: '2025-01' },
  { code: '74213', description: 'Porta de Aço Galvanizado 90x210cm — Entrada', unit: 'un', unitCost: 1200.00, category: 'Esquadrias', state: 'SP', referenceDate: '2025-01' },

  // ─── Fundações ────────────────────────────────────────────────────────────────
  { code: '74158', description: 'Estaca Raiz Ø25cm — Perfuração e Concretagem', unit: 'm', unitCost: 320.00, category: 'Fundações', state: 'SP', referenceDate: '2025-01' },
  { code: '74159', description: 'Estaca Franki Ø35cm — Cravação e Concretagem', unit: 'm', unitCost: 280.00, category: 'Fundações', state: 'SP', referenceDate: '2025-01' },
  { code: '74160', description: 'Estaca Hélice Contínua Monitorada Ø40cm', unit: 'm', unitCost: 260.00, category: 'Fundações', state: 'SP', referenceDate: '2025-01' },
  { code: '74161', description: 'Tubulão a Céu Aberto Ø80cm — Escavação e Concretagem', unit: 'm', unitCost: 850.00, category: 'Fundações', state: 'SP', referenceDate: '2025-01' },
  { code: '74162', description: 'Radier de Concreto Armado fck=25MPa 20cm', unit: 'm²', unitCost: 185.00, category: 'Fundações', state: 'SP', referenceDate: '2025-01' },
  { code: '74163', description: 'Sapata Isolada de Concreto Armado fck=25MPa', unit: 'm³', unitCost: 1850.00, category: 'Fundações', state: 'SP', referenceDate: '2025-01' },
  { code: '74164', description: 'Viga Baldrame de Concreto Armado 25x50cm', unit: 'm', unitCost: 320.00, category: 'Fundações', state: 'SP', referenceDate: '2025-01' },

  // ─── Estrutura Metálica ───────────────────────────────────────────────────────
  { code: '94485', description: 'Estrutura Metálica — Perfis Laminados (IPN, UPN, HEB)', unit: 'kg', unitCost: 22.00, category: 'Estrutura Metálica', state: 'SP', referenceDate: '2025-01' },
  { code: '94486', description: 'Estrutura Metálica — Perfis Soldados (VSO)', unit: 'kg', unitCost: 24.50, category: 'Estrutura Metálica', state: 'SP', referenceDate: '2025-01' },
  { code: '94487', description: 'Deck Metálico Steel Frame — Montagem', unit: 'm²', unitCost: 185.00, category: 'Estrutura Metálica', state: 'SP', referenceDate: '2025-01' },
  { code: '94488', description: 'Pintura Anticorrosiva em Estrutura Metálica', unit: 'kg', unitCost: 4.50, category: 'Estrutura Metálica', state: 'SP', referenceDate: '2025-01' },
  { code: '94489', description: 'Tratamento de Superfície — Jateamento Abrasivo Sa 2.5', unit: 'm²', unitCost: 35.00, category: 'Estrutura Metálica', state: 'SP', referenceDate: '2025-01' },

  // ─── Sistemas Prediais ────────────────────────────────────────────────────────
  { code: '97645', description: 'Sistema de Ar Condicionado Split 9.000 BTU — Instalação', unit: 'un', unitCost: 2850.00, category: 'Sistemas Prediais', state: 'SP', referenceDate: '2025-01' },
  { code: '97646', description: 'Sistema de Ar Condicionado Split 18.000 BTU — Instalação', unit: 'un', unitCost: 4200.00, category: 'Sistemas Prediais', state: 'SP', referenceDate: '2025-01' },
  { code: '97647', description: 'Elevador Passageiros 8 pessoas — Instalação Completa', unit: 'un', unitCost: 85000.00, category: 'Sistemas Prediais', state: 'SP', referenceDate: '2025-01' },
  { code: '97648', description: 'Sistema de Sprinklers — Rede Completa por Piso', unit: 'm²', unitCost: 45.00, category: 'Sistemas Prediais', state: 'SP', referenceDate: '2025-01' },
  { code: '97649', description: 'Central de Alarme de Incêndio 32 Zonas — Instalação', unit: 'un', unitCost: 8500.00, category: 'Sistemas Prediais', state: 'SP', referenceDate: '2025-01' },

  // ─── Demolição e Terraplenagem ────────────────────────────────────────────────
  { code: '72251', description: 'Escavação Mecânica de Vala em Solo Tipo I', unit: 'm³', unitCost: 12.50, category: 'Terraplenagem', state: 'SP', referenceDate: '2025-01' },
  { code: '72252', description: 'Aterro e Compactação Manual — Camadas 20cm', unit: 'm³', unitCost: 22.00, category: 'Terraplenagem', state: 'SP', referenceDate: '2025-01' },
  { code: '72253', description: 'Corte e Aterro Mecânico com Compactação 95% PN', unit: 'm³', unitCost: 18.50, category: 'Terraplenagem', state: 'SP', referenceDate: '2025-01' },
  { code: '72254', description: 'Bota-Fora em Caminhão Basculante — Transporte 10km', unit: 'm³', unitCost: 28.00, category: 'Terraplenagem', state: 'SP', referenceDate: '2025-01' },
  { code: '72255', description: 'Demolição de Estrutura de Concreto com Rompedor Hidráulico', unit: 'm³', unitCost: 185.00, category: 'Terraplenagem', state: 'SP', referenceDate: '2025-01' },
]
