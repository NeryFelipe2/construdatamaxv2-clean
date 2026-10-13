/**
 * CurtoPrazoPanel — Curto Prazo do Planejamento Mestre com dado REAL.
 *
 * Re-fonte de 27/07: este painel consumia o operacaoCampoStore (mock de
 * calendário/PPC/curva S). Agora tudo vem do Supabase via useCurtoPrazoSemana:
 *  - COMPROMISSOS  → programacao_semana (semana corrente, inclui a semana do
 *                    pente fino 27/07–01/08: Equipe PV + Equipe Esgoto, 24 PVs)
 *                    cruzada com a produção casada por equipe+etapa;
 *  - PRODUÇÃO      → vw_producao_longa (producao_diaria em formato longo, com
 *                    equipe_id resolvido pelos aliases de 27/07);
 *  - PPC           → vw_ppc_semana_equipe (LPS formal; a view já ignora semanas
 *                    sem evidência de produção — carga histórica de 14/07).
 *
 * REGRA: sem dado → estado vazio honesto declarando a fonte; número nunca é
 * inventado. Linguagem visual Palantir (padrão torre-de-controle/meta-ligacoes):
 * dark #0a0f1a/#0d1420, bordas 1px #1e293b, números monoespaçados tabulares,
 * labels em caixa alta, quadrados de status, fonte declarada em cada bloco.
 */
import {
  useCurtoPrazoSemana,
  ETAPA_LABEL,
  type CpCompromisso,
  type CpPpcSemana,
  type CpProducaoEquipe,
} from '@/hooks/useCurtoPrazoSemana'

// ─── Constantes visuais (linguagem oficial dark/mono/caps) ──────────────────

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

