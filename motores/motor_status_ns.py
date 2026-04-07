# motor_status_ns.py
"""
Motor de estado centralizado por NS — ConstruData HydroNetwork v10
Fonte de verdade para todos os módulos da plataforma.

Estrutura do arquivo: SAIDA/{NUCLEO}/PLANEJAMENTO/STATUS_NS.json

Estados possíveis: PLANEJADO → EXECUTADO → CADASTRADO → MEDIDO | BLOQUEADO
"""
from __future__ import annotations

import csv
import json
import os
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

ESTADOS_VALIDOS = ["PLANEJADO", "EXECUTADO", "CADASTRADO", "MEDIDO", "BLOQUEADO"]

# Transições permitidas: de → [para permitido]
_TRANSICOES = {
    "PLANEJADO":  ["EXECUTADO", "BLOQUEADO"],
    "EXECUTADO":  ["CADASTRADO", "BLOQUEADO", "PLANEJADO"],
    "CADASTRADO": ["MEDIDO",     "BLOQUEADO", "EXECUTADO"],
    "MEDIDO":     ["BLOQUEADO"],
    "BLOQUEADO":  ["PLANEJADO",  "EXECUTADO"],
}

# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _agora() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _status_path(nucleo: str, out_base: str) -> Path:
    return Path(out_base) / nucleo.upper() / "PLANEJAMENTO" / "STATUS_NS.json"


def _nota_vazia(ns_id: int, pv_ini: str, pv_fim: str,
                dn_mm: int | float, ext_m: float, rua: str = "") -> dict:
    ns_key = f"NS{ns_id:03d}"
    return {
        "ns_id":    ns_id,
        "ns_key":   ns_key,
        "pv_ini":   pv_ini,
        "pv_fim":   pv_fim,
        "dn_mm":    int(dn_mm) if dn_mm else 0,
        "ext_m":    round(float(ext_m), 3) if ext_m else 0.0,
        "rua":      rua,

        "status": "PLANEJADO",
        "status_historico": [],

        "execucao": {
            "data_inicio": None,
            "data_fim":    None,
            "equipe":      None,
            "fotos":       [],
            "observacao":  "",
        },

        "campo_real": {
            "ct_ini_real":   None,
            "ct_fim_real":   None,
            "cf_ini_real":   None,
            "cf_fim_real":   None,
            "prof_ini_real": None,
            "prof_fim_real": None,
        },

        "cadastro": {
            "ok":             False,
            "data_aprovacao": None,
            "versao":         None,
            "dxf_path":       None,
        },

        "medicao": {
            "bm_numero":         None,
            "bm_data":           None,
            "valor_liberado":    0.0,
            "pendente_cadastro": True,
        },

        "whatsapp": {
            "ultima_msg":  None,
            "ultima_foto": None,
            "timestamp":   None,
        },
    }


# ---------------------------------------------------------------------------
# API pública
# ---------------------------------------------------------------------------

def criar_status_inicial(
    pvs: dict,
    trechos: list,
    nucleo: str,
    ns_sequencia: list | None = None,
    contrato: str = "",
) -> dict:
    """
    Cria STATUS_NS dict com todos os trechos em PLANEJADO.

    pvs      : dict {pv_id: {"ct": float, "cf": float, ...}}
    trechos  : list de dicts com pv_ini, pv_fim, dn_mm, ext_m (e opcionalmente rua)
    nucleo   : ex. "TETEU22"
    ns_sequencia: lista de índices de trechos definindo ordem executiva.
                  Se None, usa ordem natural 0..N-1
    """
    if ns_sequencia is None:
        ns_sequencia = list(range(len(trechos)))

    # Garante que todos os índices são válidos
    ns_sequencia = [i for i in ns_sequencia if 0 <= i < len(trechos)]
    # Adiciona índices não presentes (mantém no final)
    restantes = [i for i in range(len(trechos)) if i not in ns_sequencia]
    ordem = ns_sequencia + restantes

    notas: dict[str, dict] = {}
    for pos, idx in enumerate(ordem):
        if idx >= len(trechos):
            continue
        t = trechos[idx]
        ns_id = pos + 1
        ns_key = f"NS{ns_id:03d}"
        rua = t.get("rua") or t.get("logradouro") or ""
        notas[ns_key] = _nota_vazia(
            ns_id=ns_id,
            pv_ini=str(t.get("pv_ini", t.get("no_ini", "?"))),
            pv_fim=str(t.get("pv_fim", t.get("no_fim", "?"))),
            dn_mm=t.get("dn_mm", t.get("dn", 0)),
            ext_m=t.get("ext_m", t.get("extensao", 0.0)),
            rua=rua,
        )

    return {
        "nucleo":    nucleo.upper(),
        "contrato":  contrato,
        "gerado_em": _agora(),
        "versao":    "v10",
        "notas":     notas,
    }


