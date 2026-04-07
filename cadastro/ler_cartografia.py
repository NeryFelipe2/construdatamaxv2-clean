"""
Extrai polilinhas de fundo (ruas/quadras/lotes) de um DWG/DXF para cartografia.
Saida no formato consumido por cadastro/folha_a4.draw_cartografia_dxf:
    [{'pontos': [(e,n),...], 'layer': str}, ...]
"""
from pathlib import Path

KEEP = ("RUA", "QUADRA", "LOTE", "MEIO", "CALC", "CALÇ", "CONTORNO",
        "LIMITE", "DIVISA", "EDIF", "CASA", "PAVIMENT", "VIA", "MURO")
SKIP = ("TUBO", "REDE", "ESGOTO", "AGUA", "ÁGUA", "PV_", "POCO", "POÇO")


def _quer_layer(layer: str) -> bool:
    L = (layer or "").upper()
    if any(s in L for s in SKIP):
        return False
    return any(k in L for k in KEEP)


def _ler_dxf(dxf_path: str) -> list:
    import ezdxf
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    out = []
    for e in msp:
        t = e.dxftype()
        if t not in ("LWPOLYLINE", "POLYLINE", "LINE"):
            continue
        layer = e.dxf.layer
        if not _quer_layer(layer):
            continue
        try:
            if t == "LWPOLYLINE":
                pts = [(p[0], p[1]) for p in e.get_points("xy")]
            elif t == "POLYLINE":
                pts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
            else:  # LINE
                pts = [(e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y)]
        except Exception:
            continue
        if len(pts) < 2:
            continue
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        if (max(xs) - min(xs)) > 5000 or (max(ys) - min(ys)) > 5000:
            continue  # lixo de georref
        out.append({"pontos": pts, "layer": layer})
    return out


def _ler_gpkg(path: str) -> list:
    """Le geopackage de export QGIS de DXF (lines/polylines/hatches)."""
    try:
        import pyogrio
    except ImportError:
        print("[ler_cartografia] pyogrio nao instalado")
        return []
    out = []
    try:
        layers_arr = pyogrio.list_layers(path)
    except Exception as e:
        print(f"[ler_cartografia] erro list_layers: {e}")
        return []
    # so geometrias 2d/3d, ignora tabelas auxiliares
    geom_layers = [str(row[0]) for row in layers_arr if row[1] and "None" not in str(row[1])]
    alvos = [n for n in geom_layers if n in ("lines", "polylines", "hatches")]
    for layer_name in alvos:
        try:
            gdf = pyogrio.read_dataframe(path, layer=layer_name)
        except Exception as e:
            print(f"[ler_cartografia] erro ler {layer_name}: {e}")
            continue
        # coluna do layer CAD original (se vier)
        cad_col = next((c for c in ("Layer", "layer", "LAYER") if c in gdf.columns), None)
        for idx, geom in enumerate(gdf.geometry):
            if geom is None:
                continue
            cad_layer = str(gdf[cad_col].iloc[idx]) if cad_col else layer_name
            if cad_col and not _quer_layer(cad_layer):
                continue
            gtype = geom.geom_type
            def _push(pts, lyr=cad_layer):
                if len(pts) < 2:
                    return
                xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
                if (max(xs) - min(xs)) > 5000 or (max(ys) - min(ys)) > 5000:
                    return  # lixo de georref
                out.append({"pontos": pts, "layer": lyr})
            try:
                if gtype in ("LineString", "LinearRing"):
                    _push([(p[0], p[1]) for p in geom.coords])
                elif gtype == "MultiLineString":
                    for ls in geom.geoms:
                        _push([(p[0], p[1]) for p in ls.coords])
                elif gtype == "Polygon":
                    _push([(p[0], p[1]) for p in geom.exterior.coords])
                elif gtype == "MultiPolygon":
                    for poly in geom.geoms:
                        _push([(p[0], p[1]) for p in poly.exterior.coords])
            except Exception:
                continue
    return out


def ler_cartografia(path: str) -> list:
    p = Path(path)
    if not p.exists():
        return []
    ext = p.suffix.lower()
    if ext == ".dxf":
        return _ler_dxf(str(p))
    if ext == ".gpkg":
        return _ler_gpkg(str(p))
    if ext == ".dwg":
        # reusa conversor ODA do projeto
        try:
            import sys
            sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
            from ler_dwg_universal import _converter_dwg_dxf_oda
        except Exception as e:
            print(f"[ler_cartografia] sem conversor DWG: {e}")
            return []
        dxf_tmp = _converter_dwg_dxf_oda(str(p))
        if not dxf_tmp:
            return []
        return _ler_dxf(dxf_tmp)
    return []
