# Status Integracao Total ConstruData - 2026-04-23

## 1. Objetivo desta fase

Este documento consolida o estado real da integracao total da plataforma ConstruData no fim desta rodada de implementacao.

O objetivo da fase 1 continua sendo:

- transformar a plataforma em uma suite unica, role-based, orientada a operacao;
- remover a divergencia entre WhatsApp, n8n, backend, Supabase e frontend;
- fazer os modulos prioritarios operarem sobre o mesmo backbone de dados;
- manter demo e fallback apenas como contingencia explicita de desenvolvimento;
- preparar o caminho para cloud estavel sem depender do notebook local.

Arquitetura alvo:

`WhatsApp -> Evolution -> n8n/CODEX 2.0 -> Supabase -> Render API -> Vercel Frontend`

Fonte de verdade:

- Supabase = verdade operacional
- Render API = fachada publica
- Frontend = consumidor da API
- n8n = orquestracao e automacao

---

## 2. Estado executivo atual

### 2.1 O que ja esta funcional nesta rodada

Esta rodada fechou uma fatia concreta do plano mestre:

- `projectContext` agora e API-first.
- `Projetos`, `Gestao 360` e `Torre de Controle` passaram a refletir projeto canonico por `activeProjectId`.
- `Contatos` saiu do default demo e entrou no contrato canonico por projeto.
- `LPS / Restricoes` passou a carregar restricoes reais do endpoint canonico.
- `DRE / Financeiro` passou a tentar a fachada canonica antes de cair para Supabase direto.
- `RDO web` deixou de ser somente local e agora persiste no endpoint canonico `POST /api/projetos/{id}/rdos` quando ha `activeProjectId`.
- `WhatsApp RDO` passou a cadastrar contatos no projeto ativo via contrato canonico, em vez de depender apenas do endpoint legado de numeros.
- `WhatsApp Fluxo` deixou de nascer com historico/agendamentos fake como se fossem dados reais.
- o backend ganhou endpoints canonicos faltantes para contatos, financeiro e restricoes.

### 2.2 O que foi validado de verdade

Validacao concluida:

- `npm run build` em `frontend`: **ok**
- `npm run build` em `frontend` apos a fatia `RDO + WhatsApp RDO`: **ok**
- `python -m py_compile api/routes_integracao_total.py`: **ok**
- router isolado de integracao total testado com `FastAPI TestClient`:
  - `GET /api/health/integrations` -> `200`
  - `GET /api/projetos` -> `200`
  - rotas registradas:
    - `POST /api/projetos/{project_id}/contatos`
    - `PATCH /api/projetos/{project_id}/contatos/{contato_id}`
    - `DELETE /api/projetos/{project_id}/contatos/{contato_id}`
    - `GET /api/projetos/{project_id}/financeiro`
    - `PATCH /api/projetos/{project_id}/lps-restricoes/{restricao_id}`
    - `DELETE /api/projetos/{project_id}/lps-restricoes/{restricao_id}`
    - `GET /api/projetos/{project_id}/rdos/{rdo_id}`
    - `GET /api/projetos/{project_id}/whatsapp/logs`
    - `GET /api/projetos/{project_id}/whatsapp/agendamentos`
    - `POST /api/projetos/{project_id}/whatsapp/agendamentos`
    - `PATCH /api/projetos/{project_id}/whatsapp/agendamentos/{agendamento_id}`
    - `DELETE /api/projetos/{project_id}/whatsapp/agendamentos/{agendamento_id}`
- smoke test do router com Supabase fake em memoria:
  - criacao de RDO com `clima = good` normalizado para `bom`
  - persistencia detalhada validada em:
    - `rdo_equipes`
    - `rdo_atividades`
    - `rdo_materiais`
    - `rdo_equipamentos`
    - `rdo_mao_obra`
    - `rdo_ocorrencias`
  - detalhe do RDO via `GET /api/projetos/{project_id}/rdos/{rdo_id}` validado
  - criacao, pausa e cancelamento de agendamento de WhatsApp validados
  - leitura de `whatsapp_logs` validada

### 2.3 Testes reais no backend publico / Render

Testes executados contra:

- `https://construdatamaxv2-clean.onrender.com`

Resultados confirmados:

