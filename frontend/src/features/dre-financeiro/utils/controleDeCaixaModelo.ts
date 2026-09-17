/**
 * A planilha modelo de Controle de Caixa — e a volta dela.
 *
 * ⚠️ **É este gerador que define o que o leitor espera, nunca o contrário.** Os nomes de coluna
 * daqui são os primeiros de cada lista em `CABECALHOS` (controleDeCaixaPlanilha.ts), então o que
 * o sistema escreve é sempre o que o sistema sabe ler.
 *
 * A coluna **ID** é a peça central. O modelo em branco sai com ela vazia; o que o sistema exporta
 * de volta sai com ela preenchida. A partir daí o casamento na reimportação é exato — a pessoa
 * pode mudar descrição, data, valor e ordem das linhas, e continua sendo o mesmo lançamento.
 * Sem ID, a identidade cai na heurística de conteúdo, que não sobrevive a mudança de descrição.
 *
 * O formato é o da planilha que a equipe já usa (dois blocos, receitas à esquerda e despesas à
 * direita), de propósito: quem abrir o modelo tem de reconhecer o próprio arquivo.
 */
import * as XLSX from 'xlsx'
import { fmtDataBR } from '@/lib/utils'
import type { FinanceiroEntry } from '@/types'

/** A ordem das colunas do modelo. Mudar aqui muda o que o leitor reconhece — leia o cabeçalho. */
export const COLUNAS_LANCAMENTOS = [
  'ID', 'ENTRADA', 'DATA', 'DESCRIÇÃO', 'VALOR', 'DATA DA DESPESA', 'SOLICITANTE',
  'CATEGORIA', 'OBRA', 'CONFERIDO',
] as const

const LARGURAS = [38, 12, 12, 48, 12, 16, 22, 18, 24, 12]

/** As categorias que a DRE sabe somar. Fora desta lista, o lançamento cai em "Outro". */
export const CATEGORIAS_DA_PLANILHA = {
  entrada: ['medicao', 'adiantamento', 'reajuste', 'outro'],
  saida: ['materiais', 'mao_de_obra', 'equipamentos', 'subempreiteiros', 'administrativo', 'outro'],
} as const

const ROTULO_CATEGORIA: Record<string, string> = {
  medicao: 'Medição', adiantamento: 'Adiantamento', reajuste: 'Reajuste',
  materiais: 'Materiais', mao_de_obra: 'Mão de obra', equipamentos: 'Equipamentos',
  subempreiteiros: 'Subempreiteiros', administrativo: 'Administrativo', outro: 'Outro',
}

export function rotuloDaCategoria(c: string | undefined): string {
  return c ? ROTULO_CATEGORIA[c] ?? c : ''
}

type Linha = (string | number)[]

/**
 * A aba de instruções.
 *
 * Existe porque a via principal de lançamento é a planilha: quem abre o arquivo pode não ter
 * aberto o sistema nunca. As três regras que mais causam retrabalho estão aqui, escritas.
 */
