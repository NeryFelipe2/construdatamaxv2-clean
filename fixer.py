import codecs

with codecs.open('router_bkp.ts', 'r', 'utf-8') as f:
    text = f.read()

# Fix the syntax issues as previously requested, plus add the menu
text = text.replace("const isComando = /^(@|menu|ajuda|comandos|status|equipe|projetos|dashboard|ia|ai|rdo|[1-9sm])/i.test(trimmed);", "const isComando = /^(@|menu|ajuda|comandos|status|equipe|projetos|dashboard|ia|ai|rdo|gerar|subir|1[0-1]|[1-9sm])/i.test(trimmed);")

old_menu = """      '7️⃣ *Cobrar RDO* (Dispara formulário)',
      '8️⃣ *Meu RDO Diretor* (Supervisão)',
      '',
      '📌 *Comandos extras:*',"""
new_menu = """      '7️⃣ *Cobrar RDO* (Dispara formulário)',
      '8️⃣ *Meu RDO Diretor* (Supervisão)',
      '9️⃣ *Lembrar Tarefas* (Cobra diretores)',
      '1️⃣0️⃣ *Criar Tarefas* (Guia de Uso)',
      '1️⃣1️⃣ *Plano de Custos* (Financeiro)',
      '',
      '📌 *Comandos Plataforma & IA:*',
      '• @gerar dashboard',
      '• @gerar machine learning',
      '• @gerar relatorios',
      '• @subir para a gestao 360',
      '📌 *Comandos extras:*',"""
text = text.replace(old_menu, new_menu)

# Restore the correct commands 9, 10, 11 etc with proper \\n syntax
new_cmds_logic = """  } else if (cmd === 'gerar' || cmd === 'subir') {
    if (!proj || (!proj.isGestor && !proj.isDiretor)) {
      resposta = '❌ Apenas gestores podem emitir comandos de sistema.';
    } else {
      const acao = finalCmdMatch[2] ? finalCmdMatch[2].toLowerCase() : '';
      if (acao.includes('dashboard') || acao.includes('machine learning') || acao.includes('relatório') || acao.includes('relatorio') || cmd === 'subir') {
        const msgOperacao = cmd === 'subir' ? 'Sincronização com o painel Gestão 360' : 'Geração de ' + acao;
        resposta = '✅ *COMANDO RECEBIDO:*\\nOperação de ' + msgOperacao + ' iniciada no backend.\\n⏳ Os dados estão sendo processados pela IA e serão consolidados na plataforma ConstruDataMax.';
      } else {
        resposta = '❌ Especifique o alvo. Exemplo:\\n@gerar dashboard\\n@gerar machine learning\\n@gerar relatórios';
      }
    }
    
  } else if (cmd === 'lembrar') {
    if (!proj || (!proj.isGestor && !proj.isDiretor)) {
      resposta = '❌ Acesso negado. Apenas gestores podem disparar o lembrete de tarefas.';
    } else {
      // Avisa os diretores
      const dirs = [
        {nome: 'Luiz Fernando', tel: '5537999425397'},
        {nome: 'Renato RK', tel: '5528999154319'},
        {nome: 'Fabrizzio', tel: '5574999076534'}
      ];
      let oks = [];
      const amanha = new Date().toLocaleDateString('pt-BR');
      for (const d of dirs) {
        if(d.tel !== phone) { 
          const r = await responder.call(this, '⚠️ *LEMBRETE OBRIGATÓRIO* ⚠️\\n\\nDiretor ' + d.nome + ', por favor mande hoje as tarefas matinais para as suas equipes responsáveis.\\n💡 *Como fazer:* Use *@tarefa <engenheiro> <descrição>*\\n\\n_Esteja atento aos projetos da sua alçada!_', d.tel);
          if(r.ok) oks.push(d.nome);
        }
      }
      resposta = '✅ Lembrete metódico disparado matinalmente para os Diretores: ' + oks.join(', ');
    }
  
  } else if (cmd === 'criartarefa') {
    resposta = '🛠️ *GUIA PARA CRIAR TAREFAS*\\n\\nPara atribuir obrigações aos engenheiros, escreva:\\n\\n*@tarefa <nome> <descrição>*\\n\\nMembros elegíveis:\\n• *Ícaro* (Pardinho)\\n• *Mateus* (Osasco)\\n• *Alexandre* ou *Igor* (RK Sub)\\n• *Junior*, *Valdeans*, *Veronica*, *Jose Marcio* (Sala Técnica)\\n\\n_Ex: @tarefa icaro Focar na escavação da rede 2._';

  } else if (cmd === 'planocustos') {
    resposta = '💰 *PLANO DE CONTAS (CUSTO DIÁRIO)*\\n\\nO preenchimento de Custos Diários foi EMBUTIDO no RDO normal dos equipamentos e equipes (Osasco, Pardinho e RK)!\\n\\nAo responder o RDO, preencha as rubricas numéricas de:\\n- Diesel/Combustível\\n- Alimentação/Hotelaria\\n- Mão de Obra Fixa/Avulsa\\n- Materiais/Equipamentos';
  
  } else if (cmd === 'meurdo' || cmd === 'meurdo') {"""

