/**
 * ImportarModal — sobe a CONTROLE OPERACIONAL rev16 e mostra a PRÉVIA antes de gravar.
 *
 *   arquivo → assinatura (recusa ZN/desconhecida) → leitura → dados atuais de cada obra
 *   do arquivo (inclusive excluídos) → reconciliação → PRÉVIA com seleção → gravar.
 *
 * Nada é gravado sem a pessoa ver o quadro NOVO / MUDOU / IGUAL / ERRO / AUSENTE /
 * CONFLITO / EXCLUÍDO e confirmar. AUSENTE só aponta; nunca apaga.
 */
import { useMemo, useState } from 'react'
import {
  X, FileSpreadsheet, AlertTriangle, CheckCircle2, Plus, Equal, ArrowRight, Ban, FileWarning, Split, Undo2,
  ChevronDown, ChevronRight, Loader2, ListX,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { AreaDeSoltar } from '@/components/shared/AreaDeSoltar'
import { carregarDadosOp } from '@/hooks/useControleOperacional'
import type { DadosOp } from '../dominio/tipos'
import { avisosDaLeitura, contagensDaLeitura, lerArquivoRev16, type LeituraRev16 } from './lerPlanilhaRev16'
import {
  contratosDaLeitura, projetoDoContrato, reconciliar, resumoGeral, VEREDICTOS,
  type GrupoRecon, type PessoaRef, type ProjetoRef, type ResultadoReconciliacao, type VeredictoOp,
} from './reconciliar'
import { contarEscritas, executarPlano, planejarEscritas, type ResultadoGravacao } from './gravarImportacao'
import { btnNeutro, btnPrimario } from '../components/ui'

type Passo = 'upload' | 'lendo' | 'previa' | 'gravando' | 'pronto'

const COR: Record<VeredictoOp, { cls: string; icone: typeof Plus; rotulo: string }> = {
  NOVO: { cls: 'bg-green-500/15 text-green-300', icone: Plus, rotulo: 'Novo' },
  MUDOU: { cls: 'bg-amber-500/15 text-amber-200', icone: ArrowRight, rotulo: 'Mudou' },
  IGUAL: { cls: 'bg-[#484848] text-[#a3a3a3]', icone: Equal, rotulo: 'Igual' },
  ERRO: { cls: 'bg-red-500/15 text-red-300', icone: Ban, rotulo: 'Erro' },
  AUSENTE: { cls: 'bg-sky-500/15 text-sky-300', icone: FileWarning, rotulo: 'Ausente' },
  CONFLITO: { cls: 'bg-fuchsia-500/15 text-fuchsia-300', icone: Split, rotulo: 'Conflito' },
  EXCLUIDO: { cls: 'bg-[#484848] text-[#6b6b6b]', icone: Undo2, rotulo: 'Excluído' },
}

const SELECIONAVEL = new Set<VeredictoOp>(['NOVO', 'MUDOU', 'AUSENTE'])

async function sha256(buf: ArrayBuffer): Promise<string | null> {
  try {
    const h = await globalThis.crypto.subtle.digest('SHA-256', buf)
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch { return null }
}

const txt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))

