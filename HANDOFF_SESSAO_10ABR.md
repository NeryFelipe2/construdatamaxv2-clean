# HANDOFF — Sessão 10/Abr/2026

## Repo
- **Path:** `C:\Users\felip\Downloads\construdatamaxv2-clean`
- **Remote:** `https://github.com/NeryFelipe2/construdatamaxv2-clean.git`
- **Branch:** `claude/rdo-whatsapp-nts-motores`
- **PR:** https://github.com/NeryFelipe2/construdatamaxv2-clean/pull/5
- **Status:** TUDO COMMITADO E PUSHADO. Nada pendente pra commitar.

## O que foi feito nesta sessão

### 1. Motores de leitura NTS 292 (NOVA NS Versao 5 → copiado pra cá)
- `ler_dxf_gdal.py`: whitelist REDE/ESGOTO/EMISSARIO/INTERCEPTOR/RAMAL + fix brutal substring
- `ler_dwg_universal.py`: whitelist NTS, blacklist topografia
- `gerar_civil3d.py`: Dynamo reescrito com `ImportLandXML` + novo `.dyn` JSON
- `construdata_pipeline.py`: etapa Civil 3D gera `.py` + `.dyn`

### 2. WhatsApp Motor (whatsapp-motor/index.js)
- Parser brutal de RDO completo (NUCLEO/TRECHO/SERVICOS/EQUIPE/FINANCEIRO/OCORRENCIAS)
- `parseRDO()` + `enviarRDOParaAPI()` → POST /api/rdo (rdo_engine)
- Parser financeiro: suporta 2409.84, 2.409,84, R$500

### 3. Router n8n (gestao-whatsapp-router.workflow.ts)
**Menu 1-16 completo** com handlers reais (não só guias):
- `@rdo <projeto>` — dispara RDO por projeto (NUNCA "todos")
- `@tarefadiretoria <nome> <desc>` — 1 diretor específico
- `@tarefaengenheiros <projeto> <desc>` — 1 projeto específico
- `@tarefaconsorcio <setor> <desc>` — por setor do Consórcio
- `@tarefa <nome> <desc>` — todos os 15 nomes reconhecidos
- `@lembrar <nome>` — lembrete para 1 diretor específico
- `@meurdo` — RDO de supervisão do diretor

**Confidencialidade entre projetos:**
- `@rdo todos` / `@tarefadiretoria todos` / `@tarefaengenheiros todos` → BLOQUEADO
- `resolverProjectId()` retorna null pra projetos desconhecidos → fail-safe
- `salvarSupabaseRdo()` recusa dados sem project_id
- Telefones não cadastrados → silêncio total (nunca responde amigos/família)

**Escopos dos diretores:**
- Felipe: `['todos']`
- Renato: `['osasco','rk']`
- Luiz Fernando: `['pardinho','osasco','rk']`
- Fabrizzio: `['consorcio']`
- João: `['brasilia']`

**projetoDoPhone completo (15 cadastrados):**
- Mateus (Osasco, 12 tópicos com custos)
- Ícaro (Pardinho, 16 tópicos com custos)
- Alexandre/Igor (RK, 10 tópicos com custos)
- Gabriel/Vinicius (Sala Técnica, 3 tópicos sem custos)
- Junior/Valdeans/Veronica (Planejamento, 3 tópicos sem custos)
- José Márcio (Produção, 7 tópicos com ocorrências)
- Diretores: Felipe, Renato, LF, Fabrizzio, João, Buruca, Thalita

**Fixes aplicados:**
- `responder()` retorna `{ok, err}` (antes retornava undefined → TypeError no loop)
- `try-catch` global restaurado (tinha sumido ao reverter baseline)
- Regex `cmdMatch` aceita mensagens multi-linha (`[\s\S]*`)
- Parser de resposta aceita `\n` E `|` como separador
- `project_id` (não `projeto_id`) no payload do Supabase
- Removidos `fotos:[]` e `turno:'Diurno'` (colunas inexistentes → 400)
- IA desligada (fallback gestor → silêncio)

### 4. Frontend
- `projectContext.ts`: 4 projetos com UUIDs reais (sincronizados com Router)
- `rdoStore.ts`: `loadFromSupabase()` lê rdos + gera financialEntries
- `RdoPage`: auto-refresh 30s via useEffect
- `useSupabaseDre.ts`: remove hack demo-1, usa UUID real, auto-refresh 30s

### 5. Supabase (executado via SQL Editor)
**Tabela `rdos` — 10 colunas adicionadas:**
producao_m, equipe_number, observacoes, apontador, latitude, longitude, custo_diesel, custo_alimentacao, custo_mao_obra, custo_materiais

