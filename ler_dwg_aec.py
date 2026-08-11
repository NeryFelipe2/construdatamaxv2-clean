#!/usr/bin/env python3
"""
LER_DWG_AEC.PY — Leitor de Pipe Networks de DWG Civil 3D
ConstruData SABESP v5.0 — Contrato 11481051 — SLNR Santos

Extrai dados de Pipe Networks (AeccDbPipe/AeccDbStructure) de DWGs
do Civil 3D usando 3 camadas com fallback:

  Camada 1: LISP via accoreconsole — extrai propriedades BIM
  Camada 2: EXPORTTOAUTOCAD + parser de textos — fallback
  Camada 3: COM automation (win32com) — validacao/complemento

USO:
    pvs, trechos, meta = ler_dwg_aec("ARQUIVO.dwg")

Autor: Felipe Nery — FCN / FCN Construções e Saneamento
"""

import csv
import io
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from collections import defaultdict
from pathlib import Path

# ═══════════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════════

LIBREDWG_PATH = "/tmp/libredwg/programs/dwg2dxf"
LIBREDWG_LIB = "/tmp/libredwg/src/.libs"

_ACAD_PATHS = [
    r"C:\Program Files\Autodesk\Civil 3D 2026\accoreconsole.exe",
    r"C:\Program Files\Autodesk\Civil 3D 2025\accoreconsole.exe",
    r"C:\Program Files\Autodesk\Civil 3D 2024\accoreconsole.exe",
    r"C:\Program Files\Autodesk\AutoCAD 2026\accoreconsole.exe",
    r"C:\Program Files\Autodesk\AutoCAD 2025\accoreconsole.exe",
    r"C:\Program Files\Autodesk\AutoCAD 2024\accoreconsole.exe",
]

LISP_SCRIPT = Path(__file__).resolve().parent / "extrair_pipe_network.lsp"


# ═══════════════════════════════════════════════════════════════════════
# UTILS
# ═══════════════════════════════════════════════════════════════════════

def _log(msg, level="INFO"):
    try:
        print(f"[AEC] [{level:4s}] {msg}")
    except UnicodeEncodeError:
        print(f"[AEC] [{level:4s}] {msg.encode('ascii', errors='replace').decode()}")


def _get_temp_dir():
    """Retorna pasta temporaria gravavel."""
    candidatos = []
    env_tmp = os.environ.get("CONSTRUDATA_TMP_DIR")
    if env_tmp:
        candidatos.append(Path(env_tmp))
    candidatos.extend([
        Path(__file__).resolve().parent / "_tmp_dwg",
        Path.cwd() / "_tmp_dwg",
    ])
    for pasta in candidatos:
        try:
            pasta.mkdir(parents=True, exist_ok=True)
            teste = pasta / ".write_test"
            teste.write_text("ok", encoding="utf-8")
            teste.unlink(missing_ok=True)
            return str(pasta)
        except Exception:
            continue
    raise PermissionError("Nenhuma pasta temporaria gravavel encontrada.")


def _achar_accoreconsole():
    for p in _ACAD_PATHS:
        if os.path.exists(p):
            return p
    return None


def _stem_ascii(nome, max_len=30):
    """Normaliza nome de arquivo removendo acentos e caracteres especiais."""
    s = unicodedata.normalize("NFKD", nome)
    s = "".join(c for c in s if ord(c) < 128)
    s = re.sub(r"[^\w]", "_", s)[:max_len] or "dwg_conv"
    return s


def _parse_float(text):
    """Extrai float de texto, tratando virgula decimal."""
    if not text:
        return None
    text = str(text).replace(",", ".").strip()
    m = re.search(r'[-+]?\d+\.?\d*', text)
    return float(m.group()) if m else None


# ═══════════════════════════════════════════════════════════════════════
# CAMADA 0: LANDXMLOUT via accoreconsole (MELHOR ABORDAGEM)
# ═══════════════════════════════════════════════════════════════════════

def _extrair_via_landxml(dwg_path):
    """
    Exporta Pipe Network como LandXML via accoreconsole, depois le com ler_landxml.py.
    Este e o metodo mais confiavel pois:
    - LANDXMLOUT e um comando nativo do Civil 3D / Object Enabler
    - LandXML contem TODOS os dados BIM (CT, CF, DN, slope, etc.)
    - Ja temos parser robusto (ler_landxml.py)
    Retorna (pvs, trechos, ruas, meta) ou (None, None, None, None) se falhar.
    """
    accore = _achar_accoreconsole()
    if not accore:
        _log("accoreconsole nao encontrado", "WARN")
        return None, None, None, None

    tmp_dir = _get_temp_dir()
    stem = _stem_ascii(Path(dwg_path).stem)
    tmp_dwg = str(Path(tmp_dir) / f"{stem}.dwg")
    tmp_xml = str(Path(tmp_dir) / f"{stem}.xml")
    tmp_dxf = str(Path(tmp_dir) / f"{stem}.dxf")

    if not os.path.exists(tmp_dwg):
        _log(f"Copiando DWG para {tmp_dwg}")
        shutil.copy2(dwg_path, tmp_dwg)

    tmp_xml_fwd = tmp_xml.replace("\\", "/")
    tmp_dxf_fwd = tmp_dxf.replace("\\", "/")

    # SCR: tentar LANDXMLOUT, depois tentar explodir para AutoCAD (AEC TO ACAD)
    # se nada der certo, apenas salva DXF.
    scr_content = (
        f'(setvar "FILEDIA" 0)\r\n'
        f'(setvar "CMDECHO" 0)\r\n'
        f'(vl-catch-all-apply (function (lambda () (command "_.-LANDXMLOUT" "{tmp_xml_fwd}" ""))))\r\n'
        f'(vl-catch-all-apply (function (lambda () (command "_AECTOACAD" "{tmp_dxf_fwd}" ""))))\r\n'
        f'(command "_SAVEAS" "DXF" "" "{tmp_dxf_fwd}")\r\n'
        f'(acad-quit)\r\n'
    )

    scr_file = tempfile.NamedTemporaryFile(
        suffix=".scr", mode="wb", delete=False, dir=tmp_dir
    )
    scr_file.write(scr_content.encode("ascii", errors="replace"))
    scr_file.close()

    _log(f"Camada 0: LANDXMLOUT via accoreconsole")
    try:
        result = subprocess.run(
            [accore, "/i", tmp_dwg, "/s", scr_file.name],
            capture_output=True, timeout=180
        )
        _log(f"accoreconsole exit={result.returncode}")
    except subprocess.TimeoutExpired:
        _log("accoreconsole timeout (180s)", "WARN")
    finally:
        try:
            os.unlink(scr_file.name)
        except Exception:
            pass

    # Verificar se LandXML foi gerado
    if os.path.exists(tmp_xml) and os.path.getsize(tmp_xml) > 100:
        _log(f"LandXML exportado: {os.path.getsize(tmp_xml)/1024:.0f} KB", "OK")
        try:
            from ler_landxml import ler_landxml
            pvs, trechos, ruas, meta = ler_landxml(tmp_xml)
            if pvs:
                n_ct = sum(1 for p in pvs.values() if p.get("ct"))
                _log(f"Camada 0 OK: {len(pvs)} PVs ({n_ct} com CT), "
                     f"{len(trechos)} trechos via LandXML", "OK")
                meta["motor"] = "LandXML_accoreconsole"
                return pvs, trechos, ruas, meta
            else:
                _log("LandXML parseado mas sem PVs", "WARN")
        except Exception as e:
            _log(f"Erro ao ler LandXML: {e}", "WARN")
    else:
        _log("LANDXMLOUT nao gerou arquivo (comando pode nao estar disponivel)", "WARN")

    return None, None, None, None


