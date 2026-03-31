import React from 'react'
import { GlobeLive } from '@/components/ui/globe-live'

interface FeatureData {
  id: string
  num: string
  tag: string
  title: string
  copy: string
  bullets: { label: string; desc: string }[]
  visual: React.ReactNode
  flip?: boolean
}

function SectionDivider({ num, tag }: { num: string; tag: string }) {
  return (
    <div className="flex items-center gap-3 mb-16">
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em' }} className="text-white/60 text-xs uppercase font-mono">{num} / {tag}</span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
    </div>
  )
}

// ── BIM mockup (dark angular)
function BimPanel() {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.14)', background: '#0b1a30' }} className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-white/65 text-xs font-mono uppercase tracking-wider">BIM 3D/4D/5D — Esgoto Sanitário</span>
        <div className="ml-auto flex gap-1">
          {['3D', '4D', '5D'].map((t, i) => (
            <span key={t} className="text-xs px-2 py-0.5 font-mono" style={i === 0 ? { background: '#2abfdc', color: '#000' } : { border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.70)' }}>{t}</span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[{l:'Trechos',v:'18'},{l:'Extensão',v:'910m'},{l:'Custo',v:'R$62k'}].map((k) => (
          <div key={k.l} style={{ border: '1px solid rgba(255,255,255,0.12)' }} className="p-3 text-center">
            <div className="text-white/60 text-xs uppercase tracking-wider">{k.l}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-white font-bold">{k.v}</div>
          </div>
        ))}
      </div>
      <div className="relative flex items-center justify-center" style={{ height: 140, background: '#071222', border: '1px solid rgba(255,255,255,0.10)' }}>
        <svg width="100%" height="100%" viewBox="0 0 400 140">
          {[0,1,2,3,4].map(i => <line key={i} x1={60+i*60} y1={15} x2={60+i*60} y2={125} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />)}
          {[0,1,2,3].map(i => <line key={i} x1={60} y1={20+i*30} x2={300} y2={20+i*30} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />)}
          <path d="M80,75 L140,55 L200,75 L260,55" stroke="#2abfdc" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M140,55 L140,95 L175,95" stroke="#2abfdc" strokeWidth="1.5" fill="none" />
          {([[80,75],[140,55],[200,75],[260,55]] as [number,number][]).map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r="4" fill="#2abfdc" />
          ))}
        </svg>
        <span className="absolute bottom-2 right-2 text-white/55 text-xs font-mono">Three.js WebGL</span>
      </div>
    </div>
  )
}

// ── Torre mockup
function TorrePanel() {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.14)', background: '#0b1a30' }} className="p-6">
      <div className="flex items-center justify-between mb-5">
        <span className="text-white/65 text-xs font-mono uppercase tracking-wider">Torre de Controle</span>
        <span className="text-white/55 text-xs font-mono">PRJ-001 ▾</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[{l:'EAC',v:'R$12.4M',c:'#f4f5f7'},{l:'CPI',v:'0.59',c:'#ef4444'},{l:'SPI',v:'0.39',c:'#f97316'}].map((k) => (
          <div key={k.l} style={{ border: '1px solid rgba(255,255,255,0.12)' }} className="p-3">
            <div className="text-white/60 text-xs uppercase tracking-wider mb-1">{k.l}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: k.c }} className="font-bold text-xl">{k.v}</div>
          </div>
        ))}
      </div>
      {[
        { id: 'PRJ-001', name: 'Torre Residencial', s: 'CRÍTICO', c: '#ef4444' },
        { id: 'PRJ-002', name: 'Galpão Industrial', s: 'ALERTA', c: '#f97316' },
        { id: 'PRJ-004', name: 'Rede Drenagem SP', s: 'OK', c: '#22c55e' },
      ].map((p) => (
        <div key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }} className="flex items-center gap-3 py-2.5">
          <span className="text-white/60 text-xs font-mono w-16">{p.id}</span>
          <span className="text-white/85 text-xs flex-1">{p.name}</span>
          <span className="text-xs font-mono tracking-wider" style={{ color: p.c }}>{p.s}</span>
        </div>
      ))}
    </div>
  )
}

