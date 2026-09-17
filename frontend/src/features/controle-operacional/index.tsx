/**
 * CONTROLE OPERACIONAL — a planilha CONTROLE OPERACIONAL SABESP rev16 como módulo.
 * Porta do app Python SAAS_CONTROLE_WCR ("a planilha como sistema").
 *
 * Cada obra (projeto ativo) é um contrato: "WCR — Bertioga", "WCR — Santos".
 * Azul é o que se digita; ƒ é calculado (dominio/calculos.ts) e nunca gravado.
 *
 * Abas por ?aba= (padrão de recursos-humanos). Sem a migration 035, mostra o aviso
 * em vez de quebrar.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ClipboardCheck, Gauge, ClipboardList, CalendarDays, Wrench, HardHat, Receipt, Wallet, NotebookPen, ListChecks,
  LineChart, Siren, Users, FileText, Target, Upload, Download, FileDown, RefreshCw, AlertTriangle,
} from 'lucide-react'
import { useProjectContext, selectActiveProjeto } from '@/store/projectContext'
import { useControleOperacional } from '@/hooks/useControleOperacional'
import { useFolhaAgregada } from '@/hooks/useFolhaAgregada'
import { montarContexto } from './dominio/calculos'
import { TELAS } from './dominio/telas'
import { hojeLocal } from './dominio/datas'
import { fonteEscolhida } from './dominio/fonteCusto'
import { TelaCrud } from './components/TelaCrud'
import { PainelOperacional } from './components/PainelOperacional'
import { PlanejadoRealizadoPanel } from './components/PlanejadoRealizadoPanel'
import { EquipePanel } from './components/EquipePanel'
import { RdoResumoPanel } from './components/RdoResumoPanel'
import { PlanoPpcPanel } from './components/PlanoPpcPanel'
import { LookaheadPanel } from './components/LookaheadPanel'
import { ResumoMedicao } from './components/ResumoMedicao'
import { excluirOcorrencia, salvarOcorrencia } from './components/gravacoesCompostas'
import { ImportarModal } from './importador/ImportarModal'
import { baixarCsvZip, baixarXlsx } from './exportador/exportarXlsx'
import { btnNeutro, btnPrimario } from './components/ui'

type Aba =
  | 'painel' | 'servicos' | 'programacao' | 'os' | 'apontamento' | 'medicao' | 'faturamento' | 'atas'
  | 'lookahead' | 'planejado' | 'ocorrencias' | 'equipe' | 'rdo' | 'plano'

const ABAS: { id: Aba; label: string; icon: typeof Gauge }[] = [
  { id: 'painel', label: 'Painel', icon: Gauge },
  { id: 'servicos', label: '03 Serviços', icon: ClipboardList },
  { id: 'programacao', label: '04 Programação', icon: CalendarDays },
  { id: 'os', label: '05 OS', icon: Wrench },
  { id: 'apontamento', label: '06 Apontamento', icon: HardHat },
  { id: 'medicao', label: '09 Medição', icon: Receipt },
  { id: 'faturamento', label: '12 Faturamento', icon: Wallet },
  { id: 'atas', label: '15 Atas', icon: NotebookPen },
  { id: 'lookahead', label: '16 Lookahead', icon: ListChecks },
  { id: 'planejado', label: '18 Planejado × Realizado', icon: LineChart },
  { id: 'ocorrencias', label: '11 Ocorrências', icon: Siren },
  { id: 'equipe', label: '08 Equipe', icon: Users },
  { id: 'rdo', label: '10 RDO', icon: FileText },
  { id: 'plano', label: '17 Plano / PPC', icon: Target },
]

function ehAba(v: string | null): v is Aba {
  return !!v && ABAS.some((a) => a.id === v)
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="m-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
      <div>{children}</div>
    </div>
  )
}

export function ControleOperacionalPage() {
  const [params, setParams] = useSearchParams()
  const aba: Aba = ehAba(params.get('aba')) ? (params.get('aba') as Aba) : 'painel'
  const projetoId = useProjectContext((s) => s.activeProjectId)
  const projeto = useProjectContext(selectActiveProjeto)
  const orgId = ((projeto as unknown as { org_id?: string | null } | null)?.org_id) ?? null
  const op = useControleOperacional(projetoId)
  const folha = useFolhaAgregada(projetoId)
  const [importar, setImportar] = useState(false)
  const [exportando, setExportando] = useState(false)

  const ctx = useMemo(() => (op.dados ? montarContexto(op.dados, folha.folha, hojeLocal()) : null), [op.dados, folha.folha])
  const avisoFonte = op.dados ? fonteEscolhida(op.dados, folha.folha).aviso : null
  const recarregar = async () => { await Promise.all([op.recarregar(), folha.recarregar()]) }

  function trocar(id: Aba) {
    const p = new URLSearchParams(params)
    p.set('aba', id)
    setParams(p, { replace: true })
  }

  const nomeObra = projeto?.nome ?? 'obra'

  return (
    <div className="flex flex-col h-full bg-[#2c2c2c]">
      <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
        <div className="px-6 py-4 flex flex-wrap items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316] shrink-0">
            <ClipboardCheck size={18} className="text-[#ffffff]" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[#f5f5f5] font-semibold text-lg leading-tight">Controle Operacional</h1>
            <p className="text-[#a3a3a3] text-xs truncate">
              {projeto ? `${projeto.nome} — cadastro → programação → OS → medição → faturamento` : 'escolha uma obra no seletor'}
            </p>
          </div>
          <button className={btnNeutro} onClick={() => void recarregar()} disabled={op.loading} title="recarregar">
            <RefreshCw size={14} className={op.loading ? 'animate-spin' : ''} />
          </button>
          <button className={btnNeutro} disabled={!ctx || exportando} onClick={() => ctx && baixarXlsx(ctx, nomeObra)}>
            <Download size={14} /> Exportar Excel
          </button>
          <button className={btnNeutro} disabled={!ctx || exportando}
            onClick={async () => { if (!ctx) return; setExportando(true); try { await baixarCsvZip(ctx, nomeObra) } finally { setExportando(false) } }}>
            <FileDown size={14} /> CSVs (.zip)
          </button>
          <button className={btnPrimario} disabled={op.tabelasAusentes || op.semSupabase} onClick={() => setImportar(true)}>
            <Upload size={14} /> Importar planilha
          </button>
        </div>
        <div className="overflow-x-auto">
          <div className="flex px-6 gap-1 min-w-max">
            {ABAS.map((a) => {
              const Icone = a.icon
              const ativa = a.id === aba
              return (
                <button key={a.id} onClick={() => trocar(a.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2 ${
                    ativa ? 'text-[#f5f5f5] border-orange-500 bg-[#3d3d3d]' : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50'}`}>
                  <Icone size={15} /> {a.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {!projetoId ? (
          <Aviso>Nenhuma obra selecionada. Escolha "WCR — Bertioga" ou "WCR — Santos" no seletor de obra.</Aviso>
        ) : op.semSupabase ? (
          <Aviso>Supabase não configurado neste ambiente — o Controle Operacional precisa do banco.</Aviso>
        ) : op.tabelasAusentes ? (
          <Aviso>
            <b>Migration 035 não aplicada.</b> As tabelas do Controle Operacional (op_*) ainda não existem neste banco.
            Cole <code>supabase/migrations/20260916_035_controle_operacional.sql</code> no SQL Editor (depois da 033 e da 034) e recarregue.
          </Aviso>
        ) : op.erro ? (
          <Aviso>Não consegui ler os dados: {op.erro}</Aviso>
        ) : !ctx ? (
          <div className="flex items-center justify-center h-64 text-[#6b6b6b] text-sm">Carregando…</div>
        ) : (
          <div className="p-6 space-y-3">
            {avisoFonte && <p className="text-xs text-amber-200">{avisoFonte}</p>}
            {aba === 'painel' && <PainelOperacional ctx={ctx} projetoId={projetoId} recarregar={recarregar} folhaIndisponivel={folha.indisponivel} />}
            {aba === 'servicos' && <TelaCrud tela={TELAS.servicos} ctx={ctx} projetoId={projetoId} recarregar={recarregar} />}
            {aba === 'programacao' && <TelaCrud tela={TELAS.programacao} ctx={ctx} projetoId={projetoId} recarregar={recarregar} />}
            {aba === 'os' && <TelaCrud tela={TELAS.os} ctx={ctx} projetoId={projetoId} recarregar={recarregar} />}
            {aba === 'apontamento' && <TelaCrud tela={TELAS.apontamento} ctx={ctx} projetoId={projetoId} recarregar={recarregar} />}
            {aba === 'medicao' && <TelaCrud tela={TELAS.medicao} ctx={ctx} projetoId={projetoId} recarregar={recarregar} topo={<ResumoMedicao ctx={ctx} />} />}
            {aba === 'faturamento' && <TelaCrud tela={TELAS.faturamento} ctx={ctx} projetoId={projetoId} recarregar={recarregar} />}
            {aba === 'atas' && <TelaCrud tela={TELAS.atas} ctx={ctx} projetoId={projetoId} recarregar={recarregar} />}
            {aba === 'lookahead' && <LookaheadPanel ctx={ctx} projetoId={projetoId} orgId={orgId} recarregar={recarregar} />}
            {aba === 'planejado' && <PlanejadoRealizadoPanel ctx={ctx} />}
            {aba === 'ocorrencias' && (
              <TelaCrud tela={TELAS.ocorrencias} ctx={ctx} projetoId={projetoId} recarregar={recarregar}
                gravar={{
                  salvar: (v, existente) => salvarOcorrencia(projetoId, orgId, v, existente?.id ?? null),
                  excluir: (l) => excluirOcorrencia(l.id),
                }} />
            )}
            {aba === 'equipe' && <EquipePanel ctx={ctx} projetoId={projetoId} recarregar={recarregar} folhaIndisponivel={folha.indisponivel} />}
            {aba === 'rdo' && <RdoResumoPanel ctx={ctx} />}
            {aba === 'plano' && <PlanoPpcPanel ctx={ctx} projetoId={projetoId} orgId={orgId} recarregar={recarregar} />}
          </div>
        )}
      </div>

      {importar && <ImportarModal onClose={(importou) => { setImportar(false); if (importou) void recarregar() }} />}
    </div>
  )
}

export default ControleOperacionalPage
