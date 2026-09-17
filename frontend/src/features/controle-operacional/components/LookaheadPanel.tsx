/**
 * LookaheadPanel — aba 16, com o botão "virar restrição": a trava do serviço vai para
 * lps_restricoes, onde o Last Planner cobra a remoção.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, Check } from 'lucide-react'
import type { ContextoCalculo } from '../dominio/calculos'
import { TELAS } from '../dominio/telas'
import type { OpLookahead } from '../dominio/tipos'
import { TelaCrud } from './TelaCrud'
import { virarRestricao } from './gravacoesCompostas'
import { btnMini } from './ui'

export function LookaheadPanel({ ctx, projetoId, orgId, recarregar }: {
  ctx: ContextoCalculo; projetoId: string; orgId: string | null; recarregar: () => Promise<void>
}) {
  const [ocupado, setOcupado] = useState<string | null>(null)

  async function virar(lk: OpLookahead) {
    const codigo = ctx.dados.servicos.find((s) => s.id === lk.servico_id)?.codigo ?? '?'
    setOcupado(lk.id)
    const erro = await virarRestricao(lk, codigo, orgId)
    setOcupado(null)
    if (erro) window.alert(`Não gravou a restrição: ${erro}`)
    else await recarregar()
  }

  return (
    <TelaCrud
      tela={TELAS.lookahead} ctx={ctx} projetoId={projetoId} recarregar={recarregar}
      acoes={(l, calc) => {
        const lk = l as unknown as OpLookahead
        if (lk.lps_restricao_id) {
          return <Link to="/app/lps-lean?tab=restricoes" className={`${btnMini} !text-green-300`} title="já está no LPS"><Check size={12} /> no LPS</Link>
        }
        if (!calc.pendencias) return null
        return (
          <button className={btnMini} disabled={ocupado === lk.id} onClick={() => void virar(lk)} title="levar a trava para as restrições do LPS">
            <ShieldAlert size={12} /> virar restrição
          </button>
        )
      }}
    />
  )
}
