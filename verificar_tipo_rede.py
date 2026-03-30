#!/usr/bin/env python3
import json
from collections import Counter

with open('_debug_trechos.json', 'r', encoding='utf-8') as f:
    trechos = json.load(f)

# Por tipo de rede
redes = Counter(t.get('tipo_rede') for t in trechos)
print(f'Por tipo de rede: {dict(redes)}')

# DN por tipo de rede
print('\nDNs por tipo de rede:')
for tipo in ['esgoto', 'agua']:
    dns = [t['dn_mm'] for t in trechos if t.get('tipo_rede') == tipo]
    if dns:
        print(f'  {tipo}: {dict(sorted(Counter(dns).items()))}')

# Mostrar exemplos
print('\nExemplos:')
for t in trechos[:10]:
    print(f"  {t['pv_ini']} -> {t['pv_fim']}: DN{t['dn_mm']} | {t.get('tipo_rede', '?')}")
