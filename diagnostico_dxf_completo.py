#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DIAGNÓSTICO COMPLETO DE LEITURA DXF
Relatório técnico para correção de problemas de leitura

Este script analisa DXFs de QUALQUER software/plugin (não apenas ProSaneamento):
- ProSaneamento (SABESP)
- Civil 3D (AEC Objects)
- QGIS
- AutoCAD MEP
- MicroStation
- e outros

Autor: Felipe Nery
Data: 2026-03-27
"""

import os
import sys
import json
import re
from pathlib import Path
from datetime import datetime
from collections import Counter, defaultdict

# ── DEPENDÊNCIAS ─────────────────────────────────────────────────────────────
DEPENDENCIAS = {
    "ezdxf": "Leitura nativa DXF",
    "geopandas": "Leitura via GDAL/OGR",
    "numpy": "Cálculos numéricos",
    "scipy": "Clustering de endpoints",
}

# ── PADRÕES DE CAMADAS POR SOFTWARE ──────────────────────────────────────────
PADROES_POR_SOFTWARE = {
    "ProSaneamento": {
        "tubos": ["TUBO_PVC", "TUBO_PEAD", "TUBO_", "PROLONG"],
        "pvs": ["PS_PONTOS_IDENTIFICACAO_TXT", "PS_PONTOS"],
        "dn": ["PS_IND_DIAMETRO"],
        "incl": ["PS_IND_INCLINACAO"],
        "ruas": ["A_Alerta", "TXT-LOGRAD", "TEXTO", "LT-TEXTO-RUA"],
    },
    "Civil3D_AEC": {
        "tubos": ["AECC_PIPE", "PIPE", "TUBO"],
        "pvs": ["AECC_STRUCTURE", "STRUCT", "PV", "POCO"],
        "dn": ["DN", "DIAMETRO"],
        "incl": ["INCL", "DECLIV"],
        "ruas": ["TEXT", "LOGRADOURO", "RUA"],
    },
    "QGIS": {
        "tubos": ["tubos", "condutos", "tubo"],
        "pvs": ["pocos", "pvs", "nós", "nos"],
        "dn": ["dn", "diametro"],
        "incl": ["incl", "declividade"],
        "ruas": ["ruas", "logradouros"],
    },
    "AutoCAD_MEP": {
        "tubos": ["PIPE", "TUBE", "TUBO"],
        "pvs": ["FITTING", "STRUCTURE", "PV"],
        "dn": ["SIZE", "DN"],
        "incl": ["SLOPE", "INCL"],
        "ruas": ["TEXT", "ANNOTATION"],
    },
    "Generico": {
        "tubos": ["TUBO", "CONDUTO", "LINHA", "LINE"],
        "pvs": ["PV", "POCO", "TEXTO", "TEXT"],
        "dn": ["DN", "D"],
        "incl": ["INCL", "%"],
        "ruas": ["RUA", "TEXTO"],
    },
}

# ── TOLERÂNCIAS ──────────────────────────────────────────────────────────────
TOL_CLUSTER = 2.0       # metros para clustering
TOL_SNAP = 10.0         # metros para snap genérico
MIN_EXT_TUBO = 2.0      # metros
MIN_COORD_UTM = 100000  # filtro de coordenada


def _log(msg, nivel="INFO", indent=0):
    """Log formatado."""
    prefixos = {
        "OK": "✓",
        "WARN": "!",
        "ERRO": "✗",
        "INFO": " ",
        "STEP": "▶",
    }
    prefixo = prefixos.get(nivel, " ")
    print(f"{'  ' * indent}[{prefixo}] {msg}")


def verificar_dependencias():
    """Verifica se todas as dependências estão instaladas."""
    _log("Verificando dependências...", "STEP")
    disponiveis = {}
    
    for pkg, desc in DEPENDENCIAS.items():
        try:
            __import__(pkg)
            disponiveis[pkg] = True
            _log(f"{pkg}: OK ({desc})", "OK")
        except ImportError:
            disponiveis[pkg] = False
            _log(f"{pkg}: NÃO INSTALADO ({desc})", "ERRO")
    
    return disponiveis


def analisar_camadas(gdf):
    """Analisa todas as camadas do DXF."""
    _log("Analisando camadas...", "STEP", indent=1)
    
    layers_raw = gdf.get("Layer", [])
    layers = [str(l or "").strip() for l in layers_raw if str(l or "").strip()]
    layers_unique = list(dict.fromkeys(layers))  # mantém ordem, remove duplicatas
    
    _log(f"Total de camadas: {len(layers_unique)}", "INFO", indent=2)
    
    # Classificar camadas por tipo
    classificacao = {
        "tubos": [],
        "pontos": [],
        "textos": [],
        "blocos": [],
        "outros": [],
    }
    
    for layer in layers_unique:
        upper = layer.upper()
        if any(p in upper for p in ["TUBO", "CONDUTO", "PIPE", "LINHA", "PROLONG"]):
            classificacao["tubos"].append(layer)
        elif any(p in upper for p in ["PV", "POCO", "STRUCT", "NÓ", "NO"]):
            classificacao["pontos"].append(layer)
        elif any(p in upper for p in ["TXT", "TEXT", "TEXTO", "IND", "DIM"]):
            classificacao["textos"].append(layer)
        elif any(p in upper for p in ["BLOCO", "BLOCK", "INSERT"]):
            classificacao["blocos"].append(layer)
        else:
            classificacao["outros"].append(layer)
    
    for tipo, cams in classificacao.items():
        if cams:
            _log(f"{tipo.upper()}: {len(cams)} camadas", "INFO", indent=2)
            for c in cams[:5]:  # mostra até 5
                _log(f"  - {c}", "INFO", indent=3)
            if len(cams) > 5:
                _log(f"  ... e mais {len(cams) - 5}", "INFO", indent=3)
    
    return {
        "todas": layers_unique,
        "classificacao": classificacao,
    }


def detectar_software_origem(layers_info):
    """Detecta qual software gerou o DXF baseado nas camadas."""
    _log("Detectando software de origem...", "STEP", indent=1)
    
    layers_upper = [l.upper() for l in layers_info["todas"]]
    
    pontuacao = {}
    for software, padroes in PADROES_POR_SOFTWARE.items():
        pontos = 0
        for tipo, padroes_tipo in padroes.items():
            for padrao in padroes_tipo:
                if any(padrao.upper() in lu for lu in layers_upper):
                    pontos += 1
        pontuacao[software] = pontos
    
    # Ordenar por pontuação
    ranking = sorted(pontuacao.items(), key=lambda x: -x[1])
    
    if ranking[0][1] > 0:
        software_detectado = ranking[0][0]
        _log(f"Software detectado: {software_detectado} (score: {ranking[0][1]})", "OK", indent=2)
    else:
        software_detectado = "Desconhecido"
        _log("Software: Não foi possível detectar (padrões não reconhecidos)", "WARN", indent=2)
    
    return {
        "software": software_detectado,
        "ranking": ranking,
        "confianca": "ALTA" if ranking[0][1] >= 3 else "MÉDIA" if ranking[0][1] >= 2 else "BAIXA",
    }


def analisar_entidades(gdf):
    """Analisa tipos de entidades no DXF."""
    _log("Analisando entidades...", "STEP", indent=1)
    
    tipos_geom = Counter(gdf.geometry.geom_type if hasattr(gdf, 'geometry') else [])
    total = sum(tipos_geom.values())
    
    _log(f"Total de entidades: {total}", "INFO", indent=2)
    
    for tipo, qtd in tipos_geom.most_common():
        pct = (qtd / total * 100) if total > 0 else 0
        _log(f"{tipo}: {qtd} ({pct:.1f}%)", "INFO", indent=2)
    
    return {
        "total": total,
        "por_tipo": dict(tipos_geom),
    }


def analisar_tubos(gdf, layers_info):
    """Analisa camadas de tubos e suas propriedades."""
    _log("Analisando tubos...", "STEP", indent=1)
    
    layers_tubo = []
    for layer in layers_info["todas"]:
        upper = layer.upper()
        if any(p in upper for p in ["TUBO", "CONDUTO", "PIPE", "LINHA", "PROLONG"]):
            if not any(p in upper for p in ["DETALHE", "PERFIL", "BIFILAR"]):
                layers_tubo.append(layer)
    
    if not layers_tubo:
        _log("Nenhuma camada de tubo encontrada", "ERRO", indent=2)
        return {"layers": [], "qtd": 0, "ext_total": 0}
    
    _log(f"Camadas de tubo: {len(layers_tubo)}", "INFO", indent=2)
    for l in layers_tubo[:5]:
        _log(f"  - {l}", "INFO", indent=3)
    
    # Filtrar tubos
    tubos = gdf[
        (gdf['Layer'].isin(layers_tubo)) &
        (gdf.geometry.geom_type.isin(['LineString', 'MultiLineString']))
    ].copy()
    
    if len(tubos) > 0:
        tubos['ext_m'] = tubos.geometry.length
        tubos = tubos[tubos['ext_m'] > MIN_EXT_TUBO]
        ext_total = tubos['ext_m'].sum()
        _log(f"Tubos válidos: {len(tubos)} | Extensão total: {ext_total:.1f}m", "OK", indent=2)
    else:
        _log("Nenhum tubo válido encontrado", "ERRO", indent=2)
        ext_total = 0
    
    return {
        "layers": layers_tubo,
        "qtd": len(tubos),
        "ext_total": ext_total,
        # Não incluir GDF no relatório (não serializável)
    }


def analisar_textos(gdf, layers_info):
    """Analisa textos no DXF (PVs, DN, inclinação, ruas)."""
    _log("Analisando textos...", "STEP", indent=1)
    
    textos = gdf[gdf['Text'].notna() & (gdf.geometry.geom_type == 'Point')].copy()
    _log(f"Textos encontrados: {len(textos)}", "INFO", indent=2)
    
    # Agrupar por camada
    por_camada = defaultdict(list)
    for _, row in textos.iterrows():
        por_camada[row['Layer']].append(row['Text'])
    
    for layer, txts in sorted(por_camada.items()):
        _log(f"  {layer}: {len(txts)} textos", "INFO", indent=2)
        # Mostrar exemplos
        exemplos = txts[:3]
        for ex in exemplos:
            _log(f"    «{ex[:50]}...»" if len(str(ex)) > 50 else f"    «{ex}»", "INFO", indent=3)
    
    # Tentar identificar padrões
    padroes_encontrados = {
        "pv": [],
        "dn": [],
        "incl": [],
        "ct_cf": [],
        "rua": [],
    }
    
    for txt in textos['Text'].dropna():
        txt = str(txt).strip()
        
        # PV
        if re.match(r"(PV|PI|P\.?\s*V\.?|P\.?\s*I\.?)\s*[-_]?\s*\d+", txt, re.IGNORECASE):
            padroes_encontrados["pv"].append(txt)
        
        # DN
        if re.search(r"(\d+)\s*mm|D\s*=?\s*(\d+)|DN\s*(\d+)", txt, re.IGNORECASE):
            padroes_encontrados["dn"].append(txt)
        
        # Inclinação
        if re.search(r"([\d.,]+)\s*m/m|([\d.,]+)\s*%", txt, re.IGNORECASE):
            padroes_encontrados["incl"].append(txt)
        
        # CT/CF
        if re.match(r"C\.?\s*[TF]\.?\s*([+-]?[\d.,]+)", txt, re.IGNORECASE):
            padroes_encontrados["ct_cf"].append(txt)
        
        # Rua
        if re.match(r"(RUA|BECO|TRAV|AV|ESTRADA|VIELA|ALAMEDA)\s+", txt, re.IGNORECASE):
            padroes_encontrados["rua"].append(txt)
    
    _log("Padrões encontrados:", "INFO", indent=2)
    for tipo, lista in padroes_encontrados.items():
        _log(f"  {tipo.upper()}: {len(lista)} ocorrências", "INFO", indent=3)
    
    return {
        "total": len(textos),
        "por_camada": dict(por_camada),
        "padroes": {k: len(v) for k, v in padroes_encontrados.items()},
    }


def analisar_coordenadas(gdf):
    """Analisa sistema de coordenadas do DXF."""
    _log("Analisando coordenadas...", "STEP", indent=1)
    
    pontos = gdf[gdf.geometry.geom_type == 'Point']
    
    if len(pontos) == 0:
        _log("Nenhum ponto para análise de coordenadas", "WARN", indent=2)
        return {"sistema": "Desconhecido", "utm_zone": None}
    
    xs = [p.x for p in pontos.geometry]
    ys = [p.y for p in pontos.geometry]
    
    x_med = sum(xs) / len(xs)
    y_med = sum(ys) / len(ys)
    
    _log(f"X médio: {x_med:,.1f} | Y médio: {y_med:,.1f}", "INFO", indent=2)
    
    # Detectar UTM
    sistema = "Desconhecido"
    utm_zone = None
    
    if x_med > 100000 and x_med < 1000000:
        if y_med > 1000000 and y_med < 10000000:
            sistema = "UTM (provável)"
            # Zone UTM aproximada para Santos/SP
            if -51 < x_med < -45:
                utm_zone = "23K"
            elif -45 < x_med < -39:
                utm_zone = "24K"
            _log(f"Sistema: UTM Zona {utm_zone} (SIRGAS 2000 provável)", "OK", indent=2)
        else:
            sistema = "Coordenadas locais (não UTM)"
            _log(f"Sistema: Coordenadas locais (Y não é UTM)", "WARN", indent=2)
    else:
        sistema = "Coordenadas inválidas ou em outro sistema"
        _log(f"Sistema: Não identificado (X={x_med:.1f})", "WARN", indent=2)
    
    return {
        "sistema": sistema,
        "utm_zone": utm_zone,
        "x_medio": x_med,
        "y_medio": y_med,
    }


def diagnosticar_problemas(layers_info, tubos_info, textos_info, coords_info, software_info):
    """Diagnostica problemas potenciais de leitura."""
    _log("Diagnosticando problemas...", "STEP", indent=1)
    
    problemas = []
    solucoes = []
    
    # Problema 1: Sem camada PS_PONTOS
    if software_info["software"] == "ProSaneamento":
        if not any("PS_PONTOS" in l.upper() for l in layers_info["todas"]):
            problemas.append({
                "tipo": "CRÍTICO",
                "descricao": "DXF ProSaneamento sem camada PS_PONTOS_IDENTIFICACAO_TXT",
                "causa": "DXF exportado incorretamente ou corrompido",
            })
            solucoes.append(
                "Reexportar DXF no ProSaneamento com todas as camadas de identificação"
            )
    
    # Problema 2: Sem tubos
    if tubos_info["qtd"] == 0:
        problemas.append({
            "tipo": "CRÍTICO",
            "descricao": "Nenhum tubo encontrado",
            "causa": "Camadas de tubo não identificadas ou DXF vazio",
        })
        solucoes.append(
            "Verificar se o DXF contém tubos e se as camadas seguem padrões reconhecíveis"
        )
    
    # Problema 3: Sem textos
    if textos_info["total"] == 0:
        problemas.append({
            "tipo": "GRAVE",
            "descricao": "Nenhum texto encontrado",
            "causa": "Textos explodidos ou em camadas não padrão",
        })
        solucoes.append(
            "Verificar se textos de PV, DN e inclinação estão presentes no DXF original"
        )
    
    # Problema 4: Coordenadas inválidas
    if "inválidas" in coords_info["sistema"] or "Desconhecido" in coords_info["sistema"]:
        problemas.append({
            "tipo": "GRAVE",
            "descricao": "Sistema de coordenadas não identificado",
            "causa": "DXF em coordenadas locais ou sem georreferenciamento",
        })
        solucoes.append(
            "Georreferenciar o DXF ou exportar em UTM SIRGAS 2000"
        )
    
    # Problema 5: Software não detectado
    if software_info["confianca"] == "BAIXA":
        problemas.append({
            "tipo": "MODERADO",
            "descricao": "Software de origem não detectado",
            "causa": "DXF genérico ou com camadas em padrão não reconhecido",
        })
        solucoes.append(
            "Usar fallback genérico ou mapear camadas manualmente"
        )
    
    # Problema 6: Poucos PVs
    if textos_info["padroes"].get("pv", 0) < 2:
        problemas.append({
            "tipo": "GRAVE",
            "descricao": "Poucos ou nenhum PV identificado",
            "causa": "Textos de PV em formato não reconhecido",
        })
        solucoes.append(
            "Verificar formato dos textos de PV (deve ser PV_01, PV-1, P.V. 1, etc.)"
        )
    
    # Exibir problemas
    if problemas:
        _log(f"{len(problemas)} problema(s) encontrado(s):", "WARN", indent=2)
        for i, prob in enumerate(problemas, 1):
            _log(f"{i}. [{prob['tipo']}] {prob['descricao']}", "WARN", indent=3)
            _log(f"   Causa: {prob['causa']}", "INFO", indent=4)
    else:
        _log("Nenhum problema crítico detectado", "OK", indent=2)
    
    if solucoes:
        _log("Soluções recomendadas:", "INFO", indent=2)
        for i, sol in enumerate(solucoes, 1):
            _log(f"{i}. {sol}", "INFO", indent=3)
    
    return {"problemas": problemas, "solucoes": solucoes}


def gerar_relatorio(dxf_path, diagnostico_completo):
    """Gera relatório JSON e Markdown."""
    _log("Gerando relatório...", "STEP")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dxf_nome = Path(dxf_path).stem
    
    # Relatório JSON
    relatorio_json = {
        "metadata": {
            "arquivo": dxf_path,
            "timestamp": timestamp,
            "versao_script": "1.0.0",
        },
        **diagnostico_completo,
    }
    
    json_path = Path(f"DIAGNOSTICO_{dxf_nome}_{timestamp}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(relatorio_json, f, indent=2, ensure_ascii=False)
    _log(f"Relatório JSON: {json_path}", "OK", indent=1)
    
    # Relatório Markdown
    md_content = f"""# Relatório de Diagnóstico DXF

