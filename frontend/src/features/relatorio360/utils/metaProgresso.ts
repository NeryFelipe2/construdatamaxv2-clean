/**
 * metaProgresso — réplica funcional de PROD_META_30D / PREVISTO da planilha
 * Execução_Relatórios: rateio linear da meta ("prometido SABESP") por dia útil
 * decorrido do período × realizado acumulado (de `producao_diaria`) → desvio.
 *
 * REGRA DE DIA ÚTIL (documentada pois não é óbvia): segunda a sexta-feira.
 * Sábado NÃO conta como dia útil nesta versão (a planilha original trata
 * alguns pontos com sábado parcial; aqui a regra simples é seg-sex — se no
 * futuro precisar de sábado como dia útil, ajustar `countDiasUteis`).
 *
 * PREVISTO acumulado = (dias úteis decorridos até hoje, dentro do período) /
 * (dias úteis totais do período) × valor da meta. "Hoje" é sempre recebido
 * como parâmetro (nunca `new Date()` direto aqui) para a função ficar pura e
 * testável; quem chama (hook/UI) passa `new Date()` real em runtime.
 *
 * REALIZADO acumulado = soma de `producao_diaria` dentro do período da meta
 * (não depende de "hoje" — é tudo que já foi lançado no intervalo):
 *   rede_agua = pra_m · rede_esgoto = pre_m · lig_agua = la · lig_esgoto = le
 *
 * DESVIO = realizado − previsto. desvio >= 0 → adiantado (verde);
 * desvio < 0 → atrasado (vermelho).
 */

export interface MetaProgressoInput {
  periodoIni: string // ISO yyyy-mm-dd
  periodoFim: string // ISO yyyy-mm-dd
  ligAgua: number
  ligEsgoto: number
  redeAguaM: number
  redeEsgotoM: number
}

export interface ProducaoParaMeta {
  data: string // ISO yyyy-mm-dd
  nucleo?: string | null
  la: number
  le: number
  praM: number
  preM: number
}

export interface MetaProgressoDimensao {
  meta: number
  previsto: number
  realizado: number
  desvio: number // realizado - previsto
}

export interface MetaProgresso {
  diasUteisTotal: number
  diasUteisDecorridos: number
  fracaoDecorrida: number // decorridos / total, já limitada a [0,1]
  ligAgua: MetaProgressoDimensao
  ligEsgoto: MetaProgressoDimensao
  redeAguaM: MetaProgressoDimensao
  redeEsgotoM: MetaProgressoDimensao
}

export interface MetaProgressoPorNucleo extends MetaProgresso {
  nucleo: string
}

const MS_DIA = 24 * 60 * 60 * 1000
const SEM_NUCLEO = 'Sem núcleo'

function parseIsoDateUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1))
}

/** Conta dias úteis (segunda a sexta), inclusive nas duas pontas. */
export function countDiasUteis(iniISO: string, fimISO: string): number {
  const ini = parseIsoDateUTC(iniISO)
  const fim = parseIsoDateUTC(fimISO)
  if (fim.getTime() < ini.getTime()) return 0
  let count = 0
  for (let t = ini.getTime(); t <= fim.getTime(); t += MS_DIA) {
    const dow = new Date(t).getUTCDay() // 0=domingo .. 6=sábado
    if (dow >= 1 && dow <= 5) count++
  }
  return count
}

function dimensao(metaValor: number, fracaoDecorrida: number, realizado: number): MetaProgressoDimensao {
  const previsto = metaValor * fracaoDecorrida
  return { meta: metaValor, previsto, realizado, desvio: realizado - previsto }
}

function realizadoDoGrupo(rows: ProducaoParaMeta[], periodoIni: string, periodoFim: string) {
  const noPeriodo = rows.filter((r) => r.data >= periodoIni && r.data <= periodoFim)
  return {
    ligAgua: noPeriodo.reduce((s, r) => s + r.la, 0),
    ligEsgoto: noPeriodo.reduce((s, r) => s + r.le, 0),
    redeAguaM: noPeriodo.reduce((s, r) => s + r.praM, 0),
    redeEsgotoM: noPeriodo.reduce((s, r) => s + r.preM, 0),
  }
}

/** Cálculo PURO e testável: meta + produção do período + "hoje" (parâmetro, nunca lido de Date.now() aqui). */
export function computeMetaProgresso(meta: MetaProgressoInput, producaoRows: ProducaoParaMeta[], hojeISO: string): MetaProgresso {
  const diasUteisTotal = countDiasUteis(meta.periodoIni, meta.periodoFim)
  const hojeClamp = hojeISO < meta.periodoIni ? null : hojeISO > meta.periodoFim ? meta.periodoFim : hojeISO
  const diasUteisDecorridos = hojeClamp ? countDiasUteis(meta.periodoIni, hojeClamp) : 0
  const fracaoDecorrida = diasUteisTotal > 0 ? diasUteisDecorridos / diasUteisTotal : 0

  const realizado = realizadoDoGrupo(producaoRows, meta.periodoIni, meta.periodoFim)

  return {
    diasUteisTotal,
    diasUteisDecorridos,
    fracaoDecorrida,
    ligAgua: dimensao(meta.ligAgua, fracaoDecorrida, realizado.ligAgua),
    ligEsgoto: dimensao(meta.ligEsgoto, fracaoDecorrida, realizado.ligEsgoto),
    redeAguaM: dimensao(meta.redeAguaM, fracaoDecorrida, realizado.redeAguaM),
    redeEsgotoM: dimensao(meta.redeEsgotoM, fracaoDecorrida, realizado.redeEsgotoM),
  }
}

/** Mesma conta, quebrada por núcleo (bônus da spec: "idealmente quebrar por núcleo também"). */
export function computeMetaProgressoPorNucleo(
  meta: MetaProgressoInput,
  producaoRows: ProducaoParaMeta[],
  hojeISO: string,
): MetaProgressoPorNucleo[] {
  const porNucleo = new Map<string, ProducaoParaMeta[]>()
  for (const r of producaoRows) {
    const key = (r.nucleo || '').trim() || SEM_NUCLEO
    const arr = porNucleo.get(key) ?? []
    arr.push(r)
    porNucleo.set(key, arr)
  }
  return Array.from(porNucleo.entries())
    .map(([nucleo, rows]) => ({ nucleo, ...computeMetaProgresso(meta, rows, hojeISO) }))
    .sort((a, b) => a.nucleo.localeCompare(b.nucleo, 'pt-BR'))
}
