# Ultra Handover - NOVA NS V5 / ConstruData Offline / RDO Detalhado

Data: 2026-04-26  
Origem de preparacao: `C:\Users\felip\Downloads\construdatamaxv2-clean`  
Destino real: `C:\Users\felip\Downloads\NOVA NS Versao 5`  
Pacote: `PACOTE_COPIAR_PARA_NOVA_NS_RDO_DETALHADO_20260426`

## 1. Resumo Executivo

Este pacote existe porque o ambiente atual estava com restricao/bloqueio para gravar diretamente na pasta real `NOVA NS Versao 5`. Entao os arquivos foram preparados, compilados e empacotados dentro do `construdatamaxv2-clean`, para serem copiados manualmente para a pasta real.

Objetivo desta entrega:

> Amarrar o RDO detalhado com fotos, localizacao, maquinas, materiais, mao de obra, equipamentos, locacoes, ocorrencias, paralisacoes e custos no fluxo offline completo do ConstruData/NOVA NS V5.

O foco e **software offline no computador**, sem HTML novo.

## 2. Decisao De Arquitetura

A plataforma offline deve rodar dentro do NOVA NS V5 com este modelo:

```text
GUI Tkinter NOVA NS V5
-> aba [14] Ciclo Operacional
-> aba [15] ConstruData
-> banco local SQLite via SQLAlchemy
-> motores Python internos
```

A Nota de Servico continua existindo como motor tecnico importante, mas nao deve ser o unico eixo da plataforma.

A plataforma offline agora tem tambem um backbone operacional independente:

- projetos;
- contatos;
- tarefas;
- LPS/restricoes;
- suprimentos;
- mao de obra;
- equipamentos;
- custos/DRE;
- agenda;
- punch list;
- WhatsApp logs;
- RDOs;
- planejamento semanal;
- desvios;
- ML/regras;
- replanejamento.

## 3. Arquivos Deste Pacote

Estrutura do pacote:

```text
PACOTE_COPIAR_PARA_NOVA_NS_RDO_DETALHADO_20260426/
  README_COPIAR.md
  ULTRA_HANDOVER_NOVA_NS_RDO_DETALHADO_20260426.md
  ui_construdata_modules.py
  campo/
    rdo_engine.py
```

Destino dos arquivos:

```text
ui_construdata_modules.py -> C:\Users\felip\Downloads\NOVA NS Versao 5\ui_construdata_modules.py
campo\rdo_engine.py       -> C:\Users\felip\Downloads\NOVA NS Versao 5\campo\rdo_engine.py
```

## 4. O Que Foi Alterado Em `ui_construdata_modules.py`

Arquivo responsavel pelo shell offline do ConstruData dentro do GUI Tkinter.

### 4.1 Novos helpers adicionados

Foram adicionadas funcoes auxiliares para interpretar dados simples digitados no formulario:

- `_split_items(value)`
  - separa textos por `;` ou quebra de linha;
  - usado para mao de obra, maquinas, equipamentos, locacoes, materiais, ocorrencias e paralisacoes.

- `_qty_and_label(value)`
  - interpreta entradas como `2 ajudantes`;
  - retorna `(2, "ajudantes")`;
  - se nao houver numero, assume quantidade `1`.

- `_allocated(total, count)`
  - divide custo total por quantidade de itens;
  - evita explodir custo quando ha varios recursos.

- `_mirror_rdo_details(project, rdo_id, payload)`
  - espelha o RDO detalhado nas entidades offline do ConstruData.

### 4.2 Espelhamento Do RDO Para O Backbone ConstruData

Ao criar um RDO pelo GUI ConstruData, os dados sao gravados no motor de RDO e tambem espelhados para entidades operacionais.

Mapeamento:

```text
mao_obra      -> cdm_mao_obra
maquinas      -> cdm_equipamento tipo=Maquina
equipamentos  -> cdm_equipamento tipo=Equipamento
locacoes      -> cdm_equipamento tipo=Locacao
materiais     -> cdm_suprimento
custos        -> cdm_custo
ocorrencias   -> cdm_lps_restricao prioridade=NORMAL
paralisacoes  -> cdm_lps_restricao prioridade=ALTA
foto/local    -> cdm_whatsapp_log como trilha operacional
```

Isso faz o RDO aparecer tambem nos modulos:

- Mao de Obra;
- Equipamentos;
- Suprimentos;
- DRE;
- LPS;
- WhatsApp Logs;
- Gestao 360 / Relatorio 360.

### 4.3 Formulario RDO Expandido

Antes, a tela RDO capturava basicamente:

- data;
- responsavel;
- servico;
- quantidade;
- unidade;
- clima.

Agora captura:

- data;
- responsavel;
- producao/servico;
- quantidade;
- unidade;
- clima;
- mao de obra;
- maquinas;
- equipamentos;
- locacoes;
- materiais;
- custo mao de obra;
- custo equipamentos;
- custo locacoes;
- custo materiais;
- custos diretos;
- custos indiretos;
- custo total do dia;
- ocorrencias;
- paralisacoes;
- foto/caminho;
- legenda da foto;
- latitude;
- longitude;
- observacoes.

