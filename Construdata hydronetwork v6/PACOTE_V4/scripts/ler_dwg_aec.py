#!/usr/bin/env python3
"""
LER_DWG_AEC.PY — Leitor de Pipe Networks trancados em AEC Proxy Objects
ConstruData - HydroNetwork
Contrato 11481051 — SLNR Santos

DWGs do Civil 3D com Pipe Networks são salvos como AEC Proxy Objects
que o libredwg/ODA/ezdxf não conseguem decodificar.

Este script extrai os dados disponíveis:
1. Converte DWG → DXF via libredwg (extrai textos + proxy graphics)
2. Parseia textos PS_PONTOS (P.V., C.T., C.F., P.F.) → PVs com cotas
3. Parseia textos multiline (PV01\\nCTF=0.50) → PVs com CTF
4. Reconstrói topologia da rede pela sequência dos nomes dos PVs
5. Gera saída no formato padrão (pvs, trechos) compatível com todo o pipeline

USO:
    pvs, trechos, meta = ler_dwg_aec("PROLONGAMENTO.dwg")
    # ou se já converteu:
    pvs, trechos, meta = ler_dwg_aec("PROLONGAMENTO.dxf")

Autor: Felipe Nery — FCN Construções e Saneamento
"""

import os, re, subprocess, tempfile
from collections import defaultdict
from pathlib import Path

# Path do libredwg (ajustar se necessário)
LIBREDWG_PATH = "/tmp/libredwg/programs/dwg2dxf"
LIBREDWG_LIB = "/tmp/libredwg/src/.libs"


def _log(msg, level="INFO"):
    print(f"[AEC] [{level:4s}] {msg}")


def _converter_dwg_para_dxf(dwg_path):
    """Converte DWG → DXF usando libredwg."""
    dxf_path = str(Path(dwg_path).with_suffix('.dxf'))
    
    if not os.path.exists(LIBREDWG_PATH):
        raise FileNotFoundError(
            f"libredwg não encontrado em {LIBREDWG_PATH}. "
            f"Converta manualmente o DWG para DXF ou compile o libredwg."
        )
    
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = LIBREDWG_LIB
    
    # Usar arquivo temporário se o DXF já existe
    tmp_dxf = tempfile.NamedTemporaryFile(suffix=".dxf", delete=False).name
    
    result = subprocess.run(
        [LIBREDWG_PATH, "-o", tmp_dxf, dwg_path],
        capture_output=True, text=True, env=env
    )
    
    if os.path.exists(tmp_dxf) and os.path.getsize(tmp_dxf) > 100:
        _log(f"DWG → DXF: {os.path.getsize(tmp_dxf)/1024:.0f} KB")
        return tmp_dxf
    else:
        _log(f"Falha na conversão DWG → DXF", "WARN")
        if result.stderr:
            _log(result.stderr[:200], "WARN")
        return None


