/**
 * AutocompletePessoa — input que filtra o cadastro único por nome/apelido
 * (aliases inclusos) e oferece "criar novo…" quando nada casa.
 * Usado no EquipesPanel (adicionar membro) e no RDO nominal (+ pessoa).
 */
import { useMemo, useRef, useState } from 'react'
import { UserPlus } from 'lucide-react'
import type { Pessoa, PessoaApelido } from '@/hooks/usePessoas'
import { normalizePessoa } from '@/lib/matching/pessoaMatch'
import { inputCls } from './ui'

interface Props {
  pessoas: Pessoa[]
  apelidos: PessoaApelido[]
  placeholder?: string
  /** só pessoas nestes status aparecem (default: todas menos desligadas). */
  incluirDesligados?: boolean
  onSelecionar: (pessoa: Pessoa) => void
  /** quando definido, mostra a opção "criar novo…" com o texto digitado. */
  onCriarNovo?: (nomeDigitado: string) => void
}

export function AutocompletePessoa({
  pessoas,
  apelidos,
  placeholder,
  incluirDesligados = false,
  onSelecionar,
  onCriarNovo,
}: Props) {
  const [texto, setTexto] = useState('')
  const [aberto, setAberto] = useState(false)
  const blurTimer = useRef<number | null>(null)

  const aliasesPorPessoa = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const a of apelidos) {
      const list = m.get(a.pessoa_id) ?? []
      list.push(a.alias_norm)
      m.set(a.pessoa_id, list)
    }
    return m
  }, [apelidos])

  const resultados = useMemo(() => {
    const q = normalizePessoa(texto).n1
    if (!q) return []
    return pessoas
      .filter((p) => incluirDesligados || p.status !== 'desligado')
      .filter((p) => {
        const alvos = [p.nome_norm, normalizePessoa(p.apelido ?? '').n1, ...(aliasesPorPessoa.get(p.id) ?? [])]
        return alvos.some((a) => a && a.includes(q))
      })
      .slice(0, 8)
  }, [texto, pessoas, aliasesPorPessoa, incluirDesligados])

  function selecionar(p: Pessoa) {
    onSelecionar(p)
    setTexto('')
    setAberto(false)
  }

  return (
    <div className="relative flex-1 min-w-[200px]">
      <input
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)}
        onBlur={() => {
          // deixa o clique no dropdown acontecer antes de fechar
          blurTimer.current = window.setTimeout(() => setAberto(false), 150)
        }}
        placeholder={placeholder ?? 'Buscar pessoa por nome ou apelido…'}
        className={inputCls}
      />
      {aberto && texto.trim() !== '' && (
        <div className="absolute z-30 mt-1 w-full bg-[#2c2c2c] border border-[#525252] rounded-lg shadow-xl overflow-hidden">
          {resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selecionar(p) }}
              className="w-full text-left px-3 py-2 hover:bg-[#484848] transition-colors"
            >
              <span className="text-sm text-[#f5f5f5]">{p.nome_completo}</span>
              <span className="text-xs text-[#a3a3a3] ml-2">
                {[p.apelido ? `(${p.apelido})` : null, p.cargo?.nome ?? p.cargo_texto].filter(Boolean).join(' · ')}
              </span>
            </button>
          ))}
          {resultados.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#6b6b6b] italic">Ninguém no cadastro casa com “{texto.trim()}”.</p>
          )}
          {onCriarNovo && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onCriarNovo(texto.trim())
                setTexto('')
                setAberto(false)
              }}
              className="w-full text-left px-3 py-2 border-t border-[#525252] text-[#f97316] hover:bg-[#f97316]/10 transition-colors flex items-center gap-1.5 text-sm"
            >
              <UserPlus size={13} /> criar novo… {texto.trim() ? `“${texto.trim()}”` : ''}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
