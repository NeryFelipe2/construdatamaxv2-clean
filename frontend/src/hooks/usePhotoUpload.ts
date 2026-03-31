import { useCallback } from 'react'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import type { ReportPhoto } from '@/types'

export function usePhotoUpload() {
  const addPhoto = useRelatorio360Store((s) => s.addPhoto)

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      files.forEach((file) => {
        const reader = new FileReader()
        reader.onload = () => {
          const photo: ReportPhoto = {
            id: crypto.randomUUID(),
            base64: reader.result as string,
            label: file.name.replace(/\.[^.]+$/, ''),
            uploadedAt: new Date().toISOString(),
          }
          addPhoto(photo)
        }
        reader.readAsDataURL(file)
      })
      e.target.value = ''
    },
    [addPhoto]
  )

  return { handleFileChange }
}
