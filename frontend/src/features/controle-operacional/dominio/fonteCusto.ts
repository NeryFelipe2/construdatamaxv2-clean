/**
 * fonteCusto.ts — DE ONDE vêm os números de custo que alimentam as metas.
 *
 * Hoje há duas fontes possíveis para o mesmo contrato:
 *   - `fonteOp`:  as tabelas op_* (aba 01A da planilha rev16 + folha agregada da equipe);
 *   - `fonteFcp`: o Fluxo de Caixa Projetado (FCP) da obra.
 *
 * `op_parametros.fonte_custo` ('op' | 'fcp') escolhe qual vale. As telas usam só a
 * interface, então trocar a fonte não mexe em cálculo nenhum.
 *
 * Vazio nunca é zero: cada campo é `null` quando a fonte não tem o dado.
 */
import type { DadosOp, FolhaAgregada } from './tipos'
import { custoMensal, folhaMensal, impostoTotal } from './calculos'

export interface FonteCustoContrato {
  /** R$/mês (01A TOTAL MENSAL) */
  custoMensal: number | null
  /** fração sobre a medição (01A C47) */
  imposto: number | null
  /** fração (01 C33/D33) */
  margemAlvo: number | null
  /** dias entre o fechamento e o crédito (01 C19) */
  defasagemDias: number | null
  /** base das metas diárias (01 C20) */
  diasUteisMes: number | null
}

export function fonteOp(d: DadosOp, folha: FolhaAgregada | null): FonteCustoContrato {
  const p = d.parametros && !d.parametros.deleted_at ? d.parametros : null
  const custo = custoMensal(d.custos, folhaMensal(d.membros, folha, p))
  return {
    custoMensal: custo.total,
    imposto: impostoTotal(d.tributos),
    margemAlvo: p?.margem_alvo ?? null,
    defasagemDias: p?.defasagem_recebimento ?? null,
    diasUteisMes: p?.dias_uteis_mes ?? null,
  }
}

// TODO(fonteFcp): o motor do FCP em TypeScript está sendo escrito em outra sessão
// (hooks/useFcp.ts + dre-financeiro). Quando existir, implementar aqui:
//
//   export function fonteFcp(fcpObra: <tipo do motor FCP>): FonteCustoContrato
//
// mapeando custo total da obra (fcp_custo_obra.total), imposto_aliquota, a margem do
// cenário adotado (fcp_margem), defasagem_dias e dias_mes. NÃO importar useFcp.ts aqui
// (hook com Supabase); receber os números já calculados. Enquanto isso, fonte_custo='fcp'
// cai em `fonteOp` e a tela avisa.
export function fonteEscolhida(d: DadosOp, folha: FolhaAgregada | null): { fonte: FonteCustoContrato; aviso: string | null } {
  const pedida = d.parametros?.fonte_custo ?? 'op'
  if (pedida === 'fcp') {
    return {
      fonte: fonteOp(d, folha),
      aviso: 'fonte de custo "FCP" ainda não está ligada neste módulo — usando o banco de custos da aba 01A.',
    }
  }
  return { fonte: fonteOp(d, folha), aviso: null }
}
