# -*- coding: utf-8 -*-
"""
Geracao de Folha de Cadastro A4 - Padrao Sabesp NTS0292
Gera DXF (compativel com AutoCAD) e PDF.

Ref: NTS0292 Ver 4 - Elaboracao de Cadastro Tecnico Digital
Ref: TETEU - CADASTRO A4.pdf (exemplo real de 12 folhas)
"""

import ezdxf
from ezdxf.enums import TextEntityAlignment
import math
import os
from datetime import datetime

# =============================================================================
# Constantes da Folha A4
# =============================================================================

FOLHA_W = 297    # mm
FOLHA_H = 210    # mm
MARGEM = 7       # mm

AREA_W = FOLHA_W - 2 * MARGEM   # 283 mm
AREA_H = FOLHA_H - 2 * MARGEM   # 196 mm

CARIMBO_H = 32   # altura do carimbo em mm
DESENHO_Y = MARGEM + CARIMBO_H + 2   # y inferior da area de desenho
DESENHO_H = AREA_H - CARIMBO_H - 2   # ~162 mm de area de desenho

# Cores AutoCAD (ACI) conforme NTS0292
COR_WHITE = 7
COR_RED = 1       # Rede executada (vermelho)
COR_GREEN = 3
COR_CYAN = 4
COR_YELLOW = 2
COR_250 = 250     # Quadra
COR_251 = 251     # Amarracao
COR_252 = 252     # Margem externa
COR_160 = 160     # Rede remanejada
COR_254 = 254     # Grade


# =============================================================================
# Funcoes auxiliares
# =============================================================================

def format_coord(value, decimals=3):
    """Formata coordenada: 7351654.143"""
    return f'{float(value):.{decimals}f}'


def format_cota(value, decimals=3):
    """Formata cota: -1.069 ou 2.115"""
    return f'{float(value):.{decimals}f}'


def calc_inclinacao(cf1, cf2, comp):
    """Calcula inclinacao entre dois pontos (cota fundo)."""
    if comp <= 0:
        return 0
    return abs(float(cf2) - float(cf1)) / comp


# =============================================================================
# Setup DXF
# =============================================================================

def setup_layers(doc):
    """Cria todos os layers conforme NTS0292 Tabela C1."""
    layers = doc.layers

    def add(name, color=COR_WHITE, linetype='Continuous', lineweight=None, plot=True):
        ly = layers.add(name, color=color)
        ly.dxf.linetype = linetype
        if lineweight is not None:
            ly.dxf.lineweight = lineweight
        if not plot:
            ly.dxf.plot = 0

    add('Folha', COR_WHITE)
    add('Margem interna', COR_WHITE)
    add('Margem externa', COR_252)
    add('Campos', COR_WHITE)
    add('Grade', COR_254, plot=False)
    add('Legenda', COR_WHITE)
    add('Texto legenda', COR_WHITE)
    add('Logo Sabesp', COR_WHITE, lineweight=9)
    add('Quadra', COR_250, lineweight=20)
    add('Guia', 32, linetype='DASHDOT2', lineweight=9)
    add('Rede executada', COR_RED, lineweight=50)       # VERMELHO
    add('Rede existente', COR_WHITE, linetype='DASHED', lineweight=30)
    add('Rede abandonada', COR_WHITE, lineweight=30)
    add('Rede remanejada', COR_160, lineweight=50)
    add('Texto', COR_WHITE, lineweight=9)
    add('Amarracao', COR_251, linetype='HIDDEN2', lineweight=5)
    add('Pecas executadas', COR_RED, lineweight=35)      # VERMELHO
    add('Pecas existentes', COR_WHITE, lineweight=35)
    add('Pecas abandonadas', COR_WHITE, linetype='HIDDEN2', lineweight=35)
    add('Linha de Projecao', 20, linetype='HIDDEN2', lineweight=5)
    add('Simbolos', COR_WHITE)

    # Linetypes
    if 'DASHED' not in doc.linetypes:
        doc.linetypes.add('DASHED', pattern=[1.0, 0.5, -0.25])
    if 'HIDDEN2' not in doc.linetypes:
        doc.linetypes.add('HIDDEN2', pattern=[0.5, 0.25, -0.125])
    if 'DASHDOT2' not in doc.linetypes:
        doc.linetypes.add('DASHDOT2', pattern=[1.0, 0.5, -0.125, 0.0, -0.125])


# =============================================================================
# Desenho da Folha A4
# =============================================================================

def draw_folha(msp):
    """Desenha margens da folha A4."""
    # Margem externa
    msp.add_lwpolyline(
        [(0, 0), (FOLHA_W, 0), (FOLHA_W, FOLHA_H), (0, FOLHA_H), (0, 0)],
        dxfattribs={'layer': 'Margem externa'}
    )
    # Margem interna
    msp.add_lwpolyline(
        [(MARGEM, MARGEM), (FOLHA_W - MARGEM, MARGEM),
         (FOLHA_W - MARGEM, FOLHA_H - MARGEM),
         (MARGEM, FOLHA_H - MARGEM), (MARGEM, MARGEM)],
        dxfattribs={'layer': 'Margem interna'}
    )


def draw_titulo(msp):
    """Titulo 'FOLHA DE CADASTRO' no topo."""
    msp.add_text(
        'FOLHA DE CADASTRO',
        dxfattribs={'layer': 'Texto legenda', 'height': 5, 'style': 'Arial'}
    ).set_placement((FOLHA_W / 2, FOLHA_H - MARGEM - 5),
                    align=TextEntityAlignment.TOP_CENTER)


def draw_norte(msp, x=None, y=None):
    """Simbolo do Norte."""
    if x is None:
        x = MARGEM + 15
    if y is None:
        y = FOLHA_H - MARGEM - 20
    r = 5

    # Circulo com seta
    msp.add_circle((x, y), r, dxfattribs={'layer': 'Simbolos'})
    msp.add_line((x, y - r), (x, y + r + 3), dxfattribs={'layer': 'Simbolos'})
    msp.add_line((x, y + r + 3), (x - 1.5, y + r), dxfattribs={'layer': 'Simbolos'})
    msp.add_line((x, y + r + 3), (nx := x + 1.5, y + r), dxfattribs={'layer': 'Simbolos'})
    msp.add_text('N', dxfattribs={
        'layer': 'Simbolos', 'height': 3.5, 'style': 'Arial'
    }).set_placement((x, y + r + 4), align=TextEntityAlignment.BOTTOM_CENTER)


# =============================================================================
# Carimbo (Legenda)
# =============================================================================

