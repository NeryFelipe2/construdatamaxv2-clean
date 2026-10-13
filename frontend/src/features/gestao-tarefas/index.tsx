/**
 * TAREFAS DA GESTÃO — quadro das tarefas das listas de WhatsApp, por pessoa e prazo.
 * Dois visuais escolhidos pelo Felipe nos design systems:
 *   PAINEL  = dashboard escuro, teal (Masterclass / Cadence)
 *   MISSÃO  = painel de controle bronze, mono (IX-7)
 * Os dados estão em dados.ts. A marcação "feita" fica só neste navegador (localStorage).
 */
import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, LayoutDashboard, Rocket } from 'lucide-react'
import { RESPONSAVEIS, TAREFAS, type Tarefa } from './dados'

type Visual = 'painel' | 'missao'
type Situacao = 'atrasada' | 'hoje' | 'aberta' | 'feita'

const CHAVE_FEITAS = 'gestao-tarefas:feitas'
const CHAVE_VISUAL = 'gestao-tarefas:visual'

function ler<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave)
    return v ? (JSON.parse(v) as T) : padrao
  } catch {
    return padrao
  }
}
function gravar(chave: string, valor: unknown) {
  try { localStorage.setItem(chave, JSON.stringify(valor)) } catch { /* sem armazenamento: segue sem salvar */ }
}

function hojeISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function br(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}
function dias(de: string, ate: string): number {
  return Math.round((Date.parse(ate + 'T00:00:00') - Date.parse(de + 'T00:00:00')) / 86400000)
}

function situacao(t: Tarefa, feitas: Set<string>, hoje: string): Situacao {
  if (feitas.has(t.id)) return 'feita'
  if (t.prazo && t.prazo < hoje) return 'atrasada'
  if (t.prazo === hoje) return 'hoje'
  return 'aberta'
}

const ROTULO: Record<Situacao, string> = { atrasada: 'Atrasada', hoje: 'Vence hoje', aberta: 'Aberta', feita: 'Feita' }
const ORDEM: Record<Situacao, number> = { atrasada: 0, hoje: 1, aberta: 2, feita: 3 }

