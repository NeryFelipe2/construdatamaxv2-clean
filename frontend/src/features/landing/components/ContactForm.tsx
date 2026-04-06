import { useState } from 'react'

interface FormData {
  nome: string; sobrenome: string; email: string
  empresa: string; cargo: string; estado: string
}

const EMPTY: FormData = { nome: '', sobrenome: '', email: '', empresa: '', cargo: '', estado: '' }

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  wrapperClassName?: string
}

function Field({ label, wrapperClassName, ...props }: FieldProps) {
  return (
    <div className={wrapperClassName}>
      <label style={{ letterSpacing: '0.1em' }} className="block text-white/65 text-xs uppercase mb-2">{label}</label>
      <input
        style={{
          background: 'transparent',
          borderBottom: '1px solid rgba(255,255,255,0.25)',
          borderTop: 'none', borderLeft: 'none', borderRight: 'none',
          outline: 'none',
          color: '#f4f5f7',
          width: '100%',
          padding: '0.5rem 0',
          fontSize: '0.875rem',
        }}
        className="focus:border-b-[#f97316] transition-colors placeholder:text-white/50"
        {...props}
      />
    </div>
  )
}

export function ContactForm() {
  const [form, setForm] = useState<FormData>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_KEY ?? 'YOUR_WEB3FORMS_KEY',
          subject: 'Nova Solicitação de Demo — Atlântico',
          from_name: `${form.nome} ${form.sobrenome}`,
          email: form.email,
          message: `Nome: ${form.nome} ${form.sobrenome}\nEmail: ${form.email}\nEmpresa: ${form.empresa}\nCargo: ${form.cargo}\nEstado: ${form.estado}`,
        }),
      })
      const data = await res.json()
      if (data.success) { setSuccess(true); setForm(EMPTY) }
      else setError('Erro no envio. Tente novamente.')
    } catch { setError('Erro de conexão.') }
    finally { setLoading(false) }
  }

  return (
    <section id="contato" style={{ background: '#333333', borderTop: '1px solid rgba(255,255,255,0.10)' }} className="py-32">
      <div className="max-w-3xl mx-auto px-6">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-16">
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em' }} className="text-white/60 text-xs uppercase font-mono">11 / Contato</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
        </div>

        <div style={{ border: '1px solid rgba(255,255,255,0.14)', background: '#2c2c2c' }}>
          {/* Form header */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.14)' }} className="px-10 py-8">
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
                letterSpacing: '-0.01em',
              }}
              className="text-white mb-2"
            >
              Ganhe uma vantagem com Atlântico.
            </h2>
            <p className="text-white/75 text-sm">
              Preencha o formulário e nossa equipe entrará em contato para agendar uma apresentação personalizada.
            </p>
          </div>

          {/* Form body */}
          <div className="px-10 py-10">
            {success ? (
              <div className="py-16 text-center">
                <div style={{ border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.05)' }} className="inline-flex items-center gap-3 px-6 py-4 mb-6">
                  <span className="text-green-400 text-xl">✓</span>
                  <div className="text-left">
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-white font-semibold">Solicitação Recebida</div>
                    <div className="text-white/75 text-sm">Nossa equipe entrará em contato em breve.</div>
                  </div>
                </div>
                <p className="text-white/70 text-sm max-w-sm mx-auto">
                  Obrigado! Nossa equipe entrará em contato em breve para agendar sua apresentação personalizada da plataforma Atlântico.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-8 mb-8">
                  <Field label="Nome *" required placeholder="João" value={form.nome} onChange={set('nome')} />
                  <Field label="Sobrenome *" required placeholder="Silva" value={form.sobrenome} onChange={set('sobrenome')} />
                  <Field label="Endereço de Email *" required type="email" placeholder="joao@empresa.com.br" value={form.email} onChange={set('email')} wrapperClassName="sm:col-span-2" />
                  <Field label="Nome da Empresa *" required placeholder="Construtora XYZ" value={form.empresa} onChange={set('empresa')} />
                  <Field label="Cargo *" required placeholder="Diretor de Engenharia" value={form.cargo} onChange={set('cargo')} />
                  <Field label="Estado / País *" required placeholder="São Paulo, Brasil" value={form.estado} onChange={set('estado')} wrapperClassName="sm:col-span-2" />
                </div>

                {error && <p className="text-red-400/70 text-xs mb-4 font-mono">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: '#f97316',
                    color: '#000',
                    padding: '0.875rem 1.5rem',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {loading ? 'Enviando...' : 'Solicitar Apresentação'}
                </button>

                <p style={{ letterSpacing: '0.04em' }} className="text-white/55 text-xs text-center mt-4 uppercase">
                  Sem spam. Resposta em até 24 horas.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
