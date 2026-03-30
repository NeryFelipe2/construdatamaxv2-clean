# Deploy Handoff

## Fonte de verdade

- Repo GitHub principal: `https://github.com/NeryFelipe2/construdatamaxv2-clean`
- Pasta local principal: `C:\Users\felip\Downloads\construdatamaxv2-clean`
- Branch principal: `main`
- Repo antigo so para referencia: `C:\Users\felip\Downloads\CONSTRUDATAMAX`
- Fonte original da NS V5: `C:\Users\felip\Downloads\NOVA NS Versao 5`

## Servicos ativos

- Render live: `https://construdatamaxv2-clean.onrender.com`
- Render health: `https://construdatamaxv2-clean.onrender.com/health`
- Vercel live: `https://construdatamaxv2-clean.vercel.app`

## Render

- Servico live atual: `construdatamaxv2-clean`
- Service ID: `srv-d750kldm5p6s73feojbg`
- Repo conectado: `NeryFelipe2/construdatamaxv2-clean`
- Branch: `main`

Configuracao esperada:

- `rootDir=backend`
- `buildCommand=pip install -r requirements.txt`
- `startCommand=uvicorn main:app --host 0.0.0.0 --port $PORT`
- `healthCheckPath=/health`

Arquivo relacionado:

- `render.yaml`

Atencao:

- O `render.yaml` declara `name: construdatamaxv2-api`
- O servico live atual no painel esta como `construdatamaxv2-clean`
- Se recriar o servico por YAML, o nome pode mudar

## Vercel

- Project: `construdatamaxv2-clean`
- Repo conectado: `NeryFelipe2/construdatamaxv2-clean`
- Branch: `main`
- Framework: `Vite`
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Arquivos relacionados:

- `frontend/package.json`
- `frontend/.env.example`

## Variaveis de ambiente

Render:

- `DATABASE_URL`
- `GEMINI_API_KEY`
- `CONSTRUDATA_API_BASE_URL`
- `PLATFORM_NAME=construdatamaxv2`
- `PLATFORM_DISPLAY_NAME=ConstruDataMaxV2`

Vercel:

- `VITE_API_URL=https://construdatamaxv2-clean.onrender.com`

## Banco / Supabase

O backend usa `DATABASE_URL` apontando para o Supabase via session pooler.

Formato esperado:

- `postgresql://postgres.<project-ref>:<password>@aws-1-us-east-1.pooler.supabase.com:5432/postgres`

Importante:

- Nao reutilizar a senha antiga
- A senha do banco ja foi exposta em conversa anterior
- Tratar como comprometida e resetar

## Segredos que precisam ser rotacionados

- `RENDER_API_KEY`
- `VERCEL_TOKEN`
- senha usada no `DATABASE_URL`
- `GEMINI_API_KEY`, se estiver em uso
- `AI_GATEWAY_API_KEY`, se estiver em uso

Ordem segura:

1. Gerar nova `RENDER_API_KEY`
2. Gerar novo `VERCEL_TOKEN`
3. Resetar a senha do banco no Supabase
4. Gerar nova `GEMINI_API_KEY`, se usar
5. Atualizar Render e Vercel com os valores novos
6. Revogar os valores antigos

PowerShell para nova sessao:

```powershell
$env:RENDER_API_KEY="SUA_CHAVE_NOVA"
$env:VERCEL_TOKEN="SEU_TOKEN_NOVO"
```

## Arquivos principais do deploy

Backend:

- `backend/main.py`
- `backend/requirements.txt`
- `api/server.py`
- `api/routes_processamento.py`
- `api/routes_ns.py`
- `api/routes_rdo.py`
- `api/routes_campo.py`
- `api/routes_cadastro.py`

Frontend:

- `frontend/src/App.tsx`
- `frontend/src/styles.css`
- `frontend/package.json`
- `frontend/.env.example`

Infra:

- `render.yaml`

## Estado publicado

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

Frontend atual:

- cobre processamento, NS, RDO, dashboard, cronograma, curva S, cadastro e manage/rede
- embute modulos nativos do backend por `iframe`

## Comandos uteis

Render CLI:

```powershell
render --version
render login
render services list
render services get srv-d750kldm5p6s73feojbg
```

Git / GitHub:

```powershell
git status -sb
git remote -v
gh repo view NeryFelipe2/construdatamaxv2-clean
```

## Checklist rapido de deploy

1. Confirmar que os segredos antigos foram rotacionados.
2. Validar `render.yaml` e `frontend/.env.example`.
3. Conferir se Render continua apontando para `backend` e Vercel para `frontend`.
4. Garantir que `VITE_API_URL` aponta para `https://construdatamaxv2-clean.onrender.com`.
5. Subir mudancas na `main`.
6. Validar `https://construdatamaxv2-clean.onrender.com/health`.
7. Validar o frontend publicado em `https://construdatamaxv2-clean.vercel.app`.
