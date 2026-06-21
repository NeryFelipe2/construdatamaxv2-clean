# Design — Motor de Planejamento por Nota de Serviço (NOVA NS V5)

**Data:** 2026-06-21
**Autor:** Felipe Nery + Claude
**Status:** design para aprovação
**Escopo:** planejamento e execução de obra via Notas de Serviço (água e esgoto). **Fora de escopo:** dimensionamento hidráulico (cálculo de DN/declividade) — o foco é planejar, gerar NS, materiais, cronograma e fechar contra o realizado.

---

## 1. Objetivo

Transformar o NOVA NS V5 num motor que, a partir da rede desenhada (CAD), produz **Notas de Serviço** como pacotes de trabalho para as equipes — cada NS com **cronograma, material e produtividade mínima** — que sobem para um **cronograma geral vivo**, e que se fecham **diariamente** contra o **Diário de Obra (RDO)**: planejado ⟷ realizado, com replanejamento contínuo.

O programa já tem esqueleto disso (`gerar_ns.py`, `gerar_ose.py`, `gerar_cronograma.py`, `motor_lean_lps.py`, `motor_status_ns.py`, `motor_producao_vs_medido.py`). O trabalho é **fazer melhor e amarrar num ciclo único**, sem multiplicar erro.

## 2. Princípios (inegociáveis)

1. **Fonte única de verdade.** Uma única tabela de trechos. NS, material, cronograma e RDO são *views/exports* dessa tabela — nunca cálculos paralelos divergentes.
2. **Não multiplicar erro.** A rede não pode ser inventada na ingestão; a produtividade é confirmada na origem; o desvio é pego no dia seguinte, não no fim.
3. **Planilha = template + mapa de colunas**, nunca hardcode (padrão `DATOSE.DEF` do pro_sane).
4. **Reimplementar, não copiar.** QEsg/QWater são **GPL** — usamos o padrão/algoritmo, código nosso.
5. **Ler config em runtime**, não cravar (parâmetros vivos do pro_sane: `DECL_ALT.MIN`, `LST_VALA.DEF`, catálogos `.TUB`).

## 3. O que cada fonte ensinou (verificado, com evidência)

### pro_sane — fluxo NS / planilha (faz tudo, é a referência)
- **NS = número + serviço + trecho + núcleo:** `NUM_OSE.DEF` → `"NS011 TUBO DE QUEDA PI22 ATÉ PV11 SÃO MANOEL"`; índice sequencial em `OSE_IDX_USR.DEF`.
- **OSE (planilha de serviço):** `DATOSE.DEF` = template Excel (`OSE-Modelo_1.xls`) + nº de colunas (19) + mapa campo→coluna (Estaca→D, CT→L, decliv→N, CP→P, DN→T, Prof→Z…) + escalas de perfil. Variante `SANEPAR.ose` com fórmulas de volume por faixa de profundidade.
- **Lista de Material:** `LST_MAT.DEF` = colunas `Num | Quant. | Und. | Dimensão | Código | Descrição`, populadas do catálogo `.TUB` (DN comercial + **código SINAPI** + preço por material; ex. Concreto 300mm = SINAPI 95565).
- **Parâmetros vivos:** `DECL_ALT.MIN` = 0,005 m/m e recobrimento 1,0 m; `LST_VALA.DEF` = vala 0,60 m, lastro 0,15 m, BDI 1,25; `TBCP_ESG.DAT` = contribuição per-capita por ocupação (13 categorias).
- **Setorização:** **NÃO existe** no pro_sane (organiza por OSE/trecho e por Coletor).

