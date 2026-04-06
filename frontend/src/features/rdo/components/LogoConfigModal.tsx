/**
 * LogoConfigModal — Gallery of saved company logos for RDO PDF exports.
 * Multiple logos can be saved; one is selected per RDO when creating it.
 */
import { useRef, useState } from 'react'
import { X, Trash2, Building2, Check, Plus } from 'lucide-react'
import { useCompanySettingsStore } from '@/store/companySettingsStore'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_MB  = 2

interface Props {
  onClose: () => void
}

export function LogoConfigModal({ onClose }: Props) {
  const { logos, companyName, addLogo, removeLogo, setCompanyName } = useCompanySettingsStore()

  const [newName, setNewName]   = useState('')
  const [pending, setPending]   = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [saved, setSaved]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    setAddError(null)
    if (!ALLOWED_MIME.includes(file.type)) {
      setAddError('Formato inválido. Use JPG, PNG ou WebP.')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setAddError(`Arquivo muito grande. Máximo ${MAX_SIZE_MB} MB.`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setPending(reader.result as string)
      if (!newName) setNewName(file.name.replace(/\.[^.]+$/, ''))
    }
    reader.readAsDataURL(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleSaveLogo() {
    if (!pending) return
    addLogo(newName.trim() || 'Logo sem nome', pending)
    setPending(null)
    setNewName('')
    setAddError(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleCancelAdd() {
    setPending(null)
    setNewName('')
    setAddError(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[#525252] bg-[#333333] flex flex-col shadow-2xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252] shrink-0">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-[#f97316]" />
            <h2 className="text-[#f5f5f5] font-bold text-sm">Logos da Empresa</h2>
            {logos.length > 0 && (
              <span className="text-[10px] bg-[#f97316]/15 text-[#f97316] px-2 py-0.5 rounded-full font-medium">
                {logos.length} salva{logos.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#484848] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5">

          {/* Company name */}
          <div>
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b] mb-1.5">
              Nome da Empresa
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Construdata Engenharia"
              className="w-full rounded-lg bg-[#3d3d3d] border border-[#525252] px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#404040] focus:outline-none focus:border-[#f97316]/50 transition-colors"
            />
            <p className="text-[10px] text-[#6b6b6b] mt-1">Aparece no rodapé do cabeçalho de cada PDF.</p>
          </div>

          {/* Logo gallery */}
          {logos.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b] mb-2">
                Logos Salvas ({logos.length})
              </label>
              <div className="grid grid-cols-2 gap-3">
                {logos.map((logo) => (
                  <div
                    key={logo.id}
                    className="relative rounded-xl border border-[#525252] bg-[#3d3d3d] p-3 flex flex-col gap-2"
                  >
                    <div className="h-16 flex items-center justify-center bg-white rounded-lg overflow-hidden">
                      <img
                        src={logo.base64}
                        alt={logo.name}
                        className="max-h-14 max-w-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#f5f5f5] font-medium truncate">{logo.name}</span>
                      <button
                        onClick={() => removeLogo(logo.id)}
                        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-[#6b6b6b] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                        title="Remover logo"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add new logo section */}
          <div>
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b] mb-2">
              Adicionar Nova Logo
            </label>

            {pending ? (
              <div className="flex flex-col gap-3 p-4 rounded-xl border border-[#f97316]/30 bg-[#f97316]/5">
                <div className="h-16 flex items-center justify-center bg-white rounded-lg overflow-hidden">
                  <img src={pending} alt="preview" className="max-h-14 max-w-full object-contain" />
                </div>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome para esta logo"
                  className="w-full rounded-lg bg-[#3d3d3d] border border-[#525252] px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#404040] focus:outline-none focus:border-[#f97316]/50 transition-colors"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveLogo}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors"
                  >
                    <Check size={12} />
                    Salvar Logo
                  </button>
                  <button
                    onClick={handleCancelAdd}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-[#6b6b6b] hover:text-[#f5f5f5] border border-[#525252] hover:border-[#404040] transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-[#525252] hover:border-[#f97316]/50 cursor-pointer transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-[#484848] flex items-center justify-center">
                  <Plus size={18} className="text-[#6b6b6b]" />
                </div>
                <p className="text-xs text-[#a3a3a3] text-center">Clique ou arraste uma imagem</p>
                <p className="text-[10px] text-[#6b6b6b]">JPG, PNG, WebP · Máx. {MAX_SIZE_MB} MB</p>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept={ALLOWED_MIME.join(',')}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
            />

            {addError && <p className="text-xs text-[#ef4444] mt-2">{addError}</p>}

            {saved && (
              <p className="text-xs text-[#22c55e] mt-2 flex items-center gap-1">
                <Check size={12} /> Logo salva com sucesso!
              </p>
            )}

            {logos.length === 0 && !pending && (
              <p className="text-[10px] text-[#6b6b6b] mt-2 bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2">
                Sem logos salvas — ao criar um RDO, o PDF usará o ícone padrão.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#525252] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
