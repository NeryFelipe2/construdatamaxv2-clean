/**
 * CronogramaPorEquipePanel — aba "Por Equipe" do Plan. Mestre (Missão 5 do
 * design "Cronograma por Equipe").
 *
 * Fluxo: "eu atribuo o trabalho, o sistema calcula o tempo". As equipes
 * exibidas vêm do organograma canônico (`useEquipes`, Supabase `wcr_equipes`),
 * filtradas pelo núcleo do projeto ativo (`FRENTE_TO_NUCLEO`). O cronograma
 * (dias/datas por item, cascata de produtividade) vem do motor puro (Missão 3)
 * via `useCronogramaEquipe` (Missão 4), que já lê/escreve só em
 * `equipe_cronograma_itens`.
 *
 * Reaproveita `useSupabaseNsPlanejamento` (já usado no módulo NS) para listar
 * as NS reais e as ruas com "a fazer" do projeto ativo — não duplica leitura
 * de `planejamento_itens`/`planejamentos_semanais`.
 *
 * Null-safe em tudo: projeto sem núcleo reconhecido, núcleo sem equipes
 * (ex: Sakura), equipe sem itens, Supabase fora do ar — nada quebra a tela.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronUp, ChevronDown, X, Plus, Check, Users, ArrowLeft } from 'lucide-react'
import { useProjectContext } from '@/store/projectContext'
import { useEquipes } from '@/hooks/useEquipes'
import { useCronogramaEquipe, type NovoItemCronograma } from '@/hooks/useCronogramaEquipe'
import { useSupabaseNsPlanejamento, type NsItem, type ResumoPlano } from '@/hooks/useSupabaseNsPlanejamento'
import { FRENTE_TO_NUCLEO, FRENTE_META, type EquipeCard } from '@/data/wcrEquipes'
import { daysBetween } from '../utils/masterEngine'
import type { EquipeCronograma, ItemCalculado, ProdutividadeFonte } from '@/lib/matching/cronogramaEquipeCompute'

type RuaAFazer = NonNullable<ResumoPlano['por_rua']>[number]

// ─── Helpers ──────────────────────────────────────────────────────────────

function extrairNucleo(nomeProjeto: string | undefined | null): string | null {
  if (!nomeProjeto) return null
  const limpo = nomeProjeto.replace(/^\s*WCR\s*[—–-]\s*/i, '').trim()
  return limpo || null
}

function fmtDateBr(iso: string): string {
  const partes = iso.split('-')
  if (partes.length !== 3) return iso
  const [y, m, d] = partes
  return `${d}/${m}/${y.slice(2)}`
}

const SISTEMA_COLOR: Record<'AGUA' | 'ESGOTO', string> = { AGUA: '#f97316', ESGOTO: '#22c55e' }
const SISTEMA_LABEL: Record<'AGUA' | 'ESGOTO', string> = { AGUA: 'Água', ESGOTO: 'Esgoto' }

const FONTE_META: Record<ProdutividadeFonte, { label: string; color: string }> = {
  real: { label: 'REAL', color: '#22c55e' },
  padrao: { label: 'PADRÃO', color: '#8a8a8a' },
  manual: { label: 'MANUAL', color: '#38bdf8' },
}

/** Selo da produtividade em uso pela equipe: manual > real > padrão (mesma precedência da cascata). */
function fonteDaEquipe(itens: ItemCalculado[]): ProdutividadeFonte | null {
  if (itens.length === 0) return null
  if (itens.some((i) => i.produtividadeFonte === 'manual')) return 'manual'
  if (itens.some((i) => i.produtividadeFonte === 'real')) return 'real'
  return 'padrao'
}

function FonteBadge({ fonte }: { fonte: ProdutividadeFonte | null }) {
  if (!fonte) {
    return (
      <span className="text-[9px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 text-[#6b6b6b] bg-[#6b6b6b]/10 border border-[#6b6b6b]/30">
        —
      </span>
    )
  }
  const meta = FONTE_META[fonte]
  return (
    <span
      className="text-[9px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5"
      style={{ color: meta.color, backgroundColor: meta.color + '1a', border: `1px solid ${meta.color}4d` }}
      title="Fonte da produtividade em uso (cascata: manual > real do RDO > padrão)"
    >
      {meta.label}
    </span>
  )
}

