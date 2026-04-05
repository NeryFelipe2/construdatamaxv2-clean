import { useState } from "react"
import { CheckSquare, Plus, Camera, X, Filter } from "lucide-react"
import { useProjectContext } from "@/store/projectContext"

interface PunchItem {
  id: string
  descricao: string
  localizacao: string
  responsavel: string
  prazo: string
  status: "aberto" | "em_correcao" | "resolvido"
  foto_antes: string | null
  foto_depois: string | null
  frente_id: string | null
  created_at: string
}

const DEMO_ITEMS: PunchItem[] = [
  { id: "p-1", descricao: "PV-23 com tampa quebrada", localizacao: "Rua B, esquina Beco do Sheike", responsavel: "Bruno", prazo: "2026-04-10", status: "aberto", foto_antes: null, foto_depois: null, frente_id: "f-1", created_at: "2026-04-03" },
  { id: "p-2", descricao: "Reaterro incompleto trecho T-15", localizacao: "Rua C, proximo ao 608", responsavel: "Guajeru", prazo: "2026-04-08", status: "em_correcao", foto_antes: null, foto_depois: null, frente_id: "f-1", created_at: "2026-04-01" },
  { id: "p-3", descricao: "Ligacao domiciliar casa 34 com vazamento", localizacao: "Rua A, casa 34", responsavel: "Alexandro", prazo: "2026-04-06", status: "resolvido", foto_antes: null, foto_depois: null, frente_id: "f-2", created_at: "2026-03-28" },
]

const STATUS_COLORS = {
  aberto: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  em_correcao: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
  resolvido: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
}

export function PunchListPage() {
  const frentes = useProjectContext(s => s.frentesDoProjetoAtivo())
  const [items, setItems] = useState<PunchItem[]>(DEMO_ITEMS)
  const [showNew, setShowNew] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterFrente, setFilterFrente] = useState<string>("all")
  const [form, setForm] = useState({ descricao: "", localizacao: "", responsavel: "", prazo: "", frente_id: "" })

  function addItem() {
    if (!form.descricao) return
    setItems(its => [...its, {
      id: `p-${Date.now()}`, ...form, status: "aberto", foto_antes: null, foto_depois: null,
      frente_id: form.frente_id || null, created_at: new Date().toISOString().slice(0, 10),
    }])
    setForm({ descricao: "", localizacao: "", responsavel: "", prazo: "", frente_id: "" })
    setShowNew(false)
  }

  function updateStatus(id: string, status: PunchItem["status"]) {
    setItems(its => its.map(i => i.id === id ? { ...i, status } : i))
  }

  const filtered = items.filter(i => {
    if (filterStatus !== "all" && i.status !== filterStatus) return false
    if (filterFrente !== "all" && i.frente_id !== filterFrente) return false
    return true
  })

  const abertos = items.filter(i => i.status === "aberto").length
  const emCorrecao = items.filter(i => i.status === "em_correcao").length
  const resolvidos = items.filter(i => i.status === "resolvido").length

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center"><CheckSquare size={22} className="text-teal-400" /></div>
        <div>
          <h1 className="text-lg font-bold text-[#e4f2f8]">Punch List</h1>
          <p className="text-xs text-[#5a8caa]">Pendencias e nao conformidades</p>
        </div>
        <button onClick={() => setShowNew(true)} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xs font-medium hover:bg-teal-500/30 transition-colors">
          <Plus size={14} /> Novo Item
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
          <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">Abertos</div>
          <div className="text-2xl font-bold text-rose-400">{abertos}</div>
        </div>
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
          <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">Em Correcao</div>
          <div className="text-2xl font-bold text-yellow-400">{emCorrecao}</div>
        </div>
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
          <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">Resolvidos</div>
          <div className="text-2xl font-bold text-green-400">{resolvidos}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <Filter size={14} className="text-[#5a8caa]" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-[#112645] border border-[#20406a] rounded-lg px-3 py-1.5 text-xs text-[#e4f2f8]">
          <option value="all">Todos os status</option>
          <option value="aberto">Aberto</option>
          <option value="em_correcao">Em Correcao</option>
          <option value="resolvido">Resolvido</option>
        </select>
        <select value={filterFrente} onChange={e => setFilterFrente(e.target.value)}
          className="bg-[#112645] border border-[#20406a] rounded-lg px-3 py-1.5 text-xs text-[#e4f2f8]">
          <option value="all">Todas as frentes</option>
          {frentes.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </div>

      {/* New Item Form */}
      {showNew && (
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-teal-400">Novo Item Punch List</h3>
            <button onClick={() => setShowNew(false)} className="text-[#6b6b6b] hover:text-white"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input placeholder="Descricao do problema" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8] placeholder-[#5a8caa] md:col-span-2" />
            <input placeholder="Localizacao (rua, trecho, PV)" value={form.localizacao} onChange={e => setForm(f => ({ ...f, localizacao: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8] placeholder-[#5a8caa]" />
            <input placeholder="Responsavel" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8] placeholder-[#5a8caa]" />
            <input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8]" />
            <select value={form.frente_id} onChange={e => setForm(f => ({ ...f, frente_id: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8]">
              <option value="">Selecionar frente</option>
              {frentes.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <button onClick={addItem} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 transition-colors">Adicionar</button>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-2">
        {filtered.length === 0 && <div className="text-center py-8 text-[#5a8caa] text-sm">Nenhum item encontrado.</div>}
        {filtered.map(item => {
          const sc = STATUS_COLORS[item.status]
          const frente = frentes.find(f => f.id === item.frente_id)
          return (
            <div key={item.id} className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[#e4f2f8]">{item.descricao}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${sc.bg} ${sc.text} border ${sc.border}`}>
                      {item.status === "em_correcao" ? "Em Correcao" : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-[#5a8caa]">
                    <span>{item.localizacao}</span>
                    <span>Resp: {item.responsavel}</span>
                    <span>Prazo: {item.prazo}</span>
                    {frente && <span className="px-1.5 py-0.5 rounded bg-[#20406a] text-[10px]">{frente.nome}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {item.status === "aberto" && (
                    <button onClick={() => updateStatus(item.id, "em_correcao")} className="px-2 py-1 rounded text-[10px] bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors">Iniciar</button>
                  )}
                  {item.status === "em_correcao" && (
                    <button onClick={() => updateStatus(item.id, "resolvido")} className="px-2 py-1 rounded text-[10px] bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">Resolver</button>
                  )}
                  {item.status === "resolvido" && (
                    <button onClick={() => updateStatus(item.id, "aberto")} className="px-2 py-1 rounded text-[10px] bg-[#20406a] text-[#8fb3c8] hover:bg-[#2a4a6a] transition-colors">Reabrir</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
