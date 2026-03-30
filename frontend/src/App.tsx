import { FormEvent, useEffect, useMemo, useState } from "react";

type Health = {
  ok: boolean;
  app: string;
  display_name: string;
};

type DashboardData = {
  nucleo: string;
  n_total: number;
  n_planejadas: number;
  n_execucao: number;
  n_concluidas: number;
  n_medidas: number;
  pct_fisico: number;
  pct_financeiro: number;
  extensao_total_m: number;
  extensao_exec_m: number;
  valor_liberado: number;
  rdos: number;
  custo_rdo_total: number;
  m_por_dia: number;
  dias_medidos: number;
};

type NsItem = Record<string, unknown>;

type NsList = {
  items: NsItem[];
};

type NsDetail = NsItem & {
  materiais?: Array<{ descricao: string; unidade: string; quantidade: number }>;
  materiais_resumo?: string;
  pvs?: Array<Record<string, unknown>>;
  trechos?: Array<Record<string, unknown>>;
  checklist?: Array<Record<string, unknown>>;
};

type FotoItem = {
  id?: number;
  ns_id?: number;
  caminho?: string;
  legenda?: string;
  data_hora?: string;
};

type FotoList = {
  items: FotoItem[];
};

type ProcessArtifact = {
  label: string;
  path: string;
  kind: string;
};

type ProcessJob = {
  job_id: string | null;
  status: string;
  nucleo?: string;
  fonte?: string;
  modo_rapido?: boolean;
  arquivo?: string;
  n_pvs?: number;
  n_trechos?: number;
  ns_geradas?: number;
  ns_erros?: number;
  artifacts: ProcessArtifact[];
  created_at?: string;
  detail?: string;
  meta?: Record<string, unknown>;
};

type RdoItem = {
  id: number;
  data: string;
  numero?: number;
  nucleo: string;
  responsavel?: string;
  contrato?: string;
  clima_manha?: string;
  clima_tarde?: string;
  observacoes?: string;
  status: string;
  total_custo: number;
  pdf_path?: string | null;
  apontamentos?: Array<Record<string, unknown>>;
  equipe?: Array<Record<string, unknown>>;
  ocorrencias?: Array<Record<string, unknown>>;
  fotos?: Array<Record<string, unknown>>;
};

type RdoList = {
  items: RdoItem[];
};

type CurvaPoint = {
  mes?: number;
  mes_label?: string;
  pct_acum?: number;
  acum_pct?: number;
  ext_acum?: number;
  custo_acum?: number;
};

type CurvaS = {
  previsto: CurvaPoint[];
  realizado: CurvaPoint[];
  n_total: number;
  ext_total: number;
  custo_total: number;
};

type GeoJsonFeature = {
  type: string;
  geometry?: { type?: string };
  properties?: Record<string, unknown>;
};

type GeoJson = {
  type: string;
  features: GeoJsonFeature[];
};

type ManageEdge = {
  c?: number;
  ext?: number;
  status?: string;
};

type ManageData = {
  nodes: Array<Record<string, unknown>>;
  edges: ManageEdge[];
  ox: number;
  oy: number;
  ext: number;
  meta?: Record<string, unknown>;
};

type CronogramaFase = {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  duracao_dias: number;
  predecessora: string | null;
  nucleo: string;
};

type CronogramaNucleo = {
  nome: string;
  extensao_m: number;
  n_trechos: number;
  equipes: number;
  inicio: string;
  fim: string;
  duracao_dias: number;
  fases: CronogramaFase[];
};

type CronogramaData = {
  projeto: string;
  empresa: string;
  data_inicio: string;
  data_fim: string;
  duracao_total_dias: number;
  total_tarefas: number;
  nucleos: CronogramaNucleo[];
};

type RdoFormState = {
  data: string;
  nucleo: string;
  responsavel: string;
  climaManha: string;
  climaTarde: string;
  equipeFuncao: string;
  equipeQtd: string;
  ocorrenciaTipo: string;
  ocorrenciaHora: string;
  ocorrenciaDescricao: string;
  nsId: string;
  servico: string;
  quantidade: string;
  unidade: string;
  dnMm: string;
};

const NS_STATUS_OPTIONS = [
  "PLANEJADA",
  "EM_EXECUCAO",
  "CONCLUIDA",
  "MEDIDA",
  "BLOQUEADA",
];

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const NATIVE_BASE = API_BASE || "";

const moduleLinks = [
  { label: "RDO", hint: "Diario, fechamento e PDF", href: "/rdo" },
  { label: "Campo", hint: "Coleta e consulta", href: "/campo" },
  { label: "Manage", hint: "Rede 3D e propriedades", href: "/manage" },
  { label: "Controle", hint: "Medicao e curva", href: "/controle" },
  { label: "Perdas", hint: "Motor de perdas", href: "/perdas" },
  { label: "Editor", hint: "Editor tecnico", href: "/editor" },
  { label: "Arquitetura BIM", hint: "Estrutura 5D", href: "/arquitetura-bim" },
  { label: "Fluxograma BIM", hint: "Fluxo executivo", href: "/fluxograma-bim" },
];

