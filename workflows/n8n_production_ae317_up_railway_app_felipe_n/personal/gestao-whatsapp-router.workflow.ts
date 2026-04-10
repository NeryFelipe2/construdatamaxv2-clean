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
        responseMode: 'lastNode',
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
// ========== SUPABASE CONFIG ==========
const SUPABASE_URL = 'https://vblfdikfobsirwpdnybw.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibGZkaWtmb2JzaXJ3cGRueWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzAwODIsImV4cCI6MjA4ODk0NjA4Mn0.GOx3HoMh3P2Zzxz8BxNsfQBfXwsNZNQsdVc3nJaqRy4';

// UUIDs FIXOS dos projetos no Supabase (tabela projetos)
const PROJECT_IDS = {
  brasilia: '2a28beec-b1f8-4b0c-8416-d0710bb35d9d',
  osasco:   'f3c6645b-347f-4382-b9c5-d103c27ec511',
  pardinho: 'ec112c9a-1669-4287-8079-526d6940ce82',
  consorcio:'abe7f66c-004b-4bb5-a245-6be67debd9f7',
};

// Fail-safe: retorna null pra projetos não reconhecidos com certeza.
// NUNCA cai em fallback silencioso pra outro projeto — confidencialidade.
function resolverProjectId(nome) {
  if (!nome) return null;
  const n = nome.toLowerCase();
  if (n.indexOf('pardinho') >= 0 || n.indexOf('itapetininga') >= 0) return PROJECT_IDS.pardinho;
  if (n.indexOf('osasco') >= 0 || n.indexOf('clu') >= 0 || n.indexOf('cuiab') >= 0) return PROJECT_IDS.osasco;
  if (n.indexOf('consorcio') >= 0 || n.indexOf('consórcio') >= 0 || n.indexOf('seliga') >= 0 || n.indexOf('slnr') >= 0
      || n.indexOf('sala t') >= 0 || n === 'sala' || n === 'planejamento' || n === 'producao' || n === 'produção'
      || n.indexOf('gabriel') >= 0 || n.indexOf('vinicius') >= 0 || n.indexOf('junior') >= 0
      || n.indexOf('valdean') >= 0 || n.indexOf('veronica') >= 0 || n.indexOf('márcio') >= 0 || n.indexOf('marcio') >= 0
      || n.indexOf('fabrizzio') >= 0 || n.indexOf('fabrizio') >= 0) return PROJECT_IDS.consorcio;
  if (n.indexOf('brasilia') >= 0 || n.indexOf('brasília') >= 0 || n.indexOf('joão') >= 0 || n.indexOf('joao') >= 0) return PROJECT_IDS.brasilia;
  // RK Sub Empreita ainda sem UUID — retorna null (sem vazamento)
  return null;
}

async function salvarSupabaseRdo(ctx, dados) {
  // FAIL-SAFE: exige projeto_id válido
  if (!dados || !dados.projeto_id) return { ok: false, err: 'projeto_id ausente' };
  try {
    const r = await ctx.helpers.httpRequest({
      method: 'POST',
      url: SUPABASE_URL + '/rdos',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: dados,
      json: true,
    });
    return { ok: true, data: r };
  } catch (e) {
    return { ok: false, err: (e && e.message) || String(e) };
  }
}

// Grava lançamentos financeiros derivados do RDO (diesel/alim/mo/mat) para o DRE.
async function salvarLancamentosFinanceiros(ctx, projetoId, apontador, dataIso, custos) {
  // FAIL-SAFE: exige projeto_id
  if (!projetoId) return { ok: false, err: 'projeto_id ausente' };
  const rows = [];
  const lista = [
    ['Mão de Obra', 'DIESEL/COMBUSTÍVEL', custos.diesel],
    ['Mão de Obra', 'ALIMENTAÇÃO/HOTELARIA', custos.alimentacao],
    ['Mão de Obra', 'MÃO DE OBRA', custos.mao_obra],
    ['Materiais', 'MATERIAIS/LOCAÇÕES', custos.materiais],
  ];
  for (const item of lista) {
    if (item[2] > 0) {
      rows.push({
        project_id: projetoId,
        data: dataIso,
        categoria: item[0],
        descricao: item[1] + ' (' + apontador + ')',
        valor: item[2],
        tipo: 'DESPESA',
        criado_por: apontador,
      });
    }
  }
  if (rows.length === 0) return { ok: true, count: 0 };
  try {
    await ctx.helpers.httpRequest({
      method: 'POST',
      url: SUPABASE_URL + '/lancamentos_financeiros',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: rows,
      json: true,
    });
    return { ok: true, count: rows.length };
  } catch (e) {
    return { ok: false, err: (e && e.message) || String(e) };
  }
}

// O corpo do webhook do Evolution vem em $input.first().json.body
const payload = $input.first().json.body || $input.first().json;

// Se não for mensagem, ignora
if (!payload.data || payload.event !== 'messages.upsert') {
  return [{ json: { ignorar: true } }];
}

const msgData = payload.data;
const remoteJid = msgData.key.remoteJid || '';
const phone = remoteJid.replace('@s.whatsapp.net', '');
let text = '';

if (msgData.message) {
  text = msgData.message.conversation || 
         (msgData.message.extendedTextMessage && msgData.message.extendedTextMessage.text) || '';
}

if (!text) {
  return [{ json: { ignorar: true, motivo: 'Sem texto' } }];
}

const trimmed = text.trim();
const lower = trimmed.toLowerCase();

// Ignora mensagens enviadas pelo próprio bot (fromMe), EXCETO se for um comando explícito 
// enviado pelo Gestor (Felipe) para testar o fluxo consigo mesmo ou disparar ações.
if (msgData.key.fromMe) {
  const isComando = /^(@|menu|ajuda|comandos|status|equipe|projetos|dashboard|ia|ai|[1-9sm])/i.test(trimmed);
  if (!isComando) {
    return [{ json: { ignorar: true, motivo: 'Enviada por mim (não é comando)' } }];
  }
}

