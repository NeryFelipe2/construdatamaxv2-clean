/**
 * O motor do Fluxo de Caixa Projetado.
 *
 * ⚠️ **Puro: sem store, sem rede, sem React.** É por isso que os números da planilha do cliente
 * viram teste — e é o que permite comparar o que o motor calcula com o que a planilha traz.
 *
 * Cada fórmula abaixo foi lida do arquivo (`data_only=False`), não deduzida dos valores. A
 * referência da célula está no comentário, para quando a planilha mudar.
 */
import type {
  BlocoDeCusto, CapitalNecessario, Cenario, CidadeFcp, ColunaMensal, ColunaSemanal,
  CustosDaCidade, LinhaEconomica, LinhaMensalDaCidade, LinhaSemanalDaCidade, LinhaViabilidade,
  MesDoFluxo, PremissasFcp, Semana,
} from './tipos'
import { CENARIOS } from './tipos'

// ─── Datas, tudo em UTC ───────────────────────────────────────────────────────

const MS_DIA = 86400000

export function dia(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}

export function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function somarDias(isoData: string, n: number): string {
  return iso(new Date(dia(isoData).getTime() + n * MS_DIA))
}

/** Primeiro dia do mês de uma data. */
export function primeiroDiaDoMes(isoData: string): string {
  const d = dia(isoData)
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)))
}

/** Último dia do mês — o `EOMONTH` da planilha. */
export function ultimoDiaDoMes(isoData: string): string {
  const d = dia(isoData)
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))
}

export function somarMeses(isoData: string, n: number): string {
  const d = dia(isoData)
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate())))
}

function diferencaEmDias(a: string, b: string): number {
  return Math.round((dia(b).getTime() - dia(a).getTime()) / MS_DIA)
}

// ─── Custos ───────────────────────────────────────────────────────────────────

/** Uma pessoa custa salário + encargos + benefícios. `CUSTOS BERTIOGA!H7:H21`. */
export function custoDaPessoa(p: { salario: number; encargos: number; beneficios: number }): number {
  return p.salario + p.encargos + p.beneficios
}

export function totalDaFolha(c: CustosDaCidade): number {
  return c.quadro.reduce((s, p) => s + custoDaPessoa(p), 0)
}

/** Os custos gerais de um bloco. A folha entra à parte, porque vem do quadro nominal. */
export function totalDoBloco(c: CustosDaCidade, bloco: BlocoDeCusto): number {
  const gerais = c.gerais
    .filter((g) => g.bloco === bloco)
    .reduce((s, g) => s + g.quantidade * g.valorUnitario, 0)
  return bloco === 'folha' ? gerais + totalDaFolha(c) : gerais
}

/** `CUSTOS BERTIOGA!F36` — o custo mensal da cidade. Mobilização NÃO entra: é desembolso inicial. */
export function custoMensalDaCidade(cidade: CidadeFcp): number {
  return (['folha', 'engenheiro', 'estrutura', 'indiretos'] as const)
    .reduce((s, b) => s + totalDoBloco(cidade.custos, b), 0)
}

export function custoMensalGlobal(p: PremissasFcp): number {
  return p.cidades.reduce((s, c) => s + custoMensalDaCidade(c), 0)
}

/**
 * O que o consórcio banca (e desconta) e o que sai do caixa da empresa.
 * `PREMISSAS!C51:C56`.
 */
export function custosPorRegime(p: PremissasFcp, cidade: CidadeFcp): { consorcio: number; empresa: number } {
  let consorcio = 0
  let empresa = 0
  for (const bloco of ['folha', 'engenheiro', 'estrutura', 'indiretos'] as const) {
    const v = totalDoBloco(cidade.custos, bloco)
    if (p.regime[bloco] === 'CONSORCIO') consorcio += v
    else empresa += v
  }
  return { consorcio, empresa }
}

/**
 * O desconto que o consórcio aplica sobre a medição.
 *
 * ⚠️ Se `consorcioDescontaDaMedicao` for falso, o consórcio banca **e não cobra** — o desconto é
 * zero e entra muito mais caixa. É a diferença entre "ele adianta" e "ele patrocina", e a planilha
 * trata como premissa (`PREMISSAS!C47`).
 */