def draw_carimbo(msp, info):
    """Desenha carimbo padrao Sabesp NTS0292 na parte inferior."""
    x0 = MARGEM
    y0 = MARGEM
    w = AREA_W
    h = CARIMBO_H

    # Contorno
    msp.add_lwpolyline(
        [(x0, y0), (x0 + w, y0), (x0 + w, y0 + h), (x0, y0 + h), (x0, y0)],
        dxfattribs={'layer': 'Campos'}
    )

    # Linhas horizontais (4 faixas de 8mm)
    for dy in [8, 16, 24]:
        msp.add_line((x0, y0 + dy), (x0 + w, y0 + dy),
                     dxfattribs={'layer': 'Campos'})

    # Logo Sabesp (canto direito)
    logo_x = x0 + w - 32
    msp.add_line((logo_x, y0), (logo_x, y0 + h), dxfattribs={'layer': 'Campos'})

    # Divisoes verticais por faixa
    # Faixa 1 (y0 a y0+8): Eng / Fiscal
    msp.add_line((x0 + 115, y0), (x0 + 115, y0 + 8), dxfattribs={'layer': 'Campos'})

    # Faixa 2 (y0+8 a y0+16): Obs / Met / DataDes / DataAprov / Local / DataObra
    for cx in [38, 85, 115, 160, 220]:
        msp.add_line((x0 + cx, y0 + 8), (x0 + cx, y0 + 16), dxfattribs={'layer': 'Campos'})

    # Faixa 3 (y0+16 a y0+24): RN / Datum / Cruz / Desenh / CadTec / Contrat / Contrato
    for cx in [38, 72, 95, 115, 160, 220]:
        msp.add_line((x0 + cx, y0 + 16), (x0 + cx, y0 + 24), dxfattribs={'layer': 'Campos'})

    # Faixa 4 (y0+24 a y0+32): ExtExec / ExtAband / Folha / Pasta / Municipio / CadAgua / CadEsg
    for cx in [38, 72, 95, 115, 160, 200]:
        msp.add_line((x0 + cx, y0 + 24), (x0 + cx, y0 + 32), dxfattribs={'layer': 'Campos'})

    # --- Textos fixos ---
    th = 1.3
    def fixo(text, px, py):
        msp.add_text(text, dxfattribs={
            'layer': 'Texto legenda', 'height': th, 'style': 'Arial'
        }).set_placement((x0 + px, y0 + py), align=TextEntityAlignment.BOTTOM_LEFT)

    tv = 1.8
    def var(text, px, py):
        msp.add_text(str(text), dxfattribs={
            'layer': 'Legenda', 'height': tv, 'style': 'Arial'
        }).set_placement((x0 + px, y0 + py), align=TextEntityAlignment.BOTTOM_LEFT)

    # Faixa 4 (superior) - titulos
    fixo('Extensao Executada(m)', 1, 30)
    fixo('Extensao Abandonada(m)', 39, 30)
    fixo('No Folha', 73, 30)
    fixo('No Pasta', 96, 30)
    fixo('Nome  -  codigo do municipio', 116, 30)
    fixo('CADASTRO AGUA', 163, 30)
    fixo('CADASTRO ESGOTO', 203, 30)

    # Faixa 3 - titulos
    fixo('No RN/Vertice Sabesp', 1, 22)
    fixo('Datum horiz. Sirgas2000', 39, 22)
    fixo('No Cruzamento', 73, 22)
    fixo('Desenhista da contratada', 96, 22)
    fixo('Cadastro Tecnico   Sabesp', 116, 22)
    fixo('Contratada', 161, 22)
    fixo('Contrato:', 221, 22)

    # Faixa 2 - titulos
    fixo('Observacoes', 1, 14)
    fixo('Met.construtivo', 39, 14)
    fixo('Data do desenho', 86, 14)
    fixo('Data aprovacao', 116, 14)
    fixo('Local   -   Tipo de obra', 161, 14)
    fixo('Data da Obra', 221, 14)

    # Faixa 1 - titulos
    fixo('Eng.a Contratada:', 1, 1)
    fixo('CREA No', 1, 4)
    fixo('Eng.a Fiscal: .', 116, 1)
    fixo('CREA No', 116, 4)

    # --- Checkbox AGUA/ESGOTO ---
    tipo = info.get('tipo', 'ESGOTO').upper()
    for bx, check_val in [(161, 'AGUA'), (201, 'ESGOTO')]:
        bx0, by0 = x0 + bx, y0 + 29
        msp.add_lwpolyline(
            [(bx0, by0), (bx0+2.5, by0), (bx0+2.5, by0+2.5), (bx0, by0+2.5), (bx0, by0)],
            dxfattribs={'layer': 'Campos'})
        if check_val in tipo:
            msp.add_line((bx0, by0), (bx0+2.5, by0+2.5), dxfattribs={'layer': 'Campos'})
            msp.add_line((bx0+2.5, by0), (bx0, by0+2.5), dxfattribs={'layer': 'Campos'})

    # Logo Sabesp (texto grande)
    msp.add_text('Sabesp', dxfattribs={
        'layer': 'Logo Sabesp', 'height': 6, 'style': 'Arial',
    }).set_placement((logo_x + 16, y0 + 10), align=TextEntityAlignment.MIDDLE_CENTER)

    # Formato ABNT
    fixo('Formato ABNT-ISO A4 = 297 X 210', logo_x + 2, y0 - 2.5)

    # --- Textos variaveis ---
    var(info.get('extensao_exec', ''), 1, 26)
    var(info.get('extensao_aband', '0,00'), 39, 26)
    var(info.get('n_folha', '001'), 73, 26)
    var(info.get('n_pasta', ''), 96, 26)
    var(info.get('municipio', ''), 116, 26)
    var(info.get('rn_vertice', ''), 1, 18)
    var('UTM Fuso 23m', 39, 18)
    var(info.get('n_cruzamento', ''), 73, 18)
    var(info.get('desenhista', ''), 96, 18)
    var(info.get('contratada', ''), 161, 18)
    var(info.get('contrato', ''), 221, 18)
    var(info.get('observacoes', ''), 1, 9)
    var(info.get('met_construtivo', 'VCA'), 39, 9)
    var(info.get('data_desenho', datetime.now().strftime('%d/%m/%Y')), 86, 9)
    var(info.get('local_tipo', ''), 161, 9)
    var(info.get('data_obra', ''), 221, 9)


# =============================================================================
# Desenho da Rede no trecho
# =============================================================================

def draw_cartografia_dxf(msp, cartografia, pvs, area_bounds):
    """Desenha cartografia no DXF, recortada para a area do trecho."""
    if not cartografia or not pvs:
        return

    ax, ay, aw, ah = area_bounds

    # Extent do trecho (com margem)
    min_e = min(float(p['este']) for p in pvs)
    max_e = max(float(p['este']) for p in pvs)
    min_n = min(float(p['norte']) for p in pvs)
    max_n = max(float(p['norte']) for p in pvs)
    dx = max_e - min_e or 1
    dy = max_n - min_n or 1

    # Expandir 30% para cartografia ao redor
    margin_expand = 0.3
    min_e -= dx * margin_expand
    max_e += dx * margin_expand
    min_n -= dy * margin_expand
    max_n += dy * margin_expand

    # Escala
    dx2 = max_e - min_e
    dy2 = max_n - min_n
    margin_pct = 0.05
    scale_x = aw * (1 - 2 * margin_pct) / dx2
    scale_y = ah * (1 - 2 * margin_pct) / dy2
    scale = min(scale_x, scale_y)

    ox = ax + (aw - dx2 * scale) / 2 - min_e * scale
    oy = ay + (ah - dy2 * scale) / 2 - min_n * scale

    def to_paper(este, norte):
        return (float(este) * scale + ox, float(norte) * scale + oy)

    for elem in cartografia:
        pts = elem['pontos']
        # Verificar se pelo menos um ponto esta na area do trecho
        in_area = any(min_e <= p[0] <= max_e and min_n <= p[1] <= max_n for p in pts)
        if not in_area:
            continue

        paper_pts = [to_paper(p[0], p[1]) for p in pts]
        if len(paper_pts) >= 2:
            msp.add_lwpolyline(paper_pts, dxfattribs={'layer': 'Quadra'})


