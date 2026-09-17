import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arrastaArquivo } from './useSoltarArquivo.ts'

test('reconhece arquivo sendo arrastado', () => {
  assert.equal(arrastaArquivo(['Files']), true)
  // Safari costuma mandar mais coisas junto.
  assert.equal(arrastaArquivo(['Files', 'text/plain']), true)
})

test('⚠️ arrastar OUTRA coisa não acende a área de importar', () => {
  // O Planejamento reordena trechos arrastando e o Relatório 360 tem kanban. Se a área de
  // importação reagisse a isso, arrastar uma linha acenderia "solte a planilha aqui" — e soltar
  // chamaria o leitor com zero arquivos.
  assert.equal(arrastaArquivo(['text/plain']), false)
  assert.equal(arrastaArquivo(['text/html', 'text/plain']), false)
  assert.equal(arrastaArquivo([]), false)
  assert.equal(arrastaArquivo(undefined), false)
})

test('aceita a lista do navegador, que não é Array', () => {
  // `DataTransfer.types` é uma DOMStringList em navegadores antigos — indexada, sem `.includes`.
  const comoDomStringList = { length: 1, 0: 'Files' } as unknown as DOMStringList
  assert.equal(arrastaArquivo(comoDomStringList), true)
})
