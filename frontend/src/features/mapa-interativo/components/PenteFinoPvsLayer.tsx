/**
 * PenteFinoPvsLayer — camada de marcadores dos PVs do PENTE FINO no Mapa
 * Interativo. Recebe pronto o cruzamento `pente_fino_cronograma` × `pv` feito
 * pelo hook usePenteFinoPvs (só entram aqui os PVs que casaram por nome —
 * quem não casou fica no aviso âmbar do painel, sem posição inventada).
 *
 * Cor = status do campo (feito / a fazer / sem confirmação). Anel vermelho =
 * dia programado já passou e ainda não veio 'feito'. Tooltip traz dia
 * programado, rua, casa, profundidade e o nome do PV do cadastro que casou
 * (deixa o cruzamento auditável na hora).
 */
import { CircleMarker, Tooltip } from 'react-leaflet'
import type { PenteFinoPonto, PenteFinoStatus } from '@/hooks/usePenteFinoPvs'
import './penteFino.css'

export const PENTE_FINO_CORES: Record<PenteFinoStatus, string> = {
  'feito':            '#22c55e',
  'a fazer':          '#f59e0b',
  'sem confirmacao':  '#64748b',
}

export const PENTE_FINO_LABELS: Record<PenteFinoStatus, string> = {
  'feito':            'FEITO',
  'a fazer':          'A FAZER',
  'sem confirmacao':  'SEM CONFIRMAÇÃO',
}

const COR_ATRASO = '#ef4444'

/** yyyy-mm-dd → dd/mm (sem Date, pra não escorregar de fuso). */
export function ddmm(iso: string | null): string | null {
  if (!iso || iso.length < 10) return null
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function Linha({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[9px] uppercase tracking-[0.12em] text-[#64748b] shrink-0">{rotulo}</span>
      <span
        className={`text-[10px] text-[#cbd5e1] ml-auto ${mono ? 'font-mono [font-variant-numeric:tabular-nums]' : ''}`}
      >
        {valor}
      </span>
    </div>
  )
}

export function PenteFinoPvsLayer({ pontos }: { pontos: PenteFinoPonto[] }) {
  return (
    <>
      {pontos.map((p) => {
        const cor = PENTE_FINO_CORES[p.status]
        return (
          <CircleMarker
            key={`pente-fino-${p.id}`}
            center={[p.lat, p.lon]}
            radius={9}
            pathOptions={{
              fillColor: cor,
              fillOpacity: 0.95,
              color: p.atrasado ? COR_ATRASO : '#0a0f1a',
              weight: p.atrasado ? 2.5 : 1.5,
            }}
          >
            <Tooltip className="pente-fino-tooltip" direction="top" offset={[0, -10]} opacity={1}>
              <div className="px-2.5 py-2 min-w-[178px] flex flex-col gap-1">
                <div className="flex items-center gap-2 pb-1 border-b border-[#1e293b]">
                  <span className="w-2 h-2 shrink-0" style={{ backgroundColor: cor }} />
                  <span className="text-[11px] font-mono font-bold text-[#f1f5f9] tracking-tight">{p.pv}</span>
                  <span className="ml-auto text-[9px] uppercase tracking-[0.12em]" style={{ color: cor }}>
                    {PENTE_FINO_LABELS[p.status]}
                  </span>
                </div>

                <Linha rotulo="Programado" valor={ddmm(p.dataExecucao) ?? 'sem data'} mono />
                <Linha rotulo="Rua" valor={p.rua ?? '—'} />
                {p.casaFrente && <Linha rotulo="Frente" valor={p.casaFrente} mono />}
                <Linha
                  rotulo="Profundidade"
                  valor={p.profundidadeM != null ? `${p.profundidadeM.toFixed(2).replace('.', ',')} m` : 'sem dado'}
                  mono
                />
                <Linha rotulo="Situação" valor={[p.tipo, p.situacao].filter(Boolean).join(' · ') || '—'} />

                {p.atrasado && (
                  <div className="mt-0.5 px-1.5 py-0.5 border border-[#ef4444]/40 bg-[#ef4444]/10">
                    <span className="text-[9px] uppercase tracking-[0.14em] text-[#ef4444]">
                      Dia programado já passou
                    </span>
                  </div>
                )}

                <div className="pt-1 mt-0.5 border-t border-[#1e293b] text-[9px] uppercase tracking-[0.1em] text-[#475569]">
                  pente_fino_cronograma × pv.{p.pvCasado}
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}
