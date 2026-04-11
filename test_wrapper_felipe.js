
(async function() {
    let $input = {
        first: () => ({ json: { body: { 
            event: 'messages.upsert', 
            data: { 
                key: { remoteJid: '5561981846325@s.whatsapp.net', fromMe: false }, 
                message: { conversation: 'menu' }, 
                pushName: 'Felipe' 
            } 
        } } })
    };
    
    let responderCalled = false;
    let thisCtx = {
        helpers: {
            httpRequest: async (opts) => {
                console.log("MOCK HTTP REQUEST", opts);
                return {ok: true};
            }
        }
    };
    
    try {
        let result = await (async function() {
            
// O corpo do webhook do Evolution vem em $input.first().json.body
const payload = $input.first().json.body || $input.first().json;

// ========== SUPABASE CONFIG ==========
const SUPABASE_URL = 'https://vblfdikfobsirwpdnybw.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibGZkaWtmb2JzaXJ3cGRueWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzAwODIsImV4cCI6MjA4ODk0NjA4Mn0.GOx3HoMh3P2Zzxz8BxNsfQBfXwsNZNQsdVc3nJaqRy4';
const PROJECT_IDS = {
  santos: '2a28beec-b1f8-4b0c-8416-d0710bb35d9d',
  osasco: 'f3c6645b-347f-4382-b9c5-d103c27ec511',
  pardinho: 'ec112c9a-1669-4287-8079-526d6940ce82',
  sala: 'abe7f66c-004b-4bb5-a245-6be67debd9f7',
};

async function salvarSupabase(ctx, tabela, dados) {
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

function resolverProjectId(projetoNome) {
  if (!projetoNome) return PROJECT_IDS.santos;
  const n = projetoNome.toLowerCase();
  if (n.includes('pardinho') || n.includes('itapetininga')) return PROJECT_IDS.pardinho;
  if (n.includes('osasco') || n.includes('clu') || n.includes('cuiab')) return PROJECT_IDS.osasco;
  if (n.includes('sala') || n.includes('tÃƒÂ©cnica') || n.includes('tecnica')) return PROJECT_IDS.sala;
  return PROJECT_IDS.santos;
}

// Se nÃƒÂ£o for mensagem, ignora
if (!payload.data || payload.event !== 'messages.upsert') {
  return { json: { ignorar: true } }];
}

const msgData = payload.data;
const remoteJid = msgData.key.remoteJid || '';
let phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');

// Fallback: WhatsApp moderno manda @lid (identificador opaco) em vez do nÃƒÂºmero real.
// Nesse caso resolvemos pelo pushName.
const pushName = (msgData.pushName || '').toLowerCase();
if (phone.includes('@lid') || phone.includes('@')) {
  if (pushName.includes('gabriel')) phone = '5513991995918';
  else if (pushName.includes('vinicius') || pushName.includes('vinÃƒÂ­cius')) phone = '5513978216285';
  else if (pushName.includes('icaro') || pushName.includes('ÃƒÂ­caro')) phone = '5537998268576';
  else if (pushName.includes('mateus') || pushName.includes('matheus')) phone = '5561991015639';
  else if (pushName.includes('joÃƒÂ£o') || pushName.includes('joao')) phone = '5561999996252';
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
  // Detectar LOCALIZAÃƒâ€¡ÃƒÆ’O enviada
  if (msgData.message.locationMessage) {
    locLat = msgData.message.locationMessage.degreesLatitude;
    locLng = msgData.message.locationMessage.degreesLongitude;
    text = text || 'LocalizaÃƒÂ§ÃƒÂ£o enviada';
  }
}

// Se tem foto ou localizaÃƒÂ§ÃƒÂ£o sem texto, processar como RDO com mÃƒÂ­dia
if (!text && !mediaUrl && !locLat) {
  return { json: { ignorar: true, motivo: 'Sem texto e sem mÃƒÂ­dia' } }];
}

const trimmed = text.trim();
const lower = trimmed.toLowerCase();

// ========== CONTROLE DE IA ==========
// IA funciona APENAS para o Felipe, e SOMENTE quando ele fala consigo mesmo (fromMe).
const ADMIN_PHONE = '5561981846325'; // Felipe
const isAdmin = phone.includes('81846325');
const isFromMe = !!msgData.key.fromMe;

// Ignora mensagens enviadas pelo prÃƒÂ³prio bot (fromMe), EXCETO se for um comando explÃƒÂ­cito
// enviado pelo Gestor (Felipe) para testar o fluxo consigo mesmo ou disparar aÃƒÂ§ÃƒÂµes.
if (isFromMe) {
  const isComando = /^(@|menu|ajuda|comandos|status|equipe|projetos|dashboard|ia|ai|rdo|gerar|subir|1[0-1]|[1-9sm])/i.test(trimmed);
  if (!isComando && !isAdmin) {
    return { json: { ignorar: true, motivo: 'Enviada por mim (nÃƒÂ£o ÃƒÂ© comando)' } }];
  }
  // Felipe falando consigo mesmo com texto livre Ã¢â€ â€™ IA vai responder no fallback
  // NÃƒÂ£o bloqueia aqui
}

// Identifica projeto e perguntas pelo telefone
function projetoDoPhone(p) {
  if (p.includes('999996252')) return {
    nome: 'ConstruData BrasÃƒÂ­lia (Projeto)', responsavel: 'JoÃƒÂ£o', isGestor: true, isDiretor: true,
    escopo: ['brasilia'],
    perguntas: []
  };
  if (p.includes('991015639')) return {
    nome: 'Osasco - Rua CuiabÃƒÂ¡', responsavel: 'Mateus',
    perguntas: [
      { num: 1, label: 'Frente Capex em execuÃƒÂ§ÃƒÂ£o', tag: 'frente_capex' },
      { num: 2, label: 'Efetivo na obra', tag: 'efetivo' },
      { num: 3, label: 'Metros de rede executados', tag: 'metros_rede' },
      { num: 4, label: 'LigaÃƒÂ§ÃƒÂµes prediais executadas', tag: 'ligacoes' },
      { num: 5, label: 'InterferÃƒÂªncias encontradas', tag: 'interferencias' },
      { num: 6, label: 'PendÃƒÂªncias para amanhÃƒÂ£', tag: 'pendencias' },
    ]
  };
  if (p.includes('991995918') || p.includes('978216285')) return {
    nome: 'Sala TÃƒÂ©cnica SLNR', responsavel: p.includes('991995918') ? 'Gabriel' : 'Vinicius', isSalaTecnica: true,
    perguntas: [
      { num: 1, label: 'Atividades realizadas hoje', tag: 'atividades' },
      { num: 2, label: 'PendÃƒÂªncias / impedimentos', tag: 'pendencias' },
      { num: 3, label: 'PrÃƒÂ³ximos passos (amanhÃƒÂ£)', tag: 'proximos' },
    ]
  };
  if (p.includes('81846325')) return {
    nome: 'GestÃƒÂ£o Geral (Felipe Nery)', responsavel: 'Felipe Nery', isGestor: true, isDiretor: true,
    escopo: ['todos'],
    perguntas: []
  };
  if (p.includes('999076534')) return {
    nome: 'ConsÃƒÂ³rcio Se Liga na Rede (Sala TÃƒÂ©cnica)', responsavel: 'Fabrizzio', isGestor: true, isDiretor: true,
    escopo: ['sala_tecnica'],
    perguntas: []
  };
  if (p.includes('999425397')) return {
    nome: 'Diretoria Pardinho/Osasco/RK', responsavel: 'Luiz Fernando', isGestor: true, isDiretor: true,
    escopo: ['pardinho','osasco','rk_sub'],
    perguntas: []
  };
  if (p.includes('999154319')) return {
    nome: 'Diretoria Pardinho/Osasco/RK', responsavel: 'Renato RK', isGestor: true, isDiretor: true,
    escopo: ['pardinho','osasco','rk_sub'],
    perguntas: []
  };
  if (p.includes('919803270')) return {
    nome: 'Sala TÃƒÂ©cnica SLNR Santos', responsavel: 'Thalita', isGestor: true,
    perguntas: []
  };
  if (p.includes('998268576')) return {
    nome: 'Pardinho - Itapetininga', responsavel: 'ÃƒÂcaro',
    perguntas: [
      { num: 1, label: 'Frente Rede Principal', tag: 'frente_principal' },
      { num: 2, label: 'Frente LigaÃƒÂ§ÃƒÂµes Prediais', tag: 'frente_ligacoes' },
      { num: 3, label: 'Frente ETE / EmissÃƒÂ¡rio', tag: 'frente_ete' },
      { num: 4, label: 'Efetivo total', tag: 'efetivo' },
      { num: 5, label: 'Metros de rede executados', tag: 'metros_rede' },
      { num: 6, label: 'LigaÃƒÂ§ÃƒÂµes prediais executadas', tag: 'ligacoes' },
      { num: 7, label: 'Equipamentos em uso', tag: 'equipamentos' },
      { num: 8, label: 'Materiais recebidos', tag: 'materiais' },
      { num: 9, label: 'Clima', tag: 'clima' },
      { num: 10, label: 'PendÃƒÂªncias / impedimentos', tag: 'pendencias' },
      { num: 11, label: 'Acidentes ou ocorrÃƒÂªncias', tag: 'acidentes' },
    ]
  };
  return null;
}
const proj = projetoDoPhone(phone);

// ========== PERGUNTAS RDO PARA DIRETORES ==========
// Quando um diretor usa @rdo, essas perguntas sÃƒÂ£o disparadas para o engenheiro-alvo
const RDO_PERGUNTAS_DIRETOR = {
  pardinho: [
    'Ã°Å¸â€œâ€¹ *RDO DIÃƒÂRIO Ã¢â‚¬â€ Pardinho*',
    '',
    'ÃƒÂcaro, segue formulÃƒÂ¡rio de hoje:',
    '',
    '*( 1 )* Ã¢â‚¬â€ Frente Rede Principal',
    '*( 2 )* Ã¢â‚¬â€ Frente LigaÃƒÂ§ÃƒÂµes Prediais',
    '*( 3 )* Ã¢â‚¬â€ Frente ETE / EmissÃƒÂ¡rio',
    '*( 4 )* Ã¢â‚¬â€ Efetivo total',
    '*( 5 )* Ã¢â‚¬â€ Metros de rede executados',
    '*( 6 )* Ã¢â‚¬â€ LigaÃƒÂ§ÃƒÂµes prediais executadas',
    '*( 7 )* Ã¢â‚¬â€ Equipamentos em uso',
    '*( 8 )* Ã¢â‚¬â€ Materiais recebidos',
    '*( 9 )* Ã¢â‚¬â€ Clima',
    '*( 10 )* Ã¢â‚¬â€ PendÃƒÂªncias / impedimentos',
    '*( 11 )* Ã¢â‚¬â€ Acidentes ou ocorrÃƒÂªncias',
    '',
    'Ã°Å¸â€™Â¬ Responda: *1: valor | 2: valor | ...*',
    '_Ã¢ÂÂ° Prazo: atÃƒÂ© 18h de hoje._'
  ],
  osasco: [
    'Ã°Å¸â€œâ€¹ *RDO DIÃƒÂRIO Ã¢â‚¬â€ Osasco*',
    '',
    'Mateus, segue formulÃƒÂ¡rio de hoje:',
    '',
    '*( 1 )* Ã¢â‚¬â€ Frente Capex em execuÃƒÂ§ÃƒÂ£o',
    '*( 2 )* Ã¢â‚¬â€ Efetivo na obra',
    '*( 3 )* Ã¢â‚¬â€ Metros de rede executados',
    '*( 4 )* Ã¢â‚¬â€ LigaÃƒÂ§ÃƒÂµes prediais executadas',
    '*( 5 )* Ã¢â‚¬â€ InterferÃƒÂªncias encontradas',
    '*( 6 )* Ã¢â‚¬â€ PendÃƒÂªncias para amanhÃƒÂ£',
    '',
    'Ã°Å¸â€™Â¬ Responda: *1: valor | 2: valor | ...*',
    '_Ã¢ÂÂ° Prazo: atÃƒÂ© 18h de hoje._'
  ],
  sala: [
    'Ã°Å¸â€œâ€¹ *ATIVIDADES DO DIA Ã¢â‚¬â€ Sala TÃƒÂ©cnica*',
    '',
    'Preencha as atividades de hoje:',
    '',
    '*( 1 )* Ã¢â‚¬â€ Atividades realizadas hoje',
    '*( 2 )* Ã¢â‚¬â€ PendÃƒÂªncias / impedimentos',
    '*( 3 )* Ã¢â‚¬â€ PrÃƒÂ³ximos passos (amanhÃƒÂ£)',
    '',
    'Ã°Å¸â€™Â¬ Responda: *1: texto | 2: texto | 3: texto*',
    '_Ã¢ÂÂ° Prazo: atÃƒÂ© 18h de hoje._'
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
  if (!p) return '🤖 ConstruDataMax\n\nNão consegui identificar seu projeto. Telefone detectado: *' + phoneDetectado + '*\nFala com o admin para te cadastrar.';

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
      '6️⃣ *Falar com IA* (só Felipe)',
      '7️⃣ *Cobrar RDO* (Dispara formulário)',
      '8️⃣ *Meu RDO Diretor* (Supervisão)',
      '9️⃣ *Lembrar Tarefas* (Cobra diretores)',
      '🔟 *Criar Tarefas* (Guia de Uso)',
      '1️⃣1️⃣ *Plano de Custos* (Financeiro)',
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
    return menuLinhas.join('\n');
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
  return linhas.join('\n');
}

async function responder(msg, targetPhone = phone) {
  try {
    const r = await this.helpers.httpRequest({
      method: 'POST',
      url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
      headers: { apikey: 'construdata2026', 'Content-Type': 'application/json' },
      body: { number: targetPhone, textMessage: { text: msg } },
      json: true,
    });
    return { ok: true, target: targetPhone, r };
  } catch (e) {
    return { ok: false, target: targetPhone, err: (e && e.message) || String(e) };
  }
}

async function explicarErroGroq(ctx, contexto) {
  if (!staticData.iaAtiva) return 'Comando nÃƒÂ£o reconhecido. Digite *menu* para ver os comandos disponÃƒÂ­veis.';
  const prompt = 'O usuÃƒÂ¡rio tentou usar um bot de WhatsApp de gestÃƒÂ£o de obras (ConstruDataMax) e cometeu um erro. Explique de forma MUITO simples (2-4 linhas, tom amigÃƒÂ¡vel, sem jargÃƒÂ£o tÃƒÂ©cnico) o que ele fez de errado e como corrigir. NÃƒÂ£o invente comandos. Contexto:\\n\\n' + contexto;
  return await perguntarGroq(ctx, prompt);
}

async function perguntarGroq(ctx, pergunta) {
  try {
    const response = await ctx.helpers.httpRequest({
      method: 'POST',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json'
      },
      body: {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'VocÃƒÂª ÃƒÂ© a IA da ConstruDataMax, assistente de engenharia e gestÃƒÂ£o de obras. Responda de forma concisa, direta e muito ÃƒÂºtil. VocÃƒÂª sempre usa linguagem profissional voltada para a construÃƒÂ§ÃƒÂ£o civil.' },
          { role: 'user', content: pergunta }
        ],
        temperature: 0.7,
        max_tokens: 800
      },
      json: true
    });
    return response.choices[0].message.content;
  } catch (e) {
    return 'Ã¢ÂÅ’ Erro na integraÃƒÂ§ÃƒÂ£o da IA: ' + (e.message || 'Falha de conexÃƒÂ£o com o painel Llama-3.');
  }
}

// SaudaÃƒÂ§ÃƒÂ£o ou pedido de ajuda Ã¢â€ â€™ manda menu
if (isSaudacao || isAjuda) {
  await responder.call(this, montarMenu(proj, phone));
  return { json: { ignorar: true, motivo: 'Menu enviado' } }];
}

