/**
 * ImportarFcpModal — sobe a planilha FLUXO_CAIXA_PROJETADO_*.xlsx e cria/atualiza
 * o FCP (Premissas + Obra(s) + Custos + Preços) de uma vez.
 *
 * O cálculo é o motor TS (utils/fcp/motor.ts, via useFcp). Este modal faz a
 * ENTRADA: lê a planilha e grava premissas/custos/preços. Reimportar a mesma
 * obra SUBSTITUI pessoas/custos/preços dela pelos da planilha — a tela mostra
 * antes o que muda (utils/fcp/importacaoCd.ts): capital antes → depois,
 * premissas alteradas, as conferências da planilha contra o motor (as que
 * bateram também) e a produção realizada da aba FCP SEMANAL, que só entra
 * onde o sistema não tem lançamento — o lançado no sistema vence.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  X, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, HelpCircle, Ban,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useProjectContext } from '@/store/projectContext'
import { norm } from './importador/diff'
import { lerPlanilhaFcp, type LeituraFcp } from './importador/planilhaFcp'
import { conferirImportacao, type ConferenciaDaImportacao, type FcpExistente } from '../utils/fcp/importacaoCd'
import { carregarFcpDaSemana } from '../utils/fcp/fcpSupabaseIO'
import type { Abas } from '../utils/fcp/importarFcp'
import type { Matriz } from '../utils/controleDeCaixaPlanilha'

type Passo = 'upload' | 'preview' | 'pronto'

const brl = (v: number | null) =>
  v === null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** segunda-feira da semana de uma data ISO (yyyy-mm-dd). */
function segundaFeiraDe(iso: string | null): string {
  const base = iso ? new Date(iso + 'T12:00:00') : new Date()
  const dow = (base.getDay() + 6) % 7
  base.setDate(base.getDate() - dow)
  // data LOCAL (toISOString é UTC e podia devolver o dia anterior/seguinte)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
}

const pctTxt = (v: number) => `${(v * 100).toFixed(1)}%`