const apiCatalog = [
  { method: "GET", path: "/health", note: "Saude do backend" },
  { method: "POST", path: "/api/processamento/importar", note: "Importa projeto e gera NS" },
  { method: "GET", path: "/api/processamento/ultimo", note: "Ultimo job processado" },
  { method: "GET", path: "/api/processamento/{job_id}", note: "JSON do job selecionado" },
  { method: "GET", path: "/api/processamento/{job_id}/artefato/{rel_path}", note: "Primeiro artefato do job" },
  { method: "GET", path: "/api/ns", note: "Lista de notas de servico" },
  { method: "GET", path: "/api/ns/{id}", note: "Detalhe da NS selecionada" },
  { method: "PATCH", path: "/api/ns/{id}/status", note: "Atualiza status da NS" },
  { method: "GET", path: "/api/rdo", note: "Lista de RDOs" },
  { method: "POST", path: "/api/rdo", note: "Cria RDO com equipe e apontamentos" },
  { method: "PATCH", path: "/api/rdo/{id}/fechar", note: "Fecha RDO" },
  { method: "GET", path: "/api/rdo/{id}/pdf", note: "PDF do RDO" },
  { method: "GET", path: "/api/rdo/{data_ref}", note: "JSON do ultimo RDO por data e nucleo" },
  { method: "GET", path: "/api/dashboard", note: "Pulso executivo" },
  { method: "GET", path: "/api/cronograma", note: "Cronograma consolidado" },
  { method: "GET", path: "/api/curva-s", note: "Curva S" },
  { method: "GET", path: "/api/cadastro/geojson", note: "Cadastro tecnico" },
  { method: "GET", path: "/api/manage/rede", note: "Dataset da rede real" },
  { method: "GET", path: "/api/fotos/{ns_id}", note: "Fotos da NS" },
  { method: "POST", path: "/webhook/whatsapp", note: "Entrada de webhook" },
];

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
  if (nucleo) {
    url.searchParams.set("nucleo", nucleo);
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${path}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function maybeFixEncoding(value: string): string {
  if (!/[ÃƒÆ’Ã†'ÃƒÆ’Ã‚¢ÃƒÆ’ââ‚¬Å¡]/.test(value)) {
    return value;
  }

  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return value;
  }
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") {
    return value == null ? "" : String(value);
  }
  return maybeFixEncoding(value);
}

