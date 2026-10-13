# 🤖 Guia — Ligar o bot do WhatsApp (Fase 6)

O **cérebro do bot já está no ar e testado** (Supabase Edge Function `apontamento-webhook`).
Falta só **plugar o cabo do WhatsApp**: subir a Evolution API, conectar um chip, e ligar 5 configs.
Tudo abaixo é do teu lado — leva ~1 hora e roda num servidor de ~US$6/mês.

---

## ✅ O que JÁ está pronto (não precisa mexer)

- **Edge Function** `apontamento-webhook` — deployada, status ACTIVE, URL:
  `https://vblfdikfobsirwpdnybw.supabase.co/functions/v1/apontamento-webhook`
- **Segurança testada**: sem o segredo certo, responde 401 (ninguém de fora grava nada).
- **Gravação testada de ponta**: apontamento do Ediel → RDO → medição R$ 9.013 + R$ 523,08 a 60%, LA sem posição pendente.
- **Idempotência testada**: reenvio da mesma mensagem NÃO gera medição dobrada (índice UNIQUE).
- **Kill switch**: o bot está **DESLIGADO** (`bot_config.ativo = false`) até você ligar no fim.

---

## 🔧 PASSO 1 — Chip dedicado (5 min)

- Use um **número novo, só do bot** (chip pré-pago barato). **NUNCA o teu número pessoal** — se o WhatsApp
  achar que é robô, banir esse número (não o teu).
- Adicione esse número ao grupo **APONTAMENTO WCR** (e depois ao **Planejamento WCR OBRAS**, pra Fase 7).

## 🖥️ PASSO 2 — Subir a Evolution API num VPS (~20 min, ~US$6/mês)

Contrate um VPS pequeno (Hetzner CX22, Contabo, DigitalOcean — 2GB RAM basta) com Docker. Depois:

```bash
# no servidor, crie uma pasta e este docker-compose.yml
mkdir evolution && cd evolution
cat > docker-compose.yml <<'YAML'
services:
  evolution:
    image: atendai/evolution-api:v2.1.1
    restart: always
    ports:
      - "8080:8080"
    environment:
      - AUTHENTICATION_API_KEY=TROQUE_POR_UMA_CHAVE_FORTE   # <- inventa uma senha longa
      - DATABASE_ENABLED=false
      - CACHE_REDIS_ENABLED=false
    volumes:
      - evolution_instances:/evolution/instances
volumes:
  evolution_instances:
YAML

docker compose up -d
```

- Anote a `AUTHENTICATION_API_KEY` que você inventou → é o **EVOLUTION_KEY**.
- A URL da Evolution é `http://SEU_IP:8080` → é o **EVOLUTION_URL** (idealmente coloque um domínio + HTTPS depois).

## 📱 PASSO 3 — Conectar o chip (5 min)

```bash
# cria uma instância chamada "wcr" (esse nome é o EVOLUTION_INSTANCE)
curl -X POST http://SEU_IP:8080/instance/create \
  -H "apikey: SUA_EVOLUTION_KEY" -H "content-type: application/json" \
  -d '{"instanceName":"wcr","integration":"WHATSAPP-BAILEYS","qrcode":true}'
```

- A resposta traz um **QR code** (ou pegue em `GET /instance/connect/wcr`).
- **Escaneie com o WhatsApp do chip do bot** (WhatsApp → Aparelhos conectados → Conectar aparelho).
- Pronto: o bot está logado.

## 🔑 PASSO 4 — Descobrir o JID dos grupos (2 min)

```bash
curl http://SEU_IP:8080/group/fetchAllGroups/wcr?getParticipants=false \
  -H "apikey: SUA_EVOLUTION_KEY"
```

- Ache o **APONTAMENTO WCR** na lista → copie o `id` dele (termina em `@g.us`).
- Ache o **Planejamento WCR OBRAS** → copie o `id` (guarde pra Fase 7).

## 🔗 PASSO 5 — Apontar o webhook da Evolution pra Edge Function (2 min)

```bash
curl -X POST http://SEU_IP:8080/webhook/set/wcr \
  -H "apikey: SUA_EVOLUTION_KEY" -H "content-type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "https://vblfdikfobsirwpdnybw.supabase.co/functions/v1/apontamento-webhook?secret=SEU_WEBHOOK_SECRET",
      "events": ["MESSAGES_UPSERT"]
    }
  }'
```

- Troque `SEU_WEBHOOK_SECRET` por uma senha longa que você inventa (a mesma vai no passo 6).

## ⚙️ PASSO 6 — Setar os 4 secrets na Edge Function (3 min)

No painel do Supabase → **Edge Functions → apontamento-webhook → Secrets** (ou `Settings → Edge Functions → Secrets`), adicione:

| Secret | Valor |
|---|---|
| `WEBHOOK_SECRET` | a mesma senha longa do passo 5 |
| `EVOLUTION_URL` | `http://SEU_IP:8080` (ou o domínio HTTPS) |
| `EVOLUTION_KEY` | a `AUTHENTICATION_API_KEY` do passo 2 |
| `EVOLUTION_INSTANCE` | `wcr` |

*(SUPABASE_URL e SERVICE_ROLE_KEY já são injetados automaticamente — não precisa.)*

## 🟢 PASSO 7 — Configurar o grupo e LIGAR o bot (1 min)

Rode este SQL no Supabase (SQL Editor), trocando o JID pelo do passo 4:

```sql
update bot_config set
  grupo_apontamento_jid = '120363XXXXXXXXX@g.us',   -- JID do APONTAMENTO WCR
  ativo = true                                        -- LIGA o bot
where id = 1;
```

---

## 🧪 PASSO 8 — Piloto de 1 semana (recomendado)

- Peça **só pra 1 encarregado (Ediel)** apontar pelo modelo de tags por 1 semana.
- Confira todo dia na tela de **Medição** se o que ele mandou bateu.
- O bot responde o eco no grupo — se ele errar algo, você ajusta o modelo antes de abrir pra todos.
- **Só depois** peça pra todos os encarregados usarem.

## 🛟 Se precisar DESLIGAR na hora
```sql
update bot_config set ativo = false where id = 1;   -- bot para de processar na hora
```

---

## Como funciona (resumo)
```
Encarregado no APONTAMENTO WCR: "APONTAMENTO 23/07 / EQUIPE EDIEL / LA 2 / REDE AGUA 63 100M / 3 CAIXA UMA"
   → Evolution dispara o webhook → Edge Function:
       • valida o segredo (senão 401)
       • roda o parser (o mesmo do site, testado contra 12 armadilhas)
       • grava RDO + medição a 60% (trigger no banco)
       • responde no grupo: "✅ 100m R$ 9.013 · 3 caixa R$ 523 · ⚠️ LA 2: qual posição? PA/TA/EIXO/TO/PO"
   → Encarregado responde "EIXO" → o bot fecha o preço da LA e confirma.
```
Nunca chuta: número de casa não vira quantidade, "obs:"/"faltou" não viram medição, dúvida → pendente pra revisar.
```
