import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Pardinho — Lean LPS + Planejamento Campo
// Nodes   : 9  |  Connections: 8
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ReceberPlanejamentoCampo           webhook
// ParseDadosCampo                    code
// CruzarPlanejadoXRealXGeral         code
// TemDesvioGrave                     if
// GerarAlertaLps                     code
// AlertarDiretorLuizFernando         httpRequest
// AtualizarPlanejamentoPlataforma    httpRequest
// ResponderOk                        respondToWebhook
// ResponderIncompleto                respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ReceberPlanejamentoCampo
//    → ParseDadosCampo
//      → CruzarPlanejadoXRealXGeral
//        → TemDesvioGrave
//          → GerarAlertaLps
//            → AlertarDiretorLuizFernando
//              → AtualizarPlanejamentoPlataforma
//                → ResponderOk
//         .out(1) → AtualizarPlanejamentoPlataforma (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '3OLzegqMNGmSfWYr',
    name: 'Pardinho — Lean LPS + Planejamento Campo',
    active: false,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class PardinhoLeanLpsPlanejamentoCampoWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'c5777714-324a-4fee-bab5-841c68a9479a',
        webhookId: 'c1182760-e70c-418f-8a30-46cefb91b23f',
        name: 'Receber Planejamento Campo',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 300],
    })
    ReceberPlanejamentoCampo = {
        path: 'pardinho-planejamento',
        httpMethod: 'POST',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: '2a76baef-9c14-496f-8669-6e2c97868504',
        name: 'Parse Dados Campo',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    ParseDadosCampo = {
        language: 'javaScript',
        jsCode: `
const body = $input.first().json.body || $input.first().json;
const hoje = new Date();
const semana = Math.ceil(((hoje - new Date(hoje.getFullYear(), 0, 1)) / 86400000 + new Date(hoje.getFullYear(), 0, 1).getDay() + 1) / 7);

const planejadoCampo = {
  data: hoje.toISOString().split('T')[0],
  semana_numero: semana,
  projeto: 'Pardinho — Consórcio Itapetininga',
  fonte: body.fonte || 'whatsapp_icaro',
  
  // Dados do campo (RDO acumulado)
  metros_executados_semana: parseFloat(body.metros_semana) || 0,
  ligacoes_executadas: parseInt(body.ligacoes) || 0,
  pvs_executados: parseInt(body.pvs) || 0,
  
  // Planejado campo (expectativa Ícaro)
  metros_planejados_proxima_semana: parseFloat(body.plano_metros) || 0,
  trechos_planejados: body.trechos || '',
  
  // Expectativa medição
  expectativa_medicao: parseFloat(body.expectativa_medicao?.toString().replace(/[^\\d.,]/g, '').replace(',','.')) || 0,
  
  // Restrições LPS
  restricoes: body.restricoes || [],
  pendencias: body.pendencias || '',
  
  // Validade
  valido: (parseFloat(body.metros_semana) || 0) > 0,
};

return [{ json: planejadoCampo }];
`,
    };

    @node({
        id: '52b9041b-da5d-4ac4-b4e4-90fd7865c100',
        name: 'Cruzar Planejado x Real x Geral',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [500, 300],
    })
    CruzarPlanejadoXRealXGeral = {
        language: 'javaScript',
        jsCode: `
const campo = $input.first().json;

// ─── Planejado Geral (meta contratual) ───
// Referência: PDF do contrato / Planejamento Mestre
const PLANEJADO_GERAL = {
  meta_semanal_metros: 250, // 250m/semana meta do contrato
  meta_mensal_metros: 1000,
  meta_ligacoes_semana: 15,
  meta_pvs_semana: 5,
  custo_meta_por_metro: 580, // R$/m orçado
  prazo_total_meses: 21,
  extensao_total: 16800, // metros totais do contrato
};

// Calcular desvios
const desvio_metros = campo.metros_executados_semana - PLANEJADO_GERAL.meta_semanal_metros;
const ppc = PLANEJADO_GERAL.meta_semanal_metros > 0
  ? Math.round((campo.metros_executados_semana / PLANEJADO_GERAL.meta_semanal_metros) * 100)
  : 0;

const desvio_ligacoes = campo.ligacoes_executadas - PLANEJADO_GERAL.meta_ligacoes_semana;
const desvio_pvs = campo.pvs_executados - PLANEJADO_GERAL.meta_pvs_semana;

// LPS — Percentual de Planos Concluídos
const lps = {
  ppc, // Percent Plan Complete
  semana: campo.semana_numero,
  status: ppc >= 100 ? 'on_track' : ppc >= 75 ? 'atencao' : 'critico',
  desvios: {
    metros: { real: campo.metros_executados_semana, planejado: PLANEJADO_GERAL.meta_semanal_metros, delta: desvio_metros },
    ligacoes: { real: campo.ligacoes_executadas, planejado: PLANEJADO_GERAL.meta_ligacoes_semana, delta: desvio_ligacoes },
    pvs: { real: campo.pvs_executados, planejado: PLANEJADO_GERAL.meta_pvs_semana, delta: desvio_pvs },
  },
  restricoes: campo.restricoes,
  temDesvioGrave: ppc < 75,
};

return [{ json: { campo, lps, planejadoGeral: PLANEJADO_GERAL } }];
`,
    };

    @node({
        id: '6bde32fe-005d-4a7c-a6c8-34c43b1d7a44',
        name: 'Tem Desvio Grave?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [750, 300],
    })
    TemDesvioGrave = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
            },
            combinator: 'and',
            conditions: [
                {
                    id: 'desvio-check',
                    leftValue: '={{ $json.lps.temDesvioGrave }}',
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
        id: '06257d68-9de7-4f0b-bd52-65c1aa18764f',
        name: 'Gerar Alerta LPS',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1000, 200],
    })
    GerarAlertaLps = {
        language: 'javaScript',
        jsCode: `
const data = $input.first().json;
const lps = data.lps;
const d = lps.desvios;

const alerta = [
  '🚨 *ALERTA LPS — PARDINHO*',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  \`📅 Semana \${lps.semana} | PPC: *\${lps.ppc}%*\`,
  '',
  '📉 *DESVIOS IDENTIFICADOS:*',
  \`  📏 Metros: \${d.metros.real}m / \${d.metros.planejado}m meta (\${d.metros.delta > 0 ? '+' : ''}\${d.metros.delta}m)\`,
  \`  🔗 Ligações: \${d.ligacoes.real} / \${d.ligacoes.planejado} meta (\${d.ligacoes.delta > 0 ? '+' : ''}\${d.ligacoes.delta})\`,
  \`  🕳️ PVs: \${d.pvs.real} / \${d.pvs.planejado} meta (\${d.pvs.delta > 0 ? '+' : ''}\${d.pvs.delta})\`,
  '',
  '⚠️ *AÇÃO NECESSÁRIA:*',
  '  • Revisar restrições e pendências',
  '  • Avaliar necessidade de reforço de equipe',
  '  • Atualizar planejamento semanal',
  '',
  lps.restricoes && lps.restricoes.length > 0 ? \`📋 *Restrições ativas:*\\n\${lps.restricoes.map(r => '  • ' + r).join('\\n')}\` : '',
  '',
  '🔗 https://construdatamaxv2-clean.vercel.app/app/planejamento',
].filter(Boolean).join('\\n');

return [{ json: { alerta, lps: data.lps, campo: data.campo, planejadoGeral: data.planejadoGeral } }];
`,
    };

    @node({
        id: 'd9eca6b5-1d42-4624-9318-79d981ce5465',
        name: 'Alertar Diretor Luiz Fernando',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1250, 200],
    })
    AlertarDiretorLuizFernando = {
        url: 'https://n8n-production-ae317.up.railway.app/webhook/construdata-notificacao',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ channel: "whatsapp", phone: "5537999425397", message: $json.alerta, project: "pardinho", type: "lps_alert" }) }}',
        options: {},
    };

    @node({
        id: 'db38ac16-897b-487f-a205-8e5284426c52',
        name: 'Atualizar Planejamento Plataforma',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1500, 300],
    })
    AtualizarPlanejamentoPlataforma = {
        url: 'https://construdatamaxv2-clean.vercel.app/api/lps/pardinho',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ lps: $json.lps || $("Cruzar Planejado x Real x Geral").first().json.lps, campo: $json.campo || $("Cruzar Planejado x Real x Geral").first().json.campo }) }}',
        options: {},
    };

    @node({
        id: 'e8197325-f4e2-4ca0-aaef-a3c97b051a21',
        name: 'Responder OK',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1750, 300],
    })
    ResponderOk = {
        respondWith: 'json',
        responseBody:
            '={{ JSON.stringify({ status: "ok", message: "✅ Planejamento Pardinho atualizado! LPS sincronizado com planejado geral." }) }}',
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: '91d6327f-859d-4592-887f-43e6bd563975',
        name: 'Responder Incompleto',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [750, 500],
    })
    ResponderIncompleto = {
        respondWith: 'json',
        responseBody:
            '={{ JSON.stringify({ status: "error", message: "❌ Dados insuficientes para o LPS. Envie pelo menos metros executados na semana." }) }}',
        options: {
            responseCode: 400,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ReceberPlanejamentoCampo.out(0).to(this.ParseDadosCampo.in(0));
        this.ParseDadosCampo.out(0).to(this.CruzarPlanejadoXRealXGeral.in(0));
        this.CruzarPlanejadoXRealXGeral.out(0).to(this.TemDesvioGrave.in(0));
        this.TemDesvioGrave.out(0).to(this.GerarAlertaLps.in(0));
        this.TemDesvioGrave.out(1).to(this.AtualizarPlanejamentoPlataforma.in(0));
        this.GerarAlertaLps.out(0).to(this.AlertarDiretorLuizFernando.in(0));
        this.AlertarDiretorLuizFernando.out(0).to(this.AtualizarPlanejamentoPlataforma.in(0));
        this.AtualizarPlanejamentoPlataforma.out(0).to(this.ResponderOk.in(0));
    }
}
