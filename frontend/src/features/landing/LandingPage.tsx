import { useEffect } from 'react'
import { LandingHeader } from './components/LandingHeader'
import { HeroSection } from './components/HeroSection'
import { OntologiaSection } from './components/OntologiaSection'
import { ModulosOverviewSection } from './components/ModulosOverviewSection'
import { FeatureDeepSection } from './components/FeatureDeepSection'
import { ShowcaseSection } from './components/ShowcaseSection'
import { AllModulesGrid } from './components/AllModulesGrid'
import { FooterCTA } from './components/FooterCTA'
import { ContactForm } from './components/ContactForm'

export function LandingPage() {
  // Force dark theme so the app's light-mode toggle doesn't bleed into the landing page
  useEffect(() => {
    const html = document.documentElement
    const prev = html.getAttribute('data-theme')
    html.setAttribute('data-theme', 'dark')
    return () => {
      if (prev) html.setAttribute('data-theme', prev)
      else html.removeAttribute('data-theme')
    }
  }, [])

  return (
    <div
      className="min-h-screen antialiased"
      style={{
        background: '#0b1a30',
        color: '#f4f5f7',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <LandingHeader />
      <HeroSection />
      <OntologiaSection />
      <ModulosOverviewSection />
      <FeatureDeepSection />
      <ShowcaseSection />
      <AllModulesGrid />
      <FooterCTA />
      <ContactForm />
      <footer style={{ background: '#0f2240', borderTop: '1px solid rgba(255,255,255,0.10)' }} className="py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-white/65 text-xs tracking-wide">© 2026 ATLÂNTICO PLATFORM</span>
          <span className="text-white/55 text-xs tracking-wide">CONSTRUÇÃO · SANEAMENTO · INFRAESTRUTURA</span>
        </div>
      </footer>
    </div>
  )
}
