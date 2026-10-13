/**
 * ConvitesPanel — e-mails autorizados que ainda não viraram conta.
 *
 * Convite aqui não é e-mail enviado: é uma autorização prévia guardada no
 * banco. Quando a pessoa aparecer no Auth (primeiro login), o trigger
 * handle_new_user_v2 cria o profile e aplica o vínculo sozinho.
 */
import { Mail, Plus, ShieldAlert } from 'lucide-react'
import type { UseUsuariosReturn } from '@/hooks/useUsuarios'
import { ROLE_META } from '@/hooks/useUsuarios'
import { btnPrimario, cardCls, formatarData, ROLE_BADGE, thCls } from './ui'

interface Props {
  dados: UseUsuariosReturn
  onAdicionar: () => void
}

export function ConvitesPanel({ dados, onAdicionar }: Props) {
  const vazio = dados.convites.length === 0

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-[#a3a3a3] text-xs leading-relaxed max-w-2xl">
          Estes e-mails estão autorizados, mas ainda não têm conta. Nada foi enviado por e-mail — avise a pessoa
          para entrar no ConstruData com esse endereço; no primeiro acesso a conta é criada já vinculada à
          empresa e ao papel abaixo.
        </p>
        <button onClick={onAdicionar} className={`${btnPrimario} flex items-center gap-1.5 shrink-0`}>
          <Plus size={14} /> Adicionar pessoa
        </button>
      </div>

      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#525252]/50">
                <th className={thCls}>E-mail</th>
                <th className={thCls}>Nome</th>
                <th className={thCls}>Empresa</th>
                <th className={thCls}>Papel</th>
                <th className={thCls}>Autorizado em</th>
              </tr>
            </thead>
            <tbody>
              {dados.convites.map((c) => {
                const quando = formatarData(c.criadoEm)
                return (
                  <tr key={`${c.email}:${c.orgId}`} className="border-b border-[#525252]/30 hover:bg-[#484848]/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Mail size={13} className="text-[#6b6b6b] shrink-0" />
                        <span className="text-[#f5f5f5] font-mono text-xs break-all">{c.email}</span>
                        {c.isGlobalAdmin && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-[#f97316]/15 text-[#fdba74] border border-[#f97316]/40"
                            title="Vai nascer como administrador global"
                          >
                            <ShieldAlert size={10} />
                            ADMIN GLOBAL
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[#a3a3a3] text-xs">{c.nome ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[#a3a3a3] text-xs">{c.orgNome}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ROLE_BADGE[c.role]}`}>
                        {ROLE_META[c.role].label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {quando ? (
                        <span className="text-[#a3a3a3] font-mono">{quando}</span>
                      ) : (
                        <span className="text-[#6b6b6b]">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {vazio && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#6b6b6b] text-sm italic">
                    {dados.loading
                      ? 'Carregando…'
                      : dados.funcaoAusente || dados.semSupabase
                        ? 'Sem lista: a função admin-usuarios não respondeu.'
                        : 'Nenhum convite pendente.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
