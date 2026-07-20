/**
 * navigation.ts — single source of truth for the app's main navigation menu.
 *
 * Every component that renders the module list (AppLayout.tsx for the eKyte
 * theme, App.tsx's internal Sidebar for Dark/Light, and the legacy
 * components/shared/Sidebar.tsx) MUST import NAV_GROUPS / NAV_ITEMS_FLAT from
 * here instead of keeping its own copy. A prior audit found the eKyte theme
 * rendering a stale, hand-duplicated list that hid ~30 of 35 real modules —
 * this file exists so the three lists can never drift apart again.
 */
import type { LucideIcon } from 'lucide-react'
import {
  BookOpen, Layers, Play, FolderKanban, Cpu, Filter, Target, FileSearch,
  CalendarClock, ClipboardList, Droplets, Waves, FileSpreadsheet, Calendar,
  Calculator, Users, FileText, MessageSquare, CheckSquare, UserCircle, Wrench,
  Brain, UserCog, GitBranch,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

export interface NavGroup {
  id: string
  category: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'ajuda', category: 'Ajuda',
    items: [
      { label: 'Guia — Como usar', to: '/app/guia', icon: BookOpen },
    ],
  },
  {
    id: 'gestao', category: 'Gestão',
    items: [
      { label: 'Gestão 360', to: '/app/gestao-360', icon: Layers },
      { label: 'Torre Controle', to: '/app/torre-de-controle', icon: Play },
      { label: 'Projetos', to: '/app/projetos', icon: FolderKanban },
    ],
  },
  {
    id: 'engenharia', category: 'Engenharia',
    items: [
      { label: 'Motor NS V5', to: '/app/ns-v5', icon: Cpu },
      { label: 'Mapa / GIS', to: '/app/mapa-interativo', icon: Filter },
      { label: 'BIM 3D/4D/5D', to: '/app/bim', icon: Layers },
      { label: 'Rede 360', to: '/app/rede-360', icon: Target },
      { label: 'Pré-Construção', to: '/app/pre-construcao', icon: FileSearch },
    ],
  },
  {
    id: 'planejamento', category: 'Planejamento',
    items: [
      { label: 'Plan. Mestre', to: '/app/planejamento-mestre', icon: CalendarClock },
      { label: 'Programação Semana', to: '/app/programacao-semana', icon: ClipboardList },
      { label: 'Metas', to: '/app/meta-ligacoes', icon: Droplets },
      { label: 'Feito × A Fazer (NS)', to: '/app/ns-planejamento', icon: Waves },
      { label: 'Planilhas (Modelos)', to: '/app/planilhas', icon: FileSpreadsheet },
      { label: 'Agenda', to: '/app/agenda', icon: Calendar },
      { label: 'LPS / Lean', to: '/app/lps-lean', icon: Target },
      { label: 'EVM / Curva S', to: '/app/evm', icon: Calculator },
    ],
  },
  {
    id: 'financeiro', category: 'Financeiro',
    items: [
      { label: 'DRE & Resultado', to: '/app/dre-financeiro', icon: Calculator },
      { label: 'Medição (RDO)', to: '/app/medicao', icon: Calculator },
    ],
  },
  {
    id: 'operacao', category: 'Operação de Campo',
    items: [
      { label: 'Kanban Equipes', to: '/app/equipes-kanban', icon: Users },
      { label: 'RDO', to: '/app/rdo', icon: FileText },
      { label: 'Campo WhatsApp', to: '/app/campo-whatsapp', icon: MessageSquare },
      { label: 'Relatório 360', to: '/app/relatorio360', icon: ClipboardList },
      { label: 'Punch List', to: '/app/punch-list', icon: CheckSquare },
    ],
  },
  {
    id: 'recursos', category: 'Recursos',
    items: [
      { label: 'Suprimentos', to: '/app/suprimentos', icon: FolderKanban },
      { label: 'Mão de Obra', to: '/app/mao-de-obra', icon: UserCircle },
      { label: 'Equipamentos', to: '/app/gestao-equipamentos', icon: Wrench },
      { label: 'Quantitativos', to: '/app/quantitativos', icon: Calculator },
    ],
  },
  {
    id: 'ia', category: 'IA & Inteligência',
    items: [
      { label: 'Engine V5', to: '/app/engine-v5', icon: Cpu },
      { label: 'IA & Analytics', to: '/app/ia-analytics', icon: Brain },
      { label: 'Agente Chat', to: '/app/agent-chat', icon: MessageSquare },
      { label: 'Leitor PDF', to: '/app/leitor-pdf', icon: FileSearch },
    ],
  },
  {
    id: 'comunicacao', category: 'Comunicação',
    items: [
      { label: 'Contatos', to: '/app/gestao-contatos', icon: UserCog },
      { label: 'Fluxo Oper.', to: '/app/fluxo-operacional', icon: GitBranch },
      { label: 'WhatsApp RDO', to: '/app/whatsapp-rdo', icon: MessageSquare },
      { label: 'Diário WCR', to: '/app/wcr-diario', icon: FileText },
    ],
  },
]

export const NAV_ITEMS_FLAT: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)
