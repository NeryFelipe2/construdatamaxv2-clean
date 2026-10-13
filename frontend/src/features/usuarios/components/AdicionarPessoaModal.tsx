/**
 * AdicionarPessoaModal — dá acesso a alguém, de dois jeitos:
 *
 *  · "Criar conta agora"   → a Edge Function cria o usuário JÁ CONFIRMADO com
 *                            uma senha temporária e faz o vínculo. Serve para
 *                            o pessoal de obra, que não tem e-mail corporativo
 *                            aberto no celular.
 *  · "Só autorizar o e-mail" → registra a autorização prévia; a conta nasce
 *                            sozinha (trigger handle_new_user_v2) quando a
 *                            pessoa aparecer no Auth.
 *
 * A senha temporária aparece uma única vez e precisa ser entregue por fora —
 * a UI repete isso em dois pontos porque é o erro mais caro aqui.
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Mail, ShieldAlert, UserPlus, X } from 'lucide-react'
import type { NovoAcessoInput, OrgRole, ResultadoAcao } from '@/hooks/useUsuarios'
import { ORG_ROLES, ROLE_META } from '@/hooks/useUsuarios'
import type { Org } from '@/store/orgStore'
import { emailValido, gerarSenhaForte } from '../utils/senha'
import { CampoSenha } from './CampoSenha'
import {
  btnPrimario,
  btnSecundario,
  copiar,
  inputCls,
  labelCls,
  modalBoxCls,
  modalOverlayCls,
  selectCls,
} from './ui'

type Modo = 'criar' | 'convidar'

export interface PrefillAcesso {
  email?: string
  orgId?: string
  role?: OrgRole
}

interface Props {
  orgsAdministraveis: Org[]
  /** só admin global pode marcar alguém como admin global */
  podeCriarGlobal: boolean
  prefill?: PrefillAcesso | null
  onCriar: (input: NovoAcessoInput & { senhaTemporaria: string }) => Promise<ResultadoAcao>
  onConvidar: (input: NovoAcessoInput) => Promise<ResultadoAcao>
  onClose: (resultado: 'nada' | 'criou' | 'convidou') => void
}

