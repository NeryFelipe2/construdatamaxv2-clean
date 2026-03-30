# CONTEXTO COMPLETO — Sessao ConstruData SABESP v5.0
# Data: 2026-03-20
# Para continuar: cole este arquivo no inicio da proxima conversa com Claude

---

## 1. QUEM E O USUARIO

Felipe Nery, engenheiro civil/sanitarista na DGS Engenharia.
Projeto SE LIGA NA REDE, Consorcio SLNR Santos, contrato SABESP 11481051.
Nucleos: Sao Manoel, Joao Carlos, Vila Criadores, Pantanal Baixo, Morro do Teteu, Vila Israel.
Stack: Civil 3D 2025/2026 + ProSaneamento + Dynamo 3.x + Python 3.14 + ezdxf + matplotlib + openpyxl.

---

## 2. PASTA DO PROJETO

```
C:\Users\felip\Downloads\NOVA NS Versao 5\
  construdata_sabesp_v5_FINAL.py   <- SCRIPT PRINCIPAL (~4500 linhas)
  construdata_gui.py               <- GUI tkinter (botoes)
  construdata_integrador.py        <- Integrador
  construdata_planner.py           <- Planejador
  CONSTRUDATA.bat                  <- Launcher duplo-clique
  ConstruData_SABESP_v5.py         <- Versao de referencia (fil32es)
  PROMPT_CLAUDECODE_CONSTRUDATA.md <- Prompt de contexto para IA
  README.md
  OSE-Modelo_1_TEMPLATE.xlsx       <- Template OSE oficial do ProSaneamento
  DIMENSIONAL_TETEU_PROSANE.xlsx   <- Planilha gerada do CSV dimensional
  COMPARATIVO_TETEU.xlsx           <- (antigo, substituido pelo DIMENSIONAL)
  CUSTOS_TETEU.xlsx
```

---

## 3. ARQUIVOS DXF DISPONIVEIS PARA TESTE

```
ESGOTO:
  C:\Users\felip\Downloads\cadastro-bim-sabesp\dados\Projeto Criadores- ESGOTOrev12elevatoria.dxf
  C:\Users\felip\Downloads\PROJETOS DE AGUA E ESGOTO - DWG E DXF 2018\MAPAS AGUA E ESGOTO PARA DXF\MORRO DO TETEU\TETEU_ESGOTO.dxf
  C:\Users\felip\Downloads\PROJETOS DE AGUA E ESGOTO - DWG E DXF 2018\MAPAS AGUA E ESGOTO PARA DXF\JOAO CARLOS\JOAO_CARLOS_ESGOTO.dxf
  C:\Users\felip\Downloads\PROJETOS DE AGUA E ESGOTO - DWG E DXF 2018\MAPAS AGUA E ESGOTO PARA DXF\PANTANAL BAIXO\PANTANAL_ESGOTO.dxf
  C:\Users\felip\Downloads\PROJETOS DE AGUA E ESGOTO - DWG E DXF 2018\MAPAS AGUA E ESGOTO PARA DXF\PROLONGAMENTO CRIADORES.dxf

AGUA:
  C:\Users\felip\Downloads\PROJETOS DE AGUA E ESGOTO - DWG E DXF 2018\MAPAS AGUA E ESGOTO PARA DXF\MORRO DO TETEU\TETEU_AGUA.dxf
  C:\Users\felip\Downloads\PROJETOS DE AGUA E ESGOTO - DWG E DXF 2018\MAPAS AGUA E ESGOTO PARA DXF\VILA DOS CRIADORES\CRIADORES_AGUA.dxf
  C:\Users\felip\Downloads\PROJETOS DE AGUA E ESGOTO - DWG E DXF 2018\MAPAS AGUA E ESGOTO PARA DXF\VILA ISRAEL\ISRAEL_AGUA.dxf
  C:\Users\felip\Downloads\PROJETOS DE AGUA E ESGOTO - DWG E DXF 2018\MAPAS AGUA E ESGOTO PARA DXF\SAO MANOEL\SAO_MANOEL_AGUA.dxf
  C:\Users\felip\Downloads\PROJETOS DE AGUA E ESGOTO - DWG E DXF 2018\MAPAS AGUA E ESGOTO PARA DXF\PANTANAL BAIXO\PANTANAL AGUA.dxf

GPKG:
  C:\Users\felip\Downloads\MAPA TETEU-VALE VERDE_R04 (QGIS).gpkg
  C:\Users\felip\Downloads\cadastro\CARTOGRAFIA VILA CRIADORES_R06 (QGIS).dxf (tem .gpkg tambem)
  C:\Users\felip\Downloads\cadastro\MAPA SAO MANOEL_RV05 (QGIS).dxf

CSV DIMENSIONAL (ProSaneamento):
  C:\Users\felip\Downloads\NOVA NS Versao 5\TETEU_ESGOTO - Dimensiona(Esgoto).csv
```

---

## 4. PROSANEAMENTO — INSTALACAO LOCAL

