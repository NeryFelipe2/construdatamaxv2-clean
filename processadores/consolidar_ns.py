"""
Script para consolidar todas as Notas de Serviço (NS) dos projetos de água e esgoto.
Gera um relatório geral em Excel e JSON com todas as NS encontradas.
"""

import os
import json
import pandas as pd
from pathlib import Path
from datetime import datetime

# Caminho base das Notas de Serviço
BASE_PATH = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\NOTAS DE SERVICO COMPLETAS 24-03-2026"

# Output path
OUTPUT_PATH = r"c:\Users\felip\Downloads\NOVA NS Versao 5"

def listar_todos_arquivos_ns(pasta_base):
    """Lista todos os arquivos de todas as NS organizadas por bairro."""
    resultados = []
    
    # Itera sobre cada bairro/localidade
    for bairro in os.listdir(pasta_base):
        caminho_bairro = os.path.join(pasta_base, bairro)
        
        if not os.path.isdir(caminho_bairro):
            continue
            
        # Itera sobre cada pasta NS dentro do bairro
        for ns_folder in os.listdir(caminho_bairro):
            caminho_ns = os.path.join(caminho_bairro, ns_folder)
            
            if not os.path.isdir(caminho_ns) or ns_folder == "GIS":
                continue
            
            # Lista arquivos na pasta da NS
            arquivos = os.listdir(caminho_ns)
            
            # Identifica o número da NS
            numero_ns = ns_folder.replace("NS_", "").split("_AO_")[0] if "NS_" in ns_folder else ns_folder
            
            # Tenta extrair informações do nome da pasta
            info_ns = {
                "bairro": bairro,
                "numero_ns": numero_ns,
                "nome_pasta": ns_folder,
                "caminho_completo": caminho_ns,
                "arquivos": arquivos,
                "tem_desenho": any(".pdf" in f and "Desenho" in f for f in arquivos),
                "tem_satelite": any(".pdf" in f and "Satelite" in f for f in arquivos),
                "tem_a4": any("A4.pdf" in f for f in arquivos),
                "tem_dados_json": any(".json" in f for f in arquivos),
                "tem_ose_xlsx": any(".xlsx" in f for f in arquivos),
                "tem_mapa_html": any(".html" in f for f in arquivos),
                "total_arquivos": len(arquivos)
            }
            
            # Tenta ler o JSON de dados se existir
            dados_json = None
            for arquivo in arquivos:
                if arquivo.endswith(".json"):
                    try:
                        caminho_json = os.path.join(caminho_ns, arquivo)
                        with open(caminho_json, 'r', encoding='utf-8') as f:
                            dados_json = json.load(f)
                            info_ns["dados_json_lidos"] = True
                            info_ns["dados_json"] = dados_json
                    except Exception as e:
                        info_ns["dados_json_lidos"] = False
                        info_ns["erro_json"] = str(e)
                    break
            
            resultados.append(info_ns)
            print(f"✓ Processado: {bairro}/{ns_folder}")
    
    return resultados


def extrair_dados_json(dados_json):
    """Extrai dados relevantes do JSON da NS."""
    if not dados_json:
        return {}
    
    # Estrutura comum nos JSONs
    dados_extraidos = {
        "projeto": dados_json.get("projeto", ""),
        "bairro": dados_json.get("bairro", ""),
        "tipo_redes": dados_json.get("tipo_redes", ""),
        "extensao_total": dados_json.get("extensao_total", 0),
        "trechos": len(dados_json.get("trechos", [])),
        "pontos_iniciais": [],
        "pontos_finais": []
    }
    
    # Extrai pontos dos trechos
    trechos = dados_json.get("trechos", [])
    for trecho in trechos[:5]:  # Limita a 5 para não ficar muito grande
        dados_extraidos["pontos_iniciais"].append(trecho.get("ponto_inicial", ""))
        dados_extraidos["pontos_finais"].append(trecho.get("ponto_final", ""))
    
    return dados_extraidos


def gerar_relatorio_excel(resultados, output_path):
    """Gera relatório em Excel consolidado."""
    # Prepara dados para Excel
    dados_excel = []
    
    for ns in resultados:
        dados_extraidos = extrair_dados_json(ns.get("dados_json"))
        
        linha = {
            "Bairro": ns["bairro"],
            "Número NS": ns["numero_ns"],
            "Nome Pasta": ns["nome_pasta"],
            "Total Arquivos": ns["total_arquivos"],
            "Tem Desenho PDF": "Sim" if ns["tem_desenho"] else "Não",
            "Tem Satélite PDF": "Sim" if ns["tem_satelite"] else "Não",
            "Tem A4 PDF": "Sim" if ns["tem_a4"] else "Não",
            "Tem Dados JSON": "Sim" if ns["tem_dados_json"] else "Não",
            "Tem OSE XLSX": "Sim" if ns["tem_ose_xlsx"] else "Não",
            "Tem Mapa HTML": "Sim" if ns["tem_mapa_html"] else "Não",
            "Projeto (JSON)": dados_extraidos.get("projeto", ""),
            "Tipo Redes (JSON)": dados_extraidos.get("tipo_redes", ""),
            "Extensão Total (JSON)": dados_extraidos.get("extensao_total", 0),
            "Qtd Trechos (JSON)": dados_extraidos.get("trechos", 0),
            "Caminho Completo": ns["caminho_completo"]
        }
        
        dados_excel.append(linha)
    
    # Cria DataFrame
    df = pd.DataFrame(dados_excel)
    
    # Salva Excel
    caminho_excel = os.path.join(output_path, "CONSOLIDADO_NOTAS_SERVICO.xlsx")
    df.to_excel(caminho_excel, index=False, sheet_name="Notas de Serviço")
    
    # Cria aba de resumo por bairro
    resumo_bairro = df.groupby("Bairro").agg({
        "Número NS": "count",
        "Tem Desenho PDF": lambda x: (x == "Sim").sum(),
        "Tem Satélite PDF": lambda x: (x == "Sim").sum(),
        "Tem Dados JSON": lambda x: (x == "Sim").sum(),
        "Tem OSE XLSX": lambda x: (x == "Sim").sum(),
        "Tem Mapa HTML": lambda x: (x == "Sim").sum()
    }).reset_index()
    
    resumo_bairro.columns = ["Bairro", "Total NS", "Com Desenho", "Com Satélite", 
                              "Com JSON", "Com OSE", "Com Mapa"]
    
    # Salva aba de resumo
    with pd.ExcelWriter(caminho_excel, engine='openpyxl', mode='a', 
                        if_sheet_exists='replace') as writer:
        resumo_bairro.to_excel(writer, index=False, sheet_name="Resumo por Bairro")
    
    print(f"\n✓ Excel consolidado salvo em: {caminho_excel}")
    return caminho_excel


