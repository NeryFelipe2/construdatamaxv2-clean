import { LayoutDashboard, Newspaper, Rocket } from 'lucide-react'
import type { Modelo, Visual } from './modelo'

const OPCOES: { id: Visual; rotulo: string; icone: typeof Rocket }[] = [
  { id: 'painel', rotulo: 'Painel', icone: LayoutDashboard },
  { id: 'missao', rotulo: 'Missão', icone: Rocket },
  { id: 'editorial', rotulo: 'Editorial', icone: Newspaper },
]

/** Troca entre os três visuais; cada visual estiliza pelo seu próprio prefixo (.pn, .ms, .ed). */
export function Seletor({ m }: { m: Modelo }) {
  return (
    <div className="gt-sel" role="tablist" aria-label="Visual da página">
      {OPCOES.map(({ id, rotulo, icone: I }) => (
        <button key={id} role="tab" aria-selected={m.visual === id} onClick={() => m.setVisual(id)}>
          <I size={13} /> <span>{rotulo}</span>
        </button>
      ))}
    </div>
  )
}
