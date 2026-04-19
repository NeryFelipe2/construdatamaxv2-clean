/**
 * WhatsAppBotPanel.tsx — Simulador visual do bot de RDO por WhatsApp.
 * Mostra exatamente como o apontador de campo vai interagir: tudo guiado
 * por opções numeradas, sem campo aberto livre (exceto local e líder).
 * 
 * Funciona como preview + controle do motor conversacional.
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import {
  MessageSquare, Send, RotateCcw, Download, CheckCircle2,
  Smartphone, Bot, User, Zap, ArrowRight,
} from 'lucide-react'
import {
  BOT_STEPS, formatBotMessage, resolveAnswer, getStepById,
  type BotStep, type BotOption,
} from '../utils/rdoBotSteps'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  sender: 'bot' | 'user'
  text: string
  timestamp: string
  stepId?: string
}

interface RdoCollected {
  [key: string]: { value: string; label: string }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WhatsAppBotPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [collected, setCollected] = useState<RdoCollected>({})
  const [isComplete, setIsComplete] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const currentStep = BOT_STEPS[currentStepIdx] ?? null

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function now() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function addMsg(sender: 'bot' | 'user', text: string, stepId?: string) {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sender, text, timestamp: now(), stepId },
    ])
  }

  function startConversation() {
    setMessages([])
    setCollected({})
    setCurrentStepIdx(0)
    setIsComplete(false)
    setIsRunning(true)

    const welcome = `🚧 *BOM DIA!*\nVamos preencher o RDO de hoje.\n📅 ${new Date().toLocaleDateString('pt-BR')}\n\n_Responda com o número da opção desejada._`
    setTimeout(() => {
      addMsg('bot', welcome)
      setTimeout(() => {
        addMsg('bot', formatBotMessage(BOT_STEPS[0]), BOT_STEPS[0].id)
      }, 500)
    }, 300)
  }

  function handleSend() {
    if (!userInput.trim() || !currentStep || isComplete) return

    const input = userInput.trim()
    setUserInput('')
    addMsg('user', input)

    // Validate
    const result = resolveAnswer(currentStep, input)
    if (!result) {
      setTimeout(() => {
        addMsg('bot', `❌ Opção inválida. Por favor, responda novamente.\n\n${formatBotMessage(currentStep)}`, currentStep.id)
      }, 300)
      return
    }

    // Run custom validation
    if (currentStep.validation) {
      const err = currentStep.validation(result.value)
      if (err) {
        setTimeout(() => {
          addMsg('bot', `⚠️ ${err}\n\n${formatBotMessage(currentStep)}`, currentStep.id)
        }, 300)
        return
      }
    }

    // Save answer
    const newCollected = { ...collected, [currentStep.id]: result }
    setCollected(newCollected)

    // Confirm step
    if (currentStep.id === 'confirmar') {
      if (result.value === 'sim') {
        setTimeout(() => {
          const summary = buildSummary(newCollected)
          addMsg('bot', summary)
          setIsComplete(true)
          setIsRunning(false)
        }, 500)
        return
      }
      if (result.value === 'mais') {
        // Go back to tipo_equipe step to add another activity
        const tIdx = BOT_STEPS.findIndex((s) => s.id === 'tipo_equipe')
        setCurrentStepIdx(tIdx)
        setTimeout(() => {
          addMsg('bot', '➕ Vamos adicionar mais uma atividade!\n\n' + formatBotMessage(BOT_STEPS[tIdx]), BOT_STEPS[tIdx].id)
        }, 400)
        return
      }
      if (result.value === 'cancelar') {
        setTimeout(() => {
          addMsg('bot', '❌ RDO cancelado. Envie "RDO" para recomeçar.')
          setIsComplete(true)
          setIsRunning(false)
        }, 300)
        return
      }
    }

    // Advance to next step
    const nextIdx = currentStepIdx + 1
    if (nextIdx < BOT_STEPS.length) {
      setCurrentStepIdx(nextIdx)
      setTimeout(() => {
        const ack = `✅ *${currentStep.title}:* ${result.label}`
        addMsg('bot', ack)
        setTimeout(() => {
          addMsg('bot', formatBotMessage(BOT_STEPS[nextIdx]), BOT_STEPS[nextIdx].id)
        }, 400)
      }, 300)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Quick option buttons
  const quickOptions = currentStep?.options ?? []

  // Summary builder
  function buildSummary(data: RdoCollected): string {
    return `✅ *RDO REGISTRADO COM SUCESSO!*\n
📊 *Resumo:*
🏢 Núcleo: ${data.nucleo?.label ?? '—'}
📋 Projeto: ${data.projeto?.label ?? '—'}
🌤️ Clima: ${data.clima?.label ?? '—'}
👥 Equipe: ${data.tipo_equipe?.label ?? '—'}
👤 Líder: ${data.lider?.label ?? '—'}
📍 Local: ${data.local?.label ?? '—'}
🔧 Serviço: ${data.servico?.label ?? '—'}
📏 Tubo: ${data.tubo?.label ?? '—'}
📐 Metragem: ${data.metragem?.label ?? '0'}m
👷 Ajudantes: ${data.mao_obra_ajudantes?.label ?? '0'}
📋 Encarregados: ${data.mao_obra_encarregado?.label ?? '0'}
🚜 Equipamento: ${data.equipamento?.label ?? 'Nenhum'}
⚠️ Ocorrência: ${data.ocorrencia?.label ?? 'Nenhuma'}

_Registrado em ${new Date().toLocaleString('pt-BR')}_
_Enviado para a plataforma ConstruDataMax_ 🚀`
  }

  // Collected summary chips
  const collectedEntries = useMemo(() => Object.entries(collected), [collected])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-600/20 flex items-center justify-center">
            <MessageSquare size={20} className="text-green-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">RDO por WhatsApp</h2>
            <p className="text-[#6b6b6b] text-xs">Motor conversacional guiado — zero erros de campo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isComplete && (
            <button
              onClick={() => {
                const txt = messages.map((m) => `[${m.timestamp}] ${m.sender === 'bot' ? '🤖' : '👤'} ${m.text}`).join('\n')
                navigator.clipboard.writeText(txt)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-green-500/40 transition-colors"
            >
              <Download size={12} /> Exportar Conversa
            </button>
          )}
          <button
            onClick={startConversation}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            {isRunning ? <RotateCcw size={13} /> : <Zap size={13} />}
            {isRunning ? 'Reiniciar' : 'Iniciar Conversa'}
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Phone preview */}
        <div className="lg:col-span-2">
          <div className="bg-[#0b141a] rounded-2xl border border-[#1f3340] overflow-hidden" style={{ maxHeight: 600 }}>
            {/* WhatsApp header */}
            <div className="bg-[#1f2c34] px-4 py-3 flex items-center gap-3 border-b border-[#2a3942]">
              <div className="w-9 h-9 rounded-full bg-green-600/30 flex items-center justify-center">
                <Bot size={16} className="text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-[#e9edef] text-sm font-medium">ConstruData Bot</p>
                <p className="text-[#8696a0] text-xs">
                  {isRunning ? 'digitando...' : isComplete ? 'RDO finalizado' : 'online'}
                </p>
              </div>
              <Smartphone size={16} className="text-[#8696a0]" />
            </div>

            {/* Chat area */}
            <div className="h-[420px] overflow-y-auto p-4 space-y-2" style={{ background: 'linear-gradient(180deg, #0b141a 0%, #0d1821 100%)' }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-green-600/10 flex items-center justify-center">
                    <MessageSquare size={28} className="text-green-400/50" />
                  </div>
                  <p className="text-[#8696a0] text-sm">Clique em "Iniciar Conversa" para simular o bot</p>
                  <p className="text-[#3d5a6e] text-xs">O apontador responde por números — impossível errar</p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed shadow-sm ${
                      msg.sender === 'bot'
                        ? 'bg-[#1f2c34] text-[#e9edef] rounded-tl-sm'
                        : 'bg-[#005c4b] text-[#e9edef] rounded-tr-sm'
                    }`}
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {msg.text}
                    <span className="block text-right text-[10px] text-[#8696a0] mt-1">{msg.timestamp}</span>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick option pills */}
            {isRunning && quickOptions.length > 0 && (
              <div className="px-3 py-2 flex flex-wrap gap-1.5 border-t border-[#1f3340] bg-[#111b21]">
                {quickOptions.map((opt, i) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setUserInput(String(i + 1))
                      setTimeout(() => handleSend(), 50)
                    }}
                    className="px-2.5 py-1.5 rounded-full text-xs bg-[#1f2c34] border border-[#2a3942] text-[#00a884] hover:bg-[#2a3942] transition-colors"
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input bar */}
            <div className="px-3 py-2 flex items-center gap-2 bg-[#1f2c34] border-t border-[#2a3942]">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRunning ? (currentStep?.placeholder ?? 'Digite o número da opção...') : 'Inicie uma conversa'}
                disabled={!isRunning}
                className="flex-1 bg-[#2a3942] border-none rounded-full px-4 py-2.5 text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-green-600/50 disabled:opacity-40"
              />
              <button
                onClick={handleSend}
                disabled={!isRunning || !userInput.trim()}
                className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Side panel — data collected */}
        <div className="space-y-3">
          <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4">
            <h3 className="text-[#f5f5f5] font-medium text-sm mb-3 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-green-400" />
              Dados Coletados
            </h3>
            {collectedEntries.length === 0 ? (
              <p className="text-[#6b6b6b] text-xs italic">Nenhum dado ainda...</p>
            ) : (
              <div className="space-y-1.5">
                {collectedEntries.map(([key, val]) => {
                  const step = getStepById(key)
                  return (
                    <div key={key} className="flex items-start justify-between gap-2 py-1 border-b border-[#525252]/40">
                      <span className="text-[10px] text-[#6b6b6b] uppercase tracking-wider font-semibold shrink-0">
                        {step?.emoji} {step?.title ?? key}
                      </span>
                      <span className="text-xs text-[#f5f5f5] text-right">{val.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4">
            <h3 className="text-[#f5f5f5] font-medium text-xs mb-2">Progresso</h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-[#484848] rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${(collectedEntries.length / BOT_STEPS.length) * 100}%` }}
                />
              </div>
              <span className="text-xs text-[#a3a3a3]">
                {collectedEntries.length}/{BOT_STEPS.length}
              </span>
            </div>
            {isComplete && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-green-900/30 border border-green-700/30">
                <p className="text-green-400 text-xs font-medium">✅ RDO finalizado!</p>
                <p className="text-green-400/70 text-[10px] mt-0.5">Dados prontos para envio à plataforma</p>
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4">
            <h3 className="text-[#f5f5f5] font-medium text-xs mb-2">Como Funciona</h3>
            <div className="space-y-2 text-[11px] text-[#a3a3a3]">
              <div className="flex items-start gap-2">
                <ArrowRight size={10} className="text-green-400 mt-0.5 shrink-0" />
                <span>O apontador manda <strong className="text-green-400">"RDO"</strong> para o número do bot</span>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight size={10} className="text-green-400 mt-0.5 shrink-0" />
                <span>O bot guia com <strong className="text-green-400">opções numeradas</strong> — impossível errar</span>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight size={10} className="text-green-400 mt-0.5 shrink-0" />
                <span>Dados entram direto na plataforma organizados por NS, projeto e núcleo</span>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight size={10} className="text-green-400 mt-0.5 shrink-0" />
                <span>Foto obrigatória para validação visual</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
