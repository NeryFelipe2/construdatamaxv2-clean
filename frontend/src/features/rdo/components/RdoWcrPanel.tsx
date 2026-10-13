/**
 * RdoWcrPanel — o RDO da WCR, preenchido colando o apontamento do WhatsApp ou soltando a planilha.
 *
 * Veio do pacote RDO·FCP·Caixa (16/09/2026), adaptado ao ConstruData:
 *  - a obra é o PROJETO do seletor (useProjectContext), não um "site" da Torre;
 *  - a gravação é a do backend (createRdoForProject → tabela `rdos`), com `template`, `wcr` e
 *    `status` dentro do `payload_original` — é de lá que a recarga do módulo os reconstrói;
 *  - "Salvar RDO" cria e FINALIZA (finalizarRdo); rascunho não leva serviços, para não alimentar
 *    produção nem medição;
 *  - sem gravação local escondida: se o backend falhar, a tela diz. Um RDO salvo só no navegador
 *    sumiria na recarga de 30 s sem ninguém perceber.
 *
 * O QUE ESTA TELA PROMETE: cola, confere, salva. O apontamento vem sem ano na data, com a maioria
 * das siglas em branco e com endereços repetidos — a pré-visualização mostra a data cheia com o ano
 * deduzido, marca cada sigla vazia como "não informado" (não zero) e lista o que não foi entendido.
 */
import { useMemo, useState, type ReactNode } from 'react'
import {
  ClipboardList, Save, Printer, CheckCircle2, AlertTriangle, Building2, ScanText, Trash2,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useRdoStore } from '@/store/rdoStore'
import { useProjectContext } from '@/store/projectContext'
import { hojeLocalISO } from '@/lib/utils'
import { AreaDeSoltar } from '@/components/shared/AreaDeSoltar'
import type { RDO, RdoWcrData, RdoWcrProducaoRow } from '@/types'
import {
  parseApontamentoWcr, resumirApontamento, limitarTextoOriginal, type ApontamentoWcr,
} from '../utils/apontamentoWcr'
import { lerPlanilhaWcr, type MatrizWcr } from '../utils/apontamentoWcrPlanilha'
import { aplicarApelidosWcr, servicosDoApontamentoWcr } from '../utils/parseRdoText'
import { printRdoPDF } from '../utils/rdoPdfExport'

const MODELO = `📋 APONTAMENTO DIÁRIO — MODELO

Produção - 31/08
Equipe - Gilvan
Núcleo - Boi Malhado
Imóvel - rua santa rosa de sul

SERVIÇO ÁGUA
PRA -
LA -
LIA -
Caixa UMA -
HM - 100
Interligação -
Válvula -

SERVIÇO ESGOTO
PRE -
LE -
LIE -
PV -
PI -
CI -

obs: qualquer coisa fora da lista escreve aqui`

function producaoDoApontamento(a: ApontamentoWcr): RdoWcrProducaoRow[] {
  return a.linhas.map((l) => ({
    sigla: l.sigla,
    // ⚠️ String vazia, NÃO '0'. Ver o docblock de RdoWcrProducaoRow.
    quantidade: l.quantidade === undefined ? '' : String(l.quantidade),
    unidade: l.unidade,
  }))
}

type RdoNovo = Omit<RDO, 'id' | 'number' | 'createdAt' | 'updatedAt'>

