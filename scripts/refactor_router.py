import re

with open('src/n8n_whatsapp_router/router.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. API Keys
text = re.sub(
    r"const SUPABASE_KEY = '[^']+';",
    r"const SUPABASE_KEY = $env.get('SUPABASE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibGZkaWtmb2JzaXJ3cGRueWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzAwODIsImV4cCI6MjA4ODk0NjA4Mn0.GOx3HoMh3P2Zzxz8BxNsfQBfXwsNZNQsdVc3nJaqRy4';",
    text
)
text = text.replace(
    "'construdata2026'",
    "$env.get('EVOLUTION_API_KEY') || 'construdata2026'"
)
text = text.replace(
    "'Bearer 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'",
    "`Bearer ${$env.get('GROQ_API_KEY') || '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'}`"
)

# 2. Add RK and extended Sala Tecnica to projetoDoPhone
# Locate the block to replace
old_sala = """  if (p.includes('991995918') || p.includes('978216285')) return {
    nome: 'Sala Técnica SLNR', responsavel: p.includes('991995918') ? 'Gabriel' : 'Vinicius', isSalaTecnica: true,
    perguntas: [
      { num: 1, label: 'Atividades realizadas hoje', tag: 'atividades' },
      { num: 2, label: 'Pendências / impedimentos', tag: 'pendencias' },
      { num: 3, label: 'Próximos passos (amanhã)', tag: 'proximos' },
    ]
  };"""

new_sala = """  if (p.includes('991995918') || p.includes('978216285') || p.includes('986012223') || p.includes('91392763') || p.includes('997733121') || p.includes('941816005')) {
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

text = text.replace(old_sala, new_sala)

# 3. Formato Livre para Sala Técnica (near line 766)
# "if (proj && !proj.isGestor && /^\s*\d+\s*[:=]/m.test(trimmed)) {"
# We replace it with logic that accepts format free if it's Sala Técnica.

old_parsing = r"""// Resposta no formato "1: valor" ou "1: a | 2: b | 3: c" — converte pra tags e segue pro RDO (engenheiros)
if (proj && !proj.isGestor && /^\s*\d+\s*[:=]/m.test(trimmed)) {"""

new_parsing = r"""// Resposta no formato "1: valor" ou texto livre para Sala Técnica
const isFormatoLivre = proj && proj.isSalaTecnica && !/^\s*\d+\s*[:=]/m.test(trimmed);
if (proj && !proj.isGestor && (/^\s*\d+\s*[:=]/m.test(trimmed) || isFormatoLivre)) {"""

text = text.replace(old_parsing, new_parsing)

# Further down, we need to handle the free format payload correctly
old_taglines = r"""  for (const p of partes) {
    const m = p.match(/^(\d+)\s*[:=]\s*(.+)$/);
    if (m) {
      const q = proj.perguntas.find(x => x.num === parseInt(m[1], 10));
      if (q) {
        tagLines.push(q.tag + ': ' + m[2].trim());
        ackLabels.push('✅ *' + q.num + '. ' + q.label + '* → ' + m[2].trim());
      }
    }
  }
  if (tagLines.length > 0) {"""

new_taglines = r"""  if (isFormatoLivre) {
    tagLines.push('atividades: ' + trimmed);
    ackLabels.push('✅ *Relato de Atividades* → Recebido formato livre');
  } else {
    for (const p of partes) {
      const m = p.match(/^(\d+)\s*[:=]\s*(.+)$/);
      if (m) {
        const q = proj.perguntas.find(x => x.num === parseInt(m[1], 10));
        if (q) {
          tagLines.push(q.tag + ': ' + m[2].trim());
          ackLabels.push('✅ *' + q.num + '. ' + q.label + '* → ' + m[2].trim());
        }
      }
    }
  }

  if (tagLines.length > 0) {"""

text = text.replace(old_taglines, new_taglines)

with open('src/n8n_whatsapp_router/router.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("router.js updated successfully.")
