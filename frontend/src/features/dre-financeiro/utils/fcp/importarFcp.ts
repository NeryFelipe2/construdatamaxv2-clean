/**
 * A planilha do FCP, lida pelo sistema.
 *
 * ⚠️ **A diferença para o Controle de Caixa é o que decide o desenho.** Aquela planilha é uma
 * LISTA: o sistema lê tudo. Esta é uma CALCULADORA: o sistema lê só as **entradas** (PREMISSAS,
 * CUSTOS, PREÇOS e a produção realizada) e **recalcula** o resto.
 *
 * As abas calculadas — FCP MENSAL, ECONÔMICO, VIABILIDADE — não são importadas: são **conferidas**.
 * O motor calcula, compara com o que está na planilha e aponta onde os dois discordam. É isso que
 * responde ao pedido de "o sistema identificar valores errados": se alguém mexeu numa fórmula,
 * aparece aqui em vez de aparecer na reunião.
 */
import type {
  BaseDoImposto, BlocoDeCusto, Cenario, CidadeFcp, CustoGeral, PessoaDoQuadro, PremissasFcp,
  QuemPaga,
} from './tipos'
import { ROTULO_CENARIO } from './tipos'
import {
  capitalNecessario, custoMensalDaCidade, custoMensalGlobal, custosPorRegime, fluxoEconomico,
  fluxoMensal, ticketDaCidade, totalDaFolha,
} from './motor'
import { lerValor, normalizarTexto, type Celula, type Matriz } from '../controleDeCaixaPlanilha'

export interface ProblemaDeLeitura {
  aba: string
  onde?: string
  motivo: string
}

export interface Divergencia {
  aba: string
  oQue: string
  calculado: number
  naPlanilha: number
  diferenca: number
  /** Fração da diferença sobre o valor da planilha. Serve para ordenar pelo que mais importa. */
  proporcao: number
  /**
   * O porquê, quando dá para PROVAR a partir da própria planilha.
   *
   * ⚠️ Ausente quando não dá. "Não consegui identificar" é resposta melhor que um palpite: quem
   * lê isto vai decidir se confia no número, e uma causa inventada faria confiar do jeito errado.
   */
  causaProvavel?: string
}

/**
 * Uma conferência feita — batendo ou não. (Acréscimo do ConstruData, 16/09/2026: o pacote só
 * devolvia as divergências, e a tela parecia dizer que nada tinha batido. Regra 10: mostrar o acerto.)
 */
export interface ConferenciaFeita {
  aba: string
  oQue: string
  calculado: number
  /** `null` quando a célula não foi encontrada na planilha. */
  naPlanilha: number | null
  status: 'bateu' | 'divergiu' | 'nao_encontrado'
}

export interface PrecoDoContrato {
  item?: string
  descricao: string
  numeroPreco?: string
  unidade?: string
  valorUnitario: number
  /** A planilha marca itens transcritos de foto com dígito cortado. */
  precisaConferir: boolean
  observacao?: string
}

export interface LeituraFcp {
  premissas: PremissasFcp | null
  /** Produção lançada, por cidade e por semana. */
  realizado: Record<string, Record<number, number | undefined>>
  precos: Record<string, PrecoDoContrato[]>
  divergencias: Divergencia[]
  problemas: ProblemaDeLeitura[]
}

/** Uma aba já extraída do arquivo. Quem abre o .xlsx é o chamador — aqui tudo é puro. */
export type Abas = Record<string, Matriz>

// ─── Leitura das PREMISSAS ────────────────────────────────────────────────────

/**
 * Acha uma premissa pelo RÓTULO, não pela posição.
 *
 * ⚠️ De propósito. A planilha vai ganhar linha com o tempo, e ler `C28` fixo faria o sistema
 * importar o número errado em silêncio no dia em que alguém inserir uma linha acima. Pelo rótulo,
 * o pior caso é não achar — e aí a leitura avisa.
 */
export function acharPremissa(m: Matriz, ...pedacos: string[]): Celula {
  const alvos = pedacos.map(normalizarTexto)
  for (const linha of m) {
    for (let c = 0; c < (linha?.length ?? 0); c++) {
      const texto = normalizarTexto(linha[c])
      if (!texto) continue
      if (alvos.every((a) => texto.includes(a))) {
        // O valor é a primeira célula não vazia à direita do rótulo.
        for (let d = c + 1; d < linha.length; d++) {
          if (linha[d] !== null && linha[d] !== undefined && linha[d] !== '') return linha[d]
        }
      }
    }
  }
  return null
}

