# HANDOFF — Deploy do ConstruData WCR (para o Antigravity executar)

> Preparado pelo Claude Code. Todo o código/dados já estão prontos nesta pasta.
> O ambiente do Claude Code **não tem rede** — por isso o **deploy/push/Supabase**
> ficam para quem tem terminal com internet (você / Antigravity).

## 0 — Para entender TUDO (contexto da conversa)
Todo o histórico e as decisões estão na **pasta da conversa do Claude Code**:
`C:\Users\felip\.claude\projects\C--Users-felip-Desktop--ORGANIZADO-22-NOVA-NS-VERSAO-5\`
- `memory\MEMORY.md` — **índice da memória (LEIA PRIMEIRO)**.
- `memory\construdata-deploy-stack.md` — topologia do deploy (Vercel/Render/Supabase), estado atual, comandos.
- `memory\wcr-*.md`, `motor-unico-pipeline.md`, `v5-*.md`, `felipe-tdah-comunicacao.md` — contexto WCR/motor + como falar com o Felipe.
- `*.jsonl` — transcripts das conversas; **esta conversa (deploy WCR) é `b15b3316-4d59-470c-a945-9bb7aebe9dc8.jsonl`**.

Pastas de origem (dados reais):
- **App (frontend WCR):** `...\21-CONSTRUDATA\construdatamaxv2-clean-estabiliza\` (esta pasta).
- **Dados/obra WCR:** `...\26-WCR SANEAMENTO\` (lotação, apontamento `DIARIO_OBRA_BOI_MALHADO_apontamento.json`, gpkg executado/a-fazer).
- **Obsidian WCR:** `...\WCR\` (00_INDICE.md, BOI_MALHADO.md, EQUIPES.md, CRONOGRAMA.md).
- **Motor (gera os dados):** `...\22-NOVA-NS-VERSAO-5\NOVA NS Versao 5\planejamento\construdata_export.py`.

## Objetivo
ConstruData no ar (Vercel) mostrando **só a WCR** com **dados REAIS** do Boi Malhado
(executado), Sakura e Comunidade do Retorno. Sem SLNR/Santos.

## Stack (já existe e está no ar)
- **Vercel:** projeto `construdatamaxv2-clean` · `prj_biTyPWIpQ1xQ9OuV0LXDsem0iviF` · team `team_wxOoVlY9ANbI8wH6SZ86cwWy` · Root Directory = `frontend` · Vite · URL `https://construdatamaxv2-clean.vercel.app`
- **Render:** `construdatamaxv2-clean.onrender.com` (backend FastAPI, root `backend`) · `srv-d750kldm5p6s73feojbg`
- **Supabase:** projeto `vblfdikfobsirwpdnybw` · schema em `frontend/supabase-schema.sql` (RLS policy `allow_all`)
- **Repo:** `NeryFelipe2/construdatamaxv2-clean` · branch **main** = o que deploya
- Esta pasta (`...construdatamaxv2-clean-estabiliza`) está **linkada** ao projeto Vercel (`.vercel/project.json`) e o **Vercel CLI está logado** (`vercel --version` = 50.32.5).

## O que já foi alterado/gerado nesta pasta (pelo Claude Code)
- `frontend/src/store/projectContext.ts` → só projetos WCR (Boi/Sakura/Retorno, contrato 13.546/25-00); Santos removido; `ALLOW_DEMO_DATA = true` (mostra WCR mesmo com Supabase fora).
- `frontend/src/store/mapaInterativoStore.ts` → importa a rede real `@/data/wcr/mapa.json` e abre já no modo `saneamento`.
- `frontend/src/data/wcr/mapa.json` → rede REAL do Boi Malhado (125 nós / 69 trechos, lat-lng, SP Zona Norte).
- `frontend/public/wcr_db.json` → dados reais por tabela (projetos/frentes/contatos/rdos/rdo_equipes/rdo_atividades) do apontamento 11–21/06.
- `frontend/wcr_supabase.sql` → mesmos dados em SQL idempotente (DELETE+INSERT).
- Motor gerador: `planejamento/construdata_export.py` (no repo NOVA NS Versão 5) — funções `exportar_mapa()`, `exportar_sql()`, `exportar_db_json()`.

---

## AÇÃO 1 — Deploy do frontend WCR no Vercel (rápido, NÃO depende do Supabase)
```powershell
cd "C:\Users\felip\Desktop\_ORGANIZADO\21-CONSTRUDATA\construdatamaxv2-clean-estabiliza"
vercel deploy --yes            # PREVIEW primeiro (seguro, URL de teste)
# se o preview mostrar a WCR ok:
vercel deploy --prod --yes     # PRODUÇÃO (troca o site live)
```
- Faz upload dos arquivos LOCAIS (as mudanças WCR acima). Não usa git.
- **Build verificado seguro:** script `build` = `vite build` (esbuild, sem `tsc`/type-check) e `noUnusedLocals: false`. O código morto em `makeDemoData()` e o `import` de `.json` **não quebram** o build. Deve passar de primeira.
- **Verificar:** abrir a URL do deploy → projetos **Boi Malhado / Sakura / Retorno** (sem Santos) + tela **Mapa** com a rede real (satélite SP Zona Norte).

## AÇÃO 2 — Dados "live" no Supabase (opcional, deixa editável de verdade)
> O projeto `vblfdikfobsirwpdnybw` estava **fora do ar** (subdomínio não resolvia → pausado/deletado) e a conta estava deslogada.
1. Logar no Supabase (dashboard) e **ver o estado do projeto**:
   - **Pausado** → botão **Restore project** (leva ~2 min).
   - **Deletado** → criar projeto novo e atualizar `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` no **Vercel** (env), no **Render** (backend) e em `frontend/.env.local`.
2. No **SQL Editor**: rodar `frontend/supabase-schema.sql` (se as tabelas não existirem) e depois `frontend/wcr_supabase.sql` (dados WCR).
   - Alternativa via API: inserir `frontend/public/wcr_db.json` por REST (PostgREST), ordem: projetos → frentes → contatos → rdos → rdo_equipes → rdo_atividades. Campo `_delete_projeto_ids` = apagar antes (cascade).
3. Re-deploy do frontend (AÇÃO 1) se mudou env var.

## AÇÃO 3 — Regerar os dados quando o apontamento mudar
```powershell
cd "C:\Users\felip\Desktop\_ORGANIZADO\22-NOVA-NS-VERSAO-5\NOVA NS Versao 5"
python -m planejamento.construdata_export   # regera mapa.json + wcr_supabase.sql + wcr_db.json
```

## Verificação final
- `https://construdatamaxv2-clean.vercel.app` → só frentes WCR, sem Santos.
- Mapa mostra a rede real do Boi Malhado.
- (Com Supabase) RDOs/gestão com os números do apontamento (11–21/06).

## ⚠️ Segurança (fazer também)
`DEPLOY_HANDOFF.md` manda **rotacionar** segredos que estão em texto puro nos `.env`:
GitHub PAT, chave OpenAI, chave Gemini, senha do DATABASE_URL.
