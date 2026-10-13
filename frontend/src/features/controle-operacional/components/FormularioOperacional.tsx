/**
 * FormularioOperacional — o formulário genérico de uma tela, montado só a partir de telas.ts.
 * Campo em branco grava NULL ("não informado"). Nunca 0.
 */
import { useState } from 'react'
import { X, Save, AlertTriangle, Info } from 'lucide-react'
import type { DadosOp } from '../dominio/tipos'
import { converterEntrada, opcoesDoCampo, paraEntrada, type CampoTela, type Tela } from '../dominio/telas'
import { btnNeutro, btnPrimario, inputCls } from './ui'

export interface FormularioOperacionalProps {
  tela: Tela
  dados: DadosOp
  inicial: Record<string, unknown> | null
  salvando: boolean
  erro: string | null
  titulo?: string
  aviso?: string | null
  onSalvar: (valores: Record<string, unknown>) => void
  onCancelar: () => void
}

function Entrada({ campo, valor, onChange, dados }: { campo: CampoTela; valor: string; onChange: (v: string) => void; dados: DadosOp }) {
  const opcoes = opcoesDoCampo(campo.tipo, dados)
  if (campo.tipo === 'data') return <input type="date" className={inputCls} value={valor} onChange={(e) => onChange(e.target.value)} />
  if (campo.tipo === 'hora') return <input type="time" className={inputCls} value={valor} onChange={(e) => onChange(e.target.value)} />
  if (campo.tipo === 'memo') return <textarea rows={3} className={inputCls} value={valor} onChange={(e) => onChange(e.target.value)} />
  if (campo.tipo === 'numero') return <input inputMode="decimal" className={`${inputCls} font-mono`} value={valor} onChange={(e) => onChange(e.target.value)} placeholder="em branco = não informado" />
  // menu sem lista cadastrada (ou de pessoa): texto livre com sugestões
  if (campo.tipo === 'pessoa' || (campo.tipo.startsWith('menu:') && (opcoes?.length ?? 0) === 0)) {
    const lista = `lista-${campo.campo}`
    return (
      <>
        <input className={inputCls} value={valor} list={lista} onChange={(e) => onChange(e.target.value)} />
        <datalist id={lista}>{(opcoes ?? []).map((o) => <option key={o.valor} value={o.valor} />)}</datalist>
      </>
    )
  }
  if (opcoes) {
    const temValor = valor === '' || opcoes.some((o) => o.valor === valor)
    return (
      <select className={inputCls} value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">— não informado —</option>
        {!temValor && <option value={valor}>{valor} (fora da lista)</option>}
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
    )
  }
  return <input className={inputCls} value={valor} onChange={(e) => onChange(e.target.value)} />
}

export function FormularioOperacional({ tela, dados, inicial, salvando, erro, titulo, aviso, onSalvar, onCancelar }: FormularioOperacionalProps) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(tela.campos.map((c) => [c.campo, paraEntrada(inicial?.[c.campo], c.tipo)])))
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({})

  function enviar() {
    const out: Record<string, unknown> = {}
    const errs: Record<string, string> = {}
    for (const c of tela.campos) {
      const r = converterEntrada(valores[c.campo] ?? '', c.tipo)
      if ('erro' in r) { errs[c.campo] = r.erro; continue }
      if (c.obrigatorio && (r.valor === null || r.valor === undefined)) { errs[c.campo] = 'obrigatório'; continue }
      out[c.campo] = r.valor
    }
    setErrosCampo(errs)
    if (Object.keys(errs).length === 0) onSalvar(out)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-3xl shadow-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <h2 className="text-sm font-semibold text-[#f5f5f5]">{titulo ?? `${inicial ? 'Editar' : 'Novo'} — ${tela.titulo}`}</h2>
          <button onClick={onCancelar} className="text-[#a3a3a3] hover:text-[#f5f5f5]"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="flex items-start gap-2 text-xs text-[#a3a3a3]"><Info size={13} className="mt-0.5 shrink-0" /> {tela.guia}</p>
          {aviso && <p className="flex items-start gap-2 text-xs text-amber-200"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {aviso}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tela.campos.map((c) => (
              <label key={c.campo} className={`block ${c.tipo === 'memo' ? 'md:col-span-2' : ''}`}>
                <span className="block text-xs text-sky-300 mb-1">{c.rotulo}{c.obrigatorio && <span className="text-[#f97316]"> *</span>}</span>
                <Entrada campo={c} dados={dados} valor={valores[c.campo] ?? ''} onChange={(v) => setValores((s) => ({ ...s, [c.campo]: v }))} />
                {errosCampo[c.campo] && <span className="block text-xs text-red-300 mt-1">{errosCampo[c.campo]}</span>}
              </label>
            ))}
          </div>
          {erro && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#525252]">
          <button className={btnNeutro} onClick={onCancelar}>Cancelar</button>
          <button className={btnPrimario} disabled={salvando} onClick={enviar}><Save size={14} /> {salvando ? 'Gravando…' : 'Gravar'}</button>
        </div>
      </div>
    </div>
  )
}