## Metadados
- **Arquivo:** {dxf_path}
- **Data:** {datetime.now().strftime('%d/%m/%Y %H:%M')}
- **Script:** diagnostico_dxf_completo.py v1.0.0

## Resumo da Análise

### Software Detectado
- **Origem:** {diagnostico_completo['software']['software']}
- **Confiança:** {diagnostico_completo['software']['confianca']}

### Sistema de Coordenadas
- **Tipo:** {diagnostico_completo['coordenadas']['sistema']}
- **X médio:** {diagnostico_completo['coordenadas']['x_medio']:,.1f}
- **Y médio:** {diagnostico_completo['coordenadas']['y_medio']:,.1f}

### Entidades
- **Total:** {diagnostico_completo['entidades']['total']}
- **Tubos:** {diagnostico_completo['tubos']['qtd']}
- **Textos:** {diagnostico_completo['textos']['total']}
- **Extensão total:** {diagnostico_completo['tubos']['ext_total']:.1f}m

## Problemas Encontrados

"""
    
    if diagnostico_completo['problemas']['problemas']:
        for i, prob in enumerate(diagnostico_completo['problemas']['problemas'], 1):
            md_content += f"""### {i}. {prob['descricao']}
- **Tipo:** {prob['tipo']}
- **Causa:** {prob['causa']}

