# TAREFA LLM-3: REDE_GERAL.html + DASHBOARD DE QUALIDADE

## CONTEXTO
Arquivo: `C:\Users\felip\Downloads\NOVA NS Versao 5\construdata_sabesp_v5_FINAL.py`
Projeto: ConstruData SABESP v5.0 — extrai PVs e trechos de DXF do ProSaneamento

## PROBLEMA
1. O `gerar_rede_html()` (linha ~2522) gera mapa Leaflet mas NÃO mostra diagnóstico de qualidade
2. Não temos visão consolidada de TODOS os núcleos num só mapa
3. Falta dashboard mostrando: trechos OK vs problemáticos, hidráulica, cobertura

## O QUE FAZER

### 3.1 — Melhorar `gerar_rede_html()` (linha ~2522)
O mapa Leaflet atual mostra PVs e trechos. Adicionar:
- **Cores por status hidráulico**: verde=OK, amarelo=VERIFICAR, vermelho=ERRO
- **Popup rico** em cada trecho: pv_ini→pv_fim, DN, ext, decl, vel, tau, rua
- **Popup rico** em cada PV: nome, CT, CF, prof, grau (nº conexões)
- **Legenda** com contadores: X trechos OK, Y com alerta, Z sem dados
- **Layer control**: poder ligar/desligar PVs, trechos, ruas
- **Filtro por DN**: botões para mostrar só DN150, DN200, DN300...

### 3.2 — Criar `gerar_dashboard_qualidade_html()`
Nova função que gera um HTML standalone com:

**Painel 1 — Resumo geral:**
- Total PVs, trechos, extensão total (m), custo total (R$)
- % trechos com V < 0.6 m/s (autolimpeza insuficiente)
- % trechos com tau < 1.0 Pa (tensão trativa insuficiente)
- % PVs com prof < 0.30m (raso demais)

**Painel 2 — Gráficos (Chart.js CDN):**
- Histograma de DNs (quantos trechos por diâmetro)
- Histograma de velocidades
- Scatter: extensão vs declividade
- Barras: custo por rua (top 10)

**Painel 3 — Tabela interativa:**
- Todos os trechos com sorting/filtering
- Destacar em vermelho: decl < 0.2%, V < 0.6, tau < 1.0
- Busca por PV ou rua

### 3.3 — Criar `gerar_mapa_todos_nucleos_html()`
Mapa Leaflet que mostra TODOS os núcleos juntos:
- Cada núcleo com cor diferente
- Layer control por núcleo
- Popup com nome do núcleo + stats
- Usar coords UTM→WGS84 (pyproj EPSG:31983→4326)

Guarda coords de referência por núcleo:
```
São Manoel:     lat≈-23.97, lon≈-46.32
Vila Criadores: lat≈-23.96, lon≈-46.33
Pantanal Baixo: lat≈-23.96, lon≈-46.33
Morro do Tetéu: lat≈-23.95, lon≈-46.32
Vila Israel:    lat≈-23.96, lon≈-46.33
João Carlos:    lat≈-23.97, lon≈-46.32
```

### 3.4 — Integrar no `processar()` e `processar_batch()`
- `gerar_dashboard_qualidade_html()` → chamado no final de `processar()`
- `gerar_mapa_todos_nucleos_html()` → chamado no final de `processar_batch()`

## ONDE INSERIR NO CÓDIGO
- Melhorar `gerar_rede_html()` existente (linha ~2522)
- Novo bloco após gerar_rede_html: `gerar_dashboard_qualidade_html()`
- Novo bloco no batch: `gerar_mapa_todos_nucleos_html()`
- Chamar em `processar()` (linha ~3157) e `processar_batch()` (linha ~3531)

## RESTRIÇÕES TÉCNICAS
- HTML standalone (sem servidor) — usar CDNs: Leaflet, Chart.js
- Máx 500KB por HTML (inline CSS/JS, sem arquivos externos exceto CDN)
- Coords UTM EPSG:31983 → WGS84 via pyproj (já importado no script)
- Guard `_coords_validas`: lat entre -34 e 5, lon entre -74 e -34

## CRITÉRIO DE SUCESSO
- `REDE_GERAL.html` com cores por status + popups ricos + layer control
- `DASHBOARD_QUALIDADE.html` com gráficos Chart.js e tabela interativa
- `MAPA_TODOS_NUCLEOS.html` com 6 núcleos no mesmo mapa
- Todos os HTMLs abrem direto no browser sem servidor

## NÃO FAZER
- Não mexer na lógica de extração (PVs, tubos, snap) — isso é TAREFA LLM-1
- Não mexer na validação ProSane — isso é TAREFA LLM-2
- Não alterar OSE, custos SINAPI, IFC, ou parâmetros CFG
- Não usar frameworks pesados (React, Vue) — HTML puro + CDN