text = text.replace("  } else if (cmd === 'meurdo' || cmd === 'meurdo') {", new_cmds_logic)

# Re-apply other logic fixes
text = text.replace("else if (pushName.includes('buruca')) phone = '5599999220853';", "else if (pushName.includes('buruca')) phone = '5599999220853';\n  else if (pushName.includes('junior') || pushName.includes('júnior')) phone = '5511986012223';\n  else if (pushName.includes('valdeans')) phone = '559991392763';\n  else if (pushName.includes('veronica') || pushName.includes('verônica')) phone = '5513997733121';\n  else if (pushName.includes('marcio') || pushName.includes('márcio')) phone = '5511941816005';\n  else if (pushName.includes('alexandre') || pushName.includes('igor')) phone = '5531998894664';")

text = text.replace("{ num: 6, label: 'Pendências para amanhã', tag: 'pendencias' },", "{ num: 6, label: 'Pendências para amanhã', tag: 'pendencias' },\n      { num: 7, label: 'Custo Dia: Diesel/Combustível (R$)', tag: 'custo_diesel' },\n      { num: 8, label: 'Custo Dia: Alimentação/Hotelaria (R$)', tag: 'custo_alim' },\n      { num: 9, label: 'Custo Dia: Mão de Obra Avulsa/Fixa (R$)', tag: 'custo_mo' },\n      { num: 10, label: 'Custo Dia: Materiais/Equipamentos (R$)', tag: 'custo_mat' },")

old_temp = """if (p.includes('991995918') || p.includes('978216285')) return {
    nome: 'Sala Técnica SLNR', responsavel: p.includes('991995918') ? 'Gabriel' : 'Vinicius', isSalaTecnica: true,
    perguntas: [
      { num: 1, label: 'Atividades realizadas hoje', tag: 'atividades' },
      { num: 2, label: 'Pendências / impedimentos', tag: 'pendencias' },
      { num: 3, label: 'Próximos passos (amanhã)', tag: 'proximos' },
    ]
  };"""
new_temp = """if (p.includes('991995918') || p.includes('978216285') || p.includes('986012223') || p.includes('91392763') || p.includes('997733121') || p.includes('941816005')) {
    let nomeRt = 'Colaborador';
    if(p.includes('991995918')) nomeRt = 'Gabriel';
    else if(p.includes('978216285')) nomeRt = 'Vinicius';
    else if(p.includes('986012223')) nomeRt = 'Junior';
    else if(p.includes('91392763')) nomeRt = 'Valdeans';
    else if(p.includes('997733121')) nomeRt = 'Veronica';
    else if(p.includes('941816005')) nomeRt = 'José Márcio';
    return {
      nome: 'Sala Técnica SLNR', responsavel: nomeRt, isSalaTecnica: true,
      perguntas: [
        { num: 1, label: 'Atividades realizadas hoje', tag: 'atividades' },
        { num: 2, label: 'Pendências / impedimentos', tag: 'pendencias' },
        { num: 3, label: 'Próximos passos (amanhã)', tag: 'proximos' },
      ]
    };
  }
  if (p.includes('998894664')) return {
    nome: 'RK Sub Empreita (SANTOS)', responsavel: 'Alexandre / Igor',
    perguntas: [
      { num: 1, label: 'Frentes em andamento', tag: 'frentes' },
      { num: 2, label: 'Metros executados', tag: 'metros_rede' },
      { num: 3, label: 'Equipe no local', tag: 'efetivo' },
      { num: 4, label: 'Impedimentos', tag: 'pendencias' },
      { num: 5, label: 'Custo Dia: Diesel/Combustível (R$)', tag: 'custo_diesel' },
      { num: 6, label: 'Custo Dia: Alimentação/Hotelaria (R$)', tag: 'custo_alim' },
      { num: 7, label: 'Custo Dia: Mão de Obra (R$)', tag: 'custo_mo' },
      { num: 8, label: 'Custo Dia: Materiais/Locações (R$)', tag: 'custo_mat' },
    ]
  };"""
text = text.replace(old_temp, new_temp)

text = text.replace("escopo: ['pardinho','osasco','rk']", "escopo: ['pardinho','osasco','rk_sub']")

