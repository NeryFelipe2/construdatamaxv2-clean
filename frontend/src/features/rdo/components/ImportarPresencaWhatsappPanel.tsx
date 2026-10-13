/**
 * ImportarPresencaWhatsappPanel — cola a(s) mensagem(ns) de "Lista de Presença"
 * do grupo de WhatsApp e grava em `rdo_presenca`.
 *
 * Por que existe: 42 RDOs no sistema, 0 linhas de presença — a presença é
 * mandada todo dia no grupo, mas nunca sai de lá. A produção (PRA/LA/PV…) NÃO
 * entra aqui de propósito: os campos ficam em branco na prática e o número
 * vira texto solto — não é um problema de parser, então não vale a pena tentar
 * (ver a análise: histórico de 3 meses lido linha a linha).
 *
 * Honestidade de dado: nome ambíguo (ex.: duas pessoas chamadas "Felipe" na
 * base) NUNCA é resolvido sozinho — vira um select para alguém escolher. Errar
 * a pessoa é pior do que pedir uma confirmação a mais.
 */
import { useState } from 'react'
import { Upload, CheckCircle2, AlertTriangle, HelpCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useProjectContext } from '@/store/projectContext'
import { parseListaPresenca, ehListaDePresenca, type PresencaPessoa } from '../utils/parseListaPresenca'
import { casarPessoa, type PessoaBase, type ResultadoCasamento } from '../utils/casarPessoaPresenca'

interface LinhaRevisao {
  pessoa: PresencaPessoa
  resultado: ResultadoCasamento
  escolhaManualId: string | null   // preenchido quando o usuário resolve um ambíguo/não-encontrado
  pular: boolean
}

interface BlocoRevisao {
  chave: string
  data: string
  equipe: string | null
  avisos: string[]
  linhas: LinhaRevisao[]
}

const hoje = () => new Date().toISOString().slice(0, 10)

/** Separa o texto colado em mensagens individuais, mesmo se vieram coladas
 *  uma embaixo da outra sem linha em branco entre elas. */
function separarMensagens(texto: string): string[] {
  const linhas = texto.split('\n')
  const blocos: string[][] = []
  for (const l of linhas) {
    if (ehListaDePresenca(l)) blocos.push([l])
    else if (blocos.length) blocos[blocos.length - 1].push(l)
  }
  return blocos.map((b) => b.join('\n').trim()).filter(Boolean)
}

