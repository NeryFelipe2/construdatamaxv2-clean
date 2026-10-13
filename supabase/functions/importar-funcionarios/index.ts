/**
 * importar-funcionarios — importador server-side da planilha de RH (módulo
 * Pessoal). É a ÚNICA porta de escrita de `pessoa_remuneracao` (salário/CPF),
 * que é fechada por RLS: o frontend anon não lê nem escreve — só esta função,
 * com service role.
 *
 * POST JSON { dryRun: boolean, loteId: uuid, linhas: LinhaWire[] }
 *   header x-import-secret comparado a Deno.env IMPORT_SECRET (se IMPORT_SECRET
 *   não estiver setado, aceita — ver README.md da função).
 *
 * dryRun=true  → para cada linha resolve o match (pessoa_apelidos.alias_norm
 *                REVISADO → pessoas.nome_norm exato e ÚNICO) e devolve
 *                { linhas: [{ index, match: {pessoaId, nome, regra} | null }] }.
 * dryRun=false → commit "transacional na prática": uma linha que falha NÃO
 *                derruba o lote — entra em erros[] e segue. Idempotência:
 *                pessoa com mesmo nome_norm E import_lote_id do MESMO lote já
 *                gravada → skip. Grava pessoas (upsert por match/ação),
 *                pessoa_apelidos (nome completo revisado=true), remuneração,
 *                encarregado_texto + encarregado_id (por alias quando único).
 *                Devolve { criadas, atualizadas, ignoradas, erros[] }.
 *
 * Molde: apontamento-webhook (service role via Deno.env, Deno.serve, json()).
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ─── ENV ─────────────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const IMPORT_SECRET = Deno.env.get('IMPORT_SECRET') ?? ''

// ─── util ────────────────────────────────────────────────────────────────────

/** Espelho JS do norm_txt do banco: minúsculas, sem acento, espaços colapsados. */
function norm(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-import-secret',
  'access-control-allow-methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
}

// ─── wire ────────────────────────────────────────────────────────────────────

interface LinhaWire {
  index: number
  aba: 'efetivos' | 'desligados' | 'em_processo'
  lineNumber?: number
  acao?: 'criar' | 'atualizar' | 'ignorar'
  pessoaId?: string | null
  nomeCompleto: string
  cargo: string | null
  status: 'ativo' | 'desligado' | 'em_contratacao'
  dataAdmissao: string | null
  vencExperiencia1: string | null
  vencExperiencia2: string | null
  encarregado: string | null
  vinculo: string | null
  salarioBruto: number | null
  valeRefeicao: number | null
  valeRefeicaoFormula: string | null
  dataDesligamento: string | null
  desligamentoPrevisto: boolean
  motivoDesligamento: string | null
  telefone: string | null
  epiCalca: string | null
  epiCamisa: string | null
  epiBotina: string | null
}

interface Match {
  pessoaId: string
  nome: string
  regra: 'alias' | 'nome'
}

// ─── estado pré-carregado (matching em memória — <300 pessoas) ───────────────

interface Catalogo {
  /** alias_norm CONFIRMADO → pessoa {id, nome} (invariante: 1 alias = 1 pessoa) */
  aliasConfirmado: Map<string, { id: string; nome: string }>
  /** nome_norm → pessoas com esse nome exato (homônimos possíveis) */
  porNome: Map<string, { id: string; nome: string }[]>
  /** nome_norm de cargo → cargo_id (catálogo + apelidos de cargo) */
  cargoPorNorm: Map<string, string>
}

async function carregarCatalogo(sb: SupabaseClient): Promise<Catalogo> {
  const aliasConfirmado = new Map<string, { id: string; nome: string }>()
  const porNome = new Map<string, { id: string; nome: string }[]>()
  const cargoPorNorm = new Map<string, string>()

  const { data: pessoas, error: e1 } = await sb
    .from('pessoas')
    .select('id, nome_completo, nome_norm')
  if (e1) throw new Error(`pessoas: ${e1.message}`)
  for (const p of (pessoas ?? []) as { id: string; nome_completo: string; nome_norm: string }[]) {
    const list = porNome.get(p.nome_norm) ?? []
    list.push({ id: p.id, nome: p.nome_completo })
    porNome.set(p.nome_norm, list)
  }

  const { data: aliases, error: e2 } = await sb
    .from('vw_pessoa_por_alias')
    .select('alias_norm, pessoa_id, nome_completo, revisado')
    .eq('revisado', true)
  if (e2) throw new Error(`pessoa_apelidos: ${e2.message}`)
  for (const a of (aliases ?? []) as { alias_norm: string; pessoa_id: string; nome_completo: string }[]) {
    aliasConfirmado.set(a.alias_norm, { id: a.pessoa_id, nome: a.nome_completo })
  }

  const { data: cargos, error: e3 } = await sb.from('cargos').select('id, nome_norm')
  if (e3) throw new Error(`cargos: ${e3.message}`)
  for (const c of (cargos ?? []) as { id: string; nome_norm: string }[]) {
    cargoPorNorm.set(c.nome_norm, c.id)
  }
  const { data: cargoAliases, error: e4 } = await sb.from('cargo_apelidos').select('cargo_id, alias_norm')
  if (e4) throw new Error(`cargo_apelidos: ${e4.message}`)
  for (const ca of (cargoAliases ?? []) as { cargo_id: string; alias_norm: string }[]) {
    if (!cargoPorNorm.has(ca.alias_norm)) cargoPorNorm.set(ca.alias_norm, ca.cargo_id)
  }

  return { aliasConfirmado, porNome, cargoPorNorm }
}