function Grupo({ g, onMarcar }: { g: GrupoRecon; onMarcar: (idx: number | 'todos' | 'nenhum', v?: boolean) => void }) {
  const relevante = g.resumo.NOVO + g.resumo.MUDOU + g.resumo.ERRO + g.resumo.AUSENTE + g.resumo.CONFLITO + g.resumo.EXCLUIDO > 0
  const [aberto, setAberto] = useState(relevante && g.linhas.length <= 80)
  const [soMudancas, setSoMudancas] = useState(true)
  const linhas = g.linhas.map((l, i) => ({ l, i })).filter(({ l }) => !soMudancas || l.veredicto !== 'IGUAL')
  return (
    <div className="border border-[#525252] rounded-lg">
      <button className="w-full flex flex-wrap items-center gap-2 px-3 py-2 text-left" onClick={() => setAberto(!aberto)}>
        {aberto ? <ChevronDown size={14} className="text-[#a3a3a3]" /> : <ChevronRight size={14} className="text-[#a3a3a3]" />}
        <span className="text-sm text-[#f5f5f5] font-medium">aba {g.aba} · {g.rotulo}</span>
        {VEREDICTOS.filter((v) => g.resumo[v] > 0).map((v) => (
          <span key={v} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${COR[v].cls}`}>{COR[v].rotulo} {g.resumo[v]}</span>
        ))}
        {g.linhas.length === 0 && <span className="text-xs text-[#6b6b6b]">nada no arquivo</span>}
      </button>
      {aberto && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#a3a3a3]">
            <span>escopo do "ausente": {g.escopo}</span>
            <label className="flex items-center gap-1"><input type="checkbox" className="accent-[#f97316]" checked={soMudancas} onChange={(e) => setSoMudancas(e.target.checked)} /> esconder IGUAL</label>
            <button className="underline" onClick={() => onMarcar('todos')}>marcar tudo</button>
            <button className="underline" onClick={() => onMarcar('nenhum')}>desmarcar tudo</button>
          </div>
          {g.avisos.map((a) => <p key={a} className="text-xs text-amber-200 flex gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{a}</p>)}
          {linhas.length > 0 && (
            <div className="overflow-x-auto max-h-[36vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#3d3d3d]"><tr className="border-b border-[#525252]/50">
                  <th className="w-8"></th>
                  <th className="text-left text-[#a3a3a3] text-xs font-medium px-2 py-1.5">Ln</th>
                  <th className="text-left text-[#a3a3a3] text-xs font-medium px-2 py-1.5">Situação</th>
                  <th className="text-left text-[#a3a3a3] text-xs font-medium px-2 py-1.5">Registro</th>
                  <th className="text-left text-[#a3a3a3] text-xs font-medium px-2 py-1.5">O que muda / problema</th>
                </tr></thead>
                <tbody>{linhas.slice(0, 500).map(({ l, i }) => {
                  const C = COR[l.veredicto]; const Icone = C.icone
                  return (
                    <tr key={i} className="border-b border-[#525252]/40 align-top">
                      <td className="px-2 py-1">
                        <input type="checkbox" className="accent-[#f97316]" disabled={!SELECIONAVEL.has(l.veredicto)} checked={l.selecionada}
                          onChange={(e) => onMarcar(i, e.target.checked)} />
                      </td>
                      <td className="px-2 py-1 text-xs font-mono text-[#6b6b6b]">{l.linha || '—'}</td>
                      <td className="px-2 py-1"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${C.cls}`}><Icone size={10} /> {C.rotulo}</span></td>
                      <td className="px-2 py-1 text-[#f5f5f5] max-w-[280px] truncate" title={l.rotulo}>{l.rotulo}</td>
                      <td className="px-2 py-1 text-xs">
                        {l.problemas.map((p, j) => <div key={j} className={p.bloqueia ? 'text-red-300' : 'text-amber-200'}>{p.bloqueia ? '✕' : '!'} {p.mensagem}</div>)}
                        {l.alteracoes.map((a, j) => (
                          <div key={j} className="text-[#a3a3a3]">
                            <span className="text-[#6b6b6b]">{a.campo}:</span> <span className="line-through text-[#6b6b6b]">{txt(a.antes)}</span> → <span className="text-amber-200">{txt(a.depois)}</span>
                          </div>
                        ))}
                        {l.veredicto === 'IGUAL' && <span className="text-[#6b6b6b]">nada muda — não grava</span>}
                      </td>
                    </tr>
                  )
                })}</tbody>
              </table>
              {linhas.length > 500 && <p className="text-xs text-[#6b6b6b] px-2 py-1">mostrando 500 de {linhas.length}; a seleção vale para todas</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ImportarModal({ onClose }: { onClose: (importou: boolean) => void }) {
  const ehAdmin = useAuthStore((s) => s.profile?.is_global_admin === true)
  const [passo, setPasso] = useState<Passo>('upload')
  const [arquivo, setArquivo] = useState('')
  const [hash, setHash] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [progresso, setProgresso] = useState('')
  const [leitura, setLeitura] = useState<LeituraRev16 | null>(null)
  const [recon, setRecon] = useState<ResultadoReconciliacao | null>(null)
  const [resultado, setResultado] = useState<ResultadoGravacao | null>(null)
  const [verNaoEntendidas, setVerNaoEntendidas] = useState(false)
  const [verAvisos, setVerAvisos] = useState(false)
  const avisosLinha = useMemo(() => (leitura ? avisosDaLeitura(leitura) : []), [leitura])

  async function processar(file: File) {
    setErro(null); setArquivo(file.name); setPasso('lendo')
    try {
      if (!/\.(xlsx|xlsm)$/i.test(file.name)) throw new Error('Envie a planilha .xlsx (CONTROLE OPERACIONAL SABESP rev16).')
      if (!supabase) throw new Error('Supabase não configurado — não há onde comparar nem gravar.')
      setProgresso('lendo a planilha…')
      const buf = await file.arrayBuffer()
      setHash(await sha256(buf))
      const { assinatura, leitura: l } = lerArquivoRev16(new Uint8Array(buf))
      if (!assinatura.ok || !l) throw new Error(assinatura.mensagem)
      setLeitura(l)

      setProgresso('procurando as obras dos contratos…')
      const { data: projs, error: eProj } = await supabase.from('projetos').select('id, nome, org_id')
      if (eProj) throw new Error(`não consegui ler as obras: ${eProj.message}`)
      const projetos = (projs ?? []) as ProjetoRef[]
      const alvo = new Map<string, ProjetoRef>()
      for (const c of contratosDaLeitura(l)) {
        const p = projetoDoContrato(c, projetos)
        if (p) alvo.set(p.id, p)
      }

      const existentes = new Map<string, DadosOp>()
      for (const p of alvo.values()) {
        setProgresso(`lendo o que já existe em ${p.nome}…`)
        const carga = await carregarDadosOp(p.id, { incluirExcluidos: true, comSalario: ehAdmin })
        if (carga.tabelasAusentes) throw new Error('As tabelas do Controle Operacional não existem neste banco — a migration 035 não foi aplicada.')
        if (carga.erro) throw new Error(`${p.nome}: ${carga.erro}`)
        existentes.set(p.id, carga.dados)
      }

      setProgresso('casando as pessoas da aba 08 com o cadastro…')
      const orgs = [...new Set([...alvo.values()].map((p) => p.org_id).filter(Boolean))] as string[]
      const pessoas: PessoaRef[] = []
      for (let de = 0; orgs.length; de += 1000) {
        const { data, error } = await supabase.from('pessoas').select('id, nome_completo, org_id').in('org_id', orgs).order('id').range(de, de + 999)
        if (error) break
        pessoas.push(...((data ?? []) as PessoaRef[]))
        if (!data || data.length < 1000) break
      }

      setProgresso('comparando…')
      setRecon(reconciliar({ leitura: l, projetos: [...alvo.values()], existentes, pessoas, ehAdmin }))
      setPasso('previa')
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      setPasso('upload')
    }
  }

  function marcar(projetoId: string, entidade: string, idx: number | 'todos' | 'nenhum', v?: boolean) {
    setRecon((r) => r && ({
      ...r,
      projetos: r.projetos.map((p) => p.projetoId !== projetoId ? p : {
        ...p,
        grupos: p.grupos.map((g) => g.entidade !== entidade ? g : {
          ...g,
          linhas: g.linhas.map((l, i) => {
            if (!SELECIONAVEL.has(l.veredicto)) return l
            if (idx === 'todos') return { ...l, selecionada: true }
            if (idx === 'nenhum') return { ...l, selecionada: false }
            return i === idx ? { ...l, selecionada: !!v } : l
          }),
        }),
      }),
    }))
  }

  const plano = useMemo(() => (recon ? planejarEscritas(recon) : null), [recon])
  const escritas = plano ? contarEscritas(plano) : { gravar: 0, ausentes: 0, total: 0 }
  const total = recon ? resumoGeral(recon) : null

  async function gravar() {
    if (!recon || !plano || !supabase) return
    setPasso('gravando'); setErro(null)
    const resumoPorProjeto: Record<string, Record<string, unknown>> = {}
    for (const p of recon.projetos) {
      resumoPorProjeto[p.projetoId] = {
        contrato: p.contrato,
        abas: Object.fromEntries(p.grupos.map((g) => [g.entidade, g.resumo])),
        nao_entendidas: recon.naoEntendidas.length,
        nao_entendidas_amostra: recon.naoEntendidas.slice(0, 50),
        contratos_sem_obra: recon.contratosSemProjeto,
      }
    }
    try {
      const r = await executarPlano(supabase, plano, { arquivo, sha256: hash, resumoPorProjeto }, setProgresso)
      setResultado(r)
    } catch (e) {
      setResultado({ gravadas: 0, ausentesApontados: 0, pessoasCriadas: 0, erros: [e instanceof Error ? e.message : String(e)] })
    }
    setPasso('pronto')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-6xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={18} className="text-[#f97316]" />
            <h2 className="text-sm font-semibold text-[#f5f5f5]">Importar CONTROLE OPERACIONAL SABESP (rev16)</h2>
          </div>
          <button onClick={() => onClose(passo === 'pronto')} disabled={passo === 'gravando'} className="text-[#a3a3a3] hover:text-[#f5f5f5]"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {passo === 'upload' && (
            <>
              <div className="bg-[#333333] border border-[#525252] rounded-lg p-4 space-y-1.5 text-xs text-[#a3a3a3]">
                <p className="text-sm text-[#f5f5f5] font-medium">A planilha entra comparada com o que já está no sistema.</p>
                <p>Cada CONTRATO vira a obra de mesmo nome ("BERTIOGA" → "WCR — Bertioga"). Só o que é digitado entra: fórmula é recalculada aqui.</p>
                <p>Antes de gravar você vê linha a linha o que é novo, o que mudou, o que sumiu da planilha (só apontado, nunca apagado) e o que está em conflito.</p>
                {!ehAdmin && <p className="text-amber-200">Você não é administrador: salários da aba 08 não serão importados.</p>}
              </div>
              <AreaDeSoltar aceita=".xlsx,.xlsm" aoEscolher={(fs) => { if (fs[0]) void processar(fs[0]) }}
                titulo="Arraste a planilha CONTROLE OPERACIONAL aqui ou clique para escolher" />
              {erro && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {erro}
                </div>
              )}
            </>
          )}

          {(passo === 'lendo' || passo === 'gravando') && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-[#a3a3a3]">
              <Loader2 size={24} className="animate-spin text-[#f97316]" /> {progresso}
            </div>
          )}

          {passo === 'previa' && recon && leitura && total && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#a3a3a3]">
                <FileSpreadsheet size={13} /> {arquivo} {hash && <span className="font-mono text-[#6b6b6b]">sha256 {hash.slice(0, 12)}…</span>}
              </div>

              <div className="bg-[#333333] border border-[#525252] rounded-lg p-3">
                <p className="text-xs text-green-300 mb-1 flex items-center gap-1"><CheckCircle2 size={12} /> O que o arquivo trouxe (lido com sucesso)</p>
                <p className="text-xs text-[#f5f5f5]">{contagensDaLeitura(leitura).filter((c) => c.n > 0).map((c) => `${c.n} ${c.rotulo}`).join(' · ')}</p>
              </div>

              <div className="flex gap-2 overflow-x-auto">
                {VEREDICTOS.map((v) => {
                  const C = COR[v]; const Icone = C.icone
                  return (
                    <div key={v} className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-3 py-2 min-w-[100px]">
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#a3a3a3]"><Icone size={11} /> {C.rotulo}</div>
                      <div className={`font-mono text-lg font-semibold ${(v === 'ERRO' || v === 'CONFLITO') && total[v] > 0 ? 'text-red-400' : 'text-[#f5f5f5]'}`}>{total[v]}</div>
                    </div>
                  )
                })}
              </div>

              {recon.contratosSemProjeto.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  Contrato(s) sem obra no sistema: {recon.contratosSemProjeto.join(', ')}. Nada deles entra — cadastre a obra "WCR — {recon.contratosSemProjeto[0]}" em Projetos e importe de novo.
                </div>
              )}
              {recon.avisos.map((a) => (
                <div key={a} className="flex items-start gap-2 text-xs text-amber-200"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {a}</div>
              ))}

              {recon.naoEntendidas.length > 0 && (
                <div className="border border-[#525252] rounded-lg">
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-[#f5f5f5]" onClick={() => setVerNaoEntendidas(!verNaoEntendidas)}>
                    {verNaoEntendidas ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <ListX size={14} className="text-amber-300" /> {recon.naoEntendidas.length} linha(s) que o importador NÃO entendeu (não entram)
                  </button>
                  {verNaoEntendidas && (
                    <ul className="px-4 pb-3 space-y-0.5 text-xs text-[#a3a3a3] max-h-60 overflow-y-auto">
                      {recon.naoEntendidas.map((n, i) => <li key={i}><span className="font-mono text-[#6b6b6b]">aba {n.aba} · linha {n.linha ?? '—'}</span> — {n.motivo}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {avisosLinha.length > 0 && (
                <div className="border border-[#525252] rounded-lg">
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-[#f5f5f5]" onClick={() => setVerAvisos(!verAvisos)}>
                    {verAvisos ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <AlertTriangle size={14} className="text-amber-300" /> {avisosLinha.length} aviso(s) de linha — entram como vieram, mas merecem conferência
                  </button>
                  {verAvisos && (
                    <ul className="px-4 pb-3 space-y-0.5 text-xs text-[#a3a3a3] max-h-60 overflow-y-auto">
                      {avisosLinha.map((a, i) => <li key={i}><span className="font-mono text-[#6b6b6b]">aba {a.aba} · linha {a.linha}</span> — {a.mensagem}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {recon.projetos.length === 0 && <p className="text-sm text-red-300">Nenhum contrato do arquivo casou com uma obra do sistema — nada a importar.</p>}
              {recon.projetos.map((p) => (
                <div key={p.projetoId} className="space-y-2">
                  <h3 className="text-sm font-semibold text-[#f97316]">{p.projetoNome} <span className="text-xs text-[#a3a3a3] font-normal">(contrato {p.contrato})</span></h3>
                  {p.grupos.map((g) => (
                    <Grupo key={g.entidade} g={g} onMarcar={(idx, v) => marcar(p.projetoId, g.entidade, idx, v)} />
                  ))}
                </div>
              ))}
            </>
          )}

          {passo === 'pronto' && resultado && (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 size={40} className={`mx-auto ${resultado.erros.length ? 'text-amber-300' : 'text-green-400'}`} />
              <p className="text-base font-semibold text-[#f5f5f5]">{resultado.erros.length ? 'Importação concluída com pendências' : 'Importação concluída'}</p>
              <div className="flex justify-center gap-6 text-sm text-[#a3a3a3]">
                <span><span className="font-mono text-green-300 text-lg">{resultado.gravadas}</span> gravadas</span>
                <span><span className="font-mono text-sky-300 text-lg">{resultado.ausentesApontados}</span> apontadas como ausentes</span>
                <span><span className="font-mono text-amber-200 text-lg">{resultado.pessoasCriadas}</span> pessoas criadas (revisar no RH)</span>
              </div>
              {resultado.erros.length > 0 && (
                <div className="text-left max-w-2xl mx-auto mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
                  <p className="text-xs font-semibold text-red-200 mb-1">{resultado.erros.length} gravação(ões) falharam — o resto entrou; importar de novo não duplica:</p>
                  <ul className="text-xs text-red-200/80 space-y-0.5 max-h-40 overflow-y-auto">{resultado.erros.map((e, i) => <li key={i}>· {e}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[#525252]">
          <div className="text-xs text-[#6b6b6b]">
            {passo === 'previa' && `${escritas.gravar} linha(s) para gravar · ${escritas.ausentes} para apontar como ausente`}
          </div>
          <div className="flex gap-2">
            {passo === 'previa' && (
              <button className={btnNeutro} onClick={() => { setPasso('upload'); setRecon(null); setLeitura(null) }}>Trocar arquivo</button>
            )}
            {passo === 'previa' ? (
              <button className={btnPrimario} disabled={escritas.total === 0} onClick={() => void gravar()}>
                {escritas.total === 0 ? 'Nada a gravar' : `Confirmar e gravar (${escritas.total})`}
              </button>
            ) : (
              <button className={btnNeutro} disabled={passo === 'gravando' || passo === 'lendo'} onClick={() => onClose(passo === 'pronto')}>
                {passo === 'pronto' ? 'Fechar' : 'Cancelar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
