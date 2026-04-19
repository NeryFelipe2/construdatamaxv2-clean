const fs = require('fs');

let text = fs.readFileSync('test_node.js', 'utf8');

const regexes = [
  {
    regex: /if \(!p\) return '🤖 ConstruDataMax[\s\S]*?Fala com o admin para te cadastrar.';/m,
    replace: "if (!p) return '🤖 ConstruDataMax\\n\\nNão consegui identificar seu projeto. Telefone detectado: *' + phoneDetectado + '*\\nFala com o admin para te cadastrar.';"
  },
  {
    regex: /return menuLinhas\.join\('[\n\r]+'\);/m,
    replace: "return menuLinhas.join('\\n');"
  },
  {
    regex: /return linhas\.join\('[\n\r]+'\);/m,
    replace: "return linhas.join('\\n');"
  },
  {
    regex: /'✅ \*COMANDO RECEBIDO:\*[\s\S]*?consolidados na plataforma ConstruDataMax.';/m,
    replace: "'✅ *COMANDO RECEBIDO:*\\nOperação de ' + msgOperacao + ' iniciada no backend.\\n⏳ Os dados estão sendo processados pela IA e serão consolidados na plataforma ConstruDataMax.';"
  },
  {
    regex: /'❌ Especifique o alvo. Exemplo:[\s\S]*?@gerar relatórios';/m,
    replace: "'❌ Especifique o alvo. Exemplo:\\n@gerar dashboard\\n@gerar machine learning\\n@gerar relatórios';"
  },
  {
    regex: /'⚠️ \*LEMBRETE OBRIGATÓRIO\* ⚠️[\s\S]*?_Esteja atento aos projetos da sua alçada!_'/m, 
    replace: "'⚠️ *LEMBRETE OBRIGATÓRIO* ⚠️\\n\\nDiretor ' + d.nome + ', por favor mande hoje as tarefas matinais para as suas equipes responsáveis.\\n💡 *Como fazer:* Use *@tarefa <engenheiro> <descrição>*\\n\\n_Esteja atento aos projetos da sua alçada!_'"
  },
  {
    regex: /'🛠️ \*GUIA PARA CRIAR TAREFAS\*[\s\S]*?Focar na escavação da rede 2._';/m,
    replace: "'🛠️ *GUIA PARA CRIAR TAREFAS*\\n\\nPara atribuir obrigações aos engenheiros, escreva:\\n\\n*@tarefa <nome> <descrição>*\\n\\nMembros elegíveis:\\n• *Ícaro* (Pardinho)\\n• *Mateus* (Osasco)\\n• *Alexandre* ou *Igor* (RK Sub)\\n• *Junior*, *Valdeans*, *Veronica*, *Jose Marcio* (Sala Técnica)\\n\\n_Ex: @tarefa icaro Focar na escavação da rede 2._';"
  },
  {
    regex: /'💰 \*PLANO DE CONTAS \(CUSTO DIÁRIO\)\*[\s\S]*?- Materiais\/Equipamentos';/m,
    replace: "'💰 *PLANO DE CONTAS (CUSTO DIÁRIO)*\\n\\nO preenchimento de Custos Diários foi EMBUTIDO no RDO normal dos equipamentos e equipes (Osasco, Pardinho e RK)!\\n\\nAo responder o RDO, preencha as rubricas numéricas de:\\n- Diesel/Combustível\\n- Alimentação/Hotelaria\\n- Mão de Obra Fixa/Avulsa\\n- Materiais/Equipamentos';"
  }
];

for (let i = 0; i < regexes.length; i++) {
  const r = regexes[i];
  if (!r.regex.test(text)) {
    console.log("NOT FOUND REGEX: " + i);
  }
  text = text.replace(r.regex, r.replace);
}

fs.writeFileSync('test_node_fixed.js', text, 'utf8');
console.log("Fixed written.");
