/**
 * telas.ts — o que cada tela tem: campos DIGITADOS (com tipo e menu) e colunas
 * CALCULADAS (de calculos.ts). Porta do `app/telas.py`.
 *
 * Regra de ouro mantida do Excel: azul é o que você digita, o resto é calculado.
 * A tabela e o formulário genéricos (TabelaOperacional / FormularioOperacional)
 * são montados só a partir daqui — o módulo inteiro fica explicável nesta página.
 *
 * O CONTRATO não é campo: cada obra (projeto) É um contrato. "Bertioga" e "Santos"
 * são as obras "WCR — Bertioga" e "WCR — Santos".
 */
import type { DadosOp, ISODate } from './tipos'
import {
  apontamentoCalc, ataCalc, faturamentoCalc, lookaheadCalc, medicaoCalc, ocorrenciaCalc, osCalc,
  programacaoCalc, servicoCalc, type ContextoCalculo,
} from './calculos'
import { normSimNao, paraNumero, textoOuNulo } from './normalizar'
import { dataBR, inicioDoMes, segundaDaSemana, textoParaISO } from './datas'

/** texto | numero | data | hora | memo | sn | snp | bool | servico | pessoa | preco | menu:<LISTA> | menu_fixo:A,B */
export type TipoCampo = string

export interface CampoTela {
  campo: string
  rotulo: string
  tipo: TipoCampo
  obrigatorio?: boolean
  /** some da tabela (continua no formulário) — para textos longos */
  soFormulario?: boolean
}

export type FormatoCalc = 'brl' | 'pct' | 'data' | 'num' | 'int' | 'texto' | 'bool'

export interface CalcTela {
  campo: string
  rotulo: string
  formato: FormatoCalc
}

export type TelaId =
  | 'servicos' | 'programacao' | 'os' | 'apontamento' | 'medicao' | 'ocorrencias' | 'equipe'
  | 'faturamento' | 'atas' | 'lookahead' | 'plano' | 'parametros' | 'custos' | 'tributos' | 'precos'

export type Colecao = Exclude<keyof DadosOp, 'projetoId' | 'parametros'>

export interface Tela {
  id: TelaId
  titulo: string
  /** aba da planilha de origem */
  aba: string
  /** tabela gravada pelo CRUD genérico (null = tela com gravação própria) */
  tabela: string | null
  pk: string
  colecao: Colecao | 'parametros'
  ordem: string
  ordemDesc?: boolean
  campos: CampoTela[]
  calculadas: CalcTela[]
  guia: string
}

const SN = 'sn', SNP = 'snp'

