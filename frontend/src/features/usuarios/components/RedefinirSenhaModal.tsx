/**
 * RedefinirSenhaModal — reset administrativo de senha (ação 'senha' da Edge
 * Function). A senha nova aparece uma vez, para ser entregue à pessoa por
 * fora do sistema; o ConstruData não envia e-mail nem guarda esse texto.
 */
import { useState } from 'react'
import { Check, Copy, KeyRound, X } from 'lucide-react'
import type { UsuarioAcesso } from '@/hooks/useUsuarios'
import { avaliarSenha } from '../utils/senha'
import { CampoSenha } from './CampoSenha'
import { btnPrimario, btnSecundario, copiar, modalBoxCls, modalOverlayCls } from './ui'

interface Props {
  usuario: UsuarioAcesso
  onConfirmar: (novaSenha: string) => Promise<{ ok: boolean; erro?: string }>
  onClose: () => void
}

export function RedefinirSenhaModal({ usuario, onConfirmar, onClose }: Props) {
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const senhaOk = senha.length >= 8 && avaliarSenha(senha) !== 'curta'

  async function confirmar() {
    if (!senhaOk) {
      setErro('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    setEnviando(true)
    setErro(null)
    const r = await onConfirmar(senha)
    setEnviando(false)
    if (r.ok) setPronto(true)
    else setErro(r.erro ?? 'Não foi possível redefinir a senha.')
  }

  async function copiarCredenciais() {
    const ok = await copiar(`E-mail: ${usuario.email}\nSenha temporária: ${senha}`)
    setCopiado(ok)
    if (ok) window.setTimeout(() => setCopiado(false), 1800)
  }

  return (
    <div className={modalOverlayCls} onClick={onClose}>
      <div className={`${modalBoxCls} w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#525252]">
          <div className="flex items-center gap-2.5">
            <KeyRound size={16} className="text-[#f97316]" />
            <p className="text-[#f5f5f5] text-sm font-semibold">Redefinir senha</p>
          </div>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
            <X size={18} />
          </button>
        </div>

        {pronto ? (
          <div className="px-5 py-5 space-y-3">
            <p className="text-[#22c55e] text-sm font-semibold">Senha trocada.</p>
            <div className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-3 space-y-1">
              <p className="text-[#a3a3a3] text-xs">E-mail</p>
              <p className="text-[#f5f5f5] text-sm font-mono break-all">{usuario.email}</p>
              <p className="text-[#a3a3a3] text-xs pt-2">Senha temporária</p>
              <p className="text-[#f5f5f5] text-sm font-mono break-all">{senha}</p>
            </div>
            <p className="text-[#f97316] text-xs leading-relaxed">
              Copie agora: ao fechar esta janela a senha some da tela e não tem como consultar depois.
              Entregue a senha à pessoa por fora (WhatsApp, telefone, pessoalmente) e peça para ela trocar
              no primeiro acesso.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={copiarCredenciais} className={`${btnSecundario} flex items-center gap-1.5`}>
                {copiado ? <Check size={14} className="text-[#22c55e]" /> : <Copy size={14} />}
                {copiado ? 'Copiado' : 'Copiar e-mail e senha'}
              </button>
              <button onClick={onClose} className={btnPrimario}>
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 space-y-3">
              <p className="text-[#a3a3a3] text-xs leading-relaxed">
                Definir uma senha nova para{' '}
                <span className="text-[#f5f5f5] font-semibold">{usuario.nome ?? usuario.email}</span>{' '}
                <span className="font-mono">({usuario.email})</span>. A pessoa entra com ela e deve trocar
                depois — o sistema não manda e-mail de redefinição.
              </p>
              <CampoSenha valor={senha} onChange={setSenha} autoFocus />
              {erro && <p className="text-red-300 text-xs leading-relaxed">{erro}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#525252]">
              <button onClick={onClose} className={btnSecundario} disabled={enviando}>
                Cancelar
              </button>
              <button onClick={confirmar} className={btnPrimario} disabled={enviando || !senhaOk}>
                {enviando ? 'Trocando…' : 'Trocar senha'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
