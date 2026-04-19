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
    isArchived: false,
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
// ========== SUPABASE CONFIG ==========
const SUPABASE_URL = 'https://vblfdikfobsirwpdnybw.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibGZkaWtmb2JzaXJ3cGRueWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzAwODIsImV4cCI6MjA4ODk0NjA4Mn0.GOx3HoMh3P2Zzxz8BxNsfQBfXwsNZNQsdVc3nJaqRy4';

// UUIDs FIXOS dos projetos no Supabase (tabela projetos)
const PROJECT_IDS = {
  brasilia: '2a28beec-b1f8-4b0c-8416-d0710bb35d9d',
  osasco:   'f3c6645b-347f-4382-b9c5-d103c27ec511',
  pardinho: 'ec112c9a-1669-4287-8079-526d6940ce82',
  tatui:    'c2bf8fda-b2e0-4bc1-9535-4891d596ea10',
  consorcio:'abe7f66c-004b-4bb5-a245-6be67debd9f7',
  rk:'d4e5f6a7-b8c9-4d0e-a1f2-b3c4d5e6f7a8',
};

// Fail-safe: retorna null pra projetos não reconhecidos com certeza.
// NUNCA cai em fallback silencioso pra outro projeto — confidencialidade.
function resolverProjectId(nome) {
  if (!nome) return null;
  const n = nome.toLowerCase();
  if (n.indexOf('pardinho') >= 0 || n.indexOf('itapetininga') >= 0) return PROJECT_IDS.pardinho;
  if (n.indexOf('tatui') >= 0 || n.indexOf('tatuí') >= 0 || n.indexOf('sao roque') >= 0 || n.indexOf('são roque') >= 0 || n.indexOf('pesqueiro') >= 0 || n.indexOf('cesario') >= 0) return PROJECT_IDS.tatui;
  if (n.indexOf('osasco') >= 0 || n.indexOf('clu') >= 0 || n.indexOf('cuiab') >= 0) return PROJECT_IDS.osasco;
  if (n.indexOf('consorcio') >= 0 || n.indexOf('consórcio') >= 0 || n.indexOf('seliga') >= 0 || n.indexOf('slnr') >= 0
      || n.indexOf('sala t') >= 0 || n === 'sala' || n === 'planejamento' || n === 'producao' || n === 'produção'
      || n.indexOf('gabriel') >= 0 || n.indexOf('vinicius') >= 0 || n.indexOf('junior') >= 0
      || n.indexOf('valdean') >= 0 || n.indexOf('veronica') >= 0 || n.indexOf('márcio') >= 0 || n.indexOf('marcio') >= 0
      || n.indexOf('fabrizzio') >= 0 || n.indexOf('fabrizio') >= 0) return PROJECT_IDS.consorcio;
  if (n.indexOf('brasilia') >= 0 || n.indexOf('brasília') >= 0 || n.indexOf('joão') >= 0 || n.indexOf('joao') >= 0) return PROJECT_IDS.brasilia;
  if (n.indexOf('rk') >= 0 || n.indexOf('sub empreita') >= 0 || n.indexOf('alexandre') >= 0 || n.indexOf('igor') >= 0) return PROJECT_IDS.rk;
  return null;
}