def carregar(nucleo: str, out_base: str) -> dict:
    """Carrega STATUS_NS.json. Retorna {} se não existir."""
    p = _status_path(nucleo, out_base)
    if p.exists():
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return {}


def salvar(status: dict, nucleo: str, out_base: str) -> str:
    """Salva STATUS_NS.json. Retorna path do arquivo."""
    p = _status_path(nucleo, out_base)
    p.parent.mkdir(parents=True, exist_ok=True)
    status["_salvo_em"] = _agora()
    with open(p, "w", encoding="utf-8") as f:
        json.dump(status, f, ensure_ascii=False, indent=2)
    return str(p)


def transitar(
    status: dict,
    ns_id: str,
    para: str,
    responsavel: str = "",
    obs: str = "",
) -> dict:
    """
    Transita um NS para novo estado.
    ns_id: "NS001" ou "1" ou 1
    Valida transição. Registra histórico. Muta status in-place.
    """
    ns_key = _normalizar_ns_id(ns_id)
    if ns_key not in status.get("notas", {}):
        raise KeyError(f"NS '{ns_key}' não encontrada no status.")

    para = para.upper()
    if para not in ESTADOS_VALIDOS:
        raise ValueError(f"Estado inválido: '{para}'. Válidos: {ESTADOS_VALIDOS}")

    nota = status["notas"][ns_key]
    estado_atual = nota["status"]

    permitidos = _TRANSICOES.get(estado_atual, [])
    if para not in permitidos:
        raise ValueError(
            f"Transição inválida: {estado_atual} → {para}. "
            f"Permitidos de '{estado_atual}': {permitidos}"
        )

    agora = _agora()
    nota["status_historico"].append({
        "de":   estado_atual,
        "para": para,
        "data": agora,
        "resp": responsavel,
        "obs":  obs,
    })
    nota["status"] = para

    # Efeitos colaterais automáticos
    if para == "EXECUTADO":
        if not nota["execucao"]["data_fim"]:
            nota["execucao"]["data_fim"] = agora[:10]
        nota["medicao"]["pendente_cadastro"] = True

    elif para == "CADASTRADO":
        nota["cadastro"]["ok"] = True
        if not nota["cadastro"]["data_aprovacao"]:
            nota["cadastro"]["data_aprovacao"] = agora[:10]
        nota["medicao"]["pendente_cadastro"] = False

    elif para == "MEDIDO":
        nota["medicao"]["pendente_cadastro"] = False

    return status