```
C:\pro_sane\                       <- Instalacao completa do ProSaneamento
  DATOSE.DEF                       <- Mapeamento OSE: colunas D/F/H/J/L/N/P/R/T/V/X/Z/AB/AF
  GER_PERF.DEF                     <- Perfil: escalas H=200, V=200, exag=0.5
  LAYERS.DAT                       <- 18 layers oficiais PS_*
  INDCTUB.DAT                      <- Ordem textos PV: C.T.(1), Prof(2), C.F.(3)
  INS_CNX.DEF                      <- Insercao PV: tamanho=6, escala=12, prof_default=0.5
  LST_VALA.DEF                     <- Vala: largura=60cm, lastro=15cm, BDI=1.25
  DECL_ALT.MIN                     <- Decl minima=0.002 m/m, prof min=0.3m
  PAR_ADD0.DAT                     <- Manning esgoto: n=0.013
  PAR_ADD2.DAT                     <- Manning agua: n=0.003
  Planilha\OSE-Modelo_1.xlsx       <- Template OSE oficial (copiado para nossa pasta)
```

---

## 5. DESCOBERTAS CRITICAS (XDATA ProSaneamento)

### PH_DATCNX (PVs):
```
reals[3] = CF (geratriz inferior) — NAO e CT!
CT = CF + prof
A plataforma de referencia (fil32es) que gerou 134/134 confirma: reals[3]=CF
```

### PH_DATTUB (tubos):
```
strs[0] = material ("Tubo PVC")
strs[1] = DN em mm ("300", "200") — USAR ESTE
reals[0] = 6.0 — flag de versao, IGNORAR (nao e DN!)
ext_m = calcular da geometria, nao do XDATA
```

### PS_DATRUA:
```
SEMPRE vazio neste projeto. Nao usar.
Ruas vem de: A_Alerta, ZZ-Carimbo Texto, TXT-LOGRAD, LT-TEXTO-RUA, TXT-PRACA
```

---

## 6. PROBLEMA PRINCIPAL ATUAL — PVs INVENTADOS

### Causa raiz (descoberta nesta sessao):
O script usa XDATA raw como fonte primaria de PVs. Os INSERTs com XDATA incluem:
- Blocos de detalhe de poco (repetidos 5-10x por PV)
- Blocos de listagem/legenda
- Blocos de perfil

No DXF do Teteu: 37.550 INSERTs XDATA → 10.216 PVs extraidos (errado)
Na realidade: layer PS_PONTOS_IDENTIFICACAO_TXT tem 61 PVs reais (PV_1 a PV_61)

### Solucao necessaria:
PRIORIZAR PS_PONTOS_IDENTIFICACAO_TXT (textos via ezdxf) sobre XDATA raw.
Quando PS_PONTOS tem dados (CT, CF, prof), usar esses. So usar XDATA como fallback.

### Comparacao confirmada:
```
PS_PONTOS texto: PV_01 CT=3.963  ← CORRETO (bate com CSV dimensional)
XDATA INSERT:    PV_001 CT=None  ← ERRADO (bloco de detalhe sem dados)
```

---

## 7. PROBLEMA — TUBOS INVENTADOS

### Causa raiz:
XDATA raw pega TODAS as polilinhas (90.701 no Teteu), incluindo:
- Linhas de detalhe, hachura, simbolos (89.876 com ext < 5m)
- Perfis longitudinais
- Quadros de legenda

Os tubos REAIS estao no layer TUBO_PVC (519 polilinhas, 388 com ext entre 5-200m).

### Solucao necessaria:
Quando PS_PONTOS e fonte primaria (coords UTM), usar TUBO_PVC do ezdxf.
Os TUBO_PVC tambem estao em UTM → snap funciona.
Filtrar tubos com extensao < 3m ou > 300m como falsos.

---

## 8. PROBLEMA — AGUA NAO FUNCIONA

### Causa raiz:
Rede de agua usa nomenclatura diferente:
- Nao tem PV/PI — pontos sao TE, C90, C45, CAP, RED, CURVA
- Layer PS_PONTOS tem: "TE DN100a", "C90 DN75a", "CURVA 22 DN75b"
- Tubos no layer TUBO_PE_80_NTS194_PN_12_5 (nao TUBO_PVC)
- Polilinhas LIN-AF nao existem neste DXF

### Solucao necessaria:
Adicionar reconhecimento de nomes de agua no agrupador de textos.
Aceitar layers de tubo PE80/PE100/PEAD alem de TUBO_PVC.

---

## 9. PROBLEMA — LEAFLET NAO MOSTRA MAPA

### Causa raiz:
PVs com coordenadas locais (espaco de desenho) passam por utm_to_latlon() e geram
lat=-85, lon=-135 (invalidas). O guard _coords_validas filtra e mostra "Mapa indisponivel".
Dos 53 NS do Criadores, so 15 tem mapa (os PVs que tinham match com texto UTM).

### Solucao:
Com o fix de PS_PONTOS como fonte primaria (UTM real), todos os PVs terao
coordenadas validas e o Leaflet vai funcionar em 100% dos casos.

