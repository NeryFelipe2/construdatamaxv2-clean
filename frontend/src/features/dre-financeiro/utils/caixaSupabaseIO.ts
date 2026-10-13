/**
 * caixaSupabaseIO.ts — leitura e gravação do Controle de Caixa importado por planilha.
 *
 * A conferência (o que muda) é pura e vive em caixaCd.ts; aqui só se fala com o banco.
 *
 * ⚠️ Três decisões que parecem detalhe e não são:
 *
 * 1. Os existentes são carregados do PROJETO INTEIRO, não do mês da tela. O importador antigo
 *    comparava só com o mês visível e importar outro mês recriava tudo.
 * 2. O id do lançamento nasce do conteúdo (`seededId`, via motor) e a gravação é UPSERT por id.
 *    É isso que impede duplicar mesmo antes da migration 033 e com dois cliques seguidos.
 * 3. Todas as linhas de um upsert levam O MESMO conjunto de colunas: o PostgREST preenche as
 *    ausentes com nulo, e isso apagaria `conferido_por` de quem já tinha conferido.
 */
import { supabase } from '@/lib/supabase'
import { seededId } from '@/lib/seededId'
import { casarPessoa, type PessoaBase } from '@/features/rdo/utils/casarPessoaPresenca'
import type { CategoriaCd, GravacaoCd, LancamentoCd, StatusCd } from './caixaCd'
import type { HoraExtraLida } from './controleDeCaixaPlanilha'
import { normalizarTexto } from './controleDeCaixaPlanilha'

const COLUNAS_BASE =
  'id, tipo, data_inicio, data_fim, descricao, valor, categoria_id, projeto_id, status, origem, ' +
  'conferido_por, conferido_em, created_at, deleted_at'
const COLUNAS_033 = ', chave_importacao, solicitantes_texto'

type Erro = { code?: string; message?: string } | null

/** A migration 033 ainda não foi colada (coluna inexistente). */
function colunaAusente(e: Erro): boolean {
  if (!e) return false
  const m = (e.message ?? '').toLowerCase()
  return e.code === '42703' || e.code === 'PGRST204' || (m.includes('column') && (m.includes('does not exist') || m.includes('could not find')))
}

export interface ExistenteCd extends LancamentoCd {
  conferido_por: string | null
  conferido_em: string | null
}

export async function carregarExistentesDoProjeto(
  projetoId: string,
  categorias: CategoriaCd[],
): Promise<{ linhas: ExistenteCd[]; colunasDeImportacao: boolean }> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const nomeCat = new Map(categorias.map((c) => [c.id, c.nome]))

  const buscar = async (colunas: string) => {
    const todas: Record<string, unknown>[] = []
    // PostgREST devolve no máximo 1000 por vez — sem paginar, o 1001º lançamento "não existe".
    for (let de = 0; ; de += 1000) {
      const { data, error } = await supabase!.from('caixa_lancamento')
        .select(colunas).eq('projeto_id', projetoId).order('id').range(de, de + 999)
      if (error) return { erro: error as Erro, todas }
      todas.push(...((data ?? []) as unknown as Record<string, unknown>[]))
      if (!data || data.length < 1000) break
    }
    return { erro: null as Erro, todas }
  }

  let colunasDeImportacao = true
  let r = await buscar(COLUNAS_BASE + COLUNAS_033)
  if (r.erro && colunaAusente(r.erro)) {
    colunasDeImportacao = false
    r = await buscar(COLUNAS_BASE)
  }
  if (r.erro) throw new Error(r.erro.message ?? 'Erro ao carregar lançamentos.')

  const linhas = r.todas.map((x) => ({
    id: String(x.id),
    tipo: x.tipo as 'RECEITA' | 'DESPESA',
    data_inicio: String(x.data_inicio),
    data_fim: (x.data_fim as string | null) ?? null,
    descricao: String(x.descricao ?? ''),
    valor: Number(x.valor),
    categoria_nome: nomeCat.get(String(x.categoria_id)) ?? '',
    projeto_id: (x.projeto_id as string | null) ?? null,
    status: x.status as StatusCd,
    origem: String(x.origem ?? ''),
    created_at: (x.created_at as string | null) ?? null,
    deleted_at: (x.deleted_at as string | null) ?? null,
    chave_importacao: (x.chave_importacao as string | null | undefined) ?? null,
    solicitantes_texto: (x.solicitantes_texto as string[] | null | undefined) ?? null,
    conferido_por: (x.conferido_por as string | null) ?? null,
    conferido_em: (x.conferido_em as string | null) ?? null,
  }))
  return { linhas, colunasDeImportacao }
}

