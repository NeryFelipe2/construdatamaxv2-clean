from collections import defaultdict, deque

DEP_TYPES = {"FS", "SS", "FF", "SF"}

def _build(tasks):
    by_id = {str(t["id"]): t for t in tasks}
    indeg = {k: 0 for k in by_id}
    succ = defaultdict(list)
    pred = defaultdict(list)

    for t in tasks:
        tid = str(t["id"])
        for d in t.get("deps", []):
            p = str(d["pred"])
            typ = str(d.get("type", "FS")).upper()
            lag = float(d.get("lag", 0))
            if typ not in DEP_TYPES:
                typ = "FS"
            if p not in by_id:
                raise ValueError(f"Dependencia invalida: {p} -> {tid}")
            succ[p].append((tid, typ, lag))
            pred[tid].append((p, typ, lag))
            indeg[tid] += 1
    return by_id, indeg, succ, pred

def _topo(indeg, succ):
    q = deque([k for k, v in indeg.items() if v == 0])
    out = []
    d = dict(indeg)
    while q:
        u = q.popleft()
        out.append(u)
        for v, _, _ in succ[u]:
            d[v] -= 1
            if d[v] == 0:
                q.append(v)
    if len(out) != len(indeg):
        raise ValueError("Ciclo detectado no cronograma")
    return out

def _fwd(es_p, ef_p, typ, lag, dur_s):
    if typ == "FS": return ef_p + lag
    if typ == "SS": return es_p + lag
    if typ == "FF": return ef_p + lag - dur_s
    if typ == "SF": return es_p + lag - dur_s
    return ef_p + lag

def _bwd(ls_s, lf_s, typ, lag, dur_p):
    if typ == "FS": return ls_s - lag
    if typ == "SS": return ls_s - lag + dur_p
    if typ == "FF": return lf_s - lag
    if typ == "SF": return lf_s - lag + dur_p
    return ls_s - lag

def compute_cpm(tasks):
    by_id, indeg, succ, pred = _build(tasks)
    order = _topo(indeg, succ)

    ES, EF = {} , {}
    for tid in order:
        dur = float(by_id[tid].get("duration", 0))
        if not pred[tid]:
            ES[tid] = 0.0
        else:
            ES[tid] = max(_fwd(ES[p], EF[p], typ, lag, dur) for p, typ, lag in pred[tid])
        EF[tid] = ES[tid] + dur

    proj = max(EF.values()) if EF else 0.0

    LS, LF = {}, {}
    for tid in reversed(order):
        dur = float(by_id[tid].get("duration", 0))
        if not succ[tid]:
            LF[tid] = proj
        else:
            LF[tid] = min(_bwd(LS[s], LF[s], typ, lag, dur) for s, typ, lag in succ[tid])
        LS[tid] = LF[tid] - dur

    rows = []
    critical_path = []
    for tid in order:
        tf = LS[tid] - ES[tid]
        crit = abs(tf) < 1e-9
        if crit:
            critical_path.append(tid)

        if not succ[tid]:
            ff = proj - EF[tid]
        else:
            vals = []
            for s, typ, lag in succ[tid]:
                dsucc = float(by_id[s].get("duration", 0))
                req = _fwd(ES[tid], EF[tid], typ, lag, dsucc)
                vals.append(ES[s] - req)
            ff = min(vals) if vals else 0.0

        rows.append({
            "id": tid,
            "name": by_id[tid].get("name", tid),
            "duration": float(by_id[tid].get("duration", 0)),
            "early_start": ES[tid],
            "early_finish": EF[tid],
            "late_start": LS[tid],
            "late_finish": LF[tid],
            "total_float": tf,
            "free_float": ff,
            "critical": crit
        })

    return {
        "ok": True,
        "project_duration": proj,
        "critical_path": critical_path,
        "tasks": rows
    }
