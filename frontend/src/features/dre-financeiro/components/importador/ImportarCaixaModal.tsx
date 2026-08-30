/**
 * ImportarCaixaModal — a via principal de lançamento: sobe a planilha modelo.
 *
 * O passo que importa é o PREVIEW: antes de gravar qualquer coisa, o usuário vê
 * linha a linha o que é NOVO, o que MUDOU (com antes → depois), o que está
 * IGUAL (e será ignorado) e o que tem ERRO. Nada entra sem ele confirmar, e ele
 * pode desmarcar linha por linha.
 */
import { useMemo, useRef, useState } from 'react'
import {
  X, Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle2,
  Plus, Equal, ArrowRight, Ban,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useProjectContext } from '@/store/projectContext'
import type { UseCaixaReturn } from '@/hooks/useCaixa'
import { calcularDiff, detectarNovidades, norm, type LinhaDiff, type Veredicto } from './diff'
import {
  baixarModeloCaixa, lerPlanilhaCaixa, validarLancamento,
  type LancamentoPlanilha, type LeituraCaixa,
} from './planilhaCaixa'

type Passo = 'upload' | 'preview' | 'pronto'

const CORES: Record<Veredicto, { cor: string; icone: typeof Plus; rotulo: string }> = {
  NOVO:      { cor: 'bg-green-500/15 text-green-300',  icone: Plus,        rotulo: 'Novo' },
  DIFERENTE: { cor: 'bg-amber-500/15 text-amber-200',  icone: ArrowRight,  rotulo: 'Mudou' },
  IGUAL:     { cor: 'bg-[#484848] text-[#a3a3a3]',     icone: Equal,       rotulo: 'Igual' },
  ERRO:      { cor: 'bg-red-500/15 text-red-300',      icone: Ban,         rotulo: 'Erro' },
}

const brl = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(v ?? '—')
}

