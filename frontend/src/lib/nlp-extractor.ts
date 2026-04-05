/**
 * nlp-extractor.ts
 * Extrai campos estruturados de texto de deliberações usando regex + varredura linha a linha.
 * Estratégia de dois estágios por campo:
 *   1. Regex globais cobrindo múltiplos rótulos e formatos
 *   2. Varredura linha a linha (extractLabeledFields) como segunda tentativa
 *
 * Suporta o padrão real das deliberações ARTESP e outras agências:
 *   - Verbos decisórios: RATIFICA, APROVA, RECOMENDA, DETERMINA, AUTORIZA, HOMOLOGA, etc.
 *   - Assinaturas de diretores em bloco ao final do documento
 *   - Campo "Assunto:" presente em todas as deliberações
 * Mantém retrocompatibilidade com padrão DEFERIDO/INDEFERIDO de outras agências.
 */

// ─── Regex patterns ────────────────────────────────────────────────────────
const RE_DELIBERACAO = /DELIBERA[ÇC][AÃ]O\s*N[ºo°]?\s*([\d\.]+)/gi;
const RE_REUNIAO     = /(\d{3,4})[ªa°º]?\s*(?:Reuni[aã]o\s*)?(?:Ordin[aá]ria|Extraordin[aá]ria)/gi;

// Processo: SEI, PA, Processo Adm., Proc. nº, Autos nº, Procedimento nº
const RE_PROCESSO = /(?:SEI[!]?\s*n[ºo°]?|Processo\s*(?:SEI\s*)?n[ºo°]?|PA\s*n[ºo°]?|Proc(?:esso)?\s*(?:Adm(?:inistrativo)?\s*)?n[ºo°]?|Procedimento\s*n[ºo°]?|Autos?\s*n[ºo°]?)\s*([\d\.\/\-]+)/gi;

// Interessado: 13 rótulos cobrindo terminologia de todas as agências reguladoras
const RE_INTERESSADO = /(?:Interessad[ao][:\s]+|Requerente[:\s]+|Empresa[:\s]+|Solicitante[:\s]+|Demandante[:\s]+|Concession[aá]ri[ao][:\s]+|Permission[aá]ri[ao][:\s]+|Peticion[aá]rio[:\s]+|Proponente[:\s]+|Benefici[aá]ri[ao][:\s]+|Outorgad[ao][:\s]+|Postulante[:\s]+|Requerida[:\s]+)([^\n]{3,200})/gi;

const RE_ASSUNTO     = /Assunto[:\s]+([^\n]{3,300})/gi;

// Captura verbos de decisão reais das deliberações brasileiras.
// Inclui verbos extras: HOMOLOGA, ARQUIVA, ANULA, REVOGA, CANCELA, PREJUDICA.
// Prioridade de normalização definida em normalizeResultado().
const RE_RESULTADO = /\b(DEFERIDO|INDEFERIDO|DEFERIMENTO|INDEFERIMENTO|PARCIALMENTE\s*DEFERIDO|RETIRADO\s*DE\s*PAUTA|RATIFICA(?:DO)?|APROVA(?:DO)?(?:\s*COM\s*RESSALVAS)?|RECOMENDA(?:DO)?|DETERMINA(?:DO)?|AUTORIZA(?:DO)?|HOMOLOGA(?:DO)?|ARQUIVA(?:DO)?|ANULA(?:DO)?|REVOGA(?:DO)?|CANCELA(?:DO)?|PREJUDICA(?:DO)?)\b/gi;

// Unanimidade — qualquer das frases comuns em deliberações brasileiras
// Alternativas simples sem quantificadores aninhados (evita ReDoS)
const RE_UNANIMIDADE = /(?:por\s+unanimidade\s+dos?\s+votos?|por\s+unanimidade\s+dos?\s+presentes?|por\s+unanimidade|unanimidade\s+dos?\s+votos?|unanimidade\s+dos?\s+presentes?|aprovad[oa]\s+por\s+unanimidade)/gi;

// Voto dissidente / divergente — extrai o nome do diretor que votou contra
const RE_VOTO_DISSIDENTE =
  /(?:pelo\s+voto\s+(?:dissidente|divergente|contrário)\s+d[oa]?\s+(?:Diretor[a]?\s+)?|Diretor[a]?\s+\S+\s+votou?\s+(?:de\s+forma\s+)?(?:contrári[ao]|dissidente|divergente)[,\s]+)((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇÀÜ][a-záéíóúâêôãõçàü]+\s+){1,5})/gi;

