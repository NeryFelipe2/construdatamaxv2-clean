# -*- coding: utf-8 -*-
"""Composição das equipes WCR Boi Malhado — fonte: RDOs oficiais do construdata
(DIARIO_OBRA_BOI_MALHADO_2026-06-12/13). Chaveado pelos rótulos usados nas NS.

Frentes:
  ÁGUA  -> 'Jesse'        (líder Renan)  — assentamento de rede + ligações
  ESGOTO-> 'Wellington'   (líder Rodrigo)
  ESGOTO-> 'Zé Glaudino'  (líder José Glaudino, alias 'Wellington 2')
Apoio (não recebe NS de assentamento): 'Robert/Edson' (op retro Israel).
"""

# rótulo -> líder
LIDER = {
    "Jesse": "Renan",
    "Wellington": "Rodrigo",
    "Zé Glaudino": "José Glaudino",
    "Robert/Edson": "Edson e João (Robert encarregado)",
}

# rótulo -> sistema
SISTEMA = {"Jesse": "AGUA", "Wellington": "ESGOTO",
           "Zé Glaudino": "ESGOTO", "Robert/Edson": "ESGOTO"}

# rótulo -> composição [(nome, função)] (líder primeiro)
EQUIPES = {
    "Jesse": [
        ("Renan", "Líder/Operador"), ("Kaue", "Soldador"),
        ("Christyan Richard", "Encanador"), ("Danilo", "Ajudante"),
        ("Patrick", "Ajudante"), ("Paulo Henrique", "Ajudante"), ("Fábio", "Ajudante"),
    ],
    "Wellington": [
        ("Rodrigo", "Líder"), ("Pedreiro 1", "Pedreiro"), ("Pedreiro 2", "Pedreiro"),
        ("Ajudante 1", "Ajudante"), ("Ajudante 2", "Ajudante"), ("Operador", "Operador (retro/MND)"),
    ],
    "Zé Glaudino": [
        ("José Glaudino", "Líder"), ("Juan", "Operador"), ("Cícero", "Ajudante"),
        ("Márcio", "Ajudante"), ("Maurício", "Pedreiro"), ("Felipe", "Pedreiro"),
    ],
    "Robert/Edson": [
        ("Edson", "Líder"), ("João", "Líder"), ("Israel", "Operador (retro)"),
        ("Pedro", "Pedreiro"), ("Almir", "Ajudante"), ("Diego", "Encanador"),
        ("Marcelo", "Encanador"), ("Marcos", "Motorista"),
    ],
}

# frentes de apoio de ÁGUA (não recebem NS de assentamento, registradas p/ referência)
EQUIPES_AGUA_APOIO = {
    "Mazinho": [("Mazinho", "Líder"), ("Michael", "Pedreiro"), ("Leonardo", "Pedreiro"),
                ("Marcos", "Ajudante"), ("Felipe", "Pedreiro")],
    "Ediel": [("Ediel", "Líder"), ("Serafim", "Ajudante"), ("Ederson", "Motorista"),
              ("Anderson", "Ajudante"), ("Damião", "Pedreiro"), ("Leonardo", "Ajudante")],
}


def composicao(rotulo):
    """Composição da frente pelo rótulo da NS (cai no apoio se preciso)."""
    return EQUIPES.get(rotulo) or EQUIPES_AGUA_APOIO.get(rotulo) or []


def composicao_fuzzy(texto):
    """Resolve a composição a partir de um rótulo descritivo do apontamento
    (ex.: 'Wellington 2 (líder José Glaudino)') por palavra-chave. '' se nada casar."""
    t = str(texto or "").lower()
    if "glaudino" in t or "wellington 2" in t:
        return EQUIPES["Zé Glaudino"]
    if "wellington" in t:
        return EQUIPES["Wellington"]
    if "renan" in t or ("jesse" in t and "mazinho" not in t):
        return EQUIPES["Jesse"]
    if "mazinho" in t:
        return EQUIPES_AGUA_APOIO["Mazinho"]
    if "ediel" in t:
        return EQUIPES_AGUA_APOIO["Ediel"]
    if "robert" in t or "edson" in t:
        return EQUIPES["Robert/Edson"]
    return composicao(texto)


def lider(rotulo):
    return LIDER.get(rotulo, "")
