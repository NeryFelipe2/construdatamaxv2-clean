# Migracao NOVA NS V5 para ConstruDataWeb - 2026-05-01

## Objetivo

Levar a operacao da NOVA NS V5 para o ConstruDataWeb real, sem depender da tela local `http://127.0.0.1:8000/ns-v5`.

Destino operacional:

- Frontend: `https://construdatamaxv2-clean.vercel.app`
- Backend: `https://construdatamaxv2-clean.onrender.com`
- Modulo principal: `/app/rdo`, aba `RDO Automatico`

## O que foi implementado

- Backend FastAPI:
  - `POST /api/projetos/{project_id}/preencher-texto`
  - `POST /api/projetos/{project_id}/rdos/automatico/texto`
  - `POST /api/projetos/{project_id}/rdos/automatico/upload`
  - `GET /api/projetos/{project_id}/rdos/{rdo_id}/evidencias`
  - `PATCH /api/projetos/{project_id}/rdos/{rdo_id}/revisar`
  - `POST /api/projetos/{project_id}/rdos/{rdo_id}/finalizar`
  - `POST /api/projetos/{project_id}/rdos/{rdo_id}/rejeitar`
  - `GET /api/projetos/{project_id}/rdos/{rdo_id}/medicao-fontes`
  - `GET /api/relatorio360/rdo/{rdo_id}`
  - `GET /api/projetos/{project_id}/bi/analytics`
  - `GET/POST /api/projetos/{project_id}/controle-fluxo`

- Frontend React:
  - nova aba `RDO Automatico` dentro do modulo RDO real;
  - criacao de RDO por texto;
  - criacao de RDO por upload com evidencia preservada;
  - fila de revisao com status V5;
  - acoes de revisar, finalizar e rejeitar;
  - historico mostrando status de revisao;
  - finalizacao no historico gerando fontes de medicao.

## Compatibilidade

Para nao quebrar Supabase antigo, o status fisico da tabela `rdos` continua compativel com `aberto/fechado`.

Os status V5 ficam em `payload_original`:

- `rascunho`
- `extraido`
- `em_revisao`
- `finalizado`
- `rejeitado`

Evidencias ficam em `workflow_events` com `tipo = rdo_evidencia`.

## Validacao

Comandos executados:

```powershell
python -m py_compile api\routes_integracao_total.py
cd frontend
npm.cmd run build
```

Resultado:

- backend compilou sem erro;
- frontend Vite buildou sem erro;
- houve apenas warning normal de chunk grande.

## Rollback

Para voltar esta mudanca, reverter estes arquivos:

- `api/routes_integracao_total.py`
- `frontend/src/lib/api.ts`
- `frontend/src/types/index.ts`
- `frontend/src/store/rdoStore.ts`
- `frontend/src/features/rdo/index.tsx`
- `frontend/src/features/rdo/components/RdoHeader.tsx`
- `frontend/src/features/rdo/components/HistoricoPanel.tsx`
- `frontend/src/features/rdo/components/RdoAutomaticoPanel.tsx`

Comando sugerido se esta for a unica mudanca desejada para rollback:

```powershell
git restore -- api/routes_integracao_total.py frontend/src/lib/api.ts frontend/src/types/index.ts frontend/src/store/rdoStore.ts frontend/src/features/rdo/index.tsx frontend/src/features/rdo/components/RdoHeader.tsx frontend/src/features/rdo/components/HistoricoPanel.tsx frontend/src/features/rdo/components/RdoAutomaticoPanel.tsx
```
