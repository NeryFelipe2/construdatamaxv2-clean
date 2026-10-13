/**
 * baselineCronograma.ts
 *
 * Parser puro da baseline oficial por NÚCLEO, vinda de
 * `planilhas_modelo` (planilha='PLANEJAMENTO_WCR_v3', aba='CRONOGRAMA_MACRO'),
 * coluna `linhas` (jsonb array de arrays, no formato bruto de planilha).
 *
 * Formato real confirmado (via Supabase, 2026-07):
 *   linhas = [
 *     ["CRONOGRAMA MACRO POR NÚCLEO"],
 *     [],
 *     ["Núcleo","LA","LE","Total Lig","Nº Equipes","Início","Fim", ...meses..., "Observação"],
 *     ["BOI MALHADO",50,80,130,6,"01/07/2026","15/08/2026", ...],
 *     ["SAKURA",70,70,140,6,"15/07/2026","02/09/2026", ...],
 *     ["COMUNIDADE DO RETORNO",1000,1000,2000,8,"15/06/2026","15/12/2026", ...],
 *     ["TOTAL EQUIPES"],
 *   ]
 *
 * Ou seja: título (1 coluna), linha vazia, cabeçalho, N linhas de dados (núcleo
 * na coluna 0, datas dd/mm/yyyy nas colunas 5 e 6), e um rodapé "TOTAL EQUIPES"
 * (1 coluna). Este parser identifica linhas de dados de forma robusta checando
 * que a coluna 0 é um texto (não vazio, não é a palavra "Núcleo" do cabeçalho)
 * E que as colunas 5/6 batem com o padrão dd/mm/yyyy — assim ignora título,
 * linha vazia, cabeçalho e rodapé sem depender de índice de linha fixo.
 */

import { normalizeNomeEquipe } from './equipeMatch'

export interface BaselineNucleo {
  inicio: string // yyyy-mm-dd
  fim: string // yyyy-mm-dd
}

const DATA_BR_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

/** Converte "dd/mm/yyyy" -> "yyyy-mm-dd". Retorna null se não bater o padrão. */
function parseDataBr(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const m = raw.trim().match(DATA_BR_REGEX)
  if (!m) return null
  const [, d, mo, y] = m
  const dd = d.padStart(2, '0')
  const mm = mo.padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

/**
 * Parseia as `linhas` brutas do CRONOGRAMA_MACRO para um mapa
 * núcleo-normalizado -> { inicio, fim } (yyyy-mm-dd).
 *
 * Chave normalizada via `normalizeNomeEquipe` (lowercase, sem acento, trim) —
 * mesma normalização usada no matching equipe↔RDO — para que "BOI MALHADO"
 * (fonte) case com "Boi Malhado" (nucleoPadrao derivado do nome do projeto).
 *
 * Função pura: nunca lança. Linhas de cabeçalho/título/rodapé/vazias são
 * ignoradas silenciosamente (não têm núcleo válido + datas válidas).
 */
export function parseBaselineCronogramaMacro(linhas: unknown[][]): Map<string, BaselineNucleo> {
  const map = new Map<string, BaselineNucleo>()
  if (!Array.isArray(linhas)) return map

  for (const linha of linhas) {
    if (!Array.isArray(linha) || linha.length < 7) continue

    const nucleoRaw = linha[0]
    if (typeof nucleoRaw !== 'string' || !nucleoRaw.trim()) continue

    const nucleoNormalizado = normalizeNomeEquipe(nucleoRaw)
    if (!nucleoNormalizado) continue
    // ignora a linha de cabeçalho ("Núcleo","LA","LE",...) e o rodapé
    // ("TOTAL EQUIPES", que tem só 1 coluna e já cai fora no length<7 acima).
    if (nucleoNormalizado === 'nucleo' || nucleoNormalizado === 'total equipes') continue

    const inicio = parseDataBr(linha[5])
    const fim = parseDataBr(linha[6])
    if (!inicio || !fim) continue

    map.set(nucleoNormalizado, { inicio, fim })
  }

  return map
}
