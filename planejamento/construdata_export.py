# -*- coding: utf-8 -*-
"""Exporta os DADOS REAIS da WCR num bundle JSON que o app ConstruData lê
(frontend/src/data/wcr/*.json). O motor vira a fonte de verdade do app:
- mapa.json     : rede real (nodes/segments lat-lng) do gpkg → tela mapa-interativo
- mao_de_obra.json : equipes/pessoas da lotação → tela mão de obra
- rdos.json     : produção diária do apontamento → tela RDO / EVM
- kpis.json     : agregados (% físico, frentes, rdos, produção) → gestão-360
Rodar: python -m planejamento.construdata_export
"""
import os, sys, json, math, unicodedata
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

WCR = r"C:\Users\felip\Desktop\_ORGANIZADO\26-WCR SANEAMENTO"
SHP = WCR + r"\SHAPEFILE_BOI_MALHADO_FEITO_A_FAZER_VERSAO_CLAUDE"
OUT = r"C:\Users\felip\Desktop\_ORGANIZADO\21-CONSTRUDATA\construdatamaxv2-clean-estabiliza\frontend\src\data\wcr"


def nrm(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s or "")) if not unicodedata.combining(c)).upper()


def _g(pr, *ks):
    for k in ks:
        for kk in pr:
            if nrm(kk) == nrm(k):
                return pr[kk]
    return None


# ---------- MAPA: rede real do Boi Malhado (gpkg 31983 -> lat/lng 4326) ----------
def exportar_mapa():
    import geopandas as gpd
    from shapely.geometry import LineString
    camadas = [
        (SHP + r"\ESGOTO BOI MALHADO A FAZER.gpkg", "sewer", "PVC"),
        (SHP + r"\AGUA BOI MALHADO A FAZER.gpkg", "water", "PEAD"),
    ]
    nodes = {}      # key (lat,lng arredondado) -> node dict
    segments = []
    nidx = [0]

    def node_id(lat, lng):
        key = (round(lat, 6), round(lng, 6))
        if key not in nodes:
            nidx[0] += 1
            nodes[key] = {"id": "wn%03d" % nidx[0], "lat": key[0], "lng": key[1],
                          "label": "PV-%03d" % nidx[0], "nodeType": "junction", "_deg": 0}
        return nodes[key]

    sidx = 0
    for path, ntype, mat in camadas:
        if not os.path.exists(path):
            print("(sem", os.path.basename(path), ")"); continue
        gdf = gpd.read_file(path)
        try:
            gdf = gdf.set_crs(31983, allow_override=True).to_crs(4326)
        except Exception:
            gdf = gdf.to_crs(4326)
        for _, row in gdf.iterrows():
            geom = row.geometry
            if geom is None:
                continue
            lines = [geom] if geom.geom_type == "LineString" else list(getattr(geom, "geoms", []))
            dn = str(_g(row, "DN", "Tubo_m") or "")
            diam = 200 if ntype == "sewer" else 63
            for tag in ("315", "300", "200", "160", "110", "63", "50"):
                if tag in dn:
                    diam = int(tag); break
            for ln in lines:
                cs = list(ln.coords)
                if len(cs) < 2:
                    continue
                a = node_id(cs[0][1], cs[0][0]); b = node_id(cs[-1][1], cs[-1][0])
                a["_deg"] += 1; b["_deg"] += 1
                sidx += 1
                segments.append({"id": "ws%03d" % sidx, "fromNodeId": a["id"], "toNodeId": b["id"],
                                 "networkType": ntype, "diameter": diam, "material": mat})

    # endpoint vs junction pela quantidade de conexões
    out_nodes = []
    for nd in nodes.values():
        deg = nd.pop("_deg")
        if deg <= 1:
            nd["nodeType"] = "endpoint"
            nd["label"] = nd["label"].replace("PV-", "EP-")
        out_nodes.append(nd)

    data = {"nodes": out_nodes, "segments": segments}
    _write("mapa.json", data)
    print("mapa.json:", len(out_nodes), "nós,", len(segments), "trechos (Boi Malhado real)")
    return data


