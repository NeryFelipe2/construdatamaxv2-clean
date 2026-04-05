import { useState } from "react"
import {
  Brain, Key, Send, ExternalLink, CheckCircle, XCircle,
  FileText, Camera, BarChart3, Droplets, Wrench, MessageSquare,
  Zap, Eye, EyeOff, Trash2,
} from "lucide-react"
import { useLlmStore, LLM_PROVIDERS } from "@/store/llmStore"

const QUICK_ACTIONS = [
  { id: "resumo", label: "Resumo Executivo", icon: FileText, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", prompt: "Faca um resumo executivo do projeto atual com situacao, producao, custos, problemas e proximos passos." },
  { id: "hidraulica", label: "Validar Hidraulica", icon: Droplets, color: "text-blue-400 bg-blue-500/10 border-blue-500/20", prompt: "Valide os parametros hidraulicos: velocidade (0.6-5 m/s), tensao trativa (>1 Pa), declividade, profundidade. Liste alertas." },
  { id: "perdas", label: "Analisar Perdas", icon: BarChart3, color: "text-orange-400 bg-orange-500/10 border-orange-500/20", prompt: "Analise indicadores de perdas de agua: ILI, UARL, eficiencia de DMAs, custo de ineficiencia. Sugira acoes." },
  { id: "ml_explicacao", label: "Explicar ML", icon: Brain, color: "text-purple-400 bg-purple-500/10 border-purple-500/20", prompt: "Explique os resultados do modelo ML de producao em linguagem de campo: tendencia, gargalos, cenario recomendado." },
  { id: "foto", label: "Analisar Foto", icon: Camera, color: "text-pink-400 bg-pink-500/10 border-pink-500/20", prompt: "Descreva esta foto de obra: tipo de servico, equipamentos visiveis, EPIs, condicoes de seguranca." },
  { id: "pdf", label: "Ler PDF", icon: FileText, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", prompt: "Extraia informacoes do PDF: dimensoes de tubos, PVs, extensoes, materiais, observacoes do projeto." },
]

export function IaAnalyticsPage() {
  const keys = useLlmStore(s => s.keys)
  const setKey = useLlmStore(s => s.setKey)
  const removeKey = useLlmStore(s => s.removeKey)
  const callLlm = useLlmStore(s => s.callLlm)
  const loading = useLlmStore(s => s.loading)

  const [tab, setTab] = useState<"chat" | "config">("chat")
  const [prompt, setPrompt] = useState("")
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([])
  const [editingKey, setEditingKey] = useState<Record<string, string>>({})
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

  async function handleSend(text?: string, module?: string) {
    const msg = text ?? prompt
    if (!msg.trim()) return
    setMessages(m => [...m, { role: "user", text: msg }])
    setPrompt("")
    const result = await callLlm(module ?? "chat", msg)
    setMessages(m => [...m, { role: "ai", text: result }])
  }

  function handleSaveKey(providerId: string) {
    const val = editingKey[providerId]
    if (val?.trim()) {
      setKey(providerId, val.trim())
      setEditingKey(e => ({ ...e, [providerId]: "" }))
    }
  }

  const configuredCount = Object.keys(keys).filter(k => !!keys[k]).length

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center"><Brain size={22} className="text-purple-400" /></div>
        <div>
          <h1 className="text-lg font-bold text-[#e4f2f8]">IA & Analytics</h1>
          <p className="text-xs text-[#5a8caa]">4 LLMs gratuitas — Gemini, Groq, Mistral, Cohere</p>
        </div>
      </div>

      {/* Provider Status Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {LLM_PROVIDERS.map(p => {
          const configured = !!keys[p.id]
          return (
            <div key={p.id} className={`bg-[#112645] border rounded-xl p-3 ${configured ? "border-green-500/30" : "border-[#20406a]"}`}>
              <div className="flex items-center gap-2 mb-1">
                {configured ? <CheckCircle size={12} className="text-green-400" /> : <XCircle size={12} className="text-[#5a8caa]" />}
                <span className="text-xs font-semibold text-[#e4f2f8]">{p.name}</span>
              </div>
              <div className="text-[10px] text-[#5a8caa]">{p.freeLimit}</div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#20406a]">
        <button onClick={() => setTab("chat")} className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${tab === "chat" ? "bg-[#14294e] text-purple-400 border border-[#20406a] border-b-transparent" : "text-[#6b6b6b] hover:text-[#8fb3c8]"}`}>
          Chat & Acoes Rapidas
        </button>
        <button onClick={() => setTab("config")} className={`px-4 py-2 text-sm rounded-t-lg transition-colors flex items-center gap-1.5 ${tab === "config" ? "bg-[#14294e] text-purple-400 border border-[#20406a] border-b-transparent" : "text-[#6b6b6b] hover:text-[#8fb3c8]"}`}>
          <Key size={12} /> Configurar API Keys ({configuredCount}/4)
        </button>
      </div>

      {tab === "chat" && (
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {QUICK_ACTIONS.map(a => (
              <button key={a.id} onClick={() => handleSend(a.prompt, a.id)} disabled={loading}
                className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-xs font-medium transition-colors hover:brightness-110 disabled:opacity-50 ${a.color}`}>
                <a.icon size={16} />
                {a.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="bg-[#0d2040] border border-[#20406a] rounded-xl min-h-[300px] max-h-[500px] overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-[#5a8caa] text-sm py-12">
                <Brain size={32} className="mx-auto mb-3 opacity-30" />
                <p>Configure as API keys e use os botoes rapidos ou digite sua pergunta.</p>
                <p className="text-[10px] mt-2">Todas as APIs sao 100% gratuitas.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-purple-500/20 text-purple-200 border border-purple-500/20" : "bg-[#112645] text-[#e4f2f8] border border-[#20406a]"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-[#5a8caa] text-xs">
                <div className="w-4 h-4 border-2 border-[#5a8caa] border-t-purple-400 rounded-full animate-spin" />
                Processando...
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input placeholder="Digite sua pergunta..." value={prompt} onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              className="flex-1 bg-[#112645] border border-[#20406a] rounded-xl px-4 py-3 text-sm text-[#e4f2f8] placeholder-[#5a8caa] min-h-[44px]" />
            <button onClick={() => handleSend()} disabled={loading || !prompt.trim()}
              className="px-4 py-3 rounded-xl bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 min-h-[44px]">
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {tab === "config" && (
        <div className="space-y-3">
          <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
            <p className="text-xs text-[#8fb3c8] mb-1">Todas as APIs abaixo sao <strong className="text-green-400">100% gratuitas</strong>. Clique no link pra criar sua key em 30 segundos.</p>
            <p className="text-[10px] text-[#5a8caa]">As keys ficam salvas APENAS no seu navegador (localStorage). Nunca sao enviadas pro servidor.</p>
          </div>

          {LLM_PROVIDERS.map(p => {
            const configured = !!keys[p.id]
            const editing = editingKey[p.id] ?? ""
            const visible = showKeys[p.id]
            return (
              <div key={p.id} className={`bg-[#112645] border rounded-xl p-4 space-y-3 ${configured ? "border-green-500/20" : "border-[#20406a]"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className={configured ? "text-green-400" : "text-[#5a8caa]"} />
                    <span className="text-sm font-semibold text-[#e4f2f8]">{p.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#20406a] text-[#8fb3c8]">{p.freeLimit}</span>
                  </div>
                  <a href={p.urlKey} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-[#2abfdc] hover:underline">
                    Criar key gratis <ExternalLink size={10} />
                  </a>
                </div>

                <div className="text-[10px] text-[#5a8caa]">
                  Capacidades: {p.capabilities.join(", ")}
                </div>

                {configured ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[#0d2040] border border-green-500/20 rounded-lg px-3 py-2 text-xs font-mono text-green-400">
                      {visible ? keys[p.id] : "••••••••••••" + keys[p.id].slice(-6)}
                    </div>
                    <button onClick={() => setShowKeys(s => ({ ...s, [p.id]: !s[p.id] }))} className="p-2 rounded-lg hover:bg-[#14294e] text-[#6b6b6b] hover:text-[#8fb3c8]">
                      {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button onClick={() => removeKey(p.id)} className="p-2 rounded-lg hover:bg-[#14294e] text-[#6b6b6b] hover:text-rose-400"><Trash2 size={14} /></button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input placeholder={`Cole sua ${p.name} API key aqui`} value={editing}
                      onChange={e => setEditingKey(ek => ({ ...ek, [p.id]: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && handleSaveKey(p.id)}
                      className="flex-1 bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8] placeholder-[#5a8caa] font-mono" />
                    <button onClick={() => handleSaveKey(p.id)}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors">
                      Salvar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
