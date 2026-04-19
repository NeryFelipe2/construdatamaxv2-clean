# Handoff — Gestão WhatsApp Router (n8n)

**Data:** 2026-04-08
**Workflow ID:** `CJRFUtzbL3pGpb4s`
**Arquivo fonte:** `workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts`
**Instância n8n:** `https://n8n-production-ae317.up.railway.app` (Personal · Felipe Nery)
**Deploy:** `npx n8nac push workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts`

---

## Visão geral

Workflow n8n com 4 nodes (Webhook → Code → If → HTTP) que recebe eventos `messages.upsert` da Evolution API (instância `construdata-felipe`), interpreta a mensagem do WhatsApp dentro do node **Parse Evento Whatsapp** (JS embutido), e:

1. Envia respostas/menus diretamente via Evolution API (`POST /message/sendText/construdata-felipe`).
2. Roteia respostas de RDO para sub-workflows específicos (Pardinho, Osasco, Sala Técnica).
3. Suporta comandos `@xxx` e atalhos numéricos.
4. Usa Groq (Llama-3) como assistente IA e como gerador de mensagens de erro amigáveis.

Toda a lógica relevante está dentro do `jsCode` do node Code — os outros nodes são canalização.

---

## Atores cadastrados

### Diretoria (`isDiretor: true`, `isGestor: true`)

| Nome | Telefone | pushName | Escopo `@tarefa todos` |
|---|---|---|---|
| Felipe Nery | `5561981846325` | Felipe | `todos` (todos engenheiros) |
| Renato RK | `5528999154319` | Renato | `pardinho`, `osasco`, `rk` |
| Luiz Fernando | `5537999425397` | Luiz Fernando | `pardinho`, `osasco`, `rk` |
| Fabrizzio | `5574999076534` | Fabrizzio | `sala_tecnica` |
| João | `5561999996252` | João | `brasilia` (sem engenheiros ainda) |

> **João virou diretor.** Ele NÃO preenche RDO. ConstruData Brasília é "projeto do ConstruData como um todo, não é obra".

> **Fabrizzio** recebe **cópia automática** sempre que outro diretor delega `@tarefa` (ele é gerente do consórcio Se Liga na Rede e tem força de diretoria). Resumo enviado: quem delegou, pra quem foi, descrição.

### Engenheiros de obra (preenchem RDO)

| Nome | Telefone | Projeto | Tag interna |
|---|---|---|---|
| Ícaro | `5537998268576` | Pardinho - Itapetininga | `pardinho` |
| Mateus | `5561991015639` | Osasco - Rua Cuiabá | `osasco` |

Cada um tem perguntas numeradas (RDO). Sub-workflows respectivos:
- `https://n8n-production-ae317.up.railway.app/webhook/construdata-rdo-pardinho`
- `https://n8n-production-ae317.up.railway.app/webhook/construdata-rdo-osasco`

### Sala Técnica (Consórcio Se Liga na Rede — formato livre, NÃO é RDO)

| Nome | Telefone | Tag |
|---|---|---|
| Gabriel | `5513991995918` | `sala_tecnica` |
| Vinicius | `5513978216285` | `sala_tecnica` |
| Thalita | `5511919803270` | `sala_tecnica` (gestora) |

Eles preenchem **"Atividades do Dia"** com 3 campos livres:
1. Atividades realizadas hoje
2. Pendências / impedimentos
3. Próximos passos (amanhã)

Sub-workflow: `https://n8n-production-ae317.up.railway.app/webhook/construdata-rdo-sala-tecnica` — **PENDENTE ajustar pra aceitar formato livre** (deixado pra depois conforme decisão do dono).

### Removidos

- **Buruca** (`999220853`) — apagado a pedido.
- **Sub-workflow `construdata-rdo-joao`** — desabilitado conceitualmente (rota removida do roteamento), mas o sub-workflow ainda existe no n8n (não deletado).

---

## Comandos/atalhos suportados

### Para qualquer usuário cadastrado
- `menu`, `oi`, `bom dia`, `help`, `ajuda`, `start`, `comandos` → renderiza menu (gestor ou operacional)
- Atalho **M** → menu (operacional)
- Atalho **S** → status do RDO

### Diretoria (`isGestor`)
| Atalho | Comando equivalente | Função |
|---|---|---|
| `1` | `@status` | Status RDO Hoje |
| `2` | `@equipe` | Lista Diretoria/Engenheiros/Sala Técnica com telefones |
| `3` | `@projetos` | Lista projetos ativos |
| `4` | `@dashboard` | Link do dashboard consolidado |
| `5` | `@reenviar todos` | Cobra RDO de todos engenheiros (Ícaro, Mateus, Gabriel, Vinicius) |
| `6` | `@ia` | Abre assistente IA |