async function salvarSupabaseRdo(ctx, dados) {
  // FAIL-SAFE: exige project_id válido
  if (!dados || !dados.project_id) return { ok: false, err: 'project_id ausente' };
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

async function salvarTarefa(ctx, dados) {
  try {
    console.log('[tarefas] salvando no Supabase:', JSON.stringify({
      responsavel: dados && dados.responsavel,
      responsavel_phone: dados && dados.responsavel_phone,
      origem: dados && dados.origem,
      descricao: dados && dados.descricao,
    }));
    const r = await ctx.helpers.httpRequest({
      method: 'POST',
      url: SUPABASE_URL + '/tarefas',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: dados,
      json: true,
    });
    console.log('[tarefas] salva com sucesso:', JSON.stringify(r));
    return { ok: true, data: r };
  } catch (e) {
    console.error('[tarefas] erro ao salvar:', JSON.stringify({
      message: (e && e.message) || String(e),
      statusCode: e && e.statusCode,
      response: e && e.response && e.response.body,
    }));
    return { ok: false, err: (e && e.message) || String(e) };
  }
}

// ========== GEMINI OCR + FINANCEIRO ==========
const GEMINI_API_KEY = 'AIzaSyBp7qA72UDff0MzqfwRSinyWbo92p17JF8';
const EVOLUTION_API_URL = 'https://evolution-api-production-b130.up.railway.app';
const EVOLUTION_API_KEY = 'construdata2026';
const INSTANCE_NAME = 'construdata-felipe';

// Mapeamento de centros de custo (texto livre -> código)
const CENTROS_MAP = {
  osasco: { codigo: 'OSA', nome: 'Osasco' },
  pardinho: { codigo: 'PAR', nome: 'Pardinho' },
  santos: { codigo: 'SAN', nome: 'Santos / SLNR' },
  slnr: { codigo: 'SAN', nome: 'Santos / SLNR' },
  brasilia: { codigo: 'BRA', nome: 'Brasília' },
  consorcio: { codigo: 'CON', nome: 'Consórcio' },
  'rk sede': { codigo: 'RKS', nome: 'RK Sede' },
  rk: { codigo: 'RKS', nome: 'RK Sede' },
  sede: { codigo: 'RKS', nome: 'RK Sede' },
};

// Mapeamento de plano de contas (texto livre -> código)
const PLANO_MAP = {
  material: { codigo: 'MAT', desc: 'Material de Construção' },
  'mao de obra': { codigo: 'MDO', desc: 'Mão de Obra' },
  'mão de obra': { codigo: 'MDO', desc: 'Mão de Obra' },
  diesel: { codigo: 'DSL', desc: 'Diesel / Combustível' },
  combustivel: { codigo: 'DSL', desc: 'Diesel / Combustível' },
  'combustível': { codigo: 'DSL', desc: 'Diesel / Combustível' },
  alimentacao: { codigo: 'ALM', desc: 'Alimentação / VR / VA' },
  'alimentação': { codigo: 'ALM', desc: 'Alimentação / VR / VA' },
  aluguel: { codigo: 'AEQ', desc: 'Aluguel de Equipamento' },
  equipamento: { codigo: 'AEQ', desc: 'Aluguel de Equipamento' },
  transporte: { codigo: 'TRF', desc: 'Transporte / Frete' },
  frete: { codigo: 'TRF', desc: 'Transporte / Frete' },
  ferramenta: { codigo: 'FER', desc: 'Ferramentas / Consumíveis' },
  ferramentas: { codigo: 'FER', desc: 'Ferramentas / Consumíveis' },
  epi: { codigo: 'EPI', desc: 'EPI / Segurança' },
  seguranca: { codigo: 'EPI', desc: 'EPI / Segurança' },
  'segurança': { codigo: 'EPI', desc: 'EPI / Segurança' },
  servico: { codigo: 'SVC', desc: 'Serviços Terceirizados' },
  'serviço': { codigo: 'SVC', desc: 'Serviços Terceirizados' },
  terceirizado: { codigo: 'SVC', desc: 'Serviços Terceirizados' },
  administrativo: { codigo: 'ADM', desc: 'Administrativo' },
  admin: { codigo: 'ADM', desc: 'Administrativo' },
  imposto: { codigo: 'IMP', desc: 'Impostos / Taxas' },
  taxa: { codigo: 'IMP', desc: 'Impostos / Taxas' },
  outros: { codigo: 'OUT', desc: 'Outros' },
};

function parseLegendaPagamento(legenda) {
  // Aceita formato: "Obra | Conta | Descrição" ou texto livre
  const result = { centro: null, plano: null, descricao: '', raw: legenda };
  if (!legenda) return result;

  const partes = legenda.split('|').map(p => p.trim());
  
  if (partes.length >= 2) {
    // Formato estruturado: Obra | Conta | Descrição
    const obraText = partes[0].toLowerCase().replace('obra:', '').trim();
    const contaText = partes[1].toLowerCase().replace('categoria:', '').replace('conta:', '').trim();
    result.descricao = partes.slice(2).join(' | ').trim() || partes[1].trim();

    // Resolve centro de custo
    for (const [key, val] of Object.entries(CENTROS_MAP)) {
      if (obraText.indexOf(key) >= 0) { result.centro = val; break; }
    }
    // Resolve plano de contas
    for (const [key, val] of Object.entries(PLANO_MAP)) {
      if (contaText.indexOf(key) >= 0) { result.plano = val; break; }
    }
  } else {
    // Formato livre: tenta detectar palavras-chave
    const lower = legenda.toLowerCase();
    for (const [key, val] of Object.entries(CENTROS_MAP)) {
      if (lower.indexOf(key) >= 0) { result.centro = val; break; }
    }
    for (const [key, val] of Object.entries(PLANO_MAP)) {
      if (lower.indexOf(key) >= 0) { result.plano = val; break; }
    }
    result.descricao = legenda;
  }
  return result;
}

async function downloadImageBase64(ctx, mediaKey, messageId, remoteJid) {
  // Baixa a imagem via Evolution API
  try {
    const r = await ctx.helpers.httpRequest({
      method: 'POST',
      url: EVOLUTION_API_URL + '/chat/getBase64FromMediaMessage/' + INSTANCE_NAME,
      headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
      body: {
        message: {
          key: { remoteJid: remoteJid, id: messageId },
        },
        convertToMp4: false,
      },
      json: true,
    });
    return r && r.base64 ? r.base64 : null;
  } catch (e) {
    console.error('[ocr] erro ao baixar imagem:', (e && e.message) || String(e));
    return null;
  }
}

async function ocrGemini(ctx, base64Image) {
  // Envia imagem pro Gemini Vision e extrai dados financeiros
  try {
    const r = await ctx.helpers.httpRequest({
      method: 'POST',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY,
      headers: { 'Content-Type': 'application/json' },
      body: {
        contents: [{
          parts: [
            {
              text: 'Você é um assistente financeiro de obra. Analise esta imagem de comprovante de pagamento (PIX, boleto, transferência, NF, recibo, etc) e extraia as seguintes informações em formato JSON puro (sem markdown):\n{"valor": 0.00, "data": "DD/MM/YYYY", "fornecedor": "nome", "cnpj_cpf": "00.000.000/0001-00", "forma_pagamento": "PIX/boleto/transferência/cartão/dinheiro", "descricao_ocr": "breve descrição do que aparece no comprovante"}\nSe não encontrar algum campo, use null. Retorne APENAS o JSON, sem texto adicional.'
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image.replace(/^data:image\/\w+;base64,/, '')
              }
            }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
      },
      json: true,
    });
    // Extrai o texto da resposta
    const text = r && r.candidates && r.candidates[0] && r.candidates[0].content && r.candidates[0].content.parts && r.candidates[0].content.parts[0] && r.candidates[0].content.parts[0].text;
    if (!text) return null;
    // Parse JSON da resposta
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('[ocr] erro Gemini:', (e && e.message) || String(e));
    return null;
  }
}

async function processarComprovante(ctx, msgData, phone, proj, responderFn, replyTo) {
  const imgMsg = msgData.message.imageMessage;
  const caption = imgMsg.caption || '';
  const messageId = msgData.key.id;
  const remoteJid = msgData.key.remoteJid;
  
  // 1. Parse da legenda
  const parsed = parseLegendaPagamento(caption);
  
  // 2. Baixa a imagem em base64
  await responderFn.call(ctx, '⏳ Processando comprovante... Aguarde.');
  const base64 = await downloadImageBase64(ctx, imgMsg.mediaKey, messageId, remoteJid);
  
  if (!base64) {
    await responderFn.call(ctx, '⚠️ Não consegui baixar a imagem. Tente enviar novamente.');
    return { ok: false, motivo: 'download falhou' };
  }

  // 3. OCR via Gemini
  const ocr = await ocrGemini(ctx, base64);
  
  // 4. Montar dados do lançamento
  const valor = ocr && ocr.valor ? Number(ocr.valor) : 0;
  const dataOcr = ocr && ocr.data ? ocr.data : null;
  let dataLanc = new Date().toISOString().substring(0, 10);
  if (dataOcr) {
    // Converte DD/MM/YYYY para YYYY-MM-DD
    const partes = dataOcr.split('/');
    if (partes.length === 3) dataLanc = partes[2] + '-' + partes[1] + '-' + partes[0];
  }

  // Se não tem centro de custo na legenda, pede
  if (!parsed.centro) {
    await responderFn.call(ctx, [
      '⚠️ *Faltou o Centro de Custo (obra)!*',
      '',
      'Reenvie a foto com a legenda no formato:',
      '_Obra | Conta | Descrição_',
      '',
      'Obras: Osasco, Pardinho, Santos, Brasília, Consórcio, RK Sede',
    ].join('\\n'));
    return { ok: false, motivo: 'sem centro de custo' };
  }

  // Se não tem plano de contas, usa "Outros"
  const plano = parsed.plano || { codigo: 'OUT', desc: 'Outros' };

  // 5. Salva no Supabase
  const lancamento = {
    tipo: 'executado',
    centro_custo: parsed.centro.codigo,
    obra: parsed.centro.nome,
    plano_conta: plano.codigo,
    plano_conta_desc: plano.desc,
    valor: valor,
    descricao: parsed.descricao || (ocr && ocr.descricao_ocr) || 'Comprovante via WhatsApp',
    fornecedor: (ocr && ocr.fornecedor) || null,
    cnpj_cpf: (ocr && ocr.cnpj_cpf) || null,
    forma_pagamento: (ocr && ocr.forma_pagamento) || null,
    data: dataLanc,
    lancado_por: proj ? proj.responsavel : phone,
    telefone: phone,
    ocr_raw: ocr ? JSON.stringify(ocr) : null,
    status: 'pendente',
  };

  try {
    const r = await ctx.helpers.httpRequest({
      method: 'POST',
      url: SUPABASE_URL + '/fluxo_caixa',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: lancamento,
      json: true,
    });

    const valorFmt = valor > 0 ? 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '⚠️ Não detectado (revise)';
    
    await responderFn.call(ctx, [
      '✅ *PAGAMENTO LANÇADO!*',
      '━━━━━━━━━━━━━━━━━━━━━',
      '',
      '🏗️ *Obra:* ' + parsed.centro.nome,
      '📋 *Conta:* ' + plano.desc,
      '💰 *Valor:* ' + valorFmt,
      '📅 *Data:* ' + dataLanc,
      (ocr && ocr.fornecedor ? '🏢 *Fornecedor:* ' + ocr.fornecedor : ''),
      (ocr && ocr.forma_pagamento ? '💳 *Forma:* ' + ocr.forma_pagamento : ''),
      '',
      '📝 ' + (parsed.descricao || 'Comprovante processado'),
      '',
      'ℹ️ Status: *Pendente aprovação*',
      '_Use @fluxo ' + parsed.centro.nome.split('/')[0].trim().toLowerCase() + ' pra ver o extrato._',
    ].filter(l => l !== '').join('\\n'));

    return { ok: true };
  } catch (e) {
    await responderFn.call(ctx, '❌ Erro ao salvar lançamento: ' + ((e && e.message) || String(e)));
    return { ok: false, err: (e && e.message) || String(e) };
  }
}

async function buscarTarefas(ctx, query) {
  try {
    console.log('[tarefas] buscando:', query);
    const r = await ctx.helpers.httpRequest({
      method: 'GET',
      url: SUPABASE_URL + '/tarefas?' + query,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
      },
      json: true,
    });
    console.log('[tarefas] busca retornou:', Array.isArray(r) ? r.length : 0);
    return { ok: true, data: r || [] };
  } catch (e) {
    console.error('[tarefas] erro ao buscar:', JSON.stringify({
      query,
      message: (e && e.message) || String(e),
      statusCode: e && e.statusCode,
      response: e && e.response && e.response.body,
    }));
    return { ok: false, err: (e && e.message) || String(e), data: [] };
  }
}

async function concluirUltimaTarefa(ctx, responsavelPhone, respostaTexto) {
  const final8 = responsavelPhone.slice(-8);
  const pendentes = await buscarTarefas(ctx, 'responsavel_phone=ilike.*' + encodeURIComponent(final8) + '&status=eq.pendente&order=data_criacao.desc&limit=1');
  if (!pendentes.ok) return pendentes;
  if (!pendentes.data || pendentes.data.length === 0) return { ok: true, count: 0 };
  const tarefa = pendentes.data[0];
  try {
    await ctx.helpers.httpRequest({
      method: 'PATCH',
      url: SUPABASE_URL + '/tarefas?id=eq.' + encodeURIComponent(tarefa.id),
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: {
        status: 'concluida',
        resposta: respostaTexto,
        data_conclusao: new Date().toISOString(),
      },
      json: true,
    });
    return { ok: true, count: 1, tarefa };
  } catch (e) {
    return { ok: false, err: (e && e.message) || String(e) };
  }
}

async function registrarTarefaEnviada(ctx, proj, delegantePhone, alvo, descricao, comando, extraMetadata = {}) {
  return await salvarTarefa(ctx, {
    project_id: resolverProjectId(proj.nome) || resolverProjectId(alvo.nome),
    delegante: proj.responsavel,
    delegante_phone: delegantePhone,
    responsavel: alvo.nome,
    responsavel_phone: alvo.tel,
    descricao,
    tipo: 'operacional',
    status: 'pendente',
    origem: 'whatsapp',
    metadata: Object.assign({
      comando,
      projeto_origem: proj.nome,
      enviado_whatsapp: true,
    }, extraMetadata),
  });
}

// O corpo do webhook do Evolution vem em $input.first().json.body
const payload = $input.first().json.body || $input.first().json;

// Se não for mensagem, ignora
if (!payload.data || payload.event !== 'messages.upsert') {
  return [{ json: { ignorar: true } }];
}

const msgData = payload.data;
const remoteJid = msgData.key.remoteJid || '';
const isGroupMessage = remoteJid.endsWith('@g.us');
const participantJid = msgData.key.participant || msgData.participant || '';
const senderJid = isGroupMessage && participantJid ? participantJid : remoteJid;
const phone = senderJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@g.us', '');
const replyTarget = isGroupMessage ? remoteJid : phone;
let text = '';
let isImageMessage = false;

if (msgData.message) {
  // Detecta imagem (comprovante de pagamento)
  if (msgData.message.imageMessage) {
    isImageMessage = true;
    text = msgData.message.imageMessage.caption || '';
  } else {
    text = msgData.message.conversation || 
           (msgData.message.extendedTextMessage && msgData.message.extendedTextMessage.text) || '';
  }
}

// Se é imagem, processa como comprovante de pagamento
if (isImageMessage) {
  // Identifica quem mandou
  function projetoDoPhoneImagem(p) {
    return phone.endsWith(p.slice(-8));
  }
  const gestorPhones = ['5511976585281', '5511999996252', '5511943124681'];
  const isGestorImg = gestorPhones.some(g => phone.endsWith(g.slice(-8)));
  const projImg = isGestorImg ? { responsavel: 'Gestor', isGestor: true } : { responsavel: phone, isGestor: false };
  
  await processarComprovante(this, msgData, phone, projImg, responder, replyTarget);
  return [{ json: { ignorar: true, motivo: 'Comprovante processado via OCR' } }];
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
      { num: 1, label: 'Frente Capex', tag: 'frente_capex' },
      { num: 2, label: 'Efetivo', tag: 'efetivo' },
      { num: 3, label: 'Metros de rede', tag: 'metros_rede' },
      { num: 4, label: 'Ligações', tag: 'ligacoes' },
      { num: 5, label: 'Interferências', tag: 'interferencias' },
      { num: 6, label: 'Pendências', tag: 'pendencias' },
      { num: 7, label: 'Ocorrências/Acidentes', tag: 'ocorrencias' },
      { num: 8, label: 'Observações gerais', tag: 'observacoes' },
      { num: 9, label: 'Diesel/Combustível R$', tag: 'custo_diesel' },
      { num: 10, label: 'Alimentação/Hotelaria R$', tag: 'custo_alim' },
      { num: 11, label: 'Mão de Obra R$', tag: 'custo_mo' },
      { num: 12, label: 'Materiais/Locações R$', tag: 'custo_mat' },
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
  const perguntasDiretor = [
    { num: 1, label: 'Frentes visitadas hoje', tag: 'frentes_visitadas' },
    { num: 2, label: 'Decisões tomadas', tag: 'decisoes' },
    { num: 3, label: 'Riscos/alertas', tag: 'riscos' },
    { num: 4, label: 'Previsão próximo marco', tag: 'previsao' },
    { num: 5, label: 'Observações gerais', tag: 'observacoes' }
  ];

  if (p.includes('81846325')) return {
    nome: 'Gestão Geral (Felipe Nery)', responsavel: 'Felipe Nery', isGestor: true, isDiretor: true,
    perfil: 'master', escopo: ['todos'],
    perguntas: perguntasDiretor
  };
  if (p.includes('999076534')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'Fabrizzio', isGestor: false, isDiretor: true,
    perfil: 'receptor', escopo: ['consorcio'],
    perguntas: []
  };
  if (p.includes('999425397')) return {
    nome: 'Diretoria Pardinho/Osasco/RK', responsavel: 'Luiz Fernando', isGestor: true, isDiretor: true,
    perfil: 'master', escopo: ['pardinho','osasco','rk'],
    perguntas: perguntasDiretor
  };
  if (p.includes('999154319')) return {
    nome: 'Diretoria RK', responsavel: 'Renato', isGestor: true, isDiretor: true,
    perfil: 'diretor_rk', escopo: ['osasco','pardinho','rk'],
    perguntas: perguntasDiretor
  };
  if (p.includes('999220853')) return {
    nome: 'Operacional RK', responsavel: 'Buruca', isGestor: true,
    perfil: 'operacional_rk', escopo: ['osasco','pardinho','rk'],
    perguntas: []
  };
  // Emilly Anjos — Administrativo/Financeiro RK
  if (p.includes('974168911')) return {
    nome: 'Administrativo RK', responsavel: 'Emilly Anjos', isGestor: true,
    perfil: 'admin_fin', escopo: ['osasco','pardinho','rk'],
    perguntas: []
  };
  // Eng Igor — Engenheiro RK
  if (p.includes('985898482')) return {
    nome: 'Engenharia RK', responsavel: 'Igor', isGestor: false,
    perfil: 'engenheiro_rk', escopo: ['osasco','pardinho','rk'],
    perguntas: [
      { num: 1, label: 'Frentes em andamento', tag: 'frentes' },
      { num: 2, label: 'Efetivo em obra', tag: 'efetivo' },
      { num: 3, label: 'Metros executados', tag: 'metros_rede' },
      { num: 4, label: 'Impedimentos', tag: 'pendencias' },
      { num: 5, label: 'Ocorrências/Acidentes', tag: 'ocorrencias' },
      { num: 6, label: 'Observações gerais', tag: 'observacoes' },
    ]
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
      { num: 6, label: 'Ligações executadas', tag: 'ligacoes' },
      { num: 7, label: 'Equipamentos em uso', tag: 'equipamentos' },
      { num: 8, label: 'Materiais recebidos', tag: 'materiais' },
      { num: 9, label: 'Clima', tag: 'clima' },
      { num: 10, label: 'Pendências', tag: 'pendencias' },
      { num: 11, label: 'Ocorrências/Acidentes', tag: 'ocorrencias' },
      { num: 12, label: 'Observações gerais', tag: 'observacoes' },
      { num: 13, label: 'Diesel/Combustível R$', tag: 'custo_diesel' },
      { num: 14, label: 'Alimentação/Hotelaria R$', tag: 'custo_alim' },
      { num: 15, label: 'Mão de Obra R$', tag: 'custo_mo' },
      { num: 16, label: 'Materiais/Locações R$', tag: 'custo_mat' },
    ]
  };
  // RK Sub Empreita — Alexandre/Igor
  if (p.includes('998894664')) return {
    nome: 'RK Sub Empreita', responsavel: 'Alexandre/Igor',
    perguntas: [
      { num: 1, label: 'Frentes em andamento', tag: 'frentes' },
      { num: 2, label: 'Metros executados', tag: 'metros_rede' },
      { num: 3, label: 'Equipe no local', tag: 'efetivo' },
      { num: 4, label: 'Impedimentos', tag: 'pendencias' },
      { num: 5, label: 'Ocorrências/Acidentes', tag: 'ocorrencias' },
      { num: 6, label: 'Observações gerais', tag: 'observacoes' },
      { num: 7, label: 'Diesel/Combustível R$', tag: 'custo_diesel' },
      { num: 8, label: 'Alimentação/Hotelaria R$', tag: 'custo_alim' },
      { num: 9, label: 'Mão de Obra R$', tag: 'custo_mo' },
      { num: 10, label: 'Materiais/Locações R$', tag: 'custo_mat' },
    ]
  };
  // Consórcio — Planejamento: Junior
  if (p.includes('986012223')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'Junior', setor: 'planejamento',
    perguntas: [
      { num: 1, label: 'Atividades de planejamento', tag: 'atividades_plan' },
      { num: 2, label: 'Cronograma', tag: 'cronograma' },
      { num: 3, label: 'Pendências', tag: 'pendencias' },
    ]
  };
  // Consórcio — Planejamento: Valdeans
  if (p.includes('991392763')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'Valdeans', setor: 'planejamento',
    perguntas: [
      { num: 1, label: 'Atividades de planejamento', tag: 'atividades_plan' },
      { num: 2, label: 'Cronograma', tag: 'cronograma' },
      { num: 3, label: 'Pendências', tag: 'pendencias' },
    ]
  };
  // Consórcio — Planejamento: Veronica
  if (p.includes('997733121')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'Veronica', setor: 'planejamento',
    perguntas: [
      { num: 1, label: 'Atividades de planejamento', tag: 'atividades_plan' },
      { num: 2, label: 'Cronograma', tag: 'cronograma' },
      { num: 3, label: 'Pendências', tag: 'pendencias' },
    ]
  };
  // Consórcio — Produção: José Márcio
  if (p.includes('941816005')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'José Márcio', setor: 'producao',
    perguntas: [
      { num: 1, label: 'Frentes em execução', tag: 'frentes' },
      { num: 2, label: 'Efetivo', tag: 'efetivo' },
      { num: 3, label: 'Metros de rede', tag: 'metros_rede' },
      { num: 4, label: 'Ligações', tag: 'ligacoes' },
      { num: 5, label: 'Pendências', tag: 'pendencias' },
      { num: 6, label: 'Ocorrências/Acidentes', tag: 'ocorrencias' },
      { num: 7, label: 'Observações gerais', tag: 'observacoes' },
    ]
  };
  // SLNR — Cadastro: Cosme AVANT
  if (p.includes('996274392')) return {
    nome: 'Consórcio Se Liga na Rede', responsavel: 'Cosme', setor: 'cadastro',
    perguntas: [
      { num: 1, label: 'Cadastros realizados hoje', tag: 'cadastros_dia' },
      { num: 2, label: 'Pendências de cadastro', tag: 'pendencias_cad' },
      { num: 3, label: 'Observações', tag: 'observacoes' },
    ]
  };
  return null;
}
const proj = projetoDoPhone(phone);

// ========== MENU INTERATIVO ==========
// Detecta saudação, ajuda, ou comando @
const isSaudacao = /^(oi|ola|olá|bom dia|boa tarde|boa noite|opa|menu|opções|opcoes|inicio|início|começar|comecar|start)$/i.test(trimmed);
const isAjuda = /^(@?(ajuda|help|comandos|menu))$/i.test(trimmed);
const cmdMatch = trimmed.match(/^@(\w+)(?:\s+([\s\S]*))?$/i);

function montarMenu(p, phoneDetectado) {
  if (!p) return '🤖 ConstruDataMax\\n\\nNão consegui identificar seu projeto. Telefone: *' + phoneDetectado + '*\\nFala com o admin.';
  var perfil = p.perfil || 'campo';
  var linhas = [];
  // CABEÇALHO
  if (perfil === 'master') { linhas.push('🤖 *ConstruDataMax Gestão 360*'); }
  else if (perfil === 'diretor_rk') { linhas.push('🤖 *ConstruDataMax — Diretoria RK*'); }
  else if (perfil === 'admin_fin') { linhas.push('🤖 *ConstruDataMax — Financeiro RK*'); }
  else if (perfil === 'operacional_rk') { linhas.push('🤖 *ConstruDataMax — Operacional RK*'); }
  else if (perfil === 'engenheiro_rk') { linhas.push('🤖 *ConstruDataMax — Engenharia RK*'); }
  else { linhas.push('🤖 *ConstruDataMax — Operação*'); }
  linhas.push('Olá *' + p.responsavel + '*!' + (p.nome ? ' Projeto: *' + p.nome + '*' : ''));
  linhas.push('');
  // OPERAÇÃO & RDO (master, diretor_rk, operacional_rk)
  if (perfil === 'master' || perfil === 'diretor_rk' || perfil === 'operacional_rk') {
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('📊 *OPERAÇÃO & RDO*');
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('1️⃣ Status RDO Hoje');
    linhas.push('2️⃣ Equipe e Contatos');
    linhas.push('3️⃣ Projetos Ativos');
    if (perfil === 'master') {
      linhas.push('4️⃣ Dashboard Consolidado');
      linhas.push('5️⃣ Reenviar Cobrança');
      linhas.push('7️⃣ Cobrar RDO');
    }
    linhas.push('8️⃣ Meu RDO Diretor');
    linhas.push('');
  }
  // RDO ENGENHEIRO
  if (perfil === 'engenheiro_rk' && p.perguntas && p.perguntas.length > 0) {
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('📊 *MEU RDO*');
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    for (var qi = 0; qi < p.perguntas.length; qi++) {
      linhas.push('*( ' + p.perguntas[qi].num + ' )* — ' + p.perguntas[qi].label);
    }
    linhas.push('');
    linhas.push('💬 Digite *só o número* pra responder');
    linhas.push('');
  }
  // RDO CAMPO (sem perfil definido)
  if (perfil === 'campo' && p.perguntas && p.perguntas.length > 0) {
    linhas.push('📝 *Para responder o RDO de hoje:*');
    linhas.push('');
    for (var qj = 0; qj < p.perguntas.length; qj++) {
      linhas.push('*( ' + p.perguntas[qj].num + ' )* — ' + p.perguntas[qj].label);
    }
    linhas.push('');
    linhas.push('💬 *Como preencher:*');
    linhas.push('• Digite *só o número* (ex: *1*) e o bot pergunta');
    linhas.push('• Ou direto: *1: 50*');
    linhas.push('');
  }
  // TAREFAS (master, diretor_rk, admin_fin)
  if (perfil === 'master' || perfil === 'diretor_rk' || perfil === 'admin_fin') {
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('📋 *TAREFAS & DELEGAÇÃO*');
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    if (perfil === 'master') {
      linhas.push('9️⃣ Lembrar Tarefas');
      linhas.push('🔟 Criar Tarefas');
      linhas.push('1️⃣2️⃣ Tarefas Consórcio');
      linhas.push('1️⃣3️⃣ Tarefa por Pessoa');
      linhas.push('1️⃣4️⃣ Tarefa à Diretoria');
      linhas.push('1️⃣5️⃣ Tarefa aos Engenheiros');
      linhas.push('1️⃣6️⃣ Tarefa por Setor');
    }
    linhas.push('1️⃣7️⃣ 📋 *Minhas Tarefas*');
    linhas.push('');
  }
  // FINANCEIRO (todos perfis RK + master)
  if (perfil === 'master' || perfil === 'diretor_rk' || perfil === 'admin_fin' || perfil === 'operacional_rk' || perfil === 'engenheiro_rk') {
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('💰 *FINANCEIRO — FLUXO DE CAIXA*');
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('1️⃣8️⃣ 💰 *Lançar Pagamento* (📸 Foto + Legenda)');
    if (perfil === 'master' || perfil === 'diretor_rk' || perfil === 'admin_fin') {
      linhas.push('1️⃣1️⃣ Plano de Custos (Projetado)');
      linhas.push('1️⃣9️⃣ 💸 *Extrato Financeiro*');
      linhas.push('2️⃣0️⃣ 📊 *Resumo por Obra*');
    }
    linhas.push('');
  }
  // CAMPO extras
  if (perfil === 'campo') {
    linhas.push('🆘 *Outras Opções:*');
    linhas.push('*( M )* — Menu | *( S )* — Status');
    linhas.push('*( 💰 )* — Lançar pagamento (foto + legenda)');
    linhas.push('');
  }
  // IA (master)
  if (perfil === 'master') {
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('🤖 *IA & PLATAFORMA*');
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('6️⃣ Falar com IA');
    linhas.push('');
  }
  // COMANDOS
  if (perfil !== 'campo') {
    linhas.push('📌 *Comandos rápidos:*');
    linhas.push('• @pagamento — Como lançar');
    linhas.push('• @fluxo <obra> — Extrato');
    if (perfil === 'master' || perfil === 'diretor_rk' || perfil === 'admin_fin') {
      linhas.push('• @tarefa <nome> <desc>');
      linhas.push('• @meurdo');
    }
    if (perfil === 'master') {
      linhas.push('• @gerar dashboard');
      linhas.push('• @rdo <projeto|todos>');
      linhas.push('• @avisar <projeto> <msg>');
    }
    linhas.push('');
  }
  linhas.push('_▶️ Digite o número ou use @comandos._');
  return linhas.join('\\n');
}

async function responder(msg, targetPhone = replyTarget) {
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
const shortcutMatch = trimmed.match(/^(1[0-9]|20|[1-9]|s|m)$/i);

if (shortcutMatch && proj) {
  const s = shortcutMatch[1].toLowerCase();
  if (proj.isGestor) {
    if (s === '1') finalCmdMatch = [null, 'status', ''];
    else if (s === '2') finalCmdMatch = [null, 'equipe', ''];
    else if (s === '3') finalCmdMatch = [null, 'projetos', ''];
    else if (s === '4') finalCmdMatch = [null, 'dashboard', ''];
    else if (s === '5') finalCmdMatch = [null, 'reenviar', 'todos'];
    else if (s === '6') finalCmdMatch = [null, 'iaoff', ''];
    else if (s === '7') finalCmdMatch = [null, 'cobrarRdo', ''];
    else if (s === '8') finalCmdMatch = [null, 'meurdo', ''];
    else if (s === '9') finalCmdMatch = [null, 'guialembrar', ''];
    else if (s === '10') finalCmdMatch = [null, 'guiatarefa', ''];
    else if (s === '11') finalCmdMatch = [null, 'planocustos', ''];
    else if (s === '12') finalCmdMatch = [null, 'guiatarefasetor', ''];
    else if (s === '13') finalCmdMatch = [null, 'guiatarefapessoa', ''];
    else if (s === '14') finalCmdMatch = [null, 'guiatarefadiretoria', ''];
    else if (s === '15') finalCmdMatch = [null, 'guiatarefaengenheiros', ''];
    else if (s === '16') finalCmdMatch = [null, 'guiatarefasetor', ''];
    else if (s === '17') finalCmdMatch = [null, 'minhastarefas', ''];
    else if (s === '18') finalCmdMatch = [null, 'comprovante', ''];
    else if (s === '19') finalCmdMatch = [null, 'extrato', ''];
    else if (s === '20') finalCmdMatch = [null, 'resumoobra', ''];
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
    resposta = '🏗️ *Projetos Ativos — Felipe*\\n\\n' +
      '📍 *Consórcio SLNR (Fabrizzio)*\\n' +
      '  • Sala Técnica Santos (Gabriel/Vinicius)\\n' +
      '  • Elevatória SM\\n' +
      '  • Gerência de Produção (José Márcio)\\n\\n' +
      '📍 *Núcleos RK*\\n' +
      '  • Pardinho - Itapetininga (Ícaro)\\n' +
      '  • Região Tatuí / S. Roque / Pesqueiro (Ícaro)\\n' +
      '  • Osasco - Rua Cuiabá (Mateus)\\n' +
      '  • RK Sub Empreita (Alexandre/Igor)\\n\\n' +
      '📍 *Estudos em Andamento*\\n' +
      '  • Defesa Chira\\n\\n' +
      '📍 *ConstruData Brasília (João)*\\n' +
      '\\n_Portal: https://construdatamaxv2-clean.vercel.app_';

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

  } else if (cmd === 'cobrardo' || cmd === 'cobrarRdo' || cmd === 'cobrar') {
    // Dispara formulário de RDO para todos os engenheiros/líderes de campo
    if (!proj || !proj.isGestor) {
      resposta = '❌ Apenas gestores podem cobrar RDO.';
    } else {
      const EQUIPE_CAMPO = [
        { nome: 'Ícaro (Pardinho)',       tel: '5537998268576' },
        { nome: 'Mateus (Osasco)',         tel: '5561991015639' },
        { nome: 'Alexandre/Igor (RK Sub)', tel: '5531998894664' },
        { nome: 'Gabriel (Sala Técnica)',  tel: '5513991995918' },
        { nome: 'Vinicius (Sala Técnica)', tel: '5513978216285' },
        { nome: 'José Márcio (Produção)',  tel: '5511941816005' },
        { nome: 'João (Brasília)',         tel: '5561999996252' },
      ];
      const msg = '⚠️ *COBRANÇA DE RDO — ConstruDataMax*\\\\n\\\\nOi! Não recebi seu RDO de hoje ainda.\\\\n\\\\nDigite *menu* para ver os tópicos e preencher agora.\\\\n\\\\n_RK Engenharia — Sistema de Gestão_';
      let enviados = [];
      for (const e of EQUIPE_CAMPO) {
        const r = await responder.call(this, msg, e.tel);
        if (r.ok) enviados.push(e.nome);
      }
      resposta = '📨 *Cobrança de RDO disparada!*\\\\n\\\\nEnviado para:\\\\n• ' + enviados.join('\\\\n• ') + '\\\\n\\\\n_Total: ' + enviados.length + ' pessoas notificadas._';
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
              const tarefaRes = await registrarTarefaEnviada(this, proj, phone, match, descricao, '@tarefa');
              resposta = tarefaRes.ok
                ? '✅ Tarefa enviada e registrada para *' + match.nome + '*'
                : '⚠️ Tarefa enviada para *' + match.nome + '*, mas não gravou no Supabase: ' + (tarefaRes.err || 'erro');
            } else {
              resposta = '❌ Falha ao enviar para ' + match.nome + ': ' + r.err;
            }
          }
        }
      }
    }

  } else if (cmd === 'tarefas' || cmd === 'listatarefas') {
    const filtroNome = (finalCmdMatch[2] || '').trim().toLowerCase();
    let query = 'status=eq.pendente&order=data_criacao.desc&limit=80';
    if (filtroNome) {
      query += '&responsavel=ilike.*' + encodeURIComponent(filtroNome) + '*';
    } else if (!proj || !proj.isGestor) {
      const final8 = phone.slice(-8);
      query += '&responsavel_phone=ilike.*' + encodeURIComponent(final8);
    }
    const resp = await buscarTarefas(this, query);
    if (!resp.ok) {
      resposta = '⚠️ Erro ao buscar tarefas: ' + (resp.err || 'falha');
    } else {
      const tarefas = resp.data || [];
      if (tarefas.length === 0) {
        resposta = '📋 Nenhuma tarefa pendente encontrada.';
      } else {
        let texto = '📋 *TAREFAS PENDENTES* (' + tarefas.length + ')\\n\\n';
        tarefas.forEach((t, i) => {
          texto += (i + 1) + '. *' + t.responsavel + '*: ' + t.descricao + '\\n';
        });
        texto += '\\n_Responda "ciente" para concluir sua última tarefa pendente._';
        resposta = texto;
      }
    }

  } else if (cmd === 'tarefashoje') {
    const hoje = new Date().toISOString().split('T')[0];
    const resp = await buscarTarefas(this, 'data_criacao=gte.' + hoje + 'T00:00:00&order=data_criacao.desc&limit=100');
    if (!resp.ok) {
      resposta = '⚠️ Erro ao buscar tarefas de hoje: ' + (resp.err || 'falha');
    } else {
      const tarefas = resp.data || [];
      if (tarefas.length === 0) {
        resposta = '📋 Nenhuma tarefa criada hoje.';
      } else {
        let texto = '📅 *TAREFAS DE HOJE* (' + tarefas.length + ')\\n\\n';
        tarefas.forEach((t, i) => {
          const icon = t.status === 'concluida' ? '✅' : '⏳';
          texto += (i + 1) + '. ' + icon + ' *' + t.responsavel + '*: ' + t.descricao + '\\n';
        });
        resposta = texto;
      }
    }

  } else if (cmd === 'relatoriotarefas') {
    if (!proj || !proj.isGestor) {
      resposta = '❌ Apenas gestores podem gerar relatórios de tarefas.';
    } else {
      const hoje = new Date().toISOString().split('T')[0];
      const resp = await buscarTarefas(this, 'data_criacao=gte.' + hoje + 'T00:00:00&order=data_criacao.desc&limit=150');
      if (!resp.ok) {
        resposta = '⚠️ Erro ao gerar relatório: ' + (resp.err || 'falha');
      } else {
        const todas = resp.data || [];
        const pendentes = todas.filter(t => t.status !== 'concluida');
        const concluidas = todas.filter(t => t.status === 'concluida');
        const porPessoa = {};
        pendentes.forEach(t => {
          if (!porPessoa[t.responsavel]) porPessoa[t.responsavel] = [];
          porPessoa[t.responsavel].push(t);
        });
        let texto = '📊 *RELATÓRIO DE TAREFAS*\\n\\n';
        texto += '📅 Data: ' + new Date().toLocaleDateString('pt-BR') + '\\n';
        texto += '📋 Total: *' + todas.length + '*\\n';
        texto += '⏳ Pendentes: *' + pendentes.length + '*\\n';
        texto += '✅ Concluídas: *' + concluidas.length + '*\\n\\n';
        Object.keys(porPessoa).sort().forEach(nome => {
          texto += '*' + nome + '* (' + porPessoa[nome].length + '):\\n';
          porPessoa[nome].slice(0, 4).forEach(t => {
            texto += '  • ' + (t.descricao || '').slice(0, 80) + '\\n';
          });
          if (porPessoa[nome].length > 4) texto += '  _(e mais ' + (porPessoa[nome].length - 4) + ')_\\n';
          texto += '\\n';
        });
        resposta = texto;
      }
    }

  } else if (cmd === 'ia' || cmd === 'ai' || cmd === 'iaoff') {
    resposta = '🤖 A IA está desligada no momento.';

  } else if (cmd === 'guiardo') {
    resposta = '📋 *COBRAR RDO*\\n\\nUse: *@rdo <projeto>*\\n\\n⚠️ *Sem envio em massa* — confidencialidade entre projetos.\\n\\nProjetos:\\n• *pardinho* → Ícaro\\n• *tatui* → Ícaro\\n• *osasco* → Mateus\\n• *rk* → Alexandre/Igor\\n• *sala* → Gabriel/Vinicius\\n• *planejamento* → Junior/Valdean/Veronica\\n• *producao* → José Márcio\\n\\nEx: *@rdo tatui*';

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
        resposta = '🚨 *Envio em massa bloqueado*\\n\\nPor confidencialidade entre projetos, *@rdo* exige projeto único.\\n\\nProjetos válidos: tatui, pardinho, osasco, rk, sala, planejamento, producao\\nEx: *@rdo tatui*';
      } else if (alvo === 'pardinho') {
        if (!temEscopo('pardinho')) { resposta = '❌ Seu escopo não inclui Pardinho.'; }
        else {
          const msg = '📋 *RDO DIÁRIO — Pardinho*\\n📅 ' + hojeStr + '\\nÍcaro, responda (ex: 1: valor | 2: valor)\\n\\n*OPERACIONAL*\\n(1) Frente Rede Principal\\n(2) Frente Ligações Prediais\\n(3) Frente ETE / Emissário\\n(4) Efetivo total\\n(5) Metros de rede\\n(6) Ligações executadas\\n(7) Equipamentos\\n(8) Materiais\\n(9) Clima\\n(10) Pendências\\n(11) Ocorrências/Acidentes\\n(12) Observações gerais\\n\\n*CUSTO DO DIA (R$)*\\n(13) Diesel/Combustível\\n(14) Alimentação/Hotelaria\\n(15) Mão de Obra\\n(16) Materiais/Locações';
          const r = await responder.call(this, msg, '5537998268576');
          resposta = r.ok ? '✅ RDO Pardinho enviado para Ícaro (com custos)' : ('❌ Falha: ' + r.err);
        }
      } else if (alvo === 'tatui' || alvo === 'tatuí') {
        if (!temEscopo('pardinho') && !temEscopo('tatui')) { resposta = '❌ Seu escopo não inclui a regional Tatuí.'; }
        else {
          const msg = '📋 *RDO DIÁRIO — Região Tatuí (Pesqueiro, S. Roque, Cesário)*\\n📅 ' + hojeStr + '\\nÍcaro, responda (ex: 1: valor | 2: valor)\\n\\n*OPERACIONAL*\\n(1) Frentes (Rede Principal/Ligações/ETE)\\n(2) Efetivo total\\n(3) Metros de rede\\n(4) Ligações executadas\\n(5) Equipamentos utilizados\\n(6) Pendências\\n(7) Ocorrências/Acidentes\\n(8) Observações gerais\\n\\n*CUSTO DO DIA (R$)*\\n(9) Diesel/Combustível\\n(10) Alimentação/Hotelaria\\n(11) Mão de Obra\\n(12) Materiais/Locações';
          const r = await responder.call(this, msg, '5537998268576');
          resposta = r.ok ? '✅ RDO Região Tatuí enviado para Ícaro (com custos)' : ('❌ Falha: ' + r.err);
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
    resposta = '👷 *TAREFA ENGENHEIROS*\\n\\nUse: *@tarefaengenheiros <projeto> <descrição>*\\n\\n⚠️ *Sem envio em massa* — confidencialidade entre projetos.\\n\\nProjetos (exige ter no seu escopo):\\n• *pardinho* → Ícaro\\n• *tatui* → Ícaro\\n• *osasco* → Mateus\\n• *rk* → Alexandre/Igor\\n\\nEx: *@tarefaengenheiros tatui foto da frente até 17h*';

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
            const tarefaRes = await registrarTarefaEnviada(this, proj, phone, match, descricao, '@tarefadiretoria', { grupo: 'diretoria' });
            resposta = tarefaRes.ok
              ? '✅ Tarefa enviada e registrada para *' + match.nome + '*'
              : '⚠️ Tarefa enviada para *' + match.nome + '*, mas não gravou no Supabase: ' + (tarefaRes.err || 'erro');
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
          const tarefaRes = await registrarTarefaEnviada(this, proj, phone, e, descricao, '@tarefaengenheiros', { projeto_alvo: alvo });
          resposta = tarefaRes.ok
            ? '✅ Tarefa enviada e registrada para *' + e.nome + '* (' + alvo + ')'
            : '⚠️ Tarefa enviada para *' + e.nome + '*, mas não gravou no Supabase: ' + (tarefaRes.err || 'erro');
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
          const falhasRegistro = [];
          for (const d of destinos) {
            const r = await responder.call(this, msg, d.tel);
            if (r.ok) {
              ok.push(d.nome);
              const tarefaRes = await registrarTarefaEnviada(this, proj, phone, d, descricao, '@tarefaconsorcio', { setor });
              if (!tarefaRes.ok) falhasRegistro.push(d.nome);
            }
          }
          await responder.call(this, 'ℹ️ *CÓPIA — Tarefa Consórcio (' + setor + ')*\\nDelegada por ' + proj.responsavel + ': ' + descricao, '5574999076534');
          resposta = '✅ Tarefa enviada: ' + ok.join(', ') + '\\n(Cópia → Fabrizzio)';
          if (falhasRegistro.length > 0) {
            resposta += '\\n⚠️ Enviou, mas não registrou: ' + falhasRegistro.join(', ');
          } else if (ok.length > 0) {
            resposta += '\\n💾 Registrada no Supabase.';
          }
        }
      }
    }
  } else if (cmd === 'lancardo') {
    if (!proj || !proj.isGestor) {
      resposta = '❌ Apenas Gestores podem lançar RDO sobrescrito.';
    } else {
      const argsStr = finalCmdMatch[2] || '';
      const espaco = argsStr.trim().indexOf(' ');
      if (espaco < 0) {
        resposta = '❌ Use: *@lancardo <projeto> 1: valor | 2: valor...*\\n\\nEx: *@lancardo tatui 1: 50 | 3: 1500*';
      } else {
        const alvo = argsStr.substring(0, espaco).trim().toLowerCase();
        const pid = resolverProjectId(alvo);
        if (!pid) {
          resposta = '❌ Projeto não reconhecido: *' + alvo + '*';
        } else {
          const rdoText = argsStr.substring(espaco).trim();
          const perguntas = [
            {num:1, tag:'metros_rede'}, {num:2, tag:'efetivo'},
            {num:3, tag:'custo_diesel'}, {num:4, tag:'custo_alim'},
            {num:5, tag:'custo_mo'}, {num:6, tag:'custo_mat'},
            {num:7, tag:'clima'}
          ];
          const partes = rdoText.split(/[|\\n]/).map(s => s.trim()).filter(Boolean);
          const tagLines = [];
          const tagMap = {};
          for (const p of partes) {
            const m = p.match(/^(\\d+)\\s*[:=]\\s*(.+)$/);
            if (m) {
              const q = perguntas.find(x => x.num === parseInt(m[1], 10));
              if (q) {
                tagLines.push(q.tag + ': ' + m[2].trim());
                tagMap[q.tag] = m[2].trim();
              }
            }
          }
          if (tagLines.length > 0) {
            const hoje = new Date().toISOString().split('T')[0];
            const _num = (k) => { const v = parseFloat((tagMap[k] || '0').replace(',', '.')); return isNaN(v) ? 0 : v; };
            const _int = (k) => { const v = parseInt(tagMap[k] || '0', 10); return isNaN(v) ? 0 : v; };
            const rdoData = {
              project_id: pid,
              data: hoje,
              clima: (tagMap.clima || 'bom').toLowerCase().slice(0, 30),
              status: 'aberto',
              producao_m: _num('metros_rede'),
              equipe_number: _int('efetivo'),
              observacoes: tagLines.join(' | ').slice(0, 2000),
              apontador: proj.responsavel + ' (Admin Override)',
              custo_diesel: _num('custo_diesel'),
              custo_alimentacao: _num('custo_alim'),
              custo_mao_obra: _num('custo_mo'),
              custo_materiais: _num('custo_mat'),
            };
            const res = await salvarSupabaseRdo(this, rdoData);
            if (res.ok) {
              const lancRes = await salvarLancamentosFinanceiros(this, pid, proj.responsavel + ' (Admin)', hoje, {
                diesel: _num('custo_diesel'), alimentacao: _num('custo_alim'), mao_obra: _num('custo_mo'), materiais: _num('custo_mat'),
              });
              resposta = '✅ *OVERRIDE RDO!*\\nLançado com sucesso no Supabase para ' + alvo.toUpperCase() + ' (' + tagLines.length + ' tópicos).\\n💰 Custos submetidos no DRE: ' + (lancRes.count || 0);
            } else {
              resposta = '⚠️ Falha ao salvar RDO Override: ' + (res.err || 'erro');
            }
          } else {
            resposta = '❌ Nenhum tópico extraído. Tem certeza que formatou como "1: valor | 2: valor"?';
          }
        }
      }
    }
  } else if (cmd === 'minhastarefas') {
    // Opção 17 — Minhas Tarefas pendentes
    try {
      const res = await this.helpers.httpRequest({
        method: 'GET',
        url: SUPABASE_URL + '/tarefas?status=eq.pendente&responsavel_telefone=eq.' + phone + '&order=prazo.asc&limit=10',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
        json: true,
      });
      if (res && res.length > 0) {
        let lista = '📋 *MINHAS TAREFAS PENDENTES*\\n━━━━━━━━━━━━━━━━━━━━━\\n';
        for (const t of res) {
          const prazo = t.prazo ? new Date(t.prazo).toLocaleDateString('pt-BR') : 'sem prazo';
          lista += '\\n🔹 *' + t.titulo + '*\\n   📌 ' + (t.descricao || 'sem desc.') + '\\n   ⏰ Prazo: ' + prazo + '\\n';
        }
        lista += '\\n_Total: ' + res.length + ' tarefas pendentes._';
        resposta = lista;
      } else {
        resposta = '✅ *Parabéns!* Nenhuma tarefa pendente pra você. 🎉';
      }
    } catch(e) {
      resposta = '📋 *Minhas Tarefas*\\n\\nConsulta temporariamente indisponível. Tente novamente em instantes.';
    }
  } else if (cmd === 'comprovante' || cmd === 'pagamento') {
    // Opção 18 — Instruções pra lançar pagamento
    resposta = [
      '💰 *LANÇAR PAGAMENTO — CONTROLE FINANCEIRO*',
      '━━━━━━━━━━━━━━━━━━━━━',
      '',
      'Fez um pagamento? Manda o comprovante aqui!',
      'Aceito: *PIX, boleto, transferência, cartão, vale, recibo, NF*',
      '',
      '📌 *Como lançar (2 passos):*',
      '',
      '*PASSO 1:* Envie a *foto do comprovante*',
      '',
      '*PASSO 2:* Na *legenda da foto*, informe:',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '📋 *CENTRO DE CUSTO (obra):*',
      '━━━━━━━━━━━━━━━━━━━━━',
      '• Osasco',
      '• Pardinho',
      '• Santos / SLNR',
      '• Brasília',
      '• Consórcio',
      '• RK Sede',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '📋 *PLANO DE CONTAS (o que foi):*',
      '━━━━━━━━━━━━━━━━━━━━━',
      '1. Material de Construção',
      '2. Mão de Obra',
      '3. Diesel / Combustível',
      '4. Alimentação / VR / VA',
      '5. Aluguel de Equipamento',
      '6. Transporte / Frete',
      '7. Ferramentas / Consumíveis',
      '8. EPI / Segurança',
      '9. Serviços Terceirizados',
      '10. Administrativo',
      '11. Impostos / Taxas',
      '12. Outros',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '💡 *EXEMPLOS DE LEGENDA:*',
      '━━━━━━━━━━━━━━━━━━━━━',
      '',
      '_Osasco | Material | Compra tubos Tigre_',
      '',
      '_Pardinho | Diesel | Abastecimento retroescavadeira_',
      '',
      '_RK Sede | Administrativo | Conta de luz escritório_',
      '',
      '🤖 O sistema extrai *valor e data* da foto automaticamente.',
      'Se não conseguir ler, vai te perguntar.',
      '',
      '✅ Cada lançamento vai direto pro *Fluxo de Caixa Executado*!',
    ].join('\\n');
  } else if (cmd === 'extrato' || cmd === 'fluxo') {
    // Opção 19 e @fluxo — Extrato Financeiro
    const obraFiltro = finalCmdMatch && finalCmdMatch[2] ? finalCmdMatch[2].trim() : '';
    const mesAtual = new Date().toISOString().substring(0, 7);
    try {
      let url = SUPABASE_URL + '/fluxo_caixa?mes=eq.' + mesAtual;
      if (obraFiltro) url += '&obra=ilike.*' + obraFiltro + '*';
      url += '&order=data.desc&limit=20';
      const res = await this.helpers.httpRequest({
        method: 'GET',
        url: url,
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
        json: true,
      });
      let projetado = 0, executado = 0;
      const linhas = [];
      for (const r of (res || [])) {
        if (r.tipo === 'projetado') projetado += Number(r.valor || 0);
        else executado += Number(r.valor || 0);
        linhas.push((r.tipo === 'projetado' ? '📋' : '💸') + ' ' + r.descricao + ' — R$ ' + Number(r.valor || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2}));
      }
      resposta = [
        '💰 *EXTRATO FINANCEIRO — ' + mesAtual + '*',
        obraFiltro ? '🏗️ Obra: *' + obraFiltro.toUpperCase() + '*' : '🏗️ Todas as obras',
        '━━━━━━━━━━━━━━━━━━━━━',
        '📋 Projetado: *R$ ' + projetado.toLocaleString('pt-BR', {minimumFractionDigits: 2}) + '*',
        '💸 Executado: *R$ ' + executado.toLocaleString('pt-BR', {minimumFractionDigits: 2}) + '*',
        '📊 Variação: *' + (projetado > 0 ? ((executado / projetado) * 100).toFixed(1) : '0') + '%*',
        '━━━━━━━━━━━━━━━━━━━━━',
        '',
      ].concat(linhas.length > 0 ? linhas : ['_Nenhum lançamento neste mês._']).join('\\n');
    } catch(e) {
      resposta = '💰 *Extrato Financeiro*\\n\\nConsulta temporariamente indisponível.';
    }
  } else if (cmd === 'resumoobra') {
    // Opção 20 — Resumo por Obra (Fluxo de Caixa)
    try {
      const res = await this.helpers.httpRequest({
        method: 'GET',
        url: SUPABASE_URL + '/fluxo_caixa?order=obra.asc,data.desc',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
        json: true,
      });
      const porObra = {};
      for (const r of (res || [])) {
        const obra = r.obra || 'Outros';
        if (!porObra[obra]) porObra[obra] = { projetado: 0, executado: 0, count: 0 };
        if (r.tipo === 'projetado') porObra[obra].projetado += Number(r.valor || 0);
        else porObra[obra].executado += Number(r.valor || 0);
        porObra[obra].count++;
      }
      let texto = '📊 *RESUMO FINANCEIRO POR OBRA*\\n━━━━━━━━━━━━━━━━━━━━━\\n';
      for (const [obra, dados] of Object.entries(porObra)) {
        const pct = dados.projetado > 0 ? ((dados.executado / dados.projetado) * 100).toFixed(1) : '0';
        const emoji = Number(pct) > 100 ? '🔴' : Number(pct) > 80 ? '🟡' : '🟢';
        texto += '\\n' + emoji + ' *' + obra.toUpperCase() + '*';
        texto += '\\n   📋 Projetado: R$ ' + dados.projetado.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        texto += '\\n   💸 Executado: R$ ' + dados.executado.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        texto += '\\n   📊 ' + pct + '% | ' + dados.count + ' lançamentos\\n';
      }
      if (Object.keys(porObra).length === 0) texto += '\\n_Nenhum lançamento encontrado._';
      resposta = texto;
    } catch(e) {
      resposta = '📊 *Resumo por Obra*\\n\\nConsulta temporariamente indisponível.';
    }
  } else {
    resposta = '❓ Comando *@' + cmd + '* não reconhecido.\\nDigite *menu* pra ver as opções e comandos válidos.';
  }

  await responder.call(this, resposta);
  return [{ json: { ignorar: true, motivo: 'Comando @' + cmd } }];
}

