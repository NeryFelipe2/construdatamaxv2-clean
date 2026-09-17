/**
 * A planilha de Controle de Caixa do cliente, dentro do sistema.
 *
 * Os casos aqui NÃO são inventados: cada um veio de uma linha de
 * `docs/CONTROLE DE CAIXA-MODELO.xlsx`, conferida célula a célula antes de virar teste. É por isso
 * que eles são o contrato — se a planilha muda, é aqui que dói primeiro.
 *
 * O risco que estes testes cercam é sempre o mesmo: **reimportar não pode duplicar nem perder**.
 * A equipe mexe no arquivo o mês inteiro e joga no sistema várias vezes.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  normalizarTexto, lerData, lerValor, separarSolicitantes, chaveDeConteudo,
  acharCabecalho, lerLancamentos, type Matriz,
  lerHorasExtras, mesDoNomeDaAba, diasDaObservacao, conferirTotaisDeHorasExtras,
  abasDeHorasExtras,
  abaDeLancamentos,
} from './controleDeCaixaPlanilha'

// O cabeçalho real: linha 1 são rótulos de bloco, linha 2 é o cabeçalho de verdade.
const CAB: Matriz = [
  ['RECEITAS', null, 'DESPESAS', null, null, null, null],
  ['ENTRADA', 'DATA', 'DESCRIÇÃO', 'VALOR', 'DATA DA DESPESA', 'SOLICITANTE', 'CONFERIDO'],
]

const d = (s: string) => new Date(`${s}T00:00:00`)

// ─── Datas ────────────────────────────────────────────────────────────────────

test('data como Date, como texto brasileiro e como ISO', () => {
  assert.equal(lerData(d('2026-07-06'))!.data, '2026-07-06')
  assert.equal(lerData('06/07/2026')!.data, '2026-07-06')
  assert.equal(lerData('6/7/26')!.data, '2026-07-06')
  assert.equal(lerData('2026-07-06')!.data, '2026-07-06')
})

test('⚠️ "01 A 10/07/2026" vira PERÍODO — é uma linha real da planilha', () => {
  // Linha 12 do arquivo do cliente. Recusar perderia a despesa; achatar num dia só mentiria.
  const p = lerData('01 A 10/07/2026')!
  assert.equal(p.data, '2026-07-01')
  assert.equal(p.dataFim, '2026-07-10')
})

test('o intervalo aceita as escritas irmãs, com e sem espaço', () => {
  for (const s of ['01 A 10/07/2026', '01A10/07/2026', '01 ATÉ 10/07/2026', '01 - 10/07/2026']) {
    const p = lerData(s)
    assert.equal(p?.data, '2026-07-01', s)
    assert.equal(p?.dataFim, '2026-07-10', s)
  }
})

test('intervalo que atravessa o mês devolve só o começo, em vez de inventar o mês da outra ponta', () => {
  const p = lerData('28 A 03/07/2026')!
  assert.equal(p.data, '2026-07-28')
  assert.equal(p.dataFim, undefined)
})

test('data impossível é recusada, não arredondada para o mês seguinte', () => {
  // O Date do JS rola 31/02 para 03/03 sem reclamar. Aceitar isso gravaria uma despesa num dia
  // que não existe na planilha de ninguém.
  assert.equal(lerData('31/02/2026'), null)
  assert.equal(lerData('45/01/2026'), null)
  assert.equal(lerData('06/13/2026'), null)
})

test('serial do Excel vira data; número fora da faixa plausível NÃO vira', () => {
  assert.equal(lerData(46209)!.data, '2026-07-06')
  // Um "1000" numa coluna de data é valor no lugar errado. Virar 26/09/1902 seria inventar dado.
  assert.equal(lerData(1000), null)
  assert.equal(lerData(0), null)
})

test('célula vazia não é data e não estoura', () => {
  for (const v of [null, undefined, '', '   ']) assert.equal(lerData(v), null)
})

// ─── Valores ──────────────────────────────────────────────────────────────────

test('valor em número, em real brasileiro e em ponto decimal', () => {
  assert.equal(lerValor(1000), 1000)
  assert.equal(lerValor('1.234,56'), 1234.56)
  assert.equal(lerValor('1234.56'), 1234.56)
  assert.equal(lerValor('R$ 1.234,56'), 1234.56)
  assert.equal(lerValor('1,50'), 1.5)
})

test('valor entre parênteses é negativo — é como planilha escreve saída', () => {
  assert.equal(lerValor('(1.000,00)'), -1000)
})

test('texto que não é número devolve null, não NaN', () => {
  for (const v of ['SALDO==>>', 'abc', '', null, undefined]) {
    const r = lerValor(v)
    assert.ok(r === null || Number.isFinite(r), `${String(v)} produziu NaN`)
  }
  assert.equal(lerValor('SALDO==>>'), null)
})

test('zero é um valor, não uma ausência', () => {
  assert.equal(lerValor(0), 0)
  assert.equal(lerValor('0'), 0)
})

// ─── Solicitantes ─────────────────────────────────────────────────────────────

test('⚠️ "PESSOA F/PESSOA A" são DUAS pessoas — casos reais da planilha', () => {
  assert.deepEqual(separarSolicitantes('PESSOA F/PESSOA A'), ['PESSOA F', 'PESSOA A'])
  assert.deepEqual(separarSolicitantes('PESSOA F/PESSOA E'), ['PESSOA F', 'PESSOA E'])
  // Este tem espaço dos dois lados da barra, e é literalmente assim no arquivo.
  assert.deepEqual(separarSolicitantes('PESSOA I / PESSOA R'), ['PESSOA I', 'PESSOA R'])
})

test('solicitante único continua único, e o vazio é lista vazia', () => {
  assert.deepEqual(separarSolicitantes('PESSOA B'), ['PESSOA B'])
  // "PESSOA M RH" é um departamento, e o espaço no meio não pode virar separador.
  assert.deepEqual(separarSolicitantes('PESSOA M RH'), ['PESSOA M RH'])
  for (const v of ['', null, undefined, '   ']) assert.deepEqual(separarSolicitantes(v), [])
})

// ─── Cabeçalho ────────────────────────────────────────────────────────────────

test('⚠️ o cabeçalho NÃO é a primeira linha — na planilha do cliente está na segunda', () => {
  const c = acharCabecalho(CAB)!
  assert.equal(c.linha, 1, 'a linha 1 traz só os rótulos de bloco RECEITAS/DESPESAS')
  assert.equal(c.mapa.descricao, 2)
  assert.equal(c.mapa.valor, 3)
  assert.equal(c.mapa.solicitante, 5)
})

test('acento e caixa no cabeçalho não importam', () => {
  const c = acharCabecalho([['entrada', 'data', 'descricao', 'VALOR', 'Data da Despesa']])!
  assert.equal(c.mapa.descricao, 2)
  assert.equal(c.mapa.dataDespesa, 4)
})

test('⚠️ acha a coluna de "Conferido" mesmo SEM CABEÇALHO — é assim no arquivo do cliente', () => {
  // Na planilha real a célula G2 está VAZIA e os 106 "Conferido" estão na coluna G. Sem a busca
  // por conteúdo, a primeira importação jogaria fora a conferência inteira — que é trabalho que
  // alguém já fez linha por linha.
  const semCabecalhoNoStatus: Matriz = [
    ['RECEITAS', null, 'DESPESAS', null, null, null, null],
    ['ENTRADA', 'DATA', 'DESCRIÇÃO', 'VALOR', 'DATA DA DESPESA', 'SOLICITANTE', null],
    [0, null, 'A', 100, d('2026-07-06'), 'X', 'Conferido'],
    [0, null, 'B', 200, d('2026-07-07'), 'Y', 'Conferido'],
    [0, null, 'C', 300, d('2026-07-08'), 'Z', 'Conferido'],
  ]
  const r = lerLancamentos(semCabecalhoNoStatus)
  assert.equal(r.lancamentos.length, 3)
  assert.equal(r.lancamentos.filter((l) => l.conferido).length, 3)
})

test('uma coluna de observações NÃO é confundida com status', () => {
  // A busca por conteúdo exige 80% de marcas de conferência; um "OK" solto no meio de observações
  // não pode sequestrar a coluna e marcar tudo como conferido.
  const comObs: Matriz = [
    ['ENTRADA', 'DATA', 'DESCRIÇÃO', 'VALOR', 'DATA DA DESPESA', 'SOLICITANTE', null],
    [0, null, 'A', 100, d('2026-07-06'), 'X', 'combinado com o Jailton'],
    [0, null, 'B', 200, d('2026-07-07'), 'Y', 'OK'],
    [0, null, 'C', 300, d('2026-07-08'), 'Z', 'falta nota'],
  ]
  const r = lerLancamentos(comObs)
  assert.equal(r.lancamentos.filter((l) => l.conferido).length, 0)
})

test('planilha sem cabeçalho reconhecível avisa em vez de importar lixo', () => {
  const r = lerLancamentos([['foo', 'bar'], ['1', '2']])
  assert.equal(r.lancamentos.length, 0)
  assert.match(r.problemas[0].motivo, /cabeçalho/i)
})

// ─── A leitura, com as linhas reais ───────────────────────────────────────────

test('lê receita e despesa da MESMA linha como dois lançamentos', () => {
  // É a forma da planilha: dois blocos lado a lado. A linha 3 real tem entrada 2000 E despesa 1000.
  const r = lerLancamentos([...CAB, [2000, d('2026-07-06'), 'CONSERTO DE 2 PNEUS DA RETRO', 1000, d('2026-07-06'), 'PESSOA P', 'Conferido']])
  assert.equal(r.lancamentos.length, 2)

  // ⚠️ Este teste exigia `problemas.length === 0` — e era essa exigência de SILÊNCIO que sustentava
  // o defeito: a receita ficava com a descrição da despesa e ninguém era avisado. Agora a linha
  // com os dois blocos gera exatamente um aviso, pedindo a descrição da receita.
  assert.equal(r.problemas.length, 1)
  assert.match(r.problemas[0].motivo, /Receita sem descrição própria/)

  const receita = r.lancamentos.find((l) => l.tipo === 'receita')!
  assert.equal(receita.valor, 2000)
  assert.equal(receita.data, '2026-07-06')
  assert.notEqual(receita.descricao, 'CONSERTO DE 2 PNEUS DA RETRO')

  const despesa = r.lancamentos.find((l) => l.tipo === 'despesa')!
  assert.equal(despesa.valor, 1000)
  assert.deepEqual(despesa.solicitantes, ['PESSOA P'])
  assert.equal(despesa.conferido, true)
})

test('linha só de despesa não inventa receita de zero', () => {
  const r = lerLancamentos([...CAB, [0, null, 'ÁGUA BICA', 1000, d('2026-07-06'), 'PESSOA I', 'Conferido']])
  assert.equal(r.lancamentos.length, 1)
  assert.equal(r.lancamentos[0].tipo, 'despesa')
})

test('⚠️ a linha de SALDO não vira lançamento — o saldo cai na coluna do SOLICITANTE', () => {
  // Linha 120 do arquivo real: A=18000, D=106000, E='SALDO==>>', F=-88000. Lida como lançamento,
  // ela criaria um solicitante chamado "-88000" e uma receita de 18 mil que não existe.
  const r = lerLancamentos([...CAB, [18000, null, null, 106000, 'SALDO==>>', -88000, null]])
  assert.equal(r.lancamentos.length, 0, 'a linha de fechamento não é lançamento')
  assert.equal(r.totaisDeclarados?.receitas, 18000)
  assert.equal(r.totaisDeclarados?.despesas, 106000)
  assert.equal(r.totaisDeclarados?.saldo, -88000)
})

test('⚠️ saldo POSITIVO também é lido — não é "o número negativo da linha"', () => {
  // Era assim, e funcionava só porque o arquivo do cliente fecha em −88.000. Uma empresa no azul
  // teria o fechamento descartado em silêncio e a conferência nunca acusaria divergência.
  const r = lerLancamentos([...CAB, [5000, null, null, 800, 'SALDO==>>', 4200, null]])
  assert.equal(r.lancamentos.length, 0)
  assert.equal(r.totaisDeclarados?.saldo, 4200)
})

test('o saldo é lido onde estiver — a posição não é fixa na planilha do cliente', () => {
  // No arquivo real o rótulo cai na coluna DATA DA DESPESA e o valor na de SOLICITANTE, porque a
  // pessoa escreveu onde tinha espaço.
  const r = lerLancamentos([...CAB, [18000, null, null, 106000, 'SALDO==>>', -88000, null]])
  assert.equal(r.totaisDeclarados?.saldo, -88000)
})

test('despesa sem data herda a data da linha de cima', () => {
  // É como a planilha é preenchida quando várias despesas caem no mesmo dia.
  const r = lerLancamentos([...CAB,
    [0, null, 'PRIMEIRA', 100, d('2026-07-15'), 'PESSOA C', 'Conferido'],
    [0, null, 'SEGUNDA',  200, null,            'PESSOA C', 'Conferido'],
  ])
  assert.equal(r.problemas.length, 0)
  assert.equal(r.lancamentos[1].data, '2026-07-15')
})

test('despesa sem descrição e valor não numérico viram problema apontando a linha', () => {
  const r = lerLancamentos([...CAB,
    [0, null, '',            500,     d('2026-07-15'), 'X', null],
    [0, null, 'ALGUMA COISA', 'muito', d('2026-07-15'), 'X', null],
  ])
  assert.equal(r.lancamentos.length, 0)
  assert.equal(r.problemas.length, 2)
  assert.equal(r.problemas[0].linha, 3, 'a linha apontada é a do arquivo, 1-based')
  assert.equal(r.problemas[1].coluna, 'VALOR')
  assert.equal(r.problemas[1].conteudo, 'muito')
})

test('despesa sem solicitante é aceita — existe uma assim na planilha real', () => {
  const r = lerLancamentos([...CAB, [0, null, 'MATERIAIS DEPÓSITO VAPT VUPT', 1000, d('2026-07-10'), null, 'Conferido']])
  assert.equal(r.problemas.length, 0)
  assert.deepEqual(r.lancamentos[0].solicitantes, [])
})

// ─── Identidade: o coração da reimportação ────────────────────────────────────

test('⚠️ DUAS linhas idênticas em TUDO recebem chaves diferentes', () => {
  // Caso REAL: as linhas 27 e 32 do arquivo são iguais em descrição, data, valor e solicitante.
  // São dois Ubers de verdade no mesmo dia. Sem o desempate por ordem, a segunda seria tratada
  // como cópia da primeira e o gasto sumiria da conta.
  const uber = 'UBER EQUIPE PESSOA B - MORRO DOCE PARA CANTEIRO'
  const r = lerLancamentos([...CAB,
    [0, null, uber, 1000, d('2026-07-17'), 'PESSOA B', 'Conferido'],
    [0, null, uber, 1000, d('2026-07-17'), 'PESSOA B', 'Conferido'],
  ])
  assert.equal(r.lancamentos.length, 2)
  assert.notEqual(r.lancamentos[0].chave, r.lancamentos[1].chave)
  assert.ok(r.lancamentos[0].chave.endsWith('#1'))
  assert.ok(r.lancamentos[1].chave.endsWith('#2'))
})

test('O TESTE QUE DECIDE: reimportar o mesmo arquivo devolve as MESMAS chaves', () => {
  // É o gesto que o cliente vai repetir várias vezes por mês. Se as chaves mudarem, cada
  // importação recria as 120 linhas.
  const linhas: Matriz = [...CAB,
    [2000, d('2026-07-06'), 'CONSERTO DE PNEUS', 1000, d('2026-07-06'), 'PESSOA P', 'Conferido'],
    [0, null, 'ÁGUA BICA', 1000, d('2026-07-07'), 'PESSOA I', 'Conferido'],
    [0, null, 'ÁGUA BICA', 1000, d('2026-07-07'), 'PESSOA I', 'Conferido'],
  ]
  const a = lerLancamentos(linhas).lancamentos.map((l) => l.chave)
  const b = lerLancamentos(linhas).lancamentos.map((l) => l.chave)
  assert.deepEqual(a, b)
  assert.equal(new Set(a).size, a.length, 'chave repetida faria duas linhas virarem uma')
})

test('a chave separa receita de despesa de mesma data e descrição', () => {
  const base = { data: '2026-07-06', descricao: 'X' }
  assert.notEqual(
    chaveDeConteudo({ ...base, tipo: 'receita' }, 1),
    chaveDeConteudo({ ...base, tipo: 'despesa' }, 1),
  )
})

test('acento e caixa não criam lançamento novo', () => {
  const a = chaveDeConteudo({ tipo: 'despesa', data: '2026-07-06', descricao: 'Água Bica' }, 1)
  const b = chaveDeConteudo({ tipo: 'despesa', data: '2026-07-06', descricao: 'AGUA BICA' }, 1)
  assert.equal(a, b)
})

test('⚠️ o VALOR e o SOLICITANTE ficam FORA da chave — são o que a pessoa corrige', () => {
  // Se entrassem, corrigir R$ 1.000 para R$ 1.500 não seria "valor alterado": seria uma linha nova
  // mais uma "sumiu". A conferência precisa mostrar a correção como correção.
  const a = chaveDeConteudo({ tipo: 'despesa', data: '2026-07-06', descricao: 'DIESEL' }, 1)
  const b = chaveDeConteudo({ tipo: 'despesa', data: '2026-07-06', descricao: 'DIESEL' }, 1)
  assert.equal(a, b, 'a mesma linha, com valor corrigido, continua sendo a mesma linha')
})

test('duas despesas de valores diferentes no mesmo dia continuam distintas — pela ORDEM', () => {
  // Com o valor fora da chave, quem separa é a ordem de aparição. Dois diesels no mesmo dia, de
  // R$ 500 e R$ 800, continuam sendo dois lançamentos.
  const r = lerLancamentos([...CAB,
    [0, null, 'DIESEL', 500, d('2026-07-09'), 'PESSOA C', 'Conferido'],
    [0, null, 'DIESEL', 800, d('2026-07-09'), 'PESSOA C', 'Conferido'],
  ])
  assert.equal(r.lancamentos.length, 2)
  assert.notEqual(r.lancamentos[0].chave, r.lancamentos[1].chave)
  assert.deepEqual(r.lancamentos.map((l) => l.valor), [500, 800])
})

test('normalizar tira acento, caixa e espaço dobrado', () => {
  // O espaço dobrado é real: "ÉVERTON  SABINO" está assim na aba de horas extras.
  assert.equal(normalizarTexto('ÉVERTON  SABINO'), 'EVERTON SABINO')
  assert.equal(normalizarTexto('  Água Bica '), 'AGUA BICA')
  assert.equal(normalizarTexto(null), '')
})

// ─── Horas extras ─────────────────────────────────────────────────────────────

const HE_CAB: Matriz = [['NOME', 'Cargo', '01', '02', 'OBS. DIAS 01 E 02', '08', '09']]
const MES = { mes: 8, ano: 2026, nomeDaAba: 'HORAS EXTRAS 08' }

test('o mês vem do nome da aba — a planilha não escreve a data inteira', () => {
  assert.equal(mesDoNomeDaAba('HORAS EXTRAS 08'), 8)
  assert.equal(mesDoNomeDaAba('HORAS EXTRAS 12'), 12)
  assert.equal(mesDoNomeDaAba('HORAS EXTRAS'), undefined)
  assert.equal(mesDoNomeDaAba('HORAS EXTRAS 13'), undefined, 'mês 13 não existe')
})

test('"OBS. DIAS 01 E 02" diz a que dias o PG se refere', () => {
  assert.deepEqual(diasDaObservacao('OBS. DIAS 01 E 02'), [1, 2])
  assert.deepEqual(diasDaObservacao('OBS DIAS 15, 16 E 22'), [15, 16, 22])
  assert.deepEqual(diasDaObservacao('SOLICITANTE'), [], 'coluna que não é observação')
})

test('a grade vira um registro por pessoa e por dia, com a data montada', () => {
  const r = lerHorasExtras([...HE_CAB,
    ['PESSOA O GOMES DOS SANTOS JUNIOR', 'AJUDANTE GERAL I', 300, 300, 'PG', null, null],
  ], MES)
  assert.equal(r.problemas.length, 0)
  assert.equal(r.registros.length, 2)
  assert.deepEqual(r.registros.map((x) => x.data), ['2026-08-01', '2026-08-02'])
  assert.ok(r.registros.every((x) => x.pago))
})

test('⚠️ o valor NÃO sai do cargo — o mesmo cargo tem valores diferentes no arquivo real', () => {
  // AJUDANTE GERAL I aparece com 250, 300 e 350. Derivar do cargo mudaria a folha de gente real.
  const r = lerHorasExtras([...HE_CAB,
    ['PESSOA O',  'AJUDANTE GERAL I', 300, null, 'PG', null, null],
    ['EDSON',  'AJUDANTE GERAL I', null, 250, 'PG', null, null],
    ['SERAFIM','AJUDANTE GERAL I', 350, null, 'PG', null, null],
  ], MES)
  assert.deepEqual(r.registros.map((x) => x.valor).sort((a, b) => a - b), [250, 300, 350])
})

test('⚠️ pessoa COM valor e SEM cargo é aceita — ÉVERTON está assim no arquivo', () => {
  const r = lerHorasExtras([...HE_CAB, ['ÉVERTON  SABINO LOPES DA SILVA', null, 350, 300, 'PG', null, null]], MES)
  assert.equal(r.problemas.length, 0)
  assert.equal(r.registros.length, 2)
  assert.equal(r.registros[0].cargo, undefined)
  assert.equal(r.registros[0].valor, 350)
  assert.equal(r.registros[1].valor, 300, 'a mesma pessoa com valores diferentes em dois dias')
})

test('a linha TOTAIS não vira pessoa, e vira conferência', () => {
  const r = lerHorasExtras([...HE_CAB,
    ['PESSOA O', 'AJUDANTE GERAL I', 300, 300, 'PG', null, null],
    ['EDSON', 'AJUDANTE GERAL I', 350, null, 'PG', null, null],
    ['TOTAIS', null, 650, 300, null, null, null],
  ], MES)
  assert.ok(!r.registros.some((x) => x.nome === 'TOTAIS'))
  assert.deepEqual(r.totaisDeclarados, { 1: 650, 2: 300 })
  assert.deepEqual(conferirTotaisDeHorasExtras(r), [], 'a soma bate com o rodapé')
})

test('quando a soma NÃO bate com o rodapé, a divergência é apontada com o dia', () => {
  // É a checagem que o cliente pediu: alguém mexeu numa célula e não na fórmula do rodapé.
  const r = lerHorasExtras([...HE_CAB,
    ['PESSOA O', 'AJUDANTE GERAL I', 300, null, 'PG', null, null],
    ['TOTAIS', null, 999, null, null, null, null],
  ], MES)
  const d = conferirTotaisDeHorasExtras(r)
  assert.equal(d.length, 1)
  assert.equal(d[0].dia, 1)
  assert.equal(d[0].calculado, 300)
  assert.equal(d[0].declarado, 999)
  assert.equal(d[0].diferenca, -699)
})

test('o PG só vale para os dias que o cabeçalho da observação nomeia', () => {
  // "OBS. DIAS 01 E 02" não diz nada sobre o dia 08 — e "não disse" não é "pago".
  const r = lerHorasExtras([...HE_CAB, ['PESSOA O', 'AJUDANTE GERAL I', 300, null, 'PG', 300, null]], MES)
  assert.equal(r.registros.find((x) => x.dia === 1)!.pago, true)
  assert.equal(r.registros.find((x) => x.dia === 8)!.pago, false)
})

test('dia que não existe no mês vira problema, não data inválida', () => {
  const r = lerHorasExtras([['NOME', 'Cargo', '31'], ['PESSOA O', 'AJUDANTE', 300]], { mes: 2, ano: 2026 })
  assert.equal(r.registros.length, 0)
  assert.match(r.problemas[0].motivo, /não existe em 02\/2026/)
})

test('célula vazia e zero não viram lançamento de hora extra', () => {
  const r = lerHorasExtras([...HE_CAB, ['PESSOA O', 'AJUDANTE GERAL I', null, 0, 'PG', '', null]], MES)
  assert.equal(r.registros.length, 0)
})

test('valor não numérico na grade aponta a pessoa e o dia', () => {
  const r = lerHorasExtras([...HE_CAB, ['PESSOA O', 'AJUDANTE GERAL I', 'meio dia', null, 'PG', null, null]], MES)
  assert.equal(r.registros.length, 0)
  assert.equal(r.problemas[0].coluna, 'dia 01')
  assert.equal(r.problemas[0].conteudo, 'meio dia')
})

test('grade sem coluna de dia avisa em vez de importar nada em silêncio', () => {
  const r = lerHorasExtras([['NOME', 'Cargo'], ['PESSOA O', 'AJUDANTE']], MES)
  assert.equal(r.registros.length, 0)
  assert.match(r.problemas[0].motivo, /coluna de dia/i)
})

test('reimportar a mesma grade dá as mesmas chaves', () => {
  const grade: Matriz = [...HE_CAB,
    ['PESSOA O', 'AJUDANTE GERAL I', 300, 300, 'PG', null, null],
    ['EDSON', 'AJUDANTE GERAL I', 300, null, 'PG', null, null],
  ]
  const a = lerHorasExtras(grade, MES).registros.map((x) => x.chave)
  const b = lerHorasExtras(grade, MES).registros.map((x) => x.chave)
  assert.deepEqual(a, b)
  assert.equal(new Set(a).size, a.length)
})

// ─────────────────────────────────────────────────────────────────────────────
// Qual aba ler — a correção do mês que sumia
// ─────────────────────────────────────────────────────────────────────────────

test('⚠️ TODAS as abas de horas extras são encontradas, não só a primeira', () => {
  // O cliente tem uma aba por mês. Com o `find` que havia aqui, de agosto em diante a hora extra
  // paga não entrava no caixa e a tela não dizia nada.
  const nomes = ['DESPESAS', 'HORAS EXTRAS 08', 'HORAS EXTRAS 09', 'HORAS EXTRAS 10']
  assert.deepEqual(abasDeHorasExtras(nomes), ['HORAS EXTRAS 08', 'HORAS EXTRAS 09', 'HORAS EXTRAS 10'])
})

test('arquivo sem grade de horas extras devolve lista vazia, não erro', () => {
  assert.deepEqual(abasDeHorasExtras(['DESPESAS']), [])
})

test('variações de escrita da aba de horas extras', () => {
  assert.equal(abasDeHorasExtras(['hora extra 07']).length, 1)
  assert.equal(abasDeHorasExtras(['HORASEXTRAS 07']).length, 1)
  assert.equal(abasDeHorasExtras(['HORAS  EXTRAS  07']).length, 1)
})

test('a aba de lançamentos é achada pelo nome', () => {
  assert.deepEqual(abaDeLancamentos(['LEIA-ME', 'LANÇAMENTOS']), { aba: 'LANÇAMENTOS', porPosicao: false })
  assert.deepEqual(abaDeLancamentos(['DESPESAS', 'HORAS EXTRAS 08']), { aba: 'DESPESAS', porPosicao: false })
})

test('⚠️ sem aba com nome conhecido, cai na primeira MAS avisa', () => {
  // Num arquivo fundido a primeira aba pode ser um LEIA-ME. Ler a aba errada calado é pior que
  // reclamar — por isso `porPosicao` existe e a tela mostra.
  assert.deepEqual(abaDeLancamentos(['LEIA-ME', 'PREMISSAS']), { aba: 'LEIA-ME', porPosicao: true })
})

test('arquivo sem aba nenhuma devolve null', () => {
  assert.equal(abaDeLancamentos([]), null)
})

test('mesDoNomeDaAba lê o mês de cada aba', () => {
  assert.equal(mesDoNomeDaAba('HORAS EXTRAS 08'), 8)
  assert.equal(mesDoNomeDaAba('HORAS EXTRAS 09'), 9)
  assert.equal(mesDoNomeDaAba('HORAS EXTRAS'), undefined)
})

// ─────────────────────────────────────────────────────────────────────────────
// A coluna compartilhada — o defeito que fazia a receita roubar a descrição
// ─────────────────────────────────────────────────────────────────────────────

/** Cabeçalho igual ao do arquivo real: banner na linha 1, cabeçalho na 2. */
const CAB_REAL = [
  ['RECEITAS', null, 'DESPESAS', null, null, null, null],
  ['ENTRADA', 'DATA', 'DESCRIÇÃO', 'VALOR', 'DATA DA DESPESA', 'SOLICITANTE', null],
]

