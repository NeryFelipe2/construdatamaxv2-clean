/**
 * reconciliar.ts — a PRÉVIA da importação: "o que esta planilha muda no sistema?"
 *
 * Usa o motor `calcularDiff` (NOVO / IGUAL / DIFERENTE / ERRO) do importador do DRE
 * e acrescenta três veredictos que a planilha operacional exige:
 *
 *   AUSENTE   — está no sistema (veio de planilha antes) e não veio agora. NUNCA apaga:
 *               só aponta, e só DENTRO DO ESCOPO do arquivo (obra × aba × faixa de datas
 *               que o arquivo cobre). Um arquivo de setembro não acusa agosto de sumido.
 *   CONFLITO  — mesmo código de serviço com data de solicitação / endereço / nº diferentes.
 *               O ID da rev16 sai da POSIÇÃO da linha (ROW()−4): linha inserida no meio
 *               desloca todos os IDs. Gravar "por cima" trocaria o endereço de um serviço
 *               já executado. Bloqueia — e bloqueia também o que depende dele (OS, medição…).
 *   EXCLUIDO  — excluído no sistema; a planilha trouxe de novo. Não ressuscita.
 *
 * Nada aqui escreve. O resultado vai para a tela; o que a pessoa confirmar vai para
 * gravarImportacao.ts.
 */
import {
  calcularDiff, mesmoValor, norm, type CampoAlterado, type Problema,
} from '@/features/dre-financeiro/components/importador/diff'
import type { DadosOp } from '../dominio/tipos'
import { TIPOS_VENCIMENTO } from '../dominio/tipos'
import { normCabecalho, normChave } from '../dominio/normalizar'
import { faixaDeDatas } from '../dominio/datas'
import type { LeituraRev16, LinhaLida, NaoEntendida } from './lerPlanilhaRev16'

// ─── tipos ──────────────────────────────────────────────────────────────────

export type VeredictoOp = 'NOVO' | 'MUDOU' | 'IGUAL' | 'ERRO' | 'AUSENTE' | 'CONFLITO' | 'EXCLUIDO'
export const VEREDICTOS: VeredictoOp[] = ['NOVO', 'MUDOU', 'IGUAL', 'ERRO', 'AUSENTE', 'CONFLITO', 'EXCLUIDO']

export type EntidadeOp =
  | 'parametros' | 'lista' | 'custo' | 'tributo' | 'preco' | 'servico' | 'programacao' | 'os'
  | 'medicao' | 'lookahead' | 'apontamento' | 'faturamento' | 'ata' | 'membro' | 'vencimento'
  | 'ocorrencia' | 'plano' | 'pendente'

/** ordem das FKs: quem é referenciado vem antes */
export const ORDEM_ENTIDADES: EntidadeOp[] = [
  'parametros', 'lista', 'custo', 'tributo', 'preco', 'servico', 'programacao', 'os', 'medicao',
  'lookahead', 'apontamento', 'faturamento', 'ata', 'membro', 'vencimento', 'ocorrencia', 'plano', 'pendente',
]

export type Registro = Record<string, unknown>

export interface LinhaRecon {
  entidade: EntidadeOp
  /** linha da planilha; 0 = não está no arquivo (AUSENTE) */
  linha: number
  veredicto: VeredictoOp
  chave: string
  rotulo: string
  /** formato do banco, com referências por CÓDIGO (servico_codigo, matricula) */
  dados: Registro
  idExistente?: string
  alteracoes: CampoAlterado[]
  problemas: Problema[]
  selecionada: boolean
}

export interface GrupoRecon {
  entidade: EntidadeOp
  rotulo: string
  aba: string
  linhas: LinhaRecon[]
  resumo: Record<VeredictoOp, number>
  /** como o AUSENTE foi delimitado, em português */
  escopo: string
  avisos: string[]
}

export interface ReconProjeto {
  projetoId: string
  projetoNome: string
  orgId: string | null
  contrato: string
  grupos: GrupoRecon[]
  /** código → id dos serviços que JÁ existem (vivos e excluídos) */
  servicoIds: Record<string, string>
  /** matrícula → pessoa_id dos membros que JÁ existem */
  pessoaDaMatricula: Record<string, string>
}

export interface ResultadoReconciliacao {
  projetos: ReconProjeto[]
  naoEntendidas: NaoEntendida[]
  contratosSemProjeto: string[]
  avisos: string[]
  ehAdmin: boolean
}

export interface ProjetoRef { id: string; nome: string; org_id: string | null }
export interface PessoaRef { id: string; nome_completo: string; org_id: string | null }

export interface EntradaReconciliacao {
  leitura: LeituraRev16
  projetos: ProjetoRef[]
  /** o que já está no banco, POR OBRA, incluindo linhas excluídas (deleted_at) */
  existentes: Map<string, DadosOp>
  /** pessoas das empresas envolvidas — para casar o nome da aba 08 */
  pessoas: PessoaRef[]
  ehAdmin: boolean
}

