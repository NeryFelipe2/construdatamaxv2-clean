"""
╔══════════════════════════════════════════════════════════════════════╗
║  SYNC BIDIRECIONAL — SUPABASE ↔ MOTOR EXCEL                        ║
║                                                                      ║
║  Modos:                                                              ║
║    1. PULL  → Baixa dados do Supabase → Gera Excel local            ║
║    2. PUSH  → Lê dados locais → Envia para Supabase                 ║
║    3. FULL  → Pull + Push (sincronização completa)                   ║
║                                                                      ║
║  Autor: Antigravity (para Felipe Nery)                               ║
║  Data: 2026-04-18                                                    ║
║  Integração: ConstruDataMax + Motor Excel RK                         ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import json
import urllib.request
import os
import sys
from datetime import datetime
from pathlib import Path

# ═══════════════════════════════════════════════════════════════════
# CONFIGURAÇÃO
# ═══════════════════════════════════════════════════════════════════

# Tenta ler do .env se existir
def load_env():
    """Carrega variáveis do .env"""
    env_paths = [
        Path(__file__).parent / '.env',
        Path(__file__).parent.parent / '.env',
        Path(os.path.expanduser('~')) / 'Desktop' / '_ORGANIZADO' / '01-OBRAS-RK' / '.env',
    ]
    for p in env_paths:
        if p.exists():
            with open(p, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, val = line.split('=', 1)
                        os.environ.setdefault(key.strip(), val.strip())
            return str(p)
    return None

env_file = load_env()

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://vblfdikfobsirwpdnybw.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY') or os.environ.get('SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

# Força o carregamento do env original se a chave ainda estiver vazia e do .env certo
if not SUPABASE_KEY:
    try:
        with open(r'C:\Users\felip\Desktop\_ORGANIZADO\01-OBRAS-RK\.env', 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('SUPABASE_KEY='):
                    SUPABASE_KEY = line.split('=', 1)[1].strip()
    except Exception:
        pass

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / 'output'
OUTPUT_DIR.mkdir(exist_ok=True)

# Mapa de obras
OBRAS_MAP = {
    'TATUI':    {'centro_custo': 'TAT', 'nome': 'Tatui / Cesario Lange'},
    'OSASCO':   {'centro_custo': 'OSA', 'nome': 'Osasco - Sabesp'},
    'SANTOS':   {'centro_custo': 'SAN', 'nome': 'Santos - Empreita RK'},
    'PARDINHO': {'centro_custo': 'PAR', 'nome': 'Pardinho - SES'},
    'CACHOEIRO':{'centro_custo': 'CAC', 'nome': 'Cachoeiro de Itapemirim'},
    'TEOFILO':  {'centro_custo': 'TEO', 'nome': 'Teofilo Otoni - MG'},
}


# ═══════════════════════════════════════════════════════════════════
# SUPABASE CLIENT (stdlib only - sem dependencia externa)
# ═══════════════════════════════════════════════════════════════════

def supabase_get(table, params=""):
    """GET do Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?{params}" if params else f"{SUPABASE_URL}/rest/v1/{table}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"  ERRO GET {table}: {e.code} - {e.read().decode()}")
        return []


def supabase_post(table, data, upsert=False):
    """POST para o Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    hdrs = {**HEADERS, "Prefer": "return=minimal"}
    if upsert:
        hdrs["Prefer"] = "resolution=merge-duplicates,return=minimal"
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers=hdrs, method='POST')
    try:
        resp = urllib.request.urlopen(req)
        return resp.status
    except urllib.error.HTTPError as e:
        print(f"  ERRO POST {table}: {e.code} - {e.read().decode()}")
        return e.code


def supabase_delete(table, filter_str):
    """DELETE do Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?{filter_str}"
    req = urllib.request.Request(url, headers=HEADERS, method='DELETE')
    try:
        resp = urllib.request.urlopen(req)
        return resp.status
    except urllib.error.HTTPError as e:
        return e.code


# ═══════════════════════════════════════════════════════════════════
# MODO 1: PULL — Supabase → JSON local → Motor Excel gera XLSX
# ═══════════════════════════════════════════════════════════════════