# ═══════════════════════════════════════════════════════════════════════
# CAMADA 1: LISP via accoreconsole
# ═══════════════════════════════════════════════════════════════════════

def _extrair_via_lisp(dwg_path):
    """
    Roda LISP de extracao via accoreconsole.
    Retorna (pvs, trechos, textos_raw) ou (None, None, None) se falhar.
    """
    accore = _achar_accoreconsole()
    if not accore:
        _log("accoreconsole nao encontrado", "WARN")
        return None, None, None

    if not LISP_SCRIPT.exists():
        _log(f"LISP nao encontrado: {LISP_SCRIPT}", "WARN")
        return None, None, None

    tmp_dir = _get_temp_dir()
    stem = _stem_ascii(Path(dwg_path).stem)
    tmp_dwg = str(Path(tmp_dir) / f"{stem}.dwg")

    _log(f"Copiando DWG para {tmp_dwg}")
    shutil.copy2(dwg_path, tmp_dwg)

    # Gerar SCR que carrega o LISP e executa
    lisp_path_fwd = str(LISP_SCRIPT).replace("\\", "/")
    output_dir_fwd = tmp_dir.replace("\\", "/")
    tmp_dxf_fwd = str(Path(tmp_dir) / f"{stem}.dxf").replace("\\", "/")

    scr_content = (
        f'(setvar "FILEDIA" 0)\r\n'
        f'(setvar "CMDECHO" 0)\r\n'
        f'(setq CONSTRUDATA_OUTPUT_DIR "{output_dir_fwd}/")\r\n'
        f'(vl-catch-all-apply (function (lambda () (load "{lisp_path_fwd}"))))\r\n'
        f'(command "_SAVEAS" "DXF" "" "{tmp_dxf_fwd}")\r\n'
        f'(acad-quit)\r\n'
    )

    scr_file = tempfile.NamedTemporaryFile(
        suffix=".scr", mode="wb", delete=False, dir=tmp_dir
    )
    scr_file.write(scr_content.encode("ascii", errors="replace"))
    scr_file.close()

    _log(f"Camada 1: LISP via accoreconsole ({Path(accore).parent.name})")
    try:
        result = subprocess.run(
            [accore, "/i", tmp_dwg, "/s", scr_file.name],
            capture_output=True, timeout=180
        )
        _log(f"accoreconsole exit={result.returncode}")
        # Log stdout/stderr para debug
        stdout = result.stdout.decode("latin-1", errors="replace")
        for line in stdout.split("\n"):
            if "[EXTRAI]" in line:
                _log(f"  LISP: {line.strip()}")
    except subprocess.TimeoutExpired:
        _log("accoreconsole timeout (180s)", "WARN")
    finally:
        try:
            os.unlink(scr_file.name)
        except Exception:
            pass

    # Ler resultados dos CSVs
    pvs_csv = Path(tmp_dir) / "PVS_EXTRAIDOS.csv"
    tubos_csv = Path(tmp_dir) / "TUBOS_EXTRAIDOS.csv"
    textos_csv = Path(tmp_dir) / "TEXTOS_EXTRAIDOS.csv"
    status_file = Path(tmp_dir) / "EXTRACAO_STATUS.txt"

    # Verificar status
    bim_ok = False
    if status_file.exists():
        status = status_file.read_text(encoding="utf-8", errors="replace")
        _log(f"Status LISP: {status.strip()}")
        bim_ok = "BIM_OK=1" in status

    pvs = _ler_csv_pvs(pvs_csv) if pvs_csv.exists() else {}
    trechos = _ler_csv_tubos(tubos_csv) if tubos_csv.exists() else []
    textos = _ler_csv_textos(textos_csv) if textos_csv.exists() else []

    if bim_ok and pvs:
        _log(f"Camada 1 OK: {len(pvs)} PVs BIM, {len(trechos)} trechos", "OK")
    elif pvs:
        _log(f"Camada 1 parcial: {len(pvs)} PVs (sem BIM), {len(textos)} textos", "WARN")
    else:
        _log("Camada 1: nenhum PV via LISP", "WARN")

    return pvs, trechos, textos


