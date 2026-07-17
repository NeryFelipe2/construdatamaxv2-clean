import { useState } from 'react'
import {
  BookOpen, LayoutDashboard, Waves, ClipboardList, Calculator, Users, Wrench,
  FileText, Map, ChevronDown, ChevronRight, CheckCircle2,
} from 'lucide-react'

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

export function GuiaPage() {
  const [aberto, setAberto] = useState<string | null>(MODULOS[0].id)

  return (
    <div className="min-h-full bg-[#1a1a1a] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-2.5 mb-1">
          <BookOpen size={20} className="text-[#f97316]" />
          <h1 className="text-lg font-bold text-[#f5f5f5]">Guia — Como trabalhar no site</h1>
        </div>
        <p className="text-xs text-[#a3a3a3] mb-6">
          Passo a passo de cada módulo, na ordem do dia a dia de obra: lançar produção → acompanhar Feito × A Fazer → medir → fechar financeiro.
        </p>

        <div className="flex flex-col gap-2.5">
          {MODULOS.map((m) => {
            const Icon = m.icon
            const isOpen = aberto === m.id
            return (
              <div key={m.id} className="rounded-xl border border-[#3f3f3f] bg-[#242424] overflow-hidden">
                <button
                  onClick={() => setAberto(isOpen ? null : m.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#2c2c2c] transition-colors"
                >
                  <Icon size={16} className="text-[#f97316] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#f5f5f5]">{m.label}</span>
                      <span className="text-[10px] font-mono text-[#6b6b6b]">{m.rota}</span>
                    </div>
                    <p className="text-xs text-[#a3a3a3] mt-0.5">{m.resumo}</p>
                  </div>
                  {isOpen ? (
                    <ChevronDown size={15} className="text-[#6b6b6b] shrink-0" />
                  ) : (
                    <ChevronRight size={15} className="text-[#6b6b6b] shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="border-t border-[#3f3f3f] px-4 py-3 flex flex-col gap-2.5 bg-[#1f1f1f]">
                    {m.passos.map((p, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-[#f5f5f5]">{p.titulo}</span>
                          <p className="text-xs text-[#a3a3a3] mt-0.5">{p.texto}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-8 rounded-xl border border-[#3f3f3f] bg-[#242424] px-4 py-3.5">
          <p className="text-xs font-bold text-[#f5f5f5] mb-1">Regra geral do site</p>
          <p className="text-xs text-[#a3a3a3]">
            Todo módulo segue o mesmo padrão: <strong className="text-[#f5f5f5]">lançar pelo formulário</strong> (um por vez) <strong className="text-[#f5f5f5]">ou importar um CSV</strong> (vários de uma vez, com prévia antes de gravar).
            Nenhuma tela mostra número inventado — se estiver zerado, é porque ainda falta lançar o dado real.
          </p>
        </div>
      </div>
    </div>
  )
}

export default GuiaPage