- `GET /api/health/integrations` -> `ok = true`
- `status = connected`
- todas as tabelas canonicas principais retornaram `ok = true`
- `whatsapp = configured`

Teste real de criacao de RDO no projeto Brasilia:

- projeto: `2a28beec-b1f8-4b0c-8416-d0710bb35d9d`
- RDO criado com sucesso no Render:
  - id: `68fd7d62-fb40-4901-99e2-b93d48c13629`
  - observacoes: `TESTE_RENDER_20260423-222559`
- leitura posterior em `GET /api/projetos/{id}/rdos`: **confirmada**
- dashboard posterior em `GET /api/projetos/{id}/dashboard`: **confirmado**
  - `rdos_total = 2`
  - `custo_total_dia = 2100`

Observacao importante:

- o Render publico atual ainda nao tem as novas rotas de fluxo WhatsApp desta rodada;
- testes em:
  - `GET /api/projetos/{id}/whatsapp/logs`
  - `GET /api/projetos/{id}/whatsapp/agendamentos`
- retornaram `404`, o que confirma que essas rotas estao implementadas localmente, mas ainda nao foram publicadas na instancia Render atual.

### 2.4 O que nao foi fechado ainda

Ainda nao esta concluido:

- fase 1 inteira;
- validacao end-to-end no backend completo local;
- trilha cloud estavel completa do WhatsApp;
- unificacao dos modulos fora do nucleo operacional imediato.
- publicacao das novas rotas canonicas de fluxo WhatsApp no Render;
- validacao em producao da persistencia detalhada do RDO nas tabelas filhas (`rdo_equipes`, `rdo_atividades`, `rdo_materiais`, etc.), agora implementada no backend local, mas ainda nao validada em Render;
- validacao em producao do painel `WhatsApp Fluxo` lendo `workflow_events` e `whatsapp_logs` reais apos deploy do backend;
- fechamento da trilha conversational completa do WhatsApp (`Evolution -> n8n -> backend publico`) em ambiente cloud estavel.

Importante:

- a app FastAPI completa local nao sobe limpa para teste geral porque o ambiente local ainda esta sem `sqlalchemy`;
- isso significa que a fachada canonicamente alterada foi validada isoladamente, mas nao o backend inteiro com todas as dependencias do projeto.

---

## 3. Arquitetura e principios em vigor

### 3.1 Fonte de verdade

Hierarquia efetiva desta fase:

1. Supabase
2. Render API
3. n8n / CODEX 2.0
4. Vercel frontend
5. stores locais apenas como cache de UI
6. demo/local somente com flag explicita

### 3.2 Regra de projeto

Todo modulo operacional deve resolver contexto por:

- `activeProjectId` no frontend
- `project_id` / `projeto_id` no backend
- `projeto_id` nas tabelas canonicas

Tratamento de aliases:

- centralizado no backend
- nao espalhado nos modulos

### 3.3 Projetos canonicos

IDs oficiais mantidos:

- Tatui - RK: `c2bf8fda-b2e0-4bc1-9535-4891d596ea10`
- Osasco: `f3c6645b-347f-4382-b9c5-d103c27ec511`
- Consorcio / SLNR: `abe7f66c-004b-4bb5-a245-6be67debd9f7`
- Pardinho: `ec112c9a-1669-4287-8079-526d6940ce82`
- Brasilia: `2a28beec-b1f8-4b0c-8416-d0710bb35d9d`
- RK Sub / RK Santos Empreita: `d4e5f6a7-b8c9-4d0e-a1f2-b3c4d5e6f7a8`

---

## 4. Backend canonicamente ampliado

Arquivo principal desta rodada:

- `api/routes_integracao_total.py`

### 4.1 Endpoints ja existentes e mantidos

- `GET /api/health/integrations`
- `GET /api/projetos`
- `POST /api/projetos`
- `GET /api/projetos/{id}/dashboard`
- `GET /api/projetos/{id}/rdos`
- `POST /api/projetos/{id}/rdos`
- `GET /api/projetos/{id}/tarefas`
- `POST /api/projetos/{id}/tarefas`
- `GET /api/projetos/{id}/contatos`
- `GET /api/projetos/{id}/torre`
- `GET /api/projetos/{id}/gestao360`
- `GET /api/projetos/{id}/lps-restricoes`
- `POST /api/projetos/{id}/lps-restricoes`

