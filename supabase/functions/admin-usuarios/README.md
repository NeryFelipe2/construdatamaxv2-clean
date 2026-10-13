# admin-usuarios

Edge Function que cria contas, vincula gente às organizações, troca papel,
revoga acesso e reseta senha. É a **única porta de gestão de contas** do
ConstruData — a tela de Usuários do app fala só com ela.

Existe porque hoje só dá pra criar usuário pelo Dashboard do Supabase, e um
usuário **não-global** criado na mão nasce sem nenhuma linha em
`organization_members`: ao logar ele cai na tela *"sua conta não está vinculada
a nenhuma empresa"* e trava. Aqui conta + vínculo + papel saem numa chamada só.

## Contrato

`POST /functions/v1/admin-usuarios`, JSON, `verify_jwt = false`
(a autenticação é feita **dentro** da função).

Header obrigatório:

```
Authorization: Bearer <access_token do usuário logado>
```

Todas as respostas são JSON `{ ok: boolean, ... }`. Erros trazem `error` com
mensagem em português. CORS liberado (`POST, OPTIONS`; `OPTIONS` → 204).

| `acao`     | corpo                                                                  | efeito |
|------------|------------------------------------------------------------------------|--------|
| `listar`   | `{}`                                                                   | panorama de usuários + convites pendentes |
| `criar`    | `{ email, nome?, orgId, role, isGlobalAdmin?, senhaTemporaria }`       | cria a conta **já confirmada** + o vínculo |
| `convidar` | `{ email, nome?, orgId, role, isGlobalAdmin? }`                        | só registra a autorização prévia |
| `papel`    | `{ userId, orgId, role }`                                              | altera o papel na organização (e reativa o vínculo) |
| `revogar`  | `{ userId, orgId }`                                                    | `ativo = false` no vínculo — **nunca apaga o usuário** |
| `senha`    | `{ userId, novaSenha }`                                                | reset administrativo de senha |

`role` ∈ `owner | admin | gestor | membro | leitor` (enum `public.org_role`).

### `listar`

```jsonc
{
  "ok": true,
  "escopo": "global",            // ou "organizacao"
  "usuarios": [
    { "userId": "...", "email": "...", "nome": "...", "isGlobalAdmin": false,
      "ativo": true, "ultimoLogin": "2026-08-25T12:00:00Z", "criadoEm": "...",
      "orgs": [ { "orgId": "...", "orgNome": "WCR Saneamento", "role": "membro", "ativo": true } ] }
  ],
  "convites": [
    { "email": "...", "nome": "...", "orgId": "...", "orgNome": "WCR Saneamento",
      "role": "membro", "isGlobalAdmin": false, "criadoEm": "..." }
  ]
}
```

Admin global vê todo mundo. Admin de organização vê **só** quem tem vínculo nas
orgs que ele administra — e desses, só os vínculos **dessas** orgs (não vaza em
que outras empresas a pessoa está).

### `criar`

- Usa a Admin API: `createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`.
  `email_confirm: true` de propósito: pessoal de obra não abre link de
  confirmação — a pessoa loga direto com a senha temporária.
- O trigger `on_auth_user_created_v2` cria o `profiles` sozinho; a função só
  garante a linha (rede pra conta antiga) e **não** mexe em `is_global_admin`
  sem pedido explícito.
- **E-mail que já existe não é erro**: devolve `{ ok: true, jaExistia: true }` e
  garante o vínculo. E **não troca a senha** de uma conta existente — trocar
  seria sequestro de conta disfarçado de "criar". Pra isso existe a ação
  `senha`, com as travas dela.
- Preenche `profiles.org_padrao_id` **se estiver vazio** (era a outra metade do
  problema: o trigger só define empresa padrão pra admin global, então o pessoal
  de obra nascia com `null`). Nunca sobrescreve uma escolha já feita.
- Registra também a linha em `convites_acesso` (com `usado_em` preenchido).

### `convidar`

Autorização prévia **sem criar conta**: quando a pessoa aparecer no Auth (magic
link, convite do Dashboard), o trigger aplica o vínculo sozinho.

Se a conta **já existe**, um convite não faria nada (o trigger só roda em
`INSERT`) — então o vínculo é aplicado na hora e a resposta traz
`aplicadoAgora: true`.

Com `isGlobalAdmin: true`, o e-mail também entra em `global_admin_emails` — é
exatamente de lá que o trigger lê pra promover a conta quando ela nascer.

## Segurança

Esta é a função mais perigosa do sistema. As travas:

