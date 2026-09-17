/**
 * caixaCd.ts — a tradução entre o motor de conferência do Controle de Caixa
 * (controleDeCaixa*.ts, que veio do pacote e NÃO deve ser alterado) e o banco do ConstruData.
 *
 * O motor pensa em `FinanceiroEntry`, com categoria de um enum fixo e "conferido" booleano.
 * O ConstruData grava em `caixa_lancamento`, com categoria cadastrável (`caixa_categoria`) e
 * status de três estados (pendente / conferido / pago). Este arquivo:
 *
 *   1. converte as linhas do banco para o formato do motor, NEUTRALIZANDO categoria e
 *      solicitantes onde o banco não tem como comparar (senão toda reimportação acusaria
 *      "cadastro alterado" em linha que ninguém mexeu);
 *   2. roda o motor (`conferir`) — identidade, duplicados, "sumiu da planilha", totais;
 *   3. refaz a comparação de categoria e status do jeito do ConstruData e acrescenta as
 *      validações que só o ConstruData tinha.
 *
 * ⚠️ Puro de propósito: nada de supabase aqui, para rodar em `node:test`.
 */
import type { FinanceiroEntry } from '@/types'
import {
  conferir, SITUACOES_QUE_GRAVAM,
  type Conferencia, type LinhaConferida, type MudancaDeCampo, type Situacao,
} from './controleDeCaixaImport'
import {
  acharCabecalho, normalizarTexto,
  type LeituraDeCaixa, type LinhaLida, type Matriz,
} from './controleDeCaixaPlanilha'

export type StatusCd = 'pendente' | 'conferido' | 'pago'

/** Uma linha de `caixa_lancamento` como o importador a carrega (categoria já pelo nome). */
export interface LancamentoCd {
  id: string
  tipo: 'RECEITA' | 'DESPESA'
  data_inicio: string
  data_fim: string | null
  descricao: string
  valor: number
  categoria_nome: string
  projeto_id: string | null
  status: StatusCd
  origem: string
  created_at?: string | null
  deleted_at?: string | null
  /** Só existe depois da migration 033. */
  chave_importacao?: string | null
  /** Só existe depois da migration 033. */
  solicitantes_texto?: string[] | null
}

export interface CategoriaCd { id: string; nome: string; tipo: string }

export interface ContextoCd {
  projetoId: string
  nomeProjeto: string
  categorias: CategoriaCd[]
  agora: string
  /** `false` enquanto a migration 033 não foi colada: não há onde guardar o texto do solicitante. */
  colunasDeImportacao: boolean
}

export interface ProblemaCd { mensagem: string; bloqueia: boolean }

export interface LinhaCd extends LinhaConferida {
  categoriaNome: string
  /** A categoria veio escrita na planilha e não está cadastrada. */
  categoriaNova: boolean
  status: StatusCd
  problemasCd: ProblemaCd[]
}

export interface ConferenciaCd extends Omit<Conferencia, 'linhas'> {
  linhas: LinhaCd[]
  /** Totais do rodapé que BATERAM — mostrar o acerto também (regra 10 do pacote). */
  totaisQueBateram: Array<{ oQue: string; valor: number }>
}

// ─── conversões ───────────────────────────────────────────────────────────────

/** Categoria neutra: o motor compara o enum dele, que aqui não significa nada. */
const CATEGORIA_NEUTRA = 'outro'

export function linhaParaEntry(l: LancamentoCd, colunasDeImportacao: boolean): FinanceiroEntry {
  return {
    id: l.id,
    tipo: l.tipo === 'RECEITA' ? 'entrada' : 'saida',
    descricao: l.descricao,
    valor: Number(l.valor),
    data: l.data_inicio,
    dataFim: l.data_fim ?? undefined,
    categoria: CATEGORIA_NEUTRA,
    obraId: l.projeto_id ?? undefined,
    // Sem a coluna, os dois lados vão vazios: comparar nome da planilha com o cadastro de pessoas
    // daria "alterado" a cada importação.
    solicitantes: colunasDeImportacao && l.solicitantes_texto?.length ? l.solicitantes_texto : undefined,
    conferido: l.status !== 'pendente' ? true : undefined,
    origem: l.origem,
    chavePlanilha: l.chave_importacao ?? undefined,
  }
}

const MARCAS_DE_PAGO = new Set(['PG', 'PAGO', 'PAGA'])

