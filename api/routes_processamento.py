"""Rotas web para importar projeto e gerar NS no backend."""
from __future__ import annotations

import json
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from core.config import SAIDA_ROOT

router = APIRouter(tags=["processamento"])

JOBS_DIR = SAIDA_ROOT / "web_jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_SUFFIXES = {".json", ".xml", ".landxml", ".dxf", ".dwg"}
ARTEFACT_SUFFIXES = {".pdf", ".html", ".json", ".geojson", ".xlsx", ".ifc", ".csv", ".xml", ".scr"}


def _slugify(value: str) -> str:
    clean = "".join(ch if ch.isalnum() else "_" for ch in (value or "").strip())
    while "__" in clean:
        clean = clean.replace("__", "_")
    return clean.strip("_") or "REDE"


def _nucleo_final(nucleo: str, filename: str) -> str:
    if nucleo and nucleo.strip():
        return nucleo.strip()
    stem = Path(filename or "REDE").stem
    return stem.replace("_", " ").strip() or "REDE"


def _save_upload(upload: UploadFile, target: Path) -> None:
    with target.open("wb") as buffer:
        shutil.copyfileobj(upload.file, buffer)


def _extract_network_from_json(data: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if isinstance(data.get("pvs"), dict) and isinstance(data.get("trechos"), list):
        return data["pvs"], data["trechos"]

    if isinstance(data.get("trecho"), dict):
        trecho = dict(data["trecho"])
        pv_montante = dict(data.get("pv_montante") or {})
        pv_jusante = dict(data.get("pv_jusante") or {})
        pv_ini = str(trecho.get("pv_ini") or data.get("pv_ini") or pv_montante.get("nome") or "PV_INI")
        pv_fim = str(trecho.get("pv_fim") or data.get("pv_fim") or pv_jusante.get("nome") or "PV_FIM")
        trecho["pv_ini"] = pv_ini
        trecho["pv_fim"] = pv_fim
        return {
            pv_ini: {"nome": pv_ini, **pv_montante},
            pv_fim: {"nome": pv_fim, **pv_jusante},
        }, [trecho]

    raise HTTPException(
        status_code=400,
        detail="JSON sem estrutura valida. Use pvs+trechos, DADOS.json de NS ou LandXML.",
    )


def _collect_artifacts(output_dir: Path) -> list[dict[str, str]]:
    files: list[dict[str, str]] = []
    if not output_dir.exists():
        return files
    for path in sorted(output_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in ARTEFACT_SUFFIXES:
            continue
        rel = path.relative_to(output_dir).as_posix()
        files.append(
            {
                "label": rel,
                "path": rel,
                "kind": path.suffix.lower().lstrip("."),
            }
        )
    return files


def _job_manifest_path(job_id: str) -> Path:
    return JOBS_DIR / job_id / "manifest.json"


def _read_manifest(job_id: str) -> dict[str, Any]:
    manifest_path = _job_manifest_path(job_id)
    if not manifest_path.exists():
        raise HTTPException(status_code=404, detail="Processamento nao encontrado")
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def _latest_manifest() -> dict[str, Any] | None:
    manifests = sorted(JOBS_DIR.glob("*/manifest.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not manifests:
        return None
    return json.loads(manifests[0].read_text(encoding="utf-8"))


def _list_manifests(limit: int = 10) -> list[dict[str, Any]]:
    manifests = sorted(JOBS_DIR.glob("*/manifest.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    items: list[dict[str, Any]] = []
    for manifest_path in manifests[:limit]:
        items.append(json.loads(manifest_path.read_text(encoding="utf-8")))
    return items


@router.get("/api/processamento/ultimo")
def api_processamento_ultimo():
    data = _latest_manifest()
    return data or {"job_id": None, "artifacts": [], "status": "empty"}


@router.get("/api/processamento/logs")
def api_processamento_logs(limit: int = Query(default=10, ge=1, le=50)):
    return {"items": _list_manifests(limit=limit)}


@router.get("/api/processamento/{job_id}")
def api_processamento_detalhe(job_id: str):
    return _read_manifest(job_id)


@router.get("/api/processamento/{job_id}/artefato/{rel_path:path}")
def api_processamento_artefato(job_id: str, rel_path: str):
    base_dir = (JOBS_DIR / job_id / "saida").resolve()
    target = (base_dir / rel_path).resolve()
    if not str(target).startswith(str(base_dir)):
        raise HTTPException(status_code=404, detail="Artefato invalido")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Artefato nao encontrado")
    return FileResponse(target, filename=target.name)


@router.post("/api/processamento/apenas-ler")
async def api_processamento_apenas_ler(
    arquivo: UploadFile = File(...),
):
    """Apenas lê o arquivo e retorna a rede (PVs + trechos) sem gerar NS."""
    filename = arquivo.filename or "projeto"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="Formato nao suportado. Use JSON, XML/LandXML, DXF ou DWG.")
    if suffix == ".landxml":
        suffix = ".xml"

    job_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8]
    job_dir = JOBS_DIR / job_id
    input_dir = job_dir / "input"
    input_dir.mkdir(parents=True, exist_ok=True)

    upload_path = input_dir / f"projeto{suffix}"
    _save_upload(arquivo, upload_path)

    try:
        if suffix == ".json":
            payload = json.loads(upload_path.read_text(encoding="utf-8-sig"))
            pvs, trechos = _extract_network_from_json(payload)
            fonte = "JSON"
        elif suffix == ".xml":
            from ler_landxml import ler_landxml
            pvs, trechos, _, meta = ler_landxml(str(upload_path))
            fonte = meta.get("motor") or "LandXML"
        elif suffix == ".dxf":
            # Detectar ProSaneamento automaticamente
            try:
                from ler_dxf_prosaneamento import detectar_prosaneamento, ler_dxf_prosaneamento
                if detectar_prosaneamento(str(upload_path)):
                    pvs, trechos, _, meta = ler_dxf_prosaneamento(str(upload_path))
                    fonte = "ProSaneamento"
                else:
                    from ler_dxf_gdal import ler_dxf_gdal
                    pvs, trechos, _, meta = ler_dxf_gdal(str(upload_path))
                    fonte = meta.get("motor") or "DXF"
            except ImportError:
                from ler_dxf_gdal import ler_dxf_gdal
                pvs, trechos, _, meta = ler_dxf_gdal(str(upload_path))
                fonte = meta.get("motor") or "DXF"
        elif suffix == ".dwg":
            try:
                from ler_dwg_universal import ler_dwg_universal
            except ImportError as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"DWG indisponivel: {exc}. Use DXF, LandXML ou JSON.",
                ) from exc
            result = ler_dwg_universal(str(upload_path))
            if len(result) == 4:
                pvs, trechos, _, meta = result
            elif len(result) == 3:
                pvs, trechos, meta = result
            else:
                raise HTTPException(status_code=500, detail=f"DWG retornou {len(result)} valores")
            fonte = meta.get("motor") or "DWG"
        else:
            raise HTTPException(status_code=400, detail="Formato nao suportado.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha ao ler arquivo: {exc}") from exc

    ext_total = sum(t.get("ext_m", 0) for t in trechos)
    manifest = {
        "job_id": job_id,
        "status": "ok",
        "fonte": fonte,
        "arquivo": filename,
        "n_pvs": len(pvs),
        "n_trechos": len(trechos),
        "extensao_total_m": ext_total,
        "ns_geradas": 0,
        "ns_erros": 0,
        "artifacts": [],
        "created_at": datetime.now().isoformat(),
        "rede": {"pvs": pvs, "trechos": trechos},
    }
    _job_manifest_path(job_id).write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return manifest



def _ler_upload(upload_path: Path, suffix: str) -> tuple[dict, list, dict]:
    """Le arquivo enviado e retorna (pvs, trechos, meta).
    
    Para DXF, detecta automaticamente se eh ProSaneamento (layers PS_*)
    ou Civil 3D generico (GDAL).
    """
    if suffix == ".json":
        payload = json.loads(upload_path.read_text(encoding="utf-8-sig"))
        pvs, trechos = _extract_network_from_json(payload)
        return pvs, trechos, {"motor": "JSON"}
    elif suffix == ".xml":
        from ler_landxml import ler_landxml
        pvs, trechos, _, meta = ler_landxml(str(upload_path))
        return pvs, trechos, meta
    elif suffix == ".dxf":
        # Deteccao automatica: ProSaneamento (layers PS_*) vs GDAL generico
        try:
            from ler_dxf_prosaneamento import detectar_prosaneamento, ler_dxf_prosaneamento
            if detectar_prosaneamento(str(upload_path)):
                pvs, trechos, _, meta = ler_dxf_prosaneamento(str(upload_path))
                return pvs, trechos, meta
        except ImportError:
            pass
        from ler_dxf_gdal import ler_dxf_gdal
        pvs, trechos, _, meta = ler_dxf_gdal(str(upload_path))
        return pvs, trechos, meta
    elif suffix == ".dwg":
        from ler_dwg_universal import ler_dwg_universal
        result = ler_dwg_universal(str(upload_path))
        if len(result) == 4:
            pvs, trechos, _, meta = result
        elif len(result) == 3:
            pvs, trechos, meta = result
        else:
            raise HTTPException(status_code=500, detail=f"ler_dwg_universal retornou {len(result)} valores (esperava 3 ou 4)")
        return pvs, trechos, meta
    raise HTTPException(status_code=400, detail="Formato nao suportado.")


def _interpolar_ruas_web(mapas_dir: Path, trechos: list, pvs: dict) -> int:
    """Aplica interpolacao de ruas usando mapas enviados pelo usuario."""
    total = 0
    for mapa_file in sorted(mapas_dir.iterdir()):
        if not mapa_file.is_file():
            continue
        ext = mapa_file.suffix.lower()
        try:
            if ext == ".gpkg":
                from exportar_completo import _carregar_ruas_gpkg
                total += _carregar_ruas_gpkg(str(mapa_file), trechos, pvs)
            elif ext in (".dxf", ".dwg"):
                from exportar_completo import _carregar_ruas_dxf
                total += _carregar_ruas_dxf(str(mapa_file), trechos, pvs)
        except Exception:
            pass
    return total


@router.post("/api/processamento/importar")
async def api_processamento_importar(
    nucleo: str = Form(default=""),
    modo_rapido: bool = Form(default=False),
    motor: str = Form(default="v9"),
    arquivo: UploadFile = File(...),
    mapas: list[UploadFile] = File(default=[]),
):
    filename = arquivo.filename or "projeto"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="Formato nao suportado. Use JSON, XML/LandXML ou DXF.")
    if suffix == ".landxml":
        suffix = ".xml"

    motor_escolhido = motor.strip().lower() if motor else "v9"

    job_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8]
    job_dir = JOBS_DIR / job_id
    input_dir = job_dir / "input"
    output_dir = job_dir / "saida"
    mapas_dir = job_dir / "mapas"
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    upload_path = input_dir / f"projeto{suffix}"
    _save_upload(arquivo, upload_path)

    # Salvar mapas de interpolacao
    if mapas:
        mapas_dir.mkdir(parents=True, exist_ok=True)
        for mapa_upload in mapas:
            if mapa_upload.filename:
                mapa_path = mapas_dir / mapa_upload.filename
                _save_upload(mapa_upload, mapa_path)

    nucleo_value = _nucleo_final(nucleo, filename)
    meta: dict[str, Any] = {"motor": "web"}
    pvs: dict = {}
    trechos: list = []

    try:
        if motor_escolhido == "v5":
            import construdata_sabesp_v5_FINAL as v5_engine

            if suffix == ".json":
                json_path = str(upload_path)
                dxf_path_arg = None
            elif suffix in (".dxf", ".dwg"):
                dxf_path_arg = str(upload_path)
                json_path = None
            else:
                raise HTTPException(status_code=400, detail="Motor v5 suporta apenas DXF, DWG e JSON.")

            v5_engine.processar(
                dxf_path=dxf_path_arg,
                json_path=json_path,
                pasta_saida=str(output_dir),
                nucleo=nucleo_value,
            )
            n_ok = len(list(output_dir.rglob("*.pdf")))
            n_err = 0
            meta["motor"] = "v5"
            fonte = suffix.lstrip(".").upper()
        else:
            pvs, trechos, meta = _ler_upload(upload_path, suffix)
            fonte = meta.get("motor") or suffix.lstrip(".").upper()

            # Enriquecer trechos
            try:
                from gerar_ns import enriquecer_trechos
                trechos = enriquecer_trechos(trechos, pvs)
            except Exception:
                pass

            # Interpolacao de ruas via mapas do usuario
            n_ruas = 0
            if mapas_dir.exists():
                n_ruas = _interpolar_ruas_web(mapas_dir, trechos, pvs)
            meta["n_ruas_interpoladas"] = n_ruas

            from gerar_ns import processar_nucleo_from_data

            n_ok, n_err = processar_nucleo_from_data(
                pvs,
                trechos,
                nucleo_value,
                str(output_dir),
                modo_rapido=modo_rapido,
            )
            meta["motor"] = "v9"
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha ao processar projeto: {exc}") from exc

    artifacts = _collect_artifacts(output_dir)
    manifest = {
        "job_id": job_id,
        "status": "ok",
        "nucleo": nucleo_value,
        "fonte": fonte,
        "modo_rapido": bool(modo_rapido),
        "motor": motor_escolhido,
        "arquivo": filename,
        "n_pvs": len(pvs) if motor_escolhido != "v5" else 0,
        "n_trechos": len(trechos) if motor_escolhido != "v5" else 0,
        "ns_geradas": n_ok,
        "ns_erros": n_err,
        "artifacts": artifacts[:200],
        "created_at": datetime.now().isoformat(),
        "meta": meta,
    }
    _job_manifest_path(job_id).write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return manifest


@router.post("/api/processamento/modular")
async def api_processamento_modular(
    nucleo: str = Form(default=""),
    modulos: str = Form(default="tudo"),
    equipes: int = Form(default=4),
    prod_m_dia: float = Form(default=6.0),
    arquivo: UploadFile = File(...),
    mapas: list[UploadFile] = File(default=[]),
):
    """Pipeline modular: usuario escolhe quais modulos gerar.

    modulos: separados por virgula. Opcoes:
        ns_campo, ns_desenho, ns_satelite, ose, materiais, compras,
        crono_ns, crono_micro, crono_macro, bim, lean, tudo
    """
    filename = arquivo.filename or "projeto"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="Formato nao suportado.")
    if suffix == ".landxml":
        suffix = ".xml"

    job_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8]
    job_dir = JOBS_DIR / job_id
    input_dir = job_dir / "input"
    output_dir = job_dir / "saida"
    mapas_dir = job_dir / "mapas"
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    upload_path = input_dir / f"projeto{suffix}"
    _save_upload(arquivo, upload_path)

    if mapas:
        mapas_dir.mkdir(parents=True, exist_ok=True)
        for mapa_upload in mapas:
            if mapa_upload.filename:
                _save_upload(mapa_upload, mapas_dir / mapa_upload.filename)

    nucleo_value = _nucleo_final(nucleo, filename)
    mods = {m.strip().lower() for m in modulos.split(",")} if modulos else {"tudo"}
    is_tudo = "tudo" in mods

    try:
        pvs, trechos, meta = _ler_upload(upload_path, suffix)
        fonte = meta.get("motor") or suffix.lstrip(".").upper()

        try:
            from gerar_ns import enriquecer_trechos
            trechos = enriquecer_trechos(trechos, pvs)
        except Exception:
            pass

        if mapas_dir.exists():
            _interpolar_ruas_web(mapas_dir, trechos, pvs)

        # Criar subpastas
        pastas = {}
        for nome in ["01_NS_CAMPO", "02_DESENHOS", "03_HTML", "04_GIS",
                      "05_PLANILHAS", "06_CUSTOS", "07_BIM_IFC", "08_LEAN_LPS",
                      "09_MICROPLAN", "10_CRONOGRAMA", "11_POR_RUA"]:
            p = output_dir / nome
            p.mkdir(parents=True, exist_ok=True)
            pastas[nome] = p

        n_ok = n_err = 0
        resultado = {"modulos_executados": []}

        # NS CAMPO
        if is_tudo or "ns_campo" in mods:
            from gerar_ns import gerar_ns_a4, calcular_materiais, _ns_folder_name
            for i, t in enumerate(trechos):
                ns_id = i + 1
                pv_i = t.get("pv_ini", "PVX"); pv_f = t.get("pv_fim", "PVY")
                ns_dir = pastas["01_NS_CAMPO"] / _ns_folder_name(ns_id, pv_i, pv_f)
                ns_dir.mkdir(parents=True, exist_ok=True)
                try:
                    gerar_ns_a4(ns_id, t, pvs, nucleo_value, str(ns_dir / f"NS{ns_id:03d}_A4.pdf"))
                    n_ok += 1
                except Exception:
                    n_err += 1
            resultado["modulos_executados"].append("ns_campo")

        # NS DESENHO
        if is_tudo or "ns_desenho" in mods:
            try:
                from gerar_ns import gerar_ns_desenho
                for i, t in enumerate(trechos):
                    try:
                        gerar_ns_desenho(i+1, t, pvs, trechos, nucleo_value,
                                        str(pastas["02_DESENHOS"] / f"NS{i+1:03d}_DESENHO.pdf"))
                    except Exception: pass
                resultado["modulos_executados"].append("ns_desenho")
            except ImportError: pass

        # NS SATELITE
        if is_tudo or "ns_satelite" in mods:
            try:
                from gerar_ns import gerar_ns_sat
                for i, t in enumerate(trechos):
                    try:
                        gerar_ns_sat(i+1, t, pvs, nucleo_value,
                                    str(pastas["02_DESENHOS"] / f"NS{i+1:03d}_SAT.pdf"))
                    except Exception: pass
                resultado["modulos_executados"].append("ns_satelite")
            except ImportError: pass

        # OSE / MATERIAIS / COMPRAS
        if is_tudo or mods & {"ose", "materiais", "compras"}:
            try:
                from exportar_completo import _gerar_planilha_trechos_completa, _slug
                _gerar_planilha_trechos_completa(
                    trechos, pvs, nucleo_value, "ESGOTO",
                    pastas["05_PLANILHAS"] / f"TODOS_TRECHOS_{_slug(nucleo_value)}.xlsx"
                )
                resultado["modulos_executados"].append("ose_materiais_compras")
            except Exception: pass
            try:
                from gerar_xlsx import gerar_xlsx_custos, gerar_xlsx_hidraulica
                gerar_xlsx_custos(pvs, trechos, nucleo_value,
                                 str(pastas["06_CUSTOS"] / f"CUSTOS_{_slug(nucleo_value)}.xlsx"))
                gerar_xlsx_hidraulica(trechos, pvs, nucleo_value,
                                     str(pastas["05_PLANILHAS"] / f"HIDRAULICA_{_slug(nucleo_value)}.xlsx"))
            except Exception: pass

        # CRONOGRAMA NS
        if is_tudo or "crono_ns" in mods:
            try:
                from gerar_cronograma_macro import gerar_cronograma_por_ns
                ns_lista = [
                    {"ordem": i+1, "trecho_idx": i,
                     "pv_ini": t.get("pv_ini", ""), "pv_fim": t.get("pv_fim", ""),
                     "ext_m": t.get("ext_m", 0), "rua": t.get("rua", "")}
                    for i, t in enumerate(trechos)
                ]
                gerar_cronograma_por_ns(
                    ns_lista, data_inicio_str=datetime.now().strftime("%Y-%m-%d"),
                    equipes=equipes, prod_m_dia=prod_m_dia,
                    nucleo=nucleo_value, out_dir=str(pastas["10_CRONOGRAMA"])
                )
                resultado["modulos_executados"].append("crono_ns")
            except Exception: pass

        # CRONOGRAMA MICRO
        if is_tudo or "crono_micro" in mods:
            try:
                from motor_microplanejamento import micro_planejar_nucleo
                micro_planejar_nucleo(pvs, trechos, nucleo_value, equipes_max=equipes)
                resultado["modulos_executados"].append("crono_micro")
            except Exception: pass

        # CRONOGRAMA MACRO
        if is_tudo or "crono_macro" in mods:
            try:
                from gerar_cronograma_macro import (
                    gerar_cronograma_macro, exportar_project_xml,
                    exportar_primavera_xer, exportar_openproject_csv
                )
                ext_total = sum(t.get("ext_m", 0) for t in trechos)
                wbs = gerar_cronograma_macro(
                    [{"nome": nucleo_value, "extensao_m": ext_total,
                      "n_trechos": len(trechos), "equipes": equipes}],
                    datetime.now().strftime("%Y-%m-%d")
                )
                exportar_project_xml(wbs, str(pastas["10_CRONOGRAMA"] / "MACRO.xml"))
                exportar_primavera_xer(wbs, str(pastas["10_CRONOGRAMA"] / "MACRO_P6.xer"))
                exportar_openproject_csv(wbs, str(pastas["10_CRONOGRAMA"] / "MACRO_OPENPROJECT.csv"))
                resultado["modulos_executados"].append("crono_macro")
            except Exception: pass

        # BIM IFC
        if is_tudo or "bim" in mods:
            try:
                from gerar_ifc_lod500 import gerar_ifc_lod500
                gerar_ifc_lod500(pvs, trechos, nucleo_value, str(pastas["07_BIM_IFC"]))
                resultado["modulos_executados"].append("bim")
            except Exception: pass

        # LEAN/LPS
        if is_tudo or "lean" in mods:
            try:
                from motor_lean_lps import gerar_relatorio_lean_lps, gerar_xlsx_lean_lps
                from exportar_completo import _slug
                rel = gerar_relatorio_lean_lps(pvs, trechos, nucleo=nucleo_value)
                gerar_xlsx_lean_lps(rel, pvs, trechos, nucleo_value,
                                   str(pastas["08_LEAN_LPS"] / f"LEAN_{_slug(nucleo_value)}.xlsx"))
                resultado["modulos_executados"].append("lean")
            except Exception: pass

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha no pipeline modular: {exc}") from exc

    artifacts = _collect_artifacts(output_dir)
    manifest = {
        "job_id": job_id,
        "status": "ok",
        "nucleo": nucleo_value,
        "fonte": fonte,
        "motor": "v9_modular",
        "modulos": list(mods),
        "modulos_executados": resultado["modulos_executados"],
        "arquivo": filename,
        "n_pvs": len(pvs),
        "n_trechos": len(trechos),
        "ns_geradas": n_ok,
        "ns_erros": n_err,
        "artifacts": artifacts[:200],
        "created_at": datetime.now().isoformat(),
        "meta": meta,
    }
    _job_manifest_path(job_id).write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return manifest