### 4.2 Endpoints novos desta rodada

Foram adicionados:

- `POST /api/projetos/{project_id}/contatos`
- `PATCH /api/projetos/{project_id}/contatos/{contato_id}`
- `DELETE /api/projetos/{project_id}/contatos/{contato_id}`
- `GET /api/projetos/{project_id}/financeiro`
- `PATCH /api/projetos/{project_id}/lps-restricoes/{restricao_id}`
- `DELETE /api/projetos/{project_id}/lps-restricoes/{restricao_id}`

### 4.3 Mudancas internas importantes

Mudancas relevantes em `routes_integracao_total.py`:

- consolidacao de projeto canonicamente mantida;
- deduplicacao continua centralizada;
- `dashboard_projeto()` agora inclui contatos deduplicados;
- `gestao360_projeto()` agora inclui:
  - `custos.lancamentos`
  - `custos.despesas_total`
  - `custos.receitas_total`
  - `integracoes.financeiro`
- `_select()` foi ajustado para tratar corretamente:
  - `lancamentos_financeiros` por `project_id`
  - `trechos_custo` por `project_id`

### 4.4 Risco evitado

Sem esse ajuste, o financeiro canonico tenderia a retornar vazio mesmo com dado real, porque essas tabelas nao seguem a mesma chave `projeto_id` da maior parte das tabelas operacionais.

---

## 5. Frontend: mudanças estruturais concluídas

## 5.1 Mapeamento canonico de projeto

Novo arquivo:

- `frontend/src/lib/canonicalProject.ts`

Responsabilidade:

- mapear `DbProjeto` e payloads canonicos para tipos de UI:
  - `Project`
  - `ConstructionSite`
  - `ConstructionRisk`

Exporta:

- `mapDbProjetoToProject(...)`
- `mapDbProjetoToConstructionSite(...)`
- `mapRowsToConstructionRisks(...)`

Impacto:

- reduz a duplicacao de transformacoes espalhadas;
- padroniza como os modulos de `Projetos` e `Torre` leem projeto.

## 5.2 API client tipado e ampliado

Arquivo:

- `frontend/src/lib/api.ts`

Entrou nesta rodada:

- tipos canônicos:
  - `CanonicalIntegrationStatus`
  - `ApiProjetoRecord`
  - `ApiProjetoDashboardPayload`
  - `ApiProjetoTorrePayload`
  - `ApiProjetoGestao360Payload`
  - `ApiProjetoFinanceiroPayload`

Novas funcoes:

- `apiCriarProjeto`
- `apiProjetoCriarContato`
- `apiProjetoAtualizarContato`
- `apiProjetoRemoverContato`
- `apiProjetoFinanceiro`
- `apiProjetoCriarLpsRestricao`
- `apiProjetoAtualizarLpsRestricao`
- `apiProjetoRemoverLpsRestricao`
- `apiProjetoLpsRestricoes`

Impacto:

- o frontend passou a falar com a fachada publica por dominio;
- deixou de depender de adivinhacao de tabela em varios pontos.

---

## 6. Project Context: mudança central

Arquivo:

- `frontend/src/store/projectContext.ts`

### 6.1 O que mudou

Antes:

- nascia com `DEMO_PROJETOS`
- nascia com `DEMO_FRENTES`
- podia exibir projeto e frente sem dados reais

Agora:

- estado inicial vazio
- `activeProjectId` vem do storage
- `fetchProjetos()` faz:
  1. API canônica
  2. Supabase
  3. demo apenas se `VITE_ENABLE_DEMO_DATA === 'true'` em `DEV`

- `fetchFrentes()` faz:
  1. `apiProjetoDashboard(projectId)` para aproveitar frentes canônicas
  2. Supabase
  3. demo explicito somente se permitido

### 6.2 Correção importante

Foi corrigido um comportamento silencioso:

- quando havia `activeProjectId` persistido em localStorage e ele continuava valido, antes podia carregar projeto mas deixar `frentes` vazias;
- agora, mesmo quando o projeto ativo e reaproveitado, o store busca as frentes correspondentes.

### 6.3 Novo estado

`projectContext` agora expõe:

- `integrationStatus`

Valores:

- `connected`
- `partial`
- `local`

---

## 7. Projetos, Gestão 360 e Torre

## 7.1 Projetos

