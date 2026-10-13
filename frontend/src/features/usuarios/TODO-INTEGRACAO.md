# TODO — Integração do módulo Usuários & Acessos (para o orquestrador)

`features/usuarios` está pronto e compila, mas **de propósito não toca**
`App.tsx` nem `config/navigation.ts` (o orquestrador registra a rota).

## 1. Rota em `frontend/src/App.tsx`

No bloco de lazy imports do topo:

```ts
const UsuariosPage = lazy(() => import("@/features/usuarios/index").then((m) => ({ default: m.UsuariosPage })));
```

E, junto das demais rotas de `<Route path="/app" element={<AdaptiveShell/>}>`:

```tsx
<Route path="usuarios" element={<LazyRoute><UsuariosPage /></LazyRoute>} />
```

(O componente também tem `export default`, então
`lazy(() => import("@/features/usuarios"))` funciona igual.)

## 2. Item de menu em `frontend/src/config/navigation.ts`

Import do ícone no topo:

```ts
import { ShieldCheck } from 'lucide-react'
```

Item no grupo de configuração/administração (sugestão: o mesmo grupo de
Ajustes/Sistema — é uma tela de administração, não de obra):

```ts
{ label: 'Usuários & Acessos', to: '/app/usuarios', icon: ShieldCheck },
```

A tela se protege sozinha: quem não é admin global nem owner/admin de alguma
organização vê o painel “você não tem permissão para gerenciar acessos”. Se
quiser esconder o item do menu para não-admins, o dado está em
`useAuthStore().profile?.is_global_admin` (o papel por organização exige
consultar `organization_members`, que é o que o `useUsuarios` faz).

## 3. Deploy da Edge Function (bloqueante para a tela funcionar)

```sh
supabase functions deploy admin-usuarios --no-verify-jwt
```

Enquanto ela não estiver no ar, a tela **não quebra**: mostra o aviso
“a função admin-usuarios ainda não está no ar” com o comando que falta, e as
listas ficam vazias com KPIs em “—”.

A função precisa da service_role nos secrets do projeto (ela cria usuário via
Admin API):

Não é preciso configurar a service_role à mão: o Supabase injeta
`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` em toda Edge
Function publicada. A CLI, aliás, **recusa** `supabase secrets set` com nomes
que comecem por `SUPABASE_`.

> `verify_jwt = false` é intencional: a função valida o JWT por conta própria
> (`auth.getUser(jwt)` + `profiles.is_global_admin` + `organization_members`),
> como está no contrato acordado.

## Contrato consumido (referência rápida)

`supabase.functions.invoke('admin-usuarios', { body })` — o invoke já anexa o
`Authorization: Bearer <jwt>` do usuário logado.

| acao | body | resposta usada pela tela |
|---|---|---|
| `listar` | `{}` | `{ ok, usuarios[], convites[] }` |
| `criar` | `{ email, nome?, orgId, role, isGlobalAdmin?, senhaTemporaria }` | `{ ok, jaExistia? }` |
| `convidar` | `{ email, nome?, orgId, role, isGlobalAdmin? }` | `{ ok }` |
| `papel` | `{ userId, orgId, role }` | `{ ok }` |
| `revogar` | `{ userId, orgId }` | `{ ok }` |
| `senha` | `{ userId, novaSenha }` | `{ ok }` |

Códigos que a tela interpreta: **404 / FunctionsFetchError** → “função não
deployada”; **401** → sessão expirada; **403** → sem permissão; qualquer outro
→ banner de erro com a mensagem do campo `erro`/`error`/`message` do corpo.

A tela aceita tanto camelCase (`orgId`, `isGlobalAdmin`, `ultimoLogin`) quanto
snake_case (`org_id`, `is_global_admin`, `last_sign_in_at`) nos objetos de
`usuarios[]` / `convites[]`, para não travar se a frente de backend variar.

## 4. Primeiro uso (o caso do João)

1. Felipe ou João faz login (ambos já estão em `global_admin_emails` → o trigger
   `handle_new_user_v2` os promove a owner de todas as orgs no primeiro acesso).
2. Abrir `/app/usuarios` → **Adicionar pessoa** → e-mail, empresa
   **WCR Saneamento**, papel **Membro**, “Criar conta agora”, botão **Gerar**
   para a senha, **Copiar e-mail e senha** e mandar por WhatsApp:
   - `williansrezende@wcrsaneamento.com.br` — Willian Rezende
   - `bruno.guimaraes@wcrsaneamento.com.br` — Bruno Guimarães
   - `sergio@wcrsaneamento.com.br` — Sérgio
3. A senha só aparece uma vez, na tela de confirmação — a UI avisa em dois
   pontos que a entrega é por fora (o sistema não manda e-mail).

## Arquivos desta frente

```
frontend/src/hooks/useUsuarios.ts
frontend/src/features/usuarios/index.tsx
frontend/src/features/usuarios/utils/senha.ts
frontend/src/features/usuarios/components/ui.ts
frontend/src/features/usuarios/components/UsuariosHeader.tsx
frontend/src/features/usuarios/components/AcessosPanel.tsx
frontend/src/features/usuarios/components/ConvitesPanel.tsx
frontend/src/features/usuarios/components/AdicionarPessoaModal.tsx
frontend/src/features/usuarios/components/RevogarAcessoModal.tsx
frontend/src/features/usuarios/components/RedefinirSenhaModal.tsx
frontend/src/features/usuarios/components/CampoSenha.tsx
frontend/src/features/usuarios/components/Avisos.tsx
```
