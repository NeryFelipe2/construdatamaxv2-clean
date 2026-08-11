import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Gestão Sala Técnica — Cobrança
// Nodes   : 10  |  Connections: 9
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// DisparoDiario8h                    scheduleTrigger
// MontarCobrancaSalaTecnica          code
// EnviarParaSalaTecnicaWhatsapp      httpRequest                [creds]
// ReceberRespostaSalaTecnica         webhook
// ParseRespostaSalaTecnica           code
// ValidarResposta                    if
// MontarDashboardFelipe              code
// EnviarDashboardParaFabrizzioGerenteSlnr httpRequest                [creds]
// RegistrarNaPlataforma              httpRequest
// ConfirmarRecebimento               respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// DisparoDiario8h
//    → MontarCobrancaSalaTecnica
//      → EnviarParaSalaTecnicaWhatsapp
// ReceberRespostaSalaTecnica
//    → ParseRespostaSalaTecnica
//      → ValidarResposta
//        → MontarDashboardFelipe
//          → EnviarDashboardParaFabrizzioGerenteSlnr
//            → RegistrarNaPlataforma
//              → ConfirmarRecebimento
//       .out(1) → ConfirmarRecebimento (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'YrInUWvU1xhqyw0B',
    name: 'Gestão Sala Técnica — Cobrança',
    active: false,
    isArchived: false,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class GestaoSalaTecnicaCobrancaWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'f59b3f42-768b-470b-8e98-8f240241b7c1',
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
        id: '2e1d1580-8b58-4164-9923-ab704a18f76e',
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
        id: '511cfaa4-f210-455c-93fe-df18f2c00c64',
        name: 'Enviar para Sala Técnica WhatsApp',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [500, 300],
        credentials: { httpHeaderAuth: { id: '1qo5XC8PQEzGWwAN', name: 'Evolution API' } },
    })
    EnviarParaSalaTecnicaWhatsapp = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: $json.destinatario, textMessage: { text: $json.mensagem } }) }}',
        options: {},
    };

    @node({
        id: 'd9152db8-5d58-4cce-adcb-71efe746cb63',
        webhookId: '6aaf6121-25e3-4b8f-b0fd-4b9c9c0cafdc',
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
        id: 'abe6480d-4e67-49e7-ab36-f784c056bead',
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
        id: '0e9bd6b0-ffa3-4881-a0ad-fe273b278039',
        name: 'Validar Resposta',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [500, 700],
    })
    ValidarResposta = {
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
        id: 'c546d8a8-397d-4583-a205-df1559794349',
        name: 'Montar Dashboard Felipe',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [750, 600],
    })
    MontarDashboardFelipe = {
        language: 'javaScript',
        jsCode: `
const r = $input.first().json;

const dashboard = [
  '📊 STATUS SALA TECNICA - SLNR SANTOS - ' + r.data,
  '👤 Para: Fabrizzio (Gerente SLNR)',
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
        id: 'bb65689c-9b49-454e-bf4b-e9f790b72ac3',
        name: 'Enviar Dashboard para Fabrizzio (Gerente SLNR)',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1000, 600],
        credentials: { httpHeaderAuth: { id: '1qo5XC8PQEzGWwAN', name: 'Evolution API' } },
    })
    EnviarDashboardParaFabrizzioGerenteSlnr = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: "5574999076534", textMessage: { text: $json.dashboard } }) }}',
        options: {},
    };

    @node({
        id: 'b527d0cb-4e03-4ed5-8263-8d3da31f7f95',
        name: 'Registrar na Plataforma',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1250, 600],
    })
    RegistrarNaPlataforma = {
        url: 'https://construdatamaxv2-clean.vercel.app/api/rdo/sala-tecnica',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify($json.rdo || $json) }}',
        options: {},
    };

    @node({
        id: '4cc8b461-5366-46cd-a8a0-bdb5d3209408',
        name: 'Confirmar Recebimento',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1500, 700],
    })
    ConfirmarRecebimento = {
        respondWith: 'json',
        responseBody:
            '={{ JSON.stringify({ status: "ok", message: "Update da Sala Técnica registrado! Dashboard enviado ao Felipe." }) }}',
        options: {
            responseCode: 200,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.DisparoDiario8h.out(0).to(this.MontarCobrancaSalaTecnica.in(0));
        this.MontarCobrancaSalaTecnica.out(0).to(this.EnviarParaSalaTecnicaWhatsapp.in(0));
        this.ReceberRespostaSalaTecnica.out(0).to(this.ParseRespostaSalaTecnica.in(0));
        this.ParseRespostaSalaTecnica.out(0).to(this.ValidarResposta.in(0));
        this.ValidarResposta.out(0).to(this.MontarDashboardFelipe.in(0));
        this.ValidarResposta.out(1).to(this.ConfirmarRecebimento.in(0));
        this.MontarDashboardFelipe.out(0).to(this.EnviarDashboardParaFabrizzioGerenteSlnr.in(0));
        this.EnviarDashboardParaFabrizzioGerenteSlnr.out(0).to(this.RegistrarNaPlataforma.in(0));
        this.RegistrarNaPlataforma.out(0).to(this.ConfirmarRecebimento.in(0));
    }
}
