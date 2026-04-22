import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : CONSTRUDATA_MASTER_V3_CORRIGIDO
// Nodes   : 12  |  Connections: 11
//
// NODE INDEX
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Property name                    Node type (short)         Flags
// Webhook                            webhook
// Extract                            code
// LookupContato                      httpRequest
// GetState                           httpRequest
// Decide                             code
// IsRdo                              if
// IsFinanceiro                       if
// CallRdo                            httpRequest
// CallFinanceiro                     httpRequest
// SendHelp                           httpRequest
// IsTarefa                           if
// CallTarefa                         httpRequest
//
// ROUTING MAP
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Webhook
//    â†’ Extract
//      â†’ LookupContato
//        â†’ GetState
//          â†’ Decide
//            â†’ IsRdo
//              â†’ CallRdo
//            â†’ IsFinanceiro
//              â†’ CallFinanceiro
//            â†’ IsTarefa
//              â†’ CallTarefa
//             .out(1) â†’ SendHelp
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '9qCZcL1CtV3rpRaZ',
    name: 'CONSTRUDATA_MASTER_V3_CORRIGIDO',
    active: true,
    settings: { executionOrder: 'v1', binaryMode: 'separate' },
})
export class ConstrudataMasterV3CorrigidoWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1200, 304],
    })
    Webhook = {
        httpMethod: 'POST',
        path: 'whatsapp-master',
        options: {},
    };

    @node({
        name: 'Extract',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-960, 304],
    })
    Extract = {
        jsCode: "const body=$input.all();\nif(body.length===0)return[];\n\nlet res=[];\nfor(const b of body){\n  const raw=b.json;\n  // Desempacota: webhook n8n envolve em {headers,params,query,body}\n  const j=raw.body||raw;\n  // Filtro seguro: sÃ³ descarta eventos explÃ­citos de update/ack/delete\n  if(j.event && (j.event==='messages.update'||j.event==='messages.delete'||j.event==='send.message')) continue;\n  const msg=j.data||j;\n  const remoteJid=msg.key?.remoteJid||msg.remoteJid;\n  if(!remoteJid||remoteJid.includes('@g.us'))continue;\n  \n  const fromMe=msg.key?.fromMe||false;\n  let phone = remoteJid.replace('@s.whatsapp.net','').split('@')[0];\n  \n  let text='';\n  if(msg.message?.conversation) text=msg.message.conversation;\n  else if(msg.message?.extendedTextMessage?.text) text=msg.message.extendedTextMessage.text;\n  else if(msg.message?.imageMessage?.caption) text=msg.message.imageMessage.caption;\n  \n  // SÃ³ ignora mensagens do prÃ³prio bot (contÃ©m assinatura)\n  if(fromMe && text.includes('Construdata - powered by')) {\n    continue;\n  }\n  \n  const hasImage=!!msg.message?.imageMessage;\n  let imageBase64='';\n  if(hasImage&&msg.message.imageMessage.base64) imageBase64=msg.message.imageMessage.base64;\n  \n  if(text||hasImage){\n    res.push({phone,text,hasImage,imageBase64,raw:msg,fromMe});\n  }\n}\nreturn res;",
    };

    @node({
        name: 'Lookup Contato',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [-720, 192],
    })
    LookupContato = {
        url: "=https://vblfdikfobsirwpdnybw.supabase.co/rest/v1/contatos?select=id,nome,cargo,projeto_id,frente_id,telefone_whatsapp&or=(telefone_whatsapp.eq.{{ $json.phone }},telefone_whatsapp.eq.{{ (() => { const p = $json.phone; if(p.length===12 && p.startsWith('55')) { return p.slice(0,4)+'9'+p.slice(4); } return p; })() }})",
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
        name: 'Get State',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [-720, 432],
    })
    GetState = {
        url: '=https://vblfdikfobsirwpdnybw.supabase.co/rest/v1/user_state?phone_number=eq.{{ $node.Extract.json.phone }}',
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
        name: 'Decide',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-480, 304],
    })
    Decide = {
        jsCode: "const st=$json;const ex=$('Extract').first().json;const phone=ex.phone;const text=ex.text;const hasImage=ex.hasImage;const b64=ex.imageBase64;const raw=ex.raw;\n\n// Get user identity from contatos\nconst contatoRaw=$('Lookup Contato').first().json;\nlet contato=null;\nif(contatoRaw && contatoRaw.nome) { contato = contatoRaw; }\nelse if(Array.isArray(contatoRaw)&&contatoRaw.length>0) { contato = contatoRaw[0]; }\n\n// Se o numero nÃ£o estiver na base de dados (lista de contatos), ignora completamente\nif(!contato || !contato.nome) {\n  return [];\n}\n\n// Get current state\nconst stArr=Array.isArray(st)?st:(st?[st]:[]);\nconst cur=stArr.length>0&&stArr[0].current_step?stArr[0]:null;\n\nconst user={phone,nome:contato.nome,cargo:contato.cargo,projeto_id:contato.projeto_id,frente_id:contato.frente_id};\n\nif(cur&&cur.current_step&&cur.current_step!=='idle'&&cur.current_step!=='finished'){\n  const f=cur.current_flow||'rdo';\n  return{action:'continue_'+f,phone,text,hasImage,imageBase64:b64,raw,state:cur.current_step,data:cur.flow_data||{},user};\n}\nconst tl=text.toLowerCase().trim();\nif(tl.includes('#rdo') || tl==='1' || tl==='7' || tl==='8')return{action:'rdo',phone,text,hasImage,imageBase64:b64,raw,state:'start_rdo',data:{},user};\nif(tl.includes('#gasto')||tl.includes('#financeiro')||hasImage||tl==='11')return{action:'fin',phone,text,hasImage,imageBase64:b64,raw,state:'start_financeiro',data:{},user};\nif(tl.includes('#tarefa')||tl.includes('@tarefa')||['9','10','12','13','14','15','16'].includes(tl))return{action:'tarefa',phone,text,hasImage,imageBase64:b64,raw,state:'start_tarefa',data:{},user};\nif(tl.includes('#ajuda')||tl.includes('#help'))return{action:'help',phone,text,hasImage,imageBase64:b64,raw,state:'idle',data:{},user};\nreturn{action:'help',phone,text,hasImage,imageBase64:b64,raw,state:'idle',data:{},user};",
    };

    @node({
        name: 'Is RDO?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [-240, 112],
    })
    IsRdo = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
            },
            conditions: [
                {
                    id: 'rdo',
                    leftValue: '={{ $json.action }}',
                    rightValue: 'rdo',
                    operator: {
                        type: 'string',
                        operation: 'contains',
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        name: 'Is Financeiro?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [-240, 400],
    })
    IsFinanceiro = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
            },
            conditions: [
                {
                    id: 'fin',
                    leftValue: '={{ $json.action }}',
                    rightValue: 'fin',
                    operator: {
                        type: 'string',
                        operation: 'contains',
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        name: 'Call RDO',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [0, 0],
    })
    CallRdo = {
        method: 'POST',
        url: 'http://rk-n8n:5678/webhook/sub-rdo',
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
            '={{ JSON.stringify({phone:$json.phone,text:$json.text,state:$json.state,data:$json.data,user:$json.user}) }}',
        options: {},
    };

    @node({
        name: 'Call Financeiro',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [0, 304],
    })
    CallFinanceiro = {
        method: 'POST',
        url: 'http://rk-n8n:5678/webhook/construdata-financeiro-v2',
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
            '={{ JSON.stringify({phone:$json.phone,text:$json.text,hasImage:$json.hasImage,imageBase64:$json.imageBase64,raw:$json.raw,state:$json.state,data:$json.data,user:$json.user}) }}',
        options: {},
    };

    @node({
        name: 'Send Help',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [0, 608],
    })
    SendHelp = {
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
            '={"number":"{{ $json.phone }}","text":"ðŸ¤– ConstruDataMax GestÃ£o 360\\nOlÃ¡ {{ $json.user.nome }}!\\n\\nðŸ“Š OpÃ§Ãµes de Comando:\\n1ï¸âƒ£ Status RDO Hoje\\n2ï¸âƒ£ Equipe e Contatos\\n3ï¸âƒ£ Projetos Ativos\\n4ï¸âƒ£ Dashboard Consolidado\\n5ï¸âƒ£ Reenviar CobranÃ§a (Alerta Geral)\\n6ï¸âƒ£ Falar com InteligÃªncia Artificial\\n7ï¸âƒ£ Cobrar RDO (Dispara formulÃ¡rio)\\n8ï¸âƒ£ Meu RDO Diretor (SupervisÃ£o)\\n9ï¸âƒ£ Lembrar Tarefas (Cobra diretores)\\nðŸ”Ÿ Criar Tarefas (Guia de Uso)\\n1ï¸âƒ£1ï¸âƒ£ Plano de Custos (Financeiro)\\n1ï¸âƒ£2ï¸âƒ£ Tarefas ConsÃ³rcio (Delega por setor)\\n1ï¸âƒ£3ï¸âƒ£ Enviar Tarefa por Pessoa\\n1ï¸âƒ£4ï¸âƒ£ Enviar Tarefa Ã  Diretoria\\n1ï¸âƒ£5ï¸âƒ£ Enviar Tarefa aos Engenheiros\\n1ï¸âƒ£6ï¸âƒ£ Enviar Tarefa por Setor\\n\\nâ–¶ï¸ Digite o nÃºmero da opÃ§Ã£o (ex: 1) ou use os @comandos diretamente.\\nðŸ”— https://construdatamaxv2-clean.vercel.app\\n\\n_Construdata - powered by FCN ConstruÃ§Ãµes e Saneamento_"}',
        options: {},
    };

    @node({
        name: 'Is Tarefa?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [-240, 704],
    })
    IsTarefa = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
            },
            conditions: [
                {
                    id: 'tar',
                    leftValue: '={{ $json.action }}',
                    rightValue: 'tarefa',
                    operator: {
                        type: 'string',
                        operation: 'contains',
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        name: 'Call Tarefa',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [0, 704],
    })
    CallTarefa = {
        method: 'POST',
        url: 'http://rk-n8n:5678/webhook/sub-tarefa',
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
            '={{ JSON.stringify({phone:$json.phone,text:$json.text,user_nome:$json.user.nome,user_id:$json.user.projeto_id}) }}',
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Webhook.out(0).to(this.Extract.in(0));
        this.Extract.out(0).to(this.LookupContato.in(0));
        this.LookupContato.out(0).to(this.GetState.in(0));
        this.GetState.out(0).to(this.Decide.in(0));
        this.Decide.out(0).to(this.IsRdo.in(0));
        this.Decide.out(0).to(this.IsFinanceiro.in(0));
        this.Decide.out(0).to(this.IsTarefa.in(0));
        this.IsRdo.out(0).to(this.CallRdo.in(0));
        this.IsFinanceiro.out(0).to(this.CallFinanceiro.in(0));
        this.IsTarefa.out(0).to(this.CallTarefa.in(0));
        this.IsTarefa.out(1).to(this.SendHelp.in(0));
    }
}