/** Status de três estados, relendo a célula crua: o motor só sabe "conferido sim/não". */
export function statusDaLinha(l: LinhaLida, matriz: Matriz, colunaConferido: number | undefined): StatusCd {
  if (!l.conferido) return 'pendente'
  if (colunaConferido === undefined) return 'conferido'
  const bruto = normalizarTexto(matriz[l.linha - 1]?.[colunaConferido])
  return MARCAS_DE_PAGO.has(bruto) ? 'pago' : 'conferido'
}

/**
 * Categoria pelo nome cadastrado. Sem coluna CATEGORIA: receita vira "Medição" e despesa é
 * deduzida da descrição (`deduzir`, que é o `categoriaPorDescricao` do ConstruData).
 */
export function categoriaDaLinha(
  l: LinhaLida,
  categorias: CategoriaCd[],
  deduzir: (descricao: string) => string,
): { nome: string; nova: boolean } {
  const bruta = (l.categoria ?? '').trim()
  if (bruta) {
    const achou = categorias.find((c) => normalizarTexto(c.nome) === normalizarTexto(bruta))
    return achou ? { nome: achou.nome, nova: false } : { nome: bruta, nova: true }
  }
  const nome = l.tipo === 'receita' ? 'Medição' : deduzir(l.descricao)
  const achou = categorias.find((c) => normalizarTexto(c.nome) === normalizarTexto(nome))
  return { nome: achou?.nome ?? nome, nova: !achou }
}

/** A coluna OBRA, quando existe, tem de ser a obra selecionada na tela. */
export function obraConfere(obra: string | undefined, nomeProjeto: string): boolean {
  if (!obra) return true
  // "BOI MALHADO", "WCR - Boi Malhado" e "WCR — Boi Malhado" são a mesma obra.
  const semPrefixo = (s: string) => normalizarTexto(s).replace(/^WCR\s*[—–-]\s*/, '').trim()
  return semPrefixo(obra) === semPrefixo(nomeProjeto)
}

// ─── a conferência ────────────────────────────────────────────────────────────

