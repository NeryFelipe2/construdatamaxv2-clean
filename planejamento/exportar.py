"""Exportadores da rede extraída: GeoJSON (vetor limpo) e re-layer DXF.

- exportar_geojson: PVs (pontos) + trechos (linhas) com atributos. Zero deps.
- relayer_dxf: lê a rede de um DXF fora do padrão (ex.: rede no layer '0') via
  leitor_rede e grava um DXF NOVO com a rede num layer NOMEADO -> passa a ser
  lido em modo conservador (corrige a origem do "tubos fantasmas").
"""
import json


def exportar_geojson(pvs, trechos, caminho):
    """Grava a rede como GeoJSON (FeatureCollection). Retorna nº de features."""
    feats = []
    for nome, p in pvs.items():
        if p.get("x") is None or p.get("y") is None:
            continue
        feats.append({
            "type": "Feature",
            "properties": {"id": str(nome), "tipo": "PV",
                           "generico": bool(p.get("_generico"))},
            "geometry": {"type": "Point", "coordinates": [p["x"], p["y"]]},
        })
    for t in trechos:
        a = pvs.get(t.get("pv_ini")), pvs.get(t.get("pv_fim"))
        if not a[0] or not a[1]:
            continue
        feats.append({
            "type": "Feature",
            "properties": {"pv_ini": t.get("pv_ini"), "pv_fim": t.get("pv_fim"),
                           "dn_mm": t.get("dn_mm"), "ext_m": t.get("ext_m")},
            "geometry": {"type": "LineString",
                         "coordinates": [[a[0]["x"], a[0]["y"]], [a[1]["x"], a[1]["y"]]]},
        })
    fc = {"type": "FeatureCollection", "features": feats}
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False)
    return len(feats)


def relayer_dxf(dxf_in, dxf_out, layers_rede, layer_rede="REDE_ESGOTO"):
    """Lê a rede de `layers_rede` e grava um DXF limpo com ela em `layer_rede`.

    O DXF de saída passa a ser lido em modo conservador (layer nomeado).
    Retorna dict com contagem e meta de origem.
    """
    import ezdxf
    from .leitor_rede import ler_rede

    pvs, trechos, _ruas, meta = ler_rede(str(dxf_in), layers_rede=layers_rede)

    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    for ly in (layer_rede, "PS_PONTOS_IDENTIFICACAO_TXT", "DIAMETRO"):
        if ly not in doc.layers:
            doc.layers.add(ly)

    for t in trechos:
        a = pvs.get(t.get("pv_ini"))
        b = pvs.get(t.get("pv_fim"))
        if not a or not b:
            continue
        msp.add_line((a["x"], a["y"]), (b["x"], b["y"]), dxfattribs={"layer": layer_rede})
        if t.get("dn_mm"):
            mx, my = (a["x"] + b["x"]) / 2.0, (a["y"] + b["y"]) / 2.0
            msp.add_text("DN%s" % t["dn_mm"], dxfattribs={"layer": "DIAMETRO"}).set_placement((mx, my))

    for nome, p in pvs.items():
        if p.get("x") is None:
            continue
        msp.add_point((p["x"], p["y"]), dxfattribs={"layer": "PS_PONTOS_IDENTIFICACAO_TXT"})
        msp.add_text(str(nome), dxfattribs={"layer": "PS_PONTOS_IDENTIFICACAO_TXT"}).set_placement((p["x"], p["y"]))

    doc.saveas(str(dxf_out))
    return {"n_pvs": len(pvs), "n_trechos": len(trechos),
            "saida": str(dxf_out), "layer_rede": layer_rede, "origem": meta}
