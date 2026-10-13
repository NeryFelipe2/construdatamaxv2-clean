# apontamento-webhook

Edge Function (Deno) que é o **cérebro do bot de WhatsApp da obra WCR**. Recebe o
webhook da Evolution API quando alguém manda mensagem no grupo **APONTAMENTO WCR**,
interpreta o apontamento com o **mesmo parser puro do frontend** (`parse.ts`, cópia
literal de `frontend/src/utils/parseApontamento.ts`), grava **RDO + atividades** no
Supabase e responde o **eco** no próprio grupo. Fecha o ciclo campo → sistema sem
ninguém colar nada.

## Arquivos

| arquivo | o quê |
|---|---|
| `index.ts` | handler completo (auth, roteamento, gravação, eco, conversas) |
| `parse.ts` | **cópia byte-a-byte** de `parseApontamento.ts` — TS puro, roda no Deno sem mudança. Não editar aqui; editar no frontend e recopiar. |
| `deno.json` | mapa de import do supabase-js |

> A função **NUNCA grava `medicao_itens`**. O trigger do banco
> `sync_rdo_to_medicao` gera a medição precificada a 60% sozinho quando
> `rdo_atividades.medicao_codigo` está preenchido. Nada de preço/código é
> inventado — tudo vem de `precos_contrato`.

## Variáveis de ambiente

Configure em **Supabase → Edge Functions → apontamento-webhook → Secrets**.

| env | obrigatória | descrição |
|---|---|---|
| `SUPABASE_URL` | injetada | URL do projeto (o Supabase injeta) |
| `SUPABASE_SERVICE_ROLE_KEY` | injetada | service role — **ignora RLS** (é o bot; o Supabase injeta) |
| `WEBHOOK_SECRET` | **sim** | segredo próprio do webhook. Sem ele → toda requisição responde `401`. |
| `EVOLUTION_URL` | não | base da Evolution API, ex.: `https://evo.seudominio.com`. **Sem ela, a função LOGA o eco em vez de enviar** (o RDO já foi gravado) — dá pra testar o webhook sem a Evolution no ar. |
| `EVOLUTION_KEY` | não | valor do header `apikey` da Evolution |
| `EVOLUTION_INSTANCE` | não | nome da instância, ex.: `wcr` |

## Deploy

`verify_jwt` **precisa ser `false`** (é webhook público, autenticado pelo segredo próprio):

```bash
supabase functions deploy apontamento-webhook --no-verify-jwt
```

Depois configure o webhook da Evolution API (evento `messages.upsert`) apontando para:

```
https://<PROJECT_REF>.supabase.co/functions/v1/apontamento-webhook?secret=<WEBHOOK_SECRET>
```

ou passando o segredo no header `x-webhook-secret: <WEBHOOK_SECRET>` (qualquer um dos dois).

## Formato do webhook (Evolution — `messages.upsert`)

```json
{
  "event": "messages.upsert",
  "instance": "wcr",
  "data": {
    "key": { "remoteJid": "12036xxxxx@g.us", "fromMe": false, "participant": "5511xxxx@s.whatsapp.net", "id": "3EB0..." },
    "pushName": "Ediel",
    "message": { "conversation": "APONTAMENTO 23/07..." }
  }
}
```

- Texto pode vir em `data.message.conversation` **ou** `data.message.extendedTextMessage.text`.
- `remoteJid` terminando em `@g.us` = grupo; `participant` = quem enviou dentro do grupo.
- **Ignorados** (respondem `200` sem fazer nada): `fromMe=true` (anti-loop crítico),
  grupo diferente de `bot_config.grupo_apontamento_jid`, mensagem sem texto.

## O que a função faz

1. **Auth** — header `x-webhook-secret` **ou** query `?secret=` = `WEBHOOK_SECRET`, senão `401`.
2. Lê `bot_config` (id=1). `ativo=false` → **kill switch** (responde `200` e para).
3. Extrai `{ grupoJid, autorJid, pushName, texto }` e aplica os filtros acima.
4. **Idempotência** — se já existe RDO com esse `data.key.id` em `payload.wa_msg_id`, ignora
   (a Evolution reenvia webhooks).
5. **Roteamento de intenção**:
   - Texto começa com **`APONTAMENTO`** (case/acento-insensível) → apontamento novo:
     - roda `parseApontamento(texto)`;
     - resolve o projeto pelo **núcleo** do parse (match no nome do projeto) ou pelo
       `bot_config.projeto_padrao_id`;
     - carrega o catálogo de `precos_contrato` da **região** do projeto (ano = ano da
       data do apontamento);
     - grava `rdos{status:'fechado', origem:'apontamento_tags'}` → `rdo_equipes` →
       `rdo_atividades` (itens em revisão entram como `TAG — REVISAR: motivo`, sem código);
     - para cada **LA/LE sem posição**, cria `apontamento_conversa(aguardando)` ligada à atividade;
     - monta e envia o **eco**: `✅ N itens · R$ X medido · ⚠️ M pra revisar` + as perguntas.
   - Não começa com `APONTAMENTO`, mas há **conversa aberta** (não resolvida, não expirada)
     do mesmo autor+grupo **e** a resposta casa uma posição (PA/TA/EIXO/TO/PO) →
     resolve: re-parsa a linha original com a posição anexada (reaproveita o parser),
     acha a descrição do contrato, atualiza `medicao_codigo/medicao_unidade` da atividade,
     marca a conversa `resolvido=true` e confirma no grupo (`✅ LA registrada como EIXO — R$ Y`).
     O trigger re-precifica.
   - Caso contrário → ignora (não responde ruído).
6. **Sempre responde `200`** rápido (menos o `401` de auth) — a Evolution reenvia em erro/timeout,
   e a idempotência evita duplicar.

### Anti-ruído nas respostas de posição

`EIXO`/`EX` são termos inequívocos de saneamento → aceitos direto. As siglas de 2 letras
(`PA/TA/TO/PO`) colidem com o português coloquial (“tá certo”, “tô/to indo”, “tá bom”), então
só valem quando a resposta é **essencialmente a posição** (tirando a sigla, dígitos, tag e
conectores, não sobra palavra de conteúdo). Assim conversa fiada no grupo não fecha uma
pergunta por engano.

## Estado no banco (já migrado — não recriar)

- `bot_config` (singleton id=1): `grupo_apontamento_jid`, `grupo_diretores_jid`, `projeto_padrao_id`, `ativo`.
- `apontamento_conversa`: `atividade_id`, `aguardando` (`posicao_la`|`posicao_le`|…),
  `pergunta`, `contexto` jsonb, `resolvido`, `expira_em` (default `now()+2h`).
