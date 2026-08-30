/**
 * LoginPage.tsx - tela de login standalone (nao usa o shell do app).
 * Design grafite: fundo #2c2c2c, card #3d3d3d, acento laranja #f97316.
 * Login por e-mail+senha (signInWithPassword) + link discreto de magic link
 * (signInWithOtp). Se ja logado (ou modo local sem Supabase), redireciona.
 */
import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

const INPUT_CLS =
  'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#8a8a8a] outline-none focus:ring-2 focus:ring-[#f97316] focus:border-[#f97316] transition-shadow'

export function LoginPage() {
  const status = useAuthStore((s) => s.status)
  const semSupabase = useAuthStore((s) => s.semSupabase)
  const entrar = useAuthStore((s) => s.entrar)
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/app'

  // Ja logado (ou modo local sem Supabase): nao ha o que fazer aqui.
  if (status === 'logado' || semSupabase) return <Navigate to={from} replace />

  if (status === 'carregando') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#2c2c2c] text-[#a3a3a3]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#525252] border-t-[#f97316] rounded-full animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.')
      return
    }
    setErro(null)
    setInfo(null)
    setEnviando(true)
    const res = await entrar(email, senha)
    setEnviando(false)
    if (!res.ok) setErro(res.erro ?? 'Falha no login.')
    // Sucesso: o status vira 'logado' e o <Navigate> acima redireciona.
  }

  async function handleMagicLink() {
    if (!supabase) return
    if (!email.trim()) {
      setErro('Digite o e-mail primeiro.')
      return
    }
    setErro(null)
    setInfo(null)
    setEnviando(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/app` },
    })
    setEnviando(false)
    if (error) setErro(error.message)
    else setInfo('Link enviado! Confira sua caixa de entrada.')
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#2c2c2c] p-4">
      <div className="w-full max-w-sm bg-[#3d3d3d] border border-[#525252] rounded-xl p-8">
        {/* Logo / titulo */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <div
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#2c2c2c] border border-[#525252]"
            style={{ boxShadow: '0 0 12px rgba(249,115,22,0.25)' }}
          >
            <span className="font-bold text-xl text-[#f97316]">C</span>
          </div>
          <div className="flex flex-col items-center leading-none">
            <span className="text-lg font-bold text-[#f5f5f5]">ConstruData</span>
            <span className="text-[9px] font-medium tracking-widest uppercase text-[#f97316] opacity-90">
              HydroNetwork
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-[#a3a3a3]">
              E-mail
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com.br"
              className={INPUT_CLS}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-[#a3a3a3]">
              Senha
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="********"
              className={INPUT_CLS}
            />
          </label>

          {erro && <p className="text-xs text-red-300">{erro}</p>}
          {info && <p className="text-xs text-emerald-300">{info}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="mt-1 w-full bg-[#f97316] text-[#ffffff] rounded-lg py-2 font-semibold text-sm hover:bg-[#ea580c] disabled:opacity-60 transition-colors"
          >
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={handleMagicLink}
            disabled={enviando}
            className="text-[11px] text-[#a3a3a3] hover:text-[#f97316] transition-colors underline underline-offset-2 disabled:opacity-60 mx-auto"
          >
            Entrar por link no e-mail
          </button>
        </form>
      </div>
    </div>
  )
}
