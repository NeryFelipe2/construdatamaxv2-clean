import pytest


DIAS = [
    {"data": "2026-06-12", "apontador": "Leandro", "ocorrencias": ["Vazamento na Tv. X"],
     "servicos": [
         {"servico": "4 Ligações de Esgoto (LE)", "sistema": "esgoto", "local": "Rua 2",
          "quantidade": "4 LE", "equipe": "Wellington 2 (líder José Glaudino)"},
         {"servico": "27 ligações de água", "sistema": "agua", "local": "",
          "quantidade": "27 LA", "equipe": "Jesse (líder Renan)"},
     ]},
]


def test_data_br():
    from planejamento.rdo_doc import _data_br
    assert _data_br("2026-06-12") == "12/06/2026"
    assert _data_br("X") == "X"


def test_composicao_fuzzy_resolve_rotulo_descritivo():
    from planejamento.equipes import composicao_fuzzy
    nomes = [p for p, _f in composicao_fuzzy("Wellington 2 (líder José Glaudino)")]
    assert "Juan" in nomes and "José Glaudino" in nomes
    nomes2 = [p for p, _f in composicao_fuzzy("Jesse (líder Renan)")]
    assert "Renan" in nomes2


def test_gerar_rdo_pdf_cria_arquivo(tmp_path):
    pytest.importorskip("matplotlib")
    from planejamento.rdo_doc import gerar_rdo_pdf
    from planejamento.equipes import composicao_fuzzy
    out = tmp_path / "rdo.pdf"
    gerar_rdo_pdf(DIAS, str(out), composicao_fn=composicao_fuzzy)
    assert out.exists() and out.stat().st_size > 1000


def test_gerar_rdo_xlsx_abas(tmp_path):
    pytest.importorskip("openpyxl")
    import openpyxl
    from planejamento.rdo_doc import gerar_rdo_xlsx
    out = tmp_path / "rdo.xlsx"
    info = gerar_rdo_xlsx(DIAS, str(out))
    assert info["servicos"] == 2
    wb = openpyxl.load_workbook(out)
    assert set(["DIÁRIO", "RESUMO", "TEMPLATE"]) <= set(wb.sheetnames)
