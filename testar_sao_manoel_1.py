#!/usr/bin/env python3
"""Testar DWG São Manoel (1)"""

import sys
sys.path.insert(0, '.')

from ler_dwg_aec import ler_dwg_aec
from pathlib import Path
from collections import Counter

DWG = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\ESTUDO - CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA (1).dwg"
SAIDA = r"C:\Users\felip\Downloads\PROJETOS DE ÁGUA E ESGOTO - DWG E DXF 2018\MAPAS ÁGUA E ESGOTO PARA DXF\SÃO MANOEL (1) 26-03-2026"

print("=" * 70)
print("TESTE DWG - ESTUDO CT SÃO MANOEL E CT JOÃO CARLOS DA SILVA (1)")
print("=" * 70)

print(f"\nArquivo: {Path(DWG).name}")
print(f"Existe: {Path(DWG).exists()}")

print("\n[1] Extraindo dados do DWG...")
pvs, trechos, meta = ler_dwg_aec(DWG)

print(f"\n✅ Extração concluída!")
print(f"  PVs: {len(pvs)}")
print(f"  Trechos: {len(trechos)}")
print(f"  Extensão: {meta.get('extensao_m', 0):.0f}m")
print(f"  Motor: {meta.get('motor', '?')}")

dns = Counter(t.get('dn_mm') for t in trechos if t.get('dn_mm'))
print(f"  DNs: {dict(sorted(dns.items()))}")

redes = Counter(t.get('tipo_rede') for t in trechos if t.get('tipo_rede'))
print(f"  Por rede: {dict(redes)}")

# Salvar JSON para análise
import json
output = Path(SAIDA)
output.mkdir(parents=True, exist_ok=True)

dados = {
    "arquivo": Path(DWG).name,
    "pvs": pvs,
    "trechos": trechos,
    "meta": meta,
    "resumo": {
        "n_pvs": len(pvs),
        "n_trechos": len(trechos),
        "dns": dict(sorted(dns.items())),
        "redes": dict(redes),
    }
}

with open(output / "EXTRACAO_DADOS.json", "w", encoding="utf-8") as f:
    json.dump(dados, f, indent=2, ensure_ascii=False)

print(f"\n📁 Dados salvos em: {output / 'EXTRACAO_DADOS.json'}")

# Mostrar primeiros PVs
print(f"\nPrimeiros 10 PVs:")
for i, (nome, pv) in enumerate(list(pvs.items())[:10]):
    ct = pv.get('ct', 0)
    cf = pv.get('cf', 0)
    print(f"  {nome}: CT={ct:.3f} CF={cf:.3f}")

# Mostrar primeiros trechos
print(f"\nPrimeiros 10 trechos:")
for i, t in enumerate(trechos[:10]):
    print(f"  {t['pv_ini']} -> {t['pv_fim']}: DN{t['dn_mm']} | {t.get('tipo_rede', '?')} | {t['ext_m']:.1f}m")
