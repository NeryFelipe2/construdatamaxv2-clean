/**
 * EquipesPanel — CRUD de equipes REUSANDO o hook canônico useEquipes
 * (wcr_equipes + view equipe_membros → pessoa_equipe por baixo, migration 022).
 *
 * Adicionar membro = AUTOCOMPLETE sobre o cadastro único (pessoas); a view de
 * compatibilidade resolve o nome pra pessoa (alias confirmado → nome exato →
 * cria pessoa com revisar=true). Mover = moverMembro (fecha vínculo + abre).
 */
import { useState } from 'react'
import { Pencil, Plus, Trash2, Users, X } from 'lucide-react'
import { useEquipes, type NovaEquipeInput } from '@/hooks/useEquipes'
import { FRENTE_META, type EquipeCard, type FrenteId } from '@/data/wcrEquipes'
import type { usePessoas, Pessoa } from '@/hooks/usePessoas'
import { AutocompletePessoa } from './AutocompletePessoa'
import { PessoaDrawer } from './PessoaDrawer'
import { inputCls, selectCls, btnPrimario, btnSecundario, cardCls, modalOverlayCls, modalBoxCls, AVISO_MIGRATIONS } from './ui'

type UsePessoasReturn = ReturnType<typeof usePessoas>

interface Props {
  pessoal: UsePessoasReturn
}

interface FormEquipe {
  equipe: string
  lider: string
  encarregado: string
  frente: FrenteId
  foco: string
}

const FORM_VAZIO: FormEquipe = { equipe: '', lider: '', encarregado: '', frente: 'sul', foco: '' }

