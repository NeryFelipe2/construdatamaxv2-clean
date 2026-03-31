/**
 * BimForgeViewer — Autodesk APS (Forge) Viewer integration.
 *
 * Authentication: 2-legged client_credentials flow called from the browser.
 * User provides Client ID + Client Secret via settings modal (stored in localStorage).
 * CORS note: POST /authentication/v2/token works on localhost; for production, configure
 * trusted domains in the APS developer console or use a reverse proxy.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { Settings, ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, Eye, Loader2 } from 'lucide-react'
import { useBimStore } from '@/store/bimStore'

// ─── Types ────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Autodesk?: any
  }
}

// ─── SDK loader (singleton) ───────────────────────────────────────────────────

let sdkLoadPromise: Promise<void> | null = null

function loadForgeSdk(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise
  sdkLoadPromise = new Promise((resolve, reject) => {
    if (window.Autodesk?.Viewing) { resolve(); return }

    // CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css'
    document.head.appendChild(link)

    // JS
    const script = document.createElement('script')
    script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar Autodesk Viewer SDK'))
    document.head.appendChild(script)
  })
  return sdkLoadPromise
}

// ─── APS Auth ─────────────────────────────────────────────────────────────────

async function fetchApsToken(clientId: string, clientSecret: string): Promise<{ token: string; expiry: number }> {
  const creds = btoa(`${clientId}:${clientSecret}`)
  const resp = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=viewables%3Aread',
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText)
    throw new Error(`APS auth falhou (${resp.status}): ${text}`)
  }
  const json = await resp.json()
  return {
    token:  json.access_token,
    expiry: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000,
  }
}

// ─── Setup modal ──────────────────────────────────────────────────────────────

function SetupModal({ onClose }: { onClose: () => void }) {
  const { setForgeCredentials, setForgeUrn, forgeUrn } = useBimStore()
  const [clientId,     setClientId]     = useState(() => localStorage.getItem('aps-client-id')     ?? '')
  const [clientSecret, setClientSecret] = useState(() => localStorage.getItem('aps-client-secret') ?? '')
  const [urn,          setUrn]          = useState(forgeUrn ?? '')
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  async function handleSave() {
    if (!clientId.trim() || !clientSecret.trim()) { setErr('Client ID e Client Secret são obrigatórios.'); return }
    setSaving(true); setErr('')
    try {
      // Quick auth test
      await fetchApsToken(clientId.trim(), clientSecret.trim())
      setForgeCredentials(clientId.trim(), clientSecret.trim())
      if (urn.trim()) setForgeUrn(urn.trim())
      onClose()
    } catch (e) {
      setErr(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#112645] border border-[#20406a] rounded-2xl w-[480px] max-w-full p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#2abfdc]/15 flex items-center justify-center">
            <Settings size={18} className="text-[#2abfdc]" />
          </div>
          <div>
            <h3 className="text-[#e4f2f8] font-semibold text-sm">Configurar Autodesk APS</h3>
            <p className="text-[#5a8caa] text-xs">Credenciais salvas apenas no localStorage do browser</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[#8fb3c8] text-xs block mb-1">Client ID *</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Seu APS Client ID"
              className="w-full bg-[#14294e] border border-[#20406a] rounded-lg px-3 py-2 text-[#e4f2f8] text-sm focus:outline-none focus:border-[#2abfdc]/60"
            />
          </div>
          <div>
            <label className="text-[#8fb3c8] text-xs block mb-1">Client Secret *</label>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Seu APS Client Secret"
              className="w-full bg-[#14294e] border border-[#20406a] rounded-lg px-3 py-2 text-[#e4f2f8] text-sm focus:outline-none focus:border-[#2abfdc]/60"
            />
          </div>
          <div>
            <label className="text-[#8fb3c8] text-xs block mb-1">Model URN (Base64) — opcional</label>
            <input
              type="text"
              value={urn}
              onChange={(e) => setUrn(e.target.value)}
              placeholder="dXJuOmFkc2sub2JqZWN0czE6..."
              className="w-full bg-[#14294e] border border-[#20406a] rounded-lg px-3 py-2 text-[#e4f2f8] text-sm focus:outline-none focus:border-[#2abfdc]/60 font-mono"
            />
            <p className="text-[#5a8caa] text-[10px] mt-1">
              URN do modelo traduzido via Model Derivative API. Obtenha no APS Console.
            </p>
          </div>

          {err && (
            <div className="flex items-start gap-2 bg-[#ef444415] border border-[#ef444430] rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="text-[#ef4444] shrink-0 mt-0.5" />
              <span className="text-[#ef4444] text-xs">{err}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-[#6b6b6b] hover:text-[#e4f2f8] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#2abfdc] text-[#0d2040] hover:bg-[#1a9ab8] disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? 'Testando...' : 'Salvar e Conectar'}
          </button>
        </div>

        <a
          href="https://aps.autodesk.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[#2abfdc] text-xs hover:underline"
        >
          <ExternalLink size={11} />
          Criar conta APS gratuita → aps.autodesk.com
        </a>
      </div>
    </div>
  )
}

// ─── Placeholder (not configured) ─────────────────────────────────────────────

function ForgeSetupPrompt({ onSetup }: { onSetup: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-[#2abfdc]/10 border border-[#2abfdc]/20 flex items-center justify-center">
        <Eye size={28} className="text-[#2abfdc]" />
      </div>
      <div>
        <h3 className="text-[#e4f2f8] font-semibold text-base mb-2">Autodesk APS Viewer</h3>
        <p className="text-[#5a8caa] text-sm max-w-sm leading-relaxed">
          Visualize modelos BIM/IFC diretamente no browser com o viewer nativo da Autodesk.
          Suporta RVT, IFC, DWG, NWD e mais de 60 formatos.
        </p>
      </div>
      <div className="flex flex-col gap-2 text-left bg-[#14294e] border border-[#20406a] rounded-xl px-4 py-3 max-w-sm w-full text-xs text-[#8fb3c8]">
        <p className="font-semibold text-[#2abfdc] mb-1">Como configurar:</p>
        <p>1. Crie um app em <span className="text-[#2abfdc]">aps.autodesk.com</span> (gratuito)</p>
        <p>2. Obtenha o Client ID e Client Secret</p>
        <p>3. Faça upload de um modelo e obtenha o URN</p>
        <p>4. Cole as credenciais no modal de configuração</p>
      </div>
      <button
        onClick={onSetup}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#2abfdc] text-[#0d2040] rounded-xl text-sm font-semibold hover:bg-[#1a9ab8] transition-colors"
      >
        <Settings size={15} />
        Configurar APS
      </button>
    </div>
  )
}

// ─── Viewer container ─────────────────────────────────────────────────────────

interface ViewerContainerProps {
  token: string
  urn:   string
  onSettings: () => void
}

function ViewerContainer({ token, urn, onSettings }: ViewerContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef    = useRef<unknown>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState('')

  const initViewer = useCallback(async () => {
    if (!containerRef.current) return
    setStatus('loading')
    try {
      await loadForgeSdk()
      const AV = window.Autodesk?.Viewing
      if (!AV) throw new Error('Autodesk Viewing SDK não carregado')

      // Destroy previous viewer
      if (viewerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(viewerRef.current as any).finish()
        viewerRef.current = null
      }

      AV.Initializer({ accessToken: token, env: 'AutodeskProduction' }, () => {
        const viewer = new AV.GuiViewer3D(containerRef.current, { extensions: ['Autodesk.DocumentBrowser'] })
        viewerRef.current = viewer
        viewer.start()

        AV.Document.load(
          `urn:${urn}`,
          (doc: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = doc as any
            const viewables = d.getRoot().getDefaultGeometry()
            viewer.loadDocumentNode(d, viewables).then(() => setStatus('ready'))
          },
          (errCode: number) => {
            setErrMsg(`Erro ao carregar modelo (código ${errCode})`)
            setStatus('error')
          }
        )
      })
    } catch (e) {
      setErrMsg(String(e))
      setStatus('error')
    }
  }, [token, urn])

  useEffect(() => {
    initViewer()
    return () => {
      if (viewerRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(viewerRef.current as any).finish()
        } catch { /* noop */ }
        viewerRef.current = null
      }
    }
  }, [initViewer])

  return (
    <div className="relative h-full w-full flex flex-col">
      {/* Toolbar overlay */}
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <button
          onClick={initViewer}
          title="Recarregar viewer"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#112645]/90 border border-[#20406a] rounded-lg text-xs text-[#8fb3c8] hover:text-[#2abfdc] transition-colors"
        >
          <RefreshCw size={12} />
          Recarregar
        </button>
        <button
          onClick={onSettings}
          title="Configurações APS"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#112645]/90 border border-[#20406a] rounded-lg text-xs text-[#8fb3c8] hover:text-[#2abfdc] transition-colors"
        >
          <Settings size={12} />
          Configurar
        </button>
      </div>

      {/* Status overlay */}
      {status === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0d2040]/80">
          <Loader2 size={32} className="text-[#2abfdc] animate-spin mb-3" />
          <p className="text-[#8fb3c8] text-sm">Carregando Autodesk Viewer…</p>
        </div>
      )}
      {status === 'ready' && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-[#22c55e15] border border-[#22c55e30] rounded-full">
          <CheckCircle2 size={11} className="text-[#22c55e]" />
          <span className="text-[#22c55e] text-[10px] font-semibold">Modelo carregado</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertTriangle size={32} className="text-[#ef4444]" />
          <p className="text-[#e4f2f8] font-semibold">Erro ao carregar modelo</p>
          <p className="text-[#5a8caa] text-sm max-w-sm">{errMsg}</p>
          {errMsg.toLowerCase().includes('cors') && (
            <div className="bg-[#eab30815] border border-[#eab30830] rounded-lg px-4 py-3 text-xs text-[#eab308] max-w-sm text-left">
              <p className="font-semibold mb-1">Possível bloqueio de CORS</p>
              <p>Configure "Trusted Domains" no console APS ou use um proxy reverso para produção.</p>
            </div>
          )}
          <button
            onClick={initViewer}
            className="px-4 py-2 bg-[#2abfdc] text-[#0d2040] rounded-lg text-sm font-semibold hover:bg-[#1a9ab8] transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Viewer container */}
      <div ref={containerRef} className="flex-1 w-full" style={{ minHeight: 0 }} />
    </div>
  )
}

