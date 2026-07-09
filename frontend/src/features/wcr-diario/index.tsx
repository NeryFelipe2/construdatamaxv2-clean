// ════════════════════════════════════════════════════════════════════════════
// Diário de Obra WCR — dados extraídos dos 9 grupos WhatsApp (28-06-2026)
// Mostra: equipes, apontamentos diários, materiais, frota própria vs fornecedores
// ════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import {
  Users, Wrench, Truck, ShoppingCart, ListChecks,
  Calendar, ChevronDown, ChevronUp, MapPin, Hammer,
  TrendingUp, AlertTriangle, FileText, Search,
  HardHat,
} from 'lucide-react'
import {
  EQUIPES_WCR, APONTAMENTOS_WCR,
  FROTA_PROPRIA_WCR, FORNECEDORES_EXTERNOS_WCR,
  FERRAMENTAS_WCR, MOTORISTAS_WCR, PEDIDOS_COMPRA_WCR,
  TOTAIS_PERIODO_WCR, LOCALIZACOES_WCR, OBSERVACOES_WCR,
  RESUMO_EXTRACAO, FROTA_RESUMO_WCR,
  datasUnicas,
} from '@/data/wcr/apontamentos'

type Tab = 'resumo' | 'equipes' | 'apontamentos' | 'equipamentos' | 'pedidos'

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'resumo', label: 'Resumo', icon: TrendingUp },
  { key: 'equipes', label: 'Equipes', icon: Users },
  { key: 'apontamentos', label: 'Apontamentos', icon: ListChecks },
  { key: 'equipamentos', label: 'Equipamentos', icon: Wrench },
  { key: 'pedidos', label: 'Pedidos', icon: ShoppingCart },
]

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent: string }) {
  return (
    <div className={`bg-slate-900/60 border border-slate-700 rounded-xl p-4 flex items-start gap-3`}>
      <div className={`p-2 rounded-lg ${accent}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase text-slate-400 font-medium tracking-wide">{label}</div>
        <div className="text-2xl font-bold text-white mt-1">{value}</div>
      </div>
    </div>
  )
}

export function WcrDiarioPage() {
  const [tab, setTab] = useState<Tab>('resumo')
  const [filtroEquipe, setFiltroEquipe] = useState<string>('')
  const [filtroData, setFiltroData] = useState<string>('')
  const [busca, setBusca] = useState<string>('')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  const datas = useMemo(() => datasUnicas(), [])

  const apontamentosFiltrados = useMemo(() => {
    return APONTAMENTOS_WCR.filter((a) => {
      if (filtroEquipe && !a.equipe.toLowerCase().includes(filtroEquipe.toLowerCase())) return false
      if (filtroData && a.data !== filtroData) return false
      if (busca) {
        const texto = `${a.rua ?? ''} ${a.servico ?? ''} ${a.lider ?? ''}`.toLowerCase()
        if (!texto.includes(busca.toLowerCase())) return false
      }
      return true
    })
  }, [filtroEquipe, filtroData, busca])

  const toggleExpand = (id: string) => {
    setExpandidos((s) => {
      const novo = new Set(s)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-orange-500/20 border border-orange-500/40">
            <FileText className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Diário de Obra WCR</h1>
            <p className="text-sm text-slate-400">{RESUMO_EXTRACAO.periodo} • {RESUMO_EXTRACAO.obra}</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Fonte: 9 grupos WhatsApp descompactados de 28/06/2026 — {RESUMO_EXTRACAO.totalApontamentos} apontamentos, {RESUMO_EXTRACAO.totalEquipes} equipes, {FROTA_RESUMO_WCR.total_maquinas_proprias} máquinas + {FROTA_RESUMO_WCR.total_caminhoes_proprios} caminhões da casa
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-700 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon
          const ativo = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                ativo
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      {tab === 'resumo' && (
        <div className="space-y-6">
          {/* Cards de totais */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard icon={Users} label="Equipes" value={EQUIPES_WCR.length} accent="bg-blue-500" />
            <StatCard icon={Truck} label="HM Instalados" value={TOTAIS_PERIODO_WCR.hidrometros_instalados_periodo} accent="bg-cyan-500" />
            <StatCard icon={TrendingUp} label="Adesões" value={TOTAIS_PERIODO_WCR.adesoes_boi_malhado} accent="bg-emerald-500" />
            <StatCard icon={Hammer} label="LE Baixadas" value={TOTAIS_PERIODO_WCR.ligacoes_esgoto_baixadas} accent="bg-purple-500" />
            <StatCard icon={MapPin} label="Sakura HM" value={TOTAIS_PERIODO_WCR.hidrometros_sakura} accent="bg-orange-500" />
          </div>

          {/* Localizações */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-400" />
                Localizações
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Canteiro principal:</span>
                  <span className="text-slate-200">{LOCALIZACOES_WCR.canteiro_principal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sakura:</span>
                  <span className="text-slate-200">{LOCALIZACOES_WCR.sakura}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                Observações Gerais
              </h3>
              <ul className="space-y-1.5 text-sm text-slate-300">
                {OBSERVACOES_WCR.map((o, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-orange-400 mt-1">▸</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Resumo por equipe */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              Equipes em Campo
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {EQUIPES_WCR.map((eq) => (
                <div key={eq.nome} className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-white">{eq.nome}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${
                      eq.tipo === 'esgoto' ? 'bg-purple-500/20 text-purple-300' :
                      eq.tipo === 'agua' ? 'bg-cyan-500/20 text-cyan-300' :
                      'bg-slate-500/20 text-slate-300'
                    }`}>{eq.tipo}</span>
                  </div>
                  <div className="text-xs text-slate-400">Líder: <span className="text-slate-200">{eq.lider}</span></div>
                  <div className="text-xs text-slate-400 mt-1">
                    {eq.membros.length} membros
                  </div>
                  {eq.maquina && (
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      {eq.maquina}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'equipes' && (
        <div className="grid lg:grid-cols-2 gap-4">
          {EQUIPES_WCR.map((eq) => (
            <div key={eq.nome} className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-white">{eq.nome}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Líder: <span className="text-orange-300">{eq.lider}</span></p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium uppercase ${
                  eq.tipo === 'esgoto' ? 'bg-purple-500/20 text-purple-300' :
                  eq.tipo === 'agua' ? 'bg-cyan-500/20 text-cyan-300' :
                  'bg-slate-500/20 text-slate-300'
                }`}>{eq.tipo}</span>
              </div>

              {eq.maquina && (
                <div className="mb-3 text-xs text-slate-300 bg-slate-800/40 rounded p-2 flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-orange-400" />
                  <span><span className="text-slate-400">Máquina:</span> {eq.maquina}</span>
                </div>
              )}

              <div className="space-y-1.5">
                {Object.entries(eq.funcoes).map(([nome, funcao]) => (
                  <div key={nome} className="flex items-center justify-between text-xs">
                    <span className="text-slate-200">{nome}</span>
                    <span className="text-slate-500">{funcao}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'apontamentos' && (
        <div>
          {/* Filtros */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 mb-4 flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por rua, serviço ou líder..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
              />
            </div>
            <select
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
            >
              <option value="">Todas as datas ({datas.length})</option>
              {datas.map((d) => (
                <option key={d} value={d}>{new Date(d).toLocaleDateString('pt-BR')}</option>
              ))}
            </select>
            <select
              value={filtroEquipe}
              onChange={(e) => setFiltroEquipe(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
            >
              <option value="">Todas as equipes</option>
              {EQUIPES_WCR.map((eq) => (
                <option key={eq.nome} value={eq.nome}>{eq.nome}</option>
              ))}
            </select>
            <div className="flex items-center text-xs text-slate-400">
              <ListChecks className="w-4 h-4 mr-1.5" />
              {apontamentosFiltrados.length} de {APONTAMENTOS_WCR.length}
            </div>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {apontamentosFiltrados.map((ap, idx) => {
              const id = `${ap.data}-${idx}`
              const expandido = expandidos.has(id)
              return (
                <div key={id} className="bg-slate-900/60 border border-slate-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleExpand(id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors text-left"
                  >
                    <div className="text-xs font-mono text-slate-500 w-20 flex-shrink-0">
                      {new Date(ap.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-orange-300 font-medium">{ap.equipe}</span>
                        {ap.lider && <span className="text-slate-500">• {ap.lider}</span>}
                        {ap.nucleo && <span className="text-slate-500">• {ap.nucleo}</span>}
                      </div>
                      <div className="text-sm text-slate-300 mt-0.5 truncate">
                        {ap.rua ? `${ap.rua} — ` : ''}{ap.servico}
                      </div>
                    </div>
                    {expandido ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {expandido && (
                    <div className="border-t border-slate-700 p-4 bg-slate-950/40 space-y-2 text-xs">
                      {ap.rua && (
                        <div className="flex gap-2"><span className="text-slate-500 w-24 flex-shrink-0">Rua:</span><span className="text-slate-200">{ap.rua}</span></div>
                      )}
                      <div className="flex gap-2"><span className="text-slate-500 w-24 flex-shrink-0">Serviço:</span><span className="text-slate-200">{ap.servico}</span></div>
                      {ap.maquina && (
                        <div className="flex gap-2"><span className="text-slate-500 w-24 flex-shrink-0">Máquina:</span><span className="text-slate-200">{ap.maquina}</span></div>
                      )}
                      {ap.metragem_m && (
                        <div className="flex gap-2"><span className="text-slate-500 w-24 flex-shrink-0">Metragem:</span><span className="text-slate-200">{ap.metragem_m} m</span></div>
                      )}
                      {ap.materiais && Object.keys(ap.materiais).length > 0 && (
                        <div className="flex gap-2 items-start">
                          <span className="text-slate-500 w-24 flex-shrink-0">Materiais:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(ap.materiais).map(([k, v]) => (
                              <span key={k} className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded text-[11px]">
                                {k}: {v}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {ap.casas && ap.casas.length > 0 && (
                        <div className="flex gap-2 items-start">
                          <span className="text-slate-500 w-24 flex-shrink-0">Casas:</span>
                          <span className="text-slate-200">{ap.casas.join(', ')}</span>
                        </div>
                      )}
                      {ap.observacoes && (
                        <div className="flex gap-2"><span className="text-slate-500 w-24 flex-shrink-0">Obs:</span><span className="text-slate-300 italic">{ap.observacoes}</span></div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'equipamentos' && (
        <div className="space-y-4">
          {/* Resumo rápido */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-center">
              <HardHat className="w-5 h-5 text-orange-400 mx-auto mb-1" />
              <div className="text-2xl font-bold text-white">{FROTA_RESUMO_WCR.total_maquinas_proprias}</div>
              <div className="text-xs text-slate-400">Máquinas próprias</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-center">
              <Truck className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
              <div className="text-2xl font-bold text-white">{FROTA_RESUMO_WCR.total_caminhoes_proprios}</div>
              <div className="text-xs text-slate-400">Caminhões próprios</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-center">
              <Truck className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
              <div className="text-2xl font-bold text-white">{FROTA_RESUMO_WCR.total_fornecedores_externos}</div>
              <div className="text-xs text-slate-400">Veíc. fornecedores</div>
            </div>
          </div>

          {/* Máquinas próprias */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <HardHat className="w-4 h-4 text-orange-400" />
              Máquinas da Frota Própria ({FROTA_PROPRIA_WCR.maquinas.length})
            </h3>
            <div className="space-y-2">
              {FROTA_PROPRIA_WCR.maquinas.map((m, i) => (
                <div key={i} className="bg-slate-800/40 rounded p-3 text-xs flex items-start gap-3">
                  <span className="px-2 py-1 bg-orange-500/10 text-orange-300 rounded text-[10px] font-medium uppercase flex-shrink-0 mt-0.5">
                    {m.tipo}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-200 font-medium">
                      {m.modelo || '—'}
                      {m.placa && <span className="ml-2 text-slate-400 font-mono">{m.placa}</span>}
                    </div>
                    {m.operador && <div className="text-slate-400">Operador: {m.operador}</div>}
                    {m.equipes_usam.length > 0 && (
                      <div className="text-slate-500 mt-1">Equipes: {m.equipes_usam.join(', ')}</div>
                    )}
                    {m.observacao && <div className="text-slate-500 italic mt-1">{m.observacao}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Caminhões próprios */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Truck className="w-4 h-4 text-cyan-400" />
              Caminhões da Frota Própria ({FROTA_PROPRIA_WCR.caminhoes.length})
            </h3>
            <div className="space-y-2">
              {FROTA_PROPRIA_WCR.caminhoes.map((c, i) => (
                <div key={i} className="bg-slate-800/40 rounded p-3 text-xs flex items-start gap-3">
                  <span className="px-2 py-1 bg-cyan-500/10 text-cyan-300 rounded text-[10px] font-medium uppercase flex-shrink-0 mt-0.5">
                    {c.tipo}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-200 font-medium">
                      {c.placa && <span className="font-mono mr-2">{c.placa}</span>}
                      {c.modelo && <span className="text-slate-400">{c.modelo}</span>}
                    </div>
                    {c.motoristas.length > 0 && (
                      <div className="text-slate-400">Motoristas: {c.motoristas.join(', ')}</div>
                    )}
                    {c.equipes_usam.length > 0 && (
                      <div className="text-slate-500">Equipes: {c.equipes_usam.join(', ')}</div>
                    )}
                    {c.observacao && <div className="text-slate-500 italic mt-1">{c.observacao}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fornecedores externos */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              Veículos de Fornecedores Externos ({FROTA_RESUMO_WCR.total_fornecedores_externos})
            </h3>
            <div className="space-y-3">
              {FORNECEDORES_EXTERNOS_WCR.map((f, i) => (
                <div key={i} className="bg-slate-800/40 rounded p-3">
                  <div className="text-xs font-semibold text-yellow-300 mb-2">
                    {f.fornecedor} — <span className="text-slate-400 font-normal">{f.servico}</span>
                  </div>
                  <div className="space-y-1.5">
                    {f.veiculos.map((v, j) => (
                      <div key={j} className="flex items-center gap-3 text-xs">
                        <span className="px-2 py-0.5 bg-slate-700 rounded text-slate-300 font-mono">{v.placa}</span>
                        <span className="text-slate-400">{v.motorista || '—'}</span>
                        {v.km && <span className="text-slate-500 ml-auto">{v.km.toLocaleString('pt-BR')} km</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Motoristas */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Motoristas da Casa ({MOTORISTAS_WCR.length})
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {MOTORISTAS_WCR.map((m, i) => (
                <div key={i} className="bg-slate-800/60 rounded p-3 text-xs">
                  <div className="text-slate-200 font-medium">{m.nome}</div>
                  <div className="text-slate-400">{m.funcao}</div>
                  {m.veiculo && <div className="text-slate-500 text-[11px] mt-0.5">Veículo: {m.veiculo}</div>}
                  {m.observacao && <div className="text-slate-500 mt-1 italic">{m.observacao}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Ferramentas */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-slate-400" />
              Ferramentas e Equipamentos ({FERRAMENTAS_WCR.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {FERRAMENTAS_WCR.map((f, i) => (
                <div key={i} className="bg-slate-800/60 rounded px-3 py-2 text-xs">
                  <div className="text-slate-200">{f.nome}</div>
                  {f.observacao && <div className="text-slate-500 text-[11px]">{f.observacao}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'pedidos' && (
        <div className="space-y-3">
          {PEDIDOS_COMPRA_WCR.map((p, i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-sm font-semibold text-white">{p.material}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {new Date(p.data).toLocaleDateString('pt-BR')} • Solicitado por <span className="text-orange-300">{p.quem_pediu}</span>
                  </div>
                </div>
                {p.valor_total && (
                  <div className="text-lg font-bold text-emerald-400">R$ {p.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                )}
                {p.valor && typeof p.valor === 'number' && (
                  <div className="text-lg font-bold text-emerald-400">R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                )}
              </div>
              {p.fornecedor && (
                <div className="text-xs text-slate-300">Fornecedor: <span className="text-slate-200">{p.fornecedor}</span></div>
              )}
              {p.cnpj && <div className="text-xs text-slate-500">CNPJ: {p.cnpj}</div>}
              {p.observacao && <div className="text-xs text-slate-400 mt-1">{p.observacao}</div>}
              {p.descricao && <div className="text-xs text-slate-400 mt-1">{p.descricao}</div>}
              {p.status && (
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-300 border border-yellow-500/30">
                  {p.status}
                </span>
              )}
              {p.urgencia && (
                <span className="inline-block mt-2 ml-2 text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/30">
                  {p.urgencia}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default WcrDiarioPage