def atualizar_campo_real(
    status: dict,
    ns_id: str,
    ct_ini: float | None = None,
    cf_ini: float | None = None,
    ct_fim: float | None = None,
    cf_fim: float | None = None,
    foto_path: str | None = None,
    observacao: str = "",
) -> dict:
    """Atualiza dados reais de campo levantados (CT/CF). Muta status in-place."""
    ns_key = _normalizar_ns_id(ns_id)
    nota = status["notas"][ns_key]
    cr = nota["campo_real"]

    if ct_ini is not None:
        cr["ct_ini_real"] = round(float(ct_ini), 3)
    if cf_ini is not None:
        cr["cf_ini_real"] = round(float(cf_ini), 3)
    if ct_fim is not None:
        cr["ct_fim_real"] = round(float(ct_fim), 3)
    if cf_fim is not None:
        cr["cf_fim_real"] = round(float(cf_fim), 3)

    # Calcular profundidades reais se CT e CF disponíveis
    if cr["ct_ini_real"] is not None and cr["cf_ini_real"] is not None:
        cr["prof_ini_real"] = round(cr["ct_ini_real"] - cr["cf_ini_real"], 3)
    if cr["ct_fim_real"] is not None and cr["cf_fim_real"] is not None:
        cr["prof_fim_real"] = round(cr["ct_fim_real"] - cr["cf_fim_real"], 3)

    if foto_path:
        fotos = nota["execucao"]["fotos"]
        if foto_path not in fotos:
            fotos.append(foto_path)

    if observacao:
        nota["execucao"]["observacao"] = observacao

    return status


def atualizar_cadastro(
    status: dict,
    ns_id: str,
    ok: bool,
    dxf_path: str = "",
    versao: str = "Rev.As-Built",
) -> dict:
    """Marca cadastro NTS 292 como aprovado (ou não). Muta status in-place."""
    ns_key = _normalizar_ns_id(ns_id)
    cad = status["notas"][ns_key]["cadastro"]
    cad["ok"]      = ok
    cad["versao"]  = versao
    if dxf_path:
        cad["dxf_path"] = dxf_path
    if ok and not cad["data_aprovacao"]:
        cad["data_aprovacao"] = _agora()[:10]
    # Atualiza flag pendência na medição
    status["notas"][ns_key]["medicao"]["pendente_cadastro"] = not ok
    return status


def atualizar_medicao(
    status: dict,
    ns_id: str,
    bm_numero: int,
    valor_liberado: float,
) -> dict:
    """Registra medição de BM. Muta status in-place."""
    ns_key = _normalizar_ns_id(ns_id)
    med = status["notas"][ns_key]["medicao"]
    med["bm_numero"]      = int(bm_numero)
    med["bm_data"]        = _agora()[:10]
    med["valor_liberado"] = round(float(valor_liberado), 2)
    return status


def atualizar_whatsapp(
    status: dict,
    ns_id: str,
    mensagem: str = "",
    foto_path: str = "",
) -> dict:
    """Registra última interação WhatsApp para a NS. Muta status in-place."""
    ns_key = _normalizar_ns_id(ns_id)
    wa = status["notas"][ns_key]["whatsapp"]
    agora = _agora()
    if mensagem:
        wa["ultima_msg"] = mensagem
    if foto_path:
        wa["ultima_foto"] = foto_path
    wa["timestamp"] = agora
    return status


def resumo(status: dict) -> dict:
    """
    KPIs do status atual.
    Retorna: n_total, n_planejadas, n_executadas, n_cadastradas, n_medidas,
             n_bloqueadas, pct_fisico, pct_financeiro,
             extensao_total_m, extensao_executada_m, valor_liberado.
    """
    notas = status.get("notas", {})
    n_total        = len(notas)
    n_planejadas   = 0
    n_executadas   = 0
    n_cadastradas  = 0
    n_medidas      = 0
    n_bloqueadas   = 0
    ext_total      = 0.0
    ext_executada  = 0.0
    valor_liberado = 0.0

    for nota in notas.values():
        st  = nota.get("status", "PLANEJADO")
        ext = nota.get("ext_m", 0.0) or 0.0
        ext_total += ext

        if st == "PLANEJADO":
            n_planejadas += 1
        elif st == "EXECUTADO":
            n_executadas += 1
            ext_executada += ext
        elif st == "CADASTRADO":
            n_cadastradas += 1
            ext_executada += ext
        elif st == "MEDIDO":
            n_medidas += 1
            ext_executada += ext
            valor_liberado += nota.get("medicao", {}).get("valor_liberado", 0.0) or 0.0
        elif st == "BLOQUEADO":
            n_bloqueadas += 1

    # % físico = (executado + cadastrado + medido) / total
    n_executados_total = n_executadas + n_cadastradas + n_medidas
    pct_fisico = round(n_executados_total / n_total * 100, 1) if n_total > 0 else 0.0

    # % financeiro simples: medido / total (por extensão)
    pct_financeiro = round(
        sum(
            n.get("ext_m", 0.0) or 0.0
            for n in notas.values()
            if n.get("status") == "MEDIDO"
        ) / ext_total * 100, 1
    ) if ext_total > 0 else 0.0

    return {
        "n_total":           n_total,
        "n_planejadas":      n_planejadas,
        "n_executadas":      n_executadas,
        "n_cadastradas":     n_cadastradas,
        "n_medidas":         n_medidas,
        "n_bloqueadas":      n_bloqueadas,
        "pct_fisico":        pct_fisico,
        "pct_financeiro":    pct_financeiro,
        "extensao_total_m":  round(ext_total, 1),
        "extensao_executada_m": round(ext_executada, 1),
        "valor_liberado":    round(valor_liberado, 2),
    }


