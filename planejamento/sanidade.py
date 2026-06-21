"""Sanity-check anti-invenção da rede lida do CAD.

Recebe as estruturas já lidas (não lê DXF) e devolve uma lista de avisos
legíveis. Vazia = rede confiável. É a trava para o bug histórico de
"tubos fantasmas" (inventar/perder rede por tolerância de snap).
"""
from typing import Dict, List, Optional

# Limiares (centralizar em config/INI numa fase futura)
MAX_TRECHOS_POR_PV = 4.0     # acima disso, provável invenção
EXT_MAX_M = 1000.0           # trecho único > 1 km em rede urbana é suspeito
EXT_MIN_M = 0.5              # trecho < 0,5 m é ruído


def checar_sanidade(pvs: Dict[str, dict], trechos: List[dict],
                    meta: Optional[dict] = None) -> List[str]:
    avisos: List[str] = []
    ids = set(pvs.keys())

    # Sinal definitivo do leitor: meta["motor"] = "...(BRUTAL)" quando caiu no
    # modo que aceita qualquer linha como tubo (ler_dxf_gdal.py:1041).
    if meta and "BRUTAL" in str(meta.get("motor", "")):
        avisos.append(
            "Leitura em MODO BRUTAL (qualquer linha aceita como tubo) — "
            "alto risco de invenção de rede"
        )

    for t in trechos:
        pi, pf = t.get("pv_ini"), t.get("pv_fim")
        if pi not in ids:
            avisos.append(f"Trecho referencia PV inexistente: {pi}")
        if pf not in ids:
            avisos.append(f"Trecho referencia PV inexistente: {pf}")
        ext = t.get("ext_m")
        if ext is not None and ext > EXT_MAX_M:
            avisos.append(f"Extensão suspeita ({ext:.0f} m) em {pi}->{pf}")
        if ext is not None and ext < EXT_MIN_M:
            avisos.append(f"Extensão mínima ({ext:.2f} m) em {pi}->{pf}")

    n_pv = max(len(ids), 1)
    if len(trechos) / n_pv > MAX_TRECHOS_POR_PV:
        avisos.append(
            f"Trechos/PV = {len(trechos)/n_pv:.1f} (>{MAX_TRECHOS_POR_PV}): "
            f"possível invenção de rede ({len(trechos)} trechos, {len(ids)} PVs)"
        )

    com_dn = sum(1 for t in trechos if t.get("dn_mm"))
    if trechos and com_dn / len(trechos) < 0.2:
        avisos.append(
            f"Apenas {com_dn}/{len(trechos)} trechos têm DN: provável leitura em "
            f"modo brutal / sem camadas de rede (risco de invenção)"
        )
    return avisos