**5 projetos criados:**
| UUID | Nome | Responsável |
|---|---|---|
| `2a28beec-b1f8-4b0c-8416-d0710bb35d9d` | ConstruData Brasilia | Joao |
| `f3c6645b-347f-4382-b9c5-d103c27ec511` | Osasco - Rua Cuiaba | Mateus Santos |
| `ec112c9a-1669-4287-8079-526d6940ce82` | Pardinho - Itapetininga | Icaro |
| `abe7f66c-004b-4bb5-a245-6be67debd9f7` | Consorcio Se Liga na Rede | Fabrizzio |
| `d4e5f6a7-b8c9-4d0e-a1f2-b3c4d5e6f7a8` | RK Sub Empreita | Alexandre/Igor |

**15 contatos cadastrados** na tabela `contatos` com projeto_id correto.

**Policies:** anon insert/select em rdos e contatos.

### 6. Consolidação n8n (10 → 8 workflows)
- Desativados: `webhook-rdo-whatsapp` + `cobranca-matinal-diretor`
- Mantidos: 4 `gestao-*-dashboard` (têm email HTML + endpoints Vercel únicos)

### 7. Obsidian
- `Equipe-Completa.md` reescrito com 4 projetos separados
- `Consorcio-SeLigaNaRede.md` criado
- `Diretoria-ConstruData.md` criado
- `NOVA-NS-v5-Motores.md` criado

## Fluxo ponta a ponta (WhatsApp → Dashboard)
```
Diretor: @rdo osasco
  → Router envia formulário p/ Mateus (12 tópicos)
Mateus: 1: Capex Norte | 2: 15 | 3: 120 | ... | 9: 250 | 10: 180 | 11: 1800 | 12: 50
  → Router parseia
  → Grava em Supabase: rdos (project_id UUID Osasco) + lancamentos_financeiros (4 custos)
  → Responde: "✅ RDO recebido! 💾 Gravado. 💰 4 custo(s) no DRE."
  → /app/rdo atualiza em 30s
  → /app/dre-financeiro atualiza em 30s
```

## Pendências / Próximos passos
1. **Merge PR #5** no main quando estiver satisfeito
2. **Vercel deploy** acontece automaticamente no push ao main
3. **Testar @rdo ponta a ponta** com engenheiro real respondendo e verificar se aparece no dashboard
4. **Página /app/relatorio360** ainda usa dados mockados (não conectada ao Supabase)
5. **RDO enviado por sub-workflows antigos** (gestao-pardinho-rdo-dashboard etc) NÃO grava no Supabase — só o que passa pelo Router novo grava. Se quiser migrar, precisa adicionar salvarSupabase nos sub-workflows
6. **Valdeans DDD 99** — confirmar se o número está correto (formato BR 13 dígitos OK mas DDD 99 existe?)

## Arquivos modificados (já commitados)
```
frontend/src/store/rdoStore.ts
frontend/src/store/projectContext.ts
frontend/src/features/rdo/index.tsx
frontend/src/lib/useSupabaseDre.ts
frontend/src/features/dre-financeiro/index.tsx
frontend/src/features/gestao-360/index.tsx
frontend/src/features/relatorio360/components/ReportHeader.tsx
frontend/src/store/relatorio360Store.ts
frontend/src/components/layout/AppLayout.tsx
frontend/src/components/shared/StatCard.tsx
workflows/.../gestao-whatsapp-router.workflow.ts
workflows/.../gestao-osasco-rdo-dashboard.workflow.ts
workflows/.../gestao-pardinho-rdo-dashboard.workflow.ts
workflows/.../webhook-rdo-whatsapp.workflow.ts
workflows/.../cobranca-matinal-diretor.workflow.ts
workflows/.../n8n-workflows.d.ts
workflows/.../.n8n-state.json
whatsapp-motor/index.js
ler_dxf_gdal.py
ler_dwg_universal.py
gerar_civil3d.py
construdata_pipeline.py
leitores/ler_dxf_gdal.py
leitores/ler_dwg_universal.py
geradores/gerar_civil3d.py
motores/construdata_pipeline.py
```

## Credenciais usadas (já estavam no repo)
- Supabase URL: `https://vblfdikfobsirwpdnybw.supabase.co`
- Evolution API: `https://evolution-api-production-b130.up.railway.app`
- n8n Railway: `https://n8n-production-ae317.up.railway.app`
- Workflow ID Router: `CJRFUtzbL3pGpb4s`
