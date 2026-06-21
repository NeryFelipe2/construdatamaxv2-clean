"""Resumo normalizado e determinístico de uma rede lida — base do teste golden."""
from typing import Dict, List


def resumo_rede(pvs: Dict[str, dict], trechos: List[dict]) -> dict:
    chaves = sorted(
        f"{t.get('pv_ini')}->{t.get('pv_fim')}|dn={t.get('dn_mm')}|ext={round(float(t.get('ext_m') or 0), 1)}"
        for t in trechos
    )
    return {
        "n_pvs": len(pvs),
        "n_trechos": len(trechos),
        "pvs": sorted(str(k) for k in pvs.keys()),
        "trechos": chaves,
    }
