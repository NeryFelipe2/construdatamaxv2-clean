#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ler_landxml.py — Leitor de LandXML exportado do Civil 3D
ConstruData SABESP v6

Retorna (pvs, trechos, ruas, meta) no mesmo formato do ler_dxf_gdal.py.

Uso:
  pvs, trechos, ruas, meta = ler_landxml("REDE.xml")
  # Mesmo formato → funciona com gerar_ns.py, gerar_civil3d.py etc.

Fluxo:
  1. Civil 3D exporta Pipe Network como LandXML 1.2
  2. Este script lê Structs (PVs) e Pipes (tubos)
  3. Retorna no formato padrão ConstruData para gerar NS
"""
import xml.etree.ElementTree as ET
import math
import re
from pathlib import Path
from datetime import datetime
from collections import Counter


def ler_landxml(xml_path):
    """Lê LandXML 1.2 e retorna (pvs, trechos, ruas, meta).

    Detecta namespace automaticamente (Civil 3D pode exportar com ou sem).
    Dedup bidirecional incluído.
    """
    xml_path = str(xml_path)
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] >>> Lendo LandXML: {Path(xml_path).name}")

    tree = ET.parse(xml_path)
    root = tree.getroot()

    # Detectar namespace automaticamente
    ns_uri = ""
    tag = root.tag
    if "{" in tag:
        ns_uri = tag.split("}")[0] + "}"

    def tag_ns(t):
        return f"{ns_uri}{t}"

    def find_all(parent, t):
        return parent.iter(tag_ns(t))

    def find(parent, t):
        return parent.find(f".//{tag_ns(t)}")

    # ── Structures (PVs) ─────────────────────────────────────────────────
    pvs = {}
    for s in find_all(root, "Struct"):
        nome = s.get("name", "").strip()
        if not nome:
            continue

        ct = float(s.get("elevRim") or s.get("rimElev") or 0)
        cf = float(s.get("elevSump") or s.get("sumpElev") or 0)
        prof = round(abs(ct - cf), 4) if ct and cf else 0

        # Centro: LandXML usa "northing easting [elev]"
        x, y = 0.0, 0.0
        center = find(s, "Center")
        if center is not None and center.text:
            parts = center.text.strip().split()
            if len(parts) >= 2:
                y = float(parts[0])   # northing
                x = float(parts[1])   # easting

        # Fallback: Feature/Property
        if x == 0 and y == 0:
            for prop in s.iter(tag_ns("Property")):
                label = (prop.get("label") or "").upper()
                val = prop.get("value") or "0"
                if "EAST" in label or label == "X":
                    x = float(val)
                elif "NORTH" in label or label == "Y":
                    y = float(val)

        # Sanidade: CF > CT pode ser rede aérea (aviso, não rejeita)
        if ct and cf and cf > ct:
            print(f"[{ts}]   AVISO: {nome} CF({cf:.3f}) > CT({ct:.3f}) — verificar rede aérea")

        pvs[nome] = {
            "x": x, "y": y,
            "ct": round(ct, 4) if ct else None,
            "cf": round(cf, 4) if cf else None,
            "prof": prof,
        }

    print(f"[{ts}]   Structures: {len(pvs)}")

    # ── Pipes (Tubos) ────────────────────────────────────────────────────
    trechos = []
    for p in find_all(root, "Pipe"):
        pv_ini = (p.get("refStart") or "").strip()
        pv_fim = (p.get("refEnd") or "").strip()
        if not pv_ini or not pv_fim:
            continue
        if pv_ini == pv_fim:
            continue
        if pv_ini not in pvs or pv_fim not in pvs:
            continue

        ext = float(p.get("length") or 0)
        slope = float(p.get("slope") or 0)
        desc = p.get("desc") or ""

        # DN do CircPipe
        dn_mm = 0
        material = "PVC"
        circ = find(p, "CircPipe")
        if circ is not None:
            diam = float(circ.get("diameter") or 0)
            # Civil 3D pode exportar em metros ou mm
            if diam < 10:
                dn_mm = int(round(diam * 1000))
            else:
                dn_mm = int(round(diam))
            material = circ.get("material") or "PVC"

        # EggPipe (ovóide)
        if dn_mm == 0:
            egg = find(p, "EggPipe")
            if egg is not None:
                diam = float(egg.get("diameter") or egg.get("span") or 0)
                dn_mm = int(round(diam * 1000)) if diam < 10 else int(round(diam))

        # DN do desc se não achou na geometria
        if dn_mm == 0 and desc:
            m = re.search(r"DN\s*(\d+)", desc, re.IGNORECASE)
            if m:
                dn_mm = int(m.group(1))

        # Extensão: recalcular se zero
        pvi_d = pvs.get(pv_ini, {})
        pvf_d = pvs.get(pv_fim, {})
        if ext < 0.01 and pvi_d.get("x") and pvf_d.get("x"):
            ext = round(math.hypot(pvf_d["x"] - pvi_d["x"],
                                   pvf_d["y"] - pvi_d["y"]), 2)

        cf_ini = pvi_d.get("cf") or 0
        cf_fim = pvf_d.get("cf") or 0

        # Declividade
        if slope:
            decl_mm = abs(slope)
        elif cf_ini and cf_fim and ext > 0:
            decl_mm = abs(cf_ini - cf_fim) / ext
        else:
            decl_mm = None

        # Rua (Feature/Property)
        rua = ""
        for prop in p.iter(tag_ns("Property")):
            label = (prop.get("label") or "").upper()
            if label in ("RUA", "STREET", "ROAD", "LOGRADOURO"):
                rua = prop.get("value") or ""

        # Detectar água vs esgoto pelo desc
        is_agua = False
        if desc and any(k in desc.upper() for k in ("AGUA", "ÁGUA", "WATER", "AF")):
            is_agua = True

        trechos.append({
            "pv_ini": pv_ini,
            "pv_fim": pv_fim,
            "dn_mm": dn_mm if dn_mm > 0 else None,
            "ext_m": round(ext, 2),
            "decl_mm": round(decl_mm, 6) if decl_mm else None,
            "decl_pct": round(decl_mm * 100, 3) if decl_mm else None,
            "material": material,
            "rua": rua or "Sem Rua",
            "layer": "PipeNetwork",
            "is_agua": is_agua,
            "ct_ini": pvi_d.get("ct"),
            "ct_fim": pvf_d.get("ct"),
            "cf_ini": cf_ini if cf_ini else None,
            "cf_fim": cf_fim if cf_fim else None,
            "prof_ini": pvi_d.get("prof"),
            "prof_fim": pvf_d.get("prof"),
        })

    # Dedup bidirecional (A→B == B→A, manter o com mais info)
    por_par = {}
    for t in trechos:
        par = tuple(sorted([t["pv_ini"], t["pv_fim"]]))
        if par not in por_par or (t.get("dn_mm") or 0) > (por_par[par].get("dn_mm") or 0):
            por_par[par] = t
    trechos = list(por_par.values())

    # Detectar tipo de rede pelo PipeNetwork
    tipo_rede = "ESGOTO"
    net_el = find(root, "PipeNetwork")
    if net_el is not None:
        net_type = (net_el.get("pipeNetType") or "").lower()
        if net_type in ("storm", "water", "combined"):
            tipo_rede = "AGUA"

    ext_total = sum(t["ext_m"] for t in trechos)
    dns = Counter(t["dn_mm"] for t in trechos if t.get("dn_mm"))

    print(f"[{ts}]   Pipes: {len(trechos)}")
    print(f"[{ts}] [OK] LandXML: {len(pvs)} PVs, {len(trechos)} trechos, "
          f"{ext_total:.1f}m, DNs: {dict(dns)}")

    meta = {
        "arquivo": Path(xml_path).name,
        "tipo_rede": tipo_rede,
        "is_agua": tipo_rede == "AGUA",
        "n_pvs": len(pvs),
        "n_trechos": len(trechos),
        "ext_total_m": round(ext_total, 1),
        "motor": "LandXML/Civil3D",
    }

    return pvs, trechos, [], meta


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Uso: python ler_landxml.py <arquivo.xml>")
        print()
        print("Exportar do Civil 3D:")
        print("  1. Abrir DWG no Civil 3D")
        print("  2. Output > Export to LandXML")
        print("  3. Marcar Pipe Network > OK")
        print()
        print("Ou duplo-clique no EXPORTAR_PIPE_NETWORKS.bat")
        sys.exit(1)

    xml_path = sys.argv[1]
    if not Path(xml_path).exists():
        print(f"ERRO: Arquivo nao encontrado: {xml_path}")
        sys.exit(1)

    pvs, trechos, ruas, meta = ler_landxml(xml_path)

    print(f"\n{'='*50}")
    print(f"PVs:      {meta['n_pvs']}")
    print(f"Trechos:  {meta['n_trechos']}")
    print(f"Extensao: {meta['ext_total_m']:.1f}m")
    print(f"Tipo:     {meta['tipo_rede']}")
    print(f"Motor:    {meta['motor']}")

    if trechos:
        from collections import Counter
        dns = Counter(t["dn_mm"] for t in trechos if t.get("dn_mm"))
        print(f"DNs:      {dict(sorted(dns.items()))}")

        mats = Counter(t["material"] for t in trechos)
        print(f"Material: {dict(mats)}")

        n_ct = sum(1 for p in pvs.values() if p.get("ct"))
        n_cf = sum(1 for p in pvs.values() if p.get("cf"))
        print(f"PVs c/ CT: {n_ct}/{len(pvs)}")
        print(f"PVs c/ CF: {n_cf}/{len(pvs)}")
    print(f"{'='*50}")
