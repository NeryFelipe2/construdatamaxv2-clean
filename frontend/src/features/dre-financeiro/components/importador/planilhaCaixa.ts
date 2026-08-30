/**
 * planilhaCaixa.ts — modelo e parser do CONTROLE DE CAIXA.
 *
 * O LAYOUT É O DA PLANILHA REAL DA WCR (CONTROLE DE CAIXA-MODELO.xlsx), não um
 * formato inventado. O engenheiro continua preenchendo o que já conhece:
 *
 *   Aba "DESPESAS"        → duas tabelas coladas: RECEITAS em A–B (ENTRADA, DATA)
 *                            e DESPESAS em C–G (DESCRIÇÃO, VALOR, DATA DA DESPESA,
 *                            SOLICITANTE, status). Cabeçalho na LINHA 2.
 *   Aba "HORAS EXTRAS NN" → GRADE: NOME · Cargo · 01 · 02 · OBS. DIAS 01 E 02 · 08 …
 *                            Dias são colunas; o "PG" vive numa coluna OBS que
 *                            cobre um bloco de dias. O mês vem do NOME DA ABA.
 *
 * DUAS COLUNAS FORAM ACRESCENTADAS ao final das despesas, porque sem elas não
 * existe análise por centro de custo nem por natureza de gasto (pedido explícito):
 *   CATEGORIA e OBRA.
 * O parser aceita a planilha sem elas — só marca as linhas como erro, com o
 * motivo, em vez de recusar o arquivo inteiro.
 *
 * O modelo gerado e o parser saem DAS MESMAS constantes: se o layout mudar,
 * muda nos dois ao mesmo tempo.
 */
import * as XLSX from 'xlsx'
import { paraNumero, paraPeriodo, separarNomes, norm, type Problema } from './diff'

// ─── layout da aba DESPESAS (o real) ────────────────────────────────────────

/** Cabeçalho da linha 2, na ordem exata da planilha da WCR. */
export const CAB_DESPESAS = [
  'ENTRADA', 'DATA', 'DESCRIÇÃO', 'VALOR', 'DATA DA DESPESA', 'SOLICITANTE', 'STATUS',
  'CATEGORIA', 'OBRA',
] as const

export const LARGURA_DESPESAS = [12, 14, 46, 13, 18, 20, 13, 22, 20]

export const CATEGORIAS_PADRAO = [
  'Combustível', 'Transporte/Uber', 'Materiais', 'Manutenção de veículo', 'Manutenção de máquina',
  'Alimentação/VR', 'Vale-transporte', 'Alojamento', 'Ferramentas', 'Hora extra',
  'Diárias/terceiros', 'Sinistro', 'Escritório', 'Outros', 'Medição', 'Adiantamento',
]

/** Valor da diária de hora extra por cargo, como na planilha (250 / 300 / 350). */
export const VALORES_HE_PADRAO: Record<string, number> = {
  'AJUDANTE GERAL I': 300,
  'AUXILIAR DE CADASTRO I': 250,
  'ENCANADOR DE ÁGUA I': 350,
  'ENCANADOR DE ESGOTO I': 350,
  'ENCANADOR DE ESGOTO II': 350,
  'ENCANADOR IV': 350,
  'ENCARREGADO DE OBRA I': 350,
  'OPERADOR DE RETRO': 350,
  'PEDREIRO I': 300,
}

// ─── tipos de saída ─────────────────────────────────────────────────────────

export interface LancamentoPlanilha {
  tipo: 'RECEITA' | 'DESPESA'
  data_inicio: string
  data_fim: string | null
  data_texto?: string
  descricao: string
  valor: number
  categoria: string
  obra: string
  solicitantes: string[]
  forma_pagamento: string | null
  status: 'pendente' | 'conferido' | 'pago'
  anexo: string | null
  observacao: string | null
  [k: string]: unknown
}

export interface HePlanilha {
  funcionario: string
  cargo: string | null
  data: string
  valor: number | null
  obra: string
  status: 'pendente' | 'PG'
  observacao: string | null
  [k: string]: unknown
}

export interface LeituraCaixa {
  lancamentos: { linha: number; dados: LancamentoPlanilha }[]
  horasExtras: { linha: number; dados: HePlanilha }[]
  avisos: string[]
  /** ano usado para montar as datas da grade de HE (a aba só traz o mês) */
  anoHe?: number
}

// ─── gerar o modelo (mesmo layout, para o preenchimento ser o de sempre) ────

