/**
 * BaixasZn — registro manual da série OFICIAL de baixas no app ZN (Sabesp).
 * Tabela data / acumulado / delta-do-dia / fonte + linha de inserção.
 * Acumulado informado MENOR que o último vira aviso amber (alerta honesto,
 * não bloqueia — pode ser correção legítima do ZN).
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, Trash2 } from 'lucide-react'
import type { BaixaZn } from '@/hooks/useMetaBaixas'

interface Props {
  baixas: BaixaZn[]
  ultima: BaixaZn | null
  alvo: number
  unidade: string
  error: string | null
  onSalvar: (data: string, acumulado: number, fonte?: string) => void
  onRemover: (id: string) => void
}

function hojeIso(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function fmtDdMm(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function fmtInt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

export function BaixasZn({ baixas, ultima, alvo, unidade, error, onSalvar, onRemover }: Props) {
  const [data, setData] = useState(hojeIso())
  const [acumulado, setAcumulado] = useState('')
  const [fonte, setFonte] = useState('')

  const valorDigitado = useMemo(() => {
    const n = Number(acumulado.replace(/[^\d]/g, ''))
    return Number.isFinite(n) && acumulado.trim() !== '' ? n : null
  }, [acumulado])

  const regrediu = valorDigitado !== null && ultima !== null && valorDigitado < ultima.acumulado

  const registrar = () => {
    if (valorDigitado === null || !data) return
    onSalvar(data, valorDigitado, fonte || undefined)
    setAcumulado('')
    setFonte('')
  }

  return (
    <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#20406a] flex items-center gap-2 flex-wrap">
        <ClipboardCheck size={16} className="text-emerald-400" />
        <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Baixas no App ZN (oficial)</h3>
        <span className="text-[10px] text-[#5a8caa]">acumulado oficial da Sabesp — informado manualmente, 1 registro por dia</span>
        {ultima && (
          <span className="ml-auto text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            última: {fmtInt(ultima.acumulado)} / {fmtInt(alvo)} {unidade} ({fmtDdMm(ultima.data)})
          </span>
        )}
      </div>

      {error && (
        <div className="mx-5 mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 flex items-start gap-2.5">
          <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <span className="text-[11px] text-amber-200/90">{error}</span>
        </div>
      )}

      {baixas.length === 0 ? (
        <div className="px-5 py-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <span className="text-xs text-amber-200/90 leading-relaxed">
              <b className="text-amber-300">Nenhuma baixa ZN registrada nesta campanha.</b> O número
              oficial da meta vem daqui — registre o acumulado do app ZN abaixo. Enquanto isso, a tela
              mostra só o apontamento de campo (e diz que é apontamento, não baixa).
            </span>
          </div>
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-[#0d2040] text-[#5a8caa] uppercase tracking-wider">
            <tr>
              <th className="text-left px-5 py-2.5">Data</th>
              <th className="text-right px-5 py-2.5">Acumulado ZN</th>
              <th className="text-right px-5 py-2.5">Δ do dia</th>
              <th className="text-left px-5 py-2.5">Fonte</th>
              <th className="text-right px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {[...baixas].reverse().map((b, i, arr) => {
              // arr está desc — o "anterior" cronológico é o próximo do array (0 no início da campanha)
              const anterior = i < arr.length - 1 ? arr[i + 1].acumulado : 0
              const delta = b.acumulado - anterior
              return (
                <tr key={b.id} className="border-t border-[#20406a]/50 hover:bg-[#14294e]">
                  <td className="px-5 py-2 font-medium text-[#e4f2f8]">{fmtDdMm(b.data)}</td>
                  <td className="px-5 py-2 text-right text-emerald-400 font-mono font-bold">{fmtInt(b.acumulado)}</td>
                  <td className={`px-5 py-2 text-right font-mono ${delta < 0 ? 'text-rose-400 font-bold' : 'text-[#8fb3c8]'}`}>
                    {delta >= 0 ? '+' : ''}{fmtInt(delta)}
                  </td>
                  <td className="px-5 py-2 text-left text-[#8fb3c8]">{b.fonte || <span className="text-[#3d5a75]">—</span>}</td>
                  <td className="px-5 py-2 text-right">
                    <button
                      onClick={() => onRemover(b.id)}
                      className="text-[#5a8caa] hover:text-rose-400 transition-colors"
                      title="Excluir este registro de baixa"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* linha de inserção */}
      <div className="px-5 py-3 border-t border-[#20406a] space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-xs bg-[#0d2040] border border-[#20406a] text-[#e4f2f8] outline-none focus:border-emerald-400/60"
          />
          <input
            type="text"
            inputMode="numeric"
            value={acumulado}
            onChange={(e) => setAcumulado(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') registrar() }}
            placeholder="Acumulado ZN…"
            className="w-36 rounded-lg px-3 py-1.5 text-xs text-right font-mono bg-[#0d2040] border border-[#20406a] text-emerald-300 outline-none focus:border-emerald-400/60"
          />
          <input
            type="text"
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') registrar() }}
            placeholder="Fonte (ex.: app ZN, e-mail Sabesp)…"
            className="flex-1 min-w-[160px] rounded-lg px-3 py-1.5 text-xs bg-[#0d2040] border border-[#20406a] text-[#e4f2f8] outline-none focus:border-emerald-400/60"
          />
          <button
            onClick={registrar}
            disabled={valorDigitado === null || !data}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-300 rounded-lg text-xs font-semibold hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-default"
          >
            <CheckCircle2 size={12} /> Registrar baixa
          </button>
        </div>
        {regrediu && ultima && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 flex items-start gap-2.5">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <span className="text-[11px] text-amber-200/90">
              <b className="text-amber-300">Atenção:</b> o acumulado digitado ({fmtInt(valorDigitado!)}) é MENOR
              que o último registrado ({fmtInt(ultima.acumulado)} em {fmtDdMm(ultima.data)}). Acumulado
              normalmente só cresce — confira antes de registrar. O registro não é bloqueado (pode ser
              correção legítima do ZN).
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