### Comandos `@`
- `@status [pardinho|osasco|brasilia|sala|todos]`
- `@reenviar <todos|pardinho|osasco|sala>`
- `@avisar <projeto> <mensagem>` — broadcast para a equipe do projeto
- `@tarefa <nome|todos> <descrição>` — **só diretores** (`isDiretor`). Filtra por escopo:
  - Felipe → todos os 4 engenheiros
  - Renato/Luiz Fernando → Ícaro + Mateus (RK pendente)
  - Fabrizzio → Gabriel + Vinicius
  - João → ninguém ainda (escopo `brasilia`, sem engenheiros)
  - Cópia automática pro Fabrizzio quando outro diretor delega.
- `@ia <pergunta>` — chama Groq

### Engenheiros (operacional)
- Digite **só o número** (ex: `1`) → bot pergunta o valor desse tópico
- Resposta direta: `1: 50` ou multilinha:
  ```
  1: 50
  2: 12
  3: 200m
  ```
- Pipe também aceito: `1: 50 | 2: ok | 3: 200m`
- Vira tag-lines (ex: `frente_capex: 50\nefetivo: 12\n...`) e segue pro sub-workflow do projeto via `targetWebhook`.

---

## Bugs corrigidos hoje (cronologia)

1. **Code node não executava nada** — `jsCode` tinha SyntaxError em duas linhas:
   - String com newline literal dentro de aspas simples (`'🤖 *Assistente IA:*\n\n'` mas com newline real).
   - `} else {` aberto sem fechar `}` antes do `return` final do bloco RDO.
2. **Atalhos numéricos `1-6` do gestor** quebravam — handlers liam `cmdMatch[2]` (null quando vinha de atalho numérico) → TypeError silencioso. Trocado para `finalCmdMatch[2]` em `status`, `reenviar`, `avisar`, `tarefa`, `ia`.
3. **`responder()` engolia erros** — `catch (e) {}` sem retorno fazia o `5` sempre dizer "✅ Cobrança reenviada" mesmo com falha da Evolution. Agora retorna `{ok, target, err}` e o `@reenviar` reporta OK/Falha por número.
4. **`5` só mandava pra Pardinho** — era hardcode de teste. Agora `alvo='todos'` dispara pros 5 engenheiros (filtrado por escopo do diretor).
5. **`@lid` opaco do WhatsApp moderno** — Gabriel mandou `menu` e o `remoteJid` veio como `268285350260752@lid` (Linked ID, sem número real). Código stripava só `@s.whatsapp.net` → `phone` ficava `@lid` literal → `proj=null` → menu não respondia. **Fix:** quando `phone.includes('@')`, fallback resolve por `pushName` (mapeamento Gabriel/Vinicius/Ícaro/Mateus/João/Felipe/Fabrizzio/Luiz Fernando/Renato/Thalita).
6. **Resposta multilinha do Mateus travou** — parser usava `split('|')` único, então `2: 12\n3: 0\n4: 0\n...` virava 1 string só e regex `(.+)` não pegava `\n`. **Fix:** `split(/[|\n]/)` + flag `m` no regex.
7. **Renomeação** — "ConstruData Santos" virou "ConstruData Brasília" em todo lugar (menu/equipe/projetos/status/comandos). `@reenviar brasil` ou `santos` ainda funcionam (compat).
8. **Mensagens de erro com IA** — todas as mensagens `❌ Comando inválido / sintaxe incorreta` foram trocadas por chamadas a `explicarErroGroq()` que pede pro Llama-3 explicar o erro em 2-4 linhas em linguagem amigável. Aplicado em: `@cmd` desconhecido, `@tarefa` sem args/alvo inválido, `@avisar` sem args/alvo inválido, `@reenviar` alvo inválido.

---

## ⚠️ Pendências / problemas conhecidos

### 🔴 CRÍTICO — modelo Groq descontinuado
O código usa `model: 'llama3-8b-8192'` em `perguntarGroq()`, que **a Groq descontinuou em janeiro/2026**. Resultado: `Request failed with status code 400`. Já apareceu uma vez em produção quando usuário testou `@ia`. Como **agora as mensagens de erro também passam por Groq**, qualquer comando inválido vai retornar `❌ Erro na integração da IA` em vez da explicação amigável.

**Fix sugerido:** trocar para `llama-3.1-8b-instant` (rápido, barato) ou `llama-3.3-70b-versatile` (mais esperto). Linha ~250 do `jsCode`. Não foi trocado ainda porque o dono não confirmou qual modelo prefere.

### 🟡 RK (Morro do Tetéu)
Renato e Luiz Fernando têm `'rk'` no escopo, mas **não há engenheiro cadastrado em `TODOS_ENG` com `proj: 'rk'`**. Quando o engenheiro for definido, adicionar:
```js
{ nome: 'XXX', tel: '55XX9XXXXXXXX', proj: 'rk' }
```
no array `TODOS_ENG` dentro do handler `cmd === 'tarefa'`. Cadastrar também em `projetoDoPhone()` se ele for preencher RDO.