def _write(nome, data):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, nome), "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)


# ---------- SQL: dados reais WCR -> Supabase (schema frontend/supabase-schema.sql) ----------
import uuid as _uuid
import re as _re

_NS = _uuid.UUID("7e5c0b2a-9f3d-5a41-8b62-1c0d4e6f7a80")  # namespace fixo WCR (uuid determinístico)
LOT = WCR + r"\LOTACAO_BOI_MALHADO.json"
APO = WCR + r"\DIARIO_OBRA_BOI_MALHADO_apontamento.json"
SQL_OUT = r"C:\Users\felip\Desktop\_ORGANIZADO\21-CONSTRUDATA\construdatamaxv2-clean-estabiliza\frontend\wcr_supabase.sql"


def _id(*p):
    return str(_uuid.uuid5(_NS, "|".join(str(x) for x in p)))


def _q(s):
    return "'" + str(s if s is not None else "").replace("'", "''") + "'"


def _metros(txt):
    m = _re.search(r"(\d+[.,]?\d*)\s*(m|mt|mtr|mts|metro)", str(txt or ""), _re.I)
    if not m:
        return 0
    try:
        return float(m.group(1).replace(",", "."))
    except Exception:
        return 0


# projetos WCR (tipo/status batem com os CHECK do schema)
_PROJ = [
    ("boi", "WCR — Boi Malhado", "São Paulo (Zona Norte)", "misto", "2026-06-11", "2026-08-15", 690000, "ativo", "Felipe Nery"),
    ("sakura", "WCR — Sakura", "São Paulo (Zona Norte)", "misto", "2026-07-15", "2026-09-02", 520000, "ativo", "Felipe Nery"),
    ("retorno", "WCR — Comunidade do Retorno", "São Paulo (Zona Norte)", "misto", "2026-06-29", "2026-12-15", 4800000, "ativo", "Felipe Nery / Jailton"),
]
# frentes (status: ativa|pausada|concluida)
_FRENTES = [
    ("boi", "Esgoto — Israel + Zé Claudino + Léo/Rodrigo", "Boi Malhado", "esgoto", 700, 60, "ativa"),
    ("boi", "Água — Renan/Jesse + Ediel", "Boi Malhado", "agua", 500, 0, "ativa"),
    ("boi", "Caixas U.M.A / Ramais — Mazinho", "Boi Malhado", "agua", 0, 0, "ativa"),
    ("sakura", "Esgoto", "Sakura", "esgoto", 700, 45, "pausada"),
    ("sakura", "Água", "Sakura", "agua", 550, 0, "pausada"),
    ("retorno", "Esgoto — rede + coletor", "Comunidade do Retorno", "esgoto", 1065, 17, "pausada"),
    ("retorno", "Água MND — Jailton", "Comunidade do Retorno", "agua", 1000, 0, "pausada"),
    ("retorno", "EEE — Estação Elevatória", "Comunidade do Retorno", "esgoto", 180, 1, "pausada"),
]