text = text.replace("{ num: 11, label: 'Acidentes ou ocorrências', tag: 'acidentes' },", "{ num: 11, label: 'Acidentes ou ocorrências', tag: 'acidentes' },\n      { num: 12, label: 'Custo Dia: Diesel/Combustível (R$)', tag: 'custo_diesel' },\n      { num: 13, label: 'Custo Dia: Alimentação/Hotelaria (R$)', tag: 'custo_alim' },\n      { num: 14, label: 'Custo Dia: Mão de Obra Avulsa/Fixa (R$)', tag: 'custo_mo' },\n      { num: 15, label: 'Custo Dia: Materiais/Equipamentos (R$)', tag: 'custo_mat' },")

old_shortcuts = """const shortcutMatch = trimmed.match(/^([1-8sm])$/i);

if (shortcutMatch && proj) {
  const s = shortcutMatch[1].toLowerCase();
  if (proj.isGestor) {
    if (s === '1') finalCmdMatch = [null, 'status', ''];
    else if (s === '2') finalCmdMatch = [null, 'equipe', ''];
    else if (s === '3') finalCmdMatch = [null, 'projetos', ''];
    else if (s === '4') finalCmdMatch = [null, 'dashboard', ''];
    else if (s === '5') finalCmdMatch = [null, 'reenviar', 'todos'];
    else if (s === '6') finalCmdMatch = [null, 'ia', ''];
    else if (s === '7') finalCmdMatch = [null, 'rdo', 'todos'];
    else if (s === '8') finalCmdMatch = [null, 'meurdo', ''];
  } else {"""
new_shortcuts = """const shortcutMatch = trimmed.match(/^(1[0-1]|[1-9]|s|m)$/i);

if (shortcutMatch && proj) {
  const s = shortcutMatch[1].toLowerCase();
  if (proj.isGestor) {
    if (s === '1') finalCmdMatch = [null, 'status', ''];
    else if (s === '2') finalCmdMatch = [null, 'equipe', ''];
    else if (s === '3') finalCmdMatch = [null, 'projetos', ''];
    else if (s === '4') finalCmdMatch = [null, 'dashboard', ''];
    else if (s === '5') finalCmdMatch = [null, 'reenviar', 'todos'];
    else if (s === '6') finalCmdMatch = [null, 'ia', ''];
    else if (s === '7') finalCmdMatch = [null, 'rdo', 'todos'];
    else if (s === '8') finalCmdMatch = [null, 'meurdo', ''];
    else if (s === '9') finalCmdMatch = [null, 'lembrar', 'diretores'];
    else if (s === '10') finalCmdMatch = [null, 'criartarefa', ''];
    else if (s === '11') finalCmdMatch = [null, 'planocustos', ''];
  } else {"""
text = text.replace(old_shortcuts, new_shortcuts)

old_task = """      const TODOS_ENG = [
        { nome: 'Ícaro',    tel: '5537998268576', proj: 'pardinho' },
        { nome: 'Mateus',   tel: '5561991015639', proj: 'osasco' },
        { nome: 'Gabriel',  tel: '5513991995918', proj: 'sala_tecnica' },
        { nome: 'Vinicius', tel: '5513978216285', proj: 'sala_tecnica' },
      ];
      const escopoDir = proj.escopo || [];
      const escopoTodos = escopoDir.includes('todos');

      let destinos = [];
      if (alvo === 'todos') {
        destinos = escopoTodos ? TODOS_ENG.slice() : TODOS_ENG.filter(e => escopoDir.includes(e.proj));
      }
      else if (alvo.includes('mateus') || alvo.includes('matheus')) destinos.push({nome:'Mateus', tel:'5561991015639'});
      else if (alvo.includes('icaro') || alvo.includes('ícaro')) destinos.push({nome:'Ícaro', tel:'5537998268576'});
      else if (alvo.includes('gabriel')) destinos.push({nome:'Gabriel', tel:'5513991995918'});
      else if (alvo.includes('vinicius') || alvo.includes('vinícius')) destinos.push({nome:'Vinicius', tel:'5513978216285'});
      else if (alvo.includes('thalita')) destinos.push({nome:'Thalita', tel:'5511919803270'});
      else if (alvo.includes('felipe')) destinos.push({nome:'Felipe', tel:'5561981846325'});"""