/**
 * O ÚLTIMO número da linha que contém o rótulo.
 *
 * ⚠️ Existe porque `acharPremissa` pega a primeira célula à direita, e em linha de TOTAL isso é a
 * célula errada: em `CUSTOS BERTIOGA` a linha "TOTAL / 15 pessoas" tem salário, encargos,
 * benefícios e só então o total — a primeira à direita é R$ 51.585, não R$ 106.692,84. Comparar
 * contra ela acusava 96% de divergência que não existia.
 */
export function acharUltimoNumero(m: Matriz, ...pedacos: string[]): number | null {
  const alvos = pedacos.map(normalizarTexto)
  for (const linha of m) {
    const texto = (linha ?? []).map(normalizarTexto).join(' ')
    if (!alvos.every((a) => texto.includes(a))) continue
    for (let c = (linha?.length ?? 0) - 1; c >= 0; c--) {
      const v = lerValor(linha[c])
      if (v !== null && v !== 0) return v
    }
  }
  return null
}

function lerData(v: Celula): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  const s = String(v ?? '').trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  return null
}

function lerQuemPaga(v: Celula): QuemPaga {
  // Qualquer coisa que não seja "consórcio" é a empresa — obra sem consórcio é o caso comum, e o
  // padrão seguro é a empresa pagar (o caixa fica mais apertado, não mais folgado).
  return normalizarTexto(v).includes('CONSORCIO') ? 'CONSORCIO' : 'EMPRESA'
}

function lerCenario(v: Celula): Cenario {
  const t = normalizarTexto(v)
  if (t.startsWith('MINIM')) return 'MINIMA'
  if (t.startsWith('MED')) return 'MEDIA'
  if (t.startsWith('BOA')) return 'BOA'
  return 'OTIMA'
}

function lerBaseDoImposto(v: Celula): BaseDoImposto {
  return normalizarTexto(v).includes('LIQUID') ? 'LIQUIDA_DO_DESCONTO' : 'CHEIA'
}

// ─── Leitura das abas de custo ────────────────────────────────────────────────

/**
 * A qual bloco do regime um item de custo pertence.
 *
 * É o que decide **quem paga** — e portanto o caixa inteiro. Item não reconhecido cai em
 * `estrutura`, que é o bloco onde a planilha põe tudo que não é folha, engenheiro nem indireto.
 */
export function blocoDoItem(descricao: string): BlocoDeCusto {
  const t = normalizarTexto(descricao)
  if (t.includes('ENGENHEIRO')) return 'engenheiro'
  if (t.includes('INDIRETO')) return 'indiretos'
  if (t.includes('MOBILIZ') || t.includes('ADIANTAMENTO')) return 'mobilizacao'
  if (t.includes('EQUIPE') && (t.includes('FOLHA') || t.includes('ENCARGO'))) return 'folha'
  return 'estrutura'
}

/**
 * Lê uma aba `CUSTOS <cidade>`: quadro nominal e custos gerais.
 *
 * ⚠️ A linha "Equipe (folha + encargos + benefícios)" dos custos gerais é o TOTAL do quadro
 * repetido — está lá para a soma da planilha fechar. Contá-la aqui dobraria a folha, e o custo
 * mensal sairia com R$ 106 mil a mais.
 */