// Identifica projeto e perguntas pelo telefone
function projetoDoPhone(p) {
  if (p.includes('999996252')) return {
    nome: 'ConstruData Brasília', responsavel: 'João', isGestor: true, isDiretor: true,
    escopo: ['brasilia'],
    perguntas: [
      { num: 1, label: 'Frentes ativas hoje', tag: 'frentes' },
      { num: 2, label: 'Efetivo total em obra', tag: 'efetivo' },
      { num: 3, label: 'Metros executados (rede)', tag: 'metros_rede' },
      { num: 4, label: 'Ligações executadas', tag: 'ligacoes' },
      { num: 5, label: 'Pendências / impedimentos', tag: 'pendencias' },
      { num: 6, label: 'Clima / interferência climática', tag: 'clima' },
    ]
  };
  if (p.includes('991015639')) return {
    nome: 'Osasco - Rua Cuiabá', responsavel: 'Mateus',
    perguntas: [
      { num: 1, label: 'Frente Capex em execução', tag: 'frente_capex' },
      { num: 2, label: 'Efetivo na obra', tag: 'efetivo' },
      { num: 3, label: 'Metros de rede executados', tag: 'metros_rede' },
      { num: 4, label: 'Ligações prediais executadas', tag: 'ligacoes' },
      { num: 5, label: 'Interferências encontradas', tag: 'interferencias' },
      { num: 6, label: 'Pendências para amanhã', tag: 'pendencias' },
    ]
  };
  if (p.includes('991995918') || p.includes('978216285')) return {
    nome: 'Sala Técnica SLNR Santos', responsavel: p.includes('991995918') ? 'Gabriel' : 'Vinicius',
    perguntas: [
      { num: 1, label: 'Espacialização Survey (prazo 10/04)', tag: 'survey_pendencias' },
      { num: 2, label: 'Check com Thalita sobre Survey', tag: 'status_thalita' },
      { num: 3, label: 'EAP Trechos (medidas/comprimento)', tag: 'status_redes' },
      { num: 4, label: 'Déficit cadastro fev/mar + topografia', tag: 'status_deficit' },
      { num: 5, label: 'Extensão de ramais (Sabesp 16/04 e 02/05)', tag: 'ramais_pendentes' },
    ]
  };
  if (p.includes('81846325')) return {
    nome: 'Gestão Geral (Felipe Nery)', responsavel: 'Felipe Nery', isGestor: true, isDiretor: true,
    escopo: ['todos'],
    perguntas: []
  };
  if (p.includes('999076534')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'Fabrizzio', isGestor: true, isDiretor: true,
    escopo: ['consorcio'],
    perguntas: []
  };
  if (p.includes('999425397')) return {
    nome: 'Diretoria Pardinho/Osasco/RK', responsavel: 'Luiz Fernando', isGestor: true, isDiretor: true,
    escopo: ['pardinho','osasco','rk'],
    perguntas: []
  };
  if (p.includes('999154319')) return {
    nome: 'Diretoria Osasco/RK', responsavel: 'Renato', isGestor: true, isDiretor: true,
    escopo: ['osasco','rk'],
    perguntas: []
  };
  if (p.includes('999220853')) return {
    nome: 'Pardinho/Osasco', responsavel: 'Buruca', isGestor: true,
    perguntas: []
  };
  if (p.includes('919803270')) return {
    nome: 'Sala Técnica SLNR Santos', responsavel: 'Thalita', isGestor: true,
    perguntas: []
  };
  if (p.includes('998268576')) return {
    nome: 'Pardinho - Itapetininga', responsavel: 'Ícaro',
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

// ========== MENU INTERATIVO ==========
// Detecta saudação, ajuda, ou comando @
const isSaudacao = /^(oi|ola|olá|bom dia|boa tarde|boa noite|opa|menu|opções|opcoes|inicio|início|começar|comecar|start)$/i.test(trimmed);
const isAjuda = /^(@?(ajuda|help|comandos|menu))$/i.test(trimmed);
const cmdMatch = trimmed.match(/^@(\\w+)(?:\\s+([\\s\\S]*))?$/i);

function montarMenu(p, phoneDetectado) {
  if (!p) return '🤖 ConstruDataMax\\n\\nNão consegui identificar seu projeto. Telefone detectado: *' + phoneDetectado + '*\\nFala com o admin para te cadastrar.';

  // Menu de gestor (Felipe, Fabrizzio, Luiz, Renato, Buruca, Thalita)
  if (p.isGestor) {
    return [
      '🤖 *ConstruDataMax Gestão 360*',
      'Olá *' + p.responsavel + '*!',
      '',
      '📊 *Opções de Comando:*',
      '1️⃣ *Status RDO Hoje*',
      '2️⃣ *Equipe e Contatos*',
      '3️⃣ *Projetos Ativos*',
      '4️⃣ *Dashboard Consolidado*',
      '5️⃣ *Reenviar Cobrança* (Alerta Geral)',
      '6️⃣ *Falar com Inteligência Artificial*',
      '7️⃣ *Cobrar RDO* (Dispara formulário)',
      '8️⃣ *Meu RDO Diretor* (Supervisão)',
      '9️⃣ *Lembrar Tarefas* (Cobra diretores)',
      '🔟 *Criar Tarefas* (Guia de Uso)',
      '1️⃣1️⃣ *Plano de Custos* (Financeiro)',
      '1️⃣2️⃣ *Tarefas Consórcio* (Delega por setor)',
      '1️⃣3️⃣ *Enviar Tarefa por Pessoa*',
      '1️⃣4️⃣ *Enviar Tarefa à Diretoria*',
      '1️⃣5️⃣ *Enviar Tarefa aos Engenheiros*',
      '1️⃣6️⃣ *Enviar Tarefa por Setor*',
      '',
      '_▶️ Digite o número da opção (ex: 1) ou use os @comandos diretamente._',
      '🔗 https://construdatamaxv2-clean.vercel.app'
    ].join('\\n');
  }

  const linhas = [
    '🤖 *ConstruDataMax — Operação*',
    'Olá *' + p.responsavel + '*! Projeto: *' + p.nome + '*',
    '',
    '📝 *Para responder o RDO de hoje:*',
    ''
  ];
  for (const q of p.perguntas) {
    linhas.push('*( ' + q.num + ' )* — ' + q.label);
  }
  linhas.push('');
  linhas.push('💬 *Como preencher:*');
  linhas.push('• Digite *só o número* (ex: *1*) e o bot vai perguntar o valor');
  linhas.push('• Responda direto: *1: 50* (tópico 1 = 50)');
  linhas.push('');
  linhas.push('🆘 *Outras Opções:*');
  linhas.push('*( M )* — Menu e Ajuda');
  linhas.push('*( S )* — Status do RDO');
  return linhas.join('\\n');
}

async function responder(msg, targetPhone = phone) {
  try {
    await this.helpers.httpRequest({
      method: 'POST',
      url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
      headers: { apikey: 'construdata2026', 'Content-Type': 'application/json' },
      body: { number: targetPhone, textMessage: { text: msg } },
      json: true,
    });
    return { ok: true, target: targetPhone };
  } catch (e) {
    return { ok: false, target: targetPhone, err: (e && e.message) || String(e) };
  }
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
        model: 'llama3-8b-8192',
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

// Saudação ou pedido de ajuda → manda menu (SO se for telefone cadastrado)
if (isSaudacao || isAjuda) {
  if (!proj) {
    // Desconhecido mandou "oi"/"menu" → silencia, nao e conversa do bot
    return [{ json: { ignorar: true, motivo: 'Saudacao de telefone nao cadastrado - silencio: ' + phone } }];
  }
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
    else if (s === '6') finalCmdMatch = [null, 'iaoff', ''];
    else if (s === '7') finalCmdMatch = [null, 'guiardo', ''];
    else if (s === '8') finalCmdMatch = [null, 'meurdo', ''];
    else if (s === '9') finalCmdMatch = [null, 'guialembrar', ''];
    else if (s === '10') finalCmdMatch = [null, 'guiatarefa', ''];
    else if (s === '11') finalCmdMatch = [null, 'planocustos', ''];
    else if (s === '12') finalCmdMatch = [null, 'guiatarefasetor', ''];
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
    const alvo = cmdMatch[2] ? cmdMatch[2].toLowerCase() : 'todos';
    const hojeStr = new Date().toLocaleDateString('pt-BR');
    let texto = '📊 *Status RDO de Hoje* — ' + hojeStr + '\\n\\n';
    
    if (alvo === 'todos' || alvo.includes('pardinho')) {
      texto += '📌 *Pardinho* (Ícaro)\\n❌ Pendente: Falta reportar frente Ligações e Emissário\\n\\n';
    }
    if (alvo === 'todos' || alvo.includes('osasco')) {
      texto += '📌 *Osasco* (Mateus)\\n✅ Entregue: 100% preenchido\\n\\n';
    }
    if (alvo === 'todos' || alvo.includes('santos')) {
      texto += '📌 *ConstruData Santos* (João)\\n✅ Entregue: Sem interferências\\n\\n';
    }
    if (alvo === 'todos' || alvo.includes('sala')) {
      texto += '📌 *Sala Técnica SLNR* (Gabriel/Vinicius)\\n❌ Pendente: Espacialização Survey atrasada\\n\\n';
    }
    texto += '_Para cobrar, digite @reenviar <projeto>_';
    resposta = texto;

  } else if (cmd === 'equipe') {
    resposta = '👥 *Contatos da Equipe*\\n' +
      '• Felipe: GESTOR\\n' +
      '• João (ConstruData Santos): 11999996252\\n' +
      '• Mateus (Osasco): 61991015639\\n' +
      '• Gabriel/Vinicius (Sala Técnica SLNR): 13991995918 / 13978216285\\n' +
      '• Ícaro (Pardinho): 37998268576\\n' +
      '• Thalita (Sala Técnica Sala): 11919803270\\n' +
      '• Renato / Buruca / LF (Diretoria)\\n' +
      '\\n_Use @avisar <projeto> <mensagem> para contatar_';
      
  } else if (cmd === 'projetos') {
    resposta = '🏗️ *Projetos Ativos*\\n' +
      '1. ConstruData Santos (Rumo)\\n' +
      '2. Osasco - Rua Cuiabá (Capex)\\n' +
      '3. Sala Técnica SLNR Santos\\n' +
      '4. Pardinho - Itapetininga\\n' +
      '\\n_Acompanhe em https://construdatamaxv2-clean.vercel.app_';

  } else if (cmd === 'dashboard') {
    resposta = '📈 *Dashboard Consolidado*\\n' +
      'O dashboard consolidado de RDO já está atualizado e disponível.\\n\\n' +
      'Acesse no portal:\\nhttps://construdatamaxv2-clean.vercel.app/dashboard/consolidado';

  } else if (cmd === 'reenviar') {
    const alvo = cmdMatch[2] ? cmdMatch[2].toLowerCase() : '';
    let telefones = [];
    if (alvo.includes('pardinho')) telefones.push('5537998268576');
    else if (alvo.includes('osasco')) telefones.push('5561991015639');
    else if (alvo.includes('santos')) telefones.push('5561999996252');
    else if (alvo.includes('sala')) telefones.push('5513991995918', '5513978216285');

    if (telefones.length > 0) {
      resposta = '✅ Cobrança reenviada para a equipe de *' + (alvo.charAt(0).toUpperCase() + alvo.slice(1)) + '*!';
      for (const t of telefones) {
        await responder.call(this, '⚠️ *COBRANÇA DE RDO*\\n\\nAtenção equipe, por favor preencham o RDO de hoje. Digite *menu* para ver os tópicos pendentes.', t);
      }
    } else {
      resposta = '❌ Projeto não encontrado para reenviar cobrança. Tente @reenviar pardinho, osasco, santos ou sala.';
    }

  } else if (cmd === 'avisar') {
    const args = cmdMatch[2] ? cmdMatch[2].split(' ') : [];
    if (args.length > 1) {
      const alvo = args[0].toLowerCase();
      const mensagemAviso = cmdMatch[2].substring(alvo.length).trim();
      let telefones = [];
      if (alvo.includes('pardinho')) telefones.push('5537998268576');
      else if (alvo.includes('osasco')) telefones.push('5561991015639');
      else if (alvo.includes('santos')) telefones.push('5561999996252');
      else if (alvo.includes('sala')) telefones.push('5513991995918', '5513978216285');

      if (telefones.length > 0) {
        resposta = '✅ Aviso enviado para a equipe de *' + (alvo.charAt(0).toUpperCase() + alvo.slice(1)) + '*!';
        for (const t of telefones) {
           await responder.call(this, '📢 *AVISO DA GESTÃO*\\n\\n' + mensagemAviso, t);
        }
      } else {
        resposta = '❌ Projeto não encontrado. Tente @avisar pardinho <mensagem>.';
      }
    } else {
      resposta = '❌ Formato incorreto. Use: @avisar <projeto> <mensagem>';
    }

  } else if (cmd === 'tarefa' || cmd === 'task') {
    if (!proj || !proj.isGestor) {
      resposta = '❌ Permissão negada. Apenas diretores e gerentes podem delegar tarefas.';
    } else {
      // tira caracteres de colagem (colchetes angulares e aspas)
      let rawArg = (finalCmdMatch[2] || '').trim();
      rawArg = rawArg.split('<').join('').split('>').join('').split('"').join('').trim();
      const args = rawArg.split(' ').filter(Boolean);
      if (args.length < 2) {
        resposta = '❌ Use: *@tarefa <nome> <descrição>*\\n\\nNomes aceitos:\\n• *Diretoria:* renato, luiz (lf), fabrizzio, felipe\\n• *Engenheiros:* icaro, mateus, alexandre, igor\\n• *Sala Técnica:* gabriel, vinicius, thalita\\n• *Planejamento:* junior, valdean, veronica\\n• *Produção:* jose marcio (ou josemarcio)\\n\\nEx: *@tarefa icaro enviar foto até 17h*';
      } else {
        // Detecta nome: 1 ou 2 palavras iniciais (ex: "luiz fernando", "jose marcio")
        const lowerFull = rawArg.toLowerCase();
        const ALVOS = [
          {tel:'5528999154319', nome:'Renato',         keys:['renato']},
          {tel:'5537999425397', nome:'Luiz Fernando',  keys:['luiz fernando','luiz','lf','fernando']},
          {tel:'5574999076534', nome:'Fabrizzio',      keys:['fabrizzio','fabrizio','fabri']},
          {tel:'5561981846325', nome:'Felipe',         keys:['felipe nery','felipe','nery']},
          {tel:'5537998268576', nome:'Ícaro',          keys:['icaro','ícaro']},
          {tel:'5561991015639', nome:'Mateus',         keys:['mateus santos','mateus','matheus']},
          {tel:'5531998894664', nome:'Alexandre/Igor', keys:['alexandre','igor','rk']},
          {tel:'5513991995918', nome:'Gabriel',        keys:['gabriel']},
          {tel:'5513978216285', nome:'Vinicius',       keys:['vinicius','vinícius']},
          {tel:'5511919803270', nome:'Thalita',        keys:['thalita']},
          {tel:'5511986012223', nome:'Junior',         keys:['junior','júnior']},
          {tel:'5599991392763',  nome:'Valdean',        keys:['valdean','valdeans']},
          {tel:'5513997733121', nome:'Veronica',       keys:['veronica','verônica']},
          {tel:'5511941816005', nome:'José Márcio',    keys:['jose marcio','josé márcio','josemarcio','marcio','márcio']},
          {tel:'5561999996252', nome:'João',           keys:['joao','joão']},
        ];
        let match = null;
        let consumidos = 0;
        for (const a of ALVOS) {
          for (const k of a.keys) {
            if (lowerFull === k || lowerFull.indexOf(k + ' ') === 0) {
              match = a;
              consumidos = k.length;
              break;
            }
          }
          if (match) break;
        }
        if (!match) {
          resposta = '❌ Executor *' + args[0] + '* não reconhecido.\\nUse: renato, luiz, fabrizzio, felipe, icaro, mateus, alexandre, gabriel, vinicius, junior, valdean, veronica, jose marcio, thalita, joao';
        } else {
          const descricao = rawArg.substring(consumidos).trim();
          if (!descricao) {
            resposta = '❌ Faltou a descrição. Ex: *@tarefa ' + match.nome.toLowerCase() + ' revisar projeto até sexta*';
          } else {
            const msg = '🚨 *NOVA TAREFA DELEGADA*\\n👤 Delegado por: *' + proj.responsavel + '*\\n📝 *Tarefa:* ' + descricao + '\\n\\n_Responda "Ciente" para confirmar._';
            const r = await responder.call(this, msg, match.tel);
            if (r.ok) {
              resposta = '✅ Tarefa enviada para *' + match.nome + '*';
            } else {
              resposta = '❌ Falha ao enviar para ' + match.nome + ': ' + r.err;
            }
          }
        }
      }
    }

  } else if (cmd === 'ia' || cmd === 'ai' || cmd === 'iaoff') {
    resposta = '🤖 A IA está desligada no momento.';

  } else if (cmd === 'guiardo') {
    resposta = '📋 *COBRAR RDO*\\n\\nUse: *@rdo <projeto>*\\n\\n⚠️ *Sem envio em massa* — confidencialidade entre projetos.\\n\\nProjetos:\\n• *pardinho* → Ícaro\\n• *osasco* → Mateus\\n• *rk* → Alexandre/Igor\\n• *sala* → Gabriel/Vinicius\\n• *planejamento* → Junior/Valdean/Veronica\\n• *producao* → José Márcio\\n\\nEx: *@rdo pardinho*';

  } else if (cmd === 'rdo') {
    if (!proj || !proj.isDiretor) {
      resposta = '❌ Apenas diretores podem disparar RDO.';
    } else if (!finalCmdMatch[2] || !finalCmdMatch[2].trim()) {
      resposta = '❌ Use: *@rdo <projeto>*\\n\\n⚠️ *Sem envio em massa* — confidencialidade entre projetos.\\n\\nProjetos: pardinho, osasco, rk, sala, planejamento, producao\\nEx: *@rdo pardinho*';
    } else {
      const alvo = finalCmdMatch[2].toLowerCase().trim();
      const hojeStr = new Date().toLocaleDateString('pt-BR');
      const escopoDir = proj.escopo || [];
      const temEscopo = (pr) => escopoDir.indexOf('todos') >= 0 || escopoDir.indexOf(pr) >= 0;
      if (alvo === 'todos' || alvo === 'consorcio' || alvo === 'consórcio') {
        resposta = '🚨 *Envio em massa bloqueado*\\n\\nPor confidencialidade entre projetos, *@rdo* exige projeto único.\\n\\nProjetos válidos: pardinho, osasco, rk, sala, planejamento, producao\\nEx: *@rdo pardinho*';
      } else if (alvo === 'pardinho') {
        if (!temEscopo('pardinho')) { resposta = '❌ Seu escopo não inclui Pardinho.'; }
        else {
          const msg = '📋 *RDO DIÁRIO — Pardinho*\\n📅 ' + hojeStr + '\\nÍcaro, responda (ex: 1: valor | 2: valor)\\n\\n*OPERACIONAL*\\n(1) Frente Rede Principal\\n(2) Frente Ligações Prediais\\n(3) Frente ETE / Emissário\\n(4) Efetivo total\\n(5) Metros de rede\\n(6) Ligações executadas\\n(7) Equipamentos\\n(8) Materiais\\n(9) Clima\\n(10) Pendências\\n(11) Ocorrências/Acidentes\\n(12) Observações gerais\\n\\n*CUSTO DO DIA (R$)*\\n(13) Diesel/Combustível\\n(14) Alimentação/Hotelaria\\n(15) Mão de Obra\\n(16) Materiais/Locações';
          const r = await responder.call(this, msg, '5537998268576');
          resposta = r.ok ? '✅ RDO Pardinho enviado para Ícaro (com custos)' : ('❌ Falha: ' + r.err);
        }
      } else if (alvo === 'osasco') {
        if (!temEscopo('osasco')) { resposta = '❌ Seu escopo não inclui Osasco.'; }
        else {
          const msg = '📋 *RDO DIÁRIO — Osasco*\\n📅 ' + hojeStr + '\\nMateus, responda (ex: 1: valor | 2: valor)\\n\\n*OPERACIONAL*\\n(1) Frente Capex\\n(2) Efetivo\\n(3) Metros de rede\\n(4) Ligações\\n(5) Interferências\\n(6) Pendências\\n(7) Ocorrências/Acidentes\\n(8) Observações gerais\\n\\n*CUSTO DO DIA (R$)*\\n(9) Diesel/Combustível\\n(10) Alimentação/Hotelaria\\n(11) Mão de Obra\\n(12) Materiais/Locações';
          const r = await responder.call(this, msg, '5561991015639');
          resposta = r.ok ? '✅ RDO Osasco enviado para Mateus (com custos)' : ('❌ Falha: ' + r.err);
        }
      } else if (alvo === 'rk') {
        if (!temEscopo('rk')) { resposta = '❌ Seu escopo não inclui RK.'; }
        else {
          const msg = '📋 *RDO DIÁRIO — RK Sub Empreita*\\n📅 ' + hojeStr + '\\nAlexandre/Igor, responda (ex: 1: valor | 2: valor)\\n\\n*OPERACIONAL*\\n(1) Frentes em andamento\\n(2) Metros executados\\n(3) Equipe no local\\n(4) Impedimentos\\n(5) Ocorrências/Acidentes\\n(6) Observações gerais\\n\\n*CUSTO DO DIA (R$)*\\n(7) Diesel/Combustível\\n(8) Alimentação/Hotelaria\\n(9) Mão de Obra\\n(10) Materiais/Locações';
          const r = await responder.call(this, msg, '5531998894664');
          resposta = r.ok ? '✅ RDO RK enviado para Alexandre/Igor' : ('❌ Falha: ' + r.err);
        }
      } else if (alvo === 'sala') {
        if (!temEscopo('consorcio')) { resposta = '❌ Seu escopo não inclui Consórcio.'; }
        else {
          const msg = '📋 *ATIVIDADES — Sala Técnica*\\n📅 ' + hojeStr + '\\nResponda (ex: 1: texto | 2: texto)\\n\\n(1) Atividades realizadas hoje\\n(2) Pendências\\n(3) Próximos passos';
          const r1 = await responder.call(this, msg, '5513991995918');
          const r2 = await responder.call(this, msg, '5513978216285');
          const ok = [];
          if (r1.ok) ok.push('Gabriel');
          if (r2.ok) ok.push('Vinicius');
          resposta = ok.length > 0 ? ('✅ RDO Sala Técnica enviado para ' + ok.join(', ')) : '❌ Falha ao enviar';
          if (phone.indexOf('999076534') < 0 && ok.length > 0) {
            await responder.call(this, 'ℹ️ *RDO Sala Técnica disparado por ' + proj.responsavel + '*', '5574999076534');
          }
        }
      } else if (alvo === 'planejamento' || alvo === 'plan') {
        if (!temEscopo('consorcio')) { resposta = '❌ Seu escopo não inclui Consórcio.'; }
        else {
          const msg = '📋 *ATIVIDADES — Planejamento*\\n📅 ' + hojeStr + '\\nResponda (ex: 1: texto | 2: texto)\\n\\n(1) Atividades de planejamento\\n(2) Cronograma\\n(3) Pendências';
          const r1 = await responder.call(this, msg, '5511986012223');
          const r2 = await responder.call(this, msg, '5599991392763');
          const r3 = await responder.call(this, msg, '5513997733121');
          const ok = [];
          if (r1.ok) ok.push('Junior');
          if (r2.ok) ok.push('Valdean');
          if (r3.ok) ok.push('Veronica');
          resposta = ok.length > 0 ? ('✅ RDO Planejamento enviado para ' + ok.join(', ')) : '❌ Falha ao enviar';
          if (phone.indexOf('999076534') < 0 && ok.length > 0) {
            await responder.call(this, 'ℹ️ *RDO Planejamento disparado por ' + proj.responsavel + '*', '5574999076534');
          }
        }
      } else if (alvo === 'producao' || alvo === 'produção' || alvo === 'prod') {
        if (!temEscopo('consorcio')) { resposta = '❌ Seu escopo não inclui Consórcio.'; }
        else {
          const msg = '📋 *RDO — Produção Consórcio*\\n📅 ' + hojeStr + '\\nJosé Márcio, responda (ex: 1: valor | 2: valor)\\n\\n(1) Frentes em execução\\n(2) Efetivo\\n(3) Metros de rede\\n(4) Ligações\\n(5) Pendências\\n(6) Ocorrências/Acidentes\\n(7) Observações gerais';
          const r = await responder.call(this, msg, '5511941816005');
          resposta = r.ok ? '✅ RDO Produção enviado para José Márcio' : ('❌ Falha: ' + r.err);
          if (phone.indexOf('999076534') < 0 && r.ok) {
            await responder.call(this, 'ℹ️ *RDO Produção disparado por ' + proj.responsavel + '*', '5574999076534');
          }
        }
      } else {
        resposta = '❌ Projeto não reconhecido: *' + alvo + '*\\nProjetos: pardinho, osasco, rk, sala, planejamento, producao';
      }
    }

  } else if (cmd === 'meurdo') {
    resposta = '📋 *MEU RDO DIRETOR — Supervisão*\\n\\nResponda os tópicos do dia (formato: 1: texto | 2: texto):\\n\\n(1) Frentes visitadas hoje\\n(2) Decisões tomadas\\n(3) Riscos/alertas\\n(4) Previsão próximo marco\\n(5) Observações gerais';

  } else if (cmd === 'lembrar') {
    if (!proj || !proj.isDiretor) {
      resposta = '❌ Apenas diretores podem disparar lembretes.';
    } else if (!finalCmdMatch[2] || !finalCmdMatch[2].trim()) {
      resposta = '❌ Use: *@lembrar <nome>*\\n\\n⚠️ *Sem envio em massa* — confidencialidade entre projetos.\\n\\nNomes: renato, luiz, fabrizzio, felipe\\nEx: *@lembrar renato*';
    } else {
      const alvo = finalCmdMatch[2].trim().toLowerCase().split(' ')[0];
      if (alvo === 'todos' || alvo === 'diretores') {
        resposta = '🚨 *Envio em massa bloqueado*\\n\\nPor confidencialidade, *@lembrar* exige nome específico.\\nUse: *@lembrar <renato|luiz|fabrizzio|felipe>*';
      } else {
        const DIRS = [
          {nome:'Renato', tel:'5528999154319', keys:['renato']},
          {nome:'Luiz Fernando', tel:'5537999425397', keys:['luiz','fernando','lf']},
          {nome:'Fabrizzio', tel:'5574999076534', keys:['fabrizzio','fabrizio','fabri']},
          {nome:'Felipe', tel:'5561981846325', keys:['felipe','nery']},
        ];
        const match = DIRS.find(d => d.keys.some(k => alvo.indexOf(k) >= 0));
        if (!match) {
          resposta = '❌ Diretor não reconhecido: *' + alvo + '*\\nNomes: renato, luiz, fabrizzio, felipe';
        } else if (match.tel === phone) {
          resposta = '❌ Você não pode se lembrar a si mesmo.';
        } else {
          const r = await responder.call(this, '⏰ *LEMBRETE OBRIGATÓRIO*\\n' + match.nome + ', envie hoje as tarefas matinais para sua equipe via *@tarefa <nome> <descrição>*', match.tel);
          resposta = r.ok ? ('✅ Lembrete enviado para *' + match.nome + '*') : ('❌ Falha: ' + (r.err || 'erro'));
        }
      }
    }

  } else if (cmd === 'guialembrar') {
    resposta = '⏰ *LEMBRAR TAREFAS*\\n\\nUse: *@lembrar <nome>*\\n\\n⚠️ *Sem envio em massa* — confidencialidade entre projetos.\\n\\nNomes:\\n• *renato*\\n• *luiz* (ou lf)\\n• *fabrizzio*\\n• *felipe*\\n\\nEx: *@lembrar renato*';

  } else if (cmd === 'planocustos') {
    resposta = '💰 *PLANO DE CUSTOS (Financeiro)*\\n\\nAs perguntas de custo vão *embutidas no RDO* dos engenheiros de campo:\\n• *Pardinho* (Ícaro) — Diesel, Alimentação/Hotel, MO, Materiais\\n• *Osasco* (Mateus) — Diesel, Alimentação/Hotel, MO, Materiais\\n• *RK* (Alexandre/Igor) — Diesel, Alimentação/Hotel, MO, Materiais\\n\\n❌ *NÃO* vai para Sala Técnica nem Planejamento (só operacional).\\n\\nOs valores caem no Controle Financeiro do dashboard automaticamente.';

  } else if (cmd === 'guiatarefa' || cmd === 'guiatarefapessoa') {
    resposta = '👤 *TAREFA POR PESSOA*\\n\\nUse: *@tarefa <nome> <descrição>*\\n\\nNomes: icaro, mateus, alexandre, igor, gabriel, vinicius, junior, valdean, veronica, jose marcio, thalita, felipe\\n\\nEx: *@tarefa icaro enviar foto do trecho até 17h*';

  } else if (cmd === 'guiatarefadiretoria') {
    resposta = '👔 *TAREFA DIRETORIA*\\n\\nUse: *@tarefadiretoria <nome> <descrição>*\\n\\n⚠️ *Sem envio em massa* — confidencialidade entre projetos.\\n\\nNomes aceitos:\\n• *renato*\\n• *luiz* (ou lf)\\n• *fabrizzio*\\n• *felipe*\\n\\nEx: *@tarefadiretoria renato revisar custos Osasco até sexta*';

  } else if (cmd === 'guiatarefaengenheiros') {
    resposta = '👷 *TAREFA ENGENHEIROS*\\n\\nUse: *@tarefaengenheiros <projeto> <descrição>*\\n\\n⚠️ *Sem envio em massa* — confidencialidade entre projetos.\\n\\nProjetos (exige ter no seu escopo):\\n• *pardinho* → Ícaro\\n• *osasco* → Mateus\\n• *rk* → Alexandre/Igor\\n\\nEx: *@tarefaengenheiros pardinho foto da frente até 17h*';

  } else if (cmd === 'guiatarefasetor') {
    resposta = '🏭 *TAREFA POR SETOR (Consórcio)*\\n\\nUse: *@tarefaconsorcio <setor> <descrição>*\\n\\nSetores: planejamento, producao, sala, todos\\n\\n_Fabrizzio sempre recebe cópia._\\nEx: *@tarefaconsorcio sala revisar NS-12*';

  } else if (cmd === 'tarefadiretoria') {
    if (!proj || !proj.isDiretor) {
      resposta = '❌ Apenas diretores podem delegar tarefas à diretoria.';
    } else if (!finalCmdMatch[2] || !finalCmdMatch[2].trim()) {
      resposta = '❌ Use: *@tarefadiretoria <nome> <descrição>*\\n\\n⚠️ *É obrigatório informar o nome* — confidencialidade entre projetos.\\n\\nNomes: renato, luiz, fabrizzio, felipe\\nEx: *@tarefadiretoria renato revisar custos Osasco até sexta*';
    } else {
      const args = finalCmdMatch[2].trim().split(' ').filter(Boolean);
      const alvo = args[0].toLowerCase();
      const descricao = args.slice(1).join(' ').trim();
      const DIRETORES = [
        {nome:'Renato', tel:'5528999154319', keys:['renato']},
        {nome:'Luiz Fernando', tel:'5537999425397', keys:['luiz','fernando','lf']},
        {nome:'Fabrizzio', tel:'5574999076534', keys:['fabrizzio','fabrizio','fabri']},
        {nome:'Felipe', tel:'5561981846325', keys:['felipe','nery']},
      ];
      if (alvo === 'todos') {
        resposta = '🚨 *Envio em massa bloqueado*\\n\\nPor confidencialidade entre projetos, *@tarefadiretoria* exige nome específico.\\nUse: *@tarefadiretoria <renato|luiz|fabrizzio|felipe> <descrição>*';
      } else {
        const match = DIRETORES.find(d => d.keys.some(k => alvo.indexOf(k) >= 0));
        if (!match) {
          resposta = '❌ Diretor não reconhecido: *' + alvo + '*\\nNomes: renato, luiz, fabrizzio, felipe';
        } else if (!descricao) {
          resposta = '❌ Faltou a descrição. Use: *@tarefadiretoria ' + match.nome.toLowerCase().split(' ')[0] + ' <descrição>*';
        } else if (match.tel === phone) {
          resposta = '❌ Você não pode mandar tarefa pra si mesmo.';
        } else {
          const msg = '🚨 *TAREFA DIRETORIA*\\n👤 Delegado por: *' + proj.responsavel + '*\\n📝 ' + descricao + '\\n\\n_Responda "Ciente" para confirmar._';
          const r = await responder.call(this, msg, match.tel);
          if (r.ok) {
            resposta = '✅ Tarefa enviada para *' + match.nome + '*';
          } else {
            resposta = '❌ Falha ao enviar para ' + match.nome + ': ' + (r.err || 'erro desconhecido');
          }
        }
      }
    }

  } else if (cmd === 'tarefaengenheiros' || cmd === 'tarefaeng') {
    if (!proj || !proj.isDiretor) {
      resposta = '❌ Apenas diretores podem delegar tarefas aos engenheiros.';
    } else if (!finalCmdMatch[2] || !finalCmdMatch[2].trim()) {
      resposta = '❌ Use: *@tarefaengenheiros <projeto> <descrição>*\\n\\n⚠️ *É obrigatório escolher o projeto* — confidencialidade entre projetos.\\n\\nProjetos: pardinho, osasco, rk\\nEx: *@tarefaengenheiros pardinho enviar foto do trecho até 17h*';
    } else {
      const args = finalCmdMatch[2].trim().split(' ').filter(Boolean);
      const alvo = args[0].toLowerCase();
      const descricao = args.slice(1).join(' ').trim();
      const escopoDir2 = proj.escopo || [];
      const temEsc = (pr) => escopoDir2.indexOf('todos') >= 0 || escopoDir2.indexOf(pr) >= 0;
      const ENGS = {
        pardinho: {nome:'Ícaro',          tel:'5537998268576', proj:'pardinho'},
        osasco:   {nome:'Mateus',         tel:'5561991015639', proj:'osasco'},
        rk:       {nome:'Alexandre/Igor', tel:'5531998894664', proj:'rk'},
      };
      if (alvo === 'todos') {
        resposta = '🚨 *Envio em massa bloqueado*\\n\\nPor confidencialidade, *@tarefaengenheiros* exige o projeto específico.\\nUse: *@tarefaengenheiros <pardinho|osasco|rk> <descrição>*';
      } else if (!ENGS[alvo]) {
        resposta = '❌ Projeto não reconhecido: *' + alvo + '*\\nProjetos: pardinho, osasco, rk';
      } else if (!temEsc(alvo)) {
        resposta = '❌ Seu escopo não inclui o projeto *' + alvo + '*.';
      } else if (!descricao) {
        resposta = '❌ Faltou a descrição. Use: *@tarefaengenheiros ' + alvo + ' <descrição>*';
      } else {
        const e = ENGS[alvo];
        const msg = '🚨 *TAREFA ' + alvo.toUpperCase() + '*\\n👤 Delegado por: *' + proj.responsavel + '*\\n📝 ' + descricao + '\\n\\n_Responda "Ciente" para confirmar._';
        const r = await responder.call(this, msg, e.tel);
        if (r.ok) {
          resposta = '✅ Tarefa enviada para *' + e.nome + '* (' + alvo + ')';
        } else {
          resposta = '❌ Falha ao enviar para ' + e.nome + ': ' + (r.err || 'erro desconhecido');
        }
      }
    }

  } else if (cmd === 'tarefaconsorcio') {
    if (!proj || !proj.isDiretor) {
      resposta = '❌ Apenas diretores podem delegar tarefas ao consórcio.';
    } else if (!(proj.escopo || []).some(e => e === 'consorcio' || e === 'todos')) {
      resposta = '❌ Seu escopo não inclui o Consórcio Se Liga na Rede.';
    } else {
      const args = finalCmdMatch[2] ? finalCmdMatch[2].split(' ') : [];
      if (args.length < 2) {
        resposta = '❌ Use: *@tarefaconsorcio <setor> <descrição>*\\nSetores: planejamento, producao, sala, todos';
      } else {
        const setor = args[0].toLowerCase();
        const descricao = finalCmdMatch[2].substring(args[0].length).trim();
        const todos = [
          {nome:'Gabriel', tel:'5513991995918', setor:'sala'},
          {nome:'Vinicius', tel:'5513978216285', setor:'sala'},
          {nome:'Junior', tel:'5511986012223', setor:'planejamento'},
          {nome:'Valdean', tel:'5599991392763', setor:'planejamento'},
          {nome:'Veronica', tel:'5513997733121', setor:'planejamento'},
          {nome:'José Márcio', tel:'5511941816005', setor:'producao'},
        ];
        let destinos = [];
        if (setor === 'todos') destinos = todos.slice();
        else if (setor.indexOf('plan') >= 0) destinos = todos.filter(e => e.setor === 'planejamento');
        else if (setor.indexOf('prod') >= 0) destinos = todos.filter(e => e.setor === 'producao');
        else if (setor.indexOf('sala') >= 0) destinos = todos.filter(e => e.setor === 'sala');
        if (destinos.length === 0) {
          resposta = '❌ Setor não reconhecido. Use: planejamento, producao, sala, todos';
        } else {
          const msg = '🚨 *TAREFA CONSÓRCIO — ' + setor.toUpperCase() + '*\\n👤 Delegado por: *' + proj.responsavel + '*\\n📝 ' + descricao + '\\n\\n_Responda "Ciente" para confirmar._';
          const ok = [];
          for (const d of destinos) {
            const r = await responder.call(this, msg, d.tel);
            if (r.ok) ok.push(d.nome);
          }
          await responder.call(this, 'ℹ️ *CÓPIA — Tarefa Consórcio (' + setor + ')*\\nDelegada por ' + proj.responsavel + ': ' + descricao, '5574999076534');
          resposta = '✅ Tarefa enviada: ' + ok.join(', ') + '\\n(Cópia → Fabrizzio)';
        }
      }
    }

  } else {
    resposta = '❓ Comando *@' + cmd + '* não reconhecido.\\nDigite *menu* pra ver as opções e comandos válidos.';
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
    const msg = '✏️ *Tópico ' + num + ' — ' + q.label + '*\\n\\nResponda agora o valor/status.\\nExemplo: *' + q.tag + ': 50*\\n\\nOu mande direto: *' + num + ': seu valor aqui*';
    await responder.call(this, msg);
    return [{ json: { ignorar: true, motivo: 'Pergunta tópico ' + num } }];
  }
}

// Resposta no formato "1: valor" ou "1: a | 2: b | 3: c" — converte pra tags e segue pro RDO
if (proj && !proj.isGestor && /^\\s*\\d+\\s*[:=]/.test(trimmed)) {
  const partes = trimmed.split('|').map(s => s.trim());
  const tagLines = [];
  const tagMap = {};
  for (const p of partes) {
    const m = p.match(/^(\\d+)\\s*[:=]\\s*(.+)$/);
    if (m) {
      const q = proj.perguntas.find(x => x.num === parseInt(m[1], 10));
      if (q) {
        tagLines.push(q.tag + ': ' + m[2].trim());
        tagMap[q.tag] = m[2].trim();
      }
    }
  }
  if (tagLines.length > 0) {
    text = tagLines.join('\\n');
    // ========== GRAVA NO SUPABASE (fail-safe) ==========
    const pid = resolverProjectId(proj.nome);
    if (!pid) {
      await responder.call(this, '⚠️ RDO recebido mas projeto *' + proj.nome + '* nao esta mapeado. Admin notificado.');
      await responder.call(this, '🚨 ALERTA - RDO de ' + proj.responsavel + ' (' + proj.nome + ') sem projeto_id. Conteudo: ' + tagLines.join(' | ').slice(0, 300), '5561981846325');
    } else {
      const hoje = new Date().toISOString().split('T')[0];
      const _num = (k) => { const v = parseFloat((tagMap[k] || '0').replace(',', '.')); return isNaN(v) ? 0 : v; };
      const _int = (k) => { const v = parseInt(tagMap[k] || '0', 10); return isNaN(v) ? 0 : v; };
      const rdoData = {
        projeto_id: pid,
        data: hoje,
        clima: (tagMap.clima || 'bom').toLowerCase().slice(0, 30),
        turno: 'Diurno',
        status: 'aberto',
        fotos: [],
        producao_m: _num('metros_rede'),
        equipe_number: _int('efetivo'),
        observacoes: tagLines.join(' | ').slice(0, 2000),
        apontador: proj.responsavel,
        custo_diesel: _num('custo_diesel'),
        custo_alimentacao: _num('custo_alim'),
        custo_mao_obra: _num('custo_mo'),
        custo_materiais: _num('custo_mat'),
      };
      const res = await salvarSupabaseRdo(this, rdoData);
      if (res.ok) {
        // Grava também os lançamentos financeiros (custos do dia) para o DRE
        const lancRes = await salvarLancamentosFinanceiros(this, pid, proj.responsavel, hoje, {
          diesel: _num('custo_diesel'),
          alimentacao: _num('custo_alim'),
          mao_obra: _num('custo_mo'),
          materiais: _num('custo_mat'),
        });
        const lancInfo = lancRes.ok && lancRes.count > 0
          ? ('\\n💰 ' + lancRes.count + ' custo(s) no DRE.')
          : '';
        await responder.call(this, '✅ *RDO recebido!*\\n💾 Gravado no dashboard.' + lancInfo + '\\n\\n📊 ' + tagLines.length + ' topicos processados.');
        // notifica admin
        await responder.call(this, '📥 *RDO RECEBIDO*\\n👷 ' + proj.responsavel + ' (' + proj.nome + ')\\n' + tagLines.join('\\n').slice(0, 500), '5561981846325');
      } else {
        await responder.call(this, '⚠️ RDO recebido mas falhou ao gravar: ' + (res.err || 'erro'));
        await responder.call(this, '🚨 *FALHA GRAVAR RDO*\\n' + proj.responsavel + ' (' + proj.nome + ')\\nErro: ' + (res.err || 'desconhecido').slice(0, 200), '5561981846325');
      }
      return [{ json: { ignorar: true, motivo: 'RDO processado', phone, gravado: res.ok } }];
    }
  }
}

// ========== ROTEAMENTO RDO ==========
// Só roteia se o phone for de um responder de RDO conhecido. Caso contrário ignora
// (gestores caem aqui se mandarem texto que não é menu/comando — apenas confirmamos
// recebimento sem disparar sub-workflow inexistente).
let targetWebhook = '';

if (phone.includes('999996252')) { // João
  targetWebhook = 'https://n8n-production-ae317.up.railway.app/webhook/construdata-rdo-joao';
} else if (phone.includes('991015639')) { // Mateus Santos
  targetWebhook = 'https://n8n-production-ae317.up.railway.app/webhook/construdata-rdo-osasco';
} else if (phone.includes('991995918') || phone.includes('978216285')) { // Gabriel ou Vinicius
  targetWebhook = 'https://n8n-production-ae317.up.railway.app/webhook/construdata-rdo-sala-tecnica';
} else if (phone.includes('998268576')) { // Icaro (Pardinho)
  targetWebhook = 'https://n8n-production-ae317.up.railway.app/webhook/construdata-rdo-pardinho';
} else {
// ========== FALLBACK (IA DESLIGADA) ==========
// Gestor mandou texto cru que não é menu/comando → apenas silencia.
if (proj && proj.isGestor && !targetWebhook) {
  return [{ json: { ignorar: true, motivo: 'Gestor texto livre — IA desligada, silêncio' } }];
}

if (!targetWebhook) {
  // Telefone desconhecido (amigos, familiares, conversas pessoais do Felipe).
  // NUNCA responder — o bot não pode se meter em conversas alheias.
  return [{ json: { ignorar: true, motivo: 'Telefone nao cadastrado - silencio: ' + phone } }];
}
}

return [{ json: { ignorar: false, phone, text, targetWebhook } }];
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
        position: [800, 200],
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
