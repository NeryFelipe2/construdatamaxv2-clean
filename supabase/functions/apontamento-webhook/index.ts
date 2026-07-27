/**
 * apontamento-webhook — o "cérebro" do bot WhatsApp da obra WCR.
 *
 * Recebe o webhook da Evolution API (evento messages.upsert) do grupo
 * APONTAMENTO WCR, interpreta o apontamento com o MESMO parser puro do frontend
 * (parse.ts, cópia literal de utils/parseApontamento.ts) e grava
 * rdos → rdo_equipes → rdo_atividades DIRETO no Supabase com service role.
 * O TRIGGER do banco (sync_rdo_to_medicao) gera os medicao_itens precificados a
 * 60% sozinho — esta função NUNCA grava medicao_itens.
 *
 * Fecha o ciclo campo → sistema sem ninguém colar nada: responde o "eco" no
 * próprio grupo (N itens · R$ medido · M pra revisar) e faz as perguntas de
 * posição (PA/TA/EIXO/TO/PO) das LA/LE pendentes, guardando o estado em
 * apontamento_conversa pra fechar quando o encarregado responder.
 *
 * Regras de ouro (herdadas do parser e do useApontamento.ts):
 *   - NUNCA chutar preço nem código: tudo vem de precos_contrato.
 *   - Anti-loop CRÍTICO: ignorar fromMe=true (não reagir às próprias mensagens).
 *   - Idempotência ATÔMICA por wa_msg_id — Evolution reenvia webhooks, às vezes
 *     concorrentemente (o retry chega antes de a 1ª request commitar). A garantia
 *     real é o índice UNIQUE `rdos_wa_msg_id_uidx` em (payload->>'wa_msg_id')
 *     (migration supabase/migrations/20260710000000_rdos_wa_msg_id_unique.sql):
 *     a 2ª gravação leva 23505 e é tratada como "já processado". O SELECT-antes
 *     é só um atalho — NÃO é o que impede a duplicação (medição dobrada = $$).
 *     Quando o webhook chega sem data.key.id, derivamos uma chave estável por
 *     hash (grupo+autor+timestamp+texto) pra idempotência NUNCA ser pulada.
 *   - Sem Evolution configurada, LOGA o eco e segue: o RDO já foi gravado.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { parseApontamento, pareceEstruturado, type ApontamentoItem, type ApontamentoParse } from './parse.ts'

// ─── ENV ─────────────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''
const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') ?? '').replace(/\/+$/, '')
const EVOLUTION_KEY = Deno.env.get('EVOLUTION_KEY') ?? ''
const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE') ?? ''

// ─── util ────────────────────────────────────────────────────────────────────

/** minúsculas + sem acentos (mesmo norm do parser) */
function norm(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * SHA-256 hex de uma string (Web Crypto — nativo no Deno).
 * Usado só pra derivar a chave de idempotência quando o webhook chega SEM
 * data.key.id. Hash forte (256 bits) de propósito: uma colisão descartaria um
 * apontamento REAL como "duplicado" em silêncio — exatamente o que não pode
 * acontecer. O texto normalizado entra inteiro, então apontamentos diferentes
 * geram chaves diferentes; só o MESMO conteúdo (retry) colide e é deduplicado.
 */
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Chave de deduplicação estável do webhook. Usa o data.key.id da Evolution
 * quando existe; senão deriva 'nokey:<sha256>' de grupo+autor+timestamp+texto,
 * que se repete de forma idêntica num reenvio do MESMO evento (a Evolution
 * preserva messageTimestamp nos retries). Nunca retorna vazio, então a
 * idempotência jamais é pulada por falta de id.
 */
async function derivarDedupKey(
  waMsgId: string | null,
  parts: { grupoJid: string; autorJid: string; messageTimestamp: string; texto: string },
): Promise<string> {
  if (waMsgId && waMsgId.trim()) return waMsgId
  const seed = `${parts.grupoJid}|${parts.autorJid}|${parts.messageTimestamp}|${norm(parts.texto)}`
  return `nokey:${await sha256Hex(seed)}`
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
/** resposta padrão do webhook: 200 rápido, sempre (a Evolution reenvia se não). */
const ok = (msg: string, extra: Record<string, unknown> = {}) => json({ ok: true, msg, ...extra }, 200)

// ─── Preços / catálogo (porta servidor do useApontamento.ts) ─────────────────

interface CatalogoPreco {
  codigo: string
  unidade: string | null
  valor_unitario: number
  fator_wcr: number
}

/** regiao_codigo do projeto ('2' Boi Malhado, '3' Sakura/Retorno) — ou null. */
async function carregarRegiaoProjeto(sb: SupabaseClient, projetoId: string): Promise<string | null> {
  const { data, error } = await sb
    .from('projetos')
    .select('regiao_codigo')
    .eq('id', projetoId)
    .maybeSingle()
  if (error || !data) return null
  return (data as { regiao_codigo: string | null }).regiao_codigo ?? null
}

/**
 * Catálogo de preços do contrato da região/ano: Map<descricao, preço>.
 * Réplica fiel de carregarCatalogoPrecos: busca o ano inteiro (paginado) e
 * filtra no cliente pelo prefixo da região (código sem zeros à esquerda).
 * As chaves são as descrições LITERAIS do contrato, iguais às que o parser
 * devolve em descricaoContrato — por isso o get(descricao) casa direto.
 */
async function carregarCatalogoPrecos(
  sb: SupabaseClient,
  regiaoCodigo: string,
  ano: string,
): Promise<Map<string, CatalogoPreco>> {
  const map = new Map<string, CatalogoPreco>()
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from('precos_contrato')
      .select('codigo, descricao, unidade, valor_unitario, fator_wcr')
      .eq('ano', ano)
      .order('codigo', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error || !data || data.length === 0) break
    for (const r of data as {
      codigo: string
      descricao: string
      unidade: string | null
      valor_unitario: number
      fator_wcr: number | null
    }[]) {
      const cod = String(r.codigo ?? '')
      if (!cod.replace(/^0+/, '').startsWith(regiaoCodigo)) continue
      map.set(r.descricao, {
        codigo: cod,
        unidade: r.unidade,
        valor_unitario: Number(r.valor_unitario),
        fator_wcr: Number(r.fator_wcr ?? 0.6),
      })
    }
    if (data.length < pageSize) break
  }
  return map
}

/** preço 60% WCR do item (mesma fórmula do ApontamentoModal). */
function preco60De(cat: CatalogoPreco | undefined): number | null {
  return cat ? round2(cat.valor_unitario * cat.fator_wcr) : null
}

// ─── Resolução de projeto (núcleo do parse → nome do projeto, senão padrão) ──

/**
 * Match do núcleo do apontamento contra projetos.nome (normalizado, nos dois
 * sentidos: 'BOI MALHADO' casa 'WCR Boi Malhado' e vice-versa). Sem match →
 * projeto_padrao_id do bot_config.
 */
async function resolverProjeto(
  sb: SupabaseClient,
  nucleo: string | null,
  projetoPadraoId: string | null,
): Promise<string | null> {
  if (nucleo && nucleo.trim()) {
    const { data } = await sb.from('projetos').select('id, nome')
    const alvo = norm(nucleo)
    const hit = ((data ?? []) as { id: string; nome: string | null }[]).find((p) => {
      const nm = norm(p.nome ?? '')
      return nm.length > 0 && (nm.includes(alvo) || alvo.includes(nm))
    })
    if (hit) return hit.id
  }
  return projetoPadraoId ?? null
}

// ─── Envio ao grupo (Evolution API) ──────────────────────────────────────────

/**
 * Envia o eco pro grupo. Sem EVOLUTION_URL/KEY/INSTANCE, LOGA e segue — o RDO
 * já foi gravado, então testar o webhook sem a Evolution no ar não quebra nada.
 * Nunca lança: uma falha de envio não pode derrubar o webhook.
 */
async function enviarEco(grupoJid: string, texto: string): Promise<{ enviado: boolean; motivo?: string }> {
  if (!EVOLUTION_URL || !EVOLUTION_KEY || !EVOLUTION_INSTANCE) {
    console.log(`[eco:LOG — Evolution não configurada] → ${grupoJid}\n${texto}`)
    return { enviado: false, motivo: 'evolution_nao_configurada' }
  }
  // timeout: a Evolution/Baileys pendura ao enviar pra grupo inexistente ou
  // quando está lenta/fora. Sem isso, um eco travado derruba o webhook inteiro
  // (e a Evolution reenvia → retry storm). Aborta em 10s e segue — o RDO já foi
  // gravado; o eco é best-effort.
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 10000)
  try {
    const resp = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: EVOLUTION_KEY },
      body: JSON.stringify({ number: grupoJid, text: texto }),
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      console.error(`[eco] Evolution respondeu ${resp.status}: ${body}`)
      return { enviado: false, motivo: `http_${resp.status}` }
    }
    return { enviado: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[eco] falha ao enviar:', msg)
    return { enviado: false, motivo: ctrl.signal.aborted ? 'timeout' : 'fetch_erro' }
  } finally {
    clearTimeout(t)
  }
}

