import codecs
import re

with codecs.open('workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts', 'r', 'utf-8') as f:
    text = f.read()

# Replace the entirely corrupted montarMenu function
new_func = """function montarMenu(p, phoneDetectado) {
  if (!p) return '🤖 ConstruDataMax\\n\\nNão consegui identificar seu projeto. Telefone detectado: *' + phoneDetectado + '*\\nFala com o admin para te cadastrar.';

  // Menu de gestor/diretor
  if (p.isGestor) {
    const menuLinhas = [
      '🤖 *ConstruDataMax Gestão 360*',
      'Olá *' + p.responsavel + '*!',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '📊 *OPERAÇÃO & RDO*',
      '━━━━━━━━━━━━━━━━━━━━━',
      '1️⃣ Status RDO Hoje',
      '2️⃣ Equipe e Contatos',
      '3️⃣ Projetos Ativos',
      '4️⃣ Dashboard Consolidado',
      '5️⃣ Reenviar Cobrança (Alerta Geral)',
      '7️⃣ Cobrar RDO (Dispara formulário)',
      '8️⃣ Meu RDO Diretor (Supervisão)',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '📋 *TAREFAS & DELEGAÇÃO*',
      '━━━━━━━━━━━━━━━━━━━━━',
      '9️⃣ Lembrar Tarefas (Cobra diretores)',
      '🔟 Criar Tarefas (Guia de Uso)',
      '1️⃣2️⃣ Tarefas Consórcio (Delega por setor)',
      '1️⃣3️⃣ Enviar Tarefa por Pessoa',
      '1️⃣4️⃣ Enviar Tarefa à Diretoria',
      '1️⃣5️⃣ Enviar Tarefa aos Engenheiros',
      '1️⃣6️⃣ Enviar Tarefa por Setor',
      '1️⃣7️⃣ 📋 *Minhas Tarefas* (Ver pendências)',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '💰 *FINANCEIRO — FLUXO DE CAIXA*',
      '━━━━━━━━━━━━━━━━━━━━━',
      '1️⃣1️⃣ Plano de Custos (Projetado)',
      '1️⃣8️⃣ 💰 *Lançar Pagamento* (Foto + Centro de Custo)',
      '1️⃣9️⃣ 💸 *Extrato Financeiro* (Projetado vs Executado)',
      '2️⃣0️⃣ 📊 *Resumo por Obra* (Fluxo de Caixa)',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '🤖 *IA & PLATAFORMA*',
      '━━━━━━━━━━━━━━━━━━━━━',
      '6️⃣ Falar com IA (só Felipe)',
      '',
      '📌 *Comandos @:*',
      '• @gerar dashboard',
      '• @gerar machine learning',
      '• @gerar relatorios',
      '• @subir gestao 360',
      '• @rdo <projeto|todos>',
      '• @tarefa <nome|todos> <desc>',
      '• @avisar <projeto> <msg>',
      '• @meurdo',
      '• @fluxo <obra> — Extrato financeiro',
      '• @pagamento — Como lançar pagamento',
      '',
      '_▶️ Digite o número ou use @comandos._',
      '🔗 construdatamaxv2-clean.vercel.app'
    ];
    return menuLinhas.join('\\n');
  }

  const tituloForm = p.isSalaTecnica ? '📌 *Atividades do Dia — preencha:*' : '📌 *Para responder o RDO de hoje:*';
  const linhas = [
    '🤖 *ConstruDataMax — Operação*',
    'Olá *' + p.responsavel + '*! Projeto: *' + p.nome + '*',
    '',
    tituloForm,
    ''
  ];
  for (const q of p.perguntas) {
    linhas.push('*( ' + q.num + ' )* — ' + q.label);
  }
  linhas.push('');
  linhas.push('💬 *Como preencher (jeito rápido):*');
  linhas.push('Copia o bloco abaixo, edita os valores e manda de volta numa mensagem só:');
  linhas.push('');
  for (const q of p.perguntas) {
    linhas.push(q.num + ': ');
  }
  linhas.push('');
  linhas.push('_Pode mandar tudo de uma vez ou um por linha. Também aceita texto livre nas pendências._');
  linhas.push('');
  linhas.push('🆘 *Outras Opções:*');
  linhas.push('*( M )* — Menu e Ajuda');
  linhas.push('*( S )* — Status do RDO');
  linhas.push('*( 💰 )* — Lançar pagamento (foto + legenda)');
  return linhas.join('\\n');
}"""

text = re.sub(r"function montarMenu\(p, phoneDetectado\) \{.*?\n\}", new_func, text, flags=re.DOTALL)

with codecs.open('workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts', 'w', 'utf-8') as f:
    f.write(text)
