# Rollback - Relatorio Civil 3D automatico

Data: 2026-05-20

## Mudanca feita
- Adicionado `relatorio_civil3d_automatico.py`.
- O modulo gera relatorio XLSX/JSON de materiais e quantitativos a partir de LandXML, DXF ou DWG do Civil 3D.
- Nao altera a GUI nem os motores existentes.

## Como voltar
1. Apagar `relatorio_civil3d_automatico.py`.
2. Apagar este arquivo de rollback se nao for mais necessario.
3. Apagar relatorios gerados em `RELATORIOS_CIVIL3D`, caso tenham sido criados apenas para teste.

## Arquivos existentes preservados
- `ler_landxml.py`
- `ler_dxf_gdal.py`
- `ler_dwg_universal.py`
- `gerar_ns.py`
