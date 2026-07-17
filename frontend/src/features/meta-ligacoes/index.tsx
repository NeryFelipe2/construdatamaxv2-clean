/**
 * Meta 1500 Ligações — funil da cadeia de dependência da meta de ligações de água
 * até 07/08/2026 (pedido do dono da obra):
 *   (1) Caixa U.M.A (1500) → (2) Cavalete/Hidrômetro (1500) → (3) Ligação de água (1500)
 * Sem caixa UMA não instala hidrômetro; sem hidrômetro não faz a ligação.
 * Ritmo alvo: 75/dia · 375/semana (seg-sáb — a obra trabalha sábado).
 * "Baixa" = registro da ligação concluída no app ZN da Sabesp.
 *
 * Dados 100% reais de `producao_diaria` (via useMetaLigacoes). Sem dado → aviso
 * honesto padrão do app (bloco amber). NUNCA número inventado.
 */
import type { ReactNode } from 'react'
import {
  Droplets, Gauge, Package, Target, AlertTriangle, RefreshCw,
  CalendarClock, TrendingUp, ArrowRight, Layers, BarChart3, CalendarRange,
} from 'lucide-react'
import { useProjectContext, selectActiveProjeto } from '@/store/projectContext'
import {
  useMetaLigacoes, META_ALVO, META_RITMO_DIA, META_RITMO_SEMANA, META_JANELA_FIM,
} from '@/hooks/useMetaLigacoes'
import { useMetaCorredor } from '@/hooks/useMetaCorredor'
import { CurvaSCorredor } from './CurvaSCorredor'

const META = META_ALVO
const RITMO_DIA = META_RITMO_DIA
const RITMO_SEMANA = META_RITMO_SEMANA
const PRAZO_ISO = META_JANELA_FIM
const PRAZO_LABEL = '07/08/2026'
const JANELA_LABEL = '06/07/2026'

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

interface Etapa {
  ordem: number
  titulo: string
  descricao: string
  feito: number
  icon: any
  // Classes literais (Tailwind JIT não gera classe montada dinamicamente)
  corTexto: string // ex: 'text-cyan-400'
  corIconeBg: string // ex: 'bg-cyan-500/15'
  corBarra: string // ex: 'bg-cyan-500'
}

