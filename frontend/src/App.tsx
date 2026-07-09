import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet } from "react-router-dom";
import { Component, lazy, Suspense, useEffect, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useProjectContext } from "@/store/projectContext";
import type { DbProjeto } from "@/lib/supabase";
import { useThemeStore, LayoutTheme } from "@/store/themeStore";
import { useAppModeStore } from "@/store/appModeStore";
import { AppLayout } from "@/components/layout/AppLayout";
import { DemoBanner } from "@/components/shared/DemoBanner";
import { TourProvider } from "@/components/ui/GuidedTour";
import {
  Menu, X, ChevronLeft, ChevronRight, ChevronDown, Plus,
  Cpu, Radio, PackageSearch, Users, Wrench, Calendar,
  CalendarClock, Target, FileText, Calculator, Layers,
  Map, Network, LayoutDashboard, ClipboardList, FolderKanban,
  FileSearch, Monitor, MessageSquare, Building2, UserCog,
  GitBranch, CheckSquare, Sun, Moon, Brain, Palette, Waves,
  FileSpreadsheet, FlaskConical, Pencil, BookOpen,
} from "lucide-react";

// ─── Lazy-loaded modules ────────────────────────────────────────────────────
const TorreDeControlePage = lazy(() => import("@/features/torre-de-controle/index").then((m) => ({ default: m.TorreDeControlePage })));
const Gestao360Page = lazy(() => import("@/features/gestao-360/index").then((m) => ({ default: m.Gestao360Page })));
const SuprimentosPage = lazy(() => import("@/features/suprimentos/index").then((m) => ({ default: m.SuprimentosPage })));
const MaoDeObraPage = lazy(() => import("@/features/mao-de-obra/index").then((m) => ({ default: m.MaoDeObraPage })));
const OtimizacaoFrotaPage = lazy(() => import("@/features/otimizacao-frota/index").then((m) => ({ default: m.default })));
const GestaoEquipamentosPage = lazy(() => import("@/features/gestao-equipamentos/index").then((m) => ({ default: m.GestaoEquipamentosPage })));
const AgendaPage = lazy(() => import("@/features/agenda/index").then((m) => ({ default: m.AgendaPage })));
const PlanejamentoPage = lazy(() => import("@/features/planejamento/index").then((m) => ({ default: m.PlanejamentoPage })));
const Relatorio360Page = lazy(() => import("@/features/relatorio360/index").then((m) => ({ default: m.Relatorio360Page })));
const RdoListaPage = lazy(() => import("@/features/rdo-lista/index").then((m) => ({ default: m.RdoListaPage })));
const Rede360Page = lazy(() => import("@/features/rede-360/index").then((m) => ({ default: m.Rede360Page })));
const LpsPage = lazy(() => import("@/features/lps-lean/index").then((m) => ({ default: m.LpsPage })));
const BimPage = lazy(() => import("@/features/bim/index").then((m) => ({ default: m.BimPage })));
const MapaInterativoPage = lazy(() => import("@/features/mapa-interativo/index").then((m) => ({ default: m.MapaInterativoPage })));
const RdoPage = lazy(() => import("@/features/rdo/index").then((m) => ({ default: m.RdoPage })));
const QuantitativosPage = lazy(() => import("@/features/quantitativos/index").then((m) => ({ default: m.QuantitativosPage })));
const ProjetosPage = lazy(() => import("@/features/projetos/index").then((m) => ({ default: m.ProjetosPage })));
const PreConstrucaoPage = lazy(() => import("@/features/pre-construcao/index").then((m) => ({ default: m.PreConstrucaoPage })));
const WhatsAppRdoPage = lazy(() => import("@/features/whatsapp-rdo/index").then((m) => ({ default: m.WhatsAppRdoPage })));
const GestaoContatosPage = lazy(() => import("@/features/gestao-contatos/index").then((m) => ({ default: m.GestaoContatosPage })));
const FluxoOperacionalPage = lazy(() => import("@/features/fluxo-operacional/index").then((m) => ({ default: m.FluxoOperacionalPage })));
const PunchListPage = lazy(() => import("@/features/punch-list/index").then((m) => ({ default: m.PunchListPage })));
const IaAnalyticsPage = lazy(() => import("@/features/ia-analytics/index").then((m) => ({ default: m.IaAnalyticsPage })));
const GisEditorPage = lazy(() => import("@/features/gis-editor/index").then((m) => ({ default: m.GisEditorPage })));
const EvmPage = lazy(() => import("@/features/evm/index").then((m) => ({ default: m.EvmPage })));
const PlanejamentoMestrePage = lazy(() => import("@/features/planejamento-mestre/index").then((m) => ({ default: m.PlanejamentoMestrePage })));
const NsPlanejamentoPage = lazy(() => import("@/features/ns-planejamento/index").then((m) => ({ default: m.NsPlanejamentoPage })));
const OperacaoCampoPage = lazy(() => import("@/features/operacao-campo/index").then((m) => ({ default: m.OperacaoCampoPage })));
const MotorNsV5Page = lazy(() => import("@/features/motor-ns-v5/index").then((m) => ({ default: m.MotorNsV5Page })));
const LeitorPdfPage = lazy(() => import("@/features/leitor-pdf/index").then((m) => ({ default: m.LeitorPdfPage })));
const EngineV5Dashboard = lazy(() => import("@/features/engine-v5/index").then((m) => ({ default: m.default })));
const DreFinanceiroPage = lazy(() => import("@/features/dre-financeiro/index").then((m) => ({ default: m.DreFinanceiroPage })));
const MedicaoPage = lazy(() => import("@/features/medicao/index").then((m) => ({ default: m.MedicaoPage })));
const AgentChatPage = lazy(() => import("@/features/agent-chat/index").then((m) => ({ default: m.AgentChatPage })));
const WcrDiarioPage = lazy(() => import("@/features/wcr-diario/index").then((m) => ({ default: m.WcrDiarioPage })));
const EquipesKanbanPage = lazy(() => import("@/features/equipes-kanban/index"));
const DiarioObraPage = lazy(() => import("@/features/diario-obra/index").then((m) => ({ default: m.DiarioObraPage })));
const PlanilhasModeloPage = lazy(() => import("@/features/planilhas-modelo/index").then((m) => ({ default: m.PlanilhasModeloPage })));
const GuiaPage = lazy(() => import("@/features/guia/index").then((m) => ({ default: m.GuiaPage })));

