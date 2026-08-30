/**
 * GuiaTrilhoBar — barra fina no topo do app com os 5 passos do trilho guiado
 * da semana (P1..P5, Fase 3 do plano LPS real).
 *
 * Cada quadrado mostra o status REAL computado pelas checagens do guiaStore
 * (metas_producao / lps_restricoes / lps_tasks / producao_diaria) — clique
 * leva pra /app/guia. O botão de colapsar persiste em guiaStore.trilhoVisivel
 * (localStorage); pra reabrir, o toggle fica no header da GuiaPage.
 *
 * Camada, nunca gaiola: a barra só informa — nenhuma tela é bloqueada.
 */
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronUp } from 'lucide-react'
import { useGuiaStore, GUIA_PASSOS, COR_STATUS } from '@/store/guiaStore'
import { useProjectContext } from '@/store/projectContext'

export function GuiaTrilhoBar() {
  const passos = useGuiaStore((s) => s.passos)
  const trilhoVisivel = useGuiaStore((s) => s.trilhoVisivel)
  const setTrilhoVisivel = useGuiaStore((s) => s.setTrilhoVisivel)
  const verificar = useGuiaStore((s) => s.verificar)
  const verificando = useGuiaStore((s) => s.verificando)
  const semanaIso = useGuiaStore((s) => s.semanaIso)
  const activeProjectId = useProjectContext((s) => s.activeProjectId)

  // Recomputa as checagens sempre que o projeto ativo muda.
  useEffect(() => {
    if (activeProjectId) void verificar(activeProjectId)
  }, [activeProjectId, verificar])

  if (!trilhoVisivel) return null

  const concluidos = GUIA_PASSOS.filter(
    (d) => passos[d.id].status === 'concluido' || passos[d.id].status === 'pulado',
  ).length

  return (
    <div className="flex items-center gap-3 h-8 px-4 bg-[#0a0f1a] border-b border-[#1e293b] shrink-0 overflow-x-auto no-scrollbar">
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#64748b] shrink-0">
        Trilho {semanaIso}
      </span>
      <Link
        to="/app/guia"
        className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity"
        title="Abrir o guia da semana"
      >
        {GUIA_PASSOS.map((def) => {
          const st = passos[def.id].status
          return (
            <span key={def.id} className="flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-[1px]"
                style={{ background: COR_STATUS[st] }}
              />
              <span className="text-[9px] font-mono text-[#94a3b8]">{def.id.toUpperCase()}</span>
            </span>
          )
        })}
        <span className="text-[10px] font-mono [font-variant-numeric:tabular-nums] font-bold text-[#f97316]">
          {concluidos}/5
        </span>
      </Link>
      {verificando && (
        <span className="text-[9px] uppercase tracking-wider text-[#475569] shrink-0">verificando…</span>
      )}
      <span className="ml-auto hidden sm:block text-[9px] text-[#475569] shrink-0">
        checagens ao vivo · guia_progresso
      </span>
      <button
        onClick={() => setTrilhoVisivel(false)}
        className="text-[#64748b] hover:text-[#e2e8f0] transition-colors shrink-0"
        title="Esconder a barra (reabra no header do Guia)"
        aria-label="Esconder a barra do trilho"
      >
        <ChevronUp size={12} />
      </button>
    </div>
  )
}
