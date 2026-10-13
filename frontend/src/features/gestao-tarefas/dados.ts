/**
 * Tarefas da gestão vindas das listas de WhatsApp de 02/10, 08/10 e 12-13/10/2026.
 * Itens repetidos entram uma vez, com a data da primeira vez que apareceram.
 * Nada aqui é inventado: o que não tinha prazo ficou sem prazo.
 */
export type Frente =
  | 'Guarujá' | 'Bertioga' | 'Santos' | 'Universaliza' | 'Joaquim' | 'Vita' | 'Global' | 'Geral'

export interface Tarefa {
  id: string
  responsavel: string
  tarefa: string
  desde: string // AAAA-MM-DD, primeira aparição
  prazo?: string // AAAA-MM-DD, só quando a lista disse
  frente: Frente
  nota?: string
}

export const RESPONSAVEIS = ['Ícaro', 'Sérgio', 'Sidnei', 'Maiara', 'Gabriel'] as const

export const TAREFAS: Tarefa[] = [
  // Ícaro
  { id: 'ic-01', responsavel: 'Ícaro', frente: 'Guarujá', desde: '2026-10-02',
    tarefa: 'Falar com o Sidnei sobre as contratações do Guarujá (encarregado e pessoal) e passar o panorama',
    nota: 'Aparece desde 02/10 e não foi fechada.' },
  { id: 'ic-02', responsavel: 'Ícaro', frente: 'Vita', desde: '2026-10-08', tarefa: 'Contratar um caminhão para a Vita' },
  { id: 'ic-03', responsavel: 'Ícaro', frente: 'Vita', desde: '2026-10-08', tarefa: 'Ver o adiantamento da Vita com o Sérgio (pela WCR e pela EMS)' },
  { id: 'ic-04', responsavel: 'Ícaro', frente: 'Universaliza', desde: '2026-10-08', tarefa: 'Ver com a Maiara a contratação do pessoal do Universaliza e da Global' },
  { id: 'ic-05', responsavel: 'Ícaro', frente: 'Vita', desde: '2026-10-13', tarefa: 'Ver o novo local da elevatória 10 da Vita' },
  { id: 'ic-06', responsavel: 'Ícaro', frente: 'Bertioga', desde: '2026-10-13', tarefa: 'Situação da programação de Bertioga e Guarujá' },
  { id: 'ic-07', responsavel: 'Ícaro', frente: 'Geral', desde: '2026-10-13', tarefa: 'Situação das contratações de Bertioga e Guarujá, de Santos e do Universaliza' },
  { id: 'ic-08', responsavel: 'Ícaro', frente: 'Joaquim', desde: '2026-10-13', prazo: '2026-10-13',
    tarefa: 'Contratar o pessoal do Joaquim', nota: 'Hoje é a última data.' },
  { id: 'ic-09', responsavel: 'Ícaro', frente: 'Joaquim', desde: '2026-10-13', tarefa: 'Saber quantas pessoas vêm com o Joaquim, para preparar alojamento, transporte e mobilização' },
  // Sérgio
  { id: 'se-01', responsavel: 'Sérgio', frente: 'Global', desde: '2026-10-08', tarefa: 'Emissão da nota fiscal do adiantamento da Global Guarujá, alinhada com o Ícaro' },
  { id: 'se-02', responsavel: 'Sérgio', frente: 'Vita', desde: '2026-10-13', tarefa: 'Nota fiscal da Vita, pela WCR e pela EMS' },
  { id: 'se-03', responsavel: 'Sérgio', frente: 'Geral', desde: '2026-10-13', tarefa: 'B.O. dos equipamentos (fogão, geladeira, máquinas em geral)' },
  { id: 'se-04', responsavel: 'Sérgio', frente: 'Universaliza', desde: '2026-10-13', tarefa: 'Contrato do Universaliza' },
  { id: 'se-05', responsavel: 'Sérgio', frente: 'Geral', desde: '2026-10-13', tarefa: 'Fornecedores para negociar' },
  // Sidnei
  { id: 'si-01', responsavel: 'Sidnei', frente: 'Geral', desde: '2026-10-13', tarefa: 'Pegar o carro' },
  { id: 'si-02', responsavel: 'Sidnei', frente: 'Vita', desde: '2026-10-13', tarefa: 'Ir à Vita ver o novo local da elevatória' },
  { id: 'si-03', responsavel: 'Sidnei', frente: 'Geral', desde: '2026-10-13', tarefa: 'Conversar com o Jhonatan sobre o que ele falou com o Gerson' },
  { id: 'si-04', responsavel: 'Sidnei', frente: 'Geral', desde: '2026-10-13', tarefa: 'Alinhar tudo isso com o Ícaro' },
  // Maiara
  { id: 'ma-01', responsavel: 'Maiara', frente: 'Geral', desde: '2026-10-13', tarefa: 'Situação das contratações de Bertioga e Guarujá, de Santos e do Universaliza' },
  { id: 'ma-02', responsavel: 'Maiara', frente: 'Geral', desde: '2026-10-13', tarefa: 'Mandar planilha de quem está sendo contratado: quem já fez exame e quem nem começou' },
  // Gabriel
  { id: 'ga-01', responsavel: 'Gabriel', frente: 'Geral', desde: '2026-10-02',
    tarefa: 'Ligar nos números passados para contratar pessoal (com ajuda de Bruno, Ícaro e Maiara) e passar o resultado',
    nota: 'Aberta desde 02/10.' },
  { id: 'ga-02', responsavel: 'Gabriel', frente: 'Geral', desde: '2026-10-02',
    tarefa: 'Acompanhar a documentação até não ficar nenhuma pendência',
    nota: 'Estava com o Bruno em 02/10 e passou para o Gabriel em 08/10.' },
]
