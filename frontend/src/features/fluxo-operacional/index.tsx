import { useState } from "react"
import { GitBranch, Plus, Bell, Clock, AlertTriangle, CheckCircle, Trash2, ToggleLeft, ToggleRight } from "lucide-react"
import { useProjectContext } from "@/store/projectContext"

interface AutomacaoRegra {
  id: string
  tipo: "lembrete_rdo" | "alerta_atraso" | "alerta_nao_preenchido" | "resumo_diario" | "custom"
  horario: string
  destinatarios_cargo: string[]
  mensagem: string
  ativa: boolean
}

interface LogExecucao {
  id: string
  regra_id: string
  data: string
  destinatario: string
  status: "enviado" | "erro" | "pendente"
}

const TIPOS_REGRA = [
  { value: "lembrete_rdo", label: "Lembrete de RDO", desc: "Envia lembrete para preencher RDO", icon: Bell },
  { value: "alerta_nao_preenchido", label: "RDO nao preenchido", desc: "Alerta se RDO nao foi preenchido", icon: AlertTriangle },
  { value: "alerta_atraso", label: "Atraso de obra", desc: "Alerta quando atraso > X dias", icon: Clock },
  { value: "resumo_diario", label: "Resumo diario", desc: "Envia resumo do dia para engenheiro", icon: CheckCircle },
]

const DEMO_REGRAS: AutomacaoRegra[] = [
  { id: "r-1", tipo: "lembrete_rdo", horario: "07:00", destinatarios_cargo: ["Encarregado"], mensagem: "Bom dia! Lembre de preencher o RDO de hoje.", ativa: true },
  { id: "r-2", tipo: "alerta_nao_preenchido", horario: "18:00", destinatarios_cargo: ["Engenheiro"], mensagem: "ALERTA: RDO de hoje ainda nao foi preenchido.", ativa: true },
  { id: "r-3", tipo: "alerta_atraso", horario: "09:00", destinatarios_cargo: ["Engenheiro", "Mestre"], mensagem: "ALERTA: Frente {frente} com atraso > 3 dias.", ativa: false },
]

const DEMO_LOGS: LogExecucao[] = [
  { id: "l-1", regra_id: "r-1", data: "2026-04-05 07:02", destinatario: "Bruno (Encarregado)", status: "enviado" },
  { id: "l-2", regra_id: "r-1", data: "2026-04-05 07:02", destinatario: "Guajeru (Encarregado)", status: "enviado" },
  { id: "l-3", regra_id: "r-2", data: "2026-04-04 18:01", destinatario: "Felipe Nery (Engenheiro)", status: "enviado" },
  { id: "l-4", regra_id: "r-1", data: "2026-04-04 07:03", destinatario: "Bruno (Encarregado)", status: "erro" },
]