// ─── Nav items (used by Dark/Light sidebar) ─────────────────────────────────
const navItems = [
  { section: "Ajuda" },
  { label: "Guia — Como usar", icon: BookOpen, to: "/app/guia" },
  { section: "Gestão" },
  { label: "Gestão 360", icon: LayoutDashboard, to: "/app/gestao-360" },
  { label: "Torre Controle", icon: Radio, to: "/app/torre-de-controle" },
  { label: "Projetos", icon: FolderKanban, to: "/app/projetos" },
  { section: "Engenharia" },
  { label: "Motor NS V5", icon: Monitor, to: "/app/ns-v5" },
  { label: "Mapa / GIS", icon: Map, to: "/app/mapa-interativo" },
  { label: "BIM 3D/4D/5D", icon: Layers, to: "/app/bim" },
  { label: "Rede 360", icon: Network, to: "/app/rede-360" },
  { label: "Pré-Construção", icon: FileSearch, to: "/app/pre-construcao" },
  { section: "Planejamento" },
  { label: "Plan. Mestre", icon: CalendarClock, to: "/app/planejamento-mestre" },
  { label: "Feito × A Fazer (NS)", icon: Waves, to: "/app/ns-planejamento" },
  { label: "Planilhas (Modelos)", icon: FileSpreadsheet, to: "/app/planilhas" },
  { label: "Agenda", icon: Calendar, to: "/app/agenda" },
  { label: "LPS / Lean", icon: Target, to: "/app/lps-lean" },
  { label: "EVM / Curva S", icon: Calculator, to: "/app/evm" },
  { section: "Financeiro" },
  { label: "DRE & Resultado", icon: Calculator, to: "/app/dre-financeiro" },
  { label: "Medição (RDO)", icon: Calculator, to: "/app/medicao" },
  { section: "Operação de Campo" },
  { label: "Kanban Equipes", icon: Users, to: "/app/equipes-kanban" },
  { label: "Diário de Obra", icon: FileText, to: "/app/diario-obra" },
  { label: "RDO", icon: FileText, to: "/app/rdo" },
  { label: "RDOs WhatsApp (Live)", icon: FileText, to: "/app/rdo-lista" },
  { label: "Relatório 360", icon: ClipboardList, to: "/app/relatorio360" },
  { label: "Punch List", icon: CheckSquare, to: "/app/punch-list" },
  { section: "Recursos" },
  { label: "Suprimentos", icon: PackageSearch, to: "/app/suprimentos" },
  { label: "Mão de Obra", icon: Users, to: "/app/mao-de-obra" },
  { label: "Equipamentos", icon: Wrench, to: "/app/gestao-equipamentos" },
  { label: "Quantitativos", icon: Calculator, to: "/app/quantitativos" },
  { section: "IA & Inteligência" },
  { label: "Engine V5", icon: Cpu, to: "/app/engine-v5" },
  { label: "IA & Analytics", icon: Brain, to: "/app/ia-analytics" },
  { label: "Agente Chat", icon: MessageSquare, to: "/app/agent-chat" },
  { label: "Leitor PDF", icon: FileSearch, to: "/app/leitor-pdf" },
  { section: "Comunicação" },
  { label: "Contatos", icon: UserCog, to: "/app/gestao-contatos" },
  { label: "Fluxo Oper.", icon: GitBranch, to: "/app/fluxo-operacional" },
  { label: "WhatsApp RDO", icon: MessageSquare, to: "/app/whatsapp-rdo" },
  { label: "Diário WCR", icon: FileText, to: "/app/wcr-diario" },
] as const;

