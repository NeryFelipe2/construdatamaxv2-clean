/**
 * Equipes oficiais da obra WCR — fonte: ORGANOGRAMA DE EQUIPES (05/07/2026).
 * Contrato Sabesp 13.546/25-00 · Efetivo de campo: 34 pessoas · 10 equipes · 4 frentes.
 * Alimenta o Kanban de Equipes (planejado de manhã × realizado de tarde × desvio)
 * e a compilação do resumo diário pro RDO.
 */

export type EquipeStatus = 'planejado' | 'em_campo' | 'concluido' | 'desvio'

export type FrenteId = 'sul' | 'norte_agua' | 'norte_esgoto' | 'retorno'

export interface Membro {
  nome: string
  funcao: string
  id?: string // id do registro em equipe_membros (Supabase) — ausente nos dados estáticos/fallback
}

export interface EquipeCard {
  id: string
  equipe: string          // "Equipe João Batista"
  lider: string
  encarregado: string     // grupo do organograma (Robert/Jesse/Wellington/Jailton)
  frente: FrenteId
  foco: string            // serviço padrão da equipe
  local: string           // rua/trecho do dia (editável no quadro)
  membros: Membro[]
  aContratar?: boolean
  status: EquipeStatus
  motivoDesvio?: string
}

export const FRENTE_META: Record<FrenteId, { label: string; cor: string }> = {
  sul:          { label: 'Boi Malhado — Sul',          cor: '#f59e0b' },
  norte_agua:   { label: 'Boi Malhado — Norte Água',   cor: '#22c55e' },
  norte_esgoto: { label: 'Boi Malhado — Norte Esgoto', cor: '#38bdf8' },
  retorno:      { label: 'Retorno Água/Esgoto',        cor: '#a78bfa' },
}

/**
 * De-para FrenteId → núcleo (nome usado pelo motor `useMasterScheduleEngine`,
 * que agrega por núcleo do projeto ativo — "Boi Malhado" / "Sakura" /
 * "Comunidade do Retorno" — e não por frente).
 *
 * Confirmado por `FRENTE_META` acima: os labels das frentes 'sul',
 * 'norte_agua' e 'norte_esgoto' começam com "Boi Malhado —", e 'retorno'
 * é "Retorno Água/Esgoto" → núcleo "Comunidade do Retorno" (mesmo nome usado
 * em `DEMO_PROJETOS` / `nucleoPadrao` em `src/store/projectContext.ts`).
 * Não há frente hoje mapeada para "Sakura" — se/quando existir, adicionar aqui.
 */
export const FRENTE_TO_NUCLEO: Record<FrenteId, string> = {
  sul:          'Boi Malhado',
  norte_agua:   'Boi Malhado',
  norte_esgoto: 'Boi Malhado',
  retorno:      'Comunidade do Retorno',
}

export const EQUIPE_STATUS_LABEL: Record<EquipeStatus, string> = {
  planejado: 'Planejado (manhã)',
  em_campo: 'Em campo',
  concluido: 'Concluído',
  desvio: 'Desvio',
}

export const EQUIPE_STATUS_ORDER: EquipeStatus[] = ['planejado', 'em_campo', 'concluido', 'desvio']

