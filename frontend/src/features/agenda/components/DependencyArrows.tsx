/**
 * DependencyArrows — overlay SVG (pointer-events: none) desenhado sobre o
 * container das linhas do GanttChart, com uma seta cotovelo do FIM de cada
 * dependência ao INÍCIO da tarefa dependente (fim→início).
 *
 * Cores:
 *  - #5a8caa (cinza-azulado) — dependência normal;
 *  - #f43f5e (vermelho)      — VIOLADA (endDate da dependência > startDate da
 *    tarefa). É SÓ alerta visual: nunca reposicionamos nada automaticamente.
 *  - tracejada — quando o fim da dependência é placeholder (endDateUnknown,
 *    data_fim NULL no banco): sem data real não dá pra afirmar violação,
 *    então nunca pinta de vermelho (padrão honesto do app: sem dado, sem
 *    número inventado).
 *
 * Geometria: reusa getBarStyle (mesma matemática das barras) + as constantes
 * ROW_HEIGHT/SIDEBAR_W de utils.ts. A barra fica em top:10 com height:48
 * dentro da linha (ver GanttBar), então o centro vertical é rowTop + 34.
 */
import { useMemo } from 'react'
import type { AgendaTask } from '@/types'
import { getBarStyle, dependencyViolated, ROW_HEIGHT, SIDEBAR_W } from '../utils'

const BAR_TOP     = 10  // GanttBar: style top
const BAR_HEIGHT  = 48  // GanttBar: style height
const BAR_CENTER  = BAR_TOP + BAR_HEIGHT / 2  // 34px do topo da linha
const STUB        = 8   // avanço horizontal antes do cotovelo

const COLOR_OK       = '#5a8caa'
const COLOR_VIOLATED = '#f43f5e'

interface Arrow {
  key: string
  d: string
  color: string
  dashed: boolean
}

interface DependencyArrowsProps {
  tasks: AgendaTask[]
  /** índice da linha (0-based) por resourceId — só recursos visíveis/filtrados */
  rowIndexByResource: Record<string, number>
  viewStart: string
  visibleWeeks: number
  pixelsPerDay: number
  width: number   // SIDEBAR_W + timelineWidth
  height: number  // visibleResources.length * ROW_HEIGHT
}

export function DependencyArrows({
  tasks,
  rowIndexByResource,
  viewStart,
  visibleWeeks,
  pixelsPerDay,
  width,
  height,
}: DependencyArrowsProps) {
  const arrows = useMemo<Arrow[]>(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]))
    const out: Arrow[] = []

    for (const task of tasks) {
      if (!task.dependsOn || task.dependsOn.length === 0) continue
      const taskRow = rowIndexByResource[task.resourceId]
      if (taskRow === undefined) continue  // recurso filtrado/oculto

      for (const depId of task.dependsOn) {
        const dep = byId.get(depId)
        if (!dep) continue  // id pendurado (tarefa apagada) — nada a desenhar
        const depRow = rowIndexByResource[dep.resourceId]
        if (depRow === undefined) continue

        // Mesma matemática de posicionamento das barras (sem preview)
        const depStyle  = getBarStyle(dep,  viewStart, visibleWeeks, 0, pixelsPerDay)
        const taskStyle = getBarStyle(task, viewStart, visibleWeeks, 0, pixelsPerDay)

        const x1 = SIDEBAR_W + depStyle.left + depStyle.width  // fim da dependência
        const y1 = depRow * ROW_HEIGHT + BAR_CENTER
        const x2 = SIDEBAR_W + taskStyle.left                  // início da tarefa
        const y2 = taskRow * ROW_HEIGHT + BAR_CENTER

        let d: string
        if (x2 >= x1 + STUB * 2) {
          // Caso normal: direita → (vertical) → direita
          d = `M ${x1} ${y1} H ${x1 + STUB} V ${y2} H ${x2}`
        } else {
          // Tarefa começa antes (ou quase) do fim da dependência: rota em S
          // passando pela divisa entre as linhas pra não cortar as barras.
          const yMid = y2 >= y1
            ? depRow * ROW_HEIGHT + ROW_HEIGHT - 2
            : depRow * ROW_HEIGHT + 2
          d = `M ${x1} ${y1} H ${x1 + STUB} V ${yMid} H ${x2 - STUB} V ${y2} H ${x2}`
        }

        // Fim placeholder (data_fim NULL) → não dá pra afirmar violação
        const unknownEnd = dep.endDateUnknown === true
        const violated   = !unknownEnd && dependencyViolated(dep, task)

        out.push({
          key: `${dep.id}->${task.id}`,
          d,
          color: violated ? COLOR_VIOLATED : COLOR_OK,
          dashed: unknownEnd,
        })
      }
    }
    return out
  }, [tasks, rowIndexByResource, viewStart, visibleWeeks, pixelsPerDay])

  if (arrows.length === 0) return null

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 4,  // acima das barras (2), abaixo da linha Hoje (5) e da barra selecionada (10)
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <defs>
        <marker
          id="agenda-dep-arrow-ok"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 8 4 L 0 8 z" fill={COLOR_OK} />
        </marker>
        <marker
          id="agenda-dep-arrow-violated"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 8 4 L 0 8 z" fill={COLOR_VIOLATED} />
        </marker>
      </defs>

      {arrows.map((a) => (
        <path
          key={a.key}
          d={a.d}
          fill="none"
          stroke={a.color}
          strokeWidth={1.5}
          strokeDasharray={a.dashed ? '4 3' : undefined}
          opacity={0.9}
          markerEnd={`url(#${a.color === COLOR_VIOLATED ? 'agenda-dep-arrow-violated' : 'agenda-dep-arrow-ok'})`}
        />
      ))}
    </svg>
  )
}
