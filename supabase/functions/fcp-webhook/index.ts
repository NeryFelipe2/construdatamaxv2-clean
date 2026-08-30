/**
 * fcp-webhook — porta autenticada para o n8n empurrar FCP e lançamentos de
 * caixa direto da planilha do engenheiro, sem ninguém abrir o sistema.
 *
 * AUTENTICAÇÃO: header `x-webhook-token`. Cada token pertence a um usuário
 * (tabela integracao_token) — é assim que o audit_log consegue dizer QUEM
 * mandou, mesmo sendo integração. Sem token válido -> 401.
 *
 * POST { "recurso": "fcp"|"caixa", "dryRun": bool, "dados": {...} } — README.
 *
 * SEMPRE devolve o mesmo quadro do importador da tela: novos, diferentes,
 * iguais e erros. Com dryRun=true nada é gravado.
 *
 * A coluna "obra" é casada com projetos.nome (norm) e vira projeto_id — o
 * vínculo com o centro de custo. Obra que não casa segue só como texto (a
 * integração não bloqueia nem inventa cadastro).
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-webhook-token',
  'access-control-allow-methods': 'POST, OPTIONS',
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...CORS } })

const norm = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

function paraNumero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).trim().replace(/[R$\s]/gi, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (s.includes(',')) s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** aceita dd/mm/aaaa, aaaa-mm-dd e o período "01 A 10/07/2026" */
function paraPeriodo(v: unknown): { inicio: string; fim: string | null } | null {
  if (!v) return null
  const s = String(v).trim()
  const per = s.match(/^(\d{1,2})\s*(?:A|ATE|ATÉ|-)\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/i)
  if (per) {
    const [, d1, d2, m, aR] = per
    const a = aR.length === 2 ? `20${aR}` : aR
    const p = (d: string) => `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    return { inicio: p(d1), fim: p(d2) }
  }
  const sim = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (sim) {
    const [, d, m, aR] = sim
    const a = aR.length === 2 ? `20${aR}` : aR
    return { inicio: `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`, fim: null }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return { inicio: s.slice(0, 10), fim: null }
  return null
}

interface Linha { indice: number; veredicto: string; problemas: string[]; alteracoes?: unknown[]; projeto?: string | null }

/** obra da planilha → projeto do sistema ("BOI MALHADO" e "WCR — Boi Malhado" casam) */
async function mapaProjetos(sb: SupabaseClient): Promise<Map<string, { id: string; nome: string }>> {
  const { data } = await sb.from('projetos').select('id, nome').is('deleted_at', null)
  const m = new Map<string, { id: string; nome: string }>()
  for (const p of (data ?? []) as { id: string; nome: string }[]) {
    m.set(norm(p.nome), p)
    m.set(norm(p.nome.replace(/^WCR\s*—\s*/i, '')), p)
  }
  return m
}

async function tratarCaixa(sb: SupabaseClient, dados: Record<string, unknown>, dryRun: boolean, orgId: string, lote: string) {
  const itens = Array.isArray(dados.lancamentos) ? dados.lancamentos as Record<string, unknown>[] : []
  if (itens.length === 0) return json({ ok: false, error: 'Envie "dados.lancamentos" como lista.' }, 400)

  const { data: cats } = await sb.from('caixa_categoria').select('id, nome').eq('org_id', orgId)
  const catPorNome = new Map(((cats ?? []) as { id: string; nome: string }[]).map((c) => [norm(c.nome), c.id]))
  const projPorNome = await mapaProjetos(sb)

  const { data: existentes } = await sb.from('caixa_lancamento')
    .select('id, data_inicio, descricao, valor, obra_texto, tipo, status, categoria_id')
    .eq('org_id', orgId).is('deleted_at', null)
  const porChave = new Map(((existentes ?? []) as Record<string, unknown>[])
    .map((l) => [`${norm(l.obra_texto)}|${l.data_inicio}|${norm(l.descricao)}`, l]))

  const linhas: Linha[] = []
  const categoriasNovas = new Set<string>()
  let criados = 0, atualizados = 0, ignorados = 0

  for (let i = 0; i < itens.length; i++) {
    const it = itens[i]
    const problemas: string[] = []
    const per = paraPeriodo(it.data)
    const valor = paraNumero(it.valor)
    const categoria = String(it.categoria ?? '').trim()
    const obra = String(it.obra ?? '').trim()
    const descricao = String(it.descricao ?? '').trim()

    if (!per) problemas.push('data não reconhecida')
    if (valor === null) problemas.push('valor não é número')
    else if (valor < 0) problemas.push('valor negativo')
    if (!descricao) problemas.push('descrição vazia')
    if (!categoria) problemas.push('categoria obrigatória')
    if (!obra) problemas.push('obra obrigatória')

    const catId = catPorNome.get(norm(categoria))
    if (categoria && !catId) { categoriasNovas.add(categoria); problemas.push(`categoria "${categoria}" não cadastrada`) }
    const proj = projPorNome.get(norm(obra)) ?? null

    if (problemas.length) { linhas.push({ indice: i, veredicto: 'ERRO', problemas, projeto: proj?.nome ?? null }); continue }

    const chave = `${norm(obra)}|${per!.inicio}|${norm(descricao)}`
    const existente = porChave.get(chave) as Record<string, unknown> | undefined
    const tipo = norm(it.tipo).startsWith('r') ? 'RECEITA' : 'DESPESA'
    const campos = {
      org_id: orgId, tipo, data_inicio: per!.inicio, data_fim: per!.fim,
      descricao, valor, categoria_id: catId, obra_texto: obra,
      projeto_id: proj?.id ?? null,                       // o centro de custo
      forma_pagamento: (it.forma_pagamento as string) ?? null,
      status: ['pendente', 'conferido', 'pago'].includes(norm(it.status)) ? norm(it.status) : 'pendente',
      anexo_url: (it.anexo as string) ?? null, observacao: (it.observacao as string) ?? null,
      origem: 'integracao', import_lote: lote,
    }

    if (!existente) {
      linhas.push({ indice: i, veredicto: 'NOVO', problemas: [], projeto: proj?.nome ?? null })
      if (!dryRun) {
        const { error } = await sb.from('caixa_lancamento').insert(campos)
        if (error) linhas[linhas.length - 1] = { indice: i, veredicto: 'ERRO', problemas: [error.message] }
        else criados++
      }
      continue
    }

    const alteracoes: unknown[] = []
    for (const c of ['tipo', 'valor', 'status', 'categoria_id'] as const) {
      const antes = existente[c], depois = (campos as Record<string, unknown>)[c]
      const igual = typeof antes === 'number' || typeof depois === 'number'
        ? Math.abs(Number(antes) - Number(depois)) < 0.005
        : norm(antes) === norm(depois)
      if (!igual) alteracoes.push({ campo: c, antes, depois })
    }
    if (alteracoes.length === 0) {
      linhas.push({ indice: i, veredicto: 'IGUAL', problemas: [], projeto: proj?.nome ?? null }); ignorados++; continue
    }

    linhas.push({ indice: i, veredicto: 'DIFERENTE', problemas: [], alteracoes, projeto: proj?.nome ?? null })
    if (!dryRun) {
      const { error } = await sb.from('caixa_lancamento').update(campos).eq('id', existente.id as string)
      if (error) linhas[linhas.length - 1] = { indice: i, veredicto: 'ERRO', problemas: [error.message] }
      else atualizados++
    }
  }

  const resumo = linhas.reduce((a, l) => { a[l.veredicto] = (a[l.veredicto] ?? 0) + 1; return a }, {} as Record<string, number>)
  return json({
    ok: true, dryRun, lote, resumo, linhas,
    categoriasNaoCadastradas: [...categoriasNovas],
    gravado: dryRun ? null : { criados, atualizados, ignorados },
  })
}

async function tratarFcp(sb: SupabaseClient, dados: Record<string, unknown>, dryRun: boolean, orgId: string) {
  const semanaRef = String(dados.semana_ref ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semanaRef)) {
    return json({ ok: false, error: 'Informe "dados.semana_ref" no formato aaaa-mm-dd (segunda-feira da semana).' }, 400)
  }
  const { data: fcp } = await sb.from('fcp').select('id, status, nome')
    .eq('org_id', orgId).eq('semana_ref', semanaRef).is('deleted_at', null).maybeSingle()
  if (!fcp) return json({ ok: false, error: `Nenhum FCP para a semana ${semanaRef}.` }, 422)
  if ((fcp as { status: string }).status === 'aprovado') {
    return json({ ok: false, error: 'Este FCP está aprovado e não aceita alteração. Peça a reabertura.' }, 409)
  }
  const fcpId = (fcp as { id: string }).id

  const reals = Array.isArray(dados.realizado) ? dados.realizado as Record<string, unknown>[] : []
  const { data: obras } = await sb.from('fcp_obra').select('id, nome').eq('fcp_id', fcpId)
  const porNome = new Map(((obras ?? []) as { id: string; nome: string }[]).map((o) => [norm(o.nome), o.id]))

  const linhas: Linha[] = []
  let gravados = 0
  for (let i = 0; i < reals.length; i++) {
    const r = reals[i]
    const obraId = porNome.get(norm(r.obra))
    const semana = Number(r.semana)
    const producao = paraNumero(r.producao)
    const problemas: string[] = []
    if (!obraId) problemas.push(`obra "${r.obra}" não existe neste FCP`)
    if (!Number.isInteger(semana) || semana < 1 || semana > 60) problemas.push('semana inválida (1 a 60)')
    if (producao === null || producao < 0) problemas.push('produção inválida')
    if (problemas.length) { linhas.push({ indice: i, veredicto: 'ERRO', problemas }); continue }

    linhas.push({ indice: i, veredicto: 'NOVO', problemas: [] })
    if (!dryRun) {
      const { error } = await sb.from('fcp_realizado')
        .upsert({ fcp_obra_id: obraId, n_semana: semana, producao }, { onConflict: 'fcp_obra_id,n_semana' })
      if (error) linhas[linhas.length - 1] = { indice: i, veredicto: 'ERRO', problemas: [error.message] }
      else gravados++
    }
  }

  const { data: capital } = await sb.rpc('fcp_capital', { p_fcp_id: fcpId, p_semanas: 12 })
  const resumo = linhas.reduce((a, l) => { a[l.veredicto] = (a[l.veredicto] ?? 0) + 1; return a }, {} as Record<string, number>)
  return json({
    ok: true, dryRun, fcp_id: fcpId, fcp: (fcp as { nome: string }).nome,
    resumo, linhas, gravado: dryRun ? null : { realizados: gravados },
    capital: Array.isArray(capital) ? capital[0] : capital,
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'Use POST.' }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ ok: false, error: 'Função mal configurada.' }, 500)

  const token = req.headers.get('x-webhook-token') ?? ''
  if (!token) return json({ ok: false, error: 'Informe o header x-webhook-token.' }, 401)

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  const { data: tk, error: eTk } = await sb.from('integracao_token')
    .select('id, user_id, org_id, nome, ativo').eq('token', token).maybeSingle()
  if (eTk) {
    const m = (eTk.message ?? '').toLowerCase()
    if (m.includes('does not exist') || m.includes('could not find the table')) {
      return json({ ok: false, error: 'Tabela integracao_token ainda não existe — aplique a migration.' }, 503)
    }
    return json({ ok: false, error: 'Falha ao validar o token.' }, 500)
  }
  if (!tk || (tk as { ativo: boolean }).ativo === false) return json({ ok: false, error: 'Token inválido ou desativado.' }, 401)
  const orgId = (tk as { org_id: string }).org_id

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ ok: false, error: 'Corpo inválido (JSON).' }, 400) }

  const recurso = norm(body.recurso)
  const dryRun = body.dryRun === true
  const dados = (body.dados ?? {}) as Record<string, unknown>
  const lote = crypto.randomUUID()

  try {
    await sb.from('integracao_token').update({ usado_em: new Date().toISOString() }).eq('id', (tk as { id: string }).id)
    if (recurso === 'caixa') return await tratarCaixa(sb, dados, dryRun, orgId, lote)
    if (recurso === 'fcp') return await tratarFcp(sb, dados, dryRun, orgId)
    return json({ ok: false, error: 'Informe "recurso": "fcp" ou "caixa".' }, 400)
  } catch (e) {
    console.error('[fcp-webhook]', e instanceof Error ? e.stack ?? e.message : String(e))
    return json({ ok: false, error: 'Erro inesperado ao processar.' }, 500)
  }
})