def draw_trecho(msp, pvs, redes_info, area_bounds):
    """
    Desenha um trecho da rede na area de desenho.

    pvs: lista de dicts com:
        nome, este, norte, cota_tampa (CT), cota_fundo (CF), prof,
        tipo ('PVE', 'PI', 'PV', etc.)
    redes_info: dict com diametro, material, met_construtivo
    area_bounds: (x0, y0, w, h) da area de desenho em mm
    """
    if not pvs:
        return

    ax, ay, aw, ah = area_bounds

    # Calcular escala para caber na area de desenho
    min_e = min(float(p['este']) for p in pvs)
    max_e = max(float(p['este']) for p in pvs)
    min_n = min(float(p['norte']) for p in pvs)
    max_n = max(float(p['norte']) for p in pvs)

    dx = max_e - min_e or 1
    dy = max_n - min_n or 1

    margin_pct = 0.15  # mais margem para anotacoes
    scale_x = aw * (1 - 2 * margin_pct) / dx
    scale_y = ah * (1 - 2 * margin_pct) / dy
    scale = min(scale_x, scale_y)

    ox = ax + (aw - dx * scale) / 2 - min_e * scale
    oy = ay + (ah - dy * scale) / 2 - min_n * scale

    def to_paper(este, norte):
        return (float(este) * scale + ox, float(norte) * scale + oy)

    diametro = redes_info.get('diametro', '200')
    material = redes_info.get('material', 'PVC')
    met_const = redes_info.get('met_construtivo', 'VCA')
    tubo_text = f'O/{diametro}/{material}/{met_const}'

    # --- Desenhar linhas da rede (VERMELHO) ---
    # Distancia maxima real entre pontos para considerar trecho
    DIST_MAX = float(redes_info.get('dist_max_rede', 50.0))

    for i in range(len(pvs) - 1):
        p1, p2 = pvs[i], pvs[i + 1]

        # Distancia real entre os pontos
        dist_real = math.sqrt((float(p2['este'])-float(p1['este']))**2 +
                              (float(p2['norte'])-float(p1['norte']))**2)
        if dist_real > DIST_MAX:
            continue  # NAO conectar pontos distantes

        x1, y1 = to_paper(p1['este'], p1['norte'])
        x2, y2 = to_paper(p2['este'], p2['norte'])

        # Linha da rede
        msp.add_line((x1, y1), (x2, y2), dxfattribs={'layer': 'Rede executada'})

        # Calculos
        comp = math.sqrt((float(p2['este'])-float(p1['este']))**2 +
                        (float(p2['norte'])-float(p1['norte']))**2)
        cf1 = float(p1.get('cota_fundo', 0))
        cf2 = float(p2.get('cota_fundo', 0))
        incl = calc_inclinacao(cf1, cf2, comp) if cf1 != 0 and cf2 != 0 else 0

        # Ponto medio
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        angulo = math.degrees(math.atan2(y2 - y1, x2 - x1))

        # Comprimento sobre a rede
        msp.add_text(
            f'{comp:.2f}',
            dxfattribs={'layer': 'Texto', 'height': 1.8, 'style': 'Arial', 'rotation': angulo}
        ).set_placement((mx, my + 2), align=TextEntityAlignment.BOTTOM_CENTER)

        # Diametro/Material sob a rede
        msp.add_text(
            tubo_text,
            dxfattribs={'layer': 'Texto', 'height': 1.5, 'style': 'Arial', 'rotation': angulo}
        ).set_placement((mx, my - 1), align=TextEntityAlignment.TOP_CENTER)

        # Inclinacao
        if incl > 0:
            msp.add_text(
                f'i: {incl:.4f}',
                dxfattribs={'layer': 'Texto', 'height': 1.2, 'style': 'Arial', 'rotation': angulo}
            ).set_placement((mx, my - 3), align=TextEntityAlignment.TOP_CENTER)

        # Profundidades nos extremos (sobre a rede)
        prof1 = float(p1.get('prof', 0))
        prof2 = float(p2.get('prof', 0))
        if prof1 > 0:
            msp.add_text(
                f'{prof1:.2f}',
                dxfattribs={'layer': 'Texto', 'height': 1.2, 'style': 'Arial'}
            ).set_placement((x1 + 1.5, y1 + 1.5), align=TextEntityAlignment.BOTTOM_LEFT)
        if prof2 > 0 and i == len(pvs) - 2:
            msp.add_text(
                f'{prof2:.2f}',
                dxfattribs={'layer': 'Texto', 'height': 1.2, 'style': 'Arial'}
            ).set_placement((x2 + 1.5, y2 + 1.5), align=TextEntityAlignment.BOTTOM_LEFT)

    # --- Desenhar PVs/PIs (singularidades) ---
    r = 1.5  # raio do simbolo em mm

    # Pre-calcular posicoes no papel
    paper_positions = []
    for pt in pvs:
        px, py = to_paper(pt['este'], pt['norte'])
        paper_positions.append((px, py))

    # Calcular melhor direcao para cada anotacao (evitar sobreposicao)
    # 8 direcoes possiveis: NE, N, NW, E, W, SE, S, SW
    DIRECTIONS = [
        (1, 1, TextEntityAlignment.BOTTOM_LEFT),    # NE
        (0, 1, TextEntityAlignment.BOTTOM_CENTER),   # N
        (-1, 1, TextEntityAlignment.BOTTOM_RIGHT),   # NW
        (1, 0, TextEntityAlignment.MIDDLE_LEFT),     # E
        (-1, 0, TextEntityAlignment.MIDDLE_RIGHT),   # W
        (1, -1, TextEntityAlignment.TOP_LEFT),       # SE
        (0, -1, TextEntityAlignment.TOP_CENTER),     # S
        (-1, -1, TextEntityAlignment.TOP_RIGHT),     # SW
    ]

    used_zones = []  # [(cx, cy, w, h)] zonas ocupadas por anotacoes

    # Calcular distancia minima entre pontos para ajustar annot_dist
    min_pt_dist = 999
    for i_p in range(len(paper_positions)):
        for j_p in range(i_p + 1, len(paper_positions)):
            d = math.sqrt((paper_positions[i_p][0] - paper_positions[j_p][0])**2 +
                          (paper_positions[i_p][1] - paper_positions[j_p][1])**2)
            if d > 0.1 and d < min_pt_dist:
                min_pt_dist = d

    # Distancia base: maior quando pontos estao proximos
    annot_dist_base = max(12, min(30, min_pt_dist * 0.8))

    for idx, pt in enumerate(pvs):
        px, py = paper_positions[idx]
        nome = pt.get('nome', '')
        tipo = pt.get('tipo', 'PI').upper()

        # Simbologia
        layer_peca = 'Pecas executadas'
        msp.add_circle((px, py), r, dxfattribs={'layer': layer_peca})
        if tipo in ('PVE', 'PV', 'PI'):
            msp.add_line((px-r*0.7, py-r*0.7), (px+r*0.7, py+r*0.7),
                        dxfattribs={'layer': layer_peca})
            msp.add_line((px-r*0.7, py+r*0.7), (px+r*0.7, py-r*0.7),
                        dxfattribs={'layer': layer_peca})

        ct = float(pt.get('cota_tampa', 0))
        cf = float(pt.get('cota_fundo', 0))

        # Encontrar melhor direcao e distancia (evitar sobreposicao)
        best_dir = 0
        best_score = -9999
        best_dist = annot_dist_base

        annot_w = 18  # largura estimada do bloco de anotacao
        annot_h = 12  # altura estimada

        # Tentar multiplas distancias se necessario
        for try_dist in [annot_dist_base, annot_dist_base * 1.5, annot_dist_base * 2.0]:
            for d_idx, (dx_dir, dy_dir, _) in enumerate(DIRECTIONS):
                cx = px + dx_dir * try_dist
                cy = py + dy_dir * try_dist

                score = 0
                # Penalizar proximidade a outros pontos
                for j, (ox, oy) in enumerate(paper_positions):
                    if j != idx:
                        d = math.sqrt((cx - ox)**2 + (cy - oy)**2)
                        score += min(d, 30)

                # Penalizar sobreposicao com anotacoes existentes
                overlap = False
                for (zx, zy, zw, zh) in used_zones:
                    if abs(cx - zx) < (annot_w + zw)/2 and abs(cy - zy) < (annot_h + zh)/2:
                        score -= 200  # penalidade muito forte
                        overlap = True

                # Bonus para cima
                if dy_dir > 0:
                    score += 5

                # Penalizar distancias maiores (preferir mais perto se nao sobrepos)
                score -= (try_dist - annot_dist_base) * 2

                if score > best_score:
                    best_score = score
                    best_dir = d_idx
                    best_dist = try_dist

            # Se encontrou posicao sem overlap, parar
            if best_score > -100:
                break

        dx_dir, dy_dir, align_h = DIRECTIONS[best_dir]
        text_x = px + dx_dir * best_dist
        text_y = py + dy_dir * best_dist

        # Registrar zona ocupada
        used_zones.append((text_x, text_y, annot_w, annot_h))

        # Linha de chamada (leader)
        msp.add_line((px + dx_dir * r, py + dy_dir * r),
                    (text_x - dx_dir * 1.5, text_y - dy_dir * 1.5),
                    dxfattribs={'layer': 'Amarracao'})

        line_h = 1.6
        th = 1.2

        # Bloco de anotacao (ref TETEU):
        #   N:7351654.065  /PI\
        #   E: 359376.269  \nome/
        #   CT:2.134
        #   CF:1.634

        # Nome/tipo compacto (uma linha so)
        if nome:
            label = f'{nome}'
        else:
            label = tipo

        # Ajustar posicao base dependendo da direcao
        if dy_dir >= 0:  # anotacao acima: texto de baixo para cima
            base_y = text_y
            step = line_h
        else:  # anotacao abaixo: texto de cima para baixo
            base_y = text_y
            step = -line_h

        # Tipo/nome (primeira linha, maior)
        msp.add_text(
            f'{tipo} {label}' if label != tipo else tipo,
            dxfattribs={'layer': 'Texto', 'height': 1.4, 'style': 'Arial'}
        ).set_placement((text_x, base_y + 4 * step), align=align_h)

        # N: E: CT: CF:
        msp.add_text(
            f'N:{format_coord(pt["norte"])}',
            dxfattribs={'layer': 'Texto', 'height': th, 'style': 'Arial'}
        ).set_placement((text_x, base_y + 3 * step), align=align_h)

        msp.add_text(
            f'E: {format_coord(pt["este"])}',
            dxfattribs={'layer': 'Texto', 'height': th, 'style': 'Arial'}
        ).set_placement((text_x, base_y + 2 * step), align=align_h)

        if ct != 0:
            msp.add_text(
                f'CT:{format_cota(ct)}',
                dxfattribs={'layer': 'Texto', 'height': th, 'style': 'Arial'}
            ).set_placement((text_x, base_y + 1 * step), align=align_h)

        if cf != 0:
            msp.add_text(
                f'CF:{format_cota(cf)}',
                dxfattribs={'layer': 'Texto', 'height': th, 'style': 'Arial'}
            ).set_placement((text_x, base_y), align=align_h)


