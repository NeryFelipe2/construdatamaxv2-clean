#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
IMPORTA BIM NO CIVIL 3D VIA PYTHON
Importa dados BIM (JSON) no Civil 3D criando lines e circles

Uso:
  python importar_bim_civil3d.py bim_morro_do_teteu.json
"""

import json
import sys
from pathlib import Path

try:
    import comtypes
    from comtypes.client import GetActiveObject, CreateObject
except ImportError:
    print("❌ Erro: comtypes não instalado!")
    print("💡 Instale: pip install comtypes")
    sys.exit(1)


def importar_bim(json_path: str, camada: str = "CONSTRUDATA"):
    """
    Importa dados BIM no Civil 3D
    
    Args:
        json_path: Caminho do arquivo JSON BIM
        camada: Nome da camada no Civil 3D
    """
    
    print("="*70)
    print("IMPORTANDO BIM NO CIVIL 3D")
    print("="*70)
    
    # Verificar arquivo
    json_path = Path(json_path)
    if not json_path.exists():
        print(f"❌ Arquivo não encontrado: {json_path}")
        return False
    
    # Ler JSON
    print(f"\n📄 Lendo: {json_path.name}")
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ Erro ao ler JSON: {e}")
        return False
    
    structures = data.get('structures', [])
    pipes = data.get('pipes', [])
    
    print(f"  Structures: {len(structures)}")
    print(f"  Pipes: {len(pipes)}")
    
    # Conectar ao Civil 3D
    print("\n🔄 Conectando ao Civil 3D...")
    try:
        acad = GetActiveObject("AutoCAD.Application")
        doc = acad.ActiveDocument
        print("✅ Civil 3D conectado!")
    except Exception as e:
        print(f"❌ Erro: {e}")
        print("💡 Verifique se Civil 3D está aberto")
        return False
    
    # Criar camada se não existir
    try:
        layers = doc.Layers
        layer_exists = False
        
        for layer in layers:
            if layer.Name.upper() == camada.upper():
                layer_exists = True
                break
        
        if not layer_exists:
            layers.Add(camada)
            print(f"  Camada '{camada}' criada")
        else:
            print(f"  Camada '{camada}' já existe")
        
        doc.ActiveLayer = layers.Item(camada)
    except Exception as e:
        print(f"⚠️  Aviso: {e}")
    
    # Importar Structures (PVs) como circles
    print(f"\n🕳️  Importando {len(structures)} Structures (PVs)...")
    structures_imported = 0
    
    try:
        for structure in structures:
            name = structure.get('name', 'PV')
            x = structure.get('x', 0)
            y = structure.get('y', 0)
            rim = structure.get('rim_elevation', 0)
            diameter = structure.get('diameter', 1.2)  # metros
            
            # Criar circle
            center = CreateObject("AutoCAD.Point")
            center.SetData([x, y, rim])
            
            radius = diameter / 2  # metros
            
            circle = doc.ModelSpace.AddCircle(center, radius)
            circle.Layer = camada
            circle.Color = 3  # Green
            
            # Adicionar texto com nome
            text_pos = CreateObject("AutoCAD.Point")
            text_pos.SetData([x, y, rim + 0.5])
            
            text = doc.ModelSpace.AddText(name, text_pos, 0.5)
            text.Layer = camada
            text.Color = 7  # White
            
            structures_imported += 1
            
            if structures_imported % 10 == 0:
                print(f"  {structures_imported}/{len(structures)}...")
        
        print(f"✅ {structures_imported} Structures importadas!")
        
    except Exception as e:
        print(f"⚠️  Erro ao importar Structures: {e}")
    
    # Importar Pipes como lines
    print(f"\n🔵 Importando {len(pipes)} Pipes (Tubos)...")
    pipes_imported = 0
    
    try:
        # Criar dict de structures para busca rápida
        structures_dict = {s['name']: s for s in structures}
        
        for pipe in pipes:
            name = pipe.get('name', 'TUBO')
            start_name = pipe.get('start_structure', '')
            end_name = pipe.get('end_structure', '')
            diameter = pipe.get('diameter_mm', 200) / 1000  # mm → m
            
            # Encontrar structures
            start_pv = structures_dict.get(start_name)
            end_pv = structures_dict.get(end_name)
            
            if not start_pv or not end_pv:
                print(f"  ⚠️  {name}: Structures não encontradas")
                continue
            
            # Criar line
            start_pt = CreateObject("AutoCAD.Point")
            start_pt.SetData([
                start_pv['x'],
                start_pv['y'],
                start_pv['rim_elevation']
            ])
            
            end_pt = CreateObject("AutoCAD.Point")
            end_pt.SetData([
                end_pv['x'],
                end_pv['y'],
                end_pv['rim_elevation']
            ])
            
            line = doc.ModelSpace.AddLine(start_pt, end_pt)
            line.Layer = camada
            line.Color = 4  # Cyan
            
            # Adicionar texto com DN
            mid_x = (start_pv['x'] + end_pv['x']) / 2
            mid_y = (start_pv['y'] + end_pv['y']) / 2
            mid_z = (start_pv['rim_elevation'] + end_pv['rim_elevation']) / 2 + 0.3
            
            text_pos = CreateObject("AutoCAD.Point")
            text_pos.SetData([mid_x, mid_y, mid_z])
            
            dn_text = f"DN{int(diameter * 1000)}"
            text = doc.ModelSpace.AddText(dn_text, text_pos, 0.3)
            text.Layer = camada
            text.Color = 7  # White
            
            pipes_imported += 1
            
            if pipes_imported % 10 == 0:
                print(f"  {pipes_imported}/{len(pipes)}...")
        
        print(f"✅ {pipes_imported} Pipes importados!")
        
    except Exception as e:
        print(f"⚠️  Erro ao importar Pipes: {e}")
    
    # Zoom extents
    try:
        acad.ZoomExtents()
        print("\n🔍 Zoom extents aplicado")
    except:
        pass
    
    # Resumo
    print("\n" + "="*70)
    print("IMPORTAÇÃO CONCLUÍDA!")
    print("="*70)
    print(f"\n📊 RESUMO:")
    print(f"  Structures: {structures_imported}/{len(structures)}")
    print(f"  Pipes: {pipes_imported}/{len(pipes)}")
    print(f"  Camada: {camada}")
    print(f"\n💡 No Civil 3D:")
    print(f"  - Layer '{camada}' com todos os elementos")
    print(f"  - PVs: Circles verdes + textos brancos")
    print(f"  - Tubos: Lines cyan + textos de DN")
    print(f"  - Use LAYER para controlar visibilidade")
    
    return True


def main():
    """Função principal"""
    print("\n" + "="*70)
    print("CONSTRUDATA - IMPORTADOR BIM PARA CIVIL 3D")
    print("="*70)
    
    if len(sys.argv) < 2:
        print("\nUso:")
        print("  python importar_bim_civil3d.py <arquivo.json> [camada]")
        print("\nExemplo:")
        print("  python importar_bim_civil3d.py bim_morro_do_teteu.json")
        print("  python importar_bim_civil3d.py bim_pantanal_baixo.json CONSTRUDATA")
        print("\nRequisitos:")
        print("  - Civil 3D aberto")
        print("  - comtypes instalado (pip install comtypes)")
        print()
        sys.exit(1)
    
    json_file = sys.argv[1]
    layer_name = sys.argv[2] if len(sys.argv) > 2 else "CONSTRUDATA"
    
    sucesso = importar_bim(json_file, layer_name)
    
    if sucesso:
        print("\n✅ Sucesso!")
    else:
        print("\n❌ Falhou!")
        sys.exit(1)


if __name__ == "__main__":
    main()
