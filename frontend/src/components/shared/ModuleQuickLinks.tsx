import { Link, useLocation } from 'react-router-dom'
import {
  ClipboardList, Calendar, Truck, Wrench, FolderKanban, Radio,
  FileSearch, PackageSearch, Users, Cpu, LayoutDashboard,
} from 'lucide-react'

const ALL_MODULES = [
  { label: 'Relatório 360',  icon: ClipboardList,  to: '/relatorio360'        },
  { label: 'Agenda',         icon: Calendar,        to: '/agenda'              },
  { label: 'Equipamentos',   icon: Truck,           to: '/equipamentos'        },
  { label: 'Gest. Equip.',   icon: Wrench,          to: '/gestao-equipamentos' },
  { label: 'Projetos',       icon: FolderKanban,    to: '/projetos'            },
  { label: 'Torre Controle', icon: Radio,           to: '/torre-de-controle'   },
  { label: 'Pré-Constr.',    icon: FileSearch,      to: '/pre-construcao'      },
  { label: 'Suprimentos',    icon: PackageSearch,   to: '/suprimentos'         },
  { label: 'Mão de Obra',    icon: Users,           to: '/mao-de-obra'         },
  { label: 'Frota',          icon: Cpu,             to: '/otimizacao-frota'    },
  { label: 'Gestão 360',     icon: LayoutDashboard, to: '/gestao-360'          },
]

interface Props {
  /** Routes to exclude from the list (typically the current module) */
  exclude?: string[]
  className?: string
}

export function ModuleQuickLinks({ exclude = [], className }: Props) {
  const { pathname } = useLocation()
  const visible = ALL_MODULES.filter(
    (m) => !exclude.includes(m.to) && m.to !== pathname
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
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#20406a] text-[#6b6b6b] text-[11px] font-medium hover:border-[#2abfdc]/50 hover:text-[#2abfdc] transition-colors"
          >
            <m.icon size={11} />
            {m.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
