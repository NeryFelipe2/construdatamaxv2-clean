import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : CONSTRUDATA_CODEX2_MASTER
// Nodes   : 12  |  Connections: 11
//
// NODE INDEX
// ------------------------------------------------------------------
// Property name                    Node type (short)         Flags
// Webhook                          webhook
// Extract                          code
// LookupContato                    httpRequest
// GetState                         httpRequest
// Decide                           code
// IsRdo                            if
// IsFinanceiro                     if
// CallRdo                          httpRequest
// CallFinanceiro                   httpRequest
// SendHelp                         httpRequest
// IsTarefa                         if
// CallTarefa                       httpRequest
//
// ROUTING MAP
// ------------------------------------------------------------------
// Webhook
//   -> Extract
//     -> LookupContato
//       -> GetState
//         -> Decide
//           -> IsRdo
//             -> CallRdo
//           -> IsFinanceiro
//             -> CallFinanceiro
//           -> IsTarefa
//             -> CallTarefa
//            .out(1) -> SendHelp
// </workflow-map>

@workflow({
    id: 'codex2Master0422',
    name: 'CONSTRUDATA_CODEX2_MASTER',
    active: false,
    settings: { executionOrder: 'v1', binaryMode: 'separate' },
})
export class ConstrudataCodex2MasterWorkflow {
    @node({
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1200, 304],
    })
    Webhook = {
        httpMethod: 'POST',
        path: 'codex2-whatsapp-master',
        options: {},
    };

    @node({
        name: 'Extract',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-960, 304],
    })
    Extract = {
        jsCode: "const items = $input.all();\nif (items.length === 0) return [];\n\nconst out = [];\nfor (const item of items) {\n  const raw = item.json;\n  const payload = raw.body || raw;\n\n  if (payload.event && ['messages.update', 'messages.delete', 'send.message'].includes(payload.event)) {\n    continue;\n  }\n\n  const msg = payload.data || payload;\n  const remoteJid = msg.key?.remoteJid || msg.remoteJid;\n  if (!remoteJid || remoteJid.includes('@g.us')) continue;\n\n  const phone = remoteJid.replace('@s.whatsapp.net', '').split('@')[0];\n\n  let text = '';\n  if (msg.message?.conversation) text = msg.message.conversation;\n  else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;\n  else if (msg.message?.imageMessage?.caption) text = msg.message.imageMessage.caption;\n\n  const fromMe = msg.key?.fromMe || false;\n  const normalized = (text || '').trim().toLowerCase();\n  const ownCommand = /^(menu|m|ajuda|help|comandos|opcoes|opções|oi|ola|olá|bom dia|boa tarde|boa noite|[1-9]|1[0-6])$/.test(normalized) || normalized.startsWith('@') || normalized.startsWith('#');\n  if (fromMe && !ownCommand) continue;\n\n  const hasImage = !!msg.message?.imageMessage;\n  const imageBase64 = hasImage && msg.message?.imageMessage?.base64 ? msg.message.imageMessage.base64 : '';\n\n  if (text || hasImage) {\n    out.push({ phone, text, hasImage, imageBase64, raw: msg, fromMe });\n  }\n}\n\nreturn out;",
    };

    @node({
        name: 'Lookup Contato',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [-720, 192],
    })
    LookupContato = {
        url: "=https://vblfdikfobsirwpdnybw.supabase.co/rest/v1/contatos?select=id,nome,cargo,projeto_id,frente_id,telefone_whatsapp&or=(telefone_whatsapp.eq.{{ $json.phone }},telefone_whatsapp.eq.{{ (() => { const p = $json.phone; if (p.length === 12 && p.startsWith('55')) return p.slice(0,4) + '9' + p.slice(4); return p; })() }})",
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
            ],
        },
        options: {},
    };

    @node({
        name: 'Get State',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [-720, 432],
        alwaysOutputData: true,
    })
    GetState = {
        url: "=https://vblfdikfobsirwpdnybw.supabase.co/rest/v1/user_state?select=*&or=(phone_number.eq.{{ $node.Extract.json.phone }},phone_number.eq.{{ (() => { const p = $node.Extract.json.phone; if (p.length === 12 && p.startsWith('55')) return p.slice(0,4) + '9' + p.slice(4); return p; })() }})&limit=1",
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
            ],
        },
        options: {},
    };

    @node({
        name: 'Decide',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-480, 304],
    })
    Decide = {
        jsCode: `const stateRaw = $json;
const extracted = $('Extract').first().json;
const phone = extracted.phone;
const text = extracted.text || '';
const hasImage = extracted.hasImage;
const raw = extracted.raw;
const imageBase64 = extracted.imageBase64;
const emit = (payload) => [{ json: payload }];

const contatoRaw = $('Lookup Contato').first().json;
let contato = null;
if (contatoRaw && contatoRaw.nome) contato = contatoRaw;
else if (Array.isArray(contatoRaw) && contatoRaw.length > 0) contato = contatoRaw[0];
if (!contato || !contato.nome) return [];

const stateList = Array.isArray(stateRaw) ? stateRaw : (stateRaw ? [stateRaw] : []);
const current = stateList.length > 0 && stateList[0].current_step ? stateList[0] : null;

const user = {
  phone,
  nome: contato.nome,
  cargo: contato.cargo,
  projeto_id: contato.projeto_id,
  frente_id: contato.frente_id,
};

const fullMenu = [
  '🤖 ConstruDataMax Gestão 360',
  'Olá ' + user.nome + '!',
  '',
  '📊 Opções de Comando:',
  '1️⃣ Status RDO Hoje',
  '2️⃣ Equipe e Contatos',
  '3️⃣ Projetos Ativos',
  '4️⃣ Dashboard Consolidado',
  '5️⃣ Reenviar Cobrança (Alerta Geral)',
  '6️⃣ Falar com Inteligência Artificial',
  '7️⃣ Cobrar RDO (Dispara formulário)',
  '8️⃣ Meu RDO Diretor (Supervisão)',
  '9️⃣ Lembrar Tarefas (Cobra diretores)',
  '🔟 Criar Tarefas (Guia de Uso)',
  '1️⃣1️⃣ Plano de Custos (Financeiro)',
  '1️⃣2️⃣ Tarefas Consórcio (Delega por setor)',
  '1️⃣3️⃣ Enviar Tarefa por Pessoa',
  '1️⃣4️⃣ Enviar Tarefa à Diretoria',
  '1️⃣5️⃣ Enviar Tarefa aos Engenheiros',
  '1️⃣6️⃣ Enviar Tarefa por Setor',
  '',
  '▶️ Digite o número da opção (ex: 1) ou use os @comandos diretamente.',
  '🔗 https://construdatamaxv2-clean.vercel.app',
  'Construdata Gestão 360 powered by FCN-Construções e Saneamento',
].join('\\n');

const directorRdo = '📋 MEU RDO DIRETOR — Supervisão\\n\\nResponda os tópicos do dia (formato: 1: texto | 2: texto):\\n\\n(1) Frentes visitadas hoje\\n(2) Decisões tomadas\\n(3) Riscos/alertas\\n(4) Previsão próximo marco\\n(5) Observações gerais';
const lembrar = '⏰ LEMBRAR TAREFAS\\n\\nUse: @lembrar <nome>\\n\\n⚠️ Sem envio em massa — confidencialidade entre projetos.\\n\\nNomes:\\n* renato\\n* luiz (ou lf)\\n* fabrizzio\\n* felipe\\n\\nEx: @lembrar renato';
const tarefaPessoa = '👤 TAREFA POR PESSOA\\n\\nUse: @tarefa <nome> <descrição>\\n\\nNomes: icaro, mateus, alexandre, igor, gabriel, vinicius, junior, valdean, veronica, jose marcio, thalita, felipe\\n\\nEx: @tarefa icaro enviar foto do trecho até 17h';
const tarefaDiretoria = '👔 TAREFA DIRETORIA\\n\\nUse: @tarefadiretoria <nome> <descrição>\\n\\n⚠️ Sem envio em massa — confidencialidade entre projetos.\\n\\nNomes aceitos:\\n* renato\\n* luiz (ou lf)\\n* fabrizzio\\n* felipe\\n\\nEx: @tarefadiretoria renato revisar custos Osasco até sexta';
const tarefaEngenheiros = '👷 TAREFA ENGENHEIROS\\n\\nUse: @tarefaengenheiros <projeto> <descrição>\\n\\n⚠️ Sem envio em massa — confidencialidade entre projetos.\\n\\nProjetos:\\n* pardinho -> Ícaro\\n* tatui -> Ícaro\\n* osasco -> Mateus\\n* rk -> Alexandre/Igor\\n\\nEx: @tarefaengenheiros tatui foto da frente até 17h';
const tarefaSetor = '🏭 TAREFA POR SETOR (Consórcio)\\n\\nUse: @tarefaconsorcio <setor> <descrição>\\n\\nSetores: planejamento, producao, sala, todos\\n\\nFabrizzio sempre recebe cópia.\\nEx: @tarefaconsorcio sala revisar NS-12';
const planoCustos = '💰 PLANO DE CUSTOS (Financeiro)\\n\\nAs perguntas de custo vão embutidas no RDO dos engenheiros de campo.\\n\\nUse a opção 11 ou @pagamento para abrir o fluxo financeiro.';

const statusRdo = '📊 STATUS RDO HOJE\\n\\nConsulta rápida do RDO operacional.\\n\\nPara lançar um novo RDO, use a opção 7 ou envie @rdo.\\nPara acompanhar no painel, acesse:\\nhttps://construdatamaxv2-clean.vercel.app';
const equipeContatos = '👥 EQUIPE E CONTATOS\\n\\nPrincipais alçadas cadastradas:\\nFelipe Nery - Diretor / Gestor\\nLuiz Fernando - Diretor Pardinho/Osasco/RK\\nRenato - Diretor Osasco/RK\\nFabrizzio - Gerente Consórcio\\nÍcaro - Engenheiro de Campo\\nMateus - Engenheiro de Campo\\nAlexandre/Igor - RK Sub Empreita\\nGabriel/Vinicius - Sala Técnica';
const projetosAtivos = '🏗️ PROJETOS ATIVOS\\n\\n1 - Tatuí\\n2 - Osasco\\n3 - Consórcio Se Liga na Rede\\n4 - Pardinho\\n5 - Brasília\\n6 - RK Sub Empreita\\n\\nPara lançar RDO de obra, envie @rdo ou escolha 7.';
const dashboardConsolidado = '📈 DASHBOARD CONSOLIDADO\\n\\nAcesse o ConstruData Gestão 360:\\nhttps://construdatamaxv2-clean.vercel.app\\n\\nO RDO enviado pelo WhatsApp sobe no Supabase e aparece no painel da obra vinculada.';
const reenviarCobranca = '📣 REENVIAR COBRANÇA\\n\\nComando reservado para alerta geral de RDO/cobrança.\\n\\nSe quiser cobrar RDO agora, use a opção 7.';
const iaMenu = '🤖 INTELIGÊNCIA ARTIFICIAL\\n\\nEnvie sua pergunta depois de @ia.\\n\\nEx: @ia resumir status das obras\\n\\nPara RDO, use @rdo ou opção 7.';

const lower = text.toLowerCase().trim();
if (['menu', 'm', 'ajuda', 'help', 'comandos', 'opcoes', 'opções', 'oi', 'ola', 'olá', 'bom dia', 'boa tarde', 'boa noite'].includes(lower)) {
  return emit({ action: 'help', helpText: fullMenu, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower === '8' || lower === '@meurdo' || lower === '#meurdo') {
  return emit({ action: 'help', helpText: directorRdo, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower === '9' || lower === '@guialembrar') {
  return emit({ action: 'help', helpText: lembrar, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower === '10') {
  return emit({ action: 'help', helpText: tarefaPessoa, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower === '1') {
  return emit({ action: 'help', helpText: statusRdo, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower === '2') {
  return emit({ action: 'help', helpText: equipeContatos, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower === '3') {
  return emit({ action: 'help', helpText: projetosAtivos, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower === '4') {
  return emit({ action: 'help', helpText: dashboardConsolidado, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower === '5') {
  return emit({ action: 'help', helpText: reenviarCobranca, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower === '6' || lower === '@ia' || lower.startsWith('@ia ')) {
  return emit({ action: 'help', helpText: iaMenu, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower === '11' || lower.includes('#gasto') || lower.includes('#financeiro') || lower.includes('@pagamento') || hasImage) {
  return emit({ action: 'fin', phone, text, hasImage, imageBase64, raw, state: 'start_financeiro', data: {}, user });
}
if (lower === '12' || lower === '@guiatarefasetor') {
  return emit({ action: 'help', helpText: tarefaSetor, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower === '13' || lower === '@guiatarefa' || lower === '@guiatarefapessoa') {
  return emit({ action: 'help', helpText: tarefaPessoa, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower === '14' || lower === '@guiatarefadiretoria') {
  return emit({ action: 'help', helpText: tarefaDiretoria, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower === '15' || lower === '@guiatarefaengenheiros') {
  return emit({ action: 'help', helpText: tarefaEngenheiros, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower === '16') {
  return emit({ action: 'help', helpText: tarefaSetor, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (current && current.current_step && current.current_step !== 'idle' && current.current_step !== 'finished') {
  const flow = current.current_flow || 'rdo';
  return emit({
    action: 'continue_' + flow,
    phone,
    text,
    hasImage,
    imageBase64,
    raw,
    state: current.current_step,
    data: current.flow_data || {},
    user,
  });
}
if (lower === '7' || lower.includes('#rdo') || lower.includes('@rdo')) {
  return emit({ action: 'rdo', phone, text, hasImage, imageBase64, raw, state: 'start_rdo', data: { menuOption: lower }, user });
}
if (lower.startsWith('@tarefaconsorcio') && lower.split(/\\s+/).length < 3) {
  return emit({ action: 'help', helpText: tarefaSetor, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });
}
if (lower.startsWith('@tarefa') || lower.includes('#tarefa')) {
  return emit({ action: 'tarefa', phone, text, hasImage, imageBase64, raw, state: 'start_tarefa', data: {}, user });
}
return emit({ action: 'help', helpText: fullMenu, phone, text, hasImage, imageBase64, raw, state: 'idle', data: {}, user });`,
    };

    @node({
        name: 'Is RDO?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [-240, 112],
    })
    IsRdo = {
        conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
            conditions: [
                {
                    id: 'rdo',
                    leftValue: '={{ $json.action }}',
                    rightValue: 'rdo',
                    operator: { type: 'string', operation: 'contains' },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        name: 'Is Financeiro?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [-240, 400],
    })
    IsFinanceiro = {
        conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
            conditions: [
                {
                    id: 'fin',
                    leftValue: '={{ $json.action }}',
                    rightValue: 'fin',
                    operator: { type: 'string', operation: 'contains' },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        name: 'Call RDO',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [0, 0],
    })
    CallRdo = {
        method: 'POST',
        url: "={{ (($env.WEBHOOK_URL || 'http://localhost:5678/').replace(/\\/$/, '')) + '/webhook/codex2Rdo042226/webhook/codex2-sub-rdo' }}",
        sendHeaders: true,
        headerParameters: {
            parameters: [{ name: 'Content-Type', value: 'application/json' }],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ phone: $json.phone, text: $json.text, state: $json.state, data: $json.data, user: $json.user }) }}',
        options: {},
    };

    @node({
        name: 'Call Financeiro',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [0, 304],
    })
    CallFinanceiro = {
        method: 'POST',
        url: "={{ (($env.WEBHOOK_URL || 'http://localhost:5678/').replace(/\\/$/, '')) + '/webhook/codex2Fin042226/webhook/codex2-financeiro' }}",
        sendHeaders: true,
        headerParameters: {
            parameters: [{ name: 'Content-Type', value: 'application/json' }],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ phone: $json.phone, text: $json.text, hasImage: $json.hasImage, imageBase64: $json.imageBase64, raw: $json.raw, state: $json.state, data: $json.data, user: $json.user }) }}',
        options: {},
    };

    @node({
        name: 'Send Help',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [0, 608],
    })
    SendHelp = {
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
        jsonBody: "={{ JSON.stringify({ number: $json.phone, text: $json.helpText }) }}",
        options: {},
    };

    @node({
        name: 'Is Tarefa?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [-240, 704],
    })
    IsTarefa = {
        conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
            conditions: [
                {
                    id: 'tar',
                    leftValue: '={{ $json.action }}',
                    rightValue: 'tarefa',
                    operator: { type: 'string', operation: 'contains' },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        name: 'Call Tarefa',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [0, 704],
    })
    CallTarefa = {
        method: 'POST',
        url: "={{ (($env.WEBHOOK_URL || 'http://localhost:5678/').replace(/\\/$/, '')) + '/webhook/codex2Task04226/webhook/codex2-sub-tarefa' }}",
        sendHeaders: true,
        headerParameters: {
            parameters: [{ name: 'Content-Type', value: 'application/json' }],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ phone: $json.phone, text: $json.text, user_nome: $json.user.nome, user_id: $json.user.projeto_id }) }}',
        options: {},
    };

    @links()
    defineRouting() {
        this.Webhook.out(0).to(this.Extract.in(0));
        this.Extract.out(0).to(this.LookupContato.in(0));
        this.LookupContato.out(0).to(this.GetState.in(0));
        this.GetState.out(0).to(this.Decide.in(0));
        this.Decide.out(0).to(this.IsRdo.in(0));
        this.IsRdo.out(0).to(this.CallRdo.in(0));
        this.IsRdo.out(1).to(this.IsFinanceiro.in(0));
        this.IsFinanceiro.out(0).to(this.CallFinanceiro.in(0));
        this.IsFinanceiro.out(1).to(this.IsTarefa.in(0));
        this.IsTarefa.out(0).to(this.CallTarefa.in(0));
        this.IsTarefa.out(1).to(this.SendHelp.in(0));
    }
}
