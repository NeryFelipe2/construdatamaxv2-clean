/**
 * planilhaFcp.ts — leitor da planilha FLUXO DE CAIXA PROJETADO (FCP).
 *
 * A migration 026 diz explicitamente: "Espelha a planilha
 * FLUXO_CAIXA_PROJETADO_BERTIOGA_SANTOS_v4.xlsx (11 abas)". Este leitor lê essa
 * MESMA planilha real (testado contra ela) — não um formato inventado.
 *
 * O QUE ESTE LEITOR SABE LER: contrato "ticket × margem-alvo" — a WCR mede em
 * UNIDADES de serviço (ligação de água, ligação de esgoto…), tem um PREÇO
 * MÉDIO por unidade (o "ticket"), e o fluxo calcula quanto precisa produzir
 * para bater a margem do cenário escolhido. É o modelo de Bertioga+Santos e
 * de qualquer obra parecida (água/esgoto por ligação).
 *
 * O QUE ESTE LEITOR NÃO SABE LER (e AVISA em vez de inventar):
 *   · Contrato por EVENTO DA EAP a preço fechado por elevatória (ex.:
 *     CUBATÃO — 3 EEE tunnel liner) — não tem "ticket por unidade", tem %
 *     de um valor fixo por evento concluído. É outro modelo de cálculo,
 *     que o schema fcp_* (e a função fcp_semanas()) não representa hoje.
 *   · Contrato com produção ESTIMADA diretamente em vez de calculada a
 *     partir da margem-alvo (ex.: INTEGRA TIETÊ — "produção por frente"
 *     em m/mês nos cenários PESSIMISTA/REALISTA/OTIMISTA). Além do método
 *     ser diferente, os NOMES de cenário nem cabem no CHECK do banco
 *     ('MÍNIMA','MÉDIA','BOA','ÓTIMA') — forçar geraria erro no banco ou,
 *     pior, um cenário errado sem avisar.
 * Detectar esses dois casos e AVISAR é o comportamento certo — mais honesto
 * que aproximar um número que não é o que o contrato diz.
 *
 * ESTRUTURA POR OBRA: cada obra dentro do FCP é um par de abas
 * "CUSTOS <NOME>" + "PREÇOS <NOME>". Uma planilha pode ter 1 obra (ex.:
 * Integra Tietê) ou várias (Bertioga + Santos no mesmo arquivo).
 *
 * PREMISSAS é lida por RÓTULO (coluna B = texto, coluna C = valor), não por
 * número de linha fixo — os rótulos mudam de posição entre arquivos (Cubatão
 * tem 33 linhas, Bertioga+Santos tem 52). Por isso a leitura casa por texto
 * (com tolerância de acento/maiúscula), do mesmo jeito que o `_find_kv` do
 * apontamento por texto.
 */
import * as XLSX from 'xlsx'
import { norm, paraNumero } from './diff'

// ─── tipos de saída ──────────────────────────────────────────────────────────

export interface FcpPremissasLidas {
  inicio_obra: string | null
  fim_operacao: string | null
  dias_mes: number | null
  defasagem_dias: number | null
  imposto_aliquota: number | null
  cenario: 'MÍNIMA' | 'MÉDIA' | 'BOA' | 'ÓTIMA' | null
  margem_minima: number | null
  margem_media: number | null
  margem_boa: number | null
  margem_otima: number | null
  contingencia: number | null
  fator_primeiro_mes: number | null
  paga_folha: 'CONSÓRCIO' | 'WCR' | null
  paga_engenheiro: 'CONSÓRCIO' | 'WCR' | null
  paga_estrutura: 'CONSÓRCIO' | 'WCR' | null
  paga_indiretos: 'CONSÓRCIO' | 'WCR' | null
  paga_mobilizacao: 'CONSÓRCIO' | 'WCR' | null
  desconta_medicao: boolean | null
  base_imposto: 'MEDIÇÃO CHEIA' | 'LÍQUIDA DO DESCONTO' | null
}

export interface FcpPessoaLida {
  equipe: string | null
  nome: string
  cargo: string | null
  salario: number
  encargos: number
  beneficios: number
}