export function descontoMensal(p: PremissasFcp, cidade: CidadeFcp): number {
  return p.consorcioDescontaDaMedicao ? custosPorRegime(p, cidade).consorcio : 0
}

export function mobilizacaoPorRegime(p: PremissasFcp): { descontada: number; doCaixa: number } {
  const total = p.cidades.reduce((s, c) => s + c.mobilizacao, 0)
  if (p.regime.mobilizacao === 'EMPRESA') return { descontada: 0, doCaixa: total }
  return { descontada: p.consorcioDescontaDaMedicao ? total : 0, doCaixa: 0 }
}

// ─── Ticket ───────────────────────────────────────────────────────────────────

/**
 * `PREMISSAS!C25` — o ticket ponderado.
 * Santos: 1.856,40 × 0,5 + 821,25 × 0,5 = 1.338,825.
 */
export function ticketDaCidade(c: CidadeFcp): number {
  if (!c.mix) return c.ticket
  return c.mix.ticketB * c.mix.fracaoB + c.mix.ticketA * (1 - c.mix.fracaoB)
}

// ─── Viabilidade ──────────────────────────────────────────────────────────────

/**
 * Quantos serviços por dia a cidade precisa entregar, em cada cenário. `VIABILIDADE!C7:H10`.
 *
 * ⚠️ A produção MÍNIMA aqui é **maior** que num cálculo ingênuo, e a planilha avisa: o empate tem
 * de cobrir o imposto da nota. Sem o `/(1−imposto)`, Bertioga daria 8,98 serviços/dia em vez de
 * 11,51 — e a empresa fecharia contrato no prejuízo achando que empatava.
 */
export function viabilidadeDaCidade(p: PremissasFcp, cidade: CidadeFcp): LinhaViabilidade[] {
  const custo = custoMensalDaCidade(cidade)
  const ticket = ticketDaCidade(cidade)

  return CENARIOS.map((cenario) => {
    const margem = p.margens[cenario]
    const receitaLiquida = custo * (1 + margem)
    const medicaoBruta = receitaLiquida / (1 - p.imposto)
    const servicosMes = ticket > 0 ? medicaoBruta / ticket : 0
    const servicosDia = servicosMes / p.diasPorMes

    const linha: LinhaViabilidade = {
      cenario, margem, receitaLiquida, medicaoBruta,
      servicosMes,
      servicosSemana: (servicosMes * 7) / p.diasPorMes,
      servicosDia,
      adotado: cenario === p.cenario,
    }
    if (cidade.mix) {
      linha.porServico = [
        { rotulo: cidade.mix.rotuloA, porDia: servicosDia * (1 - cidade.mix.fracaoB) },
        { rotulo: cidade.mix.rotuloB, porDia: servicosDia * cidade.mix.fracaoB },
      ]
    }
    return linha
  })
}

export function viabilidadeGlobal(p: PremissasFcp): LinhaViabilidade[] {
  const custo = custoMensalGlobal(p)
  return CENARIOS.map((cenario) => {
    const margem = p.margens[cenario]
    const receitaLiquida = custo * (1 + margem)
    return {
      cenario, margem, receitaLiquida,
      medicaoBruta: receitaLiquida / (1 - p.imposto),
      // Sem ticket global: somar serviços de cidades com tickets diferentes daria um número que
      // não quer dizer nada. A produção por dia é sempre POR CIDADE.
      servicosMes: 0, servicosSemana: 0, servicosDia: 0,
      adotado: cenario === p.cenario,
    }
  })
}

// ─── Calendário ───────────────────────────────────────────────────────────────

/** As semanas do horizonte, a partir da segunda-feira de início. `FCP SEMANAL!D6:O8`. */
export function semanasDoFluxo(p: PremissasFcp, quantidade = 12): Semana[] {
  const semanas: Semana[] = []
  for (let i = 0; i < quantidade; i++) {
    const inicio = somarDias(p.inicioObra, i * 7)
    semanas.push({ numero: i + 1, inicio, fim: somarDias(inicio, 6) })
  }
  return semanas
}

