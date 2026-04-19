import re

filepath = r'C:\Users\felip\Downloads\construdatamaxv2-clean\workflows\n8n_production_ae317_up_railway_app_felipe_n\personal\gestao-whatsapp-router.workflow.ts'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Encontra e substitui a função montarMenu corrompida
old_func = """function montarMenu(p, phoneDetectado) {
  linhas.push('• Digite *só o número* (ex: *1*) e o bot vai perguntar o valor');
  linhas.push('• Responda direto: *1: 50* (tópico 1 = 50)');
  linhas.push('');
  linhas.push('🆘 *Outras Opções:*');
  linhas.push('*( M )* — Menu e Ajuda');
  linhas.push('*( S )* — Status do RDO');
  linhas.push('*( 💰 )* — Lançar pagamento (foto + legenda)');
  return linhas.join('\\\\n');
}"""

new_func = r"""function montarMenu(p, phoneDetectado) {
  if (!p) return '🤖 ConstruDataMax\\n\\nNão consegui identificar seu projeto. Telefone: *' + phoneDetectado + '*\\nFala com o admin.';
  var perfil = p.perfil || 'campo';
  var linhas = [];
  // CABEÇALHO
  if (perfil === 'master') { linhas.push('🤖 *ConstruDataMax Gestão 360*'); }
  else if (perfil === 'diretor_rk') { linhas.push('🤖 *ConstruDataMax — Diretoria RK*'); }
  else if (perfil === 'admin_fin') { linhas.push('🤖 *ConstruDataMax — Financeiro RK*'); }
  else if (perfil === 'operacional_rk') { linhas.push('🤖 *ConstruDataMax — Operacional RK*'); }
  else if (perfil === 'engenheiro_rk') { linhas.push('🤖 *ConstruDataMax — Engenharia RK*'); }
  else { linhas.push('🤖 *ConstruDataMax — Operação*'); }
  linhas.push('Olá *' + p.responsavel + '*!' + (p.nome ? ' Projeto: *' + p.nome + '*' : ''));
  linhas.push('');
  // OPERAÇÃO & RDO (master, diretor_rk, operacional_rk)
  if (perfil === 'master' || perfil === 'diretor_rk' || perfil === 'operacional_rk') {
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('📊 *OPERAÇÃO & RDO*');
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('1️⃣ Status RDO Hoje');
    linhas.push('2️⃣ Equipe e Contatos');
    linhas.push('3️⃣ Projetos Ativos');
    if (perfil === 'master') {
      linhas.push('4️⃣ Dashboard Consolidado');
      linhas.push('5️⃣ Reenviar Cobrança');
      linhas.push('7️⃣ Cobrar RDO');
    }
    linhas.push('8️⃣ Meu RDO Diretor');
    linhas.push('');
  }
  // RDO ENGENHEIRO
  if (perfil === 'engenheiro_rk' && p.perguntas && p.perguntas.length > 0) {
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('📊 *MEU RDO*');
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    for (var qi = 0; qi < p.perguntas.length; qi++) {
      linhas.push('*( ' + p.perguntas[qi].num + ' )* — ' + p.perguntas[qi].label);
    }
    linhas.push('');
    linhas.push('💬 Digite *só o número* pra responder');
    linhas.push('');
  }
  // RDO CAMPO (sem perfil definido)
  if (perfil === 'campo' && p.perguntas && p.perguntas.length > 0) {
    linhas.push('📝 *Para responder o RDO de hoje:*');
    linhas.push('');
    for (var qj = 0; qj < p.perguntas.length; qj++) {
      linhas.push('*( ' + p.perguntas[qj].num + ' )* — ' + p.perguntas[qj].label);
    }
    linhas.push('');
    linhas.push('💬 *Como preencher:*');
    linhas.push('• Digite *só o número* (ex: *1*) e o bot pergunta');
    linhas.push('• Ou direto: *1: 50*');
    linhas.push('');
  }
  // TAREFAS (master, diretor_rk, admin_fin)
  if (perfil === 'master' || perfil === 'diretor_rk' || perfil === 'admin_fin') {
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('📋 *TAREFAS & DELEGAÇÃO*');
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    if (perfil === 'master') {
      linhas.push('9️⃣ Lembrar Tarefas');
      linhas.push('🔟 Criar Tarefas');
      linhas.push('1️⃣2️⃣ Tarefas Consórcio');
      linhas.push('1️⃣3️⃣ Tarefa por Pessoa');
      linhas.push('1️⃣4️⃣ Tarefa à Diretoria');
      linhas.push('1️⃣5️⃣ Tarefa aos Engenheiros');
      linhas.push('1️⃣6️⃣ Tarefa por Setor');
    }
    linhas.push('1️⃣7️⃣ 📋 *Minhas Tarefas*');
    linhas.push('');
  }
  // FINANCEIRO (todos perfis RK + master)
  if (perfil === 'master' || perfil === 'diretor_rk' || perfil === 'admin_fin' || perfil === 'operacional_rk' || perfil === 'engenheiro_rk') {
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('💰 *FINANCEIRO — FLUXO DE CAIXA*');
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('1️⃣8️⃣ 💰 *Lançar Pagamento* (📸 Foto + Legenda)');
    if (perfil === 'master' || perfil === 'diretor_rk' || perfil === 'admin_fin') {
      linhas.push('1️⃣1️⃣ Plano de Custos (Projetado)');
      linhas.push('1️⃣9️⃣ 💸 *Extrato Financeiro*');
      linhas.push('2️⃣0️⃣ 📊 *Resumo por Obra*');
    }
    linhas.push('');
  }
  // CAMPO extras
  if (perfil === 'campo') {
    linhas.push('🆘 *Outras Opções:*');
    linhas.push('*( M )* — Menu | *( S )* — Status');
    linhas.push('*( 💰 )* — Lançar pagamento (foto + legenda)');
    linhas.push('');
  }
  // IA (master)
  if (perfil === 'master') {
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('🤖 *IA & PLATAFORMA*');
    linhas.push('━━━━━━━━━━━━━━━━━━━━━');
    linhas.push('6️⃣ Falar com IA');
    linhas.push('');
  }
  // COMANDOS
  if (perfil !== 'campo') {
    linhas.push('📌 *Comandos rápidos:*');
    linhas.push('• @pagamento — Como lançar');
    linhas.push('• @fluxo <obra> — Extrato');
    if (perfil === 'master' || perfil === 'diretor_rk' || perfil === 'admin_fin') {
      linhas.push('• @tarefa <nome> <desc>');
      linhas.push('• @meurdo');
    }
    if (perfil === 'master') {
      linhas.push('• @gerar dashboard');
      linhas.push('• @rdo <projeto|todos>');
      linhas.push('• @avisar <projeto> <msg>');
    }
    linhas.push('');
  }
  linhas.push('_▶️ Digite o número ou use @comandos._');
  return linhas.join('\\n');
}"""

if old_func in content:
    content = content.replace(old_func, new_func)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK: montarMenu substituida com sucesso!")
else:
    print("ERRO: nao encontrou o trecho antigo. Mostrando posicao...")
    idx = content.find("function montarMenu")
    if idx >= 0:
        print(f"Posicao da funcao: char {idx}")
        print("---CONTEUDO---")
        print(content[idx:idx+600])
    else:
        print("montarMenu NAO encontrada no arquivo!")
