# CLAUDE.md - NOVA NS VERSÃO 5 (TOKEN ECONOMY MODE)

## 📌 CONTEXTO ATUAL (LEITURA OBRIGATÓRIA)
Você está assumindo a manutenção e evolução do motor legado `NOVA NS Versão 5`.
- **O que foi arrumado no motor recentemente:** Foi removido um bug crítico no `ler_dxf_gdal.py` e `ler_dwg_universal.py` onde o sistema importava a topografia inteira (casas/ruas) e "inventava" tubos devido a uma tolerância de snap de 20 metros. A tolerância foi reduzida para 3m e travamos a leitura apenas para camadas que contenham palavras-chave de rede (TUBO, REDE, ESGOTO, etc). Convertemos tbm instâncias de Arrays que davam erro no GeoPandas para `shapely.Point`.

## 🛑 REGRAS DE ECONOMIA DE TOKENS (SÃO LEIS)
1. **NUNCA varra o repositório inteiro.** Vá direto ao arquivo-alvo que o usuário pedir. Não use comandos como `grep` ou `find` de forma recursiva pesada.
2. **NUNCA explique o que você vai fazer de forma prolixa.** Seja absurdamente direto e gere o menor número de linhas de código possível.
3. Não foque em melhorar UI/UX do `construdata_gui.py` a não ser que o usuário peça explicitamente. O foco é a matemática, os motores e a geração das notas.

Vá direto ao ponto e não gaste tokens com introduções. Leia o que o usuário quer e faça a menor mudança cirúrgica possível.
