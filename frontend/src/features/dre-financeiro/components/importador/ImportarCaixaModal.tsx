/**
 * ImportarCaixaModal — a via principal de lançamento: sobe a planilha de caixa.
 *
 * O motor de conferência é o do pacote (utils/controleDeCaixa*.ts) e a ponte com o banco está em
 * utils/caixaCd.ts + utils/caixaSupabaseIO.ts. Esta tela só mostra e confirma.
 *
 * ⚠️ Nada é gravado sem confirmar, e nada é apagado nunca. O que sumiu da planilha é APONTADO:
 * a linha pode ter sido apagada por engano e o lançamento pode já estar conciliado.
 *
 * O gesto real é reimportar o mesmo arquivo várias vezes por mês, cada vez mais cheio. Por isso a
 * tela não pergunta "importar?": ela responde "o que muda se eu importar isto?".
 */
import { useMemo, useState, type ReactNode } from 'react'
import * as XLSX from 'xlsx'
import {
  X, FileSpreadsheet, AlertTriangle, CheckCircle2, Download, Plus, Equal, ArrowRight, Ban, Copy, Pencil,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useProjectContext } from '@/store/projectContext'
import type { UseCaixaReturn } from '@/hooks/useCaixa'
import { AreaDeSoltar } from '@/components/shared/AreaDeSoltar'
import { fmtDataBR } from '@/lib/utils'
import {
  lerLancamentos, lerHorasExtras, mesDoNomeDaAba, conferirTotaisDeHorasExtras,
  abasDeHorasExtras, abaDeLancamentos, type Matriz, type LeituraHorasExtras,
} from '../../utils/controleDeCaixaPlanilha'
import { SITUACOES_QUE_GRAVAM, type Situacao } from '../../utils/controleDeCaixaImport'
import { conferirCd, linhasCdAGravar, paraGravar, type ConferenciaCd, type LinhaCd } from '../../utils/caixaCd'
import {
  carregarExistentesDoProjeto, carregarPessoas, criarCategoria, gravarLancamentos, gravarHorasExtras,
  idDaCategoria, pessoaDoNome, type ExistenteCd,
} from '../../utils/caixaSupabaseIO'
import type { PessoaBase } from '@/features/rdo/utils/casarPessoaPresenca'
import { baixarModeloCaixa, categoriaPorDescricao } from './planilhaCaixa'

type Passo = 'upload' | 'preview' | 'pronto'

const CORES: Record<Situacao, { cor: string; icone: typeof Plus; rotulo: string }> = {
  'novo':              { cor: 'bg-green-500/15 text-green-300',  icone: Plus,       rotulo: 'Novo' },
  'valor-alterado':    { cor: 'bg-amber-500/15 text-amber-200',  icone: ArrowRight, rotulo: 'Valor alterado' },
  'cadastro-alterado': { cor: 'bg-sky-500/15 text-sky-300',      icone: Pencil,     rotulo: 'Cadastro alterado' },
  'inalterado':        { cor: 'bg-[#484848] text-[#a3a3a3]',     icone: Equal,      rotulo: 'Inalterado' },
  'duplicado':         { cor: 'bg-red-500/15 text-red-300',      icone: Copy,       rotulo: 'Duplicado no arquivo' },
}

const brl = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(v ?? '—')
}

const bloqueia = (l: LinhaCd) => l.problemasCd.some((p) => p.bloqueia)
const podeGravar = (l: LinhaCd) => (SITUACOES_QUE_GRAVAM as readonly Situacao[]).includes(l.situacao) && !bloqueia(l)

interface Lido {
  nomeArquivo: string
  conf: ConferenciaCd
  existentes: ExistenteCd[]
  colunasDeImportacao: boolean
  pessoas: PessoaBase[]
  /** ⚠️ Todas as abas de horas extras (uma por mês), não a primeira. */
  horasExtras: Array<{ aba: string; leitura: LeituraHorasExtras }>
  horasExtrasPuladas: Array<{ aba: string; motivo: string }>
  abaPorPosicao: boolean
}

interface Resultado {
  gravados: number
  ignorados: number
  horasExtras: number
  heDespesas: number
  erros: string[]
  semCadastro: string[]
}

