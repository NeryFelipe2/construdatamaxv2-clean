/**
 * useWhatsappMidia — leitura da tabela whatsapp_midia: mídias reais capturadas
 * dos grupos de campo via Evolution API (fotos, vídeos, áudios, documentos).
 *
 * ACHADO: storage_url está vazio em 100% das 1.679 linhas — o arquivo nunca foi
 * persistido em storage, só o metadado do envio (grupo, autor, tipo, data/hora,
 * nome do arquivo). Por isso não há preview de imagem possível hoje; a tela usa
 * só os metadados reais.
 *
 * Padrão de hook: useState/useCallback/useEffect. Tabela é log histórico
 * (sem campo a resolver/editar) — não há mutation aqui, só load.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface WhatsappMidiaItem {
  id: string
  grupo: string
  arquivo: string
  tipo: string | null
  /** ISO YYYY-MM-DD — null em ~5% das linhas (chat não conseguiu parsear a data). */
  data_chat: string | null
  /** HH:MM:SS */
  hora_chat: string | null
  autor: string | null
  legenda: string | null
  /** Timestamp embutido no nome do arquivo (ex.: PHOTO-2026-07-03-16-12-27) — fallback quando data_chat é null. */
  data_hora_nome_arquivo: string | null
  encontrado_no_chat: boolean
  storage_url: string | null
  created_at: string
}

export function useWhatsappMidia() {
  const [itens, setItens] = useState<WhatsappMidiaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) { setItens([]); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('whatsapp_midia')
        .select('id, grupo, arquivo, tipo, data_chat, hora_chat, autor, legenda, data_hora_nome_arquivo, encontrado_no_chat, storage_url, created_at')
        .order('data_chat', { ascending: false, nullsFirst: false })
        .order('hora_chat', { ascending: false, nullsFirst: false })
        .limit(2000)
      if (e1) throw e1
      setItens((data ?? []) as WhatsappMidiaItem[])
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar mídias do WhatsApp')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { itens, loading, error, reload: load }
}
