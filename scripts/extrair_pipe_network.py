#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from exportar_pipe_network_oculto import (
    export_pipe_network_hidden,
    resolve_dll_path,
    resolve_prog_id,
)
from landxml_import import build_document, output_paths, write_outputs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extrai Pipe Network de DWG ou LandXML para JSON/CSV normalizados."
    )
    parser.add_argument("input", help="Arquivo .dwg, .xml ou .landxml")
    parser.add_argument("--output-dir", help="Diretorio de saida")
    parser.add_argument("--dll", help="DLL do exporter para entrada DWG")
    parser.add_argument("--prog-id", help="ProgID COM para entrada DWG")
    parser.add_argument("--timeout", type=int, default=180, help="Timeout do export DWG em segundos")
    parser.add_argument("--load-timeout", type=int, default=90, help="Timeout de carga do DWG/DLL")
    parser.add_argument("--visible", action="store_true", help="Mostra o AutoCAD durante export DWG")
    parser.add_argument("--keep-open", action="store_true", help="Mantem o AutoCAD aberto no fim")
    parser.add_argument("--pretty", action="store_true", help="Gera JSON identado")
    return parser.parse_args()


def run_landxml(input_path: Path, output_dir: str | None, pretty: bool) -> dict[str, object]:
    document = build_document(input_path)
    paths = output_paths(input_path, output_dir)
    write_outputs(document, paths, pretty=pretty)
    return {
        "mode": "landxml",
        "input": str(input_path),
        "outputDir": str(paths["output_dir"]),
        "json": str(paths["json"]),
        "networksCsv": str(paths["networks_csv"]),
        "pipesCsv": str(paths["pipes_csv"]),
        "structuresCsv": str(paths["structures_csv"]),
        "summary": document["summary"],
        "warnings": document["warnings"],
    }


def run_dwg(args: argparse.Namespace, input_path: Path) -> dict[str, object]:
    return {
        "mode": "dwg",
        **export_pipe_network_hidden(
            dwg_path=input_path,
            dll_path=resolve_dll_path(args.dll),
            prog_id=resolve_prog_id(args.prog_id),
            timeout_seconds=args.timeout,
            load_timeout_seconds=args.load_timeout,
            visible=args.visible,
            keep_open=args.keep_open,
        ),
    }


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    if not input_path.exists():
        raise SystemExit(f"Arquivo nao encontrado: {input_path}")

    suffix = input_path.suffix.lower()
    if suffix == ".dwg":
        result = run_dwg(args, input_path)
    elif suffix in {".xml", ".landxml"}:
        result = run_landxml(input_path, args.output_dir, args.pretty)
    else:
        raise SystemExit(f"Formato nao suportado: {input_path.suffix}")

    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
