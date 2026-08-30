/**
 * Metas — Campanha de Meta genérica (ex.: "1500 Ligações de Água — Julho/2026").
 * A campanha (nome, alvo, janela, ritmo, etapas encadeadas) vive em
 * `metas_campanha` e é criada/editada/encerrada NESTA tela — a próxima meta
 * nasce sem código.
 *
 * Funil da cadeia de dependência (etapas da campanha, ex. caixa UMA → HM →
 * ligação): etapas intermediárias vêm do APONTAMENTO de campo
 * (producao_diaria); a etapa FINAL mostra a BAIXA OFICIAL no app ZN
 * (meta_baixas) como número principal E o apontado como subtítulo — as duas
 * séries visíveis (decisão do dono), divergência nunca escondida.
 *
 * Dados 100% reais. Sem dado → aviso honesto (bloco amber). NUNCA número inventado.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Droplets, Gauge, Package, Target, AlertTriangle, RefreshCw,
  CalendarClock, TrendingUp, ArrowRight, Layers, BarChart3, CalendarRange,
  Settings, Plus, StopCircle, X, Timer, Trophy, CalendarDays,
} from 'lucide-react'
import { useProjectContext, selectActiveProjeto } from '@/store/projectContext'
import { useMetaLigacoes, type RegistroProducaoMeta } from '@/hooks/useMetaLigacoes'
import { useMetaCorredor } from '@/hooks/useMetaCorredor'
import { useMetaBaixas, type BaixaZn } from '@/hooks/useMetaBaixas'
import { useMetaRuas, normalizarRua } from '@/hooks/useMetaRuas'
import {
  useMetaCampanha, type CampanhaMeta, type NovaCampanhaInput,
} from '@/hooks/useMetaCampanha'
import { CurvaSCorredor } from './CurvaSCorredor'
import { MatrizRuas } from './MatrizRuas'
import { BaixasZn } from './BaixasZn'

/**
 * Dias úteis (seg-sáb, domingo fora) de hoje até o prazo, inclusive nas duas
 * pontas. Retorna 0 se o prazo já passou.
 */
function diasUteisAteOPrazo(prazoIso: string): number {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const fim = new Date(`${prazoIso}T00:00:00`)
  if (Number.isNaN(fim.getTime()) || fim < hoje) return 0
  let count = 0
  const d = new Date(hoje)
  while (d <= fim) {
    if (d.getDay() !== 0) count++ // 0 = domingo; sábado conta (a obra trabalha)
    d.setDate(d.getDate() + 1)
  }
  return count
}

function labelDia(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}` : iso
}

function fmtDdMmAaaa(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function fmtInt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

function SectionTitle({ children, icon: Icon }: { children: string; icon: any }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} className="text-cyan-400" />
      <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">{children}</h3>
    </div>
  )
}

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: any; color: string
}) {
  return (
    <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4 hover:border-[#2abfdc]/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-[#5a8caa] uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color.replace('text-', 'bg-').replace('400', '500/15')}`}>
          <Icon size={16} className={color} />
        </div>
      </div>
      <span className="text-2xl font-bold text-[#e4f2f8]">{value}</span>
      {sub && <span className="text-[10px] text-[#5a8caa] mt-1 block">{sub}</span>}
    </div>
  )
}

interface EtapaUi {
  ordem: number
  titulo: string
  descricao: string
  feito: number
  /** Só na etapa final: apontado de campo, exibido como subtítulo junto da baixa ZN. */
  subApontado?: number
  icon: any
  // Classes literais (Tailwind JIT não gera classe montada dinamicamente)
  corTexto: string // ex: 'text-cyan-400'
  corIconeBg: string // ex: 'bg-cyan-500/15'
  corBarra: string // ex: 'bg-cyan-500'
}

// Paletas/ícones por posição da etapa (classes literais pro Tailwind JIT).
const PALETAS = [
  { corTexto: 'text-cyan-400', corIconeBg: 'bg-cyan-500/15', corBarra: 'bg-cyan-500' },
  { corTexto: 'text-purple-400', corIconeBg: 'bg-purple-500/15', corBarra: 'bg-purple-500' },
  { corTexto: 'text-emerald-400', corIconeBg: 'bg-emerald-500/15', corBarra: 'bg-emerald-500' },
  { corTexto: 'text-amber-400', corIconeBg: 'bg-amber-500/15', corBarra: 'bg-amber-500' },
] as const
const ICONES = [Package, Gauge, Droplets] as const

