#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ler_landxml.py — Leitor de LandXML exportado do Civil 3D
Retorna (pvs, trechos, ruas, meta) no mesmo formato do ler_dxf_gdal.py

Uso:
  pvs, trechos, ruas, meta = ler_landxml("REDE.xml")
  # Mesmo formato → funciona com gerar_ns.py, gerar_civil3d.py etc.
"""
import xml.etree.ElementTree as ET
import math, re
from pathlib import Path
from datetime import datetime
from collections import Counter


def ler_landxml(xml_path):
    """Lê LandXML 1.2 e retorna (pvs, trechos, ruas, meta)."""
    tree = ET.parse(xml_path)
    root = tree.getroot()

    # Detectar namespace automaticamente
    ns_uri = ""
    tag = root.tag
    if "{" in tag:
        ns_uri = tag.split("}")[0] + "}"

    def tag_ns(t):
        return f"{ns_uri}{t}"

    def find_all(parent, tag):
        return parent.iter(tag_ns(tag))

    def find(parent, tag):
        return parent.find(f".//{tag_ns(tag)}")

    # ── Structures (PVs) ──
    pvs = {}
    for s in find_all(root, "Struct"):
        nome = s.get("name", "")
        if not nome:
            continue
        ct = float(s.get("elevRim") or s.get("rimElev") or 0)
        cf = float(s.get("elevSump") or s.get("sumpElev") or 0)
        prof = round(abs(ct - cf), 4) if ct and cf else 0

        x, y = 0.0, 0.0
        center = find(s, "Center")
        if center is not None and center.text:
            parts = center.text.strip().split()
            if len(parts) >= 2:
                y = float(parts[0])  # northing
                x = float(parts[1])  # easting

        pvs[nome] = {
            "x": x, "y": y,
            "ct": round(ct, 4), "cf": round(cf, 4),
            "prof": round(abs(prof), 4),
        }

    # ── Pipes (Tubos) ──
    trechos = []
    for p in find_all(root, "Pipe"):
        pv_ini = p.get("refStart", "")
        pv_fim = p.get("refEnd", "")
        if not pv_ini or not pv_fim:
            continue
        if pv_ini not in pvs or pv_fim not in pvs:
            continue

        ext = float(p.get("length") or 0)
        slope = float(p.get("slope") or 0)

        # DN do CircPipe
        circ = find(p, "CircPipe")
        dn_mm = 0
        material = "PVC"
        if circ is not None:
            diam_m = float(circ.get("diameter") or 0)
            dn_mm = int(round(diam_m * 1000))
            material = circ.get("material") or "PVC"

        # DN do desc
        desc = p.get("desc", "")
        if dn_mm == 0 and desc:
            m = re.search(r"DN\s*(\d+)", desc, re.IGNORECASE)
            if m:
                dn_mm = int(m.group(1))

        # Extensão: recalcular se zero
        pvi_d = pvs.get(pv_ini, {})
        pvf_d = pvs.get(pv_fim, {})
        if ext < 0.01 and pvi_d.get("x") and pvf_d.get("x"):
            ext = round(math.hypot(pvf_d["x"]-pvi_d["x"], pvf_d["y"]-pvi_d["y"]), 2)

        cf_ini = pvi_d.get("cf", 0) or 0
        cf_fim = pvf_d.get("cf", 0) or 0

        if slope:
            decl_mm = abs(slope)
        elif cf_ini and cf_fim and ext > 0:
            decl_mm = abs(cf_ini - cf_fim) / ext
        else:
            decl_mm = None

        # Rua (Feature/Property)
        rua = ""
        for prop in p.iter(tag_ns("Property")):
            if (prop.get("label") or "").upper() in ("RUA", "STREET", "ROAD"):
                rua = prop.get("value", "")

        trechos.append({
            "pv_ini": pv_ini, "pv_fim": pv_fim,
            "dn_mm": dn_mm if dn_mm > 0 else None,
            "ext_m": round(ext, 2),
            "decl_mm": round(decl_mm, 6) if decl_mm else None,
            "decl_pct": round(decl_mm * 100, 3) if decl_mm else None,
            "material": material,
            "rua": rua or "Sem Rua",
            "layer": "PipeNetwork",
            "is_agua": False,
            "ct_ini": pvi_d.get("ct"), "ct_fim": pvf_d.get("ct"),
            "cf_ini": cf_ini or None, "cf_fim": cf_fim or None,
            "prof_ini": pvi_d.get("prof"), "prof_fim": pvf_d.get("prof"),
        })

    # Dedup bidirecional
    por_par = {}
    for t in trechos:
        par = tuple(sorted([t["pv_ini"], t["pv_fim"]]))
        if par not in por_par or (t.get("dn_mm") or 0) > (por_par[par].get("dn_mm") or 0):
            por_par[par] = t
    trechos = list(por_par.values())

    ext_total = sum(t["ext_m"] for t in trechos)
    dns = Counter(t["dn_mm"] for t in trechos if t.get("dn_mm"))
    print(f"LandXML: {len(pvs)} PVs | {len(trechos)} trechos | {ext_total:.1f}m | DNs: {dict(dns)}")

    meta = {
        "arquivo": Path(xml_path).name,
        "tipo_rede": "ESGOTO",
        "n_pvs": len(pvs),
        "n_trechos": len(trechos),
        "motor": "LandXML/Civil3D",
    }
    return pvs, trechos, [], meta


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Uso: python ler_landxml.py <arquivo.xml>")
        sys.exit(1)
    pvs, trechos, ruas, meta = ler_landxml(sys.argv[1])
