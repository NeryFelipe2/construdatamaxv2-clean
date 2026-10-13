import type { FcpCapitalLegado } from '@/hooks/useFcp'
import { brl } from './ui'
/**
 * Por uma versão: o capital que o cálculo SQL antigo daria, e por que o novo é diferente.
 * Regra 9 do pacote — número que muda sem causa escrita faz a pessoa confiar do jeito errado.
 */
export function CapitalLegado({ legado, novo }: { legado: FcpCapitalLegado; novo: number }) {
  return (
    <details className="rounded-lg border border-[#525252] bg-[#333333] px-4 py-2 text-xs text-[#a3a3a3]">
      <summary className="cursor-pointer select-none">
        Antes desta versão o sistema mostrava <span className="font-mono text-[#f5f5f5]">{brl(legado.capital_recomendado)}</span>{' '}
        (cálculo SQL legado) — diferença de <span className="font-mono text-[#f5f5f5]">{brl(novo - legado.capital_recomendado)}</span>. Por quê?
      </summary>
      <ul className="mt-2 space-y-1 list-disc pl-5">
        {legado.causas.map((c, i) => <li key={i}>{c}</li>)}
      </ul>
    </details>
  )
}
