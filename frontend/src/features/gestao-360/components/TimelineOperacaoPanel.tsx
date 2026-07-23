/**
 * TimelineOperacaoPanel — "LINHA DO TEMPO DA OPERAÇÃO" (Gestão 360).
 * Log de missão: eventos reais das 4 fontes (produção, baixas, ocorrências,
 * cronograma) em linha vertical descendente, janela 14 dias.
 *
 * Linguagem visual: industrial/utilitária (inspiração Palantir Foundry) —
 * dark profundo, bordas 1px #1e293b, números monoespaçados tabular-nums,
 * labels CAIXA ALTA 10-11px com letter-spacing, pills de filtro por tipo.
 * Dado 100% do Supabase via useTimelineOperacao — fonte sem dado vira aviso
 * âmbar honesto, nunca número inventado.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import {
  useTimelineOperacao,
  type TimelineEvento,
  type TimelineTipo,
} from '@/hooks/useTimelineOperacao'

const PAGINA = 60

const TIPO_CONFIG: Record<TimelineTipo, {
  label: string
  dot: string
  badge: string
}> = {
  producao: {
    label: 'PRODUÇÃO',
    dot: 'bg-blue-500',
    badge: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  },
  baixa: {
    label: 'BAIXA',
    dot: 'bg-[#22c55e]',
    badge: 'text-[#22c55e] border-[#22c55e]/40 bg-[#22c55e]/10',
  },
  ocorrencia: {
    label: 'OCORRÊNCIA',
    dot: 'bg-[#f59e0b]',
    badge: 'text-[#f59e0b] border-[#f59e0b]/40 bg-[#f59e0b]/10',
  },
  cronograma: {
    label: 'CRONOGRAMA',
    dot: 'bg-slate-500',
    badge: 'text-slate-400 border-slate-500/40 bg-slate-500/10',
  },
}

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

function labelDia(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return `${DIAS_SEMANA[d.getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function EventoRow({ evento }: { evento: TimelineEvento }) {
  const cfg = TIPO_CONFIG[evento.tipo]
  const critico = evento.severidade === 'critico'
  const dotClass = critico ? 'bg-[#ef4444]' : cfg.dot
  const badgeClass = critico ? 'text-[#ef4444] border-[#ef4444]/40 bg-[#ef4444]/10' : cfg.badge

  return (
    <div className="relative pl-4 border-l border-[#1e293b] ml-[4.5rem] py-1.5">
      <span className={`absolute -left-[3.5px] top-[13px] w-1.5 h-1.5 ${dotClass} ${critico ? 'animate-pulse' : ''}`} />
      <span className="absolute -left-[4.5rem] w-14 top-[9px] text-right font-mono [font-variant-numeric:tabular-nums] text-[10px] leading-4 text-slate-500">
        {evento.hora ?? `${evento.data.slice(8, 10)}/${evento.data.slice(5, 7)}`}
      </span>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`text-[9px] font-bold tracking-[0.08em] px-1.5 py-px border ${badgeClass}`}>
          {cfg.label}
        </span>
        {evento.marcador && (
          <span className={`text-[9px] font-bold tracking-[0.08em] px-1.5 py-px border ${
            evento.marcador === 'RESOLVIDA'
              ? 'text-[#22c55e] border-[#22c55e]/40 bg-[#22c55e]/10'
              : evento.marcador === 'PENTE FINO'
                ? 'text-purple-400 border-purple-500/40 bg-purple-500/10'
                : 'text-slate-400 border-slate-600 bg-slate-500/10'
          }`}>
            {evento.marcador}
          </span>
        )}
        <span className={`text-xs leading-5 ${critico ? 'text-red-300 font-semibold' : 'text-slate-200'}`}>
          {evento.titulo}
        </span>
      </div>
      {(evento.detalhe || evento.numeros.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
          {evento.numeros.map((n) => (
            <span
              key={n.label}
              className="font-mono [font-variant-numeric:tabular-nums] text-[10px] leading-4 px-1.5 py-px border border-[#1e293b] bg-[#0d1420] text-slate-300"
            >
              <span className="text-slate-500">{n.label}</span> {n.valor}
            </span>
          ))}
          {evento.detalhe && (
            <span className="text-[10px] text-slate-500 truncate max-w-full">{evento.detalhe}</span>
          )}
        </div>
      )}
    </div>
  )
}

export function TimelineOperacaoPanel({ projetoId }: { projetoId: string | null }) {
  const { eventos, contagens, resumo, fontesSemDado, loading, error, reload } = useTimelineOperacao(projetoId)
  const [filtro, setFiltro] = useState<TimelineTipo | 'todos'>('todos')
  const [limite, setLimite] = useState(PAGINA)

  const filtrados = useMemo(
    () => (filtro === 'todos' ? eventos : eventos.filter((e) => e.tipo === filtro)),
    [eventos, filtro],
  )
  const visiveis = filtrados.slice(0, limite)

  const grupos = useMemo(() => {
    const out: Array<{ dia: string; itens: TimelineEvento[] }> = []
    for (const e of visiveis) {
      const ultimo = out[out.length - 1]
      if (ultimo && ultimo.dia === e.data) ultimo.itens.push(e)
      else out.push({ dia: e.data, itens: [e] })
    }
    return out
  }, [visiveis])

  const pills: Array<{ id: TimelineTipo | 'todos'; label: string; count: number; dot?: string }> = [
    { id: 'todos', label: 'TODOS', count: eventos.length },
    { id: 'producao', label: 'PRODUÇÃO', count: contagens.producao, dot: TIPO_CONFIG.producao.dot },
    { id: 'baixa', label: 'BAIXA', count: contagens.baixa, dot: TIPO_CONFIG.baixa.dot },
    { id: 'ocorrencia', label: 'OCORRÊNCIA', count: contagens.ocorrencia, dot: TIPO_CONFIG.ocorrencia.dot },
    { id: 'cronograma', label: 'CRONOGRAMA', count: contagens.cronograma, dot: TIPO_CONFIG.cronograma.dot },
  ]

  return (
    <div className="bg-[#0a0f1a] border border-[#1e293b] rounded-xl overflow-hidden">
      {/* header */}
      <div className="bg-[#0d1420] border-b border-[#1e293b] px-4 py-3 flex flex-wrap items-center gap-3">
        <span className={`w-2 h-2 ${loading ? 'bg-[#f59e0b]' : error ? 'bg-[#ef4444]' : 'bg-[#22c55e]'} shrink-0`} />
        <h3 className="text-[11px] font-semibold tracking-[0.15em] text-slate-200 uppercase">
          Linha do Tempo da Operação
        </h3>
        <span className="font-mono [font-variant-numeric:tabular-nums] text-[10px] text-slate-500 tracking-wider">
          ÚLTIMOS 14 DIAS · {eventos.length} EVENTOS
        </span>
        <div className="ml-auto flex items-center gap-3">
          {resumo.baixasAcumulado !== null && (
            <span
              className="font-mono [font-variant-numeric:tabular-nums] text-[10px] px-2 py-1 border border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e]"
              title={resumo.campanhaNome ?? undefined}
            >
              BAIXAS {resumo.baixasAcumulado}{resumo.campanhaAlvo ? `/${resumo.campanhaAlvo}` : ''}
            </span>
          )}
          <button
            onClick={() => reload()}
            className="text-slate-500 hover:text-slate-200 transition-colors p-1"
            title="Recarregar linha do tempo"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </button>
        </div>
      </div>

      {/* filtros */}
      <div className="px-4 py-2.5 border-b border-[#1e293b] flex flex-wrap items-center gap-1.5">
        {pills.map((p) => (
          <button
            key={p.id}
            onClick={() => { setFiltro(p.id); setLimite(PAGINA) }}
            className={`flex items-center gap-1.5 px-2 py-1 border text-[10px] font-mono tracking-wider transition-colors ${
              filtro === p.id
                ? 'border-slate-400 bg-slate-500/20 text-slate-100'
                : 'border-[#1e293b] text-slate-500 hover:text-slate-300 hover:border-slate-600'
            }`}
          >
            {p.dot && <span className={`w-1.5 h-1.5 ${p.dot}`} />}
            {p.label}
            <span className="[font-variant-numeric:tabular-nums] text-slate-400">{p.count}</span>
          </button>
        ))}
      </div>

      {/* avisos honestos */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 border border-[#ef4444]/40 bg-[#ef4444]/10 text-[10px] text-red-300 flex items-center gap-2">
          <AlertTriangle size={12} className="shrink-0" />
          <span>Erro ao carregar a linha do tempo: {error}</span>
        </div>
      )}
      {fontesSemDado.length > 0 && (
        <div className="mx-4 mt-3 px-3 py-2 border border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[10px] text-[#f59e0b] space-y-0.5">
          {fontesSemDado.map((msg) => (
            <div key={msg} className="flex items-center gap-2">
              <AlertTriangle size={11} className="shrink-0" />
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* corpo */}
      <div className="px-4 py-3">
        {loading && eventos.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            <Loader2 size={20} className="mx-auto mb-2 animate-spin" />
            <p className="text-[10px] font-mono tracking-wider uppercase">Carregando eventos reais…</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            <p className="text-[10px] font-mono tracking-wider uppercase">
              Nenhum evento {filtro !== 'todos' ? `de ${TIPO_CONFIG[filtro as TimelineTipo].label} ` : ''}na janela de 14 dias
            </p>
          </div>
        ) : (
          <div>
            {grupos.map((grupo) => (
              <div key={grupo.dia}>
                <div className="flex items-center gap-2 mt-2 mb-1">
                  <span className="font-mono [font-variant-numeric:tabular-nums] text-[10px] font-semibold tracking-[0.12em] text-slate-400 w-[4.25rem] text-right">
                    {labelDia(grupo.dia)}
                  </span>
                  <span className="flex-1 h-px bg-[#1e293b]" />
                  <span className="font-mono [font-variant-numeric:tabular-nums] text-[9px] text-slate-600">
                    {grupo.itens.length}
                  </span>
                </div>
                {grupo.itens.map((evento) => (
                  <EventoRow key={evento.id} evento={evento} />
                ))}
              </div>
            ))}
            {filtrados.length > limite && (
              <button
                onClick={() => setLimite((n) => n + PAGINA)}
                className="mt-3 w-full py-2 border border-[#1e293b] text-[10px] font-mono tracking-[0.12em] text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors uppercase"
              >
                Carregar mais ({filtrados.length - limite} restantes)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