/** Fins de semana do mês — são os dias que a grade de HE traz. */
function diasDeFimDeSemana(ano: number, mes: number): number[] {
  const out: number[] = []
  const ultimo = new Date(ano, mes, 0).getDate()
  for (let d = 1; d <= ultimo; d++) {
    const dow = new Date(ano, mes - 1, d).getDay()
    if (dow === 0 || dow === 6) out.push(d)
  }
  return out
}

const dd = (n: number) => String(n).padStart(2, '0')

export function baixarModeloCaixa(
  categorias: string[] = CATEGORIAS_PADRAO,
  obras: string[] = [],
  pessoas: { nome: string; cargo?: string | null }[] = [],
  ano = new Date().getFullYear(),
  mes = new Date().getMonth() + 1,
): void {
  const wb = XLSX.utils.book_new()

  // ── LEIA-ME
  const leiaMe: unknown[][] = [
    ['CONTROLE DE CAIXA — MODELO'],
    [''],
    ['É o mesmo formato que vocês já usam. Só duas colunas foram acrescentadas'],
    ['no fim das despesas: CATEGORIA e OBRA — sem elas não dá para saber em que'],
    ['a obra gastou nem separar por centro de custo.'],
    [''],
    ['Como usar:'],
    ['1. Aba DESPESAS: receitas em A–B (ENTRADA e DATA), despesas de C em diante.'],
    ['2. Aba HORAS EXTRAS ' + dd(mes) + ': ponha o valor no dia trabalhado. O "PG" vai na'],
    ['   coluna OBS. do bloco, como sempre.'],
    ['3. Suba em DRE & Resultado → Controle de Caixa → Importar planilha.'],
    ['4. O sistema mostra o que é NOVO, o que MUDOU e o que tem ERRO antes de gravar.'],
    [''],
    ['Regras:'],
    ['· Não renomeie nem reordene as colunas — o leitor se baseia nelas.'],
    ['· DATA DA DESPESA aceita 05/08/2026 e também período: 01 A 10/08/2026.'],
    ['· Mais de um solicitante: separe por barra — DAMIÃO/WELLINGTON.'],
    ['· Categoria fora da lista não é recusada: o sistema pergunta se deve cadastrar.'],
    ['· Marcar PG na hora extra gera a despesa automaticamente, categoria "Hora extra".'],
    [''],
    ['Categorias disponíveis:'],
    ...categorias.map((c) => ['· ' + c]),
    ...(obras.length ? [[''], ['Obras cadastradas:'], ...obras.map((o) => ['· ' + o])] : []),
  ]
  const wsLeia = XLSX.utils.aoa_to_sheet(leiaMe)
  wsLeia['!cols'] = [{ wch: 88 }]
  XLSX.utils.book_append_sheet(wb, wsLeia, 'LEIA-ME')

  // ── DESPESAS (linha 1 = faixas mescladas, linha 2 = cabeçalho, como no real)
  const linhasD: unknown[][] = [
    ['RECEITAS', '', 'DESPESAS', '', '', '', '', '', ''],
    [...CAB_DESPESAS],
    [2000, `05/${dd(mes)}/${ano}`, 'CONSERTO DE 2 PNEUS DA CARRETA', 1000,
     `05/${dd(mes)}/${ano}`, 'ÉDER', 'Conferido', 'Manutenção de veículo', 'BOI MALHADO'],
    [0, '', 'DIESEL — MÁQUINA JAILTON', 1000,
     `06/${dd(mes)}/${ano}`, 'JAILTON', '', 'Combustível', 'BOI MALHADO'],
    [0, '', 'VR REF. JANTA', 1000,
     `01 A 10/${dd(mes)}/${ano}`, 'FELIPE RH', '', 'Alimentação/VR', 'BOI MALHADO'],
  ]
  for (let i = 0; i < 60; i++) linhasD.push(['', '', '', '', '', '', '', '', ''])
  const wsD = XLSX.utils.aoa_to_sheet(linhasD)
  wsD['!cols'] = LARGURA_DESPESAS.map((w) => ({ wch: w }))
  wsD['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },   // RECEITAS  A1:B1
    { s: { r: 0, c: 2 }, e: { r: 0, c: 5 } },   // DESPESAS  C1:F1
  ]
  XLSX.utils.book_append_sheet(wb, wsD, 'DESPESAS')

  // ── HORAS EXTRAS NN (grade: dias como coluna, OBS por bloco de fim de semana)
  const fds = diasDeFimDeSemana(ano, mes)
  const cabHe: string[] = ['NOME', 'Cargo']
  // agrupa o fim de semana em pares (sáb+dom) e põe a coluna OBS depois de cada par
  const blocos: number[][] = []
  for (let i = 0; i < fds.length; i += 2) blocos.push(fds.slice(i, i + 2))
  for (const b of blocos) {
    for (const d of b) cabHe.push(dd(d))
    cabHe.push(b.length === 2 ? `OBS. DIAS ${dd(b[0])} E ${dd(b[1])}` : `OBS. DIA ${dd(b[0])}`)
  }
  const linhasH: unknown[][] = [cabHe]
  const lista = pessoas.length ? pessoas : [{ nome: '(preencha com o nome do funcionário)', cargo: '' }]
  for (const p of lista) linhasH.push([p.nome, p.cargo ?? '', ...cabHe.slice(2).map(() => '')])
  const wsH = XLSX.utils.aoa_to_sheet(linhasH)
  wsH['!cols'] = [{ wch: 34 }, { wch: 24 }, ...cabHe.slice(2).map((c) => ({ wch: c.startsWith('OBS') ? 18 : 7 }))]
  XLSX.utils.book_append_sheet(wb, wsH, `HORAS EXTRAS ${dd(mes)}`)

  XLSX.writeFile(wb, `CONTROLE_DE_CAIXA_${ano}_${dd(mes)}.xlsx`)
}

