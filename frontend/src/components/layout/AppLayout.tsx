import React, { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Menu, Settings, Bell, Search, Plus, Filter, RotateCw, UserCircle, MessageSquare, Briefcase, Play, Calendar, MoreHorizontal, Layers, Target, FileText, Cpu, Calculator, FolderKanban, Wrench,
  BookOpen, FileSearch, Waves, FileSpreadsheet, CalendarClock, Users, CheckSquare, ClipboardList, Droplets,
  Brain, FileSearch as FileSearchIcon, UserCog, GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Modules grouped by top categories — espelha a mesma organização do menu
// Dark/Light (App.tsx navItems); manter as duas listas em sincronia.
const MODULE_GROUPS = [
  {
    category: "Ajuda", id: "ajuda",
    items: [
      { label: "Guia — Como usar", to: "/app/guia", icon: BookOpen },
    ]
  },
  {
    category: "Gestão", id: "gestao",
    items: [
      { label: "Gestão 360", to: "/app/gestao-360", icon: Layers },
      { label: "Torre Controle", to: "/app/torre-de-controle", icon: Play },
      { label: "Projetos", to: "/app/projetos", icon: FolderKanban },
    ]
  },
  {
    category: "Engenharia", id: "engenharia",
    items: [
      { label: "Motor NS V5", to: "/app/ns-v5", icon: Cpu },
      { label: "Mapa / GIS", to: "/app/mapa-interativo", icon: Filter },
      { label: "BIM", to: "/app/bim", icon: Layers },
      { label: "Rede 360", to: "/app/rede-360", icon: Target },
      { label: "Pré-Construção", to: "/app/pre-construcao", icon: FileSearch },
    ]
  },
  {
    category: "Planejamento", id: "planejamento",
    items: [
      { label: "Plan. Mestre", to: "/app/planejamento-mestre", icon: CalendarClock },
      { label: "Programação Semana", to: "/app/programacao-semana", icon: ClipboardList },
      { label: "Meta 1500 Ligações", to: "/app/meta-ligacoes", icon: Droplets },
      { label: "Feito × A Fazer (NS)", to: "/app/ns-planejamento", icon: Waves },
      { label: "Planilhas (Modelos)", to: "/app/planilhas", icon: FileSpreadsheet },
      { label: "Agenda", to: "/app/agenda", icon: Calendar },
      { label: "LPS / Lean", to: "/app/lps-lean", icon: Target },
      { label: "EVM / Curva S", to: "/app/evm", icon: Calculator },
    ]
  },
  {
    category: "Financeiro", id: "financeiro",
    items: [
      { label: "DRE & Resultado", to: "/app/dre-financeiro", icon: Calculator },
      { label: "Medição (RDO)", to: "/app/medicao", icon: Calculator },
    ]
  },
  {
    category: "Operação de Campo", id: "operacao",
    items: [
      { label: "Kanban Equipes", to: "/app/equipes-kanban", icon: Users },
      { label: "RDO", to: "/app/rdo", icon: FileText },
      { label: "Campo WhatsApp", to: "/app/campo-whatsapp", icon: MessageSquare },
      { label: "Relatório 360", to: "/app/relatorio360", icon: ClipboardList },
      { label: "Punch List", to: "/app/punch-list", icon: CheckSquare },
    ]
  },
  {
    category: "Recursos", id: "recursos",
    items: [
      { label: "Suprimentos", to: "/app/suprimentos", icon: FolderKanban },
      { label: "Mão de Obra", to: "/app/mao-de-obra", icon: UserCircle },
      { label: "Equipamentos", to: "/app/gestao-equipamentos", icon: Wrench },
      { label: "Quantitativos", to: "/app/quantitativos", icon: Calculator },
    ]
  },
  {
    category: "IA & Inteligência", id: "ia",
    items: [
      { label: "Engine V5", to: "/app/engine-v5", icon: Cpu },
      { label: "IA & Analytics", to: "/app/ia-analytics", icon: Brain },
      { label: "Agente Chat", to: "/app/agent-chat", icon: MessageSquare },
      { label: "Leitor PDF", to: "/app/leitor-pdf", icon: FileSearchIcon },
    ]
  },
  {
    category: "Comunicação", id: "comunicacao",
    items: [
      { label: "Contatos", to: "/app/gestao-contatos", icon: UserCog },
      { label: "Fluxo Oper.", to: "/app/fluxo-operacional", icon: GitBranch },
      { label: "WhatsApp RDO", to: "/app/whatsapp-rdo", icon: MessageSquare },
      { label: "Diário WCR", to: "/app/wcr-diario", icon: FileText },
    ]
  },
];

export function AppLayout() {
  const location = useLocation();
  const currentPath = location.pathname;

  // Find active category
  let activeCategoryId = "gestao";
  let pageTitle = "Dashboard";

  MODULE_GROUPS.forEach(group => {
    group.items.forEach(item => {
      if (currentPath.startsWith(item.to)) {
        activeCategoryId = group.id;
        pageTitle = item.label;
      }
    });
  });

  const activeGroup = MODULE_GROUPS.find(g => g.id === activeCategoryId);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f4f6f9] text-[#333]">
      
      {/* 1. TOP NAV BAR (Blue Area) */}
      <header className="flex shadow-md items-center h-12 bg-[#2f55e5] text-white shrink-0 z-50">
        
        {/* Left icon / Logo placeholder */}
        <div className="h-full w-14 bg-[#1b3ec0] flex items-center justify-center shrink-0 cursor-pointer hover:bg-[#1a38a3] transition-colors">
           <Layers className="text-white" size={24} />
        </div>
        
        {/* Menu and Settings icons */}
        <button className="h-full px-4 hover:bg-[#1b3ec0] flex items-center justify-center transition-colors">
          <Menu size={20} />
        </button>
        <button className="h-full px-3 hover:bg-[#1b3ec0] flex items-center justify-center transition-colors">
          <Settings size={18} />
        </button>
        
        {/* Category Navigation Tabs */}
        <nav className="hidden md:flex h-full items-center ml-2 overflow-x-auto no-scrollbar">
          {MODULE_GROUPS.map((group) => (
            <Link
              key={group.id}
              to={group.items[0].to}
              className={cn(
                "h-full px-4 flex items-center text-[13px] font-medium transition-all border-b-[3px]",
                activeCategoryId === group.id
                  ? "border-white text-white font-semibold bg-[#3c64f4]"
                  : "border-transparent text-white/80 hover:bg-[#1b3ec0] hover:text-white"
              )}
            >
              {group.category}
            </Link>
          ))}
        </nav>

        {/* Right side icons */}
        <div className="ml-auto flex h-full items-center pr-2">
          {/* Create Button */}
          <button className="w-8 h-8 rounded-full bg-[#1b3ec0] hover:bg-white hover:text-[#2f55e5] text-white flex items-center justify-center mx-2 transition-colors">
            <Plus size={18} />
          </button>
          
          <button className="h-full px-3 hover:bg-[#1b3ec0] transition-colors">
            <div className="relative">
              <MessageSquare size={18} />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500 border border-[#2f55e5]"></span>
              </span>
            </div>
          </button>

          <button className="h-full px-3 hover:bg-[#1b3ec0] transition-colors">
            <div className="relative">
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 bg-red-500 text-[9px] font-bold h-3.5 w-3.5 flex items-center justify-center rounded-full">5</span>
            </div>
          </button>
          
          <button className="h-full px-3 hover:bg-[#1b3ec0] transition-colors">
            <Layers size={18} />
          </button>

          <button className="h-full px-2 ml-1">
            <div className="w-8 h-8 rounded-full bg-indigo-300 border-2 border-white/20 overflow-hidden flex items-center justify-center">
               <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Avatar" className="w-full h-full object-cover" />
            </div>
          </button>
        </div>
      </header>

      {/* 2. SUB NAV BAR (Context Area) */}
      <div className="h-12 bg-[#0c40cf] text-white flex items-center px-4 shrink-0 shadow-sm z-40 text-sm">
         <div className="flex font-semibold items-center min-w-[250px]">
            {pageTitle}
         </div>
         
         <div className="w-[1px] h-6 bg-white/20 mx-4" />
         
         <div className="flex items-center text-white/80 text-xs font-medium cursor-pointer hover:text-white">
           <RotateCw size={14} className="mr-2" />
           Atualizado há pouco
         </div>

         <div className="w-[1px] h-6 bg-white/20 mx-4" />

         {/* Contextual Filters */}
         <div className="flex items-center gap-1 bg-[#0932a3] rounded-md px-1.5 py-1 flex-1 max-w-md cursor-pointer hover:bg-[#082a89] transition-colors">
           <Filter size={16} className="text-white/60 mx-1" />
           <span className="text-white/80 text-xs px-1">Selecionar um filtro rápido</span>
           <Search size={14} className="text-white/60 ml-auto mr-1" />
         </div>

         <div className="ml-auto flex items-center">
            <button className="p-2 text-white/80 hover:text-white transition-colors">
                <MoreHorizontal size={18} />
            </button>
         </div>
      </div>

      {/* 3. TERTIARY BAR (Local Navigation / Data Filter) */}
      {activeGroup && (
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 shrink-0 text-[13px]">
          {/* Main action button (like the + in the screenshot) */}
          <button className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm hover:bg-blue-600 mr-4">
             <Plus size={18} />
          </button>
          
          <div className="flex space-x-6 items-center flex-1">
             {activeGroup.items.map((item) => {
               const isActive = currentPath.startsWith(item.to);
               return (
                 <Link 
                   key={item.to} 
                   to={item.to}
                   className={cn(
                     "flex items-center space-x-2 transition-colors",
                     isActive ? "text-blue-600 font-semibold" : "text-gray-500 hover:text-gray-900"
                   )}
                 >
                   <item.icon size={16} className={isActive ? "text-blue-500" : "text-gray-400"} />
                   <span>{item.label}</span>
                 </Link>
               );
             })}
          </div>

          {/* Right side local filters */}
          <div className="flex items-center space-x-3 text-gray-500">
             <div className="flex items-center space-x-1 cursor-pointer hover:text-blue-600">
               <Calendar size={14} />
               <span className="text-xs">Até hoje</span>
             </div>
             <div className="w-[1px] h-4 bg-gray-300" />
             <div className="flex border border-gray-300 rounded-md overflow-hidden bg-[#f4f6f9]">
                <button className="px-3 py-1 bg-white border-r border-gray-300 text-blue-600 font-medium">Lista</button>
                <button className="px-3 py-1 hover:bg-white text-gray-600 font-medium">Kanban</button>
                <button className="px-3 py-1 hover:bg-white text-gray-600 font-medium">Calendário</button>
             </div>
          </div>
        </div>
      )}

      {/* 4. MAIN CONTENT AREA */}
      <main className="flex-1 overflow-auto bg-[#f4f6f9] p-4">
        {/* We use standard Outlet but wrap it if needed */}
        <div className="h-full bg-transparent mx-auto relative rounded-lg">
           <Outlet />
        </div>
      </main>

    </div>
  );
}
