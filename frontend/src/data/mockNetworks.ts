export interface NetworkTemplateItem {
  code:        string
  description: string
  unit:        string
  quantity:    number
  unitCost:    number
  category:    string
  source:      'sinapi' | 'seinfra' | 'manual'
}

export interface NetworkTemplate {
  id:          string
  name:        string
  description: string
  icon:        string
  perMeters:   number
  items:       NetworkTemplateItem[]
}

export const NETWORK_TEMPLATES: NetworkTemplate[] = []