/** Os meses do horizonte, com dias de obra, dias equivalentes e data de pagamento. `AUX!C3:Q9`. */
export function mesesDoFluxo(p: PremissasFcp): MesDoFluxo[] {
  const meses: MesDoFluxo[] = []
  const primeiro = primeiroDiaDoMes(p.inicioObra)
  const limite = primeiroDiaDoMes(p.fimOperacao)

  for (let i = 0; ; i++) {
    const mes = primeiroDiaDoMes(somarMeses(primeiro, i))
    if (mes > limite) break
    const fimDoMes = ultimoDiaDoMes(mes)

    // `AUX!C4` — o 1º e o último mês entram proporcionais aos dias de obra.
    const de = mes > p.inicioObra ? mes : p.inicioObra
    const ate = fimDoMes < p.fimOperacao ? fimDoMes : p.fimOperacao
    const diasDeObra = Math.max(0, diferencaEmDias(de, ate) + 1)

    meses.push({
      mes,
      diasDeObra,
      // `AUX!C9` — no 1º mês o CUSTO usa o fator, não os dias de obra.
      diasEquivalentes: i === 0 ? p.fatorPrimeiroMes * p.diasPorMes : diasDeObra,
      // `AUX!C8` — a medição fecha no último dia do mês e é paga com a defasagem.
      dataPagamento: somarDias(fimDoMes, p.defasagemDias),
    })
    if (i > 240) break // trava de segurança
  }
  return meses
}

// ─── Produção e medição ───────────────────────────────────────────────────────

/**
 * `FCP SEMANAL!D11` — quantos serviços a cidade precisa entregar por semana.
 * `custoMensal × (1+margem) / (1−imposto) / ticket × 7 / diasPorMes`
 */
export function producaoPrevistaSemanal(p: PremissasFcp, cidade: CidadeFcp): number {
  const ticket = ticketDaCidade(cidade)
  if (ticket <= 0) return 0
  const medicaoMensal = (custoMensalDaCidade(cidade) * (1 + p.margens[p.cenario])) / (1 - p.imposto)
  return (medicaoMensal / ticket) * 7 / p.diasPorMes
}

/** A produção realizada, por cidade e por semana. Semana sem lançamento usa o previsto. */
export type ProducaoRealizada = Record<string, Record<number, number | undefined>>

/** `FCP SEMANAL!D12` — `IF(realizado<>"", realizado, previsto) × ticket`. */
export function medicaoDaSemana(
  p: PremissasFcp, cidade: CidadeFcp, semana: number, realizado: ProducaoRealizada,
): { producao: number; medicao: number; lancado: boolean } {
  const previsto = producaoPrevistaSemanal(p, cidade)
  const lancadoValor = realizado[cidade.id]?.[semana]
  const lancado = typeof lancadoValor === 'number' && Number.isFinite(lancadoValor)
  const producao = lancado ? lancadoValor : previsto
  return { producao, medicao: producao * ticketDaCidade(cidade), lancado }
}

/**
 * Quantos dias de uma semana caem dentro de um mês — e dentro do prazo de obra.
 *
 * ⚠️ É aqui que o motor diverge da planilha do cliente, de propósito. Ela atribui **1, 5 e 5
 * semanas** a agosto, setembro e outubro à mão, e só a partir de novembro passa a ratear por dias
 * (`AUX!C5:F5`). As duas contas não fecham: agosto tem 8 dias de obra, e uma semana são 7.
 *
 * Rateando por dias desde o começo, os dois caminhos da própria planilha passam a concordar:
 * agosto dá 8/7 de semana = R$ 207.940, que é exatamente o que a fórmula mensal dela produz
 * (`AUX!C29`). É a conta internamente consistente — e a comparação com a planilha aponta a
 * diferença em vez de escondê-la.
 */
