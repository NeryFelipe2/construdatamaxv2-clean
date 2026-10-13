/**
 * AuditoriaPage — a trilha de quem fez o quê, em toda a plataforma.
 *
 * O log vem de TRIGGER no Postgres, então cobre tudo: tela, planilha importada,
 * bot do WhatsApp, script Python e alteração feita direto no SQL Editor. Cada
 * origem aparece marcada, para ninguém confundir ação de gente com integração.
 *
 * Só admin global ou owner/admin de organização enxerga (RLS na audit_log).
 */
import { useState } from 'react'
import {
  ShieldCheck, RefreshCw, Search, Filter, Plus, Pencil, Trash2,
  AlertTriangle, User, Bot, ChevronDown, ChevronRight, Download,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  useAuditoria, mudancasLegiveis, rotuloTabela,
  type AcaoAudit, type RegistroAudit,
} from '@/hooks/useAuditoria'

const cardCls = 'bg-[#3d3d3d] border border-[#525252] rounded-xl'
const inputCls = 'bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]'
const btnNeutro = 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]'
const thCls = 'text-left text-[#a3a3a3] text-xs font-medium px-4 py-2 whitespace-nowrap'
const trCls = 'border-b border-[#525252]/50'

const META_ACAO: Record<AcaoAudit, { rotulo: string; cor: string; icone: typeof Plus }> = {
  INSERT: { rotulo: 'Criou',    cor: 'bg-green-500/15 text-green-300', icone: Plus },
  UPDATE: { rotulo: 'Alterou',  cor: 'bg-amber-500/15 text-amber-200', icone: Pencil },
  DELETE: { rotulo: 'Excluiu',  cor: 'bg-red-500/15 text-red-300',     icone: Trash2 },
}

const quando = (iso: string) => {
  const d = new Date(iso)
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  if (min < 1440) return `há ${Math.floor(min / 60)} h`
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Valor de campo em texto curto, tolerando null, número e objeto. */
function txt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  const s = String(v)
  return s.length > 60 ? s.slice(0, 60) + '…' : s
}

