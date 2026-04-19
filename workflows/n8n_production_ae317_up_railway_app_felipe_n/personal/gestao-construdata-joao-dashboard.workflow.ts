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
// EnviarParaJoaoWhatsapp             httpRequest                [creds]
// ReceberRespostaJoao                webhook
// ParseRespostaJoao                  code
// DadosCompletos                     if
// MontarDashboardFelipe              code
// EnviarDashboardParaFelipe          httpRequest                [creds]
// RegistrarNaPlataforma              httpRequest
// ConfirmarRecebimento               respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// DisparoDiario7h
//    → MontarQuestionarioJoao
//      → EnviarParaJoaoWhatsapp
// ReceberRespostaJoao
//    → ParseRespostaJoao
//      → DadosCompletos
//        → MontarDashboardFelipe
//          → EnviarDashboardParaFelipe
//            → RegistrarNaPlataforma
//              → ConfirmarRecebimento
//       .out(1) → ConfirmarRecebimento (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'asoqRI8fbz3SKlz5',
    name: 'Gestão ConstruData — Direcionamento João + Dashboard Felipe',
    active: false,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class GestaoConstrudataDirecionamentoJoaoDashboardFelipeWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'd12639c7-e7bc-48bd-8ada-b9791a15c4e8',
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
        id: 'f9ad6af2-68ca-4899-840b-e6dc314057fe',
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
        id: 'c137f3db-2d35-4104-a959-28510f44b998',
        name: 'Enviar para João WhatsApp',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [500, 300],
        credentials: { httpHeaderAuth: { id: '1qo5XC8PQEzGWwAN', name: 'Evolution API' } },
    })
    EnviarParaJoaoWhatsapp = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: $json.destinatario, textMessage: { text: $json.mensagem } }) }}',
        options: {},
    };

    @node({
        id: 'dd96e1d3-a3cc-437e-ae96-8d93a716f90e',
        webhookId: '9fe69720-7c66-4e89-9e08-fc79b89e4996',
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
        id: '604c2025-d908-4964-8de9-a3bfbcc40d13',
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
        id: 'd629a8fb-bfb2-4ad6-9afa-3a2cc1aa756e',
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
        id: '7d592da9-e85b-4899-ade8-8e147297d4bd',
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
        id: '586ad14b-11d1-4c46-b907-daa2d93bae51',
        name: 'Enviar Dashboard para Felipe',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1000, 600],
        credentials: { httpHeaderAuth: { id: '1qo5XC8PQEzGWwAN', name: 'Evolution API' } },
    })
    EnviarDashboardParaFelipe = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: "5561981846325", textMessage: { text: $json.dashboard } }) }}',
        options: {},
    };

    @node({
        id: 'b20e4a3a-c677-4d8e-83ad-88b2156f3a9e',
        name: 'Registrar na Plataforma',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1250, 600],
    })
    RegistrarNaPlataforma = {
        url: 'https://construdatamaxv2-clean.vercel.app/api/rdo/santos',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify($json.rdo || $json) }}',
        options: {},
    };

    @node({
        id: '9b500d71-608e-45b5-bce4-e5ab61a5b585',
        name: 'Confirmar Recebimento',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1500, 700],
    })
    ConfirmarRecebimento = {
        respondWith: 'json',
        responseBody:
            '={{ JSON.stringify({ status: "ok", message: "RDO Santos registrado! Dashboard enviado para Felipe." }) }}',
        options: {
            responseCode: 200,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.DisparoDiario7h.out(0).to(this.MontarQuestionarioJoao.in(0));
        this.MontarQuestionarioJoao.out(0).to(this.EnviarParaJoaoWhatsapp.in(0));
        this.ReceberRespostaJoao.out(0).to(this.ParseRespostaJoao.in(0));
        this.ParseRespostaJoao.out(0).to(this.DadosCompletos.in(0));
        this.DadosCompletos.out(0).to(this.MontarDashboardFelipe.in(0));
        this.DadosCompletos.out(1).to(this.ConfirmarRecebimento.in(0));
        this.MontarDashboardFelipe.out(0).to(this.EnviarDashboardParaFelipe.in(0));
        this.EnviarDashboardParaFelipe.out(0).to(this.RegistrarNaPlataforma.in(0));
        this.RegistrarNaPlataforma.out(0).to(this.ConfirmarRecebimento.in(0));
    }
}
