/**
 * parseApontamento.ts — parser PURO (sem Supabase, testável) do apontamento
 * por tags vindo do grupo de WhatsApp da obra (WhatsApp → RDO → Medição).
 *
 * Princípio INEGOCIÁVEL: NUNCA chutar. Na dúvida o item vai pra revisão
 * (revisar=true, sem preço) ou vira observação — nada é consumido em silêncio.
 *
 * As descrições retornadas em `descricaoContrato` são LITERAIS da tabela
 * `precos_contrato` (incluindo typos do contrato oficial). O hook
 * `useApontamento.ts` resolve descrição → código/unidade/preço.
 */

export interface ApontamentoItem {
  linhaOriginal: string
  tag: string
  qualificadores: string[]
  descricaoContrato: string | null
  qtd: number | null
  revisar: boolean
  motivoRevisar?: string
}

export interface ApontamentoParse {
  data: string | null
  equipe: string | null
  nucleo: string | null
  itens: ApontamentoItem[]
  observacoes: string[]
  avisos: string[]
}

// ─── Normalização ────────────────────────────────────────────────────────────

/** minúsculas + sem acentos (NFD, remove diacríticos) */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** strip de emojis e asteriscos/underscores de formatação do WhatsApp */
function stripFormatacao(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/[*_~]+/g, ' ')
}

// números por extenso — dicionário FECHADO (sem compostos tipo "vinte e cinco")
const NUM_EXTENSO: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
  sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40,
  cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100,
}

// palavras-veto: anulam a medição da linha inteira (vira observação pra revisar)
const VETO_RE = /\b(limpeza|manutencao|manutencoes|acabamento|reparo|reparos|desobstrucao|faltou|falta|nao foi|corrigir|ontem|retroativo)\b/

const DN_CONHECIDOS = [32, 63, 75, 90, 110, 125, 140, 150, 160, 200, 300, 315, 400]

// ─── Canonicalização de sinônimos → tokens (SÓ com fronteira de palavra) ─────

function canonicalizar(n: string): string {
  let s = ' ' + n + ' '
  const rep: [RegExp, string][] = [
    [/\bcaixas?\s+(?:u\.?\s*m\.?\s*a\.?|uma)\b/g, ' caixa_uma '],
    [/\bcaixas?\s+de\s+inspecao\b/g, ' tag_ci '],
    [/\bpocos?\s+de\s+visita\b/g, ' tag_pv '],
    [/\bpocos?\s+de\s+inspecao\b/g, ' tag_pi '],
    [/\bligac(?:ao|oes)\s+de\s+agua\b/g, ' tag_la '],
    [/\bligac(?:ao|oes)\s+de\s+esgoto\b/g, ' tag_le '],
    [/\brede\s+(?:de\s+)?agua\b/g, ' rede_agua '],
    [/\brede\s+(?:de\s+)?esgoto\b/g, ' rede_esgoto '],
    // PEAD 63–125 é sempre água no contrato; PVC pode ser esgoto → token próprio (revisar)
    [/\brede\s+(?:de\s+)?pead\b/g, ' rede_agua '],
    [/\brede\s+(?:de\s+)?pvc\b/g, ' rede_pvc '],
    [/\bhidrometros?\b/g, ' tag_hm '],
    [/\brelogios?\b/g, ' tag_hm '],
    [/\bt[e]s?\s+de\s+[cs]elas?\b/g, ' conex_sela '],
    [/\bselas?\b/g, ' conex_sela '],
    [/\bluvas?\b/g, ' conex_luva '],
    [/\binterligac(?:ao|oes)\b/g, ' tag_interlig '],
    [/\binterlig\b/g, ' tag_interlig '],
    [/\bcomunicados?\b/g, ' tag_comunicado '],
    [/\bvalvulas?\b/g, ' tag_valvula '],
    [/\bramal\b|\bramais\b/g, ' tag_ramal '],
    [/\btempo\s+seco\b/g, ' q_temposeco '],
    [/\binterferencias?\b/g, ' tag_interf '],
    [/\bemboque\b/g, ' tag_emboque '],
    [/\btipo\s*(?:2|ii)\b/g, ' tipo_2 '],
    [/\btipo\s*(?:1|i)\b/g, ' tipo_1 '],
    [/\bespeciais\b|\bespecial\b/g, ' esp '],
    [/\bavulsas?\b|\bavulsos?\b/g, ' av '],
    [/\bflangeadas?\b|\bflangeamento\b|\bflanges?\b|\bflang\b/g, ' flang '],
    [/\beixo\b/g, ' eixo '],
  ]
  for (const [re, to] of rep) s = s.replace(re, to)
  return s.replace(/\s+/g, ' ').trim()
}

// ─── Pré-processamento numérico (mascara números PROIBIDOS como qtd) ─────────

function preprocessarNumeros(n: string): string {
  let s = n
  // números entre parênteses → proibidos
  s = s.replace(/\([^)]*\)/g, ' paren_ref ')
  // datas no meio da linha → proibidas
  s = s.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' data_ref ')
  // números de casa/nº/rua (inclusive lista "45, 43 e 50" e "casa n. 33") → proibidos
  s = s.replace(
    /\b(?:(?:casas?|residencias?|res|imovel|imoveis|lotes?|aptos?|apartamentos?|rua)\s*(?:n(?:[o°º]|ro?|um(?:ero)?)?s?\.?\s*)?|n(?:[o°º]|ro?|um(?:ero)?)?s?\.?\s*)[:.]?\s*\d+(?:\s*(?:,|e)\s*\d+)*/g,
    ' casa_ref ',
  )
  // 'X metros e Y cm' → soma em metros ("9,50m e 50cm" = 10)
  s = s.replace(
    /(\d+(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\s+e\s+(\d+(?:[.,]\d+)?)\s*cm\b/g,
    (_m, a: string, b: string) => {
      const total = parseFloat(a.replace(',', '.')) + parseFloat(b.replace(',', '.')) / 100
      return `${total}m`
    },
  )
  // decimal pt-BR: 9,50 → 9.50 (só dígito,dígito colados)
  s = s.replace(/(\d),(\d)/g, '$1.$2')
  // DN explícito "63mm" → token dn_63 (nunca é quantidade)
  s = s.replace(/\b(\d{2,3})\s*mm\b/g, ' dn_$1 ')
  // faixas grandes "150-250" / "150 a 250" (DN) → token faixa_150_250
  s = s.replace(/\b(\d{2,3})\s*(?:a|-)\s*(\d{2,3})\b/g, (_m, a: string, b: string) =>
    parseInt(a) >= 20 && parseInt(b) >= 20 ? ` faixa_${a}_${b} ` : _m,
  )
  // faixas de profundidade "2-3m" / "2 a 3m" → token prof_20_30 (valor ×10)
  s = s.replace(/\b([1-5](?:\.\d+)?)\s*(?:a|-)\s*([1-5](?:\.\d+)?)\s*m\b/g, (_m, a: string, b: string) =>
    ` prof_${Math.round(parseFloat(a) * 10)}_${Math.round(parseFloat(b) * 10)} `,
  )
  // números por extenso (palavra inteira)
  s = s.replace(/\b[a-z]+\b/g, (w) => (NUM_EXTENSO[w] !== undefined ? String(NUM_EXTENSO[w]) : w))
  return s.replace(/\s+/g, ' ').trim()
}

// ─── Extração de números do segmento ─────────────────────────────────────────

interface NumTok {
  v: number
  /** veio com sufixo m/mts/metros */
  m: boolean
  i: number
}

/**
 * Números "livres" do segmento. Tokens mascarados (dn_63, casa_ref, prof_20_30,
 * faixa_150_250, tipo_2) NÃO aparecem aqui: o `_` cola no dígito e mata o \b.
 */
function extrairNumeros(seg: string): NumTok[] {
  const out: NumTok[] = []
  const re = /\b(\d+(?:\.\d+)?)(?:\s*(m|mts?|metros?)\b)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(seg))) out.push({ v: parseFloat(m[1]), m: !!m[2], i: m.index })
  return out
}

