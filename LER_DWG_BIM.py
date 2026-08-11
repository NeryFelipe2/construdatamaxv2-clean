#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LER_DWG_BIM.py — Lê Pipe Network DIRECTAMENTE da API do Civil 3D

DIFERENÇA do ler_dwg_aec.py:
- ler_dwg_aec.py: Converte DWG→DXF e lê textos (perde cotas BIM)
- ler_dwg_bim.py: Lê DIRECTAMENTE via COM/Civil 3D API (mantém TODOS dados BIM)

USO:
  python LER_DWG_BIM.py "CAMINHO\ARQUIVO.dwg"
"""

import sys
import os
from pathlib import Path

# Adicionar path
sys.path.insert(0, str(Path(__file__).parent))

print("="*70)
print("LER PIPE NETWORK DO CIVIL 3D - LEITURA DIRETA BIM")
print("="*70)

DWG_PATH = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA.dwg"

if len(sys.argv) > 1:
    DWG_PATH = sys.argv[1]

print(f"\nArquivo: {Path(DWG_PATH).name}")
print(f"Existe: {os.path.exists(DWG_PATH)}")

# Tentar leitura via COM
print("\n1. Tentando via win32com (AutoCAD/Civil 3D COM API)...")

try:
    import win32com.client
    print("   ✅ win32com disponível")
    
    # Abrir Civil 3D
    print("\n2. Abrindo Civil 3D...")
    acad_versions = [
        ("AutoCAD.Application.24.1", "Civil 3D 2026"),
        ("AutoCAD.Application.24.0", "Civil 3D 2025"),
        ("AutoCAD.Application.23.0", "AutoCAD 2025"),
        ("AutoCAD.Application.22.0", "AutoCAD 2024"),
        ("AutoCAD.Application", "AutoCAD (genérico)"),
    ]
    
    acad = None
    for version, name in acad_versions:
        try:
            acad = win32com.client.Dispatch(version)
            print(f"   ✅ {name} aberto")
            break
        except Exception as e:
            continue
    
    if not acad:
        print("   ❌ Não conseguiu abrir Civil 3D/AutoCAD")
        print("      Possíveis causas:")
        print("      1. Civil 3D não está instalado")
        print("      2. Civil 3D está em uso e travado")
        print("      3. Registro COM não está registrado")
        print("\n      Solução: Abra o Civil 3D manualmente e tente novamente")
        sys.exit(1)
    
    # Abrir DWG
    print(f"\n3. Abrindo DWG: {DWG_PATH}...")
    try:
        doc = acad.Documents.Open(DWG_PATH, False, True)  # ReadOnly, NoConvert
        print(f"   ✅ DWG aberto: {doc.Name}")
    except Exception as e:
        print(f"   ❌ Erro ao abrir DWG: {e}")
        sys.exit(1)
    
    # Tentar acessar Pipe Networks via COM
    print("\n4. Buscando Pipe Networks...")
    
    # Método 1: Via coleção de objetos do drawing
    try:
        # Iterar sobre todos objetos do modelo
        msp = doc.ModelSpace
        print(f"   ModelSpace tem {msp.Count} entidades")
        
        pipe_networks = []
        structures = []
        pipes = []
        
        for i in range(msp.Count):
            try:
                obj = msp.Item(i)
                typename = str(obj.ObjectName)
                
                if "Aecc" in typename:
                    if "PipeNetwork" in typename:
                        pipe_networks.append(obj)
                        print(f"   ✅ Pipe Network: {obj.Name if hasattr(obj, 'Name') else 'Sem nome'}")
                    elif "Structure" in typename:
                        structures.append(obj)
                    elif "Pipe" in typename:
                        pipes.append(obj)
            except:
                pass
        
        print(f"\n   Resumo:")
        print(f"     Pipe Networks: {len(pipe_networks)}")
        print(f"     Structures (PVs): {len(structures)}")
        print(f"     Pipes (Tubos): {len(pipes)}")
        
        # Extrair dados das Structures
        if structures:
            print(f"\n5. Extraindo dados das Structures (PVs)...")
            pvs = {}
            
            for i, struct in enumerate(structures[:20]):  # Primeiros 20
                try:
                    nome = struct.Name if hasattr(struct, 'Name') else f"PV_{i}"
                    
                    # Coordenadas
                    x, y, z = 0, 0, 0
                    if hasattr(struct, 'Origin'):
                        x = struct.Origin[0]
                        y = struct.Origin[1]
                        z = struct.Origin[2]
                    
                    # Cotas
                    ct = struct.RimElevation if hasattr(struct, 'RimElevation') else 0
                    cf = struct.SumpElevation if hasattr(struct, 'SumpElevation') else 0
                    prof = ct - cf if ct and cf else 0
                    
                    pvs[nome] = {
                        'x': round(x, 3),
                        'y': round(y, 3),
                        'ct': round(ct, 3),
                        'cf': round(cf, 3),
                        'prof': round(prof, 3),
                        'tipo': str(struct.StructureType) if hasattr(struct, 'StructureType') else 'PV'
                    }
                    
                    print(f"   {nome}: CT={ct:.3f}, CF={cf:.3f}, Prof={prof:.3f} @({x:.1f},{y:.1f})")
                    
                except Exception as e:
                    print(f"   ⚠️ Erro em structure {i}: {e}")
            
            # Extrair dados dos Pipes
            if pipes:
                print(f"\n6. Extraindo dados dos Pipes (Tubos)...")
                trechos = []
                
                for i, pipe in enumerate(pipes[:20]):  # Primeiros 20
                    try:
                        # PVs de início e fim
                        pv_ini = pipe.StartStructure.Name if hasattr(pipe, 'StartStructure') and pipe.StartStructure else f"PV_INI_{i}"
                        pv_fim = pipe.EndStructure.Name if hasattr(pipe, 'EndStructure') and pipe.EndStructure else f"PV_FIM_{i}"
                        
                        # Dados do tubo
                        dn = pipe.Diameter * 1000 if hasattr(pipe, 'Diameter') else 200  # mm
                        ext = pipe.Length if hasattr(pipe, 'Length') else 0
                        decl = pipe.Slope if hasattr(pipe, 'Slope') else 0
                        
                        # Material
                        mat = str(pipe.Material) if hasattr(pipe, 'Material') else "PVC"
                        
                        trechos.append({
                            'pv_ini': pv_ini,
                            'pv_fim': pv_fim,
                            'dn_mm': int(dn),
                            'ext_m': round(ext, 2),
                            'decl_pct': round(decl * 100, 3),
                            'material': mat
                        })
                        
                        print(f"   {pv_ini} → {pv_fim}: DN{dn}mm, L={ext:.2f}m, I={decl*100:.2f}%")
                        
                    except Exception as e:
                        print(f"   ⚠️ Erro em pipe {i}: {e}")
            
            # Salvar resultado
            print(f"\n7. Salvando dados extraídos...")
            
            import json
            resultado = {
                'arquivo': str(DWG_PATH),
                'pvs': pvs,
                'trechos': trechos,
                'estatisticas': {
                    'total_pvs': len(pvs),
                    'total_trechos': len(trechos),
                    'pvs_com_cotas': len([p for p in pvs.values() if p['ct'] > 0])
                }
            }
            
            saida = Path(DWG_PATH).parent / f"{Path(DWG_PATH).stem}_BIM.json"
            with open(saida, 'w', encoding='utf-8') as f:
                json.dump(resultado, f, indent=2, ensure_ascii=False)
            
            print(f"   ✅ Dados salvos em: {saida}")
            print(f"\n   RESUMO:")
            print(f"     PVs: {len(pvs)} ({resultado['estatisticas']['pvs_com_cotas']} com cotas)")
            print(f"     Trechos: {len(trechos)}")
            
            # Fechar DWG
            doc.Close(False)
            print(f"\n✅ LEITURA BIM CONCLUÍDA!")
            
        else:
            print(f"\n   ⚠️ Nenhuma Structure (PV) encontrada!")
            print(f"   O DWG pode não ter Pipe Network do Civil 3D")
            print(f"   Ou pode estar em formato Proxy (precisa converter)")
            
    except Exception as e:
        print(f"   ❌ Erro ao acessar objetos: {e}")
        import traceback
        traceback.print_exc()
    
    # Fechar AutoCAD
    acad.Quit()
    
except ImportError:
    print("   ❌ win32com não disponível")
    print("   Instale: pip install pywin32")
    print("\n   ALTERNATIVA: O arquivo já foi convertido para DXF?")
    print("   Se sim, use: python ler_dwg_aec.py arquivo.dxf")

print("\n" + "="*70)