// ─── Loading fallback ───────────────────────────────────────────────────────
function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-gray-600 border-t-cyan-500 rounded-full animate-spin" />
        <span className="text-sm">Carregando módulo...</span>
      </div>
    </div>
  );
}
// Isola crashes de página: sem isso, uma exceção em qualquer módulo desmonta a
// árvore React inteira e o app vira tela em branco sem menu.
class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro no módulo da rota:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-3">
            <div className="text-red-600 font-bold text-sm">Este módulo encontrou um erro</div>
            <div className="text-red-500 text-xs font-mono break-all">{this.state.error.message}</div>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <RouteErrorBoundary>{children}</RouteErrorBoundary>
    </Suspense>
  );
}

// ─── Theme Switcher FAB (floating action button) ────────────────────────────
const THEME_META: Record<LayoutTheme, { emoji: string; label: string; next: string }> = {
  ekyte:  { emoji: "🔵", label: "eKyte",  next: "Dark" },
  dark:   { emoji: "🌑", label: "Dark",   next: "Light" },
  light:  { emoji: "☀️", label: "Light",  next: "eKyte" },
};

function ThemeSwitcherFab() {
  const theme = useThemeStore((s) => s.theme);
  const cycleTheme = useThemeStore((s) => s.cycleTheme);
  const meta = THEME_META[theme];

  return (
    <button
      onClick={cycleTheme}
      title={`Tema atual: ${meta.label} — Clique para ${meta.next}`}
      className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-full shadow-2xl border backdrop-blur-md transition-all hover:scale-105 active:scale-95"
      style={{
        background: theme === 'dark' ? 'rgba(13,32,64,0.95)' : theme === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(47,85,229,0.95)',
        borderColor: theme === 'dark' ? '#20406a' : theme === 'light' ? '#e5e7eb' : 'rgba(255,255,255,0.3)',
        color: theme === 'light' ? '#333' : '#fff',
      }}
    >
      <Palette size={16} />
      <span className="text-xs font-semibold">{meta.emoji} {meta.label}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DARK / LIGHT SIDEBAR SHELL (original design — restored)
// ═══════════════════════════════════════════════════════════════════════════
const SIDEBAR_KEY = "cdata-sidebar";

function Sidebar({ isDark, onClose }: { isDark: boolean; onClose?: () => void }) {
  const [isOpen, setIsOpen] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) !== "false"; } catch { return true; }
  });
  const cycleTheme = useThemeStore((s) => s.cycleTheme);
  const isDemoMode = useAppModeStore((s) => s.isDemoMode);
  const toggleDemoMode = useAppModeStore((s) => s.toggleDemoMode);

  function toggleSidebar() {
    setIsOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch {}
      return next;
    });
  }

  // Color tokens based on dark vs light
  const c = isDark
    ? { bg: "bg-[#0d2040]", border: "border-[#20406a]", logoBg: "bg-[#071422]", logoRing: "rgba(42,191,220,0.3)", logoShadow: "0 0 12px rgba(42,191,220,0.25)", logoText: "text-[#2abfdc]", title: "text-[#e4f2f8]", subtitle: "text-[#2abfdc]", section: "text-[#5a8caa]", itemDefault: "text-[#6b6b6b]", itemHover: "hover:bg-[#14294e] hover:text-[#8fb3c8]", itemActive: "bg-[#2abfdc]/12 text-[#2abfdc]" }
    : { bg: "bg-white", border: "border-gray-200", logoBg: "bg-blue-50", logoRing: "rgba(59,130,246,0.3)", logoShadow: "0 0 8px rgba(59,130,246,0.15)", logoText: "text-blue-600", title: "text-gray-900", subtitle: "text-blue-500", section: "text-gray-400", itemDefault: "text-gray-500", itemHover: "hover:bg-gray-100 hover:text-gray-800", itemActive: "bg-blue-50 text-blue-600" };

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 border-r h-full transition-[width] duration-200 ease-in-out overflow-hidden",
        c.bg, c.border,
        isOpen ? "w-[220px]" : "w-16",
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center h-14 border-b shrink-0 px-[14px] gap-3", c.border)}>
        <div
          className={cn("flex items-center justify-center w-9 h-9 rounded-xl shrink-0", c.logoBg)}
          style={{ boxShadow: c.logoShadow, border: `1px solid ${c.logoRing}` }}
        >
          <span className={cn("font-bold text-lg", c.logoText)}>C</span>
        </div>
        {isOpen && (
          <div className="flex flex-col leading-none">
            <span className={cn("text-sm font-bold whitespace-nowrap", c.title)}>ConstruData</span>
            <span className={cn("text-[9px] font-medium tracking-widest uppercase opacity-80", c.subtitle)}>HydroNetwork</span>
          </div>
        )}
        {onClose && (
          <button onClick={onClose} className={cn("ml-auto transition-colors md:hidden", c.itemDefault)} aria-label="Fechar menu">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col flex-1 gap-0.5 p-2 pt-3 overflow-y-auto overflow-x-hidden">
        {navItems.map((item, i) => {
          if ("section" in item && !("to" in item)) {
            if (!isOpen) return null;
            return (
              <div key={`s-${i}`} className={cn("text-[9px] font-bold uppercase tracking-widest mt-4 mb-1 px-[10px]", c.section)}>
                {item.section}
              </div>
            );
          }
          if (!("to" in item)) return null;
          const nav = item as { label: string; icon: typeof Monitor; to: string };
          return (
            <NavLink
              key={nav.to}
              to={nav.to}
              title={isOpen ? undefined : nav.label}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg transition-colors h-10 px-[10px]",
                  isActive ? c.itemActive : `${c.itemDefault} ${c.itemHover}`,
                )
              }
            >
              <nav.icon size={20} className="shrink-0" />
              {isOpen && <span className="text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis">{nav.label}</span>}
            </NavLink>
          );
        })}

        {/* Bottom */}
        <div className={cn("mt-auto flex flex-col gap-0.5 pt-2 border-t", c.border)}>
          <button
            onClick={cycleTheme}
            title="Alternar tema"
            className={cn("flex items-center gap-3 h-10 px-[10px] rounded-lg transition-colors", c.itemDefault, c.itemHover)}
          >
            <Palette size={20} className="shrink-0" />
            {isOpen && <span className="text-xs font-medium whitespace-nowrap">Tema</span>}
          </button>
          <button
            onClick={toggleSidebar}
            title={isOpen ? "Recolher menu" : "Expandir menu"}
            className={cn("flex items-center gap-3 h-10 px-[10px] rounded-lg transition-colors", c.itemDefault, c.itemHover)}
          >
            {isOpen ? <ChevronLeft size={20} className="shrink-0" /> : <ChevronRight size={20} className="shrink-0" />}
            {isOpen && <span className="text-xs font-medium whitespace-nowrap">Recolher</span>}
          </button>
          <button
            onClick={toggleDemoMode}
            title={isDemoMode ? "Desativar Modo Demo" : "Ativar Modo Demo"}
            className={cn(
              "flex items-center gap-3 h-10 px-[10px] rounded-lg transition-colors",
              isDemoMode ? "bg-[#2abfdc]/12 text-[#2abfdc]" : `${c.itemDefault} ${c.itemHover}`,
            )}
          >
            <FlaskConical size={20} className="shrink-0" />
            {isOpen && <span className="text-xs font-medium whitespace-nowrap">{isDemoMode ? "Modo Demo: ON" : "Modo Demo: OFF"}</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
}

