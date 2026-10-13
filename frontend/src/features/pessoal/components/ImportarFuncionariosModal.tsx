/**
 * ImportarFuncionariosModal — importador da planilha de RH em 5 passos:
 *   1 upload (.xlsx drag&drop) → 2 abas/mapeamento (auto-sugerido, remapeável)
 *   → 3 preview linha a linha (verde/amarelo/vermelho) → 4 conflitos (dry-run
 *   na Edge Function: NOVO | ATUALIZA | IGNORA por linha) → 5 commit + relatório.
 *
 * O commit REAL acontece na Edge Function `importar-funcionarios` (service
 * role) — é ela quem consegue gravar `pessoa_remuneracao` (RLS fechada).
 * Molde visual: suprimentos/ExcelImportModal. Parser: parsePlanilhaFuncionarios
 * (novo — o parser do suprimentos não serve: 1ª aba só, header fixo, sem datas).
 */
import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, FileSpreadsheet, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  lerPlanilha,
  sugerirMapeamento,
  parseLinhasAba,
  detectarTipoAba,
  CAMPOS_POR_ABA,
  type AbaTipo,
  type LinhaImportacao,
  type MapeamentoColunas,
  type PlanilhaLida,
} from '../utils/parsePlanilhaFuncionarios'
import { inputCls, btnPrimario, btnSecundario, modalOverlayCls } from './ui'

type Step = 'upload' | 'mapeamento' | 'preview' | 'conflitos' | 'commit'
const STEPS: Step[] = ['upload', 'mapeamento', 'preview', 'conflitos', 'commit']

type Acao = 'criar' | 'atualizar' | 'ignorar'

interface DryRunMatch {
  pessoaId: string
  nome: string
  regra: string
}

interface DryRunLinha {
  index: number
  match: DryRunMatch | null
}

interface RelatorioCommit {
  criadas: number
  atualizadas: number
  ignoradas: number
  erros: { index: number; nome: string; erro: string }[]
}

interface Props {
  onClose: (importou: boolean) => void
}

function edgeFunctionUrl(): string | null {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
  if (!base) return null
  return `${base.replace(/\/+$/, '')}/functions/v1/importar-funcionarios`
}

