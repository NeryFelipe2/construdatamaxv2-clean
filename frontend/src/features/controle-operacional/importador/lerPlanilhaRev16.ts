/**
 * lerPlanilhaRev16.ts — lê o CONTROLE OPERACIONAL SABESP rev16. Porta do `app/importer.py`.
 *
 * REGRAS (as do importer.py, mais as do produto):
 *   - Só entra o que é DIGITADO. Célula com fórmula conta como VAZIA, mesmo que o
 *     arquivo tenha o valor calculado guardado — o cálculo é refeito em calculos.ts.
 *   - Colunas achadas pelo NOME do cabeçalho (linha 4), dados a partir da linha 5.
 *   - A leitura de uma aba para depois de 31 linhas seguidas com a chave vazia
 *     (mesma regra do app original). O que existir depois disso NÃO entra e é
 *     listado em `naoEntendidas` — nada some calado.
 *   - Aba 01 em células fixas (C5–C23, C33/D33), listas com o nome na linha 43 e
 *     valores de 44 a 89.
 *   - Aba 01A: o contrato de cada bloco de custos vem do TÍTULO da seção
 *     ("CUSTO MENSAL — BERTIOGA"), não da posição (o Python usava `r < 18`).
 *   - Vazio nunca é zero: célula em branco fica null; texto que não é número/data
 *     também fica null e gera aviso na linha.
 *
 * Não grava nada e não conhece o banco: devolve uma LEITURA que o reconciliar.ts
 * compara com o que já está no sistema.
 */
import * as XLSX from 'xlsx'
import type { WorkBook, WorkSheet } from 'xlsx'
import { abaPorPrefixo, verificarAssinatura, type Assinatura } from './assinatura'
import {
  normCabecalho, normChave, normContrato, normSimNao, paraNumero, textoOuNulo,
} from '../dominio/normalizar'
import { dataBR, fracaoParaHora, inicioDoMes, serialParaISO, textoParaISO } from '../dominio/datas'
import type { TipoVencimento } from '../dominio/tipos'

// ─── tipos da leitura ───────────────────────────────────────────────────────

export interface NaoEntendida {
  aba: string
  linha: number | null
  motivo: string
}

export interface LinhaLida<T> {
  /** linha na planilha (1-based, como o Excel mostra) */
  linha: number
  dados: T
  /** o que foi lido com ressalva (ex.: data inválida virou vazio) */
  avisos: string[]
}

export interface ContratoLido {
  nome: string
  descricao: string | null
  prefixo: string
  margem_alvo: number | null
}

export interface ParametrosLidos {
  empresa: string | null
  responsavel: string | null
  coordenador: string | null
  inicio_operacao: string | null
  mes_referencia: string | null
  desconto_consorcio: number | null
  dia_fechamento: number | null
  defasagem_recebimento: number | null
  dias_uteis_mes: number | null
  jornada_h: number | null
  prazo_padrao_dias: number | null
  alerta_prazo_dias: number | null
  fator_encargos: number | null
  beneficios_pessoa: number | null
}

export interface ListaLida { nome: string; valor: string; ordem: number }
export interface CustoLido { contrato: string; item: string; qtd: number | null; valor_unit: number | null; fonte: string | null; ordem: number }
export interface TributoLido { nome: string; aliquota: number | null; memoria: string | null; fonte: string | null; ordem: number }
export interface PrecoLido {
  contrato: string | null; chave: string; grupo: string | null; item_sabesp: string | null
  descricao: string | null; n_preco: string | null; un: string | null; preco: number | null
}
export interface ServicoLido {
  contrato: string; codigo: string; n_os_sabesp: string | null; data_solicitacao: string | null
  prazo_dias: number | null; prioridade: string | null; tipo: string | null; endereco: string | null
  numero: string | null; bairro: string | null; cidade: string | null; referencia: string | null
  pavimento: string | null; descricao: string | null; tratativa_manual: string | null; observacao: string | null
  /** coluna R é fórmula; só vem preenchida quando foi digitada por cima */
  data_execucao_digitada: string | null
}
export interface ProgramacaoLida {
  contrato: string | null; servico_codigo: string; data: string; equipe: string | null; seq: number | null
  h_previstas: number | null; executou: string | null; data_execucao: string | null
  motivo_nao_execucao: string | null; reprogramar_para: string | null; observacao: string | null
}
export interface OsLida {
  contrato: string | null; servico_codigo: string; equipe: string | null; encarregado: string | null
  data_inicio: string | null; data_conclusao: string | null; profundidade_m: number | null; extensao_m: number | null
  pavimento_reposto: string | null; foto_antes: string | null; foto_depois: string | null
  n_rdo: string | null; pendencia: string | null
}
export interface ApontamentoLido {
  contrato: string | null; data: string; equipe: string | null; n_pessoas: number | null; h_normais: number | null
  h_extras: number | null; retro_h: number | null; cam34_munck_h: number | null; caminhao_hr_h: number | null
  compressor_h: number | null; rompedor_h: number | null; bomba_h: number | null; km_rodado: number | null
  status_dia: string | null; motivo_parada: string | null; observacao: string | null
}
export interface MedicaoLida {
  contrato: string | null; servico_codigo: string; cod_preco: string; ordem: number; n_boletim: string | null
  qtd: number | null; status: string | null; data_apresentacao: string | null; valor_glosado: number | null
  motivo_glosa: string | null; reapresentar: string | null; observacao: string | null
  /** coluna G é fórmula (conclusão da OS); só vem preenchida quando foi digitada por cima */
  data_execucao_digitada: string | null
}
export interface FaturamentoLido {
  contrato: string; mes: string; n_nf: string | null; data_nf: string | null
  data_recebimento: string | null; valor_recebido: number | null
}
export interface AtaLida {
  contrato: string | null; data: string; hora: string | null; tipo: string | null; local: string | null
  participantes_wcr: string | null; participantes_ext: string | null; assunto: string | null; falado: string | null
  decisao: string | null; pendencia: string | null; responsavel: string | null; prazo: string | null
  prioridade: string | null; status: string | null; gera_pleito: string | null; link_gravacao: string | null
  transcricao: string | null; porque: string | null; onde: string | null; como: string | null
  quanto: number | null; ordem: number
}
export interface LookaheadLido {
  contrato: string | null; servico_codigo: string; semana: string; material_ok: string | null
  equipamento_ok: string | null; mao_de_obra_ok: string | null; os_emitida: string | null
  licenca_ok: string | null; acesso_ok: string | null; responsavel: string | null; prazo: string | null
}
export interface PlanoLido {
  contrato: string | null; servico_codigo: string; semana: string; equipe: string | null
  compromisso: string | null; concluido: string | null; data_conclusao: string | null
  causa_nc: string | null; reprogramado_para: string | null; observacao: string | null
}
export interface MembroLido {
  contrato: string | null; matricula: string | null; nome: string; equipe: string | null; funcao: string | null
  admissao: string | null; salario: number | null; ativo: boolean | null
  vencimentos: Partial<Record<TipoVencimento, string | null>>
}
export interface OcorrenciaLida {
  contrato: string | null; data: string; ordem: number; servico_codigo: string | null; equipe: string | null
  tipo: string | null; gravidade: string | null; descricao: string | null; impacto_h: number | null
  custo_estimado: number | null; acao: string | null; responsavel: string | null; prazo: string | null
  status: string | null; data_encerramento: string | null; gera_pleito: string | null
}
export interface PendenteLido {
  contrato: string | null; aba: '07' | '10'; chave: string; data: string | null; dados: Record<string, unknown>
}

export interface LeituraRev16 {
  modelo: 'rev16'
  contratos: ContratoLido[]
  parametros: ParametrosLidos
  listas: ListaLida[]
  custos: LinhaLida<CustoLido>[]
  tributos: LinhaLida<TributoLido>[]
  precos: LinhaLida<PrecoLido>[]
  servicos: LinhaLida<ServicoLido>[]
  programacoes: LinhaLida<ProgramacaoLida>[]
  ordens: LinhaLida<OsLida>[]
  apontamentos: LinhaLida<ApontamentoLido>[]
  medicoes: LinhaLida<MedicaoLida>[]
  faturamentos: LinhaLida<FaturamentoLido>[]
  atas: LinhaLida<AtaLida>[]
  lookaheads: LinhaLida<LookaheadLido>[]
  planos: LinhaLida<PlanoLido>[]
  membros: LinhaLida<MembroLido>[]
  ocorrencias: LinhaLida<OcorrenciaLida>[]
  pendentes: LinhaLida<PendenteLido>[]
  naoEntendidas: NaoEntendida[]
  avisos: string[]
  abasAusentes: string[]
}

