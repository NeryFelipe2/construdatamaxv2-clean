import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : CONSTRUDATA_CODEX2_RDO
// Nodes   : 6  |  Connections: 6
//
// NODE INDEX
// ------------------------------------------------------------------
// Property name                    Node type (short)         Flags
// WebhookRdo                       webhook
// RdoLogicEngine                   code
// UpdateState                      httpRequest
// IsFinished                       if
// SaveRdo                          httpRequest
// NotifyUser                       httpRequest
//
// ROUTING MAP
// ------------------------------------------------------------------
// WebhookRdo
//   -> RdoLogicEngine
//     -> UpdateState
//       -> IsFinished
//         -> SaveRdo
//           -> NotifyUser
//        .out(1) -> NotifyUser
// </workflow-map>

@workflow({
    id: 'codex2Rdo042226',
    name: 'CONSTRUDATA_CODEX2_RDO',
    active: false,
    settings: {
        executionOrder: 'v1',
        binaryMode: 'separate',
        timeSavedMode: 'fixed',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
    },
})
export class ConstrudataCodex2RdoWorkflow {
    @node({
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 300],
    })
    WebhookRdo = {
        httpMethod: 'POST',
        path: 'codex2-sub-rdo',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        name: 'RDO Logic Engine',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 300],
    })
    RdoLogicEngine = {
        jsCode: `const input = $json.body || $json;
const phone = input.phone;
const text = (input.text || '').trim();
let currentStep = input.state || 'start_rdo';
if (['@rdo', '#rdo', 'rdo'].includes(text.toLowerCase())) currentStep = 'start_rdo';
const currentData = input.data || {};
const user = input.user || { nome: 'Desconhecido' };

const PROJETOS = {
  '1': { nome: 'TATUI', id: 'c2bf8fda-b2e0-4bc1-9535-4891d596ea10', alcada: 'Obra RK - diretores Felipe, Luiz e Renato' },
  '2': { nome: 'OSASCO', id: 'f3c6645b-347f-4382-b9c5-d103c27ec511', alcada: 'Obra RK - diretores Felipe, Luiz e Renato' },
  '3': { nome: 'CONSORCIO / SLNR', id: 'abe7f66c-004b-4bb5-a245-6be67debd9f7', alcada: 'Consorcio / SLNR - Felipe gerente de sala tecnica' },
  '4': { nome: 'PARDINHO', id: 'ec112c9a-1669-4287-8079-526d6940ce82', alcada: 'Obra RK - diretores Felipe, Luiz e Renato' },
  '5': { nome: 'BRASILIA', id: '2a28beec-b1f8-4b0c-8416-d0710bb35d9d', alcada: 'ConstruData' },
  '6': { nome: 'RK SUB / SANTOS EMPREITA', id: 'd4e5f6a7-b8c9-4d0e-a1f2-b3c4d5e6f7a8', alcada: 'Obra RK - diretores Felipe, Luiz e Renato' },
};

function findProject(rawText) {
  const normalized = (rawText || '').trim().toUpperCase();
  if (PROJETOS[normalized]) return PROJETOS[normalized];
  for (const entry of Object.values(PROJETOS)) {
    if (normalized.includes(entry.nome) || entry.nome.includes(normalized)) return entry;
  }
  return { nome: normalized || 'NAO INFORMADO', id: null };
}

let nextStep = '';
let nextFlow = 'rdo';
let message = '';
let saveData = { ...currentData };

switch (currentStep) {
  case 'start_rdo':
  case 'rdo_flow':
    nextStep = 'waiting_obra';
    message = 'CODEX 2.0 RDO\\nQual obra?\\n\\n1 - Tatui (RK: Felipe/Luiz/Renato)\\n2 - Osasco (RK: Felipe/Luiz/Renato)\\n3 - Consorcio / SLNR (Felipe: sala tecnica)\\n4 - Pardinho (RK: Felipe/Luiz/Renato)\\n5 - Brasilia (ConstruData)\\n6 - RK Sub / Santos Empreita (RK: Felipe/Luiz/Renato)';
    break;
  case 'waiting_obra': {
    const projeto = findProject(text);
    saveData.obra = projeto.nome;
    saveData.project_id = projeto.id;
    saveData.alcada = projeto.alcada;
    nextStep = 'waiting_clima';
    message = 'Obra: ' + projeto.nome + '\\nAlcada: ' + (projeto.alcada || '-') + '\\nInforme o clima:\\n1 - Sol\\n2 - Chuva\\n3 - Nublado\\n4 - Chuvisco';
    break;
  }
  case 'waiting_clima': {
    const mapaClima = { '1': 'bom', '2': 'chuva', '3': 'nublado', '4': 'chuvisco' };
    saveData.clima = mapaClima[text] || text || 'bom';
    nextStep = 'waiting_equipe';
    message = 'Quantidade da equipe?';
    break;
  }
  case 'waiting_equipe':
    saveData.equipe_total = parseInt(text, 10) || 0;
    nextStep = 'waiting_producao';
    message = 'Producao em metros? Exemplo: 12.5';
    break;
  case 'waiting_producao':
    saveData.producao_m = parseFloat((text || '').replace(',', '.')) || 0;
    nextStep = 'waiting_turno';
    message = 'Turno?\\n1 - Diurno\\n2 - Noturno\\n3 - Integral';
    break;
  case 'waiting_turno': {
    const mapaTurno = { '1': 'Diurno', '2': 'Noturno', '3': 'Integral' };
    saveData.turno = mapaTurno[text] || text || 'Diurno';
    nextStep = 'waiting_atividades';
    message = 'Quais atividades realizadas?';
    break;
  }
  case 'waiting_atividades':
    saveData.atividades = text;
    nextStep = 'finished';
    nextFlow = 'idle';
    message = 'OK - RDO registrado e enviado para o ConstruData Gestao 360.\\n\\nObra: ' + (saveData.obra || '-') + '\\nClima: ' + (saveData.clima || '-') + '\\nEquipe: ' + (saveData.equipe_total || 0) + '\\nProducao: ' + (saveData.producao_m || 0) + ' m\\nTurno: ' + (saveData.turno || '-') + '\\nAtividades: ' + (saveData.atividades || '-') + '\\nApontador: ' + user.nome + '\\n\\nPipeline: WhatsApp -> n8n -> Supabase/rdos -> ConstruData Gestao 360';
    break;
  default:
    nextStep = 'idle';
    nextFlow = 'idle';
    message = 'Envie #rdo para reiniciar o fluxo CODEX 2.0.';
}

return { phone, nextStep, nextFlow, message, saveData, user };`,
    };

    @node({
        name: 'Update State',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [480, 300],
    })
    UpdateState = {
        method: 'POST',
        url: 'https://vblfdikfobsirwpdnybw.supabase.co/rest/v1/user_state?on_conflict=phone_number',
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
                { name: 'Content-Type', value: 'application/json' },
                { name: 'Prefer', value: 'resolution=merge-duplicates' },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ phone_number: $json.phone, current_flow: $json.nextFlow, current_step: $json.nextStep, flow_data: $json.saveData }) }}',
        options: {},
    };

    @node({
        name: 'Is Finished?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [720, 300],
    })
    IsFinished = {
        conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
            conditions: [
                {
                    id: 'done',
                    leftValue: "={{ $node['RDO Logic Engine'].json.nextStep }}",
                    rightValue: 'finished',
                    operator: { type: 'string', operation: 'equals' },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        name: 'Save RDO',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [960, 160],
    })
    SaveRdo = {
        method: 'POST',
        url: 'https://vblfdikfobsirwpdnybw.supabase.co/rest/v1/rdos',
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
                { name: 'Content-Type', value: 'application/json' },
                { name: 'Prefer', value: 'return=representation' },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ project_id: $node['RDO Logic Engine'].json.saveData.project_id, data: new Date().toISOString().split('T')[0], equipe_number: $node['RDO Logic Engine'].json.saveData.equipe_total, producao_m: $node['RDO Logic Engine'].json.saveData.producao_m || 0, clima: $node['RDO Logic Engine'].json.saveData.clima, turno: $node['RDO Logic Engine'].json.saveData.turno || 'Diurno', observacoes: $node['RDO Logic Engine'].json.saveData.atividades, apontador: ($node['RDO Logic Engine'].json.user || {}).nome || 'WhatsApp', status: 'aberto', fotos: [] }) }}",
        options: {},
    };

    @node({
        name: 'Notify User',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [960, 440],
    })
    NotifyUser = {
        method: 'POST',
        url: "={{ (($env.EVOLUTION_API_URL || 'http://evolution:8080').replace(/\\/$/, '')) + '/message/sendText/' + ($env.EVOLUTION_INSTANCE || 'construdata-felipe') }}",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'apikey',
                    value: "={{ $env.EVOLUTION_API_KEY || 'construdata2026' }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ number: $node['RDO Logic Engine'].json.phone, text: $node['RDO Logic Engine'].json.message }) }}",
        options: {},
    };

    @links()
    defineRouting() {
        this.WebhookRdo.out(0).to(this.RdoLogicEngine.in(0));
        this.RdoLogicEngine.out(0).to(this.UpdateState.in(0));
        this.UpdateState.out(0).to(this.IsFinished.in(0));
        this.IsFinished.out(0).to(this.SaveRdo.in(0));
        this.SaveRdo.out(0).to(this.NotifyUser.in(0));
        this.IsFinished.out(1).to(this.NotifyUser.in(0));
    }
}