export function GestaoTarefasPage() {
  const hoje = hojeISO()
  const [visual, setVisual] = useState<Visual>(() => ler<Visual>(CHAVE_VISUAL, 'painel'))
  const [feitas, setFeitas] = useState<Set<string>>(() => new Set(ler<string[]>(CHAVE_FEITAS, [])))
  const [pessoa, setPessoa] = useState<string>('Todos')

  useEffect(() => gravar(CHAVE_VISUAL, visual), [visual])
  useEffect(() => gravar(CHAVE_FEITAS, [...feitas]), [feitas])

  const alternar = (id: string) =>
    setFeitas((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })

  const linhas = useMemo(
    () => TAREFAS.map((t) => ({ t, s: situacao(t, feitas, hoje) }))
      .filter(({ t }) => pessoa === 'Todos' || t.responsavel === pessoa)
      .sort((a, b) => ORDEM[a.s] - ORDEM[b.s] || a.t.desde.localeCompare(b.t.desde)),
    [feitas, hoje, pessoa],
  )

  const total = TAREFAS.length
  const nFeitas = TAREFAS.filter((t) => feitas.has(t.id)).length
  const nAbertas = total - nFeitas
  const nHoje = TAREFAS.filter((t) => situacao(t, feitas, hoje) === 'hoje').length
  const nAtrasadas = TAREFAS.filter((t) => situacao(t, feitas, hoje) === 'atrasada').length
  const nVelhas = TAREFAS.filter((t) => !feitas.has(t.id) && dias(t.desde, hoje) >= 7).length
  const porPessoa = RESPONSAVEIS.map((r) => ({
    r,
    abertas: TAREFAS.filter((t) => t.responsavel === r && !feitas.has(t.id)).length,
    total: TAREFAS.filter((t) => t.responsavel === r).length,
  }))
  const maxAbertas = Math.max(1, ...porPessoa.map((p) => p.abertas))
  const pctFeitas = total ? Math.round((nFeitas / total) * 100) : 0

  return (
    <div className={`gt gt--${visual}`}>
      <style>{CSS}</style>

      <header className="gt-top">
        <div>
          <div className="gt-eyebrow">{visual === 'missao' ? 'GESTÃO · TAREFAS · ' + br(hoje) : 'Gestão'}</div>
          <h1 className="gt-title">
            {visual === 'missao' ? 'Tarefas da gestão' : <>Tarefas da <span className="gt-accent">gestão</span></>}
          </h1>
        </div>
        <div className="gt-switch" role="tablist" aria-label="Visual">
          <button role="tab" aria-selected={visual === 'painel'} onClick={() => setVisual('painel')}>
            <LayoutDashboard size={14} /> Painel
          </button>
          <button role="tab" aria-selected={visual === 'missao'} onClick={() => setVisual('missao')}>
            <Rocket size={14} /> Missão
          </button>
        </div>
      </header>

      <section className="gt-kpis">
        <Kpi rotulo="Abertas" valor={String(nAbertas)} sub={`de ${total} tarefas`} />
        <Kpi rotulo="Vencem hoje" valor={String(nHoje)} sub={nHoje ? 'ver Ícaro / Joaquim' : 'nenhuma'} alerta={nHoje > 0} />
        <Kpi rotulo="Atrasadas" valor={String(nAtrasadas)} sub="com prazo vencido" alerta={nAtrasadas > 0} />
        <Kpi rotulo="Abertas há 7 dias ou mais" valor={String(nVelhas)} sub="as mais antigas são de 02/10" alerta={nVelhas > 0} />
      </section>

      <section className="gt-grid">
        <div className="gt-card">
          <div className="gt-card-h">Abertas por pessoa</div>
          <div className="gt-bars">
            {porPessoa.map(({ r, abertas, total: tt }) => (
              <button key={r} className={'gt-bar' + (pessoa === r ? ' is-on' : '')} onClick={() => setPessoa(pessoa === r ? 'Todos' : r)}>
                <span className="gt-bar-n">{r}</span>
                <span className="gt-bar-t"><i style={{ width: `${(abertas / maxAbertas) * 100}%` }} /></span>
                <span className="gt-bar-v">{abertas}/{tt}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="gt-card gt-ring-card">
          <div className="gt-card-h">Feitas</div>
          <div className="gt-ring" style={{ ['--p' as string]: `${pctFeitas}` }}>
            <b>{pctFeitas}%</b>
            <small>{nFeitas} de {total}</small>
          </div>
        </div>
      </section>

      <section className="gt-card">
        <div className="gt-card-h gt-card-h--row">
          <span><ClipboardList size={14} /> Lista {pessoa !== 'Todos' && `· ${pessoa}`}</span>
          <div className="gt-chips">
            {['Todos', ...RESPONSAVEIS].map((r) => (
              <button key={r} className={pessoa === r ? 'is-on' : ''} onClick={() => setPessoa(r)}>{r}</button>
            ))}
          </div>
        </div>
        <ul className="gt-list">
          {linhas.map(({ t, s }) => (
            <li key={t.id} className={`gt-row gt-row--${s}`}>
              <button className="gt-check" aria-label={s === 'feita' ? 'Reabrir' : 'Marcar como feita'} onClick={() => alternar(t.id)}>
                {s === 'feita' ? '✓' : ''}
              </button>
              <div className="gt-row-main">
                <div className="gt-row-t">{t.tarefa}</div>
                <div className="gt-row-m">
                  <span>{t.responsavel}</span>
                  <span>{t.frente}</span>
                  <span>desde {br(t.desde)}</span>
                  {t.prazo && <span>prazo {br(t.prazo)}</span>}
                  {t.nota && <span className="gt-nota">{t.nota}</span>}
                </div>
              </div>
              <span className={`gt-tag gt-tag--${s}`}>{ROTULO[s]}</span>
            </li>
          ))}
          {linhas.length === 0 && <li className="gt-vazio">Nenhuma tarefa para este filtro.</li>}
        </ul>
        <p className="gt-rodape">
          Fonte: listas de WhatsApp de 02/10, 08/10 e 12-13/10/2026. A marcação "feita" fica só neste navegador.
        </p>
      </section>
    </div>
  )
}

function Kpi({ rotulo, valor, sub, alerta }: { rotulo: string; valor: string; sub: string; alerta?: boolean }) {
  return (
    <div className={'gt-card gt-kpi' + (alerta ? ' is-alerta' : '')}>
      <div className="gt-kpi-l">{rotulo}</div>
      <div className="gt-kpi-v">{valor}</div>
      <div className="gt-kpi-s">{sub}</div>
    </div>
  )
}

const CSS = `
@font-face{font-family:"GT Rajdhani";src:url("/fonts/rajdhani-500.woff2") format("woff2");font-weight:500;font-display:swap}
@font-face{font-family:"GT Plex Mono";src:url("/fonts/ibm-plex-mono-400.woff2") format("woff2");font-weight:400;font-display:swap}

.gt{--bg:#060610;--bg1:#0a0a18;--bg2:#0d0d1f;--ac:#14b8a6;--ac2:#2dd4bf;--tx:#e8e8ed;--hd:#fafafa;--mu:rgba(255,255,255,.45);
  --glass:rgba(255,255,255,.03);--bs:rgba(20,184,166,.12);--bm:rgba(20,184,166,.22);--warn:#f59e0b;--bad:#f87171;
  --fh:'Outfit','Inter',system-ui,sans-serif;--fb:'Inter',system-ui,sans-serif;--r:14px;--ut:none;--ls:0;
  min-height:100%;padding:28px;background:var(--bg);color:var(--tx);font-family:var(--fb);font-weight:300;font-size:.9rem;line-height:1.55}
.gt *{box-sizing:border-box}
.gt button{font:inherit;color:inherit;cursor:pointer;background:none;border:0}

.gt--missao{--bg:#151410;--bg1:#1b1a15;--bg2:#211f19;--ac:#d8cfc2;--ac2:#efe7da;--tx:#d8cfc2;--hd:#efe7da;--mu:rgba(224,216,205,.58);
  --glass:rgba(225,216,203,.04);--bs:rgba(225,216,203,.16);--bm:rgba(225,216,203,.28);--warn:#e0a458;--bad:#d9795f;
  --fh:'GT Rajdhani','Arial Narrow',sans-serif;--fb:'GT Plex Mono',ui-monospace,Consolas,monospace;--r:2px;--ut:uppercase;--ls:.08em;
  background:radial-gradient(120% 80% at 80% 0%,#2a2820 0%,#151410 60%);font-size:.78rem}

.gt-top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.gt-eyebrow{color:var(--mu);font-size:.7rem;text-transform:var(--ut);letter-spacing:var(--ls)}
.gt-title{font-family:var(--fh);color:var(--hd);font-weight:500;font-size:2rem;line-height:1.1;margin:2px 0 0;text-transform:var(--ut);letter-spacing:var(--ls)}
.gt-accent{color:var(--ac)}
.gt-switch{display:flex;gap:4px;padding:4px;border:1px solid var(--bs);border-radius:calc(var(--r) + 4px);background:var(--glass)}
.gt-switch button{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:var(--r);color:var(--mu);text-transform:var(--ut);letter-spacing:var(--ls);font-size:.75rem}
.gt-switch button[aria-selected=true]{background:var(--ac);color:#04110f}
.gt--missao .gt-switch button[aria-selected=true]{background:var(--ac);color:#151410}

.gt-card{background:var(--bg1);border:1px solid var(--bs);border-radius:var(--r);padding:16px 18px;position:relative}
.gt--painel .gt-card{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015));box-shadow:0 0 40px rgba(20,184,166,.05)}
.gt--missao .gt-card::before,.gt--missao .gt-card::after{content:"";position:absolute;width:8px;height:8px;border:1px solid var(--bm)}
.gt--missao .gt-card::before{top:-1px;left:-1px;border-right:0;border-bottom:0}
.gt--missao .gt-card::after{bottom:-1px;right:-1px;border-left:0;border-top:0}
.gt-card-h{color:var(--mu);font-size:.72rem;text-transform:var(--ut);letter-spacing:var(--ls);margin-bottom:12px;display:flex;align-items:center;gap:6px}
.gt-card-h--row{justify-content:space-between;flex-wrap:wrap;gap:10px}

.gt-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:14px}
.gt-kpi-l{color:var(--mu);font-size:.7rem;text-transform:var(--ut);letter-spacing:var(--ls)}
.gt-kpi-v{font-family:var(--fh);color:var(--hd);font-size:2.3rem;font-weight:500;line-height:1.1;margin-top:4px}
.gt-kpi-s{color:var(--mu);font-size:.72rem}
.gt-kpi.is-alerta .gt-kpi-v{color:var(--warn)}
.gt-kpi.is-alerta{border-color:color-mix(in srgb,var(--warn) 45%,transparent)}

.gt-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:14px;margin-bottom:14px}
@media(max-width:820px){.gt-grid{grid-template-columns:1fr}.gt{padding:16px}}
.gt-bars{display:grid;gap:8px}
.gt-bar{display:grid;grid-template-columns:78px 1fr 44px;align-items:center;gap:10px;padding:4px 6px;border-radius:var(--r);text-align:left}
.gt-bar.is-on{background:var(--glass);outline:1px solid var(--bm)}
.gt-bar-t{height:8px;border-radius:99px;background:var(--glass);border:1px solid var(--bs);overflow:hidden}
.gt--missao .gt-bar-t{border-radius:0}
.gt-bar-t i{display:block;height:100%;background:var(--ac);transition:width .4s}
.gt--painel .gt-bar-t i{box-shadow:0 0 12px rgba(20,184,166,.5)}
.gt-bar-v{color:var(--mu);text-align:right}
.gt-ring-card{display:flex;flex-direction:column;align-items:center}
.gt-ring{--p:0;width:132px;height:132px;border-radius:50%;display:grid;place-content:center;text-align:center;
  background:conic-gradient(var(--ac) calc(var(--p)*1%),var(--glass) 0);position:relative}
.gt-ring::before{content:"";position:absolute;inset:11px;border-radius:50%;background:var(--bg1)}
.gt-ring b,.gt-ring small{position:relative;z-index:1}
.gt-ring b{font-family:var(--fh);color:var(--hd);font-size:1.7rem;font-weight:500;line-height:1}
.gt-ring small{color:var(--mu);font-size:.68rem}

.gt-chips{display:flex;gap:4px;flex-wrap:wrap}
.gt-chips button{padding:3px 10px;border:1px solid var(--bs);border-radius:99px;color:var(--mu);font-size:.72rem;text-transform:var(--ut);letter-spacing:var(--ls)}
.gt--missao .gt-chips button{border-radius:0}
.gt-chips button.is-on{border-color:var(--ac);color:var(--hd);background:var(--glass)}

.gt-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--bs)}
.gt-row{display:grid;grid-template-columns:26px 1fr auto;gap:12px;align-items:start;padding:12px 2px;border-bottom:1px solid var(--bs)}
.gt-check{width:20px;height:20px;margin-top:2px;border:1px solid var(--bm);border-radius:var(--r);display:grid;place-content:center;color:var(--ac);font-size:.8rem;line-height:1}
.gt-row--feita .gt-row-t{text-decoration:line-through;color:var(--mu)}
.gt-row-t{color:var(--hd)}
.gt-row-m{display:flex;flex-wrap:wrap;gap:4px 14px;color:var(--mu);font-size:.72rem;margin-top:3px}
.gt-nota{color:var(--warn)}
.gt-tag{padding:2px 9px;border:1px solid var(--bs);border-radius:99px;font-size:.68rem;text-transform:var(--ut);letter-spacing:var(--ls);white-space:nowrap;color:var(--mu)}
.gt--missao .gt-tag{border-radius:0}
.gt-tag--hoje,.gt-tag--atrasada{color:#150d02;background:var(--warn);border-color:var(--warn)}
.gt-tag--atrasada{background:var(--bad);border-color:var(--bad)}
.gt-tag--feita{color:var(--ac);border-color:var(--ac)}
.gt-vazio{padding:20px;text-align:center;color:var(--mu)}
.gt-rodape{margin:12px 0 0;color:var(--mu);font-size:.7rem}
`
