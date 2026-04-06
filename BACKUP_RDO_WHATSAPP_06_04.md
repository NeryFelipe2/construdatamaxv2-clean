# Registro de Alteração: RDO Mobile + WhatsApp (06/04/2026)

Mudei o comportamento da página de formulário de preenchimento (`RdoCampoForm.tsx`) para incluir os requisitos de campo. 

O que foi feito:
1. **Trava de Foto:** Se a equipe de campo não tirar/anexar pelo menos 1 foto, o formulário barra o envio com um alerta, evitando RDO sem registro visual.
2. **Disparo do WhatsApp Automático:** Após salvar os dados, ele pega o contato do 'Engenheiro' ou 'Mestre' do projeto (da store de contatos) e abre o WhatsApp com um Relatório Diário de Obra todo formatado em texto (com emojis e resumos).

## Como Testar a Melhoria 
Na aba 'Campo' da página de RDO do ConstruData, preencha as equipes e não carregue nenhuma foto: ele deve travar o salvamento. Ao enviar com a foto, ele abrirá automaticamente o link `api.whatsapp.com` na nova guia para envio direto para o Engenheiro.

## Se quiser desfazer a mudança (Reverter)

Substitua a função `handleSubmit` no arquivo `frontend/src/features/rdo/components/RdoCampoForm.tsx` (linha ~170 em diante) de volta para o padrão original:

```typescript
  // ── Submit ────
  function handleSubmit() {
    const payload = {
      data, projeto_id: activeProjectId, frente_id: frenteId || null, clima, turno,
      equipes: equipes.map(eq => ({ tipo: eq.tipo, lider: eq.lider, atividades: eq.atividades })),
      materiais: todosMateriaisConcat,
      equipamentos,
      mao_obra: maoObra.filter(m => m.qtd > 0),
      fotos: fotos.map(f => f.name),
      ocorrencia: { tipo: ocorrenciaTipo, descricao: ocorrenciaDesc },
    }
    console.log("RDO Payload:", payload)
    alert("RDO salvo! (Supabase integration coming)")
  }
```