Arquivos:

- `frontend/src/store/projetosStore.ts`
- `frontend/src/features/projetos/index.tsx`

### Mudanças

- `projetosStore` nao nasce mais de mock por default;
- agora carrega a partir do `projectContext`;
- usa `mapDbProjetoToProject(...)`;
- sincroniza selecao de projeto com `projectContext.setActiveProject(id)`;
- preserva arrays de UI local quando existirem:
  - `planningPhases`
  - `executionPhases`
  - `budgetLines`
  - `demands`
  - `documents`

### Sincronizacao

Foi deixado:

- bootstrap automatico por `queueMicrotask(...)`
- subscribe ao `useProjectContext`
- `useEffect` na pagina de Projetos para garantir carga deterministica

## 7.2 Gestão 360

Arquivos:

- `frontend/src/hooks/useSupabaseGestao.ts`
- `frontend/src/features/gestao-360/index.tsx`

### Mudanças

O hook agora:

1. tenta `apiProjetoGestao360(projectId)`
2. se falhar, cai para Supabase direto
3. sintetiza:
  - `kpi`
  - `frentes`
  - `contatos`
  - `rdos`
  - `tarefas`
  - `notificacoes`
  - `projetoNome`
  - `connectionStatus`

Valores de `connectionStatus`:

- `connected`
- `partial`
- `local`

### Página

A página de Gestão 360 foi reescrita para:

- refletir estado canônico;
- parar de dizer apenas “Supabase live/demo”;
- mostrar `Canonico / Parcial / Local`;
- continuar renderizando:
  - KPI
  - equipe
  - frentes
  - notificacoes
  - resumo de execucao
  - RDOs recentes

## 7.3 Torre de Controle

Arquivo:

- `frontend/src/store/torreDeControleStore.ts`

### Mudanças

Agora:

- o store nasce vazio;
- `loadFromProjectContext()` converte projetos canônicos em `ConstructionSite[]`;
- o projeto ativo e enriquecido com:
  - `apiProjetoDashboard(activeProjectId)`
  - `apiProjetoTorre(activeProjectId)`

Impacto:

- Torre deixa de operar em lista paralela desconectada do projeto ativo;
- riscos e restricoes passam a ser derivados do mesmo backbone.

---

## 8. Contatos: unificação parcial concluída

Arquivos:

- `frontend/src/store/contatosStore.ts`
- `frontend/src/features/gestao-contatos/index.tsx`

### 8.1 Situação anterior

Antes:

- `contatosStore` nascia com `DEMO_CONTATOS`
- a tela filtrava o que estivesse no store
- o modulo parecia preenchido mesmo sem integracao real

### 8.2 Situação atual

Agora:

- store nasce vazio, exceto se o demo estiver explicitamente habilitado;
- `fetchContatos(projetoId)` faz:
  1. `apiProjetoContatos`
  2. Supabase
  3. demo explicito, se permitido

- `addContato`, `updateContato`, `removeContato` tentam primeiro a API canônica do projeto;
- o store mantem `integrationStatus`;
- a tela exibe badge:
  - `Conectado`
  - `Parcial`
  - `Local`

### 8.3 Sincronizacao

O store agora se autosincroniza com `activeProjectId` do `projectContext`.

### 8.4 Impacto nos modulos dependentes

Isso afeta diretamente:

- `Gestao de Contatos`
- `RdoCampoForm`
- `WhatsAppFluxoPanel`
- qualquer tela que consuma `useContatosStore(...)`

---

## 9. LPS / Lean: restrições canônicas ligadas ao projeto

Arquivos:

- `frontend/src/store/lpsStore.ts`
- `frontend/src/features/lps-lean/index.tsx`
- `frontend/src/features/lps-lean/components/LpsHeader.tsx`

### 9.1 O que foi decidido

Nesta fase:

- `restrictions` passam a ser dados prioritariamente reais;
- `lookahead`, `semaforo`, `takt`, `staffing` continuam sendo estado de UI/local ou derivado ate o dominio canonico completo ser modelado.

Isso evita paralisar o modulo inteiro enquanto a parte operacional mais importante das restricoes ja entra no eixo.

### 9.2 O que mudou no store

O `lpsStore` foi refeito para:

