#!/usr/bin/env python3
"""
Leitor semantico de DWG Civil 3D.

Abre o DWG em uma instancia oculta do Civil 3D, usa o exporter .NET e
converte a saida JSON/CSV para o formato pvs/trechos da plataforma atual.
"""

from __future__ import annotations

import json
import math
import re
import shutil
import tempfile
import unicodedata
from collections import Counter
from datetime import datetime
from pathlib import Path

from exportar_pipe_network_oculto import (
    export_pipe_network_hidden,
    resolve_dll_path,
    resolve_prog_id,
)


def _log(msg, level="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[DWG-SEM] [{level:4s}] [{ts}] {msg}")


def _stem_ascii(value: str, max_len: int = 48) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = "".join(ch for ch in normalized if ord(ch) < 128)
    ascii_only = re.sub(r"[^\w]+", "_", ascii_only).strip("_")
    return (ascii_only or "dwg_semantico")[:max_len]


def _tmp_copy_path(src: Path) -> Path:
    root = Path(tempfile.gettempdir()) / "construdata_dwg_semantico"
    root.mkdir(parents=True, exist_ok=True)
    stem = _stem_ascii(src.stem)
    return root / f"{stem}.dwg"


def _detect_is_agua(*values) -> bool:
    text = " ".join(str(v or "") for v in values).upper()
    return any(token in text for token in ("AGUA", "ÁGUA", "WATER", "ADUTORA", "AAB", "AAT"))


def _normalize_material(value: str | None) -> str:
    raw = (value or "").upper()
    if "PVC" in raw:
        return "PVC"
    if "FERRO" in raw or "FF" in raw:
        return "FF"
    if "PEAD" in raw or "PEHD" in raw:
        return "PEAD"
    if "CONCRETO" in raw:
        return "CONCRETO"
    return value or "PVC"


