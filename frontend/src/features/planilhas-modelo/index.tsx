import { useMemo, useState } from 'react'
import { FileSpreadsheet, Search, RotateCcw, Layers } from 'lucide-react'
import {
  useSupabasePlanilhasModelo,
  type AbaModelo,
  type CategoriaPlanilha,
  type PlanilhaModelo,
} from '@/hooks/useSupabasePlanilhasModelo'

const CATEGORIA_META: Record<CategoriaPlanilha, { label: string; cor: string }> = {
  planejamento: { label: 'Planejamento', cor: '#38bdf8' },
  diario: { label: 'Diário', cor: '#a78bfa' },
  'controle-producao': { label: 'Controle de Produção', cor: '#22c55e' },
  orcamento: { label: 'Orçamento', cor: '#f97316' },
  estrutura: { label: 'Estrutura', cor: '#eab308' },
}

const CATEGORIA_ORDEM: CategoriaPlanilha[] = ['planejamento', 'diario', 'controle-producao', 'orcamento', 'estrutura']

function celula(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
  return String(v)
}

function filtraLinhas(linhas: unknown[][], termo: string): unknown[][] {
  if (!termo.trim()) return linhas
  const alvo = termo.trim().toLowerCase()
  return linhas.filter((linha) =>
    (linha ?? []).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(alvo)),
  )
}

function nomeCurto(fonte: string | null): string {
  if (!fonte) return '—'
  const partes = fonte.split(/[\\/]/)
  return partes[partes.length - 1] ?? fonte
}