export function diasDaSemanaNoMes(p: PremissasFcp, semana: Semana, mes: string): number {
  const fimDoMes = ultimoDiaDoMes(mes)
  const de = [semana.inicio, mes, p.inicioObra].reduce((a, b) => (a > b ? a : b))
  const ate = [semana.fim, fimDoMes, p.fimOperacao].reduce((a, b) => (a < b ? a : b))
  return Math.max(0, diferencaEmDias(de, ate) + 1)
}

/** A medição de cada mês, por cidade, com as semanas rateadas por dia. */
function medicaoPorMesPorCidade(
  p: PremissasFcp, meses: MesDoFluxo[], semanas: Semana[], realizado: ProducaoRealizada,
): Map<string, Map<string, number>> {
  const mapa = new Map<string, Map<string, number>>()
  for (const m of meses) mapa.set(m.mes, new Map(p.cidades.map((c) => [c.id, 0])))

  for (const s of semanas) {
    for (const m of meses) {
      const dias = diasDaSemanaNoMes(p, s, m.mes)
      if (dias === 0) continue
      const fracao = dias / 7
      const doMes = mapa.get(m.mes)!
      for (const c of p.cidades) {
        const { medicao } = medicaoDaSemana(p, c, s.numero, realizado)
        doMes.set(c.id, (doMes.get(c.id) ?? 0) + medicao * fracao)
      }
    }
  }
  return mapa
}

// ─── Imposto ──────────────────────────────────────────────────────────────────

/** `FCP SEMANAL!D14` / `FCP MENSAL!C12` — a base muda com a premissa. */
export function impostoDaNota(p: PremissasFcp, recebimento: number, desconto: number): number {
  const base = p.baseDoImposto === 'CHEIA' ? recebimento : Math.max(0, recebimento - desconto)
  return base * p.imposto
}

// ─── FCP MENSAL ───────────────────────────────────────────────────────────────

/**
 * O fluxo mensal — é dele que sai o capital necessário.
 *
 * ⚠️ O recebimento de um mês é a medição do mês cuja **data de pagamento cai dentro dele**
 * (`FCP MENSAL!C10`), não a medição do próprio mês. É essa defasagem que cria o buraco de caixa
 * do começo da obra, e é o buraco que define o capital recomendado.
 */
