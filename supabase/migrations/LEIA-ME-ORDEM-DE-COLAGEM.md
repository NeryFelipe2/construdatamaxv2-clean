# 📋 Migrations — ordem de colagem no SQL Editor

**Como usar:** abra o [SQL Editor do Supabase](https://supabase.com/dashboard/project/vblfdikfobsirwpdnybw/sql/new),
cole **um arquivo por vez, na ordem abaixo**, rode, e **confira o bloco
CONFERÊNCIA** que aparece no fim do resultado antes de passar para o próximo.
Todos são idempotentes (rodar 2x não estraga nada).

## FASE A — pode colar HOJE (não muda nada no app no ar)

| # | Arquivo | O que faz | Conferir |
|---|---|---|---|
| 1 | `20260822_001_organizacoes_e_usuarios_globais.sql` | Organização **WCR Saneamento** + os 2 e-mails admin globais + trava a tabela profiles | 1 organização, 2 admins pré-aprovados |
| 2 | `20260825_002_contexto_org_e_kill_switch.sql` | **Botão de pânico** (kill switch) + funções de escopo por empresa | kill switch DESLIGADO (f) |
| 3 | `20260825_003_org_id_backfill.sql` | Coluna org_id em ~85 tabelas + cria a org **RK / Legado** + backfill | consulta 1 tem que voltar **VAZIA** (zero org_id nulo) |
| 4 | `20260825_004_org_id_not_null_indices.sql` | Trava org_id como obrigatório + índices | todas as linhas com `true` |
| 5 | `20260825_005_policies_org_paralelas.sql` | Policies por empresa **EM PARALELO** (nada fecha) | consulta volta VAZIA |
| 6 | `20260825_006_policies_catalogo_global.sql` | Policies do catálogo compartilhado | 2 policies × 6 tabelas |
| 7 | `20260825_020_pessoal_base.sql` | Schema do pessoal unificado (pessoas, cargos, apelidos, equipes, presença no RDO). **Salário/CPF numa tabela FECHADA** | tudo 0 + 1 policy na remuneração |
| 8 | `20260825_021_pessoal_seed_migracao.sql` | Migra os 34 funcionários + os 162 nomes de equipe → cadastro único | itens 1-4 têm que dar **0** |
| 9 | `20260825_022_compat_equipe_membros.sql` | equipe_membros vira view de compatibilidade (Kanban continua funcionando igual) | 162 físicas preservadas · **depois faça o teste manual descrito no fim do arquivo** |
| 10 | `20260825_023_convites_acesso.sql` | **Convites** (e-mail autorizado antes da conta existir) + `aplicar_convite()` + trigger à prova de bala. **Fecha 3 furos**: `aplicar_convite` estava executável por qualquer um com a anon key (virava admin global numa chamada); a lista de convites estava visível/editável para `membro`; e um owner/admin de UMA empresa podia gravar convite com `is_global_admin = true` e virar dono de todas | as 4 últimas linhas da CONFERÊNCIA: anon **false** em tudo, service_role **true**; e `policy trava is_global_admin` = **true** |

➡️ Depois da FASE A: o app continua funcionando **exatamente igual**, mas o
sistema já tem empresas, admins globais e cadastro único de pessoas.
**PARE AQUI** até o login estar no ar.

## FASE B — SÓ depois do login validado (deploy novo + contas criadas)

Pré-requisitos: ① deploy do frontend com a tela de login; ② criar as 2 contas
no Dashboard → Authentication → Add user (Auto Confirm ON) e **desligar
"Enable email signup"**; ③ logar e ver o app funcionando; ④ trocar o
`whatsapp-motor` para SERVICE_ROLE; ⑤ **fora do horário de obra**.

| # | Arquivo | Risco |
|---|---|---|
| 10 | `20260825_030_fechar_lote_piloto.sql` | baixo (3 tabelas de teste) |
| 11 | `20260825_031_fechar_lote_leitura.sql` | médio |
| 12 | `20260825_032_fechar_lote_escrita_wcr.sql` | **ALTO — o lote que importa. Kill switch aberto numa aba** |
| 13 | `20260825_033_fechar_rk_e_mortas.sql` | baixo |
| 14 | `20260825_034_views_security_invoker.sql` | médio (sem ela, o resto é teatro) |
| 15 | `20260825_035_grants_finais.sql` | baixo · tem o TESTE FINAL comentado |

## 🧯 Se QUALQUER coisa travar

```sql
update rls_kill_switch set modo_aberto = true, motivo = 'incidente';
```
Reabre tudo em 3 segundos, sem deploy. O arquivo `_ROLLBACK_EMERGENCIA.sql`
tem os outros níveis (por tabela, e o rollback da view de equipes).

## O que NUNCA rodar
`DROP TABLE` de qualquer coisa. `funcionarios`, `equipe_membros_legacy` e
`rdo_mao_obra` são o backup auditável — ficam congeladas para sempre.