// ─── casar CONTRATO → obra ──────────────────────────────────────────────────

/** "BERTIOGA" casa com a obra "WCR — Bertioga" (mesma regra do ImportarCaixaModal) */
export function projetoDoContrato(contrato: string | null | undefined, projetos: ProjetoRef[]): ProjetoRef | null {
  const alvo = norm(contrato)
  if (!alvo) return null
  return projetos.find((p) => norm(p.nome) === alvo || norm(p.nome) === norm(`WCR — ${contrato}`)) ?? null
}

// ─── configuração por entidade ──────────────────────────────────────────────

interface ConfigEntidade {
  entidade: EntidadeOp
  rotulo: string
  aba: string
  campos: string[]
  chave: (r: Registro) => string
  rotuloLinha: (r: Registro) => string
  /** data que delimita o escopo do AUSENTE (sem isto: obra × aba inteira) */
  data?: (r: Registro) => string | null
  /** campos de identidade: divergência = CONFLITO, não MUDOU */
  identidade?: { campo: string; rotulo: string }[]
}

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))

const CFG: Record<EntidadeOp, ConfigEntidade> = {
  parametros: {
    entidade: 'parametros', rotulo: 'Parâmetros do contrato', aba: '01',
    campos: ['contrato_nome', 'contrato_descricao', 'prefixo', 'empresa', 'responsavel', 'coordenador',
      'inicio_operacao', 'mes_referencia', 'desconto_consorcio', 'dia_fechamento', 'defasagem_recebimento',
      'dias_uteis_mes', 'jornada_h', 'prazo_padrao_dias', 'alerta_prazo_dias', 'margem_alvo',
      'fator_encargos', 'beneficios_pessoa'],
    chave: () => 'parametros', rotuloLinha: (r) => `Parâmetros — ${s(r.contrato_nome)}`,
  },
  lista: {
    entidade: 'lista', rotulo: 'Listas (menus)', aba: '01', campos: ['ordem'],
    chave: (r) => `${s(r.nome)}|${normChave(r.valor)}`, rotuloLinha: (r) => `${s(r.nome)}: ${s(r.valor)}`,
  },
  custo: {
    entidade: 'custo', rotulo: 'Banco de custos', aba: '01A', campos: ['item', 'qtd', 'valor_unit', 'fonte', 'ordem'],
    chave: (r) => normChave(r.item), rotuloLinha: (r) => s(r.item),
  },
  tributo: {
    entidade: 'tributo', rotulo: 'Tributos', aba: '01A', campos: ['nome', 'aliquota', 'memoria', 'fonte', 'ordem'],
    chave: (r) => normChave(r.nome), rotuloLinha: (r) => s(r.nome),
  },
  preco: {
    entidade: 'preco', rotulo: 'Tabela de preços', aba: '02',
    campos: ['contrato', 'grupo', 'item_sabesp', 'descricao', 'n_preco', 'un', 'preco'],
    chave: (r) => normCabecalho(r.chave), rotuloLinha: (r) => `${s(r.chave)} — ${s(r.descricao).slice(0, 50)}`,
  },
  servico: {
    entidade: 'servico', rotulo: 'Serviços', aba: '03',
    campos: ['n_os_sabesp', 'data_solicitacao', 'prazo_dias', 'prioridade', 'tipo', 'endereco', 'numero',
      'bairro', 'cidade', 'referencia', 'pavimento', 'descricao', 'tratativa_manual', 'observacao', 'data_execucao_digitada'],
    chave: (r) => normCabecalho(r.codigo), rotuloLinha: (r) => `${s(r.codigo)} — ${s(r.endereco)}${r.numero ? `, ${s(r.numero)}` : ''}`,
    data: (r) => (r.data_solicitacao as string) ?? null,
    identidade: [
      { campo: 'data_solicitacao', rotulo: 'data da solicitação' },
      { campo: 'endereco', rotulo: 'endereço' },
      { campo: 'numero', rotulo: 'nº' },
    ],
  },
  programacao: {
    entidade: 'programacao', rotulo: 'Programação diária', aba: '04',
    campos: ['equipe', 'seq', 'h_previstas', 'executou', 'data_execucao', 'motivo_nao_execucao', 'reprogramar_para', 'observacao'],
    chave: (r) => `${normCabecalho(r.servico_codigo)}|${s(r.data)}`, rotuloLinha: (r) => `${s(r.data)} · ${s(r.servico_codigo)}`,
    data: (r) => (r.data as string) ?? null,
  },
  os: {
    entidade: 'os', rotulo: 'Ordens de serviço', aba: '05',
    campos: ['equipe', 'encarregado', 'data_inicio', 'data_conclusao', 'profundidade_m', 'extensao_m',
      'pavimento_reposto', 'foto_antes', 'foto_depois', 'n_rdo', 'pendencia'],
    chave: (r) => normCabecalho(r.servico_codigo), rotuloLinha: (r) => `OS ${s(r.servico_codigo)}`,
    data: (r) => ((r.data_conclusao ?? r.data_inicio) as string) ?? null,
  },
  medicao: {
    entidade: 'medicao', rotulo: 'Medição', aba: '09',
    campos: ['n_boletim', 'qtd', 'status', 'data_apresentacao', 'valor_glosado', 'motivo_glosa', 'reapresentar', 'observacao', 'data_execucao_digitada'],
    chave: (r) => `${normCabecalho(r.servico_codigo)}|${normCabecalho(r.cod_preco)}|${s(r.ordem)}`,
    rotuloLinha: (r) => `${s(r.servico_codigo)} · ${s(r.cod_preco)}${Number(r.ordem) > 1 ? ` (${s(r.ordem)}º)` : ''}`,
  },
  lookahead: {
    entidade: 'lookahead', rotulo: 'Lookahead', aba: '16',
    campos: ['material_ok', 'equipamento_ok', 'mao_de_obra_ok', 'os_emitida', 'licenca_ok', 'acesso_ok', 'responsavel', 'prazo'],
    chave: (r) => `${normCabecalho(r.servico_codigo)}|${s(r.semana)}`, rotuloLinha: (r) => `${s(r.semana)} · ${s(r.servico_codigo)}`,
    data: (r) => (r.semana as string) ?? null,
  },
  apontamento: {
    entidade: 'apontamento', rotulo: 'Apontamento diário', aba: '06',
    campos: ['equipe', 'n_pessoas', 'h_normais', 'h_extras', 'retro_h', 'cam34_munck_h', 'caminhao_hr_h',
      'compressor_h', 'rompedor_h', 'bomba_h', 'km_rodado', 'status_dia', 'motivo_parada', 'observacao'],
    chave: (r) => `${s(r.data)}|${normCabecalho(r.equipe)}`, rotuloLinha: (r) => `${s(r.data)} · ${s(r.equipe) || 'equipe em branco'}`,
    data: (r) => (r.data as string) ?? null,
  },
  faturamento: {
    entidade: 'faturamento', rotulo: 'Faturamento', aba: '12',
    campos: ['n_nf', 'data_nf', 'data_recebimento', 'valor_recebido'],
    chave: (r) => s(r.mes), rotuloLinha: (r) => `mês ${s(r.mes).slice(0, 7)}`,
    data: (r) => (r.mes as string) ?? null,
  },
  ata: {
    entidade: 'ata', rotulo: 'Atas (5W2H)', aba: '15',
    campos: ['tipo', 'local', 'participantes_wcr', 'participantes_ext', 'falado', 'decisao', 'pendencia',
      'responsavel', 'prazo', 'prioridade', 'status', 'gera_pleito', 'link_gravacao', 'transcricao',
      'porque', 'onde', 'como', 'quanto'],
    chave: (r) => `${s(r.data)}|${s(r.hora)}|${normChave(r.assunto)}|${s(r.ordem)}`,
    rotuloLinha: (r) => `${s(r.data)} · ${s(r.assunto).slice(0, 50)}`,
    data: (r) => (r.data as string) ?? null,
  },
  membro: {
    entidade: 'membro', rotulo: 'Equipe (pessoas)', aba: '08', campos: ['equipe', 'funcao', 'admissao', 'ativo'],
    chave: (r) => normCabecalho(r.matricula), rotuloLinha: (r) => `${s(r.matricula)} — ${s(r.nome)}`,
  },
  vencimento: {
    entidade: 'vencimento', rotulo: 'Vencimentos (ASO, NRs, CNH)', aba: '08', campos: ['vence_em'],
    chave: (r) => `${normCabecalho(r.matricula)}|${s(r.tipo)}`, rotuloLinha: (r) => `${s(r.matricula)} · ${s(r.tipo)}`,
  },
  ocorrencia: {
    entidade: 'ocorrencia', rotulo: 'Ocorrências', aba: '11',
    campos: ['tipo', 'descricao', 'servico_codigo', 'equipe', 'gravidade', 'impacto_h', 'custo_estimado', 'acao',
      'responsavel', 'prazo', 'status', 'data_encerramento', 'gera_pleito'],
    chave: (r) => `${s(r.data)}|${s(r.ordem)}`, rotuloLinha: (r) => `${s(r.data)} · ${s(r.tipo)}`,
    data: (r) => (r.data as string) ?? null,
  },
  plano: {
    entidade: 'plano', rotulo: 'Plano semanal', aba: '17',
    campos: ['equipe', 'compromisso', 'concluido', 'data_conclusao', 'causa_nc', 'reprogramado_para', 'observacao'],
    chave: (r) => `${normCabecalho(r.servico_codigo)}|${s(r.semana)}`, rotuloLinha: (r) => `${s(r.semana)} · ${s(r.servico_codigo)}`,
    data: (r) => (r.semana as string) ?? null,
  },
  pendente: {
    entidade: 'pendente', rotulo: 'Guardadas (RDO 10 e materiais 07)', aba: '07/10', campos: ['dados_json'],
    chave: (r) => `${s(r.aba)}|${s(r.chave_import)}`, rotuloLinha: (r) => `aba ${s(r.aba)} · ${s(r.chave_import)}`,
    data: (r) => ((r.dados as Registro | undefined)?.data as string) ?? null,
  },
}

