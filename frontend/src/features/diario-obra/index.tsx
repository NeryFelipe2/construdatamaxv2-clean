import { useMemo, useState } from 'react'
import {
  FileText, ChevronDown, Users, HardHat, Wrench, ListChecks,
  AlertTriangle, RotateCcw, MapPin, CalendarDays,
} from 'lucide-react'
import { useProjectContext } from '@/store/projectContext'
import { useSupabaseDiarioObra, type DiarioObraDia, type DiarioEquipe, type NsOption } from '@/hooks/useSupabaseDiarioObra'

function fmtData(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function EquipeCard({ eq, nsOptions, onAtribuirNs }: { eq: DiarioEquipe; nsOptions: NsOption[]; onAtribuirNs: (atividadeId: string, nsId: number | null) => void }) {
  return (
    <div className="rounded-lg border border-[#3f3f3f] bg-[#2f2f2f] p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[13px] font-bold text-[#f5f5f5]">{eq.nome}</span>
        <span className="text-[10px] font-semibold text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/30 rounded px-2 py-0.5">
          líder: {eq.lider || '—'}
        </span>
      </div>
      <div className="text-[11px] text-[#a3a3a3] mt-1.5 flex items-start gap-1.5">
        <Users size={12} className="mt-0.5 shrink-0 text-[#7a7a7a]" />
        <span>{eq.composicao || '—'}</span>
      </div>
      {eq.servicos?.length > 0 && (
        <div className="mt-2 flex items-start gap-1.5">
          <ListChecks size={12} className="mt-0.5 shrink-0 text-[#22c55e]" />
          <ul className="text-[11px] text-[#d4d4d4] space-y-1 flex-1">
            {eq.servicos.map((s, i) => (
              <li key={i} className="flex items-center gap-1.5 flex-wrap">
                <span>• {s.label}</span>
                {s.atividadeId && (
                  <select
                    value={s.nsId ?? ''}
                    onChange={(e) => onAtribuirNs(s.atividadeId!, e.target.value ? Number(e.target.value) : null)}
                    className="bg-[#2c2c2c] border border-[#3f3f3f] rounded px-1 py-0.5 text-[9px] text-[#8a8a8a] focus:outline-none focus:border-[#38bdf8]/60"
                    title="Ligar esta atividade a uma NS real"
                  >
                    <option value="">sem NS</option>
                    {nsOptions.map((ns) => (
                      <option key={ns.id} value={ns.id}>{ns.label}</option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(eq.frota || eq.equip) && (
        <div className="mt-2 pt-2 border-t border-[#3f3f3f] flex flex-col gap-1">
          {eq.frota && (
            <div className="text-[10px] text-[#8a8a8a] flex items-center gap-1.5">
              <HardHat size={11} className="text-[#f97316]" /> {eq.frota}
            </div>
          )}
          {eq.equip && (
            <div className="text-[10px] text-[#8a8a8a] flex items-center gap-1.5">
              <Wrench size={11} className="text-[#a78bfa]" /> {eq.equip}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DiaCard({ dia, nsOptions, onAtribuirNs }: { dia: DiarioObraDia; nsOptions: NsOption[]; onAtribuirNs: (atividadeId: string, nsId: number | null) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-[#3f3f3f] bg-[#333333] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#3a3a3a] transition-colors text-left"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#38bdf8]/15 shrink-0">
          <CalendarDays size={17} className="text-[#38bdf8]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-bold text-[#f5f5f5]">{fmtData(dia.data)}</span>
            <span className="text-[10px] font-semibold uppercase text-[#a3a3a3] bg-[#2a2a2a] border border-[#3f3f3f] rounded px-2 py-0.5">
              {dia.nucleo}
            </span>
            {dia.fonte === 'rdo_equipes' && (
              <span className="text-[9px] font-bold uppercase text-[#f97316] bg-[#f97316]/10 border border-[#f97316]/30 rounded px-1.5 py-0.5">
                montado do RDO
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#a3a3a3] mt-0.5">
            Apontador: {dia.apontador} · {dia.totalEquipes} equipe{dia.totalEquipes === 1 ? '' : 's'}
            {dia.clima ? ` · clima: ${dia.clima}` : ''}
          </div>
        </div>
        <ChevronDown size={16} className={`text-[#8a8a8a] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-[#3f3f3f] flex flex-col gap-4">
          {dia.diarios.map((diario, idx) => (
            <div key={idx} className="flex flex-col gap-2">
              {dia.diarios.length > 1 && (
                <div className="text-[11px] font-bold text-[#a78bfa] flex items-center gap-1.5 mt-2">
                  <MapPin size={12} /> {diario.nucleo} — apontador: {diario.apontador}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {diario.equipes.map((eq, i) => (
                  <EquipeCard key={i} eq={eq} nsOptions={nsOptions} onAtribuirNs={onAtribuirNs} />
                ))}
              </div>
              {diario.ocorrencias && diario.ocorrencias.length > 0 && (
                <div className="mt-1 rounded-lg border border-[#f97316]/30 bg-[#f97316]/10 p-3">
                  <div className="text-[11px] font-bold text-[#f97316] flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle size={12} /> Ocorrências
                  </div>
                  <ul className="text-[11px] text-[#e5c9ad] list-disc list-inside space-y-0.5">
                    {diario.ocorrencias.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {dia.diarios.every((d) => d.equipes.length === 0) && (
            <div className="text-[11px] text-[#6b6b6b] text-center py-4 border border-dashed border-[#3f3f3f] rounded-lg">
              Nenhuma equipe registrada para este dia.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function DiarioObraPage() {
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const { dias, nsOptions, loading, error, reload, atribuirNs } = useSupabaseDiarioObra(activeProjectId)
  const [filtroNucleo, setFiltroNucleo] = useState<string>('todos')

  const nucleos = useMemo(() => {
    const set = new Set<string>()
    for (const d of dias) {
      for (const parte of d.nucleo.split(' + ')) {
        if (parte && parte !== '—') set.add(parte)
      }
    }
    return Array.from(set).sort()
  }, [dias])

  const diasFiltrados = useMemo(() => {
    if (filtroNucleo === 'todos') return dias
    return dias.filter((d) => d.nucleo.includes(filtroNucleo))
  }, [dias, filtroNucleo])

  const totalEquipes = diasFiltrados.reduce((acc, d) => acc + d.totalEquipes, 0)

  return (
    <div className="h-full flex flex-col bg-[#2a2a2a] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252] bg-[#333333] shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#a78bfa]/15">
            <FileText size={18} className="text-[#a78bfa]" />
          </div>
          <div>
            <h1 className="text-[#f5f5f5] font-bold text-base leading-tight">Diário de Obra</h1>
            <p className="text-[#6b6b6b] text-xs">
              Timeline de RDOs do projeto ativo · {diasFiltrados.length} dias · {totalEquipes} apontamentos de equipe
            </p>
          </div>
        </div>
        <button
          onClick={reload}
          className="flex items-center gap-1.5 text-[11px] text-[#8a8a8a] hover:text-[#f5f5f5] px-3 py-2 rounded-md border border-[#3f3f3f] hover:border-[#525252]"
        >
          <RotateCcw size={12} /> Atualizar
        </button>
      </div>

      {nucleos.length > 1 && (
        <div className="flex items-center gap-2 px-6 pt-4 flex-wrap">
          <button
            onClick={() => setFiltroNucleo('todos')}
            className={[
              'text-[11px] px-3 py-1.5 rounded-md border transition-colors',
              filtroNucleo === 'todos' ? 'border-[#38bdf8] text-[#38bdf8] bg-[#38bdf8]/10' : 'border-[#3f3f3f] text-[#8a8a8a] hover:text-[#f5f5f5]',
            ].join(' ')}
          >
            Todos os núcleos
          </button>
          {nucleos.map((n) => (
            <button
              key={n}
              onClick={() => setFiltroNucleo(n)}
              className={[
                'text-[11px] px-3 py-1.5 rounded-md border transition-colors',
                filtroNucleo === n ? 'border-[#38bdf8] text-[#38bdf8] bg-[#38bdf8]/10' : 'border-[#3f3f3f] text-[#8a8a8a] hover:text-[#f5f5f5]',
              ].join(' ')}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
        {loading && <div className="text-[12px] text-[#8a8a8a] text-center py-8">Carregando…</div>}
        {error && <div className="text-[12px] text-[#ef4444] text-center py-8">Erro: {error}</div>}
        {!loading && !error && diasFiltrados.length === 0 && (
          <div className="text-[12px] text-[#6b6b6b] text-center py-8 border border-dashed border-[#3f3f3f] rounded-lg">
            Nenhum diário de obra encontrado para este projeto.
          </div>
        )}
        {diasFiltrados.map((dia) => (
          <DiaCard key={dia.rdoId} dia={dia} nsOptions={nsOptions} onAtribuirNs={atribuirNs} />
        ))}
      </div>
    </div>
  )
}

export default DiarioObraPage
