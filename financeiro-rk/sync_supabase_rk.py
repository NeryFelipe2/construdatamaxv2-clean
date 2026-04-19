"""
╔══════════════════════════════════════════════════════════════════════╗
║  SYNC SUPABASE — RK ENGENHARIA                                      ║
║  Sincroniza dados locais (MOTOR_EXCEL) → Supabase Cloud              ║
║                                                                      ║
║  Tabelas criadas/alimentadas:                                        ║
║    • lancamentos    — todos os lançamentos financeiros               ║
║    • custos_fixos   — custos mensais recorrentes por obra            ║
║    • funcionarios   — equipe por obra + salários                     ║
║    • expectativa_medicao — receitas projetadas por frente            ║
║                                                                      ║
║  Autor: Antigravity (para Felipe Nery)                               ║
║  Data: 2026-04-18                                                    ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import json
import urllib.request
import os
from datetime import datetime

# ═══════════════════════════════════════════════════════════════════
# CONFIGURAÇÕES SUPABASE
# ═══════════════════════════════════════════════════════════════════
SUPABASE_URL = "https://vblfdikfobsirwpdnybw.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibGZkaWtmb2JzaXJ3cGRueWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzAwODIsImV4cCI6MjA4ODk0NjA4Mn0.GOx3HoMh3P2Zzxz8BxNsfQBfXwsNZNQsdVc3nJaqRy4"

HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

HEADERS_UPSERT = {
    **HEADERS,
    "Prefer": "resolution=merge-duplicates,return=minimal",
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ═══════════════════════════════════════════════════════════════════
# MAPEAMENTO OBRAS → IDS DO SUPABASE
# ═══════════════════════════════════════════════════════════════════
OBRA_PROJECT_MAP = {
    'TATUI':    'ec112c9a-1669-4287-8079-526d6940ce82',
    'OSASCO':   'f3c6645b-347f-4382-b9c5-d103c27ec511',
    'SANTOS':   'd7a1c8f0-5e23-4b91-a6d2-8f3c9e1b4a70',
    'PARDINHO': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'CACHOEIRO': None,  # Ainda não tem projeto no Supabase
    'TEOFILO':  None,   # Ainda não tem projeto no Supabase
}


def supabase_request(endpoint, method="GET", data=None, headers=None):
    """Faz request para o Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    hdrs = headers or HEADERS
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        resp = urllib.request.urlopen(req)
        content = resp.read().decode('utf-8')
        return resp.status, json.loads(content) if content.strip() else []
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else ''
        return e.code, {'error': error_body}


def check_table_exists(table_name):
    """Verifica se tabela existe no Supabase."""
    status, _ = supabase_request(f"{table_name}?select=count&limit=0")
    return status == 200


def delete_all_from_table(table_name):
    """Limpa uma tabela (para re-sync)."""
    # Supabase exige um filtro, usamos um que pega tudo
    status, resp = supabase_request(
        f"{table_name}?id=gt.00000000-0000-0000-0000-000000000000",
        method="DELETE"
    )
    return status


# ═══════════════════════════════════════════════════════════════════
# 1. CARREGAR DADOS LOCAIS (do JSON gerado pelo MOTOR)
# ═══════════════════════════════════════════════════════════════════

def carregar_dados_json():
    """Carrega dados do dados_consolidados.json gerado pelo MOTOR_EXCEL."""
    json_path = os.path.join(BASE_DIR, 'dados_consolidados.json')
    if not os.path.exists(json_path):
        print(f"  ⚠️ Arquivo {json_path} não encontrado.")
        print(f"     Rode primeiro: python MOTOR_EXCEL_CONSOLIDADO_RK.py")
        return None
    
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


# ═══════════════════════════════════════════════════════════════════
# 2. SYNC LANÇAMENTOS
# ═══════════════════════════════════════════════════════════════════

def sync_lancamentos(data):
    """Sincroniza lançamentos financeiros para o Supabase."""
    print("\n📊 Sincronizando LANÇAMENTOS...")
    
    lancamentos = data.get('lancamentos', [])
    if not lancamentos:
        print("  ⚠️ Nenhum lançamento encontrado")
        return
    
    # Limpa tabela antes de re-inserir
    delete_all_from_table('lancamentos')
    
    # Prepara registros
    records = []
    for l in lancamentos:
        project_id = OBRA_PROJECT_MAP.get(l['obra'])
        records.append({
            'obra': l['obra'],
            'project_id': project_id,
            'data': l.get('data'),
            'categoria': l.get('categoria', ''),
            'subcategoria': l.get('subcategoria', ''),
            'forma_pagamento': l.get('forma_pagamento', ''),
            'valor': l.get('valor', 0),
            'descricao': l.get('descricao', ''),
        })
    
    # Insere em blocos de 50
    total_inserted = 0
    for i in range(0, len(records), 50):
        batch = records[i:i+50]
        status, resp = supabase_request('lancamentos', method='POST', data=batch)
        if status in (200, 201):
            total_inserted += len(batch)
        else:
            print(f"  ❌ Erro no batch {i}: {resp}")
    
    print(f"  ✅ {total_inserted}/{len(records)} lançamentos sincronizados")


