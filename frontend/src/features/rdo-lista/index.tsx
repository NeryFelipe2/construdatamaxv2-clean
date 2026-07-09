import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface RdoRow {
  id: string
  projeto_id: string
  data: string
  clima: string | null
  producao_m: number | null
  equipe_number: number | null
  observacoes: string | null
  apontador: string | null
  custo_diesel: number | null
  custo_alimentacao: number | null
  custo_mao_obra: number | null
  custo_materiais: number | null
  fotos: string[] | null
  status: string | null
  created_at: string
}

interface ProjetoRow {
  id: string
  nome: string
}

const fmtBR = (n: number | null | undefined) =>
  n == null ? '-' : `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ID_BOI = 'wcr-boi-malhado'
const ID_SAKURA = 'wcr-sakura'
const ID_RETORNO = 'wcr-retorno'

const DEMO_PROJETOS: ProjetoRow[] = [
  { id: ID_BOI, nome: 'WCR — Boi Malhado' },
  { id: ID_SAKURA, nome: 'WCR — Sakura' },
  { id: ID_RETORNO, nome: 'WCR — Comunidade do Retorno' },
]

const DEMO_RDOS: RdoRow[] = [
  {
    id: 'demo-rdo-1',
    projeto_id: ID_BOI,
    data: '2026-07-02',
    clima: 'ensolarado',
    producao_m: 32,
    equipe_number: 7,
    observacoes: 'Escavação e assentamento de rede de esgoto na Rua Israel. Sem pendências.',
    apontador: 'Zé Claudino',
    custo_diesel: 320,
    custo_alimentacao: 140,
    custo_mao_obra: 1800,
    custo_materiais: 950,
    fotos: [],
    status: 'fechado',
    created_at: '2026-07-02T18:30:00Z',
  },
  {
    id: 'demo-rdo-2',
    projeto_id: ID_SAKURA,
    data: '2026-07-02',
    clima: 'nublado',
    producao_m: 24,
    equipe_number: 5,
    observacoes: 'Assentamento de rede de água na frente Jesse. Aguardando liberação de material.',
    apontador: 'Robert Vieira',
    custo_diesel: 260,
    custo_alimentacao: 120,
    custo_mao_obra: 1500,
    custo_materiais: 0,
    fotos: [],
    status: 'aberto',
    created_at: '2026-07-02T17:10:00Z',
  },
  {
    id: 'demo-rdo-3',
    projeto_id: ID_RETORNO,
    data: '2026-07-01',
    clima: 'chuvoso',
    producao_m: 12,
    equipe_number: 6,
    observacoes: 'Trabalho parcial na EEE devido à chuva à tarde.',
    apontador: 'Jailton',
    custo_diesel: 180,
    custo_alimentacao: 130,
    custo_mao_obra: 1400,
    custo_materiais: 400,
    fotos: [],
    status: 'aberto',
    created_at: '2026-07-01T19:00:00Z',
  },
]

export function RdoListaPage() {
  const [rdos, setRdos] = useState<RdoRow[]>([])
  const [projetos, setProjetos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filtroProj, setFiltroProj] = useState<string>('')

  const carregarDemo = () => {
    setRdos(DEMO_RDOS)
    const map: Record<string, string> = {}
    for (const p of DEMO_PROJETOS) map[p.id] = p.nome
    setProjetos(map)
    setErr(null)
    setLoading(false)
  }

  const carregar = async () => {
    if (!supabase) {
      carregarDemo()
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const [rdoRes, projRes] = await Promise.all([
        supabase
          .from('rdos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('projetos').select('id,nome'),
      ])
      if (rdoRes.error) throw rdoRes.error
      if (projRes.error) throw projRes.error
      setRdos((rdoRes.data || []) as RdoRow[])
      const map: Record<string, string> = {}
      for (const p of (projRes.data || []) as ProjetoRow[]) map[p.id] = p.nome
      setProjetos(map)
    } catch {
      carregarDemo()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
    // Auto-refresh a cada 30s (sem realtime subscription pra evitar complexidade)
    const t = setInterval(carregar, 30000)
    return () => clearInterval(t)
  }, [])

  const filtrados = filtroProj
    ? rdos.filter((r) => r.projeto_id === filtroProj)
    : rdos

  return (
    <div className="p-6 min-h-screen bg-[#0b1628] text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">RDOs Recebidos via WhatsApp</h1>
          <p className="text-sm text-gray-400">
            Atualização automática a cada 30s · Últimos 100 registros
          </p>
        </div>
        <button
          onClick={carregar}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
        >
          🔄 Atualizar agora
        </button>
      </div>

      {/* Filtro por projeto */}
      <div className="mb-4 flex gap-2 flex-wrap">
        <button
          onClick={() => setFiltroProj('')}
          className={`px-3 py-1 rounded text-xs ${
            filtroProj === '' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          Todos ({rdos.length})
        </button>
        {Object.entries(projetos).map(([id, nome]) => {
          const count = rdos.filter((r) => r.projeto_id === id).length
          return (
            <button
              key={id}
              onClick={() => setFiltroProj(id)}
              className={`px-3 py-1 rounded text-xs ${
                filtroProj === id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {nome} ({count})
            </button>
          )
        })}
      </div>

      {loading && <div className="text-gray-400">Carregando...</div>}
      {err && (
        <div className="p-4 bg-red-900/40 border border-red-700 rounded text-sm mb-4">
          ❌ {err}
        </div>
      )}

      {!loading && filtrados.length === 0 && !err && (
        <div className="p-8 text-center text-gray-400 border border-gray-700 rounded">
          Nenhum RDO recebido ainda. Dispare um <code>@rdo &lt;projeto&gt;</code> no WhatsApp.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtrados.map((r) => {
          const custoTotal =
            (r.custo_diesel || 0) +
            (r.custo_alimentacao || 0) +
            (r.custo_mao_obra || 0) +
            (r.custo_materiais || 0)
          return (
            <div
              key={r.id}
              className="p-4 bg-[#13223e] rounded border border-gray-700 hover:border-blue-500 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-semibold text-blue-300">
                    {projetos[r.projeto_id] || '(projeto desconhecido)'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(r.data).toLocaleDateString('pt-BR')} ·{' '}
                    {r.apontador || '-'}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    r.status === 'aberto'
                      ? 'bg-yellow-900 text-yellow-300'
                      : 'bg-green-900 text-green-300'
                  }`}
                >
                  {r.status || '-'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <span className="text-gray-400">Produção:</span>{' '}
                  <span className="font-semibold">{r.producao_m ?? 0}m</span>
                </div>
                <div>
                  <span className="text-gray-400">Equipe:</span>{' '}
                  <span className="font-semibold">{r.equipe_number ?? 0}</span>
                </div>
                <div>
                  <span className="text-gray-400">Clima:</span>{' '}
                  <span>{r.clima || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Fotos:</span>{' '}
                  <span>{(r.fotos || []).length}</span>
                </div>
              </div>

              {custoTotal > 0 && (
                <div className="border-t border-gray-700 pt-2 mb-2">
                  <div className="text-xs text-gray-400 mb-1">Custos do dia:</div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div>Diesel: {fmtBR(r.custo_diesel)}</div>
                    <div>Alim/Hotel: {fmtBR(r.custo_alimentacao)}</div>
                    <div>MO: {fmtBR(r.custo_mao_obra)}</div>
                    <div>Materiais: {fmtBR(r.custo_materiais)}</div>
                  </div>
                  <div className="text-right font-semibold text-red-400 mt-1">
                    Total: {fmtBR(custoTotal)}
                  </div>
                </div>
              )}

              {r.observacoes && (
                <div className="text-xs text-gray-300 border-t border-gray-700 pt-2 mt-2">
                  <span className="text-gray-400">Obs:</span>{' '}
                  {r.observacoes.slice(0, 200)}
                  {r.observacoes.length > 200 && '...'}
                </div>
              )}

              <div className="text-[10px] text-gray-500 mt-2">
                Recebido: {new Date(r.created_at).toLocaleString('pt-BR')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