export function rotuloEntidade(e: EntidadeOp): string { return CFG[e].rotulo }
export function abaDaEntidade(e: EntidadeOp): string { return CFG[e].aba }
export function camposDaEntidade(e: EntidadeOp): string[] { return CFG[e].campos }
export function chaveDaEntidade(e: EntidadeOp, r: Registro): string { return CFG[e].chave(r) }

/** JSON estável (chaves ordenadas) — para comparar o jsonb dos pendentes */
export function jsonEstavel(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null)
  if (Array.isArray(v)) return `[${v.map(jsonEstavel).join(',')}]`
  const o = v as Registro
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${jsonEstavel(o[k])}`).join(',')}}`
}

// ─── motor genérico por entidade ────────────────────────────────────────────

interface ItemArquivo { linha: number; dados: Registro; avisos: string[]; problemas?: Problema[] }
type LinhaBanco = Registro & { id: string; deleted_at?: string | null; ausente_na_planilha_em?: string | null; origem?: string | null; chave_import?: string | null }

function resumoVazio(): Record<VeredictoOp, number> {
  return { NOVO: 0, MUDOU: 0, IGUAL: 0, ERRO: 0, AUSENTE: 0, CONFLITO: 0, EXCLUIDO: 0 }
}

function descreverEscopo(cfg: ConfigEntidade, faixa: { min: string; max: string } | null, nArquivo: number): string {
  if (nArquivo === 0) return 'o arquivo não trouxe linhas desta aba para esta obra — nada é apontado como ausente'
  if (!cfg.data) return 'aba inteira desta obra'
  return faixa ? `de ${faixa.min} a ${faixa.max} (datas que o arquivo cobre)` : 'o arquivo não tem datas nesta aba — nada é apontado como ausente'
}

