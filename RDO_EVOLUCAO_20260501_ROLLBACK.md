# RDO Evolucao 2026-05-01

## O que foi alterado

- Backend RDO agora suporta rastreabilidade multiempresa:
  - `organization_id`, `project_id`, `ordem_servico`, `local`, `empreiteira`, `encarregado`, `origem`, `status_revisao`, `assinatura_presente`, `deleted_at`.
- Novas tabelas:
  - `rdo_evidencia`
  - `rdo_extracao`
  - `rdo_medicao_fonte`
  - `rdo_qualidade_sinal`
- Novo pipeline:
  - `campo/rdo_automatico.py`
  - `campo/rdo_integracoes.py`
- APIs novas:
  - `POST /api/rdo/automatico/upload` usando JSON com `content_base64`, sem depender de `python-multipart`
  - `GET /api/rdo/{rdo_id}/evidencias`
  - `PATCH /api/rdo/{rdo_id}/revisar`
  - `POST /api/rdo/{rdo_id}/finalizar`
  - `POST /api/rdo/{rdo_id}/rejeitar`
  - `GET /api/rdo/{rdo_id}/medicao-fontes`
  - `GET /api/relatorio360/rdo/{rdo_id}`
  - `DELETE /api/rdo/{rdo_id}` com soft delete
- Tela `html/construdata_rdo.html` recebeu aba `RDO Automatico`.

## Como usar o RDO Automatico

1. Abrir `/rdo`.
2. Ir na aba `RDO Automatico`.
3. Colar a mensagem inteira do engenheiro e/ou anexar foto/PDF.
4. Clicar `Extrair e criar RDO`.
5. Revisar o JSON extraido.
6. Clicar `Salvar revisao`.
7. Clicar `Finalizar`.

Ao finalizar, o sistema gera fontes de medicao, sinais de qualidade e resumo para Relatorio 360.

## Rollback seguro

Para voltar esta mudanca, remover/reverter estes arquivos:

- `campo/rdo_automatico.py`
- `campo/rdo_integracoes.py`

E reverter alteracoes em:

- `core/models.py`
- `core/database.py`
- `campo/rdo_engine.py`
- `api/routes_rdo.py`
- `html/construdata_rdo.html`

As colunas/tabelas novas no SQLite sao aditivas. Elas nao apagam dados antigos. Caso precise esconder RDO criado por teste, usar `DELETE /api/rdo/{rdo_id}`, que preenche `deleted_at` sem apagar fisicamente.

## Validacao feita

- `python -m py_compile` passou para modelos, banco, engine, rotas e server.
- TestClient validou:
  - criacao de RDO digital;
  - listagem de RDO;
  - upload automatico por JSON/base64;
  - evidencia preservada;
  - revisao humana;
  - finalizacao;
  - geracao de fonte de medicao;
  - endpoint `Relatorio 360`.
