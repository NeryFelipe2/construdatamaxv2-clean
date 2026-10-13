/**
 * O RDO genérico lendo o apontamento WCR pelo MESMO interpretador do painel RDO WCR
 * (regra 8 do pacote: um interpretador só). Cada teste é um defeito do parser antigo.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseApontamentoWcr, parseRdoText, aplicarApelidosWcr } from './parseRdoText'

const MODELO = [
  'Produção - 31/08',
  'Equipe - Gilvan',
  'Núcleo - Boi Malhado',
  'Imóvel - Rua A, 10',
  'Imóvel - Rua B, 22',
  'SERVIÇO ÁGUA',
  'PRA - 48',
  'LA - ',
  'IHM - 2',
  'SERVIÇO ESGOTO',
  'PRE - 0',
  'PV - ',
  'Guindaste - 2',
  'obs: chuva à tarde',
].join('\n')

test('sigla em branco não vira serviço; 0 escrito vira serviço de quantidade 0', () => {
  const a = parseApontamentoWcr(MODELO)!
  const q = (d: string) => a.services.find((s) => s.description.startsWith(d))?.quantity
  assert.equal(q('PRA'), 48)
  assert.equal(q('LA'), undefined, 'LA em branco é não informado')
  assert.equal(q('PRE'), 0, 'PRE - 0 foi escrito')
  assert.equal(q('PV'), undefined)
  assert.equal(a.metrosRede, 48)
})

test('apelido da equipe (IHM) é entendido pelo mesmo interpretador', () => {
  assert.match(aplicarApelidosWcr('IHM - 2'), /^HM - 2$/)
  const a = parseApontamentoWcr(MODELO)!
  assert.equal(a.services.find((s) => s.description.startsWith('IHM'))?.quantity, 2)
})

test('linha não entendida vai para as observações marcada — não some', () => {
  const r = parseRdoText(MODELO)
  assert.match(r.observations, /chuva à tarde/)
  assert.match(r.observations, /\[não entendido\] Guindaste - 2/)
})

test('local = imóveis + núcleo; responsável = equipe; data com ano', () => {
  const r = parseRdoText(MODELO)
  assert.equal(r.local, 'Rua A, 10 · Rua B, 22 — Boi Malhado')
  assert.equal(r.responsible, 'Gilvan')
  assert.match(r.date ?? '', /^\d{4}-08-31$/)
})

test('texto que não é o modelo continua no parser genérico', () => {
  assert.equal(parseApontamentoWcr('Local: Rua X\nServiço: rede DN200'), null)
})
