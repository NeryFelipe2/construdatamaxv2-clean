/**
 * Testes do ConstruData sobre o motor do pacote — o que o pacote não cobria.
 *
 * ⚠️ O defeito dos dois pagamentos no mesmo mês: `fluxoMensal` usava `find` para achar "a"
 * medição paga dentro do mês. Com defasagem de ~29 dias ou mais, duas medições caem no mesmo mês
 * (fim de janeiro + 29 = 1º de março; fim de fevereiro + 29 = 29 de março) e a segunda sumia do
 * caixa — sem erro, e com o capital recomendado saindo errado.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BERTIOGA_SANTOS } from './premissasBertiogaSantos'
import { capitalNecessario, fluxoMensal, primeiroDiaDoMes } from './motor'
import type { PremissasFcp } from './tipos'

const EM_2027: PremissasFcp = {
  ...BERTIOGA_SANTOS,
  inicioObra: '2027-01-04',
  fimOperacao: '2027-06-30',
  defasagemDias: 29,
}

test('defasagem de 29 dias: março recebe a medição de janeiro E a de fevereiro', () => {
  const meses = fluxoMensal(EM_2027)
  const col = (mes: string) => meses.find((m) => m.mes.mes === mes)!

  assert.equal(col('2027-01-01').mes.dataPagamento, '2027-03-01')
  assert.equal(col('2027-02-01').mes.dataPagamento, '2027-03-29')

  const esperado = col('2027-01-01').medicaoBruta + col('2027-02-01').medicaoBruta
  assert.ok(esperado > 0)
  assert.equal(col('2027-02-01').recebimento, 0, 'fevereiro não recebe nada')
  assert.ok(Math.abs(col('2027-03-01').recebimento - esperado) < 0.01,
    `março deveria receber ${esperado.toFixed(2)} e recebeu ${col('2027-03-01').recebimento.toFixed(2)}`)
})

test('conservação: tudo que é pago dentro do horizonte entra no caixa, para qualquer defasagem', () => {
  for (const defasagemDias of [0, 20, 29, 31, 45, 60]) {
    const p = { ...EM_2027, defasagemDias }
    const meses = fluxoMensal(p)
    const ultimo = meses[meses.length - 1].mes.mes
    const devido = meses
      .filter((m) => primeiroDiaDoMes(m.mes.dataPagamento) <= ultimo)
      .reduce((s, m) => s + m.medicaoBruta, 0)
    const recebido = meses.reduce((s, m) => s + m.recebimento, 0)
    assert.ok(Math.abs(devido - recebido) < 0.01,
      `defasagem ${defasagemDias}: devido ${devido.toFixed(2)} × recebido ${recebido.toFixed(2)}`)
  }
})

test('a correção não mexe na fixture do pacote: capital de Bertioga + Santos continua R$ 181.646,84', () => {
  // A planilha diz 181.647,51; o motor dá 181.646,84 (o pacote tolera R$ 1). Com a defasagem de
  // 20 dias da fixture nunca caem dois pagamentos no mesmo mês, então a correção não pode mudar nada.
  const cap = capitalNecessario(BERTIOGA_SANTOS, fluxoMensal(BERTIOGA_SANTOS))
  assert.ok(Math.abs(cap.capitalRecomendado - 181646.84) < 0.01, String(cap.capitalRecomendado))
  assert.equal(cap.mesDoPiorPonto, '2026-10-01')
})
