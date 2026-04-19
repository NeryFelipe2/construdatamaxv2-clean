# CHANGELOG — RK Engenharia Controle Financeiro

*Registro de todas as mudanças notáveis no projeto do Motor Financeiro RK.*

---

## [1.2.0] — 2026-04-18 🔌 Sync Bidirecional & Webhooks

### ✨ Features Principais Implantadas (Hoje)
- **Sincronização Automática com Supabase:** Script de Pull e Push operacionais (`sync_bidirecional.py`)
- **Tabela de Lançamentos Normalizada:** Integração com as tabelas do ConstruDataMax
- **OCR e WhatsApp (Webhook):** n8n recebe notas e dispara atualização para o banco
- **Agendamento Windows:** O script é executado via Cron Job / Tarefa Agendada todos os dias às 23:30h
- **Pipeline Completo em .bat:** Um clique roda toda a checagem, fetch da nuvem e gera as abas do Excel.

---

## [1.1.0] — 2026-04-14 🎯 Expedição do Planejamento Financeiro & Projeção

### 📊 5 Novas Abas Implementadas:
- `CUSTOS FIXOS`: Gastos mensais recorrentes por obra
- `CUSTOS VARIÁVEIS`: Análise % da receita das frentes
- `RECEBÍVEIS`: Contas a receber (ABERTO/VENCENDO/VENCIDO) autocalculado
- `PAGÁVEIS`: Contas e prazos programados de boletos
- `FLUXO PROJETADO`: Projeção em Linha visual 12 meses + Saldo acumulativo.

---

## [1.0.0] — 2026-04-14 🎉 ChatGithub Initial Release

### ✨ Features Principais
- **Motor de consolidação**: Lê automaticamente 6 planilhas ENGELFER-RK
- **5 abas profissionais originais**:
  - `RESUMO`: Visão geral com gráficos (barras + pizza)
  - `LANÇAMENTOS`: 134 registros unificados com filtros
  - `FLUXO CAIXA`: Tabelas mensais e gráficos por obra
  - `FOLHA`: 34 funcionários com custo por obra
  - `SUBCATEGORIAS`: Audit de categorias padrão vs não-padrão
- **Gráficos embarcados**: BarChart, PieChart, LineChart com estilo Professional
- **Formatação premium**:
  - Escala de cores condicional (Vermelho ← → Verde)
  - Zebra pattern (linhas alternadas)
  - Layout ENGELFER-RK (cores, fontes, estrutura)
- **Validação de dados**: Dropdowns para Receita/Gastos
- **Filtros automáticos** em LANÇAMENTOS

### 📊 Dados Consolidados Base
- Total Receitas: **R$ 100.474,52**
- Total Gastos: **R$ -296.355,53**
- Saldo Geral: **R$ -195.881,01**
- Total Lançamentos: **134 registros**
- Total Funcionários: **34 pessoas**
- Folha + Encargos: **R$ 201.288,39/mês**

### 🎯 Obras Incluídas
| Obra | Lançamentos | Saldo | Funcionários | Status |
|------|----------|-------|------------|--------|
| TATUI | 5 | -R$ 14.833,75 | 18 | Poucos dados |
| OSASCO | 28 | -R$ 33.293,83 | 9 | Ativo |
| SANTOS | 60 | -R$ 32.411,79 | — | Completo |
| PARDINHO | 35 | -R$ 165.392,54 | — | Ativo |
| CACHOEIRO | 1 | +R$ 15.000,00 | — | Mobilização |
| TEOFILO | 5 | +R$ 35.050,90 | 7 | Início |

### 🔧 Tecnologia Original
- **Linguagem**: Python 3.10+
- **Biblioteca**: openpyxl 3.0+
- **Formato**: .xlsx (Office Open XML)
- **Tamanho base**: ~30 KB (principal) + 8 KB (versão)

---

## 🗺️ Roadmap Futuro Restante

### v1.3 (Na Mira)
- [ ] Dashboard e Gráficos da Web (Supabase View / React/Next.js)
- [ ] Filtros dinâmicos robustos no Dashboard Cloud
- [ ] Export para PDF/CSV nativo

### v2.0
- [ ] App mobile ConstruDataMax (React Native)
- [ ] Gestão de Aprovação de Boletos no Mobile (Offline-first)
- [ ] Sincronização em Background App
- [ ] Dashboard Modo Dark Total