def _extrair_pvs_de_dxf(dxf_path):
    """Extrai PVs com nomes e cotas de DXF convertido de DWG Civil 3D."""
    import geopandas as gpd
    import warnings
    warnings.filterwarnings("ignore")
    
    gdf = gpd.read_file(dxf_path, engine="pyogrio")
    texts = gdf[gdf["Text"].notna()]
    
    pvs = {}
    
    for _, r in texts.iterrows():
        t = str(r["Text"]).strip()
        g = r.geometry
        x, y = g.centroid.x, g.centroid.y
        
        # ── Formato multiline: "PV10\nCTF=0,50" (Civil 3D labels) ──
        if "\n" in t:
            lines = t.split("\n")
            nome = None
            ctf = None
            for line in lines:
                lu = line.upper().strip()
                if lu.startswith(("PV", "PI")) and "CTF" not in lu:
                    nome = lu.replace("\\N", "").strip().replace(" ", "")
                if "CTF" in lu:
                    m = re.search(r'[-]?\d+[,.]?\d*', lu.replace(",", "."))
                    if m and "XXX" not in lu:
                        ctf = float(m.group())
            if nome:
                if nome not in pvs or ctf is not None:
                    pvs[nome] = {
                        "x": round(x, 3), "y": round(y, 3),
                        "ct": 0, "cf": 0, "prof": 0, "ctf": ctf,
                    }
        
        # ── Formato SABESP padrão: "P.V. 11" + "C.T. -2.052" separados ──
        tu = t.upper().strip()
        
        if tu.startswith(("P.V.", "P.I.")):
            nome = tu.replace("P.V.", "PV").replace("P.I.", "PI").replace(" ", "").strip()
            pvs.setdefault(nome, {"x": 0, "y": 0, "ct": 0, "cf": 0, "prof": 0})
            pvs[nome]["x"] = round(x, 3)
            pvs[nome]["y"] = round(y, 3)
        
        elif tu.startswith("C.T."):
            m = re.search(r'[-]?\d+[,.]?\d*', tu.replace(",", "."))
            if m:
                val = float(m.group())
                best, best_d = None, 30  # máximo 30m
                for n, p in pvs.items():
                    d = ((x - p["x"])**2 + (y - p["y"])**2)**0.5
                    if d < best_d:
                        best_d = d
                        best = n
                if best:
                    pvs[best]["ct"] = val
        
        elif tu.startswith("C.F."):
            m = re.search(r'[-]?\d+[,.]?\d*', tu.replace(",", "."))
            if m:
                val = float(m.group())
                best, best_d = None, 30
                for n, p in pvs.items():
                    d = ((x - p["x"])**2 + (y - p["y"])**2)**0.5
                    if d < best_d:
                        best_d = d
                        best = n
                if best:
                    pvs[best]["cf"] = val
        
        elif tu.startswith("P.F."):
            m = re.search(r'[-]?\d+[,.]?\d*', tu.replace(",", "."))
            if m:
                val = float(m.group())
                best, best_d = None, 30
                for n, p in pvs.items():
                    d = ((x - p["x"])**2 + (y - p["y"])**2)**0.5
                    if d < best_d:
                        best_d = d
                        best = n
                if best:
                    pvs[best]["prof"] = val
    
    return pvs


def _reconstruir_rede(pvs, dn_padrao=200, max_ext=300):
    """
    Reconstrói topologia da rede pela sequência dos nomes dos PVs.
    
    Lógica:
    - PV01→PV02→PV03... = tronco principal
    - PV01A→PV02A→PV03A... = ramal A
    - PV01B... = ramal B
    - Conexão ramal→tronco: PV01→PV01A (mesmo número, sufixo diferente)
    """
    trechos = []
    
    # Separar por ramo (sufixo)
    ramos = defaultdict(list)
    for nome in pvs:
        m = re.match(r'(PV|PI|PVEX)(\d*)([A-Z]?)', nome.upper())
        if m:
            num_str = m.group(2)
            num = int(num_str) if num_str else 99
            suffix = m.group(3)
            ramos[suffix].append((num, nome))
    
    # Conectar sequencialmente dentro de cada ramo
    for suffix, pvs_list in sorted(ramos.items()):
        pvs_sorted = sorted(pvs_list, key=lambda x: x[0])
        
        for i in range(len(pvs_sorted) - 1):
            _, nome_a = pvs_sorted[i]
            _, nome_b = pvs_sorted[i + 1]
            
            if nome_a in pvs and nome_b in pvs:
                pa, pb = pvs[nome_a], pvs[nome_b]
                if pa.get("x") and pb.get("x"):
                    ext = ((pa["x"] - pb["x"])**2 + (pa["y"] - pb["y"])**2)**0.5
                    
                    if ext < max_ext:
                        trechos.append({
                            "pv_ini": nome_a,
                            "pv_fim": nome_b,
                            "dn_mm": dn_padrao,
                            "ext_m": round(ext, 1),
                            "material": "PVC",
                            "decl_mm": 0,
                            "ramo": suffix or "TRONCO",
                        })
    
    # Conectar ramais ao tronco
    tronco_pvs = {num: nome for num, nome in ramos.get('', [])}
    for suffix in ['A', 'B', 'C', 'D']:
        if suffix in ramos and ramos[suffix]:
            first_num, first_name = sorted(ramos[suffix])[0]
            if first_num in tronco_pvs:
                tronco_name = tronco_pvs[first_num]
                if first_name in pvs and tronco_name in pvs:
                    pa, pb = pvs[first_name], pvs[tronco_name]
                    if pa.get("x") and pb.get("x"):
                        ext = ((pa["x"] - pb["x"])**2 + (pa["y"] - pb["y"])**2)**0.5
                        if ext < max_ext:
                            trechos.append({
                                "pv_ini": tronco_name,
                                "pv_fim": first_name,
                                "dn_mm": dn_padrao,
                                "ext_m": round(ext, 1),
                                "material": "PVC",
                                "decl_mm": 0,
                                "ramo": f"CONEXÃO→{suffix}",
                            })
    
    return trechos


