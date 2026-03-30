# campo/rdo_engine.py
"""
RDO Engine — ConstruData HydroNetwork v10+
Motor de Relatório Diário de Obra.

Uso standalone:
    from campo.rdo_engine import RDOEngine
    engine = RDOEngine()
    rdo = engine.criar_rdo("2026-03-27", "TETEU22", "Felipe Nery")
    engine.adicionar_apontamento(rdo.id, ns_id=1, servico="Assentamento", qtd=45, dn=200)
    engine.adicionar_equipe(rdo.id, "Encanador", 2)
    engine.fechar_rdo(rdo.id)

Dependências internas:
    core.database  — sessão SQLAlchemy
    core.models    — RDO, RDOApontamento, RDOEquipe, RDOOcorrencia, RDOFoto, NS, ChecklistNS

Dependências externas opcionais:
    reportlab  — para gerar PDF (pip install reportlab)
    motor_status_ns  — para atualizar STATUS_NS.json ao fechar RDO
"""
from __future__ import annotations

from datetime import date, datetime, time
from pathlib import Path
from typing import Optional

from sqlalchemy import select, func

from core.database import get_session, criar_banco, resolver_ns_por_codigo
from core.config import BDI_PADRAO, CONTRATO_PADRAO
from core.models import (
    RDO, RDOApontamento, RDOEquipe, RDOOcorrencia, RDOFoto,
    NS, ChecklistNS, StatusNS, StatusRDO, TipoOcorrencia,
)

# Tabela SINAPI simplificada (R$/m — usar motor_custo se disponível)
_SINAPI_UNITARIO: dict[str, float] = {
    "escavacao":              35.0,
    "assentamento":           85.0,
    "assentamento tubo":      85.0,
    "reaterro":               28.0,
    "recomposicao pavimento": 120.0,
    "ligacao predial":        450.0,
    "montagem pv":            1200.0,
    "montagem pi":            850.0,
    "teste estanqueidade":    15.0,
    "lastro":                 20.0,
    "berco":                  20.0,
}
_BDI = BDI_PADRAO
_UNIDADE_DEFAULT = "m"
_CHECKLIST_POR_SERVICO = {
    "escavacao": ["Escavação de vala"],
    "lastro": ["Lastro/berço de areia"],
    "berco": ["Lastro/berço de areia"],
    "assentamento": ["Assentamento de tubulação"],
    "teste": ["Teste de estanqueidade"],
    "reaterro": ["Reaterro compactado"],
    "recomposicao": ["Recomposição de pavimento"],
    "ligacao": ["Ligação predial"],
    "montagem pv": ["Montagem de PV/PI"],
    "montagem pi": ["Montagem de PV/PI"],
}


def _custo_unit(servico: str) -> float:
    chave = servico.lower().strip()
    for k, v in _SINAPI_UNITARIO.items():
        if k in chave:
            return v * _BDI
    return 50.0 * _BDI  # default


def _numero_rdo_proximo(session, nucleo: str) -> int:
    """Retorna próximo número sequencial de RDO para o núcleo."""
    ultimo = session.execute(
        select(func.max(RDO.numero)).where(RDO.nucleo == nucleo)
    ).scalar()
    return (ultimo or 0) + 1


def _checklist_servico(servico: str) -> list[str]:
    chave = servico.lower().strip()
    itens = []
    for token, checklist in _CHECKLIST_POR_SERVICO.items():
        if token in chave:
            itens.extend(checklist)
    return list(dict.fromkeys(itens))


# ---------------------------------------------------------------------------
# RDOEngine
# ---------------------------------------------------------------------------

