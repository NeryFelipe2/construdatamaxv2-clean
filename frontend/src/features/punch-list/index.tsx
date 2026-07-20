import { useMemo, useState } from "react"
import { CheckSquare, Plus, X, Filter, AlertTriangle, RotateCw, Undo2, CheckCircle2 } from "lucide-react"
import { useProjectContext } from "@/store/projectContext"
import { supabase } from "@/lib/supabase"
import { useCampoWhatsapp } from "@/hooks/useCampoWhatsapp"
import type { OcorrenciaObra } from "@/hooks/useCampoWhatsapp"

// Punch List formal (com foto antes/depois e prazo dedicado) ainda não existe:
// a tabela `punch_list_items` está no banco mas com 0 registros e nenhuma tela
// grava nela. Esta página usa a fonte real que já existe — `ocorrencias_obra`,
// as mesmas ocorrências extraídas de WhatsApp/RDO que alimentam a tela Campo
// WhatsApp (mesmo hook `useCampoWhatsapp`) — e assume isso explicitamente na
// tela em vez de fingir que são itens de punch list formais.
const TIPO_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  vazamento: { label: "Vazamento", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  embargo: { label: "Embargo", bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  falta_material: { label: "Falta material", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  falta_epi: { label: "Falta EPI", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  seguranca: { label: "Segurança", bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  reclamacao: { label: "Reclamação", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  manutencao: { label: "Manutenção", bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
  pendencia_admin: { label: "Pend. admin", bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" },
  outro: { label: "Outro", bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/20" },
}

function tipoMeta(tipo: string | null) {
  return TIPO_META[tipo ?? ""] ?? TIPO_META.outro
}

const STATUS_COLORS = {
  aberto: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  resolvido: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
}

/** 'YYYY-MM-DD' → 'dd/mm/aaaa' sem passar por new Date() (evita shift de timezone). */
function fmtData(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.slice(0, 10).split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

const FORM_INICIAL = { descricao: "", tipo: "outro", nucleo: "", rua: "", reportado_por: "" }

export function PunchListPage() {
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const { ocorrencias, loading, error, reload, marcarOcorrencia, criarOcorrencia } = useCampoWhatsapp()

  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState<"all" | "aberto" | "resolvido">("all")
  const [filterNucleo, setFilterNucleo] = useState<string>("all")
  const [filterTipo, setFilterTipo] = useState<string>("all")
  const [form, setForm] = useState(FORM_INICIAL)

  const nucleosDisponiveis = useMemo(() => {
    const set = new Set<string>()
    ocorrencias.forEach((o) => { if (o.nucleo) set.add(o.nucleo) })
    return Array.from(set).sort()
  }, [ocorrencias])

  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>()
    ocorrencias.forEach((o) => { if (o.tipo) set.add(o.tipo) })
    return Array.from(set).sort()
  }, [ocorrencias])

  const filtered = useMemo(() => ocorrencias.filter((o) => {
    if (filterStatus === "aberto" && o.resolvida) return false
    if (filterStatus === "resolvido" && !o.resolvida) return false
    if (filterNucleo !== "all" && o.nucleo !== filterNucleo) return false
    if (filterTipo !== "all" && o.tipo !== filterTipo) return false
    return true
  }), [ocorrencias, filterStatus, filterNucleo, filterTipo])

  const abertos = ocorrencias.filter((o) => !o.resolvida).length
  const resolvidos = ocorrencias.length - abertos

  async function addItem() {
    if (!form.descricao.trim() || saving) return
    setSaving(true)
    const ok = await criarOcorrencia({
      descricao: form.descricao.trim(),
      tipo: form.tipo,
      nucleo: form.nucleo.trim() || null,
      rua: form.rua.trim() || null,
      reportado_por: form.reportado_por.trim() || null,
      projeto_id: activeProjectId,
    })
    setSaving(false)
    if (ok) {
      setForm(FORM_INICIAL)
      setShowNew(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center"><CheckSquare size={22} className="text-teal-400" /></div>
        <div>
          <h1 className="text-lg font-bold text-[#e4f2f8]">Punch List</h1>
          <p className="text-xs text-[#5a8caa]">Pendências e ocorrências reais registradas em campo</p>
        </div>
        <button
          onClick={() => reload()}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0d2040] text-[#8fb3c8] border border-[#20406a] text-xs font-medium hover:bg-[#16305a] transition-colors"
        >
          <RotateCw size={14} className={loading ? "animate-spin" : ""} /> Recarregar
        </button>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xs font-medium hover:bg-teal-500/30 transition-colors">
          <Plus size={14} /> Novo Item
        </button>
      </div>

      {/* Aviso honesto da fonte real dos dados */}
      <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3.5">
        <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-100/90 leading-relaxed">
          <strong className="text-amber-300">Fonte real:</strong> os {ocorrencias.length} itens abaixo vêm da tabela{" "}
          <code className="text-amber-300">ocorrencias_obra</code> — ocorrências extraídas de RDO/WhatsApp de campo
          (mesma fonte da tela Campo WhatsApp). Não são um punch list formal com foto antes/depois e prazo dedicado:
          a tabela <code className="text-amber-300">punch_list_items</code> existe no banco mas está vazia (0 registros)
          e nenhuma tela grava nela.
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle size={14} /> {error}</p>
      )}

      {!supabase && (
        <p className="text-xs text-amber-400 flex items-center gap-1.5"><AlertTriangle size={14} /> Sem conexão Supabase configurada — nada para mostrar.</p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
          <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">Abertos</div>
          <div className="text-2xl font-bold text-rose-400">{abertos}</div>
        </div>
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
          <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">Resolvidos</div>
          <div className="text-2xl font-bold text-green-400">{resolvidos}</div>
        </div>
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
          <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">Total</div>
          <div className="text-2xl font-bold text-[#e4f2f8]">{ocorrencias.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <Filter size={14} className="text-[#5a8caa]" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="bg-[#112645] border border-[#20406a] rounded-lg px-3 py-1.5 text-xs text-[#e4f2f8]">
          <option value="all">Todos os status</option>
          <option value="aberto">Aberto</option>
          <option value="resolvido">Resolvido</option>
        </select>
        <select value={filterNucleo} onChange={(e) => setFilterNucleo(e.target.value)}
          className="bg-[#112645] border border-[#20406a] rounded-lg px-3 py-1.5 text-xs text-[#e4f2f8]">
          <option value="all">Todos os núcleos</option>
          {nucleosDisponiveis.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
          className="bg-[#112645] border border-[#20406a] rounded-lg px-3 py-1.5 text-xs text-[#e4f2f8]">
          <option value="all">Todos os tipos</option>
          {tiposDisponiveis.map((t) => <option key={t} value={t}>{tipoMeta(t).label}</option>)}
        </select>
        <span className="text-xs text-[#5a8caa] ml-auto">{filtered.length} de {ocorrencias.length}</span>
      </div>

      {/* New Item Form */}
      {showNew && (
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-teal-400">Nova ocorrência</h3>
            <button onClick={() => setShowNew(false)} className="text-[#6b6b6b] hover:text-white"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input placeholder="Descrição do problema" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8] placeholder-[#5a8caa] md:col-span-2" />
            <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8]">
              {Object.entries(TIPO_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input placeholder="Núcleo (ex.: Boi Malhado)" value={form.nucleo} onChange={(e) => setForm((f) => ({ ...f, nucleo: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8] placeholder-[#5a8caa]" />
            <input placeholder="Rua / trecho / PV" value={form.rua} onChange={(e) => setForm((f) => ({ ...f, rua: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8] placeholder-[#5a8caa]" />
            <input placeholder="Reportado por" value={form.reportado_por} onChange={(e) => setForm((f) => ({ ...f, reportado_por: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8] placeholder-[#5a8caa]" />
          </div>
          <button onClick={addItem} disabled={!form.descricao.trim() || saving}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? "Salvando…" : "Adicionar"}
          </button>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-2">
        {!loading && filtered.length === 0 && <div className="text-center py-8 text-[#5a8caa] text-sm">Nenhum item encontrado.</div>}
        {filtered.map((item: OcorrenciaObra) => {
          const sc = item.resolvida ? STATUS_COLORS.resolvido : STATUS_COLORS.aberto
          const tm = tipoMeta(item.tipo)
          return (
            <div key={item.id} className={`bg-[#112645] border border-[#20406a] rounded-xl p-4 transition-opacity ${item.resolvida ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${tm.bg} ${tm.text} border ${tm.border}`}>{tm.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${sc.bg} ${sc.text} border ${sc.border}`}>
                      {item.resolvida ? "Resolvido" : "Aberto"}
                    </span>
                    <span className="text-[10px] text-[#5a8caa] font-mono">{fmtData(item.data)}</span>
                  </div>
                  <div className={`text-sm font-medium mt-1.5 ${item.resolvida ? "text-[#8fb3c8] line-through" : "text-[#e4f2f8]"}`}>
                    {item.descricao ?? "—"}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-[#5a8caa] flex-wrap">
                    {(item.nucleo || item.rua) && <span>{[item.nucleo, item.rua].filter(Boolean).join(" · ")}</span>}
                    {item.reportado_por && <span>Reportado por: {item.reportado_por}</span>}
                    {item.origem_fonte && <span className="truncate max-w-[280px]" title={item.origem_fonte}>Fonte: {item.origem_fonte}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => marcarOcorrencia(item.id, !item.resolvida)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
                      item.resolvida
                        ? "bg-[#20406a] text-[#8fb3c8] hover:bg-[#2a4a6a]"
                        : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                    }`}
                  >
                    {item.resolvida ? <><Undo2 size={12} /> Reabrir</> : <><CheckCircle2 size={12} /> Resolver</>}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