// ─── ler a planilha preenchida ──────────────────────────────────────────────

const vazia = (l: unknown[]) => l.every((c) => c === null || c === undefined || String(c).trim() === '')

/** Casa o cabeçalho com CAB_DESPESAS tolerando acento, abreviação e coluna sem nome. */
function mapearDespesas(cab: unknown[]): Record<string, number> {
  const alvo: Record<string, string[]> = {
    entrada: ['entrada', 'receita', 'valor entrada'],
    data_receita: ['data'],
    descricao: ['descricao', 'descrição', 'historico', 'histórico'],
    valor: ['valor'],
    data_despesa: ['data da despesa', 'data despesa', 'data'],
    solicitante: ['solicitante', 'solicitantes', 'quem pediu'],
    status: ['status', 'conferencia', 'conferência', 'situacao', 'situação'],
    categoria: ['categoria'],
    obra: ['obra', 'nucleo', 'núcleo', 'centro de custo'],
  }
  const limpo = cab.map((h) => norm(h))
  const m: Record<string, number> = {}
  // ordem importa: DATA (col B) é da receita; DATA DA DESPESA (col E) é da despesa
  for (const [chave, nomes] of Object.entries(alvo)) {
    for (let i = 0; i < limpo.length; i++) {
      if (!limpo[i]) continue
      if (Object.values(m).includes(i)) continue
      if (nomes.includes(limpo[i])) { m[chave] = i; break }
    }
  }
  // a coluna de status costuma vir SEM cabeçalho, logo depois de SOLICITANTE
  if (m.status === undefined && m.solicitante !== undefined) {
    const i = m.solicitante + 1
    if (i < cab.length && !limpo[i]) m.status = i
  }
  return m
}

function acharLinhaCabecalho(linhas: unknown[][]): number {
  for (let i = 0; i < Math.min(6, linhas.length); i++) {
    const m = mapearDespesas(linhas[i] ?? [])
    if (m.descricao !== undefined && m.valor !== undefined) return i
  }
  return 1 // o padrão da planilha real é a linha 2 (índice 1)
}

const statusDe = (v: unknown): 'pendente' | 'conferido' | 'pago' => {
  const s = norm(v)
  if (s.startsWith('confer')) return 'conferido'
  if (s === 'pago' || s === 'pg') return 'pago'
  return 'pendente'
}

/** "OBS. DIAS 01 E 02" → [1,2] ; "OBS. DIA 15" → [15] */
function diasDaObs(titulo: string): number[] {
  return (String(titulo).match(/\d{1,2}/g) ?? []).map(Number).filter((n) => n >= 1 && n <= 31)
}