// Ciente/ok/confirmado — funciona mesmo sem projeto cadastrado
if (lower === 'ciente' || lower === 'ok' || lower === 'confirmado' || lower === 'beleza' || lower === 'feito') {
  const done = await concluirUltimaTarefa(this, phone, trimmed);
  if (done.ok && done.count > 0) {
    await responder.call(this, '✅ *Tarefa marcada como concluída!*\\n\\n📌 ' + done.tarefa.descricao + '\\n\\n_Obrigado pela confirmação!_');
    return [{ json: { ignorar: true, motivo: 'Tarefa concluida', tarefa_id: done.tarefa.id } }];
  }
  if (!done.ok) {
    await responder.call(this, '⚠️ Recebi "' + trimmed + '", mas não achei tarefa pendente no Supabase. Erro: ' + (done.err || 'erro'));
    return [{ json: { ignorar: true, motivo: 'Falha ao concluir tarefa' } }];
  }
  // Nenhuma tarefa pendente
  if (proj) {
    await responder.call(this, '✅ Ciente recebido, *' + proj.responsavel + '*! Mas não há tarefas pendentes registradas para você no momento.');
  } else {
    await responder.call(this, '✅ Confirmação recebida! Nenhuma tarefa pendente encontrada para este número.');
  }
  return [{ json: { ignorar: true, motivo: 'Ciente sem tarefa pendente' } }];
}

