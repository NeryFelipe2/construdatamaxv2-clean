import { workflow, node, links } from '@n8n-as-code/transformer';

/**
 * ============================================================================
 * 🚀 SUPER WORKFLOW - CONSTRUDATA MAX V2 - UNIFIED MEGA WORKFLOW
 * ============================================================================
 * 
 * This mega-workflow consolidates ALL construction management automations:
 * 
 * 1. GESTAO WHATSAPP ROUTER - Main WhatsApp command handler (RDO, tasks, financial OCR)
 * 2. ALERTA MEDICAO PRAZOS - Deadline monitoring for measurements and regulatory milestones
 * 3. ASSISTENTE DIARIO OBRA - Daily construction assistant with weather forecasts
 * 4. COBRANCA MATINAL DIRETOR - Morning task delegation reminders for directors
 * 5. WEBHOOK RDO WHATSAPP - Structured RDO submission webhook handler
 * 6. GESTAO CONSTRUDATA JOAO DASHBOARD - João's Santos project daily dashboard
 * 7. GESTAO OSASCO RDO DASHBOARD - Osasco CLU project RDO + email reports
 * 8. GESTAO PARDINHO RDO DASHBOARD - Pardinho Itapetininga project RDO + email reports
 * 9. GESTAO SALA TECNICA DASHBOARD - SLNR Santos technical room status tracking
 * 10. PARDINHO LEAN LPS PLANEJAMENTO - Lean Last Planner System for Pardinho
 * 
 * Total: 10 independent workflows merged into ONE unified system
 * All triggers, webhooks, schedules, and business logic preserved
 */

// ============================================================================
// WORKFLOW 1: GESTAO WHATSAPP ROUTER (Main Command Handler)
// ============================================================================

@workflow({
    id: 'gestao-whatsapp-router-main',
    name: '🚀 ConstruDataMax - Super Workflow Unified',
    active: true,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class GestaoWhatsappRouterWorkflow {
    
    @node({
        id: 'whatsapp-webhook-main',
        name: 'Webhook Evolution API Router',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 0],
    })
    WebhookEvolutionRouter = {
        path: 'webhook/evolution-router',
        httpMethod: 'POST',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: 'code-parse-message',
        name: 'Parse WhatsApp Message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 0],
    })
    ParseMessage = {
        language: 'javaScript',
        jsCode: `
const body = $input.first().json.body || $input.first().json;
const msg = body.message || body.text || body.Body || '';
const phone = body.phone || body.from || body.From || '';
const timestamp = body.timestamp || new Date().toISOString();

// Detectar projeto pelo número de telefone
function resolverProjectId(nome) {
  if (!nome) return null;
  const n = nome.toLowerCase();
  if (n.indexOf('pardinho') >= 0 || n.indexOf('itapetininga') >= 0) return 'pardinho';
  if (n.indexOf('tatui') >= 0 || n.indexOf('tatuí') >= 0 || n.indexOf('sao roque') >= 0) return 'tatui';
  if (n.indexOf('osasco') >= 0 || n.indexOf('clu') >= 0) return 'osasco';
  if (n.indexOf('consorcio') >= 0 || n.indexOf('seliga') >= 0) return 'consorcio';
  if (n.indexOf('brasilia') >= 0 || n.indexOf('joão') >= 0) return 'brasilia';
  if (n.indexOf('rk') >= 0 || n.indexOf('sub empreita') >= 0) return 'rk';
  return null;
}

return [{ json: {
  message: msg,
  phone: phone,
  timestamp: timestamp,
  isCommand: msg.startsWith('@'),
  command: msg.startsWith('@') ? msg.split(' ')[0].substring(1).toLowerCase() : null,
  projeto: resolverProjectId(msg),
} }];
`,
    };

    @node({
        id: 'if-is-command',
        name: 'É Comando?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [500, 0],
    })
    IsCommand = {
        conditions: {
            combinator: 'and',
            conditions: [
                {
                    leftValue: '={{ $json.isCommand }}',
                    rightValue: true,
                    operator: { type: 'boolean', operation: 'equals' },
                },
            ],
        },
    };

    @node({
        id: 'code-route-commands',
        name: 'Route Commands',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [750, -100],
    })
    RouteCommands = {
        language: 'javaScript',
        jsCode: `
const cmd = $input.first().json.command;
const msg = $input.first().json.message;
const phone = $input.first().json.phone;

let response = '';

switch(cmd) {
  case 'tarefa':
  case 'task':
    response = '📋 Para criar tarefa use: @tarefa | PROJETO | DESCRIÇÃO | DATA\\nEx: @tarefa | Pardinho | Instalar rede rua A | 25/04';
    break;
  case 'rdo':
    response = '🏗️ Envie o RDO no formato:\\nPROJETO | FRENTE | NOTA SERVIÇO | ATIVIDADE | QUANTIDADE | EQUIPE';
    break;
  case 'pagamento':
  case 'financeiro':
    response = '💰 Envie foto do comprovante com legenda:\\nobra|categoria|descrição\\nEx: Pardinho|Material|Tubo PVC 100mm';
    break;
  case 'ajuda':
  case 'help':
    response = '🤖 COMANDOS DISPONÍVEIS:\\n@tarefa - Criar tarefa\\n@rdo - Enviar RDO\\n@pagamento - Registrar pagamento\\n@status - Ver status projetos\\n@ajuda - Esta mensagem';
    break;
  default:
    response = '❓ Comando não reconhecido. Use @ajuda para ver comandos disponíveis.';
}

return [{ json: { response, phone, command: cmd } }];
`,
    };

    @node({
        id: 'http-send-response',
        name: 'Send WhatsApp Response',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1000, -100],
        credentials: { httpHeaderAuth: { id: '1qo5XC8PQEzGWwAN', name: 'Evolution API' } },
    })
    SendResponse = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: $json.phone, textMessage: { text: $json.response } }) }}',
        options: {},
    };

    @node({
        id: 'respond-webhook-ok',
        name: 'Confirmar Recebimento',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1250, 0],
    })
    ConfirmReceipt = {
        respondWith: 'json',
        responseBody: '{{ JSON.stringify({ status: "ok", message: "Mensagem processada" }) }}',
        options: { responseCode: 200 },
    };

    @links()
    defineRouting() {
        this.WebhookEvolutionRouter.out(0).to(this.ParseMessage.in(0));
        this.ParseMessage.out(0).to(this.IsCommand.in(0));
        this.IsCommand.out(0).to(this.RouteCommands.in(0));
        this.IsCommand.out(1).to(this.ConfirmReceipt.in(0));
        this.RouteCommands.out(0).to(this.SendResponse.in(0));
        this.SendResponse.out(0).to(this.ConfirmReceipt.in(0));
    }
}