// ─── Posição da ligação (resposta do encarregado) ────────────────────────────

// conectores/tags que NÃO contam como "conteúdo" numa resposta de posição.
// Propositalmente enxuto: só ligações vazias que podem ladear a sigla numa
// resposta curta ("no pa", "a le é to", "foi pa"). Nada de "aqui/sim/ok/indo".
const FILLER_POS = new Set([
  'la', 'le', 'a', 'o', 'e', 'de', 'do', 'da', 'no', 'na', 'em', 'eh',
  'pos', 'posicao', 'fica', 'foi', 'pra', 'pro',
])

/**
 * Acha a posição PA/TA/EIXO(EX)/TO/PO na resposta do encarregado.
 * 'EIXO'/'EX' são termos inequívocos de saneamento → aceitos direto.
 * As siglas de 2 letras (PA/TA/TO/PO) colidem com o português coloquial
 * ("tá", "tô/to indo", "pá") → só valem se a resposta for ESSENCIALMENTE a
 * posição: tirando posição, dígitos, tag (LA/LE) e conectores, não sobra
 * palavra de conteúdo. Assim "tá certo"/"to indo" NÃO fecham uma conversa.
 */
function acharPosicaoReply(texto: string): string | null {
  const n = norm(texto)
  if (/\b(eixo|ex)\b/.test(n)) return 'eixo'
  const m = n.match(/\b(pa|ta|to|po)\b/)
  if (!m) return null
  const resto = n
    .replace(/\b(pa|ta|to|po|eixo|ex)\b/g, ' ')
    .replace(/\d+(?:[.,]\d+)?/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !FILLER_POS.has(w))
  return resto.length === 0 ? m[1] : null
}

