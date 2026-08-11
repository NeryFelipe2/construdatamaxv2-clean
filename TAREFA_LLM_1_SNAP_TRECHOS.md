# TAREFA LLM-1: RESOLVER SNAP DE TRECHOS (Problema Principal)

## CONTEXTO
Arquivo: `C:\Users\felip\Downloads\NOVA NS Versao 5\construdata_sabesp_v5_FINAL.py`
Projeto: ConstruData SABESP v5.0 — extrai PVs e trechos de DXF do ProSaneamento

## PROBLEMA
O snap de tubos → PVs está perdendo a MAIORIA dos trechos. Comparativo atual:

| Núcleo          | ProSane Trechos | Nossos Trechos | % capturado |
|-----------------|-----------------|----------------|-------------|
| São Manoel      | 45              | 57             | 127%        |
| Vila Criadores  | 166             | 14             | **8%**      |
| Pantanal Baixo  | 313             | 110            | **35%**     |
| Morro do Tetéu  | 513             | 259            | **50%**     |
| Vila Israel     | 158             | 96             | **61%**     |

## CAUSA RAIZ
1. `tol_pv_tubo = 25m` (já aumentamos para 50m, verificar se melhorou)
2. A deduplificação (linhas ~750-756) descarta trechos com mesmo par PV_ini/PV_fim
   — MAS vários tubos reais podem ligar os mesmos PVs (subtrechos PI→PI)
3. O ProSane conecta PI→PI como trechos individuais. Nós agrupamos PI→PV, perdendo granularidade
4. Tubos curtos (< 3m) são legítimos entre PIs próximos mas podem ser filtrados

## O QUE FAZER
1. Ler o bloco `ler_dxf()` (linhas 488-771) — entender fluxo completo
2. Ler `_pv_mais_proximo()` (linha ~191) — entender lógica de snap
3. Analisar: por que 90% dos tubos do Vila Criadores não fazem match?
   - Rodar diagnóstico: para cada tubo sem match, imprimir distância ao PV mais próximo
4. Implementar solução:
   - Se dist > 50m, o tubo pode estar em outra escala/origin
   - Considerar snap progressivo: 25m → 50m → 100m
   - OU: criar PVs sintéticos nos endpoints de tubos órfãos
5. A deduplificação NÃO deve descartar trechos PI→PI diferentes que passam pelo mesmo PV

## DXFs PARA TESTE
```
Vila Criadores (pior caso, 8%):
  C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\VILA DOS CRIADORES\CRIADORES_ESGOTO.dxf

Morro do Tetéu (referência, 50%):
  C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\MORRO DO TETÉU\TETÉU_ESGOTO.dxf
```

## CRITÉRIO DE SUCESSO
- Vila Criadores: de 14 → pelo menos 100 trechos (60%+)
- Tetéu: de 259 → pelo menos 400 trechos (78%+)
- Zero trechos "inventados" (sem PV real em ambas as pontas)

## NÃO FAZER
- Não mexer na OSE, custos, HTML, IFC, ou GUI
- Não mudar a lógica de extração de PVs (está correta)
- Não alterar parâmetros de Manning/vala/BDI
