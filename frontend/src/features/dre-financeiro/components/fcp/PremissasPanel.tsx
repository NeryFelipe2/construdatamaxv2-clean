/**
 * PremissasPanel — o painel de controle do FCP (aba PREMISSAS da planilha).
 * Cada campo aqui recalcula o fluxo inteiro, porque o cálculo vive no banco:
 * salvar dispara uma releitura de fcp_semanas/fcp_capital/fcp_viabilidade.
 */
import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import type { UseFcpReturn, FcpPremissas, Cenario, QuemPaga } from '@/hooks/useFcp'
import { cardCls, inputCls, btnPrimario, vazioCls, pct } from './ui'

const CENARIOS: Cenario[] = ['MÍNIMA', 'MÉDIA', 'BOA', 'ÓTIMA']
const PAGADORES: QuemPaga[] = ['CONSÓRCIO', 'WCR']

function Linha({ label, ajuda, children }: { label: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,20rem)_minmax(0,11rem)_1fr] gap-2 md:gap-4 items-center py-2 border-b border-[#525252]/40">
      <div className="text-sm text-[#f5f5f5]">{label}</div>
      <div>{children}</div>
      {ajuda ? <div className="text-xs text-[#6b6b6b] leading-snug">{ajuda}</div> : <div />}
    </div>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className={`${cardCls} p-5`}>
      <h3 className="text-sm font-bold text-[#a3a3a3] uppercase tracking-wider mb-3">{titulo}</h3>
      {children}
    </div>
  )
}