/** 1º alias confirmado; 2º nome_norm exato e ÚNICO (homônimo → null, decisão humana). */
function resolverMatch(cat: Catalogo, nomeNorm: string): Match | null {
  const porAlias = cat.aliasConfirmado.get(nomeNorm)
  if (porAlias) return { pessoaId: porAlias.id, nome: porAlias.nome, regra: 'alias' }
  const porNome = cat.porNome.get(nomeNorm) ?? []
  if (porNome.length === 1) return { pessoaId: porNome[0].id, nome: porNome[0].nome, regra: 'nome' }
  return null
}

// ─── commit de UMA linha ─────────────────────────────────────────────────────

async function commitLinha(
  sb: SupabaseClient,
  cat: Catalogo,
  loteId: string,
  linha: LinhaWire,
): Promise<'criada' | 'atualizada' | 'ignorada'> {
  const nome = (linha.nomeCompleto ?? '').replace(/\s+/g, ' ').trim()
  if (!nome) throw new Error('nomeCompleto vazio')
  const nomeNorm = norm(nome)
  const acao = linha.acao ?? 'criar'
  if (acao === 'ignorar') return 'ignorada'

  // idempotência do lote: mesma pessoa (nome_norm) já gravada por ESTE lote → skip
  const { data: jaDoLote, error: eIdem } = await sb
    .from('pessoas')
    .select('id')
    .eq('nome_norm', nomeNorm)
    .eq('import_lote_id', loteId)
    .limit(1)
  if (eIdem) throw new Error(`idempotência: ${eIdem.message}`)
  if (jaDoLote && jaDoLote.length > 0) return 'ignorada'

  // cargo → catálogo (nome exato ou apelido de cargo)
  const cargoTexto = linha.cargo?.trim() || null
  const cargoId = cargoTexto ? cat.cargoPorNorm.get(norm(cargoTexto)) ?? null : null

  const encarregadoTexto = linha.encarregado?.trim() || null
  // encarregado_id por alias CONFIRMADO quando único (alias → exatamente 1 pessoa)
  let encarregadoId: string | null = null
  if (encarregadoTexto) {
    const encMatch = cat.aliasConfirmado.get(norm(encarregadoTexto))
    if (encMatch) encarregadoId = encMatch.id
  }

  const campos: Record<string, unknown> = {
    status: linha.status,
    import_lote_id: loteId,
  }
  if (cargoTexto) campos.cargo_texto = cargoTexto // nunca apaga cargo existente com null
  if (cargoId) campos.cargo_id = cargoId
  if (linha.vinculo) campos.vinculo = linha.vinculo.trim()
  if (linha.telefone) campos.telefone = String(linha.telefone).trim()
  if (linha.dataAdmissao) campos.data_admissao = linha.dataAdmissao
  if (linha.vencExperiencia1) campos.venc_experiencia_1 = linha.vencExperiencia1
  if (linha.vencExperiencia2) campos.venc_experiencia_2 = linha.vencExperiencia2
  if (encarregadoTexto) campos.encarregado_texto = encarregadoTexto
  if (encarregadoId) campos.encarregado_id = encarregadoId
  if (linha.epiCalca) campos.epi_calca = linha.epiCalca
  if (linha.epiCamisa) campos.epi_camisa = linha.epiCamisa
  if (linha.epiBotina) campos.epi_botina = String(linha.epiBotina)
  if (linha.aba === 'desligados') {
    campos.data_desligamento = linha.dataDesligamento
    campos.desligamento_previsto = Boolean(linha.desligamentoPrevisto)
    campos.motivo_desligamento = linha.motivoDesligamento
  }

  let pessoaId: string
  let resultado: 'criada' | 'atualizada'

  const alvoId = linha.pessoaId ?? resolverMatch(cat, nomeNorm)?.pessoaId ?? null
  if (acao === 'atualizar' && alvoId) {
    campos.atualizado_em = new Date().toISOString()
    const { error: eUp } = await sb.from('pessoas').update(campos).eq('id', alvoId)
    if (eUp) throw new Error(`update pessoas: ${eUp.message}`)
    pessoaId = alvoId
    resultado = 'atualizada'
  } else {
    const { data: nova, error: eIns } = await sb
      .from('pessoas')
      .insert({ nome_completo: nome, origem: `planilha#${linha.aba}`, ...campos })
      .select('id')
      .single()
    if (eIns) throw new Error(`insert pessoas: ${eIns.message}`)
    pessoaId = (nova as { id: string }).id
    resultado = 'criada'
    // entra nos catálogos em memória — as próximas linhas do lote já enxergam
    const list = cat.porNome.get(nomeNorm) ?? []
    list.push({ id: pessoaId, nome })
    cat.porNome.set(nomeNorm, list)
  }

  // nome completo vira alias. revisado=true, EXCETO se o alias já está
  // confirmado pra OUTRA pessoa (invariante: 1 alias confirmado = 1 pessoa).
  const aliasDono = cat.aliasConfirmado.get(nomeNorm)
  const podeConfirmar = !aliasDono || aliasDono.id === pessoaId
  const { error: eAlias } = await sb
    .from('pessoa_apelidos')
    .upsert(
      {
        pessoa_id: pessoaId,
        alias_raw: nome,
        alias_norm: nomeNorm,
        fonte: 'planilha',
        revisado: podeConfirmar,
        confianca: podeConfirmar ? 1.0 : 0.5,
      },
      { onConflict: 'pessoa_id,alias_norm' },
    )
  if (eAlias) throw new Error(`pessoa_apelidos: ${eAlias.message}`)
  if (podeConfirmar && !aliasDono) cat.aliasConfirmado.set(nomeNorm, { id: pessoaId, nome })

  // remuneração — SÓ esta função consegue (RLS fechada; service role)
  if (linha.salarioBruto !== null || linha.valeRefeicao !== null) {
    const { error: eRem } = await sb.from('pessoa_remuneracao').upsert(
      {
        pessoa_id: pessoaId,
        salario_bruto: linha.salarioBruto,
        vale_refeicao: linha.valeRefeicao,
        vale_refeicao_formula: linha.valeRefeicaoFormula,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'pessoa_id' },
    )
    if (eRem) throw new Error(`pessoa_remuneracao: ${eRem.message}`)
  }

  return resultado
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405)

  // Auth própria: se IMPORT_SECRET está setado, exige o header igual.
  // Sem IMPORT_SECRET no ambiente → aceita (documentado no README.md).
  if (IMPORT_SECRET) {
    const secret = req.headers.get('x-import-secret') ?? ''
    if (secret !== IMPORT_SECRET) return json({ ok: false, error: 'unauthorized' }, 401)
  }

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ ok: false, error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente' }, 500)
  }

  let body: { dryRun?: boolean; loteId?: string; linhas?: LinhaWire[] }
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'body inválido (json)' }, 400)
  }
  const linhas = Array.isArray(body.linhas) ? body.linhas : []
  const loteId = typeof body.loteId === 'string' && body.loteId ? body.loteId : crypto.randomUUID()
  if (linhas.length === 0) return json({ ok: false, error: 'nenhuma linha enviada' }, 400)

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  let cat: Catalogo
  try {
    cat = await carregarCatalogo(sb)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // tabela inexistente → as migrations de pessoal (020/021) não foram aplicadas
    return json(
      { ok: false, error: `catálogo indisponível (${msg}) — as migrations de pessoal já foram aplicadas?` },
      400,
    )
  }

  // ── dry-run: só resolve os matches ─────────────────────────────────────────
  if (body.dryRun) {
    const resposta = linhas.map((l) => ({
      index: l.index,
      match: resolverMatch(cat, norm((l.nomeCompleto ?? '').trim())),
    }))
    return json({ ok: true, dryRun: true, loteId, linhas: resposta })
  }

  // ── commit: linha a linha; falha NÃO derruba o lote ────────────────────────
  let criadas = 0
  let atualizadas = 0
  let ignoradas = 0
  const erros: { index: number; nome: string; erro: string }[] = []

  for (const linha of linhas) {
    try {
      const r = await commitLinha(sb, cat, loteId, linha)
      if (r === 'criada') criadas++
      else if (r === 'atualizada') atualizadas++
      else ignoradas++
    } catch (e) {
      erros.push({
        index: linha.index,
        nome: linha.nomeCompleto ?? '?',
        erro: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return json({ ok: true, loteId, criadas, atualizadas, ignoradas, erros })
})
