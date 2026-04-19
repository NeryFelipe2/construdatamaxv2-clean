# 🤖 ConstruDataMax v2 — Handoff para Claude Code

**Data de Atualização:** 08/04/2026  
**Contexto:** O Agente Anterior (Google Antigravity) configurou com sucesso todo o roteamento de RDOs e dashboards da plataforma utilizando Evolution API, n8n (no Railway) e Frontend Vercel (Next.js/React).

Este documento serve como mapa de estado atual para que o Claude Code saiba exatamente de onde continuar, com todas as credenciais e arquitetura.

---

## 🔑 1. Credenciais e APIs

### n8n (Orquestrador)
- **Host / URL:** `https://n8n-production-ae317.up.railway.app`
- **Ferramenta Local:** `npx --yes n8nac` (Plataforma gerida via n8n-as-code)
- **Token do n8n:** Está armazenado no ambiente ou requere a chave no arquivo `token raiwail.txt` na raiz da pasta (NÃO VAZAR PARA O GIT).
- **Setup n8nac:** O projeto local já está mapeado via `n8nac-config.json` e todos os novos workflows vão para a pasta `workflows/n8n_production_ae317_up_railway_app_felipe_n/personal`.

### Evolution API (Motor WhatsApp)
- **Host / URL:** `https://evolution-api-production-b130.up.railway.app`
- **Instância:** `construdata-felipe`
- **Global API Key (Header `apikey`):** `construdata2026`
- **Configuração de Webhook Ativa:**
  A Evolution API está configurada no modo Global Webhook apontando nativamente para o nosso n8n.
  - Endpoint que a API bate: `https://n8n-production-ae317.up.railway.app/webhook/evolution-router`
  - Eventos mapeados: `MESSAGES_UPSERT`

### Plataforma Vercel (Frontend + Mock DB/Zustand)
- **URL de Produção:** `https://construdatamaxv2-clean.vercel.app`
- O estado está em `frontend/src/store/` (`contatosStore.ts`, `projectContext.ts`).

---

## 🏗️ 2. Projetos e Estrutura Instalada

Temos **4 Grandes Projetos** perfeitamente configurados na plataforma e no n8n.

### A) Pardinho — Consórcio Itapetininga
- **Membros:** Luiz Fernando (Diretor), Ícaro (Engenheiro), Renato (Diretoria), Buruca (Encarregado Geral).
- **Workflow n8n:** `gestao-pardinho-rdo-dashboard.workflow.ts`
- **O que faz:** Acorda às 6h da manhã, cobra o Ícaro (RDO de 11 itens), ele responde, o Workflow processa as respostas e manda Dashboard para o Luiz Fernando.

### B) Osasco — Consórcio CLU
- **Membros:** Luiz Fernando, Renato, Buruca, Mateus Santos (Engenheiro de Campo).
- **Workflow n8n:** `gestao-osasco-rdo-dashboard.workflow.ts`
- **O que faz:** Acorda às 6h, cobra Mateus Santos, manda o Dashboard gerencial sobre Rua Cuiabá (Capex) para o Luiz Fernando.

### C) Santos/SABESP — ConstruData
- **Membros:** Felipe Nery (Coordenador/Diretor), João (Co-Diretor).
- **Workflow n8n:** `gestao-construdata-joao-dashboard.workflow.ts`
- **O que faz:** Acorda às 7h, cobra o João, ele reporta. O Dashboard é então encaminhado para o WhatsApp de Felipe Nery.

### D) Sala Técnica — SLNR Santos
- **Membros:** Vinicius (Técnico), Gabriel (Técnico), Thalita (Survey/Planejamento), Fabrizzio (Gerente), Felipe Nery.
- **Workflow n8n:** `gestao-sala-tecnica-dashboard.workflow.ts`
- **O que faz:** Acorda às 8h, dispara cobranças via Evolution API para as 5 pendências listadas (Survey Sabesp até 10/04, EAP Trechos, Thalita, Deficit Topografia, Ramais Sabesp) diretamente para Vinicius e Gabriel.

---

## 🔀 3. Roteamento do WhatsApp (MUITO IMPORTANTE)

Como a Evolution API só envia requisições para UM Webhook por instância, não podemos deixar webhooks múltiplos recebendo tráfego ao léu.
Por isso foi criado o **Roteador Central**.

- **Arquivo:** `gestao-whatsapp-router.workflow.ts`
- **Lógica Atual do Roteador Central (`Parse Evento Whatsapp`):**
  Ele captura todo o POST Payload da Evolution, extrai a propriedade `remoteJid` (o celular de quem mandou) e o `text`.
  - Se remetente for **João** (`999996252`) $\rightarrow$ Redireciona tudo via HTTP POST para `/webhook/construdata-rdo-joao`
  - Se for **Mateus** (`991015639`) $\rightarrow$ `/webhook/construdata-rdo-osasco`
  - Se for **Gabriel** (`991995918`) ou **Vinicius** (`978216285`) $\rightarrow$ `/webhook/construdata-rdo-sala-tecnica`
  - Se for **Ícaro** (`998268576`) $\rightarrow$ `/webhook/construdata-rdo-pardinho`

*Qualquer mudança na mecânica de quem responde qual RDO exige atualização deste node Code no n8n.*

---

## 🛠️ 4. Regras Imediatas para o Claude Code

1. **Ativação dos Workflows no n8n:**
   Todos os novos workflows (`Router Central`, `Pardinho`, `Osasco`, `João` e `Sala Técnica`) precisam ser setados como **"Active"** dentro da interface do n8n para que Webhooks de Produção (`/webhook/...`) funcionem perfeitamente. O deployment API local não trocou o Status das chavinhas no Railway por falha na autorização do nó, exigindo o flip manual pelo usuário.
   
2. **Novos Ajustes nos Questionários:** 
   Se precisar mexer nas perguntas ou adicionar arquivos, basta editar o node de código em `.workflow.ts` (ex: `Montar Questionário ...`) e rodar:
   \`npx --yes n8nac push <nome-do-arquivo.workflow.ts>\`

3. O código fonte da aplicação reside em `frontend/src`. Modificações de frontend já foram deployadas na Vercel (onde está disponível todas os KPIs de Osasco, Pardinho e DRE).

BOM TRABALHO! 🚀