### 4.4 Persistencia Ao Criar RDO

A funcao `_create_rdo_from_gui(project, payload)` agora:

1. monta `equipe` para o motor RDO;
2. monta `ocorrencias`;
3. monta `paralisacoes`;
4. monta `fotos` com `lat/lon`;
5. calcula custo total do dia quando o campo `custo_total` estiver vazio;
6. registra observacoes com resumo de maquinas, equipamentos, locacoes, materiais e localizacao;
7. chama `RDOEngine().criar_rdo_completo(...)`;
8. chama `_mirror_rdo_details(...)`;
9. tenta gerar desvios contra planejamento ativo via `gerar_desvios_rdo(...)`.

## 5. O Que Foi Alterado Em `campo/rdo_engine.py`

Arquivo do motor interno de RDO.

### 5.1 `criar_rdo_completo(payload)`

Agora aceita:

- `clima` como texto simples ou dict `{manha, tarde}`;
- equipe usando `qtd` ou `quantidade`;
- `paralisacoes` junto com ocorrencias;
- fotos com `lat` e `lon`;
- servico com `custo_unit`, `custo_total`, `hora_inicio`, `hora_fim`;
- recalcula `total_custo` do RDO apos inserir apontamentos.

### 5.2 `adicionar_apontamento(...)`

Assinatura expandida:

```python
def adicionar_apontamento(
    self,
    rdo_id: int,
    servico: str,
    quantidade: float = 0.0,
    unidade: str = "m",
    dn_mm: int = 0,
    ns_id: Optional[int] = None,
    hora_inicio: str = "",
    hora_fim: str = "",
    custo_unit: float | str | None = None,
    custo_total: float | str | None = None,
) -> dict:
```

Comportamento novo:

- se `custo_unit` vier preenchido, usa esse valor;
- se `custo_total` vier preenchido, usa esse valor;
- se nao vier custo, continua usando a regra SINAPI simplificada ja existente;
- aceita valores string com virgula decimal.

### 5.3 Fotos Com Localizacao

`criar_rdo_completo(...)` agora chama:

```python
self.adicionar_foto(..., lat, lon)
```

Antes a funcao ignorava latitude/longitude do payload completo.

## 6. Como Copiar Para A Pasta Real

Copie a pasta:

```text
C:\Users\felip\Downloads\construdatamaxv2-clean\PACOTE_COPIAR_PARA_NOVA_NS_RDO_DETALHADO_20260426
```

Para dentro de:

```text
C:\Users\felip\Downloads\NOVA NS Versao 5
```

Mas a copia correta e substituir os arquivos nos destinos abaixo:

```text
PACOTE\ui_construdata_modules.py
  -> C:\Users\felip\Downloads\NOVA NS Versao 5\ui_construdata_modules.py

PACOTE\campo\rdo_engine.py
  -> C:\Users\felip\Downloads\NOVA NS Versao 5\campo\rdo_engine.py
```

## 7. Como Validar Depois De Copiar

Abra PowerShell em:

```text
C:\Users\felip\Downloads\NOVA NS Versao 5
```

Rode:

```powershell
python -m py_compile ui_construdata_modules.py campo\rdo_engine.py
```

Se nao imprimir erro, a sintaxe esta OK.

Depois abra o GUI:

```text
ABRIR_GUI.bat
```

Ou rode o Python correspondente do GUI usado no projeto.

No GUI:

```text
[15] ConstruData -> RDO
```

Preencha um RDO com:

```text
Mao de obra: 2 ajudantes;1 operador
Maquinas: Retroescavadeira
Equipamentos: compactador; bomba
Locacoes: caminhao locado
Materiais: tubo PEAD; areia
Custo MO: 500
Custo Equip: 300
Custo Loc: 450
Custo Mat: 1200
Diretos: 200
Indiretos: 100
Ocorrencias: interferencia encontrada
Paralisacoes: aguardando liberacao
Foto/caminho: C:\teste\foto.jpg
Lat: -23.9
Lon: -46.3
```

Clique para criar RDO.

Depois confira os modulos:

- `Mao de Obra` deve ter linhas novas;
- `Equipamentos` deve ter maquinas/equipamentos/locacoes;
- `Suprimentos` deve ter materiais;
- `DRE` deve ter custos;
- `LPS` deve ter ocorrencias/paralisacoes;
- `WhatsApp RDO` deve ter log do RDO;
- `Gestao 360` deve refletir contadores e custos;
- `Relatorio 360` deve incluir as entidades.

## 8. Smoke Test Programatico Recomendado

Depois de copiar, rode este teste com banco temporario para nao sujar o banco real:

```powershell
$env:DATABASE_URL='sqlite:///C:/Users/felip/AppData/Local/Temp/ns5_rdo_detalhado_smoke.db'
python - <<'PY'
from pathlib import Path
from core import database
from core.database import criar_banco
from core.construdata_offline import get_project, list_entity
from ui_construdata_modules import _create_rdo_from_gui

criar_banco()
project = get_project(name='Tatui - RK')
rdo_id, desvios = _create_rdo_from_gui(project, {
    'data': '2026-04-26',
    'responsavel': 'Icaro',
    'servico': 'Assentamento tubo',
    'quantidade': '4',
    'unidade': 'm',
    'clima': 'Bom',
    'mao_obra': '2 ajudantes;1 operador',
    'maquinas': 'Retroescavadeira',
    'equipamentos': 'Compactador',
    'locacoes': 'Caminhao locado',
    'materiais': 'Tubo PEAD;Areia',
    'custo_mao_obra': '500',
    'custo_equipamentos': '300',
    'custo_locacoes': '450',
    'custo_materiais': '1200',
    'custos_diretos': '200',
    'custos_indiretos': '100',
    'custo_total': '2750',
    'ocorrencias': 'Interferencia encontrada',
    'paralisacoes': 'Aguardando liberacao',
    'foto': 'C:/teste/foto.jpg',
    'foto_legenda': 'Foto teste',
    'lat': '-23.9',
    'lon': '-46.3',
    'observacoes': 'Smoke RDO detalhado',
})
counts = {name: len(list_entity(name, project.id)) for name in ['mao_obra','equipamentos','suprimentos','custos','lps','whatsapp']}
print({'rdo_id': rdo_id, 'desvios': desvios, 'counts': counts})
assert counts['mao_obra'] >= 2
assert counts['equipamentos'] >= 3
assert counts['suprimentos'] >= 2
assert counts['custos'] >= 1
assert counts['lps'] >= 2
assert counts['whatsapp'] >= 1
if getattr(database, '_engine', None):
    database._engine.dispose()
PY
```

Resultado esperado:

```text
{'rdo_id': 1, 'desvios': 0 ou mais, 'counts': {...}}
```

Observacao: `desvios` pode ser `0` se nao houver planejamento ativo para o nucleo/data. Isso nao e erro do RDO detalhado.

## 9. Estado Antes Deste Pacote

Ja existia no NOVA NS V5:

- `core/construdata_offline.py` com tabelas offline do ConstruData;
- `api/routes_construdata_offline.py` com rotas `/api/offline/...`;
- `ui_operational_cycle.py` com ciclo operacional por clique;
- `construdata_gui.py` e `construdata_gui_premium.py` chamando aba unica ConstruData;
- shell ConstruData com sidebar interna;
- status em `STATUS_CICLO_OPERACIONAL_OFFLINE_20260426.md`.

Este pacote nao substitui tudo isso. Ele altera somente:

- `ui_construdata_modules.py`;
- `campo/rdo_engine.py`.

## 10. O Que Nao Foi Feito Ainda

Este pacote nao faz:

- OCR de foto;
- upload real de foto;
- mapa visual de localizacao;
- sincronizacao com Supabase;
- envio WhatsApp real;
- XGBoost real treinado com historico robusto;
- UI final premium identica ao frontend online.

Ele faz a base funcional offline para esses dados entrarem no banco local e alimentarem os modulos.

## 11. Proximas Evolucoes Recomendadas

1. Criar uma tela de detalhe do RDO dentro da aba `RDO`, abrindo equipe, fotos, ocorrencias e custos do RDO selecionado.
2. Adicionar selecao de arquivo para foto em vez de digitar caminho manualmente.
3. Adicionar botao de capturar localizacao manual por coordenada ou por mapa offline.
4. Criar exportacao Markdown/PDF do RDO detalhado.
5. Ligar `RDO -> LPS` com selecao de restricao existente.
6. Ligar `RDO -> Tarefas` para marcar tarefas feitas automaticamente quando a atividade bater com tarefa planejada.
7. Criar relatorio semanal: planejado x realizado x custo x desvio.
8. Quando houver historico local suficiente, treinar XGBoost real em cima dos desvios acumulados.

## 12. Rollback Seguro

Para voltar atras:

1. Restaurar os arquivos anteriores:
   - `ui_construdata_modules.py`
   - `campo/rdo_engine.py`
2. Nao apagar tabelas SQLite imediatamente.
3. Se o banco ja recebeu dados espelhados, eles podem ficar sem quebrar a aplicacao.

Rollback destrutivo nao recomendado sem backup.

## 13. Mensagem Para A Proxima LLM

Continue a partir da pasta real:

```text
C:\Users\felip\Downloads\NOVA NS Versao 5
```

Nao volte a implementar no `construdatamaxv2-clean`, exceto para preparar pacotes se o ambiente nao permitir escrita direta.

Primeiro passo da proxima LLM:

1. Copiar este pacote para `NOVA NS Versao 5`.
2. Rodar `py_compile`.
3. Rodar o smoke test programatico.
4. Abrir GUI e testar `[15] ConstruData -> RDO`.
5. Atualizar `STATUS_CICLO_OPERACIONAL_OFFLINE_20260426.md` com o resultado real.