def exportar_csv(status: dict, path: str) -> str:
    """
    Exporta STATUS_NS como CSV para uso em Excel.
    Retorna path do arquivo gerado.
    """
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    campos = [
        "ns_key", "ns_id", "pv_ini", "pv_fim", "dn_mm", "ext_m", "rua",
        "status",
        "data_fim_exec", "equipe", "observacao",
        "ct_ini_real", "cf_ini_real", "prof_ini_real",
        "ct_fim_real",  "cf_fim_real",  "prof_fim_real",
        "cadastro_ok", "cadastro_versao", "cadastro_data",
        "bm_numero", "bm_data", "valor_liberado", "pendente_cadastro",
        "wa_ultima_msg", "wa_timestamp",
    ]
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=campos, extrasaction="ignore")
        w.writeheader()
        for ns_key, nota in sorted(status.get("notas", {}).items()):
            ex  = nota.get("execucao", {})
            cr  = nota.get("campo_real", {})
            cad = nota.get("cadastro", {})
            med = nota.get("medicao", {})
            wa  = nota.get("whatsapp", {})
            w.writerow({
                "ns_key":      ns_key,
                "ns_id":       nota.get("ns_id"),
                "pv_ini":      nota.get("pv_ini"),
                "pv_fim":      nota.get("pv_fim"),
                "dn_mm":       nota.get("dn_mm"),
                "ext_m":       nota.get("ext_m"),
                "rua":         nota.get("rua"),
                "status":      nota.get("status"),
                "data_fim_exec":  ex.get("data_fim"),
                "equipe":         ex.get("equipe"),
                "observacao":     ex.get("observacao"),
                "ct_ini_real":    cr.get("ct_ini_real"),
                "cf_ini_real":    cr.get("cf_ini_real"),
                "prof_ini_real":  cr.get("prof_ini_real"),
                "ct_fim_real":    cr.get("ct_fim_real"),
                "cf_fim_real":    cr.get("cf_fim_real"),
                "prof_fim_real":  cr.get("prof_fim_real"),
                "cadastro_ok":    cad.get("ok"),
                "cadastro_versao":cad.get("versao"),
                "cadastro_data":  cad.get("data_aprovacao"),
                "bm_numero":      med.get("bm_numero"),
                "bm_data":        med.get("bm_data"),
                "valor_liberado": med.get("valor_liberado"),
                "pendente_cadastro": med.get("pendente_cadastro"),
                "wa_ultima_msg":  wa.get("ultima_msg"),
                "wa_timestamp":   wa.get("timestamp"),
            })
    return path


# ---------------------------------------------------------------------------
# Helpers públicos
# ---------------------------------------------------------------------------