class RDOEngine:
    """
    Motor de RDO — cria, atualiza e fecha Relatórios Diários de Obra.
    Independente do GUI — pode ser usado por API, CLI ou WhatsApp bot.
    """

    def __init__(self, out_base: str = ""):
        criar_banco()
        self.out_base = out_base or str(Path(__file__).parent.parent / "SAIDA_HYDRONETWORK")

    # ── Criar/Obter RDO ──────────────────────────────────────────────────

    def criar_rdo(
        self,
        data_str: str,
        nucleo: str,
        responsavel: str = "",
        clima_manha: str = "Sol",
        clima_tarde: str = "Sol",
    ) -> dict:
        """
        Cria RDO do dia ou retorna o existente (idempotente por data+nucleo).
        data_str: "YYYY-MM-DD"
        """
        dt = date.fromisoformat(data_str)
        with get_session() as session:
            existente = session.execute(
                select(RDO).where(RDO.data == dt, RDO.nucleo == nucleo)
            ).scalar_one_or_none()

            if existente:
                return existente.to_dict()

            numero = _numero_rdo_proximo(session, nucleo)
            rdo = RDO(
                data=dt,
                numero=numero,
                nucleo=nucleo,
                responsavel=responsavel or "Não informado",
                contrato=CONTRATO_PADRAO,
                clima_manha=clima_manha,
                clima_tarde=clima_tarde,
                status=StatusRDO.ABERTO,
                total_custo=0.0,
            )
            session.add(rdo)
            session.flush()
            return rdo.to_dict()

    def obter_rdo(self, rdo_id: int) -> dict | None:
        with get_session() as session:
            rdo = session.get(RDO, rdo_id)
            return rdo.to_dict() if rdo else None

    def rdo_do_dia(self, data_str: str, nucleo: str) -> dict | None:
        dt = date.fromisoformat(data_str)
        with get_session() as session:
            rdo = session.execute(
                select(RDO).where(RDO.data == dt, RDO.nucleo == nucleo)
            ).scalar_one_or_none()
            return rdo.to_dict() if rdo else None

    def listar_rdos(self, nucleo: str = "") -> list[dict]:
        with get_session() as session:
            stmt = select(RDO).order_by(RDO.data.desc())
            if nucleo:
                stmt = stmt.where(RDO.nucleo == nucleo)
            rows = session.execute(stmt).scalars().all()
            return [r.to_dict() for r in rows]

    def criar_rdo_completo(self, payload: dict) -> dict:
        """Cria um RDO completo a partir do payload recebido da API/HTML."""
        rdo = self.criar_rdo(
            payload.get("data") or str(date.today()),
            payload.get("nucleo") or "REDE",
            payload.get("rt") or payload.get("responsavel") or "",
            payload.get("clima", {}).get("manha", ""),
            payload.get("clima", {}).get("tarde", ""),
        )
        rdo_id = rdo["id"]

        for equipe in payload.get("equipe", []):
            if equipe.get("funcao") and int(equipe.get("qtd") or 0) > 0:
                self.adicionar_equipe(rdo_id, equipe["funcao"], int(equipe.get("qtd") or 0))

        for ocorrencia in payload.get("ocorrencias", []):
            self.adicionar_ocorrencia(
                rdo_id,
                ocorrencia.get("tipo", "outro"),
                ocorrencia.get("desc") or ocorrencia.get("descricao") or "",
                ocorrencia.get("hora") or "",
                ocorrencia.get("ns_id"),
            )

        for foto in payload.get("fotos", []):
            caminho = foto.get("caminho") or foto.get("name") or ""
            if caminho:
                self.adicionar_foto(
                    rdo_id,
                    caminho,
                    foto.get("legenda", ""),
                    foto.get("ns_id"),
                )

        for ns_id, servicos in (payload.get("servicos") or {}).items():
            for servico in servicos:
                self.adicionar_apontamento(
                    rdo_id=rdo_id,
                    ns_id=servico.get("ns_id") or ns_id,
                    servico=servico.get("servico") or servico.get("descricao") or "Serviço",
                    quantidade=float(servico.get("qtd") or servico.get("quantidade") or 0),
                    unidade=servico.get("unidade") or "m",
                    dn_mm=int(servico.get("dn_mm") or 0),
                )

        return self.obter_rdo(rdo_id) or rdo

    # ── Adicionar dados ao RDO ───────────────────────────────────────────

    def adicionar_apontamento(
        self,
        rdo_id: int,
        servico: str,
        quantidade: float = 0.0,
        unidade: str = "m",
        dn_mm: int = 0,
        ns_id: Optional[int] = None,
        hora_inicio: str = "",
        hora_fim: str = "",
    ) -> dict:
        """
        Adiciona apontamento de serviço ao RDO.
        Calcula custo unitário via tabela SINAPI interna.
        """
        custo_u = _custo_unit(servico)
        custo_t = round(custo_u * (quantidade or 1), 2)

        def _parse_time(s: str) -> Optional[time]:
            if not s:
                return None
            try:
                h, m = s.split(":")
                return time(int(h), int(m))
            except Exception:
                return None

        ns_id_resolvido = ns_id
        if isinstance(ns_id, str):
            with get_session() as session:
                rdo = session.get(RDO, rdo_id)
                ns_ref = resolver_ns_por_codigo(ns_id, rdo.nucleo if rdo else "")
                ns_id_resolvido = ns_ref.id if ns_ref else None

        with get_session() as session:
            apont = RDOApontamento(
                rdo_id=rdo_id,
                ns_id=ns_id_resolvido,
                servico=servico,
                quantidade=quantidade,
                unidade=unidade or _UNIDADE_DEFAULT,
                dn_mm=dn_mm,
                custo_unit=custo_u,
                custo_total=custo_t,
                hora_inicio=_parse_time(hora_inicio),
                hora_fim=_parse_time(hora_fim),
            )
            session.add(apont)
            session.flush()
            if ns_id_resolvido:
                ns = session.get(NS, ns_id_resolvido)
                if ns:
                    ns.status = StatusNS.EM_EXECUCAO
                    if not ns.data_inicio:
                        rdo = session.get(RDO, rdo_id)
                        ns.data_inicio = rdo.data if rdo else date.today()
                    ns.custo_realizado = round((ns.custo_realizado or 0) + custo_t, 2)
                    for item_nome in _checklist_servico(servico):
                        checklist = session.execute(
                            select(ChecklistNS).where(
                                ChecklistNS.ns_id == ns_id_resolvido,
                                ChecklistNS.item == item_nome,
                            )
                        ).scalar_one_or_none()
                        if checklist:
                            checklist.concluido = True
                            checklist.data = datetime.now()
                            checklist.responsavel = "Campo"
            return apont.to_dict()

    def adicionar_equipe(self, rdo_id: int, funcao: str, quantidade: int = 1) -> dict:
        with get_session() as session:
            eq = RDOEquipe(rdo_id=rdo_id, funcao=funcao, quantidade=quantidade)
            session.add(eq)
            session.flush()
            return eq.to_dict()

    def adicionar_ocorrencia(
        self,
        rdo_id: int,
        tipo: str,
        descricao: str = "",
        hora: str = "",
        ns_id: Optional[int] = None,
    ) -> dict:
        tipo_enum = TipoOcorrencia.OUTRO
        for e in TipoOcorrencia:
            if e.value in tipo.lower():
                tipo_enum = e
                break
        h = None
        if hora:
            try:
                parts = hora.split(":")
                h = time(int(parts[0]), int(parts[1]))
            except Exception:
                pass
        with get_session() as session:
            oc = RDOOcorrencia(rdo_id=rdo_id, tipo=tipo_enum, descricao=descricao,
                               hora=h, ns_id=ns_id)
            session.add(oc)
            session.flush()
            return oc.to_dict()

    def adicionar_foto(
        self,
        rdo_id: int,
        caminho: str,
        legenda: str = "",
        ns_id: Optional[int] = None,
        lat: float = 0.0,
        lon: float = 0.0,
    ) -> dict:
        with get_session() as session:
            foto = RDOFoto(rdo_id=rdo_id, ns_id=ns_id, caminho=caminho,
                           legenda=legenda, lat=lat or None, lon=lon or None)
            session.add(foto)
            session.flush()
            return foto.to_dict()

    # ── Fechar RDO ───────────────────────────────────────────────────────

    def fechar_rdo(self, rdo_id: int) -> dict:
        """
        Fecha RDO:
        1. Calcula total custo (soma apontamentos)
        2. Atualiza status das NS vinculadas → EM_EXECUCAO ou CONCLUIDA
        3. Sincroniza motor_status_ns.json se encontrado
        4. Gera PDF (se reportlab disponível)
        """
        with get_session() as session:
            rdo = session.get(RDO, rdo_id)
            if not rdo:
                raise ValueError(f"RDO {rdo_id} não encontrado")
            if rdo.status == StatusRDO.FECHADO:
                return rdo.to_dict()

            # Calcular total
            total = sum(a.custo_total or 0 for a in rdo.apontamentos)
            rdo.total_custo = round(total, 2)
            rdo.status = StatusRDO.FECHADO
            rdo.fechado_em = datetime.now()

            # Atualizar NS vinculadas
            ns_ids_apontados = {a.ns_id for a in rdo.apontamentos if a.ns_id}
            for ns_id in ns_ids_apontados:
                ns = session.get(NS, ns_id)
                if ns and ns.status == StatusNS.PLANEJADA:
                    ns.status = StatusNS.EM_EXECUCAO
                    if not ns.data_inicio:
                        ns.data_inicio = rdo.data

                # Verificar checklist completo → CONCLUIDA
                if ns:
                    total_items = len(ns.checklist)
                    done_items  = sum(1 for c in ns.checklist if c.concluido)
                    ns.custo_realizado = round(
                        sum((a.custo_total or 0) for a in rdo.apontamentos if a.ns_id == ns_id),
                        2,
                    )
                    if total_items > 0 and done_items >= total_items:
                        ns.status = StatusNS.CONCLUIDA
                        ns.data_fim = rdo.data

            resultado = rdo.to_dict()

        # Sincronizar motor_status_ns.json
        self._sync_status_ns_json(rdo_id)

        # Gerar PDF
        pdf_path = self.gerar_pdf(rdo_id)
        if pdf_path:
            with get_session() as session:
                rdo = session.get(RDO, rdo_id)
                if rdo:
                    rdo.pdf_path = pdf_path
                    resultado["pdf_path"] = pdf_path

        resultado["curva_s"] = self.atualizar_curva_s(rdo_id)

        return resultado

    # ── Atualizar Curva S ────────────────────────────────────────────────

    def atualizar_curva_s(self, rdo_id: int) -> dict:
        """
        Calcula extensão executada acumulada a partir de RDOs fechados.
        Retorna {data, ext_acum_m, pct_fisico}.
        """
        from core.database import curva_s_dados
        with get_session() as session:
            rdo = session.get(RDO, rdo_id)
            if not rdo:
                return {}
            nucleo = rdo.nucleo
        return curva_s_dados(nucleo)

    # ── Calcular custo do dia ────────────────────────────────────────────

    def calcular_custo_dia(self, rdo_id: int) -> float:
        with get_session() as session:
            aponts = session.execute(
                select(RDOApontamento).where(RDOApontamento.rdo_id == rdo_id)
            ).scalars().all()
            return round(sum(a.custo_total or 0 for a in aponts), 2)

    # ── Gerar PDF ────────────────────────────────────────────────────────

    def gerar_pdf(self, rdo_id: int) -> str:
        """
        Gera PDF do RDO. Requer reportlab (pip install reportlab).
        Retorna path do PDF ou '' se não disponível.
        """
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.units import cm
            from reportlab.pdfgen import canvas as rl_canvas
            from reportlab.lib import colors
        except ImportError:
            return ""

        rdo_dict = self.obter_rdo(rdo_id)
        if not rdo_dict:
            return ""

        nucleo = rdo_dict.get("nucleo", "REDE")
        data   = rdo_dict.get("data", "")
        num    = rdo_dict.get("numero", rdo_id)

        out_dir = Path(self.out_base) / nucleo.upper() / "CAMPO" / "RDO"
        out_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = str(out_dir / f"RDO_{num:04d}_{data}.pdf")

        c = rl_canvas.Canvas(pdf_path, pagesize=A4)
        w, h = A4

        # Cabeçalho
        c.setFillColorRGB(0.02, 0.02, 0.06)   # #06060f
        c.rect(0, h - 3*cm, w, 3*cm, fill=1, stroke=0)
        c.setFillColorRGB(0, 1, 0.53)          # #00ff88
        c.setFont("Helvetica-Bold", 16)
        c.drawString(1*cm, h - 1.8*cm, "ConstruData — Relatório Diário de Obra")
        c.setFillColorRGB(1, 1, 1)
        c.setFont("Helvetica", 10)
        c.drawString(1*cm, h - 2.5*cm,
                     f"Contrato: {rdo_dict.get('contrato','11481051')}  |  "
                     f"Nucleo: {nucleo}  |  Data: {data}  |  RDO nº {num:04d}")

        # Corpo
        y = h - 4*cm
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(1*cm, y, f"Responsável: {rdo_dict.get('responsavel','')}")
        y -= 0.6*cm
        c.drawString(1*cm, y, f"Clima manhã: {rdo_dict.get('clima_manha','')}  |  "
                              f"Tarde: {rdo_dict.get('clima_tarde','')}")
        y -= 0.8*cm

        # Apontamentos
        c.setFont("Helvetica-Bold", 10)
        c.drawString(1*cm, y, "SERVIÇOS EXECUTADOS:")
        y -= 0.5*cm
        c.setFont("Helvetica", 9)
        total = 0.0
        for a in rdo_dict.get("apontamentos", []):
            linha = (f"  {a.get('servico','')} — "
                     f"{a.get('quantidade',0)} {a.get('unidade','m')} — "
                     f"R$ {a.get('custo_total',0):,.2f}")
            c.drawString(1*cm, y, linha)
            y -= 0.5*cm
            total += a.get("custo_total", 0) or 0
            if y < 4*cm:
                c.showPage()
                y = h - 2*cm

        # Equipe
        y -= 0.3*cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(1*cm, y, "EQUIPE:")
        y -= 0.5*cm
        c.setFont("Helvetica", 9)
        for e in rdo_dict.get("equipe", []):
            c.drawString(1*cm, y, f"  {e.get('funcao','')}: {e.get('quantidade',1)}")
            y -= 0.5*cm

        # Ocorrências
        if rdo_dict.get("ocorrencias"):
            y -= 0.3*cm
            c.setFont("Helvetica-Bold", 10)
            c.drawString(1*cm, y, "OCORRÊNCIAS:")
            y -= 0.5*cm
            c.setFont("Helvetica", 9)
            for o in rdo_dict["ocorrencias"]:
                c.drawString(1*cm, y, f"  [{o.get('tipo','')}] {o.get('descricao','')}")
                y -= 0.5*cm

        # Total
        y -= 0.5*cm
        c.setFont("Helvetica-Bold", 12)
        c.setFillColorRGB(0.8, 0.4, 0)
        c.drawString(1*cm, y, f"CUSTO TOTAL DO DIA: R$ {total:,.2f}")

        # Rodapé
        c.setFillColorRGB(0.5, 0.5, 0.5)
        c.setFont("Helvetica", 7)
        c.drawString(1*cm, 1*cm,
                     "ConstruData HydroNetwork — DGS Engenharia — "
                     "SABESP SLNR Santos — Contrato 11481051")

        c.save()
        return pdf_path

    # ── Sincronizar STATUS_NS.json ───────────────────────────────────────

    def _sync_status_ns_json(self, rdo_id: int):
        """Atualiza STATUS_NS.json ao fechar RDO (sincroniza banco → JSON)."""
        try:
            from motor_status_ns import carregar, transitar, salvar
        except ImportError:
            return

        with get_session() as session:
            rdo = session.get(RDO, rdo_id)
            if not rdo:
                return
            nucleo = rdo.nucleo
            out_base = self.out_base

            # Buscar NS apontadas
            ns_ids = {a.ns_id for a in rdo.apontamentos if a.ns_id}
            ns_list = [session.get(NS, nid) for nid in ns_ids if nid]

        status = carregar(nucleo, out_base)
        if not status:
            return

        for ns in ns_list:
            if not ns:
                continue
            ns_key = f"NS{ns.seq:03d}"
            if ns_key not in status.get("notas", {}):
                continue
            st_atual = status["notas"][ns_key].get("status", "PLANEJADO")
            if st_atual == "PLANEJADO":
                try:
                    transitar(status, ns_key, "EXECUTADO",
                              responsavel=rdo.responsavel or "",
                              obs=f"RDO {rdo.numero} {rdo.data}")
                except Exception:
                    pass

        salvar(status, nucleo, out_base)


