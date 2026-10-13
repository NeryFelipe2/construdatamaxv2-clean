/**
 * PessoaDrawer — drawer/modal ÚNICO de criar/editar pessoa.
 * Seções: Identificação · Cargo & vínculo · Equipe · Contrato (experiências
 * CALCULADAS admissão+44d/+89d, read-only com botão de destravar) · EPI ·
 * Observações. "Excluir" = status desligado + fecha vínculos de equipe.
 */
import { useMemo, useState } from 'react'
import { Pencil, Trash2, X } from 'lucide-react'
import type { usePessoas, Pessoa } from '@/hooks/usePessoas'
import type { EquipeCard } from '@/data/wcrEquipes'
import { pessoaFormSchema, calcularExperiencias } from '../schemas'
import { inputCls, selectCls, btnPrimario, btnSecundario, modalOverlayCls, modalBoxCls } from './ui'

type UsePessoasReturn = ReturnType<typeof usePessoas>

interface Props {
  pessoal: UsePessoasReturn
  equipes: EquipeCard[]
  /** null = criar nova pessoa. */
  pessoa: Pessoa | null
  /** pré-preenche o nome no modo criar (fluxo "criar novo…" do autocomplete). */
  nomeInicial?: string
  /** pré-seleciona a equipe no modo criar (fluxo "criar novo…" do EquipesPanel). */
  equipeInicialId?: string
  onClose: (pessoaCriadaId?: string | null) => void
}

const VINCULOS = ['WCR', 'JWL', 'terceiro']

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b] mb-2">{titulo}</p>
      {children}
    </div>
  )
}

