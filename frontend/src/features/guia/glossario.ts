/**
 * glossario.ts — dicionário LPS/Lean em linguagem de obra (Fase 3, trilho guiado).
 *
 * Definições de 1-2 frases, sem jargão de consultoria: o público é estagiário e
 * encarregado. Usado pelo componente TermoLps (tooltip com borda pontilhada)
 * nos cards do trilho e onde mais precisar.
 */

export const GLOSSARIO: Record<string, string> = {
  PPC: 'Percentual do Plano Concluído: de tudo que a equipe prometeu na semana, quanto saiu de verdade. Prometeu 10, entregou 8 = PPC 80%.',
  CNC: 'Causa de Não Cumprimento: o porquê de uma tarefa prometida não ter saído (faltou material, chuva, máquina quebrada...). Sem o porquê, o erro se repete.',
  IRR: 'Índice de Remoção de Restrições: das pedras no caminho identificadas, quantas foram tiradas antes do prazo. Mede se o escritório está limpando a frente pro campo.',
  lookahead: 'Olhar pra frente: janela das próximas 4-6 semanas do cronograma, usada pra enxergar o serviço que vem aí e preparar o que falta antes de chegar lá.',
  'restrição': 'Qualquer coisa que impede o serviço de sair: material que não chegou, morador que não deixou, projeto sem aprovação. Tira-se a restrição ANTES de prometer a tarefa.',
  compromisso: 'Tarefa prometida pra semana, com dono (encarregado) e número (metros ou unidades). Prometeu, mede no fechamento.',
  takt: 'Ritmo de produção: o passo de marcha da obra — quantos dias cada frente gasta num trecho pra ninguém atropelar ninguém.',
  'linha de balanço': 'Gráfico rua × tempo: cada linha é uma frente andando pelas ruas. Linhas se cruzando = uma equipe vai dar de cara com a outra.',
  baseline: 'Foto do plano original, congelada. É contra ela que se mede atraso — se o plano muda toda semana, o atraso "some" no papel mas não na obra.',
  NS: 'Nota de Serviço: a ordem oficial da Sabesp pra executar um trecho (rua, extensão, diâmetro). Sem NS o serviço não é medido nem pago.',
  esteira: 'Sequência encadeada da ligação: quebra → caixinha → chumba → cloração → HM → baixa no app. Cada etapa alimenta a seguinte com 1 dia de defasagem.',
}