export function lerAbaDeCustos(m: Matriz, aba: string): {
  quadro: PessoaDoQuadro[]
  gerais: CustoGeral[]
  problemas: ProblemaDeLeitura[]
} {
  const problemas: ProblemaDeLeitura[] = []
  const quadro: PessoaDoQuadro[] = []
  const gerais: CustoGeral[] = []

  let cabQuadro = -1
  let cabGerais = -1
  for (let i = 0; i < m.length; i++) {
    const linha = (m[i] ?? []).map(normalizarTexto)
    if (cabQuadro < 0 && linha.includes('NOME') && linha.includes('CARGO') && linha.includes('SALARIO')) cabQuadro = i
    if (cabGerais < 0 && linha.includes('ITEM') && linha.some((x) => x.includes('VALOR UNIT'))) cabGerais = i
  }

  if (cabQuadro >= 0) {
    const cab = (m[cabQuadro] ?? []).map(normalizarTexto)
    const col = (nome: string) => cab.findIndex((x) => x.includes(nome))
    const cEquipe = col('EQUIPE'), cNome = col('NOME'), cCargo = col('CARGO')
    const cSal = col('SALARIO'), cEnc = col('ENCARGO'), cBen = col('BENEFICIO')

    for (let i = cabQuadro + 1; i < m.length; i++) {
      const linha = m[i] ?? []
      // A linha TOTAL fecha o quadro; somá-la dobraria a folha.
      if (/^TOTAIS?$|^TOTAL/.test(normalizarTexto(linha[cEquipe] ?? linha[0]))) break

      // ⚠️ Quem manda é o SALÁRIO, não o nome. Na planilha do cliente há uma vaga de Programador
      // **sem nome** — é gente que ainda vai ser contratada, e ela custa R$ 5.704,84/mês. Exigir
      // nome perdia essa linha, e o custo mensal saía R$ 5.704,84 menor do que o real.
      const salario = lerValor(linha[cSal])
      if (salario === null) continue
      const nome = String(linha[cNome] ?? '').trim()
      const cargo = cCargo >= 0 ? String(linha[cCargo] ?? '').trim() : ''
      if (!nome && !cargo) continue

      quadro.push({
        equipe: cEquipe >= 0 ? String(linha[cEquipe] ?? '').trim() || undefined : undefined,
        nome: nome || '(vaga a contratar)',
        cargo,
        salario,
        encargos: lerValor(linha[cEnc]) ?? 0,
        beneficios: lerValor(linha[cBen]) ?? 0,
      })
    }
  } else {
    problemas.push({ aba, motivo: 'Não achei o quadro nominal (colunas NOME, CARGO, SALÁRIO).' })
  }

  if (cabGerais >= 0) {
    const cab = (m[cabGerais] ?? []).map(normalizarTexto)
    const cItem = cab.findIndex((x) => x === 'ITEM')
    const cQnt = cab.findIndex((x) => x.startsWith('QNT') || x.startsWith('QUANT'))
    const cUnit = cab.findIndex((x) => x.includes('VALOR UNIT'))

    for (let i = cabGerais + 1; i < m.length; i++) {
      const linha = m[i] ?? []
      const item = String(linha[cItem] ?? '').trim()
      if (!item) continue
      if (/^TOTAL/.test(normalizarTexto(item))) break
      // ⚠️ Esta linha é o total do quadro repetido — está na planilha para a soma dela fechar.
      if (normalizarTexto(item).startsWith('EQUIPE (FOLHA')) continue
      const unit = lerValor(linha[cUnit])
      if (unit === null) continue
      gerais.push({
        item,
        quantidade: lerValor(linha[cQnt]) ?? 1,
        valorUnitario: unit,
        bloco: blocoDoItem(item),
      })
    }
  } else {
    problemas.push({ aba, motivo: 'Não achei os custos gerais (colunas ITEM e VALOR UNIT.).' })
  }

  return { quadro, gerais, problemas }
}

// ─── Preços do contrato ───────────────────────────────────────────────────────

/**
 * Lê uma aba de preços.
 *
 * As duas do cliente **não têm a mesma forma**: Bertioga tem 4 colunas, Santos tem 6 (com ITEM e
 * OBS). Por isso as colunas são achadas pelo nome, e as que faltam simplesmente não aparecem.
 */
