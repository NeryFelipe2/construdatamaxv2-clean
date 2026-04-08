# 🔄 TASK LOG — ConstruDataMax v2
> **Última atualização:** 2026-04-07 21:31
> **Projeto:** `C:\Users\felip\Downloads\construdatamaxv2-clean`

---

## 🔑 CREDENCIAIS & ENDPOINTS

### Railway
- **URL do Projeto:** https://railway.com/project/cd0ef028-10b2-4cc5-9962-e508c986275c
- **Créditos:** 30 days or $4.95 left

### N8N
- **URL:** https://n8n-production-ae317.up.railway.app
- **API Key (do n8nac-config.json):** ver arquivo `n8nac-config.json` na raiz

### Evolution API (WhatsApp)
- **Imagem Docker:** `atendai/evolution-api:v2.2.3`
- **URL:** https://evolution-api-production-b130.up.railway.app
- **Porta:** 8080
- **API Key:** `construdata2026`
- **STATUS:** ⚠️ CRASHED — variáveis precisam ser corrigidas
- **Página Railway:** https://railway.com/project/cd0ef028-10b2-4cc5-9962-e508c986275c/service/3cdc529...

### Plataforma ConstruDataMax
- **URL Vercel:** https://construdatamaxv2-clean.vercel.app
- **GitHub:** https://github.com/NeryFelipe2/construdatamaxv2-clean.git
- **Branch:** main

### WhatsApp da Equipe
- **Felipe (gestor):** +5561981846325
- **Luiz Fernando (diretor):** +5537999425397
- **Ícaro (engenheiro):** +5537998268576

---

## 🎯 DIVISÃO DE TRABALHO

### ANTIGRAVITY (EU) — Fazendo AGORA:
**Foco: PLATAFORMA FRONTEND**
1. ✅ Projeto Pardinho adicionado em `projectContext.ts`
2. ✅ Contatos equipe adicionados em `contatosStore.ts`
3. ✅ RDO Bot Steps atualizados em `rdoBotSteps.ts`
4. ✅ 5 workflows n8n criados e pushed
5. 🔄 **FAZENDO AGORA:** Adicionando Pardinho na Torre de Controle (mock data com coordenadas)
6. 🔄 **FAZENDO AGORA:** Adicionando dados DRE para Pardinho
7. 🔄 **FAZENDO AGORA:** Adicionando dados Gestão 360 para Pardinho
8. ⬜ Commit + push final

### CLAUDE CODE — FAZER:
**Foco: INFRAESTRUTURA / EVOLUTION API**

**Tarefa 1: Corrigir Evolution API no Railway** — ✅ RESOLVIDO (CC)
- Diagnóstico: Evolution v2.2.3 exigia Postgres real (não aceita sqlite/disabled). Logs Prisma confirmaram.
- Solução: Troquei imagem pra `atendai/evolution-api:v1.8.2` via Railway GraphQL (`serviceInstanceUpdate` + `serviceInstanceDeployV2`).
- Resultado: HTTP 200, `{"version":"1.8.2"}` respondendo.

**Tarefa 2: Criar instância WhatsApp** — ✅ FEITO (CC)
- Instância: `construdata-felipe` (id `e798c92a-e53e-451d-ba2b-aefb90dbcd4a`)
- Hash apikey instância: `29CB78F6-A424-4A35-9CAD-36D9C3F7ECA4`
- **QR Code salvo:** `WHATSAPP_QR.png` na raiz do projeto. **Felipe: abrir WhatsApp → Aparelhos conectados → Conectar aparelho → escanear.**
- QR expira em ~60s. Se expirar: `curl -X GET https://evolution-api-production-b130.up.railway.app/instance/connect/construdata-felipe -H "apikey: construdata2026"`

**Tarefa 3: Conectar Evolution API → n8n** — 🟡 BLOQUEADO no manual (CC)
- n8n public API está habilitado, mas não há API key estática nas vars (n8n exige key gerada pelo usuário em Settings → API).
- **Felipe precisa fazer manual:** n8n → Credentials → New → "HTTP Header Auth" (ou criar credencial Evolution API genérica):
  - Name: `Evolution API`
  - Header Name: `apikey`
  - Header Value: `construdata2026`
  - Base URL pra usar nos workflows: `https://evolution-api-production-b130.up.railway.app`

**(instruções originais abaixo, mantidas pra referência)**
- ✅ Railway CLI autenticado (felipe.nery2@gmail.com), service `evolution-api` linkado
- ✅ Vars setadas: `SERVER_URL`, `DATABASE_PROVIDER=postgresql`, `DATABASE_CONNECTION_URI`
- ✅ Redeploy disparado
- ❌ **AINDA 502.** Logs mostram: Evolution v2.2.3 **exige Postgres real** (não aceita `DATABASE_ENABLED=false` nem sqlite). Erro: `Prisma schema validation` — falta `DATABASE_URL` apontando pra um Postgres de verdade.
- 🛑 **DECISÃO NECESSÁRIA DO FELIPE:**
  - **Opção A:** Provisionar Postgres no Railway (`railway add --database postgres`). Consome créditos do projeto (~$5/mês tier mínimo). Restam $4.95.
  - **Opção B:** Trocar imagem Docker pra `atendai/evolution-api:v1.8.2` (versão antiga que aceita sqlite/sem DB). Mais leve, sem custo extra.
  - **Opção C:** Usar Postgres externo (Supabase free tier) e setar `DATABASE_URL` apontando pra ele.
- Aguardando Felipe escolher A/B/C antes de continuar Tarefas 2 e 3.

---

