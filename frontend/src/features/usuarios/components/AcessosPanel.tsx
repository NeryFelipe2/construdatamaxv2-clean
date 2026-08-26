/**
 * AcessosPanel — lista de quem tem acesso ao ConstruData.
 *
 * Uma linha por pessoa; dentro da coluna "Empresas & papel" cada vínculo tem
 * o seletor de papel (troca inline) e o botão de revogar. Vínculos revogados
 * continuam visíveis, apagados, para dar rastro do que foi tirado.
 *
 * Chama atenção para o caso que o João encontrou: conta sem NENHUMA empresa
 * ativa cai na tela "sua conta não está vinculada a nenhuma empresa" — a
 * linha fica marcada em laranja com o atalho para consertar.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, KeyRound, Plus, Search, ShieldAlert, UserPlus, X } from 'lucide-react'
import type { OrgRole, UsuarioAcesso, UseUsuariosReturn, VinculoOrg } from '@/hooks/useUsuarios'
import { ORG_ROLES, ROLE_META } from '@/hooks/useUsuarios'
import { cn } from '@/lib/utils'
import type { PrefillAcesso } from './AdicionarPessoaModal'
import { RedefinirSenhaModal } from './RedefinirSenhaModal'
import { RevogarAcessoModal } from './RevogarAcessoModal'
import { btnPrimario, cardCls, formatarData, inputCls, ROLE_BADGE, selectCls, thCls } from './ui'

interface Props {
  dados: UseUsuariosReturn
  onAdicionar: (prefill?: PrefillAcesso) => void
}

function BadgeGlobal() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-[#f97316]/15 text-[#fdba74] border border-[#f97316]/40"
      title="Enxerga e administra todas as empresas"
    >
      <ShieldAlert size={10} />
      ADMIN GLOBAL
    </span>
  )
}

function LinhaVinculo({
  vinculo,
  editavel,
  salvando,
  onPapel,
  onRevogar,
  onRestaurar,
}: {
  vinculo: VinculoOrg
  editavel: boolean
  salvando: boolean
  onPapel: (role: OrgRole) => void
  onRevogar: () => void
  onRestaurar: () => void
}) {
  if (!vinculo.ativo) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[#6b6b6b] text-xs line-through">{vinculo.orgNome}</span>
        <span className="text-[#6b6b6b] text-[10px]">acesso revogado</span>
        {editavel && (
          <button
            onClick={onRestaurar}
            className="text-[#f97316] text-[10px] hover:underline"
            title="Abre o cadastro já preenchido para devolver o acesso"
          >
            devolver acesso
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[#f5f5f5] text-xs">{vinculo.orgNome}</span>
      {editavel ? (
        <>
          <select
            value={vinculo.role}
            disabled={salvando}
            onChange={(e) => onPapel(e.target.value as OrgRole)}
            title={ROLE_META[vinculo.role].resumo}
            className={cn(selectCls, 'w-auto py-1 px-2 text-xs disabled:opacity-40')}
          >
            {ORG_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_META[r].label}</option>
            ))}
          </select>
          <button
            onClick={onRevogar}
            disabled={salvando}
            title={`Revogar o acesso a ${vinculo.orgNome}`}
            className="p-1 rounded text-[#a3a3a3] hover:text-red-300 hover:bg-red-900/20 transition-colors disabled:opacity-40"
          >
            <X size={13} />
          </button>
        </>
      ) : (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ROLE_BADGE[vinculo.role]}`}>
          {ROLE_META[vinculo.role].label}
        </span>
      )}
    </div>
  )
}

export function AcessosPanel({ dados, onAdicionar }: Props) {
  const [busca, setBusca] = useState('')
  const [filtroOrg, setFiltroOrg] = useState('')
  const [filtroRole, setFiltroRole] = useState<'' | OrgRole>('')
  const [soSemEmpresa, setSoSemEmpresa] = useState(false)
  const [revogando, setRevogando] = useState<{ usuario: UsuarioAcesso; vinculo: VinculoOrg } | null>(null)
  const [trocandoSenha, setTrocandoSenha] = useState<UsuarioAcesso | null>(null)
  const [erroInline, setErroInline] = useState<string | null>(null)

  const idsAdministraveis = useMemo(
    () => new Set(dados.orgsAdministraveis.map((o) => o.id)),
    [dados.orgsAdministraveis],
  )

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return dados.usuarios.filter((u) => {
      if (q) {
        const alvo = `${u.nome ?? ''} ${u.email}`.toLowerCase()
        if (!alvo.includes(q)) return false
      }
      if (filtroOrg && !u.orgs.some((o) => o.orgId === filtroOrg && o.ativo)) return false
      if (filtroRole && !u.orgs.some((o) => o.role === filtroRole && o.ativo)) return false
      if (soSemEmpresa && (u.isGlobalAdmin || u.orgs.some((o) => o.ativo))) return false
      return true
    })
  }, [dados.usuarios, busca, filtroOrg, filtroRole, soSemEmpresa])

  const semAcessoUtil = useMemo(
    () => dados.usuarios.filter((u) => !u.isGlobalAdmin && !u.orgs.some((o) => o.ativo)).length,
    [dados.usuarios],
  )

  async function trocarPapel(u: UsuarioAcesso, v: VinculoOrg, role: OrgRole) {
    setErroInline(null)
    const r = await dados.alterarPapel(u.userId, v.orgId, role)
    if (!r.ok) setErroInline(r.erro ?? 'Não foi possível alterar o papel.')
  }

  const vazio = filtrados.length === 0

  return (
    <div className="p-6 space-y-4">
      {/* Busca + filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className={cn(inputCls, 'pl-8')}
          />
        </div>
        <select value={filtroOrg} onChange={(e) => setFiltroOrg(e.target.value)} className={cn(selectCls, 'w-52')}>
          <option value="">Todas as empresas</option>
          {dados.orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.nome}</option>
          ))}
        </select>
        <select
          value={filtroRole}
          onChange={(e) => setFiltroRole(e.target.value as '' | OrgRole)}
          className={cn(selectCls, 'w-44')}
        >
          <option value="">Todos os papéis</option>
          {ORG_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_META[r].label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-[#a3a3a3] whitespace-nowrap">
          <input
            type="checkbox"
            checked={soSemEmpresa}
            onChange={(e) => setSoSemEmpresa(e.target.checked)}
            className="accent-[#f97316]"
          />
          sem empresa
        </label>
        <button onClick={() => onAdicionar()} className={`${btnPrimario} flex items-center gap-1.5`}>
          <Plus size={14} /> Adicionar pessoa
        </button>
      </div>

      {semAcessoUtil > 0 && !soSemEmpresa && (
        <div className="bg-[#f97316]/10 border border-[#f97316]/40 rounded-lg px-4 py-2.5 flex items-start gap-2">
          <AlertTriangle size={14} className="text-[#f97316] mt-0.5 shrink-0" />
          <p className="text-[#f97316] text-xs leading-relaxed">
            {semAcessoUtil} conta{semAcessoUtil > 1 ? 's' : ''} sem nenhuma empresa ativa — ao entrar,{' '}
            {semAcessoUtil > 1 ? 'essas pessoas caem' : 'essa pessoa cai'} na tela “sua conta não está vinculada
            a nenhuma empresa”. Dê o vínculo em “Adicionar pessoa” com o mesmo e-mail.
          </p>
        </div>
      )}

      {erroInline && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-2.5">
          <p className="text-red-300 text-xs leading-relaxed">{erroInline}</p>
        </div>
      )}

      {/* Tabela */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#525252]/50">
                <th className={thCls}>Pessoa</th>
                <th className={thCls}>Empresas &amp; papel</th>
                <th className={thCls}>Último login</th>
                <th className={thCls}>Status</th>
                <th className={`${thCls} text-right`}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => {
                const semEmpresa = !u.isGlobalAdmin && !u.orgs.some((o) => o.ativo)
                const login = formatarData(u.ultimoLogin)
                // Um admin de organização não mexe em admin global: a função
                // responde 403 por contrato. Não oferecer a ação evita botão
                // que só sabe falhar (e a impressão de que dá para rebaixar a
                // diretoria a partir de uma empresa).
                const alvoIntocavel = u.isGlobalAdmin && !dados.isGlobalAdmin
                const podeTrocarSenha =
                  !alvoIntocavel &&
                  (dados.isGlobalAdmin || u.orgs.some((o) => o.ativo && idsAdministraveis.has(o.orgId)))
                return (
                  <tr
                    key={u.userId}
                    className={`border-b border-[#525252]/30 transition-colors ${
                      semEmpresa ? 'bg-[#f97316]/5' : 'hover:bg-[#484848]/40'
                    }`}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[#f5f5f5]">{u.nome ?? u.email.split('@')[0]}</span>
                        {u.isGlobalAdmin && <BadgeGlobal />}
                      </div>
                      <p className="text-[#a3a3a3] text-xs font-mono break-all">{u.email}</p>
                    </td>

                    <td className="px-4 py-3 align-top">
                      {u.orgs.length === 0 ? (
                        u.isGlobalAdmin ? (
                          <span className="text-[#6b6b6b] text-xs">todas (admin global)</span>
                        ) : (
                          <button
                            onClick={() => onAdicionar({ email: u.email })}
                            className="flex items-center gap-1.5 text-[#f97316] text-xs hover:underline"
                          >
                            <UserPlus size={12} />
                            sem empresa — vincular agora
                          </button>
                        )
                      ) : (
                        <div className="space-y-1.5">
                          {u.orgs.map((v) => (
                            <LinhaVinculo
                              key={`${u.userId}:${v.orgId}`}
                              vinculo={v}
                              editavel={idsAdministraveis.has(v.orgId) && !alvoIntocavel}
                              salvando={dados.salvando}
                              onPapel={(role) => void trocarPapel(u, v, role)}
                              onRevogar={() => setRevogando({ usuario: u, vinculo: v })}
                              onRestaurar={() => onAdicionar({ email: u.email, orgId: v.orgId, role: v.role })}
                            />
                          ))}
                          {semEmpresa && (
                            <p className="text-[#f97316] text-[10px] leading-tight">
                              nenhum vínculo ativo — a pessoa não consegue usar o sistema
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      {login ? (
                        <span className="text-[#a3a3a3] text-xs font-mono">{login}</span>
                      ) : (
                        <span className="text-[#6b6b6b] text-xs">nunca entrou</span>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                          u.ativo
                            ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/40'
                            : 'bg-[#484848] text-[#a3a3a3] border border-[#5e5e5e]'
                        }`}
                      >
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>

                    <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                      {podeTrocarSenha ? (
                        <button
                          onClick={() => setTrocandoSenha(u)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
                          title="Definir uma senha nova para esta pessoa"
                        >
                          <KeyRound size={13} />
                          Senha
                        </button>
                      ) : (
                        <span
                          className="text-[#6b6b6b] text-xs"
                          title={
                            alvoIntocavel
                              ? 'Só outro administrador global pode mexer nesta conta.'
                              : 'Esta pessoa não é membro ativo de nenhuma empresa que você administra.'
                          }
                        >
                          —
                        </span>
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
                        : dados.usuarios.length === 0
                          ? 'Ninguém tem acesso ainda — comece por “Adicionar pessoa”.'
                          : 'Nenhuma pessoa encontrada com esses filtros.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-[#525252]/50 text-[#6b6b6b] text-xs">
          {filtrados.length} de {dados.usuarios.length} pessoa{dados.usuarios.length !== 1 ? 's' : ''}
        </div>
      </div>

      {revogando && (
        <RevogarAcessoModal
          usuario={revogando.usuario}
          vinculo={revogando.vinculo}
          onConfirmar={() => dados.revogar(revogando.usuario.userId, revogando.vinculo.orgId)}
          onClose={() => setRevogando(null)}
        />
      )}
      {trocandoSenha && (
        <RedefinirSenhaModal
          usuario={trocandoSenha}
          onConfirmar={(nova) => dados.redefinirSenha(trocandoSenha.userId, nova)}
          onClose={() => setTrocandoSenha(null)}
        />
      )}
    </div>
  )
}