function dnTokens(seg: string): NumTok[] {
  const out: NumTok[] = []
  const re = /dn_(\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(seg))) out.push({ v: parseInt(m[1]), m: false, i: m.index })
  return out
}

/** faixa_A_B → [A, B] (primeira ocorrência) */
function faixaToken(seg: string): [number, number] | null {
  const m = seg.match(/faixa_(\d+)_(\d+)/)
  return m ? [parseInt(m[1]), parseInt(m[2])] : null
}

/** prof_A_B (×10) → limite superior em metros */
function profRangeToken(seg: string): number | null {
  const m = seg.match(/prof_(\d+)_(\d+)/)
  return m ? parseInt(m[2]) / 10 : null
}

// ─── Montagem de itens ───────────────────────────────────────────────────────

function item(
  linhaOriginal: string,
  tag: string,
  qualificadores: string[],
  descricaoContrato: string | null,
  qtd: number | null,
  motivoRevisar?: string,
): ApontamentoItem {
  return {
    linhaOriginal,
    tag,
    qualificadores,
    descricaoContrato,
    qtd,
    revisar: motivoRevisar !== undefined,
    ...(motivoRevisar !== undefined ? { motivoRevisar } : {}),
  }
}

interface QtdResultado {
  qtd: number | null
  motivo?: string
}

// palavras de endereço que sobraram SEM máscara (defesa em profundidade):
// se a máscara casa_ref não pegou, não medimos em silêncio
const CASA_PALAVRA_RE = /\b(?:casas?|residencias?|numeros?|imovel|imoveis|lotes?|aptos?|apartamentos?)\b/

/**
 * Escolhe a quantidade entre os números livres restantes.
 * profCapable: PV/PI/LE/REDE ESGOTO — número pequeno pós-tag pode ser
 * profundidade, então bare 2..5 depois da tag é ambíguo → revisar.
 * bareTag: tag casada por sigla solta (pi/pv/la/le/ci/hm) e não por token
 * canônico — número longe da tag em frase narrativa é ambíguo → revisar.
 */
function escolherQtd(
  seg: string,
  nums: NumTok[],
  tagIdx: number,
  tag: string,
  profCapable: boolean,
  bareTag = false,
): QtdResultado {
  if (nums.length === 0) {
    if (/casa_ref|paren_ref|data_ref/.test(seg))
      return { qtd: null, motivo: 'número junto de casa/nº/parênteses/data não é quantidade — informar a quantidade' }
    return { qtd: null, motivo: 'quantidade não identificada' }
  }
  if (nums.length > 1) return { qtd: null, motivo: 'mais de um número na linha — confirmar quantidade' }
  const n = nums[0]
  if (profCapable && !n.m && n.i > tagIdx && n.v >= 2 && n.v <= 5)
    return { qtd: null, motivo: `${n.v} ${tag}s ou ${tag} de ${n.v}m? — confirmar` }
  if (bareTag && n.i < tagIdx) {
    const entre = seg.slice(n.i, tagIdx)
    const palavras = entre.match(/\b[a-z_]{2,}\b/g) ?? []
    if (palavras.length >= 2)
      return { qtd: null, motivo: `número ${n.v} longe da sigla ${tag} em frase — confirmar quantidade` }
  }
  if (CASA_PALAVRA_RE.test(seg))
    return { qtd: null, motivo: 'palavra de endereço (casa/número/lote) na linha — confirmar quantidade' }
  return { qtd: n.v }
}

const POS_LA: Record<string, string> = {
  pa: 'LIG AGUA SUCES/PAS LA PAS ADJ S/REPOS',
  ta: 'LIG AGUA SUCES/PAS LA TERÇO ADJ S/REP',
  eixo: 'LIG AGUA SUCES/PAS LA EIXO SEM REPOS',
  to: 'LIG AGUA SUCES/PAS LA TERÇO OP S/REPOS',
  po: 'LIG AGUA SUCES/PAS LA PASSEIO OP S/REPOS',
}
const POS_LA_AV: Record<string, string> = {
  pa: 'LIG/SUBST LIG AV AGUA AT32MM PADJ S/REP',
  ta: 'LIG/SUBST LIG AV AGUA 32MM TERÇO ADJ S/R',
  eixo: 'LIG/SUBST LIG AV AGUA 32MM EIXO S/REPOS',
  to: 'LIG/SUBST LIG AV AGUA 32MM TO S/REPOS',
  po: 'LIG/SUBST LIG AV AGUA 32MM PO S/REPOS',
}
// LE: posição no texto do contrato usa PA/TA/EX/TO/PO
const POS_LE_SIGLA: Record<string, string> = { pa: 'PA', ta: 'TA', eixo: 'EX', to: 'TO', po: 'PO' }

/** acha posição PA/TA/EIXO(EX)/TO/PO com fronteira de palavra */
function acharPosicao(seg: string): string | null {
  const m = seg.match(/\b(pa|ta|to|po|eixo|ex)\b/)
  if (!m) return null
  return m[1] === 'ex' ? 'eixo' : m[1]
}

