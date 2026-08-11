# Relatório resumido — revisão crítica de documentação

Arquivos lidos:
- `README.md`
- `VERIFICACAO_PLATAFORMA.md`
- `MANUAL_DEFINITIVO_PLATAFORMA.md`
- `FLUXO_PLATAFORMA_ATUAL.md`
- `COMO_USAR.md`
- `COMO_ABRIR.md`

## 1) Versões conflitantes da plataforma

- `README.md` apresenta o projeto como **“ConstruData SABESP v5.0 — Pipeline BIM”**.
- `FLUXO_PLATAFORMA_ATUAL.md` também fala em **“ConstruData SABESP v5.0”** e usa o executável `construdata_sabesp_v5_FINAL.py`.
- `VERIFICACAO_PLATAFORMA.md` descreve a solução como **“CONSTRUDATA - HydroNetwork v7.0”**.
- `MANUAL_DEFINITIVO_PLATAFORMA.md` usa **“ConstruData HydroNetwork”**, sem “SABESP”, e trata a plataforma como estágio mais avançado, com IA, contratos multiestado e GUI de 12 abas.
- `COMO_ABRIR.md` reforça **“ConstruData HydroNetwork v7.0”**.
- `COMO_USAR.md` descreve um **“CONSTRUDATA APLICATIVO GENÉRICO”**, sem fixar claramente v5/v7, o que amplia a ambiguidade.

### Evidência objetiva
- Em `README.md`, a identidade é de um script unificado v5.
- Em `VERIFICACAO_PLATAFORMA.md` e `MANUAL_DEFINITIVO_PLATAFORMA.md`, a identidade é de uma plataforma HydroNetwork v7 com escopo muito maior.
- Em `FLUXO_PLATAFORMA_ATUAL.md`, o comando principal muda para `construdata_sabesp_v5_FINAL.py`, diferente do `README.md`, que centraliza `ConstruData_SABESP_v5.py`.

### Conclusão
Há pelo menos **três camadas declarativas concorrentes**:
1. script v5 (`ConstruData_SABESP_v5.py`);
2. script “final” v5 (`construdata_sabesp_v5_FINAL.py`);
3. plataforma HydroNetwork v7.

Isso dificulta entender qual é o produto oficial, qual é a entrada principal e qual documentação está atualizada.

---

## 2) Nomes de empresa/contrato conflitantes

### Contrato
- O número **11481051** é consistente nos documentos lidos.

### Empresa / responsável
Há conflito explícito entre as entidades associadas ao projeto:

- `README.md`:
  - **“FCN Construções e Saneamento”**
  - também usa a marca **“SE LIGA NA REDE”**
- `VERIFICACAO_PLATAFORMA.md`:
  - **“FCN Construcoes e Saneamento”**
  - e ainda impõe em “Regras invioláveis”:
    - **“Empresa: FCN Construcoes e Saneamento (NUNCA ‘FCN Construções e Saneamento’)”**
- `MANUAL_DEFINITIVO_PLATAFORMA.md`:
  - **“FCN Construcoes e Saneamento”**
  - repete a regra de nunca usar FCN
- `COMO_ABRIR.md`:
  - **“FCN Construções”**
- `README.md` API example:
  - usa `empresa = "CONSÓRCIO SE LIGA NA REDE"`

### Conflito adicional de nomenclatura institucional
- Em um ponto aparece **empresa** como `FCN Construções e Saneamento`.
- Em outros, como **FCN Construções e Saneamento**.
- Em outros, aparece **Consórcio SE LIGA NA REDE** como identificação operacional.
- Não fica claro se:
  - FCN = empresa executora;
  - FCN = empresa anterior/incorreta;
  - SE LIGA NA REDE = consórcio/contrato/projeto.

### Conclusão
O contrato parece estável, mas a **identidade institucional está inconsistente** e um dos próprios documentos (`VERIFICACAO_PLATAFORMA.md`) contradiz frontalmente o `README.md`.

---

## 3) Promessas de funcionalidades/documentação não comprovadas no que foi lido

## 3.1 Escopo funcional declarado cresce fortemente entre documentos
O `README.md` descreve um pipeline BIM para DXF/JSON com NS, IFC, QR, GeoJSON e Dynamo.  
Já `VERIFICACAO_PLATAFORMA.md`, `MANUAL_DEFINITIVO_PLATAFORMA.md` e `COMO_ABRIR.md` prometem muito mais:

