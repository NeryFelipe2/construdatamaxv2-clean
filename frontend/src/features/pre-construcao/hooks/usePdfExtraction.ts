import * as pdfjsLib from 'pdfjs-dist'
import { nanoid } from 'nanoid'
import type { TakeoffItem } from '@/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

export async function extractFromPdf(file: File): Promise<{ text: string; items: TakeoffItem[] }> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pageTexts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageStr = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pageTexts.push(pageStr)
  }

  const fullText = pageTexts.join('\n')

  const unitRegex = /(\d[\d.,]*)\s*(m²|m³|m\b|kg|ton|un|vb|cj|l\b|kW|kVA|verba)/gi
  const rawItems: TakeoffItem[] = []
  let match: RegExpExecArray | null

  while ((match = unitRegex.exec(fullText)) !== null) {
    const qtyStr = match[1]
    const unit = match[2].toLowerCase()
    const matchStart = match.index
    const descStart = Math.max(0, matchStart - 30)
    const rawDesc = fullText.slice(descStart, matchStart).trim()
    const description = rawDesc.replace(/\s+/g, ' ').replace(/^[^a-zA-ZÀ-ú]+/, '').trim()

    if (!description) continue

    const qtyNorm = qtyStr.replace(',', '.')
    const quantity = parseFloat(qtyNorm)
    if (isNaN(quantity) || quantity <= 0) continue

    const confidence = Math.floor(Math.random() * 26) + 70 // 70–95

    rawItems.push({
      id: nanoid(),
      description,
      quantity,
      unit,
      confidence,
      source: file.name,
    })
  }

  // Deduplicate: keep first occurrence when first 3 words match
  const seen = new Set<string>()
  const items: TakeoffItem[] = []
  for (const item of rawItems) {
    const key = item.description
      .toLowerCase()
      .split(/\s+/)
      .slice(0, 3)
      .join(' ')
    if (!seen.has(key)) {
      seen.add(key)
      items.push(item)
    }
  }

  return { text: fullText, items }
}

export function mockBimExtraction(filename: string): TakeoffItem[] {
  // Detecção automática: se o arquivo contém palavras-chave de saneamento, usa mock de saneamento
  const lower = filename.toLowerCase()
  const isSaneamento = ['esgoto', 'saneamento', 'rede', 'agua', 'água', 'drenagem', 'sabesp', 'pv', 'tubo', 'dwg', 'dxf'].some(k => lower.includes(k))

  const entries: Array<{ description: string; quantity: number; unit: string }> = isSaneamento
    ? [
        // ── Itens de Saneamento / Rede de Esgoto ──
        { description: 'Tubulação PVC JE DN 150mm rede coletora esgoto', quantity: 2400, unit: 'm' },
        { description: 'Tubulação PVC JE DN 200mm rede coletora esgoto', quantity: 1800, unit: 'm' },
        { description: 'Tubulação PVC JE DN 300mm coletor tronco', quantity: 650, unit: 'm' },
        { description: 'Poço de Visita (PV) concreto Ø1000mm prof. até 2m', quantity: 45, unit: 'un' },
        { description: 'Poço de Visita (PV) concreto Ø1000mm prof. 2m a 4m', quantity: 28, unit: 'un' },
        { description: 'Poço de Visita (PV) concreto Ø1200mm prof. > 4m', quantity: 12, unit: 'un' },
        { description: 'Terminal de Limpeza (TL) PVC DN 150mm', quantity: 35, unit: 'un' },
        { description: 'Ligação predial esgoto ramal DN 100mm', quantity: 180, unit: 'un' },
        { description: 'Escavação mecânica vala esgoto solo 1ª cat.', quantity: 4200, unit: 'm³' },
        { description: 'Escoramento contínuo vala prof. > 1.5m', quantity: 1600, unit: 'm²' },
        { description: 'Reaterro compactado vala com material reaproveitado', quantity: 3800, unit: 'm³' },
        { description: 'Lastro de brita vala para assentamento tubo', quantity: 480, unit: 'm³' },
        { description: 'Recomposição pavimento asfalto CBUQ', quantity: 2800, unit: 'm²' },
        { description: 'Recomposição calçada concreto', quantity: 1200, unit: 'm²' },
        { description: 'Tubo PEAD DN 400mm emissário recalque', quantity: 320, unit: 'm' },
        { description: 'Estação Elevatória Esgoto (EEE) pré-fabricada', quantity: 2, unit: 'un' },
        { description: 'Conjunto moto-bomba submersível 15cv', quantity: 4, unit: 'un' },
        { description: 'Quadro de comando elétrico com telemetria', quantity: 2, unit: 'un' },
        { description: 'Cadastro técnico e as-built rede coletora', quantity: 4850, unit: 'm' },
        { description: 'Ensaio estanqueidade trecho rede esgoto', quantity: 85, unit: 'un' },
      ]
    : [
        // ── Itens de Construção Civil (fallback) ──
        { description: 'Concreto fck=25MPa estrutural', quantity: 450, unit: 'm³' },
        { description: 'Aço CA-50 Ø12.5mm corte e montagem', quantity: 28500, unit: 'kg' },
        { description: 'Fôrma compensada resinada', quantity: 2100, unit: 'm²' },
        { description: 'Alvenaria bloco cerâmico 14cm', quantity: 3200, unit: 'm²' },
        { description: 'Impermeabilização manta EPDM', quantity: 850, unit: 'm²' },
        { description: 'Piso porcelanato 60x60cm', quantity: 1200, unit: 'm²' },
        { description: 'Revestimento argamassa paredes externas', quantity: 4500, unit: 'm²' },
        { description: 'Pintura acrílica fachada externa', quantity: 4500, unit: 'm²' },
        { description: 'Esquadrias alumínio anodizado', quantity: 95, unit: 'un' },
        { description: 'Tubulação PPR 25mm água fria', quantity: 1800, unit: 'm' },
        { description: 'Tubulação PVC esgoto 100mm', quantity: 950, unit: 'm' },
        { description: 'Fiação elétrica 2.5mm²', quantity: 12500, unit: 'm' },
        { description: 'Eletroduto PVC 3/4" embutido', quantity: 8500, unit: 'm' },
        { description: 'Estaca hélice contínua Ø40cm', quantity: 280, unit: 'm' },
        { description: 'Estrutura metálica perfis soldados', quantity: 85000, unit: 'kg' },
        { description: 'Telha metálica trapezoidal', quantity: 1200, unit: 'm²' },
        { description: 'Contrapiso concreto regularização 5cm', quantity: 2400, unit: 'm²' },
        { description: 'Pintura látex PVA paredes internas', quantity: 6800, unit: 'm²' },
        { description: 'Tubulação PEAD drenagem pluvial', quantity: 320, unit: 'm' },
        { description: 'Meio-fio concreto pré-moldado', quantity: 180, unit: 'm' },
      ]

  return entries.map(({ description, quantity, unit }) => ({
    id: nanoid(),
    description,
    quantity,
    unit,
    confidence: Math.floor(Math.random() * 9) + 88, // 88–96
    source: filename,
  }))
}
