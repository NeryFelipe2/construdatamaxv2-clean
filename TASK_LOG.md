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

**Tarefa 1: Corrigir Evolution API no Railway**
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