function EquipeFormModal({
  titulo,
  inicial,
  onSalvar,
  onFechar,
}: {
  titulo: string
  inicial: FormEquipe
  onSalvar: (form: FormEquipe) => void
  onFechar: () => void
}) {
  const [form, setForm] = useState<FormEquipe>(inicial)
  return (
    <div className={modalOverlayCls} onClick={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <div className={`${modalBoxCls} w-full max-w-md`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <h3 className="text-sm font-bold text-[#f5f5f5]">{titulo}</h3>
          <button onClick={onFechar} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[#a3a3a3] text-xs mb-1">Nome da equipe *</label>
            <input value={form.equipe} onChange={(e) => setForm({ ...form, equipe: e.target.value })} placeholder="Equipe João Batista" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Líder *</label>
              <input value={form.lider} onChange={(e) => setForm({ ...form, lider: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Encarregado</label>
              <input value={form.encarregado} onChange={(e) => setForm({ ...form, encarregado: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Frente</label>
              <select value={form.frente} onChange={(e) => setForm({ ...form, frente: e.target.value as FrenteId })} className={selectCls}>
                {(Object.keys(FRENTE_META) as FrenteId[]).map((f) => (
                  <option key={f} value={f}>{FRENTE_META[f].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Foco / serviço</label>
              <input value={form.foco} onChange={(e) => setForm({ ...form, foco: e.target.value })} className={inputCls} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#525252]">
          <button onClick={onFechar} className={btnSecundario}>Cancelar</button>
          <button
            onClick={() => { if (form.equipe.trim() && form.lider.trim()) onSalvar(form) }}
            disabled={!form.equipe.trim() || !form.lider.trim()}
            className={btnPrimario}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

export function EquipesPanel({ pessoal }: Props) {
  const equipesHook = useEquipes()
  const { equipes, criarEquipe, atualizarEquipe, removerEquipe, adicionarMembro, removerMembro, moverMembro } = equipesHook

  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<EquipeCard | null>(null)
  const [novaFuncao, setNovaFuncao] = useState<Record<string, string>>({})
  const [drawerNovo, setDrawerNovo] = useState<{ equipeId: string; nome: string } | null>(null)

  async function handleCriar(form: FormEquipe) {
    const input: NovaEquipeInput = {
      equipe: form.equipe.trim(),
      lider: form.lider.trim(),
      encarregado: form.encarregado.trim() || undefined,
      frente: form.frente,
      foco: form.foco.trim() || undefined,
    }
    await criarEquipe(input)
    setCriando(false)
  }

  async function handleEditar(form: FormEquipe) {
    if (!editando) return
    await atualizarEquipe(editando.id, {
      equipe: form.equipe.trim(),
      lider: form.lider.trim(),
      encarregado: form.encarregado.trim(),
      frente: form.frente,
      foco: form.foco.trim(),
    })
    setEditando(null)
  }

  function handleAdicionarPessoa(equipe: EquipeCard, pessoa: Pessoa) {
    const funcao = novaFuncao[equipe.id]?.trim() || pessoa.cargo?.nome || pessoa.cargo_texto || ''
    adicionarMembro(equipe.id, { nome: pessoa.nome_completo, funcao })
    setNovaFuncao((prev) => ({ ...prev, [equipe.id]: '' }))
  }

  function handleMover(membroId: string, membroNome: string, deEquipe: string, paraEquipeId: string) {
    const alvo = equipes.find((e) => e.id === paraEquipeId)
    if (!alvo) return
    if (
      !confirm(
        `Mover ${membroNome} de "${deEquipe}" para "${alvo.equipe}"?\n\nIsso FECHA o vínculo atual e abre um novo (o histórico fica preservado em pessoa_equipe).`,
      )
    )
      return
    moverMembro(membroId, paraEquipeId)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[#a3a3a3] text-sm">
          {equipes.length} equipe{equipes.length !== 1 ? 's' : ''} ativa{equipes.length !== 1 ? 's' : ''} ·
          membros vêm do cadastro único (view <span className="font-mono text-xs">equipe_membros</span>)
        </p>
        <button onClick={() => setCriando(true)} className={`${btnPrimario} flex items-center gap-1.5`}>
          <Plus size={14} /> Nova Equipe
        </button>
      </div>

      {pessoal.tabelasAusentes && (
        <div className="bg-[#f97316]/10 border border-[#f97316]/40 rounded-lg px-4 py-2.5">
          <p className="text-[#f97316] text-xs">
            {AVISO_MIGRATIONS} O CRUD de equipes continua funcionando no modelo antigo; o autocomplete de pessoas fica vazio até lá.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {equipes.map((equipe) => (
          <div key={equipe.id} className={`${cardCls} p-4 space-y-3`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#f97316]/15">
                  <Users size={15} className="text-[#f97316]" />
                </div>
                <div>
                  <p className="text-[#f5f5f5] text-sm font-semibold">{equipe.equipe}</p>
                  <p className="text-[#a3a3a3] text-xs">
                    Líder: {equipe.lider}
                    {equipe.encarregado ? ` · Enc.: ${equipe.encarregado}` : ''}
                    {' · '}
                    <span style={{ color: FRENTE_META[equipe.frente]?.cor ?? '#a3a3a3' }}>
                      {FRENTE_META[equipe.frente]?.label ?? equipe.frente}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditando(equipe)}
                  className="p-1.5 text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
                  title="Editar equipe"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Excluir a equipe "${equipe.equipe}"? Os membros voltam a ficar sem equipe (as pessoas continuam no cadastro).`)) {
                      removerEquipe(equipe.id)
                    }
                  }}
                  className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                  title="Excluir equipe"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Membros */}
            <div className="space-y-1.5">
              {equipe.membros.length === 0 && (
                <p className="text-[#6b6b6b] text-xs italic">Sem membros.</p>
              )}
              {equipe.membros.map((m, i) => (
                <div key={m.id ?? `${equipe.id}-${i}`} className="flex items-center gap-2 bg-[#484848]/40 rounded-lg px-2.5 py-1.5">
                  <span className="text-[#f5f5f5] text-xs flex-1 truncate">{m.nome}</span>
                  <span className="text-[#6b6b6b] text-[10px] truncate max-w-[110px]">{m.funcao || '—'}</span>
                  {m.id && (
                    <>
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) handleMover(m.id as string, m.nome, equipe.equipe, e.target.value) }}
                        className="bg-[#3d3d3d] border border-[#525252] rounded px-1 py-0.5 text-[10px] text-[#a3a3a3] focus:outline-none"
                        title="Mover para outra equipe (fecha o vínculo atual)"
                      >
                        <option value="">mover…</option>
                        {equipes.filter((e) => e.id !== equipe.id).map((e) => (
                          <option key={e.id} value={e.id}>{e.equipe}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (confirm(`Remover ${m.nome} da equipe? (fecha o vínculo — a pessoa continua no cadastro)`)) {
                            removerMembro(m.id as string)
                          }
                        }}
                        className="text-red-400 hover:text-red-300"
                        title="Remover da equipe"
                      >
                        <X size={12} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Adicionar membro (autocomplete sobre pessoas) */}
            <div className="flex items-center gap-2 flex-wrap">
              <AutocompletePessoa
                pessoas={pessoal.pessoas}
                apelidos={pessoal.apelidos}
                placeholder="+ adicionar membro (nome/apelido)…"
                onSelecionar={(p) => handleAdicionarPessoa(equipe, p)}
                onCriarNovo={(nome) => setDrawerNovo({ equipeId: equipe.id, nome })}
              />
              <input
                value={novaFuncao[equipe.id] ?? ''}
                onChange={(e) => setNovaFuncao((prev) => ({ ...prev, [equipe.id]: e.target.value }))}
                placeholder="função"
                className={`${inputCls} w-32`}
              />
            </div>
          </div>
        ))}
      </div>

      {criando && (
        <EquipeFormModal titulo="Nova Equipe" inicial={FORM_VAZIO} onSalvar={handleCriar} onFechar={() => setCriando(false)} />
      )}
      {editando && (
        <EquipeFormModal
          titulo={`Editar — ${editando.equipe}`}
          inicial={{
            equipe: editando.equipe,
            lider: editando.lider,
            encarregado: editando.encarregado,
            frente: editando.frente,
            foco: editando.foco,
          }}
          onSalvar={handleEditar}
          onFechar={() => setEditando(null)}
        />
      )}
      {drawerNovo && (
        <PessoaDrawer
          pessoal={pessoal}
          equipes={equipes}
          pessoa={null}
          nomeInicial={drawerNovo.nome}
          equipeInicialId={drawerNovo.equipeId}
          onClose={(novaPessoaId) => {
            // o drawer já grava pessoa + vínculo (pessoa_equipe); aqui só
            // recarregamos o hook de equipes pra view refletir o novo membro
            if (novaPessoaId) equipesHook.reload()
            setDrawerNovo(null)
          }}
        />
      )}
    </div>
  )
}
