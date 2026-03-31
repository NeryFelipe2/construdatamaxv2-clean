/**
 * projectToBim.ts — Converts a Project (Projetos module) into a BimProject
 * suitable for rendering in BimCanvas.
 *
 * Each execution phase → a floor level with slab + 4 columns.
 * constructionDate is set so that phases with progress > 0 appear in 4D.
 * totalCostBRL is derived from the project's budgetLines spread across phases.
 */

import type { Project, BimProject, BimSegment, BimLayer } from '@/types'

// Building footprint constants (metres)
const BW = 20   // building width  (X)
const BD = 15   // building depth  (Y)
const FH = 3.0  // floor height
const ST = 0.3  // slab thickness

function seg(
  id: string,
  vertices: [number, number, number][],
  elementType: BimSegment['elementType'],
  phase: string,
  constructionDate: string | undefined,
  totalCostBRL: number,
  diameter = 600,
  material = 'Concreto',
): BimSegment {
  const [v0, v1] = vertices
  const dx = Math.abs(v1[0] - v0[0])
  const dy = Math.abs(v1[1] - v0[1])
  const dz = Math.abs(v1[2] - v0[2])
  const lengthM = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
  return {
    id,
    vertices,
    attributes: { phase, elementType: elementType ?? 'slab' },
    lengthM,
    avgDepthM: 0,
    diameter,
    material,
    unitCostBRL: totalCostBRL / lengthM,
    totalCostBRL,
    constructionDate,
    phase,
    elementType,
  }
}

export function projectToBim(project: Project): BimProject {
  const allPhases = [...project.planningPhases, ...project.executionPhases]
  const totalBudget = project.budgetLines.reduce((s, l) => s + l.budgeted, 0)
  const numPhases = allPhases.length || 1

  const segments: BimSegment[] = []

  allPhases.forEach((phase, idx) => {
    const floorZ  = idx * FH
    const costShare = totalBudget / numPhases

    // Determine constructionDate: if phase has started, use startDate
    const constructionDate =
      phase.progress > 0 || phase.status === 'completed' || phase.status === 'in_progress'
        ? phase.startDate
        : undefined

    // ── Slab ─────────────────────────────────────────────────────────────────
    segments.push(seg(
      `${project.id}-slab-${idx}`,
      [[0, 0, floorZ], [BW, BD, floorZ + ST]],
      'slab',
      phase.name,
      constructionDate,
      costShare * 0.5,
    ))

    // ── Columns (4 corners) ──────────────────────────────────────────────────
    const cornerTop = floorZ + FH
    const colCostShare = costShare * 0.125  // 4 columns × 12.5% each = 50% of phase cost
    const corners: [number, number][] = [[1, 1], [BW - 1, 1], [1, BD - 1], [BW - 1, BD - 1]]
    corners.forEach(([cx, cy], ci) => {
      segments.push(seg(
        `${project.id}-col-${idx}-${ci}`,
        [[cx, cy, floorZ + ST], [cx, cy, cornerTop]],
        'column',
        phase.name,
        constructionDate,
        colCostShare,
        600,
        'Concreto Armado',
      ))
    })

    // ── Perimeter walls (partial — front and back only to keep it readable) ──
    if (idx % 2 === 0) {
      // Front wall
      segments.push(seg(
        `${project.id}-wall-front-${idx}`,
        [[0, 0, floorZ + ST], [BW, 0.3, floorZ + FH]],
        'wall',
        phase.name,
        constructionDate,
        costShare * 0.125,
      ))
      // Back wall
      segments.push(seg(
        `${project.id}-wall-back-${idx}`,
        [[0, BD - 0.3, floorZ + ST], [BW, BD, floorZ + FH]],
        'wall',
        phase.name,
        constructionDate,
        costShare * 0.125,
      ))
    }
  })

  // ── Layers ────────────────────────────────────────────────────────────────
  const layers: BimLayer[] = [
    { id: 'slabs',   name: 'Lajes',   visible: true, color: '#3b82f6', attribute: 'elementType' },
    { id: 'columns', name: 'Pilares', visible: true, color: '#2abfdc', attribute: 'elementType' },
    { id: 'walls',   name: 'Paredes', visible: true, color: '#22c55e', attribute: 'elementType' },
  ]

  return {
    id:                  `proj-bim-${project.id}`,
    name:                project.name,
    type:                'building',
    segments,
    layers,
    uploadedAt:          project.startDate,
    shapefileSourceName: 'Projetos — gerado automaticamente',
  }
}
