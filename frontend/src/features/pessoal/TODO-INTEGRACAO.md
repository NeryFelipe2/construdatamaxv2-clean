# TODO — Integração do módulo Pessoal (para o orquestrador)

O módulo `features/pessoal` está pronto e compila, mas **de propósito não toca**
`App.tsx`, `navigation.ts` nem `mao-de-obra` (outras frentes estavam nesses
arquivos). Falta o orquestrador fazer:

1. **Registrar a rota `/app/pessoal`**
   - Em `frontend/src/App.tsx`, no bloco de lazy imports:
     ```ts
     const PessoalPage = lazy(() => import("@/features/pessoal/index").then((m) => ({ default: m.PessoalPage })));
     ```
     e a `<Route path="pessoal" element={<PessoalPage />} />` junto das demais.
   - Adicionar o item no menu (`navigation.ts` / sidebar) apontando pra
     `/app/pessoal` (ícone sugerido: `Users`).

2. **Apontar a aba "Funcionários" do módulo mao-de-obra para o cadastro único**
   - Substituir o conteúdo da aba Funcionários de
     `frontend/src/features/mao-de-obra/**` pelo
     `FuncionariosListPanel` (`@/features/pessoal/components/FuncionariosListPanel`),
     passando `pessoal={usePessoas()}`, `equipes` (de `useEquipes().equipes`) e os
     callbacks `onNovo`/`onEditar` abrindo o `PessoaDrawer`.

3. **Deploy da Edge Function**
   ```sh
   supabase functions deploy importar-funcionarios --no-verify-jwt
   ```
   (pré-requisito: migrations `20260825_020/021/022` coladas no banco — sem
   elas a função responde 400 e a UI mostra o aviso de migrations pendentes.)

4. **Setar IMPORT_SECRET**
   ```sh
   supabase secrets set IMPORT_SECRET="<segredo forte>"
   ```
   Sem o secret a função aceita qualquer chamada (modo aberto de primeiro
   deploy — documentado em `supabase/functions/importar-funcionarios/README.md`).
   O mesmo valor é digitado no campo "senha de importação" do modal de import.

## O que já funciona sem nada disso

- `NovoRdoPanel` (RDO): a seção Mão de Obra já tem a lista nominal — com as
  migrations aplicadas grava `rdo_presenca`; sem elas, degrada pro fluxo
  antigo (contadores + chips) sem erro.
- `usePessoas` / telas do módulo: com tabelas ausentes mostram o aviso
  "migrations de pessoal ainda não aplicadas" e estado vazio (nunca quebram).