export function ImportarFuncionariosModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [filename, setFilename] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [planilha, setPlanilha] = useState<PlanilhaLida | null>(null)
  const [tipos, setTipos] = useState<Record<string, AbaTipo | ''>>({}) // nomeAba → tipo (''=ignorar)
  const [mapeamentos, setMapeamentos] = useState<Record<string, MapeamentoColunas>>({})
  const [loteId] = useState(() => crypto.randomUUID())
  const [dryRun, setDryRun] = useState<DryRunLinha[] | null>(null)
  const [acoes, setAcoes] = useState<Record<number, Acao>>({})
  const [secret, setSecret] = useState('')
  const [processando, setProcessando] = useState(false)
  const [relatorio, setRelatorio] = useState<RelatorioCommit | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── linhas interpretadas a partir do mapeamento vigente ────────────────────
  const linhas = useMemo<LinhaImportacao[]>(() => {
    if (!planilha) return []
    const out: LinhaImportacao[] = []
    for (const aba of planilha.abas) {
      const tipo = tipos[aba.nomeAba]
      if (!tipo) continue
      const map = mapeamentos[aba.nomeAba] ?? sugerirMapeamento(tipo, aba.headers)
      out.push(...parseLinhasAba(aba, tipo, map))
    }
    return out
  }, [planilha, tipos, mapeamentos])

  const validas = linhas.filter((l) => l.valid)
  const comWarning = linhas.filter((l) => l.valid && l.warnings.length > 0)
  const invalidas = linhas.filter((l) => !l.valid)

  // ── passo 1: arquivo ───────────────────────────────────────────────────────
  async function handleFile(file: File) {
    setErro(null)
    try {
      const buffer = await file.arrayBuffer()
      const lida = lerPlanilha(buffer)
      if (lida.abas.length === 0) {
        setErro('Arquivo sem abas legíveis.')
        return
      }
      const t: Record<string, AbaTipo | ''> = {}
      const m: Record<string, MapeamentoColunas> = {}
      for (const aba of lida.abas) {
        const tipo = aba.tipo ?? detectarTipoAba(aba.nomeAba) ?? ''
        t[aba.nomeAba] = tipo
        if (tipo) m[aba.nomeAba] = sugerirMapeamento(tipo, aba.headers)
      }
      setFilename(file.name)
      setPlanilha(lida)
      setTipos(t)
      setMapeamentos(m)
      setStep('mapeamento')
    } catch {
      setErro('Não foi possível ler o arquivo. Confirme que é um .xlsx válido.')
    }
  }

  // ── passo 4: dry-run na Edge Function ──────────────────────────────────────
  async function rodarDryRun() {
    setErro(null)
    const url = edgeFunctionUrl()
    if (!url) {
      setErro('VITE_SUPABASE_URL não configurada — impossível chamar a Edge Function.')
      return
    }
    setProcessando(true)
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: montarHeaders(secret),
        body: JSON.stringify({
          dryRun: true,
          loteId,
          linhas: validas.map((l, i) => ({ index: i, aba: l.aba, lineNumber: l.lineNumber, ...l.dados })),
        }),
      })
      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        throw new Error(`Edge Function respondeu ${resp.status}: ${body.slice(0, 300)}`)
      }
      const json = (await resp.json()) as { ok?: boolean; linhas?: DryRunLinha[]; error?: string }
      if (!json.ok || !Array.isArray(json.linhas)) throw new Error(json.error ?? 'resposta inesperada do dry-run')
      setDryRun(json.linhas)
      const a: Record<number, Acao> = {}
      for (const l of json.linhas) a[l.index] = l.match ? 'atualizar' : 'criar'
      setAcoes(a)
      setStep('conflitos')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErro(
        `Dry-run falhou: ${msg}. A Edge Function importar-funcionarios está deployada? (supabase functions deploy importar-funcionarios --no-verify-jwt)`,
      )
    } finally {
      setProcessando(false)
    }
  }

  // ── passo 5: commit ────────────────────────────────────────────────────────
  async function rodarCommit() {
    setErro(null)
    const url = edgeFunctionUrl()
    if (!url) return
    setProcessando(true)
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: montarHeaders(secret),
        body: JSON.stringify({
          dryRun: false,
          loteId,
          linhas: validas.map((l, i) => ({
            index: i,
            aba: l.aba,
            lineNumber: l.lineNumber,
            acao: acoes[i] ?? 'criar',
            pessoaId: dryRun?.find((d) => d.index === i)?.match?.pessoaId ?? null,
            ...l.dados,
          })),
        }),
      })
      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        throw new Error(`Edge Function respondeu ${resp.status}: ${body.slice(0, 300)}`)
      }
      const json = (await resp.json()) as { ok?: boolean; error?: string } & Partial<RelatorioCommit>
      if (!json.ok) throw new Error(json.error ?? 'resposta inesperada do commit')
      setRelatorio({
        criadas: json.criadas ?? 0,
        atualizadas: json.atualizadas ?? 0,
        ignoradas: json.ignoradas ?? 0,
        erros: json.erros ?? [],
      })
      setStep('commit')
    } catch (e) {
      setErro(`Commit falhou: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setProcessando(false)
    }
  }

  const stepIdx = STEPS.indexOf(step)

  return (
    <div className={modalOverlayCls} onClick={(e) => { if (e.target === e.currentTarget) onClose(step === 'commit') }}>
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={18} className="text-[#f97316]" />
            <div>
              <h2 className="text-sm font-bold text-[#f5f5f5]">Importar Funcionários (planilha RH)</h2>
              <p className="text-[10px] text-[#6b6b6b]">
                {step === 'upload' && 'Passo 1: Selecionar arquivo .xlsx'}
                {step === 'mapeamento' && 'Passo 2: Abas e mapeamento de colunas'}
                {step === 'preview' && 'Passo 3: Conferência linha a linha'}
                {step === 'conflitos' && 'Passo 4: Conflitos (dry-run) — NOVO / ATUALIZA / IGNORA'}
                {step === 'commit' && 'Passo 5: Importação concluída'}
              </p>
            </div>
          </div>
          <button onClick={() => onClose(step === 'commit')} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Progresso */}
        <div className="flex items-center gap-0 px-5 py-3 border-b border-[#525252]">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors',
                  step === s
                    ? 'bg-[#f97316] text-[#ffffff]'
                    : stepIdx > i
                      ? 'bg-[#22c55e] text-[#ffffff]'
                      : 'bg-[#525252] text-[#6b6b6b]',
                )}
              >
                {stepIdx > i ? <CheckCircle2 size={12} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={cn('h-px w-9', stepIdx > i ? 'bg-[#22c55e]' : 'bg-[#525252]')} />}
            </div>
          ))}
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  const f = e.dataTransfer.files[0]
                  if (f) handleFile(f)
                }}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors',
                  isDragging ? 'border-[#f97316] bg-[#f97316]/10' : 'border-[#525252] hover:border-[#f97316]/50 hover:bg-[#f97316]/5',
                )}
              >
                <Upload size={32} className={cn('transition-colors', isDragging ? 'text-[#f97316]' : 'text-[#6b6b6b]')} />
                <div className="text-center">
                  <p className="text-sm font-medium text-[#f5f5f5]">Arraste a planilha aqui</p>
                  <p className="text-xs text-[#6b6b6b] mt-1">ou clique para selecionar (.xlsx)</p>
                  <p className="text-[10px] text-[#6b6b6b] mt-2">
                    Formato esperado: abas FUNCIONÁRIOS EFETIVOS · DESLIGADOS · EM PROCESSO DE CONTRATAÇÃO
                  </p>
                </div>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          )}

          {step === 'mapeamento' && planilha && (
            <div className="space-y-4">
              <p className="text-xs text-[#6b6b6b]">
                <span className="text-[#f97316] font-medium">{filename}</span> — {planilha.abas.length} aba
                {planilha.abas.length !== 1 ? 's' : ''} · mapeamento auto-sugerido (ajuste se preciso)
              </p>
              {planilha.abas.map((aba) => {
                const tipo = tipos[aba.nomeAba]
                const map = tipo ? mapeamentos[aba.nomeAba] ?? {} : {}
                return (
                  <div key={aba.nomeAba} className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm text-[#f5f5f5] font-medium">{aba.nomeAba}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#6b6b6b]">header na linha {aba.headerRow + 1} · tratar como:</span>
                        <select
                          value={tipo}
                          onChange={(e) => {
                            const novoTipo = e.target.value as AbaTipo | ''
                            setTipos((prev) => ({ ...prev, [aba.nomeAba]: novoTipo }))
                            if (novoTipo) {
                              setMapeamentos((prev) => ({ ...prev, [aba.nomeAba]: sugerirMapeamento(novoTipo, aba.headers) }))
                            }
                          }}
                          className="bg-[#484848] border border-[#5e5e5e] rounded-lg px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none"
                        >
                          <option value="">— ignorar aba —</option>
                          <option value="efetivos">Efetivos (ativo)</option>
                          <option value="desligados">Desligados</option>
                          <option value="em_processo">Em contratação</option>
                        </select>
                      </div>
                    </div>
                    {tipo && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {CAMPOS_POR_ABA[tipo].map(({ campo, label }) => (
                          <div key={campo} className="flex items-center gap-2">
                            <span className="text-xs text-[#a3a3a3] w-44 shrink-0 truncate" title={label}>{label}</span>
                            <select
                              value={map[campo] ?? -1}
                              onChange={(e) => {
                                const col = Number(e.target.value)
                                setMapeamentos((prev) => {
                                  const atual = { ...(prev[aba.nomeAba] ?? {}) }
                                  if (col < 0) delete atual[campo]
                                  else atual[campo] = col
                                  return { ...prev, [aba.nomeAba]: atual }
                                })
                              }}
                              className="flex-1 bg-[#484848] border border-[#5e5e5e] rounded-lg px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none"
                            >
                              <option value={-1}>— sem coluna —</option>
                              {aba.headers.map((h) => (
                                <option key={h.col} value={h.col}>{h.texto}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="text-[#22c55e]">● {validas.length - comWarning.length} ok</span>
                <span className="text-[#eab308]">● {comWarning.length} com aviso</span>
                <span className="text-[#ef4444]">● {invalidas.length} inválidas</span>
                <span className="text-[#6b6b6b]">lote {loteId.slice(0, 8)}…</span>
              </div>
              <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-auto max-h-[46vh]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-[#525252]/50">
                      {['', 'Aba', 'Linha', 'Nome', 'Cargo', 'Status', 'Detalhes'].map((h) => (
                        <th key={h} className="text-left text-[#a3a3a3] text-xs font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, i) => {
                      const cor = !l.valid ? '#ef4444' : l.warnings.length > 0 ? '#eab308' : '#22c55e'
                      return (
                        <tr key={i} className="border-b border-[#525252]/30 align-top">
                          <td className="px-3 py-1.5"><span style={{ color: cor }}>●</span></td>
                          <td className="px-3 py-1.5 text-[#6b6b6b] whitespace-nowrap">{l.aba}</td>
                          <td className="px-3 py-1.5 text-[#6b6b6b] font-mono">{l.lineNumber}</td>
                          <td className="px-3 py-1.5 text-[#f5f5f5]">{l.dados.nomeCompleto || '—'}</td>
                          <td className="px-3 py-1.5 text-[#a3a3a3]">{l.dados.cargo ?? '—'}</td>
                          <td className="px-3 py-1.5 text-[#a3a3a3]">{l.dados.status}</td>
                          <td className="px-3 py-1.5 text-[#a3a3a3]">
                            {l.errors.map((e2, j) => <p key={`e${j}`} className="text-[#f87171]">{e2}</p>)}
                            {l.warnings.map((w, j) => <p key={`w${j}`} className="text-[#eab308]/90">{w}</p>)}
                            {l.errors.length === 0 && l.warnings.length === 0 && (
                              <span className="text-[#6b6b6b]">
                                {[l.dados.dataAdmissao, l.dados.encarregado, l.dados.vinculo].filter(Boolean).join(' · ') || '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'conflitos' && dryRun && (
            <div className="space-y-3">
              <p className="text-xs text-[#6b6b6b]">
                Dry-run resolvido no servidor (alias confirmado → nome exato). Escolha a ação por linha:
              </p>
              <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-auto max-h-[46vh]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-[#525252]/50">
                      {['Nome na planilha', 'Match no cadastro', 'Ação'].map((h) => (
                        <th key={h} className="text-left text-[#a3a3a3] text-xs font-medium px-3 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validas.map((l, i) => {
                      const d = dryRun.find((x) => x.index === i)
                      const acao = acoes[i] ?? (d?.match ? 'atualizar' : 'criar')
                      return (
                        <tr key={i} className="border-b border-[#525252]/30">
                          <td className="px-3 py-1.5 text-[#f5f5f5]">{l.dados.nomeCompleto}</td>
                          <td className="px-3 py-1.5">
                            {d?.match ? (
                              <span className="text-[#22c55e]">
                                {d.match.nome} <span className="text-[#6b6b6b]">({d.match.regra})</span>
                              </span>
                            ) : (
                              <span className="text-[#6b6b6b]">— sem match → NOVO —</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            <select
                              value={acao}
                              onChange={(e) => setAcoes((prev) => ({ ...prev, [i]: e.target.value as Acao }))}
                              className="bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1 text-[11px] text-[#f5f5f5] focus:outline-none"
                            >
                              <option value="criar">NOVO (criar)</option>
                              <option value="atualizar" disabled={!d?.match}>ATUALIZA {d?.match ? `→ ${d.match.nome}` : ''}</option>
                              <option value="ignorar">IGNORA</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'commit' && relatorio && (
            <div className="flex flex-col items-center gap-4 py-6">
              <CheckCircle2 size={44} className="text-[#22c55e]" />
              <div className="text-center">
                <p className="text-sm font-bold text-[#f5f5f5]">Importação concluída</p>
                <p className="text-xs text-[#a3a3a3] mt-2">
                  <span className="text-[#22c55e]">{relatorio.criadas} criadas</span> ·{' '}
                  <span className="text-[#38bdf8]">{relatorio.atualizadas} atualizadas</span> ·{' '}
                  <span className="text-[#6b6b6b]">{relatorio.ignoradas} ignoradas</span> ·{' '}
                  <span className={relatorio.erros.length > 0 ? 'text-[#ef4444]' : 'text-[#6b6b6b]'}>
                    {relatorio.erros.length} erro{relatorio.erros.length !== 1 ? 's' : ''}
                  </span>
                </p>
              </div>
              {relatorio.erros.length > 0 && (
                <div className="w-full bg-[#dc2626]/10 border border-[#dc2626]/30 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {relatorio.erros.map((e2, i) => (
                    <p key={i} className="text-[11px] text-[#f87171]">
                      {e2.nome}: {e2.erro}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {erro && (
            <div className="mt-4 flex items-start gap-2 bg-[#dc2626]/10 border border-[#dc2626]/30 rounded-lg px-3 py-2.5">
              <AlertTriangle size={13} className="text-[#ef4444] mt-0.5 shrink-0" />
              <p className="text-xs text-[#f87171]">{erro}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[#525252] flex-wrap">
          <button onClick={() => onClose(step === 'commit')} className="px-4 py-2 text-xs text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            {step === 'commit' ? 'Fechar' : 'Cancelar'}
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {(step === 'preview' || step === 'conflitos') && (
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="senha de importação (se configurada)"
                className={`${inputCls} w-56 text-xs`}
                title="Enviada como x-import-secret — só necessária se IMPORT_SECRET estiver setado na função"
              />
            )}
            {step === 'mapeamento' && (
              <button
                onClick={() => setStep('preview')}
                disabled={linhas.length === 0}
                className={`${btnPrimario} flex items-center gap-1.5 text-xs`}
              >
                Pré-visualizar {linhas.length} linhas <ChevronRight size={12} />
              </button>
            )}
            {step === 'preview' && (
              <>
                <button onClick={() => setStep('mapeamento')} className={`${btnSecundario} text-xs`}>Voltar</button>
                <button
                  onClick={rodarDryRun}
                  disabled={processando || validas.length === 0}
                  className={`${btnPrimario} flex items-center gap-1.5 text-xs`}
                >
                  {processando ? 'Consultando…' : `Conferir conflitos (${validas.length} válidas)`} <ChevronRight size={12} />
                </button>
              </>
            )}
            {step === 'conflitos' && (
              <>
                <button onClick={() => setStep('preview')} className={`${btnSecundario} text-xs`}>Voltar</button>
                <button
                  onClick={rodarCommit}
                  disabled={processando}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-[#22c55e] text-[#ffffff] hover:bg-[#16a34a] disabled:opacity-40 transition-colors"
                >
                  {processando ? 'Importando…' : `Importar ${validas.filter((_, i) => (acoes[i] ?? 'criar') !== 'ignorar').length} linhas`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function montarHeaders(secret: string): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret.trim()) headers['x-import-secret'] = secret.trim()
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
  if (anon) {
    headers['authorization'] = `Bearer ${anon}`
    headers['apikey'] = anon
  }
  return headers
}
