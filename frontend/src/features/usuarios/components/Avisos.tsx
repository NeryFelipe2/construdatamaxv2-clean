/**
 * Avisos.tsx — estados de exceção da tela de Usuários & Acessos.
 * Nenhum deles é "tela de erro": todos explicam o que falta e o que dá pra
 * fazer, mantendo o restante da página navegável.
 */
import { AlertTriangle, Info, Lock } from 'lucide-react'
import { cardCls } from './ui'

/** Edge Function ainda não deployada (404 / preflight recusado). */
export function AvisoFuncaoAusente({ detalhe }: { detalhe?: string | null }) {
  return (
    <div className="bg-[#f97316]/10 border border-[#f97316]/40 rounded-xl px-4 py-3.5 space-y-2">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-[#f97316] mt-0.5 shrink-0" />
        <div className="space-y-2 min-w-0">
          <p className="text-[#f97316] text-sm font-semibold">
            A função <span className="font-mono">admin-usuarios</span> ainda não está no ar
          </p>
          <p className="text-[#a3a3a3] text-xs leading-relaxed">
            A tela está pronta, mas quem cria contas e vínculos é uma Edge Function no Supabase
            (o navegador só tem a chave pública — de propósito). Enquanto ela não sobe, esta página
            não consegue listar nem cadastrar ninguém, e o único caminho continua sendo o painel do
            Supabase.
          </p>
          <div className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 overflow-x-auto">
            <p className="text-[#6b6b6b] text-[10px] mb-1">O que falta rodar:</p>
            <pre className="text-[#f5f5f5] text-xs font-mono whitespace-pre">
{`supabase functions deploy admin-usuarios --no-verify-jwt`}
            </pre>
            <p className="text-[#6b6b6b] text-[10px] mt-1.5 leading-relaxed">
              A <span className="font-mono">service_role</span> não precisa ser configurada à mão: o Supabase já
              injeta <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> nas Edge Functions publicadas
              (a CLI inclusive recusa <span className="font-mono">secrets set</span> com o prefixo{' '}
              <span className="font-mono">SUPABASE_</span>).
            </p>
          </div>
          {detalhe && <p className="text-[#6b6b6b] text-[11px] leading-relaxed">Resposta recebida: {detalhe}</p>}
        </div>
      </div>
    </div>
  )
}

/** Erro genérico (rede, 500 da função, resposta fora do contrato). */
export function AvisoErro({ mensagem }: { mensagem: string }) {
  return (
    <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 flex items-start gap-2.5">
      <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
      <p className="text-red-300 text-xs leading-relaxed">{mensagem}</p>
    </div>
  )
}

/**
 * Avisos que a própria Edge Function devolveu junto da resposta (campo
 * `avisos`) — tipicamente migration pendente. Sem isto a tela mentiria:
 * "nenhum convite pendente" quando a tabela nem existe.
 */
export function AvisosDoBackend({ avisos }: { avisos: string[] }) {
  if (avisos.length === 0) return null
  return (
    <div className="bg-[#f97316]/10 border border-[#f97316]/40 rounded-xl px-4 py-3 flex items-start gap-2.5">
      <AlertTriangle size={16} className="text-[#f97316] mt-0.5 shrink-0" />
      <ul className="space-y-1 min-w-0">
        {avisos.map((a) => (
          <li key={a} className="text-[#f97316] text-xs leading-relaxed">{a}</li>
        ))}
      </ul>
    </div>
  )
}

/** Sessão expirada (401). */
export function AvisoSessao({ mensagem }: { mensagem: string }) {
  return (
    <div className="bg-[#f97316]/10 border border-[#f97316]/40 rounded-xl px-4 py-3 flex items-start gap-2.5">
      <Info size={16} className="text-[#f97316] mt-0.5 shrink-0" />
      <p className="text-[#f97316] text-xs leading-relaxed">{mensagem}</p>
    </div>
  )
}

/** App sem as envs do Supabase (modo local). */
export function AvisoSemSupabase() {
  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-4 py-3 flex items-start gap-2.5">
      <Info size={16} className="text-[#a3a3a3] mt-0.5 shrink-0" />
      <p className="text-[#a3a3a3] text-xs leading-relaxed">
        Este navegador está rodando sem as variáveis <span className="font-mono">VITE_SUPABASE_URL</span> /
        <span className="font-mono"> VITE_SUPABASE_ANON_KEY</span> (modo local). A gestão de acessos precisa do
        banco — configure o <span className="font-mono">.env</span> e recarregue.
      </p>
    </div>
  )
}

/** Usuário logado que não é admin global nem owner/admin de nenhuma empresa. */
export function SemPermissaoPanel() {
  return (
    <div className="p-6">
      <div className={`${cardCls} p-8 max-w-xl mx-auto text-center space-y-3`}>
        <div className="w-11 h-11 rounded-lg bg-[#484848] flex items-center justify-center mx-auto">
          <Lock size={20} className="text-[#a3a3a3]" />
        </div>
        <p className="text-[#f5f5f5] text-sm font-semibold">Você não tem permissão para gerenciar acessos</p>
        <p className="text-[#a3a3a3] text-xs leading-relaxed">
          Só administradores globais e quem é <span className="text-[#f5f5f5]">Dono</span> ou{' '}
          <span className="text-[#f5f5f5]">Administrador</span> de uma empresa podem criar contas, mudar papéis
          e revogar acesso. Peça a quem administra a sua empresa.
        </p>
      </div>
    </div>
  )
}
