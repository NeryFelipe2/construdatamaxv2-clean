/**
 * API client — connects Palantir frontend to the real ConstruDataMaxV2 backend.
 * All endpoints match the FastAPI routes in api/*.py
 */

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type CanonicalIntegrationStatus = "connected" | "partial" | "local";

export interface ApiProjetoRecord extends Record<string, unknown> {
  id: string;
  nome: string;
  contrato?: string | null;
  cidade?: string | null;
  cliente?: string | null;
  tipo?: string | null;
  status?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  orcamento_total?: number | null;
  responsavel_nome?: string | null;
  responsavel_telefone?: string | null;
}

export interface ApiProjetoDashboardPayload {
  projeto: ApiProjetoRecord;
  kpis: {
    frentes: number;
    rdos_total: number;
    rdos_hoje: number;
    tarefas_pendentes: number;
    contatos: number;
    restricoes_abertas: number;
    custo_total_dia: number;
    planejamento_ativo?: boolean;
    desvios_total?: number;
    desvios_criticos?: number;
    logs_abertos?: number;
    replanejamentos_rascunho?: number;
    ppc_medio?: number;
    spi_medio?: number;
    cpi_medio?: number;
  };
  frentes: Array<Record<string, unknown>>;
  contatos: Array<Record<string, unknown>>;
  rdos: Array<Record<string, unknown>>;
  tarefas: Array<Record<string, unknown>>;
  restricoes: Array<Record<string, unknown>>;
  planejamento?: Record<string, unknown> | null;
  desvios?: Array<Record<string, unknown>>;
  logs?: Array<Record<string, unknown>>;
  replanejamentos?: Array<Record<string, unknown>>;
  status: CanonicalIntegrationStatus;
}

export interface ApiProjetoTorrePayload {
  projeto: ApiProjetoRecord;
  frentes: Array<Record<string, unknown>>;
  riscos: Array<Record<string, unknown>>;
  restricoes: Array<Record<string, unknown>>;
  logs?: Array<Record<string, unknown>>;
  desvios?: Array<Record<string, unknown>>;
  replanejamentos?: Array<Record<string, unknown>>;
  kpis: ApiProjetoDashboardPayload["kpis"];
  status: CanonicalIntegrationStatus;
}

export interface ApiProjetoGestao360Payload extends ApiProjetoDashboardPayload {
  custos: {
    diario: number;
    rdos: number;
    lancamentos?: number;
    despesas_total?: number;
    receitas_total?: number;
  };
  planejamento_operacional?: Record<string, unknown>;
  integracoes: Record<string, string>;
}

export interface ApiProjetoFinanceiroPayload {
  projeto: ApiProjetoRecord;
  lancamentos: Array<Record<string, unknown>>;
  trechos: Array<Record<string, unknown>>;
  fluxo_projetado?: Record<string, unknown>;
  resumo: {
    receitas: number;
    despesas: number;
    trechos_total: number;
    receitas_previstas?: number;
    custos_projetados?: number;
    saldo_projetado?: number;
    lancamentos?: number;
  };
  status: CanonicalIntegrationStatus;
}

export interface ApiProjetoWhatsappLogRecord {
  id: string;
  telefone: string;
  nome: string;
  direction: string;
  tipo: string;
  mensagem: string;
  status: string;
  created_at?: string | null;
  payload?: Record<string, unknown>;
}

export interface ApiProjetoWhatsappAgendamentoRecord {
  id: string;
  templateId: string;
  templateNome: string;
  mensagem: string;
  frequencia: string;
  horario: string;
  destinatarios: Array<{ nome: string; telefone: string; contato_id?: string | null }>;
  ativo: boolean;
  totalEnviados: number;
  ultimaExecucao?: string | null;
  created_at?: string | null;
  updated_status?: string | null;
}

export type ApiRdoReviewStatus = "rascunho" | "extraido" | "em_revisao" | "finalizado" | "rejeitado";

export interface ApiRdoExtractionPayload {
  fields: Record<string, unknown>;
  confidence: Record<string, number>;
  pending_fields: string[];
  raw_text?: string;
  status_revisao: ApiRdoReviewStatus;
  arquivo?: Record<string, unknown>;
}

export interface ApiRdoAutomaticoResult {
  rdo?: Record<string, unknown>;
  extraction?: ApiRdoExtractionPayload;
  evidence?: Record<string, unknown>;
  status?: CanonicalIntegrationStatus;
}

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
  get<{ items: ApiProjetoRecord[]; source?: string }>("/api/projetos");

export const apiCriarProjeto = (payload: Record<string, unknown>) =>
  post<ApiProjetoRecord>("/api/projetos", payload);