def _ler_csv_pvs(csv_path):
    """Le PVS_EXTRAIDOS.csv → dict de PVs."""
    pvs = {}
    try:
        with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            for row in reader:
                nome = row.get("NOME", "").strip()
                if not nome or nome == "?":
                    continue
                x = _parse_float(row.get("X"))
                y = _parse_float(row.get("Y"))
                ct = _parse_float(row.get("CT"))
                cf = _parse_float(row.get("CF"))
                prof = _parse_float(row.get("PROF"))
                diam = _parse_float(row.get("DIAMETRO"))

                pvs[nome] = {
                    "x": round(x, 3) if x else 0,
                    "y": round(y, 3) if y else 0,
                    "ct": round(ct, 4) if ct else 0,
                    "cf": round(cf, 4) if cf else 0,
                    "prof": round(prof, 3) if prof else 0,
                    "diam_pv": int(diam) if diam else 0,
                }
    except Exception as e:
        _log(f"Erro lendo PVS CSV: {e}", "WARN")
    return pvs


def _ler_csv_tubos(csv_path):
    """Le TUBOS_EXTRAIDOS.csv → lista de trechos."""
    trechos = []
    try:
        with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            for row in reader:
                pv_ini = row.get("PV_INI", "").strip()
                pv_fim = row.get("PV_FIM", "").strip()
                if not pv_ini or pv_ini == "?" or not pv_fim or pv_fim == "?":
                    continue
                dn = _parse_float(row.get("DN_MM"))
                ext = _parse_float(row.get("EXT_M"))
                decl = _parse_float(row.get("DECL"))
                inv_ini = _parse_float(row.get("INV_INI"))
                inv_fim = _parse_float(row.get("INV_FIM"))

                trechos.append({
                    "pv_ini": pv_ini,
                    "pv_fim": pv_fim,
                    "dn_mm": int(dn) if dn else 200,
                    "ext_m": round(ext, 2) if ext else 0,
                    "material": row.get("MAT", "PVC").strip() or "PVC",
                    "decl_mm": round(decl * 1000, 2) if decl else 0,
                    "inv_ini": round(inv_ini, 4) if inv_ini else 0,
                    "inv_fim": round(inv_fim, 4) if inv_fim else 0,
                })
    except Exception as e:
        _log(f"Erro lendo TUBOS CSV: {e}", "WARN")
    return trechos


def _ler_csv_textos(csv_path):
    """Le TEXTOS_EXTRAIDOS.csv → lista de {layer, x, y, texto}."""
    textos = []
    try:
        with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            for row in reader:
                txt = row.get("TEXTO", "").strip()
                if not txt:
                    continue
                textos.append({
                    "layer": row.get("LAYER", "").strip(),
                    "x": _parse_float(row.get("X")) or 0,
                    "y": _parse_float(row.get("Y")) or 0,
                    "texto": txt,
                })
    except Exception as e:
        _log(f"Erro lendo TEXTOS CSV: {e}", "WARN")
    return textos


# ═══════════════════════════════════════════════════════════════════════
# CAMADA 2: DXF texto parser (melhorado)
# ═══════════════════════════════════════════════════════════════════════

def _extrair_pvs_de_dxf(dxf_path):
    """Extrai PVs com nomes e cotas de DXF convertido de DWG Civil 3D."""
    try:
        import geopandas as gpd
    except ImportError:
        _log("geopandas nao disponivel", "WARN")
        return {}

    import warnings
    warnings.filterwarnings("ignore")

    try:
        gdf = gpd.read_file(dxf_path, engine="pyogrio")
    except Exception as e:
        _log(f"Erro lendo DXF: {e}", "WARN")
        return {}

    texts = gdf[gdf["Text"].notna()]
    pvs = {}
    cotas_ct = []  # (x, y, valor)
    cotas_cf = []
    cotas_pf = []

    for _, r in texts.iterrows():
        t = str(r["Text"]).strip()
        g = r.geometry
        x, y = g.centroid.x, g.centroid.y
        tu = t.upper().strip()

        # ── Multi-line: "PV10\nCTF=0,50" ou "PV10\nCT=5.2\nCF=3.8" ──
        if "\n" in t:
            lines = t.split("\n")
            nome = None
            ct_val = None
            cf_val = None
            ctf_val = None
            for line in lines:
                lu = line.upper().strip()
                # Nome do PV
                # Nome do PV (mais liberal)
                if re.search(r'\b(PV|PI|CAIXA|PVM|PVEX)\b\s*[-_]?\s*\d', lu) and "CTF" not in lu and "CT=" not in lu:
                    nome = re.sub(r'[\s\\N]', '', lu).replace("-", "")
                # CTF (combinado)
                if "CTF" in lu:
                    v = _parse_float(lu.split("CTF")[-1])
                    if v is not None:
                        ctf_val = v
                # CT separado
                if re.match(r'^CT\s*[=:]\s*', lu) or lu.startswith("C.T."):
                    v = _parse_float(lu)
                    if v is not None:
                        ct_val = v
                # CF separado
                if re.match(r'^CF\s*[=:]\s*', lu) or lu.startswith("C.F."):
                    v = _parse_float(lu)
                    if v is not None:
                        cf_val = v
                # RIM / INV (ingles)
                if re.match(r'^RIM\s*[=:]', lu):
                    v = _parse_float(lu)
                    if v is not None:
                        ct_val = v
                if re.match(r'^(INV|SUMP)\s*[=:]', lu):
                    v = _parse_float(lu)
                    if v is not None:
                        cf_val = v

            if nome:
                pv = pvs.get(nome, {"x": 0, "y": 0, "ct": 0, "cf": 0, "prof": 0})
                pv["x"] = round(x, 3)
                pv["y"] = round(y, 3)
                if ct_val is not None:
                    pv["ct"] = ct_val
                if cf_val is not None:
                    pv["cf"] = cf_val
                if ctf_val is not None:
                    pv["ctf"] = ctf_val
                if ct_val and cf_val:
                    pv["prof"] = round(ct_val - cf_val, 3)
                pvs[nome] = pv
            continue

        # ── Single-line: "P.V. 11", "PV-10", "PV10", "PVEX" ──
        # PV names (mais liberal)
        m_pv = re.search(r'\b(P\.?\s*V\.?|P\.?\s*I\.?|CAIXA|PVM)\b\s*[-_]?\s*(\d+\s*[A-Z]?)', tu)
        if m_pv:
            tipo = "PV" if "V" in m_pv.group(1).upper() else "PI"
            num = m_pv.group(2).replace(" ", "")
            nome = f"{tipo}{num}"
            pvs.setdefault(nome, {"x": 0, "y": 0, "ct": 0, "cf": 0, "prof": 0})
            pvs[nome]["x"] = round(x, 3)
            pvs[nome]["y"] = round(y, 3)
            continue
        if re.match(r'^PVEX\b', tu):
            pvs.setdefault("PVEX", {"x": 0, "y": 0, "ct": 0, "cf": 0, "prof": 0})
            pvs["PVEX"]["x"] = round(x, 3)
            pvs["PVEX"]["y"] = round(y, 3)
            continue

        # ── Cotas separadas: "C.T. 5.230" ou "CT=5.230" ──
        if tu.startswith("C.T.") or re.match(r'^CT\s*[=:]', tu):
            v = _parse_float(tu)
            if v is not None:
                cotas_ct.append((x, y, v))
        elif tu.startswith("C.F.") or re.match(r'^CF\s*[=:]', tu):
            v = _parse_float(tu)
            if v is not None:
                cotas_cf.append((x, y, v))
        elif tu.startswith("P.F.") or re.match(r'^(PF|PROF)\s*[=:]', tu):
            v = _parse_float(tu)
            if v is not None:
                cotas_pf.append((x, y, v))
        elif re.match(r'^RIM\s*[=:]', tu):
            v = _parse_float(tu)
            if v is not None:
                cotas_ct.append((x, y, v))
        elif re.match(r'^(INV|SUMP)\s*[=:]', tu):
            v = _parse_float(tu)
            if v is not None:
                cotas_cf.append((x, y, v))

    # ── Snap cotas separadas ao PV mais proximo (max 30m) ──
    def _snap_cota(cotas_list, pvs_dict, campo, max_d=30):
        for cx, cy, val in cotas_list:
            best_name, best_dist = None, max_d
            for nome, pv in pvs_dict.items():
                d = math.hypot(cx - pv["x"], cy - pv["y"])
                if d < best_dist:
                    best_dist = d
                    best_name = nome
            if best_name:
                pvs_dict[best_name][campo] = val

    _snap_cota(cotas_ct, pvs, "ct")
    _snap_cota(cotas_cf, pvs, "cf")
    _snap_cota(cotas_pf, pvs, "prof")

    # Calcular prof quando temos CT e CF
    for pv in pvs.values():
        if pv["ct"] and pv["cf"] and not pv.get("prof"):
            pv["prof"] = round(pv["ct"] - pv["cf"], 3)

    return pvs


