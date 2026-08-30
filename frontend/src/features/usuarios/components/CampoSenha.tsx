/**
 * CampoSenha — input de senha temporária com gerador forte, botão de copiar,
 * mostrar/ocultar e leitura de força. Usado no modal de criar pessoa e no de
 * redefinir senha.
 *
 * A senha só existe aqui e na chamada à Edge Function — a tela nunca grava
 * nada no navegador nem manda a senha para outro lugar.
 */
import { useState } from 'react'
import { Check, Copy, Eye, EyeOff, Sparkles } from 'lucide-react'
import { avaliarSenha, gerarSenhaForte, type ForcaSenha } from '../utils/senha'
import { copiar, inputCls } from './ui'

const FORCA_META: Record<ForcaSenha, { texto: string; cor: string }> = {
  curta: { texto: 'curta demais (mínimo 8)', cor: '#ef4444' },
  fraca: { texto: 'fraca — misture maiúscula, número e símbolo', cor: '#f97316' },
  boa: { texto: 'boa', cor: '#eab308' },
  forte: { texto: 'forte', cor: '#22c55e' },
}

interface Props {
  valor: string
  onChange: (v: string) => void
  autoFocus?: boolean
  id?: string
}

export function CampoSenha({ valor, onChange, autoFocus, id }: Props) {
  const [visivel, setVisivel] = useState(true)
  const [copiado, setCopiado] = useState(false)
  const forca = valor ? avaliarSenha(valor) : null

  async function copiarSenha() {
    if (!valor) return
    const ok = await copiar(valor)
    setCopiado(ok)
    if (ok) window.setTimeout(() => setCopiado(false), 1800)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type={visivel ? 'text' : 'password'}
          value={valor}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Senha temporária"
          autoComplete="new-password"
          spellCheck={false}
          className={`${inputCls} font-mono`}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          title={visivel ? 'Ocultar' : 'Mostrar'}
          className="shrink-0 p-2 rounded-lg bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
        >
          {visivel ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <button
          type="button"
          onClick={() => onChange(gerarSenhaForte(14))}
          title="Gerar senha forte"
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
        >
          <Sparkles size={14} />
          Gerar
        </button>
        <button
          type="button"
          onClick={copiarSenha}
          disabled={!valor}
          title="Copiar senha"
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors disabled:opacity-40"
        >
          {copiado ? <Check size={14} className="text-[#22c55e]" /> : <Copy size={14} />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      {forca && (
        <p className="text-[11px]" style={{ color: FORCA_META[forca].cor }}>
          Senha {FORCA_META[forca].texto}
        </p>
      )}
    </div>
  )
}