export const apiProjetoDashboard = (projectId: string) =>
  get<ApiProjetoDashboardPayload>(`/api/projetos/${projectId}/dashboard`);

export const apiProjetoRdos = (projectId: string) =>
  get<{ items: Array<Record<string, unknown>> }>(`/api/projetos/${projectId}/rdos`);

export const apiProjetoCriarRdo = (projectId: string, payload: Record<string, unknown>) =>
  post<Record<string, unknown>>(`/api/projetos/${projectId}/rdos`, payload);

export const apiProjetoPreencherTexto = (projectId: string, texto: string) =>
  post<Record<string, unknown>>(`/api/projetos/${projectId}/preencher-texto`, { texto });

export const apiProjetoRdoAutomaticoTexto = (projectId: string, texto: string) =>
  post<ApiRdoAutomaticoResult>(`/api/projetos/${projectId}/rdos/automatico/texto`, { texto });

export const apiProjetoRdoAutomaticoUpload = (projectId: string, fd: FormData) =>
  post<ApiRdoAutomaticoResult>(`/api/projetos/${projectId}/rdos/automatico/upload`, fd);

export const apiProjetoRdoEvidencias = (projectId: string, rdoId: string) =>
  get<{ items: Array<Record<string, unknown>>; status: CanonicalIntegrationStatus }>(
    `/api/projetos/${projectId}/rdos/${rdoId}/evidencias`
  );

export const apiProjetoRdoRevisar = (projectId: string, rdoId: string, payload: Record<string, unknown>) =>
  patch<Record<string, unknown>>(`/api/projetos/${projectId}/rdos/${rdoId}/revisar`, payload);

export const apiProjetoRdoFinalizar = (projectId: string, rdoId: string, payload: Record<string, unknown> = {}) =>
  post<Record<string, unknown>>(`/api/projetos/${projectId}/rdos/${rdoId}/finalizar`, payload);

export const apiProjetoRdoRejeitar = (projectId: string, rdoId: string, payload: Record<string, unknown> = {}) =>
  post<Record<string, unknown>>(`/api/projetos/${projectId}/rdos/${rdoId}/rejeitar`, payload);

export const apiProjetoRdoMedicaoFontes = (projectId: string, rdoId: string) =>
  get<{ items: Array<Record<string, unknown>>; status: CanonicalIntegrationStatus }>(
    `/api/projetos/${projectId}/rdos/${rdoId}/medicao-fontes`
  );

export const apiRelatorio360Rdo = (rdoId: string, projectId?: string) =>
  get<Record<string, unknown>>(`/api/relatorio360/rdo/${rdoId}`, projectId ? { project_id: projectId } : undefined);

export const apiProjetoTarefas = (projectId: string) =>
  get<{ items: Array<Record<string, unknown>> }>(`/api/projetos/${projectId}/tarefas`);

export const apiProjetoCriarTarefa = (projectId: string, payload: Record<string, unknown>) =>
  post<Record<string, unknown>>(`/api/projetos/${projectId}/tarefas`, payload);

export const apiProjetoContatos = (projectId: string) =>
  get<{ items: Array<Record<string, unknown>> }>(`/api/projetos/${projectId}/contatos`);

export const apiProjetoCriarContato = (projectId: string, payload: Record<string, unknown>) =>
  post<Record<string, unknown>>(`/api/projetos/${projectId}/contatos`, payload);

export const apiProjetoAtualizarContato = (projectId: string, contatoId: string, payload: Record<string, unknown>) =>
  patch<Record<string, unknown>>(`/api/projetos/${projectId}/contatos/${contatoId}`, payload);

export const apiProjetoRemoverContato = (projectId: string, contatoId: string) =>
  fetch(url(`/api/projetos/${projectId}/contatos/${contatoId}`), { method: "DELETE" }).then(async (r) => {
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.detail || `API /api/projetos/${projectId}/contatos/${contatoId}: ${r.status}`);
    }
    return r.json() as Promise<Record<string, unknown>>;
  });

export const apiProjetoTorre = (projectId: string) =>
  get<ApiProjetoTorrePayload>(`/api/projetos/${projectId}/torre`);

export const apiProjetoGestao360 = (projectId: string) =>
  get<ApiProjetoGestao360Payload>(`/api/projetos/${projectId}/gestao360`);

export const apiProjetoLpsRestricoes = (projectId: string) =>
  get<{ items: Array<Record<string, unknown>> }>(`/api/projetos/${projectId}/lps-restricoes`);

export const apiProjetoCriarLpsRestricao = (projectId: string, payload: Record<string, unknown>) =>
  post<Record<string, unknown>>(`/api/projetos/${projectId}/lps-restricoes`, payload);

