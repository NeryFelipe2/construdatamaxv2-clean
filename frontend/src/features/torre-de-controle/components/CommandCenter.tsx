/**
 * CommandCenter — sala de comando da OPERAÇÃO 1500 (Boi Malhado).
 *
 * Linguagem visual industrial/utilitária (inspiração Palantir Foundry/AIP):
 * dark profundo, bordas 1px, números monoespaçados tabulares, labels em caixa
 * alta, indicadores quadrados verde/âmbar/vermelho, grid denso, zero decoração.
 *
 * REGRA: todo número vem do Supabase via useCommandCenter. Sem dado → aviso
 * âmbar honesto, nunca número inventado. Fonte declarada em cada bloco.
 */
import { useEffect, useState } from 'react'
import {
  useCommandCenter,
  type CcBaixaPonto,
  type CcEquipe,
  type CcProgLinha,
} from '../useCommandCenter'

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

// ─── Helpers de data ────────────────────────────────────────────────────────

function ddmm(isoDate: string): string {
  if (!isoDate) return '--/--'
  const [, m, d] = isoDate.split('-')
  return `${d}/${m}`
}

function hojeIso(): string {
  const d = new Date()
  const p = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Dias inteiros restantes até o FIM do dia `isoDate` (>= 0). */
function diasRestantes(isoDate: string): number {
  if (!isoDate) return 0
  const fim = new Date(`${isoDate}T23:59:59`)
  const diff = fim.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

function diasEntre(isoA: string, isoB: string): number {
  const a = new Date(`${isoA}T00:00:00`).getTime()
  const b = new Date(`${isoB}T00:00:00`).getTime()
  return Math.round((b - a) / 86_400_000)
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

function Fonte({ children }: { children: React.ReactNode }) {
  return <div className={`text-[9px] text-[#475569] ${MONO} mt-auto pt-1.5`}>{children}</div>
}

/** Aviso âmbar honesto — usado sempre que falta dado real. */
function AvisoSemDado({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-2.5 py-2">
      <StatusSquare color={C.amber} />
      <span className="text-[10px] leading-snug text-[#f59e0b]">{children}</span>
    </div>
  )
}

// ─── Relógio (isolado para o re-render de 1s não repintar a tela toda) ──────

function Relogio() {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const p = (v: number) => String(v).padStart(2, '0')
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className={`text-xl leading-none text-[#e2e8f0] ${MONO}`}>
        {p(agora.getHours())}:{p(agora.getMinutes())}
        <span className="text-[#64748b]">:{p(agora.getSeconds())}</span>
      </div>
      <div className={`text-[10px] uppercase tracking-[0.14em] text-[#64748b] ${MONO}`}>
        {agora.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
      </div>
    </div>
  )
}

// ─── SVGs de série (sem lib nenhuma) ────────────────────────────────────────

function Sparkline({ pontos, cor }: { pontos: number[]; cor: string }) {
  if (pontos.length < 2) return null
  const w = 132
  const h = 30
  const max = Math.max(...pontos)
  const min = Math.min(...pontos)
  const span = max - min || 1
  const path = pontos
    .map((v, i) => {
      const x = (i / (pontos.length - 1)) * (w - 4) + 2
      const y = h - 3 - ((v - min) / span) * (h - 6)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const [lx, ly] = path.split(' ').pop()!.split(',')
  return (
    <svg width={w} height={h} className="block shrink-0" aria-hidden>
      <polyline points={path} fill="none" stroke={cor} strokeWidth="1.5" />
      <circle cx={lx} cy={ly} r="2.2" fill={cor} />
    </svg>
  )
}

function MiniBarras({ valores, cor }: { valores: number[]; cor: string }) {
  if (!valores.length) return null
  const h = 30
  const bw = 6
  const gap = 2
  const w = valores.length * (bw + gap)
  const max = Math.max(...valores, 1)
  return (
    <svg width={w} height={h} className="block shrink-0" aria-hidden>
      {valores.map((v, i) => {
        const bh = Math.max(v > 0 ? 2 : 0.5, (v / max) * (h - 4))
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={h - bh}
            width={bw}
            height={bh}
            fill={i === valores.length - 1 ? cor : '#334155'}
          />
        )
      })}
    </svg>
  )
}

// ─── Tile do grid ───────────────────────────────────────────────────────────

function Tile({
  label,
  status,
  className = '',
  children,
}: {
  label: string
  status?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`flex flex-col gap-1.5 bg-[#0d1420] px-3 py-2.5 min-h-[104px] ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {status && <StatusSquare color={status} />}
      </div>
      {children}
    </div>
  )
}

function Numerao({ valor, sufixo, cor }: { valor: string; sufixo?: string; cor?: string }) {
  return (
    <div className={`text-[26px] leading-none ${MONO}`} style={{ color: cor ?? C.text }}>
      {valor}
      {sufixo && <span className="text-[12px] text-[#64748b] ml-1">{sufixo}</span>}
    </div>
  )
}

// ─── Painel principal ───────────────────────────────────────────────────────

export function CommandCenter() {
  const {
    campanha, baixas, equipes, prog, prodDias, feed,
    penteFases, penteResumo, ruas, loading, error,
  } = useCommandCenter()

  const hoje = hojeIso()

  // Campanha
  const ultimo: CcBaixaPonto | null = baixas.length ? baixas[baixas.length - 1] : null
  const acumulado = ultimo?.acumulado ?? 0
  const faltam = campanha ? Math.max(0, campanha.alvo - acumulado) : 0
  const diasCampanha = campanha ? diasRestantes(campanha.dataFim) : 0
  const ritmoNecessario = diasCampanha > 0 ? faltam / diasCampanha : faltam

  // Ritmo real dos últimos ~7 dias da série (delta / dias corridos)
  let ritmo7: number | null = null
  if (ultimo && baixas.length >= 2) {
    const ref =
      [...baixas].reverse().find((p) => diasEntre(p.data, ultimo.data) >= 5) ?? baixas[0]
    const dias = Math.max(1, diasEntre(ref.data, ultimo.data))
    ritmo7 = (ultimo.acumulado - ref.acumulado) / dias
  }
  const corRitmo =
    ritmo7 == null ? C.muted
    : ritmo7 >= ritmoNecessario ? C.green
    : ritmo7 >= ritmoNecessario * 0.6 ? C.amber
    : C.red

  // Missão da semana: linha da programação com meta de BAIXAS
  const missao: CcProgLinha | null =
    prog.find((p) => p.servico.toLowerCase().includes('baixa') && p.metaQtd != null) ?? null
  const baseMissao = missao
    ? [...baixas].reverse().find((p) => p.data < missao.semanaIni)?.acumulado ?? 0
    : 0
  const feitoMissao = missao ? Math.max(0, acumulado - baseMissao) : 0
  const faltamMissao = missao ? Math.max(0, (missao.metaQtd ?? 0) - feitoMissao) : 0
  const diasMissao = missao ? diasRestantes(missao.semanaFim) : 0
  const pctMissao = missao && missao.metaQtd ? Math.min(100, (feitoMissao / missao.metaQtd) * 100) : 0
  const serieDesatualizada = ultimo != null && ultimo.data < hoje

  // Janela de produção (campanha)
  const soma = (f: (d: typeof prodDias[number]) => number) => prodDias.reduce((a, d) => a + f(d), 0)
  const caixasJanela = soma((d) => d.cUma)
  const hmApontado = soma((d) => d.ihm)
  const interligacoes = soma((d) => d.intercept)

  // Equipes
  const ativas = equipes.filter((e) => !e.aContratar)
  const aContratar = equipes.filter((e) => e.aContratar)

  // Encarregados (agrupamento pelo nome real da equipe — reorg 22/07)
  const grupos: { titulo: string; itens: CcEquipe[] }[] = [
    { titulo: 'DAMIÃO', itens: ativas.filter((e) => e.nome.startsWith('Damião')) },
    { titulo: 'JAILTON', itens: ativas.filter((e) => e.nome.startsWith('Jailton')) },
    { titulo: 'GILVAN', itens: ativas.filter((e) => e.nome.startsWith('Gilvan')) },
    { titulo: 'HM — JESSE/KELY', itens: ativas.filter((e) => e.nome.startsWith('HM')) },
  ]
  const agrupadas = new Set(grupos.flatMap((g) => g.itens.map((e) => e.id)))
  const outras = ativas.filter((e) => !agrupadas.has(e.id))
  if (outras.length) grupos.push({ titulo: 'OUTRAS FRENTES', itens: outras })

  const metaDaEquipe = (nome: string): CcProgLinha | null =>
    prog.find(
      (p) =>
        p.equipe.toLowerCase().startsWith(nome.toLowerCase()) ||
        nome.toLowerCase().startsWith(p.equipe.toLowerCase()),
    ) ?? null

  // Pente fino: cor da fase pela janela de datas
  const corFase = (ini: string, fim: string, status: string): string => {
    if (status === 'done' || status === 'completed') return C.green
    if (hoje > fim) return C.red
    if (hoje >= ini) return C.amber
    return C.faint
  }

  return (
    <div className="flex flex-col bg-[#0a0f1a] text-[#e2e8f0]">
      {/* ── HEADER OPS ─────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-[#1e293b] px-4 py-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusSquare color={campanha ? C.green : C.amber} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#64748b]">
              {campanha ? 'Campanha ativa' : 'Sem campanha ativa'}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold uppercase tracking-[0.08em] leading-none">
            Operação 1500 — Boi Malhado
          </h1>
          {campanha && (
            <span className={`text-[10px] text-[#475569] ${MONO}`}>
              {campanha.nome} · {ddmm(campanha.dataInicio)}→{ddmm(campanha.dataFim)}
            </span>
          )}
        </div>

        {campanha && ultimo ? (
          <div className="flex items-end gap-4 ml-auto mr-2">
            <div className="flex flex-col items-end">
              <div className={`text-4xl sm:text-5xl leading-none ${MONO}`}>
                {acumulado}
                <span className="text-[#64748b] text-2xl sm:text-3xl">/{campanha.alvo}</span>
              </div>
              <div className={`text-[10px] uppercase tracking-[0.14em] text-[#64748b] mt-1 ${MONO}`}>
                baixadas · faltam <span className="text-[#f59e0b]">{faltam}</span> · {diasCampanha}d p/ {ddmm(campanha.dataFim)}
              </div>
            </div>
          </div>
        ) : (
          !loading && (
            <div className="ml-auto mr-2">
              <AvisoSemDado>Sem série de baixas no banco (meta_baixas) — status da campanha indisponível.</AvisoSemDado>
            </div>
          )
        )}

        <div className="border-l border-[#1e293b] pl-4">
          <Relogio />
        </div>
      </header>

      {error && (
        <div className="px-4 py-2 border-b border-[#1e293b]">
          <AvisoSemDado>Falha ao ler o banco: {error}</AvisoSemDado>
        </div>
      )}

      {loading ? (
        <div className={`px-4 py-8 text-[11px] uppercase tracking-[0.2em] text-[#64748b] ${MONO}`}>
          Carregando telemetria do banco…
        </div>
      ) : (
        <>
          {/* ── MISSÃO DA SEMANA ─────────────────────────────────────────── */}
          {missao && missao.metaQtd ? (
            <section className="border-b border-[#1e293b] px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="flex items-center gap-2">
                  <StatusSquare color={faltamMissao === 0 ? C.green : diasMissao <= 1 ? C.red : C.amber} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em]">
                    Missão: {missao.metaQtd} baixas até dom {ddmm(missao.semanaFim)}
                  </span>
                </div>
                <div className={`text-[11px] text-[#64748b] ${MONO}`}>
                  <span className="text-[#e2e8f0]">{feitoMissao}</span>/{missao.metaQtd} desde {ddmm(missao.semanaIni)}
                  {' · '}faltam <span className="text-[#f59e0b]">{faltamMissao}</span>
                  {' · '}<span className="text-[#e2e8f0]">{diasMissao}</span> dia{diasMissao === 1 ? '' : 's'} restante{diasMissao === 1 ? '' : 's'}
                  {diasMissao > 0 && faltamMissao > 0 && (
                    <> · precisa <span className="text-[#ef4444]">{Math.ceil(faltamMissao / diasMissao)}/dia</span></>
                  )}
                </div>
                {serieDesatualizada && ultimo && (
                  <span className={`text-[9px] text-[#f59e0b] ${MONO}`}>
                    ⚠ série atualizada até {ddmm(ultimo.data)} (export uMov) — progresso pode estar maior
                  </span>
                )}
              </div>
              <div className="mt-2 h-1.5 w-full bg-[#1e293b]">
                <div
                  className="h-full"
                  style={{ width: `${pctMissao}%`, background: pctMissao >= 100 ? C.green : C.amber }}
                />
              </div>
              <div className={`mt-1 text-[9px] text-[#475569] ${MONO}`}>
                fonte: programacao_semana ({ddmm(missao.semanaIni)}) × meta_baixas
              </div>
            </section>
          ) : (
            <section className="border-b border-[#1e293b] px-4 py-3">
              <AvisoSemDado>Sem meta de baixas na programação da semana corrente (programacao_semana).</AvisoSemDado>
            </section>
          )}

          {/* ── GRID DE TILES ────────────────────────────────────────────── */}
          <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-px bg-[#1e293b] border-b border-[#1e293b]">
            {/* Baixas acumuladas + sparkline */}
            <Tile label="Baixas no app" status={ultimo ? corRitmo : C.amber}>
              {ultimo ? (
                <>
                  <Numerao valor={String(acumulado)} sufixo={`até ${ddmm(ultimo.data)}`} />
                  <Sparkline pontos={baixas.map((b) => b.acumulado)} cor={corRitmo} />
                  <Fonte>meta_baixas · export app uMov</Fonte>
                </>
              ) : (
                <AvisoSemDado>Sem série em meta_baixas.</AvisoSemDado>
              )}
            </Tile>

            {/* Ritmo */}
            <Tile label="Ritmo baixas/dia" status={corRitmo}>
              {ritmo7 != null ? (
                <>
                  <Numerao valor={ritmo7.toFixed(0)} sufixo="/dia (7d)" cor={corRitmo} />
                  <div className={`text-[10px] text-[#64748b] ${MONO}`}>
                    precisa <span style={{ color: ritmo7 >= ritmoNecessario ? C.green : C.red }}>{ritmoNecessario.toFixed(0)}/dia</span> p/ fechar {ddmm(campanha?.dataFim ?? '')}
                  </div>
                  <Fonte>derivado de meta_baixas</Fonte>
                </>
              ) : (
                <AvisoSemDado>Série curta demais para calcular ritmo.</AvisoSemDado>
              )}
            </Tile>

            {/* Caixas UMA janela */}
            <Tile label="Caixas UMA · janela" status={caixasJanela > 0 ? C.green : C.amber}>
              {prodDias.length ? (
                <>
                  <Numerao valor={String(caixasJanela)} sufixo={`desde ${ddmm(campanha?.dataInicio ?? '')}`} />
                  <MiniBarras valores={prodDias.map((d) => d.cUma)} cor={C.cyan} />
                  <Fonte>producao_diaria (c_uma)</Fonte>
                </>
              ) : (
                <AvisoSemDado>Sem produção na janela da campanha.</AvisoSemDado>
              )}
            </Tile>

            {/* HM divergência — honestidade */}
            <Tile label="Hidrômetros" status={C.amber}>
              <div className="flex items-baseline gap-2">
                <Numerao valor={String(acumulado)} />
                <span className={`text-[11px] text-[#64748b] ${MONO}`}>únicos no app</span>
              </div>
              <div className={`text-[11px] ${MONO}`}>
                <span className="text-[#f59e0b]">{hmApontado} apontados</span>
                <span className="text-[#64748b]"> no grupo — divergência real: apontamento de HM incompleto</span>
              </div>
              <Fonte>app uMov (meta_baixas) × producao_diaria (ihm)</Fonte>
            </Tile>

            {/* Interligações */}
            <Tile label="Interligações" status={interligacoes > 0 ? C.green : C.amber}>
              {prodDias.length ? (
                <>
                  <Numerao valor={String(interligacoes)} sufixo="na janela" />
                  <div className={`text-[10px] text-[#64748b] ${MONO}`}>
                    últimas: {prodDias.filter((d) => d.intercept > 0).map((d) => `${ddmm(d.data)}·${d.intercept}`).join('  ') || '—'}
                  </div>
                  <Fonte>producao_diaria (intercept)</Fonte>
                </>
              ) : (
                <AvisoSemDado>Sem produção na janela.</AvisoSemDado>
              )}
            </Tile>

            {/* Equipes */}
            <Tile label="Equipes ativas" status={ativas.length > 0 ? C.green : C.amber}>
              {equipes.length ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <Numerao valor={String(ativas.length)} />
                    {aContratar.length > 0 && (
                      <span className={`text-[11px] text-[#f59e0b] ${MONO}`}>+{aContratar.length} a contratar</span>
                    )}
                  </div>
                  <div className={`text-[10px] text-[#64748b] leading-snug ${MONO}`}>
                    reorg 22/07 · {grupos.filter((g) => g.itens.length).map((g) => `${g.titulo.split(' ')[0]}×${g.itens.length}`).join(' ')}
                  </div>
                  <Fonte>wcr_equipes (ativo)</Fonte>
                </>
              ) : (
                <AvisoSemDado>Nenhuma equipe ativa em wcr_equipes.</AvisoSemDado>
              )}
            </Tile>

            {/* Pente fino — tile largo */}
            <Tile label="Pente fino PVs · F1–F4" className="col-span-2 xl:col-span-3" status={penteResumo?.clandestina ? C.red : C.amber}>
              {penteFases.length ? (
                <div className="flex flex-col gap-1">
                  {penteFases.map((f) => {
                    const cor = corFase(f.dataInicio, f.dataFim, f.status)
                    return (
                      <div key={f.titulo} className="flex items-center gap-2">
                        <StatusSquare color={cor} />
                        <span className={`text-[10px] w-24 shrink-0 text-[#64748b] ${MONO}`}>
                          {ddmm(f.dataInicio)}→{ddmm(f.dataFim)}
                        </span>
                        <span className="text-[11px] truncate">{f.titulo.replace('Pente Fino ', '')}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <AvisoSemDado>Fases do pente fino não encontradas em agenda_tasks.</AvisoSemDado>
              )}
              {penteResumo ? (
                <>
                  <div className={`text-[10px] ${MONO}`}>
                    <span className="text-[#e2e8f0]">{penteResumo.total} itens punch</span>
                    <span className="text-[#64748b]"> · {penteResumo.resolvidas} resolvidos</span>
                  </div>
                  {penteResumo.clandestina && (
                    <div className="flex items-center gap-2 border border-[#ef4444]/40 bg-[#ef4444]/10 px-2 py-1">
                      <StatusSquare color={C.red} />
                      <span className={`text-[10px] text-[#ef4444] truncate ${MONO}`}>
                        GRAVE · {penteResumo.clandestina.rua} · {penteResumo.clandestina.descricao}
                      </span>
                    </div>
                  )}
                  <Fonte>agenda_tasks + ocorrencias_obra (origem=pente_fino)</Fonte>
                </>
              ) : (
                <AvisoSemDado>Sem itens do pente fino em ocorrencias_obra.</AvisoSemDado>
              )}
            </Tile>

            {/* Ruas da campanha — tile largo */}
            <Tile label="Ruas da campanha" className="col-span-2 xl:col-span-3" status={ruas && ruas.comEquipe === ruas.total ? C.green : C.amber}>
              {ruas ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <Numerao valor={`${ruas.comEquipe}/${ruas.total}`} />
                    <span className={`text-[11px] text-[#64748b] ${MONO}`}>ruas com equipe atribuída</span>
                  </div>
                  {ruas.comEquipe < ruas.total && (
                    <div className={`text-[10px] text-[#f59e0b] ${MONO}`}>
                      {ruas.total - ruas.comEquipe} rua{ruas.total - ruas.comEquipe === 1 ? '' : 's'} sem equipe — ver tela Metas
                    </div>
                  )}
                  <Fonte>meta_ruas (campanha ativa)</Fonte>
                </>
              ) : (
                <AvisoSemDado>Sem divisão de ruas em meta_ruas.</AvisoSemDado>
              )}
            </Tile>
          </section>

          {/* ── ENCARREGADOS + FEED ──────────────────────────────────────── */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-px bg-[#1e293b] border-b border-[#1e293b]">
            {/* Encarregados */}
            <div className="xl:col-span-2 bg-[#0d1420] px-3 py-2.5 flex flex-col gap-2">
              <Label>Encarregados — reorganização 22/07</Label>
              {ativas.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#1e293b]">
                  {grupos.filter((g) => g.itens.length > 0).map((g) => (
                    <div key={g.titulo} className="bg-[#0d1420] p-2 flex flex-col gap-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#e2e8f0] border-b border-[#1e293b] pb-1">
                        {g.titulo}
                      </div>
                      {g.itens.map((e) => {
                        const meta = metaDaEquipe(e.nome)
                        return (
                          <div key={e.id} className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <StatusSquare color={C.green} />
                              <span className={`text-[11px] font-semibold ${MONO}`}>{e.nome}</span>
                            </div>
                            {e.lider && e.lider !== '—' && (
                              <span className="text-[9px] text-[#64748b] pl-3.5">líder: {e.lider}</span>
                            )}
                            <span className="text-[9px] text-[#64748b] pl-3.5 leading-snug line-clamp-2">{e.foco}</span>
                            {meta?.metaQtd != null && (
                              <span className={`text-[9px] text-[#38bdf8] pl-3.5 ${MONO}`}>
                                meta {meta.metaQtd} {meta.metaUnidade ?? ''} — {meta.servico}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <AvisoSemDado>Nenhuma equipe ativa cadastrada em wcr_equipes.</AvisoSemDado>
              )}
              {aContratar.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border border-[#f59e0b]/30 bg-[#f59e0b]/5 px-2.5 py-1.5">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#f59e0b]">A contratar</span>
                  {aContratar.map((e) => (
                    <span key={e.id} className={`text-[10px] text-[#f59e0b] ${MONO}`}>
                      ▢ {e.nome}
                    </span>
                  ))}
                </div>
              )}
              <Fonte>wcr_equipes × programacao_semana</Fonte>
            </div>

            {/* Feed de eventos */}
            <div className="bg-[#0d1420] px-3 py-2.5 flex flex-col gap-2 min-h-[220px]">
              <div className="flex items-center justify-between">
                <Label>Feed de apontamentos</Label>
                <StatusSquare color={feed.length ? C.green : C.amber} />
              </div>
              {feed.length ? (
                <div className={`flex-1 overflow-y-auto max-h-[340px] text-[10px] leading-[1.7] ${MONO}`}>
                  {feed.map((f, i) => (
                    <div key={i} className="flex gap-2 border-b border-[#1e293b]/60 py-0.5">
                      <span className="text-[#475569] shrink-0">[{ddmm(f.data)}]</span>
                      <span className="text-[#38bdf8] shrink-0 uppercase truncate max-w-[92px]" title={f.equipe}>
                        {f.equipe || '—'}
                      </span>
                      <span className="text-[#64748b] truncate" title={f.rua}>{f.rua || '—'}</span>
                      <span className="text-[#e2e8f0] ml-auto shrink-0 text-right">{f.itens.join(' · ')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <AvisoSemDado>Sem apontamentos em producao_diaria.</AvisoSemDado>
              )}
              <Fonte>producao_diaria · últimos lançamentos</Fonte>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
