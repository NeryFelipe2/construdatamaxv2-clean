# Manual WhatsApp RDO — ConstruData

## 1. Como cadastrar os numeros que vao preencher o RDO

Somente numeros cadastrados na whitelist podem interagir com o bot. Qualquer numero nao cadastrado recebe a mensagem: *"Numero nao autorizado"*.

### Via painel web (recomendado)

Acesse a tab **WhatsApp** no RDO e use os endpoints:

| Endpoint | Metodo | Descricao |
|---|---|---|
| `/api/whatsapp/autorizados` | GET | Lista todos os apontadores cadastrados |
| `/api/whatsapp/autorizados` | POST | Cadastra um novo apontador |
| `/api/whatsapp/autorizados/{telefone}` | DELETE | Desativa um apontador |

### Exemplo de cadastro (POST)

```json
{
  "telefone": "5513991234567",
  "nome": "Joao Encanador",
  "nucleo_padrao": "Pantanal"
}
```

- **telefone**: apenas digitos, com DDD (ex: `5513991234567`)
- **nome**: nome do apontador (obrigatorio)
- **nucleo_padrao**: nucleo que sera pre-selecionado ao iniciar (opcional)

---

## 2. Fluxo de preenchimento do RDO

O bot guia o apontador por etapas com **opcoes fixas numeradas**. O apontador so precisa digitar o numero da opcao.

### Passo a passo

#### Passo 1 — Iniciar conversa
Apontador envia qualquer mensagem. O bot responde:

```
Bom dia! Qual nucleo?
1. Verde e Teteu
2. Pantanal
3. Criadores
4. Sao Manoel
5. Israel
```

#### Passo 2 — Escolher Nucleo
Apontador digita o numero ou nome do nucleo. Ex: `2` ou `Pantanal`.

#### Passo 3 — Escolher NS (Nota de Servico)
O bot lista as NS disponiveis para o nucleo escolhido:

```
Qual NS?
1. NS_005 | Pantanal | PV010 -> PV025
2. NS_012 | Pantanal | PV025 -> PV040
3. NS_018 | Pantanal | PV040 -> PV055
```

Apontador digita o numero da linha ou o codigo da NS. Ex: `1` ou `NS_005`.

#### Passo 4 — Escolher Servico
```
Servico executado?
Escavacao | Assentamento tubo | Reaterro | Recomposicao pavimento | Ligacao predial | Montagem PV | Teste estanqueidade
```

Apontador digita o nome (ou parte dele). Ex: `Assentamento`.

#### Passo 5 — Informar Quantidade
```
Quantos metros?
```

Apontador digita o numero. Ex: `12.5`

#### Passo 6 — Escolher DN (Diametro Nominal)
```
DN?
DN100 | DN150 | DN200 | DN300 | DN400
```

Apontador digita o numero. Ex: `150`

#### Passo 7 — Enviar Foto
Apontador envia uma foto do servico executado. O bot analisa a foto com IA e gera uma legenda automatica.

#### Passo 8 — Mais servicos nesta NS?
```
Foto recebida! Legenda: Assentamento de tubo DN150 em trecho aberto
Mais servicos nesta NS? [Sim/Nao]
```

- **Sim** → volta para o Passo 4
- **Nao** → vai para o Passo 9

#### Passo 9 — Outra NS?
```
Outra NS? [Sim/Nao]
```

- **Sim** → volta para o Passo 3
- **Nao** → vai para o Passo 10

#### Passo 10 — Equipe
```
Equipe hoje? Quantos encanadores?
```
Apontador informa a quantidade de cada funcao:
1. Encanadores
2. Ajudantes
3. Operadores

#### Passo 11 — Ocorrencia
```
Alguma ocorrencia? [Nenhuma/Parada/Chuva/Acidente/Falta material]
```

Opcoes fixas:
- **Nenhuma** → finaliza direto
- **Parada** / **Chuva** / **Acidente** / **Falta material** → pede descricao livre

#### Passo 12 — Resumo final
O bot gera o resumo do RDO e fecha o apontamento:

```
RDO registrado! Resumo:
NS_005: Assentamento tubo DN150 - 12.5 - R$ 1.875,00
NS_005: Reaterro DN150 - 12.5 - R$ 625,00
Equipe: 2 enc + 1 aj + 0 op
Total dia: R$ 2.500,00
```

---

## 3. Resumo das opcoes fixas

| Etapa | Opcoes |
|---|---|
| Nucleo | Verde e Teteu, Pantanal, Criadores, Sao Manoel, Israel |
| NS | Lista dinamica do banco filtrada por nucleo + status (Planejada/Em Execucao) |
| Servico | Escavacao, Assentamento tubo, Reaterro, Recomposicao pavimento, Ligacao predial, Montagem PV, Teste estanqueidade |
| DN | DN100, DN150, DN200, DN300, DN400 |
| Ocorrencia | Nenhuma, Parada, Chuva, Acidente, Falta material |

---

## 4. Testando localmente

Use o endpoint `POST /api/whatsapp/test` com o payload:

```json
{
  "data": {
    "from": "5513991234567",
    "text": "1",
    "messageType": "text",
    "key": { "remoteJid": "5513991234567@s.whatsapp.net" },
    "message": { "conversation": "1" }
  }
}
```

O telefone `5513991234567` precisa estar cadastrado na whitelist para funcionar.

---

## 5. Configurando o webhook (Evolution API / Meta)

Aponte o webhook do provedor para:

```
POST https://seu-dominio/webhook/whatsapp
```

O payload e normalizado automaticamente para os formatos:
- Evolution API v2 (`data.messages[]`)
- Meta Cloud API (`from`, `text`)
- Formato local (`sender`, `message.conversation`)

---

## 6. Teste com o proprio numero do bot

Quando o mesmo WhatsApp esta conectado como bot e o Felipe digita uma mensagem,
a Evolution entrega o evento como `fromMe=true`.

Regra de seguranca:
- mensagens de grupos sao ignoradas;
- mensagens `fromMe=true` em conversa individual sao liberadas para comandos seguros;
- comandos seguros: `menu`, `oi`, opcoes `1` a `16`, `@comandos`, `#comando` e `construdata teste`.

Exemplos:

```text
menu
1
@rdo
#menu
construdata teste menu
```

Essa trava evita o problema de o bot responder em grupo. Em privado, o proprio
numero conectado pode testar o menu e as opcoes sem whitelist de telefone. A
whitelist continua valendo para mensagens recebidas de outros numeros.

Para diretoria/gerencia ou numeros vinculados a mais de um projeto, as opcoes
`1` e `4` respondem em escopo consolidado, listando os 6 projetos canonicos.
Para engenheiro/apontador vinculado a uma unica obra, a resposta fica filtrada
no projeto dele.

Variavel operacional relacionada:

```text
EVOLUTION_SEND_TIMEOUT_SECONDS=30
```

O timeout maior reduz falso erro quando a Evolution/Render acorda devagar.
Nao ha retry automatico de envio para evitar mensagem duplicada no WhatsApp.