export interface FcpCustoGeralLido {
  item: string
  categoria: 'folha' | 'engenheiro' | 'estrutura' | 'indiretos'
  quantidade: number
  valor_unitario: number
}

export interface FcpPrecoLido {
  descricao: string
  numero_preco: string | null
  unidade: string | null
  valor_unitario: number | null
  requer_conferencia: boolean
}

export interface FcpObraLida {
  nome: string
  ticket_unico: number | null
  ticket_agua: number | null
  ticket_esgoto: number | null
  pct_esgoto: number | null
  mobilizacao: number
  pessoas: FcpPessoaLida[]
  gerais: FcpCustoGeralLido[]
  precos: FcpPrecoLido[]
}

export interface LeituraFcp {
  premissas: FcpPremissasLidas
  obras: FcpObraLida[]
  /** obras encontradas na planilha mas que o leitor recusou (modelo incompatível) */
  obrasIgnoradas: { nome: string; motivo: string }[]
  avisos: string[]
}

// ─── helpers de leitura de sheet ─────────────────────────────────────────────

type Celula = unknown
type Linha = Celula[]

function valorCelula(c: Celula): unknown {
  if (c && typeof c === 'object' && 'result' in (c as Record<string, unknown>)) {
    return (c as { result: unknown }).result
  }
  return c
}

function textoCelula(c: Celula): string {
  const v = valorCelula(c)
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).trim()
}

function isoData(c: Celula): string | null {
  const v = valorCelula(c)
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return m[0].slice(0, 10)
  }
  return null
}

function numeroCelula(c: Celula): number | null {
  const v = valorCelula(c)
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') return paraNumero(v)
  return null
}

function sheetParaMatriz(ws: XLSX.WorkSheet): Linha[] {
  return XLSX.utils.sheet_to_json<Linha>(ws, { header: 1, raw: true, defval: null })
}

/** true quando TODAS as celulas relevantes de uma linha "gerais/preços" vêm vazias — linha em branco. */
function linhaVazia(l: Linha): boolean {
  return l.every((c) => textoCelula(c) === '')
}

// ─── PREMISSAS: casamento por rótulo ─────────────────────────────────────────

const CENARIO_TAGS = new Set(['MÍNIMA', 'MEDIA', 'MÉDIA', 'BOA', 'ÓTIMA', 'OTIMA'])

function normCenario(s: string): 'MÍNIMA' | 'MÉDIA' | 'BOA' | 'ÓTIMA' | null {
  const n = norm(s)
  if (n === 'minima') return 'MÍNIMA'
  if (n === 'media') return 'MÉDIA'
  if (n === 'boa') return 'BOA'
  if (n === 'otima') return 'ÓTIMA'
  return null
}

function normQuemPaga(s: string): 'CONSÓRCIO' | 'WCR' | null {
  const n = norm(s)
  if (n.startsWith('consorcio')) return 'CONSÓRCIO'
  if (n === 'wcr') return 'WCR'
  return null
}

/**
 * Descobre em que ÍNDICE do array moram os RÓTULOS das premissas.
 *
 * ATENÇÃO — a lição que já custou três bugs neste arquivo: o índice do array
 * que o sheet_to_json devolve NÃO é a letra da coluna do Excel. Ele é relativo
 * ao INÍCIO DO INTERVALO USADO da aba (`!ref`). Nas três planilhas reais o
 * rótulo está na mesma coluna B; o que muda é o intervalo:
 *
 *   Bertioga+Santos  !ref = A2:E61  → começa em A → rótulo (col B) = índice 1
 *   Integra Tietê    idem                          → índice 1
 *   Cubatão          !ref = B2:H41  → começa em B → rótulo (col B) = índice 0
 *
 * O Cubatão não escreve nada na coluna A (as outras usam a A para as tags de
 * cenário: MÍNIMA/MÉDIA/…, PESSIMISTA/…), então o intervalo dele começa uma
 * coluna à frente e TODO o array anda um índice para a esquerda. Com índice
 * fixo, as premissas do Cubatão voltavam todas nulas — e isso era lido como
 * "este contrato não tem premissas", quando elas estavam lá o tempo todo.
 *
 * Por isso: descobrir a posição ancorando em rótulos conhecidos, nunca assumir.
 */