// ─── Parser de segmento (uma "unidade de serviço") ───────────────────────────

function parseSegmento(seg: string, raw: string): ApontamentoItem[] | null {
  const mnd = /\bmnd\b/.test(seg)
  const av = /\bav\b/.test(seg)
  const dns = dnTokens(seg)
  const faixa = faixaToken(seg)
  const profRange = profRangeToken(seg)

  /** DN da tag: primeiro dn_XX OU primeiro número livre do conjunto DN após tagIdx */
  function acharDn(tagIdx: number, conjunto: number[], nums: NumTok[]): { dn: number | null; resto: NumTok[] } {
    const candTok = dns.find((d) => conjunto.includes(d.v))
    if (candTok) return { dn: candTok.v, resto: nums }
    const idx = nums.findIndex((n) => !n.m && n.i > tagIdx && conjunto.includes(n.v))
    if (idx >= 0) return { dn: nums[idx].v, resto: nums.filter((_, k) => k !== idx) }
    return { dn: null, resto: nums }
  }

  /** profundidade: número livre com sufixo m, pequeno, após a tag (consome do pool) */
  function acharProf(tagIdx: number, nums: NumTok[], max: number): { prof: number | null; resto: NumTok[] } {
    if (profRange !== null) return { prof: profRange, resto: nums }
    const idx = nums.findIndex((n) => n.m && n.i > tagIdx && n.v <= max)
    if (idx >= 0) return { prof: nums[idx].v, resto: nums.filter((_, k) => k !== idx) }
    return { prof: null, resto: nums }
  }

  /**
   * Ambiguidade prof×metragem: exatamente UM número livre no segmento, com
   * sufixo m, no range de profundidade (2..max), depois da tag — pode ser
   * tanto "3m de rede" quanto "prof 3m". NUNCA decidir em silêncio.
   */
  function profOuMetragemAmbigua(tagIdx: number, nums: NumTok[], max: number): number | null {
    if (profRange !== null) return null
    if (nums.length !== 1) return null
    const n = nums[0]
    return n.m && n.i > tagIdx && n.v >= 2 && n.v <= max ? n.v : null
  }

  /** qtd em metros: prefere número com sufixo m; senão um único bare */
  function qtdMetros(nums: NumTok[]): QtdResultado {
    const comM = nums.filter((n) => n.m)
    if (comM.length === 1)
      return CASA_PALAVRA_RE.test(seg)
        ? { qtd: null, motivo: 'palavra de endereço (casa/número/lote) na linha — confirmar metragem' }
        : { qtd: comM[0].v }
    if (comM.length > 1) return { qtd: null, motivo: 'mais de uma metragem na linha — confirmar' }
    if (nums.length === 1)
      return CASA_PALAVRA_RE.test(seg)
        ? { qtd: null, motivo: 'palavra de endereço (casa/número/lote) na linha — confirmar metragem' }
        : { qtd: nums[0].v }
    if (nums.length === 0) {
      if (/casa_ref|paren_ref|data_ref/.test(seg))
        return { qtd: null, motivo: 'número junto de casa/nº/parênteses/data não é quantidade — informar metragem' }
      return { qtd: null, motivo: 'metragem não identificada' }
    }
    return { qtd: null, motivo: 'mais de um número na linha — confirmar metragem' }
  }

  // ── LRP / LPB / CBUQ (exigem serviço-pai) — checar ANTES de rede_* ──
  const mLrp = seg.match(/\blrp\b/)
  if (mLrp) {
    const esp = /\besp\b/.test(seg)
    const quals = esp ? ['ESP'] : []
    const nums = extrairNumeros(seg)
    // remove DN do pai do pool (ex: 'lrp rede_esgoto 150 30m')
    const { resto } = acharDn(mLrp.index!, DN_CONHECIDOS, nums)
    const q = qtdMetros(resto)
    if (/rede_esgoto/.test(seg))
      return [item(raw, 'LRP', [...quals, 'REDE ESGOTO'], esp ? 'LRP-PASSEIO ESP-ASSENT REDE COL ATÉ 2M.' : 'LRP-PASSEIO CIM-ASSENT REDE COL ATÉ 2M', q.qtd, q.motivo)]
    if (/rede_agua/.test(seg))
      return [item(raw, 'LRP', [...quals, 'REDE AGUA'], esp ? 'LRP - PASSEIO ESPECIAL - ASSENTAMENTO DE' : 'LRP - PASSEIO CIMENTADO - ASSENTAMENTO D', q.qtd, q.motivo)]
    if (/\bpvs?\b|tag_pv/.test(seg))
      return [item(raw, 'LRP', [...quals, 'PV'], esp ? 'LRP-PASSEIO ESP-CONST/REC/SUBST PV/PI' : 'LRP-PASSEIO CIM-CONST/REC/SUBST PV E PI', q.qtd, q.motivo)]
    if (/\blig\b|\bla\b|\ble\b|tag_la|tag_le|ligac/.test(seg))
      return [item(raw, 'LRP', [...quals, 'LIG'], null, q.qtd, 'LRP de ligação tem muitas variantes no contrato — escolher na medição')]
    return [item(raw, 'LRP', quals, null, q.qtd, 'informar o serviço-pai do LRP (rede água/rede esgoto/lig/PV)')]
  }
  const mLpb = seg.match(/\blpb\b/)
  if (mLpb) {
    const nums = extrairNumeros(seg)
    const { resto } = acharDn(mLpb.index!, DN_CONHECIDOS, nums)
    const q = qtdMetros(resto)
    if (/rede_esgoto/.test(seg)) return [item(raw, 'LPB', ['REDE ESGOTO'], 'LPB- LEITO-ASSENT REDE COLET ATÉ 2M.', q.qtd, q.motivo)]
    if (/rede_agua/.test(seg)) return [item(raw, 'LPB', ['REDE AGUA'], 'LPB - LEITO - ASSENTAMENTO DE REDE DE AG', q.qtd, q.motivo)]
    return [item(raw, 'LPB', [], null, q.qtd, 'informar o serviço-pai do LPB (rede água/rede esgoto)')]
  }
  const mCbuq = seg.match(/\bcbuq\b/)
  if (mCbuq) {
    const nums = extrairNumeros(seg)
    const { resto } = acharDn(mCbuq.index!, DN_CONHECIDOS, nums)
    const q = qtdMetros(resto)
    if (/rede_esgoto/.test(seg)) return [item(raw, 'CBUQ', ['REDE ESGOTO'], 'REPOS CAPA ASFÁLTICA CBUQ-ASSENT REDE2M', q.qtd, q.motivo)]
    if (/rede_agua/.test(seg)) return [item(raw, 'CBUQ', ['REDE AGUA'], 'REPOSIÇÃO DE CAPA ASFÁLTICA CBUQ - ASSEN', q.qtd, q.motivo)]
    return [item(raw, 'CBUQ', [], null, q.qtd, 'informar o serviço-pai do CBUQ (rede água/rede esgoto)')]
  }

  // ── EMBOQUE MND — dois itens homônimos no contrato → sempre revisar ──
  if (/tag_emboque/.test(seg)) {
    const q = escolherQtd(seg, extrairNumeros(seg), seg.indexOf('tag_emboque'), 'EMBOQUE MND', false)
    return [item(raw, 'EMBOQUE MND', mnd ? ['MND'] : [], null, q.qtd, 'dois itens homônimos no contrato — escolher na medição')]
  }

  // ── CONEX SELA / LUVA ──
  const mSela = seg.match(/conex_sela/)
  if (mSela) {
    const nums = extrairNumeros(seg)
    const { dn, resto } = acharDn(mSela.index!, DN_CONHECIDOS, nums)
    const q = escolherQtd(seg, resto, mSela.index!, 'CONEX SELA', false)
    if (dn === null) return [item(raw, 'CONEX SELA', [], null, q.qtd, 'informar DN da sela')]
    const desc =
      dn >= 40 && dn <= 90 ? 'ADIC P/INST SELAS ELETROSSOLD 40 A 90MM.' :
      dn >= 110 && dn <= 125 ? 'ADICI P/INSTAL SELAS ELETROS 110/125MM.' :
      dn >= 140 && dn <= 160 ? 'ADIC P/INSTAL SELAS ELETROS 140 A 160MM.' :
      dn >= 180 && dn <= 315 ? 'ADIC P/INSTAL SELAS ELETROS 180 A 315MM' : null
    if (!desc) return [item(raw, 'CONEX SELA', [`DN ${dn}`], null, q.qtd, `DN ${dn} fora das faixas de sela do contrato`)]
    return [item(raw, 'CONEX SELA', [`DN ${dn}`], desc, q.qtd, q.motivo)]
  }
  const mLuva = seg.match(/conex_luva/)
  if (mLuva) {
    const nums = extrairNumeros(seg)
    const { dn, resto } = acharDn(mLuva.index!, [20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 180, 200, 250, 315], nums)
    const q = escolherQtd(seg, resto, mLuva.index!, 'CONEX LUVA', false)
    if (dn === null) return [item(raw, 'CONEX LUVA', [], null, q.qtd, 'informar DN da luva')]
    const desc =
      dn >= 20 && dn <= 32 ? 'ADC INST LUVA ELETR DE 20 A 32' :
      dn >= 40 && dn <= 90 ? 'ADC INST LUVA ELETR DE 40 A 90' :
      dn >= 110 && dn <= 125 ? 'ADC INST LUVA ELETR DE 110 A 125' :
      dn >= 140 && dn <= 160 ? 'ADC INST LUVA ELETR DE 140 A 160' :
      dn >= 180 && dn <= 315 ? 'ADC INST LUVA ELETR DE 180 A 315' : null
    if (!desc) return [item(raw, 'CONEX LUVA', [`DN ${dn}`], null, q.qtd, `DN ${dn} fora das faixas de luva do contrato`)]
    return [item(raw, 'CONEX LUVA', [`DN ${dn}`], desc, q.qtd, q.motivo)]
  }

  // ── INTERLIG — ANTES de rede_*: "interligação de rede de água" é
  // interligação, NUNCA metragem de rede assentada ──
  const mIl = seg.match(/tag_interlig/)
  if (mIl) {
    // interligação mencionando rede_* ou conexão não mapeada ('te'/'tê') —
    // itens/quantidades ambíguos → nunca medir em silêncio
    if (/rede_agua|rede_esgoto|rede_pvc|\btes?\b/.test(seg))
      return [item(raw, 'INTERLIG', [], null, null, 'interligação de rede — confirmar item e quantidade na medição')]
    const flang = /\bflang\b/.test(seg)
    const q = escolherQtd(seg, extrairNumeros(seg), mIl.index!, 'INTERLIG', false)
    if (flang) {
      const f = faixa
      if (f && f[0] >= 200 && f[1] <= 400)
        return [item(raw, 'INTERLIG', ['FLANG', `${f[0]}-${f[1]}`], 'INTERL ATRAVES CONEX FLANG 200 A 400 MM', q.qtd, q.motivo)]
      return [item(raw, 'INTERLIG', ['FLANG'], 'INTERL ATRAVES CONEX FLANGEADAS 80/150MM', q.qtd, q.motivo)]
    }
    if (faixa && faixa[0] >= 150 && faixa[1] <= 250)
      return [item(raw, 'INTERLIG', [`${faixa[0]}-${faixa[1]}`], 'INTERL REDE EXIST PVC/PEAD/FF/FC150/250M', q.qtd, q.motivo)]
    return [item(raw, 'INTERLIG', [], 'INTERL REDE EXIST PVC/PEAD/FF/FC 50/100M', q.qtd, q.motivo)]
  }

  // ── REDE PVC sem sistema explícito — PVC pode ser esgoto → revisar ──
  const mRpvc = seg.match(/rede_pvc/)
  if (mRpvc && !/rede_agua|rede_esgoto/.test(seg)) {
    const nums = extrairNumeros(seg)
    const { resto } = acharDn(mRpvc.index!, DN_CONHECIDOS, nums)
    const q = qtdMetros(resto)
    return [item(raw, 'REDE PVC', [], null, q.qtd, 'rede PVC sem sistema explícito — confirmar se é água ou esgoto')]
  }

  // ── REDE AGUA ──
  const mRa = seg.match(/rede_agua/)
  if (mRa) {
    const nums = extrairNumeros(seg)
    const { dn, resto } = acharDn(mRa.index!, DN_CONHECIDOS, nums)
    const quals = [...(dn !== null ? [`DN ${dn}`] : []), ...(mnd ? ['MND'] : [])]
    const q = qtdMetros(resto)
    if (dn === null) return [item(raw, 'REDE AGUA', quals, null, q.qtd, 'informar DN da rede de água')]
    if (dn === 32) return [item(raw, 'REDE AGUA', quals, 'PRA PEAD 32MM C/REP', q.qtd, q.motivo)]
    if (dn >= 63 && dn <= 125) return [item(raw, 'REDE AGUA', quals, 'PRA PEAD DE 63 A 125 MM S/REP', q.qtd, q.motivo)]
    return [item(raw, 'REDE AGUA', quals, null, q.qtd, `DN ${dn} fora das faixas de rede de água (32 / 63 a 125)`)]
  }

  // ── REDE ESGOTO ──
  const mRe = seg.match(/rede_esgoto/)
  if (mRe) {
    let nums = extrairNumeros(seg)
    const { dn, resto } = acharDn(mRe.index!, [150, 200, 300, 315, 400], nums)
    nums = resto
    // 'REDE ESGOTO 150 3M': 3m de rede ou prof 3m? → nunca decidir em silêncio
    const amb = profOuMetragemAmbigua(mRe.index!, nums, 5)
    if (amb !== null)
      return [item(raw, 'REDE ESGOTO', [...(dn !== null ? [`DN ${dn}`] : []), ...(mnd ? ['MND'] : [])], null, null, `${amb}m é metragem ou profundidade? — confirmar`)]
    const { prof, resto: resto2 } = acharProf(mRe.index!, nums, 5)
    const quals = [...(dn !== null ? [`DN ${dn}`] : []), ...(prof !== null ? [`PROF ${prof}M`] : []), ...(mnd ? ['MND'] : [])]
    const q = qtdMetros(resto2)
    if (dn === null) return [item(raw, 'REDE ESGOTO', quals, null, q.qtd, 'informar DN da rede de esgoto (150/200/300/400)')]
    if (dn === 315) return [item(raw, 'REDE ESGOTO', quals, null, q.qtd, 'DN315: confirmar se mede como PVC 300 ou rede coletora-BE')]
    let desc: string | null = null
    if (dn === 150 || dn === 200) {
      const p = prof ?? 2
      desc =
        p <= 2 ? `PRE MEC OU MAN PVC ${dn} ATE 2,0M S/REP` :
        p <= 2.7 ? `PRE PVC ${dn} ATE 2,7M S/REP` :
        p <= 3.5 ? `PRE PVC ${dn} ATE 3,5M S/REP` : null
    } else {
      const p = prof ?? 1.5
      desc =
        p <= 1.5 ? `PRE PVC ${dn} ATE 1,5M S/REP` :
        p <= 2 ? `PRE PVC ${dn} ATE 2M S/REP` :
        p <= 2.7 ? `PRE PVC ${dn} ATE 2,7M S/REP` :
        p <= 3.5 ? `PRE PVC ${dn} ATE 3,5M S/REP` : null
    }
    if (!desc) return [item(raw, 'REDE ESGOTO', quals, null, q.qtd, `profundidade ${prof}m fora das faixas do DN ${dn}`)]
    return [item(raw, 'REDE ESGOTO', quals, desc, q.qtd, q.motivo)]
  }

  // ── RAMAL ──
  const mRamal = seg.match(/tag_ramal/)
  if (mRamal) {
    const nums = extrairNumeros(seg)
    const { dn, resto } = acharDn(mRamal.index!, [100, 150, 200], nums)
    const q = qtdMetros(resto)
    const dnFinal = dn ?? 100
    const desc =
      dnFinal === 150 ? 'RAMAL COLETIVO DE ESGOTO EM PVC DN 150 M' :
      dnFinal === 200 ? 'RAMAL COLETIVO DE ESGOTO EM PVC DN 200 M' :
      'RAMAL COLETIVO DE ESGOTO EM PVC DN 100 M'
    return [item(raw, 'RAMAL', [`DN ${dnFinal}`], desc, q.qtd, q.motivo)]
  }

  // ── CAIXA UMA / CI / CAIXA solta ──
  const mCu = seg.match(/caixa_uma/)
  if (mCu) {
    const q = escolherQtd(seg, extrairNumeros(seg), mCu.index!, 'CAIXA UMA', false)
    return [item(raw, 'CAIXA UMA', [], 'INSTALAÇÃO CAIXA P/UNID MEDIÇÃO ÁGUA', q.qtd, q.motivo)]
  }
  const mCi = seg.match(/tag_ci|\bcis?\b/)
  if (mCi) {
    const q = escolherQtd(seg, extrairNumeros(seg), mCi.index!, 'CI', false, !mCi[0].startsWith('tag_'))
    return [item(raw, 'CI', [], 'CAIXA DE INSPEÇÃO (60X60) ATÉ 1,25 M', q.qtd, q.motivo)]
  }

  // ── PV ──
  const mPv = seg.match(/tag_pv|\bpvs?\b/)
  if (mPv) {
    const pvBare = !mPv[0].startsWith('tag_')
    if (/q_temposeco/.test(seg)) {
      const q = escolherQtd(seg, extrairNumeros(seg), mPv.index!, 'PV', true, pvBare)
      return [item(raw, 'PV', ['TEMPO SECO'], 'EXEC PV DE TEMPO SECO ATÉ 2 M', q.qtd, q.motivo)]
    }
    let nums = extrairNumeros(seg)
    const ambPv = profOuMetragemAmbigua(mPv.index!, nums, 5)
    if (ambPv !== null)
      return [item(raw, 'PV', [], null, null, `${ambPv}m é quantidade ou profundidade? — confirmar`)]
    const { prof, resto } = acharProf(mPv.index!, nums, 5)
    nums = resto
    const quals = prof !== null ? [`PROF ${prof}M`] : []
    const q = escolherQtd(seg, nums, mPv.index!, 'PV', true, pvBare)
    const p = prof ?? 2
    const desc =
      p <= 2 ? 'CPV ATE 2M S/REP' :
      p <= 3 ? 'CPV DE 2 A 3M S/REP' :
      p <= 4 ? 'CPV DE 3 A 4M S/REP' :
      p <= 5 ? 'CPV DE 4 A 5M S/REP' : null
    if (!desc) return [item(raw, 'PV', quals, null, q.qtd, `profundidade ${prof}m fora das faixas de PV`)]
    return [item(raw, 'PV', quals, desc, q.qtd, q.motivo)]
  }

  // ── PI ──
  const mPi = seg.match(/tag_pi|\bpis?\b/)
  if (mPi) {
    let nums = extrairNumeros(seg)
    const ambPi = profOuMetragemAmbigua(mPi.index!, nums, 3)
    if (ambPi !== null)
      return [item(raw, 'PI', [], null, null, `${ambPi}m é quantidade ou profundidade? — confirmar`)]
    const { prof, resto } = acharProf(mPi.index!, nums, 3)
    nums = resto
    const quals = prof !== null ? [`PROF ${prof}M`] : []
    const q = escolherQtd(seg, nums, mPi.index!, 'PI', true, !mPi[0].startsWith('tag_'))
    const p = prof ?? 1.6
    const desc = p <= 1.6 ? 'CONSTPI ATE 1,6M S/REP' : p <= 3 ? 'CONSTPI DE 2 A 3M S/REP' : null
    if (!desc) return [item(raw, 'PI', quals, null, q.qtd, `profundidade ${prof}m fora das faixas de PI`)]
    return [item(raw, 'PI', quals, desc, q.qtd, q.motivo)]
  }

  // ── HM (gera DOIS itens) ──
  const mHm = seg.match(/tag_hm|\bhms?\b/)
  if (mHm) {
    const q = escolherQtd(seg, extrairNumeros(seg), mHm.index!, 'HM', false, !mHm[0].startsWith('tag_'))
    return [
      item(raw, 'HM', [], 'ADC INST CV', q.qtd, q.motivo),
      item(raw, 'HM', [], 'ADC INST HID CV MULT', q.qtd, q.motivo),
    ]
  }

  // ── INTRA ──
  const mIntra = seg.match(/\bintra\b/)
  if (mIntra) {
    const agua = /\bagua\b/.test(seg)
    const tipo2 = /tipo_2/.test(seg)
    const parcial = /\bparcial\b/.test(seg)
    const quals = [...(agua ? ['AGUA'] : []), ...(tipo2 ? ['TIPO 2'] : []), ...(parcial ? ['PARCIAL'] : [])]
    const q = escolherQtd(seg, extrairNumeros(seg), mIntra.index!, 'INTRA', false)
    let desc: string | null
    if (agua) {
      if (parcial) return [item(raw, 'INTRA', quals, null, q.qtd, 'intra água parcial não tem item no contrato — confirmar')]
      desc = tipo2 ? 'LIGAÇÃO DE ÁGUA INTRADOMICILIAR-TIPO II' : 'LIGAÇÃO DE ÁGUA INTRADOMICILIAR-TIPO I'
    } else {
      desc = tipo2
        ? (parcial ? 'LIGACAO INTRADOMICILIAR TIPO 2 PARCIAL' : 'LIGACAO INTRADOMICILIAR TIPO 2')
        : (parcial ? 'LIGACAO INTRADOMICILIAR TIPO 1 PARCIAL' : 'LIGACAO INTRADOMICILIAR TIPO 1')
    }
    return [item(raw, 'INTRA', quals, desc, q.qtd, q.motivo)]
  }

  // ── VALVULA ──
  const mVal = seg.match(/tag_valvula/)
  if (mVal) {
    const ff = /\bff\b/.test(seg)
    const q = escolherQtd(seg, extrairNumeros(seg), mVal.index!, 'VALVULA', false)
    if (ff && faixa && faixa[0] >= 150 && faixa[1] <= 250)
      return [item(raw, 'VALVULA', ['FF', '150-250'], 'INSTAL VALVULA FF DN 150 A 250MM, S/REP', q.qtd, q.motivo)]
    if (ff) return [item(raw, 'VALVULA', ['FF'], 'INSTAL VALVULA FF DN 50 A 100MM, S/REP', q.qtd, q.motivo)]
    if (faixa) return [item(raw, 'VALVULA', [`${faixa[0]}-${faixa[1]}`], null, q.qtd, 'válvula em faixa maior sem material FF informado — confirmar item')]
    return [item(raw, 'VALVULA', [], 'INSTAL VALVULA PVC DN 50 A 100MM, S/REP', q.qtd, q.motivo)]
  }

  // ── COMUNICADO ──
  const mCom = seg.match(/tag_comunicado/)
  if (mCom) {
    const q = escolherQtd(seg, extrairNumeros(seg), mCom.index!, 'COMUNICADO', false)
    return [item(raw, 'COMUNICADO', [], 'PLANO DE COMERCIALIZAÇÃO DE LIGAÇÕES', q.qtd, q.motivo)]
  }

  // ── INTERF ──
  const mItf = seg.match(/tag_interf|\binterf\b/)
  if (mItf) {
    const q = escolherQtd(seg, extrairNumeros(seg), mItf.index!, 'INTERF', false)
    if (/\bagua\b/.test(seg)) return [item(raw, 'INTERF', ['AGUA'], 'PRESERVACAO INTERFERENCIAS-SERV DE ÁGUA', q.qtd, q.motivo)]
    if (/\besgoto\b/.test(seg)) return [item(raw, 'INTERF', ['ESGOTO'], 'PRESERVACAO DE INTERFERENCIAS-SERV ESG', q.qtd, q.motivo)]
    return [item(raw, 'INTERF', [], null, q.qtd, 'informar o sistema da interferência (água/esgoto)')]
  }

  // ── LA ──
  const mLa = seg.match(/tag_la|\blas?\b/)
  if (mLa) {
    const pos = acharPosicao(seg)
    let nums = extrairNumeros(seg)
    // 32 em posição de DN da LA (32mm por definição) nunca é quantidade
    nums = nums.filter((n) => !(n.v === 32 && n.i > mLa.index!))
    const q = escolherQtd(seg, nums, mLa.index!, 'LA', false, !mLa[0].startsWith('tag_'))
    const quals = [...(mnd ? ['MND'] : []), ...(av ? ['AV'] : []), ...(pos ? [pos.toUpperCase()] : [])]
    if (mnd) {
      const desc = av ? 'LAG ATE 32MM MND AVUL S/REP' : 'LAG MND SUCES S/REP'
      return [item(raw, 'LA', quals, desc, q.qtd, q.motivo)]
    }
    if (!pos) return [item(raw, 'LA', quals, null, q.qtd, 'informar posição: PA/TA/EIXO/TO/PO')]
    const desc = av ? POS_LA_AV[pos] : POS_LA[pos]
    return [item(raw, 'LA', quals, desc, q.qtd, q.motivo)]
  }

  // ── LE ──
  const mLe = seg.match(/tag_le|\bles?\b/)
  if (mLe) {
    const pos = acharPosicao(seg)
    let nums = extrairNumeros(seg)
    const ambLe = profOuMetragemAmbigua(mLe.index!, nums, 4)
    if (ambLe !== null)
      return [item(raw, 'LE', [], null, null, `${ambLe}m é quantidade ou profundidade? — confirmar`)]
    const { prof, resto } = acharProf(mLe.index!, nums, 4)
    nums = resto
    const q = escolherQtd(seg, nums, mLe.index!, 'LE', true, !mLe[0].startsWith('tag_'))
    const quals = [...(av ? ['AV'] : []), ...(prof !== null ? [`PROF ${prof}M`] : []), ...(pos ? [POS_LE_SIGLA[pos]] : [])]
    if (!pos) return [item(raw, 'LE', quals, null, q.qtd, 'informar posição: PA/TA/EX/TO/PO')]
    const sigla = POS_LE_SIGLA[pos]
    if (prof !== null && prof > 2 && prof <= 4)
      return [item(raw, 'LE', quals, `LESG PVC DE 2 A 4M ${sigla} AVUL S/REP`, q.qtd, q.motivo)]
    if (prof !== null && prof > 4)
      return [item(raw, 'LE', quals, null, q.qtd, `profundidade ${prof}m acima de 4m — sem item padrão, revisar`)]
    if (av || (prof !== null && prof <= 2))
      return [item(raw, 'LE', quals, `LESG PVC ATE 2M ${sigla} AVUL S/REP`, q.qtd, q.motivo)]
    return [item(raw, 'LE', quals, `LESG PVC ${sigla} SUCES S/REP`, q.qtd, q.motivo)]
  }

  // ── CAIXA solta (sem UMA / sem inspeção) → nunca chutar ──
  const mCaixa = seg.match(/\bcaixas?\b/)
  if (mCaixa) {
    const q = escolherQtd(seg, extrairNumeros(seg), mCaixa.index!, 'CAIXA', false)
    return [item(raw, 'CAIXA', [], null, q.qtd, "'caixa' sozinha: informar se é CAIXA UMA ou caixa de inspeção (CI)")]
  }

  return null
}