def exportar_sql():
    lot = json.load(open(LOT, encoding="utf-8")) if os.path.exists(LOT) else {"equipes": []}
    apo = json.load(open(APO, encoding="utf-8")) if os.path.exists(APO) else {"dias": []}
    L = []
    L.append("-- ══════════════════════════════════════════════════════════")
    L.append("-- WCR ConstruData — DADOS REAIS do Boi Malhado (gerado pelo motor)")
    L.append("-- Cole no SQL Editor do Supabase (projeto vblfdikfobsirwpdnybw) e RUN.")
    L.append("-- Idempotente: apaga a versão WCR anterior e reinsere.")
    L.append("-- ══════════════════════════════════════════════════════════")
    L.append("BEGIN;")
    pid = {k: _id("proj", k) for k, *_ in _PROJ}
    L.append("DELETE FROM projetos WHERE id IN (%s);" % ",".join(_q(v) for v in pid.values()))

    # projetos
    L.append("INSERT INTO projetos (id,nome,contrato,cidade,cliente,tipo,data_inicio,data_fim,orcamento_total,status,responsavel_nome,responsavel_telefone) VALUES")
    rows = []
    for k, nome, cid, tipo, di, df, orc, st, resp in _PROJ:
        rows.append("(%s,%s,%s,%s,%s,%s,%s,%s,%d,%s,%s,%s)" % (
            _q(pid[k]), _q(nome), _q("13.546/25-00"), _q(cid), _q("WCR Saneamento / Sabesp"),
            _q(tipo), _q(di), _q(df), orc, _q(st), _q(resp), _q("5561981846325")))
    L.append(",\n".join(rows) + ";")

    # frentes
    fid = {}
    L.append("INSERT INTO frentes (id,projeto_id,nome,setor,tipo_rede,extensao_total,pvs_total,status) VALUES")
    rows = []
    for i, (pk, nome, setor, tr, ext, pvs, st) in enumerate(_FRENTES):
        f = _id("frente", pk, i)
        fid[(pk, i)] = f
        rows.append("(%s,%s,%s,%s,%s,%d,%d,%s)" % (
            _q(f), _q(pid[pk]), _q(nome), _q(setor), _q(tr), ext, pvs, _q(st)))
    L.append(",\n".join(rows) + ";")

    # contatos (líderes da lotação)
    crows = []
    for e in lot.get("equipes", []):
        lider = e.get("lider") or e.get("nome")
        crows.append("(%s,%s,%s,%s,%s,TRUE)" % (
            _q(_id("contato", lider)), _q(lider), _q("Líder de equipe (%s)" % e.get("sistema", "")),
            _q(""), _q(pid["boi"])))
    if crows:
        L.append("INSERT INTO contatos (id,nome,cargo,telefone_whatsapp,projeto_id,ativo) VALUES")
        L.append(",\n".join(crows) + ";")

    # rdos + equipes + atividades (apontamento real)
    rdo_rows, eq_rows, at_rows = [], [], []
    for dia in apo.get("dias", []):
        data = dia.get("data")
        rid = _id("rdo", data)
        rdo_rows.append("(%s,%s,%s,%s,%s,%s)" % (
            _q(rid), _q(pid["boi"]), _q(data), _q("Ensolarado"), _q("Diurno"), _q("fechado")))
        # agrupa serviços por equipe
        grupos = {}
        for s in dia.get("servicos", []):
            eq = (s.get("equipe") or "Geral / Administrativo").strip()
            grupos.setdefault(eq, []).append(s)
        for eq, servs in grupos.items():
            sistemas = [x.get("sistema", "") for x in servs]
            tipo = max(set(sistemas), key=sistemas.count) if sistemas else "geral"
            eid = _id("eq", data, eq)
            eq_rows.append("(%s,%s,%s,%s)" % (_q(eid), _q(rid), _q(tipo.upper() or "REDE"), _q(eq)))
            for j, s in enumerate(servs):
                at_rows.append("(%s,%s,%s,%s,%s,%s,%s)" % (
                    _q(_id("at", data, eq, j)), _q(eid), _q(s.get("local", "")),
                    _q(s.get("servico", "")), _q(s.get("sistema", "")),
                    _metros(s.get("quantidade")), _q(s.get("quantidade", ""))))
    if rdo_rows:
        L.append("INSERT INTO rdos (id,projeto_id,data,clima,turno,status) VALUES")
        L.append(",\n".join(rdo_rows) + ";")
    if eq_rows:
        L.append("INSERT INTO rdo_equipes (id,rdo_id,tipo,lider_nome) VALUES")
        L.append(",\n".join(eq_rows) + ";")
    if at_rows:
        L.append("INSERT INTO rdo_atividades (id,equipe_id,rua,servico,tubo,metragem,observacao) VALUES")
        L.append(",\n".join(at_rows) + ";")

    L.append("COMMIT;")
    os.makedirs(os.path.dirname(SQL_OUT), exist_ok=True)
    open(SQL_OUT, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("wcr_supabase.sql:", len(_PROJ), "projetos,", len(_FRENTES), "frentes,",
          len(rdo_rows), "RDOs,", len(eq_rows), "equipes,", len(at_rows), "atividades ->", SQL_OUT)


PUBLIC_OUT = r"C:\Users\felip\Desktop\_ORGANIZADO\21-CONSTRUDATA\construdatamaxv2-clean-estabiliza\frontend\public\wcr_db.json"


def exportar_db_json():
    """Mesmos dados do exportar_sql, mas como arrays por tabela — pra inserir
    via API PostgREST direto do navegador (o motor não tem rede)."""
    lot = json.load(open(LOT, encoding="utf-8")) if os.path.exists(LOT) else {"equipes": []}
    apo = json.load(open(APO, encoding="utf-8")) if os.path.exists(APO) else {"dias": []}
    pid = {k: _id("proj", k) for k, *_ in _PROJ}
    db = {"projetos": [], "frentes": [], "contatos": [], "rdos": [], "rdo_equipes": [], "rdo_atividades": []}
    db["_delete_projeto_ids"] = list(pid.values())

    for k, nome, cid, tipo, di, df, orc, st, resp in _PROJ:
        db["projetos"].append({
            "id": pid[k], "nome": nome, "contrato": "13.546/25-00", "cidade": cid,
            "cliente": "WCR Saneamento / Sabesp", "tipo": tipo, "data_inicio": di, "data_fim": df,
            "orcamento_total": orc, "status": st, "responsavel_nome": resp, "responsavel_telefone": "5561981846325"})

    for i, (pk, nome, setor, tr, ext, pvs, st) in enumerate(_FRENTES):
        db["frentes"].append({
            "id": _id("frente", pk, i), "projeto_id": pid[pk], "nome": nome, "setor": setor,
            "tipo_rede": tr, "extensao_total": ext, "pvs_total": pvs, "status": st})

    for e in lot.get("equipes", []):
        lider = e.get("lider") or e.get("nome")
        db["contatos"].append({
            "id": _id("contato", lider), "nome": lider, "cargo": "Líder de equipe (%s)" % e.get("sistema", ""),
            "telefone_whatsapp": "", "projeto_id": pid["boi"], "ativo": True})

    for dia in apo.get("dias", []):
        data = dia.get("data")
        rid = _id("rdo", data)
        db["rdos"].append({"id": rid, "projeto_id": pid["boi"], "data": data,
                           "clima": "Ensolarado", "turno": "Diurno", "status": "fechado"})
        grupos = {}
        for s in dia.get("servicos", []):
            grupos.setdefault((s.get("equipe") or "Geral / Administrativo").strip(), []).append(s)
        for eq, servs in grupos.items():
            sistemas = [x.get("sistema", "") for x in servs]
            tipo = (max(set(sistemas), key=sistemas.count) if sistemas else "geral").upper() or "REDE"
            eid = _id("eq", data, eq)
            db["rdo_equipes"].append({"id": eid, "rdo_id": rid, "tipo": tipo, "lider_nome": eq})
            for j, s in enumerate(servs):
                db["rdo_atividades"].append({
                    "id": _id("at", data, eq, j), "equipe_id": eid, "rua": s.get("local", ""),
                    "servico": s.get("servico", ""), "tubo": s.get("sistema", ""),
                    "metragem": _metros(s.get("quantidade")), "observacao": s.get("quantidade", "")})

    os.makedirs(os.path.dirname(PUBLIC_OUT), exist_ok=True)
    with open(PUBLIC_OUT, "w", encoding="utf-8") as fh:
        json.dump(db, fh, ensure_ascii=False, indent=1)
    print("wcr_db.json:", {k: len(v) for k, v in db.items() if isinstance(v, list)}, "->", PUBLIC_OUT)


def main():
    print("Exportando bundle WCR -> ", OUT)
    exportar_mapa()
    exportar_sql()
    exportar_db_json()


if __name__ == "__main__":
    main()
