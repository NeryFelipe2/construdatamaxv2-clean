/**
 * PessoalPage — raiz do módulo PESSOAL (cadastro único de funcionários).
 *
 * Abas: Funcionários · Equipes · Cargos · Importar · Duplicatas.
 * Estado de aba em useState LOCAL (decisão consciente — módulo novo, sem
 * deep-link ainda; se precisar, migra pro padrão ?tab= do RdoPage).
 *
 * Fonte de dados: usePessoas (pessoas/cargos/apelidos — degrada com aviso
 * quando as migrations 020/021/022 ainda não foram aplicadas) + useEquipes
 * (wcr_equipes/equipe_membros — já existem hoje).
 *
 * ROTA: ainda NÃO registrada em App.tsx (outra frente está mexendo lá) —
 * ver TODO-INTEGRACAO.md nesta pasta.
 */
import { useMemo, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { usePessoas, type Pessoa } from '@/hooks/usePessoas'
import { useEquipes } from '@/hooks/useEquipes'
import { PessoalHeader, type PessoalTab } from './components/PessoalHeader'
import { FuncionariosListPanel } from './components/FuncionariosListPanel'
import { PessoaDrawer } from './components/PessoaDrawer'
import { EquipesPanel } from './components/EquipesPanel'
import { CargosPanel } from './components/CargosPanel'
import { DuplicatasPanel } from './components/DuplicatasPanel'
import { ImportarFuncionariosModal } from './components/ImportarFuncionariosModal'
import { btnPrimario, cardCls } from './components/ui'

export function PessoalPage() {
  const pessoal = usePessoas()
  const { equipes } = useEquipes()
  const [activeTab, setActiveTab] = useState<PessoalTab>('funcionarios')
  const [drawer, setDrawer] = useState<{ aberto: boolean; pessoa: Pessoa | null }>({ aberto: false, pessoa: null })
  const [importarAberto, setImportarAberto] = useState(false)

  // KPIs honestos: null quando as tabelas não existem (o header mostra "—" com a razão)
  const kpis = useMemo(() => {
    if (pessoal.tabelasAusentes) return null
    if (pessoal.loading && pessoal.pessoas.length === 0) return null
    return {
      ativos: pessoal.pessoas.filter((p) => p.status === 'ativo').length,
      desligados: pessoal.pessoas.filter((p) => p.status === 'desligado').length,
      emContratacao: pessoal.pessoas.filter((p) => p.status === 'em_contratacao').length,
      aRevisar: pessoal.pessoas.filter((p) => p.revisar).length,
    }
  }, [pessoal.tabelasAusentes, pessoal.loading, pessoal.pessoas])

  const duplicatasPendentes = useMemo(() => {
    const grupos = new Map<string, Set<string>>()
    for (const a of pessoal.apelidos) {
      if (a.revisado) continue
      const s = grupos.get(a.alias_norm) ?? new Set<string>()
      s.add(a.pessoa_id)
      grupos.set(a.alias_norm, s)
    }
    let ambiguos = 0
    for (const [, s] of grupos) if (s.size >= 2) ambiguos++
    return ambiguos + pessoal.pessoas.filter((p) => p.revisar).length
  }, [pessoal.apelidos, pessoal.pessoas])

  return (
    <div className="min-h-full bg-[#2c2c2c] flex flex-col">
      <PessoalHeader
        activeTab={activeTab}
        onTab={setActiveTab}
        kpis={kpis}
        tabelasAusentes={pessoal.tabelasAusentes}
        duplicatasPendentes={duplicatasPendentes}
        onReload={pessoal.reload}
      />

      <div className="flex-1">
        {activeTab === 'funcionarios' && (
          <FuncionariosListPanel
            pessoal={pessoal}
            equipes={equipes}
            onNovo={() => setDrawer({ aberto: true, pessoa: null })}
            onEditar={(p) => setDrawer({ aberto: true, pessoa: p })}
          />
        )}
        {activeTab === 'equipes' && <EquipesPanel pessoal={pessoal} />}
        {activeTab === 'cargos' && <CargosPanel pessoal={pessoal} />}
        {activeTab === 'importar' && (
          <div className="p-6">
            <div className={`${cardCls} p-6 max-w-2xl space-y-3`}>
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet size={18} className="text-[#f97316]" />
                <p className="text-sm font-semibold text-[#f5f5f5]">Importar planilha de RH</p>
              </div>
              <p className="text-xs text-[#a3a3a3] leading-relaxed">
                Lê o formato “FUNCIONÁRIOS ATIVOS” (abas Efetivos · Desligados · Em processo de contratação),
                recalcula as experiências (admissão +44d/+89d), casa os nomes com o cadastro existente
                (dry-run antes de gravar) e envia salário/vale para a tabela fechada de remuneração via
                Edge Function — o navegador nunca escreve remuneração direto.
              </p>
              <button onClick={() => setImportarAberto(true)} className={btnPrimario}>
                Selecionar planilha…
              </button>
            </div>
          </div>
        )}
        {activeTab === 'duplicatas' && (
          <DuplicatasPanel pessoal={pessoal} onEditar={(p) => setDrawer({ aberto: true, pessoa: p })} />
        )}
      </div>

      {drawer.aberto && (
        <PessoaDrawer
          pessoal={pessoal}
          equipes={equipes}
          pessoa={drawer.pessoa}
          onClose={() => setDrawer({ aberto: false, pessoa: null })}
        />
      )}
      {importarAberto && (
        <ImportarFuncionariosModal
          onClose={(importou) => {
            setImportarAberto(false)
            if (importou) pessoal.reload()
          }}
        />
      )}
    </div>
  )
}

export default PessoalPage