// ─── Cabeçalho ───────────────────────────────────────────────────────────────

function parseData(n: string, avisos: string[]): { data: string | null; achou: boolean } {
  // duas datas ('27 e 28/07') → período de 2 dias
  if (/\b\d{1,2}\s*e\s*\d{1,2}\s*\/\s*\d{1,2}\b/.test(n)) {
    avisos.push('período de 2 dias — dividir manualmente')
    return { data: null, achou: true }
  }
  const m = n.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (!m) return { data: null, achou: false }
  const dia = parseInt(m[1])
  const mes = parseInt(m[2])
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return { data: null, achou: false }
  let ano: number
  if (m[3]) {
    ano = parseInt(m[3])
    if (ano < 100) ano += 2000
  } else {
    ano = new Date().getFullYear()
    avisos.push(`data sem ano — assumido ano corrente (${ano})`)
  }
  const pad = (x: number) => String(x).padStart(2, '0')
  return { data: `${ano}-${pad(mes)}-${pad(dia)}`, achou: true }
}

// ─── Pré-normalização do formato "estruturado" (planilha da equipe) ──────────
/**
 * A equipe aponta num formato de planilha: cabeçalho rotulado (Núcleo / Produção /
 * Equipe / Imóvel), seções SERVIÇO ÁGUA / ESGOTO, uma "SIGLA - valor" por linha
 * (RE, RA, LA, LE, LIA, LIE, PV, PI, HM, Caixa UMA, Caixa de inspeção,
 * Interligação, Válvula...) e "0" no que não teve, com vários imóveis na mesma
 * mensagem. Esta camada TRADUZ esse formato para o texto por extenso que o
 * parser já entende — sem tocar no miolo testado. Se a mensagem não estiver
 * nesse formato, devolve o texto intacto (o formato antigo segue funcionando).
 */