function reconciliarEntidade(cfg: ConfigEntidade, arquivo: ItemArquivo[], banco: LinhaBanco[]): GrupoRecon {
  const chaveBanco = (b: LinhaBanco) => (b.chave_import && cfg.entidade !== 'pendente' ? String(b.chave_import) : cfg.chave(b))
  const vivos = banco.filter((b) => !b.deleted_at)
  const chavesVivas = new Set(vivos.map(chaveBanco))
  const excluidos = new Map<string, LinhaBanco>()
  for (const b of banco) if (b.deleted_at && !chavesVivas.has(chaveBanco(b))) excluidos.set(chaveBanco(b), b)

  const linhas: LinhaRecon[] = []
  const paraDiff: ItemArquivo[] = []
  for (const it of arquivo) {
    const ex = excluidos.get(cfg.chave(it.dados))
    if (ex) {
      linhas.push({
        entidade: cfg.entidade, linha: it.linha, veredicto: 'EXCLUIDO', chave: cfg.chave(it.dados),
        rotulo: cfg.rotuloLinha(it.dados), dados: it.dados, idExistente: ex.id, alteracoes: [],
        problemas: [{ campo: '', mensagem: 'foi excluído no sistema — a planilha não traz de volta', bloqueia: true }],
        selecionada: false,
      })
    } else paraDiff.push(it)
  }

  // o motor do DRE compara pela CHAVE; o banco usa a chave gravada na importação quando existe
  const bancoParaDiff = vivos.map((b) => ({ ...b, __chave: chaveBanco(b) }))
  const itemDosDados = new Map<Registro, ItemArquivo>(paraDiff.map((i) => [i.dados, i]))
  const diff = calcularDiff<Registro>(
    paraDiff.map((i) => ({ linha: i.linha, dados: i.dados })),
    bancoParaDiff as (Registro & { id: string })[],
    {
      chave: (r) => (r.__chave as string | undefined) ?? cfg.chave(r),
      campos: cfg.campos,
      validar: (r) => {
        const it = itemDosDados.get(r)
        return [
          ...(it?.problemas ?? []),
          ...(it?.avisos ?? []).map((m) => ({ campo: '', mensagem: m, bloqueia: false })),
        ]
      },
    },
  )
  const porId = new Map(vivos.map((b) => [b.id, b]))

  for (const l of diff.linhas) {
    const base: LinhaRecon = {
      entidade: cfg.entidade, linha: l.linha, chave: cfg.chave(l.dados), rotulo: cfg.rotuloLinha(l.dados),
      dados: l.dados, idExistente: l.idExistente, alteracoes: l.alteracoes, problemas: l.problemas,
      veredicto: l.veredicto === 'DIFERENTE' ? 'MUDOU' : l.veredicto, selecionada: l.selecionada,
    }
    const ex = l.idExistente ? porId.get(l.idExistente) : undefined
    if (ex && cfg.identidade) {
      const conflitos = cfg.identidade.filter(({ campo }) => {
        const a = ex[campo], b = l.dados[campo]
        return a !== null && a !== undefined && a !== '' && b !== null && b !== undefined && b !== '' && !mesmoValor(a, b)
      })
      if (conflitos.length) {
        base.veredicto = 'CONFLITO'
        base.selecionada = false
        base.problemas = [...base.problemas, {
          campo: conflitos[0].campo, bloqueia: true,
          mensagem: `mesmo código com ${conflitos.map((c) => `${c.rotulo} diferente (sistema: ${s(ex[c.campo])}; planilha: ${s(l.dados[c.campo])})`).join(', ')}. `
            + 'O ID da planilha sai da posição da linha — se uma linha foi inserida ou apagada no meio, os IDs andaram. Nada gravado para este código.',
        }]
      }
    }
    if (ex && base.veredicto !== 'CONFLITO' && base.veredicto !== 'ERRO' && ex.ausente_na_planilha_em) {
      base.veredicto = 'MUDOU'
      base.selecionada = true
      base.alteracoes = [...base.alteracoes, { campo: 'ausente_na_planilha_em', antes: ex.ausente_na_planilha_em, depois: null }]
    }
    linhas.push(base)
  }

  // AUSENTE — só dentro do escopo do arquivo
  const faixa = cfg.data ? faixaDeDatas(arquivo.map((i) => cfg.data!(i.dados))) : null
  const chavesArquivo = new Set(arquivo.map((i) => cfg.chave(i.dados)))
  if (arquivo.length > 0 && (!cfg.data || faixa)) {
    for (const b of vivos) {
      if (b.origem !== 'planilha') continue          // o que nasceu na tela não "some da planilha"
      if (chavesArquivo.has(chaveBanco(b))) continue
      if (cfg.data) {
        const d = cfg.data(b)
        if (!d || d < faixa!.min || d > faixa!.max) continue
      }
      const jaApontado = b.ausente_na_planilha_em
      linhas.push({
        entidade: cfg.entidade, linha: 0, veredicto: 'AUSENTE', chave: chaveBanco(b), rotulo: cfg.rotuloLinha(b),
        dados: b, idExistente: b.id, alteracoes: [],
        problemas: [{
          campo: '', bloqueia: false,
          mensagem: jaApontado
            ? `continua fora da planilha (apontado desde ${String(jaApontado).slice(0, 10)}) — nada é apagado`
            : 'estava na planilha anterior e não veio nesta — será só APONTADO, nada é apagado',
        }],
        selecionada: !jaApontado,
      })
    }
  }

  const resumo = resumoVazio()
  for (const l of linhas) resumo[l.veredicto]++
  return {
    entidade: cfg.entidade, rotulo: cfg.rotulo, aba: cfg.aba, linhas, resumo,
    escopo: descreverEscopo(cfg, faixa, arquivo.length), avisos: [],
  }
}

