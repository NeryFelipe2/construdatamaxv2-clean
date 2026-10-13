/**
 * casarPessoaPresenca.ts — liga o nome bruto da Lista de Presença a uma linha
 * de `pessoas` (é essa tabela que `rdo_presenca.pessoa_id` referencia — não
 * `funcionarios`).
 *
 * Por que não decide sozinho no caso ambíguo: a tabela `pessoas` tem nomes
 * genéricos convivendo com o nome completo da mesma pessoa (ex.: "Felipe" e
 * "Felipe Ferraz Ribeiro" são duas linhas diferentes; o mesmo acontece com
 * Anderson, Édson, Márcio). Advinhar automaticamente qual delas é a pessoa da
 * lista arriscaria juntar a frequência de uma pessoa na conta de outra — pior
 * do que não gravar. Por isso este arquivo só AUTO-RESOLVE (`resolvido`)
 * quando não há ambiguidade nenhuma; o resto vira `candidatos` para alguém
 * escolher na tela.
 *
 * `estimado` é o meio-termo: erro de grafia/transcrição contra UM candidato só
 * (ex.: "Gilvan"/"Jilvan", "Higor"/"Igor") — vem pré-selecionado na tela em vez
 * de bloquear, mas continua visível e editável, porque a mesma métrica também
 * pode aproximar nomes que só PARECEM iguais ("Cristiano" não é "Christian").
 */

export interface PessoaBase {
  id: string
  nome_completo: string
  apelido: string | null
}

export type ResultadoCasamento =
  | { status: 'resolvido'; pessoa: PessoaBase; motivo: 'nome_exato' | 'apelido' | 'primeiro_nome_unico' | 'sobrenome_unico' }
  | { status: 'estimado'; pessoa: PessoaBase; confianca: number }
  | { status: 'ambiguo'; candidatos: PessoaBase[] }
  | { status: 'nao_encontrado' }

/** Remove acento sem depender de regex com faixa Unicode escapada (evita
 *  corrupção de escape ao editar em pipelines que reinterpretam \u). */
function semAcento(s: string): string {
  return s
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0
      return cp < 0x0300 || cp > 0x036f // fora do bloco de diacríticos combinantes
    })
    .join('')
}

function normalizar(s: string): string {
  return semAcento(s)
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .replace(/\bJR\b/g, 'JUNIOR') // "Jr"/"Jr." — mesma pessoa que "Junior" na base
    .trim()
    .replace(/\s+/g, ' ')
}

function primeiroToken(nome: string): string {
  return normalizar(nome).split(' ')[0] ?? ''
}

// ─── fallback fuzzy (erro de grafia/transcrição, ex.: "Gilvan"/"Jilvan",
//     "Higor"/"Igor") ────────────────────────────────────────────────────────
// Mesmo corte (0.8) e mesma métrica (dice de bigramas) do R4 de
// src/lib/matching/pessoaMatch.ts — aqui aplicado por TOKEN (não na string
// inteira) porque o nome bruto costuma ser só o primeiro nome contra um
// nome_completo bem mais longo, e dicear a string inteira penaliza demais a
// diferença de tamanho. Cuidado: isto pode aproximar nomes DIFERENTES que só
// parecem-se ("Cristiano" e "Christian" não são a mesma pessoa) — por isso o
// resultado vem marcado 'estimado' (nunca 'resolvido'), pra quem grava poder
// conferir antes.
const DICE_MIN = 0.8

function bigramas(s: string): Map<string, number> {
  const m = new Map<string, number>()
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2)
    m.set(bg, (m.get(bg) ?? 0) + 1)
  }
  return m
}

function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const ba = bigramas(a)
  const bb = bigramas(b)
  let inter = 0
  let totalA = 0
  let totalB = 0
  for (const n of ba.values()) totalA += n
  for (const n of bb.values()) totalB += n
  for (const [bg, n] of ba) {
    const nb = bb.get(bg)
    if (nb) inter += Math.min(n, nb)
  }
  return (2 * inter) / (totalA + totalB)
}

