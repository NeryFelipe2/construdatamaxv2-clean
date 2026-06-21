"""Abas de config/input humano da planilha-mestre (CAPA, PESSOAL, ALOCACAO,
PREMISSAS) — geradas como template já preenchido com o que os motores sabem
(núcleo, equipes, produtividades) para o time só ajustar."""

CAPA_COLS = [{"campo": "k", "titulo": "Campo"}, {"campo": "v", "titulo": "Valor"}]
PESSOAL_COLS = [{"campo": "equipe", "titulo": "Equipe"},
                {"campo": "encarregado", "titulo": "Encarregado"},
                {"campo": "sistema", "titulo": "Sistema"},
                {"campo": "funcao", "titulo": "Função"}]
ALOCACAO_COLS = [{"campo": "equipe", "titulo": "Equipe"},
                 {"campo": "sistema", "titulo": "Sistema"},
                 {"campo": "frente", "titulo": "Frente"}]
PREMISSAS_COLS = [{"campo": "k", "titulo": "Premissa"}, {"campo": "v", "titulo": "Valor"}]


def abas_config(nucleo="", equipes=None, premissas=None):
    """equipes = [{equipe, encarregado?, sistema?, funcao?}]; premissas = dict."""
    equipes = equipes or []
    premissas = premissas or {}
    abas = []

    capa = [{"k": "Obra / Núcleo", "v": nucleo},
            {"k": "Documento", "v": "PLANEJAMENTO — MASTER"},
            {"k": "Gerado por", "v": "motores de planejamento V5"}]
    abas.append({"nome": "CAPA", "colunas": CAPA_COLS, "linhas": capa, "titulo": "CAPA"})

    pes = [{"equipe": e.get("equipe"), "encarregado": e.get("encarregado", e.get("equipe")),
            "sistema": e.get("sistema", ""), "funcao": e.get("funcao", "Encarregado")}
           for e in equipes]
    abas.append({"nome": "PESSOAL", "colunas": PESSOAL_COLS, "linhas": pes, "titulo": "PESSOAL"})

    alo = [{"equipe": e.get("equipe"), "sistema": e.get("sistema", ""), "frente": nucleo}
           for e in equipes]
    abas.append({"nome": "ALOCACAO", "colunas": ALOCACAO_COLS, "linhas": alo, "titulo": "ALOCAÇÃO"})

    pre = [{"k": k, "v": v} for k, v in premissas.items()]
    abas.append({"nome": "PREMISSAS", "colunas": PREMISSAS_COLS, "linhas": pre, "titulo": "PREMISSAS"})

    return abas