export function fluxoMensal(p: PremissasFcp, realizado: ProducaoRealizada = {}): ColunaMensal[] {
  const meses = mesesDoFluxo(p)
  const semanas = semanasDoFluxo(p, Math.max(12, meses.length * 5))
  const mob = mobilizacaoPorRegime(p)

  const medicaoPorMes = medicaoPorMesPorCidade(p, meses, semanas, realizado)
  const totalMob = Math.max(1, p.cidades.reduce((s, x) => s + x.mobilizacao, 0))

  const colunas: ColunaMensal[] = []
  const acumuladoPorCidade = new Map<string, number>(p.cidades.map((c) => [c.id, 0]))
  let acumuladoGlobal = 0

  for (let i = 0; i < meses.length; i++) {
    const m = meses[i]
    const anterior = i > 0 ? meses[i - 1] : null

    // Que medições são pagas DENTRO deste mês?
    // ⚠️ PODE SER MAIS DE UMA (correção do ConstruData sobre o pacote, 16/09/2026). Com defasagem de
    // ~29 dias ou mais, fim de janeiro + 29 = 1º de março e fim de fevereiro + 29 = 29 de março: as
    // duas caem em março. Aqui havia um `find`, e a segunda medição sumia do caixa sem erro nenhum.
    // Teste: motor.cd.test.ts.
    const mesesPagos = meses.filter((x) => primeiroDiaDoMes(x.dataPagamento) === m.mes)

    const porCidade: LinhaMensalDaCidade[] = p.cidades.map((c) => {
      const medicaoDoMes = medicaoPorMes.get(m.mes)?.get(c.id) ?? 0

      // `FCP MENSAL!D11` — o desconto acompanha o recebimento e usa os dias EQUIVALENTES do mês
      // que gerou a medição, mais a mobilização na primeira vez que entra dinheiro.
      let recebimento = 0
      let descontoConsorcio = 0
      for (const mesPago of mesesPagos) {
        const recebido = medicaoPorMes.get(mesPago.mes)?.get(c.id) ?? 0
        recebimento += recebido
        if (recebido > 0) {
          const ehPrimeiroRecebimento = mesPago.mes === meses[0].mes
          descontoConsorcio += descontoMensal(p, c) * (mesPago.diasEquivalentes / p.diasPorMes)
            + (ehPrimeiroRecebimento ? mob.descontada * (c.mobilizacao / totalMob) : 0)
        }
      }

      const imposto = impostoDaNota(p, recebimento, descontoConsorcio)
      const entraNoCaixa = recebimento - descontoConsorcio - imposto

      // `FCP MENSAL!D14` — o custo da empresa sai no mês SEGUINTE ao que foi gerado (é a folha do
      // mês anterior sendo paga), proporcional aos dias equivalentes daquele mês.
      const saiDoCaixa = i === 0
        ? mob.doCaixa * (c.mobilizacao / totalMob)
        : custosPorRegime(p, c).empresa * ((anterior?.diasEquivalentes ?? 0) / p.diasPorMes)

      const antes = (acumuladoPorCidade.get(c.id) ?? 0) - saiDoCaixa
      const depois = antes + entraNoCaixa
      acumuladoPorCidade.set(c.id, depois)

      return {
        cidadeId: c.id, medicaoDoMes, recebimento, descontoConsorcio, imposto,
        entraNoCaixa, saiDoCaixa, saldoDoMes: entraNoCaixa - saiDoCaixa,
        acumuladoAntesDoRecebimento: antes, acumuladoDepois: depois,
      }
    })

    const soma = (f: (l: LinhaMensalDaCidade) => number) => porCidade.reduce((s, l) => s + f(l), 0)
    const entraNoCaixa = soma((l) => l.entraNoCaixa)
    const saiDoCaixa = soma((l) => l.saiDoCaixa)
    const antes = acumuladoGlobal - saiDoCaixa
    acumuladoGlobal = antes + entraNoCaixa

    colunas.push({
      mes: m, porCidade,
      medicaoBruta: soma((l) => l.medicaoDoMes),
      recebimento: soma((l) => l.recebimento),
      descontoConsorcio: soma((l) => l.descontoConsorcio),
      imposto: soma((l) => l.imposto),
      entraNoCaixa, saiDoCaixa,
      saldoDoMes: entraNoCaixa - saiDoCaixa,
      acumuladoAntesDoRecebimento: antes,
      acumuladoDepois: acumuladoGlobal,
    })
  }
  return colunas
}

/**
 * `FCP MENSAL!C42:C44` — o capital que a empresa precisa ter no bolso.
 *
 * ⚠️ É o pior ponto do acumulado **antes** do recebimento, não o pior saldo do mês. A diferença é
 * o dinheiro que precisa estar disponível no dia em que a folha vence e a medição ainda não caiu.
 */
export function capitalNecessario(p: PremissasFcp, meses: ColunaMensal[]): CapitalNecessario {
  let pior = 0
  let mesDoPiorPonto: string | null = null
  for (const m of meses) {
    if (m.acumuladoAntesDoRecebimento < pior) {
      pior = m.acumuladoAntesDoRecebimento
      mesDoPiorPonto = m.mes.mes
    }
  }
  const necessidadeMaxima = Math.max(0, -pior)
  const contingencia = necessidadeMaxima * p.contingencia
  return {
    necessidadeMaxima, contingencia,
    capitalRecomendado: necessidadeMaxima + contingencia,
    mesDoPiorPonto,
  }
}

// ─── FCP SEMANAL ──────────────────────────────────────────────────────────────

/**
 * O fluxo semanal — o mesmo dinheiro, no detalhe da semana.
 *
 * ⚠️ O recebimento cai na semana que **contém a data de pagamento** do mês (fim do mês +
 * defasagem). Na planilha do cliente essas células foram digitadas à mão e ficaram fora dessa
 * regra; aqui a regra é aplicada, e a comparação com a planilha aponta a diferença.
 */