function abaComoUsar(): XLSX.WorkSheet {
  const linhas: Linha[] = [
    ['CONTROLE DE CAIXA — COMO USAR'],
    [],
    ['1.', 'Preencha a aba LANÇAMENTOS durante o mês, como você já faz.'],
    ['', 'Receitas nas colunas ENTRADA e DATA. Despesas em DESCRIÇÃO, VALOR, DATA DA DESPESA e SOLICITANTE.'],
    ['', 'Uma linha pode ter receita e despesa ao mesmo tempo — é o formato que a equipe já usa.'],
    [],
    ['2.', 'NÃO APAGUE nem edite a coluna ID.'],
    ['', 'É ela que faz o sistema reconhecer a linha na próxima importação, em vez de criar uma cópia.'],
    ['', 'Linha nova: deixe o ID em branco. O sistema preenche.'],
    [],
    ['3.', 'Jogue o arquivo no sistema quantas vezes quiser.'],
    ['', 'Financeiro → DRE e Resultado → Controle de Caixa → Importar planilha.'],
    ['', 'Antes de gravar, o sistema mostra o que vai mudar: novo, valor alterado, cadastro alterado.'],
    ['', 'Nada é gravado sem você confirmar. E nada é apagado — o que sumir da planilha é só apontado.'],
    [],
    ['4.', 'DATA aceita 06/07/2026 e também um período: 01 A 10/07/2026.'],
    ['', 'SOLICITANTE aceita mais de uma pessoa, separadas por barra: PESSOA F/PESSOA A.'],
    ['', 'CONFERIDO: escreva "Conferido" (ou OK) na linha já checada.'],
    [],
    ['5.', 'CATEGORIA — use um destes valores, para o lançamento entrar certo na DRE:'],
    ['', 'Receitas:', CATEGORIAS_DA_PLANILHA.entrada.map(rotuloDaCategoria).join(' · ')],
    ['', 'Despesas:', CATEGORIAS_DA_PLANILHA.saida.map(rotuloDaCategoria).join(' · ')],
    ['', 'Em branco, o lançamento entra como "Outro" — que quer dizer não classificado, não zero.'],
    [],
    ['6.', 'HORAS EXTRAS: uma linha por pessoa, uma coluna por dia, o valor na célula.'],
    ['', 'O valor NÃO é deduzido do cargo — quem manda é o que está escrito na célula.'],
    ['', 'Escreva PG na coluna de observação para a hora extra virar despesa no caixa.'],
    ['', 'Sem PG, ela fica registrada como prevista e NÃO entra no caixa.'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(linhas)
  ws['!cols'] = [{ wch: 5 }, { wch: 60 }, { wch: 70 }]
  return ws
}

/** Uma entry vira a linha da planilha. */
function linhaDaEntry(e: FinanceiroEntry): Linha {
  const ehEntrada = e.tipo === 'entrada'
  return [
    e.id,
    ehEntrada ? e.valor : '',
    ehEntrada ? fmtDataBR(e.data) : '',
    e.descricao,
    ehEntrada ? '' : e.valor,
    ehEntrada ? '' : (e.dataFim ? `${fmtDataBR(e.data).slice(0, 2)} A ${fmtDataBR(e.dataFim)}` : fmtDataBR(e.data)),
    (e.solicitantes ?? []).join('/'),
    rotuloDaCategoria(e.categoria),
    '',
    e.conferido ? 'Conferido' : '',
  ]
}

function abaLancamentos(entries: FinanceiroEntry[]): XLSX.WorkSheet {
  const corpo = [...entries]
    .sort((a, b) => a.data.localeCompare(b.data) || a.descricao.localeCompare(b.descricao, 'pt-BR'))
    .map(linhaDaEntry)

  // Linhas em branco para a equipe continuar preenchendo, com o ID vazio — é o que sinaliza
  // "linha nova" na próxima importação.
  const EM_BRANCO = 40
  for (let i = 0; i < EM_BRANCO; i++) corpo.push(COLUNAS_LANCAMENTOS.map(() => ''))

  const receitas = entries.filter((e) => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0)
  const despesas = entries.filter((e) => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0)
  corpo.push(['', receitas, '', '', despesas, 'SALDO==>>', receitas - despesas, '', '', ''])

  const ws = XLSX.utils.aoa_to_sheet([[...COLUNAS_LANCAMENTOS], ...corpo])
  ws['!cols'] = LARGURAS.map((wch) => ({ wch }))

  // Dinheiro com duas casas; o ID forçado a texto para o Excel não mexer nele.
  for (let r = 1; r <= corpo.length; r++) {
    for (const c of [1, 4, 6]) {
      const cel = ws[XLSX.utils.encode_cell({ r, c })]
      if (cel && typeof cel.v === 'number') cel.z = '#,##0.00'
    }
    const id = ws[XLSX.utils.encode_cell({ r, c: 0 })]
    if (id && id.v !== '') { id.t = 's'; id.z = '@' }
  }
  return ws
}

/**
 * A grade de horas extras: uma linha por pessoa, uma coluna por dia.
 *
 * Os dias saem dos fins de semana do mês, que é quando a hora extra acontece na obra do cliente —
 * mas a grade aceita qualquer dia na volta, porque o leitor lê o cabeçalho, não um calendário.
 */
export function fimDeSemanaDoMes(mes: number, ano: number): number[] {
  const dias: number[] = []
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  for (let d = 1; d <= ultimo; d++) {
    const semana = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay()
    if (semana === 0 || semana === 6) dias.push(d)
  }
  return dias
}

function abaHorasExtras(
  pessoas: Array<{ nome: string; cargo?: string }>,
  mes: number,
  ano: number,
): XLSX.WorkSheet {
  const dias = fimDeSemanaDoMes(mes, ano)
  const primeiros = dias.slice(0, 2)
  const rotuloObs = primeiros.length === 2
    ? `OBS. DIAS ${String(primeiros[0]).padStart(2, '0')} E ${String(primeiros[1]).padStart(2, '0')}`
    : 'OBS.'

  // A coluna de observação entra logo depois dos dois primeiros dias, como no arquivo do cliente.
  const cabecalho: Linha = ['NOME', 'Cargo']
  for (const d of dias.slice(0, 2)) cabecalho.push(String(d).padStart(2, '0'))
  cabecalho.push(rotuloObs)
  for (const d of dias.slice(2)) cabecalho.push(String(d).padStart(2, '0'))

  const corpo: Linha[] = [...pessoas]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((p) => [p.nome, p.cargo ?? '', ...cabecalho.slice(2).map(() => '')])

  for (let i = 0; i < 10; i++) corpo.push(cabecalho.map(() => ''))
  corpo.push(['TOTAIS', '', ...cabecalho.slice(2).map(() => '')])

  const ws = XLSX.utils.aoa_to_sheet([cabecalho, ...corpo])
  ws['!cols'] = [{ wch: 34 }, { wch: 26 }, ...cabecalho.slice(2).map(() => ({ wch: 10 }))]
  return ws
}

export interface OpcoesDoModelo {
  /** Lançamentos já no sistema. Vazio gera o modelo em branco. */
  entries?: FinanceiroEntry[]
  /** Quadro de pessoal, para a grade de horas extras já vir com os nomes. */
  pessoas?: Array<{ nome: string; cargo?: string }>
  mes: number
  ano: number
  nomeArquivo?: string
}

/** Monta o arquivo. Separado do download para poder ser conferido em teste. */
export function montarPlanilhaModelo(o: OpcoesDoModelo): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, abaComoUsar(), 'COMO USAR')
  XLSX.utils.book_append_sheet(wb, abaLancamentos(o.entries ?? []), 'LANÇAMENTOS')
  XLSX.utils.book_append_sheet(
    wb,
    abaHorasExtras(o.pessoas ?? [], o.mes, o.ano),
    `HORAS EXTRAS ${String(o.mes).padStart(2, '0')}`,
  )
  return wb
}

export function baixarPlanilhaModelo(o: OpcoesDoModelo): void {
  const nome = o.nomeArquivo
    ?? `Controle_de_Caixa_${String(o.mes).padStart(2, '0')}_${o.ano}.xlsx`
  XLSX.writeFile(montarPlanilhaModelo(o), nome)
}