- expor `currentProjectId`
- expor `connectionStatus`
- expor `integrationStatuses`
- carregar restricoes por:
  - `apiProjetoLpsRestricoes(projectId)`

- manter `activities`, `taktZones` e calculos locais como apoio visual
- suportar:
  - `addRestriction()`
  - `updateRestriction()`
  - `removeRestriction()`
  usando a API canônica quando houver projeto ativo

- recalcular:
  - `staffingDimensions`
  - `integrationStatuses`

### 9.3 Página e header

A pagina LPS agora:

- força `loadFromProject(activeProjectId)` quando a obra muda;
- o header mostra badge:
  - `Conectado`
  - `Parcial`
  - `Local`

### 9.4 Limite conhecido

O modulo LPS ainda nao esta 100% canônico, porque:

- varias abas dependem de atividades locais/mock;
- somente a trilha de restricoes ja esta conectada ao dominio real.

Isso esta dentro do corte de fase 1: restricoes entram antes do restante do Lean detail.

---

## 10. DRE / Financeiro: fachada canônica criada

Arquivos:

- `api/routes_integracao_total.py`
- `frontend/src/lib/useSupabaseDre.ts`
- `frontend/src/features/gestao-360/components/ControleFinanceiroPanel.tsx`
- `frontend/src/features/dre-financeiro/index.tsx`

### 10.1 Situação anterior

Antes:

- o hook `useSupabaseDre` lia diretamente:
  - `lancamentos_financeiros`
  - `trechos_custo`
- sem fachada canônica intermediaria;
- isso deixava o modulo fora do contrato de integracao total.

### 10.2 Situação atual

Agora existe:

- `GET /api/projetos/{id}/financeiro`

O hook `useSupabaseDre(projectId)` agora:

1. tenta `apiProjetoFinanceiro(projectId)`
2. se falhar, cai para Supabase direto
3. expõe:
  - `lancamentos`
  - `trechos`
  - `loading`
  - `connectionStatus`
  - `refresh()`

### 10.3 Gestão 360

`ControleFinanceiroPanel` foi ajustado para:

- parar de usar `demo-1` quando nao existe projeto ativo;
- refletir `connectionStatus` com badge de estado;
- continuar calculando EVM com fallback interno onde ainda nao houver dados suficientes.

### 10.4 DRE Financeiro

O modulo `dre-financeiro` foi parcialmente alinhado:

- passou a usar o novo `connectionStatus` do hook;
- contrato default passou a ser alinhado aos IDs canônicos, e nao mais apenas `demo-1`.

Observacao:

- esse arquivo estava com encoding antigo e exigiu substituicao mecanica controlada em vez de patch fino em todos os trechos.

---

## 11. RDO

Arquivo importante ja ajustado nesta linha de trabalho:

- `frontend/src/store/rdoStore.ts`

### Mudança mantida

O store agora:

- nao mascara ausencia real com mock por default;
- so injeta demo se `VITE_ENABLE_DEMO_DATA === 'true'` em `DEV`;
- se nao houver dado real, pode ficar vazio sem fingir que ha operacao.

### Observacao

Nesta rodada, o foco nao foi reescrever toda a tela de RDO. O foco foi garantir que o backbone de projeto, gestao, contatos, torre, LPS e financeiro parasse de divergir.

RDO + WhatsApp RDO continuam sendo a proxima fatia operacional prioritária.

---

## 12. WhatsApp / n8n / CODEX 2.0

### 12.1 Estado herdado do trabalho anterior

Antes desta rodada, ja haviam sido feitos ajustes relevantes no CODEX 2.0:

- `CONSTRUDATA_CODEX2_MASTER.workflow.ts` foi corrigido para tratar comandos do proprio numero do bot;
- menu e `@rdo` foram executados com sucesso no n8n;
- webhook do master e subfluxos passaram a rodar corretamente no fluxo local com Evolution;
- commit anterior relevante:
  - `b1cf1237 Handle self-sent WhatsApp commands in CODEX2 master`

### 12.2 O que esta fora desta rodada

Esta rodada nao mexeu nos workflows do n8n.

O foco aqui foi:

- frontend canonico
- backend facade
- stores e modulos prioritarios

### 12.3 O que continua valendo como proxima frente

Proxima fatia operacional forte:

- fazer `RDO web` e `RDO via WhatsApp` usarem exatamente o mesmo contrato canônico;
- garantir reflexo no painel web;
- consolidar o caminho cloud estavel.

---

## 13. Supabase

### 13.1 Tabelas canonicas consideradas em vigor

- `projetos`
- `frentes`
- `contatos`
- `tarefas`
- `rdos`
- `rdo_equipes`
- `rdo_atividades`
- `rdo_materiais`
- `rdo_equipamentos`
- `rdo_mao_obra`
- `rdo_ocorrencias`
- `punch_list_items`
- `lps_restricoes`
- `whatsapp_logs`
- `workflow_events`

### 13.2 Situação do schema

O schema conceitual ja existe e esta sendo tratado como contrato de fase 1.

O principal desta rodada foi:

- forcar mais modulos a obedecer esse contrato;
- reduzir a necessidade de leitura direta de tabela no cliente.

---

## 14. O que foi efetivamente validado nesta rodada

## 14.1 Build frontend

Comando validado:

- `npm run build`

Diretorio:

- `frontend`

Resultado:

- build aprovado
- apenas warning de chunk grande do Vite
- sem erro de compilacao

## 14.2 Python backend

Comando validado:

- `python -m py_compile api/routes_integracao_total.py`

Resultado:

- ok

## 14.3 TestClient isolado

Foi usado `FastAPI TestClient` em app minimo apenas com o router de integracao total.

Resultado:

- `GET /api/health/integrations` -> `200`
- `GET /api/projetos` -> `200`
- openapi confirmou presenca das rotas novas

## 14.4 Limite da validacao backend local

Ao tentar subir/importar a app FastAPI completa localmente para teste de integracao geral, o ambiente falhou com:

- `ModuleNotFoundError: No module named 'sqlalchemy'`

Conclusao objetiva:

- as rotas que foram editadas estao sintaticamente corretas e testadas isoladamente;
- o backend completo local ainda depende de ajuste de ambiente para validacao total.

---

## 15. Arquivos alterados nesta rodada

### Backend

- `api/routes_integracao_total.py`

### Frontend - novos

- `frontend/src/lib/canonicalProject.ts`
- `frontend/src/lib/useSupabaseDre.ts`
- `frontend/src/store/contatosStore.ts`
- `frontend/src/store/lpsStore.ts`

### Frontend - atualizados

- `frontend/src/lib/api.ts`
- `frontend/src/store/projectContext.ts`
- `frontend/src/store/projetosStore.ts`
- `frontend/src/store/rdoStore.ts`
- `frontend/src/store/torreDeControleStore.ts`
- `frontend/src/hooks/useSupabaseGestao.ts`
- `frontend/src/features/gestao-360/index.tsx`
- `frontend/src/features/gestao-360/components/ControleFinanceiroPanel.tsx`
- `frontend/src/features/gestao-contatos/index.tsx`
- `frontend/src/features/projetos/index.tsx`
- `frontend/src/features/lps-lean/index.tsx`
- `frontend/src/features/lps-lean/components/LpsHeader.tsx`
- `frontend/src/features/dre-financeiro/index.tsx`

---

## 16. O que ainda falta para fechar a fase 1

### 16.1 Nucleo prioritario ainda pendente

Ainda falta consolidar totalmente:

1. `RDO web`
2. `WhatsApp RDO`
3. reflexo do RDO no dashboard / Gestao 360 / Torre de Controle
4. tarefas e LPS com vinculo opcional mais forte a RDO
5. trilha cloud estavel do WhatsApp

### 16.2 Modulos fora do nucleo

Ainda ha mock/demo pesado em modulos que nao foram o foco desta rodada, por exemplo:

- `fluxo-operacional`
- `punch-list`
- partes de `frota`
- partes de `evm`
- partes de `mao de obra`
- `rede360`
- `bim`

Isso nao contradiz o plano. Esses modulos estao fora do corte imediato do nucleo da fase 1.

### 16.3 Backend/infra

Ainda falta:

- validar o backend real no ambiente de execucao completo;
- validar a fachada canônica no Render real;
- garantir todas as env vars de producao;
- fechar `Evolution publica -> n8n -> Render -> Supabase`.

---

## 17. Proxima passada recomendada

A proxima LLM ou o proximo ciclo deve seguir esta ordem:

### Passo 1

