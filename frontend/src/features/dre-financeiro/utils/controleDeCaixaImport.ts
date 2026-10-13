/**
 * A conferência: o que muda no sistema se esta planilha for importada.
 *
 * ⚠️ **Nada grava antes de a pessoa confirmar.** Este arquivo só compara e classifica; quem grava
 * é o painel, depois do "confirmar".
 *
 * O gesto que o cliente vai repetir é **reimportar o mesmo arquivo, cada vez mais cheio**. Por
 * isso a pergunta que este motor responde não é "quais linhas existem", e sim "quais linhas são
 * NOVAS em relação ao que já está no sistema" — e a resposta tem de ser estável: importar duas
 * vezes seguidas o mesmo arquivo precisa dar "nada mudou" na segunda.
 */
import { seededId } from '@/lib/seededId'
import type { FinanceiroEntry, EntradaCategoria, SaidaCategoria } from '@/types'
import type { HoraExtraLida, LinhaLida, ProblemaNaLinha } from './controleDeCaixaPlanilha'
import { normalizarTexto } from './controleDeCaixaPlanilha'

export type Situacao = 'novo' | 'valor-alterado' | 'cadastro-alterado' | 'inalterado' | 'duplicado'

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  'novo':              'Novo',
  'valor-alterado':    'Valor alterado',
  'cadastro-alterado': 'Cadastro alterado',
  'inalterado':        'Inalterado',
  'duplicado':         'Duplicado no arquivo',
}

export interface MudancaDeCampo {
  campo: string
  rotulo: string
  antes: unknown
  depois: unknown
}

export interface LinhaConferida {
  situacao: Situacao
  /** O id que este lançamento terá — determinístico, e é o que impede a duplicata. */
  id: string
  lida: LinhaLida
  /** O lançamento que já existe no sistema, quando existe. */
  existente?: FinanceiroEntry
  mudancas: MudancaDeCampo[]
}

export interface AusenteDaPlanilha {
  entry: FinanceiroEntry
  /** Por que estamos apontando — e por que NÃO vamos apagar. */
  observacao: string
}

export interface Conferencia {
  linhas: LinhaConferida[]
  /** Está no sistema, não veio no arquivo. ⚠️ NUNCA é apagado — só apontado. */
  ausentes: AusenteDaPlanilha[]
  problemas: ProblemaNaLinha[]
  resumo: Record<Situacao, number>
  /** Período que o arquivo cobre. É ele que limita o escopo dos "ausentes". */
  periodo: { de: string; ate: string } | null
  /** A soma do sistema contra a que a planilha declara no rodapé. */
  divergenciaDeTotais: Array<{ oQue: string; calculado: number; declarado: number }>
}

/**
 * O id de um lançamento vindo de planilha.
 *
 * Determinístico a partir da chave de conteúdo, porque `addEntry` é UPSERT por id
 * (`financeiroStore.ts:130`): mesmo id → o lançamento é substituído, não duplicado. É esta linha
 * que faz a reimportação ser segura.
 */
export function idDoLancamento(orgId: string | null | undefined, chave: string): string {
  return seededId(orgId, 'caixa-planilha', chave)
}

const CAMPOS_DE_CADASTRO: Array<[keyof FinanceiroEntry, string]> = [
  ['descricao', 'Descrição'],
  ['data', 'Data'],
  ['dataFim', 'Fim do período'],
  ['categoria', 'Categoria'],
  ['obraId', 'Obra'],
  ['conferido', 'Conferido'],
]

/** Categoria padrão de quem chega sem classificação — e ela diz "não classificado", não chuta. */
export const CATEGORIA_PADRAO: { entrada: EntradaCategoria; saida: SaidaCategoria } = {
  entrada: 'outro',
  saida: 'outro',
}

const CATEGORIAS_VALIDAS = new Set<string>([
  'medicao', 'adiantamento', 'reajuste', 'outro',
  'materiais', 'mao_de_obra', 'equipamentos', 'subempreiteiros', 'administrativo',
])

/** Aceita a categoria escrita na planilha em várias grafias; o que não reconhece vira "outro". */
export function lerCategoria(bruta: string | undefined, tipo: 'entrada' | 'saida'): EntradaCategoria | SaidaCategoria {
  if (!bruta) return tipo === 'entrada' ? CATEGORIA_PADRAO.entrada : CATEGORIA_PADRAO.saida
  const n = normalizarTexto(bruta).replace(/[\s-]+/g, '_').toLowerCase()
  const apelidos: Record<string, string> = {
    medicao: 'medicao', medicoes: 'medicao',
    adiantamento: 'adiantamento', reajuste: 'reajuste',
    material: 'materiais', materiais: 'materiais',
    mao_de_obra: 'mao_de_obra', maodeobra: 'mao_de_obra', pessoal: 'mao_de_obra',
    equipamento: 'equipamentos', equipamentos: 'equipamentos',
    subempreiteiro: 'subempreiteiros', subempreiteiros: 'subempreiteiros',
    administrativo: 'administrativo', administracao: 'administrativo',
    outro: 'outro', outros: 'outro',
  }
  const alvo = apelidos[n] ?? n
  if (!CATEGORIAS_VALIDAS.has(alvo)) return tipo === 'entrada' ? CATEGORIA_PADRAO.entrada : CATEGORIA_PADRAO.saida
  return alvo as EntradaCategoria | SaidaCategoria
}

