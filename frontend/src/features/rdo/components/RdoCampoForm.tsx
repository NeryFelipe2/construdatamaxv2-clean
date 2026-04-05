/**
 * RdoCampoForm — Formulario estruturado de RDO para preenchimento em campo.
 * Mobile-first, com dropdowns pre-configurados para evitar erros.
 * Segue exatamente a estrutura pedida: Equipes → Atividades → Materiais → Equipamentos → Mao de Obra → Fotos → Ocorrencias.
 */
import { useState, useRef, useMemo } from "react"
import {
  Plus, Trash2, Camera, ChevronDown, ChevronRight, Send, X,
  CloudSun, Users, Wrench, Package, HardHat, AlertTriangle, Upload,
} from "lucide-react"
import { useProjectContext } from "@/store/projectContext"
import { useContatosStore } from "@/store/contatosStore"

// ─── Options ────────────────────────────────────────────────────────────────

const CLIMA_OPTIONS = ["Ensolarado", "Nublado", "Chuvoso", "Parcialmente nublado"]
const TURNO_OPTIONS = ["Diurno", "Noturno", "Integral"]
const TIPO_EQUIPE_OPTIONS = ["Rede Esgoto", "Rede Agua", "Ligacao Domiciliar", "Pavimentacao", "Reaterro", "Teste", "Manutencao"]
const SERVICO_OPTIONS = ["Assentamento", "Escavacao", "Reaterro", "Ligacao Casa", "Ligacao Intradomiciliar", "Teste Estanqueidade", "Reparo", "Instalacao Ramal", "CFTV"]
const TUBO_OPTIONS = ["PVC DN100", "PVC DN150", "PVC DN200", "PVC DN250", "PVC DN300", "PEAD DN63", "PEAD DN110", "PEAD DN160", "Tubo 3/4", "Tubo 50mm", "Tubo 100mm", "Outro"]
const PECAS_OPTIONS = ["PI", "Curva", "Luva", "TEE", "TSI", "Cap", "Reducao", "Juncao", "Anel"]
const EQUIP_OPTIONS = [
  { tipo: "Retroescavadeira", max: 5 },
  { tipo: "Escavadeira Hidraulica", max: 3 },
  { tipo: "Compactador", max: 3 },
  { tipo: "Caminhao Munck", max: 3 },
  { tipo: "Caminhao Basculante", max: 5 },
  { tipo: "Bomba", max: 3 },
  { tipo: "Placa Vibratoria", max: 3 },
]
const MAO_OBRA_CARGOS = ["Ajudantes", "Pedreiros", "Encanadores", "Operadores", "Motoristas", "Apontadores", "Tec. Seguranca", "Engenheiro", "Encarregado"]
const OCORRENCIA_TIPOS = ["Nenhuma", "Acidente", "Chuva parou obra", "Falta material", "Problema solo", "Equipamento quebrado", "Falta mao de obra", "Outro"]

// ─── Types ──────────────────────────────────────────────────────────────────

interface Atividade {
  id: string; rua: string; servico: string; tubo: string; metragem: number; pecas: string[]; casas: string; obs: string
}
interface Equipe {
  id: string; tipo: string; lider: string; atividades: Atividade[]
}
interface MaterialItem {
  desc: string; qtd: number; unidade: string
}
interface EquipItem {
  tipo: string; qtd: number
}
interface MaoObraItem {
  cargo: string; qtd: number
}

// ─── Section ────────────────────────────────────────────────────────────────

