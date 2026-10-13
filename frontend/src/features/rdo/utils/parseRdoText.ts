/**
 * parseRdoText.ts
 * Parses a structured field-report text message into RDO form data.
 *
 * Supports both the original "Equipe rede:" block format and flat key-value lines:
 *   Local: Rua das Palmeiras, nº 100
 *   OS: 2024/0587
 *   Contrato: CT-123
 *   Gerente de Contrato: Eng. João Silva
 *   Técnico de Segurança: Carlos Lima
 *   Empreiteira: Construtora ABC
 *   Serviço: Assentamento de rede de esgoto DN200
 *   Funcionários Diretos: 18
 *   Funcionários Indiretos: 4
 *   Clima Manhã: Ensolarado
 *   Clima Tarde: Nublado
 *   Clima Noite: Limpo
 */
import type { RdoEquipmentEntry, RdoServiceEntry, RdoTrechoEntry, RdoTrechoStatus } from '@/types'
import {
  parseApontamentoWcr as lerApontamentoWcr,
  type ApontamentoWcr as ApontamentoWcrLido,
} from './apontamentoWcr'
import { hojeLocalISO } from '@/lib/utils'

const NI = 'Não informado'

export interface ParsedRdoData {
  responsible:   string
  services:      Omit<RdoServiceEntry,   'id'>[]
  trechos:       Omit<RdoTrechoEntry,    'id'>[]
  equipment:     Omit<RdoEquipmentEntry, 'id'>[]
  manpower:      { foremanCount: number; officialCount: number; helperCount: number; operatorCount: number }
  employeeNames: string[]
  observations:  string
  date?:         string