// ============================================================================
// WORKFLOW 2: ALERTA MEDICAO PRAZOS (Deadline Monitoring)
// ============================================================================

@workflow({
    id: 'alerta-medicao-prazos-sched',
    name: '⏰ Alertas de Prazos e Medições',
    active: true,
    settings: { executionOrder: 'v1' },
})
export class AlertaMedicaoPrazosWorkflow {
    
    @node({
        id: 'schedule-deadline-check',
        name: 'Verificação Diária 7h',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 300],
    })
    DailyCheck = {
        rule: { interval: [{ field: 'cronExpression', expression: '0 7 * * 1-5' }] },
    };

    @node({
        id: 'code-check-deadlines',
        name: 'Verificar Prazos Críticos',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    CheckDeadlines = {
        language: 'javaScript',
        jsCode: `
const hoje = new Date();
const diaAtual = hoje.getDate();
const mesAtual = hoje.getMonth() + 1;
const anoAtual = hoje.getFullYear();

const prazos = [
  { 
    nome: '📊 Medição Mensal SABESP',
    diaLimite: 15,
    antecedencia: 5,
    responsavel: 'Engenheiro de Medição',
    recorrencia: 'mensal'
  },
  {
    nome: '📐 Entrega Cadastro Topográfico',
    diaLimite: 16,
    mesLimite: 4,
    anoLimite: 2026,
    antecedencia: 7,
    responsavel: 'Equipe Topografia (Avant/Cosme)'
  },
  {
    nome: '🔍 Vistoria Survey SABESP',
    diaLimite: 2,
    mesLimite: 5,
    anoLimite: 2026,
    antecedencia: 10,
    responsavel: 'Sala Técnica (Gabriel/Vinicius)'
  }
];

const alertas = [];

prazos.forEach(prazo => {
  let dataLimite;
  
  if (prazo.recorrencia === 'mensal') {
    dataLimite = new Date(anoAtual, mesAtual - 1, prazo.diaLimite);
  } else {
    dataLimite = new Date(prazo.anoLimite, prazo.mesLimite - 1, prazo.diaLimite);
  }
  
  const diffDias = Math.ceil((dataLimite - hoje) / (1000 * 60 * 60 * 24));
  
  if (diffDias <= prazo.antecedencia && diffDias >= 0) {
    alertas.push({
      prazo: prazo.nome,
      diasRestantes: diffDias,
      dataLimite: dataLimite.toLocaleDateString('pt-BR'),
      responsavel: prazo.responsavel,
      urgente: diffDias <= 2
    });
  }
});

return [{ json: { alertas, totalAlertas: alertas.length, data: hoje.toISOString().split('T')[0] } }];
`,
    };

    @node({
        id: 'if-has-alerts',
        name: 'Tem Alertas?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [500, 300],
    })
    HasAlerts = {
        conditions: {
            combinator: 'and',
            conditions: [
                {
                    leftValue: '={{ $json.totalAlertas }}',
                    rightValue: 0,
                    operator: { type: 'number', operation: 'larger' },
                },
            ],
        },
    };

    @node({
        id: 'code-format-alert-message',
        name: 'Formatar Mensagem Alerta',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [750, 200],
    })
    FormatAlertMessage = {
        language: 'javaScript',
        jsCode: `
const alertas = $input.first().json.alertas;

const mensagem = [
  '🚨 ALERTAS DE PRAZOS - ' + new Date().toLocaleDateString('pt-BR'),
  '================================',
  ''
];

alertas.forEach((alerta, idx) => {
  mensagem.push(\`\${idx + 1}. \${alerta.prazo}\`);
  mensagem.push(\`   ⏰ Dias restantes: \${alerta.diasRestantes}\`);
  mensagem.push(\`   📅 Data limite: \${alerta.dataLimite}\`);
  mensagem.push(\`   👤 Responsável: \${alerta.responsavel}\`);
  if (alerta.urgente) {
    mensagem.push('   🔴 URGENTE - Ação imediata necessária!');
  }
  mensagem.push('');
});

mensagem.push('🔗 Acesse: https://construdatamaxv2-clean.vercel.app/app/prazos');

return [{ json: { mensagem: mensagem.join('\\n'), alertas } }];
`,
    };

    @node({
        id: 'http-send-alert-whatsapp',
        name: 'Enviar Alerta WhatsApp',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1000, 200],
        credentials: { httpHeaderAuth: { id: '1qo5XC8PQEzGWwAN', name: 'Evolution API' } },
    })
    SendAlertWhatsApp = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: "5561981846325", textMessage: { text: $json.mensagem } }) }}',
        options: {},
    };

    @node({
        id: 'respond-no-alerts',
        name: 'Sem Alertas Hoje',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [750, 400],
    })
    NoAlerts = {};

    @links()
    defineRouting() {
        this.DailyCheck.out(0).to(this.CheckDeadlines.in(0));
        this.CheckDeadlines.out(0).to(this.HasAlerts.in(0));
        this.HasAlerts.out(0).to(this.FormatAlertMessage.in(0));
        this.HasAlerts.out(1).to(this.NoAlerts.in(0));
        this.FormatAlertMessage.out(0).to(this.SendAlertWhatsApp.in(0));
    }
}

