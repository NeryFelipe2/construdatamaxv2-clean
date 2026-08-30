/**
 * MatrizRuas — matriz rua × etapa da campanha, estilo Construcode:
 * 1ª coluna sticky com a rua (núcleo, chip da equipe, casas cadastradas, ↑↓),
 * colunas DINÂMICAS das etapas da campanha; cada célula tem select de status
 * colorido + prazo; etapa com a anterior não concluída fica com CADEADO
 * (célula escura, ícone Lock, select desabilitado).
 *
 * O mini-texto "apontado: N" em cada célula é o realizado REAL da rua na janela
 * (producao_diaria) quando há match de nome — a divergência entre o que foi
 * marcado e o que foi apontado fica visível, nunca escondida.
 */
import { useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Lock, MapPin, Plus, Table2 } from 'lucide-react'
import type { CampanhaMeta } from '@/hooks/useMetaCampanha'
import { useMetaRuas, etapaBloqueada, type RuaMeta, type StatusEtapaRua } from '@/hooks/useMetaRuas'
import { useEquipes } from '@/hooks/useEquipes'

const STATUS_OPCOES: { value: StatusEtapaRua; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_execucao', label: 'Em execução' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'problema', label: 'Problema' },
]

/** Cores de fundo do select por status (verde / cinza / cinza escuro / vermelho). */
const COR_STATUS: Record<StatusEtapaRua, string> = {
  concluido: '#059669',
  em_execucao: '#64748b',
  pendente: '#1e293b',
  problema: '#dc2626',
}

function hojeIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function fmtInt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

interface CelulaEtapaProps {
  rua: RuaMeta
  etapaKey: string
  bloqueada: boolean
  apontado: number | undefined
  onSalvar: (patch: { status?: StatusEtapaRua; prazo?: string | null }) => void
}

