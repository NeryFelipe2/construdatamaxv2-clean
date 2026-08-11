import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Alerta de Medição e Prazos
// Nodes   : 6  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// VerificacaoDiaria7h                scheduleTrigger
// CalcularPrazosCriticos             code
// TemAlerta                          if
// MontarMensagem                     code
// EnviarAlerta                       httpRequest
// RegistrarLog                       httpRequest
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// VerificacaoDiaria7h
//    → CalcularPrazosCriticos
//      → TemAlerta
//        → MontarMensagem
//          → EnviarAlerta
//            → RegistrarLog
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '7ZFxLruxONFgd9Y7',
    name: 'Alerta de Medição e Prazos',
    active: false,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class AlertaDeMedicaoEPrazosWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'eb0054d5-3a65-4c6f-999d-efc66e349b13',
        name: 'Verificação Diária 7h',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 300],
    })
    VerificacaoDiaria7h = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 7 * * 1-5',
                },
            ],
        },
    };

    @node({
        id: 'bb8611cd-3cbf-4918-83f8-d4944d57539a',
        name: 'Calcular Prazos Críticos',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [250, 300],
    })
    CalcularPrazosCriticos = {
        language: 'javaScript',
        jsCode: `
const hoje = new Date();
const diasSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// ─── Prazos do contrato CT 11481051 ───
const prazos = [
  { 
    nome: '📊 Medição Mensal SABESP',
    descricao: 'Protocolar medição acumulada',
    diaLimite: 15,  // dia 15 de cada mês
    antecedencia: 5, // alertar 5 dias antes
    responsavel: 'Engenheiro de Medição',
    tipo: 'medicao'
  },
  {
    nome: '📋 Relatório Semanal',
    descricao: 'Consolidar RDOs e enviar relatório da semana',
    diaSemana: 5,  // sexta-feira
    antecedencia: 1,
    responsavel: 'Coordenador de Obras',
    tipo: 'relatorio'
  },
  {
    nome: '📐 Entrega Cadastro Topográfico',
    descricao: 'Enviar as-built dos trechos executados para SABESP',
    diaLimite: 16,  // dia 16/04/2026
    mesLimite: 3,    // abril (0-indexed)
    antecedencia: 7,
    responsavel: 'Equipe Topografia (Avant/Cosme)',
    tipo: 'cadastro'
  },
  {
    nome: '🔍 Vistoria Survey SABESP',
    descricao: 'Dados Survey para SABESP — apresentação obrigatória',
    diaLimite: 2,   // dia 02/05/2026
    mesLimite: 4,    // maio
    antecedencia: 10,
    responsavel: 'Coordenação + Topografia',
    tipo: 'survey'
  },
  {
    nome: '📝 RDO Diário',
    descricao: 'Preenchimento obrigatório do RDO de cada frente',
    horarioLimite: '18:00',
    diario: true,
    responsavel: 'Apontador de Campo',
    tipo: 'rdo'
  },
  {
    nome: '🔐 DDS (Diálogo Diário de Segurança)',
    descricao: 'Realizar DDS antes do início dos trabalhos',
    horarioLimite: '07:30',
    diario: true,
    responsavel: 'Técnico de Segurança',
    tipo: 'seguranca'
  },
];

const alertas = [];

for (const prazo of prazos) {
  if (prazo.diario) {
    // Alertas diários sempre aparecem
    alertas.push({
      ...prazo,
      urgencia: 'normal',
      diasRestantes: 0,
      mensagem: \`\${prazo.nome}: \${prazo.descricao} (até \${prazo.horarioLimite})\`,
    });
    continue;
  }

  if (prazo.diaSemana !== undefined) {
    // Prazo semanal
    const diaAtual = hoje.getDay();
    const diasAte = (prazo.diaSemana - diaAtual + 7) % 7;
    if (diasAte <= prazo.antecedencia) {
      alertas.push({
        ...prazo,
        urgencia: diasAte <= 1 ? 'critico' : 'atencao',
        diasRestantes: diasAte,
        mensagem: \`\${prazo.nome}: \${diasAte === 0 ? 'HOJE!' : \`em \${diasAte} dia(s)\`}\`,
      });
    }
    continue;
  }

  // Prazo mensal/específico
  let dataLimite;
  if (prazo.mesLimite !== undefined) {
    dataLimite = new Date(hoje.getFullYear(), prazo.mesLimite, prazo.diaLimite);
  } else {
    dataLimite = new Date(hoje.getFullYear(), hoje.getMonth(), prazo.diaLimite);
    if (dataLimite < hoje) {
      dataLimite.setMonth(dataLimite.getMonth() + 1);
    }
  }
  
  const diffMs = dataLimite.getTime() - hoje.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDias <= prazo.antecedencia && diffDias >= 0) {
    alertas.push({
      ...prazo,
      urgencia: diffDias <= 2 ? 'critico' : diffDias <= 4 ? 'atencao' : 'normal',
      diasRestantes: diffDias,
      dataLimite: dataLimite.toLocaleDateString('pt-BR'),
      mensagem: \`\${prazo.nome}: \${diffDias === 0 ? 'VENCE HOJE!' : \`faltam \${diffDias} dia(s) — até \${dataLimite.toLocaleDateString('pt-BR')}\`}\`,
    });
  }
}

const temAlertaCritico = alertas.some(a => a.urgencia === 'critico' || a.urgencia === 'atencao');

return [{ json: { alertas, temAlertaCritico, totalAlertas: alertas.length, hoje: hoje.toLocaleDateString('pt-BR') } }];
`,
    };

    @node({
        id: '601a3279-aff4-4844-8cc2-92dc1c964a45',
        name: 'Tem Alerta?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [500, 300],
    })
    TemAlerta = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
            },
            combinator: 'and',
            conditions: [
                {
                    id: 'alerta-check',
                    leftValue: '={{ $json.temAlertaCritico }}',
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
        id: 'aa1e0aa1-cc47-4401-abc1-cee2c0534660',
        name: 'Montar Mensagem',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [750, 200],
    })
    MontarMensagem = {
        language: 'javaScript',
        jsCode: `
const data = $input.first().json;
const alertas = data.alertas || [];

const emoji = { critico: '🔴', atencao: '🟡', normal: '🟢' };

const linhas = [
  '⏰ *ALERTAS DE PRAZOS — ConstruDataMax*',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  \`📅 \${data.hoje} | \${data.totalAlertas} alertas ativos\`,
  '',
];

// Agrupar por urgência
const criticos = alertas.filter(a => a.urgencia === 'critico');
const atencao = alertas.filter(a => a.urgencia === 'atencao');
const normais = alertas.filter(a => a.urgencia === 'normal');

if (criticos.length > 0) {
  linhas.push('🔴 *URGENTE*');
  criticos.forEach(a => {
    linhas.push(\`  • \${a.mensagem}\`);
    linhas.push(\`    👤 Resp: \${a.responsavel}\`);
  });
  linhas.push('');
}

if (atencao.length > 0) {
  linhas.push('🟡 *ATENÇÃO*');
  atencao.forEach(a => {
    linhas.push(\`  • \${a.mensagem}\`);
    linhas.push(\`    👤 Resp: \${a.responsavel}\`);
  });
  linhas.push('');
}

if (normais.length > 0) {
  linhas.push('🟢 *ROTINA*');
  normais.forEach(a => {
    linhas.push(\`  • \${a.mensagem}\`);
  });
}

linhas.push('');
linhas.push('🔗 https://construdatamaxv2-clean.vercel.app/app/planejamento');

return [{ json: { mensagem: linhas.join('\\n'), alertas: data.alertas, urgencias: { criticos: criticos.length, atencao: atencao.length, normais: normais.length } } }];
`,
    };

    @node({
        id: 'bce1f624-4a81-49a1-8542-bd756379daf0',
        name: 'Enviar Alerta',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1000, 200],
    })
    EnviarAlerta = {
        url: 'https://n8n-production-ae317.up.railway.app/webhook/construdata-notificacao',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ channel: "gestao", type: "deadline_alert", message: $json.mensagem, urgencias: $json.urgencias }) }}',
        options: {},
    };

    @node({
        id: '33b1620f-d01a-4cbc-a857-4ddbc69baf2e',
        name: 'Registrar Log',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1250, 200],
    })
    RegistrarLog = {
        url: 'https://construdatamaxv2-clean.vercel.app/api/logs/alerts',
        method: 'POST',
        sendBody: true,
        contentType: 'json',
        body: '={{ JSON.stringify({ type: "deadline_check", alertas: $json.alertas, timestamp: new Date().toISOString() }) }}',
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.VerificacaoDiaria7h.out(0).to(this.CalcularPrazosCriticos.in(0));
        this.CalcularPrazosCriticos.out(0).to(this.TemAlerta.in(0));
        this.TemAlerta.out(0).to(this.MontarMensagem.in(0));
        this.MontarMensagem.out(0).to(this.EnviarAlerta.in(0));
        this.EnviarAlerta.out(0).to(this.RegistrarLog.in(0));
    }
}
