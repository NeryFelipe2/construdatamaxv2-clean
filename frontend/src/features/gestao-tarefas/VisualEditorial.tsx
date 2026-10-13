/**
 * Visual EDITORIAL: o design system NØEMA.
 * Papel claro, tinta preta, número gigante, serifa Georgia e etiquetas em Courier,
 * faixa escura de indicadores e uma seção numerada por responsável.
 */
import { RESPONSAVEIS, ROTULO, br, type Modelo } from './modelo'
import { Seletor } from './Seletor'

export function VisualEditorial({ m }: { m: Modelo }) {
  const pessoas = m.pessoa === 'Todos' ? [...RESPONSAVEIS] : [m.pessoa]
  return (
    <div className="ed">
      <header className="ed-nav">
        <div className="ed-logo">NØ<span>/ TAREFAS</span></div>
        <nav className="ed-links">
          {['Todos', ...RESPONSAVEIS].map((r) => (
            <button key={r} className={m.pessoa === r ? 'on' : ''} onClick={() => m.setPessoa(r)}>{r}</button>
          ))}
        </nav>
        <Seletor m={m} />
      </header>

      <section className="ed-hero">
        <div className="ed-kicker">GESTÃO WCR — EDIÇÃO DE {br(m.hoje)}</div>
        <h1 className="ed-title">O que está pendente,<br /><em>e com quem.</em></h1>
        <div className="ed-big">{String(m.nAbertas).padStart(2, '0')}</div>
        <div className="ed-caption">
          <span>TAREFAS ABERTAS</span>
          <span>DE {m.total} NAS LISTAS DE 02/10, 08/10 E 13/10</span>
        </div>
      </section>

      <section className="ed-band">
        <div><span>Vencem hoje</span><b className={m.nHoje ? 'hot' : ''}>{String(m.nHoje).padStart(2, '0')}</b><small>{m.nHoje ? 'Contratar o pessoal do Joaquim' : 'nenhuma'}</small></div>
        <div><span>Atrasadas</span><b>{String(m.nAtrasadas).padStart(2, '0')}</b><small>com prazo vencido</small></div>
        <div><span>Abertas há 7+ dias</span><b className={m.nVelhas ? 'hot' : ''}>{String(m.nVelhas).padStart(2, '0')}</b><small>{m.maisAntiga ? `a mais antiga é de ${br(m.maisAntiga, false)}` : '—'}</small></div>
        <div><span>Concluídas</span><b>{m.pctFeitas}%</b><small>{m.nFeitas} de {m.total}</small></div>
      </section>

      {pessoas.map((r) => {
        const k = RESPONSAVEIS.indexOf(r as typeof RESPONSAVEIS[number])
        const doR = m.linhas.filter((l) => l.t.responsavel === r)
        const info = m.porPessoa.find((p) => p.r === r)
        if (!doR.length) return null
        return (
          <section key={r} className="ed-sec">
            <div className="ed-sec-h">
              <span className="ed-num">{String(k + 1).padStart(2, '0')}</span>
              <h2>{r}</h2>
              <span className="ed-meta">{info?.abertas} ABERTAS / {info?.total}</span>
            </div>
            <ol className="ed-list">
              {doR.map(({ t, s }) => (
                <li key={t.id} className={s}>
                  <button className="ed-ck" onClick={() => m.alternar(t.id)} aria-label="Marcar feita">{s === 'feita' ? '✕' : ''}</button>
                  <p className="ed-task">{t.tarefa}</p>
                  <div className="ed-tm">
                    <span>{t.frente.toUpperCase()}</span>
                    <span>DESDE {br(t.desde, false)}</span>
                    {t.prazo && <span>PRAZO {br(t.prazo, false)}</span>}
                    <span className={'ed-st ' + s}>{ROTULO[s].toUpperCase()}</span>
                  </div>
                  {t.nota && <p className="ed-note">{t.nota}</p>}
                </li>
              ))}
            </ol>
          </section>
        )
      })}

      <footer className="ed-foot">
        <span>WCR SANEAMENTO — GESTÃO DE OBRAS</span>
        <span>A MARCAÇÃO "FEITA" FICA SÓ NESTE NAVEGADOR</span>
        <span className="ed-foot-n">{String(m.total).padStart(3, '0')}</span>
      </footer>
    </div>
  )
}
