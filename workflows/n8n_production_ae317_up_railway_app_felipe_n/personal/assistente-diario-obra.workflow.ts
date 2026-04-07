import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Assistente Diário de Obra
// Nodes   : 8  |  Connections: 7
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// DisparoDiario5h30                  scheduleTrigger
// ConsultaClimaSantosSp              httpRequest
// MontaResumoDoDia                   code
// ClimaRuim                          if
// EnviarAlertaClima                  httpRequest
// GerarTemplateRdo                   code
// NotificarEquipe                    httpRequest
// RegistrarNaPlataforma              httpRequest
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// DisparoDiario5h30
//    → ConsultaClimaSantosSp
//      → MontaResumoDoDia
//        → ClimaRuim
//          → EnviarAlertaClima
//         .out(1) → GerarTemplateRdo
//            → NotificarEquipe
//              → RegistrarNaPlataforma
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '8qGfvzqfYAwGXCzF',
    name: 'Assistente Diário de Obra',
    active: false,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class AssistenteDiarioDeObraWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '625dee28-15b5-4c50-96e6-b04d3559093b',
        name: 'Disparo Diário 5h30',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 300],
    })
    DisparoDiario5h30 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '30 5 * * 1-6',
                },
            ],
        },
    };

    @node({
        id: '452b645d-1947-4307-ad26-a94930aba840',
        name: 'Consulta Clima Santos/SP',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [250, 300],
    })
    ConsultaClimaSantosSp = {
        url: 'https://api.open-meteo.com/v1/forecast',
        method: 'GET',
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'latitude',
                    value: '-23.9608',
                },
                {
                    name: 'longitude',
                    value: '-46.3336',
                },
                {
                    name: 'current',
                    value: 'temperature_2m,precipitation,rain,wind_speed_10m,weather_code',
                },
                {
                    name: 'hourly',
                    value: 'precipitation_probability,temperature_2m',
                },
                {
                    name: 'forecast_days',
                    value: '1',
                },
                {
                    name: 'timezone',
                    value: 'America/Sao_Paulo',
                },
            ],
        },
        options: {},
    };

    @node({
        id: '8e280617-9e46-4af1-90e1-7282ce7287d1',
        name: 'Monta Resumo do Dia',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [500, 300],
    })
    MontaResumoDoDia = {
        language: 'javaScript',
        jsCode: `
const clima = $input.first().json;
const current = clima.current || {};
const hourly = clima.hourly || {};

// Interpreta weather code WMO
const weatherCodes = {
  0: '☀️ Céu limpo', 1: '🌤️ Parcialmente nublado', 2: '⛅ Nublado',
  3: '☁️ Encoberto', 45: '🌫️ Névoa', 48: '🌫️ Geada',
  51: '🌧️ Garoa leve', 53: '🌧️ Garoa moderada', 55: '🌧️ Garoa forte',
  61: '🌧️ Chuva leve', 63: '🌧️ Chuva moderada', 65: '🌧️ Chuva forte',
  80: '🌦️ Pancadas leves', 81: '🌦️ Pancadas moderadas', 82: '⛈️ Pancadas fortes',
  95: '⛈️ Tempestade', 96: '⛈️ Tempestade com granizo'
};

const temp = current.temperature_2m || 0;
const precip = current.precipitation || 0;
const rain = current.rain || 0;
const wind = current.wind_speed_10m || 0;
const code = current.weather_code || 0;
const descricao = weatherCodes[code] || 'Indeterminado';

// Probabilidade de chuva nas próximas 12h
const probChuva = hourly.precipitation_probability 
  ? hourly.precipitation_probability.slice(0, 12) 
  : [];
const maxProb = probChuva.length > 0 ? Math.max(...probChuva) : 0;

// Calcular se é dia de risco
const climaRuim = rain > 5 || precip > 5 || maxProb > 70 || wind > 40 || code >= 61;

// Montar texto do briefing
const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
const briefing = [
  '📋 *BRIEFING DIÁRIO DE OBRA*',
  '━━━━━━━━━━━━━━━━━━━━━━━',
  \`📅 \${hoje}\`,
  \`🏗️ CT 11481051 — SABESP / Santos-Osasco\`,
  '',
  '*🌤️ CONDIÇÕES CLIMÁTICAS*',
  \`  Tempo: \${descricao}\`,
  \`  Temp: \${temp}°C | Vento: \${wind} km/h\`,
  \`  Chuva atual: \${rain} mm\`,
  \`  Prob. chuva (12h): \${maxProb}%\`,
  '',
  climaRuim 
    ? '⚠️ *ALERTA: Condições adversas — avaliar frentes de trabalho!*'
    : '✅ *Condições favoráveis para trabalho em campo*',
  '',
  '*📌 CHECKLIST DO DIA*',
  '  □ DDS (Diálogo Diário de Segurança)',
  '  □ Conferir equipes por frente',
  '  □ Verificar materiais disponíveis',
  '  □ Atualizar RDO até 18:00',
  '  □ Fotos dos trechos executados',
  '',
  '*🔗 Acessar plataforma:*',
  'https://construdatamaxv2-clean.vercel.app/app/gestao-360'
].join('\\n');

return [{ json: { briefing, climaRuim, temp, rain, wind, maxProb, descricao, hoje } }];
`,
    };

    @node({
        id: 'b1adf92a-7fe6-4719-9777-437475fc192d',
        name: 'Clima Ruim?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [750, 300],
    })
    ClimaRuim = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
            },
            combinator: 'and',
            conditions: [
                {
                    id: 'clima-check',
                    leftValue: '={{ $json.climaRuim }}',
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
        id: 'd58d0e78-5afe-4f0c-a6d6-147e951c0a56',
        name: 'Enviar Alerta Clima',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1000, 150],
    })
    EnviarAlertaClima = {
        url: 'https://construdatamaxv2-clean.vercel.app/api/alerts',
        method: 'POST',
        sendBody: true,
        bodyParameters: {
            parameters: [
                {
                    name: 'type',
                    value: 'weather_alert',
                },
                {
                    name: 'severity',
                    value: 'high',
                },
                {
                    name: 'message',
                    value: '={{ $json.briefing }}',
                },
                {
                    name: 'temp',
                    value: '={{ $json.temp }}',
                },
                {
                    name: 'rain',
                    value: '={{ $json.rain }}',
                },
                {
                    name: 'wind',
                    value: '={{ $json.wind }}',
                },
            ],
        },
        options: {
            response: {
                response: {
                    fullResponse: false,
                },
            },
        },
    };

    @node({
        id: '106e904a-266e-4eb5-850f-29a8f39e05e5',
        name: 'Gerar Template RDO',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1000, 450],
    })
    GerarTemplateRdo = {
        language: 'javaScript',
        jsCode: `
const data = $input.first().json;
const hoje = new Date().toISOString().split('T')[0];

const rdoTemplate = {
  data: hoje,
  contrato: 'CT 11481051',
  cliente: 'SABESP',
  cidade: 'Santos/Osasco',
  clima: {
    condicao: data.descricao || 'Não informado',
    temperatura: data.temp || 0,
    chuva_mm: data.rain || 0,
    vento_kmh: data.wind || 0,
    prob_chuva_pct: data.maxProb || 0,
  },
  status: data.climaRuim ? 'CONDICIONADO' : 'NORMAL',
  equipes: [
    { frente: 'Rede Coletora', equipe: 'EQ-01', status: 'pendente' },
    { frente: 'Ligações Prediais', equipe: 'EQ-02', status: 'pendente' },
    { frente: 'Poços de Visita', equipe: 'EQ-03', status: 'pendente' },
  ],
  atividades: [],
  fotos: [],
  observacoes: data.climaRuim 
    ? 'ATENÇÃO: Condições climáticas adversas. Avaliar frentes antes de iniciar.' 
    : '',
  briefing: data.briefing,
};

return [{ json: rdoTemplate }];
`,
    };

    @node({
        id: '9c4e9095-ad1d-4a10-9f93-44aa54d5f23f',
        name: 'Notificar Equipe',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1250, 450],
    })
    NotificarEquipe = {
        url: 'https://n8n-production-ae317.up.railway.app/webhook/construdata-notificacao',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ channel: "obra", message: $json.briefing, rdo: $json }) }}',
        options: {},
    };

    @node({
        id: 'aa0f208a-03d5-4903-8013-7c9077d90555',
        name: 'Registrar na Plataforma',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1500, 450],
    })
    RegistrarNaPlataforma = {
        url: 'https://construdatamaxv2-clean.vercel.app/api/rdo/auto',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify($json) }}',
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.DisparoDiario5h30.out(0).to(this.ConsultaClimaSantosSp.in(0));
        this.ConsultaClimaSantosSp.out(0).to(this.MontaResumoDoDia.in(0));
        this.MontaResumoDoDia.out(0).to(this.ClimaRuim.in(0));
        this.ClimaRuim.out(0).to(this.EnviarAlertaClima.in(0));
        this.ClimaRuim.out(1).to(this.GerarTemplateRdo.in(0));
        this.GerarTemplateRdo.out(0).to(this.NotificarEquipe.in(0));
        this.NotificarEquipe.out(0).to(this.RegistrarNaPlataforma.in(0));
    }
}
