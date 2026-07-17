/**
 * Programação da Semana — Kanban do "previsto" da operação, lido direto de
 * `programacao_semana` (via useProgramacaoSemana). Uma coluna por FRENTE
 * (Boi Malhado / Ilha Bela / Retorno), um card por EQUIPE, com o serviço e a
 * meta/dia de cada uma. Somente-leitura (a fonte é montada com a gestão e o
 * bot; o realizado entra pelos apontamentos). Tema dark, consistente com o
 * Kanban de Equipes.
 */
import { CalendarClock, MapPin, Droplet } from 'lucide-react'
import { useProgramacaoSemana } from '@/hooks/useProgramacaoSemana'

const FRENTE_COR: Record<string, { head: string; icon: 'map' | 'drop' }> = {
  'Boi Malhado': { head: 'bg-[#12335a] text-[#8fbdf0]', icon: 'map' },
  'Ilha Bela': { head: 'bg-[#0f3d33] text-[#6ed6b4]', icon: 'drop' },
  Retorno: { head: 'bg-[#4a3410] text-[#f0b45a]', icon: 'map' },
}
const COR_PADRAO = { head: 'bg-[#2a2a2a] text-[#cdd2d8]', icon: 'map' as const }

function fmtData(iso: string | null): string {
  if (!iso) return ''
  const p = iso.split('-')
  return `${p[2]}/${p[1]}`
}

export function ProgramacaoSemanaPage() {
  const { frentes, semanaIni, semanaFim, loading, error } = useProgramacaoSemana()

  return (
    <div className="p-6 max-w-6xl mx-auto text-[#e5e5e5]">
      <div className="mb-5">
        <h1 className="text-2xl font-bold flex items-center gap-2 m-0">
          <CalendarClock size={24} /> Programação da Semana
        </h1>
        <p className="text-sm text-[#9aa0a6] mt-1">
          {semanaIni ? `${fmtData(semanaIni)} a ${fmtData(semanaFim)} · WCR Saneamento` : 'WCR Saneamento'}
        </p>
      </div>

      {loading && <p className="text-[#8a8a8a]">Carregando…</p>}
      {error && <p className="text-[#f0997b]">Erro ao carregar: {error}</p>}
      {!loading && !error && frentes.length === 0 && (
        <p className="text-[#8a8a8a]">Nenhuma programação cadastrada para a semana ainda.</p>
      )}

      <div
        className="grid gap-4 items-start"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
      >
        {frentes.map((f) => {
          const cor = FRENTE_COR[f.frente] ?? COR_PADRAO
          return (
            <div key={f.frente} className="bg-white/[0.03] border border-white/10 rounded-2xl p-3">
              <div
                className={`${cor.head} rounded-lg px-3.5 py-2.5 font-bold text-[15px] mb-3 flex justify-between items-center`}
              >
                <span className="flex items-center gap-1.5">
                  {cor.icon === 'drop' ? <Droplet size={16} /> : <MapPin size={16} />} {f.frente}
                </span>
                <span className="opacity-75 font-medium">{f.equipes.length}</span>
              </div>

              <div className="flex flex-col gap-2.5">
                {f.equipes.map((eq) => (
                  <div
                    key={eq.equipe}
                    className="bg-[#1c1c1c] border border-[#3a3a3a] rounded-[10px] px-3 py-2.5"
                  >
                    <div className="font-semibold text-sm mb-1.5">{eq.equipe}</div>
                    <div className="flex flex-col gap-1.5">
                      {eq.servicos.map((s, i) => (
                        <div key={i} className="flex justify-between items-baseline gap-2.5">
                          <div className="text-[12.5px] text-[#c8ccd2] min-w-0">
                            {s.servico}
                            {s.obs && <div className="text-[11px] text-[#7d848c] mt-0.5">{s.obs}</div>}
                          </div>
                          {s.metaQtd != null ? (
                            <span className="whitespace-nowrap font-bold text-[12px] bg-white/10 text-[#e8eaed] px-2 py-0.5 rounded-md">
                              {s.metaQtd}
                              {s.metaUnidade ? ` ${s.metaUnidade}` : ''}
                            </span>
                          ) : s.metaUnidade ? (
                            <span className="whitespace-nowrap text-[11px] text-[#9aa0a6]">{s.metaUnidade}</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-5 text-[11px] text-[#6b7178] text-center">
        Fonte: programação da semana · o realizado entra conforme os apontamentos chegam
      </p>
    </div>
  )
}

export default ProgramacaoSemanaPage