// ─── Datas ─────────────────────────────────────────────────────────────────
const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4,
  maio: 5, junho: 6, julho: 7, agosto: 8,
  setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
const RE_DATA_EXTENSO  = /(\d{1,2})\s+de\s+([a-záéíóúâêôãõçàü]+)\s+de\s+(\d{4})/gi;
const RE_DATA_NUMERICA = /(\d{2})\/(\d{2})\/(\d{4})/g;
// Data numérica próxima a contexto de reunião (mais confiável que a primeira data do documento)
const RE_DATA_NUMERICA_CTX = /(?:Reuni[aã]o|realizada?\s+em|São\s+Paulo)\s*[,:]?\s*(\d{2})\/(\d{2})\/(\d{4})/gi;

// ─── Extração de nomes de diretores ───────────────────────────────────────
// Padrões A/B/C: contexto de voto em frases narrativas
const RE_VOTO_CONTEXTO = [
  /(?:Diretor[a]?\s+|Conselheiro[a]?\s+)((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇÀÜ][a-záéíóúâêôãõçàü]+\s*){2,5})(?:votou|vot[ao]|manifestou)/gi,
  /(?:voto\s+d[oa]\s+(?:Diretor[a]?\s+|Conselheiro[a]?\s+))((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇÀÜ][a-záéíóúâêôãõçàü]+\s*){2,5})/gi,
  /\b((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇÀÜ][a-záéíóúâêôãõçàü]+\s+){1,4})(?:–|-)\s*(?:Favorável|Contrári[ao]|Favoravel|Abstenção|Ausente)/gi,
];

// Pattern D extendido: captura nome E direção do voto para split favor/contra
const RE_VOTO_DIRECAO =
  /\b((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇÀÜ][a-záéíóúâêôãõçàü]+\s+){1,4})(?:–|-)\s*(Favor[aá]vel|Contr[aá]ri[ao]|Absten[çc][aã]o|Ausente)/gi;

// Número ordinal da reunião — apenas o dígito "1176"
const RE_NUMERO_REUNIAO = /(\d{3,4})[ªa°º]?\s*Reuni[aã]o/gi;

// Padrão D: bloco de assinatura em Title Case — "Nome Completo\nDiretor-Presidente"
const RE_ASSINATURA = /^([A-ZÁÉÍÓÚÂÊÔÃÕÇÀÜ][a-záéíóúâêôãõçàü][a-záéíóúâêôãõçàü\s]+)\s*\n\s*(?:Diretor(?:-Presidente)?|Diretora(?:-Presidente)?|Conselheiro(?:-Presidente)?|Conselheira|Presidente)/gm;

// Padrão E: bloco de assinatura ARTESP em CAIXA ALTA — "NOME COMPLETO\nDiretor-Presidente"
// Necessário porque deliberações ARTESP usam nomes em maiúsculas no rodapé.
const RE_ASSINATURA_CAPS = /^([A-ZÁÉÍÓÚÂÊÔÃÕÇÀÜ]{2}[A-ZÁÉÍÓÚÂÊÔÃÕÇÀÜ\s]+)\s*\n\s*(?:Diretor(?:-Presidente)?|Diretora(?:-Presidente)?|Conselheiro(?:-Presidente)?|Conselheira|Presidente)/gm;

// ─── Utilitários ───────────────────────────────────────────────────────────
function firstMatch(text: string, pattern: RegExp, group = 1): string | null {
  pattern.lastIndex = 0;
  const match = pattern.exec(text);
  return match ? match[group].trim() : null;
}

// ─── Extrator linha a linha (segunda estratégia) ──────────────────────────
// Faz varredura linha a linha buscando padrão "Rótulo: Valor".
// Mais tolerante a variações de espaçamento/pontuação que regex de largura fixa.
const LABEL_PATTERNS: [string, RegExp][] = [
  ["interessado", /^(?:Interessad[ao]|Requerente|Empresa|Solicitante|Concession[aá]ri[ao]|Outorgad[ao]|Peticion[aá]rio|Proponente|Benefici[aá]ri[ao]|Permission[aá]ri[ao]|Demandante|Postulante|Requerida)\s*:/i],
  ["processo",    /^(?:SEI[!]?|Processo(?:\s*SEI)?|PA|Proc(?:esso)?(?:\s*Adm(?:inistrativo)?)?)\s*n[ºo°]?\s*(?:[:–]|$)/i],
  ["assunto",     /^(?:Assunto|Ementa|Tema)\s*:/i],
  ["resultado",   /^(?:Resultado|Decis[aã]o)\s*:/i],
];

