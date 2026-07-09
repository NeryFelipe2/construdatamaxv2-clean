/**
 * Frota real da obra WCR Boi Malhado — fonte: CONTROLE DE FROTA.xlsx (05/07/2026).
 * Alimenta o Kanban de Frota (alocação equipe × equipamento + "pedir saída").
 */

export type FrotaStatus = 'operacao' | 'manutencao' | 'pedir_saida' | 'devolvido'

export interface FrotaItem {
  id: string
  placa: string
  tipo: string
  locador: string
  motorista: string
  custoMensal: number        // R$/mês atual (0 = consórcio/na medição ou já devolvido)
  custoOriginal?: number     // R$/mês que custava antes de devolver (p/ calcular economia)
  status: FrotaStatus
  equipe: string             // alocação (— = não alocado)
  obs: string
}

export const STATUS_LABEL: Record<FrotaStatus, string> = {
  operacao: 'Em operação',
  manutencao: 'Manutenção',
  pedir_saida: 'Pedir saída',
  devolvido: 'Devolvido',
}

export const STATUS_ORDER: FrotaStatus[] = ['operacao', 'manutencao', 'pedir_saida', 'devolvido']

export const WCR_FROTA: FrotaItem[] = [
  { id: 'FUE0J97', placa: 'FUE-0J97', tipo: 'Retroescavadeira New Holland', locador: '6M — Marcondes', motorista: 'Juan (op.)', custoMensal: 19500, status: 'operacao', equipe: '—', obs: 'Op. Juan + hora extra' },
  { id: 'FBW8C52', placa: 'FBW-8C52', tipo: 'Caminhão Pipa Mercedes-Benz 1718', locador: 'Nildo', motorista: '—', custoMensal: 16000, status: 'operacao', equipe: '—', obs: 'Começou 01/07' },
  { id: 'SHALON', placa: '—', tipo: 'Mini Escavadeira Shalon', locador: 'J.C Shalom — Alexandre', motorista: '—', custoMensal: 15000, status: 'operacao', equipe: '—', obs: 'Desde 09/06 (frete R$ 1.600 ida/volta)' },
  { id: 'SY26C', placa: '—', tipo: 'Retroescavadeira SY26C', locador: 'FAS — Luis', motorista: '—', custoMensal: 14000, status: 'operacao', equipe: '—', obs: '15 dias abr + maio = R$ 21.000 (pagto 30/07)' },
  { id: 'GHE4F52', placa: 'GHE-4F52', tipo: 'Caminhão VW Robust Basculante', locador: 'ED KAR — Felipe', motorista: 'Aparecido', custoMensal: 13500, status: 'operacao', equipe: '—', obs: 'Começou 23/06' },
  { id: 'EUV5C56', placa: 'EUV-5C56', tipo: 'Caminhão Ford Cargo Basculante', locador: 'Jailton', motorista: '—', custoMensal: 12000, status: 'operacao', equipe: '—', obs: 'Começou 01/07' },
  { id: 'DTD0G45', placa: 'DTD-0G45', tipo: 'Caminhão VW 3/4 (5 atrás)', locador: 'FAS — Luis', motorista: 'Heliel', custoMensal: 11500, status: 'manutencao', equipe: '—', obs: 'PARADO desde 29/06 (manutenção no canteiro)' },
  { id: 'FNQ3725', placa: 'FNQ-3725', tipo: 'Caminhão Ford 3/4 (5 atrás)', locador: 'FAS — Luis', motorista: 'Juan', custoMensal: 10500, status: 'operacao', equipe: '—', obs: '' },
  { id: 'DAH2250', placa: 'DAH-2250', tipo: 'Caminhão VW 3/4 (8 atrás)', locador: 'FAS — Luis', motorista: 'Éder', custoMensal: 10500, status: 'operacao', equipe: '—', obs: 'Sem hodômetro (reparo solicitado 03/07)' },
  { id: 'KOMBI-JAILTON', placa: '—', tipo: 'Kombi', locador: 'Jailton', motorista: '—', custoMensal: 4000, status: 'operacao', equipe: '—', obs: 'Começou 03/07' },
  { id: 'EEW7B96', placa: 'EEW-7B96', tipo: 'Pálio (apoio)', locador: 'Jailton', motorista: '—', custoMensal: 2000, status: 'operacao', equipe: '—', obs: 'Começou 01/07' },
  { id: 'LLY5D04', placa: 'LLY-5D04', tipo: 'Caminhão Iveco Basculante', locador: 'Consórcio ZN', motorista: 'Marcos', custoMensal: 0, status: 'operacao', equipe: '—', obs: 'Na medição (custo deduzido)' },
  { id: 'FSZ8C19', placa: 'FSZ-8C19', tipo: 'Mini caminhão HR Hyundai', locador: 'Consórcio ZN', motorista: 'Cristian', custoMensal: 0, status: 'operacao', equipe: '—', obs: 'Na medição' },
  { id: 'TLW0E78', placa: 'TLW-0E78', tipo: 'Retroescavadeira', locador: 'Consórcio ZN (João)', motorista: '—', custoMensal: 0, status: 'operacao', equipe: '—', obs: 'Na medição' },
  { id: 'SY35U', placa: '—', tipo: 'Retroescavadeira SY35U', locador: 'Consórcio ZN (João)', motorista: '—', custoMensal: 0, status: 'operacao', equipe: '—', obs: 'Na medição (série SY003CF1283K8)' },
  { id: 'EZM6E51', placa: 'EZM-6E51', tipo: 'Kombi', locador: 'Consórcio ZN', motorista: '—', custoMensal: 0, status: 'manutencao', equipe: '—', obs: 'Em manutenção' },
  { id: 'DCB9F43', placa: 'DCB-9F43', tipo: 'Caminhão VW', locador: 'FAS — Luis', motorista: '—', custoMensal: 0, custoOriginal: 12500, status: 'devolvido', equipe: '—', obs: 'Em manutenção desde 10/06 · devolvido por e-mail' },
  { id: 'SY55C', placa: '—', tipo: 'Mini Escavadeira Hidráulica SY55C', locador: 'FAS', motorista: '—', custoMensal: 0, custoOriginal: 21000, status: 'devolvido', equipe: '—', obs: 'Retirada em 30/06/2026' },
]
