#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BANCO DE DADOS SQLITE — Persistência de dados
Inspirado no Bentley SewerCAD (.stsw.sqlite)
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from models import PV, Trecho, Rede, TipoPV, MaterialTubo, StatusHidraulico


class BancoDeDados:
    """
    Banco de dados SQLite para persistência de redes.
    Similar ao arquivo .stsw.sqlite do SewerCAD.
    
    Uso:
        db = BancoDeDados("resultado.sqlite")
        db.salvar_rede(rede)
        
        # Consultar depois
        rede = db.carregar_rede("Morro do Teteu")
        stats = db.gerar_relatorio()
    """
    
    def __init__(self, db_path: str):
        """
        Inicializa banco de dados.
        
        Args:
            db_path: Caminho do arquivo SQLite.
        """
        self.db_path = Path(db_path)
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row  # Acessar colunas por nome
        self._criar_tabelas()
    
    def _criar_tabelas(self):
        """Cria tabelas se não existirem."""
        cursor = self.conn.cursor()
        
        # Tabela: processamentos (histórico)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS processamentos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nucleo TEXT NOT NULL,
                tipo_rede TEXT NOT NULL,
                arquivo_dxf TEXT,
                data_processamento TEXT NOT NULL,
                total_pvs INTEGER,
                total_trechos INTEGER,
                extensao_total REAL,
                custo_total REAL,
                tempo_processamento REAL,
                status TEXT
            )
        """)
        
        # Tabela: pvs
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pvs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                processamento_id INTEGER,
                pv_id TEXT NOT NULL,
                tipo TEXT,
                x REAL,
                y REAL,
                ct REAL,
                cf REAL,
                prof REAL,
                grau INTEGER DEFAULT 0,
                sintético INTEGER DEFAULT 0,
                nucleo TEXT,
                FOREIGN KEY (processamento_id) REFERENCES processamentos(id)
            )
        """)
        
        # Tabela: trechos
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trechos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                processamento_id INTEGER,
                pv_ini TEXT NOT NULL,
                pv_fim TEXT NOT NULL,
                material TEXT,
                dn_mm INTEGER,
                ext_m REAL,
                decl_pct REAL,
                rua TEXT,
                velocidade_ms REAL,
                vazao_ls REAL,
                tensao_trativa_pa REAL,
                status TEXT,
                custo_total REAL,
                FOREIGN KEY (processamento_id) REFERENCES processamentos(id)
            )
        """)
        
        # Tabela: erros_validacao
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS erros_validacao (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                processamento_id INTEGER,
                tipo TEXT NOT NULL,  -- 'pv' ou 'trecho'
                elemento_id TEXT NOT NULL,
                erro TEXT NOT NULL,
                FOREIGN KEY (processamento_id) REFERENCES processamentos(id)
            )
        """)
        
        # Índices para performance
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pvs_processamento 
            ON pvs(processamento_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_trechos_processamento 
            ON trechos(processamento_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_processamentos_nucleo 
            ON processamentos(nucleo)
        """)
        
        self.conn.commit()
    
    def salvar_rede(self, rede: Rede, arquivo_dxf: str = None, 
                    tempo_processamento: float = None,
                    erros_validacao: List[dict] = None) -> int:
        """
        Salva rede no banco de dados.
        
        Args:
            rede: Objeto Rede a ser salvo.
            arquivo_dxf: Caminho do DXF de origem.
            tempo_processamento: Tempo de processamento em segundos.
            erros_validacao: Lista de erros da validação.
        
        Retorna:
            ID do processamento salvo.
        """
        cursor = self.conn.cursor()
        
        # Salvar processamento
        stats = rede.estatisticas()
        cursor.execute("""
            INSERT INTO processamentos (
                nucleo, tipo_rede, arquivo_dxf, data_processamento,
                total_pvs, total_trechos, extensao_total, custo_total,
                tempo_processamento, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rede.nucleo,
            rede.tipo_rede,
            arquivo_dxf,
            rede.data_processamento.isoformat(),
            stats["total_pvs"],
            stats["total_trechos"],
            stats["extensao_total"],
            rede.custo_total,
            tempo_processamento,
            "OK" if not erros_validacao else "COM_ERROS"
        ))
        
        processamento_id = cursor.lastrowid
        
        # Salvar PVs
        for pv_id, pv in rede.pvs.items():
            cursor.execute("""
                INSERT INTO pvs (
                    processamento_id, pv_id, tipo, x, y, ct, cf, prof,
                    grau, sintético, nucleo
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                processamento_id,
                pv_id,
                pv.tipo.value if isinstance(pv.tipo, TipoPV) else pv.tipo,
                pv.x,
                pv.y,
                pv.ct,
                pv.cf,
                pv.prof,
                pv.grau,
                1 if pv.sintético else 0,
                rede.nucleo
            ))
        
        # Salvar trechos
        for trecho in rede.trechos:
            t_dict = trecho.to_dict()
            cursor.execute("""
                INSERT INTO trechos (
                    processamento_id, pv_ini, pv_fim, material, dn_mm,
                    ext_m, decl_pct, rua, velocidade_ms, vazao_ls,
                    tensao_trativa_pa, status, custo_total
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                processamento_id,
                trecho.pv_ini,
                trecho.pv_fim,
                trecho.material.value if isinstance(trecho.material, MaterialTubo) else trecho.material,
                trecho.dn_mm,
                trecho.ext_m,
                trecho.decl_pct,
                trecho.rua,
                trecho.velocidade_ms,
                trecho.vazao_ls,
                trecho.tensao_trativa_pa,
                trecho.status.value if isinstance(trecho.status, StatusHidraulico) else trecho.status,
                (trecho.custos or {}).get("total_R", 0) if hasattr(trecho, 'custos') else 0
            ))
        
        # Salvar erros de validação
        if erros_validacao:
            for erro in erros_validacao:
                cursor.execute("""
                    INSERT INTO erros_validacao (
                        processamento_id, tipo, elemento_id, erro
                    ) VALUES (?, ?, ?, ?)
                """, (
                    processamento_id,
                    erro.get("tipo", "geral"),
                    erro.get("elemento", ""),
                    json.dumps(erro.get("erros", []))
                ))
        
        self.conn.commit()
        return processamento_id
    
    def carregar_rede(self, processamento_id: int) -> Optional[Rede]:
        """
        Carrega rede do banco de dados.
        
        Args:
            processamento_id: ID do processamento.
        
        Retorna:
            Objeto Rede carregado ou None se não encontrado.
        """
        cursor = self.conn.cursor()
        
        # Carregar processamento
        cursor.execute("""
            SELECT * FROM processamentos WHERE id = ?
        """, (processamento_id,))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        rede = Rede(
            nome=f"{row['nucleo']} - {row['tipo_rede']}",
            nucleo=row["nucleo"],
            tipo_rede=row["tipo_rede"],
            data_processamento=datetime.fromisoformat(row["data_processamento"])
        )
        
        # Carregar PVs
        cursor.execute("""
            SELECT * FROM pvs WHERE processamento_id = ?
        """, (processamento_id,))
        for row in cursor.fetchall():
            pv = PV(
                id=row["pv_id"],
                tipo=row["tipo"],
                x=row["x"],
                y=row["y"],
                ct=row["ct"],
                cf=row["cf"],
                prof=row["prof"],
                grau=row["grau"],
                sintético=bool(row["sintético"])
            )
            rede.pvs[pv.id] = pv
        
        # Carregar trechos
        cursor.execute("""
            SELECT * FROM trechos WHERE processamento_id = ?
        """, (processamento_id,))
        for i, row in enumerate(cursor.fetchall(), 1):
            trecho = Trecho(
                id=i,
                pv_ini=row["pv_ini"],
                pv_fim=row["pv_fim"],
                material=row["material"],
                dn_mm=row["dn_mm"],
                ext_m=row["ext_m"],
                decl_pct=row["decl_pct"],
                rua=row["rua"],
                velocidade_ms=row["velocidade_ms"],
                vazao_ls=row["vazao_ls"],
                tensao_trativa_pa=row["tensao_trativa_pa"],
                status=row["status"]
            )
            rede.trechos.append(trecho)
        
        return rede
    
    def listar_processamentos(self) -> List[dict]:
        """
        Lista todos os processamentos salvos.
        
        Retorna:
            Lista de dicionários com informações dos processamentos.
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT id, nucleo, tipo_rede, arquivo_dxf, data_processamento,
                   total_pvs, total_trechos, extensao_total, status
            FROM processamentos
            ORDER BY data_processamento DESC
        """)
        
        return [dict(row) for row in cursor.fetchall()]
    
    def gerar_relatorio(self, processamento_id: int = None) -> dict:
        """
        Gera relatório estatístico.
        
        Args:
            processamento_id: ID do processamento (opcional, todos se None).
        
        Retorna:
            Dicionário com estatísticas.
        """
        cursor = self.conn.cursor()
        
        if processamento_id:
            where = "WHERE processamento_id = ?"
            params = (processamento_id,)
        else:
            where = ""
            params = ()

        # Estatísticas gerais
        if processamento_id:
            cursor.execute("""
                SELECT
                    COUNT(DISTINCT id) as total_processamentos,
                    SUM(total_pvs) as total_pvs,
                    SUM(total_trechos) as total_trechos,
                    SUM(extensao_total) as extensao_total,
                    SUM(custo_total) as custo_total
                FROM processamentos
                WHERE id = ?
            """, (processamento_id,))
        else:
            cursor.execute("""
                SELECT
                    COUNT(DISTINCT id) as total_processamentos,
                    SUM(total_pvs) as total_pvs,
                    SUM(total_trechos) as total_trechos,
                    SUM(extensao_total) as extensao_total,
                    SUM(custo_total) as custo_total
                FROM processamentos
            """)
        stats_geral = dict(cursor.fetchone())
        
        # DN médio
        if processamento_id:
            cursor.execute("""
                SELECT AVG(dn_mm) as dn_medio, dn_mm
                FROM trechos
                WHERE processamento_id = ?
                GROUP BY dn_mm
            """, (processamento_id,))
        else:
            cursor.execute("""
                SELECT AVG(dn_mm) as dn_medio, dn_mm
                FROM trechos
                GROUP BY dn_mm
            """)
        dns = {row["dn_mm"]: row["dn_medio"] for row in cursor.fetchall()}
        
        # Status
        if processamento_id:
            cursor.execute("""
                SELECT status, COUNT(*) as count
                FROM trechos
                WHERE processamento_id = ?
                GROUP BY status
            """, (processamento_id,))
        else:
            cursor.execute("""
                SELECT status, COUNT(*) as count
                FROM trechos
                GROUP BY status
            """)
        status = {row["status"]: row["count"] for row in cursor.fetchall()}
        
        # Erros
        if processamento_id:
            cursor.execute("""
                SELECT COUNT(*) as total_erros
                FROM erros_validacao
                WHERE processamento_id = ?
            """, (processamento_id,))
        else:
            cursor.execute("""
                SELECT COUNT(*) as total_erros
                FROM erros_validacao
            """)
        total_erros = cursor.fetchone()["total_erros"]
        
        return {
            "total_processamentos": stats_geral.get("total_processamentos", 0),
            "total_pvs": stats_geral.get("total_pvs", 0),
            "total_trechos": stats_geral.get("total_trechos", 0),
            "extensao_total_m": stats_geral.get("extensao_total", 0),
            "custo_total_r": stats_geral.get("custo_total", 0),
            "dn_counts": dns,
            "status_counts": status,
            "total_erros": total_erros,
        }
    
    def exportar_relatorio_json(self, output_path: str, 
                                 processamento_id: int = None):
        """
        Exporta relatório como JSON.
        
        Args:
            output_path: Caminho do arquivo de saída.
            processamento_id: ID do processamento (opcional).
        """
        relatorio = self.gerar_relatorio(processamento_id)
        relatorio["data_geracao"] = datetime.now().isoformat()
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(relatorio, f, indent=2, ensure_ascii=False)
    
    def comparar_processamentos(self, id1: int, id2: int) -> dict:
        """
        Compara dois processamentos.
        
        Args:
            id1: ID do primeiro processamento.
            id2: ID do segundo processamento.
        
        Retorna:
            Dicionário com diferenças.
        """
        rede1 = self.carregar_rede(id1)
        rede2 = self.carregar_rede(id2)
        
        if not rede1 or not rede2:
            return {"erro": "Processamento não encontrado"}
        
        stats1 = rede1.estatisticas()
        stats2 = rede2.estatisticas()
        
        diff = {
            "processamento_1": {
                "id": id1,
                "nucleo": rede1.nucleo,
                "data": rede1.data_processamento.isoformat(),
            },
            "processamento_2": {
                "id": id2,
                "nucleo": rede2.nucleo,
                "data": rede2.data_processamento.isoformat(),
            },
            "diferencas": {
                "pvs": stats2["total_pvs"] - stats1["total_pvs"],
                "trechos": stats2["total_trechos"] - stats1["total_trechos"],
                "extensao_m": stats2["extensao_total"] - stats1["extensao_total"],
                "custo_r": rede2.custo_total - rede1.custo_total,
            }
        }
        
        return diff
    
    def fechar(self):
        """Fecha conexão com banco de dados."""
        if self.conn:
            self.conn.close()
    
    def __enter__(self):
        """Context manager."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager."""
        self.fechar()


