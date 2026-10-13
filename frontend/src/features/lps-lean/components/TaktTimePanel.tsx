/**
 * TaktTimePanel — LINHA DE BALANÇO (LOB) real da obra linear.
 *
 * Substitui o antigo painel mock de takt por zona (que lia taktZones do
 * lpsStore, dado de demonstração) por uma Linha de Balanço desenhada 100% do
 * banco via useLinhaBalanco:
 *
 *  - Eixo Y = ruas de `logradouros` (origem meta_ruas primeiro, na ordem de
 *    ataque da campanha; depois cadastro_ligacoes; depois producao_diaria).
 *  - Eixo X = tempo (dias), janela = min→max de producao_diaria.data,
 *    estendida até HOJE quando hoje passa do último apontamento.
 *  - Uma polilinha por ETAPA da esteira (vw_producao_longa agregada por
 *    rua×dia): ponto = dia com produção daquela etapa naquela rua, pontos
 *    conectados em ordem cronológica — a "linha" mostra a frente avançando
 *    pelas ruas.
 *  - Produção com rua_id null (sem match na dimensão) vira a linha
 *    "SEM CADASTRO" no fim — nunca é descartada em silêncio.
 *  - Conflito de esteira (etapa posterior apontada ANTES da anterior na mesma
 *    rua, ex.: HM antes de CAIXA UMA) = quadrado vermelho com tooltip.
 *  - Painel inferior: takt real por etapa (média de ruas atendidas por dia
 *    ativo, calculada da própria série) × takt necessário (ruas restantes ÷
 *    dias até o fim da campanha em metas_producao). Sem dado → "—" explicado.
 *
 * Linguagem visual Palantir do repo (CommandCenter/Metas): dark #0a0f1a sobre
 * #0d1420, bordas 1px #1e293b, números mono tabulares, labels CAIXA ALTA,
 * quadrados de status, fonte declarada em 9px em cada bloco. SVG puro.
 */
import { useMemo, useState } from 'react'
import { useLinhaBalanco, type LbPonto, type LbRua } from '@/hooks/useLinhaBalanco'

// ─── Constantes visuais (mesma paleta do CommandCenter) ─────────────────────

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

// ─── Etapas da esteira (cores fixas da spec; demais em cinza) ───────────────

interface EtapaMeta {
  key: string
  label: string
  cor: string
  /** 'm' = metros (rede), 'un' = unidades. */
  unidade: 'm' | 'un'
}

const ETAPAS: EtapaMeta[] = [
  { key: 'rede_agua_m',         label: 'REDE ÁGUA',       cor: '#22d3ee', unidade: 'm'  },
  { key: 'caixa_uma',           label: 'CAIXA UMA',       cor: '#f59e0b', unidade: 'un' },
  { key: 'hm',                  label: 'HM',              cor: '#38bdf8', unidade: 'un' },
  { key: 'lig_agua',            label: 'LIG ÁGUA',        cor: '#22c55e', unidade: 'un' },
  { key: 'rede_esgoto_m',       label: 'REDE ESGOTO',     cor: '#fb923c', unidade: 'm'  },
  { key: 'caixa_inspecao',      label: 'CAIXA INSPEÇÃO',  cor: '#64748b', unidade: 'un' },
  { key: 'lig_esgoto',          label: 'LIG ESGOTO',      cor: '#a78bfa', unidade: 'un' },
  { key: 'interligacao_agua',   label: 'INTERLIG ÁGUA',   cor: '#64748b', unidade: 'un' },
  { key: 'interligacao_esgoto', label: 'INTERLIG ESGOTO', cor: '#64748b', unidade: 'un' },
  { key: 'pv',                  label: 'PV',              cor: '#64748b', unidade: 'un' },
  { key: 'pi',                  label: 'PI',              cor: '#64748b', unidade: 'un' },
  { key: 'interceptor',         label: 'INTERCEPTOR',     cor: '#64748b', unidade: 'un' },
]

/** Etapa desconhecida na view (defensivo): entra em cinza com o nome cru. */
function etapaMeta(key: string): EtapaMeta {
  return ETAPAS.find((e) => e.key === key) ?? { key, label: key.toUpperCase(), cor: '#64748b', unidade: 'un' }
}