export function RdoWcrPanel() {
  const createRdoForProject = useRdoStore((s) => s.createRdoForProject)
  const finalizarRdo = useRdoStore((s) => s.finalizarRdo)
  const setActiveTab = useRdoStore((s) => s.setActiveTab)
  const isSaving = useRdoStore((s) => s.isSaving)
  const { activeProjectId, projetos } = useProjectContext()

  const [texto, setTexto] = useState('')
  const [lido, setLido] = useState<ApontamentoWcr | null>(null)
  const [projetoId, setProjetoId] = useState<string | null>(activeProjectId ?? null)
  const [responsavel, setResponsavel] = useState('')
  const [salvo, setSalvo] = useState<{ id: string; status: 'rascunho' | 'finalizado' } | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro' | 'info'; texto: string } | null>(null)
  const [problemasDaPlanilha, setProblemasDaPlanilha] = useState<string[]>([])

  const projeto = useMemo(() => projetos.find((p) => p.id === projetoId) ?? null, [projetos, projetoId])
  const resumo = useMemo(() => (lido ? resumirApontamento(lido) : null), [lido])

  function analisar() {
    setProblemasDaPlanilha([])
    // Um interpretador só: o mesmo do RDO genérico, com as mesmas grafias aceitas (IHM, C.UMA…).
    setLido(parseApontamentoWcr(aplicarApelidosWcr(texto), { hoje: hojeLocalISO() }))
    setSalvo(null)
    setAviso(null)
  }

  async function lerArquivo(f: File) {
    setAviso(null)
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true })
      const aba = wb.SheetNames[0]
      if (!aba) { setAviso({ tipo: 'erro', texto: 'A planilha não tem nenhuma aba.' }); return }
      const matriz = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: null }) as MatrizWcr
      const r = lerPlanilhaWcr(matriz)
      setProblemasDaPlanilha(r.problemas)
      if (!r.apontamentos.length) { setLido(null); return }
      // ⚠️ Um por vez, de propósito: cada apontamento vira UM RDO, e quem salva precisa conferir.
      const primeiro = r.apontamentos[0]
      setLido(primeiro)
      setTexto('')
      setSalvo(null)
      if (r.apontamentos.length > 1) {
        setAviso({ tipo: 'info', texto: `A planilha tem ${r.apontamentos.length} apontamentos. Mostrando o da linha ${primeiro.linhaDaPlanilha}; salve e volte para o próximo.` })
      }
    } catch (err) {
      setAviso({ tipo: 'erro', texto: `Não consegui ler o arquivo: ${err instanceof Error ? err.message : 'erro desconhecido'}` })
    }
  }

  function montarPayload(status: 'rascunho' | 'finalizado'): RdoNovo | null {
    if (!lido) return null
    const wcr: RdoWcrData = {
      equipe: lido.equipe,
      nucleo: lido.nucleo,
      imoveis: lido.imoveis,
      producao: producaoDoApontamento(lido),
      observacoes: lido.observacoes,
      anoInferido: lido.anoInferido,
      textoOriginal: limitarTextoOriginal(texto || ''),
      naoEntendidas: lido.naoEntendidas.length ? lido.naoEntendidas : undefined,
    }
    const { services } = servicosDoApontamentoWcr(lido)
    const local = [lido.imoveis.join(' · '), lido.nucleo ?? ''].filter(Boolean).join(' — ')
    return {
      date: lido.data || hojeLocalISO(),
      responsible: responsavel || lido.equipe || '',
      weather: { morning: 'good', afternoon: 'good', night: 'good', temperatureC: 0 },
      manpower: { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0, employeeNames: [] },
      equipment: [],
      // ⚠️ Rascunho vai sem serviços: não pode alimentar produção nem medição.
      services: status === 'finalizado' ? services.map((s, i) => ({ ...s, id: `wcr-${i}` })) : [],
      trechos: [],
      geolocation: null,
      observations: lido.observacoes ?? '',
      incidents: '',
      photos: [],
      local: local || undefined,
      origem: 'rdo-wcr',
      statusRevisao: status,
      siteId: projetoId,
      template: 'wcr',
      wcr,
      status,
    }
  }

  async function salvar(status: 'rascunho' | 'finalizado') {
    const payload = montarPayload(status)
    if (!payload || !projetoId) return
    setAviso(null)
    const criado = await createRdoForProject(projetoId, payload)
    const id = criado && typeof criado.id === 'string' ? criado.id : criado?.id ? String(criado.id) : null
    if (!id) {
      setAviso({ tipo: 'erro', texto: 'Não foi possível gravar o RDO — o servidor não respondeu. Nada foi salvo; tente de novo.' })
      return
    }
    if (status === 'finalizado') {
      const fim = await finalizarRdo(projetoId, id)
      if (!fim) {
        setSalvo({ id, status: 'rascunho' })
        setAviso({ tipo: 'erro', texto: 'O RDO foi gravado, mas não consegui finalizá-lo. Finalize pelo Histórico.' })
        return
      }
    }
    setSalvo({ id, status })
    setAviso({ tipo: 'ok', texto: status === 'rascunho' ? 'Rascunho salvo. Rascunho não alimenta produção nem custo.' : 'RDO salvo e finalizado.' })
    if (status === 'finalizado') setActiveTab('historico')
  }

  function imprimir() {
    const payload = montarPayload('finalizado')
    if (!payload || !lido) return
    const agora = new Date().toISOString()
    const extras = [
      lido.nucleo ? `Núcleo: ${lido.nucleo}` : '',
      lido.imoveis.length ? `Imóveis: ${lido.imoveis.join(' · ')}` : '',
      lido.anoInferido && lido.data ? `Data ${lido.data.split('-').reverse().join('/')} (ano deduzido)` : '',
      lido.naoEntendidas.length ? `Não entendido: ${lido.naoEntendidas.join(' | ')}` : '',
    ].filter(Boolean).join('\n')
    // printRdoPDF abre a janela de forma síncrona — tem de ser chamado direto no clique.
    printRdoPDF({
      ...payload,
      id: 'preview', number: 0, createdAt: agora, updatedAt: agora,
      observations: [payload.observations, extras].filter(Boolean).join('\n'),
    } as RDO)
  }

  const travado = !!salvo

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center gap-2">
        <ClipboardList size={20} className="text-[#f97316]" />
        <h2 className="text-lg font-semibold text-[#f5f5f5]">RDO WCR</h2>
        <span className="text-xs text-[#6b6b6b]">cole o apontamento ou solte a planilha</span>
      </header>

      <section className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4 space-y-3">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={MODELO}
          rows={12}
          disabled={travado}
          className="w-full rounded-lg border border-[#525252] bg-[#1f1f1f] p-3 font-mono text-xs text-[#f5f5f5] placeholder:text-[#525252] focus:border-[#f97316]/50 focus:outline-none disabled:opacity-60"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={analisar}
            disabled={!texto.trim() || travado}
            className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-[#ffffff] disabled:opacity-40"
          >
            <ScanText size={14} /> Analisar texto
          </button>
          <AreaDeSoltar
            compacto
            aceita=".xlsx,.xls"
            desabilitado={travado}
            titulo="Arraste a planilha ou clique"
            aoEscolher={(arquivos) => { const f = arquivos[0]; if (f) void lerArquivo(f) }}
          />
          {(lido || texto) && (
            <button
              onClick={() => { setTexto(''); setLido(null); setSalvo(null); setAviso(null); setProblemasDaPlanilha([]) }}
              className="flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5]"
            >
              <Trash2 size={14} /> {travado ? 'Novo apontamento' : 'Limpar'}
            </button>
          )}
        </div>
        {problemasDaPlanilha.map((p, i) => (
          <p key={i} className="text-xs text-[#fbbf24]">{p}</p>
        ))}
      </section>

      {lido && (
        <section className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4 space-y-4">
          <h3 className="text-sm font-semibold text-[#f5f5f5]">Confira antes de salvar</h3>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo rotulo="Data">
              {lido.data ? (
                <span className="text-[#f5f5f5]">
                  {lido.data.split('-').reverse().join('/')}
                  {/* ⚠️ O apontamento escreve "31/08" sem ano. Quem confere precisa VER o ano escolhido. */}
                  {lido.anoInferido && <span className="ml-1 text-[#fbbf24]">· ano deduzido</span>}
                </span>
              ) : (
                <span className="text-[#fbbf24]">não veio no texto — vai a data de hoje</span>
              )}
            </Campo>
            <Campo rotulo="Equipe">{lido.equipe ?? <Ausente />}</Campo>
            <Campo rotulo="Núcleo">{lido.nucleo ?? <Ausente />}</Campo>
            <Campo rotulo="Imóveis">
              {lido.imoveis.length ? `${lido.imoveis.length} endereço${lido.imoveis.length > 1 ? 's' : ''}` : <Ausente />}
            </Campo>
          </div>

          {lido.imoveis.length > 0 && (
            <ul className="space-y-0.5 text-xs text-[#a3a3a3]">
              {lido.imoveis.map((im, i) => <li key={i}>· {im}</li>)}
            </ul>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#525252] text-left text-[#6b6b6b]">
                  <th className="py-1.5 pr-3 font-medium">Serviço</th>
                  <th className="py-1.5 pr-3 font-medium">Sigla</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Quantidade</th>
                  <th className="py-1.5 font-medium">Un.</th>
                </tr>
              </thead>
              <tbody>
                {lido.linhas.map((l, i) => (
                  <tr key={`${l.sigla}-${i}`} className="border-b border-[#3d3d3d]">
                    <td className="py-1.5 pr-3 text-[#a3a3a3]">{l.rotulo}</td>
                    <td className="py-1.5 pr-3 text-[#f5f5f5]">{l.sigla}</td>
                    <td className="py-1.5 pr-3 text-right">
                      {l.quantidade === undefined
                        ? <span className="text-[#6b6b6b]">não informado</span>
                        : <span className="font-medium text-[#f5f5f5]">{l.quantidade.toLocaleString('pt-BR')}</span>}
                    </td>
                    <td className="py-1.5 text-[#6b6b6b]">{l.unidade === 'M' ? 'm' : 'un'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {resumo && (
            <p className="text-xs text-[#a3a3a3]">
              {/* ⚠️ Metro e unidade SEPARADOS: somá-los daria um número sem significado. */}
              <strong className="text-[#f5f5f5]">{resumo.unidades.toLocaleString('pt-BR')}</strong> serviço(s)
              {resumo.metros > 0 && <> · <strong className="text-[#f5f5f5]">{resumo.metros.toLocaleString('pt-BR')}</strong> m de rede</>}
              {resumo.semMedida > 0 && <span className="text-[#6b6b6b]"> · {resumo.semMedida} sem medida</span>}
            </p>
          )}

          {lido.observacoes && (
            <Campo rotulo="Observações"><span className="whitespace-pre-wrap text-[#a3a3a3]">{lido.observacoes}</span></Campo>
          )}

          {lido.naoEntendidas.length > 0 && (
            <div className="rounded-lg border border-[#fbbf24]/40 bg-[#fbbf24]/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-[#fbbf24]">
                <AlertTriangle size={14} /> Não entendi {lido.naoEntendidas.length} linha(s)
              </p>
              <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-[#a3a3a3]">
                {lido.naoEntendidas.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {lido && (
        <section className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs text-[#6b6b6b]"><Building2 size={12} /> Obra</span>
              <select
                value={projetoId ?? ''}
                disabled={travado}
                onChange={(e) => setProjetoId(e.target.value || null)}
                className="w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-2 py-1.5 text-xs text-[#f5f5f5] focus:border-[#f97316]/50 focus:outline-none"
              >
                <option value="">— selecione a obra —</option>
                {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-[#6b6b6b]">Responsável</span>
              <input
                value={responsavel}
                disabled={travado}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder={lido.equipe ?? 'quem responde pelo dia'}
                className="w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-2 py-1.5 text-xs text-[#f5f5f5] placeholder:text-[#525252] focus:border-[#f97316]/50 focus:outline-none"
              />
            </label>
          </div>

          {!projetoId && (
            <p className="text-xs text-[#fbbf24]">
              Selecione a obra: o RDO é gravado no projeto, e é por ele que alimenta produção e o Fluxo de Caixa Projetado.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => void salvar('finalizado')} disabled={!projetoId || travado || isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-[#ffffff] disabled:opacity-40">
              <Save size={14} /> {isSaving ? 'Gravando…' : 'Salvar RDO'}
            </button>
            <button onClick={() => void salvar('rascunho')} disabled={!projetoId || travado || isSaving}
              className="flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] disabled:opacity-40">
              Salvar rascunho
            </button>
            <button onClick={imprimir} className="flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5]">
              <Printer size={14} /> Imprimir
            </button>
            {projeto && salvo && <span className="text-[11px] text-[#6b6b6b]">gravado em {projeto.nome}</span>}
          </div>

          {aviso && (
            <p className={`flex items-center gap-1.5 text-xs ${aviso.tipo === 'erro' ? 'text-red-300' : aviso.tipo === 'info' ? 'text-[#fbbf24]' : 'text-[#34d399]'}`}>
              {aviso.tipo === 'erro' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />} {aviso.texto}
            </p>
          )}
        </section>
      )}
    </div>
  )
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-0.5 block text-[11px] text-[#6b6b6b]">{rotulo}</span>
      <div className="text-xs">{children}</div>
    </div>
  )
}

function Ausente() {
  return <span className="text-[#6b6b6b]">não informado</span>
}
