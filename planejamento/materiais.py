"""Lista de material a partir da rede (colunas do LST_MAT.DEF do pro_sane:
Num | Quant. | Und. | Dimensão | Código | Descrição)."""
from collections import defaultdict


def _material_de(trecho, default):
    lay = str(trecho.get("layer", "")).upper()
    if "PEAD" in lay or "PE_" in lay or "PE80" in lay or "PE100" in lay:
        return "PEAD"
    if "CONC" in lay or "CA " in lay or "_CA" in lay:
        return "CONCRETO"
    if "FC" in lay or "CIMENTO" in lay:
        return "FC"
    return trecho.get("material") or default


def lista_material(trechos, pvs, material_default="PVC"):
    """Agrega tubos por (material, DN) e conta PVs. Retorna linhas no padrão LST_MAT."""
    por_dn = defaultdict(float)
    for t in trechos:
        dn = t.get("dn_mm")
        mat = _material_de(t, material_default)
        por_dn[(mat, dn)] += float(t.get("ext_m") or 0.0)

    linhas = []
    n = 1
    for (mat, dn), ext in sorted(por_dn.items(), key=lambda kv: (kv[0][0], kv[0][1] or 0)):
        dim = "DN%s" % dn if dn else "s/DN"
        linhas.append({"num": n, "quant": round(ext, 2), "und": "m",
                       "dimensao": dim, "codigo": "", "descricao": "Tubo %s %s" % (mat, dim)})
        n += 1

    n_pv = len(pvs)
    if n_pv:
        linhas.append({"num": n, "quant": n_pv, "und": "un", "dimensao": "",
                       "codigo": "", "descricao": "Poço de Visita / Caixa"})
    return linhas