// ─── leitura de célula ──────────────────────────────────────────────────────

type Cru = string | number | boolean | null

/** valor DIGITADO da célula (fórmula, vazio, texto em branco e "=..." viram null) */
function cru(ws: WorkSheet, r: number, c: number): Cru {
  const cel = ws[XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })] as XLSX.CellObject | undefined
  if (!cel || cel.f) return null
  if (cel.t === 'e' || cel.t === 'z') return null
  const v = cel.v
  if (v === undefined || v === null) return null
  if (typeof v === 'string') {
    const s = v.trim()
    return s === '' || s.startsWith('=') ? null : s
  }
  if (v instanceof Date) return null   // cellDates desligado; não deveria acontecer
  return v as number | boolean
}

function ultimaLinha(ws: WorkSheet): number {
  const ref = ws['!ref']
  return ref ? XLSX.utils.decode_range(ref).e.r + 1 : 0
}

function ultimaColuna(ws: WorkSheet): number {
  const ref = ws['!ref']
  return ref ? XLSX.utils.decode_range(ref).e.c + 1 : 0
}

class Leitor {
  constructor(readonly naoEntendidas: NaoEntendida[]) {}

  texto(v: Cru): string | null {
    if (v === null) return null
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v).replace('.', ',')
    return textoOuNulo(v)
  }

  numero(v: Cru, rotulo: string, avisos: string[]): number | null {
    if (v === null) return null
    if (typeof v === 'number') return v
    if (typeof v === 'boolean') { avisos.push(`${rotulo}: "${v}" não é número — ficou em branco`); return null }
    const n = paraNumero(v)
    if (n === null) avisos.push(`${rotulo}: "${v}" não é número — ficou em branco`)
    return n
  }

  data(v: Cru, rotulo: string, avisos: string[]): string | null {
    if (v === null) return null
    if (typeof v === 'number') {
      const iso = serialParaISO(v)
      if (iso === null) avisos.push(`${rotulo}: ${v} não é data — ficou em branco`)
      return iso
    }
    const iso = typeof v === 'string' ? textoParaISO(v) : null
    if (iso === null) avisos.push(`${rotulo}: "${v}" não é data válida — ficou em branco`)
    return iso
  }

  hora(v: Cru): string | null {
    if (v === null) return null
    if (typeof v === 'number') return fracaoParaHora(v)
    const s = String(v).trim()
    const m = /^(\d{1,2})[:h](\d{2})/.exec(s)
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : s.slice(0, 5)
  }
}

/** mapa CABEÇALHO NORMALIZADO → coluna, da linha 4 até o primeiro cabeçalho vazio */
function colunas(ws: WorkSheet, linha = 4): Map<string, number> {
  const out = new Map<string, number>()
  const max = ultimaColuna(ws)
  for (let c = 1; c <= max; c++) {
    const h = normCabecalho(cru(ws, linha, c))
    if (!h) break
    if (!out.has(h)) out.set(h, c)
  }
  return out
}

function acharColuna(cols: Map<string, number>, ...candidatos: string[]): number | null {
  for (const cand of candidatos) {
    const k = normCabecalho(cand)
    if (cols.has(k)) return cols.get(k)!
  }
  for (const cand of candidatos) {
    const k = normCabecalho(cand)
    for (const [h, c] of cols) if (h.startsWith(k)) return c
  }
  return null
}

interface AbaLida {
  nome: string
  ws: WorkSheet
  cols: Map<string, number>
  get: (r: number, ...candidatos: string[]) => Cru
}

function abrirAba(ws: WorkSheet, nome: string): AbaLida {
  const cols = colunas(ws)
  return {
    nome, ws, cols,
    get: (r, ...candidatos) => {
      const c = acharColuna(cols, ...candidatos)
      return c === null ? null : cru(ws, r, c)
    },
  }
}

/**
 * Colunas que na planilha são FÓRMULA. Valor digitado por cima delas não entra (o sistema
 * recalcula) e vira aviso na linha — exceto as datas de execução das abas 03 (R) e 09 (G),
 * que o sistema guarda como "digitada" porque a própria planilha passa a usar o valor.
 * Célula de fórmula com valor em cache tem `f` e já é lida como vazia; só o digitado chega aqui.
 */
const CALCULADAS: Record<string, string[]> = {
  '03': ['DATA LIMITE', 'EQUIPE DESIGNADA', 'DATA PROGRAMADA', 'STATUS', 'DIAS EM ABERTO', 'SITUAÇÃO DO PRAZO', 'VALOR MEDIDO'],
  '04': ['CONTRATO', 'TIPO DE SERVIÇO', 'ENDEREÇO', 'BAIRRO', 'PRIORIDADE', 'DATA LIMITE', 'STATUS DO ITEM', 'ADERÊNCIA'],
  '05': ['CONTRATO', 'Nº OS SABESP', 'ENDEREÇO', 'BAIRRO', 'TIPO DE SERVIÇO', 'DIAS', 'Nº ITENS MEDIDOS', 'VALOR DA OS', 'MÊS DE MEDIÇÃO', 'STATUS DA OS'],
  '06': ['DIA', 'SEMANA', 'HH TOTAL', 'SERV. PROGRAMADOS', 'SERV. EXECUTADOS', 'ADERÊNCIA', 'VALOR PRODUZIDO', 'META R$ DO DIA', 'ATINGIMENTO', 'CUSTO DA EQUIPE', 'RESULTADO DO DIA', 'R$ POR HH'],
  '08': ['ENCARGOS (fórmula)', 'BENEFÍCIOS (fórmula)', 'CUSTO / MÊS', 'CUSTO / DIA', 'CUSTO / HORA', 'ALERTA'],
  '09': ['MÊS DE MEDIÇÃO', 'CONTRATO', 'Nº OS SABESP', 'EQUIPE', 'DESCRIÇÃO DO ITEM', 'UN', 'PREÇO UNIT.', 'VALOR', 'VALOR APROVADO'],
  '10': ['Nº DO RDO', 'EFETIVO EM CAMPO', 'EQUIPES EM CAMPO', 'HH DO DIA', 'SERVIÇOS EXECUTADOS', 'VALOR PRODUZIDO', 'OCORRÊNCIAS DO DIA'],
  '11': ['Nº', 'DIAS EM ABERTO'],
  '12': ['MEDIÇÃO BRUTA', 'GLOSA', 'MEDIÇÃO APROVADA', 'IMPOSTO', 'DESCONTO DO CONSÓRCIO', 'VALOR LÍQUIDO', 'RECEBIMENTO PREVISTO', 'DIFERENÇA', 'DIAS DE ATRASO', 'STATUS', 'CUSTO DO MÊS', 'RESULTADO', 'MARGEM'],
  '15': ['Nº DA ATA', 'DIAS EM ABERTO'],
  '16': ['TIPO DE SERVIÇO', 'ENDEREÇO', 'PRAZO SABESP', 'RESTRIÇÕES PENDENTES', 'SITUAÇÃO'],
  '17': ['TIPO DE SERVIÇO', 'ENDEREÇO'],
}

function mostrarCru(v: Cru): string {
  if (typeof v === 'number' && v > 20000 && v < 80000 && Number.isInteger(v)) return dataBR(serialParaISO(v))
  return String(v).slice(0, 40)
}

/** aponta valor digitado por cima de coluna que é fórmula na planilha (ignorado) */
function digitadoSobreFormula(aba: AbaLida, codigo: string, r: number, avisos: string[]) {
  for (const h of CALCULADAS[codigo] ?? []) {
    const c = aba.cols.get(normCabecalho(h))
    if (c === undefined) continue
    const v = cru(aba.ws, r, c)
    if (v !== null) avisos.push(`coluna "${h}" é fórmula na planilha e tem valor digitado por cima (${mostrarCru(v)}) — ignorado: o sistema recalcula`)
  }
}