new_task = """      const TODOS_ENG = [
        { nome: 'Ícaro',    tel: '5537998268576', proj: 'pardinho' },
        { nome: 'Mateus',   tel: '5561991015639', proj: 'osasco' },
        { nome: 'Gabriel',  tel: '5513991995918', proj: 'sala_tecnica' },
        { nome: 'Vinicius', tel: '5513978216285', proj: 'sala_tecnica' },
        { nome: 'Junior',   tel: '5511986012223', proj: 'sala_tecnica' },
        { nome: 'Valdeans', tel: '559991392763', proj: 'sala_tecnica' },
        { nome: 'Veronica', tel: '5513997733121', proj: 'sala_tecnica' },
        { nome: 'José Márcio', tel: '5511941816005', proj: 'sala_tecnica' },
        { nome: 'Alexandre/Igor', tel: '5531998894664', proj: 'rk_sub' },
      ];
      const escopoDir = proj.escopo || [];
      const escopoTodos = escopoDir.includes('todos');

      let destinos = [];
      if (alvo === 'todos') {
        destinos = escopoTodos ? TODOS_ENG.slice() : TODOS_ENG.filter(e => escopoDir.includes(e.proj));
      } else {
        const tgt = TODOS_ENG.filter(e => alvo.includes(e.nome.split('/')[0].toLowerCase()) || alvo.includes(e.nome.split(' ')[0].toLowerCase()));
        if(tgt.length > 0) {
          if(proj.responsavel === 'Fabrizzio') {
             destinos = tgt.filter(x => x.proj === 'sala_tecnica');
          } else {
             destinos = tgt;
          }
        }
      }"""
text = text.replace(old_task, new_task)

rdo_envio_antigo = """      // Sala Técnica → Gabriel + Vinicius
      if (alvo === 'todos' || alvo.includes('sala')) {
        const msg = RDO_PERGUNTAS_DIRETOR.sala.join('\\n') + '\\n\\n📅 ' + hojeStr;
        const r1 = await responder.call(this, msg, '5513991995918');
        const r2 = await responder.call(this, msg, '5513978216285');
        if (r1.ok) enviados.push('Gabriel (Sala)'); else falhas.push('Gabriel: ' + r1.err);
        if (r2.ok) enviados.push('Vinicius (Sala)'); else falhas.push('Vinicius: ' + r2.err);
      }"""
rdo_envio_novo = """      // RK Sub -> Alexandre/Igor
      if (proj.responsavel !== 'Fabrizzio' && (alvo === 'todos' || alvo.includes('rk'))) {
        const pergRK = [
          '📋 *RDO DIÁRIO — RK Sub Empreita*', '', 'Preecha hoje:',
          '*( 1 )* — Frentes', '*( 2 )* — Metros', '*( 3 )* — Equipe', '*( 4 )* — Impedimentos',
          '*( 5 )* — Custo Dia: Diesel/Combustível (R$)',
          '*( 6 )* — Custo Dia: Alimentação/Hotelaria (R$)',
          '*( 7 )* — Custo Dia: Mão de Obra (R$)',
          '*( 8 )* — Custo Dia: Materiais/Locações (R$)'
        ].join('\\n');
        const rr = await responder.call(this, pergRK, '5531998894664');
        if (rr.ok) enviados.push('Alexandre/Igor (RK)'); else falhas.push('Alex/Igor: ' + rr.err);
      }

      // Sala Técnica 
      if (alvo === 'todos' || alvo.includes('sala')) {
        const msg = RDO_PERGUNTAS_DIRETOR.sala.join('\\n') + '\\n\\n📅 ' + hojeStr;
        const salaTels = [
          {n: 'Gabriel', t:'5513991995918'}, {n:'Vinicius', t:'5513978216285'},
          {n: 'Junior', t:'5511986012223'}, {n:'Valdeans', t:'559991392763'},
          {n: 'Veronica', t:'5513997733121'}, {n:'José Márcio', t:'5511941816005'}
        ];
        for (const st of salaTels) {
          const r0 = await responder.call(this, msg, st.t);
          if (r0.ok) enviados.push(st.n + ' (Sala)'); else falhas.push(st.n + ': ' + r0.err);
        }
      }"""
text = text.replace(rdo_envio_antigo, rdo_envio_novo)

text = text.replace("if (alvo === 'todos' || alvo.includes('pardinho')) {", "if (proj.responsavel !== 'Fabrizzio' && (alvo === 'todos' || alvo.includes('pardinho'))) {")
text = text.replace("if (alvo === 'todos' || alvo.includes('osasco')) {", "if (proj.responsavel !== 'Fabrizzio' && (alvo === 'todos' || alvo.includes('osasco'))) {")

text = text.replace(
    "if (alvo === 'todos') telefones.push('5537998268576','5561991015639','5561999996252','5513991995918','5513978216285');",
    "if (alvo === 'todos') telefones.push('5537998268576','5561991015639','5561999996252','5513991995918','5513978216285','5511986012223','5531998894664');\n      else if (alvo.includes('rk')) telefones.push('5531998894664');"
)

with codecs.open('workflows/n8n_production_ae317_up_railway_app_felipe_n/personal/gestao-whatsapp-router.workflow.ts', 'w', 'utf-8') as f:
    f.write(text)
