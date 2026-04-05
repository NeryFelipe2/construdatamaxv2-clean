import { useState, useMemo } from "react"
import { UserCog, Plus, Phone, Trash2, Edit2, Search, X } from "lucide-react"
import { useProjectContext } from "@/store/projectContext"
import { useContatosStore } from "@/store/contatosStore"
import type { DbContato } from "@/lib/supabase"

const CARGOS = ["Encarregado", "Engenheiro", "Tecnico Seg.", "Mestre", "Apontador", "Operador", "Motorista", "Pedreiro", "Encanador"]

export function GestaoContatosPage() {
  const activeProjectId = useProjectContext(s => s.activeProjectId)
  const allFrentes = useProjectContext(s => s.frentes)
  const allContatos = useContatosStore(s => s.contatos)
  const addContato = useContatosStore(s => s.addContato)
  const updateContato = useContatosStore(s => s.updateContato)
  const removeContato = useContatosStore(s => s.removeContato)
  const frentes = useMemo(() => allFrentes.filter(f => f.projeto_id === activeProjectId), [allFrentes, activeProjectId])
  const contatos = useMemo(() => allContatos.filter(c => c.projeto_id === activeProjectId), [allContatos, activeProjectId])

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [form, setForm] = useState({ nome: "", cargo: "Encarregado", telefone: "", frente_id: "" })

  function resetForm() { setForm({ nome: "", cargo: "Encarregado", telefone: "", frente_id: "" }); setEditId(null); setShowForm(false) }

  async function handleSave() {
    if (!form.nome || !form.telefone || !activeProjectId) return
    const tel = form.telefone.replace(/\D/g, "")
    if (editId) {
      await updateContato(editId, { nome: form.nome, cargo: form.cargo, telefone_whatsapp: tel, frente_id: form.frente_id || null })
    } else {
      await addContato({ nome: form.nome, cargo: form.cargo, telefone_whatsapp: tel, projeto_id: activeProjectId, frente_id: form.frente_id || null, ativo: true, foto_url: null })
    }
    resetForm()
  }

  function startEdit(c: DbContato) {
    setForm({ nome: c.nome, cargo: c.cargo, telefone: c.telefone_whatsapp, frente_id: c.frente_id ?? "" })
    setEditId(c.id); setShowForm(true)
  }

  const filtered = contatos.filter(c => !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.cargo.toLowerCase().includes(search.toLowerCase()))

  // KPIs
  const total = contatos.length
  const porCargo = CARGOS.map(c => ({ cargo: c, qtd: contatos.filter(ct => ct.cargo === c).length })).filter(x => x.qtd > 0)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center"><UserCog size={22} className="text-purple-400" /></div>
        <div>
          <h1 className="text-lg font-bold text-[#e4f2f8]">Gestao de Contatos</h1>
          <p className="text-xs text-[#5a8caa]">Cadastre telefones WhatsApp dos responsaveis</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-medium hover:bg-purple-500/30 transition-colors">
          <Plus size={14} /> Novo Contato
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
          <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">Total Contatos</div>
          <div className="text-2xl font-bold text-purple-400">{total}</div>
        </div>
        {porCargo.slice(0, 3).map(x => (
          <div key={x.cargo} className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
            <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">{x.cargo}s</div>
            <div className="text-2xl font-bold text-[#e4f2f8]">{x.qtd}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a8caa]" />
        <input placeholder="Buscar contato..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-[#112645] border border-[#20406a] rounded-lg pl-9 pr-3 py-2 text-xs text-[#e4f2f8] placeholder-[#5a8caa]" />
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-purple-400">{editId ? "Editar" : "Novo"} Contato</h3>
            <button onClick={resetForm} className="text-[#6b6b6b] hover:text-white"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input placeholder="Nome completo" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8] placeholder-[#5a8caa]" />
            <input placeholder="55 DDD Numero (ex: 5513999001001)" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8] placeholder-[#5a8caa]" inputMode="tel" />
            <select value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8]">
              {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.frente_id} onChange={e => setForm(f => ({ ...f, frente_id: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8]">
              <option value="">Todas as frentes</option>
              {frentes.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors">
            {editId ? "Salvar" : "Cadastrar"}
          </button>
        </div>
      )}

      {/* Contacts List */}
      <div className="space-y-2">
        {filtered.length === 0 && <div className="text-center py-8 text-[#5a8caa] text-sm">Nenhum contato cadastrado.</div>}
        {filtered.map(c => {
          const frente = frentes.find(f => f.id === c.frente_id)
          return (
            <div key={c.id} className="bg-[#112645] border border-[#20406a] rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 text-purple-400 font-bold text-sm">
                {c.nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[#e4f2f8]">{c.nome}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">{c.cargo}</span>
                  {frente && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#20406a] text-[#8fb3c8]">{frente.nome}</span>}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Phone size={10} className="text-green-400" />
                  <span className="text-xs text-[#5a8caa] font-mono">{c.telefone_whatsapp.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "+$1 ($2) $3-$4")}</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => startEdit(c)} className="p-2 rounded-lg hover:bg-[#14294e] text-[#6b6b6b] hover:text-[#2abfdc] transition-colors"><Edit2 size={14} /></button>
                <button onClick={() => removeContato(c.id)} className="p-2 rounded-lg hover:bg-[#14294e] text-[#6b6b6b] hover:text-rose-400 transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
