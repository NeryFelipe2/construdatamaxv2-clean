/**
 * ViabilidadeContratoView — "Estudo de Viabilidade" (planilha Viabilidade CT9618 +
 * RESULTADO do Botelhos): receita contratual x custos estimados (Materiais, MO+encargos,
 * Equipamentos, CI, Subempreiteiros) x BDI/impostos -> margem projetada. Quando o projeto
 * tem `lancamentos_financeiros` DESPESA, mostra lado a lado com o custo real acumulado
 * ("a viabilidade encontra a execução"). Real (fora do pipeline mock).
 */
import { useMemo, useState } from 'react'
import { Calculator, Plus, Trash2, Upload, Save, AlertTriangle } from 'lucide-react'
import { useProjectContext, selectActiveProjeto } from '@/store/projectContext'
import { useAppModeStore } from '@/store/appModeStore'
import { useSupabaseDre } from '@/lib/useSupabaseDre'
import { useViabilidade } from '@/hooks/useViabilidade'
import {
  computeViabilidade,
  type ViabilidadeEstudo,
  type ViabilidadeGrupoCusto,
} from '../utils/computeViabilidade'
import { ImportarCsvViabilidadeModal } from './ImportarCsvViabilidadeModal'

const GRUPOS: ViabilidadeGrupoCusto['grupo'][] = ['Materiais', 'Mão de Obra', 'Equipamentos', 'CI', 'Subempreiteiros']

function novoEstudoVazio(receitaDefault: number): ViabilidadeEstudo {
  return {
    nome: 'Novo estudo de viabilidade',
    receitaContratual: receitaDefault,
    grupos: GRUPOS.map((g) => ({ grupo: g, percEncargos: g === 'Mão de Obra' ? 80 : 0, linhas: [] })),
    bdi: { adminCentral: 4, iss: 5, pisCofins: 3.65, seguro: 0.8, lucro: 8 },
  }
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}
function fmtPct(v: number) {
  return `${v.toFixed(2)}%`
}

