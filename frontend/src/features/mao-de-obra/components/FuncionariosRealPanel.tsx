import { useState } from 'react'
import { usePessoas, type Pessoa } from '@/hooks/usePessoas'
import { useEquipes } from '@/hooks/useEquipes'
import { FuncionariosListPanel } from '@/features/pessoal/components/FuncionariosListPanel'
import { PessoaDrawer } from '@/features/pessoal/components/PessoaDrawer'

/**
 * Aba "Funcionários" do módulo Mão de Obra apontada para o CADASTRO ÚNICO
 * (tabela `pessoas`) — os mesmos funcionários selecionáveis no RDO e nas
 * Equipes. Substitui o antigo FuncionariosPanel, que rodava sobre mock
 * em memória e não gravava nada no banco.
 */
export function FuncionariosRealPanel() {
  const pessoal = usePessoas()
  const { equipes } = useEquipes()
  const [drawer, setDrawer] = useState<{ aberto: boolean; pessoa: Pessoa | null }>({
    aberto: false,
    pessoa: null,
  })

  return (
    <>
      <FuncionariosListPanel
        pessoal={pessoal}
        equipes={equipes}
        onNovo={() => setDrawer({ aberto: true, pessoa: null })}
        onEditar={(p) => setDrawer({ aberto: true, pessoa: p })}
      />
      {drawer.aberto && (
        <PessoaDrawer
          pessoal={pessoal}
          equipes={equipes}
          pessoa={drawer.pessoa}
          onClose={() => setDrawer({ aberto: false, pessoa: null })}
        />
      )}
    </>
  )
}
