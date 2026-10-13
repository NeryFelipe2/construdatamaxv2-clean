/**
 * gravarImportacao.ts — do que a pessoa CONFIRMOU na prévia para o banco.
 *
 *   planejarEscritas()      — puro: quais linhas viram escrita (NOVO/MUDOU marcados,
 *                             AUSENTE marcado vira só a marca ausente_na_planilha_em).
 *                             IGUAL, ERRO, CONFLITO e EXCLUIDO nunca escrevem.
 *   aplicarPlanoEmMemoria() — puro: aplica o plano num DadosOp em memória. Os testes
 *                             usam para provar que reimportar dá IGUAL e zero escritas.
 *   executarPlano()         — as chamadas ao Supabase, em lotes, na ordem das FKs,
 *                             com upsert na chave de identidade (idempotente: rodar
 *                             de novo não duplica). Recebe o cliente por parâmetro —
 *                             este arquivo não importa `@/lib/supabase`.
 *
 * NUNCA apaga. Não existe operação de delete aqui.
 * Salário só entra se quem importa é administrador (pessoa_remuneracao é fechada).
 */
import type { DadosOp, OpEquipeMembro, OpOcorrencia, OpPlanoItem, PessoaVencimento, TipoVencimento } from '../dominio/tipos'
import { normCabecalho } from '../dominio/normalizar'
import { semanaIso } from '../dominio/datas'
import {
  ORDEM_ENTIDADES, camposDaEntidade, chaveDaEntidade,
  type EntidadeOp, type LinhaRecon, type Registro, type ResultadoReconciliacao,
} from './reconciliar'

// ─── plano ──────────────────────────────────────────────────────────────────

export interface PassoEscrita {
  entidade: EntidadeOp
  /** NOVO e MUDOU marcados */
  gravar: LinhaRecon[]
  /** AUSENTE marcados (só recebem a marca) */
  apontarAusentes: LinhaRecon[]
}

export interface PlanoProjeto {
  projetoId: string
  projetoNome: string
  orgId: string | null
  passos: PassoEscrita[]
  servicoIds: Record<string, string>
  pessoaDaMatricula: Record<string, string>
}

export interface PlanoEscrita {
  projetos: PlanoProjeto[]
  ehAdmin: boolean
}

export function planejarEscritas(r: ResultadoReconciliacao): PlanoEscrita {
  return {
    ehAdmin: r.ehAdmin,
    projetos: r.projetos.map((p) => ({
      projetoId: p.projetoId, projetoNome: p.projetoNome, orgId: p.orgId,
      servicoIds: { ...p.servicoIds }, pessoaDaMatricula: { ...p.pessoaDaMatricula },
      passos: ORDEM_ENTIDADES
        .map((ent) => {
          const linhas = p.grupos.filter((g) => g.entidade === ent).flatMap((g) => g.linhas)
          return {
            entidade: ent,
            gravar: linhas.filter((l) => l.selecionada && (l.veredicto === 'NOVO' || l.veredicto === 'MUDOU')),
            apontarAusentes: linhas.filter((l) => l.selecionada && l.veredicto === 'AUSENTE' && !!l.idExistente),
          }
        })
        .filter((ps) => ps.gravar.length + ps.apontarAusentes.length > 0),
    })),
  }
}

export function contarEscritas(p: PlanoEscrita): { gravar: number; ausentes: number; total: number } {
  let gravar = 0, ausentes = 0
  for (const pr of p.projetos) for (const ps of pr.passos) { gravar += ps.gravar.length; ausentes += ps.apontarAusentes.length }
  return { gravar, ausentes, total: gravar + ausentes }
}

// ─── linha da prévia → colunas do banco ─────────────────────────────────────

function pick(dados: Registro, campos: string[]): Registro {
  const o: Registro = {}
  for (const c of campos) if (c in dados) o[c] = dados[c] ?? null
  return o
}

/** colunas de identidade gravadas junto com os campos comparados */
const CAMPOS_CHAVE: Partial<Record<EntidadeOp, string[]>> = {
  lista: ['nome', 'valor'],
  preco: ['chave'],
  servico: ['codigo'],
  programacao: ['data'],
  medicao: ['cod_preco', 'ordem'],
  lookahead: ['semana'],
  apontamento: ['data'],
  faturamento: ['mes'],
  ata: ['data', 'hora', 'assunto', 'ordem'],
  membro: ['matricula'],
  vencimento: ['tipo'],
}