# =============================================================================
# Detalhes ampliados (insets)
# =============================================================================

def draw_detalhes_dxf(msp, pvs, redes_info, area_bounds):
    """
    Desenha detalhes ampliados (insets) na parte inferior da area de desenho.
    Cada detalhe mostra um trecho PI-PI com anotacoes, profundidades e inclinacao.
    Gera detalhes para cada par de pontos consecutivos com distancia < 15m.
    """
    if len(pvs) < 2:
        return

    ax, ay, aw, ah = area_bounds

    diametro = redes_info.get('diametro', '200')
    material = redes_info.get('material', 'PVC')
    met_const = redes_info.get('met_construtivo', 'VCA')
    tubo_text = f'O/{diametro}/{material}/{met_const}'

    # Identificar trechos curtos que precisam de detalhe (< 15m)
    detalhe_pairs = []
    for i in range(len(pvs) - 1):
        p1, p2 = pvs[i], pvs[i + 1]
        comp = math.sqrt((float(p2['este'])-float(p1['este']))**2 +
                        (float(p2['norte'])-float(p1['norte']))**2)
        if comp < 15:
            detalhe_pairs.append((i, i + 1, comp))

    if not detalhe_pairs:
        return

    # Layout: detalhes no rodape da area de desenho, lado a lado
    det_w = 65   # largura de cada detalhe em mm
    det_h = 28   # altura
    det_gap = 5  # espaco entre detalhes
    max_det = min(len(detalhe_pairs), int((aw - 10) / (det_w + det_gap)))

    start_x = ax + 10
    start_y = ay + 2  # logo acima do carimbo

    for d_idx in range(max_det):
        i1, i2, comp = detalhe_pairs[d_idx]
        p1, p2 = pvs[i1], pvs[i2]

        dx = start_x + d_idx * (det_w + det_gap)
        dy = start_y

        # Caixa do detalhe
        msp.add_lwpolyline(
            [(dx, dy), (dx + det_w, dy), (dx + det_w, dy + det_h),
             (dx, dy + det_h), (dx, dy)],
            dxfattribs={'layer': 'Campos'}
        )

        # Titulo "DETALHE"
        msp.add_text('DETALHE', dxfattribs={
            'layer': 'Texto', 'height': 1.5, 'style': 'Arial'
        }).set_placement((dx + det_w / 2, dy + det_h - 1),
                        align=TextEntityAlignment.TOP_CENTER)

        # Simbolos dos 2 pontos (esquerdo e direito)
        py_line = dy + 10  # y da linha da rede
        px1 = dx + 12      # x ponto esquerdo
        px2 = dx + det_w - 12  # x ponto direito
        pr = 1.2

        # Ponto 1 (esquerdo)
        nome1 = p1.get('nome', '')
        tipo1 = p1.get('tipo', 'PI')
        msp.add_circle((px1, py_line), pr, dxfattribs={'layer': 'Pecas executadas'})
        msp.add_line((px1-pr*0.7, py_line-pr*0.7), (px1+pr*0.7, py_line+pr*0.7),
                    dxfattribs={'layer': 'Pecas executadas'})
        msp.add_line((px1-pr*0.7, py_line+pr*0.7), (px1+pr*0.7, py_line-pr*0.7),
                    dxfattribs={'layer': 'Pecas executadas'})

        # Ponto 2 (direito)
        nome2 = p2.get('nome', '')
        tipo2 = p2.get('tipo', 'PI')
        msp.add_circle((px2, py_line), pr, dxfattribs={'layer': 'Pecas executadas'})
        msp.add_line((px2-pr*0.7, py_line-pr*0.7), (px2+pr*0.7, py_line+pr*0.7),
                    dxfattribs={'layer': 'Pecas executadas'})
        msp.add_line((px2-pr*0.7, py_line+pr*0.7), (px2+pr*0.7, py_line-pr*0.7),
                    dxfattribs={'layer': 'Pecas executadas'})

        # Linha da rede entre eles
        msp.add_line((px1 + pr, py_line), (px2 - pr, py_line),
                    dxfattribs={'layer': 'Rede executada'})

        th = 1.0
        # Anotacoes ponto 1 (acima esquerdo)
        ct1 = float(p1.get('cota_tampa', 0))
        cf1 = float(p1.get('cota_fundo', 0))
        lbl1 = f'{tipo1} {nome1}' if nome1 else tipo1
        msp.add_text(f'N:{format_coord(p1["norte"])}', dxfattribs={
            'layer': 'Texto', 'height': th, 'style': 'Arial'
        }).set_placement((px1, py_line + 9), align=TextEntityAlignment.BOTTOM_CENTER)
        msp.add_text(f'E: {format_coord(p1["este"])}', dxfattribs={
            'layer': 'Texto', 'height': th, 'style': 'Arial'
        }).set_placement((px1, py_line + 7.5), align=TextEntityAlignment.BOTTOM_CENTER)
        if ct1: msp.add_text(f'CT:{format_cota(ct1)}', dxfattribs={
            'layer': 'Texto', 'height': th, 'style': 'Arial'
        }).set_placement((px1, py_line + 6), align=TextEntityAlignment.BOTTOM_CENTER)
        if cf1: msp.add_text(f'CF:{format_cota(cf1)}', dxfattribs={
            'layer': 'Texto', 'height': th, 'style': 'Arial'
        }).set_placement((px1, py_line + 4.5), align=TextEntityAlignment.BOTTOM_CENTER)
        msp.add_text(lbl1, dxfattribs={
            'layer': 'Texto', 'height': 1.2, 'style': 'Arial'
        }).set_placement((px1, py_line + 10.5), align=TextEntityAlignment.BOTTOM_CENTER)

        # Anotacoes ponto 2 (acima direito)
        ct2 = float(p2.get('cota_tampa', 0))
        cf2 = float(p2.get('cota_fundo', 0))
        lbl2 = f'{tipo2} {nome2}' if nome2 else tipo2
        msp.add_text(f'N:{format_coord(p2["norte"])}', dxfattribs={
            'layer': 'Texto', 'height': th, 'style': 'Arial'
        }).set_placement((px2, py_line + 9), align=TextEntityAlignment.BOTTOM_CENTER)
        msp.add_text(f'E: {format_coord(p2["este"])}', dxfattribs={
            'layer': 'Texto', 'height': th, 'style': 'Arial'
        }).set_placement((px2, py_line + 7.5), align=TextEntityAlignment.BOTTOM_CENTER)
        if ct2: msp.add_text(f'CT:{format_cota(ct2)}', dxfattribs={
            'layer': 'Texto', 'height': th, 'style': 'Arial'
        }).set_placement((px2, py_line + 6), align=TextEntityAlignment.BOTTOM_CENTER)
        if cf2: msp.add_text(f'CF:{format_cota(cf2)}', dxfattribs={
            'layer': 'Texto', 'height': th, 'style': 'Arial'
        }).set_placement((px2, py_line + 4.5), align=TextEntityAlignment.BOTTOM_CENTER)
        msp.add_text(lbl2, dxfattribs={
            'layer': 'Texto', 'height': 1.2, 'style': 'Arial'
        }).set_placement((px2, py_line + 10.5), align=TextEntityAlignment.BOTTOM_CENTER)

        # Profundidades nos extremos (sobre a rede)
        prof1 = float(p1.get('prof', 0))
        prof2 = float(p2.get('prof', 0))
        mx = (px1 + px2) / 2
        if prof1 > 0:
            msp.add_text(f'{prof1:.2f}', dxfattribs={
                'layer': 'Texto', 'height': th, 'style': 'Arial'
            }).set_placement((px1 + 3, py_line + 1.5), align=TextEntityAlignment.BOTTOM_CENTER)
        if prof2 > 0:
            msp.add_text(f'{prof2:.2f}', dxfattribs={
                'layer': 'Texto', 'height': th, 'style': 'Arial'
            }).set_placement((px2 - 3, py_line + 1.5), align=TextEntityAlignment.BOTTOM_CENTER)

        # Comprimento
        msp.add_text(f'{comp:.2f}', dxfattribs={
            'layer': 'Texto', 'height': 1.2, 'style': 'Arial'
        }).set_placement((mx, py_line + 1.5), align=TextEntityAlignment.BOTTOM_CENTER)

        # Inclinacao
        incl = calc_inclinacao(cf1, cf2, comp) if cf1 != 0 and cf2 != 0 else 0
        if incl > 0:
            msp.add_text(f'i: {incl:.4f}', dxfattribs={
                'layer': 'Texto', 'height': th, 'style': 'Arial'
            }).set_placement((mx, py_line - 1.5), align=TextEntityAlignment.TOP_CENTER)

        # Tubo
        msp.add_text(tubo_text, dxfattribs={
            'layer': 'Texto', 'height': th, 'style': 'Arial'
        }).set_placement((mx, py_line - 3.5), align=TextEntityAlignment.TOP_CENTER)


