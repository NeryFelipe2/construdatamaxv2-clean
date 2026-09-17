/**
 * TelaCrud — uma aba inteira (busca + tabela + formulário) dirigida por telas.ts.
 * Grava com useOpCrud; telas que gravam em duas tabelas passam `gravar` próprio.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Plus, Search, Info, AlertTriangle } from 'lucide-react'
import { useOpCrud } from '@/hooks/useOpCrud'
import type { ContextoCalculo } from '../dominio/calculos'
import { linhasDaTela, normalizarValores, type LinhaTela, type Tela } from '../dominio/telas'
import { normChave } from '../dominio/normalizar'
import { TabelaOperacional } from './TabelaOperacional'
import { FormularioOperacional } from './FormularioOperacional'
import { btnPrimario, inputCls } from './ui'

export interface GravacaoPropria {
  salvar: (valores: Record<string, unknown>, existente: LinhaTela | null) => Promise<string | null>
  excluir: (linha: LinhaTela) => Promise<string | null>
}

export interface TelaCrudProps {
  tela: Tela
  ctx: ContextoCalculo
  projetoId: string
  recarregar: () => Promise<void>
  gravar?: GravacaoPropria
  podeCriar?: boolean
  podeExcluir?: boolean
  acoes?: (l: LinhaTela, calc: Record<string, unknown>) => ReactNode
  topo?: ReactNode
  /** filtra as linhas antes da busca (ex.: ocorrências só da obra) */
  filtro?: (l: LinhaTela) => boolean
}

export function TelaCrud({ tela, ctx, projetoId, recarregar, gravar, podeCriar = true, podeExcluir = true, acoes, topo, filtro }: TelaCrudProps) {
  const crud = useOpCrud()
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<LinhaTela | null | 'novo'>(null)
  const [erroProprio, setErroProprio] = useState<string | null>(null)
  const [salvandoProprio, setSalvandoProprio] = useState(false)

  const codigo = useMemo(() => new Map(ctx.dados.servicos.map((s) => [s.id, s.codigo])), [ctx.dados.servicos])
  const linhas = useMemo(() => {
    const todas = linhasDaTela(tela, ctx.dados).filter((l) => (filtro ? filtro(l) : true))
    const q = normChave(busca)
    if (!q) return todas
    return todas.filter((l) => normChave(tela.campos.map((c) => {
      const v = l[c.campo]
      return c.tipo === 'servico' ? codigo.get(String(v)) ?? '' : v ?? ''
    }).join(' ')).includes(q))
  }, [tela, ctx.dados, busca, filtro, codigo])

  async function salvar(brutos: Record<string, unknown>) {
    const existente = editando === 'novo' ? null : editando
    const valores = normalizarValores(tela.id, brutos)
    if (gravar) {
      setSalvandoProprio(true); setErroProprio(null)
      const e = await gravar.salvar(valores, existente)
      setSalvandoProprio(false)
      if (e) { setErroProprio(e); return }
    } else if (tela.tabela) {
      const ok = existente
        ? await crud.atualizar(tela.tabela, tela.pk, existente.id, valores)
        : !!(await crud.criar(tela.tabela, { ...valores, projeto_id: projetoId }))
      if (!ok) return
    }
    setEditando(null)
    await recarregar()
  }

  async function excluir(l: LinhaTela) {
    if (!window.confirm('Excluir este registro? Ele sai da tela, fica no histórico de auditoria e a planilha não o traz de volta.')) return
    if (gravar) {
      const e = await gravar.excluir(l)
      if (e) { window.alert(e); return }
    } else if (tela.tabela) {
      if (!(await crud.excluir(tela.tabela, tela.pk, l.id))) return
    }
    await recarregar()
  }

  const podeGravar = !!gravar || !!tela.tabela

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input className={`${inputCls} pl-8`} placeholder="buscar nesta aba…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <span className="text-xs text-[#a3a3a3]">{linhas.length} linha(s)</span>
        <div className="flex-1" />
        {topo}
        {podeGravar && podeCriar && (
          <button className={btnPrimario} onClick={() => setEditando('novo')}><Plus size={14} /> Novo</button>
        )}
      </div>
      <p className="flex items-start gap-2 text-xs text-[#a3a3a3]"><Info size={13} className="mt-0.5 shrink-0" /> {tela.guia}</p>
      {crud.erro && !editando && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {crud.erro}
        </div>
      )}
      <TabelaOperacional
        tela={tela} linhas={linhas} ctx={ctx} acoes={acoes}
        onEditar={podeGravar ? (l) => setEditando(l) : undefined}
        onExcluir={podeGravar && podeExcluir ? (l) => void excluir(l) : undefined}
      />
      {editando && (
        <FormularioOperacional
          tela={tela} dados={ctx.dados}
          inicial={editando === 'novo' ? null : editando}
          salvando={crud.salvando || salvandoProprio}
          erro={crud.erro ?? erroProprio}
          onSalvar={(v) => void salvar(v)}
          onCancelar={() => { setEditando(null); crud.limparErro(); setErroProprio(null) }}
        />
      )}
    </div>
  )
}