def _extrair_pvs_de_textos(textos_raw):
    """Extrai PVs de textos coletados pelo LISP (TEXTOS_EXTRAIDOS.csv)."""
    pvs = {}
    cotas_ct = []
    cotas_cf = []
    cotas_pf = []

    for item in textos_raw:
        txt = item.get("texto", "").strip()
        x = item.get("x", 0)
        y = item.get("y", 0)
        tu = txt.upper().strip()

        # Multi-line
        if "\n" in txt:
            lines = txt.split("\n")
            nome = None
            ct_val = cf_val = ctf_val = None
            for line in lines:
                lu = line.upper().strip()
                if re.match(r'^(PV|PI|PVEX)\s*[-_]?\s*\d', lu) and "CTF" not in lu:
                    nome = re.sub(r'[\s\\N-]', '', lu)
                if "CTF" in lu:
                    v = _parse_float(lu.split("CTF")[-1])
                    if v is not None:
                        ctf_val = v
                if re.match(r'^CT\s*[=:]', lu):
                    ct_val = _parse_float(lu)
                if re.match(r'^CF\s*[=:]', lu):
                    cf_val = _parse_float(lu)
            if nome:
                pv = pvs.get(nome, {"x": 0, "y": 0, "ct": 0, "cf": 0, "prof": 0})
                pv["x"] = round(x, 3)
                pv["y"] = round(y, 3)
                if ct_val:
                    pv["ct"] = ct_val
                if cf_val:
                    pv["cf"] = cf_val
                if ctf_val:
                    pv["ctf"] = ctf_val
                pvs[nome] = pv
            continue

        # PV name
        m_pv = re.match(r'^(P\.?\s*V\.?|P\.?\s*I\.?)\s*[-_]?\s*(\d+\s*[A-Z]?)', tu)
        if m_pv:
            tipo = "PV" if "V" in m_pv.group(1).upper() else "PI"
            num = m_pv.group(2).replace(" ", "")
            nome = f"{tipo}{num}"
            pvs.setdefault(nome, {"x": 0, "y": 0, "ct": 0, "cf": 0, "prof": 0})
            pvs[nome]["x"] = round(x, 3)
            pvs[nome]["y"] = round(y, 3)
            continue
        if re.match(r'^PVEX\b', tu):
            pvs.setdefault("PVEX", {"x": 0, "y": 0, "ct": 0, "cf": 0, "prof": 0})
            pvs["PVEX"]["x"] = round(x, 3)
            pvs["PVEX"]["y"] = round(y, 3)
            continue

        # Cotas
        if tu.startswith("C.T.") or re.match(r'^CT\s*[=:]', tu):
            v = _parse_float(tu)
            if v is not None:
                cotas_ct.append((x, y, v))
        elif tu.startswith("C.F.") or re.match(r'^CF\s*[=:]', tu):
            v = _parse_float(tu)
            if v is not None:
                cotas_cf.append((x, y, v))
        elif tu.startswith("P.F.") or re.match(r'^(PF|PROF)\s*[=:]', tu):
            v = _parse_float(tu)
            if v is not None:
                cotas_pf.append((x, y, v))

    # Snap cotas
    def _snap(cotas, campo, max_d=30):
        for cx, cy, val in cotas:
            best, bdist = None, max_d
            for n, p in pvs.items():
                d = math.hypot(cx - p["x"], cy - p["y"])
                if d < bdist:
                    bdist = d
                    best = n
            if best:
                pvs[best][campo] = val

    _snap(cotas_ct, "ct")
    _snap(cotas_cf, "cf")
    _snap(cotas_pf, "prof")

    for pv in pvs.values():
        if pv["ct"] and pv["cf"] and not pv.get("prof"):
            pv["prof"] = round(pv["ct"] - pv["cf"], 3)

    return pvs