"""
    else:
        md_content += "*Nenhum problema crítico detectado*\n\n"
    
    md_content += """## Recomendações

"""
    for i, sol in enumerate(diagnostico_completo['problemas']['solucoes'], 1):
        md_content += f"{i}. {sol}\n"
    
    md_content += f"""
## Camadas Encontradas

"""
    for tipo, cams in diagnostico_completo['layers']['classificacao'].items():
        if cams:
            md_content += f"### {tipo.upper()}\n"
            for c in cams:
                md_content += f"- {c}\n"
            md_content += "\n"
    
    md_path = Path(f"DIAGNOSTICO_{dxf_nome}_{timestamp}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    _log(f"Relatório Markdown: {md_path}", "OK", indent=1)
    
    return json_path, md_path


def analisar_dxf_completo(dxf_path):
    """Função principal de análise."""
    print(f"\n{'='*70}")
    print(f"  DIAGNÓSTICO COMPLETO DE DXF")
    print(f"  Suporte multi-software: ProSaneamento, Civil 3D, QGIS, etc.")
    print(f"{'='*70}\n")
    
    _log(f"Arquivo: {dxf_path}", "STEP")
    
    if not Path(dxf_path).exists():
        _log(f"Arquivo não encontrado: {dxf_path}", "ERRO")
        return None
    
    # Verificar dependências
    deps = verificar_dependencias()
    
    if not deps.get("geopandas"):
        _log("geopandas não disponível — análise limitada", "ERRO")
        return None
    
    import geopandas as gpd
    
    # Ler DXF
    _log("Lendo DXF via GDAL/OGR...", "STEP")
    try:
        gdf = gpd.read_file(dxf_path, layer="entities")
        _log(f"DXF carregado: {len(gdf)} entidades", "OK")
    except Exception as e:
        _log(f"Erro ao ler DXF: {e}", "ERRO")
        return None
    
    # Análises
    layers_info = analisar_camadas(gdf)
    software_info = detectar_software_origem(layers_info)
    entidades_info = analisar_entidades(gdf)
    tubos_info = analisar_tubos(gdf, layers_info)
    textos_info = analisar_textos(gdf, layers_info)
    coords_info = analisar_coordenadas(gdf)
    
    # Diagnóstico
    problemas_info = diagnosticar_problemas(
        layers_info, tubos_info, textos_info, coords_info, software_info
    )
    
    # Compilar diagnóstico completo
    diagnostico_completo = {
        "layers": layers_info,
        "software": software_info,
        "entidades": entidades_info,
        "tubos": tubos_info,
        "textos": textos_info,
        "coordenadas": coords_info,
        "problemas": problemas_info,
    }
    
    # Gerar relatório
    json_path, md_path = gerar_relatorio(dxf_path, diagnostico_completo)
    
    print(f"\n{'='*70}")
    _log("DIAGNÓSTICO CONCLUÍDO", "OK")
    print(f"{'='*70}\n")
    
    return diagnostico_completo


def main():
    """Ponto de entrada principal."""
    if len(sys.argv) < 2:
        print("Uso: python diagnostico_dxf_completo.py <arquivo.dxf>")
        print("\nExemplos:")
        print("  python diagnostico_dxf_completo.py PANTANAL_ESGOTO.dxf")
        print("  python diagnostico_dxf_completo.py CRIADORES_AGUA.dxf")
        sys.exit(1)
    
    dxf_path = sys.argv[1]
    analisar_dxf_completo(dxf_path)


if __name__ == "__main__":
    main()