def criar_banco_exemplo(db_path: str = "exemplo.sqlite"):
    """
    Cria banco de dados de exemplo para teste.
    
    Args:
        db_path: Caminho do arquivo SQLite.
    """
    from models import PV, Trecho, Rede, TipoPV, MaterialTubo
    
    # Criar rede de exemplo
    rede = Rede(
        nome="Rede Exemplo - Morro do Teteu",
        nucleo="Morro do Teteu",
        tipo_rede="ESGOTO"
    )
    
    # Adicionar PVs
    for i in range(1, 11):
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
    for i in range(1, 10):
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
    
    # Salvar no banco
    with BancoDeDados(db_path) as db:
        processamento_id = db.salvar_rede(
            rede=rede,
            arquivo_dxf="exemplo.dxf",
            tempo_processamento=12.5
        )
        
        print(f"Banco de exemplo criado: {db_path}")
        print(f"  Processamento ID: {processamento_id}")
        print(f"  PVs: {rede.total_pvs}")
        print(f"  Trechos: {rede.total_trechos}")
        print(f"  Extensão: {rede.extensao_total:.1f}m")
        
        # Gerar relatório
        relatorio = db.gerar_relatorio()
        print(f"\nRelatório:")
        print(f"  Total processamentos: {relatorio['total_processamentos']}")
        print(f"  Custo total: R$ {relatorio['custo_total_r']:,.2f}")


if __name__ == "__main__":
    # Criar banco de exemplo para teste
    criar_banco_exemplo()
