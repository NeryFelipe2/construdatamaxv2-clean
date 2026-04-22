import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : CONSTRUDATA_RDO_FINAL
// Nodes   : 6  |  Connections: 6
//
// NODE INDEX
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Property name                    Node type (short)         Flags
// WebhookRdo                         webhook
// RdoLogicEngine                     code
// UpdateState                        httpRequest
// IsFinished                         if
// SaveRdo                            httpRequest
// NotifyUser                         httpRequest
//
// ROUTING MAP
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// WebhookRdo
//    â†’ RdoLogicEngine
//      â†’ UpdateState
//        â†’ IsFinished
//          â†’ SaveRdo
//          â†’ NotifyUser
//         .out(1) â†’ NotifyUser (â†© loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'bbb22222-2222-4222-b222-222222222222',
    name: 'CONSTRUDATA_RDO_FINAL',
    active: true,
    settings: {
        executionOrder: 'v1',
        binaryMode: 'separate',
        timeSavedMode: 'fixed',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
    },
})
export class ConstrudataRdoFinalWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        name: 'Webhook RDO',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 300],
    })
    WebhookRdo = {
        httpMethod: 'POST',
        path: 'sub-rdo',
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        name: 'RDO Logic Engine',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 300],
    })
    RdoLogicEngine = {
        jsCode: "const input=$json.body||$json;\nconst phone=input.phone;\nconst text=(input.text||'').trim();\nconst st=input.state||'start_rdo';\nconst ud=input.data||{};\nconst user=input.user||{nome:'Desconhecido'};\n\n// UUIDs REAIS dos projetos (tabela `projetos`)\nconst PROJETOS={\n  '1':{n:'TATUI',id:'ec112c9a-1669-4287-8079-526d6940ce82'},\n  '2':{n:'OSASCO',id:'f3c6645b-347f-4382-b9c5-d103c27ec511'},\n  '3':{n:'SANTOS',id:'abe7f66c-c34c-4821-97e9-c3f5d02a64dd'},\n  '4':{n:'PARDINHO',id:'ec112c9a-1669-4287-8079-526d6940ce82'},\n  '5':{n:'BRASILIA',id:'2a28beec-0d0c-4a3a-a9db-54c80d3acf12'},\n  '6':{n:'RK SUB',id:'d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f90'}\n};\n\n// Match by keyword if not a number\nfunction findProject(txt) {\n  const t=txt.trim();\n  if(PROJETOS[t]) return PROJETOS[t];\n  const upper=t.toUpperCase();\n  for(const [k,v] of Object.entries(PROJETOS)) {\n    if(upper.includes(v.n) || v.n.includes(upper)) return v;\n  }\n  return {n:upper, id:null};\n}\n\nlet ns='',nf='rdo',msg='',sd={...ud};\n\nswitch(st){\n  case 'start_rdo':\n  case 'rdo_flow':\n    ns='waiting_obra';\n    msg='ðŸ‘· *Iniciando RDO*\\\\nQual a obra?\\\\n\\\\n1ï¸âƒ£ TATUI\\\\n2ï¸âƒ£ OSASCO\\\\n3ï¸âƒ£ SANTOS\\\\n4ï¸âƒ£ PARDINHO\\\\n5ï¸âƒ£ BRASILIA\\\\n6ï¸âƒ£ RK SUB';\n    break;\n  case 'waiting_obra':\n    const o=findProject(text);\n    sd.obra=o.n;\n    sd.project_id=o.id;\n    ns='waiting_clima';\n    msg='âœ… Obra: *'+o.n+'*\\\\n\\\\nâ˜ï¸ Clima?\\\\n1ï¸âƒ£ Sol 2ï¸âƒ£ Chuva 3ï¸âƒ£ Nublado 4ï¸âƒ£ Chuvisco';\n    break;\n  case 'waiting_clima':\n    const cl={'1':'bom','2':'chuva','3':'nublado','4':'chuvisco'};\n    sd.clima=cl[text]||text;\n    ns='waiting_equipe';\n    msg='ðŸ‘¥ Quantidade da equipe? (nÃºmero)';\n    break;\n  case 'waiting_equipe':\n    sd.equipe_total=parseInt(text)||0;\n    ns='waiting_producao';\n    msg='ðŸ“ ProduÃ§Ã£o em metros (ex: 12.5)?';\n    break;\n  case 'waiting_producao':\n    sd.producao_m=parseFloat(text)||0;\n    ns='waiting_turno';\n    msg='â° Turno?\\\\n1ï¸âƒ£ Diurno 2ï¸âƒ£ Noturno 3ï¸âƒ£ Integral';\n    break;\n  case 'waiting_turno':\n    const tn={'1':'Diurno','2':'Noturno','3':'Integral'};\n    sd.turno=tn[text]||text;\n    ns='waiting_atividades';\n    msg='ðŸ“ Quais atividades realizadas?';\n    break;\n  case 'waiting_atividades':\n    sd.atividades=text;\n    ns='finished';\n    nf='idle';\n    msg='âœ… *RDO Registrado com sucesso!*\\\\n\\\\nðŸ—ï¸ Obra: '+sd.obra+'\\\\nâ˜ï¸ Clima: '+sd.clima+'\\\\nðŸ‘¥ Equipe: '+sd.equipe_total+'\\\\nðŸ“ ProduÃ§Ã£o: '+sd.producao_m+'m\\\\nâ° Turno: '+sd.turno+'\\\\nðŸ“ '+sd.atividades+'\\\\n\\\\nðŸ‘· Apontador: '+user.nome;\n    break;\n  default:\n    ns='idle';\n    nf='idle';\n    msg='âš ï¸ Envie #rdo para recomeÃ§ar.';\n}\n\nreturn{phone,nextStep:ns,nextFlow:nf,message:msg,saveData:sd,user};",
    };

    @node({
        name: 'Update State',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [480, 300],
    })
    UpdateState = {
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
            '={{ JSON.stringify({phone_number:$json.phone,current_flow:$json.nextFlow,current_step:$json.nextStep,flow_data:$json.saveData}) }}',
        options: {},
    };

    @node({
        name: 'Is Finished?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [720, 300],
    })
    IsFinished = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
            },
            conditions: [
                {
                    id: 'done',
                    leftValue: "={{ $node['RDO Logic Engine'].json.nextStep }}",
                    rightValue: 'finished',
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
        name: 'Save RDO',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [960, 160],
    })
    SaveRdo = {
        method: 'POST',
        url: 'https://vblfdikfobsirwpdnybw.supabase.co/rest/v1/rdos',
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
            "={{ JSON.stringify({project_id:$node['RDO Logic Engine'].json.saveData.project_id,data:new Date().toISOString().split('T')[0],equipe_number:$node['RDO Logic Engine'].json.saveData.equipe_total,producao_m:$node['RDO Logic Engine'].json.saveData.producao_m||0,clima:$node['RDO Logic Engine'].json.saveData.clima,turno:$node['RDO Logic Engine'].json.saveData.turno||'Diurno',observacoes:$node['RDO Logic Engine'].json.saveData.atividades,apontador:($node['RDO Logic Engine'].json.user||{}).nome||'WhatsApp',status:'aberto',fotos:[]}) }}",
        options: {},
    };

    @node({
        name: 'Notify User',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.1,
        position: [960, 440],
    })
    NotifyUser = {
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
            '={"number":"{{ $node[\'RDO Logic Engine\'].json.phone }}","textMessage":{"text":"{{ $node[\'RDO Logic Engine\'].json.message }}"}}',
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WebhookRdo.out(0).to(this.RdoLogicEngine.in(0));
        this.RdoLogicEngine.out(0).to(this.UpdateState.in(0));
        this.UpdateState.out(0).to(this.IsFinished.in(0));
        this.IsFinished.out(0).to(this.SaveRdo.in(0));
        this.IsFinished.out(0).to(this.NotifyUser.in(0));
        this.IsFinished.out(1).to(this.NotifyUser.in(0));
    }
}
