# Fase 1 — Tabela Única + Ingestão Confiável — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer o modelo de dados da tabela única (Setor→Coletor→Trecho→NS) e travar a ingestão de CAD para não inventar rede, com teste de regressão golden.

**Architecture:** Camada de planejamento nova (`planejamento/`) com dataclasses puras, independente do CAD; um módulo de sanidade que valida a rede lida (anti-invenção) sem depender de GDAL; e um teste golden (snapshot) que congela a saída do leitor existente `ler_dxf_gdal()` num DXF real (São Manoel), falhando se a contagem mudar.

**Tech Stack:** Python 3.11, dataclasses/enum (stdlib), pytest. O leitor existente usa GDAL/geopandas/ezdxf (já no projeto).

Referência de design: `docs/superpowers/specs/2026-06-21-motor-planejamento-ns-design.md`.

---

### Task 0: Infraestrutura de teste (pytest)

**Files:**
- Create: `pyproject.toml`
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`

- [ ] **Step 1: Criar `pyproject.toml` com config do pytest**

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_functions = ["test_*"]
addopts = "-q"
```

- [ ] **Step 2: Criar `tests/__init__.py` (vazio) e `tests/conftest.py` para achar os módulos da raiz**

```python
# tests/conftest.py
import os
import sys

# Permite importar os módulos da raiz do projeto (planejamento, models, ler_dxf_gdal)
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if RAIZ not in sys.path:
    sys.path.insert(0, RAIZ)
```

- [ ] **Step 3: Rodar pytest para confirmar coleta vazia (sem erro de config)**

Run: `python -m pytest -q`
Expected: `no tests ran` (exit 5) — sem erro de configuração.

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml tests/__init__.py tests/conftest.py
git commit -m "test: infra pytest (pyproject + conftest)"
```

---

### Task 1: Modelo da tabela única (Setor, Atividade, NotaServico)

**Files:**
- Create: `planejamento/__init__.py`
- Create: `planejamento/modelo.py`
- Test: `tests/test_planejamento_modelo.py`

- [ ] **Step 1: Escrever o teste que falha**

```python
# tests/test_planejamento_modelo.py
from planejamento.modelo import (
    Setor, Atividade, NotaServico, TipoServico, StatusNS,
)


def test_setor_defaults_tbcp():
    s = Setor(id="BACIA_1", pop_ini=500, pop_fim=1200)
    assert s.percapta == 150.0      # L/hab.dia (default TBCP_ESG.DAT)
    assert s.k1_dia == 1.2 and s.k2_hora == 1.5 and s.coef_ret == 0.8


def test_atividade_calcula_duracao():
    a = Atividade(tipo=TipoServico.ASSENTAMENTO_TUBO, equipe_tipo="rede",
                  qtd_material=180.0, unidade="m", produtiv_prev=18.0)
    assert a.calc_duracao() == 10.0          # 180 m / 18 m/dia
    assert a.duracao_prev_dias == 10.0


def test_atividade_sem_produtividade_nao_quebra():
    a = Atividade(tipo=TipoServico.CAIXA, equipe_tipo="caixa", qtd_material=4)
    assert a.calc_duracao() is None


def test_ns_titulo_e_duracao_total():
    ns = NotaServico(ns_id="NS011", descricao="TUBO DE QUEDA PI22 ATÉ PV11",
                     nucleo="SÃO MANOEL")
    ns.atividades = [
        Atividade(TipoServico.ASSENTAMENTO_TUBO, "rede", 180.0, "m", 18.0),
        Atividade(TipoServico.CAIXA_INSPECAO, "inspecao", 2.0, "un", 4.0),
    ]
    assert ns.titulo() == "NS011 TUBO DE QUEDA PI22 ATÉ PV11 SÃO MANOEL"
    assert ns.duracao_total_dias() == 10.5     # 10.0 + 0.5
    assert ns.status == StatusNS.PLANEJADO
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `python -m pytest tests/test_planejamento_modelo.py -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'planejamento'`.

- [ ] **Step 3: Criar `planejamento/__init__.py` (vazio) e `planejamento/modelo.py`**