export const apiProjetoAtualizarLpsRestricao = (projectId: string, restricaoId: string, payload: Record<string, unknown>) =>
  patch<Record<string, unknown>>(`/api/projetos/${projectId}/lps-restricoes/${restricaoId}`, payload);

export const apiProjetoRemoverLpsRestricao = (projectId: string, restricaoId: string) =>
  fetch(url(`/api/projetos/${projectId}/lps-restricoes/${restricaoId}`), { method: "DELETE" }).then(async (r) => {
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.detail || `API /api/projetos/${projectId}/lps-restricoes/${restricaoId}: ${r.status}`);
    }
    return r.json() as Promise<Record<string, unknown>>;
  });

export const apiProjetoFinanceiro = (projectId: string) =>
  get<ApiProjetoFinanceiroPayload>(`/api/projetos/${projectId}/financeiro`);

export const apiProjetoControleFluxo = (projectId: string) =>
  get<Record<string, unknown>>(`/api/projetos/${projectId}/controle-fluxo`);

export const apiProjetoPreencherControleFluxo = (projectId: string, texto: string) =>
  post<Record<string, unknown>>(`/api/projetos/${projectId}/controle-fluxo/preencher-texto`, { texto });

export const apiProjetoWhatsappLogs = (projectId: string) =>
  get<{ items: ApiProjetoWhatsappLogRecord[]; status: CanonicalIntegrationStatus }>(
    `/api/projetos/${projectId}/whatsapp/logs`
  );

export const apiProjetoWhatsappAgendamentos = (projectId: string) =>
  get<{ items: ApiProjetoWhatsappAgendamentoRecord[]; status: CanonicalIntegrationStatus }>(
    `/api/projetos/${projectId}/whatsapp/agendamentos`
  );

export const apiProjetoLogs = (projectId: string) =>
  get<{ items: Array<Record<string, unknown>>; status: CanonicalIntegrationStatus }>(
    `/api/projetos/${projectId}/logs`
  );

export const apiProjetoPlanejamentosSemanais = (projectId: string) =>
  get<{ items: Array<Record<string, unknown>>; status: CanonicalIntegrationStatus }>(
    `/api/projetos/${projectId}/planejamentos-semanais`
  );

export const apiProjetoCriarPlanejamentoSemanal = (projectId: string, payload: Record<string, unknown>) =>
  post<Record<string, unknown>>(`/api/projetos/${projectId}/planejamentos-semanais`, payload);

export const apiProjetoValidarPlanejamentoSemanal = (
  projectId: string,
  planId: string,
  payload: Record<string, unknown>
) => post<Record<string, unknown>>(`/api/projetos/${projectId}/planejamentos-semanais/${planId}/validar`, payload);

export const apiProjetoDesvios = (projectId: string) =>
  get<{ items: Array<Record<string, unknown>>; status: CanonicalIntegrationStatus }>(
    `/api/projetos/${projectId}/desvios`
  );

export const apiProjetoRecalcularDesviosMl = (projectId: string) =>
  post<Record<string, unknown>>(`/api/projetos/${projectId}/ml/recalcular-desvios`);

export const apiProjetoReplanejamentos = (projectId: string) =>
  get<{ items: Array<Record<string, unknown>>; status: CanonicalIntegrationStatus }>(
    `/api/projetos/${projectId}/replanejamentos`
  );

export const apiProjetoValidarReplanejamento = (
  projectId: string,
  replanejamentoId: string,
  payload: Record<string, unknown>
) => post<Record<string, unknown>>(`/api/projetos/${projectId}/replanejamentos/${replanejamentoId}/validar`, payload);

export const apiProjetoBiAnalytics = (projectId: string) =>
  get<Record<string, unknown>>(`/api/projetos/${projectId}/bi/analytics`);

export const apiProjetoCriarWhatsappAgendamento = (projectId: string, payload: Record<string, unknown>) =>
  post<ApiProjetoWhatsappAgendamentoRecord>(`/api/projetos/${projectId}/whatsapp/agendamentos`, payload);

export const apiProjetoAtualizarWhatsappAgendamento = (
  projectId: string,
  agendamentoId: string,
  payload: Record<string, unknown>
) =>
  patch<ApiProjetoWhatsappAgendamentoRecord>(
    `/api/projetos/${projectId}/whatsapp/agendamentos/${agendamentoId}`,
    payload
  );

export const apiProjetoRemoverWhatsappAgendamento = (projectId: string, agendamentoId: string) =>
  fetch(url(`/api/projetos/${projectId}/whatsapp/agendamentos/${agendamentoId}`), { method: "DELETE" }).then(async (r) => {
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.detail || `API /api/projetos/${projectId}/whatsapp/agendamentos/${agendamentoId}: ${r.status}`);
    }
    return r.json() as Promise<Record<string, unknown>>;
  });

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
