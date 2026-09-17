/**
 * rev16-mini.ts — uma CONTROLE OPERACIONAL rev16 em miniatura, montada em memória.
 *
 * ANONIMIZADA DE PROPÓSITO: a planilha real tem nomes e salários. Aqui só a ESTRUTURA
 * é copiada (nomes das abas com acento, cabeçalho na linha 4, dados a partir da 5,
 * coluna A como fórmula, células fixas da aba 01, seções da 01A, a linha de total da
 * aba 08…). Pessoas são "Pessoa 01…", endereços "Rua Fictícia N", salários redondos.
 *
 * Armadilhas reais reproduzidas:
 *   - ID do serviço é FÓRMULA na coluna A (ROW()−4) — o importador calcula;
 *   - uma célula de fórmula traz valor em cache (999) que NÃO pode entrar;
 *   - linha de serviço depois de 31 linhas vazias (deve ser ignorada e apontada);
 *   - item de medição sem CÓD. PREÇO; chave de preço repetida; texto explicativo no fim da 02;
 *   - "TOTAL DO QUADRO ATIVO" na aba 08 e "TOTAL DO CONTRATO" na 12;
 *   - contrato escrito "Bertioga" nas abas 06/10/11 e "BERTIOGA" na 01.
 */
import * as XLSX from 'xlsx'
import { isoParaSerial } from '../dominio/datas'

type Valor = string | number | null | { f: string; v?: string | number } | { data: string }

function celula(v: Valor): XLSX.CellObject | null {
  if (v === null) return null
  if (typeof v === 'string') return { t: 's', v }
  if (typeof v === 'number') return { t: 'n', v }
  if ('data' in v) return { t: 'n', v: isoParaSerial(v.data), z: 'dd/mm/yyyy' }
  const c: XLSX.CellObject = { t: typeof v.v === 'string' ? 's' : 'n', f: v.f }
  if (v.v !== undefined) c.v = v.v
  return c
}

class Aba {
  readonly ws: XLSX.WorkSheet = {}
  private maxR = 0
  private maxC = 0
  set(a1: string, v: Valor) {
    const { r, c } = XLSX.utils.decode_cell(a1)
    const cel = celula(v)
    if (cel) this.ws[a1] = cel
    else delete this.ws[a1]
    this.maxR = Math.max(this.maxR, r); this.maxC = Math.max(this.maxC, c)
  }
  linha(r: number, valores: Valor[], col0 = 0) {
    valores.forEach((v, i) => this.set(XLSX.utils.encode_cell({ r: r - 1, c: col0 + i }), v))
  }
  fechar(): XLSX.WorkSheet {
    this.ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: this.maxR, c: this.maxC } })
    return this.ws
  }
}

const d = (iso: string) => ({ data: iso })
const f = (formula: string, v?: string | number) => ({ f: formula, v })

export interface OpcoesFixture {
  /** esvazia uma linha da aba 03 (5 = BER-0001) — como apagar o conteúdo sem apagar a linha */
  limparServico?: number
  /** troca o endereço de uma linha da aba 03 */
  trocarEndereco?: { linha: number; endereco: string }
}

export const NOMES_ABAS = [
  'GUIA RÁPIDO', '00. LEIA-ME', '01. CONFIGURAÇÕES', '01A. BANCO DE CUSTOS', '01B. CARTEIRA E TICKET',
  '02. TABELA DE PREÇOS', '03. CADASTRO DE SERVIÇOS', '04. PROGRAMAÇÃO DIÁRIA', '05. ORDENS DE SERVIÇO',
  '06. APONTAMENTO DIÁRIO', '07. MATERIAIS', '08. EQUIPE', '09. MEDIÇÃO', '10. DIÁRIO DE OBRA',
  '11. OCORRÊNCIAS', '12. FATURAMENTO', '13. RESUMO GERENCIAL', '14. DASHBOARD', '15. ATAS DE REUNIÃO',
  '16. LOOKAHEAD E RESTRIÇÕES', '17. PLANO SEMANAL E PPC', '18. PLANEJADO x REALIZADO',
]

export const TOTAL_SERVICOS_MINI = 54