export function fluxoSemanal(
  p: PremissasFcp, realizado: ProducaoRealizada = {}, quantidade = 12,
): ColunaSemanal[] {
  const semanas = semanasDoFluxo(p, quantidade)
  const meses = mesesDoFluxo(p)
  const mob = mobilizacaoPorRegime(p)
  const totalMob = Math.max(1, p.cidades.reduce((s, x) => s + x.mobilizacao, 0))

  // Medição de cada mês por cidade, para saber o que é pago quando.
  const medicaoDoMes = medicaoPorMesPorCidade(p, meses, semanas, realizado)

  const acumuladoPorCidade = new Map<string, number>(p.cidades.map((c) => [c.id, 0]))
  let acumuladoGlobal = 0

  return semanas.map((semana) => {
    // O mês cuja data de pagamento cai nesta semana.
    const mesPago = meses.find((m) => m.dataPagamento >= semana.inicio && m.dataPagamento <= semana.fim)
    // O mês cujo custo da empresa vence nesta semana: a primeira semana do mês seguinte.
    const mesDeCusto = meses.find((m) => {
      const vencimento = somarDias(ultimoDiaDoMes(m.mes), 1)
      return vencimento >= semana.inicio && vencimento <= semana.fim
    })

    const porCidade: LinhaSemanalDaCidade[] = p.cidades.map((c) => {
      const { producao, medicao, lancado } = medicaoDaSemana(p, c, semana.numero, realizado)
      const previsto = producaoPrevistaSemanal(p, c)

      const recebimento = mesPago ? (medicaoDoMes.get(mesPago.mes)?.get(c.id) ?? 0) : 0
      const ehPrimeiroRecebimento = !!mesPago && mesPago.mes === meses[0]?.mes
      const descontoConsorcio = recebimento > 0
        ? descontoMensal(p, c) * (mesPago!.diasEquivalentes / p.diasPorMes)
          + (ehPrimeiroRecebimento ? mob.descontada * (c.mobilizacao / totalMob) : 0)
        : 0
      const imposto = impostoDaNota(p, recebimento, descontoConsorcio)
      const custosDaEmpresa = mesDeCusto
        ? custosPorRegime(p, c).empresa * (mesDeCusto.diasEquivalentes / p.diasPorMes)
        : 0
      const mobilizacao = semana.numero === 1 ? mob.doCaixa * (c.mobilizacao / totalMob) : 0

      const totalDespesas = imposto + descontoConsorcio + custosDaEmpresa + mobilizacao
      const saldoPeriodo = recebimento - totalDespesas
      const saldoAcumulado = (acumuladoPorCidade.get(c.id) ?? 0) + saldoPeriodo
      acumuladoPorCidade.set(c.id, saldoAcumulado)

      return {
        cidadeId: c.id,
        producaoPrevista: previsto,
        producaoRealizada: lancado ? producao : undefined,
        medicao, recebimento, imposto, descontoConsorcio,
        custosDaEmpresa, mobilizacao, outrosDesembolsos: 0,
        totalDespesas, saldoPeriodo, saldoAcumulado,
        aderencia: lancado && previsto > 0 ? producao / previsto : undefined,
      }
    })

    const soma = (f: (l: LinhaSemanalDaCidade) => number) => porCidade.reduce((s, l) => s + f(l), 0)
    const recebimento = soma((l) => l.recebimento)
    const totalDespesas = soma((l) => l.totalDespesas)
    const saldoPeriodo = recebimento - totalDespesas
    acumuladoGlobal += saldoPeriodo

    // A aderência global é em R$, não em unidades — somar serviços de tickets diferentes não diz
    // nada. `FCP SEMANAL!D49`.
    const comLancamento = porCidade.filter((l) => l.producaoRealizada !== undefined)
    const aderencia = comLancamento.length > 0
      ? soma((l) => (l.producaoRealizada ?? l.producaoPrevista) * ticketDaCidade(p.cidades.find((c) => c.id === l.cidadeId)!))
        / Math.max(1e-9, soma((l) => l.producaoPrevista * ticketDaCidade(p.cidades.find((c) => c.id === l.cidadeId)!)))
      : undefined

    return {
      semana, porCidade, recebimento, totalDespesas, saldoPeriodo,
      saldoAcumulado: acumuladoGlobal, aderencia,
    }
  })
}

