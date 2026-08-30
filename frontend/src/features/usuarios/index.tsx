/**
 * UsuariosPage — raiz do módulo "Usuários & Acessos".
 *
 * Responde ao problema relatado pelo João ("tentei adicionar nossos e-mails e
 * o sistema não permitiu"): até aqui a única via de cadastro era o painel do
 * Supabase, e um usuário não-global criado por lá nascia sem vínculo nenhum,
 * caindo na tela "sua conta não está vinculada a nenhuma empresa".
 *
 * Abas: Quem tem acesso · Convites pendentes.
 * Toda escrita passa pela Edge Function `admin-usuarios` (contrato acordado) —
 * o navegador só tem a ANON key, nunca a service_role.
 *
 * Degradação: sem permissão → painel explicativo; função não deployada →
 * aviso com o comando que falta; sem Supabase → aviso de modo local. Nenhum
 * desses casos quebra a tela.
 *
 * ROTA: ainda NÃO registrada em App.tsx (o orquestrador faz) —
 * ver TODO-INTEGRACAO.md nesta pasta.
 */
import { useMemo, useState } from 'react'
import { useUsuarios } from '@/hooks/useUsuarios'
import { AcessosPanel } from './components/AcessosPanel'
import { AdicionarPessoaModal, type PrefillAcesso } from './components/AdicionarPessoaModal'
import {
  AvisoErro,
  AvisoFuncaoAusente,
  AvisoSemSupabase,
  AvisoSessao,
  AvisosDoBackend,
  SemPermissaoPanel,
} from './components/Avisos'
import { ConvitesPanel } from './components/ConvitesPanel'
import { UsuariosHeader, type UsuariosTab } from './components/UsuariosHeader'

export function UsuariosPage() {
  const dados = useUsuarios()
  const [activeTab, setActiveTab] = useState<UsuariosTab>('acessos')
  const [modal, setModal] = useState<{ aberto: boolean; prefill: PrefillAcesso | null }>({
    aberto: false,
    prefill: null,
  })

  const semDado = dados.semSupabase || dados.funcaoAusente || dados.semPermissao || dados.sessaoExpirada

  // KPIs honestos: null (→ "—" com a razão) quando a função não respondeu.
  const kpis = useMemo(() => {
    if (semDado) return null
    if (dados.loading && dados.usuarios.length === 0) return null
    return {
      pessoas: dados.usuarios.length,
      adminsGlobais: dados.usuarios.filter((u) => u.isGlobalAdmin).length,
      convites: dados.convites.length,
      empresas: dados.orgs.length,
    }
  }, [semDado, dados.loading, dados.usuarios, dados.convites, dados.orgs])

  const notaSemDado = dados.semSupabase
    ? 'app sem conexão com o Supabase'
    : dados.funcaoAusente
      ? 'função admin-usuarios ainda não deployada'
      : dados.sessaoExpirada
        ? 'sessão expirada'
        : dados.semPermissao
          ? 'sem permissão para ver os acessos'
          : dados.erro
            ? 'a função admin-usuarios não respondeu'
            : 'sem dados carregados'

  const subtitulo = dados.semSupabase
    ? 'modo local'
    : dados.funcaoAusente
      ? 'função admin-usuarios pendente de deploy'
      : dados.sessaoExpirada
        ? 'sessão expirada'
        : dados.semPermissao
          ? 'somente leitura do seu próprio acesso'
          : dados.erro
            ? 'falha ao consultar'
            : 'gestão de acessos ativa'

  const mostrarConteudo = dados.permissoesCarregadas && dados.podeGerenciar && !dados.semSupabase

  return (
    <div className="min-h-full bg-[#2c2c2c] flex flex-col">
      <UsuariosHeader
        activeTab={activeTab}
        onTab={setActiveTab}
        kpis={kpis}
        notaSemDado={notaSemDado}
        subtitulo={subtitulo}
        subtituloOk={!semDado && !dados.erro}
        convitesPendentes={dados.convites.length}
        onReload={() => void dados.recarregar()}
        recarregando={dados.loading}
      />

      <div className="flex-1">
        {!dados.permissoesCarregadas ? (
          <p className="p-6 text-center text-[#6b6b6b] text-sm italic">Verificando suas permissões…</p>
        ) : dados.semSupabase ? (
          <div className="p-6">
            <AvisoSemSupabase />
          </div>
        ) : !dados.podeGerenciar ? (
          <SemPermissaoPanel />
        ) : (
          <>
            {(dados.funcaoAusente ||
              dados.sessaoExpirada ||
              (dados.erro && !dados.funcaoAusente) ||
              dados.avisos.length > 0) && (
              <div className="px-6 pt-6 space-y-3">
                {dados.funcaoAusente && <AvisoFuncaoAusente detalhe={null} />}
                {dados.sessaoExpirada && <AvisoSessao mensagem={dados.erro ?? 'Sua sessão expirou.'} />}
                {!dados.funcaoAusente && !dados.sessaoExpirada && dados.erro && (
                  <AvisoErro mensagem={dados.erro} />
                )}
                <AvisosDoBackend avisos={dados.avisos} />
              </div>
            )}

            {activeTab === 'acessos' && (
              <AcessosPanel
                dados={dados}
                onAdicionar={(prefill) => setModal({ aberto: true, prefill: prefill ?? null })}
              />
            )}
            {activeTab === 'convites' && (
              <ConvitesPanel dados={dados} onAdicionar={() => setModal({ aberto: true, prefill: null })} />
            )}
          </>
        )}
      </div>

      {mostrarConteudo && modal.aberto && (
        <AdicionarPessoaModal
          orgsAdministraveis={dados.orgsAdministraveis}
          podeCriarGlobal={dados.isGlobalAdmin}
          prefill={modal.prefill}
          onCriar={dados.criarUsuario}
          onConvidar={dados.convidar}
          onClose={(resultado) => {
            setModal({ aberto: false, prefill: null })
            if (resultado === 'convidou') setActiveTab('convites')
            if (resultado === 'criou') setActiveTab('acessos')
          }}
        />
      )}
    </div>
  )
}

export default UsuariosPage
