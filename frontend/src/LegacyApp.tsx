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

// --- Palantir Sidebar Navigation (5 Pilares Consolidados) ---
const SIDEBAR_SECTIONS = [
  {
    title: "COMANDO CENTRAL",
    items: [
      { id: "gestao", label: "Gestao 360", icon: "grid" },
      { id: "processar", label: "Torre de Controle", icon: "radio" },
      { id: "nucleos", label: "Frentes & Nucleos", icon: "folder" },
      { id: "log", label: "Kernel Log", icon: "file-text" },
    ]
  },
  {
    title: "ENGENHARIA & BIM",
    items: [
      { id: "bim", label: "BIM 3D/4D/5D", icon: "box" },
      { id: "mapa", label: "Mapa Interativo", icon: "map" },
      { id: "rede", label: "Rede 3D", icon: "git-branch" },
      { id: "trechos", label: "Trechos & Cadastro", icon: "list" },
      { id: "hidraulica", label: "Hidraulica / NS", icon: "calculator" },
    ]
  },
  {
    title: "PLANEJAMENTO 4D",
    items: [
      { id: "lean", label: "LPS / Lean", icon: "target" },
      { id: "custos", label: "Custos 5D", icon: "dollar" },
      { id: "perdas", label: "Gestao Perdas", icon: "alert" },
    ]
  },
  {
    title: "OPERACOES DE CAMPO",
    items: [
      { id: "rdo", label: "RDO Diario", icon: "clipboard" },
      { id: "ia", label: "IA & Analytics", icon: "cpu" },
    ]
  },
];