Fechar `RDO web` e `WhatsApp RDO` em cima do mesmo payload canônico.

Objetivo:

- o mesmo RDO aparece no Supabase, dashboard, Gestao 360 e Torre sem caminho paralelo.

### Passo 2

Validar a fachada no backend real/Render:

- `/api/projetos`
- `/api/projetos/{id}/dashboard`
- `/api/projetos/{id}/gestao360`
- `/api/projetos/{id}/torre`
- `/api/projetos/{id}/contatos`
- `/api/projetos/{id}/lps-restricoes`
- `/api/projetos/{id}/financeiro`

### Passo 3

Reduzir mock residual dos modulos operacionais adjacentes:

- `whatsapp-rdo`
- `rdo/components/WhatsAppFluxoPanel`
- `fluxo-operacional`
- `punch-list`

### Passo 4

Fechar o caminho cloud estavel:

- Evolution publica
- n8n publico/estavel
- backend Render
- frontend Vercel

---

## 18. Resumo final objetivo

Estado no fim desta rodada:

- backbone canônico do frontend avançou de forma real;
- `projectContext` deixou de nascer contaminado por demo;
- `Projetos`, `Gestao 360`, `Torre`, `Contatos`, `LPS restricoes` e `Financeiro` foram puxados para o contrato canônico;
- build frontend esta verde;
- fachada backend editada esta sintaticamente valida e testada isoladamente;
- fase 1 ainda nao terminou;
- a proxima frente correta e `RDO + WhatsApp RDO + deploy/runtime real`.

---

## 19. Fechamento runtime Render/RDO/WhatsApp - 2026-04-23 23:41 BRT

### 19.1 Commits finais enviados

- `dd74c10e` - `Adapt RDO child persistence to production schema`
- `047dfcd0` - `Coerce RDO child quantities for Supabase schema`

Ambos foram enviados para:

- `main`
- `codex/codex2-runtime-fixes`

O Render foi redeployado manualmente via CLI no servico:

- `srv-d750kldm5p6s73feojbg`

Deploy final validado:

- `dep-d7lddfsm0tmc73ev9e40`

### 19.2 Problema encontrado em producao

O Render ja estava com Supabase e WhatsApp configurados, mas o endpoint de RDO completo falhava porque:

- o payload mandava blocos como `atividades`, `equipe`, `ocorrencias`, `custos_diretos`, `custos_indiretos` e `localizacao`;
- a tabela `rdos` nao possui todas essas colunas diretamente;
- algumas tabelas filhas existem com schema menor que o schema ideal da migracao;
- `rdo_atividades` no banco real nao possui `rdo_id`, apenas `equipe_id`;
- `rdo_equipamentos.quantidade` e `rdo_mao_obra.quantidade` exigem inteiro.

### 19.3 Ajuste feito

A API agora:

- normaliza aliases do RDO antes de inserir;
- grava em `rdos` somente colunas aceitas pela tabela principal;
- preserva o payload bruto em `payload_original.raw`;
- grava equipes, atividades, materiais, equipamentos, mao de obra e ocorrencias nas tabelas filhas;
- filtra colunas filhas por tabela para respeitar o schema real do Supabase;
- busca atividades por `equipe_id` quando `rdo_atividades.rdo_id` nao existe;
- converte quantidades de equipamentos e mao de obra para inteiro antes de inserir.

### 19.4 Teste real aprovado no Render

Endpoint testado:

- `POST https://construdatamaxv2-clean.onrender.com/api/projetos/2a28beec-b1f8-4b0c-8416-d0710bb35d9d/rdos`

RDO real criado:

- `ddde5bf8-2a2b-47ef-a4ab-26df31b47361`
- marcador: `TESTE_FINAL_CODEX_20260423-234126`

Resultado:

- `health_integrations`: OK, `status=connected`, `whatsapp=configured`, `n8n=external`
- criacao de RDO completo: OK
- detalhe do RDO: OK
- filhos retornados:
  - equipes: 2
  - atividades: 2
  - materiais: 1
  - equipamentos: 1
  - mao_obra: 1
  - ocorrencias: 2
- dashboard depois do RDO: OK
  - `rdos_total=6`
  - `custo_total_dia=6780.0`
- rota de logs WhatsApp: OK
- rota de agendamentos WhatsApp: OK

### 19.5 Estado final desta passada