### QEsg — setorização e modelo de dados (Python, GPL)
- **Setorização real:** camada `BACIAS` (`QEsg_00Model.py:52-53`) com `POPINI, POPFIM, PERCAPTA, K1_DIA, K2_HORA, COEF_RET, COEF_INF`.
- **Numeração sistemática:** `Coletor + Trecho → DC_ID` (`QEsg_00Rename.py`, ex. `01-02`).
- **Ingestão limpa (anti-invenção):** nós = **pontas das linhas** vetoriais (`CriaNos`), casados por coordenada — não por tolerância em entidade crua de DXF.
- **Modelo de dados (PIPES):** trecho como feature de linha com todos os atributos (PVM/PVJ, cotas, DN, prof, etc.).

### QWater — padrão de integração (Python, GPL) — *aplicação futura (água)*
- Padrão **GIS → template `.inp` → EPANET → resultados** (`GHydraulicsInpWriter`/`ModelRunner`/`ResultReader`). Física no template, não no código. Mantido como referência para quando a rede de água entrar.

### NOVA NS V5 — estado atual (o que melhorar)
- Motor real = `gerar_ns.py` (via GUI); lê DXF, reconstrói topologia, calcula verificação. Tem **2 funções de quantitativo divergentes** (`FINAL` vs `processar_quantitativos.py`) com larguras de vala diferentes → quebra a fonte única.
- Ingestão `ler_dxf_gdal.py` já é conservadora (filtro de camadas, cluster 3 m, descarta tubo < 2 m) — base boa para o caminho DXF→SHP.

## 4. Arquitetura

### 4.1 Tabela única de trechos (fonte de verdade)
Modelo inspirado em `PIPES` (QEsg) + campos de planejamento/execução. Hierarquia:

```
SETOR (Bacia)  →  COLETOR  →  TRECHO  →  NS
   pop, demanda     numeração     geometria    pacote de trabalho
```

Campos por trecho (núcleo): identificação (`SETOR, COLETOR, TRECHO, DC_ID, NS_ID, NS_DESC`), geometria/rede (`PVM, PVJ, X/Y, CTM, CTJ, CCM, CCJ, EXT, DN, MATERIAL`), planejamento (`SERVICO_TIPO, EQUIPE_TIPO, QTD_MATERIAL, PRODUTIV_PREV, PRODUTIV_MIN, DURACAO_PREV, DATA_INI_PLAN, DATA_FIM_PLAN`), execução/RDO (`AVANCO_REAL_DIA, DATA_REAL, EQUIPE_REAL, STATUS, OBS`).

> A planilha de cronograma, a lista de material e o RDO são **exports/views** dessa tabela. Nada recalcula por fora.

### 4.2 Pipeline (ciclo fechado, diário)

```
CAD (DXF/DWG)
   │  ingestão confiável (DXF→SHP linhas; nó=ponta; sanity-check; golden test)
   ▼
TABELA ÚNICA de trechos  ── setorização: Bacia → Coletor → Trecho
   │
   ├─► NS  (número+serviço+trecho+núcleo, estilo NUM_OSE)
   ├─► PLANILHAS  (template + mapa: OSE, lista de material c/ catálogo+SINAPI)
   ├─► PRODUTIVIDADE (ML por analogia + confirmação humana)
   └─► CRONOGRAMA GERAL vivo (aloca equipes especializadas + precedências)
                     │
                     ▼  obra executa → RDO (diário)
            PLANEJADO ⟷ REALIZADO (compara no dia)
                     │  desvio → REPLANEJA + realimenta produtividade
                     └────────────► volta pro planejado de amanhã
```

### 4.3 Componentes

**C1 — Ingestão confiável.** Caminho único DXF→camada de linhas + nós (ponta da linha), todas as tolerâncias num `config/*.INI`, sanity-check (rejeita trecho em camada não-rede, contagem fora do esperado, tubo sem PV) e **teste golden** de regressão (ex.: TETÉU; falha se a contagem mudar). Consolida sobre `ler_dxf_gdal.py`.

**C2 — Tabela única + setorização.** Estrutura `Setor(Bacia)→Coletor→Trecho→NS` com numeração `DC_ID`. Estende `models.py` com `Setor`, `Atividade`, `Equipe`. A tabela é o contrato entre todos os módulos.