// ─── Main BimForgeViewer ──────────────────────────────────────────────────────

export function BimForgeViewer() {
  const { forgeToken, forgeTokenExpiry, forgeUrn, forgeClientId, setForgeToken, setForgeUrn } = useBimStore()
  const [showSetup, setShowSetup] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connErr, setConnErr] = useState('')

  // Auto-connect if credentials exist but token is missing/expired
  useEffect(() => {
    const id     = localStorage.getItem('aps-client-id')
    const secret = localStorage.getItem('aps-client-secret')
    if (!id || !secret) return
    if (forgeToken && forgeTokenExpiry && Date.now() < forgeTokenExpiry) return

    setConnecting(true)
    fetchApsToken(id, secret)
      .then(({ token, expiry }) => {
        setForgeToken(token, expiry)
        setConnecting(false)
      })
      .catch((e) => {
        setConnErr(String(e))
        setConnecting(false)
      })
  }, [forgeToken, forgeTokenExpiry, setForgeToken])

  const isConnected = !!forgeToken && !!forgeTokenExpiry && Date.now() < forgeTokenExpiry
  const hasUrn      = !!forgeUrn
  const hasCredentials = !!forgeClientId || !!localStorage.getItem('aps-client-id')

  if (!hasCredentials) {
    return (
      <div className="flex flex-col h-full bg-[#0d2040]">
        {showSetup && <SetupModal onClose={() => setShowSetup(false)} />}
        <ForgeSetupPrompt onSetup={() => setShowSetup(true)} />
      </div>
    )
  }

  if (connecting) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-[#0d2040]">
        <Loader2 size={28} className="text-[#2abfdc] animate-spin" />
        <p className="text-[#8fb3c8] text-sm">Conectando ao Autodesk APS…</p>
      </div>
    )
  }

  if (!isConnected || connErr) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-[#0d2040] p-8 text-center">
        {showSetup && <SetupModal onClose={() => setShowSetup(false)} />}
        <AlertTriangle size={28} className="text-[#ef4444]" />
        <p className="text-[#e4f2f8] font-semibold">Falha na autenticação APS</p>
        {connErr && <p className="text-[#5a8caa] text-sm max-w-sm">{connErr}</p>}
        <button
          onClick={() => setShowSetup(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2abfdc] text-[#0d2040] rounded-xl text-sm font-semibold hover:bg-[#1a9ab8] transition-colors"
        >
          <Settings size={14} />
          Reconfigurar credenciais
        </button>
      </div>
    )
  }

  if (!hasUrn) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-[#0d2040] p-8 text-center">
        {showSetup && <SetupModal onClose={() => setShowSetup(false)} />}
        <CheckCircle2 size={28} className="text-[#22c55e]" />
        <p className="text-[#e4f2f8] font-semibold">APS conectado</p>
        <p className="text-[#5a8caa] text-sm max-w-sm">
          Insira o URN do modelo para carregar no viewer.
        </p>
        <div className="flex gap-2 max-w-sm w-full">
          <input
            type="text"
            placeholder="URN do modelo (Base64)"
            className="flex-1 bg-[#14294e] border border-[#20406a] rounded-lg px-3 py-2 text-[#e4f2f8] text-sm focus:outline-none focus:border-[#2abfdc]/60 font-mono"
            onChange={(e) => setForgeUrn(e.target.value)}
          />
          <button
            onClick={() => setShowSetup(true)}
            className="px-3 py-2 bg-[#2abfdc] text-[#0d2040] rounded-lg text-sm font-semibold hover:bg-[#1a9ab8] transition-colors"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0d2040]">
      {showSetup && <SetupModal onClose={() => setShowSetup(false)} />}
      <ViewerContainer
        token={forgeToken}
        urn={forgeUrn}
        onSettings={() => setShowSetup(true)}
      />
    </div>
  )
}