function extractLabeledFields(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 4) continue;
    for (const [key, re] of LABEL_PATTERNS) {
      if (map.has(key)) continue;
      if (re.test(trimmed)) {
        // Remove o rótulo + separadores e pega o valor restante
        const value = trimmed.replace(re, "").replace(/^[\s:–\-]+/, "").trim();
        if (value.length >= 3) map.set(key, value.slice(0, 250));
      }
    }
  }
  return map;
}

function allMatches(text: string, pattern: RegExp, group = 1): string[] {
  pattern.lastIndex = 0;
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    results.push(match[group].trim());
  }
  return results;
}

function parseOneDateExtenso(match: RegExpExecArray): string | null {
  const day     = parseInt(match[1], 10);
  const mesNome = match[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const year    = parseInt(match[3], 10);
  const month   = MESES[mesNome];
  if (!month || day < 1 || day > 31 || year < 1990 || year > 2099) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDataExtenso(text: string): string | null {
  // Primeiro: busca data próxima a contextos de reunião (mais confiável)
  const RE_DATA_REUNIAO_CTX = /(?:Reuni[aã]o|realizada?\s+em|data\s+da\s+reuni[aã]o|São\s+Paulo,?)\s*[,:]?\s*(\d{1,2})\s+de\s+([a-záéíóúâêôãõçàü]+)\s+de\s+(\d{4})/gi;
  RE_DATA_REUNIAO_CTX.lastIndex = 0;
  let m = RE_DATA_REUNIAO_CTX.exec(text);
  if (m) {
    const result = parseOneDateExtenso([m[0], m[1], m[2], m[3]] as unknown as RegExpExecArray);
    if (result) return result;
  }

  // Fallback: primeira data em extenso encontrada no documento
  RE_DATA_EXTENSO.lastIndex = 0;
  m = RE_DATA_EXTENSO.exec(text);
  if (!m) return null;
  return parseOneDateExtenso(m);
}

function parseOneDateNumerica(d: string, m: string, y: string): string | null {
  const day   = parseInt(d, 10);
  const month = parseInt(m, 10);
  const year  = parseInt(y, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2099) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDataNumerica(text: string): string | null {
  // Primeiro: data numérica próxima a contexto de reunião
  RE_DATA_NUMERICA_CTX.lastIndex = 0;
  const ctxMatch = RE_DATA_NUMERICA_CTX.exec(text);
  if (ctxMatch) {
    const result = parseOneDateNumerica(ctxMatch[1], ctxMatch[2], ctxMatch[3]);
    if (result) return result;
  }
  // Fallback: primeira data numérica do documento
  RE_DATA_NUMERICA.lastIndex = 0;
  const match = RE_DATA_NUMERICA.exec(text);
  if (!match) return null;
  return parseOneDateNumerica(match[1], match[2], match[3]);
}

function normalizeResultado(raw: string): string | null {
  const upper = raw.toUpperCase().replace(/\s+/g, " ").trim();
  // Verificar os padrões mais específicos primeiro para evitar falsos positivos
  if (upper.includes("PARCIALMENTE"))   return "Parcialmente Deferido";
  if (upper.includes("RETIRADO"))       return "Retirado de Pauta";
  if (upper.includes("INDEFERIDO") || upper.includes("INDEFERIMENTO")) return "Indeferido";
  if (upper.includes("DEFERIDO")   || upper.includes("DEFERIMENTO"))   return "Deferido";
  // Verbos de decisão usados nas deliberações ARTESP e similares
  if (upper.startsWith("RATIFICA"))  return "Ratificado";
  if (upper.includes("RESSALVAS"))   return "Aprovado com Ressalvas";
  if (upper.startsWith("APROVA"))    return "Aprovado";
  if (upper.startsWith("RECOMENDA")) return "Recomendado";
  if (upper.startsWith("DETERMINA")) return "Determinado";
  if (upper.startsWith("AUTORIZA"))  return "Autorizado";
  // Verbos extras mapeados para valores do schema existente
  if (upper.startsWith("HOMOLOGA"))  return "Aprovado";          // homologação = aprovação
  if (upper.startsWith("ARQUIVA"))   return "Retirado de Pauta"; // arquivamento = sem decisão de mérito
  if (upper.startsWith("ANULA"))     return "Indeferido";         // anulação ~ indeferimento
  if (upper.startsWith("REVOGA"))    return "Indeferido";
  if (upper.startsWith("CANCELA"))   return "Retirado de Pauta";
  if (upper.startsWith("PREJUDICA")) return "Retirado de Pauta";
  return null;
}

// ─── Tipo de retorno ───────────────────────────────────────────────────────
export interface ExtractedFields {
  numero_deliberacao: string | null;
  reuniao_ordinaria: string | null;
  numero_reuniao: string | null;    // apenas o número ordinal "1176"
  data_reuniao: string | null;      // ISO: "YYYY-MM-DD"
  interessado: string | null;
  processo: string | null;
  assunto: string | null;           // campo "Assunto:" das deliberações ARTESP
  resultado: string | null;
  pauta_interna: boolean;
  resumo_pleito: string | null;
  fundamento_decisao: string | null;
  nomes_votacao: string[];          // todos os nomes (compatibilidade)
  nomes_votacao_favor: string[];    // nomes que votaram a favor
  nomes_votacao_contra: string[];   // nomes que votaram contra/abstenção
  signatarios: string[];            // diretores identificados no bloco de assinatura
  unanimidade_detectada: boolean;   // true se "por unanimidade" encontrado no texto
}

// ─── Extração principal ───────────────────────────────────────────────────
export function extractFields(text: string): ExtractedFields {
  const numero_deliberacao = firstMatch(text, RE_DELIBERACAO);
  const reuniao_ordinaria  = firstMatch(text, RE_REUNIAO);

  // Estágio 1: regex globais
  let interessado = firstMatch(text, RE_INTERESSADO);
  let processo    = firstMatch(text, RE_PROCESSO);
  // Assunto: tenta "Assunto:" → "Ementa:" → "Tema:" → "Objeto:" (ANEEL e outras)
  let assunto =
    firstMatch(text, RE_ASSUNTO) ??
    firstMatch(text, /Ementa[:\s]+([^\n]{3,300})/gi) ??
    firstMatch(text, /Tema[:\s]+([^\n]{3,300})/gi) ??
    firstMatch(text, /Objeto[:\s]+([^\n]{3,300})/gi);

  // Estágio 2: varredura linha a linha para campos ainda null
  if (!interessado || !processo || !assunto) {
    const labeled = extractLabeledFields(text);
    if (!interessado && labeled.has("interessado")) interessado = labeled.get("interessado")!;
    if (!processo    && labeled.has("processo"))    processo    = labeled.get("processo")!;
    if (!assunto     && labeled.has("assunto"))     assunto     = labeled.get("assunto")!;
  }

  // Trunca interessado no primeiro separador de cláusula após mínimo 5 chars
  // Ex: "Empresa XYZ Ltda., que solicita autorização..." → "Empresa XYZ Ltda."
  if (interessado && interessado.length > 5) {
    const sepMatch = interessado.match(/^(.{5,}?)(?:,\s*(?:que|a qual|cujo|cujos|cujas|por meio|através|representad)|;\s*|\s{2,}|$)/);
    if (sepMatch && sepMatch[1].length < interessado.length) {
      interessado = sepMatch[1].trim().replace(/[,;.]\s*$/, "");
    }
  }

  // Data: tenta extenso primeiro ("12 de janeiro de 2026"), depois numérico
  const data_reuniao = parseDataExtenso(text) ?? parseDataNumerica(text);

  // Resultado: pega o verbo/estado mais frequente no documento
  const resultadoRaw = allMatches(text, RE_RESULTADO);
  let resultado: string | null = null;
  if (resultadoRaw.length > 0) {
    const freq = new Map<string, number>();
    for (const r of resultadoRaw) {
      const norm = normalizeResultado(r);
      if (norm) freq.set(norm, (freq.get(norm) ?? 0) + 1);
    }
    if (freq.size > 0) {
      resultado = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  }
  // Fallback: "unanimidade de votos" → aprovação implícita
  if (!resultado) {
    RE_UNANIMIDADE.lastIndex = 0;
    if (RE_UNANIMIDADE.exec(text)) resultado = "Aprovado por Unanimidade";
  }

  // Pauta interna: keywords administrativas ou ausência de interessado externo
  const PAUTA_INTERNA_KEYWORDS = [
    "pauta interna", "expediente interno", "assunto administrativo",
    "remuneração", "recursos humanos",
    "designação de empregado", "indicação para substituição",
    "cargo em comissão de comando", "empregado/servidor",
  ];
  const textLower = text.toLowerCase();
  const pauta_interna =
    !interessado ||
    PAUTA_INTERNA_KEYWORDS.some((kw) => textLower.includes(kw));

  // Resumo do pleito
  // Estratégia 1: seção com rótulo explícito (Resumo:, Objeto:, Ementa:)
  // Estratégia 2: parágrafo iniciado por marcador narrativo (Trata-se, Cuida-se, etc.)
  const RE_RESUMO_LABEL = /(?:Resumo[:\s]+|Objeto[:\s]+)([\s\S]{20,600}?)(?=\n\n|\f|$)/im;
  const RE_RESUMO_PRINCIPAL = /(?:Trata-se|Cuida-se|Versa\s+o\s+presente|A\s+presente\s+delibera[çc][aã]o|O\s+presente\s+(?:caso|processo|requerimento|pedido)|A\s+empresa\s+requer|O\s+requerente\s+solicita|Refere-se\s+ao?\s+requerimento)([\s\S]{30,800}?)(?=\n\n|\f|$)/im;

  let resumo_pleito: string | null = null;
  const resumoMatch = RE_RESUMO_LABEL.exec(text) ?? RE_RESUMO_PRINCIPAL.exec(text);
  if (resumoMatch) {
    const raw = resumoMatch[0].trim();
    resumo_pleito = raw.length >= 20 ? raw.slice(0, 800) : null;
  }
  // Fallback: usa o campo assunto como resumo curto
  if (!resumo_pleito && assunto && assunto.length >= 15) {
    resumo_pleito = assunto;
  }

  // Fundamento da decisão: marcadores expandidos para cobrir ARTESP e outras agências
  // [\s\S] limitado a 800 chars (greedy) para evitar backtracking excessivo
  const RE_FUNDAMENTO = /(?:Fundamento[:\s]+|Em face do exposto|Considerando\s+o\s+exposto|Diante\s+do\s+exposto|Pelo\s+exposto|Tendo\s+em\s+vista[^,\n]{0,30},\s*decide[:\s]+|DECIDE\s+A\s+DIRETORIA[:\s]+|A\s+DIRETORIA(?:\s+DA\s+\w+)?\s+DECIDE[:\s]+|DECIDE[:\s]+|Decide-se[:\s]+|RESOLVE[:\s]+)([\s\S]{20,800}?)(?:\n\n|\n[A-Z]{3}|$)/i;
  const fundamento_decisao = RE_FUNDAMENTO.exec(text)?.[1]?.trim() ?? null;

  // Número da reunião (apenas o ordinal)
  const numero_reuniao = firstMatch(text, RE_NUMERO_REUNIAO);

  // ─── Bloco de assinatura: coleta signatários (title-case + ALL-CAPS) ─────
  const signatarios: string[] = [];

  RE_ASSINATURA.lastIndex = 0;
  let sig: RegExpExecArray | null;
  while ((sig = RE_ASSINATURA.exec(text)) !== null) {
    const nome = sig[1].trim();
    if (nome.length > 4 && !signatarios.includes(nome)) signatarios.push(nome);
  }

  RE_ASSINATURA_CAPS.lastIndex = 0;
  let sigCaps: RegExpExecArray | null;
  while ((sigCaps = RE_ASSINATURA_CAPS.exec(text)) !== null) {
    const nome = sigCaps[1].trim();
    if (nome.length > 4 && !signatarios.includes(nome)) signatarios.push(nome);
  }

  // ─── Unanimidade ──────────────────────────────────────────────────────────
  RE_UNANIMIDADE.lastIndex = 0;
  const unanimidade_detectada = RE_UNANIMIDADE.test(text);

  // ─── Nomes de diretores: contexto + bloco de assinatura ─────────────────
  const nomes_votacao: string[] = [];
  const nomes_votacao_favor: string[] = [];
  const nomes_votacao_contra: string[] = [];

  if (unanimidade_detectada && signatarios.length > 0) {
    // Unanimidade confirmada: todos os signatários votaram a favor.
    // Ainda detectamos dissidências explícitas para sobrescrever se necessário.
    nomes_votacao.push(...signatarios);
    nomes_votacao_favor.push(...signatarios);
  } else {
    // Pattern com direção explícita: "Nome – Favorável/Contrário/Abstenção"
    RE_VOTO_DIRECAO.lastIndex = 0;
    let vd: RegExpExecArray | null;
    while ((vd = RE_VOTO_DIRECAO.exec(text)) !== null) {
      const nome = vd[1].trim();
      const tipo = vd[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (nome.length > 4) {
        if (!nomes_votacao.includes(nome)) nomes_votacao.push(nome);
        if (tipo.startsWith("favor") && !nomes_votacao_favor.includes(nome)) {
          nomes_votacao_favor.push(nome);
        } else if (!tipo.startsWith("favor") && !nomes_votacao_contra.includes(nome)) {
          nomes_votacao_contra.push(nome);
        }
      }
    }

    // Padrões A / B / C (frases narrativas — apenas nomes sem direção)
    for (const pattern of RE_VOTO_CONTEXTO) {
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(text)) !== null) {
        const nome = m[1].trim();
        if (nome.length > 4 && !nomes_votacao.includes(nome)) nomes_votacao.push(nome);
      }
    }

    // Adiciona signatários ao pool geral se ainda não encontrados
    for (const nome of signatarios) {
      if (!nomes_votacao.includes(nome)) nomes_votacao.push(nome);
    }

    // Fallback: sem direção explícita → todos considerados a favor
    if (nomes_votacao_favor.length === 0 && nomes_votacao.length > 0) {
      nomes_votacao_favor.push(...nomes_votacao);
    }
  }

  // ─── Voto dissidente / divergente ─────────────────────────────────────────
  // Move o diretor dissidente de _favor para _contra (se estava em favor)
  RE_VOTO_DISSIDENTE.lastIndex = 0;
  let diss: RegExpExecArray | null;
  while ((diss = RE_VOTO_DISSIDENTE.exec(text)) !== null) {
    const nome = diss[1].trim();
    if (nome.length > 4) {
      if (!nomes_votacao.includes(nome)) nomes_votacao.push(nome);
      // Remove de favor e adiciona a contra
      const idxFavor = nomes_votacao_favor.indexOf(nome);
      if (idxFavor !== -1) nomes_votacao_favor.splice(idxFavor, 1);
      if (!nomes_votacao_contra.includes(nome)) nomes_votacao_contra.push(nome);
    }
  }

  return {
    numero_deliberacao,
    reuniao_ordinaria,
    numero_reuniao,
    data_reuniao,
    interessado,
    processo,
    assunto,
    resultado,
    pauta_interna,
    resumo_pleito,
    fundamento_decisao,
    nomes_votacao,
    nomes_votacao_favor,
    nomes_votacao_contra,
    signatarios,
    unanimidade_detectada,
  };
}

// ─── Confiança de extração (ponderada) ───────────────────────────────────
// Pesos refletem a importância de cada campo para identificar a deliberação.
// Soma dos pesos = 1.0 quando todos os campos estão presentes.
export function calcConfidence(fields: ExtractedFields): number {
  const weights: [boolean, number][] = [
    [fields.numero_deliberacao !== null, 0.22], // campo identificador central
    [fields.data_reuniao       !== null, 0.18], // data sempre presente em deliberações
    [fields.resultado          !== null, 0.18], // decisão final
    [fields.interessado        !== null, 0.14], // quem fez o requerimento
    [fields.assunto            !== null, 0.12], // tema da deliberação
    [fields.processo           !== null, 0.10], // número do processo SEI
    [fields.resumo_pleito      !== null, 0.04], // resumo do pleito
    [fields.fundamento_decisao !== null, 0.02], // fundamento jurídico
  ];
  return weights.reduce((sum, [present, weight]) => sum + (present ? weight : 0), 0);
}