// ─── Persistência do apontamento (réplica de salvarApontamento no servidor) ──

interface AtividadeInserida {
  id: string
}

interface SalvarResult {
  status: 'inserted'
  rdoId: string
  atividadesIds: string[]
}

/**
 * Resultado de salvarApontamento. 'duplicate' = o índice UNIQUE de wa_msg_id
 * barrou a segunda gravação concorrente (23505): NADA foi inserido, o RDO já
 * existe. É a idempotência atômica — o chamador não grava conversa nem reenvia
 * eco, só confirma "já processado".
 */
type SalvarOutcome = SalvarResult | { status: 'duplicate' }

/**
 * rdos (status='fechado') → rdo_equipes → rdo_atividades, nessa ordem, com
 * rollback manual em erro. Guarda wa_msg_id + texto original no payload do RDO
 * (idempotência). Devolve os ids das atividades na MESMA ORDEM de parse.itens
 * (insert único preserva a ordem), pra ligar cada LA/LE pendente à sua conversa.
 */
async function salvarApontamento(
  sb: SupabaseClient,
  args: {
    projetoId: string
    parse: ApontamentoParse
    textoOriginal: string
    catalogo: Map<string, CatalogoPreco>
    waMsgId: string
    autorJid: string
    pushName: string | null
  },
): Promise<SalvarOutcome> {
  const { projetoId, parse, textoOriginal, catalogo, waMsgId, autorJid, pushName } = args

  // 1. rdos — a chave real de idempotência. O índice UNIQUE em
  //    (payload->>'wa_msg_id') faz esta insert falhar com 23505 se outra
  //    entrega concorrente do MESMO webhook já gravou. 23505 => 'duplicate'
  //    (idempotente), NÃO é erro: o RDO já existe, não gravamos de novo.
  const { data: rdo, error: e1 } = await sb
    .from('rdos')
    .insert({
      projeto_id: projetoId,
      data: parse.data,
      status: 'fechado',
      origem: 'apontamento_tags',
      apontador: parse.equipe,
      clima: null,
      payload: {
        apontamento_texto: textoOriginal,
        avisos: parse.avisos,
        wa_msg_id: waMsgId,
        autor_jid: autorJid,
        push_name: pushName,
      },
      ocorrencias: parse.observacoes.join('\n') || null,
    })
    .select('id')
    .single()
  if (e1) {
    if ((e1 as { code?: string }).code === '23505') return { status: 'duplicate' }
    throw new Error(`Erro ao criar RDO: ${e1.message}`)
  }
  if (!rdo) throw new Error('Erro ao criar RDO: sem retorno')
  const rdoId = (rdo as { id: string }).id

  // 2. rdo_equipes (tipo é NOT NULL — apontamento sem núcleo não pode quebrar)
  const { data: eq, error: e2 } = await sb
    .from('rdo_equipes')
    .insert({
      rdo_id: rdoId,
      tipo: parse.nucleo || 'apontamento',
      lider_nome: parse.equipe ?? 'apontamento',
      membros: [],
    })
    .select('id')
    .single()
  if (e2 || !eq) {
    await sb.from('rdos').delete().eq('id', rdoId)
    throw new Error(`Erro ao criar equipe do RDO: ${e2?.message ?? 'sem retorno'}`)
  }
  const equipeId = (eq as { id: string }).id

  // 3. rdo_atividades (uma por item; HM já vem como dois itens do parser).
  //    Itens em revisar entram com servico='TAG — REVISAR: motivo' e sem código.
  const rows = parse.itens.map((it) => {
    const cat = it.descricaoContrato ? catalogo.get(it.descricaoContrato) : undefined
    return {
      equipe_id: equipeId,
      servico: it.descricaoContrato ?? `${it.tag} — REVISAR: ${it.motivoRevisar ?? 'confirmar na medição'}`,
      metragem: it.qtd ?? 0,
      medicao_codigo: cat?.codigo ?? null,
      medicao_unidade: cat?.unidade ?? null,
      observacao: it.linhaOriginal,
    }
  })
  const { data: inserted, error: e3 } = await sb.from('rdo_atividades').insert(rows).select('id')
  if (e3 || !inserted) {
    // rollback manual, na ordem inversa
    await sb.from('rdo_atividades').delete().eq('equipe_id', equipeId)
    await sb.from('rdo_equipes').delete().eq('id', equipeId)
    await sb.from('rdos').delete().eq('id', rdoId)
    throw new Error(`Erro ao gravar atividades: ${e3?.message ?? 'sem retorno'}`)
  }

  return { status: 'inserted', rdoId, atividadesIds: (inserted as AtividadeInserida[]).map((r) => r.id) }
}

