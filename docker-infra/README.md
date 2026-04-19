# 🐳 ConstruData — Docker Infrastructure

## Visão Rápida

Infraestrutura completa para rodar o ConstruData 24/7 gratuitamente no Oracle Cloud.

## Stack

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| **PostgreSQL** | 5432 | Banco de dados |
| **Redis** | 6379 | Cache/Fila |
| **n8n** | 5678 | Automações WhatsApp/RDO |
| **Evolution API** | 8080 | Integração WhatsApp |
| **Portainer** | 9000 | Gerenciador containers |
| **Chatwoot** | 3000 | Atendimento (opcional) |
| **Traefik** | 80/443 | Proxy reverso + SSL |

## Quick Start (Local - Windows)

```bash
# 1. Copiar e editar variáveis
copy .env.example .env
# Edite o .env com suas senhas

# 2. Subir tudo
docker compose up -d

# 3. Acessar
# n8n:        http://localhost:5678
# Evolution:  http://localhost:8080
# Portainer:  http://localhost:9000
```

## Deploy Produção (VPS)

Veja o guia completo: `GUIA_DOCKER_INFRA_RK.md`

## Estrutura

```
docker-infra/
├── .env.example          ← Template (copie como .env)
├── setup_vps.sh          ← Setup automatico da VPS
└── stacks/               ← Stacks individuais (Portainer)
    ├── traefik.yml
    ├── portainer.yml
    ├── postgres-redis.yml
    ├── n8n.yml
    ├── evolution.yml
    └── chatwoot.yml
```