export function montarRev16Mini(o: OpcoesFixture = {}): XLSX.WorkBook {
  const abas = new Map<string, Aba>(NOMES_ABAS.map((n) => [n, new Aba()]))
  const A = (n: string) => abas.get(n)!
  for (const n of NOMES_ABAS) A(n).set('A1', `${n} — título`)

  // ── 01 CONFIGURAÇÕES ──────────────────────────────────────────────────────
  const c01 = A('01. CONFIGURAÇÕES')
  c01.set('A4', 'A · IDENTIFICAÇÃO')
  const rot: [string, string, Valor][] = [
    ['5', 'Empresa executante', 'Empresa Fictícia Ltda'],
    ['6', 'Responsável pelo contrato', 'Responsável Fictício'],
    ['7', 'Coordenador de operações', 'Coordenador Fictício'],
    ['8', 'Contrato 1 — nome curto', 'BERTIOGA'],
    ['9', 'Contrato 1 — descrição', 'Contrato fictício 1'],
    ['10', 'Contrato 2 — nome curto', 'SANTOS'],
    ['11', 'Contrato 2 — descrição', 'Contrato fictício 2'],
    ['12', 'Início da operação', d('2026-08-31')],
    ['13', 'Mês de referência atual', d('2026-09-01')],
    ['16', 'Imposto sobre a nota (%)', f("'01A. BANCO DE CUSTOS'!$C$34", 0.22)],
    ['17', 'Desconto do consórcio (%)', 0],
    ['18', 'Dia de fechamento da medição', 30],
    ['19', 'Defasagem de recebimento (dias)', 20],
    ['20', 'Dias úteis por mês', 22],
    ['21', 'Jornada normal (h/dia)', 8.8],
    ['22', 'Prazo padrão SABESP (dias)', 5],
    ['23', 'Alerta de prazo — dias antes', 2],
    ['24', 'Nº de equipes — BERTIOGA', f('SUMPRODUCT(1)', 2)],
  ]
  for (const [r, b, c] of rot) { c01.set(`B${r}`, b); c01.set(`C${r}`, c) }
  c01.set('B33', 'Margem-alvo do cenário adotado'); c01.set('C33', 0.2); c01.set('D33', 0.2)
  const listas: [string, string, string[]][] = [
    ['A', 'CONTRATO', ['BERTIOGA', 'SANTOS']],
    ['B', 'EQUIPE', ['BER-A', 'BER-B', 'SAN-A']],
    ['C', 'PRIORIDADE', ['EMERGENCIAL', 'ALTA', 'NORMAL']],
    ['D', 'TIPO', ['Troca de ramal de água', 'Vazamento de água visível — rede', 'Religação']],
    ['E', 'STATUS_CAD', ['CADASTRADO', 'CANCELADO']],
    ['J', 'MOTIVO_NE', ['Falta de material', 'Chuva']],
    ['R', 'SN', ['SIM', 'NÃO']],
    ['Z', 'CAUSA_NC', ['Falta de material', 'Chuva / clima']],
  ]
  for (const [col, nome, valores] of listas) {
    c01.set(`${col}43`, nome)
    valores.forEach((v, i) => c01.set(`${col}${44 + i}`, v))
  }

  // ── 01A BANCO DE CUSTOS ───────────────────────────────────────────────────
  const c1a = A('01A. BANCO DE CUSTOS')
  c1a.set('A1', 'BANCO DE CUSTOS, ENCARGOS E TRIBUTOS — ITEM A ITEM')
  const blocoCusto = (r0: number, contrato: string, itens: [string, number, number][]) => {
    c1a.set(`A${r0}`, `CUSTO MENSAL — ${contrato}`)
    c1a.linha(r0 + 1, ['ITEM', 'QTD', 'VALOR UNIT.', 'TOTAL / MÊS', 'FONTE'], 1)
    itens.forEach(([item, q, v], i) => c1a.linha(r0 + 2 + i, [item, q, v, f(`C${r0 + 2 + i}*D${r0 + 2 + i}`), 'fictício'], 1))
    const rf = r0 + 2 + itens.length
    c1a.linha(rf, ['Equipe de campo — folha, encargos e benefícios', f('COUNTIFS(EQP_CONTR,"X")', 5), f('IF(C1=0,0,E1/C1)'), f('SUMIFS(EQP_CUSTOMES)')], 1)
    c1a.linha(rf + 1, [`TOTAL MENSAL — ${contrato}`, null, null, f('SUM(E1:E2)')], 1)
    return rf + 3
  }
  let r = blocoCusto(4, 'BERTIOGA', [['Engenheiro residente', 1, 10000], ['Caminhão tipo HR', 2, 5000], ['Alojamento', 1, 8000]])
  r = blocoCusto(r, 'SANTOS', [['Engenheiro residente', 1, 10000], ['Alojamento', 1, 6000]])
  c1a.set(`A${r}`, 'C · ENCARGOS E BENEFÍCIOS — BASE DA FOLHA')
  c1a.linha(r + 1, ['PARÂMETRO', 'VALOR'], 1)
  c1a.linha(r + 2, ['Fator de encargos sobre o salário', 0.58], 1)
  c1a.linha(r + 3, ['Benefícios por pessoa', 1000], 1)
  c1a.linha(r + 4, ['Conferência — folha original', 12345], 1)
  r += 6
  c1a.set(`A${r}`, 'D · TRIBUTOS SOBRE A MEDIÇÃO — Lucro Presumido')
  c1a.linha(r + 1, ['TRIBUTO', 'ALÍQUOTA', 'UN', 'MEMÓRIA DE CÁLCULO', 'FONTE'], 1)
  const tributos: [string, number][] = [
    ['PIS', 0.0065], ['COFINS', 0.03], ['IRPJ', 0.048], ['Adicional de IRPJ', 0.01], ['CSLL', 0.0288],
    ['ISS', 0.05], ['Retenção de INSS sobre cessão de mão de obra', 0.0467],
  ]
  tributos.forEach(([n, a], i) => c1a.linha(r + 2 + i, [n, a, '%', 'fictício', 'lei'], 1))
  c1a.linha(r + 2 + tributos.length, ['TOTAL DE TRIBUTOS SOBRE A MEDIÇÃO', f('SUM(C1:C7)', 0.22)], 1)

  // ── 02 TABELA DE PREÇOS ───────────────────────────────────────────────────
  const c02 = A('02. TABELA DE PREÇOS')
  c02.linha(4, ['CHAVE', 'CONTRATO', 'GRUPO', 'ITEM SABESP', 'DESCRIÇÃO DO SERVIÇO', 'N. PREÇO', 'UN', 'R$ UNIT.', 'BUSCA'])
  c02.set('O4', 'Só muda em reajuste oficial do contrato.')
  const precos: Valor[][] = [
    ['BER-72000044', 'BERTIOGA', 'Troca de ramal', null, 'TROCA DE RAMAL ATÉ 32MM (fictício)', '72000044', 'un', 785.07],
    ['BER-72000053', 'BERTIOGA', 'Ligação', null, 'LIGAÇÃO NOVA (fictício)', '72000053', 'un', 612.4],
    ['BER-72001226', 'BERTIOGA', 'Reposição', null, 'REPOSIÇÃO DE PASSEIO (fictício)', '72001226', 'M', 16.33],
    ['SAN-72000044', 'SANTOS', 'Troca de ramal', null, 'TROCA DE RAMAL (fictício)', '72000044', 'un', 845],
    ['SAN-72000591', 'SANTOS', 'Esgoto', null, 'ESCAVAÇÃO (fictício)', '72000591', 'M3', 120.5],
    ['BER-72000044', 'BERTIOGA', 'Troca de ramal', null, 'TROCA DE RAMAL ATÉ 32MM (fictício)', '72000044', 'un', 785.07],
  ]
  precos.forEach((p, i) => c02.linha(5 + i, [...p, f('IF($K$2="","",1)')]))
  c02.set('A13', 'COMO ESCOLHER O ITEM — DICIONÁRIO DOS CÓDIGOS')

  // ── 03 CADASTRO DE SERVIÇOS ───────────────────────────────────────────────
  const c03 = A('03. CADASTRO DE SERVIÇOS')
  c03.linha(4, ['ID', 'CONTRATO', 'Nº OS SABESP', 'DATA DA SOLICITAÇÃO', 'PRAZO (dias)', 'DATA LIMITE', 'PRIORIDADE',
    'TIPO DE SERVIÇO', 'ENDEREÇO', 'Nº', 'BAIRRO', 'CIDADE', 'PONTO DE REFERÊNCIA', 'PAVIMENTO',
    'DESCRIÇÃO DA SOLICITAÇÃO', 'EQUIPE DESIGNADA', 'DATA PROGRAMADA', 'DATA DE EXECUÇÃO', 'STATUS',
    'DIAS EM ABERTO', 'SITUAÇÃO DO PRAZO', 'VALOR MEDIDO', 'TRATATIVA MANUAL', 'OBSERVAÇÃO'])
  c03.set('AA4', 'B = BERTIOGA ou SANTOS (menu)')   // coluna de ajuda depois do vão
  const tipos = ['Troca de ramal de água', 'Vazamento de água visível — rede', 'Religação']
  for (let i = 1; i <= TOTAL_SERVICOS_MINI; i++) {
    const lin = i + 4
    const semData = i > 50       // como na real: as últimas linhas vieram sem data
    const dia = String(1 + ((i - 1) % 14)).padStart(2, '0')
    c03.linha(lin, [
      f(`IF($B${lin}="","",LEFT($B${lin},3)&"-"&TEXT(ROW()-4,"0000"))`, `BER-${String(i).padStart(4, '0')}`),
      'BERTIOGA', null, semData ? null : d(`2026-09-${dia}`), 5, f(`IF($D${lin}="","",$D${lin}+5)`),
      ['NORMAL', 'ALTA', 'EMERGENCIAL'][i % 3], tipos[i % 3], `Rua Fictícia ${i}`, String(10 + i), 'Centro', 'Bertioga',
      null, null, 'Descrição fictícia', f('IFERROR(1,"")'), f('IFERROR(1,"")'), f('IFERROR(1,"")'), f('IF(1,"CADASTRADO")', 'CADASTRADO'),
      f('TODAY()-$D5', 3), f('IF(1,"EM DIA")'), f('SUMIFS(MED_VLR,MED_ID,$A5)', 0), null, null,
    ])
  }
  // fórmula numa coluna DIGITADA, com valor em cache: não pode virar observação
  c03.set('X5', f('CONCATENATE("VALOR"," DE FÓRMULA")', 'VALOR DE FÓRMULA'))
  // R DATA DE EXECUÇÃO é fórmula; digitada por cima em duas linhas (como na planilha preenchida):
  // BER-0003 igual à conclusão da OS (03/09) e BER-0004 diferente (OS concluiu 04/09)
  c03.set('R7', d('2026-09-03'))
  c03.set('R8', d('2026-09-05'))
  // linhas-modelo só com CONTRATO (59…61): a planilha mostra como CADASTRADO, mas não são serviço
  for (let lin = 59; lin <= 61; lin++) c03.linha(lin, [f(`IF($B${lin}="","",1)`), 'BERTIOGA'])
  // 31 linhas vazias (62…92) e uma linha perdida na 93: não pode entrar
  c03.linha(93, [f('IF($B93="","",1)'), 'BERTIOGA', null, d('2026-09-10'), 5, null, 'NORMAL', 'Religação', 'Rua Depois do Limite', '1'])
  if (o.limparServico) {
    for (let c = 1; c < 24; c++) c03.set(XLSX.utils.encode_cell({ r: o.limparServico - 1, c }), null)
  }
  if (o.trocarEndereco) c03.set(`I${o.trocarEndereco.linha}`, o.trocarEndereco.endereco)

  // ── 04 PROGRAMAÇÃO DIÁRIA ─────────────────────────────────────────────────
  const c04 = A('04. PROGRAMAÇÃO DIÁRIA')
  c04.linha(4, ['DATA', 'CONTRATO', 'EQUIPE', 'SEQ', 'ID DO SERVIÇO', 'TIPO DE SERVIÇO', 'ENDEREÇO', 'BAIRRO',
    'PRIORIDADE', 'DATA LIMITE', 'H PREVISTAS', 'EXECUTOU?', 'DATA DE EXECUÇÃO', 'MOTIVO DA NÃO EXECUÇÃO',
    'REPROGRAMAR PARA', 'STATUS DO ITEM', 'ADERÊNCIA', 'OBSERVAÇÃO'])
  for (let i = 1; i <= 10; i++) {
    const lin = i + 4, dia = String(i).padStart(2, '0'), exec = i !== 7
    c04.linha(lin, [
      d(`2026-09-${dia}`), f('IFERROR(VLOOKUP(1),"")', 'BERTIOGA'), i <= 5 ? 'BER-A' : null, 1, `BER-${String(i).padStart(4, '0')}`,
      f('X'), f('X'), f('X'), f('X'), f('X'), 8, exec ? 'SIM' : 'NÃO', exec ? d(`2026-09-${dia}`) : null,
      exec ? null : 'Chuva', null, f('IF(1,"EXECUTADO")'), f('IF(1,"NO DIA")'), null,
    ])
  }

  // ── 05 ORDENS DE SERVIÇO ──────────────────────────────────────────────────
  const c05 = A('05. ORDENS DE SERVIÇO')
  c05.linha(4, ['ID DO SERVIÇO', 'CONTRATO', 'Nº OS SABESP', 'ENDEREÇO', 'BAIRRO', 'TIPO DE SERVIÇO', 'EQUIPE',
    'ENCARREGADO', 'DATA DE INÍCIO', 'DATA DE CONCLUSÃO', 'DIAS', 'PROFUNDIDADE (m)', 'EXTENSÃO (m)',
    'PAVIMENTO REPOSTO?', 'FOTO ANTES', 'FOTO DEPOIS', 'Nº DO RDO', 'Nº ITENS MEDIDOS', 'VALOR DA OS',
    'MÊS DE MEDIÇÃO', 'STATUS DA OS', 'PENDÊNCIA / OBSERVAÇÃO'])
  for (let i = 1; i <= 8; i++) {
    const dia = String(i).padStart(2, '0')
    c05.linha(i + 4, [
      `BER-${String(i).padStart(4, '0')}`, f('X'), f('X'), f('X'), f('X'), f('X'), 'BER-A', 'Encarregado Fictício',
      d(`2026-09-${dia}`), i <= 6 ? d(`2026-09-${dia}`) : null, f('X'), null, null, 'SIM', 'SIM', 'SIM', null,
      f('X'), f('X'), f('X'), f('X'), i <= 6 ? 'Serviço concluído (fictício)' : null,
    ])
  }

  // ── 06 APONTAMENTO DIÁRIO ─────────────────────────────────────────────────
  const c06 = A('06. APONTAMENTO DIÁRIO')
  c06.linha(4, ['DATA', 'DIA', 'SEMANA', 'CONTRATO', 'EQUIPE', 'Nº PESSOAS', 'H NORMAIS', 'H EXTRAS', 'HH TOTAL',
    'RETRO (h)', 'CAM 3/4 + MUNCK (h)', 'CAMINHÃO HR (h)', 'COMPRESSOR (h)', 'ROMPEDOR (h)', 'BOMBA (h)',
    'KM RODADO', 'SERV. PROGRAMADOS', 'SERV. EXECUTADOS', 'ADERÊNCIA', 'VALOR PRODUZIDO', 'META R$ DO DIA',
    'ATINGIMENTO', 'CUSTO DA EQUIPE', 'RESULTADO DO DIA', 'R$ POR HH', 'STATUS DO DIA', 'MOTIVO DE PARADA', 'OBSERVAÇÃO'])
  for (let i = 1; i <= 3; i++) {
    c06.linha(i + 4, [
      d(`2026-09-0${i}`), f('CHOOSE(1)'), f('"S"&1'), 'Bertioga', 'BER-A', 4, 8, null, f('F5*(G5+H5)'), 2, 1, 3,
      null, null, null, null, f('X'), f('X'), f('X'), f('X'), f('X'), f('X'), f('X'), f('X'), f('X'), null, null, 'Dia normal (fictício)',
    ])
  }

  // ── 07 MATERIAIS (vazia, como a real) ─────────────────────────────────────
  A('07. MATERIAIS').linha(4, ['DATA', 'CONTRATO', 'MOVIMENTO', 'ID DO SERVIÇO / OS', 'MATERIAL', 'UN', 'QUANTIDADE',
    'ENTRADA', 'SAÍDA', 'CUSTO UNIT.', 'CUSTO TOTAL', 'RESPONSÁVEL', 'FORNECEDOR / ORIGEM', 'NF / DOCUMENTO',
    'MATERIAL DA SABESP?', 'OBSERVAÇÃO'])

  // ── 08 EQUIPE ─────────────────────────────────────────────────────────────
  const c08 = A('08. EQUIPE')
  c08.linha(4, ['MATRÍCULA', 'CONTRATO', 'EQUIPE', 'NOME', 'FUNÇÃO', 'ADMISSÃO', 'SALÁRIO', 'ENCARGOS (fórmula)',
    'BENEFÍCIOS (fórmula)', 'CUSTO / MÊS', 'CUSTO / DIA', 'CUSTO / HORA', 'ASO', 'NR-06 (EPI)', 'NR-10', 'NR-18',
    'NR-33 (CONFINADO)', 'NR-35 (ALTURA)', 'CNH', 'ALERTA', 'ATIVO?'])
  const pessoas: [number, string, string, number, string | null, string][] = [
    // fora de ordem de propósito (na planilha preenchida as linhas foram reordenadas)
    [6, 'APOIO', 'Programador', 3500, '2027-02-01', 'SIM'],
    [1, 'BER-A', 'Encarregado de Obras', 4000, '2027-03-01', 'SIM'],
    [2, 'BER-A', 'Encanador', 3000, '2026-09-01', 'SIM'],          // ASO vencido
    [3, 'BER-A', 'Ajudante Geral', 2500, '2026-10-01', 'SIM'],     // vence em 30 dias
    [5, 'BER-B', 'Ajudante Geral', 2000, '2027-01-15', 'NÃO'],
    [4, 'BER-B', 'Encanador', 3000, null, 'SIM'],
  ]
  pessoas.forEach(([n, eq, funcao, sal, aso, ativo], i) => {
    const lin = i + 5
    c08.linha(lin, [
      `BER-00${n}`, 'BERTIOGA', eq, `Pessoa 0${n}`, funcao, d('2026-08-24'), sal,
      f(`ROUND(G${lin}*ENC_FATOR,2)`), f('BEN_PESSOA'), f(`SUM(G${lin}:I${lin})`), f('X'), f('X'),
      aso ? d(aso) : null, null, null, null, null, null, null, f('IF(1,"OK")'), ativo,
    ])
  })
  // caixa de instruções na coluna X, embaralhada junto com as linhas: tem que ser ignorada
  c08.set('X4', 'A = matrícula (BER-001)')
  c08.set('X5', 'G = salário')
  c08.set('X6', 'D = nome completo')
  c08.set('X7', 'U = ATIVO? SIM ou NÃO (menu)')
  c08.linha(15, [null, null, f('COUNTIFS($U$5:$U$60,"SIM")&" pessoas"'), 'TOTAL DO QUADRO ATIVO', null, null, f('SUMIFS(G5:G60)')])

  // ── 09 MEDIÇÃO ────────────────────────────────────────────────────────────
  const c09 = A('09. MEDIÇÃO')
  c09.linha(4, ['Nº BOLETIM', 'MÊS DE MEDIÇÃO', 'ID DO SERVIÇO', 'CONTRATO', 'Nº OS SABESP', 'EQUIPE',
    'DATA DE EXECUÇÃO', 'CÓD. PREÇO (CHAVE)', 'DESCRIÇÃO DO ITEM', 'UN', 'QTD', 'PREÇO UNIT.', 'VALOR',
    'STATUS DA MEDIÇÃO', 'DATA DE APRESENTAÇÃO', 'VALOR GLOSADO', 'MOTIVO DA GLOSA', 'VALOR APROVADO',
    'REAPRESENTAR?', 'OBSERVAÇÃO'])
  const med: [string, string | null, number | null, number | null, string, Valor][] = [
    ['BER-0001', null, null, null, 'BM-09/2026', f('X')],                 // ID + boletim sem código e sem QTD: "sem item"
    ['BER-0002', 'BER-72000044', 1, null, 'BM-09/2026', f('X')],
    ['BER-0002', 'BER-72001226', 12.5, null, 'BM-09/2026', f('X')],
    ['BER-0003', 'BER-72000044', 1, null, 'BM-09/2027', f('X')],          // boletim do ano seguinte ao da execução
    ['BER-0004', 'BER-72000044', 1, 999, 'BM-09/2026', f('X')],           // VALOR em cache (999) numa fórmula: ignorar
    ['BER-0004', 'BER-72000044', 1, null, 'BM-09/2026', d('2026-09-05')], // mesmo par (2ª ordem) + G digitada ≠ OS (04/09)
    ['BER-0005', null, 1, null, 'BM-09/2026', f('X')],                    // QTD sem código de preço
  ]
  med.forEach(([sid, cod, qtd, cache, bm, g], i) => {
    const lin = i + 5
    c09.linha(lin, [
      bm, f(`IF($G${lin}="","",EOMONTH($G${lin},0))`), sid, f('X'), f('X'), f('X'), g, cod,
      f('X'), f('X'), qtd, f('X'), f(`IF($H${lin}="","",ROUND($K${lin}*$L${lin},2))`, cache ?? undefined),
      i === 1 ? 'PREVISTA' : null, null, null, null, f(`IF($H${lin}="","",$M${lin}-$P${lin})`), null, null,
    ])
  })

  // ── 10 DIÁRIO DE OBRA ─────────────────────────────────────────────────────
  const c10 = A('10. DIÁRIO DE OBRA')
  c10.linha(4, ['Nº DO RDO', 'DATA', 'CONTRATO', 'CLIMA MANHÃ', 'CLIMA TARDE', 'CONDIÇÃO DO SOLO', 'EFETIVO EM CAMPO',
    'EQUIPES EM CAMPO', 'HH DO DIA', 'SERVIÇOS EXECUTADOS', 'VALOR PRODUZIDO', 'ATIVIDADES DO DIA',
    'EQUIPAMENTOS MOBILIZADOS', 'OCORRÊNCIAS DO DIA', 'VISITA DA FISCALIZAÇÃO', 'RESPONSÁVEL WCR', 'OBSERVAÇÃO'])
  for (let i = 1; i <= 2; i++) {
    c10.linha(i + 4, [f('X'), d(`2026-09-0${i}`), 'Bertioga', 'BOM', 'BOM', 'SECO', f('X'), f('X'), f('X'), f('X'), f('X'),
      'Atividades fictícias', null, f('X'), null, 'Responsável Fictício', null])
  }

  // ── 11 OCORRÊNCIAS ────────────────────────────────────────────────────────
  const c11 = A('11. OCORRÊNCIAS')
  c11.linha(4, ['Nº', 'DATA', 'CONTRATO', 'ID DO SERVIÇO / OS', 'EQUIPE', 'TIPO DE OCORRÊNCIA', 'GRAVIDADE',
    'DESCRIÇÃO DO FATO', 'IMPACTO (h)', 'CUSTO ESTIMADO', 'AÇÃO IMEDIATA TOMADA', 'RESPONSÁVEL', 'PRAZO', 'STATUS',
    'DATA DE ENCERRAMENTO', 'DIAS EM ABERTO', 'GERA PLEITO / ADITIVO?'])
  c11.linha(5, [f('ROW()-4'), d('2026-09-02'), 'Bertioga', null, null, 'Chuva', 'BAIXA', 'Chuva forte (fictício)', 2, null,
    'Paralisação', 'Encarregado Fictício', 'imediato', 'Feito', d('2026-09-02'), f('X'), null])
  // "Nº" (A) é fórmula; nesta linha foi digitado por cima, como na planilha preenchida
  c11.linha(6, [2, d('2026-09-02'), 'Bertioga', null, null, 'Falta de ferramentas', 'MÉDIA', 'Faltou serra (fictício)', 1, null,
    'Compra', 'Encarregado Fictício', null, 'ABERTA', null, f('X'), null])

  // ── 12 FATURAMENTO ────────────────────────────────────────────────────────
  const c12 = A('12. FATURAMENTO')
  c12.linha(4, ['MÊS', 'CONTRATO', 'MEDIÇÃO BRUTA', 'GLOSA', 'MEDIÇÃO APROVADA', 'Nº DA NF', 'DATA DA NF', 'IMPOSTO',
    'DESCONTO DO CONSÓRCIO', 'VALOR LÍQUIDO', 'RECEBIMENTO PREVISTO', 'DATA DO RECEBIMENTO', 'VALOR RECEBIDO',
    'DIFERENÇA', 'DIAS DE ATRASO', 'STATUS', 'CUSTO DO MÊS', 'RESULTADO', 'MARGEM'])
  const meses: [string, string][] = [['2026-08-31', 'BERTIOGA'], ['2026-08-31', 'SANTOS'], ['2026-09-30', 'BERTIOGA'], ['2026-09-30', 'SANTOS']]
  meses.forEach(([m, c], i) => c12.linha(i + 5, [d(m), c, f('SUMIFS(MED_VLR)'), f('X'), f('X'), null, null, f('X')]))
  c12.set('B10', 'TOTAL DO CONTRATO')

  // ── 15 ATAS ───────────────────────────────────────────────────────────────
  const c15 = A('15. ATAS DE REUNIÃO')
  c15.linha(4, ['Nº DA ATA', 'DATA', 'HORA', 'TIPO DE REUNIÃO', 'CONTRATO', 'LOCAL / PLATAFORMA', 'PARTICIPANTES WCR',
    'PARTICIPANTES EXTERNOS', 'ASSUNTO', 'O QUE FOI FALADO', 'DECISÃO TOMADA', 'PENDÊNCIA / AÇÃO', 'RESPONSÁVEL',
    'PRAZO', 'PRIORIDADE', 'STATUS', 'DIAS EM ABERTO', 'VIRA PLEITO / ADITIVO?', 'LINK DA GRAVAÇÃO',
    'TRANSCRIÇÃO COMPLETA', 'POR QUE (motivo)', 'ONDE (local / aba)', 'COMO (como será feito)', 'QUANTO CUSTA (R$)'])
  const atas: [string, string][] = [['Programação', 'Comprar material'], ['Programação', 'Revisar rota'], ['Segurança', 'Renovar ASO']]
  atas.forEach(([assunto, acao], i) => c15.linha(i + 5, [
    f('"ATA-"&TEXT(B5,"yyyymmdd")'), d('2026-09-15'), null, 'Reunião semanal', 'BERTIOGA', 'Escritório', 'Pessoa 01', null,
    assunto, 'Conversa fictícia', 'Decisão fictícia', acao, 'Pessoa 02', d('2026-09-20'), 'ALTA', 'ABERTA', f('X'),
  ]))

  // ── 16 e 17 (uma linha cada; a real está vazia) ───────────────────────────
  const c16 = A('16. LOOKAHEAD E RESTRIÇÕES')
  c16.linha(4, ['SEMANA (2ª feira)', 'CONTRATO', 'ID DO SERVIÇO', 'TIPO DE SERVIÇO', 'ENDEREÇO', 'PRAZO SABESP',
    'MATERIAL OK?', 'EQUIPAMENTO OK?', 'MÃO DE OBRA OK?', 'OS EMITIDA?', 'LICENÇA / VIA OK?', 'ACESSO OK?',
    'RESTRIÇÕES PENDENTES', 'SITUAÇÃO', 'RESPONSÁVEL P/ LIBERAR', 'PRAZO P/ LIBERAR'])
  c16.linha(5, [d('2026-09-07'), 'BERTIOGA', 'BER-0009', f('X'), f('X'), f('X'), 'NÃO', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM',
    f('COUNTIF(G5:L5,"NÃO")', 1), f('X'), 'Pessoa 01', d('2026-09-09')])
  const c17 = A('17. PLANO SEMANAL E PPC')
  c17.linha(4, ['SEMANA (2ª feira)', 'CONTRATO', 'EQUIPE', 'ID DO SERVIÇO', 'TIPO DE SERVIÇO', 'ENDEREÇO',
    'COMPROMISSO (o que entregar)', 'CONCLUÍDO?', 'DATA DA CONCLUSÃO', 'CAUSA DE NÃO CUMPRIMENTO',
    'REPROGRAMADO PARA', 'OBSERVAÇÃO'])
  c17.set('N4', 'PPC POR SEMANA')
  c17.linha(5, [d('2026-08-31'), 'BERTIOGA', 'BER-A', 'BER-0001', f('X'), f('X'), 'Concluir a troca de ramal', 'SIM', d('2026-09-01'), null, null, null])

  const wb = XLSX.utils.book_new()
  for (const n of NOMES_ABAS) XLSX.utils.book_append_sheet(wb, A(n).fechar(), n)
  return wb
}

