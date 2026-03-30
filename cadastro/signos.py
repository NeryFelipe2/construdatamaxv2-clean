"""Simbologia SIGNOS SABESP usada no cadastro tecnico."""
from __future__ import annotations

SIGNOS_SABESP = {
    "PV_ESG": {"bloco": "PV_ESG", "descricao": "Poco de visita esgoto", "shape": "circulo_cheio"},
    "PV_AGUA": {"bloco": "PV_AGUA", "descricao": "Poco de visita agua", "shape": "circulo_vazio"},
    "TI": {"bloco": "TI", "descricao": "Terminal de inspecao", "shape": "triangulo"},
    "RG": {"bloco": "RG", "descricao": "Registro", "shape": "retangulo"},
    "VRP": {"bloco": "VRP", "descricao": "Valvula redutora de pressao", "shape": "losango"},
    "HI": {"bloco": "HI", "descricao": "Hidrante", "shape": "hexagono"},
}


def simbolo_por_elemento(tipo: str, is_agua: bool = False) -> dict:
    tipo_upper = (tipo or "PV").upper()
    if tipo_upper.startswith("TI"):
        return SIGNOS_SABESP["TI"]
    if tipo_upper.startswith("RG"):
        return SIGNOS_SABESP["RG"]
    return SIGNOS_SABESP["PV_AGUA" if is_agua else "PV_ESG"]
