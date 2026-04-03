import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePipelineStore } from "@/store/pipelineStore";
import { cn } from "@/lib/utils";

/* ─── Types ─── */

type Health = { ok: boolean; app: string; display_name: string };

type DashboardData = {
  nucleo: string; n_total: number; n_planejadas: number; n_execucao: number;
  n_concluidas: number; n_medidas: number; pct_fisico: number; pct_financeiro: number;
  extensao_total_m: number; extensao_exec_m: number; valor_liberado: number;
  rdos: number; custo_rdo_total: number; m_por_dia: number; dias_medidos: number;
};

type NsItem = Record<string, unknown>;
type NsList = { items: NsItem[] };
type NsDetail = NsItem & {
  materiais?: Array<{ descricao: string; unidade: string; quantidade: number }>;
  materiais_resumo?: string;
  pvs?: Array<Record<string, unknown>>;
  trechos?: Array<Record<string, unknown>>;
  checklist?: Array<Record<string, unknown>>;
};

type FotoItem = { id?: number; ns_id?: number; caminho?: string; legenda?: string; data_hora?: string };
type FotoList = { items: FotoItem[] };

type ProcessArtifact = { label: string; path: string; kind: string };
type ProcessJob = {
  job_id: string | null; status: string; nucleo?: string; fonte?: string; motor?: string;
  modo_rapido?: boolean; arquivo?: string; n_pvs?: number; n_trechos?: number;
  ns_geradas?: number; ns_erros?: number; artifacts: ProcessArtifact[];
  created_at?: string; detail?: string; meta?: Record<string, unknown>;
};
type ProcessLogList = { items: ProcessJob[] };

type RdoItem = {
  id: number; data: string; numero?: number; nucleo: string; responsavel?: string;
  contrato?: string; clima_manha?: string; clima_tarde?: string; observacoes?: string;
  status: string; total_custo: number; pdf_path?: string | null;
  apontamentos?: Array<Record<string, unknown>>; equipe?: Array<Record<string, unknown>>;
  ocorrencias?: Array<Record<string, unknown>>; fotos?: Array<Record<string, unknown>>;
};
type RdoList = { items: RdoItem[] };

type CurvaPoint = { mes?: number; mes_label?: string; pct_acum?: number; acum_pct?: number; ext_acum?: number; custo_acum?: number };
type CurvaS = { previsto: CurvaPoint[]; realizado: CurvaPoint[]; n_total: number; ext_total: number; custo_total: number };

type LeanInsight = {
  takt_metros_dia: number; cycle_time_dias: number; throughput_ns_semana: number;
  ns_planejadas_semana: number; ns_bloqueadas_semana: number; ext_planejada_semana: number;
  restricoes_lookahead: number; alerta_lookahead: string; valor_agregado_pct: number;
  co2_total_ton: number; custo_ciclo_vida_total: number;
};

type LossInsight = {
  uarl_m3_ano: number; uarl_litros_dia: number; ili: number; ili_classificacao: string;
  risco_total_ano: number; n_dmas: number; custo_ineficiencia_ano: number;
};

type AnalyticsSummary = {
  status: string; gerado_em?: string; algoritmo: string; r2_test: number; mae: number;
  rmse: number; n_modelos: number; n_cenarios: number; n_nucleos: number;
  melhor_cenario?: Record<string, unknown>; top_feature?: Record<string, unknown>; origem?: string;
};

type NucleoCatalog = { items: Array<{ nome: string }>; total: number };
type GeoJsonFeature = { type: string; geometry?: { type?: string }; properties?: Record<string, unknown> };
type GeoJson = { type: string; features: GeoJsonFeature[] };
type ManageEdge = { c?: number; ext?: number; status?: string };
type ManageData = { nodes: Array<Record<string, unknown>>; edges: ManageEdge[]; ox: number; oy: number; ext: number; meta?: Record<string, unknown> };

type CronogramaFase = {
  id: string; nome: string; inicio: string; fim: string; duracao_dias: number;
  predecessora: string | null; nucleo: string;
};
type CronogramaNucleo = {
  nome: string; extensao_m: number; n_trechos: number; equipes: number;
  inicio: string; fim: string; duracao_dias: number; fases: CronogramaFase[];
};
type CronogramaData = {
  projeto: string; empresa: string; data_inicio: string; data_fim: string;
  duracao_total_dias: number; total_tarefas: number; nucleos: CronogramaNucleo[];
};

type RdoFormState = {
  data: string; nucleo: string; responsavel: string; climaManha: string; climaTarde: string;
  equipeFuncao: string; equipeQtd: string; ocorrenciaTipo: string; ocorrenciaHora: string;
  ocorrenciaDescricao: string; nsId: string; servico: string; quantidade: string;
  unidade: string; dnMm: string;
};

/* ─── Constants ─── */

const NS_STATUS_OPTIONS = ["PLANEJADA", "EM_EXECUCAO", "CONCLUIDA", "MEDIDA", "BLOQUEADA"];
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const NATIVE_BASE = API_BASE || "";

// --- Palantir Sidebar Navigation ---
const SIDEBAR_SECTIONS = [
  {
    title: "PALANTIR — GESTAO",
    items: [
      { id: "gestao", label: "Gestao 360", icon: "grid" },
      { id: "processar", label: "Torre Controle", icon: "radio" },
      { id: "log", label: "Relatorio 360", icon: "file-text" },
      { id: "nucleos", label: "Projetos", icon: "folder" },
    ]
  },
  {
    title: "PLANEJAMENTO",
    items: [
      { id: "trechos", label: "Planejamento", icon: "calendar" },
      { id: "agenda", label: "Agenda", icon: "clock" },
      { id: "lean", label: "LPS/Lean", icon: "target" },
    ]
  },
  {
    title: "OPERACAO",
    items: [
      { id: "rdo", label: "RDO", icon: "clipboard" },
      { id: "mapa", label: "Mapa Interativo", icon: "map" },
      { id: "rede", label: "Rede 360", icon: "git-branch" },
      { id: "bim", label: "BIM 3D/4D/5D", icon: "box" },
    ]
  },
  {
    title: "RECURSOS",
    items: [
      { id: "suprimentos", label: "Suprimentos", icon: "package" },
      { id: "maodeobra", label: "Mao de Obra", icon: "users" },
      { id: "equipamentos", label: "Gest. Equip.", icon: "tool" },
      { id: "frota", label: "Frota", icon: "truck" },
      { id: "hidraulica", label: "Quantitativos", icon: "calculator" },
      { id: "preconstr", label: "Pre-Constr.", icon: "search" },
    ]
  },
  {
    title: "MÓDULOS OFFLINE (NATIVOS)",
    items: [
      { id: "native_brutal", label: "Construplan Brutal", icon: "disc", isNative: true, path: "/motor-brutal" },
      { id: "native_cenarios", label: "Dash Cenários", icon: "layout", isNative: true, path: "/cenarios" },
    ]
  }
];

type TabId = "processar" | "mapa" | "rede" | "hidraulica" | "trechos" | "custos" | "bim" | "lean" | "perdas" | "ia" | "nucleos" | "log" | "gestao" | "rdo" | "agenda" | "suprimentos" | "maodeobra" | "equipamentos" | "frota" | "preconstr";

/* ─── Helpers ─── */

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function apiUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path;
}

function nativeUrl(path: string): string {
  return `${NATIVE_BASE}${path}`;
}

async function getJson<T>(path: string, nucleo = ""): Promise<T> {
  const url = new URL(apiUrl(path), window.location.origin);
  if (nucleo) url.searchParams.set("nucleo", nucleo);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`Falha ao carregar ${path}: ${r.status}`);
  return r.json() as Promise<T>;
}

function maybeFixEncoding(v: string): string {
  if (!/[ÃƒÆ'Ã†'ÃƒÆ'Ã‚¢ÃƒÆ'ââ‚¬Å¡]/.test(v)) return v;
  try { return new TextDecoder("utf-8").decode(Uint8Array.from(v, c => c.charCodeAt(0))); } catch { return v; }
}

function cleanText(v: unknown): string {
  if (typeof v !== "string") return v == null ? "" : String(v);
  return maybeFixEncoding(v);
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  return 0;
}

function formatInt(v: number): string { return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v); }
function formatMeters(v: number): string { return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: v >= 100 ? 0 : 1 }).format(v)} m`; }
function formatPercent(v: number): string { return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)}%`; }
function formatCurrency(v: number): string { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v); }

