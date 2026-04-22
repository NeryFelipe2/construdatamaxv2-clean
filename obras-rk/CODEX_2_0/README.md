# CODEX 2.0

This folder contains the isolated CODEX 2.0 delivery for `obras-rk`.

## What Is Here

- `workflows/`: CODEX 2.0 n8n-as-code workflows
- `artifacts/`: generated JSON files for import into n8n
- `deploy/`: Docker and Render deployment assets
- `scripts/`: publish and recovery helpers
- `source-workflows/`: original workflow snapshots used as references

## Workflow Set

- `CONSTRUDATA_CODEX2_MASTER.workflow.ts`
- `CONSTRUDATA_CODEX2_RDO.workflow.ts`
- `CONSTRUDATA_CODEX2_FINANCEIRO.workflow.ts`
- `CONSTRUDATA_CODEX2_TAREFA.workflow.ts`

## Webhook Paths

- `codex2-whatsapp-master`
- `codex2-sub-rdo`
- `codex2-financeiro`
- `codex2-sub-tarefa`

## Current Primary Local Stack

The active local stack runs from `obras-rk/docker-compose.yml`:

- n8n: `http://localhost:5678`
- Evolution API: `http://localhost:8080`
- WhatsApp instance: `construdata-felipe`
- Master webhook inside Docker: `http://n8n:5678/webhook/codex2Master0422/webhook/codex2-whatsapp-master`
- Master webhook from Windows: `http://localhost:5678/webhook/codex2Master0422/webhook/codex2-whatsapp-master`

To republish the CODEX 2.0 workflows into the active n8n container:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\felip\Downloads\construdatamaxv2-clean\obras-rk\CODEX_2_0\scripts\publish_codex2_workflows.ps1
powershell -ExecutionPolicy Bypass -File C:\Users\felip\Downloads\construdatamaxv2-clean\obras-rk\CODEX_2_0\scripts\set_codex2_webhook.ps1
```

## Local Isolated Stack

Run the 2.0 compose file when you want CODEX 2.0 beside the current local stack:

```powershell
cd C:\Users\felip\Downloads\construdatamaxv2-clean
docker compose -f .\obras-rk\CODEX_2_0\deploy\docker-compose.codex2.yml up -d
```

Local ports:

- API: `http://localhost:8788`
- n8n: `http://localhost:5679`
- Evolution API: `http://localhost:8081`

## Local Publish

Run:

```powershell
cd C:\Users\felip\Downloads\construdatamaxv2-clean\obras-rk\CODEX_2_0
powershell -ExecutionPolicy Bypass -File .\scripts\publish_codex2_workflows.ps1
```

Then, if the WhatsApp instance already exists in Evolution:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\set_codex2_webhook.ps1
```

If the new Evolution stack is empty, migrate the old session first:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\migrate_evolution_session.ps1
```

## Render

Blueprint file:

- `deploy/render.codex2.yaml`

Use Blueprint creation in Render and point it to this file.