// ─── do banco (DadosOp) para o formato de comparação ────────────────────────

function registrosDoBanco(e: EntidadeOp, d: DadosOp, ehAdmin: boolean): LinhaBanco[] {
  const codigo = new Map(d.servicos.map((x) => [x.id, x.codigo]))
  const mat = new Map(d.membros.map((m) => [m.pessoa_id, m.matricula]))
  const L = (x: object) => x as unknown as LinhaBanco
  switch (e) {
    case 'parametros':
      return d.parametros ? [L({ ...d.parametros, id: d.parametros.projeto_id, chave_import: 'parametros' })] : []
    case 'lista': return d.listas.map(L)
    case 'custo': return d.custos.map(L)
    case 'tributo': return d.tributos.map(L)
    case 'preco': return d.precos.map(L)
    case 'servico': return d.servicos.map(L)
    case 'programacao': return d.programacoes.map((x) => L({ ...x, servico_codigo: codigo.get(x.servico_id) ?? null }))
    case 'os': return d.ordens.map((x) => L({ ...x, servico_codigo: codigo.get(x.servico_id) ?? null }))
    case 'medicao': return d.medicoes.map((x) => L({ ...x, servico_codigo: codigo.get(x.servico_id) ?? null }))
    case 'lookahead': return d.lookaheads.map((x) => L({ ...x, servico_codigo: codigo.get(x.servico_id) ?? null }))
    case 'apontamento': return d.apontamentos.map(L)
    case 'faturamento': return d.faturamentos.map(L)
    case 'ata': return d.atas.map(L)
    case 'membro': return d.membros.map((m) => {
      const r = { ...m, nome: m.pessoa_nome ?? null } as Registro
      if (!ehAdmin) delete r.salario
      return L(r)
    })
    case 'vencimento': return d.vencimentos
      .filter((v) => mat.has(v.pessoa_id))
      .map((v) => L({ ...v, matricula: mat.get(v.pessoa_id) }))
    case 'ocorrencia': return d.ocorrencias
      .filter((o) => o.tem_ext)
      .map((o) => L({ ...o, servico_codigo: o.servico_id ? (codigo.get(o.servico_id) ?? null) : null }))
    case 'plano': return d.plano.map((p) => L({ ...p, servico_codigo: codigo.get(p.op_servico_id) ?? null }))
    case 'pendente': return d.pendentes.map((p) => L({ ...p, dados_json: jsonEstavel(p.dados) }))
  }
}