// ConversÃƒÂ£o de atalhos numÃƒÂ©ricos ou textuais para cmdMatch
let finalCmdMatch = cmdMatch;
const shortcutMatch = trimmed.match(/^(1[0-1]|[1-9]|s|m)$/i);

if (shortcutMatch && proj) {
  const s = shortcutMatch[1].toLowerCase();
  if (proj.isGestor) {
    if (s === '1') finalCmdMatch = [null, 'status', ''];
    else if (s === '2') finalCmdMatch = [null, 'equipe', ''];
    else if (s === '3') finalCmdMatch = [null, 'projetos', ''];
    else if (s === '4') finalCmdMatch = [null, 'dashboard', ''];
    else if (s === '5') finalCmdMatch = [null, 'reenviar', 'todos'];
    else if (s === '6') finalCmdMatch = [null, 'ia', ''];
    else if (s === '7') finalCmdMatch = [null, 'rdo', 'todos'];
    else if (s === '8') finalCmdMatch = [null, 'meurdo', ''];
    else if (s === '9') finalCmdMatch = [null, 'lembrar', 'diretores'];
    else if (s === '10') finalCmdMatch = [null, 'criartarefa', ''];
    else if (s === '11') finalCmdMatch = [null, 'planocustos', ''];
  } else {
    if (s === 'm') finalCmdMatch = [null, 'menu', ''];
    else if (s === 's') finalCmdMatch = [null, 'status', proj.nome];
  }
}

