/**
 * GuiaRibbon — faixa de contexto do trilho guiado (Fase 3, LPS real).
 *
 * Aparece no topo de uma page quando a URL carrega ?guia=pN (deep-link vindo
 * do trilho): "PASSO X/5 — instrução · PRÓXIMO →". Autocontido: lê o
 * searchParam sozinho e rende null quando não há trilho ativo, então as pages
 * (LPS, RDO, Planejamento Mestre) só precisam montar <GuiaRibbon /> no topo.
 */
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, X } from 'lucide-react'
import { useGuiaStore, GUIA_PASSOS, COR_STATUS, LABEL_STATUS } from '@/store/guiaStore'

export function GuiaRibbon() {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('guia')
  const def = GUIA_PASSOS.find((p) => p.id === raw)
  const estado = useGuiaStore((s) => (def ? s.passos[def.id] : null))
  if (!def || !estado) return null

  const proximo = GUIA_PASSOS.find((p) => p.ordem === def.ordem + 1)

  const sairDoTrilho = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('guia')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#0d1420] border-b border-[#1e293b] border-l-2 border-l-[#f97316] shrink-0">
      <span className="text-[10px] font-mono [font-variant-numeric:tabular-nums] font-bold text-[#f97316] shrink-0">
        PASSO {def.ordem}/5
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#e2e8f0] shrink-0 hidden sm:block">
        {def.titulo}
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        <span className="inline-block w-2 h-2 rounded-[1px]" style={{ background: COR_STATUS[estado.status] }} />
        <span className="text-[9px] uppercase tracking-wider text-[#94a3b8]">{LABEL_STATUS[estado.status]}</span>
      </span>
      <span className="text-[11px] text-[#94a3b8] truncate min-w-0">{def.instrucaoCurta}</span>
      <span className="ml-auto shrink-0 flex items-center gap-2">
        {proximo ? (
          <Link
            to={proximo.deepLink}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#f97316] hover:text-[#fdba74] transition-colors"
          >
            Próximo: {proximo.id.toUpperCase()} <ArrowRight size={11} />
          </Link>
        ) : (
          <Link
            to="/app/guia"
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#f97316] hover:text-[#fdba74] transition-colors"
          >
            Voltar ao trilho <ArrowRight size={11} />
          </Link>
        )}
        <button
          onClick={sairDoTrilho}
          className="text-[#64748b] hover:text-[#e2e8f0] transition-colors"
          title="Sair do modo trilho nesta tela"
          aria-label="Sair do modo trilho"
        >
          <X size={12} />
        </button>
      </span>
    </div>
  )
}
