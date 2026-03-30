"""Leitura opcional de base topografica DXF/GPKG para o cadastro."""
from __future__ import annotations

from pathlib import Path
from typing import Any

LAYERS_BASE_TOPO = [
    "LT-LOTE",
    "LT-QUADRA",
    "LT-LOGRADOURO",
    "LT-CURVA-NIVEL",
]


def extrair_base_topografica(dxf_path: str | None = None, gpkg_path: str | None = None) -> dict[str, Any]:
    """
    Extrai uma base topografica minima.

    A implementacao e resiliente: se geopandas/ezdxf nao estiverem disponiveis,
    devolve uma estrutura vazia mas consistente.
    """
    resultado: dict[str, Any] = {
        "layers": {layer: [] for layer in LAYERS_BASE_TOPO},
        "fontes": {"dxf": dxf_path, "gpkg": gpkg_path},
        "resumo": {layer: 0 for layer in LAYERS_BASE_TOPO},
    }

    if gpkg_path:
        try:  # pragma: no cover - dependencia opcional
            import geopandas as gpd

            for layer in LAYERS_BASE_TOPO:
                try:
                    gdf = gpd.read_file(gpkg_path, layer=layer)
                    resultado["layers"][layer] = json_like_records(gdf)
                    resultado["resumo"][layer] = len(gdf)
                except Exception:
                    continue
        except Exception:
            pass

    if dxf_path and Path(dxf_path).exists():
        try:  # pragma: no cover - dependencia opcional
            import ezdxf

            doc = ezdxf.readfile(dxf_path)
            msp = doc.modelspace()
            for entity in msp:
                layer = entity.dxf.layer if hasattr(entity, "dxf") else ""
                if layer in resultado["layers"]:
                    resultado["layers"][layer].append({"type": entity.dxftype(), "layer": layer})
                    resultado["resumo"][layer] += 1
        except Exception:
            pass

    return resultado


def json_like_records(gdf) -> list[dict[str, Any]]:
    """Converte GeoDataFrame em registros simples serializaveis."""
    records = []
    for _, row in gdf.iterrows():
        item = row.to_dict()
        if "geometry" in item and item["geometry"] is not None:
            item["geometry_wkt"] = item["geometry"].wkt
            item.pop("geometry", None)
        records.append(item)
    return records
