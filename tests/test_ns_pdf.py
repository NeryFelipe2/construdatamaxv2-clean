import pytest


def test_materiais_trecho():
    from planejamento.ns_pdf import materiais_trecho
    d = {item: q for item, q, u in materiais_trecho(100.0, "ESGOTO")}   # prof 1.5, largura 0.6
    assert any("Tubo" in k for k in d)
    assert d["Escavação"] == 90.0
    assert d["Lastro (areia)"] == 9.0


def test_gerar_pdf_ns_cria_arquivo(tmp_path):
    pytest.importorskip("matplotlib")
    pytest.importorskip("shapely")
    from shapely.geometry import LineString
    from datetime import date
    from planejamento.ns_pdf import gerar_pdf_ns, materiais_trecho
    g = LineString([(0, 0), (50, 0)])
    ns = [{"ns": "NS001", "sistema": "ESGOTO", "nucleo": "BOI MALHADO", "equipe": "Israel",
           "rua": "Rua 2", "comp": 50.0, "produt": "25 m/dia",
           "inicio": date(2026, 6, 22), "fim": date(2026, 6, 23), "geom": g,
           "materiais": materiais_trecho(50.0, "ESGOTO")}]
    equipes = {"Israel": [("Israel Neves", "Operador"), ("Edson", "Líder")]}
    out = tmp_path / "ns.pdf"
    gerar_pdf_ns(ns, [g], equipes, str(out))
    assert out.exists() and out.stat().st_size > 1000
