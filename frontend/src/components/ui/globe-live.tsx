"use client"

import { useEffect, useRef, useCallback } from 'react'
import createGlobe from 'cobe'

const BRAZIL_MARKERS = [
  { id: 'sp',  location: [-23.55, -46.63] as [number, number] },
  { id: 'rj',  location: [-22.90, -43.17] as [number, number] },
  { id: 'bh',  location: [-19.92, -43.94] as [number, number] },
  { id: 'cwb', location: [-25.43, -49.27] as [number, number] },
  { id: 'bsb', location: [-15.78, -47.92] as [number, number] },
  { id: 'for', location: [-3.72,  -38.54] as [number, number] },
]

interface GlobeLiveProps {
  className?: string
  projectCount?: number
}

export function GlobeLive({ className = '', projectCount = 247 }: GlobeLiveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const isPausedRef = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
    isPausedRef.current = true
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
    isPausedRef.current = false
  }, [])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 200,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        }
      }
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerup', handlePointerUp, { passive: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerUp])

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    let globe: ReturnType<typeof createGlobe> | null = null
    let animationId: number
    let phi = 1.8 // center on South America

    function init() {
      const width = canvas.offsetWidth
      if (width === 0 || globe) return

      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width,
        height: width,
        phi: 1.8,
        theta: 0.3,
        dark: 1,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 6,
        baseColor: [0.05, 0.13, 0.25],
        markerColor: [0.16, 0.75, 0.86],
        glowColor: [0.1, 0.3, 0.5],
        markerElevation: 0.015,
        markers: BRAZIL_MARKERS.map((m) => ({ location: m.location, size: 0.05 })),
        arcs: [],
        opacity: 0.85,
      })

      function animate() {
        if (!isPausedRef.current) phi += 0.004
        globe!.update({
          phi: phi + phiOffsetRef.current + dragOffset.current.phi,
          theta: 0.3 + dragOffset.current.theta,
        })
        animationId = requestAnimationFrame(animate)
      }
      animate()
      setTimeout(() => canvas && (canvas.style.opacity = '1'))
    }

    if (canvas.offsetWidth > 0) {
      init()
    } else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          ro.disconnect()
          init()
        }
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      if (globe) globe.destroy()
    }
  }, [])

  return (
    <div className={`relative aspect-square select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'grab',
          opacity: 0,
          transition: 'opacity 1.2s ease',
          borderRadius: '50%',
          touchAction: 'none',
        }}
      />
      {/* Project count badge */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-[#0a1628]/80 backdrop-blur-sm border border-[#2abfdc]/30 rounded-full">
        <span className="w-2 h-2 rounded-full bg-[#2abfdc] animate-pulse" />
        <span className="text-xs text-[#2abfdc] font-semibold">{projectCount} projetos monitorados</span>
      </div>
    </div>
  )
}
