import { useState, useEffect } from 'react'
import { Calendar, ListChecks, FileText, Calculator, Monitor, Map, ArrowRight } from 'lucide-react'
import { FlowHoverButton } from '@/components/ui/flow-hover-button'

/* ── Section divider ─────────────────────────────────────────────── */
function SectionDivider({ num, tag }: { num: string; tag: string }) {
  return (
    <div className="flex items-center gap-3 mb-16">
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em' }} className="text-white/60 text-xs uppercase font-mono">{num} / {tag}</span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
    </div>
  )
}

/* ── Data ─────────────────────────────────────────────────────────── */
const MODULES = [
  { icon: Calendar, name: 'Agenda / Cronograma', desc: 'Calendário de marcos com detecção de conflitos e alertas automáticos.' },
  { icon: ListChecks, name: 'LPS / Lean', desc: 'Last Planner System com look-ahead 6 semanas e PPC semanal.' },
  { icon: FileText, name: 'RDO', desc: 'Relatório Diário de Obra digital com IA preditiva e análise de campo.' },
  { icon: Calculator, name: 'Quantitativos', desc: 'BOQ com base SINAPI/SEINFRA, BDI configurável e exportação.' },
  { icon: Monitor, name: 'Torre de Controle', desc: 'Visão war room multiportfólio com CPI, SPI e drill-down.' },
  { icon: Map, name: 'Mapa Interativo', desc: 'Editor GIS com importação UTM, perfil 3D e análise de custos.' },
]

const OBJECTIVES = [
  { label: 'Transparência Total', desc: 'Dados integrados e acessíveis em tempo real para todos os stakeholders' },
  { label: 'Eficiência Operacional', desc: 'Redução de desperdício e retrabalho através de automação inteligente' },
  { label: 'Decisões Baseadas em Dados', desc: 'IA que antecipa riscos e sugere ações antes que problemas aconteçam' },
  { label: 'Acessibilidade Universal', desc: 'Plataforma web-based, sem softwares pesados, para toda a equipe' },
]

const TESTIMONIALS = [
  {
    company: 'Construtora Maranata',
    quote: 'A Atlântico transformou completamente nossa gestão de obras. O RDO inteligente nos deu visibilidade que nunca tivemos antes.',
    name: 'Carlos Mendes',
    role: 'Diretor de Engenharia',
  },
  {
    company: 'Saneamento Nordeste S.A.',
    quote: 'O Mapa Interativo e o controle de redes nos permitiu reduzir em 30% o tempo de planejamento de novas extensões.',
    name: 'Ana Ribeiro',
    role: 'Gerente de Projetos',
  },
  {
    company: 'Infratech Engenharia',
    quote: 'Com o LPS da Atlântico, nosso PPC subiu de 38% para 72% em 4 meses. A diferença é visível no canteiro.',
    name: 'Roberto Silva',
    role: 'Coordenador de Planejamento',
  },
]

