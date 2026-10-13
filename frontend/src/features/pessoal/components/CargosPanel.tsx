/**
 * CargosPanel — catálogo de cargos: lista com categoria_rdo editável (ponte
 * com os 4 contadores do RDO), criação de cargo e apelidos (grafias sujas)
 * por cargo.
 */
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { usePessoas, CategoriaRdo } from '@/hooks/usePessoas'
import { cargoFormSchema } from '../schemas'
import { inputCls, selectCls, btnPrimario, cardCls, thCls, AVISO_MIGRATIONS } from './ui'

type UsePessoasReturn = ReturnType<typeof usePessoas>

const CATEGORIAS: { value: CategoriaRdo; label: string }[] = [
  { value: 'encarregado', label: 'Encarregado' },
  { value: 'oficial',     label: 'Oficial' },
  { value: 'ajudante',    label: 'Ajudante' },
  { value: 'operador',    label: 'Operador' },
  { value: 'indireto',    label: 'Indireto' },
]

interface Props {
  pessoal: UsePessoasReturn
}

export function CargosPanel({ pessoal }: Props) {
  const [novoNome, setNovoNome] = useState('')
  const [novaCategoria, setNovaCategoria] = useState<CategoriaRdo>('ajudante')
  const [erro, setErro] = useState<string | null>(null)

  const apelidosPorCargo = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const a of pessoal.cargoApelidos) {
      const list = m.get(a.cargo_id) ?? []
      list.push(a.alias_raw)
      m.set(a.cargo_id, list)
    }
    return m
  }, [pessoal.cargoApelidos])

  const pessoasPorCargo = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of pessoal.pessoas) {
      if (p.cargo_id) m.set(p.cargo_id, (m.get(p.cargo_id) ?? 0) + 1)
    }
    return m
  }, [pessoal.pessoas])

  async function handleCriar() {
    setErro(null)
    const parsed = cargoFormSchema.safeParse({ nome: novoNome, categoriaRdo: novaCategoria })
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }
    const id = await pessoal.criarCargo(parsed.data.nome, parsed.data.categoriaRdo)
    if (id) {
      setNovoNome('')
      setNovaCategoria('ajudante')
    } else if (!pessoal.tabelasAusentes) {
      setErro(pessoal.error ?? 'Não foi possível criar o cargo')
    }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Criar cargo */}
      <div className={`${cardCls} p-4`}>
        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b] mb-2">Novo cargo</p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Ex.: ENCANADOR DE ESGOTO II"
            className={`${inputCls} flex-1 min-w-[220px]`}
          />
          <select value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value as CategoriaRdo)} className={`${selectCls} w-44`}>
            {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button onClick={handleCriar} className={`${btnPrimario} flex items-center gap-1.5`}>
            <Plus size={14} /> Criar cargo
          </button>
        </div>
        {erro && <p className="text-xs text-[#f87171] mt-2">{erro}</p>}
      </div>

      {/* Lista */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#525252]/50">
                <th className={thCls}>Cargo</th>
                <th className={thCls}>Categoria no RDO</th>
                <th className={thCls}>Pessoas</th>
                <th className={thCls}>Apelidos / grafias que resolvem pra ele</th>
              </tr>
            </thead>
            <tbody>
              {pessoal.cargos.map((c) => (
                <tr key={c.id} className="border-b border-[#525252]/30">
                  <td className="px-4 py-2.5 text-[#f5f5f5]">
                    {c.nome}
                    {c.nivel && <span className="text-[#6b6b6b] text-xs ml-1.5">nível {c.nivel}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={c.categoria_rdo}
                      onChange={(e) => pessoal.atualizarCargo(c.id, { categoria_rdo: e.target.value as CategoriaRdo })}
                      className="bg-[#484848] border border-[#5e5e5e] rounded-lg px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
                    >
                      {CATEGORIAS.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-[#a3a3a3] font-mono text-xs">{pessoasPorCargo.get(c.id) ?? 0}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(apelidosPorCargo.get(c.id) ?? []).map((alias, i) => (
                        <span key={i} className="bg-[#484848] text-[#a3a3a3] text-[10px] px-2 py-0.5 rounded-full">
                          {alias}
                        </span>
                      ))}
                      {(apelidosPorCargo.get(c.id) ?? []).length === 0 && (
                        <span className="text-[#6b6b6b] text-xs">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {pessoal.cargos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[#6b6b6b] text-sm italic">
                    {pessoal.tabelasAusentes ? AVISO_MIGRATIONS : 'Nenhum cargo cadastrado ainda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
