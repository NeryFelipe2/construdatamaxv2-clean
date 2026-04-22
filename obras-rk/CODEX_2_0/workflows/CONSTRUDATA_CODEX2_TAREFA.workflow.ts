import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : CONSTRUDATA_CODEX2_TAREFA
// Nodes   : 9  |  Connections: 8
//
// NODE INDEX
// ------------------------------------------------------------------
// Property name                    Node type (short)         Flags
// WebhookTarefa                    webhook
// ParseTarefa                      code
// BuscarResponsavel                httpRequest
// MontarTarefa                     code
// InsertSupabase                   httpRequest
// ConfirmarDelegante               httpRequest
// TemTelResp                       if
// NotificarResponsavel             httpRequest
// ResponseOk                       respondToWebhook
//
// ROUTING MAP
// ------------------------------------------------------------------
// WebhookTarefa
//   -> ParseTarefa
//     -> BuscarResponsavel
//       -> MontarTarefa
//         -> InsertSupabase
//           -> ConfirmarDelegante
//             -> ResponseOk
//         -> TemTelResp
//           -> NotificarResponsavel
// </workflow-map>

@workflow({
    id: 'codex2Task04226',
    name: 'CONSTRUDATA_CODEX2_TAREFA',
    active: false,
})
export class ConstrudataCodex2TarefaWorkflow {
    @node({
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 300],
    })
    WebhookTarefa = {
        httpMethod: 'POST',
        path: 'codex2-sub-tarefa',
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
        jsCode: "const input = $json.body || $json;\nconst phone = input.phone || '';\nconst rawText = (input.text || '').replace(/^@tarefa\\s*/i, '').trim();\nconst delegante = input.user_nome || 'Desconhecido';\nconst deleganteId = input.user_id || null;\nconst parts = rawText.split(/\\s+/);\nlet responsavelHint = '';\nlet descricao = rawText;\nif (parts.length >= 2) {\n  responsavelHint = parts[0].replace('@', '');\n  descricao = parts.slice(1).join(' ');\n}\nreturn { phone, delegante, deleganteId, responsavelHint, descricao, textoOriginal: rawText };",
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
        jsCode: "const parsed = $node['Parse Tarefa'].json;\nconst rawResp = $json;\nconst resp = Array.isArray(rawResp) ? rawResp[0] : rawResp;\nconst responsavel = resp && resp.nome ? resp.nome : parsed.responsavelHint;\nconst responsavelTel = resp && resp.telefone_whatsapp ? resp.telefone_whatsapp : null;\nreturn {\n  delegante: parsed.delegante,\n  deleganteId: parsed.deleganteId,\n  delegantePhone: parsed.phone,\n  responsavel,\n  responsavelTel,\n  descricao: parsed.descricao,\n  tipo: 'campo',\n  status: 'pendente',\n  prioridade: 'media',\n  origem: 'whatsapp-codex2',\n};",
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
                { name: 'Content-Type', value: 'application/json' },
                { name: 'Prefer', value: 'return=minimal' },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={"descricao":"{{ $json.descricao }}","responsavel":"{{ $json.responsavel }}","responsavel_phone":"{{ $json.responsavelTel }}","delegante":"{{ $json.delegante }}","delegante_phone":"{{ $json.delegantePhone }}","tipo":"{{ $json.tipo }}","status":"{{ $json.status }}","prioridade":"{{ $json.prioridade }}","origem":"{{ $json.origem }}"}',
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
        jsonBody: "={{ JSON.stringify({ number: $node['Montar Tarefa'].json.delegantePhone, text: 'CODEX tarefa criada.\\n\\nDescricao: ' + $node['Montar Tarefa'].json.descricao + '\\nResponsavel: ' + $node['Montar Tarefa'].json.responsavel + '\\nStatus: pendente' }) }}",
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
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
            conditions: [
                {
                    id: 'hasTel',
                    leftValue: "={{ $node['Montar Tarefa'].json.responsavelTel }}",
                    rightValue: '',
                    operator: { type: 'string', operation: 'isNotEmpty' },
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
        jsonBody: "={{ JSON.stringify({ number: $node['Montar Tarefa'].json.responsavelTel, text: 'Nova tarefa CODEX para voce.\\n\\n' + $node['Montar Tarefa'].json.descricao + '\\n\\nDelegada por: ' + $node['Montar Tarefa'].json.delegante + '\\nPrioridade: ' + $node['Montar Tarefa'].json.prioridade }) }}",
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
        responseBody: '={"status":"ok","tarefa":"{{ $node[\'Montar Tarefa\'].json.descricao }}","responsavel":"{{ $node[\'Montar Tarefa\'].json.responsavel }}","version":"CODEX"}',
        options: {},
    };

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
