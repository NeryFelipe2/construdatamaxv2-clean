/**
 * MetaProgressoPanel — réplica funcional de PROD_META_30D/PREVISTO da
 * Execução_Relatórios: cadastro do "prometido SABESP" (meta 30 dias) +
 * rateio linear por dia útil (seg-sex) até hoje × realizado acumulado de
 * `producao_diaria` → desvio por dimensão (e por núcleo).
 *
 * Sem número inventado: sem meta cadastrada = aviso honesto (não zero fake).
 * Cálculo delegado a `computeMetaProgresso` (utils/metaProgresso.ts) — pura,
 * testada em separado, "hoje" sempre passado como parâmetro real (new Date()).
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, Plus, Target, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import type { MetaProducaoInput, MetaProducaoRow } from '@/hooks/useMetasProducao'
import type { ProducaoDiariaRow } from '@/hooks/useProducaoDiaria'
import {
  computeMetaProgresso,
  computeMetaProgressoPorNucleo,
  type MetaProgressoDimensao,
} from '../utils/metaProgresso'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function fmtM(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
function fmtUn(v: number): string {
  return Math.round(v).toLocaleString('pt-BR')
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

const textInputCls =
  'bg-[#484848] border border-[#5e5e5e] rounded px-1.5 py-1 text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50'
const numInputCls = `${textInputCls} w-24 text-right`

interface NovaMetaForm {
  nome: string
  periodoIni: string
  periodoFim: string
  ligAgua: string
  ligEsgoto: string
  redeAguaM: string
  redeEsgotoM: string
}

function formVazio(): NovaMetaForm {
  const hoje = todayStr()
  return { nome: '', periodoIni: hoje, periodoFim: hoje, ligAgua: '0', ligEsgoto: '0', redeAguaM: '0', redeEsgotoM: '0' }
}

function DimensaoCard({ label, unidade, dim, fmt }: { label: string; unidade: 'm' | 'un'; dim: MetaProgressoDimensao; fmt: (v: number) => string }) {
  const adiantado = dim.desvio >= 0
  return (
    <div className="rounded-lg border border-[#525252] bg-[#484848]/40 p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[#a3a3a3] font-semibold">{label}</span>
        {adiantado ? <TrendingUp size={13} className="text-[#22c55e]" /> : <TrendingDown size={13} className="text-rose-400" />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-[#f5f5f5] tabular-nums">{fmt(dim.realizado)}</span>
        <span className="text-[10px] text-[#6b6b6b]">
          {unidade} / meta {fmt(dim.meta)}
        </span>
      </div>
      <div className="text-[10px] text-[#a3a3a3] tabular-nums">Previsto até hoje: {fmt(dim.previsto)}</div>
      <div className={`text-xs font-semibold tabular-nums ${adiantado ? 'text-[#22c55e]' : 'text-rose-400'}`}>
        {adiantado ? '+' : ''}
        {fmt(dim.desvio)} {adiantado ? 'adiantado' : 'atrasado'}
      </div>
    </div>
  )
}

interface Props {
  metas: MetaProducaoRow[]
  loading: boolean
  error: string | null
  onAdicionar: (input: MetaProducaoInput) => Promise<boolean>
  onRemover: (id: string) => void
  producaoRows: ProducaoDiariaRow[] // linhas cruas de `producao_diaria` (não filtradas por período)
}

export function MetaProgressoPanel({ metas, loading, error, onAdicionar, onRemover, producaoRows }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NovaMetaForm>(() => formVazio())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const metaAtiva = metas.find((m) => m.id === selectedId) ?? metas[0] ?? null

  const producaoParaCalculo = useMemo(
    () => producaoRows.map((r) => ({ data: r.data, nucleo: r.nucleo, la: r.la, le: r.le, praM: r.praM, preM: r.preM })),
    [producaoRows],
  )

  const progresso = useMemo(() => {
    if (!metaAtiva) return null
    return computeMetaProgresso(
      {
        periodoIni: metaAtiva.periodoIni,
        periodoFim: metaAtiva.periodoFim,
        ligAgua: metaAtiva.ligAgua,
        ligEsgoto: metaAtiva.ligEsgoto,
        redeAguaM: metaAtiva.redeAguaM,
        redeEsgotoM: metaAtiva.redeEsgotoM,
      },
      producaoParaCalculo,
      todayStr(),
    )
  }, [metaAtiva, producaoParaCalculo])

  const progressoPorNucleo = useMemo(() => {
    if (!metaAtiva) return []
    return computeMetaProgressoPorNucleo(
      {
        periodoIni: metaAtiva.periodoIni,
        periodoFim: metaAtiva.periodoFim,
        ligAgua: metaAtiva.ligAgua,
        ligEsgoto: metaAtiva.ligEsgoto,
        redeAguaM: metaAtiva.redeAguaM,
        redeEsgotoM: metaAtiva.redeEsgotoM,
      },
      producaoParaCalculo,
      todayStr(),
    )
  }, [metaAtiva, producaoParaCalculo])

  async function handleCadastrar() {
    if (!form.nome.trim()) { setFormError('Informe um nome para a meta'); return }
    if (!form.periodoIni || !form.periodoFim) { setFormError('Informe o período (início e fim)'); return }
    if (form.periodoFim < form.periodoIni) { setFormError('O fim do período não pode ser antes do início'); return }
    setFormError(null)
    setSaving(true)
    const input: MetaProducaoInput = {
      nome: form.nome.trim(),
      periodoIni: form.periodoIni,
      periodoFim: form.periodoFim,
      ligAgua: Number(form.ligAgua) || 0,
      ligEsgoto: Number(form.ligEsgoto) || 0,
      redeAguaM: Number(form.redeAguaM) || 0,
      redeEsgotoM: Number(form.redeEsgotoM) || 0,
    }
    const ok = await onAdicionar(input)
    setSaving(false)
    if (ok) {
      setForm(formVazio())
      setShowForm(false)
    } else {
      setFormError('Erro ao gravar a meta. Veja o aviso abaixo.')
    }
  }

  function handleRemover(m: MetaProducaoRow) {
    if (!confirm(`Remover a meta "${m.nome}" (${fmtDate(m.periodoIni)} a ${fmtDate(m.periodoFim)})?`)) return
    if (selectedId === m.id) setSelectedId(null)
    onRemover(m.id)
  }

  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-[#f97316]" />
          <div>
            <h3 className="text-[#f5f5f5] text-sm font-semibold">Meta 30 dias — Prometido SABESP</h3>
            <p className="text-[#6b6b6b] text-[10px] mt-0.5">
              Previsto = rateio linear por dia útil (seg-sex; sábado não conta nesta versão) decorrido até hoje.
              Realizado = soma de produção diária lançada dentro do período da meta.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
          style={{ backgroundColor: '#f97316' }}
        >
          <Plus size={13} /> Nova meta
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2.5">
          <AlertTriangle size={13} className="text-rose-400 mt-0.5 shrink-0" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="bg-[#333333] rounded-lg border border-[#525252] p-3 space-y-2.5">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[#a3a3a3] text-[10px] mb-1">Nome da meta</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="ex. Meta 30 dias — julho/26"
                className={`${textInputCls} w-full`}
              />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-[10px] mb-1">Início</label>
              <input type="date" value={form.periodoIni} onChange={(e) => setForm((f) => ({ ...f, periodoIni: e.target.value }))} className={textInputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-[10px] mb-1">Fim</label>
              <input type="date" value={form.periodoFim} onChange={(e) => setForm((f) => ({ ...f, periodoFim: e.target.value }))} className={textInputCls} />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {([
              ['ligAgua', 'Lig. água (un)'],
              ['ligEsgoto', 'Lig. esgoto (un)'],
              ['redeAguaM', 'Rede água (m)'],
              ['redeEsgotoM', 'Rede esgoto (m)'],
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
            <button
              onClick={handleCadastrar}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#f97316' }}
            >
              {saving ? 'Salvando...' : 'Cadastrar meta'}
            </button>
          </div>
          {formError && <p className="text-rose-400 text-xs">{formError}</p>}
        </div>
      )}

      {metas.length === 0 ? (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5">
          <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-200/90">
            {loading
              ? 'Carregando metas...'
              : 'Nenhuma meta cadastrada para esta obra. Cadastre a meta de 30 dias combinada com a Sabesp (botão "Nova meta") para ver previsto × realizado. Nada aqui é estimado ou de exemplo.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[#a3a3a3] text-[10px] uppercase tracking-wider">Meta</label>
            <select
              value={metaAtiva?.id ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className={`${textInputCls} min-w-[240px]`}
            >
              {metas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} ({fmtDate(m.periodoIni)} a {fmtDate(m.periodoFim)})
                </option>
              ))}
            </select>
            {metaAtiva && (
              <button
                onClick={() => handleRemover(metaAtiva)}
                className="flex items-center gap-1 text-[#a3a3a3] hover:text-rose-400 text-xs transition-colors"
                title="Remover meta"
              >
                <Trash2 size={12} /> Remover
              </button>
            )}
          </div>

          {progresso && metaAtiva && (
            <>
              <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
                <span>
                  Dias úteis decorridos: <b className="text-[#f5f5f5] tabular-nums">{progresso.diasUteisDecorridos}</b> de{' '}
                  <b className="text-[#f5f5f5] tabular-nums">{progresso.diasUteisTotal}</b> (
                  {(progresso.fracaoDecorrida * 100).toFixed(0)}%)
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[#525252] overflow-hidden max-w-[220px]">
                  <div
                    className="h-full bg-[#f97316] rounded-full"
                    style={{ width: `${Math.min(100, progresso.fracaoDecorrida * 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <DimensaoCard label="Lig. Água" unidade="un" dim={progresso.ligAgua} fmt={fmtUn} />
                <DimensaoCard label="Lig. Esgoto" unidade="un" dim={progresso.ligEsgoto} fmt={fmtUn} />
                <DimensaoCard label="Rede Água" unidade="m" dim={progresso.redeAguaM} fmt={fmtM} />
                <DimensaoCard label="Rede Esgoto" unidade="m" dim={progresso.redeEsgotoM} fmt={fmtM} />
              </div>

              {progressoPorNucleo.length > 1 && (
                <div className="overflow-x-auto">
                  <p className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold mb-1.5">Por núcleo</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[#6b6b6b] text-[10px] border-b border-[#525252] uppercase tracking-wide">
                        <th className="text-left px-2 py-1.5 font-medium">Núcleo</th>
                        <th className="text-right px-2 py-1.5 font-medium">LA desvio</th>
                        <th className="text-right px-2 py-1.5 font-medium">LE desvio</th>
                        <th className="text-right px-2 py-1.5 font-medium">Rede água desvio (m)</th>
                        <th className="text-right px-2 py-1.5 font-medium">Rede esgoto desvio (m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressoPorNucleo.map((p) => (
                        <tr key={p.nucleo} className="border-t border-[#525252]/50">
                          <td className="px-2 py-1.5 text-[#e5e5e5]">{p.nucleo}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${p.ligAgua.desvio >= 0 ? 'text-[#22c55e]' : 'text-rose-400'}`}>
                            {fmtUn(p.ligAgua.desvio)}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${p.ligEsgoto.desvio >= 0 ? 'text-[#22c55e]' : 'text-rose-400'}`}>
                            {fmtUn(p.ligEsgoto.desvio)}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${p.redeAguaM.desvio >= 0 ? 'text-[#22c55e]' : 'text-rose-400'}`}>
                            {fmtM(p.redeAguaM.desvio)}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${p.redeEsgotoM.desvio >= 0 ? 'text-[#22c55e]' : 'text-rose-400'}`}>
                            {fmtM(p.redeEsgotoM.desvio)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
