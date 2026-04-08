import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Gestão ConstruData — Direcionamento João + Dashboard Felipe
// Nodes   : 10  |  Connections: 9
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// DisparoDiario7h                    scheduleTrigger
// MontarQuestionarioJoao             code
// EnviarParaJoaoWhatsApp             httpRequest
// ReceberRespostaJoao                webhook
// ParseRespostaJoao                  code
// DadosCompletos                     if
// MontarDashboardFelipe              code
// EnviarDashboardFelipe              httpRequest
// RegistrarPlataforma                httpRequest
// ConfirmarRecebimento               respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// DisparoDiario7h
//    → MontarQuestionarioJoao
//      → EnviarParaJoaoWhatsApp
// ReceberRespostaJoao
//    → ParseRespostaJoao
//      → DadosCompletos
//        → MontarDashboardFelipe
//          → EnviarDashboardFelipe
//            → RegistrarPlataforma
//              → ConfirmarRecebimento
//       .out(1) → ConfirmarRecebimento
// </workflow-map>

@workflow({
    name: 'Gestão ConstruData — Direcionamento João + Dashboard Felipe',
    active: false,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class GestaoConstruDataDirecionamentoJoaoWorkflow {

    @node({
        name: 'Disparo Diário 7h',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 300],
    })
    DisparoDiario7h = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 7 * * 1-6',
                },
            ],
        },
    };

    @node({
        name: 'Montar Questionário João',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    MontarQuestionarioJoao = {
        language: 'javaScript',
        jsCode: `
const hoje = new Date();
const diaSemana = ['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'][hoje.getDay()];
const dataFormatada = hoje.toLocaleDateString('pt-BR');

const mensagem = [
  'DIRECIONAMENTO DIARIO - CONSTRUDATA',
  '================================',
  'Data: ' + diaSemana + ', ' + dataFormatada,
  'Projetos: Santos/SABESP - CT 11481051',
  'Diretor: Joao',
  '',
  'Joao, responda os itens abaixo:',
  '',
  '1. METROS DE REDE FEITOS ONTEM:',
  'metros_rede: ',
  '',
  '2. PESSOAS NA OBRA:',
  'pessoas: ',
  '',
  '3. LOGISTICA (distancia do material):',
  'logistica: ',
  '',
  '4. PARALISACOES:',
  'paralisacoes: ',
  '',
  '5. JUSTIFICATIVA PRODUCAO:',
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
  '11. RDO EM DIA? (sim/nao):',
  'rdo_dia: ',
  '',
  'Envie fotos dos trechos se possivel.',
  '',
  '================================',
  'Preencha e envie para registrar.',
].join('\\\\n');

return [{ json: {
  mensagem,
  destinatario: '5561999996252',
  destinatario_nome: 'Joao',
  projeto: 'Santos/SABESP',
  data: dataFormatada,
  diaSemana,
} }];
`,
    };

    @node({
        name: 'Enviar para João WhatsApp',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [500, 300],
        credentials: { httpHeaderAuth: { id: '', name: 'Evolution API' } },
    })
    EnviarParaJoaoWhatsApp = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: $json.destinatario, textMessage: { text: $json.mensagem } }) }}',
        options: {},
    };

    @node({
        name: 'Receber Resposta João',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 700],
    })
    ReceberRespostaJoao = {
        path: 'construdata-rdo-joao',
        httpMethod: 'POST',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        name: 'Parse Resposta João',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 700],
    })
    ParseRespostaJoao = {
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
  projeto: 'Santos/SABESP - CT 11481051',
  contrato: 'CT 11481051',
  diretor: 'Joao',
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
        name: 'Dados Completos?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [500, 700],
    })
    DadosCompletos = {
        conditions: {
            options: { caseSensitive: true, leftValue: '' },
            combinator: 'and',
            conditions: [
                {
                    id: 'rdo-valido',
                    leftValue: '={{ $json.valido }}',
                    rightValue: true,
                    operator: { type: 'boolean', operation: 'equals' },
                },
            ],
        },
        options: {},
    };

    @node({
        name: 'Montar Dashboard Felipe',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [750, 600],
    })
    MontarDashboardFelipe = {
        language: 'javaScript',
        jsCode: `
const r = $input.first().json;
const metaDiaria = 60;
const performancePct = Math.round((r.metros_rede / metaDiaria) * 100);
const custoMetro = r.metros_rede > 0 ? Math.round(r.custo_total_dia / r.metros_rede) : 0;

const dashboard = [
  'DASHBOARD CONSTRUDATA - ' + r.data,
  'Projeto: Santos/SABESP CT 11481051',
  'Reportado por: Joao',
  '================================',
  '',
  'PRODUCAO',
  '  Metros: ' + r.metros_rede + 'm (meta ' + metaDiaria + 'm)',
  '  Performance: ' + performancePct + '%',
  '  ' + (performancePct >= 100 ? 'ACIMA DA META' : performancePct >= 80 ? 'Proximo da meta' : 'ABAIXO DA META'),
  '',
  'EQUIPE',
  '  Pessoas: ' + r.pessoas,
  '  Produtividade: ' + r.produtividade_m_pessoa + ' m/pessoa',
  '',
  'CUSTOS (DRE)',
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
  '  Medicao esperada: R$ ' + r.expectativa_medicao,
  '  RDO em dia: ' + r.rdo_dia,
  '',
  '================================',
  'https://construdatamaxv2-clean.vercel.app/app/dre-financeiro',
].join('\\\\n');

return [{ json: { dashboard, rdo: r, performancePct, custoMetro } }];
`,
    };

    @node({
        name: 'Enviar Dashboard para Felipe',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1000, 600],
        credentials: { httpHeaderAuth: { id: '', name: 'Evolution API' } },
    })
    EnviarDashboardFelipe = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: "5561981846325", textMessage: { text: $json.dashboard } }) }}',
        options: {},
    };

    @node({
        name: 'Registrar na Plataforma',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1250, 600],
    })
    RegistrarPlataforma = {
        url: 'https://construdatamaxv2-clean.vercel.app/api/rdo/santos',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify($json.rdo || $json) }}',
        options: {},
    };

    @node({
        name: 'Confirmar Recebimento',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1500, 700],
    })
    ConfirmarRecebimento = {
        respondWith: 'json',
        responseBody:
            '={{ JSON.stringify({ status: "ok", message: "RDO Santos registrado! Dashboard enviado para Felipe." }) }}',
        options: { responseCode: 200 },
    };

    @links()
    defineRouting() {
        this.DisparoDiario7h.out(0).to(this.MontarQuestionarioJoao.in(0));
        this.MontarQuestionarioJoao.out(0).to(this.EnviarParaJoaoWhatsApp.in(0));
        this.ReceberRespostaJoao.out(0).to(this.ParseRespostaJoao.in(0));
        this.ParseRespostaJoao.out(0).to(this.DadosCompletos.in(0));
        this.DadosCompletos.out(0).to(this.MontarDashboardFelipe.in(0));
        this.DadosCompletos.out(1).to(this.ConfirmarRecebimento.in(0));
        this.MontarDashboardFelipe.out(0).to(this.EnviarDashboardFelipe.in(0));
        this.EnviarDashboardFelipe.out(0).to(this.RegistrarPlataforma.in(0));
        this.RegistrarPlataforma.out(0).to(this.ConfirmarRecebimento.in(0));
    }
}
