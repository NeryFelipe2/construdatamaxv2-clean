# -*- coding: utf-8 -*-
"""Nota de Serviço em PDF — 1 página por NS: desenho do trecho + cronograma +
materiais + equipe (composição). Usa matplotlib (Agg) -> PDF multipágina.
"""
import math
from .medicao import medir_trecho, PROF_PADRAO


def _coords(geom):
    if geom is None:
        return []
    if geom.geom_type == "LineString":
        return [list(geom.coords)]
    return [list(g.coords) for g in geom.geoms]


def materiais_trecho(comp_m, sistema, dn_mm=None):
    """Materiais/serviços do trecho: BOM detalhada (enxertada do motor V5,
    gerar_ns.calcular_materiais) + volumes de terraplenagem (regras pro_sane).
    Retorna [(item, quantidade, unidade)]."""
    sis = str(sistema).upper()
    dn = int(dn_mm) if dn_mm else (200 if sis == "ESGOTO" else 100)
    prof = PROF_PADRAO.get(sis, 1.5)
    q = medir_trecho(comp_m, prof_med=prof, dn_mm=dn_mm)
    n_barras = math.ceil(comp_m / 6) if comp_m > 0 else 1
    itens = [
        ("Tubo PVC DN%d %s" % (dn, sistema.lower()), round(comp_m, 1), "m"),
        ("  └ barras 6 m", n_barras, "barra"),
        ("Luva correr PVC DN%d" % dn, max(n_barras - 1, 0), "pç"),
        ("Anel borracha DN%d" % dn, n_barras + 1, "pç"),
        ("Pasta lubrificante", round(n_barras * 0.04, 2), "kg"),
        ("Escavação", q["escav_m3"], "m³"),
        ("Reaterro", q["reaterro_m3"], "m³"),
        ("Lastro (areia)", q["lastro_m3"], "m³"),
        ("Brita", q["brita_m3"], "m³"),
    ]
    if sis == "ESGOTO":
        itens += [("Poço de visita DN1200", 1, "un"),
                  ("Ramal esgoto DN100", 1, "un"),
                  ("Caixa de inspeção", 1, "un"),
                  ("Junção Y PVC DN%dx100" % dn, 1, "un")]
    return itens


def _fmt(d):
    return d.strftime("%d/%m/%Y") if hasattr(d, "strftime") else str(d)


def gerar_pdf_ns(ns_list, contexto_geoms, equipes, caminho):
    """ns_list: [{ns, sistema, nucleo, equipe, rua, comp, produt, inicio, fim, geom, materiais}].
    contexto_geoms: geometrias de fundo (rede toda) p/ situar o trecho.
    equipes: {nome: [(pessoa, função)]}. Escreve PDF multipágina e retorna o caminho."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_pdf import PdfPages

    with PdfPages(str(caminho)) as pdf:
        for ns in ns_list:
            fig = plt.figure(figsize=(8.27, 11.69))   # A4 retrato
            fig.suptitle("NOTA DE SERVIÇO  %s  —  %s" % (ns["ns"], ns["sistema"]),
                         fontsize=15, fontweight="bold")
            gs = fig.add_gridspec(3, 1, height_ratios=[0.5, 3.0, 2.3], hspace=0.28,
                                  left=0.07, right=0.95, top=0.93, bottom=0.04)

            axh = fig.add_subplot(gs[0]); axh.axis("off")
            axh.text(0, 0.65, "Núcleo: %s     Equipe: %s     Rua: %s"
                     % (ns.get("nucleo", ""), ns.get("equipe", ""), ns.get("rua") or "—"), fontsize=10)
            axh.text(0, 0.15, "Início: %s     Fim: %s     Extensão: %.1f m     Produtividade: %s"
                     % (_fmt(ns["inicio"]), _fmt(ns["fim"]), ns["comp"], ns.get("produt", "")), fontsize=10)

            axm = fig.add_subplot(gs[1])
            for g in contexto_geoms:
                for cc in _coords(g):
                    axm.plot([p[0] for p in cc], [p[1] for p in cc], color="0.82", lw=0.7)
            allx, ally = [], []
            for cc in _coords(ns["geom"]):
                xs = [p[0] for p in cc]; ys = [p[1] for p in cc]
                axm.plot(xs, ys, color="red", lw=3.0, solid_capstyle="round")
                axm.plot(xs[0], ys[0], "o", color="green", ms=7)
                axm.plot(xs[-1], ys[-1], "s", color="blue", ms=7)
                allx += xs; ally += ys
            if allx:
                cx = (max(allx) + min(allx)) / 2; cy = (max(ally) + min(ally)) / 2
                mg = max(max(allx) - min(allx), max(ally) - min(ally), 40) * 0.65 + 25
                axm.set_xlim(cx - mg, cx + mg); axm.set_ylim(cy - mg, cy + mg)
            axm.set_aspect("equal"); axm.tick_params(labelsize=6)
            axm.set_title("Desenho do trecho  (vermelho = a executar · ● início · ■ fim)", fontsize=10)

            axt = fig.add_subplot(gs[2]); axt.axis("off")
            y = 0.99
            axt.text(0, y, "EQUIPE  (%s):" % ns.get("equipe", ""), fontsize=10.5, fontweight="bold")
            y -= 0.075
            for pessoa, func in equipes.get(ns.get("equipe"), []):
                axt.text(0.02, y, "•  %s — %s" % (pessoa, func), fontsize=9); y -= 0.052
            y2 = 0.99
            axt.text(0.55, y2, "MATERIAIS / SERVIÇOS:", fontsize=10.5, fontweight="bold")
            y2 -= 0.075
            for item, q, u in ns.get("materiais", []):
                axt.text(0.57, y2, "•  %s:  %s %s" % (item, q, u), fontsize=9); y2 -= 0.052
            axt.text(0.55, max(y2 - 0.04, 0.05), "Status: ___________   Assinatura encarregado: ___________",
                     fontsize=8.5)

            pdf.savefig(fig); plt.close(fig)
    return str(caminho)