export function conferirCd(
  leitura: LeituraDeCaixa,
  matriz: Matriz,
  existentes: LancamentoCd[],
  ctx: ContextoCd,
  deduzirCategoria: (descricao: string) => string,
): ConferenciaCd {
  const ativos = existentes.filter((e) => !e.deleted_at)
  const excluidos = new Map(existentes.filter((e) => e.deleted_at).map((e) => [e.id, e]))
  const porId = new Map(ativos.map((e) => [e.id, e]))

  // O motor recebe as linhas com categoria neutra (a do ConstruData é comparada depois) e, sem a
  // coluna de solicitantes no banco, sem solicitantes (o texto ainda vai para a gravação).
  const paraMotor = leitura.lancamentos.map((l) => ({
    ...l,
    categoria: undefined,
    solicitantes: ctx.colunasDeImportacao ? l.solicitantes : [],
  }))

  const base = conferir(
    paraMotor,
    ativos.map((e) => linhaParaEntry(e, ctx.colunasDeImportacao)),
    leitura.problemas,
    ctx.projetoId,
    { obraId: ctx.projetoId, agora: ctx.agora, totaisDeclarados: leitura.totaisDeclarados },
  )

  const colunaConferido = acharCabecalho(matriz)?.mapa.conferido

  const linhas: LinhaCd[] = base.linhas.map((lc, i) => {
    const original = leitura.lancamentos[i]
    const cat = categoriaDaLinha(original, ctx.categorias, deduzirCategoria)
    const status = statusDaLinha(original, matriz, colunaConferido)
    const problemasCd: ProblemaCd[] = []

    if (!obraConfere(original.obra, ctx.nomeProjeto)) {
      problemasCd.push({
        mensagem: `A coluna OBRA diz "${original.obra}", mas a obra selecionada é "${ctx.nomeProjeto}". ` +
          'Troque a obra na tela ou separe as linhas desta obra em outro arquivo.',
        bloqueia: true,
      })
    }
    if (original.valor < 0) {
      problemasCd.push({ mensagem: 'Valor negativo — use a coluna certa (receita ou despesa).', bloqueia: true })
    }
    if (original.dataFim && original.dataFim < original.data) {
      problemasCd.push({ mensagem: 'Fim do período antes do início.', bloqueia: true })
    }
    if (original.valor > 100000) {
      problemasCd.push({ mensagem: 'Acima de R$ 100 mil — confira antes de confirmar.', bloqueia: false })
    }
    if (original.tipo === 'despesa' && original.solicitantes.length === 0) {
      problemasCd.push({ mensagem: 'Sem solicitante — a despesa entra, mas ninguém responde por ela.', bloqueia: false })
    }
    if (cat.nova && original.categoria) {
      problemasCd.push({ mensagem: `Categoria "${cat.nome}" não cadastrada — marque para cadastrar ou ela entra como "Outros".`, bloqueia: false })
    }

    // ⚠️ Excluído no sistema e de volta na planilha: o id é o mesmo (nasce do conteúdo), então
    // gravar ressuscitaria em silêncio o que alguém apagou de propósito.
    const apagado = excluidos.get(lc.id)
    if (apagado && lc.situacao === 'novo') {
      problemasCd.push({
        mensagem: 'Este lançamento foi excluído no sistema. Não será recriado — se a exclusão foi engano, restaure na tela.',
        bloqueia: true,
      })
    }

    // Refaz a comparação de categoria e status no modelo do ConstruData.
    let mudancas: MudancaDeCampo[] = lc.mudancas.filter((m) => m.campo !== 'categoria' && m.campo !== 'conferido')
    let situacao: Situacao = lc.situacao
    const existente = porId.get(lc.id)
    if (existente && (situacao === 'inalterado' || situacao === 'valor-alterado' || situacao === 'cadastro-alterado')) {
      if (normalizarTexto(existente.categoria_nome) !== normalizarTexto(cat.nome)) {
        mudancas = [...mudancas, { campo: 'categoria', rotulo: 'Categoria', antes: existente.categoria_nome, depois: cat.nome }]
      }
      if (existente.status !== status) {
        mudancas = [...mudancas, { campo: 'status', rotulo: 'Status', antes: existente.status, depois: status }]
      }
      situacao = mudancas.length === 0
        ? 'inalterado'
        : mudancas.some((m) => m.campo === 'valor') ? 'valor-alterado' : 'cadastro-alterado'
    }

    return {
      ...lc, lida: original, mudancas, situacao,
      categoriaNome: cat.nome, categoriaNova: cat.nova, status, problemasCd,
    }
  })

  const resumo: Record<Situacao, number> = {
    'novo': 0, 'valor-alterado': 0, 'cadastro-alterado': 0, 'inalterado': 0, 'duplicado': 0,
  }
  for (const l of linhas) resumo[l.situacao]++

  const totaisQueBateram: ConferenciaCd['totaisQueBateram'] = []
  const t = leitura.totaisDeclarados
  if (t) {
    const divergiu = new Set(base.divergenciaDeTotais.map((d) => d.oQue))
    if (t.receitas !== undefined && !divergiu.has('Receitas')) totaisQueBateram.push({ oQue: 'Receitas', valor: t.receitas })
    if (t.despesas !== undefined && !divergiu.has('Despesas')) totaisQueBateram.push({ oQue: 'Despesas', valor: t.despesas })
  }

  return { ...base, linhas, resumo, totaisQueBateram }
}

/** Grava só o que muda, e nunca linha com problema que bloqueia. */
export function linhasCdAGravar(c: ConferenciaCd): LinhaCd[] {
  const grava = new Set<Situacao>(SITUACOES_QUE_GRAVAM)
  return c.linhas.filter((l) => grava.has(l.situacao) && !l.problemasCd.some((p) => p.bloqueia))
}

/** O que vai para `caixa_lancamento` (categoria ainda pelo nome — o id é resolvido na gravação). */
export interface GravacaoCd {
  id: string
  tipo: 'RECEITA' | 'DESPESA'
  data_inicio: string
  data_fim: string | null
  descricao: string
  valor: number
  categoria_nome: string
  /** ⚠️ SEMPRE a obra selecionada. Vir da coluna OBRA gravava `null` e a linha sumia da tela. */
  projeto_id: string
  obra_texto: string
  status: StatusCd
  origem: 'planilha'
  chave_importacao: string
  solicitantes_texto: string[]
}

export function paraGravar(l: LinhaCd, ctx: Pick<ContextoCd, 'projetoId' | 'nomeProjeto'>): GravacaoCd {
  return {
    id: l.id,
    tipo: l.lida.tipo === 'receita' ? 'RECEITA' : 'DESPESA',
    data_inicio: l.lida.data,
    data_fim: l.lida.dataFim ?? null,
    descricao: l.lida.descricao,
    valor: l.lida.valor,
    categoria_nome: l.categoriaNome,
    projeto_id: ctx.projetoId,
    obra_texto: ctx.nomeProjeto,
    status: l.status,
    origem: 'planilha',
    chave_importacao: l.lida.chave,
    solicitantes_texto: l.lida.solicitantes,
  }
}
