/**
 * seededId.ts — identificador derivado de uma chave de negócio, em vez de sorteado.
 *
 * POR QUE ISTO EXISTE. Os stores são local-first: a escrita é otimista e vai para uma fila
 * (`pendingSync`) drenada por `flushQueue`, que envia `insert` como **upsert por id**
 * (`src/lib/storeSync.ts`). Isso já protege contra reenviar a MESMA operação — timeout,
 * retry, resposta perdida.
 *
 * O que não protege é o mesmo fato de negócio acontecer em **dois lugares**: dois dispositivos,
 * duas abas, ou o mesmo botão clicado depois de um `pull` que ainda não chegou. Com
 * `crypto.randomUUID()` cada lado inventa um id diferente e o servidor guarda os dois — em
 * cobrança, isso é dinheiro duplicado.
 *
 * A saída é o id **não ser sorteado**: derivá-lo do que identifica o fato ("a baixa do título
 * X", "a cobrança da unidade Y no rateio Z"). Os dois lados chegam ao mesmo id, o segundo
 * upsert regrava a mesma linha, e o resultado é um só registro sem precisar de coordenação.
 *
 * LIMITE, PARA NÃO CONFUNDIR: isto NÃO é criptografia nem UUID v4 de verdade — é um hash
 * curto (cyrb128) formatado como UUID, que é o que o tipo `uuid` do Postgres aceita. Serve
 * para deduplicar, não para ser imprevisível. Onde o id precisa ser secreto ou aleatório,
 * continue usando `crypto.randomUUID()`.
 *
 * SEMPRE inclua a organização na chave: dois clientes diferentes não podem colidir só porque
 * usaram o mesmo número de documento. Use `seededId(orgId, 'baixa', tituloId)`.
 */

/** Hash cyrb128: 4 acumuladores de 32 bits → 32 hex, suficiente para uma chave de dedupe. */
function hash128(seed: string): string {
  let h1 = 0x9e3779b9, h2 = 0x243f6a88, h3 = 0xb7e15162, h4 = 0xdeadbeef
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
    h3 = Math.imul(h3 ^ c, 3812015801)
    h4 = Math.imul(h4 ^ c, 2246822519)
  }
  const hx = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
  return hx(h1) + hx(h2) + hx(h3) + hx(h4)
}

/**
 * Id estável no formato UUID a partir de partes que identificam o fato de negócio.
 *
 * @param orgId  organização dona do registro (evita colisão entre clientes; aceita
 *               undefined para os casos em que a org ainda não foi resolvida)
 * @param tipo   o que é ('baixa', 'rateio', 'distribuicao'…) — mantém espaços separados
 * @param partes o que identifica a ocorrência dentro do tipo
 */
export function seededId(orgId: string | null | undefined, tipo: string, ...partes: string[]): string {
  const r = hash128([orgId ?? 'sem-org', tipo, ...partes].join(':'))
  return `${r.slice(0, 8)}-${r.slice(8, 12)}-${r.slice(12, 16)}-${r.slice(16, 20)}-${r.slice(20, 32)}`
}

/**
 * Forma legada, sem organização: recebe a semente inteira já montada. Existe porque os feeds
 * de RDO (RDO→Financeiro e RDO→timecards) já geraram ids assim em produção — mudar a semente
 * agora criaria um registro novo ao lado do antigo em vez de substituí-lo.
 * **Não use em código novo**; prefira `seededId`.
 */
export function seededUuidLegado(seed: string): string {
  const r = hash128(seed)
  return `${r.slice(0, 8)}-${r.slice(8, 12)}-${r.slice(12, 16)}-${r.slice(16, 20)}-${r.slice(20, 32)}`
}