# ═══════════════════════════════════════════════════════════════════════
# CAMADA 3: COM automation (win32com)
# ═══════════════════════════════════════════════════════════════════════

def _extrair_via_com(dwg_path):
    """
    Abre DWG via Civil 3D / AutoCAD COM (Visible=False) e extrai Pipe Network.
    Usa nomes exatos: AeccDbStructure, AeccDbPipe.
    Retorna (pvs, trechos) ou (None, None).
    """
    try:
        import win32com.client
        import time as _time
    except ImportError:
        _log("win32com nao disponivel", "WARN")
        return None, None

    _log("Camada 3: COM automation (Civil 3D background)")
    acad = None
    doc = None
    try:
        # Copiar DWG para path ASCII (COM tem problemas com acentos)
        tmp_dir = _get_temp_dir()
        stem = _stem_ascii(Path(dwg_path).stem)
        tmp_dwg_com = str(Path(tmp_dir) / f"{stem}_com.dwg")
        if not os.path.exists(tmp_dwg_com):
            shutil.copy2(dwg_path, tmp_dwg_com)

        acad = win32com.client.Dispatch("AutoCAD.Application")
        acad.Visible = False
        _log(f"  {acad.Name} aberto (Visible=False)")

        acad.Documents.Open(tmp_dwg_com, False, True)
        _time.sleep(3)  # Esperar DWG carregar
        doc = acad.ActiveDocument
        msp = doc.ModelSpace
        total = msp.Count
        _log(f"  DWG: {doc.Name} | {total} entidades")

        pvs = {}
        trechos = []
        pipe_count = 0
        struct_count = 0

        # Contagem por tipo para debug
        type_counts = {}
        
        for i in range(total):
            try:
                obj = msp.Item(i)
                typename = str(obj.ObjectName)
                type_counts[typename] = type_counts.get(typename, 0) + 1
            except Exception:
                continue

            # ── AeccDbStructure (PVs) — nome exato ──
            if typename == "AeccDbStructure":
                struct_count += 1
                try:
                    nome = obj.Name
                    ct = obj.RimElevation
                    cf = obj.SumpElevation
                    prof = round(ct - cf, 3) if ct and cf else 0

                    # Coordenadas via Position COM object
                    x = y = 0
                    try:
                        pos = obj.Position
                        x = pos.X if hasattr(pos, 'X') else 0
                        y = pos.Y if hasattr(pos, 'Y') else 0
                    except Exception:
                        try:
                            loc = obj.Location
                            x = loc.X if hasattr(loc, 'X') else 0
                            y = loc.Y if hasattr(loc, 'Y') else 0
                        except Exception:
                            pass
                    if x == 0 and y == 0:
                        try: x = obj.Easting
                        except: pass
                        try: y = obj.Northing
                        except: pass

                    part = ""
                    try: part = obj.PartSizeName
                    except: pass

                    pvs[nome] = {
                        "x": round(x, 3), "y": round(y, 3),
                        "ct": round(ct, 4), "cf": round(cf, 4),
                        "prof": prof, "tipo": part,
                    }
                except Exception as e:
                    _log(f"  Structure erro: {e}", "WARN")

            # ── AeccDbPipe (Tubos esgoto/agua) — nome exato ──
            # Extrair TODOS os tubos (gravidade + pressao)
            elif typename == "AeccDbPipe":
                pipe_count += 1
                try:
                    nome = obj.Name
                    dn = obj.InnerDiameterOrWidth * 1000  # m -> mm
                    slope = obj.Slope

                    # Determinar tipo de rede pelo DN e slope
                    # Esgoto (gravidade): DN >= 200mm, slope > 0
                    # Agua (pressao): DN < 200mm ou slope = 0
                    tipo_rede = "esgoto" if dn >= 200 and slope > 0 else "agua"
                    
                    # Verificar se tem estruturas conectadas
                    pv_ini = pv_fim = ""
                    try:
                        if obj.StartStructure:
                            pv_ini = obj.StartStructure.Name
                    except: pass
                    try:
                        if obj.EndStructure:
                            pv_fim = obj.EndStructure.Name
                    except: pass
                    
                    # Se nao tem estruturas, ignorar
                    if not pv_ini or not pv_fim:
                        continue

                    ext = 0
                    for ext_prop in ["Length2DCenterToCenter", "Length2D", "Length"]:
                        try:
                            ext = getattr(obj, ext_prop)
                            break
                        except Exception:
                            continue

                    part = ""
                    try: part = obj.PartSizeName
                    except: pass

                    trechos.append({
                        "pv_ini": pv_ini,
                        "pv_fim": pv_fim,
                        "dn_mm": int(round(dn)),
                        "ext_m": round(ext, 2),
                        "material": part or "PVC",
                        "decl_mm": round(slope * 1000, 3) if slope else 0,
                        "tipo_rede": tipo_rede,  # "esgoto" ou "agua"
                    })
                except Exception as e:
                    _log(f"  Pipe erro: {e}", "WARN")

        # ── Normalizar dados para formato pipeline ──
        for nome, pv in pvs.items():
            pv.setdefault("tipo", "esgoto")
            pv.setdefault("prof", round(pv.get("ct", 0) - pv.get("cf", 0), 3)
                          if pv.get("ct") and pv.get("cf") else 0)
            # Normalizar material do PV
            part = pv.get("tipo_part", pv.get("tipo", ""))
            if "CONCRETO" in str(part).upper():
                pv["material_pv"] = "CONCRETO"
            elif "PEAD" in str(part).upper() or "PE " in str(part).upper():
                pv["material_pv"] = "PEAD"
            else:
                pv["material_pv"] = "CONCRETO"

        # Normalizar trechos
        trechos_ok = []
        for t in trechos:
            # Filtrar trechos sem PV de inicio ou fim
            if not t.get("pv_ini") or not t.get("pv_fim"):
                continue
            # Normalizar material: "150 mm TUBO DE FERRO" → "FERRO"
            mat_raw = str(t.get("material", "PVC")).upper()
            if "PVC" in mat_raw:
                t["material"] = "PVC"
            elif "FERRO" in mat_raw or "FoFo" in mat_raw.lower():
                t["material"] = "FF"
            elif "PEAD" in mat_raw or "PE " in mat_raw:
                t["material"] = "PEAD"
            elif "CONCRETO" in mat_raw:
                t["material"] = "CONCRETO"
            else:
                t["material"] = "PVC"
            t.setdefault("tipo", "esgoto")
            # Calcular ext_m se veio zero (distancia entre PVs)
            if not t.get("ext_m") and t["pv_ini"] in pvs and t["pv_fim"] in pvs:
                pa, pb = pvs[t["pv_ini"]], pvs[t["pv_fim"]]
                if pa.get("x") and pb.get("x"):
                    t["ext_m"] = round(math.hypot(
                        pa["x"] - pb["x"], pa["y"] - pb["y"]), 2)
            trechos_ok.append(t)
        trechos = trechos_ok

        n_ct = sum(1 for p in pvs.values() if p.get("ct", 0) != 0)
        if pvs:
            top_types = dict(list(sorted(type_counts.items(), key=lambda x: -x[1]))[:10])
            _log(f"  Type counts (top 10): {top_types}", "INFO")
            _log(f"  Iterados: {struct_count} Structures, {pipe_count} Pipes", "INFO")
            _log(f"Camada 3 OK: {len(pvs)} PVs ({n_ct} com CT), "
                 f"{len(trechos)} trechos", "OK")
        else:
            _log("Camada 3: nenhum PV via COM", "WARN")

        return pvs if pvs else None, trechos if trechos else None

    except Exception as e:
        _log(f"COM indisponível ou Civil 3D fechado: {e}", "INFO")
        return None, None
    finally:
        try:
            if doc:
                doc.Close(False)
        except Exception:
            pass
        try:
            if acad:
                try: acad.Application.Quit()
                except Exception:
                    try: acad.Quit()
                    except Exception: pass
        except Exception:
            pass


