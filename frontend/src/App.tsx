import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useProjectContext } from "@/store/projectContext";
import { useThemeStore } from "@/store/themeStore";
import {
  Menu, X, ChevronLeft, ChevronRight, ChevronDown, Plus,
  Cpu, Radio, PackageSearch, Users, Wrench, Calendar,
  CalendarClock, Target, FileText, Calculator, Layers,
  Map, Network, LayoutDashboard, ClipboardList, FolderKanban,
  FileSearch, Monitor, MessageSquare, Building2, UserCog,
  GitBranch, CheckSquare, Sun, Moon, Brain,
} from "lucide-react";

// ─── Lazy-loaded Palantir modules ────────────────────────────────────────────
const TorreDeControlePage = lazy(() => import("@/features/torre-de-controle/index").then((m) => ({ default: m.TorreDeControlePage })));
const Gestao360Page = lazy(() => import("@/features/gestao-360/index").then((m) => ({ default: m.Gestao360Page })));
const SuprimentosPage = lazy(() => import("@/features/suprimentos/index").then((m) => ({ default: m.SuprimentosPage })));
const MaoDeObraPage = lazy(() => import("@/features/mao-de-obra/index").then((m) => ({ default: m.MaoDeObraPage })));
const OtimizacaoFrotaPage = lazy(() => import("@/features/otimizacao-frota/index").then((m) => ({ default: m.default })));
const GestaoEquipamentosPage = lazy(() => import("@/features/gestao-equipamentos/index").then((m) => ({ default: m.GestaoEquipamentosPage })));
const AgendaPage = lazy(() => import("@/features/agenda/index").then((m) => ({ default: m.AgendaPage })));
const PlanejamentoPage = lazy(() => import("@/features/planejamento/index").then((m) => ({ default: m.PlanejamentoPage })));
const Relatorio360Page = lazy(() => import("@/features/relatorio360/index").then((m) => ({ default: m.Relatorio360Page })));
const Rede360Page = lazy(() => import("@/features/rede-360/index").then((m) => ({ default: m.Rede360Page })));
const LpsPage = lazy(() => import("@/features/lps-lean/index").then((m) => ({ default: m.LpsPage })));
const BimPage = lazy(() => import("@/features/bim/index").then((m) => ({ default: m.BimPage })));
const MapaInterativoPage = lazy(() => import("@/features/mapa-interativo/index").then((m) => ({ default: m.MapaInterativoPage })));
const RdoPage = lazy(() => import("@/features/rdo/index").then((m) => ({ default: m.RdoPage })));
const QuantitativosPage = lazy(() => import("@/features/quantitativos/index").then((m) => ({ default: m.QuantitativosPage })));
const ProjetosPage = lazy(() => import("@/features/projetos/index").then((m) => ({ default: m.ProjetosPage })));
const PreConstrucaoPage = lazy(() => import("@/features/pre-construcao/index").then((m) => ({ default: m.PreConstrucaoPage })));
const WhatsAppRdoPage = lazy(() => import("@/features/whatsapp-rdo/index").then((m) => ({ default: m.WhatsAppRdoPage })));

// ─── New modules ────────────────────────────────────────────────────────────
const GestaoContatosPage = lazy(() => import("@/features/gestao-contatos/index").then((m) => ({ default: m.GestaoContatosPage })));
const FluxoOperacionalPage = lazy(() => import("@/features/fluxo-operacional/index").then((m) => ({ default: m.FluxoOperacionalPage })));
const PunchListPage = lazy(() => import("@/features/punch-list/index").then((m) => ({ default: m.PunchListPage })));
const IaAnalyticsPage = lazy(() => import("@/features/ia-analytics/index").then((m) => ({ default: m.IaAnalyticsPage })));
const GisEditorPage = lazy(() => import("@/features/gis-editor/index").then((m) => ({ default: m.GisEditorPage })));
const EvmPage = lazy(() => import("@/features/evm/index").then((m) => ({ default: m.EvmPage })));
const PlanejamentoMestrePage = lazy(() => import("@/features/planejamento-mestre/index").then((m) => ({ default: m.PlanejamentoMestrePage })));
const OperacaoCampoPage = lazy(() => import("@/features/operacao-campo/index").then((m) => ({ default: m.OperacaoCampoPage })));

