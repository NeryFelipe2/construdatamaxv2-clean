import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet } from "react-router-dom";
import { lazy, Suspense, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Menu, X, ChevronLeft, ChevronRight,
  Cpu, Radio, PackageSearch, Users, Wrench, Calendar,
  CalendarClock, Target, FileText, Calculator, Layers,
  Map, Network, LayoutDashboard, ClipboardList, FolderKanban,
  FileSearch, Monitor,
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

// ─── NS V5 Legacy (all 13 tabs preserved) ───────────────────────────────────
const LegacyApp = lazy(() => import("./LegacyApp"));

// ─── Nav items ──────────────────────────────────────────────────────────────
const navItems = [
  { section: "NS V5 — Motor Principal" },
  { label: "NS V5 (13 abas)", icon: Monitor, to: "/app/ns-v5" },

  { section: "Palantir — Gestao" },
  { label: "Gestao 360", icon: LayoutDashboard, to: "/app/gestao-360" },
  { label: "Torre Controle", icon: Radio, to: "/app/torre-de-controle" },
  { label: "Relatorio 360", icon: ClipboardList, to: "/app/relatorio360" },
  { label: "Projetos", icon: FolderKanban, to: "/app/projetos" },

  { section: "Planejamento" },
  { label: "Planejamento", icon: CalendarClock, to: "/app/planejamento" },
  { label: "Agenda", icon: Calendar, to: "/app/agenda" },
  { label: "LPS/Lean", icon: Target, to: "/app/lps-lean" },

  { section: "Operacao" },
  { label: "RDO", icon: FileText, to: "/app/rdo" },
  { label: "Mapa Interativo", icon: Map, to: "/app/mapa-interativo" },
  { label: "Rede 360", icon: Network, to: "/app/rede-360" },
  { label: "BIM 3D/4D/5D", icon: Layers, to: "/app/bim" },

  { section: "Recursos" },
  { label: "Suprimentos", icon: PackageSearch, to: "/app/suprimentos" },
  { label: "Mao de Obra", icon: Users, to: "/app/mao-de-obra" },
  { label: "Gest. Equip.", icon: Wrench, to: "/app/gestao-equipamentos" },
  { label: "Frota", icon: Cpu, to: "/app/otimizacao-frota" },
  { label: "Quantitativos", icon: Calculator, to: "/app/quantitativos" },
  { label: "Pre-Constr.", icon: FileSearch, to: "/app/pre-construcao" },
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

// ─── App Shell ──────────────────────────────────────────────────────────────
function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Mobile top bar */}
      <div className="flex md:hidden items-center gap-3 px-4 h-12 border-b border-[#20406a] bg-[#0d2040] shrink-0 z-20">
        <button onClick={() => setMobileOpen(true)} className="text-[#6b6b6b] hover:text-[#2abfdc] transition-colors" aria-label="Abrir menu">
          <Menu size={20} />
        </button>
        <span className="text-[#e4f2f8] text-sm font-bold tracking-wide">ConstruData</span>
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

// ─── NS V5 Legacy wrapper (preserves styles.css shell) ──────────────────────
function NsV5Page() {
  return (
    <LazyRoute>
      <LegacyApp />
    </LazyRoute>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="/app/ns-v5" replace />} />
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
          <Route path="*" element={<Navigate to="/app/ns-v5" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
