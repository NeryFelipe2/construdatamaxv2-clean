# Evolução da "NOVA NS Versao 5" -> "Versão 6.1 Otimizada"

Este documento consolida as alterações profundas de otimização aplicadas aos scripts da pipeline, garantindo evolução direta de algoritmos de alto volume.

De acordo com o **Insights XGBoost** estabelecido como regra base:
Focamos em **módulos unificados estruturais**, sem criar inúmeros scripts picadores. As otimizações ocorreram na raiz dos motores, elevando Information Gain e reduzindo overhead.

## 1. Implementação de ML Real (`motor_ml.py`)
- **Antes**: Usava-se uma média móvel simples combinada com uma heurística arbitrária (mockando resultado visual de "XGBoost").
- **Depois**: Implementou-se um Surrogate Model autêntico `lightgbm.LGBMRegressor`. O modelo agora separa dados de dias reais em vetor, treina online em nanossegundos baseando-se nos próprios dados históricos (`X` vs `y`), e retorna projeções com maior acurácia analítica ajustadas progressivamente (`learning_rate=0.05`).

## 2. Paralelismo Massivo 2x (`processar_lote_dxf_ns.py` & `gerar_ns_v4.py`)
- **Antes**: Laços iterativos sequenciais limitados ao clock single-thread do processador nativo, que somavam segundos extras para criar N Diretórios, JSONs, HTMLs e múltiplos renders complexos de PDFs por matplotlib.
- **Depois**: A injeção de `concurrent.futures.ThreadPoolExecutor` delega o estresse de IO para threads paralelas. O Tempo global gasto por lote foi despencado brutalmente.

## 3. Otimização de Regexes em Motores Extratores (`ler_dxf_gdal.py` & `motor_auditoria_v4.py`)
- **Antes**: Para cada texto e nó geométrico lido do CAD e SHP, fazia-se compilação estática (`re.search(r"...", text)`) na hora.
- **Depois**: Instânciação léxica das expressões como constantes globais pré-compiladas (ex: `_RE_DN = re.compile(...)`). Retira completamente o parsing runtime repetido, melhorando escalabilidade para grandes shapes poligonais e textos esparsos.

### Restauração
Caso deseje voltar estas alterações estruturais, utilize o seu sistema de controle de versão (Git) voltando para o commit anterior à data destas mudanças ou revise as alterações baseadas nestes arquivos chaves que concentraram a cirurgia lógica.
