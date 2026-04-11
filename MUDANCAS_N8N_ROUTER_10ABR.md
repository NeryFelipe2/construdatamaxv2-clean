# RESUMO DA REFATORAÇÃO: GESTÃO WHATSAPP ROUTER (n8n)

## 📌 Contexto
A automação de WhatsApp via n8n sofreu uma refatoração massiva para mitigar erros relacionados à corrupção de caracteres (mojibake) e garantir operação limpa para os novos projetos, bem como proteção da segurança de integração via chaves API.

## 🛠️ Mudanças Críticas Realizadas
1. **Limpeza de Mojibake (UTF-8) 🧹**:
   - Os caracteres como `Ã§` ou `Ã©` espalhados pelo arquivo `.workflow.ts` (decorrente de salvar o arquivo N8N no Windows) foram convertidos de volta para seus devidos tokens nativos em um processo global. 
   - Foi construída a ferramenta em Python `n8n_sync.py` para extrair, expurgar o código JS e o reinjetar com total proteção de encoding.

2. **Segurança e Variáveis de Ambiente (Credentials) 🔒**:
   - A chave original hardcoded de Supabase (`eyJhbGciOiJIUz...`) foi substituída por `$env.get('SUPABASE_KEY')`.
   - A chave do Evolution (`construdata2026`) virou `$env.get('EVOLUTION_API_KEY')`.
   - A chave do Groq model (Llama) foi configurada para utilizar `$env.get('GROQ_API_KEY')`.
   > ⚠️ **Ação Necessária (Felipe / DevOps):** É obrigatório ir no painel do N8N na Railway (nas variáveis de ambiente ou secrets) e garantir que as chaves acimas constem atribuídas, caso o $env seja negado pelo run-mode.

3. **Inclusão da RK Sub Empreita (SANTOS) 🏗️**:
   - Foi adicionado explicitamente em `projetoDoPhone` os telefones do Alexandre e Igor (DDD 31 99889-4664) de forma definitiva. Eles já podem preencher o report diário via WhatsApp com as 8 rubricas essenciais, incluindo custo diário para ser guardado em Supabase.

4. **Expansão da Sala Técnica e RDO Formato Livre 💬**:
   - Os números da equipe completa (Junior, Valdeans, Veronica, Jose Marcio) foram adicionados junto com Gabriel e Vinicius como equipe Sala Técnica.
   - Uma modificação lógica poderosa foi aplicada: `const isFormatoLivre = proj.isSalaTecnica && !/^\s*\d+\s*[:=]/m.test(trimmed);`. Agora, se um membro dessa equipe digitar texto livre que não respeite o formato "1: XXX", o texto será aceito pelo roteador com a tag unificada de `atividades`, permitindo enviar parágrafos livres!

## 🛡️ Estabilidade do Router
- O formato do arquivo Typescript (workflow string limits) foi preservado sem corromper a estrutura original em JSON do `n8n`.
- Os try-catch blocks continuam agindo normalmente no `patch_router`.

_Qualquer alteração futura em `jsCode` é aconselhada ser feita modificando primeiro o `src/n8n_whatsapp_router/router.js` diretamente com seu editor, e usando o `python scripts/n8n_sync.py inject` em seguida, isolando a zona de perigo._