export function lerAbaDePrecos(m: Matriz): PrecoDoContrato[] {
  let cab = -1
  for (let i = 0; i < Math.min(m.length, 12); i++) {
    const linha = (m[i] ?? []).map(normalizarTexto)
    if (linha.includes('DESCRICAO') && linha.some((x) => x.includes('UNIT'))) { cab = i; break }
  }
  if (cab < 0) return []

  const c = (m[cab] ?? []).map(normalizarTexto)
  const iItem = c.findIndex((x) => x === 'ITEM')
  const iDesc = c.findIndex((x) => x === 'DESCRICAO')
  const iNum = c.findIndex((x) => x.includes('N. PRECO') || x.includes('N PRECO'))
  const iUn = c.findIndex((x) => x === 'UN')
  const iVal = c.findIndex((x) => x.includes('UNIT'))
  const iObs = c.findIndex((x) => x === 'OBS')

  const precos: PrecoDoContrato[] = []
  for (let i = cab + 1; i < m.length; i++) {
    const linha = m[i] ?? []
    const descricao = String(linha[iDesc] ?? '').trim()
    const valor = lerValor(linha[iVal])
    // Linha de seção (descrição sem preço) não é item de preço.
    if (!descricao || valor === null) continue
    const obs = iObs >= 0 ? String(linha[iObs] ?? '').trim() : ''
    precos.push({
      item: iItem >= 0 ? String(linha[iItem] ?? '').trim() || undefined : undefined,
      descricao,
      numeroPreco: iNum >= 0 ? String(linha[iNum] ?? '').trim() || undefined : undefined,
      unidade: iUn >= 0 ? String(linha[iUn] ?? '').trim() || undefined : undefined,
      valorUnitario: valor,
      // A planilha marca assim o que foi transcrito de foto com dígito cortado.
      precisaConferir: /CONFERIR/.test(normalizarTexto(obs)),
      observacao: obs || undefined,
    })
  }
  return precos
}

// ─── A produção realizada ─────────────────────────────────────────────────────

/**
 * Lê a seção PLANEJADO × REALIZADO do FCP SEMANAL.
 *
 * Casa a linha com a cidade pelo NOME que abre o rótulo ("BERTIOGA — produção realizada"), e a
 * coluna com a semana pelo cabeçalho S1…S12.
 */
export function lerRealizado(m: Matriz, cidades: CidadeFcp[]): Record<string, Record<number, number | undefined>> {
  const saida: Record<string, Record<number, number | undefined>> = {}

  // Onde estão as colunas S1..Sn?
  let linhaDoCabecalho = -1
  const colunaDaSemana = new Map<number, number>()
  for (let i = 0; i < m.length; i++) {
    const linha = m[i] ?? []
    const achadas = new Map<number, number>()
    for (let c = 0; c < linha.length; c++) {
      const t = normalizarTexto(linha[c])
      const sem = /^S(\d{1,2})$/.exec(t)
      if (sem) achadas.set(c, Number(sem[1]))
    }
    if (achadas.size >= 4) { linhaDoCabecalho = i; achadas.forEach((v, k) => colunaDaSemana.set(k, v)); break }
  }
  if (linhaDoCabecalho < 0) return saida

  for (const linha of m) {
    const rotulo = normalizarTexto(linha?.[1] ?? linha?.[0])
    if (!rotulo.includes('REALIZADA') && !rotulo.includes('REALIZADO')) continue
    const cidade = cidades.find((c) => rotulo.startsWith(normalizarTexto(c.nome)))
    if (!cidade) continue
    const porSemana: Record<number, number | undefined> = {}
    for (const [col, semana] of colunaDaSemana) {
      const v = lerValor(linha[col])
      if (v !== null) porSemana[semana] = v
    }
    saida[cidade.id] = porSemana
  }
  return saida
}

// ─── A conferência: o motor contra a planilha ─────────────────────────────────

function comparar(
  lista: Divergencia[], registro: ConferenciaFeita[], aba: string, oQue: string, calculado: number,
  naPlanilha: Celula, tolerancia = 0.5,
): void {
  const valor = lerValor(naPlanilha)
  if (valor === null) {
    registro.push({ aba, oQue, calculado, naPlanilha: null, status: 'nao_encontrado' })
    return
  }
  const diferenca = calculado - valor
  registro.push({ aba, oQue, calculado, naPlanilha: valor, status: Math.abs(diferenca) <= tolerancia ? 'bateu' : 'divergiu' })
  if (Math.abs(diferenca) <= tolerancia) return
  lista.push({
    aba, oQue, calculado, naPlanilha: valor, diferenca,
    proporcao: valor !== 0 ? Math.abs(diferenca / valor) : 1,
  })
}

