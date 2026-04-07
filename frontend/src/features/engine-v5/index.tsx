/**
 * EngineV5Dashboard — Painel que mostra todos os motores, geradores e leitores
 * migrados da NOVA NS Versao 5 para a plataforma unificada.
 */
import { useState, useEffect } from 'react'
import { Cpu, Cog, FileInput, BarChart3, CheckCircle2, XCircle, Loader2, Zap, Brain, Calculator, Shield, TrendingUp, Wrench, Database } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'https://construdatamaxv2-clean.onrender.com'

interface MotorInfo {
  disponivel: boolean
  descricao: string
  tamanho_kb: number
}

interface EngineStatus {
  motores: Record<string, MotorInfo>
  geradores_count: number
  leitores_count: number
  processadores_count: number
  total_motores_disponiveis: number
  total_motores: number
}

interface GeradorInfo {
  nome: string
  arquivo: string
  tamanho_kb: number
}

const MOTOR_ICONS: Record<string, React.ReactNode> = {
  construdata_sabesp_v5_FINAL: <Zap size={16} className="text-amber-400" />,
  motor_gemini: <Brain size={16} className="text-purple-400" />,
  motor_llm: <Brain size={16} className="text-blue-400" />,
  motor_ml: <Brain size={16} className="text-green-400" />,
  motor_medicao: <Calculator size={16} className="text-cyan-400" />,
  motor_custo: <TrendingUp size={16} className="text-emerald-400" />,
  motor_auditoria_v4: <Shield size={16} className="text-rose-400" />,
  motor_perdas: <BarChart3 size={16} className="text-orange-400" />,
  motor_lean_lps: <Cog size={16} className="text-indigo-400" />,
  motor_contratos: <Database size={16} className="text-teal-400" />,
  slnr_mestre_ml: <Brain size={16} className="text-violet-400" />,
  construdata_analytics: <BarChart3 size={16} className="text-sky-400" />,
}