# ---------------------------------------------------------------------------
# CLI / teste rápido
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("=== Teste campo/rdo_engine.py ===")

    engine = RDOEngine()

    # Criar RDO
    rdo = engine.criar_rdo("2026-03-27", "TESTE_RDO", "Felipe Nery")
    rdo_id = rdo["id"]
    print(f"RDO criado: id={rdo_id} numero={rdo['numero']}")

    # Adicionar apontamentos
    engine.adicionar_apontamento(rdo_id, "Assentamento tubo", quantidade=45.3, dn_mm=200)
    engine.adicionar_apontamento(rdo_id, "Escavacao", quantidade=45.3)

    # Equipe
    engine.adicionar_equipe(rdo_id, "Encanador", 2)
    engine.adicionar_equipe(rdo_id, "Ajudante", 4)

    # Ocorrência
    engine.adicionar_ocorrencia(rdo_id, "chuva", "Chuva das 14h-15h", "14:00")

    # Calcular custo
    custo = engine.calcular_custo_dia(rdo_id)
    print(f"Custo do dia: R$ {custo:,.2f}")
    assert custo > 0

    # Fechar RDO
    resultado = engine.fechar_rdo(rdo_id)
    assert resultado["status"] == "FECHADO"
    print(f"RDO fechado. Total: R$ {resultado['total_custo']:,.2f}")
    if resultado.get("pdf_path"):
        print(f"PDF: {resultado['pdf_path']}")
    else:
        print("PDF: reportlab nao instalado (instale com pip install reportlab)")

    print("=== Todos os testes passaram ===")