function acharColunaRotulo(matriz: Linha[]): number {
  const ancoras = ['inicio da obra', 'fim da operacao', 'dias por mes', 'imposto', 'contingencia']
  for (const linha of matriz) {
    for (const col of [1, 0]) {
      const t = norm(textoCelula(linha[col]))
      if (t && ancoras.some((a) => t.startsWith(a))) return col
    }
  }
  return 1
}

function lerPremissas(matriz: Linha[], avisos: string[]): FcpPremissasLidas {
  const p: FcpPremissasLidas = {
    inicio_obra: null, fim_operacao: null, dias_mes: null, defasagem_dias: null,
    imposto_aliquota: null, cenario: null,
    margem_minima: null, margem_media: null, margem_boa: null, margem_otima: null,
    contingencia: null, fator_primeiro_mes: null,
    paga_folha: null, paga_engenheiro: null, paga_estrutura: null, paga_indiretos: null, paga_mobilizacao: null,
    desconta_medicao: null, base_imposto: null,
  }

  const colRotulo = acharColunaRotulo(matriz)

  for (const linha of matriz) {
    // a tag de cenário mora na coluna imediatamente à esquerda do rótulo —
    // quando o rótulo já está na coluna A, não existe coluna de tag.
    const tagA = colRotulo >= 1 ? textoCelula(linha[colRotulo - 1]) : ''
    const rotulo = norm(textoCelula(linha[colRotulo]))
    if (!rotulo) continue
    const valCel = linha[colRotulo + 1]

    // margens por cenário: a coluna A traz o TAG do cenário (mais confiável
    // que casar o texto da coluna B, que varia de arquivo pra arquivo)
    if (CENARIO_TAGS.has(tagA) && rotulo.startsWith('margem do cenario')) {
      const c = normCenario(tagA); const v = numeroCelula(valCel)
      if (c === 'MÍNIMA') p.margem_minima = v
      else if (c === 'MÉDIA') p.margem_media = v
      else if (c === 'BOA') p.margem_boa = v
      else if (c === 'ÓTIMA') p.margem_otima = v
      continue
    }

    if (rotulo.startsWith('inicio da obra')) { p.inicio_obra = isoData(valCel); continue }
    if (rotulo.startsWith('fim da operacao')) { p.fim_operacao = isoData(valCel); continue }
    if (rotulo.startsWith('dias por mes')) { p.dias_mes = numeroCelula(valCel); continue }
    if (rotulo.includes('defasagem') && rotulo.includes('recebimento')) {
      // Bertioga/Santos: valor direto ("Defasagem de recebimento").
      // Cubatão: só existe a versão TOTAL (soma de duas premissas) — mesma
      // semântica (dias do fim do mês até o dinheiro cair na conta), então
      // serve igual. Só a primeira ocorrência conta (a "total" costuma vir
      // depois, computada a partir da direta, quando as duas existem).
      if (p.defasagem_dias === null) p.defasagem_dias = numeroCelula(valCel)
      continue
    }
    if (rotulo.startsWith('imposto')) { p.imposto_aliquota = numeroCelula(valCel); continue }
    if (rotulo.startsWith('cenario adotado')) {
      const txt = textoCelula(valCel)
      const c = normCenario(txt)
      if (c) p.cenario = c
      else avisos.push(`PREMISSAS: cenário "${txt}" não é um dos válidos do sistema (MÍNIMA/MÉDIA/BOA/ÓTIMA) — este contrato usa outro método de cálculo, não dá para importar o cenário.`)
      continue
    }
    if (rotulo.startsWith('contingencia')) { p.contingencia = numeroCelula(valCel); continue }
    if (rotulo.includes('fator') && rotulo.includes('1') && rotulo.includes('mes')) { p.fator_primeiro_mes = numeroCelula(valCel); continue }
    if (rotulo.includes('desconta') && rotulo.includes('medicao')) {
      const txt = norm(textoCelula(valCel))
      p.desconta_medicao = txt === 'sim' ? true : txt === 'nao' ? false : null
      continue
    }
    if (rotulo.startsWith('base do imposto')) {
      const txt = textoCelula(valCel).toUpperCase()
      if (txt.includes('CHEIA')) p.base_imposto = 'MEDIÇÃO CHEIA'
      else if (txt.includes('LIQUIDA') || txt.includes('LÍQUIDA')) p.base_imposto = 'LÍQUIDA DO DESCONTO'
      continue
    }
    if (rotulo.includes('quem paga')) {
      const qp = normQuemPaga(textoCelula(valCel))
      if (!qp) continue
      if (rotulo.includes('folha')) p.paga_folha = qp
      else if (rotulo.includes('engenheiro')) p.paga_engenheiro = qp
      else if (rotulo.includes('estrutura') || rotulo.includes('locac')) p.paga_estrutura = qp
      else if (rotulo.includes('indireto')) p.paga_indiretos = qp
      else if (rotulo.includes('mobiliza')) p.paga_mobilizacao = qp
      continue
    }
  }

  return p
}

