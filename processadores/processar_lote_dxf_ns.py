"""Processa DXFs e gera NS organizadas por tipo e núcleo."""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import traceback
import unicodedata
from datetime import datetime
from pathlib import Path

from gerar_ns import (
    CONTRATO,
    _criar_estrutura_v9,
    _ns_folder_name,
    calc_manning,
    enriquecer_trechos,
    gerar_geojson,
    gerar_ns_a4,
    processar_nucleo_from_data,
)
from ler_dxf_gdal import ler_dxf_gdal


def _slug_ascii(texto: str) -> str:
    normalizado = unicodedata.normalize("NFKD", str(texto or ""))
    return normalizado.encode("ascii", "ignore").decode("ascii")


def _classificar_arquivo(path: Path) -> tuple[str, str]:
    nome = _slug_ascii(path.stem).upper()
    nome = re.sub(r"[\s\-]+", "_", nome)

    if "ESGOTO" in nome or re.search(r"_ESG\d*", nome):
        tipo = "ESGOTO"
    elif "AGUA" in nome:
        tipo = "AGUA"
    else:
        tipo = "OUTROS"

    nucleo = re.sub(r"_(ESGOTO|AGUA)\d*.*$", "", nome)
    nucleo = re.sub(r"_REV.*$", "", nucleo)
    nucleo = re.sub(r"_V\d+.*$", "", nucleo)
    nucleo = nucleo.strip("_") or nome
    nucleo_pretty = " ".join(parte.capitalize() for parte in nucleo.split("_") if parte)
    return tipo, nucleo_pretty


def _pasta_saida_nucleo(raiz_saida: Path, tipo: str, nucleo: str) -> Path:
    return raiz_saida / tipo / nucleo.upper().replace(" ", "_")


def _processar_nucleo_rapido(pvs: dict, trechos: list, nucleo: str, out_base: Path) -> tuple[int, int]:
    if not trechos:
        raise RuntimeError("Sem trechos para gerar NS")

    trechos = enriquecer_trechos(trechos, pvs)
    campo, plan = _criar_estrutura_v9(nucleo.upper().replace(" ", "_"), str(out_base))
    print("Modo rapido: A4 + JSON + GeoJSON")

    n_ok = 0
    n_err = 0
    for ns_id, trecho in enumerate(trechos, start=1):
        pasta = _ns_folder_name(ns_id, trecho.get("pv_ini", ""), trecho.get("pv_fim", ""))
        ns_dir = campo / pasta
        ns_dir.mkdir(parents=True, exist_ok=True)

        try:
            gerar_ns_a4(ns_id, trecho, pvs, nucleo, ns_dir / f"NS{ns_id:03d}_A4.pdf")

            dados = {
                "ns_id": ns_id,
                "trecho_idx": ns_id - 1,
                "nucleo": nucleo,
                "contrato": CONTRATO,
                "trecho": {k: v for k, v in trecho.items()},
                "pv_montante": pvs.get(trecho.get("pv_ini", ""), {}),
                "pv_jusante": pvs.get(trecho.get("pv_fim", ""), {}),
                "hidraulica": calc_manning(trecho.get("dn_mm"), trecho.get("decl_mm")),
                "gerado_em": datetime.now().isoformat(),
                "modo": "rapido",
            }
            with open(ns_dir / f"NS{ns_id:03d}_DADOS.json", "w", encoding="utf-8") as f:
                json.dump(dados, f, indent=2, ensure_ascii=False)

            n_ok += 1
            if ns_id <= 3 or ns_id % 50 == 0:
                print(
                    f"NS{ns_id:03d}: {trecho.get('pv_ini')}->{trecho.get('pv_fim')} "
                    f"DN{trecho.get('dn_mm')} {float(trecho.get('ext_m') or 0):.1f}m"
                )
        except Exception:
            n_err += 1
            print(f"ERRO NS{ns_id:03d}")
            traceback.print_exc()

    n_feat = gerar_geojson(trechos, pvs, plan / "GIS" / "rede_definida.geojson")
    log_data = {
        "nucleo": nucleo,
        "n_pvs": len(pvs),
        "n_trechos": len(trechos),
        "n_ns_geradas": n_ok,
        "n_ns_erros": n_err,
        "modo": "rapido",
        "extensao_m": round(sum(float(t.get("ext_m") or 0) for t in trechos), 1),
        "geojson_features": n_feat,
        "gerado_em": datetime.now().isoformat(),
    }
    with open(plan / "LOG" / "log_processamento.json", "w", encoding="utf-8") as f:
        json.dump(log_data, f, indent=2, ensure_ascii=False)

    try:
        from core.database import bootstrap_database, importar_pvs_trechos

        bootstrap_database(force_import=False)
        importar_pvs_trechos(pvs, trechos, nucleo)
    except Exception as exc:
        print(f"Banco SQLite: {exc}")

    return n_ok, n_err