/** Converte a linha lida no lançamento que será gravado. */
export function lancamentoDaLinha(
  l: LinhaLida,
  orgId: string | null | undefined,
  opcoes: { obraId?: string; agora: string; conferidoPor?: string },
): FinanceiroEntry {
  return {
    id: l.idExterno || idDoLancamento(orgId, l.chave),
    tipo: l.tipo === 'receita' ? 'entrada' : 'saida',
    descricao: l.descricao,
    valor: l.valor,
    data: l.data,
    dataFim: l.dataFim,
    categoria: lerCategoria(l.categoria, l.tipo === 'receita' ? 'entrada' : 'saida'),
    obraId: opcoes.obraId,
    solicitantes: l.solicitantes.length > 0 ? l.solicitantes : undefined,
    conferido: l.conferido || undefined,
    // ⚠️ Quem e quando, junto do "sim". Os campos existiam e só a sub-aba Conferência os
    // preenchia; vindo da planilha, o lançamento ficava marcado como conferido sem nenhum rastro
    // de quem conferiu — que é o mesmo que não estar conferido, com a aparência de estar.
    conferidoPor: l.conferido ? (opcoes.conferidoPor || undefined) : undefined,
    conferidoEm: l.conferido ? opcoes.agora : undefined,
    origem: 'planilha',
    chavePlanilha: l.chave,
    createdAt: opcoes.agora,
  }
}

function comparavel(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'number') return v.toFixed(2)
  if (Array.isArray(v)) return v.map((x) => normalizarTexto(x)).sort().join('+')
  if (typeof v === 'string') return normalizarTexto(v)
  return String(v)
}

/**
 * Compara o que veio na planilha com o que já está no sistema.
 *
 * `existentes` deve ser a lista COMPLETA de lançamentos do Financeiro — o filtro por origem e por
 * período é feito aqui dentro, onde as regras estão escritas.
 */
