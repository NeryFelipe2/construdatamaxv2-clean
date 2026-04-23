/**
 * API client — connects Palantir frontend to the real ConstruDataMaxV2 backend.
 * All endpoints match the FastAPI routes in api/*.py
 */

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function url(path: string, params?: Record<string, string>): string {
  const base = API_BASE ? `${API_BASE}${path}` : path;
  const u = new URL(base, window.location.origin);
  if (params) for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const r = await fetch(url(path, params));
  if (!r.ok) throw new Error(`API ${path}: ${r.status}`);
  return r.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(url(path), {
    method: "POST",
    headers: body instanceof FormData ? {} : { "Content-Type": "application/json" },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || `API ${path}: ${r.status}`);
  }
  return r.json();
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(url(path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || `API ${path}: ${r.status}`);
  }
  return r.json();
}

// ─── Health ──────────────────────────────────────────────────────────────────
export const apiHealth = () => get<{ ok: boolean; app: string; display_name: string }>("/health");
export const apiHealthIntegrations = () => get<Record<string, unknown>>("/api/health/integrations");

// ─── Dashboard / Gestao ──────────────────────────────────────────────────────
export const apiDashboard = (nucleo?: string) =>
  get<{
    nucleo: string; n_total: number; n_planejadas: number; n_execucao: number;
    n_concluidas: number; n_medidas: number; pct_fisico: number; pct_financeiro: number;
    extensao_total_m: number; extensao_exec_m: number; valor_liberado: number;
    rdos: number; custo_rdo_total: number; m_por_dia: number; dias_medidos: number;
  }>("/api/dashboard", nucleo ? { nucleo } : undefined);

export const apiCurvaS = (nucleo?: string) =>
  get<{
    previsto: Array<{ mes_label?: string; pct_acum?: number; acum_pct?: number; ext_acum?: number; custo_acum?: number }>;
    realizado: Array<{ mes_label?: string; pct_acum?: number; acum_pct?: number; ext_acum?: number; custo_acum?: number }>;
    n_total: number; ext_total: number; custo_total: number;
  }>("/api/curva-s", nucleo ? { nucleo } : undefined);

export const apiCronograma = (nucleo?: string) =>
  get<{
    projeto: string; empresa: string; data_inicio: string; data_fim: string;
    duracao_total_dias: number; total_tarefas: number;
    nucleos: Array<{
      nome: string; extensao_m: number; n_trechos: number; equipes: number;
      inicio: string; fim: string; duracao_dias: number;
      fases: Array<{ id: string; nome: string; inicio: string; fim: string; duracao_dias: number }>;
    }>;
  }>("/api/cronograma", nucleo ? { nucleo } : undefined);

// ─── NS ──────────────────────────────────────────────────────────────────────
export const apiNsList = (nucleo?: string, status?: string) =>
  get<{ items: Array<Record<string, unknown>> }>("/api/ns", {
    ...(nucleo ? { nucleo } : {}),
    ...(status ? { status } : {}),
  });

export const apiNsDetail = (id: number) => get<Record<string, unknown>>(`/api/ns/${id}`);
export const apiNsUpdateStatus = (id: number, status: string, data_referencia?: string) =>
  patch<Record<string, unknown>>(`/api/ns/${id}/status`, { status, data_referencia });

// ─── RDO ─────────────────────────────────────────────────────────────────────
export const apiRdoList = (nucleo?: string) =>
  get<{ items: Array<Record<string, unknown>> }>("/api/rdo", nucleo ? { nucleo } : undefined);

export const apiRdoCreate = (payload: Record<string, unknown>) =>
  post<Record<string, unknown>>("/api/rdo", payload);

export const apiRdoClose = (id: number) =>
  patch<Record<string, unknown>>(`/api/rdo/${id}/fechar`);

export const apiRdoPdf = (id: number) => url(`/api/rdo/${id}/pdf`);

// ─── Integracao Total / Render facade ───────────────────────────────────────
export const apiProjetos = () =>
  get<{ items: Array<Record<string, unknown>>; source?: string }>("/api/projetos");

export const apiProjetoDashboard = (projectId: string) =>
  get<Record<string, unknown>>(`/api/projetos/${projectId}/dashboard`);

export const apiProjetoRdos = (projectId: string) =>
  get<{ items: Array<Record<string, unknown>> }>(`/api/projetos/${projectId}/rdos`);

export const apiProjetoCriarRdo = (projectId: string, payload: Record<string, unknown>) =>
  post<Record<string, unknown>>(`/api/projetos/${projectId}/rdos`, payload);

