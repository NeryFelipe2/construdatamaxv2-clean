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
            try:
                from ler_dxf_gdal import ler_dxf_gdal
            except ImportError as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"DXF indisponivel: {exc}. Use LandXML ou JSON.",
                ) from exc
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
            pvs, trechos, _, meta = ler_dwg_universal(str(upload_path))
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



@router.post("/api/processamento/importar")
async def api_processamento_importar(
    nucleo: str = Form(default=""),
    modo_rapido: bool = Form(default=False),
    motor: str = Form(default="v9"),
    arquivo: UploadFile = File(...),
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
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    upload_path = input_dir / f"projeto{suffix}"
    _save_upload(arquivo, upload_path)

    nucleo_value = _nucleo_final(nucleo, filename)
    meta: dict[str, Any] = {"motor": "web"}

    try:
        if motor_escolhido == "v5":
            # Motor NOVA NS v5
            import construdata_sabesp_v5_FINAL as v5_engine

            if suffix == ".json":
                json_path = str(upload_path)
                dxf_path_arg = None
                fonte = "JSON"
            elif suffix in (".dxf", ".dwg"):
                dxf_path_arg = str(upload_path)
                json_path = None
                fonte = "DWG" if suffix == ".dwg" else "DXF"
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
        else:
            # Motor v9 (padrao)
            if suffix == ".json":
                payload = json.loads(upload_path.read_text(encoding="utf-8-sig"))
                pvs, trechos = _extract_network_from_json(payload)
                fonte = "JSON"
            elif suffix == ".xml":
                from ler_landxml import ler_landxml

                pvs, trechos, _, meta = ler_landxml(str(upload_path))
                fonte = meta.get("motor") or "LandXML"
            elif suffix == ".dxf":
                try:
                    from ler_dxf_gdal import ler_dxf_gdal
                except ImportError as exc:
                    raise HTTPException(
                        status_code=400,
                        detail=f"DXF web indisponivel neste ambiente: {exc}. Use LandXML ou JSON.",
                    ) from exc
                pvs, trechos, _, meta = ler_dxf_gdal(str(upload_path))
                fonte = meta.get("motor") or "DXF"
            elif suffix == ".dwg":
                try:
                    from ler_dwg_universal import ler_dwg_universal
                except ImportError as exc:
                    raise HTTPException(
                        status_code=400,
                        detail=f"DWG web indisponivel neste ambiente: {exc}. Use DXF, LandXML ou JSON.",
                    ) from exc
                pvs, trechos, _, meta = ler_dwg_universal(str(upload_path))
                fonte = meta.get("motor") or "DWG"
            else:
                raise HTTPException(status_code=400, detail="Formato nao suportado.")

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