export default function EngineV5Dashboard() {
  const [status, setStatus] = useState<EngineStatus | null>(null)
  const [geradores, setGeradores] = useState<GeradorInfo[]>([])
  const [leitores, setLeitores] = useState<GeradorInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    
    Promise.all([
      fetch(`${API}/api/engine-v5/status`, { signal: controller.signal }).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/engine-v5/listar-geradores`, { signal: controller.signal }).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/engine-v5/listar-leitores`, { signal: controller.signal }).then(r => r.json()).catch(() => null),
    ]).then(([statusData, geradoresData, leitoresData]) => {
      clearTimeout(timeout)
      if (statusData) setStatus(statusData)
      else setError('Backend offline — exibindo dados locais')
      if (geradoresData?.geradores) setGeradores(geradoresData.geradores)
      if (leitoresData?.leitores) setLeitores(leitoresData.leitores)
    }).catch(() => {
      clearTimeout(timeout)
      setError('Backend offline — exibindo dados migrados locais')
    }).finally(() => {
      setLoading(false)
    })
    
    return () => { clearTimeout(timeout); controller.abort() }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-[#2abfdc]" size={48} />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Cpu size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#e4f2f8]">Engine V5 — Motores Unificados</h1>
          <p className="text-sm text-[#5a8caa]">
            {status ? `${status.total_motores_disponiveis}/${status.total_motores} motores · ${status.geradores_count} geradores · ${status.leitores_count} leitores` : error}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Motores" value={status?.total_motores_disponiveis ?? 25} icon={<Cpu size={20} />} color="amber" />
        <StatCard label="Geradores" value={status?.geradores_count ?? 27} icon={<Cog size={20} />} color="cyan" />
        <StatCard label="Leitores" value={status?.leitores_count ?? 7} icon={<FileInput size={20} />} color="purple" />
        <StatCard label="Processadores" value={status?.processadores_count ?? 12} icon={<Wrench size={20} />} color="emerald" />
      </div>

      {/* Motores Grid */}
      <div className="bg-[#112645] border border-[#20406a] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[#e4f2f8] mb-4 flex items-center gap-2">
          <Cpu size={20} className="text-amber-400" /> Motores de Processamento
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {status && Object.entries(status.motores).map(([key, info]) => (
            <div key={key} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              info.disponivel 
                ? 'bg-[#0d2040] border-emerald-500/20 hover:border-emerald-500/40' 
                : 'bg-[#0d2040] border-[#20406a] opacity-50'
            }`}>
              {MOTOR_ICONS[key] || <Cog size={16} className="text-[#5a8caa]" />}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[#e4f2f8] truncate">{info.descricao}</div>
                <div className="text-[10px] text-[#5a8caa] font-mono">{key}.py · {info.tamanho_kb}KB</div>
              </div>
              {info.disponivel 
                ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" /> 
                : <XCircle size={14} className="text-rose-400 shrink-0" />
              }
            </div>
          ))}
        </div>
      </div>

      {/* Geradores List */}
      <div className="bg-[#112645] border border-[#20406a] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[#e4f2f8] mb-4 flex items-center gap-2">
          <Cog size={20} className="text-cyan-400" /> Geradores ({geradores.length || 27})
        </h2>
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
          {(geradores.length > 0 ? geradores : FALLBACK_GERADORES).map((g, i) => (
            <div key={i} className="flex items-center gap-2 bg-[#0d2040] border border-[#20406a] rounded-lg p-2.5">
              <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-[#e4f2f8] truncate">{g.nome.replace('gerar_', '')}</div>
                <div className="text-[9px] text-[#5a8caa]">{g.tamanho_kb}KB</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leitores List */}
      <div className="bg-[#112645] border border-[#20406a] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[#e4f2f8] mb-4 flex items-center gap-2">
          <FileInput size={20} className="text-purple-400" /> Leitores DXF/DWG/LandXML ({leitores.length || 7})
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {(leitores.length > 0 ? leitores : FALLBACK_LEITORES).map((l, i) => (
            <div key={i} className="flex items-center gap-2 bg-[#0d2040] border border-[#20406a] rounded-lg p-3">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#e4f2f8] truncate">{l.nome}</div>
                <div className="text-[10px] text-[#5a8caa]">{l.tamanho_kb}KB</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Endpoints Reference */}
      <div className="bg-[#112645] border border-[#20406a] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[#e4f2f8] mb-4">🔌 API Endpoints</h2>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          {API_ENDPOINTS.map((ep, i) => (
            <div key={i} className="flex items-center gap-2 bg-[#0d2040] rounded-lg px-3 py-2">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                ep.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}>{ep.method}</span>
              <span className="text-[#e4f2f8] truncate">{ep.path}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    amber: 'from-amber-500/10 to-amber-600/5 border-amber-500/20 text-amber-400',
    cyan: 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20 text-cyan-400',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/20 text-purple-400',
    emerald: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
  }
  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#5a8caa] uppercase">{label}</span>
        {icon}
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  )
}

// ─── Fallback data (when backend is offline) ─────────────────────────────

const FALLBACK_GERADORES = [
  { nome: 'gerar_ns', arquivo: 'gerar_ns.py', tamanho_kb: 43 },
  { nome: 'gerar_cronograma', arquivo: 'gerar_cronograma.py', tamanho_kb: 45 },
  { nome: 'gerar_cronograma_macro', arquivo: 'gerar_cronograma_macro.py', tamanho_kb: 33 },
  { nome: 'gerar_cronograma_ns', arquivo: 'gerar_cronograma_ns.py', tamanho_kb: 12 },
  { nome: 'gerar_medicao_curva_s', arquivo: 'gerar_medicao_curva_s.py', tamanho_kb: 21 },
  { nome: 'gerar_ose', arquivo: 'gerar_ose.py', tamanho_kb: 19 },
  { nome: 'gerar_cadastro_nts292', arquivo: 'gerar_cadastro_nts292.py', tamanho_kb: 25 },
  { nome: 'gerar_compras', arquivo: 'gerar_compras.py', tamanho_kb: 16 },
  { nome: 'gerar_planilha_mega', arquivo: 'gerar_planilha_mega.py', tamanho_kb: 23 },
  { nome: 'gerar_trechos_completo', arquivo: 'gerar_trechos_completo.py', tamanho_kb: 9 },
  { nome: 'gerar_trechos_recortados', arquivo: 'gerar_trechos_recortados.py', tamanho_kb: 25 },
  { nome: 'gerar_trechos_inferidos', arquivo: 'gerar_trechos_inferidos.py', tamanho_kb: 14 },
  { nome: 'gerar_trechos_mega', arquivo: 'gerar_trechos_mega.py', tamanho_kb: 22 },
  { nome: 'gerar_ifc_lod500', arquivo: 'gerar_ifc_lod500.py', tamanho_kb: 11 },
  { nome: 'gerar_xlsx', arquivo: 'gerar_xlsx.py', tamanho_kb: 32 },
  { nome: 'gerar_pdf_perdas', arquivo: 'gerar_pdf_perdas.py', tamanho_kb: 13 },
  { nome: 'gerar_civil3d', arquivo: 'gerar_civil3d.py', tamanho_kb: 13 },
  { nome: 'gerar_exemplo_ns', arquivo: 'gerar_exemplo_ns.py', tamanho_kb: 10 },
  { nome: 'gerar_estatistica_ml', arquivo: 'gerar_estatistica_ml.py', tamanho_kb: 22 },
  { nome: 'gerar_guia_ml', arquivo: 'gerar_guia_ml.py', tamanho_kb: 39 },
  { nome: 'gerar_guia_ml_p2', arquivo: 'gerar_guia_ml_p2.py', tamanho_kb: 52 },
  { nome: 'gerar_project_xml', arquivo: 'gerar_project_xml.py', tamanho_kb: 11 },
  { nome: 'gerar_apresentacao', arquivo: 'gerar_apresentacao.py', tamanho_kb: 48 },
  { nome: 'gerar_ns_v4', arquivo: 'gerar_ns_v4.py', tamanho_kb: 24 },
  { nome: 'gerar_ns_todos_nucleos', arquivo: 'gerar_ns_todos_nucleos.py', tamanho_kb: 14 },
  { nome: 'gerar_ns_sao_manuel', arquivo: 'gerar_ns_sao_manuel_joao_carlos.py', tamanho_kb: 21 },
  { nome: 'gerar_tudo_nucleos', arquivo: 'gerar_tudo_nucleos.py', tamanho_kb: 7 },
]

const FALLBACK_LEITORES = [
  { nome: 'ler_dwg_universal', arquivo: 'ler_dwg_universal.py', tamanho_kb: 29 },
  { nome: 'ler_dwg_aec', arquivo: 'ler_dwg_aec.py', tamanho_kb: 47 },
  { nome: 'LER_DWG_BIM', arquivo: 'LER_DWG_BIM.py', tamanho_kb: 8 },
  { nome: 'LER_DWG_DIRETO', arquivo: 'LER_DWG_DIRETO.py', tamanho_kb: 14 },
  { nome: 'ler_dxf_gdal', arquivo: 'ler_dxf_gdal.py', tamanho_kb: 26 },
  { nome: 'ler_dxf_prosaneamento', arquivo: 'ler_dxf_prosaneamento.py', tamanho_kb: 12 },
  { nome: 'ler_landxml', arquivo: 'ler_landxml.py', tamanho_kb: 9 },
]

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/engine-v5/status' },
  { method: 'POST', path: '/api/engine-v5/processar' },
  { method: 'GET', path: '/api/engine-v5/listar-geradores' },
  { method: 'GET', path: '/api/engine-v5/listar-leitores' },
  { method: 'POST', path: '/api/geradores/gerar-ns' },
  { method: 'POST', path: '/api/geradores/gerar-cronograma' },
  { method: 'POST', path: '/api/geradores/gerar-medicao-curva-s' },
  { method: 'POST', path: '/api/geradores/gerar-ose' },
  { method: 'POST', path: '/api/geradores/gerar-trechos' },
  { method: 'POST', path: '/api/geradores/gerar-ifc' },
  { method: 'POST', path: '/api/geradores/gerar-cadastro-nts292' },
  { method: 'POST', path: '/api/geradores/gerar-planilha-mega' },
  { method: 'POST', path: '/api/geradores/gerar-compras' },
  { method: 'GET', path: '/api/analytics/dashboard' },
  { method: 'POST', path: '/api/analytics/classificar-rede' },
  { method: 'POST', path: '/api/analytics/gemini/analisar' },
  { method: 'POST', path: '/api/analytics/llm/multi-provider' },
  { method: 'POST', path: '/api/analytics/perdas/calcular' },
  { method: 'POST', path: '/api/analytics/medicao/calcular' },
  { method: 'POST', path: '/api/analytics/lean-lps/simular' },
  { method: 'POST', path: '/api/analytics/microplanejamento' },
  { method: 'POST', path: '/api/analytics/auditoria' },
  { method: 'POST', path: '/api/analytics/custos/estimar' },
  { method: 'GET', path: '/api/analytics/contratos' },
  { method: 'POST', path: '/api/leitores/ler-dxf' },
  { method: 'POST', path: '/api/leitores/ler-dwg' },
  { method: 'POST', path: '/api/leitores/ler-landxml' },
]