// Apenas um número (1-11) → pergunta o valor desse tópico se tiver perguntas
const numMatchRdo = trimmed.match(/^([0-9]{1,2})$/);
if (numMatchRdo && proj && proj.perguntas.length > 0) {
  const num = parseInt(numMatchRdo[1], 10);
  const q = proj.perguntas.find(x => x.num === num);
  if (q) {
    const msg = '✏️ *Tópico ' + num + ' — ' + q.label + '*\\n\\nResponda agora o valor/status.\\nExemplo: *' + q.tag + ': 50*\\n\\nOu mande direto: *' + num + ': seu valor aqui*';
    await responder.call(this, msg);
    return [{ json: { ignorar: true, motivo: 'Pergunta tópico ' + num } }];
  }
}

// Resposta no formato "1: valor" ou "1: a | 2: b | 3: c" — converte pra tags e segue pro RDO
if (proj && proj.perguntas.length > 0 && /^\\s*\\d+\\s*[:=]/.test(trimmed)) {
  const partes = trimmed.split(/[|\\n]/).map(s => s.trim()).filter(Boolean);
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
        project_id: pid,
        data: hoje,
        clima: (tagMap.clima || 'bom').toLowerCase().slice(0, 30),
        status: 'aberto',
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
// ========== FALLBACK INTELIGENTE ==========
// Telefone desconhecido → SILÊNCIO absoluto (conversas pessoais)
if (!proj) {
  return [{ json: { ignorar: true, motivo: 'Telefone nao cadastrado - silencio: ' + phone } }];
}

// Telefone CADASTRADO mandou texto livre → guiar o usuário
var perfil = proj.perfil || 'campo';
var nomeUser = proj.responsavel || 'equipe';
var fallbackMsg = '';

if (perfil === 'master') {
  // Admin/Felipe: silencia (pode ser conversa pessoal)
  return [{ json: { ignorar: true, motivo: 'Master texto livre — silencio' } }];
}

if (perfil === 'diretor_rk' || perfil === 'admin_fin') {
  fallbackMsg = 'Oi *' + nomeUser + '*, recebi sua mensagem mas nao consegui processar automaticamente.\\\\n\\\\n' +
    'Para eu te ajudar, use um desses comandos:\\\\n\\\\n' +
    '📋 *Responder tarefas:*\\\\n' +
    'Me envie o status de cada tarefa assim:\\\\n' +
    '_1. Feito - ja conversei com Diego_\\\\n' +
    '_2. Pendente - Carol nao respondeu_\\\\n' +
    '_3. Em andamento..._\\\\n\\\\n' +
    '🔢 *Acessar o menu:*\\\\n' +
    'Digite *oi* ou *menu*\\\\n\\\\n' +
    '💰 *Lancar pagamento:*\\\\n' +
    'Envie a *foto do comprovante* com a legenda:\\\\n' +
    '_obra | valor | descricao | forma_\\\\n\\\\n' +
    '_ConstruDataMax Gestao 360_';
} else if (perfil === 'engenheiro_rk') {
  fallbackMsg = 'Oi *' + nomeUser + '*, recebi sua mensagem!\\\\n\\\\n' +
    'Para preencher o *RDO*, digite *oi* e siga o menu.\\\\n\\\\n' +
    '📝 *Responder rapido:*\\\\n' +
    'Digite o *numero* do topico (ex: *1*) e eu pergunto o dado.\\\\n' +
    'Ou direto: *1: 50*\\\\n\\\\n' +
    '💰 *Lancar gasto:*\\\\n' +
    'Envie *foto + legenda* (obra | valor | descricao)\\\\n\\\\n' +
    '_ConstruDataMax Gestao 360_';
} else if (perfil === 'operacional_rk') {
  fallbackMsg = 'Oi *' + nomeUser + '*, recebi sua mensagem!\\\\n\\\\n' +
    'Para acessar o sistema, digite *oi* ou *menu*.\\\\n\\\\n' +
    '💰 Para lancar pagamento: envie a *foto do comprovante* com legenda.\\\\n\\\\n' +
    '_ConstruDataMax Gestao 360_';
} else {
  // Campo
  fallbackMsg = 'Oi *' + nomeUser + '*, recebi!\\\\n\\\\n' +
    'Para preencher o *RDO de hoje*, digite *oi*.\\\\n' +
    'Depois escolha o numero do topico.\\\\n\\\\n' +
    '_ConstruDataMax Gestao 360_';
}

await responder.call(this, fallbackMsg);
return [{ json: { ignorar: true, motivo: 'Fallback guia - texto livre de ' + nomeUser } }];
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