// ─── Eco de um apontamento novo ──────────────────────────────────────────────

/** item LA/LE que foi pra revisão POR FALTA DE POSIÇÃO (vira conversa). */
function ehPendentePosicao(it: ApontamentoItem): boolean {
  return (
    (it.tag === 'LA' || it.tag === 'LE') &&
    it.revisar &&
    /posi[cç][aã]o/.test(norm(it.motivoRevisar ?? ''))
  )
}

function montarEcoApontamento(
  parse: ApontamentoParse,
  catalogo: Map<string, CatalogoPreco>,
  perguntasPosicao: string[],
): string {
  let totalMedido = 0
  let nMedidos = 0
  let nRevisar = 0
  const outrosRevisar: string[] = []

  for (const it of parse.itens) {
    if (it.revisar) {
      nRevisar++
      if (!ehPendentePosicao(it)) {
        outrosRevisar.push(`• ${it.linhaOriginal} — ${it.motivoRevisar ?? 'confirmar na medição'}`)
      }
      continue
    }
    nMedidos++
    const cat = it.descricaoContrato ? catalogo.get(it.descricaoContrato) : undefined
    const p60 = preco60De(cat)
    if (p60 !== null && it.qtd !== null) totalMedido += round2(p60 * it.qtd)
  }

  const dataFmt = parse.data ? parse.data.split('-').reverse().join('/') : 'SEM DATA'
  const linhas: string[] = []
  linhas.push(
    `✅ ${nMedidos} ${nMedidos === 1 ? 'item' : 'itens'} · R$ ${brl(round2(totalMedido))} medido · ⚠️ ${nRevisar} pra revisar`,
  )
  linhas.push(
    `📋 RDO ${dataFmt}${parse.equipe ? ` · ${parse.equipe}` : ''}${parse.nucleo ? ` · ${parse.nucleo}` : ''}`,
  )
  if (parse.avisos.length > 0) linhas.push(`ℹ️ ${parse.avisos.join(' · ')}`)
  if (perguntasPosicao.length > 0) {
    linhas.push('')
    linhas.push('❓ Responda aqui a posição pra fechar (PA/TA/EIXO/TO/PO):')
    linhas.push(...perguntasPosicao.map((q) => `• ${q}`))
  }
  if (outrosRevisar.length > 0) {
    linhas.push('')
    linhas.push('⚠️ Revisar na medição:')
    linhas.push(...outrosRevisar)
  }
  if (parse.observacoes.length > 0) {
    linhas.push('')
    linhas.push(`📝 ${parse.observacoes.length} observação(ões) anexada(s) ao RDO.`)
  }
  return linhas.join('\n')
}