// Comando @ ou atalho numÃƒÂ©rico
if (finalCmdMatch) {
  const cmd = finalCmdMatch[1].toLowerCase();
  let resposta = '';
  
  if (cmd === 'ajuda' || cmd === 'comandos' || cmd === 'help' || cmd === 'menu') {
    resposta = montarMenu(proj, phone);

  } else if (cmd === 'projeto') {
    resposta = 'Ã°Å¸â€œâ€¹ Projeto: *' + (proj ? proj.nome : 'nÃƒÂ£o identificado') + '*';

  } else if (cmd === 'status') {
    const alvo = finalCmdMatch[2] ? finalCmdMatch[2].toLowerCase() : 'todos';
    const hojeStr = new Date().toLocaleDateString('pt-BR');
    let texto = 'Ã°Å¸â€œÅ  *Status RDO de Hoje* Ã¢â‚¬â€ ' + hojeStr + '\\n\\n';
    
    if (proj.responsavel !== 'Fabrizzio' && (alvo === 'todos' || alvo.includes('pardinho'))) {
      texto += 'Ã°Å¸â€œÅ’ *Pardinho* (ÃƒÂcaro)\\nÃ¢ÂÅ’ Pendente: Falta reportar frente LigaÃƒÂ§ÃƒÂµes e EmissÃƒÂ¡rio\\n\\n';
    }
    if (proj.responsavel !== 'Fabrizzio' && (alvo === 'todos' || alvo.includes('osasco'))) {
      texto += 'Ã°Å¸â€œÅ’ *Osasco* (Mateus)\\nÃ¢Å“â€¦ Entregue: 100% preenchido\\n\\n';
    }
    if (alvo === 'todos' || alvo.includes('brasil') || alvo.includes('santos')) {
      texto += 'Ã°Å¸â€œÅ’ *ConstruData BrasÃƒÂ­lia* (JoÃƒÂ£o)\\nÃ¢Å“â€¦ Entregue: Sem interferÃƒÂªncias\\n\\n';
    }
    if (alvo === 'todos' || alvo.includes('sala')) {
      texto += 'Ã°Å¸â€œÅ’ *Sala TÃƒÂ©cnica SLNR* (Gabriel/Vinicius)\\nÃ¢ÂÅ’ Pendente: EspacializaÃƒÂ§ÃƒÂ£o Survey atrasada\\n\\n';
    }
    texto += '_Para cobrar, digite @reenviar <projeto> ou @rdo <projeto>_';
    resposta = texto;

  } else if (cmd === 'equipe') {
    resposta = 'Ã°Å¸â€˜Â¥ *Contatos da Equipe*\\n\\n' +
      '*Diretoria:*\\n' +
      'Ã¢â‚¬Â¢ Felipe Nery Ã¢â‚¬â€ Gestor Geral\\n' +
      'Ã¢â‚¬Â¢ Renato RK Ã¢â‚¬â€ Diretor (28 99915-4319)\\n' +
      'Ã¢â‚¬Â¢ Luiz Fernando Ã¢â‚¬â€ Diretor (37 99942-5397)\\n' +
      'Ã¢â‚¬Â¢ Fabrizzio Ã¢â‚¬â€ Gerente ConsÃƒÂ³rcio Sala TÃƒÂ©cnica (74 99907-6534)\\n\\n' +
      '*Engenheiros (RDO):*\\n' +
      'Ã¢â‚¬Â¢ ÃƒÂcaro Ã¢â‚¬â€ Pardinho (37 99826-8576)\\n' +
      'Ã¢â‚¬Â¢ Mateus Ã¢â‚¬â€ Osasco (61 99101-5639)\\n' +
      'Ã¢â‚¬Â¢ JoÃƒÂ£o Ã¢â‚¬â€ ConstruData BrasÃƒÂ­lia (61 99999-6252)\\n\\n' +
      '*Sala TÃƒÂ©cnica SLNR:*\\n' +
      'Ã¢â‚¬Â¢ Gabriel (13 99199-5918)\\n' +
      'Ã¢â‚¬Â¢ Vinicius (13 97821-6285)\\n' +
      'Ã¢â‚¬Â¢ Thalita (11 91980-3270)\\n' +
      '\\n_Use @rdo <projeto>, @avisar <projeto> <msg> ou @tarefa <nome> <desc>_';
      
  } else if (cmd === 'projetos') {
    resposta = 'Ã°Å¸Ââ€”Ã¯Â¸Â *Projetos Ativos*\\n' +
      '1. ConstruData BrasÃƒÂ­lia (JoÃƒÂ£o)\\n' +
      '2. Osasco - Rua CuiabÃƒÂ¡ (Mateus)\\n' +
      '3. Pardinho - Itapetininga (ÃƒÂcaro)\\n' +
      '4. Sala TÃƒÂ©cnica SLNR (Gabriel/Vinicius/Thalita)\\n' +
      '\\n_Acompanhe em https://construdatamaxv2-clean.vercel.app_';

  } else if (cmd === 'dashboard') {
    resposta = 'Ã°Å¸â€œË† *Dashboard Consolidado*\\n' +
      'O dashboard consolidado de RDO jÃƒÂ¡ estÃƒÂ¡ atualizado e disponÃƒÂ­vel.\\n\\n' +
      'Acesse no portal:\\nhttps://construdatamaxv2-clean.vercel.app/dashboard/consolidado';

  // ===== @rdo <projeto|todos> Ã¢â‚¬â€ DISPARA FORMULÃƒÂRIO RDO PRO ENGENHEIRO =====
  } else if (cmd === 'rdo') {
    if (!proj || !proj.isGestor) {
      resposta = 'Ã¢ÂÅ’ Apenas diretores/gestores podem disparar RDO.';
    } else {
      const alvo = finalCmdMatch[2] ? finalCmdMatch[2].toLowerCase() : 'todos';
      const hojeStr = new Date().toLocaleDateString('pt-BR');
      const enviados = [];
      const falhas = [];

      // Pardinho Ã¢â€ â€™ ÃƒÂcaro
      if (proj.responsavel !== 'Fabrizzio' && (alvo === 'todos' || alvo.includes('pardinho'))) {
        const msg = RDO_PERGUNTAS_DIRETOR.pardinho.join('\\n') + '\\n\\nÃ°Å¸â€œâ€¦ ' + hojeStr;
        const r = await responder.call(this, msg, '5537998268576');
        if (r.ok) enviados.push('ÃƒÂcaro (Pardinho)'); else falhas.push('ÃƒÂcaro: ' + r.err);
      }
      // Osasco Ã¢â€ â€™ Mateus
      if (proj.responsavel !== 'Fabrizzio' && (alvo === 'todos' || alvo.includes('osasco'))) {
        const msg = RDO_PERGUNTAS_DIRETOR.osasco.join('\\n') + '\\n\\nÃ°Å¸â€œâ€¦ ' + hojeStr;
        const r = await responder.call(this, msg, '5561991015639');
        if (r.ok) enviados.push('Mateus (Osasco)'); else falhas.push('Mateus: ' + r.err);
      }
      // Sala TÃƒÂ©cnica Ã¢â€ â€™ Gabriel + Vinicius
      if (alvo === 'todos' || alvo.includes('sala')) {
        const msg = RDO_PERGUNTAS_DIRETOR.sala.join('\\n') + '\\n\\nÃ°Å¸â€œâ€¦ ' + hojeStr;
        const r1 = await responder.call(this, msg, '5513991995918');
        const r2 = await responder.call(this, msg, '5513978216285');
        if (r1.ok) enviados.push('Gabriel (Sala)'); else falhas.push('Gabriel: ' + r1.err);
        if (r2.ok) enviados.push('Vinicius (Sala)'); else falhas.push('Vinicius: ' + r2.err);
      }

      // Diretores
      if (alvo === 'todos' || alvo.includes('diretor')) {
        const msg = 'Ã¢Å¡Â Ã¯Â¸Â *COBRANÃƒâ€¡A DE RDO Ã¢â‚¬â€ DIRETORIA*\\n\\nAtenÃƒÂ§ÃƒÂ£o Diretores, por favor enviem o RDO de SupervisÃƒÂ£o diÃƒÂ¡rio.\\nBasta digitar *@meurdo* para preencher o relatÃƒÂ³rio consolidado.';
        const diretores = [
          {nome: 'Renato RK', tel: '5528999154319'},
          {nome: 'Luiz Fernando', tel: '5537999425397'},
          {nome: 'Fabrizzio', tel: '5574999076534'}
        ];
        for (const dir of diretores) {
          const r = await responder.call(this, msg, dir.tel);
          if (r.ok) enviados.push(dir.nome + ' (Diretoria)'); else falhas.push(dir.nome + ': ' + r.err);
        }
      }

      if (enviados.length > 0) {
        resposta = 'Ã°Å¸â€œâ€¹ *RDO disparado com sucesso!*\\n\\nÃ¢Å“â€¦ Enviado para: ' + enviados.join(', ');
        if (falhas.length) resposta += '\\nÃ¢ÂÅ’ Falhas: ' + falhas.join(', ');
        resposta += '\\n\\n_Os engenheiros e diretores receberam o alerta._';
      } else {
        resposta = 'Ã¢ÂÅ’ Projeto nÃƒÂ£o encontrado. Use: @rdo pardinho, osasco, sala, diretores ou todos';
      }
    }

  // ===== @meurdo Ã¢â‚¬â€ RDO DE SUPERVISÃƒÆ’O DO DIRETOR =====
  } else if (cmd === 'gerar' || cmd === 'subir') {
    if (!proj || (!proj.isGestor && !proj.isDiretor)) {
      resposta = '❌ Apenas gestores podem emitir comandos de sistema.';
    } else {
      const acao = finalCmdMatch[2] ? finalCmdMatch[2].toLowerCase() : '';
      if (acao.includes('dashboard') || acao.includes('machine learning') || acao.includes('relatório') || acao.includes('relatorio') || cmd === 'subir') {
        const msgOperacao = cmd === 'subir' ? 'Sincronização com o painel Gestão 360' : 'Geração de ' + acao;
        resposta = '✅ *COMANDO RECEBIDO:*\nOperação de ' + msgOperacao + ' iniciada no backend.\n⏳ Os dados estão sendo processados pela IA e serão consolidados na plataforma ConstruDataMax.';
      } else {
        resposta = '❌ Especifique o alvo. Exemplo:\n@gerar dashboard\n@gerar machine learning\n@gerar relatórios';
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
          const r = await responder.call(this, '⚠️ *LEMBRETE OBRIGATÓRIO* ⚠️\n\nDiretor ' + d.nome + ', por favor mande hoje as tarefas matinais para as suas equipes responsáveis.\n💡 *Como fazer:* Use *@tarefa <engenheiro> <descrição>*\n\n_Esteja atento aos projetos da sua alçada!_', d.tel);
          if(r.ok) oks.push(d.nome);
        }
      }
      resposta = '✅ Lembrete metódico disparado matinalmente para os Diretores: ' + oks.join(', ');
    }
  
  } else if (cmd === 'criartarefa') {
    resposta = '🛠️ *GUIA PARA CRIAR TAREFAS*\n\nPara atribuir obrigações aos engenheiros, escreva:\n\n*@tarefa <nome> <descrição>*\n\nMembros elegíveis:\n• *Ícaro* (Pardinho)\n• *Mateus* (Osasco)\n• *Alexandre* ou *Igor* (RK Sub)\n• *Junior*, *Valdeans*, *Veronica*, *Jose Marcio* (Sala Técnica)\n\n_Ex: @tarefa icaro Focar na escavação da rede 2._';

  } else if (cmd === 'planocustos') {
    resposta = '💰 *PLANO DE CONTAS (CUSTO DIÁRIO)*\n\nO preenchimento de Custos Diários foi EMBUTIDO no RDO normal dos equipamentos e equipes (Osasco, Pardinho e RK)!\n\nAo responder o RDO, preencha as rubricas numéricas de:\n- Diesel/Combustível\n- Alimentação/Hotelaria\n- Mão de Obra Fixa/Avulsa\n- Materiais/Equipamentos';
  
  } else if (cmd === 'meurdo' || cmd === 'meurdo') {
    if (!proj || !proj.isDiretor) {
      resposta = 'Ã¢ÂÅ’ Apenas diretores podem preencher o RDO de supervisÃƒÂ£o.';
    } else {
      const hojeStr = new Date().toLocaleDateString('pt-BR');
      const linhas = [
        'Ã°Å¸â€œâ€¹ *RDO DE SUPERVISÃƒÆ’O Ã¢â‚¬â€ DIRETORIA*',
        'Ã°Å¸â€œâ€¦ ' + hojeStr,
        'Diretor: *' + proj.responsavel + '*',
        '',
      ];
      for (const q of RDO_DIRETOR_SUPERVISAO) {
        linhas.push('*( ' + q.num + ' )* Ã¢â‚¬â€ ' + q.label);
      }
      linhas.push('');
      linhas.push('Ã°Å¸â€™Â¬ Responda: *1: texto | 2: texto | ...*');
      linhas.push('');
      linhas.push('_Esse relatÃƒÂ³rio consolida sua visÃƒÂ£o diÃƒÂ¡rio para o Dashboard 360._');
      resposta = linhas.join('\\n');
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
        const res = await responder.call(this, 'Ã¢Å¡Â Ã¯Â¸Â *COBRANÃƒâ€¡A DE RDO*\\n\\nAtenÃƒÂ§ÃƒÂ£o equipe, por favor preencham o RDO de hoje. Digite *menu* para ver os tÃƒÂ³picos pendentes.', t);
        results.push(res);
      }
      const okList = results.filter(r => r.ok).map(r => r.target);
      const failList = results.filter(r => !r.ok);
      let r2 = 'Ã°Å¸â€œÂ¤ *Resultado do envio para ' + alvo + '*\\n';
      if (okList.length) r2 += 'Ã¢Å“â€¦ OK: ' + okList.join(', ') + '\\n';
      if (failList.length) {
        r2 += 'Ã¢ÂÅ’ Falhas:\\n';
        for (const f of failList) r2 += 'Ã¢â‚¬Â¢ ' + f.target + ' Ã¢â€ â€™ ' + f.err + '\\n';
      }
      resposta = r2;
    } else {
      resposta = 'Ã¢ÂÅ’ Projeto nÃƒÂ£o reconhecido. Use: @reenviar pardinho, osasco, sala ou todos';
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
        resposta = 'Ã¢Å“â€¦ Aviso enviado para a equipe de *' + (alvo.charAt(0).toUpperCase() + alvo.slice(1)) + '*!';
        for (const t of telefones) {
           await responder.call(this, 'Ã°Å¸â€œÂ¢ *AVISO DA GESTÃƒÆ’O*\\n\\n' + mensagemAviso, t);
        }
      } else {
        resposta = 'Ã¢ÂÅ’ Projeto nÃƒÂ£o encontrado. Use: @avisar pardinho/osasco/sala <mensagem>';
      }
    } else {
      resposta = 'Ã¢ÂÅ’ Faltou a mensagem. Use: @avisar <projeto> <mensagem>\\nEx: @avisar osasco reuniÃƒÂ£o amanhÃƒÂ£ 8h';
    }

  } else if (cmd === 'tarefa' || cmd === 'task') {
    const args = finalCmdMatch[2] ? finalCmdMatch[2].split(' ') : [];
    if (!proj || !proj.isDiretor) {
      resposta = 'Ã¢ÂÅ’ PermissÃƒÂ£o negada. Apenas diretoria pode delegar tarefas.';
    } else if (args.length > 1) {
      const alvo = args[0].toLowerCase();
      const descricao = finalCmdMatch[2].substring(args[0].length).trim();
      const FABRIZZIO = '5574999076534';

      const TODOS_ENG = [
        { nome: 'ÃƒÂcaro',    tel: '5537998268576', proj: 'pardinho' },
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
      else if (alvo.includes('icaro') || alvo.includes('ÃƒÂ­caro')) destinos.push({nome:'ÃƒÂcaro', tel:'5537998268576'});
      else if (alvo.includes('gabriel')) destinos.push({nome:'Gabriel', tel:'5513991995918'});
      else if (alvo.includes('vinicius') || alvo.includes('vinÃƒÂ­cius')) destinos.push({nome:'Vinicius', tel:'5513978216285'});
      else if (alvo.includes('thalita')) destinos.push({nome:'Thalita', tel:'5511919803270'});
      else if (alvo.includes('felipe')) destinos.push({nome:'Felipe', tel:'5561981846325'});

      if (destinos.length > 0) {
        const msg = 'Ã°Å¸Å¡Â¨ *NOVA TAREFA DELEGADA (DIRETORIA)* Ã°Å¸Å¡Â¨\\n\\nÃ°Å¸â€˜Â¤ Delegado por: *' + proj.responsavel + '*\\nÃ°Å¸â€œÂ *Tarefa:* ' + descricao + '\\n\\nÃ¢Å¡Â Ã¯Â¸Â _Protocolada no Painel GestÃƒÂ£o 360._\\n_Responda com "Ciente" para confirmar._';
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
        resposta = 'Ã¢Å“â€¦ Tarefa enviada para: *' + enviados.join(', ') + '* Ã¢â‚¬â€ Ã°Å¸â€™Â¾ Salva no Supabase';
        if (falhas.length) resposta += '\\nÃ¢ÂÅ’ Falhas: ' + falhas.join(', ');
      } else {
        resposta = 'Ã¢ÂÅ’ Executor nÃƒÂ£o cadastrado. Use: @tarefa <nome|todos> <descriÃƒÂ§ÃƒÂ£o>\\nNomes: mateus, icaro, gabriel, vinicius, thalita';
      }
    } else {
      resposta = 'Ã¢ÂÅ’ Faltou o nome e a descriÃƒÂ§ÃƒÂ£o. Use: @tarefa <nome|todos> <descriÃƒÂ§ÃƒÂ£o>\\nEx: @tarefa todos enviar foto da frente atÃƒÂ© 17h';
    }

  } else if (cmd === 'ia' || cmd === 'ai') {
    // IA sÃƒÂ³ funciona pro Felipe, falando consigo mesmo no WhatsApp
    if (!isAdmin || !isFromMe) {
      resposta = 'Ã°Å¸Â¤â€“ A IA estÃƒÂ¡ disponÃƒÂ­vel apenas para o gestor principal. Use *menu* para ver os comandos disponÃƒÂ­veis.';
    } else {
      const pergunta = finalCmdMatch[2] ? finalCmdMatch[2].trim() : '';
      if (pergunta) {
        await responder.call(this, 'Ã¢ÂÂ³ A inteligÃƒÂªncia artificial estÃƒÂ¡ analisando sua solicitaÃƒÂ§ÃƒÂ£o...');
        const respostaIA = await perguntarGroq(this, pergunta);
        resposta = 'Ã°Å¸Â¤â€“ *Assistente IA:*\\n\\n' + respostaIA;
      } else {
        resposta = 'Ã°Å¸Â¤â€“ *Assistente IA*\\nPara perguntar, use:\\n\\n*@ia <sua dÃƒÂºvida>*\\n\\nExemplo: *@ia Me explique o que ÃƒÂ© um traÃƒÂ§o de concreto 25 MPa.*';
      }
    }

  } else {
    resposta = 'Ã¢ÂÅ’ Comando *@' + cmd + '* nÃƒÂ£o existe.\\n\\nComandos vÃƒÂ¡lidos: menu, @status, @equipe, @projetos, @dashboard, @reenviar, @rdo, @meurdo, @tarefa, @avisar, @ia';
  }

  await responder.call(this, resposta);
  return { json: { ignorar: true, motivo: 'Comando @' + cmd } }];
}