# ═══════════════════════════════════════════════════════════════════════
# CONVERTER DWG -> DXF (legacy, para parser de texto)
# ═══════════════════════════════════════════════════════════════════════

def _converter_dwg_para_dxf(dwg_path):
    """Converte DWG -> DXF via accoreconsole (ja gerado pela camada 1)."""
    tmp_dir = _get_temp_dir()
    stem = _stem_ascii(Path(dwg_path).stem)
    tmp_dxf = str(Path(tmp_dir) / f"{stem}.dxf")

    # Se ja existe (gerado pela camada 1), retornar
    if os.path.exists(tmp_dxf) and os.path.getsize(tmp_dxf) > 100:
        _log(f"DXF ja existe: {os.path.getsize(tmp_dxf)/1024:.0f} KB")
        return tmp_dxf

    # Senao, converter via accoreconsole
    accore = _achar_accoreconsole()
    if not accore:
        return None

    tmp_dwg = str(Path(tmp_dir) / f"{stem}.dwg")
    if not os.path.exists(tmp_dwg):
        shutil.copy2(dwg_path, tmp_dwg)

    tmp_dxf_fwd = tmp_dxf.replace("\\", "/")
    scr_content = (
        f'(setvar "FILEDIA" 0)\r\n'
        f'(command "_SAVEAS" "DXF" "" "{tmp_dxf_fwd}")\r\n'
        f'(acad-quit)\r\n'
    )
    scr_file = tempfile.NamedTemporaryFile(
        suffix=".scr", mode="wb", delete=False, dir=tmp_dir
    )
    scr_file.write(scr_content.encode("ascii", errors="replace"))
    scr_file.close()

    try:
        subprocess.run(
            [accore, "/i", tmp_dwg, "/s", scr_file.name],
            capture_output=True, timeout=120
        )
    except subprocess.TimeoutExpired:
        pass
    finally:
        try:
            os.unlink(scr_file.name)
        except Exception:
            pass

    if os.path.exists(tmp_dxf) and os.path.getsize(tmp_dxf) > 100:
        _log(f"DWG -> DXF: {os.path.getsize(tmp_dxf)/1024:.0f} KB")
        return tmp_dxf
    return None


# ═══════════════════════════════════════════════════════════════════════
# RECONSTRUIR REDE (topologia por nomes)
# ═══════════════════════════════════════════════════════════════════════