/** ticket/mobilização são POR OBRA — a linha de rótulo cita o nome da obra. */
function lerTicketEMobilizacao(matriz: Linha[], nomeObra: string): {
  ticket_unico: number | null; ticket_agua: number | null; ticket_esgoto: number | null
  pct_esgoto: number | null; mobilizacao: number | null
} {
  const alvo = norm(nomeObra)
  let ticket_unico: number | null = null
  let ticket_agua: number | null = null
  let ticket_esgoto: number | null = null
  let pct_esgoto: number | null = null
  let mobilizacao: number | null = null

  const colRotulo = acharColunaRotulo(matriz)

  for (const linha of matriz) {
    const rotulo = norm(textoCelula(linha[colRotulo]))
    if (!rotulo || !rotulo.includes(alvo)) continue
    const v = numeroCelula(linha[colRotulo + 1])
    if (v === null) continue
    if (rotulo.includes('ticket medio por servico') || (rotulo.includes('ticket') && !rotulo.includes('agua') && !rotulo.includes('esgoto'))) {
      ticket_unico = v
    } else if (rotulo.includes('ticket agua')) {
      ticket_agua = v
    } else if (rotulo.includes('ticket esgoto')) {
      ticket_esgoto = v
    } else if (rotulo.includes('servicos que sao esgoto') || rotulo.includes('% dos servicos')) {
      pct_esgoto = v
    } else if (rotulo.includes('custos iniciais') || rotulo.includes('mobilizacao paga')) {
      mobilizacao = v
    }
  }
  // obra com mix (água+esgoto) não tem ticket único — some por definição.
  if (ticket_agua !== null && ticket_esgoto !== null) ticket_unico = null
  return { ticket_unico, ticket_agua, ticket_esgoto, pct_esgoto, mobilizacao }
}

// ─── CUSTOS <OBRA> ───────────────────────────────────────────────────────────

