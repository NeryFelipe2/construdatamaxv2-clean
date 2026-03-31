import {
  BarChart3, Calendar, Truck, Building2, Monitor, Map, HardHat,
  Package, Users, ListChecks, ClipboardList, FileText, Calculator,
  Box, Car, Layers3, type LucideIcon
} from 'lucide-react'

const MODULES: { icon: LucideIcon; name: string; desc: string; cat: string }[] = [
  { icon: BarChart3, name: 'Relatório 360', desc: 'Dashboard executivo 360° com curva-S, alertas RAG e KPIs em tempo real.', cat: 'Visibilidade' },
  { icon: Calendar, name: 'Agenda / Cronograma', desc: 'Calendário de marcos com detecção automática de conflitos e exportação iCal/PDF.', cat: 'Planejamento' },
  { icon: Truck, name: 'Equipamentos', desc: 'Catálogo, alocação por projeto e manutenção preventiva com alertas automáticos.', cat: 'Recursos' },
  { icon: Building2, name: 'Projetos (BIM)', desc: 'Ciclo de vida completo com BIM 3D/4D/5D, fases de execução e orçamento.', cat: 'BIM' },
  { icon: Monitor, name: 'Torre de Controle', desc: 'Visão multiportfólio com CPI, SPI, ações em aberto e drill-down por projeto.', cat: 'Gestão' },
  { icon: Map, name: 'Mapa Interativo', desc: 'Editor GIS com importação UTM, perfil 3D, análise de custo por trecho.', cat: 'GIS' },
  { icon: HardHat, name: 'Pré-Construção', desc: 'Due diligence, sondagens geotécnicas, licenças ambientais e viabilidade.', cat: 'Planejamento' },
  { icon: Package, name: 'Suprimentos', desc: 'Three-Way Match automatizado PO × GRN × NF com scorecard de fornecedores.', cat: 'Suprimentos' },
  { icon: Users, name: 'Mão de Obra', desc: 'Registro CLT/temporário, alocação diária, alertas de NR e geração de holerite.', cat: 'Recursos' },
  { icon: ListChecks, name: 'Planejamento', desc: 'CPM/Gantt, curva-S, simulação de atrasos what-if e análise ABC.', cat: 'Planejamento' },
  { icon: ClipboardList, name: 'LPS / Lean', desc: 'Last Planner System com look-ahead 6 semanas, PPC semanal e restrições.', cat: 'Lean' },
  { icon: FileText, name: 'RDO', desc: 'Relatório Diário de Obra digital com IA preditiva, financeiro e PDF.', cat: 'Campo' },
  { icon: Calculator, name: 'Quantitativos', desc: 'BOQ com base SINAPI/SEINFRA, BDI configurável e exportação Excel/CSV.', cat: 'Orçamento' },
  { icon: Box, name: 'BIM 3D/4D/5D', desc: 'Visualizador BIM standalone com simulação temporal e heatmap de custos.', cat: 'BIM' },
  { icon: Car, name: 'Frota', desc: 'Frota própria e alugada com log de viagens, combustível e manutenção preventiva.', cat: 'Recursos' },
  { icon: Layers3, name: 'Gestão 360', desc: 'JobCosting EVM, Ordens de Mudança, Centro de Comando e Simulação de Atrasos.', cat: 'Gestão' },
]

export function AllModulesGrid() {
  return (
    <section style={{ background: '#0f2240', borderTop: '1px solid rgba(255,255,255,0.10)' }} className="py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-16">
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em' }} className="text-white/60 text-xs uppercase font-mono">10 / Todos os Módulos</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
        </div>

        <div className="grid lg:grid-cols-2 gap-x-16 mb-16">
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(1.6rem, 3vw, 2.5rem)',
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
            }}
            className="text-white"
          >
            Plataforma Completa para Construção e Saneamento
          </h2>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-12 gap-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="col-span-1" />
          <div className="col-span-4 text-white/60 text-xs uppercase tracking-widest">Módulo</div>
          <div className="col-span-5 text-white/60 text-xs uppercase tracking-widest hidden md:block">Descrição</div>
          <div className="col-span-2 text-white/60 text-xs uppercase tracking-widest hidden lg:block">Categoria</div>
        </div>

        {/* Table rows */}
        {MODULES.map(({ icon: Icon, name, desc, cat }) => (
          <div
            key={name}
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            className="grid grid-cols-12 gap-4 py-4 hover:bg-white/[0.04] transition-colors group cursor-default"
          >
            <div className="col-span-1 flex items-center">
              <Icon size={14} className="text-white/55 group-hover:text-[#2abfdc] transition-colors" />
            </div>
            <div className="col-span-4 md:col-span-4 flex items-center">
              <span style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-white/80 text-sm font-medium group-hover:text-white transition-colors">{name}</span>
            </div>
            <div className="col-span-12 md:col-span-5 flex items-center pl-5 md:pl-0">
              <span className="text-white/70 text-xs leading-relaxed">{desc}</span>
            </div>
            <div className="hidden lg:flex col-span-2 items-center">
              <span style={{ border: '1px solid rgba(255,255,255,0.14)', letterSpacing: '0.06em' }} className="text-white/60 text-xs uppercase px-2 py-0.5">{cat}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