export function PlanilhasModeloPage() {
  const { porCategoria, loading, error, reload } = useSupabasePlanilhasModelo()
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaPlanilha | null>(null)
  const [planilhaAtiva, setPlanilhaAtiva] = useState<string | null>(null)
  const [abaAtiva, setAbaAtiva] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const categoriasDisponiveis = useMemo(
    () => CATEGORIA_ORDEM.filter((c) => (porCategoria[c]?.length ?? 0) > 0),
    [porCategoria],
  )

  const categoriaEfetiva = categoriaAtiva && porCategoria[categoriaAtiva]?.length ? categoriaAtiva : categoriasDisponiveis[0] ?? null

  const planilhasDaCategoria: PlanilhaModelo[] = (categoriaEfetiva && porCategoria[categoriaEfetiva]) || []

  const planilhaSelecionada: PlanilhaModelo | undefined =
    planilhasDaCategoria.find((p) => p.planilha === planilhaAtiva) ?? planilhasDaCategoria[0]

  const abaSelecionada: AbaModelo | undefined =
    planilhaSelecionada?.abas.find((a) => a.aba === abaAtiva) ?? planilhaSelecionada?.abas[0]

  const linhasFiltradas = useMemo(
    () => filtraLinhas(abaSelecionada?.linhas ?? [], busca),
    [abaSelecionada, busca],
  )

  const maxColunas = useMemo(() => {
    const headersLen = abaSelecionada?.headers?.length ?? 0
    const linhasLen = (abaSelecionada?.linhas ?? []).reduce((max, l) => Math.max(max, (l ?? []).length), 0)
    return Math.max(headersLen, linhasLen, 1)
  }, [abaSelecionada])

  function selecionarPlanilha(cat: CategoriaPlanilha, planilha: string) {
    setCategoriaAtiva(cat)
    setPlanilhaAtiva(planilha)
    setAbaAtiva(null)
    setBusca('')
  }

  return (
    <div className="h-full flex flex-col bg-[#2a2a2a] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252] bg-[#333333] shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#38bdf8]/15">
            <FileSpreadsheet size={18} className="text-[#38bdf8]" />
          </div>
          <div>
            <h1 className="text-[#f5f5f5] font-bold text-base leading-tight">Planilhas (Modelos)</h1>
            <p className="text-[#6b6b6b] text-xs">Acervo do contrato — espelho read-only das planilhas reais WCR</p>
          </div>
        </div>
        <button onClick={reload} className="flex items-center gap-1.5 text-[11px] text-[#8a8a8a] hover:text-[#f5f5f5] px-3 py-2 rounded-md border border-[#3f3f3f] hover:border-[#525252]">
          <RotateCcw size={12} /> Atualizar
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Coluna esquerda: categorias -> planilhas */}
        <aside className="w-64 shrink-0 border-r border-[#3f3f3f] bg-[#2f2f2f] overflow-y-auto">
          {loading && <div className="text-[11px] text-[#8a8a8a] px-4 py-6 text-center">Carregando…</div>}
          {error && <div className="text-[11px] text-[#ef4444] px-4 py-6 text-center">Erro: {error}</div>}
          {!loading && !error && categoriasDisponiveis.length === 0 && (
            <div className="text-[11px] text-[#6b6b6b] px-4 py-6 text-center">Nenhuma planilha-modelo carregada.</div>
          )}
          {categoriasDisponiveis.map((cat) => {
            const meta = CATEGORIA_META[cat]
            const planilhas = porCategoria[cat] ?? []
            const aberta = cat === categoriaEfetiva
            return (
              <div key={cat} className="border-b border-[#3f3f3f]">
                <button
                  onClick={() => { setCategoriaAtiva(cat); setPlanilhaAtiva(null); setAbaAtiva(null); setBusca('') }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.cor }} />
                  <span className={['text-[11px] font-bold uppercase tracking-wide', aberta ? 'text-[#f5f5f5]' : 'text-[#a3a3a3]'].join(' ')}>
                    {meta.label}
                  </span>
                  <span className="ml-auto text-[10px] text-[#6b6b6b]">{planilhas.length}</span>
                </button>
                {aberta && (
                  <div className="pb-1">
                    {planilhas.map((p) => {
                      const ativa = p.planilha === planilhaSelecionada?.planilha
                      return (
                        <button
                          key={p.planilha}
                          onClick={() => selecionarPlanilha(cat, p.planilha)}
                          className={[
                            'w-full text-left flex items-center gap-2 pl-8 pr-3 py-1.5 text-[11.5px] transition-colors',
                            ativa ? 'text-[#f5f5f5] bg-[#3f3f3f]' : 'text-[#8a8a8a] hover:text-[#f5f5f5] hover:bg-[#353535]',
                          ].join(' ')}
                          title={p.planilha}
                        >
                          <Layers size={11} className="shrink-0 opacity-70" />
                          <span className="truncate">{p.planilha}</span>
                          <span className="ml-auto text-[9px] text-[#6b6b6b] shrink-0">{p.abas.length}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </aside>

        {/* Conteúdo */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!planilhaSelecionada ? (
            <div className="flex-1 flex items-center justify-center text-[12px] text-[#6b6b6b]">
              {loading ? 'Carregando planilhas…' : 'Selecione uma planilha à esquerda.'}
            </div>
          ) : (
            <>
              {/* Badge MODELO + chips de abas */}
              <div className="px-6 pt-4 pb-3 border-b border-[#3f3f3f] bg-[#2f2f2f] shrink-0">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#f97316] bg-[#f97316]/10 border border-[#f97316]/30 rounded px-2 py-1">
                    MODELO — somente leitura
                  </span>
                  <span className="text-[11px] text-[#a3a3a3]">
                    fonte: <span className="text-[#f5f5f5] font-mono">{nomeCurto(planilhaSelecionada.fonteArquivo)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {planilhaSelecionada.abas.map((a) => {
                    const ativa = a.aba === (abaSelecionada?.aba ?? planilhaSelecionada.abas[0]?.aba)
                    return (
                      <button
                        key={a.aba}
                        onClick={() => { setAbaAtiva(a.aba); setBusca('') }}
                        className={[
                          'text-[11px] px-3 py-1.5 rounded-md border transition-colors',
                          ativa ? 'border-[#38bdf8] text-[#38bdf8] bg-[#38bdf8]/10' : 'border-[#3f3f3f] text-[#8a8a8a] hover:text-[#f5f5f5]',
                        ].join(' ')}
                      >
                        {a.aba}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Busca */}
              <div className="px-6 py-3 border-b border-[#3f3f3f] shrink-0">
                <div className="relative max-w-sm">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar em todas as células…"
                    className="w-full bg-[#3f3f3f] text-[#f5f5f5] placeholder:text-[#6b6b6b] text-[11.5px] rounded-md pl-8 pr-3 py-2 border border-[#525252] focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div className="text-[10px] text-[#6b6b6b] mt-1.5">
                  {linhasFiltradas.length} linha(s) {busca.trim() ? `filtradas de ${abaSelecionada?.linhas.length ?? 0}` : 'no total'}
                </div>
              </div>

              {/* Tabela */}
              <div className="flex-1 overflow-auto px-6 py-4">
                <table className="min-w-full border-collapse text-[11px]">
                  <thead>
                    <tr>
                      {Array.from({ length: maxColunas }).map((_, colIdx) => (
                        <th
                          key={colIdx}
                          className="sticky top-0 z-10 bg-[#3f3f3f] text-[#f5f5f5] text-left font-bold uppercase tracking-wide px-3 py-2 border-b border-[#525252] whitespace-nowrap"
                        >
                          {abaSelecionada?.headers?.[colIdx] || `col ${colIdx + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhasFiltradas.map((linha, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[#2f2f2f]' : 'bg-[#333333]'}>
                        {Array.from({ length: maxColunas }).map((_, colIdx) => (
                          <td key={colIdx} className="px-3 py-1.5 border-b border-[#3f3f3f] text-[#a3a3a3] whitespace-nowrap">
                            {celula(linha?.[colIdx])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {linhasFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={maxColunas} className="px-3 py-8 text-center text-[#6b6b6b]">
                          Nenhuma linha encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