def draw_detalhes_pdf(c, pvs, redes_info, area_bounds, m_func):
    """Desenha detalhes ampliados no PDF."""
    from reportlab.lib.colors import HexColor, black

    if len(pvs) < 2:
        return

    m = m_func
    ax, ay, aw, ah = area_bounds
    COR_REDE = HexColor('#CC0000')

    diametro = redes_info.get('diametro', '200')
    material = redes_info.get('material', 'PVC')
    met_const = redes_info.get('met_construtivo', 'VCA')
    tubo_text = f'O/{diametro}/{material}/{met_const}'

    detalhe_pairs = []
    for i in range(len(pvs) - 1):
        p1, p2 = pvs[i], pvs[i + 1]
        comp = math.sqrt((float(p2['este'])-float(p1['este']))**2 +
                        (float(p2['norte'])-float(p1['norte']))**2)
        if comp < 15:
            detalhe_pairs.append((i, i + 1, comp))

    if not detalhe_pairs:
        return

    det_w = 65
    det_h = 28
    det_gap = 5
    max_det = min(len(detalhe_pairs), int((aw - 10) / (det_w + det_gap)))

    start_x = ax + 10
    start_y = ay + 2

    for d_idx in range(max_det):
        i1, i2, comp = detalhe_pairs[d_idx]
        p1, p2 = pvs[i1], pvs[i2]

        dx = start_x + d_idx * (det_w + det_gap)
        dy = start_y

        # Caixa
        c.setStrokeColor(black)
        c.setLineWidth(0.3)
        c.rect(m(dx), m(dy), m(det_w), m(det_h))

        # Titulo
        c.setFont('Helvetica-Bold', 5)
        c.setFillColor(black)
        c.drawCentredString(m(dx + det_w/2), m(dy + det_h - 2), 'DETALHE')

        py_line = dy + 10
        px1 = dx + 12
        px2 = dx + det_w - 12
        pr = m(1.2)

        # Simbolos
        c.setStrokeColor(COR_REDE)
        c.setLineWidth(1)
        c.circle(m(px1), m(py_line), pr, fill=0)
        c.line(m(px1)-pr*0.7, m(py_line)-pr*0.7, m(px1)+pr*0.7, m(py_line)+pr*0.7)
        c.line(m(px1)-pr*0.7, m(py_line)+pr*0.7, m(px1)+pr*0.7, m(py_line)-pr*0.7)
        c.circle(m(px2), m(py_line), pr, fill=0)
        c.line(m(px2)-pr*0.7, m(py_line)-pr*0.7, m(px2)+pr*0.7, m(py_line)+pr*0.7)
        c.line(m(px2)-pr*0.7, m(py_line)+pr*0.7, m(px2)+pr*0.7, m(py_line)-pr*0.7)

        # Rede
        c.setLineWidth(1.5)
        c.line(m(px1) + pr, m(py_line), m(px2) - pr, m(py_line))

        # Anotacoes
        c.setFillColor(black)
        c.setFont('Helvetica', 3.5)

        nome1 = p1.get('nome', '')
        tipo1 = p1.get('tipo', 'PI')
        ct1 = float(p1.get('cota_tampa', 0))
        cf1 = float(p1.get('cota_fundo', 0))
        lbl1 = f'{tipo1} {nome1}' if nome1 else tipo1

        c.setFont('Helvetica-Bold', 4)
        c.drawCentredString(m(px1), m(py_line + 11), lbl1)
        c.setFont('Helvetica', 3.5)
        c.drawCentredString(m(px1), m(py_line + 9), f'N:{format_coord(p1["norte"])}')
        c.drawCentredString(m(px1), m(py_line + 7.5), f'E: {format_coord(p1["este"])}')
        if ct1: c.drawCentredString(m(px1), m(py_line + 6), f'CT:{format_cota(ct1)}')
        if cf1: c.drawCentredString(m(px1), m(py_line + 4.5), f'CF:{format_cota(cf1)}')

        nome2 = p2.get('nome', '')
        tipo2 = p2.get('tipo', 'PI')
        ct2 = float(p2.get('cota_tampa', 0))
        cf2 = float(p2.get('cota_fundo', 0))
        lbl2 = f'{tipo2} {nome2}' if nome2 else tipo2

        c.setFont('Helvetica-Bold', 4)
        c.drawCentredString(m(px2), m(py_line + 11), lbl2)
        c.setFont('Helvetica', 3.5)
        c.drawCentredString(m(px2), m(py_line + 9), f'N:{format_coord(p2["norte"])}')
        c.drawCentredString(m(px2), m(py_line + 7.5), f'E: {format_coord(p2["este"])}')
        if ct2: c.drawCentredString(m(px2), m(py_line + 6), f'CT:{format_cota(ct2)}')
        if cf2: c.drawCentredString(m(px2), m(py_line + 4.5), f'CF:{format_cota(cf2)}')

        # Profundidades, comprimento, inclinacao
        mx = (px1 + px2) / 2
        prof1 = float(p1.get('prof', 0))
        prof2 = float(p2.get('prof', 0))

        c.setFont('Helvetica', 4)
        if prof1 > 0:
            c.drawCentredString(m(px1 + 3), m(py_line + 1.5), f'{prof1:.2f}')
        c.drawCentredString(m(mx), m(py_line + 1.5), f'{comp:.2f}')
        if prof2 > 0:
            c.drawCentredString(m(px2 - 3), m(py_line + 1.5), f'{prof2:.2f}')

        incl = calc_inclinacao(cf1, cf2, comp) if cf1 != 0 and cf2 != 0 else 0
        c.setFont('Helvetica', 3.5)
        if incl > 0:
            c.drawCentredString(m(mx), m(py_line - 2), f'i: {incl:.4f}')
        c.drawCentredString(m(mx), m(py_line - 4), tubo_text)


