-- ============================================================
-- FLUXO DE CAIXA — RK ENGENHARIA
-- Tabela principal + Plano de Contas + Centros de Custo
-- ============================================================

-- 1. PLANO DE CONTAS (Chart of Accounts)
CREATE TABLE IF NOT EXISTS plano_contas (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  grupo TEXT NOT NULL DEFAULT 'operacional',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plano_contas (codigo, descricao, grupo) VALUES
  ('MAT', 'Material de Construção', 'operacional'),
  ('MDO', 'Mão de Obra', 'operacional'),
  ('DSL', 'Diesel / Combustível', 'operacional'),
  ('ALM', 'Alimentação / VR / VA', 'operacional'),
  ('AEQ', 'Aluguel de Equipamento', 'operacional'),
  ('TRF', 'Transporte / Frete', 'operacional'),
  ('FER', 'Ferramentas / Consumíveis', 'operacional'),
  ('EPI', 'EPI / Segurança', 'operacional'),
  ('SVC', 'Serviços Terceirizados', 'operacional'),
  ('ADM', 'Administrativo', 'administrativo'),
  ('IMP', 'Impostos / Taxas', 'fiscal'),
  ('OUT', 'Outros', 'outros')
ON CONFLICT (codigo) DO NOTHING;

-- 2. CENTROS DE CUSTO (Cost Centers = Obras)
CREATE TABLE IF NOT EXISTS centros_custo (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'obra',  -- obra, sede, consorcio
  ativo BOOLEAN DEFAULT TRUE,
  projeto_id UUID REFERENCES projetos(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO centros_custo (codigo, nome, tipo) VALUES
  ('OSA', 'Osasco', 'obra'),
  ('PAR', 'Pardinho', 'obra'),
  ('SAN', 'Santos / SLNR', 'obra'),
  ('BRA', 'Brasília', 'obra'),
  ('CON', 'Consórcio', 'consorcio'),
  ('RKS', 'RK Sede', 'sede')
ON CONFLICT (codigo) DO NOTHING;

-- 3. FLUXO DE CAIXA (Projetado + Executado)
CREATE TABLE IF NOT EXISTS fluxo_caixa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Classificação
  tipo TEXT NOT NULL CHECK (tipo IN ('projetado', 'executado')),
  centro_custo TEXT NOT NULL,       -- Código: OSA, PAR, SAN, etc.
  obra TEXT NOT NULL,               -- Nome legível: Osasco, Pardinho, etc.
  plano_conta TEXT NOT NULL,        -- Código: MAT, MDO, DSL, etc.
  plano_conta_desc TEXT,            -- Descrição legível
  
  -- Valores
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  descricao TEXT,                   -- O que foi pago / descrição livre
  
  -- Dados extraídos do comprovante (OCR)
  fornecedor TEXT,                  -- Quem recebeu o pagamento
  cnpj_cpf TEXT,                    -- CNPJ/CPF do fornecedor
  forma_pagamento TEXT,             -- PIX, boleto, transferência, cartão, dinheiro
  
  -- Metadados
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  mes TEXT GENERATED ALWAYS AS (TO_CHAR(data, 'YYYY-MM')) STORED,
  ano INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM data)::INTEGER) STORED,
  
  -- Quem lançou
  lancado_por TEXT,                 -- Nome de quem mandou no WhatsApp
  telefone TEXT,                    -- Telefone de quem lançou
  
  -- Comprovante
  comprovante_url TEXT,             -- URL da imagem do comprovante (se houver)
  ocr_raw TEXT,                     -- Texto bruto extraído pelo Gemini
  
  -- Controle
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  aprovado_por TEXT,
  aprovado_em TIMESTAMPTZ,
  observacao TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ÍNDICES para performance
CREATE INDEX IF NOT EXISTS idx_fluxo_caixa_mes ON fluxo_caixa(mes);
CREATE INDEX IF NOT EXISTS idx_fluxo_caixa_obra ON fluxo_caixa(obra);
CREATE INDEX IF NOT EXISTS idx_fluxo_caixa_tipo ON fluxo_caixa(tipo);
CREATE INDEX IF NOT EXISTS idx_fluxo_caixa_centro ON fluxo_caixa(centro_custo);
CREATE INDEX IF NOT EXISTS idx_fluxo_caixa_plano ON fluxo_caixa(plano_conta);
CREATE INDEX IF NOT EXISTS idx_fluxo_caixa_data ON fluxo_caixa(data);
CREATE INDEX IF NOT EXISTS idx_fluxo_caixa_status ON fluxo_caixa(status);

-- 5. VIEW — Resumo mensal por obra
CREATE OR REPLACE VIEW vw_resumo_mensal_obra AS
SELECT 
  mes,
  obra,
  tipo,
  plano_conta,
  plano_conta_desc,
  COUNT(*) as qtd_lancamentos,
  SUM(valor) as total,
  ROUND(AVG(valor), 2) as media
FROM fluxo_caixa
WHERE status != 'rejeitado'
GROUP BY mes, obra, tipo, plano_conta, plano_conta_desc
ORDER BY mes DESC, obra, tipo, plano_conta;

-- 6. VIEW — Projetado vs Executado por obra/mês
CREATE OR REPLACE VIEW vw_projetado_vs_executado AS
SELECT
  COALESCE(p.mes, e.mes) as mes,
  COALESCE(p.obra, e.obra) as obra,
  COALESCE(p.total_projetado, 0) as projetado,
  COALESCE(e.total_executado, 0) as executado,
  COALESCE(e.total_executado, 0) - COALESCE(p.total_projetado, 0) as variacao,
  CASE 
    WHEN COALESCE(p.total_projetado, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(e.total_executado, 0) / p.total_projetado) * 100, 1)
  END as pct_executado
FROM (
  SELECT mes, obra, SUM(valor) as total_projetado
  FROM fluxo_caixa WHERE tipo = 'projetado' AND status != 'rejeitado'
  GROUP BY mes, obra
) p
FULL OUTER JOIN (
  SELECT mes, obra, SUM(valor) as total_executado
  FROM fluxo_caixa WHERE tipo = 'executado' AND status != 'rejeitado'
  GROUP BY mes, obra
) e ON p.mes = e.mes AND p.obra = e.obra
ORDER BY mes DESC, obra;

-- 7. RLS (Row Level Security)
ALTER TABLE fluxo_caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE plano_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE centros_custo ENABLE ROW LEVEL SECURITY;

-- Policies: anon pode ler e inserir (vem do webhook n8n)
CREATE POLICY "Permitir leitura fluxo_caixa" ON fluxo_caixa FOR SELECT USING (true);
CREATE POLICY "Permitir inserção fluxo_caixa" ON fluxo_caixa FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update fluxo_caixa" ON fluxo_caixa FOR UPDATE USING (true);
CREATE POLICY "Permitir leitura plano_contas" ON plano_contas FOR SELECT USING (true);
CREATE POLICY "Permitir leitura centros_custo" ON centros_custo FOR SELECT USING (true);

-- 8. TRIGGER para updated_at automático
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON fluxo_caixa
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();