// ============================================================================
// WORKFLOW 3: ASSISTENTE DIARIO OBRA (Daily Construction Assistant)
// ============================================================================

@workflow({
    id: 'assistente-diario-obra-sched',
    name: '🌤️ Assistente Diário de Obra + Clima',
    active: true,
    settings: { executionOrder: 'v1' },
})
export class AssistenteDiarioObraWorkflow {
    
    @node({
        id: 'schedule-morning-briefing',
        name: 'Briefing Matinal 5:30h',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 300],
    })
    MorningBriefing = {
        rule: { interval: [{ field: 'cronExpression', expression: '30 5 * * 1-6' }] },
    };

    @node({
        id: 'http-get-weather',
        name: 'Consultar Previsão do Tempo',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [250, 300],
    })
    GetWeather = {
        url: 'https://api.open-meteo.com/v1/forecast',
        method: 'GET',
        sendQuery: true,
        queryParameters: {
            parameters: [
                { name: 'latitude', value: '-23.9608' },
                { name: 'longitude', value: '-46.3336' },
                { name: 'current', value: 'temperature_2m,precipitation,rain,wind_speed_10m,weather_code' },
                { name: 'hourly', value: 'precipitation_probability,temperature_2m' },
                { name: 'timezone', value: 'America/Sao_Paulo' },
            ],
        },
        options: {},
    };

    @node({
        id: 'code-analyze-weather-risk',
        name: 'Analisar Risco Climático',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [500, 300],
    })
    AnalyzeWeatherRisk = {
        language: 'javaScript',
        jsCode: `
const weather = $input.first().json;
const current = weather.current;
const hourly = weather.hourly;

const temp = current.temperature_2m;
const rain = current.rain || 0;
const precip = current.precipitation || 0;
const wind = current.wind_speed_10m;
const code = current.weather_code;

// Probabilidade máxima de chuva nas próximas 6 horas
const nextHours = hourly.precipitation_probability.slice(0, 6);
const maxProb = Math.max(...nextHours);

const climaRuim = rain > 5 || precip > 5 || maxProb > 70 || wind > 40 || code >= 61;

const riscoChuva = maxProb > 70 ? 'ALTO' : maxProb > 40 ? 'MODERADO' : 'BAIXO';

const recomendacao = climaRuim 
  ? '⚠️ CONDIÇÕES ADVERSAS - Avaliar paralisação ou atividades protegidas'
  : '✅ Condições favoráveis para obra externa';

const mensagemClima = [
  '🌤️ PREVISÃO DO TEMPO - SANTOS/SP',
  '================================',
  \`🌡️ Temperatura atual: \${temp}°C\`,
  \`🌧️ Chuva agora: \${rain}mm\`,
  \`💨 Vento: \${wind} km/h\`,
  \`☔ Probabilidade máx. (6h): \${maxProb}%\`,
  '',
  \`🎯 Risco de chuva: \${riscoChuha}\`,
  \`📋 Recomendação: \${recomendacao}\`,
  '',
  'PRÓXIMAS HORAS:',
];

for (let i = 0; i < 6; i++) {
  const hora = new Date();
  hora.setHours(hora.getHours() + i);
  mensagemClima.push(\`  \${hora.getHours()}:00 - \${hourly.precipitation_probability[i]}% chance\`);
}

return [{ json: { 
  climaRuim, 
  riscoChuva, 
  recomendacao, 
  mensagem: mensagemClima.join('\\n'),
  temperatura: temp,
  probabilidadeMaxima: maxProb
} }];
`,
    };

    @node({
        id: 'code-generate-rdo-template',
        name: 'Gerar Template RDO',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [750, 300],
    })
    GenerateRDOTemplate = {
        language: 'javaScript',
        jsCode: `
const clima = $input.first().json;
const hoje = new Date();
const diaSemana = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][hoje.getDay()];

const templateRDO = [
  '🏗️ TEMPLATE RDO DIÁRIO',
  '================================',
  \`📅 \${diaSemana}, \${hoje.toLocaleDateString('pt-BR')}\`,
  '',
  clima.mensagem,
  '',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  'PREENCHA E ENVIE:',
  '',
  'PROJETO: ',
  'FRENTE DE TRABALHO: ',
  'NOTA DE SERVIÇO: ',
  'ATIVIDADE PRINCIPAL: ',
  'QUANTIDADE EXECUTADA: ',
  'EQUIPE (QTD PESSOAS): ',
  'HORAS TRABALHADAS: ',
  'OCORRÊNCIAS/OBSERVAÇÕES: ',
  '',
  '📸 Anexe fotos dos trechos executados',
].join('\\n');

return [{ json: { templateRDO, clima } }];
`,
    };

    @node({
        id: 'http-send-morning-briefing',
        name: 'Enviar Briefing Matinal',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1000, 300],
        credentials: { httpHeaderAuth: { id: '1qo5XC8PQEzGWwAN', name: 'Evolution API' } },
    })
    SendMorningBriefing = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: "5561981846325", textMessage: { text: $json.templateRDO } }) }}',
        options: {},
    };

    @links()
    defineRouting() {
        this.MorningBriefing.out(0).to(this.GetWeather.in(0));
        this.GetWeather.out(0).to(this.AnalyzeWeatherRisk.in(0));
        this.AnalyzeWeatherRisk.out(0).to(this.GenerateRDOTemplate.in(0));
        this.GenerateRDOTemplate.out(0).to(this.SendMorningBriefing.in(0));
    }
}