def _processar_dxf(
    dxf_path: Path,
    raiz_saida: Path,
    limpar_destino: bool = False,
    rapido: bool = False,
) -> dict:
    tipo, nucleo = _classificar_arquivo(dxf_path)
    out_base = raiz_saida / tipo
    out_base.mkdir(parents=True, exist_ok=True)
    pasta_nucleo = _pasta_saida_nucleo(raiz_saida, tipo, nucleo)

    if limpar_destino and pasta_nucleo.exists():
        shutil.rmtree(pasta_nucleo)

    print(f"\n=== {dxf_path.name} ===")
    print(f"Tipo: {tipo} | Nucleo: {nucleo}")

    pvs, trechos, _, meta = ler_dxf_gdal(str(dxf_path))
    if not trechos:
        raise RuntimeError("Leitor retornou zero trechos")

    if rapido:
        n_ok, n_err = _processar_nucleo_rapido(pvs, trechos, nucleo, out_base)
    else:
        n_ok, n_err = processar_nucleo_from_data(pvs, trechos, nucleo, str(out_base))

    copia_dxf = pasta_nucleo / "FONTE_DXF"
    copia_dxf.mkdir(parents=True, exist_ok=True)
    shutil.copy2(dxf_path, copia_dxf / dxf_path.name)

    return {
        "arquivo": dxf_path.name,
        "tipo": tipo,
        "nucleo": nucleo,
        "pasta_saida": str(pasta_nucleo),
        "motor": meta.get("motor"),
        "n_pvs": len(pvs),
        "n_trechos": len(trechos),
        "ns_ok": n_ok,
        "ns_err": n_err,
    }


def _processar_pasta(
    pasta: Path,
    raiz_saida: Path,
    limpar_destino: bool = False,
    rapido: bool = False,
) -> dict:
    dxf_files = sorted(pasta.glob("*.dxf"))
    resumo = {
        "pasta_origem": str(pasta),
        "raiz_saida": str(raiz_saida),
        "gerado_em": datetime.now().isoformat(),
        "arquivos_total": len(dxf_files),
        "arquivos_processados": [],
        "falhas": [],
    }

    if not dxf_files:
        raise FileNotFoundError(f"Nenhum arquivo .dxf encontrado em: {pasta}")

    for dxf_path in dxf_files:
        try:
            resumo["arquivos_processados"].append(
                _processar_dxf(
                    dxf_path,
                    raiz_saida,
                    limpar_destino=limpar_destino,
                    rapido=rapido,
                )
            )
        except Exception as exc:
            tipo, nucleo = _classificar_arquivo(dxf_path)
            resumo["falhas"].append(
                {
                    "arquivo": dxf_path.name,
                    "tipo": tipo,
                    "nucleo": nucleo,
                    "erro": f"{type(exc).__name__}: {exc}",
                }
            )
            print(f"ERRO: {type(exc).__name__}: {exc}")

    return resumo


def main() -> int:
    parser = argparse.ArgumentParser(description="Processa um DXF ou todos os DXFs de uma pasta.")
    parser.add_argument("entrada", help="Arquivo DXF ou pasta com arquivos DXF")
    parser.add_argument(
        "--saida",
        help="Raiz de saida. Padrao: <pasta>/_NS_PROCESSADAS",
        default="",
    )
    parser.add_argument(
        "--limpar-destino",
        action="store_true",
        help="Apaga a pasta de saida do nucleo antes de regenerar.",
    )
    parser.add_argument(
        "--rapido",
        action="store_true",
        help="Gera apenas A4 + JSON + GeoJSON consolidado.",
    )
    args = parser.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    entrada = Path(args.entrada).expanduser().resolve()
    if not entrada.exists():
        print(f"Entrada invalida: {entrada}")
        return 1

    base_saida = entrada.parent if entrada.is_file() else entrada
    raiz_saida = Path(args.saida).expanduser().resolve() if args.saida else (base_saida / "_NS_PROCESSADAS")
    raiz_saida.mkdir(parents=True, exist_ok=True)

    if entrada.is_file():
        resumo = {
            "arquivo_origem": str(entrada),
            "raiz_saida": str(raiz_saida),
            "gerado_em": datetime.now().isoformat(),
            "arquivos_total": 1,
            "arquivos_processados": [],
            "falhas": [],
        }
        try:
            resumo["arquivos_processados"].append(
                _processar_dxf(
                    entrada,
                    raiz_saida,
                    limpar_destino=args.limpar_destino,
                    rapido=args.rapido,
                )
            )
        except Exception as exc:
            tipo, nucleo = _classificar_arquivo(entrada)
            resumo["falhas"].append(
                {
                    "arquivo": entrada.name,
                    "tipo": tipo,
                    "nucleo": nucleo,
                    "erro": f"{type(exc).__name__}: {exc}",
                }
            )
            print(f"ERRO: {type(exc).__name__}: {exc}")
    else:
        resumo = _processar_pasta(
            entrada,
            raiz_saida,
            limpar_destino=args.limpar_destino,
            rapido=args.rapido,
        )
    resumo_path = raiz_saida / "resumo_processamento.json"
    resumo_path.write_text(json.dumps(resumo, indent=2, ensure_ascii=False), encoding="utf-8")

    ok = len(resumo["arquivos_processados"])
    falhas = len(resumo["falhas"])
    print("\n" + "=" * 72)
    print(f"Arquivos processados com sucesso: {ok}")
    print(f"Arquivos com falha: {falhas}")
    print(f"Resumo: {resumo_path}")
    print("=" * 72)
    return 0 if ok > 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