export async function carregarPessoas(): Promise<PessoaBase[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('pessoas')
    .select('id, nome_completo, apelido').is('deleted_at', null)
  if (error) return []
  return (data ?? []) as PessoaBase[]
}

/** Só casa o que não é ambíguo — solicitante errado é pior do que solicitante em branco. */
export function pessoaDoNome(nome: string, pessoas: PessoaBase[]): PessoaBase | null {
  const r = casarPessoa(nome, pessoas)
  return r.status === 'resolvido' ? r.pessoa : null
}

export async function criarCategoria(nome: string, tipo: 'RECEITA' | 'DESPESA' | 'AMBOS'): Promise<string> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase.from('caixa_categoria')
    .insert({ nome, tipo, ordem: 99 }).select('id').single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

export interface ResultadoGravacao {
  gravados: number
  erros: string[]
  solicitantesSemCadastro: string[]
}

export async function gravarLancamentos(
  itens: Array<{ g: GravacaoCd; existente?: ExistenteCd }>,
  ctx: {
    categoriaId: (nome: string) => string | null
    lote: string
    userId: string | null
    agora: string
    colunasDeImportacao: boolean
    pessoas: PessoaBase[]
  },
): Promise<ResultadoGravacao> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const erros: string[] = []
  const semCadastro = new Set<string>()

  const linhas = itens.flatMap(({ g, existente }) => {
    const categoria_id = ctx.categoriaId(g.categoria_nome)
    if (!categoria_id) { erros.push(`${g.descricao}: categoria "${g.categoria_nome}" sem cadastro`); return [] }
    // Quem conferiu: mantém o que já estava se o status não mudou; carimba agora se passou a
    // conferido/pago; limpa se voltou a pendente.
    const mesmoStatus = existente && existente.status === g.status
    const conferido_por = g.status === 'pendente' ? null : mesmoStatus ? existente.conferido_por : ctx.userId
    const conferido_em = g.status === 'pendente' ? null : mesmoStatus ? existente.conferido_em : ctx.agora
    return [{
      id: g.id, tipo: g.tipo, data_inicio: g.data_inicio, data_fim: g.data_fim,
      descricao: g.descricao, valor: g.valor, categoria_id, projeto_id: g.projeto_id,
      obra_texto: g.obra_texto, status: g.status, origem: g.origem, import_lote: ctx.lote,
      conferido_por, conferido_em,
      ...(ctx.colunasDeImportacao
        ? { chave_importacao: g.chave_importacao, solicitantes_texto: g.solicitantes_texto }
        : {}),
    }]
  })

  let gravados = 0
  for (let i = 0; i < linhas.length; i += 200) {
    const lote = linhas.slice(i, i + 200)
    const { error } = await supabase.from('caixa_lancamento').upsert(lote, { onConflict: 'id' })
    if (error) erros.push(`lançamentos ${i + 1}–${i + lote.length}: ${error.message}`)
    else gravados += lote.length
  }

  // Solicitantes → pessoas. O texto cru fica em `solicitantes_texto` (033); o vínculo só com casamento seguro.
  const vinculos: Array<{ lancamento_id: string; pessoa_id: string }> = []
  for (const { g } of itens) {
    for (const nome of g.solicitantes_texto) {
      const p = pessoaDoNome(nome, ctx.pessoas)
      if (p) vinculos.push({ lancamento_id: g.id, pessoa_id: p.id })
      else semCadastro.add(nome)
    }
  }
  if (vinculos.length > 0) {
    const { error } = await supabase.from('caixa_lancamento_solicitante')
      .upsert(vinculos, { onConflict: 'lancamento_id,pessoa_id', ignoreDuplicates: true })
    if (error) erros.push(`solicitantes: ${error.message}`)
  }

  return { gravados, erros, solicitantesSemCadastro: [...semCadastro].sort() }
}

