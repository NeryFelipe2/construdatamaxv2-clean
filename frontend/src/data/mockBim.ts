import type { BimSegment, BimLayer, BimProject } from '@/types'

export const MOCK_BIM_SEGMENTS: BimSegment[] = []

export const MOCK_BIM_LAYERS: BimLayer[] = []

export const MOCK_BIM_PROJECT: BimProject = {
  id: '', name: '', type: 'sanitation',
  segments: [], layers: [],
  uploadedAt: '', shapefileSourceName: '',
}

export const MOCK_BIM_SANEAMENTO: BimProject = {
  id: '', name: '', type: 'sanitation',
  uploadedAt: '', shapefileSourceName: '',
  layers: [],
  segments: [],
}

export const MOCK_BIM_BUILDING: BimProject = {
  id: '', name: '', type: 'building',
  uploadedAt: '', shapefileSourceName: '',
  layers: [],
  segments: [],
}
