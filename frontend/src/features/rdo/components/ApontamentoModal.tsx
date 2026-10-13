/**
 * ApontamentoModal — cola a mensagem do grupo (apontamento por tags),
 * mostra o preview interpretado (nada é descartado sem mostrar) e grava
 * RDO fechado + atividades no Supabase; o trigger do banco gera a medição.
 */
import { useMemo, useState } from 'react'
import { ClipboardPaste, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { useProjectContext } from '@/store/projectContext'
import { useAppModeStore } from '@/store/appModeStore'
import { parseApontamento, type ApontamentoParse } from '@/utils/parseApontamento'
import {
  carregarCatalogoPrecos,
  carregarRegiaoProjeto,
  salvarApontamento,
  type CatalogoPreco,
} from '@/hooks/useApontamento'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const CARTILHA = `MODELO DE APONTAMENTO (1 serviço por linha):
23/07/2026
EQUIPE EDIEL — BOI MALHADO
LA 4 PA            → ligação de água sucessiva, posição PA/TA/EIXO/TO/PO (obrigatória)
LA MND 6           → ligação de água MND (AV = avulsa)
REDE AGUA 63 100M  → rede de água DN 63, 100 metros (MND só anota)
REDE ESGOTO 150 2,7M 45M → DN 150, prof 2,7m, 45 metros
LE 3 PA            → ligação de esgoto (posição obrigatória; 4M = avulsa 2-4m)
3 CAIXA UMA · 2 CI · PV 3M · PI · RAMAL 150 20M
HM 5               → vira CV + hidrômetro (2 itens)
INTRA AGUA / INTRA TIPO 2 / INTRA PARCIAL
INTERLIG · VALVULA FF · CONEX SELA 63 · CONEX LUVA 32
LRP REDE ESGOTO 30M · LPB REDE AGUA 25M · CBUQ REDE ESGOTO 40M
COMUNICADO 12 · INTERF AGUA
Obs: linha começando com "obs" vira observação (não mede).
Números de casa (casa 12, casas 45 e 43) NUNCA viram quantidade.`

interface PreviewLinha {
  linhaOriginal: string
  interpretacao: string
  codigo: string | null
  qtd: number | null
  unidade: string | null
  preco60: number | null
  valor: number | null
  revisar: boolean
  motivo?: string
}

export function ApontamentoModal({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)

  const [texto, setTexto] = useState('')
  const [parse, setParse] = useState<ApontamentoParse | null>(null)
  const [catalogo, setCatalogo] = useState<Map<string, CatalogoPreco>>(new Map())
  const [catalogoAviso, setCatalogoAviso] = useState<string | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  async function analisar() {
    setErro(null)
    setSucesso(null)
    setAnalisando(true)
    try {
      const p = parseApontamento(texto)
      setParse(p)
      setCatalogo(new Map())
      setCatalogoAviso(null)
      if (activeProjectId) {
        const regiao = await carregarRegiaoProjeto(activeProjectId)
        if (regiao) {
          const ano = p.data ? p.data.slice(0, 4) : String(new Date().getFullYear())
          const cat = await carregarCatalogoPrecos(regiao, ano)
          setCatalogo(cat)
          if (cat.size === 0) setCatalogoAviso(`tabela de preços ${ano} vazia pra região ${regiao} — itens sairão sem preço`)
        } else {
          setCatalogoAviso('projeto sem regiao_codigo cadastrado — itens sairão sem preço (pendente)')
        }
      }
    } finally {
      setAnalisando(false)
    }
  }

  const linhas: PreviewLinha[] = useMemo(() => {
    if (!parse) return []
    return parse.itens.map((it) => {
      const cat = it.descricaoContrato ? catalogo.get(it.descricaoContrato) : undefined
      const preco60 = cat ? Math.round(cat.valor_unitario * cat.fator_wcr * 100) / 100 : null
      return {
        linhaOriginal: it.linhaOriginal,
        interpretacao: it.descricaoContrato ?? `${it.tag}${it.qualificadores.length ? ' ' + it.qualificadores.join(' ') : ''}`,
        codigo: cat?.codigo ?? null,
        qtd: it.qtd,
        unidade: cat?.unidade ?? null,
        preco60,
        valor: preco60 !== null && it.qtd !== null ? Math.round(preco60 * it.qtd * 100) / 100 : null,
        revisar: it.revisar,
        motivo: it.motivoRevisar,
      }
    })
  }, [parse, catalogo])

  const nMedidos = linhas.filter((l) => !l.revisar).length
  const nRevisar = linhas.filter((l) => l.revisar).length
  const nObs = parse?.observacoes.length ?? 0
  const totalPreview = linhas.reduce((acc, l) => acc + (l.valor ?? 0), 0)

  const bloqueio = isDemoMode
    ? 'Modo Demonstração ativo — desative para gravar'
    : !activeProjectId
      ? 'Selecione um projeto ativo'
      : parse && !parse.data
        ? 'Apontamento sem data única — corrija a data'
        : null

  async function confirmar() {
    if (!parse || bloqueio) return
    setErro(null)
    setSalvando(true)
    try {
      const r = await salvarApontamento({
        projetoId: activeProjectId,
        isDemoMode,
        parse,
        textoOriginal: texto,
        catalogo,
      })
      setSucesso(`Apontamento salvo: ${r.totalAtividades} atividades no RDO ${parse.data} (${nMedidos} medidas, ${nRevisar} pra revisar). A medição foi gerada automaticamente.`)
      onSaved?.()
      setTimeout(onClose, 2200)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ClipboardPaste size={15} className="text-[#38bdf8]" /> Colar apontamento (WhatsApp → RDO → Medição)
          </h3>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={'Cole aqui a mensagem do grupo…\n\nEx.:\nAPONTAMENTO 23/07/2026\nEQUIPE EDIEL — BOI MALHADO\nLA 2\nREDE AGUA 63 MND 100M\n3 CAIXA UMA'}
            rows={7}
            className="w-full bg-[#3d3d3d] border border-[#525252] rounded-md px-3 py-2 text-[13px] font-mono text-[#f5f5f5] focus:outline-none focus:border-[#38bdf8] resize-y"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={analisar}
              disabled={analisando || texto.trim().length < 5}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#38bdf8]/15 border border-[#38bdf8]/40 text-[#38bdf8] text-[12px] font-semibold hover:bg-[#38bdf8]/25 disabled:opacity-40"
            >
              {analisando ? <Loader2 size={13} className="animate-spin" /> : null} Analisar
            </button>
            <details className="text-[11px] text-[#8a8a8a]">
              <summary className="cursor-pointer hover:text-[#f5f5f5]">ver modelo de apontamento</summary>
              <pre className="mt-2 whitespace-pre-wrap bg-[#1f1f1f] border border-[#3f3f3f] rounded-md p-3 text-[10px] leading-relaxed text-[#c9c9c9]">{CARTILHA}</pre>
            </details>
          </div>

          {parse && (
            <>
              {/* eco */}
              <div className="flex items-center gap-3 flex-wrap text-[12px]">
                <span className="font-bold text-[#f5f5f5]">
                  {nMedidos} {nMedidos === 1 ? 'item medido' : 'itens medidos'} · {nRevisar} pra revisar · {nObs} {nObs === 1 ? 'observação' : 'observações'}
                </span>
                <span className="text-[#8a8a8a]">
                  {parse.data ? `data ${parse.data.split('-').reverse().join('/')}` : 'SEM DATA'}
                  {parse.equipe ? ` · equipe ${parse.equipe}` : ''}
                  {parse.nucleo ? ` · ${parse.nucleo}` : ''}
                </span>
                {totalPreview > 0 && <span className="font-bold text-[#22c55e]">{brl(totalPreview)} (60% WCR)</span>}
              </div>

              {(parse.avisos.length > 0 || catalogoAviso) && (
                <div className="rounded-md border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-3 py-2 flex flex-col gap-0.5">
                  {[...parse.avisos, ...(catalogoAviso ? [catalogoAviso] : [])].map((a, i) => (
                    <div key={i} className="text-[11px] text-[#f59e0b] flex items-center gap-1.5">
                      <AlertTriangle size={11} className="shrink-0" /> {a}
                    </div>
                  ))}
                </div>
              )}

              {/* tabela preview */}
              {linhas.length > 0 && (
                <div className="rounded-lg border border-[#3f3f3f] overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-[#333333] text-[#8a8a8a] uppercase text-[9px]">
                        <th className="text-left px-2.5 py-1.5 font-bold">Linha original</th>
                        <th className="text-left px-2.5 py-1.5 font-bold">Interpretação (contrato)</th>
                        <th className="text-left px-2.5 py-1.5 font-bold">Cód.</th>
                        <th className="text-right px-2.5 py-1.5 font-bold">Qtd</th>
                        <th className="text-left px-2.5 py-1.5 font-bold">Un</th>
                        <th className="text-right px-2.5 py-1.5 font-bold">Preço 60%</th>
                        <th className="text-right px-2.5 py-1.5 font-bold">Valor</th>
                        <th className="px-2.5 py-1.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((l, i) => (
                        <tr key={i} className={['border-t border-[#3f3f3f]', l.revisar ? 'bg-[#f59e0b]/5' : ''].join(' ')}>
                          <td className="px-2.5 py-1.5 text-[#a3a3a3] max-w-[180px] truncate" title={l.linhaOriginal}>{l.linhaOriginal}</td>
                          <td className="px-2.5 py-1.5 text-[#f5f5f5]">
                            {l.interpretacao}
                            {l.motivo && <div className="text-[10px] text-[#f59e0b]">{l.motivo}</div>}
                          </td>
                          <td className="px-2.5 py-1.5 text-[#8a8a8a]">{l.codigo ?? '—'}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#f5f5f5]">{l.qtd ?? '—'}</td>
                          <td className="px-2.5 py-1.5 text-[#8a8a8a]">{l.unidade ?? '—'}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#8a8a8a]">{l.preco60 !== null ? brl(l.preco60) : '—'}</td>
                          <td className="px-2.5 py-1.5 text-right font-semibold text-[#22c55e]">{l.valor !== null ? brl(l.valor) : '—'}</td>
                          <td className="px-2.5 py-1.5">
                            {l.revisar ? (
                              <span className="text-[9px] font-bold uppercase rounded px-1.5 py-0.5 border text-[#f59e0b] border-[#f59e0b]/40 bg-[#f59e0b]/10">Revisar</span>
                            ) : (
                              <span className="text-[9px] font-bold uppercase rounded px-1.5 py-0.5 border text-[#22c55e] border-[#22c55e]/40 bg-[#22c55e]/10">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* observações — nada é descartado sem mostrar */}
              {parse.observacoes.length > 0 && (
                <div className="rounded-lg border border-[#3f3f3f] bg-[#2f2f2f] px-3 py-2">
                  <div className="text-[9px] font-bold uppercase text-[#8a8a8a] mb-1">Observações (não medem)</div>
                  {parse.observacoes.map((o, i) => (
                    <div key={i} className="text-[11px] text-[#a3a3a3]">{o}</div>
                  ))}
                </div>
              )}
            </>
          )}

          {erro && <div className="text-[12px] text-[#ef4444]">{erro}</div>}
          {sucesso && (
            <div className="flex items-center gap-2 text-[12px] text-[#22c55e]">
              <CheckCircle2 size={14} /> {sucesso}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-[#525252]">
          <div className="text-[11px] text-[#f59e0b]">{parse && bloqueio ? bloqueio : ''}</div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-md text-[12px] text-[#a3a3a3] hover:text-[#f5f5f5] border border-[#3f3f3f]">
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={!parse || parse.itens.length === 0 || !!bloqueio || salvando || !!sucesso}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#22c55e]/15 border border-[#22c55e]/40 text-[#22c55e] text-[12px] font-semibold hover:bg-[#22c55e]/25 disabled:opacity-40"
            >
              {salvando ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Confirmar e gerar RDO + medição
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