---

## 10. PROBLEMA — OSE FORA DO PADRAO

### Causa raiz:
Nossa OSE usa colunas sequenciais A-Q.
A OSE oficial do ProSaneamento usa colunas espalhadas:
B=TRECHO, D=ESTACA_INT, F=ESTACA_FRAC, H=DIST_PARC, J=DIST_ACUM,
L=CT, N=I, P=CP(CF), R=CR(prof), T=DN, V=G, X=H, Z=P,
AB=NOME_PV, AD=TIPO_PV, AF=PROF_PV, AH=OBS

### Solucao:
Reescrever gerar_ns_ose() para usar o template OSE-Modelo_1.xlsx como base
e preencher nas colunas exatas do DATOSE.DEF.

---

## 11. TODO — O QUE FALTA FAZER (em ordem de prioridade)

### CRITICOS:
1. [ ] Fix PV extraction: PRIORIZAR PS_PONTOS_IDENTIFICACAO_TXT sobre XDATA
2. [ ] Fix tube matching: usar TUBO_PVC layer (ezdxf) quando PVs vem de PS_PONTOS
3. [ ] Validar: rodar Teteu e confirmar 61 PVs + 67 trechos (igual CSV dimensional)

### IMPORTANTES:
4. [ ] Add street layers: LT-TEXTO-RUA, TXT-PRACA, PS_IND_TRECHO como fontes de rua
5. [ ] Fix OSE: reescrever com layout oficial ProSaneamento (DATOSE.DEF)
6. [ ] Add agua support: reconhecer TE, C90, C45, CAP, RED, CURVA como nos de agua
7. [ ] Fix Leaflet: com PS_PONTOS UTM, mapas devem funcionar automaticamente
8. [ ] Gerar REDE_GERAL.html: mapa Leaflet com TODOS os trechos do nucleo

### CONFIGURACAO:
9. [ ] Usar parametros ProSaneamento: LST_VALA.DEF, DECL_ALT.MIN, GER_PERF.DEF
10. [ ] Atualizar .bat com caminho correto e GUI

### FINALIZACAO:
11. [ ] Testar com TODOS os nucleos (batch)
12. [ ] Criar GitHub repo NeryFelipe2/NOVA-NS-Versao-5

---

## 12. LOGICA CORRETA DE LEITURA DXF (pseudocodigo)

```python
def ler_dxf(path):
    # 1. Tentar PS_PONTOS_IDENTIFICACAO_TXT (fonte primaria, coords UTM)
    pvs_texto = _agrupar_textos_pvs(textos["PS_PONTOS_IDENTIFICACAO_TXT"])

    if len(pvs_texto) >= 5 and todos_com_ct_cf(pvs_texto):
        # USAR TEXTOS como fonte primaria
        pvs = pvs_texto

        # Tubos do layer TUBO_PVC (coords UTM, match com PVs UTM)
        tubos = ezdxf_polilinhas(layer="TUBO_PVC")

        # Ruas de ZZ-Carimbo Texto, TXT-LOGRAD, LT-TEXTO-RUA, A_Alerta
        ruas = coletar_ruas_ezdxf()

    else:
        # FALLBACK: XDATA raw (coords locais)
        pvs_xd, tubos_xd = _ler_xdata_raw(path)
        pvs = pvs_xd
        tubos = tubos_xd  # inclui ruas coletadas no parser raw

    # Conectar tubos a PVs por proximidade
    trechos = snap_tubos_pvs(pvs, tubos)

    return pvs, trechos, ruas
```

---

## 13. PARAMETROS PROSANEAMENTO (para usar no script)

```python
# De LST_VALA.DEF
LARGURA_VALA = 0.60    # metros
LASTRO = 0.15          # metros
BDI = 1.25             # fator

# De DECL_ALT.MIN
DECL_MINIMA = 0.002    # m/m
PROF_MINIMA = 0.30     # metros

# De PAR_ADD0.DAT (esgoto)
MANNING_ESGOTO = 0.013
# De PAR_ADD2.DAT (agua)
MANNING_AGUA = 0.003

# De GER_PERF.DEF
PERFIL_ESC_H = 200
PERFIL_ESC_V = 200
PERFIL_EXAG = 0.5

# De INS_CNX.DEF
PV_PROF_DEFAULT = 0.50  # metros

# De INDCTUB.DAT (ordem dos textos no PV)
# Posicao 1: C.T.
# Posicao 2: Prof (P.F.)
# Posicao 3: C.F.
```

---

## 14. COMO CONTINUAR

### No VSCode terminal:
```bash
claude --continue
```
Isso retoma esta conversa com todo o contexto.

### Ou em nova conversa:
Cole este arquivo no inicio e diga:
"Continue aplicando as melhorias do TODO (secao 11). O arquivo principal e
C:\Users\felip\Downloads\NOVA NS Versao 5\construdata_sabesp_v5_FINAL.py"

---

*ConstruData SABESP v5.0 - Felipe Nery - DGS Engenharia - 2026-03-20*
