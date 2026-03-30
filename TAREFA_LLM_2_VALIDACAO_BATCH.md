# TAREFA LLM-2: VALIDAÇÃO BATCH + COMPARATIVO AUTOMÁTICO

## CONTEXTO
Arquivo: `C:\Users\felip\Downloads\NOVA NS Versao 5\construdata_sabesp_v5_FINAL.py`
Projeto: ConstruData SABESP v5.0 — extrai PVs e trechos de DXF do ProSaneamento

## PROBLEMA
Não temos forma automática de comparar nossos resultados com o ProSaneamento.
Cada vez que mudamos algo, precisamos rodar manualmente e comparar.

## O QUE FAZER

### 2.1 — Criar função `validar_contra_prosane()`
Que lê o CSV de saída do ProSaneamento e compara com nosso resultado:

```python
def validar_contra_prosane(pvs, trechos, csv_prosane_path):
    """
    Compara extração ConstruData com CSV do ProSaneamento.
    Retorna dict com métricas de concordância.
    """
```

O CSV do ProSaneamento tem 2 formatos:
1. **Formato saída** (São Manoel, Criadores, Pantanal, Israel): `id,rua,pv_ini,pv_fim,ext_m,dn_mm,material,ct_ini,ct_fim,cf_ini,cf_fim,...`
2. **Formato dimensionamento** (Tetéu): separador `;`, nós como `"P,V, 36";"P,V, 39"`, colunas com fórmulas Excel

A função deve:
- Detectar formato automaticamente
- Extrair: PVs únicos, PIs únicos, trechos, e para cada trecho: pv_ini, pv_fim, ext_m, dn_mm, ct/cf
- Comparar PV por PV: CT, CF, prof (tolerância 0.01m)
- Comparar trecho por trecho: ext_m (tolerância 1m), dn_mm (exato)
- Retornar % de match para PVs, trechos, CT/CF

### 2.2 — Criar função `processar_batch_com_validacao()`
Que roda todos os núcleos E compara com ProSane automaticamente:

CSVs de referência ProSaneamento:
```
São Manoel:     C:\...\SÃO MANOEL\sao manoel esgoto\SÃO_MANOEL_ESGOTO.csv
Vila Criadores: C:\...\VILA DOS CRIADORES\ESGOTO V4\CRIADORES_ESGOTO2.csv
Pantanal Baixo: C:\...\PANTANAL BAIXO\saida pantanal esgoto\PANTANAL_ESGOTO.csv
Morro do Tetéu: C:\Users\felip\Downloads\NOVA NS Versao 5\TETÉU_ESGOTO - Dimensiona(Esgoto).csv
Vila Israel:    C:\...\VILA ISRAEL\ESGOTO ISRAEL ENTREGA REV0\Esgoto Vila Israel\ISRAEL_ESGOTO.csv
João Carlos:    C:\...\JOÃO CARLOS\SAIDA_PROSANE\JOÃO_CARLOS_ÁGUA.csv
```
(... = `C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF`)

### 2.3 — Gerar relatório `COMPARATIVO_PROSANE_CONSTRUDATA.xlsx`
Com openpyxl, criar planilha com:
- Aba "Resumo": tabela por núcleo (PVs match%, trechos match%, CT/CF RMSE)
- Aba "PVs": cada PV com CT/CF do ProSane vs ConstruData
- Aba "Trechos": cada trecho com ext/dn do ProSane vs ConstruData
- Formatação condicional: verde (match), amarelo (parcial), vermelho (faltante)

### 2.4 — Adicionar ao CLI
```
python construdata_sabesp_v5_FINAL.py --validar-prosane
```
Que roda batch + validação e gera o Excel.

## ONDE INSERIR NO CÓDIGO
- Após o MÓDULO 16 (BATCH, linha ~3530)
- Novo MÓDULO 17 — VALIDAÇÃO PROSANEAMENTO
- Adicionar opção `--validar-prosane` no `main()` (linha ~3558)

## CRITÉRIO DE SUCESSO
- Rodar `--validar-prosane` gera Excel com comparativo completo
- Detecta automaticamente os 2 formatos de CSV
- Mostra % de concordância claro para cada núcleo

## NÃO FAZER
- Não mexer na lógica de extração (PVs, tubos, snap)
- Não alterar funções existentes
- Não mexer na OSE, custos, HTML, IFC