/** [48,49,50,53] → "48–50, 53" */
function faixaTexto(ns: number[]): string {
  const out: string[] = []
  let ini = ns[0], ant = ns[0]
  for (const n of [...ns.slice(1), NaN]) {
    if (n === ant + 1) { ant = n; continue }
    out.push(ini === ant ? String(ini) : `${ini}–${ant}`)
    ini = n; ant = n
  }
  return out.join(', ')
}

const LIMITE_VAZIAS = 30

/**
 * Linhas com chave preenchida, a partir da 5. Para depois de 31 vazias seguidas;
 * o que houver depois disso é apontado como não entendido (nunca some calado).
 * Linha com dados em outras colunas mas SEM a chave também é apontada.
 */
function linhasDeDados(aba: AbaLida, codigoAba: string, chave: string[], naoEntendidas: NaoEntendida[]): number[] {
  const cChave = acharColuna(aba.cols, ...chave)
  const colsDados = [...new Set(aba.cols.values())]
  const fim = ultimaLinha(aba.ws)
  const out: number[] = []
  if (cChave === null) {
    naoEntendidas.push({ aba: codigoAba, linha: 4, motivo: `a coluna "${chave[0]}" não está no cabeçalho da linha 4 — a aba não foi lida` })
    return out
  }
  const temAlgo = (r: number) => colsDados.some((c) => c !== cChave && cru(aba.ws, r, c) !== null)
  let vazias = 0, parouEm: number | null = null
  for (let r = 5; r <= fim; r++) {
    if (cru(aba.ws, r, cChave) === null) {
      vazias++
      if (vazias > LIMITE_VAZIAS) { parouEm = r; break }
      if (temAlgo(r)) {
        naoEntendidas.push({ aba: codigoAba, linha: r, motivo: `linha tem dados mas a coluna "${chave[0]}" está vazia — não entrou` })
      }
      continue
    }
    vazias = 0
    out.push(r)
  }
  if (parouEm !== null) {
    for (let r = parouEm; r <= fim; r++) {
      if (cru(aba.ws, r, cChave) !== null) {
        naoEntendidas.push({
          aba: codigoAba, linha: r,
          motivo: `linha depois de ${LIMITE_VAZIAS + 1} linhas vazias seguidas — a leitura para antes (regra do app original); não entrou`,
        })
      }
    }
  }
  return out
}

// ─── aba 01 ─────────────────────────────────────────────────────────────────

const ROTULOS_01: Record<string, string> = {
  B5: 'EMPRESA EXECUTANTE', B8: 'CONTRATO 1', B10: 'CONTRATO 2', B12: 'INICIO DA OPERACAO',
  B19: 'DEFASAGEM DE RECEBIMENTO', B20: 'DIAS UTEIS', B22: 'PRAZO PADRAO', B33: 'MARGEM-ALVO',
}

function lerConfiguracoes(ws: WorkSheet, L: Leitor, avisos: string[]): { contratos: ContratoLido[]; parametros: Omit<ParametrosLidos, 'fator_encargos' | 'beneficios_pessoa'>; listas: ListaLida[] } {
  const ne = L.naoEntendidas
  const at = (a1: string): Cru => {
    const { r, c } = XLSX.utils.decode_cell(a1)
    return cru(ws, r + 1, c + 1)
  }
  // confere o layout pelos rótulos da coluna B antes de confiar nas células fixas
  for (const [cel, esperado] of Object.entries(ROTULOS_01)) {
    const achado = normCabecalho(at(cel))
    if (!achado.startsWith(esperado)) {
      ne.push({ aba: '01', linha: Number(cel.slice(1)), motivo: `esperava o rótulo "${esperado}…" em ${cel} e achei "${achado || 'vazio'}" — confira se o layout da aba 01 mudou` })
    }
  }
  const av: string[] = []
  const contratos: ContratoLido[] = []
  for (const [cNome, cDesc, cMargem] of [['C8', 'C9', 'C33'], ['C10', 'C11', 'D33']]) {
    const nome = normContrato(L.texto(at(cNome)))
    if (!nome) {
      ne.push({ aba: '01', linha: Number(cNome.slice(1)), motivo: `contrato em ${cNome} está vazio` })
      continue
    }
    contratos.push({
      nome, descricao: L.texto(at(cDesc)), prefixo: nome.slice(0, 3),
      margem_alvo: L.numero(at(cMargem), `margem-alvo ${cMargem}`, av),
    })
  }
  const parametros = {
    empresa: L.texto(at('C5')),
    responsavel: L.texto(at('C6')),
    coordenador: L.texto(at('C7')),
    inicio_operacao: L.data(at('C12'), 'início da operação (C12)', av),
    mes_referencia: L.data(at('C13'), 'mês de referência (C13)', av),
    desconto_consorcio: L.numero(at('C17'), 'desconto do consórcio (C17)', av),
    dia_fechamento: L.numero(at('C18'), 'dia de fechamento (C18)', av),
    defasagem_recebimento: L.numero(at('C19'), 'defasagem (C19)', av),
    dias_uteis_mes: L.numero(at('C20'), 'dias úteis (C20)', av),
    jornada_h: L.numero(at('C21'), 'jornada (C21)', av),
    prazo_padrao_dias: L.numero(at('C22'), 'prazo padrão (C22)', av),
    alerta_prazo_dias: L.numero(at('C23'), 'alerta de prazo (C23)', av),
  }
  for (const a of av) avisos.push(`aba 01: ${a}`)

  const listas: ListaLida[] = []
  const maxC = ultimaColuna(ws)
  for (let c = 1; c <= maxC; c++) {
    const nome = normCabecalho(cru(ws, 43, c)).replace(/\s+/g, '_')
    if (!nome) continue
    const vistos = new Set<string>()
    for (let r = 44; r <= 89; r++) {
      const v = L.texto(cru(ws, r, c))
      if (v === null) continue
      const k = normChave(v)
      if (vistos.has(k)) continue
      vistos.add(k)
      listas.push({ nome, valor: v, ordem: r - 44 })
    }
  }
  return { contratos, parametros, listas }
}

// ─── aba 01A ────────────────────────────────────────────────────────────────

function lerCustos(ws: WorkSheet, L: Leitor, contratos: ContratoLido[]) {
  const ne = L.naoEntendidas
  const custos: LinhaLida<CustoLido>[] = []
  const tributos: LinhaLida<TributoLido>[] = []
  let fator_encargos: number | null = null, beneficios_pessoa: number | null = null
  let modo: 'custo' | 'encargos' | 'tributos' | null = null
  let contrato: string | null = null
  let ordem = 0
  const fim = ultimaLinha(ws)
  const conhecidos = new Set(contratos.map((c) => c.nome))

  for (let r = 1; r <= fim; r++) {
    const a = normCabecalho(cru(ws, r, 1))
    const bBruto = L.texto(cru(ws, r, 2))
    const b = normCabecalho(bBruto)

    // títulos de seção na coluna A
    if (a.startsWith('CUSTO MENSAL')) {
      const nome = normContrato(a.split(/[—–-]/).slice(1).join('-').trim())
      modo = 'custo'; ordem = 0
      contrato = nome && conhecidos.size > 0 && !conhecidos.has(nome) ? null : nome
      if (!contrato) ne.push({ aba: '01A', linha: r, motivo: `seção "${cru(ws, r, 1)}" não corresponde a nenhum contrato da aba 01 — itens ignorados` })
      continue
    }
    if (a.includes('ENCARGOS')) { modo = 'encargos'; contrato = null; continue }
    if (a.includes('TRIBUTOS')) { modo = 'tributos'; contrato = null; ordem = 0; continue }
    if (!b) continue

    if (modo === 'custo') {
      if (b === 'ITEM') continue
      if (b.startsWith('TOTAL MENSAL')) { modo = null; continue }
      if (!contrato) continue
      const cQtd = ws[XLSX.utils.encode_cell({ r: r - 1, c: 2 })], cVal = ws[XLSX.utils.encode_cell({ r: r - 1, c: 3 })]
      // a linha da folha é fórmula sobre a aba 08 — calculada, não digitada.
      // (arquivo salvo sem valor de fórmula nem traz a célula: por isso também o rótulo)
      if (cQtd?.f || cVal?.f) continue
      const av: string[] = []
      const qtd = L.numero(cru(ws, r, 3), 'QTD', av)
      const valor_unit = L.numero(cru(ws, r, 4), 'VALOR UNIT.', av)
      if (qtd === null && valor_unit === null && b.includes('FOLHA')) continue
      if (qtd === null && valor_unit === null) {
        ne.push({ aba: '01A', linha: r, motivo: `item "${bBruto}" sem QTD e sem VALOR UNIT. — não entrou` })
        continue
      }
      custos.push({ linha: r, avisos: av, dados: { contrato, item: bBruto!, qtd, valor_unit, fonte: L.texto(cru(ws, r, 6)), ordem: ordem++ } })
    } else if (modo === 'encargos') {
      if (b.startsWith('FATOR DE ENCARGOS')) fator_encargos = L.numero(cru(ws, r, 3), 'fator de encargos', [])
      else if (b.startsWith('BENEFICIOS POR PESSOA')) beneficios_pessoa = L.numero(cru(ws, r, 3), 'benefícios', [])
    } else if (modo === 'tributos') {
      if (b === 'TRIBUTO') continue
      if (b.startsWith('TOTAL')) { modo = null; continue }
      const av: string[] = []
      tributos.push({
        linha: r, avisos: av,
        dados: { nome: bBruto!, aliquota: L.numero(cru(ws, r, 3), 'ALÍQUOTA', av), memoria: L.texto(cru(ws, r, 5)), fonte: L.texto(cru(ws, r, 6)), ordem: ordem++ },
      })
    }
  }
  return { custos, tributos, fator_encargos, beneficios_pessoa }
}

