/**
 * CurvaSCorredor — Curva S da meta de 1500 ligações com CORREDOR editável.
 *
 * O usuário define, por semana (seg-sáb), a banda de ligação acumulada esperada
 * (mínimo aceitável ↔ ideal). A área entre as duas vira o "corredor" sombreado;
 * a linha do REALIZADO (ligação acumulada real, de useMetaLigacoes) é desenhada
 * por cima e muda de cor conforme está DENTRO, ABAIXO ou ACIMA do corredor.
 * Editar um campo salva no banco (useMetaCorredor) e a banda redesenha.
 *
 * SVG feito à mão (padrão do app — sem lib de gráfico). Nada é inventado: banda
 * vem de `meta_corredor`, realizado vem de `producao_diaria`.
 */
import { useMemo } from 'react'
import { AlertTriangle, Route } from 'lucide-react'
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
  // Cumulativo de ligação por dia real → função de consulta "acumulado até <iso>".
  const cumLaAte = useMemo(() => {
    const ordenados = [...dias].sort((a, b) => a.data.localeCompare(b.data))
    return (iso: string) => ordenados.reduce((acc, d) => (d.data <= iso ? acc + d.la : acc), 0)
  }, [dias])

  const ultimoReal = useMemo(
    () => (dias.length ? dias.reduce((mx, d) => (d.data > mx ? d.data : mx), dias[0].data) : null),
    [dias],
  )

  // Eixo X: ponto 0 = início da semana 1 (acumulado 0), depois o FIM (sábado) de cada semana.
  const pontos = useMemo(() => {
    if (semanas.length === 0) return [] as { x: number; label: string; fimIso: string; iniIso: string; idx: number }[]
    const n = semanas.length
    const passoX = PLOT_W / n
    const arr: { x: number; label: string; fimIso: string; iniIso: string; idx: number }[] = [
      { x: PAD_L, label: fmtDdMM(semanas[0].semana_inicio), fimIso: semanas[0].semana_inicio, iniIso: semanas[0].semana_inicio, idx: -1 },
    ]
    semanas.forEach((s, i) => {
      const fim = addDias(s.semana_inicio, 5) // sábado
      arr.push({ x: PAD_L + passoX * (i + 1), label: fmtDdMM(fim), fimIso: fim, iniIso: s.semana_inicio, idx: i })
    })
    return arr
  }, [semanas])

  const yMax = useMemo(() => {
    const topo = Math.max(meta, ...semanas.map((s) => s.acum_ideal), 1)
    return Math.ceil(topo / 100) * 100
  }, [semanas, meta])

  const yScale = (v: number) => PAD_T + PLOT_H - (v / yMax) * PLOT_H

  if (semanas.length === 0 || pontos.length === 0) return null

  // Séries: ideal e min começam em 0 (ponto início) e sobem por semana.
  const idealPts = pontos.map((p) => ({ x: p.x, y: p.idx < 0 ? 0 : semanas[p.idx].acum_ideal }))
  const minPts = pontos.map((p) => ({ x: p.x, y: p.idx < 0 ? 0 : semanas[p.idx].acum_min }))

  // Realizado: acumulado de ligação no FIM de cada semana já passada; na semana
  // em andamento, acumulado até o último dia com dado; futuro = sem ponto.
  const realPts: { x: number; y: number }[] = []
  for (const p of pontos) {
    if (p.idx < 0) { realPts.push({ x: p.x, y: 0 }); continue }
    if (!ultimoReal) break
    if (p.fimIso <= ultimoReal) realPts.push({ x: p.x, y: cumLaAte(p.fimIso) })
    else if (p.iniIso <= ultimoReal) { realPts.push({ x: p.x, y: cumLaAte(ultimoReal) }); break }
    else break
  }

  const linha = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${yScale(p.y).toFixed(1)}`).join(' ')

  // Área do corredor = ideal (ida) + min (volta).
  const areaPath =
    linha(idealPts) +
    ' ' +
    [...minPts].reverse().map((p) => `L ${p.x.toFixed(1)} ${yScale(p.y).toFixed(1)}`).join(' ') +
    ' Z'

  // Diagnóstico do último ponto real vs corredor da mesma semana.
  const ultimoRealPt = realPts.length ? realPts[realPts.length - 1] : null
  const semanaAtualIdx = pontos.find((p) => p.idx >= 0 && ultimoReal != null && p.fimIso >= ultimoReal && p.iniIso <= ultimoReal)?.idx
  const corredorAtual = semanaAtualIdx != null ? semanas[semanaAtualIdx] : null
  const status =
    ultimoRealPt == null || corredorAtual == null ? null
    : ultimoRealPt.y < corredorAtual.acum_min ? 'abaixo'
    : ultimoRealPt.y > corredorAtual.acum_ideal ? 'acima'
    : 'dentro'

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f))
  const corReal = status === 'abaixo' ? '#f43f5e' : status === 'acima' ? '#22d3ee' : '#10b981'

  return (
    <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#20406a] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Route size={16} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Curva S — Corredor da Meta</h3>
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
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 340 }} role="img"
             aria-label="Curva S com corredor de meta e realizado de ligações">
          {/* grid + eixo Y */}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD_L} y1={yScale(t)} x2={W - PAD_R} y2={yScale(t)} stroke="#20406a" strokeWidth={0.5} />
              <text x={PAD_L - 6} y={yScale(t) + 3} textAnchor="end" fontSize={9} fill="#5a8caa">{fmtInt(t)}</text>
            </g>
          ))}
          {/* corredor sombreado */}
          <path d={areaPath} fill="#22d3ee" fillOpacity={0.1} stroke="none" />
          {/* linha ideal (topo) e min (base) */}
          <path d={linha(idealPts)} fill="none" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.75} />
          <path d={linha(minPts)} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.75} />
          {/* realizado */}
          {realPts.length > 1 && <path d={linha(realPts)} fill="none" stroke={corReal} strokeWidth={2.5} />}
          {realPts.map((p, i) => (
            <circle key={i} cx={p.x} cy={yScale(p.y)} r={i === realPts.length - 1 ? 4 : 2.5} fill={corReal} />
          ))}
          {ultimoRealPt && (
            <text x={ultimoRealPt.x} y={yScale(ultimoRealPt.y) - 8} textAnchor="middle" fontSize={10} fontWeight={700} fill={corReal}>
              {fmtInt(ultimoRealPt.y)}
            </text>
          )}
          {/* eixo X */}
          {pontos.map((p, i) => (
            <text key={i} x={p.x} y={H - 10} textAnchor="middle" fontSize={9} fill="#5a8caa">{p.label}</text>
          ))}
        </svg>

        {/* legenda */}
        <div className="flex flex-wrap gap-4 mt-1 justify-center text-[10px] text-[#5a8caa]">
          <span className="flex items-center gap-1"><span className="w-3 h-0 border-t border-dashed" style={{ borderColor: '#22d3ee' }} /> Ideal</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0 border-t border-dashed" style={{ borderColor: '#f59e0b' }} /> Mínimo aceitável</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style={{ background: 'rgba(34,211,238,.15)' }} /> Corredor</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2" style={{ borderColor: corReal }} /> Realizado (ligação acum.)</span>
        </div>
      </div>

      {/* editor do corredor por semana */}
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
        <span>Você define a banda (mínimo ↔ ideal) de ligação acumulada por semana — editar salva na hora. A linha do realizado fica <b>verde</b> dentro do corredor, <b>vermelha</b> abaixo do mínimo. Semana futura sem realizado aparece como "—".</span>
      </div>
    </div>
  )
}