// ─── Motor NS V5 (novo, visual Datadog) ────────────────────────────────────
const MotorNsV5Page = lazy(() => import("@/features/motor-ns-v5/index").then((m) => ({ default: m.MotorNsV5Page })));

// ─── Leitor de PDF (extração algorítmica) ───────────────────────────────────
const LeitorPdfPage = lazy(() => import("@/features/leitor-pdf/index").then((m) => ({ default: m.LeitorPdfPage })));

// ─── Nav items ──────────────────────────────────────────────────────────────
const navItems = [
  { section: "Gestao" },
  { label: "Gestao 360", icon: LayoutDashboard, to: "/app/gestao-360" },
  { label: "Torre Controle", icon: Radio, to: "/app/torre-de-controle" },
  { label: "Projetos", icon: FolderKanban, to: "/app/projetos" },

  { section: "Engenharia" },
  { label: "Motor NS V5", icon: Monitor, to: "/app/ns-v5" },
  { label: "Mapa / GIS", icon: Map, to: "/app/mapa-interativo" },
  { label: "BIM 3D/4D/5D", icon: Layers, to: "/app/bim" },
  { label: "Rede 360", icon: Network, to: "/app/rede-360" },
  { label: "Pre-Construcao", icon: FileSearch, to: "/app/pre-construcao" },

  { section: "Planejamento" },
  { label: "Planejamento", icon: CalendarClock, to: "/app/planejamento" },
  { label: "Plan. Mestre", icon: CalendarClock, to: "/app/planejamento-mestre" },
  { label: "Agenda", icon: Calendar, to: "/app/agenda" },
  { label: "LPS/Lean", icon: Target, to: "/app/lps-lean" },
  { label: "EVM / Curva S", icon: Calculator, to: "/app/evm" },

  { section: "Operacao de Campo" },
  { label: "RDO", icon: FileText, to: "/app/rdo" },
  { label: "Relatorio 360", icon: ClipboardList, to: "/app/relatorio360" },
  { label: "Punch List", icon: CheckSquare, to: "/app/punch-list" },

  { section: "Recursos" },
  { label: "Suprimentos", icon: PackageSearch, to: "/app/suprimentos" },
  { label: "Mao de Obra", icon: Users, to: "/app/mao-de-obra" },
  { label: "Equipamentos", icon: Wrench, to: "/app/gestao-equipamentos" },
  { label: "Quantitativos", icon: Calculator, to: "/app/quantitativos" },

  { section: "IA & Inteligencia" },
  { label: "IA & Analytics", icon: Brain, to: "/app/ia-analytics" },
  { label: "Leitor PDF", icon: FileSearch, to: "/app/leitor-pdf" },

  { section: "Comunicacao" },
  { label: "Contatos", icon: UserCog, to: "/app/gestao-contatos" },
  { label: "Fluxo Oper.", icon: GitBranch, to: "/app/fluxo-operacional" },
  { label: "WhatsApp RDO", icon: MessageSquare, to: "/app/whatsapp-rdo" },
] as const;

// ─── Loading fallback ───────────────────────────────────────────────────────
function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-gray-600 border-t-cyan-500 rounded-full animate-spin" />
        <span className="text-sm">Carregando modulo...</span>
      </div>
    </div>
  );
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