type TabId = "processar" | "mapa" | "rede" | "hidraulica" | "trechos" | "custos" | "bim" | "lean" | "perdas" | "ia" | "nucleos" | "log" | "gestao" | "rdo";

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
      <div className="p-panel border-t-2 border-t-[#38bdf8] flex flex-col h-[calc(100vh-200px)]">
        <div className="panel-header mb-4">
           <h2 className="panel-title"><span>Mapa da Rede (Integração Leaflet)</span> <span className="badge">ROUTING</span></h2>
           <a className="btn btn-outline !py-1 !px-3 !text-[10px]" href={nativeUrl("/manage")} target="_blank" rel="noreferrer">ABRIR MAPA COMPLETO</a>
        </div>
        <div className="frame-container flex-1 h-full min-h-[400px]">
          <iframe src={nativeUrl("/manage")} title="Mapa" />
        </div>
      </div>
    );
  }

  function renderRede() {
    return (
      <div className="p-panel border-t-2 border-t-[#8b5cf6] flex flex-col h-[calc(100vh-200px)]">
        <div className="panel-header mb-4">
           <h2 className="panel-title"><span>Rede 3D — Manage Dataset</span> <span className="badge">WEBGL</span></h2>
           <div className="flex gap-2">
             <a className="btn btn-outline !py-1 !px-3 !text-[10px]" href={apiUrl("/api/manage/rede")} target="_blank" rel="noreferrer">DATASET JSON</a>
             <a className="btn btn-primary !py-1 !px-3 !text-[10px]" href={nativeUrl("/manage")} target="_blank" rel="noreferrer">VIEWER 3D</a>
           </div>
        </div>
        <div className="kpi-board mb-4">
          <div className="kpi-card !py-3"><div className="kpi-label">Nos de Ligação</div><div className="kpi-value text-2xl">{formatInt(manageData?.nodes.length ?? 0)}</div></div>
          <div className="kpi-card !py-3"><div className="kpi-label">Arestas Domiciliares</div><div className="kpi-value text-2xl">{formatInt(manageData?.edges.length ?? 0)}</div></div>
          <div className="kpi-card !py-3"><div className="kpi-label">Extensao Total</div><div className="kpi-value text-2xl text-[#38bdf8]">{formatMeters(asNumber(manageData?.ext))}</div></div>
          <div className="kpi-card !py-3"><div className="kpi-label">Custo 5D Estimado</div><div className="kpi-value text-2xl text-emerald-400">{formatCurrency(manageCost)}</div></div>
        </div>
        <div className="frame-container flex-1 h-full min-h-[400px]">
          <iframe src={nativeUrl("/manage")} title="Rede" />
        </div>
      </div>
    );
  }

  function renderHidraulica() {
    return (
      <div className="p-panel border-t-2 border-t-[#38bdf8]">
        <div className="panel-header mb-2">
           <h2 className="panel-title"><span>Hidraulica — Notas de Servico</span> <span className="badge">INSPECTION</span></h2>
        </div>
        <p className="text-[var(--text-muted)] text-xs mb-6 max-w-2xl">Selecione uma NS para cruzar dados do checklist e fotos georreferenciadas na tabela de validação.</p>

        <div className="flex gap-2 p-2 bg-[var(--bg-base)] rounded-lg border border-[var(--border-light)] mb-6 overflow-x-auto hide-scrollbar">
          <button className={cn("px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap", selectedNucleo === "" ? "bg-[#38bdf8]/10 text-[#38bdf8]" : "text-[var(--text-muted)] hover:text-white")} onClick={() => setSelectedNucleo("")}>Todos</button>
          {nucleoNames.slice(0, 10).map(n => (
            <button key={n} className={cn("px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap", selectedNucleo === n ? "bg-[#38bdf8]/10 text-[#38bdf8]" : "text-[var(--text-muted)] hover:text-white")} onClick={() => setSelectedNucleo(n)}>{n}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
          <div className="overflow-y-auto border border-[var(--border-light)] rounded-xl bg-[#05080f]">
            <table className="data-grid w-full">
              <thead className="sticky top-0 z-10 shadow-sm border-b border-[var(--border-light)]">
                <tr>
                  <th>NS ID</th><th>Trecho T.</th><th>Status</th><th>DN</th><th>Extensao</th>
                </tr>
              </thead>
              <tbody>
                {latestNs.length ? latestNs.map((item, i) => {
                  const id = asNumber(item.id);
                  const isSelected = selectedNsId === id;
                  return (
                    <tr key={`${id}-${i}`} className={`cursor-pointer transition-colors ${isSelected ? "bg-[#38bdf8]/20" : "hover:bg-[rgba(255,255,255,0.02)]"}`} onClick={() => setSelectedNsId(id)}>
                      <td className="font-bold text-white">{nsCode(item)}</td>
                      <td className="font-mono">{nsTrecho(item)}</td>
                      <td><span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold tracking-widest ${cleanText(item.status) === 'CONCLUÍDA' ? 'text-emerald-400 bg-emerald-500/10' : 'text-[#f59e0b] bg-[#f59e0b]/10'}`}>{cleanText(item.status ?? "-")}</span></td>
                      <td className="font-mono text-[var(--text-muted)]">{formatInt(asNumber(item.dn_mm))}</td>
                      <td className="font-mono text-[#38bdf8]">{formatMeters(asNumber(item.ext_m))}</td>
                    </tr>
                  );
                }) : <tr><td colSpan={5} className="text-center py-8 text-[var(--text-muted)]">Nenhuma NS disponivel na pipeline.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="bg-[#05080f] rounded-xl border border-[var(--border-light)] p-5 overflow-y-auto shadow-inner">
            {selectedNsDetail ? (
              <div className="flex flex-col gap-5">
                <div className="border-b border-[var(--border-light)] pb-4">
                   <h3 className="text-xl font-bold text-white mb-3">{nsCode(selectedNsDetail)}</h3>
                   <div className="grid grid-cols-2 gap-y-2 text-xs">
                     <div><span className="text-[var(--text-muted)] uppercase tracking-wider block text-[9px] mb-0.5">Nucleo de Origem</span><span className="text-white font-mono">{cleanText(selectedNsDetail.nucleo)}</span></div>
                     <div><span className="text-[var(--text-muted)] uppercase tracking-wider block text-[9px] mb-0.5">Rua Identificada</span><span className="text-white truncate" title={cleanText(selectedNsDetail.rua ?? "-")}>{cleanText(selectedNsDetail.rua ?? "-")}</span></div>
                     <div><span className="text-[var(--text-muted)] uppercase tracking-wider block text-[9px] mb-0.5">Material Inst.</span><span className="text-white">{cleanText(selectedNsDetail.material ?? "-")}</span></div>
                     <div><span className="text-[var(--text-muted)] uppercase tracking-wider block text-[9px] mb-0.5">Progresso Checklist</span><span className="text-emerald-400 font-bold">{formatInt((selectedNsDetail.checklist ?? []).filter(c => Boolean(c.concluido)).length)} / {formatInt(selectedNsDetail.checklist?.length ?? 0)}</span></div>
                   </div>
                </div>

                <div className="bg-[var(--bg-base)] p-3 rounded-lg border border-[var(--border-light)]">
                  <div className="text-[10px] uppercase text-[var(--text-muted)] font-bold tracking-wider mb-2">Controle de Status</div>
                  <div className="flex gap-2">
                    <select className="flex-1 bg-transparent border border-[var(--border-light)] text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[var(--border-accent)]" value={pendingStatus} onChange={e => setPendingStatus(e.target.value)}>
                      {NS_STATUS_OPTIONS.map(o => <option key={o} value={o} className="bg-[var(--bg-panel)]">{o}</option>)}
                    </select>
                    <button className="btn btn-outline border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 !py-1" onClick={handleNsStatusUpdate}>ATUALIZAR STATUS</button>
                  </div>
                </div>

                {(selectedNsDetail.materiais ?? []).length > 0 && (
                  <div>
                    <h4 className="text-[#38bdf8] font-bold text-xs tracking-wider uppercase mb-3">Inventário de Materiais</h4>
                    <ul className="flex flex-col gap-1.5">
                      {(selectedNsDetail.materiais ?? []).slice(0, 12).map((m, i) => (
                        <li key={`${m.descricao}-${i}`} className="flex justify-between items-center bg-[rgba(255,255,255,0.02)] px-3 py-1.5 rounded text-xs">
                          <span className="text-[var(--text-muted)] truncate max-w-[70%]">{cleanText(m.descricao)}</span>
                          <strong className="text-white font-mono">{m.quantidade} {m.unidade}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(selectedNsDetail.checklist ?? []).length > 0 && (
                  <div>
                    <h4 className="text-[#38bdf8] font-bold text-xs tracking-wider uppercase mb-3 text-emerald-400">Auditoria (Checklist)</h4>
                    <ul className="flex flex-col gap-2">
                      {(selectedNsDetail.checklist ?? []).map(c => (
                        <li key={String(c.id)} className="flex items-start gap-3">
                          <span className={`mt-0.5 shrink-0 block w-4 h-4 flex items-center justify-center rounded-full border text-[8px] font-bold ${c.concluido ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' : 'border-[#94a3b8] text-transparent'}`}>✓</span>
                          <span className={`text-xs ${c.concluido ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{cleanText(c.item)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {selectedNsPhotos.length > 0 && (
                  <div>
                    <h4 className="text-[#38bdf8] font-bold text-xs tracking-wider uppercase mb-3 text-[#f59e0b]">Registro Fotográfico As-Built</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedNsPhotos.map((p, i) => (
                        <div key={`${p.caminho}-${i}`} className="relative group cursor-pointer border border-[var(--border-light)] rounded overflow-hidden h-24 bg-[var(--bg-base)] flex items-center justify-center text-xs text-[var(--text-muted)]">
                          {/* We don't have actual images hosted so we show placeholders with the label */}
                          <span className="absolute bottom-0 inset-x-0 bg-black/80 px-2 py-1 text-[9px] text-white truncate">{cleanText(p.legenda || "Foto")}</span>
                          <span className="opacity-30">{formatDateTime(p.data_hora)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                 <div className="w-12 h-12 rounded bg-[rgba(255,255,255,0.02)] border border-[var(--border-light)] mb-4 flex items-center justify-center text-[var(--text-muted)]">⛑</div>
                 <h3 className="text-white font-bold mb-2">Nenhuma Ficha Selecionada</h3>
                 <p className="text-xs text-[var(--text-muted)] max-w-[250px]">Selecione uma linha na tabela para visualizar o checklist de auditoria e lista de suprimentos.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderTrechos() {
    return (
      <div className="p-panel border-t-2 border-t-[#38bdf8]">
        <div className="panel-header">
           <h2 className="panel-title"><span>Trechos e Cadastro Tecnico</span> <span className="badge">BASE GIS</span></h2>
        </div>
        <div className="action-row mb-6">
          <a className="btn btn-outline" href={apiUrl("/api/cadastro/geojson")} target="_blank" rel="noreferrer">GEOJSON BRUTO</a>
          <a className="btn btn-outline" href={nativeUrl("/campo")} target="_blank" rel="noreferrer">APP CAMPO NATIVO</a>
        </div>

        <div className="kpi-board">
          <div className="kpi-card"><div className="kpi-label">Feicoes GIS</div><div className="kpi-value">{formatInt(geoJson?.features.length ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Trechos</div><div className="kpi-value text-[#38bdf8]">{formatInt(geoTrechos)}</div></div>
          <div className="kpi-card"><div className="kpi-label">PVs / PIs</div><div className="kpi-value text-[#10b981]">{formatInt(geoPvs)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Extensao Total</div><div className="kpi-value">{formatMeters(asNumber(manageData?.ext))}</div></div>
        </div>

        <div className="overflow-x-auto w-full border border-[var(--border-light)] rounded-xl mt-6">
          <table className="data-grid">
            <thead>
              <tr><th>NS</th><th>Trecho</th><th>DN (mm)</th><th>Extensao</th><th>Status</th></tr>
            </thead>
            <tbody>
              {nsList.items.slice(0, 30).map((item, i) => (
                <tr key={`t-${asNumber(item.id)}-${i}`}>
                  <td className="font-mono text-[#38bdf8]">{nsCode(item)}</td>
                  <td className="font-mono">{nsTrecho(item)}</td>
                  <td>{formatInt(asNumber(item.dn_mm))}</td>
                  <td>{formatMeters(asNumber(item.ext_m))}</td>
                  <td><span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold ${cleanText(item.status) === 'CONCLUIDO' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#1e293b] text-[#94a3b8]'}`}>{cleanText(item.status ?? "-")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderCustos() {
    return (
      <div className="p-panel border-t-2 border-t-[#10b981]">
        <div className="panel-header">
           <h2 className="panel-title"><span>Custos 5D — Resumo Financeiro</span> <span className="badge">FINANCEIRO</span></h2>
        </div>
        <div className="action-row mb-6">
          <a className="btn btn-outline" href={nativeUrl("/controle")} target="_blank" rel="noreferrer">CONTROLE NATIVO</a>
          <a className="btn btn-outline" href={apiUrl("/api/curva-s")} target="_blank" rel="noreferrer">GERAR CURVA S JSON</a>
        </div>

        <div className="kpi-board">
          <div className="kpi-card"><div className="kpi-label">% Fisico Operacional</div><div className="kpi-value text-[#38bdf8]">{formatPercent(dashboard?.pct_fisico ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">% Financeiro Medido</div><div className="kpi-value text-[#10b981]">{formatPercent(dashboard?.pct_financeiro ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Valor Liberado Estimado</div><div className="kpi-value text-emerald-400">{formatCurrency(dashboard?.valor_liberado ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Custo RDO Total</div><div className="kpi-value text-rose-400">{formatCurrency(dashboard?.custo_rdo_total ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Custo Rede 5D Integral</div><div className="kpi-value">{formatCurrency(manageCost)}</div></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-[#05080f] p-5 rounded-xl border border-[var(--border-light)] shadow-md">
            <h3 className="text-[#38bdf8] font-bold text-sm tracking-wider uppercase mb-4 border-b border-[var(--border-light)] pb-2">Curva S — Previsto (Baseline)</h3>
            <div className="flex justify-between py-2 border-b border-[rgba(255,255,255,0.05)]"><span className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Avanço % Acumulado</span><span className="text-white font-mono">{formatPercent(asNumber(curvePrev?.pct_acum ?? curvePrev?.acum_pct))}</span></div>
            <div className="flex justify-between py-2 border-b border-[rgba(255,255,255,0.05)]"><span className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Extensao Paramétrica</span><span className="text-[#38bdf8] font-mono">{formatMeters(asNumber(curvePrev?.ext_acum))}</span></div>
            <div className="flex justify-between py-2"><span className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Custo Absorvido</span><span className="text-emerald-400 font-mono">{formatCurrency(asNumber(curvePrev?.custo_acum))}</span></div>
          </div>
          <div className="bg-[#05080f] p-5 rounded-xl border border-[var(--border-light)] shadow-md">
            <h3 className="text-[#10b981] font-bold text-sm tracking-wider uppercase mb-4 border-b border-[var(--border-light)] pb-2">Curva S — Realizado (Campo)</h3>
            <div className="flex justify-between py-2 border-b border-[rgba(255,255,255,0.05)]"><span className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Avanço % Acumulado</span><span className="text-white font-mono">{formatPercent(asNumber(curveReal?.pct_acum ?? curveReal?.acum_pct))}</span></div>
            <div className="flex justify-between py-2 border-b border-[rgba(255,255,255,0.05)]"><span className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Extensao Lançada</span><span className="text-[#38bdf8] font-mono">{formatMeters(asNumber(curveReal?.ext_acum))}</span></div>
            <div className="flex justify-between py-2"><span className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Custo Empenhado</span><span className="text-emerald-400 font-mono">{formatCurrency(asNumber(curveReal?.custo_acum))}</span></div>
          </div>
        </div>
      </div>
    );
  }

  function renderBim() {
    const kinds = (latestJob?.artifacts ?? []).reduce<Record<string, number>>((a, art) => {
      const k = cleanText(art.kind).toLowerCase() || "outros";
      a[k] = (a[k] ?? 0) + 1;
      return a;
    }, {});

    return (
      <div className="p-panel border-t-2 border-t-[#ef4444]">
        <div className="panel-header">
           <h2 className="panel-title"><span>BIM 3D/4D/5D Pipeline</span> <span className="badge">GENERADOR COMPLETO</span></h2>
        </div>
        <div className="action-row mb-6">
          <button className="btn btn-primary" disabled>GERAR PACK COMPLETO (6 etapas)</button>
          <button className="btn btn-outline border-[#ef4444]/30 text-[#ef4444]" disabled>IFC LOD500</button>
          <button className="btn btn-outline text-[#38bdf8]" disabled>LandXML</button>
          <button className="btn btn-outline text-[#f59e0b]" disabled>Cadastro NTS292</button>
          <button className="btn btn-outline" disabled>Cadastro DXF</button>
          <button className="btn btn-outline text-[#10b981]" disabled>Cronograma</button>
        </div>

        <div className="flex flex-wrap gap-2 mb-8 bg-[#05080f] p-3 rounded-lg border border-[var(--border-light)] items-center">
          <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider mr-2">Interfaces GUI:</span>
          <a className="text-[10px] bg-[#1e293b] text-[#94a3b8] px-2 py-1 rounded tracking-wider uppercase hover:bg-[#334155] hover:text-white transition-colors" href={nativeUrl("/manage")} target="_blank" rel="noreferrer">Viewer 3D</a>
          <a className="text-[10px] bg-[#1e293b] text-[#94a3b8] px-2 py-1 rounded tracking-wider uppercase hover:bg-[#334155] hover:text-white transition-colors" href={nativeUrl("/editor")} target="_blank" rel="noreferrer">Editor EPANET</a>
          <a className="text-[10px] bg-[#1e293b] text-[#94a3b8] px-2 py-1 rounded tracking-wider uppercase hover:bg-[#334155] hover:text-white transition-colors" href={nativeUrl("/controle")} target="_blank" rel="noreferrer">Controle As-Built</a>
        </div>

        <h3 className="text-[#38bdf8] font-bold text-sm tracking-wider uppercase mb-4">Mapeamento de Saidas (12 Pastas Output)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <div className="bg-[var(--bg-base)] p-3 rounded border border-[var(--border-light)]"><code className="text-[#f59e0b] block mb-1 font-bold text-xs">01_NS_CAMPO/</code><span className="text-[10px] text-[var(--text-muted)]">Notas de Serviço: PDF A4 + DESENHO + SAT + MAPA + JSON</span></div>
          <div className="bg-[var(--bg-base)] p-3 rounded border border-[var(--border-light)]"><code className="text-[#f59e0b] block mb-1 font-bold text-xs">02_DESENHOS/</code><span className="text-[10px] text-[var(--text-muted)]">PDFs A3 técnicos por NS (perfil + planta)</span></div>
          <div className="bg-[var(--bg-base)] p-3 rounded border border-[var(--border-light)]"><code className="text-[#f59e0b] block mb-1 font-bold text-xs">03_HTML/</code><span className="text-[10px] text-[var(--text-muted)]">Mapas Leaflet interativos por trecho</span></div>
          <div className="bg-[var(--bg-base)] p-3 rounded border border-[var(--border-light)]"><code className="text-[#f59e0b] block mb-1 font-bold text-xs">04_GIS/</code><span className="text-[10px] text-[var(--text-muted)]">GeoJSON georref SIRGAS 2000 UTM 23S</span></div>
          <div className="bg-[var(--bg-base)] p-3 rounded border border-[var(--border-light)]"><code className="text-[#f59e0b] block mb-1 font-bold text-xs">05_PLANILHAS/</code><span className="text-[10px] text-[var(--text-muted)]">Mestre PV a PV + Hidráulica + Curva S</span></div>
          <div className="bg-[var(--bg-base)] p-3 rounded border border-[var(--border-light)]"><code className="text-[#f59e0b] block mb-1 font-bold text-xs">06_CUSTOS/</code><span className="text-[10px] text-[var(--text-muted)]">XLSX custos com BDI + quantitativos</span></div>
          <div className="bg-[var(--bg-base)] p-3 rounded border border-[var(--border-light)]"><code className="text-[#f59e0b] block mb-1 font-bold text-xs">07_BIM_IFC/</code><span className="text-[10px] text-[var(--text-muted)]">IFC LOD 500 + CSV + JSON</span></div>
          <div className="bg-[var(--bg-base)] p-3 rounded border border-[var(--border-light)]"><code className="text-[#f59e0b] block mb-1 font-bold text-xs">08_LEAN_LPS/</code><span className="text-[10px] text-[var(--text-muted)]">Last Planner System + Lean completo</span></div>
          <div className="bg-[var(--bg-base)] p-3 rounded border border-[var(--border-light)]"><code className="text-[#f59e0b] block mb-1 font-bold text-xs">09_MICROPLAN/</code><span className="text-[10px] text-[var(--text-muted)]">Microplanejamento por equipes em HTML</span></div>
          <div className="bg-[var(--bg-base)] p-3 rounded border border-[var(--border-light)]"><code className="text-[#f59e0b] block mb-1 font-bold text-xs">10_CRONOGRAMA/</code><span className="text-[10px] text-[var(--text-muted)]">Gantt NS + MS Project XML + CSV</span></div>
          <div className="bg-[var(--bg-base)] p-3 rounded border border-[var(--border-light)]"><code className="text-[#f59e0b] block mb-1 font-bold text-xs">11_POR_RUA/</code><span className="text-[10px] text-[var(--text-muted)]">Trechos agrupados por logradouro real</span></div>
          <div className="bg-[var(--bg-base)] p-3 rounded border border-[var(--border-light)]"><code className="text-[#f59e0b] block mb-1 font-bold text-xs">12_LOG/</code><span className="text-[10px] text-[var(--text-muted)]">JSON de processamento e rastreabilidade</span></div>
        </div>

        <div className="kpi-board">
          <div className="kpi-card"><div className="kpi-label">Artefatos HTML</div><div className="kpi-value">{formatInt(kinds.html ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Plotagens PDF</div><div className="kpi-value text-rose-400">{formatInt(kinds.pdf ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Datastores JSON</div><div className="kpi-value text-[#f59e0b]">{formatInt(kinds.json ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Modelos IFC</div><div className="kpi-value text-[#38bdf8]">{formatInt(kinds.ifc ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Datasets CSV</div><div className="kpi-value text-emerald-400">{formatInt(kinds.csv ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Cronogramas XML</div><div className="kpi-value">{formatInt(kinds.xml ?? 0)}</div></div>
        </div>
      </div>
    );
  }

  function renderLean() {
    return (
      <div className="p-panel border-t-2 border-t-[#8b5cf6]">
        <div className="panel-header">
          <h2 className="panel-title"><span>Lean Construction & LPS</span> <span className="badge">INSIGHTS OFF</span></h2>
        </div>
        <div className="action-row mb-6">
          <button className="btn btn-outline" disabled>RELATORIO LEAN+LPS</button>
          <button className="btn btn-outline" disabled>TAKT TIME</button>
          <button className="btn btn-outline" disabled>LOOKAHEAD 6 SEM</button>
          <button className="btn btn-outline" disabled>BIM 6D (Ciclo Vida)</button>
        </div>

        <div className="kpi-board">
          <div className="kpi-card"><div className="kpi-label">Takt (m/dia)</div><div className="kpi-value text-[#8b5cf6]">{formatMeters(leanInsight?.takt_metros_dia ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Cycle Time</div><div className="kpi-value">{formatInt(leanInsight?.cycle_time_dias ?? 0)} d</div></div>
          <div className="kpi-card warn"><div className="kpi-label">PPC (%)</div><div className="kpi-value text-[#f59e0b]">{leanInsight?.restricoes_lookahead != null ? formatInt(leanInsight.restricoes_lookahead) : "-"}</div></div>
          <div className="kpi-card"><div className="kpi-label">VA/NVA</div><div className="kpi-value">{leanInsight?.valor_agregado_pct != null ? formatPercent(leanInsight.valor_agregado_pct) : "-"}</div></div>
          <div className="kpi-card"><div className="kpi-label">CO2 (ton)</div><div className="kpi-value">{leanInsight?.co2_total_ton != null ? leanInsight.co2_total_ton.toFixed(1) : "-"}</div></div>
          <div className="kpi-card"><div className="kpi-label">Custo 50 anos</div><div className="kpi-value text-rose-400">{formatCurrency(leanInsight?.custo_ciclo_vida_total ?? 0)}</div></div>
        </div>

        {leanInsight?.alerta_lookahead && (
          <div className="sys-msg msg-error mt-4">
            <strong>Alerta Lookahead:</strong> {cleanText(leanInsight.alerta_lookahead)}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-[var(--bg-base)] p-4 rounded-lg border border-[var(--border-light)]"><div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Throughput</div><div className="text-lg text-white">{formatInt(leanInsight?.throughput_ns_semana ?? 0)} NS/sem</div></div>
          <div className="bg-[var(--bg-base)] p-4 rounded-lg border border-[var(--border-light)]"><div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Planejadas/sem</div><div className="text-lg text-white">{formatInt(leanInsight?.ns_planejadas_semana ?? 0)}</div></div>
          <div className="bg-[var(--bg-base)] p-4 rounded-lg border border-[var(--border-light)]"><div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Bloqueadas/sem</div><div className="text-lg text-rose-400">{formatInt(leanInsight?.ns_bloqueadas_semana ?? 0)}</div></div>
          <div className="bg-[var(--bg-base)] p-4 rounded-lg border border-[var(--border-light)]"><div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Ext. planejada/sem</div><div className="text-lg text-emerald-400">{formatMeters(leanInsight?.ext_planejada_semana ?? 0)}</div></div>
        </div>
      </div>
    );
  }

  function renderPerdas() {
    return (
      <div className="p-panel border-t-2 border-t-[#0ea5e9]">
        <div className="panel-header">
           <h2 className="panel-title"><span>Gestao de Perdas Reais & Aparentes</span> <span className="badge">IWA / UARL / ILI</span></h2>
        </div>
        <div className="action-row mb-6">
          <button className="btn btn-outline" disabled>RELATORIO PERDAS</button>
          <button className="btn btn-outline border-rose-500/30 text-rose-400" disabled>MAPA DE RISCO VAZAMENTOS</button>
          <button className="btn btn-outline border-[#38bdf8]/30 text-[#38bdf8]" disabled>SETORIZAR DMAs</button>
          <button className="btn btn-outline" disabled>PDF PARA A CONCESSIONARIA</button>
          <button className="btn btn-primary ml-auto" disabled>ANALISE DE CUSTO/BENEFICIO TROCA DE REDE</button>
        </div>

        <div className="kpi-board">
          <div className="kpi-card"><div className="kpi-label">UARL (m3/ano)</div><div className="kpi-value">{formatInt(lossInsight?.uarl_m3_ano ?? 0)}</div></div>
          <div className="kpi-card warn"><div className="kpi-label">ILI</div><div className="kpi-value text-[#f59e0b]">{lossInsight?.ili != null ? lossInsight.ili.toFixed(2) : "-"}</div></div>
          <div className="kpi-card"><div className="kpi-label">Classif. Bandeira</div><div className="kpi-value text-xs pt-2 font-mono uppercase tracking-widest">{cleanText(lossInsight?.ili_classificacao ?? "-")}</div></div>
          <div className="kpi-card danger"><div className="kpi-label">Zonas de Risco Alto</div><div className="kpi-value text-[#ef4444]">{formatInt(lossInsight?.risco_total_ano ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">DMAs Sugeridos</div><div className="kpi-value">{formatInt(lossInsight?.n_dmas ?? 0)}</div></div>
          <div className="kpi-card danger"><div className="kpi-label">Perda R$/ano</div><div className="kpi-value text-rose-400">{formatCurrency(lossInsight?.custo_ineficiencia_ano ?? 0)}</div></div>
        </div>

        <div className="action-row mt-6">
          <a className="btn btn-outline w-full" href={nativeUrl("/perdas")} target="_blank" rel="noreferrer">ABRIR MOTOR NATIVO (REDE VRP/VMPs)</a>
        </div>
      </div>
    );
  }

  function renderIA() {
    return (
      <div className="p-panel border-t-2 border-t-[#38bdf8]">
        <div className="panel-header">
           <h2 className="panel-title"><span>Assistente IA Omen & Analytics ML</span> <span className="badge">MULTIMODEL</span></h2>
        </div>
        <div className="action-row mb-6">
          <button className="btn btn-outline" disabled>GERAR RELATORIO DE PREVISAO EM MASSA</button>
          <button className="btn btn-outline" disabled>LIMPAR CACHE DE TREINAMENTO</button>
          <button className="btn btn-outline" disabled>GERAR BENCHMARK CUSTO</button>
          <button className="btn btn-primary" disabled>AVALIAR RISCOS DA OBRA OMEN-7</button>
        </div>

        <div className="kpi-board">
          <div className="kpi-card"><div className="kpi-label">Algoritmo Ativo</div><div className="kpi-value text-xs font-mono uppercase tracking-widest pt-2 text-[#38bdf8]">{cleanText(analyticsSummary?.algoritmo ?? "Indisponivel")}</div></div>
          <div className="kpi-card"><div className="kpi-label">R2 Score</div><div className="kpi-value text-[#10b981]">{(analyticsSummary?.r2_test ?? 0).toFixed(3)}</div></div>
          <div className="kpi-card"><div className="kpi-label">MAE</div><div className="kpi-value">{(analyticsSummary?.mae ?? 0).toFixed(2)}</div></div>
          <div className="kpi-card"><div className="kpi-label">RMSE</div><div className="kpi-value">{(analyticsSummary?.rmse ?? 0).toFixed(2)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Modelos Ensembles</div><div className="kpi-value">{formatInt(analyticsSummary?.n_modelos ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Cenarios Cruzados</div><div className="kpi-value">{formatInt(analyticsSummary?.n_cenarios ?? 0)}</div></div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-[#05080f] p-4 rounded-lg flex flex-col justify-center text-center border border-[var(--border-light)]"><div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Status API</div><div className={`text-sm font-bold ${analyticsSummary?.status ? 'text-emerald-400' : 'text-rose-400'}`}>{cleanText(analyticsSummary?.status ?? "OFFLINE")}</div></div>
          <div className="bg-[#05080f] p-4 rounded-lg flex flex-col justify-center text-center border border-[var(--border-light)]"><div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Ultimo Treino</div><div className="text-sm text-white font-mono">{cleanText(analyticsSummary?.gerado_em ?? "-")}</div></div>
          <div className="bg-[#05080f] p-4 rounded-lg flex flex-col justify-center text-center border border-[var(--border-light)]"><div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Dataset N de Nucleos</div><div className="text-sm text-white">{formatInt(analyticsSummary?.n_nucleos ?? 0)}</div></div>
          <div className="bg-[#05080f] p-4 rounded-lg flex flex-col justify-center text-center border border-[var(--border-light)]"><div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Database de Origem</div><div className="text-sm text-[#38bdf8] truncate px-2">{cleanText(analyticsSummary?.origem ?? "-")}</div></div>
        </div>
      </div>
    );
  }

  function renderNucleos() {
    return (
      <div className="p-panel border-t-2 border-t-[#10b981]">
        <div className="panel-header">
           <h2 className="panel-title"><span>Frentes de Lote (Macro)</span> <span className="badge">NUCLEOS ATIVOS</span></h2>
        </div>

        <div className="overflow-x-auto w-full border border-[var(--border-light)] rounded-xl mt-4 max-h-[400px]">
          <table className="data-grid w-full text-left">
            <thead className="sticky top-0 bg-[var(--bg-sidebar)] z-10 shadow-sm border-b border-[var(--border-light)]"><tr><th>Frente/Nucleo</th><th>Extensao</th><th>Trechos</th><th>Equipes</th><th>Duracao</th><th>Fase (LPS)</th></tr></thead>
            <tbody>
              {nuclei.length ? nuclei.map(n => {
                const phase = currentPhase(n);
                return (
                  <tr key={n.nome} onClick={() => setSelectedNucleo(n.nome)} className={`cursor-pointer transition-colors ${selectedNucleo === n.nome ? "bg-[#38bdf8]/10" : "hover:bg-[rgba(255,255,255,0.02)]"}`}>
                    <td className="font-bold text-white max-w-[200px] truncate">{cleanText(n.nome)}</td>
                    <td className="text-[#38bdf8] font-mono">{formatMeters(n.extensao_m)}</td>
                    <td className="font-mono">{formatInt(n.n_trechos)}</td>
                    <td className="font-mono">{formatInt(n.equipes)}</td>
                    <td className="font-mono">{formatInt(n.duracao_dias)} dias</td>
                    <td><span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold tracking-widest ${phase?.id === 'concluido' ? 'text-emerald-400 bg-emerald-500/10' : 'text-[#94a3b8] bg-[#1e293b]'}`}>{cleanText(phase?.nome ?? "-")}</span></td>
                  </tr>
                );
              }) : <tr><td colSpan={6} className="text-center py-8 text-[var(--text-muted)] border-dashed">Nenhum agrupamento de núcleos detectado no storage local.</td></tr>}
            </tbody>
          </table>
        </div>

        {nucleoCatalog.items.length > 0 && (
          <div className="mt-8">
            <h3 className="text-[#38bdf8] font-bold text-sm tracking-wider uppercase mb-4 flex justify-between">
              <span>Catalog Registry</span>
              <span className="text-[var(--text-muted)]">{formatInt(nucleoCatalog.total)} entries</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
               {nucleoCatalog.items.map(n => (
                  <div key={n.nome} className="bg-[#05080f] px-3 py-2 rounded border border-[var(--border-light)] text-[11px] font-mono truncate text-white border-l-2 border-l-[#10b981]" title={n.nome}>
                     {cleanText(n.nome)}
                  </div>
               ))}
            </div>
          </div>
        )}

        <div className="action-row mt-8 pt-6 border-t border-[var(--border-light)]">
          <button className="btn btn-outline" disabled>PROCESSAMENTO EM BATCH (DXF)</button>
          <button className="btn btn-outline" disabled>INFERIR PROLONGAMENTOS FALTANTES</button>
          <button className="btn btn-primary" disabled>RODAR TUDO SEQUENCIAL</button>
        </div>
      </div>
    );
  }

  function renderLog() {
    const logs = processLogs.items;
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    return (
      <div className="flex flex-col h-[calc(100vh-200px)]">
        <div className="panel-header mb-4">
           <h2 className="panel-title"><span>Kernel Execution Log</span> <span className="badge">LIVE TRACKING</span></h2>
           <div className="flex gap-2">
             <button className="btn btn-outline !py-1 !px-3 !text-[10px]" onClick={() => setRefreshKey(v => v + 1)}>REFRESH</button>
             <button className="btn btn-outline !py-1 !px-3 !text-[10px]" onClick={() => {
                const text = logs.map(j => `${j.created_at} | ${j.motor} | ${j.arquivo} | NS: ${j.ns_geradas} ok / ${j.ns_erros} erro`).join("\n");
                navigator.clipboard.writeText(text);
              }}>COPY BLOCK</button>
           </div>
        </div>

        <div className="flex-1 bg-[#020617] rounded-xl border border-[var(--border-light)] p-5 overflow-y-auto font-mono text-[11px] leading-relaxed shadow-inner">
          <div className="text-[#38bdf8] mb-1"><span className="opacity-50">[{ts}]</span> SYSTEM BOOT | ConstruData MaxSystem v9.0.0 | Engine: {selectedMotorLabel}</div>
          <div className="text-white mb-1"><span className="opacity-50">[{ts}]</span> INFO    | Context: {companyName} - {projectName}</div>
          <div className="text-emerald-400 mb-1"><span className="opacity-50">[{ts}]</span> STATUS  | Neural Backend: {health?.ok ? "ONLINE CONNECTED" : "OFFLINE DISCONNECTED"}</div>
          <div className="text-[#94a3b8] mb-4 text-[10px] break-words"><span className="opacity-50 text-[11px]">[{ts}]</span> MODULES | Motores: GDAL, LandXML, DWG/AEC, DWG Semantico, DWG Universal, GerarNS, Civil3D, NTS292, IFC, MSProject, Pipeline, Custo, Medicao, ML, Lean/LPS, Parametrico, MicroPlan, Perdas, CronoMacro, PdfPerdas, Gemini, Multi-LLM, Contratos, Analytics, SLNR_Mestre, Motor_v5</div>
          {error && <div className="text-rose-500 mb-4 bg-rose-500/10 p-2 rounded border border-rose-500/20"><span className="opacity-70">[{ts}]</span> FATAL   | {error}</div>}
          
          <div className="border-b border-dashed border-[rgba(255,255,255,0.1)] my-4"></div>
          
          <div className="text-[var(--text-muted)] mb-2 font-bold tracking-widest uppercase text-[10px]">Job History Trace</div>
          {logs.length ? logs.slice(0, 50).map((job, i) => {
            const isError = job.ns_erros && job.ns_erros > 0;
            return (
              <div className={`mb-1.5 flex gap-3 hover:bg-[rgba(255,255,255,0.02)] px-1 rounded transition-colors ${isError ? 'text-rose-400' : 'text-[#94a3b8]'}`} key={`log-${job.job_id ?? i}`}>
                <span className="opacity-50 shrink-0 w-32">[{formatDateTime(job.created_at)}]</span>
                <span className="shrink-0 w-24 text-white font-bold">{cleanText(job.motor ?? "-").toUpperCase()}</span>
                <span className="truncate flex-1 max-w-[300px]" title={cleanText(job.arquivo ?? job.nucleo ?? "-")}>{cleanText(job.arquivo ?? job.nucleo ?? "-")}</span>
                <span className="shrink-0 w-40 text-right">Extracted: <span className="text-emerald-400">{formatInt(job.ns_geradas ?? 0)}</span> / Err: <span className="text-rose-400">{formatInt(job.ns_erros ?? 0)}</span></span>
                <span className="shrink-0 w-24 text-right uppercase tracking-wider text-[9px] mt-0.5">{cleanText(job.status ?? "-")}</span>
              </div>
            );
          }) : <div className="text-[var(--text-muted)] italic">No jobs executed in this session. Awaiting terminal dispatch.</div>}
        </div>
      </div>
    );
  }

  function renderGestao() {
    return (
      <div className="p-panel border-t-2 border-t-[#0ea5e9]">
        <div className="panel-header">
           <h2 className="panel-title"><span>Gestao & Cronograma 360</span> <span className="badge">DASHBOARD MAIN</span></h2>
        </div>

        <div className="flex gap-2 p-2 bg-[var(--bg-base)] rounded-lg border border-[var(--border-light)] mb-6 overflow-x-auto hide-scrollbar">
          <button className={cn("px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap", selectedNucleo === "" ? "bg-[#38bdf8]/10 text-[#38bdf8]" : "text-[var(--text-muted)] hover:text-white")} onClick={() => setSelectedNucleo("")}>Todos</button>
          {nucleoNames.slice(0, 10).map(n => (
            <button key={n} className={cn("px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap", selectedNucleo === n ? "bg-[#38bdf8]/10 text-[#38bdf8]" : "text-[var(--text-muted)] hover:text-white")} onClick={() => setSelectedNucleo(n)}>{n}</button>
          ))}
        </div>

        <div className="action-row mb-6">
          <a className="btn btn-outline" href={nativeUrl("/controle")} target="_blank" rel="noreferrer">MEDIR MACRO</a>
          <a className="btn btn-outline" href={nativeUrl("/rdo")} target="_blank" rel="noreferrer">MEDIR RDO NATIVO</a>
          <a className="btn btn-outline" href={apiUrl("/api/cronograma")} target="_blank" rel="noreferrer">GERAR MACRO</a>
          <a className="btn btn-outline" href={apiUrl("/api/curva-s")} target="_blank" rel="noreferrer">CURVA S JSON</a>
          <button className="btn btn-primary ml-auto" onClick={() => setRefreshKey(v => v + 1)}>ATUALIZAR DADOS</button>
        </div>

        <div className="kpi-board">
          <div className="kpi-card"><div className="kpi-label">NS Totais</div><div className="kpi-value">{formatInt(dashboard?.n_total ?? 0)}</div></div>
          <div className="kpi-card warn"><div className="kpi-label">Em Execucao</div><div className="kpi-value text-[#f59e0b]">{formatInt(dashboard?.n_execucao ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">% Fisico</div><div className="kpi-value text-[#38bdf8]">{formatPercent(dashboard?.pct_fisico ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">% Financeiro</div><div className="kpi-value text-[#10b981]">{formatPercent(dashboard?.pct_financeiro ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">M/Dia (Produtlv)</div><div className="kpi-value">{formatMeters(dashboard?.m_por_dia ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">RDOs</div><div className="kpi-value text-[#8b5cf6]">{formatInt(dashboard?.rdos ?? 0)}</div></div>
          <div className="kpi-card"><div className="kpi-label">Curva Prevista</div><div className="kpi-value">{formatPercent(asNumber(curvePrev?.pct_acum ?? curvePrev?.acum_pct))}</div></div>
          <div className="kpi-card"><div className="kpi-label">Curva Realizada</div><div className="kpi-value">{formatPercent(asNumber(curveReal?.pct_acum ?? curveReal?.acum_pct))}</div></div>
        </div>

        {cronograma && (
          <div className="sys-msg msg-info mt-6 bg-[#38bdf8]/5">
             <div className="flex gap-4 items-center flex-wrap w-full text-[11px] font-mono">
               <div><span className="opacity-50 mr-1 text-white">Proj:</span> <strong className="text-[#38bdf8]">{cleanText(cronograma.projeto)}</strong></div>
               <div><span className="opacity-50 mr-1 text-white">Emp:</span> <strong className="text-[#38bdf8]">{cleanText(cronograma.empresa)}</strong></div>
               <div><span className="opacity-50 mr-1 text-white">Periodo:</span> <strong className="text-[#38bdf8]">{formatDate(cronograma.data_inicio)} — {formatDate(cronograma.data_fim)}</strong></div>
               <div className="ml-auto"><span className="opacity-50 mr-1 text-white">TOTAL:</span> <strong className="text-emerald-400">{formatInt(cronograma.duracao_total_dias)} DIAS</strong></div>
             </div>
          </div>
        )}

        <div className="grid grid-cols-1 mt-6">
          <h3 className="text-[#38bdf8] font-bold text-sm tracking-wider uppercase mb-4">Núcleos de Operação (Gantt Macro)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleNuclei.length ? visibleNuclei.map(n => {
              const phase = currentPhase(n);
              return (
                <div className="bg-[#05080f] p-4 rounded-xl border border-[var(--border-light)] hover:border-[#38bdf8]/40 transition-all shadow-md group" key={n.nome}>
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-sm text-white group-hover:text-[#38bdf8] transition-colors line-clamp-2 max-w-[80%]">{cleanText(n.nome)}</h4>
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-[#bae6fd] uppercase border border-[rgba(255,255,255,0.1)]">{cleanText(phase?.nome ?? "-")}</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] flex flex-col gap-1.5 mt-2 font-mono">
                      <span>{formatDate(n.inicio)} - {formatDate(n.fim)}</span>
                      <div className="flex justify-between items-center mt-2 border-t border-[var(--border-light)] pt-2">
                        <span className="text-emerald-400">{formatMeters(n.extensao_m)}</span>
                        <span>{formatInt(n.n_trechos)} TRCH</span>
                        <span>{formatInt(n.equipes)} EQP</span>
                      </div>
                  </div>
                </div>
              );
            }) : <div className="col-span-full p-8 text-center text-[var(--text-muted)] border border-dashed border-[var(--border-light)] rounded-xl">O sistema não carregou frentes de serviço (núcleos).</div>}
          </div>
        </div>
      </div>
    );
  }

  // ── Tab content dispatch ──
  function renderTabContent() {
    switch (activeTab) {
      case "processar": return renderProcessar();
      case "gestao":    return renderGestao();
      case "nucleos":   return renderNucleos();
      case "log":       return renderLog();
      case "bim":       return renderBim();
      case "mapa":      return renderMapa();
      case "rede":      return renderRede();
      case "trechos":   return renderTrechos();
      case "hidraulica": return renderHidraulica();
      case "lean":      return renderLean();
      case "custos":    return renderCustos();
      case "perdas":    return renderPerdas();
      case "rdo":       return renderRdoPanel();
      case "ia":        return renderIA();
      default:          return renderProcessar();
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
                    onClick={() => setActiveTab(item.id as TabId)}
                    className={cn("nav-item", activeTab === item.id ? "active" : "")}
                  >
                    <span className="w-4 h-4 flex items-center justify-center border border-current rounded-sm text-[8px] opacity-70">
                      {item.icon[0].toUpperCase()}
                    </span>
                    {item.label}
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
