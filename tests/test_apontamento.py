# -*- coding: utf-8 -*-
from planejamento.apontamento import parse_blocos, resumo

EXEMPLO = """MODELO DE APONTAMENTO DIÁRIO

Núcleo: Boi Malhado

Produção - DATA: 17/06/2026

Equipe (toda c/ função): Ze Glaudino

Zé Glaudino - Lider
Juan - Operador

Endereço (rua e casas):
Rua 2

60 - Finalizado
58 - Finalizado

— ESGOTO —

PRE (m): 15 metros
Prof: 2,00

PV: __
PI: __
LE: __
Caixa de inspeção: 4

— ÁGUA —

PRA (m): __
LA: __
HM: __
Caixa U.M.A: __
Interligação: __
Corte ramal antigo: __

RA: __
Solda eletrofusão: __
Instalação de válvula: __

Equipamentos utilizados: ______
Mini Escavadeira

Ocorrências: X

Obs: Caixas de Inspeção finalizadas com acabamento interno."""


def test_parse_exemplo_zegluadino():
    b = parse_blocos(EXEMPLO)
    assert len(b) == 1
    x = b[0]
    assert x["data"] == "2026-06-17"
    assert x["nucleo"] == "Boi Malhado"
    assert x["equipe"] == "Ze Glaudino"
    assert x["rua"] == "Rua 2"
    assert x["esgoto"]["pre_m"] == 15.0
    assert x["esgoto"]["prof"] == 2.0
    assert x["esgoto"]["caixa_insp"] == 4.0
    assert x["esgoto"]["le"] is None and x["esgoto"]["pv"] is None
    assert x["agua"]["pra_m"] is None and x["agua"]["ra"] is None
    assert x["equipamentos"] == "Mini Escavadeira"
    assert x["ocorrencias"] in (None, "X") or x["ocorrencias"] == "X"
    assert x["obs"].startswith("Caixas de Inspeção")


def test_resumo_soma():
    r = resumo(parse_blocos(EXEMPLO))
    assert r.get("esgoto_pre_m") == 15.0
    assert r.get("esgoto_caixa_insp") == 4.0
    assert "esgoto_le" not in r          # vazio não entra


DOIS = EXEMPLO + """

MODELO DE APONTAMENTO DIÁRIO

Núcleo: SÃO CLETO

Produção - DATA: 17/06/2026

Equipe (toda c/ função): Robert

— ÁGUA —

PRA (m): 10 metros
RA: 2
Solda eletrofusão: 4
"""


def test_resumo_por_nucleo_e_por_dia():
    from planejamento.apontamento import resumo_por_nucleo, por_dia, nucleo_norm
    b = parse_blocos(DOIS)
    assert len(b) == 2
    assert nucleo_norm("São Cleto") == "SÃO CLETO"
    assert nucleo_norm("Boi malhado x") == "BOI MALHADO"

    rn = resumo_por_nucleo(b)
    assert rn["BOI MALHADO"]["esgoto_pre_m"] == 15.0
    assert rn["SÃO CLETO"]["agua_pra_m"] == 10.0

    boi = por_dia(b, nucleo="BOI MALHADO")
    assert len(boi) == 1 and boi[0]["pre_m"] == 15.0 and boi[0]["nucleo"] == "BOI MALHADO"