export function PremissasPanel({ fcp }: { fcp: UseFcpReturn }) {
  const { premissas, salvarPremissas, travado } = fcp
  const [rascunho, setRascunho] = useState<FcpPremissas | null>(premissas)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => setRascunho(premissas), [premissas])

  if (!premissas || !rascunho) {
    return <div className={vazioCls}>Este FCP ainda não tem premissas cadastradas.</div>
  }

  const mudou = JSON.stringify(rascunho) !== JSON.stringify(premissas)
  const set = <K extends keyof FcpPremissas>(k: K, v: FcpPremissas[K]) =>
    setRascunho((r) => (r ? { ...r, [k]: v } : r))

  const margemAtual = {
    'MÍNIMA': rascunho.margem_minima, 'MÉDIA': rascunho.margem_media,
    'BOA': rascunho.margem_boa, 'ÓTIMA': rascunho.margem_otima,
  }[rascunho.cenario]

  const salvar = async () => {
    setSalvando(true)
    const { fcp_id: _ignora, ...campos } = rascunho
    await salvarPremissas(campos)
    setSalvando(false)
  }

  return (
    <div className="space-y-4">
      {travado && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <Lock size={15} />
          Este FCP está aprovado — as premissas estão travadas. Um administrador pode reabrir.
        </div>
      )}

      <Grupo titulo="1 · Calendário e contrato">
        <Linha label="Início da obra (semana 1)" ajuda="Primeira coluna do FCP Semanal.">
          <input type="date" disabled={travado} className={`${inputCls} w-full`}
            value={rascunho.inicio_obra ?? ''} onChange={(e) => set('inicio_obra', e.target.value)} />
        </Linha>
        <Linha label="Fim da operação projetada" ajuda="Último dia de obra no FCP Mensal.">
          <input type="date" disabled={travado} className={`${inputCls} w-full`}
            value={rascunho.fim_operacao ?? ''} onChange={(e) => set('fim_operacao', e.target.value)} />
        </Linha>
        <Linha label="Dias por mês (rateio)" ajuda="Convenção: diário = mensal ÷ dias, semana = 7 dias corridos.">
          <input type="number" min={1} max={31} disabled={travado} className={`${inputCls} w-full`}
            value={rascunho.dias_mes} onChange={(e) => set('dias_mes', Number(e.target.value))} />
        </Linha>
        <Linha label="Defasagem de recebimento (dias)"
          ajuda="A medição fecha no último dia do mês e é paga N dias depois.">
          <input type="number" min={0} disabled={travado} className={`${inputCls} w-full`}
            value={rascunho.defasagem_dias} onChange={(e) => set('defasagem_dias', Number(e.target.value))} />
        </Linha>
        <Linha label="Imposto da nota" ajuda="Retenções + tributos sobre a medição bruta.">
          <div className="flex items-center gap-2">
            <input type="number" step="0.01" min={0} max={0.99} disabled={travado} className={`${inputCls} w-full`}
              value={rascunho.imposto_aliquota} onChange={(e) => set('imposto_aliquota', Number(e.target.value))} />
            <span className="text-xs text-[#a3a3a3] font-mono">{pct(rascunho.imposto_aliquota)}</span>
          </div>
        </Linha>
      </Grupo>

      <Grupo titulo="2 · Cenário de produção">
        <Linha label="Cenário adotado no fluxo"
          ajuda="Todo o fluxo recalcula. MÍNIMA = empate real (cobre custo + imposto).">
          <select disabled={travado} className={`${inputCls} w-full`}
            value={rascunho.cenario} onChange={(e) => set('cenario', e.target.value as Cenario)}>
            {CENARIOS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Linha>
        {([['margem_minima', 'MÍNIMA'], ['margem_media', 'MÉDIA'],
           ['margem_boa', 'BOA'], ['margem_otima', 'ÓTIMA']] as const).map(([campo, rotulo]) => (
          <Linha key={campo} label={`Margem do cenário ${rotulo}`}>
            <div className="flex items-center gap-2">
              <input type="number" step="0.01" min={0} disabled={travado} className={`${inputCls} w-full`}
                value={rascunho[campo]} onChange={(e) => set(campo, Number(e.target.value))} />
              <span className="text-xs text-[#a3a3a3] font-mono">{pct(rascunho[campo])}</span>
            </div>
          </Linha>
        ))}
        <div className="pt-3 text-xs text-[#a3a3a3]">
          Margem em vigor: <span className="font-mono text-[#f97316] font-semibold">{pct(margemAtual)}</span>
        </div>
      </Grupo>

      <Grupo titulo="3 · Capital e risco">
        <Linha label="Contingência sobre a necessidade de caixa"
          ajuda="Atraso de medição, chuva, quebra, retrabalho.">
          <div className="flex items-center gap-2">
            <input type="number" step="0.01" min={0} disabled={travado} className={`${inputCls} w-full`}
              value={rascunho.contingencia} onChange={(e) => set('contingencia', Number(e.target.value))} />
            <span className="text-xs text-[#a3a3a3] font-mono">{pct(rascunho.contingencia)}</span>
          </div>
        </Linha>
        <Linha label="Fator de custos do 1º mês" ajuda="Fração do custo mensal quando a obra começa no meio do mês.">
          <input type="number" step="0.1" min={0} max={1} disabled={travado} className={`${inputCls} w-full`}
            value={rascunho.fator_primeiro_mes} onChange={(e) => set('fator_primeiro_mes', Number(e.target.value))} />
        </Linha>
      </Grupo>

      <Grupo titulo="4 · Quem paga o quê — regime com o consórcio">
        {([['paga_folha', 'Folha das equipes'], ['paga_engenheiro', 'Engenheiro'],
           ['paga_estrutura', 'Estrutura e locações'], ['paga_indiretos', 'Custos indiretos'],
           ['paga_mobilizacao', 'Mobilização']] as const).map(([campo, rotulo]) => (
          <Linha key={campo} label={rotulo}>
            <select disabled={travado} className={`${inputCls} w-full`}
              value={rascunho[campo]} onChange={(e) => set(campo, e.target.value as QuemPaga)}>
              {PAGADORES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Linha>
        ))}
        <Linha label="O consórcio desconta da medição o que ele paga?"
          ajuda="SIM = o que ele banca é abatido do valor que a WCR recebe.">
          <select disabled={travado} className={`${inputCls} w-full`}
            value={rascunho.desconta_medicao ? 'SIM' : 'NÃO'}
            onChange={(e) => set('desconta_medicao', e.target.value === 'SIM')}>
            <option>SIM</option><option>NÃO</option>
          </select>
        </Linha>
        <Linha label="Base do imposto da nota"
          ajuda="CHEIA = imposto sobre a medição toda (conservador). LÍQUIDA = só sobre o que a WCR fatura de fato.">
          <select disabled={travado} className={`${inputCls} w-full`}
            value={rascunho.base_imposto}
            onChange={(e) => set('base_imposto', e.target.value as FcpPremissas['base_imposto'])}>
            <option>MEDIÇÃO CHEIA</option><option>LÍQUIDA DO DESCONTO</option>
          </select>
        </Linha>
      </Grupo>

      <div className="flex items-center gap-3 pt-1">
        <button className={btnPrimario} disabled={!mudou || salvando || travado} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar premissas'}
        </button>
        {mudou && !travado && (
          <span className="text-xs text-amber-300">Há alterações não salvas — o fluxo só recalcula depois de salvar.</span>
        )}
      </div>
    </div>
  )
}