# ═══════════════════════════════════════════════════════════════════
# 3. SYNC CUSTOS FIXOS (por projeto)
# ═══════════════════════════════════════════════════════════════════

def sync_custos_fixos():
    """Insere custos fixos mensais de cada obra no Supabase."""
    print("\n🔧 Sincronizando CUSTOS FIXOS...")
    
    if not check_table_exists('custos_fixos'):
        print("  ⚠️ Tabela 'custos_fixos' não existe no Supabase!")
        print("     → Crie via SQL Editor no Supabase Dashboard")
        print("     → Veja o SQL abaixo no arquivo gerado")
        return
    
    delete_all_from_table('custos_fixos')
    
    custos = [
        # ═══ PARDINHO ═══
        {'obra': 'PARDINHO', 'tipo': 'Equipamentos', 'descricao': 'Retro', 'valor_mensal': 16000},
        {'obra': 'PARDINHO', 'tipo': 'Equipamentos', 'descricao': 'Caminhão', 'valor_mensal': 14000},
        {'obra': 'PARDINHO', 'tipo': 'Mão de Obra', 'descricao': 'Moisés (Encarregado)', 'valor_mensal': 5800},
        {'obra': 'PARDINHO', 'tipo': 'Mão de Obra', 'descricao': 'Pedreiro', 'valor_mensal': 2664},
        {'obra': 'PARDINHO', 'tipo': 'Mão de Obra', 'descricao': 'Encanador', 'valor_mensal': 2664},
        {'obra': 'PARDINHO', 'tipo': 'Mão de Obra', 'descricao': 'Ajudante (1)', 'valor_mensal': 2200},
        {'obra': 'PARDINHO', 'tipo': 'Mão de Obra', 'descricao': 'Ajudante (2)', 'valor_mensal': 2200},
        {'obra': 'PARDINHO', 'tipo': 'Mão de Obra', 'descricao': 'Ajudante (3)', 'valor_mensal': 2200},
        {'obra': 'PARDINHO', 'tipo': 'Mão de Obra', 'descricao': 'Operador', 'valor_mensal': 5000},
        {'obra': 'PARDINHO', 'tipo': 'Mão de Obra', 'descricao': 'Motorista', 'valor_mensal': 3600},
        {'obra': 'PARDINHO', 'tipo': 'Administração', 'descricao': 'Hotel', 'valor_mensal': 10000},
        {'obra': 'PARDINHO', 'tipo': 'Administração', 'descricao': 'Restaurante', 'valor_mensal': 7500},
        {'obra': 'PARDINHO', 'tipo': 'Equipamentos', 'descricao': 'Carro do Ícaro', 'valor_mensal': 3200},
        {'obra': 'PARDINHO', 'tipo': 'Transporte', 'descricao': 'Posto (R$3000/sem)', 'valor_mensal': 12000},
        {'obra': 'PARDINHO', 'tipo': 'Mão de Obra', 'descricao': 'Ícaro', 'valor_mensal': 10000},
        # Total Pardinho: R$ 99.028/mês
        
        # ═══ OSASCO ═══ (estrutura similar a Pardinho conforme orientação)
        {'obra': 'OSASCO', 'tipo': 'Mão de Obra', 'descricao': 'Folha - Equipe 1 (2 ops)', 'valor_mensal': 40500},
        {'obra': 'OSASCO', 'tipo': 'Mão de Obra', 'descricao': 'Folha - Equipe 2 (2 ops)', 'valor_mensal': 40500},
        {'obra': 'OSASCO', 'tipo': 'Equipamentos', 'descricao': 'Máquinas & Equipamentos (Retro, gerador, etc)', 'valor_mensal': 54000},
        {'obra': 'OSASCO', 'tipo': 'Transporte', 'descricao': 'Combustível & Transportes', 'valor_mensal': 13500},
        {'obra': 'OSASCO', 'tipo': 'Administração', 'descricao': 'Imprevistos (Manutenção, repagos)', 'valor_mensal': 8100},
        {'obra': 'OSASCO', 'tipo': 'Aluguel', 'descricao': 'Caução Casa', 'valor_mensal': 13000},
        # Total Osasco: ~R$ 169.600/mês
        
        # ═══ TATUI ═══
        {'obra': 'TATUI', 'tipo': 'Aluguel', 'descricao': 'Aluguel do canteiro', 'valor_mensal': 3500},
        {'obra': 'TATUI', 'tipo': 'Equipamentos', 'descricao': 'Máquinas e Equipamentos base', 'valor_mensal': 20000},
        {'obra': 'TATUI', 'tipo': 'Transporte', 'descricao': 'Combustível Base', 'valor_mensal': 8000},
        {'obra': 'TATUI', 'tipo': 'Administração', 'descricao': 'Imprevistos', 'valor_mensal': 5000},
        
        # ═══ SANTOS ═══
        {'obra': 'SANTOS', 'tipo': 'Aluguel', 'descricao': 'Casas (Oficiais + Engenharia + Encarregados + Almox)', 'valor_mensal': 12450},
        {'obra': 'SANTOS', 'tipo': 'Equipamentos', 'descricao': 'ZAMLOC + Soldas + Frete', 'valor_mensal': 12000},
        {'obra': 'SANTOS', 'tipo': 'Mão de Obra', 'descricao': 'Encarregados (Pit, Angelo, Angelo Jr)', 'valor_mensal': 7683},
        {'obra': 'SANTOS', 'tipo': 'Administração', 'descricao': 'Escritório + Reembolsos', 'valor_mensal': 8000},
        {'obra': 'SANTOS', 'tipo': 'Utilidades', 'descricao': 'Luz + Água + Gás + Internet', 'valor_mensal': 2000},
        
        # ═══ TEOFILO ═══
        {'obra': 'TEOFILO', 'tipo': 'Mão de Obra', 'descricao': 'Wellington (Encarregado)', 'valor_mensal': 13000},
        {'obra': 'TEOFILO', 'tipo': 'Mão de Obra', 'descricao': 'Equipe (3 ajudantes + 2 pedreiros + operador)', 'valor_mensal': 21553},
        {'obra': 'TEOFILO', 'tipo': 'Administração', 'descricao': 'Reembolsos + Passagens', 'valor_mensal': 5272},
    ]
    
    # Adiciona project_id
    for c in custos:
        c['project_id'] = OBRA_PROJECT_MAP.get(c['obra'])
    
    status, resp = supabase_request('custos_fixos', method='POST', data=custos)
    if status in (200, 201):
        print(f"  ✅ {len(custos)} custos fixos sincronizados")
        
        # Totais por obra
        totais = {}
        for c in custos:
            totais[c['obra']] = totais.get(c['obra'], 0) + c['valor_mensal']
        for obra, total in sorted(totais.items()):
            print(f"     {obra:12s} → R$ {total:>12,.2f}/mês")
        print(f"     {'TOTAL':12s} → R$ {sum(totais.values()):>12,.2f}/mês")
    else:
        print(f"  ❌ Erro: {resp}")


