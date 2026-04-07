#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gerar_ns.py — Gerador de Notas de Servico · ConstruData SABESP v9
SE LIGA NA REDE · Contrato 11481051

TESTADO: 137 NS perfeitas no PANTANAL_ESGOTO.dxf
         165 PVs, 0 mismatch, 100% DN, 100% CT/CF

Saidas por trecho:
  01_NS_CAMPO/NS_XXX/  -> PDF A4 + DADOS.json
  03_DESENHOS/         -> PDF A3 planta(satelite) + perfil
  04_HTML/             -> Leaflet interativo + dados
  05_GIS/              -> GeoJSON EPSG:31983

Uso:
  python gerar_ns.py <arquivo.dxf> [pasta_saida]
  python gerar_ns.py   (usa NUCLEOS_BATCH do config)
"""
import sys, json, math, os, traceback, re
from pathlib import Path
from datetime import datetime
from collections import Counter

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
import numpy as np

from ler_dxf_gdal import ler_dxf_gdal
try:
    from ler_landxml import ler_landxml
    _HAS_LANDXML = True
except ImportError:
    _HAS_LANDXML = False

CONTRATO    = "11481051"
NS_VERSION  = "9"
CRS_EPSG    = "EPSG:31983"
_PROSANE_DIR = Path(r"C:\pro_sane")
if not _PROSANE_DIR.exists():
    _PROSANE_DIR = Path.home() / "Downloads" / "pro_sane"


# ── Helpers v9: estrutura CAMPO/PLANEJAMENTO ──────────────────────────────

def _criar_estrutura_v9(nucleo_upper, out_base):
    """Cria árvore CAMPO/ e PLANEJAMENTO/ para o núcleo.
    Retorna (campo_dir, planejamento_dir)."""
    base  = Path(out_base) / nucleo_upper
    campo = base / "CAMPO"
    plan  = base / "PLANEJAMENTO"
    for d in [campo,
              plan / "CRONOGRAMA", plan / "CUSTOS", plan / "OSE",
              plan / "BIM",        plan / "GIS",    plan / "MEDICAO",
              plan / "LOG"]:
        d.mkdir(parents=True, exist_ok=True)
    return campo, plan


def _ns_folder_name(seq, pv_ini, pv_fim):
    """Gera nome de pasta NS limpo: NS001_PV001_AO_PI054."""
    def _clean(s):
        return re.sub(r'[^\w]', '_', str(s)).strip('_')
    return f"NS{seq:03d}_{_clean(pv_ini)}_AO_{_clean(pv_fim)}"


def _ler_params_prosane():
    """Lê parâmetros opcionais de C:\\pro_sane\\*.DEF.
    Retorna dict com fallback para valores padrão se arquivos não encontrados."""
    params = {
        "n_manning": 0.013,   # PAR_ADD0.DAT (binário — valor fixo)
        "vala_m": 0.60,
        "lastro_m": 0.15,
        "bdi": 1.25,
        "decl_min": 0.005,
        "prof_min": 0.3,
    }

    def _floats(path):
        vals = []
        try:
            with open(path, encoding="cp1252", errors="ignore") as f:
                for ln in f:
                    ln = ln.strip()
                    if not ln or ln.startswith("#") or ln.startswith("*") or ln.startswith('"'):
                        continue
                    try:
                        vals.append(float(ln.replace(",", ".")))
                    except ValueError:
                        pass
        except OSError:
            pass
        return vals

    vala = _floats(_PROSANE_DIR / "LST_VALA.DEF")
    if len(vala) >= 1:
        params["vala_m"] = vala[0] / 100.0   # cm → m (60 cm = 0.60 m)
    if len(vala) >= 2:
        params["lastro_m"] = vala[1] / 100.0  # cm → m (15 cm = 0.15 m)
    if len(vala) >= 5:
        params["bdi"] = vala[4]               # 1.25

    decl = _floats(_PROSANE_DIR / "DECL_ALT.MIN")
    if len(decl) >= 1:
        params["decl_min"] = decl[0]          # 0.005 m/m
    if len(decl) >= 2:
        params["prof_min"] = decl[1]          # 0.30 m

    return params


_PARAMS_PS  = _ler_params_prosane()
N_MANNING   = _PARAMS_PS["n_manning"]

DXF_DIR = Path.home() / "Downloads" / "PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018" / "MAPAS ÁGUA E ESGOTO PARA DXF"
OUT_DIR = Path(__file__).parent / "SAIDA"

NUCLEOS_BATCH = [
    {"nucleo": "Pantanal Baixo",  "dxf": f"{DXF_DIR}\\PANTANAL BAIXO\\PANTANAL_ESGOTO.dxf"},
    {"nucleo": "Morro do Teteu",  "dxf": f"{DXF_DIR}\\MORRO DO TETÉU\\TETÉU_ESGOTO.dxf"},
    {"nucleo": "Vila Criadores",  "dxf": f"{DXF_DIR}\\VILA DOS CRIADORES\\CRIADORES_ESGOTO.dxf"},
    {"nucleo": "Vila Israel",     "dxf": f"{DXF_DIR}\\VILA ISRAEL\\ISRAEL_ESGOTO.dxf"},
    {"nucleo": "Sao Manoel",      "dxf": f"{DXF_DIR}\\SÃO MANOEL\\SÃO_MANOEL_ESGOTO.dxf"},
]


def log(msg, nivel="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    prefix = {"OK": "[OK]  ", "WARN": "[!]   ", "STEP": ">>> ", "ERR": "[ERR] "}.get(nivel, "      ")
    line = f"[{ts}] {prefix}{msg}"
    try:
        print(line)
    except UnicodeEncodeError:
        enc = getattr(sys.stdout, "encoding", None) or "utf-8"
        safe = line.encode(enc, errors="replace").decode(enc, errors="replace")
        print(safe)


def calc_manning(dn_mm, decl_mm):
    if not dn_mm or not decl_mm or decl_mm <= 0:
        return {"v_ms": None, "q_ls": None, "tau_pa": None}
    D  = dn_mm / 1000
    A  = math.pi * D**2 / 4
    Rh = D / 4
    V  = (1 / N_MANNING) * Rh**(2/3) * decl_mm**0.5
    Q  = V * A * 1000
    tau = 1000 * 9.81 * Rh * decl_mm
    return {"v_ms": round(V, 3), "q_ls": round(Q, 3), "tau_pa": round(tau, 2)}


def _formatar_quantidade_material(valor):
    if valor in (None, ""):
        return "-"
    try:
        valor_f = float(valor)
    except (TypeError, ValueError):
        return str(valor)
    if abs(valor_f - round(valor_f)) < 1e-9:
        return str(int(round(valor_f)))
    return f"{valor_f:.2f}".rstrip("0").rstrip(".")


def _linhas_materiais(materiais):
    linhas = []
    for item in materiais:
        qtd = item["quantidade"] if "quantidade" in item else item.get("qtd")
        un = item.get("unidade") or item.get("un") or ""
        desc = item.get("descricao") or item.get("material") or ""
        linhas.append(f"{_formatar_quantidade_material(qtd):>6} {un:<5} {desc}")
    return linhas


def _renderizar_painel_materiais(ax, materiais, x, y, largura, altura,
                                 titulo="MATERIAIS PREVISTOS",
                                 fc="#fff8e1", ec="#ffcc80",
                                 titulo_cor="#ef6c00", fonte=6.2):
    ax.add_patch(FancyBboxPatch((x, y), largura, altura, boxstyle="round,pad=0.2",
                                fc=fc, ec=ec, lw=0.7))
    ax.text(x + 2, y + altura - 2, titulo, fontsize=7, color=titulo_cor, fontweight="bold")
    linhas = _linhas_materiais(materiais)
    if not linhas:
        ax.text(x + 2, y + altura - 5, "Sem materiais calculados.", fontsize=fonte, color="#444")
        return
    passo = max((altura - 5) / max(len(linhas), 1), 1.2)
    y_linha = y + altura - 4.5
    for linha in linhas:
        if y_linha <= y + 0.8:
            ax.text(x + 2, y + 0.8, "...", fontsize=fonte, family="monospace", color="#222")
            break
        ax.text(x + 2, y_linha, linha, fontsize=fonte, family="monospace", color="#222")
        y_linha -= passo


def enriquecer_trechos(trechos, pvs):
    for t in trechos:
        pvi = pvs.get(t["pv_ini"], {})
        pvf = pvs.get(t["pv_fim"], {})
        t["ct_ini"]  = t.get("ct_ini")  or pvi.get("ct")
        t["ct_fim"]  = t.get("ct_fim")  or pvf.get("ct")
        t["cf_ini"]  = t.get("cf_ini")  or pvi.get("cf")
        t["cf_fim"]  = t.get("cf_fim")  or pvf.get("cf")
        t["prof_ini"] = t.get("prof_ini") or pvi.get("prof")
        t["prof_fim"] = t.get("prof_fim") or pvf.get("prof")
        hidr = calc_manning(t.get("dn_mm"), t.get("decl_mm"))
        t.update(hidr)
    return trechos


_transformer = None
def _get_transformer():
    global _transformer
    if _transformer is None:
        try:
            from pyproj import Transformer
            _transformer = Transformer.from_crs(CRS_EPSG, "EPSG:4326", always_xy=True)
        except:
            _transformer = "FALLBACK"
    return _transformer

def to_ll(x, y):
    tr = _get_transformer()
    if tr != "FALLBACK":
        lon, lat = tr.transform(x, y)
        return lat, lon
    return -23.96 + (y - 7352000) / 111000, -46.33 + (x - 362000) / 95000


def _coords_validas(lat, lon):
    """Valida se as coordenadas estão dentro do território brasileiro."""
    return -34.0 <= lat <= 5.0 and -75.0 <= lon <= -28.0


def gerar_ns(pvs, trechos, nucleo, out_dir):
    """
    Gera todas as Notas de Serviço de um trecho.
    Wrapper para gerar_ns_a4() em lote.

    Args:
        pvs: dict de PVs
        trechos: lista de trechos
        nucleo: nome do núcleo
        out_dir: pasta de saída

    Returns:
        lista de paths dos arquivos gerados
    """
    from pathlib import Path
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    paths = []
    for i, trecho in enumerate(trechos):
        ns_id_num = i + 1  # ID numérico para formatação
        ns_id_str = f"NS-{ns_id_num:04d}"  # ID string para nome do arquivo
        try:
            pdf_path = str(out_path / f"{ns_id_str}_{trecho['pv_ini']}-{trecho['pv_fim']}.pdf")
            gerar_ns_a4(ns_id_num, trecho, pvs, nucleo, pdf_path)
            paths.append(pdf_path)
        except Exception as e:
            log(f"Erro ao gerar {ns_id_str}: {e}", "WARN")

    return paths


def gerar_ns_a4(ns_id, trecho, pvs, nucleo, out_path):
    pvi_n, pvf_n = trecho["pv_ini"], trecho["pv_fim"]
    pvi, pvf = pvs.get(pvi_n, {}), pvs.get(pvf_n, {})
    dn   = trecho.get("dn_mm", "?")
    ext  = trecho.get("ext_m", 0)
    decl = trecho.get("decl_mm")
    rua  = trecho.get("rua", "Sem Rua")
    hidr = calc_manning(trecho.get("dn_mm"), decl)
    materiais = calcular_materiais(trecho, pvs)

    fig, ax = plt.subplots(figsize=(11.69, 8.27))
    ax.set_xlim(0, 100); ax.set_ylim(0, 70); ax.axis('off')

    ax.add_patch(FancyBboxPatch((1, 60), 98, 9, boxstyle="round,pad=0.3",
                                 fc="#1a237e", ec="none"))
    ax.text(50, 65, f"NOTA DE SERVICO - NS {ns_id:03d}", ha="center",
            va="center", fontsize=18, fontweight="bold", color="white")
    ax.text(50, 61.5, f"SE LIGA NA REDE - {nucleo} - Contrato {CONTRATO}",
            ha="center", va="center", fontsize=9, color="#90caf9")

    y = 57
    campos = [
        ("TRECHO",      f"{pvi_n} -> {pvf_n}"),
        ("LOGRADOURO",  rua),
        ("DN",          f"{dn} mm"),
        ("EXTENSAO",    f"{ext:.2f} m"),
        ("MATERIAL",    trecho.get("material", "PVC")),
        ("DECLIVIDADE", f"{decl*1000:.2f} permil" if decl else "-"),
    ]
    for i, (label, valor) in enumerate(campos):
        col = 5 if i % 2 == 0 else 52
        row = y - (i // 2) * 5
        ax.text(col, row, label, fontsize=7, color="#666", fontweight="bold")
        ax.text(col, row - 2.2, valor, fontsize=11, color="#111")

    y = 38
    ax.add_patch(FancyBboxPatch((1, y-1), 98, 7, boxstyle="round,pad=0.2",
                                 fc="#e3f2fd", ec="#90caf9", lw=0.5))
    ax.text(5,  y+3.5, "PV MONTANTE", fontsize=7, color="#1565c0", fontweight="bold")
    ax.text(5,  y+1,   f"CT = {pvi.get('ct','-')}m   CF = {pvi.get('cf','-')}m   "
                        f"Prof = {pvi.get('prof','-')}m", fontsize=9)
    ax.text(52, y+3.5, "PV JUSANTE", fontsize=7, color="#1565c0", fontweight="bold")
    ax.text(52, y+1,   f"CT = {pvf.get('ct','-')}m   CF = {pvf.get('cf','-')}m   "
                        f"Prof = {pvf.get('prof','-')}m", fontsize=9)

    y = 28
    ax.add_patch(FancyBboxPatch((1, y-1), 98, 7, boxstyle="round,pad=0.2",
                                 fc="#e8f5e9", ec="#81c784", lw=0.5))
    ax.text(5, y+3.5, "HIDRAULICA (Manning)", fontsize=7, color="#2e7d32", fontweight="bold")
    v_txt = f"{hidr['v_ms']:.3f} m/s" if hidr['v_ms'] else "-"
    q_txt = f"{hidr['q_ls']:.2f} l/s" if hidr['q_ls'] else "-"
    t_txt = f"{hidr['tau_pa']:.2f} Pa" if hidr['tau_pa'] else "-"
    ax.text(5, y+1, f"V = {v_txt}   Q = {q_txt}   tau = {t_txt}   n = {N_MANNING}", fontsize=9)
    _renderizar_painel_materiais(ax, materiais, 52, 8, 46, 18)

    ct_i = pvi.get("ct", 0) or 0
    ct_f = pvf.get("ct", 0) or 0
    cf_i = pvi.get("cf", 0) or 0
    cf_f = pvf.get("cf", 0) or 0

    if ct_i and ct_f:
        x0, x1 = 10, 46
        y_base = 8
        altura = 15
        all_cotas = [c for c in [ct_i, ct_f, cf_i, cf_f] if c]
        c_min, c_max = min(all_cotas) - 0.5, max(all_cotas) + 0.5
        c_range = max(c_max - c_min, 1)
        cy = lambda cota: y_base + (cota - c_min) / c_range * altura
        ax.add_patch(FancyBboxPatch((2, 7), 48, 18, boxstyle="round,pad=0.2",
                                    fc="#f5f9ff", ec="#bbdefb", lw=0.6))
        ax.text(4, 23, "PERFIL RESUMIDO", fontsize=7, color="#1565c0", fontweight="bold")

        ax.plot([x0, x1], [cy(ct_i), cy(ct_f)], 'k-', lw=1.5)
        ax.plot([x0, x1], [cy(cf_i), cy(cf_f)], 'b-', lw=2)
        ax.plot([x0, x0], [cy(cf_i), cy(ct_i)], 'k-', lw=1)
        ax.plot([x1, x1], [cy(cf_f), cy(ct_f)], 'k-', lw=1)
        ax.text(x0, cy(ct_i)+0.9, f"CT={ct_i:.3f}", fontsize=5.8, ha="center")
        ax.text(x0, cy(cf_i)-1.2, f"CF={cf_i:.3f}", fontsize=5.8, ha="center", color="blue")
        ax.text(x1, cy(ct_f)+0.9, f"CT={ct_f:.3f}", fontsize=5.8, ha="center")
        ax.text(x1, cy(cf_f)-1.2, f"CF={cf_f:.3f}", fontsize=5.8, ha="center", color="blue")
        ax.text((x0 + x1) / 2, cy((cf_i+cf_f)/2)-1.7, f"DN{dn} - {ext:.1f}m",
                fontsize=8, ha="center", color="blue", fontweight="bold")

    ax.text(50, 2, f"Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')} - "
            f"ConstruData SABESP NS v{NS_VERSION} - Motor GDAL/OGR",
            ha="center", fontsize=6, color="#999")

    fig.savefig(str(out_path), dpi=150, bbox_inches="tight", pad_inches=0.3)
    plt.close(fig)


def gerar_ns_desenho(ns_id, trecho, pvs, all_trechos, nucleo, out_path):
    pvi_n, pvf_n = trecho["pv_ini"], trecho["pv_fim"]
    pvi, pvf = pvs.get(pvi_n, {}), pvs.get(pvf_n, {})
    materiais = calcular_materiais(trecho, pvs)
    dn = trecho.get("dn_mm", "?")
    ext = float(trecho.get("ext_m", 0) or 0)
    decl = float(trecho.get("decl_mm", 0) or 0)
    rua = trecho.get("rua", "SEM RUA")
    material = trecho.get("material", "PVC")
    ct_i = pvi.get("ct") if pvi.get("ct") is not None else trecho.get("ct_ini")
    ct_f = pvf.get("ct") if pvf.get("ct") is not None else trecho.get("ct_fim")
    cf_i = pvi.get("cf") if pvi.get("cf") is not None else trecho.get("cf_ini")
    cf_f = pvf.get("cf") if pvf.get("cf") is not None else trecho.get("cf_fim")
    prof_i = trecho.get("prof_ini") or pvi.get("prof") or (abs(ct_i - cf_i) if ct_i is not None and cf_i is not None else 0)
    prof_f = trecho.get("prof_fim") or pvf.get("prof") or (abs(ct_f - cf_f) if ct_f is not None and cf_f is not None else 0)
    prof_media = np.mean([v for v in [prof_i, prof_f] if v not in (None, "")]) if any(v not in (None, "") for v in [prof_i, prof_f]) else 0
    largura_vala = max(_PARAMS_PS.get("vala_m", 0.60), (float(dn) / 1000.0 if str(dn).isdigit() else 0.20) + 0.50)
    vol_esc = ext * largura_vala * prof_media
    vol_aterro = ext * largura_vala * max(_PARAMS_PS.get("lastro_m", 0.15), 0.12)
    area_pav = ext * max(largura_vala * 0.9, 0.6)
    decl_pct = decl * 100
    tubo_principal = next((m for m in materiais if str(m.get("descricao", "")).lower().startswith("tubo ")), None)
    qtd_barras = tubo_principal.get("quantidade", 0) if tubo_principal else 0
    qtd_barras_txt = _formatar_quantidade_material(qtd_barras)
    unidade_barra = "barra" if str(qtd_barras_txt) == "1" else "barras"

    def fmt_num(valor, casas=3):
        if valor in (None, ""):
            return "-"
        return f"{float(valor):.{casas}f}"

    fig = plt.figure(figsize=(16.54, 11.69), facecolor="white")
    grid = fig.add_gridspec(
        3, 4,
        height_ratios=[1.0, 0.72, 0.24],
        width_ratios=[1.15, 1.00, 0.78, 0.78],
        hspace=0.42, wspace=0.32
    )
    ax_planta = fig.add_subplot(grid[0, 0:2])
    ax_quant = fig.add_subplot(grid[0, 2:4])
    ax_perfil = fig.add_subplot(grid[1, 0:4])
    ax_tabela = fig.add_subplot(grid[2, 0:2])
    ax_carimbo = fig.add_subplot(grid[2, 2:4])

    ax_planta.set_title(f"PLANTA NS {ns_id:03d} | {pvi_n} -> {pvf_n} | {rua}", fontsize=10, fontweight="bold")
    ax_planta.set_aspect("equal")
    ax_planta.set_facecolor("white")
    ax_planta.grid(True, color="#d7dde7", alpha=0.6)

    x0 = pvi.get("x")
    y0 = pvi.get("y")
    x1 = pvf.get("x")
    y1 = pvf.get("y")
    if all(v is not None for v in [x0, y0, x1, y1]):
        cx = (x0 + x1) / 2
        cy = (y0 + y1) / 2
        pad = max(math.hypot(x1 - x0, y1 - y0) * 1.6, 25)
        ax_planta.set_xlim(cx - pad, cx + pad)
        ax_planta.set_ylim(cy - pad, cy + pad)

        for t in all_trechos:
            p0 = pvs.get(t["pv_ini"], {})
            p1 = pvs.get(t["pv_fim"], {})
            if p0.get("x") is None or p1.get("x") is None:
                continue
            ax_planta.plot([p0["x"], p1["x"]], [p0["y"], p1["y"]],
                           color="#d9dde5", lw=0.8, zorder=1)

        ax_planta.plot([x0, x1], [y0, y1], color="#253cff", lw=2.4, zorder=3)
        ax_planta.plot([x0, x1], [y0, y1], linestyle="", marker="s",
                       markersize=6, color="#1d4f7a", zorder=4)

        ax_planta.annotate(f"{pvi_n}\nCT={fmt_num(ct_i)}\nCF={fmt_num(cf_i)}",
                           xy=(x0, y0), xytext=(-2, 12), textcoords="offset points",
                           fontsize=6, ha="center",
                           bbox=dict(boxstyle="round,pad=0.18", fc="white", ec="#6f7d96", alpha=0.95))
        ax_planta.annotate(f"{pvf_n}\nCT={fmt_num(ct_f)}\nCF={fmt_num(cf_f)}",
                           xy=(x1, y1), xytext=(2, 12), textcoords="offset points",
                           fontsize=6, ha="center",
                           bbox=dict(boxstyle="round,pad=0.18", fc="white", ec="#6f7d96", alpha=0.95))
        ax_planta.text((x0 + x1) / 2, (y0 + y1) / 2 + max(pad * 0.03, 1.2),
                       f"DN {dn}mm | {pvi_n}->{pvf_n} | L={ext:.2f}m",
                       fontsize=7, color="#253cff", ha="center", fontweight="bold",
                       bbox=dict(boxstyle="round,pad=0.12", fc="#f4f6ff", ec="#6d78c7", alpha=0.95))

    ax_planta.annotate("", xy=(0.93, 0.95), xytext=(0.93, 0.80), xycoords="axes fraction",
                       arrowprops=dict(arrowstyle="-|>", lw=1.3, color="black"))
    ax_planta.text(0.93, 0.97, "N", transform=ax_planta.transAxes,
                   ha="center", va="bottom", fontsize=9, fontweight="bold")
    ax_planta.tick_params(labelsize=7)
    ax_planta.set_xlabel("Este (m UTM)", fontsize=7)
    ax_planta.set_ylabel("Norte (m UTM)", fontsize=7)

    ax_quant.axis("off")
    y = 0.95
    ax_quant.text(0.05, y, "Quantitativo:", fontsize=10, fontweight="bold", transform=ax_quant.transAxes)
    y -= 0.09
    for label, valor in [
        ("Volume de Escavacao", f"{vol_esc:.3f} m3"),
        ("Volume de Aterro", f"{vol_aterro:.3f} m3"),
        ("Pavimentacao", f"{area_pav:.2f} m2"),
        ("Extensao Total", f"{ext:.2f} m"),
    ]:
        ax_quant.text(0.05, y, f"{label} = {valor}", fontsize=8.5, color="#333", transform=ax_quant.transAxes)
        y -= 0.075

    y -= 0.02
    ax_quant.text(0.05, y, f"--- {material} ---", fontsize=8.5, color="#333", transform=ax_quant.transAxes)
    y -= 0.075
    ax_quant.text(0.05, y, f"{qtd_barras_txt} {unidade_barra} {dn}mm {material}",
                  fontsize=9, color="#333", transform=ax_quant.transAxes)
    y -= 0.10
    ax_quant.text(0.05, y, "LEGENDA", fontsize=9, fontweight="bold", transform=ax_quant.transAxes)
    ax_quant.plot([0.05, 0.25], [y - 0.10, y - 0.10], color="#253cff", lw=2.4, transform=ax_quant.transAxes)
    ax_quant.text(0.28, y - 0.10, f"Tubo DN{dn}mm", fontsize=8, va="center", transform=ax_quant.transAxes)
    ax_quant.plot([0.13], [y - 0.18], marker="s", markersize=7, color="#1d4f7a", transform=ax_quant.transAxes)
    ax_quant.text(0.28, y - 0.18, "P.V. - Poco de Visita", fontsize=8, va="center", transform=ax_quant.transAxes)

    ax_perfil.set_title("PERFIL LONGITUDINAL    Exag. vertical ~10x", fontsize=10, fontweight="bold")
    ax_perfil.set_facecolor("white")
    ax_perfil.grid(True, color="#d7dde7", alpha=0.6)
    if None not in (ct_i, ct_f, cf_i, cf_f) and ext > 0:
        x = np.array([0.0, ext])
        ct_vals = np.array([ct_i, ct_f], dtype=float)
        cf_vals = np.array([cf_i, cf_f], dtype=float)
        topo = max(ct_vals) + 0.20
        ax_perfil.fill_between(x, ct_vals, topo, color="#eddcc2", alpha=0.7)
        ax_perfil.plot(x, ct_vals, color="#8b5a2b", lw=1.5, label="CT")
        ax_perfil.plot(x, cf_vals, color="#253cff", lw=1.8, label="CF")
        ax_perfil.plot(x, cf_vals, "o", color="#253cff", markersize=4)

        ax_perfil.annotate(f"{pvi_n}\nCT={fmt_num(ct_i)}\nCF={fmt_num(cf_i)}",
                           xy=(0.0, ct_vals[0]), xytext=(0, -28), textcoords="offset points",
                           fontsize=6, ha="left",
                           bbox=dict(boxstyle="round,pad=0.18", fc="white", ec="#6f7d96", alpha=0.95))
        ax_perfil.annotate(f"{pvf_n}\nCT={fmt_num(ct_f)}\nCF={fmt_num(cf_f)}",
                           xy=(ext, ct_vals[1]), xytext=(-10, -28), textcoords="offset points",
                           fontsize=6, ha="left",
                           bbox=dict(boxstyle="round,pad=0.18", fc="white", ec="#6f7d96", alpha=0.95))
        ax_perfil.text(ext / 2, np.mean(cf_vals) - 0.08,
                       f"DN {dn}mm i={decl_pct:.2f}%",
                       fontsize=10, color="#253cff", ha="center", fontweight="bold")
        ax_perfil.legend(loc="upper right", fontsize=7)

    ax_perfil.set_xlabel("Distancia (m)", fontsize=8)
    ax_perfil.set_ylabel("Cota (m)", fontsize=8)
    ax_perfil.tick_params(labelsize=7)

    ax_tabela.axis("off")
    tabela = ax_tabela.table(
        cellText=[
            [pvi_n, fmt_num(ct_i), fmt_num(cf_i), fmt_num(prof_i, 2), "0.00", f"{dn}", f"{decl_pct:.2f}"],
            [pvf_n, fmt_num(ct_f), fmt_num(cf_f), fmt_num(prof_f, 2), f"{ext:.2f}", f"{dn}", f"{decl_pct:.2f}"],
        ],
        colLabels=["Estaca", "CT (m)", "CF (m)", "Prof (m)", "Dist (m)", "DN (mm)", "Decl (%)"],
        loc="center",
        cellLoc="center"
    )
    tabela.auto_set_font_size(False)
    tabela.set_fontsize(7)
    tabela.scale(1.15, 1.45)
    for (row, col), cell in tabela.get_celld().items():
        cell.set_linewidth(0.8)
        cell.set_edgecolor("#2b4d73")
        if row == 0:
            cell.set_facecolor("#2b5d88")
            cell.set_text_props(color="white", weight="bold")
        else:
            cell.set_facecolor("white")

    ax_carimbo.axis("off")
    ax_carimbo.add_patch(FancyBboxPatch((0.58, 0.06), 0.38, 0.86, boxstyle="round,pad=0.02",
                                        fc="white", ec="#2b5d88", lw=1.3, transform=ax_carimbo.transAxes))
    ax_carimbo.text(0.77, 0.82, "SABESP", transform=ax_carimbo.transAxes,
                    ha="center", va="center", fontsize=10, fontweight="bold", color="#2b5d88")
    ax_carimbo.text(0.77, 0.70, "SISTEMA DE ESGOTAMENTO",
                    transform=ax_carimbo.transAxes, ha="center", va="center",
                    fontsize=6.8, fontweight="bold")
    ax_carimbo.text(0.77, 0.60, "SANITARIO SANTOS/SP",
                    transform=ax_carimbo.transAxes, ha="center", va="center",
                    fontsize=6.8, fontweight="bold")
    ax_carimbo.text(0.77, 0.46, f"CONTRATO: {CONTRATO}",
                    transform=ax_carimbo.transAxes, ha="center", va="center",
                    fontsize=6.8, fontweight="bold")
    ax_carimbo.text(0.77, 0.35, f"NS No {ns_id:03d}",
                    transform=ax_carimbo.transAxes, ha="center", va="center",
                    fontsize=6.8, fontweight="bold")
    ax_carimbo.text(0.77, 0.25, f"NUCLEO: {nucleo}",
                    transform=ax_carimbo.transAxes, ha="center", va="center",
                    fontsize=6.8, fontweight="bold")
    ax_carimbo.text(0.77, 0.15, f"LEGENDA: {material}",
                    transform=ax_carimbo.transAxes, ha="center", va="center",
                    fontsize=6.8, fontweight="bold")
    ax_carimbo.text(0.77, 0.06, f"ConstruData HydroNetwork  Rev. {NS_VERSION}",
                    transform=ax_carimbo.transAxes, ha="center", va="center", fontsize=7.2)

    fig.subplots_adjust(left=0.04, right=0.98, top=0.96, bottom=0.05, wspace=0.32, hspace=0.42)
    fig.savefig(str(out_path), dpi=150, bbox_inches="tight")
    plt.close(fig)


def calcular_materiais(tr, pvs):
    """Calcula lista de materiais para 1 trecho."""
    dn = tr.get("dn_mm", 200)
    ext = tr.get("ext_m", 0)
    n_barras = math.ceil(ext / 6) if ext > 0 else 1
    materiais = [
        {"descricao": f"Tubo PVC DN{dn}mm", "unidade": "barra", "quantidade": n_barras},
        {"descricao": f"Luva correr PVC DN{dn}mm", "unidade": "pc", "quantidade": max(n_barras - 1, 0)},
        {"descricao": f"Anel borracha DN{dn}mm", "unidade": "pc", "quantidade": n_barras + 1},
        {"descricao": "Pasta lubrificante", "unidade": "kg", "quantidade": round(n_barras * 0.04, 2)},
        {"descricao": "Areia lastro", "unidade": "m3", "quantidade": round(ext * 0.08, 2)},
        {"descricao": "Areia envoltoria", "unidade": "m3", "quantidade": round(ext * 0.24, 2)},
        {"descricao": "Brita dreno", "unidade": "m3", "quantidade": round(ext * 0.16, 2)},
        {"descricao": "PV concreto DN1200", "unidade": "pc", "quantidade": 1},
    ]
    if tr.get("tipo", "esgoto") == "esgoto":
        materiais.append({"descricao": "Ramal esgoto DN100", "unidade": "pc", "quantidade": 1})
        materiais.append({"descricao": "Caixa inspecao", "unidade": "pc", "quantidade": 1})
        materiais.append({"descricao": f"Juncao Y PVC DN{dn}x100mm", "unidade": "pc", "quantidade": 1})
    return materiais


def gerar_ns_sat(ns_id, trecho, pvs, nucleo, out_path):
    """Gera PDF A3 com SATELITE + perfil longitudinal limpo."""
    p0 = pvs.get(trecho["pv_ini"], {})
    p1 = pvs.get(trecho["pv_fim"], {})
    if not p0.get("x") or not p1.get("x"):
        return

    fig, (ax_planta, ax_perfil) = plt.subplots(1, 2, figsize=(16.54, 11.69))

    # PLANTA COM SATELITE
    ax_planta.plot([p0["x"], p1["x"]], [p0["y"], p1["y"]], 'r-', linewidth=3, zorder=5)
    for pv_nome, pv in [(trecho["pv_ini"], p0), (trecho["pv_fim"], p1)]:
        ax_planta.plot(pv["x"], pv["y"], 'ro', markersize=8, zorder=6)
        ax_planta.annotate(pv_nome, (pv["x"], pv["y"]), fontsize=8, color='red',
                           fontweight='bold', ha='center', va='bottom',
                           xytext=(0, 10), textcoords='offset points', zorder=7)
    dx = abs(p1["x"] - p0["x"])
    dy = abs(p1["y"] - p0["y"])
    margin = max(dx, dy, 50) * 0.5
    ax_planta.set_xlim(min(p0["x"], p1["x"]) - margin, max(p0["x"], p1["x"]) + margin)
    ax_planta.set_ylim(min(p0["y"], p1["y"]) - margin, max(p0["y"], p1["y"]) + margin)
    try:
        import contextily as cx
        cx.add_basemap(ax_planta, crs="EPSG:31983",
                       source=cx.providers.Esri.WorldImagery, zoom=18)
    except Exception:
        try:
            import contextily as cx
            cx.add_basemap(ax_planta, crs="EPSG:31983",
                           source=cx.providers.Esri.WorldImagery, zoom=17)
        except Exception:
            pass
    ax_planta.set_title(f"PLANTA - NS{ns_id:03d} - {trecho['pv_ini']} ao {trecho['pv_fim']} - {nucleo}",
                        fontsize=10, fontweight='bold')
    ax_planta.set_xlabel("E (m)")
    ax_planta.set_ylabel("N (m)")

    # PERFIL LONGITUDINAL
    ext = trecho["ext_m"]
    ct0, ct1 = p0.get("ct", 0) or 0, p1.get("ct", 0) or 0
    cf0, cf1 = p0.get("cf", 0) or 0, p1.get("cf", 0) or 0

    ax_perfil.fill_between([0, ext], [ct0, ct1], alpha=0.15, color='green', label="Terreno")
    ax_perfil.plot([0, ext], [ct0, ct1], 'g-', linewidth=2)
    ax_perfil.plot([0, ext], [cf0, cf1], 'b-', linewidth=2.5, label="Geratriz Inf.")

    for x, nome, ct, cf in [(0, trecho["pv_ini"], ct0, cf0),
                              (ext, trecho["pv_fim"], ct1, cf1)]:
        prof = abs(ct - cf) if ct and cf else 0
        ax_perfil.plot([x, x], [cf, ct], 'r-', linewidth=1.5)
        ax_perfil.plot(x, ct, 'go', markersize=6)
        ax_perfil.plot(x, cf, 'ro', markersize=6)
        ax_perfil.annotate(f"{nome}\nCT={ct:.2f}\nCF={cf:.2f}\nH={prof:.2f}",
                           xy=(x, ct), fontsize=7, ha='center',
                           bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

    xm = ext / 2
    ym = (cf0 + cf1) / 2
    decl_pct = (trecho.get("decl_mm", 0) or 0) / 10
    ax_perfil.text(xm, ym + 0.3, f"DN{trecho.get('dn_mm','')} I={decl_pct:.2f}%\nL={ext:.1f}m",
                   ha='center', fontsize=8, color='blue', fontweight='bold')
    ax_perfil.set_xlabel("Distancia (m)")
    ax_perfil.set_ylabel("Cota (m)")
    ax_perfil.set_title(f"PERFIL - NS{ns_id:03d} - {trecho['pv_ini']} ao {trecho['pv_fim']}", fontsize=10, fontweight='bold')
    ax_perfil.legend(fontsize=7)
    ax_perfil.grid(True, alpha=0.3)

    fig.tight_layout()
    fig.savefig(str(out_path), dpi=150, bbox_inches="tight")
    plt.close(fig)


def gerar_html(ns_id, trecho, pvs, all_trechos, nucleo, out_path):
    pvi_n, pvf_n = trecho["pv_ini"], trecho["pv_fim"]
    pvi, pvf = pvs.get(pvi_n, {}), pvs.get(pvf_n, {})
    hidr = calc_manning(trecho.get("dn_mm"), trecho.get("decl_mm"))
    materiais = calcular_materiais(trecho, pvs)

    lines_js, pvs_js = [], []
    for t in all_trechos:
        p0, p1 = pvs.get(t["pv_ini"], {}), pvs.get(t["pv_fim"], {})
        if p0.get("x") and p1.get("x"):
            ll0, ll1 = to_ll(p0["x"], p0["y"]), to_ll(p1["x"], p1["y"])
            if not (_coords_validas(*ll0) and _coords_validas(*ll1)):
                continue
            is_cur = (t["pv_ini"] == trecho["pv_ini"] and t["pv_fim"] == trecho["pv_fim"])
            color  = "red" if is_cur else "#3388ff"
            weight = 4 if is_cur else 2
            popup  = f'{t["pv_ini"]}->{t["pv_fim"]} DN{t.get("dn_mm","?")} {t["ext_m"]}m'
            lines_js.append(
                f'L.polyline([[{ll0[0]},{ll0[1]}],[{ll1[0]},{ll1[1]}]],'
                f'{{color:"{color}",weight:{weight}}}).addTo(map)'
                f'.bindPopup("{popup}");')

    for nome, pv in pvs.items():
        if pv.get("x"):
            ll = to_ll(pv["x"], pv["y"])
            if not _coords_validas(*ll):
                continue
            is_cur = nome in (pvi_n, pvf_n)
            r, color = (6, "red") if is_cur else (3, "#3388ff")
            popup = f'{nome}<br>CT={pv.get("ct","-")}<br>CF={pv.get("cf","-")}'
            pvs_js.append(
                f'L.circleMarker([{ll[0]},{ll[1]}],{{radius:{r},color:"{color}",'
                f'fillOpacity:0.8}}).addTo(map).bindPopup("{popup}");')

    cx = (pvi.get("x", 0) + pvf.get("x", 0)) / 2
    cy = (pvi.get("y", 0) + pvf.get("y", 0)) / 2
    center = to_ll(cx, cy) if (cx and cy) else (-23.96, -46.33)
    if not _coords_validas(*center):
        center = (-23.96, -46.33)

    titulo = f"NS {ns_id:03d} - {pvi_n} -> {pvf_n}" if ns_id > 0 else f"REDE GERAL - {nucleo}"

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{titulo}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9/dist/leaflet.js"></script>
<style>
body{{font-family:Arial;margin:0;background:#1a1a2e;color:#eee}}
#map{{height:55vh;width:100%}}
.info{{padding:15px;margin:10px}}
.card{{background:#16213e;border-radius:8px;padding:15px;margin:8px 0}}
h1{{color:#e94560;margin:10px 15px}}
</style></head><body>
<h1>{titulo}</h1>
<div id="map"></div>
<div class="info">
<div class="card">
<b>TRECHO:</b> {pvi_n} -> {pvf_n} | DN {trecho.get("dn_mm","?")}mm |
{trecho["ext_m"]:.1f}m | {trecho.get("rua","Sem Rua")}<br>
<b>DECLIVIDADE:</b> {(trecho.get("decl_mm",0) or 0)*1000:.2f} permil |
<b>V:</b> {hidr["v_ms"] or "-"} m/s |
<b>Q:</b> {hidr["q_ls"] or "-"} l/s |
<b>tau:</b> {hidr["tau_pa"] or "-"} Pa
</div>
<div class="card">
<b>{pvi_n}:</b> CT={pvi.get("ct","-")} CF={pvi.get("cf","-")} Prof={pvi.get("prof","-")}m<br>
<b>{pvf_n}:</b> CT={pvf.get("ct","-")} CF={pvf.get("cf","-")} Prof={pvf.get("prof","-")}m
</div>
<div class="card">
<b>MATERIAIS PREVISTOS</b><br>
{('<br>'.join(_linhas_materiais(materiais)) or 'Sem materiais calculados.')}
</div>
</div>
<script>
var map=L.map('map').setView([{center[0]},{center[1]}],{17 if ns_id == 0 else 18});
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{{z}}/{{y}}/{{x}}',
{{attribution:'Esri',maxZoom:20}}).addTo(map);
{chr(10).join(lines_js)}
{chr(10).join(pvs_js)}
</script></body></html>"""

    with open(str(out_path), "w", encoding="utf-8") as f:
        f.write(html)


