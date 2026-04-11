import codecs
with codecs.open('test_node.js', 'r', 'utf-8') as f:
    text = f.read()

issues = [
    ("return '🤖 ConstruDataMax\n\nNão consegui identificar seu projeto. Telefone detectado: *' + phoneDetectado + '*\nFala com o admin para te cadastrar.';", r"return '🤖 ConstruDataMax\n\nNão consegui identificar seu projeto. Telefone detectado: *' + phoneDetectado + '*\nFala com o admin para te cadastrar.';"),
    ("return menuLinhas.join('\n');", r"return menuLinhas.join('\n');"),
    ("return linhas.join('\n');", r"return linhas.join('\n');"),
    ("('⚠️ *LEMBRETE OBRIGATÓRIO* ⚠️\n\nDiretor ' + d.nome + ', por favor mande hoje as tarefas matinais para as suas equipes responsáveis.\n💡 *Como fazer:* Use *@tarefa <engenheiro> <descrição>*\n\n_Esteja atento aos projetos da sua alçada!_',", r"('⚠️ *LEMBRETE OBRIGATÓRIO* ⚠️\n\nDiretor ' + d.nome + ', por favor mande hoje as tarefas matinais para as suas equipes responsáveis.\n💡 *Como fazer:* Use *@tarefa <engenheiro> <descrição>*\n\n_Esteja atento aos projetos da sua alçada!_',"),
    ("'✅ *COMANDO RECEBIDO:*\nOperação de ' + msgOperacao + ' iniciada no backend.\n⏳ Os dados estão sendo processados pela IA e serão consolidados na plataforma ConstruDataMax.';", r"'✅ *COMANDO RECEBIDO:*\nOperação de ' + msgOperacao + ' iniciada no backend.\n⏳ Os dados estão sendo processados pela IA e serão consolidados na plataforma ConstruDataMax.';"),
    ("'❌ Especifique o alvo. Exemplo:\n@gerar dashboard\n@gerar machine learning\n@gerar relatórios';", r"'❌ Especifique o alvo. Exemplo:\n@gerar dashboard\n@gerar machine learning\n@gerar relatórios';"),
    ("'🛠️ *GUIA PARA CRIAR TAREFAS*\n\nPara atribuir obrigações aos engenheiros, escreva:\n\n*@tarefa <nome> <descrição>*\n\nMembros elegíveis:\n• *Ícaro* (Pardinho)\n• *Mateus* (Osasco)\n• *Alexandre* ou *Igor* (RK Sub)\n• *Junior*, *Valdeans*, *Veronica*, *Jose Marcio* (Sala Técnica)\n\n_Ex: @tarefa icaro Focar na escavação da rede 2._';", r"'🛠️ *GUIA PARA CRIAR TAREFAS*\n\nPara atribuir obrigações aos engenheiros, escreva:\n\n*@tarefa <nome> <descrição>*\n\nMembros elegíveis:\n• *Ícaro* (Pardinho)\n• *Mateus* (Osasco)\n• *Alexandre* ou *Igor* (RK Sub)\n• *Junior*, *Valdeans*, *Veronica*, *Jose Marcio* (Sala Técnica)\n\n_Ex: @tarefa icaro Focar na escavação da rede 2._';"),
    ("'💰 *PLANO DE CONTAS (CUSTO DIÁRIO)*\n\nO preenchimento de Custos Diários foi EMBUTIDO no RDO normal dos equipamentos e equipes (Osasco, Pardinho e RK)!\n\nAo responder o RDO, preencha as rubricas numéricas de:\n- Diesel/Combustível\n- Alimentação/Hotelaria\n- Mão de Obra Fixa/Avulsa\n- Materiais/Equipamentos';", r"'💰 *PLANO DE CONTAS (CUSTO DIÁRIO)*\n\nO preenchimento de Custos Diários foi EMBUTIDO no RDO normal dos equipamentos e equipes (Osasco, Pardinho e RK)!\n\nAo responder o RDO, preencha as rubricas numéricas de:\n- Diesel/Combustível\n- Alimentação/Hotelaria\n- Mão de Obra Fixa/Avulsa\n- Materiais/Equipamentos';")
]

for bug, fix in issues:
    if bug in text:
        text = text.replace(bug, fix)
        print(f"Fixed string: {bug[:20]}...")
    else:
        print(f"NOT FOUND: {bug[:20]}...")

with codecs.open('test_node.js', 'w', 'utf-8') as f:
    f.write(text)