export function ImportarCaixaModal({ caixa, onClose }: { caixa: UseCaixaReturn; onClose: (importou: boolean) => void }) {
  const { activeProjectId, projetos } = useProjectContext()
  const projeto = projetos.find((p) => p.id === activeProjectId) ?? null
  const [passo, setPasso] = useState<Passo>('upload')
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [lido, setLido] = useState<Lido | null>(null)
  const [selecao, setSelecao] = useState<Set<string>>(new Set())
  const [criarCat, setCriarCat] = useState<Record<string, boolean>>({})
  const [mostrarInalterados, setMostrarInalterados] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  async function processar(file: File) {
    setErro(null)
    if (!projeto) { setErro('Selecione a obra antes de importar — o caixa é por obra.'); return }
    if (file.size > 20 * 1024 * 1024) { setErro('Arquivo acima de 20 MB — confira se é mesmo a planilha de caixa.'); return }
    setLendo(true)
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const escolha = abaDeLancamentos(wb.SheetNames)
      if (!escolha) { setErro('O arquivo não tem nenhuma aba.'); return }
      const matriz = XLSX.utils.sheet_to_json(wb.Sheets[escolha.aba], { header: 1, raw: true, defval: null }) as Matriz
      const leitura = lerLancamentos(matriz)

      const [{ linhas: existentes, colunasDeImportacao }, pessoas] = await Promise.all([
        carregarExistentesDoProjeto(projeto.id, caixa.categorias),
        carregarPessoas(),
      ])
      const conf = conferirCd(leitura, matriz, existentes, {
        projetoId: projeto.id, nomeProjeto: projeto.nome, categorias: caixa.categorias,
        agora: new Date().toISOString(), colunasDeImportacao,
      }, categoriaPorDescricao)

      const ano = leitura.lancamentos[0]?.data ? Number(leitura.lancamentos[0].data.slice(0, 4)) : Number(caixa.mes.slice(0, 4))
      const horasExtras: Lido['horasExtras'] = []
      const horasExtrasPuladas: Lido['horasExtrasPuladas'] = []
      for (const aba of abasDeHorasExtras(wb.SheetNames)) {
        const mes = mesDoNomeDaAba(aba)
        if (!mes) { horasExtrasPuladas.push({ aba, motivo: 'não achei o mês no nome da aba (ex.: "HORAS EXTRAS 08")' }); continue }
        const m = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, raw: true, defval: null }) as Matriz
        horasExtras.push({ aba, leitura: lerHorasExtras(m, { mes, ano, nomeDaAba: aba }) })
      }

      if (conf.linhas.length === 0 && horasExtras.every((h) => h.leitura.registros.length === 0)) {
        setErro(conf.problemas[0]?.motivo ?? 'Nenhuma linha encontrada. Confira se é a planilha de caixa.')
        return
      }

      setLido({ nomeArquivo: file.name, conf, existentes, colunasDeImportacao, pessoas, horasExtras, horasExtrasPuladas, abaPorPosicao: escolha.porPosicao })
      setSelecao(new Set(linhasCdAGravar(conf).map((l) => l.id)))
      const novas = [...new Set(conf.linhas.filter((l) => l.categoriaNova && podeGravar(l)).map((l) => l.categoriaNome))]
      setCriarCat(Object.fromEntries(novas.map((n) => [n, true])))
      setPasso('preview')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler este arquivo. Ele é mesmo .xlsx?')
    } finally {
      setLendo(false)
    }
  }

  const aGravar = useMemo(
    () => (lido ? lido.conf.linhas.filter((l) => podeGravar(l) && selecao.has(l.id)) : []),
    [lido, selecao],
  )
  const comErro = lido?.conf.linhas.filter(bloqueia).length ?? 0
  const categoriasNovas = Object.keys(criarCat)

  const heResumo = useMemo(() => (lido?.horasExtras ?? []).map(({ aba, leitura }) => {
    const pagos = leitura.registros.filter((r) => r.pago)
    const semCadastro = [...new Set(leitura.registros.map((r) => r.nome))]
      .filter((n) => !pessoaDoNome(n, lido!.pessoas))
    return {
      aba, registros: leitura.registros.length, pagos: pagos.length,
      somaPagos: pagos.reduce((a, r) => a + r.valor, 0), semCadastro,
      divergencias: conferirTotaisDeHorasExtras(leitura), problemas: leitura.problemas,
    }
  }), [lido])
  const heRegistros = (lido?.horasExtras ?? []).flatMap((h) => h.leitura.registros)

  async function gravar() {
    if (!lido || !projeto || !supabase) return
    setGravando(true)
    const erros: string[] = []
    try {
      const { data: sess } = await supabase.auth.getUser()
      const userId = sess?.user?.id ?? null
      const agora = new Date().toISOString()
      const lote = crypto.randomUUID()

      // 1) categorias novas aprovadas; as recusadas caem em "Outros"
      const catIds = new Map(caixa.categorias.map((c) => [c.nome.toLowerCase(), c.id]))
      for (const nome of categoriasNovas) {
        if (!criarCat[nome]) continue
        const tipos = new Set(aGravar.filter((l) => l.categoriaNome === nome).map((l) => l.lida.tipo))
        const tipo = tipos.size > 1 ? 'AMBOS' : tipos.has('receita') ? 'RECEITA' : 'DESPESA'
        try { catIds.set(nome.toLowerCase(), await criarCategoria(nome, tipo)) }
        catch (e) { erros.push(`categoria "${nome}": ${e instanceof Error ? e.message : String(e)}`) }
      }
      const outros = idDaCategoria(caixa.categorias, 'Outros')
      const categoriaId = (nome: string) =>
        catIds.get(nome.toLowerCase()) ?? idDaCategoria(caixa.categorias, nome) ?? outros

      // 2) lançamentos
      const porId = new Map(lido.existentes.map((e) => [e.id, e]))
      const r = await gravarLancamentos(
        aGravar.map((l) => ({ g: paraGravar(l, { projetoId: projeto.id, nomeProjeto: projeto.nome }), existente: porId.get(l.id) })),
        { categoriaId, lote, userId, agora, colunasDeImportacao: lido.colunasDeImportacao, pessoas: lido.pessoas },
      )
      erros.push(...r.erros)

      // 3) horas extras (todas as abas)
      const he = heRegistros.length > 0
        ? await gravarHorasExtras(heRegistros, {
          projetoId: projeto.id, nomeProjeto: projeto.nome, pessoas: lido.pessoas,
          categoriaHoraExtraId: idDaCategoria(caixa.categorias, 'Hora extra'), lote, userId, agora,
        })
        : { gravadas: 0, viraramDespesa: 0, semCadastro: [], erros: [] }
      erros.push(...he.erros)

      setResultado({
        gravados: r.gravados,
        ignorados: lido.conf.resumo.inalterado,
        horasExtras: he.gravadas,
        heDespesas: he.viraramDespesa,
        erros,
        semCadastro: [...new Set([...r.solicitantesSemCadastro, ...he.semCadastro])].sort(),
      })
      setPasso('pronto')
      // Leva a tela para o mês do arquivo — senão a importação "não aparece".
      if (lido.conf.periodo) caixa.setMes(lido.conf.periodo.de.slice(0, 7))
      await caixa.recarregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setGravando(false)
    }
  }

  const linhasVisiveis = (lido?.conf.linhas ?? []).filter((l) => mostrarInalterados || l.situacao !== 'inalterado')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-6xl shadow-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={18} className="text-[#f97316]" />
            <div>
              <h2 className="text-sm font-semibold text-[#f5f5f5]">Importar planilha de caixa</h2>
              <p className="text-[11px] text-[#a3a3a3]">
                {lido ? `${lido.nomeArquivo} · ${projeto?.nome ?? ''} — confira o que muda antes de gravar.`
                  : 'Nada é gravado sem você confirmar, e nada é apagado.'}
              </p>
            </div>
          </div>
          <button onClick={() => onClose(passo === 'pronto')} className="text-[#a3a3a3] hover:text-[#f5f5f5]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {passo === 'upload' && (
            <div className="space-y-4">
              <div className="bg-[#333333] border border-[#525252] rounded-lg p-4 space-y-2">
                <p className="text-sm text-[#f5f5f5] font-medium">
                  Serve a planilha que a equipe já mantém e a que o sistema exporta (com coluna ID).
                </p>
                <p className="text-xs text-[#a3a3a3] leading-relaxed">
                  Pode importar o mesmo arquivo quantas vezes quiser durante o mês: o que já está no sistema aparece
                  como <span className="text-[#f5f5f5]">inalterado</span> e não é gravado de novo. Tudo entra na obra
                  selecionada: <span className="text-[#f5f5f5]">{projeto?.nome ?? '(nenhuma — selecione a obra)'}</span>.
                </p>
                <button
                  onClick={() => baixarModeloCaixa(caixa.categorias.map((c) => c.nome), [], [],
                    Number(caixa.mes.slice(0, 4)), Number(caixa.mes.slice(5, 7)))}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]">
                  <Download size={14} /> Baixar modelo em branco
                </button>
              </div>

              <AreaDeSoltar
                aceita=".xlsx,.xls"
                desabilitado={lendo || !projeto}
                titulo={lendo ? 'Lendo e conferindo…' : 'Arraste a planilha aqui ou clique para escolher'}
                ajuda=".xlsx ou .xls"
                aoEscolher={(arquivos) => { const f = arquivos[0]; if (f) void processar(f) }}
              />

              {erro && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {erro}
                </div>
              )}
            </div>
          )}

          {passo === 'preview' && lido && (
            <div className="space-y-4">
              {!lido.colunasDeImportacao && (
                <Aviso cor="amber">
                  A migration <b>033</b> ainda não foi colada no banco. A importação funciona e não duplica (o id do
                  lançamento nasce do conteúdo), mas o texto do solicitante não é guardado e por isso não entra na
                  comparação.
                </Aviso>
              )}
              {lido.abaPorPosicao && (
                <Aviso cor="amber">Nenhuma aba se chama LANÇAMENTOS ou DESPESAS — li a primeira aba do arquivo.</Aviso>
              )}

              <div className="flex gap-3 overflow-x-auto">
                {(Object.keys(CORES) as Situacao[]).map((s) => {
                  const C = CORES[s]; const Icone = C.icone
                  return (
                    <div key={s} className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-4 py-2.5 min-w-[120px]">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#a3a3a3]">
                        <Icone size={11} /> {C.rotulo}
                      </div>
                      <div className="font-mono text-xl font-semibold text-[#f5f5f5]">{lido.conf.resumo[s]}</div>
                    </div>
                  )
                })}
                <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-4 py-2.5 min-w-[120px]">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#a3a3a3]"><Ban size={11} /> Bloqueadas</div>
                  <div className={`font-mono text-xl font-semibold ${comErro > 0 ? 'text-red-400' : 'text-[#f5f5f5]'}`}>{comErro}</div>
                </div>
              </div>

              {(lido.conf.totaisQueBateram.length > 0 || lido.conf.divergenciaDeTotais.length > 0) && (
                <Bloco titulo="Conferência com o rodapé da planilha">
                  {lido.conf.totaisQueBateram.map((t) => (
                    <p key={t.oQue} className="text-xs text-green-300">✓ {t.oQue}: {brl(t.valor)} — a soma das linhas bate com o rodapé.</p>
                  ))}
                  {lido.conf.divergenciaDeTotais.map((t) => (
                    <p key={t.oQue} className="text-xs text-red-300">
                      ✗ {t.oQue}: soma das linhas {brl(t.calculado)} × rodapé {brl(t.declarado)} (diferença {brl(t.calculado - t.declarado)}).
                      Não identifiquei a causa — confira se alguma linha ficou fora do bloco ou com valor digitado como texto.
                    </p>
                  ))}
                </Bloco>
              )}

              {lido.conf.problemas.length > 0 && (
                <Bloco titulo={`O que o leitor não conseguiu usar (${lido.conf.problemas.length})`}>
                  {lido.conf.problemas.map((p, i) => (
                    <p key={i} className="text-xs text-amber-200">
                      Linha {p.linha}{p.coluna ? ` · ${p.coluna}` : ''}: {p.motivo}
                      {p.conteudo && <span className="text-[#a3a3a3]"> (“{p.conteudo}”)</span>}
                    </p>
                  ))}
                </Bloco>
              )}

              {categoriasNovas.length > 0 && (
                <Bloco titulo="Categorias que o sistema ainda não conhece">
                  <p className="text-xs text-[#a3a3a3] mb-1">Marque o que deve ser cadastrado. As desmarcadas entram como “Outros”.</p>
                  {categoriasNovas.map((n) => (
                    <label key={n} className="flex items-center gap-2 text-sm text-[#f5f5f5] cursor-pointer">
                      <input type="checkbox" checked={!!criarCat[n]} className="accent-[#f97316]"
                        onChange={(e) => setCriarCat((c) => ({ ...c, [n]: e.target.checked }))} />
                      {n}
                    </label>
                  ))}
                </Bloco>
              )}

              {lido.conf.ausentes.length > 0 && (
                <Bloco titulo={`Estão no sistema e não vieram neste arquivo (${lido.conf.ausentes.length}) — NÃO serão apagados`}>
                  <p className="text-xs text-[#a3a3a3] mb-1">
                    Só entram aqui lançamentos importados de planilha dentro do período do arquivo
                    ({fmtDataBR(lido.conf.periodo?.de ?? '')} a {fmtDataBR(lido.conf.periodo?.ate ?? '')}).
                    Se a linha foi removida de propósito, exclua na tela de lançamentos.
                  </p>
                  {lido.conf.ausentes.map((a) => (
                    <p key={a.entry.id} className="text-xs text-[#f5f5f5]">
                      {fmtDataBR(a.entry.data)} · {a.entry.descricao} · <span className="font-mono">{brl(a.entry.valor)}</span>
                    </p>
                  ))}
                </Bloco>
              )}

              {(heResumo.length > 0 || lido.horasExtrasPuladas.length > 0) && (
                <Bloco titulo="Horas extras">
                  {heResumo.map((h) => (
                    <div key={h.aba} className="text-xs text-[#f5f5f5] space-y-0.5">
                      <p>
                        <b>{h.aba}</b>: {h.registros} lançamento(s) de dia, {h.pagos} pago(s) = {brl(h.somaPagos)} que viram despesa.
                      </p>
                      {h.divergencias.length === 0
                        ? <p className="text-green-300">✓ Totais por dia batem com a linha TOTAIS.</p>
                        : h.divergencias.map((d) => (
                          <p key={d.dia} className="text-red-300">
                            ✗ Dia {String(d.dia).padStart(2, '0')}: soma {brl(d.calculado)} × TOTAIS {brl(d.declarado)} (diferença {brl(d.diferenca)}).
                          </p>
                        ))}
                      {h.semCadastro.length > 0 && (
                        <p className="text-amber-200">
                          Sem cadastro em Pessoas (não serão gravados até cadastrar): {h.semCadastro.join(', ')}
                        </p>
                      )}
                      {h.problemas.map((p, i) => <p key={i} className="text-amber-200">Linha {p.linha}: {p.motivo}</p>)}
                    </div>
                  ))}
                  {lido.horasExtrasPuladas.map((p) => (
                    <p key={p.aba} className="text-xs text-amber-200">Aba “{p.aba}” não lida: {p.motivo}.</p>
                  ))}
                </Bloco>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs text-[#a3a3a3]">{lido.conf.linhas.length} lançamento(s) lidos</p>
                <label className="flex items-center gap-2 text-xs text-[#a3a3a3] cursor-pointer">
                  <input type="checkbox" checked={mostrarInalterados} className="accent-[#f97316]"
                    onChange={(e) => setMostrarInalterados(e.target.checked)} />
                  Mostrar inalterados ({lido.conf.resumo.inalterado})
                </label>
              </div>

              <div className="border border-[#525252] rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[42vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#3d3d3d] z-10">
                      <tr className="border-b border-[#525252]/50">
                        {['', 'Ln', 'Situação', 'Data', 'Descrição', 'Categoria', 'Status', 'Valor', 'O que muda / problema'].map((h, i) => (
                          <th key={i} className={`text-[#a3a3a3] text-xs font-medium px-3 py-2 ${h === 'Valor' ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {linhasVisiveis.map((l, i) => {
                        const C = CORES[l.situacao]; const Icone = C.icone
                        const habil = podeGravar(l)
                        return (
                          <tr key={`${l.id}-${i}`} className={`border-b border-[#525252]/50 ${bloqueia(l) ? 'bg-red-500/5' : ''}`}>
                            <td className="px-3 py-1.5">
                              <input type="checkbox" disabled={!habil} checked={habil && selecao.has(l.id)} className="accent-[#f97316]"
                                onChange={(e) => setSelecao((s) => { const n = new Set(s); if (e.target.checked) n.add(l.id); else n.delete(l.id); return n })} />
                            </td>
                            <td className="px-3 py-1.5 text-xs font-mono text-[#6b6b6b]">{l.lida.linha}</td>
                            <td className="px-3 py-1.5">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${C.cor}`}>
                                <Icone size={10} /> {C.rotulo}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-xs text-[#a3a3a3] whitespace-nowrap">
                              {fmtDataBR(l.lida.data)}{l.lida.dataFim && <span className="text-[#6b6b6b]"> a {fmtDataBR(l.lida.dataFim)}</span>}
                            </td>
                            <td className="px-3 py-1.5 text-[#f5f5f5]">
                              <span className={`mr-1 text-[10px] ${l.lida.tipo === 'receita' ? 'text-green-300' : 'text-red-300'}`}>
                                {l.lida.tipo === 'receita' ? '▲' : '▼'}
                              </span>
                              {l.lida.descricao}
                            </td>
                            <td className="px-3 py-1.5 text-xs text-[#a3a3a3]">{l.categoriaNome}{l.categoriaNova && ' *'}</td>
                            <td className="px-3 py-1.5 text-xs text-[#a3a3a3]">{l.status}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-xs text-[#f5f5f5] whitespace-nowrap">{brl(l.lida.valor)}</td>
                            <td className="px-3 py-1.5 text-xs">
                              {l.problemasCd.map((p, j) => (
                                <div key={j} className={p.bloqueia ? 'text-red-300' : 'text-amber-300'}>{p.bloqueia ? '✕' : '!'} {p.mensagem}</div>
                              ))}
                              {l.mudancas.map((m, j) => (
                                <div key={j} className="text-[#a3a3a3]">
                                  <span className="text-[#6b6b6b]">{m.rotulo}:</span>{' '}
                                  <span className="line-through text-[#6b6b6b]">{m.campo === 'valor' ? brl(m.antes) : String(m.antes ?? '—')}</span>
                                  {' → '}
                                  <span className="text-amber-200">{m.campo === 'valor' ? brl(m.depois) : String(m.depois ?? '—')}</span>
                                </div>
                              ))}
                              {l.situacao === 'duplicado' && <span className="text-red-300">Mesmo ID duas vezes no arquivo — decida qual fica.</span>}
                              {l.situacao === 'inalterado' && <span className="text-[#6b6b6b]">nada muda</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {passo === 'pronto' && resultado && (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 size={40} className="mx-auto text-green-400" />
              <p className="text-base font-semibold text-[#f5f5f5]">Importação concluída</p>
              <div className="flex justify-center gap-6 text-sm text-[#a3a3a3] flex-wrap">
                <span><span className="font-mono text-green-300 text-lg">{resultado.gravados}</span> lançamentos gravados</span>
                <span><span className="font-mono text-[#6b6b6b] text-lg">{resultado.ignorados}</span> inalterados</span>
                <span><span className="font-mono text-sky-300 text-lg">{resultado.horasExtras}</span> horas extras</span>
                <span><span className="font-mono text-amber-200 text-lg">{resultado.heDespesas}</span> HE pagas no caixa</span>
              </div>
              {resultado.semCadastro.length > 0 && (
                <p className="text-xs text-amber-200 max-w-xl mx-auto">
                  Nomes sem cadastro seguro em Pessoas (o lançamento entrou; o vínculo com a pessoa, não): {resultado.semCadastro.join(', ')}
                </p>
              )}
              {resultado.erros.length > 0 && (
                <div className="text-left max-w-xl mx-auto mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
                  <p className="text-xs font-semibold text-red-200 mb-1">{resultado.erros.length} erro(s):</p>
                  <ul className="text-xs text-red-200/80 space-y-0.5 max-h-32 overflow-y-auto">
                    {resultado.erros.map((e, i) => <li key={i}>· {e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[#525252]">
          <div className="text-xs text-[#6b6b6b]">
            {passo === 'preview' && `${aGravar.length} lançamento(s) e ${heRegistros.length} hora(s) extra(s) a gravar`}
            {erro && passo !== 'upload' && <span className="text-red-300 ml-2">{erro}</span>}
          </div>
          <div className="flex gap-2">
            {passo === 'preview' && (
              <button onClick={() => { setPasso('upload'); setLido(null) }}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]">
                Trocar arquivo
              </button>
            )}
            {passo === 'preview' ? (
              <button onClick={() => void gravar()} disabled={gravando || (aGravar.length === 0 && heRegistros.length === 0)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#f97316] text-[#ffffff] hover:bg-[#ea580c] disabled:opacity-40 disabled:cursor-not-allowed">
                {gravando ? 'Gravando…' : aGravar.length === 0 && heRegistros.length === 0 ? 'Nada mudou' : `Confirmar (${aGravar.length})`}
              </button>
            ) : (
              <button onClick={() => onClose(passo === 'pronto')}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]">
                {passo === 'pronto' ? 'Fechar' : 'Cancelar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Aviso({ cor, children }: { cor: 'amber' | 'red'; children: ReactNode }) {
  const c = cor === 'amber' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-red-500/40 bg-red-500/10 text-red-200'
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-4 py-2.5 text-sm ${c}`}>
      <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{children}</span>
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="bg-[#333333] border border-[#525252] rounded-lg p-4 space-y-1">
      <p className="text-sm font-medium text-[#f5f5f5] mb-1">{titulo}</p>
      {children}
    </div>
  )
}
