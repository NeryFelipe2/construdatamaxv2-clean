# Guia - Ciclo Operacional 360

## Fluxo oficial

```text
1. Engenheiro envia planejamento semanal por texto.
2. Sistema cria PlanejamentoSemanal em RASCUNHO.
3. Diretor valida o plano.
4. Plano aprovado vira ATIVO e substitui outros planos ativos concorrentes.
5. Engenheiro envia RDO diario.
6. Sistema compara RDO x plano ATIVO da data.
7. Sistema cria desvios automaticos com PPC, SPI, CPI e severidade.
8. ML/fallback analisa desvios.
9. Se necessario, gera replanejamento em RASCUNHO.
10. Diretor aplica o replanejamento.
11. Sistema cria novo plano ATIVO e marca o anterior como SUBSTITUIDO.
```

## Tela

```text
http://127.0.0.1:8787/ciclo-operacional
```

## Modelo para planejamento semanal

```text
Data: 27/04/2026
Engenheiro: Nome do engenheiro
Obra: Morro do Teteu

Planejamento semanal:
- 120 m assentamento rede DN150
- 8 un PV executado
- 40 m recomposicao de pavimento

Mao de obra:
Encarregado: 1
Oficial: 3
Ajudante: 5

Custos:
Direto: R$ 12000
Indireto: R$ 2500
```

## Modelo para RDO diario

```text
Data: 28/04/2026
Responsavel: Nome do engenheiro
Obra: Morro do Teteu
Clima: Bom

Producao:
- 70 m assentamento rede DN150
- 3 un PV executado

Mao de obra:
Encarregado: 1
Oficial: 2
Ajudante: 4

Custos:
Direto: R$ 7800
Indireto: R$ 1500

Desvios:
- assentamento rede meta 120 realizado 70
```

## Endpoints principais

```text
GET  /api/projetos/{project_id}/ciclo-operacional
POST /api/projetos/{project_id}/planejamentos-semanais/preencher-texto
POST /api/projetos/{project_id}/planejamentos-semanais/{plan_id}/validar
POST /api/projetos/{project_id}/preencher-texto
POST /api/projetos/{project_id}/ml/recalcular-desvios
POST /api/projetos/{project_id}/replanejamentos/{replanejamento_id}/aplicar
```
