/**
 * FuncionariosListPanel — tabela do cadastro único de pessoas.
 * Colunas: Nome (+apelido cinza) · Cargo · Equipe atual · Encarregado ·
 * Vínculo · Status (badge). Busca única (nome_norm + apelidos) e filtros
 * (status, equipe, sem equipe, a revisar).
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, Plus, Search } from 'lucide-react'
import type { usePessoas, Pessoa, PessoaStatus } from '@/hooks/usePessoas'
import type { EquipeCard } from '@/data/wcrEquipes'
import { normalizePessoa } from '@/lib/matching/pessoaMatch'
import { inputCls, selectCls, btnPrimario, cardCls, thCls, STATUS_META, AVISO_MIGRATIONS } from './ui'

type UsePessoasReturn = ReturnType<typeof usePessoas>

interface Props {
  pessoal: UsePessoasReturn
  equipes: EquipeCard[]
  onNovo: () => void
  onEditar: (pessoa: Pessoa) => void
}

export function FuncionariosListPanel({ pessoal, equipes, onNovo, onEditar }: Props) {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'' | PessoaStatus>('')
  const [filtroEquipe, setFiltroEquipe] = useState('')
  const [soSemEquipe, setSoSemEquipe] = useState(false)
  const [soARevisar, setSoARevisar] = useState(false)

  const nomeEquipe = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of equipes) m.set(e.id, e.equipe)
    return m
  }, [equipes])

  // aliases por pessoa (pra busca cobrir 'Almir' → 'Almir Gomes dos Santos Junior')
  const aliasesPorPessoa = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const a of pessoal.apelidos) {
      const list = m.get(a.pessoa_id) ?? []
      list.push(a.alias_norm)
      m.set(a.pessoa_id, list)
    }
    return m
  }, [pessoal.apelidos])

  const filtradas = useMemo(() => {
    const q = normalizePessoa(busca).n1
    return pessoal.pessoas.filter((p) => {
      if (filtroStatus && p.status !== filtroStatus) return false
      if (filtroEquipe && p.equipeAtual?.equipeId !== filtroEquipe) return false
      if (soSemEquipe && p.equipeAtual !== null) return false
      if (soARevisar && !p.revisar) return false
      if (q) {
        const alvos = [
          p.nome_norm,
          normalizePessoa(p.apelido ?? '').n1,
          ...(aliasesPorPessoa.get(p.id) ?? []),
        ]
        if (!alvos.some((a) => a && a.includes(q))) return false
      }
      return true
    })
  }, [pessoal.pessoas, busca, filtroStatus, filtroEquipe, soSemEquipe, soARevisar, aliasesPorPessoa])

  return (
    <div className="p-6 space-y-4">
      {/* Barra de busca + filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou apelido…"
            className={`${inputCls} pl-8`}
          />
        </div>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as '' | PessoaStatus)} className={`${selectCls} w-44`}>
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_META) as PessoaStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        <select value={filtroEquipe} onChange={(e) => setFiltroEquipe(e.target.value)} className={`${selectCls} w-48`}>
          <option value="">Todas as equipes</option>
          {equipes.map((e) => <option key={e.id} value={e.id}>{e.equipe}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-[#a3a3a3] whitespace-nowrap">
          <input type="checkbox" checked={soSemEquipe} onChange={(e) => setSoSemEquipe(e.target.checked)} className="accent-[#f97316]" />
          sem equipe
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[#a3a3a3] whitespace-nowrap">
          <input type="checkbox" checked={soARevisar} onChange={(e) => setSoARevisar(e.target.checked)} className="accent-[#f97316]" />
          a revisar
        </label>
        <button onClick={onNovo} className={`${btnPrimario} flex items-center gap-1.5`}>
          <Plus size={14} /> Novo Funcionário
        </button>
      </div>

      {/* Tabela */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#525252]/50">
                <th className={thCls}>Nome</th>
                <th className={thCls}>Cargo</th>
                <th className={thCls}>Equipe atual</th>
                <th className={thCls}>Encarregado</th>
                <th className={thCls}>Vínculo</th>
                <th className={thCls}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => onEditar(p)}
                  className="border-b border-[#525252]/30 hover:bg-[#484848]/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[#f5f5f5]">{p.nome_completo}</span>
                      {p.apelido && <span className="text-[#a3a3a3] text-xs">({p.apelido})</span>}
                      {p.revisar && (
                        <span title="Criada por heurística — precisa de revisão humana">
                          <AlertTriangle size={12} className="text-[#f97316]" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[#a3a3a3]">{p.cargo?.nome ?? p.cargo_texto ?? '—'}</td>
                  <td className="px-4 py-2.5 text-[#a3a3a3]">
                    {p.equipeAtual ? nomeEquipe.get(p.equipeAtual.equipeId) ?? p.equipeAtual.equipeId : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-[#a3a3a3]">{p.encarregado_texto ?? '—'}</td>
                  <td className="px-4 py-2.5 text-[#a3a3a3]">{p.vinculo ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_META[p.status].badge}`}>
                      {STATUS_META[p.status].label}
                    </span>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#6b6b6b] text-sm italic">
                    {pessoal.tabelasAusentes
                      ? AVISO_MIGRATIONS
                      : pessoal.loading
                        ? 'Carregando…'
                        : 'Nenhuma pessoa encontrada com esses filtros.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-[#525252]/50 text-[#6b6b6b] text-xs">
          {filtradas.length} de {pessoal.pessoas.length} pessoa{pessoal.pessoas.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}
