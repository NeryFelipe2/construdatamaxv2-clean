# Handoff ConstruDataMaxV2 Clean

## Projeto principal

- Repositorio principal: `https://github.com/NeryFelipe2/construdatamaxv2-clean`
- Pasta local principal: `C:\Users\felip\Downloads\construdatamaxv2-clean`
- Fonte original da NS V5: `C:\Users\felip\Downloads\NOVA NS Versao 5`
- Repo antigo so para referencia: `C:\Users\felip\Downloads\CONSTRUDATAMAX`

## Deploy atual

- Render live: `https://construdatamaxv2-clean.onrender.com`
- Health: `https://construdatamaxv2-clean.onrender.com/health`
- Vercel live: `https://construdatamaxv2-clean.vercel.app`

## Render

- Servico atual no painel: `construdatamaxv2-clean`
- Service ID visto no painel: `srv-d750kldm5p6s73feojbg`
- Repo usado: `NeryFelipe2/construdatamaxv2-clean`
- Branch: `main`

Configuracao esperada:

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/health`

Observacao:

- Em `render.yaml`, o nome declarado esta como `construdatamaxv2-api`
- O servico live criado no painel ficou como `construdatamaxv2-clean`

## Vercel

- Project: `construdatamaxv2-clean`
- Repo: `NeryFelipe2/construdatamaxv2-clean`
- Branch: `main`
- Framework: `Vite`
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Env do frontend:

- `VITE_API_URL=https://construdatamaxv2-clean.onrender.com`

## Variaveis de ambiente principais

No Render:

- `DATABASE_URL`
- `GEMINI_API_KEY`
- `CONSTRUDATA_API_BASE_URL`
- `PLATFORM_NAME=construdatamaxv2`
- `PLATFORM_DISPLAY_NAME=ConstruDataMaxV2`

No Vercel:

- `VITE_API_URL=https://construdatamaxv2-clean.onrender.com`

## Banco / Supabase

O backend usa `DATABASE_URL` apontando para o Supabase via session pooler.

Formato esperado:

- `postgresql://postgres.<project-ref>:<password>@aws-1-us-east-1.pooler.supabase.com:5432/postgres`

Importante:

- Nao salvar a senha antiga
- A senha do banco ja foi exposta em conversa anterior
- Tratar como comprometida e resetar

## Tokens e segredos que devem ser rotacionados

- `RENDER_API_KEY`
- `VERCEL_TOKEN`
- senha do banco do Supabase usada no `DATABASE_URL`
- `GEMINI_API_KEY`, se estiver configurada
- `AI_GATEWAY_API_KEY`, se estiver configurada

## Onde rotacionar

- Render API keys:
  `https://dashboard.render.com/account/api-keys`

- Vercel tokens:
  `https://vercel.com/account/tokens`

- Supabase database password:
  `Supabase > Settings > Database/Infrastructure > Reset database password`

- Gemini API key:
  `https://aistudio.google.com/app/apikey`

## Ordem segura de rotacao

1. Gerar nova `RENDER_API_KEY`
2. Gerar novo `VERCEL_TOKEN`
3. Resetar a senha do banco no Supabase
4. Gerar nova `GEMINI_API_KEY`, se usar
5. Atualizar Render e Vercel com os valores novos
6. Revogar os valores antigos

## Backend publicado

Rotas web nativas:

- `/health`
- `/rdo`
- `/manage`
- `/controle`
- `/campo`
- `/perdas`
- `/editor`
- `/arquitetura-bim`
- `/fluxograma-bim`

APIs principais:

- `/api/processamento/importar`
- `/api/processamento/ultimo`
- `/api/processamento/{job_id}`
- `/api/processamento/{job_id}/artefato/{rel_path}`
- `/api/ns`
- `/api/ns/{id}`
- `/api/ns/{id}/status`
- `/api/rdo`
- `/api/rdo/{id}/fechar`
- `/api/rdo/{id}/pdf`
- `/api/rdo/{data_ref}`
- `/api/dashboard`
- `/api/cronograma`
- `/api/curva-s`
- `/api/cadastro/geojson`
- `/api/manage/rede`
- `/api/fotos/{ns_id}`
- `/webhook/whatsapp`

Arquivos principais do backend:

- `api/server.py`
- `api/routes_processamento.py`
- `api/routes_ns.py`
- `api/routes_rdo.py`
- `api/routes_campo.py`
- `api/routes_cadastro.py`
- `backend/requirements.txt`

## Frontend publicado

Arquivos principais:

- `frontend/src/App.tsx`
- `frontend/src/styles.css`
- `frontend/package.json`

Estado atual do frontend:

- importa projeto e gera notas
- mostra artefatos do ultimo job
- lista NS, detalhe, checklist, materiais, fotos e status
- cria, lista e fecha RDO
- mostra dashboard, cronograma, curva S, cadastro e manage/rede
- abre modulos nativos
- embute os modulos nativos dentro do proprio frontend por iframe

## Ultimos commits importantes

- `26f0921` Embed native modules in frontend workspace
- `8ce2669` Finish backend coverage in frontend
- `24fc92a` Expose backend functionality in frontend
- `900703c` Add usable import-and-generate frontend flow
- `f35116a` Use real network data in manage viewer
- `7783f78` Match NS desenho layout to official board
- `4126e88` Add painel WhatsApp no RDO com endpoints de sessoes, teste e normalizacao de payload Evolution/Meta
- `659c39a` Add whitelist de apontadores WhatsApp + manual de operacao

## Comandos uteis

Render CLI:

```powershell
render --version
render login
render services list
render services get srv-d750kldm5p6s73feojbg
```

PowerShell para nova sessao:

```powershell
$env:RENDER_API_KEY="SUA_CHAVE_NOVA"
$env:VERCEL_TOKEN="SEU_TOKEN_NOVO"
```

## Texto curto para colar na proxima conversa

```txt
Projeto atual: construdatamaxv2-clean
Repo: https://github.com/NeryFelipe2/construdatamaxv2-clean
Render live: https://construdatamaxv2-clean.onrender.com
Vercel live: https://construdatamaxv2-clean.vercel.app

Backend:
- FastAPI no Render
- rootDir=backend
- build=pip install -r requirements.txt
- start=uvicorn main:app --host 0.0.0.0 --port $PORT
- health=/health

Env vars principais no Render:
- DATABASE_URL
- GEMINI_API_KEY
- CONSTRUDATA_API_BASE_URL
- PLATFORM_NAME=construdatamaxv2
- PLATFORM_DISPLAY_NAME=ConstruDataMaxV2

Frontend:
- Vite na Vercel
- rootDir=frontend
- build=npm run build
- output=dist
- VITE_API_URL=https://construdatamaxv2-clean.onrender.com

Estado atual:
- frontend ja cobre processamento, NS, RDO, dashboard, cronograma, curva S, cadastro e manage/rede
- modulos nativos do backend tambem estao embutidos no frontend por iframe
- ultimos commits principais:
  26f0921 Embed native modules in frontend workspace
  8ce2669 Finish backend coverage in frontend
  24fc92a Expose backend functionality in frontend

Atencao:
- tokens e senha antigos foram expostos em conversa anterior e precisam ser rotacionados
```