// ─── Theme Toggle ──────────────────────────────────────────────────────────
function ThemeToggleButton({ isOpen }: { isOpen: boolean }) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Modo claro" : "Modo escuro"}
      className="flex items-center gap-3 h-10 px-[10px] rounded-lg text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8] transition-colors"
    >
      {theme === "dark" ? <Sun size={20} className="shrink-0" /> : <Moon size={20} className="shrink-0" />}
      {isOpen && <span className="text-xs font-medium whitespace-nowrap">{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>}
    </button>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────
const SIDEBAR_KEY = "cdata-sidebar";

function Sidebar({ onClose }: { onClose?: () => void }) {
  const [isOpen, setIsOpen] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) !== "false"; } catch { return true; }
  });

  function toggleSidebar() {
    setIsOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch { /* noop */ }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 border-r border-[#20406a] bg-[#0d2040] h-full",
        "transition-[width] duration-200 ease-in-out overflow-hidden",
        isOpen ? "w-[220px]" : "w-16",
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 border-b border-[#20406a] shrink-0 px-[14px] gap-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-[#071422]"
          style={{ boxShadow: "0 0 12px rgba(42,191,220,0.25)", border: "1px solid rgba(42,191,220,0.3)" }}
        >
          <span className="text-[#2abfdc] font-bold text-lg">C</span>
        </div>
        {isOpen && (
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold whitespace-nowrap text-[#e4f2f8]">ConstruData</span>
            <span className="text-[9px] font-medium tracking-widest uppercase text-[#2abfdc] opacity-80">HydroNetwork</span>
          </div>
        )}
        {onClose && (
          <button onClick={onClose} className="ml-auto text-[#6b6b6b] hover:text-[#e4f2f8] transition-colors md:hidden" aria-label="Fechar menu">
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
              <div key={`s-${i}`} className="text-[9px] font-bold uppercase tracking-widest text-[#5a8caa] mt-4 mb-1 px-[10px]">
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
                  isActive
                    ? "bg-[#2abfdc]/12 text-[#2abfdc]"
                    : "text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8]",
                )
              }
            >
              <nav.icon size={20} className="shrink-0" />
              {isOpen && <span className="text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis">{nav.label}</span>}
            </NavLink>
          );
        })}

        {/* Bottom */}
        <div className="mt-auto flex flex-col gap-0.5 pt-2 border-t border-[#20406a]">
          <ThemeToggleButton isOpen={isOpen} />
          <button
            onClick={toggleSidebar}
            title={isOpen ? "Recolher menu" : "Expandir menu"}
            className="flex items-center gap-3 h-10 px-[10px] rounded-lg text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8] transition-colors"
          >
            {isOpen ? <ChevronLeft size={20} className="shrink-0" /> : <ChevronRight size={20} className="shrink-0" />}
            {isOpen && <span className="text-xs font-medium whitespace-nowrap">Recolher</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
}