```python
# planejamento/modelo.py
"""Modelo de dados da tabela única de planejamento.

Hierarquia: Setor (Bacia) -> Coletor -> Trecho -> Nota de Serviço.
Independente do CAD: dataclasses puras, sem dependência de GDAL/ezdxf.
Setor segue o conceito BACIAS do QEsg; defaults vêm de TBCP_ESG.DAT do pro_sane.
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional


class TipoServico(Enum):
    ASSENTAMENTO_TUBO = "assentamento_tubo"
    CAIXA = "caixa"
    CAIXA_INSPECAO = "caixa_inspecao"
    INTERLIGACAO = "interligacao"
    PAVIMENTACAO = "pavimentacao"


class StatusNS(Enum):
    PLANEJADO = "planejado"
    EM_EXECUCAO = "em_execucao"
    EXECUTADO = "executado"
    BLOQUEADO = "bloqueado"


@dataclass
class Setor:
    """Bacia/setor de esgotamento (setorização — conceito BACIAS do QEsg)."""
    id: str
    pop_ini: int = 0
    pop_fim: int = 0
    percapta: float = 150.0     # L/hab.dia (default TBCP_ESG.DAT residencial popular)
    k1_dia: float = 1.2
    k2_hora: float = 1.5
    coef_ret: float = 0.8
    coef_inf: float = 0.0002    # L/s.m


@dataclass
class Atividade:
    """Uma atividade de uma NS, feita por uma equipe especializada."""
    tipo: TipoServico
    equipe_tipo: str                       # "rede", "caixa", "inspecao", "interligacao"
    qtd_material: float = 0.0
    unidade: str = "m"
    produtiv_prev: Optional[float] = None   # avanço/dia previsto (vem do ML, Fase 3)
    produtiv_min: Optional[float] = None    # piso/meta para a equipe
    duracao_prev_dias: Optional[float] = None
    avanco_real: float = 0.0                # preenchido pelo RDO (Fase 4)

    def calc_duracao(self) -> Optional[float]:
        if self.produtiv_prev and self.produtiv_prev > 0:
            self.duracao_prev_dias = self.qtd_material / self.produtiv_prev
        return self.duracao_prev_dias


@dataclass
class NotaServico:
    """Pacote de trabalho. Título no padrão NUM_OSE.DEF do pro_sane:
    'NS011 TUBO DE QUEDA PI22 ATÉ PV11 SÃO MANOEL'."""
    ns_id: str
    descricao: str
    nucleo: str = ""
    setor: Optional[str] = None            # id do Setor/bacia
    coletor: Optional[str] = None
    trecho_ids: List[int] = field(default_factory=list)
    atividades: List[Atividade] = field(default_factory=list)
    status: StatusNS = StatusNS.PLANEJADO

    def titulo(self) -> str:
        return " ".join(p for p in (self.ns_id, self.descricao, self.nucleo) if p)

    def duracao_total_dias(self) -> float:
        return sum((a.calc_duracao() or 0.0) for a in self.atividades)
```

- [ ] **Step 4: Rodar para ver passar**

Run: `python -m pytest tests/test_planejamento_modelo.py -q`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add planejamento/__init__.py planejamento/modelo.py tests/test_planejamento_modelo.py
git commit -m "feat(planejamento): modelo Setor/Atividade/NotaServico"
```

---

### Task 2: Sanidade da rede lida (anti-invenção, sem GDAL)

**Files:**
- Create: `planejamento/sanidade.py`
- Test: `tests/test_sanidade.py`

Contexto: o leitor retorna `(pvs, trechos, ruas, meta)`. `pvs` é dict `{id: {...}}`; `trechos` é lista de dicts com chaves `pv_ini`, `pv_fim`, `ext_m`, `dn_mm` (ver `ler_dxf_gdal.py:1067`). Esta função NÃO lê DXF — recebe as estruturas já lidas e devolve avisos.

- [ ] **Step 1: Escrever o teste que falha**

```python
# tests/test_sanidade.py
from planejamento.sanidade import checar_sanidade


def _rede_ok():
    pvs = {"PV1": {}, "PV2": {}, "PV3": {}}
    trechos = [
        {"pv_ini": "PV1", "pv_fim": "PV2", "ext_m": 40.0, "dn_mm": 150},
        {"pv_ini": "PV2", "pv_fim": "PV3", "ext_m": 35.0, "dn_mm": 150},
    ]
    return pvs, trechos


def test_rede_sadia_sem_avisos():
    pvs, trechos = _rede_ok()
    assert checar_sanidade(pvs, trechos) == []


