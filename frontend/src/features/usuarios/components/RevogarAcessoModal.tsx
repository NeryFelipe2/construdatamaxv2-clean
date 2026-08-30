/**
 * RevogarAcessoModal — confirmação explícita de revogação de acesso.
 * Deixa claro que a pessoa NÃO é apagada: só perde o acesso àquela empresa
 * (o vínculo vira ativo = false e pode ser devolvido depois).
 */
import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import type { UsuarioAcesso, VinculoOrg } from '@/hooks/useUsuarios'
import { btnPerigo, btnSecundario, modalBoxCls, modalOverlayCls } from './ui'

interface Props {
  usuario: UsuarioAcesso
  vinculo: VinculoOrg
  onConfirmar: () => Promise<{ ok: boolean; erro?: string }>
  onClose: () => void
}

export function RevogarAcessoModal({ usuario, vinculo, onConfirmar, onClose }: Props) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function confirmar() {
    setEnviando(true)
    setErro(null)
    const r = await onConfirmar()
    setEnviando(false)
    if (r.ok) onClose()
    else setErro(r.erro ?? 'Não foi possível revogar o acesso.')
  }

  return (
    <div className={modalOverlayCls} onClick={onClose}>
      <div className={`${modalBoxCls} w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#525252]">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={16} className="text-[#f97316]" />
            <p className="text-[#f5f5f5] text-sm font-semibold">Revogar acesso</p>
          </div>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-[#f5f5f5] text-sm leading-relaxed">
            Tirar o acesso de <span className="font-semibold">{usuario.nome ?? usuario.email}</span> à empresa{' '}
            <span className="font-semibold">{vinculo.orgNome}</span>?
          </p>
          <div className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2.5 space-y-1.5">
            <p className="text-[#a3a3a3] text-xs leading-relaxed">
              A conta <span className="font-mono text-[#f5f5f5]">{usuario.email}</span>{' '}
              <span className="text-[#f5f5f5]">não é apagada</span>. Ela continua existindo, com o histórico
              intacto — só deixa de enxergar os dados desta empresa.
            </p>
            {usuario.orgs.filter((o) => o.ativo).length <= 1 && (
              <p className="text-[#f97316] text-xs leading-relaxed">
                Esta é a última empresa da pessoa: ao entrar, ela vai cair na tela “sua conta não está vinculada
                a nenhuma empresa”.
              </p>
            )}
          </div>
          {erro && <p className="text-red-300 text-xs leading-relaxed">{erro}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#525252]">
          <button onClick={onClose} className={btnSecundario} disabled={enviando}>
            Cancelar
          </button>
          <button onClick={confirmar} className={btnPerigo} disabled={enviando}>
            {enviando ? 'Revogando…' : 'Revogar acesso'}
          </button>
        </div>
      </div>
    </div>
  )
}
