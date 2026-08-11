# -*- coding: utf-8 -*-
"""Config por núcleo do motor único (planejamento.pipeline). Cada entrada é tudo
que o pipeline precisa pra planejar um núcleo: fonte (gpkg), equipes+composição,
produtividade, datas, saídas. Editar AQUI = único lugar (sem script descartável).
Rodar: `python -m planejamento.runner <chave>`  (ex.: boi_malhado_esgoto)."""

WCR = r"C:\Users\felip\Desktop\_ORGANIZADO\26-WCR SANEAMENTO"
SHP = WCR + r"\SHAPEFILE_BOI_MALHADO_FEITO_A_FAZER_VERSAO_CLAUDE"
RET = WCR + r"\SHAPEFILE_RETORNO_PLANEJAMENTO"
OBS = r"C:\Users\felip\Desktop\_ORGANIZADO\WCR"  # notas no mesmo vault (_ORGANIZADO)

# composição de equipes (confirmada pelo RDO 23/06)
ISRAEL = [("Israel Neves", "Encarregado"), ("Edison", "Líder"), ("João de Jesus", "Líder"),
          ("Almir Gomes", "Ajudante"), ("Everton", "Ajudante"), ("Marcelo", "Encanador"),
          ("Diego Jhonson", "Encanador"), ("Pedro Silva", "Pedreiro"), ("Heliel Silva", "Encanador"),
          ("Marcos José", "Encanador/Motorista")]
WELLINGTON = [("Wellington", "Encarregado"), ("Rodrigo", "Líder"), ("Leo", "Líder"),
              ("Regis", "Pedreiro"), ("Igor", "Ajudante"), ("Juan", "Operador"),
              ("Márcio", "Ajudante"), ("Cícero", "Ajudante"), ("Maurício", "Pedreiro")]
JAILTON = [("Jailton", "Encarregado")]  # roster a confirmar

NUCLEOS = {
    "boi_malhado_esgoto": {
        "nucleo": "Boi Malhado", "sistema": "esgoto",
        "gpkg": SHP + r"\ESGOTO BOI MALHADO A FAZER.gpkg",
        "saida_dir": WCR, "obsidian_dir": OBS,
        "prefixo": "NS ESGOTO", "dn_padrao": "DN200",
        "produtividade": 286 / 6.0, "data_inicio": (2026, 6, 24),
        "equipe_campo": "Equipe", "ordem_campo": "Ordem_exec",
        "equipes": {
            "1": {"nome": "Equipe 1 - Israel", "lider": "Israel", "crew": ISRAEL},
            "2": {"nome": "Equipe 2 - Wellington", "lider": "Wellington", "crew": WELLINGTON},
        },
        "cor": "#6d4c41", "fundo": [],
        "arq_project": "CRONOGRAMA_ESGOTO_MSPROJECT.xml",
        "arq_planilha": "NS_ESGOTO_PLANILHA.xlsx",
        "arq_ns": "NS_ESGOTO_BOI_MALHADO.pdf",
    },
    "retorno_agua": {
        "nucleo": "Comunidade do Retorno", "sistema": "agua",
        "gpkg": RET + r"\AGUA RETORNO A FAZER.gpkg",
        "saida_dir": WCR, "obsidian_dir": OBS,
        "prefixo": "NS ÁGUA", "dn_padrao": "63PEAD", "metodo": "MND",
        "produtividade": 300.0, "data_inicio": (2026, 6, 29),
        "equipe_campo": None, "ordem_campo": "Ordem_exec",
        "equipes": {"Jailton": {"nome": "Equipe Jailton", "lider": "Jailton", "crew": JAILTON}},
        "cor": "#0d47a1", "fundo": [],
        "arq_project": "CRONOGRAMA_AGUA_RETORNO_MSPROJECT.xml",
        "arq_planilha": "NS_AGUA_RETORNO_PLANILHA.xlsx",
        "arq_ns": "NS_AGUA_RETORNO.pdf",
    },
    "retorno_esgoto": {
        "nucleo": "Comunidade do Retorno", "sistema": "esgoto",
        "gpkg": RET + r"\ESGOTO RETORNO A FAZER.gpkg",
        "saida_dir": WCR, "obsidian_dir": OBS,
        "prefixo": "NS ESGOTO RET", "dn_padrao": "DN200",
        "produtividade": 286 / 6.0, "data_inicio": (2026, 7, 6),
        "equipe_campo": "Equipe", "ordem_campo": "Ordem_exec",
        "equipes": {"Jailton": {"nome": "Equipe Jailton (esgoto)", "lider": "Jailton", "crew": JAILTON}},
        "cor": "#4e342e", "fundo": [],
        "arq_project": "CRONOGRAMA_ESGOTO_RETORNO_MSPROJECT.xml",
        "arq_planilha": "NS_ESGOTO_RETORNO_PLANILHA.xlsx",
        "arq_ns": "NS_ESGOTO_RETORNO.pdf",
    },
}