O nucleo API/Supabase/Render para RDO completo esta funcionando em producao.

Tambem estao publicados e respondendo:

- `/api/health/integrations`
- `/api/projetos`
- `/api/projetos/{project_id}/rdos`
- `/api/projetos/{project_id}/rdos/{rdo_id}`
- `/api/projetos/{project_id}/dashboard`
- `/api/projetos/{project_id}/whatsapp/logs`
- `/api/projetos/{project_id}/whatsapp/agendamentos`

### 19.6 Observacao operacional importante

O teste validou o backend/Render/Supabase e rotas de WhatsApp, sem disparar mensagem real para contatos.

O envio ativo pelo WhatsApp ainda deve ser testado de forma controlada, com numero/grupo de teste definido, para evitar repeticao do problema anterior de mandar mensagem para conversa errada.

---

## 20. Continuacao WhatsApp cloud - 2026-04-24

### 20.1 Estado encontrado

O Docker local nao estava acessivel:

- Docker daemon nao respondeu em `npipe:////./pipe/dockerDesktopLinuxEngine`;
- `http://localhost:5678/healthz` nao respondeu;
- `http://localhost:8080/` nao respondeu.

Portanto, o caminho local `Docker -> n8n local -> Evolution local` nao estava disponivel nesta passada.

### 20.2 Render/Supabase

O backend Render continuou saudavel:

- `/api/health/integrations`: OK
- Supabase: OK
- tabelas canonicas: OK
- `/api/whatsapp/numeros`: OK

### 20.3 Problema real do WhatsApp

O backend Render estava apontando para uma URL antiga de tunnel Cloudflare:

- `https://monkey-midwest-justify-exhaust.trycloudflare.com`

Essa URL nao resolvia mais DNS e causava:

- `Name or service not known`

As variaveis foram atualizadas no Render para:

- `EVOLUTION_URL=https://construdata-evolution.onrender.com`
- `EVOLUTION_API_URL=https://construdata-evolution.onrender.com`

### 20.4 Evolution Render

A Evolution publica existe e responde:

- `https://construdata-evolution.onrender.com/`

Mas a instancia `construdata-felipe` nao existia mais. Ela foi recriada:

- instancia: `construdata-felipe`
- status atual: `connecting`
- webhook configurado: `https://construdatamaxv2-clean.onrender.com/api/whatsapp/webhook`
- eventos: `MESSAGES_UPSERT`, `QRCODE_UPDATED`, `CONNECTION_UPDATE`, `SEND_MESSAGE`

Importante:

- Isso nao prova que o WhatsApp do Felipe esteja desconectado no celular.
- Prova apenas que a instancia cloud da Evolution no Render ainda nao esta autenticada/conectada.
- Se o WhatsApp ainda funciona em outro ambiente, ele provavelmente esta conectado em outro gateway, nao nessa Evolution cloud.

### 20.5 Ajuste de seguranca

A API foi ajustada para nao tentar enviar mensagem quando a Evolution nao estiver conectada.

Antes:

- tentava enviar mesmo com a instancia `connecting`;
- gerava timeout;
- ficava pouco claro se o problema era menu, webhook ou Evolution.

Agora:

- verifica `/instance/connectionState/{instance}`;
- se a instancia nao estiver `open`/`connected`, retorna `not_connected_<estado>`;
- no estado atual retorna `not_connected_connecting`;
- evita timeout e evita tentativa cega de envio.

Commit:

- `70bb62f9` - `Clarify WhatsApp connection state before sending`

### 20.6 Teste seguro aprovado

Webhook simulado, sem envio real:

- endpoint: `POST /api/whatsapp/webhook`
- payload: grupo falso com `#bot menu`

Resultado:

- `ok=true`
- `route=menu`
- `delivery=not_connected_connecting`
- menu retornou visualmente com emojis corretos
- health passou a mostrar `whatsapp=connecting`

### 20.7 O que falta de verdade

Falta conectar a instancia cloud da Evolution no Render ou apontar o Render para uma Evolution que ja esteja conectada.

Sem isso:

- o menu e a regra funcionam no backend;
- RDO e dashboard funcionam;
- logs funcionam;
- mas o WhatsApp real nao recebe resposta porque nao ha sessao WhatsApp aberta nessa Evolution cloud.
