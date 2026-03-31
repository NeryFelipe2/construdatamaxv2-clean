/**
 * BimPage — entry point for the BIM 3D/4D/5D module.
 * Lazy-loaded via React.lazy in App.tsx so Three.js is NOT in the main bundle.
 */
import { useState } from 'react'
import { BimHeader }    from './components/BimHeader'
import { BimLayout }    from './components/BimLayout'
import { BimUploadModal } from './components/BimUploadModal'

export function BimPage() {
  const [showUpload, setShowUpload] = useState(false)

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <BimHeader onUploadClick={() => setShowUpload(true)} />
      <BimLayout />
      {showUpload && <BimUploadModal onClose={() => setShowUpload(false)} />}
    </div>
  )
}
