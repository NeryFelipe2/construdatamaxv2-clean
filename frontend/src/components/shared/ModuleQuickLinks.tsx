import { Link, useLocation } from 'react-router-dom'
import {
  ClipboardList, Calendar, Wrench, FolderKanban, Radio,
  FileSearch, PackageSearch, Users, Cpu, LayoutDashboard,
} from 'lucide-react'

const ALL_MODULES = [
  { label: 'Relatório 360',  icon: ClipboardList,  to: '/app/relatorio360'        },
  { label: 'Agenda',         icon: Calendar,        to: '/app/agenda'              },
  { label: 'Gest. Equip.',   icon: Wrench,          to: '/app/gestao-equipamentos' },
  { label: 'Projetos',       icon: FolderKanban,    to: '/app/projetos'            },
  { label: 'Torre Controle', icon: Radio,           to: '/app/torre-de-controle'   },
  { label: 'Pré-Constr.',    icon: FileSearch,      to: '/app/pre-construcao'      },
  { label: 'Suprimentos',    icon: PackageSearch,   to: '/app/suprimentos'         },
  { label: 'Mão de Obra',    icon: Users,           to: '/app/mao-de-obra'         },
  { label: 'Frota',          icon: Cpu,             to: '/app/otimizacao-frota'    },
  { label: 'Gestão 360',     icon: LayoutDashboard, to: '/app/gestao-360'          },
]

interface Props {
  /** Routes to exclude from the list (typically the current module) */
  exclude?: string[]
  className?: string
}

export function ModuleQuickLinks({ exclude = [], className }: Props) {
  const { pathname } = useLocation()
  // Aceita exclude com ou sem o prefixo /app (call-sites antigos passam '/gestao-360')
  const norm = (path: string) => (path.startsWith('/app/') ? path : `/app${path}`)
  const visible = ALL_MODULES.filter(
    (m) => !exclude.some((e) => norm(e) === m.to) && m.to !== pathname
  )

  if (visible.length === 0) return null

  return (
    <div className={className}>
      <p className="text-[#6b6b6b] text-[10px] font-semibold uppercase tracking-wider mb-2">
        Módulos relacionados
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#525252] text-[#6b6b6b] text-[11px] font-medium hover:border-[#f97316]/50 hover:text-[#f97316] transition-colors"
          >
            <m.icon size={11} />
            {m.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
