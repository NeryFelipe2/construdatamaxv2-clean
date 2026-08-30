/**
 * SeloAutoria — "Criado por X em · Última alteração por Y em", com um botão
 * que abre o Histórico completo daquele registro.
 *
 * Serve para qualquer módulo: recebe a tabela e o id, e lê o audit_log.
 * O nome vem do próprio log (usuario_nome), não de um join — assim o histórico
 * continua legível mesmo depois de a pessoa sair da empresa.
 */
import { useState } from 'react'
import { History, X, Plus, Pencil, Trash2, User, Bot } from 'lucide-react'
import { useHistoricoRegistro, mudancasLegiveis, rotuloTabela, type AcaoAudit } from '@/hooks/useAuditoria'

const META: Record<AcaoAudit, { rotulo: string; cor: string; icone: typeof Plus }> = {
  INSERT: { rotulo: 'criou', cor: 'text-green-300', icone: Plus },
  UPDATE: { rotulo: 'alterou', cor: 'text-amber-200', icone: Pencil },
  DELETE: { rotulo: 'excluiu', cor: 'text-red-300', icone: Trash2 },
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

function txt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  const s = String(v)
  return s.length > 70 ? s.slice(0, 70) + '…' : s
}

export interface SeloAutoriaProps {
  tabela: string
  registroId: string | null | undefined
  /** dados já carregados do próprio registro, para não esperar o log */
  createdBy?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  compacto?: boolean
}

export function SeloAutoria({ tabela, registroId, createdAt, updatedAt, compacto }: SeloAutoriaProps) {
  const [aberto, setAberto] = useState(false)
  const { registros, loading } = useHistoricoRegistro(aberto ? tabela : null, aberto ? registroId ?? null : null)

  // o log é a fonte do NOME; as datas vêm do próprio registro (mais barato)
  const criacao = registros.find((r) => r.acao === 'INSERT')
  const ultima = registros.find((r) => r.acao === 'UPDATE')

  if (!registroId) return null

  return (
    <>
      <button onClick={() => setAberto(true)}
        title="Ver histórico completo deste registro"
        className={`inline-flex items-center gap-1.5 text-[#6b6b6b] hover:text-[#f97316] transition-colors
          ${compacto ? 'text-[10px]' : 'text-[11px]'}`}>
        <History size={compacto ? 11 : 12} />
        {compacto ? 'histórico' : (
          <span>
            {createdAt && <>Criado em {dataHora(createdAt)}</>}
            {updatedAt && updatedAt !== createdAt && <> · alterado em {dataHora(updatedAt)}</>}
            {!createdAt && !updatedAt && 'Ver histórico'}
          </span>
        )}
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setAberto(false)}>
          <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-3xl shadow-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
              <div className="flex items-center gap-2.5">
                <History size={17} className="text-[#f97316]" />
                <div>
                  <h2 className="text-sm font-semibold text-[#f5f5f5]">Histórico do registro</h2>
                  <p className="text-[11px] text-[#a3a3a3]">{rotuloTabela(tabela)}</p>
                </div>
              </div>
              <button onClick={() => setAberto(false)} className="text-[#a3a3a3] hover:text-[#f5f5f5]">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <p className="text-sm text-[#6b6b6b] text-center py-6">Carregando histórico…</p>
              ) : registros.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-[#f5f5f5]">Sem histórico para este registro.</p>
                  <p className="text-xs text-[#a3a3a3] mt-1">
                    Ou ele é anterior à auditoria, ou você não tem permissão para ver a trilha.
                  </p>
                </div>
              ) : (
                <ol className="relative border-l border-[#525252] ml-2 space-y-4">
                  {registros.map((r) => {
                    const M = META[r.acao]
                    const Icone = M.icone
                    const mud = mudancasLegiveis(r)
                    return (
                      <li key={r.id} className="ml-5">
                        <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-[#3d3d3d] border border-[#525252]">
                          <Icone size={9} className={M.cor} />
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {r.origem === 'integracao'
                            ? <Bot size={11} className="text-[#6b6b6b]" />
                            : <User size={11} className="text-[#a3a3a3]" />}
                          <span className="text-sm text-[#f5f5f5]">{r.usuario_nome ?? '(integração)'}</span>
                          <span className={`text-sm ${M.cor}`}>{M.rotulo}</span>
                          <span className="text-[11px] text-[#6b6b6b]">· {dataHora(r.criado_em)}</span>
                          {r.origem === 'integracao' && (
                            <span className="text-[10px] rounded px-1.5 py-0.5 bg-[#484848] text-[#6b6b6b]">via integração</span>
                          )}
                        </div>
                        {mud.length > 0 && (
                          <table className="mt-1.5 text-xs">
                            <tbody>
                              {mud.map((m, i) => (
                                <tr key={i}>
                                  <td className="pr-3 py-0.5 text-[#6b6b6b] align-top whitespace-nowrap">{m.campo}</td>
                                  <td className="pr-2 py-0.5 text-[#6b6b6b] line-through">{txt(m.antes)}</td>
                                  <td className="pr-2 py-0.5 text-[#6b6b6b]">→</td>
                                  <td className="py-0.5 text-amber-200">{txt(m.depois)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {r.acao === 'DELETE' && (
                          <p className="mt-1 text-[11px] text-[#6b6b6b]">
                            O conteúdo anterior está guardado na auditoria — nada se perdeu.
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>

            {(criacao || ultima) && (
              <div className="px-5 py-3 border-t border-[#525252] text-[11px] text-[#a3a3a3]">
                {criacao && <>Criado por <span className="text-[#f5f5f5]">{criacao.usuario_nome ?? '(integração)'}</span> em {dataHora(criacao.criado_em)}</>}
                {ultima && <> · última alteração por <span className="text-[#f5f5f5]">{ultima.usuario_nome ?? '(integração)'}</span> em {dataHora(ultima.criado_em)}</>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
