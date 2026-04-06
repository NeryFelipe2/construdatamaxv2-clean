/**
 * AipPanel — Palantir-style AI assistant for CONSTRUDATA platform.
 *
 * Reads live data from Zustand stores and uses Claude API for responses.
 * Requires VITE_ANTHROPIC_API_KEY in your .env file.
 *
 * ⚠️ Note: The API key is exposed in the client bundle — suitable for
 *    internal/demo use only. For production, proxy through a backend.
 */
import { useRef, useEffect, useState } from 'react'
import { Sparkles, X, Send, Trash2, Loader2, BrainCircuit } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAipStore } from '../store/aipStore'
import { useAipDataDigest } from '../hooks/useAipDataDigest'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

async function callClaude(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string
): Promise<string> {
  if (!API_KEY) {
    return (
      '⚠️ **Chave de API não configurada.**\n\n' +
      'Para ativar o AIP, adicione `VITE_ANTHROPIC_API_KEY=sua_chave` no arquivo `.env` ' +
      'na raiz do projeto e reinicie o servidor de desenvolvimento.'
    )
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error ${res.status}: ${err}`)
  }

  const data = (await res.json()) as { content: { type: string; text: string }[] }
  return data.content.find((c) => c.type === 'text')?.text ?? '(sem resposta)'
}

function MessageBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex gap-2 mb-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-[#f97316]/15 border border-[#f97316]/30 flex items-center justify-center mt-0.5">
          <Sparkles size={13} className="text-[#f97316]" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed',
          isUser
            ? 'bg-[#f97316] text-white rounded-br-sm'
            : 'bg-[#3d3d3d] text-[#f5f5f5] border border-[#525252] rounded-bl-sm'
        )}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {content}
      </div>
    </div>
  )
}

export function AipPanel() {
  const { isOpen, messages, isLoading, togglePanel, addMessage, setLoading, clearHistory } =
    useAipStore()
  const digest    = useAipDataDigest()
  const [input, setInput]   = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, messages.length])

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    addMessage('user', text)
    setLoading(true)

    const systemPrompt =
      `Você é AIP, o assistente de inteligência de dados da plataforma CONSTRUDATA — ` +
      `uma plataforma de gestão de obras e saneamento de grande porte (nível Concremat/Vale).\n\n` +
      `REGRAS ABSOLUTAS:\n` +
      `- Responda SEMPRE em português brasileiro, de forma concisa e objetiva.\n` +
      `- NUNCA invente ou assuma dados. Use SOMENTE as informações fornecidas abaixo.\n` +
      `- Se não houver dados suficientes para responder, diga claramente que o dado não está disponível no sistema.\n` +
      `- Quando relevante, CRUZE dados entre módulos (ex: equipamento parado → impacto no planejamento → custo indireto).\n` +
      `- Cite números específicos, datas, percentuais e valores em R$ dos dados da plataforma.\n` +
      `- Identifique gargalos, riscos e desvios automaticamente quando os dados indicarem.\n` +
      `- Use indicadores EVM (CPI, SPI) para análises financeiras quando disponíveis.\n` +
      `- Relacione avanço físico com avanço financeiro quando perguntado sobre desempenho.\n\n` +
      `### Estado atual da plataforma (dados ao vivo):\n${digest}`

    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content: text })

    try {
      const reply = await callClaude(history, systemPrompt)
      addMessage('assistant', reply)
    } catch (err) {
      addMessage('assistant', `❌ Erro ao consultar a IA: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={togglePanel}
        title="AIP — Assistente de Dados"
        className={cn(
          'fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full',
          'flex items-center justify-center shadow-lg transition-all duration-200',
          'border border-[#f97316]/40 hover:border-[#f97316]/80',
          isOpen
            ? 'bg-[#f97316] text-white'
            : 'bg-[#2c2c2c] text-[#f97316] hover:bg-[#3d3d3d]',
        )}
        style={{ boxShadow: '0 4px 20px rgba(249,115,22,0.3)' }}
      >
        {isOpen ? <X size={20} /> : <BrainCircuit size={20} />}
      </button>

      {/* Slide-in panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full z-40 flex flex-col',
          'border-l border-[#525252] bg-[#2c2c2c]',
          'transition-transform duration-300 ease-in-out',
          'w-[400px] max-w-[100vw]',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.4)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[#525252] shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#f97316]/15 border border-[#f97316]/30">
            <BrainCircuit size={16} className="text-[#f97316]" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[#f5f5f5] text-sm font-semibold tracking-wide">AIP</span>
            <span className="text-[#6b6b6b] text-[10px] uppercase tracking-widest">Assistente de Dados</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={clearHistory}
              title="Limpar histórico"
              className="p-1.5 rounded-md text-[#6b6b6b] hover:text-[#a3a3a3] hover:bg-[#3d3d3d] transition-colors"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={togglePanel}
              title="Fechar"
              className="p-1.5 rounded-md text-[#6b6b6b] hover:text-[#a3a3a3] hover:bg-[#3d3d3d] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center">
                <Sparkles size={24} className="text-[#f97316]" />
              </div>
              <div>
                <p className="text-[#f5f5f5] text-sm font-medium mb-1">Como posso ajudar?</p>
                <p className="text-[#6b6b6b] text-xs leading-relaxed max-w-[280px]">
                  Pergunte sobre RDOs, projetos, status de obras, relatórios e dados da plataforma.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-[300px]">
                {[
                  'Quantos RDOs foram registrados?',
                  'Qual o status dos projetos ativos?',
                  'Resuma as últimas atividades registradas.',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); inputRef.current?.focus() }}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-[#525252] text-[#a3a3a3] hover:border-[#f97316]/40 hover:text-[#f5f5f5] hover:bg-[#3d3d3d] transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}

          {isLoading && (
            <div className="flex gap-2 mb-3 justify-start">
              <div className="shrink-0 w-7 h-7 rounded-full bg-[#f97316]/15 border border-[#f97316]/30 flex items-center justify-center mt-0.5">
                <Sparkles size={13} className="text-[#f97316]" />
              </div>
              <div className="px-3.5 py-2.5 rounded-xl bg-[#3d3d3d] border border-[#525252] rounded-bl-sm">
                <Loader2 size={14} className="text-[#f97316] animate-spin" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="shrink-0 px-4 py-3 border-t border-[#525252]">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre os dados da plataforma…"
              rows={1}
              className={cn(
                'flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm',
                'bg-[#3d3d3d] border border-[#525252] text-[#f5f5f5]',
                'placeholder:text-[#6b6b6b] outline-none',
                'focus:border-[#f97316]/50 transition-colors',
                'max-h-32 overflow-y-auto',
              )}
              style={{ scrollbarWidth: 'none' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`
              }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isLoading}
              className={cn(
                'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center',
                'transition-colors',
                input.trim() && !isLoading
                  ? 'bg-[#f97316] text-white hover:bg-[#ea580c]'
                  : 'bg-[#3d3d3d] text-[#525252] cursor-not-allowed border border-[#525252]',
              )}
            >
              {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          <p className="text-[#525252] text-[10px] mt-2 text-center">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>

      {/* Backdrop — close panel when clicking outside on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={togglePanel}
        />
      )}
    </>
  )
}
