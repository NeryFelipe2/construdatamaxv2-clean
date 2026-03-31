import { useRef, useState } from 'react'
import { Camera, Trash2, Pencil, Check, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useCurrentReport } from '@/hooks/useRelatorio360'
import { usePhotoUpload } from '@/hooks/usePhotoUpload'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import type { ReportPhoto } from '@/types'

function PhotoCard({ photo }: { photo: ReportPhoto }) {
  const { removePhoto, updatePhotoLabel } = useRelatorio360Store()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(photo.label)

  function commitLabel() {
    updatePhotoLabel(photo.id, draft.trim() || photo.label)
    setEditing(false)
  }

  function cancelEdit() {
    setDraft(photo.label)
    setEditing(false)
  }

  return (
    <div className="group relative flex flex-col rounded-xl border border-[#20406a] bg-[#14294e] overflow-hidden hover:border-[#1f3c5e] transition-colors">
      {/* Image */}
      <div className="relative aspect-video bg-[#1a3662] overflow-hidden">
        <img
          src={photo.base64}
          alt={photo.label}
          className="w-full h-full object-cover"
        />
        {/* Delete overlay */}
        <button
          onClick={() => removePhoto(photo.id)}
          className="absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-lg bg-[#0d2040]/80 text-[#ef4444] opacity-0 group-hover:opacity-100 hover:bg-[#ef4444]/20 transition-all"
          title="Remover foto"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Label */}
      <div className="px-3 py-2 flex flex-col gap-1">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel()
                if (e.key === 'Escape') cancelEdit()
              }}
              className="flex-1 bg-transparent border-b border-[#2abfdc] text-[#f5f5f5] text-xs outline-none pb-0.5"
            />
            <button onClick={commitLabel} className="text-[#22c55e] hover:opacity-80">
              <Check size={13} />
            </button>
            <button onClick={cancelEdit} className="text-[#ef4444] hover:opacity-80">
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1 group/label">
            <span className="text-[#f5f5f5] text-xs font-medium truncate">{photo.label}</span>
            <button
              onClick={() => setEditing(true)}
              className="text-[#6b6b6b] opacity-0 group-hover/label:opacity-100 hover:text-[#2abfdc] transition-all"
            >
              <Pencil size={11} />
            </button>
          </div>
        )}
        <span className="text-[10px] text-[#6b6b6b]">
          {format(new Date(photo.uploadedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </span>
      </div>
    </div>
  )
}

export function PhotosPanel() {
  const report = useCurrentReport()
  const photos = report?.photos ?? []
  const { handleFileChange } = usePhotoUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] flex items-center gap-2">
          <Camera size={13} />
          Registros Fotográficos
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#6b6b6b]">{photos.length} fotos</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#2abfdc]/15 text-[#2abfdc] border border-[#2abfdc]/30 hover:bg-[#2abfdc]/25 transition-colors"
          >
            <Camera size={13} />
            Adicionar Fotos
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {photos.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#20406a] bg-[#112645]',
            'h-32 cursor-pointer hover:border-[#2abfdc]/40 hover:bg-[#2abfdc]/5 transition-colors'
          )}
        >
          <Camera size={24} className="text-[#3f3f3f]" />
          <span className="text-xs text-[#6b6b6b]">Clique para adicionar fotos da obra</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {photos.map((photo) => (
            <PhotoCard key={photo.id} photo={photo} />
          ))}
          {/* Add more button */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'aspect-video flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#20406a]',
              'cursor-pointer hover:border-[#2abfdc]/40 hover:bg-[#2abfdc]/5 transition-colors'
            )}
          >
            <Camera size={20} className="text-[#3f3f3f]" />
            <span className="text-[10px] text-[#6b6b6b] uppercase tracking-wider font-semibold">Adicionar</span>
          </div>
        </div>
      )}
    </div>
  )
}