// ─── leitura principal ──────────────────────────────────────────────────────

const PADRAO_CHAVE_PRECO = /^[A-Z]{3}-/

export function lerPlanilhaRev16(wb: WorkBook): LeituraRev16 {
  const naoEntendidas: NaoEntendida[] = []
  const avisos: string[] = []
  const abasAusentes: string[] = []
  const L = new Leitor(naoEntendidas)

  const aba = (prefixo: string, codigo: string): AbaLida | null => {
    const nome = abaPorPrefixo(wb, prefixo)
    if (!nome) { abasAusentes.push(codigo); return null }
    return abrirAba(wb.Sheets[nome], nome)
  }

  const leitura: LeituraRev16 = {
    modelo: 'rev16', contratos: [], parametros: {
      empresa: null, responsavel: null, coordenador: null, inicio_operacao: null, mes_referencia: null,
      desconto_consorcio: null, dia_fechamento: null, defasagem_recebimento: null, dias_uteis_mes: null,
      jornada_h: null, prazo_padrao_dias: null, alerta_prazo_dias: null, fator_encargos: null, beneficios_pessoa: null,
    },
    listas: [], custos: [], tributos: [], precos: [], servicos: [], programacoes: [], ordens: [],
    apontamentos: [], medicoes: [], faturamentos: [], atas: [], lookaheads: [], planos: [], membros: [],
    ocorrencias: [], pendentes: [], naoEntendidas, avisos, abasAusentes,
  }

  // 01 ─────────────────────────────────────────────────────────────────────
  const n01 = abaPorPrefixo(wb, '01. ')
  if (n01) {
    const r = lerConfiguracoes(wb.Sheets[n01], L, avisos)
    leitura.contratos = r.contratos
    Object.assign(leitura.parametros, r.parametros)
    leitura.listas = r.listas
  } else abasAusentes.push('01')

  const prefixos = new Map(leitura.contratos.map((c) => [c.prefixo, c.nome]))
  const contratoDoCodigo = (codigo: string | null): string | null => {
    if (!codigo) return null
    return prefixos.get(codigo.slice(0, 3).toUpperCase()) ?? null
  }

  // 01A ────────────────────────────────────────────────────────────────────
  const n01a = abaPorPrefixo(wb, '01A.')
  if (n01a) {
    const r = lerCustos(wb.Sheets[n01a], L, leitura.contratos)
    leitura.custos = r.custos
    leitura.tributos = r.tributos
    leitura.parametros.fator_encargos = r.fator_encargos
    leitura.parametros.beneficios_pessoa = r.beneficios_pessoa
  } else abasAusentes.push('01A')

  // 02 PREÇOS ──────────────────────────────────────────────────────────────
  const a02 = aba('02.', '02')
  if (a02) {
    const primeira = new Map<string, LinhaLida<PrecoLido>>()
    let repetidasIguais = 0
    for (const r of linhasDeDados(a02, '02', ['CHAVE'], naoEntendidas)) {
      const chave = L.texto(a02.get(r, 'CHAVE'))!.toUpperCase()
      if (!PADRAO_CHAVE_PRECO.test(chave)) {
        naoEntendidas.push({ aba: '02', linha: r, motivo: `"${L.texto(a02.get(r, 'CHAVE'))?.slice(0, 60)}" não é chave de preço (texto explicativo?) — não entrou` })
        continue
      }
      const av: string[] = []
      const dados: PrecoLido = {
        contrato: normContrato(L.texto(a02.get(r, 'CONTRATO'))) ?? contratoDoCodigo(chave),
        chave,
        grupo: L.texto(a02.get(r, 'GRUPO')),
        item_sabesp: L.texto(a02.get(r, 'ITEM SABESP')),
        descricao: L.texto(a02.get(r, 'DESCRIÇÃO DO SERVIÇO', 'DESCRIÇÃO')),
        n_preco: L.texto(a02.get(r, 'N. PREÇO', 'Nº PREÇO')),
        un: L.texto(a02.get(r, 'UN')),
        preco: L.numero(a02.get(r, 'R$ UNIT.', 'PREÇO'), 'R$ UNIT.', av),
      }
      const antes = primeira.get(chave)
      if (antes) {
        // o PROCV da planilha pega a PRIMEIRA ocorrência — fazemos igual e apontamos a diferença
        if (antes.dados.preco !== dados.preco || normChave(antes.dados.un) !== normChave(dados.un)) {
          naoEntendidas.push({
            aba: '02', linha: r,
            motivo: `chave ${chave} repetida com preço/unidade diferente (linha ${antes.linha}: ${antes.dados.preco ?? '—'} ${antes.dados.un ?? ''}; linha ${r}: ${dados.preco ?? '—'} ${dados.un ?? ''}) — valeu a primeira, como o PROCV da planilha`,
          })
        } else repetidasIguais++
        continue
      }
      const l = { linha: r, dados, avisos: av }
      primeira.set(chave, l)
      leitura.precos.push(l)
    }
    if (repetidasIguais) avisos.push(`aba 02: ${repetidasIguais} chave(s) repetida(s) com o mesmo preço — contadas uma vez`)
  }

  // 03 SERVIÇOS ────────────────────────────────────────────────────────────
  const a03 = aba('03.', '03')
  const contratoDoServico = new Map<string, string>()
  if (a03) {
    // colunas DIGITÁVEIS além do CONTRATO: se nenhuma tem valor, a linha é o modelo pré-preenchido
    const digitaveis03 = ['Nº OS SABESP', 'DATA DA SOLICITAÇÃO', 'PRAZO (dias)', 'PRIORIDADE', 'TIPO DE SERVIÇO', 'ENDEREÇO', 'Nº',
      'BAIRRO', 'CIDADE', 'PONTO DE REFERÊNCIA', 'PAVIMENTO', 'DESCRIÇÃO DA SOLICITAÇÃO', 'TRATATIVA MANUAL', 'OBSERVAÇÃO']
      .map((h) => a03.cols.get(normCabecalho(h))).filter((c): c is number => c !== undefined)
    const soModelo: number[] = []
    for (const r of linhasDeDados(a03, '03', ['CONTRATO'], naoEntendidas)) {
      if (!digitaveis03.some((c) => cru(a03.ws, r, c) !== null)) { soModelo.push(r); continue }
      const av: string[] = []
      const contrato = normContrato(L.texto(a03.get(r, 'CONTRATO')))!
      // coluna A é fórmula: LEFT(B;3) & "-" & TEXT(ROW()−4; "0000"). Se alguém digitou por cima, vale o digitado.
      const digitado = L.texto(a03.get(r, 'ID'))
      const formula = `${contrato.slice(0, 3)}-${String(r - 4).padStart(4, '0')}`
      const codigo = (digitado ?? formula).toUpperCase()
      if (digitado && digitado.toUpperCase() !== formula) av.push(`ID digitado por cima da fórmula (${digitado}; a fórmula daria ${formula}) — vale o digitado`)
      if (contratoDoServico.has(codigo)) {
        naoEntendidas.push({ aba: '03', linha: r, motivo: `ID ${codigo} repetido — só a primeira linha entrou` })
        continue
      }
      contratoDoServico.set(codigo, contrato)
      digitadoSobreFormula(a03, '03', r, av)
      const execDigitada = L.data(a03.get(r, 'DATA DE EXECUÇÃO'), 'data de execução', av)
      if (execDigitada) av.push(`DATA DE EXECUÇÃO (coluna R) é fórmula na planilha e foi digitada por cima (${dataBR(execDigitada)}) — vale o digitado`)
      leitura.servicos.push({
        linha: r, avisos: av,
        dados: {
          contrato, codigo,
          n_os_sabesp: L.texto(a03.get(r, 'Nº OS SABESP')),
          data_solicitacao: L.data(a03.get(r, 'DATA DA SOLICITAÇÃO'), 'data da solicitação', av),
          prazo_dias: L.numero(a03.get(r, 'PRAZO (dias)', 'PRAZO'), 'prazo', av),
          prioridade: L.texto(a03.get(r, 'PRIORIDADE')),
          tipo: L.texto(a03.get(r, 'TIPO DE SERVIÇO')),
          endereco: L.texto(a03.get(r, 'ENDEREÇO')),
          numero: L.texto(a03.get(r, 'Nº')),
          bairro: L.texto(a03.get(r, 'BAIRRO')),
          cidade: L.texto(a03.get(r, 'CIDADE')),
          referencia: L.texto(a03.get(r, 'PONTO DE REFERÊNCIA')),
          pavimento: L.texto(a03.get(r, 'PAVIMENTO')),
          descricao: L.texto(a03.get(r, 'DESCRIÇÃO DA SOLICITAÇÃO')),
          tratativa_manual: L.texto(a03.get(r, 'TRATATIVA MANUAL')),
          observacao: L.texto(a03.get(r, 'OBSERVAÇÃO')),
          data_execucao_digitada: execDigitada,
        },
      })
    }
    if (soModelo.length) {
      // a planilha mostra essas linhas como CADASTRADO (a fórmula do ID só olha o CONTRATO) — aqui não viram serviço
      naoEntendidas.push({
        aba: '03', linha: soModelo[0],
        motivo: `${soModelo.length} linha(s) só com CONTRATO preenchido (linhas ${faixaTexto(soModelo)}) — modelo vazio, não é serviço; não entraram`,
      })
    }
  }
  const contratoDe = (codigo: string | null) =>
    codigo ? (contratoDoServico.get(codigo) ?? contratoDoCodigo(codigo)) : null
  const codigoServico = (v: Cru) => {
    const s = L.texto(v)
    return s ? s.toUpperCase() : null
  }

  // 04 PROGRAMAÇÃO ─────────────────────────────────────────────────────────
  const a04 = aba('04.', '04')
  if (a04) {
    const vistas = new Set<string>()
    for (const r of linhasDeDados(a04, '04', ['DATA'], naoEntendidas)) {
      const av: string[] = []
      digitadoSobreFormula(a04, '04', r, av)
      const sid = codigoServico(a04.get(r, 'ID DO SERVIÇO'))
      const data = L.data(a04.get(r, 'DATA'), 'data', av)
      if (!sid || !data) {
        naoEntendidas.push({ aba: '04', linha: r, motivo: !sid ? 'programação sem ID DO SERVIÇO — não entrou' : `DATA inválida (${av.join('; ')}) — não entrou` })
        continue
      }
      const k = `${sid}|${data}`
      if (vistas.has(k)) { naoEntendidas.push({ aba: '04', linha: r, motivo: `${sid} programado duas vezes em ${data} — só a primeira entrou` }); continue }
      vistas.add(k)
      leitura.programacoes.push({
        linha: r, avisos: av,
        dados: {
          contrato: contratoDe(sid), servico_codigo: sid, data,
          equipe: L.texto(a04.get(r, 'EQUIPE')),
          seq: L.numero(a04.get(r, 'SEQ'), 'SEQ', av),
          h_previstas: L.numero(a04.get(r, 'H PREVISTAS'), 'H previstas', av),
          executou: normSimNao(L.texto(a04.get(r, 'EXECUTOU?'))),
          data_execucao: L.data(a04.get(r, 'DATA DE EXECUÇÃO'), 'data de execução', av),
          motivo_nao_execucao: L.texto(a04.get(r, 'MOTIVO DA NÃO EXECUÇÃO')),
          reprogramar_para: L.data(a04.get(r, 'REPROGRAMAR PARA'), 'reprogramar para', av),
          observacao: L.texto(a04.get(r, 'OBSERVAÇÃO')),
        },
      })
    }
  }

  // 05 OS ──────────────────────────────────────────────────────────────────
  const a05 = aba('05.', '05')
  if (a05) {
    const vistas = new Set<string>()
    for (const r of linhasDeDados(a05, '05', ['ID DO SERVIÇO'], naoEntendidas)) {
      const av: string[] = []
      digitadoSobreFormula(a05, '05', r, av)
      const sid = codigoServico(a05.get(r, 'ID DO SERVIÇO'))!
      if (vistas.has(sid)) { naoEntendidas.push({ aba: '05', linha: r, motivo: `OS de ${sid} repetida — só a primeira entrou (1 OS por serviço)` }); continue }
      vistas.add(sid)
      leitura.ordens.push({
        linha: r, avisos: av,
        dados: {
          contrato: contratoDe(sid), servico_codigo: sid,
          equipe: L.texto(a05.get(r, 'EQUIPE')),
          encarregado: L.texto(a05.get(r, 'ENCARREGADO')),
          data_inicio: L.data(a05.get(r, 'DATA DE INÍCIO'), 'data de início', av),
          data_conclusao: L.data(a05.get(r, 'DATA DE CONCLUSÃO'), 'data de conclusão', av),
          profundidade_m: L.numero(a05.get(r, 'PROFUNDIDADE'), 'profundidade', av),
          extensao_m: L.numero(a05.get(r, 'EXTENSÃO'), 'extensão', av),
          pavimento_reposto: normSimNao(L.texto(a05.get(r, 'PAVIMENTO REPOSTO?'))),
          foto_antes: normSimNao(L.texto(a05.get(r, 'FOTO ANTES'))),
          foto_depois: normSimNao(L.texto(a05.get(r, 'FOTO DEPOIS'))),
          n_rdo: L.texto(a05.get(r, 'Nº DO RDO')),
          pendencia: L.texto(a05.get(r, 'PENDÊNCIA')),
        },
      })
    }
  }

  // 06 APONTAMENTO ─────────────────────────────────────────────────────────
  const a06 = aba('06.', '06')
  if (a06) {
    const vistas = new Set<string>()
    for (const r of linhasDeDados(a06, '06', ['DATA'], naoEntendidas)) {
      const av: string[] = []
      digitadoSobreFormula(a06, '06', r, av)
      const data = L.data(a06.get(r, 'DATA'), 'data', av)
      if (!data) { naoEntendidas.push({ aba: '06', linha: r, motivo: `DATA inválida — não entrou` }); continue }
      const contrato = normContrato(L.texto(a06.get(r, 'CONTRATO')))
      const equipe = L.texto(a06.get(r, 'EQUIPE'))
      const k = `${contrato}|${data}|${normCabecalho(equipe)}`
      if (vistas.has(k)) {
        naoEntendidas.push({ aba: '06', linha: r, motivo: `apontamento repetido (${data}, equipe ${equipe ?? 'em branco'}) — só o primeiro entrou (1 linha = 1 equipe em 1 dia)` })
        continue
      }
      vistas.add(k)
      const n = (rot: string, ...c: string[]) => L.numero(a06.get(r, ...c), rot, av)
      leitura.apontamentos.push({
        linha: r, avisos: av,
        dados: {
          contrato, data, equipe,
          n_pessoas: n('Nº pessoas', 'Nº PESSOAS'), h_normais: n('H normais', 'H NORMAIS'), h_extras: n('H extras', 'H EXTRAS'),
          retro_h: n('retro', 'RETRO'), cam34_munck_h: n('cam 3/4', 'CAM 3/4'), caminhao_hr_h: n('caminhão HR', 'CAMINHÃO HR'),
          compressor_h: n('compressor', 'COMPRESSOR'), rompedor_h: n('rompedor', 'ROMPEDOR'), bomba_h: n('bomba', 'BOMBA'),
          km_rodado: n('km', 'KM RODADO'),
          status_dia: L.texto(a06.get(r, 'STATUS DO DIA')),
          motivo_parada: L.texto(a06.get(r, 'MOTIVO DE PARADA')),
          observacao: L.texto(a06.get(r, 'OBSERVAÇÃO')),
        },
      })
    }
  }

  // 07 MATERIAIS → pendente ────────────────────────────────────────────────
  const a07 = aba('07.', '07')
  if (a07) {
    const ordem = new Map<string, number>()
    for (const r of linhasDeDados(a07, '07', ['DATA'], naoEntendidas)) {
      const av: string[] = []
      const data = L.data(a07.get(r, 'DATA'), 'data', av)
      const dados: Record<string, unknown> = {}
      for (const [h, c] of a07.cols) { const v = cru(a07.ws, r, c); if (v !== null) dados[h] = v }
      const base = `${data ?? `L${r}`}|${normChave(L.texto(a07.get(r, 'MOVIMENTO')))}|${normChave(L.texto(a07.get(r, 'MATERIAL')))}`
      const n = (ordem.get(base) ?? 0) + 1; ordem.set(base, n)
      leitura.pendentes.push({ linha: r, avisos: av, dados: { contrato: normContrato(L.texto(a07.get(r, 'CONTRATO'))), aba: '07', chave: `${base}|${n}`, data, dados } })
    }
  }

  // 08 EQUIPE ──────────────────────────────────────────────────────────────
  const a08 = aba('08.', '08')
  if (a08) {
    const vistas = new Set<string>()
    for (const r of linhasDeDados(a08, '08', ['NOME'], naoEntendidas)) {
      const av: string[] = []
      digitadoSobreFormula(a08, '08', r, av)
      const nome = L.texto(a08.get(r, 'NOME'))!
      const matricula = L.texto(a08.get(r, 'MATRÍCULA'))
      const contrato = normContrato(L.texto(a08.get(r, 'CONTRATO')))
      if (!matricula && !contrato && normCabecalho(nome).startsWith('TOTAL')) {
        naoEntendidas.push({ aba: '08', linha: r, motivo: `"${nome}" é linha de total, não pessoa — não entrou` })
        continue
      }
      if (matricula && vistas.has(matricula.toUpperCase())) {
        naoEntendidas.push({ aba: '08', linha: r, motivo: `matrícula ${matricula} repetida — só a primeira entrou` })
        continue
      }
      if (matricula) vistas.add(matricula.toUpperCase())
      const ativoTxt = normSimNao(L.texto(a08.get(r, 'ATIVO?')))
      const venc = (rot: string, ...c: string[]) => L.data(a08.get(r, ...c), rot, av)
      leitura.membros.push({
        linha: r, avisos: av,
        dados: {
          contrato: contrato ?? contratoDoCodigo(matricula), matricula: matricula ? matricula.toUpperCase() : null, nome,
          equipe: L.texto(a08.get(r, 'EQUIPE')),
          funcao: L.texto(a08.get(r, 'FUNÇÃO')),
          admissao: L.data(a08.get(r, 'ADMISSÃO'), 'admissão', av),
          salario: L.numero(a08.get(r, 'SALÁRIO'), 'salário', av),
          ativo: ativoTxt === 'SIM' ? true : ativoTxt === 'NÃO' ? false : null,
          vencimentos: {
            ASO: venc('ASO', 'ASO'), NR06: venc('NR-06', 'NR-06'), NR10: venc('NR-10', 'NR-10'),
            NR18: venc('NR-18', 'NR-18'), NR33: venc('NR-33', 'NR-33'), NR35: venc('NR-35', 'NR-35'), CNH: venc('CNH', 'CNH'),
          },
        },
      })
    }
  }

  // 09 MEDIÇÃO ─────────────────────────────────────────────────────────────
  const a09 = aba('09.', '09')
  if (a09) {
    const ordem = new Map<string, number>()
    for (const r of linhasDeDados(a09, '09', ['ID DO SERVIÇO'], naoEntendidas)) {
      const av: string[] = []
      const sid = codigoServico(a09.get(r, 'ID DO SERVIÇO'))!
      const cod = L.texto(a09.get(r, 'CÓD. PREÇO'))?.toUpperCase() ?? null
      const qtdCru = a09.get(r, 'QTD')
      const boletim = L.texto(a09.get(r, 'Nº BOLETIM'))
      if (!cod && qtdCru === null) {
        // ID + boletim sem código e sem quantidade: não é item medido — nada gravado, nem R$ 0
        naoEntendidas.push({ aba: '09', linha: r, motivo: `sem item: ${sid}${boletim ? ` (${boletim})` : ''} não tem CÓD. PREÇO nem QTD — não é item de medição; nada gravado (nem R$ 0)` })
        continue
      }
      if (!cod) {
        naoEntendidas.push({ aba: '09', linha: r, motivo: `item de medição de ${sid} com QTD mas sem CÓD. PREÇO — sem código não há preço; não entrou` })
        continue
      }
      digitadoSobreFormula(a09, '09', r, av)
      // G DATA DE EXECUÇÃO é fórmula (conclusão da OS); digitada por cima, vale o digitado
      const execDigitada = L.data(a09.get(r, 'DATA DE EXECUÇÃO'), 'data de execução', av)
      if (execDigitada) av.push(`DATA DE EXECUÇÃO (coluna G) é fórmula na planilha e foi digitada por cima (${dataBR(execDigitada)}) — vale o digitado`)
      const k = `${sid}|${cod}`
      const n = (ordem.get(k) ?? 0) + 1; ordem.set(k, n)
      leitura.medicoes.push({
        linha: r, avisos: av,
        dados: {
          contrato: contratoDe(sid), servico_codigo: sid, cod_preco: cod, ordem: n,
          n_boletim: boletim,
          data_execucao_digitada: execDigitada,
          qtd: L.numero(qtdCru, 'QTD', av),
          status: L.texto(a09.get(r, 'STATUS DA MEDIÇÃO')),
          data_apresentacao: L.data(a09.get(r, 'DATA DE APRESENTAÇÃO'), 'data de apresentação', av),
          valor_glosado: L.numero(a09.get(r, 'VALOR GLOSADO'), 'valor glosado', av),
          motivo_glosa: L.texto(a09.get(r, 'MOTIVO DA GLOSA')),
          reapresentar: normSimNao(L.texto(a09.get(r, 'REAPRESENTAR?'))),
          observacao: L.texto(a09.get(r, 'OBSERVAÇÃO')),
        },
      })
    }
  }

  // 10 RDO → pendente (o RDO do sistema é /app/rdo) ────────────────────────
  const a10 = aba('10.', '10')
  if (a10) {
    const ordem = new Map<string, number>()
    for (const r of linhasDeDados(a10, '10', ['DATA'], naoEntendidas)) {
      const av: string[] = []
      digitadoSobreFormula(a10, '10', r, av)
      const data = L.data(a10.get(r, 'DATA'), 'data', av)
      const contrato = normContrato(L.texto(a10.get(r, 'CONTRATO')))
      const base = `${data ?? `L${r}`}`
      const n = (ordem.get(`${contrato}|${base}`) ?? 0) + 1; ordem.set(`${contrato}|${base}`, n)
      leitura.pendentes.push({
        linha: r, avisos: av,
        dados: {
          contrato, aba: '10', chave: `${base}|${n}`, data,
          dados: {
            data, clima_manha: L.texto(a10.get(r, 'CLIMA MANHÃ')), clima_tarde: L.texto(a10.get(r, 'CLIMA TARDE')),
            condicao_solo: L.texto(a10.get(r, 'CONDIÇÃO DO SOLO')), atividades: L.texto(a10.get(r, 'ATIVIDADES DO DIA')),
            equipamentos: L.texto(a10.get(r, 'EQUIPAMENTOS MOBILIZADOS')),
            visita_fiscalizacao: normSimNao(L.texto(a10.get(r, 'VISITA DA FISCALIZAÇÃO'))),
            responsavel: L.texto(a10.get(r, 'RESPONSÁVEL WCR')), observacao: L.texto(a10.get(r, 'OBSERVAÇÃO')),
          },
        },
      })
    }
  }

  // 11 OCORRÊNCIAS ─────────────────────────────────────────────────────────
  const a11 = aba('11.', '11')
  if (a11) {
    const ordem = new Map<string, number>()
    for (const r of linhasDeDados(a11, '11', ['DATA'], naoEntendidas)) {
      const av: string[] = []
      digitadoSobreFormula(a11, '11', r, av)
      const data = L.data(a11.get(r, 'DATA'), 'data', av)
      if (!data) { naoEntendidas.push({ aba: '11', linha: r, motivo: 'DATA inválida — não entrou' }); continue }
      const contrato = normContrato(L.texto(a11.get(r, 'CONTRATO')))
      const n = (ordem.get(`${contrato}|${data}`) ?? 0) + 1; ordem.set(`${contrato}|${data}`, n)
      const prazoCru = a11.get(r, 'PRAZO')
      leitura.ocorrencias.push({
        linha: r, avisos: av,
        dados: {
          contrato, data, ordem: n,
          servico_codigo: codigoServico(a11.get(r, 'ID DO SERVIÇO')),
          equipe: L.texto(a11.get(r, 'EQUIPE')),
          tipo: L.texto(a11.get(r, 'TIPO DE OCORRÊNCIA')),
          gravidade: L.texto(a11.get(r, 'GRAVIDADE')),
          descricao: L.texto(a11.get(r, 'DESCRIÇÃO DO FATO')),
          impacto_h: L.numero(a11.get(r, 'IMPACTO'), 'impacto', av),
          custo_estimado: L.numero(a11.get(r, 'CUSTO ESTIMADO'), 'custo estimado', av),
          acao: L.texto(a11.get(r, 'AÇÃO IMEDIATA TOMADA')),
          responsavel: L.texto(a11.get(r, 'RESPONSÁVEL')),
          // PRAZO aceita texto livre; se for data, guarda como ISO
          prazo: typeof prazoCru === 'number' ? serialParaISO(prazoCru) : L.texto(prazoCru),
          status: L.texto(a11.get(r, 'STATUS')),
          data_encerramento: L.data(a11.get(r, 'DATA DE ENCERRAMENTO'), 'data de encerramento', av),
          gera_pleito: normSimNao(L.texto(a11.get(r, 'GERA PLEITO'))),
        },
      })
    }
  }

  // 12 FATURAMENTO ─────────────────────────────────────────────────────────
  const a12 = aba('12.', '12')
  if (a12) {
    const vistas = new Set<string>()
    for (const r of linhasDeDados(a12, '12', ['MÊS'], naoEntendidas)) {
      const av: string[] = []
      digitadoSobreFormula(a12, '12', r, av)
      const mesData = L.data(a12.get(r, 'MÊS'), 'mês', av)
      const contrato = normContrato(L.texto(a12.get(r, 'CONTRATO')))
      if (!mesData || !contrato) {
        naoEntendidas.push({ aba: '12', linha: r, motivo: !mesData ? 'MÊS inválido — não entrou' : 'linha sem CONTRATO — não entrou' })
        continue
      }
      const mes = inicioDoMes(mesData)   // a planilha usa o último dia; o banco guarda o 1º
      if (vistas.has(`${contrato}|${mes}`)) { naoEntendidas.push({ aba: '12', linha: r, motivo: `${contrato} ${mes.slice(0, 7)} repetido — só o primeiro entrou` }); continue }
      vistas.add(`${contrato}|${mes}`)
      leitura.faturamentos.push({
        linha: r, avisos: av,
        dados: {
          contrato, mes,
          n_nf: L.texto(a12.get(r, 'Nº DA NF')),
          data_nf: L.data(a12.get(r, 'DATA DA NF'), 'data da NF', av),
          data_recebimento: L.data(a12.get(r, 'DATA DO RECEBIMENTO'), 'data do recebimento', av),
          valor_recebido: L.numero(a12.get(r, 'VALOR RECEBIDO'), 'valor recebido', av),
        },
      })
    }
  }

  // 15 ATAS ────────────────────────────────────────────────────────────────
  const a15 = aba('15.', '15')
  if (a15) {
    const ordem = new Map<string, number>()
    for (const r of linhasDeDados(a15, '15', ['DATA'], naoEntendidas)) {
      const av: string[] = []
      digitadoSobreFormula(a15, '15', r, av)
      const data = L.data(a15.get(r, 'DATA'), 'data', av)
      if (!data) { naoEntendidas.push({ aba: '15', linha: r, motivo: 'DATA inválida — não entrou' }); continue }
      const contrato = normContrato(L.texto(a15.get(r, 'CONTRATO')))
      const hora = L.hora(a15.get(r, 'HORA'))
      const assunto = L.texto(a15.get(r, 'ASSUNTO'))
      const base = `${contrato}|${data}|${hora ?? ''}|${normChave(assunto)}`
      const n = (ordem.get(base) ?? 0) + 1; ordem.set(base, n)
      leitura.atas.push({
        linha: r, avisos: av,
        dados: {
          contrato, data, hora, ordem: n, assunto,
          tipo: L.texto(a15.get(r, 'TIPO DE REUNIÃO')),
          local: L.texto(a15.get(r, 'LOCAL')),
          participantes_wcr: L.texto(a15.get(r, 'PARTICIPANTES WCR')),
          participantes_ext: L.texto(a15.get(r, 'PARTICIPANTES EXTERNOS')),
          falado: L.texto(a15.get(r, 'O QUE FOI FALADO')),
          decisao: L.texto(a15.get(r, 'DECISÃO')),
          pendencia: L.texto(a15.get(r, 'PENDÊNCIA')),
          responsavel: L.texto(a15.get(r, 'RESPONSÁVEL')),
          prazo: L.data(a15.get(r, 'PRAZO'), 'prazo', av),
          prioridade: L.texto(a15.get(r, 'PRIORIDADE')),
          status: L.texto(a15.get(r, 'STATUS')),
          gera_pleito: normSimNao(L.texto(a15.get(r, 'VIRA PLEITO'))),
          link_gravacao: L.texto(a15.get(r, 'LINK DA GRAVAÇÃO')),
          transcricao: L.texto(a15.get(r, 'TRANSCRIÇÃO')),
          porque: L.texto(a15.get(r, 'POR QUE')),
          onde: L.texto(a15.get(r, 'ONDE')),
          como: L.texto(a15.get(r, 'COMO')),
          quanto: L.numero(a15.get(r, 'QUANTO CUSTA'), 'quanto custa', av),
        },
      })
    }
  }

  // 16 LOOKAHEAD ───────────────────────────────────────────────────────────
  const a16 = aba('16.', '16')
  if (a16) {
    const vistas = new Set<string>()
    for (const r of linhasDeDados(a16, '16', ['ID DO SERVIÇO'], naoEntendidas)) {
      const av: string[] = []
      digitadoSobreFormula(a16, '16', r, av)
      const sid = codigoServico(a16.get(r, 'ID DO SERVIÇO'))!
      const semana = L.data(a16.get(r, 'SEMANA'), 'semana', av)
      if (!semana) { naoEntendidas.push({ aba: '16', linha: r, motivo: `lookahead de ${sid} sem SEMANA — não entrou` }); continue }
      if (vistas.has(`${sid}|${semana}`)) { naoEntendidas.push({ aba: '16', linha: r, motivo: `${sid} repetido na semana ${semana} — só o primeiro entrou` }); continue }
      vistas.add(`${sid}|${semana}`)
      const sn = (...c: string[]) => normSimNao(L.texto(a16.get(r, ...c)))
      leitura.lookaheads.push({
        linha: r, avisos: av,
        dados: {
          contrato: normContrato(L.texto(a16.get(r, 'CONTRATO'))) ?? contratoDe(sid), servico_codigo: sid, semana,
          material_ok: sn('MATERIAL OK?'), equipamento_ok: sn('EQUIPAMENTO OK?'), mao_de_obra_ok: sn('MÃO DE OBRA OK?'),
          os_emitida: sn('OS EMITIDA?'), licenca_ok: sn('LICENÇA'), acesso_ok: sn('ACESSO OK?'),
          responsavel: L.texto(a16.get(r, 'RESPONSÁVEL P/ LIBERAR')),
          prazo: L.data(a16.get(r, 'PRAZO P/ LIBERAR'), 'prazo p/ liberar', av),
        },
      })
    }
  }

  // 17 PLANO SEMANAL ───────────────────────────────────────────────────────
  const a17 = aba('17.', '17')
  if (a17) {
    const vistas = new Set<string>()
    for (const r of linhasDeDados(a17, '17', ['ID DO SERVIÇO'], naoEntendidas)) {
      const av: string[] = []
      digitadoSobreFormula(a17, '17', r, av)
      const sid = codigoServico(a17.get(r, 'ID DO SERVIÇO'))!
      const semana = L.data(a17.get(r, 'SEMANA'), 'semana', av)
      if (!semana) { naoEntendidas.push({ aba: '17', linha: r, motivo: `compromisso de ${sid} sem SEMANA — não entrou` }); continue }
      if (vistas.has(`${sid}|${semana}`)) { naoEntendidas.push({ aba: '17', linha: r, motivo: `${sid} repetido na semana ${semana} — só o primeiro entrou` }); continue }
      vistas.add(`${sid}|${semana}`)
      leitura.planos.push({
        linha: r, avisos: av,
        dados: {
          contrato: normContrato(L.texto(a17.get(r, 'CONTRATO'))) ?? contratoDe(sid), servico_codigo: sid, semana,
          equipe: L.texto(a17.get(r, 'EQUIPE')),
          compromisso: L.texto(a17.get(r, 'COMPROMISSO')),
          concluido: normSimNao(L.texto(a17.get(r, 'CONCLUÍDO?'))),
          data_conclusao: L.data(a17.get(r, 'DATA DA CONCLUSÃO'), 'data da conclusão', av),
          causa_nc: L.texto(a17.get(r, 'CAUSA DE NÃO CUMPRIMENTO')),
          reprogramado_para: L.data(a17.get(r, 'REPROGRAMADO PARA'), 'reprogramado para', av),
          observacao: L.texto(a17.get(r, 'OBSERVAÇÃO')),
        },
      })
    }
  }

  cruzarDatasDeExecucao(leitura)
  return leitura
}

