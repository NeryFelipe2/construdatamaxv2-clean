/**
 * CurvaSCorredor — Curva S da meta de 1500 ligações com CORREDOR editável
 * DIRETO NO GRÁFICO (arrastar os pontos).
 *
 * O usuário define, por semana (seg-sáb), a banda de ligação acumulada esperada
 * (mínimo aceitável ↔ ideal) ARRASTANDO os pontos das duas linhas no próprio SVG
 * (ou digitando na tabela abaixo — os dois caminhos salvam). A área entre elas é
 * o "corredor" sombreado; a linha do REALIZADO (de useMetaLigacoes) é desenhada
 * por cima e muda de cor conforme está DENTRO, ABAIXO ou ACIMA do corredor.
 * Soltar o ponto salva no banco (useMetaCorredor) via onSalvar.
 *
 * SVG à mão + pointer events (mouse e toque). Nada é inventado: banda vem de
 * `meta_corredor`, realizado vem de `producao_diaria`.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Route, Move, RotateCcw, Gauge } from 'lucide-react'
import type { DiaMetaLigacoes } from '@/hooks/useMetaLigacoes'
import type { SemanaCorredor } from '@/hooks/useMetaCorredor'

interface Props {
  semanas: SemanaCorredor[]
  dias: DiaMetaLigacoes[]
  meta: number
  onSalvar: (semanaInicio: string, patch: Partial<{ acum_min: number; acum_ideal: number }>) => void
}

// ── geometria do SVG ──
const W = 760, H = 320
const PAD_L = 46, PAD_R = 14, PAD_T = 14, PAD_B = 30
const PLOT_W = W - PAD_L - PAD_R
const PLOT_H = H - PAD_T - PAD_B
const SNAP = 5 // arraste arredonda pra múltiplo de 5

type Serie = 'ideal' | 'min'
interface Drag { serie: Serie; idx: number; value: number }

function fmtDdMM(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
function addDias(iso: string, n: number): string {
  const dt = new Date(`${iso}T00:00:00`)
  dt.setDate(dt.getDate() + n)
  return dt.toISOString().slice(0, 10)
}
function fmtInt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

export function CurvaSCorredor({ semanas, dias, meta, onSalvar }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null) // valor ao vivo sem depender do updater (evita setState-em-render)

  // Cumulativo de ligação por dia real → "acumulado até <iso>".
  const cumLaAte = useMemo(() => {
    const ordenados = [...dias].sort((a, b) => a.data.localeCompare(b.data))
    return (iso: string) => ordenados.reduce((acc, d) => (d.data <= iso ? acc + d.la : acc), 0)
  }, [dias])

  const ultimoReal = useMemo(
    () => (dias.length ? dias.reduce((mx, d) => (d.data > mx ? d.data : mx), dias[0].data) : null),
    [dias],
  )

  const yMax = useMemo(() => {
    const topo = Math.max(meta, ...semanas.map((s) => s.acum_ideal), 1)
    return Math.ceil(topo / 100) * 100
  }, [semanas, meta])

  const yScale = (v: number) => PAD_T + PLOT_H - (v / yMax) * PLOT_H

  // Y do ponteiro (viewBox) → valor acumulado (snap + clamp 0..yMax).
  const valueFromClientY = (clientY: number): number => {
    const svg = svgRef.current
    if (!svg) return 0
    const pt = svg.createSVGPoint()
    pt.x = 0; pt.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return 0
    const loc = pt.matrixTransform(ctm.inverse())
    let v = ((PAD_T + PLOT_H - loc.y) / PLOT_H) * yMax
    v = Math.max(0, Math.min(yMax, v))
    return Math.round(v / SNAP) * SNAP
  }

  // Enquanto arrasta: move/solta na window (pega o ponteiro fora do SVG também).
  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => {
      let v = valueFromClientY(e.clientY)
      const s = semanas[drag.idx]
      if (!s) return
      // mantém a banda válida: ideal ≥ mín, mín ≤ ideal.
      if (drag.serie === 'ideal') v = Math.max(v, s.acum_min)
      else v = Math.min(v, s.acum_ideal)
      const novo = { serie: drag.serie, idx: drag.idx, value: v }
      dragRef.current = novo
      setDrag(novo)
    }
    const up = () => {
      // lê do ref (fora do updater) e só então dispara o save — nunca setState durante render.
      const d = dragRef.current
      if (d) {
        const s = semanas[d.idx]
        if (s) onSalvar(s.semana_inicio, d.serie === 'ideal' ? { acum_ideal: d.value } : { acum_min: d.value })
      }
      dragRef.current = null
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.serie, drag?.idx, semanas, yMax])

  // valor efetivo (aplica o override do drag ao vivo)
  const idealVal = (i: number) => (drag && drag.serie === 'ideal' && drag.idx === i ? drag.value : semanas[i].acum_ideal)
  const minVal = (i: number) => (drag && drag.serie === 'min' && drag.idx === i ? drag.value : semanas[i].acum_min)

  // Eixo X: ponto 0 = início da semana 1 (acum 0), depois o FIM (sábado) de cada semana.
  const semanaX = (i: number) => PAD_L + (PLOT_W / semanas.length) * (i + 1)
  const idealPts = [{ x: PAD_L, y: 0 }, ...semanas.map((_, i) => ({ x: semanaX(i), y: idealVal(i) }))]
  const minPts = [{ x: PAD_L, y: 0 }, ...semanas.map((_, i) => ({ x: semanaX(i), y: minVal(i) }))]

  // Realizado (ligação acumulada) no fim de cada semana passada; semana em
  // andamento → até o último dia com dado; futuro → sem ponto.
  const realPts: { x: number; y: number }[] = [{ x: PAD_L, y: 0 }]
  if (ultimoReal) {
    for (let i = 0; i < semanas.length; i++) {
      const fim = addDias(semanas[i].semana_inicio, 5)
      if (fim <= ultimoReal) realPts.push({ x: semanaX(i), y: cumLaAte(fim) })
      else if (semanas[i].semana_inicio <= ultimoReal) { realPts.push({ x: semanaX(i), y: cumLaAte(ultimoReal) }); break }
      else break
    }
  }

  const linha = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${yScale(p.y).toFixed(1)}`).join(' ')

  const areaPath =
    linha(idealPts) + ' ' +
    [...minPts].reverse().map((p) => `L ${p.x.toFixed(1)} ${yScale(p.y).toFixed(1)}`).join(' ') + ' Z'

  // Diagnóstico do último real vs corredor da semana em andamento.
  const ultimoRealPt = realPts.length > 1 ? realPts[realPts.length - 1] : null
  const idxAtual = ultimoReal
    ? semanas.findIndex((s) => s.semana_inicio <= ultimoReal && addDias(s.semana_inicio, 5) >= ultimoReal)
    : -1
  const corredorAtual = idxAtual >= 0 ? semanas[idxAtual] : null
  const status =
    ultimoRealPt == null || corredorAtual == null ? null
    : ultimoRealPt.y < corredorAtual.acum_min ? 'abaixo'
    : ultimoRealPt.y > corredorAtual.acum_ideal ? 'acima' : 'dentro'
  const corReal = status === 'abaixo' ? '#f43f5e' : status === 'acima' ? '#22d3ee' : '#10b981'
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f))

  // Presets pra recomeçar rápido: aplica min/ideal em todas as semanas de uma vez.
  // 'padrao' = rampa linear até a meta pelo nº de semanas; 'ritmo' = 75/dia × 6 dias
  // úteis (seg-sáb) = 450/semana acumulado, com teto na meta. Mínimo = 80% do ideal.
  const aplicarPreset = (tipo: 'padrao' | 'ritmo') => {
    const n = semanas.length
    const round5 = (v: number) => Math.round(v / 5) * 5
    semanas.forEach((s, i) => {
      const ideal = tipo === 'padrao'
        ? round5((meta * (i + 1)) / n)
        : Math.min(meta, 75 * 6 * (i + 1))
      const mn = Math.min(ideal, round5(ideal * 0.8))
      onSalvar(s.semana_inicio, { acum_min: mn, acum_ideal: ideal })
    })
  }

  const iniciarDrag = (serie: Serie, idx: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const inicial = { serie, idx, value: serie === 'ideal' ? semanas[idx].acum_ideal : semanas[idx].acum_min }
    dragRef.current = inicial
    setDrag(inicial)
  }

  return (
    <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#20406a] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Route size={16} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Curva S — Corredor da Meta</h3>
          <span className="hidden sm:flex items-center gap-1 text-[10px] text-[#5a8caa]"><Move size={11} /> arraste os pontos</span>
          <button
            onClick={() => aplicarPreset('ritmo')}
            title="Preenche o corredor com o ritmo contratado (75/dia · seg-sáb), teto 1.500"
            className="flex items-center gap-1 px-2.5 py-1 bg-cyan-500/10 text-cyan-300 rounded-lg text-[11px] font-semibold hover:bg-cyan-500/20 transition-colors"
          >
            <Gauge size={12} /> Puxar ritmo 75/dia
          </button>
          <button
            onClick={() => aplicarPreset('padrao')}
            title="Volta o corredor pro padrão (rampa linear até 1.500 no fim do ciclo)"
            className="flex items-center gap-1 px-2.5 py-1 bg-[#0d2040] text-[#8fb3c8] border border-[#20406a] rounded-lg text-[11px] font-semibold hover:bg-[#14294e] transition-colors"
          >
            <RotateCcw size={12} /> Resetar padrão
          </button>
        </div>
        {status && (
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
            status === 'abaixo' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            : status === 'acima' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          }`}>
            {status === 'abaixo' ? 'ABAIXO do corredor' : status === 'acima' ? 'ACIMA do ideal' : 'DENTRO do corredor'}
          </span>
        )}
      </div>

      <div className="px-4 py-4">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ maxHeight: 360, touchAction: 'none' }}
             role="img" aria-label="Curva S com corredor de meta arrastável e realizado de ligações">
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD_L} y1={yScale(t)} x2={W - PAD_R} y2={yScale(t)} stroke="#20406a" strokeWidth={0.5} />
              <text x={PAD_L - 6} y={yScale(t) + 3} textAnchor="end" fontSize={9} fill="#5a8caa">{fmtInt(t)}</text>
            </g>
          ))}
          <path d={areaPath} fill="#22d3ee" fillOpacity={0.1} stroke="none" />
          <path d={linha(idealPts)} fill="none" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.8} />
          <path d={linha(minPts)} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.8} />
          {realPts.length > 1 && <path d={linha(realPts)} fill="none" stroke={corReal} strokeWidth={2.5} />}
          {realPts.slice(1).map((p, i) => (
            <circle key={i} cx={p.x} cy={yScale(p.y)} r={i === realPts.length - 2 ? 4 : 2.5} fill={corReal} />
          ))}
          {ultimoRealPt && (
            <text x={ultimoRealPt.x} y={yScale(ultimoRealPt.y) - 8} textAnchor="middle" fontSize={10} fontWeight={700} fill={corReal}>
              {fmtInt(ultimoRealPt.y)}
            </text>
          )}

          {/* alças arrastáveis — mínimo (amber) e ideal (ciano) por semana */}
          {semanas.map((s, i) => {
            const arr: React.ReactNode[] = []
            const mk = (serie: Serie, val: number, cor: string) => {
              const ativo = !!drag && drag.serie === serie && drag.idx === i
              return (
                <g key={`${serie}-${i}`} style={{ cursor: 'ns-resize' }} onPointerDown={iniciarDrag(serie, i)}>
                  {/* área de toque generosa (invisível) */}
                  <circle cx={semanaX(i)} cy={yScale(val)} r={14} fill="transparent" />
                  <circle cx={semanaX(i)} cy={yScale(val)} r={ativo ? 7 : 5} fill={cor} stroke="#0a1628" strokeWidth={1.5} />
                  {ativo && (
                    <text x={semanaX(i)} y={yScale(val) - 12} textAnchor="middle" fontSize={11} fontWeight={700} fill={cor}>
                      {fmtInt(val)}
                    </text>
                  )}
                </g>
              )
            }
            arr.push(mk('min', minVal(i), '#f59e0b'))
            arr.push(mk('ideal', idealVal(i), '#22d3ee'))
            return <g key={i}>{arr}</g>
          })}

          {semanas.map((s, i) => (
            <text key={i} x={semanaX(i)} y={H - 10} textAnchor="middle" fontSize={9} fill="#5a8caa">
              {fmtDdMM(addDias(s.semana_inicio, 5))}
            </text>
          ))}
          <text x={PAD_L} y={H - 10} textAnchor="middle" fontSize={9} fill="#5a8caa">{fmtDdMM(semanas[0].semana_inicio)}</text>
        </svg>

        <div className="flex flex-wrap gap-4 mt-1 justify-center text-[10px] text-[#5a8caa]">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-full" style={{ background: '#22d3ee' }} /> Ideal (arraste)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-full" style={{ background: '#f59e0b' }} /> Mínimo (arraste)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{ background: 'rgba(34,211,238,.15)' }} /> Corredor</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2" style={{ borderColor: corReal }} /> Realizado (ligação acum.)</span>
        </div>
      </div>

      {/* editor por semana (digitar também salva) */}
      <table className="w-full text-xs">
        <thead className="bg-[#0d2040] text-[#5a8caa] uppercase tracking-wider">
          <tr>
            <th className="text-left px-5 py-2.5">Semana (fim sáb)</th>
            <th className="text-right px-5 py-2.5">Mínimo acum. (lig.)</th>
            <th className="text-right px-5 py-2.5">Ideal acum. (lig.)</th>
            <th className="text-right px-5 py-2.5">Realizado no fim</th>
          </tr>
        </thead>
        <tbody>
          {semanas.map((s) => {
            const fim = addDias(s.semana_inicio, 5)
            const realFim = ultimoReal && fim <= ultimoReal ? cumLaAte(fim)
              : ultimoReal && s.semana_inicio <= ultimoReal ? cumLaAte(ultimoReal) : null
            return (
              <tr key={s.id} className="border-t border-[#20406a]/50 hover:bg-[#14294e]">
                <td className="px-5 py-2 font-medium text-[#e4f2f8] whitespace-nowrap">{fmtDdMM(s.semana_inicio)}–{fmtDdMM(fim)}</td>
                <td className="px-5 py-1.5 text-right">
                  <input
                    key={`min-${s.id}-${s.acum_min}`}
                    type="text" inputMode="numeric" defaultValue={s.acum_min || ''} placeholder="0"
                    onBlur={(e) => {
                      const v = Number(e.target.value.replace(/[^\d]/g, '')) || 0
                      if (v !== s.acum_min) onSalvar(s.semana_inicio, { acum_min: v })
                    }}
                    className="w-24 rounded-lg px-2 py-1 text-xs text-right bg-[#0d2040] border border-[#20406a] text-amber-300 outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40"
                  />
                </td>
                <td className="px-5 py-1.5 text-right">
                  <input
                    key={`ideal-${s.id}-${s.acum_ideal}`}
                    type="text" inputMode="numeric" defaultValue={s.acum_ideal || ''} placeholder="0"
                    onBlur={(e) => {
                      const v = Number(e.target.value.replace(/[^\d]/g, '')) || 0
                      if (v !== s.acum_ideal) onSalvar(s.semana_inicio, { acum_ideal: v })
                    }}
                    className="w-24 rounded-lg px-2 py-1 text-xs text-right bg-[#0d2040] border border-[#20406a] text-cyan-300 outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40"
                  />
                </td>
                <td className={`px-5 py-2 text-right font-mono font-bold ${
                  realFim == null ? 'text-[#3d5a75]'
                  : realFim < s.acum_min ? 'text-rose-400'
                  : realFim > s.acum_ideal ? 'text-cyan-300' : 'text-emerald-400'
                }`}>
                  {realFim == null ? '—' : fmtInt(realFim)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="px-5 py-2.5 border-t border-[#20406a] text-[10px] text-[#5a8caa] flex items-start gap-2">
        <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
        <span><b>Arraste os pontos</b> (ciano = ideal, amarelo = mínimo) pra moldar o corredor direto no gráfico — solta e salva. Ou digite na tabela. Realizado fica <b>verde</b> dentro do corredor, <b>vermelho</b> abaixo do mínimo.</span>
      </div>
    </div>
  )
}