/**
 * Compara o que o motor calcula com o que a planilha traz nas abas calculadas.
 *
 * ⚠️ Divergência **não é erro do motor nem da planilha** — é uma pergunta. Pode ser fórmula
 * quebrada, pode ser célula digitada por cima, pode ser premissa que mudou e não propagou. O
 * sistema aponta e mostra os dois números; quem decide é a pessoa.
 */
/**
 * A planilha discorda dela mesma sobre o primeiro mês?
 *
 * ─── O QUE ISTO PROVA ─────────────────────────────────────────────────────────
 * A aba AUX traz a medição do 1º mês em DOIS lugares: a linha "Medição bruta GLOBAL", que aplica
 * a convenção manual da planilha (agosto = 1 semana inteira), e a linha do cenário adotado dentro
 * da grade, que rateia por dias. No arquivo real elas dão **R$ 181.947,70 e R$ 207.940,23** para
 * o mesmo agosto — a razão é 8/7, exatamente os 8 dias de obra de agosto sobre uma semana de 7.
 *
 * O motor rateia por dias (ver `diasDaSemanaNoMes`, que documenta a escolha). Por isso ele bate
 * com a grade e diverge do número em destaque. **A divergência é interna à planilha**, e é isto
 * que a tela precisa dizer — senão a pessoa leva para a reunião a pergunta errada.
 *
 * Devolve `undefined` quando não dá para provar: sem a aba AUX, sem as duas linhas, ou quando elas
 * concordam. Nada de causa por palpite.
 */
export function contradicaoDoPrimeiroMes(p: PremissasFcp, abas: Abas): { manual: number; rateado: number } | null {
  const aux = abas['AUX']
  if (!aux) return null

  const primeiroNumero = (linha: Celula[]): number | null => {
    for (const c of linha) { const v = lerValor(c); if (v !== null && v !== 0) return v }
    return null
  }
  const acharLinha = (teste: (rotulo: string) => boolean): number | null => {
    for (const linha of aux) {
      if (!Array.isArray(linha)) continue
      const rotulo = linha.find((c) => typeof c === 'string')
      if (typeof rotulo === 'string' && teste(normalizarTexto(rotulo))) return primeiroNumero(linha)
    }
    return null
  }

  const manual = acharLinha((r) => r === 'MEDICAO BRUTA GLOBAL')
  const doCenario = normalizarTexto(ROTULO_CENARIO[p.cenario])
  const rateado = acharLinha((r) => r.startsWith(doCenario) && r.includes('MEDICAO BRUTA GLOBAL'))

  if (manual === null || rateado === null) return null
  if (Math.abs(manual - rateado) < 0.01) return null
  return { manual, rateado }
}

const ABAS_AFETADAS_PELA_SEMANA = new Set(['FCP MENSAL', 'ECONÔMICO', 'ECONOMICO'])

/** Escreve a causa nas divergências que ela explica. As demais ficam sem — de propósito. */
export function explicarDivergencias(p: PremissasFcp, abas: Abas, lista: Divergencia[]): Divergencia[] {
  const c = contradicaoDoPrimeiroMes(p, abas)
  if (!c) return lista
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const texto =
    `A própria planilha traz dois valores para a medição do 1º mês: ${brl(c.manual)} na linha ` +
    `"Medição bruta GLOBAL" da aba AUX, e ${brl(c.rateado)} na grade do cenário adotado. ` +
    'A primeira conta o mês como uma semana inteira; a segunda rateia por dias. O sistema rateia ' +
    'por dias, então ele bate com a grade e diverge do número em destaque. A diferença é de ' +
    'convenção, e é interna à planilha — não é erro de leitura.'
  return lista.map((d) => (ABAS_AFETADAS_PELA_SEMANA.has(d.aba) ? { ...d, causaProvavel: texto } : d))
}