function lerCustos(matriz: Linha[], avisos: string[], nomeObra: string): {
  pessoas: FcpPessoaLida[]; gerais: FcpCustoGeralLido[]
} {
  const pessoas: FcpPessoaLida[] = []
  const gerais: FcpCustoGeralLido[] = []

  // acha a linha de cabeçalho da equipe: tem CARGO e (SALÁRIO ou SALÁRIO BASE)
  let iCabEquipe = -1
  let temNome = false
  for (let i = 0; i < matriz.length; i++) {
    const cels = matriz[i].map((c) => norm(textoCelula(c)))
    if (cels.some((c) => c === 'cargo') && cels.some((c) => c.startsWith('salario'))) {
      iCabEquipe = i
      temNome = cels.some((c) => c === 'nome')
      break
    }
  }

  if (iCabEquipe >= 0) {
    const cab = matriz[iCabEquipe].map((c) => norm(textoCelula(c)))
    const idx = {
      equipe: cab.findIndex((c) => c === 'equipe'),
      nome: cab.findIndex((c) => c === 'nome'),
      cargo: cab.findIndex((c) => c === 'cargo'),
      qnt: cab.findIndex((c) => c === 'qnt'),
      salario: cab.findIndex((c) => c.startsWith('salario')),
      encargos: cab.findIndex((c) => c === 'encargos'),
      beneficios: cab.findIndex((c) => c.startsWith('beneficio')),
      total: cab.findIndex((c) => c.startsWith('total')),
    }
    for (let i = iCabEquipe + 1; i < matriz.length; i++) {
      const l = matriz[i]
      if (linhaVazia(l)) continue
      // O rótulo de fechamento ("TOTAL", "CUSTOS GERAIS DA OBRA…") mora na
      // MESMA coluna do cabeçalho EQUIPE (idx.equipe, geralmente a coluna A) —
      // não numa posição fixa: a aba PREMISSAS usa a coluna A para as tags de
      // cenário e por isso tem uma coluna a mais no início; a CUSTOS <OBRA>
      // não usa coluna A pra nada, então aqui a primeira coluna real já É a
      // EQUIPE. Ler a posição fixa errada aqui foi o bug: o loop não parava no
      // TOTAL e continuava lendo o bloco de CUSTOS GERAIS como se fossem
      // pessoas, DOBRANDO o custo de folha.
      const colRotulo = idx.equipe >= 0 ? idx.equipe : 0
      const primeira = norm(textoCelula(l[colRotulo]))
      if (primeira.startsWith('total')) break // fechou o quadro nominal
      if (primeira.startsWith('custos gerais')) break // Integra Tietê não tem linha TOTAL antes

      if (temNome) {
        // quadro nominal (Bertioga/Santos): 1 linha = 1 pessoa
        const cargo = idx.cargo >= 0 ? textoCelula(l[idx.cargo]) : null
        let nome = idx.nome >= 0 ? textoCelula(l[idx.nome]) : ''
        if (!nome) {
          if (!cargo) continue
          nome = cargo
          avisos.push(`${nomeObra}: linha sem nome (cargo "${cargo}") — usei o cargo como nome, confira quem é.`)
        }
        const salario = idx.salario >= 0 ? numeroCelula(l[idx.salario]) ?? 0 : 0
        const encargos = idx.encargos >= 0 ? numeroCelula(l[idx.encargos]) ?? 0 : 0
        const beneficios = idx.beneficios >= 0 ? numeroCelula(l[idx.beneficios]) ?? 0 : 0
        pessoas.push({
          equipe: idx.equipe >= 0 ? (textoCelula(l[idx.equipe]) || null) : null,
          nome, cargo: cargo || null, salario, encargos, beneficios,
        })
      } else {
        // quadro por cargo, sem nomes (Cubatão/Integra Tietê): não dá pra
        // criar "pessoa" sem nome — vira custo geral (categoria folha),
        // quantidade × total por pessoa, que reproduz o mesmo subtotal.
        const cargo = idx.cargo >= 0 ? textoCelula(l[idx.cargo]) : ''
        if (!cargo) continue
        const qnt = idx.qnt >= 0 ? numeroCelula(l[idx.qnt]) ?? 1 : 1
        const totalPessoa = idx.total >= 0 ? numeroCelula(l[idx.total]) : null
        if (totalPessoa === null) continue
        gerais.push({ item: cargo, categoria: 'folha', quantidade: qnt, valor_unitario: totalPessoa / (qnt || 1) })
      }
    }
  } else {
    avisos.push(`${nomeObra}: não encontrei o quadro de equipe (procurei uma linha com CARGO e SALÁRIO) — custo de folha não foi importado.`)
  }

  // ── bloco "CUSTOS GERAIS DA OBRA" ──
  let iCabGeral = -1
  for (let i = 0; i < matriz.length; i++) {
    const cels = matriz[i].map((c) => norm(textoCelula(c)))
    if (cels.some((c) => c === 'item') && cels.some((c) => c.startsWith('valor unit'))) { iCabGeral = i; break }
  }
  if (iCabGeral >= 0) {
    const cab = matriz[iCabGeral].map((c) => norm(textoCelula(c)))
    const idx = {
      item: cab.findIndex((c) => c === 'item'),
      qnt: cab.findIndex((c) => c === 'qnt'),
      valorUnit: cab.findIndex((c) => c.startsWith('valor unit')),
    }
    for (let i = iCabGeral + 1; i < matriz.length; i++) {
      const l = matriz[i]
      if (linhaVazia(l)) continue
      const item = idx.item >= 0 ? textoCelula(l[idx.item]) : ''
      const itemN = norm(item)
      if (!item || itemN.startsWith('total')) break
      // a linha "Equipe (folha+encargos+beneficios)" é a MESMA folha já
      // contada no quadro nominal (ou no bloco acima, no caso sem nome) —
      // importar de novo aqui DOBRARIA o custo de folha.
      if (itemN.startsWith('equipe (folha') || itemN.startsWith('equipe (folha+')) continue

      const qnt = idx.qnt >= 0 ? numeroCelula(l[idx.qnt]) ?? 1 : 1
      const valorUnit = idx.valorUnit >= 0 ? numeroCelula(l[idx.valorUnit]) ?? 0 : 0
      const categoria: FcpCustoGeralLido['categoria'] =
        itemN.includes('indireto') ? 'indiretos' :
        itemN.includes('engenheiro') ? 'engenheiro' : 'estrutura'
      gerais.push({ item, categoria, quantidade: qnt, valor_unitario: valorUnit })
    }
  }

  return { pessoas, gerais }
}