function LinhaRegistro({ r }: { r: RegistroAudit }) {
  const [aberto, setAberto] = useState(false)
  const M = META_ACAO[r.acao]
  const Icone = M.icone
  const mudancas = mudancasLegiveis(r)
  const ehIntegracao = r.origem === 'integracao'
  const podeAbrir = mudancas.length > 0 || r.acao !== 'UPDATE'

  return (
    <>
      <tr className={`${trCls} hover:bg-[#484848]/40 ${podeAbrir ? 'cursor-pointer' : ''}`}
        onClick={() => podeAbrir && setAberto((a) => !a)}>
        <td className="px-4 py-2 w-6 text-[#6b6b6b]">
          {podeAbrir && (aberto ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
        </td>
        <td className="px-4 py-2 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {ehIntegracao ? <Bot size={12} className="text-[#6b6b6b]" /> : <User size={12} className="text-[#a3a3a3]" />}
            <span className="text-[#f5f5f5] text-sm">{r.usuario_nome ?? '(integração)'}</span>
          </div>
          {ehIntegracao && <div className="text-[10px] text-[#6b6b6b] ml-[18px]">via integração</div>}
        </td>
        <td className="px-4 py-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${M.cor}`}>
            <Icone size={10} /> {M.rotulo}
          </span>
        </td>
        <td className="px-4 py-2 text-sm text-[#f5f5f5]">{rotuloTabela(r.tabela)}</td>
        <td className="px-4 py-2 text-xs text-[#a3a3a3]">
          {r.acao === 'UPDATE' && mudancas.length > 0
            ? mudancas.map((m) => m.campo).join(', ')
            : r.acao === 'INSERT' ? 'registro novo'
            : r.acao === 'DELETE' ? 'registro removido' : '—'}
        </td>
        <td className="px-4 py-2 text-xs text-[#6b6b6b] whitespace-nowrap">{quando(r.criado_em)}</td>
      </tr>
      {aberto && (
        <tr className="bg-[#2c2c2c]">
          <td colSpan={6} className="px-10 py-3">
            {mudancas.length > 0 ? (
              <table className="text-xs">
                <tbody>
                  {mudancas.map((m, i) => (
                    <tr key={i}>
                      <td className="pr-4 py-0.5 text-[#6b6b6b] align-top whitespace-nowrap">{m.campo}</td>
                      <td className="pr-2 py-0.5 text-[#6b6b6b] line-through">{txt(m.antes)}</td>
                      <td className="pr-2 py-0.5 text-[#6b6b6b]">→</td>
                      <td className="py-0.5 text-amber-200">{txt(m.depois)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <pre className="text-[11px] text-[#a3a3a3] whitespace-pre-wrap max-h-52 overflow-y-auto">
                {JSON.stringify(r.acao === 'DELETE' ? r.dados_antes : r.dados_depois, null, 1)}
              </pre>
            )}
            <div className="mt-2 text-[10px] text-[#6b6b6b]">
              {new Date(r.criado_em).toLocaleString('pt-BR')}
              {r.ip && ` · IP ${r.ip}`}
              {r.registro_id && ` · registro ${r.registro_id.slice(0, 8)}`}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function AuditoriaPage() {
  const a = useAuditoria()
  const [busca, setBusca] = useState('')

  const filtrados = a.registros.filter((r) => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return (
      (r.usuario_nome ?? '').toLowerCase().includes(q) ||
      rotuloTabela(r.tabela).toLowerCase().includes(q) ||
      JSON.stringify(r.dados_depois ?? r.dados_antes ?? {}).toLowerCase().includes(q)
    )
  })

  function exportar() {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Quando', 'Usuário', 'Origem', 'Ação', 'Módulo', 'O que mudou', 'Registro'],
      ...filtrados.map((r) => [
        new Date(r.criado_em).toLocaleString('pt-BR'),
        r.usuario_nome ?? '(integração)', r.origem ?? '', META_ACAO[r.acao].rotulo,
        rotuloTabela(r.tabela),
        mudancasLegiveis(r).map((m) => `${m.campo}: ${txt(m.antes)} → ${txt(m.depois)}`).join(' | '),
        r.registro_id ?? '',
      ]),
    ]), 'Auditoria')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Usuário', 'Total', 'Criou', 'Alterou', 'Excluiu'],
      ...a.porUsuario.map((u) => [u.nome, u.total, u.inserts, u.updates, u.deletes]),
    ]), 'Por usuário')
    XLSX.writeFile(wb, `AUDITORIA_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="flex flex-col h-full bg-[#2c2c2c]">
      <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
        <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
              <ShieldCheck size={20} className="text-[#ffffff]" />
            </div>
            <div>
              <h1 className="text-[#f5f5f5] font-semibold text-lg leading-tight">Auditoria</h1>
              <p className="text-[#a3a3a3] text-xs">
                Quem fez o quê, em toda a plataforma · gravado no banco, pega até integração e script
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className={btnNeutro} onClick={exportar} disabled={filtrados.length === 0}>
              <Download size={14} /> Exportar
            </button>
            <button className={btnNeutro} onClick={() => void a.recarregar()} disabled={a.loading}>
              <RefreshCw size={14} className={a.loading ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>
        </div>

        {a.porUsuario.length > 0 && (
          <div className="px-6 pb-4 flex gap-3 overflow-x-auto">
            {a.porUsuario.slice(0, 6).map((u) => (
              <button key={u.nome} onClick={() => a.setFiltro({ ...a.filtro, usuario: a.filtro.usuario === u.nome ? undefined : u.nome })}
                className={`text-left bg-[#3d3d3d] border rounded-xl p-3 min-w-[160px] transition-colors
                  ${a.filtro.usuario === u.nome ? 'border-[#f97316]' : 'border-[#525252] hover:border-[#6b6b6b]'}`}>
                <div className="text-[11px] text-[#f5f5f5] truncate">{u.nome}</div>
                <div className="font-mono text-lg text-[#f5f5f5]">{u.total}</div>
                <div className="text-[10px] text-[#6b6b6b]">
                  <span className="text-green-300">{u.inserts}</span> criou ·{' '}
                  <span className="text-amber-200">{u.updates}</span> alterou ·{' '}
                  <span className="text-red-300">{u.deletes}</span> excluiu
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
        {a.tabelaAusente && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">A auditoria ainda não está disponível.</p>
              <p className="text-amber-200/80 mt-1">A tabela audit_log não existe no banco — a migration 025 ainda não foi aplicada.</p>
            </div>
          </div>
        )}

        {!a.tabelaAusente && a.semPermissao && !a.loading && (
          <div className={`${cardCls} p-8 text-center`}>
            <ShieldCheck size={28} className="mx-auto text-[#6b6b6b] mb-2" />
            <p className="text-sm text-[#f5f5f5]">Nenhum registro visível para você.</p>
            <p className="text-xs text-[#a3a3a3] mt-1">
              A auditoria é restrita a administradores. Se você deveria ver, fale com um admin global.
            </p>
          </div>
        )}

        {!a.tabelaAusente && !a.semPermissao && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por usuário, módulo ou conteúdo…" className={`${inputCls} pl-9 w-80`} />
              </div>
              <select value={a.filtro.usuario ?? ''} className={inputCls}
                onChange={(e) => a.setFiltro({ ...a.filtro, usuario: e.target.value || undefined })}>
                <option value="">Todos os usuários</option>
                {a.usuarios.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <select value={a.filtro.tabela ?? ''} className={inputCls}
                onChange={(e) => a.setFiltro({ ...a.filtro, tabela: e.target.value || undefined })}>
                <option value="">Todos os módulos</option>
                {a.tabelas.map((t) => <option key={t} value={t}>{rotuloTabela(t)}</option>)}
              </select>
              <select value={a.filtro.acao ?? ''} className={inputCls}
                onChange={(e) => a.setFiltro({ ...a.filtro, acao: (e.target.value || '') as AcaoAudit | '' })}>
                <option value="">Toda ação</option>
                <option value="INSERT">Criou</option>
                <option value="UPDATE">Alterou</option>
                <option value="DELETE">Excluiu</option>
              </select>
              <input type="date" value={a.filtro.desde ?? ''} className={inputCls}
                onChange={(e) => a.setFiltro({ ...a.filtro, desde: e.target.value || undefined })} />
              <input type="date" value={a.filtro.ate ?? ''} className={inputCls}
                onChange={(e) => a.setFiltro({ ...a.filtro, ate: e.target.value || undefined })} />
              {(a.filtro.usuario || a.filtro.tabela || a.filtro.acao || a.filtro.desde || a.filtro.ate || busca) && (
                <button className={btnNeutro} onClick={() => { a.setFiltro({}); setBusca('') }}>
                  <Filter size={14} /> Limpar
                </button>
              )}
              <span className="ml-auto text-xs text-[#6b6b6b]">{filtrados.length} registro(s)</span>
            </div>

            <div className={`${cardCls} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={trCls}>
                      <th className="px-4 py-2 w-6"></th>
                      <th className={thCls}>Quem</th>
                      <th className={thCls}>Ação</th>
                      <th className={thCls}>Módulo</th>
                      <th className={thCls}>O que mudou</th>
                      <th className={thCls}>Quando</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.loading && filtrados.length === 0 ? (
                      <tr><td colSpan={6} className="text-[#6b6b6b] text-sm text-center py-8">Carregando…</td></tr>
                    ) : filtrados.length === 0 ? (
                      <tr><td colSpan={6} className="text-[#6b6b6b] text-sm text-center py-8">
                        Nenhum registro com esse filtro.
                      </td></tr>
                    ) : filtrados.map((r) => <LinhaRegistro key={r.id} r={r} />)}
                  </tbody>
                </table>
              </div>
              {a.temMais && (
                <div className="border-t border-[#525252] p-3 text-center">
                  <button className={btnNeutro} onClick={a.carregarMais}>Carregar mais</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AuditoriaPage
