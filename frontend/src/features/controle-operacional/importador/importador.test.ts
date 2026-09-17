/**
 * O importador da CONTROLE OPERACIONAL rev16 — o contrato de comportamento.
 *
 * Os riscos que estes testes cercam:
 *   - reimportar não pode duplicar nem gravar nada quando nada mudou;
 *   - "sumiu da planilha" nunca apaga — só aponta, e só no escopo do arquivo;
 *   - o ID da rev16 vem da posição da linha: mesmo código com outro endereço é CONFLITO;
 *   - a planilha da ZN (mesmos prefixos de aba, outro conteúdo) é recusada;
 *   - fórmula nunca entra como dado digitado.
 *
 * Fixture anonimizada em memória (__fixtures__/rev16-mini.ts), passada por escrita e
 * leitura de .xlsx para exercitar o mesmo caminho do arquivo de verdade.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import { bufferRev16Mini, bufferZnMini, TOTAL_SERVICOS_MINI, type OpcoesFixture } from '../__fixtures__/rev16-mini'
import { avisosDaLeitura, lerArquivoRev16, type LeituraRev16 } from './lerPlanilhaRev16'
import { verificarAssinatura } from './assinatura'
import { reconciliar, resumoGeral, type ProjetoRef, type ResultadoReconciliacao } from './reconciliar'
import { aplicarPlanoEmMemoria, contarEscritas, planejarEscritas, type PlanoEscrita } from './gravarImportacao'
import { dadosVazios, type DadosOp } from '../dominio/tipos'

const PROJETOS: ProjetoRef[] = [
  { id: 'p-ber', nome: 'WCR — Bertioga', org_id: 'org-wcr' },
  { id: 'p-san', nome: 'WCR — Santos', org_id: 'org-wcr' },
  { id: 'p-boi', nome: 'WCR — Boi Malhado', org_id: 'org-wcr' },
]

function bancoVazio(projetos = PROJETOS): Map<string, DadosOp> {
  return new Map(projetos.map((p) => [p.id, dadosVazios(p.id)]))
}

function ler(o: OpcoesFixture = {}): LeituraRev16 {
  const { assinatura, leitura } = lerArquivoRev16(bufferRev16Mini(o))
  assert.equal(assinatura.ok, true, assinatura.mensagem)
  return leitura!
}

function importar(leitura: LeituraRev16, banco: Map<string, DadosOp>, opts: { ehAdmin?: boolean; projetos?: ProjetoRef[] } = {}) {
  const r = reconciliar({ leitura, projetos: opts.projetos ?? PROJETOS, existentes: banco, pessoas: [], ehAdmin: opts.ehAdmin ?? true })
  const plano = planejarEscritas(r)
  return { r, plano, depois: aplicarPlanoEmMemoria(plano, banco) }
}

const grupo = (r: ResultadoReconciliacao, projetoId: string, entidade: string) =>
  r.projetos.find((p) => p.projetoId === projetoId)!.grupos.find((g) => g.entidade === entidade)!

const passos = (p: PlanoEscrita, projetoId: string, entidade: string) =>
  p.projetos.find((x) => x.projetoId === projetoId)?.passos.find((s) => s.entidade === entidade)

// ─── leitura ────────────────────────────────────────────────────────────────

test('54 serviços BER-0001…BER-0054 no contrato BERTIOGA — o ID sai da posição da linha, como a fórmula', () => {
  const l = ler()
  assert.equal(l.servicos.length, TOTAL_SERVICOS_MINI)
  assert.deepEqual(
    l.servicos.map((s) => s.dados.codigo),
    Array.from({ length: 54 }, (_, i) => `BER-${String(i + 1).padStart(4, '0')}`),
  )
  assert.ok(l.servicos.every((s) => s.dados.contrato === 'BERTIOGA'))
  assert.equal(l.servicos[0].dados.data_solicitacao, '2026-09-01')   // serial do Excel sem fuso
  assert.equal(l.servicos[53].dados.data_solicitacao, null)          // vazio continua vazio

  const { r } = importar(l, bancoVazio())
  assert.equal(grupo(r, 'p-ber', 'servico').resumo.NOVO, 54)
})

test('fórmula conta como vazia — mesmo com valor em cache no arquivo', () => {
  const l = ler()
  // X5 (OBSERVAÇÃO) é fórmula com cache "VALOR DE FÓRMULA"
  assert.equal(l.servicos[0].dados.observacao, null)
  // a linha da folha na 01A é fórmula sobre a aba 08: não vira item de custo
  assert.ok(!l.custos.some((c) => /folha/i.test(c.dados.item)))
  // imposto da aba 01 (C16) é fórmula: vem da soma dos tributos da 01A, não da célula
  assert.equal(l.tributos.length, 7)
  const soma = l.tributos.reduce((s, t) => s + (t.dados.aliquota ?? 0), 0)
  assert.ok(Math.abs(soma - 0.22) < 1e-9, `tributos somam ${soma}`)
  // a coluna VALOR (M) da medição, com 999 em cache, não é lida
  assert.ok(!JSON.stringify(l.medicoes).includes('999'))
})

test('linha depois de 31 linhas vazias é ignorada — e aparece na lista do que não entrou', () => {
  const l = ler()
  assert.ok(!l.servicos.some((s) => s.dados.endereco === 'Rua Depois do Limite'))
  const ne = l.naoEntendidas.find((n) => n.aba === '03' && n.linha === 93)
  assert.ok(ne, 'a linha 93 precisa estar em naoEntendidas')
  assert.match(ne!.motivo, /31 linhas vazias/)
})

test('o que o importador não entendeu vira lista, não silêncio', () => {
  const l = ler()
  const motivos = l.naoEntendidas.map((n) => `${n.aba}:${n.linha}`)
  assert.ok(motivos.includes('09:5'), 'medição sem código de preço e sem QTD (sem item)')
  assert.ok(motivos.includes('09:11'), 'medição com QTD mas sem código de preço')
  assert.ok(motivos.includes('08:15'), 'linha TOTAL DO QUADRO ATIVO')
  assert.ok(motivos.includes('02:13'), 'texto explicativo no fim da tabela de preços')
  assert.ok(motivos.includes('12:10'), 'linha TOTAL DO CONTRATO sem MÊS')
  assert.ok(l.avisos.some((a) => /repetida/.test(a)), 'chave de preço repetida com o mesmo preço')
})

test('mesmo serviço + mesmo preço duas vezes na medição: ordem 1 e 2 (a chave não usa a quantidade)', () => {
  const l = ler()
  const doBer4 = l.medicoes.filter((m) => m.dados.servico_codigo === 'BER-0004')
  assert.deepEqual(doBer4.map((m) => m.dados.ordem), [1, 2])
})

// ─── reconciliação ──────────────────────────────────────────────────────────

test('contrato vira obra pelo nome: BERTIOGA → "WCR — Bertioga"; preços SAN-* vão para Santos', () => {
  const { r } = importar(ler(), bancoVazio())
  assert.deepEqual(r.projetos.map((p) => p.projetoNome).sort(), ['WCR — Bertioga', 'WCR — Santos'])
  assert.equal(grupo(r, 'p-ber', 'preco').resumo.NOVO, 3)
  assert.equal(grupo(r, 'p-san', 'preco').resumo.NOVO, 2)
  assert.equal(grupo(r, 'p-san', 'servico').resumo.NOVO, 0)
  assert.deepEqual(r.contratosSemProjeto, [])
})

test('contrato sem obra no sistema: nada entra dele, e cada linha aparece como não entendida', () => {
  const soBertioga = PROJETOS.filter((p) => p.id !== 'p-san')
  const { r } = importar(ler(), bancoVazio(soBertioga), { projetos: soBertioga })
  assert.deepEqual(r.contratosSemProjeto, ['SANTOS'])
  assert.ok(r.naoEntendidas.some((n) => n.aba === '02' && /SANTOS/.test(n.motivo)))
  assert.ok(!r.projetos.some((p) => p.contrato === 'SANTOS'))
})

test('reimportar o MESMO arquivo: tudo IGUAL e zero escritas planejadas', () => {
  const l = ler()
  const primeira = importar(l, bancoVazio())
  assert.ok(contarEscritas(primeira.plano).gravar > 100, 'a primeira importação grava')

  const segunda = importar(ler(), primeira.depois)
  const tot = resumoGeral(segunda.r)
  assert.equal(tot.NOVO, 0)
  assert.equal(tot.MUDOU, 0, JSON.stringify(segunda.r.projetos.flatMap((p) => p.grupos.flatMap((g) => g.linhas.filter((x) => x.veredicto === 'MUDOU').map((x) => [g.entidade, x.chave, x.alteracoes])))))
  assert.equal(tot.AUSENTE, 0)
  assert.equal(tot.CONFLITO, 0)
  assert.ok(tot.IGUAL > 150)
  assert.equal(contarEscritas(segunda.plano).total, 0)
})

test('linha apagada da planilha → AUSENTE: só aponta, nunca apaga', () => {
  const primeira = importar(ler(), bancoVazio())
  // linha 14 = BER-0010 (tem data 2026-09-10, dentro da faixa do arquivo)
  const sem10 = importar(ler({ limparServico: 14 }), primeira.depois)
  const g = grupo(sem10.r, 'p-ber', 'servico')
  assert.equal(g.resumo.AUSENTE, 1)
  const aus = g.linhas.find((x) => x.veredicto === 'AUSENTE')!
  assert.equal(aus.chave, 'BER-0010')
  assert.equal(aus.linha, 0)
  assert.equal(aus.selecionada, true)

  const passo = passos(sem10.plano, 'p-ber', 'servico')!
  assert.equal(passo.gravar.length, 0)
  assert.equal(passo.apontarAusentes.length, 1)

  // depois de "gravar": continua lá, com a marca — e sem deleted_at
  const s10 = sem10.depois.get('p-ber')!.servicos.find((s) => s.codigo === 'BER-0010')!
  assert.ok(s10.ausente_na_planilha_em)
  assert.equal(s10.deleted_at, null)
  assert.equal(sem10.depois.get('p-ber')!.servicos.length, 54)

  // voltou para a planilha: a marca sai (MUDOU só no campo ausente)
  const voltou = importar(ler(), sem10.depois)
  const linha = grupo(voltou.r, 'p-ber', 'servico').linhas.find((x) => x.chave === 'BER-0010')!
  assert.equal(linha.veredicto, 'MUDOU')
  assert.deepEqual(linha.alteracoes.map((a) => a.campo), ['ausente_na_planilha_em'])
})

test('AUSENTE respeita o escopo do arquivo: fora da faixa de datas, e o que nasceu na tela, não são acusados', () => {
  const primeira = importar(ler(), bancoVazio())
  const banco = primeira.depois
  const ber = banco.get('p-ber')!
  const base = { projeto_id: 'p-ber', equipe: 'BER-B', n_pessoas: 3, h_normais: 8, h_extras: null, retro_h: null, cam34_munck_h: null,
    caminhao_hr_h: null, compressor_h: null, rompedor_h: null, bomba_h: null, km_rodado: null, status_dia: null, motivo_parada: null, observacao: null }
  ber.apontamentos.push(
    { ...base, id: 'ap-agosto', data: '2026-08-15', origem: 'planilha', chave_import: '2026-08-15|BER-B' },   // antes da faixa (09-01…09-03)
    { ...base, id: 'ap-dentro', data: '2026-09-02', origem: 'planilha', chave_import: '2026-09-02|BER-B' },   // dentro: sumiu
    { ...base, id: 'ap-tela', data: '2026-09-02', equipe: 'BER-C', origem: 'manual', chave_import: null },    // nasceu na tela
  )
  const { r } = importar(ler(), banco)
  const aus = grupo(r, 'p-ber', 'apontamento').linhas.filter((x) => x.veredicto === 'AUSENTE')
  assert.deepEqual(aus.map((x) => x.idExistente), ['ap-dentro'])
  assert.match(grupo(r, 'p-ber', 'apontamento').escopo, /2026-09-01 a 2026-09-03/)
})

test('mesmo código com OUTRO endereço → CONFLITO: bloqueia o serviço e o que depende dele', () => {
  const primeira = importar(ler(), bancoVazio())
  // linha 9 = BER-0005
  const outra = importar(ler({ trocarEndereco: { linha: 9, endereco: 'Avenida Deslocada 999' } }), primeira.depois)
  const g = grupo(outra.r, 'p-ber', 'servico')
  assert.equal(g.resumo.CONFLITO, 1)
  const c = g.linhas.find((x) => x.veredicto === 'CONFLITO')!
  assert.equal(c.chave, 'BER-0005')
  assert.equal(c.selecionada, false)
  assert.ok(c.problemas.some((p) => p.bloqueia && /endereço diferente/.test(p.mensagem)))

  // programação e OS do BER-0005 também ficam bloqueadas
  assert.equal(grupo(outra.r, 'p-ber', 'programacao').linhas.find((x) => x.chave.startsWith('BER-0005'))!.veredicto, 'CONFLITO')
  assert.equal(grupo(outra.r, 'p-ber', 'os').linhas.find((x) => x.chave === 'BER-0005')!.veredicto, 'CONFLITO')
  assert.equal(contarEscritas(outra.plano).total, 0)
})

test('preencher um campo que estava vazio NÃO é conflito (é MUDOU)', () => {
  const primeira = importar(ler(), bancoVazio())
  const s51 = primeira.depois.get('p-ber')!.servicos.find((s) => s.codigo === 'BER-0051')!
  s51.endereco = null
  const { r } = importar(ler(), primeira.depois)
  const l = grupo(r, 'p-ber', 'servico').linhas.find((x) => x.chave === 'BER-0051')!
  assert.equal(l.veredicto, 'MUDOU')
})

test('registro excluído no sistema não ressuscita — e quem depende dele vira ERRO', () => {
  const primeira = importar(ler(), bancoVazio())
  const ber = primeira.depois.get('p-ber')!
  ber.servicos.find((s) => s.codigo === 'BER-0003')!.deleted_at = '2026-09-10T10:00:00Z'
  const { r, plano } = importar(ler(), primeira.depois)
  const l = grupo(r, 'p-ber', 'servico').linhas.find((x) => x.chave === 'BER-0003')!
  assert.equal(l.veredicto, 'EXCLUIDO')
  assert.equal(l.selecionada, false)
  const med = grupo(r, 'p-ber', 'medicao').linhas.find((x) => x.chave.startsWith('BER-0003'))!
  assert.equal(med.veredicto, 'ERRO')
  assert.ok(med.problemas.some((p) => /excluído/.test(p.mensagem)))
  assert.equal(contarEscritas(plano).total, 0)
})

test('salário: só administrador grava; os outros veem o aviso e nada de salário no plano', () => {
  const naoAdmin = importar(ler(), bancoVazio(), { ehAdmin: false })
  const g = grupo(naoAdmin.r, 'p-ber', 'membro')
  assert.ok(g.avisos.some((a) => /só administrador/.test(a)))
  assert.ok(g.linhas.every((x) => !('salario' in x.dados)))
  assert.ok(passos(naoAdmin.plano, 'p-ber', 'membro')!.gravar.every((x) => !('salario' in x.dados)))

  const admin = importar(ler(), bancoVazio(), { ehAdmin: true })
  assert.ok(grupo(admin.r, 'p-ber', 'membro').linhas.some((x) => x.dados.salario === 3000))
})

test('pessoa nova é marcada para revisão; pessoa com o mesmo nome no RH é casada', () => {
  const l = ler()
  const r = reconciliar({
    leitura: l, projetos: PROJETOS, existentes: bancoVazio(), ehAdmin: true,
    pessoas: [{ id: 'pes-2', nome_completo: 'PESSOA 02', org_id: 'org-wcr' }, { id: 'pes-x', nome_completo: 'Pessoa 03', org_id: 'outra-org' }],
  })
  const g = grupo(r, 'p-ber', 'membro')
  assert.equal(g.linhas.find((x) => x.chave === 'BER-002')!.dados.pessoa_id, 'pes-2')
  // mesmo nome, mas de OUTRA empresa: não casa
  assert.equal(g.linhas.find((x) => x.chave === 'BER-003')!.dados.pessoa_id, null)
})

test('assinatura: a planilha da ZN é recusada, com o motivo', () => {
  const { assinatura, leitura } = lerArquivoRev16(bufferZnMini())
  assert.equal(assinatura.ok, false)
  assert.equal(assinatura.modelo, 'zn')
  assert.equal(leitura, null)
  assert.match(assinatura.mensagem, /CONSÓRCIO ZN/)
  assert.match(assinatura.mensagem, /CARTEIRA DE REDE/)
})

test('assinatura: planilha desconhecida ou com cabeçalho trocado é recusada', () => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['qualquer coisa']]), 'Plan1')
  assert.equal(verificarAssinatura(wb).modelo, 'desconhecido')

  const trocado = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(trocado, XLSX.utils.aoa_to_sheet([[], [], [], ['CONTRATO', 'ID']]), '03. CADASTRO DE SERVIÇOS')
  const a = verificarAssinatura(trocado)
  assert.equal(a.ok, false)
  assert.match(a.mensagem, /A4/)
})

test('plano da primeira importação: pendentes (RDO), ocorrências, atas e plano semanal entram', () => {
  const { plano, depois } = importar(ler(), bancoVazio())
  const ber = depois.get('p-ber')!
  assert.equal(ber.pendentes.filter((p) => p.aba === '10').length, 2)
  assert.equal(ber.ocorrencias.length, 2)
  assert.equal(ber.ocorrencias.find((o) => o.tipo === 'Chuva')!.resolvida, true)       // status "Feito"
  assert.equal(ber.atas.length, 3)
  assert.equal(ber.plano.length, 1)
  assert.equal(ber.plano[0].semana_iso, '2026-W36')
  assert.equal(ber.vencimentos.length, 5)
  assert.ok(contarEscritas(plano).ausentes === 0)
})

// ─── o que a planilha PREENCHIDA (rev15 PLANEJADO×REALIZADO) trouxe ────────

test('linha só com CONTRATO é modelo vazio: não vira serviço e é apontada (a planilha a mostraria como CADASTRADO)', () => {
  const l = ler()
  assert.equal(l.servicos.length, 54)
  assert.ok(!l.servicos.some((s) => ['BER-0055', 'BER-0056', 'BER-0057'].includes(s.dados.codigo)))
  const ne = l.naoEntendidas.find((n) => n.aba === '03' && /só com CONTRATO/.test(n.motivo))
  assert.ok(ne)
  assert.match(ne!.motivo, /3 linha\(s\).*59–61/)
})

test('03 R e 09 G digitadas por cima da fórmula: vale o digitado, com aviso; divergência da OS vira "não identifiquei a causa"', () => {
  const l = ler()
  const s3 = l.servicos.find((s) => s.dados.codigo === 'BER-0003')!
  assert.equal(s3.dados.data_execucao_digitada, '2026-09-03')
  assert.ok(s3.avisos.some((a) => /digitada por cima/.test(a)))
  assert.ok(!s3.avisos.some((a) => /divergência/.test(a)), 'igual à conclusão da OS: sem divergência')

  const s4 = l.servicos.find((s) => s.dados.codigo === 'BER-0004')!
  assert.equal(s4.dados.data_execucao_digitada, '2026-09-05')
  assert.ok(s4.avisos.some((a) => /divergência.*04\/09\/2026.*não identifiquei a causa/.test(a)))

  const m4b = l.medicoes.find((m) => m.dados.servico_codigo === 'BER-0004' && m.dados.ordem === 2)!
  assert.equal(m4b.dados.data_execucao_digitada, '2026-09-05')
  assert.ok(m4b.avisos.some((a) => /coluna G.*digitada por cima/.test(a)))
  assert.ok(m4b.avisos.some((a) => /divergência/.test(a)))
  // onde G está vazio (fórmula), nada é inventado: deriva da OS no cálculo
  assert.equal(l.medicoes.find((m) => m.dados.servico_codigo === 'BER-0004' && m.dados.ordem === 1)!.dados.data_execucao_digitada, null)
})

test('09 boletim do ano seguinte ao da data de execução: importado como veio + aviso (não corrige calado)', () => {
  const l = ler()
  const m3 = l.medicoes.find((m) => m.dados.servico_codigo === 'BER-0003')!
  assert.equal(m3.dados.n_boletim, 'BM-09/2027')
  assert.ok(m3.avisos.some((a) => /ano seguinte ao da data de execução \(03\/09\/2026\)/.test(a)))
  const lista = avisosDaLeitura(l).filter((a) => a.aba === '09' && /ano seguinte/.test(a.mensagem))
  assert.deepEqual(lista.map((a) => a.linha), [8])
})

test('09 ID + boletim sem código e sem QTD é "sem item": não entra e não vira R$ 0', () => {
  const l = ler()
  assert.ok(!l.medicoes.some((m) => m.dados.servico_codigo === 'BER-0001'))
  const ne = l.naoEntendidas.find((n) => n.aba === '09' && n.linha === 5)!
  assert.match(ne.motivo, /sem item/)
  assert.match(ne.motivo, /nem R\$ 0/)
})

test('valor digitado por cima de coluna calculada é ignorado e avisado (11 Nº)', () => {
  const l = ler()
  const oc = l.ocorrencias.find((o) => o.linha === 6)!
  assert.ok(oc.avisos.some((a) => /"Nº" é fórmula.*digitado por cima.*ignorado/.test(a)))
})

test('08: coluna X de instruções (fora do cabeçalho) é ignorada; linhas fora de ordem casam pela matrícula', () => {
  const l = ler()
  assert.equal(l.membros.length, 6)
  assert.ok(!JSON.stringify(l.membros).includes('= salário'))
  assert.ok(!JSON.stringify(l.membros).includes('matrícula (BER'))
  const p6 = l.membros.find((m) => m.dados.matricula === 'BER-006')!
  assert.equal(p6.dados.nome, 'Pessoa 06')
  assert.equal(p6.dados.salario, 3500)
})

test('reimportar a planilha com datas digitadas e boletim trocado continua dando zero escritas', () => {
  const primeira = importar(ler(), bancoVazio())
  const segunda = importar(ler(), primeira.depois)
  assert.equal(contarEscritas(segunda.plano).total, 0)
  const med = primeira.depois.get('p-ber')!.medicoes.find((m) => m.servico_id && m.data_execucao_digitada === '2026-09-05')
  assert.ok(med, 'a data digitada foi para o banco')
})