def gerar_relatorio_json(resultados, output_path):
    """Gera relatório em JSON consolidado."""
    # Remove dados_json do output principal para não ficar muito grande
    resultados_resumo = []
    for ns in resultados:
        ns_resumo = {k: v for k, v in ns.items() if k != "dados_json"}
        resultados_resumo.append(ns_resumo)
    
    consolidado = {
        "data_geracao": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_ns": len(resultados),
        "bairros": list(set(ns["bairro"] for ns in resultados)),
        "notas_servico": resultados_resumo
    }
    
    caminho_json = os.path.join(output_path, "CONSOLIDADO_NOTAS_SERVICO.json")
    with open(caminho_json, 'w', encoding='utf-8') as f:
        json.dump(consolidado, f, ensure_ascii=False, indent=2)
    
    print(f"✓ JSON consolidado salvo em: {caminho_json}")
    return caminho_json


def gerar_resumo_texto(resultados, output_path):
    """Gera resumo em texto simples."""
    total_ns = len(resultados)
    
    # Conta por bairro
    contagem_bairro = {}
    for ns in resultados:
        bairro = ns["bairro"]
        contagem_bairro[bairro] = contagem_bairro.get(bairro, 0) + 1
    
    # Estatísticas de arquivos
    total_com_desenho = sum(1 for ns in resultados if ns["tem_desenho"])
    total_com_satelite = sum(1 for ns in resultados if ns["tem_satelite"])
    total_com_json = sum(1 for ns in resultados if ns["tem_dados_json"])
    total_com_ose = sum(1 for ns in resultados if ns["tem_ose_xlsx"])
    total_com_mapa = sum(1 for ns in resultados if ns["tem_mapa_html"])
    
    resumo = f"""
================================================================================
                    RELATÓRIO CONSOLIDADO - NOTAS DE SERVIÇO
                    Projetos de Água e Esgoto
================================================================================

Data de Geração: {datetime.now().strftime("%d/%m/%Y %H:%M:%S")}
Caminho Base: {BASE_PATH}

--------------------------------------------------------------------------------
                              RESUMO GERAL
--------------------------------------------------------------------------------

Total de Notas de Serviço encontradas: {total_ns}

Bairros/Localidades processados:
"""
    
    for bairro, qtd in sorted(contagem_bairro.items()):
        resumo += f"  • {bairro}: {qtd} NS\n"
    
    resumo += f"""
--------------------------------------------------------------------------------
                           ESTATÍSTICAS DE ARQUIVOS
--------------------------------------------------------------------------------

Arquivos de Desenho PDF:     {total_com_desenho}/{total_ns} ({100*total_com_desenho/total_ns:.1f}%)
Arquivos de Satélite PDF:    {total_com_satelite}/{total_ns} ({100*total_com_satelite/total_ns:.1f}%)
Arquivos A4 PDF:             {sum(1 for ns in resultados if ns['tem_a4'])}/{total_ns}
Arquivos JSON (dados):       {total_com_json}/{total_ns} ({100*total_com_json/total_ns:.1f}%)
Arquivos XLSX (OSE):         {total_com_ose}/{total_ns} ({100*total_com_ose/total_ns:.1f}%)
Arquivos HTML (mapas):       {total_com_mapa}/{total_ns} ({100*total_com_mapa/total_ns:.1f}%)

================================================================================
"""
    
    caminho_txt = os.path.join(output_path, "RESUMO_NOTAS_SERVICO.txt")
    with open(caminho_txt, 'w', encoding='utf-8') as f:
        f.write(resumo)
    
    print(f"✓ Resumo texto salvo em: {caminho_txt}")
    print(resumo)
    
    return caminho_txt


def main():
    print("=" * 80)
    print("CONSOLIDADOR DE NOTAS DE SERVIÇO - ÁGUA E ESGOTO")
    print("=" * 80)
    print(f"\nCaminho base: {BASE_PATH}\n")
    
    # Lista todas as NS
    print("Iniciando varredura das Notas de Serviço...\n")
    resultados = listar_todos_arquivos_ns(BASE_PATH)
    
    print(f"\n✓ Total de NS encontradas: {len(resultados)}")
    
    # Gera relatórios
    print("\nGerando relatórios consolidados...\n")
    
    gerar_relatorio_excel(resultados, OUTPUT_PATH)
    gerar_relatorio_json(resultados, OUTPUT_PATH)
    gerar_resumo_texto(resultados, OUTPUT_PATH)
    
    print("\n" + "=" * 80)
    print("PROCESSAMENTO CONCLUÍDO!")
    print("=" * 80)


if __name__ == "__main__":
    main()
