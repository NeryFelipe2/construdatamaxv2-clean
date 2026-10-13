/**
 * ImportarFluxoModal — sobe a projeção do Fluxo de Caixa por planilha.
 *
 * Excel é o caminho principal (é nele que o engenheiro preenche): o botão
 * "Baixar modelo desta obra" gera um .xlsx já timbrado com obra, contrato,
 * cliente, local, prazo e valor vindos do cadastro, com os meses da obra já
 * listados. CSV continua aceito para não quebrar quem já usava.
 *
 * O modelo carrega o ID DO PROJETO no cabeçalho. Se a planilha subida for de
 * OUTRA obra, a tela avisa antes de gravar em vez de misturar a projeção de uma
 * obra na conta de outra — errar isso é pior do que pedir uma confirmação.
 */
import { useRef, useState } from 'react'
import { Upload, X, FileSpreadsheet, AlertTriangle, CheckCircle2, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { parseCsvFluxo } from '../utils/parseCsvFluxo'
import {
  baixarModeloFluxo, lerPlanilhaFluxo, mesLabel,
  type ObraContexto, type LinhaFluxoPlanilha, type IdentificacaoFluxo,
} from './importador/planilhaFluxo'

interface Props {
  projectId: string
  obra: ObraContexto
  onClose: () => void
  onSaved: () => void
}

type Step = 'upload' | 'preview' | 'done'

interface LinhaRevisao {
  linha: number
  dados: LinhaFluxoPlanilha
  erros: string[]
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

export function ImportarFluxoModal({ projectId, obra, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [filename, setFilename] = useState('')
  const [linhas, setLinhas] = useState<LinhaRevisao[]>([])
  const [identificacao, setIdentificacao] = useState<IdentificacaoFluxo>({})
  const [avisos, setAvisos] = useState<string[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ importados: number; ignorados: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validas = linhas.filter((l) => l.erros.length === 0 && l.dados.mes)
  const invalidas = linhas.filter((l) => l.erros.length > 0 || !l.dados.mes)
  const obraDivergente = !!identificacao.projetoId && identificacao.projetoId !== projectId

  async function handleFile(file: File) {
    setParseError(null)
    const ehCsv = /\.csv$/i.test(file.name)
    try {
      if (ehCsv) {
        const texto = await file.text()
        const parsed = parseCsvFluxo(texto)
        if (!parsed.headerOk || parsed.rows.length === 0) {
          setParseError('Arquivo vazio ou sem linhas de dados reconhecíveis.')
          return
        }
        setLinhas(parsed.rows.map((r) => ({
          linha: r.lineNumber,
          erros: r.errors,
          dados: {
            mes: r.mes ?? '',
            recebimento_prev: r.recebimento_prev ?? 0,
            despesa_mao_obra: 0,
            despesa_material: 0,
            despesa_locacao_frota: 0,
            // CSV não separa categoria — o total do mês entra como "Outros".
            despesa_outros: r.despesa_prev ?? 0,
            despesa_prev: r.despesa_prev ?? 0,
            obs: r.obs || null,
          },
        })))
        setIdentificacao({})
        setAvisos(['CSV não separa a despesa por categoria — o total de cada mês entra como "Outros". Use o modelo Excel para detalhar.'])
      } else {
        const buffer = await file.arrayBuffer()
        const leitura = lerPlanilhaFluxo(buffer)
        if (leitura.linhas.length === 0) {
          setParseError(leitura.avisos[0] ?? 'Não encontrei linhas de mês nesta planilha.')
          return
        }
        setLinhas(leitura.linhas)
        setIdentificacao(leitura.identificacao)
        setAvisos(leitura.avisos)
      }
      setFilename(file.name)
      setStep('preview')
    } catch {
      setParseError('Não foi possível ler o arquivo. Envie um .xlsx do modelo (ou um .csv válido).')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  async function handleImport() {
    if (!supabase || validas.length === 0) return
    setImporting(true)
    setSaveError(null)
    try {
      // Um registro por mês: se a planilha repetir o mês, o último vence.
      const porMes = new Map<string, LinhaFluxoPlanilha>()
      for (const l of validas) porMes.set(l.dados.mes, l.dados)

      const payload = Array.from(porMes.values()).map((d) => ({
        id: crypto.randomUUID(),
        projeto_id: projectId,
        mes: d.mes,
        recebimento_prev: d.recebimento_prev,
        despesa_prev: d.despesa_prev,
        despesa_mao_obra: d.despesa_mao_obra,
        despesa_material: d.despesa_material,
        despesa_locacao_frota: d.despesa_locacao_frota,
        despesa_outros: d.despesa_outros,
        obs: d.obs,
        updated_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('fluxo_projecao')
        .upsert(payload, { onConflict: 'projeto_id,mes' })
      if (error) throw error

      setResult({ importados: payload.length, ignorados: linhas.length - payload.length })
      setStep('done')
      onSaved()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao gravar as projeções.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-4xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252] shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={17} className="text-[#f97316]" />
            <div>
              <h2 className="text-sm font-bold text-[#f5f5f5]">Importar Fluxo de Caixa (Excel)</h2>
              <p className="text-[10px] text-[#6b6b6b]">
                {step === 'upload' && obra.nome}
                {step === 'preview' && `${filename} — ${linhas.length} mês(es) na planilha`}
                {step === 'done' && 'Importação concluída'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              {/* Cabeçalho que o modelo já traz preenchido */}
              <div className="bg-[#333333] border border-[#525252] rounded-lg px-4 py-3">
                <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b] font-semibold mb-2">
                  O modelo já vem preenchido com esta obra
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <div className="flex justify-between gap-3"><span className="text-[#6b6b6b]">Obra</span><span className="text-[#f5f5f5] text-right">{obra.nome}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#6b6b6b]">Contrato</span><span className="text-[#f5f5f5] text-right">{obra.contrato || '—'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#6b6b6b]">Cliente</span><span className="text-[#f5f5f5] text-right">{obra.cliente || '—'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#6b6b6b]">Local</span><span className="text-[#f5f5f5] text-right">{obra.cidade || '—'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#6b6b6b]">Prazo</span><span className="text-[#f5f5f5] text-right">{obra.dataInicio && obra.dataFim ? `${obra.dataInicio.split('-').reverse().join('/')} a ${obra.dataFim.split('-').reverse().join('/')}` : '—'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#6b6b6b]">Valor do contrato</span><span className="text-[#f5f5f5] text-right">{obra.valorContrato && obra.valorContrato > 0 ? fmt(obra.valorContrato) : '—'}</span></div>
                </div>
                <button
                  onClick={() => baixarModeloFluxo(obra)}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:bg-[#ea580c] transition-colors"
                >
                  <Download size={12} /> Baixar modelo desta obra (.xlsx)
                </button>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors',
                  isDragging
                    ? 'border-[#f97316] bg-[#f97316]/10'
                    : 'border-[#525252] hover:border-[#f97316]/50 hover:bg-[#f97316]/5',
                )}
              >
                <Upload size={30} className={cn('transition-colors', isDragging ? 'text-[#f97316]' : 'text-[#6b6b6b]')} />
                <div className="text-center">
                  <p className="text-sm font-medium text-[#f5f5f5]">Arraste a planilha preenchida</p>
                  <p className="text-xs text-[#6b6b6b] mt-1">ou clique para selecionar</p>
                  <p className="text-[10px] text-[#6b6b6b]/60 mt-2">.xlsx (modelo do sistema) — .csv também é aceito</p>
                </div>
              </div>
              <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />

              <p className="text-[10px] text-[#6b6b6b]/80">
                Mês já cadastrado é atualizado — não duplica linha. Meses passados e o corrente continuam
                usando o realizado dos lançamentos; a projeção vale para os meses futuros.
              </p>

              {parseError && (
                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={13} className="text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-rose-300">{parseError}</p>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col gap-4">
              {obraDivergente && (
                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/40 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={14} className="text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-rose-300 leading-relaxed">
                    <b>Esta planilha foi gerada para outra obra</b>
                    {identificacao.obra ? <> (<b>{identificacao.obra}</b>)</> : null}, mas a obra ativa é <b>{obra.nome}</b>.
                    Se confirmar, a projeção será gravada em <b>{obra.nome}</b>. Troque a obra no seletor se não for isso.
                  </p>
                </div>
              )}

              {!obraDivergente && identificacao.obra && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-300">
                    Planilha da obra <b>{identificacao.obra}</b>
                    {identificacao.contrato ? <> · contrato {identificacao.contrato}</> : null}
                    {identificacao.local ? <> · {identificacao.local}</> : null}
                  </p>
                </div>
              )}

              {avisos.map((a, i) => (
                <div key={i} className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-200/90">{a}</p>
                </div>
              ))}

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 size={13} /> {validas.length} mês(es) válido(s)
                </span>
                {invalidas.length > 0 && (
                  <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                    <AlertTriangle size={13} /> {invalidas.length} ignorado(s)
                  </span>
                )}
              </div>

              <div className="bg-[#333333] border border-[#525252] rounded-xl overflow-auto max-h-96">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-[#333333]">
                    <tr className="border-b border-[#525252]">
                      {['Linha', 'Mês', 'Recebimento', 'Mão de obra', 'Material', 'Locação/Frota', 'Outros', 'Despesa total', 'Obs'].map((h) => (
                        <th key={h} className="px-2.5 py-2 text-left text-[#6b6b6b] font-medium whitespace-nowrap uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, i) => {
                      const ruim = l.erros.length > 0 || !l.dados.mes
                      return (
                        <tr key={i} className={cn('border-t border-[#525252]/50', ruim ? 'bg-rose-500/10 text-rose-300' : 'text-[#f5f5f5]')}>
                          <td className="px-2.5 py-1.5 text-[#6b6b6b]">{l.linha}</td>
                          <td className="px-2.5 py-1.5 font-mono">{l.dados.mes ? mesLabel(l.dados.mes) : '—'}</td>
                          <td className="px-2.5 py-1.5 font-mono text-emerald-400">{fmt(l.dados.recebimento_prev)}</td>
                          <td className="px-2.5 py-1.5 font-mono">{fmt(l.dados.despesa_mao_obra)}</td>
                          <td className="px-2.5 py-1.5 font-mono">{fmt(l.dados.despesa_material)}</td>
                          <td className="px-2.5 py-1.5 font-mono">{fmt(l.dados.despesa_locacao_frota)}</td>
                          <td className="px-2.5 py-1.5 font-mono">{fmt(l.dados.despesa_outros)}</td>
                          <td className="px-2.5 py-1.5 font-mono text-rose-400 font-bold">{fmt(l.dados.despesa_prev)}</td>
                          <td className="px-2.5 py-1.5 max-w-[180px] truncate" title={l.erros.join('; ') || l.dados.obs || ''}>
                            {l.erros.length > 0 ? l.erros.join('; ') : (l.dados.obs || '—')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {saveError && (
                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={13} className="text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-rose-300">{saveError}</p>
                </div>
              )}
            </div>
          )}

          {step === 'done' && result && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 size={48} className="text-emerald-400" />
              <div className="text-center">
                <p className="text-sm font-bold text-[#f5f5f5]">Importação concluída!</p>
                <p className="text-xs text-[#6b6b6b] mt-1">
                  {result.importados} mês(es) gravado(s) em {obra.nome}
                  {result.ignorados > 0 ? `, ${result.ignorados} ignorado(s)` : ''}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#525252] shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            {step === 'done' ? 'Fechar' : 'Cancelar'}
          </button>
          {step === 'preview' && (
            <div className="flex gap-2">
              <button
                onClick={() => { setStep('upload'); setLinhas([]); setFilename(''); setAvisos([]); setIdentificacao({}) }}
                className="px-4 py-2 text-xs text-[#6b6b6b] border border-[#525252] rounded-lg hover:text-[#f5f5f5] transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleImport}
                disabled={importing || validas.length === 0}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                  obraDivergente ? 'bg-rose-500 text-white hover:bg-rose-400' : 'bg-emerald-500 text-[#2c2c2c] hover:bg-emerald-400',
                )}
              >
                {importing
                  ? 'Gravando...'
                  : obraDivergente
                    ? `Gravar mesmo assim em ${obra.nome}`
                    : `Confirmar (${validas.length} mês${validas.length !== 1 ? 'es' : ''})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