export function lerPlanilhaCaixa(buffer: ArrayBuffer, anoPadrao = new Date().getFullYear()): LeituraCaixa {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const avisos: string[] = []
  const lancamentos: LeituraCaixa['lancamentos'] = []
  const horasExtras: LeituraCaixa['horasExtras'] = []

  // ── DESPESAS ─────────────────────────────────────────────────────────────
  const abaD = wb.SheetNames.find((n) => ['despesas', 'lancamentos', 'lançamentos', 'caixa'].includes(norm(n)))
  if (!abaD) {
    avisos.push('A aba DESPESAS não foi encontrada. Use o modelo do sistema.')
  } else {
    const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[abaD], { header: 1, raw: false, defval: '' })
    const iCab = acharLinhaCabecalho(linhas)
    const m = mapearDespesas(linhas[iCab] ?? [])
    if (m.descricao === undefined || m.valor === undefined) {
      avisos.push('Não achei as colunas DESCRIÇÃO e VALOR na aba DESPESAS.')
    }
    if (m.categoria === undefined) {
      avisos.push('A planilha não tem a coluna CATEGORIA — as despesas vão entrar como erro. Baixe o modelo novo.')
    }
    if (m.obra === undefined) {
      avisos.push('A planilha não tem a coluna OBRA — as despesas vão entrar como erro. Baixe o modelo novo.')
    }
    const val = (l: unknown[], k: string) => (m[k] === undefined ? '' : l[m[k]])

    for (let i = iCab + 1; i < linhas.length; i++) {
      const l = linhas[i] ?? []
      if (vazia(l)) continue
      const nLinha = i + 1

      // RECEITA: colunas A (ENTRADA) e B (DATA), quando ENTRADA > 0
      const entrada = paraNumero(val(l, 'entrada'))
      if (entrada !== null && entrada > 0) {
        const per = paraPeriodo(val(l, 'data_receita'))
        lancamentos.push({
          linha: nLinha,
          dados: {
            tipo: 'RECEITA',
            data_inicio: per?.inicio ?? '',
            data_fim: per?.fim ?? null,
            data_texto: per?.textoOriginal,
            descricao: 'Entrada de caixa',
            valor: entrada,
            categoria: String(val(l, 'categoria') ?? '').trim() || 'Medição',
            obra: String(val(l, 'obra') ?? '').trim(),
            solicitantes: [],
            forma_pagamento: null,
            status: statusDe(val(l, 'status')),
            anexo: null,
            observacao: null,
          },
        })
      }

      // DESPESA: colunas C em diante
      const descricao = String(val(l, 'descricao') ?? '').trim()
      const valor = paraNumero(val(l, 'valor'))
      if (!descricao && valor === null) continue
      // linha de total ("TOTAL", "SOMA") no rodapé não é lançamento
      // "TOTAIS" NÃO casa com /^total/ — o radical "tota" pega TOTAL e TOTAIS
      if (/^(tota|soma|saldo|subtotal)/i.test(descricao)) continue

      const per = paraPeriodo(val(l, 'data_despesa'))
      lancamentos.push({
        linha: nLinha,
        dados: {
          tipo: 'DESPESA',
          data_inicio: per?.inicio ?? '',
          data_fim: per?.fim ?? null,
          data_texto: per?.textoOriginal,
          descricao,
          valor: valor ?? NaN,
          categoria: String(val(l, 'categoria') ?? '').trim(),
          obra: String(val(l, 'obra') ?? '').trim(),
          solicitantes: separarNomes(val(l, 'solicitante')),
          forma_pagamento: null,
          status: statusDe(val(l, 'status')),
          anexo: null,
          observacao: null,
        },
      })
    }
  }

  // ── HORAS EXTRAS NN (grade) ──────────────────────────────────────────────
  const abaH = wb.SheetNames.find((n) => norm(n).startsWith('horas extras'))
  if (abaH) {
    // o mês vem do nome da aba ("HORAS EXTRAS 08"); o ano NÃO está no arquivo
    const mesDaAba = Number((abaH.match(/(\d{1,2})\s*$/) ?? [])[1])
    const mes = mesDaAba >= 1 && mesDaAba <= 12 ? mesDaAba : new Date().getMonth() + 1
    if (!mesDaAba) avisos.push(`Não consegui ler o mês do nome da aba "${abaH}" — usei o mês atual.`)
    avisos.push(`Horas extras: mês ${dd(mes)} (do nome da aba) e ano ${anoPadrao}. A planilha não traz o ano.`)

    const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[abaH], { header: 1, raw: false, defval: '' })
    const cab = (linhas[0] ?? []).map((c) => String(c ?? '').trim())

    // mapeia cada coluna: dia (número) ou OBS (aplica-se a um bloco de dias)
    const colDia = new Map<number, number>()          // índice da coluna → dia
    const colObs = new Map<number, number[]>()        // índice da coluna → dias que ela cobre
    for (let c = 2; c < cab.length; c++) {
      const t = cab[c]
      if (!t) continue
      if (/^obs/i.test(norm(t))) { colObs.set(c, diasDaObs(t)); continue }
      const d = Number(t)
      if (Number.isInteger(d) && d >= 1 && d <= 31) colDia.set(c, d)
    }
    if (colDia.size === 0) avisos.push(`Nenhuma coluna de dia reconhecida na aba "${abaH}".`)

    for (let i = 1; i < linhas.length; i++) {
      const l = linhas[i] ?? []
      const nome = String(l[0] ?? '').trim()
      if (!nome) continue
      // a planilha real fecha com uma linha "TOTAIS" (A56) cujos valores são a
      // soma da coluna — sem este corte, 6300 e 4300 virariam diária de alguém
      if (/^(tota|soma|saldo|subtotal)/i.test(nome)) continue
      const cargo = String(l[1] ?? '').trim() || null

      // status por dia: vem da coluna OBS do bloco a que o dia pertence
      const statusDoDia = new Map<number, 'pendente' | 'PG'>()
      for (const [c, dias] of colObs) {
        const marcado = norm(l[c]) === 'pg'
        for (const d of dias) statusDoDia.set(d, marcado ? 'PG' : 'pendente')
      }

      for (const [c, dia] of colDia) {
        const v = paraNumero(l[c])
        if (v === null || v === 0) continue            // dia sem hora extra
        horasExtras.push({
          linha: i + 1,
          dados: {
            funcionario: nome,
            cargo,
            data: `${anoPadrao}-${dd(mes)}-${dd(dia)}`,
            valor: v,
            obra: '',                                   // a grade não tem obra; a tela pergunta
            status: statusDoDia.get(dia) ?? 'pendente',
            observacao: null,
          },
        })
      }
    }
  }

  return { lancamentos, horasExtras, avisos, anoHe: anoPadrao }
}

