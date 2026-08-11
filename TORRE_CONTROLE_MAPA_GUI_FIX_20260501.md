# Torre Controle - correção GUI 2026-05-01

## Motivo
A tela aberta estava exibindo a renderização antiga da Torre Controle em modo kanban, sem mapa operacional.

## Estado correto
- `ui_construdata_modules.py` possui `RAIL_ACTIONS` como botões Tkinter reais.
- A rota `torre` renderiza `Mapa / Torre Controle`.
- O mapa é desenhado em `Canvas` pelo método `_draw_control_map`, com cartografia operacional, marcador da obra, raio de atuação e RDOs recentes.
- A Torre Controle agora ignora os cards superiores do dashboard e usa layout proprio no padrao ConstruData:
  - lista de obras à esquerda;
  - mapa dominante no centro;
  - ficha operacional da obra à direita.
- Quando houver internet/cache, o mapa usa tiles OpenStreetMap; se falhar, cai para cartografia desenhada local.

## Como voltar
Reverter somente as alterações relacionadas a:
- `RAIL_ACTIONS`
- `_project_coord`
- `_draw_control_map`
- `_render_torre`
- `_tile_xy`
- `_fetch_tile_image`
- `_draw_map_overlay`
- `_draw_fallback_map`
- `_project_list_item`

Não mexer nos motores de RDO, NS ou Evolução 360.