function EtapaCard({ etapa }: { etapa: Etapa }) {
  const pct = META > 0 ? (etapa.feito / META) * 100 : 0
  const restante = Math.max(0, META - etapa.feito)
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
          <span className="text-xs text-[#5a8caa] ml-1.5">/ {fmtInt(META)}</span>
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

export function MetaLigacoesPage() {
  const { activeProjectId } = useProjectContext()
  const projetoAtivo = useProjectContext(selectActiveProjeto)
  const { dias, semanas, totais, loading, error, reload } = useMetaLigacoes(activeProjectId)
  const corredor = useMetaCorredor(activeProjectId)

  const temDado = dias.length > 0
  const semDadoReal = !temDado && !loading

  const etapas: Etapa[] = [
    { ordem: 1, titulo: 'Caixa U.M.A', descricao: 'Instalação da caixa', feito: totais.cUma, icon: Package, corTexto: 'text-cyan-400', corIconeBg: 'bg-cyan-500/15', corBarra: 'bg-cyan-500' },
    { ordem: 2, titulo: 'Cavalete / Hidrômetro', descricao: 'Instalação do HM', feito: totais.hm, icon: Gauge, corTexto: 'text-purple-400', corIconeBg: 'bg-purple-500/15', corBarra: 'bg-purple-500' },
    { ordem: 3, titulo: 'Ligação de Água', descricao: 'Baixa no app ZN (Sabesp)', feito: totais.la, icon: Droplets, corTexto: 'text-emerald-400', corIconeBg: 'bg-emerald-500/15', corBarra: 'bg-emerald-500' },
  ]

  // ── Dependência / gargalo: estoque entre etapas ──
  // Caixas UMA instaladas ainda sem HM; HMs instalados ainda sem ligação.
  // Negativo = inconsistência de apontamento (etapa seguinte apontada além do
  // estoque da anterior) — mostramos o aviso honesto em vez de esconder.
  const estoqueCaixaSemHm = totais.cUma - totais.hm
  const estoqueHmSemLigacao = totais.hm - totais.la
  const temInconsistencia = temDado && (estoqueCaixaSemHm < 0 || estoqueHmSemLigacao < 0)

  // ── Ritmo ──
  const diasUteis = diasUteisAteOPrazo(PRAZO_ISO)
  const prazoEncerrado = diasUteis === 0
  // Etapa mais atrasada = maior restante (a cadeia inteira precisa chegar a 1500).
  const etapaMaisAtrasada = etapas.reduce((a, b) => (META - b.feito > META - a.feito ? b : a), etapas[0])
  const restanteMaisAtrasada = Math.max(0, META - etapaMaisAtrasada.feito)
  const ritmoNecessario = diasUteis > 0 ? restanteMaisAtrasada / diasUteis : null
  const ritmoOk = ritmoNecessario !== null && ritmoNecessario <= RITMO_DIA

  // ── Série diária: últimos 14 dias COM dado ──
  const serie = dias.slice(-14)
  const maxVal = Math.max(RITMO_DIA, ...serie.flatMap((d) => [d.cUma, d.hm, d.la]), 1)
  const alturaPct = (v: number) => (v <= 0 ? 0 : Math.max((v / maxVal) * 100, 2))
  const linhaMetaPct = (RITMO_DIA / maxVal) * 100

  return (
    <div className="flex flex-col h-full bg-[#0a1628]">
      {/* Header */}
      <header className="shrink-0 border-b border-[#20406a] bg-[#0d2040] px-6 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
          <Droplets size={22} className="text-cyan-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-[#e4f2f8]">Meta 1500 Ligações de Água</h1>
          <p className="text-xs text-[#5a8caa]">
            Caixa U.M.A → Cavalete/HM → Ligação · ciclo {JANELA_LABEL}–{PRAZO_LABEL} · {projetoAtivo?.nome ?? 'sem projeto ativo'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={reload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs hover:bg-cyan-500/20 transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <div className="text-right">
            <div className="text-[10px] text-[#5a8caa] uppercase">Ritmo alvo</div>
            <div className="text-sm font-bold text-cyan-400">{RITMO_DIA}/dia · {RITMO_SEMANA}/semana</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[#5a8caa] uppercase">Dias úteis restantes</div>
            <div className="text-sm font-bold text-[#e4f2f8]">{prazoEncerrado ? '—' : `${diasUteis} (seg-sáb)`}</div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        {error && (
          <AvisoAmber titulo="Erro ao carregar produção diária.">
            {error}
          </AvisoAmber>
        )}

        {!activeProjectId && (
          <AvisoAmber titulo="Selecione um projeto ativo.">
            A meta de 1500 ligações é acompanhada por projeto — escolha a obra no seletor do topo para ver o funil com os números reais apontados.
          </AvisoAmber>
        )}

        {activeProjectId && semDadoReal && (
          <AvisoAmber titulo="Sem apontamentos de produção para esta obra.">
            O funil da meta só mostra números quando houver produção diária real apontada
            (caixa U.M.A, cavalete/hidrômetro e ligação de água na tabela de produção). Nada
            aqui é estimado ou de exemplo — aponte a produção pelo grupo APONTAMENTO WCR ou
            pela tela RDO para alimentar esta meta.
          </AvisoAmber>
        )}

        {activeProjectId && temDado && (
          <>
            {/* ═══ Funil das 3 etapas ═══ */}
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
                    <EtapaCard etapa={etapa} />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#5a8caa] mt-3">
                Contagem a partir de {JANELA_LABEL} (início do ciclo — produção anterior não conta). Sem caixa U.M.A não instala hidrômetro; sem hidrômetro não faz a ligação. "Baixa" = registro da ligação concluída no app ZN da Sabesp.
              </p>
            </div>

            {/* ═══ Curva S — corredor editável (mín ↔ ideal) ═══ */}
            {corredor.semanas.length > 0 && (
              <CurvaSCorredor
                semanas={corredor.semanas}
                dias={dias}
                meta={META}
                onSalvar={corredor.salvarSemana}
              />
            )}

            {/* ═══ Controle semanal (forma principal de acompanhamento) ═══ */}
            <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#20406a]">
                <SectionTitle icon={CalendarRange}>Controle Semanal — meta {RITMO_SEMANA}/semana por etapa</SectionTitle>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-[#0d2040] text-[#5a8caa] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-2.5">Semana (seg-sáb)</th>
                    <th className="text-right px-5 py-2.5">Caixa U.M.A</th>
                    <th className="text-right px-5 py-2.5">Cavalete/HM</th>
                    <th className="text-right px-5 py-2.5">Ligação</th>
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
                "vs meta" olha a <b>etapa mais fraca</b> da cadeia na semana (o gargalo que trava a ligação) contra os {RITMO_SEMANA}/semana. Semana sem apontamento não aparece.
              </div>
            </div>

            {/* ═══ Dependência / gargalo ═══ */}
            <div className="bg-[#112645] border border-[#20406a] rounded-xl p-5">
              <SectionTitle icon={Layers}>Estoque entre Etapas (gargalo)</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className={`rounded-xl p-4 border ${estoqueCaixaSemHm < 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#0d2040] border-[#20406a]'}`}>
                  <div className="text-[10px] font-bold text-[#5a8caa] uppercase tracking-wider mb-1">Caixas U.M.A sem cavalete/HM</div>
                  <div className={`text-2xl font-bold ${estoqueCaixaSemHm < 0 ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {fmtInt(estoqueCaixaSemHm)}
                  </div>
                  <div className="text-[10px] text-[#5a8caa] mt-1">
                    = {fmtInt(totais.cUma)} caixas − {fmtInt(totais.hm)} HMs apontados
                  </div>
                </div>
                <div className={`rounded-xl p-4 border ${estoqueHmSemLigacao < 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#0d2040] border-[#20406a]'}`}>
                  <div className="text-[10px] font-bold text-[#5a8caa] uppercase tracking-wider mb-1">Cavaletes/HM sem ligação</div>
                  <div className={`text-2xl font-bold ${estoqueHmSemLigacao < 0 ? 'text-amber-400' : 'text-purple-400'}`}>
                    {fmtInt(estoqueHmSemLigacao)}
                  </div>
                  <div className="text-[10px] text-[#5a8caa] mt-1">
                    = {fmtInt(totais.hm)} HMs − {fmtInt(totais.la)} ligações apontadas
                  </div>
                </div>
              </div>
              {temInconsistencia && (
                <div className="mt-3">
                  <AvisoAmber titulo="Inconsistência de apontamento detectada.">
                    Há mais unidades apontadas numa etapa do que o estoque da etapa anterior permite
                    (estoque negativo acima). Isso normalmente significa que caixas U.M.A ou
                    hidrômetros instalados <b>antes do início do apontamento via WhatsApp</b> não
                    entraram na produção diária — a cadeia física não roda invertida. O número é
                    mostrado como está, sem ajuste inventado; para corrigir, aponte o acumulado
                    retroativo das etapas anteriores.
                  </AvisoAmber>
                </div>
              )}
            </div>

            {/* ═══ Ritmo ═══ */}
            <div className="bg-[#112645] border border-[#20406a] rounded-xl p-5">
              <SectionTitle icon={TrendingUp}>Ritmo — Necessário × Alvo</SectionTitle>
              {prazoEncerrado ? (
                <AvisoAmber titulo={`Prazo da meta (${PRAZO_LABEL}) já encerrado.`}>
                  Não há mais dias úteis até a data-limite — o ritmo necessário deixa de fazer
                  sentido. Os números do funil acima continuam mostrando o realizado real.
                </AvisoAmber>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard
                    label="Etapa mais atrasada"
                    value={etapaMaisAtrasada.titulo}
                    sub={`${fmtInt(restanteMaisAtrasada)} restantes de ${fmtInt(META)}`}
                    icon={Target}
                    color="text-amber-400"
                  />
                  <KpiCard
                    label="Dias úteis até 07/08"
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
                  {/* Linha da meta 75/dia */}
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
                          title={`${labelDia(d.data)} — Caixa UMA: ${d.cUma}`}
                        />
                        <div
                          className="w-[28%] rounded-t-sm bg-purple-500/70"
                          style={{ height: `${alturaPct(d.hm)}%` }}
                          title={`${labelDia(d.data)} — Cavalete/HM: ${d.hm}`}
                        />
                        <div
                          className="w-[28%] rounded-t-sm bg-emerald-500/70"
                          style={{ height: `${alturaPct(d.la)}%` }}
                          title={`${labelDia(d.data)} — Ligação: ${d.la}`}
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
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-500/70" /> Caixa U.M.A</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500/70" /> Cavalete/HM</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/70" /> Ligação de água</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0 border-t border-dashed border-amber-400/80" /> meta {RITMO_DIA}/dia</span>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-[#0d2040] text-[#5a8caa] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-2.5">Dia</th>
                    <th className="text-right px-5 py-2.5">Caixa U.M.A</th>
                    <th className="text-right px-5 py-2.5">Cavalete/HM</th>
                    <th className="text-right px-5 py-2.5">Ligação</th>
                    <th className="text-left px-5 py-2.5">Outros do dia</th>
                    <th className="text-right px-5 py-2.5">vs meta {RITMO_DIA}/dia (ligação)</th>
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
      </main>
    </div>
  )
}
