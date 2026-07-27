/**
 * Programação da Semana — kanban EDITÁVEL do "previsto" da operação
 * (`programacao_semana`), com REALIZADO ao vivo por linha (Fase 3, 27/07).
 *
 * Uma coluna por FRENTE, um card por linha equipe×serviço com:
 *  - meta (meta_qtd/meta_unidade) editável inline + criação + exclusão c/ confirm;
 *  - REALIZADO: soma de producao_diaria na janela semana_ini→semana_fim, casada
 *    por equipe via norm (equipe_aliases + wcr_equipes, view vw_producao_equipe
 *    com rateio) e por serviço→coluna (ver colunasDaMeta no hook). Serviço sem
 *    coluna correspondente mostra "—" com tooltip — nunca zero fabricado;
 *  - badge COMPROMISSO quando existe lps_tasks comprometida na mesma semana ISO
 *    casando com a equipe/líder (leitura combinada; o compromisso canônico é
 *    gravado SÓ no Semáforo/lps_tasks — aqui não há segundo caminho de escrita).
 *
 * Linguagem visual Palantir (padrão torre-de-controle/meta-ligacoes): dark
 * #0a0f1a/#0d1420, bordas 1px #1e293b, números mono tabulares, labels CAIXA
 * ALTA 9-11px, quadrados de status verde/âmbar/vermelho, fonte declarada em
 * cada bloco. Sem dado → estado vazio honesto com a fonte explicada.
 */
import { useMemo, useState } from 'react'
import { CalendarClock, Plus, Pencil, Trash2, X } from 'lucide-react'
import {
  useProgramacaoSemana,
  segSabCorrente,
  type ProgramacaoLinha,
  type ProgramacaoLinhaInput,
  type EquipeAtivaOption,
} from '@/hooks/useProgramacaoSemana'

// ─── Constantes visuais (idioma Palantir do repo) ───────────────────────────

const MONO = 'font-mono [font-variant-numeric:tabular-nums]'
const LABEL = 'text-[9px] font-semibold uppercase tracking-[0.14em] text-[#64748b]'

// Frentes oficiais do form (linhas antigas com outra frente continuam renderizando).
const FRENTES_FORM = ['Boi Malhado', 'Sakura', 'Retorno']

// Ordem das colunas do kanban (frentes fora da lista vão pro fim, alfabético).
const ORDEM_FRENTE = ['Boi Malhado', 'Ilha Bela', 'Sakura', 'Retorno']

function ddmm(iso: string | null): string {
  if (!iso) return '--/--'
  const p = iso.split('-')
  return `${p[2]}/${p[1]}`
}

function fmtNum(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',')
}

// ─── Formulário inline (criação e edição usam o mesmo) ──────────────────────

interface FormValores {
  semanaIni: string
  semanaFim: string
  frente: string
  equipe: string
  servico: string
  metaQtd: string
  metaUnidade: string
  obs: string
}

function valoresIniciais(linha?: ProgramacaoLinha): FormValores {
  if (linha) {
    return {
      semanaIni: linha.semanaIni,
      semanaFim: linha.semanaFim,
      frente: linha.frente,
      equipe: linha.equipe,
      servico: linha.servico,
      metaQtd: linha.metaQtd != null ? String(linha.metaQtd) : '',
      metaUnidade: linha.metaUnidade ?? '',
      obs: linha.obs ?? '',
    }
  }
  const { ini, fim } = segSabCorrente()
  return {
    semanaIni: ini,
    semanaFim: fim,
    frente: FRENTES_FORM[0],
    equipe: '',
    servico: '',
    metaQtd: '',
    metaUnidade: '',
    obs: '',
  }
}

const INPUT =
  'bg-[#0a0f1a] border border-[#1e293b] text-[12px] text-[#e2e8f0] px-2 py-1.5 outline-none focus:border-[#38bdf8] placeholder:text-[#475569] w-full'

