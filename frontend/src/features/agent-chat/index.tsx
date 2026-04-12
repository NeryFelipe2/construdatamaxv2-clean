import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Shield, Loader2 } from "lucide-react"

const API_BASE = import.meta.env.VITE_API_URL || "https://construdatamax-api-production.up.railway.app"

interface Msg {
  role: "user" | "assistant"
  content: string
  provider?: string
}

const DOMINIOS = [
  { id: "geral", nome: "Geral", cor: "bg-gray-500" },
  { id: "rk", nome: "RK Engenharia", cor: "bg-blue-500" },
  { id: "sala", nome: "Sala Tecnica SLNR", cor: "bg-green-500" },
  { id: "dmae", nome: "DMAE 17670", cor: "bg-orange-500" },
  { id: "cdm", nome: "ConstruDataMax", cor: "bg-purple-500" },
]

export function AgentChatPage() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [dominio, setDominio] = useState("geral")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleSend() {
    const msg = input.trim()
    if (!msg || loading) return

    const userMsg: Msg = { role: "user", content: msg }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          dominio,
          historico: messages.slice(-6),
        }),
      })
      const data = await res.json()
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: data.resposta || data.detail || "Erro", provider: data.provider_usado },
      ])
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Erro de conexao com o servidor. Verifique se o backend esta rodando." },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold">Agente ConstruData</span>
        </div>
        <div className="flex items-center gap-1">
          <Shield className="w-4 h-4 text-zinc-500" />
          <span className="text-xs text-zinc-500">Dominio isolado</span>
        </div>
      </div>

      {/* Domain selector */}
      <div className="flex gap-2 px-4 py-2 border-b border-zinc-800 overflow-x-auto">
        {DOMINIOS.map(d => (
          <button
            key={d.id}
            onClick={() => setDominio(d.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              dominio === d.id
                ? `${d.cor} text-white`
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {d.nome}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-zinc-600 mt-20">
            <Bot className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
            <p className="text-lg">Agente ConstruData</p>
            <p className="text-sm mt-1">Selecione o dominio e pergunte algo</p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {["O que faco agora?", "Status medicao marco", "Gerar RDO Pardinho", "Backlog ConstruDataMax"].map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); }}
                  className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-emerald-400" />
              </div>
            )}
            <div className={`max-w-[75%] rounded-xl px-4 py-3 ${
              m.role === "user"
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-200"
            }`}>
              <p className="whitespace-pre-wrap text-sm">{m.content}</p>
              {m.provider && (
                <p className="text-[10px] mt-1 opacity-50">via {m.provider}</p>
              )}
            </div>
            {m.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-400" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            </div>
            <div className="bg-zinc-800 rounded-xl px-4 py-3">
              <p className="text-sm text-zinc-400">Pensando...</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={`Pergunte algo sobre ${DOMINIOS.find(d => d.id === dominio)?.nome}...`}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-xl transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
