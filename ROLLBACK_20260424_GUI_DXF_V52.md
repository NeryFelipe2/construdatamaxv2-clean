# Rollback - GUI usando leitor DXF v5.2

Data: 2026-04-24

Mudanca:
- `construdata_gui.py` deixou de enviar DXF ProSaneamento para `ler_dxf_prosaneamento.py`.
- Todo DXF agora passa por `ler_dxf_gdal.py`, que contem o parser v5.2 corrigido.
- `ler_dxf_gdal.py` tambem corrige textos `PS_PONTOS` com coordenadas dobradas quando metade da coordenada bate com a rede real.

Motivo:
- Evitar tubos inventados e PVs/textos deslocados para outro lugar da cidade.

Como voltar:
1. Restaurar `construdata_gui.py` e `ler_dxf_gdal.py` pelo controle de versao.
2. Remover este markdown se a reversao for definitiva.
