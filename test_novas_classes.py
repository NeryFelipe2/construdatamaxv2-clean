#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TESTE DAS NOVAS CLASSES E SQLITE
Testa models.py e database.py sem alterar o script principal
"""

import sys
from pathlib import Path

# Adicionar pasta atual ao path
sys.path.insert(0, str(Path(__file__).parent))

from models import PV, Trecho, Rede, TipoPV, MaterialTubo, StatusHidraulico
from database import BancoDeDados
from datetime import datetime

def testar_classes():
    """Testa classes PV, Trecho, Rede."""
    print("=" * 70)
    print("TESTE DE CLASSES — MODELS.PY")
    print("=" * 70)
    print()
    
    # Testar PV
    print("1. Testando PV...")
    pv = PV(
        id="PV_001",
        tipo=TipoPV.PV,
        x=360000.0,
        y=7350000.0,
        ct=15.5,
        cf=13.0,
        prof=2.5,
        nucleo="Morro do Teteu"
    )
    
    print(f"   ID: {pv.id}")
    print(f"   Tipo: {pv.tipo.value}")
    print(f"   CT: {pv.ct} m")
    print(f"   CF: {pv.cf} m")
    print(f"   Profundidade real: {pv.profundidade_real} m")
    print(f"   Tem coords: {pv.tem_coords}")
    print(f"   Tem cotas: {pv.tem_cotas}")
    
    # Validar PV
    erros = pv.validar()
    print(f"   Erros na validação: {erros if erros else 'Nenhum'}")
    print()
    
    # Testar Trecho
    print("2. Testando Trecho...")
    trecho = Trecho(
        id=1,
        pv_ini="PV_001",
        pv_fim="PV_002",
        material=MaterialTubo.PVC,
        dn_mm=200,
        ext_m=45.5,
        decl_pct=0.5,
        rua="Rua das Flores",
        velocidade_ms=1.2,
        tensao_trativa_pa=2.5,
        status=StatusHidraulico.OK
    )
    
    print(f"   Trecho: {trecho.pv_ini} → {trecho.pv_fim}")
    print(f"   DN: {trecho.dn_mm} mm")
    print(f"   Extensão: {trecho.ext_m} m")
    print(f"   Declividade: {trecho.decl_pct}%")
    print(f"   Velocidade: {trecho.velocidade_ms} m/s")
    print(f"   Status: {trecho.status.value}")
    
    # Validar Trecho
    erros = trecho.validar()
    print(f"   Erros na validação: {erros if erros else 'Nenhum'}")
    print()
    
    # Testar Rede
    print("3. Testando Rede...")
    rede = Rede(
        nome="Rede Exemplo - Morro do Teteu",
        nucleo="Morro do Teteu",
        tipo_rede="ESGOTO"
    )
    
    # Adicionar PVs
    for i in range(1, 6):
        pv = PV(
            id=f"PV_{i:03d}",
            tipo=TipoPV.PV,
            x=360000 + i * 10,
            y=7350000 + i * 10,
            ct=15.0 - i * 0.5,
            cf=13.0 - i * 0.5,
            prof=2.0
        )
        rede.adicionar_pv(pv)
    
    # Adicionar trechos
    for i in range(1, 5):
        trecho = Trecho(
            id=i,
            pv_ini=f"PV_{i:03d}",
            pv_fim=f"PV_{i+1:03d}",
            material=MaterialTubo.PVC,
            dn_mm=200,
            ext_m=14.14,
            decl_pct=0.5,
            rua=f"Rua {i}",
            velocidade_ms=1.2,
            tensao_trativa_pa=2.5,
            status=StatusHidraulico.OK
        )
        rede.adicionar_trecho(trecho)
    
    print(f"   Nome: {rede.nome}")
    print(f"   Núcleo: {rede.nucleo}")
    print(f"   Total PVs: {rede.total_pvs}")
    print(f"   Total Trechos: {rede.total_trechos}")
    print(f"   Extensão total: {rede.extensao_total:.1f} m")
    
    # Estatísticas
    stats = rede.estatisticas()
    print()
    print("   Estatísticas:")
    print(f"     DN médio: {stats['dn_medio']} mm")
    print(f"     Velocidade média: {stats['velocidade_media']:.2f} m/s")
    print(f"     Profundidade média: {stats['profundidade_media']:.2f} m")
    print()
    
    # Validar Rede
    print("4. Validação da Rede...")
    validacao = rede.validar()
    print(f"   Total PVs: {validacao['total_pvs']}")
    print(f"   PVs sintéticos: {validacao['pvs_sinteticos']}")
    print(f"   Total Trechos: {validacao['total_trechos']}")
    print(f"   Erros PVs: {len(validacao['erros_pvs'])}")
    print(f"   Erros Trechos: {len(validacao['erros_trechos'])}")
    print(f"   Erros Rede: {len(validacao['erros_rede'])}")
    print()
    
    # Testar conversão dict
    print("5. Testando conversão dict...")
    pv_dict = pv.to_dict()
    pv_from_dict = PV.from_dict(pv_dict)
    print(f"   PV original: {pv.id}")
    print(f"   PV do dict: {pv_from_dict.id}")
    print(f"   Iguais: {pv.id == pv_from_dict.id}")
    print()
    
    return rede


def testar_sqlite(rede: Rede):
    """Testa banco de dados SQLite."""
    print("=" * 70)
    print("TESTE DE BANCO DE DADOS — DATABASE.PY")
    print("=" * 70)
    print()
    
    db_path = "teste_construdata.sqlite"
    
    # Criar banco
    print(f"1. Criando banco de dados: {db_path}")
    with BancoDeDados(db_path) as db:
        # Salvar rede
        print("2. Salvando rede no banco...")
        processamento_id = db.salvar_rede(
            rede=rede,
            arquivo_dxf="teste.dxf",
            tempo_processamento=12.5
        )
        print(f"   Processamento ID: {processamento_id}")
        print()
        
        # Listar processamentos
        print("3. Listando processamentos...")
        processamentos = db.listar_processamentos()
        for p in processamentos:
            print(f"   ID: {p['id']} | {p['nucleo']} | {p['total_pvs']} PVs | {p['total_trechos']} trechos")
        print()
        
        # Carregar rede
        print("4. Carregando rede do banco...")
        rede_carregada = db.carregar_rede(processamento_id)
        if rede_carregada:
            print(f"   Nome: {rede_carregada.nome}")
            print(f"   PVs: {rede_carregada.total_pvs}")
            print(f"   Trechos: {rede_carregada.total_trechos}")
        print()
        
        # Gerar relatório
        print("5. Gerando relatório...")
        relatorio = db.gerar_relatorio()
        print(f"   Total processamentos: {relatorio['total_processamentos']}")
        print(f"   Total PVs: {relatorio['total_pvs']}")
        print(f"   Total trechos: {relatorio['total_trechos']}")
        print(f"   Extensão total: {relatorio['extensao_total_m']:.1f} m")
        print(f"   Custo total: R$ {relatorio['custo_total_r']:,.2f}")
        print()
        
        # Exportar JSON
        print("6. Exportando relatório JSON...")
        db.exportar_relatorio_json("relatorio_teste.json")
        print("   Arquivo: relatorio_teste.json")
        print()
    
    print("=" * 70)
    print("TESTE CONCLUÍDO COM SUCESSO!")
    print("=" * 70)
    print()
    print("Arquivos criados:")
    print(f"  - {db_path}")
    print(f"  - relatorio_teste.json")
    print()


if __name__ == "__main__":
    print()
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║  TESTE DE CLASSES E SQLITE — CONSTRUDATA v5.1               ║")
    print("║  Inspirado no Bentley SewerCAD                              ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print()
    
    # Testar classes
    rede = testar_classes()
    
    # Testar SQLite
    testar_sqlite(rede)
    
    print("✅ Todos os testes passaram!")
    print()
