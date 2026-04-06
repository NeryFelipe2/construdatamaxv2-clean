/**
 * MotorNsV5Page — Motor de processamento de DXF/DWG com visual Datadog/Palantir.
 * Substitui o LegacyApp.tsx (texto cru estilo terminal).
 *
 * Funcionalidades reais:
 * - Upload DXF/DWG/LandXML + cartografia
 * - Processamento via API backend (Render)
 * - KPIs do dashboard
 * - Lista de trechos / NS gerados
 * - Curva S, hidraulica, custos
 */
import { useEffect, useState } from "react"
import {
  Cpu, Upload, FileText, Zap, RefreshCw, CheckCircle, AlertTriangle,
  Activity, Layers, DollarSign, TrendingUp, Map, Network, Database,
} from "lucide-react"
import { useProjectContext } from "@/store/projectContext"
import {
  apiDashboard, apiNsList, apiNucleos, apiCurvaS,
  apiProcessarImportar, apiProcessarUltimo, apiHealth,
} from "@/lib/api"

const TABS = [
  { id: "processar", label: "Processar", icon: Upload },
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "trechos", label: "Trechos & NS", icon: Layers },
  { id: "custos", label: "Custos 5D", icon: DollarSign },
  { id: "curva", label: "Curva S", icon: TrendingUp },
] as const

type TabId = (typeof TABS)[number]["id"]