// ─── validação por linha ────────────────────────────────────────────────────

export function validarLancamento(l: LancamentoPlanilha): Problema[] {
  const p: Problema[] = []
  if (!l.data_inicio) p.push({ campo: 'data', mensagem: 'Data não reconhecida. Use dd/mm/aaaa ou "01 A 10/08/2026".', bloqueia: true })
  if (!l.descricao) p.push({ campo: 'descricao', mensagem: 'Descrição vazia.', bloqueia: true })
  if (!Number.isFinite(l.valor)) p.push({ campo: 'valor', mensagem: 'Valor não é um número.', bloqueia: true })
  else if (l.valor < 0) p.push({ campo: 'valor', mensagem: 'Valor negativo — use a coluna certa (receita ou despesa).', bloqueia: true })
  else if (l.valor === 0) p.push({ campo: 'valor', mensagem: 'Valor zerado — confira.', bloqueia: false })
  if (!l.categoria) p.push({ campo: 'categoria', mensagem: 'Categoria é obrigatória (coluna CATEGORIA).', bloqueia: true })
  if (!l.obra) p.push({ campo: 'obra', mensagem: 'Obra é obrigatória (coluna OBRA — centro de custo).', bloqueia: true })
  if (l.data_fim && l.data_fim < l.data_inicio) p.push({ campo: 'data', mensagem: 'Fim do período antes do início.', bloqueia: true })
  if (l.valor > 100000) p.push({ campo: 'valor', mensagem: 'Acima de R$ 100 mil — confira antes de confirmar.', bloqueia: false })
  if (!l.solicitantes.length && l.tipo === 'DESPESA') {
    p.push({ campo: 'solicitante', mensagem: 'Sem solicitante — a despesa entra, mas ninguém responde por ela.', bloqueia: false })
  }
  return p
}

export function validarHe(h: HePlanilha): Problema[] {
  const p: Problema[] = []
  if (!h.funcionario) p.push({ campo: 'funcionario', mensagem: 'Funcionário vazio.', bloqueia: true })
  if (!h.data) p.push({ campo: 'data', mensagem: 'Data não montada (mês da aba + dia da coluna).', bloqueia: true })
  if (h.valor !== null && h.valor <= 0) p.push({ campo: 'valor', mensagem: 'Valor precisa ser maior que zero.', bloqueia: true })
  if (h.valor !== null && h.valor > 1000) {
    p.push({ campo: 'valor', mensagem: 'Valor alto para uma diária — pode ser a linha de TOTAL da planilha.', bloqueia: false })
  }
  if (h.data) {
    const dia = new Date(h.data + 'T12:00:00').getDay()
    if (dia >= 1 && dia <= 5) {
      p.push({ campo: 'data', mensagem: 'Dia útil — hora extra costuma ser fim de semana ou feriado. Confira.', bloqueia: false })
    }
  }
  return p
}