export function PessoaDrawer({ pessoal, equipes, pessoa, nomeInicial, equipeInicialId, onClose }: Props) {
  const editando = pessoa !== null

  const [nome, setNome] = useState(pessoa?.nome_completo ?? nomeInicial ?? '')
  const [apelido, setApelido] = useState(pessoa?.apelido ?? '')
  const [cargoId, setCargoId] = useState(pessoa?.cargo_id ?? '')
  const [vinculo, setVinculo] = useState(pessoa?.vinculo ?? '')
  const [status, setStatus] = useState(pessoa?.status ?? 'ativo')
  const [equipeId, setEquipeId] = useState(pessoa?.equipeAtual?.equipeId ?? equipeInicialId ?? '')
  const [funcaoNaEquipe, setFuncaoNaEquipe] = useState(pessoa?.equipeAtual?.funcao ?? '')
  const [telefone, setTelefone] = useState(pessoa?.telefone ?? '')
  const [dataAdmissao, setDataAdmissao] = useState(pessoa?.data_admissao ?? '')
  const [expManual, setExpManual] = useState(false)
  const [exp1Manual, setExp1Manual] = useState(pessoa?.venc_experiencia_1 ?? '')
  const [exp2Manual, setExp2Manual] = useState(pessoa?.venc_experiencia_2 ?? '')
  const [epiCalca, setEpiCalca] = useState(pessoa?.epi_calca ?? '')
  const [epiCamisa, setEpiCamisa] = useState(pessoa?.epi_camisa ?? '')
  const [epiBotina, setEpiBotina] = useState(pessoa?.epi_botina ?? '')
  const [observacoes, setObservacoes] = useState(pessoa?.observacoes ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const expCalculadas = useMemo(
    () => (dataAdmissao ? calcularExperiencias(dataAdmissao) : null),
    [dataAdmissao],
  )
  const exp1 = expManual ? exp1Manual : expCalculadas?.exp1 ?? ''
  const exp2 = expManual ? exp2Manual : expCalculadas?.exp2 ?? ''

  const equipesAtivas = equipes

  async function handleSalvar() {
    setErro(null)
    const parsed = pessoaFormSchema.safeParse({
      nomeCompleto: nome,
      apelido: apelido || undefined,
      cargoId: cargoId || undefined,
      vinculo: vinculo || undefined,
      equipeId: equipeId || undefined,
      funcaoNaEquipe: funcaoNaEquipe || undefined,
      dataAdmissao: dataAdmissao || '',
      vencExperiencia1: exp1 || '',
      vencExperiencia2: exp2 || '',
      telefone: telefone || undefined,
      epiCalca: epiCalca || undefined,
      epiCamisa: epiCamisa || undefined,
      epiBotina: epiBotina || undefined,
      observacoes: observacoes || undefined,
      status,
    })
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }
    setSalvando(true)
    try {
      if (!editando) {
        const criada = await pessoal.criarPessoa({
          nomeCompleto: nome,
          apelido: apelido || null,
          cargoId: cargoId || null,
          status,
          vinculo: vinculo || null,
          telefone: telefone || null,
          dataAdmissao: dataAdmissao || null,
          vencExperiencia1: exp1 || null,
          vencExperiencia2: exp2 || null,
          epiCalca: epiCalca || null,
          epiCamisa: epiCamisa || null,
          epiBotina: epiBotina || null,
          observacoes: observacoes || null,
          equipeId: equipeId || null,
          funcaoNaEquipe: funcaoNaEquipe || null,
        })
        if (!criada) {
          setErro(pessoal.error ?? 'Não foi possível criar — confira as migrations de pessoal.')
          setSalvando(false)
          return
        }
        onClose(criada.id)
        return
      }

      await pessoal.atualizarPessoa(pessoa.id, {
        nome_completo: nome.trim(),
        apelido: apelido || null,
        cargo_id: cargoId || null,
        status,
        vinculo: vinculo || null,
        telefone: telefone || null,
        data_admissao: dataAdmissao || null,
        venc_experiencia_1: exp1 || null,
        venc_experiencia_2: exp2 || null,
        epi_calca: epiCalca || null,
        epi_camisa: epiCamisa || null,
        epi_botina: epiBotina || null,
        observacoes: observacoes || null,
      })
      const equipeAntes = pessoa.equipeAtual?.equipeId ?? ''
      const funcaoAntes = pessoa.equipeAtual?.funcao ?? ''
      if (equipeId !== equipeAntes || funcaoNaEquipe !== funcaoAntes) {
        await pessoal.vincularEquipe(pessoa.id, equipeId || null, funcaoNaEquipe || null)
      }
      onClose(pessoa.id)
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir() {
    if (!pessoa) return
    if (
      !confirm(
        `"Excluir" não apaga o histórico: ${pessoa.nome_completo} vira status DESLIGADO e os vínculos de equipe são fechados. Confirmar?`,
      )
    )
      return
    setSalvando(true)
    await pessoal.desligarPessoa(pessoa.id)
    setSalvando(false)
    onClose(pessoa.id)
  }

  return (
    <div className={modalOverlayCls} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`${modalBoxCls} w-full max-w-2xl max-h-[92vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <h2 className="text-sm font-bold text-[#f5f5f5]">
            {editando ? `Editar — ${pessoa.nome_completo}` : 'Novo Funcionário'}
          </h2>
          <button onClick={() => onClose()} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Identificação */}
          <Secao titulo="Identificação">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[#a3a3a3] text-xs mb-1">Nome completo *</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" className={inputCls} />
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Apelido</label>
                <input value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Ex.: Mazinho" className={inputCls} />
              </div>
            </div>
          </Secao>

          {/* Cargo & vínculo */}
          <Secao titulo="Cargo & vínculo">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Cargo</label>
                <select value={cargoId} onChange={(e) => setCargoId(e.target.value)} className={selectCls}>
                  <option value="">— sem cargo —</option>
                  {pessoal.cargos.filter((c) => c.ativo).map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                {editando && pessoa.cargo_texto && !cargoId && (
                  <p className="text-[#6b6b6b] text-[10px] mt-1">na fonte: “{pessoa.cargo_texto}”</p>
                )}
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Mão de obra</label>
                <select value={vinculo} onChange={(e) => setVinculo(e.target.value)} className={selectCls}>
                  <option value="">—</option>
                  {VINCULOS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectCls}>
                  <option value="ativo">Ativo</option>
                  <option value="em_contratacao">Em contratação</option>
                  <option value="afastado">Afastado</option>
                  <option value="desligado">Desligado</option>
                  <option value="desconhecido">Desconhecido</option>
                </select>
              </div>
            </div>
          </Secao>

          {/* Equipe */}
          <Secao titulo="Equipe">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Equipe atual</label>
                <select value={equipeId} onChange={(e) => setEquipeId(e.target.value)} className={selectCls}>
                  <option value="">— sem equipe —</option>
                  {equipesAtivas.map((e) => (
                    <option key={e.id} value={e.id}>{e.equipe}</option>
                  ))}
                </select>
                {editando && (
                  <p className="text-[#6b6b6b] text-[10px] mt-1">
                    Trocar de equipe fecha o vínculo atual e abre um novo (histórico preservado).
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Função na equipe</label>
                <input value={funcaoNaEquipe} onChange={(e) => setFuncaoNaEquipe(e.target.value)} placeholder="Ex.: Encanador" className={inputCls} />
              </div>
            </div>
          </Secao>

          {/* Contrato */}
          <Secao titulo="Contrato">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Data de admissão</label>
                <input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[#a3a3a3] text-xs mb-1">
                  1ª experiência (+44d)
                  <button
                    type="button"
                    onClick={() => { setExpManual((v) => !v); setExp1Manual(exp1); setExp2Manual(exp2) }}
                    className="text-[#f97316] hover:text-[#ea580c]"
                    title={expManual ? 'Voltar ao cálculo automático' : 'Editar manualmente'}
                  >
                    <Pencil size={11} />
                  </button>
                </label>
                <input
                  type="date"
                  value={exp1}
                  readOnly={!expManual}
                  onChange={(e) => setExp1Manual(e.target.value)}
                  className={`${inputCls} ${expManual ? '' : 'opacity-60 cursor-not-allowed'}`}
                />
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">2ª experiência (+89d)</label>
                <input
                  type="date"
                  value={exp2}
                  readOnly={!expManual}
                  onChange={(e) => setExp2Manual(e.target.value)}
                  className={`${inputCls} ${expManual ? '' : 'opacity-60 cursor-not-allowed'}`}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Telefone</label>
                <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 9…" className={inputCls} />
              </div>
            </div>
          </Secao>

          {/* EPI */}
          <Secao titulo="EPI">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Calça</label>
                <input value={epiCalca} onChange={(e) => setEpiCalca(e.target.value)} placeholder="G1" className={inputCls} />
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Camisa</label>
                <input value={epiCamisa} onChange={(e) => setEpiCamisa(e.target.value)} placeholder="G1" className={inputCls} />
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Botina</label>
                <input value={epiBotina} onChange={(e) => setEpiBotina(e.target.value)} placeholder="42" className={inputCls} />
              </div>
            </div>
          </Secao>

          {/* Observações */}
          <Secao titulo="Observações">
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Notas livres sobre a pessoa"
              className={`${inputCls} resize-y`}
            />
          </Secao>

          {erro && (
            <div className="bg-[#dc2626]/10 border border-[#dc2626]/30 rounded-lg px-3 py-2.5">
              <p className="text-xs text-[#f87171]">{erro}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#525252]">
          {editando ? (
            <button
              onClick={handleExcluir}
              disabled={salvando}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-300 border border-red-700/40 hover:bg-red-900/30 transition-colors disabled:opacity-40"
              title="Marca como desligado e fecha os vínculos de equipe — nada é apagado"
            >
              <Trash2 size={13} /> Excluir (desligar)
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={() => onClose()} className={btnSecundario}>Cancelar</button>
            <button onClick={handleSalvar} disabled={salvando} className={btnPrimario}>
              {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar funcionário'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
