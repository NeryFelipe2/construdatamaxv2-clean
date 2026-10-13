/**
 * MedicaoConstrucao — dashboard "MEDIÇÃO EM CONSTRUÇÃO".
 *
 * Pedido do chefe do Felipe (30/07/2026): "ver os itens que estão sendo
 * apontados num dashboard; a medição sendo construída e acompanhada;
 * acompanhamento e controle — baseado na medição".
 *
 * Linguagem visual industrial/utilitária (Palantir Foundry), igual à Torre de
 * Controle: dark #0a0f1a sobre painéis #0d1420, bordas 1px #1e293b, números
 * monoespaçados tabulares, labels em caixa alta, quadrados de status
 * verde/âmbar/vermelho, SVG puro sem nenhuma lib de gráfico.
 *
 * REGRA: nenhum número é inventado. Tudo vem de useMedicaoConstrucao (Supabase).
 * Sem dado → "—" com o motivo declarado, e cada bloco declara a tabela/view de
 * origem em 9px. A única extrapolação da tela é a linha de PROJEÇÃO da curva,
 * rotulada como projeção e derivada do ritmo real (média por dia decorrido).
 *
 * O achado dos ~34% de captura do apontamento fica EXPOSTO no bloco
 * APONTADO × MEDIDO — é subnotificação de apontamento, não erro de cálculo.
 */
