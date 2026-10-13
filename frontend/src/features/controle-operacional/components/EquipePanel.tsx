/**
 * EquipePanel — aba 08. Quem está em qual equipe NESTE contrato, os vencimentos
 * (ASO, NRs, CNH) e o CUSTO da folha — agregado. Salário individual não aparece aqui
 * (nem para admin): o cadastro de pessoas e a remuneração moram no RH.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, CalendarClock, Wallet, AlertTriangle } from 'lucide-react'
import type { ContextoCalculo } from '../dominio/calculos'
import { alertaPessoa } from '../dominio/calculos'
import { TIPOS_VENCIMENTO, type OpEquipeMembro, type TipoVencimento } from '../dominio/tipos'
import { TELAS } from '../dominio/telas'
import { dataBR } from '../dominio/datas'
import { TelaCrud } from './TelaCrud'
import { salvarVencimentos } from './gravacoesCompostas'
import { brl, btnMini, btnNeutro, btnPrimario, cardCls, corSituacao, inputCls, pct } from './ui'

function EditorVencimentos({ membro, ctx, onFechar }: { membro: OpEquipeMembro; ctx: ContextoCalculo; onFechar: (gravou: boolean) => void }) {
  const existentes = ctx.dados.vencimentos.filter((v) => v.pessoa_id === membro.pessoa_id && !v.deleted_at)
  const [datas, setDatas] = useState<Partial<Record<TipoVencimento, string>>>(() =>
    Object.fromEntries(TIPOS_VENCIMENTO.map((t) => [t, existentes.find((v) => v.tipo === t)?.vence_em ?? ''])))
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  async function gravar() {
    setSalvando(true)
    const e = await salvarVencimentos(membro.pessoa_id, datas, new Set(existentes.map((v) => v.tipo)))
    setSalvando(false)
    if (e) setErro(e); else onFechar(true)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-md p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#f5f5f5]">Vencimentos — {membro.pessoa_nome ?? membro.matricula}</h2>
        {TIPOS_VENCIMENTO.map((t) => (
          <label key={t} className="flex items-center gap-3">
            <span className="w-16 text-xs text-sky-300">{t}</span>
            <input type="date" className={inputCls} value={datas[t] ?? ''} onChange={(e) => setDatas((s) => ({ ...s, [t]: e.target.value }))} />
          </label>
        ))}
        {erro && <p className="text-xs text-red-300">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button className={btnNeutro} onClick={() => onFechar(false)}>Cancelar</button>
          <button className={btnPrimario} disabled={salvando} onClick={() => void gravar()}>{salvando ? 'Gravando…' : 'Gravar'}</button>
        </div>
      </div>
    </div>
  )
}

export function EquipePanel({ ctx, projetoId, recarregar, folhaIndisponivel }: {
  ctx: ContextoCalculo; projetoId: string; recarregar: () => Promise<void>; folhaIndisponivel: string | null
}) {
  const [vencDe, setVencDe] = useState<OpEquipeMembro | null>(null)
  const porPessoa = useMemo(() => {
    const m = new Map<string, typeof ctx.dados.vencimentos>()
    for (const v of ctx.dados.vencimentos) if (!v.deleted_at) m.set(v.pessoa_id, [...(m.get(v.pessoa_id) ?? []), v])
    return m
  }, [ctx.dados.vencimentos])
  const f = ctx.folha

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`${cardCls} p-4`}>
          <div className="flex items-center gap-2 text-xs text-[#a3a3a3]"><Wallet size={13} /> Folha do mês (agregada)</div>
          <div className="font-mono text-xl text-[#f5f5f5]">{brl(f.valor)}</div>
          <div className="text-xs text-[#a3a3a3]">{f.n_ativos} ativo(s) · {f.n_com_salario ?? '—'} com salário informado</div>
          {!!f.n_sem_salario && <div className="text-xs text-amber-200 mt-1">{f.n_sem_salario} ativo(s) sem salário informado — o custo real é maior</div>}
          {folhaIndisponivel && <div className="text-xs text-amber-200 mt-1">{folhaIndisponivel}</div>}
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-[#a3a3a3]">Custo por equipe/dia</div>
          <div className="font-mono text-xl text-[#f5f5f5]">{brl(ctx.metas.custo_equipe_dia)}</div>
          <div className="text-xs text-[#a3a3a3]">{ctx.metas.n_equipes} equipe(s) com gente ativa · encargos {pct(ctx.p?.fator_encargos)}</div>
        </div>
        <div className={`${cardCls} p-4 flex flex-col justify-between`}>
          <div className="text-xs text-[#a3a3a3]">Cadastro, cargos e salários ficam no RH</div>
          <Link to="/app/recursos-humanos?aba=pessoal" className={`${btnNeutro} mt-2 w-fit`}><ExternalLink size={13} /> Abrir Recursos Humanos</Link>
        </div>
      </div>

      <TelaCrud
        tela={TELAS.equipe} ctx={ctx} projetoId={projetoId} recarregar={recarregar} podeCriar={false}
        topo={<span className="text-xs text-[#a3a3a3]">pessoas entram pela planilha (aba 08) ou pelo RH</span>}
        acoes={(l) => {
          const m = l as unknown as OpEquipeMembro
          const alerta = alertaPessoa(porPessoa.get(m.pessoa_id) ?? [], ctx.hoje)
          const docs = (porPessoa.get(m.pessoa_id) ?? []).filter((v) => v.vence_em).map((v) => `${v.tipo} ${dataBR(v.vence_em)}`).join(' · ')
          return (
            <>
              <span className="text-xs text-[#f5f5f5] mr-2 max-w-[160px] truncate" title={m.pessoa_nome ?? ''}>{m.pessoa_nome ?? '(sem nome)'}</span>
              <span className={`text-xs mr-2 ${corSituacao(alerta)}`} title={docs || 'nenhum vencimento informado'}>
                {alerta !== 'OK' && <AlertTriangle size={11} className="inline mr-1" />}{docs ? alerta : 'sem vencimentos'}
              </span>
              <button className={btnMini} onClick={() => setVencDe(m)} title="vencimentos"><CalendarClock size={12} /></button>
            </>
          )
        }}
      />
      {vencDe && <EditorVencimentos membro={vencDe} ctx={ctx} onFechar={(g) => { setVencDe(null); if (g) void recarregar() }} />}
    </div>
  )
}