// ─── Mini-gantt (barras horizontais por item, escala própria da equipe) ────

function MiniGantt({ itens }: { itens: ItemCalculado[] }) {
  if (itens.length === 0) return null

  const inicio = itens.reduce((min, it) => (it.inicio < min ? it.inicio : min), itens[0].inicio)
  const fim = itens.reduce((max, it) => (it.fim > max ? it.fim : max), itens[0].fim)
  const totalDias = Math.max(1, daysBetween(inicio, fim) + 1)

  return (
    <div className="bg-[#0d1626] border border-[#525252]/60 rounded-lg p-2 flex flex-col gap-1.5">
      {itens.map((item) => {
        const offsetDias = Math.max(0, daysBetween(inicio, item.inicio))
        const durDias = Math.max(1, daysBetween(item.inicio, item.fim) + 1)
        const leftPct = (offsetDias / totalDias) * 100
        const widthPct = Math.max((durDias / totalDias) * 100, 2)
        const cor = SISTEMA_COLOR[item.sistema]
        return (
          <div key={item.id} className="relative h-4">
            <div
              className="absolute inset-y-0 rounded"
              style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: cor, opacity: 0.85 }}
              title={`${item.descricao}\n${fmtDateBr(item.inicio)} → ${fmtDateBr(item.fim)} (${item.dias}d)`}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Linha de item de trabalho ──────────────────────────────────────────────

function ItemRow({
  item, isFirst, isLast, onRemove, onMoveUp, onMoveDown,
}: {
  item: ItemCalculado
  isFirst: boolean
  isLast: boolean
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const cor = SISTEMA_COLOR[item.sistema]
  return (
    <div className="flex items-center gap-2 bg-[#2c2c2c] border border-[#525252]/60 rounded-lg px-3 py-2 text-xs">
      <div className="flex flex-col gap-0.5 shrink-0">
        <button onClick={onMoveUp} disabled={isFirst} className="text-[#6b6b6b] hover:text-[#f97316] disabled:opacity-20 disabled:cursor-not-allowed" title="Mover para cima">
          <ChevronUp size={12} />
        </button>
        <button onClick={onMoveDown} disabled={isLast} className="text-[#6b6b6b] hover:text-[#f97316] disabled:opacity-20 disabled:cursor-not-allowed" title="Mover para baixo">
          <ChevronDown size={12} />
        </button>
      </div>
      <span
        className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase shrink-0"
        style={{ backgroundColor: cor + '20', color: cor }}
      >
        {SISTEMA_LABEL[item.sistema]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[#f5f5f5] truncate">{item.descricao}</p>
        <p className="text-[#6b6b6b] text-[10px] flex items-center gap-1 flex-wrap">
          <span>{item.metragem}m</span>
          <span>·</span>
          <span>{item.produtividadeUsada}m/dia</span>
          <FonteBadge fonte={item.produtividadeFonte} />
          <span>·</span>
          <span>{item.dias}d</span>
          <span>·</span>
          <span>{fmtDateBr(item.inicio)} → {fmtDateBr(item.fim)}</span>
          <span className="uppercase text-[9px] text-[#525252]">[{item.fonte}]</span>
        </p>
      </div>
      <button onClick={onRemove} className="text-[#6b6b6b] hover:text-[#ef4444] shrink-0" title="Remover item">
        <X size={13} />
      </button>
    </div>
  )
}

// ─── Modal "+ Adicionar trabalho" (3 fontes: livre / NS / rua) ──────────────

type Fonte = 'livre' | 'ns' | 'rua'

function NovoTrabalhoModal({
  equipeId, onClose, onAdicionar, nsItens, ruas,
}: {
  equipeId: string
  onClose: () => void
  onAdicionar: (item: NovoItemCronograma) => Promise<void>
  nsItens: NsItem[]
  ruas: RuaAFazer[]
}) {
  const [fonte, setFonte] = useState<Fonte>('livre')
  const [descricao, setDescricao] = useState('')
  const [sistema, setSistema] = useState<'AGUA' | 'ESGOTO'>('AGUA')
  const [metragem, setMetragem] = useState('')
  const [nsId, setNsId] = useState('')
  const [ruaNome, setRuaNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  const ruasComAFazer = useMemo(() => ruas.filter((r) => r.agua_afazer_m > 0 || r.esgoto_afazer_m > 0), [ruas])

  // Prefill ao escolher NS: descrição/metragem/sistema vêm da NS real.
  useEffect(() => {
    if (fonte !== 'ns') return
    const ns = nsItens.find((n) => n.id === nsId)
    if (!ns) return
    setDescricao(ns.atividade)
    setSistema(ns.sistema)
    setMetragem(String(ns.quantidade_planejada))
  }, [fonte, nsId, nsItens])

  // Prefill ao escolher rua (+ sistema): metragem = a-fazer daquele sistema.
  useEffect(() => {
    if (fonte !== 'rua') return
    const rua = ruas.find((r) => r.rua === ruaNome)
    if (!rua) return
    setDescricao(/^(rua|travessa|avenida|alameda|estrada)\b/i.test(rua.rua) ? rua.rua : `Rua ${rua.rua}`)
    setMetragem(String(sistema === 'AGUA' ? rua.agua_afazer_m : rua.esgoto_afazer_m))
  }, [fonte, ruaNome, sistema, ruas])

  const podeSalvar = descricao.trim().length > 0 && Number(metragem) > 0

  async function salvar() {
    if (!podeSalvar) return
    setSalvando(true)
    try {
      await onAdicionar({
        equipeId,
        fonte,
        ref: fonte === 'ns' ? (nsId || null) : fonte === 'rua' ? (ruaNome || null) : null,
        descricao: descricao.trim(),
        sistema,
        metragem: Number(metragem),
      })
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  const inputCls = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60'
  const labelCls = 'text-[#6b6b6b] text-[10px] block mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-[#525252] bg-[#3d3d3d] p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[#f5f5f5] text-sm font-semibold">Adicionar trabalho</h3>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={16} /></button>
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded-lg border border-[#525252] bg-[#2c2c2c]">
          {(['livre', 'ns', 'rua'] as Fonte[]).map((f) => (
            <button
              key={f}
              onClick={() => setFonte(f)}
              className={`flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                fonte === f ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]'
              }`}
            >
              {f === 'livre' ? 'Livre' : f === 'ns' ? 'NS' : 'Rua'}
            </button>
          ))}
        </div>

        {fonte === 'ns' && (
          <div>
            <label className={labelCls}>Nota de Serviço</label>
            <select className={inputCls} value={nsId} onChange={(e) => setNsId(e.target.value)}>
              <option value="">— Selecionar NS —</option>
              {nsItens.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.atividade} — {n.quantidade_planejada}m ({n.sistema === 'AGUA' ? 'água' : 'esgoto'})
                </option>
              ))}
            </select>
            {nsItens.length === 0 && <p className="text-[10px] text-[#6b6b6b] mt-1">Nenhuma NS encontrada para este projeto.</p>}
          </div>
        )}

        {fonte === 'rua' && (
          <>
            <div>
              <label className={labelCls}>Rua</label>
              <select className={inputCls} value={ruaNome} onChange={(e) => setRuaNome(e.target.value)}>
                <option value="">— Selecionar rua —</option>
                {ruasComAFazer.map((r) => (
                  <option key={r.rua} value={r.rua}>{r.rua}</option>
                ))}
              </select>
              {ruasComAFazer.length === 0 && <p className="text-[10px] text-[#6b6b6b] mt-1">Nenhuma rua com "a fazer" encontrada.</p>}
            </div>
            <div>
              <label className={labelCls}>Sistema</label>
              <select className={inputCls} value={sistema} onChange={(e) => setSistema(e.target.value as 'AGUA' | 'ESGOTO')}>
                <option value="AGUA">Água</option>
                <option value="ESGOTO">Esgoto</option>
              </select>
            </div>
          </>
        )}

        {fonte === 'livre' && (
          <div>
            <label className={labelCls}>Sistema</label>
            <select className={inputCls} value={sistema} onChange={(e) => setSistema(e.target.value as 'AGUA' | 'ESGOTO')}>
              <option value="AGUA">Água</option>
              <option value="ESGOTO">Esgoto</option>
            </select>
          </div>
        )}

        <div>
          <label className={labelCls}>Descrição *</label>
          <input className={inputCls} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Rede de água — trecho X" />
        </div>
        <div>
          <label className={labelCls}>Metragem (m) *</label>
          <input type="number" min={0} className={inputCls} value={metragem} onChange={(e) => setMetragem(e.target.value)} />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] text-xs hover:text-[#a3a3a3]">Cancelar</button>
          <button
            onClick={salvar}
            disabled={!podeSalvar || salvando}
            className="px-4 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c] disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Faixa de uma equipe ────────────────────────────────────────────────────

function EquipeFaixa({
  equipe, cronograma, adicionarItem, atualizarItem, removerItem, reordenarItens, nsItens, ruas,
}: {
  equipe: EquipeCard
  cronograma: EquipeCronograma | null
  adicionarItem: (item: NovoItemCronograma) => Promise<void>
  atualizarItem: (id: string, patch: { produtividadeOverride?: number | null }) => Promise<void>
  removerItem: (id: string) => Promise<void>
  reordenarItens: (equipeId: string, novaOrdemIds: string[]) => Promise<void>
  nsItens: NsItem[]
  ruas: RuaAFazer[]
}) {
  const [showForm, setShowForm] = useState(false)
  const [overrideValue, setOverrideValue] = useState('')

  const itens = cronograma?.itens ?? []
  const fonte = fonteDaEquipe(itens)
  const frenteMeta = FRENTE_META[equipe.frente]

  async function aplicarOverrideEquipe() {
    const val = Number(overrideValue)
    if (!val || val <= 0 || itens.length === 0) return
    await Promise.all(itens.map((it) => atualizarItem(it.id, { produtividadeOverride: val })))
    setOverrideValue('')
  }

  function mover(id: string, dir: -1 | 1) {
    const ids = itens.map((i) => i.id)
    const idx = ids.indexOf(id)
    const novoIdx = idx + dir
    if (idx < 0 || novoIdx < 0 || novoIdx >= ids.length) return
    const next = [...ids]
    const tmp = next[idx]
    next[idx] = next[novoIdx]
    next[novoIdx] = tmp
    reordenarItens(equipe.id, next)
  }

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#525252] flex items-center gap-3 flex-wrap" style={{ borderLeftWidth: 3, borderLeftColor: frenteMeta.cor }}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[#f5f5f5] text-sm font-semibold">{equipe.equipe}</h3>
            <span className="text-[10px] text-[#6b6b6b]">líder {equipe.lider}</span>
            <FonteBadge fonte={fonte} />
            {equipe.aContratar && (
              <span className="text-[9px] font-bold uppercase text-[#a78bfa] bg-[#a78bfa]/10 border border-[#a78bfa]/40 rounded px-1.5 py-0.5">a contratar</span>
            )}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: frenteMeta.cor }}>{frenteMeta.label}</div>
          <div className="text-[10px] text-[#6b6b6b] mt-0.5">
            {cronograma?.dataFim
              ? `fim previsto: ${fmtDateBr(cronograma.dataFim)} · ${cronograma.totalDias} dia${cronograma.totalDias !== 1 ? 's' : ''} · ${cronograma.totalMetragem}m`
              : 'sem trabalho atribuído ainda'}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1">
            <label className="text-[10px] text-[#6b6b6b]" title="Override de produtividade (m/dia) aplicado a todos os itens desta equipe">
              override m/dia
            </label>
            <input
              type="number"
              min={0}
              placeholder="—"
              value={overrideValue}
              onChange={(e) => setOverrideValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') aplicarOverrideEquipe() }}
              disabled={itens.length === 0}
              title={itens.length === 0 ? 'Adicione um trabalho primeiro' : 'Enter ou ✓ aplica a todos os itens da equipe'}
              className="w-16 bg-[#2c2c2c] border border-[#525252] rounded px-1.5 py-1 text-[11px] text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60 disabled:opacity-40"
            />
            <button
              onClick={aplicarOverrideEquipe}
              disabled={itens.length === 0 || !overrideValue}
              className="text-[#6b6b6b] hover:text-[#22c55e] disabled:opacity-30 disabled:cursor-not-allowed"
              title="Aplicar override a todos os itens"
            >
              <Check size={14} />
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#f97316] text-white text-[11px] font-semibold hover:bg-[#ea580c]"
          >
            <Plus size={12} />Adicionar trabalho
          </button>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {itens.length === 0 ? (
          <p className="text-[#6b6b6b] text-xs text-center py-4">Nenhum trabalho atribuído ainda.</p>
        ) : (
          <>
            <MiniGantt itens={itens} />
            <div className="flex flex-col gap-1.5">
              {itens.map((item, idx) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isFirst={idx === 0}
                  isLast={idx === itens.length - 1}
                  onRemove={() => removerItem(item.id)}
                  onMoveUp={() => mover(item.id, -1)}
                  onMoveDown={() => mover(item.id, 1)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {showForm && (
        <NovoTrabalhoModal
          equipeId={equipe.id}
          onClose={() => setShowForm(false)}
          onAdicionar={adicionarItem}
          nsItens={nsItens}
          ruas={ruas}
        />
      )}
    </div>
  )
}

// ─── Painel principal ───────────────────────────────────────────────────────

export function CronogramaPorEquipePanel() {
  const navigate = useNavigate()
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const projetos = useProjectContext((s) => s.projetos)

  const { equipes, loading: loadingEquipes } = useEquipes()
  const cron = useCronogramaEquipe(activeProjectId)
  const ns = useSupabaseNsPlanejamento(activeProjectId)

  const projetoAtivo = useMemo(() => projetos.find((p) => p.id === activeProjectId) ?? null, [projetos, activeProjectId])
  const nucleo = extrairNucleo(projetoAtivo?.nome)

  const equipesDoNucleo = useMemo(
    () => (nucleo ? equipes.filter((e) => FRENTE_TO_NUCLEO[e.frente] === nucleo) : []),
    [equipes, nucleo],
  )

  const cronogramaPorEquipeId = useMemo(() => {
    const map = new Map<string, EquipeCronograma>()
    for (const c of cron.cronogramasPorEquipe) map.set(c.equipeId, c)
    return map
  }, [cron.cronogramasPorEquipe])

  const ruas = ns.resumo?.por_rua ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-[#f97316]" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[#f5f5f5] text-sm font-semibold">Cronograma por Equipe — {nucleo ?? projetoAtivo?.nome ?? 'projeto sem núcleo identificado'}</h2>
          <p className="text-[#6b6b6b] text-xs mt-0.5">
            Atribua o trabalho a cada equipe; o sistema calcula os dias pela produtividade (cascata: override &gt; real do RDO &gt; padrão por serviço).
            {(loadingEquipes || cron.loading) && ' · carregando…'}
          </p>
        </div>
        <button
          onClick={() => navigate('/app/equipes-kanban')}
          className="flex items-center gap-1.5 text-[11px] text-[#6b6b6b] hover:text-[#38bdf8] px-3 py-2 rounded-md border border-[#525252] hover:border-[#38bdf8]/50 transition-colors shrink-0"
          title="Voltar para o Kanban de Equipes"
        >
          <ArrowLeft size={12} /> Kanban de Equipes
        </button>
      </div>

      {equipesDoNucleo.length === 0 ? (
        <div className="border border-dashed border-[#525252] rounded-xl p-8 text-center">
          <p className="text-[#a3a3a3] text-sm">Nenhuma equipe cadastrada para esta obra.</p>
          <p className="text-[#6b6b6b] text-xs mt-1">Cadastre no Kanban de Equipes.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {equipesDoNucleo.map((equipe) => (
            <EquipeFaixa
              key={equipe.id}
              equipe={equipe}
              cronograma={cronogramaPorEquipeId.get(equipe.id) ?? null}
              adicionarItem={cron.adicionarItem}
              atualizarItem={cron.atualizarItem}
              removerItem={cron.removerItem}
              reordenarItens={cron.reordenarItens}
              nsItens={ns.itens}
              ruas={ruas}
            />
          ))}
        </div>
      )}
    </div>
  )
}
