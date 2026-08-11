-- ============================================================================
-- Custos - tabela canonica e compatibilidade com lancamentos_financeiros
-- Projeto Supabase: vblfdikfobsirwpdnybw
-- Execute no Supabase SQL Editor.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.custos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'DESPESA',
  unidade TEXT,
  quantidade NUMERIC(14,3),
  custo_unitario NUMERIC(14,2),
  responsavel TEXT,
  origem TEXT NOT NULL DEFAULT 'manual',
  origem_ref TEXT,
  rdo_id UUID,
  ns_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custos_project_id ON public.custos(project_id);
CREATE INDEX IF NOT EXISTS idx_custos_data ON public.custos(data DESC);
CREATE INDEX IF NOT EXISTS idx_custos_categoria ON public.custos(categoria);
CREATE INDEX IF NOT EXISTS idx_custos_tipo ON public.custos(tipo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_custos_origem_ref
  ON public.custos(origem, origem_ref)
  WHERE origem_ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_updated_at_custos()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_custos ON public.custos;
CREATE TRIGGER trg_set_updated_at_custos
  BEFORE UPDATE ON public.custos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_custos();

ALTER TABLE public.custos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_custos" ON public.custos;
CREATE POLICY "anon_select_custos" ON public.custos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_insert_custos" ON public.custos;
CREATE POLICY "anon_insert_custos" ON public.custos
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_custos" ON public.custos;
CREATE POLICY "anon_update_custos" ON public.custos
  FOR UPDATE USING (true) WITH CHECK (true);

-- Copia os lancamentos ja existentes para a tabela canonica.
-- Mantem lancamentos_financeiros intacta, pois o router n8n atual grava nela.
INSERT INTO public.custos (
  project_id,
  data,
  categoria,
  descricao,
  valor,
  tipo,
  responsavel,
  origem,
  origem_ref,
  metadata,
  created_at
)
SELECT
  lf.project_id,
  COALESCE(lf.data, CURRENT_DATE),
  lf.categoria,
  lf.descricao,
  lf.valor,
  lf.tipo,
  lf.criado_por,
  'lancamentos_financeiros',
  lf.id::text,
  jsonb_build_object('lancamento_id', lf.id::text, 'criado_por', lf.criado_por),
  COALESCE(lf.created_at, NOW())
FROM public.lancamentos_financeiros lf
ON CONFLICT (origem, origem_ref) WHERE origem_ref IS NOT NULL
DO UPDATE SET
  project_id = EXCLUDED.project_id,
  data = EXCLUDED.data,
  categoria = EXCLUDED.categoria,
  descricao = EXCLUDED.descricao,
  valor = EXCLUDED.valor,
  tipo = EXCLUDED.tipo,
  responsavel = EXCLUDED.responsavel,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

CREATE OR REPLACE VIEW public.vw_custos_unificados AS
SELECT
  c.id::text AS id,
  c.project_id,
  c.data,
  c.categoria,
  c.subcategoria,
  c.descricao,
  c.valor,
  c.tipo,
  c.responsavel,
  c.origem,
  c.origem_ref,
  c.created_at,
  c.metadata
FROM public.custos c
UNION ALL
SELECT
  lf.id::text AS id,
  lf.project_id,
  lf.data,
  lf.categoria,
  NULL::text AS subcategoria,
  lf.descricao,
  lf.valor,
  lf.tipo,
  lf.criado_por AS responsavel,
  'lancamentos_financeiros' AS origem,
  lf.id::text AS origem_ref,
  lf.created_at,
  jsonb_build_object('lancamento_id', lf.id::text, 'criado_por', lf.criado_por) AS metadata
FROM public.lancamentos_financeiros lf
WHERE NOT EXISTS (
  SELECT 1
  FROM public.custos c
  WHERE c.origem = 'lancamentos_financeiros'
    AND c.origem_ref = lf.id::text
);

SELECT
  'custos' AS tabela,
  COUNT(*) AS total_registros
FROM public.custos;
