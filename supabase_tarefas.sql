CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  delegante text NOT NULL,
  delegante_phone text,
  responsavel text NOT NULL,
  responsavel_phone text NOT NULL,
  descricao text NOT NULL,
  tipo varchar(50) NOT NULL DEFAULT 'operacional',
  status varchar(20) NOT NULL DEFAULT 'pendente',
  resposta text,
  data_criacao timestamp with time zone NOT NULL DEFAULT now(),
  data_conclusao timestamp with time zone,
  prazo date,
  prioridade varchar(20) NOT NULL DEFAULT 'normal',
  origem varchar(50) NOT NULL DEFAULT 'whatsapp',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tarefas_status ON public.tarefas(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel ON public.tarefas(responsavel);
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel_phone ON public.tarefas(responsavel_phone);
CREATE INDEX IF NOT EXISTS idx_tarefas_data ON public.tarefas(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_tarefas_delegante ON public.tarefas(delegante);
CREATE INDEX IF NOT EXISTS idx_tarefas_project ON public.tarefas(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tarefas_seed_unico
  ON public.tarefas ((metadata->>'lote'), responsavel, descricao)
  WHERE origem = 'obsidian_seed';

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tarefas_insert" ON public.tarefas;
DROP POLICY IF EXISTS "tarefas_select" ON public.tarefas;
DROP POLICY IF EXISTS "tarefas_update" ON public.tarefas;

CREATE POLICY "tarefas_insert" ON public.tarefas
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "tarefas_select" ON public.tarefas
  FOR SELECT
  USING (true);

CREATE POLICY "tarefas_update" ON public.tarefas
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