// ─── PREÇOS <OBRA> ───────────────────────────────────────────────────────────

function lerPrecos(matriz: Linha[]): FcpPrecoLido[] {
  const precos: FcpPrecoLido[] = []
  let iCab = -1
  for (let i = 0; i < matriz.length; i++) {
    const cels = matriz[i].map((c) => norm(textoCelula(c)))
    if (cels.some((c) => c === 'descricao') && cels.some((c) => c.includes('unit'))) { iCab = i; break }
  }
  if (iCab < 0) return precos

  const cab = matriz[iCab].map((c) => norm(textoCelula(c)))
  const idx = {
    descricao: cab.findIndex((c) => c === 'descricao'),
    numero: cab.findIndex((c) => c.startsWith('n') && c.includes('preco')),
    unidade: cab.findIndex((c) => c === 'un'),
    valor: cab.findIndex((c) => c.includes('unit')),
  }

  for (let i = iCab + 1; i < matriz.length; i++) {
    const l = matriz[i]
    if (linhaVazia(l)) continue
    const descricao = idx.descricao >= 0 ? textoCelula(l[idx.descricao]) : ''
    if (!descricao) continue
    // cabeçalho repetido: planilhas com mais de uma seção (ex.: SANTOS tem
    // "SERVIÇOS DE ESGOTO" e depois "SERVIÇOS DE ÁGUA", cada uma com seu
    // próprio título + cabeçalho ITEM/DESCRIÇÃO/N.PREÇO/UN/R$ UNIT.) repetem a
    // linha de cabeçalho no meio da tabela — sem pular, ela vira um "preço"
    // fantasma com descrição "DESCRIÇÃO" e valor nulo.
    if (norm(descricao) === 'descricao') continue
    const numeroTxt = idx.numero >= 0 ? textoCelula(l[idx.numero]) : ''
    // linha de título de seção: a planilha mescla células e o leitor repete o
    // mesmo texto longo em várias colunas — número de preço igual à descrição
    // é a marca disso (um código de preço de verdade nunca é a frase toda).
    if (numeroTxt && norm(numeroTxt) === norm(descricao)) continue
    // linha de observação solta ("(o preço é editado na PREMISSAS...)") — sem
    // nenhuma das outras colunas preenchida.
    const unidadeTxt = idx.unidade >= 0 ? textoCelula(l[idx.unidade]) : ''
    const valor = idx.valor >= 0 ? numeroCelula(l[idx.valor]) : null
    if (!unidadeTxt && valor === null && !numeroTxt) continue

    precos.push({
      descricao,
      numero_preco: numeroTxt && numeroTxt !== '—' ? numeroTxt : null,
      unidade: unidadeTxt && unidadeTxt !== '—' ? unidadeTxt : null,
      valor_unitario: valor,
      requer_conferencia: valor === null || valor <= 0,
    })
  }
  return precos
}