def _safe_float(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _distance(a: dict, b: dict) -> float:
    return math.hypot((b.get("x") or 0) - (a.get("x") or 0), (b.get("y") or 0) - (a.get("y") or 0))


def _make_unique_name(base_name: str, used_names: set[str]) -> str:
    name = base_name
    idx = 2
    while name in used_names:
        name = f"{base_name} #{idx}"
        idx += 1
    used_names.add(name)
    return name


def _build_pvs_and_mapping(document: dict) -> tuple[dict, dict, dict]:
    pvs = {}
    handle_to_name = {}
    network_name_to_pv = {}
    used_names = set()

    for network in document.get("networks", []):
        network_name = network.get("name") or "REDE"
        for structure in network.get("structures", []):
            base_name = structure.get("name") or structure.get("handle") or "PV"
            pv_name = base_name
            if pv_name in used_names:
                pv_name = _make_unique_name(f"{base_name} [{network_name}]", used_names)
            else:
                used_names.add(pv_name)

            loc = structure.get("location") or {}
            ct = _safe_float(structure.get("rimElevation"))
            cf = _safe_float(structure.get("sumpElevation"))
            prof = _safe_float(structure.get("sumpDepth"))
            if prof is None and ct is not None and cf is not None:
                prof = round(abs(ct - cf), 4)

            pvs[pv_name] = {
                "x": _safe_float(loc.get("x")) or 0.0,
                "y": _safe_float(loc.get("y")) or 0.0,
                "ct": round(ct, 4) if ct is not None else None,
                "cf": round(cf, 4) if cf is not None else None,
                "prof": round(prof, 4) if prof is not None else None,
                "rede": network_name,
                "material_pv": structure.get("material") or structure.get("partDescription"),
                "tipo_pv": structure.get("structureType"),
                "handle": structure.get("handle"),
            }
            handle = structure.get("handle")
            if handle:
                handle_to_name[handle] = pv_name
            raw_name = structure.get("name")
            if raw_name:
                network_name_to_pv[(network_name, raw_name)] = pv_name

    return pvs, handle_to_name, network_name_to_pv


def _ensure_virtual_pv(pvs: dict, used_names: set[str], network_name: str, pipe: dict, point_key: str, suffix: str) -> str | None:
    point = pipe.get(point_key) or {}
    x = _safe_float(point.get("x"))
    y = _safe_float(point.get("y"))
    if x is None or y is None:
        return None

    z = _safe_float(point.get("z"))
    pipe_id = pipe.get("name") or pipe.get("handle") or "PIPE"
    base_name = f"AUTO_{_stem_ascii(network_name, 16)}_{_stem_ascii(str(pipe_id), 20)}_{suffix}"
    pv_name = _make_unique_name(base_name, used_names)
    pvs[pv_name] = {
        "x": x,
        "y": y,
        "ct": None,
        "cf": round(z, 4) if z is not None else None,
        "prof": None,
        "rede": network_name,
        "material_pv": None,
        "tipo_pv": "AUTO_PIPE_ENDPOINT",
        "handle": None,
        "sintetico": True,
    }
    return pv_name


def _build_trechos(document: dict, pvs: dict, handle_to_name: dict, network_name_to_pv: dict) -> list[dict]:
    trechos = []
    seen = set()
    used_names = set(pvs)

    for network in document.get("networks", []):
        network_name = network.get("name") or "REDE"
        rua = network.get("referenceAlignmentName") or network_name or "Sem Rua"
        is_agua = _detect_is_agua(
            network_name,
            network.get("description"),
            network.get("partsListName"),
            rua,
        )

        for pipe in network.get("pipes", []):
            pv_ini = handle_to_name.get(pipe.get("startStructureHandle"))
            pv_fim = handle_to_name.get(pipe.get("endStructureHandle"))
            if not pv_ini and pipe.get("startStructureName"):
                pv_ini = network_name_to_pv.get((network_name, pipe.get("startStructureName")))
            if not pv_fim and pipe.get("endStructureName"):
                pv_fim = network_name_to_pv.get((network_name, pipe.get("endStructureName")))
            if not pv_ini:
                pv_ini = _ensure_virtual_pv(pvs, used_names, network_name, pipe, "startPoint", "INI")
            if not pv_fim:
                pv_fim = _ensure_virtual_pv(pvs, used_names, network_name, pipe, "endPoint", "FIM")
            if not pv_ini or not pv_fim or pv_ini == pv_fim:
                continue

            pair = tuple(sorted((pv_ini, pv_fim)))
            handle = pipe.get("handle") or pipe.get("name") or pair
            if (pair, handle) in seen:
                continue
            seen.add((pair, handle))

            ext = _safe_float(pipe.get("length2D")) or _safe_float(pipe.get("length2DCenterToCenter")) or 0.0
            if ext <= 0 and pv_ini in pvs and pv_fim in pvs:
                ext = round(_distance(pvs[pv_ini], pvs[pv_fim]), 2)

            decl = _safe_float(pipe.get("slope"))
            if decl is None and ext > 0:
                z0 = _safe_float((pipe.get("startPoint") or {}).get("z"))
                z1 = _safe_float((pipe.get("endPoint") or {}).get("z"))
                if z0 is not None and z1 is not None:
                    decl = abs(z0 - z1) / ext

            dn = _safe_float(pipe.get("innerDiameterOrWidth"))
            dn_mm = int(round(dn * 1000)) if dn else None

            material = _normalize_material(pipe.get("material") or pipe.get("partDescription"))
            pvi = pvs.get(pv_ini, {})
            pvf = pvs.get(pv_fim, {})

            trechos.append({
                "pv_ini": pv_ini,
                "pv_fim": pv_fim,
                "dn_mm": dn_mm,
                "ext_m": round(ext, 2),
                "decl_mm": round(decl, 6) if decl is not None else None,
                "decl_pct": round(decl * 100, 3) if decl is not None else None,
                "material": material,
                "rua": rua or "Sem Rua",
                "layer": network_name,
                "is_agua": is_agua or _detect_is_agua(pipe.get("description"), pipe.get("partDescription")),
                "ct_ini": pvi.get("ct"),
                "ct_fim": pvf.get("ct"),
                "cf_ini": pvi.get("cf"),
                "cf_fim": pvf.get("cf"),
                "prof_ini": pvi.get("prof"),
                "prof_fim": pvf.get("prof"),
                "handle": pipe.get("handle"),
                "rede": network_name,
            })

    return trechos


def _build_meta(document: dict, dwg_path: Path, export_info: dict, trechos: list[dict]) -> dict:
    ext_total = sum(t.get("ext_m", 0) or 0 for t in trechos)
    dns = Counter(t.get("dn_mm") for t in trechos if t.get("dn_mm"))
    n_pvs_exportados = sum(len(network.get("structures", [])) for network in document.get("networks", []))
    n_pvs_sinteticos = sum(1 for pv in export_info["pvs"].values() if pv.get("sintetico"))
    return {
        "arquivo": dwg_path.name,
        "n_pvs": len(export_info["pvs"]),
        "n_pvs_exportados": n_pvs_exportados,
        "n_pvs_sinteticos": n_pvs_sinteticos,
        "n_trechos": len(trechos),
        "n_redes": len(document.get("networks", [])),
        "ext_total_m": round(ext_total, 1),
        "is_agua": any(t.get("is_agua") for t in trechos),
        "motor": "DWG_Civil3D_Semantico",
        "dns": dict(sorted(dns.items())),
        "export_json": export_info.get("json"),
        "export_networks_csv": export_info.get("networks_csv"),
        "export_pipes_csv": export_info.get("pipes_csv"),
        "export_structures_csv": export_info.get("structures_csv"),
        "prog_id": export_info.get("prog_id"),
        "dll": export_info.get("dll"),
    }


def ler_dwg_semantico(
    dwg_path: str,
    out_dir: str | None = None,
    timeout_seconds: int = 300,
    load_timeout_seconds: int = 150,
) -> tuple[dict, list, list, dict]:
    src = Path(dwg_path).expanduser().resolve()
    if not src.exists():
        raise FileNotFoundError(f"DWG nao encontrado: {src}")

    tmp_copy = _tmp_copy_path(src)
    shutil.copy2(src, tmp_copy)
    _log(f"Copia temporaria criada: {tmp_copy}")

    export_root = Path(out_dir).expanduser().resolve() if out_dir else src.parent / "_construdata_exports_semantico"
    export_root.mkdir(parents=True, exist_ok=True)

    export_info = export_pipe_network_hidden(
        dwg_path=tmp_copy,
        dll_path=resolve_dll_path(None),
        prog_id=resolve_prog_id(None),
        timeout_seconds=timeout_seconds,
        load_timeout_seconds=load_timeout_seconds,
        visible=False,
        keep_open=False,
    )

    exported_files = [
        Path(export_info["json"]),
        Path(export_info["networks_csv"]),
        Path(export_info["pipes_csv"]),
        Path(export_info["structures_csv"]),
    ]
    moved = {}
    for src_file in exported_files:
        dst_file = export_root / src_file.name.replace(tmp_copy.stem, _stem_ascii(src.stem))
        shutil.copy2(src_file, dst_file)
        moved[src_file.name] = str(dst_file)

    with Path(export_info["json"]).open("r", encoding="utf-8-sig") as stream:
        document = json.load(stream)

    pvs, handle_to_name, network_name_to_pv = _build_pvs_and_mapping(document)
    trechos = _build_trechos(document, pvs, handle_to_name, network_name_to_pv)
    meta = _build_meta(
        document,
        src,
        {
            **export_info,
            "json": moved.get(Path(export_info["json"]).name, export_info["json"]),
            "networks_csv": moved.get(Path(export_info["networks_csv"]).name, export_info["networks_csv"]),
            "pipes_csv": moved.get(Path(export_info["pipes_csv"]).name, export_info["pipes_csv"]),
            "structures_csv": moved.get(Path(export_info["structures_csv"]).name, export_info["structures_csv"]),
            "pvs": pvs,
        },
        trechos,
    )

    _log(
        f"DWG semantico: {len(pvs)} PVs, {len(trechos)} trechos, "
        f"{meta['n_redes']} redes, {meta['ext_total_m']:.1f}m",
        "OK",
    )
    return pvs, trechos, [], meta


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Uso: python scripts/ler_dwg_semantico.py <arquivo.dwg> [saida]")
        raise SystemExit(1)

    out = sys.argv[2] if len(sys.argv) > 2 else None
    pvs, trechos, ruas, meta = ler_dwg_semantico(sys.argv[1], out_dir=out)
    print(json.dumps({
        "pvs": len(pvs),
        "trechos": len(trechos),
        "meta": meta,
    }, indent=2, ensure_ascii=False))