export function ImportarFcpModal({ onClose, onSaved }: { onClose: () => void; onSaved: (fcpId: string) => void }) {
  const [passo, setPasso] = useState<Passo>('upload')
  const [arquivo, setArquivo] = useState('')
  const [leitura, setLeitura] = useState<LeituraFcp | null>(null)
  const [nome, setNome] = useState('')
  const [semanaRef, setSemanaRef] = useState('')
  const [erroLeitura, setErroLeitura] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)
  const [erroGravar, setErroGravar] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const projetos = useProjectContext((s) => s.projetos)
  const [abas, setAbas] = useState<Abas>({})
  const [existente, setExistente] = useState<FcpExistente | null>(null)
  const [erroExistente, setErroExistente] = useState<string | null>(null)

  // O FCP da semana escolhida — é contra ele que a prévia compara. Recarrega se a semana mudar.
  useEffect(() => {
    if (passo !== 'preview' || !semanaRef) return
    let vivo = true
    setErroExistente(null)
    carregarFcpDaSemana(semanaRef)
      .then((e) => { if (vivo) setExistente(e) })
      .catch((e) => { if (vivo) { setExistente(null); setErroExistente(e instanceof Error ? e.message : String(e)) } })
    return () => { vivo = false }
  }, [passo, semanaRef])

  const conferencia: ConferenciaDaImportacao | null = useMemo(() => {
    if (!leitura || leitura.obras.length === 0) return null
    // Existente de OUTRO nome não é reimportação: a gravação recusa, e a prévia não compara com ele.
    const mesmo = existente && existente.nome.trim() === nome.trim() ? existente : null
    return conferirImportacao(leitura, abas, mesmo)
  }, [leitura, abas, existente, nome])

  /** nome da obra na planilha → projeto real do sistema (aceita "BERTIOGA" e "WCR — Bertioga"). */
  const projetoDaObra = useMemo(() => (nomeObra: string): string | null => {
    const alvo = norm(nomeObra)
    const hit = projetos.find((p) => norm(p.nome).includes(alvo) || norm(p.nome) === norm('WCR — ' + nomeObra))
    return hit?.id ?? null
  }, [projetos])

  async function processar(file: File) {
    setErroLeitura(null); setArquivo(file.name)
    try {
      const buf = await file.arrayBuffer()
      const lida = lerPlanilhaFcp(buf)
      // As abas cruas, para a conferência do motor contra as abas calculadas da planilha.
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      setAbas(Object.fromEntries(wb.SheetNames.map((n) => [
        n.trim(), XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }) as Matriz,
      ])))
      if (lida.obras.length === 0) {
        setErroLeitura(lida.obrasIgnoradas[0]?.motivo
          ?? lida.avisos[0]
          ?? 'Nenhuma obra reconhecida nesta planilha. Confira se é o formato FLUXO_CAIXA_PROJETADO_*.xlsx.')
        setLeitura(lida) // ainda guarda pra mostrar as obras ignoradas, se houver
        return
      }
      setLeitura(lida)
      setNome('WCR — ' + lida.obras.map((o) => o.nome).join(' + '))
      setSemanaRef(segundaFeiraDe(lida.premissas.inicio_obra))
      setPasso('preview')
    } catch (e) {
      setErroLeitura(e instanceof Error ? e.message : 'Não foi possível ler o arquivo. Envie um .xlsx do modelo de FCP.')
    }
  }

  async function gravar() {
    if (!supabase || !leitura) return
    setGravando(true); setErroGravar(null)
    try {
      // 1) o documento (fcp) — um por semana_ref na organização.
      //
      // A busca é POR SEMANA, mas a semana NÃO identifica o documento: ela é
      // derivada do início da obra, e obras diferentes começam na mesma semana.
      // Sem conferir o NOME, importar uma planilha nova cuja segunda-feira
      // coincide com a de um FCP existente fazia o pior estrago possível e em
      // silêncio: o update abaixo RENOMEAVA o documento da outra obra e o
      // passo 2 sobrescrevia as premissas dela, deixando a obra antiga
      // pendurada dentro de um documento que agora diz outro nome. Nenhuma
      // tela mostrava de quem era o documento que ia ser tomado.
      //
      // Nome igual = reimportação da mesma planilha (atualizar é o certo).
      // Nome diferente = colisão de semana entre obras: para e explica, porque
      // escolher sozinho aqui significa destruir o trabalho de alguém.
      const { data: daSemana } = await supabase.from('fcp').select('id, nome').eq('semana_ref', semanaRef).is('deleted_at', null).maybeSingle()
      const doc = daSemana as { id: string; nome: string } | null
      if (doc && doc.nome.trim() !== nome.trim()) {
        throw new Error(
          `Já existe o FCP "${doc.nome}" na semana de ${semanaRef}, e este documento se chamaria "${nome}". ` +
          'Gravar aqui sobrescreveria as premissas do outro documento. ' +
          'Mude a semana de referência ou use o mesmo nome, se a intenção era mesmo atualizar aquele FCP.',
        )
      }
      let fcpId = doc?.id ?? null
      if (fcpId && existente?.id === fcpId && existente.status === 'aprovado') {
        throw new Error('Este FCP está APROVADO — a importação não pode mudar o número que a diretoria aprovou. Reabra o FCP antes de importar.')
      }
      if (fcpId) {
        // Enviado/devolvido com premissa nova volta para rascunho: o número em análise deixou de ser este.
        const patch: Record<string, unknown> = { nome }
        if (conferencia?.voltaParaRascunho) patch.status = 'rascunho'
        const { error } = await supabase.from('fcp').update(patch).eq('id', fcpId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('fcp').insert({ nome, semana_ref: semanaRef }).select('id').single()
        if (error) throw error
        fcpId = (data as { id: string }).id
      }

      // 2) premissas — só grava o que a planilha realmente trouxe (undefined
      //    fica de fora do patch e mantém o default do banco / o que já existia).
      const p = leitura.premissas
      const patchPremissas: Record<string, unknown> = { inicio_obra: p.inicio_obra, fim_operacao: p.fim_operacao }
      const opcionais: [string, unknown][] = [
        ['dias_mes', p.dias_mes], ['defasagem_dias', p.defasagem_dias], ['imposto_aliquota', p.imposto_aliquota],
        ['cenario', p.cenario], ['margem_minima', p.margem_minima], ['margem_media', p.margem_media],
        ['margem_boa', p.margem_boa], ['margem_otima', p.margem_otima], ['contingencia', p.contingencia],
        ['fator_primeiro_mes', p.fator_primeiro_mes], ['paga_folha', p.paga_folha], ['paga_engenheiro', p.paga_engenheiro],
        ['paga_estrutura', p.paga_estrutura], ['paga_indiretos', p.paga_indiretos], ['paga_mobilizacao', p.paga_mobilizacao],
        ['desconta_medicao', p.desconta_medicao], ['base_imposto', p.base_imposto],
      ]
      for (const [k, v] of opcionais) if (v !== null) patchPremissas[k] = v

      if (!p.inicio_obra || !p.fim_operacao) throw new Error('Não achei "Início da obra" e/ou "Fim da operação" nas PREMISSAS — são obrigatórios, não dá para gravar sem eles.')

      const { data: premEx } = await supabase.from('fcp_premissas').select('fcp_id').eq('fcp_id', fcpId).maybeSingle()
      if (premEx) {
        const { error } = await supabase.from('fcp_premissas').update(patchPremissas).eq('fcp_id', fcpId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fcp_premissas').insert({ fcp_id: fcpId, ...patchPremissas })
        if (error) throw error
      }

      // 3) cada obra: fcp_obra (find-or-create por nome) + substitui pessoas/gerais/preços
      for (let i = 0; i < leitura.obras.length; i++) {
        const o = leitura.obras[i]
        const { data: obraEx } = await supabase.from('fcp_obra').select('id').eq('fcp_id', fcpId).eq('nome', o.nome).maybeSingle()
        let obraId = (obraEx as { id: string } | null)?.id ?? null
        const camposObra = {
          fcp_id: fcpId, nome: o.nome, ordem: i + 1,
          ticket_unico: o.ticket_unico, ticket_agua: o.ticket_agua, ticket_esgoto: o.ticket_esgoto,
          pct_esgoto: o.pct_esgoto, mobilizacao: o.mobilizacao,
          projeto_id: projetoDaObra(o.nome),
        }
        if (obraId) {
          const { error } = await supabase.from('fcp_obra').update(camposObra).eq('id', obraId)
          if (error) throw error
        } else {
          const { data, error } = await supabase.from('fcp_obra').insert(camposObra).select('id').single()
          if (error) throw error
          obraId = (data as { id: string }).id
        }

        // substitui pelo conteúdo da planilha (soft-delete, o padrão do sistema)
        const agora = new Date().toISOString()
        await supabase.from('fcp_custo_pessoa').update({ deleted_at: agora }).eq('fcp_obra_id', obraId).is('deleted_at', null)
        await supabase.from('fcp_custo_geral').update({ deleted_at: agora }).eq('fcp_obra_id', obraId).is('deleted_at', null)
        await supabase.from('fcp_preco').update({ deleted_at: agora }).eq('fcp_obra_id', obraId).is('deleted_at', null)

        if (o.pessoas.length) {
          const { error } = await supabase.from('fcp_custo_pessoa').insert(
            o.pessoas.map((pe, idx) => ({ fcp_obra_id: obraId, ...pe, ordem: idx }))
          )
          if (error) throw error
        }
        if (o.gerais.length) {
          const { error } = await supabase.from('fcp_custo_geral').insert(
            o.gerais.map((g, idx) => ({ fcp_obra_id: obraId, ...g, ordem: idx }))
          )
          if (error) throw error
        }
        if (o.precos.length) {
          const { error } = await supabase.from('fcp_preco').insert(
            o.precos.map((pr, idx) => ({ fcp_obra_id: obraId, ...pr, ordem: idx }))
          )
          if (error) throw error
        }

        // Produção realizada da aba FCP SEMANAL: só onde o sistema não tem lançamento
        // (ignoreDuplicates — o lançado na tela ou vindo do LPS vence).
        const realizado = (conferencia?.realizadoNovo ?? []).filter((r) => r.obra === o.nome)
        if (realizado.length) {
          const { error } = await supabase.from('fcp_realizado').upsert(
            realizado.map((r) => ({ fcp_obra_id: obraId, n_semana: r.semana, producao: r.producao })),
            { onConflict: 'fcp_obra_id,n_semana', ignoreDuplicates: true },
          )
          if (error) throw error
        }
      }

      setPasso('pronto')
      onSaved(fcpId)
    } catch (e) {
      setErroGravar(e instanceof Error ? e.message : 'Erro ao gravar o FCP.')
    } finally {
      setGravando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-4xl shadow-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={18} className="text-[#f97316]" />
            <h2 className="text-sm font-semibold text-[#f5f5f5]">Importar planilha de Fluxo de Caixa Projetado</h2>
          </div>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#f5f5f5]"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {passo === 'upload' && (
            <div className="space-y-4">
              <div className="bg-[#333333] border border-[#525252] rounded-lg p-4 space-y-2 text-xs text-[#a3a3a3] leading-relaxed">
                <p className="text-sm text-[#f5f5f5] font-medium">Formato: FLUXO_CAIXA_PROJETADO_&lt;OBRA&gt;.xlsx</p>
                <p>
                  O leitor entende o modelo de contrato <b className="text-[#f5f5f5]">ticket por unidade de serviço</b> (água/esgoto
                  por ligação) — o mesmo da planilha Bertioga+Santos que deu origem a este módulo. Uma planilha pode trazer
                  1 obra ou várias (cada aba <span className="font-mono">CUSTOS &lt;NOME&gt;</span> + <span className="font-mono">PREÇOS &lt;NOME&gt;</span> vira uma obra).
                </p>
                <p className="text-amber-200/90">
                  Contrato medido por EVENTO DA EAP (% de valor fechado, sem preço unitário) ou com produção estimada
                  diretamente (sem ticket/margem-alvo) não é reconhecido — a tela avisa em vez de importar algo errado.
                </p>
              </div>

              <div onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void processar(f) }}
                className="border-2 border-dashed border-[#525252] hover:border-[#f97316] rounded-xl p-10 text-center cursor-pointer transition-colors">
                <Upload size={26} className="mx-auto text-[#6b6b6b] mb-2" />
                <p className="text-sm text-[#f5f5f5]">Arraste a planilha aqui ou clique para escolher</p>
                <p className="text-xs text-[#6b6b6b] mt-1">.xlsx</p>
                <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void processar(f) }} />
              </div>

              {erroLeitura && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {erroLeitura}
                </div>
              )}
              {leitura?.obrasIgnoradas.map((oi) => (
                <div key={oi.nome} className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  <Ban size={15} className="mt-0.5 shrink-0" />
                  <div><b>{oi.nome}</b> não foi importada: {oi.motivo}</div>
                </div>
              ))}
            </div>
          )}

          {passo === 'preview' && leitura && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
                <FileSpreadsheet size={13} /> {arquivo}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-[#a3a3a3]">
                  Nome do FCP
                  <input value={nome} onChange={(e) => setNome(e.target.value)}
                    className="mt-1 w-full bg-[#333333] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
                </label>
                <label className="text-xs text-[#a3a3a3]">
                  Semana de referência
                  <input type="date" value={semanaRef} onChange={(e) => setSemanaRef(e.target.value)}
                    className="mt-1 w-full bg-[#333333] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
                </label>
              </div>

              {leitura.avisos.map((a, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {a}
                </div>
              ))}
              {leitura.obrasIgnoradas.map((oi) => (
                <div key={oi.nome} className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
                  <Ban size={14} className="mt-0.5 shrink-0" /> <div><b>{oi.nome}</b> ficou de fora: {oi.motivo}</div>
                </div>
              ))}

              <div className="bg-[#333333] border border-[#525252] rounded-lg p-4">
                <p className="text-sm font-medium text-[#f5f5f5] mb-2">Premissas lidas</p>
                <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                  {([
                    ['Início da obra', leitura.premissas.inicio_obra ?? '—'],
                    ['Fim da operação', leitura.premissas.fim_operacao ?? '—'],
                    ['Dias/mês', leitura.premissas.dias_mes ?? '—'],
                    ['Defasagem (dias)', leitura.premissas.defasagem_dias ?? '—'],
                    ['Imposto', leitura.premissas.imposto_aliquota !== null ? `${(leitura.premissas.imposto_aliquota * 100).toFixed(1)}%` : '—'],
                    ['Cenário', leitura.premissas.cenario ?? '—'],
                    ['Contingência', leitura.premissas.contingencia !== null ? `${(leitura.premissas.contingencia * 100).toFixed(0)}%` : '—'],
                    ['Desconta da medição', leitura.premissas.desconta_medicao === null ? '—' : leitura.premissas.desconta_medicao ? 'Sim' : 'Não'],
                    ['Base do imposto', leitura.premissas.base_imposto ?? '—'],
                  ] as const).map(([rot, v]) => (
                    <div key={rot}><span className="text-[#6b6b6b]">{rot}:</span> <span className="text-[#f5f5f5]">{String(v)}</span></div>
                  ))}
                </div>
                {(!leitura.premissas.inicio_obra || !leitura.premissas.fim_operacao) && (
                  <p className="text-red-300 text-xs mt-2">Sem início/fim da obra não dá para gravar — confira a aba PREMISSAS.</p>
                )}
              </div>

              {conferencia && <PreviaDoMotor c={conferencia} existente={existente && existente.nome.trim() === nome.trim() ? existente : null} erro={erroExistente} />}

              {leitura.obras.map((o) => {
                const semTicket = o.ticket_unico === null && (o.ticket_agua === null || o.ticket_esgoto === null)
                const projId = projetoDaObra(o.nome)
                const precosDuvidosos = o.precos.filter((p) => p.requer_conferencia).length
                return (
                  <div key={o.nome} className="bg-[#333333] border border-[#525252] rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#f5f5f5]">{o.nome}</p>
                      {projId
                        ? <span className="text-[10px] text-emerald-300 flex items-center gap-1"><CheckCircle2 size={11} /> vinculada ao projeto do sistema</span>
                        : <span className="text-[10px] text-amber-300 flex items-center gap-1"><HelpCircle size={11} /> sem projeto correspondente no seletor de obra</span>}
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-xs">
                      <div><span className="text-[#6b6b6b]">Ticket:</span> <span className="text-[#f5f5f5]">
                        {o.ticket_unico !== null ? brl(o.ticket_unico) + '/un' : `água ${brl(o.ticket_agua)} · esgoto ${brl(o.ticket_esgoto)} (${o.pct_esgoto !== null ? Math.round(o.pct_esgoto * 100) : '?'}% esgoto)`}
                      </span></div>
                      <div><span className="text-[#6b6b6b]">Mobilização:</span> <span className="text-[#f5f5f5]">{brl(o.mobilizacao)}</span></div>
                      <div><span className="text-[#6b6b6b]">Equipe/custos:</span> <span className="text-[#f5f5f5]">{o.pessoas.length} pessoa(s) + {o.gerais.length} item(ns) geral(is)</span></div>
                      <div><span className="text-[#6b6b6b]">Preços:</span> <span className="text-[#f5f5f5]">{o.precos.length}</span>
                        {precosDuvidosos > 0 && <span className="text-amber-300"> ({precosDuvidosos} p/ conferir)</span>}
                      </div>
                    </div>
                    {semTicket && <p className="text-red-300 text-xs">Sem ticket — esta obra não vai gerar a grade semanal até alguém preencher o preço na tela de Premissas.</p>}
                  </div>
                )
              })}

              {erroGravar && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {erroGravar}
                </div>
              )}
            </div>
          )}

          {passo === 'pronto' && (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 size={40} className="mx-auto text-green-400" />
              <p className="text-base font-semibold text-[#f5f5f5]">FCP importado</p>
              <p className="text-sm text-[#a3a3a3]">{nome}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[#525252]">
          <div />
          <div className="flex gap-2">
            {passo === 'preview' && (
              <>
                <button onClick={() => { setPasso('upload'); setLeitura(null) }}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]">
                  Trocar arquivo
                </button>
                <button onClick={() => void gravar()}
                  disabled={gravando || !leitura?.premissas.inicio_obra || !leitura?.premissas.fim_operacao || !nome.trim() || !semanaRef}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[#f97316] text-white hover:bg-[#ea580c] disabled:opacity-40 disabled:cursor-not-allowed">
                  {gravando ? 'Gravando…' : 'Confirmar importação'}
                </button>
              </>
            )}
            {passo !== 'preview' && (
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]">
                {passo === 'pronto' ? 'Fechar' : 'Cancelar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** O que o motor diz da planilha antes de gravar: capital, mudanças, conferências, realizado. */
function PreviaDoMotor({ c, existente, erro }: { c: ConferenciaDaImportacao; existente: FcpExistente | null; erro: string | null }) {
  const bateram = c.conferencias.filter((x) => x.status === 'bateu').length
  const naoAchou = c.conferencias.filter((x) => x.status === 'nao_encontrado').length
  return (
    <div className="space-y-3">
      {erro && <p className="text-xs text-amber-300">Não consegui carregar o FCP existente desta semana para comparar: {erro}</p>}

      <div className="bg-[#333333] border border-[#525252] rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-[#f5f5f5]">
          {existente ? `Atualiza o FCP "${existente.nome}" (${existente.status})` : 'Cria um FCP novo'}
        </p>
        <div className="flex flex-wrap gap-6 text-xs">
          {existente && (
            <div><span className="text-[#6b6b6b]">Capital recomendado hoje:</span>{' '}
              <span className="font-mono text-[#f5f5f5]">{brl(c.capitalAntes)}</span></div>
          )}
          <div><span className="text-[#6b6b6b]">{existente ? 'Depois de importar:' : 'Capital recomendado:'}</span>{' '}
            <span className="font-mono text-[#f97316] font-semibold">{brl(c.capitalDepois)}</span></div>
        </div>
        {c.voltaParaRascunho && (
          <p className="text-xs text-amber-200">Este FCP está {existente?.status} e as premissas mudam — ele volta para RASCUNHO ao gravar.</p>
        )}
        {existente?.status === 'aprovado' && (
          <p className="text-xs text-red-300">FCP APROVADO: a gravação vai ser recusada. Reabra o FCP antes de importar.</p>
        )}
        {c.mudancas.length > 0 && (
          <div className="pt-1">
            <p className="text-xs text-[#a3a3a3] mb-1">O que muda ({c.mudancas.length}):</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
              {c.mudancas.map((m) => (
                <div key={m.rotulo}><span className="text-[#6b6b6b]">{m.rotulo}:</span>{' '}
                  <span className="line-through text-[#6b6b6b]">{m.antes}</span> → <span className="text-amber-200">{m.depois}</span></div>
              ))}
            </div>
          </div>
        )}
        {existente && c.mudancas.length === 0 && <p className="text-xs text-[#a3a3a3]">Nenhuma premissa muda.</p>}
        {c.obrasAusentes.length > 0 && (
          <p className="text-xs text-amber-200">
            Estão no FCP e não vieram nesta planilha (NÃO serão apagadas): {c.obrasAusentes.join(', ')}.
          </p>
        )}
      </div>

      {(c.padroesUsados.length > 0 || c.pendencias.length > 0) && (
        <div className="bg-[#333333] border border-amber-500/40 rounded-lg p-4 space-y-1 text-xs text-amber-200">
          {c.padroesUsados.length > 0 && (
            <p>Não informado na planilha — vai com o padrão do sistema:{' '}
              {c.padroesUsados.map((p) => `${p.campo} = ${p.valor}`).join(' · ')}</p>
          )}
          {c.pendencias.map((p, i) => <p key={i}>· {p.mensagem}</p>)}
        </div>
      )}

      {c.conferencias.length > 0 && (
        <div className="bg-[#333333] border border-[#525252] rounded-lg p-4">
          <p className="text-sm font-medium text-[#f5f5f5] mb-1">
            Conferência da planilha contra o cálculo do sistema — {bateram} de {c.conferencias.length} bateram
            {naoAchou > 0 && `, ${naoAchou} não encontrada(s) na planilha`}
          </p>
          <div className="space-y-0.5 text-xs">
            {c.conferencias.map((x, i) => {
              const div = c.divergencias.find((d) => d.aba === x.aba && d.oQue === x.oQue)
              return (
                <div key={i} className={x.status === 'bateu' ? 'text-green-300' : x.status === 'divergiu' ? 'text-red-300' : 'text-[#6b6b6b]'}>
                  {x.status === 'bateu' ? '✓' : x.status === 'divergiu' ? '✗' : '—'} {x.aba} · {x.oQue}: sistema {brl(x.calculado)}
                  {x.naPlanilha !== null ? ` × planilha ${brl(x.naPlanilha)}` : ' (não achei na planilha)'}
                  {div && (
                    <div className="pl-4 text-[#a3a3a3]">
                      diferença {brl(div.diferenca)} ({pctTxt(div.proporcao)}) — {div.causaProvavel ?? 'não identifiquei a causa a partir da própria planilha.'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(c.realizadoNovo.length > 0 || c.realizadoConflitante.length > 0) && (
        <div className="bg-[#333333] border border-[#525252] rounded-lg p-4 space-y-1 text-xs">
          <p className="text-sm font-medium text-[#f5f5f5]">Produção realizada (aba FCP SEMANAL)</p>
          {c.realizadoNovo.length > 0 && (
            <p className="text-[#a3a3a3]">Entram {c.realizadoNovo.length} semana(s):{' '}
              {c.realizadoNovo.map((r) => `${r.obra} S${r.semana} = ${r.producao}`).join(' · ')}</p>
          )}
          {c.realizadoConflitante.length > 0 && (
            <p className="text-amber-200">Já lançadas no sistema com outro valor — vale o do sistema:{' '}
              {c.realizadoConflitante.map((r) => `${r.obra} S${r.semana}: planilha ${r.planilha} × sistema ${r.sistema}`).join(' · ')}</p>
          )}
        </div>
      )}
    </div>
  )
}
