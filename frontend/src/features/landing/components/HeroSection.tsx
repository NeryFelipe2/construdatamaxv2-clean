import { useState, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { FlowHoverButton } from '@/components/ui/flow-hover-button'

const SLIDES = [
  {
    tag: 'GESTÃO 360',
    mockup: 'gestao',
  },
  {
    tag: 'MAPA INTERATIVO',
    mockup: 'mapa',
  },
  {
    tag: 'LPS / LEAN',
    mockup: 'lps',
  },
  {
    tag: 'QUANTITATIVOS',
    mockup: 'quant',
  },
]

// Palantir-style angular mockup panel — NO browser chrome
function GestaoMockup() {
  return (
    <div className="w-full h-full p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.1em' }} className="text-white/75 text-xs uppercase">Gestão de Projeto 360</span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#2abfdc] animate-pulse" />
          <span className="text-white/65 text-xs">ao vivo</span>
        </div>
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: 'EAC', v: 'R$12.4M', c: '#f4f5f7' },
          { l: 'CPI', v: '0.59', c: '#ef4444' },
          { l: 'SPI', v: '0.39', c: '#f97316' },
        ].map((k) => (
          <div key={k.l} style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)' }} className="p-3">
            <div className="text-white/65 text-xs uppercase tracking-wider mb-1">{k.l}</div>
            <div className="font-bold text-lg" style={{ color: k.c, fontFamily: "'Space Grotesk', sans-serif" }}>{k.v}</div>
          </div>
        ))}
      </div>
      {/* Progress bar */}
      <div style={{ border: '1px solid rgba(255,255,255,0.14)' }} className="p-3">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-white/80">PRJ-001 — Torre Residencial Premium</span>
          <span className="text-[#2abfdc] font-mono">47%</span>
        </div>
        <div className="h-px bg-white/10 overflow-hidden">
          <div className="h-full bg-[#2abfdc]" style={{ width: '47%' }} />
        </div>
      </div>
      {/* Project list */}
      <div className="flex flex-col gap-1">
        {[
          { id: 'PRJ-001', name: 'Torre Residencial Premium', s: 'CRÍTICO', c: '#ef4444' },
          { id: 'PRJ-004', name: 'Rede Drenagem SP', s: 'OK', c: '#22c55e' },
          { id: 'PRJ-006', name: 'ETE Guarulhos', s: 'ALERTA', c: '#f97316' },
        ].map((p) => (
          <div key={p.id} style={{ border: '1px solid rgba(255,255,255,0.10)' }} className="flex items-center gap-3 px-3 py-2">
            <span className="text-white/65 text-xs font-mono">{p.id}</span>
            <span className="text-white/90 text-xs flex-1 truncate">{p.name}</span>
            <span className="text-xs font-mono tracking-wider" style={{ color: p.c }}>{p.s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MapaMockup() {
  return (
    <div className="w-full h-full p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.1em' }} className="text-white/75 text-xs uppercase">Mapa Interativo</span>
        <span className="text-[#2abfdc] text-xs uppercase tracking-wider border border-[#2abfdc]/30 px-2 py-0.5">Satélite</span>
      </div>
      {/* Simulated satellite map */}
      <div className="flex-1 relative" style={{ background: 'linear-gradient(135deg, #0a2618 0%, #081e12 50%, #0b1a30 100%)', minHeight: 120 }}>
        <svg width="100%" height="100%" viewBox="0 0 400 150" style={{ position: 'absolute', inset: 0 }}>
          {/* Network lines */}
          <path d="M40,75 L100,55 L170,80 L240,45 L320,65 L390,50" stroke="#2abfdc" strokeWidth="2" fill="none" opacity="0.7" />
          <path d="M60,105 L130,90 L200,110 L270,80 L340,95" stroke="#22c55e" strokeWidth="1.5" fill="none" opacity="0.5" />
          {([[100,55],[170,80],[240,45],[320,65]] as [number,number][]).map(([x,y], i) => (
            <circle key={i} cx={x} cy={y} r="3.5" fill="#2abfdc" opacity="0.9" />
          ))}
          {([[130,90],[200,110],[270,80]] as [number,number][]).map(([x,y], i) => (
            <circle key={i} cx={x} cy={y} r="2.5" fill="#22c55e" opacity="0.9" />
          ))}
        </svg>
        <div className="absolute bottom-2 right-2 text-white/65 text-xs font-mono">39 nós · 2.4km</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[{ l: 'Extensão', v: '2.4 km' }, { l: 'Custo Est.', v: 'R$180k' }, { l: 'Trechos', v: '38' }].map((s) => (
          <div key={s.l} style={{ border: '1px solid rgba(255,255,255,0.14)' }} className="p-2 text-center">
            <div className="text-white/65 text-xs uppercase">{s.l}</div>
            <div className="text-[#2abfdc] font-mono font-bold text-sm">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LpsMockup() {
  const weeks = ['S13', 'S14', 'S15', 'S16', 'S17']
  return (
    <div className="w-full h-full p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.1em' }} className="text-white/75 text-xs uppercase">LPS / Lean — Look-ahead</span>
        <span className="text-white/65 text-xs font-mono">PPC 46%</span>
      </div>
      <div style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
        <div className="grid text-xs" style={{ gridTemplateColumns: '120px repeat(5, 1fr)' }}>
          <div className="px-3 py-2 text-white/65 uppercase text-xs border-b border-white/14">Trecho</div>
          {weeks.map((w) => (
            <div key={w} className="px-1 py-2 text-center text-white/65 uppercase text-xs border-b border-white/14 border-l border-l-white/14">{w}</div>
          ))}
          {[
            { name: 'T01 Escavação', color: '#2abfdc', weeks: [1,1,1,0,0] },
            { name: 'T02 DN200', color: '#2abfdc', weeks: [1,1,1,0,0] },
            { name: 'T03 Reaterro', color: '#a78bfa', weeks: [1,1,0,0,0] },
            { name: 'T04 PVs', color: '#a78bfa', weeks: [0,1,1,0,0] },
          ].map((t) => ([
            <div key={t.name} className="px-3 py-2 text-white/80 text-xs border-t border-white/10 truncate">{t.name}</div>,
            ...t.weeks.map((active, wi) => (
              <div key={wi} className="border-t border-white/10 border-l border-l-white/10 flex items-center justify-center p-1">
                {active ? (
                  <div className="w-full mx-1 py-1 text-center text-xs font-mono" style={{ background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}44` }}>
                    {(['80m','60m','90m','40m'] as string[])[(['T01 Escavação','T02 DN200','T03 Reaterro','T04 PVs'] as string[]).indexOf(t.name)]}
                  </div>
                ) : (
                  <span className="text-white/50 text-xs">—</span>
                )}
              </div>
            ))
          ]))}
        </div>
      </div>
    </div>
  )
}

function QuantMockup() {
  const items = [
    { code: 'SINAPI-73965', desc: 'Escavação Mecânica de Vala', unit: 'm³', qty: 480, total: 'R$ 11.100' },
    { code: 'SINAPI-76413', desc: 'Assentamento Tubo PVC DN200', unit: 'm', qty: 420, total: 'R$ 44.625' },
    { code: 'SINAPI-73961', desc: 'Boca de Lobo — Concreto', unit: 'un', qty: 12, total: 'R$ 27.750' },
    { code: 'SINAPI-73790', desc: 'Recomp. Pavimento Asfáltico', unit: 'm²', qty: 310, total: 'R$ 56.187' },
  ]
  return (
    <div className="w-full h-full p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.1em' }} className="text-white/75 text-xs uppercase">Quantitativos</span>
        <span className="text-[#2abfdc] text-xs font-mono">Total: R$240.807</span>
      </div>
      <div style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
        <div className="grid text-xs" style={{ gridTemplateColumns: '90px 1fr auto' }}>
          {['Código', 'Descrição', 'Total'].map((h) => (
            <div key={h} className="px-3 py-2 text-white/60 uppercase tracking-wider text-xs border-b border-white/14 first:pl-3">{h}</div>
          ))}
          {items.map((item) => ([
            <div key={item.code + 'c'} className="px-3 py-2 text-white/75 font-mono text-xs border-t border-white/10 truncate">{item.code}</div>,
            <div key={item.code + 'd'} className="px-3 py-2 text-white/90 text-xs border-t border-white/10 truncate">{item.desc}</div>,
            <div key={item.code + 't'} className="px-3 py-2 text-[#2abfdc] font-mono text-xs border-t border-white/10">{item.total}</div>,
          ]))}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="text-white/65">10 itens</span>
        <span className="text-white/50">·</span>
        <span className="text-white/65">BDI 25%</span>
        <span className="text-white/50">·</span>
        <span className="text-[#2abfdc]/70">Base SINAPI</span>
      </div>
    </div>
  )
}

const MOCKUP_COMPONENTS = [GestaoMockup, MapaMockup, LpsMockup, QuantMockup]

export function HeroSection() {
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setActiveSlide((s) => (s + 1) % SLIDES.length), 4500)
    return () => clearInterval(timer)
  }, [])

  const Mockup = MOCKUP_COMPONENTS[activeSlide]

  return (
    <section
      style={{ minHeight: '100vh' }}
      className="flex flex-col justify-center pt-14 relative overflow-hidden"
    >
      {/* Background image */}
      <div className="absolute inset-0 z-0" style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.08,
      }} />
      {/* Dark overlay gradient */}
      <div className="absolute inset-0 z-0" style={{
        background: 'linear-gradient(180deg, #0b1a30 0%, rgba(11,26,48,0.88) 30%, rgba(11,26,48,0.92) 70%, #0b1a30 100%)',
      }} />
      <div className="relative z-10">
      <div className="max-w-7xl mx-auto px-6 py-20 w-full">
        {/* Top label */}
        <div className="flex items-center gap-3 mb-10">
          <div className="h-px w-8 bg-[#2abfdc]" />
          <span style={{ letterSpacing: '0.2em', fontFamily: "'Space Grotesk', sans-serif" }} className="text-[#2abfdc] text-xs font-medium uppercase">
            Plataforma para Construção e Saneamento
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left: headline */}
          <div>
            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 'clamp(2.6rem, 5.5vw, 5.2rem)',
                lineHeight: 1.08,
                letterSpacing: '-0.02em',
                color: '#f4f5f7',
              }}
            >
              Inteligência Operacional
              <br />
              <span style={{ color: '#2abfdc' }}>para Construção</span>
              <br />
              e Saneamento.
            </h1>

            <div className="mt-6 mb-10 h-px w-full" style={{ background: 'rgba(255,255,255,0.14)' }} />

            <p className="text-white/80 text-base leading-relaxed max-w-lg mb-10">
              Da pré-construção ao encerramento, cada atividade, recurso e material conectados em uma única plataforma de dados em tempo real.
            </p>

            <div className="flex flex-wrap gap-3 mb-12">
              <FlowHoverButton variant="accent" href="#contato">
                Solicitar Demonstração
              </FlowHoverButton>
              <FlowHoverButton variant="ghost" href="#modulos">
                <ArrowRight size={14} />
                Explorar Módulos
              </FlowHoverButton>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8">
              {[
                { v: '16+', l: 'Módulos' },
                { v: 'BIM 3D/4D/5D', l: 'Integrado' },
                { v: '100%', l: 'Web-based' },
              ].map((s, i) => ([
                i > 0 && <div key={`d${i}`} className="w-px h-8 bg-white/10" />,
                <div key={s.l}>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-white font-semibold">{s.v}</div>
                  <div className="text-white/70 text-xs uppercase tracking-wide">{s.l}</div>
                </div>,
              ]))}
            </div>
          </div>

          {/* Right: rotating mockup */}
          <div>
            {/* Slide tag */}
            <div className="flex items-center gap-3 mb-4">
              <div style={{ letterSpacing: '0.15em' }} className="text-white/65 text-xs uppercase font-mono">
                {SLIDES[activeSlide].tag}
              </div>
              <div className="flex-1 h-px bg-white/14" />
            </div>

            {/* Angular mockup panel */}
            <div
              style={{
                border: '1px solid rgba(255,255,255,0.14)',
                background: '#0f2240',
                minHeight: 320,
              }}
              className="relative overflow-hidden"
            >
              <Mockup />
            </div>

            {/* Slide controls */}
            <div className="flex items-center gap-4 mt-4">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  style={{
                    background: i === activeSlide ? '#2abfdc' : 'rgba(255,255,255,0.15)',
                    height: 2,
                    width: i === activeSlide ? 32 : 16,
                    transition: 'all 0.3s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom divider line */}
      <div className="h-px w-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
      </div>
    </section>
  )
}
