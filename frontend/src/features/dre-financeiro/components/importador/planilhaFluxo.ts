/**
 * planilhaFluxo.ts — modelo e leitor da planilha de FLUXO DE CAIXA (projeção
 * mensal gravada em `fluxo_projecao`).
 *
 * Por que existe: até aqui o Fluxo de Caixa só aceitava um CSV cru de 4 colunas
 * (mes, recebimento, despesa, obs). Quem preenche isso é engenheiro em Excel, e
 * o CSV além de exigir "salvar como" ainda jogava TODA a despesa em "Outros" —
 * perdendo mão de obra / material / locação, que a tabela já sabe guardar.
 *
 * O modelo sai TIMBRADO com a obra ativa: OBRA, CONTRATO, CLIENTE, LOCAL, PRAZO
 * e VALOR DO CONTRATO vêm do cadastro do projeto, e os meses já vêm gerados de
 * data_inicio a data_fim — o engenheiro só digita os valores. O `ID DO PROJETO`
 * gravado no cabeçalho é o que deixa a importação RECONHECER a obra sozinha: se
 * a planilha for de outra obra, o sistema avisa em vez de misturar projeção de
 * uma obra na conta de outra (o mesmo erro que já apareceu no FCP).
 *
 * Modelo e leitor saem das MESMAS constantes: mudou o layout, muda nos dois.
 */
import * as XLSX from 'xlsx'
import { norm, paraNumero } from './diff'

// ─── layout ─────────────────────────────────────────────────────────────────

/** Rótulos do bloco de identificação (coluna A) — o leitor casa por estes nomes. */
export const ROTULO = {
  obra: 'OBRA',
  contrato: 'CONTRATO',
  cliente: 'CLIENTE',
  local: 'LOCAL',
  prazo: 'PRAZO',
  valor: 'VALOR DO CONTRATO',
  projetoId: 'ID DO PROJETO (não apagar)',
} as const

/** Cabeçalho da grade mensal, na ordem exata do modelo. */
export const CAB_FLUXO = [
  'MÊS', 'RECEBIMENTO PREVISTO', 'MÃO DE OBRA', 'MATERIAL',
  'LOCAÇÃO/FROTA', 'OUTROS', 'DESPESA TOTAL', 'OBS',
] as const

export const LARGURA_FLUXO = [12, 22, 16, 14, 18, 14, 18, 42]

export interface ObraContexto {
  projetoId: string
  nome: string
  contrato?: string | null
  cliente?: string | null
  cidade?: string | null
  dataInicio?: string | null // yyyy-mm-dd
  dataFim?: string | null
  valorContrato?: number | null
}

export interface LinhaFluxoPlanilha {
  /** ISO yyyy-mm-01 */
  mes: string
  recebimento_prev: number
  despesa_mao_obra: number
  despesa_material: number
  despesa_locacao_frota: number
  despesa_outros: number
  /** soma das quatro categorias (o que vai para `despesa_prev`) */
  despesa_prev: number
  obs: string | null
}

export interface IdentificacaoFluxo {
  obra?: string
  contrato?: string
  cliente?: string
  local?: string
  projetoId?: string
}

export interface LeituraFluxo {
  identificacao: IdentificacaoFluxo
  linhas: { linha: number; dados: LinhaFluxoPlanilha; erros: string[] }[]
  avisos: string[]
}

const dd = (n: number) => String(n).padStart(2, '0')

// ─── meses ──────────────────────────────────────────────────────────────────

const MESES_PT: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
}

/** Limite de segurança: obra sem data_fim não pode gerar planilha infinita. */
const MAX_MESES = 60

/**
 * Meses (ISO yyyy-mm-01) do início ao fim da obra, inclusive. Sem data_inicio
 * começa no mês corrente; sem data_fim gera 12 meses.
 */
export function mesesDaObra(dataInicio?: string | null, dataFim?: string | null): string[] {
  const hoje = new Date()
  const ini = dataInicio ? new Date(`${dataInicio}T00:00:00`) : hoje
  const inicioValido = Number.isNaN(ini.getTime()) ? hoje : ini
  let ano = inicioValido.getFullYear()
  let mes = inicioValido.getMonth() + 1

  const fim = dataFim ? new Date(`${dataFim}T00:00:00`) : null
  const fimValido = fim && !Number.isNaN(fim.getTime()) ? fim : null
  const anoFim = fimValido ? fimValido.getFullYear() : ano + (mes + 11 > 12 ? 1 : 0)
  const mesFim = fimValido ? fimValido.getMonth() + 1 : ((mes + 11 - 1) % 12) + 1

  const out: string[] = []
  while (out.length < MAX_MESES) {
    out.push(`${ano}-${dd(mes)}-01`)
    if (ano === anoFim && mes === mesFim) break
    if (ano > anoFim || (ano === anoFim && mes > mesFim)) break
    mes++
    if (mes > 12) { mes = 1; ano++ }
  }
  return out
}