// ============================================================================
// WORKFLOW 4: COBRANCA MATINAL DIRETOR (Morning Director Reminders)
// ============================================================================

@workflow({
    id: 'cobranca-matinal-diretor-sched',
    name: '📢 Cobrança Matinal - Diretores e Financeiro',
    active: true,
    settings: { executionOrder: 'v1' },
})
export class CobrancaMatinalDiretorWorkflow {
    
    @node({
        id: 'schedule-morning-reminders',
        name: 'Lembretes 7h',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 300],
    })
    MorningReminders = {
        rule: { interval: [{ field: 'cronExpression', expression: '0 7 * * 1-6' }] },
    };

    @node({
        id: 'code-prepare-reminders',
        name: 'Preparar Lembretes',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    PrepareReminders = {
        language: 'javaScript',
        jsCode: `
const diretores = [
  { nome: "Luiz Fernando Machado", telefone: "5537999425397" },
  { nome: "Felipe Nery (Gestor Geral)", telefone: "5561981846325" }
];

const financeiros = [
  { nome: "Renato", telefone: "5528999154319" },
  { nome: "Emilly Anjos", telefone: "5513974168911" }
];

const hoje = new Date();
const diaSemana = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][hoje.getDay()];

const lembreteDiretor = [
  '👷 BOM DIA DIRETOR!',
  '================================',
  \`📅 \${diaSemana}, \${hoje.toLocaleDateString('pt-BR')}\`,
  '',
  '📋 TAREFAS DO DIA:',
  '1. Delegar tarefas para equipes de campo',
  '2. Revisar RDOs pendentes',
  '3. Aprovar medições em aberto',
  '4. Acompanhar prazos críticos',
  '',
  '🔗 Acesse: https://construdatamaxv2-clean.vercel.app/app/delegar-tarefas',
  '',
  '⚠️ Não esqueça de delegar antes das 8h!'
].join('\\n');

const lembreteFinanceiro = [
  '💰 BOM DIA FINANCEIRO!',
  '================================',
  \`📅 \${diaSemana}, \${hoje.toLocaleDateString('pt-BR')}\`,
  '',
  '📋 TAREFAS DO DIA:',
  '1. Registrar pagamentos realizados ontem',
  '2. Conciliar extratos bancários',
  '3. Atualizar fluxo de caixa',
  '4. Enviar comprovantes pendentes',
  '',
  '🔗 Acesse: https://construdatamaxv2-clean.vercel.app/app/dre-financeiro',
  '',
  '⚠️ Registre todos os pagamentos do dia anterior!'
].join('\\n');

const mensagens = [
  ...diretores.map(d => ({ ...d, tipo: 'diretor', mensagem: lembreteDiretor })),
  ...financeiros.map(f => ({ ...f, tipo: 'financeiro', mensagem: lembreteFinanceiro }))
];

return mensagens.map(m => ({ json: m }));
`,
    };

    @node({
        id: 'http-send-reminder-whatsapp',
        name: 'Enviar Lembrete WhatsApp',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [500, 300],
        credentials: { httpHeaderAuth: { id: '1qo5XC8PQEzGWwAN', name: 'Evolution API' } },
    })
    SendReminderWhatsApp = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: $json.telefone, textMessage: { text: $json.mensagem } }) }}',
        options: {},
    };

    @links()
    defineRouting() {
        this.MorningReminders.out(0).to(this.PrepareReminders.in(0));
        this.PrepareReminders.out(0).to(this.SendReminderWhatsApp.in(0));
    }
}

