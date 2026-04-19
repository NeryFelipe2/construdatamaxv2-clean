-- ============================================================================
-- Migração: adiciona colunas extras em `rdos` para receber dados do WhatsApp
-- ============================================================================
-- Rode este SQL no Supabase SQL Editor:
--   https://supabase.com/dashboard/project/vblfdikfobsirwpdnybw/sql/new
-- ============================================================================

ALTER TABLE rdos
  ADD COLUMN IF NOT EXISTS producao_m NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS equipe_number INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS apontador TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS custo_diesel NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_alimentacao NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_mao_obra NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_materiais NUMERIC DEFAULT 0;

-- Torna insert do anon role permitido (ajusta RLS)
DROP POLICY IF EXISTS "anon_insert_rdos" ON rdos;
CREATE POLICY "anon_insert_rdos" ON rdos
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_rdos" ON rdos;
CREATE POLICY "anon_select_rdos" ON rdos
  FOR SELECT USING (true);

-- Cadastra os 4 projetos com IDs fixos que o Router usa
INSERT INTO projetos (id, nome, contrato, cidade, cliente, tipo, data_inicio, orcamento_total, status, responsavel_nome, responsavel_telefone)
VALUES
  ('2a28beec-b1f8-4b0c-8416-d0710bb35d9d', 'ConstruData Brasília', '-', 'Brasília', 'ConstruData', 'esgoto', CURRENT_DATE, 0, 'ativo', 'João', '5561999996252'),
  ('f3c6645b-347f-4382-b9c5-d103c27ec511', 'Osasco - Rua Cuiabá', 'CAPEX Osasco', 'Osasco', 'CAPEX', 'esgoto', CURRENT_DATE, 0, 'ativo', 'Mateus Santos', '5561991015639'),
  ('ec112c9a-1669-4287-8079-526d6940ce82', 'Pardinho - Itapetininga', 'Consórcio Itapetininga', 'Pardinho', 'Consórcio Itapetininga', 'esgoto', CURRENT_DATE, 0, 'ativo', 'Ícaro', '5537998268576'),
  ('abe7f66c-004b-4bb5-a245-6be67debd9f7', 'Consórcio Se Liga na Rede', '11481051', 'Santos', 'SABESP', 'esgoto', CURRENT_DATE, 0, 'ativo', 'Fabrizzio', '5574999076534')
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  responsavel_nome = EXCLUDED.responsavel_nome,
  responsavel_telefone = EXCLUDED.responsavel_telefone;

-- Confere
SELECT id, nome, responsavel_nome FROM projetos WHERE id IN (
  '2a28beec-b1f8-4b0c-8416-d0710bb35d9d',
  'f3c6645b-347f-4382-b9c5-d103c27ec511',
  'ec112c9a-1669-4287-8079-526d6940ce82',
  'abe7f66c-004b-4bb5-a245-6be67debd9f7'
);
