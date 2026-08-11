# Evolucao 360 - Implementacao 2026-05-01

## O que foi implementado

- Motor `campo/evolucao_platform.py` para consolidar a evolucao da plataforma em leitura operacional tipo Palantir.
- Rotas `api/routes_evolucao.py`:
  - `GET /api/evolucao`
  - `GET /api/evolucao/predicao`
  - `GET /api/evolucao/ontologia`
  - `POST /api/evolucao/{nucleo}/executar-ciclo`
- Integracao nativa no GUI existente `ui_construdata_modules.py`, dentro da sidebar ConstruData.
- Inclusao do router API em `api/server.py`.

## O que o modulo entrega

- Score geral da maturidade operacional.
- Status por modulo da tabela `Ecolucao.md`.
- Decisao recomendada.
- Predicao deterministica de risco.
- Ontologia operacional com relacoes:
  - planejamento -> RDO
  - RDO -> desvio
  - desvio -> ML
  - ML -> replanejamento
  - RDO -> medicao/qualidade/auditoria
- Botao no GUI existente para executar ciclo ML/fallback por nucleo.

## Validacao feita

- `python -m py_compile` passou para:
  - `campo/evolucao_platform.py`
  - `api/routes_evolucao.py`
  - `api/server.py`
- TestClient validou:
  - `/api/evolucao`
  - `/api/evolucao/predicao`
  - `/api/evolucao/ontologia`
  - `/api/evolucao/NUCLEO_INEXISTENTE_TESTE/executar-ciclo`

## Rollback

Para voltar essa mudanca:

1. Remover:
   - `campo/evolucao_platform.py`
   - `api/routes_evolucao.py`
2. Reverter a inclusao do modulo `Evolucao 360` em `ui_construdata_modules.py`.
3. Reverter a inclusao do router API em `api/server.py`.

Nao houve migracao de banco nem alteracao destrutiva de schema.

## Correcao aplicada

A primeira versao criou uma tela HTML separada. Isso foi removido. O modulo agora aparece dentro do GUI existente, no shell ConstruData, como item `Evolucao 360` na sidebar e como aba nativa quando os modulos individuais sao montados.