def test_trecho_com_pv_inexistente_e_flagado():
    pvs, trechos = _rede_ok()
    trechos.append({"pv_ini": "PV2", "pv_fim": "FANTASMA", "ext_m": 20.0, "dn_mm": 150})
    avisos = checar_sanidade(pvs, trechos)
    assert any("FANTASMA" in a for a in avisos)


def test_excesso_de_trechos_por_pv_e_flagado():
    # 3 PVs mas 30 trechos => provável invenção de rede
    pvs = {f"PV{i}": {} for i in range(3)}
    trechos = [{"pv_ini": "PV0", "pv_fim": "PV1", "ext_m": 10.0, "dn_mm": 150}
               for _ in range(30)]
    avisos = checar_sanidade(pvs, trechos)
    assert any("trecho" in a.lower() and "pv" in a.lower() for a in avisos)


def test_extensao_absurda_e_flagada():
    pvs, trechos = _rede_ok()
    trechos.append({"pv_ini": "PV1", "pv_fim": "PV3", "ext_m": 5000.0, "dn_mm": 150})
    avisos = checar_sanidade(pvs, trechos)
    assert any("extens" in a.lower() for a in avisos)
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `python -m pytest tests/test_sanidade.py -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'planejamento.sanidade'`.

- [ ] **Step 3: Criar `planejamento/sanidade.py`**

```python
# planejamento/sanidade.py
"""Sanity-check anti-invenção da rede lida do CAD.

Recebe as estruturas já lidas (não lê DXF) e devolve uma lista de avisos
legíveis. Vazia = rede confiável. É a trava para o bug histórico de
"tubos fantasmas" (inventar/perder rede por tolerância de snap).
"""
from typing import Dict, List

# Limiares (centralizar em config/INI numa fase futura)
MAX_TRECHOS_POR_PV = 4.0     # acima disso, provável invenção
EXT_MAX_M = 1000.0           # trecho único > 1 km em rede urbana é suspeito
EXT_MIN_M = 0.5              # trecho < 0,5 m é ruído


def checar_sanidade(pvs: Dict[str, dict], trechos: List[dict]) -> List[str]:
    avisos: List[str] = []
    ids = set(pvs.keys())

    for t in trechos:
        pi, pf = t.get("pv_ini"), t.get("pv_fim")
        if pi not in ids:
            avisos.append(f"Trecho referencia PV inexistente: {pi}")
        if pf not in ids:
            avisos.append(f"Trecho referencia PV inexistente: {pf}")
        ext = t.get("ext_m")
        if ext is not None and ext > EXT_MAX_M:
            avisos.append(f"Extensão suspeita ({ext:.0f} m) em {pi}->{pf}")
        if ext is not None and ext < EXT_MIN_M:
            avisos.append(f"Extensão mínima ({ext:.2f} m) em {pi}->{pf}")

    n_pv = max(len(ids), 1)
    if len(trechos) / n_pv > MAX_TRECHOS_POR_PV:
        avisos.append(
            f"Trechos/PV = {len(trechos)/n_pv:.1f} (>{MAX_TRECHOS_POR_PV}): "
            f"possível invenção de rede ({len(trechos)} trechos, {len(ids)} PVs)"
        )
    return avisos
```

- [ ] **Step 4: Rodar para ver passar**

Run: `python -m pytest tests/test_sanidade.py -q`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add planejamento/sanidade.py tests/test_sanidade.py
git commit -m "feat(planejamento): sanity-check anti-invenção da rede"
```

---

### Task 3: Teste golden (snapshot) da ingestão real

**Files:**
- Create: `planejamento/resumo.py`
- Create: `tests/test_golden_ingestao.py`
- Create (gerado): `tests/golden/sao_manoel.json`

Objetivo: congelar a saída do leitor existente num DXF real. Padrão snapshot: a primeira execução grava o baseline e FALHA pedindo conferência humana; depois de conferido e commitado, qualquer mudança na contagem quebra o teste (pega regressão de invenção/perda de rede).

Fixture: `_tmp_dwg/SAO_MANOEL_ESGOTO_COMPLETO_v3_.dxf` (já existe no repo).
Requer GDAL/geopandas/ezdxf instalados (o leitor depende deles). Se faltarem, o teste é pulado (skip), não falha.

- [ ] **Step 1: Criar `planejamento/resumo.py` (normaliza a saída do leitor)**

```python
# planejamento/resumo.py
"""Resumo normalizado e determinístico de uma rede lida — base do teste golden."""
from typing import Dict, List


