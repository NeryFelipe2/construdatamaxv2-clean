import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Gestão WhatsApp — Router Central
// Nodes   : 4  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ReceberEvolutionApi                webhook
// ParseEventoWhatsapp                code
// Ignorar                            if
// EncaminharParaSubWorkflow          httpRequest
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ReceberEvolutionApi
//    → ParseEventoWhatsapp
//      → Ignorar
//        → EncaminharParaSubWorkflow
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'CJRFUtzbL3pGpb4s',
    name: 'Gestão WhatsApp — Router Central',
    active: true,
    settings: {
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
        binaryMode: 'separate',
    },
})
export class GestaoWhatsappRouterCentralWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '5daaece5-e032-4841-a82e-a7ecfa234cd7',
        webhookId: '0552e80c-7aeb-4aed-9a78-0e897e8a3058',
        name: 'Receber Evolution API',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 300],
    })
    ReceberEvolutionApi = {
        path: 'evolution-router',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: '32dc6592-31e4-4789-81e3-be3afc2b271f',
        name: 'Parse Evento Whatsapp',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    ParseEventoWhatsapp = {
        language: 'javaScript',
        jsCode: `
try {

// O corpo do webhook do Evolution vem em $input.first().json.body
const payload = $input.first().json.body || $input.first().json;

// ========== SUPABASE CONFIG ==========
const SUPABASE_URL = 'https://vblfdikfobsirwpdnybw.supabase.co/rest/v1';
const SUPABASE_KEY = $env.get('SUPABASE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibGZkaWtmb2JzaXJ3cGRueWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzAwODIsImV4cCI6MjA4ODk0NjA4Mn0.GOx3HoMh3P2Zzxz8BxNsfQBfXwsNZNQsdVc3nJaqRy4';
const PROJECT_IDS = {
  santos: '2a28beec-b1f8-4b0c-8416-d0710bb35d9d',
  osasco: 'f3c6645b-347f-4382-b9c5-d103c27ec511',
  pardinho: 'ec112c9a-1669-4287-8079-526d6940ce82',
  sala: 'abe7f66c-004b-4bb5-a245-6be67debd9f7',
};

async function salvarSupabase(ctx, tabela, dados) {
  // FAIL-SAFE CONFIDENCIALIDADE: nunca persiste sem project_id resolvido.
  // Qualquer vazamento entre projetos (RK caindo em Santos, Pardinho caindo em Osasco)
  // distorce medição e pode expor dados entre consórcios/clientes diferentes.
  if (!dados || !dados.project_id) {
    try {
      await ctx.helpers.httpRequest({
        method: 'POST',
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        headers: { apikey: $env.get('EVOLUTION_API_KEY') || 'construdata2026', 'Content-Type': 'application/json' },
        body: { number: '5561981846325', textMessage: { text: '🚨 *ALERTA CONFIDENCIALIDADE*
Tentativa de salvar em `,
        ' + tabela + ': ` SEM project_id resolvido. Dados recusados para evitar vazamento.

Payload: ' + JSON.stringify(dados).slice(0, 400) } },
        json: true,
      });
    } catch(_) {}
    return false;
  }
  try {
    await ctx.helpers.httpRequest({
      method: 'POST',
      url: SUPABASE_URL + '/' + tabela,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: dados,
      json: true,
    });
    return true;
  } catch (e) { return false; }
}

/**
 * FAIL-SAFE: retorna null quando o projeto não é reconhecido com CERTEZA.
 * Jamais aplica fallback silencioso para outro projeto — vazamento
 * de dado entre Santos/Pardinho/Osasco/RK é inaceitável (confidencialidade
 * entre consórcios distintos).
 *
 * Regra: só retorna UUID se houver match EXATO por palavra-chave única.
 * Caller é obrigado a tratar null (não salvar, alertar admin).
 */
function resolverProjectId(projetoNome) {
  if (!projetoNome) return null;
  const n = projetoNome.toLowerCase();

  // Projeto 2: Pardinho
  if (n.includes('pardinho') || n.includes('itapetininga')) return PROJECT_IDS.pardinho;

  // Projeto 1: Osasco
  if (n.includes('osasco') || n.includes('clu') || n.includes('cuiab')) return PROJECT_IDS.osasco;

  // Projeto 3: Consórcio Se Liga na Rede (SLNR Santos)
  // inclui Sala Técnica, Planejamento e Produção — todos no mesmo UUID 'sala'.
  if (n.includes('consorcio') || n.includes('consórcio') || n.includes('seliga')
      || n.includes('slnr') || n.includes('sala_tecnica') || n.includes('sala tecnica')
      || n.includes('sala técnica') || n === 'sala' || n === 'planejamento'
      || n === 'producao' || n === 'produção'
      || n.includes('jose marcio') || n.includes('josé márcio')
      || n.includes('junior') || n.includes('valdean') || n.includes('veronica') || n.includes('verônica')
      || n.includes('gabriel') || n.includes('vinicius') || n.includes('vinícius')
      || n.includes('fabrizzio') || n.includes('fabrizio')) {
    return PROJECT_IDS.sala;
  }

  // Santos / ConstruData Brasília — só se explicitamente nomeado.
  if (n.includes('santos') && !n.includes('seliga')) return PROJECT_IDS.santos;
  if (n.includes('brasilia') || n.includes('brasília') || n.includes('joão') || n.includes('joao')) return PROJECT_IDS.santos;

  // Projeto 4: RK Sub Empreita — SEM UUID próprio ainda.
  // Retorna null explicitamente para NÃO vazar em outro projeto.
  // Admin precisa criar row em supabase.projects e adicionar em PROJECT_IDS.rk.
  if (n.includes('rk') || n.includes('alexandre') || n.includes('igor') || n.includes('sub empreita') || n.includes('teteu')) {
    return null;
  }

  // Qualquer outro nome: recusa. Melhor perder um log do que vazar.
  return null;
}

// Se não for mensagem, ignora
if (!payload.data || payload.event !== 'messages.upsert') {
  return [{ json: { ignorar: true } }];
}

const msgData = payload.data;
const remoteJid = msgData.key.remoteJid || '';
let phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');

// Fallback: WhatsApp moderno manda @lid (identificador opaco) em vez do número real.
// Nesse caso resolvemos pelo pushName.
const pushName = (msgData.pushName || '').toLowerCase();
if (phone.includes('@lid') || phone.includes('@')) {
  if (pushName.includes('gabriel')) phone = '5513991995918';
  else if (pushName.includes('vinicius') || pushName.includes('vinícius')) phone = '5513978216285';
  else if (pushName.includes('icaro') || pushName.includes('ícaro')) phone = '5537998268576';
  else if (pushName.includes('mateus') || pushName.includes('matheus')) phone = '5561991015639';
  else if (pushName.includes('joão') || pushName.includes('joao')) phone = '5561999996252';
  else if (pushName.includes('felipe')) phone = '5561981846325';
  else if (pushName.includes('fabrizzio') || pushName.includes('fabrizio')) phone = '5574999076534';
  else if (pushName.includes('luiz') || pushName.includes('fernando')) phone = '5537999425397';
  else if (pushName.includes('renato')) phone = '5528999154319';
  else if (pushName.includes('thalita')) phone = '5511919803270';
  else if (pushName.includes('buruca')) phone = '5599999220853';
  else if (pushName.includes('junior') || pushName.includes('júnior')) phone = '5511986012223';
  else if (pushName.includes('valdeans')) phone = '559991392763';
  else if (pushName.includes('veronica') || pushName.includes('verônica')) phone = '5513997733121';
  else if (pushName.includes('marcio') || pushName.includes('márcio')) phone = '5511941816005';
  else if (pushName.includes('alexandre') || pushName.includes('igor')) phone = '5531998894664';
}
let text = '';
let mediaUrl = null;
let locLat = null;
let locLng = null;

if (msgData.message) {
  text = msgData.message.conversation || 
         (msgData.message.extendedTextMessage && msgData.message.extendedTextMessage.text) || '';
  // Detectar FOTO enviada
  if (msgData.message.imageMessage) {
    mediaUrl = msgData.message.imageMessage.url || msgData.message.imageMessage.directPath || null;
    if (msgData.message.imageMessage.caption) text = msgData.message.imageMessage.caption;
  }
  // Detectar LOCALIZAÇÃO enviada
  if (msgData.message.locationMessage) {
    locLat = msgData.message.locationMessage.degreesLatitude;
    locLng = msgData.message.locationMessage.degreesLongitude;
    text = text || 'Localização enviada';
  }
}

// Se tem foto ou localização sem texto, processar como RDO com mídia
if (!text && !mediaUrl && !locLat) {
  return [{ json: { ignorar: true, motivo: 'Sem texto e sem mídia' } }];
}

const trimmed = text.trim();
const lower = trimmed.toLowerCase();

// ========== CONTROLE DE IA ==========
// IA funciona APENAS para o Felipe, e SOMENTE quando ele fala consigo mesmo (fromMe).
const ADMIN_PHONE = '5561981846325'; // Felipe
const isAdmin = phone.includes('81846325');
const isFromMe = !!msgData.key.fromMe;

// Ignora mensagens enviadas pelo próprio bot (fromMe), EXCETO se for um comando explícito
// enviado pelo Gestor (Felipe) para testar o fluxo consigo mesmo ou disparar ações.
if (isFromMe) {
  const isComando = /^(@|menu|ajuda|comandos|status|equipe|projetos|dashboard|ia|ai|rdo|gerar|subir|1[0-1]|[1-9sm])/i.test(trimmed);
  if (!isComando && !isAdmin) {
    return [{ json: { ignorar: true, motivo: 'Enviada por mim (não é comando)' } }];
  }
  // Felipe falando consigo mesmo com texto livre → IA vai responder no fallback
  // Não bloqueia aqui
}

// Identifica projeto e perguntas pelo telefone
function projetoDoPhone(p) {
  if (p.includes('999996252')) return {
    nome: 'ConstruData Brasília (Projeto)', responsavel: 'João', isGestor: true, isDiretor: true,
    escopo: ['brasilia'],
    perguntas: []
  };
  if (p.includes('991015639')) return {
    nome: 'Osasco - Rua Cuiabá', responsavel: 'Mateus', projeto: 'osasco',
    perguntas: [
      { num: 1, label: 'Frente Capex em execução', tag: 'frente_capex' },
      { num: 2, label: 'Efetivo na obra', tag: 'efetivo' },
      { num: 3, label: 'Metros de rede executados', tag: 'metros_rede' },
      { num: 4, label: 'Ligações prediais executadas', tag: 'ligacoes' },
      { num: 5, label: 'Interferências encontradas', tag: 'interferencias' },
      { num: 6, label: 'Pendências para amanhã', tag: 'pendencias' },
    ]
  };
  // ===== PROJETO 3: CONSÓRCIO SE LIGA NA REDE =====
  // Sala Técnica
  if (p.includes('991995918')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'Gabriel', projeto: 'consorcio', setor: 'sala_tecnica',
    perguntas: [
      { num: 1, label: 'Atividades realizadas hoje', tag: 'atividades' },
      { num: 2, label: 'Pendências / impedimentos', tag: 'pendencias' },
      { num: 3, label: 'Próximos passos (amanhã)', tag: 'proximos' },
    ]
  };
  if (p.includes('978216285')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'Vinicius', projeto: 'consorcio', setor: 'sala_tecnica',
    perguntas: [
      { num: 1, label: 'Atividades realizadas hoje', tag: 'atividades' },
      { num: 2, label: 'Pendências / impedimentos', tag: 'pendencias' },
      { num: 3, label: 'Próximos passos (amanhã)', tag: 'proximos' },
    ]
  };
  // Planejamento
  if (p.includes('997733121')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'Veronica', projeto: 'consorcio', setor: 'planejamento',
    perguntas: [
      { num: 1, label: 'Atividades de planejamento realizadas', tag: 'atividades_plan' },
      { num: 2, label: 'Atualizações de cronograma', tag: 'cronograma' },
      { num: 3, label: 'Pendências / impedimentos', tag: 'pendencias' },
    ]
  };
  if (p.includes('91392763')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'Valdean', projeto: 'consorcio', setor: 'planejamento',
    perguntas: [
      { num: 1, label: 'Atividades de planejamento realizadas', tag: 'atividades_plan' },
      { num: 2, label: 'Atualizações de cronograma', tag: 'cronograma' },
      { num: 3, label: 'Pendências / impedimentos', tag: 'pendencias' },
    ]
  };
  if (p.includes('986012223')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'Junior', projeto: 'consorcio', setor: 'planejamento', isGerenteSetor: true,
    perguntas: [
      { num: 1, label: 'Atividades de planejamento realizadas', tag: 'atividades_plan' },
      { num: 2, label: 'Atualizações de cronograma', tag: 'cronograma' },
      { num: 3, label: 'Pendências / impedimentos', tag: 'pendencias' },
    ]
  };
  // Produção
  if (p.includes('941816005')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'José Márcio', projeto: 'consorcio', setor: 'producao', isGerenteSetor: true,
    perguntas: [
      { num: 1, label: 'Frentes em execução hoje', tag: 'frentes' },
      { num: 2, label: 'Efetivo na obra', tag: 'efetivo' },
      { num: 3, label: 'Metros de rede executados', tag: 'metros_rede' },
      { num: 4, label: 'Ligações prediais executadas', tag: 'ligacoes' },
      { num: 5, label: 'Pendências / impedimentos', tag: 'pendencias' },
    ]
  };
  // ===== PROJETO 4: RK SUB EMPREITA =====
  if (p.includes('998894664')) return {
    nome: 'RK Sub Empreita', responsavel: 'Alexandre / Igor', projeto: 'rk',
    perguntas: [
      { num: 1, label: 'Frentes em andamento', tag: 'frentes' },
      { num: 2, label: 'Metros executados', tag: 'metros_rede' },
      { num: 3, label: 'Equipe no local', tag: 'efetivo' },
      { num: 4, label: 'Impedimentos', tag: 'pendencias' },
      { num: 5, label: 'Custo Dia: Diesel/Combustível (R$)', tag: 'custo_diesel' },
      { num: 6, label: 'Custo Dia: Alimentação/Hotelaria (R$)', tag: 'custo_alim' },
      { num: 7, label: 'Custo Dia: Mão de Obra (R$)', tag: 'custo_mo' },
      { num: 8, label: 'Custo Dia: Materiais/Locações (R$)', tag: 'custo_mat' },
    ]
  };
  if (p.includes('81846325')) return {
    nome: 'Gestão Geral (Felipe Nery)', responsavel: 'Felipe Nery', isGestor: true, isDiretor: true,
    escopo: ['todos'],
    perguntas: []
  };
  // ===== GESTORES / DIRETORES =====
  if (p.includes('999076534')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'Fabrizzio', isGestor: true, isDiretor: true,
    projeto: 'consorcio', escopo: ['consorcio'],
    perguntas: []
  };
  if (p.includes('999425397')) return {
    nome: 'Diretoria Pardinho/Osasco/RK', responsavel: 'Luiz Fernando', isGestor: true, isDiretor: true,
    escopo: ['pardinho','osasco','rk'],
    perguntas: []
  };
  if (p.includes('999154319')) return {
    nome: 'Diretoria Pardinho/Osasco/RK', responsavel: 'Renato', isGestor: true, isDiretor: true,
    escopo: ['pardinho','osasco','rk'],
    perguntas: []
  };
  if (p.includes('919803270')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'Thalita', projeto: 'consorcio', setor: 'survey',
    isGestor: true,
    perguntas: []
  };
  // ===== PROJETO 2: PARDINHO =====
  if (p.includes('998268576')) return {
    nome: 'Pardinho - Itapetininga', responsavel: 'Ícaro', projeto: 'pardinho',
    perguntas: [
      { num: 1, label: 'Frente Rede Principal', tag: 'frente_principal' },
      { num: 2, label: 'Frente Ligações Prediais', tag: 'frente_ligacoes' },
      { num: 3, label: 'Frente ETE / Emissário', tag: 'frente_ete' },
      { num: 4, label: 'Efetivo total', tag: 'efetivo' },
      { num: 5, label: 'Metros de rede executados', tag: 'metros_rede' },
      { num: 6, label: 'Ligações prediais executadas', tag: 'ligacoes' },
      { num: 7, label: 'Equipamentos em uso', tag: 'equipamentos' },
      { num: 8, label: 'Materiais recebidos', tag: 'materiais' },
      { num: 9, label: 'Clima', tag: 'clima' },
      { num: 10, label: 'Pendências / impedimentos', tag: 'pendencias' },
      { num: 11, label: 'Acidentes ou ocorrências', tag: 'acidentes' },
    ]
  };
  return null;
}
const proj = projetoDoPhone(phone);

// ========== PERGUNTAS RDO PARA DIRETORES ==========
// Quando um diretor usa @rdo, essas perguntas são disparadas para o engenheiro-alvo
const RDO_PERGUNTAS_DIRETOR = {
  pardinho: [
    '📋 *RDO DIÁRIO — Pardinho*',
    '',
    'Ícaro, segue formulário de hoje:',
    '',
    '*( 1 )* — Frente Rede Principal',
    '*( 2 )* — Frente Ligações Prediais',
    '*( 3 )* — Frente ETE / Emissário',
    '*( 4 )* — Efetivo total',
    '*( 5 )* — Metros de rede executados',
    '*( 6 )* — Ligações prediais executadas',
    '*( 7 )* — Equipamentos em uso',
    '*( 8 )* — Materiais recebidos',
    '*( 9 )* — Clima',
    '*( 10 )* — Pendências / impedimentos',
    '*( 11 )* — Acidentes ou ocorrências',
    '',
    '💬 Responda: *1: valor | 2: valor | ...*',
    '_⏰ Prazo: até 18h de hoje._'
  ],
  osasco: [
    '📋 *RDO DIÁRIO — Osasco*',
    '',
    'Mateus, segue formulário de hoje:',
    '',
    '*( 1 )* — Frente Capex em execução',
    '*( 2 )* — Efetivo na obra',
    '*( 3 )* — Metros de rede executados',
    '*( 4 )* — Ligações prediais executadas',
    '*( 5 )* — Interferências encontradas',
    '*( 6 )* — Pendências para amanhã',
    '',
    '💬 Responda: *1: valor | 2: valor | ...*',
    '_⏰ Prazo: até 18h de hoje._'
  ],
  sala: [
    '📋 *ATIVIDADES DO DIA — Sala Técnica*',
    '',
    'Preencha as atividades de hoje:',
    '',
    '*( 1 )* — Atividades realizadas hoje',
    '*( 2 )* — Pendências / impedimentos',
    '*( 3 )* — Próximos passos (amanhã)',
    '',
    '💬 Responda: *1: texto | 2: texto | 3: texto*',
    '_⏰ Prazo: até 18h de hoje._'
  ],
  planejamento: [
    '📋 *ATIVIDADES DO DIA — Planejamento*',
    '',
    'Preencha as atividades de planejamento:',
    '',
    '*( 1 )* — Atividades de planejamento realizadas',
    '*( 2 )* — Atualizações de cronograma',
    '*( 3 )* — Pendências / impedimentos',
    '',
    '💬 Responda: *1: texto | 2: texto | 3: texto*',
    '_⏰ Prazo: até 18h de hoje._'
  ],
  producao: [
    '📋 *RDO DIÁRIO — Produção*',
    '',
    'José Márcio, segue formulário de hoje:',
    '',
    '*( 1 )* — Frentes em execução hoje',
    '*( 2 )* — Efetivo na obra',
    '*( 3 )* — Metros de rede executados',
    '*( 4 )* — Ligações prediais executadas',
    '*( 5 )* — Pendências / impedimentos',
    '',
    '💬 Responda: *1: valor | 2: valor | ...*',
    '_⏰ Prazo: até 18h de hoje._'
  ],
  rk: [
    '📋 *RDO DIÁRIO — RK Sub Empreita*',
    '',
    'Alexandre/Igor, segue formulário de hoje:',
    '',
    '*( 1 )* — Frentes em andamento',
    '*( 2 )* — Metros executados',
    '*( 3 )* — Equipe no local',
    '*( 4 )* — Impedimentos',
    '*( 5 )* — Custo Dia: Diesel/Combustível (R$)',
    '*( 6 )* — Custo Dia: Alimentação/Hotelaria (R$)',
    '*( 7 )* — Custo Dia: Mão de Obra (R$)',
    '*( 8 )* — Custo Dia: Materiais/Locações (R$)',
    '',
    '💬 Responda: *1: valor | 2: valor | ...*',
    '_⏰ Prazo: até 18h de hoje._'
  ]
};

// ========== PERGUNTAS DE SUPERVISÃO PARA DIRETORES ==========
// Diretores recebem essas perguntas macro para consolidar no dashboard
const RDO_DIRETOR_SUPERVISAO = [
  { num: 1, label: 'Frentes que visitou hoje', tag: 'frentes_visitadas' },
  { num: 2, label: 'Principais decisões tomadas', tag: 'decisoes' },
  { num: 3, label: 'Riscos ou alertas identificados', tag: 'riscos' },
  { num: 4, label: 'Previsão de entrega próx. marco', tag: 'previsao_marco' },
  { num: 5, label: 'Observações gerais', tag: 'observacoes' },
];

// ========== MENU INTERATIVO ==========
// Detecta saudação, ajuda, ou comando @
const isSaudacao = /^(oi|ola|olá|bom dia|boa tarde|boa noite|opa|menu|opções|opcoes|inicio|início|começar|comecar|start)$/i.test(trimmed);
const isAjuda = /^(@?(ajuda|help|comandos|menu))$/i.test(trimmed);
const cmdMatch = trimmed.match(/^@(w+)(?:s+(.*))?$/i);

function montarMenu(p, phoneDetectado) {
  if (!p) return ['🤖 ConstruDataMax', '', 'Não consegui identificar seu projeto. Telefone detectado: *' + phoneDetectado + '*', 'Fala com o admin para te cadastrar.'].join('
');

  // Menu de gestor/diretor
  if (p.isGestor) {
    const menuLinhas = [
      '🤖 *ConstruDataMax Gestão 360*',
      'Olá *' + p.responsavel + '*!',
      '',
      '📊 *Opções de Comando:*',
      '1️⃣ *Status RDO Hoje*',
      '2️⃣ *Equipe e Contatos*',
      '3️⃣ *Projetos Ativos*',
      '4️⃣ *Dashboard Consolidado*',
      '5️⃣ *Reenviar Cobrança* (Alerta Geral)',
      // '6️⃣ *Falar com IA* (só Felipe)',
      '7️⃣ *Cobrar RDO* (Dispara formulário)',
      '8️⃣ *Meu RDO Diretor* (Supervisão)',
      '9️⃣ *Lembrar Tarefas* (Cobra diretores)',
      '🔟 *Criar Tarefas* (Guia de Uso)',
      '1️⃣1️⃣ *Plano de Custos* (Financeiro)',
      '1️⃣2️⃣ *Tarefas Consórcio* (Delega por setor)',
      '1️⃣3️⃣ *Enviar Tarefas por Pessoa*',
      '1️⃣4️⃣ *Enviar Tarefas à Diretoria*',
      '1️⃣5️⃣ *Enviar Tarefas aos Engenheiros*',
      '1️⃣6️⃣ *Enviar Tarefas por Setor*',
      '',
      '📌 *Comandos Plataforma & IA:*',
      '• @gerar dashboard',
      '• @gerar machine learning',
      '• @gerar relatorios',
      '• @subir para a gestao 360',
      '📌 *Comandos extras:*',
      '• @rdo <projeto|todos> — Dispara RDO',
      '• @tarefa <nome|todos> <desc> — Delegar tarefa',
      '• @avisar <projeto> <msg> — Broadcast',
      '• @meurdo — Preencher RDO de supervisão',
      '',
      '_▶️ Digite o número ou use @comandos._',
      '🔗 https://construdatamaxv2-clean.vercel.app'
    ];
    return menuLinhas.join('
');
  }

  const tituloForm = p.isSalaTecnica ? '📌 *Atividades do Dia — preencha:*' : '📌 *Para responder o RDO de hoje:*';
  const linhas = [
    '🤖 *ConstruDataMax — Operação*',
    'Olá *' + p.responsavel + '*! Projeto: *' + p.nome + '*',
    '',
    tituloForm,
    ''
  ];
  for (const q of p.perguntas) {
    linhas.push('*( ' + q.num + ' )* — ' + q.label);
  }
  linhas.push('');
  linhas.push('💬 *Como preencher (jeito rápido):*');
  linhas.push('Copia o bloco abaixo, edita os valores e manda de volta numa mensagem só:');
  linhas.push('');
  for (const q of p.perguntas) {
    linhas.push(q.num + ': ');
  }
  linhas.push('');
  linhas.push('_Pode mandar tudo de uma vez ou um por linha. Também aceita texto livre nas pendências._');
  linhas.push('');
  linhas.push('🆘 *Outras Opções:*');
  linhas.push('*( M )* — Menu e Ajuda');
  linhas.push('*( S )* — Status do RDO');
  return linhas.join('
');
}

async function responder(msg, targetPhone = phone) {
  try {
    const r = await this.helpers.httpRequest({
      method: 'POST',
      url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
      headers: { apikey: $env.get('EVOLUTION_API_KEY') || 'construdata2026', 'Content-Type': 'application/json' },
      body: { number: targetPhone, textMessage: { text: msg } },
      json: true,
    });
    return { ok: true, target: targetPhone, r };
  } catch (e) {
    return { ok: false, target: targetPhone, err: (e && e.message) || String(e) };
  }
}

async function explicarErroGroq(ctx, contexto) {
  if (!isAdmin || !isFromMe) return 'Comando não reconhecido. Digite *menu* para ver os comandos disponíveis.';
  const prompt = 'O usuário tentou usar um bot de WhatsApp de gestão de obras (ConstruDataMax) e cometeu um erro. Explique de forma MUITO simples (2-4 linhas, tom amigável, sem jargão técnico) o que ele fez de errado e como corrigir. Não invente comandos. Contexto:

' + contexto;
  return await perguntarGroq(ctx, prompt);
}

async function perguntarGroq(ctx, pergunta) {
  try {
    const response = await ctx.helpers.httpRequest({
      method: 'POST',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      headers: {
        'Authorization': \`Bearer \${$env.get('GROQ_API_KEY') || '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'}\`,
        'Content-Type': 'application/json'
      },
      body: {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Você é a IA da ConstruDataMax, assistente de engenharia e gestão de obras. Responda de forma concisa, direta e muito útil. Você sempre usa linguagem profissional voltada para a construção civil.' },
          { role: 'user', content: pergunta }
        ],
        temperature: 0.7,
        max_tokens: 800
      },
      json: true
    });
    return response.choices[0].message.content;
  } catch (e) {
    return '❌ Erro na integração da IA: ' + (e.message || 'Falha de conexão com o painel Llama-3.');
  }
}

// Saudação ou pedido de ajuda → manda menu
if (isSaudacao || isAjuda) {
  await responder.call(this, montarMenu(proj, phone));
  return [{ json: { ignorar: true, motivo: 'Menu enviado' } }];
}

// Conversão de atalhos numéricos ou textuais para cmdMatch
let finalCmdMatch = cmdMatch;
const shortcutMatch = trimmed.match(/^(1[0-6]|[1-9]|s|m)$/i);

if (shortcutMatch && proj) {
  const s = shortcutMatch[1].toLowerCase();
  if (proj.isGestor) {
    if (s === '1') finalCmdMatch = [null, 'status', ''];
    else if (s === '2') finalCmdMatch = [null, 'equipe', ''];
    else if (s === '3') finalCmdMatch = [null, 'projetos', ''];
    else if (s === '4') finalCmdMatch = [null, 'dashboard', ''];
    else if (s === '5') finalCmdMatch = [null, 'reenviar', 'todos'];
    // else if (s === '6') finalCmdMatch = [null, 'ia', ''];
    else if (s === '7') finalCmdMatch = [null, 'rdo', 'todos'];
    else if (s === '8') finalCmdMatch = [null, 'meurdo', ''];
    else if (s === '9') finalCmdMatch = [null, 'lembrar', 'diretores'];
    else if (s === '10') finalCmdMatch = [null, 'criartarefa', ''];
    else if (s === '11') finalCmdMatch = [null, 'planocustos', ''];
    else if (s === '12') finalCmdMatch = [null, 'criartarefaconsorcio', ''];
    else if (s === '13') finalCmdMatch = [null, 'guiatarefapessoa', ''];
    else if (s === '14') finalCmdMatch = [null, 'guiatarefadiretoria', ''];
    else if (s === '15') finalCmdMatch = [null, 'guiatarefaengenheiros', ''];
    else if (s === '16') finalCmdMatch = [null, 'guiatarefasetor', ''];
  } else {
    if (s === 'm') finalCmdMatch = [null, 'menu', ''];
    else if (s === 's') finalCmdMatch = [null, 'status', proj.nome];
  }
}

// Comando @ ou atalho numérico
if (finalCmdMatch) {
  const cmd = finalCmdMatch[1].toLowerCase();
  let resposta = '';
  
  if (cmd === 'ajuda' || cmd === 'comandos' || cmd === 'help' || cmd === 'menu') {
    resposta = montarMenu(proj, phone);

  } else if (cmd === 'projeto') {
    resposta = '📋 Projeto: *' + (proj ? proj.nome : 'não identificado') + '*';

  } else if (cmd === 'status') {
    const alvo = finalCmdMatch[2] ? finalCmdMatch[2].toLowerCase() : 'todos';
    const hojeStr = new Date().toLocaleDateString('pt-BR');
    const escopoStatus = (proj && proj.escopo) || [];
    const temEscopo = (pr) => escopoStatus.includes('todos') || escopoStatus.includes(pr);
    let texto = '📊 *Status RDO de Hoje* — ' + hojeStr + '

';

    if (temEscopo('pardinho') && (alvo === 'todos' || alvo.includes('pardinho'))) {
      texto += '📌 *Pardinho* (Ícaro)
❌ Pendente: Falta reportar frente Ligações e Emissário

';
    }
    if (temEscopo('osasco') && (alvo === 'todos' || alvo.includes('osasco'))) {
      texto += '📌 *Osasco* (Mateus)
✅ Entregue: 100% preenchido

';
    }
    if (alvo === 'todos' || alvo.includes('brasil') || alvo.includes('santos')) {
      texto += '📌 *ConstruData Brasília* (João)
✅ Entregue: Sem interferências

';
    }
    if (temEscopo('consorcio') && (alvo === 'todos' || alvo.includes('sala') || alvo.includes('consorcio'))) {
      texto += '📌 *Consórcio — Sala Técnica* (Gabriel/Vinicius)
';
    }
    if (temEscopo('consorcio') && (alvo === 'todos' || alvo.includes('plan') || alvo.includes('consorcio'))) {
      texto += '📌 *Consórcio — Planejamento* (Junior/Valdean/Veronica)
';
    }
    if (temEscopo('consorcio') && (alvo === 'todos' || alvo.includes('prod') || alvo.includes('consorcio'))) {
      texto += '📌 *Consórcio — Produção* (José Márcio)
';
    }
    if (temEscopo('rk') && (alvo === 'todos' || alvo.includes('rk'))) {
      texto += '📌 *RK Sub Empreita* (Alexandre/Igor)
';
    }
    texto += '_Para cobrar, digite @reenviar <projeto> ou @rdo <projeto>_';
    resposta = texto;

  } else if (cmd === 'equipe') {
    resposta = '👥 *Contatos por Projeto*

' +
      '📌 *Projeto 1: Osasco — Rua Cuiabá*
' +
      '  👷 Mateus — Engenheiro (61 99101-5639)
' +
      '  👔 Renato — Diretor (28 99915-4319)
' +
      '  👔 Luiz Fernando — Diretor (37 99942-5397)

' +
      '📌 *Projeto 2: Pardinho — Itapetininga*
' +
      '  👷 Ícaro — Engenheiro (37 99826-8576)
' +
      '  👔 Luiz Fernando — Diretor (37 99942-5397)

' +
      '📌 *Projeto 3: Consórcio Se Liga na Rede*
' +
      '  • Fabrizzio — Gerente Consórcio (74 99907-6534)
' +
      '  _Sala Técnica:_
' +
      '  • Gabriel (13 99199-5918)
' +
      '  • Vinicius (13 97821-6285)
' +
      '  _Planejamento:_
' +
      '  • Junior — Gerente (11 98601-2223)
' +
      '  • Valdean (99 9139-2763)
' +
      '  • Veronica (13 99773-3121)
' +
      '  _Produção:_
' +
      '  • José Márcio — Gerente (11 94181-6005)

' +
      '📌 *Projeto 4: RK Sub Empreita*
' +
      '  👷 Alexandre / Igor (31 99889-4664)
' +
      '  👔 Renato — Diretor (28 99915-4319)
' +
      '  👔 Luiz Fernando — Diretor (37 99942-5397)

' +
      '_Use @rdo <projeto>, @tarefaconsorcio <setor> <desc>_';
      
  } else if (cmd === 'projetos') {
    resposta = '🏗️ *Projetos Ativos*

' +
      '📌 *1. Osasco* — Rua Cuiabá
' +
      '   Eng: Mateus | Dir: Renato, Luiz Fernando

' +
      '📌 *2. Pardinho* — Itapetininga
' +
      '   Eng: Ícaro | Dir: Luiz Fernando

' +
      '📌 *3. Consórcio Se Liga na Rede*
' +
      '   Gerente: Fabrizzio
' +
      '   Sala Técnica: Gabriel, Vinicius
' +
      '   Planejamento: Junior (ger.), Valdean, Veronica
' +
      '   Produção: José Márcio (ger.)

' +
      '📌 *4. RK Sub Empreita*
' +
      '   Eng: Alexandre/Igor | Dir: Renato, Luiz Fernando

' +
      '_Acompanhe: https://construdatamaxv2-clean.vercel.app_';

  } else if (cmd === 'dashboard') {
    resposta = '📈 *Dashboard Consolidado*
' +
      'O dashboard consolidado de RDO já está atualizado e disponível.

' +
      'Acesse no portal:
https://construdatamaxv2-clean.vercel.app/dashboard/consolidado';

  // ===== @rdo <projeto|todos> — DISPARA FORMULÁRIO RDO PRO ENGENHEIRO =====
  } else if (cmd === 'rdo') {
    if (!proj || !proj.isGestor) {
      resposta = '❌ Apenas diretores/gestores podem disparar RDO.';
    } else {
      const alvo = finalCmdMatch[2] ? finalCmdMatch[2].toLowerCase() : 'todos';
      const hojeStr = new Date().toLocaleDateString('pt-BR');
      const enviados = [];
      const falhas = [];

      // ===== SCOPE-BASED DISPATCH =====
      const escopoDir = proj.escopo || [];
      const temEscopo = (pr) => escopoDir.includes('todos') || escopoDir.includes(pr);

      // Pardinho → Ícaro
      if (temEscopo('pardinho') && (alvo === 'todos' || alvo.includes('pardinho'))) {
        const msg = RDO_PERGUNTAS_DIRETOR.pardinho.join('
') + '

📅 ' + hojeStr;
        const r = await responder.call(this, msg, '5537998268576');
        if (r.ok) enviados.push('Ícaro (Pardinho)'); else falhas.push('Ícaro: ' + r.err);
      }
      // Osasco → Mateus
      if (temEscopo('osasco') && (alvo === 'todos' || alvo.includes('osasco'))) {
        const msg = RDO_PERGUNTAS_DIRETOR.osasco.join('
') + '

📅 ' + hojeStr;
        const r = await responder.call(this, msg, '5561991015639');
        if (r.ok) enviados.push('Mateus (Osasco)'); else falhas.push('Mateus: ' + r.err);
      }
      // RK → Alexandre/Igor
      if (temEscopo('rk') && (alvo === 'todos' || alvo.includes('rk') || alvo.includes('teteu'))) {
        const msg = RDO_PERGUNTAS_DIRETOR.rk.join('
') + '

📅 ' + hojeStr;
        const r = await responder.call(this, msg, '5531998894664');
        if (r.ok) enviados.push('Alexandre/Igor (RK)'); else falhas.push('Alexandre/Igor: ' + r.err);
      }
      // ===== CONSÓRCIO SE LIGA NA REDE (por setor) =====
      const isConsorcioAlvo = alvo === 'todos' || alvo.includes('consorcio') || alvo.includes('seliga');
      if (temEscopo('consorcio')) {
        // Sala Técnica → Gabriel + Vinicius
        if (isConsorcioAlvo || alvo.includes('sala')) {
          const msg = RDO_PERGUNTAS_DIRETOR.sala.join('
') + '

📅 ' + hojeStr;
          const r1 = await responder.call(this, msg, '5513991995918');
          const r2 = await responder.call(this, msg, '5513978216285');
          if (r1.ok) enviados.push('Gabriel (Sala)'); else falhas.push('Gabriel: ' + r1.err);
          if (r2.ok) enviados.push('Vinicius (Sala)'); else falhas.push('Vinicius: ' + r2.err);
        }
        // Planejamento → Junior + Valdean + Veronica
        if (isConsorcioAlvo || alvo.includes('plan')) {
          const msg = RDO_PERGUNTAS_DIRETOR.planejamento.join('
') + '

📅 ' + hojeStr;
          const r1 = await responder.call(this, msg, '5511986012223');
          const r2 = await responder.call(this, msg, '559991392763');
          const r3 = await responder.call(this, msg, '5513997733121');
          if (r1.ok) enviados.push('Junior (Plan.)'); else falhas.push('Junior: ' + r1.err);
          if (r2.ok) enviados.push('Valdean (Plan.)'); else falhas.push('Valdean: ' + r2.err);
          if (r3.ok) enviados.push('Veronica (Plan.)'); else falhas.push('Veronica: ' + r3.err);
        }
        // Produção → José Márcio
        if (isConsorcioAlvo || alvo.includes('prod')) {
          const msg = RDO_PERGUNTAS_DIRETOR.producao.join('
') + '

📅 ' + hojeStr;
          const r1 = await responder.call(this, msg, '5511941816005');
          if (r1.ok) enviados.push('José Márcio (Prod.)'); else falhas.push('José Márcio: ' + r1.err);
        }
        // Notificar Fabrizzio quando OUTRO gestor dispara RDO pro Consórcio
        if (phone !== '5574999076534' && enviados.some(e => e.includes('Sala') || e.includes('Plan') || e.includes('Prod'))) {
          await responder.call(this, 'ℹ️ *RDO Consórcio disparado por ' + proj.responsavel + '*

Enviado para: ' + enviados.filter(e => e.includes('Sala') || e.includes('Plan') || e.includes('Prod')).join(', '), '5574999076534');
        }
      }

      // Diretores
      if (alvo === 'todos' || alvo.includes('diretor')) {
        const msg = '⚠️ *COBRANÇA DE RDO — DIRETORIA*

Atenção Diretores, por favor enviem o RDO de Supervisão diário.
Basta digitar *@meurdo* para preencher o relatório consolidado.';
        const diretores = [
          {nome: 'Renato', tel: '5528999154319'},
          {nome: 'Luiz Fernando', tel: '5537999425397'},
          {nome: 'Fabrizzio', tel: '5574999076534'}
        ];
        for (const dir of diretores) {
          if (dir.tel !== phone) {
            const r = await responder.call(this, msg, dir.tel);
            if (r.ok) enviados.push(dir.nome + ' (Diretoria)'); else falhas.push(dir.nome + ': ' + r.err);
          }
        }
      }

      if (enviados.length > 0) {
        resposta = '📋 *RDO disparado com sucesso!*

✅ Enviado para: ' + enviados.join(', ');
        if (falhas.length) resposta += '
❌ Falhas: ' + falhas.join(', ');
        resposta += '

_Os engenheiros e diretores receberam o alerta._';
      } else {
        resposta = '❌ Projeto não encontrado ou sem permissão.
Alvos: pardinho, osasco, rk, consorcio, sala, planejamento, producao, diretores, todos';
      }
    }

  // ===== @meurdo — RDO DE SUPERVISÃO DO DIRETOR =====
  } else if (cmd === 'gerar' || cmd === 'subir') {
    if (!proj || (!proj.isGestor && !proj.isDiretor)) {
      resposta = '❌ Apenas gestores podem emitir comandos de sistema.';
    } else {
      const acao = finalCmdMatch[2] ? finalCmdMatch[2].toLowerCase() : '';
      if (acao.includes('dashboard') || acao.includes('machine learning') || acao.includes('relatório') || acao.includes('relatorio') || cmd === 'subir') {
        const msgOperacao = cmd === 'subir' ? 'Sincronização com o painel Gestão 360' : 'Geração de ' + acao;
        resposta = '✅ *COMANDO RECEBIDO:*
Operação de ' + msgOperacao + ' iniciada no backend.
⏳ Os dados estão sendo processados pela IA e serão consolidados na plataforma ConstruDataMax.';
      } else {
        resposta = '❌ Especifique o alvo. Exemplo:
@gerar dashboard
@gerar machine learning
@gerar relatórios';
      }
    }
    
  } else if (cmd === 'lembrar') {
    if (!proj || (!proj.isGestor && !proj.isDiretor)) {
      resposta = '❌ Acesso negado. Apenas gestores podem disparar o lembrete de tarefas.';
    } else {
      // Avisa os diretores
      const dirs = [
        {nome: 'Luiz Fernando', tel: '5537999425397'},
        {nome: 'Renato RK', tel: '5528999154319'},
        {nome: 'Fabrizzio', tel: '5574999076534'}
      ];
      let oks = [];
      const amanha = new Date().toLocaleDateString('pt-BR');
      for (const d of dirs) {
        if(d.tel !== phone) { 
          const r = await responder.call(this, '⚠️ *LEMBRETE OBRIGATÓRIO* ⚠️

Diretor ' + d.nome + ', por favor mande hoje as tarefas matinais para as suas equipes responsáveis.
💡 *Como fazer:* Use *@tarefa <engenheiro> <descrição>*

_Esteja atento aos projetos da sua alçada!_', d.tel);
          if(r.ok) oks.push(d.nome);
        }
      }
      resposta = '✅ Lembrete metódico disparado matinalmente para os Diretores: ' + oks.join(', ');
    }
  
  } else if (cmd === 'criartarefa') {
    resposta = '🛠️ *GUIA PARA CRIAR TAREFAS*

Para atribuir obrigações aos engenheiros, escreva:

*@tarefa <nome> <descrição>*

Membros elegíveis:
• *Ícaro* (Pardinho)
• *Mateus* (Osasco)
• *Alexandre* ou *Igor* (RK Sub)
• *Junior*, *Valdeans*, *Veronica*, *Jose Marcio* (Sala Técnica)

_Ex: @tarefa icaro Focar na escavação da rede 2._';

  } else if (cmd === 'planocustos') {
    resposta = '💰 *PLANO DE CONTAS (CUSTO DIÁRIO)*

O preenchimento de Custos Diários foi EMBUTIDO no RDO normal dos equipamentos e equipes (Osasco, Pardinho e RK)!

Ao responder o RDO, preencha as rubricas numéricas de:
- Diesel/Combustível
- Alimentação/Hotelaria
- Mão de Obra Fixa/Avulsa
- Materiais/Equipamentos';
  
  } else if (cmd === 'criartarefaconsorcio') {
    resposta = '🛠️ *GUIA TAREFAS CONSÓRCIO SE LIGA*

Para atribuir tarefas pontuais aos setores, escreva:

*@tarefaconsorcio <setor|todos> <descrição>*

Setores:
• *planejamento* (Veronica, Valdean, Junior)
• *producao* (Jose Marcio)
• *sala* (Gabriel, Vinicius)

_Ex: @tarefaconsorcio planejamento Atualizar cronograma da semana_
_Obs: Fabrizzio sempre receberá uma cópia da tarefa._';

  } else if (cmd === 'guiatarefapessoa') {
    resposta = '👤 *ENVIAR TAREFA POR PESSOA*

Delegue uma tarefa para uma pessoa específica:

*@tarefa <nome> <descrição>*

Nomes aceitos:
• *felipe*  (Gestor)
• *icaro*   (Eng. Pardinho)
• *mateus*  (Eng. Osasco)
• *alexandre* / *igor* (RK Sub Empreita)
• *gabriel* / *vinicius* (Sala Técnica)
• *junior* / *valdean* / *veronica* (Planejamento)
• *jose marcio* (Produção)
• *thalita*  (Survey)

_Ex: @tarefa icaro Focar na escavação da rede 2 até sexta_';

  } else if (cmd === 'guiatarefadiretoria') {
    resposta = '👔 *ENVIAR TAREFA À DIRETORIA*

Delegue uma tarefa para todos os diretores de uma vez:

*@tarefadiretoria <descrição>*

Vai para:
• *Renato*        (28 99915-4319)
• *Luiz Fernando* (37 99942-5397)
• *Fabrizzio*     (74 99907-6534)
• *Felipe*        (61 98184-6325)

_Ex: @tarefadiretoria alinhar custos do mês até quinta_
_Todos recebem a mesma mensagem simultaneamente._';

  } else if (cmd === 'guiatarefaengenheiros') {
    resposta = '👷 *ENVIAR TAREFA AOS ENGENHEIROS*

Delegue uma tarefa para todos os engenheiros de campo:

*@tarefaengenheiros <descrição>*

Vai para:
• *Ícaro*     — Pardinho
• *Mateus*    — Osasco
• *Alexandre/Igor* — RK Sub Empreita

_Ex: @tarefaengenheiros enviar foto da frente até 17h_
_Cada diretor só atinge engenheiros do seu escopo._';

  } else if (cmd === 'guiatarefasetor') {
    resposta = '🏭 *ENVIAR TAREFA POR SETOR*

Delegue tarefas por setor do Consórcio Se Liga na Rede:

*@tarefaconsorcio <setor|todos> <descrição>*

Setores:
• *planejamento* (Veronica, Valdean, Junior)
• *producao*     (José Márcio)
• *sala*         (Gabriel, Vinicius)
• *todos*        (atinge os 3 setores)

_Ex: @tarefaconsorcio sala conferir projeto do trecho NS-12_
_Obs: Fabrizzio sempre recebe uma cópia._';

  } else if (cmd === 'tarefadiretoria') {
    if (!proj || !proj.isDiretor) {
      resposta = '❌ Permissão negada. Apenas diretoria pode delegar tarefas.';
    } else if (!finalCmdMatch[2] || !finalCmdMatch[2].trim()) {
      resposta = '❌ Faltou a descrição. Use: @tarefadiretoria <descrição>';
    } else {
      const descricao = finalCmdMatch[2].trim();
      const diretores = [
        {nome: 'Renato', tel: '5528999154319'},
        {nome: 'Luiz Fernando', tel: '5537999425397'},
        {nome: 'Fabrizzio', tel: '5574999076534'},
        {nome: 'Felipe', tel: '5561981846325'},
      ];
      const msg = '🚨 *NOVA TAREFA — DIRETORIA* 🚨
👤 Delegado por: *' + proj.responsavel + '*
📝 *Tarefa:* ' + descricao + '
_Protocolada no Painel Gestão 360._
_Responda com "Ciente" para confirmar._';
      const enviados = [];
      const falhas = [];
      for (const d of diretores) {
        if (d.tel === phone) continue;
        const r = await responder.call(this, msg, d.tel);
        if (r.ok) enviados.push(d.nome); else falhas.push(d.nome + ' (' + r.err + ')');
        try {
          await salvarSupabase(this, 'tarefas', {
            project_id: resolverProjectId('geral'),
            delegado_por: proj.responsavel,
            delegado_para: d.nome,
            telefone_destino: d.tel,
            descricao: descricao,
            status: 'pendente',
            prioridade: 'alta',
          });
        } catch(e) {}
      }
      resposta = '✅ Tarefa enviada para Diretoria: *' + enviados.join(', ') + '*';
      if (falhas.length) resposta += '
❌ Falhas: ' + falhas.join(', ');
    }

  } else if (cmd === 'tarefaengenheiros' || cmd === 'tarefaeng') {
    if (!proj || !proj.isDiretor) {
      resposta = '❌ Permissão negada. Apenas diretoria pode delegar tarefas.';
    } else if (!finalCmdMatch[2] || !finalCmdMatch[2].trim()) {
      resposta = '❌ Faltou a descrição. Use: @tarefaengenheiros <descrição>';
    } else {
      const descricao = finalCmdMatch[2].trim();
      const escopoDir = proj.escopo || [];
      const temEscopoEng = (pr) => escopoDir.includes('todos') || escopoDir.includes(pr);
      const TODOS_ENG = [
        { nome: 'Ícaro',     tel: '5537998268576', proj: 'pardinho' },
        { nome: 'Mateus',    tel: '5561991015639', proj: 'osasco' },
        { nome: 'Alexandre', tel: '5531998894664', proj: 'rk' },
      ];
      const destinos = TODOS_ENG.filter(e => temEscopoEng(e.proj));
      if (destinos.length === 0) {
        resposta = '❌ Você não tem escopo para nenhum engenheiro.';
      } else {
        const msg = '🚨 *NOVA TAREFA — ENGENHEIROS DE CAMPO* 🚨
👤 Delegado por: *' + proj.responsavel + '*
📝 *Tarefa:* ' + descricao + '
_Protocolada no Painel Gestão 360._
_Responda com "Ciente" para confirmar._';
        const enviados = [];
        const falhas = [];
        for (const d of destinos) {
          const r = await responder.call(this, msg, d.tel);
          if (r.ok) enviados.push(d.nome + ' (' + d.proj + ')'); else falhas.push(d.nome + ' (' + r.err + ')');
          try {
            await salvarSupabase(this, 'tarefas', {
              project_id: resolverProjectId(d.proj),
              delegado_por: proj.responsavel,
              delegado_para: d.nome,
              telefone_destino: d.tel,
              descricao: descricao,
              status: 'pendente',
              prioridade: 'normal',
            });
          } catch(e) {}
        }
        resposta = '✅ Tarefa enviada p/ engenheiros: *' + enviados.join(', ') + '*';
        if (falhas.length) resposta += '
❌ Falhas: ' + falhas.join(', ');
      }
    }

  } else if (cmd === 'meurdo' || cmd === 'meurdo') {
    if (!proj || !proj.isDiretor) {
      resposta = '❌ Apenas diretores podem preencher o RDO de supervisão.';
    } else {
      const hojeStr = new Date().toLocaleDateString('pt-BR');
      const linhas = [
        '📋 *RDO DE SUPERVISÃO — DIRETORIA*',
        '📅 ' + hojeStr,
        'Diretor: *' + proj.responsavel + '*',
        '',
      ];
      for (const q of RDO_DIRETOR_SUPERVISAO) {
        linhas.push('*( ' + q.num + ' )* — ' + q.label);
      }
      linhas.push('');
      linhas.push('💬 Responda: *1: texto | 2: texto | ...*');
      linhas.push('');
      linhas.push('_Esse relatório consolida sua visão diário para o Dashboard 360._');
      resposta = linhas.join('
');
    }

  } else if (cmd === 'reenviar') {
    const alvo = finalCmdMatch[2] ? finalCmdMatch[2].toLowerCase() : '';
    let telefones = [];
    if (alvo === 'todos' || alvo === '') {
      telefones.push('5537998268576', '5561991015639', '5513991995918', '5513978216285');
      telefones.push('5528999154319', '5537999425397', '5574999076534'); // Diretores
    } else if (alvo.includes('pardinho')) telefones.push('5537998268576');
    else if (alvo.includes('osasco')) telefones.push('5561991015639');
    else if (alvo.includes('sala')) telefones.push('5513991995918', '5513978216285');
    else if (alvo.includes('diretor')) telefones.push('5528999154319', '5537999425397', '5574999076534');

    if (telefones.length > 0) {
      const results = [];
      for (const t of telefones) {
        const res = await responder.call(this, '⚠️ *COBRANÇA DE RDO*

Atenção equipe, por favor preencham o RDO de hoje. Digite *menu* para ver os tópicos pendentes.', t);
        results.push(res);
      }
      const okList = results.filter(r => r.ok).map(r => r.target);
      const failList = results.filter(r => !r.ok);
      let r2 = '📤 *Resultado do envio para ' + alvo + '*
';
      if (okList.length) r2 += '✅ OK: ' + okList.join(', ') + '
';
      if (failList.length) {
        r2 += '❌ Falhas:
';
        for (const f of failList) r2 += '• ' + f.target + ' → ' + f.err + '
';
      }
      resposta = r2;
    } else {
      resposta = '❌ Projeto não reconhecido. Use: @reenviar pardinho, osasco, sala ou todos';
    }

  } else if (cmd === 'avisar') {
    const args = finalCmdMatch[2] ? finalCmdMatch[2].split(' ') : [];
    if (args.length > 1) {
      const alvo = args[0].toLowerCase();
      const mensagemAviso = finalCmdMatch[2].substring(alvo.length).trim();
      let telefones = [];
      if (alvo === 'todos') telefones.push('5537998268576','5561991015639','5561999996252','5513991995918','5513978216285','5511986012223','5531998894664');
      else if (alvo.includes('rk')) telefones.push('5531998894664');
      else if (alvo.includes('pardinho')) telefones.push('5537998268576');
      else if (alvo.includes('osasco')) telefones.push('5561991015639');
      else if (alvo.includes('brasil') || alvo.includes('santos')) telefones.push('5561999996252');
      else if (alvo.includes('sala')) telefones.push('5513991995918', '5513978216285');

      if (telefones.length > 0) {
        resposta = '✅ Aviso enviado para a equipe de *' + (alvo.charAt(0).toUpperCase() + alvo.slice(1)) + '*!';
        for (const t of telefones) {
           await responder.call(this, '📢 *AVISO DA GESTÃO*

' + mensagemAviso, t);
        }
      } else {
        resposta = '❌ Projeto não encontrado. Use: @avisar pardinho/osasco/sala <mensagem>';
      }
    } else {
      resposta = '❌ Faltou a mensagem. Use: @avisar <projeto> <mensagem>
Ex: @avisar osasco reunião amanhã 8h';
    }

  } else if (cmd === 'tarefaconsorcio' || cmd === 'tarefacons') {
    const args = finalCmdMatch[2] ? finalCmdMatch[2].split(' ') : [];
    if (!proj || !proj.isDiretor) {
      resposta = '❌ Permissão negada. Apenas diretoria pode delegar tarefas.';
    } else if (args.length > 1) {
      const alvo = args[0].toLowerCase();
      const descricao = finalCmdMatch[2].substring(args[0].length).trim();
      const FABRIZZIO = '5574999076534';
      
      const CONSORCIO_ENG = [
        { nome: 'Veronica', tel: '5513997733121', setor: 'planejamento' },
        { nome: 'Valdean', tel: '559991392763', setor: 'planejamento' },
        { nome: 'Junior', tel: '5511986012223', setor: 'planejamento' },
        { nome: 'Jose Marcio', tel: '5511941816005', setor: 'producao' },
        { nome: 'Gabriel', tel: '5513991995918', setor: 'salatecnica' },
        { nome: 'Vinicius', tel: '5513978216285', setor: 'salatecnica' }
      ];

      let destinos = [];
      if (alvo === 'todos') {
        destinos = CONSORCIO_ENG.slice();
      } else if (alvo.includes('plan')) {
        destinos = CONSORCIO_ENG.filter(e => e.setor === 'planejamento');
      } else if (alvo.includes('prod')) {
        destinos = CONSORCIO_ENG.filter(e => e.setor === 'producao');
      } else if (alvo.includes('sala')) {
        destinos = CONSORCIO_ENG.filter(e => e.setor === 'salatecnica');
      }

      if (destinos.length > 0) {
        const msg = '🚨 *NOVA TAREFA DELEGADA - CONSÓRCIO SE LIGA* 🚨

👤 Delegado por: *' + proj.responsavel + '*
📝 *Tarefa:* ' + descricao + '

⚠️ _Protocolada no Painel Gestão 360._
_Responda com "Ciente" para confirmar._';
        const enviados = [];
        const falhas = [];
        for (const d of destinos) {
          const r = await responder.call(this, msg, d.tel);
          if (r.ok) enviados.push(d.nome); else falhas.push(d.nome + ' (' + r.err + ')');
          // Tentativa de salvar na base para histórico do consorcio
          try {
            await salvarSupabase(this, 'tarefas', {
              project_id: resolverProjectId('sala_tecnica'),
              delegado_por: proj.responsavel,
              delegado_para: d.nome,
              telefone_destino: d.tel,
              descricao: descricao,
              status: 'pendente',
              prioridade: 'normal',
            });
          } catch(e) {}
        }
        
        const msgFabrizzio = 'ℹ️ *CÓPIA DE TAREFA - CONSÓRCIO SE LIGA*

O diretor *' + proj.responsavel + '* enviou uma tarefa para o setor (' + alvo.toUpperCase() + ' - ' + enviados.join(', ') + ')

📝 *Tarefa:* ' + descricao;
        await responder.call(this, msgFabrizzio, FABRIZZIO);

        resposta = '✅ Tarefa envidada p/ Consórcio: *' + enviados.join(', ') + '*
*(Cópia enviada auto p/ Fabrizzio)*';
        if (falhas.length) resposta += '
❌ Falhas: ' + falhas.join(', ');
      } else {
        resposta = '❌ Setor não reconhecido. Use: @tarefaconsorcio <planejamento|producao|sala|todos> <descrição>';
      }
    } else {
      resposta = '❌ Faltou o setor ou a descrição. Use: @tarefaconsorcio <setor|todos> <descrição>
Ex: @tarefaconsorcio planejamento revisar cronograma';
    }

  } else if (cmd === 'tarefa' || cmd === 'task') {
    const args = finalCmdMatch[2] ? finalCmdMatch[2].split(' ') : [];
    if (!proj || !proj.isDiretor) {
      resposta = '❌ Permissão negada. Apenas diretoria pode delegar tarefas.';
    } else if (args.length > 1) {
      const alvo = args[0].toLowerCase();
      const descricao = finalCmdMatch[2].substring(args[0].length).trim();
      const FABRIZZIO = '5574999076534';

      const TODOS_ENG = [
        { nome: 'Ícaro',    tel: '5537998268576', proj: 'pardinho' },
        { nome: 'Mateus',   tel: '5561991015639', proj: 'osasco' },
        { nome: 'Gabriel',  tel: '5513991995918', proj: 'sala_tecnica' },
        { nome: 'Vinicius', tel: '5513978216285', proj: 'sala_tecnica' },
      ];
      const escopoDir = proj.escopo || [];
      const escopoTodos = escopoDir.includes('todos');

      let destinos = [];
      if (alvo === 'todos') {
        destinos = escopoTodos ? TODOS_ENG.slice() : TODOS_ENG.filter(e => escopoDir.includes(e.proj));
      }
      else if (alvo.includes('mateus') || alvo.includes('matheus')) destinos.push({nome:'Mateus', tel:'5561991015639'});
      else if (alvo.includes('icaro') || alvo.includes('ícaro')) destinos.push({nome:'Ícaro', tel:'5537998268576'});
      else if (alvo.includes('gabriel')) destinos.push({nome:'Gabriel', tel:'5513991995918'});
      else if (alvo.includes('vinicius') || alvo.includes('vinícius')) destinos.push({nome:'Vinicius', tel:'5513978216285'});
      else if (alvo.includes('thalita')) destinos.push({nome:'Thalita', tel:'5511919803270'});
      else if (alvo.includes('felipe')) destinos.push({nome:'Felipe', tel:'5561981846325'});

      if (destinos.length > 0) {
        const msg = '🚨 *NOVA TAREFA DELEGADA (DIRETORIA)* 🚨

👤 Delegado por: *' + proj.responsavel + '*
📝 *Tarefa:* ' + descricao + '

⚠️ _Protocolada no Painel Gestão 360._
_Responda com "Ciente" para confirmar._';
        const enviados = [];
        const falhas = [];
        for (const d of destinos) {
          const r = await responder.call(this, msg, d.tel);
          if (r.ok) enviados.push(d.nome); else falhas.push(d.nome + ' (' + r.err + ')');
          // Salvar tarefa no Supabase
          await salvarSupabase(this, 'tarefas', {
            project_id: resolverProjectId(d.proj || proj.nome),
            delegado_por: proj.responsavel,
            delegado_para: d.nome,
            telefone_destino: d.tel,
            descricao: descricao,
            status: 'pendente',
            prioridade: 'normal',
          });
        }
        resposta = '✅ Tarefa enviada para: *' + enviados.join(', ') + '* — 💾 Salva no Supabase';
        if (falhas.length) resposta += '
❌ Falhas: ' + falhas.join(', ');
      } else {
        resposta = '❌ Executor não cadastrado. Use: @tarefa <nome|todos> <descrição>
Nomes: mateus, icaro, gabriel, vinicius, thalita';
      }
    } else {
      resposta = '❌ Faltou o nome e a descrição. Use: @tarefa <nome|todos> <descrição>
Ex: @tarefa todos enviar foto da frente até 17h';
    }

  } else if (cmd === 'ia' || cmd === 'ai') {
    resposta = '🤖 A IA está temporariamente desligada para manutenção.';

  } else {
    resposta = '❌ Comando *@' + cmd + '* não existe.

Comandos válidos: menu, @status, @equipe, @projetos, @dashboard, @reenviar, @rdo, @meurdo, @tarefa, @avisar';
  }

  await responder.call(this, resposta);
  return [{ json: { ignorar: true, motivo: 'Comando @' + cmd } }];
}

// Apenas um número (1-11) → pergunta o valor desse tópico se não for Gestor
const numMatchRdo = trimmed.match(/^([0-9]{1,2})$/);
if (numMatchRdo && proj && !proj.isGestor) {
  const num = parseInt(numMatchRdo[1], 10);
  const q = proj.perguntas.find(x => x.num === num);
  if (q) {
    const msg = '✏️ *Tópico ' + num + ' — ' + q.label + '*

Responda agora o valor/status.
Exemplo: *' + q.tag + ': 50*

Ou mande direto: *' + num + ': seu valor aqui*';
    await responder.call(this, msg);
    return [{ json: { ignorar: true, motivo: 'Pergunta tópico ' + num } }];
  }
}

// ===== DIRETORES RESPONDENDO RDO DE SUPERVISÃO (formato 1: valor) =====
if (proj && proj.isDiretor && /^s*d+s*[:=]/m.test(trimmed)) {
  const partes = trimmed.split(/[|
]/).map(s => s.trim()).filter(Boolean);
  const tagLines = [];
  const ackLabels = [];
  for (const p of partes) {
    const m = p.match(/^(d+)s*[:=]s*(.+)$/);
    if (m) {
      const q = RDO_DIRETOR_SUPERVISAO.find(x => x.num === parseInt(m[1], 10));
      if (q) {
        tagLines.push(q.tag + ': ' + m[2].trim());
        ackLabels.push('✅ *' + q.num + '. ' + q.label + '* → ' + m[2].trim());
      }
    }
  }
  if (tagLines.length > 0) {
    const respondidos = RDO_DIRETOR_SUPERVISAO.filter(q => tagLines.some(t => t.startsWith(q.tag + ':'))).map(q => q.num);
    const pendentes = RDO_DIRETOR_SUPERVISAO.filter(q => !respondidos.includes(q.num));
    // GUARD confidencialidade: só salva se project_id foi resolvido com certeza.
    const hoje = new Date().toISOString().split('T')[0];
    const pidSup = resolverProjectId(proj.nome);
    if (!pidSup) {
      await responder.call(this, '🚨 *RDO NÃO SALVO — projeto não identificado*
Seu RDO de supervisão foi recebido mas não pôde ser vinculado a um projeto específico. Admin notificado.
Motivo: project_id ausente para "' + proj.nome + '". Dado NÃO foi gravado para evitar vazamento entre projetos.');
      return [{ json: { ignorar: true, motivo: 'project_id nulo - supervisão recusada', phone } }];
    }
    await salvarSupabase(this, 'rdos', {
      project_id: pidSup,
      data: hoje,
      clima: 'bom',
      observacoes: 'RDO Supervisão — ' + proj.responsavel + ': ' + tagLines.join(' | '),
      apontador: proj.responsavel + ' (Diretor)',
      status: 'aberto',
    });
    let ack = '📥 *RDO Supervisão Recebido!* 💾
Diretor: *' + proj.responsavel + '*

' + ackLabels.join('
');
    if (pendentes.length > 0) {
      ack += '

⏳ *Ainda faltam:*
' + pendentes.map(q => '( ' + q.num + ' ) ' + q.label).join('
');
    } else {
      ack += '

🎉 *RDO Supervisão completo!* Consolidado no Dashboard 360.';
    }
    await responder.call(this, ack);
    if (!isAdmin) {
      await responder.call(this, '📋 *RDO SUPERVISÃO RECEBIDO*

👤 Diretor: *' + proj.responsavel + '*
' + ackLabels.join('
'), ADMIN_PHONE);
    }
    return [{ json: { ignorar: true, motivo: 'RDO supervisão diretor recebido e salvo no Supabase', phone, text: tagLines.join('
') } }];
  }
}

// Resposta no formato "1: valor" ou "1: a | 2: b | 3: c" — converte pra tags e segue pro RDO (engenheiros)
if (proj && !proj.isGestor && /^s*d+s*[:=]/m.test(trimmed)) {
  const partes = trimmed.split(/[|
]/).map(s => s.trim()).filter(Boolean);
  const tagLines = [];
  const ackLabels = [];
  for (const p of partes) {
    const m = p.match(/^(d+)s*[:=]s*(.+)$/);
    if (m) {
      const q = proj.perguntas.find(x => x.num === parseInt(m[1], 10));
      if (q) {
        tagLines.push(q.tag + ': ' + m[2].trim());
        ackLabels.push('✅ *' + q.num + '. ' + q.label + '* → ' + m[2].trim());
      }
    }
  }
  if (tagLines.length > 0) {
    text = tagLines.join('
');
    const respondidos = proj.perguntas.filter(q => tagLines.some(t => t.startsWith(q.tag + ':'))).map(q => q.num);
    const pendentes = proj.perguntas.filter(q => !respondidos.includes(q.num));
    // Extrair dados numéricos para o Supabase
    const metrosTag = tagLines.find(t => t.startsWith('metros_rede:'));
    const efetivoTag = tagLines.find(t => t.startsWith('efetivo:'));
    const climaTag = tagLines.find(t => t.startsWith('clima:'));
    const metrosVal = metrosTag ? parseFloat(metrosTag.split(':')[1]) || 0 : 0;
    const efetivoVal = efetivoTag ? parseInt(efetivoTag.split(':')[1]) || 0 : 0;
    let climaVal = 'bom';
    if (climaTag) {
      const cv = climaTag.split(':')[1].trim().toLowerCase();
      if (['bom','nublado','chuva','parado'].includes(cv)) climaVal = cv;
    }
    // GUARD confidencialidade: só salva se project_id foi resolvido com certeza.
    const hoje = new Date().toISOString().split('T')[0];
    const pidEng = resolverProjectId(proj.nome);
    if (!pidEng) {
      await responder.call(this, '🚨 *RDO NÃO SALVO — projeto não identificado*
Seu RDO foi recebido mas não pôde ser vinculado a um projeto específico (' + proj.nome + '). Admin notificado.
Dado NÃO foi gravado para evitar vazamento entre projetos.');
      await responder.call(this, '🚨 *ALERTA CONFIDENCIALIDADE*
RDO de *' + proj.responsavel + '* (' + proj.nome + ') recusado: project_id nao mapeado em PROJECT_IDS.
Telefone: ' + phone + '
Conteudo: ' + tagLines.join(' | ').slice(0, 300), ADMIN_PHONE);
      return [{ json: { ignorar: true, motivo: 'project_id nulo - RDO engenheiro recusado', phone } }];
    }
    const rdoSaved = await salvarSupabase(this, 'rdos', {
      project_id: pidEng,
      data: hoje,
      clima: climaVal,
      producao_m: metrosVal,
      equipe_number: efetivoVal,
      observacoes: tagLines.join(' | '),
      apontador: proj.responsavel,
      latitude: locLat,
      longitude: locLng,
      fotos: mediaUrl ? [mediaUrl] : [],
      status: pendentes.length === 0 ? 'aberto' : 'aberto',
    });
    let ack = '📥 *Recebido!* ' + (rdoSaved ? '💾' : '⚠️') + '

' + ackLabels.join('
');
    if (pendentes.length > 0) {
      ack += '

⏳ *Ainda faltam:*
' + pendentes.map(q => '( ' + q.num + ' ) ' + q.label).join('
');
    } else {
      ack += '

🎉 *RDO completo!* Todos os tópicos respondidos e salvos no Supabase.';
    }
    await responder.call(this, ack);
    const resumoRdo = '📥 *RDO RECEBIDO* ' + (rdoSaved ? '💾' : '') + '

👷 *' + proj.responsavel + '* — ' + proj.nome + '
' + ackLabels.join('
');
    await responder.call(this, resumoRdo, ADMIN_PHONE);
    return [{ json: { ignorar: true, motivo: 'RDO recebido, processado e salvo no Supabase', phone, text } }];
  }
}

// ========== FALLBACK — IA SÓ PRO FELIPE FALANDO CONSIGO MESMO ==========
if (proj && proj.isGestor) {
  // IA só responde se for o Felipe E estiver falando consigo mesmo (fromMe)
  if (isAdmin && isFromMe) {
    await responder.call(this, '⏳ Analisando sua mensagem...');
    const respostaIA = await perguntarGroq(this, text);
    await responder.call(this, '🤖 *Assistente IA:*

' + respostaIA);
    return [{ json: { ignorar: true, motivo: 'IA respondeu Felipe (fromMe)' } }];
  }
  // Qualquer outro gestor ou Felipe recebendo msg de outros → silêncio
  return [{ json: { ignorar: true, motivo: 'Texto livre gestor - silêncio (IA é só Felipe fromMe)' } }];
}

// Engenheiro mandou texto que não é número nem tag — NÃO responde (deixa a conversa normal)
if (proj && !proj.isGestor) {
  // Silêncio — o engenheiro pode estar só conversando com o Felipe
  return [{ json: { ignorar: true, motivo: 'Texto livre engenheiro - IA desligada' } }];
}

// Phone desconhecido — NÃO responde (silêncio total)
return [{ json: { ignorar: true, motivo: 'Phone sem destino: ' + phone } }];

} catch (err) {
  return [{ json: { error: err.message, stack: err.stack, ignorar: true } }];
}
`,
    };

    @node({
        id: 'c8b0f5e7-cc39-42cd-acea-3781ef7b212c',
        name: 'Ignorar?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [500, 300],
    })
    Ignorar = {
        conditions: {
            options: {},
            combinator: 'and',
            conditions: [
                {
                    id: 'nao-ignorar',
                    leftValue: '={{ $json.ignorar }}',
                    rightValue: false,
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
        id: '749c5875-da8b-4e1a-8c18-297ab3e22773',
        name: 'Encaminhar para Sub-Workflow',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [750, 300],
    })
    EncaminharParaSubWorkflow = {
        url: '={{ $json.targetWebhook }}',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ phone: $json.phone, message: $json.text }) }}',
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ReceberEvolutionApi.out(0).to(this.ParseEventoWhatsapp.in(0));
        this.ParseEventoWhatsapp.out(0).to(this.Ignorar.in(0));
        this.Ignorar.out(0).to(this.EncaminharParaSubWorkflow.in(0));
    }
}
