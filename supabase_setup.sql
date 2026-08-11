-- =============================================
-- CONSTRUDATAMAX — TABELAS SUPABASE
-- Cole este SQL inteiro no SQL Editor do Supabase
-- Dashboard > SQL Editor > New Query > Cole > Run
-- =============================================

CREATE TABLE IF NOT EXISTS equipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  celular TEXT NOT NULL,
  cargo TEXT DEFAULT 'Ajudante',
  equipe_nome TEXT DEFAULT 'Rede Esgoto',
  projeto TEXT DEFAULT '',
  status TEXT DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS logs_rdo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  emissor TEXT NOT NULL,
  mensagem TEXT,
  foto_url TEXT,
  tipo TEXT DEFAULT 'log',
  task_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'PENDING',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS e liberar acesso anon
ALTER TABLE equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_rdo ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_equipes" ON equipes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_logs_rdo" ON logs_rdo FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_workflow" ON workflow_status FOR ALL USING (true) WITH CHECK (true);