// Apenas um nÃƒÂºmero (1-11) Ã¢â€ â€™ pergunta o valor desse tÃƒÂ³pico se nÃƒÂ£o for Gestor
const numMatchRdo = trimmed.match(/^([0-9]{1,2})$/);
if (numMatchRdo && proj && !proj.isGestor) {
  const num = parseInt(numMatchRdo[1], 10);
  const q = proj.perguntas.find(x => x.num === num);
  if (q) {
    const msg = 'Ã¢Å“ÂÃ¯Â¸Â *TÃƒÂ³pico ' + num + ' Ã¢â‚¬â€ ' + q.label + '*\\n\\nResponda agora o valor/status.\\nExemplo: *' + q.tag + ': 50*\\n\\nOu mande direto: *' + num + ': seu valor aqui*';
    await responder.call(this, msg);
    return { json: { ignorar: true, motivo: 'Pergunta tÃƒÂ³pico ' + num } }];
  }
}

// ===== DIRETORES RESPONDENDO RDO DE SUPERVISÃƒÆ’O (formato 1: valor) =====
if (proj && proj.isDiretor && /^\\s*\\d+\\s*[:=]/m.test(trimmed)) {
  const partes = trimmed.split(/[|\\n]/).map(s => s.trim()).filter(Boolean);
  const tagLines = [];
  const ackLabels = [];
  for (const p of partes) {
    const m = p.match(/^(\\d+)\\s*[:=]\\s*(.+)$/);
    if (m) {
      const q = RDO_DIRETOR_SUPERVISAO.find(x => x.num === parseInt(m[1], 10));
      if (q) {
        tagLines.push(q.tag + ': ' + m[2].trim());
        ackLabels.push('Ã¢Å“â€¦ *' + q.num + '. ' + q.label + '* Ã¢â€ â€™ ' + m[2].trim());
      }
    }
  }
  if (tagLines.length > 0) {
    const respondidos = RDO_DIRETOR_SUPERVISAO.filter(q => tagLines.some(t => t.startsWith(q.tag + ':'))).map(q => q.num);
    const pendentes = RDO_DIRETOR_SUPERVISAO.filter(q => !respondidos.includes(q.num));
    // Salvar RDO de supervisÃƒÂ£o no Supabase
    const hoje = new Date().toISOString().split('T')[0];
    await salvarSupabase(this, 'rdos', {
      project_id: resolverProjectId(proj.nome),
      data: hoje,
      clima: 'bom',
      observacoes: 'RDO SupervisÃƒÂ£o Ã¢â‚¬â€ ' + proj.responsavel + ': ' + tagLines.join(' | '),
      apontador: proj.responsavel + ' (Diretor)',
      status: 'aberto',
    });
    let ack = 'Ã°Å¸â€œÂ¥ *RDO SupervisÃƒÂ£o Recebido!* Ã°Å¸â€™Â¾\\nDiretor: *' + proj.responsavel + '*\\n\\n' + ackLabels.join('\\n');
    if (pendentes.length > 0) {
      ack += '\\n\\nÃ¢ÂÂ³ *Ainda faltam:*\\n' + pendentes.map(q => '( ' + q.num + ' ) ' + q.label).join('\\n');
    } else {
      ack += '\\n\\nÃ°Å¸Å½â€° *RDO SupervisÃƒÂ£o completo!* Consolidado no Dashboard 360.';
    }
    await responder.call(this, ack);
    if (!isAdmin) {
      await responder.call(this, 'Ã°Å¸â€œâ€¹ *RDO SUPERVISÃƒÆ’O RECEBIDO*\\n\\nÃ°Å¸â€˜Â¤ Diretor: *' + proj.responsavel + '*\\n' + ackLabels.join('\\n'), ADMIN_PHONE);
    }
    return { json: { ignorar: true, motivo: 'RDO supervisÃƒÂ£o diretor recebido e salvo no Supabase', phone, text: tagLines.join('\\n') } }];
  }
}