const TABELA: Record<EntidadeOp, string> = {
  parametros: 'op_parametros', lista: 'op_lista', custo: 'op_custo_item', tributo: 'op_tributo', preco: 'op_preco',
  servico: 'op_servico', programacao: 'op_programacao', os: 'op_ordem_servico', medicao: 'op_medicao_item',
  lookahead: 'op_lookahead', apontamento: 'op_apontamento', faturamento: 'op_faturamento', ata: 'op_ata',
  membro: 'op_equipe_membro', vencimento: 'pessoa_vencimento', ocorrencia: 'op_ocorrencia_ext',
  plano: 'op_plano_item', pendente: 'op_importacao_pendente',
}

const ON_CONFLICT: Record<EntidadeOp, string> = {
  parametros: 'projeto_id', lista: 'projeto_id,nome,valor', custo: 'projeto_id,item_norm', tributo: 'projeto_id,nome_norm',
  preco: 'projeto_id,chave', servico: 'projeto_id,codigo', programacao: 'servico_id,data', os: 'servico_id',
  medicao: 'projeto_id,chave_import', lookahead: 'servico_id,semana', apontamento: 'projeto_id,data,equipe_norm',
  faturamento: 'projeto_id,mes', ata: 'projeto_id,chave_import', membro: 'projeto_id,matricula',
  vencimento: 'pessoa_id,tipo', ocorrencia: 'ocorrencia_id', plano: 'lps_task_id', pendente: 'projeto_id,aba,chave_import',
}

const PK: Record<EntidadeOp, string> = {
  parametros: 'projeto_id', lista: 'id', custo: 'id', tributo: 'id', preco: 'id', servico: 'id', programacao: 'id',
  os: 'id', medicao: 'id', lookahead: 'id', apontamento: 'id', faturamento: 'id', ata: 'id', membro: 'id',
  vencimento: 'id', ocorrencia: 'ocorrencia_id', plano: 'lps_task_id', pendente: 'id',
}

export function tabelaDaEntidade(e: EntidadeOp): string { return TABELA[e] }

/** colunas próprias da entidade (sem as de controle), com referências ainda por código */
export function colunasDaLinha(l: LinhaRecon): Registro {
  if (l.entidade === 'pendente') return { aba: l.dados.aba, linha: l.dados.linha ?? null, dados: l.dados.dados }
  // servico_codigo vira servico_id na gravação; salário mora em pessoa_remuneracao
  const campos = [...(CAMPOS_CHAVE[l.entidade] ?? []), ...camposDaEntidade(l.entidade)]
    .filter((c) => c !== 'servico_codigo' && c !== 'salario')
  return pick(l.dados, campos)
}

/** status da planilha → ocorrencias_obra.resolvida (encerrada = resolvida) */
export function ocorrenciaResolvida(status: unknown, dataEncerramento: unknown): boolean {
  const s = normCabecalho(status)
  return !!dataEncerramento || ['FEITO', 'FEITA', 'ENCERRADA', 'ENCERRADO', 'RESOLVIDA', 'RESOLVIDO', 'CONCLUIDA', 'CONCLUIDO', 'FECHADA'].includes(s)
}

function concluidaDoTexto(v: unknown): boolean | null {
  const s = normCabecalho(v)
  return s === 'SIM' ? true : s === 'NAO' ? false : null
}

// ─── em memória (testes e simulação) ────────────────────────────────────────

