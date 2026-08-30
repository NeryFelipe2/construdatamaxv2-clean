/**
 * HORAS EXTRAS — apuração por período, a partir da presença lançada no RDO.
 *
 * Não é uma planilha nova: lê `rdo_presenca`, que o encarregado já preenche no
 * RDO do dia (quem veio, horas normais, horas extras). Zero digitação dupla.
 *
 * Honestidade de dado: se não houver presença lançada no período, a tela diz
 * exatamente isso — não mostra zero, que seria uma afirmação falsa ("ninguém
 * fez hora extra") no lugar da verdadeira ("ninguém lançou o RDO ainda").
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Clock, Download, RefreshCw, Search } from 'lucide-react'

interface LinhaPresenca {
  pessoa_id: string | null
  nome_snapshot: string | null
  equipe_nome_snapshot: string | null
  funcao_no_dia: string | null
  presente: boolean | null
  horas_normais: number | null
  horas_extras: number | null
  rdos: { data: string | null } | null
}

interface Apurado {
  chave: string
  nome: string
  equipe: string
  funcao: string
  dias: number
  faltas: number
  hn: number
  he: number
}

function primeiroDiaDoMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}
const n1 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function HorasExtrasPanel() {
  const [de, setDe] = useState(primeiroDiaDoMes)
  const [ate, setAte] = useState(hojeIso)
  const [busca, setBusca] = useState('')
  const [linhas, setLinhas] = useState<LinhaPresenca[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tabelaAusente, setTabelaAusente] = useState(false)

  async function carregar() {
    if (!supabase) {
      setErro('Sem conexão com o banco (variáveis de ambiente ausentes).')
      return
    }
    setCarregando(true)
    setErro(null)
    const { data, error } = await supabase
      .from('rdo_presenca')
      .select('pessoa_id, nome_snapshot, equipe_nome_snapshot, funcao_no_dia, presente, horas_normais, horas_extras, rdos!inner(data)')
      .gte('rdos.data', de)
      .lte('rdos.data', ate)
      .is('deleted_at', null)
    setCarregando(false)

    if (error) {
      const msg = (error.message ?? '').toLowerCase()
      // tabela ainda não criada = migration pendente, não é erro de código
      if (error.code === '42P01' || error.code === 'PGRST205' || msg.includes('does not exist')) {
        setTabelaAusente(true)
        setLinhas([])
        return
      }
      setErro('Não foi possível carregar as horas do período.')
      return
    }
    setTabelaAusente(false)
    setLinhas((data ?? []) as unknown as LinhaPresenca[])
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, ate])

  const apurado = useMemo<Apurado[]>(() => {
    const mapa = new Map<string, Apurado>()
    for (const l of linhas) {
      const nome = (l.nome_snapshot ?? '').trim() || '(sem nome)'
      const chave = l.pessoa_id ?? `nome:${nome.toLowerCase()}`
      const a = mapa.get(chave) ?? {
        chave,
        nome,
        equipe: l.equipe_nome_snapshot ?? '—',
        funcao: l.funcao_no_dia ?? '—',
        dias: 0,
        faltas: 0,
        hn: 0,
        he: 0,
      }
      if (l.presente === false) a.faltas += 1
      else {
        a.dias += 1
        a.hn += Number(l.horas_normais ?? 0)
        a.he += Number(l.horas_extras ?? 0)
      }
      mapa.set(chave, a)
    }
    const termo = busca.trim().toLowerCase()
    return [...mapa.values()]
      .filter((a) => !termo || a.nome.toLowerCase().includes(termo) || a.equipe.toLowerCase().includes(termo))
      .sort((x, y) => y.he - x.he || x.nome.localeCompare(y.nome, 'pt-BR'))
  }, [linhas, busca])

  const totais = useMemo(
    () => apurado.reduce((acc, a) => ({ he: acc.he + a.he, hn: acc.hn + a.hn, faltas: acc.faltas + a.faltas }), { he: 0, hn: 0, faltas: 0 }),
    [apurado],
  )

  function baixarCsv() {
    const cab = ['Nome', 'Equipe', 'Funcao', 'Dias trabalhados', 'Faltas', 'Horas normais', 'Horas extras']
    const linhasCsv = apurado.map((a) =>
      [a.nome, a.equipe, a.funcao, a.dias, a.faltas, n1(a.hn), n1(a.he)]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';'),
    )
    const blob = new Blob(['﻿' + [cab.join(';'), ...linhasCsv].join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `horas-extras_${de}_a_${ate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputCls =
    'bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]'

  return (
    <div className="p-6 space-y-4">
      {/* filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-[#a3a3a3] uppercase tracking-wide">De</span>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-[#a3a3a3] uppercase tracking-wide">Até</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <span className="text-[11px] text-[#a3a3a3] uppercase tracking-wide">Buscar</span>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="nome ou equipe"
              className={`${inputCls} w-full pl-8`}
            />
          </div>
        </label>
        <button
          onClick={() => void carregar()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#484848] text-[#f5f5f5] text-sm hover:bg-[#525252]"
        >
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
          Atualizar
        </button>
        <button
          onClick={baixarCsv}
          disabled={apurado.length === 0}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#484848] text-[#f5f5f5] text-sm hover:bg-[#525252] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={14} />
          Exportar CSV
        </button>
      </div>

      {/* KPIs — travessão quando não há lançamento, nunca zero fabricado */}
      <div className="flex gap-3 overflow-x-auto">
        {[
          { rot: 'Horas extras no período', val: linhas.length ? `${n1(totais.he)} h` : null, nota: 'nenhuma presença lançada no período' },
          { rot: 'Horas normais', val: linhas.length ? `${n1(totais.hn)} h` : null, nota: 'nenhuma presença lançada no período' },
          { rot: 'Pessoas com lançamento', val: linhas.length ? String(apurado.length) : null, nota: 'nenhuma presença lançada' },
          { rot: 'Faltas registradas', val: linhas.length ? String(totais.faltas) : null, nota: 'nenhuma presença lançada' },
        ].map((k) => (
          <div key={k.rot} className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 min-w-[160px]">
            <div className="text-[11px] text-[#a3a3a3] uppercase tracking-wide">{k.rot}</div>
            {k.val ? (
              <div className="font-mono text-lg text-[#f5f5f5] mt-1">{k.val}</div>
            ) : (
              <>
                <div className="font-mono text-lg text-[#6b6b6b] mt-1">—</div>
                <div className="text-[10px] text-[#6b6b6b] mt-0.5">{k.nota}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {tabelaAusente && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          A tabela de presença do RDO (<code>rdo_presenca</code>) ainda não existe no banco — a migration
          do módulo Pessoal está pendente. Assim que ela for aplicada, as horas aparecem aqui sozinhas.
        </div>
      )}
      {erro && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{erro}</div>
      )}

      {/* tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#525252]/50">
              {['Nome', 'Equipe', 'Função', 'Dias', 'Faltas', 'H. normais', 'H. extras'].map((h, i) => (
                <th
                  key={h}
                  className={`text-[#a3a3a3] text-xs font-medium px-4 py-2 ${i < 3 ? 'text-left' : 'text-right'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apurado.map((a) => (
              <tr key={a.chave} className="border-b border-[#525252]/50 hover:bg-[#484848]/40">
                <td className="px-4 py-2 text-[#f5f5f5]">{a.nome}</td>
                <td className="px-4 py-2 text-[#a3a3a3]">{a.equipe}</td>
                <td className="px-4 py-2 text-[#a3a3a3]">{a.funcao}</td>
                <td className="px-4 py-2 text-right font-mono text-[#f5f5f5]">{a.dias}</td>
                <td className={`px-4 py-2 text-right font-mono ${a.faltas > 0 ? 'text-amber-400' : 'text-[#6b6b6b]'}`}>
                  {a.faltas}
                </td>
                <td className="px-4 py-2 text-right font-mono text-[#a3a3a3]">{n1(a.hn)}</td>
                <td className={`px-4 py-2 text-right font-mono ${a.he > 0 ? 'text-[#f97316] font-semibold' : 'text-[#6b6b6b]'}`}>
                  {n1(a.he)}
                </td>
              </tr>
            ))}
            {apurado.length === 0 && !carregando && !tabelaAusente && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#6b6b6b]">
                  {linhas.length === 0
                    ? 'Nenhuma presença lançada neste período — as horas vêm do RDO do dia.'
                    : 'Nenhum resultado para esta busca.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-[#6b6b6b] flex items-center gap-1.5">
        <Clock size={12} />
        As horas vêm da lista de presença do RDO. Para corrigir, ajuste o RDO do dia — aqui é só apuração.
      </p>
    </div>
  )
}

export default HorasExtrasPanel
