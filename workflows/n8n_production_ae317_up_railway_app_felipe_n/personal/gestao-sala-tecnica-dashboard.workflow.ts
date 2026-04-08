import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Gestão Sala Técnica — Cobrança e Acompanhamento
// Nodes   : 10  |  Connections: 9
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// DisparoDiario8h                    scheduleTrigger
// MontarCobrancaSalaTecnica          code
// EnviarParaGabriel                  httpRequest
// ReceberRespostaSalaTecnica         webhook
// ParseRespostaSalaTecnica           code
// ValidarResposta                    if
// MontarDashboardSalaTecnica         code
// EnviarDashboardFelipe              httpRequest
// RegistrarPlataforma                httpRequest
// ConfirmarRecebimento               respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// DisparoDiario8h
//    → MontarCobrancaSalaTecnica
//      → EnviarParaGabriel
// ReceberRespostaSalaTecnica
//    → ParseRespostaSalaTecnica
//      → ValidarResposta
//        → MontarDashboardSalaTecnica
//          → EnviarDashboardFelipe
//            → RegistrarPlataforma
//              → ConfirmarRecebimento
//       .out(1) → ConfirmarRecebimento
// </workflow-map>

@workflow({
    name: 'Gestão Sala Técnica — Cobrança',
    active: false,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class GestaoSalaTecnicaWorkflow {

    @node({
        name: 'Disparo Diário 8h',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 300],
    })
    DisparoDiario8h = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 8 * * 1-6',
                },
            ],
        },
    };

    @node({
        name: 'Montar Cobrança Sala Técnica',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    MontarCobrancaSalaTecnica = {
        language: 'javaScript',
        jsCode: `
const hoje = new Date();
const diaSemana = ['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'][hoje.getDay()];
const dataFormatada = hoje.toLocaleDateString('pt-BR');

const mensagem = [
  '🚨 COBRANCA DIARIA - SALA TECNICA SLNR SANTOS',
  '================================',
  'Data: ' + diaSemana + ', ' + dataFormatada,
  'Equipe: Gabriel e Vinicius',
  'Prioridade: ALTA',
  '',
  'Responda os topicos abaixo atualizados:',
  '',
  '1. ESPACIALIZACAO NO SURVEY (PRAZO 10/04):',
  'Quantas ligacoes faltam ser espacializadas? ',
  'survey_pendencias: ',
  '',
  '2. CHECK COM THALITA SOBRE O SURVEY:',
  'status_thalita: ',
  '',
  '3. MEDIDAS E COMPRIMENTO DE REDE (EAP Trechos):',
  'Status da revisao projeto vs execucao: ',
  'status_redes: ',
  '',
  '4. DEFICIT DE CADASTRO (MAR/FEV) e TOPOGRAFIA:',
  'O cadastro antigo foi atualizado junto com a topografia? ',
  'status_deficit: ',
  '',
  '5. EXTENSAO DE RAMAIS (SEM CADASTRO PARA SABESP - PRAZO 16/04 e 02/05):',
  'Quantos ramais estao pendentes de validacao oficial? ',
  'ramais_pendentes: ',
  '',
  '================================',
  'Envie o update preenchendo as tags (ex: survey_pendencias: 50).',
].join('\\\\n');

return [
  { json: { mensagem, destinatario: '5513991995918', nome: 'Gabriel' } },
  { json: { mensagem, destinatario: '5513978216285', nome: 'Vinicius' } }
];
`,
    };

    @node({
        name: 'Enviar para Sala Técnica WhatsApp',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [500, 300],
        credentials: { httpHeaderAuth: { id: '', name: 'Evolution API' } },
    })
    EnviarParaGabriel = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: $json.destinatario, textMessage: { text: $json.mensagem } }) }}',
        options: {},
    };

    @node({
        name: 'Receber Resposta Sala Técnica',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 700],
    })
    ReceberRespostaSalaTecnica = {
        path: 'construdata-rdo-sala-tecnica',
        httpMethod: 'POST',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        name: 'Parse Resposta Sala Técnica',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 700],
    })
    ParseRespostaSalaTecnica = {
        language: 'javaScript',
        jsCode: `
const body = $input.first().json.body || $input.first().json;
const msg = body.message || body.text || body.Body || '';
const phone = body.phone || body.from || body.From || '';
const hoje = new Date();

const extractField = (key) => {
  const regex = new RegExp(key + '\\\\\\\\s*:\\\\\\\\s*(.+)', 'i');
  const match = msg.match(regex);
  return match ? match[1].trim() : 'Nao reportado';
};

const rdo = {
  data: hoje.toISOString().split('T')[0],
  hora: hoje.toTimeString().split(' ')[0],
  projeto: 'Sala Tecnica - SLNR Santos',
  reportado_por: phone.includes('991995918') ? 'Gabriel' : 'Vinicius',
  survey_pendencias: extractField('survey_pendencias'),
  status_thalita: extractField('status_thalita'),
  status_redes: extractField('status_redes'),
  status_deficit: extractField('status_deficit'),
  ramais_pendentes: extractField('ramais_pendentes'),
  valido: msg.length > 50,
};

return [{ json: rdo }];
`,
    };

    @node({
        name: 'Validar Resposta',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [500, 700],
    })
    ValidarResposta = {
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
    MontarDashboardSalaTecnica = {
        language: 'javaScript',
        jsCode: `
const r = $input.first().json;

const dashboard = [
  '📊 STATUS SALA TECNICA - ' + r.data,
  'Projeto: SLNR Santos (CT 11481051)',
  'Respondido por: ' + r.reportado_por,
  '================================',
  '',
  '1. PENDENCIAS SURVEY (Ate 10/04)',
  '   > ' + r.survey_pendencias,
  '',
  '2. ALINHAMENTO THALITA',
  '   > ' + r.status_thalita,
  '',
  '3. MEDIDAS EAP TRECHOS',
  '   > ' + r.status_redes,
  '',
  '4. DEFICIT FEV/MAR & TOPOGRAFIA',
  '   > ' + r.status_deficit,
  '',
  '5. EXTENSAO RAMAIS (Sem Cadastro Sabesp)',
  '   > ' + r.ramais_pendentes,
  '',
  '================================',
  'Link Gestao 360: https://construdatamaxv2-clean.vercel.app/app/gestao-360',
].join('\\\\n');

return [{ json: { dashboard, rdo: r } }];
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
        url: 'https://construdatamaxv2-clean.vercel.app/api/rdo/sala-tecnica',
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
            '={{ JSON.stringify({ status: "ok", message: "Update da Sala Técnica registrado! Dashboard enviado ao Felipe." }) }}',
        options: { responseCode: 200 },
    };

    @links()
    defineRouting() {
        this.DisparoDiario8h.out(0).to(this.MontarCobrancaSalaTecnica.in(0));
        this.MontarCobrancaSalaTecnica.out(0).to(this.EnviarParaGabriel.in(0));
        this.ReceberRespostaSalaTecnica.out(0).to(this.ParseRespostaSalaTecnica.in(0));
        this.ParseRespostaSalaTecnica.out(0).to(this.ValidarResposta.in(0));
        this.ValidarResposta.out(0).to(this.MontarDashboardSalaTecnica.in(0));
        this.ValidarResposta.out(1).to(this.ConfirmarRecebimento.in(0));
        this.MontarDashboardSalaTecnica.out(0).to(this.EnviarDashboardFelipe.in(0));
        this.EnviarDashboardFelipe.out(0).to(this.RegistrarPlataforma.in(0));
        this.RegistrarPlataforma.out(0).to(this.ConfirmarRecebimento.in(0));
    }
}