export function aplicarPlanoEmMemoria(plano: PlanoEscrita, existentes: Map<string, DadosOp>, agora = '2026-01-01T00:00:00Z'): Map<string, DadosOp> {
  const out = new Map<string, DadosOp>()
  for (const [k, v] of existentes) out.set(k, structuredClone(v))
  let seq = 0
  const novoId = (p: string) => `mem-${p}-${++seq}`

  for (const pr of plano.projetos) {
    const d = out.get(pr.projetoId)!
    const servicoId = (codigo: unknown) => {
      const k = normCabecalho(codigo)
      return d.servicos.find((x) => normCabecalho(x.codigo) === k)?.id ?? null
    }
    const pessoaId = (matricula: unknown) => d.membros.find((m) => normCabecalho(m.matricula) === normCabecalho(matricula))?.pessoa_id ?? null
    const controle = (l: LinhaRecon) => ({
      projeto_id: pr.projetoId, origem: 'planilha', chave_import: l.entidade === 'pendente' ? l.dados.chave_import : chaveDaEntidade(l.entidade, l.dados),
      ausente_na_planilha_em: null, deleted_at: null,
    })

    for (const ps of pr.passos) {
      for (const l of ps.gravar) {
        const cols = colunasDaLinha(l)
        const base = { ...cols, ...controle(l) } as Registro
        const upsert = <T extends { id: string }>(lista: T[], extra: Registro = {}) => {
          const alvo = l.idExistente ? lista.find((x) => x.id === l.idExistente) : undefined
          if (alvo) Object.assign(alvo, base, extra)
          else lista.push({ id: novoId(l.entidade), ...base, ...extra } as unknown as T)
        }
        switch (l.entidade) {
          case 'parametros':
            d.parametros = { ...(d.parametros ?? {}), ...base, id: pr.projetoId } as DadosOp['parametros']
            break
          case 'lista': upsert(d.listas); break
          case 'custo': upsert(d.custos); break
          case 'tributo': upsert(d.tributos); break
          case 'preco': upsert(d.precos); break
          case 'servico': upsert(d.servicos); break
          case 'programacao': upsert(d.programacoes, { servico_id: servicoId(l.dados.servico_codigo) }); break
          case 'os': upsert(d.ordens, { servico_id: servicoId(l.dados.servico_codigo) }); break
          case 'medicao': upsert(d.medicoes, { servico_id: servicoId(l.dados.servico_codigo) }); break
          case 'lookahead': upsert(d.lookaheads, { servico_id: servicoId(l.dados.servico_codigo) }); break
          case 'apontamento': upsert(d.apontamentos); break
          case 'faturamento': upsert(d.faturamentos); break
          case 'ata': upsert(d.atas); break
          case 'membro': {
            const extra: Registro = {
              pessoa_id: (l.dados.pessoa_id as string) ?? pessoaId(l.dados.matricula) ?? novoId('pessoa'),
              pessoa_nome: l.dados.nome,
            }
            if (plano.ehAdmin) extra.salario = l.dados.salario ?? null
            upsert<OpEquipeMembro>(d.membros, extra)
            break
          }
          case 'vencimento': upsert<PessoaVencimento>(d.vencimentos, { pessoa_id: pessoaId(l.dados.matricula), tipo: l.dados.tipo as TipoVencimento }); break
          case 'ocorrencia': upsert<OpOcorrencia>(d.ocorrencias, {
            data: l.dados.data, servico_id: l.dados.servico_codigo ? servicoId(l.dados.servico_codigo) : null, tem_ext: true,
            resolvida: ocorrenciaResolvida(l.dados.status, l.dados.data_encerramento), resolvido_em: null,
          }); break
          case 'plano': upsert<OpPlanoItem>(d.plano, {
            op_servico_id: servicoId(l.dados.servico_codigo), semana: l.dados.semana, semana_iso: semanaIso(String(l.dados.semana)),
          }); break
          case 'pendente': upsert(d.pendentes, { dados: l.dados.dados, aba: l.dados.aba, linha: l.dados.linha }); break
        }
      }
      for (const l of ps.apontarAusentes) {
        const colecao: Record<EntidadeOp, { id: string; ausente_na_planilha_em?: string | null }[] | null> = {
          parametros: null, lista: d.listas, custo: d.custos, tributo: d.tributos, preco: d.precos, servico: d.servicos,
          programacao: d.programacoes, os: d.ordens, medicao: d.medicoes, lookahead: d.lookaheads, apontamento: d.apontamentos,
          faturamento: d.faturamentos, ata: d.atas, membro: d.membros, vencimento: d.vencimentos, ocorrencia: d.ocorrencias,
          plano: d.plano, pendente: d.pendentes,
        }
        const alvo = colecao[l.entidade]?.find((x) => x.id === l.idExistente)
        if (alvo) alvo.ausente_na_planilha_em = agora
      }
    }
  }
  return out
}

// ─── execução no Supabase ───────────────────────────────────────────────────

/** o mínimo do cliente Supabase que este arquivo usa (injetado — sem import de @/lib/supabase) */
export interface ClienteBanco {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (tabela: string) => any
}

export interface MetaImportacao {
  arquivo: string
  sha256: string | null
  resumoPorProjeto: Record<string, Record<string, unknown>>
}

export interface ResultadoGravacao {
  gravadas: number
  ausentesApontados: number
  pessoasCriadas: number
  erros: string[]
}

const LOTE = 400

function lotes<T>(xs: T[], n = LOTE): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

function uuid(): string {
  return globalThis.crypto.randomUUID()
}

