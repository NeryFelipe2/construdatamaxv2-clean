/**
 * AFazerManualModal — Entrada manual do "A Fazer" (sem arquivo).
 * Grava quantidades (redes, ligações, caixas, elevatória/booster) em
 * planejamento_itens via salvarAFazerManual, no projeto ativo.
 */
import { useState } from 'react'
import { X, ClipboardList, CheckCircle, AlertTriangle } from 'lucide-react'
import { useProjectContext } from '@/store/projectContext'
import { salvarAFazerManual } from '@/hooks/useGeoAFazer'

interface Props {
  onClose: () => void
}

const CAMPOS: Array<{ key: string; label: string; unidade: string }> = [
  { key: 'redeAguaM', label: 'Rede de água', unidade: 'm' },
  { key: 'redeEsgotoM', label: 'Rede de esgoto', unidade: 'm' },
  { key: 'ligacoesAgua', label: 'Ligações de água (LA)', unidade: 'un' },
  { key: 'ligacoesEsgoto', label: 'Ligações de esgoto (LE)', unidade: 'un' },
  { key: 'caixasUma', label: 'Caixas U.M.A', unidade: 'un' },
  { key: 'caixasEsgoto', label: 'Caixas de esgoto', unidade: 'un' },
  { key: 'casasALigar', label: 'Casas a ligar', unidade: 'un' },
  { key: 'elevatorias', label: 'Elevatórias', unidade: 'un' },
  { key: 'boosters', label: 'Boosters', unidade: 'un' },
]

export function AFazerManualModal({ onClose }: Props) {
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const projetos = useProjectContext((s) => s.projetos)
  const projetoAtivo = projetos.find((p) => p.id === activeProjectId) ?? null

  const [valores, setValores] = useState<Record<string, string>>({})
  const [rua, setRua] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  async function handleSalvar() {
    if (!activeProjectId || !projetoAtivo) {
      setMsg({ ok: false, texto: 'Selecione um projeto ativo no topo do site primeiro.' })
      return
    }
    setSalvando(true)
    setMsg(null)
    try {
      const num = (k: string) => {
        const v = Number(valores[k])
        return Number.isFinite(v) && v > 0 ? v : undefined
      }
      const r = await salvarAFazerManual({
        projetoId: activeProjectId,
        nucleo: projetoAtivo.nome,
        rua: rua.trim() || undefined,
        observacao: obs.trim() || undefined,
        redeAguaM: num('redeAguaM'),
        redeEsgotoM: num('redeEsgotoM'),
        ligacoesAgua: num('ligacoesAgua'),
        ligacoesEsgoto: num('ligacoesEsgoto'),
        caixasUma: num('caixasUma'),
        caixasEsgoto: num('caixasEsgoto'),
        casasALigar: num('casasALigar'),
        elevatorias: num('elevatorias'),
        boosters: num('boosters'),
      })
      setMsg({ ok: true, texto: `${r.itens} item(ns) de A Fazer gravados para ${projetoAtivo.nome}.` })
      setValores({})
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof Error ? e.message : 'Erro ao salvar.' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ClipboardList size={15} className="text-orange-400" />
            A Fazer — entrada manual
          </h3>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-xs text-[#a3a3a3]">
            Projeto ativo: <span className="text-orange-400 font-semibold">{projetoAtivo?.nome ?? 'nenhum selecionado'}</span>.
            Preencha só o que souber — campos vazios não entram.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CAMPOS.map((c) => (
              <div key={c.key}>
                <label className="text-[10px] text-[#6b6b6b] uppercase block mb-1">{c.label} ({c.unidade})</label>
                <input
                  type="number"
                  min={0}
                  value={valores[c.key] ?? ''}
                  onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
                  className="w-full bg-[#3d3d3d] border border-[#525252] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#6b6b6b] uppercase block mb-1">Rua / local (opcional)</label>
              <input
                value={rua}
                onChange={(e) => setRua(e.target.value)}
                placeholder="Ex: Rua 4 José Vandir"
                className="w-full bg-[#3d3d3d] border border-[#525252] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#6b6b6b] uppercase block mb-1">Observação (opcional)</label>
              <input
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                className="w-full bg-[#3d3d3d] border border-[#525252] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {msg && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${msg.ok ? 'bg-green-900/30 border border-green-800 text-green-300' : 'bg-red-900/30 border border-red-800 text-red-300'}`}>
              {msg.ok ? <CheckCircle size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
              {msg.texto}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#525252]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#a3a3a3] hover:text-white transition-colors">Fechar</button>
          <button
            onClick={handleSalvar}
            disabled={salvando || !activeProjectId}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {salvando ? 'Salvando…' : 'Gravar A Fazer'}
          </button>
        </div>
      </div>
    </div>
  )
}