  // New identification fields (default to NI = 'Não informado')
  local:                      string
  gerenteContrato:            string
  tecnicoSeguranca:           string
  nomeEmpreiteira:            string
  servicoExecutar:            string
  ocorrencias:                string
  funcionariosDiretos:        number
  funcionariosIndiretos:      number
  qtdEquipamentosFerramentas: number
  numeroOS:                   string
  numeroContrato:             string
  climaManha:                 string
  climaTarde:                 string
  climaNoite:                 string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm(s: string) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') }

function extractMeters(text: string): number {
  const m = text.match(/(\d+(?:\.\d+)?)\s*[Mm](?:\s|,|$)/)
  return m ? parseFloat(m[1]) : 0
}

function parseUnit(raw: string): string {
  const u = raw.trim().toLowerCase()
  if (u === 'm' || u === 'metros' || u === 'metro') return 'm'
  if (u === 'un' || u === 'unid' || u === 'unidade' || u === 'unidades') return 'un'
  if (u === 'sc' || u === 'saco' || u === 'sacos') return 'sc'
  if (u === 'br' || u === 'barra' || u === 'barras') return 'br'
  if (u === 'kg' || u === 'kgf') return 'kg'
  if (u === 't' || u === 'ton') return 't'
  return u || 'un'
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/**
 * Try to match a line against a list of keyword patterns.
 * Returns the value part (after the colon) if matched, else null.
 */
function matchKeyValue(lineNorm: string, lineRaw: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    const kwNorm = norm(kw)
    if (lineNorm.startsWith(kwNorm + ':') || lineNorm.startsWith(kwNorm + ' :')) {
      const colonIdx = lineRaw.indexOf(':')
      if (colonIdx >= 0) {
        const val = lineRaw.slice(colonIdx + 1).trim()
        return val || null
      }
    }
  }
  return null
}

/** Parse a number from a string like "18" or "18 pessoas" */
function parseCount(s: string): number {
  const m = s.match(/^(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

// ─── Modelo de APONTAMENTO DIÁRIO da obra ────────────────────────────────────
//
// É o formato que circula todo dia no grupo — escrito com HÍFEN, não com
// dois-pontos, e com as siglas de água/esgoto uma por linha:
//
//   Produção - 03/10          ← isto é a DATA do apontamento
//   Equipe - Juan
//   Núcleo - Boi Malhado
//   Imóvel - Travessa Vaness  ← pode repetir (a equipe roda várias ruas no dia)
//
//   SERVIÇO ÁGUA
//   PRA - 48
//   LA - 3
//   ...
//   obs: ...
//
// ⚠️ UM INTERPRETADOR SÓ (regra 8 do pacote RDO·FCP·Caixa): a leitura é a de
// ./apontamentoWcr.ts — a mesma do painel RDO WCR. Este bloco só traduz o
// resultado para o formato do RDO genérico. Antes havia aqui um segundo parser
// que descartava sigla em branco e linha não reconhecida sem avisar.

/**
 * Grafias que a equipe usa e o interpretador do pacote não conhece. Reescritas ANTES da leitura,
 * para a lista branca continuar sendo uma só: IHM → HM, C.UMA → Caixa UMA, INT → Interligação,
 * C.INSP → CI, Líder/Encarregado → Equipe, Imóveis/Local/Endereço → Imóvel.
 */
const APELIDOS_WCR: Record<string, string> = {
  ihm: 'HM', int: 'Interligação', 'c.uma': 'Caixa UMA', 'c uma': 'Caixa UMA', uma: 'Caixa UMA',
  'c.insp': 'CI', 'c insp': 'CI', lider: 'Equipe', encarregado: 'Equipe',
  imoveis: 'Imóvel', local: 'Imóvel', endereco: 'Imóvel',
}

/** Troca só a CHAVE da linha ("IHM - 2" → "HM - 2"), nunca o valor. */
export function aplicarApelidosWcr(texto: string): string {
  return texto.split(/\r?\n/).map((linha) => {
    const m = linha.match(/^(\s*)([^:\-–—]+?)(\s*[:\-–—].*)$/)
    if (!m) return linha
    const canonica = APELIDOS_WCR[norm(m[2])]
    return canonica ? `${m[1]}${canonica}${m[3]}` : linha
  }).join('\n')
}

/** Rótulo e unidade no vocabulário que o RDO/Produção já usavam. */
const ROTULO_RDO: Record<string, { rotulo: string; unidade: string }> = {
  'PRA':          { rotulo: 'PRA — rede de água',                      unidade: 'm' },
  'LA':           { rotulo: 'LA — ligação de água',                    unidade: 'un' },
  'LIA':          { rotulo: 'LIA — ligação intradomiciliar de água',   unidade: 'un' },
  'Caixa UMA':    { rotulo: 'C.UMA — caixa UMA',                       unidade: 'un' },
  'HM':           { rotulo: 'IHM — hidrômetro',                        unidade: 'un' },
  'Interligação': { rotulo: 'INT — interligação',                      unidade: 'un' },
  'Válvula':      { rotulo: 'Válvula',                                 unidade: 'un' },
  'PRE':          { rotulo: 'PRE — rede de esgoto',                    unidade: 'm' },
  'LE':           { rotulo: 'LE — ligação de esgoto',                  unidade: 'un' },
  'LIE':          { rotulo: 'LIE — ligação intradomiciliar de esgoto', unidade: 'un' },
  'PV':           { rotulo: 'PV — poço de visita',                     unidade: 'un' },
  'PI':           { rotulo: 'PI — poço de inspeção',                   unidade: 'un' },
  'CI':           { rotulo: 'C.INSP — caixa de inspeção',              unidade: 'un' },
}

/**
 * As siglas COM número viram serviços do RDO (rótulos do vocabulário da Produção). Sigla sem
 * número fica de fora — não informado não é zero. Metros de rede voltam somados à parte.
 */
export function servicosDoApontamentoWcr(lido: Pick<ApontamentoWcrLido, 'linhas'>): {
  services: Omit<RdoServiceEntry, 'id'>[]
  metrosRede: number
} {
  const services: Omit<RdoServiceEntry, 'id'>[] = []
  let metrosRede = 0
  for (const l of lido.linhas) {
    if (l.quantidade === undefined) continue
    const r = ROTULO_RDO[l.sigla] ?? { rotulo: l.rotulo, unidade: l.unidade === 'M' ? 'm' : 'un' }
    services.push({ description: r.rotulo, quantity: l.quantidade, unit: r.unidade })
    if (l.unidade === 'M') metrosRede += l.quantidade
  }
  return { services, metrosRede }
}

export interface ApontamentoWcr {
  date?: string
  responsible: string
  local: string
  services: Omit<RdoServiceEntry, 'id'>[]
  metrosRede: number
  observations: string
  /** A leitura completa (siglas sem número, ano deduzido, linhas não entendidas). */
  lido: ApontamentoWcrLido
}

/**
 * Lê o modelo de apontamento. Devolve null quando o texto NÃO é esse modelo —
 * aí o parser genérico (Local:, Empreiteira:, Equipe rede:) continua valendo.
 *
 * Sigla SEM NÚMERO não vira serviço (não informado ≠ zero); um 0 ESCRITO vira serviço de
 * quantidade 0. Linha que o interpretador não entendeu vai para as observações marcada
 * "[não entendido]" — nunca some.
 */
export function parseApontamentoWcr(raw: string): ApontamentoWcr | null {
  const lido = lerApontamentoWcr(aplicarApelidosWcr(raw), { hoje: hojeLocalISO() })

  // É este modelo se tem ao menos duas siglas (mesmo em branco), ou uma sigla mais data/equipe/núcleo.
  const pareceWcr = lido.linhas.length >= 2 ||
    (lido.linhas.length >= 1 && !!(lido.data || lido.equipe || lido.nucleo))
  if (!pareceWcr) return null

  const { services, metrosRede } = servicosDoApontamentoWcr(lido)

  const obs = (lido.observacoes ?? '')
    .split('\n')
    .filter((x) => !norm(x).startsWith('qualquer coisa fora da lista'))
  const naoEntendidas = lido.naoEntendidas.map((x) => `[não entendido] ${x}`)

  return {
    date: lido.data,
    responsible: lido.equipe ?? '',
    local: [lido.imoveis.join(' · '), lido.nucleo ?? ''].filter(Boolean).join(' — '),
    services,
    metrosRede,
    observations: [...obs, ...naoEntendidas].join('\n').trim(),
    lido,
  }
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseRdoText(raw: string): ParsedRdoData {
  // O modelo de apontamento da obra tem precedência: o parser genérico não sabe
  // que "Produção - 03/10" é data nem que PRA/PRE são metros de rede.
  const apontamento = parseApontamentoWcr(raw)
  if (apontamento) {
    return {
      responsible: apontamento.responsible,
      services: apontamento.services,
      trechos: [],
      equipment: [],
      manpower: { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0 },
      employeeNames: apontamento.responsible ? apontamento.responsible.split(' / ') : [],
      observations: apontamento.observations,
      date: apontamento.date,
      local: apontamento.local || NI,
      gerenteContrato: NI,
      tecnicoSeguranca: NI,
      nomeEmpreiteira: NI,
      servicoExecutar: apontamento.services.length
        ? apontamento.services.map((s) => `${s.description} ${s.quantity}${s.unit}`).join(' · ')
        : NI,
      ocorrencias: apontamento.observations || NI,
      funcionariosDiretos: 0,
      funcionariosIndiretos: 0,
      qtdEquipamentosFerramentas: 0,
      numeroOS: NI,
      numeroContrato: NI,
      climaManha: NI,
      climaTarde: NI,
      climaNoite: NI,
    }
  }

  return parseRdoTextGenerico(raw)
}

function parseRdoTextGenerico(raw: string): ParsedRdoData {
  const lines = raw.split('\n').map((l) => l.trim())

  const services:  Omit<RdoServiceEntry,   'id'>[] = []
  const trechos:   Omit<RdoTrechoEntry,    'id'>[] = []
  const equipment: Omit<RdoEquipmentEntry, 'id'>[] = []
  const employeeNames: string[] = []
  const obsLines: string[] = []
  const manpower = { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0 }
  let responsible = ''
  let trechoCounter = 0
  let parsedDate: string | undefined

  // New identification fields
  let local                      = NI
  let gerenteContrato            = NI
  let tecnicoSegurancaField      = NI
  let nomeEmpreiteira            = NI
  let servicoExecutar            = NI
  let ocorrencias                = NI
  let funcionariosDiretos        = 0
  let funcionariosIndiretos      = 0
  let qtdEquipamentosFerramentas = 0
  let numeroOS                   = NI
  let numeroContrato             = NI
  let climaManha                 = NI
  let climaTarde                 = NI
  let climaNoite                 = NI

  // Detect section boundaries by scanning for section-start keywords
  type SectionType = 'team' | 'materials' | 'equipment' | 'personnel' | 'none'

  let currentSection: SectionType = 'none'
  let currentSystem: 'agua' | 'esgoto' | 'drenagem' | 'estrutura' | 'pavimentacao' | 'outro' = 'outro'

  // Personnel role → manpower field
  const PERSONNEL_MAP: Array<[RegExp, keyof typeof manpower, boolean]> = [
    [/ajudante/,                         'helperCount',   false],
    [/pedreiro/,                         'officialCount', false],
    [/encanador/,                        'officialCount', false],
    [/operador/,                         'operatorCount', false],
    [/encarregado/,                      'foremanCount',  false],
    [/motorista/,                        'helperCount',   false],
    [/apontador/,                        'helperCount',   false],
    [/tecnico\s+de\s+seguranca/,         'helperCount',   true],  // added to obs only
    [/engenheiro/,                       'foremanCount',  true],  // added to obs only
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const lineNorm = norm(line)

    // ── Key-value identification fields (checked before everything) ────────

    // Date
    if (!parsedDate) {
      const dateKv = matchKeyValue(lineNorm, line, ['data', 'date'])
      if (dateKv) {
        const dm = dateKv.match(/(\d{2})\/(\d{2})\/(\d{4})/) || dateKv.match(/(\d{4})-(\d{2})-(\d{2})/)
        if (dm) {
          parsedDate = dm[0].includes('-')
            ? dm[0]
            : `${dm[3]}-${dm[2]}-${dm[1]}`
        }
        continue
      }
    }

    // Local / Localização
    if (local === NI) {
      const v = matchKeyValue(lineNorm, line, ['local', 'localizacao', 'localização', 'endereço', 'endereco', 'obra'])
      if (v) { local = v; continue }
    }

    // Nº OS / Ordem de Serviço
    if (numeroOS === NI) {
      const v = matchKeyValue(lineNorm, line, ['os', 'n° os', 'nº os', 'num os', 'ordem de servico', 'ordem de serviço', 'numero os', 'número os'])
      if (v) { numeroOS = v; continue }
    }

    // N° Contrato
    if (numeroContrato === NI) {
      const v = matchKeyValue(lineNorm, line, ['contrato', 'n° contrato', 'nº contrato', 'numero contrato', 'número contrato'])
      if (v) { numeroContrato = v; continue }
    }

    // Gerente de Contrato
    if (gerenteContrato === NI) {
      const v = matchKeyValue(lineNorm, line, ['gerente de contrato', 'gerente contrato', 'gerente', 'responsavel contrato', 'responsável contrato'])
      if (v) { gerenteContrato = v; continue }
    }

    // Técnico de Segurança
    if (tecnicoSegurancaField === NI) {
      const v = matchKeyValue(lineNorm, line, ['tecnico de seguranca', 'técnico de segurança', 'tseg', 'tec seg', 'tecnico seg'])
      if (v) { tecnicoSegurancaField = v; continue }
    }

    // Empreiteira / Empresa
    if (nomeEmpreiteira === NI) {
      const v = matchKeyValue(lineNorm, line, ['empreiteira', 'empresa', 'subcontratada', 'subempreiteira', 'contratada'])
      if (v) { nomeEmpreiteira = v; continue }
    }

    // Serviço a executar
    if (servicoExecutar === NI) {
      const v = matchKeyValue(lineNorm, line, ['servico a executar', 'serviço a executar', 'atividade', 'servico principal', 'serviço principal', 'descricao servico', 'descrição serviço'])
      if (v) { servicoExecutar = v; continue }
    }

    // Ocorrências
    if (ocorrencias === NI) {
      const v = matchKeyValue(lineNorm, line, ['ocorrencias', 'ocorrência', 'ocorrencias do dia', 'incidente', 'incidentes'])
      if (v) { ocorrencias = v; continue }
    }

    // Funcionários Diretos
    if (funcionariosDiretos === 0) {
      const v = matchKeyValue(lineNorm, line, ['funcionarios diretos', 'funcionários diretos', 'func diretos', 'diretos'])
      if (v) { funcionariosDiretos = parseCount(v); continue }
    }

    // Funcionários Indiretos
    if (funcionariosIndiretos === 0) {
      const v = matchKeyValue(lineNorm, line, ['funcionarios indiretos', 'funcionários indiretos', 'func indiretos', 'indiretos'])
      if (v) { funcionariosIndiretos = parseCount(v); continue }
    }

    // Quantidade de Equipamentos / Ferramentas (total count)
    if (qtdEquipamentosFerramentas === 0) {
      const v = matchKeyValue(lineNorm, line, ['qtd equipamentos', 'qtd. equipamentos', 'total equipamentos', 'ferramentas', 'qtd ferramentas'])
      if (v) { qtdEquipamentosFerramentas = parseCount(v); continue }
    }

    // Clima Manhã
    if (climaManha === NI) {
      const v = matchKeyValue(lineNorm, line, ['clima manha', 'clima manhã', 'tempo manha', 'tempo manhã', 'chuva manha', 'chuva manhã'])
      if (v) { climaManha = v; continue }
    }

    // Clima Tarde
    if (climaTarde === NI) {
      const v = matchKeyValue(lineNorm, line, ['clima tarde', 'tempo tarde', 'chuva tarde'])
      if (v) { climaTarde = v; continue }
    }

    // Clima Noite
    if (climaNoite === NI) {
      const v = matchKeyValue(lineNorm, line, ['clima noite', 'tempo noite', 'chuva noite'])
      if (v) { climaNoite = v; continue }
    }

    // ── Section detection ──────────────────────────────────────────────────

    if (/equipe\s+rede:/i.test(line)) {
      currentSection = 'team'
      const sysRaw = norm(line.split(':').slice(1).join(':').trim())
      if (sysRaw.includes('esgoto')) currentSystem = 'esgoto'
      else if (sysRaw.includes('agua') || sysRaw.includes('água')) currentSystem = 'agua'
      else if (sysRaw.includes('drenagem')) currentSystem = 'drenagem'
      else currentSystem = 'outro'
      continue
    }

    if (/^(material|materiais)\s*:/i.test(line)) { currentSection = 'materials'; continue }
    if (/^equipamentos?\s*:/i.test(line)) { currentSection = 'equipment'; continue }

    // ── Leader detection (any section) ─────────────────────────────────────
    if (/l[ií]der\s*:/i.test(line)) {
      const nameRaw = line.split(':').slice(1).join(':').trim()
      const names = nameRaw.split(/\/|,/).map((n) => n.trim()).filter(Boolean)
      names.forEach((n) => {
        if (n && !employeeNames.includes(n)) employeeNames.push(n)
      })
      if (!responsible && names.length > 0) responsible = names[0]
      continue
    }

    // ── Personnel detection (any section) ──────────────────────────────────
    {
      let matched = false
      for (const [pattern, field, obsOnly] of PERSONNEL_MAP) {
        if (pattern.test(lineNorm)) {
          const numMatch = line.match(/:\s*(\d+)/)
          if (numMatch) {
            const count = parseInt(numMatch[1], 10)
            if (!obsOnly) {
              manpower[field] += count
            }
            obsLines.push(line)
            matched = true
            break
          }
        }
      }
      if (matched) continue
    }

    // ── Process by current section ─────────────────────────────────────────

    if (currentSection === 'team') {
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0 && colonIdx < line.length - 1) {
        const location    = line.slice(0, colonIdx).trim()
        const description = line.slice(colonIdx + 1).trim()
        const meters      = extractMeters(description) || extractMeters(location)

        trechoCounter++
        const code = `T-${String(trechoCounter).padStart(2, '0')}`
        const status: RdoTrechoStatus = meters > 0 ? 'in_progress' : 'not_started'

        trechos.push({
          trechoCode:        code,
          trechoDescription: `${location} — ${description}`,
          plannedMeters:     0,
          executedMeters:    meters,
          status,
          source:            'rdo',
          system:            currentSystem,
        })

        services.push({
          description: description || line,
          quantity:    meters || 1,
          unit:        meters > 0 ? 'm' : 'un',
        })

        obsLines.push(line)
      } else if (line.length > 2) {
        obsLines.push(line)
      }
      continue
    }

    if (currentSection === 'materials') {
      const matMatch = line.match(/^(\d+(?:\.\d+)?)\s*(M|m|un|sc|br|kg|t|m²|m2|l|cx|pç|rlo)?\s+(.+)$/i)
      if (matMatch) {
        const qty  = parseFloat(matMatch[1])
        const unit = matMatch[2] ? parseUnit(matMatch[2]) : 'un'
        const desc = matMatch[3].trim()
        services.push({ description: desc, quantity: qty, unit })
      } else if (/^\d/.test(line)) {
        const parts = line.split(/\s+/)
        const qty = parseFloat(parts[0]) || 1
        const desc = parts.slice(1).join(' ')
        if (desc) services.push({ description: desc, quantity: qty, unit: 'un' })
      }
      continue
    }

    if (currentSection === 'equipment') {
      const eqMatch = line.match(/^(\d+)\s+(.+)$/)
      if (eqMatch) {
        const qty  = parseInt(eqMatch[1], 10)
        const name = titleCase(eqMatch[2].trim())
        equipment.push({ name, quantity: qty, hours: 8 })
      }
      continue
    }

    // Default — accumulate in observations
    obsLines.push(line)
  }

  // Auto-compute qtdEquipamentosFerramentas from equipment list if not set
  if (qtdEquipamentosFerramentas === 0 && equipment.length > 0) {
    qtdEquipamentosFerramentas = equipment.reduce((acc, e) => acc + e.quantity, 0)
  }

  const observations = obsLines
    .filter((l) => l.length > 3)
    .join('\n')
    .slice(0, 1900)

  return {
    responsible,
    services,
    trechos,
    equipment,
    manpower,
    employeeNames,
    observations,
    date: parsedDate,
    local,
    gerenteContrato,
    tecnicoSeguranca: tecnicoSegurancaField,
    nomeEmpreiteira,
    servicoExecutar,
    ocorrencias,
    funcionariosDiretos,
    funcionariosIndiretos,
    qtdEquipamentosFerramentas,
    numeroOS,
    numeroContrato,
    climaManha,
    climaTarde,
    climaNoite,
  }
}