export async function executarPlano(
  cliente: ClienteBanco,
  plano: PlanoEscrita,
  meta: MetaImportacao,
  aoProgredir?: (texto: string) => void,
): Promise<ResultadoGravacao> {
  const res: ResultadoGravacao = { gravadas: 0, ausentesApontados: 0, pessoasCriadas: 0, erros: [] }
  const agora = new Date().toISOString()   // timestamptz: instante, não data civil

  for (const pr of plano.projetos) {
    const erro = (onde: string, e: { message?: string } | null | undefined) => {
      if (e) res.erros.push(`${pr.projetoNome} · ${onde}: ${e.message ?? String(e)}`)
      return !!e
    }

    // histórico da importação (uma linha por obra)
    aoProgredir?.(`${pr.projetoNome}: registrando a importação…`)
    const { data: imp, error: eImp } = await cliente.from('op_importacao')
      .insert({ projeto_id: pr.projetoId, arquivo: meta.arquivo, sha256: meta.sha256, modelo: 'rev16', resumo: meta.resumoPorProjeto[pr.projetoId] ?? {} })
      .select('id').single()
    if (erro('histórico', eImp)) continue
    const importacaoId = imp.id as string

    const servicoIds = { ...pr.servicoIds }
    const pessoaDaMatricula = { ...pr.pessoaDaMatricula }
    const controle = (l: LinhaRecon): Registro => ({
      projeto_id: pr.projetoId, origem: 'planilha', importacao_id: importacaoId, ausente_na_planilha_em: null,
      chave_import: l.entidade === 'pendente' ? l.dados.chave_import : chaveDaEntidade(l.entidade, l.dados),
    })
    const idServico = (codigo: unknown) => servicoIds[normCabecalho(codigo)] ?? null

    for (const ps of pr.passos) {
      aoProgredir?.(`${pr.projetoNome}: ${ps.entidade} (${ps.gravar.length})…`)
      const tabela = TABELA[ps.entidade]

      if (ps.gravar.length) {
        switch (ps.entidade) {
          case 'membro': {
            for (const l of ps.gravar) {
              let pessoa = (l.dados.pessoa_id as string | null) ?? pessoaDaMatricula[normCabecalho(l.dados.matricula)] ?? null
              if (!pessoa) {
                const ativo = l.dados.ativo
                const { data: p, error } = await cliente.from('pessoas').insert({
                  org_id: pr.orgId, nome_completo: l.dados.nome, cargo_texto: l.dados.funcao ?? null,
                  data_admissao: l.dados.admissao ?? null, origem: 'controle_operacional', revisar: true,
                  status: ativo === true ? 'ativo' : ativo === false ? 'desligado' : 'desconhecido',
                }).select('id').single()
                if (erro(`pessoa ${l.dados.matricula}`, error)) continue
                pessoa = p.id as string
                res.pessoasCriadas++
              }
              pessoaDaMatricula[normCabecalho(l.dados.matricula)] = pessoa
              const { error } = await cliente.from(tabela)
                .upsert({ ...colunasDaLinha(l), ...controle(l), pessoa_id: pessoa }, { onConflict: ON_CONFLICT.membro })
              if (erro(`membro ${l.dados.matricula}`, error)) continue
              res.gravadas++
              if (plano.ehAdmin && 'salario' in l.dados) {
                const { error: eSal } = await cliente.from('pessoa_remuneracao')
                  .upsert({ pessoa_id: pessoa, salario_bruto: l.dados.salario ?? null }, { onConflict: 'pessoa_id' })
                erro(`salário ${l.dados.matricula}`, eSal)
              }
            }
            break
          }
          case 'vencimento': {
            const linhas = ps.gravar.flatMap((l) => {
              const pessoa = pessoaDaMatricula[normCabecalho(l.dados.matricula)]
              if (!pessoa) { res.erros.push(`${pr.projetoNome} · vencimento ${l.dados.matricula}/${l.dados.tipo}: pessoa não gravada`); return [] }
              const { projeto_id: _p, ...ctrl } = controle(l)
              return [{ ...colunasDaLinha(l), ...ctrl, pessoa_id: pessoa }]
            })
            for (const lote of lotes(linhas)) {
              const { error } = await cliente.from(tabela).upsert(lote, { onConflict: ON_CONFLICT.vencimento })
              if (!erro('vencimentos', error)) res.gravadas += lote.length
            }
            break
          }
          case 'ocorrencia': {
            for (const l of ps.gravar) {
              const id = l.idExistente ?? uuid()
              const baseOc: Registro = {
                projeto_id: pr.projetoId, data: l.dados.data, tipo: l.dados.tipo, descricao: l.dados.descricao,
                resolvida: ocorrenciaResolvida(l.dados.status, l.dados.data_encerramento),
                // meio-dia de Brasília: a data civil não "volta um dia" em nenhum fuso do Brasil
                resolvido_em: l.dados.data_encerramento ? `${l.dados.data_encerramento}T12:00:00-03:00` : null,
              }
              if (pr.orgId) baseOc.org_id = pr.orgId
              const q = l.idExistente
                ? cliente.from('ocorrencias_obra').update(baseOc).eq('id', id)
                : cliente.from('ocorrencias_obra').insert({ id, ...baseOc, origem: 'controle_operacional', origem_fonte: `${meta.arquivo} — aba 11, linha ${l.linha}` })
              const { error } = await q
              if (erro(`ocorrência ${l.rotulo}`, error)) continue
              const { error: eExt } = await cliente.from(tabela).upsert({
                ...pick(l.dados, ['equipe', 'gravidade', 'impacto_h', 'custo_estimado', 'acao', 'responsavel', 'prazo', 'status', 'data_encerramento', 'gera_pleito']),
                ...controle(l), ocorrencia_id: id, servico_id: l.dados.servico_codigo ? idServico(l.dados.servico_codigo) : null,
              }, { onConflict: ON_CONFLICT.ocorrencia })
              if (!erro(`ocorrência ${l.rotulo} (extensão)`, eExt)) res.gravadas++
            }
            break
          }
          case 'plano': {
            for (const l of ps.gravar) {
              const servico = idServico(l.dados.servico_codigo)
              if (!servico) { res.erros.push(`${pr.projetoNome} · plano ${l.rotulo}: serviço não gravado`); continue }
              const id = l.idExistente ?? uuid()
              const baseTask: Registro = {
                project_id: pr.projetoId, semana_iso: semanaIso(String(l.dados.semana)),
                task_name: (l.dados.compromisso as string) || `${l.dados.servico_codigo}`,
                responsavel: l.dados.equipe ?? null, comprometida: true,
                concluida: concluidaDoTexto(l.dados.concluido),
                motivo_nao_conclusao: l.dados.causa_nc ?? null,
              }
              if (pr.orgId) baseTask.org_id = pr.orgId
              const q = l.idExistente
                ? cliente.from('lps_tasks').update(baseTask).eq('id', id)
                : cliente.from('lps_tasks').insert({ id, ...baseTask })
              const { error } = await q
              if (erro(`plano ${l.rotulo}`, error)) continue
              const { error: eExt } = await cliente.from(tabela).upsert({
                ...pick(l.dados, ['semana', 'data_conclusao', 'reprogramado_para', 'observacao']),
                ...controle(l), lps_task_id: id, op_servico_id: servico,
              }, { onConflict: ON_CONFLICT.plano })
              if (!erro(`plano ${l.rotulo} (extensão)`, eExt)) res.gravadas++
            }
            break
          }
          default: {
            const precisaServico = ['programacao', 'os', 'medicao', 'lookahead'].includes(ps.entidade)
            const linhas = ps.gravar.flatMap((l) => {
              const row: Registro = { ...colunasDaLinha(l), ...controle(l) }
              if (precisaServico) {
                const sid = idServico(l.dados.servico_codigo)
                if (!sid) { res.erros.push(`${pr.projetoNome} · ${l.rotulo}: serviço ${l.dados.servico_codigo} não gravado`); return [] }
                row.servico_id = sid
              }
              return [row]
            })
            for (const lote of lotes(linhas)) {
              const sel = ps.entidade === 'servico' ? 'id,codigo' : PK[ps.entidade]
              const { data, error } = await cliente.from(tabela).upsert(lote, { onConflict: ON_CONFLICT[ps.entidade] }).select(sel)
              if (erro(`${ps.entidade} (${lote.length} linhas)`, error)) continue
              res.gravadas += lote.length
              if (ps.entidade === 'servico') for (const r of (data ?? []) as { id: string; codigo: string }[]) servicoIds[normCabecalho(r.codigo)] = r.id
            }
          }
        }
      }

      // AUSENTE: só a marca. Nunca delete.
      const ids = ps.apontarAusentes.map((l) => l.idExistente!).filter(Boolean)
      for (const lote of lotes(ids, 200)) {
        const { error } = await cliente.from(tabela).update({ ausente_na_planilha_em: agora }).in(PK[ps.entidade], lote)
        if (!erro(`marcar ausentes (${ps.entidade})`, error)) res.ausentesApontados += lote.length
      }
    }
  }
  return res
}