const SEP_ROT = '[-–—:]'

/** traduz uma linha "ROTULO - valor" → texto por extenso. null = pular (0/não teve); undefined = rótulo desconhecido. */
function traduzServico(rotulo: string, valor: string): string | null | undefined {
  const v = valor.trim()
  if (v === '' || v === '0' || v === '0,0' || v === '0.0') return null // não teve

  const r = norm(rotulo).replace(/\./g, '').replace(/\s+/g, ' ').trim()
  const numeros = v.match(/\d+(?:[.,]\d+)?/g) ?? []
  const dnMatch = v.match(/(\d{2,3})\s*mm\b/) ?? v.match(/\bdn\s*(\d{2,3})\b/i)
  const dn = dnMatch ? dnMatch[1] : null
  const qtd = numeros.find((x) => x.replace(/[.,]/g, '') !== (dn ?? '__')) ?? numeros[0] ?? ''
  const pos = (norm(v).match(/\b(pa|ta|eixo|to|po)\b/) ?? [])[1] ?? ''
  const dnTxt = dn ? ` ${dn}mm` : ''

  // preserva qualificadores que mudam o item/preço (whitelist — sem números)
  const nv = norm(v)
  const qz: string[] = []
  if (/\bff\b/.test(nv)) qz.push('ff')
  if (/\bmnd\b/.test(nv)) qz.push('mnd')
  if (/espec/.test(nv)) qz.push('especial')
  if (/\bparcial\b/.test(nv)) qz.push('parcial')
  if (/tempo\s*seco/.test(nv)) qz.push('tempo seco')
  if (/\btipo\s*(?:2|ii)\b/.test(nv)) qz.push('tipo 2')
  const ex = qz.length ? ' ' + qz.join(' ') : ''

  // quantidade SEMPRE antes do serviço: evita que o parser leia um número
  // pequeno pós-tag como profundidade (LE/PV/PI/REDE ESGOTO são profCapable).
  let base: string | undefined
  switch (r) {
    case 're':
    case 'pre': base = `${qtd} metros rede de esgoto${dnTxt}`; break // PRA/PRE = nome do item no contrato
    case 'ra':
    case 'pra': base = `${qtd} metros rede de agua${dnTxt}`; break
    case 'la': base = `${qtd} ligacao de agua${pos ? ' ' + pos : ''}`; break
    case 'le': base = `${qtd} ligacao de esgoto${pos ? ' ' + pos : ''}`; break
    case 'lia': base = `${qtd} intra agua`; break
    case 'lie': base = `${qtd} intra`; break
    case 'pv': base = `${qtd} pocos de visita`; break
    case 'pi': base = `${qtd} pocos de inspecao`; break
    case 'hm': base = `${qtd} hidrometros`; break
    case 'ci':
    case 'caixa de inspecao': base = `${qtd} caixa de inspecao`; break
    case 'caixa uma': base = `${qtd} caixa uma`; break
    case 'interligacao':
    case 'interligacoes':
    case 'interlig': base = `${qtd} interlig`; break
    case 'valvula': base = `${qtd} valvula${dnTxt}`; break
    default: return undefined // rótulo desconhecido (ex: corte de ramal, solda) → observação
  }
  return base + ex
}