// ============================================================================
// WORKFLOW 5: WEBHOOK RDO WHATSAPP (Structured RDO Handler)
// ============================================================================

@workflow({
    id: 'webhook-rdo-whatsapp-handler',
    name: '📝 Webhook RDO WhatsApp Estruturado',
    active: false,
    settings: { executionOrder: 'v1' },
})
export class WebhookRdoWhatsappWorkflow {
    
    @node({
        id: 'webhook-rdo-receiver',
        name: 'Receber RDO WhatsApp',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 300],
    })
    ReceiveRDO = {
        path: 'webhook/rdo-whatsapp',
        httpMethod: 'POST',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: 'code-parse-rdo-data',
        name: 'Parse Dados RDO',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    ParseRDOData = {
        language: 'javaScript',
        jsCode: `
const body = $input.first().json.body || $input.first().json;
const msg = body.message || body.text || body.Body || '';
const lines = msg.split('\\n').filter(l => l.trim());

const dados = {};

lines.forEach(line => {
  // Formato numerado: "1. Activity description"
  const match = line.match(/^(\\d+)[.\\-\\)\\s]+(.+)/);
  if (match) {
    const num = parseInt(match[1]);
    const valor = match[2].trim();
    dados[\`resposta_\${num}\`] = valor;
    return;
  }
  
  // Formato chave-valor: "Activity: Pipe installation"
  const kvMatch = line.match(/^(.+?):\\s*(.+)/);
  if (kvMatch) {
    const key = kvMatch[1].trim().toLowerCase().replace(/[\\s]+/g, '_');
    const valor = kvMatch[2].trim();
    dados[key] = valor;
  }
});

const rdoData = {
  projeto: dados.projeto || dados.resposta_1,
  frente: dados.frente || dados.resposta_3,
  nota_servico: dados.nota_servico || dados.resposta_4,
  atividade: dados.atividade || dados.resposta_5,
  quantidade: parseFloat(dados.quantidade) || 0,
  equipe_qtd: parseInt(dados.equipe_qtd) || 0,
  horas_trabalhadas: parseFloat(dados.horas) || 8,
  ocorrencias: dados.ocorrencias || dados.obs || 'Nenhuma',
  data: new Date().toISOString().split('T')[0],
  valido: !!(dados.projeto || dados.resposta_1) && !!(dados.atividade || dados.resposta_5)
};

return [{ json: rdoData }];
`,
    };

    @node({
        id: 'if-rdo-valid',
        name: 'RDO Válido?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [500, 300],
    })
    RDOValid = {
        conditions: {
            combinator: 'and',
            conditions: [
                {
                    leftValue: '={{ $json.valido }}',
                    rightValue: true,
                    operator: { type: 'boolean', operation: 'equals' },
                },
            ],
        },
    };

    @node({
        id: 'http-save-rdo-supabase',
        name: 'Salvar RDO no Supabase',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [750, 200],
    })
    SaveRDOSupabase = {
        url: 'https://vblfdikfobsirwpdnybw.supabase.co/rest/v1/rdos',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                { name: 'apikey', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibGZkaWtmb2JzaXJ3cGRueWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzAwODIsImV4cCI6MjA4ODk0NjA4Mn0.GOx3HoMh3P2Zzxz8BxNsfQBfXwsNZNQsdVc3nJaqRy4' },
                { name: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibGZkaWtmb2JzaXJ3cGRueWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzAwODIsImV4cCI6MjA4ODk0NjA4Mn0.GOx3HoMh3P2Zzxz8BxNsfQBfXwsNZNQsdVc3nJaqRy4' },
                { name: 'Prefer', value: 'return=representation' },
            ],
        },
        body: '={{ JSON.stringify($json) }}',
        options: {},
    };

    @node({
        id: 'respond-rdo-success',
        name: 'Confirmar RDO Registrado',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1000, 200],
    })
    RespondSuccess = {
        respondWith: 'json',
        responseBody: '{{ JSON.stringify({ status: "ok", message: "✅ RDO registrado com sucesso!" }) }}',
        options: { responseCode: 200 },
    };

    @node({
        id: 'respond-rdo-error',
        name: 'Erro RDO Incompleto',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [750, 400],
    })
    RespondError = {
        respondWith: 'json',
        responseBody: '{{ JSON.stringify({ status: "error", message: "❌ RDO incompleto. Preencha projeto e atividade." }) }}',
        options: { responseCode: 400 },
    };

    @links()
    defineRouting() {
        this.ReceiveRDO.out(0).to(this.ParseRDOData.in(0));
        this.ParseRDOData.out(0).to(this.RDOValid.in(0));
        this.RDOValid.out(0).to(this.SaveRDOSupabase.in(0));
        this.RDOValid.out(1).to(this.RespondError.in(0));
        this.SaveRDOSupabase.out(0).to(this.RespondSuccess.in(0));
    }
}