/** `FCP SEMANAL!C42` — o pior ponto do trimestre. */
export function piorPontoSemanal(semanas: ColunaSemanal[]): number {
  return semanas.reduce((pior, s) => Math.min(pior, s.saldoAcumulado), 0)
}

// ─── ECONÔMICO ────────────────────────────────────────────────────────────────

/**
 * A margem real do contrato, por competência. `ECONÔMICO!C9:C19`.
 *
 * ⚠️ Aqui NÃO existe defasagem: a medição do mês é do mês. É de propósito — esta aba responde
 * "o contrato dá lucro?", enquanto o FCP responde "eu tenho dinheiro em caixa?". No 1º mês o
 * desconto pode superar a medição parcial, e o resultado negativo é saldo devido ao consórcio,
 * que compensa em seguida.
 */
export function fluxoEconomico(p: PremissasFcp, realizado: ProducaoRealizada = {}): LinhaEconomica[] {
  const meses = mesesDoFluxo(p)
  const semanas = semanasDoFluxo(p, Math.max(12, meses.length * 5))

  const porCidade = medicaoPorMesPorCidade(p, meses, semanas, realizado)
  const medicaoPorMes = new Map<string, number>(
    meses.map((m) => [m.mes, [...(porCidade.get(m.mes)?.values() ?? [])].reduce((a, b) => a + b, 0)]),
  )

  const bloco = (b: BlocoDeCusto) => p.cidades.reduce((s, c) => s + totalDoBloco(c.custos, b), 0)
  const folhaGlobal = bloco('folha')
  const engGlobal = bloco('engenheiro')
  const estruturaGlobal = bloco('estrutura')
  const indiretosGlobal = bloco('indiretos')
  const mobGlobal = p.cidades.reduce((s, c) => s + c.mobilizacao, 0)
  const descontoGlobal = p.cidades.reduce((s, c) => s + descontoMensal(p, c), 0)

  let acumulado = 0
  return meses.map((m, i) => {
    const proporcao = m.diasEquivalentes / p.diasPorMes
    const medicaoBruta = medicaoPorMes.get(m.mes) ?? 0
    const imposto = impostoDaNota(p, medicaoBruta, descontoGlobal * proporcao)
    const medicaoLiquida = medicaoBruta - imposto

    const folha = folhaGlobal * proporcao
    const engenheiro = engGlobal * proporcao
    const estrutura = estruturaGlobal * proporcao
    const indiretos = indiretosGlobal * proporcao
    const mobilizacao = i === 0 ? mobGlobal : 0

    const resultado = medicaoLiquida - folha - engenheiro - estrutura - indiretos - mobilizacao
    acumulado += resultado

    return {
      mes: m, medicaoBruta, imposto, medicaoLiquida,
      folha, engenheiro, estrutura, indiretos, mobilizacao,
      resultado, resultadoAcumulado: acumulado,
      margem: medicaoBruta > 0 ? resultado / medicaoBruta : 0,
    }
  })
}

// ─── Sensibilidade ────────────────────────────────────────────────────────────

/** A mesma conta nos quatro cenários. `FCP MENSAL!C50:F53`. */
export function sensibilidade(p: PremissasFcp): Array<{
  cenario: Cenario
  margem: number
  capital: CapitalNecessario
  resultadoFinal: number
  adotado: boolean
}> {
  return CENARIOS.map((cenario) => {
    const alterado: PremissasFcp = { ...p, cenario }
    const meses = fluxoMensal(alterado)
    const eco = fluxoEconomico(alterado)
    return {
      cenario,
      margem: p.margens[cenario],
      capital: capitalNecessario(alterado, meses),
      resultadoFinal: eco.length > 0 ? eco[eco.length - 1].resultadoAcumulado : 0,
      adotado: cenario === p.cenario,
    }
  })
}