export const TELAS: Record<TelaId, Tela> = {
  servicos: {
    id: 'servicos', titulo: '03 · Cadastro de serviços', aba: '03', tabela: 'op_servico', pk: 'id',
    colecao: 'servicos', ordem: 'data_solicitacao', ordemDesc: true,
    campos: [
      { campo: 'codigo', rotulo: 'ID', tipo: 'texto' },
      { campo: 'n_os_sabesp', rotulo: 'Nº OS SABESP', tipo: 'texto' },
      { campo: 'data_solicitacao', rotulo: 'Data da solicitação', tipo: 'data' },
      { campo: 'prazo_dias', rotulo: 'Prazo (dias)', tipo: 'numero' },
      { campo: 'prioridade', rotulo: 'Prioridade', tipo: 'menu:PRIORIDADE' },
      { campo: 'tipo', rotulo: 'Tipo de serviço', tipo: 'menu:TIPO' },
      { campo: 'endereco', rotulo: 'Endereço', tipo: 'texto' },
      { campo: 'numero', rotulo: 'Nº', tipo: 'texto' },
      { campo: 'bairro', rotulo: 'Bairro', tipo: 'menu:BAIRRO' },
      { campo: 'cidade', rotulo: 'Cidade', tipo: 'texto', soFormulario: true },
      { campo: 'referencia', rotulo: 'Ponto de referência', tipo: 'texto', soFormulario: true },
      { campo: 'pavimento', rotulo: 'Pavimento', tipo: 'menu:PAVIMENTO' },
      { campo: 'descricao', rotulo: 'Descrição da solicitação', tipo: 'memo', soFormulario: true },
      { campo: 'tratativa_manual', rotulo: 'Tratativa manual', tipo: 'menu:STATUS_CAD' },
      { campo: 'observacao', rotulo: 'Observação', tipo: 'memo', soFormulario: true },
      { campo: 'data_execucao_digitada', rotulo: 'Data de execução (só se diferente da conclusão da OS)', tipo: 'data', soFormulario: true },
    ],
    calculadas: [
      { campo: 'status', rotulo: 'Status', formato: 'texto' },
      { campo: 'equipe', rotulo: 'Equipe', formato: 'texto' },
      { campo: 'data_programada', rotulo: 'Data programada', formato: 'data' },
      { campo: 'data_limite', rotulo: 'Data limite', formato: 'data' },
      { campo: 'situacao_prazo', rotulo: 'Situação do prazo', formato: 'texto' },
      { campo: 'dias_em_aberto', rotulo: 'Dias em aberto', formato: 'int' },
      { campo: 'valor_medido', rotulo: 'Valor medido', formato: 'brl' },
    ],
    guia: 'Chegou pedido da SABESP? Cadastre aqui. Nada é programado, executado ou medido sem estar aqui. Serviço criado na tela ganha o código <PREFIXO>-S0001; os da planilha mantêm o BER-0001.',
  },
  programacao: {
    id: 'programacao', titulo: '04 · Programação diária', aba: '04', tabela: 'op_programacao', pk: 'id',
    colecao: 'programacoes', ordem: 'data', ordemDesc: true,
    campos: [
      { campo: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
      { campo: 'equipe', rotulo: 'Equipe', tipo: 'menu:EQUIPE' },
      { campo: 'seq', rotulo: 'Seq', tipo: 'numero' },
      { campo: 'servico_id', rotulo: 'ID do serviço', tipo: 'servico', obrigatorio: true },
      { campo: 'h_previstas', rotulo: 'H previstas', tipo: 'numero' },
      { campo: 'executou', rotulo: 'Executou?', tipo: SN },
      { campo: 'data_execucao', rotulo: 'Data de execução', tipo: 'data' },
      { campo: 'motivo_nao_execucao', rotulo: 'Motivo da não execução', tipo: 'menu:MOTIVO_NE' },
      { campo: 'reprogramar_para', rotulo: 'Reprogramar para', tipo: 'data' },
      { campo: 'observacao', rotulo: 'Observação', tipo: 'memo', soFormulario: true },
    ],
    calculadas: [
      { campo: 'status', rotulo: 'Status', formato: 'texto' },
      { campo: 'aderencia', rotulo: 'Aderência', formato: 'texto' },
    ],
    guia: 'Monte o dia seguinte até as 16h. No fim do dia marque executou SIM/NÃO e, se NÃO, o motivo.',
  },
  os: {
    id: 'os', titulo: '05 · Ordens de serviço', aba: '05', tabela: 'op_ordem_servico', pk: 'id',
    colecao: 'ordens', ordem: 'data_conclusao', ordemDesc: true,
    campos: [
      { campo: 'servico_id', rotulo: 'ID do serviço', tipo: 'servico', obrigatorio: true },
      { campo: 'equipe', rotulo: 'Equipe', tipo: 'menu:EQUIPE' },
      { campo: 'encarregado', rotulo: 'Encarregado', tipo: 'pessoa' },
      { campo: 'data_inicio', rotulo: 'Data de início', tipo: 'data' },
      { campo: 'data_conclusao', rotulo: 'Data de conclusão', tipo: 'data' },
      { campo: 'profundidade_m', rotulo: 'Profundidade (m)', tipo: 'numero' },
      { campo: 'extensao_m', rotulo: 'Extensão (m)', tipo: 'numero' },
      { campo: 'pavimento_reposto', rotulo: 'Pavimento reposto?', tipo: SNP },
      { campo: 'foto_antes', rotulo: 'Foto antes?', tipo: SNP },
      { campo: 'foto_depois', rotulo: 'Foto depois?', tipo: SNP },
      { campo: 'n_rdo', rotulo: 'Nº do RDO', tipo: 'texto' },
      { campo: 'pendencia', rotulo: 'Pendência / observação', tipo: 'memo', soFormulario: true },
    ],
    calculadas: [
      { campo: 'status', rotulo: 'Status', formato: 'texto' },
      { campo: 'dias', rotulo: 'Dias', formato: 'int' },
      { campo: 'n_itens', rotulo: 'Itens medidos', formato: 'int' },
      { campo: 'valor', rotulo: 'Valor da OS', formato: 'brl' },
      { campo: 'mes_medicao', rotulo: 'Mês de medição', formato: 'data' },
      { campo: 'pronta_para_medir', rotulo: 'Pronta p/ medir', formato: 'bool' },
    ],
    guia: 'Abra quando a equipe começar. Só vira dinheiro a OS concluída, com foto antes e depois e pavimento reposto. Escreva CANCELADA na pendência para cancelar.',
  },
  apontamento: {
    id: 'apontamento', titulo: '06 · Apontamento diário', aba: '06', tabela: 'op_apontamento', pk: 'id',
    colecao: 'apontamentos', ordem: 'data', ordemDesc: true,
    campos: [
      { campo: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
      { campo: 'equipe', rotulo: 'Equipe', tipo: 'menu:EQUIPE' },
      { campo: 'n_pessoas', rotulo: 'Nº pessoas', tipo: 'numero' },
      { campo: 'h_normais', rotulo: 'H normais', tipo: 'numero' },
      { campo: 'h_extras', rotulo: 'H extras', tipo: 'numero' },
      { campo: 'retro_h', rotulo: 'Retro (h)', tipo: 'numero' },
      { campo: 'cam34_munck_h', rotulo: 'Cam 3/4 + munck (h)', tipo: 'numero', soFormulario: true },
      { campo: 'caminhao_hr_h', rotulo: 'Caminhão HR (h)', tipo: 'numero', soFormulario: true },
      { campo: 'compressor_h', rotulo: 'Compressor (h)', tipo: 'numero', soFormulario: true },
      { campo: 'rompedor_h', rotulo: 'Rompedor (h)', tipo: 'numero', soFormulario: true },
      { campo: 'bomba_h', rotulo: 'Bomba (h)', tipo: 'numero', soFormulario: true },
      { campo: 'km_rodado', rotulo: 'Km rodado', tipo: 'numero', soFormulario: true },
      { campo: 'status_dia', rotulo: 'Status do dia', tipo: 'menu:DIA' },
      { campo: 'motivo_parada', rotulo: 'Motivo de parada', tipo: 'menu:MOTIVO_PARADA' },
      { campo: 'observacao', rotulo: 'Observação', tipo: 'memo', soFormulario: true },
    ],
    calculadas: [
      { campo: 'dia', rotulo: 'Dia', formato: 'texto' },
      { campo: 'semana', rotulo: 'Semana', formato: 'texto' },
      { campo: 'hh_total', rotulo: 'HH total', formato: 'num' },
      { campo: 'serv_programados', rotulo: 'Serv. programados', formato: 'int' },
      { campo: 'serv_executados', rotulo: 'Serv. executados', formato: 'int' },
      { campo: 'aderencia', rotulo: 'Aderência', formato: 'pct' },
      { campo: 'valor_produzido', rotulo: 'R$ produzido', formato: 'brl' },
      { campo: 'meta_dia', rotulo: 'Meta do dia', formato: 'brl' },
      { campo: 'atingimento', rotulo: 'Atingimento', formato: 'pct' },
      { campo: 'custo_equipe', rotulo: 'Custo da equipe', formato: 'brl' },
      { campo: 'resultado_dia', rotulo: 'Resultado do dia', formato: 'brl' },
      { campo: 'rs_por_hh', rotulo: 'R$ por HH', formato: 'brl' },
    ],
    guia: 'Uma linha = uma equipe em um dia. Sem a EQUIPE preenchida não há como cruzar com programação, OS e medição — a produção fica "—" (não informada).',
  },
  medicao: {
    id: 'medicao', titulo: '09 · Medição', aba: '09', tabela: 'op_medicao_item', pk: 'id',
    colecao: 'medicoes', ordem: 'n_boletim', ordemDesc: true,
    campos: [
      { campo: 'n_boletim', rotulo: 'Nº boletim (ex: BM-09/2026)', tipo: 'texto' },
      { campo: 'servico_id', rotulo: 'ID do serviço', tipo: 'servico', obrigatorio: true },
      { campo: 'cod_preco', rotulo: 'Cód. preço (chave)', tipo: 'preco', obrigatorio: true },
      { campo: 'qtd', rotulo: 'Qtd', tipo: 'numero' },
      { campo: 'status', rotulo: 'Status da medição', tipo: 'menu:STATUS_MED' },
      { campo: 'data_apresentacao', rotulo: 'Data de apresentação', tipo: 'data' },
      { campo: 'valor_glosado', rotulo: 'Valor glosado', tipo: 'numero' },
      { campo: 'motivo_glosa', rotulo: 'Motivo da glosa', tipo: 'texto', soFormulario: true },
      { campo: 'reapresentar', rotulo: 'Reapresentar?', tipo: SN },
      { campo: 'observacao', rotulo: 'Observação', tipo: 'memo', soFormulario: true },
      { campo: 'data_execucao_digitada', rotulo: 'Data de execução (só se diferente da conclusão da OS)', tipo: 'data', soFormulario: true },
    ],
    calculadas: [
      { campo: 'mes', rotulo: 'Mês', formato: 'data' },
      { campo: 'equipe', rotulo: 'Equipe', formato: 'texto' },
      { campo: 'data_execucao', rotulo: 'Data exec.', formato: 'data' },
      { campo: 'descricao', rotulo: 'Descrição', formato: 'texto' },
      { campo: 'un', rotulo: 'Un', formato: 'texto' },
      { campo: 'preco', rotulo: 'Preço', formato: 'brl' },
      { campo: 'valor', rotulo: 'Valor', formato: 'brl' },
      { campo: 'valor_aprovado', rotulo: 'Aprovado', formato: 'brl' },
    ],
    guia: 'Aqui o serviço vira dinheiro. Uma linha por item de preço de uma OS. Nº do boletim é o documento do mês (BM-09/2026); ID do serviço é BER-0001. São coisas diferentes.',
  },
  ocorrencias: {
    id: 'ocorrencias', titulo: '11 · Ocorrências', aba: '11', tabela: null, pk: 'id',
    colecao: 'ocorrencias', ordem: 'data', ordemDesc: true,
    campos: [
      { campo: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
      { campo: 'servico_id', rotulo: 'ID do serviço', tipo: 'servico' },
      { campo: 'equipe', rotulo: 'Equipe', tipo: 'menu:EQUIPE' },
      { campo: 'tipo', rotulo: 'Tipo', tipo: 'menu:TIPO_OCOR', obrigatorio: true },
      { campo: 'gravidade', rotulo: 'Gravidade', tipo: 'menu:GRAVIDADE' },
      { campo: 'descricao', rotulo: 'Descrição do fato', tipo: 'memo', obrigatorio: true },
      { campo: 'impacto_h', rotulo: 'Impacto (h)', tipo: 'numero' },
      { campo: 'custo_estimado', rotulo: 'Custo estimado', tipo: 'numero' },
      { campo: 'acao', rotulo: 'Ação imediata', tipo: 'memo', soFormulario: true },
      { campo: 'responsavel', rotulo: 'Responsável', tipo: 'texto' },
      { campo: 'prazo', rotulo: 'Prazo', tipo: 'texto' },
      { campo: 'status', rotulo: 'Status', tipo: 'menu:STATUS_OC' },
      { campo: 'data_encerramento', rotulo: 'Data de encerramento', tipo: 'data' },
      { campo: 'gera_pleito', rotulo: 'Gera pleito?', tipo: SN },
    ],
    calculadas: [{ campo: 'dias_em_aberto', rotulo: 'Dias em aberto', formato: 'int' }],
    guia: 'Registre no mesmo dia. Ocorrência sem registro vira glosa sem defesa. Grava em ocorrencias_obra (as mesmas do Campo WhatsApp/Punch List) + os campos da planilha.',
  },
  equipe: {
    id: 'equipe', titulo: '08 · Equipe', aba: '08', tabela: 'op_equipe_membro', pk: 'id',
    colecao: 'membros', ordem: 'matricula',
    campos: [
      { campo: 'matricula', rotulo: 'Matrícula', tipo: 'texto', obrigatorio: true },
      { campo: 'equipe', rotulo: 'Equipe', tipo: 'menu:EQUIPE' },
      { campo: 'funcao', rotulo: 'Função', tipo: 'menu:FUNCAO' },
      { campo: 'admissao', rotulo: 'Admissão', tipo: 'data' },
      { campo: 'ativo', rotulo: 'Ativo?', tipo: 'bool' },
    ],
    calculadas: [],
    guia: 'Quem trabalha em cada equipe. Nome e cargo moram no cadastro de pessoas (RH); salário só o administrador vê.',
  },
  faturamento: {
    id: 'faturamento', titulo: '12 · Faturamento', aba: '12', tabela: 'op_faturamento', pk: 'id',
    colecao: 'faturamentos', ordem: 'mes', ordemDesc: true,
    campos: [
      { campo: 'mes', rotulo: 'Mês (1º dia)', tipo: 'data', obrigatorio: true },
      { campo: 'n_nf', rotulo: 'Nº da NF', tipo: 'texto' },
      { campo: 'data_nf', rotulo: 'Data da NF', tipo: 'data' },
      { campo: 'data_recebimento', rotulo: 'Data do recebimento', tipo: 'data' },
      { campo: 'valor_recebido', rotulo: 'Valor recebido', tipo: 'numero' },
    ],
    calculadas: [
      { campo: 'bruto', rotulo: 'Medição bruta', formato: 'brl' },
      { campo: 'glosa', rotulo: 'Glosa', formato: 'brl' },
      { campo: 'aprovado', rotulo: 'Aprovada', formato: 'brl' },
      { campo: 'imposto', rotulo: 'Imposto', formato: 'brl' },
      { campo: 'liquido', rotulo: 'Líquido', formato: 'brl' },
      { campo: 'previsto', rotulo: 'Receb. previsto', formato: 'data' },
      { campo: 'dias_atraso', rotulo: 'Dias de atraso', formato: 'int' },
      { campo: 'status', rotulo: 'Status', formato: 'texto' },
      { campo: 'custo_mes', rotulo: 'Custo do mês', formato: 'brl' },
      { campo: 'resultado', rotulo: 'Resultado', formato: 'brl' },
      { campo: 'margem', rotulo: 'Margem', formato: 'pct' },
    ],
    guia: 'Uma linha por mês. Você só digita a NF e o que recebeu; o resto vem da medição.',
  },
  atas: {
    id: 'atas', titulo: '15 · Atas de reunião (5W2H)', aba: '15', tabela: 'op_ata', pk: 'id',
    colecao: 'atas', ordem: 'data', ordemDesc: true,
    campos: [
      { campo: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
      { campo: 'hora', rotulo: 'Hora', tipo: 'hora' },
      { campo: 'tipo', rotulo: 'Tipo de reunião', tipo: 'texto' },
      { campo: 'local', rotulo: 'Local', tipo: 'texto', soFormulario: true },
      { campo: 'participantes_wcr', rotulo: 'Participantes WCR', tipo: 'texto', soFormulario: true },
      { campo: 'participantes_ext', rotulo: 'Participantes externos', tipo: 'texto', soFormulario: true },
      { campo: 'assunto', rotulo: 'Assunto', tipo: 'texto' },
      { campo: 'falado', rotulo: 'O que foi falado', tipo: 'memo', soFormulario: true },
      { campo: 'decisao', rotulo: 'Decisão tomada', tipo: 'memo', soFormulario: true },
      { campo: 'pendencia', rotulo: 'O QUÊ (pendência / ação)', tipo: 'memo' },
      { campo: 'responsavel', rotulo: 'QUEM (responsável)', tipo: 'texto' },
      { campo: 'prazo', rotulo: 'QUANDO (prazo)', tipo: 'data' },
      { campo: 'prioridade', rotulo: 'Prioridade', tipo: 'menu_fixo:URGENTE,ALTA,NORMAL,BAIXA' },
      { campo: 'status', rotulo: 'Status', tipo: 'menu_fixo:ABERTA,EM ANDAMENTO,CONCLUÍDA,CANCELADA' },
      { campo: 'porque', rotulo: 'POR QUÊ', tipo: 'memo', soFormulario: true },
      { campo: 'onde', rotulo: 'ONDE', tipo: 'texto', soFormulario: true },
      { campo: 'como', rotulo: 'COMO', tipo: 'memo', soFormulario: true },
      { campo: 'quanto', rotulo: 'QUANTO CUSTA', tipo: 'numero', soFormulario: true },
      { campo: 'gera_pleito', rotulo: 'Vira pleito?', tipo: SN, soFormulario: true },
      { campo: 'link_gravacao', rotulo: 'Link da gravação', tipo: 'texto', soFormulario: true },
      { campo: 'transcricao', rotulo: 'Transcrição completa', tipo: 'memo', soFormulario: true },
    ],
    calculadas: [
      { campo: 'n_ata', rotulo: 'Nº da ata', formato: 'texto' },
      { campo: 'dias_em_aberto', rotulo: 'Dias em aberto', formato: 'int' },
    ],
    guia: 'Uma linha por AÇÃO. Reuniões do mesmo dia ficam com o mesmo nº de ata.',
  },
  lookahead: {
    id: 'lookahead', titulo: '16 · Lookahead e restrições', aba: '16', tabela: 'op_lookahead', pk: 'id',
    colecao: 'lookaheads', ordem: 'semana', ordemDesc: true,
    campos: [
      { campo: 'semana', rotulo: 'Semana (2ª feira)', tipo: 'data', obrigatorio: true },
      { campo: 'servico_id', rotulo: 'ID do serviço', tipo: 'servico', obrigatorio: true },
      { campo: 'material_ok', rotulo: 'Material ok?', tipo: SN },
      { campo: 'equipamento_ok', rotulo: 'Equipamento ok?', tipo: SN },
      { campo: 'mao_de_obra_ok', rotulo: 'Mão de obra ok?', tipo: SN },
      { campo: 'os_emitida', rotulo: 'OS emitida?', tipo: SN },
      { campo: 'licenca_ok', rotulo: 'Licença / via ok?', tipo: SN },
      { campo: 'acesso_ok', rotulo: 'Acesso ok?', tipo: SN },
      { campo: 'responsavel', rotulo: 'Responsável p/ liberar', tipo: 'pessoa' },
      { campo: 'prazo', rotulo: 'Prazo p/ liberar', tipo: 'data' },
    ],
    calculadas: [
      { campo: 'pendencias', rotulo: 'Pendências', formato: 'int' },
      { campo: 'situacao', rotulo: 'Situação', formato: 'texto' },
    ],
    guia: 'O que vem nas próximas semanas e o que trava. Serviço com restrição não entra no plano da semana. "Virar restrição" leva a trava para o LPS.',
  },
  plano: {
    id: 'plano', titulo: '17 · Plano semanal e PPC', aba: '17', tabela: null, pk: 'id',
    colecao: 'plano', ordem: 'semana', ordemDesc: true,
    campos: [
      { campo: 'semana', rotulo: 'Semana (2ª feira)', tipo: 'data', obrigatorio: true },
      { campo: 'equipe', rotulo: 'Equipe', tipo: 'menu:EQUIPE' },
      { campo: 'op_servico_id', rotulo: 'ID do serviço', tipo: 'servico', obrigatorio: true },
      { campo: 'compromisso', rotulo: 'Compromisso', tipo: 'memo' },
      { campo: 'concluido', rotulo: 'Concluído?', tipo: SN },
      { campo: 'data_conclusao', rotulo: 'Data da conclusão', tipo: 'data' },
      { campo: 'causa_nc', rotulo: 'Causa de não cumprimento', tipo: 'menu:CAUSA_NC' },
      { campo: 'reprogramado_para', rotulo: 'Reprogramado para', tipo: 'data' },
      { campo: 'observacao', rotulo: 'Observação', tipo: 'memo', soFormulario: true },
    ],
    calculadas: [],
    guia: 'O que a equipe se comprometeu a entregar. Todo NÃO precisa de uma causa — é a causa que vira melhoria. Grava no LPS (lps_tasks), então aparece no quadro do Last Planner.',
  },
  parametros: {
    id: 'parametros', titulo: '01 · Parâmetros do contrato', aba: '01', tabela: 'op_parametros', pk: 'projeto_id',
    colecao: 'parametros', ordem: 'projeto_id',
    campos: [
      { campo: 'contrato_nome', rotulo: 'Contrato — nome curto', tipo: 'texto' },
      { campo: 'contrato_descricao', rotulo: 'Contrato — descrição', tipo: 'texto' },
      { campo: 'prefixo', rotulo: 'Prefixo do código (BER)', tipo: 'texto' },
      { campo: 'empresa', rotulo: 'Empresa executante', tipo: 'texto' },
      { campo: 'responsavel', rotulo: 'Responsável pelo contrato', tipo: 'texto' },
      { campo: 'coordenador', rotulo: 'Coordenador de operações', tipo: 'texto' },
      { campo: 'inicio_operacao', rotulo: 'Início da operação', tipo: 'data' },
      { campo: 'mes_referencia', rotulo: 'Mês de referência', tipo: 'data' },
      { campo: 'margem_alvo', rotulo: 'Margem-alvo (0,20 = 20%)', tipo: 'numero' },
      { campo: 'desconto_consorcio', rotulo: 'Desconto do consórcio (fração)', tipo: 'numero' },
      { campo: 'dia_fechamento', rotulo: 'Dia de fechamento', tipo: 'numero' },
      { campo: 'defasagem_recebimento', rotulo: 'Defasagem de recebimento (dias)', tipo: 'numero' },
      { campo: 'dias_uteis_mes', rotulo: 'Dias úteis por mês', tipo: 'numero' },
      { campo: 'jornada_h', rotulo: 'Jornada (h/dia)', tipo: 'numero' },
      { campo: 'prazo_padrao_dias', rotulo: 'Prazo padrão SABESP (dias)', tipo: 'numero' },
      { campo: 'alerta_prazo_dias', rotulo: 'Alerta de prazo (dias antes)', tipo: 'numero' },
      { campo: 'fator_encargos', rotulo: 'Fator de encargos (0,58)', tipo: 'numero' },
      { campo: 'beneficios_pessoa', rotulo: 'Benefícios por pessoa (R$/mês)', tipo: 'numero' },
      { campo: 'fonte_custo', rotulo: 'Fonte do custo', tipo: 'menu_fixo:op,fcp' },
    ],
    calculadas: [],
    guia: 'Mexe uma vez, no começo. Campo em branco fica "não informado" — nenhum número é inventado.',
  },
  custos: {
    id: 'custos', titulo: '01A · Banco de custos', aba: '01A', tabela: 'op_custo_item', pk: 'id',
    colecao: 'custos', ordem: 'ordem',
    campos: [
      { campo: 'item', rotulo: 'Item', tipo: 'texto', obrigatorio: true },
      { campo: 'qtd', rotulo: 'Qtd', tipo: 'numero' },
      { campo: 'valor_unit', rotulo: 'Valor unit.', tipo: 'numero' },
      { campo: 'fonte', rotulo: 'Fonte', tipo: 'texto' },
      { campo: 'ordem', rotulo: 'Ordem', tipo: 'numero', soFormulario: true },
    ],
    calculadas: [{ campo: 'total', rotulo: 'Total / mês', formato: 'brl' }],
    guia: 'A folha da equipe entra sozinha (aba 08). Aqui fica estrutura, frota e indiretos.',
  },
  tributos: {
    id: 'tributos', titulo: '01A · Tributos sobre a medição', aba: '01A', tabela: 'op_tributo', pk: 'id',
    colecao: 'tributos', ordem: 'ordem',
    campos: [
      { campo: 'nome', rotulo: 'Tributo', tipo: 'texto', obrigatorio: true },
      { campo: 'aliquota', rotulo: 'Alíquota (0,05 = 5%)', tipo: 'numero' },
      { campo: 'memoria', rotulo: 'Memória de cálculo', tipo: 'texto', soFormulario: true },
      { campo: 'fonte', rotulo: 'Fonte', tipo: 'texto', soFormulario: true },
      { campo: 'ordem', rotulo: 'Ordem', tipo: 'numero', soFormulario: true },
    ],
    calculadas: [],
    guia: 'A soma das alíquotas é o imposto usado no faturamento e nas metas.',
  },
  precos: {
    id: 'precos', titulo: '02 · Tabela de preços', aba: '02', tabela: 'op_preco', pk: 'id',
    colecao: 'precos', ordem: 'chave',
    campos: [
      { campo: 'chave', rotulo: 'Chave', tipo: 'texto', obrigatorio: true },
      { campo: 'grupo', rotulo: 'Grupo', tipo: 'texto' },
      { campo: 'item_sabesp', rotulo: 'Item SABESP', tipo: 'texto', soFormulario: true },
      { campo: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
      { campo: 'n_preco', rotulo: 'Nº preço', tipo: 'texto' },
      { campo: 'un', rotulo: 'Un', tipo: 'texto' },
      { campo: 'preco', rotulo: 'R$ unit.', tipo: 'numero' },
    ],
    calculadas: [],
    guia: 'Só muda em reajuste oficial do contrato.',
  },
}

// ─── cálculo por tela ───────────────────────────────────────────────────────

export function calcDaTela(id: TelaId, row: Record<string, unknown>, ctx: ContextoCalculo): Record<string, unknown> {
  const r = row as never
  switch (id) {
    case 'servicos': return { ...servicoCalc(r, ctx.idx, ctx.p, ctx.hoje) }
    case 'programacao': return { ...programacaoCalc(r) }
    case 'os': return { ...osCalc(r, ctx.idx) }
    case 'apontamento': return { ...apontamentoCalc(r, ctx) }
    case 'medicao': return { ...medicaoCalc(r, ctx.idx) }
    case 'ocorrencias': return { ...ocorrenciaCalc(r, ctx.hoje) }
    case 'faturamento': return { ...faturamentoCalc(r, ctx) }
    case 'atas': return { ...ataCalc(r, ctx.hoje) }
    case 'lookahead': return { ...lookaheadCalc(r) }
    case 'custos': {
      const c = row as { qtd: number | null; valor_unit: number | null }
      return { total: c.qtd === null || c.valor_unit === null ? null : c.qtd * c.valor_unit }
    }
    default: return {}
  }
}

// ─── menus ──────────────────────────────────────────────────────────────────

export interface Opcao { valor: string; rotulo: string }

const simples = (xs: string[]): Opcao[] => xs.map((x) => ({ valor: x, rotulo: x }))

export function opcoesDoCampo(tipo: TipoCampo, d: DadosOp): Opcao[] | null {
  if (tipo === 'sn' || tipo === 'bool') return simples(['SIM', 'NÃO'])
  if (tipo === 'snp') return simples(['SIM', 'NÃO', 'N/A'])
  if (tipo.startsWith('menu_fixo:')) return simples(tipo.slice(10).split(','))
  if (tipo === 'servico') {
    return d.servicos.filter((s) => !s.deleted_at)
      .sort((a, b) => b.codigo.localeCompare(a.codigo))
      .map((s) => ({ valor: s.id, rotulo: `${s.codigo}${s.endereco ? ` — ${s.endereco}${s.numero ? `, ${s.numero}` : ''}` : ''}` }))
  }
  if (tipo === 'preco') {
    return d.precos.filter((p) => !p.deleted_at)
      .sort((a, b) => a.chave.localeCompare(b.chave))
      .map((p) => ({ valor: p.chave, rotulo: `${p.chave} — ${p.descricao ?? ''}${p.un ? ` (${p.un})` : ''}` }))
  }
  if (tipo === 'pessoa') {
    const nomes = [...new Set(d.membros.filter((m) => !m.deleted_at && m.ativo !== false && m.pessoa_nome).map((m) => m.pessoa_nome!))]
    return simples(nomes.sort((a, b) => a.localeCompare(b)))
  }
  if (tipo.startsWith('menu:')) {
    const nome = tipo.slice(5)
    const daLista = d.listas.filter((l) => !l.deleted_at && l.nome === nome)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((l) => l.valor)
    const extras = nome === 'EQUIPE'
      ? d.membros.filter((m) => !m.deleted_at && m.equipe).map((m) => m.equipe!)
      : []
    return simples([...new Set([...daLista, ...extras])])
  }
  return null
}

// ─── entrada do formulário → valor gravável ─────────────────────────────────

/** '' vira null (vazio nunca é zero). Devolve { valor } ou { erro }. */
export function converterEntrada(bruto: string, tipo: TipoCampo): { valor: unknown } | { erro: string } {
  const s = bruto.trim()
  if (s === '') return { valor: null }
  if (tipo === 'numero') {
    const n = paraNumero(s)
    return n === null ? { erro: `"${s}" não é número` } : { valor: n }
  }
  if (tipo === 'data') {
    const iso = textoParaISO(s)
    return iso === null ? { erro: `"${s}" não é data válida` } : { valor: iso }
  }
  if (tipo === 'hora') {
    return /^\d{1,2}:\d{2}$/.test(s) ? { valor: s.padStart(5, '0') } : { erro: `"${s}" não é hora (HH:MM)` }
  }
  if (tipo === 'bool') {
    const sn = normSimNao(s)
    return sn === 'SIM' ? { valor: true } : sn === 'NÃO' ? { valor: false } : { erro: 'use SIM ou NÃO' }
  }
  if (tipo === 'sn' || tipo === 'snp') return { valor: normSimNao(s) }
  return { valor: textoOuNulo(s) }
}

/** valor do banco → texto do campo do formulário */
export function paraEntrada(v: unknown, tipo: TipoCampo): string {
  if (v === null || v === undefined) return ''
  if (tipo === 'bool') return v === true ? 'SIM' : v === false ? 'NÃO' : ''
  return String(v)
}

/** valor digitado exibido na tabela */
export function exibirCampo(v: unknown, tipo: TipoCampo, d: { servicoCodigo: (id: string) => string | null }): string {
  if (v === null || v === undefined || v === '') return '—'
  if (tipo === 'data') return dataBR(String(v))
  if (tipo === 'bool') return v === true ? 'SIM' : v === false ? 'NÃO' : '—'
  if (tipo === 'servico') return d.servicoCodigo(String(v)) ?? '(serviço excluído)'
  if (tipo === 'numero' && typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  return String(v)
}

export function formatarCalc(v: unknown, formato: FormatoCalc): string {
  if (v === null || v === undefined || v === '') return '—'
  switch (formato) {
    case 'brl': return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    case 'pct': return `${(Number(v) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`
    case 'data': return dataBR(String(v))
    case 'int': return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
    case 'num': return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    case 'bool': return v === true ? 'SIM' : 'NÃO'
    default: return String(v)
  }
}

export type LinhaTela = Record<string, unknown> & { id: string }

/** linhas vivas da tela, ordenadas como a planilha mostra */
export function linhasDaTela(tela: Tela, d: DadosOp): LinhaTela[] {
  if (tela.colecao === 'parametros') return d.parametros ? [{ ...(d.parametros as unknown as LinhaTela), id: d.parametros.projeto_id }] : []
  const xs = (d[tela.colecao] as unknown as LinhaTela[]).filter((x) => !x.deleted_at)
  const k = tela.ordem
  return [...xs].sort((a, b) => {
    const va = a[k] as string | number | null, vb = b[k] as string | number | null
    if (va === vb) return 0
    if (va === null || va === undefined) return 1
    if (vb === null || vb === undefined) return -1
    const c = va < vb ? -1 : 1
    return tela.ordemDesc ? -c : c
  })
}

/**
 * Ajustes de identidade antes de gravar o que veio do formulário:
 *   - faturamento: o mês é sempre o 1º dia (a tabela recusa outro dia);
 *   - lookahead / plano: a semana é sempre a 2ª feira (como a planilha pede).
 */
export function normalizarValores(id: TelaId, v: Record<string, unknown>): Record<string, unknown> {
  const out = { ...v }
  if (id === 'faturamento' && typeof out.mes === 'string') out.mes = inicioDoMes(out.mes as ISODate)
  if ((id === 'lookahead' || id === 'plano') && typeof out.semana === 'string') out.semana = segundaDaSemana(out.semana as ISODate)
  return out
}