export function conferirContraAPlanilha(
  p: PremissasFcp, abas: Abas, registro: ConferenciaFeita[] = [],
): Divergencia[] {
  const d: Divergencia[] = []
  const premissas = abas['PREMISSAS']

  if (premissas) {
    for (const cidade of p.cidades) {
      comparar(d, registro, 'PREMISSAS', `Custo mensal — ${cidade.nome}`,
        custoMensalDaCidade(cidade), acharPremissa(premissas, cidade.nome, 'custo mensal'))
    }
    comparar(d, registro, 'PREMISSAS', 'Custo mensal GLOBAL',
      custoMensalGlobal(p), acharPremissa(premissas, 'GLOBAL', 'custo mensal'))
    const consorcio = p.cidades.reduce((s, c) => s + custosPorRegime(p, c).consorcio, 0)
    comparar(d, registro, 'PREMISSAS', 'Custos bancados pelo consórcio (global)',
      consorcio, acharPremissa(premissas, 'GLOBAL', 'bancados pelo cons'))
    const santos = p.cidades.find((c) => c.mix)
    if (santos) {
      comparar(d, registro, 'PREMISSAS', `Ticket ponderado — ${santos.nome}`,
        ticketDaCidade(santos), acharPremissa(premissas, santos.nome, 'ponderado'), 0.01)
    }
  }

  for (const cidade of p.cidades) {
    const aba = Object.keys(abas).find((n) => normalizarTexto(n).startsWith('CUSTOS') && normalizarTexto(n).includes(normalizarTexto(cidade.nome)))
    if (!aba) continue
    comparar(d, registro, aba, `Total mensal — ${cidade.nome}`,
      custoMensalDaCidade(cidade), acharPremissa(abas[aba], 'TOTAL MENSAL'))
    comparar(d, registro, aba, `Total da folha — ${cidade.nome}`,
      totalDaFolha(cidade.custos), acharUltimoNumero(abas[aba], 'pessoas'))
  }

  // A VIABILIDADE é uma grade de 4 cenários × 6 colunas, e o rótulo de cada célula não é único —
  // procurar por rótulo pegaria a linha errada. A conferência dela é feita pelas PREMISSAS de que
  // ela deriva (custo mensal e ticket), que já estão acima: se as duas batem, a grade bate.

  const mensal = abas['FCP MENSAL']
  if (mensal) {
    const cap = capitalNecessario(p, fluxoMensal(p))
    comparar(d, registro, 'FCP MENSAL', 'Necessidade máxima de capital',
      cap.necessidadeMaxima, acharPremissa(mensal, 'Necessidade'), 1)
    comparar(d, registro, 'FCP MENSAL', 'Capital recomendado',
      cap.capitalRecomendado, acharPremissa(mensal, 'CAPITAL RECOMENDADO'), 1)
  }

  const eco = abas['ECONÔMICO'] ?? abas['ECONOMICO']
  if (eco) {
    const linhas = fluxoEconomico(p)
    const final = linhas.length > 0 ? linhas[linhas.length - 1].resultadoAcumulado : 0
    // O total fica na coluna TOTAL, à direita de tudo — não na primeira célula depois do rótulo.
    comparar(d, registro, 'ECONÔMICO', 'Resultado econômico no horizonte',
      final, acharUltimoNumero(eco, 'RESULTADO ACUMULADO'), 1)
  }

  return d.sort((a, b) => b.proporcao - a.proporcao)
}

// ─── A leitura inteira ────────────────────────────────────────────────────────

