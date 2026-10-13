/**
 * LigacoesOsTab — aba "Ligações & OS" (missão E5, evolução de "Levantamento de Ligações - OS SISTEMA").
 * (a) Matriz núcleo × mês: OS baixadas (LA/LE) vs ligações cadastradas + % baixado.
 * (b) Pendências por endereço com motivo, marcação de resolvida.
 * Nada de número inventado: sem dado real = vazio + aviso honesto. PII nunca (ver parseCsvLigacoes.ts).
 */
import { useState } from 'react'
import { Link2, ClipboardList, Plus, Upload, Trash2, CheckSquare, Square, AlertTriangle, Droplets, Waves } from 'lucide-react'
import { useLigacoesOs, type NovaLinhaMatriz, type NovaPendencia } from '@/hooks/useLigacoesOs'
import { ImportarCsvLigacoesModal } from './ImportarCsvLigacoesModal'

function pct(la: number, le: number, cadastradas: number): string {
  if (!cadastradas || cadastradas <= 0) return '—'
  return `${(((la + le) / cadastradas) * 100).toFixed(0)}%`
}

function mesLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/)
  if (!m) return iso
  return `${m[2]}/${m[1]}`
}

interface Props {
  projetoId: string | null
  podeUsar: boolean
  motivoBloqueio?: string
}