# ═══════════════════════════════════════════════════════════════════
# 4. SYNC FUNCIONÁRIOS
# ═══════════════════════════════════════════════════════════════════

def sync_funcionarios(data):
    """Sincroniza dados de funcionários."""
    print("\n👷 Sincronizando FUNCIONÁRIOS...")
    
    if not check_table_exists('funcionarios'):
        print("  ⚠️ Tabela 'funcionarios' não existe. Criando via SQL...")
        return
    
    delete_all_from_table('funcionarios')
    
    funcionarios = data.get('funcionarios', [])
    records = []
    for f in funcionarios:
        records.append({
            'obra': f['obra'],
            'project_id': OBRA_PROJECT_MAP.get(f['obra']),
            'nome': f.get('nome', ''),
            'funcao': f.get('funcao', ''),
            'admissao': f.get('admissao'),
            'salario': f.get('salario', 0),
            'salario_encargos': f.get('salario_encargos', 0),
            'venc_experiencia': f.get('venc_experiencia'),
            'departamento': f.get('departamento', ''),
        })
    
    status, resp = supabase_request('funcionarios', method='POST', data=records)
    if status in (200, 201):
        print(f"  ✅ {len(records)} funcionários sincronizados")
    else:
        print(f"  ❌ Erro: {resp}")


