# Status Integracao Total ConstruData - 2026-04-23

## Cadeia operacional

Objetivo:

`WhatsApp -> Evolution API -> n8n/CODEX 2.0 -> Supabase -> Render API -> Vercel Frontend -> Dashboards/Modulos`

Fonte principal: Supabase.

Render: fachada publica da plataforma.

Vercel: frontend.

n8n/CODEX 2.0: orquestracao de entrada, roteamento, cobranca, parsing e confirmacao.

## O que foi feito

- Supabase validado com tabelas canonicas:
  - `projetos`
  - `frentes`
  - `contatos`
  - `tarefas`
  - `rdos`
  - `rdo_equipes`
  - `rdo_atividades`
  - `rdo_materiais`
  - `rdo_equipamentos`
  - `rdo_mao_obra`
  - `rdo_ocorrencias`
  - `punch_list_items`
  - `lps_restricoes`
  - `whatsapp_logs`
  - `workflow_events`
- Render API criada/normalizada para:
  - `/api/health/integrations`
  - `/api/projetos`
  - `/api/projetos/{id}/dashboard`
  - `/api/projetos/{id}/rdos`
  - `/api/projetos/{id}/tarefas`
  - `/api/projetos/{id}/contatos`
  - `/api/projetos/{id}/torre`
  - `/api/projetos/{id}/gestao360`
  - `/api/projetos/{id}/lps-restricoes`
  - `/api/whatsapp/numeros`
  - `/api/whatsapp/send`
  - `/api/whatsapp/webhook`
- API ajustada para consolidar IDs duplicados de projetos sem apagar historico.
- Frontend ajustado para usar IDs reais/canonicos no contexto global.
- SQL de migracao atualizado para nao recriar placeholders de telefone nem IDs artificiais para Tatui/RK Sub.
- WhatsApp local testado pela Evolution em `localhost:8080`, instancia `construdata-felipe`, status `open`.

## Projetos canonicos

- Tatui - RK: `c2bf8fda-b2e0-4bc1-9535-4891d596ea10`
- Osasco: `f3c6645b-347f-4382-b9c5-d103c27ec511`
- Consorcio / SLNR: `abe7f66c-004b-4bb5-a245-6be67debd9f7`
- Pardinho: `ec112c9a-1669-4287-8079-526d6940ce82`
- Brasilia: `2a28beec-b1f8-4b0c-8416-d0710bb35d9d`
- RK Sub / RK Santos Empreita: `d4e5f6a7-b8c9-4d0e-a1f2-b3c4d5e6f7a8`

## Tarefas gravadas no Supabase

Total gravado pela integracao: 77 tarefas.

- Osasco / Mateus Santos: 22
- Tatui / Icaro Atila: 11
- RK Sub / Igor Max: 6
- Consorcio / SLNR: 36
- Brasilia / Joao: 2

## LPS / restricoes gravadas

Total gravado pela integracao: 6 restricoes.

- Osasco: 2
- Tatui: 1
- RK Sub: 2
- Consorcio / SLNR: 1

## Cobrancas enviadas no WhatsApp

Enviadas pela Evolution local e registradas em `whatsapp_logs`:

- Mateus Santos: `5561991015639` - status `sent`
- Icaro Atila: `5537998268576` - status `sent`
- Igor Max: `5531985898482` - status `sent`
- Joao: `5561999996252` - status `sent`

## Numeros cadastrados principais

- Felipe Nery: `5561981846325`
- Luiz Fernando: `5537999425397`
- Renato: `5528999154319`
- Mateus Santos: `5561991015639`
- Icaro Atila: `5537998268576`
- Igor Max / Igor Eng: `5531985898482`
- Joao: `5561999996252`
- Fabrizzio: `5574999076534`
- Junior: `5511986012223`
- Valdeans: `5599991392763`
- Gabriel: `5513991995918`
- Vinicius: `5513978216285`
- Veronica: `5513997733121`
- Jose Marcio: `5511941816005`
- Thalita: `5511919803270`

## Status atual

Funcionando:

- Supabase conectado.
- Tabelas principais existem e respondem.
- Tarefas no Supabase.
- LPS/restricoes no Supabase.
- Logs de WhatsApp no Supabase.
- Evolution local conectada e enviando mensagens.
- Build do frontend aprovado com `npm run build` em `frontend`.
- Commit enviado para GitHub em `main`.

Pendente:

- Render ainda estava servindo a versao anterior depois do push do commit `e5b3f286`.
- Render CLI local nao esta autenticado, entao o deploy nao foi disparado por CLI.
- Para WhatsApp em producao pelo Render, configurar variaveis publicas da Evolution:
  - `EVOLUTION_URL`
  - `EVOLUTION_INSTANCE`
  - `EVOLUTION_API_KEY` ou `AUTHENTICATION_API_KEY`
- `EVOLUTION_URL` nao pode ser `localhost` no Render; precisa ser a URL publica da Evolution em producao.

## Como validar depois do deploy Render

1. Abrir Render e rodar `Manual Deploy -> Deploy latest commit`.
2. Validar:
   - `https://construdatamaxv2-clean.onrender.com/api/health/integrations`
   - `https://construdatamaxv2-clean.onrender.com/api/projetos`
   - `https://construdatamaxv2-clean.onrender.com/api/whatsapp/numeros`
3. Esperado em `/api/projetos`: 6 projetos canonicos, sem duplicar Tatui/RK Sub.
4. Esperado em `/api/whatsapp/numeros`: numeros reais, sem placeholders `sem-telefone`.
5. Testar WhatsApp:
   - Enviar `menu`.
   - Receber menu completo.
   - Enviar RDO com `@rdo`.
   - Receber: `OK, RDO recebido e registrado no ConstruData.`
   - Confirmar novo registro em `rdos`.
   - Confirmar reflexo no RDO, Gestao 360, Torre de Controle e Dashboard.
