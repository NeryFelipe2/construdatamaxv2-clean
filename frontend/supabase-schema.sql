-- ═══════════════════════════════════════════════════════════════
-- ConstruDataMax — Schema Supabase Completo
-- Execute no SQL Editor do Supabase Dashboard
-- ═══════════════════════════════════════════════════════════════

-- Projetos
CREATE TABLE IF NOT EXISTS projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  contrato TEXT DEFAULT '',
  cidade TEXT DEFAULT '',
  cliente TEXT DEFAULT '',
  tipo TEXT CHECK (tipo IN ('agua', 'esgoto', 'misto')) DEFAULT 'esgoto',
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  orcamento_total NUMERIC DEFAULT 0,
  status TEXT CHECK (status IN ('ativo', 'pausado', 'concluido')) DEFAULT 'ativo',
  responsavel_nome TEXT DEFAULT '',
  responsavel_telefone TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Frentes (sub-projetos)
CREATE TABLE IF NOT EXISTS frentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID REFERENCES projetos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  setor TEXT DEFAULT '',
  tipo_rede TEXT DEFAULT '',
  extensao_total NUMERIC DEFAULT 0,
  pvs_total INT DEFAULT 0,
  status TEXT CHECK (status IN ('ativa', 'pausada', 'concluida')) DEFAULT 'ativa'
);

-- Contatos (WhatsApp)
CREATE TABLE IF NOT EXISTS contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cargo TEXT NOT NULL,
  telefone_whatsapp TEXT NOT NULL,
  projeto_id UUID REFERENCES projetos(id) ON DELETE CASCADE,
  frente_id UUID REFERENCES frentes(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT TRUE,
  foto_url TEXT
);

-- RDOs
CREATE TABLE IF NOT EXISTS rdos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID REFERENCES projetos(id) ON DELETE CASCADE,
  frente_id UUID REFERENCES frentes(id) ON DELETE SET NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  clima TEXT DEFAULT 'Ensolarado',
  turno TEXT DEFAULT 'Diurno',
  status TEXT CHECK (status IN ('aberto', 'fechado')) DEFAULT 'aberto',
  fotos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rdo_equipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id UUID REFERENCES rdos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  lider_id UUID REFERENCES contatos(id) ON DELETE SET NULL,
  lider_nome TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS rdo_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID REFERENCES rdo_equipes(id) ON DELETE CASCADE,
  rua TEXT DEFAULT '',
  servico TEXT DEFAULT '',
  tubo TEXT DEFAULT '',
  metragem NUMERIC DEFAULT 0,
  pecas TEXT[] DEFAULT '{}',
  casas TEXT DEFAULT '',
  observacao TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS rdo_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id UUID REFERENCES rdos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade NUMERIC DEFAULT 0,
  unidade TEXT DEFAULT 'un'
);

CREATE TABLE IF NOT EXISTS rdo_equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id UUID REFERENCES rdos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  quantidade INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rdo_mao_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id UUID REFERENCES rdos(id) ON DELETE CASCADE,
  cargo TEXT NOT NULL,
  quantidade INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rdo_ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id UUID REFERENCES rdos(id) ON DELETE CASCADE,
  tipo TEXT DEFAULT 'Nenhuma',
  descricao TEXT DEFAULT ''
);

-- Punch List
CREATE TABLE IF NOT EXISTS punch_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID REFERENCES projetos(id) ON DELETE CASCADE,
  frente_id UUID REFERENCES frentes(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  localizacao TEXT DEFAULT '',
  responsavel TEXT DEFAULT '',
  prazo DATE,
  status TEXT CHECK (status IN ('aberto', 'em_correcao', 'resolvido')) DEFAULT 'aberto',
  foto_antes TEXT,
  foto_depois TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automacao (Fluxo Operacional)
CREATE TABLE IF NOT EXISTS automacao_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID REFERENCES projetos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  horario TEXT DEFAULT '07:00',
  destinatarios_cargo TEXT[] DEFAULT '{}',
  mensagem_template TEXT DEFAULT '',
  ativa BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS automacao_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id UUID REFERENCES automacao_regras(id) ON DELETE CASCADE,
  data TIMESTAMPTZ DEFAULT NOW(),
  destinatario TEXT DEFAULT '',
  status TEXT CHECK (status IN ('enviado', 'erro', 'pendente')) DEFAULT 'pendente'
);

-- Arquivos de projeto (DXF/DWG/IFC uploads)
CREATE TABLE IF NOT EXISTS arquivos_projeto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID REFERENCES projetos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT '',
  tamanho_bytes BIGINT DEFAULT 0,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security (RLS) — desabilitado por enquanto para dev
-- Habilitar depois com auth.uid() quando tiver autenticacao
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE frentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_mao_obra ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE punch_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE automacao_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE automacao_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE arquivos_projeto ENABLE ROW LEVEL SECURITY;

-- Policy: permitir tudo para anon key (dev mode)
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'projetos','frentes','contatos','rdos','rdo_equipes','rdo_atividades',
    'rdo_materiais','rdo_equipamentos','rdo_mao_obra','rdo_ocorrencias',
    'punch_list_items','automacao_regras','automacao_logs','arquivos_projeto'
  ]) LOOP
    EXECUTE format('CREATE POLICY "allow_all_%s" ON %I FOR ALL USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;