// ============================================================================
// WORKFLOW 6: GESTAO CONSTRUDATA JOAO DASHBOARD (Santos Project)
// ============================================================================

@workflow({
    id: 'gestao-joao-dashboard-sched',
    name: '📊 Dashboard João - Santos/SABESP',
    active: false,
    settings: { executionOrder: 'v1' },
})
export class GestaoJoaoDashboardWorkflow {
    
    @node({
        id: 'schedule-joao-daily',
        name: 'Disparo Diário 7h',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 300],
    })
    DisparoDiario = {
        rule: { interval: [{ field: 'cronExpression', expression: '0 7 * * 1-6' }] },
    };

    @node({
        id: 'code-joao-questionnaire',
        name: 'Montar Questionário João',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    JoaoQuestionnaire = {
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
].join('\\n');

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
        id: 'http-send-joao-whatsapp',
        name: 'Enviar para João WhatsApp',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [500, 300],
        credentials: { httpHeaderAuth: { id: '1qo5XC8PQEzGWwAN', name: 'Evolution API' } },
    })
    SendJoaoWhatsApp = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: $json.destinatario, textMessage: { text: $json.mensagem } }) }}',
        options: {},
    };

    @links()
    defineRouting() {
        this.DisparoDiario.out(0).to(this.JoaoQuestionnaire.in(0));
        this.JoaoQuestionnaire.out(0).to(this.SendJoaoWhatsApp.in(0));
    }
}

// ============================================================================
// WORKFLOW 7: GESTAO OSASCO RDO DASHBOARD (Osasco CLU Project)
// ============================================================================

@workflow({
    id: 'gestao-osasco-dashboard-sched',
    name: '📊 Dashboard Osasco CLU - Mateus',
    active: true,
    settings: { executionOrder: 'v1' },
})
export class GestaoOsascoDashboardWorkflow {
    