def _reconstruir_rede(pvs, dn_padrao=200, max_ext=300):
    """
    Reconstroi topologia da rede pela sequencia dos nomes dos PVs.
    PV01->PV02->PV03 = tronco, PV01A->PV02A = ramal A.
    """
    trechos = []
    ramos = defaultdict(list)

    for nome in pvs:
        m = re.match(r'(PV|PI|PVEX)[-_]?(\d*)([A-Z]?)', nome.upper())
        if m:
            num_str = m.group(2)
            num = int(num_str) if num_str else 99
            suffix = m.group(3)
            ramos[suffix].append((num, nome))

    for suffix, pvs_list in sorted(ramos.items()):
        pvs_sorted = sorted(pvs_list, key=lambda x: x[0])
        for i in range(len(pvs_sorted) - 1):
            _, nome_a = pvs_sorted[i]
            _, nome_b = pvs_sorted[i + 1]
            if nome_a in pvs and nome_b in pvs:
                pa, pb = pvs[nome_a], pvs[nome_b]
                if pa.get("x") and pb.get("x"):
                    ext = math.hypot(pa["x"] - pb["x"], pa["y"] - pb["y"])
                    if ext < max_ext:
                        # Calcular declividade se temos cotas
                        decl = 0
                        ct_a = pa.get("ct", 0) or 0
                        cf_a = pa.get("cf", 0) or 0
                        ct_b = pb.get("ct", 0) or 0
                        cf_b = pb.get("cf", 0) or 0
                        if cf_a and cf_b and ext > 0:
                            decl = round(abs(cf_a - cf_b) / ext, 6)

                        trechos.append({
                            "pv_ini": nome_a,
                            "pv_fim": nome_b,
                            "dn_mm": dn_padrao,
                            "ext_m": round(ext, 1),
                            "material": "PVC",
                            "decl_mm": round(decl * 1000, 2),
                            "ramo": suffix or "TRONCO",
                        })

    # Conectar ramais ao tronco
    tronco_pvs = {num: nome for num, nome in ramos.get('', [])}
    for suffix in ['A', 'B', 'C', 'D', 'E', 'F']:
        if suffix in ramos and ramos[suffix]:
            first_num, first_name = sorted(ramos[suffix])[0]
            if first_num in tronco_pvs:
                tronco_name = tronco_pvs[first_num]
                if first_name in pvs and tronco_name in pvs:
                    pa, pb = pvs[first_name], pvs[tronco_name]
                    if pa.get("x") and pb.get("x"):
                        ext = math.hypot(pa["x"] - pb["x"], pa["y"] - pb["y"])
                        if ext < max_ext:
                            trechos.append({
                                "pv_ini": tronco_name,
                                "pv_fim": first_name,
                                "dn_mm": dn_padrao,
                                "ext_m": round(ext, 1),
                                "material": "PVC",
                                "decl_mm": 0,
                                "ramo": f"CONEXAO->{suffix}",
                            })

    return trechos


# ═══════════════════════════════════════════════════════════════════════
# MERGE: combinar resultados das camadas
# ═══════════════════════════════════════════════════════════════════════

def _merge_pvs(pvs_bim, pvs_texto):
    """Combina PVs de BIM com PVs de texto. BIM tem prioridade para cotas."""
    merged = {}

    # Primeiro, todos de texto
    for nome, pv in pvs_texto.items():
        merged[nome] = dict(pv)

    # Depois, sobrescrever/complementar com BIM
    for nome, pv in pvs_bim.items():
        if nome in merged:
            # BIM sobrescreve se tiver cotas
            if pv.get("ct") and pv["ct"] != 0:
                merged[nome]["ct"] = pv["ct"]
            if pv.get("cf") and pv["cf"] != 0:
                merged[nome]["cf"] = pv["cf"]
            if pv.get("prof") and pv["prof"] != 0:
                merged[nome]["prof"] = pv["prof"]
            # Coordenadas do BIM se texto nao tem
            if not merged[nome].get("x") and pv.get("x"):
                merged[nome]["x"] = pv["x"]
                merged[nome]["y"] = pv["y"]
        else:
            merged[nome] = dict(pv)

    return merged


def _merge_trechos(trechos_bim, trechos_topo):
    """Combina trechos BIM com trechos por topologia. BIM tem prioridade."""
    if trechos_bim:
        # BIM tem topologia real — usar como base
        seen = set()
        for t in trechos_bim:
            seen.add((t["pv_ini"], t["pv_fim"]))
        # Adicionar trechos da topologia que BIM nao tem
        for t in trechos_topo:
            if (t["pv_ini"], t["pv_fim"]) not in seen and (t["pv_fim"], t["pv_ini"]) not in seen:
                trechos_bim.append(t)
        return trechos_bim
    return trechos_topo


# ═══════════════════════════════════════════════════════════════════════
# FUNCAO PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════

