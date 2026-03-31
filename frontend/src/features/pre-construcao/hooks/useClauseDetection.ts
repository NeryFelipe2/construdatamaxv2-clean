import { nanoid } from 'nanoid'
import type { ContractClause } from '@/types'

export function detectClauses(text: string): ContractClause[] {
  if (!text || text.trim().length === 0) return []

  const clauses: ContractClause[] = []

  // 1. CRITICAL — Multa por atraso
  const multaRegex = /multa.*?(\d+[\.,]?\d*)\s*%/i
  const multaMatch = multaRegex.exec(text)
  if (multaMatch) {
    const rawVal = multaMatch[1].replace(',', '.')
    const val = parseFloat(rawVal)
    if (!isNaN(val) && val > 1) {
      const excerpt = multaMatch[0].slice(0, 120)
      clauses.push({
        id: nanoid(),
        severity: 'critical',
        type: 'Multa por Atraso Elevada',
        excerpt,
        explanation: `Cláusula prevê multa de ${val}% por dia/semana de atraso, o que pode representar um passivo financeiro significativo ao longo do contrato.`,
        recommendation: 'Negocie limite máximo de 1% ao mês ou 10% do contrato total.',
      })
    }
  }

  // 2. CRITICAL — Rescisão unilateral sem aviso prévio
  const rescisaoRegex = /rescisão\s*(imediata|unilateral|sem\s*aviso)/i
  const rescisaoMatch = rescisaoRegex.exec(text)
  if (rescisaoMatch) {
    clauses.push({
      id: nanoid(),
      severity: 'critical',
      type: 'Rescisão Unilateral sem Aviso Prévio',
      excerpt: rescisaoMatch[0].slice(0, 120),
      explanation: 'Contratante pode rescindir o contrato sem prazo de notificação, expondo o contratado a prejuízos com mobilização, mão de obra e materiais já adquiridos.',
      recommendation: 'Exija prazo mínimo de 30 dias de aviso prévio e indenização proporcional.',
    })
  }

  // 3. CRITICAL — Responsabilidade ilimitada
  const responsabilidadeRegex = /responsabilidade\s*(solidária|ilimitada|total)/i
  const responsabilidadeMatch = responsabilidadeRegex.exec(text)
  if (responsabilidadeMatch) {
    clauses.push({
      id: nanoid(),
      severity: 'critical',
      type: 'Responsabilidade Ilimitada',
      excerpt: responsabilidadeMatch[0].slice(0, 120),
      explanation: 'Cláusula não estabelece limite de responsabilidade, podendo expor o contratado a valores muito superiores ao contrato em caso de litígio.',
      recommendation: 'Negocie cap de responsabilidade limitado ao valor do contrato.',
    })
  }

  // 4. WARNING — Ausência de cláusula de reajuste
  const temReajuste = /reajuste|INCC|IPCA|IGPM/i.test(text)
  if (!temReajuste && text.length > 500) {
    clauses.push({
      id: nanoid(),
      severity: 'warning',
      type: 'Ausência de Cláusula de Reajuste',
      excerpt: 'Cláusula de reajuste de preços não identificada no documento.',
      explanation: 'Contratos sem reajuste expõem o contratado a perdas com inflação ao longo da execução da obra, especialmente em projetos de longa duração.',
      recommendation: 'Inclua cláusula de reajuste atrelada a índice INCC ou IPCA.',
    })
  }

  // 5. WARNING — Prazo de pagamento inferior a 30 dias
  const pagamentoRegex = /pagamento\s*(?:em|no\s*prazo\s*de)?\s*(\d+)\s*(?:dias|d\.)/i
  const pagamentoMatch = pagamentoRegex.exec(text)
  if (pagamentoMatch) {
    const dias = parseInt(pagamentoMatch[1], 10)
    if (!isNaN(dias) && dias < 30) {
      clauses.push({
        id: nanoid(),
        severity: 'warning',
        type: 'Prazo de Pagamento Inferior a 30 Dias',
        excerpt: pagamentoMatch[0].slice(0, 120),
        explanation: 'Prazo de pagamento curto pode gerar problemas de fluxo de caixa, especialmente em obras com grandes volumes de material e mão de obra.',
        recommendation: 'Negocie pagamento em no mínimo 28-30 dias após medição aprovada.',
      })
    }
  }

  // 6. WARNING — Especificação fechada por marca
  const marcaRegex = /(produto|material|equipamento)\s*(?:de\s*)?(?:marca|fabricante)\s*(?:aprovado|especificado|homologado|lista\s*fechada)/i
  const marcaMatch = marcaRegex.exec(text)
  if (marcaMatch) {
    clauses.push({
      id: nanoid(),
      severity: 'warning',
      type: 'Especificação Fechada por Marca',
      excerpt: marcaMatch[0].slice(0, 120),
      explanation: 'Contrato exige produto de marca específica, limitando concorrência e podendo elevar custos de aquisição sem justificativa técnica.',
      recommendation: "Solicite inclusão de 'ou similar tecnicamente equivalente'.",
    })
  }

  // 7. INFO — Certificações especiais
  const certRegex = /(?:certificação|certificado|ISO\s*\d+|ABNT\s*NBR|ACI\s*\d+|ASTM\s*[A-Z]\d+)/i
  const certMatch = certRegex.exec(text)
  if (certMatch) {
    clauses.push({
      id: nanoid(),
      severity: 'info',
      type: 'Certificações Especiais Exigidas',
      excerpt: certMatch[0].slice(0, 120),
      explanation: 'Documento referencia certificações técnicas específicas que podem exigir treinamento, auditoria ou custos adicionais de conformidade.',
      recommendation: 'Verifique disponibilidade e custo de obtenção das certificações listadas.',
    })
  }

  // 8. INFO — Restrições de origem de materiais
  const origemRegex = /(produto\s*importado|importação\s*direta|fabricação\s*nacional|produto\s*de\s*origem)/i
  const origemMatch = origemRegex.exec(text)
  if (origemMatch) {
    clauses.push({
      id: nanoid(),
      severity: 'info',
      type: 'Restrições de Origem de Materiais',
      excerpt: origemMatch[0].slice(0, 120),
      explanation: 'Documento menciona restrições ou preferências de origem dos materiais, o que pode impactar na cadeia de suprimentos e nos prazos de entrega.',
      recommendation: 'Confirme disponibilidade no mercado nacional e impacto em custos e prazos.',
    })
  }

  return clauses
}