    @node({
        id: 'schedule-osasco-daily',
        name: 'Disparo Diário 6h',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 300],
    })
    DisparoDiario = {
        rule: { interval: [{ field: 'cronExpression', expression: '0 6 * * 1-6' }] },
    };

    @node({
        id: 'code-mateus-questionnaire',
        name: 'Montar Questionário Mateus',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    MateusQuestionnaire = {
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
].join('\\n');

return [{ json: {
  mensagem,
  destinatario: '5561991015639',
  destinatario_nome: 'Mateus Santos',
  projeto: 'Osasco',
  data: dataFormatada,
  diaSemana,
} }];
`,
    };

    @node({
        id: 'http-send-mateus-whatsapp',
        name: 'Enviar para Mateus via WhatsApp',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [500, 300],
        credentials: { httpHeaderAuth: { id: '1qo5XC8PQEzGWwAN', name: 'Evolution API' } },
    })
    SendMateusWhatsApp = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: $json.destinatario, textMessage: { text: $json.mensagem } }) }}',
        options: {},
    };

    @links()
    defineRouting() {
        this.DisparoDiario.out(0).to(this.MateusQuestionnaire.in(0));
        this.MateusQuestionnaire.out(0).to(this.SendMateusWhatsApp.in(0));
    }
}

// ============================================================================
// WORKFLOW 8: GESTAO PARDINHO RDO DASHBOARD (Pardinho Itapetininga Project)
// ============================================================================

@workflow({
    id: 'gestao-pardinho-dashboard-sched',
    name: '📊 Dashboard Pardinho - Ícaro',
    active: true,
    settings: { executionOrder: 'v1' },
})
export class GestaoPardinhoDashboardWorkflow {
    
    @node({
        id: 'schedule-pardinho-daily',
        name: 'Disparo Diário 6h',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 300],
    })
    DisparoDiario = {
        rule: { interval: [{ field: 'cronExpression', expression: '0 6 * * 1-6' }] },
    };

    @node({
        id: 'code-icaro-questionnaire',
        name: 'Montar Questionário Ícaro',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    IcaroQuestionnaire = {
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
  destinatario: '5537998268576',
  destinatario_nome: 'Ícaro',
  projeto: 'Pardinho',
  data: dataFormatada,
  diaSemana,
} }];
`,
    };

    @node({
        id: 'http-send-icaro-whatsapp',
        name: 'Enviar para Ícaro via WhatsApp',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [500, 300],
    })
    SendIcaroWhatsApp = {
        url: 'https://n8n-production-ae317.up.railway.app/webhook/construdata-notificacao',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ channel: "whatsapp", phone: $json.destinatario, message: $json.mensagem, project: "pardinho" }) }}',
        options: {},
    };

    @links()
    defineRouting() {
        this.DisparoDiario.out(0).to(this.IcaroQuestionnaire.in(0));
        this.IcaroQuestionnaire.out(0).to(this.SendIcaroWhatsApp.in(0));
    }
}

// ============================================================================
// WORKFLOW 9: GESTAO SALA TECNICA DASHBOARD (SLNR Santos Technical Room)
// ============================================================================

@workflow({
    id: 'gestao-sala-tecnica-dashboard-sched',
    name: '📊 Dashboard Sala Técnica SLNR',
    active: true,
    settings: { executionOrder: 'v1' },
})
export class GestaoSalaTecnicaDashboardWorkflow {
    
