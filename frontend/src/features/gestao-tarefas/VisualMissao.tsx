/**
 * Visual MISSÃO: o painel de controle IX-7.
 * Fundo da sonda em Marte com vinheta e linhas de varredura, trilho lateral numerado,
 * painéis translúcidos com cantoneiras, radar das tarefas e telemetria em fonte mono.
 */
import { Crosshair } from 'lucide-react'
import { RESPONSAVEIS, ROTULO, br, dias, type Modelo } from './modelo'
import { Seletor } from './Seletor'

const COD: Record<string, string> = { 'Ícaro': 'IC', 'Sérgio': 'SE', 'Sidnei': 'SI', 'Maiara': 'MA', 'Gabriel': 'GA' }

export function VisualMissao({ m }: { m: Modelo }) {
  const tMais = dias(m.inicio, m.hoje)
  const pessoas = ['Todos', ...RESPONSAVEIS]
  return (
    <div className="ms">
      <div className="ms-atm" />
      <nav className="ms-nav">
        <div className="ms-mark"><span className="ms-mark-i"><Crosshair size={14} /></span>MISSÃO WCR · GESTÃO</div>
        <div className="ms-nav-r">
          <span className="ms-t3">T+{String(tMais).padStart(2, '0')} DIAS DESDE {br(m.inicio, false)}</span>
          <span className="ms-t3">{br(m.hoje)}</span>
          <Seletor m={m} />
        </div>
      </nav>

      <div className="ms-body">
        <aside className="ms-rail">
          {pessoas.map((p, k) => {
            const info = m.porPessoa.find((x) => x.r === p)
            return (
              <button key={p} className={'ms-node' + (m.pessoa === p ? ' on' : '')} onClick={() => m.setPessoa(p)}>
                <span className="ms-node-b">{k === 0 ? '∑' : String(k).padStart(2, '0')}</span>
                <span className="ms-node-l">{p}</span>
                <span className="ms-node-n">{info ? info.abertas : m.nAbertas}</span>
              </button>
            )
          })}
        </aside>

        <main className="ms-main">
          <section className="ms-hero">
            <h1 className="ms-h1">TAREFAS DA GESTÃO</h1>
            <div className="ms-h3">CONTROLE DE PENDÊNCIAS DA EQUIPE</div>
            <div className="ms-status">
              <span className={'ms-led' + (m.nHoje + m.nAtrasadas ? ' warn' : '')} />
              {m.nHoje + m.nAtrasadas
                ? `${m.nHoje} VENCE HOJE · ${m.nAtrasadas} ATRASADA${m.nAtrasadas === 1 ? '' : 'S'}`
                : 'NENHUM PRAZO VENCENDO'}
            </div>
            <p className="ms-t1">
              {m.total} tarefas de {RESPONSAVEIS.length} responsáveis, tiradas das listas de 02/10, 08/10 e 13/10.
              {m.nVelhas > 0 && ` ${m.nVelhas} seguem abertas há 7 dias ou mais.`}
            </p>
          </section>

          <section className="ms-panel ms-log">
            <header className="ms-ph">
              <span>REGISTRO DE TAREFAS {m.pessoa !== 'Todos' && `/ ${m.pessoa.toUpperCase()}`}</span>
              <span className="ms-t3">{m.linhas.length} ITENS</span>
            </header>
            <ol className="ms-rows">
              {m.linhas.map(({ t, s, idade }, k) => (
                <li key={t.id} className={'ms-row ' + s} style={{ ['--i' as string]: k }}>
                  <button className={'ms-tg ' + s} onClick={() => m.alternar(t.id)} aria-label="Marcar feita">
                    {s === 'feita' ? '■' : '□'}
                  </button>
                  <span className="ms-code">{COD[t.responsavel] ?? 'XX'}-{t.id.split('-')[1]}</span>
                  <span className="ms-task">
                    {t.tarefa}
                    <small>{t.responsavel.toUpperCase()} · {t.frente.toUpperCase()} · DESDE {br(t.desde, false)}{t.prazo && ` · PRAZO ${br(t.prazo, false)}`}{t.nota && ` · ${t.nota.toUpperCase()}`}</small>
                  </span>
                  <span className="ms-age">T+{idade}</span>
                  <span className={'ms-st ' + s}>{ROTULO[s].toUpperCase()}</span>
                </li>
              ))}
            </ol>
          </section>
        </main>

        <aside className="ms-side">
          <section className="ms-panel">
            <header className="ms-ph"><span>RADAR DE PENDÊNCIAS</span><span className="ms-t3">IDADE × RESPONSÁVEL</span></header>
            <Radar m={m} />
          </section>
          <section className="ms-panel">
            <header className="ms-ph"><span>TELEMETRIA</span><span className="ms-t3">AO VIVO</span></header>
            <dl className="ms-tel">
              <div><dt>ABERTAS</dt><dd>{String(m.nAbertas).padStart(2, '0')}</dd></div>
              <div className={m.nHoje ? 'warn' : ''}><dt>VENCE HOJE</dt><dd>{String(m.nHoje).padStart(2, '0')}</dd></div>
              <div className={m.nAtrasadas ? 'bad' : ''}><dt>ATRASADAS</dt><dd>{String(m.nAtrasadas).padStart(2, '0')}</dd></div>
              <div className={m.nVelhas ? 'warn' : ''}><dt>7+ DIAS</dt><dd>{String(m.nVelhas).padStart(2, '0')}</dd></div>
              <div><dt>CONCLUSÃO</dt><dd>{m.pctFeitas}%</dd></div>
            </dl>
            <div className="ms-prog"><i style={{ width: `${m.pctFeitas}%` }} /></div>
          </section>
          <section className="ms-panel">
            <header className="ms-ph"><span>CARGA POR RESPONSÁVEL</span></header>
            <ul className="ms-load">
              {m.porPessoa.map((p) => (
                <li key={p.r}>
                  <span>{p.r.toUpperCase()}</span>
                  <span className="ms-ticks">
                    {Array.from({ length: p.total }, (_, k) => <i key={k} className={k < p.abertas ? 'on' : ''} />)}
                  </span>
                  <b>{p.abertas}/{p.total}</b>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Radar({ m }: { m: Modelo }) {
  const R = 92, C = 110
  const maxIdade = Math.max(7, ...m.todas.map((l) => l.idade))
  return (
    <div className="ms-radar">
      <svg viewBox="0 0 220 220">
        {[1, 0.66, 0.33].map((f) => <circle key={f} cx={C} cy={C} r={R * f} className="ms-ring" />)}
        <line x1={C - R} x2={C + R} y1={C} y2={C} className="ms-ring" />
        <line y1={C - R} y2={C + R} x1={C} x2={C} className="ms-ring" />
        <g className="ms-sweep"><path d={`M${C},${C} L${C},${C - R} A${R},${R} 0 0,1 ${C + R * Math.sin(0.6)},${C - R * Math.cos(0.6)} Z`} /></g>
        {RESPONSAVEIS.map((r, k) => {
          const a = (k / RESPONSAVEIS.length) * Math.PI * 2 - Math.PI / 2
          return <text key={r} x={C + (R + 12) * Math.cos(a)} y={C + (R + 12) * Math.sin(a) + 3} textAnchor="middle" className="ms-rl">{COD[r]}</text>
        })}
        {m.todas.map(({ t, s, idade }, k) => {
          const idx = RESPONSAVEIS.indexOf(t.responsavel as typeof RESPONSAVEIS[number])
          const base = (idx / RESPONSAVEIS.length) * Math.PI * 2 - Math.PI / 2
          const jitter = ((k % 5) - 2) * 0.13
          const rr = 14 + (idade / maxIdade) * (R - 18)
          const x = C + rr * Math.cos(base + jitter)
          const y = C + rr * Math.sin(base + jitter)
          if (s === 'feita') return <circle key={t.id} cx={x} cy={y} r="2" className="ms-blip done" />
          return (
            <g key={t.id}>
              <circle cx={x} cy={y} r="2.6" className={'ms-blip ' + s} />
              {(s === 'hoje' || s === 'atrasada') && <circle cx={x} cy={y} r="2.6" className={'ms-blip-p ' + s} />}
            </g>
          )
        })}
        <circle cx={C} cy={C} r="2" fill="#d8cfc2" />
      </svg>
      <div className="ms-rleg"><span><i className="aberta" />aberta</span><span><i className="hoje" />vence hoje</span><span>centro = nova · borda = antiga</span></div>
    </div>
  )
}
