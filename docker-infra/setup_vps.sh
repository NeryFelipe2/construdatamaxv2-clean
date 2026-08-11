#!/bin/bash
# ============================================================
# RK ENGENHARIA — SETUP VPS COMPLETO
# Oracle Cloud Free Tier (ARM) / Hetzner / Contabo
# ============================================================
# USO: curl -sSL https://raw.githubusercontent.com/... | bash
# OU:  chmod +x setup_vps.sh && ./setup_vps.sh
# ============================================================

set -e

echo "============================================================"
echo "  🏗️  RK ENGENHARIA — SETUP INFRAESTRUTURA DOCKER"
echo "============================================================"

# ---------- 1. ATUALIZAR SISTEMA ----------
echo ""
echo "1️⃣  Atualizando sistema..."
sudo apt-get update -y && sudo apt-get upgrade -y

# ---------- 2. INSTALAR DOCKER ----------
echo ""
echo "2️⃣  Instalando Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | bash
    sudo usermod -aG docker $USER
    echo "   ✅ Docker instalado com sucesso"
else
    echo "   ✅ Docker já instalado"
fi

# ---------- 3. INICIAR DOCKER SWARM ----------
echo ""
echo "3️⃣  Iniciando Docker Swarm..."
if ! docker info 2>/dev/null | grep -q "Swarm: active"; then
    docker swarm init
    echo "   ✅ Docker Swarm ativado"
else
    echo "   ✅ Docker Swarm já ativo"
fi

# ---------- 4. CRIAR REDES ----------
echo ""
echo "4️⃣  Criando redes overlay..."
docker network create --driver=overlay --attachable traefik_public 2>/dev/null || echo "   rede traefik_public já existe"
docker network create --driver=overlay --attachable rk_internal 2>/dev/null || echo "   rede rk_internal já existe"

# ---------- 5. CRIAR DIRETÓRIOS ----------
echo ""
echo "5️⃣  Criando diretórios de dados..."
sudo mkdir -p /opt/rk-infra/{postgres_data,redis_data,n8n_data,evolution_data,evolution_instances,portainer_data,traefik_data}
sudo chmod -R 777 /opt/rk-infra

# ---------- 6. DEPLOY TRAEFIK ----------
echo ""
echo "6️⃣  Fazendo deploy do Traefik..."
docker stack deploy -c /opt/rk-infra/stacks/traefik.yml traefik
echo "   ✅ Traefik deployado"

# ---------- 7. DEPLOY PORTAINER ----------
echo ""
echo "7️⃣  Fazendo deploy do Portainer..."
docker stack deploy -c /opt/rk-infra/stacks/portainer.yml portainer
echo "   ✅ Portainer deployado"

echo ""
echo "============================================================"
echo "  ✅ SETUP BASE CONCLUÍDO!"
echo "============================================================"
echo ""
echo "  📋 PRÓXIMOS PASSOS:"
echo "  1. Acesse o Portainer: https://portainer.SEU-DOMINIO"
echo "     (ou http://IP-DO-SERVIDOR:9000)"
echo "  2. Crie a senha de admin"
echo "  3. Deploy as stacks pelo Portainer:"
echo "     - postgres-redis.yml"
echo "     - n8n.yml"
echo "     - evolution.yml"
echo ""
echo "  📁 Stacks disponíveis em: /opt/rk-infra/stacks/"
echo "============================================================"
