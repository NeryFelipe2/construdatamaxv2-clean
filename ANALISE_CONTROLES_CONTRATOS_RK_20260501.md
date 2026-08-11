# Analise dos controles de contratos RK

## Conclusao executiva

Os arquivos enviados formam uma base aproveitavel para transformar os contratos RK em controle operacional dentro da plataforma. O melhor caminho e usar as planilhas como fonte historica e migrar para tabelas estruturadas: contratos, lancamentos, folha, custos fixos, custos variaveis, recebiveis, pagaveis, fluxo projetado, medicoes, tarefas, equipamentos, RDO e GIS.

## Fontes mais fortes

| Arquivo | O que aproveitar | Uso na plataforma |
|---|---|---|
| `CONTROLE_RK_VERSAO_QWEN.xlsx` | Modelo mais limpo de dashboard, lancamentos, custos fixos/variaveis, recebiveis, pagamentos, fluxo projetado e folha | Melhor referencia de schema para o modulo Controle de Contratos |
| `CONTROLE_CONSOLIDADO_RK.xlsx` e copias `.2xlsx` / `antigravity` | Historico real com 137 linhas de lancamentos, 42/43 linhas de folha, custos, recebiveis e pagaveis | Fonte de carga inicial e validacao do dashboard |
| `CONTROLE_CONSOLIDADO_RK_AUTOMATIZADA.xlsx` | Estrutura simples: lancamentos, folha, recebiveis, pagaveis e dashboard | Bom formato de importacao automatica |
| `202604_Controle_de_Obra_Tatui.xlsx` | Contrato, EAP, custo de MO, material, equipamento, venda orcada, custo orcado, viabilidade e aditivo | Base de orcamento/contrato 5D e comparacao orcado x realizado |
| `PLANILHA DE PAGAMENTO RK.xlsx` | Pagamentos por obra, funcao, Pix, datas e centro de custo | Folha, pagamentos e alocacao de mao de obra por contrato |
| `RELAÇÃO DE FUNCIONARIOS POR OBRA ATUALIZADA.xlsx` | Funcionarios, funcao, CPF, admissao, salario, encargos e experiencia por obra | Cadastro de equipe, custo diario e custo indireto/direto |
| `MEDIÇÃO_ESGOTO (1).xlsx` | Itens medidos, quantidade, valor unitario, subtotal e analise de custos | Medicao rastreavel ligada ao RDO e contrato |
| `TASKS_OSASCO.xlsx` | Tarefas, status, responsavel, equipamentos, equipes e operadores | Punch list, restricoes, mobilizacao e pendencias |
| XLSM de Cachoeiro, Santos e Teofilo | Base de dados financeira, plano de contas e fluxo mensal por obra | Importador padrao por contrato/obra |
| `PARDINHO.zip` | Controle XLSM, RDO CSV/XLSX, shapefiles, KMZ e dados QESG | Contrato + RDO + GIS/cartografia + rede |

## Tabelas recomendadas

| Tabela/modulo | Campos principais | Fonte |
|---|---|---|
| `contratos` | obra, cliente, responsavel, status, cidade, centro de custo | consolidado, QWEN, XLSM por obra |
| `lancamentos_financeiros` | obra, data, categoria, subcategoria, forma, valor, descricao, responsavel | `LANÇAMENTOS`, `Base de Dados` |
| `plano_contas` | grupo, subgrupo, categoria, forma_pagamento | `SUBCATEGORIAS`, `Plano de Contas` |
| `folha_colaboradores` | obra, nome, funcao, CPF, salario, encargos, admissao, departamento | `FOLHA`, pagamento, relacao de funcionarios |
| `custos_fixos` | obra, tipo, descricao, valor mensal, inicio, fim | `CUSTOS FIXOS` |
| `custos_variaveis` | obra, tipo, descricao, percentual/valor, media historica | `CUSTOS VARIÁVEIS` |
| `recebiveis` | obra, cliente, descricao, valor, vencimento, status, probabilidade | `RECEBIVEIS`, `RECEBÍVEIS` |
| `pagaveis` | obra, fornecedor, descricao, valor, vencimento, prioridade, status | `PAGAVEIS`, `PAGAMENTOS` |
| `fluxo_projetado` | obra, mes, receitas, custos, folha, pagaveis, saldo projetado | `FLUXO PROJETADO`, `Fluxo de Caixa` |
| `medicoes` | obra, item, quantidade, unidade, valor unitario, subtotal, descricao | `MEDIÇÃO_ESGOTO` |
| `orcamento_5d` | item contrato, descricao, unidade, quantidade, preco unitario, total | `Contrato`, `Venda orçada`, `Custo orçado` |
| `tarefas_restricoes` | obra, responsavel, tarefa, prioridade, status, concluido, notas | `TASKS_OSASCO` |
| `equipamentos_alocados` | obra, equipamento, operador, status, prazo, observacao | `TASKS_OSASCO`, RDO |
| `gis_redes` | obra, camada, trecho, geometria, origem, arquivo | `PARDINHO.zip` |

## Prioridade de aproveitamento

1. Usar `CONTROLE_RK_VERSAO_QWEN.xlsx` como desenho principal do modulo Controle de Contratos.
2. Carregar o historico real do `CONTROLE_CONSOLIDADO_RK.xlsx` e das copias mais completas.
3. Vincular folha e pagamentos com `PLANILHA DE PAGAMENTO RK.xlsx` e `RELAÇÃO DE FUNCIONARIOS POR OBRA ATUALIZADA.xlsx`.
4. Ligar o orcado de Tatuí ao realizado pelo RDO/medicao usando `202604_Controle_de_Obra_Tatui.xlsx`.
5. Criar importador para XLSM por obra com a aba `Base de Dados` como padrao.
6. Usar `PARDINHO.zip` para validar GIS, RDO importado e cartografia por contrato.

## Resultado esperado no ConstruData

O contrato passa a ter uma tela unica com: orcado x realizado, custo direto/indireto, folha, equipamentos, medicao, recebiveis, pagaveis, fluxo projetado, tarefas, restricoes e alertas. O RDO alimenta producao e custo diario; a medicao confirma o faturamento; o fluxo projetado mostra caixa futuro; e o BI compara contratos.