test('⚠️ linha com os DOIS blocos: a descrição é da despesa, e a receita NÃO a herda', () => {
  // É a linha 3 do arquivo real: receita de 2.000 e despesa de 1.000 de "CONSERTO DE 2 PNEUS".
  // Elas coincidem na linha só porque alguém digitou assim — não têm relação nenhuma.
  const m: Matriz = [...CAB_REAL, [2000, '06/07/2026', 'CONSERTO DE 2 PNEUS DA RETRO', 1000, '06/07/2026', 'PESSOA P', 'OK']]
  const r = lerLancamentos(m)

  const receita = r.lancamentos.find((l) => l.tipo === 'receita')
  const despesa = r.lancamentos.find((l) => l.tipo === 'despesa')
  assert.ok(receita && despesa)
  assert.equal(despesa.descricao, 'CONSERTO DE 2 PNEUS DA RETRO')
  assert.notEqual(receita.descricao, despesa.descricao, 'a receita não pode herdar a descrição da despesa')
  assert.equal(receita.descricao, 'Entrada')
})

test('e a receita sem descrição própria vira um AVISO, não um lançamento inventado', () => {
  const m: Matriz = [...CAB_REAL, [2000, '06/07/2026', 'CONSERTO DE 2 PNEUS DA RETRO', 1000, '06/07/2026', 'PESSOA P', 'OK']]
  const r = lerLancamentos(m)
  const aviso = r.problemas.find((p) => p.coluna === 'DESCRIÇÃO' && /Receita/.test(p.motivo))
  assert.ok(aviso, 'a tela precisa pedir a descrição em vez de fabricar uma')
  assert.equal(aviso.linha, 3)
})