@router.post("/api/processamento/lote-auditoria")
async def api_processamento_lote_auditoria(
    arquivos_projeto: list[UploadFile] = File(...),
    arquivos_shapefile: list[UploadFile] = File(...)
):
    job_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_auditoria_" + uuid.uuid4().hex[:4]
    job_dir = JOBS_DIR / job_id
    input_dir = job_dir / "input"
    shp_dir = job_dir / "shapefiles"
    output_dir = job_dir / "saida"
    input_dir.mkdir(parents=True, exist_ok=True)
    shp_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Salvar os shapefiles (extratores via ZIP ou soltos)
    import zipfile
    for shp_upload in arquivos_shapefile:
        fn = shp_upload.filename
        if not fn: continue
        path = shp_dir / fn
        _save_upload(shp_upload, path)
        if fn.lower().endswith(".zip"):
            with zipfile.ZipFile(path, 'r') as zip_ref:
                zip_ref.extractall(shp_dir)
                
    # 2. Ler todos os projetos em memoria
    projetos_carregados = []
    for proj_upload in arquivos_projeto:
        fn = proj_upload.filename
        if not fn: continue
        path = input_dir / fn
        _save_upload(proj_upload, path)
        
        try:
            pvs, trechos, meta = _ler_upload(path, Path(fn).suffix.lower())
            nucleo = _nucleo_final("", fn)
            tipo = "AGUA" if "agua" in nucleo.lower() else "ESGOTO"
            projetos_carregados.append({
                "nucleo": nucleo,
                "tipo": tipo,
                "pvs": pvs,
                "trechos": trechos
            })
        except Exception as e:
            print(f"Erro lendo projeto {fn}: {e}")
            
    # 3. Rodar Motor Auditoria V4
    from motor_auditoria_v4 import processar_lote_auditoria
    
    try:
        resultado = processar_lote_auditoria(projetos_carregados, shp_dir, output_dir)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha na Auditoria V4: {exc}") from exc
        
    artifacts = _collect_artifacts(output_dir)
    manifest = {
        "job_id": job_id,
        "status": "ok",
        "motor": "auditoria_v4_nts",
        "n_projetos": len(projetos_carregados),
        "stats_geral": resultado["status_geral"],
        "artifacts": artifacts,
        "created_at": datetime.now().isoformat()
    }
    _job_manifest_path(job_id).write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        
    return manifest