export function ImportarPresencaWhatsappPanel() {
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const [textoColado, setTextoColado] = useState('')
  const [analisando, setAnalisando] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [blocos, setBlocos] = useState<BlocoRevisao[]>([])
  const [base, setBase] = useState<PessoaBase[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ presencasGravadas: number; rdosCriados: number } | null>(null)

  async function analisar() {
    setErro(null)
    setResultado(null)
    if (!supabase) { setErro('Sem conexão com o banco.'); return }
    const mensagens = separarMensagens(textoColado)
    if (mensagens.length === 0) {
      setErro('Não achei nenhuma mensagem começando com "Lista de Presença" ou "Presença Equipe" no texto colado.')
      return
    }
    setAnalisando(true)
    try {
      const { data: pessoas, error } = await supabase
        .from('pessoas')
        .select('id, nome_completo, apelido')
        .is('deleted_at', null)
      if (error) throw error
      const baseCarregada = (pessoas ?? []) as PessoaBase[]
      setBase(baseCarregada)

      const novosBlocos: BlocoRevisao[] = mensagens.map((texto, i) => {
        const hj = new Date()
        const parse = parseListaPresenca(texto, { dia: hj.getDate(), mes: hj.getMonth() + 1, ano: hj.getFullYear() })
        return {
          chave: `${i}-${parse.data}-${parse.equipe}`,
          data: parse.data ?? hoje(),
          equipe: parse.equipe,
          avisos: parse.avisos,
          linhas: parse.pessoas.map((pessoa) => ({
            pessoa,
            resultado: casarPessoa(pessoa.nome, baseCarregada),
            escolhaManualId: null,
            pular: false,
          })),
        }
      })
      setBlocos(novosBlocos)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao analisar.')
    } finally {
      setAnalisando(false)
    }
  }

  function atualizarEscolha(chaveBloco: string, idxLinha: number, pessoaId: string | null, pular: boolean) {
    setBlocos((prev) => prev.map((b) => {
      if (b.chave !== chaveBloco) return b
      const linhas = [...b.linhas]
      linhas[idxLinha] = { ...linhas[idxLinha], escolhaManualId: pessoaId, pular }
      return { ...b, linhas }
    }))
  }

  function pessoaIdFinal(l: LinhaRevisao): string | null {
    if (l.escolhaManualId) return l.escolhaManualId
    if (l.resultado.status === 'resolvido' || l.resultado.status === 'estimado') return l.resultado.pessoa.id
    return null
  }

  const pendencias = blocos.reduce((n, b) => n + b.linhas.filter((l) =>
    !l.pular && l.resultado.status !== 'resolvido' && l.resultado.status !== 'estimado' && !l.escolhaManualId
  ).length, 0)

  async function gravar() {
    if (!supabase) return
    if (!activeProjectId) { setErro('Selecione uma obra antes de gravar.'); return }
    setGravando(true)
    setErro(null)
    try {
      let presencasGravadas = 0
      let rdosCriados = 0
      for (const bloco of blocos) {
        const linhasParaGravar = bloco.linhas.filter((l) => !l.pular)
        if (linhasParaGravar.length === 0) continue

        // 1 RDO por (obra, data, equipe) — reaproveita se já existir
        const { data: existente, error: eBusca } = await supabase
          .from('rdos')
          .select('id')
          .eq('projeto_id', activeProjectId)
          .eq('data', bloco.data)
          .eq('equipe', bloco.equipe ?? '')
          .is('deleted_at', null)
          .maybeSingle()
        if (eBusca) throw eBusca

        let rdoId = existente?.id as string | undefined
        if (!rdoId) {
          const { data: novo, error: eCria } = await supabase
            .from('rdos')
            .insert({
              projeto_id: activeProjectId,
              data: bloco.data,
              equipe: bloco.equipe,
              origem: 'whatsapp_import',
              payload: {},
            })
            .select('id')
            .single()
          if (eCria) throw eCria
          rdoId = novo.id
          rdosCriados++
        }

        const linhasInsert = linhasParaGravar.map((l) => ({
          rdo_id: rdoId,
          pessoa_id: pessoaIdFinal(l),
          nome_snapshot: l.pessoa.nome,
          equipe_nome_snapshot: bloco.equipe,
          funcao_no_dia: l.pessoa.funcao,
          presente: true,
          origem: 'whatsapp_import',
        }))
        const { error: eInsert } = await supabase.from('rdo_presenca').insert(linhasInsert)
        if (eInsert) throw eInsert
        presencasGravadas += linhasInsert.length
      }
      setResultado({ presencasGravadas, rdosCriados })
      setBlocos([])
      setTextoColado('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gravar.')
    } finally {
      setGravando(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-5">
      <div>
        <h2 className="text-[#f5f5f5] text-lg font-semibold flex items-center gap-2">
          <Upload size={18} className="text-[#f97316]" /> Importar Lista de Presença do WhatsApp
        </h2>
        <p className="text-[#a3a3a3] text-xs mt-1">
          Cole abaixo uma ou várias mensagens de "Lista de Presença" / "Presença Equipe", exatamente como
          chegam no grupo. Pode colar várias de uma vez.
        </p>
      </div>

      <textarea
        value={textoColado}
        onChange={(e) => setTextoColado(e.target.value)}
        placeholder={'LISTA DE PRESENÇA 17/08\nEQUIPE - Mazinho\n\nFelipe Gleison - pedreiro\nMazinho- líder'}
        rows={8}
        className="w-full bg-[#333333] border border-[#525252] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm font-mono focus:outline-none focus:border-[#f97316]"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={analisar}
          disabled={analisando || !textoColado.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] disabled:opacity-40"
        >
          {analisando && <Loader2 size={13} className="animate-spin" />} Analisar
        </button>
        {!activeProjectId && (
          <span className="text-[#f59e0b] text-xs flex items-center gap-1">
            <AlertTriangle size={12} /> Nenhuma obra selecionada — selecione uma antes de gravar.
          </span>
        )}
      </div>

      {erro && (
        <div className="rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 p-3 text-xs text-[#fca5a5]">{erro}</div>
      )}

      {resultado && (
        <div className="rounded-lg border border-[#22c55e]/40 bg-[#22c55e]/10 p-3 text-xs text-[#86efac] flex items-center gap-2">
          <CheckCircle2 size={14} />
          {resultado.presencasGravadas} presenças gravadas em {resultado.rdosCriados} RDO(s) novo(s).
        </div>
      )}

      {blocos.map((bloco) => (
        <div key={bloco.chave} className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#f5f5f5] text-sm font-semibold">
              {bloco.equipe ? `Equipe ${bloco.equipe}` : '(sem equipe — lista solta)'} · {bloco.data}
            </span>
            <span className="text-[#6b6b6b] text-xs">{bloco.linhas.length} pessoas</span>
          </div>
          {bloco.avisos.length > 0 && (
            <ul className="text-[#f59e0b] text-[11px] mb-2 list-disc list-inside">
              {bloco.avisos.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}
          <div className="flex flex-col gap-1.5">
            {bloco.linhas.map((l, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                {l.pular ? (
                  <span className="text-[#6b6b6b] w-4">—</span>
                ) : l.resultado.status === 'resolvido' || l.escolhaManualId ? (
                  <CheckCircle2 size={14} className="text-[#22c55e] shrink-0" />
                ) : l.resultado.status === 'estimado' ? (
                  <span title="Estimado por semelhança — confira">
                    <HelpCircle size={14} className="text-[#38bdf8] shrink-0" />
                  </span>
                ) : l.resultado.status === 'ambiguo' ? (
                  <HelpCircle size={14} className="text-[#f59e0b] shrink-0" />
                ) : (
                  <AlertTriangle size={14} className="text-[#ef4444] shrink-0" />
                )}
                <span className="text-[#f5f5f5] w-40 truncate">{l.pessoa.nome}</span>
                <span className="text-[#6b6b6b] w-32 truncate">{l.pessoa.funcao ?? '—'}</span>
                {l.resultado.status === 'estimado' && !l.escolhaManualId && (
                  <span className="text-[#38bdf8] text-[10px] shrink-0">
                    ≈ {l.resultado.pessoa.nome_completo} ({Math.round(l.resultado.confianca * 100)}%)
                  </span>
                )}

                {(l.resultado.status === 'ambiguo' || l.resultado.status === 'nao_encontrado' || l.resultado.status === 'estimado') && !l.pular && (
                  <select
                    value={l.escolhaManualId ?? (l.resultado.status === 'estimado' ? l.resultado.pessoa.id : '')}
                    onChange={(e) => atualizarEscolha(bloco.chave, idx, e.target.value || null, false)}
                    className="bg-[#333333] border border-[#525252] rounded px-2 py-1 text-[#f5f5f5] text-xs flex-1"
                  >
                    {l.resultado.status !== 'estimado' && (
                      <option value="">
                        {l.resultado.status === 'ambiguo' ? '— escolher qual —' : '— buscar pessoa —'}
                      </option>
                    )}
                    {(l.resultado.status === 'ambiguo' ? l.resultado.candidatos : base).map((p) => (
                      <option key={p.id} value={p.id}>{p.nome_completo}{p.apelido ? ` (${p.apelido})` : ''}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => atualizarEscolha(bloco.chave, idx, null, !l.pular)}
                  className="text-[10px] text-[#6b6b6b] hover:text-[#f5f5f5] shrink-0"
                >
                  {l.pular ? 'incluir' : 'pular'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {blocos.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={gravar}
            disabled={gravando || pendencias > 0 || !activeProjectId}
            title={pendencias > 0 ? `Ainda faltam ${pendencias} pessoas para resolver ou pular` : undefined}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#f97316] text-[#ffffff] hover:bg-[#ea580c] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {gravando && <Loader2 size={13} className="animate-spin" />} Gravar presença
          </button>
          {pendencias > 0 && (
            <span className="text-[#f59e0b] text-xs">{pendencias} pessoas ainda sem resolver ou pular</span>
          )}
        </div>
      )}
    </div>
  )
}

export default ImportarPresencaWhatsappPanel
