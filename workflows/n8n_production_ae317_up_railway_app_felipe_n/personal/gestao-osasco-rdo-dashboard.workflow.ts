import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Gestão Osasco — Direcionamento + RDO + Dashboard
// Nodes   : 12  |  Connections: 11
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// DisparoDiario6h                    scheduleTrigger
// MontarQuestionarioMateus           code
// EnviarParaMateusViaWhatsapp        httpRequest                [creds]
// ReceberRespostaMateus              webhook
// ParseRespostaCompleta              code
// DadosCompletos                     if
// MontarDashboardTexto               code
// EnviarDashboardLuizFernando        httpRequest                [creds]
// GerarRelatorioEmail                code
// EnviarEmailGerencia                httpRequest
// RegistrarNaPlataforma              httpRequest
// ConfirmarRecebimento               respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// DisparoDiario6h
//    → MontarQuestionarioMateus
//      → EnviarParaMateusViaWhatsapp
// ReceberRespostaMateus
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
    id: 'HVPwaXUwSGHlK4J4',
    name: 'Gestão Osasco — Direcionamento + RDO + Dashboard',
    active: true,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class GestaoOsascoDirecionamentoRdoDashboardWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '465b46c4-3124-42d6-9516-454e73bf435c',
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
        id: '59039353-8f96-4134-8169-bdaaff6380c2',
        name: 'Montar Questionário Mateus',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    MontarQuestionarioMateus = {
        language: 'javaScript',
        jsCode: `
const hoje = new Date();
const diaSemana = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][hoje.getDay()];
const dataFormatada = hoje.toLocaleDateString('pt-BR');

const mensagem = [
  'DIRECIONAMENTO DIARIO DE OBRA',
  '================================',
  \`Data: \${diaSemana}, \${dataFormatada}\`,
  'Obra: Osasco-SP - Consorcio CLU Osasco',
  'Engenheiro: Mateus Santos',
  '',
  'Responda os itens abaixo (copie e preencha):',
  '',
  '1. METROS DE REDE FEITOS ONTEM:',
  'metros_rede: ',
  '',
  '2. PESSOAS NA OBRA:',
  'pessoas: ',
  '',
  '3. LOGISTICA (distancia material buscado):',
  'logistica: ',
  '',
  '4. PARALISACOES:',
  'paralisacoes: ',
  '',
  '5. JUSTIFICATIVA PRODUCAO (acima/abaixo esperado):',
  'justificativa: ',
  '',
  '6. PLANEJAMENTO PARA HOJE:',
  'plano_dia: ',
  '',
  '7. PLANEJAMENTO PARA A SEMANA:',
  'plano_semana: ',
  '',
  '8. EXPECTATIVA DE MEDICAO (R$):',
  'expectativa_medicao: ',
  '',
  '9. GASTOS (material, diesel, outros R$):',
  'gasto_material: ',
  'gasto_diesel: ',
  'gasto_outros: ',
  '',
  '10. TRECHO A SER EXECUTADO HOJE:',
  'trecho: ',
  '',
  '11. RDO EM DIA? (sim/nao + observacoes):',
  'rdo_dia: ',
  '',
  'Envie fotos dos trechos executados',
  '',
  '================================',
  'Ao preencher, envie para registrar automaticamente.',
].join('\\\\n');

return [{ json: {
  mensagem,
  destinatario: '5561991015639',  // Mateus Santos
  destinatario_nome: 'Mateus Santos',
  projeto: 'Osasco',
  data: dataFormatada,
  diaSemana,
} }];
`,
    };

    @node({
        id: 'ab59fe0f-efec-413b-bdf9-27bdeaa76010',
        name: 'Enviar para Mateus via WhatsApp',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [500, 300],
        credentials: { httpHeaderAuth: { id: '1qo5XC8PQEzGWwAN', name: 'Evolution API' } },
    })
    EnviarParaMateusViaWhatsapp = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: $json.destinatario, textMessage: { text: $json.mensagem } }) }}',
        options: {},
    };

    @node({
        id: '5f17478d-9dee-4d86-ab4a-9adbe8c3ecef',
        webhookId: '44d04167-9166-448e-af29-02063802ac4d',
        name: 'Receber Resposta Mateus',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 700],
    })
    ReceberRespostaMateus = {
        path: 'osasco-rdo-mateus',
        httpMethod: 'POST',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: '7b6fd11b-24d8-4d8c-89a4-1bddd7cf51f9',
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

const extractField = (key) => {
  const regex = new RegExp(key + '\\\\\\\\s*:\\\\\\\\s*(.+)', 'i');
  const match = msg.match(regex);
  return match ? match[1].trim() : '';
};

const rdo = {
  data: hoje.toISOString().split('T')[0],
  hora: hoje.toTimeString().split(' ')[0],
  projeto: 'Osasco - Consorcio CLU Osasco',
  contrato: 'CT-CLU-OSC-2026',
  engenheiro: 'Mateus Santos',
  telefone: phone,
  
  metros_rede: parseFloat(extractField('metros_rede')) || 0,
  pessoas: parseInt(extractField('pessoas')) || 0,
  logistica: extractField('logistica') || 'Nao informado',
  paralisacoes: extractField('paralisacoes') || 'Nenhuma',
  justificativa: extractField('justificativa') || '',
  plano_dia: extractField('plano_dia') || '',
  plano_semana: extractField('plano_semana') || '',
  expectativa_medicao: parseFloat(extractField('expectativa_medicao')?.replace(/[^\\\\d.,]/g, '').replace(',','.')) || 0,
  custos: {
    material: parseFloat(extractField('gasto_material')?.replace(/[^\\\\d.,]/g, '').replace(',','.')) || 0,
    diesel: parseFloat(extractField('gasto_diesel')?.replace(/[^\\\\d.,]/g, '').replace(',','.')) || 0,
    outros: parseFloat(extractField('gasto_outros')?.replace(/[^\\\\d.,]/g, '').replace(',','.')) || 0,
  },
  trecho: extractField('trecho') || 'Nao informado',
  rdo_dia: extractField('rdo_dia') || 'Nao informado',
  custo_total_dia: 0,
  produtividade_m_pessoa: 0,
  valido: false,
};

rdo.custo_total_dia = rdo.custos.material + rdo.custos.diesel + rdo.custos.outros;
rdo.produtividade_m_pessoa = rdo.pessoas > 0 ? Math.round((rdo.metros_rede / rdo.pessoas) * 10) / 10 : 0;
rdo.valido = rdo.metros_rede > 0 && rdo.pessoas > 0;

return [{ json: rdo }];
`,
    };

    @node({
        id: 'f13247c6-27bc-42fa-9c67-983dae99f7a9',
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
        id: '98106af0-554c-4745-83d2-53ecb7e01cbe',
        name: 'Montar Dashboard Texto',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [750, 600],
    })
    MontarDashboardTexto = {
        language: 'javaScript',
        jsCode: `
const r = $input.first().json;
const metaDiaria = 80;
const performancePct = Math.round((r.metros_rede / metaDiaria) * 100);
const custoMetro = r.metros_rede > 0 ? Math.round(r.custo_total_dia / r.metros_rede) : 0;

const dashboard = [
  'DASHBOARD OSASCO - ' + r.data,
  '================================',
  '',
  'PRODUCAO',
  '  Metros executados: ' + r.metros_rede + 'm',
  '  Meta diaria: ' + metaDiaria + 'm',
  '  Performance: ' + performancePct + '%',
  '  ' + (performancePct >= 100 ? 'ACIMA DA META!' : performancePct >= 80 ? 'Proximo da meta' : 'ABAIXO DA META'),
  '',
  'EQUIPE',
  '  Pessoas: ' + r.pessoas,
  '  Produtividade: ' + r.produtividade_m_pessoa + ' m/pessoa',
  '',
  'CUSTOS DO DIA (DRE)',
  '  Material: R$ ' + r.custos.material,
  '  Diesel: R$ ' + r.custos.diesel,
  '  Outros: R$ ' + r.custos.outros,
  '  Total: R$ ' + r.custo_total_dia,
  '  Custo/metro: R$ ' + custoMetro + '/m',
  '',
  'OPERACIONAL',
  '  Trecho: ' + r.trecho,
  '  Logistica: ' + r.logistica,
  '  Paralisacoes: ' + r.paralisacoes,
  '  Justificativa: ' + (r.justificativa || 'N/A'),
  '',
  'PLANEJAMENTO',
  '  Hoje: ' + (r.plano_dia || 'N/A'),
  '  Semana: ' + (r.plano_semana || 'N/A'),
  '',
  'MEDICAO',
  '  Expectativa: R$ ' + r.expectativa_medicao,
  '  RDO em dia: ' + r.rdo_dia,
  '',
  '================================',
  'https://construdatamaxv2-clean.vercel.app/app/dre-financeiro',
].join('\\\\n');

return [{ json: { dashboard, rdo: r, performancePct, custoMetro } }];
`,
    };

    @node({
        id: '600b23cf-91ee-45b3-bd0e-6344dd308854',
        name: 'Enviar Dashboard Luiz Fernando',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1000, 600],
        credentials: { httpHeaderAuth: { id: '1qo5XC8PQEzGWwAN', name: 'Evolution API' } },
    })
    EnviarDashboardLuizFernando = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: "5537999425397", textMessage: { text: $json.dashboard } }) }}',
        options: {},
    };

    @node({
        id: '263ac22d-2640-4419-a4df-1d6c67e0f2e5',
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
const barWidth = Math.min(data.performancePct, 100);
const barColor = data.performancePct >= 100 ? '#22c55e' : data.performancePct >= 80 ? '#eab308' : '#ef4444';

const htmlReport = \`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg, #0d2740, #1a4a6c); color: white; padding: 24px; }
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
  .footer { background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 11px; color: #999; }
</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>Relatorio Diario - Osasco CLU</h1>
      <p>Consorcio CLU Osasco | \${r.data} | Eng. Mateus Santos</p>
    </div>
    <div class="content">
      <div class="section">
        <h3>Producao</h3>
        <div class="metric"><span class="metric-label">Metros executados</span><span class="metric-value">\${r.metros_rede}m</span></div>
        <div class="metric"><span class="metric-label">Meta diaria</span><span class="metric-value">80m</span></div>
        <div class="bar-container">
          <div class="bar" style="width: \${barWidth}%; background: \${barColor};">\${data.performancePct}%</div>
        </div>
        <div class="metric"><span class="metric-label">Pessoas na obra</span><span class="metric-value">\${r.pessoas}</span></div>
        <div class="metric"><span class="metric-label">Produtividade</span><span class="metric-value">\${r.produtividade_m_pessoa} m/pessoa</span></div>
      </div>
      <div class="section">
        <h3>Custos do Dia</h3>
        <div class="metric"><span class="metric-label">Material</span><span class="metric-value">R$ \${r.custos.material}</span></div>
        <div class="metric"><span class="metric-label">Diesel</span><span class="metric-value">R$ \${r.custos.diesel}</span></div>
        <div class="metric"><span class="metric-label">Outros</span><span class="metric-value">R$ \${r.custos.outros}</span></div>
        <div class="metric"><span class="metric-label">Total do dia</span><span class="metric-value" style="color: #ef4444;">R$ \${r.custo_total_dia}</span></div>
      </div>
      <div class="section">
        <h3>Operacional</h3>
        <div class="metric"><span class="metric-label">Trecho</span><span class="metric-value">\${r.trecho}</span></div>
        <div class="metric"><span class="metric-label">Logistica</span><span class="metric-value">\${r.logistica}</span></div>
        <div class="metric"><span class="metric-label">Paralisacoes</span><span class="metric-value">\${r.paralisacoes}</span></div>
      </div>
      <div class="section">
        <h3>Planejamento</h3>
        <div class="metric"><span class="metric-label">Plano do dia</span><span class="metric-value">\${r.plano_dia || 'N/A'}</span></div>
        <div class="metric"><span class="metric-label">Plano da semana</span><span class="metric-value">\${r.plano_semana || 'N/A'}</span></div>
        <div class="metric"><span class="metric-label">Expectativa Medicao</span><span class="metric-value">R$ \${r.expectativa_medicao}</span></div>
      </div>
    </div>
    <div class="footer">
      ConstruDataMax - Gerado automaticamente | <a href="https://construdatamaxv2-clean.vercel.app/app/dre-financeiro">Acessar plataforma</a>
    </div>
  </div>
</body>
</html>\`;

return [{ json: {
  emailTo: 'fabio@consorcioclu.com.br',
  emailCc: 'luizfernando@construdata.com.br',
  subject: \`[Osasco CLU] Relatorio Diario - \${r.data} - \${r.metros_rede}m executados\`,
  htmlBody: htmlReport,
  rdo: r,
} }];
`,
    };

    @node({
        id: 'c33ac907-5346-402f-804a-20bcdf4c0401',
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
        id: '392fea66-646b-47b0-9b87-bea560c0e474',
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
        id: '70ad7f1d-ed5e-4703-b63e-b8ec2ee01a1d',
        name: 'Confirmar Recebimento',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [2000, 700],
    })
    ConfirmarRecebimento = {
        respondWith: 'json',
        responseBody:
            '={{ JSON.stringify({ status: "ok", message: "RDO Osasco registrado! Dashboard enviado para Luiz Fernando e relatorio para gerencia Fabio." }) }}',
        options: {
            responseCode: 200,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.DisparoDiario6h.out(0).to(this.MontarQuestionarioMateus.in(0));
        this.MontarQuestionarioMateus.out(0).to(this.EnviarParaMateusViaWhatsapp.in(0));
        this.ReceberRespostaMateus.out(0).to(this.ParseRespostaCompleta.in(0));
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
