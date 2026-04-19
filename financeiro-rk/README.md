# 🏗 CONTROLE FINANCEIRO CONSOLIDADO — RK ENGENHARIA

**Motor Excel premiado para consolidação de 6 obras em uma única planilha com gráficos, filtros e validação automática. (Motor Financeiro ConstruDataMax)**

---

## 📊 Visão Geral

Este projeto automatiza o controle financeiro da RK Engenharia consolidando dados de **6 obras diferentes** (planilhas ENGELFER-RK) em um **Excel único e profissional** agora integrado de ponta a ponta com o Supabase e WhatsApp, contando com:

- ✅ **11 abas** especializadas (Incluindo Projetado e Dashboard)
- ✅ Sync Bidirecional com a Nuvem (**Supabase**)
- ✅ **Lançamentos unificados em tempo real**
- ✅ **Dashboard Executiva** com KPIs automáticos
- ✅ **Ponte Evolution API (WhatsApp) + OCR Gemini** implementada
- ✅ **34 funcionários** mapeados

| Obra | Status de Sync | Responsável |
|------|----------------|-------------|
| TATUI | ✅ ONLINE | Felipe / Ícaro |
| OSASCO | ✅ ONLINE | Mateus |
| SANTOS | ✅ ONLINE | Igor / Alexandre |
| PARDINHO | ✅ ONLINE | Felipe / Ícaro |
| CACHOEIRO | ✅ ONLINE | A definir |
| TEOFILO | ✅ ONLINE | Wellington |

---

## 🚀 Quick Start (Versão Integrada ConstruDataMax)

### Instalação

O módulo já está integrado na raiz do `construdatamaxv2-clean`.

```bash
# 1. Entre no diretório do módulo financeiro
cd financeiro-rk

# 2. Instalar dependências se necessário
pip install -r requirements.txt
```

### O Pipeline Completo (Sync + Motor)

Em vez de gerar tudo isolado, agora rodamos o pipeline que injeta as despesas do Supabase no Motor.

```powershell
# Executar a ponte Nuvem -> Offline e em seguida rodar o Motor Excel
./pipeline_completo.bat
```

> ⚙️ **Agendamento Cron:** Um script `agendar_sync.ps1` já inseriu a regra no Task Scheduler do Windows do Felipe para rodar as 23:30. Você não precisa gerar o arquivo manualmente na sexta, o sistema gera pra você!

---

## 📋 Estrutura Estendida (As 11 Abas)

1. **DASHBOARD 📊:** KPIs de caixa, gastos gerais, e saúde financeira total em cards/gráficos.
2. **RESUMO 🏗:** Visão geral consolidada das 6 obras (Gráficos barras + pizza).
3. **LANÇAMENTOS 📋:** Banco de dados geral de fluxos.
4. **FLUXO DE CAIXA 💰:** Tabela mensal JAN-DEZ com mini-gráficos isolados.
5. **FOLHA 👷:** Custo de pessoal (34 base) organizados pelas filiais.
6. **SUBCATEGORIAS 🏷:** Auditoria de padrão do Plano de Contas.
7. **CUSTOS FIXOS 🔧:** Gastos estruturais mapeados e previsíveis.
8. **CUSTOS VARIÁVEIS 📊:** Gastos que acompanham flutuações e O.S.
9. **RECEBÍVEIS 💰:** Contas a receber.
10. **PAGÁVEIS 💸:** Acordos e contas de terceiros ativas.
11. **FLUXO PROJETADO 🔮:** Horizonte gráfico dos próximos 12 meses.

---

## 🎨 Formatação & Features

| Feature | Descrição |
|---------|-----------|
| **Cores ENGELFER-RK** | Azul escuro `1B2A4A`, cabeçalhos limpos |
| **Ponte Supabase** | Mapas de tradução para `MDO`, `MAT`, `EPI` |
| **Códigos de Custo** | Centros automáticos (`PAR`, `OSA`, `TAT`) |
| **Integração Whats** | OCR alimenta nuvem -> Motor Excel coleta à noite |

---

## 📂 Arquitetura (novo)

```
construdatamaxv2-clean/financeiro-rk/
├── MOTOR_EXCEL_CONSOLIDADO_RK.py    # Motor Local para XLSX
├── MOTOR_EXCEL_DASHBOARD_RK.py      # Versão expressa
├── sync_bidirecional.py             # 🔌 Ponte Supabase Full
├── pipeline_completo.bat            # Executável do ecossistema
├── agendar_sync.ps1                 # Script CRON Windows
└── dados_consolidados.json          # Cache de comunicação Python
```

---

## 🗺️ Roadmap Atualizado

- [x] **v1.1** — Integração Supabase (sync automático de lançamentos) ✅ *(Concluído 18/04)*
- [x] **v1.2** — Webhook WhatsApp (Evolution API -> Supabase) ✅ *(Concluído 18/04)* 
- [ ] **v1.3** — Dashboard web baseada na Web (Refatorar React/Next.js)
- [ ] **v2.0** — Mobile app nativo da ConstruDataMax

---

**Última atualização:** 18/04/2026 — v1.2.0 (Integração Full Stack)