### 🟡 Sala Técnica — sub-workflow ainda em formato RDO numerado
O dono pediu pra deixar pra depois. Hoje Gabriel/Vinicius recebem menu com 3 perguntas livres (`atividades`, `pendencias`, `proximos`), mas o sub-workflow `construdata-rdo-sala-tecnica` ainda espera tags. Pode dar inconsistência quando eles responderem. **Próximo passo:** ajustar o sub-workflow para aceitar texto livre.

### 🟡 Sub-workflow `construdata-rdo-joao` órfão
Existe no n8n mas não tem mais rota apontando pra ele (João virou diretor). Deletar ou desativar quando for fazer faxina.

### 🟡 pushName fallback frágil
Se um diretor mudar o nome do WhatsApp ou tiver um nome composto que colida com outro (ex: "Luiz Felipe" colidiria com `felipe`), o roteamento quebra. Hoje a ordem dos `else if` evita as colisões conhecidas, mas é frágil. Idealmente migrar pra um campo mais estável (ex: usar Evolution API `findContact` pra resolver `@lid` → número real, ou exigir cadastro manual).

### 🟢 Diagnóstico TS preexistente
`Cannot find module '@n8n-as-code/transformer'` na linha 1 — é só o resolver de tipos do IDE, **não bloqueia o n8n**, ignorar.

---

## Arquitetura interna do `jsCode`

Ordem de execução dentro do node Code:

1. **Parse do payload** Evolution → extrai `phone`, `text`, `pushName`, `fromMe`.
2. **Fallback `@lid` → pushName** → resolve número real.
3. **Filtro `fromMe`** → ignora msgs do bot, exceto comandos explícitos do gestor.
4. **`projetoDoPhone(phone)`** → identifica `proj` (engenheiro/diretor/sala técnica).
5. **Detecção de saudação/ajuda** → manda menu e termina.
6. **Conversão de atalhos numéricos** (`1-6`, `s`, `m`) → transforma em `finalCmdMatch` no formato `[null, comando, args]`.
7. **Handler de comandos `@`** → `if/else if` gigante. Cada handler monta `resposta` e chama `responder()`. Erros chamam `explicarErroGroq()`.
8. **Modo "número solitário"** (engenheiro digita `1`) → bot pergunta o valor do tópico.
9. **Parser tag-lines** (`1: x | 2: y` ou multilinha) → converte pra `tag: valor` e segue pra rota de RDO.
10. **Roteamento de RDO** → `targetWebhook` por engenheiro, ou fallback IA pra gestor que mandou texto cru, ou mensagem genérica de "operação não associada".

O node retorna `{ ignorar: bool, phone, text, targetWebhook }`. O node **Ignorar?** filtra `ignorar=false` e o **Encaminhar para Sub-Workflow** faz POST pro `targetWebhook` com `{phone, message: text}`.

---

## Credenciais e endpoints

- **Evolution API base:** `https://evolution-api-production-b130.up.railway.app`
- **Instância:** `construdata-felipe`
- **API key Evolution:** `construdata2026` (header `apikey`) — ⚠️ **hardcoded no jsCode**, mover pra credential do n8n.
- **Groq API key:** `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` — ⚠️ **hardcoded**, mover pra credential também.
- **Webhook deste workflow:** `https://n8n-production-ae317.up.railway.app/webhook/evolution-router`
- **Dashboard externo:** `https://construdatamaxv2-clean.vercel.app`

---

## Como debugar uma execução

```bash
cd c:/Users/felip/Downloads/construdatamaxv2-clean
npx n8nac execution list --workflow-id CJRFUtzbL3pGpb4s --limit 15
npx n8nac execution get <ID> --include-data
```

O `--include-data` traz o payload bruto da Evolution + output de cada node. Foi assim que descobri o problema do `@lid`.

---

## Próximas tarefas sugeridas (em ordem de prioridade)

1. **Trocar modelo Groq** (`llama3-8b-8192` → `llama-3.1-8b-instant`). Bloqueador pra IA + mensagens de erro amigáveis funcionarem.
2. **Mover API keys pra credentials do n8n** (Evolution + Groq). Hoje tá tudo hardcoded no jsCode, qualquer um com acesso ao workflow vê.
3. **Cadastrar engenheiro RK** quando o dono confirmar.
4. **Ajustar sub-workflow `construdata-rdo-sala-tecnica`** para aceitar formato livre (3 campos: atividades, pendencias, proximos).
5. **Refatorar `jsCode`** — está com 400+ linhas inline, vai virar inferno. Idealmente quebrar em múltiplos Code nodes ou virar custom node.
6. **Substituir fallback pushName por resolução real do `@lid`** via Evolution API (`POST /chat/findContacts`), pra não depender de nome do WhatsApp.