1. **Dois clients, nunca trocados.** `sbAnon` (anon key) serve *só* pra validar
   o JWT via `auth.getUser(jwt)` — é o GoTrue que diz quem é a pessoa.
   `sbAdmin` (service_role) *só* executa o que já foi autorizado. Decidir
   permissão com service_role seria cego: com ele toda RLS é ignorada.
2. **Sem JWT válido → 401.** O `supabase-js` manda a *anon key* no
   `Authorization` quando não há sessão; esse caso é recusado explicitamente.
   Conta com `profiles.ativo = false` → 403.
3. **Autorização.** Admin global pode tudo. Quem não é global só age na org
   onde tem vínculo **ativo** como `owner`/`admin` — qualquer outra coisa é 403.
4. **Não-global nunca concede acesso global** (`isGlobalAdmin: true` → 403) e
   **nunca mexe na conta de um admin global** (papel/revogar/senha → 403).
5. **Só owner cria owner** (ou admin global).
6. **Antitranca.** Ninguém revoga nem rebaixa a si mesmo a ponto de perder a
   administração (409). Admin global é isento — o acesso dele não vem do
   vínculo.
7. **Último owner.** Não dá pra rebaixar/revogar o último `owner` ativo de uma
   organização (409) — org órfã só um admin global destrava.
8. **Validação.** E-mail por regex (normalizado pra minúsculas), UUIDs por
   regex, papel contra o enum, senha de 8 a 72 caracteres (o bcrypt do GoTrue
   trunca acima de 72 bytes — melhor recusar do que enganar).
9. **Nada de vazamento.** Senha, hash e service_role nunca aparecem em resposta
   nem em log. Erro de banco vai pro `console.error` da função; o cliente recebe
   uma mensagem curada (mensagem de Postgres entrega nome de tabela, coluna e
   constraint).

Só um detalhe fica de fora do modelo `profiles`: quando **não existe** linha em
`profiles` pro chamador (o trigger não rodou — conta anterior a ele), a função
cai na pré-aprovação `global_admin_emails`, que é a mesma fonte que o trigger
lê. Se o perfil existe, `profiles.is_global_admin` é soberano: quem foi
rebaixado de propósito continua rebaixado.

## Dependência: `convites_acesso`

A tabela vem da migration de outra frente (`email` PK, `org_id`, `role`,
`is_global_admin`, `nome`, `observacao`, `criado_por`, `criado_em`, `usado_em`).

**Degradação elegante** enquanto ela não existir:

- `criar` **continua funcionando** — a conta e o vínculo são criados de verdade;
  a resposta só ganha um `avisos: [...]` dizendo que o histórico de convite não
  foi gravado.
- `listar` devolve `convites: []` mais o aviso.
- `convidar` responde **503** com instrução clara (sem a tabela não sobra nada
  pra registrar; a saída é aplicar a migration ou usar `criar`). Se a tabela
  existe mas a gravação falha por outro motivo, responde **500** — nunca
  `ok: true`, porque em `convidar` a linha do convite *é* o produto.

A detecção é por código (`42P01` / `PGRST205`) ou pela mensagem de tabela
ausente — de propósito **não** casa `column ... does not exist`, que é schema
divergente e merece investigação, não degradação silenciosa.

O upsert é por `email` (PK): a autorização **mais recente** vence a anterior.

## Deploy

```sh
supabase functions deploy admin-usuarios --no-verify-jwt
```

`--no-verify-jwt` é obrigatório: a função faz a própria autenticação e precisa
poder responder 401/403 com mensagem útil (com `verify_jwt` ligado o gateway
recusa antes, com um erro genérico).

Variáveis usadas — todas injetadas automaticamente pelo runtime do Supabase,
**nenhum segredo novo**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`.

## Teste rápido (curl)

```sh
JWT="<access_token de um admin global>"
URL="https://vblfdikfobsirwpdnybw.supabase.co/functions/v1/admin-usuarios"

# panorama
curl -s -X POST "$URL" -H "Authorization: Bearer $JWT" \
  -H 'content-type: application/json' -d '{"acao":"listar"}'

# pessoal de obra da WCR (org 11111111-1111-4111-8111-111111111111)
curl -s -X POST "$URL" -H "Authorization: Bearer $JWT" \
  -H 'content-type: application/json' -d '{
    "acao":"criar",
    "email":"williansrezende@wcrsaneamento.com.br",
    "nome":"Willian Rezende",
    "orgId":"11111111-1111-4111-8111-111111111111",
    "role":"membro",
    "senhaTemporaria":"<senha forte, entregue pessoalmente>"
  }'

# sem token → 401
curl -s -X POST "$URL" -H 'content-type: application/json' -d '{"acao":"listar"}'
```

Repetir o mesmo `criar` deve responder `jaExistia: true` sem erro e sem mexer na
senha da pessoa.
