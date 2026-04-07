import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Webhook RDO WhatsApp
// Nodes   : 7  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ReceberMensagemWhatsapp            webhook
// InterpretarMensagem                code
// DadosValidos                       if
// MontarRdoEstruturado               code
// SalvarNaPlataforma                 httpRequest
// ResponderSucesso                   respondToWebhook
// ResponderErro                      respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ReceberMensagemWhatsapp
//    → InterpretarMensagem
//      → DadosValidos
//        → MontarRdoEstruturado
//          → SalvarNaPlataforma
//            → ResponderSucesso
//       .out(1) → ResponderErro
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'cC3ofuHlwdtj8Idb',
    name: 'Webhook RDO WhatsApp',
    active: false,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class WebhookRdoWhatsappWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '27118a86-1241-4c5c-8b56-8b6512988280',
        webhookId: '30d04059-1ad1-4df6-8344-43f1b2a5067d',
        name: 'Receber Mensagem WhatsApp',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 300],
    })
    ReceberMensagemWhatsapp = {
        path: 'rdo-whatsapp',
        httpMethod: 'POST',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: '13d8ad3a-0bc0-4aa7-9589-ccf241e38a00',
        name: 'Interpretar Mensagem',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    InterpretarMensagem = {
        language: 'javaScript',
        jsCode: `
const body = $input.first().json.body || $input.first().json;
const mensagem = body.message || body.text || body.Body || '';
const telefone = body.phone || body.from || body.From || '';
const timestamp = new Date().toISOString();

// Parse estruturado: espera formato "CAMPO: VALOR" ou respostas numeradas
const lines = mensagem.split('\\n').map(l => l.trim()).filter(Boolean);
const dados = {};

for (const line of lines) {
  const match = line.match(/^(\\d+)[.\\-\\)\\s]+(.+)/);
  if (match) {
    dados[\`resposta_\${match[1]}\`] = match[2].trim();
  }
  
  const kvMatch = line.match(/^(.+?):\\s*(.+)/);
  if (kvMatch) {
    const key = kvMatch[1].toLowerCase()
      .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
      .replace(/\\s+/g, '_');
    dados[key] = kvMatch[2].trim();
  }
}

// Mapear campos do RDO
const rdoData = {
  telefone,
  timestamp,
  mensagem_original: mensagem,
  projeto: dados.projeto || dados.resposta_1 || 'Não informado',
  nucleo: dados.nucleo || dados.resposta_2 || 'Não informado',
  frente: dados.frente || dados.resposta_3 || 'Não informado',
  nota_servico: dados.nota_servico || dados.ns || dados.resposta_4 || 'Não informado',
  atividade: dados.atividade || dados.resposta_5 || 'Não informado',
  quantidade: dados.quantidade || dados.resposta_6 || '0',
  unidade: dados.unidade || dados.resposta_7 || 'm',
  equipe_qtd: dados.equipe || dados.resposta_8 || '0',
  equipamento: dados.equipamento || dados.resposta_9 || 'Nenhum',
  clima: dados.clima || dados.resposta_10 || 'Bom',
  observacao: dados.observacao || dados.resposta_11 || '',
  valido: !!(dados.projeto || dados.resposta_1) && !!(dados.atividade || dados.resposta_5),
};

return [{ json: rdoData }];
`,
    };

    @node({
        id: 'a70cfeec-5f29-4d81-83df-e9ca735b4dfb',
        name: 'Dados Válidos?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [500, 300],
    })
    DadosValidos = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
            },
            combinator: 'and',
            conditions: [
                {
                    id: 'valido-check',
                    leftValue: '={{ $json.valido }}',
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
        id: '6845e5c2-17f8-4e52-ae71-8769bf08588e',
        name: 'Montar RDO Estruturado',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [750, 200],
    })
    MontarRdoEstruturado = {
        language: 'javaScript',
        jsCode: `
const d = $input.first().json;
const hoje = new Date();

const rdo = {
  id: \`RDO-\${hoje.getFullYear()}\${String(hoje.getMonth()+1).padStart(2,'0')}\${String(hoje.getDate()).padStart(2,'0')}-\${Date.now().toString(36)}\`,
  data: hoje.toISOString().split('T')[0],
  hora_registro: hoje.toTimeString().split(' ')[0],
  contrato: 'CT 11481051',
  apontador: d.telefone,
  projeto: d.projeto,
  nucleo: d.nucleo,
  frente_trabalho: d.frente,
  nota_servico: d.nota_servico,
  atividade: {
    descricao: d.atividade,
    quantidade: parseFloat(d.quantidade) || 0,
    unidade: d.unidade,
  },
  recursos: {
    equipe_quantidade: parseInt(d.equipe_qtd) || 0,
    equipamento: d.equipamento,
  },
  clima: d.clima,
  observacao: d.observacao,
  status: 'registrado',
  origem: 'whatsapp',
  mensagem_original: d.mensagem_original,
};

const confirmacao = [
  '✅ *RDO REGISTRADO COM SUCESSO*',
  '━━━━━━━━━━━━━━━━━━━━━━━',
  \`📋 ID: \${rdo.id}\`,
  \`📅 Data: \${rdo.data}\`,
  \`🏗️ Projeto: \${rdo.projeto}\`,
  \`📍 Núcleo: \${rdo.nucleo}\`,
  \`📝 NS: \${rdo.nota_servico}\`,
  \`⚒️ Atividade: \${rdo.atividade.descricao}\`,
  \`📏 Qtd: \${rdo.atividade.quantidade} \${rdo.atividade.unidade}\`,
  \`👷 Equipe: \${rdo.recursos.equipe_quantidade} pessoas\`,
  \`🌤️ Clima: \${rdo.clima}\`,
  '',
  'Obrigado pelo registro! 🚀',
].join('\\n');

return [{ json: { rdo, confirmacao } }];
`,
    };

    @node({
        id: '1e785d2f-ddf9-4b76-9eec-67f5ed20cca5',
        name: 'Salvar na Plataforma',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1000, 200],
    })
    SalvarNaPlataforma = {
        url: 'https://construdatamaxv2-clean.vercel.app/api/rdo/register',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify($json.rdo) }}',
        options: {},
    };

    @node({
        id: '738e44f2-a3cc-43ce-9bc6-184e80ec4b9c',
        name: 'Responder Sucesso',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1250, 200],
    })
    ResponderSucesso = {
        respondWith: 'json',
        responseBody:
            '={{ JSON.stringify({ status: "ok", message: $("Montar RDO Estruturado").first().json.confirmacao, rdo_id: $("Montar RDO Estruturado").first().json.rdo.id }) }}',
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: '118a3253-10ad-443a-a07c-f7b1410bc563',
        name: 'Responder Erro',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [750, 450],
    })
    ResponderErro = {
        respondWith: 'json',
        responseBody:
            '={{ JSON.stringify({ status: "error", message: "❌ Dados insuficientes. Envie pelo menos: Projeto e Atividade.\\n\\nFormato:\\nProjeto: SLNR Santos\\nAtividade: Assentamento DN200\\nQuantidade: 45\\nEquipe: 6" }) }}',
        options: {
            responseCode: 400,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ReceberMensagemWhatsapp.out(0).to(this.InterpretarMensagem.in(0));
        this.InterpretarMensagem.out(0).to(this.DadosValidos.in(0));
        this.DadosValidos.out(0).to(this.MontarRdoEstruturado.in(0));
        this.DadosValidos.out(1).to(this.ResponderErro.in(0));
        this.MontarRdoEstruturado.out(0).to(this.SalvarNaPlataforma.in(0));
        this.SalvarNaPlataforma.out(0).to(this.ResponderSucesso.in(0));
    }
}