function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatInt(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function formatMeters(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value)} m`;
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function artifactHref(jobId: string | null, relPath: string): string {
  if (!jobId) {
    return "#";
  }
  const safePath = relPath.split("/").map((chunk) => encodeURIComponent(chunk)).join("/");
  return apiUrl(`/api/processamento/${jobId}/artefato/${safePath}`);
}

function nsCode(item: NsItem): string {
  const raw = item.codigo ?? item.codigo_ns ?? item.ns_codigo ?? item.ns ?? item.numero ?? item.id;
  if (raw === undefined || raw === null || raw === "") {
    return "NS";
  }
  if (typeof raw === "number") {
    return `NS ${String(raw).padStart(3, "0")}`;
  }
  return cleanText(raw);
}

function nsTrecho(item: NsItem): string {
  const pvIni = item.pv_ini ?? item.pv_montante ?? item.origem;
  const pvFim = item.pv_fim ?? item.pv_jusante ?? item.destino;
  if (pvIni || pvFim) {
    return `${cleanText(pvIni ?? "-")} -> ${cleanText(pvFim ?? "-")}`;
  }
  return cleanText(item.trecho ?? "-");
}

function toneClass(value: unknown): string {
  const text = cleanText(value).toLowerCase();
  if (text.includes("concl") || text.includes("live") || text.includes("ok")) {
    return "pill pill-ok";
  }
  if (text.includes("exec") || text.includes("aberto") || text.includes("build")) {
    return "pill pill-warn";
  }
  if (text.includes("erro") || text.includes("fail") || text.includes("bloq")) {
    return "pill pill-bad";
  }
  return "pill pill-neutral";
}

function currentPhase(nucleo: CronogramaNucleo): CronogramaFase | null {
  const now = Date.now();
  for (const fase of nucleo.fases) {
    const start = new Date(`${fase.inicio}T12:00:00`).getTime();
    const end = new Date(`${fase.fim}T12:00:00`).getTime();
    if (now >= start && now <= end) {
      return fase;
    }
  }
  for (const fase of nucleo.fases) {
    const start = new Date(`${fase.inicio}T12:00:00`).getTime();
    if (now < start) {
      return fase;
    }
  }
  return nucleo.fases.at(-1) ?? null;
}

function makeDefaultRdoForm(nucleo = ""): RdoFormState {
  return {
    data: todayIso(),
    nucleo,
    responsavel: "",
    climaManha: "Sol",
    climaTarde: "Sol",
    equipeFuncao: "",
    equipeQtd: "1",
    ocorrenciaTipo: "outro",
    ocorrenciaHora: "",
    ocorrenciaDescricao: "",
    nsId: "",
    servico: "",
    quantidade: "",
    unidade: "m",
    dnMm: "",
  };
}

export default function App() {
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
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nsDetailLoading, setNsDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadNucleo, setUploadNucleo] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [quickMode, setQuickMode] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [rdoForm, setRdoForm] = useState<RdoFormState>(makeDefaultRdoForm());
  const [rdoMessage, setRdoMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeModulePath, setActiveModulePath] = useState("/manage");

  useEffect(() => {
    let active = true;

    async function loadBase() {
      setBooting(true);
      const [healthResult, cronogramaResult, jobResult] = await Promise.allSettled([
        getJson<Health>("/health"),
        getJson<CronogramaData>("/api/cronograma"),
        getJson<ProcessJob>("/api/processamento/ultimo"),
      ]);

      if (!active) {
        return;
      }

      if (healthResult.status === "fulfilled") {
        setHealth(healthResult.value);
      }
      if (cronogramaResult.status === "fulfilled") {
        setCronograma(cronogramaResult.value);
      }
      if (jobResult.status === "fulfilled") {
        setLatestJob(jobResult.value);
      }

      const failures = [healthResult, cronogramaResult].filter((item) => item.status === "rejected");
      if (failures.length > 0) {
        const first = failures[0] as PromiseRejectedResult;
        setError(first.reason instanceof Error ? first.reason.message : "Falha ao carregar a base");
      } else {
        setError("");
      }

      setBooting(false);
    }

    loadBase();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadScope() {
      setRefreshing(true);
      const [dashboardResult, nsResult, rdoResult, curvaResult, geoResult, manageResult] =
        await Promise.allSettled([
          getJson<DashboardData>("/api/dashboard", selectedNucleo),
          getJson<NsList>("/api/ns", selectedNucleo),
          getJson<RdoList>("/api/rdo", selectedNucleo),
          getJson<CurvaS>("/api/curva-s", selectedNucleo),
          getJson<GeoJson>("/api/cadastro/geojson", selectedNucleo),
          getJson<ManageData>("/api/manage/rede", selectedNucleo),
        ]);

      if (!active) {
        return;
      }

      if (dashboardResult.status === "fulfilled") {
        setDashboard(dashboardResult.value);
      }
      if (nsResult.status === "fulfilled") {
        setNsList(nsResult.value);
      }
      if (rdoResult.status === "fulfilled") {
        setRdoList(rdoResult.value);
      }
      if (curvaResult.status === "fulfilled") {
        setCurvaS(curvaResult.value);
      }
      if (geoResult.status === "fulfilled") {
        setGeoJson(geoResult.value);
      }
      if (manageResult.status === "fulfilled") {
        setManageData(manageResult.value);
      }

      const failures = [dashboardResult, nsResult, rdoResult, curvaResult, geoResult, manageResult].filter(
        (item) => item.status === "rejected",
      );
      if (failures.length > 0) {
        const first = failures[0] as PromiseRejectedResult;
        setError(first.reason instanceof Error ? first.reason.message : "Falha ao carregar o escopo");
      } else {
        setError("");
      }

      setRefreshing(false);
    }

    loadScope();
    return () => {
      active = false;
    };
  }, [selectedNucleo, refreshKey]);

  useEffect(() => {
    let active = true;

    async function loadNsDetail() {
      if (!selectedNsId) {
        setSelectedNsDetail(null);
        setSelectedNsPhotos([]);
        return;
      }

      setNsDetailLoading(true);
      const [detailResult, photoResult] = await Promise.allSettled([
        getJson<NsDetail>(`/api/ns/${selectedNsId}`),
        getJson<FotoList>(`/api/fotos/${selectedNsId}`),
      ]);

      if (!active) {
        return;
      }

      if (detailResult.status === "fulfilled") {
        setSelectedNsDetail(detailResult.value);
        setPendingStatus(cleanText(detailResult.value.status || "PLANEJADA"));
      }
      if (photoResult.status === "fulfilled") {
        setSelectedNsPhotos(photoResult.value.items || []);
      }
      setNsDetailLoading(false);
    }

    loadNsDetail();
    return () => {
      active = false;
    };
  }, [selectedNsId, refreshKey]);

  useEffect(() => {
    setRdoForm((current) => ({
      ...current,
      nucleo: current.nucleo || selectedNucleo,
    }));
  }, [selectedNucleo]);

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile) {
      setUploadMessage("Escolha um arquivo antes de processar.");
      return;
    }

    setUploading(true);
    setUploadMessage("");

    const payload = new FormData();
    payload.append("arquivo", uploadFile);
    payload.append("nucleo", uploadNucleo);
    payload.append("modo_rapido", quickMode ? "true" : "false");

    try {
      const response = await fetch(apiUrl("/api/processamento/importar"), {
        method: "POST",
        body: payload,
      });
      const data = (await response.json()) as ProcessJob & { detail?: string };
      if (!response.ok) {
        throw new Error(data.detail || "Falha ao importar projeto");
      }
      setLatestJob(data);
      setUploadMessage(`Projeto processado. ${data.ns_geradas ?? 0} NS geradas.`);
      if (data.nucleo) {
        setSelectedNucleo(data.nucleo);
      }
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : "Falha ao importar projeto");
    } finally {
      setUploading(false);
    }
  }

  async function handleNsStatusUpdate() {
    if (!selectedNsId) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/ns/${selectedNsId}/status`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: pendingStatus, data_referencia: todayIso() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Falha ao atualizar status");
      }
      setSelectedNsDetail((current) => (current ? { ...current, status: pendingStatus } : current));
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar status");
    }
  }

  async function handleCreateRdo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRdoMessage("");

    const payload: Record<string, unknown> = {
      data: rdoForm.data,
      nucleo: rdoForm.nucleo || selectedNucleo || "REDE",
      responsavel: rdoForm.responsavel,
      rt: rdoForm.responsavel,
      clima: {
        manha: rdoForm.climaManha,
        tarde: rdoForm.climaTarde,
      },
    };

    if (rdoForm.equipeFuncao && Number(rdoForm.equipeQtd) > 0) {
      payload.equipe = [{ funcao: rdoForm.equipeFuncao, qtd: Number(rdoForm.equipeQtd) }];
    }
    if (rdoForm.ocorrenciaDescricao) {
      payload.ocorrencias = [
        {
          tipo: rdoForm.ocorrenciaTipo,
          desc: rdoForm.ocorrenciaDescricao,
          hora: rdoForm.ocorrenciaHora,
        },
      ];
    }
    if (rdoForm.nsId && rdoForm.servico && Number(rdoForm.quantidade) > 0) {
      payload.servicos = {
        [rdoForm.nsId]: [
          {
            ns_id: Number(rdoForm.nsId),
            servico: rdoForm.servico,
            qtd: Number(rdoForm.quantidade),
            unidade: rdoForm.unidade || "m",
            dn_mm: Number(rdoForm.dnMm || 0),
          },
        ],
      };
    }

    try {
      const response = await fetch(apiUrl("/api/rdo"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Falha ao criar RDO");
      }
      setRdoMessage(`RDO ${data.numero ?? data.id} salvo com sucesso.`);
      setRdoForm(makeDefaultRdoForm(rdoForm.nucleo || selectedNucleo));
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setRdoMessage(err instanceof Error ? err.message : "Falha ao criar RDO");
    }
  }

  async function handleCloseRdo(rdoId: number) {
    try {
      const response = await fetch(apiUrl(`/api/rdo/${rdoId}/fechar`), {
        method: "PATCH",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Falha ao fechar RDO");
      }
      setRdoMessage(`RDO ${data.numero ?? data.id} fechado.`);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setRdoMessage(err instanceof Error ? err.message : "Falha ao fechar RDO");
    }
  }

  const projectName = cleanText(cronograma?.projeto ?? health?.display_name ?? "ConstruDataMaxV2");
  const companyName = cleanText(cronograma?.empresa ?? "Operacao NS");
  const nuclei = cronograma?.nucleos ?? [];
  const visibleNuclei = useMemo(
    () => (selectedNucleo ? nuclei.filter((item) => item.nome === selectedNucleo) : nuclei),
    [nuclei, selectedNucleo],
  );
  const activeModule = moduleLinks.find((item) => item.href === activeModulePath) ?? moduleLinks[0];
  const latestNs = nsList.items.slice(0, 12);
  const latestRdos = rdoList.items.slice(0, 10);
  const latestRdo = latestRdos[0] ?? null;
  const curvePrev = curvaS?.previsto.at(-1);
  const curveReal = curvaS?.realizado.at(-1);
  const manageCost = (manageData?.edges ?? []).reduce((acc, edge) => acc + asNumber(edge.c), 0);
  const geoTrechos = (geoJson?.features ?? []).filter(
    (feature) => cleanText(feature.properties?.feature_type) === "trecho",
  ).length;
  const geoPvs = (geoJson?.features ?? []).filter(
    (feature) => cleanText(feature.properties?.feature_type) === "pv",
  ).length;

  function catalogHref(path: string, method: string): string {
    if (method !== "GET") {
      return nativeUrl("/");
    }
    if (path === "/api/processamento/{job_id}" && latestJob?.job_id) {
      return apiUrl(`/api/processamento/${latestJob.job_id}`);
    }
    if (path === "/api/processamento/{job_id}/artefato/{rel_path}" && latestJob?.job_id && latestJob.artifacts?.[0]) {
      return artifactHref(latestJob.job_id, latestJob.artifacts[0].path);
    }
    if (path === "/api/ns/{id}" && selectedNsId) {
      return apiUrl(`/api/ns/${selectedNsId}`);
    }
    if (path === "/api/ns/{id}/status" && selectedNsId) {
      return apiUrl(`/api/ns/${selectedNsId}`);
    }
    if (path === "/api/rdo/{id}/pdf" && latestRdo) {
      return apiUrl(`/api/rdo/${latestRdo.id}/pdf`);
    }
    if (path === "/api/rdo/{id}/fechar" && latestRdo) {
      return apiUrl(`/api/rdo/${latestRdo.id}/pdf`);
    }
    if (path === "/api/rdo/{data_ref}" && latestRdo) {
      return apiUrl(`/api/rdo/${latestRdo.data}?nucleo=${encodeURIComponent(latestRdo.nucleo)}`);
    }
    if (path === "/api/fotos/{ns_id}" && selectedNsId) {
      return apiUrl(`/api/fotos/${selectedNsId}`);
    }
    return apiUrl(path);
  }

  return (
    <div className="workspace">
      <div className="workspace-grid" />
      <div className="page">
        <header className="masthead">
          <div>
            <p className="eyebrow">ConstruDataMaxV2</p>
            <h1>Frontend completo do backend NS</h1>
            <p className="subtitle">
              Agora o frontend expoe processamento, NS, RDO, cadastro, rede, cronograma,
              integracoes e todos os modulos nativos do backend.
            </p>
          </div>

          <div className="masthead-side">
            <div className="health-box">
              <span className={health?.ok ? "dot dot-ok" : "dot"} />
              <div>
                <strong>{health?.ok ? "Backend online" : "Sem resposta"}</strong>
                <small>{projectName}</small>
              </div>
            </div>
            <button className="button ghost" onClick={() => setRefreshKey((value) => value + 1)}>
              Atualizar dados
            </button>
          </div>
        </header>

        <main className="layout">
          <section className="hero-grid">
            <article className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Processamento</p>
                  <h2>Importar projeto e gerar notas</h2>
                </div>
                <span className="pill pill-ok">/api/processamento/importar</span>
              </div>

              <form className="form-grid" onSubmit={handleImport}>
                <label className="field">
                  <span>Nucleo</span>
                  <input
                    type="text"
                    placeholder="Ex.: Verde e Teteu"
                    value={uploadNucleo}
                    onChange={(event) => setUploadNucleo(event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Arquivo</span>
                  <input
                    type="file"
                    accept=".json,.xml,.landxml,.dxf"
                    onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  />
                </label>

                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={quickMode}
                    onChange={(event) => setQuickMode(event.target.checked)}
                  />
                  <span>Modo rapido</span>
                </label>

                <div className="mini-grid">
                  <div className="micro-card">
                    <strong>Entradas aceitas</strong>
                    <span>JSON, XML/LandXML, DXF</span>
                  </div>
                  <div className="micro-card">
                    <strong>Saidas</strong>
                    <span>PDF, HTML, JSON, GeoJSON</span>
                  </div>
                  <div className="micro-card">
                    <strong>Motor</strong>
                    <span>NS V5 no backend real</span>
                  </div>
                </div>

                <div className="button-row">
                  <button className="button primary" type="submit" disabled={uploading}>
                    {uploading ? "Processando..." : "Importar e gerar"}
                  </button>
                  <a className="button ghost" href={nativeUrl("/manage")} target="_blank" rel="noreferrer">
                    Abrir manage
                  </a>
                </div>

                {uploadMessage ? <p className="message">{uploadMessage}</p> : null}
              </form>
            </article>

            <article className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Ultimo job</p>
                  <h2>{latestJob?.nucleo ? cleanText(latestJob.nucleo) : "Sem processamento recente"}</h2>
                </div>
                <span className={toneClass(latestJob?.status)}>{cleanText(latestJob?.status ?? "empty")}</span>
              </div>

              <div className="metrics-grid compact">
                <div className="metric-card">
                  <span>Arquivo</span>
                  <strong>{cleanText(latestJob?.arquivo ?? "-") || "-"}</strong>
                </div>
                <div className="metric-card">
                  <span>Fonte</span>
                  <strong>{cleanText(latestJob?.fonte ?? "-") || "-"}</strong>
                </div>
                <div className="metric-card">
                  <span>PVs / trechos</span>
                  <strong>
                    {formatInt(latestJob?.n_pvs ?? 0)} / {formatInt(latestJob?.n_trechos ?? 0)}
                  </strong>
                </div>
                <div className="metric-card">
                  <span>Resultado</span>
                  <strong>
                    {formatInt(latestJob?.ns_geradas ?? 0)} ok / {formatInt(latestJob?.ns_erros ?? 0)} erro
                  </strong>
                </div>
              </div>

              <div className="artifact-head">
                <strong>Artefatos</strong>
                <small>{formatDateTime(latestJob?.created_at)}</small>
              </div>
              <div className="artifact-grid">
                {latestJob?.artifacts?.length ? (
                  latestJob.artifacts.slice(0, 18).map((artifact) => (
                    <a
                      className="artifact-card"
                      key={`${latestJob.job_id}-${artifact.path}`}
                      href={artifactHref(latestJob.job_id, artifact.path)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>{artifact.kind.toUpperCase()}</span>
                      <strong>{artifact.label}</strong>
                    </a>
                  ))
                ) : (
                  <div className="empty-box">
                    <strong>Sem artefatos ainda</strong>
                    <p>Depois do primeiro upload, os arquivos gerados aparecem aqui.</p>
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Pulso do backend</p>
                <h2>Resumo executivo e tecnico</h2>
              </div>
              <div className="scope-row">
                <button
                  className={selectedNucleo === "" ? "scope-pill active" : "scope-pill"}
                  onClick={() => setSelectedNucleo("")}
                >
                  Todos
                </button>
                {nuclei.slice(0, 10).map((nucleo) => (
                  <button
                    key={nucleo.nome}
                    className={selectedNucleo === nucleo.nome ? "scope-pill active" : "scope-pill"}
                    onClick={() => setSelectedNucleo(nucleo.nome)}
                  >
                    {cleanText(nucleo.nome)}
                  </button>
                ))}
              </div>
            </div>

            <div className="metrics-grid">
              <article className="metric-card">
                <span>NS totais</span>
                <strong>{formatInt(dashboard?.n_total ?? 0)}</strong>
                <small>{formatInt(dashboard?.n_execucao ?? 0)} em execucao</small>
              </article>
              <article className="metric-card">
                <span>Avanco fisico</span>
                <strong>{formatPercent(dashboard?.pct_fisico ?? 0)}</strong>
                <small>{formatMeters(dashboard?.extensao_exec_m ?? 0)} executados</small>
              </article>
              <article className="metric-card">
                <span>Avanco financeiro</span>
                <strong>{formatPercent(dashboard?.pct_financeiro ?? 0)}</strong>
                <small>{formatCurrency(dashboard?.valor_liberado ?? 0)}</small>
              </article>
              <article className="metric-card">
                <span>Ritmo diario</span>
                <strong>{formatMeters(dashboard?.m_por_dia ?? 0)}</strong>
                <small>{formatInt(dashboard?.rdos ?? 0)} RDOs</small>
              </article>
              <article className="metric-card">
                <span>Rede 3D</span>
                <strong>{formatInt(manageData?.edges.length ?? 0)} trechos</strong>
                <small>{formatCurrency(manageCost)}</small>
              </article>
              <article className="metric-card">
                <span>Cadastro GIS</span>
                <strong>{formatInt(geoJson?.features.length ?? 0)} feicoes</strong>
                <small>{formatInt(geoTrechos)} trechos / {formatInt(geoPvs)} PVs</small>
              </article>
              <article className="metric-card">
                <span>Curva prevista</span>
                <strong>{formatPercent(asNumber(curvePrev?.pct_acum ?? curvePrev?.acum_pct))}</strong>
                <small>{formatMeters(asNumber(curvePrev?.ext_acum))}</small>
              </article>
              <article className="metric-card">
                <span>Curva realizada</span>
                <strong>{formatPercent(asNumber(curveReal?.pct_acum ?? curveReal?.acum_pct))}</strong>
                <small>{formatMeters(asNumber(curveReal?.ext_acum))}</small>
              </article>
            </div>
          </section>

          <section className="two-column">
            <article className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Modulos nativos</p>
                  <h2>Todas as telas do backend</h2>
                </div>
              </div>
              <div className="module-grid">
                {moduleLinks.map((item) => (
                  <article className={item.href === activeModulePath ? "module-card active" : "module-card"} key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.hint}</strong>
                    <div className="button-row">
                      <button className="button ghost slim" type="button" onClick={() => setActiveModulePath(item.href)}>
                        Abrir aqui
                      </button>
                      <a className="button ghost slim" href={nativeUrl(item.href)} target="_blank" rel="noreferrer">
                        Nova guia
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">API e integracoes</p>
                  <h2>Endpoints do backend</h2>
                </div>
              </div>
              <div className="api-grid">
                {apiCatalog.map((item) => (
                  <a
                    className="api-card"
                    href={catalogHref(item.path, item.method)}
                    key={`${item.method}-${item.path}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>{item.method}</span>
                    <strong>{item.path}</strong>
                    <small>{item.note}</small>
                  </a>
                ))}
              </div>
            </article>
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Workspace</p>
                <h2>Modulo nativo integrado no frontend</h2>
              </div>
              <div className="button-row">
                <span className="pill pill-ok">{activeModule.href}</span>
                <a className="button ghost slim" href={nativeUrl(activeModule.href)} target="_blank" rel="noreferrer">
                  Abrir em nova guia
                </a>
              </div>
            </div>

            <div className="scope-row module-picker">
              {moduleLinks.map((item) => (
                <button
                  key={`picker-${item.href}`}
                  className={activeModulePath === item.href ? "scope-pill active" : "scope-pill"}
                  onClick={() => setActiveModulePath(item.href)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="frame-meta">
              <div className="micro-card">
                <strong>{activeModule.label}</strong>
                <span>{activeModule.hint}</span>
              </div>
              <div className="micro-card">
                <strong>Origem</strong>
                <span>{nativeUrl(activeModule.href)}</span>
              </div>
            </div>

            <div className="module-frame-shell">
              <iframe
                key={activeModulePath}
                className="module-frame"
                src={nativeUrl(activeModule.href)}
                title={`Modulo ${activeModule.label}`}
              />
            </div>
          </section>

          <section className="two-column">
            <article className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Notas de servico</p>
                  <h2>Lista, detalhe e atualizacao de status</h2>
                </div>
                <small>{refreshing ? "Atualizando..." : `${formatInt(nsList.items.length)} registros`}</small>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>NS</th>
                      <th>Trecho</th>
                      <th>Status</th>
                      <th>DN</th>
                      <th>Extensao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestNs.length ? (
                      latestNs.map((item, index) => {
                        const itemId = asNumber(item.id);
                        return (
                          <tr
                            key={`${itemId}-${index}`}
                            className={selectedNsId === itemId ? "row-selected" : ""}
                            onClick={() => setSelectedNsId(itemId)}
                          >
                            <td>{nsCode(item)}</td>
                            <td>{nsTrecho(item)}</td>
                            <td>
                              <span className={toneClass(item.status)}>{cleanText(item.status ?? "-")}</span>
                            </td>
                            <td>{formatInt(asNumber(item.dn_mm))}</td>
                            <td>{formatMeters(asNumber(item.ext_m))}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5}>Nenhuma NS disponivel.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Detalhe da NS</p>
                  <h2>{selectedNsDetail ? nsCode(selectedNsDetail) : "Selecione uma NS"}</h2>
                </div>
                {selectedNsDetail ? (
                  <a className="button ghost slim" href={apiUrl(`/api/ns/${selectedNsId}`)} target="_blank" rel="noreferrer">
                    JSON bruto
                  </a>
                ) : null}
              </div>

              {nsDetailLoading ? (
                <div className="empty-box">
                  <strong>Carregando detalhe...</strong>
                </div>
              ) : selectedNsDetail ? (
                <div className="detail-stack">
                  <div className="mini-grid">
                    <div className="micro-card">
                      <strong>Nucleo</strong>
                      <span>{cleanText(selectedNsDetail.nucleo)}</span>
                    </div>
                    <div className="micro-card">
                      <strong>Rua</strong>
                      <span>{cleanText(selectedNsDetail.rua ?? "-")}</span>
                    </div>
                    <div className="micro-card">
                      <strong>Material</strong>
                      <span>{cleanText(selectedNsDetail.material ?? "-")}</span>
                    </div>
                    <div className="micro-card">
                      <strong>Checklist</strong>
                      <span>
                        {formatInt((selectedNsDetail.checklist ?? []).filter((item) => Boolean(item.concluido)).length)} /{" "}
                        {formatInt(selectedNsDetail.checklist?.length ?? 0)}
                      </span>
                    </div>
                  </div>

                  <div className="status-box">
                    <label className="field">
                      <span>Status da NS</span>
                      <select value={pendingStatus} onChange={(event) => setPendingStatus(event.target.value)}>
                        {NS_STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="button primary" onClick={handleNsStatusUpdate}>
                      Atualizar status
                    </button>
                  </div>

                  <div className="subpanel">
                    <strong>Materiais</strong>
                    <ul className="plain-list">
                      {(selectedNsDetail.materiais ?? []).slice(0, 12).map((item, index) => (
                        <li key={`${item.descricao}-${index}`}>
                          {item.quantidade} {item.unidade} - {cleanText(item.descricao)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="subpanel">
                    <strong>Checklist</strong>
                    <ul className="plain-list">
                      {(selectedNsDetail.checklist ?? []).map((item) => (
                        <li key={String(item.id)}>
                          <span className={item.concluido ? "ok-text" : "muted"}>
                            {item.concluido ? "OK" : "PEND"}
                          </span>{" "}
                          {cleanText(item.item)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="subpanel">
                    <strong>Fotos</strong>
                    {selectedNsPhotos.length ? (
                      <ul className="plain-list">
                        {selectedNsPhotos.map((photo, index) => (
                          <li key={`${photo.caminho}-${index}`}>
                            {cleanText(photo.legenda || photo.caminho || "Foto")} Ã‚· {formatDateTime(photo.data_hora)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">Nenhuma foto vinculada a esta NS.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="empty-box">
                  <strong>Selecione uma NS.</strong>
                  <p>Aqui entram materiais, checklist, fotos e atualizaÃƒ§Ãƒ£o de status.</p>
                </div>
              )}
            </article>
          </section>

          <section className="two-column">
            <article className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">RDO</p>
                  <h2>Criar RDO pelo frontend</h2>
                </div>
                <span className="pill pill-ok">POST /api/rdo</span>
              </div>

              <form className="form-grid" onSubmit={handleCreateRdo}>
                <div className="double-grid">
                  <label className="field">
                    <span>Data</span>
                    <input
                      type="date"
                      value={rdoForm.data}
                      onChange={(event) => setRdoForm((current) => ({ ...current, data: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>NÃƒºcleo</span>
                    <input
                      type="text"
                      value={rdoForm.nucleo}
                      onChange={(event) => setRdoForm((current) => ({ ...current, nucleo: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="double-grid">
                  <label className="field">
                    <span>ResponsÃƒ¡vel</span>
                    <input
                      type="text"
                      value={rdoForm.responsavel}
                      onChange={(event) => setRdoForm((current) => ({ ...current, responsavel: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>NS vinculada</span>
                    <select
                      value={rdoForm.nsId}
                      onChange={(event) => setRdoForm((current) => ({ ...current, nsId: event.target.value }))}
                    >
                      <option value="">Sem NS</option>
                      {nsList.items.map((item) => (
                        <option key={String(item.id)} value={String(item.id)}>
                          {nsCode(item)} Ã‚· {nsTrecho(item)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="double-grid">
                  <label className="field">
                    <span>Clima manhÃƒ£</span>
                    <input
                      type="text"
                      value={rdoForm.climaManha}
                      onChange={(event) => setRdoForm((current) => ({ ...current, climaManha: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Clima tarde</span>
                    <input
                      type="text"
                      value={rdoForm.climaTarde}
                      onChange={(event) => setRdoForm((current) => ({ ...current, climaTarde: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="triple-grid">
                  <label className="field">
                    <span>ServiÃƒ§o</span>
                    <input
                      type="text"
                      placeholder="Assentamento, escavaÃƒ§Ãƒ£o..."
                      value={rdoForm.servico}
                      onChange={(event) => setRdoForm((current) => ({ ...current, servico: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Quantidade</span>
                    <input
                      type="number"
                      step="0.01"
                      value={rdoForm.quantidade}
                      onChange={(event) => setRdoForm((current) => ({ ...current, quantidade: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>DN</span>
                    <input
                      type="number"
                      value={rdoForm.dnMm}
                      onChange={(event) => setRdoForm((current) => ({ ...current, dnMm: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="triple-grid">
                  <label className="field">
                    <span>Equipe</span>
                    <input
                      type="text"
                      placeholder="Encanador"
                      value={rdoForm.equipeFuncao}
                      onChange={(event) => setRdoForm((current) => ({ ...current, equipeFuncao: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Qtd equipe</span>
                    <input
                      type="number"
                      min="1"
                      value={rdoForm.equipeQtd}
                      onChange={(event) => setRdoForm((current) => ({ ...current, equipeQtd: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Unidade</span>
                    <input
                      type="text"
                      value={rdoForm.unidade}
                      onChange={(event) => setRdoForm((current) => ({ ...current, unidade: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="triple-grid">
                  <label className="field">
                    <span>OcorrÃƒªncia</span>
                    <select
                      value={rdoForm.ocorrenciaTipo}
                      onChange={(event) => setRdoForm((current) => ({ ...current, ocorrenciaTipo: event.target.value }))}
                    >
                      <option value="outro">Outro</option>
                      <option value="parada">Parada</option>
                      <option value="chuva">Chuva</option>
                      <option value="material">Material</option>
                      <option value="acidente">Acidente</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Hora</span>
                    <input
                      type="time"
                      value={rdoForm.ocorrenciaHora}
                      onChange={(event) => setRdoForm((current) => ({ ...current, ocorrenciaHora: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>DescriÃƒ§Ãƒ£o</span>
                    <input
                      type="text"
                      value={rdoForm.ocorrenciaDescricao}
                      onChange={(event) =>
                        setRdoForm((current) => ({ ...current, ocorrenciaDescricao: event.target.value }))
                      }
                    />
                  </label>
                </div>

                <div className="button-row">
                  <button className="button primary" type="submit">
                    Salvar RDO
                  </button>
                  <a className="button ghost" href={nativeUrl("/rdo")} target="_blank" rel="noreferrer">
                    Abrir mÃƒ³dulo nativo
                  </a>
                </div>

                {rdoMessage ? <p className="message">{rdoMessage}</p> : null}
              </form>
            </article>

            <article className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">RDOs existentes</p>
                  <h2>Listagem, fechamento e PDF</h2>
                </div>
                <small>{formatInt(rdoList.items.length)} registros</small>
              </div>

              <div className="rdo-list">
                {latestRdos.length ? (
                  latestRdos.map((rdo) => (
                    <article className="rdo-card" key={rdo.id}>
                      <div className="rdo-top">
                        <div>
                          <strong>RDO {rdo.numero ?? rdo.id}</strong>
                          <span>
                            {formatDate(rdo.data)} Ã‚· {cleanText(rdo.nucleo)}
                          </span>
                        </div>
                        <span className={toneClass(rdo.status)}>{cleanText(rdo.status)}</span>
                      </div>
                      <div className="rdo-meta">
                        <span>ResponsÃƒ¡vel: {cleanText(rdo.responsavel ?? "-")}</span>
                        <span>Custo: {formatCurrency(asNumber(rdo.total_custo))}</span>
                        <span>Apontamentos: {formatInt(rdo.apontamentos?.length ?? 0)}</span>
                      </div>
                      <div className="button-row">
                        <a className="button ghost slim" href={apiUrl(`/api/rdo/${rdo.id}/pdf`)} target="_blank" rel="noreferrer">
                          PDF
                        </a>
                        {cleanText(rdo.status) !== "FECHADO" ? (
                          <button className="button ghost slim" onClick={() => handleCloseRdo(rdo.id)}>
                            Fechar
                          </button>
                        ) : null}
                        <a
                          className="button ghost slim"
                          href={apiUrl(`/api/rdo/${rdo.data}?nucleo=${encodeURIComponent(rdo.nucleo)}`)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          JSON
                        </a>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-box">
                    <strong>Sem RDOs ainda.</strong>
                    <p>O formulÃƒ¡rio ao lado jÃƒ¡ salva direto no backend.</p>
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Cadastro, curva e cronograma</p>
                <h2>Leituras operacionais do backend</h2>
              </div>
              <small>{companyName}</small>
            </div>

            <div className="triple-panels">
              <article className="subpanel">
                <strong>Cadastro tÃƒ©cnico</strong>
                <ul className="plain-list">
                  <li>FeiÃƒ§Ãƒµes no GeoJSON: {formatInt(geoJson?.features.length ?? 0)}</li>
                  <li>Trechos: {formatInt(geoTrechos)}</li>
                  <li>PVs/PIs: {formatInt(geoPvs)}</li>
                  <li>
                    <a href={apiUrl("/api/cadastro/geojson")} target="_blank" rel="noreferrer">
                      Abrir GeoJSON bruto
                    </a>
                  </li>
                </ul>
              </article>

              <article className="subpanel">
                <strong>Manage dataset</strong>
                <ul className="plain-list">
                  <li>NÃƒ³s: {formatInt(manageData?.nodes.length ?? 0)}</li>
                  <li>Arestas: {formatInt(manageData?.edges.length ?? 0)}</li>
                  <li>ExtensÃƒ£o: {formatMeters(asNumber(manageData?.ext))}</li>
                  <li>Custo 5D: {formatCurrency(manageCost)}</li>
                </ul>
              </article>

              <article className="subpanel">
                <strong>Curva S</strong>
                <ul className="plain-list">
                  <li>Previsto: {formatPercent(asNumber(curvePrev?.pct_acum ?? curvePrev?.acum_pct))}</li>
                  <li>Realizado: {formatPercent(asNumber(curveReal?.pct_acum ?? curveReal?.acum_pct))}</li>
                  <li>Total de NS: {formatInt(curvaS?.n_total ?? 0)}</li>
                  <li>ExtensÃƒ£o total: {formatMeters(curvaS?.ext_total ?? 0)}</li>
                </ul>
              </article>
            </div>

            <div className="nucleo-grid">
              {visibleNuclei.length ? (
                visibleNuclei.slice(0, 8).map((nucleo) => {
                  const phase = currentPhase(nucleo);
                  return (
                    <article className="nucleo-card" key={nucleo.nome}>
                      <div className="nucleo-top">
                        <div>
                          <strong>{cleanText(nucleo.nome)}</strong>
                          <span>
                            {formatDate(nucleo.inicio)} atÃƒ© {formatDate(nucleo.fim)}
                          </span>
                        </div>
                        <span className={toneClass(phase?.id ?? "fase")}>{cleanText(phase?.nome ?? "Sem fase")}</span>
                      </div>
                      <div className="mini-grid">
                        <div className="micro-card">
                          <strong>ExtensÃƒ£o</strong>
                          <span>{formatMeters(nucleo.extensao_m)}</span>
                        </div>
                        <div className="micro-card">
                          <strong>Trechos</strong>
                          <span>{formatInt(nucleo.n_trechos)}</span>
                        </div>
                        <div className="micro-card">
                          <strong>Equipes</strong>
                          <span>{formatInt(nucleo.equipes)}</span>
                        </div>
                        <div className="micro-card">
                          <strong>DuraÃƒ§Ãƒ£o</strong>
                          <span>{formatInt(nucleo.duracao_dias)} dias</span>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="empty-box">
                  <strong>Nenhum nÃƒºcleo disponÃƒ­vel.</strong>
                </div>
              )}
            </div>
          </section>
          
          {error ? (
            <section className="panel error-panel">
              <p className="eyebrow">Falha</p>
              <h2>Alguma rota nÃƒ£o respondeu</h2>
              <p>{error}</p>
            </section>
          ) : null}

          {booting ? (
            <section className="panel loading-panel">
              <p className="eyebrow">Carregando</p>
              <h2>Montando o frontend</h2>
              <p>Buscando saÃƒºde, cronograma, notas, RDOs, rede e processamento.</p>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