// ── Suprimentos mockup
function SuprPanel() {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.14)', background: '#0b1a30' }} className="p-6">
      <div className="text-white/65 text-xs font-mono uppercase tracking-wider mb-5">Suprimentos — Three-Way Match</div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[{l:'PO #1047',v:'R$84k'},{l:'GRN Recebido',v:'R$84k'},{l:'NF 000134',v:'R$84k'}].map((k) => (
          <div key={k.l} style={{ border: '1px solid rgba(255,255,255,0.12)' }} className="p-3 text-center">
            <div className="text-white/60 text-xs font-mono mb-1">{k.l}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-white font-bold">{k.v}</div>
          </div>
        ))}
      </div>
      <div style={{ border: '1px solid rgba(42,191,220,0.2)', background: 'rgba(42,191,220,0.05)' }} className="py-2.5 text-center mb-4">
        <span className="text-[#2abfdc] text-xs font-mono uppercase tracking-wider">✓ Three-Way Match — Aprovado</span>
      </div>
      {[{s:'Votorantim Cimentos',p:'98%',c:'#22c55e'},{s:'TubPlast DN200',p:'85%',c:'#eab308'},{s:'Ferro & Aço Ltda',p:'72%',c:'#ef4444'}].map((r) => (
        <div key={r.s} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }} className="flex items-center gap-3 py-2">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.c }} />
          <span className="text-white/80 text-xs flex-1">{r.s}</span>
          <span className="text-white/90 text-xs font-mono">{r.p}</span>
        </div>
      ))}
    </div>
  )
}

// ── MO mockup
function MoPanel() {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.14)', background: '#0b1a30' }} className="p-6">
      <div className="text-white/65 text-xs font-mono uppercase tracking-wider mb-5">Mão de Obra — Alocação Diária</div>
      {[
        {n:'Carlos M.',r:'Encanador',cert:'NR-10 ✓',h:'8h',ok:true},
        {n:'João S.',r:'Operador',cert:'NR-35 ✓',h:'8h',ok:true},
        {n:'Ana R.',r:'Auxiliar',cert:'ASO ⚠',h:'—',ok:false},
      ].map((w) => (
        <div key={w.n} style={{ border: `1px solid ${w.ok ? 'rgba(255,255,255,0.12)' : 'rgba(239,68,68,0.2)'}`, background: w.ok ? 'transparent' : 'rgba(239,68,68,0.04)' }} className="flex items-center gap-3 p-3 mb-2">
          <div className="w-7 h-7 shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: 'rgba(255,255,255,0.14)' }}>
            {w.n.split(' ').map(n=>n[0]).join('')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white/90 text-xs font-medium">{w.n} · {w.r}</div>
            <div className="text-white/65 text-xs font-mono">{w.cert}</div>
          </div>
          <span className="text-white/80 text-xs font-mono">{w.h}</span>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div style={{ border: '1px solid rgba(255,255,255,0.12)' }} className="p-2 text-center">
          <div style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-white font-bold text-lg">24</div>
          <div className="text-white/65 text-xs uppercase tracking-wider">Colaboradores</div>
        </div>
        <div style={{ border: '1px solid rgba(42,191,220,0.15)', background: 'rgba(42,191,220,0.06)' }} className="p-2 text-center">
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#2abfdc' }} className="font-bold text-lg">192h</div>
          <div className="text-white/65 text-xs uppercase tracking-wider">Hoje</div>
        </div>
      </div>
    </div>
  )
}

// ── RDO mockup
function RdoPanel() {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.14)', background: '#0b1a30' }} className="p-6">
      <div className="flex items-center justify-between mb-5">
        <span className="text-white/65 text-xs font-mono uppercase tracking-wider">RDO — 27/03/2026</span>
        <span className="text-white/60 text-xs font-mono">OBR-001</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[{l:'Clima',v:'☀ Ensolarado'},{l:'Equipes',v:'4 ativas'},{l:'Responsável',v:'Eng. Carlos'}].map((k) => (
          <div key={k.l} style={{ border: '1px solid rgba(255,255,255,0.12)' }} className="p-2 text-center">
            <div className="text-white/60 text-xs uppercase mb-0.5">{k.l}</div>
            <div className="text-white/90 text-xs">{k.v}</div>
          </div>
        ))}
      </div>
      {[
        { code: 'T01', desc: 'Escavação Av. Principal', qty: '42m', pct: 65 },
        { code: 'T02', desc: 'Assentamento DN200', qty: '28m', pct: 45 },
      ].map((a) => (
        <div key={a.code} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }} className="py-2.5">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-white/80 font-mono">{a.code}</span>
            <span className="text-white/85">{a.desc}</span>
            <span style={{ color: '#2abfdc' }} className="font-mono">{a.qty}</span>
          </div>
          <div className="h-px" style={{ background: 'rgba(255,255,255,0.14)' }}>
            <div className="h-full" style={{ width: `${a.pct}%`, background: '#2abfdc' }} />
          </div>
        </div>
      ))}
      <div style={{ border: '1px solid rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.05)' }} className="mt-3 p-3">
        <span className="text-amber-300/85 text-xs">🤖 IA: Progresso 2h à frente do planejado.</span>
      </div>
    </div>
  )
}

