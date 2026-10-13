/**
 * O que os RDOs WCR dizem sobre a produção da semana — para o Fluxo de Caixa Projetado.
 *
 * ─── A DECISÃO MAIS IMPORTANTE DESTE ARQUIVO ──────────────────────────────────
 * ⚠️ **Ele não escreve nada.** É só conta. Nenhuma função daqui toca no `fcpStore`, e nenhuma
 * ponte dispara do `rdoStore` quando um RDO é salvo. O plano só muda quando alguém aperta
 * "Adotar" na tela do FCP.
 *
 * O motivo é o de quem lê o número: o capital recomendado do FCP é o que a diretoria usa para
 * decidir quanto dinheiro a obra precisa. Se ele mudasse sozinho a cada RDO salvo no campo,
 * mudaria entre uma reunião e outra sem ninguém saber por quê. Aqui a máquina calcula e mostra a
 * diferença; a pessoa decide se aquilo vira plano.
 *
 * ─── E A SEGUNDA ──────────────────────────────────────────────────────────────
 * ⚠️ **Só entra o que é UN.** `PRA` e `PRE` são metros de rede; as outras 11 siglas são contagem
 * de serviço. `medicaoDaSemana` multiplica a produção pelo **ticket por ligação** — jogar metro de
 * rede nessa conta inflaria o faturamento projetado e, com ele, o capital recomendado. Os metros
 * voltam num campo próprio, para a tela poder mostrá-los sem somá-los.
 */
import type { RDO } from '@/types'
// No ConstruData: o PlanoFcp é o formato de comparação de utils/fcp/reimportarPlano (as premissas
// e o realizado vêm das tabelas via fcpDoBanco), e isRdoFinalized mora num arquivo puro.
import type { PlanoFcp } from '@/features/dre-financeiro/utils/fcp/reimportarPlano'
import type { Semana } from '@/features/dre-financeiro/utils/fcp/tipos'
import { isRdoFinalized } from './rdoStatus'

/** Uma obra e a cidade do FCP que ela representa. */
export interface ObraVinculada { siteId: string; cidadeId: string }

/**
 * As obras que declararam a que cidade do FCP pertencem.
 *
 * Obra sem `fcpCidadeId` simplesmente não aparece — não alimenta o FCP, e a tela diz isso.
 */
export function vinculosDeObra(sites: Array<{ id: string; contrato?: { fcpCidadeId?: string } | null }>): ObraVinculada[] {
  const out: ObraVinculada[] = []
  for (const s of sites) {
    const cidadeId = s.contrato?.fcpCidadeId
    if (cidadeId) out.push({ siteId: s.id, cidadeId })
  }
  return out
}

/** É um RDO WCR finalizado? Rascunho não conta em lugar nenhum, e aqui também não. */
export function ehWcrFinalizado(r: RDO): boolean {
  return r.template === 'wcr' && !!r.wcr && isRdoFinalized(r)
}

/**
 * Os RDOs de uma semana, para as obras de uma cidade.
 *
 * ⚠️ Deduplica por `id`. A lista de RDOs pode chegar com repetição (merge de pull, por exemplo), e
 * contar o mesmo RDO duas vezes dobraria a produção da semana sem deixar rastro.
 */
export function rdosDaSemana(rdos: RDO[], siteIds: string[], semana: Semana): RDO[] {
  const daObra = new Set(siteIds)
  const vistos = new Set<string>()
  const out: RDO[] = []
  for (const r of rdos) {
    if (!ehWcrFinalizado(r)) continue
    if (!r.siteId || !daObra.has(r.siteId)) continue
    if (r.date < semana.inicio || r.date > semana.fim) continue
    if (vistos.has(r.id)) continue
    vistos.add(r.id)
    out.push(r)
  }
  return out
}

export interface ProducaoDosRdos {
  /** Serviços contados (só as siglas de unidade `UN`). É isto que o FCP entende. */
  unidades: number
  /** Metros de rede — mostrados à parte, NUNCA somados às unidades. */
  metros: number
  /** Quantas siglas apareceram sem número. Ausente não é zero. */
  semMedida: number
  /** Quantos RDOs entraram na conta. */
  rdos: number
}

export function producaoDosRdos(rdos: RDO[]): ProducaoDosRdos {
  let unidades = 0
  let metros = 0
  let semMedida = 0
  for (const r of rdos) {
    for (const l of r.wcr?.producao ?? []) {
      const bruto = String(l.quantidade ?? '').trim()
      if (bruto === '') { semMedida += 1; continue }
      const n = Number(bruto.replace(/\./g, '').replace(',', '.'))
      if (!Number.isFinite(n)) { semMedida += 1; continue }
      if (l.unidade === 'M') metros += n
      else unidades += n
    }
  }
  return { unidades, metros, semMedida, rdos: rdos.length }
}

export interface DivergenciaDaSemana {
  cidadeId: string
  semana: number
  /** O que está gravado no plano hoje: o lançado, ou `undefined` quando a semana usa o previsto. */
  noPlano?: number
  /** O que os RDOs finalizados da semana somam. */
  dosRdos: number
  /** `dosRdos − (noPlano ?? previsto)`. */
  diferenca: number
  /** Metros de rede da semana, à parte. */
  metros: number
  semMedida: number
  rdos: number
}

/**
 * Compara, semana a semana e cidade a cidade, o que o plano diz com o que os RDOs somam.
 *
 * Só devolve as semanas em que existe RDO — semana sem apontamento nenhum não é divergência, é
 * ausência de informação, e listá-la como "0 contra 96,7" convidaria alguém a adotar zero.
 */
export function divergenciasDoPlano(
  plano: PlanoFcp,
  rdos: RDO[],
  vinculos: ObraVinculada[],
  semanas: Semana[],
  previstoPorCidadeSemana: (cidadeId: string, semana: number) => number,
): DivergenciaDaSemana[] {
  const out: DivergenciaDaSemana[] = []
  for (const cidade of plano.premissas.cidades) {
    const siteIds = vinculos.filter((v) => v.cidadeId === cidade.id).map((v) => v.siteId)
    if (!siteIds.length) continue
    for (const semana of semanas) {
      const daSemana = rdosDaSemana(rdos, siteIds, semana)
      if (!daSemana.length) continue
      const p = producaoDosRdos(daSemana)
      const noPlano = plano.realizado[cidade.id]?.[semana.numero]
      const base = noPlano ?? previstoPorCidadeSemana(cidade.id, semana.numero)
      out.push({
        cidadeId: cidade.id,
        semana: semana.numero,
        noPlano,
        dosRdos: p.unidades,
        diferenca: p.unidades - base,
        metros: p.metros,
        semMedida: p.semMedida,
        rdos: p.rdos,
      })
    }
  }
  return out
}

/**
 * O vínculo no ConstruData: cada obra do FCP (`fcp_obra`) aponta para o projeto dono
 * (`fcp_obra.projeto_id`, migration 031), e o RDO guarda o projeto em `siteId`.
 */
export function vinculosDoFcp(obras: Array<{ id: string; projeto_id: string | null }>): ObraVinculada[] {
  return obras.filter((o) => o.projeto_id).map((o) => ({ siteId: o.projeto_id as string, cidadeId: o.id }))
}