def _normalizar_ns_id(ns_id) -> str:
    """
    Aceita: "NS001", "NS1", "001", "1", 1 → retorna "NS001"
    """
    s = str(ns_id).strip().upper()
    if s.startswith("NS"):
        num = s[2:].lstrip("0") or "0"
    else:
        num = s.lstrip("0") or "0"
    try:
        return f"NS{int(num):03d}"
    except ValueError:
        return s  # devolve como está se não conseguir parsear


def listar_ns_por_status(status: dict, estado: str) -> list[str]:
    """Retorna lista de ns_keys com o estado solicitado."""
    estado = estado.upper()
    return [k for k, n in status.get("notas", {}).items() if n.get("status") == estado]


def ns_pode_medir(status: dict, ns_id: str) -> bool:
    """True se NS está CADASTRADA (cadastro.ok=True) e ainda não medida."""
    ns_key = _normalizar_ns_id(ns_id)
    nota = status.get("notas", {}).get(ns_key, {})
    return (
        nota.get("status") == "CADASTRADO"
        and nota.get("cadastro", {}).get("ok", False)
        and nota.get("medicao", {}).get("bm_numero") is None
    )


# ---------------------------------------------------------------------------
# CLI / teste rápido
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("=== Teste motor_status_ns ===")

    pvs = {
        "PV001": {"ct": 27.45, "cf": 25.45},
        "PI054": {"ct": 27.63, "cf": 25.63},
        "PV003": {"ct": 28.00, "cf": 25.90},
    }
    trechos = [
        {"pv_ini": "PV001", "pv_fim": "PI054", "dn_mm": 200, "ext_m": 45.3, "rua": "R. das Flores"},
        {"pv_ini": "PI054", "pv_fim": "PV003", "dn_mm": 200, "ext_m": 32.1, "rua": "R. das Flores"},
    ]

    # 1. Criar status inicial
    status = criar_status_inicial(pvs, trechos, "TESTE", contrato="CT-TEST")
    assert len(status["notas"]) == 2
    assert status["notas"]["NS001"]["status"] == "PLANEJADO"
    print("✓ criar_status_inicial OK")

    # 2. Transitar para EXECUTADO
    status = transitar(status, "NS001", "EXECUTADO", "João")
    assert status["notas"]["NS001"]["status"] == "EXECUTADO"
    assert len(status["notas"]["NS001"]["status_historico"]) == 1
    print("✓ transitar PLANEJADO → EXECUTADO OK")

    # 3. Atualizar campo real
    status = atualizar_campo_real(status, "NS001", ct_ini=27.45, cf_ini=25.45,
                                   ct_fim=27.63, cf_fim=25.63)
    assert status["notas"]["NS001"]["campo_real"]["prof_ini_real"] == 2.0
    print("✓ atualizar_campo_real OK")

    # 4. Transitar para CADASTRADO
    status = transitar(status, "NS001", "CADASTRADO", "Maria")
    assert status["notas"]["NS001"]["status"] == "CADASTRADO"
    print("✓ transitar EXECUTADO → CADASTRADO OK")

    # 5. Atualizar medição
    status = atualizar_medicao(status, "NS001", bm_numero=1, valor_liberado=12500.50)
    print("✓ atualizar_medicao OK")

    # 6. Resumo
    r = resumo(status)
    assert r["n_executadas"] == 0   # NS001 foi para CADASTRADO
    assert r["n_cadastradas"] == 1
    assert r["pct_fisico"] == 50.0  # 1 de 2 trechos executados
    print(f"✓ resumo OK: {r}")

    # 7. CSV
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
        p = exportar_csv(status, tmp.name)
    print(f"✓ exportar_csv OK → {p}")

    # 8. Salvar / carregar
    import tempfile, os
    tmpdir = tempfile.mkdtemp()
    saved = salvar(status, "TESTE", tmpdir)
    loaded = carregar("TESTE", tmpdir)
    assert loaded["notas"]["NS001"]["status"] == "CADASTRADO"
    print(f"✓ salvar/carregar OK → {saved}")

    print("\n=== Todos os testes passaram ✓ ===")
