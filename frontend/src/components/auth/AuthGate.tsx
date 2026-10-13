/**
 * AuthGate.tsx - layout route que protege tudo que fica em /app.
 *
 * Decisao de inicializacao: main.tsx dispara useAuthStore.inicializar() antes
 * do render; aqui o useEffect chama de novo apenas como rede de seguranca
 * (a acao e idempotente). O Outlet NUNCA renderiza antes de getSession()
 * resolver (status 'carregando' segura tudo no spinner).
 *
 * Degradacao elegante:
 *  - semSupabase (envs ausentes)  -> Outlet direto, app em modo local.
 *  - organizations nao migrada    -> erroCarregamento=true -> Outlet direto.
 *  - orgs carregadas vazias e usuario nao e admin global -> tela "sem vinculo".
 */
import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useOrgStore } from '@/store/orgStore'

// Mesmo estilo do RouteFallback de App.tsx, em tela cheia.
function FullScreenSpinner() {
  return (
    <div className="flex items-center justify-center h-screen bg-[#0b1220] text-gray-400">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-gray-600 border-t-cyan-500 rounded-full animate-spin" />
        <span className="text-sm">Carregando...</span>
      </div>
    </div>
  )
}

function SemVinculo({ onSair }: { onSair: () => void }) {
  return (
    <div className="flex items-center justify-center h-screen bg-[#2c2c2c] p-4">
      <div className="w-full max-w-sm bg-[#3d3d3d] border border-[#525252] rounded-xl p-8 text-center space-y-4">
        <div className="text-[#f5f5f5] text-sm font-semibold">
          Sua conta ainda não está vinculada a nenhuma empresa.
        </div>
        <div className="text-[#a3a3a3] text-xs">Fale com o administrador.</div>
        <button
          onClick={onSair}
          className="w-full bg-[#f97316] text-[#ffffff] rounded-lg py-2 text-sm font-semibold hover:bg-[#ea580c] transition-colors"
        >
          Sair
        </button>
      </div>
    </div>
  )
}

export function AuthGate() {
  const status = useAuthStore((s) => s.status)
  const semSupabase = useAuthStore((s) => s.semSupabase)
  const profile = useAuthStore((s) => s.profile)
  const inicializar = useAuthStore((s) => s.inicializar)
  const sair = useAuthStore((s) => s.sair)
  const orgs = useOrgStore((s) => s.orgs)
  const orgsCarregado = useOrgStore((s) => s.carregado)
  const orgsErro = useOrgStore((s) => s.erroCarregamento)
  const carregarOrgs = useOrgStore((s) => s.carregarOrgs)
  const location = useLocation()

  // Rede de seguranca (main.tsx ja disparou; a acao e idempotente).
  useEffect(() => {
    inicializar()
  }, [inicializar])

  // Depois de logado, carrega as organizacoes (uma vez; guard interno do store).
  useEffect(() => {
    if (status === 'logado' && !semSupabase) carregarOrgs()
  }, [status, semSupabase, carregarOrgs])

  // Envs do Supabase ausentes: modo local continua funcionando como hoje.
  if (semSupabase) return <Outlet />

  if (status === 'carregando') return <FullScreenSpinner />

  if (status === 'deslogado') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Logado: espera o select de organizations resolver antes de decidir.
  if (!orgsCarregado) return <FullScreenSpinner />

  const isGlobalAdmin = profile?.is_global_admin === true
  if (!orgsErro && orgs.length === 0 && !isGlobalAdmin) {
    return <SemVinculo onSair={() => { void sair() }} />
  }

  return <Outlet />
}
