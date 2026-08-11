import os
import sys
import json
import traceback
import pandas as pd
from pathlib import Path

sys.path.append(r"C:\Users\felip\Downloads\NOVA NS Versao 5")

from ler_dxf_gdal import ler_dxf_gdal
from gerar_ns import gerar_ns_a4, enriquecer_trechos, calcular_materiais

SRC_FOLDER = r"C:\Users\felip\Desktop\projetos enviar felipe (2)\projetos enviar felipe"
DST_FOLDER = r"C:\Users\felip\Desktop\NOVO"

def sanitizar_nome(nome):
    if not nome:
        return "DESCONHECIDO"
    safe = "".join([c if c.isalnum() or c in " _-." else "_" for c in str(nome)])
    return safe.strip()[:100]

def main():
    Path(DST_FOLDER).mkdir(parents=True, exist_ok=True)
    
    arquivos_dxf = list(Path(SRC_FOLDER).glob("*.dxf"))
    if not arquivos_dxf:
        print("Nenhum arquivo .dxf encontrado na pasta de origem.")
        return

    for dxf_path in arquivos_dxf:
        nucleo = dxf_path.stem
        print(f"\n======================================")
        print(f"Processando Projeto/Nucleo: {nucleo}")
        print(f"======================================")
        
        try:
            pvs, trechos, ruas, meta = ler_dxf_gdal(str(dxf_path))
        except Exception as e:
            print(f"Erro ao ler DXF {nucleo}: {e}")
            traceback.print_exc()
            continue
            
        if not trechos:
            print(f"Nenhum trecho encontrado no projeto {nucleo}.")
            continue
            
        # Enrich trechos with CT/CF data to ensure logic uses all data points
        trechos = enriquecer_trechos(trechos, pvs)

        # Agrupar por Rua
        trechos_por_rua = {}
        for t in trechos:
            rua = str(t.get("rua") or "SEM RUA").strip()
            if not rua or rua.upper() == "NAN":
                rua = "SEM RUA"
            rua_safe = sanitizar_nome(rua)
            
            if rua_safe not in trechos_por_rua:
                trechos_por_rua[rua_safe] = []
            trechos_por_rua[rua_safe].append(t)
            
        for rua_safe, lista_trechos in trechos_por_rua.items():
            pasta_rua = Path(DST_FOLDER) / sanitizar_nome(nucleo) / rua_safe
            pasta_rua.mkdir(parents=True, exist_ok=True)
            print(f"  -> Rua: {rua_safe} ({len(lista_trechos)} trechos)")
            
            rows = []
            for i, t in enumerate(lista_trechos):
                ns_id = i + 1
                pv_i = sanitizar_nome(t.get('pv_ini', 'PV_X'))
                pv_f = sanitizar_nome(t.get('pv_fim', 'PV_Y'))
                nome_trecho = f"{pv_i}_AO_{pv_f}"
                
                # Criar pasta pro trecho
                pasta_trecho = pasta_rua / nome_trecho
                pasta_trecho.mkdir(exist_ok=True)
                
                # Gerar PDF A4 (opcional/útil)
                pdf_path = pasta_trecho / f"{nome_trecho}.pdf"
                try:
                    gerar_ns_a4(ns_id, t, pvs, nucleo, str(pdf_path))
                except Exception as e:
                    print(f"     Aviso: não foi possível gerar PDF para {nome_trecho}: {e}")
                
                # Gerar JSON com as informações do trecho + materiais
                json_path = pasta_trecho / f"{nome_trecho}.json"
                materiais = calcular_materiais(t, pvs)
                dados_completos = {
                    "trecho": t,
                    "pv_ini_dados": pvs.get(t.get('pv_ini')),
                    "pv_fim_dados": pvs.get(t.get('pv_fim')),
                    "materiais": materiais
                }
                
                with open(json_path, 'w', encoding='utf-8') as f_json:
                    json.dump(dados_completos, f_json, indent=4, ensure_ascii=False)
                    
                # Extrair quantidades calculadas para a planilha
                tubos_barras = 0
                areia_m3 = 0
                brita_m3 = 0
                for mat in materiais:
                    desc = str(mat.get("descricao", "")).lower()
                    qtd = mat.get("quantidade", 0)
                    if "tubo" in desc:
                        tubos_barras += qtd
                    elif "areia" in desc:
                        areia_m3 += qtd
                    elif "brita" in desc:
                        brita_m3 += qtd

                # Cálculos de engenharia (idênticos à plataforma)
                dn_mm = t.get('dn_mm')
                ext_m = t.get('ext_m') or 0
                
                ct_i = pvs.get(t.get('pv_ini'), {}).get('ct')
                cf_i = pvs.get(t.get('pv_ini'), {}).get('cf')
                prof_i = pvs.get(t.get('pv_ini'), {}).get('prof')
                
                ct_f = pvs.get(t.get('pv_fim'), {}).get('ct')
                cf_f = pvs.get(t.get('pv_fim'), {}).get('cf')
                prof_f = pvs.get(t.get('pv_fim'), {}).get('prof')
                
                # Calcular profundidade média
                profs = [p for p in [prof_i, prof_f] if p not in (None, "", 0)]
                prof_media = sum(profs)/len(profs) if profs else 0
                
                # Largura da vala (padrão SABESP)
                calc_dn = float(dn_mm) / 1000.0 if dn_mm and str(dn_mm).isdigit() else 0.20
                largura_vala = max(0.60, calc_dn + 0.50)
                
                # Volumes
                vol_escavacao = round(ext_m * largura_vala * prof_media, 2)
                vol_aterro = round(ext_m * largura_vala * 0.15, 2) # Lastro padrão
                area_pav = round(ext_m * max(largura_vala * 0.9, 0.6), 2)
                    
                rows.append({
                    "Projeto": nucleo,
                    "Rua": rua_safe,
                    "PV Montante": t.get('pv_ini'),
                    "PV Jusante": t.get('pv_fim'),
                    "Extensao (m)": ext_m,
                    "DN (mm)": dn_mm,
                    "Declividade (%)": t.get('decl_pct'),
                    "Material": t.get('material', 'PVC'),
                    "CT Montante": ct_i,
                    "CF Montante": cf_i,
                    "Prof Montante": prof_i,
                    "CT Jusante": ct_f,
                    "CF Jusante": cf_f,
                    "Prof Jusante": prof_f,
                    "Volume Escavação (m³)": vol_escavacao,
                    "Volume Aterro (m³)": vol_aterro,
                    "Área Pavimentação/Asfalto (m²)": area_pav,
                    "Tubos (barras)": tubos_barras,
                    "Volume Areia (m³)": round(areia_m3, 2),
                    "Volume Brita (m³)": round(brita_m3, 2)
                })
            
            # Exportar Excel com todos os trechos da rua (resumo)
            if rows:
                df = pd.DataFrame(rows)
                excel_path = pasta_rua / f"Resumo_Trechos_{rua_safe}.xlsx"
                try:
                    df.to_excel(excel_path, index=False)
                except Exception as e:
                    print(f"     Aviso: erro ao salvar Excel para {rua_safe}: {e}")

if __name__ == "__main__":
    main()