// ─── principal ──────────────────────────────────────────────────────────────

function colecoesComContrato(leitura: LeituraRev16): LinhaLida<{ contrato: string | null }>[][] {
  return [leitura.custos, leitura.precos, leitura.servicos, leitura.programacoes, leitura.ordens,
    leitura.apontamentos, leitura.medicoes, leitura.faturamentos, leitura.atas, leitura.lookaheads,
    leitura.planos, leitura.membros, leitura.ocorrencias, leitura.pendentes] as LinhaLida<{ contrato: string | null }>[][]
}

/** todos os contratos que o arquivo menciona (aba 01 + qualquer linha) */
export function contratosDaLeitura(leitura: LeituraRev16): string[] {
  const contratos = new Set<string>(leitura.contratos.map((c) => c.nome))
  for (const col of colecoesComContrato(leitura)) for (const l of col) if (l.dados.contrato) contratos.add(l.dados.contrato)
  return [...contratos]
}

export function reconciliar(e: EntradaReconciliacao): ResultadoReconciliacao {
  const { leitura, projetos, existentes, pessoas, ehAdmin } = e
  const naoEntendidas: NaoEntendida[] = [...leitura.naoEntendidas]
  const avisos: string[] = [...leitura.avisos]
  if (leitura.abasAusentes.length) avisos.push(`abas não encontradas no arquivo (puladas): ${leitura.abasAusentes.join(', ')}`)

  const contratos = contratosDaLeitura(leitura)
  const colecoes = colecoesComContrato(leitura)

  const contratosSemProjeto: string[] = []
  const alvo = new Map<string, ProjetoRef>()
  for (const c of contratos) {
    const p = projetoDoContrato(c, projetos)
    if (p) alvo.set(c, p)
    else contratosSemProjeto.push(c)
  }

  // o que ficou de fora por contrato
  const abaDe = new Map<LinhaLida<{ contrato: string | null }>[], string>([
    [leitura.custos, '01A'], [leitura.precos, '02'], [leitura.servicos, '03'], [leitura.programacoes, '04'],
    [leitura.ordens, '05'], [leitura.apontamentos, '06'], [leitura.medicoes, '09'], [leitura.faturamentos, '12'],
    [leitura.atas, '15'], [leitura.lookaheads, '16'], [leitura.planos, '17'], [leitura.membros, '08'],
    [leitura.ocorrencias, '11'], [leitura.pendentes, '07/10'],
  ] as [LinhaLida<{ contrato: string | null }>[], string][])
  for (const col of colecoes) {
    for (const l of col) {
      if (!l.dados.contrato) {
        naoEntendidas.push({ aba: abaDe.get(col) ?? '?', linha: l.linha, motivo: 'não deu para saber de qual contrato é a linha (CONTRATO vazio e código sem prefixo conhecido) — não entrou' })
      } else if (!alvo.has(l.dados.contrato)) {
        naoEntendidas.push({ aba: abaDe.get(col) ?? '?', linha: l.linha, motivo: `contrato "${l.dados.contrato}" não casa com nenhuma obra do sistema (procurei "${l.dados.contrato}" e "WCR — ${l.dados.contrato}") — não entrou` })
      }
    }
  }

  const resultado: ReconProjeto[] = []
  for (const [contrato, projeto] of alvo) {
    const banco = existentes.get(projeto.id)
    if (!banco) throw new Error(`reconciliar: faltou carregar os dados da obra ${projeto.nome}`)
    const doContrato = <T extends { contrato: string | null }>(xs: LinhaLida<T>[]) => xs.filter((x) => x.dados.contrato === contrato)
    const item = (l: LinhaLida<object>, dados: Registro, problemas: Problema[] = []): ItemArquivo =>
      ({ linha: l.linha, avisos: l.avisos, dados, problemas })
    const semContratoCampo = ({ contrato: _c, ...resto }: Registro) => resto

    const servicoIds: Record<string, string> = {}
    for (const sv of banco.servicos) servicoIds[normCabecalho(sv.codigo)] = sv.id
    const vivosPorCodigo = new Set(banco.servicos.filter((x) => !x.deleted_at).map((x) => normCabecalho(x.codigo)))
    const excluidosPorCodigo = new Set(banco.servicos.filter((x) => x.deleted_at).map((x) => normCabecalho(x.codigo)))
    const noArquivo = new Set(doContrato(leitura.servicos).map((x) => normCabecalho(x.dados.codigo)))
    const refServico = (codigo: unknown, obrigatorio = true): Problema[] => {
      const k = normCabecalho(codigo)
      if (!k) return obrigatorio ? [{ campo: 'servico_codigo', mensagem: 'sem ID do serviço', bloqueia: true }] : []
      // excluído no sistema vence a planilha: ele não volta, então quem depende dele não entra
      if (excluidosPorCodigo.has(k) && !vivosPorCodigo.has(k)) {
        return [{ campo: 'servico_codigo', mensagem: `o serviço ${k} foi excluído no sistema`, bloqueia: true }]
      }
      if (noArquivo.has(k) || vivosPorCodigo.has(k)) return []
      return [{ campo: 'servico_codigo', mensagem: `o serviço ${k} não está no cadastro (aba 03) nem no sistema`, bloqueia: true }]
    }

    const grupos: GrupoRecon[] = []
    const add = (ent: EntidadeOp, itens: ItemArquivo[]) => {
      // salário só é comparado (e gravado) quando quem importa é administrador
      const cfg = ent === 'membro' && ehAdmin ? { ...CFG.membro, campos: [...CFG.membro.campos, 'salario'] } : CFG[ent]
      const g = reconciliarEntidade(cfg, itens, registrosDoBanco(ent, banco, ehAdmin))
      grupos.push(g)
      return g
    }

    // 01 — parâmetros (uma linha por obra) e listas (as mesmas para todas as obras do arquivo)
    const c01 = leitura.contratos.find((c) => c.nome === contrato)
    if (c01) {
      add('parametros', [{
        linha: 5, avisos: [],
        dados: { ...leitura.parametros, contrato_nome: c01.nome, contrato_descricao: c01.descricao, prefixo: c01.prefixo, margem_alvo: c01.margem_alvo },
      }])
      add('lista', leitura.listas.map((l) => ({ linha: 44 + l.ordem, avisos: [], dados: { nome: l.nome, valor: l.valor, ordem: l.ordem } })))
      add('tributo', leitura.tributos.map((l) => item(l, { ...l.dados })))
    }
    add('custo', doContrato(leitura.custos).map((l) => item(l, semContratoCampo(l.dados as unknown as Registro))))
    add('preco', doContrato(leitura.precos).map((l) => item(l, { ...l.dados })))
    const gServ = add('servico', doContrato(leitura.servicos).map((l) => item(l, semContratoCampo(l.dados as unknown as Registro))))

    add('programacao', doContrato(leitura.programacoes).map((l) => item(l, semContratoCampo(l.dados as unknown as Registro), refServico(l.dados.servico_codigo))))
    add('os', doContrato(leitura.ordens).map((l) => item(l, semContratoCampo(l.dados as unknown as Registro), refServico(l.dados.servico_codigo))))
    add('medicao', doContrato(leitura.medicoes).map((l) => {
      const precoExiste = leitura.precos.some((p) => normCabecalho(p.dados.chave) === normCabecalho(l.dados.cod_preco))
        || banco.precos.some((p) => !p.deleted_at && normCabecalho(p.chave) === normCabecalho(l.dados.cod_preco))
      const probs = refServico(l.dados.servico_codigo)
      if (!precoExiste) probs.push({ campo: 'cod_preco', bloqueia: false, mensagem: `código ${l.dados.cod_preco} não está na tabela de preços — o valor fica "CÓDIGO NÃO ENCONTRADO"` })
      return item(l, semContratoCampo(l.dados as unknown as Registro), probs)
    }))
    add('lookahead', doContrato(leitura.lookaheads).map((l) => item(l, semContratoCampo(l.dados as unknown as Registro), refServico(l.dados.servico_codigo))))
    add('apontamento', doContrato(leitura.apontamentos).map((l) => item(l, semContratoCampo(l.dados as unknown as Registro))))
    add('faturamento', doContrato(leitura.faturamentos).map((l) => item(l, semContratoCampo(l.dados as unknown as Registro))))
    add('ata', doContrato(leitura.atas).map((l) => item(l, semContratoCampo(l.dados as unknown as Registro))))

    // 08 — pessoas: casa pelo nome dentro da empresa da obra; salário só para admin
    const pessoaDaMatricula: Record<string, string> = {}
    for (const m of banco.membros) pessoaDaMatricula[normCabecalho(m.matricula)] = m.pessoa_id
    const pessoasDaOrg = pessoas.filter((p) => !projeto.org_id || !p.org_id || p.org_id === projeto.org_id)
    const porNome = new Map<string, PessoaRef[]>()
    for (const p of pessoasDaOrg) {
      const k = normChave(p.nome_completo)
      porNome.set(k, [...(porNome.get(k) ?? []), p])
    }
    const membrosArquivo = doContrato(leitura.membros)
    const gMembro = add('membro', membrosArquivo.map((l) => {
      const probs: Problema[] = []
      const dados: Registro = {
        matricula: l.dados.matricula, nome: l.dados.nome, equipe: l.dados.equipe, funcao: l.dados.funcao,
        admissao: l.dados.admissao, ativo: l.dados.ativo,
      }
      if (ehAdmin) dados.salario = l.dados.salario
      if (!l.dados.matricula) {
        probs.push({ campo: 'matricula', bloqueia: true, mensagem: 'sem MATRÍCULA — a matrícula é a identidade da pessoa neste contrato' })
        return item(l, dados, probs)
      }
      const existente = pessoaDaMatricula[normCabecalho(l.dados.matricula)]
      if (existente) {
        dados.pessoa_id = existente
        const nomeSistema = banco.membros.find((m) => m.pessoa_id === existente)?.pessoa_nome
        if (nomeSistema && normChave(nomeSistema) !== normChave(l.dados.nome)) {
          probs.push({ campo: 'nome', bloqueia: false, mensagem: `nome na planilha ("${l.dados.nome}") difere do cadastro de RH ("${nomeSistema}") — o cadastro não é alterado pela importação` })
        }
      } else {
        const achadas = porNome.get(normChave(l.dados.nome)) ?? []
        if (achadas.length === 1) {
          dados.pessoa_id = achadas[0].id
          probs.push({ campo: 'nome', bloqueia: false, mensagem: 'casou com uma pessoa já cadastrada no RH pelo nome' })
        } else if (achadas.length > 1) {
          probs.push({ campo: 'nome', bloqueia: true, mensagem: `o nome casa com ${achadas.length} pessoas do cadastro (homônimos) — vincule no RH antes de importar` })
        } else {
          dados.pessoa_id = null
          probs.push({ campo: 'nome', bloqueia: false, mensagem: 'pessoa não encontrada no cadastro — será criada com a marca "revisar"' })
        }
      }
      return item(l, dados, probs)
    }))
    if (!ehAdmin && membrosArquivo.some((m) => m.dados.salario !== null)) {
      gMembro.avisos.push('a planilha tem salários, mas só administrador grava salário — eles NÃO serão importados; o custo da folha usa os salários já cadastrados')
    }
    const bloqueados = new Set(gMembro.linhas.filter((l) => l.veredicto === 'ERRO').map((l) => normCabecalho(l.dados.matricula)))
    add('vencimento', membrosArquivo.flatMap((l) => {
      if (!l.dados.matricula) return []
      return TIPOS_VENCIMENTO
        .filter((t) => l.dados.vencimentos[t])
        .map((t) => item(l, { matricula: l.dados.matricula, tipo: t, vence_em: l.dados.vencimentos[t] },
          bloqueados.has(normCabecalho(l.dados.matricula)) ? [{ campo: 'matricula', bloqueia: true, mensagem: 'a pessoa desta linha está com erro na aba 08' }] : []))
    }))

    add('ocorrencia', doContrato(leitura.ocorrencias).map((l) => {
      const probs = l.dados.servico_codigo ? refServico(l.dados.servico_codigo, false) : []
      if (!l.dados.tipo && !l.dados.descricao) probs.push({ campo: 'descricao', bloqueia: true, mensagem: 'ocorrência sem TIPO e sem DESCRIÇÃO' })
      return item(l, semContratoCampo(l.dados as unknown as Registro), probs)
    }))
    add('plano', doContrato(leitura.planos).map((l) => item(l, semContratoCampo(l.dados as unknown as Registro), refServico(l.dados.servico_codigo))))
    add('pendente', doContrato(leitura.pendentes).map((l) => item(l, {
      aba: l.dados.aba, chave_import: l.dados.chave, linha: l.linha, dados: l.dados.dados, dados_json: jsonEstavel(l.dados.dados),
    })))

    // CONFLITO de serviço contamina o que depende dele
    const emConflito = new Set(gServ.linhas.filter((l) => l.veredicto === 'CONFLITO').map((l) => l.chave))
    if (emConflito.size) {
      for (const g of grupos) {
        if (!['programacao', 'os', 'medicao', 'lookahead', 'plano', 'ocorrencia'].includes(g.entidade)) continue
        for (const l of g.linhas) {
          const k = normCabecalho(l.dados.servico_codigo)
          if (!k || !emConflito.has(k) || l.veredicto === 'AUSENTE' || l.veredicto === 'ERRO') continue
          l.veredicto = 'CONFLITO'
          l.selecionada = false
          l.problemas = [...l.problemas, { campo: 'servico_codigo', bloqueia: true, mensagem: `o serviço ${k} está em CONFLITO — resolva o cadastro antes` }]
        }
        g.resumo = resumoVazio()
        for (const l of g.linhas) g.resumo[l.veredicto]++
      }
    }

    resultado.push({
      projetoId: projeto.id, projetoNome: projeto.nome, orgId: projeto.org_id, contrato,
      grupos: grupos.sort((a, b) => ORDEM_ENTIDADES.indexOf(a.entidade) - ORDEM_ENTIDADES.indexOf(b.entidade)),
      servicoIds, pessoaDaMatricula,
    })
  }

  return { projetos: resultado, naoEntendidas, contratosSemProjeto, avisos, ehAdmin }
}

/** total por veredicto somando todas as obras e abas */
export function resumoGeral(r: ResultadoReconciliacao): Record<VeredictoOp, number> {
  const out = resumoVazio()
  for (const p of r.projetos) for (const g of p.grupos) for (const v of VEREDICTOS) out[v] += g.resumo[v]
  return out
}
