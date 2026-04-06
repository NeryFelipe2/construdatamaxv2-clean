"""
routes_motores.py — Endpoints REST para os motores Python da NOVA NS V5.
Expõe os motores LPS, EVM, Compras e Medição via API para o frontend React.
"""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/motores", tags=["motores"])


# ═══════════════════════════════════════════════════════════════════════════════
# 1. LPS / LEAN CONSTRUCTION
# ═══════════════════════════════════════════════════════════════════════════════

class LpsTask(BaseModel):
    id: str
    descricao: str
    responsavel: str
    planejado: bool = True
    executado: bool = False
    restricao: str | None = None

class LpsSimulateRequest(BaseModel):
    semana: str = Field(..., description="Identificador da semana (ex: '2026-W14')")
    projeto_id: str
    tarefas: list[LpsTask]

class LpsSimulateResponse(BaseModel):
    semana: str
    total_planejado: int
    total_executado: int
    ppc: float  # Percentual de Planos Cumpridos
    restricoes_ativas: int
    causas_raiz: list[str]
    classificacao: str  # "Excelente", "Bom", "Crítico"

@router.post("/lps/simulate", response_model=LpsSimulateResponse)
def lps_simulate(req: LpsSimulateRequest):
    """
    Motor LPS — Simula o Last Planner System para a semana.
    Calcula PPC (% Planejado Cumprido) e identifica restrições.
    Baseado em motor_lean_lps.py do legado NOVA NS V5.
    """
    planejados = [t for t in req.tarefas if t.planejado]
    executados = [t for t in req.tarefas if t.executado]
    restricoes = [t for t in req.tarefas if t.restricao]

    total_plan = len(planejados)
    total_exec = len(executados)
    ppc = (total_exec / total_plan * 100) if total_plan > 0 else 0.0

    # Identifica causas raiz das não-conclusões
    causas = list(set(t.restricao for t in restricoes if t.restricao))

    if ppc >= 85:
        classificacao = "Excelente"
    elif ppc >= 60:
        classificacao = "Bom"
    else:
        classificacao = "Crítico"

    return LpsSimulateResponse(
        semana=req.semana,
        total_planejado=total_plan,
        total_executado=total_exec,
        ppc=round(ppc, 1),
        restricoes_ativas=len(restricoes),
        causas_raiz=causas,
        classificacao=classificacao,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 2. EVM (EARNED VALUE MANAGEMENT)
# ═══════════════════════════════════════════════════════════════════════════════

class EvmCalculateRequest(BaseModel):
    projeto_id: str
    orcamento_total: float = Field(..., description="BAC — Budget at Completion")
    valor_planejado: float = Field(..., description="PV — Planned Value até a data")
    valor_agregado: float = Field(..., description="EV — Earned Value até a data")
    custo_real: float = Field(..., description="AC — Actual Cost até a data")
    data_referencia: str = Field(default_factory=lambda: date.today().isoformat())

class EvmResult(BaseModel):
    # Indicadores primários
    cv: float   # Cost Variance = EV - AC
    sv: float   # Schedule Variance = EV - PV
    cpi: float  # Cost Performance Index = EV / AC
    spi: float  # Schedule Performance Index = EV / PV
    # Projeções
    eac: float  # Estimate at Completion = BAC / CPI
    etc: float  # Estimate to Complete = EAC - AC
    vac: float  # Variance at Completion = BAC - EAC
    tcpi: float # To-Complete Performance Index = (BAC - EV) / (BAC - AC)
    # Percentuais
    pct_fisico: float
    pct_financeiro: float
    status_custo: str     # "Dentro", "Acima", "Abaixo"
    status_prazo: str     # "Adiantado", "No Prazo", "Atrasado"

@router.post("/evm/calculate", response_model=EvmResult)
def evm_calculate(req: EvmCalculateRequest):
    """
    Motor EVM — Calcula todos os indicadores de Earned Value Management.
    Baseado em gerar_medicao_curva_s.py do legado.
    """
    ev, pv, ac, bac = req.valor_agregado, req.valor_planejado, req.custo_real, req.orcamento_total

    if ac == 0:
        raise HTTPException(400, "Custo real (AC) não pode ser zero")
    if pv == 0:
        raise HTTPException(400, "Valor planejado (PV) não pode ser zero")

    cv = ev - ac
    sv = ev - pv
    cpi = ev / ac
    spi = ev / pv
    eac = bac / cpi if cpi != 0 else bac * 2
    etc = eac - ac
    vac = bac - eac
    tcpi = (bac - ev) / (bac - ac) if (bac - ac) != 0 else 999.0

    pct_fisico = (ev / bac * 100) if bac > 0 else 0
    pct_financeiro = (ac / bac * 100) if bac > 0 else 0

    status_custo = "Dentro" if abs(cpi - 1.0) < 0.05 else ("Abaixo" if cpi > 1.0 else "Acima")
    status_prazo = "No Prazo" if abs(spi - 1.0) < 0.05 else ("Adiantado" if spi > 1.0 else "Atrasado")

    return EvmResult(
        cv=round(cv, 2), sv=round(sv, 2),
        cpi=round(cpi, 3), spi=round(spi, 3),
        eac=round(eac, 2), etc=round(etc, 2),
        vac=round(vac, 2), tcpi=round(tcpi, 3),
        pct_fisico=round(pct_fisico, 1),
        pct_financeiro=round(pct_financeiro, 1),
        status_custo=status_custo,
        status_prazo=status_prazo,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 3. GERADOR DE LISTA DE COMPRAS
# ═══════════════════════════════════════════════════════════════════════════════

class ComprasItem(BaseModel):
    material: str
    unidade: str = "un"
    quantidade: float
    ns_referencia: str | None = None

class ComprasGerarRequest(BaseModel):
    projeto_id: str
    fase: str = Field(..., description="Fase da obra (ex: 'Fase 1 - Rede Coletora')")
    itens: list[ComprasItem]

class ComprasGerarResponse(BaseModel):
    fase: str
    total_itens: int
    lista_consolidada: list[dict[str, Any]]
    alerta_estoque: list[str]

@router.post("/compras/gerar", response_model=ComprasGerarResponse)
def compras_gerar(req: ComprasGerarRequest):
    """
    Motor de Compras — Consolida lista de materiais por fase.
    Baseado em gerar_compras.py do legado.
    """
    # Consolida por material
    consolidado: dict[str, dict] = {}
    for item in req.itens:
        key = item.material.strip().upper()
        if key in consolidado:
            consolidado[key]["quantidade"] += item.quantidade
            if item.ns_referencia:
                consolidado[key]["ns_refs"].add(item.ns_referencia)
        else:
            consolidado[key] = {
                "material": item.material,
                "unidade": item.unidade,
                "quantidade": item.quantidade,
                "ns_refs": {item.ns_referencia} if item.ns_referencia else set(),
            }

    lista = []
    alertas = []
    for key, v in sorted(consolidado.items()):
        entrada = {
            "material": v["material"],
            "unidade": v["unidade"],
            "quantidade": round(v["quantidade"], 2),
            "ns_referencias": sorted(v["ns_refs"]),
        }
        lista.append(entrada)
        # Alertas para quantidades grandes
        if v["quantidade"] > 1000:
            alertas.append(f"{v['material']}: {v['quantidade']} {v['unidade']} — compra de alto volume")

    return ComprasGerarResponse(
        fase=req.fase,
        total_itens=len(lista),
        lista_consolidada=lista,
        alerta_estoque=alertas,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 4. GERADOR DE MEDIÇÃO (OSE)
# ═══════════════════════════════════════════════════════════════════════════════

class MedicaoTrecho(BaseModel):
    ns: str
    trecho: str
    extensao_m: float
    diametro_mm: int
    profundidade_m: float = 0.0
    executado: bool = False

class MedicaoGerarRequest(BaseModel):
    projeto_id: str
    periodo: str = Field(..., description="Período de medição (ex: 'Mar/2026')")
    trechos: list[MedicaoTrecho]

class MedicaoOseItem(BaseModel):
    ns: str
    trecho: str
    extensao_m: float
    diametro_mm: int
    profundidade_m: float
    valor_unitario: float
    valor_total: float

class MedicaoGerarResponse(BaseModel):
    periodo: str
    total_trechos_executados: int
    total_extensao_m: float
    valor_total_medicao: float
    itens_ose: list[MedicaoOseItem]

@router.post("/medicao/gerar-ose", response_model=MedicaoGerarResponse)
def medicao_gerar_ose(req: MedicaoGerarRequest):
    """
    Motor de Medição — Gera Boletim OSE para faturamento SABESP.
    Baseado em gerar_ose.py e motor_medicao.py do legado.
    """
    # Tabela simplificada de preços unitários (R$/m) por diâmetro
    PRECO_POR_DIAMETRO = {
        100: 185.0, 150: 210.0, 200: 265.0, 250: 310.0,
        300: 380.0, 400: 520.0, 500: 680.0, 600: 850.0,
    }

    executados = [t for t in req.trechos if t.executado]
    itens = []
    valor_total = 0.0

    for t in executados:
        preco_base = PRECO_POR_DIAMETRO.get(t.diametro_mm, 200.0)
        # Fator de profundidade (acima de 2m encarece)
        fator_prof = 1.0 + max(0, (t.profundidade_m - 2.0)) * 0.15
        valor_unit = round(preco_base * fator_prof, 2)
        valor_trecho = round(valor_unit * t.extensao_m, 2)
        valor_total += valor_trecho

        itens.append(MedicaoOseItem(
            ns=t.ns, trecho=t.trecho,
            extensao_m=t.extensao_m, diametro_mm=t.diametro_mm,
            profundidade_m=t.profundidade_m,
            valor_unitario=valor_unit, valor_total=valor_trecho,
        ))

    return MedicaoGerarResponse(
        periodo=req.periodo,
        total_trechos_executados=len(executados),
        total_extensao_m=round(sum(t.extensao_m for t in executados), 2),
        valor_total_medicao=round(valor_total, 2),
        itens_ose=itens,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 5. TORRE DE CONTROLE (AGREGADOR)
# ═══════════════════════════════════════════════════════════════════════════════

class TorreKpisRequest(BaseModel):
    projeto_id: str

class TorreKpisResponse(BaseModel):
    projeto_id: str
    resumo: dict[str, Any]

@router.post("/torre/kpis", response_model=TorreKpisResponse)
def torre_kpis(req: TorreKpisRequest):
    """
    Torre de Controle — Retorna KPIs consolidados do projeto.
    (Placeholder: em produção, agregaria dados de todos os motores)
    """
    return TorreKpisResponse(
        projeto_id=req.projeto_id,
        resumo={
            "ns_total": 0,
            "extensao_km": 0,
            "pvs": 0,
            "ppc_semanal": 0,
            "cpi": 0,
            "spi": 0,
            "valor_medido": 0,
            "msg": "Configure os dados do projeto para ver KPIs reais",
        },
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 6. EXTRAÇÃO DE PDF (BACKEND)
# ═══════════════════════════════════════════════════════════════════════════════

from fastapi import UploadFile, File as FastFile

class PdfExtractionResult(BaseModel):
    filename: str
    text: str
    page_count: int
    chars_per_page: int
    is_scanned: bool

@router.post("/pdf/extract", response_model=list[PdfExtractionResult])
async def pdf_extract(files: list[UploadFile] = FastFile(...)):
    """
    Extrai texto de PDFs enviados. Pipeline de limpeza inclui:
    - Fix de encoding (UTF-8 duplo)
    - Remoção de cabeçalhos/rodapés repetidos
    - Normalização de whitespace
    """
    results = []
    for upload in files:
        if not upload.filename or not upload.filename.lower().endswith(".pdf"):
            results.append(PdfExtractionResult(
                filename=upload.filename or "unknown",
                text="", page_count=0, chars_per_page=0, is_scanned=False,
            ))
            continue

        content = await upload.read()
        # Validação magic bytes
        if len(content) < 5 or content[:5] != b"%PDF-":
            results.append(PdfExtractionResult(
                filename=upload.filename,
                text="ERRO: Arquivo não é um PDF válido",
                page_count=0, chars_per_page=0, is_scanned=False,
            ))
            continue

        try:
            import subprocess
            import tempfile
            import os

            # Fallback: usa pdftotext se disponível, senão retorna bytes decodificados
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            try:
                result = subprocess.run(
                    ["pdftotext", "-enc", "UTF-8", tmp_path, "-"],
                    capture_output=True, text=True, timeout=30,
                )
                text = result.stdout if result.returncode == 0 else content.decode("utf-8", errors="replace")
            except (FileNotFoundError, subprocess.TimeoutExpired):
                text = content.decode("utf-8", errors="replace")
            finally:
                os.unlink(tmp_path)

            # Limpeza
            import re
            text = re.sub(r'[ \t]+', ' ', text)
            text = re.sub(r'\n{3,}', '\n\n', text)
            text = text.strip()

            lines = text.split('\n')
            page_count = max(1, len(lines) // 50)
            chars_per_page = len(text) // page_count if page_count > 0 else 0
            is_scanned = chars_per_page < 80

            results.append(PdfExtractionResult(
                filename=upload.filename,
                text=text,
                page_count=page_count,
                chars_per_page=chars_per_page,
                is_scanned=is_scanned,
            ))
        except Exception as exc:
            results.append(PdfExtractionResult(
                filename=upload.filename,
                text=f"ERRO: {str(exc)}",
                page_count=0, chars_per_page=0, is_scanned=False,
            ))

    return results
