# Atualização do Bot de Gestão (WhatsApp)

## Resumo das Modificações Realizadas
O workflow do n8n `gestao-whatsapp-router.workflow.ts` (O "Router Central" do WhatsApp) foi atualizado para suportar os novos comandos de gestão solicitados e prover suporte completo aos 4 novos projetos recém-integrados na plataforma (Osasco, Pardinho, Sala Técnica e ConstruData Santos).

### Detalhamentos
1. **Comando `@status`**:
   - Antes: Entregava uma mensagem de placeholder incompleta indicando o projeto atual que foi consultado.
   - Depois: Foi atualizado para retornar as informações completas referentes às pendências de entrega de RDO em um painel consolidado. 
   - Exemplo: Comando `@status` e `@status sala` processam o segundo argumento e entregam os apontamentos com uma macrovisão.

2. **Comando `@equipe` e `@projetos`**:
   - Os diretórios gerais de contatos e escopos em andamento receberam atualizações de lógica e formatação rica, retornando a lista correta de frentes e contatos do grupo.

3. **Comando `@reenviar <projeto>` e `@avisar <projeto> <mensagem>`**:
   - Para suprir uma cobrança imediata da equipe, foram implementadas as lógicas robustas de iteração (for loops) repassando mensagens ou alertas para os telefones de destino.
   - `alvo.includes('pardinho')` -> Aciona Ícaro.
   - `alvo.includes('sala')` -> Aciona Gabriel e Vinicius.
   - `alvo.includes('santos')` -> Aciona João.
   - A função `responder()` foi alterada para transbordar a interface e permitir não apenas responder quem originou a mensagem, mas acionar outros membros via EvolutionAPI (`targetPhone`).

Essas adições já sofreram `push` dinâmico para a plataforma ferroviária (Railway n8n-production) garantindo o espelhamento da solução. Não é necessário armar ou recriar os testes.
