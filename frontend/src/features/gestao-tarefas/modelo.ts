/**
 * Cálculos da aba Tarefas da Gestão, comuns aos três visuais.
 * Tudo deriva de dados.ts e da marcação "feita" (localStorage). Nada é estimado.
 */
import { useEffect, useMemo, useState } from 'react'
import { RESPONSAVEIS, TAREFAS, type Frente, type Tarefa } from './dados'

export type Situacao = 'atrasada' | 'hoje' | 'aberta' | 'feita'
export type Visual = 'painel' | 'missao' | 'editorial'

export const ROTULO: Record<Situacao, string> = {
  atrasada: 'Atrasada', hoje: 'Vence hoje', aberta: 'Aberta', feita: 'Feita',
}
const ORDEM: Record<Situacao, number> = { atrasada: 0, hoje: 1, aberta: 2, feita: 3 }

const CHAVE_FEITAS = 'gestao-tarefas:feitas'
const CHAVE_VISUAL = 'gestao-tarefas:visual'

function ler<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave)
    return v ? (JSON.parse(v) as T) : padrao
  } catch {
    return padrao
  }
}
function gravar(chave: string, valor: unknown) {
  try { localStorage.setItem(chave, JSON.stringify(valor)) } catch { /* sem armazenamento: segue sem salvar */ }
}

export function hojeISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export function br(iso: string, ano = true): string {
  const [a, m, d] = iso.split('-')
  return ano ? `${d}/${m}/${a}` : `${d}/${m}`
}
export function dias(de: string, ate: string): number {
  return Math.round((Date.parse(ate + 'T00:00:00') - Date.parse(de + 'T00:00:00')) / 86400000)
}
function somaDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export interface Linha { t: Tarefa; s: Situacao; idade: number }

export function useTarefas() {
  const hoje = hojeISO()
  const [visual, setVisual] = useState<Visual>(() => {
    const v = ler<string>(CHAVE_VISUAL, 'painel')
    return v === 'missao' || v === 'editorial' ? v : 'painel'
  })
  const [feitas, setFeitas] = useState<Set<string>>(() => new Set(ler<string[]>(CHAVE_FEITAS, [])))
  const [pessoa, setPessoa] = useState<string>('Todos')

  useEffect(() => gravar(CHAVE_VISUAL, visual), [visual])
  useEffect(() => gravar(CHAVE_FEITAS, [...feitas]), [feitas])

  const alternar = (id: string) =>
    setFeitas((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })

  const situacao = (t: Tarefa): Situacao => {
    if (feitas.has(t.id)) return 'feita'
    if (t.prazo && t.prazo < hoje) return 'atrasada'
    if (t.prazo === hoje) return 'hoje'
    return 'aberta'
  }

  const todas: Linha[] = useMemo(
    () => TAREFAS.map((t) => ({ t, s: situacao(t), idade: Math.max(0, dias(t.desde, hoje)) }))
      .sort((a, b) => ORDEM[a.s] - ORDEM[b.s] || a.t.desde.localeCompare(b.t.desde)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feitas, hoje],
  )
  const linhas = todas.filter(({ t }) => pessoa === 'Todos' || t.responsavel === pessoa)

  const total = TAREFAS.length
  const nFeitas = todas.filter((l) => l.s === 'feita').length
  const nAbertas = total - nFeitas
  const nHoje = todas.filter((l) => l.s === 'hoje').length
  const nAtrasadas = todas.filter((l) => l.s === 'atrasada').length
  const nVelhas = todas.filter((l) => l.s !== 'feita' && l.idade >= 7).length
  const maisAntiga = todas.filter((l) => l.s !== 'feita').reduce<string | null>(
    (m, l) => (m === null || l.t.desde < m ? l.t.desde : m), null)
  const pctFeitas = total ? Math.round((nFeitas / total) * 100) : 0

  const porPessoa = RESPONSAVEIS.map((r) => {
    const doR = todas.filter((l) => l.t.responsavel === r)
    return {
      r,
      total: doR.length,
      abertas: doR.filter((l) => l.s !== 'feita').length,
      urgentes: doR.filter((l) => l.s === 'hoje' || l.s === 'atrasada').length,
      velhas: doR.filter((l) => l.s !== 'feita' && l.idade >= 7).length,
    }
  })

  const frentes = [...new Set(TAREFAS.map((t) => t.frente))] as Frente[]
  const porFrente = frentes
    .map((f) => ({ f, abertas: todas.filter((l) => l.t.frente === f && l.s !== 'feita').length,
      total: todas.filter((l) => l.t.frente === f).length }))
    .sort((a, b) => b.total - a.total)

  // Série diária desde a primeira lista: tarefas que entraram (acumulado) e que seguem abertas.
  const inicio = TAREFAS.reduce((m, t) => (t.desde < m ? t.desde : m), TAREFAS[0].desde)
  const nDias = Math.max(1, dias(inicio, hoje))
  const serie = Array.from({ length: nDias + 1 }, (_, i) => {
    const d = somaDias(inicio, i)
    const entraram = TAREFAS.filter((t) => t.desde <= d).length
    return { d, entraram }
  })

  return {
    hoje, visual, setVisual, pessoa, setPessoa, alternar,
    todas, linhas, total, nFeitas, nAbertas, nHoje, nAtrasadas, nVelhas, maisAntiga, pctFeitas,
    porPessoa, porFrente, serie, inicio,
  }
}

export type Modelo = ReturnType<typeof useTarefas>
export { RESPONSAVEIS }