export function AdicionarPessoaModal({
  orgsAdministraveis,
  podeCriarGlobal,
  prefill,
  onCriar,
  onConvidar,
  onClose,
}: Props) {
  const [modo, setModo] = useState<Modo>('criar')
  const [email, setEmail] = useState(prefill?.email ?? '')
  const [nome, setNome] = useState('')
  const [orgId, setOrgId] = useState(prefill?.orgId ?? orgsAdministraveis[0]?.id ?? '')
  const [role, setRole] = useState<OrgRole>(prefill?.role ?? 'membro')
  const [globalAdmin, setGlobalAdmin] = useState(false)
  const [senha, setSenha] = useState(() => gerarSenhaForte(14))
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState<{ modo: Modo; email: string; senha: string; jaExistia: boolean } | null>(null)
  const [copiado, setCopiado] = useState(false)

  // Se as orgs chegarem depois da abertura do modal, adota a primeira.
  useEffect(() => {
    if (!orgId && orgsAdministraveis.length > 0) setOrgId(orgsAdministraveis[0].id)
  }, [orgId, orgsAdministraveis])

  const orgNome = useMemo(
    () => orgsAdministraveis.find((o) => o.id === orgId)?.nome ?? '',
    [orgsAdministraveis, orgId],
  )

  const semOrgs = orgsAdministraveis.length === 0
  const emailOk = emailValido(email)
  const senhaOk = modo === 'convidar' || senha.length >= 8
  const podeEnviar = emailOk && !!orgId && senhaOk && !enviando

  async function enviar() {
    setErro(null)
    if (!emailOk) {
      setErro('Digite um e-mail válido.')
      return
    }
    if (!orgId) {
      setErro('Escolha a empresa.')
      return
    }
    if (modo === 'criar' && senha.length < 8) {
      setErro('A senha temporária precisa ter pelo menos 8 caracteres.')
      return
    }
    const base: NovoAcessoInput = {
      email: email.trim(),
      nome: nome.trim() || undefined,
      orgId,
      role,
      isGlobalAdmin: podeCriarGlobal && globalAdmin,
    }
    setEnviando(true)
    const r = modo === 'criar' ? await onCriar({ ...base, senhaTemporaria: senha }) : await onConvidar(base)
    setEnviando(false)
    if (!r.ok) {
      setErro(r.erro ?? 'Não foi possível concluir.')
      return
    }
    setFeito({ modo, email: email.trim(), senha, jaExistia: r.jaExistia === true })
  }

  async function copiarCredenciais() {
    if (!feito) return
    const ok = await copiar(`E-mail: ${feito.email}\nSenha temporária: ${feito.senha}`)
    setCopiado(ok)
    if (ok) window.setTimeout(() => setCopiado(false), 1800)
  }

  // ─── Tela de sucesso ──────────────────────────────────────────────────────
  if (feito) {
    const criou = feito.modo === 'criar'
    return (
      <div className={modalOverlayCls} onClick={() => onClose(criou ? 'criou' : 'convidou')}>
        <div className={`${modalBoxCls} w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#525252]">
            <p className="text-[#f5f5f5] text-sm font-semibold">
              {criou ? (feito.jaExistia ? 'Acesso garantido' : 'Conta criada') : 'E-mail autorizado'}
            </p>
            <button
              onClick={() => onClose(criou ? 'criou' : 'convidou')}
              className="text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-5 py-5 space-y-3">
            {criou && feito.jaExistia ? (
              // Conta pré-existente: por contrato a função NÃO troca a senha
              // (trocar seria sequestro de conta disfarçado de "criar"). Mostrar
              // a senha gerada aqui faria o administrador ditar por WhatsApp uma
              // senha que não funciona.
              <>
                <p className="text-[#f5f5f5] text-sm leading-relaxed">
                  Esse e-mail já tinha conta no sistema. Nada foi recriado: o que mudou é que o acesso a{' '}
                  <span className="font-semibold">{orgNome}</span> está garantido como{' '}
                  {ROLE_META[role].label.toLowerCase()}.
                </p>
                <div className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-3 space-y-1">
                  <p className="text-[#a3a3a3] text-xs">E-mail</p>
                  <p className="text-[#f5f5f5] text-sm font-mono break-all">{feito.email}</p>
                </div>
                <p className="text-[#f97316] text-xs leading-relaxed">
                  A senha <span className="font-semibold">não foi alterada</span> — a pessoa continua entrando com
                  a que já usava. A senha temporária que estava no formulário foi descartada. Se ela não lembra a
                  senha, use o botão <span className="font-semibold">Senha</span> na linha dela, na lista de
                  acessos.
                </p>
                <div className="flex items-center justify-end pt-1">
                  <button onClick={() => onClose('criou')} className={btnPrimario}>
                    Fechar
                  </button>
                </div>
              </>
            ) : criou ? (
              <>
                <div className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-3 space-y-1">
                  <p className="text-[#a3a3a3] text-xs">E-mail</p>
                  <p className="text-[#f5f5f5] text-sm font-mono break-all">{feito.email}</p>
                  <p className="text-[#a3a3a3] text-xs pt-2">Senha temporária</p>
                  <p className="text-[#f5f5f5] text-sm font-mono break-all">{feito.senha}</p>
                </div>
                <p className="text-[#f97316] text-xs leading-relaxed">
                  Copie agora: ao fechar, a senha some da tela e não dá para consultar depois. Entregue por fora
                  (WhatsApp, telefone, pessoalmente) — o sistema não envia e-mail — e peça para trocar no primeiro
                  acesso.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button onClick={copiarCredenciais} className={`${btnSecundario} flex items-center gap-1.5`}>
                    {copiado ? <Check size={14} className="text-[#22c55e]" /> : <Copy size={14} />}
                    {copiado ? 'Copiado' : 'Copiar e-mail e senha'}
                  </button>
                  <button onClick={() => onClose('criou')} className={btnPrimario}>
                    Fechar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[#f5f5f5] text-sm leading-relaxed">
                  <span className="font-mono">{feito.email}</span> ficou autorizado a entrar em{' '}
                  <span className="font-semibold">{orgNome}</span> como {ROLE_META[role].label.toLowerCase()}.
                </p>
                <p className="text-[#a3a3a3] text-xs leading-relaxed">
                  A conta ainda não existe: ela nasce sozinha, com o vínculo já aplicado, quando essa pessoa
                  entrar pela primeira vez. Até lá ela aparece na aba “Convites pendentes”.
                </p>
                <div className="flex items-center justify-end pt-1">
                  <button onClick={() => onClose('convidou')} className={btnPrimario}>
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Formulário ───────────────────────────────────────────────────────────
  return (
    <div className={modalOverlayCls} onClick={() => onClose('nada')}>
      <div className={`${modalBoxCls} w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#525252]">
          <div className="flex items-center gap-2.5">
            <UserPlus size={16} className="text-[#f97316]" />
            <p className="text-[#f5f5f5] text-sm font-semibold">Adicionar pessoa</p>
          </div>
          <button onClick={() => onClose('nada')} className="text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {semOrgs && (
            <p className="text-[#f97316] text-xs leading-relaxed">
              Você não administra nenhuma empresa — não há onde vincular a pessoa.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="usr-email">E-mail *</label>
              <input
                id="usr-email"
                type="email"
                value={email}
                autoFocus
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com.br"
                autoComplete="off"
                spellCheck={false}
                className={inputCls}
              />
              {email && !emailOk && <p className="text-red-300 text-[11px] mt-1">E-mail inválido.</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="usr-nome">Nome</label>
              <input
                id="usr-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Como aparece na lista"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="usr-org">Empresa *</label>
              <select
                id="usr-org"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                disabled={semOrgs}
                className={selectCls}
              >
                {semOrgs && <option value="">— nenhuma disponível —</option>}
                {orgsAdministraveis.map((o) => (
                  <option key={o.id} value={o.id}>{o.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="usr-role">Papel *</label>
              <select
                id="usr-role"
                value={role}
                onChange={(e) => setRole(e.target.value as OrgRole)}
                className={selectCls}
              >
                {ORG_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_META[r].label}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[#6b6b6b] text-[11px] leading-relaxed -mt-2">{ROLE_META[role].resumo}</p>

          {podeCriarGlobal && (
            <label className="flex items-start gap-2 bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={globalAdmin}
                onChange={(e) => setGlobalAdmin(e.target.checked)}
                className="accent-[#f97316] mt-0.5"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[#f5f5f5] text-xs font-medium">
                  <ShieldAlert size={13} className="text-[#f97316]" />
                  Administrador global
                </span>
                <span className="block text-[#a3a3a3] text-[11px] leading-relaxed mt-0.5">
                  Enxerga e edita TODAS as empresas e pode gerenciar acessos em qualquer uma. Use só para a
                  diretoria.
                </span>
              </span>
            </label>
          )}

          {/* Como dar o acesso */}
          <div className="space-y-2">
            <p className={labelCls}>Como dar o acesso</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModo('criar')}
                className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  modo === 'criar'
                    ? 'bg-[#3d3d3d] border-[#f97316]'
                    : 'bg-[#3d3d3d]/40 border-[#525252] hover:border-[#6b6b6b]'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[#f5f5f5] text-xs font-medium">
                  <UserPlus size={13} className={modo === 'criar' ? 'text-[#f97316]' : 'text-[#a3a3a3]'} />
                  Criar conta agora
                </span>
                <span className="block text-[#a3a3a3] text-[11px] leading-relaxed mt-1">
                  Conta já confirmada com senha temporária. A pessoa entra hoje.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setModo('convidar')}
                className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  modo === 'convidar'
                    ? 'bg-[#3d3d3d] border-[#f97316]'
                    : 'bg-[#3d3d3d]/40 border-[#525252] hover:border-[#6b6b6b]'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[#f5f5f5] text-xs font-medium">
                  <Mail size={13} className={modo === 'convidar' ? 'text-[#f97316]' : 'text-[#a3a3a3]'} />
                  Só autorizar o e-mail
                </span>
                <span className="block text-[#a3a3a3] text-[11px] leading-relaxed mt-1">
                  Nada é criado agora. A conta nasce vinculada quando a pessoa entrar.
                </span>
              </button>
            </div>
          </div>

          {modo === 'criar' && (
            <div className="space-y-2">
              <label className={labelCls} htmlFor="usr-senha">Senha temporária *</label>
              <CampoSenha valor={senha} onChange={setSenha} id="usr-senha" />
              <div className="bg-[#f97316]/10 border border-[#f97316]/40 rounded-lg px-3 py-2">
                <p className="text-[#f97316] text-[11px] leading-relaxed">
                  O sistema <span className="font-semibold">não envia e-mail</span>. Você precisa entregar essa
                  senha à pessoa por fora (WhatsApp, telefone, pessoalmente) e pedir que ela troque no primeiro
                  acesso.
                </p>
              </div>
            </div>
          )}

          {erro && <p className="text-red-300 text-xs leading-relaxed">{erro}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#525252]">
          <button onClick={() => onClose('nada')} className={btnSecundario} disabled={enviando}>
            Cancelar
          </button>
          <button onClick={enviar} className={btnPrimario} disabled={!podeEnviar || semOrgs}>
            {enviando
              ? 'Enviando…'
              : modo === 'criar'
                ? 'Criar conta e liberar acesso'
                : 'Autorizar e-mail'}
          </button>
        </div>
      </div>
    </div>
  )
}