def resumo_rede(pvs: Dict[str, dict], trechos: List[dict]) -> dict:
    chaves = sorted(
        f"{t.get('pv_ini')}->{t.get('pv_fim')}|dn={t.get('dn_mm')}|ext={round(float(t.get('ext_m') or 0), 1)}"
        for t in trechos
    )
    return {
        "n_pvs": len(pvs),
        "n_trechos": len(trechos),
        "pvs": sorted(str(k) for k in pvs.keys()),
        "trechos": chaves,
    }
```

- [ ] **Step 2: Escrever o teste golden**

```python
# tests/test_golden_ingestao.py
import json
import os
import pytest

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
DXF = os.path.join(RAIZ, "_tmp_dwg", "SAO_MANOEL_ESGOTO_COMPLETO_v3_.dxf")
GOLDEN = os.path.join(AQUI, "golden", "sao_manoel.json")


def test_ingestao_sao_manoel_bate_golden():
    if not os.path.exists(DXF):
        pytest.skip(f"fixture ausente: {DXF}")
    try:
        from ler_dxf_gdal import ler_dxf_gdal
    except Exception as e:               # GDAL/geopandas/ezdxf ausentes
        pytest.skip(f"dependências do leitor ausentes: {e}")
    from planejamento.resumo import resumo_rede

    pvs, trechos, _ruas, _meta = ler_dxf_gdal(DXF)
    atual = resumo_rede(pvs, trechos)

    if not os.path.exists(GOLDEN):
        os.makedirs(os.path.dirname(GOLDEN), exist_ok=True)
        with open(GOLDEN, "w", encoding="utf-8") as f:
            json.dump(atual, f, ensure_ascii=False, indent=2)
        pytest.fail(
            f"Baseline golden criado em {GOLDEN} "
            f"(n_pvs={atual['n_pvs']}, n_trechos={atual['n_trechos']}). "
            f"CONFIRA os números com o projeto real e commite; depois rode de novo."
        )

    with open(GOLDEN, encoding="utf-8") as f:
        esperado = json.load(f)
    assert atual["n_pvs"] == esperado["n_pvs"], "nº de PVs mudou (regressão de ingestão)"
    assert atual["n_trechos"] == esperado["n_trechos"], "nº de trechos mudou (possível invenção/perda)"
    assert atual["trechos"] == esperado["trechos"], "topologia/DN/extensão dos trechos mudou"
```

- [ ] **Step 3: Rodar — primeira vez gera o baseline e FALHA pedindo conferência**

Run: `python -m pytest tests/test_golden_ingestao.py -q`
Expected: ou `SKIPPED` (se faltar GDAL/fixture), ou `FAILED` com a mensagem "Baseline golden criado … CONFIRA os números". Abrir `tests/golden/sao_manoel.json` e conferir `n_pvs`/`n_trechos` contra o projeto São Manoel real.

- [ ] **Step 4: Conferido o baseline, rodar de novo — agora passa**

Run: `python -m pytest tests/test_golden_ingestao.py -q`
Expected: PASS (1 passed) — ou SKIPPED no ambiente sem GDAL.

- [ ] **Step 5: Commit (inclui o golden conferido)**

```bash
git add planejamento/resumo.py tests/test_golden_ingestao.py tests/golden/sao_manoel.json
git commit -m "test: golden snapshot da ingestão (São Manoel) — trava anti-invenção"
```

---

### Task 4: Rodar a suíte e fechar a Fase 1

- [ ] **Step 1: Rodar toda a suíte**

Run: `python -m pytest -q`
Expected: testes do modelo e da sanidade PASS; o golden PASS ou SKIPPED (ambiente sem GDAL).

- [ ] **Step 2: Commit final (se houver ajustes)**

```bash
git add -A
git commit -m "test: fecha Fase 1 (tabela única + ingestão confiável)"
```

---

## Notas de validação humana (não são placeholders — são confirmações de obra)
- O `n_pvs`/`n_trechos` do golden de São Manoel devem ser conferidos por você contra o projeto real na primeira execução (o teste força isso).
- Os limiares de sanidade (`MAX_TRECHOS_POR_PV=4`, `EXT_MAX_M=1000`) são iniciais; calibrar com 2-3 obras reais.
- Defaults do `Setor` (`percapta=150`, `k1=1.2`, `k2=1.5`) vêm do pro_sane (`TBCP_ESG.DAT`); confirmar a categoria por obra.
