/**
 * ConfirmDialog — Reusable inline confirmation strip for destructive actions.
 * Renders as a 2-button strip (Confirmar / Cancelar) with optional message.
 */

interface ConfirmDialogProps {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmDialog({
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  danger = true,
}: ConfirmDialogProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm">
      <span className="text-gray-300 flex-1">{message}</span>
      <button
        onClick={onCancel}
        className="px-3 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
      >
        {cancelLabel}
      </button>
      <button
        onClick={onConfirm}
        className={`px-3 py-1 rounded text-xs text-white transition-colors ${
          danger ? 'bg-red-600 hover:bg-red-500' : 'bg-orange-600 hover:bg-orange-500'
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  )
}
