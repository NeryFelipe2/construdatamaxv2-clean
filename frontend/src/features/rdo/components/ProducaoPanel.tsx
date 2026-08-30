/**
 * ProducaoPanel — Produção diária tipada (Execução_Geral da planilha → RDO).
 * Grade de lançamento: 1 linha por dia×equipe×rua com colunas tipadas
 * (LA, LE, PRA m, C.UMA, PRE m, C.INSP, PV, PI, LIE, LIA, IHM, INT, obs).
 * Fonte real via Supabase (`producao_diaria`) — nada de número inventado.
 */
import { useEffect, useState } from 'react'
import { Plus, Trash2, Upload, AlertTriangle, RefreshCw } from 'lucide-react'
import { useProjectContext } from '@/store/projectContext'
import { useAppModeStore } from '@/store/appModeStore'
import { useEquipes } from '@/hooks/useEquipes'
import { useProducaoDiaria, type ProducaoDiariaInput, type ProducaoDiariaRow } from '@/hooks/useProducaoDiaria'
import { ImportarCsvProducaoModal } from './ImportarCsvProducaoModal'

const CUSTOM_EQUIPE = '__custom__'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

// ─── Inputs inline (grade estilo planilha) ────────────────────────────────────

function NumCell({ value, onCommit, disabled }: { value: number; onCommit: (v: number) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return (
    <input
      type="number"
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft)
        const next = Number.isFinite(n) ? n : 0
        setDraft(String(next))
        if (next !== value) onCommit(next)
      }}
      className="w-16 bg-[#484848] border border-[#5e5e5e] rounded px-1.5 py-1 text-xs text-[#f5f5f5] text-right focus:outline-none focus:border-[#f97316]/50 disabled:opacity-50"
    />
  )
}

function TextCell({ value, onCommit, disabled, placeholder, width = 'w-28' }: {
  value: string | null; onCommit: (v: string) => void; disabled?: boolean; placeholder?: string; width?: string
}) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [value])
  return (
    <input
      type="text"
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== (value ?? '')) onCommit(draft) }}
      className={`${width} bg-[#484848] border border-[#5e5e5e] rounded px-1.5 py-1 text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50 disabled:opacity-50`}
    />
  )
}

// ─── Formulário de nova linha ─────────────────────────────────────────────────

interface NovaLinhaForm {
  data: string
  nucleo: string
  equipeSel: string // id da equipe OU CUSTOM_EQUIPE
  equipeLivre: string
  rua: string
  la: string; le: string; praM: string; cUma: string; preM: string; cInsp: string
  pv: string; pi: string; lie: string; lia: string; ihm: string; intercept: string
  obs: string
}

function linhaFormVazio(dataAtual: string): NovaLinhaForm {
  return {
    data: dataAtual, nucleo: '', equipeSel: '', equipeLivre: '', rua: '',
    la: '0', le: '0', praM: '0', cUma: '0', preM: '0', cInsp: '0',
    pv: '0', pi: '0', lie: '0', lia: '0', ihm: '0', intercept: '0', obs: '',
  }
}

const numInputCls = 'w-16 bg-[#484848] border border-[#5e5e5e] rounded px-1.5 py-1 text-xs text-[#f5f5f5] text-right focus:outline-none focus:border-[#f97316]/50'
const textInputCls = 'bg-[#484848] border border-[#5e5e5e] rounded px-1.5 py-1 text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50'

