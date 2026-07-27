/**
 * CronogramaPvsPanel — "CRONOGRAMA DE REPARO DOS PVs" (tela Punch List).
 *
 * Timeline dia a dia dos PVs do pente fino do esgoto do Boi Malhado, lida da
 * tabela `pente_fino_cronograma` via usePenteFinoCronograma. Cada linha traz o
 * chip do PV, a rua, a casa de frente e a profundidade em mono, e um controle
 * que grava no banco o estado de reparo — é assim que o campo fecha o item.
 *
 * Linguagem visual: industrial/utilitária (Palantir Foundry) — dark #0a0f1a
 * sobre #0d1420, bordas 1px #1e293b, números font-mono tabular-nums, labels
 * CAIXA ALTA 9-11px com letter-spacing, quadrado de status #22c55e / #f59e0b /
 * #ef4444. Gráfico em SVG puro, sem nenhuma lib nova.
 *
 * Honestidade: `arrumado` null NÃO vira "pendente" — vira "sem confirmação de
 * campo", em cinza. E os PVs do cadastro que ainda não têm data programada
 * aparecem como aviso âmbar, não como zero disfarçado.
 */
import { useMemo } from 'react'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  usePenteFinoCronograma,
  type PenteFinoArrumado,
  type PenteFinoPv,
} from '@/hooks/usePenteFinoCronograma'

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

const STATUS_META: Record<'feito' | 'a fazer' | 'sem', {
  label: string
  cor: string
  texto: string
  borda: string
  fundo: string
}> = {
  feito: {
    label: 'FEITO',
    cor: '#22c55e',
    texto: 'text-[#22c55e]',
    borda: 'border-[#22c55e]/40',
    fundo: 'bg-[#22c55e]/10',
  },
  'a fazer': {
    label: 'A FAZER',
    cor: '#f59e0b',
    texto: 'text-[#f59e0b]',
    borda: 'border-[#f59e0b]/40',
    fundo: 'bg-[#f59e0b]/10',
  },
  sem: {
    label: 'SEM CONFIRMAÇÃO DE CAMPO',
    cor: '#475569',
    texto: 'text-slate-500',
    borda: 'border-[#1e293b]',
    fundo: 'bg-slate-500/5',
  },
}

function metaDe(arrumado: PenteFinoArrumado) {
  if (arrumado === 'feito') return STATUS_META.feito
  if (arrumado === 'a fazer') return STATUS_META['a fazer']
  return STATUS_META.sem
}

