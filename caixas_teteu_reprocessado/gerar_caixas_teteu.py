#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Reprocessa os .scr de caixas (UMA/CI) jogando o 'remanejar' nas casas do DWG.

Preserva as caixas ja posicionadas 'em casa' e relocaliza as ruas que estavam em
remanejar QUANDO elas possuem rotulo no DWG:
  - se houver footprints de edificacao suficientes perto do rotulo -> encaixa as
    caixas nas casas (centroide do footprint mais proximo, sem reusar casa ja ocupada);
  - senao -> posiciona uma grade arrumada sobre o proprio rotulo da rua.
Ruas sem rotulo no DWG continuam no bloco de remanejar (cluster ao sul + texto amarelo).

PRE-REQUISITO: exportar cada DWG para JSON com libredwg:
    dwgread -O JSON -o AGUA.json   ÁGUA_-_TETEUv2.dwg
    dwgread -O JSON -o ESGOTO.json ESGOTO_-_TETEU.dwg
(o JSON sai em cp1252 nos desenhos da AVT). Ajuste os caminhos em CONFIG.
"""
import json, re, math, unicodedata, os, sys

BOX_HALF  = 0.75     # caixa 1.5 x 1.5 m
SNAP_R    = 70.0     # raio de busca de casas ao redor do rotulo (m)
DUP_R     = 2.0      # nao reusar casa/caixa ja ocupada (m)
GRID_DX   = 3.0      # passo da grade de fallback (m)
GRID_COLS = 6
BLD_LAYER = 'AVT-LT-URB-CONSTRUÇÃO-EDIFICAÇÃO PREDIAL'   # footprints de casas
LBL_LAYER = 'ZZ-Carimbo Texto'                           # rotulos de rua

# (json_do_dwg, scr_de_entrada, layer_caixa, cor, layer_remanejar, scr_de_saida, tag)
HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = [
 (os.path.join(HERE,'entrada','AGUA.json'),   os.path.join(HERE,'entrada','COLOCAR_CAIXAS_UMA_AGUA.scr'),
  'CAIXA_UMA', 6, 'CAIXA_UMA_REMANEJAR',  os.path.join(HERE,'COLOCAR_CAIXAS_UMA_AGUA.scr'), 'AGUA/UMA'),
 (os.path.join(HERE,'entrada','ESGOTO.json'), os.path.join(HERE,'entrada','COLOCAR_CI_ESGOTO.scr'),
  'CAIXA_INSPECAO_CI', 4, 'CAIXA_INSPECAO_CI_REMANEJAR', os.path.join(HERE,'COLOCAR_CI_ESGOTO.scr'), 'ESGOTO/CI'),
]


def load(p):
    return json.loads(open(p, 'rb').read().decode('cp1252', errors='replace'))

def hv(h):
    return h[-1] if isinstance(h, list) and h else None

def norm(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', s).strip()

def streetkey(s):
    s = norm(s).replace('_', ' ')
    s = re.sub(r'\bteteu\b', '', s)
    return re.sub(r'\s+', ' ', s).strip()

def dwg_labels_buildings(jpath):
    objs = load(jpath)['OBJECTS']
    lmap = {hv(o.get('handle')): o.get('name') for o in objs if o.get('object') == 'LAYER'}
    labels, builds = {}, []
    for o in objs:
        ent = o.get('entity')
        if ent in ('TEXT', 'MTEXT') and lmap.get(hv(o.get('layer'))) == LBL_LAYER:
            t = (o.get('text_value') or o.get('text') or '').strip()
            pt = o.get('ins_pt', [None, None])
            if pt and pt[0] is not None:
                labels.setdefault(streetkey(t), (pt[0], pt[1]))
        elif ent == 'LWPOLYLINE' and lmap.get(hv(o.get('layer'))) == BLD_LAYER:
            pts = [(p[0], p[1]) for p in (o.get('points') or []) if isinstance(p, list) and len(p) >= 2]
            if pts:
                builds.append((sum(a for a, _ in pts) / len(pts), sum(b for _, b in pts) / len(pts)))
    ded = []   # varias polylines viram a mesma casa
    for c in builds:
        if all((c[0] - e[0]) ** 2 + (c[1] - e[1]) ** 2 > DUP_R * DUP_R for e in ded):
            ded.append(c)
    return labels, ded

def parse_scr(p):
    L = [l.rstrip('\n') for l in open(p, encoding='utf-8', errors='replace')]
    boxes, texts, i = [], [], 0
    while i < len(L):
        s = L[i].strip()
        if s == 'RECTANG':
            try:
                x1, y1 = map(float, L[i + 1].split(','))
                x2, y2 = map(float, L[i + 2].split(','))
                boxes.append(((x1 + x2) / 2, (y1 + y2) / 2)); i += 3; continue
            except Exception:
                pass
        if s == '-TEXT':
            try:
                tx, ty = map(float, L[i + 1].split(','))
                texts.append((L[i + 4].strip(), tx, ty)); i += 5; continue
            except Exception:
                pass
        i += 1
    return boxes, texts

def grid_at(cx, cy, n):
    out, rows = [], math.ceil(n / GRID_COLS)
    x0 = cx - (GRID_COLS - 1) * GRID_DX / 2
    y0 = cy + (rows - 1) * GRID_DX / 2
    for k in range(n):
        r, c = divmod(k, GRID_COLS)
        out.append((x0 + c * GRID_DX, y0 - r * GRID_DX))
    return out

def reprocess(jpath, scr_in):
    labels, builds = dwg_labels_buildings(jpath)
    boxes, texts = parse_scr(scr_in)

    # 1) particiona em-casa vs remanejar (N caixas mais proximas de cada texto REMANEJAR)
    used, groups = set(), []
    for val, tx, ty in texts:
        m = re.search(r'_(\d+)de(\d+)_', val)
        N = int(m.group(1))
        order = sorted(range(len(boxes)), key=lambda j: (boxes[j][0] - tx) ** 2 + (boxes[j][1] - ty) ** 2)
        grp = [j for j in order if j not in used][:N]
        used.update(grp)
        groups.append({'val': val, 'tx': tx, 'ty': ty, 'N': N, 'idx': grp})
    emcasa = [boxes[j] for j in range(len(boxes)) if j not in used]

    placed, occupied, rem_texts, report = list(emcasa), list(emcasa), [], []

    def free_houses_near(cx, cy):
        cand = [b for b in builds if (b[0] - cx) ** 2 + (b[1] - cy) ** 2 <= SNAP_R * SNAP_R]
        cand = [b for b in cand if all((b[0] - o[0]) ** 2 + (b[1] - o[1]) ** 2 > DUP_R * DUP_R for o in occupied)]
        cand.sort(key=lambda b: (b[0] - cx) ** 2 + (b[1] - cy) ** 2)
        return cand

    for g in groups:
        sk = streetkey(re.sub(r'_\d+de\d+_caixas$', '', g['val'].replace('REMANEJAR_', '')))
        lab = labels.get(sk)
        if lab is None:
            for j in g['idx']:
                placed.append(boxes[j]); occupied.append(boxes[j])
            rem_texts.append((g['val'], g['tx'], g['ty']))
            report.append((sk, g['N'], 'sem rotulo -> remanejar (cluster sul)'))
            continue
        free = free_houses_near(*lab)
        if len(free) >= g['N']:
            pts = free[:g['N']]
            for p in pts:
                placed.append(p); occupied.append(p)
            d = [((p[0] - lab[0]) ** 2 + (p[1] - lab[1]) ** 2) ** .5 for p in pts]
            report.append((sk, g['N'], f'encaixou em {g["N"]} casas ({min(d):.0f}-{max(d):.0f} m do rotulo)'))
        else:
            for p in grid_at(lab[0], lab[1], g['N']):
                placed.append(p); occupied.append(p)
            rows = math.ceil(g['N'] / GRID_COLS)
            rem_texts.append((f'CONFERIR_{sk.title().replace(" ", "_")}_{g["N"]}cx_no_rotulo',
                              lab[0], lab[1] + rows * GRID_DX / 2 + 2))
            report.append((sk, g['N'], f'grade no rotulo ({len(free)} casas livres < {g["N"]})'))
    return placed, rem_texts, report

def write_scr(path, layer, color, rem_layer, placed, rem_texts):
    L = ['OSMODE', '0', '-LAYER', 'M', layer, 'C', str(color), layer, 'S', layer, '']
    for cx, cy in placed:
        L += ['RECTANG', f'{cx-BOX_HALF:.3f},{cy-BOX_HALF:.3f}', f'{cx+BOX_HALF:.3f},{cy+BOX_HALF:.3f}']
    L += ['-LAYER', 'M', rem_layer, 'C', '2', rem_layer, 'S', rem_layer, '']
    for val, tx, ty in rem_texts:
        L += ['-TEXT', f'{tx:.3f},{ty:.3f}', '1.50', '0', val, '']
    L += ['', '']
    open(path, 'w', encoding='utf-8').write('\n'.join(L))

def main():
    for jpath, scr_in, layer, color, rem_layer, out, tag in CONFIG:
        if not (os.path.exists(jpath) and os.path.exists(scr_in)):
            print(f'[skip] {tag}: faltam entradas ({jpath} / {scr_in})'); continue
        placed, rem_texts, report = reprocess(jpath, scr_in)
        write_scr(out, layer, color, rem_layer, placed, rem_texts)
        print(f'\n===== {tag} =====  caixas={len(placed)}  textos_remanejar={len(rem_texts)}  -> {out}')
        for sk, N, msg in report:
            print(f'   {sk:24s} {N:3d}  {msg}')

if __name__ == '__main__':
    main()
