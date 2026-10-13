/**
 * parseListaPresenca.ts — lê a "Lista de Presença" mandada todo dia no grupo de
 * WhatsApp de apontamento e transforma em linhas prontas para `rdo_presenca`.
 *
 * Por que existe: o grupo tem 232 mensagens desse formato em ~3 meses, mas
 * `rdo_presenca` está zerada — a presença nunca sai do WhatsApp. O apontamento
 * de PRODUÇÃO (PRA/LA/PV…) não tem essa garantia — os campos ficam em branco e
 * o número real vira texto solto — por isso NÃO tentamos parsear produção
 * aqui, só presença. Ver a análise que sustenta essa escolha.
 *
 * Formato dominante (2 variações de cabeçalho, o resto é igual):
 *   LISTA DE PRESENÇA 17/08
 *   EQUIPE - Mazinho
 *
 *   Felipe Gleison - pedreiro
 *   Mazinho- líder
 *
 * ou:
 *   Presença Equipe Robert
 *   16/06/2026
 *
 *   Pedro da Silva Fonseca - Pedreiro
 *
 * Sujeira real encontrada e tolerada de propósito (não é bug, é o dado como
 * ele chega):
 *   · separador nome/função: " - ", "- ", "-" colado, e um caso isolado com "="
 *   · função sem acento / maiúscula solta: líder, Líder, lider, LIDER
 *   · erro de digitação repetido: "ajudantan" em vez de "ajudante"
 *   · função composta: "Motorista/Encanador", "Pedreiro/Lider"
 *   · listas sem cabeçalho de equipe (comum p/ motoristas — vira equipe null)
 */

export interface PresencaPessoa {
  nome: string
  funcao: string | null
  linhaOriginal: string
}

export interface ListaPresencaParseada {
  data: string | null          // ISO yyyy-mm-dd, quando dá para reconhecer
  dataTexto: string | null     // o que estava escrito, para conferência
  equipe: string | null        // null = lista sem cabeçalho de equipe (ex.: motoristas soltos)
  pessoas: PresencaPessoa[]
  avisos: string[]
}

// ─── normalização de função ─────────────────────────────────────────────────
// Dicionário construído a partir do que REALMENTE aparece no grupo — não é
// uma lista de cargos "corretos", é um mapa de grafia → forma canônica.
const FUNCAO_CANONICA: [RegExp, string][] = [
  [/^l[ií]der$/i, 'líder'],
  [/^ajudant\w*$/i, 'ajudante'],      // "ajudantan", "ajudanto" — erros de digitação recorrentes
  [/^pedreiro$/i, 'pedreiro'],
  [/^encanador$/i, 'encanador'],
  [/^motorista$/i, 'motorista'],
  [/^operador$/i, 'operador'],
  [/^retro$/i, 'operador de retroescavadeira'],
  [/^soldador( de pead)?$/i, 'soldador de PEAD'],
  [/^encarregado( de obra)?$/i, 'encarregado'],
  [/^apontador(a)?$/i, 'apontador'],
]

function normalizarFuncao(bruto: string): string {
  const limpo = bruto.trim().replace(/\s+/g, ' ')
  // função composta ("Motorista/Encanador") — normaliza cada metade e rejunta
  if (limpo.includes('/')) {
    return limpo.split('/').map((p) => normalizarFuncao(p)).join('/')
  }
  for (const [re, canon] of FUNCAO_CANONICA) {
    if (re.test(limpo)) return canon
  }
  return limpo.toLowerCase()
}

// ─── datas ───────────────────────────────────────────────────────────────────

/** "17/08" (sem ano — usa o ano da mensagem) ou "16/06/2026" (com ano). */
function extrairData(texto: string, anoPadrao: number): { iso: string | null; original: string | null } {
  const comAno = texto.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/)
  if (comAno) {
    const [, d, m, a] = comAno
    return { iso: `${a}-${m}-${d}`, original: comAno[0] }
  }
  const semAno = texto.match(/\b(\d{2})\/(\d{2})\b/)
  if (semAno) {
    const [, d, m] = semAno
    return { iso: `${anoPadrao}-${m}-${d}`, original: semAno[0] }
  }
  return { iso: null, original: null }
}

// ─── linha "Nome - Função" ───────────────────────────────────────────────────

/**
 * Aceita " - ", "- ", "-" colado, e o caso isolado com "=" (visto em mensagens
 * da Thatyane Borges, 29-31/07: "Diego=.encanador de água"). Rejeita linhas
 * que são claramente outra coisa (cabeçalho, vazia, só emoji).
 */
