import {
  BarChart3, Calendar, Truck, Building2, Monitor, Map, HardHat,
  Package, Users, ListChecks, ClipboardList, FileText, Calculator,
  Box, Car, Layers3
} from 'lucide-react'

const MODULOS = [
  { icon: BarChart3, label: 'Relatório 360', desc: 'Dashboard executivo 360° com curva-S, alertas RAG e KPIs em tempo real.', href: '#funcionalidades' },
  { icon: Calendar, label: 'Agenda / Cronograma', desc: 'Calendário de marcos com detecção automática de conflitos e exportação iCal.', href: '#funcionalidades' },
  { icon: Truck, label: 'Equipamentos', desc: 'Catálogo, alocação por projeto e manutenção preventiva com alertas.', href: '#funcionalidades' },
  { icon: Building2, label: 'Projetos (BIM)', desc: 'Ciclo de vida completo com BIM 3D/4D/5D e controle de fases.', href: '#bim' },
  { icon: Monitor, label: 'Torre de Controle', desc: 'Visão "war room" multiportfólio com CPI, SPI e drill-down.', href: '#torre' },
  { icon: Map, label: 'Mapa Interativo', desc: 'Editor GIS com importação UTM, perfil 3D e análise 3D/4D/5D.', href: '#mapa' },
  { icon: HardHat, label: 'Pré-Construção', desc: 'Due diligence, geotécnica, licenças e viabilidade de projeto.', href: '#funcionalidades' },
  { icon: Package, label: 'Suprimentos', desc: 'Three-Way Match automatizado: PO × GRN × NF com IA.', href: '#suprimentos' },
  { icon: Users, label: 'Mão de Obra', desc: 'Registro, alocação diária, alertas de NR e geração de holerite.', href: '#mao-de-obra' },
  { icon: ListChecks, label: 'Planejamento', desc: 'CPM/Gantt, curva-S, simulação de atrasos e análise ABC.', href: '#funcionalidades' },
  { icon: ClipboardList, label: 'LPS / Lean', desc: 'Last Planner com look-ahead 6 semanas, PPC e restrições.', href: '#funcionalidades' },
  { icon: FileText, label: 'RDO', desc: 'Relatório Diário digital com IA preditiva e exportação PDF.', href: '#rdo' },
  { icon: Calculator, label: 'Quantitativos', desc: 'BOQ com base SINAPI/SEINFRA, BDI e exportação Excel/CSV.', href: '#funcionalidades' },
  { icon: Box, label: 'BIM 3D/4D/5D', desc: 'Visualizador BIM standalone com heatmap de custos e camadas.', href: '#bim' },
  { icon: Car, label: 'Frota', desc: 'Frota própria e alugada: viagens, combustível e manutenção.', href: '#funcionalidades' },
  { icon: Layers3, label: 'Gestão 360', desc: 'JobCosting EVM, Ordens de Mudança, Centro de Comando e Simulação.', href: '#funcionalidades' },
]

export function ModulosOverviewSection() {
  return (
    <section id="modulos" style={{ background: '#2c2c2c', borderTop: '1px solid rgba(255,255,255,0.10)' }} className="py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-16">
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em' }} className="text-white/60 text-xs uppercase font-mono">02 / Módulos</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
        </div>

        <div className="grid lg:grid-cols-2 gap-x-20 gap-y-4 mb-16">
          <div>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 'clamp(1.6rem, 3vw, 2.5rem)',
                lineHeight: 1.15,
                letterSpacing: '-0.01em',
              }}
              className="text-white mb-4"
            >
              Módulos e Funcionalidades: Do Registro à Decisão Acionável
            </h2>
          </div>
          <div>
            <p className="text-white/75 text-sm leading-relaxed">
              Cada módulo da Atlântico é uma peça fundamental para a inteligência operacional. Descrições focadas nos benefícios reais para sua operação.
            </p>
          </div>
        </div>

        {/* Module grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: 'rgba(255,255,255,0.10)' }}>
          {MODULOS.map(({ icon: Icon, label, desc, href }) => (
            <a
              key={label}
              href={href}
              style={{ background: '#2c2c2c' }}
              className="group p-6 flex flex-col gap-3 hover:bg-[#333333] transition-colors cursor-pointer"
            >
              <Icon size={16} className="text-white/60 group-hover:text-[#f97316] transition-colors" />
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-white/90 font-semibold text-sm mb-1 group-hover:text-white transition-colors">{label}</div>
                <div className="text-white/70 text-xs leading-relaxed">{desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