# =============================================================================
# Geracao DXF
# =============================================================================

def generate_dxf(pvs, output_path, info=None, redes_info=None, cartografia=None):
    """
    Gera arquivo DXF com a Folha de Cadastro A4 de um trecho.

    pvs: lista de dicts com este, norte, cota_tampa, cota_fundo, prof, nome, tipo
    output_path: caminho .dxf
    info: dict com campos do carimbo
    redes_info: dict com diametro, material, met_construtivo
    cartografia: lista de polylines [{pontos: [(x,y),...], layer: str}]
    """
    if info is None:
        info = {}
    if redes_info is None:
        redes_info = {}

    # Calcular extensao executada do trecho
    ext = 0
    for i in range(len(pvs) - 1):
        ext += math.sqrt(
            (float(pvs[i+1]['este']) - float(pvs[i]['este']))**2 +
            (float(pvs[i+1]['norte']) - float(pvs[i]['norte']))**2
        )
    info.setdefault('extensao_exec', f'{ext:.2f}m'.replace('.', ','))

    doc = ezdxf.new('R2010')
    doc.styles.add('Arial', font='arial.ttf')

    setup_layers(doc)
    msp = doc.modelspace()

    draw_folha(msp)
    draw_titulo(msp)
    draw_norte(msp)
    draw_carimbo(msp, info)

    # Area de desenho
    area = (MARGEM, DESENHO_Y, AREA_W, DESENHO_H)

    # Cartografia primeiro (fundo)
    if cartografia:
        draw_cartografia_dxf(msp, cartografia, pvs, area)

    # Rede por cima
    draw_trecho(msp, pvs, redes_info, area)

    # Detalhes ampliados
    draw_detalhes_dxf(msp, pvs, redes_info, area)

    doc.saveas(output_path)
    return output_path


# =============================================================================
# Geracao PDF
# =============================================================================