/**
 * Depois de ler 03, 05 e 09: confere as datas digitadas por cima da fórmula contra a
 * conclusão da OS, e o ano do boletim contra o ano da execução. Não corrige nada —
 * importa como veio e AVISA.
 */
function cruzarDatasDeExecucao(l: LeituraRev16) {
  const conclusao = new Map<string, string | null>()
  for (const o of l.ordens) conclusao.set(o.dados.servico_codigo, o.dados.data_conclusao)
  const confere = (codigo: string, digitada: string, avisos: string[]) => {
    if (!conclusao.has(codigo)) avisos.push(`data de execução digitada (${dataBR(digitada)}) mas ${codigo} não tem OS na aba 05`)
    else if (!conclusao.get(codigo)) avisos.push(`data de execução digitada (${dataBR(digitada)}) mas a OS de ${codigo} não tem data de conclusão`)
    else if (conclusao.get(codigo) !== digitada) {
      avisos.push(`divergência: data de execução digitada ${dataBR(digitada)}, mas a OS de ${codigo} foi concluída em ${dataBR(conclusao.get(codigo))} — não identifiquei a causa; vale o digitado`)
    }
  }
  for (const s of l.servicos) if (s.dados.data_execucao_digitada) confere(s.dados.codigo, s.dados.data_execucao_digitada, s.avisos)
  for (const m of l.medicoes) {
    if (m.dados.data_execucao_digitada) confere(m.dados.servico_codigo, m.dados.data_execucao_digitada, m.avisos)
    const exec = m.dados.data_execucao_digitada ?? conclusao.get(m.dados.servico_codigo) ?? null
    const bm = /(\d{4})\s*$/.exec(m.dados.n_boletim ?? '')
    if (!bm || !exec) continue
    const anoBm = Number(bm[1]), anoExec = Number(exec.slice(0, 4))
    if (anoBm === anoExec + 1) {
      m.avisos.push(`boletim ${m.dados.n_boletim} é do ano seguinte ao da data de execução (${dataBR(exec)}) — importado como veio; confira`)
    } else if (anoBm !== anoExec) {
      m.avisos.push(`ano do boletim ${m.dados.n_boletim} (${anoBm}) difere do ano da data de execução (${dataBR(exec)}) — importado como veio; confira`)
    }
  }
}