def pull_from_supabase():
    """Baixa todos os dados do Supabase e salva como JSON local."""
    print("\n=== PULL: Supabase -> Local ===\n")
    
    dados = {
        'timestamp': datetime.now().isoformat(),
        'source': 'supabase',
    }
    
    # 1. Lancamentos
    print("  Baixando lancamentos...")
    lancamentos = supabase_get('lancamentos_financeiros', 'select=*&order=data.desc')
    if not lancamentos:
        # Tenta tabela alternativa
        lancamentos = supabase_get('lancamentos', 'select=*&order=created_at.desc')
    dados['lancamentos'] = lancamentos
    print(f"    {len(lancamentos)} lancamentos")
    
    # 2. Fluxo de caixa
    print("  Baixando fluxo_caixa...")
    fluxo = supabase_get('fluxo_caixa', 'select=*&order=data.desc')
    dados['fluxo_caixa'] = fluxo
    print(f"    {len(fluxo)} registros de fluxo")
    
    # 3. Custos fixos
    print("  Baixando custos_fixos...")
    custos = supabase_get('custos_fixos', 'select=*')
    dados['custos_fixos'] = custos
    print(f"    {len(custos)} custos fixos")
    
    # 4. Funcionarios
    print("  Baixando funcionarios...")
    funcs = supabase_get('funcionarios', 'select=*')
    dados['funcionarios'] = funcs
    print(f"    {len(funcs)} funcionarios")
    
    # 5. Expectativa de medicao
    print("  Baixando expectativa_medicao...")
    expect = supabase_get('expectativa_medicao', 'select=*')
    dados['expectativas'] = expect
    print(f"    {len(expect)} expectativas")
    
    # 6. Tarefas
    print("  Baixando tarefas...")
    tarefas = supabase_get('tarefas', 'select=*&order=created_at.desc')
    dados['tarefas'] = tarefas
    print(f"    {len(tarefas)} tarefas")
    
    # Salvar
    output_path = OUTPUT_DIR / f'supabase_snapshot_{datetime.now().strftime("%Y%m%d_%H%M")}.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=2, default=str)
    
    # Salvar tambem como dados_consolidados.json (para o Motor ler)
    compat_path = BASE_DIR / 'dados_consolidados.json'
    with open(compat_path, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=2, default=str)
    
    print(f"\n  Salvo: {output_path}")
    print(f"  Compat: {compat_path}")
    
    return dados


# ═══════════════════════════════════════════════════════════════════
# MODO 2: PUSH — JSON/Excel local → Supabase
# ═══════════════════════════════════════════════════════════════════

def push_to_supabase(json_path=None):
    """Lê dados locais e envia para o Supabase."""
    print("\n=== PUSH: Local -> Supabase ===\n")
    
    # Carregar dados
    if json_path is None:
        json_path = BASE_DIR / 'dados_consolidados.json'
    
    if not Path(json_path).exists():
        print(f"  Arquivo nao encontrado: {json_path}")
        print(f"  Rode primeiro: python MOTOR_EXCEL_CONSOLIDADO_RK.py")
        return False
    
    with open(json_path, 'r', encoding='utf-8') as f:
        dados = json.load(f)
    
    total_sync = 0
    
    # 1. Lancamentos → fluxo_caixa (formato ConstruDataMax)
    lancamentos = dados.get('lancamentos', [])
    if lancamentos:
        print(f"  Sincronizando {len(lancamentos)} lancamentos...")
        
        records = []
        for l in lancamentos:
            obra = l.get('obra', 'OUTROS')
            centro = OBRAS_MAP.get(obra, {}).get('centro_custo', 'OUT')
            valor = float(l.get('valor', 0))
            
            records.append({
                'tipo': 'executado',
                'centro_custo': centro,
                'obra': obra,
                'plano_conta': categorizar_plano_conta(l.get('subcategoria', '')),
                'plano_conta_desc': l.get('subcategoria', ''),
                'valor': abs(valor),
                'descricao': l.get('descricao', ''),
                'data': l.get('data', datetime.now().strftime('%Y-%m-%d')),
                'lancado_por': l.get('responsavel', 'Motor Excel'),
                'status': 'aprovado',
            })
        
        # Enviar em blocos de 50
        for i in range(0, len(records), 50):
            batch = records[i:i+50]
            status = supabase_post('fluxo_caixa', batch)
            if status in (200, 201):
                total_sync += len(batch)
            else:
                print(f"    Erro no batch {i//50 + 1}")
        
        print(f"    {total_sync}/{len(records)} lancamentos sincronizados")
    
    # 2. Funcionarios
    funcionarios = dados.get('funcionarios', [])
    if funcionarios:
        print(f"  Sincronizando {len(funcionarios)} funcionarios...")
        func_records = []
        for f in funcionarios:
            func_records.append({
                'obra': f.get('obra', ''),
                'nome': f.get('nome', ''),
                'funcao': f.get('funcao', ''),
                'salario': float(f.get('salario', 0)),
                'salario_encargos': float(f.get('salario_encargos', 0)),
                'departamento': f.get('departamento', ''),
            })
        
        status = supabase_post('funcionarios', func_records)
        if status in (200, 201):
            print(f"    {len(func_records)} funcionarios sincronizados")
        else:
            print(f"    Erro ao sincronizar funcionarios")
    
    print(f"\n  Total sincronizado: {total_sync} registros")
    return True


