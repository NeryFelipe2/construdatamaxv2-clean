from __future__ import annotations

import json
import math
from typing import Any


def _coerce_float(value: Any) -> float | None:
    if value in (None, "", "-"):
        return None
    try:
        return float(str(value).replace(",", "."))
    except Exception:
        return None


def _coerce_int(value: Any) -> int | None:
    if value in (None, "", "-"):
        return None
    try:
        return int(float(str(value).replace(",", ".")))
    except Exception:
        return None


def formatar_quantidade_material(value: Any) -> str:
    quantidade = _coerce_float(value)
    if quantidade is None:
        return "-"
    if float(quantidade).is_integer():
        return str(int(quantidade))
    return f"{quantidade:.2f}".rstrip("0").rstrip(".")


def calcular_materiais_padrao(trecho: dict[str, Any] | None) -> list[dict[str, Any]]:
    trecho = trecho or {}
    dn = _coerce_int(trecho.get("dn_mm")) or 200
    ext = _coerce_float(trecho.get("ext_m")) or 0.0
    material_rede = str(trecho.get("material") or "PVC").strip().upper() or "PVC"
    tipo = str(trecho.get("tipo") or "esgoto").strip().lower()
    n_barras = math.ceil(ext / 6) if ext > 0 else 1

    materiais = [
        {"descricao": f"Tubo {material_rede} DN{dn}mm", "unidade": "barra", "quantidade": n_barras},
        {"descricao": f"Luva correr {material_rede} DN{dn}mm", "unidade": "pc", "quantidade": max(n_barras - 1, 0)},
        {"descricao": f"Anel borracha DN{dn}mm", "unidade": "pc", "quantidade": n_barras + 1},
        {"descricao": "Pasta lubrificante", "unidade": "kg", "quantidade": round(n_barras * 0.04, 2)},
        {"descricao": "Areia lastro", "unidade": "m3", "quantidade": round(ext * 0.08, 2)},
        {"descricao": "Areia envoltoria", "unidade": "m3", "quantidade": round(ext * 0.24, 2)},
        {"descricao": "Brita dreno", "unidade": "m3", "quantidade": round(ext * 0.16, 2)},
        {"descricao": "PV concreto DN1200", "unidade": "pc", "quantidade": 1},
    ]
    if tipo == "esgoto":
        materiais.extend(
            [
                {"descricao": "Ramal esgoto DN100", "unidade": "pc", "quantidade": 1},
                {"descricao": "Caixa inspecao", "unidade": "pc", "quantidade": 1},
                {"descricao": f"Juncao Y {material_rede} DN{dn}x100mm", "unidade": "pc", "quantidade": 1},
            ]
        )
    return materiais


def normalizar_materiais(
    value: str | list[Any] | tuple[Any, ...] | dict[str, Any] | None,
    trecho: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except Exception:
            value = None

    if isinstance(value, dict):
        value = value.get("materiais") or value.get("items") or []

    materiais: list[dict[str, Any]] = []
    if isinstance(value, (list, tuple)):
        for item in value:
            if isinstance(item, dict):
                descricao = item.get("descricao") or item.get("material") or item.get("nome")
                unidade = item.get("unidade") or item.get("un") or item.get("tipo_unidade")
                quantidade = item.get("quantidade")
                quantidade_float = _coerce_float(quantidade)
                if descricao and unidade and quantidade is not None:
                    materiais.append(
                        {
                            "descricao": str(descricao),
                            "unidade": str(unidade),
                            "quantidade": quantidade_float if quantidade_float is not None else quantidade,
                        }
                    )
            elif isinstance(item, (list, tuple)) and len(item) >= 3:
                quantidade_float = _coerce_float(item[2])
                materiais.append(
                    {
                        "descricao": str(item[0]),
                        "unidade": str(item[1]),
                        "quantidade": quantidade_float if quantidade_float is not None else item[2],
                    }
                )

    if materiais:
        return materiais
    return calcular_materiais_padrao(trecho)


def resumo_materiais(materiais: list[dict[str, Any]], limite: int = 3) -> str:
    if not materiais:
        return ""
    amostra = materiais[:limite]
    texto = ", ".join(
        f"{formatar_quantidade_material(item.get('quantidade'))} {item.get('unidade')} {item.get('descricao')}"
        for item in amostra
    )
    restantes = len(materiais) - len(amostra)
    if restantes > 0:
        texto += f" + {restantes} itens"
    return texto