export function lerPlanilhaFcp(abas: Abas): LeituraFcp {
  const problemas: ProblemaDeLeitura[] = []
  const premissasAba = abas['PREMISSAS']
  if (!premissasAba) {
    return {
      premissas: null, realizado: {}, precos: {}, divergencias: [],
      problemas: [{ aba: '—', motivo: 'A planilha não tem a aba PREMISSAS. Sem ela não há o que calcular.' }],
    }
  }

  const inicioObra = lerData(acharPremissa(premissasAba, 'Início da obra'))
  const fimOperacao = lerData(acharPremissa(premissasAba, 'Fim da opera'))
  if (!inicioObra) problemas.push({ aba: 'PREMISSAS', motivo: 'Não achei a data de início da obra.' })
  if (!fimOperacao) problemas.push({ aba: 'PREMISSAS', motivo: 'Não achei a data de fim da operação.' })

  // As cidades saem das abas de custo — uma aba `CUSTOS <cidade>` é uma cidade.
  const cidades: CidadeFcp[] = []
  for (const nomeAba of Object.keys(abas)) {
    if (!normalizarTexto(nomeAba).startsWith('CUSTOS ')) continue
    const nome = nomeAba.replace(/^custos\s+/i, '').trim()
    const { quadro, gerais, problemas: pr } = lerAbaDeCustos(abas[nomeAba], nomeAba)
    problemas.push(...pr)

    const ticketA = lerValor(acharPremissa(premissasAba, nome, 'ticket água'))
    const ticketB = lerValor(acharPremissa(premissasAba, nome, 'ticket esgoto'))
    const fracaoB = lerValor(acharPremissa(premissasAba, nome, 'que são esgoto'))
    const ticketSimples = lerValor(acharPremissa(premissasAba, nome, 'ticket médio por serviço'))

    cidades.push({
      id: normalizarTexto(nome).toLowerCase().replace(/\s+/g, '-'),
      nome,
      ticket: ticketSimples ?? 0,
      mix: ticketA !== null && ticketB !== null
        ? { rotuloA: 'Água', ticketA, rotuloB: 'Esgoto', ticketB, fracaoB: fracaoB ?? 0.5 }
        : undefined,
      mobilizacao: lerValor(acharPremissa(premissasAba, nome, 'custos iniciais')) ?? 0,
      custos: { quadro, gerais },
    })
  }
  if (cidades.length === 0) {
    problemas.push({ aba: '—', motivo: 'Não achei nenhuma aba "CUSTOS <cidade>". Cada cidade precisa de uma.' })
  }

  const premissas: PremissasFcp = {
    inicioObra: inicioObra ?? '',
    fimOperacao: fimOperacao ?? '',
    diasPorMes: lerValor(acharPremissa(premissasAba, 'Dias por mês')) ?? 30,
    defasagemDias: lerValor(acharPremissa(premissasAba, 'Defasagem de recebimento')) ?? 0,
    imposto: lerValor(acharPremissa(premissasAba, 'Imposto da nota')) ?? 0,
    cenario: lerCenario(acharPremissa(premissasAba, 'Cenário adotado')),
    margens: {
      MINIMA: lerValor(acharPremissa(premissasAba, 'Margem do cenário MÍNIMA')) ?? 0,
      MEDIA: lerValor(acharPremissa(premissasAba, 'Margem do cenário MÉDIA')) ?? 0.10,
      BOA: lerValor(acharPremissa(premissasAba, 'Margem do cenário BOA')) ?? 0.15,
      OTIMA: lerValor(acharPremissa(premissasAba, 'Margem do cenário ÓTIMA')) ?? 0.20,
    },
    contingencia: lerValor(acharPremissa(premissasAba, 'Contingência')) ?? 0,
    fatorPrimeiroMes: lerValor(acharPremissa(premissasAba, 'Fator de custos do 1º mês')) ?? 1,
    regime: {
      folha: lerQuemPaga(acharPremissa(premissasAba, 'Folha das equipes')),
      engenheiro: lerQuemPaga(acharPremissa(premissasAba, 'Engenheiro', 'quem paga')),
      estrutura: lerQuemPaga(acharPremissa(premissasAba, 'Estrutura e locações')),
      indiretos: lerQuemPaga(acharPremissa(premissasAba, 'Custos indiretos', 'quem paga')),
      mobilizacao: lerQuemPaga(acharPremissa(premissasAba, 'Mobilização', 'quem paga')),
    },
    consorcioDescontaDaMedicao: normalizarTexto(acharPremissa(premissasAba, 'desconta da medição')) !== 'NAO',
    baseDoImposto: lerBaseDoImposto(acharPremissa(premissasAba, 'Base do imposto')),
    cidades,
  }

  const semanal = abas['FCP SEMANAL']
  const realizado = semanal ? lerRealizado(semanal, cidades) : {}

  const precos: Record<string, PrecoDoContrato[]> = {}
  for (const nomeAba of Object.keys(abas)) {
    if (!normalizarTexto(nomeAba).startsWith('PRECOS')) continue
    const lidos = lerAbaDePrecos(abas[nomeAba])
    if (lidos.length > 0) precos[nomeAba.replace(/^preços?\s+/i, '').trim()] = lidos
  }

  const divergencias = cidades.length > 0 && inicioObra && fimOperacao
    // A causa vem junto quando dá para prová-la a partir da própria planilha.
    ? explicarDivergencias(premissas, abas, conferirContraAPlanilha(premissas, abas))
    : []

  return { premissas, realizado, precos, divergencias, problemas }
}