export function conferir(
  lidas: LinhaLida[],
  existentes: FinanceiroEntry[],
  problemas: ProblemaNaLinha[],
  orgId: string | null | undefined,
  opcoes: { obraId?: string; agora: string; totaisDeclarados?: { receitas?: number; despesas?: number } | null },
): Conferencia {
  const porId = new Map(existentes.map((e) => [e.id, e]))
  const porChave = new Map(existentes.filter((e) => e.chavePlanilha).map((e) => [e.chavePlanilha!, e]))

  const linhas: LinhaConferida[] = []
  const vistos = new Set<string>()

  for (const l of lidas) {
    const novo = lancamentoDaLinha(l, orgId, opcoes)

    // ⚠️ Duplicado é o mesmo ID duas vezes NO ARQUIVO — acontece quando alguém copia uma linha da
    // planilha que o sistema gerou (o ID vem junto). Duas linhas iguais SEM id não são duplicata:
    // o leitor já as separou por ordem de aparição, porque na planilha real elas são dois gastos.
    if (vistos.has(novo.id)) {
      linhas.push({ situacao: 'duplicado', id: novo.id, lida: l, mudancas: [] })
      continue
    }
    vistos.add(novo.id)

    const existente = porId.get(novo.id) ?? (l.idExterno ? undefined : porChave.get(l.chave))
    if (!existente) {
      linhas.push({ situacao: 'novo', id: novo.id, lida: l, mudancas: [] })
      continue
    }

    const mudancas: MudancaDeCampo[] = []
    if (comparavel(existente.valor) !== comparavel(novo.valor)) {
      mudancas.push({ campo: 'valor', rotulo: 'Valor', antes: existente.valor, depois: novo.valor })
    }
    for (const [campo, rotulo] of CAMPOS_DE_CADASTRO) {
      if (comparavel(existente[campo]) !== comparavel(novo[campo])) {
        mudancas.push({ campo, rotulo, antes: existente[campo], depois: novo[campo] })
      }
    }
    if (comparavel(existente.solicitantes) !== comparavel(novo.solicitantes)) {
      mudancas.push({ campo: 'solicitantes', rotulo: 'Solicitante', antes: existente.solicitantes, depois: novo.solicitantes })
    }

    const situacao: Situacao = mudancas.length === 0
      ? 'inalterado'
      : mudancas.some((m) => m.campo === 'valor') ? 'valor-alterado' : 'cadastro-alterado'
    linhas.push({ situacao, id: novo.id, lida: l, existente, mudancas })
  }

  // ── O que sumiu da planilha ──
  // ⚠️ Escopo LIMITADO ao período do arquivo. Sem isso, importar a planilha de julho listaria
  // todo agosto como "sumiu" — e a tela pediria para conferir 200 linhas que estão certas.
  const datas = lidas.map((l) => l.data).sort()
  const periodo = datas.length > 0 ? { de: datas[0], ate: datas[datas.length - 1] } : null

  const ausentes: AusenteDaPlanilha[] = []
  if (periodo) {
    for (const e of existentes) {
      if (e.origem !== 'planilha') continue          // digitado na tela não se espera na planilha
      if (e.data < periodo.de || e.data > periodo.ate) continue
      if (vistos.has(e.id)) continue
      ausentes.push({
        entry: e,
        // A frase é a política, e ela é deliberada: apagar aqui destruiria um lançamento que pode
        // já ter sido conciliado. Quem apaga é a pessoa, uma a uma, na tela.
        observacao: 'Está no sistema e não veio neste arquivo. Não foi apagado — confira se a linha foi removida de propósito.',
      })
    }
  }

  // ── Confere a soma contra o rodapé da própria planilha ──
  const divergenciaDeTotais: Conferencia['divergenciaDeTotais'] = []
  const t = opcoes.totaisDeclarados
  if (t) {
    const soma = (tipo: 'receita' | 'despesa') =>
      lidas.filter((l) => l.tipo === tipo).reduce((a, l) => a + l.valor, 0)
    if (t.receitas !== undefined && Math.abs(soma('receita') - t.receitas) > 0.01) {
      divergenciaDeTotais.push({ oQue: 'Receitas', calculado: soma('receita'), declarado: t.receitas })
    }
    if (t.despesas !== undefined && Math.abs(soma('despesa') - t.despesas) > 0.01) {
      divergenciaDeTotais.push({ oQue: 'Despesas', calculado: soma('despesa'), declarado: t.despesas })
    }
  }

  const resumo: Record<Situacao, number> = {
    'novo': 0, 'valor-alterado': 0, 'cadastro-alterado': 0, 'inalterado': 0, 'duplicado': 0,
  }
  for (const l of linhas) resumo[l.situacao]++

  return { linhas, ausentes, problemas, resumo, periodo, divergenciaDeTotais }
}

/**
 * As situações que de fato viram gravação.
 *
 * `inalterado` fica de fora porque reescrever o que não mudou geraria uma linha de auditoria vazia
 * a cada importação; `duplicado` fica de fora porque a segunda cópia sobrescreveria a primeira com
 * o mesmo conteúdo — e a pessoa precisa decidir o que fazer com ela, não o sistema.
 */
export const SITUACOES_QUE_GRAVAM: readonly Situacao[] = ['novo', 'valor-alterado', 'cadastro-alterado']

export function linhasAGravar(c: Conferencia): LinhaConferida[] {
  const grava = new Set<Situacao>(SITUACOES_QUE_GRAVAM)
  return c.linhas.filter((l) => grava.has(l.situacao))
}

// ─── Horas extras ─────────────────────────────────────────────────────────────

/**
 * A hora extra vira despesa no Financeiro — mas **só quando marcada como paga**.
 *
 * Enquanto está só lançada na grade, é previsão: a empresa ainda não desembolsou. Jogar tudo no
 * caixa faria a despesa aparecer antes de existir, e o saldo do mês ficaria pior do que é.
 */
export function idDaHoraExtra(orgId: string | null | undefined, chave: string): string {
  return seededId(orgId, 'caixa-hora-extra', chave)
}

export function lancamentoDaHoraExtra(
  r: HoraExtraLida,
  orgId: string | null | undefined,
  opcoes: { obraId?: string; agora: string },
): FinanceiroEntry {
  return {
    id: idDaHoraExtra(orgId, r.chave),
    tipo: 'saida',
    descricao: `Hora extra — ${r.nome}`,
    valor: r.valor,
    data: r.data,
    categoria: 'mao_de_obra',
    obraId: opcoes.obraId,
    origem: 'horas-extras',
    chavePlanilha: r.chave,
    funcionarioNome: r.nome,
    cargo: r.cargo,
    conferido: true,
    createdAt: opcoes.agora,
  }
}

export function horasExtrasQueViramDespesa(registros: HoraExtraLida[]): HoraExtraLida[] {
  return registros.filter((r) => r.pago)
}
