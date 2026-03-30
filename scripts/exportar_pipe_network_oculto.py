#!/usr/bin/env python3
"""
Abre uma instancia oculta do Civil 3D / AutoCAD, carrega o exporter .NET
e extrai Pipe Networks de um DWG para JSON e CSV.

Uso:
  python scripts/exportar_pipe_network_oculto.py caminho\\arquivo.dwg
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Iterable
import winreg

try:
    import pythoncom
    import pywintypes
    from win32com.client import DispatchEx
except ImportError as exc:
    raise SystemExit(
        "Dependencia ausente. Instale pywin32: pip install pywin32"
    ) from exc


EXPORT_PATTERN = re.compile(
    r"^(?P<base>.+_pipe_network_export_\d{8}_\d{6})"
    r"(?P<suffix>_networks|_pipes|_structures)?(?P<ext>\.json|\.csv)$",
    re.IGNORECASE,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Exporta Pipe Networks abrindo o Civil 3D em modo oculto."
    )
    parser.add_argument("dwg", help="Caminho do DWG a ser aberto em read-only.")
    parser.add_argument(
        "--dll",
        help="DLL do exporter .NET. Se omitido, usa o bundle instalado ou a build local.",
    )
    parser.add_argument(
        "--prog-id",
        help="ProgID COM do AutoCAD/Civil 3D. Ex.: AutoCAD.Application.25.1",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=180,
        help="Timeout total em segundos para a exportacao.",
    )
    parser.add_argument(
        "--load-timeout",
        type=int,
        default=90,
        help="Timeout em segundos para carregar DWG e DLL.",
    )
    parser.add_argument(
        "--keep-open",
        action="store_true",
        help="Nao fecha a instancia oculta ao final.",
    )
    parser.add_argument(
        "--visible",
        action="store_true",
        help="Mostra a instancia do AutoCAD durante a execucao.",
    )
    parser.add_argument(
        "--result-json",
        help="Se informado, salva um JSON com o resultado da execucao.",
    )
    return parser.parse_args()


def resolve_repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def candidate_dll_paths() -> list[Path]:
    repo_root = resolve_repo_root()
    return [
        Path(
            r"C:\ProgramData\Autodesk\ApplicationPlugins\PipeNetworkExporter.bundle\Contents\PipeNetworkExporter.dll"
        ),
        repo_root / "civil3d_pipe_exporter" / "bin" / "Release" / "PipeNetworkExporter.dll",
    ]


def resolve_dll_path(cli_value: str | None) -> Path:
    if cli_value:
        path = Path(cli_value).expanduser().resolve()
        if not path.exists():
            raise FileNotFoundError(f"DLL nao encontrada: {path}")
        return path

    for path in candidate_dll_paths():
        if path.exists():
            return path

    raise FileNotFoundError(
        "DLL do exporter nao encontrada. Rode civil3d_pipe_exporter\\build.ps1 primeiro."
    )


def read_registry_default(path: str) -> str | None:
    try:
        with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, path) as key:
            value, _ = winreg.QueryValueEx(key, None)
            return str(value)
    except OSError:
        return None


def candidate_progids() -> list[str]:
    values: list[str] = []
    curver = read_registry_default(r"AutoCAD.Application\CurVer")
    if curver:
        values.append(curver)

    for value in ["AutoCAD.Application.25.1", "AutoCAD.Application.25", "AutoCAD.Application"]:
        if value not in values:
            values.append(value)

    return values


def resolve_prog_id(cli_value: str | None) -> str:
    if cli_value:
        return cli_value

    for prog_id in candidate_progids():
        if read_registry_default(rf"{prog_id}\CLSID"):
            return prog_id

    raise RuntimeError("Nao encontrei um ProgID registrado para AutoCAD.Application.")


def wait_quiescent(app, timeout_seconds: int, label: str) -> None:
    deadline = time.time() + timeout_seconds
    last_error: Exception | None = None

    while time.time() < deadline:
        try:
            if app.GetAcadState().IsQuiescent:
                return
        except Exception as exc:  # pragma: no cover - COM transient
            last_error = exc
        time.sleep(1.0)

    if last_error:
        raise TimeoutError(f"Timeout aguardando AutoCAD ocioso em {label}: {last_error}")
    raise TimeoutError(f"Timeout aguardando AutoCAD ocioso em {label}.")


def snapshot_output_names(output_dir: Path, dwg_stem: str) -> set[str]:
    if not output_dir.exists():
        return set()
    return {path.name for path in output_dir.glob(f"{dwg_stem}_pipe_network_export_*")}


def complete_export_groups(paths: Iterable[Path], before_names: set[str]) -> list[dict[str, object]]:
    groups: dict[str, dict[str, Path]] = {}

    for path in paths:
        match = EXPORT_PATTERN.match(path.name)
        if not match:
            continue

        base = match.group("base")
        suffix = match.group("suffix") or ""
        ext = match.group("ext").lower()
        key = f"{suffix}{ext}"
        groups.setdefault(base, {})[key] = path

    complete: list[dict[str, object]] = []
    for base, files in groups.items():
        required = {".json", "_networks.csv", "_pipes.csv", "_structures.csv"}
        if not required.issubset(files):
            continue

        names = {path.name for path in files.values()}
        if not (names - before_names):
            continue

        complete.append(
            {
                "base": base,
                "json": str(files[".json"]),
                "networks_csv": str(files["_networks.csv"]),
                "pipes_csv": str(files["_pipes.csv"]),
                "structures_csv": str(files["_structures.csv"]),
                "latest_mtime": max(path.stat().st_mtime for path in files.values()),
            }
        )

    return sorted(complete, key=lambda item: item["latest_mtime"], reverse=True)


def wait_for_export(output_dir: Path, dwg_stem: str, before_names: set[str], timeout_seconds: int) -> dict[str, object]:
    deadline = time.time() + timeout_seconds

    while time.time() < deadline:
        paths = list(output_dir.glob(f"{dwg_stem}_pipe_network_export_*"))
        groups = complete_export_groups(paths, before_names)
        if groups:
            winner = groups[0]

            size_snapshot = {
                key: Path(value).stat().st_size
                for key, value in winner.items()
                if key.endswith("csv") or key == "json"
            }
            time.sleep(2.0)
            stable = True
            for key, value in winner.items():
                if key.endswith("csv") or key == "json":
                    if Path(value).stat().st_size != size_snapshot[key]:
                        stable = False
                        break
            if stable:
                return winner

        time.sleep(1.0)

    raise TimeoutError(
        f"Timeout aguardando arquivos de exportacao em {output_dir} para o desenho {dwg_stem}."
    )


def safe_close_document(doc) -> None:
    try:
        doc.Close(False)
    except Exception:
        pass


def safe_quit_application(app) -> None:
    try:
        app.Quit()
    except Exception:
        pass


def send_command(doc, command: str, label: str, ignore_invalid_input: bool = False) -> None:
    try:
        doc.SendCommand(command)
    except pywintypes.com_error as exc:
        if ignore_invalid_input and "Invalid input" in str(exc):
            return
        raise RuntimeError(f"Falha ao enviar comando {label}: {exc}") from exc


def open_document(app, dwg_path: Path):
    try:
        return app.Documents.Open(str(dwg_path), True)
    except TypeError:
        return app.Documents.Open(str(dwg_path))


def resolve_document(app, opened_doc):
    active = None
    try:
        active = app.ActiveDocument
    except Exception:
        active = None

    for candidate in (opened_doc, active):
        if candidate is None:
            continue
        try:
            _ = candidate.Name
            return candidate
        except Exception:
            continue

    raise RuntimeError("Nao consegui resolver o documento ativo do AutoCAD.")


def safe_set_variable(doc, name: str, value) -> None:
    try:
        doc.SetVariable(name, value)
    except AttributeError:
        if hasattr(doc, "Application") and hasattr(doc.Application, "ActiveDocument"):
            doc.Application.ActiveDocument.SetVariable(name, value)
        else:
            raise


def export_pipe_network_hidden(
    dwg_path: Path,
    dll_path: Path,
    prog_id: str,
    timeout_seconds: int,
    load_timeout_seconds: int,
    visible: bool,
    keep_open: bool,
) -> dict[str, object]:
    output_dir = dwg_path.parent / "_construdata_exports"
    before_names = snapshot_output_names(output_dir, dwg_path.stem)

    pythoncom.CoInitialize()
    app = None
    doc = None

    try:
        app = DispatchEx(prog_id)
        app.Visible = bool(visible)

        doc = resolve_document(app, open_document(app, dwg_path))
        safe_set_variable(doc, "FILEDIA", 0)
        safe_set_variable(doc, "CMDDIA", 0)
        safe_set_variable(doc, "EXPERT", 5)

        wait_quiescent(app, load_timeout_seconds, "abertura do DWG")
        send_command(doc, "\x03\x03", "cancelamento inicial", ignore_invalid_input=True)
        wait_quiescent(app, 10, "cancelamento inicial")

        send_command(doc, f'_.NETLOAD "{dll_path}"\n', "NETLOAD")
        wait_quiescent(app, load_timeout_seconds, "NETLOAD")
        time.sleep(2.0)

        started_at = time.time()
        send_command(doc, "CD_EXPORT_PIPENET\n", "CD_EXPORT_PIPENET")
        exported = wait_for_export(output_dir, dwg_path.stem, before_names, timeout_seconds)
        exported["elapsed_seconds"] = round(time.time() - started_at, 2)
        exported["dwg"] = str(dwg_path)
        exported["dll"] = str(dll_path)
        exported["prog_id"] = prog_id
        exported["output_dir"] = str(output_dir)
        return exported
    finally:
        if doc is not None and not keep_open:
            safe_close_document(doc)
        if app is not None and not keep_open:
            safe_quit_application(app)
        pythoncom.CoUninitialize()


def main() -> int:
    args = parse_args()

    dwg_path = Path(args.dwg).expanduser().resolve()
    if not dwg_path.exists():
        raise SystemExit(f"DWG nao encontrado: {dwg_path}")

    dll_path = resolve_dll_path(args.dll)
    prog_id = resolve_prog_id(args.prog_id)

    result = export_pipe_network_hidden(
        dwg_path=dwg_path,
        dll_path=dll_path,
        prog_id=prog_id,
        timeout_seconds=args.timeout,
        load_timeout_seconds=args.load_timeout,
        visible=args.visible,
        keep_open=args.keep_open,
    )

    if args.result_json:
        result_path = Path(args.result_json).expanduser().resolve()
        result_path.parent.mkdir(parents=True, exist_ok=True)
        result_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
