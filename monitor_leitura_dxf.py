#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MONITOR DE LEITURA DXF - TEMPO REAL
Log detalhado para debugging de problemas de leitura

Uso:
  python monitor_leitura_dxf.py --arquivo DXF_FILE.dxf
  python monitor_leitura_dxf.py --lote --pasta ./DXF_FILES
"""

import os
import sys
import json
import time
import logging
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    handlers=[
        logging.FileHandler('MONITOR_LEITURA.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class DXFReadMonitor:
    """Monitora e logga todas as etapas de leitura de DXF."""
    
    def __init__(self, dxf_path):
        self.dxf_path = Path(dxf_path)
        self.start_time = time.time()
        self.etapas = []
        self.erros = []
        self.alertas = []
        self.metricas = defaultdict(dict)
        
        logger.info(f"=" * 70)
        logger.info(f"MONITOR INICIADO - {self.dxf_path.name}")
        logger.info(f"=" * 70)
    
    def log_etapa(self, nome, duracao, detalhes=None, status="OK"):
        """Logga uma etapa de processamento."""
        registro = {
            "etapa": nome,
            "duracao_seg": round(duracao, 3),
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "detalhes": detalhes or {}
        }
        self.etapas.append(registro)
        
        status_icon = {"OK": "✓", "WARN": "!", "ERRO": "✗"}.get(status, " ")
        logger.info(f"[{status_icon}] {nome}: {duracao:.3f}s")
        
        if detalhes:
            for k, v in detalhes.items():
                logger.debug(f"    {k}: {v}")
    
    def log_erro(self, etapa, erro, excecao=None):
        """Logga um erro."""
        registro = {
            "etapa": etapa,
            "erro": str(erro),
            "excecao": str(excecao) if excecao else None,
            "timestamp": datetime.now().isoformat()
        }
        self.erros.append(registro)
        logger.error(f"✗ ERRO em {etapa}: {erro}")
        if excecao:
            logger.exception(f"    Exceção: {excecao}")
    
    def log_alerta(self, etapa, mensagem):
        """Logga um alerta não-crítico."""
        registro = {
            "etapa": etapa,
            "mensagem": mensagem,
            "timestamp": datetime.now().isoformat()
        }
        self.alertas.append(registro)
        logger.warning(f"! ALERTA em {etapa}: {mensagem}")
    
    def monitorar_leitura(self, func_leitura, *args, **kwargs):
        """Monitora uma função de leitura."""
        try:
            start = time.time()
            logger.info(f"▶ INICIANDO: {func_leitura.__name__}")
            
            resultado = func_leitura(*args, **kwargs)
            
            duracao = time.time() - start
            self.log_etapa(func_leitura.__name__, duracao, status="OK")
            
            # Extrair métricas do resultado
            if isinstance(resultado, tuple) and len(resultado) >= 2:
                pvs, trechos = resultado[0], resultado[1]
                self.metricas["resultado"] = {
                    "pvs": len(pvs),
                    "trechos": len(trechos),
                    "ext_total_m": sum(t.get("ext_m", 0) for t in trechos),
                    "trechos_com_dn": sum(1 for t in trechos if t.get("dn_mm")),
                }
            
            return resultado
            
        except Exception as e:
            duracao = time.time() - start
            self.log_etapa(func_leitura.__name__, duracao, status="ERRO")
            self.log_erro(func_leitura.__name__, str(e), e)
            raise
    
    def gerar_relatorio(self):
        """Gera relatório final do monitoramento."""
        duracao_total = time.time() - self.start_time
        
        logger.info(f"=" * 70)
        logger.info(f"RELATÓRIO FINAL - {self.dxf_path.name}")
        logger.info(f"=" * 70)
        logger.info(f"Tempo total: {duracao_total:.2f}s")
        logger.info(f"Etapas: {len(self.etapas)}")
        logger.info(f"Erros: {len(self.erros)}")
        logger.info(f"Alertas: {len(self.alertas)}")
        
        if self.metricas.get("resultado"):
            m = self.metricas["resultado"]
            logger.info(f"  PVs: {m['pvs']}")
            logger.info(f"  Trechos: {m['trechos']}")
            logger.info(f"  Extensão: {m['ext_total_m']:.1f}m")
            logger.info(f"  Com DN: {m['trechos_com_dn']}")
        
        # Salvar relatório JSON
        relatorio = {
            "arquivo": str(self.dxf_path),
            "duracao_total_seg": round(duracao_total, 3),
            "etapas": self.etapas,
            "erros": self.erros,
            "alertas": self.alertas,
            "metricas": dict(self.metricas),
            "timestamp": datetime.now().isoformat(),
        }
        
        json_path = Path(f"MONITOR_{self.dxf_path.stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(relatorio, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Relatório salvo: {json_path}")
        logger.info(f"=" * 70)
        
        return relatorio


def testar_leitura_gdal(dxf_path):
    """Testa leitura via GDAL/OGR."""
    import geopandas as gpd
    
    monitor = DXFReadMonitor(dxf_path)
    
    try:
        # Etapa 1: Carregar DXF
        start = time.time()
        logger.info("Carregando DXF via GDAL/OGR...")
        gdf = gpd.read_file(str(dxf_path), layer="entities")
        monitor.log_etapa("gpd.read_file", time.time() - start, {"entidades": len(gdf)})
        
        # Etapa 2: Analisar camadas
        start = time.time()
        layers = gdf.get("Layer", [])
        layers_unique = list(set(str(l or "").strip() for l in layers if str(l or "").strip()))
        monitor.log_etapa("analise_camadas", time.time() - start, {"total": len(layers_unique)})
        
        # Etapa 3: Verificar camadas críticas
        start = time.time()
        layers_upper = [l.upper() for l in layers_unique]
        
        tem_ps_pontos = any("PS_PONTOS" in l for l in layers_upper)
        tem_tubo = any("TUBO" in l or "PROLONG" in l for l in layers_upper)
        tem_texto = any("TEXT" in l or "TXT" in l for l in layers_upper)
        
        monitor.log_etapa("verificacao_camadas", time.time() - start, {
            "ps_pontos": tem_ps_pontos,
            "tubo": tem_tubo,
            "texto": tem_texto
        })
        
        if not tem_ps_pontos:
            monitor.log_alerta("verificacao_camadas", "Sem camada PS_PONTOS - DXF não-ProSaneamento?")
        
        if not tem_tubo:
            monitor.log_alerta("verificacao_camadas", "Sem camada de tubo identificada")
        
        # Etapa 4: Analisar entidades
        start = time.time()
        tipos_geom = gdf.geometry.geom_type.value_counts().to_dict()
        monitor.log_etapa("analise_entidades", time.time() - start, {"tipos": tipos_geom})
        
        # Etapa 5: Analisar textos
        start = time.time()
        textos = gdf[gdf['Text'].notna() & (gdf.geometry.geom_type == 'Point')]
        monitor.log_etapa("analise_textos", time.time() - start, {"total": len(textos)})
        
        # Etapa 6: Tentar leitura com ler_dxf_gdal
        start = time.time()
        try:
            from ler_dxf_gdal import ler_dxf_gdal
            pvs, trechos, ruas, meta = ler_dxf_gdal(str(dxf_path))
            monitor.log_etapa("ler_dxf_gdal", time.time() - start, {
                "pvs": len(pvs),
                "trechos": len(trechos)
            }, status="OK")
            
            monitor.metricas["resultado"] = {
                "pvs": len(pvs),
                "trechos": len(trechos),
                "ext_total_m": sum(t.get("ext_m", 0) for t in trechos),
            }
            
        except Exception as e:
            monitor.log_erro("ler_dxf_gdal", str(e), e)
            monitor.log_etapa("ler_dxf_gdal", time.time() - start, status="ERRO")
        
        return monitor.gerar_relatorio()
        
    except Exception as e:
        monitor.log_erro("leitura_geral", str(e), e)
        return monitor.gerar_relatorio()


def testar_leitura_ezdxf(dxf_path):
    """Testa leitura via ezdxf (fallback)."""
    try:
        import ezdxf
    except ImportError:
        logger.error("ezdxf não instalado: pip install ezdxf")
        return None
    
    monitor = DXFReadMonitor(dxf_path)
    
    try:
        start = time.time()
        logger.info("Carregando DXF via ezdxf...")
        doc = ezdxf.readfile(str(dxf_path))
        msp = doc.modelspace()
        monitor.log_etapa("ezdxf.readfile", time.time() - start)
        
        # Analisar entidades
        start = time.time()
        entidades = defaultdict(int)
        layers = set()
        
        for entity in msp:
            entidades[entity.dxftype()] += 1
            if hasattr(entity, 'dxf'):
                layers.add(entity.dxf.layer)
        
        monitor.log_etapa("analise_entidades_ezdxf", time.time() - start, {
            "tipos": dict(entidades),
            "camadas": len(layers)
        })
        
        return monitor.gerar_relatorio()
        
    except Exception as e:
        monitor.log_erro("ezdxf_leitura", str(e), e)
        return monitor.gerar_relatorio()


def analisar_lote(pasta):
    """Analisa todos os DXFs em uma pasta."""
    pasta = Path(pasta)
    dxf_files = list(pasta.glob("*.dxf"))
    
    logger.info(f"Encontrados {len(dxf_files)} arquivos DXF em {pasta}")
    
    resultados = []
    for dxf in dxf_files:
        try:
            logger.info(f"\n{'='*70}")
            logger.info(f"ANALISANDO: {dxf.name}")
            logger.info(f"{'='*70}")
            
            resultado = testar_leitura_gdal(str(dxf))
            resultados.append({
                "arquivo": dxf.name,
                "sucesso": len(resultado.get("erros", [])) == 0,
                "erros": len(resultado.get("erros", [])),
                "alertas": len(resultado.get("alertas", [])),
            })
            
        except Exception as e:
            logger.error(f"FALHA ao analisar {dxf.name}: {e}")
            resultados.append({
                "arquivo": dxf.name,
                "sucesso": False,
                "erro_excecao": str(e),
            })
    
    # Resumo do lote
    logger.info(f"\n{'='*70}")
    logger.info("RESUMO DO LOTE")
    logger.info(f"{'='*70}")
    logger.info(f"Total: {len(resultados)} arquivos")
    logger.info(f"Sucesso: {sum(1 for r in resultados if r['sucesso'])}")
    logger.info(f"Falha: {sum(1 for r in resultados if not r['sucesso'])}")
    
    return resultados


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Monitor de leitura DXF")
    parser.add_argument("--arquivo", "-f", help="Arquivo DXF para analisar")
    parser.add_argument("--lote", "-l", action="store_true", help="Analisar lote de arquivos")
    parser.add_argument("--pasta", "-p", default=".", help="Pasta para análise em lote")
    parser.add_argument("--ezdxf", action="store_true", help="Usar ezdxf em vez de GDAL")
    
    args = parser.parse_args()
    
    if args.lote:
        analisar_lote(args.pasta)
    elif args.arquivo:
        if args.ezdxf:
            testar_leitura_ezdxf(args.arquivo)
        else:
            testar_leitura_gdal(args.arquivo)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
