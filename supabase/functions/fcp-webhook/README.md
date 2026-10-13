# fcp-webhook — porta do n8n

Permite empurrar FCP e lançamentos de caixa direto da planilha do engenheiro.

## Autenticação
Header `x-webhook-token`. O token vive em `public.integracao_token` e pertence a
um usuário — é assim que o `audit_log` identifica **quem** mandou o dado, mesmo
vindo de integração.

```sql
insert into public.integracao_token (nome, token, user_id)
values ('n8n', 'wcr_' || encode(gen_random_bytes(24),'hex'),
        (select id from auth.users where email = 'felipe.nery2@gmail.com'));
```

## POST /functions/v1/fcp-webhook

### Lançamentos de caixa
```json
{
  "recurso": "caixa",
  "dryRun": true,
  "dados": { "lancamentos": [
    { "tipo": "DESPESA", "data": "05/08/2026", "descricao": "Diesel S10 munck",
      "valor": "1.250,50", "categoria": "Combustível", "obra": "BOI MALHADO",
      "forma_pagamento": "PIX", "status": "pendente", "anexo": null, "observacao": null }
  ]}
}
```
`data` aceita `dd/mm/aaaa`, `aaaa-mm-dd` e o período `01 A 10/08/2026`.
`valor` aceita número ou texto pt-BR (`1.250,50`).

### Produção realizada do FCP
```json
{
  "recurso": "fcp",
  "dryRun": false,
  "dados": { "semana_ref": "2026-08-24",
             "realizado": [ { "obra": "BERTIOGA", "semana": 3, "producao": 80 } ] }
}
```

## Resposta
Sempre o mesmo quadro do importador da tela:
```json
{ "ok": true, "dryRun": true,
  "resumo": { "NOVO": 3, "IGUAL": 1, "DIFERENTE": 1, "ERRO": 1 },
  "linhas": [ { "indice": 0, "veredicto": "DIFERENTE",
                "alteracoes": [{ "campo": "valor", "antes": 1250.5, "depois": 1400 }] } ],
  "categoriasNaoCadastradas": [],
  "gravado": { "criados": 3, "atualizados": 1, "ignorados": 1 } }
```

- **`dryRun: true` não grava nada** — serve para o n8n conferir antes de confirmar.
- Reenviar a mesma linha dá `IGUAL` e não duplica (chave: obra + data + descrição).
- Valor trocado dá `DIFERENTE` com antes → depois.
- FCP aprovado recusa alteração com **409**.
- Categoria desconhecida vira `ERRO` na linha e aparece em `categoriasNaoCadastradas`
  — a integração não inventa cadastro sozinha.

## Códigos
`401` token ausente/inválido · `409` FCP aprovado · `422` FCP/semana inexistente ·
`503` migration pendente