def gerar_geojson(trechos, pvs, out_path):
    features = []
    for t in trechos:
        p0, p1 = pvs.get(t["pv_ini"], {}), pvs.get(t["pv_fim"], {})
        if p0.get("x") and p1.get("x"):
            features.append({
                "type": "Feature",
                "geometry": {"type": "LineString",
                             "coordinates": [[p0["x"], p0["y"]], [p1["x"], p1["y"]]]},
                "properties": {k: v for k, v in t.items() if k != "layer"}
            })
    geojson = {"type": "FeatureCollection", "features": features,
               "crs": {"type": "name", "properties": {"name": CRS_EPSG}}}
    with open(str(out_path), "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2, ensure_ascii=False)
    return len(features)


def processar_nucleo(dxf_path, nucleo, out_base):
    log(f"NUCLEO: {nucleo}", "STEP")

    if not os.path.exists(dxf_path):
        log(f"  DXF nao encontrado: {dxf_path}", "ERR")
        return 0, 0

    pvs, trechos, ruas, meta = ler_dxf_gdal(dxf_path)
    if not trechos:
        log("  Sem trechos!", "ERR")
        return 0, 0

    trechos = enriquecer_trechos(trechos, pvs)
    log(f"  Rede: {meta['n_pvs']} PVs, {meta['n_trechos']} trechos", "OK")

    out = Path(out_base) / nucleo.upper().replace(" ", "_")
    for d in ["01_NS_CAMPO", "03_DESENHOS", "04_HTML", "05_GIS", "07_LOG"]:
        (out / d).mkdir(parents=True, exist_ok=True)

    n_ok, n_err = 0, 0
    for i, t in enumerate(trechos):
        ns_id = i + 1
        ns_name = f"NS_{ns_id:03d}_{t['pv_ini']}_AO_{t['pv_fim']}"
        ns_dir = out / "01_NS_CAMPO" / ns_name
        ns_dir.mkdir(parents=True, exist_ok=True)

        try:
            gerar_ns_a4(ns_id, t, pvs, nucleo, ns_dir / f"NS_{ns_id:03d}_A4.pdf")
            materiais = calcular_materiais(t, pvs)

            dados = {
                "ns_id": ns_id, "nucleo": nucleo, "contrato": CONTRATO,
                "trecho": {k: v for k, v in t.items()},
                "pv_montante": pvs.get(t["pv_ini"], {}),
                "pv_jusante":  pvs.get(t["pv_fim"], {}),
                "hidraulica": calc_manning(t.get("dn_mm"), t.get("decl_mm")),
                "materiais": materiais,
                "gerado_em": datetime.now().isoformat(),
            }
            with open(ns_dir / f"NS_{ns_id:03d}_DADOS.json", "w", encoding="utf-8") as f:
                json.dump(dados, f, indent=2, ensure_ascii=False)

            gerar_ns_desenho(ns_id, t, pvs, trechos, nucleo,
                             out / "03_DESENHOS" / f"NS_{ns_id:03d}_DESENHO.pdf")

            try:
                gerar_ns_sat(ns_id, t, pvs, nucleo,
                             out / "03_DESENHOS" / f"NS_{ns_id:03d}_SAT.pdf")
            except Exception:
                pass  # satelite pode falhar sem internet

            gerar_html(ns_id, t, pvs, trechos, nucleo,
                       out / "04_HTML" / f"NS_{ns_id:03d}.html")

            try:
                from gerar_ose import gerar_ose
                ose_dir = out / "06_OSE"
                ose_dir.mkdir(parents=True, exist_ok=True)
                gerar_ose(ns_id, t, pvs, nucleo, ose_dir / f"NS_{ns_id:03d}_OSE.xlsx")
            except Exception:
                pass

            n_ok += 1
            if ns_id <= 3 or ns_id % 25 == 0:
                log(f"  NS {ns_id:03d}: {t['pv_ini']}->{t['pv_fim']} DN{t.get('dn_mm')} {t['ext_m']}m", "OK")

        except Exception as e:
            n_err += 1
            log(f"  NS {ns_id:03d}: ERRO - {e}", "ERR")
            traceback.print_exc()

    gerar_html(0, trechos[0], pvs, trechos, nucleo,
               out / "04_HTML" / "REDE_GERAL.html")

    n_feat = gerar_geojson(trechos, pvs, out / "05_GIS" / "rede_definida.geojson")
    log(f"  GeoJSON: {n_feat} features", "OK")

    log_data = {
        "nucleo": nucleo, "dxf": str(dxf_path),
        "n_pvs": meta["n_pvs"], "n_trechos": meta["n_trechos"],
        "n_ns_geradas": n_ok, "n_ns_erros": n_err,
        "motor": meta.get("motor", "GDAL/OGR+Cluster"),
        "extensao_m": round(sum(t["ext_m"] for t in trechos), 1),
        "gerado_em": datetime.now().isoformat(),
    }
    with open(out / "07_LOG" / "log_processamento.json", "w", encoding="utf-8") as f:
        json.dump(log_data, f, indent=2, ensure_ascii=False)

    try:
        from core.database import bootstrap_database, importar_pvs_trechos
        bootstrap_database(force_import=False)
        importar_pvs_trechos(pvs, trechos, nucleo)
    except Exception as e:
        log(f"  Banco SQLite: {e}", "WARN")

    log(f"  RESULTADO: {n_ok} NS geradas, {n_err} erros", "OK")
    return n_ok, n_err


def processar_nucleo_from_data(pvs, trechos, nucleo, out_base,
                               ns_sequencia=None, modo_rapido=False):
    """Processa NS a partir de dados já lidos (pvs, trechos).
    Usado para LandXML ou qualquer fonte que retorne o formato padrão.

    Args:
        pvs: dict de PVs
        trechos: lista de trechos
        nucleo: nome do núcleo
        out_base: pasta base de saída
        ns_sequencia: lista de índices de trechos na ordem de execução.
                      None = ordem natural (0, 1, 2, ...).

    Estrutura de saída:
        CAMPO/NS001_PV001_AO_PI054/  — A4.pdf, DESENHO.pdf, SAT.pdf, MAPA.html
        CAMPO/REDE_GERAL.html
        PLANEJAMENTO/OSE/, GIS/, LOG/, CRONOGRAMA/, BIM/, MEDICAO/
    """
    if not trechos:
        log("Sem trechos!", "ERR")
        return 0, 0

    trechos = enriquecer_trechos(trechos, pvs)
    meta = {"n_pvs": len(pvs), "n_trechos": len(trechos),
            "motor": "LandXML/Civil3D"}
    log(f"  Rede: {meta['n_pvs']} PVs, {meta['n_trechos']} trechos", "OK")

    # Ordem de processamento: sequência definida pelo usuário ou natural
    if ns_sequencia and len(ns_sequencia) > 0:
        indices = [int(i) for i in ns_sequencia if 0 <= int(i) < len(trechos)]
        presentes = set(indices)
        indices += [i for i in range(len(trechos)) if i not in presentes]
    else:
        indices = list(range(len(trechos)))

    nucleo_upper = nucleo.upper().replace(" ", "_")
    campo, plan = _criar_estrutura_v9(nucleo_upper, out_base)
    if modo_rapido:
        log("  Modo rapido: A4 + JSON + GeoJSON", "WARN")
    log(f"  Saída: CAMPO/ + PLANEJAMENTO/", "OK")

    n_ok, n_err = 0, 0
    for seq, trecho_idx in enumerate(indices):
        t     = trechos[trecho_idx]
        ns_id = seq + 1
        pasta = _ns_folder_name(ns_id, t.get("pv_ini", ""), t.get("pv_fim", ""))
        ns_dir = campo / pasta
        ns_dir.mkdir(parents=True, exist_ok=True)

        try:
            # ── CAMPO: arquivos para equipe de obra ──────────────────────
            gerar_ns_a4(ns_id, t, pvs, nucleo,
                        ns_dir / f"NS{ns_id:03d}_A4.pdf")

            gerar_ns_desenho(ns_id, t, pvs, trechos, nucleo,
                             ns_dir / f"NS{ns_id:03d}_DESENHO.pdf")

            try:
                gerar_ns_sat(ns_id, t, pvs, nucleo,
                             ns_dir / f"NS{ns_id:03d}_SAT.pdf")
            except Exception:
                pass  # satélite pode falhar sem internet

            gerar_html(ns_id, t, pvs, trechos, nucleo,
                       ns_dir / f"NS{ns_id:03d}_MAPA.html")

            # ── PLANEJAMENTO: dados técnicos ─────────────────────────────
            materiais = calcular_materiais(t, pvs)
            dados = {
                "ns_id": ns_id, "trecho_idx": trecho_idx,
                "nucleo": nucleo, "contrato": CONTRATO,
                "trecho": {k: v for k, v in t.items()},
                "pv_montante": pvs.get(t.get("pv_ini", ""), {}),
                "pv_jusante":  pvs.get(t.get("pv_fim", ""), {}),
                "hidraulica": calc_manning(t.get("dn_mm"), t.get("decl_mm")),
                "materiais": materiais,
                "gerado_em": datetime.now().isoformat(),
            }
            with open(ns_dir / f"NS{ns_id:03d}_DADOS.json", "w", encoding="utf-8") as f:
                json.dump(dados, f, indent=2, ensure_ascii=False)

            try:
                from gerar_ose import gerar_ose
                gerar_ose(ns_id, t, pvs, nucleo,
                          plan / "OSE" / f"NS{ns_id:03d}_OSE.xlsx")
            except Exception:
                pass

            n_ok += 1
            if ns_id <= 3 or ns_id % 25 == 0:
                log(f"  NS{ns_id:03d}: {t.get('pv_ini')}->{t.get('pv_fim')}"
                    f" DN{t.get('dn_mm')} {t.get('ext_m', 0):.1f}m", "OK")

        except Exception as e:
            n_err += 1
            log(f"  NS{ns_id:03d}: ERRO - {e}", "ERR")
            traceback.print_exc()

    # ── Mapa geral da rede (CAMPO) ─────────────────────────────────────────
    try:
        gerar_html(0, trechos[0], pvs, trechos, nucleo,
                   campo / "REDE_GERAL.html")
    except Exception:
        pass

    # ── GIS (PLANEJAMENTO) ─────────────────────────────────────────────────
    n_feat = gerar_geojson(trechos, pvs,
                           plan / "GIS" / "rede_definida.geojson")
    log(f"  GeoJSON: {n_feat} features → PLANEJAMENTO/GIS/", "OK")

    log_data = {
        "nucleo": nucleo, "fonte": "LandXML/Civil3D",
        "n_pvs": meta["n_pvs"], "n_trechos": meta["n_trechos"],
        "n_ns_geradas": n_ok, "n_ns_erros": n_err,
        "ns_sequencia_usada": indices,
        "motor": "LandXML/Civil3D",
        "extensao_m": round(sum(t.get("ext_m", 0) for t in trechos), 1),
        "gerado_em": datetime.now().isoformat(),
    }
    with open(plan / "LOG" / "log_processamento.json", "w", encoding="utf-8") as f:
        json.dump(log_data, f, indent=2, ensure_ascii=False)

    try:
        from core.database import bootstrap_database, importar_pvs_trechos
        bootstrap_database(force_import=False)
        importar_pvs_trechos(pvs, trechos, nucleo)
    except Exception as e:
        log(f"  Banco SQLite: {e}", "WARN")

    log(f"  RESULTADO: {n_ok} NS geradas em CAMPO/ | {n_err} erros | PLANEJAMENTO/ ok", "OK")
    return n_ok, n_err


def processar_landxml(xml_path, nucleo, out_base):
    """Pipeline: LandXML → NS. Wrapper conveniente."""
    log(f"NUCLEO (LandXML): {nucleo}", "STEP")
    if not os.path.exists(xml_path):
        log(f"  XML nao encontrado: {xml_path}", "ERR")
        return 0, 0
    pvs, trechos, ruas, meta = ler_landxml(xml_path)
    return processar_nucleo_from_data(pvs, trechos, nucleo, out_base)


if __name__ == "__main__":
    print("=" * 60)
    print(f"ConstruData SABESP v{NS_VERSION} - Gerador de Notas de Servico")
    print("SE LIGA NA REDE - Contrato 11481051")
    print("Motor: GDAL/OGR + Cluster de endpoints")
    print("=" * 60)

    if len(sys.argv) >= 2:
        dxf = sys.argv[1]
        nucleo = Path(dxf).stem.replace("_ESGOTO", "").replace("_", " ").title()
        out = sys.argv[2] if len(sys.argv) >= 3 else str(Path(dxf).parent / "SAIDA_NS")
        processar_nucleo(dxf, nucleo, out)
    else:
        total_ok, total_err = 0, 0
        for item in NUCLEOS_BATCH:
            if os.path.exists(item["dxf"]):
                n_ok, n_err = processar_nucleo(item["dxf"], item["nucleo"], OUT_DIR)
                total_ok += n_ok; total_err += n_err
            else:
                log(f"DXF nao encontrado: {item['dxf']}", "WARN")

        print(f"\n{'='*60}")
        print(f"TOTAL: {total_ok} NS geradas, {total_err} erros")
        print(f"Pasta: {OUT_DIR}")
        print(f"{'='*60}")