// ─── leitura completa ────────────────────────────────────────────────────────

export function lerPlanilhaFcp(buffer: ArrayBuffer): LeituraFcp {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const avisos: string[] = []
  const obras: FcpObraLida[] = []
  const obrasIgnoradas: LeituraFcp['obrasIgnoradas'] = []

  const abaPremissas = wb.SheetNames.find((n) => norm(n) === 'premissas')
  if (!abaPremissas) {
    avisos.push('Não encontrei a aba PREMISSAS — use o modelo de FCP (mesmo layout da FLUXO_CAIXA_PROJETADO_*.xlsx).')
    return { premissas: lerPremissas([], avisos), obras: [], obrasIgnoradas: [], avisos }
  }
  const premissas = lerPremissas(sheetParaMatriz(wb.Sheets[abaPremissas]), avisos)

  // ── acha os pares CUSTOS <NOME> / PREÇOS <NOME> ──
  const abasCustos = wb.SheetNames.filter((n) => norm(n).startsWith('custos '))
  for (const abaCusto of abasCustos) {
    const nomeObra = abaCusto.replace(/^custos\s+/i, '').trim()
    const alvo = norm(nomeObra)

    const abaPreco = wb.SheetNames.find((n) => {
      const nn = norm(n)
      return (nn.startsWith('precos ') || nn.startsWith('preços ')) && nn.includes(alvo)
    })
    const abaEap = wb.SheetNames.find((n) => norm(n).includes('eap') && norm(n).includes(alvo))

    if (!abaPreco) {
      if (abaEap) {
        obrasIgnoradas.push({
          nome: nomeObra,
          motivo: 'este contrato é medido por EVENTO DA EAP (% de um valor fechado por elevatória/estrutura), não por preço unitário de serviço — o sistema hoje só calcula fluxo de caixa no modelo "ticket por unidade". Precisa entrar manualmente ou pedir para estender o cálculo.',
        })
      } else {
        obrasIgnoradas.push({ nome: nomeObra, motivo: 'não encontrei a aba de preços (PREÇOS ' + nomeObra.toUpperCase() + ') correspondente.' })
      }
      continue
    }

    const matrizCustos = sheetParaMatriz(wb.Sheets[abaCusto])
    const { pessoas, gerais } = lerCustos(matrizCustos, avisos, nomeObra)
    const precos = lerPrecos(sheetParaMatriz(wb.Sheets[abaPreco]))
    const ticket = lerTicketEMobilizacao(sheetParaMatriz(wb.Sheets[abaPremissas]), nomeObra)

    if (ticket.ticket_unico === null && (ticket.ticket_agua === null || ticket.ticket_esgoto === null)) {
      obrasIgnoradas.push({
        nome: nomeObra,
        motivo: 'não encontrei o preço médio por serviço (ticket) desta obra nas PREMISSAS — sem ele não dá para calcular quanto produzir, e o banco exige um ticket preenchido.',
      })
      continue
    }

    obras.push({
      nome: nomeObra.toUpperCase(),
      ticket_unico: ticket.ticket_unico,
      ticket_agua: ticket.ticket_agua,
      ticket_esgoto: ticket.ticket_esgoto,
      pct_esgoto: ticket.pct_esgoto,
      mobilizacao: ticket.mobilizacao ?? 0,
      pessoas, gerais, precos,
    })
  }

  if (obras.length === 0 && obrasIgnoradas.length === 0) {
    avisos.push('Não encontrei nenhuma aba "CUSTOS <obra>" nesta planilha.')
  }

  return { premissas, obras, obrasIgnoradas, avisos }
}
