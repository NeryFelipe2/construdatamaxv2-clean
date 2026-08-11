# INVENTÁRIO COMPLETO DE ARQUIVOS .PY
## Comparação: NOVA NS Versão 5 vs CONSTRUDATAMAX Backend

---

## ESTATÍSTICAS GERAIS

| Métrica | Valor |
|---------|-------|
| **Total de arquivos .py** | **907** |
| **Arquivos na RAIZ** | **86** |
| **Com equivalente no backend** | **29** (33%) |
| **SEM equivalente no backend** | **57** (67%) |
| **Arquivos em subpastas** | **821** |

---

## ARQUIVOS COM EQUIVALENTE NO BACKEND (29 arquivos)

### Core/Modelos (2)
- models.py → core/models.py
- database.py → core/database.py

### Importadores (4)
- ler_dwg_aec.py, ler_dxf_gdal.py, ler_landxml.py
- construdata_pipeline.py

### Geradores (9)
- gerar_cadastro_nts292.py, gerar_civil3d.py, gerar_cronograma.py
- gerar_cronograma_macro.py, gerar_ifc_lod500.py
- gerar_medicao_curva_s.py, gerar_ns.py
- gerar_pdf_perdas.py, gerar_project_xml.py

### Motors (14)
- construdata_analytics.py, motor_contratos.py, motor_custo.py
- motor_gemini.py, motor_lean_lps.py, motor_llm.py
- motor_medicao.py, motor_microplanejamento.py
- motor_ml.py, motor_parametrico.py, motor_perdas.py
- motor_status_ns.py, slnr_mestre_ml.py, whatsapp_receiver.py

---

## ARQUIVOS SEM EQUIVALENTE (57 arquivos únicos)

### Pipelines Completos (5)
CONSTRUDATA_SABESP_v5.py, construdata_sabesp_v5_FINAL.py
construdata_integrador.py, construdata_planner.py, construdata_gui.py

### Leitura/Importação Específica (6)
LER_DWG_BIM.py, LER_DWG_DIRETO.py, ler_dwg_universal.py
analisar_dwg.py, TESTE_DWG_COMPLETO.py, monitor_leitura_dxf.py

### NS Específico (5)
gerar_ns_sao_manuel_joao_carlos.py, gerar_ns_todos_nucleos.py
gerar_ns_v4.py, gerar_cronograma_ns.py, gerar_compras.py

### Trechos/Redes (6)
gerar_trechos_completo.py, gerar_trechos_inferidos.py
gerar_trechos_mega.py, gerar_trechos_recortados.py
integrador_nova_ns.py, corrigir_rede_esgoto.py

### Relatórios (6)
consolidar_ns.py, gerar_apresentacao.py
gerar_guia_ml.py, gerar_guia_ml_p2.py
gerar_estatistica_ml.py, ANALYTICS_COMPLETO.py

### Automação (3)
automacao_civil3d.py, motor_teteu_esgoto.py, gerar_ose.py

### Processamento em Lote (5)
processar_lote_dxf_ns.py, processar_prolongamentos.py
processar_sao_manoel.py, processar_sao_manoel_1.py
gerar_tudo_nucleos.py

### ML/Classificação (1)
ml_classificador.py

### Testes/Debug (20)
test_crs_verificacao.py, test_ler_dxf_gdal.py, test_novas_classes.py
test_snap_diagnostico.py, testar_crs_lote.py, testar_dwg_sao_manoel.py
testar_landxml.py, testar_lote_dxf.py, testar_sao_manoel_1.py
debug_extracao.py, debug_tubos.py, diagnostico_dxf_completo.py
diagnostico_teteu.py, investigar_tubos_sem_pv.py
verificar_dwg.py, verificar_redes.py, verificar_tipo_rede.py
verificar_tubos.py, gerar_xlsx.py, gerar_exemplo_ns.py

---

## CONCLUSÕES

### Taxa de Cobertura
- **33%** dos arquivos da raiz já estão no backend CONSTRUDATAMAX
- **67%** são únicos/específicos da V5

### Categorização
- **33%** - Código core com equivalente direto (consolidação)
- **23%** - Testes e debug (podem ser refatorados)
- **21%** - Scripts específicos de núcleo/localidade
- **23%** - Protótipos, variações e análises

### Recomendações
1. Consolidar os 29 arquivos com equivalente
2. Refatorar testes sob /tests com pytest
3. Manter scripts específicos localizados
4. Documentar razão dos arquivos únicos
