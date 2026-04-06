import { FlowHoverButton } from '@/components/ui/flow-hover-button'

export function FooterCTA() {
  return (
    <section style={{ background: '#2c2c2c', borderTop: '1px solid rgba(255,255,255,0.10)' }} className="py-32">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.10)' }} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em' }} className="text-white/55 text-xs uppercase font-mono">Próximo Passo</span>
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.10)' }} />
        </div>

        <h2
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(2rem, 5vw, 4.5rem)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
          className="text-white mb-6"
        >
          Construa com Inteligência.
        </h2>

        <p className="text-white/70 text-lg mb-12 max-w-xl mx-auto">
          Construa o futuro com a inteligência e a precisão da Atlântico.
        </p>

        <FlowHoverButton variant="accent" href="#contato" className="text-sm px-8 py-3">
          Agendar uma Demonstração Técnica Gratuita
        </FlowHoverButton>
      </div>
    </section>
  )
}