// ─── Project Selector ──────────────────────────────────────────────────────
function ProjectSelector() {
  const projetos = useProjectContext((s) => s.projetos);
  const activeProjectId = useProjectContext((s) => s.activeProjectId);
  const setActiveProject = useProjectContext((s) => s.setActiveProject);
  const addProjeto = useProjectContext((s) => s.addProjeto);
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoCidade, setNovoCidade] = useState("");
  const [novoTipo, setNovoTipo] = useState<"agua" | "esgoto" | "misto">("esgoto");

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

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#112645] border border-[#20406a] hover:border-[#2abfdc]/50 transition-colors max-w-[280px]"
      >
        <Building2 size={14} className="text-[#2abfdc] shrink-0" />
        <span className="text-xs font-medium text-[#e4f2f8] truncate">{active?.nome ?? "Selecionar Projeto"}</span>
        <ChevronDown size={12} className={cn("text-[#6b6b6b] shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setShowNew(false); }} />
          <div className="absolute top-full left-0 mt-1 z-50 w-80 bg-[#0d2040] border border-[#20406a] rounded-xl shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-[#20406a]">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#5a8caa] px-2">Projetos</span>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {projetos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setActiveProject(p.id); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#14294e] transition-colors",
                    p.id === activeProjectId && "bg-[#2abfdc]/10",
                  )}
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    p.status === "ativo" ? "bg-green-400" : p.status === "pausado" ? "bg-yellow-400" : "bg-gray-500",
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[#e4f2f8] truncate">{p.nome}</div>
                    <div className="text-[10px] text-[#5a8caa]">{p.cidade} - {p.tipo.toUpperCase()}</div>
                  </div>
                  {p.contrato && <span className="text-[9px] text-[#5a8caa] font-mono shrink-0">{p.contrato}</span>}
                </button>
              ))}
            </div>
            {!showNew ? (
              <button
                onClick={() => setShowNew(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-[#20406a] text-[#2abfdc] hover:bg-[#14294e] transition-colors"
              >
                <Plus size={14} />
                <span className="text-xs font-medium">Novo Projeto</span>
              </button>
            ) : (
              <div className="p-3 border-t border-[#20406a] space-y-2">
                <input placeholder="Nome do projeto" value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
                  className="w-full bg-[#071422] border border-[#20406a] rounded-lg px-3 py-1.5 text-xs text-[#e4f2f8] placeholder-[#5a8caa]" />
                <div className="flex gap-2">
                  <input placeholder="Cidade" value={novoCidade} onChange={(e) => setNovoCidade(e.target.value)}
                    className="flex-1 bg-[#071422] border border-[#20406a] rounded-lg px-3 py-1.5 text-xs text-[#e4f2f8] placeholder-[#5a8caa]" />
                  <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as any)}
                    className="bg-[#071422] border border-[#20406a] rounded-lg px-2 py-1.5 text-xs text-[#e4f2f8]">
                    <option value="esgoto">Esgoto</option>
                    <option value="agua">Agua</option>
                    <option value="misto">Misto</option>
                  </select>
                </div>
                <button onClick={handleAdd}
                  className="w-full bg-[#2abfdc]/20 text-[#2abfdc] border border-[#2abfdc]/30 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-[#2abfdc]/30 transition-colors">
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

// ─── App Shell ──────────────────────────────────────────────────────────────
function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const fetchProjetos = useProjectContext((s) => s.fetchProjetos);

  useEffect(() => { fetchProjetos(); }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Global header with project selector */}
      <div className="flex items-center gap-3 px-4 h-11 border-b border-[#20406a] bg-[#0a1628] shrink-0 z-20">
        <button onClick={() => setMobileOpen(true)} className="text-[#6b6b6b] hover:text-[#2abfdc] transition-colors md:hidden" aria-label="Abrir menu">
          <Menu size={20} />
        </button>
        <span className="text-[#e4f2f8] text-sm font-bold tracking-wide md:hidden">ConstruData</span>
        <div className="hidden md:block">
          <ProjectSelector />
        </div>
        <div className="ml-auto md:hidden">
          <ProjectSelector />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />}
        <div className={cn(
          "fixed inset-y-0 left-0 z-40 h-full md:relative md:inset-auto md:z-auto",
          "transition-transform duration-200 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}>
          <Sidebar onClose={() => setMobileOpen(false)} />
        </div>
        <main className="flex-1 overflow-y-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ─── NS V5 wrapper (uses new MotorNsV5Page) ────────────────────────────────
function NsV5Page() {
  return (
    <LazyRoute>
      <MotorNsV5Page />
    </LazyRoute>
  );
}

// ─── Offline IFrame Wrapper Brutal ──────────────────────────────────────────
function OfflineIframePage({ url }: { url: string }) {
  return (
    <div className="w-full h-full bg-[#040608] overflow-hidden">
      <iframe src={url} className="w-full h-full border-none m-0 p-0 block" title="Módulo Offline" />
    </div>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="/app/gestao-360" replace />} />
          <Route path="ns-v5" element={<NsV5Page />} />
          <Route path="gestao-360" element={<LazyRoute><Gestao360Page /></LazyRoute>} />
          <Route path="torre-de-controle" element={<LazyRoute><TorreDeControlePage /></LazyRoute>} />
          <Route path="relatorio360" element={<LazyRoute><Relatorio360Page /></LazyRoute>} />
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
          <Route path="operacao-campo" element={<LazyRoute><OperacaoCampoPage /></LazyRoute>} />
          <Route path="gestao-contatos" element={<LazyRoute><GestaoContatosPage /></LazyRoute>} />
          <Route path="fluxo-operacional" element={<LazyRoute><FluxoOperacionalPage /></LazyRoute>} />
          <Route path="punch-list" element={<LazyRoute><PunchListPage /></LazyRoute>} />
          <Route path="whatsapp-rdo" element={<LazyRoute><WhatsAppRdoPage /></LazyRoute>} />
          <Route path="leitor-pdf" element={<LazyRoute><LeitorPdfPage /></LazyRoute>} />
          
          {/* Legacy offline routes removed — all modules now integrated */}

          <Route path="*" element={<Navigate to="/app/gestao-360" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
