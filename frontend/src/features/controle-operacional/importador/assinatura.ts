/**
 * assinatura.ts — "que planilha é esta?" ANTES de ler qualquer linha.
 *
 * Existem dois modelos com os MESMOS prefixos de aba e conteúdo diferente:
 *   - CONTROLE OPERACIONAL SABESP rev16 (Bertioga/Santos): "03." é CADASTRO DE SERVIÇOS;
 *   - CONTROLE OPERACIONAL CONSÓRCIO ZN: "03." é CARTEIRA DE REDE, "10." é MEDIÇÃO e a
 *     "08. EQUIPE" não tem CONTRATO.
 * Ler a ZN com o leitor da rev16 gravaria metro de rede como serviço e boletim como RDO,
 * sem erro nenhum. Por isso o importador RECUSA tudo que não for a rev16.
 */
import type { WorkBook, WorkSheet } from 'xlsx'
import { normCabecalho } from '../dominio/normalizar'

export type ModeloPlanilha = 'rev16' | 'zn' | 'desconhecido'

export interface Assinatura {
  modelo: ModeloPlanilha
  ok: boolean
  mensagem: string
}

export function abaPorPrefixo(wb: WorkBook, prefixo: string): string | null {
  // "01. " com espaço para não confundir com "01A."
  return wb.SheetNames.find((n) => n.trim().toUpperCase().startsWith(prefixo.toUpperCase())) ?? null
}

function cabecalho(ws: WorkSheet | undefined, col: string): string {
  const c = ws?.[`${col}4`]
  return c && !c.f ? normCabecalho(c.v) : ''
}

export function verificarAssinatura(wb: WorkBook): Assinatura {
  const nomes = wb.SheetNames.map(normCabecalho)
  const aba03 = abaPorPrefixo(wb, '03.')
  const n03 = aba03 ? normCabecalho(aba03) : ''

  const pareceZn = n03.startsWith('03. CARTEIRA DE REDE') || nomes.some((n) => n.startsWith('10. MEDICAO'))
    || nomes.some((n) => n.startsWith('09. FUNIL DE MEDICAO'))
  if (pareceZn) {
    return {
      modelo: 'zn', ok: false,
      mensagem:
        'Esta é a planilha do CONTROLE OPERACIONAL do CONSÓRCIO ZN (a aba 03 é "CARTEIRA DE REDE" e a 10 é "MEDIÇÃO"). ' +
        'Este importador lê só o CONTROLE OPERACIONAL SABESP rev16 (Bertioga/Santos). Os prefixos das abas são os mesmos, ' +
        'mas o conteúdo é outro — importar gravaria metro de rede como serviço. Nada foi lido.',
    }
  }

  if (!aba03 || !n03.startsWith('03. CADASTRO DE SERVICOS')) {
    return {
      modelo: 'desconhecido', ok: false,
      mensagem:
        'Não reconheci o modelo desta planilha: falta a aba "03. CADASTRO DE SERVIÇOS". ' +
        'Use o arquivo CONTROLE OPERACIONAL SABESP (rev16 ou mais nova). Nada foi lido.',
    }
  }

  const ws = wb.Sheets[aba03]
  if (cabecalho(ws, 'A') !== 'ID' || cabecalho(ws, 'B') !== 'CONTRATO') {
    return {
      modelo: 'desconhecido', ok: false,
      mensagem:
        `A aba "${aba03}" existe, mas a linha 4 não tem "ID" em A4 e "CONTRATO" em B4 ` +
        `(achei "${cabecalho(ws, 'A') || 'vazio'}" e "${cabecalho(ws, 'B') || 'vazio'}"). ` +
        'O layout mudou em relação à rev16 — nada foi lido para não gravar coluna trocada.',
    }
  }

  return { modelo: 'rev16', ok: true, mensagem: 'CONTROLE OPERACIONAL SABESP rev16 reconhecido.' }
}