**C3 — Gerador de NS.** Cada NS = pacote: número + descrição (`NS011 …`) + trecho(s) + atividades por tipo de serviço, cada uma com equipe especializada (caixa, inspeção, interligação…), quantitativo de material e produtividade.

**C4 — Planilhas (template + mapa).** Motor genérico que preenche um template (Excel/DXF) por um mapa de colunas (estilo `DATOSE.DEF`). Saídas: OSE (SABESP e SANEPAR selecionáveis), lista de material (catálogo `.TUB` + SINAPI), planilha de cronograma. Unifica as 2 funções de quantitativo divergentes do V5 em uma só.

**C5 — Produtividade (ML por analogia).** `motor_produtividade.py`: base que cresce dos RDOs + `CONSOLIDADO_NOTAS_SERVICO`; por similaridade de contexto (tipo de serviço, solo, DN, profundidade, cidade, equipe) acha a(s) execução(ões) parecida(s) → produtividade prevista **por atividade/equipe**; devolve o número **com a obra de referência** e **pergunta "está ok?"**. Substitui `motor_ml.py` (R²=0,27). O realizado do RDO realimenta a base.

**C6 — Cronograma geral vivo.** Sobre `gerar_cronograma.py` + `motor_microplanejamento.py` + `motor_lean_lps.py`: cada NS tem prazo (soma); o geral **aloca atividades nas equipes especializadas** (recurso compartilhado) e respeita **precedências** (tubo→caixa→interligação→pavimentação). Saídas: timeline, curva S físico-financeira, material por equipe/total. Reprojeta a cada RDO (rolling-wave / Last Planner).

**C7 — RDO e fechamento diário.** O RDO escreve `AVANCO_REAL_DIA` de volta na **mesma tabela** (por trecho/dia). Compara planejado×realizado, sinaliza desvio, dispara replanejamento e alimenta C5. Sobre `motor_producao_vs_medido.py` + `motor_status_ns.py`.

## 5. Fases de entrega (cada uma é spec/plano próprio)

1. **Fase 1 — Tabela única + ingestão confiável (C1, C2).** Modelo de dados + setorização + golden test. É a fundação; nada confiável sem ela.
2. **Fase 2 — NS + Planilhas template-driven (C3, C4).** Gerar NS numeradas e as planilhas (OSE, material, cronograma) por template+mapa, unificando os quantitativos.
3. **Fase 3 — Produtividade ML + Cronograma vivo (C5, C6).** Analogia + confirmação; alocação de equipes + precedências.
4. **Fase 4 — RDO e ciclo diário (C7).** Fechamento planejado⟷realizado, replanejamento, realimentação da produtividade.

## 6. Riscos e pontos a validar (honesto)

- Motores de geração do pro_sane (`lst_mat.fas`, `sep_lstw.exe`) são **compilados** — temos o formato das saídas, não a lógica interna.
- Setorização confirmada no QEsg (`BACIAS`); **ausente no pro_sane**.
- QEsg/QWater são **GPL** → reimplementar, não copiar.
- Os números golden do TETÉU (64 tubos/57 PVs/50 trechos) vêm dos markdowns — **a confirmar** rodando a ingestão.
- Conteúdo real dos RDOs ainda não auditado para a base de produtividade — validar antes da Fase 3.
- Lista completa de **tipos de equipe** especializada a confirmar com o usuário (temos: caixa, inspeção, interligação).

## 7. Decisões já tomadas

- Foco: planejamento/execução/NS/planilha/setorização. **Dimensionamento fora de escopo** (por ora).
- Produtividade = base que cresce (RDO/consolidado) + override, com confirmação humana.
- Cronograma geral = consolidação + alocação de equipes especializadas + precedências, **vivo** (atualiza com o RDO diário).
- Anti-erro central = ingestão confiável (não inventar rede) + fonte única + confirmação na origem + fechamento diário.
