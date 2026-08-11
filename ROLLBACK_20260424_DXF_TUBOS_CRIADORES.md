# Rollback - Leitor DXF Criadores

Data: 2026-04-24

Mudanca grande:
- `ler_dxf_gdal.py` agora aceita ambiente sem GeoPandas usando parser DXF puro.
- O parser puro filtra somente layers reais de rede e normaliza tubo desenhado como retangulo estreito para eixo central.
- Objetivo: evitar tubos inventados por perfil/topografia e manter os tubos reais do `TUBO_PVC`.

Como voltar:
1. Restaurar `ler_dxf_gdal.py` para a versao anterior pelo controle de versao.
2. Remover este arquivo de rollback se a reversao for definitiva.

Validacao feita:
- `ACAD-CRIADORES_ESGOTO_REV.0particular.dxf`
- Resultado: 32 trechos, 34 PVs, 670.08 m, motor `DXF puro v5.2`.