// ─── Project Selector ──────────────────────────────────────────────────────
function ProjectSelector({ isDark }: { isDark: boolean }) {
  const projetos = useProjectContext((s) => s.projetos);
  const activeProjectId = useProjectContext((s) => s.activeProjectId);
  const setActiveProject = useProjectContext((s) => s.setActiveProject);
  const addProjeto = useProjectContext((s) => s.addProjeto);
  const updateProjeto = useProjectContext((s) => s.updateProjeto);
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoCidade, setNovoCidade] = useState("");
  const [novoTipo, setNovoTipo] = useState<"agua" | "esgoto" | "misto">("esgoto");
  const [editOpen, setEditOpen] = useState(false);

  const active = projetos.find((p) => p.id === activeProjectId);

  async function handleAdd() {
    if (!novoNome.trim()) return;
    const p = await addProjeto({
      nome: novoNome, contrato: "", cidade: novoCidade, cliente: "", tipo: novoTipo,
      data_inicio: new Date().toISOString().slice(0, 10), data_fim: null,
      orcamento_total: 0, status: "ativo", responsavel_nome: "", responsavel_telefone: "",
    });
    if (p) setActiveProject(p.id);
    setNovoNome(""); setNovoCidade(""); setShowNew(false); setOpen(false);
  }

  const c = isDark
    ? { btnBg: "bg-[#112645]", btnBorder: "border-[#20406a]", btnHover: "hover:border-[#2abfdc]/50", text: "text-[#e4f2f8]", accent: "text-[#2abfdc]", dropBg: "bg-[#0d2040]", dropBorder: "border-[#20406a]", inputBg: "bg-[#071422]", section: "text-[#5a8caa]", sub: "text-[#5a8caa]", hoverRow: "hover:bg-[#14294e]", activeRow: "bg-[#2abfdc]/10" }
    : { btnBg: "bg-white", btnBorder: "border-gray-300", btnHover: "hover:border-blue-400", text: "text-gray-800", accent: "text-blue-600", dropBg: "bg-white", dropBorder: "border-gray-200", inputBg: "bg-gray-50", section: "text-gray-400", sub: "text-gray-500", hoverRow: "hover:bg-gray-50", activeRow: "bg-blue-50" };

  return (
    <div className="relative flex items-center gap-1.5">
      <button
        onClick={() => setOpen(!open)}
        className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors max-w-[280px]", c.btnBg, c.btnBorder, c.btnHover)}
      >
        <Building2 size={14} className={cn("shrink-0", c.accent)} />
        <span className={cn("text-xs font-medium truncate", c.text)}>{active?.nome ?? "Selecionar Projeto"}</span>
        <ChevronDown size={12} className={cn("shrink-0 transition-transform", c.sub, open && "rotate-180")} />
      </button>

      {active && (
        <button
          onClick={() => setEditOpen(true)}
          title="Editar contrato do projeto"
          aria-label="Editar contrato do projeto"
          className={cn("flex items-center justify-center w-7 h-7 rounded-lg border transition-colors shrink-0", c.btnBg, c.btnBorder, c.btnHover)}
        >
          <Pencil size={12} className={cn("shrink-0", c.accent)} />
        </button>
      )}

      {editOpen && active && (
        <EditContratoModal
          isDark={isDark}
          projeto={active}
          onClose={() => setEditOpen(false)}
          onSave={updateProjeto}
        />
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setShowNew(false); }} />
          <div className={cn("absolute top-full left-0 mt-1 z-50 w-80 rounded-xl shadow-2xl overflow-hidden border", c.dropBg, c.dropBorder)}>
            <div className={cn("p-2 border-b", c.dropBorder)}>
              <span className={cn("text-[9px] font-bold uppercase tracking-widest px-2", c.section)}>Projetos</span>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {projetos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setActiveProject(p.id); setOpen(false); }}
                  className={cn("w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors", c.hoverRow, p.id === activeProjectId && c.activeRow)}
                >
                  <div className={cn("w-2 h-2 rounded-full shrink-0", p.status === "ativo" ? "bg-green-400" : p.status === "pausado" ? "bg-yellow-400" : "bg-gray-500")} />
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-xs font-medium truncate", c.text)}>{p.nome}</div>
                    <div className={cn("text-[10px]", c.sub)}>{p.cidade} - {p.tipo.toUpperCase()}</div>
                  </div>
                  {p.contrato && <span className={cn("text-[9px] font-mono shrink-0", c.sub)}>{p.contrato}</span>}
                </button>
              ))}
            </div>
            {!showNew ? (
              <button
                onClick={() => setShowNew(true)}
                className={cn("w-full flex items-center gap-2 px-3 py-2.5 border-t transition-colors", c.accent, c.hoverRow, c.dropBorder)}
              >
                <Plus size={14} />
                <span className="text-xs font-medium">Novo Projeto</span>
              </button>
            ) : (
              <div className={cn("p-3 border-t space-y-2", c.dropBorder)}>
                <input placeholder="Nome do projeto" value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
                  className={cn("w-full border rounded-lg px-3 py-1.5 text-xs", c.inputBg, c.dropBorder, c.text)} />
                <div className="flex gap-2">
                  <input placeholder="Cidade" value={novoCidade} onChange={(e) => setNovoCidade(e.target.value)}
                    className={cn("flex-1 border rounded-lg px-3 py-1.5 text-xs", c.inputBg, c.dropBorder, c.text)} />
                  <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as any)}
                    className={cn("border rounded-lg px-2 py-1.5 text-xs", c.inputBg, c.dropBorder, c.text)}>
                    <option value="esgoto">Esgoto</option>
                    <option value="agua">Água</option>
                    <option value="misto">Misto</option>
                  </select>
                </div>
                <button onClick={handleAdd}
                  className="w-full bg-blue-500/20 text-blue-500 border border-blue-500/30 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-blue-500/30 transition-colors">
                  Criar Projeto
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Edit Contrato Modal ────────────────────────────────────────────────────
function EditContratoModal({
  isDark, projeto, onClose, onSave,
}: {
  isDark: boolean;
  projeto: DbProjeto;
  onClose: () => void;
  onSave: (id: string, patch: Partial<DbProjeto>) => Promise<boolean>;
}) {
  const [contrato, setContrato] = useState(projeto.contrato ?? "");
  const [valor, setValor] = useState(String(projeto.orcamento_total ?? 0));
  const [dataInicio, setDataInicio] = useState(projeto.data_inicio ?? "");
  const [dataFim, setDataFim] = useState(projeto.data_fim ?? "");
  const [cidade, setCidade] = useState(projeto.cidade ?? "");
  const [responsavel, setResponsavel] = useState(projeto.responsavel_nome ?? "");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const c = isDark
    ? { bg: "bg-[#0d2040]", border: "border-[#20406a]", text: "text-[#e4f2f8]", sub: "text-[#5a8caa]", inputBg: "bg-[#071422]", overlay: "rgba(4,10,20,0.72)" }
    : { bg: "bg-white", border: "border-gray-200", text: "text-gray-800", sub: "text-gray-500", inputBg: "bg-gray-50", overlay: "rgba(15,23,42,0.5)" };

  async function handleSave() {
    setSaving(true);
    setErro(null);
    const valorNum = Number(valor.replace(/\./g, "").replace(",", "."));
    const ok = await onSave(projeto.id, {
      contrato,
      orcamento_total: Number.isFinite(valorNum) ? valorNum : projeto.orcamento_total,
      data_inicio: dataInicio,
      data_fim: dataFim || null,
      cidade,
      responsavel_nome: responsavel,
    });
    setSaving(false);
    if (!ok) {
      setErro("Salvo só localmente — Supabase indisponível no momento.");
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: c.overlay }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={cn("w-full max-w-md rounded-2xl border shadow-2xl", c.bg, c.border)} onClick={(e) => e.stopPropagation()}>
        <div className={cn("flex items-center justify-between px-5 py-4 border-b", c.border)}>
          <h2 className={cn("text-sm font-bold", c.text)}>Editar contrato — {projeto.nome}</h2>
          <button onClick={onClose} className={cn("w-7 h-7 flex items-center justify-center rounded-lg transition-colors", c.sub, "hover:text-red-400")}>
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="flex flex-col gap-1">
            <span className={cn("text-[10px] uppercase tracking-widest font-semibold", c.sub)}>Nº do Contrato</span>
            <input value={contrato} onChange={(e) => setContrato(e.target.value)}
              placeholder="13.546/25-00"
              className={cn("w-full border rounded-lg px-3 py-2 text-sm outline-none", c.inputBg, c.border, c.text)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={cn("text-[10px] uppercase tracking-widest font-semibold", c.sub)}>Valor do Contrato (R$)</span>
            <input value={valor} onChange={(e) => setValor(e.target.value)}
              inputMode="decimal" placeholder="690000"
              className={cn("w-full border rounded-lg px-3 py-2 text-sm outline-none", c.inputBg, c.border, c.text)} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className={cn("text-[10px] uppercase tracking-widest font-semibold", c.sub)}>Data Início</span>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                className={cn("w-full border rounded-lg px-3 py-2 text-sm outline-none", c.inputBg, c.border, c.text)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={cn("text-[10px] uppercase tracking-widest font-semibold", c.sub)}>Data Fim</span>
              <input type="date" value={dataFim ?? ""} onChange={(e) => setDataFim(e.target.value)}
                className={cn("w-full border rounded-lg px-3 py-2 text-sm outline-none", c.inputBg, c.border, c.text)} />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className={cn("text-[10px] uppercase tracking-widest font-semibold", c.sub)}>Cidade</span>
            <input value={cidade} onChange={(e) => setCidade(e.target.value)}
              className={cn("w-full border rounded-lg px-3 py-2 text-sm outline-none", c.inputBg, c.border, c.text)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={cn("text-[10px] uppercase tracking-widest font-semibold", c.sub)}>Responsável</span>
            <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)}
              className={cn("w-full border rounded-lg px-3 py-2 text-sm outline-none", c.inputBg, c.border, c.text)} />
          </label>

          {erro && <p className="text-[11px] text-amber-400">{erro}</p>}
        </div>

        <div className={cn("flex items-center justify-end gap-2 px-5 py-4 border-t", c.border)}>
          <button onClick={onClose} className={cn("px-4 py-2 rounded-lg border text-xs transition-colors", c.border, c.sub)}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg bg-cyan-500 text-white text-xs font-semibold hover:bg-cyan-600 disabled:opacity-50 transition-colors">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR SHELL (used for Dark and Light themes)
// ═══════════════════════════════════════════════════════════════════════════
function SidebarShell({ isDark }: { isDark: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const fetchProjetos = useProjectContext((s) => s.fetchProjetos);

  useEffect(() => { fetchProjetos(); }, []);

  const headerBg = isDark ? "bg-[#0a1628]" : "bg-white";
  const headerBorder = isDark ? "border-[#20406a]" : "border-gray-200";
  const mobileTitle = isDark ? "text-[#e4f2f8]" : "text-gray-900";
  const mobileBtn = isDark ? "text-[#6b6b6b] hover:text-[#2abfdc]" : "text-gray-400 hover:text-blue-500";

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <DemoBanner />
      <div className={cn("flex items-center gap-3 px-4 h-11 border-b shrink-0 z-20", headerBg, headerBorder)}>
        <button onClick={() => setMobileOpen(true)} className={cn("transition-colors md:hidden", mobileBtn)} aria-label="Abrir menu">
          <Menu size={20} />
        </button>
        <span className={cn("text-sm font-bold tracking-wide md:hidden", mobileTitle)}>ConstruData</span>
        <div className="hidden md:block">
          <ProjectSelector isDark={isDark} />
        </div>
        <div className="ml-auto md:hidden">
          <ProjectSelector isDark={isDark} />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />}
        <div className={cn(
          "fixed inset-y-0 left-0 z-40 h-full md:relative md:inset-auto md:z-auto",
          "transition-transform duration-200 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}>
          <Sidebar isDark={isDark} onClose={() => setMobileOpen(false)} />
        </div>
        <main className={cn("flex-1 overflow-y-auto min-w-0", isDark ? "bg-[#040608]" : "bg-[#f4f6f9]")}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTIVE SHELL — picks the correct layout based on theme
// ═══════════════════════════════════════════════════════════════════════════
function AdaptiveShell() {
  const theme = useThemeStore((s) => s.theme);

  if (theme === 'ekyte') return <AppLayout />;
  if (theme === 'dark')  return <SidebarShell isDark={true} />;
  return <SidebarShell isDark={false} />;
}

// ─── NS V5 wrapper ──────────────────────────────────────────────────────────
function NsV5Page() {
  return <LazyRoute><MotorNsV5Page /></LazyRoute>;
}

// ─── App ────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <TourProvider>
      <ThemeSwitcherFab />
      <Routes>
        <Route path="/app" element={<AdaptiveShell />}>
          <Route index element={<Navigate to="/app/gestao-360" replace />} />
          <Route path="guia" element={<LazyRoute><GuiaPage /></LazyRoute>} />
          <Route path="ns-v5" element={<NsV5Page />} />
          <Route path="gestao-360" element={<LazyRoute><Gestao360Page /></LazyRoute>} />
          <Route path="torre-de-controle" element={<LazyRoute><TorreDeControlePage /></LazyRoute>} />
          <Route path="relatorio360" element={<LazyRoute><Relatorio360Page /></LazyRoute>} />
          <Route path="rdo-lista" element={<LazyRoute><RdoListaPage /></LazyRoute>} />
          <Route path="projetos" element={<LazyRoute><ProjetosPage /></LazyRoute>} />
          <Route path="planejamento" element={<LazyRoute><PlanejamentoPage /></LazyRoute>} />
          <Route path="agenda" element={<LazyRoute><AgendaPage /></LazyRoute>} />
          <Route path="lps-lean" element={<LazyRoute><LpsPage /></LazyRoute>} />
          <Route path="rdo" element={<LazyRoute><RdoPage /></LazyRoute>} />
          <Route path="mapa-interativo" element={<LazyRoute><MapaInterativoPage /></LazyRoute>} />
          <Route path="rede-360" element={<LazyRoute><Rede360Page /></LazyRoute>} />
          <Route path="bim" element={<LazyRoute><BimPage /></LazyRoute>} />
          <Route path="suprimentos" element={<LazyRoute><SuprimentosPage /></LazyRoute>} />
          <Route path="mao-de-obra" element={<LazyRoute><MaoDeObraPage /></LazyRoute>} />
          <Route path="gestao-equipamentos" element={<LazyRoute><GestaoEquipamentosPage /></LazyRoute>} />
          <Route path="otimizacao-frota" element={<LazyRoute><OtimizacaoFrotaPage /></LazyRoute>} />
          <Route path="quantitativos" element={<LazyRoute><QuantitativosPage /></LazyRoute>} />
          <Route path="pre-construcao" element={<LazyRoute><PreConstrucaoPage /></LazyRoute>} />
          <Route path="ia-analytics" element={<LazyRoute><IaAnalyticsPage /></LazyRoute>} />
          <Route path="gis-editor" element={<LazyRoute><GisEditorPage /></LazyRoute>} />
          <Route path="evm" element={<LazyRoute><EvmPage /></LazyRoute>} />
          <Route path="planejamento-mestre" element={<LazyRoute><PlanejamentoMestrePage /></LazyRoute>} />
          <Route path="ns-planejamento" element={<LazyRoute><NsPlanejamentoPage /></LazyRoute>} />
          <Route path="planilhas" element={<LazyRoute><PlanilhasModeloPage /></LazyRoute>} />
          <Route path="operacao-campo" element={<LazyRoute><OperacaoCampoPage /></LazyRoute>} />
          <Route path="gestao-contatos" element={<LazyRoute><GestaoContatosPage /></LazyRoute>} />
          <Route path="fluxo-operacional" element={<LazyRoute><FluxoOperacionalPage /></LazyRoute>} />
          <Route path="punch-list" element={<LazyRoute><PunchListPage /></LazyRoute>} />
          <Route path="whatsapp-rdo" element={<LazyRoute><WhatsAppRdoPage /></LazyRoute>} />
          <Route path="leitor-pdf" element={<LazyRoute><LeitorPdfPage /></LazyRoute>} />
          <Route path="engine-v5" element={<LazyRoute><EngineV5Dashboard /></LazyRoute>} />
          <Route path="dre-financeiro" element={<LazyRoute><DreFinanceiroPage /></LazyRoute>} />
          <Route path="medicao" element={<LazyRoute><MedicaoPage /></LazyRoute>} />
          <Route path="agent-chat" element={<LazyRoute><AgentChatPage /></LazyRoute>} />
          <Route path="wcr-diario" element={<LazyRoute><WcrDiarioPage /></LazyRoute>} />
          <Route path="equipes-kanban" element={<LazyRoute><EquipesKanbanPage /></LazyRoute>} />
          <Route path="diario-obra" element={<LazyRoute><DiarioObraPage /></LazyRoute>} />
          <Route path="*" element={<Navigate to="/app/gestao-360" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
      </TourProvider>
    </BrowserRouter>
  );
}