- GUI desktop com 11 ou 12 abas;
- 6 ou 7 interfaces HTML;
- integração com 4 LLMs gratuitos;
- leitura de foto e PDF via Gemini;
- analytics ML com XGBoost;
- gestão de perdas IWA;
- gestão multi-contrato;
- operação em 18 estados com CRS automático;
- geração de Primavera P6 XER;
- SLNR Mestre unificado com 12 núcleos;
- múltiplos relatórios e painéis.

Nos arquivos lidos, essas promessas são declaradas, mas **não são comprovadas pela documentação de uso de forma consistente**.

## 3.2 Itens prometidos sem comprovação suficiente dentro do conjunto lido

### a) Menus e arquivos `.bat` citados por `COMO_USAR.md`
`COMO_USAR.md` promete:
- `CONSTRUDATA_MENU.bat`
- `PROCESSAR_DXF.bat`
- `SELECIONAR_DXF.bat`
- `ABRIR_CRIADORES.bat`
- `ABRIR_BATCH.bat`
- `ABRIR_DOCUMENTACAO.bat`

Pela listagem recebida, esses arquivos **não aparecem** no diretório raiz mostrado.  
Ou seja: a própria documentação de uso aponta atalhos que não estão evidentes na estrutura listada.

### b) `INSTALAR.bat` citado em `README.md`
- `README.md` diz: **“Windows — duplo clique em INSTALAR.bat”**
- Na listagem mostrada, **`INSTALAR.bat` não aparece**.

### c) Arquivos/pastas de saída e nomes exemplificados sem consistência
- `COMO_ABRIR.md` menciona `saida_hydronetwork/` com geração de planilhas SLNR.
- `README.md` e `FLUXO_PLATAFORMA_ATUAL.md` usam `SAIDA_BIM_SABESP/`.
- Não há explicação documental clara de quando uma saída substitui a outra.

### d) Guia de abertura focado em analytics/SLNR, não no pipeline principal
`COMO_ABRIR.md` afirma que ao abrir a GUI o usuário verá seções de:
- **Analytics ML**
- **SLNR Mestre Unificado**

Mas isso não é alinhado com o `README.md`, que posiciona o produto principal como pipeline de geração de NS/BIM. A documentação de abertura parece descrever **outro recorte da plataforma**.

### e) Contagens e números de módulos variam
- `VERIFICACAO_PLATAFORMA.md`: **18 scripts Python**, **6 interfaces HTML**, GUI com **11 abas**
- `MANUAL_DEFINITIVO_PLATAFORMA.md`: **22 scripts Python**, **7 interfaces HTML**, GUI com **12 abas**
- `COMO_ABRIR.md`: tela exemplifica foco em analytics/IA, mas sem reconciliar essa mudança de arquitetura

Isso enfraquece a confiança de que a documentação descreve um estado único do sistema.

---

## 4) Divergências entre estruturas de saída descritas nos documentos

## 4.1 Nome e organização de arquivos por trecho

### `README.md`
Na pasta `01_NS_CAMPO/NS_xxx.../` descreve:
- `NS_001_A4.pdf`
- `NS_001_DADOS.json`
- `NS_001_QR.png`

E separa outros artefatos em:
- `02_OSE/`
- `03_DESENHOS/`
- `04_HTML/`

### `FLUXO_PLATAFORMA_ATUAL.md`
Na pasta do trecho dentro de `01_NS_CAMPO/` descreve:
- `NS_001_A4.pdf`
- `NS_001_DESENHO.pdf`
- `NS_001_OSE.xlsx`
- `NS_001_DADOS.json`
- `NS_001.html`

Ou seja, aqui **OSE, desenho e HTML aparecem dentro da pasta do trecho**, apesar de também existirem pastas globais `02_OSE`, `03_DESENHOS`, `04_HTML`.

### `COMO_USAR.md`
Na pasta do trecho descreve:
- `NS_XXX_A4.pdf`
- `NS_XXX_DESENHO.pdf`
- `NS_XXX_OSE.xlsx`
- `NS_XXX_DADOS.json`
- `NS_XXX_DASHBOARD.html`

