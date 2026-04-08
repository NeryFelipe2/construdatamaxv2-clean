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
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
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
    nome: 'ConstruData Santos', responsavel: 'João',
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
    nome: 'Gestão Geral (Felipe Nery)', responsavel: 'Felipe Nery', isGestor: true,
    perguntas: []
  };
  if (p.includes('999076534')) return {
    nome: 'Sala Técnica SLNR Santos', responsavel: 'Fabrizzio', isGestor: true,
    perguntas: []
  };
  if (p.includes('999425397')) return {
    nome: 'Diretoria Pardinho/Osasco', responsavel: 'Luiz Fernando', isGestor: true,
    perguntas: []
  };
  if (p.includes('999154319')) return {
    nome: 'Diretoria Pardinho/Osasco', responsavel: 'Renato', isGestor: true,
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
const cmdMatch = trimmed.match(/^@(\\w+)(?:\\s+(.*))?$/i);

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
      '',
      '_▶️ Digite o número da opção (ex: 1) ou use os '@comandos' diretamente._',
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
  } catch (e) {}
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

// Saudação ou pedido de ajuda → manda menu
if (isSaudacao || isAjuda) {
  await responder.call(this, montarMenu(proj, phone));
  return [{ json: { ignorar: true, motivo: 'Menu enviado' } }];
}

// Conversão de atalhos numéricos ou textuais para cmdMatch
let finalCmdMatch = cmdMatch;
const shortcutMatch = trimmed.match(/^([1-6sm])$/i);

if (shortcutMatch && proj) {
  const s = shortcutMatch[1].toLowerCase();
  if (proj.isGestor) {
    if (s === '1') finalCmdMatch = [null, 'status', ''];
    else if (s === '2') finalCmdMatch = [null, 'equipe', ''];
    else if (s === '3') finalCmdMatch = [null, 'projetos', ''];
    else if (s === '4') finalCmdMatch = [null, 'dashboard', ''];
    else if (s === '5') finalCmdMatch = [null, 'reenviar', 'pardinho']; // Envia para teste
    else if (s === '6') finalCmdMatch = [null, 'ia', ''];
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
    const args = cmdMatch[2] ? cmdMatch[2].split(' ') : [];
    if (args.length > 1 && proj.isGestor) {
      const alvo = args[0].toLowerCase();
      const descricao = cmdMatch[2].substring(alvo.length).trim();
      
      let telefoneDestino = null;
      if (alvo.includes('joao') || alvo.includes('joão')) telefoneDestino = '5561999996252';
      else if (alvo.includes('mateus')) telefoneDestino = '5561991015639';
      else if (alvo.includes('icaro') || alvo.includes('ícaro')) telefoneDestino = '5537998268576';
      else if (alvo.includes('gabriel')) telefoneDestino = '5513991995918';
      else if (alvo.includes('vinicius')) telefoneDestino = '5513978216285';
      else if (alvo.includes('thalita')) telefoneDestino = '5511919803270';
      else if (alvo.includes('felipe')) telefoneDestino = '5561981846325';
      
      if (telefoneDestino) {
        resposta = '✅ Ordem de serviço enviada diretamente para o terminal corporativo de *' + (alvo.charAt(0).toUpperCase() + alvo.slice(1)) + '* com prioridade máxima!';
        await responder.call(this, '🚨 *NOVA TAREFA DELEGADA (DIRETORIA)* 🚨\\n\\n👤 Delegado por: *' + proj.responsavel + '*\\n📝 *Tarefa:* ' + descricao + '\\n\\n⚠️ _Esta tarefa foi protocolada e está sendo rastreada no Painel Gestão 360._\\n_Responda com "Ciente" para confirmar._', telefoneDestino);
      } else {
        resposta = '❌ Executor não encontrado no cache rápido. Use o nome exato (Ex: mateus, icaro, joao, gabriel, thalita).';
      }
    } else if (!proj.isGestor) {
      resposta = '❌ Permissão negada. Apenas diretores e gerentes podem delegar ordens prioritárias (Gestor-Only).';
    } else {
      resposta = '❌ Erro de Sintaxe. Digite: *@tarefa <nome_do_executor> <descrição da tarefa>*';
    }

  } else if (cmd === 'ia' || cmd === 'ai') {
    const pergunta = cmdMatch[2] ? cmdMatch[2].trim() : '';
    if (pergunta) {
      await responder.call(this, '⏳ A inteligência artificial está analisando sua solicitação...');
      const respostaIA = await perguntarGroq(this, pergunta);
      resposta = '🤖 *Assistente IA Llama-3*\\n\\n' + respostaIA;
    } else {
      resposta = '🤖 *Assistente IA Llama-3*\\nEstou pronto! Para perguntar qualquer coisa, basta digitar:\\n\\n*@ia <sua dúvida>*\\n\\nExemplo: *@ia Me explique o que é um traço de concreto 25 MPa.*';
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
if (proj && /^\\s*\\d+\\s*[:=]/.test(trimmed)) {
  const partes = trimmed.split('|').map(s => s.trim());
  const tagLines = [];
  for (const p of partes) {
    const m = p.match(/^(\\d+)\\s*[:=]\\s*(.+)$/);
    if (m) {
      const q = proj.perguntas.find(x => x.num === parseInt(m[1], 10));
      if (q) tagLines.push(q.tag + ': ' + m[2].trim());
    }
  }
  if (tagLines.length > 0) {
    text = tagLines.join('\\n'); // sobrescreve text para o sub-workflow processar normalmente
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
// ========== FALLBACK INTELIGENTE (IA) ==========
// Se gestor mandar texto cru que não é comando, assumimos que é uma pergunta para IA.
if (proj && proj.isGestor && !targetWebhook) {
  await responder.call(this, '⏳ A inteligência artificial está analisando sua mensagem...');
  const respostaIA = await perguntarGroq(this, text);
  await responder.call(this, '🤖 *Assistente IA:*

' + respostaIA);
  return [{ json: { ignorar: true, motivo: 'Fallback IA para Gestor' } }];
}

if (!targetWebhook) {
  // Phone não é responder de RDO nem Gestor que fez RDO (impossível chegar aqui usualmente sem target, mas segurança)
  await responder.call(this, '🤖 Recebi sua mensagem, mas não tem operação associada.\\n\\nDigite *menu* pra ver as opções.');
  return [{ json: { ignorar: true, motivo: 'Phone sem destino: ' + phone } }];
}

return [{ json: { ignorar: false, phone, text, targetWebhook } }];
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