export function LigacoesOsTab({ projetoId, podeUsar, motivoBloqueio }: Props) {
  const { matriz, pendencias, loading, error, salvarLinhaMatriz, excluirLinhaMatriz, importarMatrizCsv, adicionarPendencia, toggleResolvida, excluirPendencia, importarPendenciasCsv } = useLigacoesOs(projetoId)
  const [showImportMatriz, setShowImportMatriz] = useState(false)
  const [showImportPend, setShowImportPend] = useState(false)

  const [formMatriz, setFormMatriz] = useState({ nucleo: '', mes: '', la: '', le: '', cadastradas: '' })
  const [formPend, setFormPend] = useState({ nucleo: '', endereco: '', la: '', le: '', tipo: 'agua', motivo: '' })

  if (!podeUsar) {
    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <div className="max-w-md text-center flex flex-col items-center gap-3">
          <AlertTriangle size={28} className="text-amber-400" />
          <p className="text-sm font-bold text-[#f5f5f5]">Ligações & OS indisponível</p>
          <p className="text-xs text-[#8a8a8a]">{motivoBloqueio ?? 'Selecione um projeto ativo e desative o Modo Demonstração.'}</p>
        </div>
      </div>
    )
  }

  async function handleAddMatriz() {
    const la = Number(formMatriz.la) || 0
    const le = Number(formMatriz.le) || 0
    const cadastradas = Number(formMatriz.cadastradas) || 0
    if (!formMatriz.nucleo.trim() || !formMatriz.mes) return
    const linha: NovaLinhaMatriz = { nucleo: formMatriz.nucleo.trim(), mes: formMatriz.mes, la, le, cadastradas }
    await salvarLinhaMatriz(linha)
    setFormMatriz({ nucleo: '', mes: '', la: '', le: '', cadastradas: '' })
  }

  async function handleAddPend() {
    if (!formPend.nucleo.trim() || !formPend.endereco.trim() || !formPend.motivo.trim()) return
    const p: NovaPendencia = {
      nucleo: formPend.nucleo.trim(),
      endereco: formPend.endereco.trim(),
      la: Number(formPend.la) || 0,
      le: Number(formPend.le) || 0,
      tipo: formPend.tipo,
      motivo: formPend.motivo.trim(),
    }
    await adicionarPendencia(p)
    setFormPend({ nucleo: '', endereco: '', la: '', le: '', tipo: 'agua', motivo: '' })
  }

  const pendAbertas = pendencias.filter((p) => !p.resolvida)
  const pendResolvidas = pendencias.filter((p) => p.resolvida)

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
      {error && (
        <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2.5">
          <AlertTriangle size={13} className="text-rose-400 mt-0.5 shrink-0" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {/* ═══ Matriz núcleo × mês ═══ */}
      <section className="rounded-xl border border-[#3f3f3f] bg-[#2f2f2f] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#3f3f3f] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Link2 size={15} className="text-[#38bdf8]" />
            <h3 className="text-sm font-bold text-[#f5f5f5]">Matriz Núcleo × Mês — OS baixadas</h3>
          </div>
          <button
            onClick={() => setShowImportMatriz(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#38bdf8]/10 text-[#38bdf8] rounded-lg text-xs font-semibold hover:bg-[#38bdf8]/20 transition-colors"
          >
            <Upload size={12} /> Importar CSV
          </button>
        </div>

        {/* form adicionar linha */}
        <div className="px-5 py-3 border-b border-[#3f3f3f] bg-[#2a2a2a] flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#8a8a8a] uppercase font-semibold">Núcleo</label>
            <input value={formMatriz.nucleo} onChange={(e) => setFormMatriz((f) => ({ ...f, nucleo: e.target.value }))} placeholder="Boi Malhado" className="w-36 rounded-md px-2 py-1.5 text-xs bg-[#1f1f1f] border border-[#3f3f3f] text-[#f5f5f5] outline-none focus:border-[#38bdf8]/60" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#8a8a8a] uppercase font-semibold">Mês</label>
            <input type="month" value={formMatriz.mes} onChange={(e) => setFormMatriz((f) => ({ ...f, mes: e.target.value }))} className="w-32 rounded-md px-2 py-1.5 text-xs bg-[#1f1f1f] border border-[#3f3f3f] text-[#f5f5f5] outline-none focus:border-[#38bdf8]/60" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#8a8a8a] uppercase font-semibold">LA</label>
            <input type="number" min={0} value={formMatriz.la} onChange={(e) => setFormMatriz((f) => ({ ...f, la: e.target.value }))} placeholder="0" className="w-20 rounded-md px-2 py-1.5 text-xs bg-[#1f1f1f] border border-[#3f3f3f] text-[#f5f5f5] outline-none focus:border-[#38bdf8]/60" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#8a8a8a] uppercase font-semibold">LE</label>
            <input type="number" min={0} value={formMatriz.le} onChange={(e) => setFormMatriz((f) => ({ ...f, le: e.target.value }))} placeholder="0" className="w-20 rounded-md px-2 py-1.5 text-xs bg-[#1f1f1f] border border-[#3f3f3f] text-[#f5f5f5] outline-none focus:border-[#38bdf8]/60" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#8a8a8a] uppercase font-semibold">Cadastradas</label>
            <input type="number" min={0} value={formMatriz.cadastradas} onChange={(e) => setFormMatriz((f) => ({ ...f, cadastradas: e.target.value }))} placeholder="0" className="w-24 rounded-md px-2 py-1.5 text-xs bg-[#1f1f1f] border border-[#3f3f3f] text-[#f5f5f5] outline-none focus:border-[#38bdf8]/60" />
          </div>
          <button
            onClick={handleAddMatriz}
            disabled={!formMatriz.nucleo.trim() || !formMatriz.mes}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#38bdf8] text-[#0a1628] rounded-md text-xs font-semibold hover:bg-[#5fcaf8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={12} /> Adicionar
          </button>
        </div>

        {loading && <div className="text-[12px] text-[#8a8a8a] text-center py-6">Carregando…</div>}
        {!loading && matriz.length === 0 && (
          <div className="text-[12px] text-[#6b6b6b] text-center py-8">
            Nenhuma linha cadastrada ainda. Sem dado real, nada é estimado — cadastre pelo formulário acima ou importe um CSV.
          </div>
        )}
        {!loading && matriz.length > 0 && (
          <table className="w-full text-xs">
            <thead className="bg-[#252525] text-[#8a8a8a] uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-2.5">Núcleo</th>
                <th className="text-left px-5 py-2.5">Mês</th>
                <th className="text-right px-5 py-2.5">LA baixadas</th>
                <th className="text-right px-5 py-2.5">LE baixadas</th>
                <th className="text-right px-5 py-2.5">Cadastradas</th>
                <th className="text-right px-5 py-2.5">% baixado</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {matriz.map((m) => (
                <tr key={m.id} className="border-t border-[#3f3f3f]/50 hover:bg-[#333333]">
                  <td className="px-5 py-2 text-[#f5f5f5] font-medium">{m.nucleo || '—'}</td>
                  <td className="px-5 py-2 font-mono text-[#a3a3a3]">{mesLabel(m.mes)}</td>
                  <td className="px-5 py-2 text-right font-mono text-[#38bdf8]">{m.la}</td>
                  <td className="px-5 py-2 text-right font-mono text-[#a78bfa]">{m.le}</td>
                  <td className="px-5 py-2 text-right font-mono text-[#f5f5f5]">{m.cadastradas}</td>
                  <td className="px-5 py-2 text-right font-mono font-bold text-emerald-400">{pct(m.la, m.le, m.cadastradas)}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => excluirLinhaMatriz(m.id)} title="Excluir linha" className="text-[#8a8a8a] hover:text-rose-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ═══ Pendências ═══ */}
      <section className="rounded-xl border border-[#3f3f3f] bg-[#2f2f2f] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#3f3f3f] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList size={15} className="text-[#f97316]" />
            <h3 className="text-sm font-bold text-[#f5f5f5]">Pendências por endereço</h3>
            {pendAbertas.length > 0 && (
              <span className="text-[10px] font-bold text-[#f97316] bg-[#f97316]/10 border border-[#f97316]/30 rounded-full px-2 py-0.5">{pendAbertas.length} aberta{pendAbertas.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <button
            onClick={() => setShowImportPend(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#38bdf8]/10 text-[#38bdf8] rounded-lg text-xs font-semibold hover:bg-[#38bdf8]/20 transition-colors"
          >
            <Upload size={12} /> Importar CSV
          </button>
        </div>

        {/* form adicionar pendência */}
        <div className="px-5 py-3 border-b border-[#3f3f3f] bg-[#2a2a2a] flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#8a8a8a] uppercase font-semibold">Núcleo</label>
            <input value={formPend.nucleo} onChange={(e) => setFormPend((f) => ({ ...f, nucleo: e.target.value }))} placeholder="Boi Malhado" className="w-32 rounded-md px-2 py-1.5 text-xs bg-[#1f1f1f] border border-[#3f3f3f] text-[#f5f5f5] outline-none focus:border-[#38bdf8]/60" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#8a8a8a] uppercase font-semibold">Endereço</label>
            <input value={formPend.endereco} onChange={(e) => setFormPend((f) => ({ ...f, endereco: e.target.value }))} placeholder="Rua das Flores 120" className="w-48 rounded-md px-2 py-1.5 text-xs bg-[#1f1f1f] border border-[#3f3f3f] text-[#f5f5f5] outline-none focus:border-[#38bdf8]/60" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#8a8a8a] uppercase font-semibold">LA</label>
            <input type="number" min={0} value={formPend.la} onChange={(e) => setFormPend((f) => ({ ...f, la: e.target.value }))} placeholder="0" className="w-16 rounded-md px-2 py-1.5 text-xs bg-[#1f1f1f] border border-[#3f3f3f] text-[#f5f5f5] outline-none focus:border-[#38bdf8]/60" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#8a8a8a] uppercase font-semibold">LE</label>
            <input type="number" min={0} value={formPend.le} onChange={(e) => setFormPend((f) => ({ ...f, le: e.target.value }))} placeholder="0" className="w-16 rounded-md px-2 py-1.5 text-xs bg-[#1f1f1f] border border-[#3f3f3f] text-[#f5f5f5] outline-none focus:border-[#38bdf8]/60" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#8a8a8a] uppercase font-semibold">Tipo</label>
            <select value={formPend.tipo} onChange={(e) => setFormPend((f) => ({ ...f, tipo: e.target.value }))} className="w-24 rounded-md px-2 py-1.5 text-xs bg-[#1f1f1f] border border-[#3f3f3f] text-[#f5f5f5] outline-none focus:border-[#38bdf8]/60">
              <option value="agua">Água</option>
              <option value="esgoto">Esgoto</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-[10px] text-[#8a8a8a] uppercase font-semibold">Motivo</label>
            <input value={formPend.motivo} onChange={(e) => setFormPend((f) => ({ ...f, motivo: e.target.value }))} placeholder="Morador ausente" className="w-full rounded-md px-2 py-1.5 text-xs bg-[#1f1f1f] border border-[#3f3f3f] text-[#f5f5f5] outline-none focus:border-[#38bdf8]/60" />
          </div>
          <button
            onClick={handleAddPend}
            disabled={!formPend.nucleo.trim() || !formPend.endereco.trim() || !formPend.motivo.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#38bdf8] text-[#0a1628] rounded-md text-xs font-semibold hover:bg-[#5fcaf8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={12} /> Adicionar
          </button>
        </div>

        {loading && <div className="text-[12px] text-[#8a8a8a] text-center py-6">Carregando…</div>}
        {!loading && pendencias.length === 0 && (
          <div className="text-[12px] text-[#6b6b6b] text-center py-8">
            Nenhuma pendência cadastrada ainda. Cadastre pelo formulário acima ou importe um CSV.
          </div>
        )}
        {!loading && pendencias.length > 0 && (
          <div className="flex flex-col">
            {[...pendAbertas, ...pendResolvidas].map((p) => (
              <div key={p.id} className={`flex items-center gap-3 px-5 py-2.5 border-t border-[#3f3f3f]/50 ${p.resolvida ? 'opacity-50' : ''}`}>
                <button onClick={() => toggleResolvida(p.id)} title={p.resolvida ? 'Marcar como aberta' : 'Marcar como resolvida'} className="shrink-0 text-[#8a8a8a] hover:text-emerald-400 transition-colors">
                  {p.resolvida ? <CheckSquare size={16} className="text-emerald-400" /> : <Square size={16} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap text-[12px]">
                    <span className="font-bold text-[#f5f5f5]">{p.nucleo || '—'}</span>
                    <span className="text-[#a3a3a3]">{p.endereco}</span>
                    {p.tipo === 'agua' && <span className="flex items-center gap-1 text-[10px] text-[#38bdf8]"><Droplets size={10} /> água</span>}
                    {p.tipo === 'esgoto' && <span className="flex items-center gap-1 text-[10px] text-[#a78bfa]"><Waves size={10} /> esgoto</span>}
                    {(p.la > 0 || p.le > 0) && <span className="text-[10px] text-[#7a7a7a]">LA {p.la} · LE {p.le}</span>}
                  </div>
                  {p.motivo && <div className="text-[11px] text-[#7a7a7a] mt-0.5">{p.motivo}</div>}
                </div>
                <button onClick={() => excluirPendencia(p.id)} title="Excluir pendência" className="shrink-0 text-[#8a8a8a] hover:text-rose-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {showImportMatriz && (
        <ImportarCsvLigacoesModal
          kind="matriz"
          onClose={() => setShowImportMatriz(false)}
          onImport={(rows) => importarMatrizCsv(rows as NovaLinhaMatriz[])}
        />
      )}
      {showImportPend && (
        <ImportarCsvLigacoesModal
          kind="pendencias"
          onClose={() => setShowImportPend(false)}
          onImport={(rows) => importarPendenciasCsv(rows as NovaPendencia[])}
        />
      )}
    </div>
  )
}