/**
 * Cadeias da esteira construtiva (sequência física — memória do projeto:
 * rede → caixa → HM → ligação). Só o que tem ordem inequívoca entra na checagem
 * de conflito; PV/PI/interceptor/interligações ficam fora (sem sequência
 * óbvia por rua — não inventamos regra).
 */
const CADEIAS: string[][] = [
  ['rede_agua_m', 'caixa_uma', 'hm', 'lig_agua'],
  ['rede_esgoto_m', 'caixa_inspecao', 'lig_esgoto'],
]

// ─── Geometria ──────────────────────────────────────────────────────────────

const LABEL_W = 210 // coluna de rótulos das ruas
const DAY_W   = 26  // px por dia
const ROW_H   = 20  // px por linha (rua ou cabeçalho de grupo)
const PAD_T   = 30  // eixo de datas no topo
const PAD_B   = 8

// ─── Helpers de data/formatação ─────────────────────────────────────────────

function hojeIso(): string {
  const d = new Date()
  const p = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function ddmm(isoDate: string): string {
  if (!isoDate) return '--/--'
  const [, m, d] = isoDate.split('-')
  return `${d}/${m}`
}

function diasEntre(isoA: string, isoB: string): number {
  const a = new Date(`${isoA}T00:00:00`).getTime()
  const b = new Date(`${isoB}T00:00:00`).getTime()
  return Math.round((b - a) / 86_400_000)
}

function addDias(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + n)
  const p = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function ehSegunda(isoDate: string): boolean {
  return new Date(`${isoDate}T00:00:00`).getDay() === 1
}

function fmtQtd(qtd: number, unidade: 'm' | 'un'): string {
  const v = Math.round(qtd * 10) / 10
  return unidade === 'm' ? `${v}m` : String(v)
}

function truncar(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

// ─── Blocos básicos (padrão CommandCenter) ──────────────────────────────────

function StatusSquare({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 shrink-0" style={{ background: color }} />
}

function Fonte({ children }: { children: React.ReactNode }) {
  return <div className={`text-[9px] text-[#475569] ${MONO}`}>{children}</div>
}

function AvisoSemDado({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-2.5 py-2">
      <StatusSquare color={C.amber} />
      <span className="text-[10px] leading-snug text-[#f59e0b]">{children}</span>
    </div>
  )
}

// ─── Tipos internos do layout ───────────────────────────────────────────────

type Linha =
  | { tipo: 'grupo'; chave: string; label: string }
  | { tipo: 'rua'; chave: string; rua: LbRua }
  | { tipo: 'sem'; chave: string; nPontos: number }

interface Conflito {
  ruaChave: string
  ruaNome: string
  /** primeira data da etapa POSTERIOR (onde o quadrado vermelho é desenhado). */
  data: string
  linhas: string[]
}

interface Tip {
  x: number
  y: number
  titulo: string
  linhas: string[]
}

const SEM_CADASTRO = '__sem_cadastro__'

// ─── Painel ─────────────────────────────────────────────────────────────────

export function TaktTimePanel() {
  const { ruas, pontos, campanha, janela, diasComProducao, loading, error } = useLinhaBalanco()
  const [mostrarTodas, setMostrarTodas] = useState(false)
  const [etapasOcultas, setEtapasOcultas] = useState<Set<string>>(new Set())
  const [tip, setTip] = useState<Tip | null>(null)

  const hoje = hojeIso()

  // ── ruas com produção + pontos por rua (chave '__sem_cadastro__' = rua_id null)
  const ruasComProducao = useMemo(() => {
    const s = new Set<string>()
    for (const p of pontos) if (p.ruaId) s.add(p.ruaId)
    return s
  }, [pontos])

  const nPontosSemCadastro = useMemo(
    () => pontos.filter((p) => p.ruaId === null).length,
    [pontos],
  )

  // ── linhas do eixo Y: grupos por origem, campanha na ordem de ataque
  const linhas = useMemo<Linha[]>(() => {
    const visiveis = mostrarTodas ? ruas : ruas.filter((r) => ruasComProducao.has(r.id))
    const porNome = (a: LbRua, b: LbRua) => a.nome.localeCompare(b.nome, 'pt-BR')

    const grupoCampanha = visiveis
      .filter((r) => r.origem === 'meta_ruas')
      .sort((a, b) => {
        const oa = a.ordemMeta ?? Number.MAX_SAFE_INTEGER
        const ob = b.ordemMeta ?? Number.MAX_SAFE_INTEGER
        return oa !== ob ? oa - ob : porNome(a, b)
      })
    const grupoCadastro = visiveis.filter((r) => r.origem === 'cadastro_ligacoes').sort(porNome)
    const grupoProducao = visiveis.filter((r) => r.origem === 'producao_diaria').sort(porNome)
    const grupoOutras = visiveis
      .filter((r) => !['meta_ruas', 'cadastro_ligacoes', 'producao_diaria'].includes(r.origem))
      .sort(porNome)

    const out: Linha[] = []
    const empurrar = (label: string, grupo: LbRua[]) => {
      if (grupo.length === 0) return
      out.push({ tipo: 'grupo', chave: `g:${label}`, label })
      for (const r of grupo) out.push({ tipo: 'rua', chave: r.id, rua: r })
    }
    empurrar('CAMPANHA · meta_ruas (ordem de ataque)', grupoCampanha)
    empurrar('CADASTRO · cadastro_ligacoes', grupoCadastro)
    empurrar('APONTAMENTO · producao_diaria', grupoProducao)
    empurrar('OUTRAS ORIGENS', grupoOutras)
    if (nPontosSemCadastro > 0) {
      out.push({ tipo: 'grupo', chave: 'g:sem', label: 'SEM CADASTRO' })
      out.push({ tipo: 'sem', chave: SEM_CADASTRO, nPontos: nPontosSemCadastro })
    }
    return out
  }, [ruas, ruasComProducao, mostrarTodas, nPontosSemCadastro])

  // ── índice vertical por chave de linha (rua.id ou SEM_CADASTRO)
  const idxPorChave = useMemo(() => {
    const m = new Map<string, number>()
    linhas.forEach((l, i) => {
      if (l.tipo !== 'grupo') m.set(l.chave, i)
    })
    return m
  }, [linhas])

  // ── domínio X: janela real da produção, estendida até hoje
  const dominio = useMemo(() => {
    if (!janela) return null
    const ate = janela.ate >= hoje ? janela.ate : hoje
    return { de: janela.de, ate, nDias: diasEntre(janela.de, ate) + 1 }
  }, [janela, hoje])

  const W = dominio ? LABEL_W + dominio.nDias * DAY_W + 8 : 0
  const H = PAD_T + linhas.length * ROW_H + PAD_B

  const x = (isoDate: string): number =>
    dominio ? LABEL_W + diasEntre(dominio.de, isoDate) * DAY_W + DAY_W / 2 : 0
  const yCentro = (chave: string): number | null => {
    const i = idxPorChave.get(chave)
    return i === undefined ? null : PAD_T + i * ROW_H + ROW_H / 2
  }

  // ── séries por etapa (pontos posicionados, em ordem cronológica)
  const series = useMemo(() => {
    if (!dominio) return []
    const porEtapa = new Map<string, { ponto: LbPonto; px: number; py: number }[]>()
    for (const p of pontos) {
      const chave = p.ruaId ?? SEM_CADASTRO
      const py = yCentro(chave)
      if (py === null) continue // rua fora do eixo (não deve acontecer; defensivo)
      const arr = porEtapa.get(p.etapa) ?? []
      arr.push({ ponto: p, px: x(p.data), py })
      porEtapa.set(p.etapa, arr)
    }
    return [...porEtapa.entries()].map(([etapa, pts]) => ({
      meta: etapaMeta(etapa),
      pts: pts.sort((a, b) => (a.ponto.data !== b.ponto.data ? a.ponto.data.localeCompare(b.ponto.data) : a.py - b.py)),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pontos, dominio, idxPorChave])

  // ── conflitos de esteira: etapa posterior com 1ª data ANTES da 1ª data da anterior
  const conflitos = useMemo<Conflito[]>(() => {
    const nomePorRua = new Map(ruas.map((r) => [r.id, r.nome]))
    // 1ª data de cada etapa por rua (rua_id real; SEM CADASTRO mistura ruas → fora da checagem)
    const primeiraData = new Map<string, Map<string, string>>()
    for (const p of pontos) {
      if (!p.ruaId) continue
      const porEtapa = primeiraData.get(p.ruaId) ?? new Map<string, string>()
      const atual = porEtapa.get(p.etapa)
      if (!atual || p.data < atual) porEtapa.set(p.etapa, p.data)
      primeiraData.set(p.ruaId, porEtapa)
    }
    const porCelula = new Map<string, Conflito>()
    for (const [ruaId, porEtapa] of primeiraData) {
      for (const cadeia of CADEIAS) {
        for (let i = 0; i < cadeia.length; i++) {
          for (let j = i + 1; j < cadeia.length; j++) {
            const dAnt = porEtapa.get(cadeia[i])
            const dPost = porEtapa.get(cadeia[j])
            if (!dAnt || !dPost || dPost >= dAnt) continue
            const chave = `${ruaId}|${dPost}`
            const linha = `${etapaMeta(cadeia[j]).label} ${ddmm(dPost)} antes de ${etapaMeta(cadeia[i]).label} ${ddmm(dAnt)}`
            const acc = porCelula.get(chave)
            if (acc) acc.linhas.push(linha)
            else porCelula.set(chave, {
              ruaChave: ruaId,
              ruaNome: nomePorRua.get(ruaId) ?? ruaId,
              data: dPost,
              linhas: [linha],
            })
          }
        }
      }
    }
    return [...porCelula.values()]
  }, [pontos, ruas])

  // ── takt real × necessário por etapa
  const diasAteFim = campanha ? Math.max(0, diasEntre(hoje, campanha.periodoFim)) : null
  const universoRuas = ruas.length

  const taktLinhas = useMemo(() => {
    const porEtapa = new Map<string, { ruas: Set<string>; dias: Set<string>; nPontos: number }>()
    for (const p of pontos) {
      const acc = porEtapa.get(p.etapa) ?? { ruas: new Set<string>(), dias: new Set<string>(), nPontos: 0 }
      if (p.ruaId) acc.ruas.add(p.ruaId)
      acc.dias.add(p.data)
      acc.nPontos += 1
      porEtapa.set(p.etapa, acc)
    }
    return ETAPAS
      .filter((e) => porEtapa.has(e.key))
      .map((e) => {
        const acc = porEtapa.get(e.key)!
        const diasAtivos = acc.dias.size
        // takt real = média de ruas atendidas por dia ATIVO (pontos rua×dia ÷ dias ativos)
        const taktReal = diasAtivos > 0 ? acc.nPontos / diasAtivos : null
        const ruasRestantes = Math.max(0, universoRuas - acc.ruas.size)
        const taktNec = diasAteFim !== null && diasAteFim > 0 ? ruasRestantes / diasAteFim : null
        return {
          meta: e,
          ruasAtendidas: acc.ruas.size,
          diasAtivos,
          taktReal,
          ruasRestantes,
          taktNec,
        }
      })
  }, [pontos, universoRuas, diasAteFim])

  // ── contadores do cabeçalho
  const nComProducao = ruasComProducao.size

  // ── tooltip helpers
  const mostrarTip = (px: number, py: number, titulo: string, linhasTip: string[]) =>
    setTip({ x: px, y: py, titulo, linhas: linhasTip })

  const alternarEtapa = (key: string) =>
    setEtapasOcultas((prev) => {
      const s = new Set(prev)
      if (s.has(key)) s.delete(key)
      else s.add(key)
      return s
    })

  // ── render ──
  return (
    <div className="p-4 flex flex-col gap-3" style={{ background: C.bg }}>
      {/* cabeçalho */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.text }}>
            Linha de Balanço — esteira por rua
          </div>
          <Fonte>
            vw_producao_longa · producao_diaria ({diasComProducao} dias
            {janela ? `, ${ddmm(janela.de)}→${ddmm(janela.ate)}` : ''}) · logradouros ({universoRuas} ruas) · metas_producao
          </Fonte>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {conflitos.length > 0 && (
            <span className="flex items-center gap-1.5 border border-[#ef4444]/50 bg-[#ef4444]/10 px-2 py-1">
              <StatusSquare color={C.red} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider text-[#ef4444] ${MONO}`}>
                {conflitos.length} conflito{conflitos.length > 1 ? 's' : ''} de esteira
              </span>
            </span>
          )}
          <div className="flex border" style={{ borderColor: C.border }}>
            <button
              onClick={() => setMostrarTodas(false)}
              className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${MONO}`}
              style={{
                background: !mostrarTodas ? '#1e293b' : 'transparent',
                color: !mostrarTodas ? C.text : C.muted,
              }}
            >
              Com produção ({nComProducao})
            </button>
            <button
              onClick={() => setMostrarTodas(true)}
              className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider border-l ${MONO}`}
              style={{
                borderColor: C.border,
                background: mostrarTodas ? '#1e293b' : 'transparent',
                color: mostrarTodas ? C.text : C.muted,
              }}
            >
              Todas ({universoRuas})
            </button>
          </div>
        </div>
      </div>

      {/* legenda — clique esconde/mostra a etapa */}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
        {ETAPAS.map((e) => {
          const oculta = etapasOcultas.has(e.key)
          return (
            <button
              key={e.key}
              onClick={() => alternarEtapa(e.key)}
              title={oculta ? 'Mostrar etapa' : 'Ocultar etapa'}
              className="flex items-center gap-1.5"
              style={{ opacity: oculta ? 0.35 : 1 }}
            >
              <StatusSquare color={e.cor} />
              <span className={`text-[9px] font-semibold uppercase tracking-wider ${MONO}`} style={{ color: C.muted, textDecoration: oculta ? 'line-through' : 'none' }}>
                {e.label}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-[#ef4444]/40 bg-[#ef4444]/5 px-2.5 py-2">
          <StatusSquare color={C.red} />
          <span className="text-[10px] leading-snug text-[#ef4444]">{error}</span>
        </div>
      )}

      {loading ? (
        <div className={`text-[10px] uppercase tracking-[0.14em] ${MONO}`} style={{ color: C.muted }}>
          Carregando linha de balanço…
        </div>
      ) : !dominio || linhas.length === 0 ? (
        !error && (
          <AvisoSemDado>
            0 registros com produção em vw_producao_longa (producao_diaria) — a linha de balanço
            aparece quando houver apontamento com quantidade &gt; 0. Nada é desenhado sem dado real.
          </AvisoSemDado>
        )
      ) : (
        <div className="border" style={{ borderColor: C.border, background: C.panel }}>
          <div className="overflow-x-auto">
            <div className="relative inline-block align-top">
              <svg width={W} height={H} className="block" role="img" aria-label="Linha de balanço: ruas × tempo, uma linha por etapa da esteira">
                {/* fundo das linhas + rótulos das ruas */}
                {linhas.map((l, i) => {
                  const y = PAD_T + i * ROW_H
                  if (l.tipo === 'grupo') {
                    return (
                      <g key={l.chave}>
                        <rect x={0} y={y} width={W} height={ROW_H} fill="#111a2b" />
                        <text x={6} y={y + ROW_H / 2 + 3} fontSize={9} fontWeight={600} fill={C.muted} style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          {l.label}
                        </text>
                      </g>
                    )
                  }
                  const nome = l.tipo === 'rua'
                    ? l.rua.nome
                    : `SEM CADASTRO (${l.nPontos} apontamento${l.nPontos > 1 ? 's' : ''} sem rua_id)`
                  return (
                    <g key={l.chave}>
                      {i % 2 === 1 && <rect x={0} y={y} width={W} height={ROW_H} fill="#0f1728" />}
                      <line x1={LABEL_W} y1={y + ROW_H} x2={W} y2={y + ROW_H} stroke={C.border} strokeWidth={0.5} opacity={0.5} />
                      <text x={10} y={y + ROW_H / 2 + 3} fontSize={9} fill={l.tipo === 'sem' ? C.amber : C.text} fontFamily="ui-monospace, monospace">
                        {truncar(nome, 34)}
                        <title>{nome}</title>
                      </text>
                    </g>
                  )
                })}

                {/* grade semanal (segundas) + eixo de datas */}
                {Array.from({ length: dominio.nDias }, (_, i) => addDias(dominio.de, i))
                  .filter((d) => ehSegunda(d))
                  .map((d) => (
                    <g key={d}>
                      <line x1={x(d) - DAY_W / 2} y1={PAD_T} x2={x(d) - DAY_W / 2} y2={H - PAD_B} stroke={C.border} strokeWidth={0.75} />
                      <text x={x(d) - DAY_W / 2 + 3} y={12} fontSize={9} fill={C.muted} fontFamily="ui-monospace, monospace">
                        {ddmm(d)}
                      </text>
                    </g>
                  ))}

                {/* separador da coluna de rótulos */}
                <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={H} stroke={C.border} strokeWidth={1} />

                {/* marcador HOJE */}
                {hoje >= dominio.de && hoje <= dominio.ate && (
                  <g>
                    <line x1={x(hoje)} y1={PAD_T - 6} x2={x(hoje)} y2={H - PAD_B} stroke={C.cyan} strokeWidth={1} strokeDasharray="4 3" />
                    <text x={x(hoje) + 4} y={PAD_T - 8} fontSize={9} fontWeight={700} fill={C.cyan} fontFamily="ui-monospace, monospace">
                      HOJE {ddmm(hoje)}
                    </text>
                  </g>
                )}

                {/* polilinhas por etapa (linha fina + pontos por rua×dia) */}
                {series
                  .filter((s) => !etapasOcultas.has(s.meta.key))
                  .map((s) => (
                    <g key={s.meta.key}>
                      {s.pts.length > 1 && (
                        <polyline
                          points={s.pts.map((p) => `${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ')}
                          fill="none"
                          stroke={s.meta.cor}
                          strokeWidth={1.25}
                          opacity={0.45}
                        />
                      )}
                      {s.pts.map((p, i) => (
                        <circle
                          key={`${p.ponto.ruaId ?? 'sem'}-${p.ponto.data}-${i}`}
                          cx={p.px}
                          cy={p.py}
                          r={2.5 + Math.min(2, Math.sqrt(p.ponto.qtd) / 3)}
                          fill={s.meta.cor}
                          stroke={C.bg}
                          strokeWidth={0.75}
                          onPointerEnter={() =>
                            mostrarTip(p.px, p.py, `${s.meta.label} · ${ddmm(p.ponto.data)}`, [
                              `${fmtQtd(p.ponto.qtd, s.meta.unidade)} apontado${p.ponto.ruaId === null ? ' (sem rua_id)' : ''}`,
                              ...(p.ponto.equipes.length > 0 ? [`Equipe: ${p.ponto.equipes.join(', ')}`] : []),
                            ])
                          }
                          onPointerLeave={() => setTip(null)}
                        />
                      ))}
                    </g>
                  ))}

                {/* conflitos de esteira — quadrado vermelho na rua/data da etapa adiantada */}
                {conflitos.map((c) => {
                  const py = yCentro(c.ruaChave)
                  if (py === null) return null // rua filtrada do eixo (modo "com produção" sempre a inclui)
                  const px = x(c.data)
                  return (
                    <rect
                      key={`${c.ruaChave}|${c.data}`}
                      x={px - 5}
                      y={py - 5}
                      width={10}
                      height={10}
                      fill="none"
                      stroke={C.red}
                      strokeWidth={1.5}
                      onPointerEnter={() => mostrarTip(px, py, `CONFLITO DE ESTEIRA · ${c.ruaNome}`, c.linhas)}
                      onPointerLeave={() => setTip(null)}
                    />
                  )
                })}
              </svg>

              {/* tooltip (posição em px do SVG — o wrapper rola junto) */}
              {tip && (
                <div
                  className="absolute z-20 pointer-events-none border px-2.5 py-1.5"
                  style={{
                    left: tip.x > W - 240 ? tip.x - 230 : tip.x + 10,
                    top: Math.max(0, tip.y - 8),
                    background: C.panel,
                    borderColor: C.border,
                    minWidth: 150,
                  }}
                >
                  <div className={`text-[9px] font-semibold uppercase tracking-wider ${MONO}`} style={{ color: C.text }}>
                    {tip.titulo}
                  </div>
                  {tip.linhas.map((l, i) => (
                    <div key={i} className={`text-[9px] ${MONO}`} style={{ color: C.muted }}>
                      {l}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* painel inferior — takt real × necessário por etapa */}
      <div className="border flex flex-col gap-2 px-3 py-2.5" style={{ borderColor: C.border, background: C.panel }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.muted }}>
            Takt por etapa — real × necessário
          </div>
          <Fonte>
            vw_producao_longa (série real) · metas_producao
            {campanha && diasAteFim !== null
              ? ` (${campanha.nome || 'campanha'} até ${ddmm(campanha.periodoFim)} · ${diasAteFim} dia${diasAteFim === 1 ? '' : 's'} restante${diasAteFim === 1 ? '' : 's'})`
              : ' (0 registros — takt necessário indisponível)'}
          </Fonte>
        </div>

        {taktLinhas.length === 0 ? (
          <AvisoSemDado>
            0 registros com produção em vw_producao_longa — sem série real não há takt calculável (nada é estimado).
          </AvisoSemDado>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Etapa', 'Ruas atendidas', 'Dias ativos', 'Takt real (ruas/dia)', 'Ruas restantes', 'Takt necessário (ruas/dia)', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`text-[9px] font-semibold uppercase tracking-[0.12em] px-2 py-1.5 border-b whitespace-nowrap ${i > 0 ? 'text-right' : ''}`}
                      style={{ color: C.muted, borderColor: C.border }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {taktLinhas.map((t) => {
                  const status =
                    t.taktReal === null || t.taktNec === null
                      ? C.faint
                      : t.taktReal >= t.taktNec
                        ? C.green
                        : C.red
                  return (
                    <tr key={t.meta.key}>
                      <td className="px-2 py-1 border-b whitespace-nowrap" style={{ borderColor: C.border }}>
                        <span className="flex items-center gap-1.5">
                          <StatusSquare color={t.meta.cor} />
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${MONO}`} style={{ color: C.text }}>
                            {t.meta.label}
                          </span>
                        </span>
                      </td>
                      <td className={`px-2 py-1 border-b text-right text-[10px] ${MONO}`} style={{ color: C.text, borderColor: C.border }}>
                        {t.ruasAtendidas}
                      </td>
                      <td className={`px-2 py-1 border-b text-right text-[10px] ${MONO}`} style={{ color: C.text, borderColor: C.border }}>
                        {t.diasAtivos}
                      </td>
                      <td className={`px-2 py-1 border-b text-right text-[10px] ${MONO}`} style={{ color: C.text, borderColor: C.border }}>
                        {t.taktReal === null ? '—' : t.taktReal.toFixed(1)}
                      </td>
                      <td className={`px-2 py-1 border-b text-right text-[10px] ${MONO}`} style={{ color: C.muted, borderColor: C.border }}>
                        {t.ruasRestantes}
                      </td>
                      <td className={`px-2 py-1 border-b text-right text-[10px] ${MONO}`} style={{ color: C.text, borderColor: C.border }}>
                        {t.taktNec === null ? '—' : t.taktNec.toFixed(1)}
                      </td>
                      <td className="px-2 py-1 border-b text-right" style={{ borderColor: C.border }}>
                        <StatusSquare color={status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-[9px] leading-snug" style={{ color: C.faint }}>
          Takt real = pontos rua×dia da etapa ÷ dias ativos (média de ruas atendidas por dia com produção).
          Takt necessário = ruas ainda sem a etapa (universo: {universoRuas} logradouros cadastrados) ÷ dias até o fim
          da campanha{campanha ? ` (${ddmm(campanha.periodoFim)})` : ''}. O universo não discrimina quais ruas
          exigem cada etapa — limite do dado atual, declarado em vez de escondido.
          {diasAteFim !== null && diasAteFim === 0 && ' Prazo da campanha vencido → takt necessário indefinido ("—").'}
        </div>
      </div>
    </div>
  )
}