/** todos os avisos de linha da leitura, com a aba de origem (para listar na prévia e no relatório) */
export function avisosDaLeitura(l: LeituraRev16): { aba: string; linha: number; mensagem: string }[] {
  const colecoes: [string, LinhaLida<unknown>[]][] = [
    ['01A', l.custos], ['01A', l.tributos], ['02', l.precos], ['03', l.servicos], ['04', l.programacoes],
    ['05', l.ordens], ['06', l.apontamentos], ['08', l.membros], ['09', l.medicoes], ['11', l.ocorrencias],
    ['12', l.faturamentos], ['15', l.atas], ['16', l.lookaheads], ['17', l.planos],
  ]
  const out: { aba: string; linha: number; mensagem: string }[] = []
  for (const [aba, col] of colecoes) for (const x of col) for (const m of x.avisos) out.push({ aba, linha: x.linha, mensagem: m })
  for (const p of l.pendentes) for (const m of p.avisos) out.push({ aba: p.dados.aba, linha: p.linha, mensagem: m })
  return out.sort((a, b) => a.aba.localeCompare(b.aba) || a.linha - b.linha)
}

// ─── entrada: arquivo → assinatura + leitura ────────────────────────────────

export interface ResultadoLeituraArquivo {
  assinatura: Assinatura
  leitura: LeituraRev16 | null
}

