# Handoff — Commit & PR pendente

## Estado atual
- **Branch:** `claude/rdo-whatsapp-nts-motores`
- **Ultimo commit:** `8ce36345` — `feat(whatsapp+financeiro): router atualizado + painel controle financeiro`
- **PR existente:** https://github.com/NeryFelipe2/construdatamaxv2-clean/pull/5 (ja aberta, base = main)
- **Código commitado:** SIM, tudo que importa ja foi commitado e pushado

## Arquivos temporários na raiz (NÃO commitar)
Todos estes são scripts de debug/repair descartáveis:
```
extract.py, extract_test.js, financial_pdf.md
fix_menu.py, fix_newlines.py, fixer.py, inject.js
n8n_verify.js, patch_router.py
repair.js, repair2.js, repair_js.py, repair_python.py
repair_quotes.js, repair_quotes2.js, repair_quotes3.py, repair_ts.js
replace_return_string.js, router_bkp.ts
scripts/fix_mojibake.py, scripts/refactor_router.py
test_node*.js, test_wrapper*.js, trycatch.js
wrap.js, wrap_dummy.js, wrap_exact.js, wrap_felipe.js, wrap_n8nac.js
token raiwail.txt
```
PDFs `ConstruData — Plataforma de Engenharia de Saneamento*.pdf` também não commitar.

## O que PRECISA ser feito

### 1. Limpar temporários
```bash
rm -f extract.py extract_test.js financial_pdf.md fix_menu.py fix_newlines.py fixer.py inject.js n8n_verify.js patch_router.py repair.js repair2.js repair_js.py repair_python.py repair_quotes.js repair_quotes2.js repair_quotes3.py repair_ts.js replace_return_string.js router_bkp.ts trycatch.js wrap.js wrap_dummy.js wrap_exact.js wrap_felipe.js wrap_n8nac.js "token raiwail.txt"
rm -f test_node.js test_node_final.js test_node_fixed.js test_node_syntax.js test_wrapper.js test_wrapper_exact.js test_wrapper_felipe.js
rm -f scripts/fix_mojibake.py scripts/refactor_router.py
```

### 2. Deploy Vercel quebrando
O build do Vercel (GitHub trigger) continua falhando. Erros ja corrigidos:
- ✅ `tsc` removido do build script (agora é so `vite build`)
- ✅ `companySettingsStore.ts` commitado (era untracked)
- ❌ **Possivel proximo erro**: pode haver mais arquivos untracked importados por modulos. Rodar `cd frontend && npx vite build` localmente para verificar.

Se o build local passar, o deploy via `vercel --prod` (Vercel CLI) funciona mesmo quando o GitHub trigger falha.

### 3. Motor NS V5 — "Failed to fetch"
O frontend chama `https://construdatamaxv2-clean.onrender.com` (Render). Backend esta OK (health 200). O "Failed to fetch" aparece porque:
- `VITE_API_URL` so esta definido em `.env.local` (não vai pro Vercel)
- Precisa setar `VITE_API_URL=https://construdatamaxv2-clean.onrender.com` como **Environment Variable** no painel do Vercel (Project Settings > Environment Variables)

### 4. Funcionalidades pedidas pelo usuario (ainda nao implementadas)
O usuario pediu novas telas/painéis:
- Resultado economico e fluxo de caixa
- Projeto / planejamento / execução
- DRE (Demonstrativo de Resultado do Exercício)
- Resposta sobre eficiencia e garantia de custo por trecho

Essas funcionalidades ainda NÃO foram implementadas. O `ControleFinanceiroPanel.tsx` foi commitado mas precisa ser integrado no router/sidebar.

## Resumo dos commits no PR #5 (8 commits)
1. `c607a181` — feat(motores+rdo+router): NTS whitelist, Dynamo Civil3D, RDO WhatsApp parser
2. `34b83a0d` — feat(router+n8n): menu 13-16, Renato escopo, consolidação workflows
3. `1d379559` — fix(router): resolverProjectId mapeia Consórcio
4. `818e88fc` — fix(router)!: fail-safe contra vazamento entre projetos
5. `f79fd4e2` — feat(whatsapp+frontend): grava RDO no Supabase + pagina RDOs Live
6. `9eb46196` — feat(rdo+dre+router): fluxo WhatsApp completo para RDO e DRE
7. `2a93373c` — feat(router): menu 1-16, handlers reais, confidencialidade, ocorrências
8. `8ce36345` — feat(whatsapp+financeiro): router atualizado + painel controle financeiro
