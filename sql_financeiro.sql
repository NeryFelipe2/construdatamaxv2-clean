-- Tabelas Financeiras do ConstruDataMax
CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  data DATE DEFAULT CURRENT_DATE,
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  tipo TEXT NOT NULL,
  criado_por TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trechos_custo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  trecho TEXT NOT NULL,
  extensao NUMERIC,
  dn NUMERIC,
  profundidade NUMERIC,
  custo_unitario NUMERIC,
  custo_total NUMERIC,
  status TEXT,
  variacao NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserindo alguns dados iniciais
INSERT INTO lancamentos_financeiros (project_id, data, categoria, descricao, valor, tipo, criado_por) VALUES
('demo-1', '2026-03-18', 'Mão de Obra', 'ALIMENTAÇÃO', 400.00, 'DESPESA', 'Fabrizzio'),
('demo-1', '2026-03-18', 'Mão de Obra', 'HOTELARIA E ALOJAMENTOS', 300.00, 'DESPESA', 'Fabrizzio'),
('demo-1', '2026-03-16', 'Outros', 'DIESEL', 500.00, 'DESPESA', 'Fabrizzio');

INSERT INTO trechos_custo (project_id, trecho, extensao, dn, profundidade, custo_unitario, custo_total, status, variacao) VALUES
('demo-1', 'PV-001 ? PV-008', 245, 200, 2.8, 485.30, 118898, 'executado', -3.2),
('demo-1', 'PV-008 ? PV-015', 312, 250, 3.2, 612.45, 191084, 'executado', 1.8);