/** Pior caso entre os tokens do nome bruto: cada token do nome bruto precisa
 *  achar algum token do candidato parecido (senão um "Fulano de Tal" bateria
 *  só por causa do sobrenome comum). */
function piorDicePorToken(tokensAlvo: string[], nomeCompletoCandidato: string): number {
  const tokensCand = normalizar(nomeCompletoCandidato).split(' ').filter(Boolean)
  let pior = 1
  for (const t of tokensAlvo) {
    if (t.length < 4) return 0 // token curto demais — dice não é confiável (poucos bigramas)
    let melhorDoToken = 0
    for (const tc of tokensCand) melhorDoToken = Math.max(melhorDoToken, diceCoefficient(t, tc))
    pior = Math.min(pior, melhorDoToken)
  }
  return pior
}

export function casarPessoa(nomeBruto: string, base: PessoaBase[]): ResultadoCasamento {
  const alvo = normalizar(nomeBruto)
  if (!alvo) return { status: 'nao_encontrado' }

  // 1) nome completo bate exato
  const exato = base.filter((p) => normalizar(p.nome_completo) === alvo)
  if (exato.length === 1) return { status: 'resolvido', pessoa: exato[0], motivo: 'nome_exato' }
  if (exato.length > 1) return { status: 'ambiguo', candidatos: exato }

  // 2) apelido bate exato
  const porApelido = base.filter((p) => p.apelido && normalizar(p.apelido) === alvo)
  if (porApelido.length === 1) return { status: 'resolvido', pessoa: porApelido[0], motivo: 'apelido' }
  if (porApelido.length > 1) return { status: 'ambiguo', candidatos: porApelido }

  const tokensAlvo = alvo.split(' ').filter(Boolean)

  // 3) nome de 2+ palavras: o nome completo do candidato contém TODOS os
  //    tokens do nome bruto (ex.: "Felipe Ribeiro" → "Felipe Ferraz Ribeiro")
  if (tokensAlvo.length >= 2) {
    const porTokens = base.filter((p) => {
      const nc = normalizar(p.nome_completo)
      return tokensAlvo.every((t) => nc.includes(t))
    })
    if (porTokens.length === 1) return { status: 'resolvido', pessoa: porTokens[0], motivo: 'sobrenome_unico' }
    if (porTokens.length > 1) return { status: 'ambiguo', candidatos: porTokens }
  }

  // 4) só primeiro nome — só resolve sozinho se for único na base inteira, E só
  //    quando o nome bruto É de fato um primeiro nome sozinho (1 token). Se o
  //    nome bruto tem 2+ tokens e já falhou o passo 3 (nenhum candidato contém
  //    todos), o segundo token é informação NOVA contra achar que é a mesma
  //    pessoa do "primeiro nome único" — ex.: "Marcos Vinicius" não é "Marcos
  //    Jose Farias da Silva" só porque ele é o único Marcos da base; é sinal de
  //    que "Marcos Vinicius" é OUTRA pessoa, ainda sem cadastro.
  //    (não filtra "nome genérico vs nome completo": ambos contam como
  //    candidatos, porque são registros DIFERENTES na tabela e a escolha
  //    entre eles é exatamente o tipo de decisão que precisa de humano)
  if (tokensAlvo.length === 1) {
    const porPrimeiroNome = base.filter((p) => primeiroToken(p.nome_completo) === tokensAlvo[0])
    if (porPrimeiroNome.length === 1) return { status: 'resolvido', pessoa: porPrimeiroNome[0], motivo: 'primeiro_nome_unico' }
    if (porPrimeiroNome.length > 1) return { status: 'ambiguo', candidatos: porPrimeiroNome }
  }

  // 5) fuzzy — só como último recurso, quando não achou NADA acima
  const porDice = base
    .map((p) => ({ pessoa: p, score: piorDicePorToken(tokensAlvo, p.nome_completo) }))
    .filter((c) => c.score >= DICE_MIN)
  if (porDice.length === 1) return { status: 'estimado', pessoa: porDice[0].pessoa, confianca: porDice[0].score }
  if (porDice.length > 1) return { status: 'ambiguo', candidatos: porDice.map((c) => c.pessoa) }

  return { status: 'nao_encontrado' }
}