/** a mesma planilha passada por escrita + leitura de .xlsx — exercita o caminho real do arquivo */
export function bufferRev16Mini(o: OpcoesFixture = {}): Uint8Array {
  return new Uint8Array(XLSX.write(montarRev16Mini(o), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
}

/** a planilha da ZN: mesmos prefixos de aba, outro conteúdo — tem que ser RECUSADA */
export function bufferZnMini(): Uint8Array {
  const nomes = ['GUIA RÁPIDO', '01. CONFIGURAÇÕES', '02. TABELA DE PREÇOS', '03. CARTEIRA DE REDE', '08. EQUIPE', '10. MEDIÇÃO']
  const wb = XLSX.utils.book_new()
  for (const n of nomes) {
    const a = new Aba()
    a.set('A1', n)
    if (n.startsWith('03')) a.linha(4, ['NÚCLEO', 'SISTEMA', 'MEDIÇÃO CONSÓRCIO', 'FOLHA', 'DN 200 / ÁGUA (m)'])
    if (n.startsWith('03')) a.linha(5, ['Núcleo Fictício', 'Água', '5', '10', '126.81'])
    if (n.startsWith('08')) a.linha(4, ['MATRÍCULA', 'FRENTE', 'NOME', 'FUNÇÃO'])
    if (n.startsWith('10')) a.linha(4, ['MÊS DO BOLETIM', 'Nº BOLETIM', 'NÚCLEO', 'SISTEMA'])
    XLSX.utils.book_append_sheet(wb, a.fechar(), n)
  }
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
}
