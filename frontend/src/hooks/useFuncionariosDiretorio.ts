/**
 * useFuncionariosDiretorio — leitura real da tabela `funcionarios` (RH central),
 * pra cruzar no diretório de Gestão de Contatos. Faz join com `obras` (FK
 * funcionarios.obra_id → obras.id) pra saber de qual obra/cliente é cada um —
 * e marcar dinamicamente quem é WCR (nome da obra contém "WCR") de quem não é.
 *
 * ACHADO (20/07): hoje NENHUMA das 34 linhas pertence a uma obra WCR — a tabela
 * `obras` só tem clientes fora do contrato WCR (Pardinho/São Roque/Porangaba,
 * Osasco, Teófilo Otoni, Santos, Cachoeiro, Tatui). `isWcr` fica calculado aqui
 * (não hardcoded) pra continuar correto se um dia cadastrarem uma obra WCR.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface FuncionarioRow {
  id: string
  nome: string
  funcao: string
  departamento: string
  obraId: string | null
  obraNome: string
  isWcr: boolean
  status: string
}

interface DbFuncionario {
  id: string
  nome: string
  funcao: string | null
  departamento: string | null
  obra_id: string | null
  status: string | null
  obras: { nome: string } | { nome: string }[] | null
}

function obraNomeDe(rel: DbFuncionario['obras']): string {
  if (!rel) return '—'
  if (Array.isArray(rel)) return rel[0]?.nome ?? '—'
  return rel.nome ?? '—'
}

function montar(rows: DbFuncionario[]): FuncionarioRow[] {
  return rows.map((r) => {
    const obraNome = obraNomeDe(r.obras)
    return {
      id: r.id,
      nome: r.nome,
      funcao: r.funcao ?? '—',
      departamento: (r.departamento ?? '—').trim(),
      obraId: r.obra_id,
      obraNome,
      isWcr: obraNome.toLowerCase().includes('wcr'),
      status: r.status ?? 'ativo',
    }
  })
}

export function useFuncionariosDiretorio() {
  const [funcionarios, setFuncionarios] = useState<FuncionarioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase
        .from('funcionarios')
        .select('id, nome, funcao, departamento, obra_id, status, obras(nome)')
        .eq('status', 'ativo')
        .order('nome')
      if (e1) throw e1
      setFuncionarios(montar((data ?? []) as unknown as DbFuncionario[]))
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar funcionários do Supabase')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { funcionarios, loading, error, reload: load }
}
