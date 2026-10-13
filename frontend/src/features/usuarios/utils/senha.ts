/**
 * senha.ts — gerador de senha temporária forte para o modal "Adicionar pessoa".
 *
 * A senha é sorteada NO NAVEGADOR (crypto.getRandomValues) e nunca é gravada
 * em lugar nenhum pela tela: ela vai no corpo da chamada à Edge Function e é
 * mostrada uma vez para quem está cadastrando entregar por fora.
 *
 * Alfabeto sem caracteres ambíguos (0/O, 1/l/I) — a senha vai ser ditada por
 * WhatsApp ou telefone.
 */
const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const MINUSCULAS = 'abcdefghijkmnopqrstuvwxyz'
const DIGITOS = '23456789'
const SIMBOLOS = '!@#$%*-_?'
const TODOS = MAIUSCULAS + MINUSCULAS + DIGITOS + SIMBOLOS

/** Inteiro em [0, max) sem viés de módulo. */
function sorteio(max: number): number {
  const limite = Math.floor(0xffffffff / max) * max
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limite) return buf[0] % max
  }
}

function sorteiaDe(alfabeto: string): string {
  return alfabeto[sorteio(alfabeto.length)]
}

/** Senha com pelo menos 1 maiúscula, 1 minúscula, 1 dígito e 1 símbolo. */
export function gerarSenhaForte(tamanho = 14): string {
  const min = 8
  const n = Math.max(min, tamanho)
  const chars = [sorteiaDe(MAIUSCULAS), sorteiaDe(MINUSCULAS), sorteiaDe(DIGITOS), sorteiaDe(SIMBOLOS)]
  while (chars.length < n) chars.push(sorteiaDe(TODOS))
  // Fisher-Yates para não deixar as classes obrigatórias sempre nas 4 primeiras.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = sorteio(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export type ForcaSenha = 'curta' | 'fraca' | 'boa' | 'forte'

/** Avaliação simples só para dar retorno visual no campo. */
export function avaliarSenha(senha: string): ForcaSenha {
  if (senha.length < 8) return 'curta'
  let classes = 0
  if (/[A-Z]/.test(senha)) classes++
  if (/[a-z]/.test(senha)) classes++
  if (/[0-9]/.test(senha)) classes++
  if (/[^A-Za-z0-9]/.test(senha)) classes++
  if (senha.length >= 12 && classes >= 3) return 'forte'
  if (classes >= 3) return 'boa'
  return 'fraca'
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function emailValido(email: string): boolean {
  return RE_EMAIL.test(email.trim())
}