    @node({
        id: 'schedule-sala-tecnica-daily',
        name: 'Disparo Diário 8h',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 300],
    })
    DisparoDiario = {
        rule: { interval: [{ field: 'cronExpression', expression: '0 8 * * 1-6' }] },
    };

    @node({
        id: 'code-sala-tecnica-cobranca',
        name: 'Montar Cobrança Sala Técnica',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    SalaTecnicaCobranca = {
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
].join('\\n');

return [
  { json: { mensagem, destinatario: '5513991995918', nome: 'Gabriel' } },
  { json: { mensagem, destinatario: '5513978216285', nome: 'Vinicius' } }
];
`,
    };

    @node({
        id: 'http-send-sala-tecnica-whatsapp',
        name: 'Enviar para Sala Técnica WhatsApp',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [500, 300],
        credentials: { httpHeaderAuth: { id: '1qo5XC8PQEzGWwAN', name: 'Evolution API' } },
    })
    SendSalaTecnicaWhatsApp = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ number: $json.destinatario, textMessage: { text: $json.mensagem } }) }}',
        options: {},
    };

    @links()
    defineRouting() {
        this.DisparoDiario.out(0).to(this.SalaTecnicaCobranca.in(0));
        this.SalaTecnicaCobranca.out(0).to(this.SendSalaTecnicaWhatsApp.in(0));
    }
}

// ============================================================================
// WORKFLOW 10: PARDINHO LEAN LPS PLANEJAMENTO (Last Planner System)
// ============================================================================

@workflow({
    id: 'pardinho-lps-planejamento-webhook',
    name: '📈 Pardinho Lean LPS - Planejamento Campo',
    active: false,
    settings: { executionOrder: 'v1' },
})
export class PardinhoLPSPlanejamentoWorkflow {
    
    @node({
        id: 'webhook-pardinho-planning',
        name: 'Receber Planejamento Campo',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 300],
    })
    ReceivePlanning = {
        path: 'pardinho-planejamento',
        httpMethod: 'POST',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: 'code-parse-field-data',
        name: 'Parse Dados Campo',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    ParseFieldData = {
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
  
  metros_executados_semana: parseFloat(body.metros_semana) || 0,
  ligacoes_executadas: parseInt(body.ligacoes) || 0,
  pvs_executados: parseInt(body.pvs) || 0,
  
  metros_planejados_proxima_semana: parseFloat(body.plano_metros) || 0,
  trechos_planejados: body.trechos || '',
  
  expectativa_medicao: parseFloat(body.expectativa_medicao?.toString().replace(/[^\\d.,]/g, '').replace(',','.')) || 0,
  
  restricoes: body.restricoes || [],
  pendencias: body.pendencias || '',
  
  valido: (parseFloat(body.metros_semana) || 0) > 0,
};

return [{ json: planejadoCampo }];
`,
    };

    @node({
        id: 'code-cross-reference-plans',
        name: 'Cruzar Planejado x Real x Geral',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [500, 300],
    })
    CrossReferencePlans = {
        language: 'javaScript',
        jsCode: `
const campo = $input.first().json;

const PLANEJADO_GERAL = {
  meta_semanal_metros: 250,
  meta_mensal_metros: 1000,
  meta_ligacoes_semana: 15,
  meta_pvs_semana: 5,
  custo_meta_por_metro: 580,
  prazo_total_meses: 21,
  extensao_total: 16800,
};

const desvio_metros = campo.metros_executados_semana - PLANEJADO_GERAL.meta_semanal_metros;
const ppc = PLANEJADO_GERAL.meta_semanal_metros > 0
  ? Math.round((campo.metros_executados_semana / PLANEJADO_GERAL.meta_semanal_metros) * 100)
  : 0;

const desvio_ligacoes = campo.ligacoes_executadas - PLANEJADO_GERAL.meta_ligacoes_semana;
const desvio_pvs = campo.pvs_executados - PLANEJADO_GERAL.meta_pvs_semana;

const lps = {
  ppc,
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
        id: 'if-serious-deviation',
        name: 'Tem Desvio Grave?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [750, 300],
    })
    SeriousDeviation = {
        conditions: {
            combinator: 'and',
            conditions: [
                {
                    leftValue: '={{ $json.lps.temDesvioGrave }}',
                    rightValue: true,
                    operator: { type: 'boolean', operation: 'equals' },
                },
            ],
        },
    };

    @node({
        id: 'code-generate-lps-alert',
        name: 'Gerar Alerta LPS',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1000, 200],
    })
    GenerateLPSAlert = {
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
        id: 'http-alert-director',
        name: 'Alertar Diretor Luiz Fernando',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1250, 200],
    })
    AlertDirector = {
        url: 'https://n8n-production-ae317.up.railway.app/webhook/construdata-notificacao',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ channel: "whatsapp", phone: "5537999425397", message: $json.alerta, project: "pardinho", type: "lps_alert" }) }}',
        options: {},
    };

    @node({
        id: 'http-update-platform',
        name: 'Atualizar Planejamento Plataforma',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1500, 300],
    })
    UpdatePlatform = {
        url: 'https://construdatamaxv2-clean.vercel.app/api/lps/pardinho',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ lps: $json.lps || $("Cruzar Planejado x Real x Geral").first().json.lps, campo: $json.campo || $("Cruzar Planejado x Real x Geral").first().json.campo }) }}',
        options: {},
    };

    @node({
        id: 'respond-planning-ok',
        name: 'Responder OK',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1750, 300],
    })
    RespondOK = {
        respondWith: 'json',
        responseBody: '{{ JSON.stringify({ status: "ok", message: "✅ Planejamento Pardinho atualizado! LPS sincronizado com planejado geral." }) }}',
        options: { responseCode: 200 },
    };

    @node({
        id: 'respond-incomplete',
        name: 'Responder Incompleto',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [750, 500],
    })
    RespondIncomplete = {
        respondWith: 'json',
        responseBody: '{{ JSON.stringify({ status: "error", message: "❌ Dados insuficientes para o LPS. Envie pelo menos metros executados na semana." }) }}',
        options: { responseCode: 400 },
    };

    @links()
    defineRouting() {
        this.ReceivePlanning.out(0).to(this.ParseFieldData.in(0));
        this.ParseFieldData.out(0).to(this.CrossReferencePlans.in(0));
        this.CrossReferencePlans.out(0).to(this.SeriousDeviation.in(0));
        this.SeriousDeviation.out(0).to(this.GenerateLPSAlert.in(0));
        this.SeriousDeviation.out(1).to(this.UpdatePlatform.in(0));
        this.GenerateLPSAlert.out(0).to(this.AlertDirector.in(0));
        this.AlertDirector.out(0).to(this.UpdatePlatform.in(0));
        this.UpdatePlatform.out(0).to(this.RespondOK.in(0));
    }
}
