/**
 * GuiaPage — 2 abas internas (Fase 3 do plano "LPS de verdade"):
 *
 *  · TRILHO DA SEMANA — stepper vertical P1→P5 do ciclo Last Planner, com
 *    status COMPUTADO por checagens reais no Supabase (guiaStore: metas_producao,
 *    lps_restricoes, lps_tasks, producao_diaria), checklist do gate com
 *    contagens reais, instrução em linguagem de obra e deep-link pra tela onde
 *    o passo acontece. Gerente pode pular passo (nota de 1 linha, persistida em
 *    guia_progresso) e esconder a barra do topo. Trilho é camada, nunca gaiola.
 *
 *  · MANUAL — o passo a passo original de cada módulo do site (conteúdo da
 *    GuiaPage anterior, preservado inteiro).
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen, LayoutDashboard, Waves, ClipboardList, Calculator, Users, Wrench,
  FileText, Map, ChevronDown, ChevronRight, CheckCircle2, RefreshCw,
  ArrowRight, SkipForward, Undo2, Eye, EyeOff,
} from 'lucide-react'
import {
  useGuiaStore, GUIA_PASSOS, COR_STATUS, LABEL_STATUS,
  type GuiaPassoDef, type GuiaPassoEstado, type GuiaPassoId, type GuiaPapel,
} from '@/store/guiaStore'
import { useProjectContext } from '@/store/projectContext'
import { TermoLps } from './TermoLps'

// ═══════════════════════════════════════════════════════════════════════════
// ABA MANUAL — conteúdo original da GuiaPage (preservado inteiro)
// ═══════════════════════════════════════════════════════════════════════════

type Passo = { titulo: string; texto: string }
type Modulo = {
  id: string
  label: string
  rota: string
  icon: typeof BookOpen
  resumo: string
  passos: Passo[]
}

const MODULOS: Modulo[] = [
  {
    id: 'gestao-360',
    label: 'Gestão 360',
    rota: '/app/gestao-360',
    icon: LayoutDashboard,
    resumo: 'Visão geral de todos os contratos WCR (Boi Malhado, Sakura, Retorno): status, alertas e indicadores no mesmo lugar.',
    passos: [
      { titulo: 'Escolher o projeto', texto: 'No topo/menu do site, selecione o contrato (Boi Malhado, Sakura ou Retorno) — todas as telas seguintes mostram dados só desse projeto.' },
      { titulo: 'Olhar os indicadores', texto: 'Os cartões do topo resumem produção, financeiro e prazos. Se algo estiver zerado, é porque ainda não tem dado real lançado — não é erro.' },
    ],
  },
  {
    id: 'ns-planejamento',
    label: 'Feito × A Fazer (NS)',
    rota: '/app/ns-planejamento',
    icon: Waves,
    resumo: 'O % real de rede de água/esgoto já executada x o que falta, tirado do levantamento em campo (GPS/GPKG). Aqui também fica Ligações & OS.',
    passos: [
      { titulo: 'Ver o % por sistema', texto: 'A tela mostra água e esgoto separados, com metros feitos / a fazer e o percentual.' },
      { titulo: 'Marcar NS concluída', texto: 'Quando uma Nota de Serviço (NS) for finalizada em campo, use o botão "marcar concluído" na lista de NS vencidas/pendentes.' },
      { titulo: 'Ligações & OS', texto: 'Na mesma tela, veja a aba de ligações de água/esgoto por mês e núcleo, e as pendências por endereço (sem dado pessoal).' },
    ],
  },
  {
    id: 'rdo',
    label: 'RDO / Produção',
    rota: '/app/rdo',
    icon: FileText,
    resumo: 'Tudo do RDO numa tela só: dashboard, histórico, os RDOs que chegam do WhatsApp da obra (aba Histórico), diário de obra por equipe (aba Diário/Equipes), financeiro e produção diária (ligações, metros de rede, caixas, PV/PI etc.).',
    passos: [
      { titulo: 'Lançar o dia', texto: 'Abra a aba Produção, escolha a data, o núcleo e a equipe, e preencha as colunas (LA, LE, metros de rede água/esgoto, caixas, PV, PI...).' },
      { titulo: 'Conferir os RDOs do WhatsApp', texto: 'A aba Histórico de RDOs atualiza sozinha conforme mensagens chegam do grupo de WhatsApp da obra.' },
      { titulo: 'Ver o diário por equipe', texto: 'A aba Diário/Equipes mostra o dia detalhado por equipe (composição, serviços, ocorrências) e deixa vincular cada atividade a uma Nota de Serviço real.' },
      { titulo: 'Conferir o resumo', texto: 'O Relatório 360 soma esses lançamentos por período e mostra a produtividade média de cada equipe.' },
      { titulo: 'Importar em lote', texto: 'Se tiver uma planilha do dia, use "Importar CSV" — o sistema mostra uma prévia antes de gravar, marcando linhas inválidas em vermelho.' },
    ],
  },
  {
    id: 'equipes-kanban',
    label: 'Kanban Equipes',
    rota: '/app/equipes-kanban',
    icon: Users,
    resumo: 'As 10 equipes de campo organizadas em colunas (ex.: disponível / em obra / retorno), estilo Trello.',
    passos: [
      { titulo: 'Mover uma equipe', texto: 'Arraste o cartão da equipe entre as colunas para atualizar o status dela.' },
      { titulo: 'Ver detalhe', texto: 'Clique no cartão para ver encarregado, frente de trabalho e núcleo atual.' },
    ],
  },
  {
    id: 'gestao-equipamentos',
    label: 'Equipamentos (Frota)',
    rota: '/app/gestao-equipamentos',
    icon: Wrench,
    resumo: 'Controle da frota locada (hoje ~R$109 mil/mês): veículo, locador, status, em kanban.',
    passos: [
      { titulo: 'Ver a frota', texto: 'Cada veículo é um cartão com locador e status (ativo, manutenção, parado etc.).' },
      { titulo: 'Atualizar status', texto: 'Arraste o cartão para a coluna correta quando o veículo mudar de situação.' },
    ],
  },
  {
    id: 'medicao',
    label: 'Medição (RDO)',
    rota: '/app/medicao',
    icon: Calculator,
    resumo: 'Itens medidos em campo (bocas de ataque, PI, PV, conexões...) com preço unitário e status de aprovação.',
    passos: [
      { titulo: 'Preencher o preço', texto: 'Itens chegam como "sem preço" (vindos do levantamento GPS); digite o valor unitário no campo da linha.' },
      { titulo: 'Aprovar', texto: 'Depois de conferir a quantidade e o preço, clique em aprovar — o item fica verde e entra no total medido.' },
    ],
  },
  {
    id: 'dre-financeiro',
    label: 'DRE & Resultado',
    rota: '/app/dre-financeiro',
    icon: Calculator,
    resumo: 'Receitas x despesas reais do contrato. Começa zerada até você lançar dados — nunca mostra número inventado.',
    passos: [
      { titulo: 'Lançar receita/despesa', texto: 'Use o formulário para adicionar um lançamento financeiro real (contratual, materiais, mão de obra, equipamento).' },
      { titulo: 'Importar CSV', texto: 'Para lançar vários de uma vez, use Importar CSV — o sistema valida cada linha antes de gravar.' },
      { titulo: 'Ler o resultado', texto: 'A DRE some tudo automaticamente. Se aparecer zerada, é porque ainda não há lançamento — nunca é dado fictício.' },
    ],
  },
  {
    id: 'planejamento-mestre',
    label: 'Plan. Mestre / Cronograma',
    rota: '/app/planejamento-mestre',
    icon: ClipboardList,
    resumo: 'Cronograma das frentes de trabalho por equipe (quem está abrindo o quê, e quando).',
    passos: [
      { titulo: 'Ver as frentes ativas', texto: 'Cada linha é uma frente (equipe + sistema água/esgoto + data prevista).' },
      { titulo: 'Cruzar com o Feito × A Fazer', texto: 'Use junto com a tela de NS para saber se a frente está adiantada ou atrasada em relação ao planejado.' },
    ],
  },
  {
    id: 'mapa-interativo',
    label: 'Mapa / GIS',
    rota: '/app/mapa-interativo',
    icon: Map,
    resumo: 'Mapa com a rede executada e a fazer, a partir dos levantamentos GPS (GPKG) de campo.',
    passos: [
      { titulo: 'Ativar camadas', texto: 'Ligue/desligue as camadas de água, esgoto, feito e a fazer no painel lateral.' },
      { titulo: 'Clicar num trecho', texto: 'Clique numa linha do mapa para ver os dados daquele trecho (rua, extensão, data do levantamento).' },
    ],
  },
]

function AbaManual() {
  const [aberto, setAberto] = useState<string | null>(MODULOS[0].id)

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs text-[#94a3b8] mb-6">
        Passo a passo de cada módulo, na ordem do dia a dia de obra: lançar produção → acompanhar Feito × A Fazer → medir → fechar financeiro.
      </p>

      <div className="flex flex-col gap-2.5">
        {MODULOS.map((m) => {
          const Icon = m.icon
          const isOpen = aberto === m.id
          return (
            <div key={m.id} className="rounded-xl border border-[#1e293b] bg-[#0d1420] overflow-hidden">
              <button
                onClick={() => setAberto(isOpen ? null : m.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#111a2c] transition-colors"
              >
                <Icon size={16} className="text-[#f97316] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#f5f5f5]">{m.label}</span>
                    <span className="text-[10px] font-mono text-[#64748b]">{m.rota}</span>
                  </div>
                  <p className="text-xs text-[#94a3b8] mt-0.5">{m.resumo}</p>
                </div>
                {isOpen ? (
                  <ChevronDown size={15} className="text-[#64748b] shrink-0" />
                ) : (
                  <ChevronRight size={15} className="text-[#64748b] shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="border-t border-[#1e293b] px-4 py-3 flex flex-col gap-2.5 bg-[#0a0f1a]">
                  {m.passos.map((p, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-[#f5f5f5]">{p.titulo}</span>
                        <p className="text-xs text-[#94a3b8] mt-0.5">{p.texto}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-8 rounded-xl border border-[#1e293b] bg-[#0d1420] px-4 py-3.5">
        <p className="text-xs font-bold text-[#f5f5f5] mb-1">Regra geral do site</p>
        <p className="text-xs text-[#94a3b8]">
          Todo módulo segue o mesmo padrão: <strong className="text-[#f5f5f5]">lançar pelo formulário</strong> (um por vez) <strong className="text-[#f5f5f5]">ou importar um CSV</strong> (vários de uma vez, com prévia antes de gravar).
          Nenhuma tela mostra número inventado — se estiver zerado, é porque ainda falta lançar o dado real.
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA TRILHO DA SEMANA — stepper P1→P5 com gates reais
// ═══════════════════════════════════════════════════════════════════════════

function PassoCard({ def, estado, papel, pularPasso, despularPasso }: {
  def: GuiaPassoDef
  estado: GuiaPassoEstado
  papel: GuiaPapel
  pularPasso: (passo: GuiaPassoId, nota: string) => Promise<boolean>
  despularPasso: (passo: GuiaPassoId) => Promise<boolean>
}) {
  const [pulando, setPulando] = useState(false)
  const [nota, setNota] = useState('')
  const [msgErro, setMsgErro] = useState<string | null>(null)

  const cor = COR_STATUS[estado.status]

  const confirmarPulo = async () => {
    if (!nota.trim()) {
      setMsgErro('A nota de 1 linha é obrigatória pra pular o passo.')
      return
    }
    const ok = await pularPasso(def.id, nota)
    if (ok) {
      setPulando(false)
      setNota('')
      setMsgErro(null)
    } else {
      setMsgErro('Não foi possível gravar o pulo (banco indisponível ou papel sem permissão).')
    }
  }

  return (
    <div className="flex gap-3">
      {/* Trilho vertical: quadrado de status + linha conectora */}
      <div className="flex flex-col items-center pt-4">
        <span className="inline-block w-2.5 h-2.5 rounded-[1px] shrink-0" style={{ background: cor }} />
        <span className="flex-1 w-px bg-[#1e293b] mt-1.5" />
      </div>

      <div className="flex-1 min-w-0 mb-3 rounded border border-[#1e293b] bg-[#0d1420] p-4">
        {/* Cabeçalho do passo */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[11px] font-mono font-bold text-[#f97316]">{def.id.toUpperCase()}</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#e2e8f0]">{def.titulo}</span>
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[2px]"
            style={{ color: cor, background: `${cor}1a`, border: `1px solid ${cor}40` }}
          >
            {LABEL_STATUS[estado.status]}
          </span>
        </div>

        {/* Instrução de 3 linhas em linguagem de obra */}
        <div className="mt-2 space-y-0.5">
          {def.instrucao.map((linha, i) => (
            <p key={i} className="text-[11px] leading-relaxed text-[#94a3b8]">{linha}</p>
          ))}
        </div>

        {/* Termos do glossário (tooltip TermoLps) */}
        {def.termos.length > 0 && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-[9px] uppercase tracking-widest text-[#475569]">Termos:</span>
            {def.termos.map((t) => (
              <span key={t} className="text-[10px]"><TermoLps termo={t} /></span>
            ))}
          </div>
        )}

        {/* Checklist do gate — contagens reais */}
        <div className="mt-3 border-t border-[#1e293b] pt-2.5 space-y-1">
          {estado.erro ? (
            <p className="text-[10px] text-amber-400">
              Checagem indisponível: {estado.erro}
            </p>
          ) : estado.checks.length === 0 ? (
            <p className="text-[10px] text-[#475569]">Aguardando primeira verificação…</p>
          ) : (
            estado.checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-[1px] shrink-0"
                  style={{ background: c.ok ? '#22c55e' : '#ef4444' }}
                />
                <span className="text-[10px] text-[#94a3b8]">{c.label}</span>
                <span className="ml-auto text-[11px] font-mono [font-variant-numeric:tabular-nums] font-bold text-[#e2e8f0]">
                  {c.valor}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Nota do pulo (quando pulado) */}
        {estado.status === 'pulado' && estado.notaPulo && (
          <p className="mt-2 text-[10px] text-[#94a3b8] italic">
            Nota do gerente: “{estado.notaPulo}”
          </p>
        )}

        {/* Ações */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Link
            to={def.deepLink}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#f97316] border border-[#f97316]/40 hover:bg-[#f97316]/10 rounded-[2px] px-2.5 py-1.5 transition-colors"
          >
            {def.botao} <ArrowRight size={11} />
          </Link>

          {papel === 'gerente' && estado.status !== 'pulado' && estado.status !== 'concluido' && !pulando && (
            <button
              onClick={() => { setPulando(true); setMsgErro(null) }}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#64748b] border border-[#1e293b] hover:text-[#e2e8f0] hover:border-[#334155] rounded-[2px] px-2.5 py-1.5 transition-colors"
            >
              <SkipForward size={11} /> Pular passo
            </button>
          )}

          {papel === 'gerente' && estado.status === 'pulado' && (
            <button
              onClick={() => void despularPasso(def.id)}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#64748b] border border-[#1e293b] hover:text-[#e2e8f0] hover:border-[#334155] rounded-[2px] px-2.5 py-1.5 transition-colors"
            >
              <Undo2 size={11} /> Retomar checagem
            </button>
          )}
        </div>

        {/* Formulário de pulo (nota de 1 linha, obrigatória) */}
        {pulando && (
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void confirmarPulo() }}
              placeholder="Por que este passo pode ser pulado esta semana? (1 linha, obrigatório)"
              maxLength={200}
              className="flex-1 min-w-[220px] bg-[#0a0f1a] border border-[#1e293b] rounded-[2px] px-2.5 py-1.5 text-[11px] text-[#e2e8f0] placeholder:text-[#475569] outline-none focus:border-[#f97316]/50"
            />
            <button
              onClick={() => void confirmarPulo()}
              className="text-[10px] font-bold uppercase tracking-wider text-[#f97316] border border-[#f97316]/40 hover:bg-[#f97316]/10 rounded-[2px] px-2.5 py-1.5 transition-colors"
            >
              Confirmar pulo
            </button>
            <button
              onClick={() => { setPulando(false); setNota(''); setMsgErro(null) }}
              className="text-[10px] uppercase tracking-wider text-[#64748b] hover:text-[#e2e8f0] transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
        {msgErro && <p className="mt-1.5 text-[10px] text-amber-400">{msgErro}</p>}

        {/* Fonte declarada (padrão Palantir do repo) */}
        <p className="mt-3 text-[9px] uppercase tracking-widest text-[#475569]">
          Fonte: {def.fonte} · gate computado ao vivo
        </p>
      </div>
    </div>
  )
}

function AbaTrilho() {
  const passos = useGuiaStore((s) => s.passos)
  const papel = useGuiaStore((s) => s.papel)
  const pularPasso = useGuiaStore((s) => s.pularPasso)
  const despularPasso = useGuiaStore((s) => s.despularPasso)
  const semanaIso = useGuiaStore((s) => s.semanaIso)
  const ultimaVerificacao = useGuiaStore((s) => s.ultimaVerificacao)

  const concluidos = GUIA_PASSOS.filter(
    (d) => passos[d.id].status === 'concluido' || passos[d.id].status === 'pulado',
  ).length

  return (
    <div className="mx-auto max-w-4xl">
      {/* Resumo do trilho */}
      <div className="mb-4 flex items-center gap-3 flex-wrap rounded border border-[#1e293b] bg-[#0d1420] px-4 py-3">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#64748b]">Semana</span>
        <span className="text-sm font-mono [font-variant-numeric:tabular-nums] font-bold text-[#e2e8f0]">{semanaIso}</span>
        <span className="w-px h-5 bg-[#1e293b]" />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#64748b]">Passos fechados</span>
        <span className="text-sm font-mono [font-variant-numeric:tabular-nums] font-bold text-[#f97316]">{concluidos}/5</span>
        <span className="flex items-center gap-1.5 ml-auto">
          {GUIA_PASSOS.map((d) => (
            <span
              key={d.id}
              className="inline-block w-2 h-2 rounded-[1px]"
              style={{ background: COR_STATUS[passos[d.id].status] }}
              title={`${d.id.toUpperCase()} — ${LABEL_STATUS[passos[d.id].status]}`}
            />
          ))}
        </span>
        {ultimaVerificacao && (
          <span className="w-full text-[9px] text-[#475569]">
            Última verificação: {new Date(ultimaVerificacao).toLocaleString('pt-BR')} · fontes: metas_producao · lps_restricoes · lps_tasks · producao_diaria · guia_progresso
          </span>
        )}
      </div>

      {/* Stepper vertical */}
      <div>
        {GUIA_PASSOS.map((def) => (
          <PassoCard
            key={def.id}
            def={def}
            estado={passos[def.id]}
            papel={papel}
            pularPasso={pularPasso}
            despularPasso={despularPasso}
          />
        ))}
      </div>

      <p className="text-[10px] text-[#475569] mt-1">
        O trilho é uma camada de orientação: nenhuma tela do site fica bloqueada fora dele.
      </p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PÁGINA
// ═══════════════════════════════════════════════════════════════════════════

export function GuiaPage() {
  const [aba, setAba] = useState<'trilho' | 'manual'>('trilho')
  const papel = useGuiaStore((s) => s.papel)
  const setPapel = useGuiaStore((s) => s.setPapel)
  const trilhoVisivel = useGuiaStore((s) => s.trilhoVisivel)
  const setTrilhoVisivel = useGuiaStore((s) => s.setTrilhoVisivel)
  const verificar = useGuiaStore((s) => s.verificar)
  const verificando = useGuiaStore((s) => s.verificando)
  const activeProjectId = useProjectContext((s) => s.activeProjectId)

  // Recomputa os gates ao abrir a página e quando o projeto ativo muda
  // (independente da GuiaTrilhoBar, que pode estar colapsada).
  useEffect(() => {
    if (activeProjectId) void verificar(activeProjectId)
  }, [activeProjectId, verificar])

  return (
    <div className="min-h-full bg-[#0a0f1a] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Cabeçalho */}
        <div className="flex items-center gap-2.5 flex-wrap mb-1">
          <BookOpen size={20} className="text-[#f97316]" />
          <h1 className="text-lg font-bold text-[#f5f5f5]">Guia — Como trabalhar no site</h1>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* Papel: estagiário × gerente */}
            <div className="flex items-center border border-[#1e293b] rounded-[2px] overflow-hidden">
              {(['estagiario', 'gerente'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPapel(p)}
                  className={`px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                    papel === p ? 'bg-[#f97316]/15 text-[#f97316]' : 'text-[#64748b] hover:text-[#e2e8f0]'
                  }`}
                >
                  {p === 'estagiario' ? 'Estagiário' : 'Gerente'}
                </button>
              ))}
            </div>

            {/* Reverificar gates */}
            <button
              onClick={() => { if (activeProjectId) void verificar(activeProjectId) }}
              disabled={verificando}
              className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-[#64748b] border border-[#1e293b] hover:text-[#e2e8f0] hover:border-[#334155] rounded-[2px] px-2.5 py-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={11} className={verificando ? 'animate-spin' : ''} />
              {verificando ? 'Verificando…' : 'Verificar agora'}
            </button>

            {/* Gerente pode esconder/mostrar a barra do topo */}
            {papel === 'gerente' && (
              <button
                onClick={() => setTrilhoVisivel(!trilhoVisivel)}
                className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-[#64748b] border border-[#1e293b] hover:text-[#e2e8f0] hover:border-[#334155] rounded-[2px] px-2.5 py-1.5 transition-colors"
                title="Mostrar/esconder a barra fina do trilho no topo do app"
              >
                {trilhoVisivel ? <EyeOff size={11} /> : <Eye size={11} />}
                Barra no topo: {trilhoVisivel ? 'ON' : 'OFF'}
              </button>
            )}
          </div>
        </div>

        {/* Abas internas */}
        <div className="flex items-center gap-0 border-b border-[#1e293b] mb-5 mt-3">
          {([
            { id: 'trilho' as const, label: 'Trilho da semana' },
            { id: 'manual' as const, label: 'Manual' },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              className={`px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
                aba === t.id
                  ? 'text-[#f97316] border-[#f97316]'
                  : 'text-[#64748b] border-transparent hover:text-[#e2e8f0]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {aba === 'trilho' ? <AbaTrilho /> : <AbaManual />}
      </div>
    </div>
  )
}

export default GuiaPage