def generate_pdf(pvs, output_path, info=None, redes_info=None, cartografia=None):
    """
    Gera PDF da Folha de Cadastro A4 de um trecho.
    """
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas as pdf_canvas
    from reportlab.lib.colors import HexColor, black

    if info is None:
        info = {}
    if redes_info is None:
        redes_info = {}

    # Extensao
    ext = 0
    for i in range(len(pvs) - 1):
        ext += math.sqrt(
            (float(pvs[i+1]['este']) - float(pvs[i]['este']))**2 +
            (float(pvs[i+1]['norte']) - float(pvs[i]['norte']))**2
        )
    info.setdefault('extensao_exec', f'{ext:.2f}m'.replace('.', ','))

    c = pdf_canvas.Canvas(output_path, pagesize=landscape(A4))
    m = lambda v: v * mm

    COR_REDE = HexColor('#CC0000')  # Vermelho
    COR_TEXTO = black

    # --- Margens ---
    c.setStrokeColor(black)
    c.setLineWidth(0.5)
    c.rect(m(MARGEM), m(MARGEM), m(AREA_W), m(AREA_H))

    # --- Titulo ---
    c.setFont('Helvetica-Bold', 14)
    c.drawCentredString(m(FOLHA_W / 2), m(FOLHA_H - MARGEM - 6), 'FOLHA DE CADASTRO')

    # --- Carimbo ---
    x0 = m(MARGEM)
    y0 = m(MARGEM)
    w = m(AREA_W)
    h = m(CARIMBO_H)
    c.setLineWidth(0.3)
    c.rect(x0, y0, w, h)

    for dy in [8, 16, 24]:
        c.line(x0, y0 + m(dy), x0 + w, y0 + m(dy))

    logo_x = x0 + m(AREA_W - 32)
    c.line(logo_x, y0, logo_x, y0 + h)

    # Divisoes verticais faixa 4
    for cx in [38, 72, 95, 115, 160, 200]:
        c.line(x0 + m(cx), y0 + m(24), x0 + m(cx), y0 + m(32))
    # Faixa 3
    for cx in [38, 72, 95, 115, 160, 220]:
        c.line(x0 + m(cx), y0 + m(16), x0 + m(cx), y0 + m(24))
    # Faixa 2
    for cx in [38, 85, 115, 160, 220]:
        c.line(x0 + m(cx), y0 + m(8), x0 + m(cx), y0 + m(16))
    # Faixa 1
    c.line(x0 + m(115), y0, x0 + m(115), y0 + m(8))

    # Logo Sabesp
    c.setFont('Helvetica-Bold', 16)
    c.setFillColor(HexColor('#0055AA'))
    c.drawCentredString(logo_x + m(16), y0 + m(10), 'Sabesp')
    c.setFillColor(black)

    # Textos fixos carimbo
    c.setFont('Helvetica', 4.5)
    fixos = [
        (1, 30, 'Extensao Executada(m)'), (39, 30, 'Extensao Abandonada(m)'),
        (73, 30, 'No Folha'), (96, 30, 'No Pasta'),
        (116, 30, 'Nome  -  codigo do municipio'),
        (163, 30, 'CADASTRO AGUA'), (203, 30, 'CADASTRO ESGOTO'),
        (1, 22, 'No RN/Vertice Sabesp'), (39, 22, 'Datum horiz. Sirgas2000'),
        (73, 22, 'No Cruzamento'), (96, 22, 'Desenhista da contratada'),
        (116, 22, 'Cadastro Tecnico   Sabesp'),
        (161, 22, 'Contratada'), (221, 22, 'Contrato:'),
        (1, 14, 'Observacoes'), (39, 14, 'Met.construtivo'),
        (86, 14, 'Data do desenho'), (116, 14, 'Data aprovacao'),
        (161, 14, 'Local  -  Tipo de obra'), (221, 14, 'Data da Obra'),
        (1, 1, 'Eng.a Contratada:'), (1, 4, 'CREA No'),
        (116, 1, 'Eng.a Fiscal: .'), (116, 4, 'CREA No'),
    ]
    for tx, ty, text in fixos:
        c.drawString(x0 + m(tx), y0 + m(ty), text)

    # Checkbox
    tipo = info.get('tipo', 'ESGOTO').upper()
    for bx, cv in [(161, 'AGUA'), (201, 'ESGOTO')]:
        bx0, by0 = x0 + m(bx), y0 + m(29)
        c.rect(bx0, by0, m(2.5), m(2.5))
        if cv in tipo:
            c.line(bx0, by0, bx0 + m(2.5), by0 + m(2.5))
            c.line(bx0 + m(2.5), by0, bx0, by0 + m(2.5))

    # Variaveis carimbo
    c.setFont('Helvetica', 6)
    vars_t = [
        (1, 26, info.get('extensao_exec', '')),
        (39, 26, info.get('extensao_aband', '0,00')),
        (73, 26, info.get('n_folha', '001')),
        (96, 26, info.get('n_pasta', '')),
        (116, 26, info.get('municipio', '')),
        (1, 18, info.get('rn_vertice', '')),
        (39, 18, 'UTM Fuso 23m'),
        (73, 18, info.get('n_cruzamento', '')),
        (96, 18, info.get('desenhista', '')),
        (161, 18, info.get('contratada', '')),
        (1, 9, info.get('observacoes', '')),
        (39, 9, info.get('met_construtivo', 'VCA')),
        (86, 9, info.get('data_desenho', datetime.now().strftime('%d/%m/%Y'))),
        (161, 9, info.get('local_tipo', '')),
        (221, 9, info.get('data_obra', '')),
    ]
    for tx, ty, text in vars_t:
        c.drawString(x0 + m(tx), y0 + m(ty) + m(1), str(text))

    # Formato ABNT
    c.setFont('Helvetica', 3.5)
    c.drawString(logo_x + m(1), y0 - m(3), 'Formato ABNT-ISO A4 = 297 X 210')

    # --- Rede no desenho ---
    if pvs:
        area_x = MARGEM
        area_y = MARGEM + CARIMBO_H + 2
        area_w = AREA_W
        area_h = DESENHO_H

        min_e = min(float(p['este']) for p in pvs)
        max_e = max(float(p['este']) for p in pvs)
        min_n = min(float(p['norte']) for p in pvs)
        max_n = max(float(p['norte']) for p in pvs)
        dx = max_e - min_e or 1
        dy = max_n - min_n or 1

        margin_pct = 0.15
        sc_x = area_w * (1 - 2 * margin_pct) / dx
        sc_y = area_h * (1 - 2 * margin_pct) / dy
        sc = min(sc_x, sc_y)

        ox = area_x + (area_w - dx * sc) / 2 - min_e * sc
        oy = area_y + (area_h - dy * sc) / 2 - min_n * sc

        def tp(este, norte):
            return (m(float(este) * sc + ox), m(float(norte) * sc + oy))

        # Cartografia (fundo)
        if cartografia:
            c.setStrokeColor(HexColor('#999999'))
            c.setLineWidth(0.3)
            # Expandir extent para cartografia
            cart_min_e = min_e - dx * 0.3
            cart_max_e = max_e + dx * 0.3
            cart_min_n = min_n - dy * 0.3
            cart_max_n = max_n + dy * 0.3
            for elem in cartografia:
                pts = elem['pontos']
                in_area = any(cart_min_e <= p[0] <= cart_max_e and
                             cart_min_n <= p[1] <= cart_max_n for p in pts)
                if not in_area:
                    continue
                path = c.beginPath()
                sx, sy = tp(pts[0][0], pts[0][1])
                path.moveTo(sx, sy)
                for px, py in pts[1:]:
                    sx, sy = tp(px, py)
                    path.lineTo(sx, sy)
                c.drawPath(path, stroke=1, fill=0)

        diametro = redes_info.get('diametro', '200')
        material_r = redes_info.get('material', 'PVC')
        met_c = redes_info.get('met_construtivo', 'VCA')
        tubo = f'O/{diametro}/{material_r}/{met_c}'

        # Linhas da rede (VERMELHO)
        c.setStrokeColor(COR_REDE)
        c.setLineWidth(2)
        for i in range(len(pvs) - 1):
            p1, p2 = pvs[i], pvs[i+1]
            x1, y1 = tp(p1['este'], p1['norte'])
            x2, y2 = tp(p2['este'], p2['norte'])
            c.line(x1, y1, x2, y2)

            comp = math.sqrt((float(p2['este'])-float(p1['este']))**2 +
                            (float(p2['norte'])-float(p1['norte']))**2)
            cf1 = float(p1.get('cota_fundo', 0))
            cf2 = float(p2.get('cota_fundo', 0))
            incl = calc_inclinacao(cf1, cf2, comp) if cf1 != 0 and cf2 != 0 else 0

            mx_p, my_p = (x1+x2)/2, (y1+y2)/2

            c.setFillColor(COR_TEXTO)
            c.setFont('Helvetica', 5)
            c.drawCentredString(mx_p, my_p + m(2), f'{comp:.2f}')
            c.setFont('Helvetica', 4)
            c.drawCentredString(mx_p, my_p - m(1.5), tubo)
            if incl > 0:
                c.setFont('Helvetica', 3.5)
                c.drawCentredString(mx_p, my_p - m(3.5), f'i: {incl:.4f}')

        # Pontos (singularidades)
        pr = m(1.5)
        paper_pts = [tp(float(pt['este']), float(pt['norte'])) for pt in pvs]

        # Mesmo sistema de direcoes radiais do DXF
        PDF_DIRS = [
            (1, 1, 'left'),   # NE
            (0, 1, 'center'), # N
            (-1, 1, 'right'), # NW
            (1, 0, 'left'),   # E
            (-1, 0, 'right'), # W
            (1, -1, 'left'),  # SE
            (0, -1, 'center'),# S
            (-1, -1, 'right'),# SW
        ]
        annot_dist_pdf = m(12)
        used_zones_pdf = []

        for idx, pt in enumerate(pvs):
            px, py = paper_pts[idx]
            nome = pt.get('nome', '')
            tipo_pt = pt.get('tipo', 'PI').upper()

            c.setStrokeColor(COR_REDE)
            c.setLineWidth(1)
            c.circle(px, py, pr, fill=0)
            if tipo_pt in ('PI', 'PVE', 'PV'):
                c.line(px-pr*0.7, py-pr*0.7, px+pr*0.7, py+pr*0.7)
                c.line(px-pr*0.7, py+pr*0.7, px+pr*0.7, py-pr*0.7)

            # Melhor direcao
            best_dir = 0
            best_score = -999
            aw_est, ah_est = m(18), m(12)

            for d_idx, (dxd, dyd, _) in enumerate(PDF_DIRS):
                cx = px + dxd * annot_dist_pdf
                cy = py + dyd * annot_dist_pdf
                score = 0
                for j, (ox, oy) in enumerate(paper_pts):
                    if j != idx:
                        d = math.sqrt((cx-ox)**2 + (cy-oy)**2)
                        score += min(d, m(30))
                for (zx, zy, zw, zh) in used_zones_pdf:
                    if abs(cx-zx) < (aw_est+zw)/2 and abs(cy-zy) < (ah_est+zh)/2:
                        score -= m(50)
                if dyd > 0:
                    score += m(5)
                if score > best_score:
                    best_score = score
                    best_dir = d_idx

            dxd, dyd, align_mode = PDF_DIRS[best_dir]
            tx = px + dxd * annot_dist_pdf
            ty = py + dyd * annot_dist_pdf
            used_zones_pdf.append((tx, ty, aw_est, ah_est))

            # Linha de chamada
            c.setStrokeColor(HexColor('#999999'))
            c.setLineWidth(0.3)
            c.line(px + dxd * float(pr), py + dyd * float(pr), tx - dxd * m(1), ty - dyd * m(1))

            c.setFillColor(COR_TEXTO)
            lh = m(1.6)

            if align_mode == 'left':
                draw_fn = c.drawString
            elif align_mode == 'right':
                draw_fn = c.drawRightString
            else:
                draw_fn = c.drawCentredString

            step = lh if dyd >= 0 else -lh

            # Nome compacto
            label = f'{tipo_pt} {nome}' if nome and nome != tipo_pt else (nome or tipo_pt)
            c.setFont('Helvetica-Bold', 4.5)
            draw_fn(tx, ty + 4 * step, label)

            c.setFont('Helvetica', 3.5)
            draw_fn(tx, ty + 3 * step, f'N:{format_coord(pt["norte"])}')
            draw_fn(tx, ty + 2 * step, f'E: {format_coord(pt["este"])}')

            ct = float(pt.get('cota_tampa', 0))
            cf = float(pt.get('cota_fundo', 0))
            if ct != 0:
                draw_fn(tx, ty + 1 * step, f'CT:{format_cota(ct)}')
            if cf != 0:
                draw_fn(tx, ty, f'CF:{format_cota(cf)}')

    # Norte
    # Detalhes ampliados
    if pvs:
        det_area = (MARGEM, MARGEM + CARIMBO_H + 2, AREA_W, DESENHO_H)
        draw_detalhes_pdf(c, pvs, redes_info or {}, det_area, m)

    nx, ny = m(MARGEM + 15), m(FOLHA_H - MARGEM - 20)
    nr = m(5)
    c.setStrokeColor(black)
    c.setLineWidth(0.5)
    c.circle(nx, ny, nr, fill=0)
    c.line(nx, ny - nr, nx, ny + nr + m(3))
    c.line(nx, ny + nr + m(3), nx - m(1.5), ny + nr)
    c.line(nx, ny + nr + m(3), nx + m(1.5), ny + nr)
    c.setFont('Helvetica-Bold', 10)
    c.setFillColor(black)
    c.drawCentredString(nx, ny + nr + m(4), 'N')

    c.save()
    return output_path