function Section({ title, icon, children, badge }: { title: string; icon: React.ReactNode; children: React.ReactNode; badge?: string }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-[#112645] border border-[#20406a] rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#14294e] transition-colors">
        {icon}
        <span className="text-sm font-semibold text-[#e4f2f8] flex-1 text-left">{title}</span>
        {badge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2abfdc]/10 text-[#2abfdc]">{badge}</span>}
        {open ? <ChevronDown size={16} className="text-[#6b6b6b]" /> : <ChevronRight size={16} className="text-[#6b6b6b]" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  )
}

// ─── Input components (large touch targets) ─────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] font-bold text-[#5a8caa] uppercase tracking-wider">{children}</label>
}

function TextInput({ placeholder, value, onChange, type = "text", inputMode }: { placeholder: string; value: string | number; onChange: (v: string) => void; type?: string; inputMode?: any }) {
  return <input type={type} inputMode={inputMode} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
    className="w-full bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-3 text-sm text-[#e4f2f8] placeholder-[#5a8caa] min-h-[44px]" />
}

function SelectInput({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-3 text-sm text-[#e4f2f8] min-h-[44px] appearance-none">
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ─── Main Form ──────────────────────────────────────────────────────────────

export function RdoCampoForm() {
  const projetos = useProjectContext(s => s.projetos)
  const allFrentes = useProjectContext(s => s.frentes)
  const activeProjectId = useProjectContext(s => s.activeProjectId)
  const contatos = useContatosStore(s => s.contatos)
  const activeProjeto = useMemo(() => projetos.find(p => p.id === activeProjectId) ?? null, [projetos, activeProjectId])
  const frentes = useMemo(() => allFrentes.filter(f => f.projeto_id === activeProjectId), [allFrentes, activeProjectId])
  const lideres = useMemo(() => contatos.filter(c => c.projeto_id === activeProjectId && ['Encarregado', 'Mestre', 'Engenheiro'].includes(c.cargo)), [contatos, activeProjectId])

  // Cabecalho
  const [data] = useState(new Date().toISOString().slice(0, 10))
  const [frenteId, setFrenteId] = useState("")
  const [clima, setClima] = useState("Ensolarado")
  const [turno, setTurno] = useState("Diurno")

  // Equipes
  const [equipes, setEquipes] = useState<Equipe[]>([])

  // Materiais manuais extras
  const [materiaisExtras, setMateriaisExtras] = useState<MaterialItem[]>([])

  // Equipamentos
  const [equipamentos, setEquipamentos] = useState<EquipItem[]>([])

  // Mao de Obra
  const [maoObra, setMaoObra] = useState<MaoObraItem[]>(MAO_OBRA_CARGOS.map(c => ({ cargo: c, qtd: 0 })))

  // Fotos
  const [fotos, setFotos] = useState<{ name: string; preview: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // Ocorrencia
  const [ocorrenciaTipo, setOcorrenciaTipo] = useState("Nenhuma")
  const [ocorrenciaDesc, setOcorrenciaDesc] = useState("")

  // ── Equipe helpers ────
  function addEquipe() {
    setEquipes(es => [...es, { id: `eq-${Date.now()}`, tipo: "Rede Esgoto", lider: "", atividades: [] }])
  }
  function removeEquipe(id: string) { setEquipes(es => es.filter(e => e.id !== id)) }
  function updateEquipe(id: string, patch: Partial<Equipe>) { setEquipes(es => es.map(e => e.id === id ? { ...e, ...patch } : e)) }

  function addAtividade(eqId: string) {
    setEquipes(es => es.map(e => e.id === eqId ? { ...e, atividades: [...e.atividades, { id: `at-${Date.now()}`, rua: "", servico: "Assentamento", tubo: "PVC DN200", metragem: 0, pecas: [], casas: "", obs: "" }] } : e))
  }
  function removeAtividade(eqId: string, atId: string) {
    setEquipes(es => es.map(e => e.id === eqId ? { ...e, atividades: e.atividades.filter(a => a.id !== atId) } : e))
  }
  function updateAtividade(eqId: string, atId: string, patch: Partial<Atividade>) {
    setEquipes(es => es.map(e => e.id === eqId ? { ...e, atividades: e.atividades.map(a => a.id === atId ? { ...a, ...patch } : a) } : e))
  }

  // ── Materiais auto-calculados ────
  const materiaisAuto: MaterialItem[] = []
  const matMap = new Map<string, number>()
  const pecasMap = new Map<string, number>()
  equipes.forEach(eq => eq.atividades.forEach(at => {
    if (at.tubo && at.metragem > 0) {
      const key = at.tubo
      matMap.set(key, (matMap.get(key) ?? 0) + at.metragem)
    }
    at.pecas.forEach(p => pecasMap.set(p, (pecasMap.get(p) ?? 0) + 1))
  }))
  matMap.forEach((qtd, desc) => materiaisAuto.push({ desc, qtd, unidade: "m" }))
  pecasMap.forEach((qtd, desc) => materiaisAuto.push({ desc, qtd, unidade: "un" }))
  const todosMateriaisConcat = [...materiaisAuto, ...materiaisExtras]

  // ── Fotos ────
  function handleFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach(f => {
      const reader = new FileReader()
      reader.onload = () => setFotos(prev => [...prev, { name: f.name, preview: reader.result as string }])
      reader.readAsDataURL(f)
    })
    e.target.value = ""
  }

  // ── Submit ────
  function handleSubmit() {
    const payload = {
      data, projeto_id: activeProjectId, frente_id: frenteId || null, clima, turno,
      equipes: equipes.map(eq => ({ tipo: eq.tipo, lider: eq.lider, atividades: eq.atividades })),
      materiais: todosMateriaisConcat,
      equipamentos,
      mao_obra: maoObra.filter(m => m.qtd > 0),
      fotos: fotos.map(f => f.name),
      ocorrencia: { tipo: ocorrenciaTipo, descricao: ocorrenciaDesc },
    }
    console.log("RDO Payload:", payload)
    alert("RDO salvo! (Supabase integration coming)")
  }

  return (
    <div className="max-w-3xl mx-auto p-3 md:p-6 space-y-4 pb-24">
      {/* ── Secao 1: Cabecalho ── */}
      <Section title="Cabecalho" icon={<CloudSun size={18} className="text-sky-400" />}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Data</FieldLabel>
            <TextInput type="date" value={data} onChange={() => {}} placeholder="" />
          </div>
          <div>
            <FieldLabel>Projeto</FieldLabel>
            <div className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-3 text-sm text-[#2abfdc] min-h-[44px]">{activeProjeto?.nome ?? "—"}</div>
          </div>
          <div>
            <FieldLabel>Frente</FieldLabel>
            <SelectInput value={frenteId} onChange={setFrenteId} options={frentes.map(f => f.nome)} placeholder="Selecionar frente" />
          </div>
          <div>
            <FieldLabel>Clima</FieldLabel>
            <SelectInput value={clima} onChange={setClima} options={CLIMA_OPTIONS} />
          </div>
          <div className="col-span-2">
            <FieldLabel>Turno</FieldLabel>
            <div className="flex gap-2">
              {TURNO_OPTIONS.map(t => (
                <button key={t} onClick={() => setTurno(t)}
                  className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${turno === t ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "bg-[#0d2040] text-[#6b6b6b] border border-[#20406a]"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Secao 2: Equipes ── */}
      <Section title="Equipes" icon={<Users size={18} className="text-purple-400" />} badge={`${equipes.length}`}>
        {equipes.map((eq, eqIdx) => (
          <div key={eq.id} className="bg-[#0d2040] border border-[#20406a] rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-purple-400">Equipe {eqIdx + 1}</span>
              <div className="flex-1" />
              <button onClick={() => removeEquipe(eq.id)} className="p-1.5 rounded hover:bg-rose-500/10 text-[#6b6b6b] hover:text-rose-400 transition-colors"><Trash2 size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel>Tipo</FieldLabel>
                <SelectInput value={eq.tipo} onChange={v => updateEquipe(eq.id, { tipo: v })} options={TIPO_EQUIPE_OPTIONS} />
              </div>
              <div>
                <FieldLabel>Lider</FieldLabel>
                <SelectInput value={eq.lider} onChange={v => updateEquipe(eq.id, { lider: v })} options={lideres.map(l => l.nome)} placeholder="Selecionar lider" />
              </div>
            </div>

            {/* Atividades */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#5a8caa] uppercase">Atividades ({eq.atividades.length})</span>
                <button onClick={() => addAtividade(eq.id)} className="flex items-center gap-1 text-[10px] text-[#2abfdc] hover:text-[#2abfdc]/80 font-medium"><Plus size={12} /> Atividade</button>
              </div>
              {eq.atividades.map((at) => (
                <div key={at.id} className="bg-[#071422] border border-[#1a3050] rounded-lg p-3 space-y-2">
                  <div className="flex justify-end">
                    <button onClick={() => removeAtividade(eq.id, at.id)} className="p-1 text-[#6b6b6b] hover:text-rose-400"><Trash2 size={12} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <FieldLabel>Rua / Local</FieldLabel>
                      <TextInput placeholder="Ex: Rua B, beco do Sheike" value={at.rua} onChange={v => updateAtividade(eq.id, at.id, { rua: v })} />
                    </div>
                    <div>
                      <FieldLabel>Servico</FieldLabel>
                      <SelectInput value={at.servico} onChange={v => updateAtividade(eq.id, at.id, { servico: v })} options={SERVICO_OPTIONS} />
                    </div>
                    <div>
                      <FieldLabel>Tubo</FieldLabel>
                      <SelectInput value={at.tubo} onChange={v => updateAtividade(eq.id, at.id, { tubo: v })} options={TUBO_OPTIONS} />
                    </div>
                    <div>
                      <FieldLabel>Metragem (m)</FieldLabel>
                      <TextInput type="number" inputMode="numeric" placeholder="0" value={at.metragem || ""} onChange={v => updateAtividade(eq.id, at.id, { metragem: Number(v) || 0 })} />
                    </div>
                    <div>
                      <FieldLabel>Casas atendidas</FieldLabel>
                      <TextInput placeholder="423, 600, 602" value={at.casas} onChange={v => updateAtividade(eq.id, at.id, { casas: v })} />
                    </div>
                  </div>
                  {/* Pecas */}
                  <div>
                    <FieldLabel>Pecas especiais</FieldLabel>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {PECAS_OPTIONS.map(p => (
                        <button key={p} onClick={() => {
                          const has = at.pecas.includes(p)
                          updateAtividade(eq.id, at.id, { pecas: has ? at.pecas.filter(x => x !== p) : [...at.pecas, p] })
                        }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${at.pecas.includes(p) ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "bg-[#0d2040] text-[#6b6b6b] border border-[#20406a]"}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Observacao</FieldLabel>
                    <TextInput placeholder="Obs (opcional)" value={at.obs} onChange={v => updateAtividade(eq.id, at.id, { obs: v })} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <button onClick={addEquipe} className="w-full py-3 rounded-lg border-2 border-dashed border-[#20406a] text-[#5a8caa] hover:border-purple-500/50 hover:text-purple-400 transition-colors flex items-center justify-center gap-2 min-h-[44px]">
          <Plus size={16} /> Adicionar Equipe
        </button>
      </Section>

      {/* ── Secao 3: Materiais ── */}
      <Section title="Materiais" icon={<Package size={18} className="text-amber-400" />} badge={`${todosMateriaisConcat.length}`}>
        {materiaisAuto.length > 0 && (
          <div>
            <span className="text-[10px] text-[#5a8caa] uppercase font-bold">Auto-somado das atividades</span>
            <div className="space-y-1 mt-1">
              {materiaisAuto.map((m, i) => (
                <div key={i} className="flex items-center justify-between bg-[#0d2040] rounded-lg px-3 py-2">
                  <span className="text-xs text-[#e4f2f8]">{m.desc}</span>
                  <span className="text-xs font-mono text-[#2abfdc]">{m.qtd}{m.unidade}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <button onClick={() => setMateriaisExtras(m => [...m, { desc: "", qtd: 0, unidade: "un" }])}
          className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium"><Plus size={14} /> Material Manual</button>
        {materiaisExtras.map((m, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1"><FieldLabel>Descricao</FieldLabel>
              <TextInput placeholder="Material" value={m.desc} onChange={v => { const n = [...materiaisExtras]; n[i].desc = v; setMateriaisExtras(n) }} /></div>
            <div className="w-20"><FieldLabel>Qtd</FieldLabel>
              <TextInput type="number" inputMode="numeric" placeholder="0" value={m.qtd || ""} onChange={v => { const n = [...materiaisExtras]; n[i].qtd = Number(v); setMateriaisExtras(n) }} /></div>
            <div className="w-16"><FieldLabel>Un</FieldLabel>
              <SelectInput value={m.unidade} onChange={v => { const n = [...materiaisExtras]; n[i].unidade = v; setMateriaisExtras(n) }} options={["un", "m", "kg", "l", "pcs"]} /></div>
            <button onClick={() => setMateriaisExtras(mx => mx.filter((_, j) => j !== i))} className="p-2 text-[#6b6b6b] hover:text-rose-400 min-h-[44px]"><Trash2 size={14} /></button>
          </div>
        ))}
      </Section>

      {/* ── Secao 4: Equipamentos ── */}
      <Section title="Equipamentos" icon={<Wrench size={18} className="text-cyan-400" />}>
        <div className="space-y-2">
          {EQUIP_OPTIONS.map(eq => {
            const existing = equipamentos.find(e => e.tipo === eq.tipo)
            return (
              <div key={eq.tipo} className="flex items-center gap-3 bg-[#0d2040] rounded-lg px-3 py-2">
                <button onClick={() => {
                  if (existing) setEquipamentos(es => es.filter(e => e.tipo !== eq.tipo))
                  else setEquipamentos(es => [...es, { tipo: eq.tipo, qtd: 1 }])
                }}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${existing ? "bg-cyan-500 border-cyan-500" : "border-[#20406a]"}`}>
                  {existing && <span className="text-white text-[10px] font-bold">✓</span>}
                </button>
                <span className="text-xs text-[#e4f2f8] flex-1">{eq.tipo}</span>
                {existing && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#5a8caa]">Qtd:</span>
                    {Array.from({ length: eq.max }, (_, n) => n + 1).map(n => (
                      <button key={n} onClick={() => setEquipamentos(es => es.map(e => e.tipo === eq.tipo ? { ...e, qtd: n } : e))}
                        className={`w-8 h-8 rounded text-xs font-medium transition-colors ${existing.qtd === n ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-[#071422] text-[#6b6b6b] border border-[#1a3050]"}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── Secao 5: Mao de Obra ── */}
      <Section title="Mao de Obra" icon={<HardHat size={18} className="text-green-400" />}
        badge={`${maoObra.reduce((s, m) => s + m.qtd, 0)} total`}>
        <div className="grid grid-cols-3 gap-2">
          {maoObra.map((m, i) => (
            <div key={m.cargo} className="bg-[#0d2040] rounded-lg p-2 text-center">
              <div className="text-[10px] text-[#5a8caa] mb-1">{m.cargo}</div>
              <input type="number" inputMode="numeric" min={0} value={m.qtd || ""} placeholder="0"
                onChange={e => { const n = [...maoObra]; n[i].qtd = Number(e.target.value) || 0; setMaoObra(n) }}
                className="w-full text-center bg-transparent border border-[#20406a] rounded-lg py-2 text-lg font-bold text-[#e4f2f8] min-h-[44px]" />
            </div>
          ))}
        </div>
      </Section>

      {/* ── Secao 6: Fotos ── */}
      <Section title="Fotos" icon={<Camera size={18} className="text-pink-400" />} badge={`${fotos.length}`}>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFotos} className="hidden" />
        <button onClick={() => fileRef.current?.click()}
          className="w-full py-4 rounded-lg border-2 border-dashed border-[#20406a] text-[#5a8caa] hover:border-pink-500/50 hover:text-pink-400 transition-colors flex items-center justify-center gap-2 min-h-[56px]">
          <Upload size={20} /> Tirar Foto ou Selecionar
        </button>
        {fotos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((f, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-[#0d2040]">
                <img src={f.preview} alt={f.name} className="w-full h-full object-cover" />
                <button onClick={() => setFotos(fs => fs.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-rose-500 transition-colors">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {fotos.length === 0 && <p className="text-[10px] text-rose-400">* Minimo 1 foto obrigatoria</p>}
      </Section>

      {/* ── Secao 7: Ocorrencias ── */}
      <Section title="Ocorrencias" icon={<AlertTriangle size={18} className="text-rose-400" />}>
        <SelectInput value={ocorrenciaTipo} onChange={setOcorrenciaTipo} options={OCORRENCIA_TIPOS} />
        {ocorrenciaTipo !== "Nenhuma" && (
          <textarea placeholder="Descreva a ocorrencia..." value={ocorrenciaDesc} onChange={e => setOcorrenciaDesc(e.target.value)}
            className="w-full bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-3 text-sm text-[#e4f2f8] placeholder-[#5a8caa] min-h-[80px] resize-none" />
        )}
      </Section>

      {/* ── Submit ── */}
      <button onClick={handleSubmit}
        className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm flex items-center justify-center gap-2 min-h-[56px] sticky bottom-3 shadow-lg shadow-green-600/20 transition-colors">
        <Send size={18} /> Salvar RDO
      </button>
    </div>
  )
}