/** Aceita Date, "2026-08", "08/2026", "26/08/2026", "ago/26" e serial do Excel. */
export function parseMesCelula(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${dd(v.getMonth() + 1)}-01`
  }

  if (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 100000) {
    try {
      const d = XLSX.SSF.parse_date_code(v)
      if (d && d.y && d.m) return `${d.y}-${dd(d.m)}-01`
    } catch { /* segue para as formas em texto */ }
  }

  const s = String(v).trim()
  if (!s) return null

  let m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/)
  if (m) {
    const mo = Number(m[2])
    return mo >= 1 && mo <= 12 ? `${m[1]}-${dd(mo)}-01` : null
  }

  m = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (m) {
    const mo = Number(m[1])
    return mo >= 1 && mo <= 12 ? `${m[2]}-${dd(mo)}-01` : null
  }

  // dd/mm/aaaa (ou aa) — a projeção é mensal, então o dia é descartado
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) {
    const mo = Number(m[2])
    const anoRaw = Number(m[3])
    const ano = anoRaw < 100 ? 2000 + anoRaw : anoRaw
    return mo >= 1 && mo <= 12 ? `${ano}-${dd(mo)}-01` : null
  }

  // ago/26, ago-2026, "ago 2026"
  m = norm(s).match(/^([a-z]{3})[a-z]*[\s/\-.]*(\d{2,4})$/)
  if (m) {
    const mo = MESES_PT[m[1]]
    const anoRaw = Number(m[2])
    const ano = anoRaw < 100 ? 2000 + anoRaw : anoRaw
    if (mo) return `${ano}-${dd(mo)}-01`
  }

  return null
}

/** "2026-08-01" → "08/2026" (o que o engenheiro lê na planilha). */
export function mesLabel(iso: string): string {
  const [y, m] = iso.split('-')
  return `${m}/${y}`
}

// ─── gerar o modelo ─────────────────────────────────────────────────────────

function prazoTexto(obra: ObraContexto): string {
  const fmtData = (iso?: string | null) => {
    if (!iso) return null
    const [y, m, d] = iso.split('-')
    return y && m && d ? `${d}/${m}/${y}` : null
  }
  const ini = fmtData(obra.dataInicio)
  const fim = fmtData(obra.dataFim)
  if (ini && fim) {
    const meses = mesesDaObra(obra.dataInicio, obra.dataFim).length
    return `${ini} a ${fim} (${meses} ${meses === 1 ? 'mês' : 'meses'})`
  }
  if (ini) return `início em ${ini} (sem data de fim cadastrada)`
  return 'não cadastrado no projeto'
}

export function baixarModeloFluxo(obra: ObraContexto): void {
  const wb = XLSX.utils.book_new()
  const meses = mesesDaObra(obra.dataInicio, obra.dataFim)

  // ── LEIA-ME
  const leiaMe: unknown[][] = [
    ['FLUXO DE CAIXA — PROJEÇÃO MENSAL'],
    [''],
    [`Esta planilha já veio preenchida para a obra: ${obra.nome}.`],
    ['O cabeçalho (obra, contrato, cliente, local, prazo e valor) vem do cadastro'],
    ['do projeto no sistema — você não precisa digitar nada disso.'],
    [''],
    ['Como usar:'],
    ['1. Aba FLUXO: os meses da obra já estão listados na coluna MÊS.'],
    ['2. Preencha RECEBIMENTO PREVISTO e as despesas por categoria.'],
    ['3. DESPESA TOTAL é somada sozinha — não digite nessa coluna.'],
    ['4. Suba em DRE & Resultado → Fluxo de Caixa → Importar planilha.'],
    ['5. O sistema mostra a prévia do que vai gravar antes de confirmar.'],
    [''],
    ['Regras:'],
    ['· Não apague a linha ID DO PROJETO: é por ela que o sistema reconhece'],
    ['  a obra e evita gravar a projeção de uma obra dentro de outra.'],
    ['· Não renomeie nem reordene as colunas — o leitor se baseia nelas.'],
    ['· MÊS aceita 08/2026, 2026-08 e também ago/2026.'],
    ['· Mês que já existe no sistema é ATUALIZADO (não duplica).'],
    ['· Mês passado e mês corrente usam sempre o realizado dos lançamentos —'],
    ['  a projeção vale para os meses futuros.'],
  ]
  const wsLeia = XLSX.utils.aoa_to_sheet(leiaMe)
  wsLeia['!cols'] = [{ wch: 88 }]
  XLSX.utils.book_append_sheet(wb, wsLeia, 'LEIA-ME')

  // ── FLUXO: bloco de identificação + grade mensal
  const linhas: unknown[][] = [
    ['FLUXO DE CAIXA — PROJEÇÃO MENSAL'],
    [ROTULO.obra, obra.nome],
    [ROTULO.contrato, obra.contrato || '—'],
    [ROTULO.cliente, obra.cliente || '—'],
    [ROTULO.local, obra.cidade || '—'],
    [ROTULO.prazo, prazoTexto(obra)],
    [ROTULO.valor, obra.valorContrato && obra.valorContrato > 0 ? obra.valorContrato : '—'],
    [ROTULO.projetoId, obra.projetoId],
    [''],
    [...CAB_FLUXO],
  ]
  const primeiraLinhaDados = linhas.length + 1 // 1-based, como o Excel mostra
  for (const iso of meses) linhas.push([mesLabel(iso), 0, 0, 0, 0, 0, null, ''])

  const ws = XLSX.utils.aoa_to_sheet(linhas)
  ws['!cols'] = LARGURA_FLUXO.map((w) => ({ wch: w }))

  // DESPESA TOTAL (coluna G) é fórmula: soma das quatro categorias da linha.
  for (let i = 0; i < meses.length; i++) {
    const linhaExcel = primeiraLinhaDados + i
    ws[XLSX.utils.encode_cell({ r: linhaExcel - 1, c: 6 })] = {
      t: 'n',
      f: `SUM(C${linhaExcel}:F${linhaExcel})`,
    }
  }
  XLSX.utils.book_append_sheet(wb, ws, 'FLUXO')

  const slug = norm(obra.nome).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'obra'
  XLSX.writeFile(wb, `FLUXO_DE_CAIXA_${slug}.xlsx`)
}

// ─── ler a planilha preenchida ──────────────────────────────────────────────

const vazia = (l: unknown[]) => l.every((c) => c === null || c === undefined || String(c).trim() === '')

/** Linha de fechamento da planilha (TOTAL / TOTAIS / SOMA / SALDO) — não é mês. */
function linhaDeFechamento(l: unknown[]): boolean {
  return l.some((c) => /^\s*(total|totais|soma|subtotal|saldo)\b/i.test(String(c ?? '')))
}

function mapearColunas(cab: unknown[]): Record<string, number> {
  const alvo: Record<string, string[]> = {
    mes: ['mes', 'competencia', 'periodo', 'mes/ano'],
    recebimento: [
      'recebimento previsto', 'recebimento prev.', 'recebimento prev', 'recebimento',
      'recebimento_prev', 'receita prevista', 'receita', 'entrada', 'entradas',
    ],
    mao_obra: ['mao de obra', 'mao-de-obra', 'despesa_mao_obra', 'pessoal', 'folha'],
    material: ['material', 'materiais', 'despesa_material'],
    locacao: ['locacao/frota', 'locacao', 'frota', 'locacao e frota', 'equipamentos', 'despesa_locacao_frota'],
    outros: ['outros', 'outras despesas', 'despesa_outros'],
    despesa_total: ['despesa total', 'despesa prevista', 'despesa prev.', 'despesa prev', 'despesa_prev', 'saida', 'saidas', 'total despesa'],
    obs: ['obs', 'obs.', 'observacao', 'observacoes', 'observaçao'],
  }
  const limpo = cab.map((h) => norm(h))
  const m: Record<string, number> = {}
  for (const [chave, nomes] of Object.entries(alvo)) {
    for (let i = 0; i < limpo.length; i++) {
      if (!limpo[i]) continue
      if (Object.values(m).includes(i)) continue
      if (nomes.includes(limpo[i])) { m[chave] = i; break }
    }
  }
  return m
}

function acharLinhaCabecalho(linhas: unknown[][]): number {
  for (let i = 0; i < Math.min(25, linhas.length); i++) {
    const m = mapearColunas(linhas[i] ?? [])
    if (m.mes !== undefined && (m.recebimento !== undefined || m.despesa_total !== undefined)) return i
  }
  return -1
}

function lerIdentificacao(linhas: unknown[][], ateLinha: number): IdentificacaoFluxo {
  const id: IdentificacaoFluxo = {}
  const limite = ateLinha >= 0 ? ateLinha : Math.min(15, linhas.length)
  for (let i = 0; i < limite; i++) {
    const l = linhas[i] ?? []
    const rotulo = norm(l[0])
    const valor = String(l[1] ?? '').trim()
    if (!rotulo || !valor) continue
    if (rotulo.startsWith('obra')) id.obra ??= valor
    else if (rotulo.startsWith('contrato')) id.contrato ??= valor
    else if (rotulo.startsWith('cliente')) id.cliente ??= valor
    else if (rotulo.startsWith('local') || rotulo.startsWith('cidade')) id.local ??= valor
    else if (rotulo.startsWith('id do projeto') || rotulo.startsWith('projeto_id')) id.projetoId ??= valor
  }
  return id
}

export function lerPlanilhaFluxo(buffer: ArrayBuffer): LeituraFluxo {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const avisos: string[] = []
  const linhasOut: LeituraFluxo['linhas'] = []

  const aba = wb.SheetNames.find((n) => norm(n).includes('fluxo')) ?? wb.SheetNames[0]
  if (!aba) {
    return { identificacao: {}, linhas: [], avisos: ['A planilha não tem nenhuma aba legível.'] }
  }
  if (!norm(aba).includes('fluxo')) {
    avisos.push(`Não achei a aba FLUXO — li a primeira aba do arquivo ("${aba}").`)
  }

  const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[aba], { header: 1, raw: false, defval: '' })
  const iCab = acharLinhaCabecalho(linhas)
  const identificacao = lerIdentificacao(linhas, iCab)

  if (iCab < 0) {
    avisos.push('Não achei o cabeçalho da grade (uma linha com MÊS e RECEBIMENTO PREVISTO). Use o modelo do sistema.')
    return { identificacao, linhas: [], avisos }
  }

  const m = mapearColunas(linhas[iCab] ?? [])
  const temCategorias = ['mao_obra', 'material', 'locacao', 'outros'].some((k) => m[k] !== undefined)
  if (!temCategorias && m.despesa_total !== undefined) {
    avisos.push('A planilha não separa a despesa por categoria — o total de cada mês entra como "Outros".')
  }

  const val = (l: unknown[], k: string) => (m[k] === undefined ? '' : l[m[k]])
  const num = (l: unknown[], k: string) => {
    const v = paraNumero(val(l, k))
    return v === null ? 0 : v
  }

  for (let i = iCab + 1; i < linhas.length; i++) {
    const l = linhas[i] ?? []
    if (vazia(l)) continue
    if (linhaDeFechamento(l)) continue

    const erros: string[] = []
    const mes = parseMesCelula(val(l, 'mes'))
    if (!mes) erros.push(`mês não reconhecido ("${String(val(l, 'mes') ?? '').trim() || '—'}")`)

    const recebimento_prev = num(l, 'recebimento')
    const despesa_mao_obra = num(l, 'mao_obra')
    const despesa_material = num(l, 'material')
    const despesa_locacao_frota = num(l, 'locacao')
    let despesa_outros = num(l, 'outros')

    const somaCategorias = despesa_mao_obra + despesa_material + despesa_locacao_frota + despesa_outros
    const totalPlanilha = num(l, 'despesa_total')
    // Sem categorias preenchidas, o total da planilha é a única informação de
    // despesa que existe — cai em "Outros" para não sumir do fluxo.
    if (somaCategorias === 0 && totalPlanilha > 0) despesa_outros = totalPlanilha

    const despesa_prev = despesa_mao_obra + despesa_material + despesa_locacao_frota + despesa_outros
    if (recebimento_prev < 0 || despesa_prev < 0) erros.push('valor negativo')

    const obsTxt = String(val(l, 'obs') ?? '').trim()

    linhasOut.push({
      linha: i + 1,
      erros,
      dados: {
        mes: mes ?? '',
        recebimento_prev,
        despesa_mao_obra,
        despesa_material,
        despesa_locacao_frota,
        despesa_outros,
        despesa_prev,
        obs: obsTxt || null,
      },
    })
  }

  if (linhasOut.length === 0) avisos.push('Nenhuma linha de mês foi encontrada abaixo do cabeçalho.')

  return { identificacao, linhas: linhasOut, avisos }
}