import { useMemo, useState } from 'react'
import { RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'
import {
  useMedicaoConstrucao,
  mesLabel,
  servicoLabel,
  type MedicaoCurvaPonto,
  type MedicaoItemMes,
  type MedicaoQuebra,
} from '@/hooks/useMedicaoConstrucao'

// ─── Constantes visuais ─────────────────────────────────────────────────────

const C = {
  bg: '#0a0f1a',
  panel: '#0d1420',
  border: '#1e293b',
  text: '#e2e8f0',
  muted: '#64748b',
  faint: '#475569',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  cyan: '#38bdf8',
} as const

const MONO = 'font-mono [font-variant-numeric:tabular-nums]'

// ─── Formatação ─────────────────────────────────────────────────────────────

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** R$ 3,36 mi / R$ 585,8 mil / R$ 419,50 — para números grandes de cabeçalho. */
function brlCompacto(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`
  if (abs >= 1_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`
  return brl(n)
}

const qtdFmt = (n: number) => {
  const dec = Number.isInteger(n) ? 0 : 2
  return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

const pctFmt = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`

const ddmm = (isoData: string) => {
  const [, m, d] = (isoData ?? '').split('-')
  return d && m ? `${d}/${m}` : '--/--'
}

/** Cor do semáforo de captura: <60% vermelho, 60–90% âmbar, >90% verde. */
function corCaptura(pct: number | null): string {
  if (pct === null) return C.muted
  if (pct < 60) return C.red
  if (pct <= 90) return C.amber
  return C.green
}

// ─── Blocos básicos ─────────────────────────────────────────────────────────

function StatusSquare({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 shrink-0" style={{ background: color }} />
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b] leading-none">
      {children}
    </div>
  )
}

/** Fonte do dado — obrigatória em todo bloco (9px, rodapé). */
function Fonte({ children }: { children: React.ReactNode }) {
  return <div className={`text-[9px] text-[#475569] ${MONO} pt-2`}>{children}</div>
}

function Painel({
  titulo,
  acao,
  fonte,
  children,
  className = '',
}: {
  titulo: string
  acao?: React.ReactNode
  fonte: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`flex flex-col border border-[#1e293b] bg-[#0d1420] ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-[#1e293b] px-3 py-2">
        <Label>{titulo}</Label>
        {acao}
      </header>
      <div className="flex flex-col flex-1 px-3 py-3">{children}</div>
      <div className="px-3 pb-2">
        <Fonte>{fonte}</Fonte>
      </div>
    </section>
  )
}

function AvisoSemDado({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-2.5 py-2">
      <span className="mt-0.5"><StatusSquare color={C.amber} /></span>
      <span className="text-[10px] leading-snug text-[#f59e0b]">{children}</span>
    </div>
  )
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-[#1e293b] px-3 py-6 text-center text-[11px] text-[#64748b]">
      {children}
    </div>
  )
}

/** Barra proporcional (0..1) — sem lib, só div. */
function Barra({ fracao, cor = C.cyan }: { fracao: number; cor?: string }) {
  const p = Math.max(0, Math.min(1, Number.isFinite(fracao) ? fracao : 0))
  return (
    <div className="h-1.5 w-full bg-[#1e293b]">
      <div className="h-full" style={{ width: `${p * 100}%`, background: cor }} />
    </div>
  )
}

// ─── Curva de construção da medição (SVG puro) ──────────────────────────────

function CurvaMedicao({
  curva,
  diasNoMes,
  referencia,
  refLabel,
  projecao,
}: {
  curva: MedicaoCurvaPonto[]
  diasNoMes: number
  /** Total da medição oficial fechada — linha tracejada de referência. */
  referencia: number | null
  refLabel: string
  /** Valor projetado para o fim do mês (ritmo real × dias restantes). */
  projecao: number | null
}) {
  if (curva.length === 0) {
    return <Vazio>Nenhum apontamento valorado neste mês — a curva aparece quando o campo apontar.</Vazio>
  }

  const W = 960
  const H = 300
  const ML = 78
  const MR = 16
  const MT = 16
  const MB = 28
  const iw = W - ML - MR
  const ih = H - MT - MB

  const acumFinal = curva[curva.length - 1].acumulado
  const topo = Math.max(acumFinal, referencia ?? 0, projecao ?? 0, 1) * 1.08
  const x = (dia: number) => ML + ((dia - 1) / Math.max(1, diasNoMes - 1)) * iw
  const y = (v: number) => MT + ih - (v / topo) * ih

  const pontos = curva.map((p) => `${x(Number(p.data.slice(8, 10))).toFixed(1)},${y(p.acumulado).toFixed(1)}`)
  const linha = pontos.join(' ')
  const areaPath = `M ${ML},${MT + ih} L ${pontos.join(' L ')} L ${x(Number(curva[curva.length - 1].data.slice(8, 10))).toFixed(1)},${MT + ih} Z`

  const grade = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, v: topo * f }))
  const diasEixo: number[] = []
  for (let d = 1; d <= diasNoMes; d += 5) diasEixo.push(d)
  if (diasEixo[diasEixo.length - 1] !== diasNoMes) diasEixo.push(diasNoMes)

  const ultDia = Number(curva[curva.length - 1].data.slice(8, 10))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Curva acumulada da medição no mês">
      {/* grade + eixo Y */}
      {grade.map((g) => (
        <g key={g.f}>
          <line x1={ML} x2={W - MR} y1={y(g.v)} y2={y(g.v)} stroke={C.border} strokeWidth="1" />
          <text x={ML - 8} y={y(g.v) + 3.5} textAnchor="end" fontSize="10" fill={C.faint} className={MONO}>
            {g.f === 0 ? '0' : brlCompacto(g.v).replace('R$ ', '')}
          </text>
        </g>
      ))}

      {/* eixo X (dias do mês) */}
      {diasEixo.map((d) => (
        <text key={d} x={x(d)} y={H - 8} textAnchor="middle" fontSize="10" fill={C.faint} className={MONO}>
          {String(d).padStart(2, '0')}
        </text>
      ))}

      {/* referência: medição oficial fechada */}
      {referencia !== null && referencia > 0 && (
        <g>
          <line x1={ML} x2={W - MR} y1={y(referencia)} y2={y(referencia)} stroke={C.amber} strokeWidth="1.5" strokeDasharray="6 4" />
          <text x={ML + 4} y={y(referencia) - 6} fontSize="10" fill={C.amber} className={MONO}>
            {refLabel} · {brlCompacto(referencia)}
          </text>
        </g>
      )}

      {/* projeção do fim do mês (extrapolação rotulada, não é dado) */}
      {projecao !== null && projecao > acumFinal && (
        <g>
          <line
            x1={x(ultDia)} y1={y(acumFinal)} x2={x(diasNoMes)} y2={y(projecao)}
            stroke={C.cyan} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.65"
          />
          <circle cx={x(diasNoMes)} cy={y(projecao)} r="3" fill="none" stroke={C.cyan} strokeWidth="1.5" />
          <text x={x(diasNoMes)} y={y(projecao) - 9} textAnchor="end" fontSize="10" fill={C.cyan} className={MONO}>
            PROJEÇÃO {brlCompacto(projecao)}
          </text>
        </g>
      )}

      {/* área + linha acumulada */}
      <path d={areaPath} fill={C.cyan} opacity="0.10" />
      <polyline points={linha} fill="none" stroke={C.cyan} strokeWidth="2" />

      {/* pontos só nos dias COM apontamento (dia sem apontamento não é ponto) */}
      {curva.map((p) =>
        p.temApontamento ? (
          <circle key={p.data} cx={x(Number(p.data.slice(8, 10)))} cy={y(p.acumulado)} r="2.4" fill={C.cyan} />
        ) : null,
      )}

      {/* rótulo do acumulado atual */}
      <text x={x(ultDia)} y={y(acumFinal) - 10} textAnchor="middle" fontSize="11" fill={C.text} className={MONO}>
        {brlCompacto(acumFinal)}
      </text>
    </svg>
  )
}

// ─── Tabela de itens apontados ──────────────────────────────────────────────

type OrdemItem = 'valor' | 'qtd' | 'item'

function TabelaItens({ itens }: { itens: MedicaoItemMes[] }) {
  const [ordem, setOrdem] = useState<OrdemItem>('valor')
  const [desc, setDesc] = useState(true)

  const ordenados = useMemo(() => {
    const arr = [...itens]
    arr.sort((a, b) => {
      if (ordem === 'item') return a.itemMedicao.localeCompare(b.itemMedicao, 'pt-BR')
      if (ordem === 'qtd') return a.qtd - b.qtd
      return a.valor - b.valor
    })
    return desc ? arr.reverse() : arr
  }, [itens, ordem, desc])

  const maxValor = useMemo(() => Math.max(...itens.map((i) => i.valor), 1), [itens])
  const total = useMemo(() => itens.reduce((s, i) => s + i.valor, 0), [itens])

  function clicar(col: OrdemItem) {
    if (col === ordem) setDesc((d) => !d)
    else { setOrdem(col); setDesc(col !== 'item') }
  }

  if (itens.length === 0) {
    return <Vazio>Nenhum item apontado neste mês. A lista se preenche sozinha a cada apontamento do campo.</Vazio>
  }

  const seta = (col: OrdemItem) => (ordem === col ? (desc ? ' ↓' : ' ↑') : '')

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr className="border-b border-[#1e293b]">
            <th className="px-2 py-1.5 text-left">
              <button onClick={() => clicar('item')} className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b] hover:text-[#e2e8f0]">
                Item de medição{seta('item')}
              </button>
            </th>
            <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Nasce de</th>
            <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Un</th>
            <th className="px-2 py-1.5 text-right">
              <button onClick={() => clicar('qtd')} className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b] hover:text-[#e2e8f0]">
                Qtd mês{seta('qtd')}
              </button>
            </th>
            <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Preço 60%</th>
            <th className="px-2 py-1.5 text-right">
              <button onClick={() => clicar('valor')} className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b] hover:text-[#e2e8f0]">
                Valor{seta('valor')}
              </button>
            </th>
            <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b] w-[130px]">Peso</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((i) => (
            <tr key={i.itemMedicao} className="border-b border-[#1e293b]/60 hover:bg-[#38bdf8]/5">
              <td className="px-2 py-1.5 text-[11px] text-[#e2e8f0] leading-tight">{i.itemMedicao}</td>
              <td className="px-2 py-1.5 text-[10px] text-[#64748b] leading-tight">
                {i.servicos.length > 0 ? i.servicos.map(servicoLabel).join(' · ') : '—'}
              </td>
              <td className={`px-2 py-1.5 text-center text-[10px] text-[#64748b] ${MONO}`}>{i.unidade ?? '—'}</td>
              <td className={`px-2 py-1.5 text-right text-[11px] text-[#e2e8f0] ${MONO}`}>{qtdFmt(i.qtd)}</td>
              <td className={`px-2 py-1.5 text-right text-[10px] text-[#64748b] ${MONO}`}>
                {i.preco60 === null ? '—' : brl(i.preco60)}
              </td>
              <td className={`px-2 py-1.5 text-right text-[11px] text-[#22c55e] ${MONO}`}>{brl(i.valor)}</td>
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1"><Barra fracao={i.valor / maxValor} /></div>
                  <span className={`text-[9px] text-[#475569] w-9 text-right ${MONO}`}>
                    {total > 0 ? pctFmt((i.valor / total) * 100) : '—'}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="px-2 py-2 text-[10px] uppercase tracking-[0.14em] text-[#64748b]">
              Total do mês · {itens.length} {itens.length === 1 ? 'item' : 'itens'}
            </td>
            <td className={`px-2 py-2 text-right text-[12px] text-[#e2e8f0] ${MONO}`}>{brl(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Quebra (núcleo / equipe / serviço) ─────────────────────────────────────

function ListaQuebra({ dados, vazio }: { dados: MedicaoQuebra[]; vazio: string }) {
  if (dados.length === 0) return <Vazio>{vazio}</Vazio>
  const max = Math.max(...dados.map((d) => d.valor), 1)
  return (
    <div className="flex flex-col gap-2">
      {dados.map((d) => (
        <div key={d.nome} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-[#e2e8f0] truncate" title={d.nome}>{d.nome}</span>
            <span className={`text-[11px] text-[#e2e8f0] shrink-0 ${MONO}`}>{brl(d.valor)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1"><Barra fracao={d.valor / max} /></div>
            <span className={`text-[9px] text-[#475569] w-16 text-right ${MONO}`}>
              {pctFmt(d.fracao * 100)} · {d.itens}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Painel principal ───────────────────────────────────────────────────────

export function MedicaoConstrucao() {
  const {
    meses, mes, ehMesCorrente, setMes,
    resumo, itensMes, curva, porNucleo, porEquipe, porServico,
    mesOficialRef, totalOficialRef, fonteOficial, confronto,
    receitaPorServico,
    loading, error, reload,
  } = useMedicaoConstrucao()

  const [abrirReceita, setAbrirReceita] = useState(false)

  /** Projeção do fim do mês: ritmo real (média por dia decorrido) × dias restantes. */
  const projecao = useMemo<number | null>(() => {
    if (!ehMesCorrente || resumo.mediaDia === null) return null
    const restantes = resumo.diasNoMes - resumo.diasDecorridos
    if (restantes <= 0) return null
    return resumo.valor + resumo.mediaDia * restantes
  }, [ehMesCorrente, resumo])

  const pctDoOficial = totalOficialRef && totalOficialRef > 0 ? (resumo.valor / totalOficialRef) * 100 : null

  return (
    <div className="h-full overflow-y-auto bg-[#0a0f1a] text-[#e2e8f0]">
      {/* ── Cabeçalho ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 flex flex-wrap items-end justify-between gap-3 border-b border-[#1e293b] bg-[#0a0f1a]/95 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-[13px] font-semibold uppercase tracking-[0.2em] text-[#e2e8f0]">
            Medição em construção
          </h1>
          <p className="mt-1 text-[10px] text-[#64748b]">
            Cada apontamento do campo virando item de medição valorado ao preço 60% (parte WCR)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {meses.length === 0 && <span className="text-[10px] text-[#64748b]">sem mês com dado</span>}
            {meses.map((m) => (
              <button
                key={m}
                onClick={() => setMes(m)}
                className={`px-2 py-1 text-[10px] uppercase tracking-[0.14em] border ${MONO} ${
                  m === mes
                    ? 'border-[#38bdf8] text-[#38bdf8] bg-[#38bdf8]/10'
                    : 'border-[#1e293b] text-[#64748b] hover:text-[#e2e8f0]'
                }`}
              >
                {mesLabel(m)}
              </button>
            ))}
          </div>
          <button
            onClick={reload}
            className="flex items-center gap-1.5 border border-[#1e293b] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#64748b] hover:text-[#e2e8f0]"
          >
            <RotateCcw size={11} /> {loading ? 'carregando' : 'atualizar'}
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3 p-4">
        {error && (
          <div className="flex items-start gap-2 border border-[#ef4444]/40 bg-[#ef4444]/5 px-3 py-2">
            <span className="mt-0.5"><StatusSquare color={C.red} /></span>
            <span className="text-[11px] text-[#ef4444]">Erro ao ler o banco: {error}</span>
          </div>
        )}

        {/* ── 1. Número grande + comparação ─────────────────────────── */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col justify-between border border-[#1e293b] bg-[#0d1420] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Medição de {mesLabel(mes)} sendo construída</Label>
              <StatusSquare color={resumo.valor > 0 ? C.cyan : C.amber} />
            </div>
            <div className={`mt-2 text-[40px] leading-none text-[#e2e8f0] ${MONO}`}>
              {resumo.valor > 0 ? brlCompacto(resumo.valor) : '—'}
            </div>
            <div className={`mt-1 text-[11px] text-[#64748b] ${MONO}`}>
              {resumo.valor > 0 ? brl(resumo.valor) : 'sem apontamento valorado neste mês'}
            </div>
            <Fonte>vw_medicao_mes_item (mes = {mes})</Fonte>
          </div>

          <div className="flex flex-col justify-between border border-[#1e293b] bg-[#0d1420] px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <Label>vs {mesOficialRef ? mesLabel(mesOficialRef) : '—'} fechado</Label>
              {pctDoOficial !== null && <StatusSquare color={pctDoOficial >= 100 ? C.green : pctDoOficial >= 60 ? C.amber : C.red} />}
            </div>
            <div className={`mt-2 text-[26px] leading-none ${MONO}`} style={{ color: pctDoOficial === null ? C.muted : pctDoOficial >= 60 ? C.text : C.amber }}>
              {pctDoOficial === null ? '—' : pctFmt(pctDoOficial)}
            </div>
            <div className={`mt-1 text-[10px] text-[#64748b] ${MONO}`}>
              {totalOficialRef === null
                ? 'nenhum mês com medição oficial importada'
                : `medição fechada ${brlCompacto(totalOficialRef)}`}
            </div>
            {confronto.pctValor !== null && (
              <div className="mt-1.5 text-[9px] leading-snug text-[#f59e0b]">
                compara APONTADO com MEDIDO: o apontamento capturou só {pctFmt(confronto.pctValor)} do valor
                medido em {mesOficialRef ? mesLabel(mesOficialRef) : '—'} — % baixo aqui é subnotificação, não
                necessariamente menos obra
              </div>
            )}
            <Fonte>medicao_oficial · {fonteOficial ?? 'fonte não declarada'}</Fonte>
          </div>

          <div className="flex flex-col justify-between border border-[#1e293b] bg-[#0d1420] px-3 py-3">
            <Label>Dias decorridos</Label>
            <div className={`mt-2 text-[26px] leading-none text-[#e2e8f0] ${MONO}`}>
              {resumo.diasDecorridos}
              <span className="text-[13px] text-[#64748b]">/{resumo.diasNoMes}</span>
            </div>
            <div className={`mt-1 text-[10px] text-[#64748b] ${MONO}`}>
              {resumo.diasComApontamento} {resumo.diasComApontamento === 1 ? 'dia' : 'dias'} com apontamento
              {resumo.ultimoDia ? ` · último ${ddmm(resumo.ultimoDia)}` : ''}
            </div>
            <Fonte>vw_medicao_em_construcao (datas distintas)</Fonte>
          </div>

          <div className="flex flex-col justify-between border border-[#1e293b] bg-[#0d1420] px-3 py-3">
            <Label>Ritmo por dia decorrido</Label>
            <div className={`mt-2 text-[22px] leading-none text-[#e2e8f0] ${MONO}`}>
              {resumo.mediaDia === null ? '—' : brlCompacto(resumo.mediaDia)}
            </div>
            <div className={`mt-1 text-[10px] text-[#64748b] ${MONO}`}>
              {resumo.itens} {resumo.itens === 1 ? 'item de contrato' : 'itens de contrato'} no mês
            </div>
            <Fonte>valor do mês ÷ dias decorridos</Fonte>
          </div>
        </section>

        {/* ── 2. Curva de construção ────────────────────────────────── */}
        <Painel
          titulo={`Curva de construção da medição · ${mesLabel(mes)}`}
          fonte={`vw_medicao_em_construcao agrupada por data · referência tracejada = medicao_oficial ${mesOficialRef ? mesLabel(mesOficialRef) : '(sem mês fechado)'} · projeção = ritmo real × dias restantes (extrapolação, não é dado)`}
          acao={
            <div className="flex items-center gap-3 text-[9px] uppercase tracking-[0.14em]">
              <span className="flex items-center gap-1.5 text-[#38bdf8]"><StatusSquare color={C.cyan} /> acumulado</span>
              <span className="flex items-center gap-1.5 text-[#f59e0b]"><StatusSquare color={C.amber} /> mês fechado</span>
              <span className="flex items-center gap-1.5 text-[#64748b]"><StatusSquare color={C.faint} /> projeção</span>
            </div>
          }
        >
          <CurvaMedicao
            curva={curva}
            diasNoMes={resumo.diasNoMes}
            referencia={totalOficialRef}
            refLabel={mesOficialRef ? mesLabel(mesOficialRef).toUpperCase() : 'REFERÊNCIA'}
            projecao={projecao}
          />
        </Painel>

        {/* ── 3. Itens apontados ────────────────────────────────────── */}
        <Painel
          titulo={`Itens sendo apontados · ${mesLabel(mes)}`}
          fonte="vw_medicao_mes_item (qtd/valor) + vw_medicao_em_construcao (preço 60% e serviço de origem) · clique no título da coluna para ordenar"
        >
          <TabelaItens itens={itensMes} />
        </Painel>

        {/* ── 4. Apontado × Medido (o achado dos ~34%) ──────────────── */}
        <Painel
          titulo={`Apontado × medido · ${confronto.mes ? mesLabel(confronto.mes) : 'sem mês fechado'}`}
          fonte="vw_medicao_apontado_x_oficial (apontamento valorado × medicao_oficial do mesmo mês)"
          acao={
            confronto.pctValor !== null ? (
              <div className="flex items-center gap-2">
                <StatusSquare color={corCaptura(confronto.pctValor)} />
                <span className={`text-[12px] ${MONO}`} style={{ color: corCaptura(confronto.pctValor) }}>
                  {pctFmt(confronto.pctValor)} de captura em valor
                </span>
              </div>
            ) : undefined
          }
        >
          {confronto.comparaveis.length === 0 ? (
            <Vazio>Nenhum mês com medição oficial importada para confrontar.</Vazio>
          ) : (
            <div className="flex flex-col gap-3">
              <AvisoSemDado>
                O apontamento captura {confronto.pctValor === null ? '—' : pctFmt(confronto.pctValor)} do valor
                efetivamente medido ({brl(confronto.totalApontado)} apontado-valorado contra {brl(confronto.totalOficial)} medidos).
                Isso <strong>não é erro de cálculo</strong>: é <strong>subnotificação de apontamento</strong> — serviço executado
                que não foi registrado pelo campo. O que a WCR fatura é a medição oficial; o que a empresa consegue
                acompanhar no dia a dia é só a parte apontada.
              </AvisoSemDado>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#1e293b]">
                      <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Item</th>
                      <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Un</th>
                      <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Qtd medida</th>
                      <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Qtd apontada</th>
                      <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Valor medido</th>
                      <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b] w-[150px]">Captura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confronto.comparaveis.map((c) => {
                      const cor = corCaptura(c.pctCaptura)
                      return (
                        <tr key={c.itemMedicao} className="border-b border-[#1e293b]/60 hover:bg-[#38bdf8]/5">
                          <td className="px-2 py-1.5 text-[11px] text-[#e2e8f0] leading-tight">{c.itemMedicao}</td>
                          <td className={`px-2 py-1.5 text-center text-[10px] text-[#64748b] ${MONO}`}>{c.unidade ?? '—'}</td>
                          <td className={`px-2 py-1.5 text-right text-[11px] text-[#e2e8f0] ${MONO}`}>{qtdFmt(c.qtdOficial)}</td>
                          <td className={`px-2 py-1.5 text-right text-[11px] ${MONO}`} style={{ color: cor }}>{qtdFmt(c.qtdApontada)}</td>
                          <td className={`px-2 py-1.5 text-right text-[10px] text-[#64748b] ${MONO}`}>{brl(c.valorOficial)}</td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-2">
                              <StatusSquare color={cor} />
                              <div className="flex-1"><Barra fracao={(c.pctCaptura ?? 0) / 100} cor={cor} /></div>
                              <span className={`w-10 text-right text-[10px] ${MONO}`} style={{ color: cor }}>
                                {c.pctCaptura === null ? '—' : pctFmt(c.pctCaptura)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[9px] uppercase tracking-[0.14em] text-[#64748b]">
                <span className="flex items-center gap-1.5"><StatusSquare color={C.red} /> abaixo de 60%</span>
                <span className="flex items-center gap-1.5"><StatusSquare color={C.amber} /> 60% a 90%</span>
                <span className="flex items-center gap-1.5"><StatusSquare color={C.green} /> acima de 90%</span>
              </div>

              {confronto.semOficial.length > 0 && (
                <div className="flex flex-col gap-1.5 border border-[#1e293b] px-3 py-2">
                  <Label>Apontado sem item oficial correspondente</Label>
                  <p className="text-[10px] leading-snug text-[#64748b]">
                    Apontamento valorado que não casou com nenhuma linha da medição oficial do mês — em geral grafia
                    diferente do item na planilha. Fica exposto aqui em vez de entrar no bolo da captura.
                  </p>
                  {confronto.semOficial.map((c) => (
                    <div key={c.itemMedicao} className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-[#e2e8f0]">{c.itemMedicao}</span>
                      <span className={`text-[11px] text-[#f59e0b] shrink-0 ${MONO}`}>
                        {qtdFmt(c.qtdApontada)} {c.unidade ?? ''} · {brl(c.valorApontado)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Painel>

        {/* ── 5. Quebra por núcleo / equipe / serviço ───────────────── */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Painel titulo={`Por núcleo · ${mesLabel(mes)}`} fonte="vw_medicao_em_construcao (campo nucleo)">
            <ListaQuebra dados={porNucleo} vazio="Sem apontamento com núcleo neste mês." />
          </Painel>
          <Painel titulo={`Por equipe · ${mesLabel(mes)}`} fonte="vw_medicao_em_construcao (campo equipe_nome, como veio do apontamento)">
            <ListaQuebra dados={porEquipe} vazio="Sem apontamento com equipe neste mês." />
          </Painel>
          <Painel titulo={`Por serviço apontado · ${mesLabel(mes)}`} fonte="vw_medicao_em_construcao (campo servico_apontado)">
            <ListaQuebra
              dados={porServico.map((s) => ({ ...s, nome: servicoLabel(s.nome) }))}
              vazio="Sem apontamento neste mês."
            />
          </Painel>
        </section>

        {/* ── 6. Receita da medição (colapsável) ────────────────────── */}
        <section className="border border-[#1e293b] bg-[#0d1420]">
          <button
            onClick={() => setAbrirReceita((v) => !v)}
            className="flex w-full items-center justify-between gap-3 border-b border-[#1e293b] px-3 py-2 text-left hover:bg-[#38bdf8]/5"
          >
            <div className="flex items-center gap-2">
              {abrirReceita ? <ChevronDown size={12} className="text-[#64748b]" /> : <ChevronRight size={12} className="text-[#64748b]" />}
              <Label>Receita da medição — quanto vale apontar direito</Label>
            </div>
            <span className={`text-[10px] text-[#64748b] ${MONO}`}>
              {receitaPorServico.length} {receitaPorServico.length === 1 ? 'serviço' : 'serviços'}
            </span>
          </button>

          {abrirReceita && (
            <div className="flex flex-col gap-3 px-3 py-3">
              <p className="text-[10px] leading-snug text-[#64748b]">
                Um único serviço apontado no campo gera <strong>vários itens</strong> na planilha de medição. É por isso
                que apontar direito vale dinheiro: uma caixa U.M.A não é "uma caixa", são 4 itens de contrato.
              </p>
              {receitaPorServico.length === 0 ? (
                <Vazio>Tabela de receita vazia (medicao_receita).</Vazio>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {receitaPorServico.map((s) => (
                    <div key={s.servicoApontado} className="flex flex-col gap-1.5 border border-[#1e293b] px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-semibold text-[#e2e8f0]">{servicoLabel(s.servicoApontado)}</span>
                        <span className={`text-[12px] text-[#22c55e] shrink-0 ${MONO}`}>{brl(s.valorUnitario)}</span>
                      </div>
                      <div className="text-[9px] uppercase tracking-[0.14em] text-[#475569]">
                        {s.itens.length} {s.itens.length === 1 ? 'item' : 'itens'} por unidade apontada
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {s.itens.map((i) => (
                          <div key={`${s.servicoApontado}-${i.itemMedicao}`} className="flex items-baseline justify-between gap-2">
                            <span className="text-[10px] text-[#64748b] leading-tight">
                              {i.itemMedicao}
                              {i.fator !== 1 && (
                                <span className={`text-[#f59e0b] ml-1 ${MONO}`}>
                                  × {i.fator.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                                </span>
                              )}
                            </span>
                            <span className={`text-[10px] text-[#94a3b8] shrink-0 ${MONO}`}>{brl(i.preco60 * i.fator)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Fonte>medicao_receita · preço 60% (parte WCR) · fator = razão observada em junho quando ≠ 1</Fonte>
            </div>
          )}
        </section>

        {loading && itensMes.length === 0 && !error && (
          <div className={`text-center text-[11px] text-[#64748b] py-4 ${MONO}`}>carregando medição…</div>
        )}
      </div>
    </div>
  )
}
