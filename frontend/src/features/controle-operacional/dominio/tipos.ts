/**
 * tipos.ts — as linhas das tabelas op_* (migration 035), no formato em que o
 * PostgREST devolve: data = 'YYYY-MM-DD', numeric = number, vazio = null.
 *
 * Tipos do módulo moram AQUI, não em `types/index.ts` (arquivo compartilhado).
 */

export type ISODate = string

/** colunas comuns a toda tabela op_* */
export interface OpBase {
  id: string
  org_id?: string | null
  projeto_id: string
  origem?: string | null
  chave_import?: string | null
  importacao_id?: string | null
  ausente_na_planilha_em?: string | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

/** aba 01 — uma linha por obra (PK projeto_id; `id` aqui é o próprio projeto_id) */
export interface OpParametros extends OpBase {
  empresa: string | null
  responsavel: string | null
  coordenador: string | null
  contrato_nome: string | null
  contrato_descricao: string | null
  prefixo: string | null
  inicio_operacao: ISODate | null
  mes_referencia: ISODate | null
  desconto_consorcio: number | null
  dia_fechamento: number | null
  defasagem_recebimento: number | null
  dias_uteis_mes: number | null
  jornada_h: number | null
  prazo_padrao_dias: number | null
  alerta_prazo_dias: number | null
  margem_alvo: number | null
  fator_encargos: number | null
  beneficios_pessoa: number | null
  ultimo_seq_sistema?: number
  fonte_custo?: 'op' | 'fcp'
}

export interface OpLista extends OpBase {
  nome: string
  valor: string
  ordem: number | null
}

export interface OpCustoItem extends OpBase {
  item: string
  qtd: number | null
  valor_unit: number | null
  fonte: string | null
  ordem: number | null
}

export interface OpTributo extends OpBase {
  nome: string
  aliquota: number | null
  memoria: string | null
  fonte: string | null
  ordem: number | null
}

export interface OpPreco extends OpBase {
  chave: string
  contrato: string | null
  grupo: string | null
  item_sabesp: string | null
  descricao: string | null
  n_preco: string | null
  un: string | null
  preco: number | null
}

export interface OpServico extends OpBase {
  codigo: string
  n_os_sabesp: string | null
  data_solicitacao: ISODate | null
  prazo_dias: number | null
  prioridade: string | null
  tipo: string | null
  endereco: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  referencia: string | null
  pavimento: string | null
  descricao: string | null
  tratativa_manual: string | null
  observacao: string | null
  /** aba 03 R digitada por cima da fórmula; vazio = conclusão da OS */
  data_execucao_digitada?: ISODate | null
}

export interface OpProgramacao extends OpBase {
  servico_id: string
  data: ISODate
  equipe: string | null
  seq: number | null
  h_previstas: number | null
  executou: string | null
  data_execucao: ISODate | null
  motivo_nao_execucao: string | null
  reprogramar_para: ISODate | null
  observacao: string | null
}

export interface OpOrdemServico extends OpBase {
  servico_id: string
  equipe: string | null
  encarregado: string | null
  data_inicio: ISODate | null
  data_conclusao: ISODate | null
  profundidade_m: number | null
  extensao_m: number | null
  pavimento_reposto: string | null
  foto_antes: string | null
  foto_depois: string | null
  n_rdo: string | null
  pendencia: string | null
}

export interface OpApontamento extends OpBase {
  data: ISODate
  equipe: string | null
  n_pessoas: number | null
  h_normais: number | null
  h_extras: number | null
  retro_h: number | null
  cam34_munck_h: number | null
  caminhao_hr_h: number | null
  compressor_h: number | null
  rompedor_h: number | null
  bomba_h: number | null
  km_rodado: number | null
  status_dia: string | null
  motivo_parada: string | null
  observacao: string | null
}

export interface OpMedicaoItem extends OpBase {
  servico_id: string
  cod_preco: string
  ordem: number | null
  n_boletim: string | null
  qtd: number | null
  status: string | null
  data_apresentacao: ISODate | null
  valor_glosado: number | null
  motivo_glosa: string | null
  reapresentar: string | null
  observacao: string | null
  /** aba 09 G digitada por cima da fórmula; vazio = conclusão da OS. Decide o mês de medição. */
  data_execucao_digitada?: ISODate | null
}

export interface OpFaturamento extends OpBase {
  /** 1º dia do mês */
  mes: ISODate
  n_nf: string | null
  data_nf: ISODate | null
  data_recebimento: ISODate | null
  valor_recebido: number | null
}

export interface OpAta extends OpBase {
  data: ISODate
  hora: string | null
  tipo: string | null
  local: string | null
  participantes_wcr: string | null
  participantes_ext: string | null
  assunto: string | null
  falado: string | null
  decisao: string | null
  pendencia: string | null
  responsavel: string | null
  prazo: ISODate | null
  prioridade: string | null
  status: string | null
  gera_pleito: string | null
  link_gravacao: string | null
  transcricao: string | null
  porque: string | null
  onde: string | null
  como: string | null
  quanto: number | null
  ordem: number | null
}

export interface OpLookahead extends OpBase {
  servico_id: string
  semana: ISODate
  material_ok: string | null
  equipamento_ok: string | null
  mao_de_obra_ok: string | null
  os_emitida: string | null
  licenca_ok: string | null
  acesso_ok: string | null
  responsavel: string | null
  prazo: ISODate | null
  lps_restricao_id: string | null
}

/** op_equipe_membro + o nome que mora em `pessoas` */
export interface OpEquipeMembro extends OpBase {
  pessoa_id: string
  matricula: string
  equipe: string | null
  funcao: string | null
  admissao: ISODate | null
  /** null = não informado (a planilha só conta quem está "SIM") */
  ativo: boolean | null
  pessoa_nome?: string | null
  /** só vem preenchido para admin global (pessoa_remuneracao é fechada) */
  salario?: number | null
}

export type TipoVencimento = 'ASO' | 'NR06' | 'NR10' | 'NR18' | 'NR33' | 'NR35' | 'CNH'
export const TIPOS_VENCIMENTO: TipoVencimento[] = ['ASO', 'NR06', 'NR10', 'NR18', 'NR33', 'NR35', 'CNH']

export interface PessoaVencimento {
  id: string
  pessoa_id: string
  tipo: TipoVencimento
  vence_em: ISODate | null
  org_id?: string | null
  origem?: string | null
  chave_import?: string | null
  ausente_na_planilha_em?: string | null
  deleted_at?: string | null
}

/** ocorrencias_obra (base) + op_ocorrencia_ext, fundidas. `id` = ocorrencias_obra.id */
export interface OpOcorrencia extends OpBase {
  data: ISODate | null
  tipo: string | null
  descricao: string | null
  resolvida: boolean | null
  resolvido_em: string | null
  /** a linha tem extensão op_ocorrencia_ext? (ocorrência vinda do WhatsApp não tem) */
  tem_ext: boolean
  servico_id: string | null
  equipe: string | null
  gravidade: string | null
  impacto_h: number | null
  custo_estimado: number | null
  acao: string | null
  responsavel: string | null
  prazo: string | null
  status: string | null
  data_encerramento: ISODate | null
  gera_pleito: string | null
}

/** lps_tasks (base) + op_plano_item, fundidas. `id` = lps_tasks.id */
export interface OpPlanoItem extends OpBase {
  op_servico_id: string
  semana: ISODate
  semana_iso: string | null
  equipe: string | null
  compromisso: string | null
  /** 'SIM' | 'NÃO' | null — vem de lps_tasks.concluida (true/false/null) */
  concluido: string | null
  data_conclusao: ISODate | null
  causa_nc: string | null
  reprogramado_para: ISODate | null
  observacao: string | null
}

export interface OpPendente extends OpBase {
  aba: string
  linha: number | null
  dados: Record<string, unknown>
}

export interface OpImportacao extends OpBase {
  arquivo: string
  sha256: string | null
  modelo: string
  resumo: Record<string, unknown>
}

/** resposta de op_folha_agregada() — nunca salário individual */
export interface FolhaAgregada {
  n_com_salario: number
  soma_salario: number
}

/** tudo que o módulo carrega de UMA obra */
export interface DadosOp {
  projetoId: string
  parametros: OpParametros | null
  listas: OpLista[]
  custos: OpCustoItem[]
  tributos: OpTributo[]
  precos: OpPreco[]
  servicos: OpServico[]
  programacoes: OpProgramacao[]
  ordens: OpOrdemServico[]
  apontamentos: OpApontamento[]
  medicoes: OpMedicaoItem[]
  faturamentos: OpFaturamento[]
  atas: OpAta[]
  lookaheads: OpLookahead[]
  membros: OpEquipeMembro[]
  vencimentos: PessoaVencimento[]
  ocorrencias: OpOcorrencia[]
  plano: OpPlanoItem[]
  pendentes: OpPendente[]
  importacoes: OpImportacao[]
}

export function dadosVazios(projetoId: string): DadosOp {
  return {
    projetoId, parametros: null, listas: [], custos: [], tributos: [], precos: [], servicos: [],
    programacoes: [], ordens: [], apontamentos: [], medicoes: [], faturamentos: [], atas: [],
    lookaheads: [], membros: [], vencimentos: [], ocorrencias: [], plano: [], pendentes: [],
    importacoes: [],
  }
}
