# 🍌 NanoBanana × ConstruDataMax — Fluxogramas da Plataforma

> Apresentação visual da arquitetura e fluxos operacionais do ecossistema ConstruDataMax

---

## 1️⃣ Fluxo de Campo → Sistema

````carousel
![Fluxo Campo → Sistema](C:/Users/felip/.gemini/antigravity/brain/35d33702-2deb-4069-add9-27f0aa0abde2/fluxo_campo_sistema_1775395011501.png)
<!-- slide -->
```mermaid
flowchart LR
    A["👷 LÍDER CAMPO<br/>envia RDO via WhatsApp"] --> B["⚙️ MOTOR WHATSAPP<br/>detecta e parseia"]
    B --> C["☁️ SUPABASE<br/>armazena na nuvem"]
    C --> D["🖥️ PLATAFORMA<br/>atualiza KPIs"]
    D --> E["👔 DIRETORIA<br/>monitora de qualquer lugar"]

    style A fill:#065f46,stroke:#10b981,color:#fff
    style B fill:#1e1b4b,stroke:#818cf8,color:#fff
    style C fill:#064e3b,stroke:#34d399,color:#fff
    style D fill:#0c0a09,stroke:#f5f5f4,color:#fff
    style E fill:#78350f,stroke:#f59e0b,color:#fff
```
````

**Como funciona:** O líder de campo envia uma mensagem no WhatsApp com o padrão de RDO. O motor Node.js detecta automaticamente, parseia os dados (equipe, líder, localização, materiais), persiste no Supabase e no Obsidian, e a plataforma web atualiza em tempo real.

---

## 2️⃣ Despacho Tático de Tarefas

````carousel
![Despacho Tático](C:/Users/felip/.gemini/antigravity/brain/35d33702-2deb-4069-add9-27f0aa0abde2/fluxo_despacho_tarefas_1775395042203.png)
<!-- slide -->
```mermaid
flowchart TD
    A["🖥️ COORDENADOR<br/>clica AVISAR na plataforma"] --> B["⚙️ MOTOR<br/>busca contato no Supabase<br/>e dispara WhatsApp"]
    B --> C["📱 LÍDER<br/>recebe tarefa no celular<br/>e executa no campo"]
    C --> D["✅ SISTEMA<br/>recebe OK ou RDO completo"]
    D --> A

    style A fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style B fill:#3b1f5e,stroke:#a78bfa,color:#fff
    style C fill:#065f46,stroke:#10b981,color:#fff
    style D fill:#78350f,stroke:#f59e0b,color:#fff
```
````

**Loop Automático 24/7:** O coordenador designa tarefas pela plataforma → o motor dispara a notificação → o líder executa e responde → o sistema atualiza o status. Tudo sem intervenção manual.

---

## 3️⃣ Stack Tecnológica Integrada

````carousel
![Stack Tecnológica](C:/Users/felip/.gemini/antigravity/brain/35d33702-2deb-4069-add9-27f0aa0abde2/fluxo_stack_tecnologica_1775395071156.png)
<!-- slide -->
```mermaid
graph TD
    subgraph FRONTEND["🌐 FRONTEND — Vercel CDN"]
        F1["React + Vite"]
        F2["TypeScript"]
        F3["TailwindCSS"]
        F4["Dark/Light Theme"]
    end

    subgraph BACKEND["⚙️ BACKEND — Render Cloud"]
        B1["FastAPI (Python)<br/>Motor de Engenharia"]
        B2["Node.js + Express<br/>Motor WhatsApp"]
    end

    subgraph DATA["🗄️ DATA LAYER"]
        D1["Supabase PostgreSQL<br/>equipes, logs_rdo, workflow"]
        D2["Supabase Storage<br/>Fotos de Evidência"]
        D3["Obsidian Vault<br/>Caixa-Preta Local"]
    end

    FRONTEND --> BACKEND
    BACKEND --> DATA
    GIT["GitHub CI/CD"] -.->|"Auto-Deploy"| FRONTEND
    GIT -.->|"Auto-Deploy"| BACKEND

    style FRONTEND fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style BACKEND fill:#3b1f5e,stroke:#a78bfa,color:#fff
    style DATA fill:#064e3b,stroke:#34d399,color:#fff
```
````

| Camada | Tecnologia | Deploy |
|--------|-----------|--------|
| Frontend | React + Vite + TypeScript | **Vercel** (auto-deploy via GitHub) |
| Backend API | FastAPI (Python) | **Render** |
| Motor WhatsApp | Node.js + Express | **Render** (24/7) |
| Banco de Dados | PostgreSQL via Supabase | **Supabase Cloud** |
| Storage | Fotos/Evidências | **Supabase Storage** |
| Backup Local | Obsidian Vault | **PC Local** (caixa-preta) |

---

## 4️⃣ RDO Automático — Do WhatsApp ao Banco de Dados

````carousel
![RDO Automático](C:/Users/felip/.gemini/antigravity/brain/35d33702-2deb-4069-add9-27f0aa0abde2/fluxo_rdo_automatico_1775395100360.png)
<!-- slide -->
```mermaid
flowchart TD
    A["📱 WhatsApp recebe mensagem:<br/>'Equipe rede: esgoto<br/>Líder: Bruno<br/>Rua B: tubo 200mm, 6M'"] --> B["🧠 PARSER detecta:<br/>✓ Equipe<br/>✓ Líder<br/>✓ Localização<br/>✓ Material"]
    B --> C["☁️ SUPABASE<br/>INSERT logs_rdo<br/>com timestamp"]
    B --> D["📂 OBSIDIAN<br/>append no .md<br/>caixa-preta imutável"]
    B --> E["📸 STORAGE<br/>fotos armazenadas"]
    C & D & E --> F["🖥️ RDO DIGITAL<br/>disponível na plataforma"]

    style A fill:#075985,stroke:#38bdf8,color:#fff
    style B fill:#7c2d12,stroke:#fb923c,color:#fff
    style C fill:#064e3b,stroke:#34d399,color:#fff
    style D fill:#3f3f46,stroke:#a1a1aa,color:#fff
    style E fill:#4a1d96,stroke:#a78bfa,color:#fff
    style F fill:#0c0a09,stroke:#f5f5f4,color:#fff
```
````

> [!IMPORTANT]
> O RDO é registrado em **3 destinos simultâneos**: Supabase (nuvem), Obsidian (local) e Storage (fotos). Isso garante redundância total — mesmo se um sistema cair, os dados estão seguros nos outros dois.

---

## 📊 Resumo de Indicadores

| Métrica | Valor |
|---------|-------|
| **Módulos ativos** | 8 (NS, Cronograma, Equipes, RDO, Fluxo Ops, Cash Flow, BIM, Segurança) |
| **Tabelas Supabase** | 3 (equipes, logs_rdo, workflow_status) |
| **Persistência** | Tripla (Supabase + Obsidian + Storage) |
| **Temas** | Dark 🌙 + Light ☀️ |
| **Deploy** | Auto via GitHub → Vercel |
| **Comunicação** | WhatsApp bidirectional (envio + recepção) |