export interface ResultadoHorasExtras {
  gravadas: number
  viraramDespesa: number
  semCadastro: string[]
  erros: string[]
}

/**
 * A grade de horas extras vai para `horas_extras` (uma por pessoa/dia). A marcada como paga
 * vira também despesa no caixa — com id determinístico, e sem reescrever a que já existe.
 */
export async function gravarHorasExtras(
  registros: HoraExtraLida[],
  ctx: {
    projetoId: string
    nomeProjeto: string
    pessoas: PessoaBase[]
    categoriaHoraExtraId: string | null
    lote: string
    userId: string | null
    agora: string
  },
): Promise<ResultadoHorasExtras> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const erros: string[] = []
  const semCadastro = new Set<string>()

  const itens = registros.flatMap((r) => {
    const p = pessoaDoNome(r.nome, ctx.pessoas)
    if (!p) { semCadastro.add(r.nome); return [] }
    return [{ r, pessoa: p }]
  })

  const despesas = itens.filter(({ r }) => r.pago).map(({ r }) => ({
    id: seededId(ctx.projetoId, 'caixa-hora-extra', r.chave),
    tipo: 'DESPESA', data_inicio: r.data, data_fim: null,
    descricao: `Hora extra — ${r.nome}`, valor: r.valor,
    categoria_id: ctx.categoriaHoraExtraId, projeto_id: ctx.projetoId, obra_texto: ctx.nomeProjeto,
    status: 'pago', origem: 'horas-extras', import_lote: ctx.lote,
    conferido_por: ctx.userId, conferido_em: ctx.agora,
  }))
  let viraramDespesa = 0
  if (despesas.length > 0) {
    if (!ctx.categoriaHoraExtraId) {
      erros.push('Categoria "Hora extra" não cadastrada — as horas extras pagas não viraram despesa.')
    } else {
      const { error } = await supabase.from('caixa_lancamento')
        .upsert(despesas, { onConflict: 'id', ignoreDuplicates: true })
      if (error) erros.push(`despesas de hora extra: ${error.message}`)
      else viraramDespesa = despesas.length
    }
  }

  const despesaOk = viraramDespesa > 0
  const linhas = itens.map(({ r, pessoa }) => ({
    pessoa_id: pessoa.id, data: r.data, valor: r.valor,
    status: r.pago ? 'PG' : 'pendente',
    projeto_id: ctx.projetoId, obra_texto: ctx.nomeProjeto,
    lancamento_id: r.pago && despesaOk ? seededId(ctx.projetoId, 'caixa-hora-extra', r.chave) : null,
  }))
  let gravadas = 0
  for (let i = 0; i < linhas.length; i += 200) {
    const lote = linhas.slice(i, i + 200)
    const { error } = await supabase.from('horas_extras').upsert(lote, { onConflict: 'pessoa_id,data' })
    if (error) erros.push(`horas extras ${i + 1}–${i + lote.length}: ${error.message}`)
    else gravadas += lote.length
  }

  return { gravadas, viraramDespesa, semCadastro: [...semCadastro].sort(), erros }
}

/** "Hora extra" pelo nome, tolerando acento e caixa. */
export function idDaCategoria(categorias: CategoriaCd[], nome: string): string | null {
  return categorias.find((c) => normalizarTexto(c.nome) === normalizarTexto(nome))?.id ?? null
}