function formatDate(v?: string | null): string {
  if (!v) return "-";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${v}T12:00:00`));
}

function formatDateTime(v?: string): string {
  if (!v) return "-";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(v));
}

function artifactHref(jobId: string | null, relPath: string): string {
  if (!jobId) return "#";
  const safePath = relPath.split("/").map(c => encodeURIComponent(c)).join("/");
  return apiUrl(`/api/processamento/${jobId}/artefato/${safePath}`);
}

function nsCode(item: NsItem): string {
  const raw = item.codigo ?? item.codigo_ns ?? item.ns_codigo ?? item.ns ?? item.numero ?? item.id;
  if (raw === undefined || raw === null || raw === "") return "NS";
  if (typeof raw === "number") return `NS ${String(raw).padStart(3, "0")}`;
  return cleanText(raw);
}

function nsTrecho(item: NsItem): string {
  const pvIni = item.pv_ini ?? item.pv_montante ?? item.origem;
  const pvFim = item.pv_fim ?? item.pv_jusante ?? item.destino;
  if (pvIni || pvFim) return `${cleanText(pvIni ?? "-")} -> ${cleanText(pvFim ?? "-")}`;
  return cleanText(item.trecho ?? "-");
}

function toneClass(v: unknown): string {
  const t = cleanText(v).toLowerCase();
  if (t.includes("concl") || t.includes("live") || t.includes("ok")) return "pill pill-ok";
  if (t.includes("exec") || t.includes("aberto") || t.includes("build")) return "pill pill-warn";
  if (t.includes("erro") || t.includes("fail") || t.includes("bloq")) return "pill pill-bad";
  return "pill pill-neutral";
}

function currentPhase(nucleo: CronogramaNucleo): CronogramaFase | null {
  const now = Date.now();
  for (const f of nucleo.fases) {
    const s = new Date(`${f.inicio}T12:00:00`).getTime();
    const e = new Date(`${f.fim}T12:00:00`).getTime();
    if (now >= s && now <= e) return f;
  }
  for (const f of nucleo.fases) {
    if (now < new Date(`${f.inicio}T12:00:00`).getTime()) return f;
  }
  return nucleo.fases.at(-1) ?? null;
}

function makeDefaultRdoForm(nucleo = ""): RdoFormState {
  return {
    data: todayIso(), nucleo, responsavel: "", climaManha: "Sol", climaTarde: "Sol",
    equipeFuncao: "", equipeQtd: "1", ocorrenciaTipo: "outro", ocorrenciaHora: "",
    ocorrenciaDescricao: "", nsId: "", servico: "", quantidade: "", unidade: "m", dnMm: "",
  };
}

/* ─── APP ─── */

export default function LegacyApp() {
  const [activeTab, setActiveTab] = useState<TabId>("processar");
  const [health, setHealth] = useState<Health | null>(null);
  const [cronograma, setCronograma] = useState<CronogramaData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [nsList, setNsList] = useState<NsList>({ items: [] });
  const [rdoList, setRdoList] = useState<RdoList>({ items: [] });
  const [curvaS, setCurvaS] = useState<CurvaS | null>(null);
  const [geoJson, setGeoJson] = useState<GeoJson | null>(null);
  const [manageData, setManageData] = useState<ManageData | null>(null);
  const [latestJob, setLatestJob] = useState<ProcessJob | null>(null);
  const [selectedNucleo, setSelectedNucleo] = useState("");
  const [selectedNsId, setSelectedNsId] = useState<number | null>(null);
  const [selectedNsDetail, setSelectedNsDetail] = useState<NsDetail | null>(null);
  const [selectedNsPhotos, setSelectedNsPhotos] = useState<FotoItem[]>([]);
  const [pendingStatus, setPendingStatus] = useState("PLANEJADA");
  const [uploading, setUploading] = useState(false);
  const [uploadNucleo, setUploadNucleo] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [quickMode, setQuickMode] = useState(false);
  const [selectedMotor, setSelectedMotor] = useState("v5");
  const [uploadMessage, setUploadMessage] = useState("");
  const [auditProjects, setAuditProjects] = useState<FileList | null>(null);
  const [auditShapes, setAuditShapes] = useState<FileList | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [auditMessage, setAuditMessage] = useState("");
  const [processLogs, setProcessLogs] = useState<ProcessLogList>({ items: [] });
  const [leanInsight, setLeanInsight] = useState<LeanInsight | null>(null);
  const [lossInsight, setLossInsight] = useState<LossInsight | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [nucleoCatalog, setNucleoCatalog] = useState<NucleoCatalog>({ items: [], total: 0 });
  const [rdoForm, setRdoForm] = useState<RdoFormState>(makeDefaultRdoForm());
  const [rdoMessage, setRdoMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  // ── Data loading ──
  useEffect(() => {
    let active = true;
    async function loadBase() {
      const [hR, cR, jR, lR, aR, nR] = await Promise.allSettled([
        getJson<Health>("/health"),
        getJson<CronogramaData>("/api/cronograma"),
        getJson<ProcessJob>("/api/processamento/ultimo"),
        getJson<ProcessLogList>("/api/processamento/logs"),
        getJson<AnalyticsSummary>("/api/analytics/resumo"),
        getJson<NucleoCatalog>("/api/nucleos"),
      ]);
      if (!active) return;
      if (hR.status === "fulfilled") setHealth(hR.value);
      if (cR.status === "fulfilled") setCronograma(cR.value);
      if (jR.status === "fulfilled") setLatestJob(jR.value);
      if (lR.status === "fulfilled") setProcessLogs(lR.value);
      if (aR.status === "fulfilled") setAnalyticsSummary(aR.value);
      if (nR.status === "fulfilled") setNucleoCatalog(nR.value);
      const fails = [hR, cR].filter(r => r.status === "rejected");
      if (fails.length > 0) {
        const f = fails[0] as PromiseRejectedResult;
        setError(f.reason instanceof Error ? f.reason.message : "Falha ao carregar a base");
      } else setError("");
    }
    loadBase();
    return () => { active = false; };
  }, [refreshKey]);

  useEffect(() => {
    let active = true;
    async function loadScope() {
      const [dR, nsR, rR, csR, gR, mR] = await Promise.allSettled([
        getJson<DashboardData>("/api/dashboard", selectedNucleo),
        getJson<NsList>("/api/ns", selectedNucleo),
        getJson<RdoList>("/api/rdo", selectedNucleo),
        getJson<CurvaS>("/api/curva-s", selectedNucleo),
        getJson<GeoJson>("/api/cadastro/geojson", selectedNucleo),
        getJson<ManageData>("/api/manage/rede", selectedNucleo),
      ]);
      if (!active) return;
      if (dR.status === "fulfilled") setDashboard(dR.value);
      if (nsR.status === "fulfilled") setNsList(nsR.value);
      if (rR.status === "fulfilled") setRdoList(rR.value);
      if (csR.status === "fulfilled") setCurvaS(csR.value);
      if (gR.status === "fulfilled") setGeoJson(gR.value);
      if (mR.status === "fulfilled") setManageData(mR.value);
    }
    loadScope();
    return () => { active = false; };
  }, [selectedNucleo, refreshKey]);

  useEffect(() => {
    let active = true;
    async function loadInsights() {
      const [lR, pR] = await Promise.allSettled([
        getJson<LeanInsight>("/api/insights/lean-lps", selectedNucleo),
        getJson<LossInsight>("/api/insights/perdas", selectedNucleo),
      ]);
      if (!active) return;
      if (lR.status === "fulfilled") setLeanInsight(lR.value);
      if (pR.status === "fulfilled") setLossInsight(pR.value);
    }
    loadInsights();
    return () => { active = false; };
  }, [selectedNucleo, refreshKey]);

  useEffect(() => {
    let active = true;
    async function loadNsDetail() {
      if (!selectedNsId) { setSelectedNsDetail(null); setSelectedNsPhotos([]); return; }
      const [dR, pR] = await Promise.allSettled([
        getJson<NsDetail>(`/api/ns/${selectedNsId}`),
        getJson<FotoList>(`/api/fotos/${selectedNsId}`),
      ]);
      if (!active) return;
      if (dR.status === "fulfilled") { setSelectedNsDetail(dR.value); setPendingStatus(cleanText(dR.value.status || "PLANEJADA")); }
      if (pR.status === "fulfilled") setSelectedNsPhotos(pR.value.items || []);
    }
    loadNsDetail();
    return () => { active = false; };
  }, [selectedNsId, refreshKey]);

  useEffect(() => {
    setRdoForm(c => ({ ...c, nucleo: c.nucleo || selectedNucleo }));
  }, [selectedNucleo]);

  // ── Handlers ──
  async function handleImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!uploadFile) { setUploadMessage("Escolha um arquivo antes de processar."); return; }
    setUploading(true); setUploadMessage("");
    const fd = new FormData();
    fd.append("arquivo", uploadFile);
    fd.append("nucleo", uploadNucleo);
    fd.append("modo_rapido", quickMode ? "true" : "false");
    fd.append("motor", selectedMotor);
    try {
      const r = await fetch(apiUrl("/api/processamento/importar"), { method: "POST", body: fd });
      const d = (await r.json()) as ProcessJob & { detail?: string };
      if (!r.ok) throw new Error(d.detail || "Falha ao importar projeto");
      setLatestJob(d);
      setUploadMessage(`Projeto processado com ${cleanText(d.motor ?? selectedMotor).toUpperCase()}. ${d.ns_geradas ?? 0} NS geradas.`);
      if (d.nucleo) setSelectedNucleo(d.nucleo);
      setRefreshKey(v => v + 1);
      // ── Publicar resultado na store central para integração com todos os módulos ──
      usePipelineStore.getState().publishPipelineResult({
        n_pvs: d.n_pvs ?? 0,
        n_trechos: d.n_trechos ?? 0,
        extensao_total_m: (d.meta as any)?.extensao_total_m ?? 0,
        ns_geradas: d.ns_geradas ?? 0,
        ns_erros: d.ns_erros ?? 0,
        nucleo: d.nucleo ?? uploadNucleo,
        motor: d.motor ?? selectedMotor,
        arquivo: d.arquivo ?? uploadFile.name,
        job_id: d.job_id,
      });
    } catch (err) { setUploadMessage(err instanceof Error ? err.message : "Falha ao importar projeto"); }
    finally { setUploading(false); }
  }

  async function handleApenasLer() {
    if (!uploadFile) { setUploadMessage("Escolha um arquivo antes de ler."); return; }
    setUploading(true); setUploadMessage("");
    const fd = new FormData();
    fd.append("arquivo", uploadFile);
    try {
      const r = await fetch(apiUrl("/api/processamento/apenas-ler"), { method: "POST", body: fd });
      const d = (await r.json()) as ProcessJob & { detail?: string; rede?: { pvs: Record<string, any>; trechos: any[] } };
      if (!r.ok) throw new Error(d.detail || "Falha ao ler arquivo");
      setLatestJob(d);
      setUploadMessage(`Arquivo lido: ${d.n_pvs ?? 0} PVs, ${d.n_trechos ?? 0} trechos, ${((d as any).extensao_total_m ?? 0).toFixed(1)}m. Clique IMPORTAR E GERAR para criar NS.`);
    } catch (err) { setUploadMessage(err instanceof Error ? err.message : "Falha ao ler arquivo"); }
    finally { setUploading(false); }
  }

  function handleUploadFileChange(file: File | null) {
    setUploadFile(file);
    if (!file) return;
    const lower = file.name.toLowerCase();
    // Auto-detectar motor ideal baseado no tipo de arquivo
    if (lower.endsWith(".xml") || lower.endsWith(".landxml")) {
      setSelectedMotor("v9");
    } else if (lower.endsWith(".dxf")) {
      // ProSaneamento vs Civil3D será detectado automaticamente no backend
      setSelectedMotor("v9");
    } else if (lower.endsWith(".dwg")) {
      setSelectedMotor("v9");
    }
  }

  async function handleNsStatusUpdate() {
    if (!selectedNsId) return;
    try {
      const r = await fetch(apiUrl(`/api/ns/${selectedNsId}/status`), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: pendingStatus, data_referencia: todayIso() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Falha ao atualizar status");
      setSelectedNsDetail(c => c ? { ...c, status: pendingStatus } : c);
      setRefreshKey(v => v + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao atualizar status"); }
  }

  async function handleCreateRdo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setRdoMessage("");
    const payload: Record<string, unknown> = {
      data: rdoForm.data, nucleo: rdoForm.nucleo || selectedNucleo || "REDE",
      responsavel: rdoForm.responsavel, rt: rdoForm.responsavel,
      clima: { manha: rdoForm.climaManha, tarde: rdoForm.climaTarde },
    };
    if (rdoForm.equipeFuncao && Number(rdoForm.equipeQtd) > 0)
      payload.equipe = [{ funcao: rdoForm.equipeFuncao, qtd: Number(rdoForm.equipeQtd) }];
    if (rdoForm.ocorrenciaDescricao)
      payload.ocorrencias = [{ tipo: rdoForm.ocorrenciaTipo, desc: rdoForm.ocorrenciaDescricao, hora: rdoForm.ocorrenciaHora }];
    if (rdoForm.nsId && rdoForm.servico && Number(rdoForm.quantidade) > 0)
      payload.servicos = { [rdoForm.nsId]: [{ ns_id: Number(rdoForm.nsId), servico: rdoForm.servico, qtd: Number(rdoForm.quantidade), unidade: rdoForm.unidade || "m", dn_mm: Number(rdoForm.dnMm || 0) }] };
    try {
      const r = await fetch(apiUrl("/api/rdo"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Falha ao criar RDO");
      setRdoMessage(`RDO ${d.numero ?? d.id} salvo com sucesso.`);
      setRdoForm(makeDefaultRdoForm(rdoForm.nucleo || selectedNucleo));
      setRefreshKey(v => v + 1);
    } catch (err) { setRdoMessage(err instanceof Error ? err.message : "Falha ao criar RDO"); }
  }

  async function handleCloseRdo(rdoId: number) {
    try {
      const r = await fetch(apiUrl(`/api/rdo/${rdoId}/fechar`), { method: "PATCH" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Falha ao fechar RDO");
      setRdoMessage(`RDO ${d.numero ?? d.id} fechado.`);
      setRefreshKey(v => v + 1);
    } catch (err) { setRdoMessage(err instanceof Error ? err.message : "Falha ao fechar RDO"); }
  }

  async function handleAudit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!auditProjects || !auditShapes || auditProjects.length === 0 || auditShapes.length === 0) {
      setAuditMessage("Selecione os projetos e os shapefiles."); return;
    }
    setAuditing(true); setAuditMessage("");
    const fd = new FormData();
    for (let i = 0; i < auditProjects.length; i++) fd.append("arquivos_projeto", auditProjects[i]);
    for (let i = 0; i < auditShapes.length; i++) fd.append("arquivos_shapefile", auditShapes[i]);
    
    try {
      const r = await fetch(apiUrl("/api/processamento/lote-auditoria"), { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Falha na Auditoria");
      setLatestJob(d);
      setAuditMessage(`Auditoria concluída: ${d.n_projetos} projetos cruzados com sucesso.`);
      setRefreshKey(v => v + 1);
    } catch (err) { setAuditMessage(err instanceof Error ? err.message : "Falha na auditoria"); }
    finally { setAuditing(false); }
  }

  // ── Derived data ──
  const projectName = cleanText(cronograma?.projeto ?? health?.display_name ?? "ConstruDataMaxV2");
  const companyName = cleanText(cronograma?.empresa ?? "FCN Construcoes e Saneamento");
  const nuclei = cronograma?.nucleos ?? [];
  const visibleNuclei = useMemo(() => selectedNucleo ? nuclei.filter(n => n.nome === selectedNucleo) : nuclei, [nuclei, selectedNucleo]);
  const latestNs = nsList.items.slice(0, 20);
  const latestRdos = rdoList.items.slice(0, 10);
  const curvePrev = curvaS?.previsto.at(-1);
  const curveReal = curvaS?.realizado.at(-1);
  const manageCost = (manageData?.edges ?? []).reduce((a, e) => a + asNumber(e.c), 0);
  const geoTrechos = (geoJson?.features ?? []).filter(f => cleanText(f.properties?.feature_type) === "trecho").length;
  const geoPvs = (geoJson?.features ?? []).filter(f => cleanText(f.properties?.feature_type) === "pv").length;
  const nucleoNames = useMemo(() => {
    const s = new Set<string>();
    for (const n of nuclei) if (n.nome) s.add(cleanText(n.nome));
    for (const n of nucleoCatalog.items) if (n.nome) s.add(cleanText(n.nome));
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [nuclei, nucleoCatalog.items]);
  const selectedMotorLabel = selectedMotor === "v5" ? "Nova NS v5 (legado)" : "Hydro v9 (auto-detect)";

  // ── Tab renderers ──

  function renderProcessar() {
    return (
      <div className="space-y-6">
        <div className="p-panel border-t-2 border-t-[#0284c7]">
          <div className="panel-header">
            <h2 className="panel-title">
               <span className="w-8 h-8 rounded bg-[#0284c7]/20 flex items-center justify-center text-[#38bdf8] border border-[#0284c7]/50 shadow-[0_0_15px_rgba(2,132,199,0.5)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
               </span>
               Motor Central (BETA)
               <span className="badge">ROTEAMENTO BASE</span>
            </h2>
          </div>
          
          <form id="import-form" onSubmit={handleImport}>
            <div className="form-row">
              <div className="form-field">
                <label>Nucleo / Lote</label>
                <input type="text" placeholder="ID do Nucleo" value={uploadNucleo} onChange={e => setUploadNucleo(e.target.value)} />
              </div>
              <div className="form-field" style={{ flex: 2 }}>
                <label>Vetor de Origem (DXF, DWG, LandXML, JSON)</label>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input id="file-input" type="file" accept=".json,.xml,.landxml,.dxf,.dwg" onChange={e => handleUploadFileChange(e.target.files?.[0] ?? null)} style={{ flex: 1 }} />
                  <button type="button" className="btn btn-outline" onClick={() => document.getElementById("file-input")?.click()}>
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                     PROCURAR
                  </button>
                </div>
                {uploadFile && (
                  <div className="text-[10px] text-[#38bdf8] font-mono mt-1 px-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full animate-pulse"></span>
                    {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
              <div className="form-field">
                <label>Interpretador</label>
                <select value={selectedMotor} onChange={e => setSelectedMotor(e.target.value)}>
                  <option value="v9">Geração 9 (XML/DXF Sintatico)</option>
                  <option value="v5">Legado (SABESP v5 Brutal)</option>
                </select>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-[rgba(255,255,255,0.05)]">
               <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-4">Módulos de Inicialização (Engine Offline)</h3>
               <div className="modular-grid">
                  <button type="submit" onClick={()=>setQuickMode(false)} className="modular-btn active">
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                     <span>PACK COMPLETO<br/>(Lá Ele)</span>
                  </button>
                  <button type="submit" onClick={()=>setQuickMode(true)} className="modular-btn">
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                     <span>NS CAMPO / NS DESENHO</span>
                  </button>
                  <button type="button" onClick={handleApenasLer} className="modular-btn">
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                     <span>APENAS LER / PARSE</span>
                  </button>
                  <button type="button" disabled className="modular-btn opacity-50 cursor-not-allowed">
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                     <span>OSE / COMPRAS<br/>(Em Breve)</span>
                  </button>
               </div>
            </div>

            {uploading && (
              <div className="w-full h-1 bg-[var(--bg-base)] rounded overflow-hidden mt-4">
                <div className="h-full bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] animate-pulse w-full"></div>
              </div>
            )}
            
            {uploadMessage && (
              <div className={uploadMessage.includes("Falha") ? "sys-msg msg-error mt-4" : "sys-msg msg-success mt-4"}>
                {uploadMessage}
              </div>
            )}
          </form>
        </div>

        <div className="p-panel border-t-2 border-t-[#f59e0b]">
           <div className="panel-header">
             <h2 className="panel-title">
               <span className="w-8 h-8 rounded bg-[#f59e0b]/20 flex items-center justify-center text-[#fcd34d] border border-[#f59e0b]/50 shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 12 12 17 22 12"></polyline><polyline points="2 17 12 22 22 17"></polyline></svg>
               </span>
               Auditoria Executiva V4
               <span className="badge border-[#f59e0b]/30 text-[#fcd34d] bg-[#f59e0b]/10">SHAPE X DWG</span>
             </h2>
           </div>
           
           <form id="audit-form" onSubmit={handleAudit}>
             <div className="form-row">
               <div className="form-field">
                 <label>Base DWG/DXF/XML (Projeto)</label>
                 <input type="file" multiple accept=".dxf,.dwg,.xml,.json" onChange={e => setAuditProjects(e.target.files)} />
               </div>
               <div className="form-field">
                 <label>Camadas SHP (Soltos ou .zip)</label>
                 <input type="file" multiple accept=".shp,.zip,.dbf,.shx,.cpg" onChange={e => setAuditShapes(e.target.files)} />
               </div>
             </div>
             <div className="action-row mt-4">
               <button className="btn btn-banana w-full" type="submit" disabled={auditing || !auditProjects || !auditShapes}>
                 {auditing ? "PROCESSANDO BALANÇO..." : "📊 CRUZAR DADOS E GERAR V4"}
               </button>
             </div>
             {auditMessage && (
               <div className={auditMessage.includes("Falha") ? "sys-msg msg-error mt-4" : "sys-msg msg-success mt-4"}>
                 {auditMessage}
               </div>
             )}
           </form>
        </div>

        {latestJob && (
          <div className="p-panel border-t-2 border-t-[#10b981]">
            <div className="panel-header">
              <h2 className="panel-title">
                 <span className="w-8 h-8 rounded bg-[#10b981]/20 flex items-center justify-center text-[#34d399] border border-[#10b981]/50 shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                 </span>
                 Telemetria de Processamento
                 <span className="badge tracking-widest bg-emerald-500/10 text-emerald-400 border-emerald-500/20">JOB CONCLUIDO</span>
              </h2>
            </div>
            
            <div className="kpi-board mb-6">
               <div className="kpi-card !p-4">
                  <div className="text-[10px] text-[var(--text-muted)] font-bold mb-1">ORIGEM</div>
                  <div className="text-xl font-mono text-[#e2e8f0] truncate">{cleanText(latestJob.arquivo ?? "-")}</div>
               </div>
               <div className="kpi-card !p-4">
                  <div className="text-[10px] text-[var(--text-muted)] font-bold mb-1">INTERPRETADOR</div>
                  <div className="text-xl font-mono text-[#38bdf8]">{cleanText(latestJob.motor ?? "-").toUpperCase()}</div>
               </div>
               <div className="kpi-card !p-4">
                  <div className="text-[10px] text-[var(--text-muted)] font-bold mb-1">EXTENSÃO TOTAL</div>
                  <div className="text-xl font-mono text-[#fcd34d] truncate">{formatInt(latestJob.n_trechos ?? 0)} T, {formatInt(latestJob.n_pvs ?? 0)} PV</div>
               </div>
               <div className="kpi-card !p-4">
                  <div className="text-[10px] text-[var(--text-muted)] font-bold mb-1">TAXA DE SUCESSO</div>
                  <div className="text-xl font-mono text-emerald-400">{formatInt(latestJob.ns_geradas ?? 0)} OK / <span className="text-red-400">{formatInt(latestJob.ns_erros ?? 0)} FAIL</span></div>
               </div>
            </div>

            {latestJob.artifacts.length > 0 && (
              <>
                <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">ARTEFATOS GERADOS</h3>
                <div className="artifact-list">
                  {latestJob.artifacts.slice(0, 20).map(a => (
                    <a className="artifact-item group" key={`${latestJob.job_id}-${a.path}`} href={artifactHref(latestJob.job_id, a.path)} target="_blank" rel="noreferrer">
                       <div className="artifact-info">
                         <span className="artifact-kind">{a.kind}</span>
                         <span className="artifact-name" title={a.label}>{a.label}</span>
                       </div>
                       <span className="text-[10px] font-bold text-[#38bdf8] opacity-0 group-hover:opacity-100 transition-opacity">
                         ACESSAR ARQUIVO ↗
                       </span>
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderMapa() {
    return (
      <>
        <div className="section-title">Mapa da Rede</div>
        <div className="action-row">
          <a className="action-btn btn-green" href={nativeUrl("/manage")} target="_blank" rel="noreferrer">ABRIR EM NOVA GUIA</a>
        </div>
        <div className="module-frame-wrap">
          <iframe src={nativeUrl("/manage")} title="Mapa" />
        </div>
      </>
    );
  }

  function renderRede() {
    return (
      <>
        <div className="section-title">Rede 3D — Manage Dataset</div>
        <div className="kpi-strip">
          <div className="kpi-cell"><span className="kpi-label">Nos</span><span className="kpi-value">{formatInt(manageData?.nodes.length ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Arestas</span><span className="kpi-value">{formatInt(manageData?.edges.length ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Extensao</span><span className="kpi-value">{formatMeters(asNumber(manageData?.ext))}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Custo 5D</span><span className="kpi-value">{formatCurrency(manageCost)}</span></div>
        </div>
        <div className="action-row">
          <a className="action-btn btn-cyan" href={nativeUrl("/manage")} target="_blank" rel="noreferrer">VIEWER 3D</a>
          <a className="action-btn btn-dark" href={apiUrl("/api/manage/rede")} target="_blank" rel="noreferrer">JSON BRUTO</a>
        </div>
        <div className="module-frame-wrap">
          <iframe src={nativeUrl("/manage")} title="Rede" />
        </div>
      </>
    );
  }

  function renderHidraulica() {
    return (
      <>
        <div className="section-title">Hidraulica — Notas de Servico</div>
        <div className="section-subtitle">Selecione uma NS para ver detalhe, materiais, checklist e fotos</div>

        <div className="scope-bar">
          <button className={selectedNucleo === "" ? "scope-btn active" : "scope-btn"} onClick={() => setSelectedNucleo("")}>Todos</button>
          {nucleoNames.slice(0, 10).map(n => (
            <button key={n} className={selectedNucleo === n ? "scope-btn active" : "scope-btn"} onClick={() => setSelectedNucleo(n)}>{n}</button>
          ))}
        </div>

        <div className="two-col">
          <div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>NS</th><th>Trecho</th><th>Status</th><th>DN</th><th>Ext</th>
                </tr>
              </thead>
              <tbody>
                {latestNs.length ? latestNs.map((item, i) => {
                  const id = asNumber(item.id);
                  return (
                    <tr key={`${id}-${i}`} className={selectedNsId === id ? "row-active" : ""} onClick={() => setSelectedNsId(id)}>
                      <td>{nsCode(item)}</td>
                      <td>{nsTrecho(item)}</td>
                      <td><span className={toneClass(item.status)}>{cleanText(item.status ?? "-")}</span></td>
                      <td>{formatInt(asNumber(item.dn_mm))}</td>
                      <td>{formatMeters(asNumber(item.ext_m))}</td>
                    </tr>
                  );
                }) : <tr><td colSpan={5} className="empty">Nenhuma NS disponivel.</td></tr>}
              </tbody>
            </table>
          </div>

          <div>
            {selectedNsDetail ? (
              <div className="detail-panel">
                <div className="section-title">{nsCode(selectedNsDetail)}</div>
                <div className="detail-row"><span className="dlabel">Nucleo</span><span className="dvalue">{cleanText(selectedNsDetail.nucleo)}</span></div>
                <div className="detail-row"><span className="dlabel">Rua</span><span className="dvalue">{cleanText(selectedNsDetail.rua ?? "-")}</span></div>
                <div className="detail-row"><span className="dlabel">Material</span><span className="dvalue">{cleanText(selectedNsDetail.material ?? "-")}</span></div>
                <div className="detail-row"><span className="dlabel">Checklist</span><span className="dvalue">{formatInt((selectedNsDetail.checklist ?? []).filter(c => Boolean(c.concluido)).length)} / {formatInt(selectedNsDetail.checklist?.length ?? 0)}</span></div>

                <div style={{ marginTop: 10 }}>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Status</label>
                      <select value={pendingStatus} onChange={e => setPendingStatus(e.target.value)}>
                        {NS_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <button className="action-btn btn-green" onClick={handleNsStatusUpdate}>ATUALIZAR STATUS</button>
                </div>

                {(selectedNsDetail.materiais ?? []).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div className="section-title">Materiais</div>
                    <ul className="mat-list">
                      {(selectedNsDetail.materiais ?? []).slice(0, 12).map((m, i) => (
                        <li key={`${m.descricao}-${i}`}>{m.quantidade} {m.unidade} - {cleanText(m.descricao)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(selectedNsDetail.checklist ?? []).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div className="section-title">Checklist</div>
                    <ul className="checklist">
                      {(selectedNsDetail.checklist ?? []).map(c => (
                        <li key={String(c.id)}>
                          <span className={c.concluido ? "check-ok" : "check-pend"}>{c.concluido ? "OK" : "PEND"}</span>{" "}
                          {cleanText(c.item)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedNsPhotos.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div className="section-title">Fotos</div>
                    <ul className="mat-list">
                      {selectedNsPhotos.map((p, i) => (
                        <li key={`${p.caminho}-${i}`}>{cleanText(p.legenda || p.caminho || "Foto")} - {formatDateTime(p.data_hora)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty">Selecione uma NS na tabela ao lado.</div>
            )}
          </div>
        </div>
      </>
    );
  }

  function renderTrechos() {
    return (
      <>
        <div className="section-title">Trechos e Cadastro Tecnico</div>
        <div className="kpi-strip">
          <div className="kpi-cell"><span className="kpi-label">Feicoes GIS</span><span className="kpi-value">{formatInt(geoJson?.features.length ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Trechos</span><span className="kpi-value">{formatInt(geoTrechos)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">PVs / PIs</span><span className="kpi-value">{formatInt(geoPvs)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Extensao Total</span><span className="kpi-value">{formatMeters(asNumber(manageData?.ext))}</span></div>
        </div>
        <div className="action-row">
          <a className="action-btn btn-cyan" href={apiUrl("/api/cadastro/geojson")} target="_blank" rel="noreferrer">GEOJSON BRUTO</a>
          <a className="action-btn btn-dark" href={nativeUrl("/campo")} target="_blank" rel="noreferrer">CAMPO</a>
        </div>

        <table className="data-table">
          <thead>
            <tr><th>NS</th><th>Trecho</th><th>DN (mm)</th><th>Extensao</th><th>Status</th></tr>
          </thead>
          <tbody>
            {nsList.items.slice(0, 30).map((item, i) => (
              <tr key={`t-${asNumber(item.id)}-${i}`}>
                <td>{nsCode(item)}</td>
                <td>{nsTrecho(item)}</td>
                <td>{formatInt(asNumber(item.dn_mm))}</td>
                <td>{formatMeters(asNumber(item.ext_m))}</td>
                <td><span className={toneClass(item.status)}>{cleanText(item.status ?? "-")}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  function renderCustos() {
    return (
      <>
        <div className="section-title">Custos 5D — Resumo Financeiro</div>
        <div className="kpi-strip">
          <div className="kpi-cell"><span className="kpi-label">% Fisico</span><span className="kpi-value">{formatPercent(dashboard?.pct_fisico ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">% Financeiro</span><span className="kpi-value">{formatPercent(dashboard?.pct_financeiro ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Valor Liberado</span><span className="kpi-value">{formatCurrency(dashboard?.valor_liberado ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Custo RDO Total</span><span className="kpi-value">{formatCurrency(dashboard?.custo_rdo_total ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Custo Rede 5D</span><span className="kpi-value">{formatCurrency(manageCost)}</span></div>
        </div>
        <div className="action-row">
          <a className="action-btn btn-cyan" href={nativeUrl("/controle")} target="_blank" rel="noreferrer">CONTROLE</a>
          <a className="action-btn btn-dark" href={apiUrl("/api/curva-s")} target="_blank" rel="noreferrer">CURVA S JSON</a>
        </div>

        <div className="two-col">
          <div className="detail-panel">
            <div className="section-title">Curva S — Previsto</div>
            <div className="detail-row"><span className="dlabel">% Acumulado</span><span className="dvalue">{formatPercent(asNumber(curvePrev?.pct_acum ?? curvePrev?.acum_pct))}</span></div>
            <div className="detail-row"><span className="dlabel">Extensao</span><span className="dvalue">{formatMeters(asNumber(curvePrev?.ext_acum))}</span></div>
            <div className="detail-row"><span className="dlabel">Custo</span><span className="dvalue">{formatCurrency(asNumber(curvePrev?.custo_acum))}</span></div>
          </div>
          <div className="detail-panel">
            <div className="section-title">Curva S — Realizado</div>
            <div className="detail-row"><span className="dlabel">% Acumulado</span><span className="dvalue">{formatPercent(asNumber(curveReal?.pct_acum ?? curveReal?.acum_pct))}</span></div>
            <div className="detail-row"><span className="dlabel">Extensao</span><span className="dvalue">{formatMeters(asNumber(curveReal?.ext_acum))}</span></div>
            <div className="detail-row"><span className="dlabel">Custo</span><span className="dvalue">{formatCurrency(asNumber(curveReal?.custo_acum))}</span></div>
          </div>
        </div>
      </>
    );
  }

  function renderBim() {
    const kinds = (latestJob?.artifacts ?? []).reduce<Record<string, number>>((a, art) => {
      const k = cleanText(art.kind).toLowerCase() || "outros";
      a[k] = (a[k] ?? 0) + 1;
      return a;
    }, {});

    return (
      <>
        <div className="section-title">Pipeline de Saidas BIM 5D</div>
        <div className="action-row">
          <button className="action-btn btn-green" disabled>GERAR TUDO (6 etapas)</button>
          <button className="action-btn btn-red" disabled>IFC LOD500</button>
          <button className="action-btn btn-blue" disabled>LandXML</button>
          <button className="action-btn btn-orange" disabled>Cadastro NTS292</button>
          <button className="action-btn btn-red" disabled>Cadastro DXF</button>
          <button className="action-btn btn-teal" disabled>Cronograma</button>
          <button className="action-btn btn-purple" disabled>Dynamo</button>
          <button className="action-btn btn-dark" disabled>SCR</button>
        </div>

        <div className="link-row">
          <span style={{ color: "#667788", marginRight: 8 }}>Interfaces HTML:</span>
          <a className="link-btn" href={nativeUrl("/editor")} target="_blank" rel="noreferrer">Editor EPANET</a>
          <a className="link-btn" href={nativeUrl("/manage")} target="_blank" rel="noreferrer">Viewer 3D</a>
          <a className="link-btn" href={nativeUrl("/controle")} target="_blank" rel="noreferrer">Controle As-Built</a>
          <a className="link-btn" href={nativeUrl("/rdo")} target="_blank" rel="noreferrer">RDO Diario</a>
          <a className="link-btn" href={nativeUrl("/perdas")} target="_blank" rel="noreferrer">Gestao Perdas</a>
          <a className="link-btn" href={nativeUrl("/fluxograma-bim")} target="_blank" rel="noreferrer">Fluxograma</a>
        </div>

        <div className="section-title">SAIDAS DO PIPELINE (12 Pastas)</div>
        <div className="output-list">
          <div className="output-item"><span className="folder">01_NS_CAMPO/</span><span className="desc">Notas de Serviço: PDF A4 + DESENHO + SAT + MAPA + JSON DADOS</span></div>
          <div className="output-item"><span className="folder">02_DESENHOS/</span><span className="desc">PDFs A3 técnicos por NS (perfil + planta)</span></div>
          <div className="output-item"><span className="folder">03_HTML/</span><span className="desc">Mapas Leaflet interativos por trecho</span></div>
          <div className="output-item"><span className="folder">04_GIS/</span><span className="desc">GeoJSON georref SIRGAS 2000 UTM 23S</span></div>
          <div className="output-item"><span className="folder">05_PLANILHAS/</span><span className="desc">Mestre PV a PV + Hidráulica + Curva S</span></div>
          <div className="output-item"><span className="folder">06_CUSTOS/</span><span className="desc">XLSX custos com BDI + quantitativos</span></div>
          <div className="output-item"><span className="folder">07_BIM_IFC/</span><span className="desc">IFC LOD 500 (SweptDiskSolid+ExtrudedAreaSolid) + CSV + JSON</span></div>
          <div className="output-item"><span className="folder">08_LEAN_LPS/</span><span className="desc">Last Planner System + Lean completo</span></div>
          <div className="output-item"><span className="folder">09_MICROPLAN/</span><span className="desc">Microplanejamento por equipes</span></div>
          <div className="output-item"><span className="folder">10_CRONOGRAMA/</span><span className="desc">Gantt NS + MS Project XML + P6 XER + OpenProject CSV</span></div>
          <div className="output-item"><span className="folder">11_POR_RUA/</span><span className="desc">Trechos separados por logradouro</span></div>
          <div className="output-item"><span className="folder">12_LOG/</span><span className="desc">JSON de processamento e rastreabilidade</span></div>
        </div>

        <div className="kpi-strip">
          <div className="kpi-cell"><span className="kpi-label">HTML</span><span className="kpi-value">{formatInt(kinds.html ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">PDF</span><span className="kpi-value">{formatInt(kinds.pdf ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">JSON</span><span className="kpi-value">{formatInt(kinds.json ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">IFC</span><span className="kpi-value">{formatInt(kinds.ifc ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">CSV</span><span className="kpi-value">{formatInt(kinds.csv ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">XML</span><span className="kpi-value">{formatInt(kinds.xml ?? 0)}</span></div>
        </div>
      </>
    );
  }

  function renderLean() {
    return (
      <>
        <div className="section-title">Lean Construction + Last Planner System + BIM 6D</div>
        <div className="action-row">
          <button className="action-btn btn-green" disabled>RELATORIO LEAN+LPS</button>
          <button className="action-btn btn-purple" disabled>TAKT TIME</button>
          <button className="action-btn btn-blue" disabled>LOOKAHEAD 6 SEM</button>
          <button className="action-btn btn-orange" disabled>BIM 6D (Ciclo Vida)</button>
        </div>

        <div className="kpi-strip">
          <div className="kpi-cell"><span className="kpi-label">Takt (m/dia)</span><span className="kpi-value">{formatMeters(leanInsight?.takt_metros_dia ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Cycle Time</span><span className="kpi-value">{formatInt(leanInsight?.cycle_time_dias ?? 0)} dias</span></div>
          <div className="kpi-cell"><span className="kpi-label">PPC (%)</span><span className="kpi-value warn">{leanInsight?.restricoes_lookahead != null ? formatInt(leanInsight.restricoes_lookahead) : "-"}</span></div>
          <div className="kpi-cell"><span className="kpi-label">VA/NVA</span><span className="kpi-value">{leanInsight?.valor_agregado_pct != null ? formatPercent(leanInsight.valor_agregado_pct) : "-"}</span></div>
          <div className="kpi-cell"><span className="kpi-label">CO2 (ton)</span><span className="kpi-value">{leanInsight?.co2_total_ton != null ? leanInsight.co2_total_ton.toFixed(1) : "-"}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Custo 50 anos</span><span className="kpi-value">{formatCurrency(leanInsight?.custo_ciclo_vida_total ?? 0)}</span></div>
        </div>

        {leanInsight?.alerta_lookahead && (
          <div className="resumo-box">
            <strong>Alerta Lookahead:</strong> {cleanText(leanInsight.alerta_lookahead)}
          </div>
        )}

        <div className="detail-panel">
          <div className="detail-row"><span className="dlabel">Throughput</span><span className="dvalue">{formatInt(leanInsight?.throughput_ns_semana ?? 0)} NS/semana</span></div>
          <div className="detail-row"><span className="dlabel">Planejadas/sem</span><span className="dvalue">{formatInt(leanInsight?.ns_planejadas_semana ?? 0)}</span></div>
          <div className="detail-row"><span className="dlabel">Bloqueadas/sem</span><span className="dvalue">{formatInt(leanInsight?.ns_bloqueadas_semana ?? 0)}</span></div>
          <div className="detail-row"><span className="dlabel">Ext. planejada/sem</span><span className="dvalue">{formatMeters(leanInsight?.ext_planejada_semana ?? 0)}</span></div>
        </div>
      </>
    );
  }

  function renderPerdas() {
    return (
      <>
        <div className="section-title">Gestao de Perdas — IWA / UARL / ILI / DMA</div>
        <div className="action-row">
          <button className="action-btn btn-green" disabled>RELATORIO PERDAS</button>
          <button className="action-btn btn-red" disabled>MAPA RISCO</button>
          <button className="action-btn btn-blue" disabled>CRIAR DMAs</button>
          <button className="action-btn btn-teal" disabled>PDF PERDAS</button>
          <button className="action-btn btn-orange" disabled>ANALISE TROCA</button>
        </div>

        <div className="kpi-strip">
          <div className="kpi-cell"><span className="kpi-label">UARL (m3/ano)</span><span className="kpi-value">{formatInt(lossInsight?.uarl_m3_ano ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">ILI</span><span className="kpi-value warn">{lossInsight?.ili != null ? lossInsight.ili.toFixed(2) : "-"}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Classif.</span><span className="kpi-value">{cleanText(lossInsight?.ili_classificacao ?? "-")}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Risco Alto</span><span className="kpi-value bad">{formatInt(lossInsight?.risco_total_ano ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">DMAs</span><span className="kpi-value">{formatInt(lossInsight?.n_dmas ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Perda R$/ano</span><span className="kpi-value">{formatCurrency(lossInsight?.custo_ineficiencia_ano ?? 0)}</span></div>
        </div>

        <div className="action-row">
          <a className="action-btn btn-dark" href={nativeUrl("/perdas")} target="_blank" rel="noreferrer">ABRIR MODULO NATIVO</a>
        </div>
      </>
    );
  }

  function renderIA() {
    return (
      <>
        <div className="section-title">Assistente IA + E-LLMs Gratuitos + Analytics ML</div>
        <div className="action-row">
          <button className="action-btn btn-green" disabled>GERAR RELATORIO</button>
          <button className="action-btn btn-purple" disabled>ZERAR RELATORIO</button>
          <button className="action-btn btn-orange" disabled>GERAR BENCHMARK</button>
          <button className="action-btn btn-red" disabled>GERAR RISCOS</button>
          <button className="action-btn btn-teal" disabled>MULTI PROV</button>
        </div>

        <div className="kpi-strip">
          <div className="kpi-cell"><span className="kpi-label">Algoritmo</span><span className="kpi-value">{cleanText(analyticsSummary?.algoritmo ?? "Indisponivel")}</span></div>
          <div className="kpi-cell"><span className="kpi-label">R2</span><span className="kpi-value">{(analyticsSummary?.r2_test ?? 0).toFixed(3)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">MAE</span><span className="kpi-value">{(analyticsSummary?.mae ?? 0).toFixed(2)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">RMSE</span><span className="kpi-value">{(analyticsSummary?.rmse ?? 0).toFixed(2)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Modelos</span><span className="kpi-value">{formatInt(analyticsSummary?.n_modelos ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Cenarios</span><span className="kpi-value">{formatInt(analyticsSummary?.n_cenarios ?? 0)}</span></div>
        </div>

        <div className="detail-panel">
          <div className="detail-row"><span className="dlabel">Status</span><span className="dvalue">{cleanText(analyticsSummary?.status ?? "-")}</span></div>
          <div className="detail-row"><span className="dlabel">Gerado em</span><span className="dvalue">{cleanText(analyticsSummary?.gerado_em ?? "-")}</span></div>
          <div className="detail-row"><span className="dlabel">Nucleos</span><span className="dvalue">{formatInt(analyticsSummary?.n_nucleos ?? 0)}</span></div>
          <div className="detail-row"><span className="dlabel">Origem</span><span className="dvalue">{cleanText(analyticsSummary?.origem ?? "-")}</span></div>
        </div>
      </>
    );
  }

  function renderNucleos() {
    return (
      <>
        <div className="section-title">Nucleos DXF (ProSaneamento)</div>
        <table className="data-table">
          <thead><tr><th>Nucleo</th><th>Extensao</th><th>Trechos</th><th>Equipes</th><th>Duracao</th><th>Fase</th></tr></thead>
          <tbody>
            {nuclei.length ? nuclei.map(n => {
              const phase = currentPhase(n);
              return (
                <tr key={n.nome} onClick={() => setSelectedNucleo(n.nome)} className={selectedNucleo === n.nome ? "row-active" : ""}>
                  <td style={{ color: "#00e6a0", fontWeight: 600 }}>{cleanText(n.nome)}</td>
                  <td>{formatMeters(n.extensao_m)}</td>
                  <td>{formatInt(n.n_trechos)}</td>
                  <td>{formatInt(n.equipes)}</td>
                  <td>{formatInt(n.duracao_dias)} dias</td>
                  <td><span className={toneClass(phase?.id ?? "fase")}>{cleanText(phase?.nome ?? "-")}</span></td>
                </tr>
              );
            }) : <tr><td colSpan={6} className="empty">Nenhum nucleo carregado.</td></tr>}
          </tbody>
        </table>

        {nucleoCatalog.items.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 16 }}>Catalogo de Nucleos ({formatInt(nucleoCatalog.total)})</div>
            <table className="data-table">
              <thead><tr><th>Nome</th><th>Existe</th></tr></thead>
              <tbody>
                {nucleoCatalog.items.map(n => (
                  <tr key={n.nome}><td>{cleanText(n.nome)}</td><td style={{ color: "#00e6a0" }}>SIM</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="action-row" style={{ marginTop: 14 }}>
          <button className="action-btn btn-purple" disabled>BATCH NUCLEOS DXF</button>
          <button className="action-btn btn-orange" disabled>BATCH PROLONGAMENTOS</button>
          <button className="action-btn btn-green" disabled>BATCH TUDO</button>
        </div>
      </>
    );
  }

  function renderLog() {
    const logs = processLogs.items;
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    return (
      <>
        <div className="log-area">
          <div className="log-line"><span className="log-time">[{ts}]</span> ConstruData - HydroNetwork v9.0.0 | {selectedMotorLabel}</div>
          <div className="log-line"><span className="log-time">[{ts}]</span> {companyName} - {projectName}</div>
          <div className="log-line"><span className="log-time">[{ts}]</span> [OK] Backend: {health?.ok ? "ONLINE" : "OFFLINE"}</div>
          <div className="log-line"><span className="log-time">[{ts}]</span> [OK] Motores: GDAL, LandXML, DWG/AEC, DWG Semantico, DWG Universal, GerarNS, Civil3D, NTS292, IFC, MSProject, Pipeline, Custo, Medicao, ML, Lean/LPS, Parametrico, MicroPlan, Perdas, CronoMacro, PdfPerdas, Gemini, Multi-LLM, Contratos, Analytics, SLNR_Mestre, Motor_v5</div>
          {error && <div className="log-line" style={{ color: "#f44336" }}><span className="log-time">[{ts}]</span> [ERRO] {error}</div>}
          <div className="log-line">&nbsp;</div>
          <div className="log-line">--- Historico de jobs ---</div>
          {logs.length ? logs.slice(0, 20).map((job, i) => (
            <div className="log-line" key={`log-${job.job_id ?? i}`}>
              <span className="log-time">[{formatDateTime(job.created_at)}]</span>{" "}
              {cleanText(job.motor ?? "-").toUpperCase()} | {cleanText(job.arquivo ?? job.nucleo ?? "-")} | NS: {formatInt(job.ns_geradas ?? 0)} ok / {formatInt(job.ns_erros ?? 0)} erro | Status: {cleanText(job.status ?? "-")}
            </div>
          )) : <div className="log-line">Nenhum job registrado.</div>}
        </div>

        <div className="bottom-bar">
          <button className="action-btn btn-dark" onClick={() => setRefreshKey(v => v + 1)}>Limpar</button>
          <button className="action-btn btn-dark" onClick={() => {
            const text = logs.map(j => `${j.created_at} | ${j.motor} | ${j.arquivo} | NS: ${j.ns_geradas} ok / ${j.ns_erros} erro`).join("\n");
            navigator.clipboard.writeText(text);
          }}>Copiar</button>
        </div>
      </>
    );
  }

  function renderGestao() {
    return (
      <>
        <div className="section-title">Gestao & Cronograma</div>

        <div className="scope-bar">
          <button className={selectedNucleo === "" ? "scope-btn active" : "scope-btn"} onClick={() => setSelectedNucleo("")}>Todos</button>
          {nucleoNames.slice(0, 10).map(n => (
            <button key={n} className={selectedNucleo === n ? "scope-btn active" : "scope-btn"} onClick={() => setSelectedNucleo(n)}>{n}</button>
          ))}
        </div>

        <div className="action-row">
          <a className="action-btn btn-green" href={nativeUrl("/controle")} target="_blank" rel="noreferrer">MEDIR MACRO</a>
          <a className="action-btn btn-blue" href={nativeUrl("/rdo")} target="_blank" rel="noreferrer">MEDIR RDO</a>
          <a className="action-btn btn-orange" href={apiUrl("/api/cronograma")} target="_blank" rel="noreferrer">GERAR MACRO</a>
          <a className="action-btn btn-purple" href={apiUrl("/api/curva-s")} target="_blank" rel="noreferrer">CURVA S JSON</a>
          <button className="action-btn btn-dark" onClick={() => setRefreshKey(v => v + 1)}>ATUALIZAR</button>
        </div>

        <div className="kpi-strip">
          <div className="kpi-cell"><span className="kpi-label">NS Totais</span><span className="kpi-value">{formatInt(dashboard?.n_total ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Em Execucao</span><span className="kpi-value warn">{formatInt(dashboard?.n_execucao ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">% Fisico</span><span className="kpi-value">{formatPercent(dashboard?.pct_fisico ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">% Financeiro</span><span className="kpi-value">{formatPercent(dashboard?.pct_financeiro ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">m/dia</span><span className="kpi-value">{formatMeters(dashboard?.m_por_dia ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">RDOs</span><span className="kpi-value">{formatInt(dashboard?.rdos ?? 0)}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Curva Prevista</span><span className="kpi-value">{formatPercent(asNumber(curvePrev?.pct_acum ?? curvePrev?.acum_pct))}</span></div>
          <div className="kpi-cell"><span className="kpi-label">Curva Realizada</span><span className="kpi-value">{formatPercent(asNumber(curveReal?.pct_acum ?? curveReal?.acum_pct))}</span></div>
        </div>

        {cronograma && (
          <div className="resumo-box">
            <strong>Projeto:</strong> {cleanText(cronograma.projeto)} | <strong>Empresa:</strong> {cleanText(cronograma.empresa)} | <strong>Inicio:</strong> {formatDate(cronograma.data_inicio)} | <strong>Fim:</strong> {formatDate(cronograma.data_fim)} | <strong>Duracao:</strong> {formatInt(cronograma.duracao_total_dias)} dias
          </div>
        )}

        <div className="two-col">
          <div>
            <div className="section-title">Cronograma por Nucleo</div>
            {visibleNuclei.length ? visibleNuclei.map(n => {
              const phase = currentPhase(n);
              return (
                <div className="nucleo-card" key={n.nome}>
                  <h4>{cleanText(n.nome)} <span className={toneClass(phase?.id ?? "")}>{cleanText(phase?.nome ?? "-")}</span></h4>
                  <div className="meta">{formatDate(n.inicio)} ate {formatDate(n.fim)} | {formatMeters(n.extensao_m)} | {formatInt(n.n_trechos)} trechos | {formatInt(n.equipes)} equipes</div>
                </div>
              );
            }) : <div className="empty">Nenhum nucleo disponivel.</div>}
          </div>

          <div>
            <div className="section-title">RDO — Criar e Listar</div>
            <form onSubmit={handleCreateRdo}>
              <div className="form-row">
                <div className="form-field"><label>Data</label><input type="date" value={rdoForm.data} onChange={e => setRdoForm(c => ({ ...c, data: e.target.value }))} /></div>
                <div className="form-field"><label>Nucleo</label><input type="text" value={rdoForm.nucleo} onChange={e => setRdoForm(c => ({ ...c, nucleo: e.target.value }))} /></div>
                <div className="form-field"><label>Responsavel</label><input type="text" value={rdoForm.responsavel} onChange={e => setRdoForm(c => ({ ...c, responsavel: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-field"><label>Servico</label><input type="text" value={rdoForm.servico} onChange={e => setRdoForm(c => ({ ...c, servico: e.target.value }))} /></div>
                <div className="form-field"><label>Qtd</label><input type="number" step="0.01" value={rdoForm.quantidade} onChange={e => setRdoForm(c => ({ ...c, quantidade: e.target.value }))} /></div>
                <div className="form-field"><label>DN</label><input type="number" value={rdoForm.dnMm} onChange={e => setRdoForm(c => ({ ...c, dnMm: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-field"><label>Clima manha</label><input type="text" value={rdoForm.climaManha} onChange={e => setRdoForm(c => ({ ...c, climaManha: e.target.value }))} /></div>
                <div className="form-field"><label>Clima tarde</label><input type="text" value={rdoForm.climaTarde} onChange={e => setRdoForm(c => ({ ...c, climaTarde: e.target.value }))} /></div>
              </div>
              <div className="action-row">
                <button className="action-btn btn-green" type="submit">SALVAR RDO</button>
                <a className="action-btn btn-dark" href={nativeUrl("/rdo")} target="_blank" rel="noreferrer">MODULO NATIVO</a>
              </div>
              {rdoMessage && <div className={rdoMessage.includes("Falha") ? "msg msg-err" : "msg msg-ok"}>{rdoMessage}</div>}
            </form>

            <div className="section-title" style={{ marginTop: 14 }}>RDOs Existentes ({formatInt(rdoList.items.length)})</div>
            {latestRdos.length ? latestRdos.map(rdo => (
              <div className="rdo-card" key={rdo.id}>
                <div className="rdo-head">
                  <strong>RDO {rdo.numero ?? rdo.id} - {formatDate(rdo.data)} - {cleanText(rdo.nucleo)}</strong>
                  <span className={toneClass(rdo.status)}>{cleanText(rdo.status)}</span>
                </div>
                <div className="rdo-meta">Resp: {cleanText(rdo.responsavel ?? "-")} | Custo: {formatCurrency(asNumber(rdo.total_custo))} | Apontam: {formatInt(rdo.apontamentos?.length ?? 0)}</div>
                <div className="action-row">
                  <a className="action-btn btn-dark" href={apiUrl(`/api/rdo/${rdo.id}/pdf`)} target="_blank" rel="noreferrer">PDF</a>
                  {cleanText(rdo.status) !== "FECHADO" && <button className="action-btn btn-red" onClick={() => handleCloseRdo(rdo.id)}>FECHAR</button>}
                  <a className="action-btn btn-dark" href={apiUrl(`/api/rdo/${rdo.data}?nucleo=${encodeURIComponent(rdo.nucleo)}`)} target="_blank" rel="noreferrer">JSON</a>
                </div>
              </div>
            )) : <div className="empty">Sem RDOs ainda.</div>}
          </div>
        </div>
      </>
    );
  }

  // ── Tab content dispatch ──
  function renderTabContent() {
    switch (activeTab) {
      case "processar": return renderProcessar();
      case "mapa": return renderMapa();
      case "rede": return renderRede();
      case "hidraulica": return renderHidraulica();
      case "trechos": return renderTrechos();
      case "custos": return renderCustos();
      case "bim": return renderBim();
      case "lean": return renderLean();
      case "perdas": return renderPerdas();
      case "ia": return renderIA();
      case "nucleos": return renderNucleos();
      case "log": return renderLog();
      case "gestao": return renderGestao();
      case "rdo": return renderRdoPanel();
      case "suprimentos": return renderCustos(); // Mock mapping for now
      default: return (
        <div className="p-panel flex flex-col items-center justify-center p-20 text-center">
          <div className="w-16 h-16 bg-[#38bdf8]/10 rounded-full flex items-center justify-center mb-6 border border-[#38bdf8]/30">
            <span className="text-[#38bdf8] text-2xl font-bold">🔒</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Módulo em Desenvolvimento</h2>
          <p className="text-[var(--text-muted)] max-w-md">
            O subsistema Palantir para esta operação está sendo integrado ao núcleo principal através da API Neural.
          </p>
        </div>
      );
    }
  }

  function renderRdoPanel() {
    return (
      <div className="p-panel border-t-2 border-t-[#38bdf8]">
        <div className="panel-header">
          <h2 className="panel-title"><span>RDO Diario</span> <span className="badge">OPERACAO CAMPO</span></h2>
        </div>
        
        <div className="two-col mt-4">
          <div>
            <form onSubmit={handleCreateRdo} className="bg-[#05080f] p-5 rounded-xl border border-[var(--border-light)]">
              <div className="form-row">
                <div className="form-field"><label>Data</label><input type="date" value={rdoForm.data} onChange={e => setRdoForm(c => ({ ...c, data: e.target.value }))} /></div>
                <div className="form-field"><label>Nucleo</label><input type="text" value={rdoForm.nucleo} onChange={e => setRdoForm(c => ({ ...c, nucleo: e.target.value }))} /></div>
                <div className="form-field"><label>Responsavel</label><input type="text" value={rdoForm.responsavel} onChange={e => setRdoForm(c => ({ ...c, responsavel: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-field"><label>Servico</label><input type="text" value={rdoForm.servico} onChange={e => setRdoForm(c => ({ ...c, servico: e.target.value }))} /></div>
                <div className="form-field"><label>Qtd</label><input type="number" step="0.01" value={rdoForm.quantidade} onChange={e => setRdoForm(c => ({ ...c, quantidade: e.target.value }))} /></div>
                <div className="form-field"><label>DN</label><input type="number" value={rdoForm.dnMm} onChange={e => setRdoForm(c => ({ ...c, dnMm: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-field"><label>Clima (Manhã)</label><input type="text" value={rdoForm.climaManha} onChange={e => setRdoForm(c => ({ ...c, climaManha: e.target.value }))} /></div>
                <div className="form-field"><label>Clima (Tarde)</label><input type="text" value={rdoForm.climaTarde} onChange={e => setRdoForm(c => ({ ...c, climaTarde: e.target.value }))} /></div>
              </div>
              <div className="action-row mt-6">
                <button className="btn btn-primary w-full" type="submit">TRANSMITIR RELATORIO (RDO)</button>
              </div>
              {rdoMessage && <div className={rdoMessage.includes("Falha") ? "sys-msg msg-error mt-4" : "sys-msg msg-success mt-4"}>{rdoMessage}</div>}
            </form>
          </div>

          <div>
             <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[#38bdf8] font-bold text-sm tracking-wider uppercase">Registros Ativos</h3>
                <span className="text-xs text-[var(--text-muted)]">{formatInt(rdoList.items.length)} un</span>
             </div>
            {latestRdos.length ? latestRdos.map(rdo => (
              <div className="kpi-card mb-3 !p-4 cursor-pointer hover:border-[#38bdf8]/50 transition-colors" key={rdo.id}>
                <div className="flex justify-between items-center mb-2">
                  <strong className="text-white text-sm">RDO {rdo.numero ?? rdo.id} — {formatDate(rdo.data)} — {cleanText(rdo.nucleo)}</strong>
                  <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold ${rdo.status === 'FECHADO' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#f59e0b]/10 text-[#f59e0b]'}`}>{cleanText(rdo.status)}</span>
                </div>
                <div className="text-xs text-[var(--text-muted)] mb-3">
                  Resp: <span className="text-[#e2e8f0]">{cleanText(rdo.responsavel ?? "-")}</span> | 
                  Custo RDO: <span className="text-rose-400">{formatCurrency(asNumber(rdo.total_custo))}</span>
                </div>
                <div className="flex gap-2">
                  <a className="btn btn-outline !py-1 !px-3 !text-[10px]" href={apiUrl(`/api/rdo/${rdo.id}/pdf`)} target="_blank" rel="noreferrer">Gerar PDF</a>
                  {cleanText(rdo.status) !== "FECHADO" && <button className="btn btn-danger !py-1 !px-3 !text-[10px]" onClick={() => handleCloseRdo(rdo.id)}>FECHAR RDO</button>}
                </div>
              </div>
            )) : <div className="text-center p-8 border border-dashed border-[var(--border-light)] rounded-xl text-[var(--text-muted)] text-sm">Aguardando inserção de RDOs operacionais no núcleo.</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="palantir-app">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="px-6 py-5 mb-4 border-b border-[var(--border-light)] flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#0ea5e9] to-[#0369a1] rounded flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(14,165,233,0.3)]">
            C
          </div>
          <div>
            <h1 className="text-white font-bold tracking-widest text-sm leading-tight">CONSTRU</h1>
            <p className="text-[10px] text-[#38bdf8] font-mono tracking-wider">MAX SYSTEM OS</p>
          </div>
        </div>

        <div className="flex-1">
          {SIDEBAR_SECTIONS.map((section, sIdx) => (
            <div key={sIdx} className="sidebar-section">
              <h3 className="sidebar-title">{section.title}</h3>
              <div className="flex flex-col gap-1">
                {section.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                        if (item.isNative) {
                            window.open(nativeUrl(item.path!), '_blank');
                        } else {
                            setActiveTab(item.id as TabId);
                        }
                    }}
                    className={cn("nav-item", activeTab === item.id && !item.isNative ? "active" : "")}
                  >
                    {/* Fake Icons using spans for minimalist look */}
                    <span className="w-4 h-4 flex items-center justify-center border border-current rounded-sm text-[8px] opacity-70">
                      {item.icon[0].toUpperCase()}
                    </span>
                    {item.label}
                    {item.isNative && <span className="ml-auto text-[8px] bg-[rgba(255,255,255,0.1)] px-1.5 py-0.5 rounded text-white font-mono">EXT</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="px-6 py-4 border-t border-[var(--border-light)] mt-auto">
          <div className="flex items-center gap-3">
             <div className="relative">
                <div className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
             </div>
             <div>
                <div className="text-[10px] text-[var(--text-muted)] font-mono">SERVER LINK</div>
                <div className="text-xs text-white font-semibold">{health?.ok ? 'AWAITING METRICS' : 'OFFLINE'}</div>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="flex items-center justify-between mb-8 pb-4 border-b border-[var(--border-light)]">
           <div>
              <div className="flex items-center gap-3 mb-1">
                 <h2 className="text-2xl font-light text-white tracking-wide">{SIDEBAR_SECTIONS.flatMap(s=>s.items).find(i=>i.id === activeTab)?.label || "Módulo"}</h2>
                 <span className="px-2.5 py-0.5 rounded-full bg-[#38bdf8]/10 text-[#38bdf8] text-[10px] uppercase font-bold border border-[#38bdf8]/20 tracking-wider font-mono">
                    {selectedMotorLabel} CORE
                 </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-widest">{projectName} • {companyName}</p>
           </div>
           
           <div className="flex items-center gap-3">
               <button onClick={() => setRefreshKey(v => v + 1)} className="btn btn-outline !py-1.5">
                   <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center text-[7px]">R</span>
                   SYNC OP
               </button>
           </div>
        </header>

        {error && (
          <div className="sys-msg msg-error mb-6">
            <span className="font-bold border border-current rounded-full w-4 h-4 flex items-center justify-center text-[10px]">!</span>
            {error}
          </div>
        )}

        <div className="w-full max-w-[1400px] pb-20">
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
}