# ═══════════════════════════════════════════════════════════════════
# 5. SYNC EXPECTATIVAS DE MEDIÇÃO
# ═══════════════════════════════════════════════════════════════════

def sync_expectativas():
    """Insere expectativas de medição por frente."""
    print("\n📈 Sincronizando EXPECTATIVAS DE MEDIÇÃO...")
    
    if not check_table_exists('expectativa_medicao'):
        print("  ⚠️ Tabela 'expectativa_medicao' não existe.")
        return
    
    delete_all_from_table('expectativa_medicao')
    
    expectativas = [
        {
            'obra': 'TATUI',
            'frente': 'Rede de Água - Angelo Jr',
            'responsavel': 'Angelo Jr',
            'valor_previsto': 278000,
            'project_id': OBRA_PROJECT_MAP.get('TATUI'),
        },
        {
            'obra': 'TATUI',
            'frente': 'Pesqueiro Esgoto - Moisés',
            'responsavel': 'Moisés',
            'valor_previsto': 317000,
            'project_id': OBRA_PROJECT_MAP.get('TATUI'),
        },
        {
            'obra': 'OSASCO',
            'frente': 'Esgoto - Tom',
            'responsavel': 'Tom',
            'valor_previsto': 275000,
            'project_id': OBRA_PROJECT_MAP.get('OSASCO'),
        },
        {
            'obra': 'OSASCO',
            'frente': 'Manutenção (hrs)',
            'responsavel': 'Mateus',
            'valor_previsto': 149000,
            'project_id': OBRA_PROJECT_MAP.get('OSASCO'),
        },
    ]
    
    status, resp = supabase_request('expectativa_medicao', method='POST', data=expectativas)
    if status in (200, 201):
        print(f"  ✅ {len(expectativas)} expectativas sincronizadas")
        total = sum(e['valor_previsto'] for e in expectativas)
        print(f"     TOTAL ESPERADO: R$ {total:>12,.2f}")
    else:
        print(f"  ❌ Erro: {resp}")


# ═══════════════════════════════════════════════════════════════════
# SQL PARA CRIAR TABELAS (rodar manualmente no Supabase Dashboard)
# ═══════════════════════════════════════════════════════════════════

SQL_CREATE_TABLES = """
-- ═══════════════════════════════════════════════════════════
-- RODAR NO SQL EDITOR DO SUPABASE (https://supabase.com/dashboard)
-- ═══════════════════════════════════════════════════════════

-- 1. CUSTOS FIXOS
CREATE TABLE IF NOT EXISTS custos_fixos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra VARCHAR(50) NOT NULL,
    project_id UUID REFERENCES projects(id),
    tipo VARCHAR(100) NOT NULL,
    descricao VARCHAR(255),
    valor_mensal NUMERIC(12,2) DEFAULT 0,
    mes_inicio VARCHAR(2) DEFAULT '01',
    mes_fim VARCHAR(2) DEFAULT '12',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FUNCIONÁRIOS
CREATE TABLE IF NOT EXISTS funcionarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra VARCHAR(50) NOT NULL,
    project_id UUID REFERENCES projects(id),
    nome VARCHAR(255) NOT NULL,
    funcao VARCHAR(100),
    admissao DATE,
    salario NUMERIC(12,2) DEFAULT 0,
    salario_encargos NUMERIC(12,2) DEFAULT 0,
    venc_experiencia DATE,
    departamento VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EXPECTATIVA DE MEDIÇÃO
CREATE TABLE IF NOT EXISTS expectativa_medicao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra VARCHAR(50) NOT NULL,
    project_id UUID REFERENCES projects(id),
    frente VARCHAR(255) NOT NULL,
    responsavel VARCHAR(100),
    valor_previsto NUMERIC(14,2) DEFAULT 0,
    valor_realizado NUMERIC(14,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pendente',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RDO DIÁRIO (para o WhatsApp)
CREATE TABLE IF NOT EXISTS rk_rdo_diario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    data_rdo DATE NOT NULL DEFAULT CURRENT_DATE,
    obra VARCHAR(50) NOT NULL,
    project_id UUID REFERENCES projects(id),
    engenheiro VARCHAR(255),
    telefone VARCHAR(50),
    producao_prevista NUMERIC(12,2) DEFAULT 0,
    producao_real NUMERIC(12,2) DEFAULT 0,
    custo_real_fixo NUMERIC(12,2) DEFAULT 0,
    custo_real_variavel NUMERIC(12,2) DEFAULT 0,
    observacoes TEXT,
    status VARCHAR(50) DEFAULT 'pendente'
);

-- RLS (Row Level Security) — Permitir acesso anon para leitura
ALTER TABLE custos_fixos ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE expectativa_medicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE rk_rdo_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read custos_fixos" ON custos_fixos FOR ALL USING (true);
CREATE POLICY "Allow anon read funcionarios" ON funcionarios FOR ALL USING (true);
CREATE POLICY "Allow anon read expectativa_medicao" ON expectativa_medicao FOR ALL USING (true);
CREATE POLICY "Allow anon read rk_rdo_diario" ON rk_rdo_diario FOR ALL USING (true);

-- 5. FLUXO DE CAIXA (PROJETADO vs EXECUTADO)
CREATE TABLE IF NOT EXISTS fluxo_caixa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    obra VARCHAR(100) NOT NULL,
    project_id UUID REFERENCES projects(id),
    frente VARCHAR(100),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PROJETADO', 'EXECUTADO')),
    valor NUMERIC(14,2) NOT NULL DEFAULT 0,
    data_lancamento DATE NOT NULL,
    fornecedor VARCHAR(255),
    categoria VARCHAR(100),
    descricao TEXT,
    url_comprovante TEXT,
    enviado_por_telefone VARCHAR(50)
);

ALTER TABLE fluxo_caixa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read fluxo_caixa" ON fluxo_caixa FOR SELECT USING (true);
CREATE POLICY "Allow anon insert fluxo_caixa" ON fluxo_caixa FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update fluxo_caixa" ON fluxo_caixa FOR UPDATE USING (true);

-- 6. ATUALIZAR TABELA LANCAMENTOS (caso precise de project_id)
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS obra VARCHAR(50);
"""


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

