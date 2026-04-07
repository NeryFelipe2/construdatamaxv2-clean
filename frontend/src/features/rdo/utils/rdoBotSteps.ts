/**
 * rdoBotSteps.ts — Definição dos steps do bot conversacional de RDO via WhatsApp.
 * Cada step define: mensagem, opções fechadas, e validação.
 * O apontador NÃO pode errar — tudo é guiado por números.
 */

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type StepType = 'select' | 'text' | 'number' | 'photo' | 'confirm'

export interface BotOption {
  value: string
  label: string
  emoji?: string
}

export interface BotStep {
  id: string
  emoji: string
  title: string
  message: string
  type: StepType
  options?: BotOption[]
  placeholder?: string
  required: boolean
  validation?: (value: string) => string | null // returns error or null
  /** If true, this step can repeat (e.g., add more activities) */
  repeatable?: boolean
}

// ─── Opções padronizadas (SABESP / Saneamento) ─────────────────────────────

export const NUCLEOS: BotOption[] = [
  { value: 'slnr-santos', label: 'SLNR Santos', emoji: '1️⃣' },
  { value: 'slnr-sv', label: 'SLNR São Vicente', emoji: '2️⃣' },
  { value: 'slnr-pg', label: 'SLNR Praia Grande', emoji: '3️⃣' },
  { value: 'slnr-guaruja', label: 'SLNR Guarujá', emoji: '4️⃣' },
]

export const PROJETOS: BotOption[] = [
  { value: 'ct-11481051', label: 'CT 11481051 - Rede Esgoto', emoji: '1️⃣' },
  { value: 'ct-11481052', label: 'CT 11481052 - Rede Água', emoji: '2️⃣' },
  { value: 'ct-11481053', label: 'CT 11481053 - Ligações', emoji: '3️⃣' },
]

export const CLIMA_OPTIONS: BotOption[] = [
  { value: 'ensolarado', label: 'Ensolarado', emoji: '☀️' },
  { value: 'nublado', label: 'Nublado', emoji: '⛅' },
  { value: 'chuvoso', label: 'Chuvoso', emoji: '🌧️' },
  { value: 'parcial', label: 'Parc. Nublado', emoji: '🌤️' },
]

export const EQUIPE_TIPOS: BotOption[] = [
  { value: 'rede-esgoto', label: 'Rede Esgoto', emoji: '1️⃣' },
  { value: 'rede-agua', label: 'Rede Água', emoji: '2️⃣' },
  { value: 'ligacao', label: 'Ligação Domiciliar', emoji: '3️⃣' },
  { value: 'pavimentacao', label: 'Pavimentação', emoji: '4️⃣' },
  { value: 'reaterro', label: 'Reaterro', emoji: '5️⃣' },
  { value: 'teste', label: 'Teste Estanqueidade', emoji: '6️⃣' },
  { value: 'manutencao', label: 'Manutenção', emoji: '7️⃣' },
]

export const SERVICO_OPTIONS: BotOption[] = [
  { value: 'assentamento', label: 'Assentamento', emoji: '1️⃣' },
  { value: 'escavacao', label: 'Escavação', emoji: '2️⃣' },
  { value: 'reaterro', label: 'Reaterro', emoji: '3️⃣' },
  { value: 'ligacao-casa', label: 'Ligação Casa', emoji: '4️⃣' },
  { value: 'ligacao-intra', label: 'Ligação Intradomiciliar', emoji: '5️⃣' },
  { value: 'teste', label: 'Teste Estanqueidade', emoji: '6️⃣' },
  { value: 'reparo', label: 'Reparo', emoji: '7️⃣' },
  { value: 'cftv', label: 'CFTV', emoji: '8️⃣' },
]

export const TUBO_OPTIONS: BotOption[] = [
  { value: 'pvc-dn100', label: 'PVC DN100', emoji: '1️⃣' },
  { value: 'pvc-dn150', label: 'PVC DN150', emoji: '2️⃣' },
  { value: 'pvc-dn200', label: 'PVC DN200', emoji: '3️⃣' },
  { value: 'pvc-dn250', label: 'PVC DN250', emoji: '4️⃣' },
  { value: 'pvc-dn300', label: 'PVC DN300', emoji: '5️⃣' },
  { value: 'pead-dn63', label: 'PEAD DN63', emoji: '6️⃣' },
  { value: 'pead-dn110', label: 'PEAD DN110', emoji: '7️⃣' },
  { value: 'outro', label: 'Outro', emoji: '8️⃣' },
]