export function lerArquivoRev16(dados: ArrayBuffer | Uint8Array): ResultadoLeituraArquivo {
  const wb = XLSX.read(dados, { type: 'array', cellFormula: true, cellDates: false, cellNF: false, cellStyles: false })
  const assinatura = verificarAssinatura(wb)
  return { assinatura, leitura: assinatura.ok ? lerPlanilhaRev16(wb) : null }
}

/** contagem por aba, para o quadro "o que o arquivo trouxe" */
export function contagensDaLeitura(l: LeituraRev16): { aba: string; rotulo: string; n: number }[] {
  return [
    { aba: '01', rotulo: 'contratos', n: l.contratos.length },
    { aba: '01', rotulo: 'itens de lista', n: l.listas.length },
    { aba: '01A', rotulo: 'itens de custo', n: l.custos.length },
    { aba: '01A', rotulo: 'tributos', n: l.tributos.length },
    { aba: '02', rotulo: 'preços', n: l.precos.length },
    { aba: '03', rotulo: 'serviços', n: l.servicos.length },
    { aba: '04', rotulo: 'programações', n: l.programacoes.length },
    { aba: '05', rotulo: 'ordens de serviço', n: l.ordens.length },
    { aba: '06', rotulo: 'apontamentos', n: l.apontamentos.length },
    { aba: '07', rotulo: 'movimentos de material (guardados)', n: l.pendentes.filter((p) => p.dados.aba === '07').length },
    { aba: '08', rotulo: 'pessoas', n: l.membros.length },
    { aba: '09', rotulo: 'itens de medição', n: l.medicoes.length },
    { aba: '10', rotulo: 'RDOs (guardados)', n: l.pendentes.filter((p) => p.dados.aba === '10').length },
    { aba: '11', rotulo: 'ocorrências', n: l.ocorrencias.length },
    { aba: '12', rotulo: 'meses de faturamento', n: l.faturamentos.length },
    { aba: '15', rotulo: 'ações de ata', n: l.atas.length },
    { aba: '16', rotulo: 'itens de lookahead', n: l.lookaheads.length },
    { aba: '17', rotulo: 'compromissos do plano', n: l.planos.length },
  ]
}
