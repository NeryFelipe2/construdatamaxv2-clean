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
    id: 'UKhLLXVRVItN2HxM',
    name: 'Cobrança Matinal — TAREFAS DIRETORES',
    active: false,
    isArchived: false,
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
        telefone: "5537999425397",
        projetos: "Osasco, Pardinho e RK Sub Empreita",
        tipo: "tarefa"
      },
      {
        nome: "Felipe Nery (Gestor Geral)",
        telefone: "5561981846325",
        projetos: "TODOS OS PROJETOS (Apoio na Delegação)",
        tipo: "tarefa"
      }
    ];

    // COBRANÇA FINANCEIRA — Renato e Emilly (quem faz pagamentos)
    const financeiros = [
      {
        nome: "Renato",
        telefone: "5528999154319",
        projetos: "Osasco, Pardinho, RK"
      },
      {
        nome: "Emilly Anjos",
        telefone: "5513974168911",
        projetos: "Osasco, Pardinho, RK"
      }
    ];

    const mensagens = [];

    // Cobranças de TAREFAS
    for (const d of diretores) {
      mensagens.push({
        json: {
          number: d.telefone,
          textMessage: {
            text: \`🚨 *ALERTA DA GESTÃO 360* 🚨

Bom dia, Diretor *\${d.nome}*!

Lembre-se de despachar as tarefas para seus engenheiros / equipe hoje para os projetos: *\${d.projetos}*

Use o comando no Whatsapp:
*@tarefa <nome> <descrição>*
Ex: *@tarefa mateus realizar topografia na rua X*

Um ótimo dia de trabalho!\`
          }
        }
      });
    }

    // Cobranças FINANCEIRAS diárias
    for (const f of financeiros) {
      mensagens.push({
        json: {
          number: f.telefone,
          textMessage: {
            text: \`💰 *COBRANÇA FINANCEIRA DIÁRIA* 💰

Bom dia, *\${f.nome}*!

Fez algum pagamento ontem ou hoje nos projetos *\${f.projetos}*?

📸 *Envie o comprovante aqui* com a legenda:
_Obra | Categoria | Descrição_

💡 *Exemplos:*
• Osasco | Diesel | Posto Shell
• Pardinho | Material | Tubos Tigre
• RK Sede | Alimentação | Marmita equipe

⚠️ *Obras sem lançamento serão cobradas na diretoria.*

_Sistema ConstruDataMax Gestão 360_\`
          }
        }
      });
    }

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