function ddmm(isoDate: string): string {
  if (!isoDate) return '--/--'
  const [, m, d] = isoDate.split('-')
  return `${d}/${m}`
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
  return <div className={`text-[9px] text-[#475569] ${MONO} pt-1.5`}>{children}</div>
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

function corPct(pct: number | null): string {
  if (pct === null) return C.faint
  if (pct >= 100) return C.green
  if (pct > 0) return C.amber
  return C.red
}

function corPpc(v: number): string {
  if (v >= 80) return C.green
  if (v >= 60) return C.amber
  return C.red
}

// ─── Compromissos da semana ─────────────────────────────────────────────────

function LinhaCompromisso({ c }: { c: CpCompromisso }) {
  const pct =
    c.realizado === null || c.metaQtd == null || c.metaQtd <= 0
      ? null
      : Math.round((c.realizado / c.metaQtd) * 100)
  const cor = corPct(pct)

  return (
    <div className="border border-[#1e293b] bg-[#0d1420] px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <div className="pt-0.5"><StatusSquare color={cor} /></div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#e2e8f0] truncate">
              {c.equipe}
            </div>
            <div className="text-[10px] text-[#64748b] leading-snug mt-0.5">{c.servico}</div>
            {c.obs && <div className="text-[9px] text-[#475569] leading-snug mt-0.5">{c.obs}</div>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-lg leading-none text-[#e2e8f0] ${MONO}`}>
            {c.realizado === null ? '—' : c.realizado}
            <span className="text-[#64748b] text-xs">
              {' '}/ {c.metaQtd ?? '—'} {c.metaUnidade ?? ''}
            </span>
          </div>
          <div className={`text-[10px] mt-0.5 ${MONO}`} style={{ color: cor }}>
            {pct === null ? 'sem etapa mensurável' : `${pct}%`}
          </div>
        </div>
      </div>

      {/* barra meta × realizado */}
      <div className="h-1 bg-[#1e293b] overflow-hidden">
        {pct !== null && (
          <div className="h-full" style={{ width: `${Math.min(100, pct)}%`, background: cor }} />
        )}
      </div>

      <div className={`text-[9px] text-[#475569] ${MONO}`}>
        {c.frente.toUpperCase()} · {ddmm(c.semanaIni)}–{ddmm(c.semanaFim)} ·{' '}
        {c.realizado === null
          ? 'serviço sem contraparte em producao_diaria (progresso é confirmado no cronograma do pente fino)'
          : c.linhasCasadas === 0
            ? `0 apontamentos casados (etapa ${c.etapas.map((e) => ETAPA_LABEL[e] ?? e).join('/')})`
            : `${c.linhasCasadas} apontamento(s) casado(s) por equipe+etapa (${c.etapas.map((e) => ETAPA_LABEL[e] ?? e).join('/')})`}
      </div>
    </div>
  )
}

// ─── PPC ────────────────────────────────────────────────────────────────────

function BlocoPpc({
  atual,
  historico,
  semanaIso,
}: {
  atual: CpPpcSemana[]
  historico: CpPpcSemana[]
  semanaIso: string
}) {
  return (
    <div className="border border-[#1e293b] bg-[#0d1420] px-3 py-2.5 flex flex-col gap-2.5">
      <Label>PPC — Compromissos Formais (LPS)</Label>

      {atual.length === 0 ? (
        <AvisoSemDado>
          Nenhum compromisso formal gravado pra semana {semanaIso} em lps_tasks — use o Semáforo do
          LPS pra comprometer a semana.
        </AvisoSemDado>
      ) : (
        <div className="flex flex-col gap-1.5">
          {atual.map((p, i) => (
            <div key={i} className="flex items-center gap-3">
              <StatusSquare color={corPpc(p.ppc)} />
              <span className="text-[10px] uppercase tracking-[0.1em] text-[#e2e8f0] flex-1 truncate">
                {p.responsavel ?? 'Geral (sem responsável)'}
              </span>
              <span className={`text-[10px] text-[#64748b] ${MONO}`}>
                {p.concluidas}/{p.planejadas}
              </span>
              <span className={`text-sm ${MONO}`} style={{ color: corPpc(p.ppc) }}>
                {Math.round(p.ppc)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {historico.length > 0 && (
        <div className="flex flex-col gap-1 pt-1 border-t border-[#1e293b]">
          <Label>Semanas anteriores</Label>
          {historico.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`text-[9px] text-[#64748b] w-16 shrink-0 ${MONO}`}>{p.semanaIso}</span>
              <div className="flex-1 h-1 bg-[#1e293b] overflow-hidden">
                <div
                  className="h-full"
                  style={{ width: `${Math.min(100, p.ppc)}%`, background: corPpc(p.ppc) }}
                />
              </div>
              <span className={`text-[10px] w-9 text-right ${MONO}`} style={{ color: corPpc(p.ppc) }}>
                {Math.round(p.ppc)}%
              </span>
            </div>
          ))}
        </div>
      )}

      <Fonte>fonte: vw_ppc_semana_equipe (lps_tasks; semanas sem evidência de produção já filtradas)</Fonte>
    </div>
  )
}

// ─── Produção da semana por equipe ──────────────────────────────────────────

function BlocoProducao({
  porEquipe,
  semanaIni,
  semanaFim,
}: {
  porEquipe: CpProducaoEquipe[]
  semanaIni: string
  semanaFim: string
}) {
  return (
    <div className="border border-[#1e293b] bg-[#0d1420] px-3 py-2.5 flex flex-col gap-2.5">
      <Label>Produção apontada na semana</Label>

      {porEquipe.length === 0 ? (
        <AvisoSemDado>
          0 registros em producao_diaria entre {ddmm(semanaIni)} e {ddmm(semanaFim)} — o apontamento
          entra pelo grupo APONTAMENTO WCR (RDO) ao fim do dia.
        </AvisoSemDado>
      ) : (
        <div className="flex flex-col gap-1.5">
          {porEquipe.map((e) => (
            <div key={e.equipe} className="flex items-start gap-2">
              <div className="pt-1"><StatusSquare color={C.cyan} /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#e2e8f0] truncate">
                  {e.equipe}
                </div>
                <div className={`text-[10px] text-[#64748b] ${MONO}`}>
                  {e.porEtapa.map((x) => `${x.qtd} ${ETAPA_LABEL[x.etapa] ?? x.etapa}`).join(' · ')}
                </div>
              </div>
              <span className={`text-[9px] text-[#475569] shrink-0 ${MONO}`}>
                {e.totalLinhas} apont.
              </span>
            </div>
          ))}
        </div>
      )}

      <Fonte>fonte: vw_producao_longa (producao_diaria; equipe resolvida por equipe_aliases 27/07)</Fonte>
    </div>
  )
}

// ─── Painel principal ───────────────────────────────────────────────────────

export function CurtoPrazoPanel() {
  const {
    compromissos,
    producaoPorEquipe,
    ppcAtual,
    ppcHistorico,
    semanaIni,
    semanaFim,
    semanaIso,
    loading,
    error,
  } = useCurtoPrazoSemana()

  return (
    <div className="border border-[#1e293b] p-4 flex flex-col gap-4" style={{ background: C.bg }}>
      {/* Cabeçalho */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
            Curto Prazo — Semana Corrente
          </div>
          <div className={`text-lg leading-tight text-[#e2e8f0] ${MONO}`}>
            {ddmm(semanaIni)} – {ddmm(semanaFim)}
            <span className="text-[#64748b] text-xs ml-2">{semanaIso}</span>
          </div>
        </div>
        <div className={`text-[9px] text-[#475569] ${MONO}`}>
          programacao_semana · vw_producao_longa · vw_ppc_semana_equipe
        </div>
      </div>

      {loading && (
        <div className={`text-[10px] uppercase tracking-[0.14em] text-[#64748b] ${MONO}`}>
          Carregando dados da semana…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 border border-[#ef4444]/40 bg-[#ef4444]/5 px-2.5 py-2">
          <StatusSquare color={C.red} />
          <span className="text-[10px] leading-snug text-[#ef4444]">{error}</span>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Compromissos da semana (programacao_semana × produção casada) */}
          <div className="flex flex-col gap-2">
            <Label>Compromissos da semana (meta × realizado)</Label>
            {compromissos.length === 0 ? (
              <AvisoSemDado>
                0 linhas em programacao_semana cobrindo hoje — grave a programação da semana na aba
                Prog. Semanal (ou na tela Programação da Semana) pra este painel ter meta contra o
                que medir.
              </AvisoSemDado>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {compromissos.map((c) => (
                  <LinhaCompromisso key={c.id} c={c} />
                ))}
              </div>
            )}
            <Fonte>fonte: programacao_semana (semana_ini ≤ hoje ≤ semana_fim) × vw_producao_longa</Fonte>
          </div>

          {/* PPC + Produção lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <BlocoPpc atual={ppcAtual} historico={ppcHistorico} semanaIso={semanaIso} />
            <BlocoProducao
              porEquipe={producaoPorEquipe}
              semanaIni={semanaIni}
              semanaFim={semanaFim}
            />
          </div>
        </>
      )}
    </div>
  )
}
