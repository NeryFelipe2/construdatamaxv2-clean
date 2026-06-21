from planejamento.modelo import NotaServico, Atividade, TipoServico
from planejamento.rdo import (aplicar_rdo, comparar_ns, produtividade_realizada,
                              registro_base)
from planejamento.produtividade import prever_produtividade


def _ns():
    ns = NotaServico(ns_id="NS001", descricao="R", nucleo="TATUI")
    ns.atividades = [Atividade(TipoServico.ASSENTAMENTO_TUBO, "rede", 100.0, "m")]
    ns.atividades[0].produtiv_prev = 20.0          # plano: 20 m/dia
    return ns


def test_comparar_detecta_atraso():
    ns = _ns()
    aplicar_rdo(ns, {"assentamento_tubo": 30.0})   # executou 30 m
    L = comparar_ns(ns, dia_corrente=2)            # planejado = 20*2 = 40
    assert L[0]["planejado"] == 40.0 and L[0]["realizado"] == 30.0
    assert L[0]["desvio"] == -10.0 and L[0]["status"] == "ATRASADO"
    assert L[0]["pct"] == 30.0


def test_realizado_realimenta_a_base():
    ns = _ns()
    aplicar_rdo(ns, {"assentamento_tubo": 54.0})   # 54 m em 3 dias -> 18 m/dia
    assert produtividade_realizada(54.0, 3) == 18.0
    reg = registro_base(ns, ns.atividades[0], dias=3, dn=150)
    assert reg["produtividade"] == 18.0 and reg["tipo_servico"] == "assentamento_tubo"

    # LOOP C->B: o realizado vira base e a previsão passa a usá-lo
    r = prever_produtividade({"tipo_servico": "assentamento_tubo", "dn": 150, "cidade": "TATUI"}, [reg])
    assert r["fonte"] == "analogia" and r["produtividade"] == 18.0