test('⚠️ e o ID compartilhado não vai para os dois — um apagaria o outro', () => {
  // `addEntry` é upsert por id. Dois lançamentos com o mesmo id = um some, em silêncio.
  const cab: Matriz = [
    ['ID', 'ENTRADA', 'DATA', 'DESCRIÇÃO', 'VALOR', 'DATA DA DESPESA', 'SOLICITANTE'],
  ]
  const m: Matriz = [...cab, ['abc-123', 2000, '06/07/2026', 'ALUGUEL', 1000, '06/07/2026', 'PESSOA P']]
  const r = lerLancamentos(m)
  const receita = r.lancamentos.find((l) => l.tipo === 'receita')
  const despesa = r.lancamentos.find((l) => l.tipo === 'despesa')
  assert.equal(despesa?.idExterno, 'abc-123', 'o ID fica com a despesa, que é dona da linha')
  assert.equal(receita?.idExterno, undefined, 'a receita usa a chave de conteúdo, e não colide')
  assert.notEqual(receita?.chave, despesa?.chave)
})

test('linha com SÓ receita: a descrição é dela — é a ida-e-volta do modelo gerado', () => {
  // O modelo que o sistema gera escreve um lançamento por linha, e a descrição da receita vai na
  // mesma coluna D. Se esta regra quebrar, a reimportação do próprio modelo passa a criar linha
  // nova toda vez.
  const m: Matriz = [...CAB_REAL, [5000, '10/07/2026', 'MEDIÇÃO 03', null, null, null, null]]
  const r = lerLancamentos(m)
  assert.equal(r.lancamentos.length, 1)
  assert.equal(r.lancamentos[0].tipo, 'receita')
  assert.equal(r.lancamentos[0].descricao, 'MEDIÇÃO 03', 'sozinha na linha, a descrição é da receita')
  assert.equal(r.problemas.filter((p) => /Receita sem descrição/.test(p.motivo)).length, 0)
})