Isso já diverge de `FLUXO_PLATAFORMA_ATUAL.md`, que usa `NS_001.html`, e de `README.md`, que cita `NS_001.html` em `04_HTML/`.

## 4.2 Extensões e nomes de GIS
- `README.md`:
  - `05_GIS/rede_definida.json`
  - `05_GIS/rede_dynamo.json`
- `FLUXO_PLATAFORMA_ATUAL.md`:
  - `05_GIS/rede_definida.geojson`
  - `05_GIS/rede_dynamo.json`
- `COMO_USAR.md`:
  - `05_GIS/rede_definida.json`
  - `05_GIS/dynamo_civil3d.json`

Há conflito em:
- `rede_definida.json` vs `rede_definida.geojson`
- `rede_dynamo.json` vs `dynamo_civil3d.json`

## 4.3 Script/log em pastas diferentes
- `README.md` coloca em `07_LOG/`:
  - `dynamo_pipe_network_v5.py`
  - `log_processamento.json`
- `FLUXO_PLATAFORMA_ATUAL.md` coloca:
  - `dynamo_pipe_network_v5.py` em `05_GIS/`
  - `log_processamento.json` em `07_LOG/`

## 4.4 Numeração de diretórios
- `README.md` usa:
  - `06_BIM/`
  - `06_EXCEL/`
  - `07_LOG/`
- `FLUXO_PLATAFORMA_ATUAL.md` repete a duplicidade:
  - `06_BIM/`
  - `06_EXCEL/`

Mesmo sem ser erro funcional, a numeração declarada é inconsistente/estranha e sugere falta de padronização documental.

## 4.5 Saída do pipeline em estrutura alternativa
`VERIFICACAO_PLATAFORMA.md` descreve outro arranjo:
- `01_NS/`
- `02_CIVIL3D/`
- `03_CADASTRO_NTS292/`
- `04_BIM_LOD500/`
- `05_CRONOGRAMA/`
- `PIPELINE_RESULTADO.json`

Essa árvore é substancialmente diferente da árvore `SAIDA_BIM_SABESP/` mostrada em `README.md`, `FLUXO_PLATAFORMA_ATUAL.md` e `COMO_USAR.md`.

### Conclusão
Existem **múltiplas estruturas de saída concorrentes**, sem documento mestre que diga qual está vigente:
1. árvore `SAIDA_BIM_SABESP` por disciplina;
2. árvore `SAIDA_BIM_SABESP` por trecho + globais misturados;
3. árvore `SAIDA_NUCLEO` em 5 etapas do pipeline;
4. árvore `saida_hydronetwork` para analytics/SLNR.

---

## Síntese executiva

Principais inconsistências declarativas encontradas:

1. **Versão do produto conflita**:
   - v5 SABESP
   - v5 final
   - HydroNetwork v7

2. **Empresa conflita**:
   - `README.md` usa **FCN Construções e Saneamento**
   - `VERIFICACAO_PLATAFORMA.md` e `MANUAL_DEFINITIVO_PLATAFORMA.md` dizem que a empresa correta é **FCN Construções e Saneamento** e que FCN nunca deve ser usada
   - exemplos de API ainda usam **Consórcio SE LIGA NA REDE**

3. **Promessas documentais não estabilizadas**:
   - vários `.bat` mencionados em `COMO_USAR.md` não aparecem na listagem recebida
   - `INSTALAR.bat` citado no `README.md` também não aparece
   - contagem de módulos/HTML/abas varia entre documentos
   - a documentação de abertura prioriza analytics/SLNR, enquanto o README prioriza pipeline de NS/BIM

4. **Estrutura de saída diverge bastante**:
   - nomes de arquivos por trecho variam (`NS_001.html` vs `NS_XXX_DASHBOARD.html`)
   - formatos GIS variam (`.json` vs `.geojson`)
   - nome do JSON Dynamo varia
   - localização do script Dynamo varia
   - árvore do pipeline v7 não bate com a árvore do v5

## Risco documental

A documentação atual parece ser uma **sobreposição de versões e propostas de escopo diferentes**, não um conjunto unificado. Para discutir com quem desenvolveu a plataforma, o ponto central é: **definir qual documento representa a verdade atual do produto** e alinhar todos os demais a essa referência única.