/**
 * rdoStatus.ts — um RDO está finalizado?
 *
 * ⚠️ Ausência de status = FINALIZADO. RDO antigo não tem o campo e sempre contou; mudar isso
 * agora tiraria da produção tudo que já foi apontado. Rascunho não alimenta nada (produção,
 * custo, FCP).
 *
 * Puro (sem store), para a ponte RDO WCR → FCP rodar em node:test.
 */
import type { RDO } from '@/types'

export function isRdoFinalized(rdo: Pick<RDO, 'status' | 'statusRevisao'>): boolean {
  if (rdo.status) return rdo.status !== 'rascunho'
  return rdo.statusRevisao !== 'rascunho'
}
