import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : CONSTRUDATA_TAREFA_WHATSAPP
// Nodes   : 9  |  Connections: 8
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookTarefa                      webhook
// ParseTarefa                        code
// BuscarResponsavel                  httpRequest
// MontarTarefa                       code
// InsertSupabase                     httpRequest
// ConfirmarDelegante                 httpRequest
// TemTelResp                         if
// NotificarResponsavel               httpRequest
// ResponseOk                         respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTarefa
//    → ParseTarefa
//      → BuscarResponsavel
//        → MontarTarefa
//          → InsertSupabase
//            → ConfirmarDelegante
//              → ResponseOk
//          → TemTelResp
//            → NotificarResponsavel
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'fff66666-6666-4666-b666-666666666666',
    name: 'CONSTRUDATA_TAREFA_WHATSAPP',
    active: true,
})
export class ConstrudataTarefaWhatsappWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        name: 'Webhook Tarefa',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 300],
    })
    WebhookTarefa = {
        httpMethod: 'POST',
        path: 'sub-tarefa',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        name: 'Parse Tarefa',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 300],
    })
    ParseTarefa = {
        jsCode: "// Input: { phone, text, user_nome, user_id }\n// Formato esperado: \"@tarefa [responsavel] [descricao]\"\nconst input = $json.body || $json;\nconst phone = input.phone || '';\nconst text = (input.text || '').replace(/^@tarefa\\s*/i, '').trim();\nconst delegante = input.user_nome || 'Desconhecido';\nconst deleganteId = input.user_id || null;\n\n// Tentar separar responsável (primeira palavra) e descrição (resto)\nconst parts = text.split(/\\s+/);\nlet responsavelHint = '';\nlet descricao = text;\n\nif (parts.length >= 2) {\n  responsavelHint = parts[0]; // ex: \"Mateus\" ou \"@mateus\"\n  descricao = parts.slice(1).join(' ');\n} else {\n  responsavelHint = '';\n  descricao = text;\n}\n\n// Limpar @ do responsável\nresponsavelHint = responsavelHint.replace('@', '');\n\nreturn {\n  phone,\n  delegante,\n  deleganteId,\n  responsavelHint,\n  descricao,\n  textoOriginal: text\n};",
    };

    @node({
        name: 'Buscar Responsavel',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [480, 300],
    })
    BuscarResponsavel = {
        method: 'GET',
        url: '=https://vblfdikfobsirwpdnybw.supabase.co/rest/v1/contatos?select=id,nome,telefone_whatsapp,cargo&nome=ilike.*{{ $json.responsavelHint }}*&limit=1',
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
        name: 'Montar Tarefa',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [720, 300],
    })
    MontarTarefa = {
        jsCode: "const parseData = $node['Parse Tarefa'].json;\nconst respRaw = $json;\nconst resp = Array.isArray(respRaw) ? respRaw[0] : respRaw;\n\nconst responsavelNome = resp && resp.nome ? resp.nome : parseData.responsavelHint;\nconst responsavelTel = resp && resp.telefone_whatsapp ? resp.telefone_whatsapp : null;\n\nreturn {\n  delegante: parseData.delegante,\n  deleganteId: parseData.deleganteId,\n  delegantePhone: parseData.phone,\n  responsavel: responsavelNome,\n  responsavelTel,\n  descricao: parseData.descricao,\n  tipo: 'campo',\n  status: 'pendente',\n  prioridade: 'media',\n  origem: 'whatsapp'\n};",
    };

    @node({
        name: 'Insert Supabase',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [960, 200],
    })
    InsertSupabase = {
        method: 'POST',
        url: 'https://vblfdikfobsirwpdnybw.supabase.co/rest/v1/tarefas',
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
                {
                    name: 'Content-Type',
                    value: 'application/json',
                },
                {
                    name: 'Prefer',
                    value: 'return=minimal',
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={"descricao":"{{ $json.descricao }}","responsavel":"{{ $json.responsavel }}","delegante":"{{ $json.delegante }}","tipo":"{{ $json.tipo }}","status":"{{ $json.status }}","prioridade":"{{ $json.prioridade }}","origem":"{{ $json.origem }}"}',
        options: {},
    };

    @node({
        name: 'Confirmar Delegante',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [1200, 200],
    })
    ConfirmarDelegante = {
        method: 'POST',
        url: 'http://rk-evolution:8080/message/sendText/construdata-felipe',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'apikey',
                    value: 'construdata2026',
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={"number":"{{ $node[\'Montar Tarefa\'].json.delegantePhone }}","textMessage":{"text":"✅ *Tarefa criada!*\\n\\n📋 {{ $node[\'Montar Tarefa\'].json.descricao }}\\n👤 Responsável: {{ $node[\'Montar Tarefa\'].json.responsavel }}\\n🔴 Status: pendente"}}',
        options: {},
    };

    @node({
        name: 'Tem Tel Resp?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [960, 400],
    })
    TemTelResp = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
            },
            conditions: [
                {
                    id: 'hasTel',
                    leftValue: "={{ $node['Montar Tarefa'].json.responsavelTel }}",
                    rightValue: '',
                    operator: {
                        type: 'string',
                        operation: 'isNotEmpty',
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        name: 'Notificar Responsavel',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [1200, 400],
    })
    NotificarResponsavel = {
        method: 'POST',
        url: 'http://rk-evolution:8080/message/sendText/construdata-felipe',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'apikey',
                    value: 'construdata2026',
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={"number":"{{ $node[\'Montar Tarefa\'].json.responsavelTel }}","textMessage":{"text":"📋 *Nova tarefa para você!*\\n\\n{{ $node[\'Montar Tarefa\'].json.descricao }}\\n\\nDelegada por: {{ $node[\'Montar Tarefa\'].json.delegante }}\\nPrioridade: {{ $node[\'Montar Tarefa\'].json.prioridade }}\\n\\nQuando concluir, envie *#feito* aqui."}}',
        options: {},
    };

    @node({
        name: 'Response OK',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1440, 200],
    })
    ResponseOk = {
        respondWith: 'json',
        responseBody:
            '={"status":"ok","tarefa":"{{ $node[\'Montar Tarefa\'].json.descricao }}","responsavel":"{{ $node[\'Montar Tarefa\'].json.responsavel }}"}',
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WebhookTarefa.out(0).to(this.ParseTarefa.in(0));
        this.ParseTarefa.out(0).to(this.BuscarResponsavel.in(0));
        this.BuscarResponsavel.out(0).to(this.MontarTarefa.in(0));
        this.MontarTarefa.out(0).to(this.InsertSupabase.in(0));
        this.MontarTarefa.out(0).to(this.TemTelResp.in(0));
        this.InsertSupabase.out(0).to(this.ConfirmarDelegante.in(0));
        this.ConfirmarDelegante.out(0).to(this.ResponseOk.in(0));
        this.TemTelResp.out(0).to(this.NotificarResponsavel.in(0));
    }
}