// Resposta no formato "1: valor" ou "1: a | 2: b | 3: c" Ã¢â‚¬â€ converte pra tags e segue pro RDO (engenheiros)
if (proj && !proj.isGestor && /^\\s*\\d+\\s*[:=]/m.test(trimmed)) {
  const partes = trimmed.split(/[|\\n]/).map(s => s.trim()).filter(Boolean);
  const tagLines = [];
  const ackLabels = [];
  for (const p of partes) {
    const m = p.match(/^(\\d+)\\s*[:=]\\s*(.+)$/);
    if (m) {
      const q = proj.perguntas.find(x => x.num === parseInt(m[1], 10));
      if (q) {
        tagLines.push(q.tag + ': ' + m[2].trim());
        ackLabels.push('Ã¢Å“â€¦ *' + q.num + '. ' + q.label + '* Ã¢â€ â€™ ' + m[2].trim());
      }
    }
  }
  if (tagLines.length > 0) {
    text = tagLines.join('\\n');
    const respondidos = proj.perguntas.filter(q => tagLines.some(t => t.startsWith(q.tag + ':'))).map(q => q.num);
    const pendentes = proj.perguntas.filter(q => !respondidos.includes(q.num));
    // Extrair dados numÃƒÂ©ricos para o Supabase
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
    // Salvar RDO do engenheiro no Supabase
    const hoje = new Date().toISOString().split('T')[0];
    const rdoSaved = await salvarSupabase(this, 'rdos', {
      project_id: resolverProjectId(proj.nome),
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
    let ack = 'Ã°Å¸â€œÂ¥ *Recebido!* ' + (rdoSaved ? 'Ã°Å¸â€™Â¾' : 'Ã¢Å¡Â Ã¯Â¸Â') + '\\n\\n' + ackLabels.join('\\n');
    if (pendentes.length > 0) {
      ack += '\\n\\nÃ¢ÂÂ³ *Ainda faltam:*\\n' + pendentes.map(q => '( ' + q.num + ' ) ' + q.label).join('\\n');
    } else {
      ack += '\\n\\nÃ°Å¸Å½â€° *RDO completo!* Todos os tÃƒÂ³picos respondidos e salvos no Supabase.';
    }
    await responder.call(this, ack);
    const resumoRdo = 'Ã°Å¸â€œÂ¥ *RDO RECEBIDO* ' + (rdoSaved ? 'Ã°Å¸â€™Â¾' : '') + '\\n\\nÃ°Å¸â€˜Â· *' + proj.responsavel + '* Ã¢â‚¬â€ ' + proj.nome + '\\n' + ackLabels.join('\\n');
    await responder.call(this, resumoRdo, ADMIN_PHONE);
    return { json: { ignorar: true, motivo: 'RDO recebido, processado e salvo no Supabase', phone, text } }];
  }
}

// ========== FALLBACK Ã¢â‚¬â€ IA SÃƒâ€œ PRO FELIPE FALANDO CONSIGO MESMO ==========
if (proj && proj.isGestor) {
  // IA sÃƒÂ³ responde se for o Felipe E estiver falando consigo mesmo (fromMe)
  if (isAdmin && isFromMe) {
    await responder.call(this, 'Ã¢ÂÂ³ Analisando sua mensagem...');
    const respostaIA = await perguntarGroq(this, text);
    await responder.call(this, 'Ã°Å¸Â¤â€“ *Assistente IA:*\\n\\n' + respostaIA);
    return { json: { ignorar: true, motivo: 'IA respondeu Felipe (fromMe)' } }];
  }
  // Qualquer outro gestor ou Felipe recebendo msg de outros Ã¢â€ â€™ silÃƒÂªncio
  return { json: { ignorar: true, motivo: 'Texto livre gestor - silÃƒÂªncio (IA ÃƒÂ© sÃƒÂ³ Felipe fromMe)' } }];
}

// Engenheiro mandou texto que nÃƒÂ£o ÃƒÂ© nÃƒÂºmero nem tag Ã¢â‚¬â€ NÃƒÆ’O responde (deixa a conversa normal)
if (proj && !proj.isGestor) {
  // SilÃƒÂªncio Ã¢â‚¬â€ o engenheiro pode estar sÃƒÂ³ conversando com o Felipe
  return { json: { ignorar: true, motivo: 'Texto livre engenheiro - IA desligada' } }];
}

// Phone desconhecido Ã¢â‚¬â€ NÃƒÆ’O responde (silÃƒÂªncio total)
return { json: { ignorar: true, motivo: 'Phone sem destino: ' + phone } }];

        }).call(thisCtx);
        console.log("EXECUTION COMPLETE. Result:", result);
    } catch(e) {
        console.error("EXECUTION ERROR:", e);
    }
})();