function CelulaEtapa({ rua, etapaKey, bloqueada, apontado, onSalvar }: CelulaEtapaProps) {
  const estado = rua.statusEtapa[etapaKey] ?? { status: 'pendente' as StatusEtapaRua, prazo: null }
  const prazoVencido = !!estado.prazo && estado.prazo < hojeIso() && estado.status !== 'concluido'

  if (bloqueada) {
    return (
      <td className="px-2 py-1.5 align-top">
        <div
          className="rounded-lg border border-[#20406a]/60 px-2 py-2 flex flex-col items-center gap-1"
          style={{ background: '#0a1628' }}
          title="Etapa travada: conclua a etapa anterior pra liberar (cadeado da cadeia)"
        >
          <div className="flex items-center gap-1.5 text-[#3d5a75]">
            <Lock size={12} />
            <select
              disabled
              value={estado.status}
              className="bg-transparent text-[10px] text-[#3d5a75] outline-none cursor-not-allowed"
            >
              {STATUS_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {apontado !== undefined && (
            <span className="text-[9px] text-amber-400/90 font-mono" title="Realizado real apontado nesta rua dentro da janela — diverge do cadeado, confira o apontamento">
              apontado: {fmtInt(apontado)}
            </span>
          )}
        </div>
      </td>
    )
  }

  return (
    <td className="px-2 py-1.5 align-top">
      <div className="rounded-lg border border-[#20406a]/60 overflow-hidden">
        <select
          value={estado.status}
          onChange={(e) => onSalvar({ status: e.target.value as StatusEtapaRua })}
          className="w-full px-2 py-1.5 text-[10px] font-bold text-white outline-none cursor-pointer border-0"
          style={{ background: COR_STATUS[estado.status] }}
        >
          {STATUS_OPCOES.map((o) => <option key={o.value} value={o.value} style={{ background: '#0d2040' }}>{o.label}</option>)}
        </select>
        <div className="bg-[#0d2040] px-2 py-1 flex flex-col gap-0.5">
          <input
            type="date"
            value={estado.prazo ?? ''}
            onChange={(e) => onSalvar({ prazo: e.target.value || null })}
            className={`w-full bg-transparent text-[9px] outline-none ${prazoVencido ? 'text-rose-400 font-bold' : 'text-[#8fb3c8]'}`}
            title={prazoVencido ? 'Prazo vencido e etapa não concluída' : 'Prazo da etapa nesta rua'}
          />
          {apontado !== undefined && (
            <span className="text-[9px] text-cyan-300/90 font-mono" title="Realizado real apontado nesta rua dentro da janela da campanha">
              apontado: {fmtInt(apontado)}
            </span>
          )}
        </div>
      </div>
    </td>
  )
}

export function MatrizRuas({ campanha }: { campanha: CampanhaMeta }) {
  const { ruas, realizadoPorRua, loading, error, salvarEtapa, atribuirEquipe, criarRua, moverOrdem } = useMetaRuas(campanha)
  const { equipes } = useEquipes()
  const [novaRua, setNovaRua] = useState('')
  const [novoNucleo, setNovoNucleo] = useState('')

  const nomeEquipe = (id: string | null) =>
    id ? (equipes.find((e) => e.id === id)?.equipe ?? id) : null

  const submeterNovaRua = async () => {
    if (!novaRua.trim()) return
    const ok = await criarRua(novaRua, novoNucleo || undefined)
    if (ok) { setNovaRua(''); setNovoNucleo('') }
  }

  return (
    <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#20406a] flex items-center gap-2 flex-wrap">
        <Table2 size={16} className="text-cyan-400" />
        <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Matriz Rua × Etapa</h3>
        <span className="text-[10px] text-[#5a8caa]">
          cadeado: etapa só libera quando a anterior estiver concluída · "apontado" = produção real da janela
        </span>
      </div>

      {error && (
        <div className="mx-5 mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 flex items-start gap-2.5">
          <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <span className="text-[11px] text-amber-200/90">{error}</span>
        </div>
      )}

      {ruas.length === 0 && !loading ? (
        <div className="px-5 py-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <span className="text-xs text-amber-200/90 leading-relaxed">
              <b className="text-amber-300">Nenhuma rua cadastrada nesta campanha.</b> Cadastre as ruas
              da frente no formulário abaixo — o cadeado por etapa e o realizado real só aparecem com rua cadastrada.
            </span>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 760 }}>
            <thead className="bg-[#0d2040] text-[#5a8caa] uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 sticky left-0 z-10 bg-[#0d2040] min-w-[220px]">Rua</th>
                {campanha.etapas.map((et) => (
                  <th key={et.key} className="text-left px-2 py-2.5 min-w-[150px]">{et.label}</th>
                ))}
                <th className="text-left px-3 py-2.5 min-w-[160px]">Equipe</th>
              </tr>
            </thead>
            <tbody>
              {ruas.map((rua, idx) => {
                const realizado = realizadoPorRua.get(rua.id)
                const equipeNome = nomeEquipe(rua.equipeId)
                return (
                  <tr key={rua.id} className="border-t border-[#20406a]/50 hover:bg-[#14294e]/60">
                    {/* 1ª coluna sticky — identidade da rua */}
                    <td className="px-4 py-2 sticky left-0 z-10 bg-[#112645] align-top">
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col gap-0.5 pt-0.5">
                          <button
                            onClick={() => moverOrdem(rua.id, -1)}
                            disabled={idx === 0}
                            className="text-[#5a8caa] hover:text-cyan-300 disabled:opacity-25 disabled:cursor-default"
                            title="Subir na ordem de ataque"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            onClick={() => moverOrdem(rua.id, 1)}
                            disabled={idx === ruas.length - 1}
                            className="text-[#5a8caa] hover:text-cyan-300 disabled:opacity-25 disabled:cursor-default"
                            title="Descer na ordem de ataque"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[#e4f2f8] flex items-center gap-1.5">
                            <MapPin size={11} className="text-cyan-400 shrink-0" />
                            <span className="truncate">{rua.rua}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {rua.nucleo && <span className="text-[9px] text-[#5a8caa]">{rua.nucleo}</span>}
                            {equipeNome ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                {equipeNome}
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0d2040] text-[#5a8caa] border border-[#20406a]">
                                sem equipe
                              </span>
                            )}
                            {rua.casasAlvo !== null ? (
                              <span className="text-[9px] text-[#8fb3c8] font-mono">{fmtInt(rua.casasAlvo)} casas</span>
                            ) : (
                              <span className="text-[9px] text-amber-400/80" title="Rua sem cadastro de casas — sem número inventado">
                                sem cadastro
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* colunas dinâmicas das etapas */}
                    {campanha.etapas.map((et) => (
                      <CelulaEtapa
                        key={et.key}
                        rua={rua}
                        etapaKey={et.key}
                        bloqueada={etapaBloqueada(rua, et.key, campanha.etapas)}
                        apontado={realizado?.[et.key]}
                        onSalvar={(patch) => salvarEtapa(rua.id, et.key, patch)}
                      />
                    ))}

                    {/* equipe responsável */}
                    <td className="px-3 py-2 align-top">
                      <select
                        value={rua.equipeId ?? ''}
                        onChange={(e) => atribuirEquipe(rua.id, e.target.value || null)}
                        className="w-full rounded-lg px-2 py-1.5 text-[10px] bg-[#0d2040] border border-[#20406a] text-[#e4f2f8] outline-none focus:border-cyan-400/60 cursor-pointer"
                      >
                        <option value="">— sem equipe —</option>
                        {equipes.map((eq) => (
                          <option key={eq.id} value={eq.id}>{eq.equipe} ({eq.lider})</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* rodapé: criar rua */}
      <div className="px-5 py-3 border-t border-[#20406a] flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={novaRua}
          onChange={(e) => setNovaRua(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submeterNovaRua() }}
          placeholder="Nome da rua nova…"
          className="flex-1 min-w-[180px] rounded-lg px-3 py-1.5 text-xs bg-[#0d2040] border border-[#20406a] text-[#e4f2f8] outline-none focus:border-cyan-400/60"
        />
        <input
          type="text"
          value={novoNucleo}
          onChange={(e) => setNovoNucleo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submeterNovaRua() }}
          placeholder="Núcleo (opcional)"
          className="w-40 rounded-lg px-3 py-1.5 text-xs bg-[#0d2040] border border-[#20406a] text-[#e4f2f8] outline-none focus:border-cyan-400/60"
        />
        <button
          onClick={submeterNovaRua}
          disabled={!novaRua.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-300 rounded-lg text-xs font-semibold hover:bg-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          <Plus size={12} /> Adicionar rua
        </button>
      </div>
    </div>
  )
}
