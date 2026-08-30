/**
 * useWhatsappLogs — leitura da tabela whatsapp_logs: log bruto do webhook
 * Evolution API (mensagens in/out, eventos de conexão, QR code, disparos).
 *
 * ACHADO IMPORTANTE: as 3.771 linhas cobrem só 23–26/04 + 03/05/2026 — um teste
 * de configuração do gateway, MESES antes da operação real da WCR (que começa
 * em junho/2026 pelas outras tabelas do projeto). O conteúdo das mensagens é de
 * grupos públicos aleatórios (não WCR) capturados pelo número pessoal usado no
 * teste — confirmado pelo campo `payload` (instance "construdata-felipe",
 * conteúdo sobre sinaleiro freelancer, festa, etc., nada de saneamento). A
 * tabela também não guarda nome de grupo, só `telefone` (JID cru).
 *
 * Por isso o hook/tela trata isso como "diagnóstico técnico do gateway", nunca
 * como atividade da obra — rotular como grupo WCR seria enganoso.
 *
 * Padrão de hook: useState/useCallback/useEffect, load-only.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface WhatsappLogItem {
  id: string
  telefone: string | null
  direction: string
  tipo: string | null
  mensagem: string | null
  status: string | null
  created_at: string
}

export function useWhatsappLogs() {
  const [logs, setLogs] = useState<WhatsappLogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) { setLogs([]); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('whatsapp_logs')
        .select('id, telefone, direction, tipo, mensagem, status, created_at')
        .order('created_at', { ascending: false })
        .limit(4000)
      if (e1) throw e1
      setLogs((data ?? []) as WhatsappLogItem[])
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar log do gateway WhatsApp')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { logs, loading, error, reload: load }
}