export const EQUIP_OPTIONS: BotOption[] = [
  { value: 'retro', label: 'Retroescavadeira', emoji: '1️⃣' },
  { value: 'escavadeira', label: 'Escavadeira Hidráulica', emoji: '2️⃣' },
  { value: 'compactador', label: 'Compactador', emoji: '3️⃣' },
  { value: 'munck', label: 'Caminhão Munck', emoji: '4️⃣' },
  { value: 'basculante', label: 'Caminhão Basculante', emoji: '5️⃣' },
  { value: 'bomba', label: 'Bomba', emoji: '6️⃣' },
  { value: 'nenhum', label: 'Nenhum/Próximo', emoji: '0️⃣' },
]

export const MAO_OBRA_CARGOS: BotOption[] = [
  { value: 'ajudantes', label: 'Ajudantes', emoji: '👷' },
  { value: 'pedreiros', label: 'Pedreiros', emoji: '🧱' },
  { value: 'encanadores', label: 'Encanadores', emoji: '🔧' },
  { value: 'operadores', label: 'Operadores', emoji: '🚜' },
  { value: 'motoristas', label: 'Motoristas', emoji: '🚛' },
  { value: 'encarregado', label: 'Encarregado', emoji: '📋' },
]

export const OCORRENCIA_TIPOS: BotOption[] = [
  { value: 'nenhuma', label: 'Nenhuma', emoji: '✅' },
  { value: 'acidente', label: 'Acidente', emoji: '🚨' },
  { value: 'chuva', label: 'Chuva parou obra', emoji: '🌧️' },
  { value: 'falta-material', label: 'Falta material', emoji: '📦' },
  { value: 'problema-solo', label: 'Problema solo', emoji: '⛏️' },
  { value: 'equip-quebrado', label: 'Equipamento quebrado', emoji: '🔩' },
  { value: 'falta-mao-obra', label: 'Falta mão de obra', emoji: '👥' },
  { value: 'outro', label: 'Outro', emoji: '❓' },
]

// ─── Steps do Bot ───────────────────────────────────────────────────────────