# =============================================================================
# Geracao em lote (multiplas folhas)
# =============================================================================

def generate_batch(trechos, output_dir, base_name, info=None, redes_info=None, cartografia=None):
    """
    Gera multiplas folhas (1 por trecho).

    trechos: lista de listas de dicts (cada sub-lista = 1 folha)
    output_dir: pasta de saida
    base_name: nome base (ex: 'CADASTRO A4 - TETEU')
    info: dict base do carimbo (n_folha sera substituido)
    redes_info: dict
    cartografia: lista de polylines para o fundo
    """
    if info is None:
        info = {}
    if redes_info is None:
        redes_info = {}

    paths = []
    for i, trecho in enumerate(trechos, 1):
        folha_info = dict(info)
        folha_info['n_folha'] = f'{i:03d}'

        # Extensao do trecho
        ext = 0
        for j in range(len(trecho) - 1):
            ext += math.sqrt(
                (float(trecho[j+1]['este']) - float(trecho[j]['este']))**2 +
                (float(trecho[j+1]['norte']) - float(trecho[j]['norte']))**2
            )
        folha_info['extensao_exec'] = f'{ext:.2f}m'.replace('.', ',')

        dxf_path = os.path.join(output_dir, f'{base_name} - {i:03d}.dxf')
        pdf_path = os.path.join(output_dir, f'{base_name} - {i:03d}.pdf')

        generate_dxf(trecho, dxf_path, folha_info, redes_info, cartografia)
        generate_pdf(trecho, pdf_path, folha_info, redes_info, cartografia)

        paths.append((dxf_path, pdf_path))

    return paths
