import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileImage, FileText, Upload, XCircle } from 'lucide-react'
import { useProjectContext } from '@/store/projectContext'
import { useRdoStore } from '@/store/rdoStore'
import type { RDO } from '@/types'

const textCls = 'w-full rounded-lg bg-[#3d3d3d] border border-[#525252] px-3 py-2.5 text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50 resize-y'
const btnBase = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

function statusLabel(rdo: RDO) {
  const status = rdo.statusRevisao || 'rascunho'
  const map: Record<string, string> = {
    rascunho: 'Rascunho',
    extraido: 'Extraido',
    em_revisao: 'Em revisao',
    finalizado: 'Finalizado',
    rejeitado: 'Rejeitado',
  }
  return map[status] || status
}

function statusClass(rdo: RDO) {
  const status = rdo.statusRevisao || 'rascunho'
  if (status === 'finalizado') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  if (status === 'rejeitado') return 'bg-red-500/15 text-red-300 border-red-500/30'
  if (status === 'extraido') return 'bg-sky-500/15 text-sky-300 border-sky-500/30'
  return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
}

export function RdoAutomaticoPanel() {
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const {
    rdos,
    isSaving,
    automaticoResult,
    createAutomaticoFromText,
    uploadAutomatico,
    revisarRdo,
    finalizarRdo,
    rejeitarRdo,
  } = useRdoStore()

  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const selected = useMemo(() => rdos.find((r) => r.id === selectedId) ?? rdos.find((r) => r.statusRevisao && r.statusRevisao !== 'finalizado' && r.statusRevisao !== 'rejeitado') ?? null, [rdos, selectedId])
  const reviewQueue = useMemo(() => rdos.filter((r) => (r.statusRevisao || 'rascunho') !== 'finalizado' && (r.statusRevisao || 'rascunho') !== 'rejeitado').slice(0, 12), [rdos])
  const extraction = automaticoResult?.extraction
  const fields = extraction?.fields ?? {}
  const pending = extraction?.pending_fields ?? []
  const evidencePayload = automaticoResult?.evidence?.payload as Record<string, unknown> | undefined
  const preview = typeof evidencePayload?.preview_base64 === 'string' ? evidencePayload.preview_base64 : ''

  async function handleText() {
    if (!activeProjectId) { setMessage('Selecione um projeto antes.'); return }
    if (!text.trim()) { setMessage('Cole o texto do RDO.'); return }
    const result = await createAutomaticoFromText(activeProjectId, text)
    setMessage(result ? 'RDO automatico criado para revisao.' : 'Falha ao criar RDO automatico.')
  }

  async function handleUpload() {
    if (!activeProjectId) { setMessage('Selecione um projeto antes.'); return }
    if (!file) { setMessage('Selecione uma foto, PDF ou TXT.'); return }
    const fd = new FormData()
    fd.append('arquivo', file)
    if (text.trim()) fd.append('texto', text)
    const result = await uploadAutomatico(activeProjectId, fd)
    setMessage(result ? 'Arquivo preservado e RDO criado para revisao.' : 'Falha ao processar upload.')
  }

  async function handleFinalize(rdo: RDO) {
    if (!activeProjectId) return
    const result = await finalizarRdo(activeProjectId, rdo.id)
    setMessage(result ? 'RDO finalizado e fontes de medicao geradas.' : 'Falha ao finalizar RDO.')
  }

  async function handleReject(rdo: RDO) {
    if (!activeProjectId) return
    const result = await rejeitarRdo(activeProjectId, rdo.id, 'Rejeitado pela revisao web')
    setMessage(result ? 'RDO rejeitado.' : 'Falha ao rejeitar RDO.')
  }

  async function handleSendReview(rdo: RDO) {
    if (!activeProjectId) return
    const result = await revisarRdo(activeProjectId, rdo.id, { status_revisao: 'em_revisao', revisado_em: new Date().toISOString() })
    setMessage(result ? 'RDO enviado para revisao.' : 'Falha ao revisar RDO.')
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-white font-semibold text-lg">RDO Automatico V5</h2>
          <p className="text-[#a3a3a3] text-xs mt-1">Texto, foto ou documento viram RDO revisavel com evidencia, assinatura, medicao e desvios.</p>
        </div>
        <span className="text-xs text-[#a3a3a3]">{activeProjectId ? 'Projeto ativo conectado' : 'Nenhum projeto selecionado'}</span>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3d3d3d] px-4 py-2 text-xs text-[#f5f5f5]">
          <AlertTriangle size={14} className="text-[#f97316]" />
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="rounded-xl border border-[#525252] bg-[#333333] p-5 space-y-4">
          <div className="flex items-center gap-2 text-[#f5f5f5] font-semibold text-sm">
            <FileText size={16} className="text-[#f97316]" />
            Preencher com Texto
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className={textCls}
            placeholder="Cole a mensagem completa do engenheiro: data, local, empreiteira, producao, mao de obra, custos, desvios, ocorrencias, assinatura..."
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={handleText} disabled={isSaving || !text.trim()} className={`${btnBase} bg-[#0ea5e9] text-white hover:bg-[#0284c7]`}>
              <FileText size={14} />
              Criar RDO por Texto
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-[#525252] bg-[#333333] p-5 space-y-4">
          <div className="flex items-center gap-2 text-[#f5f5f5] font-semibold text-sm">
            <FileImage size={16} className="text-[#f97316]" />
            Upload com Evidencia
          </div>
          <label className="block rounded-xl border-2 border-dashed border-[#525252] bg-[#3d3d3d] p-6 text-center cursor-pointer hover:border-[#f97316]/50 transition-colors">
            <Upload size={28} className="mx-auto mb-2 text-[#a3a3a3]" />
            <div className="text-sm text-[#f5f5f5]">{file ? file.name : 'Selecionar foto, PDF ou TXT do RDO'}</div>
            <div className="text-[10px] text-[#6b6b6b] mt-1">A imagem original fica preservada para auditoria.</div>
            <input className="hidden" type="file" accept="image/*,.pdf,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {preview && <img src={preview} className="max-h-56 rounded-lg border border-[#525252] object-contain bg-black/30" alt="Evidencia do RDO" />}
          <button onClick={handleUpload} disabled={isSaving || !file} className={`${btnBase} bg-[#f97316] text-white hover:bg-[#ea580c]`}>
            <Upload size={14} />
            Processar Upload
          </button>
        </section>
      </div>

      {extraction && (
        <section className="rounded-xl border border-[#525252] bg-[#333333] p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-[#f5f5f5] font-semibold text-sm">Resultado da extracao</h3>
            <span className={`text-xs px-2 py-1 rounded border ${pending.length ? 'border-yellow-500/30 text-yellow-300 bg-yellow-500/10' : 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'}`}>
              {pending.length ? `${pending.length} campo(s) pendente(s)` : 'Pronto para revisao'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(fields).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-[#3d3d3d] border border-[#525252] p-3">
                <div className="text-[10px] uppercase tracking-wider text-[#6b6b6b]">{key}</div>
                <div className="text-xs text-[#f5f5f5] mt-1 break-words">{String(value ?? '-')}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-[#525252] bg-[#333333] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#f5f5f5] font-semibold text-sm">Fila de revisao</h3>
          <span className="text-xs text-[#a3a3a3]">{reviewQueue.length} RDO(s)</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {reviewQueue.map((rdo) => (
            <button
              key={rdo.id}
              type="button"
              onClick={() => setSelectedId(rdo.id)}
              className={`text-left rounded-xl border p-4 transition-colors ${selected?.id === rdo.id ? 'border-[#f97316] bg-[#3d3d3d]' : 'border-[#525252] bg-[#3a3a3a] hover:border-[#6b6b6b]'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[#f5f5f5] font-semibold text-sm">RDO #{rdo.number} - {rdo.date}</div>
                  <div className="text-[#a3a3a3] text-xs mt-1">{rdo.responsible} - {rdo.productionNotes || rdo.observations || 'Sem resumo'}</div>
                </div>
                <span className={`shrink-0 text-[10px] px-2 py-1 rounded border ${statusClass(rdo)}`}>{statusLabel(rdo)}</span>
              </div>
              {rdo.pendingFields?.length ? <div className="text-[10px] text-yellow-300 mt-2">Pendentes: {rdo.pendingFields.join(', ')}</div> : null}
            </button>
          ))}
          {reviewQueue.length === 0 && <div className="text-[#6b6b6b] text-sm">Nenhum RDO pendente de revisao.</div>}
        </div>

        {selected && (
          <div className="mt-5 rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h4 className="text-[#f5f5f5] font-semibold">Revisao do RDO #{selected.number}</h4>
                <p className="text-[#a3a3a3] text-xs mt-1">{selected.observations || selected.productionNotes || 'Sem observacao'}</p>
                <p className="text-[#6b6b6b] text-[10px] mt-2">Assinatura: {selected.assinaturaPresente ? 'presente' : 'nao detectada'} | Origem: {selected.origem || 'web'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleSendReview(selected)} disabled={isSaving} className={`${btnBase} bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]`}>
                  <AlertTriangle size={14} />
                  Revisar
                </button>
                <button onClick={() => handleFinalize(selected)} disabled={isSaving} className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-500`}>
                  <CheckCircle2 size={14} />
                  Finalizar
                </button>
                <button onClick={() => handleReject(selected)} disabled={isSaving} className={`${btnBase} bg-red-600 text-white hover:bg-red-500`}>
                  <XCircle size={14} />
                  Rejeitar
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
