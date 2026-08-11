# Modelo - Preencher com Texto Controle de Obra e Fluxo

Cole esse modelo para o engenheiro responder no WhatsApp/email. A plataforma identifica obra, custos projetados, medicao, recebimento, pendencias e desvios.

```text
Data base: 26/04/2026
Obra: Tatui
Responsavel: Icaro

Controle de obra:
- Liberar frente Cesario Lange ate 29/04/2026
- Confirmar equipe de recomposicao em Sao Roque ate 30/04/2026

Custos fixos:
- Administrativo de obra abril/2026 R$ 8.500,00
- Alojamento abril/2026 R$ 4.200,00

Custos diretos:
- Material DN150 para Porangaba em 28/04/2026 R$ 12.300,00
- Mao de obra direta semana 18 R$ 18.000,00

Custos indiretos:
- Combustivel supervisao R$ 1.900,00
- Apoio logistico R$ 2.500,00

Custos variaveis:
- Retroescavadeira extra 30/04/2026 R$ 3.800,00
- Bota-fora adicional R$ 2.100,00

Medicao prevista:
- Medicao abril/2026 R$ 82.000,00

Recebimento previsto:
- Recebimento da medicao abril em 20/05/2026 R$ 82.000,00

Desvios:
- Atraso de material DN150 impacta 80m de producao
- Risco de chuva pode reduzir equipe de vala

Observacoes:
- Replanejar frentes com base nos desvios do RDO.
```

Mapeamento automatico:

```text
Cesario Lange -> CESARIO_LANGE
Porangaba -> PORANGABA
Sao Roque -> SAO_ROQUE
Tatui -> TATUI
Morro do Teteu / Teteu / Subempreita / RK_SUB -> RK_SUB
```