function LinhaForm({
  linha,
  equipesAtivas,
  salvando,
  onSalvar,
  onCancelar,
}: {
  linha?: ProgramacaoLinha
  equipesAtivas: EquipeAtivaOption[]
  salvando: boolean
  onSalvar: (input: ProgramacaoLinhaInput) => void
  onCancelar: () => void
}) {
  const [v, setV] = useState<FormValores>(() => valoresIniciais(linha))
  const [aviso, setAviso] = useState<string | null>(null)

  // frente atual da linha editada entra como opção extra (ex.: "Ilha Bela" legada)
  const opcoesFrente = useMemo(
    () => (v.frente && !FRENTES_FORM.includes(v.frente) ? [v.frente, ...FRENTES_FORM] : FRENTES_FORM),
    [v.frente],
  )

  function submit() {
    const metaQtd = Number(v.metaQtd.replace(',', '.'))
    if (!v.equipe.trim()) return setAviso('Informe a equipe.')
    if (!v.servico.trim()) return setAviso('Informe o serviço.')
    if (!v.metaQtd.trim() || !Number.isFinite(metaQtd) || metaQtd <= 0)
      return setAviso('Meta (qtd) é obrigatória e deve ser > 0.')
    if (!v.semanaIni || !v.semanaFim || v.semanaFim < v.semanaIni)
      return setAviso('Janela da semana inválida (fim antes do início).')
    setAviso(null)
    onSalvar({
      semanaIni: v.semanaIni,
      semanaFim: v.semanaFim,
      frente: v.frente,
      equipe: v.equipe.trim(),
      servico: v.servico.trim(),
      metaQtd,
      metaUnidade: v.metaUnidade.trim() || null,
      obs: v.obs.trim() || null,
    })
  }

  return (
    <div className="bg-[#0d1420] border border-[#38bdf8]/40 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#38bdf8]">
          {linha ? 'Editar linha' : 'Nova linha da programação'}
        </span>
        <button onClick={onCancelar} className="text-[#64748b] hover:text-[#e2e8f0]" title="Cancelar">
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Semana início</span>
          <input type="date" className={`${INPUT} ${MONO}`} value={v.semanaIni} onChange={(e) => setV({ ...v, semanaIni: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Semana fim</span>
          <input type="date" className={`${INPUT} ${MONO}`} value={v.semanaFim} onChange={(e) => setV({ ...v, semanaFim: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Frente</span>
          <select className={INPUT} value={v.frente} onChange={(e) => setV({ ...v, frente: e.target.value })}>
            {opcoesFrente.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Equipe (wcr_equipes)</span>
          <input
            list="prog-semana-equipes"
            className={INPUT}
            value={v.equipe}
            placeholder="selecione ou digite"
            onChange={(e) => setV({ ...v, equipe: e.target.value })}
          />
          {/* datalist estruturado: grava o NOME, sugerindo as wcr_equipes ativas */}
          <datalist id="prog-semana-equipes">
            {equipesAtivas.map((e) => (
              <option key={e.id} value={e.nome}>{e.lider ? `líder: ${e.lider}` : undefined}</option>
            ))}
          </datalist>
        </label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr] gap-2">
        <label className="flex flex-col gap-1 col-span-2 sm:col-span-1">
          <span className={LABEL}>Serviço</span>
          <input className={INPUT} value={v.servico} placeholder="ex.: Caixa U.M.A / Ligação de água / Reparo de PVs" onChange={(e) => setV({ ...v, servico: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Meta (qtd) *</span>
          <input type="number" min="0" step="any" className={`${INPUT} ${MONO}`} value={v.metaQtd} onChange={(e) => setV({ ...v, metaQtd: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Unidade</span>
          <input className={INPUT} value={v.metaUnidade} placeholder="un / m / PV…" onChange={(e) => setV({ ...v, metaUnidade: e.target.value })} />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Observação</span>
        <input className={INPUT} value={v.obs} onChange={(e) => setV({ ...v, obs: e.target.value })} />
      </label>

      {aviso && <p className="text-[11px] text-[#f59e0b] m-0">{aviso}</p>}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={salvando}
          className="text-[10px] font-bold uppercase tracking-[0.14em] bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/40 px-3 py-1.5 hover:bg-[#38bdf8]/25 disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          onClick={onCancelar}
          className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748b] border border-[#1e293b] px-3 py-1.5 hover:text-[#e2e8f0]"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Card de linha (leitura + ações) ────────────────────────────────────────

function corStatus(l: ProgramacaoLinha): string {
  if (l.realizado === null) return '#475569' // sem medição automática
  if (l.metaQtd != null && l.metaQtd > 0 && l.realizado >= l.metaQtd) return '#22c55e'
  if (l.realizado > 0) return '#f59e0b'
  return '#ef4444'
}

function LinhaCard({
  linha,
  onEditar,
  onExcluir,
}: {
  linha: ProgramacaoLinha
  onEditar: () => void
  onExcluir: () => void
}) {
  const pct =
    linha.realizado !== null && linha.metaQtd != null && linha.metaQtd > 0
      ? Math.min(100, (linha.realizado / linha.metaQtd) * 100)
      : null
  const cor = corStatus(linha)

  return (
    <div className="bg-[#0d1420] border border-[#1e293b] p-2.5 flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 shrink-0" style={{ backgroundColor: cor }} />
            <span className="text-[12px] font-bold text-[#e2e8f0] truncate">{linha.equipe}</span>
          </div>
          <div className="text-[11px] text-[#94a3b8] mt-0.5">{linha.servico}</div>
          {linha.obs && <div className="text-[10px] text-[#64748b] mt-0.5">{linha.obs}</div>}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEditar} className="text-[#64748b] hover:text-[#38bdf8] p-0.5" title="Editar linha">
            <Pencil size={13} />
          </button>
          <button onClick={onExcluir} className="text-[#64748b] hover:text-[#ef4444] p-0.5" title="Excluir linha">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* meta × realizado ao vivo */}
      <div className="flex items-baseline justify-between gap-2">
        <span className={LABEL}>Realizado / Meta</span>
        {linha.realizado !== null ? (
          <span
            className={`text-[13px] font-bold text-[#e2e8f0] ${MONO}`}
            title={`${linha.linhasCasadas} linha(s) de producao_diaria casaram na janela ${ddmm(linha.semanaIni)}–${ddmm(linha.semanaFim)} (equipe via equipe_aliases/wcr_equipes)`}
          >
            {fmtNum(linha.realizado)}
            <span className="text-[#64748b]"> / {linha.metaQtd != null ? fmtNum(linha.metaQtd) : '—'}</span>
            {linha.metaUnidade && <span className="text-[10px] text-[#64748b]"> {linha.metaUnidade}</span>}
          </span>
        ) : (
          <span
            className={`text-[13px] font-bold text-[#475569] ${MONO} cursor-help`}
            title="Serviço sem coluna correspondente em producao_diaria — sem medição automática. Meta segue válida; o realizado deste serviço não é apontado nas colunas tipadas (c_uma, ihm, la, le, pra_m, pre_m, pv, pi…)."
          >
            —{linha.metaQtd != null && <span className="text-[#64748b]"> / {fmtNum(linha.metaQtd)}</span>}
            {linha.metaUnidade && <span className="text-[10px] text-[#64748b]"> {linha.metaUnidade}</span>}
          </span>
        )}
      </div>

      {pct !== null && (
        <div className="h-1.5 w-full bg-[#1e293b]">
          <div className="h-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className={`${LABEL} normal-case tracking-normal`}>
          {linha.realizado !== null
            ? `${linha.linhasCasadas} apontamento(s) na janela`
            : 'sem coluna mensurável'}
        </span>
        {linha.temCompromissoLps && (
          <span
            className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#22c55e] border border-[#22c55e]/40 bg-[#22c55e]/10 px-1.5 py-0.5 cursor-help"
            title="Existe compromisso formal em lps_tasks (comprometida) nesta semana ISO casando com esta equipe/líder — gravado pelo Semáforo do LPS."
          >
            Compromisso
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Página ─────────────────────────────────────────────────────────────────

export function ProgramacaoSemanaPage() {
  const {
    linhas,
    equipesAtivas,
    semanaIni,
    semanaFim,
    loading,
    error,
    criarLinha,
    atualizarLinha,
    excluirLinha,
  } = useProgramacaoSemana()

  const [criando, setCriando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const grupos = useMemo(() => {
    const map = new Map<string, ProgramacaoLinha[]>()
    for (const l of linhas) {
      if (!map.has(l.frente)) map.set(l.frente, [])
      map.get(l.frente)!.push(l)
    }
    const lista = Array.from(map.entries()).map(([frente, itens]) => ({
      frente,
      itens: [...itens].sort((a, b) => a.equipe.localeCompare(b.equipe)),
    }))
    lista.sort((a, b) => {
      const ia = ORDEM_FRENTE.indexOf(a.frente)
      const ib = ORDEM_FRENTE.indexOf(b.frente)
      if (ia === -1 && ib === -1) return a.frente.localeCompare(b.frente)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    return lista
  }, [linhas])

  async function salvarNova(input: ProgramacaoLinhaInput) {
    setSalvando(true)
    const ok = await criarLinha(input)
    setSalvando(false)
    if (ok) setCriando(false)
  }

  async function salvarEdicao(id: string, input: ProgramacaoLinhaInput) {
    setSalvando(true)
    const ok = await atualizarLinha(id, input)
    setSalvando(false)
    if (ok) setEditandoId(null)
  }

  async function excluir(l: ProgramacaoLinha) {
    if (!window.confirm(`Excluir a linha "${l.equipe} — ${l.servico}" da programação?`)) return
    await excluirLinha(l.id)
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto bg-[#0a0f1a] text-[#e2e8f0] min-h-full">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1e293b] pb-3 mb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold uppercase tracking-[0.08em] flex items-center gap-2 m-0">
            <CalendarClock size={20} /> Programação da Semana
          </h1>
          <p className={`text-[11px] text-[#64748b] mt-1 m-0 ${MONO}`}>
            {semanaIni ? `${ddmm(semanaIni)} – ${ddmm(semanaFim)} · WCR Saneamento` : 'WCR Saneamento'}
          </p>
        </div>
        <button
          onClick={() => {
            setCriando((c) => !c)
            setEditandoId(null)
          }}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/40 px-3 py-1.5 hover:bg-[#38bdf8]/25"
        >
          <Plus size={13} /> Nova linha
        </button>
      </div>

      {loading && <p className={`text-[11px] uppercase tracking-[0.2em] text-[#64748b] ${MONO}`}>Carregando…</p>}
      {error && <p className="text-[11px] text-[#ef4444]">Erro: {error}</p>}

      {criando && (
        <div className="mb-4">
          <LinhaForm
            equipesAtivas={equipesAtivas}
            salvando={salvando}
            onSalvar={salvarNova}
            onCancelar={() => setCriando(false)}
          />
        </div>
      )}

      {!loading && !error && linhas.length === 0 && (
        <p className="text-[12px] text-[#64748b]">
          0 registros em programacao_semana — nenhuma programação cadastrada ainda. Use "Nova linha" para
          montar a semana com a gestão.
        </p>
      )}

      <div className="grid gap-3 items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {grupos.map((g) => (
          <div key={g.frente} className="border border-[#1e293b] bg-[#0d1420]/40">
            <div className="flex items-center justify-between border-b border-[#1e293b] px-3 py-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em]">{g.frente}</span>
              <span className={`text-[11px] text-[#64748b] ${MONO}`}>{g.itens.length}</span>
            </div>
            <div className="flex flex-col gap-2 p-2">
              {g.itens.map((l) =>
                editandoId === l.id ? (
                  <LinhaForm
                    key={l.id}
                    linha={l}
                    equipesAtivas={equipesAtivas}
                    salvando={salvando}
                    onSalvar={(input) => salvarEdicao(l.id, input)}
                    onCancelar={() => setEditandoId(null)}
                  />
                ) : (
                  <LinhaCard
                    key={l.id}
                    linha={l}
                    onEditar={() => {
                      setEditandoId(l.id)
                      setCriando(false)
                    }}
                    onExcluir={() => excluir(l)}
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[9px] text-[#475569] text-center">
        Fontes: programacao_semana (previsto) · producao_diaria via vw_producao_equipe + equipe_aliases
        (realizado, com rateio) · wcr_equipes (equipes ativas) · lps_tasks (badge compromisso — escrita só
        pelo Semáforo)
      </p>
    </div>
  )
}

export default ProgramacaoSemanaPage