export function ProducaoPanel() {
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)
  const { equipes } = useEquipes()
  const { linhas, loading, error, reload, adicionarLinha, adicionarLinhasEmLote, atualizarLinha, removerLinha } =
    useProducaoDiaria(activeProjectId)

  const [form, setForm] = useState<NovaLinhaForm>(() => linhaFormVazio(todayStr()))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)

  const podeLancar = !!activeProjectId && !isDemoMode
  const motivoBloqueio = isDemoMode
    ? 'Desative o Modo Demonstração para lançar produção real'
    : !activeProjectId
      ? 'Selecione um projeto ativo'
      : undefined

  async function handleAdicionar() {
    if (!podeLancar) return
    if (!form.data) { setFormError('Informe a data'); return }
    const equipeId = form.equipeSel && form.equipeSel !== CUSTOM_EQUIPE ? form.equipeSel : null
    const equipeNome = equipeId
      ? (equipes.find((e) => e.id === equipeId)?.equipe ?? '')
      : form.equipeLivre.trim()
    if (!equipeId && !equipeNome) { setFormError('Selecione uma equipe ou digite o nome'); return }

    setFormError(null)
    setSaving(true)
    const input: ProducaoDiariaInput = {
      data: form.data,
      nucleo: form.nucleo || null,
      equipeId,
      equipeNome: equipeNome || null,
      rua: form.rua || null,
      la: Number(form.la) || 0,
      le: Number(form.le) || 0,
      praM: Number(form.praM) || 0,
      cUma: Number(form.cUma) || 0,
      preM: Number(form.preM) || 0,
      cInsp: Number(form.cInsp) || 0,
      pv: Number(form.pv) || 0,
      pi: Number(form.pi) || 0,
      lie: Number(form.lie) || 0,
      lia: Number(form.lia) || 0,
      ihm: Number(form.ihm) || 0,
      intercept: Number(form.intercept) || 0,
      obs: form.obs || null,
    }
    const ok = await adicionarLinha(input)
    setSaving(false)
    if (ok) {
      // Mantém data/núcleo/equipe (lançamento rápido em sequência) e limpa o resto.
      setForm((f) => ({ ...linhaFormVazio(f.data), nucleo: f.nucleo, equipeSel: f.equipeSel, equipeLivre: f.equipeLivre }))
    } else {
      setFormError('Erro ao gravar a linha. Veja o aviso abaixo.')
    }
  }

  function handleRemover(row: ProducaoDiariaRow) {
    if (!confirm(`Remover o lançamento de ${fmtDate(row.data)} (${row.equipeNome || 'sem equipe'} — ${row.rua || 'sem rua'})?`)) return
    void removerLinha(row.id)
  }

  if (!podeLancar) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-200/90 leading-relaxed">
            <b className="text-amber-300">Produção diária indisponível.</b> {motivoBloqueio}. Nenhum lançamento de produção pode ser feito ou visualizado neste modo — nada aqui é estimado ou de exemplo.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-semibold text-lg">Produção Diária</h2>
          <p className="text-[#a3a3a3] text-xs mt-0.5">
            {linhas.length} lançamento{linhas.length !== 1 ? 's' : ''} · 1 linha por dia × equipe × rua
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#a3a3a3] hover:text-[#f5f5f5] bg-[#3d3d3d] border border-[#525252] hover:bg-[#484848] transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            <Upload size={13} /> Importar CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2.5">
          <AlertTriangle size={13} className="text-rose-400 mt-0.5 shrink-0" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {/* Formulário de nova linha */}
      <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4 space-y-3">
        <h3 className="text-[#f5f5f5] text-sm font-medium">Novo lançamento</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[#a3a3a3] text-[10px] mb-1">Data</label>
            <input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} className={textInputCls} />
          </div>
          <div>
            <label className="block text-[#a3a3a3] text-[10px] mb-1">Núcleo</label>
            <input type="text" value={form.nucleo} onChange={(e) => setForm((f) => ({ ...f, nucleo: e.target.value }))} placeholder="ex. Boi Malhado" className={`${textInputCls} w-32`} />
          </div>
          <div>
            <label className="block text-[#a3a3a3] text-[10px] mb-1">Equipe</label>
            <select
              value={form.equipeSel}
              onChange={(e) => setForm((f) => ({ ...f, equipeSel: e.target.value }))}
              className={`${textInputCls} w-40`}
            >
              <option value="">— selecione —</option>
              {equipes.map((eq) => <option key={eq.id} value={eq.id}>{eq.equipe}</option>)}
              <option value={CUSTOM_EQUIPE}>✎ Outro (digitar)</option>
            </select>
          </div>
          {form.equipeSel === CUSTOM_EQUIPE && (
            <div>
              <label className="block text-[#a3a3a3] text-[10px] mb-1">Nome da equipe</label>
              <input type="text" value={form.equipeLivre} onChange={(e) => setForm((f) => ({ ...f, equipeLivre: e.target.value }))} placeholder="Digite o nome" className={`${textInputCls} w-36`} />
            </div>
          )}
          <div>
            <label className="block text-[#a3a3a3] text-[10px] mb-1">Rua</label>
            <input type="text" value={form.rua} onChange={(e) => setForm((f) => ({ ...f, rua: e.target.value }))} placeholder="ex. Rua das Flores" className={`${textInputCls} w-36`} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {([
            ['la', 'LA'], ['le', 'LE'], ['praM', 'PRA m'], ['cUma', 'C.UMA'], ['preM', 'PRE m'], ['cInsp', 'C.INSP'],
            ['pv', 'PV'], ['pi', 'PI'], ['lie', 'LIE'], ['lia', 'LIA'], ['ihm', 'IHM'], ['intercept', 'INT'],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className="block text-[#a3a3a3] text-[10px] mb-1">{label}</label>
              <input
                type="number"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className={numInputCls}
              />
            </div>
          ))}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[#a3a3a3] text-[10px] mb-1">Obs</label>
            <input type="text" value={form.obs} onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))} placeholder="observações" className={`${textInputCls} w-full`} />
          </div>
          <button
            onClick={handleAdicionar}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#f97316' }}
          >
            <Plus size={14} /> {saving ? 'Salvando...' : 'Adicionar linha'}
          </button>
        </div>
        {formError && <p className="text-rose-400 text-xs">{formError}</p>}
      </div>

      {/* Grade de lançamentos */}
      <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#6b6b6b] text-[10px] border-b border-[#525252] uppercase tracking-wide">
                <th className="text-left px-2 py-2.5 font-medium">Data</th>
                <th className="text-left px-2 py-2.5 font-medium">Núcleo</th>
                <th className="text-left px-2 py-2.5 font-medium">Equipe</th>
                <th className="text-left px-2 py-2.5 font-medium">Rua</th>
                <th className="text-right px-2 py-2.5 font-medium">LA</th>
                <th className="text-right px-2 py-2.5 font-medium">LE</th>
                <th className="text-right px-2 py-2.5 font-medium">PRA m</th>
                <th className="text-right px-2 py-2.5 font-medium">C.UMA</th>
                <th className="text-right px-2 py-2.5 font-medium">PRE m</th>
                <th className="text-right px-2 py-2.5 font-medium">C.INSP</th>
                <th className="text-right px-2 py-2.5 font-medium">PV</th>
                <th className="text-right px-2 py-2.5 font-medium">PI</th>
                <th className="text-right px-2 py-2.5 font-medium">LIE</th>
                <th className="text-right px-2 py-2.5 font-medium">LIA</th>
                <th className="text-right px-2 py-2.5 font-medium">IHM</th>
                <th className="text-right px-2 py-2.5 font-medium">INT</th>
                <th className="text-left px-2 py-2.5 font-medium">Obs</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={18} className="text-center text-[#6b6b6b] py-10">
                    {loading ? 'Carregando...' : 'Nenhum lançamento de produção para esta obra. Use o formulário acima ou Importar CSV.'}
                  </td>
                </tr>
              )}
              {linhas.map((row) => (
                <tr key={row.id} className="border-t border-[#525252]/50 hover:bg-[#484848]/20">
                  <td className="px-2 py-1.5 text-[#e5e5e5] whitespace-nowrap">{fmtDate(row.data)}</td>
                  <td className="px-2 py-1.5"><TextCell value={row.nucleo} onCommit={(v) => atualizarLinha(row.id, { nucleo: v })} width="w-24" /></td>
                  <td className="px-2 py-1.5"><TextCell value={row.equipeNome} onCommit={(v) => atualizarLinha(row.id, { equipeNome: v })} width="w-28" /></td>
                  <td className="px-2 py-1.5"><TextCell value={row.rua} onCommit={(v) => atualizarLinha(row.id, { rua: v })} width="w-28" /></td>
                  <td className="px-2 py-1.5"><NumCell value={row.la} onCommit={(v) => atualizarLinha(row.id, { la: v })} /></td>
                  <td className="px-2 py-1.5"><NumCell value={row.le} onCommit={(v) => atualizarLinha(row.id, { le: v })} /></td>
                  <td className="px-2 py-1.5"><NumCell value={row.praM} onCommit={(v) => atualizarLinha(row.id, { praM: v })} /></td>
                  <td className="px-2 py-1.5"><NumCell value={row.cUma} onCommit={(v) => atualizarLinha(row.id, { cUma: v })} /></td>
                  <td className="px-2 py-1.5"><NumCell value={row.preM} onCommit={(v) => atualizarLinha(row.id, { preM: v })} /></td>
                  <td className="px-2 py-1.5"><NumCell value={row.cInsp} onCommit={(v) => atualizarLinha(row.id, { cInsp: v })} /></td>
                  <td className="px-2 py-1.5"><NumCell value={row.pv} onCommit={(v) => atualizarLinha(row.id, { pv: v })} /></td>
                  <td className="px-2 py-1.5"><NumCell value={row.pi} onCommit={(v) => atualizarLinha(row.id, { pi: v })} /></td>
                  <td className="px-2 py-1.5"><NumCell value={row.lie} onCommit={(v) => atualizarLinha(row.id, { lie: v })} /></td>
                  <td className="px-2 py-1.5"><NumCell value={row.lia} onCommit={(v) => atualizarLinha(row.id, { lia: v })} /></td>
                  <td className="px-2 py-1.5"><NumCell value={row.ihm} onCommit={(v) => atualizarLinha(row.id, { ihm: v })} /></td>
                  <td className="px-2 py-1.5"><NumCell value={row.intercept} onCommit={(v) => atualizarLinha(row.id, { intercept: v })} /></td>
                  <td className="px-2 py-1.5"><TextCell value={row.obs} onCommit={(v) => atualizarLinha(row.id, { obs: v })} width="w-32" /></td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => handleRemover(row)} className="p-1 text-[#a3a3a3] hover:text-red-400 transition-colors" title="Remover linha">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showImport && (
        <ImportarCsvProducaoModal
          onClose={() => setShowImport(false)}
          onImport={adicionarLinhasEmLote}
        />
      )}
    </div>
  )
}