def main():
    print('╔══════════════════════════════════════════════════════════════════════╗')
    print('║  🔄 SYNC SUPABASE — RK ENGENHARIA                                  ║')
    print('║  📡 Dados Locais (Excel) → Supabase Cloud → ConstruData             ║')
    print('╚══════════════════════════════════════════════════════════════════════╝')
    print()

    # 1. Verificar tabelas
    print('🔍 Verificando tabelas no Supabase...')
    tabelas = ['projects', 'lancamentos', 'custos_fixos', 'funcionarios', 
               'expectativa_medicao', 'rk_rdo_diario', 'fluxo_caixa']
    
    tabelas_faltando = []
    for t in tabelas:
        exists = check_table_exists(t)
        status_icon = '✅' if exists else '❌'
        print(f"  {status_icon} {t}")
        if not exists:
            tabelas_faltando.append(t)
    
    if tabelas_faltando:
        print(f"\n⚠️ Tabelas faltando: {', '.join(tabelas_faltando)}")
        print("   Rode o SQL abaixo no Supabase Dashboard → SQL Editor:")
        print("   ─"*35)
        
        # Salva SQL em arquivo local para facilitar
        sql_path = os.path.join(BASE_DIR, 'supabase_create_tables.sql')
        with open(sql_path, 'w', encoding='utf-8') as f:
            f.write(SQL_CREATE_TABLES)
        print(f"   📄 SQL salvo em: {sql_path}")
        print(f"   → Copie e cole no SQL Editor do Supabase!")
        print()
    
    # 2. Carregar dados locais
    print('📂 Carregando dados locais...')
    data = carregar_dados_json()
    if not data:
        print("  ❌ Sem dados para sincronizar. Execute o MOTOR primeiro.")
        return
    
    total_lanc = len(data.get('lancamentos', []))
    total_func = len(data.get('funcionarios', []))
    print(f"  ✅ {total_lanc} lançamentos, {total_func} funcionários carregados")
    
    # 3. Sincronizar lançamentos
    if check_table_exists('lancamentos'):
        sync_lancamentos(data)
    
    # 4. Sincronizar custos fixos
    if check_table_exists('custos_fixos'):
        sync_custos_fixos()
    
    # 5. Sincronizar funcionários
    if check_table_exists('funcionarios'):
        sync_funcionarios(data)
    
    # 6. Sincronizar expectativas
    if check_table_exists('expectativa_medicao'):
        sync_expectativas()
    
    # Resumo final
    print()
    print('╔══════════════════════════════════════════════════════════════════════╗')
    print('║  ✅ SINCRONIZAÇÃO CONCLUÍDA                                         ║')
    print('╚══════════════════════════════════════════════════════════════════════╝')
    print(f'  📅 {datetime.now().strftime("%d/%m/%Y %H:%M")}')
    print(f'  🌐 {SUPABASE_URL}')
    print()


if __name__ == '__main__':
    main()
