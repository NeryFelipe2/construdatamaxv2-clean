import { useEffect } from 'react'
import { BrainCircuit, Sparkles, Database, MessageSquare, BarChart3, Zap } from 'lucide-react'
import { useAipStore } from './store/aipStore'

export function AipPage() {
  const { isOpen, togglePanel } = useAipStore()

  // Auto-open the panel when navigating to this page
  useEffect(() => {
    if (!isOpen) togglePanel()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const capabilities = [
    {
      icon: Database,
      title: 'Acesso aos dados ao vivo',
      desc: 'Consulta RDOs, projetos, relatórios e muito mais diretamente da plataforma.',
    },
    {
      icon: MessageSquare,
      title: 'Conversação natural',
      desc: 'Faça perguntas em português sobre o estado das suas obras e contratos.',
    },
    {
      icon: BarChart3,
      title: 'Análise contextual',
      desc: 'Interpreta tendências, identifica riscos e sugere ações com base nos dados reais.',
    },
    {
      icon: Zap,
      title: 'Respostas rápidas',
      desc: 'Powered by Claude — respostas precisas em segundos, sem burocracia.',
    },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-[#f97316]/10 border border-[#f97316]/30 flex items-center justify-center">
          <BrainCircuit size={28} className="text-[#f97316]" />
        </div>
        <div>
          <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-tight flex items-center gap-2">
            AIP
            <span className="text-sm font-normal text-[#6b6b6b] border border-[#525252] rounded-md px-2 py-0.5">
              Beta
            </span>
          </h1>
          <p className="text-[#a3a3a3] text-sm mt-0.5">
            Artificial Intelligence Platform — Assistente de Dados CONSTRUDATA
          </p>
        </div>
      </div>

      {/* Intro */}
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-5 mb-6">
        <div className="flex items-start gap-3">
          <Sparkles size={18} className="text-[#f97316] mt-0.5 shrink-0" />
          <div>
            <p className="text-[#f5f5f5] text-sm font-medium mb-1">
              Converse com os seus dados de obra
            </p>
            <p className="text-[#a3a3a3] text-sm leading-relaxed">
              O AIP é um assistente de inteligência artificial integrado à plataforma CONSTRUDATA.
              Ele lê os dados atuais — RDOs, projetos, relatórios, equipes — e responde suas perguntas
              em linguagem natural, ajudando você a tomar decisões mais rápidas e embasadas.
            </p>
          </div>
        </div>
      </div>

      {/* Capabilities grid */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {capabilities.map((cap) => (
          <div key={cap.title} className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4 flex gap-3">
            <div className="shrink-0 w-9 h-9 rounded-lg bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center">
              <cap.icon size={16} className="text-[#f97316]" />
            </div>
            <div>
              <p className="text-[#f5f5f5] text-sm font-medium mb-1">{cap.title}</p>
              <p className="text-[#6b6b6b] text-xs leading-relaxed">{cap.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Config note */}
      <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4 mb-6">
        <p className="text-[#6b6b6b] text-xs leading-relaxed">
          <span className="text-[#a3a3a3] font-medium">Configuração:</span> Para ativar respostas da IA,
          adicione <code className="bg-[#3d3d3d] px-1.5 py-0.5 rounded text-[#f97316] font-mono">
            VITE_ANTHROPIC_API_KEY=sua_chave
          </code> no arquivo <code className="bg-[#3d3d3d] px-1.5 py-0.5 rounded text-[#a3a3a3] font-mono">.env</code> na
          raiz do projeto e reinicie o servidor. Sem a chave, o AIP exibe uma mensagem de instrução.
        </p>
      </div>

      {/* Open panel CTA */}
      <button
        onClick={togglePanel}
        className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-[#f97316] text-white text-sm font-semibold hover:bg-[#ea580c] transition-colors"
      >
        <BrainCircuit size={16} />
        {isOpen ? 'Painel AIP aberto →' : 'Abrir AIP'}
      </button>
    </div>
  )
}