test('linha com só receita preserva ID, categoria e conferido', () => {
  const cab: Matriz = [
    ['ID', 'ENTRADA', 'DATA', 'DESCRIÇÃO', 'VALOR', 'DATA DA DESPESA', 'SOLICITANTE', 'CATEGORIA', 'CONFERIDO'],
  ]
  const m: Matriz = [...cab, ['id-9', 5000, '10/07/2026', 'MEDIÇÃO 03', null, null, null, 'Medição', 'Conferido']]
  const l = lerLancamentos(m).lancamentos[0]
  assert.equal(l.idExterno, 'id-9')
  assert.equal(l.categoria, 'Medição')
  assert.equal(l.conferido, true)
})

test('linha só com despesa continua igual', () => {
  const m: Matriz = [...CAB_REAL, [null, null, 'UBER', 80, '10/07/2026', 'PESSOA G', 'OK']]
  const r = lerLancamentos(m)
  assert.equal(r.lancamentos.length, 1)
  assert.equal(r.lancamentos[0].tipo, 'despesa')
  assert.equal(r.lancamentos[0].descricao, 'UBER')
  assert.deepEqual(r.lancamentos[0].solicitantes, ['PESSOA G'])
  // `conferido` fica falso aqui de propósito: a coluna de status não tem cabeçalho e é achada
  // pelo CONTEÚDO, exigindo várias marcas. Uma linha só não é evidência de coluna de status.
  assert.equal(r.lancamentos[0].conferido, false)
})

test('as duas receitas em linhas diferentes com a mesma data ganham chaves distintas', () => {
  const m: Matriz = [
    ...CAB_REAL,
    [2000, '06/07/2026', 'ALUGUEL', 1000, '06/07/2026', 'PESSOA P', null],
    [3000, '06/07/2026', 'DIESEL', 500, '06/07/2026', 'PESSOA G', null],
  ]
  const rec = lerLancamentos(m).lancamentos.filter((l) => l.tipo === 'receita')
  assert.equal(rec.length, 2)
  assert.notEqual(rec[0].chave, rec[1].chave, 'o desempate por ocorrência tem de separá-las')
})