export const WCR_EQUIPES: EquipeCard[] = [
  // ── Frente Boi Malhado parte SUL (encarregado Robert · 2 equipes · 9 pessoas) ──
  {
    id: 'joao-batista', equipe: 'Equipe João Batista', lider: 'João Batista', encarregado: 'Robert',
    frente: 'sul', foco: 'Rede, caixa e ramal', local: '—', status: 'planejado',
    membros: [
      { nome: 'João Batista de Jesus Teixeira', funcao: 'encanador IV' },
      { nome: 'Diego dos Santos', funcao: 'encanador' },
      { nome: 'Heliel da Silva Saraiva', funcao: 'encanador III' },
      { nome: 'Robert Vieira', funcao: 'encarregado' },
    ],
  },
  {
    id: 'edson', equipe: 'Equipe Edson', lider: 'Edson', encarregado: 'Robert',
    frente: 'sul', foco: 'Caixa e ramal', local: '—', status: 'planejado',
    membros: [
      { nome: 'Edson da Silva Moreira', funcao: 'encanador IV' },
      { nome: 'Pedro da Silva Fonseca', funcao: 'pedreiro' },
      { nome: 'Almir Gomes dos Santos Jr', funcao: 'ajudante' },
      { nome: 'Israel Neves', funcao: 'operador' },
      { nome: 'Marcos José Farias', funcao: 'encanador III' },
    ],
  },

  // ── Frente Boi Malhado parte NORTE ÁGUA (encarregado Jesse · 3 equipes · 15 pessoas) ──
  {
    id: 'ediel', equipe: 'Equipe Ediel', lider: 'Ediel', encarregado: 'Jesse',
    frente: 'norte_agua', foco: 'Rede de água', local: '—', status: 'planejado',
    membros: [
      { nome: 'Cristian Richard Simoneto de Araújo', funcao: 'encanador I' },
      { nome: 'Cristiano dos Santos', funcao: 'ajudante' },
      { nome: 'Leonardo Paulo dos Santos', funcao: 'ajudante' },
      { nome: 'Damião Firmino dos Santos', funcao: 'pedreiro I' },
      { nome: 'Ediel Novais', funcao: 'encanador I' },
    ],
  },
  {
    id: 'jesse', equipe: 'Equipe Jesse', lider: 'Jesse', encarregado: 'Jesse',
    frente: 'norte_agua', foco: 'Ligações de água', local: '—', status: 'planejado',
    membros: [
      { nome: 'Patrick Moura da Silva', funcao: 'ajudante' },
      { nome: 'Fábio Francisco do Nascimento', funcao: 'ajudante' },
      { nome: 'Anderson Marques Lobato', funcao: 'ajudante' },
      { nome: 'Breno Eduardo', funcao: 'ajudante' },
      { nome: 'Marcelo Camargo', funcao: 'encanador I' },
    ],
  },
  {
    id: 'michael-douglas', equipe: 'Equipe Michael Douglas (Mazinho)', lider: 'Michael Douglas', encarregado: 'Jesse',
    frente: 'norte_agua', foco: 'Caixas U.M.A', local: '—', status: 'planejado',
    membros: [
      { nome: 'Michael Douglas Teles Mascarenhas', funcao: 'pedreiro' },
      { nome: 'Marcos Vinicius dos Santos Nascimento', funcao: 'ajudante' },
      { nome: 'Serafim Antônio dos Santos', funcao: 'encanador' },
      { nome: 'Ederson Santos Cardoso', funcao: 'encanador III' },
      { nome: 'Paulo Henrique', funcao: 'ajudante' },
    ],
  },

  // ── Frente Boi Malhado parte NORTE ESGOTO (encarregado Wellington · 2 equipes · 11 pessoas) ──
  {
    id: 'rodrigo', equipe: 'Equipe Rodrigo', lider: 'Rodrigo', encarregado: 'Wellington',
    frente: 'norte_esgoto', foco: 'Rede, caixa e ramal (esgoto)', local: '—', status: 'planejado',
    membros: [
      { nome: 'Leonardo Figueiredo', funcao: 'pedreiro' },
      { nome: 'José Reginaldo Rafael Bezerra', funcao: 'pedreiro' },
      { nome: 'Igor Barbosa', funcao: 'ajudante' },
      { nome: 'Wesley Leite da Silva', funcao: 'ajudante' },
      { nome: 'Wellington Luís de Morais', funcao: 'ajudante' },
      { nome: 'Rodrigo da Silva', funcao: 'encanador IV' },
    ],
  },
  {
    id: 'jose-claudino', equipe: 'Equipe José Claudino', lider: 'José Claudino', encarregado: 'Wellington',
    frente: 'norte_esgoto', foco: 'Rede, caixa e ramal (esgoto)', local: '—', status: 'planejado',
    membros: [
      { nome: 'José Claudino da Silva', funcao: 'encarregado' },
      { nome: 'Juan Carlos Garcias', funcao: 'operador' },
      { nome: 'Felipe Gleison Rodrigues da Silva', funcao: 'pedreiro' },
      { nome: 'Cícero da Silva Gomes', funcao: 'ajudante' },
      { nome: 'Márcio Matias de Oliveira', funcao: 'ajudante' },
    ],
  },

  // ── Frente RETORNO Água e Esgoto (encarregado Jailton · 3 equipes · 15 pessoas · A CONTRATAR) ──
  {
    id: 'jailson', equipe: 'Equipe Jailson', lider: 'Jailson', encarregado: 'Jailton',
    frente: 'retorno', foco: 'Rede + caixa e ramal', local: '—', status: 'planejado', aContratar: true,
    membros: [
      { nome: 'Jailson Abílio da Silva', funcao: 'encarr. obras II' },
      { nome: 'Allan Sena Freire', funcao: 'op. de retro' },
      { nome: 'Eneias Ramires', funcao: 'enc. água III' },
      { nome: 'Josalim José Alves', funcao: 'enc. água III' },
      { nome: 'Wellington da Silva Santos Aquino', funcao: 'enc. água I' },
    ],
  },
  {
    id: 'elton', equipe: 'Equipe Elton', lider: 'Elton', encarregado: 'Jailton',
    frente: 'retorno', foco: 'Rede + caixa e ramal', local: '—', status: 'planejado', aContratar: true,
    membros: [
      { nome: 'Elton Lucio Martins Quirino Oliveira', funcao: 'encanador IV' },
      { nome: 'Anderson de Jesus Souza', funcao: 'op. de retro' },
      { nome: 'Edivan Moreira dos Santos', funcao: 'ajud. geral I' },
      { nome: 'Edson Olímpio de Souza', funcao: 'ajud. geral I' },
    ],
  },
  {
    id: 'jailton', equipe: 'Equipe Jailton', lider: 'Jailton', encarregado: 'Jailton',
    frente: 'retorno', foco: 'Caixa e ramal', local: '—', status: 'planejado', aContratar: true,
    membros: [
      { nome: 'José Jailton da Silva', funcao: 'encarr. obras I' },
      { nome: 'Maelsom', funcao: 'ajudante' },
      { nome: 'Kaue', funcao: 'ajudante' },
      { nome: 'Danilo', funcao: 'ajudante' },
      { nome: 'Renan', funcao: 'soldador' },
    ],
  },
]
