import type { BimSegment, BimLayer, BimProject } from '@/types'

export const MOCK_BIM_SEGMENTS: BimSegment[] = []

export const MOCK_BIM_LAYERS: BimLayer[] = []

export const MOCK_BIM_PROJECT: BimProject = {
  id: 'demo-rede', name: 'Rede Coletora — Demo', type: 'sanitation',
  segments: [], layers: [],
  uploadedAt: '', shapefileSourceName: '',
}

export const MOCK_BIM_SANEAMENTO: BimProject = {
  id: 'demo-saneamento', name: 'Saneamento — Demo', type: 'sanitation',
  uploadedAt: '', shapefileSourceName: '',
  layers: [],
  segments: [],
}

export const MOCK_BIM_BUILDING: BimProject = {
  id: 'demo-building', name: 'Edificação — Demo', type: 'building',
  uploadedAt: '', shapefileSourceName: '',
  layers: [],
  segments: [],
}