/** ISO yyyy-mm-dd de hoje no fuso local (não usa toISOString, que joga pra UTC). */
function hojeLocalIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function labelDia(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  const dow = Number.isNaN(d.getTime()) ? '' : `${DIAS_SEMANA[d.getDay()]} `
  return `${dow}${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/**
 * O PV da SAÍDA CLANDESTINA: PV existente na Rua Vanessa Atalanta N°108, o item
 * GRAVE levantado pelo fiscal no pente fino (também está em `ocorrencias_obra`).
 */
function ehClandestina(p: PenteFinoPv): boolean {
  const rua = (p.rua ?? '').toLowerCase()
  const casa = (p.casa_frente ?? '').replace(/\D/g, '')
  return rua.includes('vanessa') && casa === '108'
}

function fmtProf(m: number | null): string {
  if (m === null || Number.isNaN(m)) return '—'
  return `${m.toFixed(2).replace('.', ',')} m`
}

/** Rótulo curto das frentes de reparo (ids de wcr_equipes). */
const EQUIPE_LABEL: Record<string, string> = {
  'eq-pv': 'EQ PV · Michael',
  'eq-esgoto': 'EQ ESGOTO · Juan',
  'eq-pente-fino': 'EQ PENTE FINO',
}
function labelEquipe(id: string | null): string | null {
  if (!id) return null
  return EQUIPE_LABEL[id] ?? id.replace(/^eq-/, 'EQ ').toUpperCase()
}

/** Faixa SVG do cronograma: uma coluna por dia, um quadrado por PV. */
function FaixaSvg({
  dias,
  hoje,
}: {
  dias: Array<{ data: string; itens: PenteFinoPv[] }>
  hoje: string
}) {
  const COL = 58
  const SQ = 12
  const GAP = 4
  const TOPO = 6
  const RODAPE = 20
  const maxItens = dias.reduce((m, d) => Math.max(m, d.itens.length), 1)
  const largura = Math.max(dias.length * COL, COL)
  const altura = TOPO + maxItens * (SQ + GAP) + RODAPE

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        width={largura}
        height={altura}
        role="img"
        aria-label="Faixa do cronograma de reparo dos PVs por dia"
        className="block"
      >
        {dias.map((dia, i) => {
          const x = i * COL
          const cx = x + COL / 2
          const passou = dia.data < hoje
          return (
            <g key={dia.data}>
              {dia.data === hoje && (
                <rect x={x} y={0} width={COL} height={altura} fill="#1e293b" opacity={0.55} />
              )}
              {dia.itens.map((p, j) => {
                const cor = ehClandestina(p) ? '#ef4444' : metaDe(p.arrumado).cor
                return (
                  <rect
                    key={p.id}
                    x={cx - SQ / 2}
                    y={TOPO + j * (SQ + GAP)}
                    width={SQ}
                    height={SQ}
                    fill={cor}
                    fillOpacity={p.arrumado === null && !ehClandestina(p) ? 0.35 : 1}
                    stroke={cor}
                    strokeOpacity={0.7}
                  >
                    <title>{`${p.pv} · ${ddmm(dia.data)} · ${metaDe(p.arrumado).label}`}</title>
                  </rect>
                )
              })}
              <text
                x={cx}
                y={altura - 7}
                textAnchor="middle"
                fontSize={9}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fill={dia.data === hoje ? '#e2e8f0' : passou ? '#475569' : '#64748b'}
              >
                {ddmm(dia.data)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Kpi({ label, valor, cor, nota }: { label: string; valor: number; cor: string; nota?: string }) {
  return (
    <div className="bg-[#0d1420] border border-[#1e293b] px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: cor }} />
        <span className="text-[9px] font-semibold tracking-[0.12em] text-slate-500 uppercase">{label}</span>
      </div>
      <div
        className="mt-1 font-mono [font-variant-numeric:tabular-nums] text-xl leading-none font-bold"
        style={{ color: cor }}
      >
        {valor}
      </div>
      {nota && <div className="mt-1 text-[9px] text-slate-600 leading-tight">{nota}</div>}
    </div>
  )
}

export function CronogramaPvsPanel({
  ocorrenciaClandestinaResolvida,
}: {
  /** Situação da ocorrência "SAÍDA CLANDESTINA" em `ocorrencias_obra`; null = não encontrada. */
  ocorrenciaClandestinaResolvida?: boolean | null
}) {
  const { dias, kpis, janela, fonte, loading, error, reload, marcarArrumado } = usePenteFinoCronograma()
  const hoje = useMemo(() => hojeLocalIso(), [])
  // Sem Supabase configurado não há onde gravar — botões desabilitados, sem fingir.
  const podeGravar = Boolean(supabase)

  return (
    <section className="bg-[#0a0f1a] border border-[#1e293b] rounded-xl overflow-hidden">
      {/* header */}
      <div className="bg-[#0d1420] border-b border-[#1e293b] px-4 py-3 flex flex-wrap items-center gap-3">
        <span
          className="w-2 h-2 shrink-0"
          style={{ backgroundColor: loading ? '#f59e0b' : error ? '#ef4444' : '#22c55e' }}
        />
        <h2 className="text-[11px] font-semibold tracking-[0.15em] text-slate-200 uppercase">
          Cronograma de reparo dos PVs
        </h2>
        <span className="font-mono [font-variant-numeric:tabular-nums] text-[10px] text-slate-500 tracking-wider">
          PENTE FINO · {kpis.programados} PVs
          {janela ? ` · ${ddmm(janela.inicio)} → ${ddmm(janela.fim)}` : ''}
        </span>
        <button
          onClick={() => reload()}
          className="ml-auto text-slate-500 hover:text-slate-200 transition-colors p-1"
          title="Recarregar cronograma"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Kpi
            label="Programados"
            valor={kpis.programados}
            cor="#e2e8f0"
            nota={`${kpis.doCampo} do campo + ${kpis.propostos} propostos`}
          />
          <Kpi label="Propostos" valor={kpis.propostos} cor="#38bdf8" nota="data sugerida — campo confirma" />
          <Kpi label="Feitos" valor={kpis.feitos} cor="#22c55e" nota="confirmados pelo campo" />
          <Kpi label="A fazer" valor={kpis.aFazer} cor="#f59e0b" nota="pendência confirmada" />
          <Kpi label="Sem confirmação" valor={kpis.semConfirmacao} cor="#64748b" nota="campo não marcou nada" />
        </div>

        {/* aviso honesto: parte do cronograma é PROPOSTA, não marcação de campo */}
        {kpis.propostos > 0 && (
          <div className="px-3 py-2 border border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[10px] text-[#38bdf8] flex items-start gap-2">
            <AlertTriangle size={12} className="shrink-0 mt-px" />
            <span className="leading-relaxed">
              <strong className="font-mono [font-variant-numeric:tabular-nums]">{kpis.propostos}</strong> dos{' '}
              <strong className="font-mono [font-variant-numeric:tabular-nums]">{kpis.cadastroTotal}</strong> PVs têm
              data <strong>PROPOSTA</strong> (27/07 · 2 frentes × 4 PVs/dia agrupadas por rua · prazo 09/08) — o campo
              confirma ou ajusta pelo mesmo fluxo do GPKG. Frentes: <strong>EQ PV (Michael Douglas)</strong> +{' '}
              <strong>EQ ESGOTO (Juan Carlos)</strong>, com o MND do escadão (61,4 m) junto dos 6 PVs colineares em
              29–31/07.
            </span>
          </div>
        )}

        {/* aviso honesto: o cadastro é maior que o cronograma */}
        {kpis.semDataProgramada > 0 && (
          <div className="px-3 py-2 border border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[10px] text-[#f59e0b] flex items-start gap-2">
            <AlertTriangle size={12} className="shrink-0 mt-px" />
            <span className="leading-relaxed">
              <strong className="font-mono [font-variant-numeric:tabular-nums]">{kpis.semDataProgramada}</strong> dos{' '}
              <strong className="font-mono [font-variant-numeric:tabular-nums]">{kpis.cadastroTotal}</strong> PVs do
              cadastro do pente fino ainda estão <strong>SEM data programada</strong> — só{' '}
              <span className="font-mono [font-variant-numeric:tabular-nums]">{kpis.programados}</span> entraram no
              cronograma do GPKG. O restante não tem data no banco e a tela não arbitra uma.
            </span>
          </div>
        )}

        {error && (
          <div className="px-3 py-2 border border-[#ef4444]/40 bg-[#ef4444]/10 text-[10px] text-red-300 flex items-center gap-2">
            <AlertTriangle size={12} className="shrink-0" />
            <span>Erro ao carregar o cronograma: {error}</span>
          </div>
        )}

        {/* faixa SVG */}
        {dias.length > 0 && (
          <div className="border border-[#1e293b] bg-[#0d1420] px-3 py-2">
            <div className="text-[9px] font-semibold tracking-[0.12em] text-slate-600 uppercase mb-1">
              Faixa do cronograma · 1 quadrado = 1 PV
            </div>
            <FaixaSvg dias={dias} hoje={hoje} />
          </div>
        )}

        {/* timeline */}
        {loading && dias.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            <Loader2 size={18} className="mx-auto mb-2 animate-spin" />
            <p className="text-[10px] font-mono tracking-wider uppercase">Carregando cronograma real…</p>
          </div>
        ) : dias.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[10px] font-mono tracking-wider uppercase text-slate-500">
              Nenhum PV com data programada em pente_fino_cronograma
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {dias.map((dia) => {
              const passou = dia.data < hoje
              const ehHoje = dia.data === hoje
              return (
                <div key={dia.data}>
                  {/* cabeçalho do dia */}
                  <div className="flex items-center gap-2 mt-2 mb-1">
                    <span
                      className={`font-mono [font-variant-numeric:tabular-nums] text-[10px] font-semibold tracking-[0.12em] w-[4.75rem] text-right ${
                        ehHoje ? 'text-slate-100' : passou ? 'text-slate-600' : 'text-slate-400'
                      }`}
                    >
                      {labelDia(dia.data)}
                    </span>
                    {ehHoje && (
                      <span className="text-[9px] font-bold tracking-[0.08em] px-1.5 py-px border border-slate-400 bg-slate-500/20 text-slate-100">
                        HOJE
                      </span>
                    )}
                    <span className="flex-1 h-px bg-[#1e293b]" />
                    <span className="font-mono [font-variant-numeric:tabular-nums] text-[9px] text-slate-600">
                      {dia.itens.length}
                    </span>
                  </div>

                  {/* PVs do dia */}
                  <div className="space-y-1">
                    {dia.itens.map((p) => {
                      const meta = metaDe(p.arrumado)
                      const grave = ehClandestina(p)
                      const atrasoSemConfirmacao = passou && p.arrumado !== 'feito'
                      return (
                        <div
                          key={p.id}
                          className={`ml-[4.75rem] border-l-2 pl-3 pr-2 py-2 border border-[#1e293b] ${
                            grave
                              ? 'border-l-[#ef4444] bg-[#ef4444]/[0.07]'
                              : p.arrumado === 'feito'
                                ? 'border-l-[#22c55e] bg-[#0d1420]'
                                : p.arrumado === 'a fazer'
                                  ? 'border-l-[#f59e0b] bg-[#0d1420]'
                                  : 'border-l-slate-700 bg-[#0d1420]'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span
                              className="w-2 h-2 shrink-0"
                              style={{ backgroundColor: grave ? '#ef4444' : meta.cor }}
                            />
                            <span
                              className={`font-mono [font-variant-numeric:tabular-nums] text-[11px] font-bold px-1.5 py-px border ${
                                grave
                                  ? 'text-red-300 border-[#ef4444]/50 bg-[#ef4444]/10'
                                  : 'text-slate-100 border-[#1e293b] bg-[#0a0f1a]'
                              }`}
                            >
                              {p.pv}
                            </span>
                            {p.situacao && (
                              <span className="text-[9px] font-semibold tracking-[0.08em] uppercase text-slate-500 border border-[#1e293b] px-1.5 py-px">
                                {p.situacao}
                              </span>
                            )}
                            <span className={`text-[11px] ${grave ? 'text-red-200' : 'text-slate-300'}`}>
                              {p.rua ?? '—'}
                            </span>
                            {p.casa_frente && (
                              <span className="font-mono [font-variant-numeric:tabular-nums] text-[10px] text-slate-400">
                                casa {p.casa_frente}
                              </span>
                            )}
                            <span className="font-mono [font-variant-numeric:tabular-nums] text-[10px] px-1.5 py-px border border-[#1e293b] bg-[#0a0f1a] text-slate-300">
                              <span className="text-slate-600">PROF</span> {fmtProf(p.profundidade_m)}
                            </span>
                            {p.proposta && (
                              <span
                                className="text-[9px] font-bold tracking-[0.08em] px-1.5 py-px border border-[#38bdf8]/50 bg-[#38bdf8]/10 text-[#38bdf8]"
                                title="Data PROPOSTA (27/07, 2 frentes × 4/dia por rua) — o campo confirma ou ajusta pelo GPKG"
                              >
                                PROPOSTA
                              </span>
                            )}
                            {labelEquipe(p.equipe_principal) && (
                              <span
                                className="text-[9px] font-semibold tracking-[0.06em] px-1.5 py-px border border-[#1e293b] bg-[#0a0f1a] text-slate-400"
                                title={`Frente principal: ${p.equipe_principal}${p.equipe_apoio ? ` · apoio: ${p.equipe_apoio}` : ''}`}
                              >
                                {labelEquipe(p.equipe_principal)}
                              </span>
                            )}

                            {/* status + ações */}
                            <div className="ml-auto flex items-center gap-2">
                              <span
                                className={`text-[9px] font-bold tracking-[0.08em] px-1.5 py-px border ${meta.borda} ${meta.fundo} ${meta.texto}`}
                              >
                                {p.arrumado === 'feito' ? '✓ FEITO' : meta.label}
                              </span>
                              <div className="flex border border-[#1e293b] divide-x divide-[#1e293b]">
                                <button
                                  onClick={() => marcarArrumado(p.id, 'feito')}
                                  disabled={!podeGravar}
                                  title="Confirmar que o reparo deste PV foi FEITO (grava em pente_fino_cronograma.arrumado)"
                                  className={`px-2 py-1 text-[9px] font-bold tracking-[0.08em] transition-colors disabled:opacity-40 ${
                                    p.arrumado === 'feito'
                                      ? 'bg-[#22c55e]/20 text-[#22c55e]'
                                      : 'text-slate-500 hover:text-[#22c55e] hover:bg-[#22c55e]/10'
                                  }`}
                                >
                                  ✓ FEITO
                                </button>
                                <button
                                  onClick={() => marcarArrumado(p.id, 'a fazer')}
                                  disabled={!podeGravar}
                                  title="Confirmar que este PV ainda está A FAZER"
                                  className={`px-2 py-1 text-[9px] font-bold tracking-[0.08em] transition-colors disabled:opacity-40 ${
                                    p.arrumado === 'a fazer'
                                      ? 'bg-[#f59e0b]/20 text-[#f59e0b]'
                                      : 'text-slate-500 hover:text-[#f59e0b] hover:bg-[#f59e0b]/10'
                                  }`}
                                >
                                  A FAZER
                                </button>
                                <button
                                  onClick={() => marcarArrumado(p.id, null)}
                                  disabled={!podeGravar}
                                  title="Limpar: volta para SEM CONFIRMAÇÃO DE CAMPO"
                                  className={`px-2 py-1 text-[9px] font-bold tracking-[0.08em] transition-colors disabled:opacity-40 ${
                                    p.arrumado === null
                                      ? 'bg-slate-500/20 text-slate-300'
                                      : 'text-slate-600 hover:text-slate-300 hover:bg-slate-500/10'
                                  }`}
                                >
                                  —
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* nota GRAVE da saída clandestina */}
                          {grave && (
                            <div className="mt-1.5 flex items-start gap-1.5 text-[10px] text-red-300 leading-relaxed">
                              <AlertTriangle size={11} className="shrink-0 mt-px" />
                              <span>
                                <strong className="tracking-[0.06em]">SAÍDA CLANDESTINA — ITEM GRAVE.</strong> PV
                                existente na Rua Vanessa Atalanta N°108, com saída ligada por morador; levantado no
                                pente fino e registrado em <code className="text-red-200">ocorrencias_obra</code>.
                                {ocorrenciaClandestinaResolvida === false && ' Ocorrência ainda ABERTA no punch list.'}
                                {ocorrenciaClandestinaResolvida === true && ' Ocorrência já marcada RESOLVIDA no punch list.'}
                              </span>
                            </div>
                          )}

                          {/* data já passou sem confirmação de reparo */}
                          {atrasoSemConfirmacao && !grave && (
                            <div className="mt-1.5 text-[9px] font-semibold tracking-[0.08em] uppercase text-[#f59e0b]">
                              Data programada já passou · sem confirmação de reparo
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* legenda + fonte declarada */}
        <div className="pt-2 border-t border-[#1e293b] flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="flex items-center gap-1.5 text-[9px] tracking-[0.08em] uppercase text-slate-500">
            <span className="w-2 h-2 bg-[#22c55e]" /> feito
          </span>
          <span className="flex items-center gap-1.5 text-[9px] tracking-[0.08em] uppercase text-slate-500">
            <span className="w-2 h-2 bg-[#f59e0b]" /> a fazer
          </span>
          <span className="flex items-center gap-1.5 text-[9px] tracking-[0.08em] uppercase text-slate-500">
            <span className="w-2 h-2 bg-slate-600" /> sem confirmação de campo
          </span>
          <span className="flex items-center gap-1.5 text-[9px] tracking-[0.08em] uppercase text-slate-500">
            <span className="w-2 h-2 bg-[#ef4444]" /> crítico
          </span>
          <span className="flex items-center gap-1.5 text-[9px] tracking-[0.08em] uppercase text-slate-500">
            <span className="w-2 h-2 border border-[#38bdf8] bg-[#38bdf8]/20" /> proposta (campo confirma)
          </span>
          <span className="ml-auto text-[9px] text-slate-600 font-mono">
            TABELA pente_fino_cronograma{fonte ? ` · ${fonte}` : ''} · colunas arrumado / data_execucao preenchidas em campo
          </span>
        </div>
      </div>
    </section>
  )
}
