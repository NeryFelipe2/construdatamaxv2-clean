export function OntologiaSection() {
  const layers = [
    { label: 'RDO — Campo', pct: 100, color: '#2abfdc' },
    { label: 'BIM — Modelo 3D/4D/5D', pct: 88, color: '#38bdf8' },
    { label: 'ERP — Orçamento', pct: 75, color: '#a78bfa' },
    { label: 'Cronograma', pct: 92, color: '#22c55e' },
    { label: 'Suprimentos', pct: 70, color: '#f97316' },
  ]

  return (
    <section id="plataforma" style={{ background: '#0f2240', borderTop: '1px solid rgba(255,255,255,0.10)' }} className="py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-16">
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em' }} className="text-white/60 text-xs uppercase font-mono">01 / A Plataforma</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
        </div>

        <div className="grid lg:grid-cols-2 gap-20 items-center">
          {/* Left: layer viz */}
          <div>
            <div className="space-y-3">
              {layers.map((l) => (
                <div key={l.label} className="flex items-center gap-4">
                  <div className="w-44 shrink-0 text-white/75 text-xs font-mono truncate">{l.label}</div>
                  <div className="flex-1 h-px relative" style={{ background: 'rgba(255,255,255,0.10)' }}>
                    <div
                      className="absolute left-0 top-0 h-full transition-all duration-1000"
                      style={{ width: `${l.pct}%`, background: l.color, opacity: 0.7 }}
                    />
                  </div>
                  <div className="w-8 text-right shrink-0">
                    <span className="text-white/60 text-xs font-mono">{l.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8" style={{ border: '1px solid rgba(42,191,220,0.15)', padding: '1rem 1.25rem', borderLeft: '2px solid #2abfdc' }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-[#2abfdc] text-xs uppercase tracking-widest mb-1">Camada Semântica Unificada</div>
              <div className="text-white/75 text-xs">Todos os módulos conectados em tempo real</div>
            </div>
          </div>

          {/* Right: copy */}
          <div>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 'clamp(1.6rem, 3vw, 2.5rem)',
                lineHeight: 1.15,
                letterSpacing: '-0.01em',
                color: '#f4f5f7',
              }}
              className="mb-6"
            >
              A Ontologia da Construção: Um Gêmeo Digital para Cada Projeto.
            </h2>

            <p className="text-white/80 leading-relaxed mb-6 text-sm">
              A Atlântico não apenas coleta dados; ela os integra em uma camada semântica unificada que espelha a realidade do seu projeto. Da pré-construção ao encerramento, cada elemento — atividade, recurso, material — é um objeto inteligente, conectado e contextualizado.
            </p>

            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.12)', paddingLeft: '1.25rem', marginBottom: '1.5rem' }}>
              <p className="text-white/70 text-sm leading-relaxed">
                <strong className="text-white">Conectamos o que acontece no canteiro de obras</strong> aos sistemas de suporte (ERP, BIM, Cronogramas) em um ambiente low-code acessível a todos os usuários, independentemente do seu background técnico. Isso significa que o status de um pilar no RDO impacta diretamente o cronograma e o orçamento no seu ERP.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {[
                { v: 'Dados Integrados', d: 'Uma única fonte de verdade para todo o projeto' },
                { v: 'Camada Semântica', d: 'Cada dado contextualizado e conectado' },
                { v: 'Tempo Real', d: 'Decisões baseadas em dados ao vivo' },
              ].map((item) => (
                <div key={item.v} className="flex items-start gap-4">
                  <div className="w-1 h-1 rounded-full bg-[#2abfdc] mt-2 shrink-0" />
                  <div>
                    <span className="text-white/90 text-sm font-medium">{item.v}</span>
                    <span className="text-white/70 text-sm"> — {item.d}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