export function FluxoOperacionalPage() {
  const activeProjeto = useProjectContext(s => s.activeProjeto())
  const [regras, setRegras] = useState<AutomacaoRegra[]>(DEMO_REGRAS)
  const [logs] = useState<LogExecucao[]>(DEMO_LOGS)
  const [showNew, setShowNew] = useState(false)
  const [tab, setTab] = useState<"regras" | "logs">("regras")
  const [novaRegra, setNovaRegra] = useState({ tipo: "lembrete_rdo", horario: "07:00", cargos: ["Encarregado"], mensagem: "" })

  function toggleRegra(id: string) {
    setRegras(rs => rs.map(r => r.id === id ? { ...r, ativa: !r.ativa } : r))
  }

  function removeRegra(id: string) {
    setRegras(rs => rs.filter(r => r.id !== id))
  }

  function addRegra() {
    setRegras(rs => [...rs, {
      id: `r-${Date.now()}`, tipo: novaRegra.tipo as any, horario: novaRegra.horario,
      destinatarios_cargo: novaRegra.cargos, mensagem: novaRegra.mensagem || TIPOS_REGRA.find(t => t.value === novaRegra.tipo)?.desc || "",
      ativa: true,
    }])
    setShowNew(false)
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center"><GitBranch size={22} className="text-orange-400" /></div>
        <div>
          <h1 className="text-lg font-bold text-[#e4f2f8]">Fluxo Operacional</h1>
          <p className="text-xs text-[#5a8caa]">Automacoes WhatsApp — {activeProjeto?.nome ?? "Nenhum projeto"}</p>
        </div>
        <button onClick={() => setShowNew(true)} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-medium hover:bg-orange-500/30 transition-colors">
          <Plus size={14} /> Nova Regra
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
          <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">Regras Ativas</div>
          <div className="text-2xl font-bold text-green-400">{regras.filter(r => r.ativa).length}</div>
        </div>
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
          <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">Envios Hoje</div>
          <div className="text-2xl font-bold text-orange-400">{logs.filter(l => l.data.startsWith("2026-04-05")).length}</div>
        </div>
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
          <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">Erros</div>
          <div className="text-2xl font-bold text-rose-400">{logs.filter(l => l.status === "erro").length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#20406a]">
        {(["regras", "logs"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${tab === t ? "bg-[#14294e] text-orange-400 border border-[#20406a] border-b-transparent" : "text-[#6b6b6b] hover:text-[#8fb3c8]"}`}>
            {t === "regras" ? "Regras de Automacao" : "Log de Execucoes"}
          </button>
        ))}
      </div>

      {/* New Rule Form */}
      {showNew && (
        <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-orange-400">Nova Regra de Automacao</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={novaRegra.tipo} onChange={e => setNovaRegra(r => ({ ...r, tipo: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2 text-xs text-[#e4f2f8]">
              {TIPOS_REGRA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="time" value={novaRegra.horario} onChange={e => setNovaRegra(r => ({ ...r, horario: e.target.value }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2 text-xs text-[#e4f2f8]" />
            <select multiple value={novaRegra.cargos} onChange={e => setNovaRegra(r => ({ ...r, cargos: Array.from(e.target.selectedOptions, o => o.value) }))}
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2 text-xs text-[#e4f2f8] h-20">
              {["Encarregado", "Engenheiro", "Mestre", "Tecnico Seg.", "Apontador"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input placeholder="Mensagem (opcional)" value={novaRegra.mensagem} onChange={e => setNovaRegra(r => ({ ...r, mensagem: e.target.value }))}
            className="w-full bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2 text-xs text-[#e4f2f8] placeholder-[#5a8caa]" />
          <div className="flex gap-2">
            <button onClick={addRegra} className="px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 transition-colors">Criar</button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg text-[#6b6b6b] hover:text-white text-xs transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Rules List */}
      {tab === "regras" && (
        <div className="space-y-2">
          {regras.map(r => {
            const tipo = TIPOS_REGRA.find(t => t.value === r.tipo)
            const Icon = tipo?.icon ?? Bell
            return (
              <div key={r.id} className={`bg-[#112645] border rounded-xl p-4 flex items-center gap-4 transition-colors ${r.ativa ? "border-[#20406a]" : "border-[#20406a]/50 opacity-60"}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${r.ativa ? "bg-orange-500/20" : "bg-gray-500/10"}`}>
                  <Icon size={18} className={r.ativa ? "text-orange-400" : "text-gray-500"} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#e4f2f8]">{tipo?.label ?? r.tipo}</div>
                  <div className="text-xs text-[#5a8caa] mt-0.5">{r.mensagem}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-[#8fb3c8] flex items-center gap-1"><Clock size={10} /> {r.horario}</span>
                    {r.destinatarios_cargo.map(c => (
                      <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-[#20406a] text-[#8fb3c8]">{c}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => toggleRegra(r.id)} className="shrink-0" title={r.ativa ? "Desativar" : "Ativar"}>
                  {r.ativa ? <ToggleRight size={24} className="text-green-400" /> : <ToggleLeft size={24} className="text-gray-500" />}
                </button>
                <button onClick={() => removeRegra(r.id)} className="p-2 rounded-lg hover:bg-[#14294e] text-[#6b6b6b] hover:text-rose-400 transition-colors shrink-0"><Trash2 size={14} /></button>
              </div>
            )
          })}
        </div>
      )}

      {/* Logs */}
      {tab === "logs" && (
        <div className="space-y-1">
          {logs.map(l => (
            <div key={l.id} className="bg-[#112645] border border-[#20406a] rounded-lg px-4 py-3 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${l.status === "enviado" ? "bg-green-400" : l.status === "erro" ? "bg-rose-400" : "bg-yellow-400"}`} />
              <span className="text-xs text-[#5a8caa] font-mono w-32 shrink-0">{l.data}</span>
              <span className="text-xs text-[#e4f2f8] flex-1">{l.destinatario}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${l.status === "enviado" ? "bg-green-500/10 text-green-400" : l.status === "erro" ? "bg-rose-500/10 text-rose-400" : "bg-yellow-500/10 text-yellow-400"}`}>{l.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
