import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Gestão Pardinho — Direcionamento + RDO + Dashboard
// Nodes   : 12  |  Connections: 11
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// DisparoDiario6h                    scheduleTrigger
// MontarQuestionarioIcaro            code
// EnviarParaIcaroViaWhatsapp         httpRequest
// ReceberRespostaIcaro               webhook
// ParseRespostaCompleta              code
// DadosCompletos                     if
// MontarDashboardTexto               code
// EnviarDashboardLuizFernando        httpRequest
// GerarRelatorioEmail                code
// EnviarEmailGerencia                httpRequest
// RegistrarNaPlataforma              httpRequest
// ConfirmarRecebimento               respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// DisparoDiario6h
//    → MontarQuestionarioIcaro
//      → EnviarParaIcaroViaWhatsapp
// ReceberRespostaIcaro
//    → ParseRespostaCompleta
//      → DadosCompletos
//        → MontarDashboardTexto
//          → EnviarDashboardLuizFernando
//            → GerarRelatorioEmail
//              → EnviarEmailGerencia
//                → RegistrarNaPlataforma
//                  → ConfirmarRecebimento
//       .out(1) → ConfirmarRecebimento (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '3MlISSU8VYGAiiMR',
    name: 'Gestão Pardinho — Direcionamento + RDO + Dashboard',
    active: true,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class GestaoPardinhoDirecionamentoRdoDashboardWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '12b64a6a-0fb2-4c5c-9037-c10d1d4fda7b',
        name: 'Disparo Diário 6h',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 300],
    })
    DisparoDiario6h = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 6 * * 1-6',
                },
            ],
        },
    };

    @node({
        id: 'fe4c5a60-0fef-4595-87ca-da252fb56339',
        name: 'Montar Questionário Ícaro',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    MontarQuestionarioIcaro = {
        language: 'javaScript',
        jsCode: `
const hoje = new Date();
const diaSemana = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][hoje.getDay()];
const dataFormatada = hoje.toLocaleDateString('pt-BR');

const mensagem = [
  '🏗️ *DIRECIONAMENTO DIÁRIO DE OBRA*',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  \`📅 \${diaSemana}, \${dataFormatada}\`,
  '📍 Pardinho-SP — Consórcio Itapetininga',
  '👷 Eng. Ícaro',
  '',
  '📋 *Responda os itens abaixo (copie e preencha):*',
  '',
  '1️⃣ *METROS DE REDE FEITOS ONTEM:*',
  'metros_rede: ',
  '',
  '2️⃣ *PESSOAS NA OBRA:*',
  'pessoas: ',
  '',
  '3️⃣ *LOGÍSTICA (distância material buscado):*',
  'logistica: ',
  '',
  '4️⃣ *PARALISAÇÕES:*',
  'paralisacoes: ',
  '',
  '5️⃣ *JUSTIFICATIVA PRODUÇÃO (acima/abaixo esperado):*',
  'justificativa: ',
  '',
  '6️⃣ *PLANEJAMENTO PARA HOJE:*',
  'plano_dia: ',
  '',
  '7️⃣ *PLANEJAMENTO PARA A SEMANA:*',
  'plano_semana: ',
  '',
  '8️⃣ *EXPECTATIVA DE MEDIÇÃO (R$):*',
  'expectativa_medicao: ',
  '',
  '9️⃣ *GASTOS (material, diesel, outros R$):*',
  'gasto_material: ',
  'gasto_diesel: ',
  'gasto_outros: ',
  '',
  '🔟 *TRECHO A SER EXECUTADO HOJE:*',
  'trecho: ',
  '',
  '1️⃣1️⃣ *RDO EM DIA? (sim/não + observações):*',
  'rdo_dia: ',
  '',
  '📸 *Envie fotos dos trechos executados*',
  '',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  '✅ Ao preencher, envie para registrar automaticamente.',
].join('\\n');

return [{ json: {
  mensagem,
  destinatario: '5537998268576',  // Ícaro
  destinatario_nome: 'Ícaro',
  projeto: 'Pardinho',
  data: dataFormatada,
  diaSemana,
} }];
`,
    };

    @node({
        id: 'a1b08871-cbe9-45ad-9dcf-8b386658c280',
        name: 'Enviar para Ícaro via WhatsApp',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [500, 300],
    })
    EnviarParaIcaroViaWhatsapp = {
        url: 'https://n8n-production-ae317.up.railway.app/webhook/construdata-notificacao',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ channel: "whatsapp", phone: $json.destinatario, message: $json.mensagem, project: "pardinho" }) }}',
        options: {},
    };

    @node({
        id: '5d07a7ec-83c0-43ff-95a8-b3e51990bb11',
        webhookId: '76246d6d-607c-4ef5-ab24-fbd19961a151',
        name: 'Receber Resposta Ícaro',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 700],
    })
    ReceberRespostaIcaro = {
        path: 'pardinho-rdo-icaro',
        httpMethod: 'POST',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: '4061cf0c-de2a-4905-8975-6d6f0235a579',
        name: 'Parse Resposta Completa',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 700],
    })
    ParseRespostaCompleta = {
        language: 'javaScript',
        jsCode: `
const body = $input.first().json.body || $input.first().json;
const msg = body.message || body.text || body.Body || '';
const phone = body.phone || body.from || body.From || '';
const hoje = new Date();

// Parse key:value do formato enviado
const extractField = (key) => {
  const regex = new RegExp(key + '\\\\s*:\\\\s*(.+)', 'i');
  const match = msg.match(regex);
  return match ? match[1].trim() : '';
};

const rdo = {
  // Metadata
  data: hoje.toISOString().split('T')[0],
  hora: hoje.toTimeString().split(' ')[0],
  projeto: 'Pardinho — Consórcio Itapetininga',
  contrato: 'CT-PARDINHO-2026',
  engenheiro: 'Ícaro',
  telefone: phone,
  
  // 1.1.1 - Metros de rede
  metros_rede: parseFloat(extractField('metros_rede')) || 0,
  
  // 1.1.2 - Pessoas na obra
  pessoas: parseInt(extractField('pessoas')) || 0,
  
  // 1.1.3 - Logística
  logistica: extractField('logistica') || 'Não informado',
  
  // 1.1.4 - Paralisações
  paralisacoes: extractField('paralisacoes') || 'Nenhuma',
  
  // 1.1.5 - Justificativa produção
  justificativa: extractField('justificativa') || '',
  
  // 1.1.6 - Planejamento do dia
  plano_dia: extractField('plano_dia') || '',
  
  // 1.1.7 - Planejamento da semana
  plano_semana: extractField('plano_semana') || '',
  
  // 1.1.8 - Expectativa medição
  expectativa_medicao: parseFloat(extractField('expectativa_medicao')?.replace(/[^\\d.,]/g, '').replace(',','.')) || 0,
  
  // 1.1.9 - Gastos para DRE
  custos: {
    material: parseFloat(extractField('gasto_material')?.replace(/[^\\d.,]/g, '').replace(',','.')) || 0,
    diesel: parseFloat(extractField('gasto_diesel')?.replace(/[^\\d.,]/g, '').replace(',','.')) || 0,
    outros: parseFloat(extractField('gasto_outros')?.replace(/[^\\d.,]/g, '').replace(',','.')) || 0,
  },
  
  // 1.1.10 - Trecho
  trecho: extractField('trecho') || 'Não informado',
  
  // 1.1.11 - RDO em dia
  rdo_dia: extractField('rdo_dia') || 'Não informado',
  
  // Derivados
  custo_total_dia: 0,
  produtividade_m_pessoa: 0,
  valido: false,
};

// Calcular derivados
rdo.custo_total_dia = rdo.custos.material + rdo.custos.diesel + rdo.custos.outros;
rdo.produtividade_m_pessoa = rdo.pessoas > 0 ? Math.round((rdo.metros_rede / rdo.pessoas) * 10) / 10 : 0;
rdo.valido = rdo.metros_rede > 0 && rdo.pessoas > 0;

return [{ json: rdo }];
`,
    };

    @node({
        id: '594bfd18-b0e2-4c51-8c6c-383e8a23a104',
        name: 'Dados Completos?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [500, 700],
    })
    DadosCompletos = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
            },
            combinator: 'and',
            conditions: [
                {
                    id: 'rdo-valido',
                    leftValue: '={{ $json.valido }}',
                    rightValue: true,
                    operator: {
                        type: 'boolean',
                        operation: 'equals',
                    },
                },
            ],
        },
        options: {},
    };

    @node({
        id: '3efc8c4b-3839-41d1-b196-1eab6c8394d3',
        name: 'Montar Dashboard Texto',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [750, 600],
    })
    MontarDashboardTexto = {
        language: 'javaScript',
        jsCode: `
const r = $input.first().json;

// Indicadores de performance
const metaDiaria = 50; // metros/dia meta
const performancePct = Math.round((r.metros_rede / metaDiaria) * 100);
const barraProgresso = (pct) => {
  const filled = Math.round(pct / 10);
  return '█'.repeat(Math.min(filled, 10)) + '░'.repeat(Math.max(0, 10 - filled));
};

const custoMetro = r.metros_rede > 0 ? Math.round(r.custo_total_dia / r.metros_rede) : 0;

const dashboard = [
  '📊 *DASHBOARD PARDINHO — ' + r.data + '*',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  '',
  '🏗️ *PRODUÇÃO*',
  \`  📏 Metros executados: *\${r.metros_rede}m*\`,
  \`  🎯 Meta diária: \${metaDiaria}m\`,
  \`  📊 Performance: \${performancePct}%\`,
  \`  \${barraProgresso(performancePct)} \${performancePct}%\`,
  \`  \${performancePct >= 100 ? '✅ ACIMA DA META!' : performancePct >= 80 ? '🟡 Próximo da meta' : '🔴 ABAIXO DA META'}\`,
  '',
  '👷 *EQUIPE*',
  \`  👥 Pessoas: *\${r.pessoas}*\`,
  \`  📈 Produtividade: *\${r.produtividade_m_pessoa} m/pessoa*\`,
  '',
  '💰 *CUSTOS DO DIA (→ DRE)*',
  \`  📦 Material: R$ \${r.custos.material.toLocaleString('pt-BR')}\`,
  \`  ⛽ Diesel: R$ \${r.custos.diesel.toLocaleString('pt-BR')}\`,
  \`  📋 Outros: R$ \${r.custos.outros.toLocaleString('pt-BR')}\`,
  \`  ━━━━━━━━━━━━━━━━━━\`,
  \`  💰 *Total: R$ \${r.custo_total_dia.toLocaleString('pt-BR')}*\`,
  \`  📊 Custo/metro: R$ \${custoMetro}/m\`,
  '',
  '📋 *OPERACIONAL*',
  \`  📍 Trecho: \${r.trecho}\`,
  \`  🚛 Logística: \${r.logistica}\`,
  \`  ⚠️ Paralisações: \${r.paralisacoes}\`,
  \`  💬 Justificativa: \${r.justificativa || 'N/A'}\`,
  '',
  '📅 *PLANEJAMENTO*',
  \`  Hoje: \${r.plano_dia || 'N/A'}\`,
  \`  Semana: \${r.plano_semana || 'N/A'}\`,
  '',
  '💰 *MEDIÇÃO*',
  \`  📊 Expectativa: R$ \${r.expectativa_medicao.toLocaleString('pt-BR')}\`,
  \`  📋 RDO em dia: \${r.rdo_dia}\`,
  '',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  '🔗 https://construdatamaxv2-clean.vercel.app/app/dre-financeiro',
].join('\\n');

return [{ json: { dashboard, rdo: r, performancePct, custoMetro } }];
`,
    };

    @node({
        id: 'f78f874a-7377-463c-8c6d-cf0b44ef40cf',
        name: 'Enviar Dashboard Luiz Fernando',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1000, 600],
    })
    EnviarDashboardLuizFernando = {
        url: 'https://n8n-production-ae317.up.railway.app/webhook/construdata-notificacao',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ channel: "whatsapp", phone: "5537999425397", message: $json.dashboard, project: "pardinho", type: "dashboard" }) }}',
        options: {},
    };

    @node({
        id: '2b1cedae-6621-48bf-800e-ed66db117e82',
        name: 'Gerar Relatório Email',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1250, 600],
    })
    GerarRelatorioEmail = {
        language: 'javaScript',
        jsCode: `
const data = $input.first().json;
const r = data.rdo;

// Gerar HTML do relatório com gráfico simples (barras CSS)
const barWidth = Math.min(data.performancePct, 100);
const barColor = data.performancePct >= 100 ? '#22c55e' : data.performancePct >= 80 ? '#eab308' : '#ef4444';

const htmlReport = \`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg, #0d1f3c, #1a3a5c); color: white; padding: 24px; }
  .header h1 { margin: 0; font-size: 20px; }
  .header p { margin: 4px 0 0; opacity: 0.7; font-size: 13px; }
  .content { padding: 24px; }
  .metric { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
  .metric-label { color: #666; font-size: 13px; }
  .metric-value { font-weight: bold; color: #1a3a5c; }
  .bar-container { background: #e5e7eb; border-radius: 8px; height: 24px; margin: 12px 0; overflow: hidden; }
  .bar { height: 100%; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; }
  .section { margin: 20px 0; }
  .section h3 { color: #1a3a5c; font-size: 15px; margin-bottom: 8px; border-bottom: 2px solid #2abfdc; padding-bottom: 4px; }
  .costs-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .cost-box { background: #f8fafc; border-radius: 8px; padding: 12px; text-align: center; }
  .cost-box .value { font-size: 18px; font-weight: bold; color: #1a3a5c; }
  .cost-box .label { font-size: 11px; color: #666; }
  .footer { background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 11px; color: #999; }
</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Relatório Diário — Pardinho</h1>
      <p>Consórcio Itapetininga | \${r.data} | Eng. Ícaro</p>
    </div>
    <div class="content">
      <div class="section">
        <h3>🏗️ Produção</h3>
        <div class="metric"><span class="metric-label">Metros executados</span><span class="metric-value">\${r.metros_rede}m</span></div>
        <div class="metric"><span class="metric-label">Meta diária</span><span class="metric-value">50m</span></div>
        <div class="bar-container">
          <div class="bar" style="width: \${barWidth}%; background: \${barColor};">\${data.performancePct}%</div>
        </div>
        <div class="metric"><span class="metric-label">Pessoas na obra</span><span class="metric-value">\${r.pessoas}</span></div>
        <div class="metric"><span class="metric-label">Produtividade</span><span class="metric-value">\${r.produtividade_m_pessoa} m/pessoa</span></div>
      </div>

      <div class="section">
        <h3>💰 Custos do Dia</h3>
        <div class="costs-grid">
          <div class="cost-box"><div class="value">R$ \${r.custos.material.toLocaleString('pt-BR')}</div><div class="label">Material</div></div>
          <div class="cost-box"><div class="value">R$ \${r.custos.diesel.toLocaleString('pt-BR')}</div><div class="label">Diesel</div></div>
          <div class="cost-box"><div class="value">R$ \${r.custos.outros.toLocaleString('pt-BR')}</div><div class="label">Outros</div></div>
        </div>
        <div class="metric" style="margin-top: 12px;"><span class="metric-label">Total do dia</span><span class="metric-value" style="color: #ef4444;">R$ \${r.custo_total_dia.toLocaleString('pt-BR')}</span></div>
        <div class="metric"><span class="metric-label">Custo/metro</span><span class="metric-value">R$ \${data.custoMetro}/m</span></div>
      </div>

      <div class="section">
        <h3>📋 Operacional</h3>
        <div class="metric"><span class="metric-label">Trecho</span><span class="metric-value">\${r.trecho}</span></div>
        <div class="metric"><span class="metric-label">Logística</span><span class="metric-value">\${r.logistica}</span></div>
        <div class="metric"><span class="metric-label">Paralisações</span><span class="metric-value">\${r.paralisacoes}</span></div>
        <div class="metric"><span class="metric-label">Justificativa</span><span class="metric-value">\${r.justificativa || 'N/A'}</span></div>
      </div>

      <div class="section">
        <h3>📅 Planejamento</h3>
        <div class="metric"><span class="metric-label">Plano do dia</span><span class="metric-value">\${r.plano_dia || 'N/A'}</span></div>
        <div class="metric"><span class="metric-label">Plano da semana</span><span class="metric-value">\${r.plano_semana || 'N/A'}</span></div>
        <div class="metric"><span class="metric-label">Expectativa Medição</span><span class="metric-value">R$ \${r.expectativa_medicao.toLocaleString('pt-BR')}</span></div>
      </div>
    </div>
    <div class="footer">
      ConstruDataMax — Gerado automaticamente | <a href="https://construdatamaxv2-clean.vercel.app/app/dre-financeiro">Acessar plataforma</a>
    </div>
  </div>
</body>
</html>\`;

return [{ json: {
  emailTo: 'gerencia@consorcioitapetininga.com.br',
  emailCc: 'luizfernando@construdata.com.br',
  subject: \`[Pardinho] Relatório Diário — \${r.data} — \${r.metros_rede}m executados\`,
  htmlBody: htmlReport,
  rdo: r,
} }];
`,
    };

    @node({
        id: '823dba77-a1d1-4bfa-b511-5306a3796ae1',
        name: 'Enviar Email Gerência',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1500, 600],
    })
    EnviarEmailGerencia = {
        url: 'https://n8n-production-ae317.up.railway.app/webhook/construdata-email',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ to: $json.emailTo, cc: $json.emailCc, subject: $json.subject, html: $json.htmlBody }) }}',
        options: {},
    };

    @node({
        id: 'b5e78aa7-934d-44d4-bda1-9d6a3ca720c0',
        name: 'Registrar na Plataforma',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1750, 600],
    })
    RegistrarNaPlataforma = {
        url: 'https://vblfdikfobsirwpdnybw.supabase.co/rest/v1/rdos',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'apikey',
                    value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibGZkaWtmb2JzaXJ3cGRueWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzAwODIsImV4cCI6MjA4ODk0NjA4Mn0.GOx3HoMh3P2Zzxz8BxNsfQBfXwsNZNQsdVc3nJaqRy4',
                },
                {
                    name: 'Authorization',
                    value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibGZkaWtmb2JzaXJ3cGRueWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzAwODIsImV4cCI6MjA4ODk0NjA4Mn0.GOx3HoMh3P2Zzxz8BxNsfQBfXwsNZNQsdVc3nJaqRy4',
                },
                {
                    name: 'Prefer',
                    value: 'return=representation',
                },
            ],
        },
        body: '={{ JSON.stringify($json.rdo || $json) }}',
        options: {},
    };

    @node({
        id: 'c32fdb2e-0e11-4f10-a0e4-cd389ef21b69',
        name: 'Confirmar Recebimento',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [2000, 700],
    })
    ConfirmarRecebimento = {
        respondWith: 'json',
        responseBody:
            '={{ JSON.stringify({ status: "ok", message: "✅ RDO Pardinho registrado! Dashboard enviado para Luiz Fernando e relatório para a gerência." }) }}',
        options: {
            responseCode: 200,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.DisparoDiario6h.out(0).to(this.MontarQuestionarioIcaro.in(0));
        this.MontarQuestionarioIcaro.out(0).to(this.EnviarParaIcaroViaWhatsapp.in(0));
        this.ReceberRespostaIcaro.out(0).to(this.ParseRespostaCompleta.in(0));
        this.ParseRespostaCompleta.out(0).to(this.DadosCompletos.in(0));
        this.DadosCompletos.out(0).to(this.MontarDashboardTexto.in(0));
        this.DadosCompletos.out(1).to(this.ConfirmarRecebimento.in(0));
        this.MontarDashboardTexto.out(0).to(this.EnviarDashboardLuizFernando.in(0));
        this.EnviarDashboardLuizFernando.out(0).to(this.GerarRelatorioEmail.in(0));
        this.GerarRelatorioEmail.out(0).to(this.EnviarEmailGerencia.in(0));
        this.EnviarEmailGerencia.out(0).to(this.RegistrarNaPlataforma.in(0));
        this.RegistrarNaPlataforma.out(0).to(this.ConfirmarRecebimento.in(0));
    }
}
