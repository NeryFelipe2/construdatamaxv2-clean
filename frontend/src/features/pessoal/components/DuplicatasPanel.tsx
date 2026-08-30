/**
 * DuplicatasPanel — fila de revisão humana do cadastro único:
 *  1. apelidos NÃO revisados cujo alias_norm cabe em ≥2 pessoas (ambíguos da
 *     clusterização) → decidir: vincular a X / são pessoas diferentes /
 *     buscar outra / descartar. Grava pessoa_apelidos.revisado=true e
 *     pessoas.revisar=false.
 *  2. pessoas com revisar=true (criadas por heurística) → confirmar/editar.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Search, Trash2, UserCheck } from 'lucide-react'
import type { usePessoas, Pessoa } from '@/hooks/usePessoas'
import { AutocompletePessoa } from './AutocompletePessoa'
import { cardCls, btnSecundario, STATUS_META, AVISO_MIGRATIONS } from './ui'

type UsePessoasReturn = ReturnType<typeof usePessoas>

interface GrupoAlias {
  aliasNorm: string
  aliasRaw: string
  candidatas: Pessoa[]
}

interface Props {
  pessoal: UsePessoasReturn
  onEditar: (pessoa: Pessoa) => void
}

export function DuplicatasPanel({ pessoal, onEditar }: Props) {
  const [buscandoOutra, setBuscandoOutra] = useState<string | null>(null) // aliasNorm

  const grupos = useMemo<GrupoAlias[]>(() => {
    const porNorm = new Map<string, { raw: string; pessoaIds: Set<string> }>()
    for (const a of pessoal.apelidos) {
      if (a.revisado) continue
      const g = porNorm.get(a.alias_norm) ?? { raw: a.alias_raw, pessoaIds: new Set<string>() }
      g.pessoaIds.add(a.pessoa_id)
      porNorm.set(a.alias_norm, g)
    }
    const out: GrupoAlias[] = []
    for (const [aliasNorm, g] of porNorm) {
      if (g.pessoaIds.size < 2) continue
      const candidatas = pessoal.pessoas.filter((p) => g.pessoaIds.has(p.id))
      if (candidatas.length >= 2) out.push({ aliasNorm, aliasRaw: g.raw, candidatas })
    }
    return out.sort((a, b) => a.aliasNorm.localeCompare(b.aliasNorm))
  }, [pessoal.apelidos, pessoal.pessoas])

  const pessoasEmGrupo = useMemo(() => {
    const s = new Set<string>()
    for (const g of grupos) for (const c of g.candidatas) s.add(c.id)
    return s
  }, [grupos])

  const pessoasARevisar = useMemo(
    () => pessoal.pessoas.filter((p) => p.revisar && !pessoasEmGrupo.has(p.id)),
    [pessoal.pessoas, pessoasEmGrupo],
  )

  const vazio = grupos.length === 0 && pessoasARevisar.length === 0

  return (
    <div className="p-6 space-y-5">
      {vazio && (
        <div className={`${cardCls} p-8 text-center`}>
          <Check size={28} className="text-[#22c55e] mx-auto mb-2" />
          <p className="text-[#f5f5f5] text-sm font-medium">Fila de duplicatas vazia</p>
          <p className="text-[#6b6b6b] text-xs mt-1">
            {pessoal.tabelasAusentes ? AVISO_MIGRATIONS : 'Nenhum apelido ambíguo nem pessoa pendente de revisão.'}
          </p>
        </div>
      )}

      {/* 1. Apelidos ambíguos */}
      {grupos.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b]">
            Apelidos ambíguos ({grupos.length})
          </p>
          {grupos.map((g) => (
            <div key={g.aliasNorm} className={`${cardCls} p-4 space-y-3`}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-[#f97316]" />
                <p className="text-sm text-[#f5f5f5]">
                  “<span className="font-semibold">{g.aliasRaw}</span>” cabe em{' '}
                  <span className="text-[#f97316] font-semibold">{g.candidatas.length}</span> pessoas — quem é?
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {g.candidatas.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 bg-[#484848]/40 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[#f5f5f5] text-xs truncate">{p.nome_completo}</p>
                      <p className="text-[#6b6b6b] text-[10px] truncate">
                        {[p.cargo?.nome ?? p.cargo_texto, STATUS_META[p.status].label, p.origem].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <button
                      onClick={() => pessoal.confirmarAliasParaPessoa(g.aliasNorm, p.id)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[#f97316] text-[#ffffff] hover:bg-[#ea580c] transition-colors"
                    >
                      <UserCheck size={12} /> é esta
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => pessoal.saoPessoasDiferentes(g.aliasNorm, g.candidatas.map((c) => c.id))}
                  className={`${btnSecundario} text-xs px-3 py-1.5`}
                  title="Cada candidata é uma pessoa distinta — tira todas da fila"
                >
                  São pessoas diferentes
                </button>
                <button
                  onClick={() => setBuscandoOutra(buscandoOutra === g.aliasNorm ? null : g.aliasNorm)}
                  className={`${btnSecundario} text-xs px-3 py-1.5 flex items-center gap-1`}
                >
                  <Search size={12} /> Buscar outra
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Descartar o apelido "${g.aliasRaw}"? (some da fila; ninguém fica com esse alias)`)) {
                      pessoal.descartarAlias(g.aliasNorm)
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-300 border border-red-700/40 hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 size={12} /> Descartar
                </button>
              </div>
              {buscandoOutra === g.aliasNorm && (
                <div className="pt-1">
                  <AutocompletePessoa
                    pessoas={pessoal.pessoas}
                    apelidos={pessoal.apelidos}
                    incluirDesligados
                    placeholder={`Vincular “${g.aliasRaw}” a outra pessoa…`}
                    onSelecionar={(p) => {
                      pessoal.vincularAliasAPessoa(g.aliasRaw, g.aliasNorm, p.id)
                      setBuscandoOutra(null)
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 2. Pessoas criadas por heurística */}
      {pessoasARevisar.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b]">
            Pessoas a revisar ({pessoasARevisar.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pessoasARevisar.map((p) => (
              <div key={p.id} className={`${cardCls} px-4 py-3 flex items-center justify-between gap-2`}>
                <div className="min-w-0">
                  <p className="text-[#f5f5f5] text-sm truncate">{p.nome_completo}</p>
                  <p className="text-[#6b6b6b] text-[10px] truncate">
                    {[p.origem, p.observacoes].filter(Boolean).join(' · ') || 'criada por heurística'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => onEditar(p)} className={`${btnSecundario} text-xs px-2.5 py-1.5`}>
                    Editar
                  </button>
                  <button
                    onClick={() => pessoal.marcarPessoaRevisada(p.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30 hover:bg-[#22c55e]/25 transition-colors"
                  >
                    <Check size={12} /> OK
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
