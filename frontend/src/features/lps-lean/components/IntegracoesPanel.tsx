/**
 * IntegracoesPanel — o que o LPS realmente tem ligado a ele, em NÚMEROS REAIS.
 *
 * Reescrito em 27/07/2026 (Fase 2 LPS-real): a versão anterior exibia status
 * "Conectado/Parcial", "última sincronização" e "restrições auto-baixáveis"
 * FABRICADOS no lpsStore (buildIntegrationStatuses/autoClearRestrictions —
 * removidos). Agora cada cartão é um COUNT real via Supabase:
 *   - lps_restricoes  → restrições do projeto (abertas × tratadas)
 *   - lps_tasks       → atividades semanais do LPS (semáforo/PPC)
 *   - producao_diaria → apontamentos de produção (com a data mais recente)
 * Sem Supabase ou sem linhas → estado vazio honesto com a fonte declarada.
 * Nenhum botão de "baixa automática": restrição só muda de status por ação
 * humana na aba Restrições.
 */
import { useEffect, useState } from 'react'
import { RefreshCw, Database } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLpsStore } from '@/store/lpsStore'
import { useProjectContext } from '@/store/projectContext'

interface ContagensReais {
  lpsTasks: number | null
  producaoRegistros: number | null
  producaoUltimaData: string | null
}

const CONTAGENS_VAZIAS: ContagensReais = { lpsTasks: null, producaoRegistros: null, producaoUltimaData: null }

export function IntegracoesPanel() {
  const restrictions = useLpsStore((s) => s.restrictions)
  const activeProjectId = useProjectContext((s) => s.activeProjectId)

  const [contagens, setContagens] = useState<ContagensReais>(CONTAGENS_VAZIAS)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    if (!supabase || !activeProjectId) {
      setContagens(CONTAGENS_VAZIAS)
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const [tasksRes, prodRes, prodUltimaRes] = await Promise.all([
        // Atenção ao nome da coluna: lps_tasks usa project_id (FK legada),
        // producao_diaria usa projeto_id.
        supabase.from('lps_tasks').select('id', { count: 'exact', head: true }).eq('project_id', activeProjectId),
        supabase.from('producao_diaria').select('id', { count: 'exact', head: true }).eq('projeto_id', activeProjectId),
        supabase.from('producao_diaria').select('data').eq('projeto_id', activeProjectId).order('data', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (tasksRes.error) throw tasksRes.error
      if (prodRes.error) throw prodRes.error
      setContagens({
        lpsTasks: tasksRes.count ?? 0,
        producaoRegistros: prodRes.count ?? 0,
        producaoUltimaData: prodUltimaRes.data?.data ?? null,
      })
    } catch (err: any) {
      setErro(err?.message ?? 'Erro ao contar registros no Supabase')
      setContagens(CONTAGENS_VAZIAS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId])

  const abertas = restrictions.filter((r) => r.status === 'identificada').length
  const tratadas = restrictions.length - abertas

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => void carregar()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c] disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />Recontar
        </button>
        <span className="text-[#6b6b6b] text-[9px] font-mono uppercase tracking-wider">
          COUNTS REAIS · lps_restricoes + lps_tasks + producao_diaria
        </span>
      </div>

      {!supabase && (
        <div className="rounded-xl border border-[#1e293b] bg-[#0d1420] p-4">
          <p className="text-slate-500 text-xs">
            Supabase não configurado neste ambiente — 0 contagens disponíveis. As integrações leem direto das tabelas reais.
          </p>
        </div>
      )}

      {erro && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4">
          <p className="text-red-400 text-xs">Erro ao contar: {erro}</p>
        </div>
      )}

      {/* Cartões de contagem real */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CartaoContagem
          titulo="Restrições"
          fonte="lps_restricoes"
          valorPrincipal={restrictions.length}
          detalhes={[
            { rotulo: 'ABERTAS (identificada)', valor: abertas, cor: '#ef4444' },
            { rotulo: 'TRATADAS (em resolução + resolvida)', valor: tratadas, cor: '#22c55e' },
          ]}
          vazio={restrictions.length === 0 ? 'Nenhuma restrição carregada para o projeto ativo.' : null}
        />
        <CartaoContagem
          titulo="Atividades LPS"
          fonte="lps_tasks"
          valorPrincipal={contagens.lpsTasks}
          detalhes={[]}
          vazio={contagens.lpsTasks === 0 ? '0 registros em lps_tasks para o projeto ativo.' : null}
        />
        <CartaoContagem
          titulo="Produção Diária"
          fonte="producao_diaria"
          valorPrincipal={contagens.producaoRegistros}
          detalhes={
            contagens.producaoUltimaData
              ? [{ rotulo: 'ÚLTIMO APONTAMENTO', valor: contagens.producaoUltimaData, cor: '#f59e0b' }]
              : []
          }
          vazio={contagens.producaoRegistros === 0 ? '0 registros em producao_diaria para o projeto ativo.' : null}
        />
      </div>

      {/* Info honesta */}
      <div className="rounded-xl border border-[#1e293b] bg-[#0d1420] p-4">
        <p className="text-[#6b6b6b] text-xs leading-relaxed">
          <strong className="text-[#a3a3a3]">Como funciona:</strong> estes números são contagens diretas nas tabelas do
          Supabase — nada é sintetizado. A antiga "baixa automática de restrições" foi removida por ser simulada:
          restrição só muda de status por decisão humana na aba <strong className="text-[#a3a3a3]">Restrições</strong>
          {' '}(as candidatas vindas de ocorrências/equipes aparecem lá como sugestões de promoção manual).
        </p>
      </div>
    </div>
  )
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function CartaoContagem({
  titulo,
  fonte,
  valorPrincipal,
  detalhes,
  vazio,
}: {
  titulo: string
  fonte: string
  valorPrincipal: number | null
  detalhes: Array<{ rotulo: string; valor: number | string; cor: string }>
  vazio: string | null
}) {
  return (
    <div className="bg-[#0d1420] border border-[#1e293b] rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Database size={14} className="text-[#f97316] shrink-0" />
          <h3 className="text-[#f5f5f5] text-sm font-semibold truncate">{titulo}</h3>
        </div>
        <span className="text-[9px] text-slate-600 font-mono uppercase tracking-wider shrink-0">TABELA {fonte}</span>
      </div>

      <p className="text-3xl font-bold text-white font-mono [font-variant-numeric:tabular-nums] leading-none">
        {valorPrincipal === null ? '—' : valorPrincipal}
      </p>

      {detalhes.length > 0 && (
        <div className="flex flex-col gap-1">
          {detalhes.map((d) => (
            <div key={d.rotulo} className="flex items-center justify-between gap-2 text-[10px]">
              <span className="flex items-center gap-1.5 text-[#6b6b6b] uppercase tracking-wider">
                <span className="w-2 h-2 rounded-[2px] inline-block shrink-0" style={{ backgroundColor: d.cor }} />
                {d.rotulo}
              </span>
              <span className="text-[#f5f5f5] font-mono [font-variant-numeric:tabular-nums]">{d.valor}</span>
            </div>
          ))}
        </div>
      )}

      {vazio && <p className="text-[10px] text-slate-600">{vazio}</p>}
    </div>
  )
}
