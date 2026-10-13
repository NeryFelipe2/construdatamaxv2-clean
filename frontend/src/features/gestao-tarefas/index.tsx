/**
 * TAREFAS DA GESTÃO — as tarefas das listas de WhatsApp, por pessoa, frente e prazo.
 * Três visuais tirados dos design systems que o Felipe escolheu:
 *   PAINEL    = dashboard escuro teal do Masterclass (Cadence)
 *   MISSÃO    = painel de controle IX-7, com a sonda em Marte
 *   EDITORIAL = NØEMA, papel claro e número gigante
 * Dados em dados.ts; cálculos em modelo.ts; "feita" fica só neste navegador.
 */
import './estilos.css'
import { useTarefas } from './modelo'
import { VisualPainel } from './VisualPainel'
import { VisualMissao } from './VisualMissao'
import { VisualEditorial } from './VisualEditorial'

export function GestaoTarefasPage() {
  const m = useTarefas()
  return (
    <div className="gt-root" key={m.visual}>
      {m.visual === 'painel' && <VisualPainel m={m} />}
      {m.visual === 'missao' && <VisualMissao m={m} />}
      {m.visual === 'editorial' && <VisualEditorial m={m} />}
    </div>
  )
}
