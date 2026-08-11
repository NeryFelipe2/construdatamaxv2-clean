import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : CONSTRUDATA_FINANCEIRO_AI
// Nodes   : 8  |  Connections: 8
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookFinanceiro                  webhook
// PrepareImage                       code
// GeminiOcr                          httpRequest
// ParseOutput                        code
// SaveState                          httpRequest
// WasParsed                          if
// SaveFluxoCaixa                     httpRequest
// ConfirmUser                        httpRequest
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookFinanceiro
//    → PrepareImage
//      → GeminiOcr
//        → ParseOutput
//          → SaveState
//          → WasParsed
//            → SaveFluxoCaixa
//            → ConfirmUser
//           .out(1) → ConfirmUser (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'ccc33333-3333-4333-b333-333333333333',
    name: 'CONSTRUDATA_FINANCEIRO_AI',
    active: true,
    settings: {
        executionOrder: 'v1',
        binaryMode: 'separate',
        timeSavedMode: 'fixed',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
    },
})
export class ConstrudataFinanceiroAiWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        name: 'Webhook Financeiro',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 300],
    })
    WebhookFinanceiro = {
        httpMethod: 'POST',
        path: 'construdata-financeiro-v2',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        name: 'Prepare Image',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 300],
    })
    PrepareImage = {
        jsCode: "const input=$json.body||$json;\nconst phone=input.phone||'';\nconst user=input.user||{nome:'Desconhecido'};\nconst raw=input.raw||{};\nconst img=raw.message?.imageMessage||{};\nconst b64=img.base64||input.imageBase64||'';\nconst url=img.url||'';\nconst cap=img.caption||'';\nreturn{phone,base64:b64,mediaUrl:url,caption:cap,user};",
    };

    @node({
        name: 'Gemini OCR',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [480, 300],
    })
    GeminiOcr = {
        method: 'POST',
        url: '=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyBp7qA72UDff0MzqfwRSinyWbo92p17JF8',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Content-Type',
                    value: 'application/json',
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={{ JSON.stringify({contents:[{parts:[{text:\'Analise esta imagem de comprovante fiscal e extraia um JSON com estes campos exatos:\\n{\\n  "valor": (number, valor total em reais),\\n  "data": "YYYY-MM-DD",\\n  "fornecedor": "nome do estabelecimento",\\n  "cnpj_cpf": "CNPJ ou CPF do fornecedor se visível",\\n  "descricao": "descrição dos itens/serviços",\\n  "forma_pagamento": "PIX|Cartão|Dinheiro|Boleto|Transferência",\\n  "plano_conta": "MAT|MDO|DSL|ALM|AEQ|OUT",\\n  "plano_conta_desc": "Material de Construção|Mão de Obra|Diesel / Combustível|Alimentação|Aluguel de Equipamento|Outros"\\n}\\n\\nCódigos de plano_conta:\\nMAT = Material de Construção\\nMDO = Mão de Obra\\nDSL = Diesel / Combustível\\nALM = Alimentação / VR / VA\\nAEQ = Aluguel de Equipamento\\nOUT = Outros\\n\\nRetorne APENAS o JSON, sem markdown.\'},{inline_data:{mime_type:\'image/jpeg\',data:$json.base64}}]}]}) }}',
        options: {},
    };

    @node({
        name: 'Parse Output',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [720, 300],
    })
    ParseOutput = {
        jsCode: "const phone=$node['Prepare Image'].json.phone;\nconst user=$node['Prepare Image'].json.user;\ntry{\n  const r=$json.candidates?.[0]?.content?.parts?.[0]?.text||'{}';\n  const m=r.match(/\\{[^{}]*\\}/s);\n  const d=m?JSON.parse(m[0]):{};  \n\n  // Map plano_conta to centro_custo\n  const ccMap={'MAT':'OSA','MDO':'OSA','DSL':'OSA','ALM':'OSA','AEQ':'OSA','OUT':'RKS'};\n  d.centro_custo=d.centro_custo||ccMap[d.plano_conta]||'RKS';\n  \n  const msg='🔍 *Recibo Detectado!*\\\\n\\\\n💰 Valor: R$ '+(d.valor||'?')+'\\\\n📅 Data: '+(d.data||'?')+'\\\\n🏢 Fornecedor: '+(d.fornecedor||'?')+'\\\\n📋 CNPJ: '+(d.cnpj_cpf||'-')+'\\\\n📂 Conta: '+(d.plano_conta_desc||d.plano_conta||'Outros')+'\\\\n💳 Pagamento: '+(d.forma_pagamento||'-')+'\\\\n📝 '+(d.descricao||'-')+'\\\\n\\\\n✅ Confirma? *Sim* ou *Não*';\n  return{phone,data:d,message:msg,parsed:true,user,ocr_raw:r};\n}catch(e){\n  return{phone,data:{},message:'⚠️ Não consegui ler o recibo. Tente com foto mais nítida.',parsed:false,user,ocr_raw:''};\n}",
    };

    @node({
        name: 'Save State',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [960, 200],
    })
    SaveState = {
        method: 'POST',
        url: 'https://vblfdikfobsirwpdnybw.supabase.co/rest/v1/user_state',
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
                    value: 'resolution=merge-duplicates',
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({phone_number:$json.phone,current_flow:'financeiro',current_step:'waiting_confirm_gasto',flow_data:{...($json.data),ocr_raw:$json.ocr_raw}}) }}",
        options: {},
    };

    @node({
        name: 'Was Parsed?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [960, 450],
    })
    WasParsed = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
            },
            conditions: [
                {
                    id: 'parsed',
                    leftValue: "={{ $node['Parse Output'].json.parsed }}",
                    rightValue: 'true',
                    operator: {
                        type: 'string',
                        operation: 'equals',
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        name: 'Save Fluxo Caixa',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [1200, 350],
    })
    SaveFluxoCaixa = {
        method: 'POST',
        url: 'https://vblfdikfobsirwpdnybw.supabase.co/rest/v1/fluxo_caixa',
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
                    value: 'return=representation',
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({tipo:'saida',centro_custo:$node['Parse Output'].json.data.centro_custo||'RKS',plano_conta:$node['Parse Output'].json.data.plano_conta||'OUT',plano_conta_desc:$node['Parse Output'].json.data.plano_conta_desc||'Outros',valor:$node['Parse Output'].json.data.valor||0,descricao:$node['Parse Output'].json.data.descricao||'',fornecedor:$node['Parse Output'].json.data.fornecedor||'',cnpj_cpf:$node['Parse Output'].json.data.cnpj_cpf||'',forma_pagamento:$node['Parse Output'].json.data.forma_pagamento||'',data:$node['Parse Output'].json.data.data||new Date().toISOString().split('T')[0],mes:new Date().getMonth()+1,ano:new Date().getFullYear(),lancado_por:$node['Parse Output'].json.user.nome||'WhatsApp',telefone:$node['Parse Output'].json.phone,ocr_raw:$node['Parse Output'].json.ocr_raw||'',status:'pendente'}) }}",
        options: {},
    };

    @node({
        name: 'Confirm User',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [1200, 550],
    })
    ConfirmUser = {
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
            '={"number":"{{ $node[\'Parse Output\'].json.phone }}","textMessage":{"text":"{{ $node[\'Parse Output\'].json.message }}"}}',
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WebhookFinanceiro.out(0).to(this.PrepareImage.in(0));
        this.PrepareImage.out(0).to(this.GeminiOcr.in(0));
        this.GeminiOcr.out(0).to(this.ParseOutput.in(0));
        this.ParseOutput.out(0).to(this.SaveState.in(0));
        this.ParseOutput.out(0).to(this.WasParsed.in(0));
        this.WasParsed.out(0).to(this.SaveFluxoCaixa.in(0));
        this.WasParsed.out(0).to(this.ConfirmUser.in(0));
        this.WasParsed.out(1).to(this.ConfirmUser.in(0));
    }
}