/** heurística: a mensagem está no formato de planilha da equipe (rótulos/seções/siglas+valor)? */
export function pareceEstruturado(texto: string): boolean {
  return texto.split(/\r?\n/).some(
    (l) =>
      /^\s*(n[úu]cleo|produç|produc|im[óo]vel|endere|equipe)\s*[-–—:]/i.test(l) ||
      /^\s*servi[çc]o\s+(de\s+)?(agua|água|esgoto)/i.test(l) ||
      new RegExp(`^\\s*(re|ra|pre|pra|la|le|lia|lie|pv|pi|hm|ci)\\s*${SEP_ROT}\\s*\\d`, 'i').test(l),
  )
}

export function preNormalizarApontamento(texto: string): string {
  const linhas = texto.split(/\r?\n/)
  if (!pareceEstruturado(texto)) return texto

  let dataLinha = ''
  let equipe = ''
  let nucleo = ''
  const imoveis: string[] = []
  const corpo: string[] = []

  for (const raw of linhas) {
    const l = raw.trim()
    if (!l) continue
    let m: RegExpMatchArray | null

    if ((m = l.match(new RegExp(`^\\s*n[úu]cleo\\s*${SEP_ROT}\\s*(.+)$`, 'i')))) { nucleo = m[1].trim(); continue }
    if ((m = l.match(new RegExp(`^\\s*(?:produç[ãa]o|produc[ãa]o|data)\\s*${SEP_ROT}\\s*(.+)$`, 'i')))) {
      const d = m[1].match(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/)
      if (d) dataLinha = d[0]
      continue
    }
    if ((m = l.match(new RegExp(`^\\s*equipe\\s*${SEP_ROT}\\s*(.+)$`, 'i')))) { equipe = m[1].trim(); continue }
    if ((m = l.match(new RegExp(`^\\s*(?:im[óo]vel|endere[çc]o)\\s*${SEP_ROT}\\s*(.+)$`, 'i')))) { imoveis.push(m[1].trim()); continue }
    if (/^\s*servi[çc]o\s+(de\s+)?(agua|água|esgoto)/i.test(l)) continue

    const sm = l.match(new RegExp(`^\\s*(.+?)\\s*${SEP_ROT}\\s*(.*)$`))
    if (sm) {
      const t = traduzServico(sm[1], sm[2])
      if (t === null) continue
      corpo.push(t === undefined ? `obs: ${l}` : t)
      continue
    }
    corpo.push(l)
  }

  const out: string[] = []
  if (dataLinha) out.push(dataLinha)
  if (equipe || nucleo) out.push(`EQUIPE ${equipe || '(não informada)'}${nucleo ? ' — ' + nucleo : ''}`)
  if (imoveis.length) out.push(`obs: imóveis — ${imoveis.join(', ')}`)
  out.push(...corpo)
  return out.join('\n')
}