function EtapaCard({ etapa, alvo }: { etapa: EtapaUi; alvo: number }) {
  const pct = alvo > 0 ? (etapa.feito / alvo) * 100 : 0
  const restante = Math.max(0, alvo - etapa.feito)
  const corTexto = etapa.corTexto
  const Icon = etapa.icon
  return (
    <div className="flex-1 bg-[#112645] border border-[#20406a] rounded-xl p-4 hover:border-[#2abfdc]/30 transition-colors min-w-[220px]">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${etapa.corIconeBg}`}>
          <Icon size={18} className={corTexto} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-[#5a8caa] uppercase tracking-wider">Etapa {etapa.ordem}</div>
          <div className="text-sm font-bold text-[#e4f2f8] truncate">{etapa.titulo}</div>
        </div>
      </div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <span className={`text-3xl font-bold ${corTexto}`}>{fmtInt(etapa.feito)}</span>
          <span className="text-xs text-[#5a8caa] ml-1.5">/ {fmtInt(alvo)}</span>
        </div>
        <span className={`text-sm font-bold ${corTexto}`}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-[#0d2040] rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${etapa.corBarra}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[#5a8caa]">{etapa.descricao}</span>
        <span className="font-bold text-amber-400">{fmtInt(restante)} a baixar</span>
      </div>
      {etapa.subApontado !== undefined && (
        <div className="mt-1.5 text-[10px] text-[#8fb3c8] border-t border-[#20406a]/60 pt-1.5">
          produção apontada na janela: <b className="font-mono">{fmtInt(etapa.subApontado)}</b>
        </div>
      )}
    </div>
  )
}

function AvisoAmber({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
      <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
      <span className="text-xs text-amber-200/90 leading-relaxed">
        <b className="text-amber-300">{titulo}</b> {children}
      </span>
    </div>
  )
}

const inputCls = 'rounded-lg px-3 py-1.5 text-xs bg-[#0d2040] border border-[#20406a] text-[#e4f2f8] outline-none focus:border-cyan-400/60'

/** Form de criação de campanha nova — é assim que a próxima meta nasce sem código. */
function NovaCampanhaForm({ onCriar }: { onCriar: (input: NovaCampanhaInput) => void }) {
  const [nome, setNome] = useState('')
  const [alvo, setAlvo] = useState('')
  const [unidade, setUnidade] = useState('ligações')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [ritmo, setRitmo] = useState('')

  const alvoNum = Number(alvo.replace(/[^\d]/g, '')) || 0
  const ritmoNum = Number(ritmo.replace(/[^\d]/g, '')) || 0
  const valido = nome.trim() !== '' && alvoNum > 0 && !!inicio && !!fim && inicio <= fim && ritmoNum > 0

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da campanha (ex.: 2000 Ligações — Agosto)" className={`${inputCls} lg:col-span-2`} />
        <input type="text" value={unidade} onChange={(e) => setUnidade(e.target.value)}
          placeholder="Unidade (ex.: ligações)" className={inputCls} />
        <input type="text" inputMode="numeric" value={alvo} onChange={(e) => setAlvo(e.target.value)}
          placeholder="Alvo total (ex.: 1500)" className={inputCls} />
        <input type="text" inputMode="numeric" value={ritmo} onChange={(e) => setRitmo(e.target.value)}
          placeholder="Ritmo alvo por dia (ex.: 75)" className={inputCls} />
        <div className="flex items-center gap-2">
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={`${inputCls} flex-1`} title="Início da janela" />
          <span className="text-[#5a8caa] text-xs">→</span>
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={`${inputCls} flex-1`} title="Prazo final" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] text-[#5a8caa]">
          Etapas: cadeia padrão Caixa U.M.A → Cavalete/HM → Ligação (colunas reais do apontamento).
        </span>
        <button
          onClick={() => valido && onCriar({
            nome: nome.trim(), alvo: alvoNum, unidade: unidade.trim() || 'unid.',
            data_inicio: inicio, data_fim: fim, ritmo_dia: ritmoNum,
          })}
          disabled={!valido}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-300 rounded-lg text-xs font-semibold hover:bg-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          <Plus size={12} /> Criar campanha
        </button>
      </div>
    </div>
  )
}

/** Painel inline ⚙ Campanha: editar, encerrar e criar nova. */
function CampanhaPanel({ campanha, onSalvar, onEncerrar, onCriar, onFechar }: {
  campanha: CampanhaMeta
  onSalvar: (patch: Partial<Omit<CampanhaMeta, 'id' | 'projeto_id'>>) => void
  onEncerrar: () => void
  onCriar: (input: NovaCampanhaInput) => void
  onFechar: () => void
}) {
  const [nome, setNome] = useState(campanha.nome)
  const [alvo, setAlvo] = useState(String(campanha.alvo))
  const [inicio, setInicio] = useState(campanha.data_inicio)
  const [fim, setFim] = useState(campanha.data_fim)
  const [ritmo, setRitmo] = useState(String(campanha.ritmo_dia))
  const [criando, setCriando] = useState(false)

  const alvoNum = Number(alvo.replace(/[^\d]/g, '')) || 0
  const ritmoNum = Number(ritmo.replace(/[^\d]/g, '')) || 0
  const mudou = nome.trim() !== campanha.nome || alvoNum !== campanha.alvo
    || inicio !== campanha.data_inicio || fim !== campanha.data_fim || ritmoNum !== campanha.ritmo_dia
  const valido = nome.trim() !== '' && alvoNum > 0 && !!inicio && !!fim && inicio <= fim && ritmoNum > 0

  return (
    <div className="bg-[#112645] border border-cyan-500/30 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Campanha</h3>
        </div>
        <button onClick={onFechar} className="text-[#5a8caa] hover:text-[#e4f2f8]" title="Fechar painel">
          <X size={16} />
        </button>
      </div>

      {/* editar campanha ativa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className={`${inputCls} lg:col-span-2`} />
        <input type="text" inputMode="numeric" value={alvo} onChange={(e) => setAlvo(e.target.value)} placeholder="Alvo" className={inputCls} />
        <input type="text" inputMode="numeric" value={ritmo} onChange={(e) => setRitmo(e.target.value)} placeholder="Ritmo/dia" className={inputCls} />
        <div className="flex items-center gap-2 lg:col-span-2">
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={`${inputCls} flex-1`} title="Início da janela" />
          <span className="text-[#5a8caa] text-xs">→</span>
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={`${inputCls} flex-1`} title="Prazo final" />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => valido && onSalvar({ nome: nome.trim(), alvo: alvoNum, data_inicio: inicio, data_fim: fim, ritmo_dia: ritmoNum })}
          disabled={!mudou || !valido}
          className="px-3 py-1.5 bg-cyan-500/10 text-cyan-300 rounded-lg text-xs font-semibold hover:bg-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          Salvar alterações
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Encerrar a campanha "${campanha.nome}"? Ela vai pro histórico e a tela fica sem campanha ativa até criar a próxima.`)) {
              onEncerrar()
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 text-rose-300 rounded-lg text-xs font-semibold hover:bg-rose-500/20 transition-colors"
        >
          <StopCircle size={12} /> Encerrar campanha
        </button>
        <button
          onClick={() => setCriando((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d2040] text-[#8fb3c8] border border-[#20406a] rounded-lg text-xs font-semibold hover:bg-[#14294e] transition-colors"
        >
          <Plus size={12} /> {criando ? 'Fechar form de nova campanha' : 'Criar nova campanha'}
        </button>
      </div>

      {criando && (
        <div className="border-t border-[#20406a] pt-3">
          <p className="text-[10px] text-[#5a8caa] mb-2">
            A nova campanha nasce ATIVA — se a atual ainda estiver ativa, a mais recente (por data de início) assume a tela. Encerrar a atual antes deixa o histórico limpo.
          </p>
          <NovaCampanhaForm onCriar={(input) => { onCriar(input); setCriando(false) }} />
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
 * FRENTE B — "Sala de comando": countdown da meta da semana, leaderboard por
 * equipe e heatmap rua × dia. Linguagem visual industrial/utilitária (densa em
 * dados, zero decoração): fundo mais profundo que o resto da tela (#0a0f1a /
 * #0d1420), bordas finas 1px #1e293b, números MONOESPAÇADOS com dígitos
 * tabulares, labels em caixa alta 9-10px com letter-spacing, status como
 * quadradinhos/pills — verde #22c55e ok · âmbar #f59e0b atenção · vermelho
 * #ef4444 crítico. Dado 100% real (meta_baixas / producao_diaria / meta_ruas);
 * sem dado → vazio ou aviso âmbar honesto, nunca número inventado.
 * ═════════════════════════════════════════════════════════════════════════ */

/** Números monoespaçados com dígitos tabulares (colunas alinham perfeito). */
const MONO = 'font-mono [font-variant-numeric:tabular-nums]'

const p2 = (n: number) => String(n).padStart(2, '0')

/** Painel padrão da sala de comando: header fino em caixa alta + conteúdo. */
function PainelOps({ icon: Icon, label, right, children }: {
  icon: any; label: string; right?: ReactNode; children: ReactNode
}) {
  return (
    <div className="bg-[#0a0f1a] border border-[#1e293b] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-[#1e293b] bg-[#0d1420]">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={13} className="text-slate-400 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 truncate">{label}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

/** Célula de KPI da sala de comando — número mono grande, label caixa alta. */
function StatOps({ rotulo, valor, sub, cor }: {
  rotulo: string; valor: string; sub?: string; cor?: string
}) {
  return (
    <div className="bg-[#0d1420] px-3 py-2.5 min-w-0">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1 truncate">{rotulo}</div>
      <div className={`text-2xl font-bold leading-none ${MONO}`} style={{ color: cor ?? '#e2e8f0' }}>{valor}</div>
      {sub && <div className={`text-[9px] text-slate-500 mt-1.5 ${MONO}`}>{sub}</div>}
    </div>
  )
}

// ── META DA SEMANA — definida na reorganização geral de 22/07 (decisão do
// dono): 535 baixas no app ZN até DOMINGO 26/07. A base é o acumulado oficial
// da véspera (21/07) — só o DELTA a partir dali conta. O progresso vem da
// série real `meta_baixas`; sem baixa nova registrada, o número não anda
// (honesto). Semana nova → atualizar as 3 constantes abaixo.
const SEMANA_ALVO = 535
const SEMANA_BASE_ISO = '2026-07-21'
const SEMANA_FIM_ISO = '2026-07-26'
const SEMANA_FIM_MS = new Date(`${SEMANA_FIM_ISO}T23:59:59`).getTime()

/** COUNTDOWN DA SEMANA — 535 baixas até domingo 26/07, relógio e ritmo ao vivo. */
function CountdownSemana({ baixas, ritmoAlvo }: { baixas: BaixaZn[]; ritmoAlvo: number }) {
  // Relógio ao vivo (1 s): countdown e ritmo necessário recalculados em tempo real.
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Delta REAL da série oficial (meta_baixas): última baixa ≤ 21/07 é a base.
  const anteriores = baixas.filter((b) => b.data <= SEMANA_BASE_ISO)
  const base = anteriores.length ? anteriores[anteriores.length - 1] : null
  const ultima = baixas.length ? baixas[baixas.length - 1] : null
  const feito = base && ultima ? Math.max(0, ultima.acumulado - base.acumulado) : null
  const restante = feito === null ? null : Math.max(0, SEMANA_ALVO - feito)
  const pct = feito === null ? 0 : Math.min(100, (feito / SEMANA_ALVO) * 100)

  const msRest = Math.max(0, SEMANA_FIM_MS - agora)
  const encerrada = msRest === 0
  const dd = Math.floor(msRest / 86_400_000)
  const hh = Math.floor(msRest / 3_600_000) % 24
  const mm = Math.floor(msRest / 60_000) % 60
  const ss = Math.floor(msRest / 1_000) % 60

  // Dias corridos restantes (hoje incluso) até domingo — divisor do ritmo/dia.
  const hoje = new Date(agora)
  hoje.setHours(0, 0, 0, 0)
  const diasRest = Math.max(
    0,
    Math.round((new Date(`${SEMANA_FIM_ISO}T00:00:00`).getTime() - hoje.getTime()) / 86_400_000) + 1,
  )
  const ritmoNec = restante !== null && restante > 0 && diasRest > 0 ? restante / diasRest : null
  const batida = restante !== null && restante === 0

  // Status contra o ritmo alvo da campanha (75/dia) — critério explícito, não chute.
  let statusRotulo = 'SEM SÉRIE DE BAIXAS'
  let statusCor = '#f59e0b'
  if (feito !== null) {
    if (batida) { statusRotulo = 'META BATIDA'; statusCor = '#22c55e' }
    else if (encerrada) { statusRotulo = 'SEMANA ENCERRADA — META NÃO BATIDA'; statusCor = '#ef4444' }
    else if (ritmoNec !== null && ritmoAlvo > 0) {
      if (ritmoNec <= ritmoAlvo) { statusRotulo = 'DENTRO DO RITMO ALVO'; statusCor = '#22c55e' }
      else if (ritmoNec <= ritmoAlvo * 2) { statusRotulo = 'ACIMA DO RITMO ALVO'; statusCor = '#f59e0b' }
      else { statusRotulo = 'CRÍTICO — RITMO MUITO ACIMA DO ALVO'; statusCor = '#ef4444' }
    }
  }

  return (
    <PainelOps
      icon={Timer}
      label="Meta da Semana — Baixas ZN (22–26/07)"
      right={
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: statusCor }} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] hidden sm:inline" style={{ color: statusCor }}>
            {statusRotulo}
          </span>
          <span className={`text-[9px] text-slate-600 ${MONO}`}>{new Date(agora).toLocaleTimeString('pt-BR')}</span>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className={`text-4xl font-bold text-slate-100 leading-none ${MONO}`}>{SEMANA_ALVO}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            baixas até domingo {fmtDdMmAaaa(SEMANA_FIM_ISO).slice(0, 5)}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#1e293b] border border-[#1e293b] rounded-md overflow-hidden">
          <StatOps
            rotulo="Baixadas na semana"
            valor={feito !== null ? fmtInt(feito) : '—'}
            sub={base && ultima
              ? `base ${fmtInt(base.acumulado)} (${labelDia(base.data)}) → ${fmtInt(ultima.acumulado)} (${labelDia(ultima.data)})`
              : 'sem baixa registrada até 21/07'}
            cor={statusCor}
          />
          <StatOps
            rotulo="Restante"
            valor={restante !== null ? fmtInt(restante) : '—'}
            sub={`de ${fmtInt(SEMANA_ALVO)} baixas`}
          />
          <StatOps
            rotulo="Tempo restante"
            valor={encerrada ? '00:00:00' : `${dd}d ${p2(hh)}:${p2(mm)}:${p2(ss)}`}
            sub={`até dom ${fmtDdMmAaaa(SEMANA_FIM_ISO).slice(0, 5)} 23:59`}
          />
          <StatOps
            rotulo="Ritmo necessário"
            valor={batida ? '0/dia' : ritmoNec !== null ? `${ritmoNec.toFixed(1)}/dia` : '—'}
            sub={encerrada
              ? 'semana encerrada'
              : `${diasRest} dia${diasRest === 1 ? '' : 's'} restando · alvo campanha ${ritmoAlvo}/dia`}
            cor={statusCor}
          />
        </div>

        <div>
          <div className="relative h-2 bg-[#0d1420] border border-[#1e293b] rounded-sm overflow-hidden">
            <div
              className="h-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: statusCor }}
            />
            {[25, 50, 75].map((m) => (
              <div key={m} className="absolute top-0 bottom-0 w-px bg-[#1e293b]" style={{ left: `${m}%` }} />
            ))}
          </div>
          <div className={`flex items-center justify-between gap-3 mt-1 text-[9px] text-slate-500 ${MONO}`}>
            <span>{feito !== null ? fmtInt(feito) : '—'} / {fmtInt(SEMANA_ALVO)} ({pct.toFixed(1)}%)</span>
            <span className="text-right">fonte: meta_baixas (app ZN, oficial) — sem baixa nova registrada, o número não anda</span>
          </div>
        </div>

        {feito === null && (
          <div className="text-[10px] text-amber-400/90 leading-relaxed">
            Sem baixa oficial registrada até {fmtDdMmAaaa(SEMANA_BASE_ISO)} — o delta da semana não tem
            base real pra ser calculado. Registre as baixas ZN na seção "Baixas ZN" abaixo.
          </div>
        )}
      </div>
    </PainelOps>
  )
}

/** Normaliza o nome LIVRE da equipe do apontamento p/ agrupar grafias
 *  ("Danilo e Felipe" ≡ "Danilo, Felipe"; "Equipe Ediel" ≡ "Ediel"). */
function canonEquipe(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^equipe\s+/, '')
    .replace(/\s*[,+]\s*/g, ' e ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Vínculo nome apontado → encarregado da reorganização de 22/07 (wcr_equipes):
// Damião → Damião I/II · Jailton → Jailton I/II · Mazinho lidera Gilvan I ·
// Cristian + Renan tocam HM — Jesse/Kely. SÓ vínculos confirmados entram aqui;
// nome sem vínculo (Cristiano, Wellington, Ediel…) fica SEM badge — honesto,
// não chutado.
const BADGE_ENCARREGADO: Record<string, { rotulo: string; cls: string }> = {
  damiao: { rotulo: 'DAMIÃO', cls: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10' },
  jailton: { rotulo: 'JAILTON', cls: 'text-purple-300 border-purple-500/40 bg-purple-500/10' },
  gilvan: { rotulo: 'GILVAN', cls: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' },
  mazinho: { rotulo: 'GILVAN', cls: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' },
  cristian: { rotulo: 'HM', cls: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
  renan: { rotulo: 'HM', cls: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
  'cristian e renan': { rotulo: 'HM', cls: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
}

const COLS_LEADERBOARD = [
  { key: 'cUma', rotulo: 'C.UMA', cor: '#06b6d4' },
  { key: 'hm', rotulo: 'HM', cor: '#a855f7' },
  { key: 'la', rotulo: 'LA', cor: '#10b981' },
  { key: 'pv', rotulo: 'PV', cor: '#f59e0b' },
  { key: 'pi', rotulo: 'PI', cor: '#f43f5e' },
  { key: 'intercept', rotulo: 'INTL', cor: '#38bdf8' },
] as const

const GRID_LEADERBOARD =
  'grid grid-cols-[2.25rem_minmax(9rem,1.2fr)_4.5rem_minmax(8rem,2fr)_repeat(7,3.25rem)] items-center gap-x-2'

interface LinhaLeaderboard {
  nome: string
  badge: { rotulo: string; cls: string } | null
  somas: Record<(typeof COLS_LEADERBOARD)[number]['key'], number>
  total: number
  diasComApontamento: number
}

/** LEADERBOARD POR EQUIPE — producao_diaria agregada por equipe_nome na janela. */
function LeaderboardEquipes({ registros }: { registros: RegistroProducaoMeta[] }) {
  const linhas = useMemo<LinhaLeaderboard[]>(() => {
    const porEquipe = new Map<string, {
      nome: string
      somas: Record<(typeof COLS_LEADERBOARD)[number]['key'], number>
      dias: Set<string>
    }>()
    for (const reg of registros) {
      const bruto = (reg.equipe ?? '').trim()
      if (!bruto) continue // linha sem equipe apontada não entra no ranking (honesto)
      const canon = canonEquipe(bruto)
      if (!canon) continue
      const acc = porEquipe.get(canon) ?? {
        nome: bruto,
        somas: { cUma: 0, hm: 0, la: 0, pv: 0, pi: 0, intercept: 0 },
        dias: new Set<string>(),
      }
      for (const c of COLS_LEADERBOARD) acc.somas[c.key] += reg[c.key]
      acc.dias.add(reg.data)
      porEquipe.set(canon, acc)
    }
    return Array.from(porEquipe.entries())
      .map(([canon, v]) => ({
        nome: v.nome,
        badge: BADGE_ENCARREGADO[canon] ?? null,
        somas: v.somas,
        total: COLS_LEADERBOARD.reduce((s, c) => s + v.somas[c.key], 0),
        diasComApontamento: v.dias.size,
      }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
  }, [registros])

  const maxTotal = Math.max(1, ...linhas.map((l) => l.total))

  return (
    <PainelOps
      icon={Trophy}
      label="Leaderboard por Equipe — janela da campanha"
      right={
        <span className={`text-[9px] text-slate-500 shrink-0 ${MONO}`}>
          {linhas.length} equipes · fonte producao_diaria
        </span>
      }
    >
      {linhas.length === 0 ? (
        <div className="px-4 py-3 text-[10px] text-amber-400/90">
          Nenhum apontamento com nome de equipe na janela da campanha — o ranking só nasce do apontado real.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[780px]">
            <div className={`${GRID_LEADERBOARD} px-4 py-1.5 border-b border-[#1e293b] bg-[#0d1420]`}>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">#</span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">Equipe (apontamento)</span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">Enc. 22/07</span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">Produção acumulada</span>
              {COLS_LEADERBOARD.map((c) => (
                <span
                  key={c.key}
                  className="text-right text-[9px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: c.cor }}
                >
                  {c.rotulo}
                </span>
              ))}
              <span className="text-right text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">Total</span>
            </div>
            {linhas.map((l, i) => {
              let x = 0
              return (
                <div key={l.nome} className={`${GRID_LEADERBOARD} px-4 py-[5px] border-b border-[#1e293b]/50 hover:bg-[#0d1420] transition-colors`}>
                  <span className={`text-[10px] text-slate-500 ${MONO}`}>{p2(i + 1)}</span>
                  <span className="text-[11px] text-slate-200 truncate" title={`${l.nome} · ${l.diasComApontamento} dia(s) com apontamento`}>
                    {l.nome}
                  </span>
                  {l.badge ? (
                    <span className={`justify-self-start text-[8px] font-bold tracking-[0.08em] px-1.5 py-px rounded-[3px] border ${l.badge.cls}`}>
                      {l.badge.rotulo}
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-600">—</span>
                  )}
                  <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="w-full h-[9px]">
                    {COLS_LEADERBOARD.map((c) => {
                      const w = (l.somas[c.key] / maxTotal) * 100
                      const rect = w > 0
                        ? <rect key={c.key} x={x} y={0} width={w} height={6} fill={c.cor}>
                            <title>{`${c.rotulo}: ${fmtInt(l.somas[c.key])}`}</title>
                          </rect>
                        : null
                      x += w
                      return rect
                    })}
                  </svg>
                  {COLS_LEADERBOARD.map((c) => (
                    <span
                      key={c.key}
                      className={`text-right text-[10px] ${MONO} ${l.somas[c.key] > 0 ? 'text-slate-300' : 'text-slate-700'}`}
                    >
                      {l.somas[c.key] > 0 ? fmtInt(l.somas[c.key]) : '·'}
                    </span>
                  ))}
                  <span className={`text-right text-[11px] font-bold text-slate-100 ${MONO}`}>{fmtInt(l.total)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <div className="px-4 py-2 text-[9px] text-slate-500 leading-relaxed border-t border-[#1e293b]/50">
        Soma de C.UMA / HM / LA / PV / PI / INTERLIGAÇÃO (producao_diaria) na janela da campanha, agrupada pelo
        nome LIVRE apontado no campo — grafias próximas são unificadas. Metros de rede (PRA/PRE) NÃO entram na
        soma: equipe de rede aparece baixa aqui sem estar parada. Badge do encarregado só onde o vínculo da
        reorganização de 22/07 é confirmado (Damião · Jailton · Mazinho→Gilvan I · Cristian/Renan→HM Jesse/Kely);
        sem vínculo confirmado = sem badge.
      </div>
    </PainelOps>
  )
}

const HEATMAP_DIAS = 14

/** HEATMAP RUA × DIA — ruas da matriz (meta_ruas) × últimos 14 dias corridos. */
function HeatmapRuaDia({ campanha, registros }: {
  campanha: CampanhaMeta; registros: RegistroProducaoMeta[]
}) {
  const { ruas, loading, error } = useMetaRuas(campanha)

  // Últimos 14 dias corridos terminando HOJE (colunas fixas — buraco fica visível).
  const diasCal = useMemo(() => {
    const out: string[] = []
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - (HEATMAP_DIAS - 1))
    for (let i = 0; i < HEATMAP_DIAS; i++) {
      out.push(d.toISOString().slice(0, 10))
      d.setDate(d.getDate() + 1)
    }
    return out
  }, [])

  // rua.id → (iso → unidades apontadas no dia). Match igual ao useMetaRuas
  // (case/acento-insensitive + inclusão parcial), com o extra de quebrar o
  // apontamento composto ("Rua A / Rua B") em segmentos — cada rua citada
  // recebe o lançamento inteiro (o apontamento não separa por rua; a
  // divergência fica visível, não escondida). Grafia que não casa → vazio.
  const valores = useMemo(() => {
    const out = new Map<string, Map<string, number>>()
    if (!ruas.length || !diasCal.length) return out
    const alvos = ruas.map((r) => ({ id: r.id, norm: normalizarRua(r.rua) }))
    const d0 = diasCal[0]
    const d1 = diasCal[diasCal.length - 1]
    for (const reg of registros) {
      if (!reg.rua || reg.data < d0 || reg.data > d1) continue
      const unidades = reg.cUma + reg.hm + reg.la + reg.le + reg.ci + reg.pv + reg.pi + reg.intercept
      if (unidades <= 0) continue // dia sem unidade apontada = célula vazia (honesto)
      const segs = reg.rua.split('/').map(normalizarRua).filter(Boolean)
      if (!segs.length) continue
      for (const alvo of alvos) {
        if (!alvo.norm) continue
        const bate = segs.some((s) => s === alvo.norm || s.includes(alvo.norm) || alvo.norm.includes(s))
        if (!bate) continue
        const linha = out.get(alvo.id) ?? new Map<string, number>()
        linha.set(reg.data, (linha.get(reg.data) ?? 0) + unidades)
        out.set(alvo.id, linha)
      }
    }
    return out
  }, [ruas, registros, diasCal])

  const LABEL_W = 176
  const CELL_W = 34
  const CELL_H = 17
  const GAP = 2
  const HEAD_H = 16
  const width = LABEL_W + diasCal.length * (CELL_W + GAP)
  const height = HEAD_H + ruas.length * (CELL_H + GAP)
  const hojeIso = diasCal[diasCal.length - 1]

  const opacidade = (v: number) => (v >= 30 ? 1 : v >= 15 ? 0.75 : v >= 5 ? 0.5 : 0.28)

  return (
    <PainelOps
      icon={CalendarDays}
      label={`Heatmap Rua × Dia — últimos ${HEATMAP_DIAS} dias`}
      right={
        <span className={`text-[9px] text-slate-500 shrink-0 ${MONO}`}>
          {ruas.length} ruas · unidades/dia
        </span>
      }
    >
      {error && (
        <div className="px-4 py-3 text-[10px] text-amber-400/90">Erro ao carregar as ruas da matriz: {error}</div>
      )}
      {!loading && !error && ruas.length === 0 && (
        <div className="px-4 py-3 text-[10px] text-amber-400/90">
          Nenhuma rua cadastrada na matriz da campanha — o heatmap nasce da lista real de ruas (meta_ruas).
        </div>
      )}
      {ruas.length > 0 && (
        <>
          <div className="overflow-x-auto px-4 py-3">
            <svg width={width} height={height} className="block" role="img"
              aria-label="Heatmap de produção por rua e dia">
              {diasCal.map((iso, di) => {
                const x = LABEL_W + di * (CELL_W + GAP)
                const dow = new Date(`${iso}T00:00:00`).getDay()
                return (
                  <text
                    key={iso}
                    x={x + CELL_W / 2}
                    y={10}
                    textAnchor="middle"
                    fontSize={8}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fill={iso === hojeIso ? '#e2e8f0' : dow === 0 ? '#475569' : '#64748b'}
                  >
                    {labelDia(iso)}
                  </text>
                )
              })}
              {ruas.map((r, ri) => {
                const y = HEAD_H + ri * (CELL_H + GAP)
                const porDia = valores.get(r.id)
                return (
                  <g key={r.id}>
                    <text x={0} y={y + CELL_H / 2 + 3} fontSize={9} fill="#94a3b8">
                      {r.rua.length > 30 ? `${r.rua.slice(0, 29)}…` : r.rua}
                    </text>
                    {diasCal.map((iso, di) => {
                      const x = LABEL_W + di * (CELL_W + GAP)
                      const v = porDia?.get(iso) ?? 0
                      return (
                        <g key={iso}>
                          <title>{`${r.rua} — ${labelDia(iso)}: ${v > 0 ? `${fmtInt(v)} unid. apontadas` : 'sem produção apontada'}`}</title>
                          {v > 0 ? (
                            <>
                              <rect x={x} y={y} width={CELL_W} height={CELL_H} rx={2} fill="#22c55e" fillOpacity={opacidade(v)} />
                              <text
                                x={x + CELL_W / 2}
                                y={y + CELL_H / 2 + 3}
                                textAnchor="middle"
                                fontSize={8}
                                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                                fill={opacidade(v) >= 0.75 ? '#052e16' : '#bbf7d0'}
                              >
                                {v}
                              </text>
                            </>
                          ) : (
                            <rect x={x} y={y} width={CELL_W} height={CELL_H} rx={2} fill="none" stroke="#1e293b" strokeWidth={1} />
                          )}
                        </g>
                      )
                    })}
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="px-4 pb-3 flex items-center gap-x-4 gap-y-1 flex-wrap text-[9px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] border border-[#1e293b]" /> 0 — vazio honesto
            </span>
            {[
              { faixa: '1–4', o: 0.28 },
              { faixa: '5–14', o: 0.5 },
              { faixa: '15–29', o: 0.75 },
              { faixa: '30+', o: 1 },
            ].map((b) => (
              <span key={b.faixa} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: '#22c55e', opacity: b.o }} /> {b.faixa}
              </span>
            ))}
            <span className="leading-relaxed">
              unid. = C.UMA+HM+LA+LE+CI+PV+PI+INTL · apontamento em rua composta ("A / B") conta em cada rua
              citada · grafia que não casa com o cadastro fica vazia (sem chute)
            </span>
          </div>
        </>
      )}
    </PainelOps>
  )
}

export function MetaLigacoesPage() {
  const { activeProjectId } = useProjectContext()
  const projetoAtivo = useProjectContext(selectActiveProjeto)
  const camp = useMetaCampanha(activeProjectId)
  const campanha = camp.ativa
  const { dias, semanas, totais, registros, loading, error, reload } = useMetaLigacoes(activeProjectId, campanha)
  const corredor = useMetaCorredor(activeProjectId, campanha?.id ?? null)
  const baixasHook = useMetaBaixas(campanha?.id ?? null)
  const [painelAberto, setPainelAberto] = useState(false)

  const temDado = dias.length > 0
  const semDadoReal = !temDado && !loading

  // Alvo/ritmo/janela derivados da campanha (não mais hardcoded).
  const META = campanha?.alvo ?? 0
  const RITMO_DIA = campanha?.ritmo_dia ?? 0
  // Ritmo semanal derivado como ritmo_dia × 5 — mantém o padrão definido pelo dono (75/dia → 375/semana).
  const RITMO_SEMANA = RITMO_DIA * 5
  const PRAZO_ISO = campanha?.data_fim ?? ''
  const PRAZO_LABEL = campanha ? fmtDdMmAaaa(campanha.data_fim) : ''
  const JANELA_LABEL = campanha ? fmtDdMmAaaa(campanha.data_inicio) : ''

  // Totais do apontamento por coluna de producao_diaria (as etapas apontam pra cá).
  const totalDaCol: Record<string, number> = { c_uma: totais.cUma, ihm: totais.hm, la: totais.la }
  const labelDaCol = (col: string, fallback: string) =>
    campanha?.etapas.find((e) => e.col === col)?.label ?? fallback

  // ── Funil dinâmico: etapas da campanha; a FINAL usa a baixa ZN como número
  // principal (quando registrada) e o apontado vira subtítulo — as duas visíveis.
  const etapas: EtapaUi[] = (campanha?.etapas ?? []).map((et, i, arr) => {
    const paleta = PALETAS[i % PALETAS.length]
    const Icon = ICONES[i % ICONES.length]
    const apontado = totalDaCol[et.col] ?? 0
    const ultimaEtapa = i === arr.length - 1
    const temBaixa = ultimaEtapa && baixasHook.ultima !== null
    return {
      ordem: i + 1,
      titulo: et.label,
      descricao: ultimaEtapa
        ? (temBaixa ? 'Baixa no app ZN (oficial)' : 'Sem baixa ZN — apontamento de campo')
        : 'Apontamento de campo',
      feito: temBaixa ? baixasHook.ultima!.acumulado : apontado,
      subApontado: ultimaEtapa ? apontado : undefined,
      icon: Icon,
      ...paleta,
    }
  })

  // ── Dependência / gargalo: estoque entre etapas consecutivas (APONTAMENTO —
  // a cadeia física roda no campo). Negativo = inconsistência de apontamento.
  const estoques = (campanha?.etapas ?? []).slice(1).map((et, i) => {
    const anterior = campanha!.etapas[i]
    const feitoAnterior = totalDaCol[anterior.col] ?? 0
    const feitoAtual = totalDaCol[et.col] ?? 0
    return {
      label: `${anterior.label} sem ${et.label}`,
      valor: feitoAnterior - feitoAtual,
      detalhe: `= ${fmtInt(feitoAnterior)} (${anterior.label}) − ${fmtInt(feitoAtual)} (${et.label}) apontados`,
      corOk: PALETAS[i % PALETAS.length].corTexto,
    }
  })
  const temInconsistencia = temDado && estoques.some((e) => e.valor < 0)

  // ── Ritmo ──
  const diasUteis = campanha ? diasUteisAteOPrazo(PRAZO_ISO) : 0
  const prazoEncerrado = diasUteis === 0
  // Etapa mais atrasada = maior restante (a cadeia inteira precisa chegar ao alvo).
  const etapaMaisAtrasada = etapas.length
    ? etapas.reduce((a, b) => (META - b.feito > META - a.feito ? b : a), etapas[0])
    : null
  const restanteMaisAtrasada = etapaMaisAtrasada ? Math.max(0, META - etapaMaisAtrasada.feito) : 0
  const ritmoNecessario = diasUteis > 0 ? restanteMaisAtrasada / diasUteis : null
  const ritmoOk = ritmoNecessario !== null && RITMO_DIA > 0 && ritmoNecessario <= RITMO_DIA

  // ── Série diária: últimos 14 dias COM dado ──
  const serie = dias.slice(-14)
  const maxVal = Math.max(RITMO_DIA, ...serie.flatMap((d) => [d.cUma, d.hm, d.la]), 1)
  const alturaPct = (v: number) => (v <= 0 ? 0 : Math.max((v / maxVal) * 100, 2))
  const linhaMetaPct = (RITMO_DIA / maxVal) * 100

  return (
    <div className="flex flex-col h-full bg-[#0a1628]">
      {/* Header */}
      <header className="shrink-0 border-b border-[#20406a] bg-[#0d2040] px-6 py-4 flex items-center gap-4 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
          <Droplets size={22} className="text-cyan-400" />
        </div>
        <div className="flex-1 min-w-[240px]">
          <h1 className="text-lg font-bold text-[#e4f2f8]">{campanha ? campanha.nome : 'Metas'}</h1>
          <p className="text-xs text-[#5a8caa]">
            {campanha
              ? `alvo ${fmtInt(META)} ${campanha.unidade} · ciclo ${JANELA_LABEL}–${PRAZO_LABEL} · ${projetoAtivo?.nome ?? 'sem projeto ativo'}`
              : `campanhas de meta por projeto · ${projetoAtivo?.nome ?? 'sem projeto ativo'}`}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => setPainelAberto((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              painelAberto ? 'bg-cyan-500/25 text-cyan-200' : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20'
            }`}
            title="Editar, encerrar ou criar campanha"
          >
            <Settings size={12} /> Campanha
          </button>
          <button
            onClick={reload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs hover:bg-cyan-500/20 transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          {campanha && (
            <>
              <div className="text-right">
                <div className="text-[10px] text-[#5a8caa] uppercase">Ritmo alvo</div>
                <div className="text-sm font-bold text-cyan-400">{RITMO_DIA}/dia · {RITMO_SEMANA}/semana</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[#5a8caa] uppercase">Dias úteis restantes</div>
                <div className="text-sm font-bold text-[#e4f2f8]">{prazoEncerrado ? '—' : `${diasUteis} (seg-sáb)`}</div>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        {error && (
          <AvisoAmber titulo="Erro ao carregar produção diária.">
            {error}
          </AvisoAmber>
        )}
        {camp.error && (
          <AvisoAmber titulo="Erro ao carregar campanhas.">
            {camp.error}
          </AvisoAmber>
        )}

        {!activeProjectId && (
          <AvisoAmber titulo="Selecione um projeto ativo.">
            As campanhas de meta são acompanhadas por projeto — escolha a obra no seletor do topo para ver o funil com os números reais apontados.
          </AvisoAmber>
        )}

        {/* Sem campanha ativa → aviso honesto + form de criar (é assim que a meta nasce) */}
        {activeProjectId && !campanha && !camp.loading && (
          <div className="space-y-4">
            <AvisoAmber titulo="Nenhuma campanha de meta ativa neste projeto.">
              A tela não inventa alvo nem janela — crie a campanha abaixo (nome, alvo, período e ritmo)
              e o funil, a matriz de ruas, a Curva S e as baixas ZN passam a rodar em cima dela.
              {camp.historico.length > 0 && (
                <> Campanhas encerradas: {camp.historico.map((c) => `${c.nome} (${fmtDdMmAaaa(c.data_inicio)}–${fmtDdMmAaaa(c.data_fim)})`).join(' · ')}.</>
              )}
            </AvisoAmber>
            <div className="bg-[#112645] border border-[#20406a] rounded-xl p-5">
              <SectionTitle icon={Plus}>Criar Campanha de Meta</SectionTitle>
              <NovaCampanhaForm onCriar={(input) => camp.criarCampanha(input)} />
            </div>
          </div>
        )}

        {activeProjectId && campanha && (
          <>
            {painelAberto && (
              <CampanhaPanel
                campanha={campanha}
                onSalvar={(patch) => camp.salvarCampanha(campanha.id, patch)}
                onEncerrar={() => { camp.encerrarCampanha(campanha.id); setPainelAberto(false) }}
                onCriar={(input) => camp.criarCampanha(input)}
                onFechar={() => setPainelAberto(false)}
              />
            )}

            {/* ═══ FRENTE B — Countdown da meta da semana (535 baixas até dom 26/07) ═══ */}
            <CountdownSemana baixas={baixasHook.baixas} ritmoAlvo={RITMO_DIA} />

            {semDadoReal && (
              <AvisoAmber titulo="Sem apontamentos de produção para esta obra na janela da campanha.">
                O funil da meta só mostra números quando houver produção diária real apontada
                dentro da janela ({JANELA_LABEL}–{PRAZO_LABEL}). Nada aqui é estimado ou de exemplo —
                aponte a produção pelo grupo APONTAMENTO WCR ou pela tela RDO para alimentar esta meta.
              </AvisoAmber>
            )}

            {/* ═══ Funil das etapas da campanha ═══ */}
            {temDado && etapas.length > 0 && (
              <div className="bg-[#112645]/40 border border-[#20406a] rounded-xl p-5">
                <SectionTitle icon={Target}>Funil da Meta — Cadeia de Dependência</SectionTitle>
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                  {etapas.map((etapa, i) => (
                    <div key={etapa.ordem} className="contents">
                      {i > 0 && (
                        <div className="hidden lg:flex items-center justify-center shrink-0">
                          <ArrowRight size={20} className="text-[#5a8caa]" />
                        </div>
                      )}
                      <EtapaCard etapa={etapa} alvo={META} />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[#5a8caa] mt-3">
                  Contagem a partir de {JANELA_LABEL} (início do ciclo — produção anterior não conta).
                  Cada etapa depende da anterior na cadeia. Na etapa final, o número principal é a
                  <b> baixa oficial no app ZN</b> (quando registrada) e o apontamento de campo aparece
                  como subtítulo — as duas séries visíveis, sem esconder divergência.
                </p>
              </div>
            )}

            {/* ═══ FRENTE B — Leaderboard por equipe (janela da campanha) ═══ */}
            {temDado && <LeaderboardEquipes registros={registros} />}

            {/* ═══ FRENTE B — Heatmap rua × dia (últimas 2 semanas) ═══ */}
            {temDado && <HeatmapRuaDia campanha={campanha} registros={registros} />}

            {/* ═══ Matriz Rua × Etapa (estilo Construcode, com cadeado) ═══ */}
            <MatrizRuas campanha={campanha} />

            {/* ═══ Curva S — corredor editável (mín ↔ ideal) ═══ */}
            {corredor.semanas.length > 0 && (
              <CurvaSCorredor
                semanas={corredor.semanas}
                dias={dias}
                baixas={baixasHook.baixas}
                meta={META}
                ritmoDia={RITMO_DIA}
                onSalvar={corredor.salvarSemana}
              />
            )}

            {/* ═══ Baixas ZN (série oficial) ═══ */}
            <BaixasZn
              baixas={baixasHook.baixas}
              ultima={baixasHook.ultima}
              alvo={META}
              unidade={campanha.unidade}
              error={baixasHook.error}
              onSalvar={baixasHook.salvarBaixa}
              onRemover={baixasHook.removerBaixa}
            />

            {temDado && (
              <>
                {/* ═══ Controle semanal (forma principal de acompanhamento) ═══ */}
                <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#20406a]">
                    <SectionTitle icon={CalendarRange}>Controle Semanal — meta {RITMO_SEMANA}/semana por etapa</SectionTitle>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-[#0d2040] text-[#5a8caa] uppercase tracking-wider">
                      <tr>
                        <th className="text-left px-5 py-2.5">Semana (seg-sáb)</th>
                        <th className="text-right px-5 py-2.5">{labelDaCol('c_uma', 'Caixa U.M.A')}</th>
                        <th className="text-right px-5 py-2.5">{labelDaCol('ihm', 'Cavalete/HM')}</th>
                        <th className="text-right px-5 py-2.5">{labelDaCol('la', 'Ligação')}</th>
                        <th className="text-right px-5 py-2.5">Total etapas</th>
                        <th className="text-right px-5 py-2.5">vs meta {RITMO_SEMANA}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...semanas].reverse().map((s) => {
                        const totalSemana = s.cUma + s.hm + s.la
                        const gargalo = Math.min(s.cUma, s.hm, s.la) // etapa mais fraca da cadeia
                        return (
                          <tr key={s.inicio} className="border-t border-[#20406a]/50 hover:bg-[#14294e]">
                            <td className="px-5 py-2 font-medium text-[#e4f2f8]">{s.label}</td>
                            <td className="px-5 py-2 text-right text-cyan-400 font-mono">{fmtInt(s.cUma)}</td>
                            <td className="px-5 py-2 text-right text-purple-400 font-mono">{fmtInt(s.hm)}</td>
                            <td className="px-5 py-2 text-right text-emerald-400 font-mono">{fmtInt(s.la)}</td>
                            <td className="px-5 py-2 text-right text-[#e4f2f8] font-mono">{fmtInt(totalSemana)}</td>
                            <td className={`px-5 py-2 text-right font-bold font-mono ${gargalo >= RITMO_SEMANA ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {gargalo >= RITMO_SEMANA ? 'no ritmo' : `−${fmtInt(RITMO_SEMANA - gargalo)}`}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="px-5 py-2.5 border-t border-[#20406a] text-[10px] text-[#5a8caa]">
                    "vs meta" olha a <b>etapa mais fraca</b> da cadeia na semana (o gargalo que trava a etapa final) contra os {RITMO_SEMANA}/semana. Semana sem apontamento não aparece.
                  </div>
                </div>

                {/* ═══ Dependência / gargalo ═══ */}
                {estoques.length > 0 && (
                  <div className="bg-[#112645] border border-[#20406a] rounded-xl p-5">
                    <SectionTitle icon={Layers}>Estoque entre Etapas (gargalo)</SectionTitle>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {estoques.map((e) => (
                        <div key={e.label} className={`rounded-xl p-4 border ${e.valor < 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#0d2040] border-[#20406a]'}`}>
                          <div className="text-[10px] font-bold text-[#5a8caa] uppercase tracking-wider mb-1">{e.label}</div>
                          <div className={`text-2xl font-bold ${e.valor < 0 ? 'text-amber-400' : e.corOk}`}>
                            {fmtInt(e.valor)}
                          </div>
                          <div className="text-[10px] text-[#5a8caa] mt-1">{e.detalhe}</div>
                        </div>
                      ))}
                    </div>
                    {temInconsistencia && (
                      <div className="mt-3">
                        <AvisoAmber titulo="Inconsistência de apontamento detectada.">
                          Há mais unidades apontadas numa etapa do que o estoque da etapa anterior permite
                          (estoque negativo acima). Isso normalmente significa que unidades executadas
                          <b> antes do início do apontamento via WhatsApp</b> não entraram na produção
                          diária — a cadeia física não roda invertida. O número é mostrado como está,
                          sem ajuste inventado; para corrigir, aponte o acumulado retroativo das etapas anteriores.
                        </AvisoAmber>
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ Ritmo ═══ */}
                <div className="bg-[#112645] border border-[#20406a] rounded-xl p-5">
                  <SectionTitle icon={TrendingUp}>Ritmo — Necessário × Alvo</SectionTitle>
                  {prazoEncerrado ? (
                    <AvisoAmber titulo={`Prazo da campanha (${PRAZO_LABEL}) já encerrado.`}>
                      Não há mais dias úteis até a data-limite — o ritmo necessário deixa de fazer
                      sentido. Os números do funil acima continuam mostrando o realizado real.
                    </AvisoAmber>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <KpiCard
                        label="Etapa mais atrasada"
                        value={etapaMaisAtrasada?.titulo ?? '—'}
                        sub={`${fmtInt(restanteMaisAtrasada)} restantes de ${fmtInt(META)}`}
                        icon={Target}
                        color="text-amber-400"
                      />
                      <KpiCard
                        label={`Dias úteis até ${labelDia(PRAZO_ISO)}`}
                        value={String(diasUteis)}
                        sub="seg-sáb (a obra trabalha sábado)"
                        icon={CalendarClock}
                        color="text-cyan-400"
                      />
                      <KpiCard
                        label="Ritmo necessário"
                        value={ritmoNecessario !== null ? `${ritmoNecessario.toFixed(1)}/dia` : '—'}
                        sub={ritmoNecessario !== null ? `≈ ${Math.ceil(ritmoNecessario * 6)}/semana na etapa mais atrasada` : undefined}
                        icon={TrendingUp}
                        color={ritmoOk ? 'text-emerald-400' : 'text-rose-400'}
                      />
                      <KpiCard
                        label="Alvo definido"
                        value={`${RITMO_DIA}/dia`}
                        sub={
                          ritmoNecessario === null
                            ? `${RITMO_SEMANA}/semana`
                            : ritmoOk
                              ? `${RITMO_SEMANA}/semana — alvo cobre a meta`
                              : `${RITMO_SEMANA}/semana — INSUFICIENTE p/ o prazo`
                        }
                        icon={Gauge}
                        color={ritmoOk ? 'text-emerald-400' : 'text-rose-400'}
                      />
                    </div>
                  )}
                </div>

                {/* ═══ Série diária ═══ */}
                <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#20406a]">
                    <SectionTitle icon={BarChart3}>Produção Diária — últimos {serie.length} dias com dado</SectionTitle>
                  </div>
                  <div className="px-5 py-4">
                    <div className="relative">
                      {/* Linha da meta ritmo/dia */}
                      <div
                        className="absolute left-0 right-0 z-10 border-t border-dashed border-amber-400/80 pointer-events-none"
                        style={{ bottom: `${linhaMetaPct}%` }}
                      >
                        <span className="absolute right-0 -top-4 text-[9px] font-bold text-amber-400 bg-[#112645] px-1">
                          meta {RITMO_DIA}/dia
                        </span>
                      </div>
                      <div className="flex items-end gap-2 h-36">
                        {serie.map((d) => (
                          <div key={d.data} className="flex-1 flex items-end justify-center gap-0.5 h-full">
                            <div
                              className="w-[28%] rounded-t-sm bg-cyan-500/70"
                              style={{ height: `${alturaPct(d.cUma)}%` }}
                              title={`${labelDia(d.data)} — ${labelDaCol('c_uma', 'Caixa UMA')}: ${d.cUma}`}
                            />
                            <div
                              className="w-[28%] rounded-t-sm bg-purple-500/70"
                              style={{ height: `${alturaPct(d.hm)}%` }}
                              title={`${labelDia(d.data)} — ${labelDaCol('ihm', 'Cavalete/HM')}: ${d.hm}`}
                            />
                            <div
                              className="w-[28%] rounded-t-sm bg-emerald-500/70"
                              style={{ height: `${alturaPct(d.la)}%` }}
                              title={`${labelDia(d.data)} — ${labelDaCol('la', 'Ligação')}: ${d.la}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                      {serie.map((d) => (
                        <div key={d.data} className="flex-1 text-center text-[9px] text-[#5a8caa]">{labelDia(d.data)}</div>
                      ))}
                    </div>
                    <div className="flex gap-4 mt-3 justify-center text-[10px] text-[#5a8caa]">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-500/70" /> {labelDaCol('c_uma', 'Caixa U.M.A')}</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500/70" /> {labelDaCol('ihm', 'Cavalete/HM')}</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/70" /> {labelDaCol('la', 'Ligação de água')}</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-0 border-t border-dashed border-amber-400/80" /> meta {RITMO_DIA}/dia</span>
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-[#0d2040] text-[#5a8caa] uppercase tracking-wider">
                      <tr>
                        <th className="text-left px-5 py-2.5">Dia</th>
                        <th className="text-right px-5 py-2.5">{labelDaCol('c_uma', 'Caixa U.M.A')}</th>
                        <th className="text-right px-5 py-2.5">{labelDaCol('ihm', 'Cavalete/HM')}</th>
                        <th className="text-right px-5 py-2.5">{labelDaCol('la', 'Ligação')}</th>
                        <th className="text-left px-5 py-2.5">Outros do dia</th>
                        <th className="text-right px-5 py-2.5">vs meta {RITMO_DIA}/dia (etapa final)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...serie].reverse().map((d) => (
                        <tr key={d.data} className="border-t border-[#20406a]/50 hover:bg-[#14294e]">
                          <td className="px-5 py-2 font-medium text-[#e4f2f8]">{labelDia(d.data)}</td>
                          <td className="px-5 py-2 text-right text-cyan-400 font-mono">{fmtInt(d.cUma)}</td>
                          <td className="px-5 py-2 text-right text-purple-400 font-mono">{fmtInt(d.hm)}</td>
                          <td className="px-5 py-2 text-right text-emerald-400 font-mono">{fmtInt(d.la)}</td>
                          <td className="px-5 py-2 text-left text-[#8fb3c8]">{d.outros || <span className="text-[#3d5a75]">—</span>}</td>
                          <td className={`px-5 py-2 text-right font-bold font-mono ${d.la >= RITMO_DIA ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {d.la >= RITMO_DIA ? '+' : ''}{fmtInt(d.la - RITMO_DIA)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-5 py-2.5 border-t border-[#20406a] text-[10px] text-[#5a8caa]">
                    Dias sem apontamento não aparecem na série (buraco honesto — sem fonte, sem número).
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
