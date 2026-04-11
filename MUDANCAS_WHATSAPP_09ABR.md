# Patch Notes: WhatsApp Router & Módulo de Gestão (09/04/2026)

## 🚨 Correção do Erro Crítico 500 no Router Central (Webhook)
- **Problema Encontrado**: O webhook do WhatsApp na Evolution API parou de funcionar e retornava erros internos (Silent 500 no n8n) inviabilizando o `@menu` e mensagens.
- **Causa Raiz**:
  - Configuração do Webhook no n8n estava como `responseMode: 'lastNode'`. Se a lógica ignorasse a mensagem (nó `If` não disparando nada), o fluxo acabava sem saída de dados e o n8n não conseguia responder ao Webhook HTTP.
  - Caracteres de escape em Expressões Regulares (`\w`, `\s`) estavam sendo engolidos na hora de dar o push (salvando como `w+` literais). Isso quebrava todos os comandos que passavam argumentos, como `@avisar` e `@tarefa`.
  - Novas linhas literais em JS quebrado (Mojibake).
- **Ação Tomada**:
  - Alterado `responseMode` do `Receber Evolution API` para `onReceived` (responde `200 OK` de imediato), resolvendo imediatamente os crashes de teste de Webhook.
  - O código do Javascript do nó "Parse Evento Whatsapp" foi totalmente envolvido num bloco universal de `try/catch` de segurança para blindar o router de qualquer exceção nativa do V8 no Railway.
  - Escapes de RegEx ajustados com blindagem dupla: `\\s+` e `\\w+`.

## 🤖 Refatoração da IA e Delegação de Tarefas (Router)
- **IA Restrita**: Como pedido, o comando `@ia` responde ao Felipe Nery *apenas* se a mensagem for remetida de do próprio admin (`fromMe`), para evitar interações não controladas por outras pessoas em outros canais.
- **Isolamento de Equipes na Delegação (`@tarefa`)**:
  - A permissão garante que **só Diretores** possam rodar comandos de tarefas.
  - Se um diretor enviar `@tarefa todos`, o escopo é **limitado rigorosamente ao polo dele**:
    - **Fabrizzio**: `Sala Técnica` (Não atinge Osasco ou Pardinho).
    - **Luiz Fernando**: `Osasco, Pardinho e RK`.
    - **Felipe Nery**: Tem acesso irrestrito ao escopo `todos`.
- A regra antiga de cruzamento que fazia a tarefa de um ir para o Fabrizzio foi anulada, blindando as referências nas arrays `destinos`.

## ⏰ TAREFAS OBRIGATÓRIAS (Lembrete Automático Matinal)
- **Desafio**: Diretores esquecem de enviar a ordem de tarefas.
- **Solução (Novo Fluxo Criado)**: N8N Workflow - `Cobrança Matinal — TAREFAS DIRETORES`.
- Foi criado e ativado um `Cron Job` rodando de Segunda a Sábado às **07:00 AM**.
- **Comportamento**: A Evolution API irá mandar um alerta da "Gestão 360" informando ativamente aos diretores (Luiz, Renato, Fabrizzio e Felipe) para lembrarem de usar o comando `@tarefa <engenheiro>` no WhatsApp para definir as métricas do dia.

## 🛠️ Status Operacional do Infraestrutura Backend (Verificado)
- **n8n e Conexão Railway**: Testes de Webhook simulados aprovados. As conexões ao HTTP Request e Supabase dentro do `responder` e do nó RDO não apresentam erros de formatação.
- Todas as rotas base (`CJRFUtzbL3pGpb4s`) e Cron Jobs (`Nt0wfvxFL7hAWWvU`) encontram-se **TRACKED e ACTIVATED**.

_Documentação técnica mantida para auditoria. Caso precise reverter o router, a lógica está protegida de problemas de encoding UTF-8._