export function MotorNsV5Page() {
  const activeProjectId = useProjectContext(s => s.activeProjectId)
  const projetos = useProjectContext(s => s.projetos)
  const activeProjeto = projetos.find(p => p.id === activeProjectId) ?? null

  const [tab, setTab] = useState<TabId>("processar")
  const [health, setHealth] = useState<{ ok: boolean } | null>(null)
  const [dashboard, setDashboard] = useState<any>(null)
  const [nsList, setNsList] = useState<any[]>([])
  const [curvaS, setCurvaS] = useState<any>(null)
  const [nucleos, setNucleos] = useState<string[]>([])

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [cartoFile, setCartoFile] = useState<File | null>(null)
  const [uploadNucleo, setUploadNucleo] = useState("")
  const [selectedMotor, setSelectedMotor] = useState<"v5" | "v9">("v5")
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [latestJob, setLatestJob] = useState<any>(null)

  // Fetch all data
  useEffect(() => {
    apiHealth().then(setHealth).catch(() => {})
    apiDashboard().then(setDashboard).catch(() => {})
    apiNsList().then(r => setNsList(r.items ?? [])).catch(() => {})
    apiCurvaS().then(setCurvaS).catch(() => {})
    apiNucleos().then(r => setNucleos((r.items ?? []).map((i: any) => i.nome))).catch(() => {})
    apiProcessarUltimo().then(j => setLatestJob(j)).catch(() => {})
  }, [])

  async function handleUpload() {
    if (!uploadFile) { setUploadMsg({ type: "err", text: "Selecione um arquivo" }); return }
    setUploading(true); setUploadMsg(null)
    const fd = new FormData()
    fd.append("arquivo", uploadFile)
    fd.append("nucleo", uploadNucleo || activeProjeto?.nome || "PROJETO")
    fd.append("motor", selectedMotor)
    if (cartoFile) fd.append("cartografia", cartoFile)
    try {
      const job = await apiProcessarImportar(fd) as any
      setLatestJob(job)
      setUploadMsg({ type: "ok", text: `Processado: ${job.n_pvs ?? 0} PVs, ${job.n_trechos ?? 0} trechos, ${job.ns_geradas ?? 0} NS geradas` })
      // Refresh data
      apiDashboard().then(setDashboard).catch(() => {})
      apiNsList().then(r => setNsList(r.items ?? [])).catch(() => {})
    } catch (e: any) {
      setUploadMsg({ type: "err", text: e.message ?? "Erro no processamento" })
    } finally {
      setUploading(false)
    }
  }

  // KPIs computed
  const kpiPvs = dashboard?.n_total ?? 0
  const kpiExec = dashboard?.n_execucao ?? 0
  const kpiConcl = dashboard?.n_concluidas ?? 0
  const kpiPctFisico = dashboard?.pct_fisico ?? 0
  const kpiPctFinanceiro = dashboard?.pct_financeiro ?? 0
  const kpiExtTotal = dashboard?.extensao_total_m ?? 0
  const kpiExtExec = dashboard?.extensao_exec_m ?? 0
  const kpiValor = dashboard?.valor_liberado ?? 0

  return (
    <div className="flex flex-col h-full bg-[#0a1628]">
      {/* Header */}
      <header className="shrink-0 border-b border-[#20406a] bg-[#0d2040] px-6 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
          <Cpu size={22} className="text-cyan-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-[#e4f2f8]">Motor NS V5</h1>
          <p className="text-xs text-[#5a8caa]">Processamento DXF/DWG/LandXML — {activeProjeto?.nome ?? "Selecione um projeto"}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#112645] border border-[#20406a]">
          <span className="text-[10px] text-[#5a8caa] uppercase tracking-wider">Backend</span>
          <span className={`w-2 h-2 rounded-full ${health?.ok ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" : "bg-rose-400"}`} />
        </div>
      </header>

      {/* Tabs */}
      <nav className="shrink-0 border-b border-[#20406a] bg-[#0a1628] px-6 flex gap-1">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
                tab === t.id ? "text-cyan-400 border-cyan-400" : "text-[#6b6b6b] border-transparent hover:text-[#8fb3c8]"
              }`}>
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </nav>

      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* ── PROCESSAR ── */}
        {tab === "processar" && (
          <>
            <div className="bg-[#112645] border border-[#20406a] rounded-xl p-6">
              <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">Pipeline de Processamento</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[#5a8caa] uppercase tracking-wider">Nucleo / Lote</label>
                  <input value={uploadNucleo} onChange={e => setUploadNucleo(e.target.value)}
                    placeholder={activeProjeto?.nome ?? "Ex: Setor Norte"}
                    className="w-full mt-1 bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8] placeholder-[#5a8caa]" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#5a8caa] uppercase tracking-wider">Motor</label>
                  <select value={selectedMotor} onChange={e => setSelectedMotor(e.target.value as any)}
                    className="w-full mt-1 bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#e4f2f8]">
                    <option value="v5">NOVA NS v5 (SABESP)</option>
                    <option value="v9">NS v9 (Geracao 9)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#5a8caa] uppercase tracking-wider">Cartografia (opcional)</label>
                  <label className="w-full mt-1 bg-[#0d2040] border border-dashed border-[#20406a] rounded-lg px-3 py-2.5 text-sm text-[#5a8caa] hover:border-cyan-500/50 hover:text-cyan-400 cursor-pointer flex items-center gap-2 transition-colors">
                    <Map size={14} />
                    {cartoFile ? cartoFile.name.slice(0, 20) : "SHP / DXF base"}
                    <input type="file" accept=".shp,.dbf,.shx,.zip,.dxf,.geojson" className="hidden"
                      onChange={e => setCartoFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="text-[10px] font-bold text-[#5a8caa] uppercase tracking-wider">Vetor de Origem (DXF, DWG, LandXML)</label>
                  <label className="w-full mt-1 bg-[#0d2040] border-2 border-dashed border-[#20406a] rounded-xl p-6 text-center cursor-pointer hover:border-cyan-500/50 transition-colors block">
                    <Upload size={28} className="mx-auto mb-2 text-[#5a8caa]" />
                    {uploadFile ? (
                      <div>
                        <div className="text-sm font-medium text-cyan-400">{uploadFile.name}</div>
                        <div className="text-[10px] text-[#5a8caa]">{(uploadFile.size / 1024).toFixed(1)} KB — clique pra trocar</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-medium text-[#e4f2f8]">Clique ou arraste o arquivo aqui</div>
                        <div className="text-[10px] text-[#5a8caa]">DXF, DWG, LandXML, JSON ate 100MB</div>
                      </div>
                    )}
                    <input type="file" accept=".dxf,.dwg,.xml,.landxml,.json" className="hidden"
                      onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button onClick={handleUpload} disabled={uploading || !uploadFile}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {uploading ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                  {uploading ? "Processando..." : "Processar e Gerar NS"}
                </button>
                {uploadMsg && (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                    uploadMsg.type === "ok" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}>
                    {uploadMsg.type === "ok" ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                    {uploadMsg.text}
                  </div>
                )}
              </div>
            </div>

            {/* Latest Job Result */}
            {latestJob && (
              <div className="bg-[#112645] border border-[#20406a] rounded-xl p-6">
                <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-4">Ultimo Processamento</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Kpi label="PVs" value={latestJob.n_pvs ?? 0} />
                  <Kpi label="Trechos" value={latestJob.n_trechos ?? 0} />
                  <Kpi label="NS OK" value={latestJob.ns_geradas ?? 0} color="text-green-400" />
                  <Kpi label="NS Erros" value={latestJob.ns_erros ?? 0} color="text-rose-400" />
                </div>
                {latestJob.arquivo && (
                  <div className="mt-4 text-xs text-[#5a8caa]">
                    Arquivo: <span className="text-[#e4f2f8] font-mono">{latestJob.arquivo}</span> |
                    Motor: <span className="text-cyan-400 font-mono uppercase">{latestJob.motor}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Total NS" value={kpiPvs} icon={Database} color="text-cyan-400" bg="bg-cyan-500/10" />
              <KpiCard label="Em Execucao" value={kpiExec} icon={Activity} color="text-yellow-400" bg="bg-yellow-500/10" />
              <KpiCard label="Concluidas" value={kpiConcl} icon={CheckCircle} color="text-green-400" bg="bg-green-500/10" />
              <KpiCard label="% Fisico" value={`${kpiPctFisico.toFixed(1)}%`} icon={TrendingUp} color="text-purple-400" bg="bg-purple-500/10" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <KpiCard label="Extensao Total" value={`${kpiExtTotal.toFixed(0)} m`} icon={Network} color="text-[#e4f2f8]" bg="bg-[#0d2040]" />
              <KpiCard label="Extensao Executada" value={`${kpiExtExec.toFixed(0)} m`} icon={Network} color="text-cyan-400" bg="bg-cyan-500/10" />
              <KpiCard label="Valor Liberado" value={formatBRL(kpiValor)} icon={DollarSign} color="text-green-400" bg="bg-green-500/10" />
            </div>

            {nucleos.length > 0 && (
              <div className="bg-[#112645] border border-[#20406a] rounded-xl p-5">
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">Nucleos Processados ({nucleos.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {nucleos.map(n => (
                    <span key={n} className="px-3 py-1.5 rounded-lg bg-[#0d2040] border border-[#20406a] text-xs text-[#8fb3c8]">{n}</span>
                  ))}
                </div>
              </div>
            )}

            {!dashboard && (
              <div className="bg-[#112645] border border-[#20406a] rounded-xl p-8 text-center">
                <Database size={32} className="mx-auto mb-3 text-[#5a8caa] opacity-50" />
                <p className="text-sm text-[#5a8caa]">Nenhum dado processado ainda. Va em <button onClick={() => setTab("processar")} className="text-cyan-400 hover:underline">Processar</button> para subir um arquivo.</p>
              </div>
            )}
          </>
        )}

        {/* ── TRECHOS & NS ── */}
        {tab === "trechos" && (
          <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#20406a] flex items-center justify-between">
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">NS Geradas ({nsList.length})</h3>
            </div>
            {nsList.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#5a8caa]">Nenhuma NS gerada. Processe um arquivo na aba <button onClick={() => setTab("processar")} className="text-cyan-400 hover:underline">Processar</button>.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#0d2040] text-[#5a8caa] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-2">NS</th>
                      <th className="text-left px-4 py-2">Nucleo</th>
                      <th className="text-left px-4 py-2">PVs</th>
                      <th className="text-left px-4 py-2">Trechos</th>
                      <th className="text-left px-4 py-2">Extensao</th>
                      <th className="text-left px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nsList.slice(0, 50).map((ns: any, i: number) => (
                      <tr key={i} className="border-t border-[#20406a] hover:bg-[#14294e]">
                        <td className="px-4 py-2 text-cyan-400 font-mono">{String(ns.codigo ?? ns.id ?? "").padStart(3, "0")}</td>
                        <td className="px-4 py-2 text-[#e4f2f8]">{String(ns.nucleo ?? "-")}</td>
                        <td className="px-4 py-2 text-[#8fb3c8]">{ns.n_pvs ?? "-"}</td>
                        <td className="px-4 py-2 text-[#8fb3c8]">{ns.n_trechos ?? "-"}</td>
                        <td className="px-4 py-2 text-[#8fb3c8]">{ns.extensao_m ? `${Number(ns.extensao_m).toFixed(0)}m` : "-"}</td>
                        <td className="px-4 py-2"><StatusPill value={ns.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── CUSTOS 5D ── */}
        {tab === "custos" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="% Fisico" value={`${kpiPctFisico.toFixed(1)}%`} icon={Activity} color="text-cyan-400" bg="bg-cyan-500/10" />
              <KpiCard label="% Financeiro" value={`${kpiPctFinanceiro.toFixed(1)}%`} icon={DollarSign} color="text-purple-400" bg="bg-purple-500/10" />
              <KpiCard label="Valor Liberado" value={formatBRL(kpiValor)} icon={DollarSign} color="text-green-400" bg="bg-green-500/10" />
              <KpiCard label="Custo RDO Total" value={formatBRL(dashboard?.custo_rdo_total ?? 0)} icon={DollarSign} color="text-yellow-400" bg="bg-yellow-500/10" />
            </div>
            {!dashboard && (
              <div className="bg-[#112645] border border-[#20406a] rounded-xl p-8 text-center">
                <DollarSign size={32} className="mx-auto mb-3 text-[#5a8caa] opacity-50" />
                <p className="text-sm text-[#5a8caa]">Nenhum dado de custos. Processe um arquivo primeiro.</p>
              </div>
            )}
          </>
        )}

        {/* ── CURVA S ── */}
        {tab === "curva" && (
          <div className="bg-[#112645] border border-[#20406a] rounded-xl p-6">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-4">Curva S — Previsto vs Realizado</h3>
            {!curvaS || (!curvaS.previsto?.length && !curvaS.realizado?.length) ? (
              <div className="text-center py-8 text-sm text-[#5a8caa]">Sem dados de curva S.</div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-[10px] text-[#5a8caa] uppercase">Total Trechos</div>
                    <div className="text-lg font-bold text-cyan-400">{curvaS.n_total ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#5a8caa] uppercase">Custo Total</div>
                    <div className="text-lg font-bold text-green-400">{formatBRL(curvaS.custo_total ?? 0)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Kpi({ label, value, color = "text-[#e4f2f8]" }: { label: string; value: any; color?: string }) {
  return (
    <div className="bg-[#0d2040] border border-[#20406a] rounded-lg p-3">
      <div className="text-[10px] text-[#5a8caa] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, color, bg }: { label: string; value: any; icon: any; color: string; bg: string }) {
  return (
    <div className="bg-[#112645] border border-[#20406a] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon size={14} className={color} />
        </div>
        <span className="text-[10px] text-[#5a8caa] uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  )
}

function StatusPill({ value }: { value: any }) {
  const v = String(value ?? "").toUpperCase()
  let color = "bg-gray-500/10 text-gray-400 border-gray-500/20"
  if (v.includes("CONCL")) color = "bg-green-500/10 text-green-400 border-green-500/20"
  else if (v.includes("EXEC") || v.includes("OK")) color = "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
  else if (v.includes("ERRO") || v.includes("BLOQ")) color = "bg-rose-500/10 text-rose-400 border-rose-500/20"
  else if (v.includes("PLANEJ")) color = "bg-blue-500/10 text-blue-400 border-blue-500/20"
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${color}`}>{v || "—"}</span>
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v)
}