// ─── Roteamento: APONTAMENTO novo ────────────────────────────────────────────

async function tratarApontamentoNovo(
  sb: SupabaseClient,
  ctx: {
    grupoJid: string
    autorJid: string
    pushName: string | null
    texto: string
    waMsgId: string
    projetoPadraoId: string | null
  },
): Promise<Response> {
  const { grupoJid, autorJid, pushName, texto, waMsgId, projetoPadraoId } = ctx

  // Idempotência (atalho): já existe RDO com esse wa_msg_id? → não reprocessa.
  // Isto é só um fast-path pra evitar trabalho à toa nos retries tranquilos;
  // NÃO é a garantia. A garantia atômica contra a corrida é o índice UNIQUE
  // (23505 tratado como 'duplicate' lá no salvarApontamento). waMsgId já vem
  // resolvido do handler (id da Evolution ou hash de fallback) — nunca vazio.
  {
    const { data: existente } = await sb
      .from('rdos')
      .select('id')
      .eq('payload->>wa_msg_id', waMsgId)
      .limit(1)
    if (existente && existente.length > 0) {
      return ok('apontamento ja processado (idempotencia)', { rdoId: (existente[0] as { id: string }).id })
    }
  }

  const parse = parseApontamento(texto)

  // Resolve projeto (núcleo → nome, senão padrão)
  const projetoId = await resolverProjeto(sb, parse.nucleo, projetoPadraoId)
  if (!projetoId) {
    const eco = `⚠️ Não identifiquei o projeto${parse.nucleo ? ` do núcleo "${parse.nucleo}"` : ' (núcleo não informado)'} e não há projeto padrão configurado. Apontamento NÃO gravado — informe o núcleo ou configure o projeto padrão.`
    await enviarEco(grupoJid, eco)
    return ok('sem projeto — apontamento nao gravado')
  }

  // Guards equivalentes ao salvarApontamento do frontend
  if (!parse.data) {
    const eco = `⚠️ Apontamento sem data única (um dia só). ${parse.avisos.join(' · ') || 'Informe a data no cabeçalho.'} — NÃO gravado.`
    await enviarEco(grupoJid, eco)
    return ok('sem data — apontamento nao gravado')
  }
  if (parse.itens.length === 0) {
    const obs = parse.observacoes.length ? `\n${parse.observacoes.join('\n')}` : ''
    const eco = `⚠️ Nenhum item interpretado no apontamento — nada gravado.${obs}`
    await enviarEco(grupoJid, eco)
    return ok('sem itens — apontamento nao gravado')
  }

  // Catálogo de preços da região/ano (ano = ano da data; fallback ano corrente)
  const regiao = await carregarRegiaoProjeto(sb, projetoId)
  const ano = parse.data ? parse.data.slice(0, 4) : String(new Date().getFullYear())
  const catalogo = regiao ? await carregarCatalogoPrecos(sb, regiao, ano) : new Map<string, CatalogoPreco>()

  // Grava rdos → rdo_equipes → rdo_atividades
  let saved: SalvarOutcome
  try {
    saved = await salvarApontamento(sb, {
      projetoId,
      parse,
      textoOriginal: texto,
      catalogo,
      waMsgId,
      autorJid,
      pushName,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[apontamento] falha ao gravar:', msg)
    await enviarEco(grupoJid, `❌ Erro ao gravar o apontamento: ${msg}`)
    return ok('erro ao gravar apontamento', { erro: msg })
  }

  // Corrida perdida pro índice UNIQUE: outra entrega concorrente do MESMO
  // webhook já gravou este wa_msg_id. Idempotência atômica — não gravamos
  // conversa nem reenviamos eco (senão o grupo levaria eco dobrado). Só
  // confirmamos, apontando pro RDO que já existe.
  if (saved.status === 'duplicate') {
    const { data: existente } = await sb
      .from('rdos')
      .select('id')
      .eq('payload->>wa_msg_id', waMsgId)
      .limit(1)
    const rdoId = existente && existente.length > 0 ? (existente[0] as { id: string }).id : null
    return ok('apontamento ja processado (idempotencia atomica)', { rdoId })
  }

  // Cria uma conversa por LA/LE pendente de posição (liga à atividade inserida).
  // O insert único preserva a ordem, então atividadesIds[i] ↔ parse.itens[i].
  const conversas: Record<string, unknown>[] = []
  const perguntasPosicao: string[] = []
  parse.itens.forEach((it, i) => {
    if (!ehPendentePosicao(it)) return
    const atividadeId = saved.atividadesIds[i]
    if (!atividadeId) return
    const pergunta = `${it.linhaOriginal} — ${it.motivoRevisar ?? 'informar posição'}`
    perguntasPosicao.push(pergunta)
    conversas.push({
      grupo_jid: grupoJid,
      autor_jid: autorJid,
      atividade_id: atividadeId,
      aguardando: it.tag === 'LA' ? 'posicao_la' : 'posicao_le',
      pergunta,
      contexto: { linha_original: it.linhaOriginal, tag: it.tag, regiao_codigo: regiao, ano, rdo_id: saved.rdoId },
      resolvido: false,
    })
  })
  if (conversas.length > 0) {
    const { error: ec } = await sb.from('apontamento_conversa').insert(conversas)
    if (ec) console.error('[apontamento] falha ao criar conversas:', ec.message)
  }

  const eco = montarEcoApontamento(parse, catalogo, perguntasPosicao)
  const envio = await enviarEco(grupoJid, eco)
  return ok('apontamento gravado', {
    rdoId: saved.rdoId,
    atividades: saved.atividadesIds.length,
    conversas: conversas.length,
    eco,
    ecoEnviado: envio.enviado,
  })
}

// ─── Roteamento: resposta a uma conversa (posição da ligação) ────────────────

async function tratarRespostaConversa(
  sb: SupabaseClient,
  ctx: { grupoJid: string; autorJid: string; texto: string },
): Promise<Response> {
  const { grupoJid, autorJid, texto } = ctx

  // Conversa aberta (não resolvida, não expirada) pra esse autor+grupo?
  const nowIso = new Date().toISOString()
  const { data: convs } = await sb
    .from('apontamento_conversa')
    .select('id, atividade_id, aguardando, contexto, pergunta')
    .eq('grupo_jid', grupoJid)
    .eq('autor_jid', autorJid)
    .eq('resolvido', false)
    .gt('expira_em', nowIso)
    .in('aguardando', ['posicao_la', 'posicao_le'])
    .order('expira_em', { ascending: true })

  if (!convs || convs.length === 0) return ok('sem conversa aberta — ignorado (ruido)')

  // Só age se a resposta CASA uma posição esperada; senão é ruído (não é pra ele).
  const pos = acharPosicaoReply(texto)
  if (!pos) return ok('resposta sem posicao — ignorado (ruido)')

  // Resolve a conversa mais antiga pendente (FIFO). O encarregado responde uma
  // de cada vez; o eco de confirmação diz exatamente qual item fechou.
  const conv = convs[0] as {
    id: string
    atividade_id: string
    aguardando: string
    pergunta: string | null
    contexto: { linha_original?: string; tag?: string; regiao_codigo?: string | null; ano?: string } | null
  }
  const linhaOriginal = conv.contexto?.linha_original ?? ''
  const tagAlvo = conv.contexto?.tag ?? (conv.aguardando === 'posicao_la' ? 'LA' : 'LE')

  // Reaproveita o PARSER: re-parsa a linha original com a posição anexada.
  // Como o item chegou ao ramo "!pos" (nenhuma ambiguidade prof×metragem foi
  // disparada antes), anexar só a posição reproduz fielmente a descrição do
  // contrato que o parser geraria — sem duplicar a lógica de POS_LA/LE.
  // Prefixo de data neutra: garante dataConsumida=true, então a linha do item é
  // sempre corpo (nunca é confundida com o cabeçalho de data, mesmo com data solta).
  const reparse = parseApontamento(`01/01/2000\n${linhaOriginal} ${pos}`)
  const item = reparse.itens.find((x) => x.tag === tagAlvo && x.descricaoContrato)
  if (!item || !item.descricaoContrato) {
    const eco = `Não consegui fechar "${linhaOriginal}" com a posição informada. Responda só a posição: PA, TA, EIXO, TO ou PO.`
    await enviarEco(grupoJid, eco)
    return ok('reparse sem descricao — pediu posicao de novo')
  }

  // Preço da descrição resolvida (precos_contrato da região/ano da conversa)
  const regiao = conv.contexto?.regiao_codigo ?? null
  const ano = conv.contexto?.ano ?? String(new Date().getFullYear())
  const catalogo = regiao ? await carregarCatalogoPrecos(sb, regiao, ano) : new Map<string, CatalogoPreco>()
  const cat = catalogo.get(item.descricaoContrato)

  // Atualiza a atividade: serviço vira a descrição do contrato; código/unidade
  // saem do catálogo. Com medicao_codigo preenchido, o TRIGGER re-precifica.
  const update: Record<string, unknown> = { servico: item.descricaoContrato }
  if (cat) {
    update.medicao_codigo = cat.codigo
    update.medicao_unidade = cat.unidade
  }
  const { error: eu } = await sb.from('rdo_atividades').update(update).eq('id', conv.atividade_id)
  if (eu) {
    console.error('[conversa] falha ao atualizar atividade:', eu.message)
    await enviarEco(grupoJid, `❌ Erro ao registrar a posição: ${eu.message}`)
    return ok('erro ao atualizar atividade', { erro: eu.message })
  }
  await sb.from('apontamento_conversa').update({ resolvido: true }).eq('id', conv.id)

  const posLabel = pos.toUpperCase()
  const p60 = preco60De(cat)
  const eco = cat
    ? `✅ ${tagAlvo} registrada como ${posLabel} — ${item.descricaoContrato} · R$ ${brl(p60 as number)}/${cat.unidade ?? 'un'} (60% WCR). Medição atualizada.`
    : `✅ ${tagAlvo} registrada como ${posLabel} — ${item.descricaoContrato}. Sem preço na tabela ${ano}${regiao ? `/região ${regiao}` : ''} — item fica pendente pra revisar.`
  const envio = await enviarEco(grupoJid, eco)
  return ok('conversa resolvida', { conversaId: conv.id, atividadeId: conv.atividade_id, eco, ecoEnviado: envio.enviado })
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Auth do webhook (segredo próprio — verify_jwt=false)
  const url = new URL(req.url)
  const secret = req.headers.get('x-webhook-secret') ?? url.searchParams.get('secret')
  if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('[cfg] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes')
    return ok('sem credenciais supabase — nada feito')
  }

  let body: {
    event?: string
    data?: {
      key?: { remoteJid?: string; fromMe?: boolean; participant?: string; id?: string }
      pushName?: string
      messageTimestamp?: number | string
      message?: { conversation?: string; extendedTextMessage?: { text?: string } }
    }
  }
  try {
    body = await req.json()
  } catch {
    return ok('body invalido (json)')
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  try {
    // 2. bot_config (singleton id=1) — kill switch
    const { data: cfg } = await sb.from('bot_config').select('*').eq('id', 1).maybeSingle()
    if (!cfg) return ok('sem bot_config (id=1) — nada feito')
    const config = cfg as {
      grupo_apontamento_jid: string | null
      projeto_padrao_id: string | null
      ativo: boolean | null
    }
    if (config.ativo === false) return ok('bot inativo (kill switch)')

    // 3. Extrair + filtrar
    if (body.event && body.event !== 'messages.upsert') return ok(`evento ${body.event} ignorado`)
    const key = body.data?.key ?? {}
    if (key.fromMe === true) return ok('fromMe=true — ignorado (anti-loop)') // CRÍTICO
    const grupoJid = key.remoteJid ?? ''
    if (!grupoJid.endsWith('@g.us')) return ok('não é grupo — ignorado')
    if (config.grupo_apontamento_jid && grupoJid !== config.grupo_apontamento_jid) {
      return ok('grupo diferente do apontamento — ignorado')
    }
    const autorJid = key.participant ?? grupoJid
    const pushName = body.data?.pushName ?? null
    const texto = (body.data?.message?.conversation ?? body.data?.message?.extendedTextMessage?.text ?? '').toString()
    if (!texto.trim()) return ok('mensagem sem texto — ignorada')
    const waMsgId = key.id ?? null

    // 5. Roteamento de intenção
    const ehApontamento = /^\s*apontamento\b/.test(norm(texto)) || pareceEstruturado(texto)
    if (ehApontamento) {
      // Chave de idempotência: id da Evolution, ou hash de fallback quando o
      // webhook chega sem data.key.id — assim a proteção NUNCA é pulada.
      const dedupKey = await derivarDedupKey(waMsgId, {
        grupoJid,
        autorJid,
        messageTimestamp: String(body.data?.messageTimestamp ?? ''),
        texto,
      })
      return await tratarApontamentoNovo(sb, {
        grupoJid,
        autorJid,
        pushName,
        texto,
        waMsgId: dedupKey,
        projetoPadraoId: config.projeto_padrao_id,
      })
    }
    return await tratarRespostaConversa(sb, { grupoJid, autorJid, texto })
  } catch (e) {
    // Sempre 200: a Evolution reenvia em erro/HTTP≠2xx — a idempotência
    // (wa_msg_id) evita duplicar; aqui só logamos e devolvemos 200.
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[webhook] erro inesperado:', msg)
    return ok('erro tratado (200 pra evitar retry storm)', { erro: msg })
  }
})