def ler_dwg_aec(path, dn_padrao=200):
    """
    Lê Pipe Network de DWG/DXF com AEC Proxy Objects.
    
    Args:
        path: caminho do .dwg ou .dxf
        dn_padrao: DN padrão quando não detectado (mm)
    
    Returns:
        pvs: dict nome → {x, y, ct, cf, prof, ctf}
        trechos: list of {pv_ini, pv_fim, dn_mm, ext_m, material, decl_mm}
        meta: dict com metadados
    """
    path = str(path)
    _log(f">>> Lendo {Path(path).name}")
    
    # Converter DWG → DXF se necessário
    dxf_path = path
    tmp_file = None
    
    if path.lower().endswith('.dwg'):
        _log("Convertendo DWG -> DXF via libredwg...")
        tmp_file = _converter_dwg_para_dxf(path)
        if tmp_file:
            dxf_path = tmp_file
        else:
            _log("Tentando ler DXF com mesmo nome...", "WARN")
            dxf_path = str(Path(path).with_suffix('.dxf'))
            if not os.path.exists(dxf_path):
                raise FileNotFoundError(f"Não foi possível converter {path}")
    
    # Extrair PVs
    _log("Extraindo PVs dos textos...")
    pvs = _extrair_pvs_de_dxf(dxf_path)
    _log(f"PVs encontrados: {len(pvs)}")
    
    if not pvs:
        _log("Nenhum PV encontrado — arquivo sem dados de texto", "WARN")
        # Cleanup
        if tmp_file and os.path.exists(tmp_file):
            os.unlink(tmp_file)
        return {}, [], {"motor": "AEC_proxy", "status": "sem_dados"}
    
    # Reconstruir rede
    _log("Reconstruindo topologia da rede...")
    trechos = _reconstruir_rede(pvs, dn_padrao)
    
    ext_total = sum(t["ext_m"] for t in trechos)
    _log(f"Rede reconstruída: {len(trechos)} trechos | {ext_total:.0f}m")
    
    # Meta
    meta = {
        "motor": "AEC_proxy",
        "arquivo": Path(path).name,
        "n_pvs": len(pvs),
        "n_trechos": len(trechos),
        "extensao_m": round(ext_total, 1),
        "dn_padrao": dn_padrao,
        "obs": "Rede reconstruída por topologia de nomes PV. "
               "DN e declividade estimados. Validar em campo.",
    }
    
    # Cleanup
    if tmp_file and os.path.exists(tmp_file):
        os.unlink(tmp_file)
    
    return pvs, trechos, meta


# ═══════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════
if __name__ == "__main__":
    import sys, json
    
    if len(sys.argv) < 2:
        print("USO: python ler_dwg_aec.py <arquivo.dwg|dxf>")
        print("     Lê Pipe Networks de AEC Proxy Objects do Civil 3D")
        sys.exit(1)
    
    pvs, trechos, meta = ler_dwg_aec(sys.argv[1])
    
    print(f"\nResultado: {meta}")
    print(f"\nPVs ({len(pvs)}):")
    for nome, pv in sorted(pvs.items()):
        print(f"  {nome:10s} | E={pv['x']:.0f} N={pv['y']:.0f} | CTF={pv.get('ctf','?')}")
    
    print(f"\nTrechos ({len(trechos)}):")
    for t in trechos:
        print(f"  {t['pv_ini']:8s} → {t['pv_fim']:8s} | {t['ext_m']:>7.1f}m | DN{t['dn_mm']}")