// ── AI mockup
function AiPanel() {
  const msgs = [
    { role:'sys', t:'Analisando dados de RDO, BIM e Suprimentos...'},
    { role:'alert', t:'⚠ Detectado atraso de 15% na armação do T07. Sugestão: Realocar equipe de hidráulica para suporte imediato e ajustar pedido de concreto para evitar sobrecarga no próximo turno.'},
    { role:'user', t:'Qual o impacto no prazo final?'},
    { role:'bot', t:'Com a realocação sugerida: +2 dias. Sem intervenção: +8 dias e R$24.000 em multa contratual.'},
  ]
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.14)', background: '#0b1a30' }} className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#2abfdc] animate-pulse" />
        <span className="text-white/65 text-xs font-mono uppercase tracking-wider">Atlântico AI — Copiloto de Obra</span>
      </div>
      <div className="space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`text-xs ${m.role === 'user' ? 'text-right' : ''}`}>
            <div
              className="inline-block max-w-[90%] px-3 py-2 leading-relaxed"
              style={
                m.role === 'user' ? { background: 'rgba(42,191,220,0.12)', border: '1px solid rgba(42,191,220,0.2)', color: '#2abfdc' } :
                m.role === 'alert' ? { background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', color: 'rgba(251,191,36,0.8)' } :
                m.role === 'sys' ? { color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' } :
                { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.90)' }
              }
            >
              {m.t}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const FEATURES: FeatureData[] = [
  {
    id: 'bim', num: '03', tag: 'BIM 3D/4D/5D',
    title: 'BIM 3D/4D/5D: Visualize, Simule, Otimize.',
    copy: 'Transforme a gestão do ciclo de vida do projeto com o BIM integrado da Atlântico. Vá além da visualização 3D: simule o cronograma (4D) e analise custos em tempo real (5D) diretamente no modelo.',
    bullets: [
      { label: 'Simulação 4D Dinâmica', desc: 'Teste cenários de cronograma e veja a obra evoluir virtualmente antes da execução física.' },
      { label: 'Heatmap 5D de Custos', desc: 'Identifique e mitigue gargalos financeiros visualmente no modelo 3D.' },
      { label: 'Acessibilidade Universal', desc: 'BIM na web, sem softwares pesados, para engenheiros e clientes.' },
    ],
    visual: <BimPanel />,
    flip: false,
  },
  {
    id: 'torre', num: '04', tag: 'Torre de Controle',
    title: 'Torre de Controle: Visão Estratégica, Decisão Instantânea.',
    copy: 'Elimine a dependência de relatórios estáticos. A Torre de Controle da Atlântico oferece uma visão de "War Room" para gerenciar seu portfólio de projetos com inteligência executiva.',
    bullets: [
      { label: 'KPIs em Tempo Real', desc: 'Curva-S, CPI, SPI e alertas críticos atualizados instantaneamente.' },
      { label: 'Matriz de Risco RAG', desc: 'Identifique projetos em alerta (Vermelho/Amarelo/Verde) num relance.' },
      { label: 'Feed de Alertas Inteligente', desc: 'Incidentes climáticos, atrasos e estouros de orçamento priorizados por IA.' },
    ],
    visual: <TorrePanel />,
    flip: true,
  },
  {
    id: 'mapa', num: '05', tag: 'Mapa Interativo',
    title: 'Mapa Interativo: Projetando e Gerenciando Redes com Precisão.',
    copy: 'Revolucione o planejamento e a execução de projetos de infraestrutura. O Mapa Interativo da Atlântico permite importar dados topográficos (UTM) e visualizar redes de esgoto, água e drenagem.',
    bullets: [
      { label: 'Importação UTM Inteligente', desc: 'Converta dados de campo em redes digitais em segundos, com auto-detecção de coordenadas.' },
      { label: 'Perfil de Elevação 3D', desc: 'Gere gráficos automáticos de declividade e profundidade ao longo das redes.' },
      { label: 'Análise de Custo por Trecho', desc: 'Obtenha estimativas financeiras precisas baseadas na extensão real do mapa.' },
    ],
    visual: (
      <div className="flex flex-col gap-3">
        <GlobeLive className="w-full max-w-xs mx-auto" projectCount={247} />
        <p className="text-white/60 text-xs text-center font-mono">Arraste para explorar · São Paulo, Rio, Brasília</p>
      </div>
    ),
    flip: false,
  },
  {
    id: 'suprimentos', num: '06', tag: 'Suprimentos',
    title: 'Suprimentos Inteligentes: Automação e Conformidade.',
    copy: 'Simplifique e automatize todo o ciclo de suprimentos com a Atlântico. Nossa funcionalidade de Three-Way Match valida automaticamente Pedidos de Compra, Recebimentos e Notas Fiscais.',
    bullets: [
      { label: 'Three-Way Match Automatizado', desc: 'Validação instantânea PO × GRN × NF, com detecção de discrepâncias por IA.' },
      { label: 'Previsão de Necessidades', desc: 'Modelagem dinâmica de estoque e recomendações de compra inteligentes.' },
      { label: 'Scorecard de Fornecedores', desc: 'Avalie a performance de entrega e qualidade de cada parceiro.' },
    ],
    visual: <SuprPanel />,
    flip: true,
  },
  {
    id: 'mao-de-obra', num: '07', tag: 'Mão de Obra',
    title: 'Mão de Obra: Otimização e Segurança no Canteiro.',
    copy: 'A gestão de equipes é um dos maiores desafios da construção. A Atlântico empodera sua força de trabalho com ferramentas digitais que vão do registro à alocação diária.',
    bullets: [
      { label: 'Registro Completo de Colaboradores', desc: 'Perfis detalhados, certificações e alertas de vencimento (NR-10, NR-35, ASO).' },
      { label: 'Alocação Diária Inteligente', desc: 'Atribua equipes e recursos a projetos e atividades com base na demanda e disponibilidade.' },
      { label: 'Digitalização de Processos', desc: 'Reduza a burocracia e melhore a comunicação entre campo e escritório.' },
    ],
    visual: <MoPanel />,
    flip: false,
  },
  {
    id: 'rdo', num: '08', tag: 'RDO Inteligente',
    title: 'RDO Inteligente: Dados do Campo, Decisões no Escritório.',
    copy: 'O Relatório Diário de Obra da Atlântico transcende o registro manual. Ele é a fonte primária de dados para nossa ontologia, alimentando análises preditivas.',
    bullets: [
      { label: 'Coleta de Dados Estruturada', desc: 'Registre atividades, equipes, equipamentos, materiais e ocorrências de forma padronizada.' },
      { label: 'Integração com IA', desc: 'Dados do RDO alimentam o Copiloto de Obra para sugestões e alertas preditivos.' },
      { label: 'Evidências Fotográficas Inteligentes', desc: 'Análise de fotos com IA para validação de progresso e conformidade.' },
    ],
    visual: <RdoPanel />,
    flip: true,
  },
  {
    id: 'ai', num: '09', tag: 'Atlântico AI',
    title: 'Atlântico AI: A IA que Antecipa o Futuro da Sua Obra.',
    copy: 'A Atlântico não apenas registra o que aconteceu; ela prevê o que vai acontecer. Nosso motor de Inteligência Artificial (AIP) analisa dados em tempo real do RDO, BIM e ERP.',
    bullets: [
      { label: 'Detecção Preditiva de Riscos', desc: 'Identifica padrões de atraso e desvio orçamentário antes que se tornem problemas críticos.' },
      { label: 'Sugestões de Mitigação', desc: 'Recomenda realocação de recursos e ajustes de cronograma com base em dados históricos.' },
      { label: 'Integração Total', desc: 'Conectado ao RDO, BIM, Suprimentos e Mão de Obra para uma visão 360° do projeto.' },
    ],
    visual: <AiPanel />,
    flip: false,
  },
]

function FeatureBlock({ id, num, tag, title, copy, bullets, visual, flip }: FeatureData) {
  return (
    <div id={id} style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }} className="py-24 scroll-mt-14">
      <div className="max-w-7xl mx-auto px-6">
        <SectionDivider num={num} tag={tag} />
        <div className={`grid lg:grid-cols-2 gap-16 items-start ${flip ? 'lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1' : ''}`}>
          {/* Copy */}
          <div>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 'clamp(1.5rem, 2.5vw, 2.2rem)',
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
                color: '#f4f5f7',
              }}
              className="mb-5"
            >
              {title}
            </h2>
            <p className="text-white/75 text-sm leading-relaxed mb-8">{copy}</p>
            <div className="space-y-4">
              {bullets.map((b) => (
                <div key={b.label} className="flex gap-4 items-start">
                  <span className="text-[#2abfdc] mt-0.5 shrink-0 font-mono text-sm">—</span>
                  <div>
                    <span className="text-white/90 text-sm font-medium">{b.label}</span>
                    <span className="text-white/70 text-sm">: {b.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Visual */}
          <div>{visual}</div>
        </div>
      </div>
    </div>
  )
}

export function FeatureDeepSection() {
  return (
    <section id="funcionalidades" style={{ background: '#0b1a30' }}>
      {FEATURES.map((f, i) => (
        <div key={f.id} style={{ background: i % 2 === 0 ? '#0b1a30' : '#0f2240' }}>
          <FeatureBlock {...f} />
        </div>
      ))}
    </section>
  )
}