export const BOT_STEPS: BotStep[] = [
  {
    id: 'nucleo',
    emoji: '🏢',
    title: 'Núcleo',
    message: 'Selecione o *NÚCLEO*:',
    type: 'select',
    options: NUCLEOS,
    required: true,
  },
  {
    id: 'projeto',
    emoji: '📋',
    title: 'Projeto',
    message: 'Selecione o *PROJETO/CONTRATO*:',
    type: 'select',
    options: PROJETOS,
    required: true,
  },
  {
    id: 'clima',
    emoji: '🌤️',
    title: 'Clima',
    message: '*CLIMA* no momento:',
    type: 'select',
    options: CLIMA_OPTIONS,
    required: true,
  },
  {
    id: 'tipo_equipe',
    emoji: '👥',
    title: 'Tipo de Equipe',
    message: '*TIPO DE EQUIPE*:',
    type: 'select',
    options: EQUIPE_TIPOS,
    required: true,
  },
  {
    id: 'lider',
    emoji: '👤',
    title: 'Líder',
    message: 'Nome do *LÍDER* da equipe:',
    type: 'text',
    placeholder: 'Ex: Bruno Silva',
    required: true,
    validation: (v) => v.trim().length < 2 ? 'Nome muito curto' : null,
  },
  {
    id: 'local',
    emoji: '📍',
    title: 'Local',
    message: 'Informe a *RUA / LOCAL* da atividade:',
    type: 'text',
    placeholder: 'Ex: Rua B, beco do Sheike',
    required: true,
    validation: (v) => v.trim().length < 3 ? 'Local muito curto' : null,
  },
  {
    id: 'servico',
    emoji: '🔧',
    title: 'Serviço',
    message: '*SERVIÇO* executado:',
    type: 'select',
    options: SERVICO_OPTIONS,
    required: true,
  },
  {
    id: 'tubo',
    emoji: '📏',
    title: 'Tubo',
    message: '*TUBO* utilizado:',
    type: 'select',
    options: TUBO_OPTIONS,
    required: true,
  },
  {
    id: 'metragem',
    emoji: '📐',
    title: 'Metragem',
    message: '*METRAGEM* executada (em metros):',
    type: 'number',
    placeholder: 'Ex: 47',
    required: true,
    validation: (v) => {
      const n = parseFloat(v)
      if (isNaN(n) || n <= 0) return 'Informe um número positivo'
      if (n > 9999) return 'Valor muito alto'
      return null
    },
  },
  {
    id: 'mao_obra_ajudantes',
    emoji: '👷',
    title: 'Ajudantes',
    message: 'Quantidade de *AJUDANTES*: (ou 0)',
    type: 'number',
    placeholder: '0',
    required: false,
  },
  {
    id: 'mao_obra_encarregado',
    emoji: '📋',
    title: 'Encarregados',
    message: 'Quantidade de *ENCARREGADOS*: (ou 0)',
    type: 'number',
    placeholder: '0',
    required: false,
  },
  {
    id: 'equipamento',
    emoji: '🚜',
    title: 'Equipamentos',
    message: 'Selecione os *EQUIPAMENTOS* usados (ou 0 para pular):',
    type: 'select',
    options: EQUIP_OPTIONS,
    required: false,
  },
  {
    id: 'ocorrencia',
    emoji: '⚠️',
    title: 'Ocorrências',
    message: 'Houve alguma *OCORRÊNCIA*?',
    type: 'select',
    options: OCORRENCIA_TIPOS,
    required: true,
  },
  {
    id: 'foto',
    emoji: '📸',
    title: 'Foto',
    message: 'Envie *FOTOS* do serviço executado (mínimo 1):',
    type: 'photo',
    required: true,
  },
  {
    id: 'confirmar',
    emoji: '✅',
    title: 'Confirmar',
    message: 'Confirmar envio do RDO?',
    type: 'confirm',
    options: [
      { value: 'sim', label: 'Sim, enviar ✅', emoji: '✅' },
      { value: 'mais', label: 'Adicionar mais atividade ➕', emoji: '➕' },
      { value: 'cancelar', label: 'Cancelar ❌', emoji: '❌' },
    ],
    required: true,
  },
]

// ─── Helpers do motor ─────────────────────────────────────────────────────

export function getStepById(id: string): BotStep | undefined {
  return BOT_STEPS.find((s) => s.id === id)
}

export function formatBotMessage(step: BotStep): string {
  let msg = `${step.emoji} ${step.message}\n`
  if (step.options) {
    msg += '\n'
    step.options.forEach((opt) => {
      msg += `${opt.emoji || '•'} ${opt.label}\n`
    })
  }
  return msg
}

export function resolveAnswer(step: BotStep, input: string): { value: string; label: string } | null {
  if (step.type === 'select' && step.options) {
    const idx = parseInt(input, 10)
    if (!isNaN(idx) && idx >= 0 && idx <= step.options.length) {
      if (idx === 0 && step.options.find(o => o.emoji === '0️⃣')) {
        return step.options.find(o => o.emoji === '0️⃣') ?? null
      }
      const opt = step.options[idx - 1]
      return opt ? { value: opt.value, label: opt.label } : null
    }
    // Try matching label directly
    const match = step.options.find(
      (o) => o.label.toLowerCase() === input.toLowerCase() || o.value === input.toLowerCase()
    )
    return match ? { value: match.value, label: match.label } : null
  }
  if (step.type === 'number') {
    const n = parseFloat(input)
    if (isNaN(n)) return null
    return { value: String(n), label: `${n}` }
  }
  if (step.type === 'text') {
    return input.trim() ? { value: input.trim(), label: input.trim() } : null
  }
  if (step.type === 'photo') {
    return { value: 'photo', label: '📸 Foto recebida' }
  }
  if (step.type === 'confirm') {
    const opt = step.options?.find(
      (o, i) => input === String(i + 1) || o.value === input.toLowerCase()
    )
    return opt ? { value: opt.value, label: opt.label } : null
  }
  return null
}