export const apiProjetoTarefas = (projectId: string) =>
  get<{ items: Array<Record<string, unknown>> }>(`/api/projetos/${projectId}/tarefas`);

export const apiProjetoCriarTarefa = (projectId: string, payload: Record<string, unknown>) =>
  post<Record<string, unknown>>(`/api/projetos/${projectId}/tarefas`, payload);

export const apiProjetoCriarLpsRestricao = (projectId: string, payload: Record<string, unknown>) =>
  post<Record<string, unknown>>(`/api/projetos/${projectId}/lps-restricoes`, payload);

export const apiProjetoContatos = (projectId: string) =>
  get<{ items: Array<Record<string, unknown>> }>(`/api/projetos/${projectId}/contatos`);

export const apiProjetoTorre = (projectId: string) =>
  get<Record<string, unknown>>(`/api/projetos/${projectId}/torre`);

export const apiProjetoGestao360 = (projectId: string) =>
  get<Record<string, unknown>>(`/api/projetos/${projectId}/gestao360`);

// ─── Cadastro / GeoJSON ──────────────────────────────────────────────────────
export const apiGeoJson = (nucleo?: string) =>
  get<{ type: string; features: Array<Record<string, unknown>> }>("/api/cadastro/geojson", nucleo ? { nucleo } : undefined);

// ─── Manage / Rede ───────────────────────────────────────────────────────────
export const apiManageRede = (nucleo?: string) =>
  get<{
    nodes: Array<Record<string, unknown>>; edges: Array<{ c?: number; ext?: number; status?: string }>;
    ox: number; oy: number; ext: number; meta?: Record<string, unknown>;
  }>("/api/manage/rede", nucleo ? { nucleo } : undefined);

// ─── Nucleos ─────────────────────────────────────────────────────────────────
export const apiNucleos = () => get<{ items: Array<{ nome: string }>; total: number }>("/api/nucleos");

// ─── Insights ────────────────────────────────────────────────────────────────
export const apiLeanLps = (nucleo?: string) =>
  get<{
    takt_metros_dia: number; cycle_time_dias: number; throughput_ns_semana: number;
    ns_planejadas_semana: number; ns_bloqueadas_semana: number; ext_planejada_semana: number;
    restricoes_lookahead: number; alerta_lookahead: string; valor_agregado_pct: number;
    co2_total_ton: number; custo_ciclo_vida_total: number;
  }>("/api/insights/lean-lps", nucleo ? { nucleo } : undefined);

export const apiPerdas = (nucleo?: string) =>
  get<{
    uarl_m3_ano: number; uarl_litros_dia: number; ili: number; ili_classificacao: string;
    risco_total_ano: number; n_dmas: number; custo_ineficiencia_ano: number;
  }>("/api/insights/perdas", nucleo ? { nucleo } : undefined);

// ─── Analytics ───────────────────────────────────────────────────────────────
export const apiAnalyticsResumo = () =>
  get<{
    status: string; gerado_em?: string; algoritmo: string; r2_test: number; mae: number;
    rmse: number; n_modelos: number; n_cenarios: number; n_nucleos: number;
  }>("/api/analytics/resumo");

// ─── Processamento ───────────────────────────────────────────────────────────
export const apiProcessarImportar = (fd: FormData) => post<Record<string, unknown>>("/api/processamento/importar", fd);
export const apiProcessarUltimo = () => get<Record<string, unknown>>("/api/processamento/ultimo");
export const apiProcessarLogs = () => get<{ items: Array<Record<string, unknown>> }>("/api/processamento/logs");

// ─── Fotos ───────────────────────────────────────────────────────────────────
export const apiFotos = (nsId: number) => get<{ items: Array<Record<string, unknown>> }>(`/api/fotos/${nsId}`);

// ─── WhatsApp (webhook already exists, these are for the new management routes) ──
export const apiWhatsappSend = (payload: { telefone: string; mensagem: string }) =>
  post<Record<string, unknown>>("/api/whatsapp/send", payload);

export const apiWhatsappNumeros = (nsId?: number) =>
  get<{ items: Array<{ id: number; telefone: string; nome: string; funcao: string; ns_id: number }> }>(
    nsId ? `/api/whatsapp/numeros?ns_id=${nsId}` : "/api/whatsapp/numeros"
  );

export const apiWhatsappCadastrar = (payload: { ns_id: number; telefone: string; nome: string; funcao: string }) =>
  post<Record<string, unknown>>("/api/whatsapp/numeros", payload);

export const apiWhatsappDisparar = (nsId: number) =>
  post<Record<string, unknown>>(`/api/whatsapp/disparar/${nsId}`);
