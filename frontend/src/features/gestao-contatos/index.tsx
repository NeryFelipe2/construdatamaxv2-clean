import { useState, useMemo, useEffect } from "react"
import { UserCog, Plus, Phone, Trash2, Edit2, Search, X, Users, Briefcase, AlertTriangle } from "lucide-react"
import { useProjectContext } from "@/store/projectContext"
import { useContatosStore } from "@/store/contatosStore"
import { useEquipes } from "@/hooks/useEquipes"
import { useFuncionariosDiretorio } from "@/hooks/useFuncionariosDiretorio"
import type { DbContato } from "@/lib/supabase"

const CARGOS = ["Encarregado", "Engenheiro", "Tecnico Seg.", "Mestre", "Apontador", "Operador", "Motorista", "Pedreiro", "Encanador"]

type ContatoTab = "manual" | "equipe" | "rh"

export function GestaoContatosPage() {
  const activeProjectId = useProjectContext(s => s.activeProjectId)
  const allFrentes = useProjectContext(s => s.frentes)
  const allContatos = useContatosStore(s => s.contatos)
  const fetchContatos = useContatosStore(s => s.fetchContatos)
  const addContato = useContatosStore(s => s.addContato)
  const updateContato = useContatosStore(s => s.updateContato)
  const removeContato = useContatosStore(s => s.removeContato)
  const integrationStatus = useContatosStore(s => s.integrationStatus)
  const frentes = useMemo(() => allFrentes.filter(f => f.projeto_id === activeProjectId), [allFrentes, activeProjectId])
  const contatos = useMemo(() => allContatos.filter(c => c.projeto_id === activeProjectId), [allContatos, activeProjectId])

  useEffect(() => {
    if (activeProjectId) fetchContatos(activeProjectId)
  }, [activeProjectId, fetchContatos])

  // Equipe de campo (WCR real, tabela equipe_membros) — organizada por todo o
  // contrato WCR, sem project_id próprio, por isso não é filtrada por activeProjectId.
  const { equipes, loading: equipesLoading, error: equipesError } = useEquipes()
  const equipeMembrosFlat = useMemo(
    () => equipes.flatMap(eq => eq.membros.map(m => ({ ...m, equipeNome: eq.equipe, lider: eq.lider, frente: eq.frente }))),
    [equipes],
  )

  // RH central (tabela funcionarios) — cruzada aqui, mas NENHUMA linha hoje
  // pertence a uma obra WCR (ver useFuncionariosDiretorio.ts). isWcr é calculado
  // via join com `obras`, não fixo, então se um dia cadastrarem obra WCR aparece certo.
  const { funcionarios, loading: funcionariosLoading, error: funcionariosError } = useFuncionariosDiretorio()
  const funcionariosWcr = useMemo(() => funcionarios.filter(f => f.isWcr), [funcionarios])

  const [tab, setTab] = useState<ContatoTab>("manual")
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

  const filteredManual = contatos.filter(c => !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.cargo.toLowerCase().includes(search.toLowerCase()))
  const filteredEquipe = equipeMembrosFlat.filter(m => !search || m.nome.toLowerCase().includes(search.toLowerCase()) || m.funcao.toLowerCase().includes(search.toLowerCase()) || m.equipeNome.toLowerCase().includes(search.toLowerCase()))
  const filteredRh = funcionarios.filter(f => !search || f.nome.toLowerCase().includes(search.toLowerCase()) || f.funcao.toLowerCase().includes(search.toLowerCase()) || f.departamento.toLowerCase().includes(search.toLowerCase()))

  // KPIs (cadastro manual)
  const total = contatos.length
  const porCargo = CARGOS.map(c => ({ cargo: c, qtd: contatos.filter(ct => ct.cargo === c).length })).filter(x => x.qtd > 0)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center"><UserCog size={22} className="text-purple-400" /></div>
        <div>
          <h1 className="text-lg font-bold text-[#e4f2f8]">Gestao de Contatos</h1>
          <p className="text-xs text-[#5a8caa]">Diretório cruzado: cadastro manual + equipe de campo + RH central</p>
        </div>
        <span className={`text-[10px] px-2.5 py-1 rounded-full border ${
          integrationStatus === 'connected'
            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            : integrationStatus === 'partial'
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              : 'bg-[#20406a] text-[#8fb3c8] border-[#20406a]'
        }`}>
          {integrationStatus === 'connected' ? 'Conectado' : integrationStatus === 'partial' ? 'Parcial' : 'Local'}
        </span>
        {tab === "manual" && (
          <button onClick={() => { resetForm(); setShowForm(true) }} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-medium hover:bg-purple-500/30 transition-colors">
            <Plus size={14} /> Novo Contato
          </button>
        )}
      </div>

      {/* Fontes — troca de aba + contagem real por origem */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FonteTile
          active={tab === "manual"}
          onClick={() => setTab("manual")}
          icon={<UserCog size={16} className="text-purple-400" />}
          label="Cadastro manual"
          value={total}
          accent="purple"
        />
        <FonteTile
          active={tab === "equipe"}
          onClick={() => setTab("equipe")}
          icon={<Users size={16} className="text-emerald-400" />}
          label="Equipe de campo (WCR)"
          value={equipesLoading ? "…" : equipeMembrosFlat.length}
          accent="emerald"
        />
        <FonteTile
          active={tab === "rh"}
          onClick={() => setTab("rh")}
          icon={<Briefcase size={16} className="text-slate-400" />}
          label="RH central (funcionarios)"
          value={funcionariosLoading ? "…" : funcionarios.length}
          accent="slate"
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a8caa]" />
        <input placeholder="Buscar contato..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-[#112645] border border-[#20406a] rounded-lg pl-9 pr-3 py-2 text-xs text-[#e4f2f8] placeholder-[#5a8caa]" />
      </div>

      {/* ─── Aba: Cadastro manual ─────────────────────────────────────────── */}
      {tab === "manual" && (
        <>
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
            {filteredManual.length === 0 && <div className="text-center py-8 text-[#5a8caa] text-sm">Nenhum contato cadastrado.</div>}
            {filteredManual.map(c => {
              const frente = frentes.find(f => f.id === c.frente_id)
              return (
                <div key={c.id} className="bg-[#112645] border border-[#20406a] rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 text-purple-400 font-bold text-sm">
                    {c.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#e4f2f8]">{c.nome}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">Cadastro manual</span>
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
        </>
      )}

      {/* ─── Aba: Equipe de campo (WCR real) ─────────────────────────────── */}
      {tab === "equipe" && (
        <div className="space-y-2">
          {equipesError && (
            <AvisoAmber titulo="Erro ao carregar equipes.">{equipesError}</AvisoAmber>
          )}
          <p className="text-[11px] text-[#5a8caa]">
            Fonte: tabela <code className="text-[#8fb3c8]">equipe_membros</code> (organograma WCR editável em Equipes). Sem telefone cadastrado — cadastre manualmente na aba ao lado se precisar de WhatsApp.
          </p>
          {!equipesLoading && filteredEquipe.length === 0 && (
            <div className="text-center py-8 text-[#5a8caa] text-sm">Nenhum membro de equipe encontrado.</div>
          )}
          {filteredEquipe.map(m => (
            <div key={m.id} className="bg-[#112645] border border-[#20406a] rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-400 font-bold text-sm">
                {m.nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[#e4f2f8]">{m.nome}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Equipe</span>
                  {m.funcao && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#20406a] text-[#8fb3c8]">{m.funcao}</span>}
                </div>
                <p className="text-xs text-[#5a8caa] mt-0.5">{m.equipeNome} · líder {m.lider}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Aba: RH central (tabela funcionarios) ───────────────────────── */}
      {tab === "rh" && (
        <div className="space-y-2">
          {funcionariosError && (
            <AvisoAmber titulo="Erro ao carregar funcionários.">{funcionariosError}</AvisoAmber>
          )}
          {!funcionariosLoading && !funcionariosError && (
            <AvisoAmber titulo={`${funcionariosWcr.length} de ${funcionarios.length} funcionários pertencem a uma obra WCR.`}>
              A tabela <code className="text-amber-200">funcionarios</code> é o RH central da empresa (todas as obras), não só WCR.
              {funcionariosWcr.length === 0 && funcionarios.length > 0 && (
                <> Hoje são todos de outras obras/clientes (ex: {Array.from(new Set(funcionarios.map(f => f.obraNome))).slice(0, 3).join(', ')}) — listados aqui só como referência cruzada, sem ligação com o projeto WCR selecionado.</>
              )}
            </AvisoAmber>
          )}
          {!funcionariosLoading && filteredRh.length === 0 && (
            <div className="text-center py-8 text-[#5a8caa] text-sm">Nenhum funcionário encontrado.</div>
          )}
          {filteredRh.map(f => (
            <div key={f.id} className="bg-[#112645] border border-[#20406a] rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-500/10 flex items-center justify-center shrink-0 text-slate-400 font-bold text-sm">
                {f.nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[#e4f2f8]">{f.nome}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    f.isWcr
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      : 'bg-slate-500/10 text-slate-300 border-slate-500/20'
                  }`}>
                    RH · {f.isWcr ? 'WCR' : 'outra obra'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#20406a] text-[#8fb3c8]">{f.funcao}</span>
                </div>
                <p className="text-xs text-[#5a8caa] mt-0.5">{f.obraNome}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FonteTile({
  active, onClick, icon, label, value, accent,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  value: number | string
  accent: "purple" | "emerald" | "slate"
}) {
  const ring = {
    purple: "border-purple-500/50 bg-purple-500/10",
    emerald: "border-emerald-500/50 bg-emerald-500/10",
    slate: "border-slate-500/50 bg-slate-500/10",
  }[accent]
  return (
    <button
      onClick={onClick}
      className={`text-left bg-[#112645] border rounded-xl p-4 transition-colors ${active ? ring : 'border-[#20406a] hover:border-[#2c5580]'}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-[10px] text-[#5a8caa] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-[#e4f2f8]">{value}</div>
    </button>
  )
}

function AvisoAmber({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
      <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
      <span className="text-xs text-amber-200/90 leading-relaxed">
        <b className="text-amber-300">{titulo}</b> {children}
      </span>
    </div>
  )
}