export function ViabilidadeContratoView() {
  const { activeProjectId } = useProjectContext()
  const projetoAtivo = useProjectContext(selectActiveProjeto)
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)
  const { estudos, loading, salvarEstudo, excluirEstudo } = useViabilidade(activeProjectId)
  const { lancamentos } = useSupabaseDre(activeProjectId)

  const [estudoIdSelecionado, setEstudoIdSelecionado] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<ViabilidadeEstudo | null>(null)
  const [showCsv, setShowCsv] = useState(false)
  const [saving, setSaving] = useState(false)

  const podeEditar = !!activeProjectId && !isDemoMode

  const estudoAtivo = rascunho ?? (estudoIdSelecionado ? estudos.find((e) => e.id === estudoIdSelecionado)?.payload ?? null : null)

  const custoRealAcumulado = useMemo(
    () => lancamentos.filter((l) => l.tipo === 'DESPESA').reduce((acc, l) => acc + Number(l.valor), 0),
    [lancamentos],
  )

  const resultado = estudoAtivo ? computeViabilidade(estudoAtivo) : null

  function iniciarNovoEstudo() {
    const receitaDefault = Number((projetoAtivo as any)?.orcamento_total) || 0
    setRascunho(novoEstudoVazio(receitaDefault))
    setEstudoIdSelecionado(null)
  }

  function abrirEstudo(id: string) {
    const e = estudos.find((x) => x.id === id)
    if (!e) return
    setEstudoIdSelecionado(id)
    setRascunho(JSON.parse(JSON.stringify(e.payload)))
  }

  function atualizarRascunho(patch: Partial<ViabilidadeEstudo>) {
    setRascunho((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  function atualizarGrupo(grupoIdx: number, patch: Partial<ViabilidadeGrupoCusto>) {
    setRascunho((prev) => {
      if (!prev) return prev
      const grupos = prev.grupos.map((g, i) => (i === grupoIdx ? { ...g, ...patch } : g))
      return { ...prev, grupos }
    })
  }

  function addLinha(grupoIdx: number) {
    setRascunho((prev) => {
      if (!prev) return prev
      const grupos = prev.grupos.map((g, i) => i === grupoIdx ? { ...g, linhas: [...g.linhas, { descricao: '', valor: 0 }] } : g)
      return { ...prev, grupos }
    })
  }

  function updateLinha(grupoIdx: number, linhaIdx: number, patch: Partial<{ descricao: string; valor: number }>) {
    setRascunho((prev) => {
      if (!prev) return prev
      const grupos = prev.grupos.map((g, i) => {
        if (i !== grupoIdx) return g
        const linhas = g.linhas.map((l, j) => (j === linhaIdx ? { ...l, ...patch } : l))
        return { ...g, linhas }
      })
      return { ...prev, grupos }
    })
  }

  function removeLinha(grupoIdx: number, linhaIdx: number) {
    setRascunho((prev) => {
      if (!prev) return prev
      const grupos = prev.grupos.map((g, i) => i === grupoIdx ? { ...g, linhas: g.linhas.filter((_, j) => j !== linhaIdx) } : g)
      return { ...prev, grupos }
    })
  }

  function importarLinhasCsv(rows: { grupo: ViabilidadeGrupoCusto['grupo']; descricao: string; valor: number }[]) {
    setRascunho((prev) => {
      if (!prev) return prev
      const grupos = prev.grupos.map((g) => {
        const novas = rows.filter((r) => r.grupo === g.grupo).map((r) => ({ descricao: r.descricao, valor: r.valor }))
        return novas.length > 0 ? { ...g, linhas: [...g.linhas, ...novas] } : g
      })
      return { ...prev, grupos }
    })
    setShowCsv(false)
  }

  async function handleSalvar() {
    if (!rascunho) return
    setSaving(true)
    try {
      const id = await salvarEstudo(rascunho, estudoIdSelecionado ?? undefined)
      if (id) setEstudoIdSelecionado(id)
    } finally {
      setSaving(false)
    }
  }

  async function handleExcluir(id: string) {
    await excluirEstudo(id)
    if (estudoIdSelecionado === id) { setEstudoIdSelecionado(null); setRascunho(null) }
  }

  return (
    <div className="flex flex-col gap-5">
      {!activeProjectId && (
        <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-200/90 leading-relaxed">Selecione um projeto ativo para cadastrar um estudo de viabilidade.</span>
        </div>
      )}
      {isDemoMode && (
        <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-200/90 leading-relaxed">Desative o <b>Modo Demonstração</b> para cadastrar/editar estudos reais.</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator size={16} className="text-[#f97316]" />
          <h2 className="text-sm font-bold text-[#f5f5f5] uppercase tracking-wider">Estudo de Viabilidade do Contrato</h2>
        </div>
        <button
          onClick={iniciarNovoEstudo}
          disabled={!podeEditar}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316]/10 text-[#f97316] rounded-lg text-xs font-semibold hover:bg-[#f97316]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={12} /> Novo estudo
        </button>
      </div>

      {/* Lista de estudos salvos */}
      {estudos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {estudos.map((e) => (
            <button
              key={e.id}
              onClick={() => abrirEstudo(e.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                estudoIdSelecionado === e.id ? 'border-[#f97316] text-[#f97316] bg-[#f97316]/10' : 'border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5]'
              }`}
            >
              {e.nome}
              <span onClick={(ev) => { ev.stopPropagation(); void handleExcluir(e.id) }} className="text-[#6b6b6b] hover:text-rose-400">
                <Trash2 size={11} />
              </span>
            </button>
          ))}
        </div>
      )}

      {!estudoAtivo && estudos.length === 0 && !loading && (
        <div className="bg-[#171717] border border-[#525252] rounded-xl px-5 py-10 text-center">
          <p className="text-sm text-[#a3a3a3]">Nenhum estudo de viabilidade cadastrado para esta obra.</p>
          <p className="text-xs text-[#6b6b6b] mt-1">Nada aqui é estimado ou de exemplo. Clique em <b className="text-[#f97316]">Novo estudo</b> para começar.</p>
        </div>
      )}

      {estudoAtivo && resultado && (
        <div className="flex flex-col gap-5">
          {/* Cadastro */}
          <div className="bg-[#171717] border border-[#525252] rounded-xl p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-[#6b6b6b] uppercase font-bold">Nome do estudo</span>
                <input
                  type="text"
                  value={estudoAtivo.nome}
                  disabled={!podeEditar}
                  onChange={(e) => atualizarRascunho({ nome: e.target.value })}
                  className="bg-[#111] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]/60"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-[#6b6b6b] uppercase font-bold">Receita contratual (R$)</span>
                <input
                  type="number"
                  value={estudoAtivo.receitaContratual}
                  disabled={!podeEditar}
                  onChange={(e) => atualizarRascunho({ receitaContratual: Number(e.target.value) || 0 })}
                  className="bg-[#111] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]/60"
                />
              </label>
            </div>

            {/* BDI */}
            <div>
              <p className="text-[10px] text-[#6b6b6b] uppercase font-bold mb-2">BDI / Impostos (%)</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {([
                  ['adminCentral', 'Adm. Central'],
                  ['iss', 'ISS'],
                  ['pisCofins', 'PIS/COFINS'],
                  ['seguro', 'Seguro/Garantia'],
                  ['lucro', 'Lucro'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-[10px] text-[#6b6b6b]">{label}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={estudoAtivo.bdi[key]}
                      disabled={!podeEditar}
                      onChange={(e) => atualizarRascunho({ bdi: { ...estudoAtivo.bdi, [key]: Number(e.target.value) || 0 } })}
                      className="bg-[#111] border border-[#525252] rounded-lg px-2 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Grupos de custo */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[#a3a3a3] uppercase tracking-wider">Grupos de Custo Estimado</p>
            <button
              onClick={() => setShowCsv(true)}
              disabled={!podeEditar}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs font-semibold hover:bg-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload size={12} /> Importar CSV
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {estudoAtivo.grupos.map((g, gi) => {
              const totalG = resultado.porGrupo[gi]?.total ?? 0
              return (
                <div key={g.grupo} className="bg-[#171717] border border-[#525252] rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#525252] flex items-center justify-between">
                    <span className="text-xs font-bold text-[#f5f5f5]">{g.grupo}</span>
                    <span className="text-xs font-mono text-[#f97316]">{fmt(totalG)}</span>
                  </div>
                  {g.grupo === 'Mão de Obra' && (
                    <div className="px-4 py-2 border-b border-[#525252]/50 flex items-center gap-2">
                      <span className="text-[10px] text-[#6b6b6b]">% Encargos</span>
                      <input
                        type="number"
                        value={g.percEncargos ?? 0}
                        disabled={!podeEditar}
                        onChange={(e) => atualizarGrupo(gi, { percEncargos: Number(e.target.value) || 0 })}
                        className="w-20 bg-[#111] border border-[#525252] rounded px-2 py-1 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60"
                      />
                    </div>
                  )}
                  <div className="divide-y divide-[#525252]/40">
                    {g.linhas.map((l, li) => (
                      <div key={li} className="flex items-center gap-2 px-4 py-2">
                        <input
                          type="text"
                          placeholder="Descrição"
                          value={l.descricao}
                          disabled={!podeEditar}
                          onChange={(e) => updateLinha(gi, li, { descricao: e.target.value })}
                          className="flex-1 bg-transparent text-xs text-[#f5f5f5] outline-none border-b border-transparent focus:border-[#f97316]/50"
                        />
                        <input
                          type="number"
                          placeholder="0"
                          value={l.valor}
                          disabled={!podeEditar}
                          onChange={(e) => updateLinha(gi, li, { valor: Number(e.target.value) || 0 })}
                          className="w-28 bg-transparent text-xs text-right text-[#f5f5f5] outline-none border-b border-transparent focus:border-[#f97316]/50 font-mono"
                        />
                        <button onClick={() => removeLinha(gi, li)} disabled={!podeEditar} className="text-[#6b6b6b] hover:text-rose-400 disabled:opacity-30">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {g.linhas.length === 0 && (
                      <div className="px-4 py-3 text-[10px] text-[#6b6b6b] text-center">Sem linhas — adicione abaixo ou importe CSV.</div>
                    )}
                  </div>
                  <button
                    onClick={() => addLinha(gi)}
                    disabled={!podeEditar}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-[10px] text-[#f97316] hover:bg-[#f97316]/5 transition-colors disabled:opacity-30"
                  >
                    <Plus size={11} /> Adicionar linha
                  </button>
                </div>
              )
            })}
          </div>

          {/* Saída calculada */}
          <div className="bg-[#171717] border border-[#525252] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#525252]">
              <p className="text-xs font-bold text-[#f97316] uppercase tracking-wider">Resultado — Margem Projetada</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5">
              <div>
                <div className="text-[10px] text-[#6b6b6b] uppercase">Custo Direto Total</div>
                <div className="text-lg font-bold text-[#f5f5f5] font-mono">{fmt(resultado.custoDiretoTotal)}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#6b6b6b] uppercase">Custo + BDI ({fmtPct(resultado.percBDI)})</div>
                <div className="text-lg font-bold text-[#f5f5f5] font-mono">{fmt(resultado.custoComBDI)}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#6b6b6b] uppercase">Margem Projetada (R$)</div>
                <div className={`text-lg font-bold font-mono ${resultado.margemProjetadaValor >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(resultado.margemProjetadaValor)}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#6b6b6b] uppercase">Margem Projetada (%)</div>
                <div className={`text-lg font-bold font-mono ${resultado.margemProjetadaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtPct(resultado.margemProjetadaPct)}</div>
              </div>
            </div>

            {/* Viabilidade x execução */}
            {custoRealAcumulado > 0 && (
              <div className="px-5 pb-5">
                <div className="border-t border-[#525252] pt-4">
                  <p className="text-[10px] text-[#6b6b6b] uppercase font-bold mb-3">Estimado x Real (a viabilidade encontra a execução)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] border border-[#525252] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-[#6b6b6b] uppercase">Custo Estimado (com BDI)</div>
                      <div className="text-base font-bold text-[#f5f5f5] font-mono">{fmt(resultado.custoComBDI)}</div>
                    </div>
                    <div className="bg-[#111] border border-[#525252] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-[#6b6b6b] uppercase">Custo Real Acumulado (DESPESA)</div>
                      <div className="text-base font-bold text-cyan-400 font-mono">{fmt(custoRealAcumulado)}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-center text-xs">
                    <span className={custoRealAcumulado <= resultado.custoComBDI ? 'text-emerald-400' : 'text-rose-400'}>
                      {custoRealAcumulado <= resultado.custoComBDI
                        ? `Real ${fmt(resultado.custoComBDI - custoRealAcumulado)} abaixo do estimado`
                        : `Real ${fmt(custoRealAcumulado - resultado.custoComBDI)} acima do estimado`}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSalvar}
              disabled={!podeEditar || saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-[#0a1628] hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={13} /> {saving ? 'Salvando...' : 'Salvar estudo'}
            </button>
          </div>
        </div>
      )}

      {showCsv && <ImportarCsvViabilidadeModal onClose={() => setShowCsv(false)} onImport={importarLinhasCsv} />}
    </div>
  )
}
