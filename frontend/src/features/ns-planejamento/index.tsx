import { useMemo, useState } from 'react'
import { Droplets, Waves, AlertTriangle, CheckCircle2, RotateCcw, ExternalLink, ChevronDown, ClipboardList, Users } from 'lucide-react'
import { useProjectContext } from '@/store/projectContext'
import { useAppModeStore } from '@/store/appModeStore'
import { useSupabaseNsPlanejamento, type NsItem, type DesvioHistorico } from '@/hooks/useSupabaseNsPlanejamento'
import { useEquipes } from '@/hooks/useEquipes'
import { LigacoesOsTab } from './components/LigacoesOsTab'

const brl = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
const dec1 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const SEV_META: Record<string, { label: string; cor: string; bg: string }> = {
  critica: { label: 'CRÍTICA', cor: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  alta: { label: 'ALTA', cor: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  media: { label: 'MÉDIA', cor: '#eab308', bg: 'rgba(234,179,8,0.12)' },
}

function ProgressBar({ pct, cor }: { pct: number; cor: string }) {
  return (
    <div className="h-2 rounded-full bg-[#3f3f3f] overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: cor }} />
    </div>
  )
}

function NsRow({
  item, onConcluir, equipes, onAtribuirEquipe,
}: {
  item: NsItem
  onConcluir: (i: NsItem) => void
  equipes: Array<{ id: string; equipe: string }>
  onAtribuirEquipe: (i: NsItem, equipeId: string | null) => void
}) {
  const concluida = item.status === 'concluida'
  const dv = item.desvio
  return (
    <div className={[
      'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
      concluida ? 'bg-[#1f2e24] border-[#22c55e]/30' : dv ? 'bg-[#3a2f23] border-[#f97316]/30' : 'bg-[#333333] border-[#3f3f3f]',
    ].join(' ')}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-bold text-[#f5f5f5]">{item.atividade}</span>
          {concluida && <span className="text-[9px] font-bold uppercase text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/30 rounded px-1.5 py-0.5">concluída</span>}
          {!concluida && dv && (
            <span
              className="text-[9px] font-bold uppercase rounded px-1.5 py-0.5 border"
              style={{ color: SEV_META[dv.severidade]?.cor, background: SEV_META[dv.severidade]?.bg, borderColor: SEV_META[dv.severidade]?.cor + '4d' }}
            >
              {SEV_META[dv.severidade]?.label ?? dv.severidade} · {dv.dias_atraso}d sem baixa
            </span>
          )}
        </div>
        <div className="text-[11px] text-[#a3a3a3] mt-0.5">{item.descricao}</div>
        <div className="text-[10px] text-[#7a7a7a] mt-0.5 flex items-center gap-2 flex-wrap">
          <span>{brl(item.quantidade_planejada)} m · previsto {item.data_inicio?.split('-').reverse().join('/') ?? '—'}</span>
          <span className="flex items-center gap-1">
            <Users size={11} className="text-[#6b6b6b]" />
            <select
              value={item.equipe_id ?? ''}
              onChange={(e) => onAtribuirEquipe(item, e.target.value || null)}
              className="bg-[#2c2c2c] border border-[#3f3f3f] rounded px-1.5 py-0.5 text-[10px] text-[#f5f5f5] focus:outline-none focus:border-[#38bdf8]/60"
            >
              <option value="">sem equipe</option>
              {equipes.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.equipe}</option>
              ))}
            </select>
          </span>
        </div>
        {item.materiais && (() => {
          const m = item.materiais
          const partes: string[] = [`Brita ${dec1(m.brita_m3)}m³`]
          if (m.areia_m3 !== undefined) partes.push(`Areia ${dec1(m.areia_m3)}m³`)
          if (m.lastro_m3 !== undefined) partes.push(`Lastro ${dec1(m.lastro_m3)}m³`)
          if (m.reaterro_m3 !== undefined) partes.push(`Reaterro ${dec1(m.reaterro_m3)}m³`)
          if (m.dias_vca !== undefined && m.dias_mnd !== undefined) partes.push(`${dec1(m.dias_vca)}d VCA / ${dec1(m.dias_mnd)}d MND`)
          return <div className="text-[10px] text-[#7a7a7a] mt-0.5">{partes.join(' · ')}</div>
        })()}
      </div>
      {!concluida && (
        <button
          onClick={() => onConcluir(item)}
          className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[#22c55e] border border-[#22c55e]/40 hover:bg-[#22c55e]/10 rounded-md px-2.5 py-1.5 transition-colors"
          title="Marcar esta NS como concluída (some do painel de desvios)"
        >
          <CheckCircle2 size={12} /> Marcar concluído
        </button>
      )}
    </div>
  )
}

function DesviosHistoricosSection({ desvios }: { desvios: DesvioHistorico[] }) {
  if (desvios.length === 0) return null
  return (
    <div className="px-6 pb-3">
      <details className="rounded-lg border border-[#f97316]/30 bg-[#2f2f2f] group">
        <summary className="list-none cursor-pointer select-none px-4 py-2.5 flex items-center gap-2 text-[11px] font-semibold text-[#f5f5f5]">
          <ChevronDown size={13} className="text-[#8a8a8a] transition-transform group-open:rotate-180" />
          <AlertTriangle size={13} className="text-[#f97316]" />
          Desvios registrados sem confirmação em campo ({desvios.length})
        </summary>
        <div className="px-4 pb-1 pt-0.5 text-[10px] text-[#8a8a8a] leading-relaxed">
          Levantamento antigo (24/06–04/07), pipeline ETL substituído em 10/07 pela fonte atual de NS. Nunca foram marcados
          como resolvidos — não têm correspondência de numeração com as NS abaixo, por isso aparecem à parte.
        </div>
        <div className="px-4 pb-3 pt-2 flex flex-col gap-1 max-h-64 overflow-y-auto">
          {desvios.map((d) => (
            <div key={d.id} className="text-[11px] text-[#a3a3a3] flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5 border-b border-[#3f3f3f] last:border-0">
              <span className="font-semibold text-[#f5f5f5] min-w-[160px]">{d.atividade}</span>
              <span
                className="text-[9px] font-bold uppercase rounded px-1.5 py-0.5 border shrink-0"
                style={{ color: SEV_META[d.severidade]?.cor, background: SEV_META[d.severidade]?.bg, borderColor: (SEV_META[d.severidade]?.cor ?? '#a3a3a3') + '4d' }}
              >
                {SEV_META[d.severidade]?.label ?? d.severidade}
              </span>
              <span>{brl(d.quantidade_planejada)}m planejado</span>
              <span>registrado {d.data.split('-').reverse().join('/')} · {d.dias_sem_confirmacao}d sem confirmação</span>
              {d.acao_recomendada && <span className="text-[#7a7a7a] basis-full">{d.acao_recomendada}</span>}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}

export function NsPlanejamentoPage() {
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)
  const { resumo, itens, desviosHistoricos, loading, error, reload, marcarConcluido, atribuirEquipe } = useSupabaseNsPlanejamento(activeProjectId)
  const { equipes } = useEquipes()
  const [pagina, setPagina] = useState<'feito-afazer' | 'ligacoes-os'>('feito-afazer')
  const [aba, setAba] = useState<'AGUA' | 'ESGOTO'>('AGUA')
  const [filtro, setFiltro] = useState<'todos' | 'desvio' | 'concluidas'>('desvio')

  const podeUsarLigacoes = !!activeProjectId && !isDemoMode
  const motivoBloqueioLigacoes = isDemoMode
    ? 'Desative o Modo Demonstração para lançar dados reais de Ligações & OS'
    : !activeProjectId
      ? 'Selecione um projeto ativo'
      : undefined

  const itensAba = useMemo(() => {
    let list = itens.filter((i) => i.sistema === aba)
    if (filtro === 'desvio') list = list.filter((i) => i.desvio && i.status !== 'concluida')
    if (filtro === 'concluidas') list = list.filter((i) => i.status === 'concluida')
    return list.sort((a, b) => {
      const sevOrder: Record<string, number> = { critica: 0, alta: 1, media: 2 }
      const av = a.desvio ? sevOrder[a.desvio.severidade] ?? 3 : 4
      const bv = b.desvio ? sevOrder[b.desvio.severidade] ?? 3 : 4
      return av - bv
    })
  }, [itens, aba, filtro])

  const desviosHistoricosAba = useMemo(
    () => desviosHistoricos.filter((d) => d.sistema === aba),
    [desviosHistoricos, aba],
  )

  const resumoAba = resumo?.[aba === 'AGUA' ? 'agua' : 'esgoto']
  const desviosAbertos = itens.filter((i) => i.sistema === aba && i.desvio && i.status !== 'concluida').length
  const concluidas = itens.filter((i) => i.sistema === aba && i.status === 'concluida').length
  const totalAba = itens.filter((i) => i.sistema === aba).length

  return (
    <div className="h-full flex flex-col bg-[#2a2a2a] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252] bg-[#333333] shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#38bdf8]/15">
            <Waves size={18} className="text-[#38bdf8]" />
          </div>
          <div>
            <h1 className="text-[#f5f5f5] font-bold text-base leading-tight">Feito × A Fazer — Notas de Serviço</h1>
            <p className="text-[#6b6b6b] text-xs">
              {resumo?.fonte_data
                ? <>% feito: levantamento de campo (GPKG) de {resumo.fonte_data.split('-').reverse().join('/')} · foto, não é tempo real</>
                : <>Fonte: Notas de Serviço reais (ns/trecho) · atualizado {resumo?.atualizado_em?.split('-').reverse().join('/') ?? '—'}</>}
            </p>
          </div>
        </div>
        <button onClick={reload} className="flex items-center gap-1.5 text-[11px] text-[#8a8a8a] hover:text-[#f5f5f5] px-3 py-2 rounded-md border border-[#3f3f3f] hover:border-[#525252]">
          <RotateCcw size={12} /> Atualizar
        </button>
      </div>

      {/* Tabs de página */}
      <nav className="shrink-0 border-b border-[#3f3f3f] bg-[#2a2a2a] px-6 flex gap-1">
        {[
          { id: 'feito-afazer' as const, label: 'Feito × A Fazer', icon: Waves },
          { id: 'ligacoes-os' as const, label: 'Ligações & OS', icon: ClipboardList },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setPagina(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              pagina === t.id ? 'text-[#38bdf8] border-[#38bdf8]' : 'text-[#6b6b6b] border-transparent hover:text-[#a3a3a3]'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </nav>

      {pagina === 'ligacoes-os' && (
        <LigacoesOsTab projetoId={activeProjectId} podeUsar={podeUsarLigacoes} motivoBloqueio={motivoBloqueioLigacoes} />
      )}

      {pagina === 'feito-afazer' && (
      <>
      {/* KPIs por sistema */}
      <div className="px-6 pt-5 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(['AGUA', 'ESGOTO'] as const).map((sys) => {
          const r = resumo?.[sys === 'AGUA' ? 'agua' : 'esgoto']
          const isActive = aba === sys
          const cor = sys === 'AGUA' ? '#38bdf8' : '#a78bfa'
          return (
            <button
              key={sys}
              onClick={() => setAba(sys)}
              className={['text-left rounded-xl border p-4 transition-colors', isActive ? 'border-2' : 'border-[#3f3f3f] bg-[#333333]'].join(' ')}
              style={isActive ? { borderColor: cor, background: `${cor}14` } : undefined}
            >
              <div className="flex items-center gap-2">
                {sys === 'AGUA' ? <Droplets size={15} style={{ color: cor }} /> : <Waves size={15} style={{ color: cor }} />}
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: cor }}>{sys === 'AGUA' ? 'Água' : 'Esgoto'}</span>
                <span className="ml-auto font-mono text-xl font-bold text-[#f5f5f5]">{r ? r.pct_feito.toFixed(1) : '—'}%</span>
              </div>
              {r && (
                <>
                  <div className="mt-2"><ProgressBar pct={r.pct_feito} cor={cor} /></div>
                  <div className="text-[10px] text-[#8a8a8a] mt-1.5">
                    {brl(r.feito_m)}m feito · {brl(r.a_fazer_m)}m a fazer · {brl(r.total_m)}m total
                  </div>
                </>
              )}
            </button>
          )
        })}
      </div>

      {/* linha de ligações/baixas */}
      {resumo && (
        <div className="px-6 pb-3">
          <div className="rounded-lg border border-[#3f3f3f] bg-[#2f2f2f] px-4 py-2.5 text-[11px] text-[#a3a3a3] flex flex-wrap gap-x-6 gap-y-1">
            <span>💧 <b className="text-[#f5f5f5]">{resumo.agua_baixas.informado_felipe}</b> ligações água já baixadas · ~{resumo.agua_baixas.estimativa_pct}% estimado</span>
            <span>🚽 <b className="text-[#f5f5f5]">{resumo.esgoto_baixas.ids_distintos}</b> baixas esgoto (fonte de {resumo.esgoto_baixas.periodo_fonte}) · ~{resumo.esgoto_baixas.estimativa_pct}% estimado</span>
          </div>
        </div>
      )}

      {/* por rua */}
      {resumo?.por_rua && resumo.por_rua.length > 0 && (
        <div className="px-6 pb-3">
          <details className="rounded-lg border border-[#3f3f3f] bg-[#2f2f2f] group">
            <summary className="list-none cursor-pointer select-none px-4 py-2.5 flex items-center gap-2 text-[11px] font-semibold text-[#f5f5f5]">
              <ChevronDown size={13} className="text-[#8a8a8a] transition-transform group-open:rotate-180" />
              Por rua ({resumo.por_rua.length})
            </summary>
            <div className="px-4 pb-3 pt-1 flex flex-col gap-1 max-h-64 overflow-y-auto">
              {resumo.por_rua.map((r, idx) => {
                const aguaExec = r.agua_exec_m ?? 0
                const aguaAfazer = r.agua_afazer_m ?? 0
                const esgotoExec = r.esgoto_exec_m ?? 0
                const esgotoAfazer = r.esgoto_afazer_m ?? 0
                const temAgua = aguaExec !== 0 || aguaAfazer !== 0
                const temEsgoto = esgotoExec !== 0 || esgotoAfazer !== 0
                return (
                  <div key={`${r.rua}-${idx}`} className="text-[11px] text-[#a3a3a3] flex flex-wrap gap-x-4 gap-y-0.5 py-1 border-b border-[#3f3f3f] last:border-0">
                    <span className="font-semibold text-[#f5f5f5] min-w-[140px]">{r.rua}</span>
                    {temAgua && (
                      <span>💧 água: <b className="text-[#38bdf8]">{brl(aguaExec)}m</b> exec / {brl(aguaAfazer)}m a fazer</span>
                    )}
                    {temEsgoto && (
                      <span>🚽 esgoto: <b className="text-[#a78bfa]">{brl(esgotoExec)}m</b> exec / {brl(esgotoAfazer)}m a fazer</span>
                    )}
                  </div>
                )
              })}
            </div>
          </details>
        </div>
      )}

      {/* desvios do pipeline antigo, nunca resolvidos */}
      <DesviosHistoricosSection desvios={desviosHistoricosAba} />

      {/* filtros + lista */}
      <div className="flex items-center gap-2 px-6 pb-3 flex-wrap">
        {desviosAbertos > 0 && (
          <span className="text-[11px] font-bold text-[#f97316] bg-[#f97316]/10 border border-[#f97316]/30 rounded-full px-3 py-1 flex items-center gap-1">
            <AlertTriangle size={11} /> {desviosAbertos} NS sem baixa
          </span>
        )}
        <span className="text-[11px] text-[#8a8a8a]">{concluidas}/{totalAba} concluídas</span>
        <div className="ml-auto flex gap-1">
          {(['desvio', 'todos', 'concluidas'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={[
                'text-[11px] px-3 py-1.5 rounded-md border transition-colors',
                filtro === f ? 'border-[#38bdf8] text-[#38bdf8] bg-[#38bdf8]/10' : 'border-[#3f3f3f] text-[#8a8a8a] hover:text-[#f5f5f5]',
              ].join(' ')}
            >
              {f === 'desvio' ? 'Sem baixa' : f === 'todos' ? 'Todas' : 'Concluídas'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-2">
        {loading && <div className="text-[12px] text-[#8a8a8a] text-center py-8">Carregando…</div>}
        {error && <div className="text-[12px] text-[#ef4444] text-center py-8">Erro: {error}</div>}
        {!loading && !error && itensAba.length === 0 && (
          <div className="text-[12px] text-[#6b6b6b] text-center py-8 border border-dashed border-[#3f3f3f] rounded-lg">
            Nenhuma NS nesse filtro.
          </div>
        )}
        {itensAba.map((item) => (
          <NsRow key={item.id} item={item} onConcluir={marcarConcluido} equipes={equipes} onAtribuirEquipe={atribuirEquipe} />
        ))}
      </div>

      <div className="px-6 py-2.5 border-t border-[#3f3f3f] text-[10px] text-[#6b6b6b] flex items-center gap-1.5 shrink-0">
        <ExternalLink size={10} /> Dados de baixas de água/esgoto podem estar desatualizados — ver observação de cada estimativa acima.
      </div>
      </>
      )}
    </div>
  )
}
