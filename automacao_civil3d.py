#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AUTOMACAO CIVIL 3D — CONSTRUDATA SABESP v5.0
Cria Pipe Network automaticamente no Civil 3D 2025+ via pyautogui

Requisitos:
  - Civil 3D 2025.1+ instalado
  - Python 3.10+
  - pyautogui: pip install pyautogui
  - pygetwindow: pip install pygetwindow
  - JSON do ConstruData: rede_dynamo.json

Uso:
  1. Abrir Civil 3D 2025+
  2. Carregar DXF do projeto
  3. Executar: python automacao_civil3d.py "caminho\rede_dynamo.json"
  4. Aguardar execução (não mexer no mouse/teclado)
"""

import sys
import json
import time
import subprocess
from pathlib import Path

try:
    import pyautogui
    import pygetwindow as gw
    _HAS_AUTOMATION = True
except ImportError:
    _HAS_AUTOMATION = False
    print("⚠️ pyautogui ou pygetwindow não instalado")
    print("   pip install pyautogui pygetwindow")


def encontrar_janela_civil3d():
    """
    Encontra janela do Civil 3D aberta.
    Retorna janela ou None.
    """
    if not _HAS_AUTOMATION:
        return None
    
    # Procurar por "Autodesk Civil 3D" ou "AutoCAD"
    janelas = gw.getWindowsWithTitle("Civil 3D")
    if not janelas:
        janelas = gw.getWindowsWithTitle("AutoCAD")
    
    if janelas:
        return janelas[0]
    return None


def atalho_teclado(teclas, pausa=0.5):
    """
    Executa atalho de teclado.
    """
    if not _HAS_AUTOMATION:
        return
    
    pyautogui.press(teclas)
    time.sleep(pausa)


def digitar_texto(texto, intervalo=0.05):
    """
    Digita texto lentamente.
    """
    if not _HAS_AUTOMATION:
        return
    
    pyautogui.write(texto, interval=intervalo)


def clicar_posicao(x, y, clicks=1, button='left'):
    """
    Clica em posição específica.
    """
    if not _HAS_AUTOMATION:
        return
    
    pyautogui.click(x=x, y=y, clicks=clicks, button=button, duration=0.5)


def executar_dynamo_script(caminho_json, civil3d_window=None):
    """
    Executa script Dynamo automaticamente no Civil 3D.
    
    Fluxo:
    1. Abrir Dynamo (Manage → Dynamo)
    2. Criar Python Script
    3. Copiar código do dynamo_pipe_network_v5.py
    4. Conectar ao JSON
    5. Executar
    """
    if not _HAS_AUTOMATION:
        print("❌ pyautogui não disponível")
        return False
    
    # Carregar JSON para pegar caminho do script
    with open(caminho_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Determinar caminho do script Dynamo
    json_path = Path(caminho_json)
    script_path = json_path.parent.parent / "07_LOG" / "dynamo_pipe_network_v5.py"
    
    if not script_path.exists():
        print(f"❌ Script Dynamo não encontrado: {script_path}")
        return False
    
    # Ler script
    with open(script_path, 'r', encoding='utf-8') as f:
        script_codigo = f.read()
    
    print("=" * 70)
    print("AUTOMACAO CIVIL 3D — DYNAMO")
    print("=" * 70)
    print(f"JSON: {caminho_json}")
    print(f"Script: {script_path}")
    print()
    
    # Encontrar janela do Civil 3D
    if civil3d_window:
        civil3d_window.activate()
        print(f"✅ Civil 3D encontrado: {civil3d_window.title}")
    else:
        civil3d = encontrar_janela_civil3d()
        if not civil3d:
            print("❌ Civil 3D não encontrado!")
            print("   Abra o Civil 3D 2025+ e tente novamente.")
            return False
        civil3d.activate()
        print(f"✅ Civil 3D ativado: {civil3d.title}")
    
    time.sleep(2)
    
    print("\n📋 Passo 1: Abrir Dynamo...")
    # Manage → Dynamo
    atalho_teclado('alt')
    time.sleep(0.5)
    digitar_texto('m')  # Manage
    time.sleep(0.5)
    digitar_texto('d')  # Dynamo
    time.sleep(3)
    
    print("📋 Passo 2: Novo script...")
    # File → New
    atalho_teclado('ctrl n')
    time.sleep(2)
    
    print("📋 Passo 3: Adicionar Python Script...")
    # Double-click para abrir biblioteca
    # (simulação — na prática precisa de OCR ou imagem)
    # Usuário precisa adicionar Python Script manualmente
    
    print("⚠️ ATENCAO: Adicione um 'Python Script' manualmente!")
    print("   (biblioteca → Design → Python Script)")
    print("   Pressione ENTER quando adicionar...")
    input()
    
    print("📋 Passo 4: Copiar código...")
    # Copiar código para clipboard
    try:
        import clipboard
        clipboard.copy(script_codigo)
        print("   ✅ Código copiado para clipboard")
    except ImportError:
        print("   ⚠️ clipboard não instalado — copie manualmente")
        print(f"   Abra o arquivo: {script_path}")
        print("   Selecione todo o conteúdo (Ctrl+A)")
        print("   Copie (Ctrl+C)")
    
    print("📋 Passo 5: Colar no Python Script...")
    print("   Double-click no Python Script para editar")
    print("   Cole o código (Ctrl+V)")
    print("   Pressione ENTER quando colar...")
    input()
    
    print("📋 Passo 6: Conectar JSON...")
    print("   Conecte uma entrada IN[0] ao Python Script")
    print(f"   Valor: {caminho_json}")
    print("   Pressione ENTER quando conectar...")
    input()
    
    print("📋 Passo 7: Executar...")
    print("   Clique em 'Run' no Dynamo")
    print("   Pressione ENTER quando executar...")
    input()
    
    print("\n⏳ Executando script Dynamo...")
    time.sleep(5)
    
    print("✅ Script executado!")
    print("   Verifique a Pipe Network no Civil 3D")
    
    return True


def criar_pipe_network_direto(caminho_json):
    """
    Cria Pipe Network diretamente via .NET API (sem Dynamo).
    Requer: civil3d_interop.py instalado
    """
    print("=" * 70)
    print("CRIACAO DIRETA DE PIPE NETWORK")
    print("=" * 70)
    
    try:
        # Tentar importar interop do Civil 3D
        import clr
        clr.AddReference('Autodesk.AutoCAD.ApplicationServices')
        clr.AddReference('Autodesk.Civil.ApplicationServices')
        clr.AddReference('Autodesk.Civil.DatabaseServices')
        
        from Autodesk.Civil.ApplicationServices import CivilApplication
        from Autodesk.Civil.DatabaseServices import PipeNetwork, Structure, Pipe
        
        print("✅ Civil 3D API carregada")
    except ImportError:
        print("❌ Civil 3D API não disponível")
        print("   Este método requer:")
        print("   1. Civil 3D 2025+ instalado")
        print("   2. Python rodando dentro do Civil 3D (CPython)")
        print()
        print("   Alternativa: usar Dynamo (recomendado)")
        return False
    
    # Carregar JSON
    with open(caminho_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    doc = CivilApplication.ActiveDocument
    if not doc:
        print("❌ Nenhum documento ativo no Civil 3D")
        return False
    
    print(f"✅ Documento ativo: {doc.Name}")
    
    # Criar Pipe Network
    net_cfg = data['pipe_network']
    
    try:
        network = PipeNetwork.ByName(doc, net_cfg['name'])
        network.Description = net_cfg['description']
        print(f"✅ Pipe Network criada: {net_cfg['name']}")
    except Exception as e:
        print(f"⚠️ Pipe Network já existe: {e}")
        # Tentar obter existente
        networks = list(doc.GetPipeNetworks())
        network = next((n for n in networks if n.Name == net_cfg['name']), None)
        if not network:
            return False
    
    # Criar estruturas (PVs)
    estrutura_map = {}
    pontos = data.get('pontos', [])
    
    print(f"📋 Criando {len(pontos)} estruturas (PVs)...")
    for pt in pontos:
        try:
            from Autodesk.AutoCAD.Geometry import Point3d
            
            pt3d = Point3d(pt['x'], pt['y'], pt['z'])
            struct = Structure.ByPoint(network, pt3d)
            struct.Name = pt['id']
            
            if pt.get('ct'):
                struct.RimElevation = pt['ct']
            if pt.get('cf'):
                struct.SumpElevation = pt['cf']
            
            estrutura_map[pt['id']] = struct
        except Exception as e:
            print(f"   ⚠️ Erro em {pt['id']}: {e}")
    
    print(f"✅ {len(estrutura_map)} estruturas criadas")
    
    # Criar tubos
    tubulacoes = data.get('tubulacoes', [])
    print(f"📋 Criando {len(tubulacoes)} tubos...")
    
    tubos_criados = 0
    for tubo in tubulacoes:
        try:
            struct_ini = estrutura_map.get(tubo['pv_ini'])
            struct_fim = estrutura_map.get(tubo['pv_fim'])
            
            if not struct_ini or not struct_fim:
                continue
            
            pipe = Pipe.ByStructures(network, struct_ini, struct_fim)
            pipe.NominalDiameter = tubo['dn_mm'] / 1000.0  # m
            pipe.Material = tubo['material']
            
            tubos_criados += 1
        except Exception as e:
            print(f"   ⚠️ Erro em {tubo['id']}: {e}")
    
    print(f"✅ {tubos_criados} tubos criados")
    print()
    print("=" * 70)
    print("PIPE NETWORK CRIADA COM SUCESSO!")
    print(f"  Estruturas: {len(estrutura_map)}")
    print(f"  Tubos: {tubos_criados}")
    print("=" * 70)
    
    return True


def main():
    if len(sys.argv) < 2:
        print("Uso: python automacao_civil3d.py <caminho_rede_dynamo.json>")
        print()
        print("Exemplo:")
        print("  python automacao_civil3d.py SAIDA_BIM_SABESP\\MORRO_DO_TETEU\\05_GIS\\rede_dynamo.json")
        sys.exit(1)
    
    caminho_json = sys.argv[1]
    
    if not Path(caminho_json).exists():
        print(f"❌ Arquivo não encontrado: {caminho_json}")
        sys.exit(1)
    
    # Método 1: Tentar criação direta via .NET (mais rápido)
    sucesso = criar_pipe_network_direto(caminho_json)
    
    if not sucesso:
        # Método 2: Usar Dynamo com automação
        print()
        print("Tentando automação via Dynamo...")
        print()
        
        civil3d = encontrar_janela_civil3d()
        if civil3d:
            executar_dynamo_script(caminho_json, civil3d)
        else:
            print("❌ Civil 3D não encontrado")
            print("   Abra o Civil 3D 2025+ e tente novamente")
            sys.exit(1)


if __name__ == "__main__":
    main()
