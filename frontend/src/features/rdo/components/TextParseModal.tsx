/**
 * TextParseModal — Paste a field-report text message and auto-fill the RDO form.
 * Allows preview + export to PDF before applying to the form.
 */
import { useState, useMemo } from 'react'
import {
  X, ClipboardPaste, FileDown, CheckCircle2, Circle,
  Users, Wrench, Route, Package, ChevronDown, ChevronRight,
  MapPin, FileText, HardHat,
} from 'lucide-react'
import { parseRdoText, type ParsedRdoData } from '../utils/parseRdoText'
import { printRdoPDF } from '../utils/rdoPdfExport'
import type { RDO } from '@/types'

interface Props {
  onClose:  () => void
  onApply:  (data: ParsedRdoData) => void
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

const NI = 'Não informado'

const PLACEHOLDER = `Cole aqui o relatório da equipe de campo...

Exemplo completo:
Local: Rua das Palmeiras, nº 100 — Bairro Centro
OS: 2024/0587
Contrato: CT-2024-123
Gerente de Contrato: Eng. João Silva
Técnico de Segurança: Carlos Lima
Empreiteira: Construtora ABC Ltda
Serviço a Executar: Assentamento de rede de esgoto DN200
Clima Manhã: Ensolarado
Clima Tarde: Nublado
Funcionários Diretos: 18
Funcionários Indiretos: 4

Equipe rede: esgoto
Líder: Bruno

Rua B, beco do Sheike: assentamento rede esgoto tubo de 200mm, 6M

material:
47M tubo 200mm
4 luva de 50mm

Equipamentos:
2 Retro
1 escavadeira hidráulica

Ajudantes: 13
Encarregado: 5`

// ─── Small helper row for identification fields ───────────────────────────────

function FieldRow({ label, value }: { label: string; value: string | number }) {
  const isEmpty = value === NI || value === 0
  return (
    <div className="flex items-start justify-between gap-3 py-1 border-b border-[#525252]/40 last:border-0">
      <span className="text-[10px] text-[#6b6b6b] font-semibold uppercase tracking-wide shrink-0">{label}</span>
      <span className={`text-xs text-right ${isEmpty ? 'text-[#3a3a3a] italic' : 'text-[#f5f5f5]'}`}>
        {isEmpty ? 'Não informado' : String(value)}
      </span>
    </div>
  )
}

export function TextParseModal({ onClose, onApply }: Props) {
  const [text, setText]   = useState('')
  const [rdoDate, setRdoDate] = useState(todayStr())
  const [showPreview, setShowPreview] = useState(false)
  const [showServices, setShowServices]   = useState(true)
  const [showTrechos,  setShowTrechos]    = useState(false)
  const [showEquip,    setShowEquip]      = useState(false)
  const [showIdent,    setShowIdent]      = useState(true)

  const parsed = useMemo<ParsedRdoData | null>(() => {
    if (!text.trim()) return null
    return parseRdoText(text)
  }, [text])

  const hasData = parsed && (
    parsed.services.length > 0 ||
    parsed.trechos.length  > 0 ||
    parsed.equipment.length > 0 ||
    parsed.employeeNames.length > 0 ||
    Object.values(parsed.manpower).some((v) => v > 0) ||
    parsed.local !== NI ||
    parsed.numeroOS !== NI ||
    parsed.gerenteContrato !== NI
  )

  function handleExportPdf() {
    if (!parsed) return
    const draft: RDO = {
      id:           'draft',
      number:       0,
      date:         rdoDate,
      responsible:  parsed.responsible || 'Responsável não informado',
      weather:      { morning: 'good', afternoon: 'good', night: 'good', temperatureC: 25 },
      manpower:     { ...parsed.manpower, employeeNames: parsed.employeeNames },
      equipment:    parsed.equipment.map((e, i) => ({ ...e, id: `eq-${i}` })),
      services:     parsed.services.map((s, i)  => ({ ...s, id: `sv-${i}` })),
      trechos:      parsed.trechos.map((t, i)   => ({ ...t, id: `tr-${i}` })),
      photos:       [],
      geolocation:  null,
      observations: parsed.observations,
      incidents:    parsed.ocorrencias !== NI ? parsed.ocorrencias : '',
      // Identification fields
      local:                      parsed.local,
      gerenteContrato:            parsed.gerenteContrato,
      tecnicoSeguranca:           parsed.tecnicoSeguranca,
      nomeEmpreiteira:            parsed.nomeEmpreiteira,
      servicoExecutar:            parsed.servicoExecutar,
      ocorrencias:                parsed.ocorrencias,
      funcionariosDiretos:        parsed.funcionariosDiretos,
      funcionariosIndiretos:      parsed.funcionariosIndiretos,
      qtdEquipamentosFerramentas: parsed.qtdEquipamentosFerramentas,
      numeroOS:                   parsed.numeroOS,
      numeroContrato:             parsed.numeroContrato,
      climaManha:                 parsed.climaManha,
      climaTarde:                 parsed.climaTarde,
      climaNoite:                 parsed.climaNoite,
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    }
    printRdoPDF(draft)
  }

  function handleApply() {
    if (!parsed) return
    onApply({ ...parsed, date: rdoDate })
  }

  const totalManpower =
    (parsed?.manpower.foremanCount  ?? 0) +
    (parsed?.manpower.officialCount ?? 0) +
    (parsed?.manpower.helperCount   ?? 0) +
    (parsed?.manpower.operatorCount ?? 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[#525252] bg-[#333333] flex flex-col shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252] shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardPaste size={16} className="text-[#f97316]" />
            <h2 className="text-[#f5f5f5] font-bold text-sm">Preencher RDO com Texto</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#484848] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Date field */}
          <div>
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b] mb-1.5">
              Data do RDO
            </label>
            <input
              type="date"
              value={rdoDate}
              onChange={(e) => setRdoDate(e.target.value)}
              className="w-full rounded-lg bg-[#3d3d3d] border border-[#525252] px-3 py-2 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50 transition-colors"
            />
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b] mb-2">
              Cole o relatório da equipe abaixo
            </label>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setShowPreview(false) }}
              placeholder={PLACEHOLDER}
              rows={12}
              className="w-full rounded-lg bg-[#3d3d3d] border border-[#525252] px-3 py-2.5 text-xs text-[#f5f5f5] placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50 resize-y transition-colors font-mono"
            />
            {text.trim() && (
              <button
                onClick={() => setShowPreview(true)}
                className="mt-2 flex items-center gap-1.5 text-xs text-[#f97316] hover:text-[#ea580c] transition-colors font-medium"
              >
                <CheckCircle2 size={12} />
                Analisar texto ({text.trim().split('\n').length} linhas)
              </button>
            )}
          </div>

          {/* ── Preview ── */}
          {showPreview && parsed && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="section-label">Resultado da análise</span>
                {hasData && <span className="text-[10px] text-[#22c55e] font-semibold">✓ Dados detectados</span>}
              </div>

              {/* ── Identification fields ── */}
              <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowIdent((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#484848] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-[#f97316]" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a3a3a3]">Identificação do Contrato</span>
                  </div>
                  {showIdent ? <ChevronDown size={12} className="text-[#6b6b6b]" /> : <ChevronRight size={12} className="text-[#6b6b6b]" />}
                </button>
                {showIdent && (
                  <div className="px-3 pb-3">
                    <div className="mb-2">
                      <div className="flex items-center gap-1 mb-1.5">
                        <MapPin size={10} className="text-[#6b6b6b]" />
                        <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b] font-semibold">Localização</span>
                      </div>
                      <FieldRow label="Local" value={parsed.local} />
                      <FieldRow label="Nº OS" value={parsed.numeroOS} />
                      <FieldRow label="N° Contrato" value={parsed.numeroContrato} />
                      <FieldRow label="Empreiteira" value={parsed.nomeEmpreiteira} />
                    </div>
                    <div className="mb-2">
                      <div className="flex items-center gap-1 mb-1.5">
                        <HardHat size={10} className="text-[#6b6b6b]" />
                        <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b] font-semibold">Responsáveis</span>
                      </div>
                      <FieldRow label="Gerente de Contrato" value={parsed.gerenteContrato} />
                      <FieldRow label="Técnico de Segurança" value={parsed.tecnicoSeguranca} />
                    </div>
                    <div className="mb-2">
                      <div className="flex items-center gap-1 mb-1.5">
                        <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b] font-semibold">Condições Climáticas</span>
                      </div>
                      <FieldRow label="Manhã" value={parsed.climaManha} />
                      <FieldRow label="Tarde" value={parsed.climaTarde} />
                      <FieldRow label="Noite" value={parsed.climaNoite} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1.5">
                        <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b] font-semibold">Recursos</span>
                      </div>
                      <FieldRow label="Func. Diretos" value={parsed.funcionariosDiretos || NI} />
                      <FieldRow label="Func. Indiretos" value={parsed.funcionariosIndiretos || NI} />
                      <FieldRow label="Equipamentos/Ferramentas" value={parsed.qtdEquipamentosFerramentas || NI} />
                    </div>
                    {parsed.servicoExecutar !== NI && (
                      <div className="mt-2 pt-2 border-t border-[#525252]/40">
                        <div className="text-[9px] uppercase tracking-widest text-[#6b6b6b] font-semibold mb-1">Serviço a Executar</div>
                        <p className="text-xs text-[#f5f5f5]">{parsed.servicoExecutar}</p>
                      </div>
                    )}
                    {parsed.ocorrencias !== NI && (
                      <div className="mt-2 pt-2 border-t border-[#525252]/40">
                        <div className="text-[9px] uppercase tracking-widest text-[#6b6b6b] font-semibold mb-1">Ocorrências</div>
                        <p className="text-xs text-[#f5f5f5]">{parsed.ocorrencias}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Summary chips */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowServices((v) => !v)}
                  className="flex items-center gap-2 p-3 rounded-xl bg-[#3d3d3d] border border-[#525252] text-left"
                >
                  {parsed.services.length > 0 ? <CheckCircle2 size={14} className="text-[#22c55e] shrink-0" /> : <Circle size={14} className="text-[#3a3a3a] shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6b6b6b]">Serviços / Materiais</div>
                    <div className="text-sm font-bold text-[#f5f5f5]">{parsed.services.length}</div>
                  </div>
                  <Package size={13} className="text-[#3a3a3a] shrink-0" />
                </button>

                <button
                  onClick={() => setShowTrechos((v) => !v)}
                  className="flex items-center gap-2 p-3 rounded-xl bg-[#3d3d3d] border border-[#525252] text-left"
                >
                  {parsed.trechos.length > 0 ? <CheckCircle2 size={14} className="text-[#22c55e] shrink-0" /> : <Circle size={14} className="text-[#3a3a3a] shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6b6b6b]">Trechos</div>
                    <div className="text-sm font-bold text-[#f5f5f5]">{parsed.trechos.length}</div>
                  </div>
                  <Route size={13} className="text-[#3a3a3a] shrink-0" />
                </button>

                <button
                  onClick={() => setShowEquip((v) => !v)}
                  className="flex items-center gap-2 p-3 rounded-xl bg-[#3d3d3d] border border-[#525252] text-left"
                >
                  {parsed.equipment.length > 0 ? <CheckCircle2 size={14} className="text-[#22c55e] shrink-0" /> : <Circle size={14} className="text-[#3a3a3a] shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6b6b6b]">Equipamentos</div>
                    <div className="text-sm font-bold text-[#f5f5f5]">{parsed.equipment.length}</div>
                  </div>
                  <Wrench size={13} className="text-[#3a3a3a] shrink-0" />
                </button>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-[#3d3d3d] border border-[#525252]">
                  {totalManpower > 0 ? <CheckCircle2 size={14} className="text-[#22c55e] shrink-0" /> : <Circle size={14} className="text-[#3a3a3a] shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6b6b6b]">Mão de Obra</div>
                    <div className="text-sm font-bold text-[#f5f5f5]">{totalManpower} pessoas</div>
                  </div>
                  <Users size={13} className="text-[#3a3a3a] shrink-0" />
                </div>
              </div>

              {/* Leaders */}
              {(parsed.responsible || parsed.employeeNames.length > 0) && (
                <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6b6b6b] mb-1.5">Líderes detectados</div>
                  <div className="flex flex-wrap gap-1.5">
                    {parsed.employeeNames.map((n) => (
                      <span key={n} className="px-2 py-0.5 rounded-full bg-[#f97316]/12 text-[#f97316] text-[11px] font-medium">{n}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Manpower detail */}
              {totalManpower > 0 && (
                <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6b6b6b] mb-2">Distribuição de Pessoal</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {parsed.manpower.foremanCount  > 0 && <div className="flex justify-between"><span className="text-[#6b6b6b]">Encarregado</span><span className="text-[#f5f5f5] font-semibold">{parsed.manpower.foremanCount}</span></div>}
                    {parsed.manpower.officialCount > 0 && <div className="flex justify-between"><span className="text-[#6b6b6b]">Oficial</span><span className="text-[#f5f5f5] font-semibold">{parsed.manpower.officialCount}</span></div>}
                    {parsed.manpower.helperCount   > 0 && <div className="flex justify-between"><span className="text-[#6b6b6b]">Ajudante/Outros</span><span className="text-[#f5f5f5] font-semibold">{parsed.manpower.helperCount}</span></div>}
                    {parsed.manpower.operatorCount > 0 && <div className="flex justify-between"><span className="text-[#6b6b6b]">Operador</span><span className="text-[#f5f5f5] font-semibold">{parsed.manpower.operatorCount}</span></div>}
                  </div>
                </div>
              )}

              {/* Services list */}
              {showServices && parsed.services.length > 0 && (
                <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
                  <button onClick={() => setShowServices(false)} className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#6b6b6b] hover:bg-[#484848] transition-colors">
                    Serviços / Materiais ({parsed.services.length})<ChevronDown size={12} />
                  </button>
                  <div className="px-3 pb-3 max-h-48 overflow-y-auto">
                    {parsed.services.map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-[#525252]/50 last:border-0">
                        <span className="text-xs text-[#a3a3a3] flex-1 min-w-0 mr-2 truncate">{s.description}</span>
                        <span className="text-xs text-[#f5f5f5] font-mono shrink-0">{s.quantity} {s.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!showServices && parsed.services.length > 0 && (
                <button onClick={() => setShowServices(true)} className="flex items-center gap-1 text-xs text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors">
                  <ChevronRight size={12} />Ver {parsed.services.length} serviço{parsed.services.length !== 1 ? 's' : ''}
                </button>
              )}

              {/* Trechos list */}
              {showTrechos && parsed.trechos.length > 0 && (
                <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
                  <button onClick={() => setShowTrechos(false)} className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#6b6b6b] hover:bg-[#484848] transition-colors">
                    Trechos ({parsed.trechos.length})<ChevronDown size={12} />
                  </button>
                  <div className="px-3 pb-3 max-h-40 overflow-y-auto">
                    {parsed.trechos.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 py-1 border-b border-[#525252]/50 last:border-0">
                        <span className="text-[10px] font-mono text-[#f97316] shrink-0 mt-0.5">{t.trechoCode}</span>
                        <span className="text-xs text-[#a3a3a3] flex-1 min-w-0">{t.trechoDescription}</span>
                        <span className="text-xs font-mono text-[#f5f5f5] shrink-0">{t.executedMeters}m</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Equipment list */}
              {showEquip && parsed.equipment.length > 0 && (
                <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
                  <button onClick={() => setShowEquip(false)} className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#6b6b6b] hover:bg-[#484848] transition-colors">
                    Equipamentos ({parsed.equipment.length})<ChevronDown size={12} />
                  </button>
                  <div className="px-3 pb-3">
                    {parsed.equipment.map((e, i) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-[#525252]/50 last:border-0">
                        <span className="text-xs text-[#a3a3a3]">{e.name}</span>
                        <span className="text-xs text-[#f5f5f5] font-mono">{e.quantity} un · {e.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {showPreview && parsed && !hasData && (
            <div className="text-center py-6">
              <p className="text-[#6b6b6b] text-xs">Nenhum dado reconhecido no texto. Verifique o formato.</p>
              <p className="text-[#3a3a3a] text-[10px] mt-1">Use palavras-chave como "Local:", "OS:", "Gerente:", "Equipe rede:", etc.</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-[#525252] shrink-0">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#484848] transition-colors">
            Cancelar
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {hasData && (
              <button
                type="button"
                onClick={handleExportPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors"
              >
                <FileDown size={12} />
                Exportar PDF
              </button>
            )}

            <button
              type="button"
              onClick={!showPreview ? () => setShowPreview(true) : handleApply}
              disabled={!text.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {!showPreview ? 'Analisar' : 'Aplicar ao Formulário'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
