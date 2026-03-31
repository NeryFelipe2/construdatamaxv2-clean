import { FlaskConical } from 'lucide-react'
import { useAppModeStore } from '@/store/appModeStore'

/**
 * Non-dismissible banner shown at the top of the app when demo mode is active.
 * Reminds users that displayed data is fictional and not real production data.
 */
export function DemoBanner() {
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)

  if (!isDemoMode) return null

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-[#2abfdc] text-white text-xs font-semibold shrink-0">
      <FlaskConical size={13} />
      Modo Demonstração Ativo — os dados exibidos são fictícios e para fins ilustrativos
    </div>
  )
}
