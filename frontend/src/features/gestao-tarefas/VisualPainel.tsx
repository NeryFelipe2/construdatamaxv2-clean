/**
 * Visual PAINEL: o dashboard escuro do Masterclass (Cadence).
 * Grão, brilho teal, título em degradê, KPIs com sparkline, gráfico de área,
 * rosca por frente, barras com shimmer por pessoa e feed de sinais.
 */
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Inbox, Radio } from 'lucide-react'
import { RESPONSAVEIS, ROTULO, br, dias, type Modelo } from './modelo'
import { Seletor } from './Seletor'

const CORES_FRENTE = ['#14B8A6', '#2DD4BF', '#5EEAD4', '#0D9488', '#99F6E4', '#115E59', '#F59E0B', '#64748B']

export function VisualPainel({ m }: { m: Modelo }) {
  const urgentes = m.todas.filter((l) => l.s === 'hoje' || l.s === 'atrasada' || (l.s === 'aberta' && l.idade >= 7))
  return (
    <div className="pn">
      <div className="pn-aura" />
      <header className="pn-top">
        <div>
          <h1>Tarefas da <span className="pn-grad">Gestão</span></h1>
          <span className="pn-upd">Atualizado hoje, {br(m.hoje)} · listas de 02/10, 08/10 e 13/10</span>
        </div>
        <div className="pn-top-r">
          <div className="pn-period">
            {['Todos', ...RESPONSAVEIS].map((r) => (
              <button key={r} className={m.pessoa === r ? 'on' : ''} onClick={() => m.setPessoa(r)}>{r}</button>
            ))}
          </div>
          <Seletor m={m} />
        </div>
      </header>

      <div className="pn-dash">
        <section className="pn-g4">
          <Kpi i={0} icone={<Inbox size={14} />} rotulo="Abertas" valor={m.nAbertas} delta={`${m.total} no total`} tom="pos" serie={m.serie.map((p) => p.entraram)} />
          <Kpi i={1} icone={<CalendarClock size={14} />} rotulo="Vencem hoje" valor={m.nHoje} delta={m.nHoje ? 'Joaquim: última data' : 'nenhuma'} tom={m.nHoje ? 'neg' : 'pos'} serie={m.serie.map((p) => m.todas.filter((l) => l.s !== 'feita' && l.t.prazo === p.d).length)} />
          <Kpi i={2} icone={<AlertTriangle size={14} />} rotulo="Atrasadas" valor={m.nAtrasadas} delta="prazo vencido" tom={m.nAtrasadas ? 'crit' : 'pos'} serie={m.serie.map((p) => m.todas.filter((l) => l.s !== 'feita' && !!l.t.prazo && l.t.prazo < p.d).length)} />
          <Kpi i={3} icone={<Clock3 size={14} />} rotulo="Abertas há 7+ dias" valor={m.nVelhas} delta={m.maisAntiga ? `desde ${br(m.maisAntiga, false)}` : '—'} tom={m.nVelhas ? 'neg' : 'pos'} serie={m.serie.map((p) => m.todas.filter((l) => l.s !== 'feita' && l.t.desde <= p.d && dias(l.t.desde, p.d) >= 7).length)} />
        </section>

        <section className="pn-g21">
          <div className="pn-card" style={{ ['--i' as string]: 4 }}>
            <div className="pn-ch">
              <span className="pn-ct">Entrada de tarefas</span>
              <div className="pn-leg"><span><i style={{ background: '#14B8A6' }} />Acumulado</span><span><i style={{ background: '#F59E0B' }} />Abertas hoje</span></div>
            </div>
            <AreaChart m={m} />
          </div>
          <div className="pn-card" style={{ ['--i' as string]: 5 }}>
            <div className="pn-ch"><span className="pn-ct">Distribuição por frente</span></div>
            <Donut m={m} />
          </div>
        </section>

        <section className="pn-g11">
          <div className="pn-card" style={{ ['--i' as string]: 6 }}>
            <div className="pn-ch"><span className="pn-ct">Carga por pessoa</span><span className="pn-mini">abertas / total</span></div>
            <div className="pn-funnel">
              {m.porPessoa.map((p) => {
                const max = Math.max(...m.porPessoa.map((x) => x.total))
                return (
                  <button key={p.r} className={'pn-frow' + (m.pessoa === p.r ? ' on' : '')} onClick={() => m.setPessoa(m.pessoa === p.r ? 'Todos' : p.r)}>
                    <span className="pn-fl">{p.r}</span>
                    <span className="pn-fw"><span className="pn-fb" style={{ width: `${(p.abertas / max) * 100}%` }} /></span>
                    <span className="pn-fv">{p.abertas}<small>/{p.total}</small></span>
                    {p.urgentes > 0 && <span className="pn-fc">{p.urgentes} com prazo hoje</span>}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="pn-card" style={{ ['--i' as string]: 7 }}>
            <div className="pn-ch">
              <span className="pn-ct">Sinais de atenção</span>
              <span className="pn-live"><span className="pn-dot" />ao vivo</span>
            </div>
            <div className="pn-sig">
              {urgentes.map(({ t, s, idade }) => (
                <div key={t.id} className={'pn-si ' + s}>
                  <span className={'pn-sic ' + s}>{s === 'aberta' ? <Clock3 size={13} /> : <AlertTriangle size={13} />}</span>
                  <div className="pn-sit">
                    <b>{t.tarefa}</b>
                    <span>{t.responsavel} · {s === 'aberta' ? `aberta há ${idade} dias` : ROTULO[s]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pn-card" style={{ ['--i' as string]: 8 }}>
          <div className="pn-ch">
            <span className="pn-ct">Todas as tarefas {m.pessoa !== 'Todos' && <em>· {m.pessoa}</em>}</span>
            <span className="pn-mini">{m.linhas.length} itens · clique no círculo para marcar feita</span>
          </div>
          <table className="pn-tab">
            <thead><tr><th /><th>Tarefa</th><th>Responsável</th><th>Frente</th><th>Desde</th><th>Prazo</th><th>Situação</th></tr></thead>
            <tbody>
              {m.linhas.map(({ t, s }) => (
                <tr key={t.id} className={s}>
                  <td><button className={'pn-ck ' + s} onClick={() => m.alternar(t.id)} aria-label="Marcar">{s === 'feita' && <CheckCircle2 size={16} />}</button></td>
                  <td className="pn-tt">{t.tarefa}{t.nota && <small>{t.nota}</small>}</td>
                  <td>{t.responsavel}</td>
                  <td>{t.frente}</td>
                  <td>{br(t.desde, false)}</td>
                  <td>{t.prazo ? br(t.prazo, false) : '—'}</td>
                  <td><span className={'pn-pill ' + s}>{ROTULO[s]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <p className="pn-foot"><Radio size={12} /> Fonte: listas de WhatsApp de 02/10, 08/10 e 12-13/10/2026. A marcação "feita" fica só neste navegador.</p>
      </div>
    </div>
  )
}

function Kpi({ i, icone, rotulo, valor, delta, tom, serie }: {
  i: number; icone: React.ReactNode; rotulo: string; valor: number; delta: string; tom: 'pos' | 'neg' | 'crit'; serie: number[]
}) {
  const max = Math.max(1, ...serie)
  const pts = serie.map((v, k) => `${(k / Math.max(1, serie.length - 1)) * 100},${38 - (v / max) * 30}`).join(' ')
  const cor = tom === 'crit' ? '#EF4444' : tom === 'neg' ? '#F59E0B' : '#14B8A6'
  return (
    <div className="pn-card pn-kpi" style={{ ['--i' as string]: i }}>
      <div className="pn-kl">{icone}{rotulo}</div>
      <div className="pn-kv">{valor}</div>
      <div className={'pn-kd ' + tom}>{delta}</div>
      <svg className="pn-spark" viewBox="0 0 100 40" preserveAspectRatio="none">
        <defs><linearGradient id={`sp${i}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={cor} stopOpacity=".5" /><stop offset="1" stopColor={cor} stopOpacity="0" /></linearGradient></defs>
        <polygon points={`0,40 ${pts} 100,40`} fill={`url(#sp${i})`} />
        <polyline points={pts} fill="none" stroke={cor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

function AreaChart({ m }: { m: Modelo }) {
  const W = 640, H = 220, pad = 28
  const max = Math.max(...m.serie.map((p) => p.entraram)) + 2
  const x = (k: number) => pad + (k / Math.max(1, m.serie.length - 1)) * (W - pad * 2)
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2)
  const linha = m.serie.map((p, k) => `${k ? 'L' : 'M'}${x(k)},${y(p.entraram)}`).join(' ')
  const area = `${linha} L${x(m.serie.length - 1)},${H - pad} L${x(0)},${H - pad} Z`
  const ult = m.serie.length - 1
  return (
    <div className="pn-area">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="pnA" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#14B8A6" stopOpacity=".35" /><stop offset="1" stopColor="#14B8A6" stopOpacity="0" /></linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={y(max * f)} y2={y(max * f)} stroke="rgba(255,255,255,.05)" strokeDasharray="3 5" />
        ))}
        <path d={area} fill="url(#pnA)" />
        <path d={linha} fill="none" stroke="#2DD4BF" strokeWidth="2" className="pn-draw" />
        <line x1={x(ult)} x2={x(ult)} y1={y(m.nAbertas)} y2={H - pad} stroke="#F59E0B" strokeDasharray="2 3" />
        <circle cx={x(ult)} cy={y(m.nAbertas)} r="4" fill="#F59E0B" />
        <circle cx={x(ult)} cy={y(m.nAbertas)} r="4" fill="#F59E0B" className="pn-pulse" />
        {m.serie.map((p, k) => (k === 0 || k === ult || p.entraram !== m.serie[k - 1].entraram) && (
          <text key={p.d} x={x(k)} y={H - 8} textAnchor="middle" className="pn-ax">{br(p.d, false)}</text>
        ))}
        {m.serie.map((p, k) => (k > 0 && p.entraram !== m.serie[k - 1].entraram) && (
          <text key={'v' + p.d} x={x(k)} y={y(p.entraram) - 10} textAnchor="middle" className="pn-av">{p.entraram}</text>
        ))}
      </svg>
    </div>
  )
}

function Donut({ m }: { m: Modelo }) {
  const r = 62, c = 2 * Math.PI * r
  const tot = m.porFrente.reduce((a, f) => a + f.total, 0)
  let acc = 0
  const top = m.porFrente[0]
  return (
    <div className="pn-donut">
      <svg viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,.04)" strokeWidth="16" />
        {m.porFrente.map((f, k) => {
          const len = (f.total / tot) * c
          const el = (
            <circle key={f.f} cx="90" cy="90" r={r} fill="none" stroke={CORES_FRENTE[k % CORES_FRENTE.length]} strokeWidth="16"
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} transform="rotate(-90 90 90)" className="pn-seg" />
          )
          acc += len
          return el
        })}
        <text x="90" y="84" textAnchor="middle" className="pn-dl">{top.f}</text>
        <text x="90" y="108" textAnchor="middle" className="pn-dv">{Math.round((top.total / tot) * 100)}%</text>
      </svg>
      <div className="pn-dleg">
        {m.porFrente.map((f, k) => (
          <span key={f.f}><i style={{ background: CORES_FRENTE[k % CORES_FRENTE.length] }} />{f.f} <b>{f.total}</b></span>
        ))}
      </div>
    </div>
  )
}
