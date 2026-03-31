/**
 * mockNetworks.ts — Pre-built network templates for quick budget import.
 * Each template is defined per 100m of network.
 * The importer scales quantities proportionally to the desired length.
 */

export interface NetworkTemplateItem {
  code:        string
  description: string
  unit:        string
  quantity:    number   // per 100m of network
  unitCost:    number
  category:    string
  source:      'sinapi' | 'seinfra' | 'manual'
}

export interface NetworkTemplate {
  id:          string
  name:        string
  description: string
  icon:        string
  perMeters:   number   // base length for quantities (always 100)
  items:       NetworkTemplateItem[]
}

export const NETWORK_TEMPLATES: NetworkTemplate[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // Rede de Esgoto Sanitário
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id:          'esgoto-100m',
    name:        'Rede de Esgoto Sanitário',
    description: 'Coletor principal DN150/200 com poços de visita a cada 50m, ramais e conexões',
    icon:        '🚰',
    perMeters:   100,
    items: [
      { code: '74245/002', description: 'Escavação mecânica de vala — solo 1ª cat., prof. 1,5m',           unit: 'm³',  quantity: 45,   unitCost: 18.50,   category: 'Terraplenagem', source: 'sinapi' },
      { code: '74246/001', description: 'Reaterro de vala com compactação — material de jazida',            unit: 'm³',  quantity: 35,   unitCost: 12.00,   category: 'Terraplenagem', source: 'sinapi' },
      { code: '00006539',  description: 'Cama de areia para assentamento de tubulações',                    unit: 'm³',  quantity: 8,    unitCost: 32.00,   category: 'Terraplenagem', source: 'sinapi' },
      { code: '76885',     description: 'Tubulação PVC rígido esgoto DN150 — fornecimento e assentamento',  unit: 'm',   quantity: 60,   unitCost: 72.00,   category: 'Tubulações',   source: 'sinapi' },
      { code: '76886',     description: 'Tubulação PVC rígido esgoto DN200 — fornecimento e assentamento',  unit: 'm',   quantity: 40,   unitCost: 118.00,  category: 'Tubulações',   source: 'sinapi' },
      { code: '73873/003', description: 'Poço de visita (PV) em alvenaria, D=1,0m, prof. até 2m',          unit: 'un',  quantity: 2,    unitCost: 3_200.00, category: 'Obras de Arte', source: 'sinapi' },
      { code: '74137/001', description: 'Tampa ferro fundido articulada DN600 para poço de visita',         unit: 'un',  quantity: 2,    unitCost: 420.00,  category: 'Obras de Arte', source: 'sinapi' },
      { code: '74163/002', description: 'Ligação predial de esgoto doméstico — ramais curtos',              unit: 'un',  quantity: 4,    unitCost: 950.00,  category: 'Ligações',     source: 'sinapi' },
      { code: '74253/001', description: 'Recomposição de calçada — paralelepípedo granítico',               unit: 'm²',  quantity: 20,   unitCost: 85.00,   category: 'Pavimentação', source: 'sinapi' },
      { code: 'MO-ESG-01', description: 'Serviços técnicos — topografia, locação e controle',               unit: 'vb',  quantity: 1,    unitCost: 2_500.00, category: 'Serviços',    source: 'manual' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Rede de Água Potável
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id:          'agua-100m',
    name:        'Rede de Água Potável',
    description: 'Adutora/sub-adutora PVC DN75/100 com hidrômetros, válvulas e conexões',
    icon:        '💧',
    perMeters:   100,
    items: [
      { code: '74245/001', description: 'Escavação mecânica de vala — solo 1ª cat., prof. 1,0m',            unit: 'm³',  quantity: 30,   unitCost: 14.80,   category: 'Terraplenagem', source: 'sinapi' },
      { code: '74246/001', description: 'Reaterro de vala com compactação',                                  unit: 'm³',  quantity: 25,   unitCost: 12.00,   category: 'Terraplenagem', source: 'sinapi' },
      { code: '00006539',  description: 'Cama de areia para assentamento',                                   unit: 'm³',  quantity: 5,    unitCost: 32.00,   category: 'Terraplenagem', source: 'sinapi' },
      { code: '76571',     description: 'Tubulação PVC DEFoFo PN10 DN75 — fornecimento e assentamento',      unit: 'm',   quantity: 60,   unitCost: 42.00,   category: 'Tubulações',   source: 'sinapi' },
      { code: '76572',     description: 'Tubulação PVC DEFoFo PN10 DN100 — fornecimento e assentamento',     unit: 'm',   quantity: 40,   unitCost: 62.00,   category: 'Tubulações',   source: 'sinapi' },
      { code: '72998',     description: 'Válvula de gaveta flangeada DN75 — fornecimento e instalação',      unit: 'un',  quantity: 2,    unitCost: 1_850.00, category: 'Conexões',    source: 'sinapi' },
      { code: '73121',     description: 'Hidrante de coluna padrão — DN100 — completo',                      unit: 'un',  quantity: 1,    unitCost: 4_200.00, category: 'Conexões',    source: 'sinapi' },
      { code: '74163/001', description: 'Ramal predial de água DN20mm com hidrômetro — completo',            unit: 'un',  quantity: 5,    unitCost: 780.00,  category: 'Ligações',     source: 'sinapi' },
      { code: '74253/002', description: 'Recomposição de revestimento asfáltico CBUQ 5cm',                   unit: 'm²',  quantity: 15,   unitCost: 62.00,   category: 'Pavimentação', source: 'sinapi' },
      { code: 'MO-AGU-01', description: 'Serviços técnicos — topografia, teste hidrostático',                unit: 'vb',  quantity: 1,    unitCost: 2_200.00, category: 'Serviços',   source: 'manual' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Drenagem Pluvial
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id:          'drenagem-100m',
    name:        'Drenagem Pluvial Urbana',
    description: 'Galeria pré-moldada DN400 com bocas de lobo, poços de visita e recomposição de pavimento',
    icon:        '🌊',
    perMeters:   100,
    items: [
      { code: '74245/003', description: 'Escavação mecânica de vala — solo 2ª cat., prof. 2,0m',            unit: 'm³',  quantity: 80,   unitCost: 22.40,   category: 'Terraplenagem', source: 'sinapi' },
      { code: '74246/002', description: 'Reaterro de vala com compactação mecânica',                         unit: 'm³',  quantity: 65,   unitCost: 12.00,   category: 'Terraplenagem', source: 'sinapi' },
      { code: '74252/001', description: 'Berço de brita para assentamento de galeria',                       unit: 'm³',  quantity: 15,   unitCost: 45.00,   category: 'Terraplenagem', source: 'sinapi' },
      { code: '74102',     description: 'Galeria concreto pré-moldado DN400 — fornecimento e assentamento',  unit: 'm',   quantity: 100,  unitCost: 195.00,  category: 'Galerias',     source: 'sinapi' },
      { code: '74103',     description: 'Poço de visita concreto armado D=1,0m, prof. 2,0m',                 unit: 'un',  quantity: 2,    unitCost: 4_200.00, category: 'Obras de Arte', source: 'sinapi' },
      { code: '73874/002', description: 'Boca de lobo simples concreto armado — completa',                   unit: 'un',  quantity: 3,    unitCost: 3_800.00, category: 'Obras de Arte', source: 'sinapi' },
      { code: '74137/002', description: 'Tampa ferro fundido classe C250 DN600 para PV',                     unit: 'un',  quantity: 2,    unitCost: 680.00,  category: 'Obras de Arte', source: 'sinapi' },
      { code: '74253/002', description: 'Recomposição revestimento asfáltico CBUQ 5cm',                      unit: 'm²',  quantity: 50,   unitCost: 62.00,   category: 'Pavimentação', source: 'sinapi' },
      { code: '74253/003', description: 'Recomposição base e sub-base compactada 20cm',                      unit: 'm²',  quantity: 50,   unitCost: 28.00,   category: 'Pavimentação', source: 'sinapi' },
      { code: 'MO-DRE-01', description: 'Serviços técnicos — topografia, locação e relatórios',              unit: 'vb',  quantity: 1,    unitCost: 3_500.00, category: 'Serviços',   source: 'manual' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Pavimentação com Infraestrutura
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id:          'pav-100m',
    name:        'Pavimentação + Infraestrutura',
    description: 'Via urbana de 6m + calçadas + esgoto + drenagem rasa, 100m de extensão',
    icon:        '🛣️',
    perMeters:   100,
    items: [
      { code: '74245/001', description: 'Terraplenagem — corte e aterro de terreno natural',                 unit: 'm³',  quantity: 120,  unitCost: 16.00,   category: 'Terraplenagem', source: 'sinapi' },
      { code: 'SF-01002',  description: 'Base de Brita Graduada Simples (BGS) 15cm',                        unit: 'm²',  quantity: 600,  unitCost: 25.00,   category: 'Pavimentação', source: 'seinfra' },
      { code: 'SF-01001',  description: 'CBUQ — Concreto Betuminoso Usinado a Quente 4cm',                  unit: 'm²',  quantity: 600,  unitCost: 48.00,   category: 'Pavimentação', source: 'seinfra' },
      { code: '87516',     description: 'Calçada — piso intertravado (2×2m)',                                unit: 'm²',  quantity: 200,  unitCost: 72.00,   category: 'Calçadas',     source: 'sinapi' },
      { code: '76885',     description: 'Tubulação PVC esgoto DN150 — coletor de sarjeta',                   unit: 'm',   quantity: 50,   unitCost: 72.00,   category: 'Tubulações',   source: 'sinapi' },
      { code: '73874/001', description: 'Boca de lobo simples para sarjeta',                                 unit: 'un',  quantity: 4,    unitCost: 3_800.00, category: 'Obras de Arte', source: 'sinapi' },
      { code: '74137/001', description: 'Sinalização horizontal — faixas e símbolos',                        unit: 'm²',  quantity: 25,   unitCost: 22.00,   category: 'Sinalização',  source: 'manual' },
      { code: 'MO-PAV-01', description: 'Serviços técnicos — projeto, topografia e fiscalização',            unit: 'vb',  quantity: 1,    unitCost: 4_500.00, category: 'Serviços',   source: 'manual' },
    ],
  },
]
