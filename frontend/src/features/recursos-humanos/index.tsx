/**
 * RECURSOS HUMANOS — o antigo "Kanban Equipes", agora com abas internas.
 *
 * Por que existe: Kanban, Pessoal e Mão de Obra eram três itens soltos no menu
 * tratando do mesmo assunto (gente e maquinário). Aqui viram abas de um módulo
 * só, SEM que nenhum deles mude por dentro.
 *
 * REGRA DESTE ARQUIVO: ele é só a casca. Cada aba renderiza a página original,
 * intacta — mesma store, mesmas queries, mesmo comportamento. Nada de lógica
 * de negócio aqui. Se algo quebrar numa aba, o bug está no módulo dela, não
 * neste arquivo.
 *
 * A aba vem da URL (?aba=kanban|pessoal|mao-de-obra|horas-extras), então o
 * link é compartilhável e as rotas antigas conseguem redirecionar direto para
 * a aba certa (ver App.tsx).
 */
import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users, IdCard, HardHat, Clock } from 'lucide-react'

const KanbanPage = lazy(() => import('@/features/equipes-kanban/index'))
const PessoalPage = lazy(() => import('@/features/pessoal/index').then((m) => ({ default: m.PessoalPage })))
const MaoDeObraPage = lazy(() => import('@/features/mao-de-obra/index').then((m) => ({ default: m.MaoDeObraPage })))
const HorasExtrasPanel = lazy(() =>
  import('./components/HorasExtrasPanel').then((m) => ({ default: m.HorasExtrasPanel })),
)

export type RhAba = 'kanban' | 'pessoal' | 'mao-de-obra' | 'horas-extras'

const ABAS: { id: RhAba; label: string; icon: typeof Users; descricao: string }[] = [
  { id: 'kanban', label: 'Kanban do Dia', icon: Users, descricao: 'quem está em qual equipe hoje, e com qual maquinário' },
  { id: 'pessoal', label: 'Pessoal', icon: IdCard, descricao: 'cadastro único de funcionários, equipes e cargos' },
  { id: 'mao-de-obra', label: 'Mão de Obra', icon: HardHat, descricao: 'escala, postos, folha e frota' },
  { id: 'horas-extras', label: 'Horas Extras', icon: Clock, descricao: 'apuração de HE a partir da presença do RDO' },
]

function ehAba(v: string | null): v is RhAba {
  return v === 'kanban' || v === 'pessoal' || v === 'mao-de-obra' || v === 'horas-extras'
}

function Carregando() {
  return (
    <div className="flex items-center justify-center h-64 text-[#6b6b6b]">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-[#525252] border-t-[#f97316] rounded-full animate-spin" />
        <span className="text-sm">Carregando…</span>
      </div>
    </div>
  )
}

export function RecursosHumanosPage() {
  const [params, setParams] = useSearchParams()
  const bruta = params.get('aba')
  const aba: RhAba = ehAba(bruta) ? bruta : 'kanban'
  const atual = ABAS.find((a) => a.id === aba) ?? ABAS[0]

  function trocar(id: RhAba) {
    // replace: trocar de aba não deve encher o histórico do navegador
    const p = new URLSearchParams(params)
    p.set('aba', id)
    setParams(p, { replace: true })
  }

  return (
    <div className="flex flex-col h-full bg-[#2c2c2c]">
      {/* faixa de identidade do módulo + abas (padrão EvmHeader) */}
      <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
        <div className="px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316] shrink-0">
            <Users size={18} className="text-[#ffffff]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[#f5f5f5] font-semibold text-lg leading-tight">Recursos Humanos</h1>
            <p className="text-[#a3a3a3] text-xs truncate">{atual.descricao}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="flex px-6 gap-1 min-w-max">
            {ABAS.map((a) => {
              const Icone = a.icon
              const ativa = a.id === aba
              return (
                <button
                  key={a.id}
                  onClick={() => trocar(a.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg
                              transition-colors whitespace-nowrap border-b-2 ${
                                ativa
                                  ? 'text-[#f5f5f5] border-orange-500 bg-[#3d3d3d]'
                                  : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50'
                              }`}
                >
                  <Icone size={15} />
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Cada aba é a página original, sem alteração nenhuma por dentro. */}
      <div className="flex-1 min-h-0 overflow-auto">
        <Suspense fallback={<Carregando />}>
          {aba === 'kanban' && <KanbanPage />}
          {aba === 'pessoal' && <PessoalPage />}
          {aba === 'mao-de-obra' && <MaoDeObraPage />}
          {aba === 'horas-extras' && <HorasExtrasPanel />}
        </Suspense>
      </div>
    </div>
  )
}

export default RecursosHumanosPage