export function ImportarCaixaModal({ caixa, onClose }: { caixa: UseCaixaReturn; onClose: (importou: boolean) => void }) {
  const [passo, setPasso] = useState<Passo>('upload')
  const [arquivo, setArquivo] = useState<string>('')
  const [leitura, setLeitura] = useState<LeituraCaixa | null>(null)
  const [linhas, setLinhas] = useState<LinhaDiff<LancamentoPlanilha>[]>([])
  const [novidades, setNovidades] = useState<{ tipo: string; valor: string; linhas: number[] }[]>([])
  const [criarNovidades, setCriarNovidades] = useState<Record<string, boolean>>({})
  const [erroLeitura, setErroLeitura] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)
  const [resultado, setResultado] = useState<{ criados: number; atualizados: number; ignorados: number; erros: string[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const projetos = useProjectContext((s) => s.projetos)

  /** coluna OBRA da planilha → projeto do sistema (aceita "BOI MALHADO" e "WCR — Boi Malhado") */
  const projetoDaObra = (obra: string): string | null => {
    const alvo = norm(obra)
    if (!alvo) return null
    const hit = projetos.find((p) => norm(p.nome) === alvo || norm(p.nome) === norm('WCR — ' + obra))
    return hit?.id ?? null
  }

  const resumo = useMemo(() => {
    const r: Record<Veredicto, number> = { NOVO: 0, IGUAL: 0, DIFERENTE: 0, ERRO: 0 }
    for (const l of linhas) r[l.veredicto]++
    return r
  }, [linhas])

  const selecionadas = linhas.filter((l) => l.selecionada && l.veredicto !== 'ERRO')

  async function processar(file: File) {
    setErroLeitura(null); setArquivo(file.name)
    try {
      const buf = await file.arrayBuffer()
      const lida = lerPlanilhaCaixa(buf, Number(caixa.mes.slice(0, 4)))
      setLeitura(lida)

      if (lida.lancamentos.length === 0 && lida.horasExtras.length === 0) {
        setErroLeitura('Nenhuma linha encontrada. Confira se você usou o modelo do sistema.')
        return
      }

      // o que já existe: mesma obra + data + descrição + valor = mesmo lançamento
      const doBanco = caixa.lancamentos.map((l) => ({
        id: l.id,
        tipo: l.tipo,
        data_inicio: l.data_inicio,
        data_fim: l.data_fim,
        descricao: l.descricao,
        valor: l.valor,
        categoria: caixa.categorias.find((c) => c.id === l.categoria_id)?.nome ?? '',
        obra: l.obra_texto ?? '',
        solicitantes: (l.solicitantes ?? []).map((s) => s.nome),
        forma_pagamento: l.forma_pagamento,
        status: l.status,
        anexo: l.anexo_url,
        observacao: l.observacao,
      })) as unknown as (LancamentoPlanilha & { id: string })[]

      const d = calcularDiff<LancamentoPlanilha>(lida.lancamentos, doBanco, {
        chave: (i) => `${norm(i.obra)}|${i.data_inicio}|${norm(i.descricao)}`,
        campos: ['tipo', 'valor', 'categoria', 'status', 'forma_pagamento', 'observacao', 'data_fim'],
        validar: validarLancamento,
      })
      setLinhas(d.linhas)

      const nov = detectarNovidades(lida.lancamentos, [
        { tipo: 'Categoria', valor: (i) => i.categoria, conhecidos: caixa.categorias.map((c) => c.nome) },
        { tipo: 'Obra', valor: (i) => i.obra, conhecidos: [...new Set(caixa.lancamentos.map((l) => l.obra_texto ?? ''))] },
      ])
      setNovidades(nov)
      setCriarNovidades(Object.fromEntries(nov.map((n) => [`${n.tipo}|${n.valor}`, n.tipo === 'Categoria'])))
      setPasso('preview')
    } catch (e) {
      setErroLeitura(e instanceof Error ? e.message : String(e))
    }
  }

  async function gravar() {
    if (!supabase) return
    setGravando(true)
    const erros: string[] = []
    let criados = 0, atualizados = 0

    // 1) categorias novas que o usuário aprovou
    const catPorNome = new Map(caixa.categorias.map((c) => [norm(c.nome), c.id]))
    for (const n of novidades) {
      if (n.tipo !== 'Categoria' || !criarNovidades[`${n.tipo}|${n.valor}`]) continue
      const { data, error } = await supabase.from('caixa_categoria')
        .insert({ nome: n.valor, tipo: 'DESPESA', ordem: 99 }).select('id').single()
      if (error) erros.push(`categoria "${n.valor}": ${error.message}`)
      else catPorNome.set(norm(n.valor), (data as { id: string }).id)
    }

    const lote = crypto.randomUUID()
    for (const l of selecionadas) {
      const catId = catPorNome.get(norm(l.dados.categoria))
      if (!catId) { erros.push(`linha ${l.linha}: categoria "${l.dados.categoria}" não cadastrada`); continue }
      const campos = {
        tipo: l.dados.tipo, data_inicio: l.dados.data_inicio, data_fim: l.dados.data_fim,
        descricao: l.dados.descricao, valor: l.dados.valor, categoria_id: catId,
        obra_texto: l.dados.obra,
        projeto_id: projetoDaObra(l.dados.obra),   // vínculo real com o centro de custo
        forma_pagamento: l.dados.forma_pagamento,
        status: l.dados.status, anexo_url: l.dados.anexo, observacao: l.dados.observacao,
        origem: 'planilha', import_lote: lote,
      }
      if (l.veredicto === 'DIFERENTE' && l.idExistente) {
        const { error } = await supabase.from('caixa_lancamento').update(campos).eq('id', l.idExistente)
        if (error) erros.push(`linha ${l.linha}: ${error.message}`); else atualizados++
      } else {
        const { error } = await supabase.from('caixa_lancamento').insert(campos)
        if (error) erros.push(`linha ${l.linha}: ${error.message}`); else criados++
      }
    }

    setResultado({ criados, atualizados, ignorados: resumo.IGUAL, erros })
    setGravando(false)
    setPasso('pronto')
    await caixa.recarregar()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-6xl shadow-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={18} className="text-[#f97316]" />
            <h2 className="text-sm font-semibold text-[#f5f5f5]">Importar planilha de lançamentos</h2>
          </div>
          <button onClick={() => onClose(passo === 'pronto')} className="text-[#a3a3a3] hover:text-[#f5f5f5]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {passo === 'upload' && (
            <div className="space-y-4">
              <div className="bg-[#333333] border border-[#525252] rounded-lg p-4 space-y-2">
                <p className="text-sm text-[#f5f5f5] font-medium">A planilha é a via principal de lançamento.</p>
                <p className="text-xs text-[#a3a3a3] leading-relaxed">
                  Baixe o modelo, preencha e suba de volta. O sistema confere linha a linha e mostra o que é novo,
                  o que mudou e o que está com erro <span className="text-[#f5f5f5]">antes</span> de gravar qualquer coisa.
                </p>
                <button
                  onClick={() => baixarModeloCaixa(
                    caixa.categorias.map((c) => c.nome),
                    [...new Set(caixa.lancamentos.map((l) => l.obra_texto ?? '').filter(Boolean))],
                    [], Number(caixa.mes.slice(0, 4)), Number(caixa.mes.slice(5, 7)),
                  )}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]">
                  <Download size={14} /> Baixar modelo de lançamento
                </button>
              </div>

              <div onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void processar(f) }}
                className="border-2 border-dashed border-[#525252] hover:border-[#f97316] rounded-xl p-10 text-center cursor-pointer transition-colors">
                <Upload size={26} className="mx-auto text-[#6b6b6b] mb-2" />
                <p className="text-sm text-[#f5f5f5]">Arraste a planilha aqui ou clique para escolher</p>
                <p className="text-xs text-[#6b6b6b] mt-1">.xlsx ou .xls</p>
                <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void processar(f) }} />
              </div>

              {erroLeitura && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {erroLeitura}
                </div>
              )}
            </div>
          )}

          {passo === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
                <FileSpreadsheet size={13} /> {arquivo}
                <span className="text-[#6b6b6b]">· {linhas.length} linhas lidas</span>
              </div>

              {leitura?.avisos.map((a, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {a}
                </div>
              ))}

              <div className="flex gap-3 overflow-x-auto">
                {(['NOVO', 'DIFERENTE', 'IGUAL', 'ERRO'] as Veredicto[]).map((v) => {
                  const C = CORES[v]; const Icone = C.icone
                  return (
                    <div key={v} className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-4 py-2.5 min-w-[110px]">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#a3a3a3]">
                        <Icone size={11} /> {C.rotulo}
                      </div>
                      <div className={`font-mono text-xl font-semibold ${v === 'ERRO' && resumo[v] > 0 ? 'text-red-400' : 'text-[#f5f5f5]'}`}>
                        {resumo[v]}
                      </div>
                    </div>
                  )
                })}
              </div>

              {novidades.length > 0 && (
                <div className="bg-[#333333] border border-[#525252] rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-[#f5f5f5]">
                    A planilha trouxe valores que o sistema ainda não conhece
                  </p>
                  <p className="text-xs text-[#a3a3a3]">
                    Não é erro — é decisão sua. Marque o que deve ser cadastrado junto com a importação.
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {novidades.map((n) => {
                      const k = `${n.tipo}|${n.valor}`
                      return (
                        <label key={k} className="flex items-center gap-2 text-sm text-[#f5f5f5] cursor-pointer">
                          <input type="checkbox" checked={!!criarNovidades[k]}
                            onChange={(e) => setCriarNovidades((c) => ({ ...c, [k]: e.target.checked }))}
                            className="accent-[#f97316]" />
                          <span className="text-[10px] uppercase rounded px-1.5 py-0.5 bg-[#484848] text-[#a3a3a3]">{n.tipo}</span>
                          <span className="font-medium">{n.valor}</span>
                          <span className="text-xs text-[#6b6b6b]">
                            linha{n.linhas.length > 1 ? 's' : ''} {n.linhas.slice(0, 6).join(', ')}
                            {n.linhas.length > 6 && ` +${n.linhas.length - 6}`}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="border border-[#525252] rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[42vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#3d3d3d] z-10">
                      <tr className="border-b border-[#525252]/50">
                        <th className="px-3 py-2 w-8"></th>
                        <th className="text-left text-[#a3a3a3] text-xs font-medium px-3 py-2">Ln</th>
                        <th className="text-left text-[#a3a3a3] text-xs font-medium px-3 py-2">Situação</th>
                        <th className="text-left text-[#a3a3a3] text-xs font-medium px-3 py-2">Data</th>
                        <th className="text-left text-[#a3a3a3] text-xs font-medium px-3 py-2">Descrição</th>
                        <th className="text-right text-[#a3a3a3] text-xs font-medium px-3 py-2">Valor</th>
                        <th className="text-left text-[#a3a3a3] text-xs font-medium px-3 py-2">O que muda / problema</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((l, i) => {
                        const C = CORES[l.veredicto]; const Icone = C.icone
                        return (
                          <tr key={i} className={`border-b border-[#525252]/50 ${l.veredicto === 'ERRO' ? 'bg-red-500/5' : ''}`}>
                            <td className="px-3 py-1.5">
                              <input type="checkbox" disabled={l.veredicto === 'ERRO'} checked={l.selecionada}
                                onChange={(e) => setLinhas((ls) => ls.map((x, j) => j === i ? { ...x, selecionada: e.target.checked } : x))}
                                className="accent-[#f97316]" />
                            </td>
                            <td className="px-3 py-1.5 text-xs font-mono text-[#6b6b6b]">{l.linha}</td>
                            <td className="px-3 py-1.5">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${C.cor}`}>
                                <Icone size={10} /> {C.rotulo}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-xs text-[#a3a3a3] whitespace-nowrap">
                              {l.dados.data_inicio || '—'}
                              {l.dados.data_fim && <span className="text-[#6b6b6b]"> a {l.dados.data_fim}</span>}
                            </td>
                            <td className="px-3 py-1.5 text-[#f5f5f5]">{l.dados.descricao || '—'}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-xs text-[#f5f5f5] whitespace-nowrap">
                              {brl(l.dados.valor)}
                            </td>
                            <td className="px-3 py-1.5 text-xs">
                              {l.problemas.map((p, j) => (
                                <div key={j} className={p.bloqueia ? 'text-red-300' : 'text-amber-300'}>
                                  {p.bloqueia ? '✕' : '!'} {p.mensagem}
                                </div>
                              ))}
                              {l.alteracoes.map((a, j) => (
                                <div key={j} className="text-[#a3a3a3]">
                                  <span className="text-[#6b6b6b]">{a.campo}:</span>{' '}
                                  <span className="line-through text-[#6b6b6b]">
                                    {a.campo === 'valor' ? brl(a.antes) : String(a.antes ?? '—')}
                                  </span>{' → '}
                                  <span className="text-amber-200">
                                    {a.campo === 'valor' ? brl(a.depois) : String(a.depois ?? '—')}
                                  </span>
                                </div>
                              ))}
                              {l.veredicto === 'IGUAL' && <span className="text-[#6b6b6b]">nada muda — será ignorada</span>}
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
              <div className="flex justify-center gap-6 text-sm text-[#a3a3a3]">
                <span><span className="font-mono text-green-300 text-lg">{resultado.criados}</span> criados</span>
                <span><span className="font-mono text-amber-200 text-lg">{resultado.atualizados}</span> atualizados</span>
                <span><span className="font-mono text-[#6b6b6b] text-lg">{resultado.ignorados}</span> ignorados</span>
              </div>
              {resultado.erros.length > 0 && (
                <div className="text-left max-w-xl mx-auto mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
                  <p className="text-xs font-semibold text-red-200 mb-1">
                    {resultado.erros.length} linha(s) não entraram:
                  </p>
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
            {passo === 'preview' && `${selecionadas.length} linha(s) marcadas para gravar`}
          </div>
          <div className="flex gap-2">
            {passo === 'preview' && (
              <button onClick={() => { setPasso('upload'); setLinhas([]); setNovidades([]) }}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]">
                Trocar arquivo
              </button>
            )}
            {passo === 'preview' ? (
              <button onClick={() => void gravar()} disabled={gravando || selecionadas.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#f97316] text-[#ffffff] hover:bg-[#ea580c] disabled:opacity-40 disabled:cursor-not-allowed">
                {gravando ? 'Gravando…' : `Confirmar importação (${selecionadas.length})`}
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
