const fs = require('fs');

let text = fs.readFileSync('test_node.js', 'utf8');

const fixes = [
  {
    find: `if (!p) return '🤖 ConstruDataMax
                 ^^^^^^^^^^^^^^^^^^
SyntaxError: Invalid or unexpected token`,  // This is just a comment, let's use exact strings.
  }
];

// Instead of string exact matches which are hard across newlines, lets use simple regexes that replace the actual matches and put \n.
text = text.replace(/if \(!p\) return '🤖 ConstruDataMax[\s\S]*?Fala com o admin para te cadastrar.';/m, "if (!p) return '🤖 ConstruDataMax\\n\\nNão consegui identificar seu projeto. Telefone detectado: *' + phoneDetectado + '*\\nFala com o admin para te cadastrar.';");

text = text.replace(/return menuLinhas\.join\('\n'\);/g, "return menuLinhas.join('\\n');");
text = text.replace(/return linhas\.join\('\n'\);/g, "return linhas.join('\\n');");

text = text.replace(/\('⚠️ \*LEMBRETE OBRIGATÓRIO\* ⚠️[\s\S]*?_Esteja atento aos projetos da sua alçada!_'/m, "('⚠️ *LEMBRETE OBRIGATÓRIO* ⚠️\\n\\nDiretor ' + d.nome + ', por favor mande hoje as tarefas matinais para as suas equipes responsáveis.\\n💡 *Como fazer:* Use *@tarefa <engenheiro> <descrição>*\\n\\n_Esteja atento aos projetos da sua alçada!_'");

text = text.replace(/'✅ \*COMANDO RECEBIDO:\*[\s\S]*?consolidados na plataforma ConstruDataMax.';/m, "'✅ *COMANDO RECEBIDO:*\\nOperação de ' + msgOperacao + ' iniciada no backend.\\n⏳ Os dados estão sendo processados pela IA e serão consolidados na plataforma ConstruDataMax.';");

text = text.replace(/'❌ Especifique o alvo. Exemplo:[\s\S]*?@gerar relatórios';/m, "'❌ Especifique o alvo. Exemplo:\\n@gerar dashboard\\n@gerar machine learning\\n@gerar relatórios';");

text = text.replace(/'🛠️ \*GUIA PARA CRIAR TAREFAS\*[\s\S]*?Focar na escavação da rede 2._';/m, "'🛠️ *GUIA PARA CRIAR TAREFAS*\\n\\nPara atribuir obrigações aos engenheiros, escreva:\\n\\n*@tarefa <nome> <descrição>*\\n\\nMembros elegíveis:\\n• *Ícaro* (Pardinho)\\n• *Mateus* (Osasco)\\n• *Alexandre* ou *Igor* (RK Sub)\\n• *Junior*, *Valdeans*, *Veronica*, *Jose Marcio* (Sala Técnica)\\n\\n_Ex: @tarefa icaro Focar na escavação da rede 2._';");

text = text.replace(/'💰 \*PLANO DE CONTAS \(CUSTO DIÁRIO\)\*[\s\S]*?- Materiais\/Equipamentos';/m, "'💰 *PLANO DE CONTAS (CUSTO DIÁRIO)*\\n\\nO preenchimento de Custos Diários foi EMBUTIDO no RDO normal dos equipamentos e equipes (Osasco, Pardinho e RK)!\\n\\nAo responder o RDO, preencha as rubricas numéricas de:\\n- Diesel/Combustível\\n- Alimentação/Hotelaria\\n- Mão de Obra Fixa/Avulsa\\n- Materiais/Equipamentos';");

fs.writeFileSync('test_node_fixed.js', text, 'utf8');
console.log("Done");
