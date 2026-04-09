import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Cobrança Matinal — TAREFAS DIRETORES
// Nodes   : 3  |  Connections: 2
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// CronJob7h                          scheduleTrigger
// DefinirCobrancas                   code
// DispararWhatsappEvolutionApi       httpRequest
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// CronJob7h
//    → DefinirCobrancas
//      → DispararWhatsappEvolutionApi
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'Nt0wfvxFL7hAWWvU',
    name: 'Cobrança Matinal — TAREFAS DIRETORES',
    active: true,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class CobrancaMatinalTarefasDiretoresWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '15980f05-92bb-42be-98ce-cfb2e3ba75ec',
        name: 'Cron Job 7h',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.1,
        position: [0, 0],
    })
    CronJob7h = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 7 * * 1-6',
                },
            ],
        },
    };

    @node({
        id: '428562cb-edd8-4da4-b8ea-2fa84822208d',
        name: 'Definir Cobranças',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [200, 0],
    })
    DefinirCobrancas = {
        jsCode: `
    const diretores = [
      {
        nome: "Luiz Fernando Machado",
        telefone: "5511993444697", // Substituir pelos reais depois
        projetos: "Osasco, Pardinho e RK Sub Empreita"
      },
      {
        nome: "Renato",
        telefone: "5541999999999", // Substituir
        projetos: "Osasco, Pardinho e RK Sub Empreita"
      },
      {
        nome: "Fabrizzio",
        telefone: "5574999076534",
        projetos: "Sala Técnica Consórcio Se Liga Na Rede Santos"
      },
      {
        nome: "Felipe Nery (Gestor Geral)",
        telefone: "5561981846325",
        projetos: "TODOS OS PROJETOS (Apoio na Delegação)"
      }
    ];

    const mensagens = diretores.map(d => {
      return {
        json: {
          number: d.telefone,
          textMessage: {
            text: \`🚨 *ALERTA DA GESTÃO 360* 🚨

Bom dia, Diretor *\${d.nome}*!

Lembre-se de despachar as tarefas para seus engenheiros / equipe hoje para os projetos: *\${d.projetos}*

Use o comando no Whatsapp da ConsturDataMax:\\n*@tarefa <nome_do_engenheiro> <descrição da tarefa>*\\nEx: *@tarefa mateus realizar topografia na rua X*\\n\\nUm ótimo dia de trabalho!\`
          }
        }
      };
    });

    return mensagens;
    `,
    };

    @node({
        id: '2078bfef-d36b-4a8d-b21b-559605e2f77e',
        name: 'Disparar WhatsApp (Evolution API)',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [400, 0],
    })
    DispararWhatsappEvolutionApi = {
        url: 'https://evolution-api-production-b130.up.railway.app/message/sendText/construdata-felipe',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify($json) }}',
        headerParameters: {
            parameters: [
                {
                    name: 'apikey',
                    value: 'construdata2026',
                },
            ],
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.CronJob7h.out(0).to(this.DefinirCobrancas.in(0));
        this.DefinirCobrancas.out(0).to(this.DispararWhatsappEvolutionApi.in(0));
    }
}