**(instruções originais abaixo, mantidas pra referência)**
O serviço `evolution-api` está CRASHED. Precisa:
- Abrir Raw Editor das variáveis em: https://railway.com/project/cd0ef028-10b2-4cc5-9962-e508c986275c/service/3cdc529...
- Ou usar curl para testar se já está UP:
```bash
curl https://evolution-api-production-b130.up.railway.app/
```
- Se não estiver UP, as variáveis corretas são:
```
SERVER_URL=https://evolution-api-production-b130.up.railway.app
AUTHENTICATION_TYPE=apikey
AUTHENTICATION_API_KEY=construdata2026
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
DATABASE_ENABLED=false
DATABASE_PROVIDER=sqlite
DATABASE_CONNECTION_URI=file:./evolution.db
LOG_LEVEL=WARN
PORT=8080
```

**Tarefa 2: Criar instância WhatsApp na Evolution API**
Após Evolution API online:
```bash
# Criar instância
curl -X POST https://evolution-api-production-b130.up.railway.app/instance/create \
  -H "apikey: construdata2026" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "construdata-felipe", "qrcode": true}'

# Pegar QR Code para Felipe escanear
curl -X GET https://evolution-api-production-b130.up.railway.app/instance/connect/construdata-felipe \
  -H "apikey: construdata2026"
```

**Tarefa 3: Conectar Evolution API no n8n**
- No n8n (https://n8n-production-ae317.up.railway.app):
  - Criar credencial "Evolution API"
  - URL: https://evolution-api-production-b130.up.railway.app
  - API Key: construdata2026

---

## ✅ CONCLUÍDO (Antigravity)

### Plataforma (Frontend)
- [x] Projeto Pardinho — `frontend/src/store/projectContext.ts`
- [x] 3 frentes Pardinho — IDs: f-pard-1, f-pard-2, f-pard-3
- [x] 5 contatos equipe — `frontend/src/store/contatosStore.ts`
- [x] RDO Bot Steps — `frontend/src/features/rdo/utils/rdoBotSteps.ts`
- [x] Git push — commit `0b767e52` no branch `main`

### N8N Workflows (5 total)
- [x] `assistente-diario-obra.workflow.ts` — 8 nodes
- [x] `webhook-rdo-whatsapp.workflow.ts` — 7 nodes
- [x] `alerta-medicao-prazos.workflow.ts` — 6 nodes
- [x] `gestao-pardinho-rdo-dashboard.workflow.ts` — 12 nodes
- [x] `pardinho-lean-lps-planejamento.workflow.ts` — 9 nodes

---

## 📂 ARQUIVOS CHAVE

| Arquivo | O que tem |
|---|---|
| `frontend/src/store/projectContext.ts` | Projetos + frentes |
| `frontend/src/store/contatosStore.ts` | Contatos equipe |
| `frontend/src/store/torreDeControleStore.ts` | Store da Torre de Controle |
| `frontend/src/data/mockTorreDeControle.ts` | Mock data obras (VAZIO — Antigravity vai preencher) |
| `frontend/src/features/dre-financeiro/index.tsx` | DRE (hardcoded Santos — Antigravity vai adicionar Pardinho) |
| `frontend/src/features/gestao-360/index.tsx` | Gestão 360 (hardcoded — Antigravity vai tornar dinâmico) |
| `frontend/src/features/rdo/utils/rdoBotSteps.ts` | Steps do bot RDO |
| `frontend/src/App.tsx` | Rotas e seletor de projeto |
| `n8nac-config.json` | Config n8n-as-code |
| `workflows/.../gestao-pardinho-rdo-dashboard.workflow.ts` | Fluxo principal Pardinho |
| `workflows/.../pardinho-lean-lps-planejamento.workflow.ts` | LPS Pardinho |

---

## 🟢 SESSÃO 08/04 — CC FIXES

**Problema:** Respostas no WhatsApp não disparavam nada.
**Causa raiz:** Os 5 workflows (Router + Pardinho + Osasco + ConstruData João + Sala Técnica) estavam `active: false`. Evolution API entregava o webhook em `/webhook/evolution-router` mas o workflow estava off → 404.
**Fix:** Ativados via `npx n8nac workflow activate <id>`:
- `CJRFUtzbL3pGpb4s` (Router) ✅
- `uEejEvtqnNC2eGiv` (Sala Técnica) ✅
- `3MlISSU8VYGAiiMR` (Pardinho) ✅
- `HVPwaXUwSGHlK4J4` (Osasco) ✅
- `asoqRI8fbz3SKlz5` (ConstruData João) ✅

**Validação:** simulei `messages.upsert` no router via curl → 200 ok, dashboard montado, registrou.

**SLNR Santos → Fabrizzio:**
- `gestao-sala-tecnica-dashboard.workflow.ts` agora envia o dashboard pra **Fabrizzio (5574999076534)** em vez de Felipe. Pushed + reativado.
- Contato `c-st-5` em `frontend/src/store/contatosStore.ts` corrigido (estava `557499076534` — 12 dígitos, faltava o 9 do celular).

**Validação +55 em todos os projetos:**
- Função `normalizeWhatsapp(input)` em `contatosStore.ts`. Aceita qualquer entrada, normaliza pra `55 DDD 9XXXXXXXX` (13 dígitos).
- `addContato` e `updateContato` agora chamam — joga `Error` se número inválido (sem 9, sem DDD, ou tamanho errado). UI precisa fazer try/catch.

**Reenvio das mensagens:** mandado anúncio "RDO ativo, responda quando receber a cobrança" via Evolution API pra Ícaro, Mateus, João, Gabriel, Vinicius e Fabrizzio. Todos HTTP 201. Cobranças completas voltam a disparar automaticamente nos cron (6/7/8h).