// ─── Parser principal ────────────────────────────────────────────────────────

export function parseApontamento(textoOriginal: string): ApontamentoParse {
  const texto = preNormalizarApontamento(textoOriginal)
  const avisos: string[] = []
  const observacoes: string[] = []
  const itens: ApontamentoItem[] = []
  let data: string | null = null
  let equipe: string | null = null
  let nucleo: string | null = null

  const linhas = stripFormatacao(texto)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  let dataConsumida = false
  let corpoIniciado = false

  for (const raw of linhas) {
    const n = norm(raw)

    // cabeçalho: 1ª linha com data (antes de qualquer item/observação)
    if (!dataConsumida && !corpoIniciado && /\d{1,2}\/\d{1,2}/.test(n)) {
      const r = parseData(n, avisos)
      if (r.achou) {
        data = r.data
        dataConsumida = true
        continue
      }
    }
    // cabeçalho: EQUIPE <nome> [—/-] [núcleo]
    if (!equipe && !corpoIniciado) {
      const em = raw.match(/^\s*equipe\b[:\s—–-]*(.+)$/i)
      if (em) {
        const partes = em[1].split(/\s*[—–]\s*|\s+-\s+/)
        equipe = partes[0].trim() || null
        nucleo = partes.length > 1 ? partes.slice(1).join(' — ').trim() || null : null
        continue
      }
    }
    // linha-título 'APONTAMENTO' sem números → só cabeçalho
    if (!corpoIniciado && /^apontamento\b/i.test(raw) && !/\d/.test(raw)) continue

    // ── corpo ──
    corpoIniciado = true

    // 'obs...' → observação pura SEMPRE (mesmo com tag dentro)
    if (/^obs\b|^observac/i.test(n)) {
      observacoes.push(raw)
      continue
    }
    // palavras-veto anulam a medição da linha inteira
    if (VETO_RE.test(n)) {
      observacoes.push('[REVISAR] ' + raw)
      continue
    }
    // pré-interligação NÃO é INTERLIG nem INTRA — sempre revisar
    if (/\bpre[\s-]*interligac/.test(n)) {
      itens.push(item(raw, 'PRE-INTERLIG', [], null, null, 'pré-interligação: confirmar se é intra água'))
      continue
    }

    const canon = preprocessarNumeros(canonicalizar(n))
    const segmentos = canon
      .split(/\s*\+\s*|\s*,\s*|\s+e\s+/)
      .map((s) => s.trim())
      .filter(Boolean)

    const naoMedidos: string[] = []
    let algumaTag = false
    for (const seg of segmentos) {
      const res = parseSegmento(seg, raw)
      if (res && res.length > 0) {
        itens.push(...res)
        algumaTag = true
      } else {
        naoMedidos.push(seg)
      }
    }
    if (!algumaTag) {
      observacoes.push(raw)
    } else if (naoMedidos.length > 0) {
      observacoes.push(`[trecho não medido] ${raw} → "${naoMedidos.join(' | ')}"`)
    }
  }

  if (!dataConsumida && data === null && avisos.every((a) => !a.startsWith('período'))) {
    avisos.push('data não encontrada no cabeçalho')
  }

  return { data, equipe, nucleo, itens, observacoes, avisos }
}
