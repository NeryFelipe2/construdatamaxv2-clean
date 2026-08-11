# NS V5 Web Migration - 2026-05-01

## O que foi feito
- Criada a camada `ns-v5` para o ConstruDataWeb.
- Os 14 modulos do NOVA NS V5 agora possuem manifesto web e contratos de dados.
- Criado snapshot unico por projeto/nucleo para RDO, NS, planejamento, desvios, replanejamento, custos, logs, ML e BI.
- Criada tela web `/ns-v5` consumindo API, sem chamar scripts soltos do Tkinter.
- Cada modulo tambem pode abrir como pagina direta: `/ns-v5/{module_key}`.

## Arquivos principais
- `campo/ns_v5_web.py`
- `api/routes_ns_v5.py`
- `html/construdata_ns_v5.html`
- `api/server.py`

## Endpoints novos
- `GET /api/ns-v5/modules`
- `GET /api/ns-v5/contracts`
- `GET /api/ns-v5/projects`
- `GET /api/ns-v5/projects/{project_id}/snapshot`
- `GET /api/ns-v5/projects/{project_id}/modules/{module_key}`
- `POST /api/ns-v5/projects/{project_id}/rdo/preencher-texto`
- `POST /api/ns-v5/projects/{project_id}/ml/recalcular`

## Rotas web novas
- `/ns-v5`
- `/ns-v5/{module_key}`

## Como voltar
Remover os arquivos `campo/ns_v5_web.py`, `api/routes_ns_v5.py`, `html/construdata_ns_v5.html` e desfazer as linhas adicionadas em `api/server.py`.
