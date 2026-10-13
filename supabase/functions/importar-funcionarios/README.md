# importar-funcionarios

Edge Function que importa a planilha de RH (módulo Pessoal) direto no cadastro
único (`pessoas`, `pessoa_apelidos`, `pessoa_remuneracao`), com service role.

É a **única porta de escrita de `pessoa_remuneracao`** — a tabela é fechada por
RLS (salário/CPF nunca ficam atrás da anon key do bundle).

## Contrato

`POST /functions/v1/importar-funcionarios` com JSON:

```json
{ "dryRun": true, "loteId": "<uuid>", "linhas": [ { "index": 0, "aba": "efetivos", "nomeCompleto": "...", ... } ] }
```

- `dryRun: true` → devolve, por linha, `{ index, match: { pessoaId, nome, regra } | null }`
  (regra `alias` = pessoa_apelidos revisado; `nome` = pessoas.nome_norm exato e único;
  homônimo → `null`, decisão humana no passo de conflitos).
- `dryRun: false` → commit. Cada linha carrega `acao: criar | atualizar | ignorar`
  (e `pessoaId` quando atualizar). Uma linha que falha entra em `erros[]` e o lote
  segue. Resposta: `{ criadas, atualizadas, ignoradas, erros[] }`.

Idempotência: pessoa com o mesmo `nome_norm` **e** `import_lote_id` do mesmo
lote já gravada → skip (repetir o POST do mesmo lote não duplica ninguém).

## Segurança (IMPORT_SECRET)

O header `x-import-secret` é comparado a `Deno.env.get('IMPORT_SECRET')`.

**Se `IMPORT_SECRET` NÃO estiver setado no ambiente, a função ACEITA qualquer
chamada** (modo aberto, pensado para o primeiro deploy em ambiente controlado).
Em produção, sete o segredo:

```sh
supabase secrets set IMPORT_SECRET="um-segredo-forte"
```

e informe o mesmo valor no campo "senha de importação" do modal de importação.

## Deploy

```sh
supabase functions deploy importar-funcionarios --no-verify-jwt
```

(`--no-verify-jwt` porque a autenticação é o segredo próprio, como no
`apontamento-webhook`; o frontend ainda envia `Authorization: Bearer <anon>`
por padrão, o que também funciona com verify_jwt ligado.)

## Pré-requisito

As migrations de pessoal `20260825_020/021/022` precisam estar aplicadas —
sem elas a função responde 400 com a mensagem de catálogo indisponível.