/**
 * Ao menos 3 linhas reais do grupo são um bloco de 2-3 pessoas colado sem
 * quebra de linha — prova de que a lista foi copiada do dia anterior sem
 * revisar (o mesmo bloco malformado se repete idêntico em 03/08, 04/08 e
 * 05/08). Não dá pra separar essas pessoas com segurança, então a linha
 * inteira é sinalizada para revisão manual em vez de virar um nome errado
 * no banco — errar silencioso é pior que pedir pra alguém olhar.
 */
function pareceMultiplasPessoasColadas(nome: string, funcao: string): boolean {
  const hifens = (funcao.match(/-/g) ?? []).length
  const nomeCompostoNaFuncao = /\b[A-ZÀ-Ý][a-zà-ÿ]+\s+[A-ZÀ-Ý][a-zà-ÿ]+/.test(funcao)
  return hifens >= 1 && nomeCompostoNaFuncao
}

function parseLinhaPessoa(linha: string): PresencaPessoa | null {
  // remove a marca do WhatsApp pra edição não virar parte do nome/função
  const l = linha.replace(/\s*<mensagem editada>\s*$/i, '').trim()
  if (!l) return null
  if (/^(equipe|lista de presen[çc]a|presen[çc]a equipe)\b/i.test(l)) return null
  if (/^<.*>$/.test(l)) return null // "<Mensagem editada>" sozinha na linha

  // separador "=" (variante rara, mas real)
  let m = l.match(/^([^=]+?)\s*=\.?\s*(.+)$/)
  if (m) {
    const nome = m[1].trim()
    if (pareceMultiplasPessoasColadas(nome, m[2])) return { nome: '', funcao: null, linhaOriginal: l }
    return { nome, funcao: normalizarFuncao(m[2]), linhaOriginal: l }
  }

  // separador "-" — primeiro hífen separa nome de função (composta pode ter
  // um segundo hífen, ex.: "Nome - motorista - encanador")
  m = l.match(/^(.+?)\s*-\s*(.+)$/)
  if (m) {
    const nome = m[1].trim()
    if (pareceMultiplasPessoasColadas(nome, m[2])) return { nome: '', funcao: null, linhaOriginal: l }
    return { nome, funcao: normalizarFuncao(m[2]), linhaOriginal: l }
  }

  // linha só com nome, sem função (acontece nas listas de motorista soltas)
  if (/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]{2,60}$/.test(l)) {
    return { nome: l, funcao: null, linhaOriginal: l }
  }
  return null
}

// ─── parser principal ────────────────────────────────────────────────────────

export function parseListaPresenca(
  textoMensagem: string,
  dataDaMensagem: { dia: number; mes: number; ano: number },
): ListaPresencaParseada {
  const avisos: string[] = []
  const linhas = textoMensagem.split('\n').map((l) => l.trim())

  const { iso, original } = extrairData(textoMensagem, dataDaMensagem.ano)
  const dataFinal = iso ?? `${dataDaMensagem.ano}-${String(dataDaMensagem.mes).padStart(2, '0')}-${String(dataDaMensagem.dia).padStart(2, '0')}`
  if (!iso) avisos.push('Sem data no texto — usando a data de envio da mensagem.')

  // cabeçalho de equipe: "EQUIPE - X", "EQUIPE- X", "Equipe X", "Presença Equipe X"
  let equipe: string | null = null
  for (const l of linhas) {
    const m = l.match(/^(?:equipe|presen[çc]a equipe)\s*[-:]?\s*(.+)$/i)
    if (m) {
      // remove data colada no fim ("Equipe- GILVAN 03/07/2026") e local ("- São cleto")
      equipe = m[1]
        .replace(/\b\d{2}\/\d{2}(\/\d{4})?\b/, '')
        .split(/\s+-\s+/)[0]   // "GILVAN - São cleto" → "GILVAN"
        .trim()
      break
    }
  }
  if (!equipe) avisos.push('Sem cabeçalho de equipe — lista solta (comum para motoristas).')

  const pessoas: PresencaPessoa[] = []
  for (const l of linhas) {
    if (/^(lista de presen[çc]a|presen[çc]a equipe|equipe)\b/i.test(l)) continue
    if (/^\d{2}\/\d{2}(\/\d{4})?\s*$/.test(l)) continue // linha que é só a data
    const p = parseLinhaPessoa(l)
    if (!p) continue
    if (!p.nome) {
      avisos.push(`Linha com mais de um nome colado, não dá pra separar com segurança: "${p.linhaOriginal}" — revisar manualmente.`)
      continue
    }
    pessoas.push(p)
  }
  if (pessoas.length === 0) avisos.push('Nenhuma pessoa reconhecida no texto.')

  return { data: dataFinal, dataTexto: original, equipe, pessoas, avisos }
}

/** É essa mensagem uma lista de presença? (mesmo teste usado para filtrar o histórico) */
export function ehListaDePresenca(texto: string): boolean {
  return /^\s*(lista de presen[çc]a|presen[çc]a equipe)/i.test(texto)
}