def ler_dwg_aec(path, dn_padrao=200):
    """
    Le Pipe Network de DWG Civil 3D usando 4 camadas com prioridade:
    LandXML -> LISP -> COM -> DXF.

    Args:
        path: caminho do .dwg ou .dxf
        dn_padrao: DN padrao quando nao detectado (mm)

    Returns:
        pvs: dict nome -> {x, y, ct, cf, prof}
        trechos: list of {pv_ini, pv_fim, dn_mm, ext_m, material, decl_mm}
        meta: dict com metadados
    """
    path = str(path)
    _log(f">>> Lendo {Path(path).name}")
    _log("=" * 60)

    pvs_final = {}
    trechos_final = []
    motor = "desconhecido"

    # ══════════════════════════════════════════════════════════
    # CAMADA 1: LandXML / LISP via accoreconsole (Headless)
    # Metodo BRUTAL: Rapido, silencioso e nao requer Civil 3D aberto.
    # ══════════════════════════════════════════════════════════

    _log("Camada 1: LandXML / LISP via accoreconsole")
    pvs_xml, trechos_xml, ruas_xml, meta_xml = _extrair_via_landxml(path)
    if pvs_xml:
        pvs_final = pvs_xml
        trechos_final = trechos_xml or []
        motor = "LandXML_AEC"
        _log(f"Camada 1 OK (LandXML): {len(pvs_final)} PVs", "OK")
    else:
        # Tenta LISP
        pvs_lisp, trechos_lisp, textos_lisp = _extrair_via_lisp(path)
        if pvs_lisp:
            pvs_final = pvs_lisp
            trechos_final = trechos_lisp or []
            motor = "LISP_AEC"
            _log(f"Camada 1 OK (LISP): {len(pvs_final)} PVs", "OK")

    # ══════════════════════════════════════════════════════════
    # CAMADA 2 (FALLBACK 1): LandXML via accoreconsole
    # Se COM falhou, tenta exportar LandXML (so funciona no Civil 3D completo)
    # ══════════════════════════════════════════════════════════

    # ══════════════════════════════════════════════════════════
    # CAMADA 2: COM Automation (Fundo/Precisão)
    # Metodo de precisao: se Camada 1 falhou ou esta incompleta.
    # ══════════════════════════════════════════════════════════
    if not pvs_final or any(p.get("ct", 0) == 0 for p in pvs_final.values()):
        _log("Camada 2: COM Automation (Fundo/Precisão)...", "INFO")
        pvs_com, trechos_com = _extrair_via_com(path)
        if pvs_com:
            pvs_final = _merge_pvs(pvs_final, pvs_com)
            if not trechos_final:
                trechos_final = trechos_com or []
            motor = "COM_BIM_AEC"
            _log(f"Camada 2 OK (COM): {len(pvs_com)} PVs", "OK")

    # ══════════════════════════════════════════════════════════
    # CAMADA 3 (FALLBACK 2): DXF text parser
    # Se COM falhou ou nao esta disponivel.
    # ══════════════════════════════════════════════════════════

    if not pvs_final or all(p.get("ct", 0) == 0 for p in pvs_final.values()):
        _log("Camada 3: Parser de DXF (fallback 2)")

        dxf_path = None
        if path.lower().endswith('.dxf'):
            dxf_path = path
        elif path.lower().endswith('.dwg'):
            dxf_path = _converter_dwg_para_dxf(path)

        if dxf_path and os.path.exists(dxf_path):
            pvs_dxf = _extrair_pvs_de_dxf(dxf_path)
            if pvs_dxf:
                pvs_final = _merge_pvs(pvs_final, pvs_dxf)
                if motor == "desconhecido":
                    motor = "DXF_texto"
                _log(f"DXF texto: {len(pvs_dxf)} PVs", "OK")

    # ══════════════════════════════════════════════════════════
    # POS-PROCESSAMENTO
    # ══════════════════════════════════════════════════════════

    if not pvs_final:
        _log("NENHUM PV encontrado em nenhuma camada", "ERR")
        return {}, [], {"motor": motor, "status": "sem_dados"}

    # Se nao temos trechos do BIM, reconstruir por topologia
    if not trechos_final:
        _log("Reconstruindo topologia por nomes dos PVs...")
        trechos_final = _reconstruir_rede(pvs_final, dn_padrao)

    # Mapear CTF -> CF quando CT/CF zerados
    for nome, pv in pvs_final.items():
        ctf = pv.get("ctf")
        if ctf is not None and pv.get("cf", 0) == 0:
            pv["cf"] = ctf
            _log(f"  {nome}: CTF={ctf} mapeado como CF (relativo)", "INFO")

    # Calcular declividade nos trechos reconstruidos se temos cotas
    for t in trechos_final:
        if t.get("decl_mm", 0) == 0:
            pv_a = pvs_final.get(t["pv_ini"], {})
            pv_b = pvs_final.get(t["pv_fim"], {})
            cf_a = pv_a.get("cf", 0) or 0
            cf_b = pv_b.get("cf", 0) or 0
            ext = t.get("ext_m", 0) or 0
            if cf_a and cf_b and ext > 0:
                t["decl_mm"] = round(abs(cf_a - cf_b) / ext * 1000, 2)

    # Estatisticas
    ext_total = sum(t.get("ext_m", 0) for t in trechos_final)
    n_com_ct = sum(1 for p in pvs_final.values() if p.get("ct", 0) != 0)
    n_com_cf = sum(1 for p in pvs_final.values() if p.get("cf", 0) != 0)

    _log("=" * 60)
    _log(f"RESULTADO FINAL: {len(pvs_final)} PVs | {len(trechos_final)} trechos | {ext_total:.0f}m", "OK")
    _log(f"  CT preenchido: {n_com_ct}/{len(pvs_final)}")
    _log(f"  CF preenchido: {n_com_cf}/{len(pvs_final)}")
    _log(f"  Motor: {motor}")

    meta = {
        "motor": motor,
        "arquivo": Path(path).name,
        "n_pvs": len(pvs_final),
        "n_trechos": len(trechos_final),
        "extensao_m": round(ext_total, 1),
        "dn_padrao": dn_padrao,
        "n_com_ct": n_com_ct,
        "n_com_cf": n_com_cf,
        "obs": f"Pipe Network extraida via {motor}. "
               f"{n_com_ct}/{len(pvs_final)} PVs com CT, "
               f"{n_com_cf}/{len(pvs_final)} PVs com CF.",
    }

    return pvs_final, trechos_final, meta


# ═══════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("USO: python ler_dwg_aec.py <arquivo.dwg|dxf>")
        print("     Le Pipe Networks de DWG Civil 3D (3 camadas com fallback)")
        sys.exit(1)

    pvs, trechos, meta = ler_dwg_aec(sys.argv[1])

    print(f"\nMeta: {json.dumps(meta, indent=2, ensure_ascii=False)}")

    print(f"\nPVs ({len(pvs)}):")
    for nome, pv in sorted(pvs.items()):
        ct = pv.get('ct', 0)
        cf = pv.get('cf', 0)
        ctf = pv.get('ctf', '')
        print(f"  {nome:12s} | E={pv['x']:.0f} N={pv['y']:.0f} | CT={ct:.3f} CF={cf:.3f} | CTF={ctf}")

    print(f"\nTrechos ({len(trechos)}):")
    for t in trechos:
        print(f"  {t['pv_ini']:10s} -> {t['pv_fim']:10s} | {t['ext_m']:>7.1f}m | DN{t['dn_mm']} | I={t.get('decl_mm',0):.2f}mm/m")

    # Salvar JSON
    output = Path(sys.argv[1]).with_suffix('.json')
    resultado = {
        "arquivo": Path(sys.argv[1]).name,
        "pvs": pvs,
        "trechos": trechos,
        "meta": meta,
    }
    with open(output, "w", encoding="utf-8") as f:
        json.dump(resultado, f, indent=2, ensure_ascii=False)
    print(f"\nJSON salvo: {output}")
