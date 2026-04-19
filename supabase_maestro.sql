-- ============================================================
-- SUPABASE: Tabela maestro_snapshots
-- ConstruDataMax Gestão 360 · Motor Maestro Lote
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.maestro_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    ts              TEXT NOT NULL,                    -- ex: "20260419_1800"
    rodado_em       TIMESTAMPTZ DEFAULT now(),
    obras_total     INTEGER DEFAULT 0,
    obras_criticas  INTEGER DEFAULT 0,
    saldo_geral     NUMERIC(15,2) DEFAULT 0,
    gap_financeiro  NUMERIC(15,2) DEFAULT 0,
    payload_json    TEXT,                             -- JSON completo do snapshot
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_maestro_ts ON public.maestro_snapshots(ts DESC);
CREATE INDEX IF NOT EXISTS idx_maestro_criticas ON public.maestro_snapshots(obras_criticas);

-- RLS: só service_role pode inserir
ALTER TABLE public.maestro_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_insert" ON public.maestro_snapshots
    FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "service_role_select" ON public.maestro_snapshots
    FOR SELECT TO service_role USING (true);

-- View para últimos 30 dias (útil para dashboards)
CREATE OR REPLACE VIEW public.maestro_ultimos_30 AS
SELECT
    ts,
    rodado_em,
    obras_total,
    obras_criticas,
    saldo_geral,
    gap_financeiro
FROM public.maestro_snapshots
WHERE rodado_em >= now() - INTERVAL '30 days'
ORDER BY rodado_em DESC;

COMMENT ON TABLE public.maestro_snapshots IS
    'Snapshots diários do Motor Maestro Lote — ConstruDataMax Gestão 360';
