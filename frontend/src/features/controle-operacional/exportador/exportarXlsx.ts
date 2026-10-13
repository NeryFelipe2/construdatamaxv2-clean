/**
 * exportarXlsx.ts — o caminho de volta. Porta do `app/exporter.py`.
 *
 *   - Excel: uma aba por tela, com as colunas DIGITADAS e as CALCULADAS ([calc]) já com
 *     valor, mais uma aba RESUMO do mês de referência.
 *   - ZIP de CSVs: um por tela + preços, custos, tributos e parâmetros; separador `;`,
 *     UTF-8 com BOM (o Excel brasileiro abre com acento certo).
 *
 * Salário NÃO sai em lugar nenhum (nem para admin): exportar é compartilhar.
 * Vazio sai vazio — nunca 0.
 */
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import type { ContextoCalculo } from '../dominio/calculos'
import { resumoMes } from '../dominio/calculos'
import { TELAS, calcDaTela, linhasDaTela, type TelaId } from '../dominio/telas'
import { hojeLocal, inicioDoMes } from '../dominio/datas'

const TELAS_EXPORTADAS: TelaId[] = [
  'servicos', 'programacao', 'os', 'apontamento', 'medicao', 'ocorrencias', 'equipe', 'faturamento',
  'atas', 'lookahead', 'plano',
]

type Celula = string | number | boolean | null

function valorDoCampo(v: unknown, tipo: string, ctx: ContextoCalculo): Celula {
  if (v === null || v === undefined || v === '') return null
  if (tipo === 'servico') return ctx.dados.servicos.find((s) => s.id === v)?.codigo ?? null
  if (tipo === 'bool') return v === true ? 'SIM' : v === false ? 'NÃO' : null
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v
  return String(v)
}

function valorCalc(v: unknown): Celula {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'boolean') return v ? 'SIM' : 'NÃO'
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  return String(v)
}

export interface TabelaExportada { nome: string; titulo: string; cabecalho: string[]; linhas: Celula[][] }

export function montarTabelas(ctx: ContextoCalculo): TabelaExportada[] {
  const out: TabelaExportada[] = []
  for (const id of TELAS_EXPORTADAS) {
    const t = TELAS[id]
    const extras = id === 'equipe' ? ['Nome'] : []
    const cabecalho = [...extras, ...t.campos.map((c) => c.rotulo), ...t.calculadas.map((c) => `[calc] ${c.rotulo}`)]
    const linhas = linhasDaTela(t, ctx.dados).map((row) => {
      const calc = calcDaTela(id, row, ctx)
      const pre = id === 'equipe' ? [(row.pessoa_nome as string) ?? null] : []
      return [
        ...pre,
        ...t.campos.map((c) => valorDoCampo(row[c.campo], c.tipo, ctx)),
        ...t.calculadas.map((c) => valorCalc(calc[c.campo])),
      ]
    })
    out.push({ nome: id, titulo: t.titulo, cabecalho, linhas })
  }
  const d = ctx.dados
  out.push({
    nome: 'precos', titulo: '02 · Tabela de preços', cabecalho: ['Chave', 'Contrato', 'Grupo', 'Item SABESP', 'Descrição', 'Nº preço', 'Un', 'R$ unit.'],
    linhas: d.precos.filter((p) => !p.deleted_at).map((p) => [p.chave, p.contrato, p.grupo, p.item_sabesp, p.descricao, p.n_preco, p.un, p.preco]),
  })
  out.push({
    nome: 'custos', titulo: '01A · Banco de custos', cabecalho: ['Item', 'Qtd', 'Valor unit.', 'Total / mês', 'Fonte'],
    linhas: d.custos.filter((c) => !c.deleted_at).map((c) => [c.item, c.qtd, c.valor_unit, c.qtd === null || c.valor_unit === null ? null : c.qtd * c.valor_unit, c.fonte]),
  })
  out.push({
    nome: 'tributos', titulo: '01A · Tributos', cabecalho: ['Tributo', 'Alíquota', 'Memória', 'Fonte'],
    linhas: d.tributos.filter((t) => !t.deleted_at).map((t) => [t.nome, t.aliquota, t.memoria, t.fonte]),
  })
  const p = d.parametros
  out.push({
    nome: 'parametros', titulo: '01 · Parâmetros', cabecalho: ['Parâmetro', 'Valor'],
    linhas: TELAS.parametros.campos.map((c) => [c.rotulo, p ? valorDoCampo((p as unknown as Record<string, unknown>)[c.campo], c.tipo, ctx) : null]),
  })
  return out
}

export function montarWorkbook(ctx: ContextoCalculo, projetoNome: string, mes?: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const ref = inicioDoMes(mes ?? ctx.p?.mes_referencia ?? ctx.hoje)
  const r = resumoMes(ref, ctx)
  const resumo: Celula[][] = [
    ['RESUMO GERENCIAL', projetoNome], ['Mês', ref], ['Gerado em', hojeLocal()], [],
    ['Serviços recebidos', r.recebidos], ['Programados', r.programados], ['Executados', r.executados],
    ['Aderência', r.aderencia], ['Executados no prazo', r.executados_no_prazo], ['% no prazo', r.pct_no_prazo],
    ['Backlog', r.backlog], ['Vencidos', r.vencidos], ['R$ medido', r.rs_medido], ['Meta do mês', r.meta_mes],
    ['Atingimento', r.atingimento], ['Glosa', r.glosa], ['Custo do mês', r.custo_mes], ['Resultado', r.resultado],
    ['Margem', r.margem], ['HH', r.hh], ['R$ por HH', r.rs_por_hh], ['Ocorrências abertas', r.ocorrencias_abertas],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'RESUMO')
  for (const t of montarTabelas(ctx)) {
    const ws = XLSX.utils.aoa_to_sheet([t.cabecalho, ...t.linhas])
    ws['!cols'] = t.cabecalho.map(() => ({ wch: 16 }))
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    XLSX.utils.book_append_sheet(wb, ws, t.titulo.replace(/[·:\\/?*[\]]/g, '-').slice(0, 31))
  }
  return wb
}

const nomeArquivo = (projetoNome: string, ext: string) =>
  `CONTROLE OPERACIONAL - ${projetoNome.replace(/[\\/:*?"<>|]/g, '-')} - ${hojeLocal()}.${ext}`

export function baixarXlsx(ctx: ContextoCalculo, projetoNome: string): void {
  XLSX.writeFile(montarWorkbook(ctx, projetoNome), nomeArquivo(projetoNome, 'xlsx'))
}

function csvCelula(v: Celula): string {
  if (v === null) return ''
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function montarCsvs(ctx: ContextoCalculo): { nome: string; conteudo: string }[] {
  return montarTabelas(ctx).map((t) => ({
    nome: `${t.nome}.csv`,
    conteudo: '﻿' + [t.cabecalho, ...t.linhas].map((l) => l.map(csvCelula).join(';')).join('\r\n'),
  }))
}

export async function baixarCsvZip(ctx: ContextoCalculo, projetoNome: string): Promise<void> {
  const zip = new JSZip()
  for (const c of montarCsvs(ctx)) zip.file(c.nome, c.conteudo)
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo(projetoNome, 'zip')
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
