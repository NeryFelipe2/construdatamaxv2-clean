/**
 * equipeMatch.ts
 *
 * Casamento de nomes de equipe entre duas fontes reais do Supabase:
 *  - planejamento_itens.payload.equipe_original  (ex: "Jesse", "Wellington")
 *  - rdo_equipes.lider_nome                      (ex: "Jesse (lider Renan)")
 *
 * A variação entre as duas strings é ESTRUTURAL (sufixo "(lider X)" na fonte
 * de execução), não erro de digitação — por isso a lógica aqui é normalização
 * + interseção de tokens, e propositalmente NÃO usa libs de fuzzy-string
 * (fuse.js, Levenshtein, etc.), que são overkill e geram falso positivo em
 * nomes curtos (ex: "Ana" x "Ian").
 *
 * Função pura: sem import de React, Supabase, zustand ou qualquer estado
 * externo — só lógica de string.
 */

/** Tamanho mínimo (em caracteres) para um token ser considerado nome relevante. */
const MIN_TOKEN_LEN = 3;

/** Captura o nome auxiliar dentro de "(lider X)" no texto ORIGINAL (antes de normalizar). */
const LIDER_AUX_REGEX = /\(\s*lider\s+([^)]+)\)/i;

/**
 * Normaliza um nome de equipe/líder para comparação:
 *  - lowercase
 *  - remove acentos (NFD + remoção de diacríticos)
 *  - remove conteúdo entre parênteses (ex: "(lider Renan)")
 *  - remove prefixo "equipe " se houver
 *  - remove pontuação
 *  - colapsa espaços múltiplos e faz trim
 */
export function normalizeNomeEquipe(raw: string): string {
  if (!raw) return '';

  let s = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // remove diacríticos (acentos)

  s = s.toLowerCase();

  // remove conteúdo entre parênteses, ex: "(lider renan)"
  s = s.replace(/\(.*?\)/g, ' ');

  // remove prefixo "equipe " se houver (ex: "equipe jesse" -> "jesse")
  s = s.replace(/^\s*equipe\s+/i, '');

  // remove pontuação (mantém letras, números e espaços)
  s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ');

  // colapsa espaços múltiplos e trim
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Extrai tokens de nome relevantes (>= MIN_TOKEN_LEN letras) do texto normalizado,
 * mais o nome capturado de dentro de "(lider X)" no texto original, se existir.
 *
 * Ex: extractNomesCandidatos("Jesse (lider Renan)") -> ["jesse", "renan"]
 */
export function extractNomesCandidatos(raw: string): string[] {
  if (!raw) return [];

  const nomes = new Set<string>();

  const normalizado = normalizeNomeEquipe(raw);
  for (const token of normalizado.split(' ')) {
    if (token.length >= MIN_TOKEN_LEN) {
      nomes.add(token);
    }
  }

  // captura o nome dentro de "(lider X)" no texto ORIGINAL antes de normalizar,
  // pois é aí que a estrutura "(lider Nome)" ainda está intacta.
  const liderMatch = raw.match(LIDER_AUX_REGEX);
  if (liderMatch && liderMatch[1]) {
    const nomeLider = normalizeNomeEquipe(liderMatch[1]);
    for (const token of nomeLider.split(' ')) {
      if (token.length >= MIN_TOKEN_LEN) {
        nomes.add(token);
      }
    }
  }

  return Array.from(nomes);
}

/** Candidato a casar contra a string de planejamento (equipe_original). */
export interface MatchCandidate {
  /** identificador do candidato (ex: rdo_equipes.id) */
  key: string;
  /** string original (ex: "Jesse (lider Renan)") */
  liderNome: string;
}

/** Resultado do matching: candidato escolhido e score de confiança (0..1). */
export interface MatchResult {
  key: string;
  score: number;
}

/**
 * Casa `equipeOriginal` (planejamento_itens.payload.equipe_original) contra uma
 * lista de candidatos (rdo_equipes), retornando o de MAIOR score entre os que
 * atingem score >= 0.6, ou null se nenhum candidato bater.
 *
 * Critério de score:
 *  - 1.0  se as strings normalizadas são iguais
 *  - 0.85 se uma normalizada contém a outra (substring, em qualquer direção)
 *  - 0.6  se há interseção de tokens de nome (incluindo o nome capturado de
 *         dentro de "(lider X)")
 *  - sem match caso contrário
 */
export function matchEquipe(
  equipeOriginal: string,
  candidates: MatchCandidate[]
): MatchResult | null {
  const origNormalizado = normalizeNomeEquipe(equipeOriginal);
  if (!origNormalizado) return null;

  const origTokens = new Set(extractNomesCandidatos(equipeOriginal));

  let melhor: MatchResult | null = null;

  for (const candidate of candidates) {
    const candNormalizado = normalizeNomeEquipe(candidate.liderNome);
    if (!candNormalizado) continue;

    let score = 0;

    if (origNormalizado === candNormalizado) {
      score = 1.0;
    } else if (
      candNormalizado.includes(origNormalizado) ||
      origNormalizado.includes(candNormalizado)
    ) {
      score = 0.85;
    } else {
      const candTokens = extractNomesCandidatos(candidate.liderNome);
      const temIntersecao = candTokens.some((t) => origTokens.has(t));
      if (temIntersecao) {
        score = 0.6;
      }
    }

    if (score >= 0.6 && (!melhor || score > melhor.score)) {
      melhor = { key: candidate.key, score };
    }
  }

  return melhor;
}
