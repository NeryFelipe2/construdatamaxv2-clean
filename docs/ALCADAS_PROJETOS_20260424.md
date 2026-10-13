# Registro de Alteracao - Alcadas Tatui e Pardinho

Data: 2026-04-24

## Motivo

Normalizar os cadastros de alçada de Tatui e Pardinho conforme regra operacional informada:

- Tatui - RK: responsaveis Felipe Nery / Icaro
- Pardinho: mesma regra operacional de Tatui
- Icaro como engenheiro de obra
- Felipe Nery, Luiz Fernando e Renato como Diretoria RK

## Alteracoes no Supabase

### Projeto Tatui - RK

- `projetos.nome`: `Tatui - RK`
- `projetos.responsavel_nome`: `Felipe Nery / Icaro`
- `projetos.responsavel_telefone`: `5561981846325`

Contatos vinculados:

| Nome | Cargo | Setor | Alcada |
|---|---|---|---|
| Icaro | Engenheiro Tatui | Obra | engenheiro_obra |
| Felipe Nery | Diretor RK | Diretoria | diretor |
| Luiz Fernando | Diretor RK | Diretoria | diretor |
| Renato | Diretor RK | Diretoria | diretor |

### Projeto Pardinho

- `projetos.responsavel_nome`: `Felipe Nery / Icaro`
- `projetos.responsavel_telefone`: `5561981846325`

Contatos vinculados:

| Nome | Cargo | Setor | Alcada |
|---|---|---|---|
| Icaro | Engenheiro Pardinho | Obra | engenheiro_obra |
| Felipe Nery | Diretor RK | Diretoria | diretor |
| Luiz Fernando | Diretor RK | Diretoria | diretor |
| Renato | Diretor RK | Diretoria | diretor |

## Validacao

Validado via endpoints publicos:

- `/api/projetos/c2bf8fda-b2e0-4bc1-9535-4891d596ea10/contatos`
- `/api/projetos/ec112c9a-1669-4287-8079-526d6940ce82/contatos`
- `/api/projetos`

Nenhum contato existente foi apagado.