/* ── Component ────────────────────────────────────────────────────── */
export function ShowcaseSection() {
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  // Auto-rotate testimonials on desktop
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (isMobile) return
    const timer = setInterval(() => setActiveTestimonial((s) => (s + 1) % TESTIMONIALS.length), 5000)
    return () => clearInterval(timer)
  }, [isMobile])

  return (
    <section>
      {/* ── A) AI Headline Block ──────────────────────────────────── */}
      <div style={{ background: '#0b1a30', borderTop: '1px solid rgba(255,255,255,0.10)' }} className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <SectionDivider num="10" tag="AUTOMAÇÃO IA" />

          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(1.8rem, 3.5vw, 3rem)',
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
              color: '#f4f5f7',
            }}
            className="max-w-4xl mb-6"
          >
            Automação Alimentada por Inteligência Artificial para Cada Decisão
          </h2>

          <p className="text-white/75 text-base leading-relaxed max-w-3xl">
            Nosso software alimenta decisões em tempo real, impulsionadas por IA, em operações críticas de construção e saneamento — do canteiro de obras ao escritório executivo.
          </p>
        </div>
      </div>

      {/* ── B) Software / Modules Grid ────────────────────────────── */}
      <div style={{ background: '#0f2240' }} className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-px" style={{ background: 'rgba(255,255,255,0.10)' }}>
            {MODULES.map(({ icon: Icon, name, desc }) => (
              <div
                key={name}
                style={{ background: '#0f2240' }}
                className="group p-6 flex flex-col gap-3 hover:bg-[#0b1a30] transition-colors cursor-default"
              >
                <Icon size={18} className="text-white/60 group-hover:text-[#2abfdc] transition-colors" />
                <div>
                  <div
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    className="text-white/90 font-semibold text-sm mb-1 group-hover:text-white transition-colors"
                  >
                    {name}
                  </div>
                  <div className="text-white/70 text-xs leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── C) Mission & Values ────────────────────────────────────── */}
      <div style={{ background: '#0b1a30', borderTop: '1px solid rgba(255,255,255,0.10)' }} className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Left — Mission */}
            <div style={{ borderLeft: '3px solid #2abfdc' }} className="pl-6">
              <h3
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 'clamp(1.4rem, 2.5vw, 2rem)',
                  lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                  color: '#f4f5f7',
                }}
                className="mb-5"
              >
                Nossa Missão
              </h3>
              <p className="text-white/75 text-sm leading-relaxed">
                Empoderar equipes de construção e saneamento com inteligência operacional de classe mundial. Acreditamos que dados conectados, automação inteligente e interfaces intuitivas transformam a maneira como projetos de infraestrutura são planejados, executados e entregues — eliminando desperdício, reduzindo riscos e acelerando resultados para toda a cadeia de valor.
              </p>
            </div>

            {/* Right — Objectives */}
            <div className="space-y-6">
              {OBJECTIVES.map((obj) => (
                <div key={obj.label} className="flex gap-4 items-start">
                  <div className="w-2 h-2 rounded-full bg-[#2abfdc] mt-1.5 shrink-0" />
                  <div>
                    <span className="text-white/90 text-sm font-medium">{obj.label}</span>
                    <span className="text-white/70 text-sm"> — {obj.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── D) Quote Block ─────────────────────────────────────────── */}
      <div style={{ background: '#0f2240' }} className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              fontSize: 'clamp(1.2rem, 2.2vw, 1.7rem)',
              lineHeight: 1.4,
              letterSpacing: '-0.01em',
              color: 'rgba(255,255,255,0.90)',
            }}
            className="mb-8"
          >
            &ldquo;Há tanto ainda a ser construído. A Atlântico entrega resultados decisivos para as instituições mais importantes da construção civil e saneamento.&rdquo;
          </p>
          <a
            href="#contato"
            className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wider transition-colors hover:opacity-80"
            style={{ color: '#2abfdc', letterSpacing: '0.12em' }}
          >
            SAIBA MAIS <ArrowRight size={14} />
          </a>
        </div>
      </div>

      {/* ── E) Testimonials ────────────────────────────────────────── */}
      <div style={{ background: '#0b1a30' }} className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <SectionDivider num="11" tag="PARCEIROS" />

          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(1.6rem, 3vw, 2.5rem)',
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: '#f4f5f7',
            }}
            className="mb-16"
          >
            O Que Nossos Parceiros Dizem
          </h2>

          {/* Desktop: carousel */}
          <div className="hidden md:block">
            <div className="relative overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${activeTestimonial * 100}%)` }}
              >
                {TESTIMONIALS.map((t) => (
                  <div key={t.name} className="w-full shrink-0 px-1">
                    <div
                      style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'transparent' }}
                      className="p-8 max-w-2xl mx-auto"
                    >
                      <div className="text-sm font-medium mb-4" style={{ color: '#2abfdc', fontFamily: "'Space Grotesk', sans-serif" }}>
                        {t.company}
                      </div>
                      <p className="text-white/80 text-base leading-relaxed mb-6">
                        &ldquo;{t.quote}&rdquo;
                      </p>
                      <div>
                        <span className="text-white/65 text-sm">{t.name}</span>
                        <span className="text-white/45 text-sm"> — {t.role}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Slide indicators */}
            <div className="flex items-center gap-4 mt-8 justify-center">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTestimonial(i)}
                  style={{
                    background: i === activeTestimonial ? '#2abfdc' : 'rgba(255,255,255,0.15)',
                    height: 2,
                    width: i === activeTestimonial ? 32 : 16,
                    transition: 'all 0.3s',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Mobile: vertical stack */}
          <div className="md:hidden space-y-4">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                style={{ border: '1px solid rgba(255,255,255,0.14)' }}
                className="p-6"
              >
                <div className="text-sm font-medium mb-3" style={{ color: '#2abfdc', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {t.company}
                </div>
                <p className="text-white/80 text-sm leading-relaxed mb-4">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <span className="text-white/65 text-xs">{t.name}</span>
                  <span className="text-white/45 text-xs"> — {t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── F) CTA Block ───────────────────────────────────────────── */}
      <div style={{ background: '#0f2240' }} className="py-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-center gap-4">
          <FlowHoverButton variant="accent" href="#contato">
            Solicitar Demonstração
          </FlowHoverButton>
          <FlowHoverButton variant="ghost" href="/app/gestao-360">
            Comece a Construir
          </FlowHoverButton>
        </div>
      </div>
    </section>
  )
}