def categorizar_plano_conta(subcategoria):
    """Mapeia subcategoria do Excel -> codigo do plano de contas."""
    sub_lower = (subcategoria or '').lower()
    
    mapa = {
        'material': 'MAT',
        'mao de obra': 'MDO', 'folha': 'MDO', 'salario': 'MDO',
        'diesel': 'DSL', 'combusti': 'DSL', 'posto': 'DSL',
        'alimenta': 'ALM', 'restaurante': 'ALM', 'refeicao': 'ALM',
        'aluguel': 'AEQ', 'equipamento': 'AEQ', 'maquin': 'AEQ',
        'transporte': 'TRF', 'frete': 'TRF',
        'ferramenta': 'FER',
        'epi': 'EPI', 'segur': 'EPI',
        'servico': 'SVC', 'terceirizado': 'SVC',
        'administ': 'ADM', 'escritorio': 'ADM',
        'imposto': 'IMP', 'taxa': 'IMP', 'inss': 'IMP', 'fgts': 'IMP',
    }
    
    for keyword, codigo in mapa.items():
        if keyword in sub_lower:
            return codigo
    
    return 'OUT'  # Outros


# ═══════════════════════════════════════════════════════════════════
# MODO 3: FULL — Pull + Push
# ═══════════════════════════════════════════════════════════════════

def full_sync():
    """Sincronizacao completa bidirecional."""
    print("=" * 60)
    print("  SYNC BIDIRECIONAL COMPLETO")
    print("  Supabase <-> Motor Excel RK")
    print("=" * 60)
    
    # 1. Pull
    dados = pull_from_supabase()
    
    # 2. Push (dados locais que nao estao no Supabase)
    local_json = BASE_DIR / 'dados_consolidados.json'
    if local_json.exists():
        push_to_supabase(local_json)
    
    # 3. Gerar relatorio
    gerar_relatorio_sync(dados)
    
    print("\n" + "=" * 60)
    print("  SYNC COMPLETO!")
    print(f"  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print("=" * 60)


def gerar_relatorio_sync(dados):
    """Gera relatorio de sincronizacao."""
    report = []
    report.append(f"# Relatorio de Sync — {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    report.append("")
    
    for key in ['lancamentos', 'fluxo_caixa', 'custos_fixos', 'funcionarios', 'expectativas', 'tarefas']:
        items = dados.get(key, [])
        report.append(f"- **{key}**: {len(items)} registros")
    
    report_path = OUTPUT_DIR / f'sync_report_{datetime.now().strftime("%Y%m%d")}.md'
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report))
    
    print(f"\n  Relatorio: {report_path}")


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

def main():
    print()
    print("==============================================================")
    print("  SYNC BIDIRECIONAL — SUPABASE <-> MOTOR EXCEL RK           ")
    print("  ConstruDataMax Gestao 360                                 ")
    print("==============================================================")
    print()
    
    if env_file:
        print(f"  .env carregado de: {env_file}")
    else:
        print("  Sem .env encontrado, usando variaveis de ambiente")
    
    print()
    print("  Comandos disponiveis:")
    print("    pull  — Baixa dados do Supabase para local")
    print("    push  — Envia dados locais para o Supabase")
    print("    full  — Sincronizacao completa (pull + push)")
    print()
    
    mode = 'full'
    if len(sys.argv) > 1:
        mode = sys.argv[1].lower()
    
    if mode == 'pull':
        pull_from_supabase()
    elif mode == 'push':
        push_to_supabase()
    elif mode == 'full':
        full_sync()
    else:
        print(f"  Modo desconhecido: {mode}")
        print(f"  Use: python sync_bidirecional.py [pull|push|full]")


if __name__ == '__main__':
    main()
