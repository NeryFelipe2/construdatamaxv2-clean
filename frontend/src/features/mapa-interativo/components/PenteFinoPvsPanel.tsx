/**
 * PenteFinoPvsPanel — painel/legenda da camada de PVs do PENTE FINO sobre o
 * Mapa Interativo. Liga e desliga a camada, mostra a contagem por status do
 * cronograma inteiro e — o ponto honesto — avisa em âmbar quantos PVs do
 * cronograma NÃO têm coordenada casada no cadastro (`pv`), listando quais.
 * Esses nunca aparecem no mapa: posição não se inventa.
 */
import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, SearchCheck } from 'lucide-react'
import type { PenteFinoSemCoord, PenteFinoStatus } from '@/hooks/usePenteFinoPvs'
import { PENTE_FINO_CORES, PENTE_FINO_LABELS, ddmm } from './PenteFinoPvsLayer'

interface Resumo {
  feito: number
  aFazer: number
  semConfirmacao: number
  plotados: number
  semCoordenada: number
  total: number
}

interface Props {
  resumo: Resumo
  semCoordenada: PenteFinoSemCoord[]
  ativo: boolean
  onToggle: (v: boolean) => void
  loading: boolean
  error: string | null
}

function LinhaStatus({ status, n }: { status: PenteFinoStatus; n: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 shrink-0" style={{ backgroundColor: PENTE_FINO_CORES[status] }} />
      <span className="text-[9px] uppercase tracking-[0.12em] text-[#64748b]">{PENTE_FINO_LABELS[status]}</span>
      <span className="ml-auto text-[11px] font-mono [font-variant-numeric:tabular-nums] text-[#e2e8f0]">{n}</span>
    </div>
  )
}

export function PenteFinoPvsPanel({ resumo, semCoordenada, ativo, onToggle, loading, error }: Props) {
  const [aberto, setAberto] = useState(true)
  const [listaAberta, setListaAberta] = useState(false)

  return (
    <div className="absolute bottom-3 left-3 z-[1000] w-[238px] bg-[#0a0f1a]/95 border border-[#1e293b] backdrop-blur-sm">
      {/* header + toggle da camada */}
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-[#1e293b]">
        <button
          onClick={() => setAberto((v) => !v)}
          className="flex items-center gap-2 text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
        >
          <SearchCheck size={12} />
          <span className="text-[10px] uppercase tracking-[0.16em] font-semibold">Pente Fino · PVs</span>
          {aberto ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
        <button
          onClick={() => onToggle(!ativo)}
          className={`ml-auto px-1.5 py-0.5 border text-[9px] uppercase tracking-[0.14em] transition-colors ${
            ativo
              ? 'border-[#22c55e]/50 bg-[#22c55e]/10 text-[#22c55e]'
              : 'border-[#1e293b] bg-transparent text-[#475569] hover:text-[#94a3b8]'
          }`}
          title={ativo ? 'Ocultar camada do pente fino' : 'Mostrar camada do pente fino'}
        >
          {ativo ? 'On' : 'Off'}
        </button>
      </div>

      {aberto && (
        <div className="px-2.5 py-2 flex flex-col gap-1.5">
          {loading && (
            <div className="text-[9px] uppercase tracking-[0.14em] text-[#475569]">Carregando cronograma…</div>
          )}

          {error && (
            <div className="px-1.5 py-1 border border-[#ef4444]/40 bg-[#ef4444]/10 text-[9px] uppercase tracking-[0.12em] text-[#ef4444]">
              {error}
            </div>
          )}

          {!loading && !error && resumo.total === 0 && (
            <div className="text-[9px] uppercase tracking-[0.12em] text-[#64748b] leading-relaxed">
              Sem cronograma de pente fino para este projeto
            </div>
          )}

          {!error && resumo.total > 0 && (
            <>
              {/* números do cronograma */}
              <div className="flex items-end gap-2 pb-1.5 border-b border-[#1e293b]">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-[0.14em] text-[#475569]">No mapa</span>
                  <span className="text-[18px] leading-none font-mono [font-variant-numeric:tabular-nums] text-[#e2e8f0]">
                    {resumo.plotados}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#334155] pb-0.5">/</span>
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-[0.14em] text-[#475569]">No cronograma</span>
                  <span className="text-[18px] leading-none font-mono [font-variant-numeric:tabular-nums] text-[#64748b]">
                    {resumo.total}
                  </span>
                </div>
              </div>

              <LinhaStatus status="feito" n={resumo.feito} />
              <LinhaStatus status="a fazer" n={resumo.aFazer} />
              <LinhaStatus status="sem confirmacao" n={resumo.semConfirmacao} />

              <div className="flex items-center gap-2 pt-1 border-t border-[#1e293b]">
                <span className="w-2 h-2 shrink-0 border-2 border-[#ef4444]" />
                <span className="text-[9px] uppercase tracking-[0.12em] text-[#64748b]">Anel = dia já passou</span>
              </div>

              {/* aviso âmbar — o que não casou não vai pro mapa */}
              {resumo.semCoordenada > 0 && (
                <div className="mt-0.5 border border-[#f59e0b]/40 bg-[#f59e0b]/10">
                  <button
                    onClick={() => setListaAberta((v) => !v)}
                    className="w-full flex items-start gap-1.5 px-1.5 py-1 text-left"
                  >
                    <AlertTriangle size={11} className="text-[#f59e0b] shrink-0 mt-[1px]" />
                    <span className="text-[9px] uppercase tracking-[0.1em] text-[#f59e0b] leading-[1.35]">
                      <span className="font-mono [font-variant-numeric:tabular-nums] text-[10px]">
                        {resumo.semCoordenada}
                      </span>{' '}
                      PVs do cronograma sem coordenada casada
                    </span>
                    {listaAberta
                      ? <ChevronDown size={10} className="text-[#f59e0b] shrink-0 ml-auto mt-[1px]" />
                      : <ChevronRight size={10} className="text-[#f59e0b] shrink-0 ml-auto mt-[1px]" />}
                  </button>

                  {listaAberta && (
                    <div className="px-1.5 pb-1.5 max-h-[132px] overflow-y-auto flex flex-col gap-0.5 border-t border-[#f59e0b]/25 pt-1">
                      {semCoordenada.map((s) => (
                        <div key={s.id} className="flex items-baseline gap-1.5">
                          <span
                            className="w-1.5 h-1.5 shrink-0 translate-y-[-1px]"
                            style={{ backgroundColor: PENTE_FINO_CORES[s.status] }}
                          />
                          <span className="text-[10px] font-mono text-[#e2e8f0] truncate">{s.pv}</span>
                          <span className="ml-auto text-[9px] font-mono [font-variant-numeric:tabular-nums] text-[#94a3b8] shrink-0">
                            {ddmm(s.dataExecucao) ?? '—'}
                          </span>
                        </div>
                      ))}
                      <div className="text-[9px] uppercase tracking-[0.1em] text-[#f59e0b]/70 leading-[1.35] pt-1">
                        Sem PV de mesmo nome no cadastro — posição não é inventada
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="pt-1 mt-0.5 border-t border-[#1e293b] text-[9px] uppercase tracking-[0.1em] text-[#334155]">
            Fonte: pente_fino_cronograma × pv
          </div>
        </div>
      )}
    </div>
  )
}
