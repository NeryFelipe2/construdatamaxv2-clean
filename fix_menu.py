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
      '📊 *Opções de Comando:*',
      '1️⃣ *Status RDO Hoje*',
      '2️⃣ *Equipe e Contatos*',
      '3️⃣ *Projetos Ativos*',
      '4️⃣ *Dashboard Consolidado*',
      '5️⃣ *Reenviar Cobrança* (Alerta Geral)',
      '6️⃣ *Falar com IA* (só Felipe)',
      '7️⃣ *Cobrar RDO* (Dispara formulário)',
      '8️⃣ *Meu RDO Diretor* (Supervisão)',
      '9️⃣ *Lembrar Tarefas* (Cobra diretores)',
      '🔟 *Criar Tarefas* (Guia de Uso)',
      '1️⃣1️⃣ *Plano de Custos* (Financeiro)',
      '',
      '📌 *Comandos Plataforma & IA:*',
      '• @gerar dashboard',
      '• @gerar machine learning',
      '• @gerar relatorios',
      '• @subir para a gestao 360',
      '📌 *Comandos extras:*',
      '• @rdo <projeto|todos> — Dispara RDO',
      '• @tarefa <nome|todos> <desc> — Delegar tarefa',
      '• @avisar <projeto> <msg> — Broadcast',
      '• @meurdo — Preencher RDO de supervisão',
      '',
      '_▶️ Digite o número ou use @comandos._',
      '🔗 https://construdatamaxv2-clean.vercel.app'
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
  return linhas.join('\\n');
}"""

text = re.sub(r"function montarMenu\(p, phoneDetectado\) \{.*?\n\}", new_func, text, flags=re.DOTALL)

with codecs.open('workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts', 'w', 'utf-8') as f:
    f.write(text)
